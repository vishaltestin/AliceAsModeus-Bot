"use client"

import { ClipboardList, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { getAuditLogs } from "./actions"

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<Awaited<ReturnType<typeof getAuditLogs>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    try {
      setLogs(await getAuditLogs())
      setError(null)
    } catch (reason) {
      console.error("[wacrm] Audit log load failed", reason)
      setError("We couldn't load the audit log.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const task = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(task)
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl animate-pulse space-y-4">
        <div
          className="h-10 w-56 rounded-xl"
          style={{ background: "var(--line)" }}
        />
        <div
          className="h-96 rounded-2xl"
          style={{ background: "var(--paper-raised)" }}
        />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Workspace security"
        title="Audit log"
        description="A chronological record of important workspace and account activity."
        actions={
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ border: "1px solid var(--line)", color: "var(--ink)" }}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />
      {error && (
        <div
          role="alert"
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
        >
          {error}
        </div>
      )}
      <div className="surface-card overflow-hidden">
        {logs.length ? (
          <div className="divide-y" style={{ borderColor: "var(--line)" }}>
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-4 p-4 sm:p-5">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: "var(--jade-soft)",
                    color: "var(--jade-dark)",
                  }}
                >
                  <ClipboardList size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "var(--ink)" }}
                    >
                      {formatAction(log.action)}
                    </p>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: "var(--paper)",
                        color: "var(--ink-soft)",
                      }}
                    >
                      {log.entityType}
                    </span>
                  </div>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {log.user?.name || log.user?.email || "System"}
                    {log.entityId ? ` · ${log.entityId}` : ""}
                  </p>
                </div>
                <time
                  className="shrink-0 text-[11px]"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {formatDate(log.createdAt)}
                </time>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <ClipboardList
              size={24}
              className="mx-auto"
              style={{ color: "var(--line)" }}
            />
            <p
              className="mt-3 text-sm font-semibold"
              style={{ color: "var(--ink)" }}
            >
              No audit events yet
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
              Important account actions will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function formatAction(action: string) {
  return action
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
