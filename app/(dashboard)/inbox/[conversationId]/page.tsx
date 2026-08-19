import { notFound } from "next/navigation"
import {
  getConversation,
  markConversationRead,
  getAccountMembers,
} from "../actions"
import { Thread } from "./thread"
import { isDynamicServerUsage, logServerError } from "@/lib/error-handling"
import { ErrorState } from "@/components/ui/error-state"

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params

  let data: Awaited<ReturnType<typeof getConversation>>
  let members: Awaited<ReturnType<typeof getAccountMembers>>
  try {
    ;[data, members] = await Promise.all([
      getConversation(conversationId),
      getAccountMembers(),
    ])
  } catch (err) {
    if (isDynamicServerUsage(err)) throw err
    logServerError(`inbox:conversation:${conversationId}`, err)
    return (
      <ErrorState
        title="Couldn't open this conversation"
        message="We couldn't load this conversation right now. Please try again in a moment."
        retryHref="/inbox"
      />
    )
  }
  if (!data) notFound()

  try {
    await markConversationRead(conversationId)
  } catch (err) {
    // Marking-read is best-effort; never let it take down the page.
    logServerError(`inbox:mark-read:${conversationId}`, err)
  }

  return (
    <Thread
      key={conversationId}
      conversationId={conversationId}
      contact={data.conversation.contact}
      assignedAgentId={data.conversation.assignedAgentId}
      members={members}
      initialMessages={data.messages}
    />
  )
}
