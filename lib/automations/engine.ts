import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/encryption"
import { sendTextMessage } from "@/lib/whatsapp/client"
import { consumeMessages } from "@/lib/quota"
import type {
  AutomationTrigger,
  AutomationStep as PrismaAutomationStep,
} from "@/generated/prisma/client"

interface TriggerContext {
  accountId: string
  contactId: string
  conversationId?: string
  messageText?: string
}

type JsonRecord = Record<string, unknown>

function configRecord(value: unknown): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return {}
  return value as JsonRecord
}

function configString(value: unknown, key: string): string {
  const result = configRecord(value)[key]
  return typeof result === "string" ? result : ""
}

function configNumber(value: unknown, key: string): number {
  const result = configRecord(value)[key]
  return typeof result === "number" ? result : Number(result) || 0
}

export async function runAutomationsForTrigger(
  trigger: AutomationTrigger,
  ctx: TriggerContext
) {
  const automations = await prisma.automation.findMany({
    where: { accountId: ctx.accountId, triggerType: trigger, isActive: true },
  })

  for (const automation of automations) {
    if (trigger === "KEYWORD_MATCH") {
      const configuredKeywords = configRecord(automation.triggerConfig).keywords
      const keywords = Array.isArray(configuredKeywords)
        ? configuredKeywords.filter(
            (keyword): keyword is string => typeof keyword === "string"
          )
        : []
      const text = (ctx.messageText ?? "").toLowerCase()
      if (!keywords.some((k) => text.includes(k.toLowerCase()))) continue
    }
    await startAutomationRun(automation.id, ctx)
  }
}

// Public entry point for manual "Test run" — returns a human-readable trace
// of exactly what the engine did, so a silent branch mismatch is visible
// instead of mysterious.
export async function runAutomationById(
  automationId: string,
  ctx: TriggerContext
): Promise<string[]> {
  const trace: string[] = []
  await startAutomationRun(automationId, ctx, trace)
  return trace
}

async function startAutomationRun(
  automationId: string,
  ctx: TriggerContext,
  trace?: string[]
) {
  const rootSteps = await prisma.automationStep.findMany({
    where: { automationId, parentStepId: null },
    orderBy: { position: "asc" },
  })
  try {
    const { paused } = await executeStepsAtLevel(
      automationId,
      rootSteps,
      0,
      null,
      null,
      ctx,
      trace
    )
    if (!paused) await completeRun(automationId, ctx)
    else
      trace?.push(
        "Paused on a Wait step — will resume when the automation cron runs."
      )
  } catch (err) {
    trace?.push(
      `Error: ${err instanceof Error ? err.message : "Unknown error"}`
    )
    await failRun(automationId, ctx, err)
  }
}

async function executeStepsAtLevel(
  automationId: string,
  steps: PrismaAutomationStep[],
  startIndex: number,
  parentStepId: string | null,
  branch: "YES" | "NO" | null,
  ctx: TriggerContext,
  trace?: string[]
): Promise<{ paused: boolean }> {
  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i]

    if (step.stepType === "WAIT") {
      const minutes = configNumber(step.config, "durationMinutes") || 5
      await prisma.automationPendingExecution.create({
        data: {
          automationId,
          accountId: ctx.accountId,
          contactId: ctx.contactId,
          conversationId: ctx.conversationId,
          parentStepId,
          branch,
          nextStepPosition: i + 1,
          context: { messageText: ctx.messageText ?? null },
          runAt: new Date(Date.now() + minutes * 60_000),
        },
      })
      trace?.push(`Wait: scheduled to resume in ${minutes} minute(s)`)
      return { paused: true }
    }

    if (step.stepType === "CONDITION") {
      const conditionField = configString(step.config, "field")
      const conditionConfig = {
        field:
          conditionField === "message_contains"
            ? "message_contains"
            : "has_tag",
        operator: configString(step.config, "operator"),
        value: configString(step.config, "value"),
      } as const
      const { matched, detail } = await evaluateCondition(conditionConfig, ctx)
      trace?.push(
        `Condition: ${detail} → took the "${matched ? "yes" : "no"}" branch`
      )

      const children = await prisma.automationStep.findMany({
        where: {
          automationId,
          parentStepId: step.id,
          branch: matched ? "YES" : "NO",
        },
        orderBy: { position: "asc" },
      })
      const result = await executeStepsAtLevel(
        automationId,
        children,
        0,
        step.id,
        matched ? "YES" : "NO",
        ctx,
        trace
      )
      if (result.paused) return { paused: true }
      continue
    }

    await executeStep(step, ctx, trace)
  }
  return { paused: false }
}

