"use server"

import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isPlatformAdmin } from "@/lib/permissions"
import { setAccountStatus } from "@/lib/quota"

async function requirePlatformAdmin() {
  const session = await auth()
  if (!session?.user || !isPlatformAdmin(session.user.accountRole)) {
    throw new Error("Unauthorized")
  }
  return session
}

// Platform admin accounts (identified by a SUPER_ADMIN member) are excluded
// from all customer-facing stats so the platform itself is never counted.
async function getPlatformAccountIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { accountRole: "SUPER_ADMIN" },
    select: { accountId: true },
  })
  return [...new Set(rows.map((r) => r.accountId))]
}

/* -------------------------------------------------------------------------- */
/* Accounts                                                                     */
/* -------------------------------------------------------------------------- */

export type AccountListQuery = {
  search?: string
  status?: "ACTIVE" | "SUSPENDED" | "ALL"
  plan?: string
  connected?: "yes" | "no" | "all"
  sort?: "newest" | "oldest" | "used" | "remaining"
}

export async function listAccounts(query: AccountListQuery = {}) {
  await requirePlatformAdmin()

  const where: Record<string, unknown> = {}
  if (query.status && query.status !== "ALL") where.status = query.status
  if (query.plan && query.plan !== "ALL") where.planType = query.plan
  const platformIds = await getPlatformAccountIds()
  if (platformIds.length) where.id = { notIn: platformIds }

  const accounts = await prisma.account.findMany({
    where,
    include: {
      _count: { select: { members: true } },
      whatsappConfig: { select: { status: true, connectedAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  let rows = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    email: null as string | null,
    status: a.status,
    planType: a.planType,
    quota: a.messageQuota,
    used: a.messagesUsed,
    remaining: Math.max(0, a.messageQuota - a.messagesUsed),
    userCount: a._count.members,
    whatsappStatus: a.whatsappConfig?.status ?? "DISCONNECTED",
    connected: a.whatsappConfig?.status === "CONNECTED",
    createdAt: a.createdAt,
  }))

  // Attach owner email for the row (nice for search/displays).
  const ownerIds = accounts.map((a) => a.ownerUserId)
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: { id: true, email: true },
  })
  const ownerByUser = new Map(owners.map((u) => [u.id, u.email]))
  rows = rows.map((r) => {
    const owner = accounts.find((a) => a.id === r.id)
    return { ...r, email: owner ? ownerByUser.get(owner.ownerUserId) ?? null : null }
  })

  // Search across name/email after fetching (keeps query simple).
  const term = query.search?.trim().toLowerCase()
  if (term) {
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        (r.email ?? "").toLowerCase().includes(term) ||
        r.id.toLowerCase().includes(term)
    )
  }
  if (query.connected === "yes") rows = rows.filter((r) => r.connected)
  if (query.connected === "no") rows = rows.filter((r) => !r.connected)

  if (query.sort === "used") rows.sort((a, b) => b.used - a.used)
  else if (query.sort === "remaining") rows.sort((a, b) => a.remaining - b.remaining)
  else if (query.sort === "oldest")
    rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  else rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return rows
}

