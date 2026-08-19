"use client"

import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  FileUp,
  Layers,
  Save,
  Send,
  SlidersHorizontal,
  Tag,
  Users,
} from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useRole } from "@/components/role-context"
import { parseCsv as parseCsvRows } from "@/lib/csv"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getApprovedTemplates,
  getTagsAndFields,
  estimateAudience,
  previewBroadcast,
  sendBroadcast,
  saveBroadcastDraft,
  type AudienceSpec,
  type VariableMapping,
} from "../actions"
import { extractVariables } from "@/lib/whatsapp/templates"

const field = {
  background: "var(--paper)",
  border: "1px solid var(--line)",
  color: "var(--ink)",
}
const card = {
  background: "var(--paper-raised)",
  border: "1px solid var(--line)",
}
const STEP_META = [
  { label: "Template", icon: FileText },
  { label: "Audience", icon: Users },
  { label: "Personalize", icon: SlidersHorizontal },
  { label: "Send", icon: Send },
]

type Template = Awaited<ReturnType<typeof getApprovedTemplates>>[number]

export default function NewBroadcastPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [templates, setTemplates] = useState<Template[]>([])
  const [tagsAndFields, setTagsAndFields] = useState<
    Awaited<ReturnType<typeof getTagsAndFields>>
  >({ tags: [], customFields: [], categories: [] })
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  )
  const [audience, setAudience] = useState<AudienceSpec>({ mode: "ALL" })
  const [csvText, setCsvText] = useState("")
  const [mapping, setMapping] = useState<VariableMapping>([])
  const [preview, setPreview] = useState<{
    previewText: string
    previewContactName: string | null
    recipientCount: number
  } | null>(null)
  const [audienceCount, setAudienceCount] = useState(0)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [isPending, startTransition] = useTransition()
  const { canWrite } = useRole()

  useEffect(() => {
    let active = true
    Promise.all([getApprovedTemplates(), getTagsAndFields()])
      .then(([approvedTemplates, nextTagsAndFields]) => {
        if (!active) return
        setTemplates(approvedTemplates)
        setTagsAndFields(nextTagsAndFields)
      })
      .catch((reason) => {
        console.error("[wacrm] Broadcast setup load failed", reason)
        if (active)
          setError("We couldn't load broadcast setup data. Please try again.")
      })
      .finally(() => {
        if (active) setLoadingData(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    estimateAudience(audience)
      .then((result) => {
        if (active) setAudienceCount(result.count)
      })
      .catch((reason) => {
        console.error("[wacrm] Audience estimate failed", reason)
        if (active) setError("We couldn't estimate this audience.")
      })
    return () => {
      active = false
    }
  }, [audience])

  useEffect(() => {
    if (!selectedTemplate || step !== 2) return
    let active = true
    previewBroadcast(selectedTemplate.id, mapping, audience)
      .then((result) => {
        if (active && !("error" in result)) setPreview(result)
        if (active && "error" in result && result.error) setError(result.error)
      })
      .catch((reason) => {
        console.error("[wacrm] Broadcast preview failed", reason)
        if (active) setError("We couldn't generate a preview.")
      })
    return () => {
      active = false
    }
  }, [selectedTemplate, mapping, audience, step])

  function selectTemplate(t: Template) {
    setSelectedTemplate(t)
    const vars = extractVariables(t.bodyText)
    setMapping(
      vars.map((v) => ({ variable: v, source: "static" as const, value: "" }))
    )
  }

  function updateMapping(
    variable: number,
    patch: Partial<VariableMapping[number]>
  ) {
    setMapping((prev) =>
      prev.map((m) => (m.variable === variable ? { ...m, ...patch } : m))
    )
  }

  function parseCsv(text: string) {
    const rows = parseCsvRows(text)
    if (rows.length === 0) return []
    const header = rows[0].map((value) =>
      value
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase()
    )
    const phoneIdx = header.indexOf("phone")
    const nameIdx = header.indexOf("name")
    if (phoneIdx === -1) return []
    return rows
      .slice(1)
      .map((columns) => ({
        phone: columns[phoneIdx]?.trim() ?? "",
        name: nameIdx >= 0 ? columns[nameIdx]?.trim() : undefined,
      }))
      .filter((row) => row.phone)
  }

  function handleCsvUpload(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result)
      const contacts = parseCsv(text)
      setCsvText(text)
      if (contacts.length === 0) {
        setError("The CSV needs a phone column and at least one valid row.")
        return
      }
      setError(null)
      setAudience({ mode: "CSV", contacts })
    }
    reader.readAsText(file)
  }

  function handleSend() {
    if (!selectedTemplate) return
    setError(null)
    startTransition(async () => {
      try {
        const result = await sendBroadcast(
          name,
          selectedTemplate.id,
          audience,
          mapping
        )
        if (result.error) {
          setError(result.error)
          return
        }
        router.push("/broadcasts?queued=1")
      } catch (reason) {
        console.error("[wacrm] Broadcast send failed", reason)
        setError("We couldn't send this broadcast. Please try again.")
      }
    })
  }

  function handleSaveDraft() {
    if (!selectedTemplate) return
    setError(null)
    startTransition(async () => {
      try {
        const result = await saveBroadcastDraft(
          name,
          selectedTemplate.id,
          audience,
          mapping
        )
        if (result.error) {
          setError(result.error)
          return
        }
        router.push("/broadcasts")
      } catch (reason) {
        console.error("[wacrm] Broadcast draft save failed", reason)
        setError("We couldn't save this draft. Please try again.")
      }
    })
  }

  if (!canWrite) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)] px-6 py-16 text-center">
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          You have read-only access
        </p>
        <p className="mt-2 max-w-sm text-sm leading-6" style={{ color: "var(--ink-soft)" }}>
          Viewers can&apos;t create broadcasts. Ask an agent or administrator to
          set this campaign up.
        </p>
      </div>
    )
  }

  if (loadingData) {
    return (
      <div className="space-y-5">
        <div
          className="h-10 w-64 animate-pulse rounded-xl"
          style={{ background: "var(--line)" }}
        />
        <div
          className="h-5 w-96 max-w-full animate-pulse rounded"
          style={{ background: "var(--paper)" }}
        />
        <div
          className="h-72 animate-pulse rounded-2xl"
          style={{ background: "var(--paper-raised)" }}
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Campaign builder"
        title="New broadcast"
        description="Create and send an approved WhatsApp template to the right audience."
      />

      <div className="mb-8 flex w-full items-center gap-1 sm:gap-2">
        {STEP_META.map((s, i) => {
          const done = i < step
          const active = i === step
          const Icon = s.icon
          return (
            <div
              key={s.label}
              className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2"
            >
              <div
                className="flex items-center gap-2"
                style={{
                  color: active ? "var(--jade-dark)" : "var(--ink-soft)",
                }}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: done
                      ? "var(--jade)"
                      : active
                        ? "var(--jade-soft)"
                        : "var(--line)",
                    color: done ? "white" : active ? "var(--jade-dark)" : "var(--ink-soft)",
                    boxShadow: active ? "0 0 0 4px rgba(31,111,92,0.12)" : "none",
                  }}
                >
                  {done ? <Check size={14} /> : <Icon size={14} />}
                </span>
                <span
                  className={`hidden truncate text-xs font-medium sm:inline sm:text-sm ${active ? "font-semibold" : ""}`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEP_META.length - 1 && (
                <div
                  className="h-px min-w-2 flex-1"
                  style={{ background: done ? "var(--jade)" : "var(--line)" }}
                />
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <p
          className="mb-4 rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
        >
          {error}
        </p>
      )}

      {step === 0 && (
        <div>
          <h2
            className="mb-1 text-lg font-medium"
            style={{ color: "var(--ink)" }}
          >
            Choose a Template
          </h2>
          <p className="mb-4 text-sm" style={{ color: "var(--ink-soft)" }}>
            Select an approved message template for your broadcast.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {templates.map((t) => {
              const selected = selectedTemplate?.id === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className="group rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5"
                  style={{
                    ...card,
                    borderColor: selected ? "var(--jade)" : "var(--line)",
                    boxShadow: selected
                      ? "0 0 0 1px var(--jade), var(--shadow-card)"
                      : "var(--shadow-card)",
                    background: selected ? "color-mix(in_oklch, var(--jade-soft), var(--paper-raised) 60%)" : "var(--paper-raised)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        background: selected ? "var(--jade)" : "var(--jade-soft)",
                        color: selected ? "white" : "var(--jade-dark)",
                      }}
                    >
                      <FileText size={18} />
                    </span>
                    {selected && (
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--jade)] text-white"
                      >
                        <Check size={13} />
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span
                      className="truncate text-sm font-semibold"
                      style={{ color: "var(--ink)" }}
                    >
                      {t.name}
                    </span>
                  </div>
                  <p
                    className="mt-1 line-clamp-2 text-sm leading-5"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {t.bodyText}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{t.category}</Badge>
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      {t.language}
                    </span>
                  </div>
                </button>
              )
            })}
            {templates.length === 0 && (
              <p
                className="col-span-full text-sm"
                style={{ color: "var(--ink-soft)" }}
              >
                No approved templates yet. Create one in Settings → Templates.
              </p>
            )}
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <h2
            className="mb-1 text-lg font-medium"
            style={{ color: "var(--ink)" }}
          >
            Select Audience
          </h2>
          <p className="mb-4 text-sm" style={{ color: "var(--ink-soft)" }}>
            Choose who will receive this broadcast.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <AudienceOption
              selected={audience.mode === "ALL"}
              onClick={() => setAudience({ mode: "ALL" })}
              icon={<Users size={18} />}
              title="All Contacts"
              description="Send to every contact in your database"
            />
            <AudienceOption
              selected={audience.mode === "TAGS"}
              onClick={() => setAudience({ mode: "TAGS", tagIds: [] })}
              icon={<Tag size={18} />}
              title="Filter by Tags"
              description="Target contacts with specific tags"
            />
            <AudienceOption
              selected={audience.mode === "CUSTOM_FIELD"}
              onClick={() =>
                setAudience({
                  mode: "CUSTOM_FIELD",
                  fieldId: tagsAndFields.customFields[0]?.id ?? "",
                  value: "",
                })
              }
              icon={<SlidersHorizontal size={18} />}
              title="Custom Field"
              description="Filter by a custom field value"
            />
            <AudienceOption
              selected={audience.mode === "CATEGORY"}
              onClick={() =>
                setAudience({
                  mode: "CATEGORY",
                  category: tagsAndFields.categories[0]?.name ?? "",
                })
              }
              icon={<Layers size={18} />}
              title="Filter by Category"
              description="Target contacts in a specific category"
            />
            <label
              className="group cursor-pointer rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5"
              style={{
                ...card,
                borderColor:
                  audience.mode === "CSV" ? "var(--jade)" : "var(--line)",
                boxShadow: audience.mode === "CSV" ? "0 0 0 1px var(--jade), var(--shadow-card)" : "var(--shadow-card)",
                background:
                  audience.mode === "CSV"
                    ? "color-mix(in_oklch, var(--jade-soft), var(--paper-raised) 60%)"
                    : "var(--paper-raised)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background:
                      audience.mode === "CSV" ? "var(--jade)" : "var(--jade-soft)",
                    color:
                      audience.mode === "CSV" ? "white" : "var(--jade-dark)",
                  }}
                >
                  <FileUp size={18} />
                </span>
                {audience.mode === "CSV" && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--jade)] text-white">
                    <Check size={13} />
                  </span>
                )}
              </div>
              <p className="mt-4 text-sm font-semibold" style={{ color: "var(--ink)" }}>
                Upload CSV
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
                Upload a list of phone numbers (columns: phone, name)
              </p>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && handleCsvUpload(e.target.files[0])
                }
              />
            </label>
          </div>

          {audience.mode === "TAGS" && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tagsAndFields.tags.map((t) => {
                const selected = audience.tagIds.includes(t.id)
                return (
                  <button
                    key={t.id}
                    onClick={() =>
                      setAudience({
                        mode: "TAGS",
                        tagIds: selected
                          ? audience.tagIds.filter((id) => id !== t.id)
                          : [...audience.tagIds, t.id],
                      })
                    }
                    className="rounded-full px-3 py-1 text-xs"
                    style={{
                      background: selected ? "var(--jade)" : "var(--paper)",
                      color: selected ? "white" : "var(--ink-soft)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    {t.name}
                  </button>
                )
              })}
              {tagsAndFields.tags.length === 0 && (
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                  No tags available.
                </p>
              )}
            </div>
          )}

          {audience.mode === "CUSTOM_FIELD" && (
            <div className="mt-4 flex gap-2">
              <Select
                value={audience.fieldId || undefined}
                onValueChange={(value) =>
                  setAudience({
                    mode: "CUSTOM_FIELD",
                    fieldId: value,
                    value: audience.value,
                  })
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Field" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {tagsAndFields.customFields.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.fieldName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                value={audience.value}
                onChange={(e) =>
                  setAudience({
                    mode: "CUSTOM_FIELD",
                    fieldId: audience.fieldId,
                    value: e.target.value,
                  })
                }
                placeholder="Value to match"
                className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                style={field}
              />
            </div>
          )}

          {audience.mode === "CATEGORY" && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tagsAndFields.categories.map((c) => {
                const selected = audience.category === c.name
                return (
                  <button
                    key={c.id}
                    onClick={() =>
                      setAudience({ mode: "CATEGORY", category: c.name })
                    }
                    className="rounded-full px-3 py-1 text-xs"
                    style={{
                      background: selected ? "var(--jade)" : "var(--paper)",
                      color: selected ? "white" : "var(--ink-soft)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    {c.name}
                  </button>
                )
              })}
              {tagsAndFields.categories.length === 0 && (
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                  No categories available.
                </p>
              )}
            </div>
          )}

          {audience.mode === "CSV" && csvText && (
            <p className="mt-4 text-sm" style={{ color: "var(--ink-soft)" }}>
              {audience.contacts.length} rows parsed from CSV.
            </p>
          )}

          <div
            className="mt-6 flex items-center gap-4 rounded-2xl p-5"
            style={{ ...card, background: "var(--jade-soft)" }}
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--jade)] text-white"
            >
              <Users size={20} />
            </span>
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--jade-dark)" }}
              >
                Audience Summary
              </p>
              <p className="mt-0.5 text-sm" style={{ color: "var(--jade-dark)" }}>
                <strong className="font-semibold">{audienceCount}</strong>{" "}
                estimated recipients
              </p>
            </div>
          </div>
        </div>
      )}

      {step === 2 && selectedTemplate && (
        <div>
          <h2
            className="mb-1 text-lg font-medium"
            style={{ color: "var(--ink)" }}
          >
            Personalize Message
          </h2>
          <p className="mb-4 text-sm" style={{ color: "var(--ink-soft)" }}>
            Map template variables to contact fields, custom fields, or static
            values.
          </p>

          {mapping.length === 0 ? (
            <div className="rounded-xl p-4 text-center" style={card}>
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                This template has no variables to personalize.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {mapping.map((m) => (
                <div
                  key={m.variable}
                  className="flex flex-col items-stretch gap-3 rounded-xl p-4 sm:flex-row sm:items-center"
                  style={card}
                >
                  <span
                    className="font-[family-name:var(--font-code)] text-sm"
                    style={{ color: "var(--jade-dark)" }}
                  >{`{{${m.variable}}}`}</span>
                  <Select
                    value={m.source}
                    onValueChange={(source) => {
                      if (!["static", "field", "custom_field"].includes(source))
                        return
                      updateMapping(m.variable, {
                        source: source as VariableMapping[number]["source"],
                        value: "",
                      })
                    }}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="static">Static text</SelectItem>
                      <SelectItem value="field">Contact field</SelectItem>
                      <SelectItem value="custom_field">Custom field</SelectItem>
                    </SelectContent>
                  </Select>
                  {m.source === "field" ? (
                    <Select
                      value={m.value || undefined}
                      onValueChange={(value) =>
                        updateMapping(m.variable, { value })
                      }
                    >
                      <SelectTrigger className="min-w-40 flex-1">
                        <SelectValue placeholder="Select field…" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : m.source === "custom_field" ? (
                    <Select
                      value={m.value || undefined}
                      onValueChange={(value) =>
                        updateMapping(m.variable, { value })
                      }
                    >
                      <SelectTrigger className="min-w-40 flex-1">
                        <SelectValue placeholder="Select field…" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {tagsAndFields.customFields.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.fieldName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <input
                      value={m.value}
                      onChange={(e) =>
                        updateMapping(m.variable, { value: e.target.value })
                      }
                      placeholder="Static value"
                      className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                      style={field}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {preview && (
            <div className="mt-6 rounded-xl p-4" style={card}>
              <p
                className="mb-2 text-sm font-medium"
                style={{ color: "var(--ink)" }}
              >
                👁 Live Preview{" "}
                {preview.previewContactName &&
                  `(${preview.previewContactName})`}
              </p>
              <div
                className="rounded-lg p-3 text-sm"
                style={{
                  background: "var(--jade-soft)",
                  color: "var(--jade-dark)",
                }}
              >
                {preview.previewText}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && selectedTemplate && (
        <div>
          <h2
            className="mb-1 text-lg font-medium"
            style={{ color: "var(--ink)" }}
          >
            Review & Send
          </h2>
          <p className="mb-4 text-sm" style={{ color: "var(--ink-soft)" }}>
            Name your broadcast, review the details, and send.
          </p>

          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Summer Sale Announcement"
            className="mb-4 h-11 w-full"
          />

          <div
            className="grid grid-cols-1 gap-4 rounded-2xl p-5 sm:grid-cols-2"
            style={card}
          >
            <div>
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                Template
              </p>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--ink)" }}
              >
                {selectedTemplate.name}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                Audience
              </p>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--ink)" }}
              >
                {audience.mode.replace("_", " ")}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                Estimated reach
              </p>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--ink)" }}
              >
                {audienceCount}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                Language
              </p>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--ink)" }}
              >
                {selectedTemplate.language}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              size="lg"
              onClick={handleSaveDraft}
              disabled={isPending || !name.trim()}
            >
              <Save size={15} /> Save as Draft
            </Button>
            <Button
              size="lg"
              onClick={handleSend}
              disabled={isPending || !name.trim()}
            >
              {isPending ? (
                "Queuing…"
              ) : (
                <>
                  <Send size={15} /> Send in background
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between border-t pt-6" style={{ borderColor: "var(--line)" }}>
        <Button
          variant="outline"
          size="lg"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft size={15} /> Back
        </Button>
        {step < 3 && (
          <Button
            size="lg"
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 0 && !selectedTemplate}
          >
            Next <ArrowRight size={15} />
          </Button>
        )}
      </div>
    </div>
  )
}

function AudienceOption({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5"
      style={{
        ...card,
        borderColor: selected ? "var(--jade)" : "var(--line)",
        boxShadow: selected
          ? "0 0 0 1px var(--jade), var(--shadow-card)"
          : "var(--shadow-card)",
        background: selected
          ? "color-mix(in_oklch, var(--jade-soft), var(--paper-raised) 60%)"
          : "var(--paper-raised)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: selected ? "var(--jade)" : "var(--jade-soft)",
            color: selected ? "white" : "var(--jade-dark)",
          }}
        >
          {icon}
        </span>
        {selected && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--jade)] text-white">
            <Check size={13} />
          </span>
        )}
      </div>
      <p className="mt-4 text-sm font-semibold" style={{ color: "var(--ink)" }}>
        {title}
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
        {description}
      </p>
    </button>
  )
}
