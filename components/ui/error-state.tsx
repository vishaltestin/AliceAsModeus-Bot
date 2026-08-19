import Link from "next/link"

// Server-component-safe inline error panel. Use this inside a try/catch in a
// Server Component's data load so the page never crashes into React #441 — it
// renders a friendly message instead, while the real error is already logged
// server-side via lib/error-handling.ts.
export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this section. Please try again.",
  retryHref,
  retryLabel = "Back to your workspace",
}: {
  title?: string
  message?: string
  retryHref?: string
  retryLabel?: string
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center"
      style={{ borderColor: "var(--line)", background: "var(--paper-raised)" }}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg"
        style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
        aria-hidden="true"
      >
        !
      </span>
      <h2
        className="mt-5 font-[family-name:var(--font-display)] text-xl font-medium"
        style={{ color: "var(--ink)" }}
      >
        {title}
      </h2>
      <p
        className="mt-2 max-w-sm text-sm leading-6"
        style={{ color: "var(--ink-soft)" }}
      >
        {message}
      </p>
      {retryHref && (
        <Link
          href={retryHref}
          className="mt-6 inline-flex rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          style={{ background: "var(--jade)" }}
        >
          {retryLabel}
        </Link>
      )}
    </div>
  )
}
