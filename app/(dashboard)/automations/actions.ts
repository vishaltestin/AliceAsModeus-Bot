"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canWriteWorkspace } from "@/lib/permissions"
import type { Automation } from "@/generated/prisma/client"
import type { AutomationStepType } from "@/generated/prisma/enums"
import { InputJsonValue } from "@prisma/client/runtime/client"

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
    throw new Error("Viewers can only view automations")
  return session
}

export async function getAutomations() {
  const session = await requireSession()
  return prisma.automation.findMany({
    where: { accountId: session.user.accountId },
    include: { steps: true },
    orderBy: { createdAt: "desc" },
  })
}

export async function getAccountMembers() {
  const session = await requireSession()
  return prisma.user.findMany({
    where: { accountId: session.user.accountId },
    select: { id: true, name: true, email: true },
  })
}

export async function toggleAutomation(id: string, isActive: boolean) {
  const session = await requireWriteSession()
  await prisma.automation.updateMany({
    where: { id, accountId: session.user.accountId },
    data: { isActive },
  })
}

export async function deleteAutomation(id: string) {
  const session = await requireWriteSession()
  await prisma.automation.deleteMany({
    where: { id, accountId: session.user.accountId },
  })
}

export type StepNode =
  | { type: "SEND_MESSAGE"; text: string }
  | { type: "ADD_TAG"; tagName: string }
  | { type: "REMOVE_TAG"; tagName: string }
  | {
      type: "UPDATE_CONTACT_FIELD"
      field: "name" | "email" | "company"
      value: string
    }
  | { type: "ASSIGN_CONVERSATION"; userId: string }
  | { type: "SEND_WEBHOOK"; url: string }
  | { type: "CLOSE_CONVERSATION" }
  | { type: "WAIT"; durationMinutes: number }
  | {
      type: "CONDITION"
      field: "has_tag" | "message_contains"
      operator: string
      value: string
      yes: StepNode[]
      no: StepNode[]
    }

export type TriggerType =
  | "NEW_MESSAGE_RECEIVED"
  | "FIRST_MESSAGE_FROM_CONTACT"
  | "KEYWORD_MATCH"
  | "NEW_CONTACT_CREATED"
  | "CONVERSATION_ASSIGNED"
  | "TAG_ADDED"

type FlatRow = {
  stepType: string
  config: Record<string, InputJsonValue>
  position: number
  parentStepId: string | null
  branch: "YES" | "NO" | null
  _tempId: string
  _children?: { yes: FlatRow[]; no: FlatRow[] }
}

function flattenSteps(
  nodes: StepNode[],
  parentStepId: string | null,
  branch: "YES" | "NO" | null
): FlatRow[] {
  return nodes.map((node, position) => {
    const tempId = `tmp_${Math.random().toString(36).slice(2)}`
    if (node.type === "CONDITION") {
      return {
        stepType: "CONDITION",
        config: {
          field: node.field,
          operator: node.operator,
          value: node.value,
        },
        position,
        parentStepId,
        branch,
        _tempId: tempId,
        _children: {
          yes: flattenSteps(node.yes, tempId, "YES"),
          no: flattenSteps(node.no, tempId, "NO"),
        },
      }
    }
    const { type, ...rest } = node
    const config = rest as Record<string, InputJsonValue>
    return {
      stepType: type,
      config,
      position,
      parentStepId,
      branch,
      _tempId: tempId,
    }
  })
}

