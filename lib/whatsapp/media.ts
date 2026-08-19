import { getMediaUrl } from "./client"
import { uploadMedia } from "@/lib/local-storage"

// Meta's media URLs expire quickly and require the app's access token to
// fetch — they can't be embedded directly in the UI or stored long-term.
// This downloads the bytes once and re-hosts them on our own disk so the
// message row has a permanent, publicly-viewable link.
export async function downloadAndStoreMedia(
  mediaId: string,
  accessToken: string
): Promise<{ url: string; mimeType: string }> {
  const meta = await getMediaUrl(mediaId, accessToken)
  const res = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok)
    throw new Error(`Failed to download media from Meta (${res.status})`)

  const buffer = Buffer.from(await res.arrayBuffer())
  const url = await uploadMedia(
    buffer,
    `media.${meta.mime_type.split("/")[1] ?? "bin"}`
  )
  return { url, mimeType: meta.mime_type }
}
