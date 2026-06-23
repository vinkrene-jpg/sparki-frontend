import { useRef, useState } from "react"
import { SectionLabel, Stat, Divider, ACCENT } from "@/components/sparki/ui"
import { RouteMap } from "@/components/sparki/route-map"
import {
  useRoutes,
  useCreateRoute,
  useDeleteRoute,
  useGenerateRoute,
  useGeocode,
  type SparkiRoute,
  type RouteCandidate,
  type BikeType,
  type TrainingType,
  type GeocodeResult,
} from "@/hooks/use-routes"
import { useUpcomingWorkouts } from "@/hooks/use-today-workout"

const SURFACE_LABEL: Record<string, string> = {
  asfalt: "Asfalt",
  gravel: "Gravel",
  mtb: "MTB",
  mixed: "Gemengd",
  unknown: "Onbekend",
}

const BIKE_OPTIONS: { value: BikeType; label: string }[] = [
  { value: "race", label: "Racefiets" },
  { value: "gravel", label: "Gravel" },
  { value: "mtb", label: "MTB" },
]

const TRAINING_OPTIONS: { value: TrainingType; label: string }[] = [
  { value: "duur", label: "Duurtraining" },
  { value: "interval", label: "Interval" },
  { value: "tempo", label: "Tempo" },
  { value: "herstel", label: "Herstel" },
  { value: "wedstrijd", label: "Wedstrijdsimulatie" },
]

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

