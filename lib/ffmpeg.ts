import { spawn } from "child_process"
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises"
import path from "path"
import os from "os"

// On the VPS: apt-installed ffmpeg sits on PATH, so bare "ffmpeg" just
// works — no env var needed there. FFMPEG_PATH only exists as an escape
// hatch for local dev machines where ffmpeg isn't on PATH (e.g. Windows).
function resolveFfmpegPath(): string {
  return process.env.FFMPEG_PATH || "ffmpeg"
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = resolveFfmpegPath()
    const proc = spawn(bin, args)
    let stderr = ""
    proc.stderr.on("data", (d) => (stderr += d.toString()))
    proc.on("error", (err) => {
      reject(
        new Error(
          `Could not run ffmpeg at "${bin}": ${err.message}\n` +
            `On the server: run "sudo apt install ffmpeg" and confirm it's on PATH ("which ffmpeg"). ` +
            `Locally: install ffmpeg and set FFMPEG_PATH in .env to its full path.`
        )
      )
    })
    proc.on("close", (code) => {
      if (code === 0) resolve()
      else
        reject(
          new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`)
        )
    })
  })
}

export async function transcodeVideoToMp4(input: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "wacrm-"))
  const inPath = path.join(dir, "in.webm")
  const outPath = path.join(dir, "out.mp4")
  await writeFile(inPath, input)
  await runFfmpeg([
    "-y",
    "-i",
    inPath,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outPath,
  ])
  const result = await readFile(outPath)
  await unlink(inPath).catch(() => {})
  await unlink(outPath).catch(() => {})
  return result
}

export async function remuxAudioToOgg(input: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "wacrm-"))
  const inPath = path.join(dir, "in.webm")
  const outPath = path.join(dir, "out.ogg")
  await writeFile(inPath, input)
  await runFfmpeg([
    "-y",
    "-i",
    inPath,
    "-c:a",
    "libopus",
    "-b:a",
    "64k",
    outPath,
  ])
  const result = await readFile(outPath)
  await unlink(inPath).catch(() => {})
  await unlink(outPath).catch(() => {})
  return result
}
