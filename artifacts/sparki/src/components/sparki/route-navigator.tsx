import { useEffect, useMemo, useRef, useState } from "react"
import { IconCheck } from "@/components/ds"
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
  Zap,
  Ban,
  Trophy,
  SlidersHorizontal,
  Info,
  Users,
  User,
  Check,
  Bluetooth,
  Play,
  Pause,
  Compass,
  Wind,
  MapPin,
  Camera,
  Plus,
  Minus,
  Share2,
  Phone,
  Download,
  BatteryLow,
  Battery,
  Square,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  type LucideIcon,
} from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import type { RouteNavCue } from "@/hooks/use-routes"
// Bordjes sprinten is GESTOPT (veiligheidsrisico op openbare weg, besluit
// 31-07-2026): het volledige spelmechaniek is uit deze actieve navigator
// verwijderd. De herbruikbare inventaris leeft alleen nog in de bewust
// niet-geroute /sprinten-pagina en engines/sprint op de server.
import { usePowerMeter } from "@/hooks/use-power-meter"
import { useNavSettings, type NavDataField } from "@/hooks/use-nav-settings"
import { useFriends } from "@/hooks/use-social"
import { useGarage } from "@/hooks/use-garage"
import { SENSOR_KIND_LABEL } from "@/components/sparki/wireless-sensors"
import { apiFetch } from "@/lib/api"
import type { PlannedWorkout } from "@/lib/athlete-types"
import { WorkoutHud } from "@/components/sparki/workout-hud"
import {
  climbPhaseAt,
  smoothedClimbGradePct,
  snapBarOffset,
  updateAvgSpeed,
  displayAvgKmh,
  summarizeRide,
  buildRideGpx as buildLiveRideGpx,
  type ClimbWindow,
  type TrackPoint,
  type SensorSample,
} from "@/lib/nav-live"
import { buildTimeline, segmentAt } from "@/lib/workout-blocks"
import {
  corridorMeters,
  createOffRouteState,
  displayPosition,
  matchToRoute,
  updateOffRoute,
  type MatchLatLon,
} from "@/lib/route-match"


// Opgenomen rit overleeft "Route aanpassen" (unmount → routebouwer → terug):
// track + sensordata + rijtijd gaan even naar sessionStorage en worden bij
// terugkomst hersteld. Max 6 uur oud — daarna is het eerlijk een nieuwe rit.
type SavedRide = {
  track: TrackPoint[]
  sensors: SensorSample[]
  rideSeconds: number
  savedAt: number
}
// ── Kaartkleuren: lokale constantenlaag ─────────────────────────────────────
// Leaflet-divIcons/SVG-markup en polyline-opties kunnen geen Tailwind-tokens
// gebruiken; alle losse hexwaarden in JS-gegenereerde kaartmarkup verwijzen
// daarom hierheen. className-kleuren gebruiken de tokens map-ink/map-panel/…
// uit `src/index.css` (zie docs/SPARKI_DESIGN_SYSTEM.md).
const MAP_INK = "#05070e" // diepste kaartlaag + tekst/lijnwerk op accentvlak
const MAP_MARKER_BG = "#0b1622" // donkere marker-achtergrond
const ROUTE_LINE = "#22d3ee" // heldere routelijn (cyan-400)
const ROUTE_CASING = "#0a1420" // donkere casing onder de routelijn
const ARROW_CASING = "#05121f" // donkere rand onder richtingpijlen
const ARROW_WHITE = "#ffffff" // pijl zelf
const DETOUR_LINE = "#fbbf24" // omleidingslijn (amber-400)
const RIDER_ACCENT = "#38bdf8" // renner-badge (sky-400)
const MARKER_POSITIVE = "#4ade80" // groen markeraccent (green-400)
const MARKER_NEUTRAL = "#e5e7eb" // lichtgrijs (finishvlag)

const SAVED_RIDE_MAX_AGE_MS = 6 * 3600 * 1000
function savedRideKey(routeId: number | null) {
  return `sparki:nav-rit:${routeId ?? "los"}`
}
function readSavedRide(routeId: number | null): SavedRide | null {
  try {
    const raw = sessionStorage.getItem(savedRideKey(routeId))
    if (!raw) return null
    const v = JSON.parse(raw) as SavedRide
    if (
      !Array.isArray(v.track) ||
      typeof v.savedAt !== "number" ||
      Date.now() - v.savedAt > SAVED_RIDE_MAX_AGE_MS
    )
      return null
    return {
      track: v.track,
      sensors: Array.isArray(v.sensors) ? v.sensors : [],
      rideSeconds: typeof v.rideSeconds === "number" ? v.rideSeconds : 0,
      savedAt: v.savedAt,
    }
  } catch {
    return null
  }
}
function writeSavedRide(routeId: number | null, ride: SavedRide) {
  try {
    sessionStorage.setItem(savedRideKey(routeId), JSON.stringify(ride))
  } catch {
    // Opslag vol/geblokkeerd — dan geen herstel, maar de rit zelf loopt door.
  }
}
function clearSavedRide(routeId: number | null) {
  try {
    sessionStorage.removeItem(savedRideKey(routeId))
  } catch {
    // niets
  }
}

type BasemapId = "donker" | "standaard" | "fiets" | "satelliet"

const BASEMAPS: Record<
  BasemapId,
  {
    label: string
    url: string
    attribution: string
    maxZoom: number
    tileClassName?: string
  }
> = {
  donker: {
    label: "Donker",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    // The raw dark tiles are too dark to read street names — this CSS filter
    // (index.css) lifts brightness while keeping the night look.
    tileClassName: "sparki-map-tiles",
  },
  standaard: {
    label: "Standaard",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  fiets: {
    label: "Fiets",
    url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.cyclosm.org">CyclOSM</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 20,
  },
  satelliet: {
    label: "Satelliet",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxZoom: 19,
  },
}

// ── Rit-opties ──────────────────────────────────────────────────────
// Wat de renner onderweg wil zien/doen — gekozen in het menu vóór de start
// van de navigatie. De laatste keuze wordt bewaard en staat de volgende keer
// alvast voorgeselecteerd.
export type RideOptions = {
  pois: boolean
  samen: boolean
  maten: string[]
  basemap: BasemapId
  headingUp: boolean
}

const RIDE_OPTIONS_KEY = "sparki:rit-opties:v1"

const DEFAULT_RIDE_OPTIONS: RideOptions = {
  pois: true,
  samen: false,
  maten: [],
  basemap: "standaard",
  headingUp: false,
}

export function loadLastRideOptions(): RideOptions {
  try {
    const raw = window.localStorage.getItem(RIDE_OPTIONS_KEY)
    if (!raw) return { ...DEFAULT_RIDE_OPTIONS }
    const p = JSON.parse(raw) as Partial<RideOptions>
    return {
      pois: typeof p.pois === "boolean" ? p.pois : true,
      samen: typeof p.samen === "boolean" ? p.samen : false,
      maten: Array.isArray(p.maten)
        ? p.maten.filter((m): m is string => typeof m === "string")
        : [],
      basemap:
        p.basemap && p.basemap in BASEMAPS
          ? (p.basemap as BasemapId)
          : "standaard",
      headingUp: typeof p.headingUp === "boolean" ? p.headingUp : false,
    }
  } catch {
    return { ...DEFAULT_RIDE_OPTIONS }
  }
}

function saveRideOptions(opts: RideOptions) {
  try {
    window.localStorage.setItem(RIDE_OPTIONS_KEY, JSON.stringify(opts))
  } catch {
    // Opslag vol of geblokkeerd — dan gewoon geen voorselectie volgende keer.
  }
}

// Bij een gekoppelde intervaltraining zijn plekken en spelletjes op voorhand
// overbodig: de renner rijdt blokken en hoort niet afgeleid te worden.
export function isFocusWorkout(workout: PlannedWorkout | null): boolean {
  if (!workout) return false
  if (workout.type.toLowerCase().includes("interval")) return true
  // Alleen échte intervalblokken tellen — een gewone duurtraining met
  // warming-up/steady/cooling-down blijft een vrije rit met alle keuzes.
  return (workout.structure?.blocks ?? []).some((b) => b.kind === "interval")
}

// Past de intervalregel toe op (bewaarde) opties — ook bij een deep-link die
// het keuzemenu overslaat.
export function applyFocusRules(
  opts: RideOptions,
  workout: PlannedWorkout | null,
): RideOptions {
  if (!isFocusWorkout(workout)) return opts
  return { ...opts, pois: false, samen: false, maten: [] }
}

type LatLon = { lat: number; lon: number }

// Initial bearing (degrees, 0 = north) from point a to point b.
function bearingDeg(a: LatLon, b: LatLon): number {
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (Math.atan2(y, x) * 180) / Math.PI
}

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

function fmtRideTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const mm = String(m).padStart(2, "0")
  const ss = String(s).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

function fmtMeters(m: number): string {
  if (m < 1000) return `${Math.max(0, Math.round(m / 10) * 10)} m`
  return `${(m / 1000).toFixed(1)} km`
}

// Backend errors carry a plain-Dutch {error} body; show that, else a fallback.
function parseApiError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message) as { error?: string }
      if (parsed.error) return parsed.error
    } catch {
      /* not JSON */
    }
  }
  return fallback
}

