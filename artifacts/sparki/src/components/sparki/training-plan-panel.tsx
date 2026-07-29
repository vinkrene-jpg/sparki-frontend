import { useMemo, useRef, useState } from "react"
import { SectionLabel, Stat, Divider, ACCENT } from "@/components/sparki/ui"
import { RouteMap } from "@/components/sparki/route-map"
import { LocationPickerMap } from "@/components/sparki/location-picker-map"
import {
  useTrainingPlan,
  useGenerateTrainingPlan,
  useAdaptTrainingPlan,
  usePauseTrainingPlan,
  useResumeTrainingPlan,
  useDeleteTrainingPlan,
  useSavePlanSetup,
  type PlanDay,
  type PlanHeader,
  type DayWeather,
  type WeatherSeverity,
  type WeatherAdvisory,
  type WeatherNutritionAdvisory,
  type RaceWeather,
  type TrainingPlanResponse,
} from "@/hooks/use-training-plan"
import { useRoutes, useGeocode, type GeocodeResult } from "@/hooks/use-routes"
import {
  Sparkles,
  RefreshCw,
  MapPin,
  Calendar,
  Info,
  Search,
  CloudSnow,
  Wind,
  Droplets,
  Thermometer,
  AlertTriangle,
  Utensils,
} from "lucide-react"