async function completeRun(automationId: string, ctx: TriggerContext) {
  await prisma.$transaction([
    prisma.automation.updateMany({
      where: { id: automationId, accountId: ctx.accountId },
      data: { executionCount: { increment: 1 }, lastExecutedAt: new Date() },
    }),
    prisma.automationLog.create({
      data: {
        automationId,
        accountId: ctx.accountId,
        contactId: ctx.contactId,
        status: "SUCCESS",
      },
    }),
  ])
}

async function failRun(
  automationId: string,
  ctx: TriggerContext,
  err: unknown
) {
  console.error(`[automation ${automationId}] failed:`, err)
  await prisma.automationLog.create({
    data: {
      automationId,
      accountId: ctx.accountId,
      contactId: ctx.contactId,
      status: "FAILED",
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    },
  })
}

// Now returns *why*, not just true/false — this is what makes a silent
// mismatch (e.g. tag name typo) show up in the trace instead of just
// quietly always taking the "no" branch.
async function evaluateCondition(
  config: { field: string; operator: string; value: string },
  ctx: TriggerContext
): Promise<{ matched: boolean; detail: string }> {
  if (config.field === "has_tag") {
    const tag = await prisma.tag.findFirst({
      where: { accountId: ctx.accountId, name: config.value },
    })
    if (!tag) {
      return {
        matched: config.operator === "not_has",
        detail: `Tag "${config.value}" does not exist in this account`,
      }
    }
    const link = await prisma.contactTag.findUnique({
      where: { contactId_tagId: { contactId: ctx.contactId, tagId: tag.id } },
    })
    const has = !!link
    const matched = config.operator === "not_has" ? !has : has
    return {
      matched,
      detail: `Contact ${has ? "has" : "does not have"} tag "${config.value}"`,
    }
  }
  if (config.field === "message_contains") {
    const text = (ctx.messageText ?? "").toLowerCase()
    const contains = text.includes((config.value ?? "").toLowerCase())
    const matched = config.operator === "not_contains" ? !contains : contains
    return {
      matched,
      detail: `Message ${contains ? "contains" : "does not contain"} "${config.value}"`,
    }
  }
  return { matched: false, detail: "Unknown condition field" }
}

async function executeStep(
  step: PrismaAutomationStep,
  ctx: TriggerContext,
  trace?: string[]
) {
  switch (step.stepType) {
    case "SEND_MESSAGE": {
      const config = { text: configString(step.config, "text") }
      trace?.push("Sent message to contact")
      return sendMessageStep(config, ctx)
    }
    case "ADD_TAG": {
      const config = { tagName: configString(step.config, "tagName") }
      trace?.push(`Added tag "${config.tagName}"`)
      return addTagStep(config, ctx)
    }
    case "REMOVE_TAG": {
      const config = { tagName: configString(step.config, "tagName") }
      trace?.push(`Removed tag "${config.tagName}"`)
      return removeTagStep(config, ctx)
    }
    case "UPDATE_CONTACT_FIELD": {
      const fieldName = configString(step.config, "field")
      if (
        fieldName !== "name" &&
        fieldName !== "email" &&
        fieldName !== "company"
      )
        return
      const field: "name" | "email" | "company" = fieldName
      const config = { field, value: configString(step.config, "value") }
      trace?.push(`Updated contact field "${config.field}"`)
      return updateContactFieldStep(config, ctx)
    }
    case "ASSIGN_CONVERSATION": {
      const config = { userId: configString(step.config, "userId") }
      trace?.push("Assigned conversation to teammate")
      return assignConversationStep(config, ctx)
    }
    case "SEND_WEBHOOK": {
      const config = { url: configString(step.config, "url") }
      trace?.push("Sent webhook")
      return sendWebhookStep(config)
    }
    case "CLOSE_CONVERSATION":
      trace?.push("Closed conversation")
      return closeConversationStep(ctx)
    default:
      throw new Error(`Unknown step type: ${step.stepType}`)
  }
}

