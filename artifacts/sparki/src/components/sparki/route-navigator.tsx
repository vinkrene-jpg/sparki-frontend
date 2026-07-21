import { useEffect, useMemo, useRef, useState } from "react"
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
  Users,
  User,
  Check,
  Bluetooth,
  Play,
  Pause,
  type LucideIcon,
} from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import type { RouteNavCue } from "@/hooks/use-routes"
import {
  useSprintBoards,
  useSubmitSprint,
  type SprintBoard,
} from "@/hooks/use-sprints"
import { usePowerMeter } from "@/hooks/use-power-meter"
import { apiFetch } from "@/lib/api"
import type { PlannedWorkout } from "@/lib/athlete-types"
import { WorkoutHud } from "@/components/sparki/workout-hud"

const OFF_ROUTE_METERS = 60

type BasemapId = "donker" | "standaard" | "fiets" | "satelliet"

const BASEMAPS: Record<
  BasemapId,
  { label: string; url: string; attribution: string; maxZoom: number }
> = {
  donker: {
    label: "Donker",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
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
}: {
  name: string
  geometry: [number, number][]
  nav: RouteNavCue[]
  distanceKm: number | null
  onClose: () => void
  // When this is a saved route, sprint boards ("bordjes") are detected for it.
  routeId?: number | null
  // Geplande training met blokken voor deze rit — live getoond als tijdblokken
  // versus zone/wattage, zodat de renner ziet wanneer een interval begint en
  // wat hij moet leveren.
  workout?: PlannedWorkout | null
  ftp?: number | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const meMarkerRef = useRef<L.Marker | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const followRef = useRef(true)
  const prevPosRef = useRef<LatLon | null>(null)

  const [location, setLocation] = useState<
    (LatLon & { speedMps: number | null; heading: number | null }) | null
  >(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [following, setFollowing] = useState(true)
  const [showSteps, setShowSteps] = useState(false)
  const [basemap, setBasemap] = useState<BasemapId>("standaard")
  // Per-ride setup (map style, group riding, sensor pairing) is a one-time
  // choice at the start of a ride, so it lives behind a collapsible panel and
  // isn't permanently on screen.
  const [setupOpen, setSetupOpen] = useState(false)
  // Sprinting for "bordjes" only makes sense in a group ride, so it is opt-in.
  const [withOthers, setWithOthers] = useState(false)
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
  const [rideState, setRideState] = useState<"idle" | "riding" | "paused">(
    "idle",
  )
  const [autoPaused, setAutoPaused] = useState(false)
  const rideStateRef = useRef(rideState)
  rideStateRef.current = rideState
  const autoPausedRef = useRef(autoPaused)
  autoPausedRef.current = autoPaused
  const stillSinceRef = useRef<number | null>(null)
  const [rideSeconds, setRideSeconds] = useState(0)
  // Ridden track (recorded while riding) — offered for saving when closing.
  const riddenRef = useRef<LatLon[]>([])
  const [confirmClose, setConfirmClose] = useState(false)
  const [saveRideState, setSaveRideState] = useState<
    "idle" | "saving" | "error"
  >("idle")

  useEffect(() => {
    if (rideState !== "riding") return
    const id = window.setInterval(() => setRideSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [rideState])

  const startRide = () => {
    setAutoPaused(false)
    stillSinceRef.current = null
    setRideState("riding")
  }
  const pauseRide = () => {
    setAutoPaused(false)
    setRideState("paused")
  }

  // ── Bordjes sprinten ──────────────────────────────────────────────
  const submitSprint = useSubmitSprint()
  const power = usePowerMeter()
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
  const boardsQuery = useSprintBoards(routeId)
  const boards = boardsQuery.data?.boards ?? []
  const boardsAvailable = boardsQuery.data?.available ?? true

  const boardMarkersRef = useRef<L.Marker[]>([])
  // Rolling speed samples (km/h) with timestamps, for gain/peak over a sprint.
  const speedHistRef = useRef<{ t: number; kmh: number }[]>([])
  // Boards already dealt with (passed or cancelled) — keyed by km so a board is
  // never double-counted within one navigation session.
  const doneBoardsRef = useRef<Set<number>>(new Set())
  // Board km we've already spoken a cue for, so we announce each sign once.
  const spokenBoardRef = useRef<number | null>(null)
  // On the first GPS fix we mark boards already behind us as done (not scored),
  // so starting mid-route never retro-awards points.
  const seededBehindRef = useRef(false)

  // Board we're closing in on (within arming range and not yet handled).
  const [armedBoard, setArmedBoard] = useState<SprintBoard | null>(null)
  // Finished sprint result shown briefly with the points earned.
  const [sprintResult, setSprintResult] = useState<{
    board: SprintBoard
    peakKmh: number
    gainKmh: number
    peakWatts: number | null
    basePoints: number
    bonusPoints: number
    totalPoints: number
  } | null>(null)

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
          color: "#fbbf24",
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
    if (pois.length === 0) return
    const group = L.layerGroup()
    for (const poi of pois) {
      const emoji = POI_ICONS[poi.kind] ?? "⭐"
      const icon = L.divIcon({
        className: "",
        html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:rgba(7,13,22,0.9);border:1px solid rgba(255,255,255,0.25);font-size:14px;box-shadow:0 1px 6px rgba(0,0,0,0.5);">${emoji}</span>`,
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
  }, [pois])

  const progress = useMemo(() => {
    if (!location || path.length === 0) return null
    const { index, distanceMeters } = nearestPointIndex(path, location)
    const traveledKm = cumKm[index] ?? 0
    const totalKm = cumKm[cumKm.length - 1] ?? 0
    return {
      traveledKm,
      remainingKm: Math.max(0, totalKm - traveledKm),
      offRoute: distanceMeters > OFF_ROUTE_METERS,
      offBy: distanceMeters,
    }
  }, [location, path, cumKm])

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
            riddenRef.current.push(here)
          }
        }
        setLocation((cur) => ({
          ...here,
          speedMps:
            typeof pos.coords.speed === "number" && !Number.isNaN(pos.coords.speed)
              ? pos.coords.speed
              : null,
          heading: heading ?? cur?.heading ?? null,
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
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    })
    // Only the licence-required © credit — no Leaflet software plug.
    map.attributionControl.setPrefix(false)
    const initial = BASEMAPS.standaard
    tileLayerRef.current = L.tileLayer(initial.url, {
      attribution: initial.attribution,
      maxZoom: initial.maxZoom,
      detectRetina: true,
    }).addTo(map)

    const latlngs = path.map((p) => [p.lat, p.lon] as [number, number])
    const routeBounds =
      latlngs.length >= 2 ? L.latLngBounds(latlngs) : null
    if (latlngs.length >= 2) {
      // Draw a dark casing under a bright line so the route stays clearly
      // visible on any basemap (especially satellite), plus direction arrows so
      // it's obvious which way to follow.
      L.polyline(latlngs, {
        color: "#0a1420",
        weight: 9,
        opacity: 0.9,
        lineJoin: "round",
        lineCap: "round",
      }).addTo(map)
      L.polyline(latlngs, {
        color: "#22d3ee",
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
                <path d="M12 21 V5 M5.5 11.5 L12 4.5 L18.5 11.5" fill="none" stroke="#05121f" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 21 V5 M5.5 11.5 L12 4.5 L18.5 11.5" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
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
        html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:#0b1622;border:2px solid #4ade80;box-shadow:0 0 0 2px rgba(5,7,14,0.9),0 0 10px rgba(74,222,128,0.6);">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#4ade80" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 22V4"/><path d="M4 4c3-1.8 6 1.8 9 0s5-1 7 0v9c-2-1-4-1.8-7 0s-6-1.8-9 0"/>
            </svg>
          </span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      })
      const finishIcon = L.divIcon({
        className: "",
        html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:#0b1622;border:2px solid rgba(255,255,255,0.85);box-shadow:0 0 0 2px rgba(5,7,14,0.9),0 0 10px rgba(255,255,255,0.45);">
            <svg viewBox="0 0 16 16" width="13" height="13">
              <rect x="2" y="1" width="1.6" height="14" rx="0.8" fill="#e5e7eb"/>
              <g>
                <rect x="4" y="1" width="10" height="8" fill="#e5e7eb"/>
                <rect x="4" y="1" width="2.5" height="2.66" fill="#0b1622"/>
                <rect x="9" y="1" width="2.5" height="2.66" fill="#0b1622"/>
                <rect x="6.5" y="3.66" width="2.5" height="2.66" fill="#0b1622"/>
                <rect x="11.5" y="3.66" width="2.5" height="2.66" fill="#0b1622"/>
                <rect x="4" y="6.33" width="2.5" height="2.66" fill="#0b1622"/>
                <rect x="9" y="6.33" width="2.5" height="2.66" fill="#0b1622"/>
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
    const cfg = BASEMAPS[basemap]
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current)
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      detectRetina: true,
    }).addTo(map)
    tileLayerRef.current.bringToBack()
  }, [basemap])

  // Move the "me" arrow on each position update; follow if enabled.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !location) return
    const ll: [number, number] = [location.lat, location.lon]
    const hasHeading = location.heading != null
    const rot = location.heading ?? 0
    // The rider is a cyclist badge (not a bare dot). With a known heading a
    // direction pointer rotates around the badge; the cyclist itself stays
    // upright so it always reads as "jij op de fiets".
    const bikeSvg = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#05070e" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
      </svg>`
    const html = `<span style="position:relative;display:block;width:38px;height:38px;">
        ${
          hasHeading
            ? `<span style="position:absolute;inset:0;transform:rotate(${rot}deg);transform-origin:center;">
                 <svg viewBox="0 0 38 38" width="38" height="38">
                   <path d="M19 0 L24 9 L14 9 Z" fill="#38bdf8" stroke="#05070e" stroke-width="1.2" stroke-linejoin="round"/>
                 </svg>
               </span>`
            : ""
        }
        <span style="position:absolute;left:5px;top:5px;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:#38bdf8;border:2px solid #05070e;box-shadow:0 0 0 3px rgba(56,189,248,0.3),0 0 14px rgba(56,189,248,0.8);">
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
  }, [location, following])

  const speedKmh =
    location?.speedMps != null ? Math.round(location.speedMps * 3.6) : null

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
      // Skip huge gaps (signal loss) and near-stationary samples (stops).
      // Average speed only accumulates while the ride is actually running.
      if (
        dt > 0 &&
        dt < 15 &&
        instKmh >= 3 &&
        rideStateRef.current === "riding"
      ) {
        a.meters += dm
        a.seconds += dt
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
    }
    a.last = { t: now, lat: location.lat, lon: location.lon }
    setAvgKmh(a.seconds > 0 ? Math.round((a.meters / a.seconds) * 3.6) : null)
  }, [location])

  // Draw sprint boards on the map once, whenever the set changes — only in a
  // group ride, where sprinting for bordjes is the point.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const m of boardMarkersRef.current) map.removeLayer(m)
    boardMarkersRef.current = []
    if (!withOthers) return
    for (const b of boards) {
      const icon = L.divIcon({
        className: "",
        html: `<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:#facc15;color:#05070e;font-weight:800;font-size:12px;border:2px solid #05070e;box-shadow:0 0 8px rgba(250,204,21,0.7);">⚡</span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
      const m = L.marker([b.lat, b.lon], { icon })
        .addTo(map)
        .bindTooltip(b.placeName, { direction: "top" })
      boardMarkersRef.current.push(m)
    }
    return () => {
      const mp = mapRef.current
      if (!mp) return
      for (const m of boardMarkersRef.current) mp.removeLayer(m)
      boardMarkersRef.current = []
    }
  }, [boards, withOthers])

  // Reconcile sprint state whenever the ride mode flips. Re-seeding forces the
  // scoring loop to mark every board already behind us as done on its next run,
  // so switching back to a group ride can never retro-award boards that were
  // passed while riding solo.
  useEffect(() => {
    seededBehindRef.current = false
    doneBoardsRef.current = new Set()
    spokenBoardRef.current = null
    setArmedBoard(null)
  }, [withOthers])

  // Track speed, arm the next board, and score a sprint when a board is passed.
  // Only real GPS speed is used; watts are added later when a meter is linked.
  // Sprinting only runs in a group ride.
  useEffect(() => {
    if (!withOthers) {
      setArmedBoard(null)
      return
    }
    if (!location || !progress) return
    const now = Date.now()
    const kmh = location.speedMps != null ? location.speedMps * 3.6 : null
    if (kmh != null) {
      const hist = speedHistRef.current
      hist.push({ t: now, kmh })
      while (hist.length && now - hist[0]!.t > 40000) hist.shift()
    }
    const traveled = progress.traveledKm

    // On the first fix, any board already behind us was NOT sprinted this
    // session — mark it done so we never retro-award points for starting
    // mid-route. Only boards we actually cross afterwards can score.
    if (!seededBehindRef.current) {
      seededBehindRef.current = true
      for (const b of boards) {
        if (traveled >= b.km) doneBoardsRef.current.add(b.km)
      }
      return
    }

    // Score any board we've just passed.
    for (const b of boards) {
      if (doneBoardsRef.current.has(b.km)) continue
      if (traveled >= b.km) {
        doneBoardsRef.current.add(b.km)
        const hist = speedHistRef.current
        const recent = hist.filter((h) => now - h.t <= 12000)
        const before = hist.filter(
          (h) => now - h.t > 12000 && now - h.t <= 30000,
        )
        const peakKmh = recent.length
          ? Math.max(...recent.map((h) => h.kmh))
          : (kmh ?? 0)
        const baseline = before.length
          ? Math.min(...before.map((h) => h.kmh))
          : recent.length
            ? Math.min(...recent.map((h) => h.kmh))
            : 0
        const gainKmh = Math.max(0, peakKmh - baseline)
        // Real 5-second peak watts from a connected power meter, or null when
        // no meter is paired — the server awards the watt bonus honestly.
        const peakWatts5s = power.connected ? power.peakWatts(5) : null
        const basePoints = 10
        const speedBonus = Math.min(30, Math.round(gainKmh * 2))
        setArmedBoard(null)
        submitSprint.mutate(
          {
            routeId,
            rideType: routeId != null ? "planned" : "free",
            placeName: b.placeName,
            km: b.km,
            speedKmhPeak: Math.round(peakKmh),
            speedGainKmh: Math.round(gainKmh),
            peakWatts5s,
            status: "scored",
          },
          {
            onSuccess: (data) => {
              const r = data.result
              setSprintResult({
                board: b,
                peakKmh: Math.round(peakKmh),
                gainKmh: Math.round(gainKmh),
                peakWatts: peakWatts5s != null ? Math.round(peakWatts5s) : null,
                basePoints: r.basePoints,
                bonusPoints: r.bonusPoints,
                totalPoints: r.totalPoints,
              })
            },
          },
        )
        // Optimistic view uses the deterministic speed portion; the server
        // reconciles the true total (incl. watt bonus) via onSuccess above.
        setSprintResult({
          board: b,
          peakKmh: Math.round(peakKmh),
          gainKmh: Math.round(gainKmh),
          peakWatts: peakWatts5s != null ? Math.round(peakWatts5s) : null,
          basePoints,
          bonusPoints: speedBonus,
          totalPoints: basePoints + speedBonus,
        })
      }
    }

    // Arm the nearest upcoming board within 300 m so the rider gets a heads-up.
    const upcoming =
      boards
        .filter((b) => !doneBoardsRef.current.has(b.km) && b.km > traveled)
        .sort((a, b) => a.km - b.km)[0] ?? null
    const nextArmed =
      upcoming && (upcoming.km - traveled) * 1000 <= 300 ? upcoming : null
    setArmedBoard(nextArmed)

    // Say it out loud, once per board — a cheeky heads-up before the sign.
    if (nextArmed && spokenBoardRef.current !== nextArmed.km) {
      spokenBoardRef.current = nextArmed.km
      speakCue(
        `${nextArmed.placeName} komt eraan. Benen leeg, eer op het spel!`,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, progress, boards])

  // The result popup is a brief celebration — auto-dismiss after ~5s.
  useEffect(() => {
    if (!sprintResult) return
    const id = window.setTimeout(() => setSprintResult(null), 5000)
    return () => window.clearTimeout(id)
  }, [sprintResult])

  // Cancel an armed sprint: skip this board, no points, no save.
  const cancelArmed = () => {
    if (armedBoard) doneBoardsRef.current.add(armedBoard.km)
    setArmedBoard(null)
  }

  // Bottom metrics — always the full set incl. vermogen + cadans, so the
  // rider ziet waar ze horen. Zonder gekoppelde meter staat er eerlijk "—"
  // (nooit een verzonnen getal); koppelen kan via "Watt & cadans koppelen".
  const metrics: { label: string; value: string }[] = [
    {
      label: "Resterend",
      value: progress ? `${progress.remainingKm.toFixed(1)} km` : "—",
    },
    {
      label: "Totaal",
      value: distanceKm != null ? `${distanceKm.toFixed(1)} km` : "—",
    },
    { label: "Snelheid", value: speedKmh != null ? `${speedKmh} km/u` : "—" },
    { label: "Gem.", value: avgKmh != null ? `${avgKmh} km/u` : "—" },
    {
      label: "Rijtijd",
      value: rideState === "idle" ? "—" : fmtRideTime(rideSeconds),
    },
    {
      label: "Vermogen",
      value:
        power.connected && power.watts != null ? `${power.watts} W` : "—",
    },
    {
      label: "Cadans",
      value:
        power.connected && power.cadence != null
          ? `${power.cadence} rpm`
          : "—",
    },
  ]

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
      onClose()
    } catch {
      setSaveRideState("error")
    }
  }

  const canSaveRide = riddenRef.current.length >= 2 && riddenKm() >= 0.2

  const overlay = (
    <div className="fixed inset-0 z-[90] isolate bg-[#05070e]">
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Top bar: close + next instruction */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setSaveRideState("idle"); setConfirmClose(true) }}
            aria-label="Navigatie sluiten"
            className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#070d16]/90 p-2 text-white/60 backdrop-blur-md transition hover:text-white"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
          <div className="min-w-0 flex-1 truncate rounded-full border border-white/10 bg-[#070d16]/90 px-3 py-2 text-[13px] text-white/70 backdrop-blur-md">
            {name}
          </div>
          <button
            type="button"
            onClick={() => setSetupOpen((v) => !v)}
            aria-label="Rit-instellingen"
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] backdrop-blur-md transition ${
              setupOpen
                ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-200"
                : "border-white/10 bg-[#070d16]/90 text-white/70 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />
            Instellen
          </button>
        </div>

        {setupOpen && (
          <div className="pointer-events-auto flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#070d16]/95 p-3 backdrop-blur-md">
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
                    onClick={() => setBasemap(id)}
                    className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition ${
                      basemap === id
                        ? "bg-cyan-400 text-[#05070e]"
                        : "border border-white/10 text-white/55 hover:text-white/85"
                    }`}
                  >
                    {BASEMAPS[id].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Group riding — enables the bordjes-sprint game. */}
            <div>
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                Rij je met anderen?
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setWithOthers(false)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] transition ${
                    !withOthers
                      ? "bg-cyan-400 text-[#05070e]"
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
                      ? "bg-cyan-400 text-[#05070e]"
                      : "border border-white/10 text-white/55 hover:text-white/85"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Met anderen
                </button>
              </div>
              {withOthers && (
                <p className="mt-1.5 text-[11px] leading-snug text-white/45">
                  Sprinten om plaatsbordjes staat aan — gas erop bij de
                  komborden.
                </p>
              )}
            </div>

            {/* Sensor pairing — watts + cadans over Bluetooth. */}
            <div>
              <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                Sensoren
              </p>
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
                <button
                  type="button"
                  onClick={connectSensors}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 px-3 py-1.5 text-[11px] text-cyan-200 transition hover:bg-cyan-400/10"
                >
                  <Bluetooth className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Watt &amp; cadans koppelen
                </button>
              )}
              {power.error && (
                <p className="mt-1.5 text-[11px] leading-snug text-[rgba(255,180,120,0.9)]">
                  {power.error}
                </p>
              )}
            </div>
          </div>
        )}

        {routeId != null && withOthers && (
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-yellow-400/25 bg-[#070d16]/92 px-3.5 py-2.5 backdrop-blur-md">
            <Zap
              className="h-5 w-5 shrink-0 text-yellow-300"
              strokeWidth={1.75}
            />
            <p className="text-[12.5px] leading-snug text-white/70">
              {boardsQuery.isLoading
                ? "Bordjes zoeken langs de route…"
                : !boardsAvailable
                  ? "Bordjes kunnen nu niet bepaald worden."
                  : boards.length > 0
                    ? `${boards.length} ${boards.length === 1 ? "bordje" : "bordjes"} om te sprinten. Gas erop bij de komborden!`
                    : "Geen plaatsbordjes op deze route — sprinten kan altijd, maar levert hier geen punten op."}
            </p>
            <a
              href={`${import.meta.env.BASE_URL}sprinten`}
              className="pointer-events-auto shrink-0 rounded-full border border-yellow-400/30 px-2.5 py-1 text-[11px] text-yellow-200/90 transition hover:bg-yellow-400/10"
            >
              Seizoen
            </a>
          </div>
        )}

        {coffeePrompt && !detour && (
          <div className="pointer-events-auto flex flex-col gap-2.5 rounded-xl border border-amber-400/40 bg-[#070d16]/92 px-3.5 py-3 backdrop-blur-md">
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
                Nee, doorfietsen
              </button>
              <button
                type="button"
                onClick={acceptCoffee}
                disabled={detourLoading != null || !location}
                className="flex-1 rounded-full bg-amber-400 px-3 py-2 text-[12px] font-semibold text-[#05070e] transition disabled:opacity-50"
              >
                {detourLoading === "poi" ? "Bezig…" : "Ja, breng me erheen"}
              </button>
            </div>
          </div>
        )}

        {selectedPoi && !detour && (
          <div className="pointer-events-auto flex flex-col gap-2.5 rounded-xl border border-white/15 bg-[#070d16]/92 px-3.5 py-3 backdrop-blur-md">
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
              className="flex items-center justify-center gap-1.5 rounded-full bg-cyan-400 px-3 py-2 text-[12px] font-semibold text-[#05070e] transition disabled:opacity-50"
            >
              <Navigation className="h-3.5 w-3.5" strokeWidth={2} />
              {detourLoading === "poi" ? "Bezig…" : "Route hierlangs"}
            </button>
          </div>
        )}

        {detour ? (
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-amber-400/40 bg-[#070d16]/92 px-3.5 py-3 backdrop-blur-md">
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
            <div className="pointer-events-auto flex flex-col gap-2.5 rounded-xl border border-[rgba(255,120,100,0.5)] bg-[#070d16]/92 px-3.5 py-3 backdrop-blur-md">
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
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-cyan-400 px-3 py-2 text-[12px] font-semibold text-[#05070e] transition disabled:opacity-50"
                >
                  <Navigation className="h-3.5 w-3.5" strokeWidth={2} />
                  {detourLoading === "verder"
                    ? "Bezig…"
                    : "Verder — pik route later op"}
                </button>
              </div>
            </div>
          ) : nextStep ? (
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/10 bg-[#070d16]/92 px-3.5 py-3 backdrop-blur-md">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(56,189,248,0.15)" }}
              >
                {(() => {
                  const Icon = describeDir(nextStep.dir).icon
                  return (
                    <Icon
                      className="h-6 w-6 text-cyan-300"
                      strokeWidth={2}
                    />
                  )
                })()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[15px] font-medium text-white/90">
                    {describeDir(nextStep.dir).label}
                  </p>
                  {distanceToTurn != null && (
                    <span className="font-mono text-[13px] tabular-nums text-cyan-300">
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
            <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#070d16]/92 px-3.5 py-3 backdrop-blur-md">
              <Navigation className="h-5 w-5 text-cyan-300" strokeWidth={1.75} />
              <p className="text-[13px] text-white/60">
                {location ? "Volg de route." : "Wachten op je locatie…"}
              </p>
            </div>
          )
        ) : (
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#070d16]/92 px-3.5 py-3 backdrop-blur-md">
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
            elapsedSec={rideSeconds}
            liveWatts={power.connected ? power.watts : null}
            riding={rideState === "riding"}
          />
        )}

        {geoError && (
          <div className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-white/10 bg-[#070d16]/92 px-3.5 py-3 backdrop-blur-md">
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

        {armedBoard && !sprintResult && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-yellow-400/40 bg-[#1a1405]/92 px-3.5 py-3 backdrop-blur-md">
            <Zap
              className="h-6 w-6 shrink-0 animate-pulse text-yellow-300"
              strokeWidth={2}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-yellow-200">
                Bordje {armedBoard.placeName} in zicht!
              </p>
              <p className="text-[12px] text-white/55">
                Zet 'm op scherp — vol gas tot het kombord.
              </p>
            </div>
            <button
              type="button"
              onClick={cancelArmed}
              className="flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/55 transition hover:text-white/85"
            >
              <Ban className="h-3.5 w-3.5" strokeWidth={1.75} />
              Sla over
            </button>
          </div>
        )}
      </div>

      {/* Sprint result — a brief celebration over the map, auto-dismisses. */}
      {sprintResult && (
        <div className="pointer-events-none absolute inset-0 z-[95] flex items-center justify-center p-4">
          <div className="pointer-events-auto w-full max-w-xs rounded-3xl border border-yellow-400/40 bg-[#0b0f08]/95 p-5 text-center shadow-2xl backdrop-blur-md">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400/15">
              <Trophy className="h-7 w-7 text-yellow-300" strokeWidth={1.75} />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-yellow-300/70">
              Bordje gepakt
            </p>
            <p className="mt-1 text-[18px] font-semibold text-white">
              {sprintResult.board.placeName}
            </p>
            <div className="mt-4 flex items-end justify-center gap-1">
              <span className="font-mono text-[44px] font-bold leading-none tabular-nums text-yellow-300">
                +{sprintResult.totalPoints}
              </span>
              <span className="mb-1.5 text-[13px] text-white/50">punten</span>
            </div>
            <div className="mt-3 flex items-center justify-center gap-4 text-[12px] text-white/55">
              <span>{sprintResult.basePoints} basis</span>
              <span className="text-yellow-300/80">
                +{sprintResult.bonusPoints} bonus
              </span>
            </div>
            <p className="mt-2 text-[12px] text-white/45">
              Piek {sprintResult.peakKmh} km/u · +{sprintResult.gainKmh} km/u
              versnelling
              {sprintResult.peakWatts != null &&
                ` · ${sprintResult.peakWatts} W piek`}
            </p>
            <button
              type="button"
              onClick={() => setSprintResult(null)}
              className="mt-4 w-full rounded-full bg-yellow-400 px-4 py-2 text-[13px] font-semibold text-[#05070e]"
            >
              Vet, door!
            </button>
          </div>
        </div>
      )}

      {/* Bottom: recenter + progress + steps toggle */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-stretch gap-2 p-3">
        {!following && location && (
          <button
            type="button"
            onClick={() => setFollowing(true)}
            className="pointer-events-auto mx-auto flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-[13px] font-semibold text-[#05070e] shadow-lg"
          >
            <LocateFixed className="h-4 w-4" strokeWidth={2} />
            Centreer
          </button>
        )}

        {rideState === "paused" && (
          <div className="pointer-events-auto mx-auto rounded-full border border-amber-400/30 bg-[#160f05]/92 px-4 py-1.5 text-[12px] font-medium text-amber-200 backdrop-blur-md">
            {autoPaused
              ? "Automatisch gepauzeerd — rijd verder om te hervatten"
              : "Gepauzeerd — hervat vanzelf zodra je weer rijdt"}
          </div>
        )}

        <div className="pointer-events-auto flex items-stretch gap-2">
          <button
            type="button"
            onClick={rideState === "riding" ? pauseRide : startRide}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-semibold shadow-lg transition ${
              rideState === "riding"
                ? "border border-white/10 bg-[#070d16]/92 text-white/85 backdrop-blur-md hover:text-white"
                : "bg-cyan-400 text-[#05070e]"
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
        </div>

        <div className="pointer-events-auto grid grid-cols-4 gap-x-2 gap-y-3 rounded-2xl border border-white/10 bg-[#070d16]/92 px-4 py-3 backdrop-blur-md">
          {metrics.map((m) => (
            <Metric key={m.label} label={m.label} value={m.value} />
          ))}
        </div>

        {nav.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSteps((v) => !v)}
            className="pointer-events-auto rounded-full border border-white/10 bg-[#070d16]/90 px-3 py-2 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-white/55 backdrop-blur-md transition hover:text-white/80"
          >
            {showSteps ? "Verberg stappenplan" : "Toon stappenplan"}
          </button>
        )}

        {showSteps && nav.length > 0 && (
          <div className="pointer-events-auto max-h-[38vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#070d16]/95 p-2 backdrop-blur-md">
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

        <p className="pointer-events-none px-2 text-center text-[10px] leading-relaxed text-white/25">
          Live navigatie in de browser volgt je positie. Een rit opnemen in je
          trainingen doe je in de Sparki-app op je telefoon.
        </p>
      </div>

      {/* Close confirmation — closing by accident would drop you straight
          back into Sparki, so the choice is always confirmed first. */}
      {confirmClose && (
        <div className="absolute inset-0 z-[95] flex items-end justify-center bg-black/60 p-4 pb-10 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#070d16]/95 p-4 backdrop-blur-md">
            <p className="text-[15px] font-medium text-white/90">
              Navigatie sluiten?
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/50">
              {canSaveRide
                ? `Je hebt tot nu toe ${riddenKm().toFixed(1)} km gereden. Je kunt dit gereden stuk eerst als route bewaren.`
                : "Je gaat terug naar Sparki."}
            </p>
            {saveRideState === "error" && (
              <p className="mt-2 text-[12px] text-[rgba(255,140,120,0.85)]">
                Bewaren is niet gelukt. Probeer het opnieuw of sluit zonder
                bewaren.
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {canSaveRide && (
                <button
                  type="button"
                  disabled={saveRideState === "saving"}
                  onClick={() => void saveRiddenRoute()}
                  className="rounded-full bg-cyan-400/15 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-200 transition hover:bg-cyan-400/25 disabled:opacity-50"
                >
                  {saveRideState === "saving"
                    ? "Bezig met bewaren…"
                    : "Bewaar gereden stuk en sluit"}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/15 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 transition hover:text-white"
              >
                {canSaveRide ? "Sluit zonder bewaren" : "Ja, sluit navigatie"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmClose(false)
                  setSaveRideState("idle")
                }}
                className="rounded-full px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45 transition hover:text-white/80"
              >
                Blijf navigeren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(overlay, document.body)
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-[15px] tabular-nums text-white/90">
        {value}
      </span>
      <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
        {label}
      </span>
    </div>
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
