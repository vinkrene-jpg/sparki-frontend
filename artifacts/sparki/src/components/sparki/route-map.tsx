import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { ACCENT } from "@/components/sparki/ui"
import type { RoutePoint } from "@/hooks/use-routes"

// Lightweight Leaflet map that draws a route polyline. Geometry comes in as
// [lon, lat, ele?] tuples (the order ORS/GeoJSON use); Leaflet wants [lat, lon].
// Dark CartoDB tiles keep it consistent with the cinematic Sparki design.
export function RouteMap({
  geometry,
  className = "",
}: {
  geometry: RoutePoint[]
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
    })
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      },
    ).addTo(map)
    L.control.zoom({ position: "bottomright" }).addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const latlngs: [number, number][] = geometry
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
      .map((p) => [p[1], p[0]])

    if (layerRef.current) {
      layerRef.current.remove()
      layerRef.current = null
    }

    if (latlngs.length < 2) {
      map.setView([52.1, 5.1], 7) // Netherlands fallback view
      return
    }

    const line = L.polyline(latlngs, {
      color: ACCENT,
      weight: 4,
      opacity: 0.9,
    })

    // Start (green) and end (accent) markers.
    const start = latlngs[0]!
    const end = latlngs[latlngs.length - 1]!
    const startMarker = L.circleMarker(start, {
      radius: 6,
      color: "#7be3a6",
      fillColor: "#7be3a6",
      fillOpacity: 1,
      weight: 2,
    })
    const endMarker = L.circleMarker(end, {
      radius: 6,
      color: ACCENT,
      fillColor: ACCENT,
      fillOpacity: 1,
      weight: 2,
    })

    const group = L.layerGroup([line, startMarker, endMarker]).addTo(map)
    layerRef.current = group

    map.fitBounds(line.getBounds(), { padding: [24, 24] })

    // Tiles can mis-size if the container was hidden/animating on first paint.
    setTimeout(() => map.invalidateSize(), 60)
  }, [geometry])

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden rounded-xl border border-white/[0.08] ${className}`}
      style={{ background: "#05070e", minHeight: 220 }}
    />
  )
}
