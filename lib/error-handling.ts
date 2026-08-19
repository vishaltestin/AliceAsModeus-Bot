// Centralized error handling helpers.
//
// Goals:
//  1. NEVER surface raw provider/database stack traces to end users.
//  2. Always preserve the full, detailed error in server logs for debugging.
//  3. Let Server Components render a friendly message (or reach the error
//     boundary) instead of crashing into React's generic #441 message.
//
// Usage:
//  - Server Components / data loaders: wrap the fetch in try/catch, call
//    `logServerError("dashboard:load", err)`, then either render a friendly
//    fallback or `throw toAppError(err)` so the boundary shows a good message.
//  - Server Actions: catch, `logServerError(...)`, return `{ error: userFriendlyMessage(...) }`.
//  - error.tsx / global-error.tsx: call `toUserFriendlyMessage(error)`.

export class AppError extends Error {
  /** Stable, human-readable message shown to the user. */
  readonly userMessage: string
  /** Short code used to correlate support requests (also set as digest). */
  readonly code?: string
  /** True when this error was already logged server-side. */
  readonly logged?: boolean

  constructor(userMessage: string, opts: { code?: string; logged?: boolean } = {}) {
    super(userMessage)
    this.name = "AppError"
    this.userMessage = userMessage
    this.code = opts.code
    this.logged = opts.logged
  }
}

/** Serializable result for expected Server Action failures. */
export type ActionFailure = { error: string }

export function actionFailure(message: string): ActionFailure {
  return { error: message }
}

export function isActionFailure(value: unknown): value is ActionFailure {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "string" &&
    (value as { error: string }).error.length > 0 &&
    !("id" in value)
  )
}

/**
 * React / Next.js production builds strip thrown Server Action and Server
 * Component error messages (React #441) so secrets don't leak to the client.
 * Detect that sanitized payload so the UI never shows the minified text.
 */
export function isSanitizedProductionError(err: unknown): boolean {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : ""
  if (!message) return false
  return (
    /Minified React error #\d+/i.test(message) ||
    /omitted in production builds/i.test(message) ||
    /visit https?:\/\/react\.dev\/errors\//i.test(message)
  )
}

/**
 * Client-side: pick a message the user can actually act on. Never surface
 * React's production #441 text.
 */
export function clientSafeErrorMessage(err: unknown, fallback: string): string {
  if (isSanitizedProductionError(err)) return fallback
  if (err instanceof Error && err.message.trim()) return err.message
  if (typeof err === "string" && err.trim() && !isSanitizedProductionError(err)) {
    return err
  }
  return fallback
}

/** Best-effort source of truth for the original error message (for logs). */
export function errorDetail(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

/**
 * Log the full error server-side (preserved in server console / logs) with a
 * context label so it can be correlated with a user-facing reference.
 */
export function logServerError(context: string, err: unknown): string {
  const digest =
    (typeof err === "object" &&
      err !== null &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      (err as { digest?: string }).digest) ||
    (err instanceof AppError && err.code) ||
    `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

  // Server console / log aggregator. Keeps the real stack + details.
  console.error(`[wacrm][${context}] digest=${digest}`, err)

  return digest
}

/**
 * Map an unknown thrown value to a safe, user-friendly message. Never leaks
 * provider internals or stack traces. Unknown/unexpected errors get a generic
 * message plus a digest for correlation.
 */
export function userFriendlyMessage(
  err: unknown,
  digest?: string
): { message: string; digest?: string } {
  if (err instanceof AppError) {
    return { message: err.userMessage, digest: err.code || digest }
  }
  // Named business errors (QuotaError) carry a safe, user-written message.
  if (
    err instanceof Error &&
    (err.name === "QuotaError" || err.name === "AppError") &&
    err.message.trim() &&
    !isSanitizedProductionError(err)
  ) {
    return {
      message: err.message,
      digest: digest || (err as { digest?: string }).digest,
    }
  }
  if (err instanceof Error) {
    // Do not trust arbitrary error messages (e.g. Prisma URLs, DB details)
    // and never show React's production #441 text.
    return {
      message: genericMessage(),
      digest: digest || (err as { digest?: string }).digest,
    }
  }
  return { message: genericMessage(), digest }
}

/**
 * Convert an unexpected thrown value into a logged AppError with a friendly
 * message, so a Server Component can `throw` it and the error boundary renders
 * something useful (instead of React #441) while the real error stays in logs.
 */
export function toAppError(context: string, err: unknown): AppError {
  const digest = logServerError(context, err)
  if (err instanceof AppError && err.logged) return err
  return new AppError(userFriendlyMessage(err, digest).message, {
    code: digest,
    logged: true,
  })
}

/**
 * Render-time friendly error body shared by error boundaries.
 * Returns a stable reference-friendly digest if the error has one.
 */
export function getErrorDigest(err: unknown): string | undefined {
  if (err && typeof err === "object" && "digest" in err && err.digest) {
    return String(err.digest)
  }
  if (err instanceof AppError && err.code) return err.code
  return undefined
}

function genericMessage(): string {
  return "Something went wrong on our end. Please try again — if it keeps happening, contact support."
}

/**
 * True when `err` is Next.js's internal "Dynamic server usage" signal thrown
 * during static generation (route uses headers/cookies). This is NOT a real
 * failure — callers must rethrow it so Next correctly marks the route dynamic
 * and doesn't bake a static fallback. Do not log or surface it to users.
 */
export function isDynamicServerUsage(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    (err as { digest?: unknown }).digest === "DYNAMIC_SERVER_USAGE"
  )
}
