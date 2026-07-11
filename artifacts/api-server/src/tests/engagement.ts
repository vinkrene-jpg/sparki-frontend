// Engagement learning — pure-function contract test for `computeEngagement`.
//
// The engagement engine LEARNS an athlete's usage rhythm from their own real
// telemetry (tester_events) and is used to time the "er is iets nieuws voor je"
// nudge for a receptive moment. This is the FOUNDATION of a healthy pull-to-
// return system, so its honesty guarantees must not silently drift:
//
//   1. No data ⇒ honest empty profile (confidence "none", evening DEFAULT window,
//      never an invented rhythm).
//   2. A learned window is only trusted at "medium"/"high" confidence (enough
//      distinct active days); below that it stays the honest evening default.
//   3. The receptive hour is derived from when the athlete CHOOSES to open
//      (screen_view), in Amsterdam local time (never the UTC off-by-one trap).
//   4. opensPerWeek / distinct days / distinct sessions reflect the real events.
//   5. topContent counts real screens/features, most-used first.
//   6. hoursSinceLastOpen is measured from the newest event.
//
// Pure functions only — NO database, NO network. Run:
//   pnpm --filter @workspace/api-server run test:engagement
// Exits non-zero on any failure.

import {
  computeEngagement,
  amsterdamHour,
  amsterdamYmd,
  type TelemetryHit,
} from "../engines/engagement/compute";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function scenario(name: string, fn: () => void) {
  try {
    fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

// A moment at a given Amsterdam local hour on a given local date. We pick a
// summer date (CEST, UTC+2) and verify the local hour round-trips, so the test
// is honest about the timezone rather than assuming a fixed offset.
function atAmsHour(dateYmd: string, hour: number): Date {
  // Build from a UTC guess then correct so amsterdamHour(d) === hour exactly.
  let d = new Date(`${dateYmd}T${String(hour).padStart(2, "0")}:30:00Z`);
  for (let i = 0; i < 4 && amsterdamHour(d) !== hour; i++) {
    const diff = ((hour - amsterdamHour(d) + 24) % 24) * 3_600_000;
    d = new Date(d.getTime() + diff);
  }
  return d;
}

function hit(over: Partial<TelemetryHit> & { createdAt: Date }): TelemetryHit {
  return {
    type: "screen_view",
    screen: "home",
    feature: null,
    sessionId: "s1",
    ...over,
  };
}

// ── 1. Empty ⇒ honest empty profile ──────────────────────────────────────────
scenario("no telemetry ⇒ honest empty profile, evening default window", () => {
  const now = new Date("2026-07-01T12:00:00Z");
  const p = computeEngagement([], now);
  assert(p.hasData === false, "hasData should be false");
  assert(p.eventCount === 0, "eventCount should be 0");
  assert(p.confidence === "none", "confidence should be none");
  assert(p.windowSource === "default", "window should be default");
  assert(
    p.receptiveWindow.startHour === 18 && p.receptiveWindow.endHour === 21,
    "default window should be 18–21",
  );
  assert(p.receptiveHour === null, "receptiveHour should be null");
  assert(p.lastOpenAt === null, "lastOpenAt should be null");
  assert(p.hoursSinceLastOpen === null, "hoursSinceLastOpen should be null");
  assert(p.topContent.length === 0, "topContent should be empty");
});

// ── 2. Low data ⇒ NOT enough to trust a learned window ────────────────────────
scenario("few active days ⇒ low confidence, still default window", () => {
  const now = new Date("2026-07-10T12:00:00Z");
  // 3 distinct days, all opened at 20:00 local — a clear peak, but too few days
  // to trust, so the window must stay the honest default.
  const events: TelemetryHit[] = [
    hit({ createdAt: atAmsHour("2026-07-01", 20), sessionId: "a" }),
    hit({ createdAt: atAmsHour("2026-07-02", 20), sessionId: "b" }),
    hit({ createdAt: atAmsHour("2026-07-03", 20), sessionId: "c" }),
  ];
  const p = computeEngagement(events, now);
  assert(p.hasData === true, "hasData should be true");
  assert(p.confidence === "low", `confidence should be low, got ${p.confidence}`);
  assert(p.receptiveHour === 20, `receptiveHour should be 20, got ${p.receptiveHour}`);
  assert(p.windowSource === "default", "window must stay default at low confidence");
  assert(
    p.receptiveWindow.startHour === 18 && p.receptiveWindow.endHour === 21,
    "low-confidence window must be the 18–21 default",
  );
  assert(p.distinctActiveDays === 3, "should count 3 distinct days");
  assert(p.distinctSessions === 3, "should count 3 distinct sessions");
});

// ── 3. Enough data ⇒ learned window around the real peak hour ─────────────────
scenario("many active days ⇒ medium+ confidence, learned window at peak", () => {
  const now = new Date("2026-08-01T12:00:00Z");
  const events: TelemetryHit[] = [];
  // 8 distinct days, all opened at 21:00 local ⇒ medium confidence, learned.
  for (let day = 1; day <= 8; day++) {
    const ymd = `2026-07-${String(day).padStart(2, "0")}`;
    events.push(hit({ createdAt: atAmsHour(ymd, 21), sessionId: `d${day}` }));
  }
  const p = computeEngagement(events, now);
  assert(p.confidence === "medium", `confidence should be medium, got ${p.confidence}`);
  assert(p.receptiveHour === 21, `receptiveHour should be 21, got ${p.receptiveHour}`);
  assert(p.windowSource === "learned", "window should be learned");
  assert(
    p.receptiveWindow.startHour === 21 && p.receptiveWindow.endHour === 23,
    `learned window should be 21–23, got ${p.receptiveWindow.startHour}–${p.receptiveWindow.endHour}`,
  );
});

// ── 4. Receptive hour uses screen_view opens, not heartbeats ──────────────────
scenario("receptive hour derived from opens, not heartbeats", () => {
  const now = new Date("2026-08-01T12:00:00Z");
  const events: TelemetryHit[] = [];
  // Opens every day at 07:00, but noisy heartbeats at 15:00. The peak OPEN hour
  // must win — heartbeats never define when someone chooses to open the app.
  for (let day = 1; day <= 8; day++) {
    const ymd = `2026-07-${String(day).padStart(2, "0")}`;
    events.push(hit({ createdAt: atAmsHour(ymd, 7), sessionId: `d${day}` }));
    events.push(
      hit({
        createdAt: atAmsHour(ymd, 15),
        type: "heartbeat",
        screen: null,
        sessionId: `d${day}`,
      }),
    );
  }
  const p = computeEngagement(events, now);
  assert(p.receptiveHour === 7, `receptiveHour should be 7 (opens), got ${p.receptiveHour}`);
});

// ── 5. topContent counts real screens/features, most-used first ───────────────
scenario("topContent ranks real screens/features by count", () => {
  const now = new Date("2026-08-01T12:00:00Z");
  const events: TelemetryHit[] = [
    hit({ createdAt: atAmsHour("2026-07-01", 20), screen: "training" }),
    hit({ createdAt: atAmsHour("2026-07-02", 20), screen: "training" }),
    hit({ createdAt: atAmsHour("2026-07-03", 20), screen: "home" }),
    hit({
      createdAt: atAmsHour("2026-07-04", 20),
      type: "feature_use",
      screen: null,
      feature: "voeding",
    }),
  ];
  const p = computeEngagement(events, now);
  assert(p.topContent.length === 3, `expected 3 content keys, got ${p.topContent.length}`);
  assert(p.topContent[0].key === "training", "training should rank first");
  assert(p.topContent[0].kind === "screen", "training should be a screen");
  assert(p.topContent[0].count === 2, "training should have count 2");
  const voeding = p.topContent.find((c) => c.key === "voeding");
  assert(voeding?.kind === "feature", "voeding should be a feature");
});

// ── 6. hoursSinceLastOpen measured from the newest event ──────────────────────
scenario("hoursSinceLastOpen measured from newest event", () => {
  const last = atAmsHour("2026-07-10", 20);
  const now = new Date(last.getTime() + 5 * 3_600_000); // 5h later
  const events: TelemetryHit[] = [
    hit({ createdAt: atAmsHour("2026-07-08", 20), sessionId: "a" }),
    hit({ createdAt: last, sessionId: "b" }),
  ];
  const p = computeEngagement(events, now);
  assert(
    Math.abs((p.hoursSinceLastOpen ?? -1) - 5) < 0.001,
    `hoursSinceLastOpen should be ~5, got ${p.hoursSinceLastOpen}`,
  );
  assert(p.lastOpenAt === last.toISOString(), "lastOpenAt should equal newest event");
});

// ── 6b. A later heartbeat must NOT distort "last open" recency ─────────────────
scenario("heartbeat after an open does not falsify hoursSinceLastOpen", () => {
  const realOpen = atAmsHour("2026-07-10", 20);
  // A background heartbeat fires 3h AFTER the last real open.
  const laterBeat = new Date(realOpen.getTime() + 3 * 3_600_000);
  const now = new Date(realOpen.getTime() + 9 * 3_600_000); // 9h after the open
  const events: TelemetryHit[] = [
    hit({ createdAt: realOpen, sessionId: "a" }),
    hit({
      createdAt: laterBeat,
      type: "heartbeat",
      screen: null,
      sessionId: "a",
    }),
  ];
  const p = computeEngagement(events, now);
  // Recency must be measured from the real open (9h), not the heartbeat (6h) —
  // otherwise a due nudge could be wrongly suppressed by the 8h gate.
  assert(
    Math.abs((p.hoursSinceLastOpen ?? -1) - 9) < 0.001,
    `hoursSinceLastOpen should be ~9 (from the open), got ${p.hoursSinceLastOpen}`,
  );
  assert(
    p.lastOpenAt === realOpen.toISOString(),
    "lastOpenAt should be the real open, not the later heartbeat",
  );
});

// ── 7. amsterdamYmd is a LOCAL calendar day (no UTC off-by-one) ───────────────
scenario("amsterdamYmd resolves the local calendar day across midnight", () => {
  // 2026-07-10 23:30 UTC is already 2026-07-11 01:30 in Amsterdam (CEST).
  const d = new Date("2026-07-10T23:30:00Z");
  assert(
    amsterdamYmd(d) === "2026-07-11",
    `expected 2026-07-11 local, got ${amsterdamYmd(d)}`,
  );
});

// ── report ────────────────────────────────────────────────────────────────────
const failed = results.filter((r) => r.status === "fail");
for (const r of results) {
  const tag = r.status === "pass" ? "PASS" : "FAIL";
  console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
}
console.log(
  `\nEngagement engine: ${results.length - failed.length}/${results.length} passed.`,
);
if (failed.length > 0) process.exit(1);