function ClimbList({
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
  const profile = route.profile ?? []
  const climbs = route.climbs ?? []
  const nav = route.nav ?? []
  const geometry = route.geometry ?? []

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
              · {route.source === "generated" ? "gegenereerd" : route.source}
            </span>
          </div>
          <h3 className="mt-1 truncate font-sans text-lg font-light tracking-tight text-white/90">
            {route.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => del.mutate(route.id)}
          disabled={del.isPending}
          className="shrink-0 font-mono text-[10px] text-white/30 transition hover:text-white/60 disabled:opacity-40"
        >
          wis
        </button>
      </div>

      {geometry.length > 1 && (
        <div className="mt-4">
          <RouteMap geometry={geometry} className="h-48" />
        </div>
      )}

      {profile.length > 0 && <ElevationProfile profile={profile} />}

      <div className="mt-4 flex items-center gap-5 border-t border-white/[0.07] pt-4">
        <Stat
          label="Afstand"
          value={route.distanceKm != null ? `${route.distanceKm} km` : "—"}
        />
        <Divider />
        <Stat
          label="Hoogtemeters"
          value={route.elevationGainM != null ? `${route.elevationGainM} m` : "—"}
        />
        <Divider />
        <Stat label="Ondergrond" value={SURFACE_LABEL[route.surface] ?? route.surface} />
      </div>

      {route.rationale && (
        <div className="mt-4 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] p-3">
          <p className="text-[12px] leading-relaxed text-white/70">
            {route.rationale}
          </p>
        </div>
      )}

      {route.source === "generated" && (
        <p className="mt-2 text-[11px] leading-relaxed text-white/30">
          Ondergrond en rustige wegen zijn een voorkeur van de routemachine,
          geen garantie.
        </p>
      )}

      <ClimbList climbs={climbs} />

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

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className="rounded-xl border px-3.5 py-2 font-mono text-[11px] tracking-wide transition-colors"
          style={{
            borderColor:
              value === o.value
                ? "rgba(120,210,230,0.5)"
                : "rgba(255,255,255,0.1)",
            background:
              value === o.value ? "rgba(120,210,230,0.12)" : "transparent",
            color: value === o.value ? ACCENT : "rgba(255,255,255,0.5)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function RouteGenerator() {
  const generate = useGenerateRoute()
  const create = useCreateRoute()
  const geocode = useGeocode()
  const { data: workouts } = useUpcomingWorkouts()

  const [mode, setMode] = useState<"loop" | "ab">("loop")
  const [bikeType, setBikeType] = useState<BikeType>("race")
  const [trainingType, setTrainingType] = useState<TrainingType>("duur")
  const [start, setStart] = useState<{ lat: number; lon: number } | null>(null)
  const [startLabel, setStartLabel] = useState<string>("")
  const [destQuery, setDestQuery] = useState("")
  const [destResults, setDestResults] = useState<GeocodeResult[]>([])
  const [dest, setDest] = useState<GeocodeResult | null>(null)
  const [targetKm, setTargetKm] = useState("")
  const [linkedWorkoutId, setLinkedWorkoutId] = useState<string>("")
  const [candidate, setCandidate] = useState<RouteCandidate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const seedRef = useRef<number>(0)

  const useMyLocation = () => {
    setError(null)
    if (!("geolocation" in navigator)) {
      setError("Geolocatie niet beschikbaar in deze browser")
      return
    }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStart({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setStartLabel(
          `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
        )
        setGeoLoading(false)
      },
      () => {
        setError("Kon je locatie niet ophalen — geef toestemming of zoek handmatig")
        setGeoLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const searchDest = () => {
    if (destQuery.trim().length < 2) return
    setError(null)
    geocode.mutate(
      { q: destQuery.trim(), near: start ?? undefined },
      {
        onSuccess: (d) => setDestResults(d.results),
        onError: () => setError("Zoeken naar bestemming mislukt"),
      },
    )
  }

  const doGenerate = (regen = false) => {
    if (!start) {
      setError("Kies eerst een startpunt")
      return
    }
    if (mode === "ab" && !dest) {
      setError("Kies een bestemming voor een A→B route")
      return
    }
    setError(null)
    if (regen) seedRef.current = Math.floor(Math.random() * 1_000_000)
    generate.mutate(
      {
        mode,
        start,
        end: mode === "ab" && dest ? { lat: dest.lat, lon: dest.lon } : undefined,
        bikeType,
        trainingType,
        targetDistanceKm: targetKm ? Number(targetKm) : undefined,
        linkedWorkoutId: linkedWorkoutId ? Number(linkedWorkoutId) : undefined,
        seed: regen ? seedRef.current : undefined,
      },
      {
        onSuccess: (d) => setCandidate(d.candidate),
        onError: (e) =>
          setError(
            e instanceof Error && e.message
              ? cleanError(e.message)
              : "Kon route niet genereren",
          ),
      },
    )
  }

  const saveCandidate = () => {
    if (!candidate) return
    create.mutate(
      {
        source: "generated",
        name: candidate.name,
        surface: candidate.surface,
        bikeType: candidate.bikeType,
        trainingType: candidate.trainingType,
        rationale: candidate.rationale,
        startName: candidate.startName,
        endName: candidate.endName,
        geometry: candidate.geometry,
      },
      {
        onSuccess: () => {
          setCandidate(null)
          setError(null)
        },
        onError: () => setError("Bewaren mislukt"),
      },
    )
  }

  return (
    <div className="mt-4 rounded-xl border border-white/[0.09] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">
        Genereer route
      </span>
      <p className="mt-1.5 text-[12px] leading-relaxed text-white/40">
        Sparki stelt een echte route voor die past bij je training en fiets,
        berekend met OpenRouteService. Afstand, hoogte en klimmen komen uit de
        routemachine — niets verzonnen.
      </p>

      {/* Mode toggle */}
      <div className="mt-4">
        <Segmented
          options={[
            { value: "loop", label: "Rondje" },
            { value: "ab", label: "A → B" },
          ]}
          value={mode}
          onChange={(v) => setMode(v as "loop" | "ab")}
        />
      </div>

      {/* Start */}
      <div className="mt-4">
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          START
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={geoLoading}
            className="rounded-xl border border-cyan-300/30 px-3.5 py-2 font-mono text-[11px] text-cyan-300/80 transition hover:border-cyan-300/50 disabled:opacity-50"
          >
            {geoLoading ? "Locatie ophalen…" : "Gebruik mijn locatie"}
          </button>
          {startLabel && (
            <span className="truncate font-mono text-[11px] text-white/45">
              {startLabel}
            </span>
          )}
        </div>
      </div>

      {/* Destination (A→B only) */}
      {mode === "ab" && (
        <div className="mt-4">
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            BESTEMMING
          </label>
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder="Zoek een plaats of adres"
              value={destQuery}
              onChange={(e) => setDestQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  searchDest()
                }
              }}
            />
            <button
              type="button"
              onClick={searchDest}
              disabled={geocode.isPending}
              className="shrink-0 rounded-xl border border-white/[0.12] px-4 font-mono text-[11px] text-white/60 transition hover:border-white/25 disabled:opacity-50"
            >
              {geocode.isPending ? "…" : "Zoek"}
            </button>
          </div>
          {dest && (
            <p className="mt-2 font-mono text-[11px] text-cyan-300/70">
              ✓ {dest.label}
            </p>
          )}
          {destResults.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {destResults.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setDest(r)
                    setDestResults([])
                    setDestQuery(r.label)
                  }}
                  className="rounded-lg border border-white/[0.08] px-3 py-2 text-left text-[12px] text-white/70 transition hover:border-cyan-300/30 hover:text-white/90"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bike type */}
      <div className="mt-4">
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          FIETS
        </label>
        <Segmented
          options={BIKE_OPTIONS}
          value={bikeType}
          onChange={(v) => setBikeType(v as BikeType)}
        />
      </div>

      {/* Training type */}
      <div className="mt-4">
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          TRAINING
        </label>
        <Segmented
          options={TRAINING_OPTIONS}
          value={trainingType}
          onChange={(v) => setTrainingType(v as TrainingType)}
        />
      </div>

      {/* Link planned workout */}
      {workouts && workouts.length > 0 && (
        <div className="mt-4">
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            KOPPEL GEPLANDE TRAINING (OPTIONEEL)
          </label>
          <select
            className={inputClass}
            value={linkedWorkoutId}
            onChange={(e) => setLinkedWorkoutId(e.target.value)}
          >
            <option value="">Geen koppeling</option>
            {workouts.map((w) => (
              <option key={w.id} value={w.id}>
                {w.scheduledDate} · {w.title}
                {w.targetDurationMin ? ` (${w.targetDurationMin}m)` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Target distance (loop only) */}
      {mode === "loop" && (
        <div className="mt-4">
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            DOELAFSTAND (KM){linkedWorkoutId ? " — anders afgeleid uit training" : ""}
          </label>
          <input
            className={inputClass}
            type="number"
            min={2}
            max={300}
            placeholder="bv. 40"
            value={targetKm}
            onChange={(e) => setTargetKm(e.target.value)}
          />
        </div>
      )}

      {error && (
        <p className="mt-3 text-[12px] text-[rgba(255,140,120,0.85)]">{error}</p>
      )}

      <button
        type="button"
        onClick={() => doGenerate(false)}
        disabled={generate.isPending || !start}
        className="mt-4 w-full rounded-2xl py-3.5 font-sans text-[13px] font-semibold disabled:opacity-50"
        style={{ background: ACCENT, color: "#040506" }}
      >
        {generate.isPending ? "Route berekenen…" : "Genereer route"}
      </button>

      {/* Candidate preview */}
      {candidate && (
        <div className="mt-5 rounded-xl border border-cyan-300/20 bg-[#05070e]/80 p-4">
          <div className="flex items-center justify-between">
            <h4 className="truncate font-sans text-base font-light text-white/90">
              {candidate.name}
            </h4>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-300/70">
              voorstel
            </span>
          </div>

          <div className="mt-3">
            <RouteMap geometry={candidate.geometry} className="h-52" />
          </div>

          {candidate.profile.length > 0 && (
            <ElevationProfile profile={candidate.profile} />
          )}

          <div className="mt-4 flex items-center gap-5 border-t border-white/[0.07] pt-4">
            <Stat
              label="Afstand"
              value={
                candidate.distanceKm != null
                  ? `${candidate.distanceKm} km`
                  : "—"
              }
            />
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

          <ClimbList climbs={candidate.climbs} />

          <div className="mt-4 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] p-3">
            <p className="text-[12px] leading-relaxed text-white/70">
              {candidate.rationale}
            </p>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-white/30">
            Ondergrond en rustige wegen zijn een voorkeur van de routemachine,
            geen garantie.
          </p>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={saveCandidate}
              disabled={create.isPending}
              className="flex-1 rounded-2xl py-3 font-sans text-[13px] font-semibold disabled:opacity-50"
              style={{ background: ACCENT, color: "#040506" }}
            >
              {create.isPending ? "Bewaren…" : "Bewaar"}
            </button>
            <button
              type="button"
              onClick={() => doGenerate(true)}
              disabled={generate.isPending}
              className="rounded-2xl border border-white/[0.12] px-5 py-3 font-sans text-[13px] text-white/60 transition hover:border-white/25 disabled:opacity-50"
            >
              Regenereer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Drizzle errors sometimes surface as JSON strings; keep them human-readable.
function cleanError(msg: string): string {
  try {
    const parsed = JSON.parse(msg) as { error?: string }
    if (parsed.error) return parsed.error
  } catch {
    // not JSON
  }
  return msg.length > 160 ? "Kon route niet genereren" : msg
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
            onClick={() => setShowGenerator((v) => !v)}
            className="font-mono text-[10px] uppercase tracking-[0.18em] transition"
            style={{ color: ACCENT }}
          >
            {showGenerator ? "− generator" : "✦ genereer"}
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={create.isPending}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40 transition hover:text-white/70 disabled:opacity-50"
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
        Laat Sparki een route genereren die past bij je training, of upload een
        GPX-bestand voor een echt hoogteprofiel en gedetecteerde klimmen.
      </p>

      {error && (
        <p className="mt-2 text-[12px] text-[rgba(255,140,120,0.85)]">{error}</p>
      )}

      {showGenerator && <RouteGenerator />}

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
