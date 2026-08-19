"use client"

import {
  DollarSign,
  GripVertical,
  Layers,
  MoreHorizontal,
  Plus,
  Search,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  UserRound,
  XCircle,
} from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { InlineAlert } from "@/components/ui/feedback"
import { Modal } from "@/components/ui/modal"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  getPipelines,
  getPipeline,
  getPipelineMetrics,
  createPipeline,
  createDeal,
  moveDeal,
  deleteDeal,
} from "./actions"
import { getContacts, getCategories } from "@/app/(dashboard)/contacts/actions"
import { formatCurrency } from "@/lib/currency"
import { useRole } from "@/components/role-context"

type PipelineList = Awaited<ReturnType<typeof getPipelines>>
type Pipeline = PipelineList[number]
type PipelineDetail = Awaited<ReturnType<typeof getPipeline>>
type Deal = PipelineDetail["stages"][number]["deals"][number]
type Stage = PipelineDetail["stages"][number]
type Metrics = Awaited<ReturnType<typeof getPipelineMetrics>>

const METRIC_DEFS: {
  key: keyof Metrics
  label: string
  icon: typeof Layers
  color: string
  currency?: boolean
}[] = [
  { key: "totalDeals", label: "Deals", icon: Layers, color: "var(--jade)" },
  { key: "pipelineValue", label: "Value", icon: DollarSign, color: "var(--jade-dark)", currency: true },
  { key: "avgDealSize", label: "Avg size", icon: Target, color: "var(--amber)", currency: true },
  { key: "weightedValue", label: "Weighted", icon: TrendingUp, color: "var(--coral)", currency: true },
  { key: "wonThisMonth", label: "Won", icon: Trophy, color: "var(--jade)" },
  { key: "lostThisMonth", label: "Lost", icon: XCircle, color: "var(--coral)" },
]

