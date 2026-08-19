"use client"

import { useEffect, useRef, useState } from "react"
import { X, Navigation, MapPin } from "lucide-react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { reverseGeocode } from "../actions"

// Leaflet's default marker icon resolves relative to its own bundled
// assets, which Next.js's bundler doesn't rewrite automatically — without
// this override, markers render as broken images. Pointing at the CDN
// sidesteps the bundler asset-path issue entirely.
const leafletDefaultIcon = L.Icon.Default.prototype as unknown as {
  _getIconUrl?: unknown
}
delete leafletDefaultIcon._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

export interface PickedLocation {
  latitude: number
  longitude: number
  address?: string
}

export function LocationPickerModal({
  onClose,
  onSelect,
}: {
  onClose: () => void
  onSelect: (loc: PickedLocation) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    null
  )
  const [locating, setLocating] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Init the map once. Works even with zero location permission — you can
  // always click anywhere on the map to drop a pin manually.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, { zoomControl: true }).setView(
      [20, 0],
      2
    )
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    const marker = L.marker([20, 0], { draggable: true }).addTo(map)
    marker.on("dragend", () => {
      const { lat, lng } = marker.getLatLng()
      setPosition({ lat, lng })
    })
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng)
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng })
    })

    mapRef.current = map
    markerRef.current = marker

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Best-effort: center on the agent's real location on open. If this
  // fails or is denied, the map still works — the person just has to
  // click to place the pin instead of it being pre-centered on them.
  useEffect(() => {
    if (!navigator.geolocation) {
      const task = window.setTimeout(() => {
        setLocating(false)
        setError(
          "This browser doesn't support geolocation — click anywhere on the map to drop a pin instead."
        )
      }, 0)
      return () => window.clearTimeout(task)
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setPosition({ lat: latitude, lng: longitude })
        mapRef.current?.setView([latitude, longitude], 15)
        markerRef.current?.setLatLng([latitude, longitude])
        setLocating(false)
      },
      () => {
        setLocating(false)
        setError(
          "Couldn't get your location — click anywhere on the map to drop a pin instead."
        )
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  function recenterOnMe() {
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setPosition({ lat: latitude, lng: longitude })
        mapRef.current?.setView([latitude, longitude], 15)
        markerRef.current?.setLatLng([latitude, longitude])
        setLocating(false)
      },
      () => {
        setLocating(false)
        setError("Couldn't get your location.")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function handleConfirm() {
    if (!position) return
    setConfirming(true)
    let address: string | undefined
    try {
      const result = await reverseGeocode(position.lat, position.lng)
      address = result.address ?? undefined
    } catch {
      // Non-fatal — send the pin without an address label rather than
      // blocking the whole flow on a lookup failure.
    }
    onSelect({ latitude: position.lat, longitude: position.lng, address })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl"
        style={{
          background: "var(--paper-raised)",
          border: "1px solid var(--line)",
          height: "80vh",
        }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--line)" }}
        >
          <h2 className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            Share location
          </h2>
          <button onClick={onClose} style={{ color: "var(--ink-soft)" }}>
            <X size={18} />
          </button>
        </div>

        <button
          onClick={recenterOnMe}
          disabled={locating}
          className="flex items-center gap-2.5 border-b px-4 py-3 text-left text-sm disabled:opacity-60"
          style={{ borderColor: "var(--line)", color: "var(--jade)" }}
        >
          <Navigation size={16} />
          {locating ? "Locating…" : "Center on my current location"}
        </button>

        <div ref={containerRef} className="flex-1" style={{ minHeight: 0 }} />

        {error && (
          <p className="px-4 py-2 text-xs" style={{ color: "var(--coral)" }}>
            {error}
          </p>
        )}

        <div
          className="flex items-center justify-between gap-3 border-t px-4 py-3"
          style={{ borderColor: "var(--line)" }}
        >
          <p
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "var(--ink-soft)" }}
          >
            <MapPin size={13} />
            {position
              ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`
              : "Tap the map to drop a pin"}
          </p>
          <button
            onClick={handleConfirm}
            disabled={!position || confirming}
            className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "var(--jade)" }}
          >
            {confirming ? "Confirming…" : "Confirm location"}
          </button>
        </div>
      </div>
    </div>
  )
}