export async function saveAutomation(
  automationId: string | null,
  name: string,
  triggerType: TriggerType,
  triggerConfig: InputJsonValue | null,
  isActive: boolean,
  steps: StepNode[]
) {
  const session = await requireWriteSession()
  if (!name.trim()) throw new Error("Name is required")
  if (steps.length === 0) throw new Error("Add at least one step")

  const flat = flattenSteps(steps, null, null)

  return prisma.$transaction(async (tx) => {
    let automation: Automation
    if (automationId) {
      const existing = await tx.automation.findFirst({
        where: { id: automationId, accountId: session.user.accountId },
        select: { id: true },
      })
      if (!existing) throw new Error("Automation not found")

      automation = await tx.automation.update({
        where: { id: existing.id },
        data: {
          name,
          triggerType,
          triggerConfig: triggerConfig ?? undefined,
          isActive,
        },
      })
      await tx.automationStep.deleteMany({
        where: { automationId: existing.id },
      })
    } else {
      automation = await tx.automation.create({
        data: {
          accountId: session.user.accountId,
          name,
          triggerType,
          triggerConfig: triggerConfig ?? undefined,
          isActive,
        },
      })
    }

    const idMap = new Map<string, string>()
    async function createLevel(rows: FlatRow[]) {
      for (const row of rows) {
        const parentRealId = row.parentStepId
          ? (idMap.get(row.parentStepId) ?? null)
          : null
        const created = await tx.automationStep.create({
          data: {
            automationId: automation.id,
            parentStepId: parentRealId,
            branch: row.branch ?? undefined,
            stepType: row.stepType as AutomationStepType,
            config: row.config,
            position: row.position,
          },
        })
        idMap.set(row._tempId, created.id)
        if (row._children) {
          await createLevel(row._children.yes)
          await createLevel(row._children.no)
        }
      }
    }
    await createLevel(flat)
    return automation
  })
}

function recordFromJson(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return {}
  return value as Record<string, unknown>
}

// Reconstructs the nested StepNode[] tree the builder needs from the flat
// DB rows — the inverse of flattenSteps. Without this, editing an existing
// automation had nowhere to load its steps back from.
export async function getAutomationForEdit(automationId: string) {
  const session = await requireSession()
  const automation = await prisma.automation.findFirst({
    where: { id: automationId, accountId: session.user.accountId },
  })
  if (!automation) throw new Error("Automation not found")

  const allSteps = await prisma.automationStep.findMany({
    where: { automationId },
    orderBy: { position: "asc" },
  })

  function buildLevel(
    parentStepId: string | null,
    branch: "YES" | "NO" | null
  ): StepNode[] {
    return allSteps
      .filter((s) => s.parentStepId === parentStepId && s.branch === branch)
      .map((s): StepNode => {
        const config = recordFromJson(s.config)
        if (s.stepType === "CONDITION") {
          const field =
            config.field === "message_contains" ? "message_contains" : "has_tag"
          return {
            type: "CONDITION",
            field,
            operator:
              typeof config.operator === "string" ? config.operator : "has",
            value: typeof config.value === "string" ? config.value : "",
            yes: buildLevel(s.id, "YES"),
            no: buildLevel(s.id, "NO"),
          }
        }
        return {
          type: s.stepType as StepNode["type"],
          ...config,
        } as unknown as StepNode
      })
  }

  return {
    id: automation.id,
    name: automation.name,
    triggerType: automation.triggerType as TriggerType,
    triggerConfig: automation.triggerConfig as Record<string, unknown> | null,
    isActive: automation.isActive,
    steps: buildLevel(null, null),
  }
}

export async function getAutomationLogs(automationId: string) {
  const session = await requireSession()
  const automation = await prisma.automation.findFirst({
    where: { id: automationId, accountId: session.user.accountId },
  })
  if (!automation) throw new Error("Not found")
  return prisma.automationLog.findMany({
    where: { automationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
}

export async function testRunAutomation(
  automationId: string,
  contactId: string
) {
  const session = await requireWriteSession()
  const automation = await prisma.automation.findFirst({
    where: { id: automationId, accountId: session.user.accountId },
  })
  if (!automation) throw new Error("Automation not found")
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, accountId: session.user.accountId },
  })
  if (!contact) throw new Error("Contact not found")

  const conversation = await prisma.conversation.findFirst({
    where: {
      accountId: session.user.accountId,
      contactId,
      status: { not: "CLOSED" },
    },
  })

  const { runAutomationById } = await import("@/lib/automations/engine")
  const trace = await runAutomationById(automationId, {
    accountId: session.user.accountId,
    contactId,
    conversationId: conversation?.id,
    messageText: "test",
  })

  const log = await prisma.automationLog.findFirst({
    where: { automationId },
    orderBy: { createdAt: "desc" },
  })
  return {
    status: log?.status ?? "UNKNOWN",
    errorMessage: log?.errorMessage ?? null,
    trace,
  }
}
