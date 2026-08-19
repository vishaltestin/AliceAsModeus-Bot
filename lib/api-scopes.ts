// The authoritative list of valid API key scopes. Kept server-side so the
// create action can validate against it (client UI imports the same list for
// checkboxes, but the server never trusts the client).
export const API_SCOPES = [
  "messages:send",
  "messages:read",
  "contacts:read",
  "contacts:write",
  "conversations:read",
  "broadcasts:send",
] as const

export type ApiScope = (typeof API_SCOPES)[number]

export function isValidScopes(scopes: unknown): scopes is string[] {
  if (!Array.isArray(scopes)) return false
  return scopes.every(
    (s): s is string => typeof s === "string" && (API_SCOPES as readonly string[]).includes(s)
  )
}
