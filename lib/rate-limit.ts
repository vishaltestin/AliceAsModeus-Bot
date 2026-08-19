// Lightweight in-memory sliding-window rate limiter.
// Suitable for a single-instance VPS deployment (the project's target). For a
// multi-instance/clustered deployment, replace this with a shared store (Redis,
// or a DB table) — the call sites and API shape stay the same.
//
// Keys are typically "<bucket>:<identifier>" e.g. "login:user@x.com".

type Window = { count: number; resetAt: number }

const buckets = new Map<string, Window>()

const DEFAULT_WINDOW_MS = 60_000 // 1 minute

export type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
}

function prune() {
  const now = Date.now()
  for (const [key, w] of buckets) {
    if (w.resetAt <= now) buckets.delete(key)
  }
}

/**
 * Consume one unit for `key` and return whether it is still allowed.
 * Call this when an event actually happens (e.g. a failed login, a request).
 */
export function consume(
  key: string,
  limit: number,
  windowMs: number = DEFAULT_WINDOW_MS
): RateLimitResult {
  prune()
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }
  bucket.count += 1
  const allowed = bucket.count <= limit
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  }
}

/**
 * Non-consuming check: returns whether `key` is currently over its limit.
 * Use this BEFORE an expensive operation (e.g. bcrypt) to reject attackers
 * without spending CPU, then call consume() when the failure actually happens.
 */
export function isOverLimit(key: string, limit: number): boolean {
  prune()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= Date.now()) return false
  return bucket.count >= limit
}

export function getRateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  }
}
