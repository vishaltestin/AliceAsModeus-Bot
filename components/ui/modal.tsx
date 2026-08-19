"use client"

import { X } from "lucide-react"
import { useEffect, useRef } from "react"

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  size = "md",
}: {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  description?: string
  children: React.ReactNode
  size?: "sm" | "md" | "lg"
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    // Move focus into the dialog without stealing it from the field the user
    // is about to type in. Prefer the first element flagged with
    // data-autofocus; otherwise focus the dialog container (not the close
    // button) so keyboard users stay in the dialog but the close button never
    // captures their typing.
    const task = window.setTimeout(() => {
      const auto = dialogRef.current?.querySelector<HTMLElement>(
        "[data-autofocus]"
      )
      if (auto) auto.focus()
      else dialogRef.current?.focus()
    }, 0)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      window.clearTimeout(task)
    }
  }, [open, onClose])

  if (!open) return null
  const maxWidth =
    size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-lg"
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`max-h-[min(760px,92svh)] w-full ${maxWidth} overflow-y-auto rounded-2xl p-5 shadow-2xl ring-1 ring-black/5 sm:p-6 focus:outline-none`}
        style={{ background: "var(--paper-raised)" }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2
              id="modal-title"
              className="mt-1 font-[family-name:var(--font-display)] text-2xl font-medium tracking-tight"
              style={{ color: "var(--ink)" }}
            >
              {title}
            </h2>
            {description && (
              <p
                className="mt-1 text-sm leading-6"
                style={{ color: "var(--ink-soft)" }}
              >
                {description}
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="rounded-xl p-2 transition-colors hover:bg-[var(--paper)]"
            style={{ color: "var(--ink-soft)" }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
