"use client"

import { useEffect, useState } from "react"
import { getContacts } from "@/app/(dashboard)/contacts/actions"

export function ContactPickerModal({
  onClose,
  onSelect,
}: {
  onClose: () => void
  onSelect: (c: { name: string; phone: string }) => void
}) {
  const [contacts, setContacts] = useState<
    { id: string; name: string | null; phone: string }[]
  >([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    getContacts().then((c) =>
      setContacts(c.map((x) => ({ id: x.id, name: x.name, phone: x.phone })))
    )
  }, [])

  const filtered = contacts.filter(
    (c) =>
      !search ||
      (c.name || c.phone).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-sm flex-col space-y-3 rounded-xl p-4"
        style={{
          background: "var(--paper-raised)",
          border: "1px solid var(--line)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            Share a contact
          </h2>
          <button onClick={onClose} style={{ color: "var(--ink-soft)" }}>
            ×
          </button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts…"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            border: "1px solid var(--line)",
            background: "var(--paper)",
            color: "var(--ink)",
          }}
        />
        <div className="flex-1 space-y-1 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() =>
                onSelect({ name: c.name || c.phone, phone: c.phone })
              }
              className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-black/5"
              style={{ color: "var(--ink)" }}
            >
              <p className="font-medium">{c.name || c.phone}</p>
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                {c.phone}
              </p>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 text-sm" style={{ color: "var(--ink-soft)" }}>
              No contacts found.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
