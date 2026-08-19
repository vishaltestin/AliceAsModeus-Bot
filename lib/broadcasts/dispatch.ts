import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/encryption"
import { sendTemplateMessage, WhatsAppApiError } from "@/lib/whatsapp/client"
import { extractVariables } from "@/lib/whatsapp/templates"
import { RecipientStatus } from "@/generated/prisma/enums"
import { writeAuditLog } from "@/lib/audit"

const LADDER: Record<RecipientStatus, string[]> = {
  PENDING: [],
  SENT: ["sentCount"],
  DELIVERED: ["sentCount", "deliveredCount"],
  READ: ["sentCount", "deliveredCount", "readCount"],
  REPLIED: ["sentCount", "deliveredCount", "readCount", "repliedCount"],
  FAILED: ["failedCount"],
}

export async function bumpRecipientStatus(
  recipientId: string,
  newStatus: RecipientStatus,
  extra: Record<string, unknown> = {}
) {
  await prisma.$transaction(async (tx) => {
    const recipient = await tx.broadcastRecipient.findUniqueOrThrow({
      where: { id: recipientId },
    })
    const oldCols = LADDER[recipient.status]
    const newCols = LADDER[newStatus]
    await tx.broadcastRecipient.update({
      where: { id: recipientId },
      data: { status: newStatus, ...extra },
    })
    const delta: Record<string, { increment: number }> = {}
    for (const col of oldCols)
      delta[col] = { increment: (delta[col]?.increment ?? 0) - 1 }
    for (const col of newCols)
      delta[col] = { increment: (delta[col]?.increment ?? 0) + 1 }
    if (Object.keys(delta).length > 0)
      await tx.broadcast.update({
        where: { id: recipient.broadcastId },
        data: delta,
      })
  })
}

export async function applyBroadcastWhatsAppStatus(
  accountId: string,
  whatsappMessageId: string,
  mapped: "SENT" | "DELIVERED" | "READ" | "FAILED",
  errorMessage?: string | null,
  recipientPhone?: string | null
) {
  let recipient = null

  if (whatsappMessageId) {
    recipient = await prisma.broadcastRecipient.findUnique({
      where: { whatsappMessageId },
      select: {
        id: true,
        status: true,
        whatsappMessageId: true,
        broadcast: { select: { accountId: true } },
      },
    })
    if (recipient && recipient.broadcast.accountId !== accountId) {
      recipient = null
    }
  }

  if (!recipient && recipientPhone) {
    const digits = recipientPhone.replace(/\D/g, "")
    const tail = digits.slice(-10)
    if (digits.length >= 7) {
      const contacts = await prisma.contact.findMany({
        where: {
          accountId,
          OR: [
            { phoneNormalized: digits },
            ...(tail.length >= 10
              ? [{ phoneNormalized: { endsWith: tail } }]
              : []),
          ],
        },
        select: { id: true },
      })
      if (contacts.length) {
        recipient = await prisma.broadcastRecipient.findFirst({
          where: {
            broadcast: { accountId },
            contactId: { in: contacts.map((c) => c.id) },
            status: { in: ["PENDING", "SENT", "DELIVERED"] },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            whatsappMessageId: true,
            broadcast: { select: { accountId: true } },
          },
        })
      }
    }
  }

  if (!recipient) {
    console.warn("[wacrm] No broadcast recipient for status", {
      accountId,
      whatsappMessageId,
      mapped,
      recipientPhone,
    })
    return false
  }

  const RANK: Record<string, number> = {
    PENDING: 0,
    SENT: 1,
    DELIVERED: 2,
    READ: 3,
    REPLIED: 4,
    FAILED: 5,
  }
  if (mapped !== "FAILED" && RANK[mapped] <= (RANK[recipient.status] ?? 0)) {
    if (whatsappMessageId && !recipient.whatsappMessageId) {
      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: { whatsappMessageId },
      })
    }
    return true
  }

  const extra: Record<string, unknown> = {}
  if (whatsappMessageId && !recipient.whatsappMessageId) {
    extra.whatsappMessageId = whatsappMessageId
  }
  if (mapped === "DELIVERED" || mapped === "READ") {
    extra.deliveredAt = extra.deliveredAt ?? new Date()
  }
  if (mapped === "READ") extra.readAt = new Date()
  if (mapped === "FAILED") extra.errorMessage = errorMessage ?? "Delivery failed"
  await bumpRecipientStatus(recipient.id, mapped, extra)
  return true
}

