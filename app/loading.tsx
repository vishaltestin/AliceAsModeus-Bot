export default function Loading() {
  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm text-center" aria-live="polite">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: "var(--jade-soft)" }}
        >
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-transparent"
            style={{
              borderTopColor: "var(--jade)",
              borderRightColor: "var(--jade)",
            }}
          />
        </div>
        <p className="mt-5 text-sm font-medium" style={{ color: "var(--ink)" }}>
          Preparing your workspace…
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
          Loading conversations and team data
        </p>
      </div>
    </main>
  )
}