export async function getAccountDetail(accountId: string) {
  await requirePlatformAdmin()
  if (!accountId) throw new Error("Account id is required")

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      members: { orderBy: { createdAt: "asc" }, take: 50 },
      whatsappConfig: true,
    },
  })
  if (!account) return null

  const usageByFeature = await prisma.messageUsageLog.groupBy({
    by: ["feature"],
    where: { accountId },
    _sum: { count: true },
  })
  const [contacts, conversations, broadcasts, automations, apiKeys] =
    await Promise.all([
      prisma.contact.count({ where: { accountId } }),
      prisma.conversation.count({ where: { accountId } }),
      prisma.broadcast.count({ where: { accountId } }),
      prisma.automation.count({ where: { accountId } }),
      prisma.apiKey.count({ where: { accountId } }),
    ])

  const recentUsage = await prisma.messageUsageLog.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: { account: { select: { name: true } } },
  })

  const [totalPaid, purchaseCount] = await Promise.all([
    prisma.quotaPurchase.aggregate({
      where: { accountId },
      _sum: { amountPaid: true },
      _count: true,
    }),
    prisma.quotaPurchase.count({ where: { accountId } }),
  ])

  return {
    id: account.id,
    name: account.name,
    status: account.status,
    planType: account.planType,
    quota: account.messageQuota,
    used: account.messagesUsed,
    remaining: Math.max(0, account.messageQuota - account.messagesUsed),
    quotaValidUntil: account.quotaValidUntil,
    currency: account.currency,
    totalPaid: totalPaid._sum.amountPaid ?? 0,
    purchaseCount,
    adminNotes: account.adminNotes,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    whatsapp: account.whatsappConfig
      ? {
          status: account.whatsappConfig.status,
          phoneNumberId: account.whatsappConfig.phoneNumberId,
          wabaId: account.whatsappConfig.wabaId,
          connectedAt: account.whatsappConfig.connectedAt,
          lastRegistrationError: account.whatsappConfig.lastRegistrationError,
        }
      : null,
    members: account.members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.accountRole,
      createdAt: m.createdAt,
    })),
    usageByFeature: usageByFeature.map((u) => ({
      feature: u.feature,
      count: u._sum.count ?? 0,
    })),
    counts: { contacts, conversations, broadcasts, automations, apiKeys },
    recentUsage,
  }
}

export type QuotaPurchaseInput = {
  quota: number // new lifetime quota
  amountPaid?: number
  validityMonths?: number // 0 = lifetime, else months (e.g. 12, 24)
  // Optional explicit expiry date. When provided it overrides the computed
  // validUntil from validityMonths (used for custom date ranges).
  validUntil?: Date | string | null
  note?: string
}

export async function updateAccountQuota(
  accountId: string,
  input: QuotaPurchaseInput
) {
  const admin = await requirePlatformAdmin()
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, name: true, messageQuota: true },
  })
  if (!account) throw new Error("Account not found")

  const quota = Math.max(0, Math.floor(input.quota))
  const validityMonths = Math.max(0, Math.floor(input.validityMonths ?? 12))
  const amountPaid = Math.max(0, Number(input.amountPaid) || 0)

  // Validity: if an explicit date is supplied, use it. A past (or invalid)
  // date is rejected rather than silently converting to Lifetime — otherwise an
  // admin who enters a date that has already passed would unintentionally grant
  // a never-expiring plan. Otherwise months > 0 computes an expiry from now;
  // 0 means lifetime.
  let validUntil: Date | null
  if (input.validUntil) {
    const parsed = new Date(input.validUntil)
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("The chosen expiry date is invalid.")
    }
    if (parsed.getTime() <= Date.now()) {
      throw new Error(
        "The expiry date is in the past. Choose today or a future date, or use Lifetime."
      )
    }
    validUntil = parsed
  } else {
    validUntil =
      validityMonths > 0
        ? new Date(Date.now() + validityMonths * 30 * 24 * 60 * 60 * 1000)
        : null
  }

  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: accountId },
      data: {
        messageQuota: quota,
        planType: quota === 0 ? "FREE" : "CUSTOM",
        quotaValidUntil: validUntil,
        adminNotes: input.note !== undefined ? input.note || null : undefined,
      },
    })
    await tx.quotaPurchase.create({
      data: {
        accountId,
        createdByUserId: admin.user.id,
        amountPaid,
        currency: "INR",
        quotaBefore: account.messageQuota,
        quotaAfter: quota,
        validityMonths: validUntil ? validityMonths : 0,
        validUntil,
        note: input.note || null,
      },
    })
    await tx.auditLog.create({
      data: {
        accountId,
        userId: admin.user.id,
        action: "PLATFORM_QUOTA_UPDATED",
        entityType: "Account",
        entityId: accountId,
        metadata: {
          quota,
          amountPaid,
          validityMonths,
          validUntil,
          note: input.note,
        },
      },
    })
  })

  return { success: true }
}

