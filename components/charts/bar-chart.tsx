"use client"

type BarDatum = { label: string; count: number }

export function BarChart({
  data,
  className,
}: {
  data: BarDatum[]
  className?: string
}) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className={className}>
      <div className="flex h-40 items-end gap-2 sm:gap-3">
        {data.map((d, i) => {
          const height = Math.max(4, (d.count / max) * 100)
          return (
            <div
              key={i}
              className="group relative flex h-full flex-1 items-end"
            >
              <div
                className="w-full rounded-t-lg transition-all duration-500 group-hover:opacity-80"
                style={{
                  height: `${height}%`,
                  background:
                    i === data.length - 1
                      ? "linear-gradient(180deg, var(--jade), var(--jade-dark))"
                      : "linear-gradient(180deg, var(--jade-soft), color-mix(in_oklch, var(--jade-soft), var(--jade) 30%))",
                }}
              />
              <div
                className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-lg bg-[var(--ink)] px-2 py-1 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                {d.count}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 truncate text-center text-[10px] font-medium text-[var(--ink-soft)]"
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  )
}
