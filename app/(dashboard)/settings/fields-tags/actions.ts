"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminRole } from "@/lib/permissions"

async function requireSession() {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  return session
}

async function requireAdmin() {
  const session = await requireSession()
  if (!isAdminRole(session.user.accountRole)) {
    throw new Error("Forbidden")
  }
  return session
}

export async function getTags() {
  const session = await requireSession()
  return prisma.tag.findMany({
    where: { accountId: session.user.accountId },
    orderBy: { name: "asc" },
  })
}

export async function createTag(name: string, color: string) {
  const session = await requireAdmin()
  if (!name.trim()) throw new Error("Tag name is required")
  return prisma.tag.upsert({
    where: { accountId_name: { accountId: session.user.accountId, name } },
    create: { accountId: session.user.accountId, name, color },
    update: { color },
  })
}

export async function deleteTag(id: string) {
  const session = await requireAdmin()
  await prisma.tag.deleteMany({
    where: { id, accountId: session.user.accountId },
  })
}

export async function getCustomFields() {
  const session = await requireSession()
  return prisma.customField.findMany({
    where: { accountId: session.user.accountId },
    orderBy: { createdAt: "asc" },
  })
}

export async function createCustomField(fieldName: string, fieldType: string) {
  const session = await requireAdmin()
  if (!fieldName.trim()) throw new Error("Field name is required")
  return prisma.customField.create({
    data: { accountId: session.user.accountId, fieldName, fieldType },
  })
}

export async function deleteCustomField(id: string) {
  const session = await requireAdmin()
  await prisma.customField.deleteMany({
    where: { id, accountId: session.user.accountId },
  })
}

export async function getCategories() {
  const session = await requireSession()
  return prisma.contactCategory.findMany({
    where: { accountId: session.user.accountId },
    orderBy: [{ createdAt: "asc" }],
  })
}

export async function createCategory(name: string, color: string) {
  const session = await requireAdmin()
  const trimmed = name.trim()
  if (!trimmed) throw new Error("Category name is required")
  return prisma.contactCategory.upsert({
    where: {
      accountId_name: {
        accountId: session.user.accountId,
        name: trimmed.toUpperCase(),
      },
    },
    create: {
      accountId: session.user.accountId,
      name: trimmed.toUpperCase(),
      color,
    },
    update: { color },
  })
}

export async function deleteCategory(id: string) {
  const session = await requireAdmin()
  await prisma.$transaction(async (tx) => {
    const category = await tx.contactCategory.findFirst({
      where: { id, accountId: session.user.accountId },
      select: { id: true, name: true },
    })
    if (!category) return
    // Contacts store the category NAME, so deleting a category should also
    // remove its contacts to avoid leaving orphaned rows.
    await tx.contact.deleteMany({
      where: { accountId: session.user.accountId, category: category.name },
    })
    await tx.contactCategory.deleteMany({
      where: { id, accountId: session.user.accountId },
    })
  })
}

export async function updateCategory(
  id: string,
  name: string,
  color: string
) {
  const session = await requireAdmin()
  const trimmed = name.trim()
  if (!trimmed) throw new Error("Category name is required")
  const newName = trimmed.toUpperCase()

  // `Contact.category` stores the category NAME (not the id), so a rename must
  // cascade to every contact of this category — otherwise the contacts appear
  // to vanish because they still carry the old name.
  await prisma.$transaction(async (tx) => {
    const existing = await tx.contactCategory.findFirst({
      where: { id, accountId: session.user.accountId },
      select: { id: true, name: true },
    })
    if (!existing) return

    await tx.contactCategory.updateMany({
      where: { id, accountId: session.user.accountId },
      data: { name: newName, color },
    })
    if (existing.name !== newName) {
      await tx.contact.updateMany({
        where: {
          accountId: session.user.accountId,
          category: existing.name,
        },
        data: { category: newName },
      })
    }
  })
  return { success: true }
}