// Honest plan metadata + lifecycle controls (pauzeren / hervatten / verwijderen).
// Every value comes straight from the plan record — nothing invented.
function PlanMetaCard({ plan }: { plan: PlanHeader }) {
  const pause = usePauseTrainingPlan()
  const resume = useResumeTrainingPlan()
  const del = useDeleteTrainingPlan()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const paused = plan.status === "paused"
  const created = new Date(plan.createdAt).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const period = `${formatDay(plan.weekStartDate)} – ${formatDay(plan.horizonEndDate)}`
  return (
    <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.25em] text-white/40">
          OVER DIT PLAN
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] tracking-[0.15em] ${
            paused
              ? "bg-amber-400/10 text-amber-300/80"
              : "bg-cyan-300/10 text-cyan-300/80"
          }`}
        >
          {paused ? "GEPAUZEERD" : "ACTIEF"}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-[12px] sm:grid-cols-2">
        {[
          ["Naam", plan.name],
          ["Aangemaakt", created],
          ["Bron", plan.source === "advies" ? "Coachadvies" : "Automatisch opgebouwd"],
          ["Maker", plan.maker],
          ["Doelstelling", plan.goal],
          ["Actieve periode", period],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="font-mono text-[10px] tracking-[0.15em] text-white/30">
              {label.toUpperCase()}
            </dt>
            <dd className="text-white/70">{value}</dd>
          </div>
        ))}
      </dl>
      {paused && (
        <p className="mt-3 text-[12px] leading-relaxed text-amber-200/70">
          Dit plan staat op pauze: er worden geen nieuwe weken opgebouwd en het
          telt niet mee als actief schema. Hervat het wanneer je er klaar voor
          bent.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
        {paused ? (
          <button
            type="button"
            onClick={() => resume.mutate()}
            disabled={resume.isPending}
            className="rounded-xl border border-cyan-300/25 px-3.5 py-2 font-sans text-[12px] font-medium text-cyan-300/80 transition hover:border-cyan-300/50 disabled:opacity-50"
          >
            {resume.isPending ? "Hervatten…" : "Plan hervatten"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => pause.mutate()}
            disabled={pause.isPending}
            className="rounded-xl border border-white/[0.15] px-3.5 py-2 font-sans text-[12px] font-medium text-white/60 transition hover:border-amber-300/40 hover:text-amber-200/80 disabled:opacity-50"
          >
            {pause.isPending ? "Pauzeren…" : "Plan pauzeren"}
          </button>
        )}
        {confirmDelete ? (
          <>
            <button
              type="button"
              onClick={() => del.mutate()}
              disabled={del.isPending}
              className="rounded-xl border border-red-400/40 bg-red-400/10 px-3.5 py-2 font-sans text-[12px] font-medium text-red-300 transition hover:border-red-400/70 disabled:opacity-50"
            >
              {del.isPending ? "Verwijderen…" : "Ja, verwijder dit plan"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-xl border border-white/[0.15] px-3.5 py-2 font-sans text-[12px] text-white/60"
            >
              Annuleren
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-xl border border-white/[0.15] px-3.5 py-2 font-sans text-[12px] font-medium text-white/60 transition hover:border-red-400/40 hover:text-red-300/80"
          >
            Plan verwijderen
          </button>
        )}
      </div>
      {confirmDelete && (
        <p className="mt-2 text-[11px] leading-relaxed text-white/45">
          Dit verwijdert het schema en de geplande (nog niet gereden) trainingen
          eruit. Al gereden trainingen blijven altijd bewaard.
        </p>
      )}
    </div>
  )
}

const WEEKDAYS: { value: string; label: string }[] = [
  { value: "mon", label: "Ma" },
  { value: "tue", label: "Di" },
  { value: "wed", label: "Wo" },
  { value: "thu", label: "Do" },
  { value: "fri", label: "Vr" },
  { value: "sat", label: "Za" },
  { value: "sun", label: "Zo" },
]

const EXPERIENCE: { value: string; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Gevorderd" },
  { value: "advanced", label: "Ervaren" },
  { value: "elite", label: "Elite" },
]

const LOAD: { value: string; label: string }[] = [
  { value: "low", label: "Laag" },
  { value: "moderate", label: "Gemiddeld" },
  { value: "high", label: "Hoog" },
]

const inputClass =
  "w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"

function formatDay(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

// Renders the real route map for a committed session using the cached route
// list. Honest: shows nothing extra when no geometry exists.
function DayRouteMap({ routeId }: { routeId: number }) {
  const { data } = useRoutes()
  const route = data?.routes.find((r) => r.id === routeId)
  const geometry = route?.geometry ?? []
  if (geometry.length < 2) return null
  return (
    <div className="mt-3">
      <RouteMap geometry={geometry} climbs={route?.climbs ?? []} className="h-40" />
      {route?.rationale && (
        <p className="mt-2 text-[12px] leading-relaxed text-white/55">
          {route.rationale}
        </p>
      )}
    </div>
  )
}

function intensityColor(label: string | null): string {
  if (!label) return "rgba(255,255,255,0.4)"
  if (label.includes("Zone 4") || label.includes("Zone 5"))
    return "rgba(255,140,80,0.9)"
  if (label.includes("Zone 3")) return "rgba(255,220,100,0.85)"
  if (label.includes("Zone 1")) return "rgba(120,210,230,0.55)"
  return ACCENT
}

const SEVERITY_COLOR: Record<WeatherSeverity, string> = {
  ok: "rgba(120,210,230,0.7)",
  caution: "rgba(255,200,90,0.9)",
  severe: "rgba(255,120,90,0.95)",
}

function tempLabel(w: DayWeather): string | null {
  if (w.tempMinC == null && w.tempMaxC == null) return null
  const lo = w.tempMinC != null ? Math.round(w.tempMinC) : null
  const hi = w.tempMaxC != null ? Math.round(w.tempMaxC) : null
  if (lo != null && hi != null) return `${lo}–${hi}°`
  return `${(lo ?? hi)!}°`
}

// Compact weather strip — real forecast numbers for the day. Honest: only shows
// metrics the forecast actually returned.
function WeatherStrip({ w }: { w: DayWeather }) {
  const temp = tempLabel(w)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-white/45">
      <span className="text-white/55">{w.label}</span>
      {temp && (
        <span className="flex items-center gap-1">
          <Thermometer className="h-2.5 w-2.5" strokeWidth={1.75} />
          {temp}
        </span>
      )}
      {w.windMaxKmh != null && w.windMaxKmh >= 20 && (
        <span className="flex items-center gap-1">
          <Wind className="h-2.5 w-2.5" strokeWidth={1.75} />
          {Math.round(w.windMaxKmh)} km/u
        </span>
      )}
      {w.snowfallCm != null && w.snowfallCm > 0 ? (
        <span className="flex items-center gap-1">
          <CloudSnow className="h-2.5 w-2.5" strokeWidth={1.75} />
          {w.snowfallCm.toFixed(1)} cm
        </span>
      ) : (
        w.precipMm != null &&
        w.precipMm >= 1 && (
          <span className="flex items-center gap-1">
            <Droplets className="h-2.5 w-2.5" strokeWidth={1.75} />
            {Math.round(w.precipMm)} mm
          </span>
        )
      )}
    </div>
  )
}

// Weather coaching advisory — Sparki's read on how conditions affect the
// session. Only rendered when there's something worth saying (caution/severe).
function WeatherAdvisoryCard({ a }: { a: WeatherAdvisory }) {
  if (a.severity === "ok") return null
  const color = SEVERITY_COLOR[a.severity]
  return (
    <div
      className="mt-3 rounded-xl border p-3"
      style={{ borderColor: `${color.replace(/[\d.]+\)$/, "0.25)")}`, background: color.replace(/[\d.]+\)$/, "0.06)") }}
    >
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3 shrink-0" style={{ color }} strokeWidth={2} />
        <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color }}>
          {a.headline}
        </span>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-white/70">{a.detail}</p>
      {a.suggestion && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-white/55">
          <span className="text-white/40">Sparki: </span>
          {a.suggestion}
        </p>
      )}
    </div>
  )
}

// Weather-driven fuelling/hydration note for the day.
function WeatherNutritionCard({ a }: { a: WeatherNutritionAdvisory }) {
  if (!a.hydrationNote && !a.fuelNote) return null
  const color = SEVERITY_COLOR[a.severity]
  return (
    <div className="mt-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="flex items-center gap-1.5">
        <Utensils className="h-3 w-3 shrink-0" style={{ color }} strokeWidth={1.75} />
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/45">
          Voeding bij dit weer
        </span>
      </div>
      {a.hydrationNote && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-white/65">
          <Droplets className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300/60" strokeWidth={1.75} />
          {a.hydrationNote}
        </p>
      )}
      {a.fuelNote && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-white/65">
          <Utensils className="mt-0.5 h-3 w-3 shrink-0 text-white/40" strokeWidth={1.75} />
          {a.fuelNote}
        </p>
      )}
    </div>
  )
}

// Race-day weather at the *race location* (geocoded from the race's place).
// Honest about why it isn't available (too far out, no location, etc.).
function RaceWeatherCard({ rw }: { rw: RaceWeather }) {
  if (!rw.available) {
    const msg =
      rw.reason === "too_far"
        ? "Weersverwachting voor de wedstrijddag komt beschikbaar zodra die binnen ~16 dagen valt."
        : rw.reason === "no_location"
          ? "Voeg een locatie toe aan je wedstrijd om het weer ter plaatse te checken."
          : rw.reason === "geocode_failed"
            ? "Sparki kon de wedstrijdlocatie niet op de kaart vinden — controleer de plaatsnaam."
            : "Nog geen weersverwachting beschikbaar voor de wedstrijdlocatie."
    return (
      <div className="mt-3 flex items-start gap-1.5 border-t border-white/[0.06] pt-3 font-mono text-[10px] leading-relaxed text-white/35">
        <MapPin className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.75} />
        {msg}
      </div>
    )
  }
  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3">
      <div className="flex items-center gap-1.5">
        <MapPin className="h-3 w-3 shrink-0" style={{ color: ACCENT }} strokeWidth={1.75} />
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/45">
          Weer op wedstrijddag{rw.locationLabel ? ` · ${rw.locationLabel}` : ""}
        </span>
      </div>
      {rw.weather && (
        <div className="mt-2">
          <WeatherStrip w={rw.weather} />
        </div>
      )}
      {rw.advisory && <WeatherAdvisoryCard a={rw.advisory} />}
    </div>
  )
}

function CommittedDay({ day }: { day: PlanDay }) {
  const dayName = formatDay(day.dayDate)
  if (day.isRest) {
    return (
      <div className="flex items-center gap-4 border-b border-white/[0.05] py-3.5 last:border-0">
        <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wider text-white/30">
          {dayName}
        </span>
        <span className="text-[13px] text-white/40">Rust</span>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">
            {dayName}
          </span>
          <h4 className="mt-0.5 truncate font-sans text-[15px] font-light tracking-tight text-white/90">
            {day.workout?.title ?? day.focus}
          </h4>
        </div>
        {day.workout?.status === "completed" && (
          <span
            className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ color: ACCENT }}
          >
            voltooid
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-white/[0.06] pt-3">
        <Stat label="Focus" value={day.focus} />
        {day.estDurationMin != null && (
          <>
            <Divider />
            <Stat label="Duur" value={`${day.estDurationMin}m`} />
          </>
        )}
      </div>

      {day.intensityLabel && (
        <div className="mt-3 flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: intensityColor(day.intensityLabel) }}
          />
          <span className="font-mono text-[11px] text-white/55">
            {day.intensityLabel}
          </span>
        </div>
      )}

      {day.rationale && (
        <p className="mt-3 text-[12px] leading-relaxed text-white/60">
          {day.rationale}
        </p>
      )}

      {day.weather && (
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          <WeatherStrip w={day.weather} />
        </div>
      )}
      {day.trainingAdvisory && <WeatherAdvisoryCard a={day.trainingAdvisory} />}
      {day.nutritionAdvisory && (
        <WeatherNutritionCard a={day.nutritionAdvisory} />
      )}

      {day.route ? (
        <DayRouteMap routeId={day.route.id} />
      ) : (
        day.routeNeeded && (
          <p className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-white/30">
            <MapPin className="h-3 w-3" strokeWidth={1.75} />
            Geen route beschikbaar (stel je thuislocatie in voor automatische
            routes)
          </p>
        )
      )}
    </div>
  )
}

function PreviewDay({ day }: { day: PlanDay }) {
  const dayName = formatDay(day.dayDate)
  return (
    <div className="flex items-start gap-4 border-b border-white/[0.05] py-3 last:border-0">
      <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wider text-white/30">
        {dayName}
      </span>
      <div className="min-w-0 flex-1">
        {day.isRest ? (
          <span className="text-[13px] text-white/40">Rust</span>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: intensityColor(day.intensityLabel) }}
              />
              <span className="text-[13px] text-white/80">{day.focus}</span>
              {day.estDurationMin != null && (
                <span className="font-mono text-[10px] text-white/35">
                  {day.estDurationMin}m
                </span>
              )}
            </div>
            {day.adaptationReason && (
              <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-cyan-300/55">
                <RefreshCw className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                {day.adaptationReason}
              </p>
            )}
            {day.weather && <div className="mt-1.5"><WeatherStrip w={day.weather} /></div>}
            {day.trainingAdvisory && day.trainingAdvisory.severity !== "ok" && (
              <p
                className="mt-1 flex items-start gap-1 text-[11px] leading-snug"
                style={{ color: SEVERITY_COLOR[day.trainingAdvisory.severity] }}
              >
                <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0" strokeWidth={2} />
                {day.trainingAdvisory.headline}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

type HomeLocation = { lat: number; lon: number; label: string | null }

// Address search + map pin picker for the athlete's home location. Saving a
// home location is what lets Sparki attach real routes to committed days, so
// this lives directly in the setup flow. Search uses the ORS-backed geocoder;
// the map lets the athlete fine-tune by dropping a pin anywhere.
function HomeLocationField({
  value,
  onChange,
}: {
  value: HomeLocation | null
  onChange: (next: HomeLocation | null) => void
}) {
  const geocode = useGeocode()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setResults([])
      setSearched(false)
      return
    }
    geocode.mutate(trimmed, {
      onSuccess: (res) => {
        setResults(res.results)
        setSearched(true)
      },
    })
  }

  const onQueryChange = (q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(q), 450)
  }

  const pickResult = (r: GeocodeResult) => {
    onChange({ lat: r.lat, lon: r.lon, label: r.label })
    setResults([])
    setSearched(false)
    setQuery(r.label)
  }

  return (
    <div>
      <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
        THUISLOCATIE
      </label>
      <p className="mb-3 text-[12px] leading-relaxed text-white/45">
        Zoek je adres of zet een speld op de kaart. Dit vertrekpunt wordt
        gebruikt om automatisch routes bij je trainingen te plannen.
      </p>

      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30"
              strokeWidth={1.75}
            />
            <input
              className={`${inputClass} pl-9`}
              type="text"
              placeholder="Zoek adres of plaats"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  runSearch(query)
                }
              }}
            />
          </div>
        </div>

        {geocode.isPending && (
          <p className="mt-2 font-mono text-[10px] text-white/35">Zoeken…</p>
        )}
        {geocode.isError && (
          <p className="mt-2 font-mono text-[10px] text-orange-300/70">
            Zoeken lukte niet. Probeer opnieuw of zet een speld op de kaart.
          </p>
        )}
        {searched && !geocode.isPending && results.length === 0 && (
          <p className="mt-2 font-mono text-[10px] text-white/35">
            Geen plaats gevonden — zet een speld op de kaart.
          </p>
        )}

        {results.length > 0 && (
          <ul className="mt-2 max-h-44 overflow-auto rounded-xl border border-white/[0.1] bg-[#070d16]/95 backdrop-blur-md">
            {results.map((r, i) => (
              <li key={`${r.lat},${r.lon},${i}`}>
                <button
                  type="button"
                  onClick={() => pickResult(r)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-[13px] text-white/75 transition-colors hover:bg-white/[0.05]"
                >
                  <MapPin
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30"
                    strokeWidth={1.75}
                  />
                  <span className="leading-snug">{r.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3">
        <LocationPickerMap
          value={value ? { lat: value.lat, lon: value.lon } : null}
          onPick={(p) =>
            onChange({
              lat: p.lat,
              lon: p.lon,
              // A dropped pin has no place name; keep the searched label if the
              // pin is essentially the same spot, otherwise clear it.
              label:
                value &&
                Math.abs(value.lat - p.lat) < 0.0005 &&
                Math.abs(value.lon - p.lon) < 0.0005
                  ? value.label
                  : null,
            })
          }
        />
      </div>

      {value && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] text-white/45">
            <MapPin
              className="h-3 w-3 shrink-0"
              style={{ color: ACCENT }}
              strokeWidth={1.75}
            />
            <span className="truncate">
              {value.label ??
                `${value.lat.toFixed(4)}, ${value.lon.toFixed(4)}`}
            </span>
          </p>
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setQuery("")
              setResults([])
              setSearched(false)
            }}
            className="shrink-0 font-mono text-[10px] text-white/40 transition-colors hover:text-white/70"
          >
            wissen
          </button>
        </div>
      )}
    </div>
  )
}

function SetupForm({ data }: { data: TrainingPlanResponse }) {
  const save = useSavePlanSetup()
  const [experience, setExperience] = useState(
    data.inputs.experienceLevel ?? "intermediate",
  )
  const [hours, setHours] = useState(
    data.inputs.weeklyHourTarget ? String(data.inputs.weeklyHourTarget) : "",
  )
  const [load, setLoad] = useState(data.inputs.loadCapacity ?? "moderate")
  const [days, setDays] = useState<string[]>(data.inputs.availableDays ?? [])
  const [prefs, setPrefs] = useState(data.inputs.trainingPreferences ?? "")
  const [injuries, setInjuries] = useState(data.inputs.injuryHistory ?? "")
  const [home, setHome] = useState<HomeLocation | null>(
    data.inputs.homeLat != null && data.inputs.homeLon != null
      ? {
          lat: data.inputs.homeLat,
          lon: data.inputs.homeLon,
          label: data.inputs.homeLabel ?? null,
        }
      : null,
  )

  const toggleDay = (d: string) =>
    setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))

  const canSubmit = !!hours && Number(hours) > 0 && days.length > 0 && !!experience

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    save.mutate({
      experienceLevel: experience,
      weeklyHourTarget: Number(hours),
      loadCapacity: load,
      availableDays: days,
      trainingPreferences: prefs || null,
      injuryHistory: injuries || null,
      homeLat: home ? home.lat : null,
      homeLon: home ? home.lon : null,
      homeLabel: home ? home.label : null,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-col gap-5 rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-5 backdrop-blur-md"
    >
      <p className="text-[13px] leading-relaxed text-white/60">
        Een trainingsschema op maat wordt opgebouwd op basis van je profiel. Vul
        je gegevens in zodat volume, intensiteit en rust correct worden gepland.
      </p>

      <div>
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          ERVARING
        </label>
        <div className="grid grid-cols-4 gap-2">
          {EXPERIENCE.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setExperience(o.value)}
              className="rounded-xl border py-2 font-sans text-[12px] transition-colors"
              style={{
                borderColor:
                  experience === o.value
                    ? "rgba(120,210,230,0.5)"
                    : "rgba(255,255,255,0.1)",
                background:
                  experience === o.value
                    ? "rgba(120,210,230,0.12)"
                    : "transparent",
                color: experience === o.value ? ACCENT : "rgba(255,255,255,0.55)",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            UREN PER WEEK
          </label>
          <input
            className={inputClass}
            type="number"
            placeholder="bv. 8"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            min={1}
            max={40}
            step={0.5}
          />
        </div>
        <div>
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            BELASTBAARHEID
          </label>
          <select
            className={inputClass}
            value={load}
            onChange={(e) => setLoad(e.target.value)}
          >
            {LOAD.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          BESCHIKBARE TRAININGSDAGEN
        </label>
        <div className="flex gap-2">
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value)}
              className="flex-1 rounded-xl border py-2.5 font-mono text-[12px] transition-colors"
              style={{
                borderColor: days.includes(d.value)
                  ? "rgba(120,210,230,0.5)"
                  : "rgba(255,255,255,0.1)",
                background: days.includes(d.value)
                  ? "rgba(120,210,230,0.12)"
                  : "transparent",
                color: days.includes(d.value) ? ACCENT : "rgba(255,255,255,0.5)",
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        className={`${inputClass} resize-none`}
        placeholder="Trainingsvoorkeuren (optioneel) — bv. liever intervallen op dinsdag"
        rows={2}
        value={prefs}
        onChange={(e) => setPrefs(e.target.value)}
      />
      <textarea
        className={`${inputClass} resize-none`}
        placeholder="Blessurehistorie (optioneel)"
        rows={2}
        value={injuries}
        onChange={(e) => setInjuries(e.target.value)}
      />

      <HomeLocationField value={home} onChange={setHome} />

      <button
        type="submit"
        disabled={!canSubmit || save.isPending}
        className="rounded-2xl py-3.5 font-sans text-[13px] font-semibold disabled:opacity-50"
        style={{ background: ACCENT, color: "#040506" }}
      >
        {save.isPending ? "Opslaan…" : "Profiel opslaan"}
      </button>
    </form>
  )
}

export function TrainingPlanPanel() {
  const { data, isLoading } = useTrainingPlan()
  const generate = useGenerateTrainingPlan()
  const adapt = useAdaptTrainingPlan()

  const weekDays = useMemo(
    () => (data?.days ?? []).filter((d) => d.weekIndex === 0),
    [data],
  )
  const previewDays = useMemo(
    () => (data?.days ?? []).filter((d) => d.weekIndex > 0),
    [data],
  )

  if (isLoading) {
    return (
      <section>
        <SectionLabel n="04" title="Trainingsschema" />
        <div className="mt-4 h-24 animate-pulse rounded-2xl bg-white/[0.06]" />
      </section>
    )
  }
  if (!data) return null

  return (
    <section>
      <SectionLabel n="04" title="Trainingsschema" />

      {/* Coach advisory banner */}
      {data.hasCoach && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-3">
          <Info
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            style={{ color: ACCENT }}
            strokeWidth={1.75}
          />
          <p className="text-[12px] leading-relaxed text-white/65">
            Je hebt een coach. Sparki schrijft je trainingen niet zelf, maar geeft
            een <span className="text-white/85">vrijblijvend advies</span> dat je
            met je coach kunt bespreken.
          </p>
        </div>
      )}

      {/* Setup required */}
      {data.needsSetup ? (
        <SetupForm data={data} />
      ) : !data.plan ? (
        <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
          <Sparkles className="h-7 w-7" style={{ color: ACCENT }} strokeWidth={1.5} />
          <p className="max-w-sm text-[13px] leading-relaxed text-white/60">
            {data.hasCoach
              ? "Schema wordt opgesteld op basis van je profiel, herstel en wedstrijden."
              : "Compleet trainingsschema op basis van je profiel, herstel en wedstrijden — vaste weekstructuur plus drie weken vooruitblik."}
          </p>
          <button
            type="button"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="flex items-center gap-2 rounded-2xl px-6 py-3.5 font-sans text-[13px] font-semibold disabled:opacity-50"
            style={{ background: ACCENT, color: "#040506" }}
          >
            <Sparkles className="h-4 w-4" strokeWidth={2} />
            {generate.isPending ? "Schema bouwen…" : "Genereer mijn schema"}
          </button>
          {!data.hasHome && (
            <p className="font-mono text-[10px] text-white/30">
              Tip: stel je thuislocatie in je profiel in voor automatische routes.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Plan summary */}
          {data.plan.summary && (
            <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                <span className="font-mono text-[10px] tracking-[0.25em] text-cyan-300/80">
                  {data.plan.mode === "advisory" ? "ADVIES" : "JOUW SCHEMA"}
                </span>
              </div>
              <p className="mt-3 text-pretty text-[13px] leading-relaxed text-white/75">
                {data.plan.summary}
              </p>
              {data.inputs.nextRace && (
                <div className="mt-4 flex items-center gap-4 border-t border-white/[0.06] pt-3">
                  <Stat label="Volgende wedstrijd" value={data.inputs.nextRace.name} />
                  <Divider />
                  <Stat
                    label="Over"
                    value={`${data.inputs.nextRace.daysAway} dgn`}
                    accent
                  />
                </div>
              )}
              {data.raceWeather && (
                <RaceWeatherCard rw={data.raceWeather} />
              )}
            </div>
          )}

          {/* Honest plan metadata + lifecycle controls */}
          <PlanMetaCard plan={data.plan} />


          {/* Committed 7-day week */}
          <div className="mt-5">
            <div className="mb-3 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-white/40" strokeWidth={1.75} />
              <span className="font-mono text-[10px] tracking-[0.2em] text-white/40">
                {data.plan.mode === "advisory"
                  ? "ADVIES · KOMENDE 7 DAGEN"
                  : "VASTE WEEK · 7 DAGEN"}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {weekDays.map((d) => (
                <CommittedDay key={d.id} day={d} />
              ))}
            </div>
          </div>

          {/* Provisional preview */}
          {previewDays.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.2em] text-white/40">
                  VOORUITBLIK · VOORLOPIG
                </span>
                <button
                  type="button"
                  onClick={() => adapt.mutate()}
                  disabled={adapt.isPending}
                  className="flex items-center gap-1.5 font-mono text-[10px] text-cyan-300/60 transition hover:text-cyan-300 disabled:opacity-40"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${adapt.isPending ? "animate-spin" : ""}`}
                  />
                  {adapt.isPending ? "aanpassen…" : "aanpassen aan herstel"}
                </button>
              </div>
              {adapt.data?.note && (
                <p className="mb-2 text-[11px] text-white/45">{adapt.data.note}</p>
              )}
              <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.6] p-4 backdrop-blur-md">
                {previewDays.map((d) => (
                  <PreviewDay key={d.id} day={d} />
                ))}
              </div>
              <p className="mt-2 flex items-start gap-1.5 font-mono text-[10px] leading-snug text-white/30">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                Deze weken zijn een voorlopige vooruitblik en bewegen mee met je
                herstel en wedstrijden.
              </p>
            </div>
          )}

          {/* Regenerate */}
          <div className="ds-actiebalk mt-5">
            <button
              type="button"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.15] py-3.5 font-sans text-[13px] font-medium text-white/50 transition-colors hover:border-cyan-300/30 hover:text-cyan-300/60 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${generate.isPending ? "animate-spin" : ""}`}
                strokeWidth={2}
              />
              {generate.isPending ? "Opnieuw bouwen…" : "Schema opnieuw genereren"}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