export default function PipelinesPage() {
  const { canWrite } = useRole()
  const [pipelines, setPipelines] = useState<PipelineList>([])
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null)
  const [detail, setDetail] = useState<PipelineDetail | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [contacts, setContacts] = useState<
    Awaited<ReturnType<typeof getContacts>>
  >([])
  const [contactCategories, setContactCategories] = useState<
    { name: string; color: string }[]
  >([])
  const [query, setQuery] = useState("")
  const [dragging, setDragging] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)
  const [addPipelineOpen, setAddPipelineOpen] = useState(false)
  const [addDealOpen, setAddDealOpen] = useState(false)
  const [dealStageId, setDealStageId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let active = true
    Promise.all([getPipelines(), getContacts(), getCategories()])
      .then(([list, contactList, categoryList]) => {
        if (!active) return
        setPipelines(list)
        setContacts(contactList)
        setContactCategories(categoryList)
        if (list[0]) setActivePipelineId(list[0].id)
      })
      .catch((reason) => {
        console.error("[wacrm] Pipelines load failed", reason)
        if (active)
          setError("We couldn't load your pipelines. Please try again.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  function refreshDetail(id: string) {
    setError(null)
    Promise.all([getPipeline(id), getPipelineMetrics(id)])
      .then(([nextDetail, nextMetrics]) => {
        setDetail(nextDetail)
        setMetrics(nextMetrics)
      })
      .catch((reason) => {
        console.error("[wacrm] Pipeline detail load failed", reason)
        setError("We couldn't load this pipeline. Please try again.")
      })
  }
  useEffect(() => {
    if (!activePipelineId) return
    const task = window.setTimeout(() => refreshDetail(activePipelineId), 0)
    return () => window.clearTimeout(task)
  }, [activePipelineId])

  function handleDrop(dealId: string, stageId: string) {
    setDragging(null)
    setOverStage(null)
    if (dealId === stageId) return
    setDetail((prev) => {
      if (!prev) return prev
      let moved: Deal | null = null
      const stages = prev.stages.map((s) => {
        const found = s.deals.find((d) => d.id === dealId)
        if (found) {
          moved = found
          return { ...s, deals: s.deals.filter((d) => d.id !== dealId) }
        }
        return s
      })
      if (!moved) return prev
      const movedDeal = moved
      return {
        ...prev,
        stages: stages.map((s) =>
          s.id === stageId ? { ...s, deals: [movedDeal, ...s.deals] } : s
        ),
      }
    })
    startTransition(async () => {
      try {
        await moveDeal(dealId, stageId)
        if (activePipelineId) getPipelineMetrics(activePipelineId).then(setMetrics)
      } catch (reason) {
        console.error("[wacrm] Move deal failed", reason)
        setError("We couldn't move this deal. The board has been refreshed.")
        if (activePipelineId) refreshDetail(activePipelineId)
      }
    })
  }

  function handleDeleteDeal(dealId: string) {
    startTransition(async () => {
      try {
        await deleteDeal(dealId)
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                stages: prev.stages.map((s) => ({
                  ...s,
                  deals: s.deals.filter((d) => d.id !== dealId),
                })),
              }
            : prev
        )
        if (activePipelineId) getPipelineMetrics(activePipelineId).then(setMetrics)
      } catch (reason) {
        console.error("[wacrm] Delete deal failed", reason)
      }
    })
  }

  const normalizedQuery = query.trim().toLowerCase()
  const filteredStages = useMemo(() => {
    if (!detail) return []
    if (!normalizedQuery) return detail.stages
    return detail.stages.map((s) => ({
      ...s,
      deals: s.deals.filter((d) =>
        [d.title, d.contact?.name, d.contact?.phone]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(normalizedQuery))
      ),
    }))
  }, [detail, normalizedQuery])

  const totalValue = detail?.stages.reduce(
    (sum, s) => sum + s.deals.reduce((acc, d) => acc + d.value, 0),
    0
  ) ?? 0

  if (loading)
    return (
      <div className="flex h-full flex-col gap-4 p-4">
        <div className="h-10 w-72 animate-pulse rounded-xl bg-[var(--line)]/60" />
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--paper-raised)]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-[var(--paper-raised)]" />
          ))}
        </div>
      </div>
    )

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Top bar */}
      <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div>
          <p className="eyebrow">Sales workspace</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-medium tracking-tight">
            {detail?.name ?? "Pipelines"}
          </h1>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            {metrics?.totalDeals ?? 0} open deals ·{" "}
            {formatCurrency(totalValue)} in play
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--ink-soft)]"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search deals…"
              aria-label="Search deals"
              className="h-9 w-52 pl-9"
            />
          </div>
          <Select
            value={activePipelineId ?? ""}
            onValueChange={setActivePipelineId}
          >
            <SelectTrigger className="h-9 w-52" aria-label="Select pipeline">
              <SelectValue placeholder="Select pipeline" />
            </SelectTrigger>
            <SelectContent position="popper">
              {pipelines.map((pipeline) => (
                <SelectItem key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canWrite && (
          <Button
            variant="outline"
            onClick={() => setAddPipelineOpen(true)}
            className="h-9"
          >
            <Layers size={15} /> New pipeline
          </Button>
          )}
          {canWrite && (
          <Button
            onClick={() => {
              setDealStageId(detail?.stages[0]?.id ?? null)
              setAddDealOpen(true)
            }}
            disabled={!detail}
            className="h-9"
          >
            <Plus size={15} /> Add deal
          </Button>
          )}
        </div>
      </div>

      {error && (
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5 text-sm sm:px-6"
          style={{
            borderColor: "var(--line)",
            background: "var(--coral-soft)",
            color: "var(--coral)",
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => activePipelineId && refreshDetail(activePipelineId)}
            className="rounded-lg bg-white px-3 py-1 text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metrics strip */}
      <div className="grid shrink-0 grid-cols-3 gap-2.5 px-4 py-3 sm:px-6 md:grid-cols-6">
        {METRIC_DEFS.map((m) => {
          const Icon = m.icon
          const raw = metrics?.[m.key]
          const value =
            typeof raw === "number" && m.currency
              ? formatCurrency(raw)
              : String(raw ?? 0)
          return (
            <div
              key={m.key}
              className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] px-3.5 py-2.5"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: `color-mix(in_oklch, ${m.color} 14%, transparent)`,
                  color: m.color,
                }}
              >
                <Icon size={15} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold tracking-wide text-[var(--ink-soft)] uppercase">
                  {m.label}
                </p>
                <p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  {value}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Board */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6">
        {detail ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filteredStages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                stageValue={stage.deals.reduce((sum, d) => sum + d.value, 0)}
                isOver={overStage === stage.id}
                onDragOver={() => {
                  setOverStage(stage.id)
                }}
                onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                onDrop={() => dragging && handleDrop(dragging, stage.id)}
                onAdd={() => {
                  setDealStageId(stage.id)
                  setAddDealOpen(true)
                }}
                onDelete={handleDeleteDeal}
                setDragging={setDragging}
                showAdd={canWrite}
                canWrite={canWrite}
              />
            ))}
            {filteredStages.length === 0 && (
              <div className="col-span-full flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--line)] py-16 text-sm text-[var(--ink-soft)]">
                No deals match your search.
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)] text-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}
            >
              <Layers size={26} />
            </span>
            <p className="mt-4 text-sm font-semibold">No pipeline selected</p>
            {canWrite && (
              <Button
                className="mt-4"
                onClick={() => setAddPipelineOpen(true)}
              >
                <Plus size={15} /> Create a pipeline
              </Button>
            )}
          </div>
        )}
      </div>

      {addPipelineOpen && (
        <AddPipelineModal
          onClose={() => setAddPipelineOpen(false)}
          onCreated={(p) => {
            setPipelines((prev) => [...prev, p])
            setActivePipelineId(p.id)
            setAddPipelineOpen(false)
          }}
        />
      )}
      {addDealOpen && detail && dealStageId && (
        <AddDealModal
          pipelineId={detail.id}
          stages={detail.stages}
          initialStageId={dealStageId}
          contacts={contacts}
          categories={contactCategories}
          onClose={() => setAddDealOpen(false)}
          onCreated={() => {
            refreshDetail(detail.id)
            setAddDealOpen(false)
          }}
        />
      )}
    </div>
  )
}

