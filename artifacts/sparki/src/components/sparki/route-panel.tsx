import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import { DsStatus, IconCheck } from "@/components/ds"
import { trackScreen } from "@/lib/telemetry"
import { SectionLabel, Stat, Divider, ACCENT } from "@/components/sparki/ui"
import { HumorLine } from "@/components/sparki/humor-line"
import { RouteMap } from "@/components/sparki/route-map"
import {
  useRoutes,
  useCreateRoute,
  useDeleteRoute,
  useGenerateRoute,
  useGenerateRouteOptions,
  useSaveGeneratedRoute,
  useEnrichRoute,
  useDownloadRoute,
  useShareRoute,
  useRoutePace,
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
  useGeocode,
  type GeocodeResult,
} from "@/hooks/use-routes"
import type { PlannedWorkout } from "@/lib/athlete-types"
import {
  useUpcomingWorkouts,
  useWorkoutSearch,
} from "@/hooks/use-today-workout"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useFriends } from "@/hooks/use-social"
import { isSportActive } from "@workspace/feature-flags"
import { racefietsVerification } from "@/lib/racefiets-verification"
import { ArrowLeft, MapPin, Sparkles, Flag, Users, X, Download, Navigation, Share2, Map as MapIcon, Lock } from "lucide-react"
import { RouteExplorer } from "@/components/sparki/route-explorer"
import { useLocation, useSearch } from "wouter"
import {
  RouteNavigator,
  RideOptionsMenu,
  loadLastRideOptions,
  applyFocusRules,
  type RideOptions,
} from "@/components/sparki/route-navigator"
import {
  ElevationProfile,
  InteractiveElevationProfile,
  MiniElevationProfile,
  type ProfileMarker,
} from "@/components/sparki/elevation-profile"
import {
  useRouteRemarks,
  useRouteRemarksPreview,
  type RouteRemark,
} from "@/hooks/use-route-remarks"
import { RouteRemarksPanel } from "@/components/sparki/route-remarks"
import { BuildRatingBlock } from "@/components/sparki/build-rating"
import { VolgautoPanel } from "@/components/sparki/volgauto-panel"
import {
  useRouteSurfaces,
  useRouteSurfacesPreview,
  type SurfaceKind,
} from "@/hooks/use-route-surfaces"
import {
  RouteSurfacesPanel,
  SURFACE_COLORS,
} from "@/components/sparki/route-surfaces"
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import type { RacePoint } from "@/hooks/use-race-points"
import { useRouteInsight } from "@/hooks/use-routes"
import {
  useDeviceSyncStatus,
  useDeviceSyncOAuthReturn,
  useConnectDevice,
  useSendRouteToDevice,
} from "@/hooks/use-device-sync"
import {
  useRouteProposals,
  useProposeRoute,
  useRespondToProposal,
} from "@/hooks/use-route-proposals"

// Editable list of named meeting points ("verzamelpunten") — e.g. where you
// pick up a friend. Shared by the interactive builder and the generated-route
// preview so both can drop pickup spots.
// Eén rij in de puntenlijst van de eigen-routebouwer: label + coördinaten +
// wisknop. Echte punten van de kaart, nooit verzonnen namen.
function PointRow({
  icon,
  label,
  point,
  onRemove,
}: {
  icon: ReactNode
  label: string
  point: RouteWaypoint
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
      {icon}
      <span className="min-w-0 flex-1 truncate font-sans text-[13px] text-white/90">
        {label}
        <span className="ml-2 font-mono text-[10px] text-white/35">
          {point[0].toFixed(4)}, {point[1].toFixed(4)}
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${label} verwijderen`}
        className="shrink-0 text-white/30 transition hover:text-negative/85"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  )
}

// Placeholder-regel voor een nog niet geplaatst punt: legt uit wat je moet
// doen en zet bij tikken de juiste plaats-modus aan.
function PlaceholderRow({
  icon,
  label,
  hint,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  hint: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-left transition ${
        active
          ? "border-accent-cyan/40 bg-accent-cyan/[0.06]"
          : "border-white/[0.12] bg-transparent hover:border-white/25"
      }`}
    >
      {icon}
      <span className="min-w-0 flex-1 font-sans text-[13px] text-white/55">
        {label}
        <span className="ml-2 text-[11px] text-white/35">{hint}</span>
      </span>
    </button>
  )
}

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
          className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2"
        >
          <Users
            className="h-3.5 w-3.5 shrink-0 text-warning/90"
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
            className="shrink-0 text-white/30 transition hover:text-negative/85"
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
// Taak #446: onthouden onverhard-voorkeur per fietstype (alleen gravel/MTB;
// racefiets kent geen instelbare waarde en dus geen geheugen). Waarden buiten
// het schuifbereik (0–60, stap 5) worden genegeerd — dan geldt de standaard.
function readStoredUnpavedPct(bike: BikeType): number | null {
  try {
    const raw = localStorage.getItem(`sparki:unpaved-pct:${bike}`)
    if (raw === null) return null
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0 || n > 60 || n % 5 !== 0) return null
    return n
  } catch {
    return null
  }
}

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
// ── Opmerkingen groeperen (René, 30-07-2026): tientallen losse uitroeptekens
// op kaart en hoogteprofiel zijn visuele vervuiling. Zachte opmerkingen met
// hetzelfde label die dicht op elkaar liggen worden één marker met een
// telling; er verdwijnt niets — de volledige lijst blijft in het
// opmerkingenpaneel staan.
const REMARK_GROUP_KM = 1.0

function groupRemarkMarkers(
  remarks: {
    id: string
    lat: number
    lon: number
    label: string
    routeKm: number
  }[],
): { id: string; lat: number; lon: number; label: string }[] {
  const sorted = [...remarks].sort((a, b) => a.routeKm - b.routeKm)
  const out: { id: string; lat: number; lon: number; label: string; _n: number; _lastKm: number }[] = []
  for (const r of sorted) {
    const prev = out[out.length - 1]
    if (
      prev &&
      prev.label.replace(/ \(\d+×\)$/, "") === r.label &&
      Number.isFinite(r.routeKm) &&
      Number.isFinite(prev._lastKm) &&
      r.routeKm - prev._lastKm <= REMARK_GROUP_KM
    ) {
      prev._n += 1
      prev._lastKm = r.routeKm
      prev.label = `${r.label} (${prev._n}×)`
      continue
    }
    out.push({ id: r.id, lat: r.lat, lon: r.lon, label: r.label, _n: 1, _lastKm: r.routeKm })
  }
  return out.map(({ id, lat, lon, label }) => ({ id, lat, lon, label }))
}

function groupProfileRemarkMarkers(
  remarks: { label: string; routeKm: number }[],
): { km: number; label: string; kind: "opmerking" }[] {
  const sorted = remarks
    .filter((r) => Number.isFinite(r.routeKm))
    .sort((a, b) => a.routeKm - b.routeKm)
  const out: { km: number; label: string; kind: "opmerking"; _n: number; _lastKm: number }[] = []
  for (const r of sorted) {
    const prev = out[out.length - 1]
    if (
      prev &&
      prev.label.replace(/ \(\d+×\)$/, "") === r.label &&
      r.routeKm - prev._lastKm <= REMARK_GROUP_KM
    ) {
      prev._n += 1
      prev._lastKm = r.routeKm
      prev.label = `${r.label} (${prev._n}×)`
      continue
    }
    out.push({ km: r.routeKm, label: r.label, kind: "opmerking", _n: 1, _lastKm: r.routeKm })
  }
  return out.map(({ km, label, kind }) => ({ km, label, kind }))
}

// Expliciet gekozen fietstype van een route (uit route.surface / bikeType)
// → het fietstype waarvan de geschiktheid de hoofdbeoordeling is.
function preferredBikeFromSurface(
  surface: string | null | undefined,
): "racefiets" | "gravelbike" | "mountainbike" | null {
  const s = (surface ?? "").toLowerCase()
  if (/mtb|mountain/.test(s)) return "mountainbike"
  if (/gravel/.test(s)) return "gravelbike"
  if (/race|weg|road|asfalt/.test(s)) return "racefiets"
  return null
}

