"use client"

import { useState } from "react"
import {
  Paperclip,
  Image as ImageIcon,
  Camera as CameraIcon,
  FileText,
  Music,
  User,
  Smile,
  MapPin,
} from "lucide-react"

const ITEMS = [
  { key: "gallery", label: "Photos & Videos", icon: ImageIcon },
  { key: "camera", label: "Camera", icon: CameraIcon },
  { key: "document", label: "Document", icon: FileText },
  { key: "audio", label: "Audio", icon: Music },
  { key: "contact", label: "Contact", icon: User },
  { key: "location", label: "Location", icon: MapPin },
  { key: "sticker", label: "Sticker", icon: Smile },
] as const

export type AttachmentKey = (typeof ITEMS)[number]["key"]

export function AttachmentMenu({
  onPick,
}: {
  onPick: (key: AttachmentKey) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Attach"
        className="shrink-0 rounded-lg p-2.5"
        style={{ border: "1px solid var(--line)", color: "var(--ink-soft)" }}
      >
        <Paperclip size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute bottom-12 left-0 z-20 w-56 rounded-xl py-1 shadow-lg"
            style={{
              background: "var(--paper-raised)",
              border: "1px solid var(--line)",
            }}
          >
            {ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  onPick(item.key)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-black/5"
                style={{ color: "var(--ink)" }}
              >
                <item.icon size={15} style={{ color: "var(--jade)" }} />
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
