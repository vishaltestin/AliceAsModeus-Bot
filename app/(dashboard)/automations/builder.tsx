"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Zap,
  MessageCircle,
  Hash,
  UserPlus,
  UserCheck,
  Tag as TagIcon,
  MessageSquare,
  Pencil,
  Webhook as WebhookIcon,
  XCircle,
  Hourglass,
  GitBranch,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import {
  saveAutomation,
  testRunAutomation,
  type StepNode,
  type TriggerType,
} from "./actions"
import { getContacts } from "@/app/(dashboard)/contacts/actions"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const TRIGGER_OPTIONS: {
  value: TriggerType
  label: string
  help: string
  icon: typeof Zap
}[] = [
  {
    value: "NEW_MESSAGE_RECEIVED",
    label: "New Message Received",
    help: "Any inbound WhatsApp message, from any contact.",
    icon: Zap,
  },
  {
    value: "FIRST_MESSAGE_FROM_CONTACT",
    label: "First Message from Contact",
    help: "First time this contact ever messages you (works for manually-added contacts too).",
    icon: MessageCircle,
  },
  {
    value: "KEYWORD_MATCH",
    label: "Keyword Match",
    help: "Inbound message contains one of your chosen keywords.",
    icon: Hash,
  },
  {
    value: "NEW_CONTACT_CREATED",
    label: "New Contact Created",
    help: "A new contact is added, from any source.",
    icon: UserPlus,
  },
  {
    value: "CONVERSATION_ASSIGNED",
    label: "Conversation Assigned",
    help: "A conversation is assigned to a teammate.",
    icon: UserCheck,
  },
  {
    value: "TAG_ADDED",
    label: "Tag Added",
    help: "A tag is added to a contact.",
    icon: TagIcon,
  },
]

function keywordConfig(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return []
  const keywords = (value as { keywords?: unknown }).keywords
  return Array.isArray(keywords)
    ? keywords.filter(
        (keyword): keyword is string => typeof keyword === "string"
      )
    : []
}

const STEP_OPTIONS: {
  value: StepNode["type"]
  label: string
  icon: typeof MessageSquare
}[] = [
  { value: "SEND_MESSAGE", label: "Send Message", icon: MessageSquare },
  { value: "ADD_TAG", label: "Add Tag", icon: TagIcon },
  { value: "REMOVE_TAG", label: "Remove Tag", icon: TagIcon },
  {
    value: "UPDATE_CONTACT_FIELD",
    label: "Update Contact Field",
    icon: Pencil,
  },
  {
    value: "ASSIGN_CONVERSATION",
    label: "Assign Conversation",
    icon: UserCheck,
  },
  { value: "WAIT", label: "Wait", icon: Hourglass },
  { value: "CONDITION", label: "Condition (If/Else)", icon: GitBranch },
  { value: "SEND_WEBHOOK", label: "Send Webhook", icon: WebhookIcon },
  { value: "CLOSE_CONVERSATION", label: "Close Conversation", icon: XCircle },
]

function defaultConfigFor(type: StepNode["type"]): StepNode {
  switch (type) {
    case "SEND_MESSAGE":
      return { type, text: "" }
    case "ADD_TAG":
      return { type, tagName: "" }
    case "REMOVE_TAG":
      return { type, tagName: "" }
    case "UPDATE_CONTACT_FIELD":
      return { type, field: "name", value: "" }
    case "ASSIGN_CONVERSATION":
      return { type, userId: "" }
    case "SEND_WEBHOOK":
      return { type, url: "" }
    case "CLOSE_CONVERSATION":
      return { type }
    case "WAIT":
      return { type, durationMinutes: 60 }
    case "CONDITION":
      return {
        type,
        field: "has_tag",
        operator: "has",
        value: "",
        yes: [],
        no: [],
      }
  }
}

