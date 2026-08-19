"use client"

import Link from "next/link"
import {
  Building2,
  ChevronRight,
  CopyCheck,
  Download,
  Layers,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  Upload,
  UsersRound,
} from "lucide-react"
import { useCallback, useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useRole } from "@/components/role-context"
import {
  getCategoryOverview,
  deleteCategoryContacts,
  getTagsAndFields,
  importContactsFromCsv,
  type CategoryOverviewRow,
} from "./actions"
import { ContactFormModal } from "./contact-form-modal"
import { parseContactsFileAsync } from "@/lib/client-excel"

export default function ContactsPage() {
  const { canWrite } = useRole()
  const [rows, setRows] = useState<CategoryOverviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [importOpen, setImportOpen] = useState(false)
  const [importCategory, setImportCategory] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [meta, setMeta] = useState<{
    tags: { id: string; name: string }[]
    customFields: { id: string; fieldName: string }[]
    categories: { id: string; name: string; color: string }[]
  }>({ tags: [], customFields: [], categories: [] })

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        setRows(await getCategoryOverview())
        setError(null)
      } catch (reason) {
        console.error("[wacrm] Category overview load failed", reason)
        setError("We couldn't load your contact categories. Please try again.")
      } finally {
        setLoading(false)
      }
    })
  }, [])

  useEffect(() => {
    load()
    getTagsAndFields()
      .then((m) =>
        setMeta({
          tags: m.tags,
          customFields: m.customFields,
          categories: m.categories,
        })
      )
      .catch(() => {})
  }, [load])

  const total = rows.reduce((sum, r) => sum + r.count, 0)
  const totalDup = rows.reduce((sum, r) => sum + r.duplicateCount, 0)

  const [confirmDelete, setConfirmDelete] = useState<CategoryOverviewRow | null>(null)

  function handleDelete(row: CategoryOverviewRow) {
    setBusyId(row.id)
    startTransition(async () => {
      try {
        await deleteCategoryContacts(row.id)
        setConfirmDelete(null)
        await load()
      } catch (reason) {
        console.error("[wacrm] Delete category contacts failed", reason)
        setError("We couldn't delete this category's contacts.")
      } finally {
        setBusyId(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Relationship workspace</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight">
            Contacts
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink-soft)]">
            Organize your contacts by category. Open a category to view, search,
            and manage the contacts inside it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <button
              type="button"
              onClick={() => {
                setAddOpen(true)
              }}
              className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              style={{ background: "var(--jade)", boxShadow: "0 8px 18px rgba(31, 111, 92, 0.16)" }}
            >
              <Plus size={16} /> Add contact
            </button>
          )}
          {canWrite && (
            <button
              type="button"
              onClick={() => {
                setImportCategory("")
                setImportOpen(true)
              }}
              className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition"
              style={{ borderColor: "var(--line)", background: "var(--paper-raised)", color: "var(--ink)" }}
            >
              <Upload size={16} /> Import
            </button>
          )}
          {canWrite && (
            <button
              type="button"
              onClick={load}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition"
              style={{ borderColor: "var(--line)", background: "var(--paper-raised)", color: "var(--ink)" }}
            >
              <RefreshCw size={16} className={isPending ? "animate-spin" : ""} /> Refresh
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<Layers size={17} />} label="Categories" value={rows.length} color="var(--brand-blue)" />
        <SummaryCard icon={<UsersRound size={17} />} label="Total contacts" value={total} color="var(--jade)" />
        <SummaryCard icon={<CopyCheck size={17} />} label="Possible duplicates" value={totalDup} color="var(--amber)" />
      </div>

      {error && (
        <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>
          {error}
        </div>
      )}

      {/* Category table */}
      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--line)", background: "var(--paper-raised)" }}>
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: "var(--paper)" }} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)] px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}>
              <Layers size={24} />
            </span>
            <h2 className="mt-5 font-[family-name:var(--font-display)] text-xl font-medium">No categories yet</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--ink-soft)]">
              Create categories in Settings → Fields &amp; Tags, then add or import contacts into them.
            </p>
            {canWrite && (
              <Link href="/settings/fields-tags" className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--jade)" }}>
                <Settings2 size={15} /> Manage categories
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr style={{ background: "var(--paper)" }}>
                  <Th>Category</Th>
                  <Th>Contacts</Th>
                  <Th>Duplicates</Th>
                  <Th>Distribution</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t transition hover:bg-[var(--paper)]" style={{ borderColor: "var(--line)" }}>
                    <td className="px-4 py-3.5">
                      <Link href={`/contacts/category/${row.id}`} className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `color-mix(in_oklch, ${row.color} 16%, transparent)`, color: row.color }}>
                          <Building2 size={17} />
                        </span>
                        <span className="font-medium" style={{ color: "var(--ink)" }}>{row.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 font-semibold" style={{ color: "var(--ink)" }}>
                      {row.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5">
                      {row.duplicateCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
                          <CopyCheck size={12} /> {row.duplicateCount.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-[var(--ink-soft)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(4, (row.count / Math.max(total, 1)) * 100))}%`, background: row.color }} />
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <Link
                          href={`/contacts/category/${row.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition"
                          style={{ background: row.color }}
                        >
                          View <ChevronRight size={13} />
                        </Link>
                        {canWrite && (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => setConfirmDelete(row)}
                            className="inline-flex items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs transition disabled:opacity-50"
                            style={{ borderColor: "var(--coral-soft)", color: "var(--coral)" }}
                          >
                            {busyId === row.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {importOpen && (
        <ImportModal
          category={importCategory}
          onCategoryChange={setImportCategory}
          onClose={() => setImportOpen(false)}
          onDone={() => {
            setImportOpen(false)
            load()
          }}
        />
      )}

      {addOpen && (
        <ContactFormModal
          open
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false)
            load()
          }}
          tags={meta.tags}
          customFields={meta.customFields}
          categories={meta.categories}
          existing={null}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title={`Delete "${confirmDelete?.name}"?`}
        description={`This permanently deletes ${(confirmDelete?.count ?? 0).toLocaleString()} contact${
          (confirmDelete?.count ?? 0) === 1 ? "" : "s"
        } in this category and the category itself. This cannot be undone.`}
        confirmLabel="Delete category"
        busy={busyId === confirmDelete?.id}
      />
    </div>
  )
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl p-4 shadow-sm ring-1 ring-black/5" style={{ background: "var(--paper-raised)" }}>
      <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `color-mix(in_oklch, ${color} 14%, transparent)`, color }}>
        {icon}
      </span>
      <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
        {value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold tracking-wide text-[var(--ink-soft)] uppercase">{label}</p>
    </div>
  )
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left text-[10px] font-semibold tracking-wide text-[var(--ink-soft)] uppercase ${className}`}>
      {children}
    </th>
  )
}

function ImportModal({
  category,
  onCategoryChange,
  onClose,
  onDone,
}: {
  category: string
  onCategoryChange: (c: string) => void
  onClose: () => void
  onDone: () => void
}) {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [tags, setTags] = useState<{ id: string; name: string }[]>([])
  const [tagId, setTagId] = useState("NONE")
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ ok?: string; err?: string }>({})
  const [, startTransition] = useTransition()

  useEffect(() => {
    getTagsAndFields()
      .then((m) => {
        setCategories(m.categories)
        setTags(m.tags)
      })
      .catch(() => {})
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
    setMessage({})
  }

  function doImport() {
    if (!file) return
    if (!category) {
      setMessage({ err: "Choose a category to import into." })
      return
    }
    setImporting(true)
    startTransition(async () => {
      try {
        const { rows, errors } = await parseContactsFileAsync(file)
        if (rows.length === 0) {
          setMessage({ err: errors[0] ?? "No valid rows found in the file." })
          setImporting(false)
          return
        }
        const result = await importContactsFromCsv(rows, {
          tagIds: tagId === "NONE" ? [] : [tagId],
          category,
        })
        if ("error" in result && result.error) {
          setMessage({ err: result.error })
          return
        }
        const ok = result as { created: number; duplicatesRemoved?: number }
        setMessage({
          ok: `Imported ${ok.created.toLocaleString()} contact${ok.created === 1 ? "" : "s"} into "${category}"${
            ok.duplicatesRemoved ? ` · ${ok.duplicatesRemoved} duplicate rows skipped` : ""
          }.`,
        })
        setFile(null)
        onDone()
      } catch (reason) {
        console.error("[wacrm] Import failed", reason)
        setMessage({ err: "We couldn't import this file." })
      } finally {
        setImporting(false)
      }
    })
  }

  return (
    <Modal open onClose={onClose} eyebrow="Bulk import" title="Import contacts" size="md">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--ink)" }}>Import into category</span>
          <Select
            value={category || undefined}
            onValueChange={onCategoryChange}
            disabled={importing}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a category…" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[80]">
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--ink)" }}>Apply tag</span>
          <Select value={tagId} onValueChange={setTagId} disabled={importing}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="No tag" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[80]">
              <SelectItem value="NONE">No tag</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <a
          href="/contact-import-sample.xlsx"
          download="contact-import-sample.xlsx"
          className="inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: "var(--jade)" }}
        >
          <Download size={13} /> Download sample Excel file
        </a>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center transition hover:bg-[var(--paper)]" style={{ borderColor: "var(--jade)", background: "var(--jade-soft)" }}>
          <Upload size={24} style={{ color: "var(--jade-dark)" }} />
          <span className="mt-3 text-sm font-semibold" style={{ color: "var(--jade-dark)" }}>
            {importing ? "Importing…" : file ? file.name : "Choose an Excel or CSV file"}
          </span>
          <span className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
            .xlsx, .xls, or .csv · needs a phone column
          </span>
          <input type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={importing} onChange={handleFile} />
        </label>

        {message.ok && <div className="rounded-xl px-3.5 py-3 text-sm" style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}>{message.ok}</div>}
        {message.err && <div role="alert" className="rounded-xl px-3.5 py-3 text-sm" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>{message.err}</div>}

        <div className="flex justify-end gap-2 border-t pt-4" style={{ borderColor: "var(--line)" }}>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={doImport} disabled={importing || !file}>Import</Button>
        </div>
      </div>
    </Modal>
  )
}
