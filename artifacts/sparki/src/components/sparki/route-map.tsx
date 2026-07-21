import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { ACCENT } from "@/components/sparki/ui"
import type {
  RouteWaypoint,
  RouteMeetpoint,
  RouteClimb,
} from "@/hooks/use-routes"

// Cumulative distance (km) at each track point, mirroring the server-side
// gpx-parse cumulativeKm so summit anchoring matches the stored climb data.
function cumulativeKm(geometry: [number, number][]): number[] {
  const cumKm: number[] = [0]
  const R = 6371 // earth radius (km)
  for (let i = 1; i < geometry.length; i++) {
    const a = geometry[i - 1]!
    const b = geometry[i]!
    const dLat = ((b[0] - a[0]) * Math.PI) / 180
    const dLon = ((b[1] - a[1]) * Math.PI) / 180
    const lat1 = (a[0] * Math.PI) / 180
    const lat2 = (b[0] * Math.PI) / 180
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
    cumKm.push(cumKm[i - 1]! + 2 * R * Math.asin(Math.min(1, Math.sqrt(h))))
  }
  return cumKm
}

// Index of the track point whose cumulative km is closest to `km` (mirrors
// gpx-parse nearestIdxForKm).
function nearestIdxForKm(cumKm: number[], km: number): number {
  let best = 0
  let bestDiff = Infinity
  for (let i = 0; i < cumKm.length; i++) {
    const diff = Math.abs(cumKm[i]! - km)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  }
  return best
}

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
  climbs = [],
  center,
  myLocation,
  focusMyLocation = 0,
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
  // Detected climbs (read-only routes). Each climb with a finite summitKm is
  // plotted as a summit marker anchored to the real track coordinate nearest
  // that km. Routes without climbs (or without summitKm) show no markers.
  climbs?: RouteClimb[]
  // Fallback view when there's nothing to fit yet (empty builder canvas).
  center?: [number, number]
  // The rider's REAL current/start position (from geolocation or their saved
  // startpoint) — shown as a distinct "jij bent hier" dot so the rider can
  // always find themselves on the map. Never passed for a guessed location.
  myLocation?: [number, number]
  // Bump this counter to force the view onto myLocation (street-level zoom),
  // e.g. when the rider taps "Centreer op mij" — even if the coords are the
  // same as before and even when a route/waypoints are on the map.
  focusMyLocation?: number
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
    // Only the licence-required © OpenStreetMap/CARTO credit — no Leaflet
    // software plug, and styled ultra-subtle via CSS (index.css).
    map.attributionControl.setPrefix(false)
    // CARTO "voyager" tiles: soft colours with clearly readable street names.
    // The earlier dark tiles were too hard to read, even brightness-boosted.
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
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

    // Summit markers — a small cyan peak at each climb's top, anchored to the
    // real track coordinate nearest its stored summitKm. Only finite-summitKm
    // climbs are plotted; nothing is invented when a route has no climbs.
    const summitIcon = () =>
      L.divIcon({
        className: "",
        html: `<span style="display:block;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid ${ACCENT};filter:drop-shadow(0 0 1px rgba(5,7,14,0.95)) drop-shadow(0 0 6px ${ACCENT});"></span>`,
        iconSize: [14, 12],
        iconAnchor: [7, 12],
      })
    if (climbs.length > 0 && latlngs.length >= 2) {
      const cumKm = cumulativeKm(latlngs)
      climbs.forEach((c) => {
        if (!Number.isFinite(c.summitKm)) return
        const idx = nearestIdxForKm(cumKm, c.summitKm as number)
        const at = latlngs[idx]
        if (!at) return
        const marker = L.marker(at, {
          icon: summitIcon(),
          interactive: true,
          keyboard: false,
        }).addTo(map)
        // Plain-Dutch label on hover (desktop) and tap (mobile).
        marker.bindTooltip(`Top: ${escapeHtml(c.name)}`, {
          direction: "top",
          offset: [0, -12],
          opacity: 1,
        })
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e)
          marker.openTooltip()
        })
        markersRef.current.push(marker)
      })
    }

    // "Jij bent hier" — the rider's real position, distinct from waypoints so
    // they can always find themselves back after zooming/panning.
    if (myLocation) {
      const meIcon = L.divIcon({
        className: "",
        html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#fff;border:4px solid ${ACCENT};box-shadow:0 0 0 3px rgba(5,7,14,0.9),0 0 14px ${ACCENT};"></span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
      const marker = L.marker(myLocation, {
        icon: meIcon,
        interactive: true,
        keyboard: false,
        zIndexOffset: 500,
      }).addTo(map)
      marker.bindTooltip("Jij bent hier", {
        direction: "top",
        offset: [0, -10],
        opacity: 1,
      })
      markersRef.current.push(marker)
    }

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
    } else if (myLocation) {
      // Centred on the rider: street-level, so you instantly recognise where
      // you are.
      map.setView(myLocation, 16)
    } else if (center) {
      map.setView(center, 8)
    }
    // Tiles can mis-size if the container was hidden when initialised.
    setTimeout(() => map.invalidateSize(), 80)
  }, [geometry, waypoints, meetpoints, climbs, isBuilder, center, myLocation])

  // "Centreer op mij": explicitly jump to the rider's position at street-level
  // zoom, regardless of what else is on the map. Triggered via the counter so
  // repeated taps keep working even when the coordinates don't change.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !myLocation || focusMyLocation === 0) return
    map.setView(myLocation, 16, { animate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMyLocation])

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden rounded-xl border border-white/[0.08] ${className}`}
      style={{ height, background: "#05070e" }}
    />
  )
}
