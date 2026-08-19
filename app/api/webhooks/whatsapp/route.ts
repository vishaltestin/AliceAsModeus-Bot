import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/encryption"
import { downloadAndStoreMedia } from "@/lib/whatsapp/media"
import { runAutomationsForTrigger } from "@/lib/automations/engine"
import { createNotification } from "@/lib/notifications"
import { Prisma } from "@/generated/prisma/client"
import { applyBroadcastWhatsAppStatus } from "@/lib/broadcasts/dispatch"
import type {
  WebhookMedia,
  WebhookMessage,
  WebhookPayload,
  WebhookStatus,
} from "./types"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("hub.mode") !== "subscribe")
    return new NextResponse("Forbidden", { status: 403 })

  const token = searchParams.get("hub.verify_token")
  const config = token
    ? await prisma.whatsAppConfig.findFirst({ where: { verifyToken: token } })
    : null
  if (!config) return new NextResponse("Forbidden", { status: 403 })

  return new NextResponse(searchParams.get("hub.challenge") ?? "", {
    status: 200,
  })
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return (
    bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
  )
}

// Verify `x-hub-signature-256` against a company's own Meta App Secret.
function secretVerifies(secret: string, rawBody: string, signature: string) {
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  return timingSafeEqual(signature, expected)
}

// Legacy fallback: a single global META_APP_SECRET env var (if still set).
function globalSecretVerifies(rawBody: string, signature: string): boolean {
  const secret = process.env.META_APP_SECRET
  if (!secret) return false
  return secretVerifies(secret, rawBody, signature)
}

// Look up the account whose Meta Developer App signed this webhook by trying
// each configured (per-company) app secret. Returns the matching WhatsAppConfig
// or null if none matched.
async function resolveVerifiedConfig(
  rawBody: string,
  signature: string | null
): Promise<{
  accountId: string
  phoneNumberId: string
} | null> {
  if (!signature) return null

  const configs = await prisma.whatsAppConfig.findMany({
    where: { NOT: { metaAppSecretEncrypted: null } },
    select: {
      accountId: true,
      phoneNumberId: true,
      metaAppSecretEncrypted: true,
    },
  })
  for (const config of configs) {
    if (!config.metaAppSecretEncrypted) continue
    let secret: string
    try {
      secret = decrypt(config.metaAppSecretEncrypted)
    } catch {
      continue // undecryptable secret (e.g. rotated ENCRYPTION_KEY) — skip
    }
    if (secretVerifies(secret, rawBody, signature)) {
      return { accountId: config.accountId, phoneNumberId: config.phoneNumberId }
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  console.log("[WhatsApp webhook] POST received", new Date().toISOString())

  const signature = req.headers.get("x-hub-signature-256")

  // Resolve which company (account) signed this payload by verifying the
  // signature against each company's OWN Meta Developer App Secret. Each
  // company runs its own Meta app, so its app secret is stored per-account on
  // WhatsAppConfig (not a single global env var). A single shared webhook
  // endpoint still serves everyone — we just identify the sender by signature.
  const verifiedConfig = await resolveVerifiedConfig(rawBody, signature)

  // No signature at all.
  if (!signature) {
    if (process.env.NODE_ENV === "production")
      return new NextResponse("Missing signature", { status: 401 })
    // dev-only: allow unsigned payloads for local testing
  } else if (!verifiedConfig && !globalSecretVerifies(rawBody, signature)) {
    // A signature was present but matched no configured company app secret
    // (and no legacy global META_APP_SECRET, if any).
    return new NextResponse("Invalid signature", { status: 401 })
  } else if (!verifiedConfig && !process.env.META_APP_SECRET) {
    // No per-company secrets configured anywhere and no legacy fallback.
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        "Webhook signature verification is not configured",
        { status: 503 }
      )
    }
  }

  let payload: WebhookPayload
  try {
    payload = JSON.parse(rawBody) as WebhookPayload
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 })
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      if (!value) continue
      const phoneNumberId = value.metadata?.phone_number_id

      let config = verifiedConfig
      if (phoneNumberId) {
        const byPhone = await prisma.whatsAppConfig.findUnique({
          where: { phoneNumberId },
        })
        if (byPhone) {
          config = {
            accountId: byPhone.accountId,
            phoneNumberId: byPhone.phoneNumberId,
          }
        }
      }
      if (!config) continue

      for (const msg of value.messages ?? []) {
        try {
          await handleInboundMessage(config.accountId, value.contacts?.[0], msg)
        } catch (error) {
          console.error(
            "[WhatsApp webhook] Failed to process inbound message",
            error
          )
        }
      }
      for (const status of value.statuses ?? []) {
        try {
          await handleStatusUpdate(config.accountId, status)
        } catch (error) {
          console.error(
            "[WhatsApp webhook] Failed to process status update",
            error
          )
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}

const STATUS_MAP: Record<string, "SENT" | "DELIVERED" | "READ" | "FAILED"> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
}

async function handleStatusUpdate(accountId: string, status: WebhookStatus) {
  const whatsappMessageId = status.id
  const mapped = status.status ? STATUS_MAP[status.status] : undefined
  if (!mapped) return

  const errorMessage =
    mapped === "FAILED"
      ? (status.errors?.[0]?.title ??
        status.errors?.[0]?.message ??
        "Delivery failed")
      : null

  // Broadcasts are stored on BroadcastRecipient, not inbox Message.
  // Always try to apply the webhook to a campaign recipient first.
  if (whatsappMessageId) {
    await applyBroadcastWhatsAppStatus(
      accountId,
      whatsappMessageId,
      mapped,
      errorMessage,
      status.recipient_id
    )
  } else if (status.recipient_id) {
    await applyBroadcastWhatsAppStatus(
      accountId,
      "",
      mapped,
      errorMessage,
      status.recipient_id
    )
  }

  if (!whatsappMessageId) return

  const message = await prisma.message.findFirst({
    where: {
      whatsappMessageId,
      conversation: { accountId },
    },
  })
  if (!message) return

  const RANK = { SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4 }
  if (
    RANK[mapped] < RANK[message.status as keyof typeof RANK] &&
    mapped !== "FAILED"
  )
    return

  await prisma.message.update({
    where: { id: message.id },
    data: { status: mapped, errorMessage },
  })
}

