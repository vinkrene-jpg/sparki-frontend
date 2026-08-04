import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { useLocation } from "wouter"
import {
  Bike,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Footprints,
  Loader2,
  MapPinned,
  Mountain,
  Search,
  SlidersHorizontal,
  Wand2,
  X,
} from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import {
  useGeocode,
  useNearbyRoutes,
  type GeocodeResult,
  type NearbyRoute,
} from "@/hooks/use-routes"
import { displayRouteName } from "@/lib/route-name"

// Kaart-eerst startweergave van de routeplanner (taak #560, Komoot-opzet):
// open Routes en zie direct de kaart rond je locatie met échte voorstellen
// uit het eigen corpus (bewaard, gereden, plan, gedeeld, openbaar) — geen
// generatie en geen community-corpus dat er niet is. Dun gebied wordt eerlijk
// gemeld met "Zelf plannen" als uitweg. Filteren gebeurt client-side op de
// opgehaalde lijst, zodat de teller live is zonder server-bursts.

type SportKeuze = "cycling" | "walking" | "hiking"

const SPORT_OPTIES: { id: SportKeuze; label: string; meervoud: string }[] = [
  { id: "cycling", label: "Fietsen", meervoud: "fietsroutes" },
  { id: "walking", label: "Wandelen", meervoud: "wandelroutes" },
  { id: "hiking", label: "Hiken", meervoud: "hikeroutes" },
]

type Moeilijkheid = "makkelijk" | "gemiddeld" | "zwaar"

type KaartFilters = {
  minKm: number | null
  maxKm: number | null
  minHm: number | null
  maxHm: number | null
  ondergrond: "geen" | "verhard" | "onverhard"
  type: "alle" | "lus" | "heenterug"
  moeilijkheid: Record<Moeilijkheid, boolean>
}

const FILTERS_LEEG: KaartFilters = {
  minKm: null,
  maxKm: null,
  minHm: null,
  maxHm: null,
  ondergrond: "geen",
  type: "alle",
  moeilijkheid: { makkelijk: true, gemiddeld: true, zwaar: true },
}

function filtersActief(f: KaartFilters): boolean {
  return (
    f.minKm != null ||
    f.maxKm != null ||
    f.minHm != null ||
    f.maxHm != null ||
    f.ondergrond !== "geen" ||
    f.type !== "alle" ||
    !f.moeilijkheid.makkelijk ||
    !f.moeilijkheid.gemiddeld ||
    !f.moeilijkheid.zwaar
  )
}

// Zelfde ondergrondklasse als de server (lib/routes-nearby): "unknown" telt
// alleen mee bij "geen voorkeur" — eerlijk, nooit stil bij een klasse gerekend.
function ondergrondKlasse(surface: string): "verhard" | "onverhard" | "onbekend" {
  if (surface === "asfalt") return "verhard"
  if (["gravel", "mtb", "pad", "mixed"].includes(surface)) return "onverhard"
  return "onbekend"
}

function pasFilters(routes: NearbyRoute[], f: KaartFilters): NearbyRoute[] {
  return routes.filter((r) => {
    if (f.minKm != null && (r.distanceKm == null || r.distanceKm < f.minKm))
      return false
    if (f.maxKm != null && (r.distanceKm == null || r.distanceKm > f.maxKm))
      return false
    if (
      f.minHm != null &&
      (r.elevationGainM == null || r.elevationGainM < f.minHm)
    )
      return false
    if (
      f.maxHm != null &&
      (r.elevationGainM == null || r.elevationGainM > f.maxHm)
    )
      return false
    if (f.ondergrond !== "geen" && ondergrondKlasse(r.surface) !== f.ondergrond)
      return false
    if (f.type === "lus" && !r.isLus) return false
    if (f.type === "heenterug" && r.isLus) return false
    const alle =
      f.moeilijkheid.makkelijk && f.moeilijkheid.gemiddeld && f.moeilijkheid.zwaar
    if (!alle) {
      // Zodra er op moeilijkheid gefilterd wordt, valt "onbekend" eerlijk af.
      if (r.moeilijkheid == null || !f.moeilijkheid[r.moeilijkheid]) return false
    }
    return true
  })
}

function fmtKm(v: number | null | undefined) {
  return typeof v === "number" ? `${Math.round(v * 10) / 10} km` : "—"
}

