export const ADMIN_ROLES = ["OWNER", "ADMIN", "SUPER_ADMIN"] as const
export const WRITE_ROLES = ["OWNER", "ADMIN", "AGENT", "SUPER_ADMIN"] as const

// Platform admins should have full write access to the WhatsApp workspace when
// they use the app (e.g. to help a customer configure/send), so SUPER_ADMIN is
// included in both the admin and write role sets.
export function isAdminRole(role: string | null | undefined): boolean {
  return Boolean(
    role && ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])
  )
}

export function canWriteWorkspace(role: string | null | undefined): boolean {
  return Boolean(
    role && WRITE_ROLES.includes(role as (typeof WRITE_ROLES)[number])
  )
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "Member"
  return role.charAt(0) + role.slice(1).toLowerCase()
}

export function isPlatformAdmin(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN"
}

// Server-side helper: throws if the current member cannot write the workspace.
// Use in Server Components/pages to block builders before rendering interactive UI.
export async function assertCanWrite(role: string | null | undefined): Promise<void> {
  if (!canWriteWorkspace(role)) {
    const { redirect } = await import("next/navigation")
    redirect("/dashboard")
  }
}
