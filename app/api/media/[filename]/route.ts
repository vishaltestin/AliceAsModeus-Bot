import { NextRequest, NextResponse } from "next/server"
import { readFile, stat } from "fs/promises"
import path from "path"
import { getUploadDir } from "@/lib/local-storage"

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".3gp": "video/3gpp",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".aac": "audio/aac",
  ".m4a": "audio/mp4",
  ".amr": "audio/amr",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params

  // Reject anything that isn't a bare filename — blocks path traversal
  // (`../../etc/passwd`) and absolute paths. This is the only thing
  // standing between this public route and arbitrary file reads.
  if (
    !filename ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..")
  ) {
    return new NextResponse("Not found", { status: 404 })
  }

  const filePath = path.join(getUploadDir(), filename)

  try {
    const stats = await stat(filePath)
    if (!stats.isFile()) return new NextResponse("Not found", { status: 404 })

    const buffer = await readFile(filePath)
    const ext = path.extname(filename).toLowerCase()

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(stats.size),
      },
    })
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
}
