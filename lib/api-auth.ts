import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashApiKey } from "@/lib/api-keys"
import { consume, getRateLimitHeaders } from "@/lib/rate-limit"

// Per-API-key request rate limit (fair-use protection). This is separate from
// message quota; it throttles raw call volume to protect the platform.
const API_KEY_REQ_LIMIT = 120
const API_KEY_REQ_WINDOW_MS = 60_000 // per minute

export class ApiAuthError extends Error {
  headers?: Record<string, string>
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

export async function authenticateApiRequest(
  req: NextRequest,
  requiredScope?: string
) {
  const header = req.headers.get("authorization")
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null
  if (!token)
    throw new ApiAuthError("Missing Authorization: Bearer <key> header", 401)

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(token) },
  })
  if (!apiKey) throw new ApiAuthError("Invalid API key", 401)
  if (apiKey.revokedAt)
    throw new ApiAuthError("This API key has been revoked", 401)
  if (apiKey.expiresAt && apiKey.expiresAt < new Date())
    throw new ApiAuthError("This API key has expired", 401)

  const scopes = Array.isArray(apiKey.scopes)
    ? apiKey.scopes.filter(
        (scope): scope is string => typeof scope === "string"
      )
    : []
  if (requiredScope && !scopes.includes(requiredScope)) {
    throw new ApiAuthError(
      `This key is missing the required scope: ${requiredScope}`,
      403
    )
  }

  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})

  // Per-key request rate limiting.
  const rl = consume(`apikey:${apiKey.id}`, API_KEY_REQ_LIMIT, API_KEY_REQ_WINDOW_MS)
  if (!rl.allowed) {
    const err = new ApiAuthError(
      "Too many requests — try again later",
      429
    )
    err.headers = getRateLimitHeaders(rl)
    throw err
  }

  return { accountId: apiKey.accountId, scopes }
}
