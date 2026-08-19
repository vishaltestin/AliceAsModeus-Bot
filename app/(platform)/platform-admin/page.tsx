"use client"

import Link from "next/link"
import {
  Activity,
  ArrowUpRight,
  Building2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UsersRound,
  Zap,
} from "lucide-react"
import { useCallback, useEffect, useState, useTransition } from "react"
import { BarChart } from "@/components/charts/bar-chart"
import { DonutChart } from "@/components/charts/donut-chart"
import { getPlatformMetrics, type PlatformMetrics } from "./actions"

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

export default function PlatformDashboard() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        setMetrics(await getPlatformMetrics())
        setError(null)
      } catch (reason) {
        console.error("[platform] load failed", reason)
        setError("We couldn't load platform metrics. Please try again.")
      } finally {
        setLoading(false)
      }
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !metrics) return <DashboardSkeleton />

  const stats = metrics?.stats
  const usedPct = stats && stats.quotaAllocated > 0
    ? Math.round((stats.quotaUsed / stats.quotaAllocated) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Platform overview</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight">
            Admin dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Complete control and analytics across every account on the platform.
          </p>
        </div>
        <button
          onClick={load}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
          style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}
        >
          <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
        >
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <StatCard icon={<Building2 size={18} />} label="Total accounts" value={stats?.totalAccounts ?? 0} color="var(--brand-blue)" />
        <StatCard icon={<UsersRound size={18} />} label="Active accounts" value={stats?.activeAccounts ?? 0} color="var(--jade)" />
        <StatCard icon={<ShieldCheck size={18} />} label="Suspended" value={stats?.suspendedAccounts ?? 0} color="var(--coral)" />
        <StatCard icon={<MessageCircle size={18} />} label="Messages sent" value={formatNum(stats?.totalMessages ?? 0)} color="var(--jade-dark)" />
        <StatCard icon={<Zap size={18} />} label="Registrations today" value={stats?.registrationsToday ?? 0} color="var(--amber)" />
        <StatCard icon={<Activity size={18} />} label="Active users (30d)" value={stats?.activeUsers30d ?? 0} color="var(--brand-blue-light)" />
      </div>

      {/* Quota pool + connected */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader icon={<TrendingUp size={16} />} title="Messages sent — last 14 days" />
          <BarChart data={metrics?.trend ?? []} className="mt-4" />
        </Panel>
        <Panel>
          <PanelHeader icon={<MessageCircle size={16} />} title="Quota pool" />
          <div className="mt-4">
            <DonutChart
              data={[
                { label: "Used", count: stats?.quotaUsed ?? 0, color: "var(--jade)" },
                { label: "Remaining", count: Math.max(0, (stats?.quotaAllocated ?? 0) - (stats?.quotaUsed ?? 0)), color: "var(--line)" },
              ]}
              centerLabel="allocated"
              centerValue={formatNum(stats?.quotaAllocated ?? 0)}
            />
          </div>
          <p className="mt-4 text-center text-xs text-[var(--ink-soft)]">
            {usedPct}% of allocated message quota consumed
          </p>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader icon={<MessageCircle size={16} />} title="Messages by feature" />
          <div className="mt-4">
            <DonutChart
              data={(metrics?.featureUsage ?? []).map((f) => ({
                label: FEATURE_LABELS[f.feature] ?? f.feature,
                count: f.count,
                color: FEATURE_COLORS[f.feature] ?? "var(--ink-soft)",
              }))}
              centerLabel="messages"
              centerValue={formatNum((metrics?.featureUsage ?? []).reduce((s, f) => s + f.count, 0))}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader icon={<Activity size={16} />} title="Recent platform activity" />
          <div className="mt-4 space-y-2">
            {(metrics?.recentActivity ?? []).length === 0 && (
              <p className="text-sm text-[var(--ink-soft)]">No activity yet.</p>
            )}
            {(metrics?.recentActivity ?? []).map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: "var(--paper)" }}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: FEATURE_COLORS[row.feature] ?? "var(--jade)" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium" style={{ color: "var(--ink)" }}>
                    {FEATURE_LABELS[row.feature] ?? row.feature} · {row.account?.name ?? "Account"}
                  </p>
                  <p className="text-[11px] text-[var(--ink-soft)]">
                    {row.count} message{row.count === 1 ? "" : "s"} ·{" "}
                    {new Date(row.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <QuickLink href="/platform-admin/accounts" icon={<Building2 size={16} />} title="Manage accounts" desc="Search, quota, suspend, delete" />
        <QuickLink href="/platform-admin/accounts?status=ACTIVE" icon={<ShieldCheck size={16} />} title="Active workspaces" desc="Review active customers" />
        <QuickLink href="/platform-admin/accounts?status=SUSPENDED" icon={<TrendingUp size={16} />} title="Suspended" desc="Accounts needing attention" />
      </div>
    </div>
  )
}

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  color: string
}) {
  return (
    <div
      className="rounded-2xl p-4 shadow-sm ring-1 ring-black/5"
      style={{ background: "var(--paper-raised)" }}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: `color-mix(in_oklch, ${color} 14%, transparent)`, color }}
      >
        {icon}
      </span>
      <p className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
        {typeof value === "number" ? formatNum(value) : value}
      </p>
      <p className="mt-1 text-[11px] font-semibold tracking-wide text-[var(--ink-soft)] uppercase">{label}</p>
    </div>
  )
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-5 shadow-sm ring-1 ring-black/5 ${className}`} style={{ background: "var(--paper-raised)" }}>
      {children}
    </div>
  )
}

function PanelHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}>
        {icon}
      </span>
      <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{title}</h2>
    </div>
  )
}

function QuickLink({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl p-4 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5"
      style={{ background: "var(--paper-raised)" }}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{title}</p>
        <p className="truncate text-xs text-[var(--ink-soft)]">{desc}</p>
      </div>
      <ArrowUpRight size={15} className="shrink-0 text-[var(--ink-soft)] transition group-hover:text-[var(--jade)]" />
    </Link>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 animate-pulse rounded-xl" style={{ background: "var(--line)" }} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl" style={{ background: "var(--paper-raised)" }} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-2xl lg:col-span-2" style={{ background: "var(--paper-raised)" }} />
        <div className="h-64 animate-pulse rounded-2xl" style={{ background: "var(--paper-raised)" }} />
      </div>
    </div>
  )
}
