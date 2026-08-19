"use client"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { getAutomations, toggleAutomation, deleteAutomation } from "./actions"
import { useRole } from "@/components/role-context"

const TRIGGER_LABELS: Record<string, string> = {
  NEW_MESSAGE_RECEIVED: "New message received",
  FIRST_MESSAGE_FROM_CONTACT: "First message from contact",
  KEYWORD_MATCH: "Keyword match",
  NEW_CONTACT_CREATED: "New contact created",
  CONVERSATION_ASSIGNED: "Conversation assigned",
  TAG_ADDED: "Tag added",
}

export default function AutomationsPage() {
  const { canWrite } = useRole()
  const [automations, setAutomations] = useState<
    Awaited<ReturnType<typeof getAutomations>>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function loadAutomations() {
    setLoading(true)
    setError(null)
    getAutomations()
      .then((items) => setAutomations(items))
      .catch((reason) => {
        console.error("[wacrm] Automations load failed", reason)
        setError("We couldn't load automations. Please try again.")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const task = window.setTimeout(loadAutomations, 0)
    return () => window.clearTimeout(task)
  }, [])

  function handleToggle(id: string, next: boolean) {
    setError(null)
    startTransition(async () => {
      try {
        await toggleAutomation(id, next)
        setAutomations((prev) =>
          prev.map((automation) =>
            automation.id === id
              ? { ...automation, isActive: next }
              : automation
          )
        )
      } catch (reason) {
        console.error("[wacrm] Toggle automation failed", reason)
        setError("We couldn't update this automation. Please try again.")
      }
    })
  }
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  function handleDelete(id: string) {
    setError(null)
    startTransition(async () => {
      try {
        await deleteAutomation(id)
        setConfirmDeleteId(null)
        setAutomations((prev) =>
          prev.filter((automation) => automation.id !== id)
        )
      } catch (reason) {
        console.error("[wacrm] Delete automation failed", reason)
        setError("We couldn't delete this automation. Please try again.")
      }
    })
  }

  if (loading)
    return (
      <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
        Loading…
      </p>
    )

  return (
    <div className="max-w-2xl">
      {error && (
        <div
          className="mb-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={loadAutomations}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}
      <PageHeader
        eyebrow="Workflow engine"
        title="Automations"
        description="Turn repeatable customer moments into thoughtful, reliable workflows."
        actions={
          canWrite && (
          <Button asChild size="lg">
            <Link href="/automations/new">New automation</Link>
          </Button>
          )
        }
      />

      <div className="mt-6 space-y-3">
        {automations.length === 0 && (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            No automations yet.
          </p>
        )}
        {automations.map((a) => (
          <div
            key={a.id}
            className="flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between"
            style={{
              background: "var(--paper-raised)",
              border: "1px solid var(--line)",
            }}
          >
            {canWrite ? (
            <Link href={`/automations/${a.id}/edit`} className="min-w-0">
              <p
                className="text-sm font-medium"
                style={{ color: "var(--ink)" }}
              >
                {a.name}
              </p>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--ink-soft)" }}
              >
                {TRIGGER_LABELS[a.triggerType]} · {a.steps.length} step
                {a.steps.length === 1 ? "" : "s"} · ran {a.executionCount}×
              </p>
            </Link>
            ) : (
              <div className="min-w-0">
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--ink)" }}
                >
                  {a.name}
                </p>
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {TRIGGER_LABELS[a.triggerType]} · {a.steps.length} step
                  {a.steps.length === 1 ? "" : "s"} · ran {a.executionCount}×
                </p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <Link
              href={`/automations/${a.id}/logs`}
              className="text-xs font-semibold"
              style={{ color: "var(--jade)" }}
            >
              Logs
            </Link>
            {canWrite && (
            <div className="flex shrink-0 items-center gap-3">
              <button
                onClick={() => handleToggle(a.id, !a.isActive)}
                disabled={isPending}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: a.isActive ? "var(--jade-soft)" : "var(--line)",
                  color: a.isActive ? "var(--jade-dark)" : "var(--ink-soft)",
                }}
              >
                {a.isActive ? "Active" : "Paused"}
              </button>
              <button
                onClick={() => setConfirmDeleteId(a.id)}
                disabled={isPending}
                className="text-xs"
                style={{ color: "var(--coral)" }}
              >
                Delete
              </button>
            </div>
            )}
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        title="Delete this automation?"
        description="This permanently deletes the automation and its configuration. This cannot be undone."
        confirmLabel="Delete automation"
      />
    </div>
  )
}
