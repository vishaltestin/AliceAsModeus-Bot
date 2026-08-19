"use server"

import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeAuditLog } from "@/lib/audit"
import { canWriteWorkspace } from "@/lib/permissions"
import type { ContactCategory } from "@/lib/contact-categories"

async function requireSession() {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  return session
}

// Write actions require at least AGENT; VIEWER is read-only.
async function requireWriteSession() {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  if (!canWriteWorkspace(session.user.accountRole))
    throw new Error("Viewers can only read contacts")
  return session
}

const contactInputSchema = z.object({
  name: z.string().trim().max(120, "Name is too long.").default(""),
  phone: z.string().trim().min(1, "Phone number is required."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .or(z.literal(""))
    .default(""),
  company: z.string().trim().max(120, "Company name is too long.").default(""),
  category: z.string().trim().min(1, "Choose a category.").default("LEAD"),
  tagIds: z.array(z.string()).default([]),
  customValues: z.record(z.string(), z.string()).default({}),
})

type ContactInput = z.infer<typeof contactInputSchema>

type ImportRow = {
  phone: string
  name?: string
  email?: string
  company?: string
  category?: string
}

const importRowSchema = z.object({
  phone: z.string().trim().min(1),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  company: z.string().trim().max(120).optional(),
  category: z.string().trim().min(1).optional(),
})

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "")
}

function parseContactInput(input: unknown) {
  const parsed = contactInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error: "Please correct the highlighted contact fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const phoneNormalized = normalizePhone(parsed.data.phone)
  if (phoneNormalized.length < 7) {
    return {
      error: "Please enter a phone number with at least 7 digits.",
      fieldErrors: {
        phone: ["Enter a complete phone number with country code."],
      },
    }
  }

  return {
    data: {
      ...parsed.data,
      phoneNormalized,
      email: parsed.data.email || "",
      tagIds: [...new Set(parsed.data.tagIds)],
    },
  }
}

async function validateRelations(
  accountId: string,
  tagIds: string[],
  customFieldIds: string[]
) {
  const [tagCount, fieldCount] = await Promise.all([
    tagIds.length
      ? prisma.tag.count({ where: { id: { in: tagIds }, accountId } })
      : Promise.resolve(0),
    customFieldIds.length
      ? prisma.customField.count({
          where: { id: { in: customFieldIds }, accountId },
        })
      : Promise.resolve(0),
  ])

  if (tagCount !== tagIds.length) {
    return { error: "One or more selected tags are no longer available." }
  }
  if (fieldCount !== customFieldIds.length) {
    return { error: "One or more custom fields are no longer available." }
  }

  return { success: true as const }
}

