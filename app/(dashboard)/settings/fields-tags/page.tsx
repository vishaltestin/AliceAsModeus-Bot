"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useEffect, useState, useTransition } from "react"
import {
  getTags,
  createTag,
  deleteTag,
  getCustomFields,
  createCustomField,
  deleteCustomField,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "./actions"

// Brand palette suggested for new categories.
const CATEGORY_COLOR_PRESETS = [
  "#0A3B9E",
  "#1D5CC8",
  "#3E7DE0",
  "#6FA3F0",
  "#3C3C3C",
]

const card = {
  background: "var(--paper-raised)",
  border: "1px solid var(--line)",
}
export default function FieldsTagsPage() {
  const [tags, setTags] = useState<Awaited<ReturnType<typeof getTags>>>([])
  const [fields, setFields] = useState<
    Awaited<ReturnType<typeof getCustomFields>>
  >([])
  const [categories, setCategories] = useState<
    Awaited<ReturnType<typeof getCategories>>
  >([])
  const [tagName, setTagName] = useState("")
  const [fieldName, setFieldName] = useState("")
  const [fieldType, setFieldType] = useState("text")
  const [categoryName, setCategoryName] = useState("")
  const [categoryColor, setCategoryColor] = useState(CATEGORY_COLOR_PRESETS[1])
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editCategoryName, setEditCategoryName] = useState("")
  const [editCategoryColor, setEditCategoryColor] = useState(CATEGORY_COLOR_PRESETS[1])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  async function refresh() {
    try {
      const [nextTags, nextFields, nextCategories] = await Promise.all([
        getTags(),
        getCustomFields(),
        getCategories(),
      ])
      setTags(nextTags)
      setFields(nextFields)
      setCategories(nextCategories)
      setError(null)
    } catch (reason) {
      console.error("[wacrm] Fields and tags load failed", reason)
      setError("We couldn't load fields, tags, and categories. Please try again.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    const task = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(task)
  }, [])

  if (loading) {
    return (
      <div className="max-w-2xl animate-pulse space-y-4">
        <div
          className="h-8 w-40 rounded-xl"
          style={{ background: "var(--line)" }}
        />
        <div
          className="h-32 rounded-2xl"
          style={{ background: "var(--paper-raised)" }}
        />
        <div
          className="h-8 w-52 rounded-xl"
          style={{ background: "var(--line)" }}
        />
        <div
          className="h-32 rounded-2xl"
          style={{ background: "var(--paper-raised)" }}
        />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Workspace taxonomy"
        title="Fields & tags"
        description="Keep contact data structured so your team can filter, personalize, and route conversations."
      />
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
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
      <div>
        <h1
          className="mb-1 text-2xl font-medium"
          style={{ color: "var(--ink)" }}
        >
          Categories
        </h1>
        <p className="mb-4 text-xs" style={{ color: "var(--ink-soft)" }}>
          Define the categories your team can assign to contacts. You can add
          your own at any time.
        </p>
        <div className="space-y-3 rounded-xl p-4" style={card}>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g. Partner"
              aria-label="New category name"
              className="min-w-40 flex-1"
            />
            <input
              type="color"
              value={categoryColor}
              onChange={(e) => setCategoryColor(e.target.value)}
              aria-label="Category color"
              className="h-10 w-12 cursor-pointer rounded-lg border"
              style={{ borderColor: "var(--line)" }}
            />
            <Button
              size="lg"
              onClick={() =>
                startTransition(async () => {
                  try {
                    await createCategory(categoryName, categoryColor)
                    setCategoryName("")
                    await refresh()
                  } catch (reason) {
                    console.error("[wacrm] Create category failed", reason)
                    setError(
                      "We couldn't create this category. Please try again."
                    )
                  }
                })
              }
              disabled={isPending || !categoryName.trim()}
            >
              Add category
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <span
                key={c.id}
                className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: `color-mix(in_oklch, ${c.color} 14%, transparent)`,
                  color: c.color,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: c.color }}
                />
                {c.name}
                <button
                  onClick={() => {
                    setEditingCategoryId(c.id)
                    setEditCategoryName(c.name)
                    setEditCategoryColor(c.color)
                  }}
                  className="ml-1 text-[10px] font-semibold underline"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Edit
                </button>
                <button
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await deleteCategory(c.id)
                        await refresh()
                      } catch (reason) {
                        console.error("[wacrm] Delete category failed", reason)
                        setError(
                          "We couldn't delete this category. Please try again."
                        )
                      }
                    })
                  }
                  style={{ color: "var(--ink-soft)" }}
                >
                  ×
                </button>
              </span>
            ))}
            {categories.length === 0 && (
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                No categories yet.
              </p>
            )}
          </div>

          {editingCategoryId && (
            <div
              className="flex flex-wrap items-center gap-2 rounded-xl p-3"
              style={{ background: "var(--paper)" }}
            >
              <Input
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
                placeholder="Category name"
                aria-label="Edit category name"
                className="min-w-36 flex-1"
              />
              <input
                type="color"
                value={editCategoryColor}
                onChange={(e) => setEditCategoryColor(e.target.value)}
                aria-label="Edit category color"
                className="h-10 w-12 cursor-pointer rounded-lg border"
                style={{ borderColor: "var(--line)" }}
              />
              <Button
                size="lg"
                onClick={() =>
                  startTransition(async () => {
                    try {
                      await updateCategory(
                        editingCategoryId,
                        editCategoryName,
                        editCategoryColor
                      )
                      setEditingCategoryId(null)
                      await refresh()
                    } catch (reason) {
                      console.error("[wacrm] Update category failed", reason)
                      setError(
                        "We couldn't save this category. Please try again."
                      )
                    }
                  })
                }
                disabled={isPending || !editCategoryName.trim()}
              >
                Save
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => setEditingCategoryId(null)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      <div>
        <h1
          className="mb-4 text-2xl font-medium"
          style={{ color: "var(--ink)" }}
        >
          Tags
        </h1>
        <div className="space-y-3 rounded-xl p-4" style={card}>
          <div className="flex gap-2">
            <Input
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="e.g. VIP"
              aria-label="New tag name"
            />
            <Button
              size="lg"
              onClick={() =>
                startTransition(async () => {
                  try {
                    await createTag(tagName, "#1F6F5C")
                    setTagName("")
                    await refresh()
                  } catch (reason) {
                    console.error("[wacrm] Create tag failed", reason)
                    setError("We couldn't create this tag. Please try again.")
                  }
                })
              }
              disabled={isPending || !tagName.trim()}
            >
              Add tag
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t.id}
                className="flex items-center gap-2 rounded-full px-3 py-1 text-xs"
                style={{
                  background: "var(--jade-soft)",
                  color: "var(--jade-dark)",
                }}
              >
                {t.name}
                <button
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await deleteTag(t.id)
                        await refresh()
                      } catch (reason) {
                        console.error("[wacrm] Delete tag failed", reason)
                        setError(
                          "We couldn't delete this tag. Please try again."
                        )
                      }
                    })
                  }
                  style={{ color: "var(--ink-soft)" }}
                >
                  ×
                </button>
              </span>
            ))}
            {tags.length === 0 && (
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                No tags yet.
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <h1
          className="mb-4 text-2xl font-medium"
          style={{ color: "var(--ink)" }}
        >
          Custom fields
        </h1>
        <div className="space-y-3 rounded-xl p-4" style={card}>
          <div className="flex gap-2">
            <Input
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="e.g. Order ID"
              aria-label="New custom field name"
            />
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger className="w-32" aria-label="Custom field type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="lg"
              onClick={() =>
                startTransition(async () => {
                  try {
                    await createCustomField(fieldName, fieldType)
                    setFieldName("")
                    await refresh()
                  } catch (reason) {
                    console.error("[wacrm] Create custom field failed", reason)
                    setError(
                      "We couldn't create this custom field. Please try again."
                    )
                  }
                })
              }
              disabled={isPending || !fieldName.trim()}
            >
              Add field
            </Button>
          </div>
          <div className="space-y-1">
            {fields.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between px-1 py-1 text-sm"
              >
                <span style={{ color: "var(--ink)" }}>
                  {f.fieldName}{" "}
                  <span style={{ color: "var(--ink-soft)" }}>
                    ({f.fieldType})
                  </span>
                </span>
                <button
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await deleteCustomField(f.id)
                        await refresh()
                      } catch (reason) {
                        console.error(
                          "[wacrm] Delete custom field failed",
                          reason
                        )
                        setError(
                          "We couldn't delete this custom field. Please try again."
                        )
                      }
                    })
                  }
                  className="text-xs"
                  style={{ color: "var(--coral)" }}
                >
                  Delete
                </button>
              </div>
            ))}
            {fields.length === 0 && (
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                No custom fields yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