async function sendMessageStep(config: { text: string }, ctx: TriggerContext) {
  const contact = await prisma.contact.findFirst({
    where: { id: ctx.contactId, accountId: ctx.accountId },
  })
  if (!contact) throw new Error("Contact not found")

  let conversation = ctx.conversationId
    ? await prisma.conversation.findFirst({
        where: { id: ctx.conversationId, accountId: ctx.accountId },
      })
    : await prisma.conversation.findFirst({
        where: {
          accountId: ctx.accountId,
          contactId: contact.id,
          status: { not: "CLOSED" },
        },
      })
  if (!conversation)
    conversation = await prisma.conversation.create({
      data: { accountId: ctx.accountId, contactId: contact.id },
    })

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderType: "BOT",
      contentText: config.text,
    },
  })
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageText: config.text, lastMessageAt: new Date() },
  })

  // Reserve one message against the account's quota for this automation step.
  try {
    await consumeMessages(ctx.accountId, 1, {
      feature: "AUTOMATION",
      recipientPhone: contact.phoneNormalized,
    })
  } catch (err) {
    const quotaMessage =
      err instanceof Error ? err.message : "Message quota exhausted"
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "FAILED", errorMessage: quotaMessage },
    })
    throw err
  }

  const whatsapp = await prisma.whatsAppConfig.findUnique({
    where: { accountId: ctx.accountId },
  })
  if (!whatsapp || whatsapp.status !== "CONNECTED") {
    const errorMessage = "WhatsApp is not connected"
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "FAILED", errorMessage },
    })
    throw new Error(errorMessage)
  }

  try {
    const accessToken = decrypt(whatsapp.accessTokenEncrypted)
    const result = await sendTextMessage(
      whatsapp.phoneNumberId,
      accessToken,
      contact.phoneNormalized,
      config.text
    )
    await prisma.message.update({
      where: { id: message.id },
      data: {
        status: "SENT",
        whatsappMessageId: result?.messages?.[0]?.id ?? null,
      },
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to send"
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "FAILED", errorMessage },
    })
    throw err
  }
}

async function addTagStep(config: { tagName: string }, ctx: TriggerContext) {
  if (!config.tagName) return
  const tag = await prisma.tag.upsert({
    where: {
      accountId_name: { accountId: ctx.accountId, name: config.tagName },
    },
    create: { accountId: ctx.accountId, name: config.tagName },
    update: {},
  })
  await prisma.contactTag.upsert({
    where: { contactId_tagId: { contactId: ctx.contactId, tagId: tag.id } },
    create: { contactId: ctx.contactId, tagId: tag.id },
    update: {},
  })
  await runAutomationsForTrigger("TAG_ADDED", ctx)
}

async function removeTagStep(config: { tagName: string }, ctx: TriggerContext) {
  if (!config.tagName) return
  const tag = await prisma.tag.findFirst({
    where: { accountId: ctx.accountId, name: config.tagName },
  })
  if (!tag) return
  await prisma.contactTag.deleteMany({
    where: { contactId: ctx.contactId, tagId: tag.id },
  })
}

async function updateContactFieldStep(
  config: { field: "name" | "email" | "company"; value: string },
  ctx: TriggerContext
) {
  if (!["name", "email", "company"].includes(config.field)) return
  await prisma.contact.updateMany({
    where: { id: ctx.contactId, accountId: ctx.accountId },
    data: { [config.field]: config.value },
  })
}

async function assignConversationStep(
  config: { userId: string },
  ctx: TriggerContext
) {
  if (!ctx.conversationId || !config.userId) return
  const member = await prisma.user.findFirst({
    where: { id: config.userId, accountId: ctx.accountId },
    select: { id: true },
  })
  if (!member) return

  await prisma.conversation.updateMany({
    where: { id: ctx.conversationId, accountId: ctx.accountId },
    data: { assignedAgentId: config.userId },
  })
}

async function sendWebhookStep(config: { url: string }) {
  if (!config.url) return
  const res = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(`Webhook returned ${res.status}`)
}

async function closeConversationStep(ctx: TriggerContext) {
  if (!ctx.conversationId) return
  await prisma.conversation.updateMany({
    where: { id: ctx.conversationId, accountId: ctx.accountId },
    data: { status: "CLOSED" },
  })
}

export async function resumePendingExecution(pendingId: string) {
  const pending = await prisma.automationPendingExecution.findUnique({
    where: { id: pendingId },
  })
  if (!pending || pending.status !== "PENDING") return

  await prisma.automationPendingExecution.update({
    where: { id: pending.id },
    data: { status: "RUNNING" },
  })

  const steps = await prisma.automationStep.findMany({
    where: {
      automationId: pending.automationId,
      parentStepId: pending.parentStepId,
      branch: pending.branch ?? undefined,
    },
    orderBy: { position: "asc" },
  })

  const ctx: TriggerContext = {
    accountId: pending.accountId,
    contactId: pending.contactId!,
    conversationId: pending.conversationId ?? undefined,
    messageText: configString(pending.context, "messageText") || undefined,
  }

  try {
    const { paused } = await executeStepsAtLevel(
      pending.automationId,
      steps,
      pending.nextStepPosition,
      pending.parentStepId,
      pending.branch,
      ctx
    )
    await prisma.automationPendingExecution.update({
      where: { id: pending.id },
      data: { status: "DONE" },
    })
    if (!paused) await completeRun(pending.automationId, ctx)
  } catch (err) {
    await prisma.automationPendingExecution.update({
      where: { id: pending.id },
      data: { status: "FAILED" },
    })
    await failRun(pending.automationId, ctx, err)
  }
}
