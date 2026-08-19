"use client"

import {
  CheckCircle2,
  Eye,
  Megaphone,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UsersRound,
  X,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/page-header"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getBroadcasts, getBroadcastRecipients, deleteBroadcast } from "./actions"
import { useRole } from "@/components/role-context"

type Broadcast = Awaited<ReturnType<typeof getBroadcasts>>[number]

export default function BroadcastsPage() {
  const { canWrite } = useRole()
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      setBroadcasts(await getBroadcasts())
      setError(null)
    } catch (reason) {
      console.error("[wacrm] Broadcasts load failed", reason)
      setError("We couldn't load your broadcasts. Please try again.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const task = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(task)
  }, [refresh])

  useEffect(() => {
    const sending = broadcasts.some((b) => b.status === "SENDING")
    if (!sending) return
    const timer = window.setInterval(() => void refresh(), 4000)
    return () => window.clearInterval(timer)
  }, [broadcasts, refresh])

  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [receiptDetail, setReceiptDetail] = useState<{
    id: string
    name: string
    failed: number
    seen: number
    total: number
    recipients: Awaited<ReturnType<typeof getBroadcastRecipients>>
    tab: "seen" | "unseen" | "all"
  } | null>(null)
  const [receiptsLoading, setReceiptsLoading] = useState(false)

  function openReceipts(broadcast: Broadcast, tab: "seen" | "unseen" | "all" = "all") {
    setReceiptsLoading(true)
    setReceiptDetail({
      id: broadcast.id,
      name: broadcast.name,
      failed: broadcast.failedCount,
      seen: broadcast.readCount,
      total: broadcast.totalRecipients,
      recipients: null,
      tab,
    })
    getBroadcastRecipients(broadcast.id)
      .then((recipients) =>
        setReceiptDetail((prev) =>
          prev && prev.id === broadcast.id ? { ...prev, recipients } : prev
        )
      )
      .catch(() => setReceiptsLoading(false))
      .finally(() => setReceiptsLoading(false))
  }

  function handleDelete(id: string) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await deleteBroadcast(id)
        if (result.error) {
          setError(result.error)
          setConfirmDelete(null)
          return
        }
        setConfirmDelete(null)
        await refresh()
      } catch (reason) {
        console.error("[wacrm] Broadcast delete failed", reason)
        setError("We couldn't delete this broadcast. Please try again.")
      }
    })
  }

  const stats = useMemo(
    () => ({
      total: broadcasts.length,
      recipients: broadcasts.reduce(
        (sum, broadcast) => sum + broadcast.totalRecipients,
        0
      ),
      sent: broadcasts.reduce((sum, broadcast) => sum + broadcast.sentCount, 0),
    }),
    [broadcasts]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return broadcasts
    return broadcasts.filter((b) =>
      [b.name, b.templateName, b.status].some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      )
    )
  }, [broadcasts, query])

  if (loading) return <BroadcastSkeleton />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reach your audience"
        title="Broadcasts"
        description="Send approved WhatsApp templates to the right customers with confidence."
        actions={
          canWrite && (
          <Button asChild size="lg">
            <Link href="/broadcasts/new">
              <Plus size={16} /> New broadcast
            </Link>
          </Button>
          )
        }
      />

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={<Megaphone size={17} />}
          label="Campaigns"
          value={stats.total}
        />
        <Stat
          icon={<UsersRound size={17} />}
          label="Recipients"
          value={stats.recipients}
        />
        <Stat
          icon={<Send size={17} />}
          label="Messages sent"
          value={stats.sent}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--ink-soft)]"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, template, or status…"
            aria-label="Search broadcasts"
            className="pl-9"
          />
        </div>
        <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
          {refreshing && (
            <RefreshCw size={13} className="mr-1 inline animate-spin" />
          )}
          {filtered.length
            ? `${filtered.length} campaign${filtered.length === 1 ? "" : "s"}`
            : "Your campaign history"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: "var(--jade-soft)",
              color: "var(--jade-dark)",
            }}
          >
            <Megaphone size={24} />
          </span>
          <h2 className="mt-5 font-[family-name:var(--font-display)] text-xl font-medium">
            No broadcasts yet
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--ink-soft)]">
            Create a campaign from an approved template and keep your customers
            in the loop.
          </p>
          {canWrite && (
            <Button className="mt-6" asChild>
              <Link href="/broadcasts/new">
                <Plus size={16} /> Create your first campaign
              </Link>
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((broadcast) => (
            <BroadcastCard
              key={broadcast.id}
              broadcast={broadcast}
              canWrite={canWrite}
              onDelete={() => setConfirmDelete({ id: broadcast.id, name: broadcast.name })}
              onViewReceipts={(tab) => openReceipts(broadcast, tab)}
            />
          ))}
        </div>
      )}

      {receiptDetail && (
        <SeenPopup
          detail={receiptDetail}
          loading={receiptsLoading}
          onTabChange={(tab) =>
            setReceiptDetail((prev) => (prev ? { ...prev, tab } : prev))
          }
          onClose={() => setReceiptDetail(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete.id)}
        title={`Delete "${confirmDelete?.name}"?`}
        description="This permanently deletes this broadcast and cannot be undone."
        confirmLabel="Delete broadcast"
      />
    </div>
  )
}

