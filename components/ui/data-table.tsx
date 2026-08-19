"use client"

import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Filter,
  Search,
  SlidersHorizontal,
} from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface FilterConfig {
  columnId: string
  label: string
  options?: { label: string; value: string }[]
  type?: "select" | "boolean" | "month" | "text"
}

export interface DataTableConfig<TData> {
  data: TData[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack's ColumnDef is covariant over TValue; `any` lets callers pass columnHelper-typed columns of any value type.
  columns: ColumnDef<TData, any>[]
  searchPlaceholder?: string
  searchableColumns?: (keyof TData)[]
  filterConfigs?: FilterConfig[]
  enableRowSelection?: boolean
  enableColumnVisibility?: boolean
  enableExport?: boolean
  exportFileName?: string
  defaultPageSize?: number
  pageSizeOptions?: number[]
  toolbarActions?: React.ReactNode
  initialSorting?: SortingState
  emptyStateMessage?: string
  emptyStateDescription?: string
  bulkActions?: (selectedRows: TData[], clearSelection: () => void) => React.ReactNode
  containerClassName?: string
  // Server-side pagination (the table only renders the current page; the parent
  // fetches pages). When true, page size / page navigation call onPaginationChange.
  manualPagination?: boolean
  totalRows?: number
  onPaginationChange?: (p: { pageIndex: number; pageSize: number }) => void
  // Server-side sorting: sorting state is forwarded to the parent (onSortingChange)
  // which refetches; rows are NOT re-sorted client-side.
  manualSorting?: boolean
  onSortingChange?: (s: SortingState) => void
  hideSearch?: boolean
}

function toCSVValue(value: unknown): string {
  if (value == null) return ""
  if (value instanceof Date) return value.toISOString()
  return String(value).replace(/"/g, '""')
}

export function ReusableDataTable<TData extends Record<string, unknown>>({
  data,
  columns,
  searchPlaceholder = "Search…",
  searchableColumns = [],
  filterConfigs = [],
  enableRowSelection = true,
  enableColumnVisibility = true,
  enableExport = false,
  exportFileName = "export.csv",
  defaultPageSize = 10,
  pageSizeOptions = [10, 20, 30, 50, 100],
  toolbarActions,
  initialSorting = [],
  emptyStateMessage = "No results found",
  emptyStateDescription = "Try adjusting your search or filters",
  bulkActions,
  containerClassName,
  manualPagination = false,
  totalRows: totalRowsProp,
  onPaginationChange,
  manualSorting = false,
  onSortingChange,
  hideSearch = false,
}: DataTableConfig<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  })

