"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateApiKey } from "@/lib/api-keys"
import { writeAuditLog } from "@/lib/audit"
import { isAdminRole } from "@/lib/permissions"
import { isValidScopes } from "@/lib/api-scopes"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  if (!isAdminRole(session.user.accountRole)) throw new Error("Forbidden")
  return session
}

export async function getApiKeys() {
  const session = await requireAdmin()
  return prisma.apiKey.findMany({
    where: { accountId: session.user.accountId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  })
}

export async function createApiKey(name: string, scopes: string[]) {
  const session = await requireAdmin()
  if (!name.trim()) return { error: "Name is required" }
  // Validate scopes server-side — never trust the client to pick them.
  if (!isValidScopes(scopes)) return { error: "Invalid scopes" }
  const { plaintext, keyPrefix, keyHash } = generateApiKey()
  const created = await prisma.apiKey.create({
    data: {
      accountId: session.user.accountId,
      createdByUserId: session.user.id,
      name,
      keyPrefix,
      keyHash,
      scopes,
    },
  })
  await writeAuditLog({
    accountId: session.user.accountId,
    userId: session.user.id,
    action: "API_KEY_CREATED",
    entityType: "ApiKey",
    entityId: created.id,
    metadata: { scopes },
  })
  return { success: true, plaintext }
}

export async function revokeApiKey(id: string) {
  const session = await requireAdmin()
  const result = await prisma.apiKey.updateMany({
    where: { id, accountId: session.user.accountId },
    data: { revokedAt: new Date() },
  })
  if (result.count)
    await writeAuditLog({
      accountId: session.user.accountId,
      userId: session.user.id,
      action: "API_KEY_REVOKED",
      entityType: "ApiKey",
      entityId: id,
    })
}