function BroadcastCard({
  broadcast,
  canWrite,
  onDelete,
  onViewReceipts,
}: {
  broadcast: Broadcast
  canWrite: boolean
  onDelete: () => void
  onViewReceipts: (tab: "seen" | "unseen" | "all") => void
}) {
  const failed = broadcast.failedCount > 0
  return (
    <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className="truncate text-sm font-semibold"
              style={{ color: "var(--ink)" }}
            >
              {broadcast.name}
            </p>
            <StatusBadge status={broadcast.status} />
          </div>
          <p
            className="mt-1 flex items-center gap-1.5 truncate text-xs text-[var(--ink-soft)]"
          >
            <MessageSquareText size={12} />
            {broadcast.templateName} · {broadcast.templateLanguage}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-[family-name:var(--font-code)] text-[11px] text-[var(--ink-soft)]">
            {formatDate(broadcast.createdAt)}
          </span>
          {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 size={15} /> Delete broadcast
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metric label="Recipients" value={broadcast.totalRecipients} />
        <Metric
          label="Sent"
          value={broadcast.sentCount}
          color="var(--jade-dark)"
          icon={<Send size={13} />}
        />
        <Metric
          label="Delivered"
          value={broadcast.deliveredCount}
          color="var(--jade-dark)"
          icon={<CheckCircle2 size={13} />}
        />
        <button type="button" className="text-left" onClick={() => onViewReceipts("seen")}>
          <Metric
            label="Seen"
            value={broadcast.readCount}
            color="var(--jade-dark)"
            icon={<Eye size={13} />}
          />
        </button>
        <Metric
          label="Failed"
          value={broadcast.failedCount}
          color={failed ? "var(--coral)" : "var(--ink-soft)"}
          icon={<XCircle size={13} />}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onViewReceipts("seen")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: "var(--jade-dark)" }}
        >
          <Eye size={13} /> Who has seen
        </button>
        <button
          type="button"
          onClick={() => onViewReceipts("unseen")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: "var(--ink-soft)" }}
        >
          Who has not seen
        </button>
      </div>
    </Card>
  )
}

function Metric({
  label,
  value,
  color = "var(--ink)",
  icon,
}: {
  label: string
  value: number
  color?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--paper)" }}>
      <p className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.08em] text-[var(--ink-soft)] uppercase">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <Card className="p-4">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-xl"
        style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}
      >
        {icon}
      </span>
      <p
        className="mt-3 text-[11px] font-semibold tracking-[0.08em] uppercase"
        style={{ color: "var(--ink-soft)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 font-[family-name:var(--font-display)] text-2xl font-medium"
        style={{ color: "var(--ink)" }}
      >
        {value}
      </p>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: "var(--line)",
    SENDING: "var(--amber-soft)",
    SENT: "var(--jade-soft)",
    FAILED: "var(--coral-soft)",
  }
  const textColors: Record<string, string> = {
    DRAFT: "var(--ink-soft)",
    SENDING: "var(--amber)",
    SENT: "var(--jade-dark)",
    FAILED: "var(--coral)",
  }
  return (
    <Badge
      style={{
        background: colors[status] ?? "var(--line)",
        color: textColors[status] ?? "var(--ink-soft)",
        border: "none",
      }}
    >
      {status}
    </Badge>
  )
}

