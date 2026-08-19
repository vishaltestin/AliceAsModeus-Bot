"use client"

// Meta's sticker requirements are square WebP images. This letterboxes
// whatever the user picked into a 512×512 canvas rather than stretching
// it, then exports as WebP.
export async function convertImageToStickerWebp(file: File): Promise<File> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = URL.createObjectURL(file)
  })

  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext("2d")!
  const scale = Math.min(512 / img.width, 512 / img.height)
  const w = img.width * scale,
    h = img.height * scale
  ctx.drawImage(img, (512 - w) / 2, (512 - h) / 2, w, h)

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error("Your browser can't export WebP images")),
      "image/webp",
      0.9
    )
  )
  return new File([blob], `sticker-${Date.now()}.webp`, { type: "image/webp" })
}