export async function getAccountPurchases(accountId: string) {
  await requirePlatformAdmin()
  if (!accountId) return []
  const purchases = await prisma.quotaPurchase.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true, email: true } } },
  })
  return purchases.map((p) => ({
    id: p.id,
    accountId: p.accountId,
    amountPaid: p.amountPaid,
    currency: p.currency,
    quotaBefore: p.quotaBefore,
    quotaAfter: p.quotaAfter,
    validityMonths: p.validityMonths,
    validUntil: p.validUntil,
    note: p.note,
    createdAt: p.createdAt,
    createdByName: p.createdBy?.name ?? null,
    createdByEmail: p.createdBy?.email ?? null,
  }))
}

// Dedicated global ledger: every quota purchase across all customer accounts.
export async function listAllPurchases(query: { search?: string; accountId?: string } = {}) {
  await requirePlatformAdmin()
  const where: Record<string, unknown> = {}
  if (query.accountId) where.accountId = query.accountId

  const purchases = await prisma.quotaPurchase.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      account: { select: { id: true, name: true } },
      createdBy: { select: { name: true, email: true } },
    },
  })

  let rows = purchases.map((p) => ({
    id: p.id,
    accountId: p.accountId,
    accountName: p.account?.name ?? "Unknown",
    amountPaid: p.amountPaid,
    currency: p.currency,
    quotaBefore: p.quotaBefore,
    quotaAfter: p.quotaAfter,
    validityMonths: p.validityMonths,
    validUntil: p.validUntil,
    note: p.note,
    createdAt: p.createdAt,
    createdByName: p.createdBy?.name ?? null,
    createdByEmail: p.createdBy?.email ?? null,
  }))

  const term = query.search?.trim().toLowerCase()
  if (term) {
    rows = rows.filter(
      (r) =>
        r.accountName.toLowerCase().includes(term) ||
        (r.createdByEmail ?? "").toLowerCase().includes(term) ||
        (r.createdByName ?? "").toLowerCase().includes(term) ||
        (r.note ?? "").toLowerCase().includes(term)
    )
  }
  return rows
}

export async function toggleAccountStatus(
  accountId: string,
  status: "ACTIVE" | "SUSPENDED"
) {
  const admin = await requirePlatformAdmin()
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, name: true },
  })
  if (!account) throw new Error("Account not found")

  await setAccountStatus(accountId, status)
  await prisma.auditLog.create({
    data: {
      accountId,
      userId: admin.user.id,
      action: status === "SUSPENDED" ? "PLATFORM_SUSPENDED" : "PLATFORM_ACTIVATED",
      entityType: "Account",
      entityId: accountId,
      metadata: { name: account.name },
    },
  })
  return { success: true }
}

export async function deleteAccount(accountId: string) {
  const admin = await requirePlatformAdmin()
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, name: true },
  })
  if (!account) throw new Error("Account not found")
  if (account.id === admin.user.accountId)
    throw new Error("You cannot delete your own platform account")

  await prisma.auditLog.create({
    data: {
      accountId,
      userId: admin.user.id,
      action: "PLATFORM_ACCOUNT_DELETED",
      entityType: "Account",
      entityId: accountId,
      metadata: { name: account.name },
    },
  })
  await prisma.account.delete({ where: { id: accountId } })
  return { success: true }
}

/* -------------------------------------------------------------------------- */
/* Analytics & platform health                                                  */
/* -------------------------------------------------------------------------- */

