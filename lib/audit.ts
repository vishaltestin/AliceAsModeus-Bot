import { InputJsonValue } from "@prisma/client/runtime/client"
import { prisma } from "@/lib/prisma"

export async function writeAuditLog({
  accountId,
  userId,
  action,
  entityType,
  entityId,
  metadata,
}: {
  accountId: string
  userId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: unknown
}) {
  try {
    await prisma.auditLog.create({
      data: {
        accountId,
        userId: userId ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        metadata:
          metadata === undefined ? undefined : (metadata as InputJsonValue),
      },
    })
  } catch (error) {
    // Auditing must never make the primary user action fail.
    console.error("[wacrm] Audit log write failed", error)
  }
}
