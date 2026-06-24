import { useRef, useState } from "react"
import { SectionLabel, Stat, Divider, ACCENT } from "@/components/sparki/ui"
import { RouteMap } from "@/components/sparki/route-map"
import {
  useRoutes,
  useCreateRoute,
  useDeleteRoute,
  useGenerateRoute,
  useSaveGeneratedRoute,
  useDownloadRoute,
  useDownloadCandidate,
  type RouteExportFormat,
  type SparkiRoute,
  type Sport,
  type BikeType,
  type ElevationPreference,
  type RouteCandidate,
  type RouteWaypoint,
  type RouteMeetpoint,
} from "@/hooks/use-routes"
import { useUpcomingWorkouts } from "@/hooks/use-today-workout"
import { isSportActive } from "@workspace/feature-flags"
import { MapPin, Sparkles, Flag, Users, X, Download } from "lucide-react"

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

function ElevationProfile({ profile }: { profile: number[] }) {
  if (profile.length === 0) return null
  const max = Math.max(...profile)
  const min = Math.min(...profile)
  const span = Math.max(1, max - min)
  return (
    <div className="mt-4 flex h-16 items-end gap-px">
      {profile.map((p, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[1px]"
          style={{
            height: `${((p - min) / span) * 90 + 10}%`,
            background:
              "linear-gradient(180deg, rgba(120,210,230,0.55), rgba(120,210,230,0.08))",
          }}
        />
      ))}
    </div>
  )
}

function Climbs({
  climbs,
}: {
  climbs: { name: string; lengthKm: number; avgGradePct: number }[]
}) {
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
            <span className="flex-1 text-[13px] tracking-tight text-white/85">
              {c.name}
            </span>
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

function RouteCard({ route }: { route: SparkiRoute }) {
  const del = useDeleteRoute()
  const download = useDownloadRoute()
  const [gpxError, setGpxError] = useState<string | null>(null)
  const profile = route.profile ?? []
  const climbs = route.climbs ?? []
  const nav = route.nav ?? []
  const geometry = route.geometry ?? []
  const canExport = geometry.length > 1

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
          {canExport && (
            <div className="flex items-center gap-2.5">
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

      {geometry.length > 1 && <RouteMap geometry={geometry} className="mt-4" />}

      {profile.length > 0 && <ElevationProfile profile={profile} />}

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
              <span className="w-12 font-mono text-[11px] tabular-nums text-cyan-300/70">
                {n.km}
              </span>
              <span className="w-20 text-[13px] tracking-tight text-white/85">
                {n.dir}
              </span>
              <span className="flex-1 text-[12px] text-white/40">{n.note}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-[12px] text-white/30">
          Stap-voor-stap navigatie nog niet beschikbaar voor deze route
        </p>
      )}
    </div>
  )
}

const inputClass =
  "w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"

function RouteGenerator({ onClose }: { onClose: () => void }) {
  const generate = useGenerateRoute()
  const save = useSaveGeneratedRoute()
  const candidateDownload = useDownloadCandidate()
  const { data: workouts } = useUpcomingWorkouts()

  const [mode, setMode] = useState<"loop" | "ptp" | "waypoints">("loop")
  const [sport, setSport] = useState<Sport>("cycling")
  const [bikeType, setBikeType] = useState<BikeType>("racefiets")
  const [elevationPreference, setElevationPreference] =
    useState<ElevationPreference>("any")
  const [trainingType, setTrainingType] = useState("duurtraining")
  const [workoutId, setWorkoutId] = useState<string>("")
  const [distance, setDistance] = useState("40")
  const [destination, setDestination] = useState("")
  const [start, setStart] = useState<{ lat: number; lon: number } | null>(null)
  const [geoState, setGeoState] = useState<"idle" | "loading" | "error">("idle")
  const [candidate, setCandidate] = useState<RouteCandidate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

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
          setWaypoints([])
          setMeetpoints([])
        },
        onError: (e) =>
          setError(e instanceof Error ? e.message : "Opslaan mislukt"),
      },
    )
  }

  // Builder: a map click adds either a route-shaping waypoint or a named
  // meeting point ("verzamelpunt"), depending on the active place-mode.
  function handleMapClick(lat: number, lon: number) {
    if (placeMode === "waypoint") {
      setWaypoints((w) => [...w, [lat, lon]])
    } else {
      setMeetpoints((m) => [
        ...m,
        { lat, lon, name: `Verzamelpunt ${m.length + 1}`, note: null },
      ])
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
          <div className="flex gap-2">
            {BIKE_OPTIONS.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => setBikeType(b.value)}
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
            onChange={(e) => setDistance(e.target.value)}
            disabled={!!linkedWorkout?.targetDurationMin}
          />
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
          {meetpoints.length > 0 && (
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
          )}
        </div>
      )}

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
        onClick={() => runGenerate()}
        disabled={generate.isPending}
        className="mt-4 w-full rounded-2xl py-3.5 font-sans text-[13px] font-semibold disabled:opacity-50"
        style={{ background: ACCENT, color: "#040506" }}
      >
        {generate.isPending
          ? "Berekenen…"
          : mode === "waypoints"
            ? "Bereken route"
            : "Genereer route"}
      </button>

      {/* Proposed candidate */}
      {candidate && (
        <div className="mt-5 border-t border-white/[0.08] pt-5">
          <h4 className="font-sans text-lg font-light tracking-tight text-white/90">
            {candidate.name}
          </h4>

          {candidate.geometry.length > 1 && (
            <RouteMap
              geometry={candidate.geometry}
              meetpoints={mode === "waypoints" ? meetpoints : []}
              interactive={false}
              className="mt-4"
            />
          )}

          {candidate.profile.length > 0 && (
            <ElevationProfile profile={candidate.profile} />
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
                    <span className="w-24 shrink-0 text-[12px] tracking-tight text-white/85">
                      {n.dir}
                    </span>
                    <span className="flex-1 text-[12px] text-white/40">
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
        <div className="mt-4">
          <RouteGenerator onClose={() => setShowGenerator(false)} />
        </div>
      )}

      <div className="mt-4 space-y-4">
        {isLoading ? (
          <div className="h-40 w-full animate-pulse rounded-xl bg-white/[0.06]" />
        ) : routes.length > 0 ? (
          routes.map((r) => <RouteCard key={r.id} route={r} />)
        ) : (
          <p className="text-[12px] text-white/30">Nog geen routes opgeslagen</p>
        )}
      </div>
    </section>
  )
}
