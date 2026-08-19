"use client"

import { useEffect, useRef, useState } from "react"
import { X, RotateCcw } from "lucide-react"

export function CameraCaptureModal({
  onClose,
  onCapture,
}: {
  onClose: () => void
  onCapture: (file: File) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment"
  )
  const [mode, setMode] = useState<"photo" | "video">("photo")
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function start() {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: mode === "video",
        })
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setError(null)
      } catch {
        setError(
          "Couldn't access the camera — check your browser's camera permission for this site."
        )
      }
    }
    start()
    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [facingMode, mode])

  function takePhoto() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d")?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob)
          onCapture(
            new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" })
          )
      },
      "image/jpeg",
      0.9
    )
  }

  function startRecording() {
    if (!streamRef.current) return
    chunksRef.current = []
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: "video/webm",
    })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () =>
      onCapture(
        new File(
          [new Blob(chunksRef.current, { type: "video/webm" })],
          `video-${Date.now()}.webm`,
          { type: "video/webm" }
        )
      )
    recorder.start()
    recorderRef.current = recorder
    setRecording(true)
  }
  function stopRecording() {
    recorderRef.current?.stop()
    setRecording(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.8)" }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-xl"
        style={{ background: "#000" }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 rounded-full p-1.5"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <X size={18} color="white" />
        </button>

        {error ? (
          <div className="flex aspect-[3/4] items-center justify-center p-6">
            <p className="text-center text-sm text-white">{error}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-[3/4] w-full object-cover"
          />
        )}

        <div className="absolute right-0 bottom-4 left-0 flex flex-col items-center gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMode("photo")}
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{
                background:
                  mode === "photo" ? "white" : "rgba(255,255,255,0.3)",
                color: mode === "photo" ? "black" : "white",
              }}
            >
              Photo
            </button>
            <button
              onClick={() => setMode("video")}
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{
                background:
                  mode === "video" ? "white" : "rgba(255,255,255,0.3)",
                color: mode === "video" ? "black" : "white",
              }}
            >
              Video
            </button>
          </div>
          <div className="flex items-center gap-8">
            <button
              onClick={() =>
                setFacingMode((f) => (f === "user" ? "environment" : "user"))
              }
              className="rounded-full p-2"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              <RotateCcw size={20} color="white" />
            </button>
            {mode === "photo" ? (
              <button
                onClick={takePhoto}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white"
              >
                <div className="h-12 w-12 rounded-full bg-white" />
              </button>
            ) : (
              <button
                onClick={recording ? stopRecording : startRecording}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white"
              >
                <div
                  className={
                    recording
                      ? "h-6 w-6 rounded-sm bg-red-500"
                      : "h-12 w-12 rounded-full bg-red-500"
                  }
                />
              </button>
            )}
            <div className="w-9" />
          </div>
          {recording && (
            <p className="text-xs text-white">Recording… tap to stop</p>
          )}
        </div>
      </div>
    </div>
  )
}
