import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--jade)] text-white",
        secondary:
          "border-transparent bg-[var(--jade-soft)] text-[var(--jade-dark)]",
        outline: "border-[var(--line)] text-[var(--ink-soft)]",
        success:
          "border-transparent bg-[var(--jade-soft)] text-[var(--jade-dark)]",
        warning: "border-transparent bg-[var(--amber-soft)] text-[var(--amber)]",
        destructive:
          "border-transparent bg-[var(--coral-soft)] text-[var(--coral)]",
        muted: "border-transparent bg-[var(--paper)] text-[var(--ink-soft)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
