import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import {
  X,
  ChevronLeft,
  ChevronRight,
  Mountain,
  Clock,
  Ruler,
  Navigation,
} from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { MiniElevationProfile } from "@/components/sparki/elevation-profile"
import type { SparkiRoute } from "@/hooks/use-routes"

// Kaart-verkenner: één groot kaartbeeld met ALLE bewaarde routes eroverheen
// (zoals je dat kent van route-apps), filterknoppen bovenaan en onderaan een
// kaartje met de echte gegevens van de gekozen route. Alles wat je ziet is
// echt: de lijnen zijn de opgeslagen routegeometrie, de cijfers komen uit de
// route zelf. Geen foto's of beoordelingen — die hebben we niet, dus die
// verzinnen we ook niet; het hoogteprofiel is het beeldmerk van de route.

const MUTED_LINE = "rgba(140,150,255,0.55)"

type SurfaceFilter = "alle" | string
type LengthFilter = "alle" | "kort" | "middel" | "lang"

const SURFACE_LABELS: Record<string, string> = {
  racefiets: "Racefiets",
  gravel: "Gravel",
  mtb: "MTB",
  cycling: "Fiets",
  road: "Racefiets",
}

function surfaceLabel(s: string): string {
  return SURFACE_LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1)
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  if (h === 0) return `${m} min`
  return `${h}u ${String(m).padStart(2, "0")}m`
}

function lengthBucket(km: number | null): LengthFilter | null {
  if (km == null) return null
  if (km < 30) return "kort"
  if (km <= 60) return "middel"
  return "lang"
}

const LENGTH_CHIPS: { key: LengthFilter; label: string }[] = [
  { key: "alle", label: "Alle afstanden" },
  { key: "kort", label: "Tot 30 km" },
  { key: "middel", label: "30–60 km" },
  { key: "lang", label: "60+ km" },
]

function sourceLabel(source: string): string {
  switch (source) {
    case "generated":
      return "Gegenereerd"
    case "imported":
      return "GPX-import"
    case "manual":
      return "Zelf gebouwd"
    case "ridden":
      return "Gereden rit"
    default:
      return source
  }
}

