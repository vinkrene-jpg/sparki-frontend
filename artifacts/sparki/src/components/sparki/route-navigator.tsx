import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import {
  X,
  LocateFixed,
  TriangleAlert,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  CornerUpLeft,
  Flag,
  Navigation,
  type LucideIcon,
} from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import type { RouteNavCue } from "@/hooks/use-routes"

const OFF_ROUTE_METERS = 60

type LatLon = { lat: number; lon: number }

// Great-circle distance in metres between two coordinates.
function haversineM(a: LatLon, b: LatLon): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Cumulative distance (km) at each track point.
function cumulativeKm(path: LatLon[]): number[] {
  const cum: number[] = [0]
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1]! + haversineM(path[i - 1]!, path[i]!) / 1000)
  }
  return cum
}

// Index of the path point nearest to `loc`, plus its distance in metres.
function nearestPointIndex(
  path: LatLon[],
  loc: LatLon,
): { index: number; distanceMeters: number } {
  let index = 0
  let best = Infinity
  for (let i = 0; i < path.length; i++) {
    const d = haversineM(path[i]!, loc)
    if (d < best) {
      best = d
      index = i
    }
  }
  return { index, distanceMeters: best }
}

// Map a routing "dir" token to a Dutch label + arrow icon. Tolerant: unknown
// values fall back to a generic arrow (never fabricated).
function describeDir(dir: string): { icon: LucideIcon; label: string } {
  const d = (dir || "").toLowerCase()
  if (d.includes("uturn") || d.includes("keer"))
    return { icon: CornerUpLeft, label: "Keren" }
  if (d.includes("sharp-left")) return { icon: ArrowLeft, label: "Scherp links" }
  if (d.includes("sharp-right"))
    return { icon: ArrowRight, label: "Scherp rechts" }
  if (d.includes("slight-left")) return { icon: ArrowUp, label: "Flauw links" }
  if (d.includes("slight-right")) return { icon: ArrowUp, label: "Flauw rechts" }
  if (d.includes("left")) return { icon: ArrowLeft, label: "Links" }
  if (d.includes("right")) return { icon: ArrowRight, label: "Rechts" }
  if (d.includes("straight") || d.includes("continue") || d.includes("rechtdoor"))
    return { icon: ArrowUp, label: "Rechtdoor" }
  if (d.includes("arrive") || d.includes("finish") || d.includes("aankomst"))
    return { icon: Flag, label: "Aankomst" }
  if (d.includes("depart") || d.includes("start"))
    return { icon: ArrowUp, label: "Start" }
  return { icon: ArrowUp, label: dir || "Volg de route" }
}

function fmtMeters(m: number): string {
  if (m < 1000) return `${Math.max(0, Math.round(m / 10) * 10)} m`
  return `${(m / 1000).toFixed(1)} km`
}