// Emoji per POI kind — static content only (never user text) so the Leaflet
// divIcon HTML sink stays safe.
const POI_ICONS: Record<string, string> = {
  "Café": "☕",
  Restaurant: "🍴",
  "Italiaans restaurant": "🍝",
  Uitzichtpunt: "🌄",
  Museum: "🏛️",
  Bezienswaardigheid: "⭐",
  Kunstwerk: "🎨",
  Kasteel: "🏰",
  Monument: "🗿",
  "Ruïne": "🏚️",
  Molen: "🌬️",
  Fietsenwinkel: "🔧",
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
  routeId = null,
  workout = null,
  ftp = null,
  onEditRoute = null,
  rideOptions = null,
  rideOptionsExplicit = false,
  climbs = null,
  elevationProfile = null,
  sport = null,
}: {
  name: string
  geometry: [number, number][]
  nav: RouteNavCue[]
  distanceKm: number | null
  // Bekende beklimmingen van deze route (uit het echte hoogteprofiel bij het
  // opslaan/genereren) — voedt de klim-weergave onderweg. Zonder klimmen of
  // zonder summitKm blijft die weergave eerlijk weg.
  climbs?: { name: string; lengthKm: number; avgGradePct: number; summitKm?: number }[] | null
  // Het echte (verkleinde) hoogteprofiel van de route in meters — voor het
  // klimprofieltje en het stijgingspercentage ter plekke.
  elevationProfile?: number[] | null
  onClose: () => void
  // Id van de bewaarde route (null bij een niet-bewaarde kandidaat).
  routeId?: number | null
  // Geplande training met blokken voor deze rit — live getoond als tijdblokken
  // versus zone/wattage, zodat de renner ziet wanneer een interval begint en
  // wat hij moet leveren.
  workout?: PlannedWorkout | null
  ftp?: number | null
  // Sport van de route (MOBILE_ROUTE_WALKING_01): te voet (walking/hiking)
  // spreekt de navigatie de gebruiker niet als fietser aan.
  sport?: string | null
  // Route onderweg aanpassen: opent de eigen-route-bouwer met de echte punten
  // van deze route voorgevuld, en keert na opslaan terug naar de navigatie.
  onEditRoute?: (() => void) | null
  // Vooraf gekozen rit-opties (uit het keuzemenu vóór de start). Zonder menu
  // (deep-link) vallen we terug op de laatst bewaarde keuze of de URL.
  rideOptions?: RideOptions | null
  // Alleen true wanneer de renner ZELF het startmenu heeft doorlopen; bij een
  // fallback (laatst bewaarde keuze/deep-link) mogen de opgeslagen
  // navigatie-instellingen de standaard invullen.
  rideOptionsExplicit?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const meMarkerRef = useRef<L.Marker | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const followRef = useRef(true)
  const prevPosRef = useRef<LatLon | null>(null)

  const [location, setLocation] = useState<
    | (LatLon & {
        speedMps: number | null
        heading: number | null
        accuracyM: number | null
      })
    | null
  >(null)
  const locationRef = useRef<
    | (LatLon & {
        speedMps: number | null
        heading: number | null
        accuracyM: number | null
      })
    | null
  >(null)
  locationRef.current = location
  const [geoError, setGeoError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [following, setFollowing] = useState(true)
  const [showSteps, setShowSteps] = useState(false)
  const [basemap, setBasemap] = useState<BasemapId>(
    rideOptions?.basemap ?? "standaard",
  )
  // Kaartoriëntatie: noord boven (klassiek) of rijrichting boven (de kaart
  // draait mee, jij wijst altijd omhoog). Draai gebeurt via CSS-rotatie van
  // een vergrote kaartlaag; icoontjes draaien via --map-counter-rot terug
  // zodat ze leesbaar blijven.
  const [headingUp, setHeadingUp] = useState(rideOptions?.headingUp ?? false)
  const rotAccumRef = useRef(0)
  const [rotDeg, setRotDeg] = useState(0)
  // Plekken (bezienswaardigheden, café's) aan/uit op de kaart.
  const [showPois, setShowPois] = useState(rideOptions?.pois ?? true)
  // Persistente navigatie-instellingen (/routes → Navigatie-instellingen).
  // Expliciete keuzes uit het startmenu (rideOptions) winnen altijd; de
  // opgeslagen instellingen vullen alleen de standaard in.
  const { data: navSettingsData } = useNavSettings()
  const navSettings = navSettingsData?.settings ?? null
  const navSettingsAppliedRef = useRef(false)
  useEffect(() => {
    if (!navSettings || navSettingsAppliedRef.current) return
    navSettingsAppliedRef.current = true
    if (!rideOptionsExplicit) {
      setHeadingUp(navSettings.headingUp)
      setShowPois(navSettings.autoPois)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navSettings])
  // Echte actuele wind (Open-Meteo) op je positie — subtiel getoond, nooit
  // verzonnen: blijft weg zolang er geen echte meting is.
  const [wind, setWind] = useState<{ kmh: number; dirDeg: number } | null>(null)
  // ── Batterijmodus ─────────────────────────────────────────────────
  // Waar de browser het toestaat (o.a. Android/Chrome) lezen we de echte
  // batterijstand uit. Op iPhone geeft de browser die niet vrij — dan tonen
  // we dat eerlijk en blijft alleen de handmatige spaarstand over. We
  // voorspellen pas iets als we het leeglopen tijdens DEZE rit echt gemeten
  // hebben (nooit een verzonnen prognose).
  const [battery, setBattery] = useState<{
    level: number
    charging: boolean
  } | null>(null)
  const batterySamplesRef = useRef<{ t: number; level: number }[]>([])
  const [drainPerMin, setDrainPerMin] = useState<number | null>(null)
  // Spaarstand: donkere kaart, plekken/wind/kaartdraaiing uit + zuinig scherm.
  const [ecoMode, setEcoMode] = useState(false)
  const [dimmed, setDimmed] = useState(false)
  const [ecoPromptDismissed, setEcoPromptDismissed] = useState(false)
  // Zolang de spaarstand aan staat, gelden deze afgeleide waarden — de eigen
  // keuzes blijven bewaard en komen terug zodra de spaarstand uitgaat.
  const poisVisible = ecoMode ? false : showPois
  const headingUpActive = ecoMode ? false : headingUp
  const activeBasemap: BasemapId = ecoMode ? "donker" : basemap
  // Per-ride setup (map style, group riding, sensor pairing) is a one-time
  // choice at the start of a ride, so it lives behind a collapsible panel and
  // isn't permanently on screen.
  const [setupOpen, setSetupOpen] = useState(false)
  // Samen rijden is opt-in. De keuze wordt normaal al bij het genereren van de route gemaakt en reist
  // mee via de URL (?samen=1&maten=…); de toggle hier blijft als override.
  const [withOthers, setWithOthers] = useState(() =>
    rideOptions
      ? rideOptions.samen
      : new URLSearchParams(window.location.search).get("samen") === "1",
  )
  // Gekozen maten (vrienden-ids) uit het rit-optiesmenu of de generator —
  // alleen om eerlijk te tonen met wie deze rit gereden wordt.
  const [buddyIds] = useState<string[]>(() => {
    if (rideOptions) return rideOptions.maten
    const raw = new URLSearchParams(window.location.search).get("maten")
    return raw ? raw.split(",").filter(Boolean) : []
  })
  const { data: friendsData } = useFriends()
  const buddyNames = (friendsData?.friends ?? [])
    .filter((f) => buddyIds.includes(f.clerkId))
    .map((f) => f.displayName)
  // Moving-average speed: accumulated distance/time while actually riding. Stops
  // (e.g. waiting at a traffic light) are excluded so the average reflects real
  // riding, not standing still.
  const avgRef = useRef<{
    meters: number
    seconds: number
    last: { t: number; lat: number; lon: number } | null
  }>({ meters: 0, seconds: 0, last: null })
  const [avgKmh, setAvgKmh] = useState<number | null>(null)

  // ── Rit-status: start / pauze ─────────────────────────────────────
  // "idle" until the rider presses Start; while paused (manual or auto) the
  // ride timer and average-speed accumulation stand still. Auto-pause kicks in
  // after ~5 s of standstill. Auto-hervat wint altijd: ELKE pauze (auto én
  // handmatig) loopt door zodra de rijder echt weer beweegt — zo kan de rit
  // nooit ongemerkt gepauzeerd blijven terwijl je kilometers verder fietst.
  // Herstel van een lopende rit na "Route aanpassen" (component unmount).
  const restoredRideRef = useRef<SavedRide | null>(readSavedRide(routeId))
  const [rideState, setRideState] = useState<"idle" | "riding" | "paused">(
    restoredRideRef.current && restoredRideRef.current.track.length >= 2
      ? "paused"
      : "idle",
  )
  const [autoPaused, setAutoPaused] = useState(false)
  const rideStateRef = useRef(rideState)
  rideStateRef.current = rideState
  const autoPausedRef = useRef(autoPaused)
  autoPausedRef.current = autoPaused
  const stillSinceRef = useRef<number | null>(null)
  const [rideSeconds, setRideSeconds] = useState(
    restoredRideRef.current?.rideSeconds ?? 0,
  )
  const rideSecondsRef = useRef(0)
  rideSecondsRef.current = rideSeconds

  // ── Bocht-bewuste intervalstart ──────────────────────────────────
  // Een intervalblok mag niet midden in een bocht beginnen. Staat er op het
  // moment dat de blokklok een interval zou instarten een echte afslag vlak
  // voor je (< TURN_HOLD_M), dan houden we de blokklok vast op de blokgrens
  // tot de bocht gepasseerd is — met een eerlijke melding. De rittimer zelf
  // loopt gewoon door; alleen de trainingsblokken schuiven op. Een veiligheids-
  // plafond voorkomt dat de klok eindeloos blijft wachten.
  const TURN_HOLD_M = 160
  const TURN_HOLD_MAX_SEC = 90
  const [workoutHoldSec, setWorkoutHoldSec] = useState(0)
  const [turnHold, setTurnHold] = useState(false)
  const turnHoldRef = useRef(false)
  turnHoldRef.current = turnHold
  const workoutHoldRef = useRef(0)
  workoutHoldRef.current = workoutHoldSec
  const holdStartedAtSecRef = useRef<number | null>(null)
  const lastWorkoutTickRef = useRef(0)
  // Ridden track (recorded while riding, met tijden en — waar de telefoon die
  // geeft — hoogte) plus losse sensorsamples (watt/cadans). Samen vormen ze
  // bij het afronden het ritoverzicht en de GPX voor de Data Hub.
  const riddenRef = useRef<TrackPoint[]>(restoredRideRef.current?.track ?? [])
  const sensorsRef = useRef<SensorSample[]>(
    restoredRideRef.current?.sensors ?? [],
  )
  const persistRide = () => {
    if (riddenRef.current.length < 2) return
    writeSavedRide(routeId, {
      track: riddenRef.current,
      sensors: sensorsRef.current,
      rideSeconds: rideSecondsRef.current,
      savedAt: Date.now(),
    })
  }
  // Laatste redmiddel-persist: bij wegnavigeren/verversen (pagehide) en bij
  // unmount de rit veiligstellen, zodat herstel nooit méér dan een paar
  // punten mist — ook tussen twee periodieke persist-momenten in.
  const persistRideRef = useRef<() => void>(() => {})
  persistRideRef.current = persistRide
  useEffect(() => {
    const onPageHide = () => persistRideRef.current()
    window.addEventListener("pagehide", onPageHide)
    return () => {
      window.removeEventListener("pagehide", onPageHide)
      persistRideRef.current()
    }
  }, [])
  const [confirmClose, setConfirmClose] = useState(false)
  const [saveRideState, setSaveRideState] = useState<
    "idle" | "saving" | "error"
  >("idle")
  // Rit opslaan in Sparki (Data Hub) + daarna Strava/delen.
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedSessionId, setUploadedSessionId] = useState<number | null>(
    null,
  )
  const [stravaAvailable, setStravaAvailable] = useState<boolean | null>(null)
  const [stravaState, setStravaState] = useState<
    "idle" | "busy" | "done" | "error"
  >("idle")
  const [stravaError, setStravaError] = useState<string | null>(null)
  const [discardArmed, setDiscardArmed] = useState(false)
  // Klimfinder-paneel inklapbaar; klapt automatisch weer open bij een nieuwe klim.
  const [climbPanelCollapsed, setClimbPanelCollapsed] = useState(false)
  // Databalk verticaal versleepbaar met snap-posities (0 / 15% / 30% vanaf onder).
  const [barOffsetFrac, setBarOffsetFrac] = useState<number>(() => {
    try {
      const raw = sessionStorage.getItem("sparki:nav-balk-offset")
      const v = raw != null ? Number(raw) : 0
      return snapBarOffset(Number.isFinite(v) ? v : 0)
    } catch {
      return 0
    }
  })
  const barDragRef = useRef<{ startY: number; startFrac: number } | null>(null)
  const [barDragFrac, setBarDragFrac] = useState<number | null>(null)

  // ── Val-alarm ─────────────────────────────────────────────────────
  // Detectie: plotselinge stop vanaf ≥ 20 km/u gevolgd door ≥ 15 s stilstand
  // tijdens een rit. Dan verschijnt "Alles oké?" met aftelling; geen reactie →
  // gekoppelde coach/ouders krijgen een melding met je locatie. 112 bellen
  // kan de browser niet zelf — er staat een grote belknop (eerlijk).
  const [crashAlert, setCrashAlert] = useState<
    | null
    | { phase: "asking"; secondsLeft: number }
    | { phase: "sending" }
    | { phase: "sent"; notified: number }
    | { phase: "error" }
  >(null)
  const crashAlertRef = useRef(crashAlert)
  crashAlertRef.current = crashAlert
  const lastFastRef = useRef<number | null>(null)
  const crashStillSinceRef = useRef<number | null>(null)
  const crashSnoozeUntilRef = useRef(0)

  const sendCrashAlert = async () => {
    const loc = locationRef.current
    if (!loc) {
      setCrashAlert({ phase: "error" })
      return
    }
    setCrashAlert({ phase: "sending" })
    try {
      const data = await apiFetch<{ notified?: number }>(
        "/api/alerts/crash",
        {
          method: "POST",
          body: JSON.stringify({
            lat: loc.lat,
            lon: loc.lon,
            speedKmh: loc.speedMps != null ? loc.speedMps * 3.6 : undefined,
          }),
        },
      )
      setCrashAlert({ phase: "sent", notified: data.notified ?? 0 })
    } catch {
      setCrashAlert({ phase: "error" })
    }
  }

  const dismissCrashAlert = () => {
    // "Ik ben oké" — 5 minuten geen nieuwe vraag, anders blijft hij terugkomen
    // bij elk stoplicht na een sprintje.
    crashSnoozeUntilRef.current = Date.now() + 5 * 60 * 1000
    crashStillSinceRef.current = null
    lastFastRef.current = null
    setCrashAlert(null)
  }

  // Aftelling: geen reactie binnen 30 s → automatisch waarschuwen.
  useEffect(() => {
    if (!crashAlert || crashAlert.phase !== "asking") return
    if (crashAlert.secondsLeft <= 0) {
      void sendCrashAlert()
      return
    }
    const id = window.setTimeout(() => {
      setCrashAlert((c) =>
        c && c.phase === "asking"
          ? { phase: "asking", secondsLeft: c.secondsLeft - 1 }
          : c,
      )
    }, 1000)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crashAlert])

  useEffect(() => {
    if (rideState !== "riding") return
    const id = window.setInterval(() => setRideSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [rideState])

  const startRide = () => {
    setAutoPaused(false)
    stillSinceRef.current = null
    // Verse rit = verse tellers: intensiteit/belasting/energie beginnen bij
    // nul, nooit met restjes van een eerdere rit.
    if (rideState === "idle") {
      liveCalcRef.current = { win: [], sumP4: 0, n: 0, joules: 0 }
      setLiveStats(null)
    }
    setRideState("riding")
  }
  const pauseRide = () => {
    setAutoPaused(false)
    setRideState("paused")
  }

  const power = usePowerMeter()
  // Saved wireless parts from the Fietsengarage — shown at ride start so the
  // rider recognises their own sensors. Only kinds the browser can really pair
  // (pairable: true) are listed here; "Opnieuw koppelen" opens the browser's
  // own Bluetooth chooser, which always asks for confirmation itself.
  const garageQuery = useGarage()
  const savedSensors = (garageQuery.data?.sensors ?? []).filter(
    (s) => s.pairable,
  )
  const bikeNameById = new Map(
    (garageQuery.data?.bikes ?? []).map((b) => [b.id, b.name]),
  )
  // While the browser's Bluetooth chooser is open, cancelling it (often via
  // Escape) must NOT also close the whole navigation window.
  const pairingRef = useRef(false)
  const connectSensors = async () => {
    pairingRef.current = true
    try {
      await power.connect()
    } finally {
      // Small delay so the chooser's closing Escape can't reach our handler.
      window.setTimeout(() => {
        pairingRef.current = false
      }, 400)
    }
  }
  followRef.current = following

  const path: LatLon[] = useMemo(
    () => geometry.map(([lat, lon]) => ({ lat, lon })),
    [geometry],
  )
  const cumKm = useMemo(() => cumulativeKm(path), [path])

  // ── Vervolg na afwijken van de route ──────────────────────────────
  // When the rider is >60 m off the planned line, they choose: shortest real
  // way back ("terug") or a real continuation that rejoins the route further
  // ahead ("verder"). The connector comes from the routing provider via the
  // backend — never a drawn straight line. It auto-clears once the rider is
  // back on the original route.
  type Detour = {
    mode: "terug" | "verder" | "poi"
    path: LatLon[]
    cues: RouteNavCue[]
    distanceKm: number | null
    rejoinKm: number | null
    stopName?: string
  }
  const [detour, setDetour] = useState<Detour | null>(null)
  const [detourLoading, setDetourLoading] = useState<
    "terug" | "verder" | "poi" | null
  >(null)
  const [detourError, setDetourError] = useState<string | null>(null)
  const detourLineRef = useRef<L.Polyline | null>(null)

  // ── Plekken langs de route (OpenStreetMap) ────────────────────────
  // Named sights + cafés/restaurants within ~250 m of the line. Purely real
  // data: when the source doesn't answer, there are simply no markers (and the
  // coffee prompt stays away) — nothing is fabricated.
  type Poi = {
    id: string
    name: string
    kind: string
    category: "bezienswaardigheid" | "horeca" | "service"
    lat: number
    lon: number
    routeKm: number
    offRouteM: number
    openState?: "open" | "closed" | "unknown"
    openingHours?: string
  }
  const [pois, setPois] = useState<Poi[]>([])
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null)
  const poiLayerRef = useRef<L.LayerGroup | null>(null)
  // Uitklapbare legenda: legt alleen de icoontjes uit die op DEZE kaart echt
  // aanwezig zijn (vaste route-iconen + de plek-soorten uit de echte POI-lijst).
  const [showLegend, setShowLegend] = useState(false)

  useEffect(() => {
    let alive = true
    apiFetch<{ pois: Poi[] }>(`/api/routes/${routeId}/pois`)
      .then((r) => {
        if (alive) setPois(r.pois ?? [])
      })
      .catch(() => {
        /* honest gap: no markers, no coffee prompt */
      })
    return () => {
      alive = false
    }
  }, [routeId])

  const requestDetour = async (mode: "terug" | "verder") => {
    if (!location || detourLoading) return
    setDetourLoading(mode)
    setDetourError(null)
    try {
      const resp = await apiFetch<{
        mode: "terug" | "verder"
        path: [number, number][]
        nav: RouteNavCue[]
        distanceKm: number | null
        rejoinKm: number | null
      }>(`/api/routes/${routeId}/rejoin`, {
        method: "POST",
        body: JSON.stringify({ lat: location.lat, lon: location.lon, mode }),
      })
      setDetour({
        mode: resp.mode,
        path: resp.path.map(([lat, lon]) => ({ lat, lon })),
        cues: resp.nav ?? [],
        distanceKm: resp.distanceKm,
        rejoinKm: resp.rejoinKm,
      })
    } catch (err) {
      setDetourError(parseApiError(err, "Kon geen vervolg berekenen. Probeer het opnieuw."))
    } finally {
      setDetourLoading(null)
    }
  }

  // Reroute the ride via a chosen place (sight or café). Both legs are real
  // routed paths from the backend; the place must lie ahead on the route.
  const requestPoiDetour = async (poi: Poi) => {
    if (!location || detourLoading) return null
    setDetourLoading("poi")
    setDetourError(null)
    try {
      const resp = await apiFetch<{
        path: [number, number][]
        nav: RouteNavCue[]
        distanceKm: number | null
        rejoinKm: number | null
      }>(`/api/routes/${routeId}/detour-via`, {
        method: "POST",
        body: JSON.stringify({
          lat: location.lat,
          lon: location.lon,
          targetLat: poi.lat,
          targetLon: poi.lon,
        }),
      })
      setDetour({
        mode: "poi",
        path: resp.path.map(([lat, lon]) => ({ lat, lon })),
        cues: resp.nav ?? [],
        distanceKm: resp.distanceKm,
        rejoinKm: resp.rejoinKm,
        stopName: poi.name,
      })
      setSelectedPoi(null)
      return true
    } catch (err) {
      setDetourError(parseApiError(err, "Kon geen omweg berekenen. Probeer het opnieuw."))
      return false
    } finally {
      setDetourLoading(null)
    }
  }

  // "Terug naar startpunt": een echte geroutere omweg terug naar het beginpunt
  // van de route — zelfde eerlijke mechaniek als een plek-omweg.
  const requestBackToStart = async () => {
    const start = path[0]
    if (!location || detourLoading || !start) return null
    setDetourLoading("poi")
    setDetourError(null)
    try {
      const resp = await apiFetch<{
        path: [number, number][]
        nav: RouteNavCue[]
        distanceKm: number | null
        rejoinKm: number | null
      }>(`/api/routes/${routeId}/detour-via`, {
        method: "POST",
        body: JSON.stringify({
          lat: location.lat,
          lon: location.lon,
          targetLat: start.lat,
          targetLon: start.lon,
        }),
      })
      setDetour({
        mode: "poi",
        path: resp.path.map(([lat, lon]) => ({ lat, lon })),
        cues: resp.nav ?? [],
        distanceKm: resp.distanceKm,
        rejoinKm: resp.rejoinKm,
        stopName: "het startpunt",
      })
      setSetupOpen(false)
      return true
    } catch (err) {
      setDetourError(
        parseApiError(err, "Kon geen route terug naar het startpunt berekenen."),
      )
      return false
    } finally {
      setDetourLoading(null)
    }
  }

  // Draw / remove the detour line on the map (dashed, amber — clearly distinct
  // from the planned route).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (detourLineRef.current) {
      map.removeLayer(detourLineRef.current)
      detourLineRef.current = null
    }
    if (detour && detour.path.length >= 2) {
      detourLineRef.current = L.polyline(
        detour.path.map((p) => [p.lat, p.lon] as [number, number]),
        {
          color: DETOUR_LINE,
          weight: 5,
          opacity: 0.95,
          dashArray: "10 8",
          interactive: false,
        },
      ).addTo(map)
    }
    return () => {
      if (detourLineRef.current && map) {
        map.removeLayer(detourLineRef.current)
        detourLineRef.current = null
      }
    }
  }, [detour])

  // POI markers: one layer group, rebuilt when the list arrives. The divIcon
  // HTML is static emoji only — the (OSM-sourced) name is rendered exclusively
  // through React in the selection card, never through the HTML sink.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (poiLayerRef.current) {
      map.removeLayer(poiLayerRef.current)
      poiLayerRef.current = null
    }
    if (!poisVisible || pois.length === 0) return
    const group = L.layerGroup()
    for (const poi of pois) {
      const emoji = POI_ICONS[poi.kind] ?? "⭐"
      const icon = L.divIcon({
        className: "",
        html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:rgba(7,13,22,0.9);border:1px solid rgba(255,255,255,0.25);font-size:14px;box-shadow:0 1px 6px rgba(0,0,0,0.5);transform:rotate(var(--map-counter-rot,0deg));">${emoji}</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      })
      L.marker([poi.lat, poi.lon], { icon, keyboard: false })
        .on("click", () => setSelectedPoi(poi))
        .addTo(group)
    }
    group.addTo(map)
    poiLayerRef.current = group
    return () => {
      if (poiLayerRef.current) {
        map.removeLayer(poiLayerRef.current)
        poiLayerRef.current = null
      }
    }
  }, [pois, poisVisible])

  // Map-matching: kaart, voortgang én afwijkingsdetectie gebruiken dezelfde
  // gematchte positie op hetzelfde routeSEGMENT (niet losse routepunten).
  const matchPath: MatchLatLon[] = useMemo(
    () => path.map((p) => ({ lat: p.lat, lon: p.lon })),
    [path],
  )
  const matchHintRef = useRef<number | null>(null)
  const match = useMemo(() => {
    if (!location || matchPath.length === 0) return null
    return matchToRoute(
      matchPath,
      cumKm,
      { lat: location.lat, lon: location.lon },
      matchHintRef.current,
    )
  }, [location, matchPath, cumKm])
  // Hint pas ná de commit bijwerken (geen ref-mutatie tijdens render).
  useEffect(() => {
    matchHintRef.current = match ? match.segIndex : null
  }, [match])

  // Afwijkingsdetectie met dynamische corridor (GPS-nauwkeurigheid +
  // snelheid), hysterese, meerdere opeenvolgende metingen, minimale duur,
  // GPS-sprongfilter en episode-onderdrukking. Eén meting is nooit genoeg;
  // terug op de route herstelt automatisch.
  const offRouteRef = useRef(createOffRouteState())
  const [offRouteActive, setOffRouteActive] = useState(false)
  useEffect(() => {
    if (!location || !match) return
    const upd = updateOffRoute(offRouteRef.current, {
      lat: location.lat,
      lon: location.lon,
      timestampMs: Date.now(),
      distanceM: match.distanceM,
      alongKm: match.alongKm,
      accuracyM: location.accuracyM,
      speedMps: location.speedMps,
    })
    offRouteRef.current = upd.state
    setOffRouteActive((cur) =>
      upd.state.active === cur ? cur : upd.state.active,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, match])

  const progress = useMemo(() => {
    if (!match) return null
    const traveledKm = match.alongKm
    const totalKm = cumKm[cumKm.length - 1] ?? 0
    return {
      traveledKm,
      remainingKm: Math.max(0, totalKm - traveledKm),
      offRoute: offRouteActive,
      offBy: match.distanceM,
    }
  }, [match, cumKm, offRouteActive])

  // ── Klim-weergave ─────────────────────────────────────────────────
  // Bekende beklimmingen van de route (echt hoogteprofiel, opgeslagen bij het
  // maken van de route). Nadert de rijder een klim, dan verschijnt die alvast
  // naast de kaart; óp de klim staan de cijfers groot; na de top verdwijnt
  // alles weer. Zonder klimgegevens blijft dit eerlijk helemaal weg.
  const climbWindows = useMemo(
    () =>
      (climbs ?? [])
        .filter(
          (c) =>
            typeof c.summitKm === "number" &&
            Number.isFinite(c.summitKm) &&
            c.lengthKm > 0,
        )
        .map((c) => ({
          name: c.name,
          lengthKm: c.lengthKm,
          avgGradePct: c.avgGradePct,
          summitKm: c.summitKm as number,
          startKm: Math.max(0, (c.summitKm as number) - c.lengthKm),
        }))
        .sort((a, b) => a.startKm - b.startKm),
    [climbs],
  )

  // Hoogte (m) op een km-positie, geïnterpoleerd uit het echte (verkleinde)
  // routeprofiel. Null zonder bruikbaar profiel — dan geen percentages.
  const routeTotalKm = distanceKm ?? cumKm[cumKm.length - 1] ?? 0
  const eleAtKm = useMemo(() => {
    const prof = elevationProfile
    if (!prof || prof.length < 2 || !(routeTotalKm > 0)) return null
    return (km: number): number => {
      const pos = Math.max(
        0,
        Math.min(prof.length - 1, (km / routeTotalKm) * (prof.length - 1)),
      )
      const i = Math.floor(pos)
      const f = pos - i
      const a = prof[i]!
      const b = prof[Math.min(i + 1, prof.length - 1)]!
      return a + (b - a) * f
    }
  }, [elevationProfile, routeTotalKm])

  // Klimfases uit de geteste rekenkern (nav-live): komt → op → top → einde.
  // Het percentage ter plekke wordt gladgestreken over een venster ín de
  // rijrichting en is op de klim per definitie nooit negatief.
  const climbLive = useMemo(() => {
    if (!progress || detour || climbWindows.length === 0) return null
    const ph = climbPhaseAt(climbWindows as ClimbWindow[], progress.traveledKm)
    if (!ph) return null
    if (ph.phase === "komt" || ph.phase === "einde") return ph
    let gradeNowPct: number | null = null
    let toClimbM: number | null = null
    if (eleAtKm) {
      gradeNowPct = smoothedClimbGradePct(
        eleAtKm,
        progress.traveledKm,
        ph.climb.startKm,
        ph.climb.summitKm,
      )
      toClimbM = Math.max(
        0,
        Math.round(eleAtKm(ph.climb.summitKm) - eleAtKm(progress.traveledKm)),
      )
    }
    return { ...ph, gradeNowPct, toClimbM }
  }, [progress, detour, climbWindows, eleAtKm])

  // Nieuwe klim ⇒ paneel klapt automatisch weer open.
  const climbNameForPanel = climbLive?.climb.name ?? null
  useEffect(() => {
    setClimbPanelCollapsed(false)
  }, [climbNameForPanel])

  // Klimprofieltje: het echte hoogteverloop van deze klim, met de rijder als
  // stip. Alleen getekend als er een bruikbaar routeprofiel is.
  const climbShape = useMemo(() => {
    if (!climbLive || !eleAtKm) return null
    const c = climbLive.climb
    const spanKm = c.summitKm - c.startKm
    if (!(spanKm > 0)) return null
    const N = 25
    const pts: number[] = []
    for (let i = 0; i < N; i++) {
      pts.push(eleAtKm(c.startKm + ((c.summitKm - c.startKm) * i) / (N - 1)))
    }
    const min = Math.min(...pts)
    const max = Math.max(...pts)
    if (!(max > min)) return null
    const W = 148
    const H = 40
    const line = pts
      .map((e, i) => {
        const x = (i / (N - 1)) * W
        const y = H - 4 - ((e - min) / (max - min)) * (H - 8)
        return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`
      })
      .join(" ")
    const onClimb = climbLive.phase === "op" || climbLive.phase === "top"
    const frac =
      onClimb && progress
        ? Math.max(
            0,
            Math.min(
              1,
              (progress.traveledKm - c.startKm) / spanKm,
            ),
          )
        : climbLive.phase === "einde"
          ? 1
          : 0
    const dotIdx = Math.round(frac * (N - 1))
    const dotX = (dotIdx / (N - 1)) * W
    const dotY = H - 4 - ((pts[dotIdx]! - min) / (max - min)) * (H - 8)
    return { line, dotX, dotY, W, H, frac, showDot: onClimb }
  }, [climbLive, eleAtKm, progress])

  // Live progress along an active detour — same honest mechanics as the main
  // route: nearest point on the real connector line, cues by distance.
  const detourCumKm = useMemo(
    () => (detour ? cumulativeKm(detour.path) : []),
    [detour],
  )
  const detourProgress = useMemo(() => {
    if (!detour || !location || detour.path.length === 0) return null
    const { index, distanceMeters } = nearestPointIndex(detour.path, location)
    const traveledKm = detourCumKm[index] ?? 0
    const totalKm = detourCumKm[detourCumKm.length - 1] ?? 0
    return {
      traveledKm,
      remainingKm: Math.max(0, totalKm - traveledKm),
      offBy: distanceMeters,
    }
  }, [detour, location, detourCumKm])

  // Back on the original route? Then the detour has done its job — clear it.
  // A place-detour (poi) runs close to the original line by design, so it only
  // clears once the rider reaches the end of the detour path.
  useEffect(() => {
    if (!detour || !progress) return
    if (detour.mode === "poi") {
      if (
        detourProgress &&
        detourProgress.remainingKm < 0.05 &&
        progress.offBy < 40
      )
        setDetour(null)
      return
    }
    if (progress.offBy < 40) setDetour(null)
  }, [detour, progress, detourProgress])
  // A fresh off-route moment invalidates an old error message.
  useEffect(() => {
    if (!progress?.offRoute) setDetourError(null)
  }, [progress?.offRoute])

  // ── Koffiepauze-voorstel ──────────────────────────────────────────
  // After every full hour of RIDING time (1u, 2u, 3u, …) a small prompt
  // appears for 15 seconds suggesting a coffee stop at a real café/restaurant
  // AHEAD on the route. It stays away when the ride is nearly done (no point
  // suggesting coffee when you're almost home), when no real horeca lies
  // ahead, or once the rider has accepted a stop.
  const COFFEE_MIN_REMAINING_KM = 5
  const [coffeePrompt, setCoffeePrompt] = useState<{
    hour: number
    poi: Poi
  } | null>(null)
  const coffeeHandledHourRef = useRef(0)
  const coffeeAcceptedRef = useRef(false)
  const coffeeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const nextCafeAhead = useMemo(() => {
    if (!progress) return null
    return (
      pois.find(
        (p) =>
          p.category === "horeca" && p.routeKm > progress.traveledKm + 0.2,
      ) ?? null
    )
  }, [pois, progress])

  useEffect(() => {
    const hour = Math.floor(rideSeconds / 3600)
    if (
      hour < 1 ||
      hour <= coffeeHandledHourRef.current ||
      coffeeAcceptedRef.current ||
      rideState !== "riding" ||
      detour != null ||
      coffeePrompt != null ||
      !progress ||
      progress.remainingKm < COFFEE_MIN_REMAINING_KM ||
      !nextCafeAhead
    )
      return
    coffeeHandledHourRef.current = hour
    setCoffeePrompt({ hour, poi: nextCafeAhead })
    coffeeTimerRef.current = setTimeout(() => setCoffeePrompt(null), 15_000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideSeconds])

  useEffect(
    () => () => {
      if (coffeeTimerRef.current) clearTimeout(coffeeTimerRef.current)
    },
    [],
  )

  const acceptCoffee = async () => {
    if (!coffeePrompt) return
    if (coffeeTimerRef.current) clearTimeout(coffeeTimerRef.current)
    const ok = await requestPoiDetour(coffeePrompt.poi)
    if (ok) {
      coffeeAcceptedRef.current = true
      setCoffeePrompt(null)
    }
  }

  const dismissCoffee = () => {
    if (coffeeTimerRef.current) clearTimeout(coffeeTimerRef.current)
    setCoffeePrompt(null)
  }

  const nextStep: RouteNavCue | null = useMemo(() => {
    // While a detour is active, its own turn cues lead the way.
    if (detour && detourProgress) {
      const ahead = detour.cues.find(
        (s) => s.km > detourProgress.traveledKm + 0.015,
      )
      return ahead ?? detour.cues[detour.cues.length - 1] ?? null
    }
    if (nav.length === 0 || !progress) return null
    const ahead = nav.find((s) => s.km > progress.traveledKm + 0.015)
    return ahead ?? nav[nav.length - 1] ?? null
  }, [nav, progress, detour, detourProgress])

  const distanceToTurn =
    detour && detourProgress && nextStep
      ? Math.max(0, (nextStep.km - detourProgress.traveledKm) * 1000)
      : nextStep && progress
        ? Math.max(0, (nextStep.km - progress.traveledKm) * 1000)
        : null

  // ── Bocht-bewuste intervalstart (vervolg) ─────────────────────────
  // Echte stuurmanoeuvres waarvoor de blokklok even wacht; rechtdoor,
  // aanhouden en vertrek/aankomst onderbreken een interval niet.
  const REAL_TURN_DIRS = useMemo(
    () =>
      new Set([
        "Links",
        "Rechts",
        "Scherp links",
        "Scherp rechts",
        "Rotonde",
        "Rotonde af",
        "Keren",
      ]),
    [],
  )
  const workoutTimeline = useMemo(
    () => (workout?.structure ? buildTimeline(workout.structure) : []),
    [workout],
  )
  const turnNearRef = useRef(false)
  turnNearRef.current =
    nextStep != null &&
    distanceToTurn != null &&
    distanceToTurn < TURN_HOLD_M &&
    REAL_TURN_DIRS.has(nextStep.dir)

  // Wisselt of laadt de training(stijdlijn) tijdens een rit, dan begint de
  // vasthoud-boekhouding schoon — anders telt de eerste tik een grote sprong
  // als "hold" en klopt de grensdetectie niet meer.
  useEffect(() => {
    lastWorkoutTickRef.current = rideSecondsRef.current
    holdStartedAtSecRef.current = null
    setTurnHold(false)
    setWorkoutHoldSec(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutTimeline])

  // Tikt mee met de ritklok: precies op de grens van een intervalblok wordt —
  // met een echte bocht vlak voor je — de blokklok op die grens vastgehouden
  // tot de bocht voorbij is (of het veiligheidsplafond bereikt is).
  useEffect(() => {
    if (workoutTimeline.length === 0) return
    const delta = Math.max(0, rideSeconds - lastWorkoutTickRef.current)
    lastWorkoutTickRef.current = rideSeconds
    if (delta === 0) return

    const raw = Math.max(0, rideSeconds - workoutHoldRef.current)
    const seg = segmentAt(workoutTimeline, raw)

    if (turnHoldRef.current) {
      const heldFor =
        holdStartedAtSecRef.current != null
          ? rideSeconds - holdStartedAtSecRef.current
          : 0
      if (!turnNearRef.current || heldFor >= TURN_HOLD_MAX_SEC) {
        // Bocht gepasseerd (of plafond bereikt): de intervalklok start nu.
        holdStartedAtSecRef.current = null
        setTurnHold(false)
      } else {
        // Blijf vasthouden: de blokklok schuift met de rittijd mee op.
        setWorkoutHoldSec((v) => v + delta)
      }
      return
    }

    // Grensdetectie: dit tikje kruiste de start van een intervalblok terwijl
    // er een echte bocht vlak voor je ligt → houd de blokklok op de grens.
    if (
      seg != null &&
      seg.block.kind === "interval" &&
      raw - seg.startSec < delta + 1 &&
      seg.startSec > 0 &&
      turnNearRef.current
    ) {
      setWorkoutHoldSec((v) => v + (raw - seg.startSec))
      holdStartedAtSecRef.current = rideSeconds
      setTurnHold(true)
    }
  }, [rideSeconds, workoutTimeline])

  // Body scroll lock + Escape to close.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pairingRef.current) setConfirmClose(true)
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
        const here: LatLon = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        }
        const gpsHeading =
          typeof pos.coords.heading === "number" &&
          !Number.isNaN(pos.coords.heading)
            ? pos.coords.heading
            : null
        // Prefer the device heading; otherwise derive it from movement, but
        // only when we actually moved far enough to trust the bearing.
        let heading = gpsHeading
        const prev = prevPosRef.current
        if (heading == null && prev && haversineM(prev, here) >= 4) {
          heading = bearingDeg(prev, here)
        }
        if (!prev || haversineM(prev, here) >= 4) prevPosRef.current = here
        // Record the ridden track (only while actually riding) so the ride —
        // or the part ridden so far — can be saved as a route when closing.
        if (rideStateRef.current === "riding") {
          const last = riddenRef.current[riddenRef.current.length - 1]
          if (!last || haversineM(last, here) >= 8) {
            riddenRef.current.push({
              ...here,
              t: Date.now(),
              ele:
                typeof pos.coords.altitude === "number" &&
                !Number.isNaN(pos.coords.altitude)
                  ? Math.round(pos.coords.altitude * 10) / 10
                  : null,
            })
            // Elke ~10 punten even bewaren, zodat "Route aanpassen" of een
            // per ongeluk ververste pagina de rit niet kwijtraakt.
            if (riddenRef.current.length % 10 === 0) persistRide()
          }
        }
        setLocation((cur) => ({
          ...here,
          speedMps:
            typeof pos.coords.speed === "number" && !Number.isNaN(pos.coords.speed)
              ? pos.coords.speed
              : null,
          heading: heading ?? cur?.heading ?? null,
          accuracyM:
            typeof pos.coords.accuracy === "number" &&
            Number.isFinite(pos.coords.accuracy) &&
            pos.coords.accuracy > 0
              ? pos.coords.accuracy
              : null,
        }))
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
    // Geen ingebouwde zoomknoppen: die zaten linksboven achter de sluitknop
    // én draaien mee in rijrichting-modus. Eigen knoppen staan rechts en
    // draaien nooit mee.
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    })
    // Only the licence-required © credit — no Leaflet software plug.
    map.attributionControl.setPrefix(false)
    const initial = BASEMAPS.standaard
    tileLayerRef.current = L.tileLayer(initial.url, {
      attribution: initial.attribution,
      maxZoom: initial.maxZoom,
      detectRetina: true,
      className: initial.tileClassName ?? "",
    }).addTo(map)

    const latlngs = path.map((p) => [p.lat, p.lon] as [number, number])
    const routeBounds =
      latlngs.length >= 2 ? L.latLngBounds(latlngs) : null
    if (latlngs.length >= 2) {
      // Draw a dark casing under a bright line so the route stays clearly
      // visible on any basemap (especially satellite), plus direction arrows so
      // it's obvious which way to follow.
      L.polyline(latlngs, {
        color: ROUTE_CASING,
        weight: 9,
        opacity: 0.9,
        lineJoin: "round",
        lineCap: "round",
      }).addTo(map)
      L.polyline(latlngs, {
        color: ROUTE_LINE,
        weight: 5,
        opacity: 1,
        lineJoin: "round",
        lineCap: "round",
      }).addTo(map)

      // Place a direction chevron roughly every 350 m, rotated to the local
      // heading of the route.
      const ARROW_SPACING_KM = 0.35
      let nextArrowKm = ARROW_SPACING_KM
      for (let i = 1; i < path.length; i++) {
        if ((cumKm[i] ?? 0) < nextArrowKm) continue
        nextArrowKm = (cumKm[i] ?? 0) + ARROW_SPACING_KM
        const rot = bearingDeg(path[i - 1]!, path[i]!)
        // A classic arrow (shaft + chevron head) instead of a triangle — an
        // isosceles triangle reads ambiguously at small sizes, an arrow never
        // does. Dark under-stroke keeps it legible on any basemap.
        const arrow = L.divIcon({
          className: "",
          html: `<span style="display:block;width:20px;height:20px;transform:rotate(${rot}deg);transform-origin:center;">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M12 21 V5 M5.5 11.5 L12 4.5 L18.5 11.5" fill="none" stroke="${ARROW_CASING}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 21 V5 M5.5 11.5 L12 4.5 L18.5 11.5" fill="none" stroke="${ARROW_WHITE}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        })
        L.marker([path[i]!.lat, path[i]!.lon], {
          icon: arrow,
          interactive: false,
          keyboard: false,
        }).addTo(map)
      }

      // Start = green flag, finish = checkered flag. Static SVG only — no
      // user-controlled content ever enters this divIcon HTML sink.
      const startIcon = L.divIcon({
        className: "",
        html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:${MAP_MARKER_BG};border:2px solid ${MARKER_POSITIVE};box-shadow:0 0 0 2px rgba(5,7,14,0.9),0 0 10px rgba(74,222,128,0.6);transform:rotate(var(--map-counter-rot,0deg));">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="${MARKER_POSITIVE}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 22V4"/><path d="M4 4c3-1.8 6 1.8 9 0s5-1 7 0v9c-2-1-4-1.8-7 0s-6-1.8-9 0"/>
            </svg>
          </span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      })
      const finishIcon = L.divIcon({
        className: "",
        html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:${MAP_MARKER_BG};border:2px solid rgba(255,255,255,0.85);box-shadow:0 0 0 2px rgba(5,7,14,0.9),0 0 10px rgba(255,255,255,0.45);transform:rotate(var(--map-counter-rot,0deg));">
            <svg viewBox="0 0 16 16" width="13" height="13">
              <rect x="2" y="1" width="1.6" height="14" rx="0.8" fill="${MARKER_NEUTRAL}"/>
              <g>
                <rect x="4" y="1" width="10" height="8" fill="${MARKER_NEUTRAL}"/>
                <rect x="4" y="1" width="2.5" height="2.66" fill="${MAP_MARKER_BG}"/>
                <rect x="9" y="1" width="2.5" height="2.66" fill="${MAP_MARKER_BG}"/>
                <rect x="6.5" y="3.66" width="2.5" height="2.66" fill="${MAP_MARKER_BG}"/>
                <rect x="11.5" y="3.66" width="2.5" height="2.66" fill="${MAP_MARKER_BG}"/>
                <rect x="4" y="6.33" width="2.5" height="2.66" fill="${MAP_MARKER_BG}"/>
                <rect x="9" y="6.33" width="2.5" height="2.66" fill="${MAP_MARKER_BG}"/>
              </g>
            </svg>
          </span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      })
      L.marker(latlngs[0]!, { icon: startIcon, zIndexOffset: 500 }).addTo(map)
      L.marker(latlngs[latlngs.length - 1]!, {
        icon: finishIcon,
        zIndexOffset: 500,
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

    // Keep the canvas correctly sized: Leaflet renders into a zero/stale-sized
    // container if it mounts before layout settles, which looks like the map
    // "overlapping" or drifting. A rAF pass + ResizeObserver keeps it stable.
    const raf = requestAnimationFrame(() => {
      map.invalidateSize()
      // Re-fit once the container has its real size — the first fitBounds can
      // run against a zero/stale-sized canvas, leaving the route line off-screen.
      if (routeBounds) map.fitBounds(routeBounds, { padding: [40, 40] })
    })
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(containerRef.current)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      map.remove()
      mapRef.current = null
      meMarkerRef.current = null
      tileLayerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap the base tile layer when the rider picks a different map.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const cfg = BASEMAPS[activeBasemap]
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current)
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      detectRetina: true,
      className: cfg.tileClassName ?? "",
    }).addTo(map)
    tileLayerRef.current.bringToBack()
  }, [activeBasemap])

  // Rijrichting-boven: houd een doorlopende rotatiehoek bij (altijd de kortste
  // draai, nooit een 359°→0° zwiep) zodat de kaart rustig meedraait.
  useEffect(() => {
    if (!headingUpActive) return
    const h = location?.heading
    if (h == null) return
    const cur = rotAccumRef.current
    const delta = ((h - (((cur % 360) + 360) % 360) + 540) % 360) - 180
    rotAccumRef.current = cur + delta
    setRotDeg(rotAccumRef.current)
  }, [location?.heading, headingUpActive])

  // Bij het wisselen van oriëntatie verandert de kaartlaag van maat — Leaflet
  // moet dan opnieuw meten, anders klopt het kaartmidden niet meer.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const id = window.setTimeout(() => {
      map.invalidateSize()
      // Alleen hercentreren als de rijder de kaart niet bewust heeft
      // losgelaten (volgen staat aan) — anders respecteren we de pan.
      if (location && following)
        map.setView([location.lat, location.lon], map.getZoom())
    }, 80)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headingUpActive])

  // Echte actuele wind op je positie via Open-Meteo — hooguit één keer per
  // kwartier ververst. Geen meting = geen windregel (nooit verzonnen).
  const windFetchedAtRef = useRef(0)
  useEffect(() => {
    if (!location) return
    // Spaarstand: geen extra netwerkverkeer voor de windregel.
    if (ecoMode) return
    const now = Date.now()
    if (now - windFetchedAtRef.current < 15 * 60 * 1000) return
    windFetchedAtRef.current = now
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.lat.toFixed(3)}&longitude=${location.lon.toFixed(3)}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (j: {
          current?: { wind_speed_10m?: unknown; wind_direction_10m?: unknown }
        } | null) => {
          const cur = j?.current
          if (
            cur &&
            typeof cur.wind_speed_10m === "number" &&
            typeof cur.wind_direction_10m === "number"
          ) {
            setWind({
              kmh: Math.round(cur.wind_speed_10m),
              dirDeg: cur.wind_direction_10m,
            })
          }
        },
      )
      .catch(() => {
        /* eerlijk gat: geen windregel tonen */
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, ecoMode])

  // Batterijstand live uitlezen — alleen waar de browser dit vrijgeeft.
  useEffect(() => {
    type BatteryManagerLike = {
      level: number
      charging: boolean
      addEventListener: (ev: string, fn: () => void) => void
      removeEventListener: (ev: string, fn: () => void) => void
    }
    const nav = window.navigator as Navigator & {
      getBattery?: () => Promise<BatteryManagerLike>
    }
    if (!nav.getBattery) return
    let alive = true
    let bat: BatteryManagerLike | null = null
    const update = () => {
      if (alive && bat) setBattery({ level: bat.level, charging: bat.charging })
    }
    nav
      .getBattery()
      .then((b) => {
        if (!alive) return
        bat = b
        update()
        b.addEventListener("levelchange", update)
        b.addEventListener("chargingchange", update)
      })
      .catch(() => {
        /* eerlijk gat: geen batterijstand tonen */
      })
    return () => {
      alive = false
      if (bat) {
        bat.removeEventListener("levelchange", update)
        bat.removeEventListener("chargingchange", update)
      }
    }
  }, [])

  // Leegloopsnelheid meten tijdens de rit: pas na ≥ 4 minuten én ≥ 1,5%
  // gemeten verbruik doen we een uitspraak. Aan de lader of stilstaand
  // (rit niet gestart) meten we niet.
  useEffect(() => {
    if (!battery) return
    if (battery.charging || rideStateRef.current === "idle") {
      batterySamplesRef.current = []
      setDrainPerMin(null)
      return
    }
    const samples = batterySamplesRef.current
    const last = samples[samples.length - 1]
    if (!last || last.level !== battery.level)
      samples.push({ t: Date.now(), level: battery.level })
    const first = samples[0]
    const latest = samples[samples.length - 1]
    if (
      first &&
      latest &&
      latest.t - first.t >= 4 * 60 * 1000 &&
      first.level - latest.level >= 0.015
    ) {
      setDrainPerMin(
        (first.level - latest.level) / ((latest.t - first.t) / 60000),
      )
    }
  }, [battery])

  // Move the "me" arrow on each position update; follow if enabled.
  // Zelfde positiebron als voortgang/afwijking: op de route gematcht zolang
  // we binnen de corridor zitten, anders eerlijk de ruwe GPS-positie.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !location) return
    const shown = displayPosition(
      { lat: location.lat, lon: location.lon },
      match,
      offRouteActive,
      corridorMeters(location.accuracyM, location.speedMps),
    )
    const ll: [number, number] = [shown.lat, shown.lon]
    const hasHeading = location.heading != null
    const rot = location.heading ?? 0
    // The rider is a cyclist badge (not a bare dot). With a known heading a
    // direction pointer rotates around the badge; the cyclist itself stays
    // upright so it always reads as "jij op de fiets".
    const bikeSvg = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="${MAP_INK}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
      </svg>`
    const html = `<span style="position:relative;display:block;width:38px;height:38px;">
        ${
          hasHeading
            ? `<span style="position:absolute;inset:0;transform:rotate(${rot}deg);transform-origin:center;">
                 <svg viewBox="0 0 38 38" width="38" height="38">
                   <path d="M19 0 L24 9 L14 9 Z" fill="${RIDER_ACCENT}" stroke="${MAP_INK}" stroke-width="1.2" stroke-linejoin="round"/>
                 </svg>
               </span>`
            : ""
        }
        <span style="position:absolute;left:5px;top:5px;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${RIDER_ACCENT};border:2px solid ${MAP_INK};box-shadow:0 0 0 3px rgba(56,189,248,0.3),0 0 14px rgba(56,189,248,0.8);transform:rotate(var(--map-counter-rot,0deg));">
          ${bikeSvg}
        </span>
      </span>`
    const icon = L.divIcon({
      className: "",
      html,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    })
    if (!meMarkerRef.current) {
      meMarkerRef.current = L.marker(ll, { icon, zIndexOffset: 1000 }).addTo(map)
    } else {
      meMarkerRef.current.setLatLng(ll)
      meMarkerRef.current.setIcon(icon)
    }
    // Pan without changing zoom once we're zoomed in — avoids the jittery
    // zoom-fighting that made the map feel unstable.
    if (following) {
      const targetZoom = map.getZoom() < 15 ? 16 : map.getZoom()
      map.setView(ll, targetZoom, { animate: true, duration: 0.5 })
    }
  }, [location, following, match, offRouteActive])

  const speedKmh =
    location?.speedMps != null ? Math.round(location.speedMps * 3.6) : null

  // Batterij vs. rit: alleen een uitspraak met een écht gemeten leegloop-
  // snelheid én een echt rijtempo — anders zeggen we niets.
  const rideMinutesLeft =
    progress && avgKmh != null && avgKmh > 3
      ? (progress.remainingKm / avgKmh) * 60
      : null
  const batteryMinutesLeft =
    battery && !battery.charging && drainPerMin != null && drainPerMin > 0
      ? battery.level / drainPerMin
      : null
  const batteryShortfall =
    rideMinutesLeft != null &&
    batteryMinutesLeft != null &&
    batteryMinutesLeft < rideMinutesLeft * 1.1

  const enableEco = () => {
    setEcoMode(true)
    setDimmed(true)
  }
  const disableEco = () => {
    setEcoMode(false)
    setDimmed(false)
  }

  // Moving-average speed. We add distance/time between fixes only while actually
  // moving (≥ 3 km/h), so standing still — e.g. waiting at a traffic light —
  // never drags the average down. Honest: it's a real average of real riding.
  useEffect(() => {
    if (!location) return
    const now = Date.now()
    const a = avgRef.current
    if (a.last) {
      const dt = (now - a.last.t) / 1000
      const dm = haversineM(
        { lat: a.last.lat, lon: a.last.lon },
        { lat: location.lat, lon: location.lon },
      )
      const instKmh = dt > 0 ? (dm / dt) * 3.6 : 0
      // Afstand telt alleen mee tijdens een lopende rit en zonder gps-gaten;
      // de ≥3 km/u-drempel filtert gps-ruis bij stilstand (anders "rijd" je
      // meters terwijl je stilstaat).
      if (
        dt > 0 &&
        dt < 15 &&
        instKmh >= 3 &&
        rideStateRef.current === "riding"
      ) {
        a.meters += dm
      }

      // ── Auto-pauze / auto-hervat ────────────────────────────────
      // Prefer the device-reported speed when available (less GPS jitter);
      // fall back to the speed derived from consecutive fixes.
      const moveKmh =
        location.speedMps != null ? location.speedMps * 3.6 : instKmh
      if (dt > 0 && dt < 15) {
        if (moveKmh < 3) {
          if (rideStateRef.current === "riding") {
            if (stillSinceRef.current == null) stillSinceRef.current = now
            else if (now - stillSinceRef.current >= 5000) {
              setAutoPaused(true)
              setRideState("paused")
              stillSinceRef.current = null
            }
          }
        } else {
          stillSinceRef.current = null
          // Auto-hervat wint ALTIJD: ook een handmatige pauze loopt door zodra
          // je echt weer rijdt. Anders fiets je 15 km verder en ontdek je pas
          // dan dat de pauzeknop nog aanstond.
          if (rideStateRef.current === "paused") {
            setAutoPaused(false)
            setRideState("riding")
          }
        }
      }

      // ── Val-detectie ──────────────────────────────────────────────
      // Alleen tijdens een rit (ook net na auto-pauze): eerst ≥ 20 km/u
      // gereden, daarna binnen 30 s abrupt < 3 km/u en dat 15 s lang → vraag
      // "Alles oké?". Na "Ik ben oké" 5 minuten rust.
      if (dt > 0 && dt < 15 && rideStateRef.current !== "idle") {
        if (moveKmh >= 20) {
          lastFastRef.current = now
          crashStillSinceRef.current = null
        } else if (moveKmh < 3) {
          // De 30 s-toets geldt alleen op het MOMENT dat de stilstand begint
          // (abrupte stop kort na hard rijden). Daarna telt de stilstand
          // gewoon door — anders mist hij precies de val die 20 s na de
          // laatste snelle meting begon.
          if (crashStillSinceRef.current == null) {
            const wasFast =
              lastFastRef.current != null && now - lastFastRef.current < 30000
            if (wasFast) crashStillSinceRef.current = now
          } else if (
            now - crashStillSinceRef.current >= 15000 &&
            crashAlertRef.current == null &&
            now > crashSnoozeUntilRef.current
          ) {
            setCrashAlert({ phase: "asking", secondsLeft: 30 })
            speakCue("Alles oké? Reageer op je scherm.")
          }
        } else {
          crashStillSinceRef.current = null
        }
      }
    }
    a.last = { t: now, lat: location.lat, lon: location.lon }
    // Gemiddelde over de hele rit tot nu toe: afgelegde afstand gedeeld door
    // de rijtijd op de klok — niet een schuivend gemiddelde dat naar je
    // actuele snelheid toe kruipt.
    const rideSecs = rideSecondsRef.current
    // Vanaf de eerste seconde van de rit een echt getal met één decimaal
    // (0,0 bij de start) — nooit meer "—" zodra de rit loopt. Een eenmaal
    // berekende waarde valt cumulatief nooit terug naar niets. De rekenregel
    // zelf leeft in lib/nav-live (updateAvgSpeed) — één bron van waarheid.
    const avgNext = updateAvgSpeed(
      { meters: 0, lastKmh: null },
      a.meters,
      rideSecs,
    )
    setAvgKmh(
      avgNext.lastKmh != null
        ? avgNext.lastKmh
        : rideStateRef.current !== "idle"
          ? 0
          : null,
    )
  }, [location])

  // (Hier stonden de bordjes-sprint-effecten: markers, scoring en
  // aankondigingen. Verwijderd — bordjes sprinten is gestopt wegens
  // veiligheidsrisico op de openbare weg, besluit 31-07-2026.)


  // ── Live intensiteit, belasting & energie (alleen met échte data) ──
  // Elke seconde één wattsample; genormaliseerd vermogen via 30s-gemiddelden
  // tot de vierde macht. Zonder gekoppelde vermogensmeter of bekende FTP
  // blijft alles eerlijk "—" — nooit een verzonnen getal.
  const powerWattsRef = useRef<number | null>(null)
  powerWattsRef.current = power.connected ? power.watts : null
  const liveCalcRef = useRef<{
    win: number[]
    sumP4: number
    n: number
    joules: number
  }>({ win: [], sumP4: 0, n: 0, joules: 0 })
  const [liveStats, setLiveStats] = useState<{
    intensity: number
    tss: number
    energyPct: number
  } | null>(null)
  useEffect(() => {
    if (rideState !== "riding" || !ftp || ftp <= 0) return
    const id = window.setInterval(() => {
      const w = powerWattsRef.current
      if (w == null) return
      const c = liveCalcRef.current
      c.win.push(w)
      if (c.win.length > 30) c.win.shift()
      const avg = c.win.reduce((a, b) => a + b, 0) / c.win.length
      c.sumP4 += avg ** 4
      c.n += 1
      c.joules += w
      const np = (c.sumP4 / c.n) ** 0.25
      const intensity = np / ftp
      const tss = ((c.n * np * intensity) / (ftp * 3600)) * 100
      // Energievoorraad: grove maar eerlijke schatting — volle tank ≈ 90
      // minuten voluit op FTP. Daarom gelabeld met "±": een indicatie.
      const budget = ftp * 3600 * 1.5
      const energyPct = Math.max(
        0,
        Math.round(100 - (c.joules / budget) * 100),
      )
      setLiveStats({
        intensity: Math.round(intensity * 100) / 100,
        tss: Math.round(tss),
        energyPct,
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [rideState, ftp])

  // Losse sensorsamples (1 s) tijdens de rit — óók zonder FTP: ze gaan mee in
  // de GPX (power/cadans) zodat de opgeslagen sessie de echte meterdata bevat.
  const powerConnectedRef = useRef(false)
  powerConnectedRef.current = power.connected
  const powerCadenceRef = useRef<number | null>(null)
  powerCadenceRef.current = power.connected ? power.cadence : null
  useEffect(() => {
    if (rideState !== "riding") return
    const id = window.setInterval(() => {
      if (!powerConnectedRef.current) return
      const w = powerWattsRef.current
      const c = powerCadenceRef.current
      if (w == null && c == null) return
      sensorsRef.current.push({ t: Date.now(), watts: w, cadence: c })
    }, 1000)
    return () => window.clearInterval(id)
  }, [rideState])

  // Bottom metrics — compact. Vermogen/cadans en de afgeleiden (intensiteit,
  // belasting, energie) verschijnen ALLEEN met een nu gekoppelde meter: rijen
  // vol "—" nemen anders schermruimte in zonder iets te zeggen. Koppelen kan
  // via Instellen → "Watt & cadans koppelen".
  const metrics: { label: string; value: string; unit?: string }[] = [
    {
      label: "Resterend",
      value: progress ? progress.remainingKm.toFixed(1) : "—",
      unit: progress ? "km" : undefined,
    },
    {
      label: "Totaal",
      value: distanceKm != null ? distanceKm.toFixed(1) : "—",
      unit: distanceKm != null ? "km" : undefined,
    },
    {
      label: "Snelheid",
      value: speedKmh != null ? `${speedKmh}` : "—",
      unit: speedKmh != null ? "km/u" : undefined,
    },
    {
      // Zodra de rit gestart is altijd een echt getal (0,0 aan de start),
      // nooit "—" — een gemiddelde bestaat vanaf de eerste seconde.
      label: "Gem.",
      value:
        displayAvgKmh(
          { meters: 0, lastKmh: avgKmh },
          rideState !== "idle",
        ) ?? "—",
      unit: rideState !== "idle" || avgKmh != null ? "km/u" : undefined,
    },
    {
      label: "Rijtijd",
      value: rideState === "idle" ? "—" : fmtRideTime(rideSeconds),
    },
  ]
  if (power.connected) {
    metrics.push(
      {
        label: "Vermogen",
        value: power.watts != null ? `${power.watts}` : "—",
        unit: power.watts != null ? "W" : undefined,
      },
      {
        label: "Cadans",
        value: power.cadence != null ? `${power.cadence}` : "—",
        unit: power.cadence != null ? "rpm" : undefined,
      },
    )
    // Alleen met bekende FTP — valt de meter weg, dan verdwijnen deze rijen
    // direct weer (nooit bevroren oude cijfers).
    if (ftp) {
      metrics.push(
        {
          label: "Intensiteit",
          value: liveStats ? liveStats.intensity.toFixed(2) : "—",
        },
        { label: "Belasting", value: liveStats ? `${liveStats.tss}` : "—" },
        {
          label: "Energie ±",
          value: liveStats ? `${liveStats.energyPct}` : "—",
          unit: liveStats ? "%" : undefined,
        },
      )
    }
  }

  // Persistente datavelden-keuze toepassen: alleen velden waarvoor hier een
  // echte live-waarde bestaat worden getoond (eerlijk — geen lege beloftes),
  // begrensd op het gekozen maximum. Zonder opgeslagen keuze: alles zoals nu.
  const FIELD_TO_METRIC: Partial<Record<NavDataField, string>> = {
    snelheid: "Snelheid",
    gemiddelde: "Gem.",
    afstand: "Totaal",
    resterend: "Resterend",
    tijd: "Rijtijd",
    bewegingstijd: "Rijtijd",
    vermogen: "Vermogen",
    cadans: "Cadans",
  }
  let visibleMetrics = metrics
  if (navSettings) {
    const seen = new Set<string>()
    const picked = navSettings.dataFields
      .map((f) => FIELD_TO_METRIC[f])
      .filter((l): l is string => !!l && !seen.has(l) && (seen.add(l), true))
      .map((l) => metrics.find((m) => m.label === l))
      .filter((m): m is (typeof metrics)[number] => !!m)
      .slice(0, navSettings.maxFields)
    if (picked.length > 0) visibleMetrics = picked
  }
  const metricSize = navSettings?.fontSize ?? "normaal"
  const metricsOnTop = navSettings?.barPosition === "boven"
  // Versleepbaar (alleen onderaan): pak de greep en schuif de balk omhoog;
  // hij snapt op 0 / 15% / 30% vanaf de onderkant en onthoudt de keuze.
  const effBarFrac = barDragFrac ?? barOffsetFrac
  const onBarPointerDown = (e: React.PointerEvent) => {
    barDragRef.current = { startY: e.clientY, startFrac: barOffsetFrac }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onBarPointerMove = (e: React.PointerEvent) => {
    const d = barDragRef.current
    if (!d) return
    const frac = Math.max(
      0,
      Math.min(0.3, d.startFrac + (d.startY - e.clientY) / window.innerHeight),
    )
    setBarDragFrac(frac)
  }
  const onBarPointerUp = () => {
    const d = barDragRef.current
    barDragRef.current = null
    if (d == null) return
    setBarDragFrac((cur) => {
      const snapped = snapBarOffset(cur ?? barOffsetFrac)
      setBarOffsetFrac(snapped)
      try {
        sessionStorage.setItem("sparki:nav-balk-offset", String(snapped))
      } catch {
        // niets — dan onthoudt hij het alleen deze sessie niet
      }
      return null
    })
  }
  const metricsBar = (
    <div
      className="pointer-events-auto rounded-2xl border border-white/10 bg-map-panel/92 backdrop-blur-md"
      style={
        !metricsOnTop
          ? {
              transform: `translateY(${-effBarFrac * 100}vh)`,
              transition: barDragFrac == null ? "transform 160ms ease-out" : undefined,
            }
          : undefined
      }
    >
      {!metricsOnTop && (
        <div
          className="flex cursor-grab touch-none items-center justify-center pt-1 active:cursor-grabbing"
          onPointerDown={onBarPointerDown}
          onPointerMove={onBarPointerMove}
          onPointerUp={onBarPointerUp}
          onPointerCancel={onBarPointerUp}
          aria-label="Databalk verslepen"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={30}
          aria-valuenow={Math.round(effBarFrac * 100)}
          tabIndex={0}
        >
          <GripHorizontal className="h-4 w-4 text-white/35" strokeWidth={2} />
        </div>
      )}
      <div className="grid grid-cols-5 gap-x-1.5 gap-y-2 px-3 pb-2 pt-1">
        {visibleMetrics.map((m) => (
          <Metric
            key={m.label}
            label={m.label}
            value={m.value}
            unit={m.unit}
            size={metricSize}
          />
        ))}
      </div>
    </div>
  )

  // Ridden distance so far (km) — gates the "bewaar gereden rit" option so we
  // never offer to save a track that is too short to be a real route.
  function riddenKm(): number {
    const pts = riddenRef.current
    let m = 0
    for (let i = 1; i < pts.length; i++) m += haversineM(pts[i - 1]!, pts[i]!)
    return m / 1000
  }

  async function saveRiddenRoute() {
    const pts = riddenRef.current
    if (pts.length < 2) return
    setSaveRideState("saving")
    const now = new Date()
    const gpx = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<gpx version="1.1" creator="Sparki" xmlns="http://www.topografix.com/GPX/1/1">`,
      `<trk><name>Gereden: ${name.replace(/[<>&]/g, "")} (${now.toLocaleDateString("nl-NL")})</name><trkseg>`,
      ...pts.map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}"></trkpt>`),
      `</trkseg></trk></gpx>`,
    ].join("\n")
    try {
      await apiFetch("/api/routes", {
        method: "POST",
        body: JSON.stringify({ content: gpx }),
      })
      clearSavedRide(routeId)
      onClose()
    } catch {
      setSaveRideState("error")
    }
  }

  const canSaveRide = riddenRef.current.length >= 2 && riddenKm() >= 0.2

  // ── Ritafronding: opslaan in Sparki (Data Hub) ────────────────────
  // Stop → ritoverzicht → Opslaan bouwt een GPX met tijd/sensordata en zet
  // hem via de bestaande import-route in de Data Hub; daarna wordt gecheckt
  // of doorzetten naar Strava beschikbaar is (capabilities — eerlijk).
  const saveRideToSparki = async () => {
    const pts = riddenRef.current
    if (pts.length < 2 || uploadState === "uploading") return
    setUploadState("uploading")
    setUploadError(null)
    try {
      const gpx = buildLiveRideGpx(name, pts, sensorsRef.current)
      const resp = await apiFetch<{
        import: unknown
        parsed: unknown
        sessionId: number | null
      }>("/api/activity-imports", {
        method: "POST",
        body: JSON.stringify({
          fileName: `sparki-rit-${new Date().toISOString().slice(0, 10)}.gpx`,
          content: gpx,
        }),
      })
      clearSavedRide(routeId)
      setUploadedSessionId(resp.sessionId)
      setUploadState("done")
      if (resp.sessionId) {
        try {
          const share = await apiFetch<{
            capabilities?: { strava?: { available?: boolean } }
          }>(`/api/share/session/${resp.sessionId}`)
          setStravaAvailable(!!share.capabilities?.strava?.available)
        } catch {
          setStravaAvailable(false)
        }
      }
    } catch (err) {
      setUploadState("error")
      setUploadError(
        parseApiError(err, "Opslaan is niet gelukt. Probeer het opnieuw."),
      )
    }
  }

  const sendRideToStrava = async () => {
    if (!uploadedSessionId || stravaState === "busy") return
    setStravaState("busy")
    setStravaError(null)
    try {
      await apiFetch<{ ok: boolean; url?: string }>(
        `/api/share/session/${uploadedSessionId}/strava`,
        { method: "POST", body: JSON.stringify({}) },
      )
      setStravaState("done")
    } catch (err) {
      setStravaState("error")
      setStravaError(
        parseApiError(err, "Doorzetten naar Strava is niet gelukt."),
      )
    }
  }

  const discardRide = () => {
    clearSavedRide(routeId)
    onClose()
  }

  // ── Foto onderweg ─────────────────────────────────────────────────
  // Opent de camera van de telefoon; daarna direct het deel-menu van het
  // toestel (WhatsApp, Instagram, …). Zonder deel-menu: nette download zodat
  // de foto nooit verloren gaat.
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const handlePhotoTaken = async (file: File) => {
    const shareText =
      sport === "walking" || sport === "hiking"
        ? `Onderweg te voet 🚶 — genavigeerd met Sparki.`
        : `Onderweg op de fiets 🚴 — genavigeerd met Sparki.`
    const nav = window.navigator as Navigator & {
      canShare?: (data: ShareData) => boolean
    }
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], text: shareText })
        return
      } catch {
        // Geannuleerd of niet gelukt — val terug op downloaden.
      }
    }
    const url = URL.createObjectURL(file)
    const a = document.createElement("a")
    a.href = url
    a.download = file.name || `sparki-foto-${Date.now()}.jpg`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  // ── Rit delen ─────────────────────────────────────────────────────
  // Via het deel-menu van het toestel (daar zitten Strava, Facebook en
  // Instagram tussen als die apps geïnstalleerd zijn). Eerlijk: rechtstreeks
  // in Strava zetten kan alleen via een Strava-koppeling met schrijfrechten —
  // die is er niet; wél kan de gereden rit als GPX gedownload en in Strava
  // geüpload worden.
  const rideShareText = () =>
    [
      `🚴 ${riddenKm().toFixed(1)} km gereden in ${fmtRideTime(rideSeconds)}`,
      avgKmh != null ? ` (gem. ${avgKmh} km/u)` : "",
      ` — genavigeerd met Sparki.`,
    ].join("")
  const canWebShare = typeof navigator !== "undefined" && !!navigator.share
  const shareRide = async () => {
    try {
      await navigator.share({ text: rideShareText() })
    } catch {
      // Geannuleerd — niets aan de hand.
    }
  }
  const downloadRideGpx = () => {
    const pts = riddenRef.current
    if (pts.length < 2) return
    const gpx = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<gpx version="1.1" creator="Sparki" xmlns="http://www.topografix.com/GPX/1/1">`,
      `<trk><name>Gereden: ${name.replace(/[<>&]/g, "")}</name><trkseg>`,
      ...pts.map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}"></trkpt>`),
      `</trkseg></trk></gpx>`,
    ].join("\n")
    const url = URL.createObjectURL(
      new Blob([gpx], { type: "application/gpx+xml" }),
    )
    const a = document.createElement("a")
    a.href = url
    a.download = `sparki-rit-${new Date().toISOString().slice(0, 10)}.gpx`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  const overlay = (
    <div className="fixed inset-0 z-[90] isolate bg-map-ink">
      {/* Kaart, eventueel gedraaid (rijrichting boven). De kaartlaag is dan
          groter dan het scherm zodat er bij het draaien geen hoeken openvallen;
          icoontjes draaien via --map-counter-rot terug zodat ze leesbaar
          blijven. */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute"
          style={{
            inset: headingUpActive ? "-30%" : "0",
            transform: headingUpActive ? `rotate(${-rotDeg}deg)` : undefined,
            transition: "transform 0.6s linear",
            ["--map-counter-rot" as string]: headingUpActive
              ? `${rotDeg}deg`
              : "0deg",
          } as React.CSSProperties}
        >
          <div ref={containerRef} className="absolute inset-0" />
        </div>
      </div>

      {/* Zoomknoppen — eigen grote knoppen (de standaard Leaflet-knopjes zijn
          te klein voor onderweg met handschoenen). */}
      <div className="pointer-events-auto absolute right-2 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Inzoomen"
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-map-panel/90 text-white/80 shadow-lg backdrop-blur-md transition hover:text-white"
        >
          <Plus className="h-5 w-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Uitzoomen"
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-map-panel/90 text-white/80 shadow-lg backdrop-blur-md transition hover:text-white"
        >
          <Minus className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      {/* Top bar: close + next instruction */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
        {metricsOnTop && metricsBar}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setSaveRideState("idle"); setConfirmClose(true) }}
            aria-label="Navigatie sluiten"
            className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-map-panel/90 p-2 text-white/60 backdrop-blur-md transition hover:text-white"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
          <div className="min-w-0 flex-1 truncate rounded-full border border-white/10 bg-map-panel/90 px-3 py-2 text-[13px] text-white/70 backdrop-blur-md">
            {name}
          </div>
          <button
            type="button"
            onClick={() => setSetupOpen((v) => !v)}
            aria-label="Rit-instellingen"
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] backdrop-blur-md transition ${
              setupOpen
                ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-200"
                : "border-white/10 bg-map-panel/90 text-white/70 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />
            Instellen
          </button>
          <button
            type="button"
            onClick={() => setShowLegend((v) => !v)}
            aria-label="Legenda — uitleg van de icoontjes"
            className={`flex shrink-0 items-center justify-center rounded-full border p-2 backdrop-blur-md transition ${
              showLegend
                ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-200"
                : "border-white/10 bg-map-panel/90 text-white/70 hover:text-white"
            }`}
          >
            <Info className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Subtiele windregel — alleen bij een echte meting. De pijl wijst
            waar de wind naartoe waait. */}
        {wind && !ecoMode && (
          <div className="pointer-events-none flex justify-end">
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-map-panel/70 px-2.5 py-1 font-mono text-[11px] tabular-nums text-white/50 backdrop-blur-md">
              <Wind className="h-3 w-3" strokeWidth={1.75} />
              <ArrowUp
                className="h-3 w-3"
                strokeWidth={2.25}
                style={{
                  transform: `rotate(${(wind.dirDeg + 180) % 360}deg)`,
                }}
              />
              {wind.kmh} km/u
            </div>
          </div>
        )}

        {/* Klim-weergave: nadert de rijder een bekende klim, dan verschijnt
            die alvast; óp de klim staan de cijfers groot; na de top verdwijnt
            alles. Cijfers komen uit het echte hoogteprofiel van de route. */}
        {climbLive && climbLive.phase === "komt" && (
          <div className="pointer-events-none flex justify-end">
            <div className="w-[220px] rounded-2xl border border-white/10 bg-map-panel/85 p-3 backdrop-blur-md">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: ACCENT }}>
                Klim over {fmtMeters(climbLive.inM)}
              </p>
              <p className="mt-1 truncate text-[14px] font-semibold text-white/90">
                {climbLive.climb.name}
              </p>
              <p className="mt-0.5 font-mono text-[11px] tabular-nums text-white/55">
                {climbLive.climb.lengthKm.toFixed(1)} km ·{" "}
                {climbLive.climb.avgGradePct.toFixed(1)}% gem.
              </p>
              {climbShape && (
                <svg
                  viewBox={`0 0 ${climbShape.W} ${climbShape.H}`}
                  className="mt-2 w-full"
                  aria-hidden="true"
                >
                  <polyline
                    points={climbShape.line}
                    fill="none"
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth="1.5"
                  />
                </svg>
              )}
            </div>
          </div>
        )}
        {climbLive &&
          (climbLive.phase === "op" || climbLive.phase === "top") &&
          !climbPanelCollapsed && (
            <div className="pointer-events-auto w-full rounded-2xl border backdrop-blur-md" style={{ borderColor: "rgba(94,234,255,0.35)", background: "rgba(7,13,22,0.9)" }}>
              <div className="flex items-center justify-between px-3.5 pt-2.5">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: ACCENT }}>
                  {climbLive.phase === "top" ? "Bijna boven!" : "Op de klim"} ·{" "}
                  <span className="normal-case tracking-normal text-white/70">
                    {climbLive.climb.name}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => setClimbPanelCollapsed(true)}
                  aria-label="Klimpaneel inklappen"
                  className="rounded-full border border-white/15 p-1 text-white/55 transition hover:text-white/85"
                >
                  <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
              {/* 60/40: links het klimprofiel met de fietser, rechts de cijfers. */}
              <div className="flex items-stretch gap-3 px-3.5 pb-3 pt-1.5">
                <div className="relative basis-[60%]">
                  {climbShape ? (
                    <>
                      <svg
                        viewBox={`0 0 ${climbShape.W} ${climbShape.H}`}
                        preserveAspectRatio="none"
                        className="h-[74px] w-full"
                        aria-hidden="true"
                      >
                        <polyline
                          points={`0,${climbShape.H} ${climbShape.line} ${climbShape.W},${climbShape.H}`}
                          fill="rgba(94,234,255,0.12)"
                          stroke="none"
                        />
                        <polyline
                          points={climbShape.line}
                          fill="none"
                          stroke="rgba(255,255,255,0.5)"
                          strokeWidth="1.5"
                        />
                      </svg>
                      {climbShape.showDot && (
                        <span
                          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-[16px] leading-none"
                          style={{
                            left: `${(climbShape.dotX / climbShape.W) * 100}%`,
                            top: `${(climbShape.dotY / climbShape.H) * 100}%`,
                          }}
                          aria-hidden="true"
                        >
                          🚴
                        </span>
                      )}
                    </>
                  ) : (
                    <p className="text-[11px] text-white/45">
                      Geen bruikbaar hoogteprofiel voor deze klim.
                    </p>
                  )}
                  <p className="mt-1 text-[10px] leading-snug text-white/35">
                    Uit het hoogteprofiel van de route
                  </p>
                </div>
                <div className="flex basis-[40%] flex-col justify-center gap-2">
                  <div className="flex items-end gap-3">
                    <div>
                      <p className="text-[24px] font-semibold leading-none tabular-nums text-white/95">
                        {fmtMeters(climbLive.toTopM)}
                      </p>
                      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">
                        tot de top
                      </p>
                    </div>
                    {climbLive.gradeNowPct != null && (
                      <div>
                        <p className="text-[24px] font-semibold leading-none tabular-nums" style={{ color: ACCENT }}>
                          {climbLive.gradeNowPct.toFixed(1)}%
                        </p>
                        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">
                          hier
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-end gap-3">
                    {climbLive.toClimbM != null && (
                      <div>
                        <p className="text-[18px] font-semibold leading-none tabular-nums text-white/90">
                          {climbLive.toClimbM}
                        </p>
                        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">
                          hm te gaan
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-[18px] font-semibold leading-none tabular-nums text-white/90">
                        {climbLive.climb.avgGradePct.toFixed(1)}%
                      </p>
                      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">
                        gem. klim
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        {climbLive &&
          (climbLive.phase === "op" || climbLive.phase === "top") &&
          climbPanelCollapsed && (
            <div className="pointer-events-auto flex justify-end">
              <button
                type="button"
                onClick={() => setClimbPanelCollapsed(false)}
                className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-left backdrop-blur-md"
                style={{ borderColor: "rgba(94,234,255,0.35)", background: "rgba(7,13,22,0.88)" }}
              >
                <span className="text-[14px]" aria-hidden="true">🚴</span>
                <span className="font-mono text-[11px] tabular-nums text-white/85">
                  {fmtMeters(climbLive.toTopM)} tot top
                  {climbLive.gradeNowPct != null
                    ? ` · ${climbLive.gradeNowPct.toFixed(1)}%`
                    : ""}
                </span>
                <ChevronUp className="h-3.5 w-3.5 text-white/55" strokeWidth={2} />
              </button>
            </div>
          )}
        {climbLive && climbLive.phase === "einde" && (
          <div className="pointer-events-none flex justify-end">
            <div className="w-[220px] rounded-2xl border p-3 backdrop-blur-md" style={{ borderColor: "rgba(94,234,255,0.35)", background: "rgba(7,13,22,0.88)" }}>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: ACCENT }}>
                Top bereikt
              </p>
              <p className="mt-1 truncate text-[14px] font-semibold text-white/90">
                {climbLive.climb.name} — goed gedaan!
              </p>
            </div>
          </div>
        )}

        {/* Uitklapbare legenda — legt alleen uit wat ECHT op deze kaart staat. */}
        {showLegend && (
          <div className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-white/10 bg-map-panel/95 p-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                Wat betekenen de icoontjes?
              </p>
              <button
                type="button"
                onClick={() => setShowLegend(false)}
                aria-label="Legenda sluiten"
                className="rounded-full border border-white/15 p-1 text-white/55 transition hover:text-white/85"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            </div>
            <ul className="flex flex-col gap-1.5 text-[12px] text-white/70">
              <li className="flex items-center gap-2.5">
                <span className="flex h-5 w-6 shrink-0 items-center justify-center text-[14px]">🟢</span>
                Groene vlag = start van de route · geblokte vlag = finish
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-5 w-6 shrink-0 items-center justify-center text-[14px]">⬆️</span>
                Witte pijlen op de lijn = rijrichting
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-5 w-6 shrink-0 items-center justify-center text-[14px]">🚴</span>
                Blauwe stip met pijl = jij, met je kijkrichting
              </li>
              {/* Legenda-regel voor sprintbordjes verwijderd — bordjes
                  sprinten is gestopt (veiligheid, besluit 31-07-2026). */}
              {Array.from(new Set(pois.map((p) => p.kind))).map((kind) => (
                <li key={kind} className="flex items-center gap-2.5">
                  <span className="flex h-5 w-6 shrink-0 items-center justify-center text-[14px]">
                    {POI_ICONS[kind] ?? "⭐"}
                  </span>
                  {kind} — tik erop voor details en “Route hierlangs”
                </li>
              ))}
            </ul>
            {pois.length === 0 && (
              <p className="text-[11px] text-white/45">
                Voor deze route zijn geen plekken (café’s, bezienswaardigheden)
                gevonden — dan staan er ook geen plek-icoontjes op de kaart.
              </p>
            )}
          </div>
        )}

        {setupOpen && (
          <div className="pointer-events-auto flex flex-col gap-3 rounded-2xl border border-white/10 bg-map-panel/95 p-3 backdrop-blur-md">
            {/* Map style — a one-time choice at the start of the ride. */}
            <div>
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                Kaartweergave
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    disabled={ecoMode}
                    onClick={() => setBasemap(id)}
                    className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition disabled:opacity-40 ${
                      activeBasemap === id
                        ? "bg-cyan-400 text-map-ink"
                        : "border border-white/10 text-white/55 hover:text-white/85"
                    }`}
                  >
                    {BASEMAPS[id].label}
                  </button>
                ))}
              </div>
              {ecoMode && (
                <p className="mt-1.5 text-[11px] leading-snug text-white/45">
                  Spaarstand aan: de kaart blijft donker. Zet de spaarstand uit
                  om te wisselen.
                </p>
              )}
            </div>

            {/* Route onderweg aanpassen — zonder alles kwijt te raken. */}
            {onEditRoute && (
              <div>
                <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                  Route wijzigen
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      // Track + rijtijd eerst veiligstellen: de routebouwer
                      // unmount dit scherm, bij terugkomst gaat de rit door.
                      persistRide()
                      onEditRoute()
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-cyan-300/35 px-3 py-1.5 text-[11px] text-cyan-300 transition hover:bg-cyan-300/10"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Route aanpassen
                  </button>
                  <button
                    type="button"
                    disabled={detourLoading != null || !location}
                    onClick={() => void requestBackToStart()}
                    className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-white/70 transition hover:text-white disabled:opacity-40"
                  >
                    <CornerUpLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Terug naar startpunt
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">
                  Route aanpassen opent de routebouwer met de punten voorgevuld —
                  je gereden rit en rijtijd blijven bewaard en lopen daarna
                  gewoon door. Terug naar startpunt berekent een echte route
                  vanaf hier naar het beginpunt.
                </p>
              </div>
            )}

            {/* Plekken langs de route aan/uit op de kaart. */}
            <div>
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                Plekken op de kaart
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={ecoMode}
                  onClick={() => setShowPois(true)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] transition disabled:opacity-40 ${
                    poisVisible
                      ? "bg-cyan-400 text-map-ink"
                      : "border border-white/10 text-white/55 hover:text-white/85"
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Tonen
                </button>
                <button
                  type="button"
                  disabled={ecoMode}
                  onClick={() => setShowPois(false)}
                  className={`rounded-full px-3 py-1.5 text-[11px] transition disabled:opacity-40 ${
                    !poisVisible
                      ? "bg-cyan-400 text-map-ink"
                      : "border border-white/10 text-white/55 hover:text-white/85"
                  }`}
                >
                  Verbergen
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-white/45">
                {ecoMode
                  ? "Spaarstand aan: plekken staan uit om de batterij te sparen."
                  : "Café’s en bezienswaardigheden langs de route als icoontjes op de kaart."}
              </p>
            </div>

            {/* Group riding — puur informatief (wie rijdt er mee). */}
            <div>
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                {sport === "walking" || sport === "hiking"
                  ? "Ben je met anderen op pad?"
                  : "Rij je met anderen?"}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setWithOthers(false)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] transition ${
                    !withOthers
                      ? "bg-cyan-400 text-map-ink"
                      : "border border-white/10 text-white/55 hover:text-white/85"
                  }`}
                >
                  <User className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Alleen
                </button>
                <button
                  type="button"
                  onClick={() => setWithOthers(true)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] transition ${
                    withOthers
                      ? "bg-cyan-400 text-map-ink"
                      : "border border-white/10 text-white/55 hover:text-white/85"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Met anderen
                </button>
              </div>
              {withOthers && (
                <p className="mt-1.5 text-[11px] leading-snug text-white/45">
                  {sport === "walking" || sport === "hiking"
                    ? "Je bent met anderen op pad — dat zie je terug in het verslag."
                    : "Je rijdt met anderen — dat zie je terug in het ritverslag."}
                </p>
              )}
            </div>

            {/* Stappenplan — volledige lijst aanwijzingen aan/uit. */}
            {nav.length > 0 && (
              <div>
                <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                  Stappenplan
                </p>
                <button
                  type="button"
                  onClick={() => setShowSteps((v) => !v)}
                  className={`rounded-full px-3 py-1.5 text-[11px] transition ${
                    showSteps
                      ? "bg-cyan-400 text-map-ink"
                      : "border border-white/10 text-white/55 hover:text-white/85"
                  }`}
                >
                  {showSteps ? "Verberg stappenplan" : "Toon stappenplan"}
                </button>
                <p className="mt-1.5 text-[11px] leading-snug text-white/45">
                  Alle afslag-aanwijzingen onder elkaar, onderin het scherm.
                </p>
              </div>
            )}

            {/* Sensor pairing — watts + cadans over Bluetooth. */}
            <div>
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                Sensoren
              </p>
              {savedSensors.length > 0 && (
                <div className="mb-2 space-y-1">
                  {savedSensors.map((s) => (
                    <p key={s.id} className="text-[11px] leading-snug text-white/55">
                      <span className="text-white/80">
                        {[s.brand, s.model].filter(Boolean).join(" ") ||
                          s.deviceName ||
                          SENSOR_KIND_LABEL[s.kind]}
                      </span>{" "}
                      <span className="text-white/35">
                        · {SENSOR_KIND_LABEL[s.kind]}
                        {s.bikeId != null && bikeNameById.has(s.bikeId)
                          ? ` · ${bikeNameById.get(s.bikeId)}`
                          : ""}
                      </span>
                    </p>
                  ))}
                </div>
              )}
              {!power.supported ? (
                <p className="text-[11px] leading-snug text-white/45">
                  Deze telefoon of browser ondersteunt geen
                  Bluetooth-koppeling.
                </p>
              ) : power.connected ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-200">
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                    {power.deviceName ?? "Vermogensmeter"} gekoppeld
                  </span>
                  <button
                    type="button"
                    onClick={power.disconnect}
                    className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/55 transition hover:text-white/85"
                  >
                    Ontkoppel
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={connectSensors}
                    className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 px-3 py-1.5 text-[11px] text-cyan-200 transition hover:bg-cyan-400/10"
                  >
                    <Bluetooth className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {savedSensors.length > 0
                      ? "Opnieuw koppelen"
                      : "Watt & cadans koppelen"}
                  </button>
                  {savedSensors.length > 0 && (
                    <p className="mt-1.5 text-[11px] leading-snug text-white/35">
                      De browser vraagt bij elke rit opnieuw om bevestiging —
                      dat kan niet automatisch.
                    </p>
                  )}
                </>
              )}
              {power.error && (
                <p className="mt-1.5 text-[11px] leading-snug text-[rgba(255,180,120,0.9)]">
                  {power.error}
                </p>
              )}
            </div>

            {/* Batterij — spaarstand voor lange ritten. */}
            <div>
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                Batterij
              </p>
              {battery ? (
                <p className="text-[11px] leading-snug text-white/55">
                  {Math.round(battery.level * 100)}%
                  {battery.charging ? " · aan de lader" : ""}
                  {batteryMinutesLeft != null
                    ? ` · bij dit verbruik nog ~${Math.round(batteryMinutesLeft)} min`
                    : ""}
                </p>
              ) : (
                <p className="text-[11px] leading-snug text-white/45">
                  Deze telefoon of browser geeft de batterijstand niet vrij —
                  de spaarstand kun je wel handmatig aanzetten.
                </p>
              )}
              <div className="mt-1.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={disableEco}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                    !ecoMode
                      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                      : "border-white/10 text-white/55 hover:text-white/85"
                  }`}
                >
                  Normaal
                </button>
                <button
                  type="button"
                  onClick={enableEco}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                    ecoMode
                      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                      : "border-white/10 text-white/55 hover:text-white/85"
                  }`}
                >
                  Spaarstand
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-white/35">
                Spaarstand: donkere kaart, plekken/wind/kaartdraaiing uit en
                een bijna-zwart zuinig scherm met alleen het hoognodige. Het
                valalarm en het opnemen van je rit blijven gewoon aan.
              </p>
            </div>
          </div>
        )}

        {/* De bordjes-sprintbanner stond hier; het spel is gestopt
            (veiligheidsrisico op openbare weg, besluit 31-07-2026). Alleen de
            eerlijke maten-melding blijft over. */}
        {routeId != null && withOthers && buddyNames.length > 0 && (
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/15 bg-map-panel/92 px-3.5 py-2.5 backdrop-blur-md">
            <Users
              className="h-5 w-5 shrink-0 text-cyan-300"
              strokeWidth={1.75}
            />
            <p className="text-[12.5px] leading-snug text-white/70">
              Samen met {buddyNames.join(", ")}.
            </p>
          </div>
        )}

        {/* Batterijwaarschuwing — alleen bij een echt gemeten tekort. */}
        {batteryShortfall && !ecoMode && !ecoPromptDismissed && battery && (
          <div className="pointer-events-auto flex flex-col gap-2.5 rounded-xl border border-red-400/40 bg-map-panel/92 px-3.5 py-3 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <BatteryLow
                className="h-5 w-5 shrink-0 text-red-300"
                strokeWidth={1.75}
              />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-red-200">
                  Batterij {Math.round(battery.level * 100)}% — haalt het einde
                  vermoedelijk niet
                </p>
                <p className="text-[12px] leading-snug text-white/55">
                  Bij dit verbruik nog ~{Math.round(batteryMinutesLeft!)} min
                  batterij, terwijl de rit nog ~{Math.round(rideMinutesLeft!)}{" "}
                  min duurt. De spaarstand zet plekken, wind en kaartdraaiing
                  uit, maakt de kaart donker en toont een zuinig scherm.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEcoPromptDismissed(true)}
                className="flex-1 rounded-full border border-white/15 px-3 py-2 text-[12px] font-medium text-white/70 transition hover:bg-white/5"
              >
                Niet nu
              </button>
              <button
                type="button"
                onClick={enableEco}
                className="flex-1 rounded-full bg-red-400 px-3 py-2 text-[12px] font-semibold text-map-ink transition"
              >
                Spaarstand aan
              </button>
            </div>
          </div>
        )}

        {ecoMode && !dimmed && (
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/10 bg-map-panel/92 px-3.5 py-2.5 backdrop-blur-md">
            <Battery
              className="h-5 w-5 shrink-0 text-white/60"
              strokeWidth={1.75}
            />
            <p className="flex-1 text-[12.5px] leading-snug text-white/70">
              Spaarstand aan
              {battery ? ` · batterij ${Math.round(battery.level * 100)}%` : ""}
              .
            </p>
            <button
              type="button"
              onClick={() => setDimmed(true)}
              className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/70 transition hover:bg-white/5"
            >
              Zuinig scherm
            </button>
            <button
              type="button"
              onClick={disableEco}
              className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/55 transition hover:text-white/85"
            >
              Uit
            </button>
          </div>
        )}

        {coffeePrompt && !detour && (
          <div className="pointer-events-auto flex flex-col gap-2.5 rounded-xl border border-amber-400/40 bg-map-panel/92 px-3.5 py-3 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="text-[22px] leading-none">☕</span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-amber-200">
                  Tijd voor een koffiepauze?
                </p>
                <p className="truncate text-[12px] text-white/55">
                  {coffeePrompt.poi.name} ({coffeePrompt.poi.kind.toLowerCase()})
                  ligt verderop bij km {coffeePrompt.poi.routeKm}.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={dismissCoffee}
                className="flex-1 rounded-full border border-white/15 px-3 py-2 text-[12px] font-medium text-white/70 transition hover:bg-white/5"
              >
                {sport === "walking" || sport === "hiking"
                  ? "Nee, verder gaan"
                  : "Nee, doorfietsen"}
              </button>
              <button
                type="button"
                onClick={acceptCoffee}
                disabled={detourLoading != null || !location}
                className="flex-1 rounded-full bg-amber-400 px-3 py-2 text-[12px] font-semibold text-map-ink transition disabled:opacity-50"
              >
                {detourLoading === "poi" ? "Bezig…" : "Ja, breng me erheen"}
              </button>
            </div>
          </div>
        )}

        {selectedPoi && !detour && (
          <div className="pointer-events-auto flex flex-col gap-2.5 rounded-xl border border-white/15 bg-map-panel/92 px-3.5 py-3 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <span className="text-[22px] leading-none">
                {POI_ICONS[selectedPoi.kind] ?? "⭐"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white/90">
                  {selectedPoi.name}
                </p>
                <p className="truncate text-[12px] text-white/55">
                  {selectedPoi.kind} · bij km {selectedPoi.routeKm} ·{" "}
                  {fmtMeters(selectedPoi.offRouteM)} van de route
                </p>
                {selectedPoi.category === "service" && (
                  <p className="truncate text-[12px]">
                    {selectedPoi.openState === "open" ? (
                      <span className="text-emerald-300/90">
                        Nu open
                        {selectedPoi.openingHours
                          ? ` · ${selectedPoi.openingHours}`
                          : ""}
                      </span>
                    ) : (
                      <span className="text-white/45">
                        Openingstijden onbekend — bel of check vooraf
                      </span>
                    )}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPoi(null)
                  setDetourError(null)
                }}
                aria-label="Sluiten"
                className="shrink-0 rounded-full border border-white/15 p-1.5 text-white/55 transition hover:text-white/85"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
            {detourError && (
              <p className="text-[12px] text-[rgba(255,140,120,0.9)]">
                {detourError}
              </p>
            )}
            {!location && (
              <p className="text-[12px] text-white/45">
                De route verleggen kan zodra je locatie bekend is.
              </p>
            )}
            <button
              type="button"
              onClick={() => requestPoiDetour(selectedPoi)}
              disabled={detourLoading != null || !location}
              className="flex items-center justify-center gap-1.5 rounded-full bg-cyan-400 px-3 py-2 text-[12px] font-semibold text-map-ink transition disabled:opacity-50"
            >
              <Navigation className="h-3.5 w-3.5" strokeWidth={2} />
              {detourLoading === "poi" ? "Bezig…" : "Route hierlangs"}
            </button>
          </div>
        )}

        {detour ? (
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-amber-400/40 bg-map-panel/92 px-3.5 py-3 backdrop-blur-md">
            <Navigation
              className="h-6 w-6 shrink-0 text-amber-300"
              strokeWidth={1.75}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-amber-200">
                {detour.mode === "poi"
                  ? `Onderweg naar ${detour.stopName ?? "je tussenstop"}`
                  : detour.mode === "verder"
                    ? "Vervolg actief"
                    : "Terug naar de route"}
              </p>
              <p className="truncate text-[12px] text-white/55">
                {detourProgress
                  ? detour.mode === "poi"
                    ? `Nog ${fmtMeters(detourProgress.remainingKm * 1000)} — daarna pik je de route weer op.`
                    : `Nog ${fmtMeters(detourProgress.remainingKm * 1000)} tot je de route weer oppikt.`
                  : "Volg de gele stippellijn tot je de route weer oppikt."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDetour(null)}
              className="shrink-0 rounded-full border border-white/15 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/55 transition hover:text-white/85"
            >
              Stop
            </button>
          </div>
        ) : null}

        {nav.length > 0 ? (
          progress?.offRoute && !detour ? (
            <div className="pointer-events-auto flex flex-col gap-2.5 rounded-xl border border-[rgba(255,120,100,0.5)] bg-map-panel/92 px-3.5 py-3 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <TriangleAlert
                  className="h-6 w-6 shrink-0 text-[rgba(255,140,120,0.9)]"
                  strokeWidth={1.75}
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[rgba(255,140,120,0.95)]">
                    Van de route
                  </p>
                  <p className="truncate text-[12px] text-white/55">
                    Je bent {fmtMeters(progress.offBy)} van de route. Wat wil
                    je doen?
                  </p>
                </div>
              </div>
              {detourError && (
                <p className="text-[12px] text-[rgba(255,140,120,0.9)]">
                  {detourError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => requestDetour("terug")}
                  disabled={detourLoading != null}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-[12px] font-medium text-white/80 transition hover:bg-white/5 disabled:opacity-50"
                >
                  <CornerUpLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {detourLoading === "terug" ? "Bezig…" : "Terug naar route"}
                </button>
                <button
                  type="button"
                  onClick={() => requestDetour("verder")}
                  disabled={detourLoading != null}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-cyan-400 px-3 py-2 text-[12px] font-semibold text-map-ink transition disabled:opacity-50"
                >
                  <Navigation className="h-3.5 w-3.5" strokeWidth={2} />
                  {detourLoading === "verder"
                    ? "Bezig…"
                    : "Verder — pik route later op"}
                </button>
              </div>
            </div>
          ) : nextStep ? (
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/10 bg-map-panel/92 px-3.5 py-2 backdrop-blur-md">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: "rgba(56,189,248,0.18)" }}
              >
                {(() => {
                  const Icon = describeDir(nextStep.dir).icon
                  return (
                    <Icon
                      className="h-8 w-8 text-cyan-300"
                      strokeWidth={2.25}
                    />
                  )
                })()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[17px] font-semibold text-white/95">
                    {describeDir(nextStep.dir).label}
                  </p>
                  {distanceToTurn != null && (
                    <span className="font-mono text-[17px] font-semibold tabular-nums text-cyan-300">
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
            <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/10 bg-map-panel/92 px-3.5 py-3 backdrop-blur-md">
              <Navigation className="h-5 w-5 text-cyan-300" strokeWidth={1.75} />
              <p className="text-[13px] text-white/60">
                {location ? "Volg de route." : "Wachten op je locatie…"}
              </p>
            </div>
          )
        ) : (
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/10 bg-map-panel/92 px-3.5 py-3 backdrop-blur-md">
            <Navigation className="h-5 w-5 text-white/40" strokeWidth={1.75} />
            <p className="text-[13px] text-white/55">
              Deze route heeft geen afslag-aanwijzingen. De lijn wordt wel
              getoond.
            </p>
          </div>
        )}

        {workout?.structure && (
          <WorkoutHud
            structure={workout.structure}
            title={workout.title}
            ftp={ftp}
            elapsedSec={Math.max(0, rideSeconds - workoutHoldSec)}
            liveWatts={power.connected ? power.watts : null}
            riding={rideState === "riding"}
            turnHold={turnHold}
          />
        )}

        {geoError && (
          <div className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-white/10 bg-map-panel/92 px-3.5 py-3 backdrop-blur-md">
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-stretch gap-2 p-3">
        {!following && location && (
          <button
            type="button"
            onClick={() => setFollowing(true)}
            className="pointer-events-auto mx-auto flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-[13px] font-semibold text-map-ink shadow-lg"
          >
            <LocateFixed className="h-4 w-4" strokeWidth={2} />
            Centreer
          </button>
        )}

        {rideState === "paused" && (
          <div className="pointer-events-auto mx-auto rounded-full border border-amber-400/30 bg-map-warn-soft/92 px-4 py-1.5 text-[12px] font-medium text-amber-200 backdrop-blur-md">
            {autoPaused
              ? "Automatisch gepauzeerd — rijd verder om te hervatten"
              : "Gepauzeerd — hervat vanzelf zodra je weer rijdt"}
          </div>
        )}

        <div className="pointer-events-auto flex items-stretch gap-2">
          <button
            type="button"
            disabled={ecoMode}
            onClick={() => setHeadingUp((v) => !v)}
            aria-label={
              ecoMode
                ? "Spaarstand aan: kaartdraaiing staat uit"
                : headingUpActive
                  ? "Nu: rijrichting boven — tik voor noorden boven"
                  : "Nu: noorden boven — tik voor rijrichting boven"
            }
            className={`flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border px-3.5 shadow-lg backdrop-blur-md transition disabled:opacity-40 ${
              headingUpActive
                ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-200"
                : "border-white/10 bg-map-panel/92 text-white/70 hover:text-white"
            }`}
          >
            <Compass className="h-5 w-5" strokeWidth={1.75} />
            <span className="font-mono text-[8px] uppercase tracking-[0.1em]">
              {headingUpActive ? "Rijricht." : "Noord"}
            </span>
          </button>
          <button
            type="button"
            onClick={rideState === "riding" ? pauseRide : startRide}
            className={`flex items-center justify-center gap-2 rounded-2xl px-7 py-2.5 text-[14px] font-semibold shadow-lg transition ${
              rideState === "riding"
                ? "border border-white/10 bg-map-panel/92 text-white/85 backdrop-blur-md hover:text-white"
                : "bg-cyan-400 text-map-ink"
            }`}
          >
            {rideState === "riding" ? (
              <>
                <Pause className="h-4 w-4" strokeWidth={2} />
                Pauzeer
              </>
            ) : (
              <>
                <Play className="h-4 w-4" strokeWidth={2} />
                {rideState === "idle" ? "Start rit" : "Hervat"}
              </>
            )}
          </button>
          {rideState !== "idle" && (
            <button
              type="button"
              onClick={() => {
                persistRide()
                setConfirmClose(true)
              }}
              aria-label="Stop en rond de rit af"
              className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-red-400/40 bg-red-500/15 px-3.5 text-red-200 shadow-lg backdrop-blur-md transition hover:bg-red-500/25"
            >
              <Square className="h-5 w-5" strokeWidth={2} />
              <span className="font-mono text-[8px] uppercase tracking-[0.1em]">
                Stop
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            aria-label="Foto maken en delen"
            className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/10 bg-map-panel/92 px-3.5 text-white/70 shadow-lg backdrop-blur-md transition hover:text-white"
          >
            <Camera className="h-5 w-5" strokeWidth={1.75} />
            <span className="font-mono text-[8px] uppercase tracking-[0.1em]">
              Foto
            </span>
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ""
              if (f) void handlePhotoTaken(f)
            }}
          />
        </div>

        {!metricsOnTop && metricsBar}

        {showSteps && nav.length > 0 && (
          <div className="pointer-events-auto max-h-[38vh] overflow-y-auto rounded-2xl border border-white/10 bg-map-panel/95 p-2 backdrop-blur-md">
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

      </div>

      {/* Val-alarm — "Alles oké?" na een abrupte stop. Eerlijk over wat er
          gebeurt: melding + locatie naar gekoppelde coach/ouders; 112 bellen
          doet de renner zelf via de grote belknop. */}
      {crashAlert && (
        <div className="absolute inset-0 z-[96] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-red-400/30 bg-map-panel/97 p-5 backdrop-blur-md">
            {crashAlert.phase === "asking" && (
              <>
                <p className="text-[20px] font-semibold text-white">
                  Alles oké?
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-white/60">
                  Je stopte plotseling. Geen reactie binnen{" "}
                  <span className="font-mono font-semibold text-white/90">
                    {crashAlert.secondsLeft}
                  </span>{" "}
                  seconden → je gekoppelde coach en ouders krijgen een melding
                  met je locatie.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={dismissCrashAlert}
                    className="rounded-full bg-cyan-400 px-4 py-3 text-[14px] font-semibold text-map-ink"
                  >
                    Ik ben oké
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendCrashAlert()}
                    className="rounded-full border border-white/15 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 transition hover:text-white"
                  >
                    Waarschuw nu
                  </button>
                  <a
                    href="tel:112"
                    className="flex items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-3 text-[15px] font-semibold text-white"
                  >
                    <Phone className="h-4 w-4" strokeWidth={2} />
                    Bel 112
                  </a>
                </div>
              </>
            )}
            {crashAlert.phase === "sending" && (
              <p className="text-[15px] text-white/85">
                Bezig met waarschuwen…
              </p>
            )}
            {crashAlert.phase === "sent" && (
              <>
                <p className="text-[17px] font-semibold text-white">
                  {crashAlert.notified > 0
                    ? `Melding klaargezet voor ${crashAlert.notified} ${crashAlert.notified === 1 ? "persoon" : "personen"}`
                    : "Niemand gekoppeld"}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-white/60">
                  {crashAlert.notified > 0
                    ? "Je gekoppelde coach/ouders krijgen een melding met je locatie. Of ze die nu al zien, hangt van hun telefoon af — bel bij nood altijd zelf 112."
                    : "Er is geen coach of ouder aan je account gekoppeld, dus er is niemand bereikt. Bel bij nood zelf 112."}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <a
                    href="tel:112"
                    className="flex items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-3 text-[15px] font-semibold text-white"
                  >
                    <Phone className="h-4 w-4" strokeWidth={2} />
                    Bel 112
                  </a>
                  <button
                    type="button"
                    onClick={dismissCrashAlert}
                    className="rounded-full border border-white/15 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 transition hover:text-white"
                  >
                    Sluiten
                  </button>
                </div>
              </>
            )}
            {crashAlert.phase === "error" && (
              <>
                <p className="text-[17px] font-semibold text-white">
                  Waarschuwen is niet gelukt
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-white/60">
                  De melding kon niet verstuurd worden. Bel bij nood zelf 112.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <a
                    href="tel:112"
                    className="flex items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-3 text-[15px] font-semibold text-white"
                  >
                    <Phone className="h-4 w-4" strokeWidth={2} />
                    Bel 112
                  </a>
                  <button
                    type="button"
                    onClick={() => void sendCrashAlert()}
                    className="rounded-full border border-white/15 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 transition hover:text-white"
                  >
                    Probeer opnieuw
                  </button>
                  <button
                    type="button"
                    onClick={dismissCrashAlert}
                    className="rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45 transition hover:text-white/80"
                  >
                    Sluiten
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Close confirmation — closing by accident would drop you straight
          back into Sparki, so the choice is always confirmed first. */}
      {confirmClose && (() => {
        const summary = summarizeRide(
          riddenRef.current,
          rideSeconds,
          sensorsRef.current,
        )
        return (
        <div className="absolute inset-0 z-[95] flex items-end justify-center bg-black/60 p-4 pb-10 backdrop-blur-sm sm:items-center">
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-white/10 bg-map-panel/95 p-4 backdrop-blur-md">
            {uploadState === "done" ? (
              <>
                <p className="flex items-center gap-1.5 text-[15px] font-medium text-white/90">
                  <IconCheck className="h-4 w-4 shrink-0" aria-hidden />
                  Rit opgeslagen in Sparki
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-white/50">
                  {uploadedSessionId
                    ? "Je rit staat tussen je activiteiten en telt mee in je belasting."
                    : "Het bestand is binnen, maar er kon nog geen activiteit van gemaakt worden — kijk later bij je activiteiten."}
                </p>
                {uploadedSessionId && stravaAvailable && stravaState !== "done" && (
                  <button
                    type="button"
                    disabled={stravaState === "busy"}
                    onClick={() => void sendRideToStrava()}
                    className="mt-3 w-full rounded-full bg-cyan-400/15 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-200 transition hover:bg-cyan-400/25 disabled:opacity-50"
                  >
                    {stravaState === "busy"
                      ? "Bezig met doorzetten…"
                      : "Zet door naar Strava"}
                  </button>
                )}
                {stravaState === "done" && (
                  <p className="mt-3 flex items-center gap-1.5 text-[12px] text-cyan-200">
                    <IconCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Doorgezet naar Strava
                  </p>
                )}
                {stravaState === "error" && stravaError && (
                  <p className="mt-3 text-[12px] text-[rgba(255,140,120,0.85)]">
                    {stravaError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-3 w-full rounded-full bg-cyan-400 px-4 py-2.5 text-[13px] font-semibold text-map-ink"
                >
                  Terug naar Sparki
                </button>
              </>
            ) : (
              <>
                <p className="text-[15px] font-medium text-white/90">
                  Rit afronden
                </p>
                {/* Ritoverzicht — alleen wat er echt gemeten is. */}
                <div className="mt-3 grid grid-cols-3 gap-y-3">
                  <div>
                    <p className="text-[18px] font-semibold tabular-nums text-white/95">
                      {summary.distanceKm.toFixed(1)}
                    </p>
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/40">km</p>
                  </div>
                  <div>
                    <p className="text-[18px] font-semibold tabular-nums text-white/95">
                      {fmtRideTime(summary.movingSec)}
                    </p>
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/40">rijtijd</p>
                  </div>
                  <div>
                    <p className="text-[18px] font-semibold tabular-nums text-white/95">
                      {summary.avgKmh != null
                        ? summary.avgKmh.toFixed(1).replace(".", ",")
                        : "—"}
                    </p>
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/40">gem. km/u</p>
                  </div>
                  {summary.maxKmh != null && (
                    <div>
                      <p className="text-[18px] font-semibold tabular-nums text-white/95">
                        {summary.maxKmh.toFixed(1).replace(".", ",")}
                      </p>
                      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/40">max km/u</p>
                    </div>
                  )}
                  {summary.elevationM != null && (
                    <div>
                      <p className="text-[18px] font-semibold tabular-nums text-white/95">
                        {Math.round(summary.elevationM!)}
                      </p>
                      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/40">hoogtemeters</p>
                    </div>
                  )}
                  {summary.avgCadence != null && (
                    <div>
                      <p className="text-[18px] font-semibold tabular-nums text-white/95">
                        {Math.round(summary.avgCadence!)}
                      </p>
                      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/40">gem. cadans</p>
                    </div>
                  )}
                  {summary.avgWatts != null && (
                    <div>
                      <p className="text-[18px] font-semibold tabular-nums text-white/95">
                        {Math.round(summary.avgWatts!)}
                      </p>
                      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/40">gem. watt</p>
                    </div>
                  )}
                </div>
                {uploadState === "error" && uploadError && (
                  <p className="mt-3 text-[12px] text-[rgba(255,140,120,0.85)]">
                    {uploadError}
                  </p>
                )}
                <div className="mt-4 flex flex-col gap-2">
                  {canSaveRide && (
                    <button
                      type="button"
                      disabled={uploadState === "uploading"}
                      onClick={() => void saveRideToSparki()}
                      className="rounded-full bg-cyan-400 px-4 py-2.5 text-[13px] font-semibold text-map-ink transition disabled:opacity-50"
                    >
                      {uploadState === "uploading"
                        ? "Bezig met opslaan…"
                        : "Opslaan in Sparki"}
                    </button>
                  )}
                  {canSaveRide && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={saveRideState === "saving"}
                        onClick={() => void saveRiddenRoute()}
                        className="flex flex-1 items-center justify-center rounded-full border border-white/15 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/70 transition hover:text-white disabled:opacity-50"
                      >
                        {saveRideState === "saving" ? "Bezig…" : "Bewaar als route"}
                      </button>
                      {canWebShare && (
                        <button
                          type="button"
                          onClick={() => void shareRide()}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/15 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/70 transition hover:text-white"
                        >
                          <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Deel
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={downloadRideGpx}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/15 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/70 transition hover:text-white"
                      >
                        <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                        GPX
                      </button>
                    </div>
                  )}
                  {saveRideState === "error" && (
                    <p className="text-[12px] text-[rgba(255,140,120,0.85)]">
                      Bewaren als route is niet gelukt. Probeer het opnieuw.
                    </p>
                  )}
                  {!canSaveRide && (
                    <p className="text-[12px] leading-relaxed text-white/50">
                      Deze rit is te kort om op te slaan (minder dan 200 meter
                      gemeten).
                    </p>
                  )}
                  {/* Weggooien vraagt twee keer — een rit is niet terug te halen. */}
                  <button
                    type="button"
                    onClick={() => {
                      if (discardArmed) discardRide()
                      else setDiscardArmed(true)
                    }}
                    className={`rounded-full border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition ${
                      discardArmed
                        ? "border-red-400/50 bg-red-500/20 text-red-200"
                        : "border-white/15 text-white/70 hover:text-white"
                    }`}
                  >
                    {discardArmed
                      ? "Zeker weten? Tik nogmaals om weg te gooien"
                      : "Weggooien"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmClose(false)
                      setSaveRideState("idle")
                      setDiscardArmed(false)
                      setUploadState("idle")
                      setUploadError(null)
                    }}
                    className="rounded-full px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45 transition hover:text-white/80"
                  >
                    Blijf navigeren
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        )
      })()}

      {/* Zuinig scherm — bijna-zwart (echte winst op OLED): alleen het
          hoognodige. Navigatie, valalarm en het opnemen van de rit lopen
          gewoon door. */}
      {dimmed && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-8 bg-black px-6">
          {nextStep && distanceToTurn != null ? (
            <div className="text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/35">
                Volgende
              </p>
              <p className="mt-1 text-[26px] font-semibold leading-tight text-white/85">
                {fmtMeters(distanceToTurn)}
              </p>
              <p className="mt-1 max-w-[280px] text-[14px] leading-snug text-white/55">
                {nextStep.note || nextStep.dir}
              </p>
            </div>
          ) : (
            <p className="text-[14px] text-white/45">Volg de route.</p>
          )}
          {climbLive && (climbLive.phase === "op" || climbLive.phase === "top") && (
            <p className="font-mono text-[13px] tabular-nums" style={{ color: ACCENT }}>
              Klim · nog {fmtMeters(climbLive.toTopM)}
              {climbLive.gradeNowPct != null
                ? ` · ${climbLive.gradeNowPct.toFixed(1)}%`
                : ""}
            </p>
          )}
          <div className="flex items-end gap-8">
            <div className="text-center">
              <p className="text-[30px] font-semibold leading-none text-white/85">
                {speedKmh != null ? speedKmh : "—"}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                km/u
              </p>
            </div>
            <div className="text-center">
              <p className="text-[30px] font-semibold leading-none text-white/85">
                {progress ? progress.remainingKm.toFixed(1) : "—"}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                km te gaan
              </p>
            </div>
            <div className="text-center">
              <p className="text-[30px] font-semibold leading-none text-white/85">
                {rideState === "idle" ? "—" : fmtRideTime(rideSeconds)}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                rijtijd
              </p>
            </div>
          </div>
          {battery && (
            <p className="text-[12px] text-white/40">
              Batterij {Math.round(battery.level * 100)}%
              {battery.charging ? " · aan de lader" : ""}
            </p>
          )}
          <button
            type="button"
            onClick={() => setDimmed(false)}
            className="rounded-full border border-white/15 px-4 py-2 text-[12px] text-white/60 transition hover:text-white/90"
          >
            Kaart tonen
          </button>
        </div>
      )}
    </div>
  )

  return createPortal(overlay, document.body)
}

function Metric({
  label,
  value,
  unit,
  size = "normaal",
}: {
  label: string
  value: string
  unit?: string
  size?: "klein" | "normaal" | "groot"
}) {
  // Leesbaar op de fiets: waarden minimaal 18px, labels 12px.
  const valueSize =
    size === "klein" ? "text-[18px]" : size === "groot" ? "text-[26px]" : "text-[20px]"
  return (
    <div className="flex flex-col items-center">
      <span className={`font-mono ${valueSize} font-semibold tabular-nums leading-tight text-white/95`}>
        {value}
        {unit && (
          <span className="ml-0.5 text-[11px] font-normal text-white/45">
            {unit}
          </span>
        )}
      </span>
      <span className="mt-0.5 font-mono text-[12px] uppercase tracking-[0.08em] text-white/40">
        {label}
      </span>
    </div>
  )
}

// ── Rit-optiesmenu ─────────────────────────────────────────────────
// Verschijnt na een tik op "Navigeer", vóór de navigatie opent: de renner
// kiest wat hij onderweg wil zien en doen. De laatste keuze staat alvast
// voorgeselecteerd. Bij een gekoppelde intervaltraining verdwijnen de
// afleidende keuzes (plekken, samen/bordjes) — die staan dan bewust uit.
export function RideOptionsMenu({
  workout = null,
  onStart,
  onClose,
  sport = null,
}: {
  workout?: PlannedWorkout | null
  onStart: (opts: RideOptions) => void
  onClose: () => void
  // Sport van de route: te voet spreekt het menu de gebruiker niet als fietser aan.
  sport?: string | null
}) {
  const [opts, setOpts] = useState<RideOptions>(loadLastRideOptions)
  const { data: friendsData } = useFriends()
  const friends = friendsData?.friends ?? []
  const focus = isFocusWorkout(workout)

  const start = () => {
    // Bewaar de eigen voorkeuren (niet de interval-geforceerde variant), zodat
    // een volgende vrije rit gewoon de laatste eigen keuze voorselecteert.
    saveRideOptions(opts)
    onStart(applyFocusRules(opts, workout))
  }

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1.5 font-sans text-[12px] transition ${
      active
        ? "bg-cyan-400 text-map-ink"
        : "border border-white/10 text-white/55 hover:text-white/85"
    }`

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Sluiten"
        onClick={onClose}
        className="absolute inset-0 bg-map-scrim/70 backdrop-blur-sm"
      />
      <div className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/[0.1] bg-map-panel/[0.97] p-5 backdrop-blur-md sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-sans text-lg font-light tracking-tight text-white/90">
              Rit-opties
            </h3>
            <p className="mt-0.5 text-[12px] text-white/45">
              Kies wat je onderweg wilt zien en doen — je laatste keuze staat
              alvast klaar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="rounded-full border border-white/10 p-1.5 text-white/55 transition hover:text-white/85"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {focus && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3.5 py-3">
            <Zap
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
              strokeWidth={1.75}
            />
            <p className="text-[12px] leading-relaxed text-white/60">
              <span className="font-medium text-white/85">
                Intervaltraining gekoppeld.
              </span>{" "}
              Plekken langs de route en samen rijden staan deze rit uit,
              zodat jij je volledig op je blokken kunt richten.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-4">
          {!focus && (
            <div>
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                Plekken langs de route
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOpts((o) => ({ ...o, pois: true }))}
                  className={pill(opts.pois)}
                >
                  Tonen
                </button>
                <button
                  type="button"
                  onClick={() => setOpts((o) => ({ ...o, pois: false }))}
                  className={pill(!opts.pois)}
                >
                  Verbergen
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-white/45">
                Café’s en bezienswaardigheden als icoontjes op de kaart, met
                onderweg een voorstel voor een koffiepauze.
              </p>
            </div>
          )}

          {!focus && (
            <div>
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                Samen rijden?
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setOpts((o) => ({ ...o, samen: false, maten: [] }))
                  }
                  className={`flex items-center gap-1.5 ${pill(!opts.samen)}`}
                >
                  <User className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Alleen
                </button>
                <button
                  type="button"
                  onClick={() => setOpts((o) => ({ ...o, samen: true }))}
                  className={`flex items-center gap-1.5 ${pill(opts.samen)}`}
                >
                  <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Met anderen
                </button>
              </div>
              {opts.samen && (
                <>
                  <p className="mt-1.5 text-[11px] leading-snug text-white/45">
                    {sport === "walking" || sport === "hiking"
                      ? "Je bent met anderen op pad — kies hieronder wie er meegaat."
                      : "Je rijdt met anderen — kies hieronder wie er meefietst."}
                  </p>
                  {friends.length > 0 ? (
                    <>
                      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                        {sport === "walking" || sport === "hiking"
                          ? "Wie gaat er mee?"
                          : "Wie fietst er mee?"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {friends.map((f) => {
                          const active = opts.maten.includes(f.clerkId)
                          return (
                            <button
                              key={f.clerkId}
                              type="button"
                              onClick={() =>
                                setOpts((o) => ({
                                  ...o,
                                  maten: active
                                    ? o.maten.filter(
                                        (id) => id !== f.clerkId,
                                      )
                                    : [...o.maten, f.clerkId],
                                }))
                              }
                              className={`rounded-full px-3 py-1.5 font-sans text-[12px] transition ${
                                active
                                  ? "border border-cyan-300/50 bg-cyan-300/15 text-cyan-200"
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
                      Nog geen vrienden gekoppeld — voeg ze toe via Samen, dan
                      kun je ze hier kiezen.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
              Kaartweergave
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setOpts((o) => ({ ...o, basemap: id }))}
                  className={pill(opts.basemap === id)}
                >
                  {BASEMAPS[id].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
              Kaartrichting
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOpts((o) => ({ ...o, headingUp: false }))}
                className={pill(!opts.headingUp)}
              >
                Noord boven
              </button>
              <button
                type="button"
                onClick={() => setOpts((o) => ({ ...o, headingUp: true }))}
                className={`flex items-center gap-1.5 ${pill(opts.headingUp)}`}
              >
                <Compass className="h-3.5 w-3.5" strokeWidth={1.75} />
                Rijrichting boven
              </button>
            </div>
          </div>

          {/* Bergklassement-placeholder verwijderd (taak #419): een
              productscherm toont geen aankondigingen van functionaliteit die
              nog niet bestaat — zeker niet op vlakke routes zonder klims. */}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-white/15 px-3 py-2.5 text-[13px] font-medium text-white/70 transition hover:bg-white/5"
          >
            Annuleer
          </button>
          <button
            type="button"
            onClick={start}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-[13px] font-semibold transition"
            style={{ background: ACCENT, color: "var(--color-app-deep)" }}
          >
            <Navigation className="h-4 w-4" strokeWidth={2} />
            Start navigatie
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Speak a short Dutch cue via the browser's speech engine. Best-effort: silently
// does nothing where speech synthesis is unavailable (e.g. some browsers).
function speakCue(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    const u = new SpeechSynthesisUtterance(text)
    u.lang = "nl-NL"
    u.rate = 1.05
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch {
    // Voice is a nicety — never let it break navigation.
  }
}
