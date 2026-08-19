import { prisma } from "@/lib/prisma"

export class QuotaError extends Error {
  constructor(
    message: string,
    public code: "QUOTA_EXHAUSTED" | "SUSPENDED" | "EXPIRED" = "QUOTA_EXHAUSTED"
  ) {
    super(message)
    this.name = "QuotaError"
  }
}

export type MessageFeature = "INBOX" | "BROADCAST" | "API" | "AUTOMATION"

export type AccountQuota = {
  accountId: string
  status: "ACTIVE" | "SUSPENDED"
  planType: string
  quota: number
  used: number
  remaining: number
  exhausted: boolean
  // Validity of the current plan/quota.
  validUntil: Date | null
  expired: boolean // true when validUntil exists and is in the past
}

function isExpired(validUntil: Date | null, now: Date): boolean {
  return Boolean(validUntil && validUntil.getTime() <= now.getTime())
}

export async function getAccountQuota(accountId: string): Promise<AccountQuota> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      status: true,
      planType: true,
      messageQuota: true,
      messagesUsed: true,
      quotaValidUntil: true,
    },
  })
  if (!account) throw new Error("Account not found")
  const quota = account.messageQuota
  const used = account.messagesUsed
  const expired = isExpired(account.quotaValidUntil, new Date())
  return {
    accountId: account.id,
    status: account.status as AccountQuota["status"],
    planType: account.planType,
    quota,
    used,
    remaining: Math.max(0, quota - used),
    exhausted: used >= quota,
    validUntil: account.quotaValidUntil,
    expired,
  }
}

export async function isMessagingAllowed(accountId: string): Promise<boolean> {
  const q = await getAccountQuota(accountId)
  return q.status !== "SUSPENDED" && !q.exhausted && !q.expired
}

/**
 * Reserve/consume `count` messages for a message-consuming feature (Inbox,
 * Broadcasts, API, Automations). Throws QuotaError when the account is
 * suspended or has exhausted its quota; otherwise increments the lifetime
 * counter and writes one ledger row for analytics/billing.
 *
 * This is the single seam a future subscription/billing system can replace:
 * keep the signature, swap the backing implementation (e.g. call an external
 * metering/billing API).
 */
export async function consumeMessages(
  accountId: string,
  count: number,
  opts: {
    feature: MessageFeature
    userId?: string
    recipientPhone?: string
    messageId?: string
  }
): Promise<AccountQuota> {
  const n = Math.max(0, Math.floor(count))
  if (n === 0) return getAccountQuota(accountId)

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      status: true,
      planType: true,
      messageQuota: true,
      messagesUsed: true,
      quotaValidUntil: true,
    },
  })
  if (!account) throw new Error("Account not found")

  const expired = isExpired(account.quotaValidUntil, new Date())

  if (account.status === "SUSPENDED") {
    await logUsage(accountId, { ...opts, count: n, status: "QUOTA_BLOCKED" })
    throw new QuotaError("This account is suspended by the platform admin.", "SUSPENDED")
  }
  // A plan with an expiry that has passed is blocked even if the quota still
  // has remaining messages.
  if (expired) {
    await logUsage(accountId, { ...opts, count: n, status: "QUOTA_BLOCKED" })
    throw new QuotaError(
      `Your plan expired on ${account.quotaValidUntil!.toLocaleDateString()}. Contact your provider to renew.`,
      "EXPIRED"
    )
  }
  if (account.messagesUsed + n > account.messageQuota) {
    await logUsage(accountId, { ...opts, count: n, status: "QUOTA_BLOCKED" })
    throw new QuotaError(
      `Your message quota is exhausted (${account.messagesUsed} of ${account.messageQuota} used). Contact your provider to add more messages.`,
      "QUOTA_EXHAUSTED"
    )
  }

  const updated = await prisma.account.update({
    where: { id: accountId },
    data: { messagesUsed: { increment: n } },
    select: { messageQuota: true, messagesUsed: true },
  })
  await logUsage(accountId, { ...opts, count: n, status: "SENT" })

  return {
    accountId,
    status: account.status as AccountQuota["status"],
    planType: account.planType,
    quota: updated.messageQuota,
    used: updated.messagesUsed,
    remaining: Math.max(0, updated.messageQuota - updated.messagesUsed),
    exhausted: updated.messagesUsed >= updated.messageQuota,
    validUntil: account.quotaValidUntil,
    expired: false,
  }
}

async function logUsage(
  accountId: string,
  opts: {
    feature: MessageFeature
    userId?: string
    recipientPhone?: string
    count: number
    status: string
    messageId?: string
  }
) {
  await prisma.messageUsageLog.create({
    data: {
      accountId,
      userId: opts.userId ?? null,
      feature: opts.feature,
      recipientPhone: opts.recipientPhone ?? null,
      count: opts.count,
      status: opts.status,
      messageId: opts.messageId ?? null,
    },
  }).catch(() => {
    // Usage accounting must never break a real send.
  })
}

/**
 * Platform-admin quota management. Centralized so a future automated
 * subscription/billing system can drive these same fields.
 */
export async function setAccountQuota(accountId: string, quota: number, planType = "CUSTOM") {
  const q = Math.max(0, Math.floor(quota))
  return prisma.account.update({
    where: { id: accountId },
    data: { messageQuota: q, planType },
  })
}

export async function setAccountStatus(
  accountId: string,
  status: "ACTIVE" | "SUSPENDED"
) {
  return prisma.account.update({ where: { id: accountId }, data: { status } })
}
