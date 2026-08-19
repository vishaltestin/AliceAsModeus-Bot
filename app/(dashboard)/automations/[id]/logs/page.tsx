"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { getAutomationLogs } from "../../actions"
import { formatRelativeTime } from "@/lib/format"

export default function AutomationLogsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [logs, setLogs] = useState<
    Awaited<ReturnType<typeof getAutomationLogs>>
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAutomationLogs(id).then((l) => {
      setLogs(l)
      setLoading(false)
    })
  }, [id])

  if (loading)
    return (
      <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
        Loading…
      </p>
    )

  return (
    <div className="max-w-2xl">
      <Link
        href="/automations"
        className="text-sm"
        style={{ color: "var(--ink-soft)" }}
      >
        ← Back to automations
      </Link>
      <h1
        className="mt-2 mb-4 text-2xl font-medium"
        style={{ color: "var(--ink)" }}
      >
        Recent runs
      </h1>

      <div className="space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className="rounded-xl p-4"
            style={{
              background: "var(--paper-raised)",
              border: "1px solid var(--line)",
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  background:
                    log.status === "SUCCESS"
                      ? "var(--jade-soft)"
                      : "var(--coral-soft)",
                  color:
                    log.status === "SUCCESS"
                      ? "var(--jade-dark)"
                      : "var(--coral)",
                }}
              >
                {log.status}
              </span>
              <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
                {formatRelativeTime(log.createdAt)}
              </span>
            </div>
            {log.errorMessage && (
              <p
                className="mt-2 font-[family-name:var(--font-code)] text-sm"
                style={{ color: "var(--coral)" }}
              >
                {log.errorMessage}
              </p>
            )}
          </div>
        ))}
        {logs.length === 0 && (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            No runs yet.
          </p>
        )}
      </div>
    </div>
  )
}