async function categoryExists(accountId: string, category: string) {
  if (!category) return true
  const row = await prisma.contactCategory.findFirst({
    where: { accountId, name: category },
    select: { id: true },
  })
  if (row) return true
  // If the account has no categories at all, don't block creating contacts.
  const total = await prisma.contactCategory.count({ where: { accountId } })
  return total === 0
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

export async function getContacts() {
  const session = await requireSession()
  return prisma.contact.findMany({
    where: { accountId: session.user.accountId },
    include: {
      tags: { include: { tag: true } },
      customValues: { include: { customField: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getTagsAndFields() {
  const session = await requireSession()
  const [tags, customFields, categories] = await Promise.all([
    prisma.tag.findMany({
      where: { accountId: session.user.accountId },
      orderBy: { name: "asc" },
    }),
    prisma.customField.findMany({
      where: { accountId: session.user.accountId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.contactCategory.findMany({
      where: { accountId: session.user.accountId },
      orderBy: [{ createdAt: "asc" }],
    }),
  ])
  return { tags, customFields, categories }
}

export async function getCategories() {
  const session = await requireSession()
  return prisma.contactCategory.findMany({
    where: { accountId: session.user.accountId },
    orderBy: [{ createdAt: "asc" }],
  })
}

/* -------------------------------------------------------------------------- */
/* Category overview (contacts landing page)                                    */
/* -------------------------------------------------------------------------- */

export type CategoryOverviewRow = {
  id: string
  name: string
  color: string
  count: number
  duplicateCount: number
}

export async function getCategoryOverview(): Promise<CategoryOverviewRow[]> {
  const session = await requireSession()
  const accountId = session.user.accountId

  const categories = await prisma.contactCategory.findMany({
    where: { accountId },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, name: true, color: true },
  })

  // Count contacts per category.
  const counts = await prisma.contact.groupBy({
    by: ["category"],
    where: { accountId },
    _count: { _all: true },
  })
  const countMap = new Map(counts.map((c) => [c.category, c._count._all]))

  // Detect duplicates: a contact is a duplicate when another contact in the
  // account shares its (non-empty) email address — i.e. the same person appears
  // in more than one category. Phone numbers are globally unique per account
  // (enforced by a unique index), so email is the dedupe key here.
  const emailGroups = await prisma.contact.groupBy({
    by: ["email"],
    where: { accountId, NOT: [{ email: null }, { email: "" }] },
    _count: { _all: true },
    having: { email: { _count: { gt: 1 } } },
  })
  const dupEmails = emailGroups
    .map((g) => g.email)
    .filter((e): e is string => Boolean(e))
  const dupCounts = dupEmails.length
    ? await prisma.contact.groupBy({
        by: ["category"],
        where: { accountId, email: { in: dupEmails } },
        _count: { _all: true },
      })
    : []
  const dupCountMap = new Map(dupCounts.map((c) => [c.category, c._count._all]))

  return categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      count: countMap.get(c.name) ?? 0,
      duplicateCount: dupCountMap.get(c.name) ?? 0,
    }))
    .filter((c) => c.count > 0)
}

/* -------------------------------------------------------------------------- */
/* Category detail                                                              */
/* -------------------------------------------------------------------------- */

export async function getCategoryById(categoryId: string) {
  const session = await requireSession()
  if (!categoryId) return null
  const category = await prisma.contactCategory.findFirst({
    where: { id: categoryId, accountId: session.user.accountId },
  })
  if (!category) return null
  return { id: category.id, name: category.name, color: category.color }
}

export type CategoryContactsQuery = {
  page?: number
  pageSize?: number
  search?: string
  tagId?: string
  sortBy?: "name" | "phone" | "email" | "company" | "createdAt"
  sortDir?: "asc" | "desc"
}

export type CategoryContactsResult = {
  rows: {
    id: string
    name: string | null
    phone: string
    email: string | null
    company: string | null
    category: string
    createdAt: Date
    tags: { tag: { id: string; name: string } }[]
    customValues: { customFieldId: string; value: string | null }[]
  }[]
  total: number
  page: number
  pageSize: number
}

export async function getCategoryContacts(
  categoryId: string,
  query: CategoryContactsQuery = {}
): Promise<CategoryContactsResult | null> {
  const session = await requireSession()
  const category = await getCategoryById(categoryId)
  if (!category) return null

  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20))
  const search = query.search?.trim().toLowerCase() || ""

  const where: Record<string, unknown> = {
    accountId: session.user.accountId,
    category: category.name,
  }
  if (query.tagId) {
    where.tags = { some: { tagId: query.tagId } }
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
      { company: { contains: search } },
    ]
  }

  const sortBy = query.sortBy ?? "createdAt"
  const sortDir = query.sortDir ?? "desc"
  const orderBy: Record<string, string> = { [sortBy]: sortDir }

  const [total, rows] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        tags: { include: { tag: true } },
        customValues: { select: { customFieldId: true, value: true } },
      },
    }),
  ])

  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      company: r.company,
      category: r.category,
      createdAt: r.createdAt,
      tags: r.tags,
      customValues: r.customValues.map((v) => ({
        customFieldId: v.customFieldId,
        value: v.value,
      })),
    })),
    total,
    page,
    pageSize,
  }
}

// Deletes a category's contacts AND the category definition itself, so the
// category card disappears entirely (not just its contacts). Scoped to account.
export async function deleteCategoryContacts(categoryId: string) {
  const session = await requireWriteSession()
  const category = await getCategoryById(categoryId)
  if (!category) return { error: "Category not found." }

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.contact.deleteMany({
      where: { accountId: session.user.accountId, category: category.name },
    })
    await tx.contactCategory.deleteMany({
      where: { id: categoryId, accountId: session.user.accountId },
    })
    return deleted
  })

  await writeAuditLog({
    accountId: session.user.accountId,
    userId: session.user.id,
    action: "CONTACTS_DELETED_BY_CATEGORY",
    entityType: "ContactCategory",
    entityId: categoryId,
    metadata: { category: category.name, count: result.count },
  })
  return { success: true as const, count: result.count }
}

export async function getCategoryTotalContacts(categoryId: string) {
  const category = await getCategoryById(categoryId)
  if (!category) return 0
  const session = await requireSession()
  return prisma.contact.count({
    where: { accountId: session.user.accountId, category: category.name },
  })
}

export type CategoryContactExportRow = {
  name: string | null
  phone: string
  phoneNormalized: string
  email: string | null
  company: string | null
  createdAt: Date
  tags: string
}

