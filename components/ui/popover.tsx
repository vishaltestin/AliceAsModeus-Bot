"use client"

import * as React from "react"
import { Popover } from "radix-ui"

import { cn } from "@/lib/utils"

function PopoverRoot({
  ...props
}: React.ComponentProps<typeof Popover.Root>) {
  return <Popover.Root data-slot="popover" {...props} />
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof Popover.Trigger>) {
  return <Popover.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof Popover.Content>) {
  return (
    <Popover.Portal>
      <Popover.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-2xl border bg-[var(--paper-raised)] p-4 text-[var(--ink)] shadow-[var(--shadow-float)] ring-1 ring-black/5 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </Popover.Portal>
  )
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof Popover.Anchor>) {
  return <Popover.Anchor data-slot="popover-anchor" {...props} />
}

export { PopoverRoot as Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
