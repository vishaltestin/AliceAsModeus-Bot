"use client"

import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import {
  Ban,
  Building2,
  CheckCircle2,
  Download,
  ExternalLink,
  RefreshCw,
  Trash2,
  UsersRound,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
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
  listAccounts,
  toggleAccountStatus,
  deleteAccount,
  type AccountListQuery,
} from "../actions"

type Row = Awaited<ReturnType<typeof listAccounts>>[number]

const PLAN_LABELS: Record<string, string> = {
  FREE: "Free",
  CUSTOM: "Custom",
}

const columnHelper = createColumnHelper<Row>()

export default function PlatformAccountsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState<AccountListQuery>({
    status: "ALL",
    plan: "ALL",
    connected: "all",
    sort: "newest",
  })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null)

  const load = useCallback((q: AccountListQuery) => {
    startTransition(async () => {
      try {
        setRows(await listAccounts(q))
        setError(null)
      } catch (reason) {
        console.error("[platform] accounts load failed", reason)
        setError("We couldn't load accounts. Please try again.")
      } finally {
        setLoading(false)
      }
    })
  }, [])

  useEffect(() => {
    load(query)
  }, [load, query])

  const runAction = useCallback(
    (id: string, fn: () => Promise<unknown>) => {
      setBusyId(id)
      startTransition(async () => {
        try {
          await fn()
          await listAccounts(query).then(setRows)
        } catch (reason) {
          console.error("[platform] action failed", reason)
          setError(reason instanceof Error ? reason.message : "Action failed")
        } finally {
          setBusyId(null)
        }
      })
    },
    [query]
  )

  function exportExcel() {
    const header = ["Account", "Email", "Plan", "Quota", "Used", "Remaining", "Users", "WhatsApp", "Created"]
    const aoa = [
      header,
      ...rows.map((r) => [
        r.name,
        r.email ?? "",
        PLAN_LABELS[r.planType] ?? r.planType,
        r.quota,
        r.used,
        r.remaining,
        r.userCount,
        r.connected ? "Connected" : r.whatsappStatus,
        new Date(r.createdAt).toLocaleDateString(),
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws["!cols"] = header.map(() => ({ wch: 16 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Accounts")
    XLSX.writeFile(wb, "accounts-export.xlsx")
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Account",
        cell: (info) => {
          const row = info.row.original
          return (
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-medium" style={{ color: "var(--ink)" }}>
                {row.name}
                {row.status === "SUSPENDED" && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>Suspended</span>
                )}
              </p>
              <p className="truncate text-xs text-[var(--ink-soft)]">{row.email ?? row.id}</p>
            </div>
          )
        },
      }),
      columnHelper.accessor("planType", {
        header: "Plan",
        cell: (info) => (
          <span className="rounded-full px-2 py-1 text-[11px] font-semibold" style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}>
            {PLAN_LABELS[info.getValue()] ?? info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("quota", {
        header: "Quota",
        cell: (info) => <span className="font-semibold" style={{ color: "var(--ink)" }}>{info.getValue().toLocaleString()}</span>,
      }),
      columnHelper.accessor("used", {
        header: "Used",
        cell: (info) => {
          const row = info.row.original
          const pct = row.quota > 0 ? Math.round((row.used / row.quota) * 100) : 0
          return (
            <div className="min-w-[120px]">
              <div className="flex items-center justify-between text-[11px]">
                <span style={{ color: "var(--ink)" }}>{row.used}</span>
                <span style={{ color: "var(--ink-soft)" }}>{pct}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: pct >= 100 ? "var(--coral)" : pct >= 80 ? "var(--amber)" : "var(--jade)" }} />
              </div>
            </div>
          )
        },
      }),
      columnHelper.accessor("remaining", {
        header: "Remaining",
        cell: (info) => <span style={{ color: info.getValue() === 0 ? "var(--coral)" : "var(--ink)" }}>{info.getValue().toLocaleString()}</span>,
      }),
      columnHelper.accessor("userCount", {
        header: "Users",
        cell: (info) => (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--ink-soft)]"><UsersRound size={12} />{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("connected", {
        header: "WhatsApp",
        cell: (info) => (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: info.getValue() ? "var(--jade)" : "var(--ink-soft)" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: info.getValue() ? "var(--jade)" : "var(--line)" }} />
            {info.getValue() ? "Connected" : info.row.original.whatsappStatus}
          </span>
        ),
      }),
      columnHelper.accessor("createdAt", {
        header: "Created",
        cell: (info) => <span className="text-xs text-[var(--ink-soft)]">{new Date(info.getValue()).toLocaleDateString()}</span>,
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        enableHiding: false,
        cell: (info) => {
          const row = info.row.original
          return (
            <div className="flex justify-end gap-1.5">
              <Link href={`/platform-admin/account/${row.id}`} title="View / manage" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition" style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}>
                Manage <ExternalLink size={12} />
              </Link>
              <button
                type="button"
                title={row.status === "SUSPENDED" ? "Activate" : "Suspend"}
                disabled={busyId === row.id}
                onClick={() => runAction(row.id, () => toggleAccountStatus(row.id, row.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED"))}
                className="rounded-lg p-2 transition hover:bg-[var(--paper)] disabled:opacity-50"
                style={{ color: row.status === "SUSPENDED" ? "var(--jade)" : "var(--amber)" }}
              >
                {row.status === "SUSPENDED" ? <CheckCircle2 size={15} /> : <Ban size={15} />}
              </button>
              <button
                type="button"
                title="Delete account"
                disabled={busyId === row.id}
                onClick={() => setConfirmDelete(row)}
                className="rounded-lg p-2 transition hover:bg-[var(--paper)] disabled:opacity-50"
                style={{ color: "var(--coral)" }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          )
        },
      }),
    ],
    [busyId, runAction]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Platform control</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight">Customer accounts</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Search, filter, set quotas, suspend, and manage every workspace.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="border-[var(--line)]" onClick={exportExcel}>
            <Download size={14} /> Excel
          </Button>
          <Button variant="outline" className="border-[var(--line)]" onClick={() => load(query)} disabled={isPending}>
            <RefreshCw size={14} className={isPending ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>
          {error}
        </div>
      )}

      {/* Server-side filters (status / plan / connection) */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={query.status ?? "ALL"} onValueChange={(value) => setQuery((q) => ({ ...q, status: value as AccountListQuery["status"] }))}>
          <SelectTrigger className="w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={query.plan ?? "ALL"} onValueChange={(value) => setQuery((q) => ({ ...q, plan: value as AccountListQuery["plan"] }))}>
          <SelectTrigger className="w-36" aria-label="Filter by plan"><SelectValue /></SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="ALL">All plans</SelectItem>
            <SelectItem value="FREE">Free</SelectItem>
            <SelectItem value="CUSTOM">Custom</SelectItem>
          </SelectContent>
        </Select>
        <Select value={query.connected ?? "all"} onValueChange={(value) => setQuery((q) => ({ ...q, connected: value as AccountListQuery["connected"] }))}>
          <SelectTrigger className="w-44" aria-label="Filter by connection"><SelectValue /></SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">Any connection</SelectItem>
            <SelectItem value="yes">WhatsApp connected</SelectItem>
            <SelectItem value="no">Not connected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={query.sort ?? "newest"} onValueChange={(value) => setQuery((q) => ({ ...q, sort: value as AccountListQuery["sort"] }))}>
          <SelectTrigger className="w-40" aria-label="Sort accounts"><SelectValue /></SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="used">Most messages used</SelectItem>
            <SelectItem value="remaining">Least remaining</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && rows.length === 0 ? (
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--line)" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl" style={{ background: "var(--paper)" }} />
          ))}
        </div>
      ) : (
        <ReusableDataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search by name or email…"
          searchableColumns={["name", "email"]}
          enableExport
          exportFileName="accounts.csv"
          defaultPageSize={10}
          pageSizeOptions={[10, 20, 50, 100]}
          enableColumnVisibility
          enableRowSelection
          emptyStateMessage="No accounts found"
          emptyStateDescription="Try adjusting your filters."
          initialSorting={[]}
          toolbarActions={
            rows.length > 0 ? (
              <span className="inline-flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                <Building2 size={15} style={{ color: "var(--brand-blue)" }} />
                {rows.length} accounts
              </span>
            ) : undefined
          }
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return
          runAction(confirmDelete.id, () => deleteAccount(confirmDelete.id))
          setConfirmDelete(null)
        }}
        title={`Delete "${confirmDelete?.name}"?`}
        description="This permanently deletes the account and ALL of its data — contacts, conversations, messages, quotas, and settings. This cannot be undone."
        confirmLabel="Delete account"
      />
    </div>
  )
}
