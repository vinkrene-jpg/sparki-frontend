import { API_BASE } from "@/lib/api"
import { APP_VERSION } from "@/lib/version"
import { DEV_PREVIEW, getDevAthleteId } from "@/lib/dev"

// Client-side usage telemetry. Captures REAL events only — screen views, feature
// use, and visibility heartbeats — and ships them to POST /api/telemetry. The
// admin Test Management Dashboard derives every usage/coverage stat from these.
// Nothing is fabricated: if the user never opens a screen, no event is sent and
// the dashboard honestly shows "nooit geopend".

type EventType = "screen_view" | "feature_use" | "heartbeat"

interface QueuedEvent {
  type: EventType
  screen?: string
  feature?: string
}

const SID_KEY = "sparki_session_id"
const HEARTBEAT_MS = 60_000
const FLUSH_MS = 8_000

let queue: QueuedEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let started = false

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SID_KEY)
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      sessionStorage.setItem(SID_KEY, id)
    }
    return id
  } catch {
    return "no-storage"
  }
}

function platform(): string | null {
  const ua = navigator.userAgent
  if (/iPhone/i.test(ua)) return "iPhone"
  if (/iPad/i.test(ua)) return "iPad"
  if (/Android/i.test(ua)) return "Android"
  if (/Macintosh|Windows NT|Linux|CrOS/i.test(ua)) return "Desktop"
  return null
}

function send(events: QueuedEvent[], useBeacon: boolean): void {
  if (events.length === 0) return
  const sid = sessionId()
  const plat = platform()
  const payload = {
    events: events.map((e) => ({
      type: e.type,
      screen: e.screen ?? null,
      feature: e.feature ?? null,
      sessionId: sid,
      platform: plat,
    })),
  }
  const url = `${API_BASE}/api/telemetry`

  // sendBeacon is ideal during unload but can't set headers, so it can't carry
  // the dev-preview athlete header. Use it only in production; in dev use
  // keepalive fetch so the x-dev-clerk-id attribution survives.
  if (useBeacon && !DEV_PREVIEW && "sendBeacon" in navigator) {
    try {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      })
      if (navigator.sendBeacon(url, blob)) return
    } catch {
      // fall through to fetch
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Sparki-App-Version": APP_VERSION,
  }
  if (DEV_PREVIEW) {
    const devAthlete = getDevAthleteId()
    if (devAthlete) headers["x-dev-clerk-id"] = devAthlete
  }
  void fetch(url, {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers,
    body: JSON.stringify(payload),
  }).catch(() => {
    /* telemetry is best-effort; never disrupt the app */
  })
}

function flush(useBeacon = false): void {
  if (queue.length === 0) return
  const batch = queue
  queue = []
  send(batch, useBeacon)
}

function enqueue(e: QueuedEvent): void {
  queue.push(e)
  if (queue.length >= 20) flush()
}

let lastScreen: string | null = null

export function trackScreen(screen: string): void {
  if (!screen || screen === lastScreen) return
  lastScreen = screen
  enqueue({ type: "screen_view", screen })
}

export function trackFeature(feature: string): void {
  if (!feature) return
  enqueue({ type: "feature_use", feature })
}

// Start the background flush + heartbeat loops + unload flush. Idempotent.
export function startTelemetry(): void {
  if (started) return
  started = true

  flushTimer = setInterval(() => flush(), FLUSH_MS)
  heartbeatTimer = setInterval(() => {
    if (document.visibilityState === "visible") {
      enqueue({ type: "heartbeat" })
    }
  }, HEARTBEAT_MS)

  const onHide = () => {
    if (document.visibilityState === "hidden") flush(true)
  }
  document.addEventListener("visibilitychange", onHide)
  window.addEventListener("pagehide", () => flush(true))
}

export function stopTelemetry(): void {
  if (flushTimer) clearInterval(flushTimer)
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  flushTimer = null
  heartbeatTimer = null
  started = false
}