const MEDIA_TYPE_MAP: Record<string, "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT"> =
  {
    image: "IMAGE",
    video: "VIDEO",
    audio: "AUDIO",
    document: "DOCUMENT",
  }

async function handleInboundMessage(
  accountId: string,
  metaContact: { profile?: { name?: string } } | undefined,
  msg: WebhookMessage
) {
  if (!msg || typeof msg.id !== "string" || typeof msg.from !== "string") return

  const duplicate = await prisma.message.findFirst({
    where: {
      whatsappMessageId: msg.id,
      conversation: { accountId },
    },
    select: { id: true },
  })
  if (duplicate) return

  const phone = msg.from
  const phoneNormalized = phone.replace(/\D/g, "")
  if (phoneNormalized.length < 7) return

  let contact = await prisma.contact.findUnique({
    where: { accountId_phoneNormalized: { accountId, phoneNormalized } },
  })
  const isNewContact = !contact
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        accountId,
        phone,
        phoneNormalized,
        name: metaContact?.profile?.name || null,
      },
    })
  } else if (metaContact?.profile?.name) {
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: { name: metaContact.profile.name },
    })
  }

  let conversation = await prisma.conversation.findFirst({
    where: { accountId, contactId: contact.id, status: { not: "CLOSED" } },
  })
  const isNewConversation = !conversation
  if (!conversation)
    conversation = await prisma.conversation.create({
      data: { accountId, contactId: contact.id },
    })

  let contentType:
    | "TEXT"
    | "IMAGE"
    | "VIDEO"
    | "AUDIO"
    | "DOCUMENT"
    | "STICKER"
    | "CONTACT"
    | "LOCATION" = "TEXT"
  let contentText: string | null =
    msg.text?.body ??
    msg.button?.text ??
    msg.interactive?.button_reply?.title ??
    null
  let mediaUrl: string | null = null
  let metadata: Prisma.InputJsonValue | null = null

  const config = await prisma.whatsAppConfig.findUnique({
    where: { accountId },
  })

  if (msg.type === "contacts") {
    contentType = "CONTACT"
    const c = msg.contacts?.[0]
    contentText = c?.name?.formatted_name ?? "Contact"
    metadata = { name: c?.name?.formatted_name, phone: c?.phones?.[0]?.phone }
  } else if (msg.type === "location") {
    contentType = "LOCATION"
    const loc = msg.location
    contentText = loc?.name ?? loc?.address ?? null
    metadata = {
      latitude: loc?.latitude,
      longitude: loc?.longitude,
      name: loc?.name,
      address: loc?.address,
    }
  } else if (msg.type === "sticker") {
    contentType = "STICKER"
    if (config && msg.sticker?.id) {
      try {
        const accessToken = decrypt(config.accessTokenEncrypted)
        const stored = await downloadAndStoreMedia(msg.sticker.id, accessToken)
        mediaUrl = stored.url
      } catch (err) {
        console.error("[WhatsApp webhook] Failed to download sticker:", err)
        contentText = "[Sticker could not be downloaded]"
      }
    }
  } else if (msg.type && MEDIA_TYPE_MAP[msg.type]) {
    const mediaField = msg[msg.type] as WebhookMedia | undefined
    contentType = MEDIA_TYPE_MAP[msg.type]
    contentText = mediaField?.caption ?? mediaField?.filename ?? null

    if (config && mediaField?.id) {
      try {
        const accessToken = decrypt(config.accessTokenEncrypted)
        const stored = await downloadAndStoreMedia(mediaField.id, accessToken)
        mediaUrl = stored.url
      } catch (err) {
        console.error("[WhatsApp webhook] Failed to download media:", err)
        contentText = contentText ?? "[Media could not be downloaded]"
      }
    }
  }

  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: "CUSTOMER",
        contentType,
        contentText,
        mediaUrl,
        metadata: metadata ?? undefined,
        whatsappMessageId: msg.id,
      },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageText:
          contentText ??
          (mediaUrl
            ? "📎 Attachment"
            : contentType === "LOCATION"
              ? "📍 Location"
              : ""),
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
    }),
  ])

  const recipients = conversation.assignedAgentId
    ? [conversation.assignedAgentId]
    : (
        await prisma.user.findMany({
          where: { accountId, accountRole: { in: ["OWNER", "ADMIN"] } },
          select: { id: true },
        })
      ).map((user) => user.id)
  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        accountId,
        userId,
        type: "INBOUND_MESSAGE",
        title: "New WhatsApp message",
        body: `${contact.name || contact.phone}: ${contentText || "New message"}`,
        href: `/inbox/${conversation.id}`,
      })
    )
  )

  const ctx = {
    accountId,
    contactId: contact.id,
    conversationId: conversation.id,
    messageText: contentText ?? undefined,
  }
  if (isNewContact) await runAutomationsForTrigger("NEW_CONTACT_CREATED", ctx)
  if (isNewConversation)
    await runAutomationsForTrigger("FIRST_MESSAGE_FROM_CONTACT", ctx)
  await runAutomationsForTrigger("NEW_MESSAGE_RECEIVED", ctx)
  await runAutomationsForTrigger("KEYWORD_MATCH", ctx)
}
