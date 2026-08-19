"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function requireSession() {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  return session
}

export async function getNotifications(limit = 3) {
  const session = await requireSession()
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id, accountId: session.user.accountId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 20),
    }),
    prisma.notification.count({
      where: {
        userId: session.user.id,
        accountId: session.user.accountId,
        readAt: null,
      },
    }),
  ])
  return { items, unreadCount }
}

export async function markNotificationRead(id: string) {
  const session = await requireSession()
  if (!id) return { error: "Notification id is required" }
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id, accountId: session.user.accountId },
    data: { readAt: new Date() },
  })
  return { success: true as const }
}

export async function markAllNotificationsRead() {
  const session = await requireSession()
  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      accountId: session.user.accountId,
      readAt: null,
    },
    data: { readAt: new Date() },
  })
  return { success: true as const }
}
