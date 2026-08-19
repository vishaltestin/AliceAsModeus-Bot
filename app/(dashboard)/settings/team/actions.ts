"use server"

import { randomBytes, createHash } from "crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminRole } from "@/lib/permissions"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  if (!isAdminRole(session.user.accountRole))
    throw new Error("Forbidden")
  return session
}
export async function getTeamMembers() {
  const session = await requireAdmin()
  return prisma.user.findMany({
    where: { accountId: session.user.accountId },
    select: {
      id: true,
      name: true,
      email: true,
      accountRole: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })
}

export async function getPendingInvitations() {
  const session = await requireAdmin()
  return prisma.accountInvitation.findMany({
    where: {
      accountId: session.user.accountId,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function createInvitation(
  role: "ADMIN" | "AGENT" | "VIEWER",
  label?: string
) {
  const session = await requireAdmin()
  const token = randomBytes(32).toString("hex")
  const tokenHash = createHash("sha256").update(token).digest("hex")

  await prisma.accountInvitation.create({
    data: {
      accountId: session.user.accountId,
      tokenHash,
      role,
      label: label || null,
      createdByUserId: session.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
  return { token } // plaintext token, shown once — page builds the full URL client-side
}

export async function revokeInvitation(id: string) {
  const session = await requireAdmin()
  await prisma.accountInvitation.deleteMany({
    where: { id, accountId: session.user.accountId },
  })
}

export async function updateMemberRole(
  userId: string,
  role: "ADMIN" | "AGENT" | "VIEWER"
) {
  const session = await requireAdmin()
  if (userId === session.user.id) throw new Error("Cannot change your own role")
  const target = await prisma.user.findFirst({
    where: { id: userId, accountId: session.user.accountId },
  })
  if (!target) throw new Error("Member not found")
  if (target.accountRole === "OWNER")
    throw new Error("Cannot change the owner's role")
  await prisma.user.update({
    where: { id: userId },
    data: { accountRole: role },
  })
}

export async function removeMember(userId: string) {
  const session = await requireAdmin()
  if (userId === session.user.id) throw new Error("Cannot remove yourself")
  const target = await prisma.user.findFirst({
    where: { id: userId, accountId: session.user.accountId },
  })
  if (!target) throw new Error("Member not found")
  if (target.accountRole === "OWNER")
    throw new Error("Cannot remove the account owner")

  // Mirrors signup: the removed user keeps their login, just gets moved to
  // a fresh, empty personal account rather than being deleted outright.
  await prisma.$transaction(async (tx) => {
    const newAccount = await tx.account.create({
      data: { name: target.name || target.email, ownerUserId: userId },
    })
    await tx.user.update({
      where: { id: userId },
      data: { accountId: newAccount.id, accountRole: "OWNER" },
    })
  })
}
