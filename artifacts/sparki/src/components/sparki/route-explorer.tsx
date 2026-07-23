import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import {
  X,
  ChevronUp,
  ChevronDown,
  Mountain,
  Clock,
  Ruler,
  Navigation,
} from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { MiniElevationProfile } from "@/components/sparki/elevation-profile"
import type { SparkiRoute } from "@/hooks/use-routes"

// Bewaarde routes op kaart: toont UITSLUITEND de eigen opgeslagen routes van
// de gebruiker op één kaart. Gedeelde routes hebben hun eigen plek ("Gedeeld
// met mij" in de routebibliotheek) en staan hier bewust niet tussen.
//
// Opbouw (mobiel-eerst): vaste bovenbalk met titel en sluiten, compacte
// filters, kaart in het bovenste deel, en onderaan een uitschuifbaar paneel
// (ingeklapt / half / volledig) met de resultaten en de gegevens van de
// gekozen route. Alles wat je ziet is echt: de lijnen zijn de opgeslagen
// routegeometrie, de cijfers komen uit de route zelf.

const MUTED_LINE = "rgba(140,150,255,0.55)"

type SurfaceFilter = "alle" | string
type LengthFilter = "alle" | "kort" | "middel" | "lang"
type SheetState = "ingeklapt" | "half" | "vol"

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

