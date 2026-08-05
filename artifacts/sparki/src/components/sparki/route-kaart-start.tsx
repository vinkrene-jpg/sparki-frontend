import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
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
  // Tijd-filter (minuten) — alleen eerlijk toepasbaar op routes met echt
  // bekende durationSec; routes zonder bekende tijd vallen er dan buiten.
  minTijdMin: number | null
  maxTijdMin: number | null
  ondergrond: "geen" | "verhard" | "onverhard"
  type: "alle" | "lus" | "heenterug"
  moeilijkheid: Record<Moeilijkheid, boolean>
}

const FILTERS_LEEG: KaartFilters = {
  minKm: null,
  maxKm: null,
  minHm: null,
  maxHm: null,
  minTijdMin: null,
  maxTijdMin: null,
  ondergrond: "geen",
  type: "alle",
  moeilijkheid: { makkelijk: true, gemiddeld: true, zwaar: true },
}

// ── Filtervoorkeuren onthouden (per sport, localStorage) ────────────────────
// Renners die altijd hetzelfde soort routes zoeken hoeven de filters-sheet
// niet elke keer opnieuw in te stellen. "Alles resetten" wist de opgeslagen
// voorkeur ook weer.

type AfstandModus = "afstand" | "tijd"

const FILTERS_STORAGE_PREFIX = "sparki.route-kaart-filters.v1."

function filtersStorageKey(sport: SportKeuze): string {
  return `${FILTERS_STORAGE_PREFIX}${sport}`
}

function saneNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

// Leest een bewaarde voorkeur en valideert elk veld — een corrupt of verouderd
// record valt terug op de lege standaard in plaats van stil rare filters.
function laadFilterVoorkeur(sport: SportKeuze): {
  filters: KaartFilters
  modus: AfstandModus
} {
  const leeg = { filters: FILTERS_LEEG, modus: "afstand" as AfstandModus }
  try {
    const raw = window.localStorage.getItem(filtersStorageKey(sport))
    if (!raw) return leeg
    const p = JSON.parse(raw) as Record<string, unknown>
    const f = (p.filters ?? {}) as Record<string, unknown>
    const m = (f.moeilijkheid ?? {}) as Record<string, unknown>
    const filters: KaartFilters = {
      minKm: saneNum(f.minKm),
      maxKm: saneNum(f.maxKm),
      minHm: saneNum(f.minHm),
      maxHm: saneNum(f.maxHm),
      minTijdMin: saneNum(f.minTijdMin),
      maxTijdMin: saneNum(f.maxTijdMin),
      ondergrond:
        f.ondergrond === "verhard" || f.ondergrond === "onverhard"
          ? f.ondergrond
          : "geen",
      type: f.type === "lus" || f.type === "heenterug" ? f.type : "alle",
      moeilijkheid: {
        makkelijk: m.makkelijk !== false,
        gemiddeld: m.gemiddeld !== false,
        zwaar: m.zwaar !== false,
      },
    }
    const modus: AfstandModus = p.modus === "tijd" ? "tijd" : "afstand"
    return { filters, modus }
  } catch {
    return leeg
  }
}

function bewaarFilterVoorkeur(
  sport: SportKeuze,
  filters: KaartFilters,
  modus: AfstandModus,
) {
  try {
    if (!filtersActief(filters) && modus === "afstand") {
      // Niets actief = niets te onthouden; ruim de sleutel op.
      window.localStorage.removeItem(filtersStorageKey(sport))
    } else {
      window.localStorage.setItem(
        filtersStorageKey(sport),
        JSON.stringify({ filters, modus }),
      )
    }
  } catch {
    // localStorage kan geblokkeerd zijn (privémodus) — filters werken dan
    // gewoon, alleen zonder onthouden.
  }
}

function wisFilterVoorkeur(sport: SportKeuze) {
  try {
    window.localStorage.removeItem(filtersStorageKey(sport))
  } catch {
    // idem: stil oké
  }
}

