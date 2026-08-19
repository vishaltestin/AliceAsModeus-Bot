"use server"

import { randomUUID } from "crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminRole } from "@/lib/permissions"
import { decrypt } from "@/lib/encryption"
import {
  createMessageTemplate,
  updateMessageTemplateOnMeta,
  listMessageTemplates,
  WhatsAppApiError,
} from "@/lib/whatsapp/client"
import { buildMetaComponents, extractVariables } from "@/lib/whatsapp/templates"

async function requireSession() {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  return session
}

async function requireAdmin() {
  const session = await requireSession()
  if (!isAdminRole(session.user.accountRole)) {
    throw new Error("Forbidden")
  }
  return session
}

export async function getTemplates() {
  const session = await requireAdmin()
  return prisma.messageTemplate.findMany({
    where: { accountId: session.user.accountId },
    orderBy: { createdAt: "desc" },
  })
}

interface TemplateInput {
  name: string
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION"
  language: string
  headerType: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null
  headerContent: string | null
  bodyText: string
  footerText: string | null
}

type RemoteComponent = {
  type?: string
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT"
  text?: string
  buttons?: Record<string, string>[]
}

type RemoteTemplate = {
  id: string
  name: string
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION"
  language: string
  status:
    | "DRAFT"
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "PAUSED"
    | "DISABLED"
    | "IN_APPEAL"
    | "PENDING_DELETION"
  components?: RemoteComponent[]
  quality_score?: { score?: string | null }
}

function validateTemplateInput(input: TemplateInput) {
  const name = input.name.trim()
  if (!/^[a-z0-9_]+$/.test(name)) {
    return "Template name must be lowercase letters, digits, and underscores only."
  }
  if (!input.language.trim()) return "Template language is required."
  if (!input.bodyText.trim()) return "Body text is required."
  if ((input.footerText ?? "").length > 60)
    return "Footer text cannot exceed 60 characters."
  const variables = extractVariables(input.bodyText)
  if (variables.some((variable, index) => variable !== index + 1)) {
    return "Template variables must be contiguous, starting at {{1}}."
  }
  return null
}

export async function createTemplate(input: TemplateInput) {
  const session = await requireAdmin()
  const validationError = validateTemplateInput(input)
  if (validationError) return { error: validationError }
  input = {
    ...input,
    name: input.name.trim(),
    language: input.language.trim(),
    bodyText: input.bodyText.trim(),
    footerText: input.footerText?.trim() || null,
  }

  const existing = await prisma.messageTemplate.findUnique({
    where: {
      accountId_name_language: {
        accountId: session.user.accountId,
        name: input.name,
        language: input.language,
      },
    },
  })
  if (existing)
    return { error: "A template with this name and language already exists" }

  const variables = extractVariables(input.bodyText)
  const isDryRun = process.env.WHATSAPP_TEMPLATES_DRY_RUN === "true"

  if (isDryRun) {
    const template = await prisma.messageTemplate.create({
      data: {
        accountId: session.user.accountId,
        ...input,
        status: "APPROVED",
        metaTemplateId: `dry-run-${randomUUID()}`,
        sampleValues: variables.length
          ? { body: variables.map((v) => `Sample ${v}`) }
          : undefined,
        lastSubmittedAt: new Date(),
      },
    })
    return { success: true, template }
  }

  const config = await prisma.whatsAppConfig.findUnique({
    where: { accountId: session.user.accountId },
  })
  if (!config || config.status !== "CONNECTED" || !config.wabaId) {
    return {
      error:
        "Connect WhatsApp with a WABA ID in Settings before creating templates",
    }
  }

  try {
    const accessToken = decrypt(config.accessTokenEncrypted)
    const components = buildMetaComponents(input)
    const result = await createMessageTemplate(config.wabaId, accessToken, {
      name: input.name,
      category: input.category,
      language: input.language,
      components,
    })

    const template = await prisma.messageTemplate.create({
      data: {
        accountId: session.user.accountId,
        ...input,
        status: "PENDING",
        metaTemplateId: result.id,
        sampleValues: variables.length
          ? { body: variables.map((v) => `Sample ${v}`) }
          : undefined,
        lastSubmittedAt: new Date(),
      },
    })
    return { success: true, template }
  } catch (err) {
    return {
      error:
        err instanceof WhatsAppApiError
          ? err.message
          : "Failed to submit template to Meta",
    }
  }
}

