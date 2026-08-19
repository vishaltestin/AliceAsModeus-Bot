"use server"

import { randomUUID } from "crypto"
import { createHash } from "crypto"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { DEFAULT_CONTACT_CATEGORIES } from "@/lib/contact-categories"

const baseSchema = z.object({
  name: z.string().trim().min(2, "Your name must be at least 2 characters."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Your password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Please confirm your password."),
  accountName: z
    .string()
    .trim()
    .min(2, "Your team name must be at least 2 characters."),
})

const joinSchema = z
  .object({
    name: z.string().trim().min(2, "Your name must be at least 2 characters."),
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(8, "Your password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .superRefine((data, context) => {
    if (data.password !== data.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      })
    }
  })

export async function signup(formData: FormData, joinToken = "") {
  // When the user is joining an existing workspace via an invitation, we do NOT
  // create a new workspace — we create their user directly inside the invited
  // account so they never end up with an unnecessary personal workspace.
  const isJoin = Boolean(joinToken)
  const parsed = isJoin
    ? joinSchema.safeParse(Object.fromEntries(formData))
    : baseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const name = parsed.data.name
  const email = parsed.data.email.toLowerCase()
  const password = parsed.data.password

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return {
        error: isJoin
          ? "This email is already registered. Sign in and accept the invitation instead."
          : "An account with this email already exists.",
        fieldErrors: { email: ["Try signing in instead."] },
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const userId = randomUUID()

    if (isJoin) {
      const tokenHash = createHash("sha256").update(joinToken).digest("hex")
      const invite = await prisma.accountInvitation.findUnique({
        where: { tokenHash },
      })
      if (!invite) return { error: "This invitation link is invalid." }
      if (invite.acceptedAt)
        return { error: "This invitation has already been used." }
      if (invite.expiresAt < new Date())
        return { error: "This invitation has expired." }

      // Create the user directly as a member of the invited account — no new
      // workspace is created.
      await prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: userId,
            name,
            email,
            password: hashedPassword,
            accountId: invite.accountId,
            accountRole: invite.role,
          },
        })
        await tx.accountInvitation.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date(), acceptedByUserId: userId },
        })
      })

      return { success: true as const, joinedAccount: true as const }
    }

    // Non-join branch: parsed is the baseSchema result here (isJoin is false).
    const accountName = (parsed.data as z.infer<typeof baseSchema>).accountName
    await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          name: accountName,
          ownerUserId: userId,
          defaultCurrency: "INR",
        },
      })

      await tx.user.create({
        data: {
          id: userId,
          name,
          email,
          password: hashedPassword,
          accountId: account.id,
          accountRole: "OWNER",
        },
      })

      // Seed the default contact categories so a new workspace starts with a
      // sensible set. Users can add/remove categories later.
      await tx.contactCategory.createMany({
        data: DEFAULT_CONTACT_CATEGORIES.map((c) => ({
          accountId: account.id,
          name: c.name,
          color: c.color,
        })),
        skipDuplicates: true,
      })
    })

    return { success: true as const }
  } catch (error) {
    console.error("[wacrm] Signup action failed", error)
    return {
      error: "We couldn't create your account right now. Please try again.",
    }
  }
}
