import * as React from "react"
import { cn } from "@/lib/utils"

const inputBase =
  "flex h-10 w-full rounded-xl border bg-[var(--paper-raised)] px-3.5 py-2.5 text-sm text-[var(--ink)] shadow-sm transition placeholder:text-[var(--ink-soft)]/70 focus-visible:border-[var(--jade)] focus-visible:ring-4 focus-visible:ring-[var(--jade)]/12 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-[var(--coral)] aria-invalid:ring-4 aria-invalid:ring-[var(--coral)]/12"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(inputBase, "border-[var(--line)]", className)}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input, inputBase }