export async function processQueuedBroadcast(broadcastId: string) {
  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    include: {
      recipients: true,
      account: { select: { id: true } },
    },
  })
  if (!broadcast || broadcast.status !== "SENDING") return

  const config = await prisma.whatsAppConfig.findUnique({
    where: { accountId: broadcast.accountId },
  })
  if (!config || config.status !== "CONNECTED") {
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: "FAILED" },
    })
    return
  }

  const mapping = (broadcast.variableMapping ?? []) as {
    variable: number
    source: "static" | "field" | "custom_field"
    value: string
  }[]

  const contactIds = broadcast.recipients
    .map((r) => r.contactId)
    .filter((id): id is string => Boolean(id))
  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds }, accountId: broadcast.accountId },
    include: { customValues: true },
  })
  const contactById = new Map(contacts.map((c) => [c.id, c]))

  const accessToken = decrypt(config.accessTokenEncrypted)
  const variableNumbers = extractVariables(
    (
      await prisma.messageTemplate.findFirst({
        where: { id: broadcast.messageTemplateId ?? undefined },
        select: { bodyText: true },
      })
    )?.bodyText ?? ""
  )

  let sentRecipients = 0
  let failedRecipients = 0

  for (const recipient of broadcast.recipients) {
    if (recipient.status !== "PENDING") continue
    const contact = recipient.contactId
      ? contactById.get(recipient.contactId)
      : undefined
    if (!contact) {
      await bumpRecipientStatus(recipient.id, "FAILED", {
        errorMessage: "Contact not found",
      })
      failedRecipients += 1
      continue
    }

    try {
      const values: Record<number, string> = {}
      for (const m of mapping) {
        if (m.source === "static") values[m.variable] = m.value
        else if (m.source === "field") {
          values[m.variable] =
            m.value === "name"
              ? (contact.name ?? "")
              : m.value === "phone"
                ? contact.phone
                : m.value === "email"
                  ? (contact.email ?? "")
                  : m.value === "company"
                    ? (contact.company ?? "")
                    : ""
        } else {
          values[m.variable] =
            contact.customValues.find((cv) => cv.customFieldId === m.value)
              ?.value ?? ""
        }
      }
      const orderedParams = variableNumbers.map((n) => values[n] ?? "")
      const result = await sendTemplateMessage(
        config.phoneNumberId,
        accessToken,
        contact.phoneNormalized,
        broadcast.templateName,
        broadcast.templateLanguage,
        orderedParams
      )
      const wamid =
        result?.messages?.[0]?.id ??
        result?.messages?.[0]?.message_id ??
        result?.id ??
        null
      await bumpRecipientStatus(recipient.id, "SENT", {
        sentAt: new Date(),
        whatsappMessageId: wamid,
      })
      sentRecipients += 1
    } catch (err) {
      await bumpRecipientStatus(recipient.id, "FAILED", {
        errorMessage:
          err instanceof WhatsAppApiError ? err.message : "Failed to send",
      })
      failedRecipients += 1
    }
    await new Promise((r) => setTimeout(r, 250))
  }

  await prisma.broadcast.update({
    where: { id: broadcast.id },
    data: {
      status:
        failedRecipients === broadcast.recipients.length &&
        sentRecipients === 0
          ? "FAILED"
          : "SENT",
    },
  })

  await writeAuditLog({
    accountId: broadcast.accountId,
    userId: broadcast.createdByUserId,
    action: "BROADCAST_SENT",
    entityType: "Broadcast",
    entityId: broadcast.id,
    metadata: {
      name: broadcast.name,
      templateName: broadcast.templateName,
      recipients: broadcast.recipients.length,
      sent: sentRecipients,
      failed: failedRecipients,
    },
  })
}