function BroadcastSkeleton() {
  return (
    <div className="space-y-5">
      <div
        className="h-10 w-64 animate-pulse rounded-xl"
        style={{ background: "var(--line)" }}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-2xl"
            style={{ background: "var(--paper-raised)" }}
          />
        ))}
      </div>
      <div
        className="h-36 animate-pulse rounded-2xl"
        style={{ background: "var(--paper-raised)" }}
      />
    </div>
  )
}
function SeenPopup({
  detail,
  loading,
  onTabChange,
  onClose,
}: {
  detail: {
    name: string
    failed: number
    seen: number
    total: number
    tab: "seen" | "unseen" | "all"
    recipients: Awaited<ReturnType<typeof getBroadcastRecipients>>
  }
  loading: boolean
  onTabChange: (tab: "seen" | "unseen" | "all") => void
  onClose: () => void
}) {
  const rows = detail.recipients ?? []
  const seenRows = rows.filter(
    (r) => r.status === "READ" || r.status === "REPLIED" || Boolean(r.readAt)
  )
  const unseenRows = rows.filter(
    (r) => !(r.status === "READ" || r.status === "REPLIED" || Boolean(r.readAt))
  )
  const list =
    detail.tab === "seen" ? seenRows : detail.tab === "unseen" ? unseenRows : rows

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="max-h-[min(760px,92svh)] w-full max-w-2xl overflow-y-auto rounded-2xl p-6 shadow-2xl ring-1 ring-black/5"
        style={{ background: "var(--paper-raised)" }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Read receipts</p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-medium tracking-tight">
              {detail.name}
            </h2>
            <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
              {seenRows.length} seen · {unseenRows.length} not seen · {detail.total} total
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-[var(--paper)]"
            style={{ color: "var(--ink-soft)" }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["seen", `Seen (${seenRows.length})`],
              ["unseen", `Not seen (${unseenRows.length})`],
              ["all", `All (${rows.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: detail.tab === id ? "var(--jade)" : "var(--paper)",
                color: detail.tab === id ? "white" : "var(--ink-soft)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-[var(--ink-soft)]">
              <RefreshCw size={15} className="animate-spin" /> Loading recipients…
            </div>
          ) : (
            <div className="space-y-2">
              {list.map((r) => {
                const seen =
                  Boolean(r.readAt) || r.status === "READ" || r.status === "REPLIED"
                const failedRow = r.status === "FAILED"
                return (
                  <div
                    key={r.id}
                    className="rounded-xl px-3.5 py-2.5"
                    style={{
                      background: failedRow
                        ? "var(--coral-soft)"
                        : seen
                          ? "var(--jade-soft)"
                          : "var(--paper)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold" style={{ color: "var(--ink)" }}>
                        {r.contactName || r.contactPhone || "Unknown contact"}
                      </p>
                      <span className="text-[10px] font-semibold uppercase" style={{ color: "var(--ink-soft)" }}>
                        {seen ? "Seen" : r.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                      {r.contactPhone}
                      {r.readAt
                        ? ` · seen ${new Date(r.readAt).toLocaleString()}`
                        : r.deliveredAt
                          ? ` · delivered ${new Date(r.deliveredAt).toLocaleString()}`
                          : r.sentAt
                            ? ` · sent ${new Date(r.sentAt).toLocaleString()}`
                            : ""}
                    </p>
                    {r.errorMessage && (
                      <p className="mt-1 break-words text-xs" style={{ color: "var(--coral)" }}>
                        {r.errorMessage}
                      </p>
                    )}
                  </div>
                )
              })}
              {list.length === 0 && (
                <p className="py-8 text-center text-sm text-[var(--ink-soft)]">
                  {detail.tab === "seen"
                    ? "No one has seen this broadcast yet."
                    : detail.tab === "unseen"
                      ? "Everyone on this list has seen it."
                      : "No recipients yet."}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}
