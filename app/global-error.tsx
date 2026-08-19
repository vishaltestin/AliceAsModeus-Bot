"use client"

import Link from "next/link"
import { useEffect } from "react"
import {
  getErrorDigest,
  userFriendlyMessage,
} from "@/lib/error-handling"

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const { message } = userFriendlyMessage(error, getErrorDigest(error))
  const digest = getErrorDigest(error)

  useEffect(() => {
    console.error("[wacrm] Global application error", {
      message: error?.message,
      digest: digest ?? error?.digest,
      name: error?.name,
    })
  }, [error, digest])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#f7f8f6",
          color: "#101828",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <main
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: "64px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 440 }}>
            <div
              aria-hidden="true"
              style={{
                display: "inline-flex",
                height: 56,
                width: 56,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 18,
                background: "#fbeae6",
                color: "#c4432b",
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              !
            </div>
            <p
              style={{
                margin: "24px 0 0",
                color: "#c4432b",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              Application error
            </p>
            <h1
              style={{
                margin: "12px 0 0",
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: "-0.03em",
              }}
            >
              FueledInbox needs a quick restart.
            </h1>
            <p
              style={{
                margin: "14px 0 0",
                color: "#4b5259",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              {message}
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 12,
                marginTop: 32,
              }}
            >
              <button
                type="button"
                onClick={() => unstable_retry()}
                style={{
                  cursor: "pointer",
                  border: 0,
                  borderRadius: 12,
                  background: "#1f6f5c",
                  padding: "11px 16px",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Try again
              </button>
              <Link
                href="/inbox"
                style={{
                  border: "1px solid #e2e4df",
                  borderRadius: 12,
                  background: "white",
                  padding: "10px 16px",
                  color: "#101828",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Back to your workspace
              </Link>
            </div>
            {digest && (
              <p
                style={{
                  marginTop: 32,
                  color: "#4b5259",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 11,
                }}
              >
                Reference: {digest}
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  )
}
