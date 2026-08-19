"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canWriteWorkspace, isAdminRole } from "@/lib/permissions"
import { decrypt } from "@/lib/encryption"
import { consumeMessages, QuotaError } from "@/lib/quota"
import {
  actionFailure,
  isDynamicServerUsage,
  logServerError,
  type ActionFailure,
} from "@/lib/error-handling"
import {
  sendTextMessage,
  sendMediaMessage,
  sendContactMessage,
  sendLocationMessage,
} from "@/lib/whatsapp/client"
import { uploadMedia } from "@/lib/local-storage"
import {
  contentTypeFromMime,
  MAX_BYTES_BY_TYPE,
  type MediaContentType,
} from "@/lib/media-utils"
import { runAutomationsForTrigger } from "@/lib/automations/engine"
import {
  CUSTOMER_WINDOW_CLOSED_MESSAGE,
  isWithinCustomerServiceWindow,
} from "@/lib/whatsapp/policy"

async function requireSession() {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  return session
}

// Write actions require at least AGENT; VIEWER is read-only.
async function requireWriteSession() {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  if (!canWriteWorkspace(session.user.accountRole))
    throw new Error("Viewers can only read conversations")
  return session
}

// Non-admin members (AGENT/VIEWER) can only see conversations assigned to them
// plus unassigned conversations. Owners/Admins see every conversation in the
// account. This keeps an assigned conversation private to its agent while
// letting the whole team still pick up unassigned work.
function conversationScope(
  session: { user: { accountId: string; id: string; accountRole: string } }
): { accountId: string; OR?: { assignedAgentId: string | null }[] } {
  if (isAdminRole(session.user.accountRole)) {
    return { accountId: session.user.accountId }
  }
  return {
    accountId: session.user.accountId,
    OR: [
      { assignedAgentId: null },
      { assignedAgentId: session.user.id },
    ],
  }
}

export async function getConversations() {
  const session = await requireSession()
  return prisma.conversation.findMany({
    where: conversationScope(session),
    include: {
      contact: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  })
}

export async function getConversation(conversationId: string) {
  const session = await requireSession()
  if (!conversationId) throw new Error("conversationId is required")

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, ...conversationScope(session) },
    include: {
      contact: {
        include: {
          tags: { include: { tag: true } },
          customValues: { include: { customField: true } },
        },
      },
    },
  })
  if (!conversation) return null

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  })
  return { conversation, messages }
}

export async function getMessagesSince(conversationId: string, since: string) {
  const session = await requireSession()
  if (!conversationId) throw new Error("conversationId is required")

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, ...conversationScope(session) },
    select: { id: true },
  })
  if (!conversation) throw new Error("Not found")

  return prisma.message.findMany({
    where: { conversationId, createdAt: { gt: new Date(since) } },
    orderBy: { createdAt: "asc" },
  })
}

export async function uploadInboxMedia(formData: FormData) {
  try {
    await requireWriteSession()
    const file = formData.get("file") as File | null
    if (!file) return actionFailure("No file provided")
    const asSticker = formData.get("asSticker") === "true"

    let buffer: Buffer = Buffer.from(await file.arrayBuffer())
    let mimeType = file.type || "application/octet-stream"
    let filename = file.name

    // .startsWith rather than exact equality — a recorded blob's mimeType can
    // arrive with a codec suffix (e.g. "audio/webm;codecs=opus") depending on
    // the browser, and this still needs to match either way.
    if (mimeType.startsWith("video/webm")) {
      const { transcodeVideoToMp4 } = await import("@/lib/ffmpeg")
      buffer = await transcodeVideoToMp4(buffer)
      mimeType = "video/mp4"
      filename = filename.replace(/\.webm$/i, ".mp4")
    } else if (mimeType.startsWith("audio/webm")) {
      const { remuxAudioToOgg } = await import("@/lib/ffmpeg")
      buffer = await remuxAudioToOgg(buffer)
      mimeType = "audio/ogg"
      filename = filename.replace(/\.webm$/i, ".ogg")
    }

    const contentType: MediaContentType = asSticker
      ? "STICKER"
      : contentTypeFromMime(mimeType)
    const maxBytes = MAX_BYTES_BY_TYPE[contentType]
    if (buffer.length > maxBytes) {
      return actionFailure(
        `File is too large — max ${(maxBytes / (1024 * 1024)).toFixed(1)}MB for ${contentType.toLowerCase()}`
      )
    }

    const url = await uploadMedia(buffer, filename)
    return { url, contentType, filename }
  } catch (err) {
    if (isDynamicServerUsage(err)) throw err
    if (err instanceof Error && /Unauthorized|Viewers can only/i.test(err.message)) {
      return actionFailure(err.message)
    }
    logServerError("inbox:uploadInboxMedia", err)
    return actionFailure("This file could not be uploaded. Please try again.")
  }
}

