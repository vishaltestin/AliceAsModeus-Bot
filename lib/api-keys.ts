import { randomBytes, createHash } from "crypto"

export function generateApiKey() {
  const raw = randomBytes(24).toString("hex")
  const plaintext = `wacrm_live_${raw}`
  const keyPrefix = plaintext.slice(0, 18) + "..."
  const keyHash = createHash("sha256").update(plaintext).digest("hex")
  return { plaintext, keyPrefix, keyHash }
}

export function hashApiKey(plaintext: string) {
  return createHash("sha256").update(plaintext).digest("hex")
}
