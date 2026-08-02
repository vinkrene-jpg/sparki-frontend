import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { ACCENT } from "@/components/sparki/ui"

// Clickable Leaflet map for choosing a home location by dropping a pin. Uses
// CARTO's free dark "dark_matter" tiles (no API key) to match the cinematic
// Sparki design. Clicking the map (or programmatically setting `value`) moves
// the marker and reports the picked coordinate back to the parent.
export function LocationPickerMap({
  value,
  onPick,
  className = "",
}: {
  value: { lat: number; lon: number } | null
  onPick: (point: { lat: number; lon: number }) => void
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const start: [number, number] = value
      ? [value.lat, value.lon]
      : [52.3676, 4.9041] // Amsterdam — neutral default until the user picks.
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
      center: start,
      zoom: value ? 13 : 7,
    })
    // CARTO "voyager" tiles: soft colours with clearly readable street names.
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      },
    ).addTo(map)
    map.on("click", (e: L.LeafletMouseEvent) => {
      onPickRef.current({ lat: e.latlng.lat, lon: e.latlng.lng })
    })
    mapRef.current = map
    // Tiles can mis-size if the container was hidden when initialised.
    setTimeout(() => map.invalidateSize(), 80)
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!value) {
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      return
    }
    const pos: [number, number] = [value.lat, value.lon]
    const icon = L.divIcon({
      className: "",
      html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${ACCENT};box-shadow:0 0 0 3px rgba(5,7,14,0.9),0 0 12px ${ACCENT};"></span>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    })
    if (markerRef.current) {
      markerRef.current.setLatLng(pos)
    } else {
      markerRef.current = L.marker(pos, { icon }).addTo(map)
    }
    map.setView(pos, Math.max(map.getZoom(), 13))
  }, [value])

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden rounded-xl border border-border ${className}`}
      style={{ height: 220, background: "#05070e" }}
    />
  )
}
