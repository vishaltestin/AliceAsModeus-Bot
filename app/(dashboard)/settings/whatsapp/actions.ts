"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminRole } from "@/lib/permissions"
import { encrypt, decrypt } from "@/lib/encryption"
import {
  verifyPhoneNumber,
  subscribeAppToWaba,
  WhatsAppApiError,
} from "@/lib/whatsapp/client"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  if (!isAdminRole(session.user.accountRole)) {
    throw new Error("Forbidden")
  }
  return session
}

// Returns the public base URL and the webhook callback URL the user must
// configure in Meta for Developers, plus whether the webhook is fully set up.
export async function getWhatsAppSetupUrls() {
  const session = await requireAdmin()
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ).replace(/\/$/, "")

  const config = await prisma.whatsAppConfig.findUnique({
    where: { accountId: session.user.accountId },
    select: { verifyToken: true, metaAppSecretEncrypted: true },
  })

  return {
    baseUrl: base,
    webhookUrl: `${base}/api/webhooks/whatsapp`,
    webhookReady:
      Boolean(config?.verifyToken) && Boolean(config?.metaAppSecretEncrypted),
  }
}

export async function getWhatsAppConfig() {  const session = await requireAdmin()

  const config = await prisma.whatsAppConfig.findUnique({
    where: { accountId: session.user.accountId },
  })
  if (!config) return null

  return {
    phoneNumberId: config.phoneNumberId,
    wabaId: config.wabaId,
    status: config.status,
    hasAccessToken: true,
    hasVerifyToken: Boolean(config.verifyToken),
    hasAppSecret: Boolean(config.metaAppSecretEncrypted),
    lastRegistrationError: config.lastRegistrationError,
  }
}

async function verifyAndActivate(
  accountId: string,
  phoneNumberId: string,
  wabaId: string | null,
  accessToken: string
) {
  try {
    await verifyPhoneNumber(phoneNumberId, accessToken)
    if (wabaId) await subscribeAppToWaba(wabaId, accessToken)

    await prisma.whatsAppConfig.update({
      where: { accountId },
      data: {
        status: "CONNECTED",
        connectedAt: new Date(),
        registeredAt: new Date(),
        subscribedAppsAt: wabaId ? new Date() : null,
        lastRegistrationError: null,
      },
    })
    return { success: true as const }
  } catch (err) {
    const message =
      err instanceof WhatsAppApiError
        ? err.message
        : "Could not verify these credentials with Meta"
    await prisma.whatsAppConfig.update({
      where: { accountId },
      data: { status: "DISCONNECTED", lastRegistrationError: message },
    })
    return { success: false as const, error: message }
  }
}

export async function saveWhatsAppConfig(formData: FormData) {
  const session = await requireAdmin()

  const phoneNumberId = (formData.get("phoneNumberId") as string)?.trim()
  const wabaId = (formData.get("wabaId") as string)?.trim() || null
  const accessTokenInput = (formData.get("accessToken") as string)?.trim()
  const verifyTokenInput = (formData.get("verifyToken") as string)?.trim()
  const appSecretInput = (formData.get("appSecret") as string)?.trim()

  if (!phoneNumberId) return { error: "Phone number ID is required" }

  const existing = await prisma.whatsAppConfig.findUnique({
    where: { accountId: session.user.accountId },
  })
  if (!accessTokenInput && !existing)
    return { error: "Access token is required" }

  const conflict = await prisma.whatsAppConfig.findUnique({
    where: { phoneNumberId },
  })
  if (conflict && conflict.accountId !== session.user.accountId) {
    return {
      error: "This phone number is already connected to another account",
    }
  }

  const accessTokenEncrypted = accessTokenInput
    ? encrypt(accessTokenInput)
    : existing!.accessTokenEncrypted
  const verifyToken = verifyTokenInput || existing?.verifyToken || null
  // Each company owns its own Meta Developer App, so its App Secret is stored
  // (encrypted) on this account's WhatsApp config and used to verify the shared
  // webhook endpoint's signature. Leave blank to keep the current secret.
  const metaAppSecretEncrypted = appSecretInput
    ? encrypt(appSecretInput)
    : existing?.metaAppSecretEncrypted ?? null

  await prisma.whatsAppConfig.upsert({
    where: { accountId: session.user.accountId },
    create: {
      accountId: session.user.accountId,
      phoneNumberId,
      wabaId,
      accessTokenEncrypted,
      metaAppSecretEncrypted,
      verifyToken,
    },
    update: {
      phoneNumberId,
      wabaId,
      accessTokenEncrypted,
      metaAppSecretEncrypted,
      verifyToken,
    },
  })

  const accessToken =
    accessTokenInput || decrypt(existing!.accessTokenEncrypted)
  const result = await verifyAndActivate(
    session.user.accountId,
    phoneNumberId,
    wabaId,
    accessToken
  )

  if (!result.success)
    return {
      error: `Saved, but Meta rejected these credentials: ${result.error}`,
    }
  return { success: true }
}

export async function verifyWhatsAppConnection() {
  const session = await requireAdmin()

  const config = await prisma.whatsAppConfig.findUnique({
    where: { accountId: session.user.accountId },
  })
  if (!config) return { error: "No WhatsApp settings saved yet" }

  const accessToken = decrypt(config.accessTokenEncrypted)
  const result = await verifyAndActivate(
    session.user.accountId,
    config.phoneNumberId,
    config.wabaId,
    accessToken
  )
  return result.success ? { success: true } : { error: result.error }
}