function lastMessageLabel(
  text: string,
  media?: { contentType: MediaContentType; filename?: string },
  contact?: { name: string }
) {
  if (text) return text
  if (contact) return `👤 ${contact.name}`
  if (media) {
    const LABELS: Record<MediaContentType, string> = {
      IMAGE: "📷 Photo",
      VIDEO: "🎥 Video",
      AUDIO: "🎤 Audio",
      DOCUMENT: `📎 ${media.filename ?? "Document"}`,
      STICKER: "Sticker",
    }
    return LABELS[media.contentType]
  }
  return ""
}

export async function sendMessage(
  conversationId: string,
  body: string,
  media?: { url: string; contentType: MediaContentType; filename?: string },
  contact?: { name: string; phone: string },
  location?: {
    latitude: number
    longitude: number
    name?: string
    address?: string
  }
): Promise<
  | {
      id: string
      conversationId: string
      senderType: "CUSTOMER" | "AGENT" | "BOT"
      contentType: string
      contentText: string | null
      mediaUrl: string | null
      metadata?: unknown
      createdAt: Date
      status: string
      errorMessage?: string | null
      delivered?: boolean
      deliveryNote?: string
    }
  | ActionFailure
> {
  try {
    return await sendMessageInner(
      conversationId,
      body,
      media,
      contact,
      location
    )
  } catch (err) {
    // Never throw user-facing business errors from this Server Action.
    // In production React strips thrown messages into minified error #441.
    if (isDynamicServerUsage(err)) throw err
    if (err instanceof QuotaError) return actionFailure(err.message)
    if (
      err instanceof Error &&
      /Unauthorized|Viewers can only|conversationId is required|can't be empty|Not found|24-hour WhatsApp window/i.test(
        err.message
      )
    ) {
      return actionFailure(err.message)
    }
    logServerError("inbox:sendMessage", err)
    return actionFailure("This message could not be sent. Please try again.")
  }
}

async function sendMessageInner(
  conversationId: string,
  body: string,
  media?: { url: string; contentType: MediaContentType; filename?: string },
  contact?: { name: string; phone: string },
  location?: {
    latitude: number
    longitude: number
    name?: string
    address?: string
  }
) {
  const session = await requireWriteSession()
  if (!conversationId) return actionFailure("conversationId is required")
  const text = body.trim()
  if (!text && !media && !contact && !location)
    return actionFailure("Message can't be empty")

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, accountId: session.user.accountId },
    include: { contact: true },
  })
  if (!conversation) return actionFailure("Conversation not found")

  const config = await prisma.whatsAppConfig.findUnique({
    where: { accountId: session.user.accountId },
  })
  if (config?.status === "CONNECTED") {
    const lastInbound = await prisma.message.findFirst({
      where: { conversationId, senderType: "CUSTOMER" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    })
    if (!isWithinCustomerServiceWindow(lastInbound?.createdAt)) {
      return actionFailure(CUSTOMER_WINDOW_CLOSED_MESSAGE)
    }
  }

  // Reserve one message against this account's quota before creating/sending.
  // Return the QuotaError text as data — throwing would become React #441
  // in production and hide "Your message quota is exhausted".
  try {
    await consumeMessages(session.user.accountId, 1, {
      feature: "INBOX",
      userId: session.user.id,
      recipientPhone: conversation.contact.phoneNormalized,
    })
  } catch (err) {
    if (err instanceof QuotaError) return actionFailure(err.message)
    throw err
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderType: "AGENT",
      senderId: session.user.id,
      contentType: location
        ? "LOCATION"
        : contact
          ? "CONTACT"
          : media
            ? media.contentType
            : "TEXT",
      contentText: location
        ? (location.name ?? location.address ?? null)
        : contact
          ? contact.name
          : text || (media?.filename ?? null),
      mediaUrl: media?.url ?? null,
      metadata: location ?? contact ?? undefined,
    },
  })
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageText: location
        ? "📍 Location"
        : lastMessageLabel(text, media, contact),
      lastMessageAt: new Date(),
      unreadCount: 0,
    },
  })

  if (!config || config.status !== "CONNECTED") {
    const deliveryNote = "Not sent — connect WhatsApp in Settings"
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "FAILED", errorMessage: deliveryNote },
    })
    return {
      ...message,
      status: "FAILED" as const,
      errorMessage: deliveryNote,
      delivered: false,
      deliveryNote,
    }
  }

  try {
    const accessToken = decrypt(config.accessTokenEncrypted)
    let result
    if (location) {
      result = await sendLocationMessage(
        config.phoneNumberId,
        accessToken,
        conversation.contact.phoneNormalized,
        location.latitude,
        location.longitude,
        location.name,
        location.address
      )
    } else if (contact) {
      result = await sendContactMessage(
        config.phoneNumberId,
        accessToken,
        conversation.contact.phoneNormalized,
        contact.name,
        contact.phone
      )
    } else if (media) {
      result = await sendMediaMessage(
        config.phoneNumberId,
        accessToken,
        conversation.contact.phoneNormalized,
        media.contentType.toLowerCase() as
          "image" | "video" | "audio" | "document" | "sticker",
        media.url,
        text || undefined,
        media.filename
      )
    } else {
      result = await sendTextMessage(
        config.phoneNumberId,
        accessToken,
        conversation.contact.phoneNormalized,
        text
      )
    }
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: {
        status: "SENT",
        whatsappMessageId: result?.messages?.[0]?.id ?? null,
      },
    })
    return { ...updated, delivered: true }
  } catch (err) {
    const deliveryNote = err instanceof Error ? err.message : "Failed to send"
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "FAILED", errorMessage: deliveryNote },
    })
    return {
      ...message,
      status: "FAILED" as const,
      errorMessage: deliveryNote,
      delivered: false,
      deliveryNote,
    }
  }
}

