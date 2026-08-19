"use client"

import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import {
  CalendarClock,
  Download,
  RefreshCw,
  ReceiptText,
  BadgeIndianRupee,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { ReusableDataTable } from "@/components/ui/data-table"
import { listAllPurchases } from "../actions"

type Row = Awaited<ReturnType<typeof listAllPurchases>>[number]

const columnHelper = createColumnHelper<Row>()

function formatINR(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`
}
function validityLabel(months: number) {
  if (months <= 0) return "Lifetime"
  if (months === 12) return "1 year"
  if (months === 24) return "2 years"
  return `${months} months`
}

export default function LedgerPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const load = useCallback((term?: string) => {
    startTransition(async () => {
      try {
        setRows(await listAllPurchases({ search: term }))
        setError(null)
      } catch (reason) {
        console.error("[platform] ledger load failed", reason)
        setError("We couldn't load the ledger.")
      } finally {
        setLoading(false)
      }
    })
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns = useMemo(
    () => [
      columnHelper.accessor("createdAt", {
        header: "Date",
        cell: (info) => <span className="text-xs" style={{ color: "var(--ink-soft)" }}>{new Date(info.getValue()).toLocaleString()}</span>,
      }),
      columnHelper.accessor("accountName", {
        header: "Account",
        cell: (info) => {
          const row = info.row.original
          return (
            <Link href={`/platform-admin/account/${row.accountId}`} className="font-medium hover:underline" style={{ color: "var(--jade-dark)" }}>
              {row.accountName}
            </Link>
          )
        },
      }),
      columnHelper.accessor("quotaAfter", {
        header: "Quota",
        cell: (info) => {
          const row = info.row.original
          return (
            <span className="font-semibold" style={{ color: "var(--ink)" }}>
              {row.quotaAfter.toLocaleString()}
              {row.quotaBefore !== row.quotaAfter && (
                <span className="text-[11px] font-normal text-[var(--ink-soft)]"> (was {row.quotaBefore.toLocaleString()})</span>
              )}
            </span>
          )
        },
      }),
      columnHelper.accessor("amountPaid", {
        header: "Amount",
        cell: (info) => <span className="font-semibold" style={{ color: "var(--amber)" }}>{info.getValue() > 0 ? formatINR(info.getValue()) : "—"}</span>,
      }),
      columnHelper.accessor("validityMonths", {
        header: "Validity",
        cell: (info) => {
          const row = info.row.original
          return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}>
              <CalendarClock size={11} /> {validityLabel(row.validityMonths)}
            </span>
          )
        },
      }),
      columnHelper.accessor("note", {
        header: "Note",
        cell: (info) => <span className="max-w-[180px] truncate text-xs text-[var(--ink-soft)]">{info.getValue() ?? "—"}</span>,
      }),
      columnHelper.accessor("createdByEmail", {
        header: "Recorded by",
        cell: (info) => <span className="text-xs text-[var(--ink-soft)]">{info.row.original.createdByName ?? info.getValue() ?? "Platform Admin"}</span>,
      }),
    ],
    []
  )

  const totalRevenue = rows.reduce((s, r) => s + r.amountPaid, 0)
  const totalPurchases = rows.length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Billing &amp; quota</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight">Ledger</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Every quota purchase and payment across all customer accounts.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<ReceiptText size={17} />} label="Total purchases" value={totalPurchases.toLocaleString()} color="var(--brand-blue)" />
        <SummaryCard icon={<BadgeIndianRupee size={17} />} label="Total collected" value={formatINR(totalRevenue)} color="var(--amber)" />
        <SummaryCard icon={<RefreshCw size={17} />} label="Refresh" value="manual" color="var(--jade)" clickable onClick={() => { setLoading(true); load() }} />
      </div>

      {error && <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>{error}</div>}

      {loading ? (
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--line)" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: "var(--paper)" }} />
          ))}
        </div>
      ) : (
        <ReusableDataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search by account, note, or recorded by…"
          searchableColumns={["accountName", "note", "createdByName", "createdByEmail"]}
          enableExport
          exportFileName="quota-ledger.csv"
          defaultPageSize={10}
          pageSizeOptions={[10, 20, 50, 100]}
          enableColumnVisibility
          enableRowSelection
          emptyStateMessage="No ledger entries"
          emptyStateDescription="Quota adjustments and payments will appear here."
          toolbarActions={
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
              style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
            >
              <Download size={13} /> {rows.length} entries
            </a>
          }
        />
      )}
    </div>
  )
}

function SummaryCard({ icon, label, value, color, clickable, onClick }: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
  clickable?: boolean
  onClick?: () => void
}) {
  const content = (
    <div className="rounded-2xl p-4 shadow-sm ring-1 ring-black/5" style={{ background: "var(--paper-raised)" }}>
      <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `color-mix(in_oklch, ${color} 14%, transparent)`, color }}>{icon}</span>
      <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight" style={{ color: "var(--ink)" }}>{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold tracking-wide text-[var(--ink-soft)] uppercase">{label}</p>
    </div>
  )
  if (clickable && onClick) {
    return <button type="button" onClick={onClick} className="text-left">{content}</button>
  }
  return content
}