function StageColumn({
  stage,
  stageValue,
  isOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onAdd,
  onDelete,
  setDragging,
  showAdd,
  canWrite,
}: {
  stage: Stage
  stageValue: number
  isOver: boolean
  onDragOver: () => void
  onDragLeave: () => void
  onDrop: () => void
  onAdd: () => void
  onDelete: (dealId: string) => void
  setDragging: (id: string | null) => void
  showAdd: boolean
  canWrite: boolean
}) {
  const won = stage.isWonStage
  const lost = stage.isLostStage
  return (
    <div
      className="flex min-w-0 flex-col rounded-2xl border bg-[var(--paper-raised)] shadow-sm transition-colors"
      style={{
        borderColor: isOver ? "var(--jade)" : "var(--line)",
        boxShadow: isOver ? "0 0 0 2px var(--jade)" : "var(--shadow-card)",
      }}
      onDragOver={
        canWrite
          ? (e) => {
              e.preventDefault()
              onDragOver()
            }
          : undefined
      }
      onDragLeave={canWrite ? onDragLeave : undefined}
      onDrop={
        canWrite
          ? (e) => {
              e.preventDefault()
              onDrop()
            }
          : undefined
      }
    >
      {/* Stage header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] px-3 py-3">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: stage.color }}
        />
        <p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
          {stage.name}
        </p>
        <Badge
          variant={won ? "success" : lost ? "destructive" : "muted"}
          className="ml-1 h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]"
        >
          {stage.deals.length}
        </Badge>
        <span className="ml-auto text-[11px] font-semibold text-[var(--jade-dark)]">
          {formatCurrency(stageValue)}
        </span>
      </div>

      {/* Deals */}
      <div className="space-y-2 p-2">
        {stage.deals.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--line)] py-6 text-center">
            <p className="text-xs text-[var(--ink-soft)]">
              {canWrite ? "Drop a deal here" : "No deals in this stage"}
            </p>
          </div>
        )}
        {stage.deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            stageColor={stage.color}
            canWrite={canWrite}
            onDragStart={() => setDragging(deal.id)}
            onDragEnd={() => setDragging(null)}
            onDelete={() => onDelete(deal.id)}
          />
        ))}
      </div>

      {/* Add */}
      {showAdd && (
        <div className="shrink-0 border-t border-[var(--line)] p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-[var(--ink-soft)] hover:bg-[var(--paper)] hover:text-[var(--jade-dark)]"
            onClick={onAdd}
          >
            <Plus size={14} /> Add deal
          </Button>
        </div>
      )}
    </div>
  )
}

