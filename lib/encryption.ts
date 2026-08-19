import { createCipheriv, createDecipheriv, randomBytes } from "crypto"
import { requireEncryptionKey } from "@/lib/env"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12

function getKey(): Buffer {
  return Buffer.from(requireEncryptionKey(), "hex")
}

// Stored as iv:authTag:ciphertext (all hex) in a single TEXT column.
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`
}

export function decrypt(payload: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(":")
  if (!ivHex || !authTagHex || !dataHex)
    throw new Error("Malformed encrypted payload")

  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivHex, "hex")
  )
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ])
  return decrypted.toString("utf8")
}
