import * as React from "react"
import { cn } from "@/lib/utils"
import { inputBase } from "@/components/ui/input"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(inputBase, "h-auto min-h-24 resize-y", className)}
    {...props}
  />
))
Textarea.displayName = "Textarea"

export { Textarea }