const BRON_KORT: Record<NearbyRoute["bron"], string> = {
  bewaard: "Bewaard",
  plan: "Plan",
  gereden: "Gereden",
  gedeeld: "Gedeeld",
  openbaar: "Openbaar",
}

const MOEILIJKHEID_LABEL: Record<Moeilijkheid, string> = {
  makkelijk: "Makkelijk",
  gemiddeld: "Gemiddeld",
  zwaar: "Zwaar",
}

// ── Kaart ────────────────────────────────────────────────────────────────────

function NearbyMap({
  center,
  routes,
  selectedKey,
  onSelect,
}: {
  center: { lat: number; lon: number } | null
  routes: NearbyRoute[]
  selectedKey: string | null
  onSelect: (key: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const linesRef = useRef<Map<string, L.Polyline>>(new Map())
  const markerRef = useRef<L.CircleMarker | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    })
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      },
    ).addTo(map)
    // Startzicht Nederland; zodra er een centrum is zoomt de kaart daarheen.
    map.setView([52.1, 5.3], 7)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      linesRef.current.clear()
      markerRef.current = null
    }
  }, [])

  // Centrum-marker + zoom naar het gekozen punt.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !center) return
    if (markerRef.current) markerRef.current.remove()
    markerRef.current = L.circleMarker([center.lat, center.lon], {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#e63946",
      fillOpacity: 1,
    }).addTo(map)
    map.setView([center.lat, center.lon], 11)
  }, [center])

  // Routelijnen (her)tekenen.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const line of linesRef.current.values()) line.remove()
    linesRef.current.clear()
    for (const r of routes) {
      if (!r.geometry || r.geometry.length < 2) continue
      const line = L.polyline(
        r.geometry.map(([lat, lon]) => [lat, lon] as [number, number]),
        { color: ACCENT, weight: 3, opacity: 0.55 },
      )
      line.on("click", () => onSelect(r.key))
      line.addTo(map)
      linesRef.current.set(r.key, line)
    }
    // onSelect is stabiel genoeg per render; routes is de echte trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes])

  // Selectie uitlichten.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const [key, line] of linesRef.current) {
      const active = key === selectedKey
      line.setStyle({
        weight: active ? 5 : 3,
        opacity: active ? 0.95 : selectedKey == null ? 0.55 : 0.3,
      })
      if (active) {
        line.bringToFront()
        map.fitBounds(line.getBounds(), { padding: [32, 32] })
      }
    }
  }, [selectedKey])

  return (
    <div
      ref={containerRef}
      className="h-[52vh] min-h-[320px] w-full overflow-hidden rounded-2xl border border-border"
      data-testid="nearby-kaart"
    />
  )
}

// ── Filters-sheet ────────────────────────────────────────────────────────────

