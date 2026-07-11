// Engagement learning — pure, deterministic derivation of an athlete's usage
// rhythm from their REAL telemetry (tester_events). No fabrication: when there
// is too little data, the profile says so plainly (confidence "none"/"low") and
// falls back to an honest evening default rather than inventing a rhythm.
//
// This layer is used to time the "er is iets nieuws voor je" nudge for a moment
// the athlete tends to be receptive, and to power an honest read-out of what was
// learned. It never changes any number, conclusion or content — only WHEN a
// nudge may land.

export type TelemetryHit = {
  type: string; // "screen_view" | "feature_use" | "heartbeat"
  screen: string | null;
  feature: string | null;
  sessionId: string;
  createdAt: Date;
};

export type EngagementConfidence = "none" | "low" | "medium" | "high";

export type ReceptiveWindow = { startHour: number; endHour: number };

export type EngagementProfile = {
  hasData: boolean;
  eventCount: number;
  distinctActiveDays: number;
  distinctSessions: number;
  // Average number of app-opens per week over the observed span (1 decimal).
  opensPerWeek: number;
  lastOpenAt: string | null; // ISO
  hoursSinceLastOpen: number | null;
  // The hour (0..23, Amsterdam local) the athlete opens the app most; null when
  // there is nothing to learn from yet.
  receptiveHour: number | null;
  // The window a nudge may land in — learned around the peak when we know the
  // rhythm, otherwise an honest evening default.
  receptiveWindow: ReceptiveWindow;
  windowSource: "learned" | "default";
  // Per-hour open weight (0..23), for an honest read-out.
  activeHours: { hour: number; weight: number }[];
  // What the athlete uses most (screens + features), most-used first.
  topContent: { key: string; kind: "screen" | "feature"; count: number }[];
  confidence: EngagementConfidence;
};

// Honest fallback: a calm evening slot when we don't yet know the rhythm.
const DEFAULT_WINDOW: ReceptiveWindow = { startHour: 18, endHour: 21 };
const WINDOW_WIDTH_H = 2; // learned window width around the peak hour

// Amsterdam local hour (0..23) of a moment — the day boundary athletes live by.
export function amsterdamHour(d: Date): number {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    hour12: false,
  }).format(d);
  const h = Number.parseInt(s, 10);
  return Number.isFinite(h) ? h % 24 : d.getHours();
}

// Amsterdam local calendar day (YYYY-MM-DD) — used for per-day dedupe so a nudge
// fires at most once per real local day (never the UTC off-by-one trap).
export function amsterdamYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function confidenceFor(distinctActiveDays: number, eventCount: number): EngagementConfidence {
  if (distinctActiveDays === 0 || eventCount === 0) return "none";
  if (distinctActiveDays < 5) return "low";
  if (distinctActiveDays < 14) return "medium";
  return "high";
}

function emptyProfile(now: Date, lastOpenAt: Date | null): EngagementProfile {
  return {
    hasData: false,
    eventCount: 0,
    distinctActiveDays: 0,
    distinctSessions: 0,
    opensPerWeek: 0,
    lastOpenAt: lastOpenAt ? lastOpenAt.toISOString() : null,
    hoursSinceLastOpen:
      lastOpenAt != null
        ? Math.max(0, (now.getTime() - lastOpenAt.getTime()) / 3_600_000)
        : null,
    receptiveHour: null,
    receptiveWindow: { ...DEFAULT_WINDOW },
    windowSource: "default",
    activeHours: [],
    topContent: [],
    confidence: "none",
  };
}

