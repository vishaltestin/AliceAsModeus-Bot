"use client"

import { Inbox, Plus, Search, UserRound, X } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatRelativeTime, initials } from "@/lib/format"
import { useRole } from "@/components/role-context"
import { getConversations, startConversation } from "./actions"

type ConversationWithPreview = Awaited<
  ReturnType<typeof getConversations>
>[number]

type Filter = "all" | "unread"

export function ConversationList({
  initialConversations,
}: {
  initialConversations: ConversationWithPreview[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { canWrite } = useRole()
  const [conversations, setConversations] = useState(initialConversations)
  const [showNew, setShowNew] = useState(false)
  const [phone, setPhone] = useState("")
  const [name, setName] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [listError, setListError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const nextConversations = await getConversations()
        if (!cancelled) {
          setConversations(nextConversations)
          setListError(null)
        }
      } catch (reason) {
        if (!cancelled) {
          console.error("[wacrm] Conversation list refresh failed", reason)
          setListError("Live updates are temporarily unavailable.")
        }
      }
    }
    const interval = setInterval(() => void refresh(), 4000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return conversations.filter((conversation) => {
      if (filter === "unread" && conversation.unreadCount === 0) return false
      if (!normalizedQuery) return true
      const lastMessage = conversation.messages[0]
      const preview = getPreview(lastMessage)
      return [conversation.contact.name, conversation.contact.phone, preview]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery))
    })
  }, [conversations, filter, query])

  const unreadCount = conversations.reduce(
    (sum, conversation) => sum + (conversation.unreadCount > 0 ? 1 : 0),
    0
  )

  function handleStart() {
    if (!phone.trim()) return
    setListError(null)
    startTransition(async () => {
      try {
        const conversation = await startConversation(phone, name)
        setShowNew(false)
        setPhone("")
        setName("")
        router.push(`/inbox/${conversation.id}`)
        setConversations(await getConversations())
      } catch (reason) {
        console.error("[wacrm] Start conversation failed", reason)
        setListError(
          reason instanceof Error
            ? reason.message
            : "We couldn't start this conversation."
        )
      }
    })
  }

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col border-r"
      style={{ borderColor: "var(--line)", background: "var(--paper-raised)" }}
    >
      <div
        className="shrink-0 border-b px-5 pt-5 pb-4"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-2xl"
              style={{
                background: "var(--jade-soft)",
                color: "var(--jade-dark)",
              }}
            >
              <Inbox size={19} />
            </span>
            <div>
              <p className="eyebrow">Shared inbox</p>
              <h2
                className="mt-1 font-[family-name:var(--font-display)] text-xl font-medium tracking-tight"
                style={{ color: "var(--ink)" }}
              >
                Conversations
              </h2>
            </div>
          </div>
          {canWrite && (
            <Button
              size="icon"
              aria-label="Start a new conversation"
              onClick={() => {
                setShowNew((open) => !open)
                setListError(null)
              }}
            >
              {showNew ? <X size={17} /> : <Plus size={17} />}
            </Button>
          )}
        </div>
        <div className="relative mt-4">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
            style={{ color: "var(--ink-soft)" }}
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="h-10 pl-10"
          />
        </div>
        <div
          className="mt-3 flex items-center gap-1 rounded-xl p-1"
          style={{ background: "var(--paper)" }}
        >
          <FilterButton
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All
          </FilterButton>
          <FilterButton
            active={filter === "unread"}
            onClick={() => setFilter("unread")}
          >
            Unread{unreadCount > 0 ? ` · ${unreadCount}` : ""}
          </FilterButton>
        </div>
      </div>

      {listError && (
        <div
          className="shrink-0 border-b px-5 py-2.5 text-xs"
          style={{
            borderColor: "var(--line)",
            background: "var(--coral-soft)",
            color: "var(--coral)",
          }}
          role="alert"
        >
          {listError}
        </div>
      )}

      {showNew && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleStart()
          }}
          className="shrink-0 space-y-3 border-b p-4"
          style={{ borderColor: "var(--line)", background: "var(--paper)" }}
        >
          <div
            className="flex items-center gap-2 text-xs font-semibold"
            style={{ color: "var(--ink)" }}
          >
            <UserRound size={14} style={{ color: "var(--jade)" }} /> Start a new
            thread
          </div>
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Phone number with country code"
            aria-label="Phone number"
            autoComplete="tel"
          />
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name (optional)"
            aria-label="Contact name"
            autoComplete="name"
          />
          <Button
            type="submit"
            className="w-full"
            disabled={isPending || !phone.trim()}
          >
            {isPending ? "Starting…" : "Start conversation"}
          </Button>
        </form>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <span
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                background: "var(--jade-soft)",
                color: "var(--jade-dark)",
              }}
            >
              {query || filter === "unread" ? (
                <Search size={20} />
              ) : (
                <Inbox size={20} />
              )}
            </span>
            <p
              className="mt-4 text-sm font-semibold"
              style={{ color: "var(--ink)" }}
            >
              {query || filter === "unread"
                ? "No conversations found"
                : "Your inbox is clear"}
            </p>
            <p
              className="mt-1 text-xs leading-5"
              style={{ color: "var(--ink-soft)" }}
            >
              {query || filter === "unread"
                ? "Try a different search or filter."
                : "New customer conversations will appear here."}
            </p>
          </div>
        ) : (
          filteredConversations.map((conversation) => {
            const isActive = pathname === `/inbox/${conversation.id}`
            const lastMessage = conversation.messages[0]
            const unread = conversation.unreadCount > 0
            const unassigned = !conversation.assignedAgentId
            return (
              <Link
                key={conversation.id}
                href={`/inbox/${conversation.id}`}
                className="group relative flex items-start gap-3 border-b px-5 py-4 transition-colors hover:bg-[var(--paper)]"
                style={{
                  borderColor: "var(--line)",
                  background: isActive ? "var(--jade-soft)" : "transparent",
                }}
              >
                {isActive && (
                  <span
                    className="absolute inset-y-0 left-0 w-1"
                    style={{ background: "var(--jade)" }}
                  />
                )}
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-semibold text-white"
                  style={{
                    background: isActive ? "var(--jade)" : "var(--jade-dark)",
                  }}
                >
                  {initials(
                    conversation.contact.name,
                    conversation.contact.phone
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate text-sm ${unread ? "font-bold" : "font-semibold"}`}
                      style={{ color: "var(--ink)" }}
                    >
                      {conversation.contact.name || conversation.contact.phone}
                    </span>
                    <span
                      className="shrink-0 text-[11px]"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      {conversation.lastMessageAt
                        ? formatRelativeTime(conversation.lastMessageAt)
                        : ""}
                    </span>
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span
                      className={`min-w-0 flex-1 truncate text-xs ${unread ? "font-medium" : ""}`}
                      style={{
                        color: unread ? "var(--ink)" : "var(--ink-soft)",
                      }}
                    >
                      {getPreview(lastMessage)}
                    </span>
                    {unassigned && (
                      <span
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                        style={{
                          background: "var(--amber-soft)",
                          color: "var(--amber)",
                        }}
                      >
                        Unassigned
                      </span>
                    )}
                    {unread && (
                      <span
                        className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                        style={{ background: "var(--jade)" }}
                      >
                        {conversation.unreadCount > 99
                          ? "99+"
                          : conversation.unreadCount}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition"
      style={{
        background: active ? "var(--paper-raised)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink-soft)",
        boxShadow: active ? "var(--shadow-card)" : "none",
      }}
    >
      {children}
    </button>
  )
}

function getPreview(
  message: ConversationWithPreview["messages"][number] | undefined
) {
  if (!message) return "No messages yet"
  if (message.contentText) return message.contentText
  const labels: Record<string, string> = {
    IMAGE: "📷 Photo",
    VIDEO: "🎥 Video",
    AUDIO: "🎤 Voice note",
    DOCUMENT: "📎 Document",
    LOCATION: "📍 Location",
    CONTACT: "👤 Contact",
    STICKER: "Sticker",
  }
  return labels[message.contentType] ?? "New message"
}
