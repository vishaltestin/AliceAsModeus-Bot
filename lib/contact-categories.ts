// Default contact categories, seeded for every new account so it starts with a
// sensible set. Users can create additional categories (and delete the
// defaults) at runtime from Settings → Fields & Tags. A contact stores its
// category name in `Contact.category`; the `ContactCategory` table holds the
// live list of valid categories for the account.

export type ContactCategoryDef = {
  name: string
  color: string
}

export const DEFAULT_CONTACT_CATEGORIES: ContactCategoryDef[] = [
  { name: "LEAD", color: "#1D5CC8" },
  { name: "PROSPECT", color: "#3E7DE0" },
  { name: "CUSTOMER", color: "#6FA3F0" },
  { name: "VIP", color: "#0A3B9E" },
  { name: "OTHER", color: "#3C3C3C" },
]

export const CONTACT_CATEGORIES = DEFAULT_CONTACT_CATEGORIES.map(
  (c) => c.name
) as [string, ...string[]]

export const CONTACT_CATEGORY_LABELS: Record<string, string> =
  Object.fromEntries(
    DEFAULT_CONTACT_CATEGORIES.map((c) => [
      c.name,
      c.name[0] + c.name.slice(1).toLowerCase(),
    ])
  ) as Record<string, string>

export type ContactCategory = string

export function isContactCategory(value: unknown): value is ContactCategory {
  return typeof value === "string" && value.trim().length > 0
}
