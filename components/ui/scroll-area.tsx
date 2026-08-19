"use client"

import * as React from "react"
import { ScrollArea } from "radix-ui"

import { cn } from "@/lib/utils"

function ScrollAreaRoot({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollArea.Root>) {
  return (
    <ScrollArea.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollArea.Viewport className="h-full w-full rounded-[inherit] focus-visible:outline-none">
        {children}
      </ScrollArea.Viewport>
      <ScrollBar />
      <ScrollArea.Corner />
    </ScrollArea.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollArea.ScrollAreaScrollbar>) {
  return (
    <ScrollArea.ScrollAreaScrollbar
      data-slot="scroll-bar"
      orientation={orientation}
      className={cn(
        "flex touch-none select-none p-px transition-colors",
        orientation === "vertical" &&
          "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" &&
          "h-2.5 flex-col border-t border-t-transparent",
        className
      )}
      {...props}
    >
      <ScrollArea.ScrollAreaThumb className="relative flex-1 rounded-full bg-[var(--line)]" />
    </ScrollArea.ScrollAreaScrollbar>
  )
}

export { ScrollAreaRoot as ScrollArea, ScrollBar }
