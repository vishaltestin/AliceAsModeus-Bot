"use client"

type DonutDatum = { label: string; count: number; color: string }

const PALETTE = [
  "var(--jade)",
  "var(--jade-dark)",
  "var(--amber)",
  "var(--coral)",
  "var(--ink-soft)",
]

export function DonutChart({
  data,
  centerLabel,
  centerValue,
}: {
  data: DonutDatum[]
  centerLabel?: string
  centerValue?: string
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const size = 180
  const stroke = 26
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="flex items-center justify-center gap-6 sm:gap-8">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--line)"
            strokeWidth={stroke}
          />
          {total > 0 &&
            data.map((d, i) => {
              const frac = d.count / total
              const dash = frac * circumference
              const circle = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={d.color || PALETTE[i % PALETTE.length]}
                  strokeWidth={stroke}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  className="transition-all duration-700"
                />
              )
              offset += dash
              return circle
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
            {centerValue ?? total}
          </span>
          {centerLabel && (
            <span className="mt-0.5 text-[10px] text-[var(--ink-soft)] uppercase">
              {centerLabel}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                background: d.color || PALETTE[i % PALETTE.length],
              }}
            />
            <span className="min-w-0 flex-1 truncate text-xs text-[var(--ink-soft)]">
              {d.label}
            </span>
            <span className="text-xs font-semibold text-[var(--ink)]">
              {d.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