function daysAgo(n: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

export async function getPlatformMetrics() {
  await requirePlatformAdmin()
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const platformIds = await getPlatformAccountIds()
  const idFilter = platformIds.length ? { id: { notIn: platformIds } } : {}
  const accountIdFilter = platformIds.length
    ? { accountId: { notIn: platformIds } }
    : {}

  const [totalAccounts, activeAccounts, suspendedAccounts, totalUsers,
    totalMessages, totalUsageRows, connectedCount, registrationsToday,
    activeUsers30d, recentActivity] = await Promise.all([
    prisma.account.count({ where: idFilter }),
    prisma.account.count({ where: { status: "ACTIVE", ...idFilter } }),
    prisma.account.count({ where: { status: "SUSPENDED", ...idFilter } }),
    prisma.user.count({ where: { accountRole: { not: "SUPER_ADMIN" } } }),
    prisma.messageUsageLog.aggregate({ where: accountIdFilter, _sum: { count: true } }),
    prisma.messageUsageLog.count({ where: accountIdFilter }),
    prisma.whatsAppConfig.count({
      where: { status: "CONNECTED", ...(platformIds.length ? { account: { id: { notIn: platformIds } } } : {}) },
    }),
    prisma.account.count({ where: { createdAt: { gte: todayStart }, ...idFilter } }),
    prisma.user.count({ where: { updatedAt: { gte: thirtyDaysAgo }, accountRole: { not: "SUPER_ADMIN" } } }),
    prisma.messageUsageLog.findMany({
      where: accountIdFilter,
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { account: { select: { name: true } } },
    }),
  ])

  // Message trend (last 14 days).
  const trendStart = daysAgo(13)
  const trendRows = await prisma.messageUsageLog.findMany({
    where: { createdAt: { gte: trendStart }, status: "SENT", ...accountIdFilter },
    select: { createdAt: true, count: true },
  })
  const trend: { label: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const day = daysAgo(i)
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
    trend.push({
      label: day.toLocaleDateString("en", { month: "short", day: "numeric" }),
      count: 0,
    })
    trend[trend.length - 1].count = trendRows
      .filter((r) => `${r.createdAt.getFullYear()}-${r.createdAt.getMonth()}-${r.createdAt.getDate()}` === key)
      .reduce((s, r) => s + r.count, 0)
  }

  // Feature usage distribution.
  const featureRows = await prisma.messageUsageLog.groupBy({
    by: ["feature"],
    _sum: { count: true },
    where: { status: "SENT", ...accountIdFilter },
  })

  // Quota pool: total allocated vs used (customer accounts only).
  const pool = await prisma.account.aggregate({
    where: idFilter,
    _sum: { messageQuota: true, messagesUsed: true },
  })

  return {
    stats: {
      totalAccounts,
      activeAccounts,
      suspendedAccounts,
      totalUsers,
      totalMessages: totalMessages._sum.count ?? 0,
      usageRows: totalUsageRows,
      connected: connectedCount,
      registrationsToday,
      activeUsers30d,
      quotaAllocated: pool._sum.messageQuota ?? 0,
      quotaUsed: pool._sum.messagesUsed ?? 0,
    },
    trend,
    featureUsage: featureRows.map((f) => ({
      feature: f.feature,
      count: f._sum.count ?? 0,
    })),
    recentActivity,
  }
}

export type PlatformMetrics = Awaited<ReturnType<typeof getPlatformMetrics>>

/* -------------------------------------------------------------------------- */
/* Admin profile & security                                                     */
/* -------------------------------------------------------------------------- */

export async function getPlatformAdminProfile() {
  const session = await requirePlatformAdmin()
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, accountId: true },
  })
  if (!user) throw new Error("Admin not found")
  return user
}

export async function updatePlatformAdminProfile(name: string, email: string) {
  const session = await requirePlatformAdmin()
  const cleanName = name.trim()
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanName) return { error: "Name is required" }
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail))
    return { error: "Enter a valid email address" }

  const conflict = await prisma.user.findUnique({ where: { email: cleanEmail } })
  if (conflict && conflict.id !== session.user.id)
    return { error: "That email is already in use" }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: cleanName, email: cleanEmail },
  })
  return { success: true }
}

export async function changePlatformAdminPassword(
  currentPassword: string,
  newPassword: string
) {
  const session = await requirePlatformAdmin()
  if (newPassword.length < 8)
    return { error: "New password must be at least 8 characters" }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  })
  if (!user) throw new Error("Admin not found")

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) return { error: "Your current password is incorrect" }

  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashed },
  })
  return { success: true }
}
