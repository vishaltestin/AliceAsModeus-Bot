"use client"

import { FormEvent, useEffect, useState, useTransition } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ContactCategory } from "@/lib/contact-categories"
import { createContact, updateContact } from "./actions"

type Category = { name: string; color: string }

const fieldStyle = {
  background: "var(--paper)",
  border: "1px solid var(--line)",
  color: "var(--ink)",
}

type Tag = { id: string; name: string }
type CustomField = { id: string; fieldName: string }
type ExistingContact = {
  id: string
  name: string | null
  phone: string
  email: string | null
  company: string | null
  category: string
  tags: { tag: Tag }[]
  customValues: { customFieldId: string; value: string | null }[]
} | null

type ContactFormValues = {
  name: string
  phone: string
  email: string
  company: string
  category: ContactCategory
  tagIds: string[]
  customValues: Record<string, string>
}

export function ContactFormModal({
  open,
  onClose,
  onSaved,
  tags,
  customFields,
  categories,
  existing,
  defaultCategory,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  tags: Tag[]
  customFields: CustomField[]
  categories: Category[]
  existing: ExistingContact
  defaultCategory?: string
}) {
  const [name, setName] = useState(existing?.name ?? "")
  const [phone, setPhone] = useState(existing?.phone ?? "")
  const [email, setEmail] = useState(existing?.email ?? "")
  const [company, setCompany] = useState(existing?.company ?? "")
  const [category, setCategory] = useState<ContactCategory>(
    existing?.category || defaultCategory || categories[0]?.name || ""
  )
  const [tagIds, setTagIds] = useState<string[]>(
    existing?.tags.map((tag) => tag.tag.id) ?? []
  )

  useEffect(() => {
    if (existing?.category) {
      setCategory(existing.category)
      return
    }
    if (defaultCategory) {
      setCategory(defaultCategory)
      return
    }
    if (categories.length && !categories.some((c) => c.name === category)) {
      setCategory(categories[0].name)
    }
  }, [categories, defaultCategory, existing?.category])
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    Object.fromEntries(
      (existing?.customValues ?? []).map((value) => [
        value.customFieldId,
        value.value ?? "",
      ])
    )
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  function toggleTag(id: string) {
    setTagIds((current) =>
      current.includes(id) ? current.filter((tagId) => tagId !== id) : [...current, id]
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const nextFieldErrors: Record<string, string> = {}
    const normalizedPhone = phone.replace(/\D/g, "")
    if (normalizedPhone.length < 7) {
      nextFieldErrors.phone = "Enter a complete phone number with country code."
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      nextFieldErrors.email = "Enter a valid email address."
    }
    if (name.trim().length > 120) nextFieldErrors.name = "Name is too long."
    if (company.trim().length > 120)
      nextFieldErrors.company = "Company name is too long."

    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) return

    const input: ContactFormValues = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      company: company.trim(),
      category,
      tagIds,
      customValues,
    }

    startTransition(async () => {
      try {
        const result = existing
          ? await updateContact(existing.id, input)
          : await createContact(input)

        if ("error" in result && result.error) {
          setError(result.error)
          const serverErrors = "fieldErrors" in result ? result.fieldErrors : {}
          const firstErrors: Record<string, string> = {}
          for (const [field, messages] of Object.entries(serverErrors) as [
            string,
            string[] | undefined,
          ][]) {
            if (messages?.[0]) firstErrors[field] = messages[0]
          }
          setFieldErrors(firstErrors)
          return
        }

        onSaved()
        onClose()
      } catch (reason) {
        console.error("[wacrm] Contact form failed", reason)
        setError("We couldn't save this contact. Please try again.")
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="max-h-[min(760px,92svh)] w-full max-w-lg overflow-y-auto rounded-2xl p-5 shadow-2xl ring-1 ring-black/5 sm:p-6"
        style={{ background: "var(--paper-raised)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p
              className="text-xs font-semibold tracking-[0.16em] uppercase"
              style={{ color: "var(--jade)" }}
            >
              {existing ? "Contact details" : "New relationship"}
            </p>
            <h2
              id="contact-form-title"
              className="mt-1 font-[family-name:var(--font-display)] text-2xl font-medium tracking-tight"
              style={{ color: "var(--ink)" }}
            >
              {existing ? "Edit contact" : "Add a contact"}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
              Keep the details your team needs close at hand.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close contact form"
            onClick={onClose}
            className="rounded-xl p-2 text-xl leading-none transition-colors hover:bg-[var(--paper)]"
            style={{ color: "var(--ink-soft)" }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Name"
              name="contact-name"
              value={name}
              placeholder="Jordan Lee"
              onChange={setName}
              error={fieldErrors.name}
            />
            <Field
              label="Phone number"
              name="contact-phone"
              value={phone}
              placeholder="+1 234 567 8900"
              onChange={setPhone}
              error={fieldErrors.phone}
              disabled={Boolean(existing)}
              required
              hint={
                existing
                  ? "Phone numbers cannot be changed here."
                  : "Include the country code."
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Email"
              name="contact-email"
              type="email"
              value={email}
              placeholder="jordan@company.com"
              onChange={setEmail}
              error={fieldErrors.email}
            />
            <Field
              label="Company"
              name="contact-company"
              value={company}
              placeholder="Acme Support"
              onChange={setCompany}
              error={fieldErrors.company}
            />
          </div>
          <label className="block">
            <span
              className="mb-1.5 block text-xs font-semibold"
              style={{ color: "var(--ink)" }}
            >
              Category
            </span>
            <Select
              value={category || undefined}
              onValueChange={(value) => setCategory(value as ContactCategory)}
            >
              <SelectTrigger className="w-full" aria-label="Contact category">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[80]">
                {categories.map((value) => (
                  <SelectItem key={value.name} value={value.name}>
                    {value.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <div className="border-t pt-4" style={{ borderColor: "var(--line)" }}>
            <p
              className="mb-2 text-sm font-semibold"
              style={{ color: "var(--ink)" }}
            >
              Tags
            </p>
            {tags.length === 0 ? (
              <p
                className="rounded-xl px-3 py-2.5 text-xs"
                style={{ background: "var(--paper)", color: "var(--ink-soft)" }}
              >
                No tags yet. An administrator can create them in Settings.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const selected = tagIds.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleTag(tag.id)}
                      className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                      style={{
                        background: selected ? "var(--jade)" : "var(--paper)",
                        color: selected ? "white" : "var(--ink-soft)",
                        border: `1px solid ${selected ? "var(--jade)" : "var(--line)"}`,
                      }}
                    >
                      {selected ? "✓ " : ""}
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {customFields.length > 0 && (
            <div
              className="border-t pt-4"
              style={{ borderColor: "var(--line)" }}
            >
              <p
                className="mb-3 text-sm font-semibold"
                style={{ color: "var(--ink)" }}
              >
                Custom fields
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {customFields.map((customField) => (
                  <Field
                    key={customField.id}
                    label={customField.fieldName}
                    name={`custom-${customField.id}`}
                    value={customValues[customField.id] ?? ""}
                    placeholder={`Enter ${customField.fieldName.toLowerCase()}`}
                    onChange={(value) =>
                      setCustomValues((current) => ({
                        ...current,
                        [customField.id]: value,
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm"
              style={{ background: "var(--coral-soft)", color: "var(--coral)" }}
            >
              <span
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: "var(--coral)", color: "white" }}
              >
                !
              </span>
              <span>{error}</span>
            </div>
          )}

          <div
            className="flex justify-end gap-2 border-t pt-4"
            style={{ borderColor: "var(--line)" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium"
              style={{ color: "var(--ink-soft)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: "var(--jade)",
                boxShadow: "0 8px 18px rgba(31, 111, 92, 0.16)",
              }}
            >
              {isPending
                ? "Saving…"
                : existing
                  ? "Save contact"
                  : "Create contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  name,
  value,
  placeholder,
  onChange,
  error,
  hint,
  type = "text",
  disabled = false,
  required = false,
}: {
  label: string
  name: string
  value: string
  placeholder: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  type?: string
  disabled?: boolean
  required?: boolean
}) {
  const descriptionId = `${name}-description`
  return (
    <label className="block">
      <span
        className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold"
        style={{ color: "var(--ink)" }}
      >
        <span>{label}</span>
        {required && (
          <span
            className="text-[10px] font-normal"
            style={{ color: "var(--ink-soft)" }}
          >
            Required
          </span>
        )}
      </span>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? descriptionId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl px-3.5 py-2.5 text-sm transition outline-none disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          ...fieldStyle,
          borderColor: error ? "var(--coral)" : "var(--line)",
        }}
      />
      {(error || hint) && (
        <span
          id={descriptionId}
          className="mt-1.5 block text-[11px]"
          style={{ color: error ? "var(--coral)" : "var(--ink-soft)" }}
        >
          {error || hint}
        </span>
      )}
    </label>
  )
}
