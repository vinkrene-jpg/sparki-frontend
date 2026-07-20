import { useCallback, useEffect, useRef, useState } from "react"
import { MapPin, Play, Square, Zap, Bluetooth } from "lucide-react"
import { useLookupPlace, useSubmitSprint } from "@/hooks/use-sprints"
import { usePowerMeter } from "@/hooks/use-power-meter"

// Free-ride ("vrije rit") sprinting: no planned route. We watch real GPS, ask
// the server to reverse-geocode the current spot, and whenever the place name
// changes we've crossed a town sign — that's a scored bordje. Honesty holds:
// when a spot can't be named we simply don't invent a bordje.

const LOOKUP_INTERVAL_MS = 10000 // don't hammer the geocoder
const SPRINT_WINDOW_MS = 40000

type Popup = {
  placeName: string
  totalPoints: number
  basePoints: number
  bonusPoints: number
  speedKmhPeak: number | null
  peakWatts5s: number | null
}

function normalize(name: string): string {
  return name.split(",")[0]!.trim()
}

export function FreeRideSprint() {
  const [active, setActive] = useState(false)
  const [currentPlace, setCurrentPlace] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [popup, setPopup] = useState<Popup | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [liveWatts, setLiveWatts] = useState<number | null>(null)

  const lookup = useLookupPlace()
  const submit = useSubmitSprint()
  const power = usePowerMeter()

  const watchRef = useRef<number | null>(null)
  const lastLookupRef = useRef(0)
  const placeRef = useRef<string | null>(null)
  const speedHistRef = useRef<{ t: number; kmh: number }[]>([])
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = useCallback(() => {
    if (watchRef.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchRef.current)
    }
    watchRef.current = null
    setActive(false)
  }, [])

  useEffect(() => () => stop(), [stop])

  // Mirror the meter's latest reading for the live badge.
  useEffect(() => {
    setLiveWatts(power.watts)
  }, [power.watts])

  const scoreBoard = useCallback(
    (placeName: string) => {
      const now = Date.now()
      const hist = speedHistRef.current.filter(
        (s) => now - s.t <= SPRINT_WINDOW_MS,
      )
      let peak = 0
      let baseline: number | null = null
      if (hist.length) {
        baseline = hist[0]!.kmh
        for (const s of hist) if (s.kmh > peak) peak = s.kmh
      }
      const speedKmhPeak = hist.length ? peak : null
      const speedGainKmh =
        baseline !== null ? Math.max(0, peak - baseline) : null
      const peakWatts5s = power.connected ? power.peakWatts(5) : null

      submit.mutate(
        {
          rideType: "free",
          placeName,
          speedKmhPeak,
          speedGainKmh,
          peakWatts5s,
        },
        {
          onSuccess: (data) => {
            const r = data.result
            setCount((c) => c + 1)
            setPopup({
              placeName,
              totalPoints: r.totalPoints,
              basePoints: r.basePoints,
              bonusPoints: r.bonusPoints,
              speedKmhPeak,
              peakWatts5s,
            })
            if (popupTimerRef.current) clearTimeout(popupTimerRef.current)
            popupTimerRef.current = setTimeout(() => setPopup(null), 5000)
          },
        },
      )
    },
    [power, submit],
  )

  const onPosition = useCallback(
    (pos: GeolocationPosition) => {
      const { latitude, longitude, speed } = pos.coords
      const now = Date.now()
      if (typeof speed === "number" && speed >= 0) {
        speedHistRef.current.push({ t: now, kmh: speed * 3.6 })
        while (
          speedHistRef.current.length &&
          now - speedHistRef.current[0]!.t > SPRINT_WINDOW_MS
        ) {
          speedHistRef.current.shift()
        }
      }

      if (now - lastLookupRef.current < LOOKUP_INTERVAL_MS) return
      lastLookupRef.current = now
      lookup.mutate(
        { lat: latitude, lon: longitude },
        {
          onSuccess: ({ placeName }) => {
            if (!placeName) return // honest: don't invent a bordje
            const name = normalize(placeName)
            setCurrentPlace(name)
            const prev = placeRef.current
            if (prev === null) {
              // First fix just anchors where we are — not a sprint.
              placeRef.current = name
              return
            }
            if (name !== prev) {
              placeRef.current = name
              scoreBoard(name)
            }
          },
        },
      )
    },
    [lookup, scoreBoard],
  )

  const start = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoError("Deze telefoon of browser deelt geen locatie.")
      return
    }
    setGeoError(null)
    placeRef.current = null
    lastLookupRef.current = 0
    speedHistRef.current = []
    setCount(0)
    setActive(true)
    watchRef.current = navigator.geolocation.watchPosition(
      onPosition,
      () => setGeoError("Kon je locatie niet volgen. Zet locatie aan."),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    )
  }, [onPosition])

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
      <h2 className="mb-1 font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300/70">
        Vrije sprintrit
      </h2>
      <p className="mb-4 text-sm text-white/60">
        Geen route nodig — Sparki herkent elk plaatsnaambord dat je passeert en
        telt je sprint mee.
      </p>

      {!active ? (
        <button
          onClick={start}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400/90 px-4 py-3 font-semibold text-[#04121a] transition hover:bg-cyan-300"
        >
          <Play className="h-4 w-4" /> Start vrije sprintrit
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-white/80">
              <MapPin className="h-4 w-4 text-cyan-300" />
              {currentPlace ? (
                <span>Nu in {currentPlace}</span>
              ) : (
                <span className="text-white/50">Plaats bepalen…</span>
              )}
            </div>
            <span className="font-mono text-sm text-cyan-300">
              {count} bordje{count === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {power.supported && !power.connected && (
              <button
                onClick={power.connect}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-white/70 transition hover:bg-white/[0.08]"
              >
                <Bluetooth className="h-3.5 w-3.5" /> Koppel vermogensmeter
              </button>
            )}
            {power.connected && (
              <span className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">
                <Zap className="h-3.5 w-3.5" />
                {liveWatts != null ? `${liveWatts} W` : "verbonden"}
              </span>
            )}
            <button
              onClick={stop}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2 text-xs text-white/70 transition hover:bg-white/[0.08]"
            >
              <Square className="h-3.5 w-3.5" /> Stop
            </button>
          </div>

          {!power.supported && (
            <p className="text-[11px] text-white/40">
              Deze browser ondersteunt geen Bluetooth-vermogensmeter — je sprint
              telt op snelheid (dat werkt gewoon).
            </p>
          )}
        </div>
      )}

      {geoError && <p className="mt-3 text-sm text-amber-300/90">{geoError}</p>}

      {popup && (
        <div className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-center">
          <div className="text-xs uppercase tracking-widest text-cyan-300/80">
            Bordje {popup.placeName}
          </div>
          <div className="my-1 text-3xl font-bold text-white">
            +{popup.totalPoints}
          </div>
          <div className="text-xs text-white/60">
            {popup.basePoints} basis + {popup.bonusPoints} bonus
            {popup.speedKmhPeak != null &&
              ` · piek ${Math.round(popup.speedKmhPeak)} km/u`}
            {popup.peakWatts5s != null && ` · ${Math.round(popup.peakWatts5s)} W`}
          </div>
        </div>
      )}
    </section>
  )
}
