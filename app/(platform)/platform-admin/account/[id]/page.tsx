"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { createColumnHelper } from "@tanstack/react-table"
import { use } from "react"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import {
  ArrowLeft,
  Ban,
  BadgeIndianRupee,
  Building2,
  CalendarClock,
  CheckCircle2,
  KeyRound,
  MessageCircle,
  Phone,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react"
import { DonutChart } from "@/components/charts/donut-chart"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ReusableDataTable } from "@/components/ui/data-table"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  getAccountDetail,
  getAccountPurchases,
  toggleAccountStatus,
  updateAccountQuota,
  deleteAccount,
} from "../../actions"

type Detail = Awaited<ReturnType<typeof getAccountDetail>>
type Purchase = Awaited<ReturnType<typeof getAccountPurchases>>[number]

const purchaseColumnHelper = createColumnHelper<Purchase>()

const FEATURE_COLORS: Record<string, string> = {
  INBOX: "var(--jade)",
  BROADCAST: "var(--brand-blue)",
  API: "var(--amber)",
  AUTOMATION: "var(--coral)",
}
const FEATURE_LABELS: Record<string, string> = {
  INBOX: "Inbox",
  BROADCAST: "Broadcasts",
  API: "API",
  AUTOMATION: "Automations",
}
const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  AGENT: "Agent",
  VIEWER: "Viewer",
}

