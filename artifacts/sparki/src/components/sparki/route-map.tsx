import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { ACCENT } from "@/components/sparki/ui"

// Lightweight Leaflet map for drawing real route geometry. Uses CARTO's free
// dark "dark_matter" raster tiles (no API key) so it sits naturally inside the
// dark cinematic Sparki design. The polyline is the actual ORS/GPX path — we
// never draw an invented line.
export function RouteMap({
  geometry,
  className = "",
  height = 260,
  interactive = true,
}: {
  geometry: [number, number][]
  className?: string
  height?: number
  interactive?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const lineRef = useRef<L.Polyline | null>(null)
  const markersRef = useRef<L.Layer[]>([])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      zoomControl: interactive,
      attributionControl: true,
      scrollWheelZoom: false,
      dragging: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      touchZoom: interactive,
    })
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      },
    ).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (lineRef.current) {
      lineRef.current.remove()
      lineRef.current = null
    }
    for (const m of markersRef.current) m.remove()
    markersRef.current = []

    if (geometry.length < 2) return

    const latlngs = geometry.map(([lat, lon]) => [lat, lon] as [number, number])
    const line = L.polyline(latlngs, {
      color: ACCENT,
      weight: 4,
      opacity: 0.9,
    }).addTo(map)
    lineRef.current = line

    const dot = (color: string) =>
      L.divIcon({
        className: "",
        html: `<span style="display:block;width:12px;height:12px;border-radius:9999px;background:${color};box-shadow:0 0 0 3px rgba(5,7,14,0.9),0 0 10px ${color};"></span>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      })
    const start = latlngs[0]!
    const end = latlngs[latlngs.length - 1]!
    markersRef.current.push(
      L.marker(start, { icon: dot(ACCENT) }).addTo(map),
      L.marker(end, { icon: dot("rgba(255,160,90,0.95)") }).addTo(map),
    )

    map.fitBounds(line.getBounds(), { padding: [24, 24] })
    // Tiles can mis-size if the container was hidden when initialised.
    setTimeout(() => map.invalidateSize(), 80)
  }, [geometry])

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden rounded-xl border border-white/[0.08] ${className}`}
      style={{ height, background: "#05070e" }}
    />
  )
}
