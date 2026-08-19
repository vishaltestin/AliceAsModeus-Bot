"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, User, Paperclip, X, Smile, Mic, Trash2, Send } from "lucide-react"
import EmojiPicker, { Theme, type EmojiClickData } from "emoji-picker-react"
import { formatMessageTime, initials } from "@/lib/format"
import { useRole } from "@/components/role-context"
import {
  sendMessage,
  getMessagesSince,
  assignConversation,
  uploadInboxMedia,
} from "../actions"
import { contentTypeFromMime, type MediaContentType } from "@/lib/media-utils"
import {
  clientSafeErrorMessage,
  isActionFailure,
} from "@/lib/error-handling"
import { convertImageToStickerWebp } from "@/lib/client-media"
import { ContactPanel } from "./contact-panel"
import { AttachmentMenu, type AttachmentKey } from "./attachment-menu"
import { CameraCaptureModal } from "./camera-capture-modal"
import { ContactPickerModal } from "./contact-picker-modal"
import {
  LocationPickerModal,
  type PickedLocation,
} from "./location-picker-modal"

type Message = {
  id: string
  senderType: "CUSTOMER" | "AGENT" | "BOT"
  contentType:
    | "TEXT"
    | "IMAGE"
    | "VIDEO"
    | "AUDIO"
    | "DOCUMENT"
    | "STICKER"
    | "CONTACT"
    | "LOCATION"
    | "TEMPLATE"
    | "INTERACTIVE"
  contentText: string | null
  mediaUrl: string | null
  metadata?: unknown
  createdAt: Date | string
  status?: "SENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED"
  errorMessage?: string | null
}

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

type Member = { id: string; name: string | null; email: string }

interface ContactMetadata {
  name?: string
  phone?: string
}
function isContactMetadata(value: unknown): value is ContactMetadata {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

interface LocationMetadata {
  latitude: number
  longitude: number
  name?: string
  address?: string
}
function isLocationMetadata(value: unknown): value is LocationMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false
  const candidate = value as { latitude?: unknown; longitude?: unknown }
  return (
    typeof candidate.latitude === "number" &&
    typeof candidate.longitude === "number"
  )
}

function buildBoundingBox(lat: number, lng: number, delta = 0.01) {
  return `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`
}

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

// Prefers webm/opus (Chrome/Firefox/Edge), falls back gracefully for
// browsers that don't support it (notably older Safari).
function pickAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined") return ""
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ]
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported?.(c)) return c
  }
  return ""
}

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((m) => [m.id, m]))
  for (const msg of incoming) byId.set(msg.id, msg)
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
}

function deliveryStatusLabel(status: Message["status"]) {
  if (status === "SENDING") return "Sending…"
  if (status === "SENT") return "Sent"
  if (status === "DELIVERED") return "Delivered"
  if (status === "READ") return "Read"
  return null
}

