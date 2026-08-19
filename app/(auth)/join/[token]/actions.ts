"use server"

import { createHash } from "crypto"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function peekInvitation(token: string) {
  if (!token) return { error: "Invalid invitation link." }
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const invite = await prisma.accountInvitation.findUnique({
    where: { tokenHash },
    include: { account: { select: { name: true } } },
  })
  if (!invite) return { error: "This invitation link is invalid." }
  if (invite.acceptedAt)
    return { error: "This invitation has already been used." }
  if (invite.expiresAt < new Date())
    return { error: "This invitation has expired." }
  return { accountName: invite.account.name, role: invite.role }
}

export async function acceptInvitation(token: string) {
  if (!token) return { error: "Invalid invitation link." }
  const session = await auth()
  if (!session?.user) return { error: "unauthenticated" }

  const tokenHash = createHash("sha256").update(token).digest("hex")
  const invite = await prisma.accountInvitation.findUnique({
    where: { tokenHash },
  })
  if (!invite) return { error: "This invitation link is invalid." }
  if (invite.acceptedAt)
    return { error: "This invitation has already been used." }
  if (invite.expiresAt < new Date())
    return { error: "This invitation has expired." }
  if (invite.accountId === session.user.accountId)
    return { error: "You're already a member of this account." }

  const oldAccountId = session.user.accountId
  const [memberCount, contactCount] = await Promise.all([
    prisma.user.count({ where: { accountId: oldAccountId } }),
    prisma.contact.count({ where: { accountId: oldAccountId } }),
  ])
  if (memberCount > 1 || contactCount > 0) {
    return {
      error:
        "Your current account already has data or teammates — sign up with a different email to join this one.",
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.user.id },
      data: { accountId: invite.accountId, accountRole: invite.role },
    })
    await tx.accountInvitation.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date(), acceptedByUserId: session.user.id },
    })
    await tx.account.delete({ where: { id: oldAccountId } })
  })

  return { success: true }
}