function formatDuration(sec: number | null): string {
  if (sec == null) return "—"
  const total = Math.round(sec / 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h}u ${m}m` : `${m}m`
}

// Personal tempo block under the route stats. The "Duur" stat above comes from
// the routeplanner's standard tempo — NOT the rider's own condition. This block
// is honest about that, shows the expected average speed, defaults it to the
// rider's own real pace (median of recent rides) when available, and lets the
// rider adjust it — with the consequence (new duration) recalculated live.
function TempoBlock({
  distanceKm,
  routerDurationSec,
}: {
  distanceKm: number | null
  routerDurationSec: number | null
}) {
  const pace = useRoutePace()
  const personalKph = pace.data?.personalKph ?? null
  const sampleCount = pace.data?.sampleCount ?? 0

  // Router-implied speed, derivable from its own numbers.
  const routerKph =
    distanceKm != null && routerDurationSec != null && routerDurationSec > 0
      ? Math.round((distanceKm / (routerDurationSec / 3600)) * 10) / 10
      : null

  // The rider's chosen expected speed. Starts at their own real pace when we
  // have it, otherwise at the router's tempo. Adjustable in 0,5 km/u steps.
  const [chosenKph, setChosenKph] = useState<number | null>(null)
  const effectiveKph = chosenKph ?? personalKph ?? routerKph

  if (distanceKm == null || effectiveKph == null) return null

  const expectedSec = Math.round((distanceKm / effectiveKph) * 3600)
  const deltaMin =
    routerDurationSec != null
      ? Math.round((expectedSec - routerDurationSec) / 60)
      : null

  const step = (d: number) =>
    setChosenKph(Math.min(60, Math.max(8, Math.round((effectiveKph + d) * 2) / 2)))

  const basis =
    personalKph != null
      ? `Gebaseerd op je eigen ritten: mediaan ${personalKph.toString().replace(".", ",")} km/u over ${sampleCount} recente ritten.`
      : "Er zijn nog te weinig eigen ritten om je tempo te kennen — dit start op het standaardtempo van de routeplanner."

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
            Verwacht tempo
          </p>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => step(-0.5)}
              aria-label="Langzamer"
              className="h-6 w-6 rounded-full border border-border font-mono text-[12px] text-white/60 transition hover:text-white/90"
            >
              −
            </button>
            <span className="font-sans text-[15px] tabular-nums text-white/90">
              {effectiveKph.toString().replace(".", ",")} km/u
            </span>
            <button
              type="button"
              onClick={() => step(0.5)}
              aria-label="Sneller"
              className="h-6 w-6 rounded-full border border-border font-mono text-[12px] text-white/60 transition hover:text-white/90"
            >
              +
            </button>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
            Jouw verwachte duur
          </p>
          <p className="mt-1 font-sans text-[15px] tabular-nums text-white/90">
            {formatDuration(expectedSec)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-white/45">
        {basis}
        {" "}De "Duur" hierboven komt van de routeplanner
        {routerKph != null
          ? ` (standaardtempo ~${routerKph.toString().replace(".", ",")} km/u)`
          : ""}
        , niet van jouw conditie.
        {deltaMin != null && Math.abs(deltaMin) >= 5 && (
          <>
            {" "}Bij dit tempo ben je{" "}
            <span className="text-white/70">
              {Math.abs(deltaMin)} min {deltaMin > 0 ? "langer" : "korter"}
            </span>{" "}
            onderweg dan de planner rekent.
          </>
        )}
        {personalKph != null &&
          effectiveKph >= personalKph + 2 && (
            <>
              {" "}Let op: dit ligt duidelijk boven je eigen gemiddelde van de
              afgelopen maanden — reken er alleen op met wind mee of in een
              groep.
            </>
          )}
      </p>
    </div>
  )
}

// Compacte, eerlijke uitleg bij "Navigeer". Sparki draait hier als website of
// PWA in de browser — daarin kan de navigator: live positie volgen, route-
// aanwijzingen op het scherm tonen (incl. afwijkingswaarschuwing), en de rit
// registreren met automatische pauze/hervatting. Wat NIET kan op dit platform:
// doorlopen met het scherm uit of op de achtergrond (geen wake lock, de
// browser stopt locatie-updates), en gesproken afslag-aanwijzingen bestaan
// niet. Daarom noemen we die functies hier bewust niet — geen loze beloftes.
function NavigateInfoCard() {
  const [more, setMore] = useState(false)
  // Echte capability-check: bestaat locatiebepaling op dit apparaat?
  // (Achtergrond-tracking bestaat in de browser/PWA per definitie niet —
  // geen wake lock, watchPosition stopt bij scherm-uit — dus die regel is
  // altijd waar op dit platform en geen aanname.)
  const hasGeo =
    typeof navigator !== "undefined" && "geolocation" in navigator
  return (
    <div className="mt-4 rounded-xl border border-accent-cyan/[0.18] bg-accent-cyan/[0.06] px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        <Navigation
          className="mt-0.5 h-4 w-4 shrink-0 text-accent-cyan"
          strokeWidth={1.75}
        />
        <div className="min-w-0 text-[12.5px] leading-relaxed text-white/60">
          <p className="font-medium text-white/85">Navigeren met Sparki</p>
          {hasGeo ? (
            <>
              <p>
                Tik op{" "}
                <span className="font-medium text-white/85">Navigeer</span> om
                deze route te openen en je positie onderweg te volgen.
              </p>
              <p>Sparki registreert tijdens het navigeren ook je rit.</p>
              <p>
                Op dit apparaat moet Sparki geopend blijven — met het scherm
                uit stopt het volgen.
              </p>
            </>
          ) : (
            <p>
              Deze browser ondersteunt geen locatiebepaling, dus live volgen
              werkt hier niet. Download de route hierboven als GPX/TCX voor je
              fietscomputer.
            </p>
          )}
          {more && hasGeo && (
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-white/55">
              <li>
                Locatietoestemming wordt pas gevraagd op het moment dat de
                navigatie start — niet eerder, en alleen voor je locatie.
                Weiger je, dan meldt het navigatiescherm dat meteen duidelijk.
              </li>
              <li>
                Je ziet routeaanwijzingen op het scherm en krijgt een
                waarschuwing als je van de route afwijkt. Gesproken
                afslag-aanwijzingen zijn er niet.
              </li>
              <li>
                De ritregistratie pauzeert automatisch als je stilstaat en
                hervat zodra je weer rijdt.
              </li>
              <li>
                Onderweg wordt je rit tussentijds bewaard: keer je terug naar
                een gestarte navigatie, dan gaat dezelfde rit gewoon verder —
                er wordt niets dubbel geregistreerd.
              </li>
              <li>
                Liever je fietscomputer? Download de route hierboven als
                GPX/TCX.
              </li>
            </ul>
          )}
          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-accent-cyan transition hover:text-accent-cyan/90"
          >
            {more ? "− minder" : "+ Meer over navigeren"}
          </button>
        </div>
      </div>
    </div>
  )
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
            <span className="font-mono text-[11px] tabular-nums text-accent-cyan">
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
  const road = insight?.roadObjects
  // Verkeerslichten: eigen wegobjecten-database heeft voorrang (bevat ook
  // zelflerende bevestigingen); anders het kale OpenStreetMap-aantal.
  const lights = road?.counts["traffic_signal"] ?? env?.trafficLights ?? null
  if (lights != null)
    rows.push({ label: "Verkeerslichten", value: `${lights} op de route` })
  if (road) {
    if (road.counts["roundabout"] != null)
      rows.push({
        label: "Rotondes",
        value: `${road.counts["roundabout"]} op de route`,
      })
    if (road.counts["speed_bump"] != null)
      rows.push({
        label: "Drempels",
        value: `${road.counts["speed_bump"]} op de route`,
      })
    if ((road.counts["railway_crossing"] ?? 0) > 0)
      rows.push({
        label: "Spoorwegovergangen",
        value: `${road.counts["railway_crossing"]} op de route`,
      })
    if (road.estimatedTimeLossSec != null && road.estimatedTimeLossSec > 0)
      rows.push({
        label: "Stilstand (schatting)",
        value: `±${Math.max(1, Math.round(road.estimatedTimeLossSec / 60))} min door verkeerslichten`,
      })
  }
  if (env?.forestSharePct != null)
    rows.push({
      label: "Door bos",
      value: `±${env.forestSharePct}% (indicatie)`,
    })

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label-xs text-white/35">ROUTE-PASPOORT</span>
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
          Vertrek
          <input
            type="datetime-local"
            value={departAt}
            onChange={(e) => setDepartAt(e.target.value)}
            className="rounded-md border border-border bg-control px-2 py-1 font-sans text-[12px] text-white/80 focus:border-accent-cyan/40 focus:outline-none [color-scheme:dark]"
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
          Verkeerslichten en bos-aandeel (een extra controlelaag uit
          OpenStreetMap) konden nu niet worden opgehaald. De route zelf is
          gewoon berekend door de routemotor.
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
              className="rounded-full border border-white/[0.12] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/60 transition hover:border-accent-cyan/40 hover:text-accent-cyan"
            >
              Vlakker
            </button>
            <button
              type="button"
              onClick={() => onAdjust("hilly")}
              className="rounded-full border border-white/[0.12] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/60 transition hover:border-accent-cyan/40 hover:text-accent-cyan"
            >
              Meer klimmen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Fietscomputer-sync (Garmin / Wahoo) ─────────────────────────────────────
// Cloud-naar-cloud, zoals Komoot: één keer je account koppelen, daarna zet
// Sparki een route rechtstreeks in je Garmin/Wahoo-account en verschijnt hij
// vanzelf op je fietscomputer. Eerlijke toestanden: zolang de fabrikant onze
// serverkoppeling nog niet heeft goedgekeurd, staat dat er gewoon — niets
// wordt gefaket.
function DeviceSyncBlock({ routeId }: { routeId: number }) {
  useDeviceSyncOAuthReturn()
  const { data } = useDeviceSyncStatus()
  const connect = useConnectDevice()
  const send = useSendRouteToDevice()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const providers = data?.providers ?? []
  if (providers.length === 0) return null
  const anyConfigured = providers.some((p) => p.configured)

  return (
    <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
        Naar je fietscomputer
      </p>
      {!anyConfigured ? (
        <p className="mt-1.5 text-[12px] leading-relaxed text-white/50">
          Rechtstreeks versturen naar Garmin en Wahoo is gebouwd en wacht
          alleen nog op goedkeuring van de fabrikanten. Tot die tijd werkt
          downloaden (GPX/TCX) of &ldquo;Naar app&rdquo; gewoon.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          {providers.map((p) =>
            !p.configured ? (
              <span
                key={p.provider}
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/30"
              >
                {p.label}: wacht op goedkeuring fabrikant
              </span>
            ) : p.connected ? (
              <button
                key={p.provider}
                type="button"
                disabled={send.isPending}
                onClick={() => {
                  setMessage(null)
                  setError(null)
                  send.mutate(
                    { routeId, provider: p.provider },
                    {
                      onSuccess: (r) => setMessage(r.message),
                      onError: (e) =>
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Versturen is niet gelukt.",
                        ),
                    },
                  )
                }}
                className="rounded-full bg-accent-cyan/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-on-accent transition hover:bg-accent-cyan disabled:opacity-40"
              >
                {send.isPending
                  ? "Bezig…"
                  : `Zet op mijn ${p.label}`}
              </button>
            ) : (
              <button
                key={p.provider}
                type="button"
                disabled={connect.isPending}
                onClick={() => {
                  setError(null)
                  connect.mutate(p.provider, {
                    onError: (e) =>
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Koppelen is niet gelukt.",
                      ),
                  })
                }}
                className="rounded-full border border-white/[0.14] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 transition hover:border-accent-cyan/40 hover:text-accent-cyan disabled:opacity-40"
              >
                Koppel {p.label}
              </button>
            ),
          )}
        </div>
      )}
      {message && (
        <p className="mt-2 text-[11px] text-accent-cyan/85">{message}</p>
      )}
      {error && (
        <p className="mt-2 text-[11px] text-negative/85">
          {error}
        </p>
      )}
    </div>
  )
}

function RouteCard({
  route,
  onAdjust,
  onEditWaypoints,
}: {
  route: SparkiRoute
  onAdjust?: (pref: ElevationPreference) => void
  onEditWaypoints?: (route: SparkiRoute, returnToNav?: boolean) => void
}) {
  const del = useDeleteRoute()
  const download = useDownloadRoute()
  const share = useShareRoute()
  const [gpxError, setGpxError] = useState<string | null>(null)
  // Gestructureerde training voor de navigatie: alleen een ECHT gekoppelde
  // geplande training (route ↔ workout), nooit een gok. FTP komt uit het echte
  // profiel; zonder FTP toont de navigatie eerlijk alleen zones.
  const { data: upcomingForNav } = useUpcomingWorkouts()
  const { data: dashboardForNav } = useAthleteDashboard()
  const navWorkout =
    route.linkedPlannedWorkoutId != null
      ? (upcomingForNav ?? []).find(
          (w) =>
            w.id === route.linkedPlannedWorkoutId && w.structure != null,
        ) ?? null
      : null
  const navFtp = dashboardForNav?.athleteProfile?.ftp ?? null
  // Navigation-open state lives in the URL (?nav=<id>) instead of React state:
  // on phones the browser tab can reload while the system Bluetooth chooser or
  // another app is in the foreground, and plain state would silently dump the
  // rider out of navigation. With the URL as source of truth, a reload lands
  // straight back in the open navigation window.
  const [pathname, setLocation] = useLocation()
  const search = useSearch()
  const navigating = new URLSearchParams(search).get("nav") === String(route.id)
  const setNavigating = (open: boolean) => {
    const params = new URLSearchParams(window.location.search)
    if (open) params.set("nav", String(route.id))
    else params.delete("nav")
    const q = params.toString()
    setLocation(`${pathname}${q ? `?${q}` : ""}`, { replace: !open })
  }
  const [showPassport, setShowPassport] = useState(false)
  // Rit-optiesmenu: verschijnt na een tik op "Navigeer", vóór de navigatie
  // opent. Bij een deep-link (?nav=… zonder menu, bv. terug uit de
  // routebouwer) geldt de laatst bewaarde keuze — de intervalregel blijft
  // dan ook gewoon van kracht.
  // De routeverkenner opent het menu via ?ritopties=<id> (na sluiten van de
  // verkenner-overlay), zodat óók die "Navigeer"-knop eerst langs de keuzes
  // gaat.
  const [manualOptionsOpen, setManualOptionsOpen] = useState(false)
  const urlOptionsOpen =
    new URLSearchParams(search).get("ritopties") === String(route.id)
  const rideOptionsOpen = manualOptionsOpen || urlOptionsOpen
  const closeRideOptions = () => {
    setManualOptionsOpen(false)
    if (urlOptionsOpen) {
      const params = new URLSearchParams(window.location.search)
      params.delete("ritopties")
      const q = params.toString()
      setLocation(`${pathname}${q ? `?${q}` : ""}`, { replace: true })
    }
  }
  const [chosenRideOptions, setChosenRideOptions] =
    useState<RideOptions | null>(null)
  // Het stappenplan kan lang zijn — standaard ingeklapt zodat de acties
  // eronder (navigeren, downloads) direct zichtbaar blijven.
  const [showSteps, setShowSteps] = useState(false)
  // Delen-menu: bestand naar app, link kopiëren, WhatsApp of een voorstel
  // aan een fietsmaatje (alleen geaccepteerde vrienden).
  const [shareOpen, setShareOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showFriendPick, setShowFriendPick] = useState(false)
  const [proposalSent, setProposalSent] = useState(false)
  const { data: friendsData } = useFriends()
  const cardFriends = friendsData?.friends ?? []
  const propose = useProposeRoute()
  // `?? "/"`: onder Vite bestaat import.meta.env altijd; in de node-page-tests
  // (tsx, geen Vite) niet — daar volstaat de root-basis.
  const shareLink = `${window.location.origin}${import.meta.env?.BASE_URL ?? "/"}routes?view=bewaard&route=${route.id}`
  const profile = route.profile ?? []
  const climbs = route.climbs ?? []
  const nav = route.nav ?? []
  const geometry = route.geometry ?? []
  const canExport = geometry.length > 1

  // Interactief hoogteprofiel ↔ kaart: gedeelde km-positie (twee-weg sync).
  const [posKm, setPosKm] = useState<number | null>(null)
  const [focusPoint, setFocusPoint] = useState<{
    lat: number
    lon: number
    seq: number
  }>()
  // Routeopmerkingen uit echte OSM-gegevens (server, gecachet).
  const remarksQuery = useRouteRemarks(geometry.length > 1 ? route.id : null)
  // Verificatiestatus (taak #505, fail-closed): iedere route heeft exact één
  // status — pending (meting loopt), verified_clear, hard_blocked of
  // unverifiable (kaartbron gaf geen antwoord). Alleen verified_clear toont
  // "Klaar" en activeert NAVIGEER; pending/unverifiable worden nooit stil als
  // veilig behandeld. De server weigert navigatiestart bovendien zelf (409).
  // "geen_route" = geen bruikbare geometrie (geen verificatie-oordeel maar
  // simpelweg niets om te navigeren); NAVIGEER blijft dan ook uit. Waar de
  // server het expliciete verification-veld meestuurt, is dát leidend.
  const hardBlocked = remarksQuery.data?.blockage?.hard === true
  const serverVerification = remarksQuery.data?.verification
  const verification: "pending" | "verified_clear" | "hard_blocked" | "unverifiable" | "geen_route" =
    geometry.length <= 1
      ? "geen_route"
      : remarksQuery.isError
        ? "unverifiable"
        : remarksQuery.data == null
          ? "pending"
          : serverVerification === "hard_blocked" || hardBlocked
            ? "hard_blocked"
            : "verified_clear"
  const canNavigate = verification === "verified_clear"
  // Gravel/MTB: onverhard is daar juist gewénst — een "onverhard"-opmerking is
  // dan informatie (staat in de lijst en de wegdekverdeling), geen
  // waarschuwingsmarker die de kaart vol uitroeptekens zet.
  const unpavedIsWelcome = /gravel|mtb|mountain/i.test(route.surface ?? "")
  const remarkMarkers = groupRemarkMarkers(
    (remarksQuery.data?.remarks ?? []).filter(
      (r) => !(unpavedIsWelcome && r.kind === "onverhard"),
    ),
  )
  // Wegtypen & ondergrond + geschiktheid per fietstype (echte OSM-tags).
  const surfacesQuery = useRouteSurfaces(geometry.length > 1 ? route.id : null)
  const [surfaceKind, setSurfaceKind] = useState<SurfaceKind | null>(null)
  const surfaceHighlights =
    surfaceKind && surfacesQuery.data?.surfaces
      ? surfacesQuery.data.surfaces.segments
          .filter((s) => s.kind === surfaceKind)
          .map((s) => ({
            positions: geometry.slice(s.fromIdx, s.toIdx + 1),
            color: SURFACE_COLORS[surfaceKind],
          }))
      : []
  // Wedstrijdroute? Dan levert de bestaande route-detailroute een race-blok
  // met UITSLUITEND actieve (bevestigde/aangepaste) punten — die tonen we
  // boven het hoogteprofiel. Geen wedstrijd = geen extra fetch-resultaat.
  const raceBlockQuery = useQuery({
    queryKey: ["route-race-block", route.id],
    enabled: route.usageType === "wedstrijd",
    staleTime: 5 * 60_000,
    queryFn: () =>
      apiFetch<{ race?: { points: RacePoint[] } | null }>(
        `/api/routes/${route.id}`,
      ),
    select: (d) => d.race?.points ?? [],
  })
  const profileMarkers: ProfileMarker[] = [
    ...(route.distanceKm != null && route.distanceKm > 0
      ? ([
          { km: 0, label: "Start", kind: "start" },
          { km: route.distanceKm, label: "Finish", kind: "finish" },
        ] as ProfileMarker[])
      : []),
    ...climbs
      .filter((c) => Number.isFinite(c.summitKm))
      .map((c) => ({
        km: c.summitKm as number,
        label: `Top: ${c.name}`,
        kind: "klim" as const,
      })),
    ...(raceBlockQuery.data ?? [])
      .filter((p) => p.raceKm != null)
      .map((p) => ({
        km: p.raceKm as number,
        label: p.label,
        kind: (p.pointClass === "wedstrijd"
          ? "wedstrijd"
          : "info") as ProfileMarker["kind"],
      })),
    // Routeopmerkingen (echte OSM-gegevens) ook op het hoogteprofiel —
    // gegroepeerd, zodat het profiel niet vol losse uitroeptekens staat.
    ...groupProfileRemarkMarkers(remarksQuery.data?.remarks ?? []),
  ]

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
    <div
      id={`route-card-${route.id}`}
      className="rounded-xl border border-border bg-map-panel/[0.82] p-4 backdrop-blur-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-44">
          <div className="flex min-w-0 items-center gap-2">
            <DsStatus
              status={
                verification === "hard_blocked"
                  ? "fout"
                  : verification === "verified_clear"
                    ? "positief"
                    : verification === "geen_route"
                      ? "neutraal"
                      : "waarschuwing"
              }
              className="shrink-0"
            >
              {verification === "hard_blocked"
                ? "Geblokkeerd"
                : verification === "pending"
                  ? "Controle loopt"
                  : verification === "unverifiable"
                    ? "Niet gecontroleerd"
                    : verification === "geen_route"
                      ? "Geen routelijn"
                      : route.status === "ready"
                        ? "Klaar"
                        : route.status}
            </DsStatus>
            <span className="font-mono text-[9px] uppercase text-white/25">
              · {route.source}
            </span>
          </div>
          <h3 className="mt-1 line-clamp-2 font-sans text-lg font-light leading-snug tracking-tight text-white/90">
            {route.name}
          </h3>
          {hardBlocked && (
            <p className="mt-1.5 rounded-md border border-negative/25 bg-negative/10 px-2.5 py-1.5 text-[11px] leading-snug text-negative/90">
              Deze route bevat harde blokkades (fietsverbod, trap of afgesloten
              poort/privéterrein) en kan niet genavigeerd worden. Genereer een
              nieuwe route — de routemaker keurt zulke routes tegenwoordig af.
            </p>
          )}
        </div>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-3">
          {canNavigate && (
            <button
              type="button"
              onClick={() => setManualOptionsOpen(true)}
              title="Open het navigatievenster — volgt je live positie op de kaart"
              className="flex items-center gap-1.5 rounded-full bg-accent-cyan/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-on-accent transition hover:bg-accent-cyan"
            >
              <Navigation className="h-3.5 w-3.5" strokeWidth={2} />
              Navigeer
            </button>
          )}
          {canExport && (
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShareOpen((v) => !v)}
                  title="Deel deze route — als bestand, link of via WhatsApp"
                  className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 transition hover:text-accent-cyan/80"
                >
                  <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Delen
                </button>
                {shareOpen && (
                  <div className="absolute right-0 top-7 z-30 w-56 rounded-xl border border-white/[0.12] bg-map-scrim p-1.5 shadow-xl shadow-black/50">
                    {canShareRouteFiles() && (
                      <button
                        type="button"
                        onClick={() => {
                          setShareOpen(false)
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
                        className="block w-full rounded-lg px-3 py-2 text-left text-[12px] text-white/75 transition hover:bg-surface-strong disabled:opacity-40"
                      >
                        Bestand naar app (GPX)
                        <span className="mt-0.5 block text-[10px] text-white/35">
                          Garmin Connect, Komoot, Wahoo…
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        setShareOpen(false)
                        setGpxError(null)
                        try {
                          await navigator.clipboard.writeText(shareLink)
                          setLinkCopied(true)
                          window.setTimeout(() => setLinkCopied(false), 2500)
                        } catch {
                          setGpxError(
                            "Kopiëren lukte niet — selecteer en kopieer de link handmatig: " +
                              shareLink,
                          )
                        }
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-[12px] text-white/75 transition hover:bg-surface-strong"
                    >
                      {linkCopied ? (
                        <span className="inline-flex items-center gap-1">
                          <IconCheck className="h-3.5 w-3.5" aria-hidden />
                          Link gekopieerd
                        </span>
                      ) : (
                        "Link kopiëren"
                      )}
                      <span className="mt-0.5 block text-[10px] text-white/35">
                        Werkt voor iedereen met een Sparki-account
                      </span>
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `Fiets je mee? Route "${route.name}"${
                          route.distanceKm ? ` (${route.distanceKm} km)` : ""
                        } in Sparki: ${shareLink}`,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setShareOpen(false)}
                      className="block w-full rounded-lg px-3 py-2 text-left text-[12px] text-white/75 transition hover:bg-surface-strong"
                    >
                      Via WhatsApp
                      <span className="mt-0.5 block text-[10px] text-white/35">
                        Stuur de link naar wie je wilt
                      </span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowFriendPick((v) => !v)}
                      className="block w-full rounded-lg px-3 py-2 text-left text-[12px] text-white/75 transition hover:bg-surface-strong"
                    >
                      {proposalSent ? (
                        <span className="inline-flex items-center gap-1">
                          <IconCheck className="h-3.5 w-3.5" aria-hidden />
                          Voorstel verstuurd
                        </span>
                      ) : (
                        "Stel voor aan fietsmaatje"
                      )}
                      <span className="mt-0.5 block text-[10px] text-white/35">
                        Je maatje kan accepteren, afwijzen of aanpassen
                      </span>
                    </button>
                    {showFriendPick && (
                      <div className="border-t border-white/[0.08] pt-1">
                        {cardFriends.length === 0 ? (
                          <p className="px-3 py-2 text-[11px] text-white/40">
                            Nog geen fietsmaatjes — voeg eerst iemand toe via
                            Samen.
                          </p>
                        ) : (
                          cardFriends.map((f) => (
                            <button
                              key={f.clerkId}
                              type="button"
                              disabled={propose.isPending}
                              onClick={() => {
                                setGpxError(null)
                                propose.mutate(
                                  { routeId: route.id, toClerkId: f.clerkId },
                                  {
                                    onSuccess: () => {
                                      setProposalSent(true)
                                      setShowFriendPick(false)
                                      setShareOpen(false)
                                      window.setTimeout(
                                        () => setProposalSent(false),
                                        3000,
                                      )
                                    },
                                    onError: (e) =>
                                      setGpxError(
                                        e instanceof Error
                                          ? e.message
                                          : "Voorstel versturen mislukt",
                                      ),
                                  },
                                )
                              }}
                              className="block w-full rounded-lg px-3 py-1.5 text-left text-[12px] text-accent-cyan/85 transition hover:bg-surface-strong disabled:opacity-40"
                            >
                              → {f.displayName}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => exportRoute("gpx")}
                disabled={download.isPending}
                title="Download als GPX voor je fietscomputer"
                className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 transition hover:text-accent-cyan/80 disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                GPX
              </button>
              <button
                type="button"
                onClick={() => exportRoute("tcx")}
                disabled={download.isPending}
                title="Download als TCX-course — meest betrouwbare navigatie op Garmin/Wahoo"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 transition hover:text-accent-cyan/80 disabled:opacity-40"
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
        <p className="mt-2 text-[11px] text-negative/85">
          {gpxError}
        </p>
      )}

      {canExport && <DeviceSyncBlock routeId={route.id} />}

      {geometry.length > 1 && (
        <RouteMap
          geometry={geometry}
          climbs={climbs}
          height={430}
          className="mt-4"
          positionKm={posKm}
          onTrackPositionSelect={setPosKm}
          remarkMarkers={remarkMarkers}
          focusPoint={focusPoint}
          highlightPaths={surfaceHighlights}
        />
      )}

      {profile.length > 0 && (
        <InteractiveElevationProfile
          profile={profile}
          distanceKm={route.distanceKm}
          markers={profileMarkers}
          positionKm={posKm}
          onPositionChange={setPosKm}
        />
      )}

      {geometry.length > 1 && (
        <RouteSurfacesPanel
          data={surfacesQuery.data}
          isLoading={surfacesQuery.isLoading}
          isError={surfacesQuery.isError}
          selectedKind={surfaceKind}
          onSelectKind={setSurfaceKind}
          preferredBike={preferredBikeFromSurface(route.surface)}
          className="mt-4"
        />
      )}

      {geometry.length > 1 && (
        <RouteRemarksPanel
          data={remarksQuery.data}
          isLoading={remarksQuery.isLoading}
          isError={remarksQuery.isError}
          onShowOnMap={(r: RouteRemark) => {
            setPosKm(r.routeKm)
            setFocusPoint((f) => ({ lat: r.lat, lon: r.lon, seq: (f?.seq ?? 0) + 1 }))
          }}
          className="mt-4"
        />
      )}

      {/* Volgauto is uitsluitend een wedstrijdvoorziening: alleen tonen bij
          expliciet als wedstrijd gemarkeerde routes (usageType "wedstrijd" —
          dezelfde grendel als het race-blok hierboven). Op gewone trainings-,
          MTB- of gravelroutes ontbreekt de optie volledig — geen verborgen of
          uitgeschakelde onzin-optie. Bugmelding René 30-07-2026. */}
      {geometry.length > 1 && route.usageType === "wedstrijd" && (
        <VolgautoPanel
          routeId={route.id}
          bikeDistanceKm={route.distanceKm}
          bikeDurationSec={route.durationSec}
          className="mt-4"
        />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <button
          type="button"
          onClick={() => setShowPassport((s) => !s)}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-cyan transition hover:text-accent-cyan/90"
        >
          {showPassport ? "− route-paspoort" : "+ route-paspoort"}
        </button>
        {onEditWaypoints && geometry.length > 1 && (
          <button
            type="button"
            onClick={() => onEditWaypoints(route)}
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45 transition hover:text-accent-cyan/80"
          >
            + wijzig met routepunten
          </button>
        )}
      </div>
      {showPassport && <RoutePassport route={route} onAdjust={onAdjust} />}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-4">
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

      <TempoBlock
        distanceKm={route.distanceKm}
        routerDurationSec={route.durationSec}
      />

      <Climbs climbs={climbs} />

      {route.rationale && (
        <p className="mt-4 whitespace-pre-line text-[12px] leading-relaxed text-white/55">
          {route.rationale}
        </p>
      )}

      <NavigateInfoCard />

      {nav.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowSteps((s) => !s)}
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-cyan transition hover:text-accent-cyan/90"
          >
            {showSteps
              ? "− stappenplan verbergen"
              : `+ stappenplan (${nav.length} stappen)`}
          </button>
          {showSteps && (
            <div className="mt-2 flex flex-col">
              {nav.map((n, i) => (
                <div
                  key={i}
                  className="flex items-baseline gap-3 border-b border-white/[0.05] py-2.5 last:border-0"
                >
                  <span className="w-12 shrink-0 font-mono text-[11px] tabular-nums text-accent-cyan/70">
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
          )}
        </div>
      ) : (
        <p className="mt-4 text-[12px] text-white/30">
          Stap-voor-stap navigatie nog niet beschikbaar voor deze route
        </p>
      )}

      {/* Sterren-beoordeling op de bewaarde route — vaste audit-input. */}
      <BuildRatingBlock
        subjectType="bewaarde_route"
        subjectId={String(route.id)}
        question="Hoe bevalt deze route?"
        className="mt-4"
      />

      {rideOptionsOpen && (
        <RideOptionsMenu
          workout={navWorkout}
          onClose={closeRideOptions}
          onStart={(opts) => {
            setChosenRideOptions(opts)
            closeRideOptions()
            setNavigating(true)
          }}
        />
      )}

      {navigating && (
        <RouteNavigator
          name={route.name}
          geometry={geometry}
          nav={nav}
          distanceKm={route.distanceKm ?? null}
          climbs={route.climbs}
          elevationProfile={route.profile}
          routeId={route.id}
          workout={navWorkout}
          ftp={navFtp}
          rideOptions={
            chosenRideOptions ??
            applyFocusRules(loadLastRideOptions(), navWorkout)
          }
          rideOptionsExplicit={chosenRideOptions != null}
          onClose={() => setNavigating(false)}
          onEditRoute={
            onEditWaypoints
              ? () => {
                  // Sluit de navigatie netjes (URL-param weg) en open de
                  // routebouwer met de echte punten van deze route. Na het
                  // bewaren keert de rijder vanzelf terug in de navigatie.
                  setNavigating(false)
                  onEditWaypoints(route, true)
                }
              : null
          }
        />
      )}
    </div>
  )
}

const inputClass =
  "w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-accent-cyan/40 focus:outline-none"

// Vertaal echte routegeometrie naar een handvol sleepbare routepunten voor de
// eigen-route-bouwer. We kiezen gelijkmatig verdeelde punten uit de ECHTE lijn
// (nooit verzonnen posities); bij een lus vervalt het dubbele eindpunt.
function sampleWaypointsFromGeometry(
  geometry: [number, number][],
  n = 8,
): RouteWaypoint[] {
  if (geometry.length < 2) return []
  const first = geometry[0]!
  const last = geometry[geometry.length - 1]!
  const isLoop =
    Math.abs(first[0] - last[0]) < 0.0005 && Math.abs(first[1] - last[1]) < 0.0005
  const usable = isLoop ? geometry.slice(0, -1) : geometry
  const count = Math.min(n, usable.length)
  const points: RouteWaypoint[] = []
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i * (usable.length - 1)) / Math.max(1, count - 1))
    const p = usable[idx]!
    points.push([p[0], p[1]])
  }
  // Bij een lus sluit de bouwer de route door het eerste punt óók als laatste
  // te plaatsen, zodat het een rondje blijft.
  if (isLoop && points.length >= 2) points.push([first[0], first[1]])
  return points
}

// Export voor de node-page-test van de racefiets-verificatiegate
// (route-panel-verification-gate.test.tsx) — geen app-gebruik buiten RoutePanel.
export function RouteGenerator({
  onClose,
  initialElevation = null,
  initialWaypoints = null,
  initialGeometry = null,
  onSaved = null,
  initialSamen = null,
}: {
  onClose: () => void
  initialElevation?: ElevationPreference | null
  initialWaypoints?: RouteWaypoint[] | null
  initialGeometry?: [number, number][] | null
  // Bestaande samen-rijden-context (bijv. bij "route aanpassen" vanuit een
  // lopende navigatie) — vult de keuze voor, zodat die niet stilletjes
  // verloren gaat.
  initialSamen?: { withOthers: boolean; maten: string[] } | null
  // Na een geslaagde opslag krijgt de aanroeper de ECHTE bewaarde route terug
  // (bijv. om direct de navigatie ervan te openen), plus de samen-rijden-keuze
  // zodat die de navigatie in kan (bordjes-sprint + gekozen maten).
  onSaved?:
    | ((
        route: SparkiRoute,
        samen: { withOthers: boolean; maten: string[]; navigeer?: boolean },
      ) => void)
    | null
}) {
  const generate = useGenerateRoute()
  const genOptions = useGenerateRouteOptions()
  const save = useSaveGeneratedRoute()
  // RequestId guard: prevents a slow in-flight request from overwriting a newer one.
  const generateReqId = useRef(0)
  const {
    data: workouts,
    isError: workoutsError,
  } = useUpcomingWorkouts()
  // Zoeken in overige echte trainingen (zelfde centrale kalenderbron, breder
  // venster). Pas actief zodra de rijder echt zoekt — nooit een tweede bron.
  const [workoutSearch, setWorkoutSearch] = useState("")
  const searchActive = workoutSearch.trim().length >= 2
  const { data: searchWorkouts } = useWorkoutSearch(searchActive)
  const { data: dashboard } = useAthleteDashboard()
  // Samen rijden: hier — bij het samenstellen van de route — kies je of je
  // alleen of met anderen fietst. "Met anderen" zet het bordjes-sprintspel aan
  // en laat je echte vrienden kiezen om mee te rijden. De keuze reist mee de
  // navigatie in; daar hoef je niets meer in te stellen.
  const { data: friendsData } = useFriends()
  const friends = friendsData?.friends ?? []
  const [withOthers, setWithOthers] = useState(
    initialSamen?.withOthers ?? false,
  )
  const [buddyIds, setBuddyIds] = useState<string[]>(initialSamen?.maten ?? [])

  const [mode, setMode] = useState<"loop" | "ptp" | "waypoints">(
    initialWaypoints && initialWaypoints.length >= 2 ? "waypoints" : "loop",
  )
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
  // Onverhard-voorkeur (taak #440): gewenst percentage onverhard, alleen
  // instelbaar voor gravel/MTB. Racefiets/gewone fiets: vast 0 (harde grens,
  // taak #437). Een voorkeur voor de kandidaatselectie — nooit een garantie.
  // Taak #446: de laatst gekozen waarde wordt per fietstype onthouden in
  // localStorage (per apparaat — dit is een presentatievoorkeur voor de
  // schuifbalk, geen profieldata; een servervoorkeur zou hier zwaarder zijn
  // dan nodig en het gedrag blijft eerlijk hetzelfde per apparaat).
  const [unpavedPct, setUnpavedPct] = useState(() =>
    readStoredUnpavedPct("gravel") ?? 30,
  )
  const unpavedAdjustable = bikeType === "gravel" || bikeType === "mtb"
  // Bij wisselen van fietstype: laad de onthouden waarde voor dát type
  // (gravel en MTB hebben elk een eigen geheugen). Racefiets blijft vast 0
  // via `unpavedAdjustable` — de opgeslagen gravel/MTB-waarde blijft bewaard.
  useEffect(() => {
    if (!unpavedAdjustable) return
    setUnpavedPct(readStoredUnpavedPct(bikeType) ?? 30)
  }, [bikeType, unpavedAdjustable])
  function chooseUnpavedPct(value: number) {
    setUnpavedPct(value)
    if (!unpavedAdjustable) return
    try {
      localStorage.setItem(`sparki:unpaved-pct:${bikeType}`, String(value))
    } catch {
      // localStorage kan geweigerd worden (privacy-modus) — schuifbalk werkt
      // dan gewoon zonder geheugen.
    }
  }
  // Vermijd drukke N-wegen (taak #462, kalibratie René 30-07-2026): standaard
  // uit ("balans — korte stukken N-weg zijn oké"), maar expliciet aan te
  // zetten. Voorkeur-straf in de routemotor; lukt het in een gebied niet, dan
  // zegt Sparki dat eerlijk via het avoid-rapport. Onthouden per apparaat.
  const [avoidBusyRoads, setAvoidBusyRoads] = useState(() => {
    try {
      return localStorage.getItem("sparki:avoid-n-roads") === "1"
    } catch {
      return false
    }
  })
  function chooseAvoidBusyRoads(value: boolean) {
    setAvoidBusyRoads(value)
    try {
      localStorage.setItem("sparki:avoid-n-roads", value ? "1" : "0")
    } catch {
      // localStorage kan geweigerd worden (privacy-modus) — toggle werkt dan
      // gewoon zonder geheugen.
    }
  }
  const [trainingType, setTrainingType] = useState("duurtraining")
  const [workoutId, setWorkoutId] = useState<string>("")
  const [distance, setDistance] = useState("40")
  const [wish, setWish] = useState("")
  const [destination, setDestination] = useState("")
  const [start, setStart] = useState<{ lat: number; lon: number } | null>(null)
  // De ECHTE positie van de rijder (alleen gezet na geslaagde geolocatie) —
  // los van `start`, want een startpunt kan ook een kaart-tik elders zijn.
  const [myLoc, setMyLoc] = useState<[number, number] | null>(null)
  const [geoState, setGeoState] = useState<"idle" | "loading" | "error">("idle")
  // Counter that forces the builder map to jump to the rider's position at
  // street-level zoom every time "Centreer op mij" is tapped.
  const [focusMe, setFocusMe] = useState(0)
  const [candidate, setCandidate] = useState<RouteCandidate | null>(null)
  // Enrich: poll for AI-phrased rationale + road objects after first generation.
  const enrich = useEnrichRoute(candidate?.candidateId)
  // Update the candidate's rationale when the background enrichment completes.
  // Also update on failure: the server returns the deterministic fallback
  // rationale so the UI can show it permanently instead of staying in "laden…".
  useEffect(() => {
    const d = enrich.data
    if (!d) return
    if (d.ready && d.rationale) {
      setCandidate((c) => c ? { ...c, rationale: d.rationale! } : c)
    } else if (d.failed && d.rationale) {
      // Overwrite with server-side fallback (may differ from the initial quick
      // fallback if race conditions produced a different one).
      setCandidate((c) => c ? { ...c, rationale: d.rationale! } : c)
    }
  }, [enrich.data?.ready, enrich.data?.failed, enrich.data?.rationale])
  // Interactief hoogteprofiel voor de voorgestelde route (kaartklik blijft in
  // de bouwer voor verzamelpunten — positie kiezen gaat hier via het profiel).
  const [candPosKm, setCandPosKm] = useState<number | null>(null)
  // Routeopmerkingen-voorproef op de echte kandidaat-geometrie.
  const candRemarks = useRouteRemarksPreview(candidate?.geometry ?? null)
  // Wegtypen-voorproef + geschiktheid per fietstype op de kandidaat.
  const candSurfaces = useRouteSurfacesPreview(
    candidate?.geometry ?? null,
    candidate?.profile ?? null,
    candidate?.distanceKm ?? null,
    candidate?.candidateId ?? null,
  )
  const [candSurfaceKind, setCandSurfaceKind] = useState<SurfaceKind | null>(null)
  // Racefiets-verificatiegate (afkeurregel taak #487): een kandidaat met
  // onbekend (niet-geverifieerd) wegdek wordt nooit als geschikt
  // gepresenteerd en kan alleen na een expliciete keuze worden gebruikt.
  // Bron: het wegdekscherm (na BGT/GRB-aanvulling) zodra geladen, anders de
  // motor-meting op de kandidaat zelf.
  const candSchermOnbekendPct = candSurfaces.data?.surfaces
    ? (candSurfaces.data.surfaces.breakdown.find((b) => b.kind === "onbekend")
        ?.pct ?? 0)
    : null
  const candVerification = candidate
    ? racefietsVerification(
        candidate.bikeType,
        candidate.engineSurface?.knownPct ?? null,
        candSchermOnbekendPct,
      )
    : null
  const [unknownAccepted, setUnknownAccepted] = useState(false)
  // De expliciete keuze geldt per kandidaat — een andere route = opnieuw kiezen.
  useEffect(() => {
    setUnknownAccepted(false)
  }, [candidate?.candidateId])
  const needsUnknownChoice =
    candVerification?.status === "niet_volledig_geverifieerd" && !unknownAccepted
  // Onbekende segmenten meteen op de kaart markeren zodra bekend is dat de
  // route niet volledig geverifieerd is (locatie-eis uit de afkeurregel).
  useEffect(() => {
    if (candVerification?.status === "niet_volledig_geverifieerd")
      setCandSurfaceKind((k) => k ?? "onbekend")
  }, [candVerification?.status])
  const candSurfaceHighlights =
    candSurfaceKind && candidate && candSurfaces.data?.surfaces
      ? candSurfaces.data.surfaces.segments
          .filter((s) => s.kind === candSurfaceKind)
          .map((s) => ({
            positions: candidate.geometry.slice(s.fromIdx, s.toIdx + 1),
            color: SURFACE_COLORS[candSurfaceKind],
          }))
      : []
  // Loop mode: the 3 distance variants (korter/gevraagd/langer) to choose from.
  const [options, setOptions] = useState<RouteCandidate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Eerlijke tussenmelding (taak #503): de blokkadepoort wacht bij een vers
  // gebied blokkerend op de volledige Overpass-meting (~10–30 s eenmalig).
  // Na een drempel van 3 s tonen we WAT er loopt — geen voortgangsbalk of
  // verzonnen percentages, alleen eerlijke tekst. Warme aanvragen (~0 ms)
  // halen de drempel nooit en zien niets extra's.
  const [slowNotice, setSlowNotice] = useState(false)
  useEffect(() => {
    if (!generate.isPending || (mode !== "waypoints" && mode !== "ptp")) {
      setSlowNotice(false)
      return
    }
    const t = setTimeout(() => setSlowNotice(true), 3000)
    return () => clearTimeout(t)
  }, [generate.isPending, mode])

  // Wizard: vier duidelijke stappen, daarna een apart resultaatscherm.
  // Zodra er een berekende route (of varianten) is, verdwijnen de stappen en
  // toont alleen het resultaat — terugkeren kan altijd.
  const [step, setStep] = useState(1)
  const showResult = options !== null || candidate !== null
  const stepVisible = (n: number) => !showResult && step === n

  // Interactive builder state (mode === "waypoints"). Bij "route wijzigen"
  // start de bouwer met punten uit de ECHTE bestaande routelijn: eerste punt
  // wordt startpunt, laatste punt eindpunt, de rest tussenpunten.
  const hasInitial = Boolean(initialWaypoints && initialWaypoints.length >= 2)
  const [startPoint, setStartPoint] = useState<RouteWaypoint | null>(
    hasInitial ? initialWaypoints![0]! : null,
  )
  const [endPoint, setEndPoint] = useState<RouteWaypoint | null>(
    hasInitial ? initialWaypoints![initialWaypoints!.length - 1]! : null,
  )
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>(
    hasInitial ? initialWaypoints!.slice(1, -1) : [],
  )
  const [meetpoints, setMeetpoints] = useState<RouteMeetpoint[]>([])
  // Tijdstip van de laatste verwerkte kaart-tik voor verzamelpunten — vangnet
  // tegen omgevingen die één tik als meerdere click-events afvuren.
  const lastMeetpointClickRef = useRef(0)
  // Referentielijn tijdens puntenbewerking: de bestaande (echte) routelijn
  // blijft zichtbaar zolang er nog GEEN punt is gewijzigd. Zodra een punt
  // verandert klopt de lijn niet meer en verdwijnt hij (eerlijk beeld).
  const [bewerkLijn, setBewerkLijn] = useState<[number, number][] | null>(
    hasInitial ? (initialGeometry ?? null) : null,
  )
  const [placeMode, setPlaceMode] = useState<
    "start" | "waypoint" | "end" | "meetpoint"
  >("start")

  // Volgorde op de kaart en voor de routeberekening: start → tussen → eind.
  const allPoints: RouteWaypoint[] = [
    ...(startPoint ? [startPoint] : []),
    ...waypoints,
    ...(endPoint ? [endPoint] : []),
  ]
  const allRoles: ("start" | "via" | "end")[] = [
    ...(startPoint ? ["start" as const] : []),
    ...waypoints.map(() => "via" as const),
    ...(endPoint ? ["end" as const] : []),
  ]

  // Zodra een routebepalend punt wijzigt (toevoegen, verslepen, verwijderen)
  // klopt een eerder berekende route niet meer. De oude blauwe lijn en de
  // eerdere varianten verdwijnen dan direct — eerlijk beeld, geen verouderde
  // lijn die niet bij de punten past. Opnieuw genereren tekent de nieuwe route.
  function invalidateStaleRoute() {
    setCandidate(null)
    setOptions(null)
    setBewerkLijn(null)
  }

  // Combined index (kaartmarker) → welk punt het is.
  function updatePointAt(i: number, next: RouteWaypoint | null) {
    invalidateStaleRoute()
    const startCount = startPoint ? 1 : 0
    if (startPoint && i === 0) {
      setStartPoint(next)
    } else if (endPoint && i === startCount + waypoints.length) {
      setEndPoint(next)
    } else {
      const vi = i - startCount
      setWaypoints((w) =>
        next
          ? w.map((p, idx) => (idx === vi ? next : p))
          : w.filter((_, idx) => idx !== vi),
      )
    }
  }

  const linkedWorkout = workoutId
    ? workouts?.find((w) => String(w.id) === workoutId)
    : undefined

  // Startpunt via adres/plaatsnaam zoeken — naast "Gebruik mijn locatie", zodat
  // je ook een route kunt plannen die ergens anders begint (vakantie, clubrit).
  const geocode = useGeocode()
  const [adresQ, setAdresQ] = useState("")
  const [adresResults, setAdresResults] = useState<GeocodeResult[] | null>(null)

  function zoekStartAdres() {
    const q = adresQ.trim()
    if (q.length < 2 || geocode.isPending) return
    setError(null)
    setAdresResults(null)
    geocode.mutate(q, {
      onSuccess: (d) => setAdresResults(d.results),
      onError: (e) =>
        setError(e instanceof Error ? e.message : "Kon adres niet zoeken"),
    })
  }

  function kiesStartAdres(r: GeocodeResult) {
    invalidateStaleRoute()
    // `start` centreert de kaart én is het startpunt voor lus/A→B.
    setStart({ lat: r.lat, lon: r.lon })
    if (mode === "waypoints") {
      // In de eigen-route-bouwer is het groene S-punt het echte startpunt.
      setStartPoint([r.lat, r.lon])
      setPlaceMode("waypoint")
    }
    setAdresResults(null)
    setAdresQ(r.label)
  }

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
        setMyLoc([pos.coords.latitude, pos.coords.longitude])
        setFocusMe((f) => f + 1)
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
        unpavedPreferencePct:
          sport === "cycling" && unpavedAdjustable ? unpavedPct : undefined,
        avoidBusyRoads:
          sport === "cycling" && avoidBusyRoads ? true : undefined,
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
    if (mode === "waypoints") {
      if (allPoints.length < 2) {
        setError(
          "Plaats minstens twee punten op de kaart (bijv. een start- en een eindpunt)",
        )
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
    // Increment the request counter so an in-flight slow request can't overwrite
    // a newer one when the user taps again before the first result arrives.
    generateReqId.current += 1
    const myReqId = generateReqId.current
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
        waypoints: mode === "waypoints" ? allPoints : undefined,
        seed: nextSeed,
        wish: wish.trim() ? wish.trim() : undefined,
        unpavedPreferencePct:
          sport === "cycling" && unpavedAdjustable ? unpavedPct : undefined,
        avoidBusyRoads:
          sport === "cycling" && avoidBusyRoads ? true : undefined,
      },
      {
        onSuccess: (data) => {
          if (generateReqId.current !== myReqId) return // stale response
          setCandidate(data.candidate)
        },
        onError: (e) =>
          setError(e instanceof Error ? e.message : "Routegeneratie mislukt"),
      },
    )
  }

  // navigeer=true: na het bewaren direct het rit-optiesmenu van de bewaarde
  // route openen (de "Bewaar & navigeer"-knop) — zelfde pad als de
  // Navigeer-knop op een bewaarde routekaart.
  function saveCandidate(navigeer = false) {
    if (!candidate) return
    // Verificatiegate (taak #487): zonder expliciete keuze wordt een
    // racefietsroute met onbekend wegdek nooit opgeslagen of gestart.
    if (needsUnknownChoice) {
      setError(
        "Deze route bevat onbekend wegdek en is niet geverifieerd voor de racefiets. Bevestig eerst expliciet dat je hem toch wilt gebruiken.",
      )
      return
    }
    save.mutate(
      { candidate, meetpoints },
      {
        onSuccess: (data) => {
          setCandidate(null)
          setOptions(null)
          setStartPoint(null)
          setEndPoint(null)
          setWaypoints([])
          setMeetpoints([])
          // Eén situatie: sluit de generator zodat alleen de bewaarde
          // routekaart (met navigeren/GPX/TCX/delen) overblijft.
          onClose()
          onSaved?.(data.route, { withOthers, maten: buddyIds, navigeer })
        },
        onError: (e) =>
          setError(e instanceof Error ? e.message : "Opslaan mislukt"),
      },
    )
  }

  // Drop a named meeting point ("verzamelpunt") — e.g. a spot to pick up a
  // friend — independent of the route-shaping waypoints.
  // Toggle-gedrag: een tik dicht bij een bestaand verzamelpunt (±150 m)
  // verwijdert dát punt in plaats van er nóg een naast te zetten — een net
  // gemiste tik op de pin leverde anders een cluster van extra pins op.
  function addMeetpoint(lat: number, lon: number) {
    // Dubbel-/tripleklikbescherming: sommige omgevingen vuren één "tik" als
    // meerdere click-events af; binnen 500 ms verwerken we er maar één.
    const now = Date.now()
    if (now - lastMeetpointClickRef.current < 500) return
    lastMeetpointClickRef.current = now
    setMeetpoints((m) => {
      // Kies expliciet het DICHTSTBIJZIJNDE punt binnen de drempel — bij twee
      // verzamelpunten binnen 150 m zou "eerste match" anders het verkeerde
      // punt kunnen verwijderen.
      let near = -1
      let best = 150
      m.forEach((p, idx) => {
        const dLat = (p.lat - lat) * 111_000
        const dLon =
          (p.lon - lon) * 111_000 * Math.cos((lat * Math.PI) / 180)
        const d = Math.hypot(dLat, dLon)
        if (d < best) {
          best = d
          near = idx
        }
      })
      if (near !== -1) return m.filter((_, idx) => idx !== near)
      return [...m, { lat, lon, name: `Verzamelpunt ${m.length + 1}`, note: null }]
    })
  }

  // Builder: a map click adds either a route-shaping waypoint or a meetpoint,
  // depending on the active place-mode. In lus/A→B mode a tap simply sets the
  // startpoint — the map is the primary input, not a hidden extra.
  function handleMapClick(lat: number, lon: number) {
    if (mode !== "waypoints") {
      invalidateStaleRoute()
      setStart({ lat, lon })
      return
    }
    if (placeMode === "start") {
      invalidateStaleRoute()
      setStartPoint([lat, lon])
      // Na het startpunt wil je vrijwel altijd tussenpunten plaatsen —
      // automatisch doorschakelen voorkomt dat een tweede tik je startpunt
      // per ongeluk verplaatst.
      setPlaceMode("waypoint")
    } else if (placeMode === "end") {
      invalidateStaleRoute()
      setEndPoint([lat, lon])
      setPlaceMode("waypoint")
    } else if (placeMode === "waypoint") {
      invalidateStaleRoute()
      setWaypoints((w) => [...w, [lat, lon]])
    } else {
      // Verzamelpunten bepalen de route niet — de lijn blijft gewoon kloppen.
      addMeetpoint(lat, lon)
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-map-panel/[0.82] p-5 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-cyan" strokeWidth={1.75} />
          <span className="font-mono text-[10px] tracking-[0.22em] text-accent-cyan/80">
            ROUTE PLANNEN
          </span>
        </div>
        {(initialWaypoints || initialElevation) && (
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[10px] text-white/35 transition hover:text-white/60"
          >
            begin opnieuw
          </button>
        )}
      </div>

      {/* Stappenteller — vier duidelijke stappen, resultaat apart */}
      {!showResult && (
        <div className="mt-4 flex items-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => n < step && setStep(n)}
              className="flex items-center gap-2"
              disabled={n >= step}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[11px] ${
                  n === step
                    ? "border-accent-cyan/60 bg-accent-cyan/[0.12] text-accent-cyan"
                    : n < step
                      ? "border-white/[0.12] bg-transparent text-accent-cyan/55"
                      : "border-white/[0.12] bg-transparent text-white/35"
                }`}
              >
                {n}
              </span>
              {n < 4 && <span className="h-px w-4 bg-white/10" />}
            </button>
          ))}
          <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
            {step === 1
              ? "Waar rijd je?"
              : step === 2
                ? "Fiets & training"
                : step === 3
                  ? "Wensen & samen"
                  : "Controleren"}
          </span>
        </div>
      )}

      {/* Stap 1 — vorm: bepaalt wat je op de kaart doet */}
      {stepVisible(1) && (<>
      <div className="mt-5">
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          WAT VOOR ROUTE?
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
              className={`flex-1 rounded-xl border py-2.5 text-[13px] transition-colors ${mode === m.v ? "border-accent-cyan/50 bg-accent-cyan/[0.12] text-accent-cyan" : "border-white/10 bg-transparent text-white/60"}`}
            >
              {m.l}
            </button>
          ))}
        </div>
      </div>

      {/* Stap 2 — de kaart: hét hart van de planner, altijd direct zichtbaar.
          Lus/A→B: tik = startpunt. Eigen route: tik = punten plaatsen. */}
      <div className="mt-4">
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          KIES OP DE KAART
        </label>
        <p className="text-[12px] leading-relaxed text-white/40">
          {mode === "waypoints"
            ? placeMode === "start"
              ? "Tik op de kaart om je startpunt (groene S) te zetten. Daarna schakelt de kaart automatisch door naar routepunten."
              : placeMode === "end"
                ? "Tik op de kaart om je eindpunt (oranje F) te zetten. Opnieuw tikken in deze stand verplaatst het eindpunt."
                : placeMode === "waypoint"
                  ? "Tik op de kaart om routepunten te plaatsen. Sleep een punt om het te verplaatsen, tik erop om het te verwijderen. De route wordt via de échte wegen berekend."
                  : "Tik op de kaart om een verzamelpunt te plaatsen (bijv. clubhuis of café). Verzamelpunten bepalen niet de route — ze markeren waar je samenkomt."
            : start
              ? "Startpunt staat op de kaart — versleep de S of tik ergens anders om hem te verplaatsen."
              : "Tik op de kaart waar je wilt starten, of gebruik je eigen locatie."}
        </p>
        <RouteMap
          geometry={
            candidate?.geometry ??
            // Referentielijn hoort alleen bij de puntenbewerker — in lus/A→B
            // zou hij een lijn tonen die niets met het startpunt te maken heeft.
            (mode === "waypoints" ? (bewerkLijn ?? []) : [])
          }
          waypoints={
            mode === "waypoints"
              ? allPoints
              : start
                ? [[start.lat, start.lon]]
                : []
          }
          waypointRoles={mode === "waypoints" ? allRoles : ["start"]}
          meetpoints={meetpoints}
          center={start ? [start.lat, start.lon] : [52.1, 5.3]}
          myLocation={myLoc ?? undefined}
          focusMyLocation={focusMe}
          height={420}
          className="mt-2.5"
          onMapClick={handleMapClick}
          onWaypointDrag={(i, lat, lon) => {
            if (mode === "waypoints") {
              updatePointAt(i, [lat, lon])
            } else {
              invalidateStaleRoute()
              setStart({ lat, lon })
            }
          }}
          onWaypointClick={(i) => {
            if (mode === "waypoints") {
              updatePointAt(i, null)
            } else {
              invalidateStaleRoute()
              setStart(null)
            }
          }}
          onMeetpointClick={(i) =>
            setMeetpoints((m) => m.filter((_, idx) => idx !== i))
          }
        />
        {/* Startpunt zoeken op adres/plaatsnaam — alternatief naast eigen locatie */}
        <div className="mt-2.5">
          <div className="flex gap-2">
            <input
              type="text"
              value={adresQ}
              onChange={(e) => setAdresQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  zoekStartAdres()
                }
              }}
              placeholder="Startpunt zoeken — adres of plaats…"
              aria-label="Startpunt zoeken op adres of plaats"
              className="min-w-0 flex-1 rounded-xl border border-white/[0.12] bg-transparent px-3.5 py-2 font-sans text-[13px] text-white/80 placeholder:text-white/30 focus:border-accent-cyan/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={zoekStartAdres}
              disabled={adresQ.trim().length < 2 || geocode.isPending}
              className="rounded-xl border border-white/[0.14] px-3.5 py-2 font-sans text-[12px] text-white/70 transition hover:border-accent-cyan/30 disabled:opacity-40"
            >
              {geocode.isPending ? "Zoeken…" : "Zoek"}
            </button>
          </div>
          {adresResults && adresResults.length === 0 && (
            <p className="mt-1.5 text-[12px] text-white/40">
              Geen plek gevonden voor &ldquo;{adresQ.trim()}&rdquo; — probeer een
              vollediger adres of andere plaatsnaam.
            </p>
          )}
          {adresResults && adresResults.length > 0 && (
            <ul className="mt-1.5 overflow-hidden rounded-xl border border-white/[0.1]">
              {adresResults.map((r, i) => (
                <li key={`${r.lat},${r.lon},${i}`}>
                  <button
                    type="button"
                    onClick={() => kiesStartAdres(r)}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-left font-sans text-[12px] text-white/70 transition hover:bg-accent-cyan/10 hover:text-white"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-white/40" strokeWidth={1.75} />
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={geoState === "loading"}
            className="flex items-center gap-2 rounded-full border border-white/[0.14] px-3.5 py-2 font-sans text-[12px] text-white/70 transition hover:border-accent-cyan/30 disabled:opacity-50"
          >
            <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
            {geoState === "loading" ? "Locatie ophalen…" : "Gebruik mijn locatie"}
          </button>
          {mode === "waypoints" ? (
            <span className="font-mono text-[10px] text-white/40">
              {startPoint ? (
                <>
                  start <IconCheck className="inline h-3 w-3" aria-hidden /> ·{" "}
                </>
              ) : null}
              {endPoint ? (
                <>
                  eind <IconCheck className="inline h-3 w-3" aria-hidden /> ·{" "}
                </>
              ) : null}
              {waypoints.length} routepunt{waypoints.length === 1 ? "" : "en"} ·{" "}
              {meetpoints.length} verzamelpunt
              {meetpoints.length === 1 ? "" : "en"}
            </span>
          ) : (
            start && (
              <span className="font-mono text-[10px] text-white/40">
                Startpunt: {start.lat.toFixed(4)}, {start.lon.toFixed(4)}
              </span>
            )
          )}
          {mode === "waypoints" &&
            (allPoints.length > 0 || meetpoints.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  invalidateStaleRoute()
                  setStartPoint(null)
                  setEndPoint(null)
                  setWaypoints([])
                  setMeetpoints([])
                  setPlaceMode("start")
                }}
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40 transition hover:text-negative/85"
              >
                wis alles
              </button>
            )}
        </div>
      </div>
      </>)}

      {/* Sport — only shown when more than one sport family is active */}
      {stepVisible(2) && SPORT_OPTIONS.length > 1 && (
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
              className={`flex flex-col items-center rounded-xl border py-2.5 transition-colors ${
                sport === s.value
                  ? "border-accent-cyan/50 bg-accent-cyan/[0.12]"
                  : "border-white/10 bg-transparent"
              }`}
            >
              <span
                className={`text-[12px] font-medium ${sport === s.value ? "text-accent-cyan" : "text-white/60"}`}
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
      {stepVisible(2) && sport === "cycling" && (
        <div className="mt-4">
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            FIETSTYPE
          </label>
          {derivedBike && !bikeTouched && (
            <p className="mb-2 text-[11px] leading-relaxed text-accent-cyan/55">
              Voorgekozen op basis van je discipline. Pas aan als je vandaag een
              andere fiets pakt.
            </p>
          )}
          <div className="flex gap-2">
            {BIKE_OPTIONS.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => chooseBike(b.value)}
                className={`flex flex-1 flex-col items-center rounded-xl border py-2.5 transition-colors ${bikeType === b.value ? "border-accent-cyan/50 bg-accent-cyan/[0.12]" : "border-white/10 bg-transparent"}`}
              >
                <span
                  className={`text-[13px] font-medium ${bikeType === b.value ? "text-accent-cyan" : "text-white/60"}`}
                >
                  {b.label}
                </span>
                <span className="font-mono text-[9px] text-white/30">
                  {b.hint}
                </span>
              </button>
            ))}
          </div>

          {/* Onverhard-voorkeur (taak #440): schuifbalk voor gravel/MTB;
              racefiets/gewone fiets vast op 0 (harde grens, taak #437). */}
          <div className="mt-4">
            <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
              ONVERHARD-VOORKEUR
            </label>
            {unpavedAdjustable ? (
              <>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={5}
                    value={unpavedPct}
                    onChange={(e) => chooseUnpavedPct(Number(e.target.value))}
                    aria-label="Onverhard-voorkeur (percentage)"
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-accent-cyan"
                  />
                  <span className="w-11 text-right font-mono text-[12px] text-accent-cyan">
                    {unpavedPct}%
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">
                  Sparki kiest de kandidaat die hier het dichtst bij komt — een
                  voorkeur, geen garantie op een exact aandeel onverhard.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 opacity-60">
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={5}
                    value={0}
                    disabled
                    aria-label="Onverhard-voorkeur (vast op 0 voor racefiets)"
                    className="h-1.5 flex-1 appearance-none rounded-full bg-white/15"
                  />
                  <span className="w-11 text-right font-mono text-[12px] text-white/50">
                    0%
                  </span>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] leading-relaxed text-white/40">
                  <Lock className="h-3 w-3 shrink-0 text-white/40" aria-hidden />
                  Racefiets: altijd volledig verhard
                </p>
              </>
            )}
          </div>

          {/* Vermijd drukke N-wegen (taak #462): expliciete keuze naast de
              onverhard-voorkeur. Voorkeur in de routemotor — geen garantie;
              lukt het niet, dan meldt Sparki dat eerlijk bij het resultaat. */}
          <div className="mt-4">
            <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
              DRUKKE WEGEN
            </label>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={avoidBusyRoads}
                onChange={(e) => chooseAvoidBusyRoads(e.target.checked)}
                aria-label="Vermijd drukke N-wegen"
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-white/25 bg-white/10 accent-accent-cyan"
              />
              <span className="text-[12px] leading-relaxed text-white/70">
                Vermijd drukke N-wegen
                <span className="mt-0.5 block text-[11px] text-white/40">
                  Sparki stuurt de route waar mogelijk om doorgaande wegen
                  zonder vrijliggend fietspad heen — een voorkeur, geen
                  garantie. Lukt het in dit gebied niet, dan zegt Sparki dat
                  erbij. Standaard staat dit uit: korte stukken N-weg zijn oké.
                </span>
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Elevation preference */}
      {stepVisible(2) && (<>
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
              className={`flex-1 rounded-xl border py-2.5 text-[13px] transition-colors ${elevationPreference === e.value ? "border-accent-cyan/50 bg-accent-cyan/[0.12] text-accent-cyan" : "border-white/10 bg-transparent text-white/60"}`}
            >
              {e.label}
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
          {(() => {
            // Alleen echte, nog niet aan een uitvoering gekoppelde trainingen
            // uit de centrale kalender (planned_workouts) van de sporter zelf.
            const linkable = (w: PlannedWorkout) =>
              w.sessionId == null &&
              w.status !== "completed" &&
              w.status !== "skipped" &&
              w.status !== "cancelled"
            const nearby = (workouts ?? []).filter(linkable)
            const q = workoutSearch.trim().toLowerCase()
            const extra = searchActive
              ? (searchWorkouts ?? []).filter(
                  (w) =>
                    linkable(w) &&
                    !nearby.some((n) => n.id === w.id) &&
                    (w.title.toLowerCase().includes(q) ||
                      w.scheduledDate.includes(q)),
                )
              : []
            return (
              <>
                <select
                  className={inputClass}
                  value={workoutId}
                  onChange={(e) => {
                    setWorkoutId(e.target.value)
                    const w =
                      nearby.find((x) => String(x.id) === e.target.value) ??
                      extra.find((x) => String(x.id) === e.target.value)
                    if (w) setTrainingType(w.type || trainingType)
                  }}
                >
                  <option value="">Geen</option>
                  {nearby.map((w) => (
                    <option key={w.id} value={String(w.id)}>
                      {w.scheduledDate} · {w.title}
                    </option>
                  ))}
                  {extra.length > 0 && (
                    <optgroup label="Overige trainingen (zoekresultaat)">
                      {extra.map((w) => (
                        <option key={w.id} value={String(w.id)}>
                          {w.scheduledDate} · {w.title}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <input
                  className={`${inputClass} mt-2`}
                  type="text"
                  placeholder="Zoek in overige trainingen…"
                  value={workoutSearch}
                  onChange={(e) => setWorkoutSearch(e.target.value)}
                />
                {workoutsError ? (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-negative/70">
                    Je trainingen konden niet worden geladen. Probeer het
                    later opnieuw — er worden nooit voorbeeldtrainingen
                    getoond.
                  </p>
                ) : nearby.length === 0 && !searchActive ? (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-white/35">
                    Geen open trainingen rond vandaag in je kalender. Plan
                    een training in of zoek hierboven in je overige
                    trainingen.
                  </p>
                ) : searchActive && extra.length === 0 ? (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-white/35">
                    Geen overige trainingen gevonden voor “{workoutSearch.trim()}”.
                  </p>
                ) : null}
              </>
            )
          })()}
        </div>
      </div>
      </>)}

      {/* Distance (loop, manual) */}
      {stepVisible(1) && mode === "loop" && (
        <div className="mt-4">
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            DOELAFSTAND (KM)
          </label>
          <input
            className={inputClass}
            type="number"
            min={3}
            max={300}
            value={linkedWorkout?.targetDurationMin ? "" : distance}
            placeholder={
              linkedWorkout?.targetDurationMin
                ? `≈ afgeleid uit ${linkedWorkout.targetDurationMin}m training`
                : "40"
            }
            onChange={(e) => setDistance(e.target.value)}
            disabled={!!linkedWorkout?.targetDurationMin}
          />
          {!!linkedWorkout?.targetDurationMin && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/35">
              De afstand volgt uit de gekoppelde training.
            </p>
          )}
        </div>
      )}

      {/* Destination (ptp) */}
      {stepVisible(1) && mode === "ptp" && (
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

      {/* Interactive builder — waypoints + verzamelpunten */}
      {stepVisible(1) && mode === "waypoints" && (
        <div className="mt-4">
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            TEKEN JE EIGEN ROUTE
          </label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { v: "start", l: "Startpunt", icon: MapPin },
                { v: "waypoint", l: "Routepunt", icon: Flag },
                { v: "end", l: "Eindpunt", icon: Flag },
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
                  className={`flex min-w-[calc(50%-4px)] flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-[13px] transition-colors sm:min-w-0 ${active ? "border-accent-cyan/50 bg-accent-cyan/[0.12] text-accent-cyan" : "border-white/10 bg-transparent text-white/60"}`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {p.l}
                </button>
              )
            })}
          </div>

          {/* Puntenlijst — start → routepunten → finish, elk punt wisbaar.
              Altijd zichtbaar in de bouwer: ontbrekende punten tonen een
              duidelijke placeholder-regel die de plaats-modus activeert. */}
          <div className="mt-3 flex flex-col gap-2">
            {startPoint ? (
              <PointRow
                icon={<MapPin className="h-3.5 w-3.5 shrink-0 text-positive/90" strokeWidth={1.75} />}
                label="Startpunt"
                point={startPoint}
                onRemove={() => {
                  invalidateStaleRoute()
                  setStartPoint(null)
                  setPlaceMode("start")
                }}
              />
            ) : (
              <PlaceholderRow
                icon={<MapPin className="h-3.5 w-3.5 shrink-0 text-white/30" strokeWidth={1.75} />}
                label="Startpunt"
                hint="Tik op de kaart om je startpunt te plaatsen"
                active={placeMode === "start"}
                onClick={() => setPlaceMode("start")}
              />
            )}
            {waypoints.map((p, i) => (
              <PointRow
                key={`${p[0]}-${p[1]}-${i}`}
                icon={<Flag className="h-3.5 w-3.5 shrink-0 text-accent-cyan" strokeWidth={1.75} />}
                label={`Routepunt ${i + 1}`}
                point={p}
                onRemove={() => {
                  invalidateStaleRoute()
                  setWaypoints((w) => w.filter((_, idx) => idx !== i))
                }}
              />
            ))}
            {endPoint ? (
              <PointRow
                icon={<Flag className="h-3.5 w-3.5 shrink-0 text-warning/90" strokeWidth={1.75} />}
                label="Finish"
                point={endPoint}
                onRemove={() => {
                  invalidateStaleRoute()
                  setEndPoint(null)
                }}
              />
            ) : (
              <PlaceholderRow
                icon={<Flag className="h-3.5 w-3.5 shrink-0 text-white/30" strokeWidth={1.75} />}
                label="Finish"
                hint="Tik op de kaart om je eindpunt te plaatsen — of laat leeg voor een rondje"
                active={placeMode === "end"}
                onClick={() => setPlaceMode("end")}
              />
            )}
          </div>

          {/* Editable meeting-point list */}
          <MeetpointList meetpoints={meetpoints} setMeetpoints={setMeetpoints} />
        </div>
      )}

      {/* Free-text wish — applies to every mode */}
      {stepVisible(3) && (<>
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
          Hier wordt rekening mee gehouden. Kan een wens niet worden ingevuld,
          dan hoor je dat — met een passend alternatief.
        </p>
      </div>

      {error && (
        <p className="mt-3 text-[12px] text-negative/85">{error}</p>
      )}

      {/* Samen rijden? — de plek waar je bordjes-sprint en je maten kiest. */}
      <div className="mt-4 border-t border-white/[0.08] pt-4">
        <span className="label-xs text-white/35">SAMEN RIJDEN?</span>
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setWithOthers(false)
              setBuddyIds([])
            }}
            className={`rounded-full px-3.5 py-1.5 font-sans text-[12px] transition ${
              !withOthers
                ? "bg-accent-cyan text-on-accent"
                : "border border-white/10 text-white/55 hover:text-white/85"
            }`}
          >
            Alleen
          </button>
          <button
            type="button"
            onClick={() => setWithOthers(true)}
            className={`rounded-full px-3.5 py-1.5 font-sans text-[12px] transition ${
              withOthers
                ? "bg-accent-cyan text-on-accent"
                : "border border-white/10 text-white/55 hover:text-white/85"
            }`}
          >
            Met anderen
          </button>
        </div>
        {withOthers && (
          <div className="mt-2.5">
            <p className="text-[12px] leading-relaxed text-white/50">
              Sprinten om plaatsbordjes staat aan — gas erop bij de komborden.
              Na het bewaren opent de navigatie direct met deze instelling.
            </p>
            {friends.length > 0 ? (
              <>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                  Wie fietst er mee?
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {friends.map((f) => {
                    const active = buddyIds.includes(f.clerkId)
                    return (
                      <button
                        key={f.clerkId}
                        type="button"
                        onClick={() =>
                          setBuddyIds((ids) =>
                            active
                              ? ids.filter((id) => id !== f.clerkId)
                              : [...ids, f.clerkId],
                          )
                        }
                        className={`rounded-full px-3 py-1.5 font-sans text-[12px] transition ${
                          active
                            ? "border border-accent-cyan/50 bg-accent-cyan/15 text-accent-cyan"
                            : "border border-white/10 text-white/55 hover:text-white/85"
                        }`}
                      >
                        {f.displayName}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-white/35">
                Nog geen vrienden gekoppeld — voeg ze toe via Samen, dan kun je
                ze hier kiezen. Sprinten om bordjes werkt ook zonder.
              </p>
            )}
          </div>
        )}
      </div>
      </>)}

      {/* Stap 4 — samenvatting: alles nog één keer nalopen vóór het rekenen */}
      {stepVisible(4) && (
        <div className="mt-5 rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4">
          <span className="label-xs text-white/35">JOUW KEUZES</span>
          <div className="mt-2.5 flex flex-col gap-1.5 text-[13px] text-white/75">
            <p>
              <span className="text-white/40">Route: </span>
              {mode === "loop"
                ? "Lus (rondje)"
                : mode === "ptp"
                  ? "A → B"
                  : "Eigen route"}
              {mode === "loop" &&
                (linkedWorkout?.targetDurationMin
                  ? ` · afstand volgt uit de gekoppelde training`
                  : ` · doel ${distance || "40"} km`)}
              {mode === "ptp" &&
                (destination.trim() ? ` · naar ${destination.trim()}` : "")}
              {mode === "waypoints" &&
                ` · ${allPoints.length} punt${allPoints.length === 1 ? "" : "en"}`}
            </p>
            <p>
              <span className="text-white/40">Start: </span>
              {mode === "waypoints"
                ? startPoint
                  ? `${startPoint[0].toFixed(4)}, ${startPoint[1].toFixed(4)}`
                  : "nog niet geplaatst"
                : start
                  ? `${start.lat.toFixed(4)}, ${start.lon.toFixed(4)}`
                  : "nog niet gekozen"}
            </p>
            <p>
              <span className="text-white/40">Fiets & hoogte: </span>
              {sport === "cycling"
                ? BIKE_OPTIONS.find((b) => b.value === bikeType)?.label ?? bikeType
                : SPORT_OPTIONS.find((s) => s.value === sport)?.label ?? sport}
              {" · "}
              {ELEVATION_OPTIONS.find((e) => e.value === elevationPreference)
                ?.label ?? elevationPreference}
            </p>
            <p>
              <span className="text-white/40">Training: </span>
              {linkedWorkout
                ? `gekoppeld aan ${linkedWorkout.title}`
                : trainingType.charAt(0).toUpperCase() + trainingType.slice(1)}
            </p>
            {wish.trim() && (
              <p>
                <span className="text-white/40">Wens: </span>
                {wish.trim()}
              </p>
            )}
            <p>
              <span className="text-white/40">Gezelschap: </span>
              {withOthers
                ? `je rijdt met anderen (bordjes-sprint aan${
                    buddyIds.length > 0
                      ? `, ${buddyIds.length} maat${buddyIds.length === 1 ? "" : "jes"}`
                      : ""
                  })`
                : "je rijdt alleen"}
            </p>
          </div>
        </div>
      )}

      {!showResult && (
        <div className="mx-auto mt-4 flex w-full max-w-md gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-white/[0.12] py-3.5 font-sans text-[13px] text-white/60 transition-colors hover:border-white/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Terug
            </button>
          )}
          {step < 4 ? (
            <button
              type="button"
              onClick={() => {
                // Eerlijke controle vóór het doorgaan: zonder plek op de kaart
                // valt er niets te berekenen.
                if (step === 1) {
                  setError(null)
                  if (mode === "waypoints") {
                    if (allPoints.length < 2) {
                      setError(
                        "Plaats minstens twee punten op de kaart (bijv. een start- en een eindpunt)",
                      )
                      return
                    }
                  } else if (!start) {
                    setError("Kies eerst een startpunt (gebruik je locatie)")
                    return
                  } else if (mode === "ptp" && !destination.trim()) {
                    setError("Vul een bestemming in voor een A→B route")
                    return
                  }
                }
                setStep((s) => Math.min(4, s + 1))
              }}
              className="min-w-0 flex-1 rounded-2xl bg-accent-cyan py-3.5 font-sans text-[13px] font-semibold text-on-accent"
            >
              Verder →
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                mode === "loop" ? runGenerateOptions() : runGenerate()
              }
              disabled={generate.isPending || genOptions.isPending}
              className="min-w-0 flex-1 rounded-2xl bg-accent-cyan py-3.5 font-sans text-[13px] font-semibold text-on-accent disabled:opacity-50"
            >
              {generate.isPending || genOptions.isPending
                ? "Berekenen…"
                : mode === "waypoints"
                  ? "Bereken route"
                  : "Genereer route"}
            </button>
          )}
        </div>
      )}

      {/* Eerlijke tussenmelding bij een lang lopende aanvraag (taak #503):
          de blokkadepoort wacht bij een vers gebied blokkerend op de volledige
          Overpass-meting — eenmalig ~10–30 s. Geen voortgangsbalk, alleen
          eerlijke tekst na een drempel van 3 s. */}
      {slowNotice && generate.isPending && !showResult && (
        <p className="mt-3 text-[12px] leading-relaxed text-accent-cyan/75">
          Sparki controleert de route op blokkades (fietsverbod, trappen,
          afgesloten poorten) — bij een nieuw gebied kan dit eenmalig tientallen
          seconden duren.
        </p>
      )}

      {/* Resultaatscherm — eigen weergave, los van de stappen */}
      {showResult && (
        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.22em] text-accent-cyan/80">
            RESULTAAT
          </span>
          <button
            type="button"
            onClick={() => {
              setCandidate(null)
              setOptions(null)
              setMeetpoints([])
              setStep(4)
            }}
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45 transition hover:text-accent-cyan/80"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" /> terug naar de stappen
          </button>
        </div>
      )}

      {/* Loop mode: pick one of the 3 distance variants Sparki proposed */}
      {mode === "loop" && options && !candidate && (
        <div className="mt-5 border-t border-white/[0.08] pt-5">
          <span className="label-xs text-white/35">KIES JE ROUTE</span>
          <p className="mt-1 text-[12px] leading-relaxed text-white/40">
            {options.length > 1
              ? "Varianten rond je gekozen afstand — korter, zoals gevraagd en langer. Bekijk de kaart en het hoogteprofiel en kies wat past."
              : "Rond deze afstand is één passende lus gevonden. Kies hem om de details en navigatie te zien."}
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            {options.map((o) => (
              <div
                key={o.candidateId}
                className="min-w-0 rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4 transition-colors hover:border-accent-cyan/40"
              >
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5">
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.16em]"
                    style={{ color: ACCENT }}
                  >
                    {(o as RouteCandidate & { variant?: string }).variant ??
                      "Route"}
                  </span>
                  <span className="font-sans text-2xl font-light tracking-tight text-white/90">
                    {o.distanceKm != null
                      ? `${Math.round(o.distanceKm)} km`
                      : "—"}
                  </span>
                </div>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 font-mono text-[11px] tabular-nums text-white/45">
                  <span className="whitespace-nowrap">
                    {o.elevationGainM != null
                      ? `${o.elevationGainM} m omhoog`
                      : "—"}
                  </span>
                  <span>·</span>
                  <span className="whitespace-nowrap">
                    {formatDuration(o.durationSec)}
                  </span>
                </div>
                {(() => {
                  // Taak #487: een racefiets-variant met onbekend wegdek
                  // wordt nooit als geschikt gepresenteerd — eerlijk labelen.
                  const v = racefietsVerification(
                    o.bikeType,
                    o.engineSurface?.knownPct ?? null,
                    null,
                  )
                  return v?.status === "niet_volledig_geverifieerd" ? (
                    <p className="mt-1.5 inline-block rounded-full border border-warning/35 px-2 py-px font-mono text-[10px] uppercase tracking-[0.08em] text-warning/85">
                      Niet volledig geverifieerd ·{" "}
                      {String(v.onbekendPct).replace(".", ",")}% onbekend wegdek
                    </p>
                  ) : null
                })()}
                {o.geometry.length > 1 && (
                  <RouteMap
                    geometry={o.geometry}
                    height={220}
                    interactive={false}
                    className="mt-3"
                  />
                )}
                {o.profile.length > 0 && (
                  <MiniElevationProfile profile={o.profile} />
                )}
                <button
                  type="button"
                  onClick={() => setCandidate(o)}
                  className="mt-3.5 w-full rounded-xl border border-accent-cyan/30 py-2.5 font-sans text-[13px] font-medium text-accent-cyan/90 transition-colors hover:bg-accent-cyan/[0.08]"
                >
                  Kies deze route
                </button>
              </div>
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
              className="mb-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45 transition hover:text-accent-cyan/80"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Andere afstand kiezen
            </button>
          )}
          <h4 className="font-sans text-lg font-light tracking-tight text-white/90">
            {candidate.name}
          </h4>

          {/* Andere echte voorstellen uit dezelfde generatieronde — de motor
              bouwde meerdere lussen; wissel gerust, de huidige blijft kiesbaar. */}
          {candidate.alternates && candidate.alternates.length > 0 && (
            <div className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                Andere voorstellen uit deze ronde
              </span>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {candidate.alternates.map((a) => (
                  <button
                    key={a.candidateId}
                    type="button"
                    onClick={() => {
                      const rest = [
                        { ...candidate, alternates: undefined },
                        ...(candidate.alternates ?? []).filter(
                          (x) => x.candidateId !== a.candidateId,
                        ),
                      ]
                      setCandidate({ ...a, alternates: rest })
                      setMeetpoints([])
                    }}
                    className="min-w-0 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-left transition-colors hover:border-accent-cyan/40"
                  >
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <span className="font-sans text-lg font-light tracking-tight text-white/90">
                        {a.distanceKm != null
                          ? `${Math.round(a.distanceKm)} km`
                          : "—"}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-white/45">
                        {a.elevationGainM != null
                          ? `${a.elevationGainM} m omhoog`
                          : "—"}
                      </span>
                    </div>
                    {a.geometry.length > 1 && (
                      <RouteMap
                        geometry={a.geometry}
                        height={140}
                        interactive={false}
                        className="mt-2"
                      />
                    )}
                    <span className="mt-2 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-accent-cyan/80">
                      Bekijk dit voorstel
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {candidate.geometry.length > 1 && (
            <>
              <p className="mt-4 text-[12px] leading-relaxed text-white/40">
                Tik op de route om een verzamelpunt te plaatsen — bijvoorbeeld om
                een vriend op te halen. Tik op een pin om hem te verwijderen.
                Verzamelpunten veranderen de route niet; het zijn markeringen die
                met de route worden bewaard.
              </p>
              <RouteMap
                geometry={candidate.geometry}
                climbs={candidate.climbs}
                meetpoints={meetpoints}
                onMapClick={addMeetpoint}
                onMeetpointClick={(i) =>
                  setMeetpoints((m) => m.filter((_, idx) => idx !== i))
                }
                height={430}
                className="mt-3"
                positionKm={candPosKm}
                remarkMarkers={groupRemarkMarkers(
                  (candRemarks.data?.remarks ?? [])
                    // Gravel/MTB: onverhard is gewénst — geen waarschuwings-
                    // marker, wel gewoon zichtbaar in lijst + wegdekverdeling.
                    .filter(
                      (r) =>
                        !(
                          (candidate.bikeType === "gravel" ||
                            candidate.bikeType === "mtb") &&
                          r.kind === "onverhard"
                        ),
                    ),
                )}
                highlightPaths={candSurfaceHighlights}
              />
              <MeetpointList
                meetpoints={meetpoints}
                setMeetpoints={setMeetpoints}
              />
            </>
          )}

          {/* Direct na de kaart: cijfers + acties — zodat meteen duidelijk is
              wat de volgende stap is. Detailpanelen volgen daaronder. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.07] pt-4">
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

          {/* Routenaam — bewerkbaar vóór het bewaren (zoals bij Komoot):
              voorgevuld met de voorgestelde naam, de rijder kan hem hier
              direct aanpassen. Leeg laten valt terug op de voorgestelde naam. */}
          <label className="mt-4 block">
            <span className="font-sans text-[11px] uppercase tracking-wider text-white/40">
              Routenaam
            </span>
            <input
              type="text"
              value={candidate.name}
              maxLength={120}
              onChange={(e) =>
                setCandidate((c) => (c ? { ...c, name: e.target.value } : c))
              }
              onBlur={(e) => {
                if (e.target.value.trim() === "")
                  setCandidate((c) =>
                    c ? { ...c, name: `Route ${new Date().toLocaleDateString("nl-NL")}` } : c,
                  )
              }}
              className="mt-1 w-full rounded-xl border border-white/[0.12] bg-transparent px-3 py-2.5 font-sans text-[14px] text-white/85 outline-none transition-colors focus:border-white/30"
              placeholder="Geef je route een naam"
            />
          </label>

          {candVerification?.status === "niet_volledig_geverifieerd" && (
            <div className="mt-4 rounded-2xl border border-warning/35 bg-warning/[0.05] px-4 py-3.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-warning/90">
                Niet volledig geverifieerd voor de racefiets
              </span>
              <p className="mt-1.5 text-[12px] leading-relaxed text-white/60">
                {candVerification.onbekendPct != null
                  ? `${String(candVerification.onbekendPct).replace(".", ",")}% van het wegdek is onbekend`
                  : "Een deel van het wegdek is onbekend"}
                {candVerification.bron === "motor"
                  ? " volgens de routemotor"
                  : " — ook na controle op de officiële wegenkaart"}
                . Sparki beveelt deze route daarom niet aan als
                racefietsroute; de onbekende stukken zijn grijs gemarkeerd op
                de kaart. Er is geen volledig geverifieerd alternatief
                gevonden — gebruiken kan alleen als jij daar expliciet voor
                kiest.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-white/75">
                  <input
                    type="checkbox"
                    checked={unknownAccepted}
                    onChange={(e) => setUnknownAccepted(e.target.checked)}
                    className="h-4 w-4 accent-warning"
                  />
                  Ik kies er bewust voor deze route met onbekend wegdek te
                  gebruiken
                </label>
                <button
                  type="button"
                  onClick={() => setCandSurfaceKind("onbekend")}
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-warning/80 underline underline-offset-2 transition hover:text-warning/95"
                >
                  Toon onbekende stukken
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => saveCandidate(true)}
              disabled={save.isPending || needsUnknownChoice}
              className="flex min-w-0 flex-1 basis-40 items-center justify-center gap-2 rounded-2xl bg-accent-cyan py-3.5 font-sans text-[13px] font-semibold text-on-accent disabled:opacity-50"
            >
              <Navigation className="h-4 w-4" strokeWidth={2.25} />
              {save.isPending ? "Opslaan…" : "Bewaar & navigeer"}
            </button>
            <button
              type="button"
              onClick={() => saveCandidate(false)}
              disabled={save.isPending || needsUnknownChoice}
              className="min-w-0 flex-1 basis-40 rounded-2xl border border-white/[0.12] py-3.5 font-sans text-[13px] text-white/60 transition-colors hover:border-white/20 disabled:opacity-50"
            >
              {save.isPending ? "Opslaan…" : "Bewaar route"}
            </button>
            <button
              type="button"
              onClick={() => runGenerate(Math.floor(Math.random() * 1e6))}
              disabled={generate.isPending}
              className="min-w-0 flex-1 basis-40 rounded-2xl border border-white/[0.12] py-3.5 font-sans text-[13px] text-white/60 transition-colors hover:border-white/20 disabled:opacity-50"
            >
              {generate.isPending ? "Berekenen…" : "Opnieuw genereren"}
            </button>
            {/* Eerlijke tussenmelding bij lang opnieuw genereren (taak #503) */}
            {slowNotice && generate.isPending && (
              <p className="w-full basis-full text-[12px] leading-relaxed text-accent-cyan/75">
                Sparki controleert de route op blokkades (fietsverbod, trappen,
                afgesloten poorten) — bij een nieuw gebied kan dit eenmalig
                tientallen seconden duren.
              </p>
            )}
            {candidate.geometry.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  // Nieuwe start/eind/tussen-indeling: eerste punt van de
                  // echte lijn wordt startpunt, laatste eindpunt, de rest
                  // tussenpunten. Oude bouwstaat volledig wissen zodat er
                  // geen verdwaald start/eindpunt achterblijft.
                  const pts = sampleWaypointsFromGeometry(candidate.geometry)
                  setStartPoint(pts.length >= 2 ? pts[0]! : null)
                  setEndPoint(pts.length >= 2 ? pts[pts.length - 1]! : null)
                  setWaypoints(pts.length >= 2 ? pts.slice(1, -1) : pts)
                  setPlaceMode("waypoint")
                  setMode("waypoints")
                  // De berekende lijn blijft als referentie op de kaart staan
                  // tot er echt een punt wijzigt — niet meteen opnieuw genereren.
                  setBewerkLijn(candidate.geometry)
                  setCandidate(null)
                  setOptions(null)
                  setMeetpoints([])
                  setStep(1)
                }}
                className="min-w-0 flex-1 basis-40 rounded-2xl border border-white/[0.12] py-3.5 font-sans text-[13px] text-white/60 transition-colors hover:border-white/20"
              >
                Pas aan met routepunten
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-white/35">
            Na het bewaren vind je hieronder de route terug — met navigeren,
            downloaden (GPX/TCX) en delen naar je fietscomputer-app.
          </p>

          {candidate.profile.length > 0 && (
            <InteractiveElevationProfile
              profile={candidate.profile}
              distanceKm={candidate.distanceKm}
              markers={
                candidate.distanceKm != null && candidate.distanceKm > 0
                  ? [
                      { km: 0, label: "Start", kind: "start" },
                      {
                        km: candidate.distanceKm,
                        label: "Finish",
                        kind: "finish",
                      },
                      ...candidate.climbs
                        .filter((c) => Number.isFinite(c.summitKm))
                        .map((c) => ({
                          km: c.summitKm as number,
                          label: `Top: ${c.name}`,
                          kind: "klim" as const,
                        })),
                    ]
                  : []
              }
              positionKm={candPosKm}
              onPositionChange={setCandPosKm}
            />
          )}

          {candidate.geometry.length > 1 && (
            <RouteSurfacesPanel
              data={candSurfaces.data}
              isLoading={candSurfaces.isLoading}
              isError={candSurfaces.isError}
              selectedKind={candSurfaceKind}
              onSelectKind={setCandSurfaceKind}
              preferredBike={preferredBikeFromSurface(candidate.bikeType)}
              className="mt-4"
            />
          )}

          {candidate.geometry.length > 1 && (
            <RouteRemarksPanel
              data={candRemarks.data}
              isLoading={candRemarks.isLoading}
              isError={candRemarks.isError}
              className="mt-4"
            />
          )}

          <Climbs climbs={candidate.climbs} />

          {/* Eerlijk vermijd-rapport (taak #462): lukte het vermijden van
              N-wegen niet in dit gebied, dan zegt Sparki dat expliciet —
              nooit stiekem toch N-weg rijden. */}
          {candidate.avoidReport?.nietMogelijk?.map((item, i) => (
            <p
              key={`avoid-nm-${i}`}
              className="mt-4 rounded-lg border border-warning/25 bg-warning/[0.07] px-3 py-2 text-[12px] leading-relaxed text-warning/90"
            >
              Niet gelukt: {item.wens} — {item.reden}
            </p>
          ))}
          {(candidate.avoidReport?.toegepast?.length ?? 0) > 0 && (
            <p className="mt-4 text-[11px] leading-relaxed text-positive/70">
              Toegepast: {candidate.avoidReport!.toegepast.join(" · ")}
            </p>
          )}

          <p className="mt-4 whitespace-pre-line text-[12px] leading-relaxed text-white/55">
            {candidate.rationale}
          </p>
          {enrich.data?.failed && (
            <p className="mt-1.5 text-[11px] text-white/30">
              De uitgebreide routetoelichting kon niet worden gegenereerd.
            </p>
          )}

          {candidate.nav.length > 0 && (
            <details className="mt-4">
              <summary className="label-xs cursor-pointer list-none text-white/35 transition hover:text-accent-cyan/80">
                STAP-VOOR-STAP ({candidate.nav.length}) — toon
              </summary>
              <div className="mt-2 max-h-64 overflow-y-auto pr-1">
                {candidate.nav.map((n, i) => (
                  <div
                    key={i}
                    className="flex items-baseline gap-3 border-b border-white/[0.05] py-2 last:border-0"
                  >
                    <span className="w-12 shrink-0 font-mono text-[11px] tabular-nums text-accent-cyan/70">
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
            </details>
          )}

          {candidate.plannedWorkoutId != null && (
            <p className="mt-3 font-mono text-[10px] text-white/35">
              Wordt opgeslagen bij de gekoppelde training.
            </p>
          )}

          {/* Sterren-beoordeling op het generatieresultaat (audit-input). */}
          <BuildRatingBlock
            subjectType="gegenereerde_route"
            subjectId={candidate.candidateId}
            question="Hoe goed is deze gegenereerde route?"
            className="mt-4"
          />

        </div>
      )}
    </div>
  )
}

// "Wijzig met routepunten": gesamplede punten van een bestaande route voor de
// eigen-route-bouwer.
type WaypointEdit = {
  routeId: number
  points: RouteWaypoint[]
  // De echte routelijn als referentie op de kaart tot een punt wijzigt.
  geometry: [number, number][] | null
  // Kwam de rijder uit het navigatievenster? Dan gaat hij na het bewaren
  // vanzelf terug de navigatie in (van de aangepaste route).
  returnToNav: boolean
}

// Overdracht over een tabwissel heen (Bewaard → Maken): de tabwissel remount
// RoutePanel, dus component-state overleeft hem niet. De vertrekkende
// instantie zet de punten hier klaar; de nieuwe instantie consumeert ze
// eenmalig in zijn useState-initializer.
let pendingWaypointEdit: WaypointEdit | null = null

export function RoutePanel({
  view = null,
}: {
  // Welk deel van de planner tonen? null = alles (legacy), anders één van de
  // keuzes van het navigatiehoofdscherm.
  view?: "maken" | "gpx" | "bewaard" | null
}) {
  const showMaken = view === null || view === "maken"
  const showGpx = view === null || view === "gpx"
  const showBewaard = view === null || view === "bewaard" || view === "gpx"
  const { data, isLoading } = useRoutes()
  const create = useCreateRoute()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  // Snel een eerder bewaarde route kiezen: compacte lijst met namen; tikken
  // springt direct naar de bijbehorende routekaart hieronder.
  const [showSavedPicker, setShowSavedPicker] = useState(false)
  // Kaart-verkenner: volledig scherm met alle routes op één kaart.
  const [showExplorer, setShowExplorer] = useState(false)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  // Prefill for the generator when the rider steers from a route-paspoort
  // ("Vlakker" / "Meer klimmen"). Key forces a fresh generator instance so the
  // preference actually lands in its state.
  const [genPrefill, setGenPrefill] = useState<ElevationPreference | null>(null)
  // Bestaande route wijzigen: de eigen-route-bouwer start met routepunten uit
  // de echte routelijn. De key remount de generator zodat de punten landen.
  const [genWaypoints, setGenWaypoints] = useState<WaypointEdit | null>(() => {
    // Overdracht van "wijzig met routepunten" over een tabwissel heen: de
    // Bewaard-weergave zet pendingWaypointEdit klaar en wisselt naar Maken;
    // die wissel remount dit paneel, dus de punten komen hier binnen.
    const pending = pendingWaypointEdit
    pendingWaypointEdit = null
    return pending
  })
  const [panelPath, setPanelLocation] = useLocation()
  // Eén lijst, alles ingeklapt (besluit René 30-07-2026): het Bewaard-tabblad
  // toont standaard alleen de compacte routebibliotheek (één lijst, elke route
  // een eigen kaartje). De grote routekaart met kaart/hoogteprofiel/acties
  // verschijnt uitsluitend voor de éne geopende route (?route=, ?nav= of
  // ?ritopties=), met een terugknop naar de lijst. Zo staat elke route nog
  // maar één keer op het scherm in plaats van twee keer (kaarten + lijst).
  const panelSearch = useSearch()
  const selParams = new URLSearchParams(panelSearch)
  const selRaw =
    selParams.get("nav") ?? selParams.get("ritopties") ?? selParams.get("route")
  const selectedId =
    view === "bewaard" && selRaw != null && Number.isFinite(Number(selRaw))
      ? Number(selRaw)
      : null
  const clearSelection = () => {
    const params = new URLSearchParams(window.location.search)
    params.delete("route")
    params.delete("nav")
    params.delete("ritopties")
    const q = params.toString()
    setPanelLocation(`${panelPath}${q ? `?${q}` : ""}`)
  }

  // Na een overdracht: de bouwer staat nu echt op het scherm — er naartoe
  // scrollen zodat de rijder ziet dat zijn routepunten geladen zijn.
  useEffect(() => {
    if (!genWaypoints) return
    const t = setTimeout(() => {
      document
        .getElementById("route-generator")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
    return () => clearTimeout(t)
    // Alleen bij de eerste render met overgedragen punten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function editRouteWaypoints(route: SparkiRoute, returnToNav = false) {
    const points = sampleWaypointsFromGeometry(route.geometry ?? [])
    if (points.length < 2) return
    const edit = {
      routeId: route.id,
      points,
      geometry: route.geometry ?? null,
      returnToNav,
    }
    if (!showMaken) {
      // Vanuit Bewaard/GPX bestaat de bouwer (#route-generator) niet — eerst
      // écht naar het Maken-tabblad wisselen. De tabwissel remount dit paneel,
      // dus de routepunten reizen mee via de module-overdracht hieronder;
      // de nieuwe instantie scrolt daarna zelf naar de bouwer.
      // Bugmelding René 30-07-2026: de knop deed hier voorheen niets.
      pendingWaypointEdit = edit
      // Bestaande querycontext (bv. ?samen=/&maten= vanuit de navigatie)
      // behouden — alleen de weergave wisselt.
      const params = new URLSearchParams(window.location.search)
      params.set("view", "maken")
      setPanelLocation(`${panelPath}?${params.toString()}`)
      return
    }
    setGenWaypoints(edit)
    setGenPrefill(null)
    setTimeout(() => {
      document
        .getElementById("route-generator")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }

  function adjustRoute(pref: ElevationPreference) {
    setGenPrefill(pref)
    setGenWaypoints(null)
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

  // Gedeelde link (?route=<id>): scroll naar de bijbehorende routekaart en
  // licht hem even op — zo landt een ontvanger direct op de juiste route.
  useEffect(() => {
    if (!showBewaard) return
    const raw = new URLSearchParams(window.location.search).get("route")
    const id = raw ? Number(raw) : NaN
    if (!Number.isFinite(id)) return
    setHighlightId(id)
    const t1 = setTimeout(() => {
      document
        .getElementById(`route-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 300)
    const t2 = setTimeout(() => setHighlightId(null), 3000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
    // Alleen opnieuw wanneer de routes binnenkomen (dan bestaat het element).
  }, [showBewaard, routes.length])

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
      {
        // Duidelijke bevestiging: spring direct naar de zojuist geüploade
        // route in het Bewaard-tabblad (daar kan hij ook hernoemd worden via
        // "Naam wijzigen") — geen stille toevoeging onderaan een lijst.
        onSuccess: (data) => {
          setPanelLocation(
            `${panelPath}?view=bewaard&route=${data.route.id}`,
          )
        },
        onError: () => setError("Route kon niet worden verwerkt"),
      },
    )
  }

  return (
    <section>
      <SectionLabel n="03" title="Route & navigatie" />

      {/* Secondary action row — de planner zelf staat ALTIJD open (kaart-eerst,
          zoals Komoot); hier alleen de nevenwegen: GPX, verkennen, bewaard. */}
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {showGpx && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={create.isPending}
            className="flex items-center gap-2 rounded-full border border-white/[0.14] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 transition hover:border-white/30 hover:text-white/90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" strokeWidth={1.75} />
            {create.isPending ? "Verwerken…" : "GPX uploaden"}
          </button>
        )}
        {showBewaard && routes.some((r) => (r.geometry?.length ?? 0) >= 2) && (
          <button
            type="button"
            onClick={() => setShowExplorer(true)}
            className="flex items-center gap-2 rounded-full border border-white/[0.14] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 transition hover:border-white/30 hover:text-white/90"
          >
            <MapIcon className="h-4 w-4" strokeWidth={1.75} />
            Bewaarde routes op kaart
          </button>
        )}
        {showBewaard && view === null && routes.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSavedPicker((s) => !s)}
            className={`flex items-center gap-2 rounded-full border border-white/[0.14] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 transition hover:border-white/30 hover:text-white/90 ${showSavedPicker ? "border-accent-cyan/50 text-accent-cyan" : ""}`}
          >
            <Flag className="h-4 w-4" strokeWidth={1.75} />
            Bewaarde routes ({routes.length})
          </button>
        )}
      </div>

      {showSavedPicker && routes.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-2">
          {routes.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setShowSavedPicker(false)
                setHighlightId(r.id)
                setTimeout(() => {
                  document
                    .getElementById(`route-${r.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }, 50)
                setTimeout(() => setHighlightId(null), 2600)
              }}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] text-white/85">
                {r.name}
              </span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/40">
                {r.distanceKm != null ? `${r.distanceKm} km` : "—"}
                {r.elevationGainM != null ? ` · ${r.elevationGainM} m` : ""}
              </span>
            </button>
          ))}
        </div>
      )}

      {showExplorer && (
        <RouteExplorer
          routes={routes}
          onClose={() => setShowExplorer(false)}
          onOpenRoute={(id) => {
            setShowExplorer(false)
            if (view === "bewaard") {
              // De lijst is ingeklapt — open de gekozen route echt via ?route=
              // in plaats van naar een (niet meer gerenderde) kaart te scrollen.
              const params = new URLSearchParams(window.location.search)
              params.set("route", String(id))
              setPanelLocation(`${panelPath}?${params.toString()}`)
              return
            }
            setHighlightId(id)
            setTimeout(() => {
              document
                .getElementById(`route-${id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }, 50)
            setTimeout(() => setHighlightId(null), 2600)
          }}
          onNavigate={(id) => {
            // Eerst het rit-optiesmenu, dan pas de navigatie — dezelfde route
            // als de "Navigeer"-knop op de routekaart zelf.
            setShowExplorer(false)
            const params = new URLSearchParams(window.location.search)
            params.set("ritopties", String(id))
            setPanelLocation(`${panelPath}?${params.toString()}`)
          }}
        />
      )}

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

      {showMaken ? (
        <p className="mt-2 text-[12px] leading-relaxed text-white/35">
          Plan je route direct op de kaart: kies je startpunt, stel afstand en
          voorkeuren in en genereer{view === null ? ". Of upload een GPX-bestand voor een echt hoogteprofiel." : "."}
        </p>
      ) : showGpx ? (
        <p className="mt-2 text-[12px] leading-relaxed text-white/35">
          Upload een GPX-bestand (max 11 MB) — Sparki leest de echte lijn en het
          hoogteprofiel en zet hem bij je bewaarde routes.
        </p>
      ) : null}

      {error && (
        <p className="mt-2 text-[12px] text-negative/85">{error}</p>
      )}

      {showMaken && (
      <div className="mt-4" id="route-generator">
          <RouteGenerator
            key={
              genWaypoints
                ? `wp-${genWaypoints.routeId}`
                : (genPrefill ?? "default")
            }
            initialElevation={genPrefill}
            initialWaypoints={genWaypoints?.points ?? null}
            initialGeometry={genWaypoints?.geometry ?? null}
            initialSamen={
              // Bij "route aanpassen" vanuit de navigatie: bestaande
              // samen-context uit de URL voorvullen, zodat die keuze niet
              // stilletjes verdwijnt.
              genWaypoints?.returnToNav
                ? {
                    withOthers:
                      new URLSearchParams(window.location.search).get(
                        "samen",
                      ) === "1",
                    maten: (
                      new URLSearchParams(window.location.search).get(
                        "maten",
                      ) ?? ""
                    )
                      .split(",")
                      .filter(Boolean),
                  }
                : null
            }
            onSaved={(saved, samen) => {
              // Twee situaties openen direct de navigatie van de zojuist
              // bewaarde route: (1) de rijder kwam uit het navigatievenster
              // ("route aanpassen") — samen-keuze uit de generator (die is
              // dan voorgevuld met de bestaande context) wordt overgenomen;
              // (2) hij koos "Met anderen" bij een verse route.
              // (3) "Bewaar & navigeer": open eerst het rit-optiesmenu van de
              // bewaarde route — hetzelfde pad als de Navigeer-knop op een
              // bewaarde routekaart, dus altijd langs de rit-keuzes.
              if (samen.navigeer && !genWaypoints?.returnToNav && !samen.withOthers) {
                const params = new URLSearchParams(window.location.search)
                params.set("ritopties", String(saved.id))
                setPanelLocation(`${panelPath}?${params.toString()}`)
                return
              }
              if (!genWaypoints?.returnToNav && !samen.withOthers) {
                // Gewoon "Bewaar route": spring direct naar de bewaarde route
                // in het Bewaard-tabblad — duidelijke bevestiging dat het
                // bewaren gelukt is, in plaats van een stil gereset scherm.
                setPanelLocation(
                  `${panelPath}?view=bewaard&route=${saved.id}`,
                )
                return
              }
              const params = new URLSearchParams(window.location.search)
              params.set("nav", String(saved.id))
              if (samen.withOthers) {
                params.set("samen", "1")
                if (samen.maten.length > 0)
                  params.set("maten", samen.maten.join(","))
                else params.delete("maten")
              } else {
                params.delete("samen")
                params.delete("maten")
              }
              setPanelLocation(`${panelPath}?${params.toString()}`)
            }}
            onClose={() => {
              setGenPrefill(null)
              setGenWaypoints(null)
            }}
          />
      </div>
      )}

      {showBewaard && <RouteProposalsInbox />}

      {/* Terugknop boven de geopende routekaart — de compacte lijst is de
          standaardweergave, de grote kaart alleen voor de gekozen route. */}
      {view === "bewaard" && selectedId != null && !isLoading && (
        <button
          type="button"
          onClick={clearSelection}
          className="mt-4 flex items-center gap-2 rounded-full border border-white/[0.14] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 transition hover:border-white/30 hover:text-white/90"
        >
          ← Alle routes
        </button>
      )}

      {showBewaard && (
      <div className="mt-4 space-y-4">
        {isLoading && (view !== "bewaard" || selectedId != null) ? (
          <div className="h-40 w-full animate-pulse rounded-xl bg-white/[0.06]" />
        ) : view === "bewaard" && selectedId == null ? null : view ===
            "bewaard" && !routes.some((r) => r.id === selectedId) ? (
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[12px] leading-relaxed text-white/40">
              Deze route staat niet (meer) in je lijst.
            </p>
          </div>
        ) : routes.length > 0 ? (
          (view === "bewaard"
            ? routes.filter((r) => r.id === selectedId)
            : routes
          ).map((r) => (
            <div
              key={r.id}
              id={`route-${r.id}`}
              className={`rounded-2xl transition-shadow duration-500 ${highlightId === r.id ? "shadow-[0_0_0_1.5px_var(--accent-cyan)]" : ""}`}
            >
              <RouteCard
                route={r}
                onAdjust={adjustRoute}
                onEditWaypoints={editRouteWaypoints}
              />
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[12px] leading-relaxed text-white/40">
              Nog geen routes opgeslagen — plan er hierboven één op de kaart, of
              upload een GPX-bestand.
            </p>
            <HumorLine context="empty_routes" className="mt-1.5" />
          </div>
        )}
      </div>
      )}
    </section>
  )
}

// Routevoorstellen van fietsmaatjes: open ontvangen voorstellen kun je hier
// accepteren of afwijzen; verstuurde voorstellen tonen hun status. Verschijnt
// alleen wanneer er echt voorstellen zijn — geen lege beloftes.
function RouteProposalsInbox() {
  const { data } = useRouteProposals()
  const respond = useRespondToProposal()
  const [error, setError] = useState<string | null>(null)
  const ontvangen = (data?.ontvangen ?? []).filter((p) => p.status === "open")
  const verstuurd = (data?.verstuurd ?? []).slice(0, 3)
  if (ontvangen.length === 0 && verstuurd.length === 0) return null

  const statusLabel: Record<string, string> = {
    open: "Wacht op reactie",
    geaccepteerd: "Geaccepteerd",
    afgewezen: "Afgewezen",
    aangepast: "Aangepast",
  }

  return (
    <div className="mt-4 rounded-xl border border-accent-cyan/[0.18] bg-map-panel/[0.82] p-4 backdrop-blur-md">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-cyan/70">
        Routevoorstellen
      </p>
      {ontvangen.map((p) => (
        <div
          key={p.id}
          className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-[13px] text-white/85">
              {p.fromName} stelt "{p.route?.name ?? "een route"}" voor
              {p.route?.distanceKm ? ` · ${p.route.distanceKm} km` : ""}
            </p>
            {p.note && (
              <p className="mt-0.5 text-[11px] text-white/45">{p.note}</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={respond.isPending}
              onClick={() => {
                setError(null)
                respond.mutate(
                  { id: p.id, actie: "accepteer" },
                  {
                    onError: (e) =>
                      setError(
                        e instanceof Error ? e.message : "Reageren mislukt",
                      ),
                  },
                )
              }}
              className="rounded-full bg-accent-cyan/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-on-accent transition hover:bg-accent-cyan disabled:opacity-40"
            >
              Accepteer
            </button>
            <button
              type="button"
              disabled={respond.isPending}
              onClick={() => {
                setError(null)
                respond.mutate(
                  { id: p.id, actie: "wijs_af" },
                  {
                    onError: (e) =>
                      setError(
                        e instanceof Error ? e.message : "Reageren mislukt",
                      ),
                  },
                )
              }}
              className="rounded-full border border-white/[0.14] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/60 transition hover:border-white/30 disabled:opacity-40"
            >
              Wijs af
            </button>
          </div>
        </div>
      ))}
      {verstuurd.length > 0 && (
        <div className="mt-3 space-y-1">
          {verstuurd.map((p) => (
            <p key={p.id} className="text-[11px] text-white/40">
              Aan {p.toName}: "{p.route?.name ?? "route"}" —{" "}
              {statusLabel[p.status] ?? p.status}
            </p>
          ))}
        </div>
      )}
      {error && (
        <p className="mt-2 text-[12px] text-negative/85">{error}</p>
      )}
    </div>
  )
}
