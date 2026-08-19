"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canWriteWorkspace } from "@/lib/permissions"

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
    throw new Error("Viewers can only view pipelines")
  return session
}

const DEFAULT_STAGES = [
  { name: "New Lead", color: "#3B82F6", probability: 10 },
  { name: "Qualified", color: "#D97706", probability: 25 },
  { name: "Proposal Sent", color: "#EA580C", probability: 50 },
  { name: "Negotiation", color: "#7C3AED", probability: 75 },
  { name: "Won", color: "#1F6F5C", probability: 100, isWonStage: true },
  { name: "Lost", color: "#C4432B", probability: 0, isLostStage: true },
]

export async function getPipelines() {
  const session = await requireSession()
  let pipelines = await prisma.pipeline.findMany({
    where: { accountId: session.user.accountId },
    orderBy: { createdAt: "asc" },
  })

  if (pipelines.length === 0) {
    const pipeline = await prisma.pipeline.create({
      data: {
        accountId: session.user.accountId,
        name: "Sales Pipeline",
        isDefault: true,
        stages: {
          create: DEFAULT_STAGES.map((s, i) => ({ ...s, position: i })),
        },
      },
    })
    pipelines = [pipeline]
  }
  return pipelines
}

export async function getPipeline(pipelineId: string) {
  const session = await requireSession()
  const pipeline = await prisma.pipeline.findFirst({
    where: { id: pipelineId, accountId: session.user.accountId },
    include: {
      stages: {
        orderBy: { position: "asc" },
        include: {
          deals: {
            orderBy: { createdAt: "desc" },
            include: { contact: { select: { name: true, phone: true } } },
          },
        },
      },
    },
  })
  if (!pipeline) throw new Error("Pipeline not found")
  return pipeline
}

export async function getPipelineMetrics(pipelineId: string) {
  const session = await requireSession()
  const deals = await prisma.deal.findMany({
    where: { pipelineId, accountId: session.user.accountId },
    include: { stage: true },
  })

  const openDeals = deals.filter((d) => d.status === "OPEN")
  const totalDeals = openDeals.length
  const pipelineValue = openDeals.reduce((sum, d) => sum + d.value, 0)
  const avgDealSize =
    totalDeals > 0 ? Math.round(pipelineValue / totalDeals) : 0
  const weightedValue = Math.round(
    openDeals.reduce((sum, d) => sum + (d.value * d.stage.probability) / 100, 0)
  )

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const wonThisMonth = deals.filter(
    (d) => d.status === "WON" && d.closedAt && d.closedAt >= monthStart
  ).length
  const lostThisMonth = deals.filter(
    (d) => d.status === "LOST" && d.closedAt && d.closedAt >= monthStart
  ).length

  return {
    totalDeals,
    pipelineValue,
    avgDealSize,
    weightedValue,
    wonThisMonth,
    lostThisMonth,
  }
}

export async function createPipeline(name: string) {
  const session = await requireWriteSession()
  if (!name.trim()) throw new Error("Name is required")
  return prisma.pipeline.create({
    data: {
      accountId: session.user.accountId,
      name,
      stages: { create: DEFAULT_STAGES.map((s, i) => ({ ...s, position: i })) },
    },
  })
}

export async function createDeal(
  pipelineId: string,
  stageId: string,
  title: string,
  value: number,
  contactId?: string
) {
  const session = await requireWriteSession()
  if (!pipelineId || !stageId)
    throw new Error("Pipeline and stage are required")
  if (!title.trim()) throw new Error("Deal title is required")

  const pipeline = await prisma.pipeline.findFirst({
    where: { id: pipelineId, accountId: session.user.accountId },
    select: { id: true },
  })
  if (!pipeline) throw new Error("Pipeline not found")

  const stage = await prisma.pipelineStage.findFirst({
    where: {
      id: stageId,
      pipelineId,
      pipeline: { accountId: session.user.accountId },
    },
    select: { id: true },
  })
  if (!stage) throw new Error("Stage not found")

  if (contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, accountId: session.user.accountId },
      select: { id: true },
    })
    if (!contact) throw new Error("Contact not found")
  }

  return prisma.deal.create({
    data: {
      accountId: session.user.accountId,
      pipelineId,
      stageId,
      title: title.trim(),
      value: Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0,
      contactId: contactId || null,
    },
  })
}

export async function moveDeal(dealId: string, newStageId: string) {
  const session = await requireWriteSession()
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, accountId: session.user.accountId },
  })
  if (!deal) throw new Error("Deal not found")

  if (!newStageId) throw new Error("Stage is required")
  const stage = await prisma.pipelineStage.findFirst({
    where: {
      id: newStageId,
      pipelineId: deal.pipelineId,
      pipeline: { accountId: session.user.accountId },
    },
  })
  if (!stage) throw new Error("Stage not found")

  const status = stage.isWonStage ? "WON" : stage.isLostStage ? "LOST" : "OPEN"
  return prisma.deal.update({
    where: { id: dealId },
    data: {
      stageId: newStageId,
      status,
      closedAt: status === "OPEN" ? null : new Date(),
    },
  })
}

export async function deleteDeal(dealId: string) {
  const session = await requireWriteSession()
  await prisma.deal.deleteMany({
    where: { id: dealId, accountId: session.user.accountId },
  })
}
