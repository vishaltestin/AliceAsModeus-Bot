"use server"

import bcrypt from "bcryptjs"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeAuditLog } from "@/lib/audit"

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
) {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  if (newPassword.length < 8)
    return { error: "New password must be at least 8 characters." }
  if (newPassword !== confirmPassword)
    return { error: "New passwords do not match." }

  const user = await prisma.user.findFirst({
    where: { id: session.user.id, accountId: session.user.accountId },
  })
  if (!user) return { error: "User not found." }
  if (!(await bcrypt.compare(currentPassword, user.password)))
    return { error: "Current password is incorrect." }

  const parsed = z.string().min(8).safeParse(newPassword)
  if (!parsed.success)
    return { error: "New password must be at least 8 characters." }
  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(newPassword, 10) },
  })
  await writeAuditLog({
    accountId: session.user.accountId,
    userId: user.id,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: user.id,
  })
  return { success: true as const }
}