export async function markConversationRead(conversationId: string) {
  const session = await requireSession()
  await prisma.conversation.updateMany({
    where: { id: conversationId, accountId: session.user.accountId },
    data: { unreadCount: 0 },
  })
}

export async function startConversation(phone: string, name?: string) {
  const session = await requireWriteSession()
  if (!phone.trim()) throw new Error("Phone number is required")
  const phoneNormalized = phone.replace(/\D/g, "")
  if (!phoneNormalized) throw new Error("Enter a valid phone number")

  let contact = await prisma.contact.findUnique({
    where: {
      accountId_phoneNormalized: {
        accountId: session.user.accountId,
        phoneNormalized,
      },
    },
  })
  const isNewContact = !contact
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        accountId: session.user.accountId,
        createdByUserId: session.user.id,
        name: name || null,
        phone,
        phoneNormalized,
      },
    })
  } else if (name && name !== contact.name) {
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: { name },
    })
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      accountId: session.user.accountId,
      contactId: contact.id,
      status: { not: "CLOSED" },
    },
  })
  const isNewConversation = !conversation
  if (!conversation)
    conversation = await prisma.conversation.create({
      data: { accountId: session.user.accountId, contactId: contact.id },
    })

  if (isNewContact)
    await runAutomationsForTrigger("NEW_CONTACT_CREATED", {
      accountId: session.user.accountId,
      contactId: contact.id,
    })
  if (isNewConversation)
    await runAutomationsForTrigger("FIRST_MESSAGE_FROM_CONTACT", {
      accountId: session.user.accountId,
      contactId: contact.id,
      conversationId: conversation.id,
    })

  return conversation
}

export async function assignConversation(
  conversationId: string,
  userId: string
) {
  const session = await requireWriteSession()
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, ...conversationScope(session) },
  })
  if (!conversation) throw new Error("Not found")

  // Non-admins may only claim a conversation for themselves (or unassign the
  // one they already own). They cannot reassign another agent's conversation.
  if (!isAdminRole(session.user.accountRole) && userId !== session.user.id) {
    throw new Error("You can only assign a conversation to yourself")
  }

  if (userId) {
    const member = await prisma.user.findFirst({
      where: { id: userId, accountId: session.user.accountId },
      select: { id: true },
    })
    if (!member) throw new Error("Team member not found")
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { assignedAgentId: userId || null },
  })
  if (userId)
    await runAutomationsForTrigger("CONVERSATION_ASSIGNED", {
      accountId: session.user.accountId,
      contactId: conversation.contactId,
      conversationId,
    })
}

export async function getAccountMembers() {
  const session = await requireSession()
  return prisma.user.findMany({
    where: { accountId: session.user.accountId },
    select: { id: true, name: true, email: true },
  })
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<{ address: string | null }> {
  await requireSession()
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          // Nominatim's usage policy requires a descriptive User-Agent
          // identifying the app — swap in your own contact info if this
          // sees meaningful traffic, to avoid getting rate-limited/blocked.
          "User-Agent": "wacrm/1.0 (contact: you@example.com)",
        },
      }
    )
    if (!res.ok) return { address: null }
    const data = await res.json()
    return { address: data.display_name ?? null }
  } catch {
    return { address: null }
  }
}
