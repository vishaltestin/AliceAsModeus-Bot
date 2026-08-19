import {
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  MessageCircle,
  MessageSquareText,
  Plus,
  UsersRound,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChart } from "@/components/charts/bar-chart"
import { DonutChart } from "@/components/charts/donut-chart"
import { getDashboardAnalytics } from "./actions"
import { formatCurrency } from "@/lib/currency"
import { isDynamicServerUsage, logServerError } from "@/lib/error-handling"
import { ErrorState } from "@/components/ui/error-state"

const CATEGORY_COLORS: Record<string, string> = {
  LEAD: "var(--jade)",
  CUSTOMER: "var(--jade-dark)",
  VIP: "var(--amber)",
  SUSPECT: "var(--coral)",
  PROSPECT: "var(--ink-soft)",
}

export default async function DashboardPage() {
  let analytics
  try {
    analytics = await getDashboardAnalytics()
  } catch (err) {
    if (isDynamicServerUsage(err)) throw err
    logServerError("dashboard:analytics", err)
    return (
      <ErrorState
        title="Couldn't load your dashboard"
        message="We couldn't load your workspace overview right now. Try again in a moment."
        retryHref="/inbox"
      />
    )
  }

  const maxCategory = Math.max(
    ...analytics.categories.map((item) => item.count),
    1
  )

  const donutData = analytics.categories.map((item) => ({
    label: formatCategory(item.category),
    count: item.count,
    color: CATEGORY_COLORS[item.category] ?? "var(--ink-soft)",
  }))
  const totalContacts = analytics.stats.contacts

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace overview"
        title="Dashboard"
        description="A clear view of the conversations, contacts, and opportunities moving through your workspace."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/contacts">
                <UsersRound size={15} /> Contacts
              </Link>
            </Button>
            <Button asChild>
              <Link href="/inbox">
                <MessageCircle size={15} /> Open inbox
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Open conversations"
          value={analytics.stats.openConversations}
          detail={`${analytics.stats.unread} unread messages`}
          icon={<MessageCircle size={17} />}
          accent="var(--jade)"
        />
        <Stat
          label="Contacts"
          value={analytics.stats.contacts}
          detail={`+${analytics.stats.newContacts} this month`}
          icon={<UsersRound size={17} />}
          accent="var(--jade-dark)"
        />
        <Stat
          label="Messages sent"
          value={analytics.stats.messages}
          detail="Last 30 days"
          icon={<BarChart3 size={17} />}
          accent="var(--amber)"
        />
        <Stat
          label="Pipeline value"
          value={formatCurrency(analytics.stats.pipelineValue)}
          detail={`${analytics.stats.openDeals} open deals`}
          icon={<BriefcaseBusiness size={17} />}
          accent="var(--coral)"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader className="border-b" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-start justify-between">
              <div>
                <CardDescription>Last 7 days</CardDescription>
                <CardTitle className="mt-1">Message activity</CardTitle>
              </div>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}
              >
                <MessageSquareText size={18} />
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <BarChart data={analytics.messageTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b" style={{ borderColor: "var(--line)" }}>
            <CardDescription>Contact mix</CardDescription>
            <CardTitle className="mt-1">Who is in your workspace?</CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            {analytics.categories.length ? (
              <DonutChart
                data={donutData}
                centerValue={String(totalContacts)}
                centerLabel="Contacts"
              />
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-[var(--ink-soft)]">
                Add contacts to see your audience mix.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader className="border-b" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-start justify-between">
              <div>
                <CardDescription>Category breakdown</CardDescription>
                <CardTitle className="mt-1">Audience by category</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {analytics.categories.length ? (
              <div className="space-y-4">
                {analytics.categories.map((item) => (
                  <div key={item.category} className="flex items-center gap-3">
                    <span
                      className="w-24 shrink-0 text-xs font-semibold"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      {formatCategory(item.category)}
                    </span>
                    <div
                      className="h-2 flex-1 overflow-hidden rounded-full"
                      style={{ background: "var(--paper)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(8, (item.count / maxCategory) * 100)}%`,
                          background:
                            CATEGORY_COLORS[item.category] ?? "var(--jade)",
                        }}
                      />
                    </div>
                    <span
                      className="w-8 text-right text-xs font-semibold"
                      style={{ color: "var(--ink)" }}
                    >
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-[var(--ink-soft)]">
                No categories yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b" style={{ borderColor: "var(--line)" }}>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="space-y-1">
              <QuickAction
                href="/inbox"
                icon={<MessageCircle size={16} />}
                title="Review inbox"
                description="Respond to open conversations"
              />
              <QuickAction
                href="/contacts"
                icon={<Plus size={16} />}
                title="Add a contact"
                description="Grow your relationship workspace"
              />
              <QuickAction
                href="/broadcasts/new"
                icon={<BarChart3 size={16} />}
                title="Start a broadcast"
                description={`${analytics.stats.broadcasts} campaigns this month`}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div
          className="flex items-center justify-between border-b p-5"
          style={{ borderColor: "var(--line)" }}
        >
          <div>
            <CardDescription>Recent activity</CardDescription>
            <CardTitle className="mt-1">Latest conversations</CardTitle>
          </div>
          <Link
            href="/inbox"
            className="text-xs font-semibold text-[var(--jade)]"
          >
            View inbox
          </Link>
        </div>
        {analytics.recentConversations.length ? (
          <div className="divide-y" style={{ borderColor: "var(--line)" }}>
            {analytics.recentConversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/inbox/${conversation.id}`}
                className="flex items-center gap-3 p-4 transition hover:bg-[var(--paper)] sm:p-5"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ background: "var(--jade-dark)" }}
                >
                  {initials(
                    conversation.contact.name || conversation.contact.phone
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-sm font-semibold"
                    style={{ color: "var(--ink)" }}
                  >
                    {conversation.contact.name || conversation.contact.phone}
                  </span>
                  <span
                    className="mt-1 block truncate text-xs"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {conversation.messages[0]?.contentText ||
                      "No message preview"}
                  </span>
                </span>
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={{
                    background:
                      conversation.status === "OPEN"
                        ? "var(--jade-soft)"
                        : "var(--paper)",
                    color:
                      conversation.status === "OPEN"
                        ? "var(--jade-dark)"
                        : "var(--ink-soft)",
                  }}
                >
                  {conversation.status}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div
            className="p-8 text-center text-sm"
            style={{ color: "var(--ink-soft)" }}
          >
            No conversation activity yet.
          </div>
        )}
      </Card>
    </div>
  )
}

function Stat({
  label,
  value,
  detail,
  icon,
  accent,
}: {
  label: string
  value: string | number
  detail: string
  icon: React.ReactNode
  accent: string
}) {
  return (
    <Card className="p-4">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: "color-mix(in_oklch, " + accent + " 14%, transparent)", color: accent }}
      >
        {icon}
      </span>
      <p
        className="mt-4 text-[10px] font-semibold tracking-[0.12em] uppercase"
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
      <p className="mt-1 text-[11px]" style={{ color: "var(--ink-soft)" }}>
        {detail}
      </p>
    </Card>
  )
}

function QuickAction({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-[var(--paper)]"
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block text-xs font-semibold"
          style={{ color: "var(--ink)" }}
        >
          {title}
        </span>
        <span
          className="mt-0.5 block text-[11px]"
          style={{ color: "var(--ink-soft)" }}
        >
          {description}
        </span>
      </span>
      <ArrowUpRight size={14} style={{ color: "var(--ink-soft)" }} />
    </Link>
  )
}

function formatCategory(category: string) {
  return category.charAt(0) + category.slice(1).toLowerCase()
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  return (
    parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : value.slice(0, 2)
  ).toUpperCase()
}
