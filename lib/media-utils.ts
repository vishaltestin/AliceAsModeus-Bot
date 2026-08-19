export type MediaContentType =
  "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "STICKER"

export function contentTypeFromMime(mime: string): MediaContentType {
  if (mime.startsWith("image/")) return "IMAGE"
  if (mime.startsWith("video/")) return "VIDEO"
  if (mime.startsWith("audio/")) return "AUDIO"
  return "DOCUMENT"
}

export const MAX_BYTES_BY_TYPE: Record<MediaContentType, number> = {
  IMAGE: 5 * 1024 * 1024,
  VIDEO: 16 * 1024 * 1024,
  AUDIO: 16 * 1024 * 1024,
  DOCUMENT: 100 * 1024 * 1024,
  STICKER: 500 * 1024,
}

export const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
  "audio/mp4": "m4a",
  "audio/amr": "amr",
  "application/pdf": "pdf",
}
