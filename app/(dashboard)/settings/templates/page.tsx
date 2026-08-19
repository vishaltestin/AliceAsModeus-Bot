"use client"

import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { PageHeader } from "@/components/ui/page-header"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Textarea } from "@/components/ui/textarea"
import { InlineAlert } from "@/components/ui/feedback"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useEffect, useState, useTransition } from "react"
import {
  FileText,
  Megaphone,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Pencil,
  Languages,
} from "lucide-react"
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  syncTemplatesFromMeta,
  deleteTemplate,
} from "./actions"

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: "var(--line)", color: "var(--ink-soft)" },
  PENDING: { bg: "var(--amber-soft)", color: "var(--amber)" },
  APPROVED: { bg: "var(--jade-soft)", color: "var(--jade-dark)" },
  REJECTED: { bg: "var(--coral-soft)", color: "var(--coral)" },
  PAUSED: { bg: "var(--amber-soft)", color: "var(--amber)" },
  DISABLED: { bg: "var(--coral-soft)", color: "var(--coral)" },
  IN_APPEAL: { bg: "var(--amber-soft)", color: "var(--amber)" },
  PENDING_DELETION: { bg: "var(--coral-soft)", color: "var(--coral)" },
}

type Template = Awaited<ReturnType<typeof getTemplates>>[number]
type HeaderType = "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null
type Category = "MARKETING" | "UTILITY" | "AUTHENTICATION"
const emptyForm = {
  name: "",
  category: "MARKETING" as Category,
  language: "en_US",
  headerType: null as HeaderType,
  headerContent: "",
  bodyText: "",
  footerText: "",
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  async function refresh() {
    try {
      setTemplates(await getTemplates())
      setError(null)
    } catch (reason) {
      console.error("[wacrm] Templates load failed", reason)
      setError("We couldn't load message templates. Please try again.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    const task = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(task)
  }, [])

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }
  function openEdit(t: Template) {
    setEditing(t)
    setForm({
      name: t.name,
      category: t.category as Category,
      language: t.language,
      headerType: t.headerType,
      headerContent: t.headerContent ?? "",
      bodyText: t.bodyText,
      footerText: t.footerText ?? "",
    })
    setModalOpen(true)
  }

  function handleSubmit() {
    setError(null)
    const input = {
      ...form,
      headerContent: form.headerContent || null,
      footerText: form.footerText || null,
    }
    startTransition(async () => {
      try {
        const result = editing
          ? await updateTemplate(editing.id, input)
          : await createTemplate(input)
        if (result.error) {
          setError(result.error)
          return
        }
        setModalOpen(false)
        await refresh()
      } catch (reason) {
        console.error("[wacrm] Template save failed", reason)
        setError("We couldn't save this template. Please try again.")
      }
    })
  }

  if (loading) {
    return (
      <div className="grid max-w-3xl animate-pulse grid-cols-1 gap-4 sm:grid-cols-2">
        <div
          className="col-span-full h-10 w-64 rounded-xl"
          style={{ background: "var(--line)" }}
        />
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-32 rounded-2xl"
            style={{ background: "var(--paper-raised)" }}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Messaging library"
        title="Message templates"
        description="Create reusable, approved messages for campaigns and customer follow-up."
      />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          <FileText size={16} />
          <span>
            <strong className="font-semibold text-[var(--ink)]">
              {templates.length}
            </strong>{" "}
            template{templates.length === 1 ? "" : "s"}
          </span>
          <span className="hidden text-[var(--line)] sm:inline">·</span>
          <span className="hidden sm:inline">
            Sync from Meta to pull approved templates.
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const result = await syncTemplatesFromMeta()
                  if (result.error) setError(result.error)
                  else await refresh()
                } catch (reason) {
                  console.error("[wacrm] Template sync failed", reason)
                  setError(
                    "We couldn't sync templates from Meta. Please try again."
                  )
                }
              })
            }
          >
            <RefreshCw size={15} /> Sync from Meta
          </Button>
          <Button size="lg" onClick={openNew}>
            <MessageSquareText size={15} /> New template
          </Button>
        </div>
      </div>

      {error && (
        <div
          className="mt-5 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {templates.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center justify-center px-6 py-16 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}
          >
            <FileText size={26} />
          </span>
          <h3 className="mt-4 font-[family-name:var(--font-display)] text-lg font-medium">
            No templates yet
          </h3>
          <p className="mt-1 max-w-sm text-sm text-[var(--ink-soft)]">
            Create your first message template, or sync approved templates
            directly from Meta.
          </p>
          <Button className="mt-5" onClick={openNew}>
            <MessageSquareText size={15} /> New template
          </Button>
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => {
            const statusStyle = STATUS_COLOR[t.status] ?? STATUS_COLOR.DRAFT
            const CategoryIcon =
              t.category === "AUTHENTICATION"
                ? ShieldCheck
                : t.category === "UTILITY"
                  ? MessageSquareText
                  : Megaphone
            return (
              <Card
                key={t.id}
                className="group flex flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]"
              >
                <div
                  className="flex items-start justify-between gap-3 border-b px-5 py-4"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        background: "var(--jade-soft)",
                        color: "var(--jade-dark)",
                      }}
                    >
                      <CategoryIcon size={18} />
                    </span>
                    <div className="min-w-0">
                      <p
                        className="truncate font-[family-name:var(--font-mono)] text-sm font-semibold"
                        style={{ color: "var(--ink)" }}
                      >
                        {t.name}
                      </p>
                      <p
                        className="mt-0.5 flex items-center gap-1 text-[11px]"
                        style={{ color: "var(--ink-soft)" }}
                      >
                        <Languages size={11} /> {t.language}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className="shrink-0"
                    style={{
                      background: statusStyle.bg,
                      color: statusStyle.color,
                      border: "none",
                    }}
                  >
                    {t.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="flex-1 px-5 py-4">
                  <p
                    className="line-clamp-3 text-sm leading-6"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {t.bodyText}
                  </p>
                  {t.rejectionReason && (
                    <p
                      className="mt-2 rounded-lg px-3 py-2 text-xs"
                      style={{
                        background: "var(--coral-soft)",
                        color: "var(--coral)",
                      }}
                    >
                      Rejected: {t.rejectionReason}
                    </p>
                  )}
                </div>
                <div
                  className="flex items-center justify-between border-t px-5 py-3"
                  style={{ borderColor: "var(--line)" }}
                >
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--ink-soft)] uppercase"
                    style={{ background: "var(--paper)" }}
                  >
                    {t.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(t)}
                      title="Editing triggers Meta re-review — status flips to PENDING."
                    >
                      <Pencil size={13} /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[var(--coral)] hover:bg-[var(--coral-soft)]"
                      onClick={() => setConfirmDeleteId(t.id)}
                    >
                      <Trash2 size={13} /> Delete
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        eyebrow={editing ? "Template revision" : "Messaging library"}
        title={editing ? "Edit template" : "New message template"}
        description={
          editing
            ? "Editing triggers Meta re-review and changes the status to pending."
            : "Create a reusable message that your team can send with confidence."
        }
        size="lg"
      >
        <div className="space-y-4">
          <FormField
            label="Template name"
            htmlFor="template-name"
            hint="Lowercase letters, digits, and underscores only."
          >
            <Input
              id="template-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="order_confirmation"
              disabled={!!editing}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category" htmlFor="template-category" required>
              <Select
                value={form.category}
                onValueChange={(value) =>
                  setForm({ ...form, category: value as Category })
                }
              >
                <SelectTrigger id="template-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[80]">
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="UTILITY">Utility</SelectItem>
                  <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Language" htmlFor="template-language" required>
              <Input
                id="template-language"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                placeholder="en_US"
              />
            </FormField>
          </div>
          <FormField
            label="Body text"
            htmlFor="template-body"
            hint="Variables must be contiguous, starting at {{1}}."
          >
            <Textarea
              id="template-body"
              value={form.bodyText}
              onChange={(e) => setForm({ ...form, bodyText: e.target.value })}
              rows={4}
              placeholder="Hello {{1}}, your order {{2}} is confirmed."
            />
          </FormField>
          <FormField
            label="Footer text"
            htmlFor="template-footer"
            hint="Optional · maximum 60 characters."
          >
            <Input
              id="template-footer"
              value={form.footerText}
              onChange={(e) => setForm({ ...form, footerText: e.target.value })}
              placeholder="Optional footer text"
            />
          </FormField>
          {error && <InlineAlert>{error}</InlineAlert>}
          <div
            className="flex justify-end gap-2 border-t pt-4"
            style={{ borderColor: "var(--line)" }}
          >
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button disabled={isPending} onClick={handleSubmit}>
              {isPending ? "Submitting…" : "Submit for approval"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        onConfirm={() => {
          if (!confirmDeleteId) return
          startTransition(async () => {
            try {
              await deleteTemplate(confirmDeleteId)
              setConfirmDeleteId(null)
              await refresh()
            } catch (reason) {
              console.error("[wacrm] Delete template failed", reason)
              setError(
                "We couldn't delete this template. Please try again."
              )
            }
          })
        }}
        title="Delete this template?"
        description="This permanently removes the template. This cannot be undone."
        confirmLabel="Delete template"
      />
    </div>
  )
}
