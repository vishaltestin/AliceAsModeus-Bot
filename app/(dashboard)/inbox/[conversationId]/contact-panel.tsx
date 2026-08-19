"use client"

import { Pencil, RefreshCw, StickyNote, UserRound, X } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { formatRelativeTime } from "@/lib/format"
import { useRole } from "@/components/role-context"
import {
  addContactNote,
  getContactNotes,
  getTagsAndFields,
} from "@/app/(dashboard)/contacts/actions"
import { ContactFormModal } from "@/app/(dashboard)/contacts/contact-form-modal"

type Contact = {
  id: string
  name: string | null
  phone: string
  email: string | null
  company: string | null
  category: string
  tags: { tag: { id: string; name: string } }[]
  customValues: {
    customFieldId: string
    value: string | null
    customField: { fieldName: string }
  }[]
}

export function ContactPanel({
  contact,
  onClose,
  onContactUpdated,
}: {
  contact: Contact
  onClose: () => void
  onContactUpdated: () => void
}) {
  const [notes, setNotes] = useState<
    Awaited<ReturnType<typeof getContactNotes>>
  >([])
  const [draft, setDraft] = useState("")
  const { canWrite } = useRole()
  const [editOpen, setEditOpen] = useState(false)
  const [meta, setMeta] = useState<
    Awaited<ReturnType<typeof getTagsAndFields>>
  >({ tags: [], customFields: [], categories: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let active = true
    Promise.all([getContactNotes(contact.id), getTagsAndFields()])
      .then(([nextNotes, nextMeta]) => {
        if (!active) return
        setNotes(nextNotes)
        setMeta(nextMeta)
        setError(null)
      })
      .catch((reason) => {
        if (!active) return
        console.error("[wacrm] Contact panel load failed", reason)
        setError("We couldn't load this contact's notes.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [contact.id])

  function handleAddNote() {
    const body = draft.trim()
    if (!body) return
    setError(null)
    startTransition(async () => {
      try {
        const note = await addContactNote(contact.id, body)
        setNotes((current) => [note, ...current])
        setDraft("")
      } catch (reason) {
        console.error("[wacrm] Add contact note failed", reason)
        setError(
          reason instanceof Error
            ? reason.message
            : "We couldn't add this note."
        )
      }
    })
  }

  return (
    <aside
      className="flex h-full w-full shrink-0 flex-col border-l shadow-[-8px_0_24px_rgba(16,24,40,0.04)] md:w-80"
      style={{ borderColor: "var(--line)", background: "var(--paper-raised)" }}
      aria-label="Contact profile"
    >
      <div
        className="flex items-center justify-between border-b px-4 py-4"
        style={{ borderColor: "var(--line)" }}
      >
        <div>
          <p
            className="text-xs font-semibold tracking-[0.14em] uppercase"
            style={{ color: "var(--jade)" }}
          >
            Profile
          </p>
          <p
            className="mt-0.5 text-sm font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Contact details
          </p>
        </div>
        <button
          type="button"
          aria-label="Close contact profile"
          onClick={onClose}
          className="rounded-xl p-2 transition-colors hover:bg-[var(--paper)]"
          style={{ color: "var(--ink-soft)" }}
        >
          <X size={17} />
        </button>
      </div>

      <div
        className="border-b px-4 py-5"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold text-white"
            style={{ background: "var(--jade-dark)" }}
          >
            {initials(contact.name || contact.phone)}
          </span>
          <div className="min-w-0">
            <p
              className="truncate text-sm font-semibold"
              style={{ color: "var(--ink)" }}
            >
              {contact.name || "Unnamed contact"}
            </p>
            <p
              className="mt-0.5 font-[family-name:var(--font-code)] text-[11px]"
              style={{ color: "var(--ink-soft)" }}
            >
              {contact.phone}
            </p>
          </div>
        </div>
        <div
          className="mt-4 space-y-1.5 text-xs"
          style={{ color: "var(--ink-soft)" }}
        >
          {contact.email && <p className="truncate">{contact.email}</p>}
          {contact.company && <p className="truncate">{contact.company}</p>}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {contact.tags.length ? (
            contact.tags.map((item) => (
              <span
                key={item.tag.id}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{
                  background: "var(--jade-soft)",
                  color: "var(--jade-dark)",
                }}
              >
                {item.tag.name}
              </span>
            ))
          ) : (
            <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
              No tags
            </span>
          )}
        </div>
        {contact.customValues.some((item) => item.value) && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {contact.customValues
              .filter((item) => item.value)
              .map((item) => (
                <div
                  key={item.customFieldId}
                  className="rounded-xl p-2.5"
                  style={{ background: "var(--paper)" }}
                >
                  <p
                    className="truncate text-[10px] font-semibold uppercase"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {item.customField.fieldName}
                  </p>
                  <p
                    className="mt-1 truncate text-xs font-medium"
                    style={{ color: "var(--ink)" }}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
          </div>
        )}
        {canWrite && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: "var(--jade)" }}
          >
            <Pencil size={13} /> Edit profile
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <p
            className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] uppercase"
            style={{ color: "var(--ink-soft)" }}
          >
            <StickyNote size={13} /> Notes
          </p>
          {loading && (
            <RefreshCw
              size={13}
              className="animate-spin"
              style={{ color: "var(--ink-soft)" }}
            />
          )}
        </div>
        {error && (
          <div
            role="alert"
            className="rounded-xl px-3 py-2.5 text-xs"
            style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
          >
            {error}
          </div>
        )}
        {loading ? (
          <div className="space-y-2">
            <div
              className="h-20 animate-pulse rounded-xl"
              style={{ background: "var(--paper)" }}
            />
            <div
              className="h-16 animate-pulse rounded-xl"
              style={{ background: "var(--paper)" }}
            />
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="rounded-xl p-3"
              style={{
                background: "var(--paper)",
                border: "1px solid var(--line)",
              }}
            >
              <p className="text-sm leading-5" style={{ color: "var(--ink)" }}>
                {note.body}
              </p>
              <p
                className="mt-2 flex items-center gap-1 text-[11px]"
                style={{ color: "var(--ink-soft)" }}
              >
                <UserRound size={11} /> {note.author.name || note.author.email}{" "}
                · {formatRelativeTime(note.createdAt)}
              </p>
            </div>
          ))
        )}
        {!loading && notes.length === 0 && (
          <div className="py-6 text-center">
            <StickyNote
              size={22}
              className="mx-auto"
              style={{ color: "var(--line)" }}
            />
            <p className="mt-2 text-xs" style={{ color: "var(--ink-soft)" }}>
              No notes yet. Add context for the next teammate.
            </p>
          </div>
        )}
      </div>

      <div
        className="space-y-2 border-t px-4 py-4"
        style={{ borderColor: "var(--line)" }}
      >
        {canWrite ? (
        <>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a note about this contact…"
          rows={2}
          className="w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
          }}
        />
        <button
          type="button"
          onClick={handleAddNote}
          disabled={isPending || !draft.trim()}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: "var(--jade)",
            boxShadow: "0 8px 16px rgba(31,111,92,0.14)",
          }}
        >
          {isPending ? "Adding note…" : "Add note"}
        </button>
        </>
        ) : (
          <p className="text-xs leading-5" style={{ color: "var(--ink-soft)" }}>
            Read-only — viewers can&apos;t add notes.
          </p>
        )}
      </div>

      {editOpen && (
        <ContactFormModal
          key={contact.id}
          open
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            onContactUpdated()
            setEditOpen(false)
          }}
          tags={meta.tags}
          customFields={meta.customFields}
          categories={meta.categories}
          existing={contact}
        />
      )}
    </aside>
  )
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return value.slice(0, 2).toUpperCase()
}
