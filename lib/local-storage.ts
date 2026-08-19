import { writeFile, mkdir } from "fs/promises"
import path from "path"
import crypto from "crypto"

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "uploads")

function publicSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be set — WhatsApp needs a real public URL to fetch outbound media from."
    )
  }
  return url.replace(/\/$/, "")
}

export async function uploadMedia(
  file: Buffer,
  originalFilename: string
): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true })

  // Never trust the original filename directly — strip it to just the
  // extension and generate our own name, so nothing user-supplied ever
  // becomes part of a filesystem path.
  const ext = path.extname(originalFilename).toLowerCase()
  const safeName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`

  await writeFile(path.join(UPLOAD_DIR, safeName), file)

  return `${publicSiteUrl()}/api/media/${safeName}`
}

export function getUploadDir() {
  return UPLOAD_DIR
}