export function RouteExplorer({
  routes,
  onClose,
  onOpenRoute,
  onNavigate,
}: {
  routes: SparkiRoute[]
  onClose: () => void
  // Springt naar de routekaart in de lijst (sluit de verkenner).
  onOpenRoute: (id: number) => void
  // Opent direct het navigatievenster van deze route (sluit de verkenner).
  onNavigate: (id: number) => void
}) {
  // Alleen routes met een echte kaartlijn zijn verkenbaar op de kaart.
  const mappable = useMemo(
    () => routes.filter((r) => (r.geometry?.length ?? 0) >= 2),
    [routes],
  )

  const [surfaceFilter, setSurfaceFilter] = useState<SurfaceFilter>("alle")
  const [lengthFilter, setLengthFilter] = useState<LengthFilter>("alle")

  const surfaces = useMemo(() => {
    const set = new Set<string>()
    for (const r of mappable) if (r.surface) set.add(r.surface)
    return [...set]
  }, [mappable])

  const filtered = useMemo(
    () =>
      mappable.filter((r) => {
        if (surfaceFilter !== "alle" && r.surface !== surfaceFilter) return false
        if (lengthFilter !== "alle" && lengthBucket(r.distanceKm) !== lengthFilter)
          return false
        return true
      }),
    [mappable, surfaceFilter, lengthFilter],
  )

  const [selectedId, setSelectedId] = useState<number | null>(
    filtered[0]?.id ?? null,
  )
  // Houd de selectie geldig als een filter de gekozen route wegfiltert.
  useEffect(() => {
    if (!filtered.some((r) => r.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null)
    }
  }, [filtered, selectedId])

  const selected = filtered.find((r) => r.id === selectedId) ?? null
  const selectedIndex = selected
    ? filtered.findIndex((r) => r.id === selected.id)
    : -1

  function step(delta: number) {
    if (filtered.length === 0) return
    const next =
      (selectedIndex + delta + filtered.length) % filtered.length
    setSelectedId(filtered[next]!.id)
  }

  // Body-scroll slot zolang de verkenner open is; Escape sluit.
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

  // ---- Kaart ----
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const linesRef = useRef<Map<number, L.Polyline>>(new Map())
  const casingRef = useRef<L.Polyline | null>(null)
  const selectRef = useRef<(id: number) => void>(() => {})
  selectRef.current = (id: number) => setSelectedId(id)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    })
    map.attributionControl.setPrefix(false)
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      },
    ).addTo(map)
    L.control.zoom({ position: "topright" }).addTo(map)
    // Startbeeld (Nederland) zodat de kaart meteen "klaar" is; direct daarna
    // past de teken-stap het beeld aan op de echte routes. Zonder startbeeld
    // crasht Leaflet bij het toevoegen van lijnen aan een lege kaart.
    map.setView([52.2, 5.3], 7)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Alle gefilterde routes tekenen; de gekozen route bovenop in accentkleur.
  const didFitAllRef = useRef(false)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    for (const line of linesRef.current.values()) line.remove()
    linesRef.current.clear()
    casingRef.current?.remove()
    casingRef.current = null

    const allPoints: [number, number][] = []
    for (const r of filtered) {
      const latlngs = (r.geometry ?? []).map(
        ([lat, lon]) => [lat, lon] as [number, number],
      )
      if (latlngs.length < 2) continue
      allPoints.push(...latlngs)
      const isSel = r.id === selectedId
      if (isSel) {
        // Donkere rand onder de accentlijn zodat hij boven de drukke kaart
        // uitspringt.
        casingRef.current = L.polyline(latlngs, {
          color: "rgba(5,7,14,0.85)",
          weight: 8,
          opacity: 0.9,
        }).addTo(map)
      }
      const line = L.polyline(latlngs, {
        color: isSel ? ACCENT : MUTED_LINE,
        weight: isSel ? 4.5 : 3,
        opacity: isSel ? 1 : 0.8,
      }).addTo(map)
      line.on("click", () => selectRef.current(r.id))
      linesRef.current.set(r.id, line)
    }
    if (!didFitAllRef.current && allPoints.length >= 2) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40] })
      didFitAllRef.current = true
    }

    // De gekozen lijn bovenop leggen (na de fit, zodat de lagen in beeld zijn).
    const sel = selectedId != null ? linesRef.current.get(selectedId) : null
    casingRef.current?.bringToFront()
    sel?.bringToFront()
    // Alleen als de kaart nog bestaat — in dev remount React componenten
    // dubbel en zou de timer anders op een al verwijderde kaart vuren.
    setTimeout(() => {
      if (mapRef.current === map) map.invalidateSize()
    }, 80)
  }, [filtered, selectedId])

  // Bij het kiezen van een andere route: soepel naar die route toe vliegen.
  const lastFlownRef = useRef<number | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map || selectedId == null || lastFlownRef.current === selectedId)
      return
    const sel = filtered.find((r) => r.id === selectedId)
    const latlngs = (sel?.geometry ?? []).map(
      ([lat, lon]) => [lat, lon] as [number, number],
    )
    if (latlngs.length >= 2 && didFitAllRef.current) {
      map.flyToBounds(L.latLngBounds(latlngs), {
        padding: [48, 48],
        duration: 0.6,
      })
    }
    lastFlownRef.current = selectedId
  }, [selectedId, filtered])

  const chipBase =
    "shrink-0 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] backdrop-blur-md transition"
  const chipOn = `${chipBase} border-cyan-300/50 bg-[#070d16]/[0.88] text-cyan-300`
  const chipOff = `${chipBase} border-white/[0.14] bg-[#070d16]/[0.72] text-white/65 hover:border-white/30`

  const notOnMap = routes.length - mappable.length

  return createPortal(
    <div className="fixed inset-0 z-[90] bg-[#05070e]">
      {/* Kaart vult het hele scherm */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Bovenbalk: terug + filters */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[10] p-3">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Verkenner sluiten"
            className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-[#070d16]/[0.88] text-white/80 backdrop-blur-md transition hover:border-white/30"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
          <div className="pointer-events-auto flex min-w-0 flex-1 flex-col gap-2">
            {surfaces.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => setSurfaceFilter("alle")}
                  className={surfaceFilter === "alle" ? chipOn : chipOff}
                >
                  Alle types
                </button>
                {surfaces.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSurfaceFilter(s)}
                    className={surfaceFilter === s ? chipOn : chipOff}
                  >
                    {surfaceLabel(s)}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {LENGTH_CHIPS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setLengthFilter(c.key)}
                  className={lengthFilter === c.key ? chipOn : chipOff}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Onderin: routekaartje van de gekozen route */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[10] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {filtered.length === 0 ? (
          <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-white/[0.1] bg-[#070d16]/[0.92] p-4 backdrop-blur-md">
            <p className="text-[13px] font-medium text-white/80">
              {mappable.length === 0
                ? "Nog geen routes met een kaartlijn"
                : "Geen routes binnen dit filter"}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/45">
              {mappable.length === 0
                ? "Genereer een route of upload een GPX — daarna verschijnt hij hier op de kaart."
                : "Zet een filter uit om weer routes te zien."}
            </p>
          </div>
        ) : (
          selected && (
            <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-white/[0.1] bg-[#070d16]/[0.92] p-4 backdrop-blur-md">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono text-[9px] uppercase tracking-[0.18em]"
                      style={{ color: ACCENT }}
                    >
                      {surfaceLabel(selected.surface)}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/30">
                      {sourceLabel(selected.source)}
                    </span>
                  </div>
                  <h3 className="mt-0.5 truncate text-[16px] font-medium tracking-tight text-white/95">
                    {selected.name}
                  </h3>
                </div>
                {filtered.length > 1 && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => step(-1)}
                      aria-label="Vorige route"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] text-white/70 transition hover:border-white/30"
                    >
                      <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                    </button>
                    <span className="px-1 font-mono text-[10px] tabular-nums text-white/40">
                      {selectedIndex + 1}/{filtered.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => step(1)}
                      aria-label="Volgende route"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] text-white/70 transition hover:border-white/30"
                    >
                      <ChevronRight className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                {selected.durationSec != null && (
                  <span className="flex items-center gap-1.5 text-[12px] tabular-nums text-white/70">
                    <Clock className="h-3.5 w-3.5 text-white/35" strokeWidth={1.75} />
                    {fmtDuration(selected.durationSec)}
                  </span>
                )}
                {selected.distanceKm != null && (
                  <span className="flex items-center gap-1.5 text-[12px] tabular-nums text-white/70">
                    <Ruler className="h-3.5 w-3.5 text-white/35" strokeWidth={1.75} />
                    {selected.distanceKm} km
                  </span>
                )}
                {selected.elevationGainM != null && (
                  <span className="flex items-center gap-1.5 text-[12px] tabular-nums text-white/70">
                    <Mountain className="h-3.5 w-3.5 text-white/35" strokeWidth={1.75} />
                    {selected.elevationGainM} m
                  </span>
                )}
                {(selected.climbs?.length ?? 0) > 0 && (
                  <span className="text-[12px] text-white/50">
                    {selected.climbs!.length}{" "}
                    {selected.climbs!.length === 1 ? "klim" : "klimmen"}
                  </span>
                )}
              </div>

              {(selected.profile?.length ?? 0) > 1 && (
                <MiniElevationProfile profile={selected.profile!} />
              )}

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate(selected.id)}
                  className="flex items-center gap-1.5 rounded-full bg-cyan-400/90 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#05070e] transition hover:bg-cyan-300"
                >
                  <Navigation className="h-3.5 w-3.5" strokeWidth={2} />
                  Navigeer
                </button>
                <button
                  type="button"
                  onClick={() => onOpenRoute(selected.id)}
                  className="rounded-full border border-white/[0.16] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition hover:border-white/35 hover:text-white/90"
                >
                  Alle details
                </button>
              </div>
            </div>
          )
        )}
        {notOnMap > 0 && (
          <p className="pointer-events-auto mx-auto mt-1.5 max-w-md text-center text-[10px] text-white/35">
            {notOnMap} route{notOnMap === 1 ? "" : "s"} zonder kaartlijn{" "}
            {notOnMap === 1 ? "staat" : "staan"} niet op de kaart — je vindt ze
            in de lijst.
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}
