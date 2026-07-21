import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { trackScreen } from "@/lib/telemetry"
import { SectionLabel, Stat, Divider, ACCENT } from "@/components/sparki/ui"
import { RouteMap } from "@/components/sparki/route-map"
import {
  useRoutes,
  useCreateRoute,
  useDeleteRoute,
  useGenerateRoute,
  useGenerateRouteOptions,
  useSaveGeneratedRoute,
  useDownloadRoute,
  useDownloadCandidate,
  useShareRoute,
  canShareRouteFiles,
  type RouteExportFormat,
  type SparkiRoute,
  type Sport,
  type BikeType,
  type ElevationPreference,
  type RouteCandidate,
  type RouteWaypoint,
  type RouteMeetpoint,
  type RouteClimb,
} from "@/hooks/use-routes"
import { useUpcomingWorkouts } from "@/hooks/use-today-workout"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { isSportActive } from "@workspace/feature-flags"
import { MapPin, Sparkles, Flag, Users, X, Download, Smartphone, Navigation, Share2 } from "lucide-react"
import { RouteNavigator } from "@/components/sparki/route-navigator"
import { ElevationProfile } from "@/components/sparki/elevation-profile"
import { useRouteInsight } from "@/hooks/use-routes"

// Editable list of named meeting points ("verzamelpunten") — e.g. where you
// pick up a friend. Shared by the interactive builder and the generated-route
// preview so both can drop pickup spots.
function MeetpointList({
  meetpoints,
  setMeetpoints,
}: {
  meetpoints: RouteMeetpoint[]
  setMeetpoints: Dispatch<SetStateAction<RouteMeetpoint[]>>
}) {
  if (meetpoints.length === 0) return null
  return (
    <div className="mt-3 flex flex-col gap-2">
      {meetpoints.map((mp, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2"
        >
          <Users
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "rgba(255,160,90,0.9)" }}
            strokeWidth={1.75}
          />
          <input
            className="min-w-0 flex-1 bg-transparent font-sans text-[13px] text-white/90 placeholder:text-white/25 focus:outline-none"
            value={mp.name}
            placeholder="Naam verzamelpunt"
            onChange={(e) =>
              setMeetpoints((m) =>
                m.map((x, idx) =>
                  idx === i ? { ...x, name: e.target.value } : x,
                ),
              )
            }
          />
          <button
            type="button"
            onClick={() =>
              setMeetpoints((m) => m.filter((_, idx) => idx !== i))
            }
            className="shrink-0 text-white/30 transition hover:text-[rgba(255,140,120,0.85)]"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  )
}

const SURFACE_LABEL: Record<string, string> = {
  asfalt: "Asfalt",
  gravel: "Gravel",
  mtb: "MTB",
  mixed: "Gemengd",
  pad: "Pad/trail",
  unknown: "Onbekend",
}

// Phased rollout: only sports whose family is active in the shared registry are
// offered. Foot sports stay defined here (the routing engine supports them) but
// are filtered out until their sport family is activated.
const ALL_SPORT_OPTIONS: { value: Sport; label: string; hint: string }[] = [
  { value: "cycling", label: "Fietsen", hint: "weg/onverhard" },
  { value: "running", label: "Hardlopen", hint: "weg/trail" },
  { value: "walking", label: "Wandelen", hint: "verhard" },
  { value: "hiking", label: "Hiken", hint: "paden" },
]
const SPORT_OPTIONS = ALL_SPORT_OPTIONS.filter((s) => isSportActive(s.value))

const BIKE_OPTIONS: { value: BikeType; label: string; hint: string }[] = [
  { value: "racefiets", label: "Racefiets", hint: "asfalt" },
  { value: "gravel", label: "Gravel", hint: "gemengd" },
  { value: "mtb", label: "MTB", hint: "onverhard" },
]

// Honest derivation: map the athlete's real profile discipline to the bike type
// the routing profile should use — the same mapping the plan engine uses. Returns
// null when the discipline gives no clear signal, so Sparki never guesses.
function disciplineToBikeType(discipline: string | null): BikeType | null {
  if (!discipline) return null
  const d = discipline.toLowerCase()
  if (d.includes("mtb") || d.includes("mountain") || d.includes("atb"))
    return "mtb"
  if (d.includes("gravel") || d.includes("cross") || d.includes("cx"))
    return "gravel"
  if (
    d.includes("weg") ||
    d.includes("road") ||
    d.includes("race") ||
    d.includes("baan") ||
    d.includes("crit") ||
    d.includes("tijdrit") ||
    d.includes("klassiek")
  )
    return "racefiets"
  return null
}

const ELEVATION_OPTIONS: {
  value: ElevationPreference
  label: string
}[] = [
  { value: "any", label: "Geen voorkeur" },
  { value: "flat", label: "Vlak" },
  { value: "hilly", label: "Heuvelachtig" },
]

const TRAINING_OPTIONS = [
  "duurtraining",
  "interval",
  "hersteltraining",
  "tempo",
  "anders",
]

// Estimated moving time → compact "1u 23m" / "45m" label.
function formatDuration(sec: number | null): string {
  if (sec == null) return "—"
  const total = Math.round(sec / 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h}u ${m}m` : `${m}m`
}

function Climbs({ climbs }: { climbs: RouteClimb[] }) {
  if (climbs.length === 0) return null
  return (
    <div className="mt-4">
      <span className="label-xs text-white/35">KLIMMEN</span>
      <div className="mt-2 flex flex-col">
        {climbs.map((c, i) => (
          <div
            key={i}
            className="flex items-baseline gap-3 border-b border-white/[0.05] py-2 last:border-0"
          >
            <div className="flex-1">
              <span className="text-[13px] tracking-tight text-white/85">
                {c.name}
              </span>
              {Number.isFinite(c.summitKm) && (
                <span className="ml-2 font-mono text-[10px] tabular-nums text-white/35">
                  top op {c.summitKm} km
                </span>
              )}
            </div>
            <span className="font-mono text-[11px] tabular-nums text-white/45">
              {c.lengthKm} km
            </span>
            <span
              className="font-mono text-[11px] tabular-nums"
              style={{ color: ACCENT }}
            >
              {c.avgGradePct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Route-paspoort: honest, real facts about the route — grade split from the
// stored elevation profile, live weather at the chosen departure hour, and
// environment (traffic lights, forest share) from OpenStreetMap. Blocks whose
// source can't answer show a plain-Dutch gap; nothing is invented.
function RoutePassport({
  route,
  onAdjust,
}: {
  route: SparkiRoute
  onAdjust?: (pref: ElevationPreference) => void
}) {
  // Default departure: next full hour, as datetime-local value.
  const [departAt, setDepartAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60_000)
    d.setMinutes(0, 0, 0)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
  })
  const { data, isLoading, isError } = useRouteInsight(
    route.id,
    departAt ? new Date(departAt).toISOString() : null,
  )
  const insight = data?.insight

  const rows: { label: string; value: string }[] = []
  if (insight?.grade) {
    rows.push(
      { label: "Vlak", value: `${insight.grade.flatKm} km` },
      { label: "Stijgend", value: `${insight.grade.upKm} km` },
      { label: "Dalend", value: `${insight.grade.downKm} km` },
    )
  }
  const w = insight?.weather
  if (w) {
    if (w.windBft != null || w.windKmh != null) {
      rows.push({
        label: "Wind",
        value: [
          w.windBft != null ? `${w.windBft} Bft` : null,
          w.windDirLabel ? `uit het ${w.windDirLabel}en` : null,
          w.windKmh != null ? `(${Math.round(w.windKmh)} km/u)` : null,
        ]
          .filter(Boolean)
          .join(" "),
      })
    }
    if (w.tempC != null)
      rows.push({ label: "Temperatuur", value: `${Math.round(w.tempC)} °C` })
    if (w.uvIndex != null)
      rows.push({ label: "Zonkracht (UV)", value: `${Math.round(w.uvIndex)}` })
    if (w.precipProbPct != null)
      rows.push({ label: "Kans op neerslag", value: `${w.precipProbPct}%` })
  }
  const env = insight?.environment
  if (env) {
    if (env.trafficLights != null)
      rows.push({
        label: "Verkeerslichten",
        value: `${env.trafficLights} op de route`,
      })
    if (env.forestSharePct != null)
      rows.push({
        label: "Door bos",
        value: `±${env.forestSharePct}% (indicatie)`,
      })
  }

  return (
    <div className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.03] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label-xs text-white/35">ROUTE-PASPOORT</span>
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
          Vertrek
          <input
            type="datetime-local"
            value={departAt}
            onChange={(e) => setDepartAt(e.target.value)}
            className="rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-1 font-sans text-[12px] text-white/80 focus:border-cyan-300/40 focus:outline-none [color-scheme:dark]"
          />
        </label>
      </div>

      {isLoading ? (
        <p className="mt-3 text-[12px] text-white/35">Feiten worden opgehaald…</p>
      ) : isError ? (
        <p className="mt-3 text-[12px] text-white/35">
          Het route-paspoort kon nu niet worden opgehaald. Probeer het later
          opnieuw.
        </p>
      ) : rows.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {rows.map((r) => (
            <div key={r.label} className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
                {r.label}
              </p>
              <p className="break-words text-[13px] tracking-tight text-white/85">
                {r.value}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-white/35">
          Voor deze route zijn nog geen feiten beschikbaar — er is geen
          hoogteprofiel of routegeometrie opgeslagen.
        </p>
      )}

      {insight && !insight.weather && insight.hasGeometry && !isLoading && (
        <p className="mt-2 text-[11px] text-white/30">
          Weerbericht voor dit tijdstip is nog niet beschikbaar (maximaal ±15
          dagen vooruit).
        </p>
      )}
      {insight && insight.environment == null && !isLoading && (
        <p className="mt-2 text-[11px] text-white/30">
          Verkeerslichten en bos-aandeel konden nu niet worden opgehaald uit
          OpenStreetMap.
        </p>
      )}

      {onAdjust && route.source === "gegenereerd" && (
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          <p className="text-[11px] text-white/40">
            Past dit niet? Bouw een nieuwe route met een andere voorkeur:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onAdjust("flat")}
              className="rounded-full border border-white/[0.12] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/60 transition hover:border-cyan-300/40 hover:text-cyan-300"
            >
              Vlakker
            </button>
            <button
              type="button"
              onClick={() => onAdjust("hilly")}
              className="rounded-full border border-white/[0.12] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/60 transition hover:border-cyan-300/40 hover:text-cyan-300"
            >
              Meer klimmen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function RouteCard({
  route,
  onAdjust,
}: {
  route: SparkiRoute
  onAdjust?: (pref: ElevationPreference) => void
}) {
  const del = useDeleteRoute()
  const download = useDownloadRoute()
  const share = useShareRoute()
  const [gpxError, setGpxError] = useState<string | null>(null)
  const [navigating, setNavigating] = useState(false)
  const [showPassport, setShowPassport] = useState(false)
  const profile = route.profile ?? []
  const climbs = route.climbs ?? []
  const nav = route.nav ?? []
  const geometry = route.geometry ?? []
  const canExport = geometry.length > 1
  const canNavigate = geometry.length > 1

  function exportRoute(format: RouteExportFormat) {
    setGpxError(null)
    download.mutate(
      { id: route.id, name: route.name, format },
      {
        onError: (e) =>
          setGpxError(e instanceof Error ? e.message : "Download mislukt"),
      },
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-[9px] uppercase tracking-[0.18em]"
              style={{ color: ACCENT }}
            >
              {route.status === "ready" ? "Klaar" : route.status}
            </span>
            <span className="font-mono text-[9px] uppercase text-white/25">
              · {route.source}
            </span>
          </div>
          <h3 className="mt-1 truncate font-sans text-lg font-light tracking-tight text-white/90">
            {route.name}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {canNavigate && (
            <button
              type="button"
              onClick={() => setNavigating(true)}
              title="Open het navigatievenster — volgt je live positie op de kaart"
              className="flex items-center gap-1.5 rounded-full bg-cyan-400/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#05070e] transition hover:bg-cyan-300"
            >
              <Navigation className="h-3.5 w-3.5" strokeWidth={2} />
              Navigeer
            </button>
          )}
          {canExport && (
            <div className="flex items-center gap-2.5">
              {canShareRouteFiles() && (
                <button
                  type="button"
                  onClick={() => {
                    setGpxError(null)
                    share.mutate(
                      { id: route.id, name: route.name, format: "gpx" },
                      {
                        onError: (e) =>
                          setGpxError(
                            e instanceof Error
                              ? e.message
                              : "Delen mislukt",
                          ),
                      },
                    )
                  }}
                  disabled={share.isPending}
                  title="Stuur de route met één tik naar je navigatie-app (Garmin Connect, Komoot, Wahoo…)"
                  className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 transition hover:text-cyan-300/80 disabled:opacity-40"
                >
                  <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Naar app
                </button>
              )}
              <button
                type="button"
                onClick={() => exportRoute("gpx")}
                disabled={download.isPending}
                title="Download als GPX voor je fietscomputer"
                className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 transition hover:text-cyan-300/80 disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                GPX
              </button>
              <button
                type="button"
                onClick={() => exportRoute("tcx")}
                disabled={download.isPending}
                title="Download als TCX-course — meest betrouwbare navigatie op Garmin/Wahoo"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 transition hover:text-cyan-300/80 disabled:opacity-40"
              >
                TCX
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => del.mutate(route.id)}
            disabled={del.isPending}
            className="font-mono text-[10px] text-white/30 transition hover:text-white/60 disabled:opacity-40"
          >
            wis
          </button>
        </div>
      </div>

      {gpxError && (
        <p className="mt-2 text-[11px] text-[rgba(255,140,120,0.85)]">
          {gpxError}
        </p>
      )}

      {geometry.length > 1 && (
        <RouteMap geometry={geometry} climbs={climbs} className="mt-4" />
      )}

      {profile.length > 0 && (
        <ElevationProfile profile={profile} distanceKm={route.distanceKm} />
      )}

      <button
        type="button"
        onClick={() => setShowPassport((s) => !s)}
        className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] transition"
        style={{ color: ACCENT }}
      >
        {showPassport ? "− route-paspoort" : "+ route-paspoort"}
      </button>
      {showPassport && <RoutePassport route={route} onAdjust={onAdjust} />}

      <div className="mt-4 flex items-center gap-5 border-t border-white/[0.07] pt-4">
        <Stat
          label="Afstand"
          value={route.distanceKm != null ? `${route.distanceKm} km` : "—"}
        />
        <Divider />
        <Stat label="Duur" value={formatDuration(route.durationSec)} />
        <Divider />
        <Stat
          label="Hoogtemeters"
          value={route.elevationGainM != null ? `${route.elevationGainM} m` : "—"}
        />
        <Divider />
        <Stat label="Ondergrond" value={SURFACE_LABEL[route.surface] ?? route.surface} />
      </div>

      <Climbs climbs={climbs} />

      {route.rationale && (
        <p className="mt-4 whitespace-pre-line text-[12px] leading-relaxed text-white/55">
          {route.rationale}
        </p>
      )}

      {nav.length > 0 ? (
        <div className="mt-4 flex flex-col">
          {nav.map((n, i) => (
            <div
              key={i}
              className="flex items-baseline gap-3 border-b border-white/[0.05] py-2.5 last:border-0"
            >
              <span className="w-12 shrink-0 font-mono text-[11px] tabular-nums text-cyan-300/70">
                {n.km}
              </span>
              <span className="w-20 shrink-0 break-words text-[13px] tracking-tight text-white/85">
                {n.dir}
              </span>
              <span className="min-w-0 flex-1 break-words text-[12px] text-white/40">
                {n.note}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-[12px] text-white/30">
          Stap-voor-stap navigatie nog niet beschikbaar voor deze route
        </p>
      )}

      <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
        <Smartphone
          className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300/70"
          strokeWidth={1.75}
        />
        <p className="text-[12px] leading-relaxed text-white/50">
          <span className="text-white/75">Onderweg navigeren?</span> Tik op{" "}
          <span className="text-white/75">Navigeer</span> om hier op de kaart je
          live positie te volgen — je browser vraagt eenmalig toegang tot je
          locatie. Wil je de rit als training opnemen op de achtergrond? Dat doe
          je in de Sparki-app op je telefoon. Of download de route hierboven als
          GPX/TCX voor je fietscomputer.
        </p>
      </div>

      {navigating && (
        <RouteNavigator
          name={route.name}
          geometry={geometry}
          nav={nav}
          distanceKm={route.distanceKm ?? null}
          routeId={route.id}
          onClose={() => setNavigating(false)}
        />
      )}
    </div>
  )
}

const inputClass =
  "w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"

function RouteGenerator({
  onClose,
  initialElevation = null,
}: {
  onClose: () => void
  initialElevation?: ElevationPreference | null
}) {
  const generate = useGenerateRoute()
  const genOptions = useGenerateRouteOptions()
  const save = useSaveGeneratedRoute()
  const candidateDownload = useDownloadCandidate()
  const { data: workouts } = useUpcomingWorkouts()
  const { data: dashboard } = useAthleteDashboard()

  const [mode, setMode] = useState<"loop" | "ptp" | "waypoints">("loop")
  const [sport, setSport] = useState<Sport>("cycling")
  const [bikeType, setBikeType] = useState<BikeType>("racefiets")
  // Sparki pre-selects the fietstype from the athlete's real profile discipline
  // (honest derivation, not a guess). Once the rider touches it, we never
  // override their choice. `derivedBike` also drives the honest "Sparki koos …"
  // note so the rider sees why this option is selected.
  const [bikeTouched, setBikeTouched] = useState(false)
  const derivedBike = disciplineToBikeType(
    dashboard?.athleteProfile?.discipline ?? null,
  )
  function chooseBike(value: BikeType) {
    setBikeTouched(true)
    setBikeType(value)
  }
  useEffect(() => {
    if (bikeTouched || !derivedBike) return
    setBikeType(derivedBike)
  }, [derivedBike, bikeTouched])
  const [elevationPreference, setElevationPreference] =
    useState<ElevationPreference>(initialElevation ?? "any")
  const [trainingType, setTrainingType] = useState("duurtraining")
  const [workoutId, setWorkoutId] = useState<string>("")
  const [distance, setDistance] = useState("40")
  const [distanceTouched, setDistanceTouched] = useState(false)
  const [wish, setWish] = useState("")
  const [destination, setDestination] = useState("")
  const [start, setStart] = useState<{ lat: number; lon: number } | null>(null)
  const [geoState, setGeoState] = useState<"idle" | "loading" | "error">("idle")
  const [candidate, setCandidate] = useState<RouteCandidate | null>(null)
  // Loop mode: the 3 distance variants (korter/gevraagd/langer) to choose from.
  const [options, setOptions] = useState<RouteCandidate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Seed the default loop distance from the training plan (nearest planned
  // session's duration) instead of a fixed 40 km. It's only an editable
  // starting suggestion — a route linked to a workout still derives its true
  // distance server-side.
  useEffect(() => {
    if (distanceTouched) return
    const list = workouts ?? []
    const today = new Date().toISOString().split("T")[0]!
    const upcoming = list
      .filter((w) => w.targetDurationMin && w.scheduledDate >= today)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0]
    const nearest =
      upcoming ??
      list
        .filter((w) => w.targetDurationMin)
        .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))[0]
    if (nearest?.targetDurationMin) {
      const kmh = sport === "running" ? 11 : 28
      const km = Math.max(
        3,
        Math.min(200, Math.round((nearest.targetDurationMin / 60) * kmh)),
      )
      setDistance(String(km))
    }
  }, [workouts, sport, distanceTouched])

  // Interactive builder state (mode === "waypoints").
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([])
  const [meetpoints, setMeetpoints] = useState<RouteMeetpoint[]>([])
  const [placeMode, setPlaceMode] = useState<"waypoint" | "meetpoint">(
    "waypoint",
  )

  const linkedWorkout = workoutId
    ? workouts?.find((w) => String(w.id) === workoutId)
    : undefined

  function useMyLocation() {
    setGeoState("loading")
    setError(null)
    if (!navigator.geolocation) {
      setGeoState("error")
      setError("Geolocatie wordt niet ondersteund door je browser")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStart({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setGeoState("idle")
      },
      () => {
        setGeoState("error")
        setError("Kon je locatie niet ophalen — geef toestemming of vul handmatig in")
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  // Loop mode: ask Sparki for THREE distance variants at once (korter/gevraagd/
  // langer). The rider picks one, which then flows into the normal candidate
  // preview + save. A→B and eigen-route modes stay single (their distance is
  // fixed by the destination / placed points).
  function runGenerateOptions() {
    setError(null)
    setSaved(false)
    setCandidate(null)
    setOptions(null)
    if (!start) {
      setError("Kies eerst een startpunt (gebruik je locatie)")
      return
    }
    const distNum = parseInt(distance)
    genOptions.mutate(
      {
        mode: "loop",
        startLat: start.lat,
        startLon: start.lon,
        sport,
        bikeType: sport === "cycling" ? bikeType : undefined,
        elevationPreference,
        trainingType,
        plannedWorkoutId: linkedWorkout ? linkedWorkout.id : undefined,
        targetDistanceKm:
          !linkedWorkout && Number.isFinite(distNum) ? distNum : undefined,
        wish: wish.trim() ? wish.trim() : undefined,
      },
      {
        onSuccess: (data) => setOptions(data.options),
        onError: (e) =>
          setError(e instanceof Error ? e.message : "Routegeneratie mislukt"),
      },
    )
  }

  function runGenerate(nextSeed?: number) {
    setError(null)
    setSaved(false)
    if (mode === "waypoints") {
      if (waypoints.length < 2) {
        setError("Plaats minstens twee routepunten op de kaart")
        return
      }
    } else {
      if (!start) {
        setError("Kies eerst een startpunt (gebruik je locatie)")
        return
      }
      if (mode === "ptp" && !destination.trim()) {
        setError("Vul een bestemming in voor een A→B route")
        return
      }
    }
    const distNum = parseInt(distance)
    generate.mutate(
      {
        mode,
        startLat: start?.lat,
        startLon: start?.lon,
        sport,
        bikeType: sport === "cycling" ? bikeType : undefined,
        elevationPreference,
        trainingType,
        plannedWorkoutId: linkedWorkout ? linkedWorkout.id : undefined,
        targetDistanceKm:
          mode === "loop" && !linkedWorkout && Number.isFinite(distNum)
            ? distNum
            : undefined,
        destinationText: mode === "ptp" ? destination.trim() : undefined,
        waypoints: mode === "waypoints" ? waypoints : undefined,
        seed: nextSeed,
        wish: wish.trim() ? wish.trim() : undefined,
      },
      {
        onSuccess: (data) => setCandidate(data.candidate),
        onError: (e) =>
          setError(e instanceof Error ? e.message : "Routegeneratie mislukt"),
      },
    )
  }

  function saveCandidate() {
    if (!candidate) return
    save.mutate(
      { candidate, meetpoints },
      {
        onSuccess: () => {
          setSaved(true)
          setCandidate(null)
          setOptions(null)
          setWaypoints([])
          setMeetpoints([])
        },
        onError: (e) =>
          setError(e instanceof Error ? e.message : "Opslaan mislukt"),
      },
    )
  }

  // Drop a named meeting point ("verzamelpunt") — e.g. a spot to pick up a
  // friend — independent of the route-shaping waypoints.
  function addMeetpoint(lat: number, lon: number) {
    setMeetpoints((m) => [
      ...m,
      { lat, lon, name: `Verzamelpunt ${m.length + 1}`, note: null },
    ])
  }

  // Builder: a map click adds either a route-shaping waypoint or a meetpoint,
  // depending on the active place-mode.
  function handleMapClick(lat: number, lon: number) {
    if (placeMode === "waypoint") {
      setWaypoints((w) => [...w, [lat, lon]])
    } else {
      addMeetpoint(lat, lon)
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={1.75} />
          <span className="font-mono text-[10px] tracking-[0.22em] text-cyan-300/80">
            ROUTE GENEREREN
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[10px] text-white/35 transition hover:text-white/60"
        >
          sluit
        </button>
      </div>

      {/* Sport — only shown when more than one sport family is active */}
      {SPORT_OPTIONS.length > 1 && (
      <div className="mt-5">
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          SPORT
        </label>
        <div className="grid grid-cols-4 gap-2">
          {SPORT_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSport(s.value)}
              className="flex flex-col items-center rounded-xl border py-2.5 transition-colors"
              style={{
                borderColor:
                  sport === s.value
                    ? "rgba(120,210,230,0.5)"
                    : "rgba(255,255,255,0.1)",
                background:
                  sport === s.value ? "rgba(120,210,230,0.12)" : "transparent",
              }}
            >
              <span
                className="text-[12px] font-medium"
                style={{
                  color: sport === s.value ? ACCENT : "rgba(255,255,255,0.6)",
                }}
              >
                {s.label}
              </span>
              <span className="font-mono text-[8px] text-white/30">{s.hint}</span>
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Bike type — only for cycling; Sparki auto-selects the routing profile */}
      {sport === "cycling" && (
        <div className="mt-4">
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            FIETSTYPE
          </label>
          {derivedBike && !bikeTouched && (
            <p className="mb-2 text-[11px] leading-relaxed text-cyan-300/55">
              Sparki koos dit op basis van je discipline. Pas aan als je vandaag
              een andere fiets pakt.
            </p>
          )}
          <div className="flex gap-2">
            {BIKE_OPTIONS.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => chooseBike(b.value)}
                className="flex flex-1 flex-col items-center rounded-xl border py-2.5 transition-colors"
                style={{
                  borderColor:
                    bikeType === b.value
                      ? "rgba(120,210,230,0.5)"
                      : "rgba(255,255,255,0.1)",
                  background:
                    bikeType === b.value
                      ? "rgba(120,210,230,0.12)"
                      : "transparent",
                }}
              >
                <span
                  className="text-[13px] font-medium"
                  style={{
                    color:
                      bikeType === b.value ? ACCENT : "rgba(255,255,255,0.6)",
                  }}
                >
                  {b.label}
                </span>
                <span className="font-mono text-[9px] text-white/30">
                  {b.hint}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Elevation preference */}
      <div className="mt-4">
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          HOOGTEVOORKEUR
        </label>
        <div className="flex gap-2">
          {ELEVATION_OPTIONS.map((e) => (
            <button
              key={e.value}
              type="button"
              onClick={() => setElevationPreference(e.value)}
              className="flex-1 rounded-xl border py-2.5 text-[13px] transition-colors"
              style={{
                borderColor:
                  elevationPreference === e.value
                    ? "rgba(120,210,230,0.5)"
                    : "rgba(255,255,255,0.1)",
                background:
                  elevationPreference === e.value
                    ? "rgba(120,210,230,0.12)"
                    : "transparent",
                color:
                  elevationPreference === e.value
                    ? ACCENT
                    : "rgba(255,255,255,0.6)",
              }}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="mt-4">
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          VORM
        </label>
        <div className="flex gap-2">
          {(
            [
              { v: "loop", l: "Lus (rondje)" },
              { v: "ptp", l: "A → B" },
              { v: "waypoints", l: "Eigen route" },
            ] as const
          ).map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => setMode(m.v)}
              className="flex-1 rounded-xl border py-2.5 text-[13px] transition-colors"
              style={{
                borderColor:
                  mode === m.v ? "rgba(120,210,230,0.5)" : "rgba(255,255,255,0.1)",
                background: mode === m.v ? "rgba(120,210,230,0.12)" : "transparent",
                color: mode === m.v ? ACCENT : "rgba(255,255,255,0.6)",
              }}
            >
              {m.l}
            </button>
          ))}
        </div>
      </div>

      {/* Training type + workout link */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            TRAININGSTYPE
          </label>
          <select
            className={inputClass}
            value={trainingType}
            onChange={(e) => setTrainingType(e.target.value)}
            disabled={!!linkedWorkout}
          >
            {TRAINING_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            KOPPEL TRAINING
          </label>
          <select
            className={inputClass}
            value={workoutId}
            onChange={(e) => {
              setWorkoutId(e.target.value)
              const w = workouts?.find((x) => String(x.id) === e.target.value)
              if (w) setTrainingType(w.type || trainingType)
            }}
          >
            <option value="">Geen</option>
            {(workouts ?? []).map((w) => (
              <option key={w.id} value={String(w.id)}>
                {w.scheduledDate} · {w.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Distance (loop, manual) */}
      {mode === "loop" && (
        <div className="mt-4">
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            DOELAFSTAND (KM)
          </label>
          <input
            className={inputClass}
            type="number"
            min={3}
            max={200}
            value={linkedWorkout?.targetDurationMin ? "" : distance}
            placeholder={
              linkedWorkout?.targetDurationMin
                ? `≈ afgeleid uit ${linkedWorkout.targetDurationMin}m training`
                : "40"
            }
            onChange={(e) => {
              setDistanceTouched(true)
              setDistance(e.target.value)
            }}
            disabled={!!linkedWorkout?.targetDurationMin}
          />
          {!linkedWorkout?.targetDurationMin && !distanceTouched && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/35">
              Geschat op basis van je geplande trainingsduur — pas gerust aan.
            </p>
          )}
        </div>
      )}

      {/* Destination (ptp) */}
      {mode === "ptp" && (
        <div className="mt-4">
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            BESTEMMING
          </label>
          <input
            className={inputClass}
            placeholder="bijv. Valkenburg"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
        </div>
      )}

      {/* Start location — loop/ptp only */}
      {mode !== "waypoints" && (
        <div className="mt-4">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={geoState === "loading"}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.12] py-3 font-sans text-[13px] text-white/70 transition-colors hover:border-cyan-300/30 disabled:opacity-50"
          >
            <MapPin className="h-4 w-4" strokeWidth={1.75} />
            {geoState === "loading"
              ? "Locatie ophalen…"
              : start
                ? `Startpunt: ${start.lat.toFixed(4)}, ${start.lon.toFixed(4)}`
                : "Gebruik mijn locatie"}
          </button>
        </div>
      )}

      {/* Interactive builder — waypoints + verzamelpunten */}
      {mode === "waypoints" && (
        <div className="mt-4">
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            TEKEN JE EIGEN ROUTE
          </label>
          <div className="flex gap-2">
            {(
              [
                { v: "waypoint", l: "Routepunt", icon: Flag },
                { v: "meetpoint", l: "Verzamelpunt", icon: Users },
              ] as const
            ).map((p) => {
              const active = placeMode === p.v
              const Icon = p.icon
              return (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setPlaceMode(p.v)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-[13px] transition-colors"
                  style={{
                    borderColor: active
                      ? "rgba(120,210,230,0.5)"
                      : "rgba(255,255,255,0.1)",
                    background: active
                      ? "rgba(120,210,230,0.12)"
                      : "transparent",
                    color: active ? ACCENT : "rgba(255,255,255,0.6)",
                  }}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {p.l}
                </button>
              )
            })}
          </div>

          <p className="mt-2 text-[12px] leading-relaxed text-white/40">
            {placeMode === "waypoint"
              ? "Tik op de kaart om routepunten te plaatsen. Sleep een punt om het te verplaatsen, tik erop om het te verwijderen. Sparki berekent de échte route via de wegen."
              : "Tik op de kaart om een verzamelpunt te plaatsen (bijv. clubhuis of café). Verzamelpunten bepalen niet de route — ze markeren waar je samenkomt."}
          </p>

          <RouteMap
            geometry={candidate?.geometry ?? []}
            waypoints={waypoints}
            meetpoints={meetpoints}
            center={start ? [start.lat, start.lon] : [52.1, 5.3]}
            height={320}
            className="mt-3"
            onMapClick={handleMapClick}
            onWaypointDrag={(i, lat, lon) =>
              setWaypoints((w) =>
                w.map((p, idx) => (idx === i ? [lat, lon] : p)),
              )
            }
            onWaypointClick={(i) =>
              setWaypoints((w) => w.filter((_, idx) => idx !== i))
            }
            onMeetpointClick={(i) =>
              setMeetpoints((m) => m.filter((_, idx) => idx !== i))
            }
          />

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={geoState === "loading"}
              className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50 transition hover:text-white/80 disabled:opacity-50"
            >
              <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
              {geoState === "loading" ? "Locatie…" : "Centreer op mij"}
            </button>
            <span className="font-mono text-[10px] text-white/40">
              {waypoints.length} routepunt{waypoints.length === 1 ? "" : "en"} ·{" "}
              {meetpoints.length} verzamelpunt
              {meetpoints.length === 1 ? "" : "en"}
            </span>
            {(waypoints.length > 0 || meetpoints.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setWaypoints([])
                  setMeetpoints([])
                  setCandidate(null)
                }}
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40 transition hover:text-[rgba(255,140,120,0.85)]"
              >
                wis alles
              </button>
            )}
          </div>

          {/* Editable meeting-point list */}
          <MeetpointList meetpoints={meetpoints} setMeetpoints={setMeetpoints} />
        </div>
      )}

      {/* Free-text wish — applies to every mode */}
      <div className="mt-4">
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          SPECIFIEKE WENS (OPTIONEEL)
        </label>
        <textarea
          className={`${inputClass} min-h-[76px] resize-y`}
          placeholder="bijv. 'zoveel mogelijk langs het water' of 'liever rustige wegen'"
          maxLength={400}
          value={wish}
          onChange={(e) => setWish(e.target.value)}
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/35">
          Sparki houdt hier rekening mee. Kan een wens niet worden ingevuld, dan
          zegt Sparki dat eerlijk en biedt een passend alternatief.
        </p>
      </div>

      {error && (
        <p className="mt-3 text-[12px] text-[rgba(255,140,120,0.85)]">{error}</p>
      )}
      {saved && (
        <p className="mt-3 text-[12px]" style={{ color: ACCENT }}>
          Route opgeslagen in je routes.
        </p>
      )}

      <button
        type="button"
        onClick={() => (mode === "loop" ? runGenerateOptions() : runGenerate())}
        disabled={generate.isPending || genOptions.isPending}
        className="mt-4 w-full rounded-2xl py-3.5 font-sans text-[13px] font-semibold disabled:opacity-50"
        style={{ background: ACCENT, color: "#040506" }}
      >
        {generate.isPending || genOptions.isPending
          ? "Berekenen…"
          : mode === "waypoints"
            ? "Bereken route"
            : mode === "loop"
              ? "Genereer 3 routes"
              : "Genereer route"}
      </button>

      {/* Loop mode: pick one of the 3 distance variants Sparki proposed */}
      {mode === "loop" && options && !candidate && (
        <div className="mt-5 border-t border-white/[0.08] pt-5">
          <span className="label-xs text-white/35">KIES JE AFSTAND</span>
          <p className="mt-1 text-[12px] leading-relaxed text-white/40">
            {options.length > 1
              ? `Sparki stelde ${options.length} routes voor rond je afstand. Kies degene die past — je ziet daarna de kaart, het hoogteprofiel en de navigatie.`
              : "Sparki kon rond deze afstand één passende lus vinden. Kies hem om de kaart en navigatie te zien."}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {options.map((o) => (
              <button
                key={o.candidateId}
                type="button"
                onClick={() => setCandidate(o)}
                className="rounded-xl border border-white/[0.1] bg-white/[0.03] p-3.5 text-left transition-colors hover:border-cyan-300/40 hover:bg-cyan-300/[0.06]"
              >
                <span
                  className="font-mono text-[9px] uppercase tracking-[0.16em]"
                  style={{ color: ACCENT }}
                >
                  {(o as RouteCandidate & { variant?: string }).variant ??
                    "Route"}
                </span>
                <div className="mt-1.5 font-sans text-xl font-light tracking-tight text-white/90">
                  {o.distanceKm != null ? `${Math.round(o.distanceKm)} km` : "—"}
                </div>
                <div className="mt-1.5 flex items-center gap-3 font-mono text-[10px] tabular-nums text-white/45">
                  <span>
                    {o.elevationGainM != null ? `${o.elevationGainM} m` : "—"}
                  </span>
                  <span>·</span>
                  <span>{formatDuration(o.durationSec)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Proposed candidate */}
      {candidate && (
        <div className="mt-5 border-t border-white/[0.08] pt-5">
          {mode === "loop" && options && options.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setCandidate(null)
                setMeetpoints([])
              }}
              className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45 transition hover:text-cyan-300/80"
            >
              ← Andere afstand kiezen
            </button>
          )}
          <h4 className="font-sans text-lg font-light tracking-tight text-white/90">
            {candidate.name}
          </h4>

          {candidate.geometry.length > 1 && (
            <>
              <p className="mt-4 text-[12px] leading-relaxed text-white/40">
                Tik op de route om een verzamelpunt te plaatsen — bijvoorbeeld om
                een vriend op te halen. Tik op een pin om hem te verwijderen.
              </p>
              <RouteMap
                geometry={candidate.geometry}
                climbs={candidate.climbs}
                meetpoints={meetpoints}
                onMapClick={addMeetpoint}
                onMeetpointClick={(i) =>
                  setMeetpoints((m) => m.filter((_, idx) => idx !== i))
                }
                className="mt-3"
              />
              <MeetpointList
                meetpoints={meetpoints}
                setMeetpoints={setMeetpoints}
              />
            </>
          )}

          {candidate.profile.length > 0 && (
            <ElevationProfile
              profile={candidate.profile}
              distanceKm={candidate.distanceKm}
            />
          )}

          <div className="mt-4 flex items-center gap-5 border-t border-white/[0.07] pt-4">
            <Stat
              label="Afstand"
              value={
                candidate.distanceKm != null ? `${candidate.distanceKm} km` : "—"
              }
            />
            <Divider />
            <Stat label="Duur" value={formatDuration(candidate.durationSec)} />
            <Divider />
            <Stat
              label="Hoogtemeters"
              value={
                candidate.elevationGainM != null
                  ? `${candidate.elevationGainM} m`
                  : "—"
              }
            />
            <Divider />
            <Stat
              label="Ondergrond"
              value={SURFACE_LABEL[candidate.surface] ?? candidate.surface}
            />
          </div>

          <Climbs climbs={candidate.climbs} />

          <p className="mt-4 whitespace-pre-line text-[12px] leading-relaxed text-white/55">
            {candidate.rationale}
          </p>

          {candidate.nav.length > 0 && (
            <div className="mt-4">
              <span className="label-xs text-white/35">
                STAP-VOOR-STAP ({candidate.nav.length})
              </span>
              <div className="mt-2 max-h-64 overflow-y-auto pr-1">
                {candidate.nav.map((n, i) => (
                  <div
                    key={i}
                    className="flex items-baseline gap-3 border-b border-white/[0.05] py-2 last:border-0"
                  >
                    <span className="w-12 shrink-0 font-mono text-[11px] tabular-nums text-cyan-300/70">
                      {n.km}
                    </span>
                    <span className="w-24 shrink-0 break-words text-[12px] tracking-tight text-white/85">
                      {n.dir}
                    </span>
                    <span className="min-w-0 flex-1 break-words text-[12px] text-white/40">
                      {n.note}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {candidate.plannedWorkoutId != null && (
            <p className="mt-3 font-mono text-[10px] text-white/35">
              Wordt opgeslagen bij de gekoppelde training.
            </p>
          )}

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={saveCandidate}
              disabled={save.isPending}
              className="flex-1 rounded-2xl py-3.5 font-sans text-[13px] font-semibold disabled:opacity-50"
              style={{ background: ACCENT, color: "#040506" }}
            >
              {save.isPending ? "Opslaan…" : "Bewaar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null)
                candidateDownload.mutate(
                  {
                    candidateId: candidate.candidateId,
                    name: candidate.name,
                    format: "gpx",
                  },
                  {
                    onError: (e) =>
                      setError(
                        e instanceof Error ? e.message : "Download mislukt",
                      ),
                  },
                )
              }}
              disabled={candidateDownload.isPending}
              title="Download als GPX voor je fietscomputer"
              className="flex items-center gap-1.5 rounded-2xl border border-white/[0.12] px-4 py-3.5 font-sans text-[13px] text-white/70 transition-colors hover:border-cyan-300/30 disabled:opacity-50"
            >
              <Download className="h-4 w-4" strokeWidth={1.75} />
              GPX
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null)
                candidateDownload.mutate(
                  {
                    candidateId: candidate.candidateId,
                    name: candidate.name,
                    format: "tcx",
                  },
                  {
                    onError: (e) =>
                      setError(
                        e instanceof Error ? e.message : "Download mislukt",
                      ),
                  },
                )
              }}
              disabled={candidateDownload.isPending}
              title="Download als TCX-course — meest betrouwbare navigatie op Garmin/Wahoo"
              className="flex items-center gap-1.5 rounded-2xl border border-white/[0.12] px-4 py-3.5 font-sans text-[13px] text-white/70 transition-colors hover:border-cyan-300/30 disabled:opacity-50"
            >
              <Download className="h-4 w-4" strokeWidth={1.75} />
              TCX
            </button>
            <button
              type="button"
              onClick={() => runGenerate(Math.floor(Math.random() * 1e6))}
              disabled={generate.isPending}
              className="rounded-2xl border border-white/[0.12] px-5 py-3.5 font-sans text-[13px] text-white/60 transition-colors hover:border-white/20 disabled:opacity-50"
            >
              Regenereer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function RoutePanel() {
  const { data, isLoading } = useRoutes()
  const create = useCreateRoute()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [showGenerator, setShowGenerator] = useState(false)
  // Prefill for the generator when the rider steers from a route-paspoort
  // ("Vlakker" / "Meer klimmen"). Key forces a fresh generator instance so the
  // preference actually lands in its state.
  const [genPrefill, setGenPrefill] = useState<ElevationPreference | null>(null)

  function adjustRoute(pref: ElevationPreference) {
    setGenPrefill(pref)
    setShowGenerator(true)
    // Bring the generator into view — it renders above the route list.
    setTimeout(() => {
      document
        .getElementById("route-generator")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }

  useEffect(() => {
    trackScreen("routes")
  }, [])

  const routes = data?.routes ?? []

  async function onFile(file: File) {
    setError(null)
    if (!file.name.toLowerCase().endsWith(".gpx")) {
      setError("Alleen GPX-bestanden worden ondersteund")
      return
    }
    if (file.size > 11 * 1024 * 1024) {
      setError("Bestand te groot (max 11 MB)")
      return
    }
    const content = await file.text()
    create.mutate(
      { content, name: file.name.replace(/\.gpx$/i, "") },
      { onError: () => setError("Route kon niet worden verwerkt") },
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionLabel n="03" title="Route & navigatie" />
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowGenerator((s) => !s)}
            className="font-mono text-[10px] uppercase tracking-[0.18em] transition"
            style={{ color: ACCENT }}
          >
            {showGenerator ? "− generator" : "+ genereer route"}
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={create.isPending}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45 transition disabled:opacity-50"
          >
            {create.isPending ? "verwerken…" : "+ gpx"}
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".gpx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
          e.target.value = ""
        }}
      />

      <p className="mt-2 text-[12px] leading-relaxed text-white/35">
        Laat Sparki een route genereren die past bij je training en sport — Sparki
        kiest automatisch het juiste routeprofiel. Of upload een GPX-bestand voor
        een echt hoogteprofiel.
      </p>

      {error && (
        <p className="mt-2 text-[12px] text-[rgba(255,140,120,0.85)]">{error}</p>
      )}

      {showGenerator && (
        <div className="mt-4" id="route-generator">
          <RouteGenerator
            key={genPrefill ?? "default"}
            initialElevation={genPrefill}
            onClose={() => {
              setShowGenerator(false)
              setGenPrefill(null)
            }}
          />
        </div>
      )}

      <div className="mt-4 space-y-4">
        {isLoading ? (
          <div className="h-40 w-full animate-pulse rounded-xl bg-white/[0.06]" />
        ) : routes.length > 0 ? (
          routes.map((r) => (
            <RouteCard key={r.id} route={r} onAdjust={adjustRoute} />
          ))
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="text-[12px] leading-relaxed text-white/40">
              Nog geen routes opgeslagen — laat Sparki er één opbouwen op basis
              van je startpunt, fiets en afstand.
            </p>
            {!showGenerator && (
              <button
                type="button"
                onClick={() => setShowGenerator(true)}
                className="mt-3 rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300 transition hover:bg-cyan-300/20"
              >
                Genereer je eerste route
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