function MessageContent({ m }: { m: Message }) {
  if (m.contentType === "IMAGE" && m.mediaUrl) {
    return (
      <div>
        <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer">
          <Image
            src={m.mediaUrl}
            alt={m.contentText ?? "Image"}
            width={240}
            height={256}
            unoptimized
            className="max-h-64 max-w-[240px] rounded-lg object-cover"
          />
        </a>
        {m.contentText && <p className="mt-1.5">{m.contentText}</p>}
      </div>
    )
  }
  if (m.contentType === "STICKER" && m.mediaUrl) {
    return (
      <Image
        src={m.mediaUrl}
        alt="Sticker"
        width={128}
        height={128}
        unoptimized
        className="h-32 w-32 object-contain"
      />
    )
  }
  if (m.contentType === "VIDEO" && m.mediaUrl) {
    return (
      <div>
        <video
          src={m.mediaUrl}
          controls
          className="max-h-64 max-w-[240px] rounded-lg"
        />
        {m.contentText && <p className="mt-1.5">{m.contentText}</p>}
      </div>
    )
  }
  if (m.contentType === "AUDIO" && m.mediaUrl) {
    return <audio src={m.mediaUrl} controls className="max-w-[240px]" />
  }
  if (m.contentType === "DOCUMENT" && m.mediaUrl) {
    return (
      <a
        href={m.mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 underline"
      >
        <Paperclip size={14} />
        {m.contentText || "Document"}
      </a>
    )
  }
  if (m.contentType === "CONTACT") {
    const meta = isContactMetadata(m.metadata) ? m.metadata : null
    return (
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
          style={{ background: "var(--jade-dark)", color: "white" }}
        >
          {(meta?.name || "?")[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-medium">{meta?.name}</p>
          <p className="font-[family-name:var(--font-code)] text-xs opacity-80">
            {meta?.phone}
          </p>
        </div>
      </div>
    )
  }
  if (m.contentType === "LOCATION") {
    const meta = isLocationMetadata(m.metadata) ? m.metadata : null
    if (!meta) return <p>📍 Location</p>
    return (
      <div>
        <iframe
          title="Location"
          width="220"
          height="140"
          style={{ border: 0, borderRadius: 8, display: "block" }}
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${buildBoundingBox(meta.latitude, meta.longitude)}&layer=mapnik&marker=${meta.latitude},${meta.longitude}`}
        />
        {(meta.name || meta.address) && (
          <p className="mt-1.5 text-xs">
            {meta.name}
            {meta.name && meta.address ? " — " : ""}
            {meta.address}
          </p>
        )}
        <a
          href={`https://www.google.com/maps?q=${meta.latitude},${meta.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block text-xs underline"
        >
          Open in Maps
        </a>
      </div>
    )
  }
  return <p>{m.contentText}</p>
}

export function Thread({
  conversationId,
  contact,
  assignedAgentId,
  members,
  initialMessages,
}: {
  conversationId: string
  contact: Contact
  assignedAgentId: string | null
  members: Member[]
  initialMessages: Message[]
}) {
  const router = useRouter()
  const { canWrite } = useRole()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [draft, setDraft] = useState("")
  const [selectedFile, setSelectedFile] = useState<{
    file: File
    isSticker: boolean
  } | null>(null)
  const [selectedContact, setSelectedContact] = useState<{
    name: string
    phone: string
  } | null>(null)

  const [selectedLocation, setSelectedLocation] =
    useState<PickedLocation | null>(null)
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)

  const [cameraOpen, setCameraOpen] = useState(false)
  const [contactPickerOpen, setContactPickerOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [assignee, setAssignee] = useState(assignedAgentId ?? "")
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [micError, setMicError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pollingError, setPollingError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const stickerInputRef = useRef<HTMLInputElement>(null)
  const sendingRef = useRef(false)
  const lastCreatedAtRef = useRef<string>(
    initialMessages.length
      ? String(initialMessages.at(-1)!.createdAt)
      : new Date(0).toISOString()
  )

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const micStreamRef = useRef<MediaStream | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingCancelledRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function pollMessages() {
      try {
        const fresh = await getMessagesSince(
          conversationId,
          lastCreatedAtRef.current
        )
        if (cancelled) return
        setPollingError(null)
        if (fresh.length > 0) {
          setMessages((prev) => mergeMessages(prev, fresh as Message[]))
          lastCreatedAtRef.current = String(fresh.at(-1)!.createdAt)
        }
      } catch (reason) {
        if (cancelled) return
        console.error("[wacrm] Message polling failed", reason)
        setPollingError("Live updates are temporarily unavailable.")
      }
    }

    const interval = setInterval(() => void pollMessages(), 4000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Cleanup if the agent navigates away mid-recording.
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      micStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function handleAssignChange(userId: string) {
    const previousAssignee = assignee
    setAssignee(userId)
    setActionError(null)
    startTransition(async () => {
      try {
        await assignConversation(conversationId, userId)
      } catch (reason) {
        console.error("[wacrm] Conversation assignment failed", reason)
        setAssignee(previousAssignee)
        setActionError("We couldn't update the assignment. Please try again.")
      }
    })
  }

  function handleAttachmentPick(key: AttachmentKey) {
    if (key === "gallery") galleryInputRef.current?.click()
    else if (key === "document") documentInputRef.current?.click()
    else if (key === "audio") audioInputRef.current?.click()
    else if (key === "sticker") stickerInputRef.current?.click()
    else if (key === "camera") setCameraOpen(true)
    else if (key === "contact") setContactPickerOpen(true)
    else if (key === "location") setLocationPickerOpen(true)
  }

  function handleFilePick(
    e: React.ChangeEvent<HTMLInputElement>,
    isSticker: boolean
  ) {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile({ file, isSticker })
      setSelectedContact(null)
      setSelectedLocation(null)
    }
    e.target.value = ""
  }

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current
    if (!textarea) {
      setDraft((d) => d + emoji)
      return
    }

    const start = textarea.selectionStart ?? draft.length
    const end = textarea.selectionEnd ?? draft.length
    const next = draft.slice(0, start) + emoji + draft.slice(end)
    setDraft(next)

    requestAnimationFrame(() => {
      textarea.focus()
      const pos = start + emoji.length
      textarea.setSelectionRange(pos, pos)
    })
  }

  async function handleMicDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (isRecording) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setMicError(null)

    if (typeof MediaRecorder === "undefined") {
      setMicError("Voice recording isn't supported in this browser.")
      return
    }

    recordingCancelledRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream
      recordedChunksRef.current = []

      const mimeType = pickAudioMimeType()
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      )

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data)
      }
      recorder.onstop = () => {
        micStreamRef.current?.getTracks().forEach((t) => t.stop())
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
        setIsRecording(false)

        if (
          !recordingCancelledRef.current &&
          recordedChunksRef.current.length > 0
        ) {
          // Strip any codec suffix (e.g. ";codecs=opus") — only the base
          // type matters for routing this through the same convert-on-upload
          // path used elsewhere.
          const baseType = (recorder.mimeType || "audio/webm").split(";")[0]
          const ext = baseType.split("/")[1] || "webm"
          const blob = new Blob(recordedChunksRef.current, { type: baseType })
          const file = new File([blob], `voice-${Date.now()}.${ext}`, {
            type: baseType,
          })
          sendVoiceNote(file)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(
        () => setRecordingSeconds((s) => s + 1),
        1000
      )
    } catch {
      setMicError(
        "Microphone access denied — check your browser's permission for this site."
      )
    }
  }

  function handleMicUp() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop()
    }
  }

  function handleCancelRecording() {
    recordingCancelledRef.current = true
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop()
    }
  }

  function sendVoiceNote(file: File) {
    if (sendingRef.current) return
    sendingRef.current = true
    setActionError(null)

    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const localPreviewUrl = URL.createObjectURL(file)
    const optimistic: Message = {
      id: tempId,
      senderType: "AGENT",
      contentType: "AUDIO",
      contentText: null,
      mediaUrl: localPreviewUrl,
      createdAt: new Date().toISOString(),
      status: "SENDING",
    }
    setMessages((prev) => [...prev, optimistic])

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append("file", file)
        const uploaded = await uploadInboxMedia(formData)
        if (isActionFailure(uploaded)) {
          setActionError(uploaded.error)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    status: "FAILED" as const,
                    errorMessage: uploaded.error,
                  }
                : m
            )
          )
          return
        }
        const media = {
          url: uploaded.url,
          contentType: uploaded.contentType,
          filename: uploaded.filename,
        }
        const saved = await sendMessage(conversationId, "", media)
        if (isActionFailure(saved)) {
          setActionError(saved.error)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    status: "FAILED" as const,
                    errorMessage: saved.error,
                  }
                : m
            )
          )
          return
        }
        const savedMessage = saved as Message & {
          deliveryNote?: string
          delivered?: boolean
        }
        setMessages((prev) =>
          mergeMessages(
            prev.filter((m) => m.id !== tempId),
            [savedMessage]
          )
        )
        lastCreatedAtRef.current = String(savedMessage.createdAt)
        if (savedMessage.status === "FAILED") {
          setActionError(
            savedMessage.errorMessage ??
              savedMessage.deliveryNote ??
              "This voice note was not delivered."
          )
        }
      } catch (reason) {
        console.error("[wacrm] Voice note send failed", reason)
        const message = clientSafeErrorMessage(
          reason,
          "This voice note could not be sent."
        )
        setActionError(message)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  status: "FAILED" as const,
                  errorMessage: message,
                }
              : m
          )
        )
      } finally {
        sendingRef.current = false
        URL.revokeObjectURL(localPreviewUrl)
      }
    })
  }

  function handleSend() {
    const text = draft.trim()
    if (
      (!text && !selectedFile && !selectedContact && !selectedLocation) ||
      sendingRef.current
    )
      return
    sendingRef.current = true
    setActionError(null)

    const fileToSend = selectedFile
    const contactToSend = selectedContact
    const locationToSend = selectedLocation
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const localPreviewUrl = fileToSend
      ? URL.createObjectURL(fileToSend.file)
      : null

    const optimisticContentType: Message["contentType"] = locationToSend
      ? "LOCATION"
      : contactToSend
        ? "CONTACT"
        : fileToSend
          ? fileToSend.isSticker
            ? "STICKER"
            : contentTypeFromMime(fileToSend.file.type)
          : "TEXT"

    const optimistic: Message = {
      id: tempId,
      senderType: "AGENT",
      contentType: optimisticContentType,
      contentText: locationToSend
        ? (locationToSend.address ?? "Location")
        : contactToSend
          ? contactToSend.name
          : text || (fileToSend?.file.name ?? null),
      mediaUrl: localPreviewUrl,
      metadata: locationToSend ?? contactToSend ?? null,
      createdAt: new Date().toISOString(),
      status: "SENDING",
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft("")
    setSelectedFile(null)
    setSelectedContact(null)
    setSelectedLocation(null)

    startTransition(async () => {
      try {
        let media:
          | { url: string; contentType: MediaContentType; filename?: string }
          | undefined
        if (fileToSend) {
          const fileForUpload = fileToSend.isSticker
            ? await convertImageToStickerWebp(fileToSend.file)
            : fileToSend.file
          const formData = new FormData()
          formData.append("file", fileForUpload)
          if (fileToSend.isSticker) formData.append("asSticker", "true")
          const uploaded = await uploadInboxMedia(formData)
          if (isActionFailure(uploaded)) {
            setActionError(uploaded.error)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId
                  ? {
                      ...m,
                      status: "FAILED" as const,
                      errorMessage: uploaded.error,
                    }
                  : m
              )
            )
            return
          }
          media = {
            url: uploaded.url,
            contentType: uploaded.contentType,
            filename: fileForUpload.name,
          }
        }
        const saved = await sendMessage(
          conversationId,
          text,
          media,
          contactToSend ?? undefined,
          locationToSend ?? undefined
        )
        if (isActionFailure(saved)) {
          setActionError(saved.error)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    status: "FAILED" as const,
                    errorMessage: saved.error,
                  }
                : m
            )
          )
          return
        }
        const savedMessage = saved as Message & {
          deliveryNote?: string
          delivered?: boolean
        }
        setMessages((prev) =>
          mergeMessages(
            prev.filter((m) => m.id !== tempId),
            [savedMessage]
          )
        )
        lastCreatedAtRef.current = String(savedMessage.createdAt)
        if (savedMessage.status === "FAILED") {
          setActionError(
            savedMessage.errorMessage ??
              savedMessage.deliveryNote ??
              "This message was not delivered."
          )
        }
      } catch (reason) {
        console.error("[wacrm] Message send failed", reason)
        const message = clientSafeErrorMessage(
          reason,
          "This message could not be sent."
        )
        setActionError(message)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  status: "FAILED" as const,
                  errorMessage: message,
                }
              : m
          )
        )
      } finally {
        sendingRef.current = false
        if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl)
      }
    })
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b px-3 py-3 sm:gap-3 sm:px-6 sm:py-4"
          style={{
            borderColor: "var(--line)",
            background: "var(--paper-raised)",
          }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Back to conversations"
              onClick={() => router.push("/inbox")}
              className="rounded-xl p-2 md:hidden"
              style={{ color: "var(--ink-soft)" }}
            >
              <ArrowLeft size={17} />
            </button>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium"
              style={{ background: "var(--jade-dark)", color: "white" }}
            >
              {initials(contact.name, contact.phone)}
            </div>
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--ink)" }}
              >
                {contact.name || contact.phone}
              </p>
              <p
                className="font-[family-name:var(--font-code)] text-xs"
                style={{ color: "var(--ink-soft)" }}
              >
                {contact.phone}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canWrite ? (
              <Select
                value={assignee || "UNASSIGNED"}
                onValueChange={(value) =>
                  handleAssignChange(value === "UNASSIGNED" ? "" : value)
                }
                disabled={isPending}
              >
                <SelectTrigger
                  className="h-9 w-[140px] sm:w-[180px]"
                  aria-label="Assign conversation"
                >
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span
                className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium"
                style={{ background: "var(--paper)", color: "var(--ink-soft)" }}
              >
                {assignee
                  ? `Assigned to ${members.find((m) => m.id === assignee)?.name || members.find((m) => m.id === assignee)?.email || "agent"}`
                  : "Unassigned"}
              </span>
            )}
            <Button
              variant={panelOpen ? "secondary" : "outline"}
              size="lg"
              onClick={() => setPanelOpen((o) => !o)}
              aria-expanded={panelOpen}
            >
              <User size={14} />
              <span className="hidden sm:inline">View profile</span>
            </Button>
          </div>
        </div>

        {(actionError || pollingError) && (
          <div
            role="alert"
            className="flex shrink-0 items-center justify-between gap-3 border-b px-6 py-2.5 text-xs"
            style={{
              borderColor: "var(--line)",
              background: actionError
                ? "var(--coral-soft)"
                : "var(--amber-soft)",
              color: actionError ? "var(--coral)" : "var(--amber)",
            }}
          >
            <span>{actionError ?? pollingError}</span>
            <button
              type="button"
              className="rounded-lg px-2 py-1 font-semibold"
              style={{ background: "rgba(255,255,255,0.7)" }}
              onClick={() => {
                setActionError(null)
                setPollingError(null)
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {messages.map((m) => {
            const fromAgent = m.senderType !== "CUSTOMER"
            return (
              <div
                key={m.id}
                className={`flex ${fromAgent ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-snug shadow-sm sm:max-w-[70%]"
                  style={{
                    background: fromAgent
                      ? "var(--jade)"
                      : "var(--paper-raised)",
                    color: fromAgent ? "white" : "var(--ink)",
                    border: fromAgent ? "none" : "1px solid var(--line)",
                  }}
                >
                  <MessageContent m={m} />
                  <p
                    className="mt-1 text-right text-[10px]"
                    style={{
                      color: fromAgent
                        ? "rgba(255,255,255,0.7)"
                        : "var(--ink-soft)",
                    }}
                  >
                    {formatMessageTime(m.createdAt)}
                  </p>
                  {fromAgent && deliveryStatusLabel(m.status) && (
                    <p
                      className="mt-0.5 text-right text-[10px]"
                      style={{ color: "rgba(255,255,255,0.7)" }}
                    >
                      {deliveryStatusLabel(m.status)}
                    </p>
                  )}
                  {m.status === "FAILED" && (
                    <p
                      className="mt-0.5 text-right text-[10px]"
                      style={{ color: "#FFD7CE" }}
                    >
                      {m.errorMessage || "Not delivered"}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {selectedFile && (
          <div
            className="shrink-0 px-6 pt-3"
            style={{ background: "var(--paper-raised)" }}
          >
            <span
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
              style={{
                background: "var(--jade-soft)",
                color: "var(--jade-dark)",
              }}
            >
              <Paperclip size={12} />
              {selectedFile.isSticker ? "Sticker" : selectedFile.file.name}
              <button onClick={() => setSelectedFile(null)}>
                <X size={12} />
              </button>
            </span>
          </div>
        )}
        {selectedContact && (
          <div
            className="shrink-0 px-6 pt-3"
            style={{ background: "var(--paper-raised)" }}
          >
            <span
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
              style={{
                background: "var(--jade-soft)",
                color: "var(--jade-dark)",
              }}
            >
              <User size={12} />
              {selectedContact.name}
              <button onClick={() => setSelectedContact(null)}>
                <X size={12} />
              </button>
            </span>
          </div>
        )}
        {selectedLocation && (
          <div
            className="shrink-0 px-6 pt-3"
            style={{ background: "var(--paper-raised)" }}
          >
            <span
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
              style={{
                background: "var(--jade-soft)",
                color: "var(--jade-dark)",
              }}
            >
              📍{" "}
              {selectedLocation.address ||
                `Pinned location (${selectedLocation.latitude.toFixed(4)}, ${selectedLocation.longitude.toFixed(4)})`}
              <button onClick={() => setSelectedLocation(null)}>
                <X size={12} />
              </button>
            </span>
          </div>
        )}

        {micError && (
          <p className="shrink-0 px-6 pt-2 text-xs" style={{ color: "var(--coral)" }}>
            {micError}
          </p>
        )}

        {canWrite ? (
        <div
          className="flex shrink-0 items-end gap-1.5 border-t px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-3 sm:px-6 sm:pt-4 sm:pb-4"
          style={{
            borderColor: "var(--line)",
            background: "var(--paper-raised)",
          }}
        >
          <input
            ref={galleryInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*"
            onChange={(e) => handleFilePick(e, false)}
          />
          <input
            ref={documentInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            onChange={(e) => handleFilePick(e, false)}
          />
          <input
            ref={audioInputRef}
            type="file"
            className="hidden"
            accept="audio/*"
            onChange={(e) => handleFilePick(e, false)}
          />
          <input
            ref={stickerInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => handleFilePick(e, true)}
          />

          <div
            style={{
              opacity: isRecording ? 0.4 : 1,
              pointerEvents: isRecording ? "none" : "auto",
            }}
          >
            <AttachmentMenu onPick={handleAttachmentPick} />
          </div>

          {!isRecording && (
            <div className="relative">
              <button
                onClick={() => setEmojiOpen((o) => !o)}
                title="Emoji"
                className="shrink-0 rounded-lg p-2.5"
                style={{
                  border: "1px solid var(--line)",
                  color: "var(--ink-soft)",
                }}
              >
                <Smile size={16} />
              </button>
              {emojiOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setEmojiOpen(false)}
                  />
                  <div className="absolute bottom-12 left-0 z-20 overflow-hidden rounded-xl shadow-lg">
                    <EmojiPicker
                      theme={Theme.LIGHT}
                      width={320}
                      height={380}
                      lazyLoadEmojis
                      skinTonesDisabled
                      onEmojiClick={(emojiData: EmojiClickData) =>
                        insertEmoji(emojiData.emoji)
                      }
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {isRecording ? (
            <div className="flex flex-1 items-center gap-3 py-2">
              <button
                onClick={handleCancelRecording}
                className="rounded-lg p-2"
                style={{
                  border: "1px solid var(--coral)",
                  color: "var(--coral)",
                }}
              >
                <Trash2 size={15} />
              </button>
              <span
                className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full"
                style={{ background: "var(--coral)" }}
              />
              <span
                className="font-[family-name:var(--font-code)] text-sm"
                style={{ color: "var(--ink)" }}
              >
                {formatDuration(recordingSeconds)}
              </span>
              <span className="text-xs" style={{ color: "var(--ink-soft)" }}>
                Recording… release mic to send
              </span>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Write a message…"
              rows={1}
              className="min-w-0 flex-1 resize-none rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{
                border: "1px solid var(--line)",
                background: "var(--paper)",
                color: "var(--ink)",
              }}
            />
          )}

          <button
            onPointerDown={handleMicDown}
            onPointerUp={handleMicUp}
            onPointerCancel={handleMicUp}
            title="Hold to record a voice message"
            className="shrink-0 rounded-full p-3"
            style={{
              background: isRecording ? "var(--coral)" : "var(--paper)",
              border: isRecording ? "none" : "1px solid var(--line)",
              touchAction: "none",
            }}
          >
            <Mic size={16} color={isRecording ? "white" : "var(--ink-soft)"} />
          </button>

          {!isRecording && (
            <Button
              size="lg"
              onClick={handleSend}
              disabled={
                isPending ||
                (!draft.trim() &&
                  !selectedFile &&
                  !selectedContact &&
                  !selectedLocation)
              }
            >
              Send
            </Button>
          )}
        </div>
        ) : (
          <div
            className="flex shrink-0 items-center justify-center gap-2 border-t px-6 py-4 text-xs"
            style={{
              borderColor: "var(--line)",
              background: "var(--paper-raised)",
              color: "var(--ink-soft)",
            }}
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full"
              style={{ background: "var(--paper)", color: "var(--ink-soft)" }}
            >
              <User size={13} />
            </span>
            You have read-only access to this conversation.
          </div>
        )}
      </div>

      {panelOpen && (
        <div className="absolute inset-y-0 right-0 z-30 w-full max-w-sm shadow-2xl md:static md:z-auto md:w-80 md:shadow-none">
          <ContactPanel
            contact={contact}
            onClose={() => setPanelOpen(false)}
            onContactUpdated={() => router.refresh()}
          />
        </div>
      )}
      {cameraOpen && (
        <CameraCaptureModal
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => {
            setSelectedFile({ file, isSticker: false })
            setSelectedContact(null)
            setSelectedLocation(null)
            setCameraOpen(false)
          }}
        />
      )}
      {contactPickerOpen && (
        <ContactPickerModal
          onClose={() => setContactPickerOpen(false)}
          onSelect={(c) => {
            setSelectedContact(c)
            setSelectedFile(null)
            setSelectedLocation(null)
            setContactPickerOpen(false)
          }}
        />
      )}
      {locationPickerOpen && (
        <LocationPickerModal
          onClose={() => setLocationPickerOpen(false)}
          onSelect={(loc) => {
            setSelectedLocation(loc)
            setSelectedFile(null)
            setSelectedContact(null)
            setLocationPickerOpen(false)
          }}
        />
      )}
    </div>
  )
}