// Full-screen live-navigation window for the web. Uses the browser Geolocation
// API to follow the rider's real position along the stored route geometry and
// derives the next turn from the saved nav cues. Honest at every step: it never
// fabricates a position, states plainly when location access is missing, and
// makes clear that recording a training rit lives in the Sparki phone app.
export function RouteNavigator({
  name,
  geometry,
  nav,
  distanceKm,
  onClose,
}: {
  name: string
  geometry: [number, number][]
  nav: RouteNavCue[]
  distanceKm: number | null
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const meMarkerRef = useRef<L.Marker | null>(null)
  const followRef = useRef(true)

  const [location, setLocation] = useState<
    (LatLon & { speedMps: number | null }) | null
  >(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [following, setFollowing] = useState(true)
  const [showSteps, setShowSteps] = useState(false)

  followRef.current = following

  const path: LatLon[] = useMemo(
    () => geometry.map(([lat, lon]) => ({ lat, lon })),
    [geometry],
  )
  const cumKm = useMemo(() => cumulativeKm(path), [path])

  const progress = useMemo(() => {
    if (!location || path.length === 0) return null
    const { index, distanceMeters } = nearestPointIndex(path, location)
    const traveledKm = cumKm[index] ?? 0
    const totalKm = cumKm[cumKm.length - 1] ?? 0
    return {
      traveledKm,
      remainingKm: Math.max(0, totalKm - traveledKm),
      offRoute: distanceMeters > OFF_ROUTE_METERS,
      offBy: distanceMeters,
    }
  }, [location, path, cumKm])

  const nextStep: RouteNavCue | null = useMemo(() => {
    if (nav.length === 0 || !progress) return null
    const ahead = nav.find((s) => s.km > progress.traveledKm + 0.015)
    return ahead ?? nav[nav.length - 1] ?? null
  }, [nav, progress])

  const distanceToTurn =
    nextStep && progress
      ? Math.max(0, (nextStep.km - progress.traveledKm) * 1000)
      : null

  // Body scroll lock + Escape to close.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  // Watch the real position. Honest failure surfaces instead of a fake dot.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Locatie wordt niet ondersteund in deze browser.")
      return
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null)
        setPermissionDenied(false)
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          speedMps:
            typeof pos.coords.speed === "number" && !Number.isNaN(pos.coords.speed)
              ? pos.coords.speed
              : null,
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionDenied(true)
          setGeoError("Geen toegang tot je locatie.")
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoError("Je locatie is nu niet beschikbaar.")
        } else {
          setGeoError("Wachten op je locatie duurt te lang.")
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // Init map + route line once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    })
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      },
    ).addTo(map)

    const latlngs = path.map((p) => [p.lat, p.lon] as [number, number])
    if (latlngs.length >= 2) {
      L.polyline(latlngs, { color: ACCENT, weight: 4, opacity: 0.9 }).addTo(map)
      const dot = (color: string) =>
        L.divIcon({
          className: "",
          html: `<span style="display:block;width:12px;height:12px;border-radius:9999px;background:${color};box-shadow:0 0 0 3px rgba(5,7,14,0.9),0 0 10px ${color};"></span>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        })
      L.marker(latlngs[0]!, { icon: dot(ACCENT) }).addTo(map)
      L.marker(latlngs[latlngs.length - 1]!, {
        icon: dot("rgba(255,160,90,0.95)"),
      }).addTo(map)
      map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] })
    } else if (latlngs.length === 1) {
      map.setView(latlngs[0]!, 14)
    } else {
      map.setView([52.1, 5.3], 7)
    }

    // Panning by hand disables auto-follow until the rider re-centres.
    map.on("dragstart", () => {
      if (followRef.current) setFollowing(false)
    })

    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 80)
    return () => {
      map.remove()
      mapRef.current = null
      meMarkerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Move the "me" marker on each position update; follow if enabled.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !location) return
    const ll: [number, number] = [location.lat, location.lon]
    if (!meMarkerRef.current) {
      meMarkerRef.current = L.marker(ll, {
        icon: L.divIcon({
          className: "",
          html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#38bdf8;border:2px solid #05070e;box-shadow:0 0 0 3px rgba(56,189,248,0.35),0 0 12px #38bdf8;"></span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
        zIndexOffset: 1000,
      }).addTo(map)
    } else {
      meMarkerRef.current.setLatLng(ll)
    }
    if (following) map.setView(ll, Math.max(map.getZoom(), 15), { animate: true })
  }, [location, following])

  const speedKmh =
    location?.speedMps != null ? Math.round(location.speedMps * 3.6) : null

  const overlay = (
    <div className="fixed inset-0 z-[90] bg-[#05070e]">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Top bar: close + next instruction */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#070d16]/90 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 backdrop-blur-md transition hover:text-white"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
            Sluiten
          </button>
          <div className="min-w-0 flex-1 truncate rounded-full border border-white/10 bg-[#070d16]/90 px-3 py-2 text-[13px] text-white/70 backdrop-blur-md">
            {name}
          </div>
        </div>

        {nav.length > 0 ? (
          progress?.offRoute ? (
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[rgba(255,120,100,0.5)] bg-[#070d16]/92 px-3.5 py-3 backdrop-blur-md">
              <TriangleAlert
                className="h-6 w-6 shrink-0 text-[rgba(255,140,120,0.9)]"
                strokeWidth={1.75}
              />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[rgba(255,140,120,0.95)]">
                  Van de route
                </p>
                <p className="truncate text-[12px] text-white/55">
                  Je bent {fmtMeters(progress.offBy)} van de route. Keer terug
                  naar de lijn.
                </p>
              </div>
            </div>
          ) : nextStep ? (
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/10 bg-[#070d16]/92 px-3.5 py-3 backdrop-blur-md">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(56,189,248,0.15)" }}
              >
                {(() => {
                  const Icon = describeDir(nextStep.dir).icon
                  return (
                    <Icon
                      className="h-6 w-6 text-cyan-300"
                      strokeWidth={2}
                    />
                  )
                })()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[15px] font-medium text-white/90">
                    {describeDir(nextStep.dir).label}
                  </p>
                  {distanceToTurn != null && (
                    <span className="font-mono text-[13px] tabular-nums text-cyan-300">
                      {fmtMeters(distanceToTurn)}
                    </span>
                  )}
                </div>
                {!!nextStep.note && (
                  <p className="truncate text-[12px] text-white/50">
                    {nextStep.note}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#070d16]/92 px-3.5 py-3 backdrop-blur-md">
              <Navigation className="h-5 w-5 text-cyan-300" strokeWidth={1.75} />
              <p className="text-[13px] text-white/60">
                {location ? "Volg de route." : "Wachten op je locatie…"}
              </p>
            </div>
          )
        ) : (
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#070d16]/92 px-3.5 py-3 backdrop-blur-md">
            <Navigation className="h-5 w-5 text-white/40" strokeWidth={1.75} />
            <p className="text-[13px] text-white/55">
              Deze route heeft geen afslag-aanwijzingen. De lijn wordt wel
              getoond.
            </p>
          </div>
        )}

        {geoError && (
          <div className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-white/10 bg-[#070d16]/92 px-3.5 py-3 backdrop-blur-md">
            <TriangleAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-[rgba(255,180,120,0.9)]"
              strokeWidth={1.75}
            />
            <p className="text-[12px] leading-relaxed text-white/60">
              {geoError}
              {permissionDenied
                ? " Sta locatie toe in je browser om live te navigeren."
                : ""}
            </p>
          </div>
        )}
      </div>

      {/* Bottom: recenter + progress + steps toggle */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-stretch gap-2 p-3">
        {!following && location && (
          <button
            type="button"
            onClick={() => setFollowing(true)}
            className="pointer-events-auto mx-auto flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-[13px] font-semibold text-[#05070e] shadow-lg"
          >
            <LocateFixed className="h-4 w-4" strokeWidth={2} />
            Centreer
          </button>
        )}

        <div className="pointer-events-auto flex items-center justify-around rounded-2xl border border-white/10 bg-[#070d16]/92 px-4 py-3 backdrop-blur-md">
          <Metric
            label="Resterend"
            value={progress ? `${progress.remainingKm.toFixed(1)} km` : "—"}
          />
          <Divider />
          <Metric
            label="Totaal"
            value={distanceKm != null ? `${distanceKm.toFixed(1)} km` : "—"}
          />
          <Divider />
          <Metric
            label="Snelheid"
            value={speedKmh != null ? `${speedKmh} km/u` : "—"}
          />
        </div>

        {nav.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSteps((v) => !v)}
            className="pointer-events-auto rounded-full border border-white/10 bg-[#070d16]/90 px-3 py-2 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-white/55 backdrop-blur-md transition hover:text-white/80"
          >
            {showSteps ? "Verberg stappenplan" : "Toon stappenplan"}
          </button>
        )}

        {showSteps && nav.length > 0 && (
          <div className="pointer-events-auto max-h-[38vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#070d16]/95 p-2 backdrop-blur-md">
            {nav.map((s, i) => {
              const d = describeDir(s.dir)
              const Icon = d.icon
              return (
                <div
                  key={i}
                  className="flex items-baseline gap-3 border-b border-white/[0.05] px-2 py-2.5 last:border-0"
                >
                  <span className="w-14 font-mono text-[11px] tabular-nums text-cyan-300/70">
                    {s.km.toFixed(1)} km
                  </span>
                  <Icon
                    className="h-4 w-4 shrink-0 translate-y-0.5 text-white/60"
                    strokeWidth={1.75}
                  />
                  <span className="w-24 text-[13px] text-white/85">
                    {d.label}
                  </span>
                  <span className="flex-1 text-[12px] text-white/40">
                    {s.note}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <p className="pointer-events-none px-2 text-center text-[10px] leading-relaxed text-white/25">
          Live navigatie in de browser volgt je positie. Een rit opnemen in je
          trainingen doe je in de Sparki-app op je telefoon.
        </p>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-[15px] tabular-nums text-white/90">
        {value}
      </span>
      <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
        {label}
      </span>
    </div>
  )
}

function Divider() {
  return <span className="h-8 w-px bg-white/10" />
}
