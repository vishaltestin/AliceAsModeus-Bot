"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function getDashboardAnalytics() {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  const accountId = session.user.accountId
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    contacts,
    newContacts,
    openConversations,
    unread,
    messages,
    broadcasts,
    openDeals,
    categories,
    recentConversations,
    messageTrend,
  ] = await Promise.all([
    prisma.contact.count({ where: { accountId } }),
    prisma.contact.count({
      where: { accountId, createdAt: { gte: monthStart } },
    }),
    prisma.conversation.count({ where: { accountId, status: "OPEN" } }),
    prisma.conversation.aggregate({
      where: { accountId },
      _sum: { unreadCount: true },
    }),
    prisma.message.count({
      where: {
        conversation: { accountId },
        senderType: "AGENT",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.broadcast.count({
      where: { accountId, createdAt: { gte: monthStart } },
    }),
    prisma.deal.aggregate({
      where: { accountId, status: "OPEN" },
      _sum: { value: true },
      _count: { _all: true },
    }),
    prisma.contact.groupBy({
      by: ["category"],
      where: { accountId },
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
      take: 5,
    }),
    prisma.conversation.findMany({
      where: { accountId },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        contact: { select: { name: true, phone: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.message.findMany({
      where: {
        conversation: { accountId },
        createdAt: { gte: sevenDaysAgo },
      },
      select: { createdAt: true },
    }),
  ])

  return {
    stats: {
      contacts,
      newContacts,
      openConversations,
      unread: unread._sum.unreadCount ?? 0,
      messages,
      broadcasts,
      openDeals: openDeals._count._all,
      pipelineValue: openDeals._sum.value ?? 0,
    },
    categories: categories.map((item) => ({
      category: item.category,
      count: item._count._all,
    })),
    recentConversations,
    messageTrend: bucketMessagesByDay(messageTrend, sevenDaysAgo),
  }
}

function bucketMessagesByDay(
  rows: { createdAt: Date }[],
  start: Date
): { label: string; count: number }[] {
  const counts = new Map<string, { label: string; count: number }>()
  for (let i = 6; i >= 0; i--) {
    const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000)
    counts.set(dayKey(day), { label: dayLabel(day), count: 0 })
  }
  for (const row of rows) {
    const key = dayKey(row.createdAt)
    const entry = counts.get(key)
    if (entry) entry.count += 1
  }
  return Array.from(counts.values())
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function dayLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short" })
}