function FiltersSheet({
  open,
  onClose,
  filters,
  onChange,
  teller,
  sportMeervoud,
}: {
  open: boolean
  onClose: () => void
  filters: KaartFilters
  onChange: (f: KaartFilters) => void
  teller: number
  sportMeervoud: string
}) {
  if (!open) return null
  const veld =
    "w-24 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-foreground"
  const radio = (checked: boolean) =>
    `flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
      checked
        ? "border-accent-cyan bg-accent-cyan/10 text-foreground"
        : "border-border bg-card text-muted-foreground hover:border-accent-cyan"
    }`
  // Hand-rolled modal: portal naar body + z boven de bottom-nav (z-50-val).
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center lg:items-center">
      <button
        type="button"
        aria-label="Filters sluiten"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div
        role="dialog"
        aria-label="Filters"
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-background p-5 lg:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <section className="mt-4">
          <h3 className="text-sm font-semibold text-foreground">Afstand</h3>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="min"
              aria-label="Minimale afstand (km)"
              className={veld}
              value={filters.minKm ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  minKm: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <span>tot</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="max"
              aria-label="Maximale afstand (km)"
              className={veld}
              value={filters.maxKm ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  maxKm: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <span>km</span>
          </div>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-semibold text-foreground">
            Moeilijkheidsgraad
          </h3>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            Indicatief, afgeleid uit echte afstand en hoogtemeters.
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {(Object.keys(MOEILIJKHEID_LABEL) as Moeilijkheid[]).map((m) => (
              <label key={m} className={radio(filters.moeilijkheid[m])}>
                {MOEILIJKHEID_LABEL[m]}
                <input
                  type="checkbox"
                  checked={filters.moeilijkheid[m]}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      moeilijkheid: {
                        ...filters.moeilijkheid,
                        [m]: e.target.checked,
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-semibold text-foreground">Hoogtemeters</h3>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="min"
              aria-label="Minimale hoogtemeters"
              className={veld}
              value={filters.minHm ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  minHm: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <span>tot</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="max"
              aria-label="Maximale hoogtemeters"
              className={veld}
              value={filters.maxHm ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  maxHm: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <span>hm</span>
          </div>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-semibold text-foreground">Ondergrond</h3>
          <div className="mt-2 flex flex-col gap-2">
            {(
              [
                ["geen", "Geen voorkeur"],
                ["verhard", "Weg of verhard"],
                ["onverhard", "Off-road"],
              ] as const
            ).map(([id, label]) => (
              <label key={id} className={radio(filters.ondergrond === id)}>
                {label}
                <input
                  type="radio"
                  name="ondergrond"
                  checked={filters.ondergrond === id}
                  onChange={() => onChange({ ...filters, ondergrond: id })}
                />
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">
            Routes zonder bekend wegdek tellen alleen mee bij "Geen voorkeur".
          </p>
        </section>

        <section className="mt-5">
          <h3 className="text-sm font-semibold text-foreground">Type route</h3>
          <div className="mt-2 flex flex-col gap-2">
            {(
              [
                ["alle", "Alle"],
                ["lus", "Circulair"],
                ["heenterug", "Heen en terug"],
              ] as const
            ).map(([id, label]) => (
              <label key={id} className={radio(filters.type === id)}>
                {label}
                <input
                  type="radio"
                  name="typeroute"
                  checked={filters.type === id}
                  onChange={() => onChange({ ...filters, type: id })}
                />
              </label>
            ))}
          </div>
        </section>

        <div className="sticky bottom-0 -mx-5 mt-6 flex gap-3 border-t border-border bg-background px-5 pb-1 pt-4">
          <button
            type="button"
            onClick={() => onChange(FILTERS_LEEG)}
            className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Alles resetten
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-accent-cyan px-4 py-2.5 text-sm font-semibold text-[color:var(--color-on-accent)] hover:brightness-110"
            data-testid="filters-teller"
          >
            {teller} {sportMeervoud}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Hoofdcomponent ───────────────────────────────────────────────────────────

export function RouteKaartStart() {
  const [, setLocation] = useLocation()
  const [sport, setSport] = useState<SportKeuze>("cycling")
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null)
  const [locatieStatus, setLocatieStatus] = useState<
    "idle" | "bezig" | "geweigerd"
  >("idle")
  const [zoektekst, setZoektekst] = useState("")
  const [zoekresultaten, setZoekresultaten] = useState<GeocodeResult[] | null>(
    null,
  )
  const [filters, setFilters] = useState<KaartFilters>(FILTERS_LEEG)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [lijstOpen, setLijstOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const geocode = useGeocode()
  const nearby = useNearbyRoutes(center, sport)

  const sportInfo = SPORT_OPTIES.find((s) => s.id === sport)!
  const alleRoutes = useMemo(() => nearby.data?.routes ?? [], [nearby.data])
  const routes = useMemo(
    () => pasFilters(alleRoutes, filters),
    [alleRoutes, filters],
  )
  const selected = routes.find((r) => r.key === selectedKey) ?? null

  // Eén keer stil proberen de huidige locatie te krijgen; weigeren is oké —
  // dan blijft de eerlijke uitleg staan en kan de renner zoeken op plaatsnaam.
  const autoLocatie = useRef(false)
  useEffect(() => {
    if (autoLocatie.current || center) return
    autoLocatie.current = true
    vraagLocatie()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function vraagLocatie() {
    if (!("geolocation" in navigator)) {
      setLocatieStatus("geweigerd")
      return
    }
    setLocatieStatus("bezig")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setLocatieStatus("idle")
      },
      () => setLocatieStatus("geweigerd"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }

  async function zoekPlaats() {
    const q = zoektekst.trim()
    if (q.length < 2) return
    try {
      const res = await geocode.mutateAsync(q)
      setZoekresultaten(res.results)
      if (res.results.length === 1) {
        kiesPlaats(res.results[0]!)
      }
    } catch {
      setZoekresultaten([])
    }
  }

  function kiesPlaats(r: GeocodeResult) {
    setCenter({ lat: r.lat, lon: r.lon })
    setZoekresultaten(null)
    setZoektekst(r.label)
    setSelectedKey(null)
  }

  const knop =
    "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-accent-cyan"

  return (
    <div className="flex flex-col gap-3" data-testid="route-kaart-start">
      {/* Zoekbalk + Zelf plannen */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={zoektekst}
            onChange={(e) => setZoektekst(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void zoekPlaats()
            }}
            placeholder="Zoek een plaats…"
            aria-label="Zoek een plaats"
            className="w-full rounded-full border border-border bg-card py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
            data-testid="nearby-zoekveld"
          />
          {zoekresultaten != null && (
            <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
              {zoekresultaten.length === 0 ? (
                <p className="px-3.5 py-2.5 text-[13px] text-muted-foreground">
                  Geen plaats gevonden.
                </p>
              ) : (
                zoekresultaten.map((r, i) => (
                  <button
                    key={`${r.lat}-${r.lon}-${i}`}
                    type="button"
                    onClick={() => kiesPlaats(r)}
                    className="block w-full px-3.5 py-2.5 text-left text-[13px] text-foreground hover:bg-card"
                  >
                    {r.label}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setLocation("/routes?view=maken")}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-cyan px-4 py-2.5 text-[13px] font-semibold text-[color:var(--color-on-accent)] hover:brightness-110"
          data-testid="knop-zelf-plannen"
        >
          <Wand2 className="h-4 w-4" />
          Zelf plannen
        </button>
      </div>

      {/* Sport / locatie / filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <select
            value={sport}
            onChange={(e) => {
              setSport(e.target.value as SportKeuze)
              setSelectedKey(null)
            }}
            aria-label="Sport kiezen"
            className="appearance-none rounded-full border border-border bg-card py-2 pl-9 pr-8 text-[13px] font-medium text-foreground"
            data-testid="nearby-sportkeuze"
          >
            {SPORT_OPTIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {sport === "cycling" ? (
            <Bike className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          ) : (
            <Footprints className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          )}
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <button
          type="button"
          onClick={vraagLocatie}
          className={knop}
          data-testid="knop-huidige-locatie"
        >
          {locatieStatus === "bezig" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Crosshair className="h-4 w-4" />
          )}
          Huidige locatie
        </button>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`${knop} ${filtersActief(filters) ? "border-accent-cyan" : ""}`}
          data-testid="knop-filters"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {filtersActief(filters) ? (
            <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-accent-cyan" />
          ) : null}
        </button>
      </div>

      {/* Locatie-uitleg wanneer er nog geen centrum is */}
      {center == null && (
        <div className="rounded-2xl border border-border bg-card p-4 text-[13px] leading-relaxed text-muted-foreground">
          {locatieStatus === "bezig"
            ? "Locatie wordt opgehaald…"
            : "Er is nog geen locatie bekend. Gebruik \u201cHuidige locatie\u201d of zoek een plaatsnaam — dan verschijnen hier de routes uit jouw omgeving."}
        </div>
      )}

      <NearbyMap
        center={center}
        routes={routes}
        selectedKey={selectedKey}
        onSelect={(k) => {
          setSelectedKey(k)
          setLijstOpen(true)
        }}
      />

      {/* Geselecteerde route */}
      {selected && (
        <div className="rounded-2xl border border-accent-cyan bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-foreground/90">
                {displayRouteName(selected.naam, selected.distanceKm).display}
              </p>
              <p className="mt-1 text-[12.5px] tabular-nums text-muted-foreground">
                {fmtKm(selected.distanceKm)}
                {typeof selected.elevationGainM === "number"
                  ? ` · ${Math.round(selected.elevationGainM)} hm`
                  : ""}
                {selected.moeilijkheid
                  ? ` · ${MOEILIJKHEID_LABEL[selected.moeilijkheid]}`
                  : ""}
                {` · ${selected.isLus ? "Rondje" : "Heen en terug / A-B"}`}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                {selected.bronLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              aria-label="Selectie sluiten"
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground/90"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {selected.soort === "route" &&
            (selected.bron === "bewaard" ||
              selected.bron === "plan" ||
              selected.bron === "gereden") ? (
              <button
                type="button"
                onClick={() =>
                  setLocation(`/routes?view=bewaard&route=${selected.id}`)
                }
                className="rounded-full bg-accent-cyan px-4 py-2 text-[13px] font-semibold text-[color:var(--color-on-accent)] hover:brightness-110"
              >
                Route openen
              </button>
            ) : selected.soort === "kandidaat" ? (
              <button
                type="button"
                onClick={() => setLocation("/routes?view=bewaard")}
                className="rounded-full bg-accent-cyan px-4 py-2 text-[13px] font-semibold text-[color:var(--color-on-accent)] hover:brightness-110"
              >
                Bekijk bij je gereden routes
              </button>
            ) : null}
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Vóór opslaan of navigeren volgt altijd een nieuwe
              blokkadecontrole.
            </p>
          </div>
        </div>
      )}

      {/* Onderste balk: teller + uitschuifbare lijst */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setLijstOpen((v) => !v)}
          className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-foreground"
          data-testid="nearby-teller"
          aria-expanded={lijstOpen}
        >
          {nearby.isLoading && center != null ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Routes zoeken…
            </>
          ) : (
            <>
              {routes.length} {sportInfo.meervoud}
              {lijstOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </>
          )}
        </button>
        {lijstOpen && (
          <div className="border-t border-border">
            {nearby.isError ? (
              <div className="p-4">
                <p className="text-[13px] text-muted-foreground">
                  Routes in de buurt konden niet geladen worden.
                </p>
                <button
                  type="button"
                  onClick={() => void nearby.refetch()}
                  className="mt-2 rounded-full bg-accent-cyan px-4 py-2 text-[13px] font-semibold text-[color:var(--color-on-accent)]"
                >
                  Opnieuw proberen
                </button>
              </div>
            ) : center == null ? (
              <p className="p-4 text-[13px] text-muted-foreground">
                Kies eerst een locatie of zoek een plaats.
              </p>
            ) : routes.length === 0 && !nearby.isLoading ? (
              <div className="p-5 text-center">
                <MapPinned
                  className="mx-auto h-7 w-7 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <p className="mt-2 text-sm font-medium text-foreground">
                  {alleRoutes.length > 0
                    ? "Geen routes binnen deze filters"
                    : "Nog geen bekende routes in dit gebied"}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
                  {alleRoutes.length > 0
                    ? "Zet een filter ruimer of reset alles in het Filters-menu."
                    : "De voorstellen komen uit je eigen routes, je ritgeschiedenis en gedeelde of openbare routes van anderen — hier is daarvan nog niets. Plan zelf een route; die wordt dan met een echte blokkadecontrole gemaakt."}
                </p>
                <button
                  type="button"
                  onClick={() => setLocation("/routes?view=maken")}
                  className="mt-3 rounded-full bg-accent-cyan px-4 py-2 text-[13px] font-semibold text-[color:var(--color-on-accent)] hover:brightness-110"
                >
                  Zelf plannen
                </button>
              </div>
            ) : (
              <ul className="max-h-[40vh] overflow-y-auto">
                {routes.map((r) => (
                  <li key={r.key} className="border-b border-border last:border-0">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedKey(selectedKey === r.key ? null : r.key)
                      }
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-background/50 ${
                        selectedKey === r.key ? "bg-background/60" : ""
                      }`}
                    >
                      <p className="truncate text-[13.5px] font-medium text-foreground/90">
                        {displayRouteName(r.naam, r.distanceKm).display}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] tabular-nums text-muted-foreground">
                        <span>{fmtKm(r.distanceKm)}</span>
                        {typeof r.elevationGainM === "number" ? (
                          <span className="inline-flex items-center gap-0.5">
                            <Mountain className="h-3 w-3" />
                            {Math.round(r.elevationGainM)} hm
                          </span>
                        ) : null}
                        {r.moeilijkheid ? (
                          <span>{MOEILIJKHEID_LABEL[r.moeilijkheid]}</span>
                        ) : null}
                        <span className="rounded-full border border-border px-1.5 py-px text-[10.5px]">
                          {BRON_KORT[r.bron]}
                        </span>
                        <span>
                          op {Math.round(r.startAfstandKm * 10) / 10} km
                        </span>
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {nearby.data ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {nearby.data.corpusNote} {nearby.data.verificatieNote}
        </p>
      ) : null}

      <FiltersSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onChange={setFilters}
        teller={routes.length}
        sportMeervoud={sportInfo.meervoud}
      />
    </div>
  )
}
