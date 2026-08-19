"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { after } from "next/server"
import { substituteVariables } from "@/lib/whatsapp/templates"
import { InputJsonValue } from "@prisma/client/runtime/client"
import { writeAuditLog } from "@/lib/audit"
import { canWriteWorkspace } from "@/lib/permissions"
import { consumeMessages, QuotaError } from "@/lib/quota"
import { processQueuedBroadcast } from "@/lib/broadcasts/dispatch"

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
    throw new Error("Viewers can only read broadcasts")
  return session
}

export type AudienceSpec =
  | { mode: "ALL" }
  | { mode: "TAGS"; tagIds: string[] }
  | { mode: "CUSTOM_FIELD"; fieldId: string; value: string }
  | { mode: "CATEGORY"; category: string }
  | { mode: "CSV"; contacts: { phone: string; name?: string }[] }

export type VariableMapping = {
  variable: number
  source: "static" | "field" | "custom_field"
  value: string
}[]

export async function getApprovedTemplates() {
  const session = await requireSession()
  return prisma.messageTemplate.findMany({
    where: { accountId: session.user.accountId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
  })
}

export async function getTagsAndFields() {
  const session = await requireSession()
  const [tags, customFields, categories] = await Promise.all([
    prisma.tag.findMany({
      where: { accountId: session.user.accountId },
      orderBy: { name: "asc" },
    }),
    prisma.customField.findMany({
      where: { accountId: session.user.accountId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.contactCategory.findMany({
      where: { accountId: session.user.accountId },
      orderBy: { createdAt: "asc" },
    }),
  ])
  return { tags, customFields, categories }
}

export async function getBroadcasts() {
  const session = await requireSession()
  return prisma.broadcast.findMany({
    where: { accountId: session.user.accountId },
    orderBy: { createdAt: "desc" },
  })
}

// Returns a broadcast's recipients (status + error message + contact) so the
// UI can show exactly why recipients failed.
export async function getBroadcastRecipients(broadcastId: string) {
  const session = await requireSession()
  if (!broadcastId) return null

  const broadcast = await prisma.broadcast.findFirst({
    where: { id: broadcastId, accountId: session.user.accountId },
    select: { id: true },
  })
  if (!broadcast) return null

  const recipients = await prisma.broadcastRecipient.findMany({
    where: { broadcastId },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      contact: { select: { id: true, name: true, phone: true } },
    },
  })

  return recipients.map((r) => ({
    id: r.id,
    status: r.status,
    errorMessage: r.errorMessage,
    sentAt: r.sentAt,
    deliveredAt: r.deliveredAt,
    readAt: r.readAt,
    contactName: r.contact?.name ?? null,
    contactPhone: r.contact?.phone ?? null,
  }))
}

export async function deleteBroadcast(id: string) {
  const session = await requireWriteSession()
  if (!id) return { error: "id is required" }

  const broadcast = await prisma.broadcast.findFirst({
    where: { id, accountId: session.user.accountId },
  })
  if (!broadcast) return { error: "Broadcast not found" }

  await prisma.broadcast.delete({ where: { id: broadcast.id } })

  await writeAuditLog({
    accountId: session.user.accountId,
    userId: session.user.id,
    action: "BROADCAST_DELETED",
    entityType: "Broadcast",
    entityId: broadcast.id,
    metadata: { name: broadcast.name, status: broadcast.status },
  })
  return { success: true }
}

async function resolveAudience(accountId: string, spec: AudienceSpec) {
  if (spec.mode === "ALL") {
    return prisma.contact.findMany({
      where: { accountId },
      include: { customValues: true },
    })
  }
  if (spec.mode === "TAGS") {
    if (spec.tagIds.length === 0) return []
    return prisma.contact.findMany({
      where: { accountId, tags: { some: { tagId: { in: spec.tagIds } } } },
      include: { customValues: true },
    })
  }
  if (spec.mode === "CUSTOM_FIELD") {
    return prisma.contact.findMany({
      where: {
        accountId,
        customValues: {
          some: { customFieldId: spec.fieldId, value: spec.value },
        },
      },
      include: { customValues: true },
    })
  }
  if (spec.mode === "CATEGORY") {
    if (!spec.category) return []
    return prisma.contact.findMany({
      where: { accountId, category: spec.category },
      include: { customValues: true },
    })
  }
  const resolved = []
  for (const row of spec.contacts) {
    const phoneNormalized = row.phone.replace(/\D/g, "")
    if (!phoneNormalized) continue
    const contact = await prisma.contact.upsert({
      where: { accountId_phoneNormalized: { accountId, phoneNormalized } },
      create: {
        accountId,
        phone: row.phone,
        phoneNormalized,
        name: row.name || null,
      },
      update: {},
      include: { customValues: true },
    })
    resolved.push(contact)
  }
  return resolved
}

function countCsvRecipients(contacts: { phone: string }[]) {
  return new Set(
    contacts
      .map((contact) => contact.phone.replace(/\D/g, ""))
      .filter((phone) => phone.length >= 7)
  ).size
}

export async function estimateAudience(spec: AudienceSpec) {
  const session = await requireSession()
  if (spec.mode === "CSV") {
    return { count: countCsvRecipients(spec.contacts) }
  }
  const contacts = await resolveAudience(session.user.accountId, spec)
  return { count: contacts.length }
}

function resolveVariableValues(
  contact: {
    name: string | null
    phone: string
    email: string | null
    company: string | null
    customValues: { customFieldId: string; value: string | null }[]
  },
  mapping: VariableMapping
): Record<number, string> {
  const values: Record<number, string> = {}
  for (const m of mapping) {
    if (m.source === "static") {
      values[m.variable] = m.value
    } else if (m.source === "field") {
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
  return values
}

export async function previewBroadcast(
  templateId: string,
  mapping: VariableMapping,
  spec: AudienceSpec
) {
  const session = await requireSession()
  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, accountId: session.user.accountId },
  })
  if (!template) return { error: "Template not found" }

  const contacts =
    spec.mode === "CSV"
      ? []
      : await resolveAudience(session.user.accountId, spec)
  const csvSample = spec.mode === "CSV" ? spec.contacts[0] : undefined
  const sample = csvSample
    ? {
        name: csvSample.name ?? null,
        phone: csvSample.phone,
        email: null,
        company: null,
        customValues: [],
      }
    : contacts[0]
  const values = sample
    ? resolveVariableValues(sample, mapping)
    : Object.fromEntries(
        mapping.map((m) => [
          m.variable,
          m.source === "static" ? m.value : "Sample",
        ])
      )

  return {
    previewText: substituteVariables(template.bodyText, values),
    previewContactName: sample?.name || sample?.phone || null,
    recipientCount:
      spec.mode === "CSV" ? countCsvRecipients(spec.contacts) : contacts.length,
  }
}

export async function sendBroadcast(
  name: string,
  templateId: string,
  spec: AudienceSpec,
  mapping: VariableMapping
) {
  const session = await requireWriteSession()
  if (!name.trim()) return { error: "Name is required" }

  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, accountId: session.user.accountId },
  })
  if (!template) return { error: "Template not found" }
  if (template.status !== "APPROVED")
    return { error: "Only approved templates can be sent" }

  const config = await prisma.whatsAppConfig.findUnique({
    where: { accountId: session.user.accountId },
  })
  if (!config || config.status !== "CONNECTED")
    return { error: "Connect WhatsApp in Settings before sending a broadcast" }

  const contacts = await resolveAudience(session.user.accountId, spec)
  if (contacts.length === 0) return { error: "No contacts match this audience" }

  // Reserve one message per recipient against the account's quota.
  // Return the message as data — throwing from a Server Action becomes
  // React #441 in production and hides "Your message quota is exhausted".
  try {
    await consumeMessages(session.user.accountId, contacts.length, {
      feature: "BROADCAST",
      userId: session.user.id,
    })
  } catch (err) {
    if (err instanceof QuotaError) return { error: err.message }
    return {
      error:
        err instanceof Error && err.message
          ? err.message
          : "Your message quota is exhausted. Contact your provider to add more messages.",
    }
  }

  const broadcast = await prisma.broadcast.create({
    data: {
      accountId: session.user.accountId,
      createdByUserId: session.user.id,
      name,
      messageTemplateId: template.id,
      templateName: template.name,
      templateLanguage: template.language,
      variableMapping: mapping,
      audienceFilter: spec as unknown as InputJsonValue,
      totalRecipients: contacts.length,
      status: "SENDING",
      recipients: {
        createMany: { data: contacts.map((c) => ({ contactId: c.id })) },
      },
    },
    select: { id: true },
  })

  after(() => {
    void processQueuedBroadcast(broadcast.id).catch((error) => {
      console.error("[wacrm] Background broadcast failed", error)
    })
  })

  return {
    success: true,
    queued: true,
    broadcastId: broadcast.id,
  }
}

export async function saveBroadcastDraft(
  name: string,
  templateId: string,
  spec: AudienceSpec,
  mapping: VariableMapping
) {
  const session = await requireWriteSession()
  if (!name.trim()) return { error: "Name is required" }
  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, accountId: session.user.accountId },
  })
  if (!template) return { error: "Template not found" }
  const contacts = await resolveAudience(session.user.accountId, spec)

  const broadcast = await prisma.broadcast.create({
    data: {
      accountId: session.user.accountId,
      createdByUserId: session.user.id,
      name,
      messageTemplateId: template.id,
      templateName: template.name,
      templateLanguage: template.language,
      variableMapping: mapping,
      audienceFilter: spec as unknown as InputJsonValue,
      totalRecipients: contacts.length,
      status: "DRAFT",
    },
  })

  await writeAuditLog({
    accountId: session.user.accountId,
    userId: session.user.id,
    action: "BROADCAST_DRAFT_CREATED",
    entityType: "Broadcast",
    entityId: broadcast.id,
    metadata: { name, templateName: template.name, recipients: contacts.length },
  })
  return { success: true }
}
