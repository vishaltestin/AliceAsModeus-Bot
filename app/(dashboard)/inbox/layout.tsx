import { getConversations } from "./actions"
import { InboxShell } from "./inbox-shell"
import { isDynamicServerUsage, logServerError } from "@/lib/error-handling"
import { ErrorState } from "@/components/ui/error-state"

export default async function InboxLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let conversations
  try {
    conversations = await getConversations()
  } catch (err) {
    if (isDynamicServerUsage(err)) throw err
    logServerError("inbox:conversations", err)
    return (
      <ErrorState
        title="Couldn't load your inbox"
        message="We couldn't load your conversations right now. Please try again in a moment."
        retryHref="/inbox"
      />
    )
  }

  return (
    <InboxShell initialConversations={conversations}>{children}</InboxShell>
  )
}