function DealCard({
  deal,
  stageColor,
  canWrite,
  onDragStart,
  onDragEnd,
  onDelete,
}: {
  deal: Deal
  stageColor: string
  canWrite: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDelete: () => void
}) {
  const name = deal.contact?.name || deal.contact?.phone || null
  return (
    <div
      draggable={canWrite}
      onDragStart={
        canWrite
          ? (e) => {
              e.dataTransfer.effectAllowed = "move"
              e.dataTransfer.setData("text/plain", deal.id)
              onDragStart()
            }
          : undefined
      }
      onDragEnd={canWrite ? onDragEnd : undefined}
      className={`rounded-xl border border-[var(--line)] bg-white/60 p-3 shadow-sm transition ${
        canWrite
          ? "group cursor-grab hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {deal.title}
          </p>
          {name && (
            <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-[var(--ink-soft)]">
              <UserRound size={11} /> {name}
            </p>
          )}
        </div>
        {canWrite && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-md p-1 text-[var(--ink-soft)] opacity-0 transition-opacity hover:bg-[var(--paper)] group-hover:opacity-100"
            >
              <MoreHorizontal size={15} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 size={15} /> Delete deal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-2.5">
        <span className="text-sm font-semibold text-[var(--jade-dark)]">
          {formatCurrency(deal.value)}
        </span>
        <span className="flex items-center gap-1">
          <GripVertical size={12} className="text-[var(--line)]" />
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: `color-mix(in_oklch, ${stageColor} 12%, transparent)`, color: stageColor }}
          >
            {deal.status === "OPEN"
              ? `${deal.status}`
              : deal.status}
          </span>
        </span>
      </div>
    </div>
  )
}

function AddPipelineModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (pipeline: Pipeline) => void
}) {
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      try {
        onCreated(await createPipeline(name))
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create pipeline"
        )
      }
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Sales workspace"
      title="New pipeline"
      description="Create a board with a clear rhythm for this team."
      size="sm"
    >
      <div className="space-y-4">
        <FormField label="Pipeline name" htmlFor="pipeline-name" required>
          <Input
            id="pipeline-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Renewals Pipeline"
          />
        </FormField>
        {error && <InlineAlert>{error}</InlineAlert>}
        <div
          className="flex justify-end gap-2 border-t pt-4"
          style={{ borderColor: "var(--line)" }}
        >
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
            {isPending ? "Creating…" : "Create pipeline"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function AddDealModal({
  pipelineId,
  stages,
  initialStageId,
  contacts,
  categories,
  onClose,
  onCreated,
}: {
  pipelineId: string
  stages: { id: string; name: string }[]
  initialStageId: string
  contacts: {
    id: string
    name: string | null
    phone: string
    category?: string
  }[]
  categories: { name: string; color: string }[]
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState("")
  const [value, setValue] = useState("")
  const [stageId, setStageId] = useState(initialStageId)
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [contactId, setContactId] = useState("NONE")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredContacts =
    categoryFilter === "ALL"
      ? contacts
      : contacts.filter((c) => c.category === categoryFilter)

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      try {
        await createDeal(
          pipelineId,
          stageId,
          title,
          Number(value) || 0,
          contactId === "NONE" ? undefined : contactId
        )
        onCreated()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create deal")
      }
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Sales workspace"
      title="New deal"
      description="Give this opportunity a value, stage, and owner."
      size="sm"
    >
      <div className="space-y-4">
        <FormField label="Deal title" htmlFor="deal-title" required>
          <Input
            id="deal-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Renewal opportunity"
          />
        </FormField>
        <FormField label="Value" htmlFor="deal-value">
          <Input
            id="deal-value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type="number"
            min="0"
            placeholder="0"
          />
        </FormField>
        <FormField label="Stage" htmlFor="deal-stage">
          <Select value={stageId} onValueChange={setStageId}>
            <SelectTrigger id="deal-stage" className="w-full">
              <SelectValue placeholder="Choose a stage" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[80]">
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Contact category" htmlFor="deal-category">
          <Select
            value={categoryFilter}
            onValueChange={(next) => {
              setCategoryFilter(next)
              setContactId("NONE")
            }}
          >
            <SelectTrigger id="deal-category" className="w-full">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[80]">
              <SelectItem value="ALL">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.name} value={cat.name}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Contact" htmlFor="deal-contact">
          <Select value={contactId} onValueChange={setContactId}>
            <SelectTrigger id="deal-contact" className="w-full">
              <SelectValue placeholder="No contact linked" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[80]">
              <SelectItem value="NONE">No contact linked</SelectItem>
              {filteredContacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.name || contact.phone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        {error && <InlineAlert>{error}</InlineAlert>}
        <div
          className="flex justify-end gap-2 border-t pt-4"
          style={{ borderColor: "var(--line)" }}
        >
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !title.trim()}>
            {isPending ? "Creating…" : "Create deal"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
