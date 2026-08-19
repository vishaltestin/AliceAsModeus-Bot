import { MessageSquareText } from "lucide-react"

export default function InboxIndexPage() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center bg-[var(--paper)]">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: "var(--jade-soft)",
          color: "var(--jade-dark)",
        }}
      >
        <MessageSquareText size={30} />
      </div>
      <h3 className="font-[family-name:var(--font-display)] text-base font-medium">
        No conversation selected
      </h3>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        Select a conversation from the sidebar or start a new one.
      </p>
    </div>
  )
}