export async function updateTemplate(id: string, input: TemplateInput) {
  const session = await requireAdmin()
  if (!id) return { error: "Template id is required." }
  const validationError = validateTemplateInput(input)
  if (validationError) return { error: validationError }
  input = {
    ...input,
    name: input.name.trim(),
    language: input.language.trim(),
    bodyText: input.bodyText.trim(),
    footerText: input.footerText?.trim() || null,
  }
  const existing = await prisma.messageTemplate.findFirst({
    where: { id, accountId: session.user.accountId },
  })
  if (!existing) return { error: "Template not found" }

  const isDryRun = process.env.WHATSAPP_TEMPLATES_DRY_RUN === "true"

  if (!isDryRun && existing.metaTemplateId) {
    const config = await prisma.whatsAppConfig.findUnique({
      where: { accountId: session.user.accountId },
    })
    if (!config || config.status !== "CONNECTED")
      return { error: "WhatsApp is not connected" }
    try {
      const accessToken = decrypt(config.accessTokenEncrypted)
      await updateMessageTemplateOnMeta(existing.metaTemplateId, accessToken, {
        category: input.category,
        components: buildMetaComponents(input),
      })
    } catch (err) {
      return {
        error:
          err instanceof WhatsAppApiError
            ? err.message
            : "Failed to update template on Meta",
      }
    }
  }

  await prisma.messageTemplate.update({
    where: { id },
    data: {
      ...input,
      status: isDryRun ? "APPROVED" : "PENDING",
      lastSubmittedAt: new Date(),
    },
  })
  return { success: true }
}

export async function syncTemplatesFromMeta() {
  const session = await requireAdmin()
  const config = await prisma.whatsAppConfig.findUnique({
    where: { accountId: session.user.accountId },
  })
  if (!config || config.status !== "CONNECTED" || !config.wabaId) {
    return { error: "Connect WhatsApp with a WABA ID in Settings first" }
  }

  try {
    const accessToken = decrypt(config.accessTokenEncrypted)
    const result = await listMessageTemplates(config.wabaId, accessToken)
    let synced = 0

    const remoteTemplates =
      (result as { data?: RemoteTemplate[] | null }).data ?? []

    for (const remote of remoteTemplates) {
      const body = remote.components?.find(
        (component) => component.type === "BODY"
      )
      const header = remote.components?.find(
        (component) => component.type === "HEADER"
      )
      const footer = remote.components?.find(
        (component) => component.type === "FOOTER"
      )
      const buttons = remote.components?.find(
        (component) => component.type === "BUTTONS"
      )

      await prisma.messageTemplate.upsert({
        where: {
          accountId_name_language: {
            accountId: session.user.accountId,
            name: remote.name,
            language: remote.language,
          },
        },
        create: {
          accountId: session.user.accountId,
          name: remote.name,
          category: remote.category,
          language: remote.language,
          headerType: header?.format ?? null,
          headerContent: header?.text ?? null,
          bodyText: body?.text ?? "",
          footerText: footer?.text ?? null,
          buttons: buttons?.buttons ?? undefined,
          status: remote.status,
          metaTemplateId: remote.id,
          qualityScore: remote.quality_score?.score ?? null,
        },
        update: {
          category: remote.category,
          status: remote.status,
          bodyText: body?.text ?? "",
          headerType: header?.format ?? null,
          headerContent: header?.text ?? null,
          footerText: footer?.text ?? null,
          buttons: buttons?.buttons ?? undefined,
          metaTemplateId: remote.id,
          qualityScore: remote.quality_score?.score ?? null,
        },
      })
      synced++
    }
    return { success: true, synced }
  } catch (err) {
    return {
      error:
        err instanceof WhatsAppApiError
          ? err.message
          : "Failed to sync templates from Meta",
    }
  }
}

export async function deleteTemplate(id: string) {
  const session = await requireAdmin()
  await prisma.messageTemplate.deleteMany({
    where: { id, accountId: session.user.accountId },
  })
}