function filtersActief(f: KaartFilters): boolean {
  return (
    f.minKm != null ||
    f.maxKm != null ||
    f.minHm != null ||
    f.maxHm != null ||
    f.minTijdMin != null ||
    f.maxTijdMin != null ||
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
    if (
      f.minTijdMin != null &&
      (r.durationSec == null || r.durationSec / 60 < f.minTijdMin)
    )
      return false
    if (
      f.maxTijdMin != null &&
      (r.durationSec == null || r.durationSec / 60 > f.maxTijdMin)
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

function fmtMinuten(v: number): string {
  const m = Math.round(v)
  if (m < 60) return `${m} min`
  const u = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${u} u` : `${u} u ${rest} min`
}

// ── Dubbele schuifbalk met histogram (Komoot-opzet, taak #562) ───────────────
// Het histogram toont de echte verdeling van de opgehaalde routes; de twee
// grepen kiezen een bereik. Een greep helemaal aan de rand = geen filter.

const HISTO_BINS = 24

function VerdeelSlider({
  waarden,
  stap,
  min,
  max,
  onChange,
  fmt,
  labelMin,
  labelMax,
  leegTekst,
  testId,
}: {
  waarden: number[]
  stap: number
  min: number | null
  max: number | null
  onChange: (min: number | null, max: number | null) => void
  fmt: (v: number) => string
  labelMin: string
  labelMax: string
  leegTekst: string
  testId: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const actief = useRef<"lo" | "hi" | null>(null)

  const domainMax = useMemo(() => {
    const top = waarden.length ? Math.max(...waarden) : 0
    return Math.max(stap, Math.ceil(top / stap) * stap)
  }, [waarden, stap])

  const bins = useMemo(() => {
    const b = new Array<number>(HISTO_BINS).fill(0)
    for (const v of waarden) {
      const i = Math.min(
        HISTO_BINS - 1,
        Math.max(0, Math.floor((v / domainMax) * HISTO_BINS)),
      )
      b[i] += 1
    }
    return b
  }, [waarden, domainMax])

  if (waarden.length === 0) {
    return <p className="mt-2 text-[11.5px] text-muted-foreground">{leegTekst}</p>
  }

  const maxBin = Math.max(1, ...bins)
  const lo = Math.min(min ?? 0, domainMax)
  const hi = Math.max(lo, Math.min(max ?? domainMax, domainMax))
  const loPct = (lo / domainMax) * 100
  const hiPct = (hi / domainMax) * 100

  function waardeUitClientX(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return Math.round((f * domainMax) / stap) * stap
  }

  // Randwaarde = geen filter (null), zodat "alles" eerlijk alles blijft —
  // ook routes zonder bekende waarde blijven dan meetellen.
  function zet(kant: "lo" | "hi", v: number) {
    if (kant === "lo") {
      const nieuw = Math.max(0, Math.min(v, hi))
      onChange(nieuw <= 0 ? null : nieuw, max)
    } else {
      const nieuw = Math.min(domainMax, Math.max(v, lo))
      onChange(min, nieuw >= domainMax ? null : nieuw)
    }
  }

  function greepProps(kant: "lo" | "hi") {
    const huidig = kant === "lo" ? lo : hi
    return {
      type: "button" as const,
      role: "slider",
      "aria-label": kant === "lo" ? labelMin : labelMax,
      "aria-valuemin": 0,
      "aria-valuemax": domainMax,
      "aria-valuenow": huidig,
      "aria-valuetext": fmt(huidig),
      onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        actief.current = kant
      },
      onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => {
        if (actief.current === kant && e.buttons > 0)
          zet(kant, waardeUitClientX(e.clientX))
      },
      onPointerUp: () => {
        actief.current = null
      },
      onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault()
          zet(kant, huidig - stap)
        } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault()
          zet(kant, huidig + stap)
        }
      },
      className:
        "absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-accent-cyan shadow focus:outline-none focus:ring-2 focus:ring-accent-cyan/50",
    }
  }

  return (
    <div className="mt-2 touch-none select-none" data-testid={testId}>
      <div className="flex h-14 items-end gap-px px-2.5" aria-hidden>
        {bins.map((n, i) => {
          const centrum = ((i + 0.5) / HISTO_BINS) * domainMax
          const binnen = centrum >= lo && centrum <= hi
          return (
            <div
              key={i}
              className={`flex-1 rounded-t-sm ${
                binnen ? "bg-accent-cyan" : "bg-border"
              }`}
              style={{ height: n === 0 ? 0 : `${Math.max(10, (n / maxBin) * 100)}%` }}
            />
          )
        })}
      </div>
      <div
        ref={trackRef}
        className="relative mx-2.5 h-8"
        onPointerDown={(e) => {
          // Tik op de balk: verplaats de dichtstbijzijnde greep.
          const v = waardeUitClientX(e.clientX)
          const kant = Math.abs(v - lo) <= Math.abs(v - hi) ? "lo" : "hi"
          zet(kant, v)
        }}
      >
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-border" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent-cyan"
          style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }}
        />
        <button {...greepProps("lo")} style={{ left: `${loPct}%` }} />
        <button {...greepProps("hi")} style={{ left: `${hiPct}%` }} />
      </div>
      <div className="flex justify-between px-1 text-xs text-muted-foreground">
        <span>{min == null ? fmt(0) : fmt(lo)}</span>
        <span>{max == null ? fmt(domainMax) : fmt(hi)}</span>
      </div>
    </div>
  )
}

// Maximaal aantal routes dat standaard op de kaart getekend wordt.
const TOP_AANTAL = 5

// Kleur van de gekozen route op de kaart — bewust anders dan de standaard
// routelijn, zodat de selectie direct te herkennen is tussen de andere lijnen.
const SELECTIE_KLEUR = "#e63946"

// Eigen kleur per top-5-route, zodat de lijnen op de kaart uit elkaar te
// houden zijn. Volgorde = vaakst gereden eerst (zelfde volgorde als de kaart).
const TOP_KLEUREN = ["#0e7490", "#7c3aed", "#d97706", "#16a34a", "#db2777"]

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
  kleuren,
  selectedKey,
  onSelect,
}: {
  center: { lat: number; lon: number } | null
  routes: NearbyRoute[]
  kleuren: ReadonlyMap<string, string>
  selectedKey: string | null
  onSelect: (key: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const linesRef = useRef<Map<string, L.Polyline>>(new Map())
  const markerRef = useRef<L.CircleMarker | null>(null)
  // Voor de fit-logica in het teken-effect (zonder her-tekenen bij selectie).
  const selectedKeyRef = useRef<string | null>(selectedKey)
  selectedKeyRef.current = selectedKey
  const kleurenRef = useRef(kleuren)
  kleurenRef.current = kleuren

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
    // Alleen naar het punt springen zolang er nog geen routes getekend zijn;
    // zodra er routes staan bepaalt de route-omvang het zicht (fitBounds).
    if (linesRef.current.size === 0) map.setView([center.lat, center.lon], 11)
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
        {
          color: kleurenRef.current.get(r.key) ?? ACCENT,
          weight: 3,
          opacity: 0.7,
        },
      )
      line.on("click", () => onSelect(r.key))
      line.addTo(map)
      linesRef.current.set(r.key, line)
    }
    // Zicht aanpassen aan de OMVANG van de getekende routes (niet alleen het
    // centrum), zolang er geen specifieke route gekozen is.
    if (linesRef.current.size > 0 && selectedKeyRef.current == null) {
      const bounds = L.latLngBounds([])
      for (const line of linesRef.current.values())
        bounds.extend(line.getBounds())
      if (center) bounds.extend([center.lat, center.lon])
      if (bounds.isValid())
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 })
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
      const eigenKleur = kleurenRef.current.get(key) ?? ACCENT
      line.setStyle({
        // Gekozen route uitgelicht; de rest grijst weg zodat je in één
        // oogopslag ziet welke lijn bij de selectie hoort. Zonder selectie
        // krijgt elke route z'n eigen kleur terug.
        color: active ? SELECTIE_KLEUR : selectedKey == null ? eigenKleur : "#9ca3af",
        weight: active ? 5 : 3,
        opacity: active ? 0.95 : selectedKey == null ? 0.7 : 0.35,
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
  alleRoutes,
  teller,
  sportMeervoud,
  afstandModus,
  onModusChange,
  onReset,
}: {
  open: boolean
  onClose: () => void
  filters: KaartFilters
  onChange: (f: KaartFilters) => void
  alleRoutes: NearbyRoute[]
  teller: number
  sportMeervoud: string
  // Afstand/Tijd-modus leeft bij de ouder zodat hij mee onthouden wordt.
  afstandModus: AfstandModus
  onModusChange: (m: AfstandModus) => void
  onReset: () => void
}) {
  const kmWaarden = useMemo(
    () =>
      alleRoutes
        .map((r) => r.distanceKm)
        .filter((v): v is number => typeof v === "number"),
    [alleRoutes],
  )
  const hmWaarden = useMemo(
    () =>
      alleRoutes
        .map((r) => r.elevationGainM)
        .filter((v): v is number => typeof v === "number"),
    [alleRoutes],
  )
  const tijdWaarden = useMemo(
    () =>
      alleRoutes
        .map((r) => (r.durationSec == null ? null : r.durationSec / 60))
        .filter((v): v is number => typeof v === "number"),
    [alleRoutes],
  )
  if (!open) return null
  const tijdBeschikbaar = tijdWaarden.length > 0
  const modus = tijdBeschikbaar ? afstandModus : "afstand"
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
          {tijdBeschikbaar ? (
            <div className="mt-2 inline-flex rounded-full border border-border bg-card p-0.5">
              {(
                [
                  ["tijd", "Tijd"],
                  ["afstand", "Afstand"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onModusChange(id)}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
                    modus === id
                      ? "bg-accent-cyan text-[color:var(--color-on-accent)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          {modus === "afstand" ? (
            <VerdeelSlider
              waarden={kmWaarden}
              stap={1}
              min={filters.minKm}
              max={filters.maxKm}
              onChange={(minKm, maxKm) => onChange({ ...filters, minKm, maxKm })}
              fmt={(v) => `${Math.round(v)} km`}
              labelMin="Minimale afstand (km)"
              labelMax="Maximale afstand (km)"
              leegTekst="Nog geen routes met bekende afstand in dit gebied."
              testId="slider-afstand"
            />
          ) : (
            <>
              <VerdeelSlider
                waarden={tijdWaarden}
                stap={5}
                min={filters.minTijdMin}
                max={filters.maxTijdMin}
                onChange={(minTijdMin, maxTijdMin) =>
                  onChange({ ...filters, minTijdMin, maxTijdMin })
                }
                fmt={fmtMinuten}
                labelMin="Minimale tijd"
                labelMax="Maximale tijd"
                leegTekst="Geen routes met bekende tijd in dit gebied."
                testId="slider-tijd"
              />
              {tijdWaarden.length < alleRoutes.length ? (
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                  Alleen echt gemeten tijden tellen mee:{" "}
                  {alleRoutes.length - tijdWaarden.length} van {alleRoutes.length}{" "}
                  routes zonder bekende tijd vallen bij dit filter af.
                </p>
              ) : null}
            </>
          )}
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
          <VerdeelSlider
            waarden={hmWaarden}
            stap={10}
            min={filters.minHm}
            max={filters.maxHm}
            onChange={(minHm, maxHm) => onChange({ ...filters, minHm, maxHm })}
            fmt={(v) => `${Math.round(v)} hm`}
            labelMin="Minimale hoogtemeters"
            labelMax="Maximale hoogtemeters"
            leegTekst="Nog geen routes met bekende hoogtemeters in dit gebied."
            testId="slider-hoogte"
          />
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
            onClick={onReset}
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
  // Filters + Afstand/Tijd-modus starten vanuit de onthouden voorkeur per
  // sport en worden bij elke wijziging opnieuw bewaard.
  const [filters, setFilters] = useState<KaartFilters>(
    () => laadFilterVoorkeur("cycling").filters,
  )
  const [afstandModus, setAfstandModus] = useState<AfstandModus>(
    () => laadFilterVoorkeur("cycling").modus,
  )

  function wijzigFilters(f: KaartFilters) {
    setFilters(f)
    bewaarFilterVoorkeur(sport, f, afstandModus)
  }

  function wijzigModus(m: AfstandModus) {
    // Eerlijk wisselen: het filter van de andere weergave gaat uit, anders
    // filtert er iets onzichtbaars mee. Eén atomaire wijziging + opslag.
    const next: KaartFilters =
      m === "tijd"
        ? { ...filters, minKm: null, maxKm: null }
        : { ...filters, minTijdMin: null, maxTijdMin: null }
    setFilters(next)
    setAfstandModus(m)
    bewaarFilterVoorkeur(sport, next, m)
  }

  function resetFilters() {
    setFilters(FILTERS_LEEG)
    setAfstandModus("afstand")
    // "Alles resetten" wist ook de onthouden voorkeur voor deze sport.
    wisFilterVoorkeur(sport)
  }
  const [sheetOpen, setSheetOpen] = useState(false)
  const [lijstOpen, setLijstOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  // Standaard tonen we op de kaart alleen de 5 vaakst gereden routes —
  // alles tegelijk tekenen geeft geen overzicht. De lijst toont altijd alles.
  const [toonAlles, setToonAlles] = useState(false)

  const geocode = useGeocode()
  const nearby = useNearbyRoutes(center, sport)

  const sportInfo = SPORT_OPTIES.find((s) => s.id === sport)!
  const alleRoutes = useMemo(() => nearby.data?.routes ?? [], [nearby.data])
  const routes = useMemo(
    () => pasFilters(alleRoutes, filters),
    [alleRoutes, filters],
  )
  const selected = routes.find((r) => r.key === selectedKey) ?? null

  // Kaartweergave: standaard de 5 vaakst gereden routes (echte rittellingen);
  // zijn er minder dan 5 gereden, dan vullen we aan met de dichtstbijzijnde.
  // De gekozen route wordt altijd getekend, ook buiten de top 5.
  const kaartRoutes = useMemo(() => {
    if (toonAlles || routes.length <= TOP_AANTAL) return routes
    const opRitten = [...routes].sort(
      (a, b) => b.keerGereden - a.keerGereden,
    )
    const top = opRitten
      .filter((r) => r.keerGereden > 0)
      .slice(0, TOP_AANTAL)
    if (top.length < TOP_AANTAL) {
      for (const r of routes) {
        if (top.length >= TOP_AANTAL) break
        if (!top.includes(r)) top.push(r)
      }
    }
    if (selected && !top.some((r) => r.key === selected.key)) top.push(selected)
    return top
  }, [routes, toonAlles, selected])

  // Eigen kleur per getekende route in de top-5-weergave; bij "alles tonen"
  // is één kleur juist rustiger (te veel lijnen voor een kleurcode).
  const routeKleuren = useMemo(() => {
    const m = new Map<string, string>()
    if (!toonAlles) {
      kaartRoutes.slice(0, TOP_AANTAL).forEach((r, i) => {
        m.set(r.key, TOP_KLEUREN[i % TOP_KLEUREN.length]!)
      })
    }
    return m
  }, [kaartRoutes, toonAlles])

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
            className="w-full rounded-full border border-border bg-card py-2.5 pl-9 pr-12 text-sm text-foreground placeholder:text-muted-foreground"
            data-testid="nearby-zoekveld"
          />
          <button
            type="button"
            onClick={() => void zoekPlaats()}
            disabled={zoektekst.trim().length < 2}
            aria-label="Zoek deze plaats"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-accent-cyan px-3 py-1.5 text-[12px] font-semibold text-[color:var(--color-on-accent)] disabled:opacity-40"
            data-testid="nearby-zoek-ok"
          >
            OK
          </button>
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
              const nieuw = e.target.value as SportKeuze
              setSport(nieuw)
              setSelectedKey(null)
              // Elke sport heeft z'n eigen onthouden filtervoorkeur.
              const voorkeur = laadFilterVoorkeur(nieuw)
              setFilters(voorkeur.filters)
              setAfstandModus(voorkeur.modus)
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
        routes={kaartRoutes}
        kleuren={routeKleuren}
        selectedKey={selectedKey}
        onSelect={(k) => {
          setSelectedKey(k)
          setLijstOpen(true)
        }}
      />

      {/* Overzicht: standaard top 5 vaakst gereden; alles kan alsnog. */}
      {routes.length > TOP_AANTAL && (
        <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
          <span data-testid="nearby-kaartmodus">
            {toonAlles
              ? `Alle ${routes.length} routes op de kaart`
              : `${
                  kaartRoutes.some((r) => r.keerGereden > 0)
                    ? `Top ${Math.min(TOP_AANTAL, kaartRoutes.length)} vaakst gereden op de kaart`
                    : `De ${Math.min(TOP_AANTAL, kaartRoutes.length)} dichtstbijzijnde op de kaart`
                }${kaartRoutes.length > TOP_AANTAL ? " + je selectie" : ""}`}
          </span>
          <button
            type="button"
            onClick={() => setToonAlles((v) => !v)}
            className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 font-medium text-foreground hover:border-accent-cyan"
            data-testid="knop-toon-alles"
          >
            {toonAlles ? "Toon top 5" : `Toon alle ${routes.length}`}
          </button>
        </div>
      )}

      {/* Legenda: welke kleur hoort bij welke route (alleen top-5-weergave). */}
      {!toonAlles && routeKleuren.size > 1 && (
        <ul
          className="flex flex-wrap gap-x-3 gap-y-1.5 text-[12px] text-muted-foreground"
          data-testid="nearby-kleurlegenda"
        >
          {kaartRoutes.slice(0, TOP_AANTAL).map((r) => (
            <li key={r.key} className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedKey(r.key)
                  setLijstOpen(true)
                }}
                className="flex min-w-0 items-center gap-1.5 hover:text-foreground/90"
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: routeKleuren.get(r.key) }}
                />
                <span className="max-w-[10rem] truncate">
                  {displayRouteName(r.naam, r.distanceKm).display}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

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
        onChange={wijzigFilters}
        alleRoutes={alleRoutes}
        teller={routes.length}
        sportMeervoud={sportInfo.meervoud}
        afstandModus={afstandModus}
        onModusChange={wijzigModus}
        onReset={resetFilters}
      />
    </div>
  )
}