type Member = { id: string; name: string | null; email: string }
type Tag = { id: string; name: string }
const fieldStyle = {
  border: "1px solid var(--line)",
  background: "var(--paper)",
  color: "var(--ink)",
} as const
const label = "block text-xs font-medium mb-1" as const

export interface AutomationBuilderProps {
  members: Member[]
  tags: Tag[]
  initial?: {
    id: string
    name: string
    triggerType: TriggerType
    triggerConfig: Record<string, unknown> | null
    isActive: boolean
    steps: StepNode[]
  }
}

export function AutomationBuilder({
  members,
  tags,
  initial,
}: AutomationBuilderProps) {
  const router = useRouter()
  const [name, setName] = useState(initial?.name ?? "Untitled automation")
  const [triggerType, setTriggerType] = useState<TriggerType>(
    initial?.triggerType ?? "NEW_MESSAGE_RECEIVED"
  )
  const [keywords, setKeywords] = useState(
    keywordConfig(initial?.triggerConfig).join(", ")
  )
  const [isActive, setIsActive] = useState(initial?.isActive ?? false)
  const [steps, setSteps] = useState<StepNode[]>(initial?.steps ?? [])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    const triggerConfig =
      triggerType === "KEYWORD_MATCH"
        ? {
            keywords: keywords
              .split(",")
              .map((keyword) => keyword.trim())
              .filter(Boolean),
          }
        : null

    startTransition(async () => {
      try {
        await saveAutomation(
          initial?.id ?? null,
          name,
          triggerType,
          triggerConfig,
          isActive,
          steps
        )
        router.push("/automations")
        // router.refresh()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save automation"
        )
      }
    })
  }

  const selectedTrigger = TRIGGER_OPTIONS.find((t) => t.value === triggerType)!

  return (
    <div className="flex min-h-full flex-col">
      <div
        className="flex flex-col gap-3 border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4"
        style={{
          borderColor: "var(--line)",
          background: "var(--paper-raised)",
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/automations")}
            className="text-sm"
            style={{ color: "var(--ink-soft)" }}
          >
            ←
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 bg-transparent font-[family-name:var(--font-display)] text-base font-medium outline-none sm:text-lg"
            style={{ color: "var(--ink)" }}
          />
        </div>
        <div className="flex w-full items-center justify-end gap-3 sm:w-auto sm:gap-4">
          <label
            className="flex items-center gap-2 text-sm"
            style={{ color: "var(--ink-soft)" }}
          >
            Active
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
          </label>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "var(--jade)" }}
          >
            {isPending ? "Saving…" : initial ? "Save Changes" : "Save Draft"}
          </button>
        </div>
      </div>

      {error && (
        <p
          className="px-6 py-2 text-sm"
          style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
        >
          {error}
        </p>
      )}
      {initial && <TestRunPanel automationId={initial.id} />}

      <div
        className="flex flex-1 flex-col items-center overflow-y-auto px-3 py-8 sm:px-6 sm:py-16"
        style={{
          background: "var(--paper)",
          backgroundImage:
            "radial-gradient(circle, rgba(16,24,40,0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        <TriggerCard
          selected={selectedTrigger}
          onChange={setTriggerType}
          keywords={keywords}
          onKeywordsChange={setKeywords}
        />
        <StepList
          steps={steps}
          onChange={setSteps}
          members={members}
          tags={tags}
          allowCondition
        />
      </div>
    </div>
  )
}

function Connector({
  onPick,
  options,
}: {
  onPick: (type: StepNode["type"]) => void
  options: typeof STEP_OPTIONS
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative flex flex-col items-center">
      <div className="h-8 w-px" style={{ background: "var(--line)" }} />
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-7 items-center justify-center rounded-full"
        style={{ background: "var(--jade)" }}
      >
        <Plus size={16} color="white" />
      </button>
      <div className="h-8 w-px" style={{ background: "var(--line)" }} />

      {open && (
        <div
          className="absolute top-10 z-20 w-56 rounded-xl py-1 shadow-lg"
          style={{
            background: "var(--paper-raised)",
            border: "1px solid var(--line)",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onPick(opt.value)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-black/5"
              style={{ color: "var(--ink)" }}
            >
              <opt.icon size={15} style={{ color: "var(--ink-soft)" }} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StepList({
  steps,
  onChange,
  members,
  tags,
  allowCondition,
}: {
  steps: StepNode[]
  onChange: (s: StepNode[]) => void
  members: Member[]
  tags: Tag[]
  allowCondition: boolean
}) {
  const options = allowCondition
    ? STEP_OPTIONS
    : STEP_OPTIONS.filter((o) => o.value !== "CONDITION")

  return (
    <div className="flex flex-col items-center">
      {steps.map((step, i) => (
        <div key={i} className="flex flex-col items-center">
          <Connector
            onPick={(t) =>
              onChange([
                ...steps.slice(0, i),
                defaultConfigFor(t),
                ...steps.slice(i),
              ])
            }
            options={options}
          />
          <StepCard
            step={step}
            onChange={(s) =>
              onChange(steps.map((x, idx) => (idx === i ? s : x)))
            }
            onRemove={() => onChange(steps.filter((_, idx) => idx !== i))}
            members={members}
            tags={tags}
          />
        </div>
      ))}
      <Connector
        onPick={(t) => onChange([...steps, defaultConfigFor(t)])}
        options={options}
      />
    </div>
  )
}

function StepCard({
  step,
  onChange,
  onRemove,
  members,
  tags,
}: {
  step: StepNode
  onChange: (s: StepNode) => void
  onRemove: () => void
  members: Member[]
  tags: Tag[]
}) {
  const [collapsed, setCollapsed] = useState(false)
  const meta = STEP_OPTIONS.find((o) => o.value === step.type)!

  return (
    <div
      className="w-full max-w-[20rem] rounded-xl shadow-sm"
      style={{
        background: "var(--paper-raised)",
        borderLeft: "3px solid var(--jade)",
      }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <meta.icon size={16} style={{ color: "var(--jade)" }} />
          <div>
            <p
              className="text-[10px] font-semibold uppercase"
              style={{ color: "var(--jade)" }}
            >
              Step
            </p>
            <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
              {meta.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRemove}
            className="text-xs"
            style={{ color: "var(--coral)" }}
          >
            Remove
          </button>
          <button onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? (
              <ChevronDown size={16} style={{ color: "var(--ink-soft)" }} />
            ) : (
              <ChevronUp size={16} style={{ color: "var(--ink-soft)" }} />
            )}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="px-4 pb-4">
          <StepConfigForm
            step={step}
            onChange={onChange}
            members={members}
            tags={tags}
          />
        </div>
      )}
    </div>
  )
}

function TagSelect({
  value,
  onChange,
  tags,
}: {
  value: string
  onChange: (v: string) => void
  tags: Tag[]
}) {
  if (tags.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--coral)" }}>
        No tags yet — create one in Settings → Fields & tags first.
      </p>
    )
  }
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a tag…" />
      </SelectTrigger>
      <SelectContent position="popper">
        {tags.map((t) => (
          <SelectItem key={t.id} value={t.name}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function StepConfigForm({
  step,
  onChange,
  members,
  tags,
}: {
  step: StepNode
  onChange: (s: StepNode) => void
  members: Member[]
  tags: Tag[]
}) {
  switch (step.type) {
    case "SEND_MESSAGE":
      return (
        <div>
          <label className={label}>Message text</label>
          <textarea
            value={step.text}
            onChange={(e) => onChange({ ...step, text: e.target.value })}
            placeholder="Hi! Thanks for reaching out — we'll get back to you shortly."
            rows={3}
            className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
            style={fieldStyle}
          />
          <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
            Sent from the bot in the customer&apos;s conversation thread.
          </p>
        </div>
      )
    case "ADD_TAG":
      return (
        <div>
          <label className={label}>Tag to add</label>
          <TagSelect
            value={step.tagName}
            onChange={(v) => onChange({ ...step, tagName: v })}
            tags={tags}
          />
        </div>
      )
    case "REMOVE_TAG":
      return (
        <div>
          <label className={label}>Tag to remove</label>
          <TagSelect
            value={step.tagName}
            onChange={(v) => onChange({ ...step, tagName: v })}
            tags={tags}
          />
        </div>
      )
    case "UPDATE_CONTACT_FIELD":
      return (
        <div className="space-y-2">
          <div>
            <label className={label}>Field to update</label>
            <Select
              value={step.field}
              onValueChange={(field) => {
                if (field === "name" || field === "email" || field === "company") {
                  onChange({ ...step, field })
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="company">Company</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={label}>New value</label>
            <input
              value={step.value}
              onChange={(e) => onChange({ ...step, value: e.target.value })}
              placeholder="New value"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={fieldStyle}
            />
          </div>
        </div>
      )
    case "ASSIGN_CONVERSATION":
      return (
        <div>
          <label className={label}>Assign to</label>
          <Select
            value={step.userId || undefined}
            onValueChange={(userId) => onChange({ ...step, userId })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a teammate…" />
            </SelectTrigger>
            <SelectContent position="popper">
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name || m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    case "SEND_WEBHOOK":
      return (
        <div>
          <label className={label}>Webhook URL</label>
          <input
            value={step.url}
            onChange={(e) => onChange({ ...step, url: e.target.value })}
            placeholder="https://example.com/webhook"
            className="w-full rounded-lg px-3 py-2 font-[family-name:var(--font-code)] text-sm outline-none"
            style={fieldStyle}
          />
          <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
            Sent as an empty POST — no payload customization yet.
          </p>
        </div>
      )
    case "CLOSE_CONVERSATION":
      return (
        <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
          Marks the conversation as closed. No configuration needed.
        </p>
      )
    case "WAIT":
      return (
        <div>
          <label className={label}>Wait duration</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={step.durationMinutes}
              onChange={(e) =>
                onChange({
                  ...step,
                  durationMinutes: Number(e.target.value) || 1,
                })
              }
              className="w-24 rounded-lg px-3 py-2 text-sm outline-none"
              style={fieldStyle}
            />
            <span className="text-sm" style={{ color: "var(--ink-soft)" }}>
              minutes, then continue
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
            Requires the automation cron job to be running to resume on time.
          </p>
        </div>
      )
    case "CONDITION": {
      const operatorOptions =
        step.field === "has_tag"
          ? [
              ["has", "Has"],
              ["not_has", "Does not have"],
            ]
          : [
              ["contains", "Contains"],
              ["not_contains", "Does not contain"],
            ]
      return (
        <div className="space-y-3">
          <div>
            <label className={label}>Condition</label>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <Select
                value={step.field}
                onValueChange={(field) => {
                  if (field !== "has_tag" && field !== "message_contains")
                    return
                  onChange({
                    ...step,
                    field,
                    operator: field === "has_tag" ? "has" : "contains",
                    value: "",
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="has_tag">Contact has tag</SelectItem>
                  <SelectItem value="message_contains">Message contains</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={step.operator}
                onValueChange={(operator) => onChange({ ...step, operator })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {operatorOptions.map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {step.field === "has_tag" ? (
              <TagSelect
                value={step.value}
                onChange={(v) => onChange({ ...step, value: v })}
                tags={tags}
              />
            ) : (
              <input
                value={step.value}
                onChange={(e) => onChange({ ...step, value: e.target.value })}
                placeholder="Text to match"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={fieldStyle}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <p
                className="mb-2 text-xs font-medium"
                style={{ color: "var(--jade-dark)" }}
              >
                If yes
              </p>
              <StepList
                steps={step.yes}
                onChange={(yes) => onChange({ ...step, yes })}
                members={members}
                tags={tags}
                allowCondition={false}
              />
            </div>
            <div>
              <p
                className="mb-2 text-xs font-medium"
                style={{ color: "var(--coral)" }}
              >
                If no
              </p>
              <StepList
                steps={step.no}
                onChange={(no) => onChange({ ...step, no })}
                members={members}
                tags={tags}
                allowCondition={false}
              />
            </div>
          </div>
        </div>
      )
    }
  }
}

function TriggerCard({
  selected,
  onChange,
  keywords,
  onKeywordsChange,
}: {
  selected: (typeof TRIGGER_OPTIONS)[number]
  onChange: (t: TriggerType) => void
  keywords: string
  onKeywordsChange: (v: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div
      className="w-full max-w-[20rem] rounded-xl shadow-sm"
      style={{
        background: "var(--paper-raised)",
        borderLeft: "3px solid var(--jade)",
      }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <selected.icon size={16} style={{ color: "var(--jade)" }} />
          <div>
            <p
              className="text-[10px] font-semibold uppercase"
              style={{ color: "var(--jade)" }}
            >
              Trigger
            </p>
            <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
              {selected.label}
            </p>
          </div>
        </div>
        <button onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? (
            <ChevronDown size={16} style={{ color: "var(--ink-soft)" }} />
          ) : (
            <ChevronUp size={16} style={{ color: "var(--ink-soft)" }} />
          )}
        </button>
      </div>
      {!collapsed && (
        <div className="space-y-2 px-4 pb-4">
          <label className={label}>Trigger type</label>
          <Select
            value={selected.value}
            onValueChange={(value) => onChange(value as TriggerType)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {TRIGGER_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
            {selected.help}
          </p>
          {selected.value === "KEYWORD_MATCH" && (
            <div>
              <label className={label}>Keywords</label>
              <input
                value={keywords}
                onChange={(e) => onKeywordsChange(e.target.value)}
                placeholder="price, cost, how much"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={fieldStyle}
              />
              <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
                Comma-separated. Fires if the message contains any one of these.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TestRunPanel({ automationId }: { automationId: string }) {
  const [contacts, setContacts] = useState<
    { id: string; name: string | null; phone: string }[]
  >([])
  const [contactId, setContactId] = useState("")
  const [result, setResult] = useState<{
    status: string
    errorMessage: string | null
    trace: string[]
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getContacts().then((c) =>
      setContacts(c.map((x) => ({ id: x.id, name: x.name, phone: x.phone })))
    )
  }, [])

  function handleRun() {
    if (!contactId) return
    setResult(null)
    startTransition(async () => {
      const res = await testRunAutomation(automationId, contactId)
      setResult(res)
    })
  }

  return (
    <div
      className="border-b px-6 py-3"
      style={{ borderColor: "var(--line)", background: "var(--paper-raised)" }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
          Test with:
        </span>
        <Select value={contactId || undefined} onValueChange={setContactId}>
          <SelectTrigger className="w-full min-w-0 sm:w-56">
            <SelectValue placeholder="Select a contact…" />
          </SelectTrigger>
          <SelectContent position="popper">
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name || c.phone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={handleRun}
          disabled={isPending || !contactId}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          style={{ background: "var(--jade)" }}
        >
          {isPending ? "Running…" : "Run test"}
        </button>
        {result && (
          <span
            className="text-sm"
            style={{
              color:
                result.status === "SUCCESS"
                  ? "var(--jade-dark)"
                  : "var(--coral)",
            }}
          >
            {result.status === "SUCCESS"
              ? "✓ Ran successfully"
              : `✗ ${result.errorMessage}`}
          </span>
        )}
      </div>
      {result && result.trace.length > 0 && (
        <div className="mt-2 space-y-1 pl-1">
          {result.trace.map((line, i) => (
            <p
              key={i}
              className="font-[family-name:var(--font-code)] text-xs"
              style={{ color: "var(--ink-soft)" }}
            >
              → {line}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
