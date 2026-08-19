"use client"

import Link from "next/link"
import { useEffect } from "react"
import {
  getErrorDigest,
  isSanitizedProductionError,
  userFriendlyMessage,
} from "@/lib/error-handling"

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const friendly = userFriendlyMessage(error, getErrorDigest(error))
  const message =
    isSanitizedProductionError(error) || isSanitizedProductionError(friendly.message)
      ? "Something went wrong on our end. Please try again — if it keeps happening, contact support."
      : friendly.message
  const digest = getErrorDigest(error)

  useEffect(() => {
    // Log client-side too; the full server-side detail is already logged by the
    // loader/action that produced this error (see lib/error-handling.ts).
    console.error("[wacrm] Route error boundary", {
      message: error?.message,
      digest: digest ?? error?.digest,
      name: error?.name,
    })
  }, [error, digest])

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-xl"
          style={{
            background: "var(--coral-soft)",
            color: "var(--coral)",
            boxShadow: "0 12px 30px rgba(196, 67, 43, 0.14)",
          }}
          aria-hidden="true"
        >
          !
        </div>
        <p
          className="mt-6 text-xs font-semibold tracking-[0.18em] uppercase"
          style={{ color: "var(--coral)" }}
        >
          Unexpected error
        </p>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight"
          style={{ color: "var(--ink)" }}
        >
          We hit a bump in the conversation.
        </h1>
        <p
          className="mt-3 text-sm leading-6"
          style={{ color: "var(--ink-soft)" }}
        >
          {message}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            style={{
              background: "var(--jade)",
              boxShadow: "0 8px 18px rgba(31, 111, 92, 0.18)",
            }}
          >
            Try again
          </button>
          <Link
            href="/inbox"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5"
            style={{
              border: "1px solid var(--line)",
              background: "var(--paper-raised)",
              color: "var(--ink)",
            }}
          >
            Back to your workspace
          </Link>
        </div>
        {digest && (
          <p
            className="mt-8 font-[family-name:var(--font-code)] text-[11px]"
            style={{ color: "var(--ink-soft)" }}
          >
            Reference: {digest}
          </p>
        )}
      </div>
    </main>
  )
}