// Export ALL contacts in a category (server-side, not just the current page).
// Returns the full set so the client can download a complete CSV.
export async function exportCategoryContacts(
  categoryId: string
): Promise<{ rows: CategoryContactExportRow[]; categoryName: string } | null> {
  const session = await requireSession()
  const category = await getCategoryById(categoryId)
  if (!category) return null

  const contacts = await prisma.contact.findMany({
    where: { accountId: session.user.accountId, category: category.name },
    orderBy: { createdAt: "desc" },
    include: { tags: { include: { tag: { select: { name: true } } } } },
  })

  return {
    categoryName: category.name,
    rows: contacts.map((c) => ({
      name: c.name,
      phone: c.phone,
      phoneNormalized: c.phoneNormalized,
      email: c.email,
      company: c.company,
      createdAt: c.createdAt,
      tags: c.tags.map((t) => t.tag.name).join(", "),
    })),
  }
}

export async function createContact(input: ContactInput) {
  const session = await requireWriteSession()
  const parsed = parseContactInput(input)
  if (!parsed.data) return parsed

  const relationCheck = await validateRelations(
    session.user.accountId,
    parsed.data.tagIds,
    Object.keys(parsed.data.customValues)
  )
  if (relationCheck.error) return relationCheck

  if (!(await categoryExists(session.user.accountId, parsed.data.category)))
    return {
      error: "Please choose a valid contact category.",
      fieldErrors: { category: ["This category is no longer available."] },
    }

  const { phoneNormalized, tagIds, customValues } = parsed.data
  // Uniqueness is per-account only — the same phone can exist on another company.
  const existing = await prisma.contact.findFirst({
    where: {
      accountId: session.user.accountId,
      phoneNormalized,
    },
    select: { id: true },
  })
  if (existing) {
    return {
      error: "A contact with this phone number already exists in this workspace.",
      fieldErrors: {
        phone: ["This phone number is already in this company's contacts."],
      },
    }
  }

  try {
    const contact = await prisma.contact.create({
      data: {
        accountId: session.user.accountId,
        createdByUserId: session.user.id,
        name: parsed.data.name || null,
        phone: parsed.data.phone,
        phoneNormalized,
        email: parsed.data.email || null,
        company: parsed.data.company || null,
        category: parsed.data.category,
        tags: tagIds.length
          ? { create: tagIds.map((tagId) => ({ tagId })) }
          : undefined,
        customValues: {
          create: Object.entries(customValues)
            .filter(([, value]) => value.trim())
            .map(([customFieldId, value]) => ({
              customFieldId,
              value: value.trim(),
            })),
        },
      },
    })

    await writeAuditLog({
      accountId: session.user.accountId,
      userId: session.user.id,
      action: "CONTACT_CREATED",
      entityType: "Contact",
      entityId: contact.id,
      metadata: { category: parsed.data.category },
    })
    return { success: true as const, contact }
  } catch (error) {
    console.error("[wacrm] Create contact failed", error)
    if (isUniqueConstraintError(error)) {
      return { error: "A contact with this phone number already exists." }
    }
    return { error: "We couldn't create this contact. Please try again." }
  }
}

export async function updateContact(id: string, input: ContactInput) {
  const session = await requireWriteSession()
  if (!id) return { error: "Contact id is required." }

  const parsed = parseContactInput(input)
  if (!parsed.data) return parsed

  const contact = await prisma.contact.findFirst({
    where: { id, accountId: session.user.accountId },
  })
  if (!contact) return { error: "Contact not found." }

  const relationCheck = await validateRelations(
    session.user.accountId,
    parsed.data.tagIds,
    Object.keys(parsed.data.customValues)
  )
  if (relationCheck.error) return relationCheck

  if (!(await categoryExists(session.user.accountId, parsed.data.category)))
    return {
      error: "Please choose a valid contact category.",
      fieldErrors: { category: ["This category is no longer available."] },
    }

  const customValues = Object.entries(parsed.data.customValues).filter(
    ([, value]) => value.trim()
  )

  try {
    await prisma.$transaction(async (tx) => {
      await tx.contact.update({
        where: { id },
        data: {
          name: parsed.data.name || null,
          email: parsed.data.email || null,
          company: parsed.data.company || null,
          category: parsed.data.category,
        },
      })
      await tx.contactTag.deleteMany({ where: { contactId: id } })
      if (parsed.data.tagIds.length) {
        await tx.contactTag.createMany({
          data: parsed.data.tagIds.map((tagId) => ({ contactId: id, tagId })),
        })
      }
      await tx.contactCustomValue.deleteMany({ where: { contactId: id } })
      if (customValues.length) {
        await tx.contactCustomValue.createMany({
          data: customValues.map(([customFieldId, value]) => ({
            contactId: id,
            customFieldId,
            value: value.trim(),
          })),
        })
      }
    })

    await writeAuditLog({
      accountId: session.user.accountId,
      userId: session.user.id,
      action: "CONTACT_UPDATED",
      entityType: "Contact",
      entityId: id,
      metadata: { category: parsed.data.category },
    })
    return { success: true as const }
  } catch (error) {
    console.error("[wacrm] Update contact failed", error)
    return { error: "We couldn't save this contact. Please try again." }
  }
}