function formatINR(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`
}

function validityLabel(months: number) {
  if (months <= 0) return "Lifetime"
  if (months === 12) return "1 year"
  if (months === 24) return "2 years"
  return `${months} months`
}

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [detail, setDetail] = useState<Detail>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quotaOpen, setQuotaOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        const [d, p] = await Promise.all([getAccountDetail(id), getAccountPurchases(id)])
        setDetail(d)
        setPurchases(p)
        setError(null)
      } catch (reason) {
        console.error("[platform] detail load failed", reason)
        setError("We couldn't load this account.")
      } finally {
        setLoading(false)
      }
    })
  }, [id])
  const purchaseColumns = useMemo(
    () => [
      purchaseColumnHelper.accessor("createdAt", {
        header: "Date",
        cell: (info) => <span className="text-xs" style={{ color: "var(--ink-soft)" }}>{new Date(info.getValue()).toLocaleString()}</span>,
      }),
      purchaseColumnHelper.accessor("quotaAfter", {
        header: "Quota",
        cell: (info) => {
          const row = info.row.original
          return (
            <span className="font-semibold" style={{ color: "var(--ink)" }}>
              {row.quotaAfter.toLocaleString()}
              {row.quotaBefore !== row.quotaAfter && (
                <span className="text-[11px] font-normal text-[var(--ink-soft)]"> (from {row.quotaBefore.toLocaleString()})</span>
              )}
            </span>
          )
        },
      }),
      purchaseColumnHelper.accessor("validityMonths", {
        header: "Validity",
        cell: (info) => {
          const row = info.row.original
          return (
            <div className="flex flex-wrap items-center gap-1">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}>
                <CalendarClock size={11} /> {validityLabel(row.validityMonths)}
              </span>
              {row.validUntil && (
                <span className="text-[11px] text-[var(--ink-soft)]">→ {new Date(row.validUntil).toLocaleDateString()}</span>
              )}
            </div>
          )
        },
      }),
      purchaseColumnHelper.accessor("amountPaid", {
        header: "Amount",
        cell: (info) => <span className="font-semibold" style={{ color: "var(--amber)" }}>{info.getValue() > 0 ? formatINR(info.getValue()) : "—"}</span>,
      }),
      purchaseColumnHelper.accessor("createdByEmail", {
        header: "By",
        cell: (info) => <span className="text-xs text-[var(--ink-soft)]">{info.row.original.createdByName ?? info.getValue() ?? "Platform Admin"}</span>,
      }),
      purchaseColumnHelper.accessor("note", {
        header: "Note",
        cell: (info) => <span className="max-w-[180px] truncate text-xs text-[var(--ink-soft)]">{info.getValue() ?? "—"}</span>,
      }),
    ],
    []
  )


  useEffect(() => {
    load()
  }, [load])

  if (loading && !detail) {
    return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="h-16 animate-pulse rounded-2xl" style={{ background: "var(--paper-raised)" }} />
    ))}</div>
  }
  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Account not found</p>
        <Link href="/platform-admin/accounts" className="mt-3 text-sm font-semibold" style={{ color: "var(--jade)" }}>
          Back to accounts
        </Link>
      </div>
    )
  }

  const pct = detail.quota > 0 ? Math.round((detail.used / detail.quota) * 100) : 0

  function runAction(fn: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await fn()
        const [d, p] = await Promise.all([getAccountDetail(id), getAccountPurchases(id)])
        setDetail(d)
        setPurchases(p)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Action failed")
      }
    })
  }

 return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/platform-admin/accounts" className="rounded-xl p-2 transition hover:bg-[var(--paper-raised)]" style={{ color: "var(--ink-soft)" }}>
            <ArrowLeft size={17} />
          </Link>
          <div>
            <p className="eyebrow">Account detail</p>
            <h1 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight">
              {detail.name}
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  background: detail.status === "SUSPENDED" ? "var(--coral-soft)" : "var(--jade-soft)",
                  color: detail.status === "SUSPENDED" ? "var(--coral)" : "var(--jade-dark)",
                }}
              >
                {detail.status}
              </span>
            </h1>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">{detail.id}</p>
          </div>
        </div>
        <button onClick={load} disabled={isPending} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
          <RefreshCw size={14} className={isPending ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>{error}</div>}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <StatCard icon={<MessageCircle size={18} />} label="Messages used" value={detail.used.toLocaleString()} color="var(--jade)" />
        <StatCard icon={<KeyRound size={18} />} label="Quota" value={detail.quota.toLocaleString()} color="var(--brand-blue)" />
        <StatCard icon={<ShieldCheck size={18} />} label="Remaining" value={detail.remaining.toLocaleString()} color={detail.remaining === 0 ? "var(--coral)" : "var(--jade-dark)"} />
        <StatCard icon={<BadgeIndianRupee size={18} />} label="Total paid" value={formatINR(detail.totalPaid)} color="var(--amber)" />
        <StatCard icon={<ReceiptText size={18} />} label="Purchases" value={String(detail.purchaseCount)} color="var(--brand-blue-light)" />
        <StatCard icon={<UsersRound size={18} />} label="Members" value={String(detail.members.length)} color="var(--jade)" />
        <StatCard icon={<Building2 size={18} />} label="Contacts" value={detail.counts.contacts.toLocaleString()} color="var(--amber)" />
      </div>

      {/* Quota + WhatsApp */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl p-5 shadow-sm ring-1 ring-black/5 lg:col-span-2" style={{ background: "var(--paper-raised)" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Message quota</h2>
            <button onClick={() => setQuotaOpen(true)} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--jade)", color: "white" }}>
              Adjust quota / record payment
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="shrink-0 self-center lg:self-auto">
              <DonutChart
                data={[
                  { label: "Used", count: detail.used, color: "var(--jade)" },
                  { label: "Remaining", count: detail.remaining, color: "var(--line)" },
                ]}
                centerLabel="used"
                centerValue={`${pct}%`}
              />
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              <Row label="Plan" value={detail.planType} />
              <Row label="Lifetime quota" value={detail.quota.toLocaleString()} />
              <Row label="Messages used" value={detail.used.toLocaleString()} />
              <Row label="Remaining" value={detail.remaining.toLocaleString()} />
              <Row
                label="Valid until"
                value={
                  detail.quotaValidUntil
                    ? new Date(detail.quotaValidUntil).toLocaleDateString()
                    : "Lifetime / no expiry"
                }
              />
              <Row label="Created" value={new Date(detail.createdAt).toLocaleString()} />
              {detail.adminNotes && (
                <div className="sm:col-span-2">
                  <Row label="Admin notes" value={detail.adminNotes} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-5 shadow-sm ring-1 ring-black/5" style={{ background: "var(--paper-raised)" }}>
          <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--ink)" }}>
            <Phone size={15} /> WhatsApp
          </h2>
          {detail.whatsapp ? (
            <div className="mt-4 space-y-2 text-sm">
              <Row label="Status" value={detail.whatsapp.status} />
              <Row label="Phone ID" value={detail.whatsapp.phoneNumberId} />
              <Row label="WABA ID" value={detail.whatsapp.wabaId ?? "—"} />
              <Row label="Connected" value={detail.whatsapp.connectedAt ? new Date(detail.whatsapp.connectedAt).toLocaleDateString() : "Never"} />
              {detail.whatsapp.lastRegistrationError && (
                <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>
                  {detail.whatsapp.lastRegistrationError}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--ink-soft)]">No WhatsApp connection configured.</p>
          )}
        </div>
      </div>

      {/* Quota ledger */}
      <div className="rounded-2xl p-5 shadow-sm ring-1 ring-black/5" style={{ background: "var(--paper-raised)" }}>
        <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--ink)" }}>
          <ReceiptText size={16} /> Quota ledger / payments
        </h2>
        <div className="mt-3">
          <ReusableDataTable
            data={purchases}
            columns={purchaseColumns}
            searchPlaceholder="Search by note or recorded by…"
            searchableColumns={["note", "createdByName", "createdByEmail"]}
            enableExport
            exportFileName="quota-payments.csv"
            enableColumnVisibility
            enableRowSelection={false}
            defaultPageSize={10}
            pageSizeOptions={[10, 20, 50, 100]}
            emptyStateMessage="No quota purchases recorded yet."
            emptyStateDescription="Adjust the quota and record a payment to add ledger entries."
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl p-5 shadow-sm ring-1 ring-black/5" style={{ background: "var(--paper-raised)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Usage by feature</h2>
          <div className="mt-4">
            <DonutChart
              data={(detail.usageByFeature.length ? detail.usageByFeature : []).map((f) => ({
                label: FEATURE_LABELS[f.feature] ?? f.feature,
                count: f.count,
                color: FEATURE_COLORS[f.feature] ?? "var(--ink-soft)",
              }))}
              centerLabel="messages"
              centerValue={String(detail.usageByFeature.reduce((s, f) => s + f.count, 0))}
            />
          </div>
        </div>

        <div className="rounded-2xl p-5 shadow-sm ring-1 ring-black/5" style={{ background: "var(--paper-raised)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Members</h2>
          <div className="mt-4 space-y-2">
            {detail.members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--paper)" }}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--jade)" }}>
                  {(m.name ?? m.email)[0]?.toUpperCase() ?? "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium" style={{ color: "var(--ink)" }}>{m.name ?? "Unnamed"}</p>
                  <p className="truncate text-[11px] text-[var(--ink-soft)]">{m.email}</p>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}>
                  {ROLE_LABELS[m.role] ?? m.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent usage */}
      <div className="rounded-2xl p-5 shadow-sm ring-1 ring-black/5" style={{ background: "var(--paper-raised)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Recent message activity</h2>
        <div className="mt-3 space-y-2">
          {detail.recentUsage.length === 0 && <p className="text-sm text-[var(--ink-soft)]">No message activity yet.</p>}
          {detail.recentUsage.map((row) => (
            <div key={row.id} className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs" style={{ background: "var(--paper)" }}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: FEATURE_COLORS[row.feature] ?? "var(--jade)" }} />
              <span className="font-medium" style={{ color: "var(--ink)" }}>{FEATURE_LABELS[row.feature] ?? row.feature}</span>
              <span className="text-[var(--ink-soft)]">{row.count} msg</span>
              <span className="ml-auto text-[var(--ink-soft)]">{new Date(row.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="flex flex-wrap gap-2 rounded-2xl border p-4" style={{ borderColor: "var(--coral-soft)", background: "var(--coral-soft)" }}>
        <span className="text-sm font-semibold" style={{ color: "var(--coral)" }}>Account control</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => runAction(() => toggleAccountStatus(detail.id, detail.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED"))} disabled={isPending}>
            {detail.status === "SUSPENDED" ? <><CheckCircle2 size={15} /> Activate</> : <><Ban size={15} /> Suspend</>}
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={15} /> Delete account
          </Button>
        </div>
      </div>

      {quotaOpen && (
        <QuotaModal
          currentQuota={detail.quota}
          isPending={isPending}
          onCancel={() => setQuotaOpen(false)}
          onSave={(input) =>
            runAction(async () => {
              await updateAccountQuota(detail.id, input)
              setQuotaOpen(false)
            })
          }
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={() => {
          runAction(async () => {
            await deleteAccount(detail.id)
            router.push("/platform-admin/accounts")
          })
        }}
        title={`Delete "${detail.name}"?`}
        description="This permanently deletes the account and ALL of its data — contacts, conversations, messages, quotas, and settings. This cannot be undone."
        confirmLabel="Delete account"
      />
    </div>
  )
}

function QuotaModal({
  currentQuota,
  isPending,
  onCancel,
  onSave,
}: {
  currentQuota: number
  isPending: boolean
  onCancel: () => void
  onSave: (input: {
    quota: number
    amountPaid: number
    validityMonths: number
    validUntil?: Date | string | null
    note?: string
  }) => void
}) {
  const [quota, setQuota] = useState(String(currentQuota))
  const [amountPaid, setAmountPaid] = useState("")
  // validityMode: "preset" uses fixed durations; "customMonths" uses a custom
  // number of months; "customDate" uses an explicit expiry date range.
  const [validityMode, setValidityMode] = useState<"preset" | "customMonths" | "customDate">("preset")
  const [presetMonths, setPresetMonths] = useState("12")
  const [customMonths, setCustomMonths] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [note, setNote] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  // Quick preset chips for quota and validity.
  const QUOTA_PRESETS = [3000, 50000, 300000, 3000000]
  const VALIDITY_PRESETS = [
    { label: "1 year", months: "12" },
    { label: "2 years", months: "24" },
    { label: "3 years", months: "36" },
    { label: "6 months", months: "6" },
    { label: "Lifetime", months: "0" },
  ]

  function resolveValidity(): { validityMonths: number; validUntil: string | null } {
    if (validityMode === "preset") {
      return { validityMonths: Number(presetMonths) || 0, validUntil: null }
    }
    if (validityMode === "customMonths") {
      return { validityMonths: Math.max(0, Math.floor(Number(customMonths) || 0)), validUntil: null }
    }
    // customDate
    return { validityMonths: 0, validUntil: customEnd ? `${customEnd}T23:59:59` : null }
  }

  // Resolve the display label once at save time to avoid Date.now() during
  // render (kept pure for the React compiler). Actual expiry is computed in the
  // server action from validityMonths/validUntil.
  function validityPreview(): string {
    if (validityMode === "preset") {
      const m = Number(presetMonths) || 0
      if (m === 0) return "Lifetime"
      if (m === 12) return "1 year"
      if (m === 24) return "2 years"
      if (m === 36) return "3 years"
      return `${m} months`
    }
    if (validityMode === "customMonths") {
      const m = Math.max(0, Math.floor(Number(customMonths) || 0))
      return m === 0 ? "Lifetime" : `${m} months`
    }
    return customEnd ? `Until ${new Date(customEnd + "T00:00:00").toLocaleDateString()}` : "Lifetime"
  }
  const resolvedLabel = validityPreview()

  function handleSave() {
    setFormError(null)

    if (!quota || Number(quota) < 0) {
      setFormError("Enter a valid message quota (0 or higher).")
      return
    }
    if (validityMode === "customDate") {
      if (!customEnd) {
        setFormError("Choose an expiry date, or switch to Lifetime.")
        return
      }
      // Compare at end-of-day so a valid future date isn't rejected.
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      if (new Date(customEnd).getTime() <= todayStart.getTime()) {
        setFormError(
          "That expiry date is in the past. Choose today or a future date."
        )
        return
      }
    }
    if (validityMode === "customMonths" && Number(customMonths) <= 0) {
      setFormError("Enter a positive number of months, or use Lifetime.")
      return
    }

    const r = resolveValidity()
    onSave({
      quota: Number(quota) || 0,
      amountPaid: Number(amountPaid) || 0,
      validityMonths: r.validityMonths,
      validUntil: r.validUntil,
      note: note.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-2xl ring-1 ring-black/5" style={{ background: "var(--paper-raised)" }} role="dialog" aria-modal="true">
        <p className="eyebrow">Manual quota</p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-medium">Adjust quota &amp; record payment</h2>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Set the new lifetime quota and log how much the customer paid and for how long it&apos;s valid.
        </p>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--ink)" }}>New lifetime quota</span>
            <Input type="number" min={0} value={quota} onChange={(e) => setQuota(e.target.value)} placeholder="e.g. 3000000" data-autofocus className="font-[family-name:var(--font-code)]" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUOTA_PRESETS.map((n) => (
                <button key={n} type="button" onClick={() => setQuota(String(n))} className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--paper)", color: "var(--ink-soft)" }}>
                  {n.toLocaleString()}
                </button>
              ))}
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--ink)" }}>Amount paid (₹)</span>
              <Input type="number" min={0} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="e.g. 4999" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--ink)" }}>Validity type</span>
              <Select value={validityMode} onValueChange={(value) => setValidityMode(value as typeof validityMode)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[80]">
                  <SelectItem value="preset">Preset duration</SelectItem>
                  <SelectItem value="customMonths">Custom months</SelectItem>
                  <SelectItem value="customDate">Custom date range</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>

          {validityMode === "preset" && (
            <div>
              <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--ink)" }}>Duration</span>
              <div className="flex flex-wrap gap-1.5">
                {VALIDITY_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setPresetMonths(p.months)}
                    className="rounded-full px-3 py-1.5 text-[11px] font-semibold transition"
                    style={{
                      background: presetMonths === p.months ? "var(--jade)" : "var(--paper)",
                      color: presetMonths === p.months ? "white" : "var(--ink-soft)",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {validityMode === "customMonths" && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--ink)" }}>Duration (months)</span>
              <Input type="number" min={0} value={customMonths} onChange={(e) => setCustomMonths(e.target.value)} placeholder="e.g. 18" />
            </label>
          )}

          {validityMode === "customDate" && (
            <div className="space-y-3">
              <div>
                <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--ink)" }}>Expiry date</span>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
              </div>
              <p className="text-[11px] text-[var(--ink-soft)]">
                The plan is valid from today until the chosen expiry date.
              </p>
            </div>
          )}

          <div className="rounded-xl px-3 py-2 text-xs font-medium" style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}>
            Selected: {resolvedLabel}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--ink)" }}>Note (optional)</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. annual renewal, promo discount" />
          </label>
        </div>
        {formError && (
          <div role="alert" className="mt-4 rounded-xl px-3.5 py-3 text-sm" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>
            {formError}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2 border-t pt-4" style={{ borderColor: "var(--line)" }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button disabled={isPending} onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="min-w-0 rounded-2xl p-4 shadow-sm ring-1 ring-black/5" style={{ background: "var(--paper-raised)" }}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `color-mix(in_oklch, ${color} 14%, transparent)`, color }}>{icon}</span>
      <p className="mt-4 truncate font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight" style={{ color: "var(--ink)" }}>{value}</p>
      <p className="mt-1 text-[11px] font-semibold tracking-wide text-[var(--ink-soft)] uppercase">{label}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="shrink-0 text-xs text-[var(--ink-soft)]">{label}</span>
      <span className="min-w-0 truncate text-xs font-medium text-right" style={{ color: "var(--ink)" }}>{value}</span>
    </div>
  )
}
