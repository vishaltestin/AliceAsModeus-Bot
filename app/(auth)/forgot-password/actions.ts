"use server"

import { createHash, randomBytes } from "crypto"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetEmail } from "@/lib/email"
import { writeAuditLog } from "@/lib/audit"
import { isOverLimit, consume } from "@/lib/rate-limit"

// Prevent email bombing / abuse of the reset endpoint.
const RESET_REQ_LIMIT = 5
const RESET_REQ_WINDOW_MS = 60 * 60 * 1000 // 1 hour per email

const emailSchema = z.string().trim().email("Enter a valid email address.")
const genericMessage =
  "If an account exists for that email, we sent reset instructions."

export async function requestPasswordReset(emailInput: string) {
  const parsed = emailSchema.safeParse(emailInput)
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Enter a valid email address.",
    }

  const email = parsed.data.toLowerCase()
  try {
    // Rate limit per email — always return the generic message to avoid
    // leaking whether an account exists.
    const rlKey = `pwreset:${email}`
    if (isOverLimit(rlKey, RESET_REQ_LIMIT)) {
      return { success: true as const, message: genericMessage }
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      consume(rlKey, RESET_REQ_LIMIT, RESET_REQ_WINDOW_MS)
      return { success: true as const, message: genericMessage }
    }

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })
    const rawToken = randomBytes(32).toString("hex")
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(rawToken).digest("hex"),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    // Only consume the budget once a real reset email is about to be sent.
    consume(rlKey, RESET_REQ_LIMIT, RESET_REQ_WINDOW_MS)

    const baseUrl = (
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    ).replace(/\/$/, "")
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`
    const delivery = await sendPasswordResetEmail({
      to: email,
      name: user.name,
      resetUrl,
    })
    await writeAuditLog({
      accountId: user.accountId,
      userId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
      entityType: "User",
      entityId: user.id,
    })

    return {
      success: true as const,
      message: genericMessage,
      devResetUrl:
        !delivery.sent && process.env.NODE_ENV !== "production"
          ? resetUrl
          : undefined,
    }
  } catch (error) {
    console.error("[wacrm] Password reset request failed", error)
    return { success: true as const, message: genericMessage }
  }
}

export async function resetPassword(
  token: string,
  password: string,
  confirmPassword: string
) {
  if (!token) return { error: "This reset link is invalid or expired." }
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." }
  if (password !== confirmPassword) return { error: "Passwords do not match." }

  const tokenHash = createHash("sha256").update(token).digest("hex")
  const resetToken = await prisma.passwordResetToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { select: { id: true, accountId: true } } },
  })
  if (!resetToken) return { error: "This reset link is invalid or expired." }

  const bcrypt = await import("bcryptjs")
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.user.id },
      data: { password: await bcrypt.hash(password, 10) },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ])
  await writeAuditLog({
    accountId: resetToken.user.accountId,
    userId: resetToken.user.id,
    action: "PASSWORD_RESET_COMPLETED",
    entityType: "User",
    entityId: resetToken.user.id,
  })
  return { success: true as const }
}
