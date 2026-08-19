import { prisma } from "@/lib/prisma"

export async function createNotification({
  accountId,
  userId,
  type,
  title,
  body,
  href,
}: {
  accountId: string
  userId: string
  type: string
  title: string
  body: string
  href?: string
}) {
  try {
    await prisma.notification.create({
      data: { accountId, userId, type, title, body, href: href ?? null },
    })
  } catch (error) {
    console.error("[wacrm] Notification write failed", error)
  }
}