// Paneelhoogtes: het paneel is een gewone flex-buur van de kaart, dus de
// kaart wordt nooit bedekt — hij krimpt mee en blijft altijd zichtbaar.
const SHEET_HEIGHT: Record<SheetState, string> = {
  ingeklapt: "3.25rem",
  half: "42%",
  vol: "72%",
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
  const [sheet, setSheet] = useState<SheetState>("half")

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
    // Zoomknoppen rechtsonder in het kaartvlak — de filters staan BOVEN de
    // kaart (eigen rij), dus nergens overlappen knoppen elkaar.
    L.control.zoom({ position: "bottomright" }).addTo(map)
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
    // Openingsbeeld: direct inzoomen op waar de routes ÉCHT liggen — nooit
    // standaard half Europa als alles rond één plek ligt.
    if (!didFitAllRef.current && allPoints.length >= 2) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [32, 32] })
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
        padding: [40, 40],
        duration: 0.6,
      })
    }
    lastFlownRef.current = selectedId
  }, [selectedId, filtered])

  // Als het paneel van hoogte wisselt, verandert het kaartvlak mee — de kaart
  // opnieuw laten meten en de gekozen route weer passend in beeld brengen.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const t = setTimeout(() => {
      if (mapRef.current !== map) return
      map.invalidateSize()
      const sel = filtered.find((r) => r.id === selectedId)
      const latlngs = (sel?.geometry ?? []).map(
        ([lat, lon]) => [lat, lon] as [number, number],
      )
      if (latlngs.length >= 2) {
        map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] })
      }
    }, 230)
    return () => clearTimeout(t)
    // Bewust alleen op paneelstand — selectie-wissels vliegen al via flyToBounds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet])

  function cycleSheet(dir: 1 | -1) {
    const order: SheetState[] = ["ingeklapt", "half", "vol"]
    const i = order.indexOf(sheet)
    const next = order[Math.min(order.length - 1, Math.max(0, i + dir))]!
    setSheet(next)
  }

  const chipBase =
    "shrink-0 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition"
  const chipOn = `${chipBase} border-cyan-300/50 bg-cyan-300/10 text-cyan-300`
  const chipOff = `${chipBase} border-white/[0.14] text-white/65 hover:border-white/30`

  const notOnMap = routes.length - mappable.length

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#05070e] pt-[env(safe-area-inset-top)]">
      {/* Vaste bovenbalk: titel + sluiten */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.08] px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-medium tracking-tight text-white/95">
            Bewaarde routes op kaart
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
            Alleen jouw opgeslagen routes
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Kaart sluiten"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.14] text-white/80 transition hover:border-white/30"
        >
          <X className="h-4.5 w-4.5" strokeWidth={2} />
        </button>
      </div>

      {/* Compacte filters boven de kaart (eigen rij — bedekken de kaart niet) */}
      {(surfaces.length > 1 || mappable.length > 0) && (
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-white/[0.06] px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {surfaces.length > 1 && (
            <>
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
              <span className="mx-0.5 my-auto h-4 w-px shrink-0 bg-white/[0.1]" />
            </>
          )}
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
      )}

      {/* Kaart in het bovenste deel — krimpt mee met het paneel, wordt nooit bedekt */}
      <div className="relative min-h-[22%] flex-1">
        <div ref={containerRef} className="absolute inset-0" />
      </div>

      {/* Uitschuifbaar resultatenpaneel onderaan: ingeklapt / half / volledig */}
      <div
        className="flex shrink-0 flex-col overflow-hidden border-t border-white/[0.1] bg-[#070d16] pb-[env(safe-area-inset-bottom)] transition-[height] duration-200"
        style={{ height: SHEET_HEIGHT[sheet] }}
      >
        {/* Paneelkop: aantal gevonden routes + open/dicht */}
        <div className="flex shrink-0 items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setSheet(sheet === "ingeklapt" ? "half" : "ingeklapt")}
            className="min-w-0 flex-1 text-left"
          >
            <span className="text-[13px] font-medium tabular-nums text-white/85">
              {filtered.length === 0
                ? mappable.length === 0
                  ? "Nog geen routes met een kaartlijn"
                  : "Geen routes binnen dit filter"
                : `${filtered.length} route${filtered.length === 1 ? "" : "s"} gevonden`}
            </span>
            {selected && sheet === "ingeklapt" && (
              <span className="ml-2 truncate text-[12px] text-white/45">
                · {selected.name}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => cycleSheet(-1)}
            disabled={sheet === "ingeklapt"}
            aria-label="Paneel kleiner"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] text-white/70 transition hover:border-white/30 disabled:opacity-30"
          >
            <ChevronDown className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => cycleSheet(1)}
            disabled={sheet === "vol"}
            aria-label="Paneel groter"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] text-white/70 transition hover:border-white/30 disabled:opacity-30"
          >
            <ChevronUp className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {sheet !== "ingeklapt" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {filtered.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-white/45">
                {mappable.length === 0
                  ? "Genereer een route of upload een GPX — daarna verschijnt hij hier op de kaart."
                  : "Zet een filter uit om weer routes te zien."}
              </p>
            ) : (
              <>
                {/* Gegevens van de gekozen route */}
                {selected && (
                  <div className="rounded-2xl border border-cyan-300/25 bg-white/[0.03] p-3.5">
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
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                      {selected.durationSec != null && (
                        <span className="flex items-center gap-1.5 text-[12px] tabular-nums text-white/70">
                          <Clock
                            className="h-3.5 w-3.5 text-white/35"
                            strokeWidth={1.75}
                          />
                          {fmtDuration(selected.durationSec)}
                        </span>
                      )}
                      {selected.distanceKm != null && (
                        <span className="flex items-center gap-1.5 text-[12px] tabular-nums text-white/70">
                          <Ruler
                            className="h-3.5 w-3.5 text-white/35"
                            strokeWidth={1.75}
                          />
                          {selected.distanceKm} km
                        </span>
                      )}
                      {selected.elevationGainM != null && (
                        <span className="flex items-center gap-1.5 text-[12px] tabular-nums text-white/70">
                          <Mountain
                            className="h-3.5 w-3.5 text-white/35"
                            strokeWidth={1.75}
                          />
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
                )}

                {/* Alle gevonden routes — tik om te kiezen (kaart zoomt mee) */}
                {filtered.length > 1 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {filtered.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(r.id)
                          if (sheet === "vol") setSheet("half")
                        }}
                        className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                          r.id === selectedId
                            ? "bg-cyan-300/[0.08]"
                            : "hover:bg-white/[0.05]"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate text-[13px] text-white/85">
                          {r.name}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/40">
                          {surfaceLabel(r.surface)}
                          {r.distanceKm != null ? ` · ${r.distanceKm} km` : ""}
                          {r.elevationGainM != null
                            ? ` · ${r.elevationGainM} m`
                            : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {notOnMap > 0 && (
                  <p className="mt-2 text-[10px] text-white/35">
                    {notOnMap} route{notOnMap === 1 ? "" : "s"} zonder kaartlijn{" "}
                    {notOnMap === 1 ? "staat" : "staan"} niet op de kaart — je
                    vindt ze in de lijst bij Bewaarde routes.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
