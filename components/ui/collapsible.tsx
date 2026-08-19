"use client"

import { Collapsible } from "radix-ui"

function CollapsibleRoot({
  ...props
}: React.ComponentProps<typeof Collapsible.Root>) {
  return <Collapsible.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof Collapsible.Trigger>) {
  return (
    <Collapsible.Trigger data-slot="collapsible-trigger" {...props} />
  )
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof Collapsible.Content>) {
  return <Collapsible.Content data-slot="collapsible-content" {...props} />
}

export {
  CollapsibleRoot as Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
}
