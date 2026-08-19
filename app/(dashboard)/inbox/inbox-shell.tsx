"use client"

import { usePathname } from "next/navigation"
import { ConversationList } from "./conversation-list"
import type { getConversations } from "./actions"

type Conversation = Awaited<ReturnType<typeof getConversations>>[number]

export function InboxShell({
  initialConversations,
  children,
}: {
  initialConversations: Conversation[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const conversationOpen =
    pathname.startsWith("/inbox/") && pathname !== "/inbox"

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-[var(--paper)]">
      <div
        className={`min-h-0 min-w-0 flex-shrink-0 ${
          conversationOpen
            ? "hidden w-[320px] lg:flex lg:w-[360px]"
            : "flex w-full lg:w-[360px]"
        }`}
      >
        <div className="h-full w-full">
          <ConversationList initialConversations={initialConversations} />
        </div>
      </div>
      <div
        className={`min-h-0 min-w-0 flex-1 ${
          conversationOpen ? "flex" : "hidden lg:flex"
        }`}
      >
        {children}
      </div>
    </div>
  )
}