export async function deleteContact(id: string) {
  const session = await requireWriteSession()
  if (!id) return { error: "Contact id is required." }

  const result = await prisma.contact.deleteMany({
    where: { id, accountId: session.user.accountId },
  })
  if (result.count === 0) return { error: "Contact not found." }
  await writeAuditLog({
    accountId: session.user.accountId,
    userId: session.user.id,
    action: "CONTACT_DELETED",
    entityType: "Contact",
    entityId: id,
  })
  return { success: true as const }
}

export async function getContactNotes(contactId: string) {
  const session = await requireSession()
  if (!contactId) throw new Error("Contact id is required")
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, accountId: session.user.accountId },
  })
  if (!contact) throw new Error("Not found")
  return prisma.contactNote.findMany({
    where: { contactId },
    include: { author: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  })
}

export async function addContactNote(contactId: string, body: string) {
  const session = await requireWriteSession()
  if (!contactId) throw new Error("Contact id is required")
  if (!body.trim()) throw new Error("Note can't be empty")
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, accountId: session.user.accountId },
  })
  if (!contact) throw new Error("Not found")
  return prisma.contactNote.create({
    data: { contactId, authorId: session.user.id, body: body.trim() },
    include: { author: { select: { name: true, email: true } } },
  })
}

export async function importContactsFromCsv(
  rows: ImportRow[],
  options: { tagIds: string[]; category: ContactCategory }
) {
  const session = await requireWriteSession()
  if (rows.length > 500)
    return { error: "Imports are processed in chunks of 500 rows or fewer." }

  const tagIds = [...new Set(options.tagIds)]

  // Validate that every selected tag belongs to this account.
  if (tagIds.length) {
    const tagCount = await prisma.tag.count({
      where: { id: { in: tagIds }, accountId: session.user.accountId },
    })
    if (tagCount !== tagIds.length)
      return { error: "One or more selected tags are no longer available." }
  }

  // Load the account's valid category names once; rows that carry an unknown
  // category fall back to the popup-selected default.
  const validCategories = new Set(
    (
      await prisma.contactCategory.findMany({
        where: { accountId: session.user.accountId },
        select: { name: true },
      })
    ).map((c) => c.name)
  )
  const defaultCategory = validCategories.has(options.category)
    ? options.category
    : "LEAD"

  let created = 0
  let skipped = 0
  let duplicatesRemoved = 0
  const errors: string[] = []
  const seenPhones = new Set<string>()

  for (const [index, row] of rows.entries()) {
    const parsed = importRowSchema.safeParse(row)
    if (!parsed.success) {
      skipped += 1
      errors.push(`Row ${index + 2}: invalid contact data.`)
      continue
    }

    const phoneNormalized = normalizePhone(parsed.data.phone)
    if (phoneNormalized.length < 7) {
      skipped += 1
      errors.push(`Row ${index + 2}: phone number is too short.`)
      continue
    }

    // Remove duplicate phone numbers within the file — keep the first row.
    if (seenPhones.has(phoneNormalized)) {
      duplicatesRemoved += 1
      continue
    }
    seenPhones.add(phoneNormalized)

    try {
      // Skip contacts that already exist in the database (dedupe).
      const existing = await prisma.contact.findFirst({
        where: {
          accountId: session.user.accountId,
          phoneNormalized,
        },
        select: { id: true },
      })
      if (existing) {
        skipped += 1
        errors.push(
          `Row ${index + 2}: phone number already exists, skipped.`
        )
        continue
      }

      await prisma.contact.create({
        data: {
          accountId: session.user.accountId,
          createdByUserId: session.user.id,
          phone: parsed.data.phone,
          phoneNormalized,
          name: parsed.data.name || null,
          email: parsed.data.email || null,
          company: parsed.data.company || null,
          // The popup-selected category is the default; a CSV category column,
          // when present and valid, overrides it.
          category: parsed.data.category
            ? validCategories.has(parsed.data.category)
              ? parsed.data.category
              : defaultCategory
            : defaultCategory,
          tags: tagIds.length
            ? { create: tagIds.map((tagId) => ({ tagId })) }
            : undefined,
        },
      })
      created += 1
    } catch (error) {
      console.error("[wacrm] Import contact row failed", error)
      skipped += 1
      errors.push(`Row ${index + 2}: could not be saved.`)
    }
  }

  return { created, updated: 0, skipped, duplicatesRemoved, errors }
}
