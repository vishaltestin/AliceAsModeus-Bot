"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminRole } from "@/lib/permissions"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  if (!isAdminRole(session.user.accountRole))
    throw new Error("Forbidden")
  return session
}

export async function getAuditLogs(limit = 100) {
  const session = await requireAdmin()
  return prisma.auditLog.findMany({
    where: { accountId: session.user.accountId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  })
}
