import type { ReactNode } from "react"

export function FormField({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
}) {
  const descriptionId = htmlFor ? `${htmlFor}-description` : undefined
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-center justify-between gap-3 text-xs font-semibold"
        style={{ color: "var(--ink)" }}
      >
        <span>{label}</span>
        {required && (
          <span
            className="text-[10px] font-normal"
            style={{ color: "var(--ink-soft)" }}
          >
            Required
          </span>
        )}
      </label>
      {children}
      {(hint || error) && (
        <p
          id={descriptionId}
          className="text-[11px] leading-4"
          style={{ color: error ? "var(--coral)" : "var(--ink-soft)" }}
        >
          {error || hint}
        </p>
      )}
    </div>
  )
}
