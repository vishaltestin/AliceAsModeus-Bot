"use client"

import Link from "next/link"
import { use, useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { createColumnHelper, type SortingState } from "@tanstack/react-table"
import {
  ArrowLeft,
  Download,
  FileDown,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UsersRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ReusableDataTable } from "@/components/ui/data-table"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useRole } from "@/components/role-context"
import {
  getCategoryById,
  getCategoryContacts,
  getTagsAndFields,
  importContactsFromCsv,
  exportCategoryContacts,
  deleteContact,
  type CategoryContactsResult,
} from "../../actions"
import { ContactFormModal } from "../../contact-form-modal"
import { parseContactsFileAsync } from "@/lib/client-excel"

type Row = CategoryContactsResult["rows"][number]
type Category = NonNullable<Awaited<ReturnType<typeof getCategoryById>>>

const columnHelper = createColumnHelper<Row>()

export default function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { canWrite } = useRole()
  const [category, setCategory] = useState<Category | null>(null)
  const [meta, setMeta] = useState<{
    tags: { id: string; name: string }[]
    customFields: { id: string; fieldName: string }[]
    categories: { name: string; color: string }[]
  }>({
    tags: [],
    customFields: [],
    categories: [],
  })
  const [data, setData] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [tagFilter, setTagFilter] = useState("ALL")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [sorting, setSorting] = useState<SortingState>([])
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [isPending, startTransition] = useTransition()

  // Debounce search input; reset to the first page when the query changes.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPageIndex(0)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback((opts?: { resetPage?: boolean }) => {
    startTransition(async () => {
      try {
        const sortBy = sorting[0]?.id as "name" | "phone" | "email" | "company" | "createdAt" | undefined
        const result = await getCategoryContacts(id, {
          page: opts?.resetPage ? 1 : pageIndex + 1,
          pageSize,
          search: debouncedSearch || undefined,
          tagId: tagFilter !== "ALL" ? tagFilter : undefined,
          sortBy: sortBy ?? "createdAt",
          sortDir: sorting[0]?.desc ? "desc" : "asc",
        })
        if (!result) {
          setError("Category not found.")
          return
        }
        setData(result.rows)
        setTotal(result.total)
        setError(null)
      } catch (reason) {
        console.error("[wacrm] Category contacts load failed", reason)
        setError("We couldn't load these contacts.")
      } finally {
        setLoading(false)
      }
    })
  }, [id, pageIndex, pageSize, debouncedSearch, sorting, tagFilter])

  useEffect(() => {
    getCategoryById(id).then(setCategory).catch(() => {})
    getTagsAndFields()
      .then((m) =>
        setMeta({
          tags: m.tags,
          customFields: m.customFields,
          categories: m.categories,
        })
      )
      .catch(() => {})
  }, [id])

  useEffect(() => {
    load({ resetPage: false })
  }, [load])

  // Download every contact in the category (server-side, not just current page).
  async function handleExportAll() {
    try {
      const result = await exportCategoryContacts(id)
      if (!result) {
        setError("Category not found.")
        return
      }
      const header = ["Name", "Phone", "Phone Normalized", "Email", "Company", "Tags", "Created"]
      const esc = (v: unknown) => {
        const s = v == null ? "" : String(v)
        return `"${s.replace(/"/g, '""')}"`
      }
      const csv = [
        header.join(","),
        ...result.rows.map((r) =>
          [r.name, r.phone, r.phoneNormalized, r.email, r.company, r.tags, new Date(r.createdAt).toISOString()]
            .map(esc)
            .join(",")
        ),
      ].join("\n")
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `contacts-${result.categoryName.toLowerCase().replace(/\s+/g, "-")}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (reason) {
      console.error("[wacrm] Export all contacts failed", reason)
      setError("We couldn't export these contacts.")
    }
  }

  async function handleDelete(contact: Row) {
    setError(null)
    startTransition(async () => {
      try {
        await deleteContact(contact.id)
        setDeleteTarget(null)
        await load({ resetPage: false })
      } catch (reason) {
        console.error("[wacrm] Delete contact failed", reason)
        setError("We couldn't delete this contact.")
      }
    })
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        cell: (info) => <span className="font-medium" style={{ color: "var(--ink)" }}>{info.getValue() ?? "—"}</span>,
      }),
      columnHelper.accessor("phone", { header: "Phone" }),
      columnHelper.accessor("email", {
        header: "Email",
        cell: (info) =>
          info.getValue() ? (
            <span className="inline-flex items-center gap-1.5 text-[var(--ink-soft)]"><Mail size={12} />{info.getValue()}</span>
          ) : (
            <span style={{ color: "var(--ink-soft)" }}>—</span>
          ),
      }),
      columnHelper.accessor("company", {
        header: "Company",
        cell: (info) => info.getValue() ?? <span style={{ color: "var(--ink-soft)" }}>—</span>,
      }),
      columnHelper.display({
        id: "tags",
        header: "Tags",
        cell: (info) => {
          const tags = info.row.original.tags
          if (!tags || tags.length === 0)
            return <span style={{ color: "var(--ink-soft)" }}>—</span>
          return (
            <div className="flex max-w-[220px] flex-wrap gap-1">
              {tags.map((t, i) => (
                <span key={i} className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--jade-soft)", color: "var(--jade-dark)" }}>
                  {t.tag.name}
                </span>
              ))}
            </div>
          )
        },
      }),
      columnHelper.accessor("createdAt", {
        header: "Added",
        cell: (info) => <span style={{ color: "var(--ink-soft)" }}>{new Date(info.getValue()).toLocaleDateString()}</span>,
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        enableHiding: false,
        cell: (info) => {
          const row = info.row.original
          return (
            <div className="flex justify-end gap-1">
              {canWrite && (
                <button
                  type="button"
                  title="Edit contact"
                  onClick={() => setEditing(row)}
                  className="rounded-lg p-2 transition hover:bg-[var(--paper)]"
                  style={{ color: "var(--jade)" }}
                >
                  <Pencil size={14} />
                </button>
              )}
              {canWrite && (
                <button
                  type="button"
                  title="Delete contact"
                  onClick={() => setDeleteTarget(row)}
                  className="rounded-lg p-2 transition hover:bg-[var(--paper)]"
                  style={{ color: "var(--coral)" }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )
        },
      }),
    ],
    [canWrite]
  )

  if (loading && data.length === 0 && !category) {
    return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl" style={{ background: "var(--paper-raised)" }} />)}</div>
  }
  if (!category) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Category not found</p>
        <Link href="/contacts" className="mt-3 text-sm font-semibold" style={{ color: "var(--jade)" }}>Back to contacts</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Link href="/contacts" className="rounded-xl p-2 transition hover:bg-[var(--paper-raised)]" style={{ color: "var(--ink-soft)" }}>
            <ArrowLeft size={17} />
          </Link>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `color-mix(in_oklch, ${category.color} 16%, transparent)`, color: category.color }}>
            <UsersRound size={20} />
          </span>
          <div>
            <p className="eyebrow">Category</p>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight" style={{ color: "var(--ink)" }}>{category.name}</h1>
            <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{total.toLocaleString()} contacts</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload size={15} /> Import
            </Button>
          )}
          {canWrite && (
            <Button onClick={() => setAddOpen(true)}>
              <Plus size={15} /> Add contact
            </Button>
          )}
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>{error}</div>}

      {/* Server-side search + tag filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--ink-soft)]" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email, company…" className="pl-9" />
        </div>
        <Select
          value={tagFilter}
          onValueChange={(value) => {
            setTagFilter(value)
            setPageIndex(0)
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter by tag">
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="ALL">All tags</SelectItem>
            {meta.tags.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button onClick={() => load()} disabled={isPending} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
          <RefreshCw size={14} className={isPending ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Table */}
      <ReusableDataTable
        data={data}
        columns={columns}
        hideSearch
        enableRowSelection={false}
        enableColumnVisibility
        defaultPageSize={pageSize}
        pageSizeOptions={[10, 20, 50, 100]}
        enableExport={false}
        manualPagination
        manualSorting
        totalRows={total}
        onPaginationChange={(p) => {
          setPageIndex(p.pageIndex)
          setPageSize(p.pageSize)
        }}
        onSortingChange={(s) => setSorting(s)}
        emptyStateMessage={debouncedSearch ? "No contacts match your search." : "No contacts in this category yet."}
        emptyStateDescription="Try adjusting your search or filters."
        toolbarActions={
          <>
            <span className="inline-flex items-center gap-2 text-sm text-[var(--ink-soft)]">
              <UsersRound size={15} style={{ color: "var(--jade)" }} />
              {total.toLocaleString()} contacts
            </span>
            <Button
              variant="outline"
              className="border-[var(--line)]"
              onClick={handleExportAll}
              disabled={total === 0}
            >
              <FileDown size={14} /> Export all
            </Button>
          </>
        }
      />

      {addOpen && (
        <ContactFormModal
          open
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); load({ resetPage: true }) }}
          tags={meta.tags}
          customFields={meta.customFields}
          categories={
            meta.categories.length
              ? meta.categories
              : [{ name: category.name, color: category.color }]
          }
          existing={null}
          defaultCategory={category.name}
        />
      )}

      {importOpen && (
        <CategoryImportModal
          categoryName={category.name}
          tags={meta.tags}
          onClose={() => setImportOpen(false)}
          onDone={() => { setImportOpen(false); load({ resetPage: true }) }}
        />
      )}

      {editing && (
        <ContactFormModal
          open
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load({ resetPage: false }) }}
          tags={meta.tags}
          customFields={meta.customFields}
          categories={
            meta.categories.length
              ? meta.categories
              : [{ name: category.name, color: category.color }]
          }
          existing={{
            id: editing.id,
            name: editing.name,
            phone: editing.phone,
            email: editing.email,
            company: editing.company,
            category: editing.category,
            tags: editing.tags,
            customValues: editing.customValues,
          }}
          defaultCategory={category.name}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title={`Delete "${deleteTarget?.name || deleteTarget?.phone}"?`}
        description="This permanently deletes this contact. This cannot be undone."
        confirmLabel="Delete contact"
        busy={isPending}
      />
    </div>
  )
}

function CategoryImportModal({
  categoryName,
  tags,
  onClose,
  onDone,
}: {
  categoryName: string
  tags: { id: string; name: string }[]
  onClose: () => void
  onDone: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [tagId, setTagId] = useState("NONE")
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ ok?: string; err?: string }>({})
  const [, startTransition] = useTransition()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
    setMessage({})
  }

  function doImport() {
    if (!file) return
    setImporting(true)
    startTransition(async () => {
      try {
        const { rows, errors } = await parseContactsFileAsync(file)
        if (rows.length === 0) {
          setMessage({ err: errors[0] ?? "No valid rows found." })
          return
        }
        const result = await importContactsFromCsv(rows, {
          tagIds: tagId === "NONE" ? [] : [tagId],
          category: categoryName,
        })
        if ("error" in result && result.error) {
          setMessage({ err: result.error })
          return
        }
        const ok = result as { created: number; duplicatesRemoved?: number }
        setMessage({ ok: `Imported ${ok.created.toLocaleString()} contacts${ok.duplicatesRemoved ? ` · ${ok.duplicatesRemoved} duplicate rows skipped` : ""}.` })
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
    <Modal open onClose={onClose} eyebrow="Bulk import" title={`Import into ${categoryName}`} size="md">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--ink)" }}>
            Category
          </span>
          <Select value={categoryName} disabled>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[80]">
              <SelectItem value={categoryName}>{categoryName}</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold" style={{ color: "var(--ink)" }}>
            Tag
          </span>
          <Select value={tagId} onValueChange={setTagId} disabled={importing}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="No tag" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[80]">
              <SelectItem value="NONE">No tag</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
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
          <span className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>.xlsx, .xls, or .csv · needs a phone column</span>
          <input type="file" accept=".xlsx,.xls,.csv,text/csv" className="sr-only" disabled={importing} onChange={handleFile} />
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
