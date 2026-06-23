import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { ACCENT } from "@/components/sparki/ui"
import type { RouteWaypoint, RouteMeetpoint } from "@/hooks/use-routes"

// Lightweight Leaflet map for drawing real route geometry. Uses CARTO's free
// dark "dark_matter" raster tiles (no API key) so it sits naturally inside the
// dark cinematic Sparki design. The polyline is the actual ORS/GPX path — we
// never draw an invented line.
//
// In *builder* mode (when onMapClick is provided) the athlete shapes a route by
// clicking points on the map: each click adds a numbered, draggable waypoint;
// clicking a waypoint removes it. Named meeting points ("verzamelpunten") are
// shown as distinct pins. The connecting polyline is still only ever the real
// road geometry returned by the routing provider after a recompute — between
// clicks (before recompute) no fake line is drawn.
export function RouteMap({
  geometry,
  className = "",
  height = 260,
  interactive = true,
  waypoints = [],
  meetpoints = [],
  center,
  onMapClick,
  onWaypointDrag,
  onWaypointClick,
  onMeetpointClick,
}: {
  geometry: [number, number][]
  className?: string
  height?: number
  interactive?: boolean
  waypoints?: RouteWaypoint[]
  meetpoints?: RouteMeetpoint[]
  // Fallback view when there's nothing to fit yet (empty builder canvas).
  center?: [number, number]
  onMapClick?: (lat: number, lon: number) => void
  onWaypointDrag?: (index: number, lat: number, lon: number) => void
  onWaypointClick?: (index: number) => void
  onMeetpointClick?: (index: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const lineRef = useRef<L.Polyline | null>(null)
  const markersRef = useRef<L.Layer[]>([])

  // Keep the latest callbacks in refs so the click handler bound once on the map
  // always calls the current closures without rebinding.
  const clickRef = useRef(onMapClick)
  clickRef.current = onMapClick
  const dragRef = useRef(onWaypointDrag)
  dragRef.current = onWaypointDrag
  const wpClickRef = useRef(onWaypointClick)
  wpClickRef.current = onWaypointClick
  const mpClickRef = useRef(onMeetpointClick)
  mpClickRef.current = onMeetpointClick

  const isBuilder = Boolean(onMapClick)

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
    map.on("click", (e: L.LeafletMouseEvent) => {
      clickRef.current?.(e.latlng.lat, e.latlng.lng)
    })
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

    const latlngs = geometry.map(([lat, lon]) => [lat, lon] as [number, number])

    if (latlngs.length >= 2) {
      const line = L.polyline(latlngs, {
        color: ACCENT,
        weight: 4,
        opacity: 0.9,
      }).addTo(map)
      lineRef.current = line
    }

    const dot = (color: string) =>
      L.divIcon({
        className: "",
        html: `<span style="display:block;width:12px;height:12px;border-radius:9999px;background:${color};box-shadow:0 0 0 3px rgba(5,7,14,0.9),0 0 10px ${color};"></span>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      })

    // Numbered, draggable waypoint marker for builder mode.
    const wpIcon = (n: number) =>
      L.divIcon({
        className: "",
        html: `<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:${ACCENT};color:#040506;font:600 11px/1 ui-sans-serif,system-ui;box-shadow:0 0 0 3px rgba(5,7,14,0.9),0 0 10px ${ACCENT};">${n}</span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })

    // Distinct pin for a named meeting point ("verzamelpunt"). The label is
    // user-authored, so HTML-escape it before injecting into the marker HTML.
    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
    const mpIcon = (label: string) =>
      L.divIcon({
        className: "",
        html: `<span style="display:flex;align-items:center;gap:5px;padding:3px 8px 3px 6px;border-radius:9999px;background:rgba(255,160,90,0.95);color:#1a0f05;font:600 11px/1 ui-sans-serif,system-ui;white-space:nowrap;box-shadow:0 0 0 2px rgba(5,7,14,0.85),0 0 10px rgba(255,160,90,0.6);"><span style="width:7px;height:7px;border-radius:9999px;background:#1a0f05;"></span>${escapeHtml(label)}</span>`,
        iconSize: [0, 0],
        iconAnchor: [10, 10],
      })

    if (isBuilder) {
      // Builder: render the user's shaping waypoints (draggable / removable).
      waypoints.forEach(([lat, lon], i) => {
        const marker = L.marker([lat, lon], {
          icon: wpIcon(i + 1),
          draggable: true,
        }).addTo(map)
        marker.on("dragend", () => {
          const ll = marker.getLatLng()
          dragRef.current?.(i, ll.lat, ll.lng)
        })
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e)
          wpClickRef.current?.(i)
        })
        markersRef.current.push(marker)
      })
    } else if (latlngs.length >= 2) {
      // Read-only: start + end dots.
      const start = latlngs[0]!
      const end = latlngs[latlngs.length - 1]!
      markersRef.current.push(
        L.marker(start, { icon: dot(ACCENT) }).addTo(map),
        L.marker(end, { icon: dot("rgba(255,160,90,0.95)") }).addTo(map),
      )
    }

    // Meeting points are shown in both modes.
    meetpoints.forEach((mp, i) => {
      const marker = L.marker([mp.lat, mp.lon], {
        icon: mpIcon(mp.name),
      }).addTo(map)
      if (mpClickRef.current) {
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e)
          mpClickRef.current?.(i)
        })
      }
      markersRef.current.push(marker)
    })

    // Fit to whatever we have (line, waypoints, or meetpoints).
    const fitPoints: [number, number][] = [
      ...latlngs,
      ...waypoints.map(([lat, lon]) => [lat, lon] as [number, number]),
      ...meetpoints.map((m) => [m.lat, m.lon] as [number, number]),
    ]
    if (fitPoints.length >= 2) {
      map.fitBounds(L.latLngBounds(fitPoints), { padding: [28, 28] })
    } else if (fitPoints.length === 1) {
      map.setView(fitPoints[0]!, 13)
    } else if (center) {
      map.setView(center, 8)
    }
    // Tiles can mis-size if the container was hidden when initialised.
    setTimeout(() => map.invalidateSize(), 80)
  }, [geometry, waypoints, meetpoints, isBuilder, center])

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden rounded-xl border border-white/[0.08] ${className}`}
      style={{ height, background: "#05070e" }}
    />
  )
}