  const tableColumns: ColumnDef<TData, unknown>[] = enableRowSelection
    ? [
        {
          id: "select",
          header: ({ table }) => (
            <div className="px-1">
              <Checkbox
                checked={
                  table.getIsAllPageRowsSelected() ||
                  (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all"
              />
            </div>
          ),
          cell: ({ row }) => (
            <div className="px-1">
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
              />
            </div>
          ),
          enableSorting: false,
          enableHiding: false,
          size: 40,
        },
        ...columns,
      ]
    : columns

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack returns functions that can't be memoized.
  const table = useReactTable({
    data,
    columns: tableColumns,
    onSortingChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(sorting) : updater
      setSorting(next)
      onSortingChange?.(next)
    },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getFilteredRowModel: manualPagination ? undefined : getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(pagination) : updater
      setPagination(next)
      onPaginationChange?.(next)
    },
    manualPagination,
    manualSorting,
    pageCount:
      manualPagination && totalRowsProp != null
        ? Math.ceil(totalRowsProp / pagination.pageSize)
        : undefined,
    autoResetPageIndex: false,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination,
    },
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).toLowerCase()
      return searchableColumns.some((column) => {
        const value = row.original[column]
        return value != null && String(value).toLowerCase().includes(search)
      })
    },
  })

  const clearAllFilters = () => {
    setGlobalFilter("")
    filterConfigs.forEach((config) => {
      table.getColumn(config.columnId)?.setFilterValue("")
    })
    table.setPageIndex(0)
  }

  const hasActiveFilters =
    globalFilter !== "" ||
    filterConfigs.some(
      (config) => table.getColumn(config.columnId)?.getFilterValue() !== undefined
    )

  const handleExportCSV = () => {
    const selected =
      manualPagination
        ? table.getSelectedRowModel().rows
        : table.getFilteredSelectedRowModel().rows
    const allRows = manualPagination
      ? table.getCoreRowModel().rows
      : table.getFilteredRowModel().rows
    const rowsToExport = selected.length > 0 ? selected : allRows

    if (rowsToExport.length === 0) return

    const headers = Object.keys(rowsToExport[0].original) as (keyof TData)[]
    const csvRows = rowsToExport.map((row) =>
      headers.map((header) => `"${toCSVValue(row.original[header])}"`).join(",")
    )
    const csvContent = [headers.join(","), ...csvRows].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = exportFileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const selectedRows = (
    manualPagination
      ? table.getSelectedRowModel().rows
      : table.getFilteredSelectedRowModel().rows
  ).map((r) => r.original)
  const totalRows: number = manualPagination
    ? totalRowsProp ?? 0
    : table.getFilteredRowModel().rows.length
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min((pageIndex + 1) * pageSize, totalRows)

  return (
    <div className={cn("space-y-4 rounded-2xl border bg-[var(--paper-raised)] p-5 shadow-sm ring-1 ring-black/5", containerClassName)}>
      {/* Toolbar: search + filters + actions */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          {!hideSearch && (
            <div className="relative flex-1 lg:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-soft)]" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter ?? ""}
                onChange={(event) => {
                  setGlobalFilter(String(event.target.value))
                  table.setPageIndex(0)
                }}
                className="pl-9"
              />
            </div>
          )}
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearAllFilters} className="border-[var(--line)]">
              <Filter className="mr-2 h-4 w-4" />
              Clear filters
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">{toolbarActions}</div>
      </div>

      {/* Filter configs + column visibility + export */}
      {(filterConfigs.length > 0 || enableColumnVisibility || enableExport) && (
        <div className="flex flex-wrap items-center gap-2">
          {filterConfigs.map((config) => {
            const column = table.getColumn(config.columnId)
            const current = (column?.getFilterValue() as string) ?? ""
            return (
              <div key={config.columnId} className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold tracking-wide text-[var(--ink-soft)] uppercase">
                  {config.label}
                </span>
                {config.type === "month" ? (
                  <Input
                    type="month"
                    value={current}
                    onChange={(e) => {
                      column?.setFilterValue(e.target.value || "")
                      table.setPageIndex(0)
                    }}
                    className="h-9 w-40"
                  />
                ) : config.type === "text" ? (
                  <Input
                    value={current}
                    onChange={(e) => {
                      column?.setFilterValue(e.target.value || "")
                      table.setPageIndex(0)
                    }}
                    placeholder={config.label}
                    className="h-9 w-40"
                  />
                ) : (
                  <Select
                    value={config.type === "boolean" ? (current === "true" ? "true" : current === "false" ? "false" : "all") : current || "all"}
                    onValueChange={(value) => {
                      if (config.type === "boolean") {
                        column?.setFilterValue(value === "all" ? "" : value === "true")
                      } else {
                        column?.setFilterValue(value === "all" ? "" : value)
                      }
                      table.setPageIndex(0)
                    }}
                  >
                    <SelectTrigger className="h-9 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="all">All {config.label}</SelectItem>
                      {config.options?.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )
          })}

          <div className="ml-auto flex items-center gap-2">
            {enableColumnVisibility && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-[var(--line)]">
                    <Columns3 className="mr-2 h-4 w-4" />
                    Columns
                    <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <p className="px-2 py-1.5 text-sm font-medium text-[var(--ink)]">
                    Customize columns
                  </p>
                  {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {enableExport && (
              <Button
                variant="outline"
                className="border-[var(--line)]"
                onClick={handleExportCSV}
                disabled={totalRows === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Status line + bulk actions */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--ink-soft)]">
        <span>
          {totalRows} {totalRows === 1 ? "result" : "results"} found
        </span>
        {enableRowSelection && selectedRows.length > 0 && (
          <span className="font-medium text-[var(--jade-dark)]">
            {selectedRows.length} selected
          </span>
        )}
        {enableRowSelection &&
          bulkActions &&
          selectedRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-[var(--jade-soft)] px-3 py-2">
              {bulkActions(selectedRows, () => table.resetRowSelection())}
            </div>
          )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="whitespace-nowrap bg-[var(--paper)]"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={
                          header.column.getCanSort()
                            ? "inline-flex items-center gap-1 select-none"
                            : "inline-flex items-center gap-1"
                        }
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" && (
                          <ChevronDown className="h-3.5 w-3.5 -rotate-180" />
                        )}
                        {header.column.getIsSorted() === "desc" && (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-[var(--ink-soft)]">
                    <SlidersHorizontal className="h-6 w-6" />
                    <p className="text-sm font-medium text-[var(--ink)]">{emptyStateMessage}</p>
                    <p className="text-xs">{emptyStateDescription}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--ink-soft)]">Rows per page</span>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-9 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {pageSizeOptions.map((ps) => (
                <SelectItem key={ps} value={String(ps)}>
                  {ps}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col items-center gap-3 md:flex-row">
          <div className="text-sm text-[var(--ink-soft)]">
            Showing <span className="font-medium text-[var(--ink)]">{from}</span> to{" "}
            <span className="font-medium text-[var(--ink)]">{to}</span> of{" "}
            <span className="font-medium text-[var(--ink)]">{totalRows}</span> entries
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 border-[var(--line)]"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm text-[var(--ink-soft)]">
              Page{" "}
              <span className="font-medium text-[var(--ink)]">{pageIndex + 1}</span> of{" "}
              <span className="font-medium text-[var(--ink)]">
                {Math.max(1, table.getPageCount())}
              </span>
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 border-[var(--line)]"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