export function computeEngagement(
  events: TelemetryHit[],
  now: Date = new Date(),
): EngagementProfile {
  if (events.length === 0) return emptyProfile(now, null);

  // ── Real opens drive recency & rhythm ─────────────────────────────────────
  // "Last open" must reflect when the athlete actually CHOSE to open the app
  // (screen_view), not background heartbeat noise — otherwise a late heartbeat
  // could falsely mark the athlete as "recently active" and suppress a genuinely
  // due "er is iets nieuws" nudge. Fall back to any non-heartbeat interaction,
  // then to all events, so recency is never silently null when data exists.
  const opens = events.filter((e) => e.type === "screen_view");
  const interactions = opens.length > 0
    ? opens
    : events.filter((e) => e.type !== "heartbeat");
  const recencyBasis = interactions.length > 0 ? interactions : events;

  // ── Basic spans ──────────────────────────────────────────────────────────
  const times = events.map((e) => e.createdAt.getTime());
  const lastMs = Math.max(...times);
  const firstMs = Math.min(...times);

  const recencyTimes = recencyBasis.map((e) => e.createdAt.getTime());
  const lastOpenMs = Math.max(...recencyTimes);
  const lastOpenAt = new Date(lastOpenMs);
  const hoursSinceLastOpen = Math.max(0, (now.getTime() - lastOpenMs) / 3_600_000);

  const activeDays = new Set(events.map((e) => amsterdamYmd(e.createdAt)));
  const sessions = new Set(events.map((e) => e.sessionId));
  const distinctActiveDays = activeDays.size;
  const distinctSessions = sessions.size;

  const spanDays = Math.max(1, (lastMs - firstMs) / 86_400_000);
  const spanWeeks = Math.max(1, spanDays / 7);
  const opensPerWeek = Math.round((distinctSessions / spanWeeks) * 10) / 10;

  // ── Receptive hour: when the athlete CHOOSES to open (screen_view), falling
  //    back to any non-heartbeat interaction if there are no screen views. ────

  const hourWeights = new Array<number>(24).fill(0);
  for (const e of interactions) hourWeights[amsterdamHour(e.createdAt)] += 1;
  const activeHours = hourWeights
    .map((weight, hour) => ({ hour, weight }))
    .filter((h) => h.weight > 0);

  let receptiveHour: number | null = null;
  if (interactions.length > 0) {
    let best = 0;
    for (let h = 1; h < 24; h++) {
      if (hourWeights[h] > hourWeights[best]) best = h; // ties → earliest hour
    }
    receptiveHour = hourWeights[best] > 0 ? best : null;
  }

  const confidence = confidenceFor(distinctActiveDays, events.length);

  // Only trust a learned window once we have enough days to mean something;
  // otherwise be honest and use the calm evening default.
  let receptiveWindow: ReceptiveWindow = { ...DEFAULT_WINDOW };
  let windowSource: "learned" | "default" = "default";
  if ((confidence === "medium" || confidence === "high") && receptiveHour != null) {
    const start = Math.min(receptiveHour, 22);
    receptiveWindow = { startHour: start, endHour: Math.min(24, start + WINDOW_WIDTH_H) };
    windowSource = "learned";
  }

  // ── Top content (screens + features), most-used first ──────────────────────
  const counts = new Map<string, { key: string; kind: "screen" | "feature"; count: number }>();
  for (const e of events) {
    if (e.type === "screen_view" && e.screen) {
      const k = `screen:${e.screen}`;
      const cur = counts.get(k) ?? { key: e.screen, kind: "screen" as const, count: 0 };
      cur.count += 1;
      counts.set(k, cur);
    } else if (e.type === "feature_use" && e.feature) {
      const k = `feature:${e.feature}`;
      const cur = counts.get(k) ?? { key: e.feature, kind: "feature" as const, count: 0 };
      cur.count += 1;
      counts.set(k, cur);
    }
  }
  const topContent = [...counts.values()]
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, 5);

  return {
    hasData: true,
    eventCount: events.length,
    distinctActiveDays,
    distinctSessions,
    opensPerWeek,
    lastOpenAt: lastOpenAt.toISOString(),
    hoursSinceLastOpen,
    receptiveHour,
    receptiveWindow,
    windowSource,
    activeHours,
    topContent,
    confidence,
  };
}
