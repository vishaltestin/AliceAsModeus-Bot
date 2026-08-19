import type { ReactNode } from "react"
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react"

const alertStyles = {
  error: {
    background: "var(--coral-soft)",
    color: "var(--coral)",
    icon: XCircle,
  },
  success: {
    background: "var(--jade-soft)",
    color: "var(--jade-dark)",
    icon: CheckCircle2,
  },
  warning: {
    background: "var(--amber-soft)",
    color: "var(--amber)",
    icon: AlertTriangle,
  },
  info: { background: "var(--paper)", color: "var(--ink-soft)", icon: Info },
} as const

export function InlineAlert({
  tone = "error",
  children,
  action,
}: {
  tone?: keyof typeof alertStyles
  children: ReactNode
  action?: ReactNode
}) {
  const style = alertStyles[tone]
  const Icon = style.icon
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm"
      style={{ background: style.background, color: style.color }}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="surface-card flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}
      >
        {icon}
      </span>
      <h2
        className="mt-5 font-[family-name:var(--font-display)] text-xl font-medium tracking-tight"
        style={{ color: "var(--ink)" }}
      >
        {title}
      </h2>
      {description && (
        <p
          className="mt-2 max-w-sm text-sm leading-6"
          style={{ color: "var(--ink-soft)" }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4">
      <div
        className="h-9 w-56 rounded-xl"
        style={{ background: "var(--line)" }}
      />
      <div
        className="h-5 w-96 max-w-full rounded"
        style={{ background: "var(--paper)" }}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="h-28 rounded-2xl"
            style={{ background: "var(--paper-raised)" }}
          />
        ))}
      </div>
    </div>
  )
}
