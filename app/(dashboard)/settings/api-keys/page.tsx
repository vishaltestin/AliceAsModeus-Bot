"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { PageHeader } from "@/components/ui/page-header"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useEffect, useState, useTransition } from "react"
import { getApiKeys, createApiKey, revokeApiKey } from "./actions"
import { formatRelativeTime } from "@/lib/format"
import { ApiReference } from "./api-reference"

const SCOPES = [
  {
    value: "messages:send",
    label: "messages:send",
    desc: "Send WhatsApp messages",
  },
  {
    value: "messages:read",
    label: "messages:read",
    desc: "Read messages and their delivery status",
  },
  {
    value: "contacts:read",
    label: "contacts:read",
    desc: "List and read contacts",
  },
  {
    value: "contacts:write",
    label: "contacts:write",
    desc: "Create and update contacts",
  },
  {
    value: "conversations:read",
    label: "conversations:read",
    desc: "List and read conversations",
  },
  {
    value: "broadcasts:send",
    label: "broadcasts:send",
    desc: "Launch broadcast campaigns",
  },
]

const card = {
  background: "var(--paper-raised)",
  border: "1px solid var(--line)",
}
export default function ApiKeysPage() {
  const [keys, setKeys] = useState<Awaited<ReturnType<typeof getApiKeys>>>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState("")
  const [scopes, setScopes] = useState<Set<string>>(new Set())
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null)

  async function refresh() {
    try {
      setKeys(await getApiKeys())
      setPageError(null)
    } catch (reason) {
      console.error("[wacrm] API keys load failed", reason)
      setPageError("We couldn't load API keys. Please try again.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    const task = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(task)
  }, [])

  function toggleScope(v: string) {
    setScopes((prev) => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })
  }

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await createApiKey(name, Array.from(scopes))
        if (result.error) {
          setError(result.error)
          return
        }
        if (typeof result.plaintext !== "string") {
          setError("The new API key was not returned. Please try again.")
          return
        }
        setCreatedKey(result.plaintext)
        await refresh()
      } catch (reason) {
        console.error("[wacrm] Create API key failed", reason)
        setError("We couldn't create this API key. Please try again.")
      }
    })
  }

  function closeModal() {
    setModalOpen(false)
    setName("")
    setScopes(new Set())
    setCreatedKey(null)
    setError(null)
  }

  if (loading) {
    return (
      <div className="max-w-2xl animate-pulse space-y-4">
        <div
          className="h-9 w-40 rounded-xl"
          style={{ background: "var(--line)" }}
        />
        <div
          className="h-5 w-96 max-w-full rounded"
          style={{ background: "var(--paper)" }}
        />
        <div
          className="h-28 rounded-2xl"
          style={{ background: "var(--paper-raised)" }}
        />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {pageError && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
        >
          <span>{pageError}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}
      <PageHeader
        eyebrow="Developer access"
        title="API keys"
        description={
          <>
            Keys authenticate the public REST API. Send them as{" "}
            <span className="font-[family-name:var(--font-code)]">
              Authorization: Bearer &lt;key&gt;
            </span>
            .
          </>
        }
        actions={
          <Button size="lg" onClick={() => setModalOpen(true)}>
            New API key
          </Button>
        }
      />

      <div className="space-y-3">
        {keys.map((k) => (
          <div
            key={k.id}
            className="flex items-center justify-between rounded-xl p-4"
            style={card}
          >
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--ink)" }}
              >
                {k.name}
              </p>
              <p
                className="mt-0.5 font-[family-name:var(--font-code)] text-xs"
                style={{ color: "var(--ink-soft)" }}
              >
                {k.keyPrefix}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(k.scopes as string[]).map((s) => (
                  <span
                    key={s}
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{
                      background: "var(--line)",
                      color: "var(--ink-soft)",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs" style={{ color: "var(--ink-soft)" }}>
                Created {formatRelativeTime(k.createdAt)} ·{" "}
                {k.lastUsedAt
                  ? `used ${formatRelativeTime(k.lastUsedAt)}`
                  : "never used"}
              </p>
            </div>
            <button
              onClick={() => setConfirmRevokeId(k.id)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{
                color: "var(--coral)",
                border: "1px solid var(--coral)",
              }}
            >
              Revoke
            </button>
          </div>
        ))}
        {keys.length === 0 && (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            No API keys yet.
          </p>
        )}
      </div>

      <ApiReference />

      <ConfirmDialog
        open={confirmRevokeId !== null}
        onOpenChange={(open) => !open && setConfirmRevokeId(null)}
        onConfirm={() => {
          if (!confirmRevokeId) return
          startTransition(async () => {
            try {
              await revokeApiKey(confirmRevokeId)
              setConfirmRevokeId(null)
              await refresh()
            } catch (reason) {
              console.error("[wacrm] Revoke API key failed", reason)
              setPageError(
                "We couldn't revoke this API key. Please try again."
              )
            }
          })
        }}
        title="Revoke this API key?"
        description="This permanently invalidates the key. Any integration using it will stop working. This cannot be undone."
        confirmLabel="Revoke key"
      />

      <Modal
        open={modalOpen}
        onClose={closeModal}
        eyebrow="Developer access"
        title={createdKey ? "Key created" : "New API key"}
        description={
          createdKey
            ? "Copy this key now. It will not be shown again."
            : "Name the integration and grant only the scopes it needs."
        }
        size="md"
      >
        <div className="space-y-4">
          {!createdKey ? (
            <>
              <h2
                className="text-lg font-medium"
                style={{ color: "var(--ink)" }}
              >
                New API key
              </h2>
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                Name it after the integration that will use it, and grant only
                the scopes it needs.
              </p>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Zapier automation"
                aria-label="API key name"
                data-autofocus
              />
              <div
                className="rounded-lg p-1"
                style={{ border: "1px solid var(--line)" }}
              >
                {SCOPES.map((s) => (
                  <label
                    key={s.value}
                    className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={scopes.has(s.value)}
                      onChange={() => toggleScope(s.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p style={{ color: "var(--ink)" }}>{s.label}</p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--ink-soft)" }}
                      >
                        {s.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                A key with no scopes can still call GET /api/v1/me to verify it
                works.
              </p>
              {error && (
                <p
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: "var(--coral-soft)",
                    color: "var(--coral)",
                  }}
                >
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={closeModal}
                  className="rounded-lg px-4 py-2 text-sm"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isPending || !name.trim()}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  style={{ background: "var(--jade)" }}
                >
                  {isPending ? "Creating…" : "Create key"}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2
                className="text-lg font-medium"
                style={{ color: "var(--ink)" }}
              >
                Key created
              </h2>
              <p
                className="mt-2 rounded-lg px-3 py-2 text-sm"
                style={{
                  background: "var(--amber-soft)",
                  color: "var(--amber)",
                }}
              >
                Copy this now — you won&apos;t be able to see it again.
              </p>
              <div
                className="mt-4 rounded-xl border p-3"
                style={{ borderColor: "var(--line)", background: "var(--paper)" }}
              >
                <p
                  className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-[var(--ink-soft)] uppercase"
                >
                  Your API key
                </p>
                <Input
                  readOnly
                  value={createdKey ?? ""}
                  onFocus={(e) => e.target.select()}
                  className="font-[family-name:var(--font-code)] text-xs"
                  aria-label="Created API key"
                />
              </div>
              <button
                onClick={closeModal}
                className="mt-4 w-full rounded-lg py-2 text-sm font-medium text-white"
                style={{ background: "var(--jade)" }}
              >
                Done
              </button>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
