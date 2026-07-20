// Sprint engine test: deterministic scoring + honest board detection.
//
// Pure functions only — no database needed.
//
// Run: `pnpm --filter @workspace/api-server run test:sprint`
// Exits non-zero on any failure.

import { scoreSprint } from "../engines/sprint/score";
import { boardsFromSamples } from "../engines/sprint/detect";

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

// ── scoring ──────────────────────────────────────────────────────────
scenario("base points always awarded for reaching a sign", () => {
  const s = scoreSprint({ speedGainKmh: 0 });
  assert(s.basePoints === 10, "base must be 10");
  assert(s.bonusPoints === 0, "no gain → no bonus");
  assert(s.totalPoints === 10, "total = base");
});

scenario("negative/absent speed gain earns no bonus", () => {
  assert(scoreSprint({ speedGainKmh: -5 }).bonusPoints === 0, "negative → 0");
  assert(scoreSprint({ speedGainKmh: null }).bonusPoints === 0, "null → 0");
});

scenario("speed bonus is 2 points per km/h gained", () => {
  assert(scoreSprint({ speedGainKmh: 6 }).bonusPoints === 12, "6→12");
  assert(scoreSprint({ speedGainKmh: 3.4 }).bonusPoints === 7, "rounds");
});

scenario("speed bonus is capped at 30", () => {
  assert(scoreSprint({ speedGainKmh: 40 }).bonusPoints === 30, "cap 30");
  assert(scoreSprint({ speedGainKmh: 40 }).totalPoints === 40, "10+30");
});

scenario("watt bonus only when both peak and ftp are present", () => {
  assert(
    scoreSprint({ speedGainKmh: 0, peakWatts5s: 900 }).bonusPoints === 0,
    "no ftp → no watt bonus",
  );
  assert(
    scoreSprint({ speedGainKmh: 0, ftpWatts: 250 }).bonusPoints === 0,
    "no peak → no watt bonus",
  );
});

scenario("watt bonus scales from 1.5x to 3x FTP", () => {
  const atFloor = scoreSprint({ speedGainKmh: 0, peakWatts5s: 375, ftpWatts: 250 });
  assert(atFloor.bonusPoints === 0, "1.5x FTP → 0 watt bonus");
  const atCap = scoreSprint({ speedGainKmh: 0, peakWatts5s: 750, ftpWatts: 250 });
  assert(atCap.bonusPoints === 20, "3x FTP → 20 watt bonus");
  const mid = scoreSprint({ speedGainKmh: 0, peakWatts5s: 562.5, ftpWatts: 250 });
  assert(mid.bonusPoints === 10, "2.25x FTP → half");
});

scenario("scoring is deterministic", () => {
  const a = scoreSprint({ speedGainKmh: 7, peakWatts5s: 600, ftpWatts: 250 });
  const b = scoreSprint({ speedGainKmh: 7, peakWatts5s: 600, ftpWatts: 250 });
  assert(a.totalPoints === b.totalPoints, "same input, same output");
});

// ── board detection (pure transitions) ───────────────────────────────
scenario("new place names become boards; start is not a sprint", () => {
  const boards = boardsFromSamples([
    { name: "Oss", lat: 51.76, lon: 5.52, km: 0 },
    { name: "Oss", lat: 51.77, lon: 5.53, km: 1 },
    { name: "Berghem", lat: 51.78, lon: 5.55, km: 3 },
    { name: "Nistelrode", lat: 51.7, lon: 5.55, km: 7 },
  ]);
  assert(boards.length === 2, `expected 2, got ${boards.length}`);
  assert(boards[0]!.placeName === "Berghem", "first board Berghem");
  assert(boards[1]!.placeName === "Nistelrode", "second board Nistelrode");
});

scenario("null samples (failed geocode) are skipped, not faked", () => {
  const boards = boardsFromSamples([
    { name: "Oss", lat: 51.76, lon: 5.52, km: 0 },
    { name: null, lat: 51.77, lon: 5.53, km: 2 },
    { name: "Berghem", lat: 51.78, lon: 5.55, km: 4 },
  ]);
  assert(boards.length === 1, "one board only");
  assert(boards[0]!.km === 4, "board at the real known sample");
});

scenario("place labels normalise (town name, ignore admin suffix)", () => {
  const boards = boardsFromSamples([
    { name: "Nistelrode, Bernheze", lat: 51.7, lon: 5.5, km: 0 },
    { name: "Nistelrode", lat: 51.71, lon: 5.51, km: 2 },
    { name: "Heesch, Bernheze", lat: 51.72, lon: 5.52, km: 5 },
  ]);
  assert(boards.length === 1, "same town not re-counted");
  assert(boards[0]!.placeName === "Heesch", "clean label");
});

scenario("re-entering a town (loop) counts again", () => {
  const boards = boardsFromSamples([
    { name: "Oss", lat: 51.76, lon: 5.52, km: 0 },
    { name: "Berghem", lat: 51.78, lon: 5.55, km: 3 },
    { name: "Oss", lat: 51.76, lon: 5.52, km: 9 },
  ]);
  assert(boards.length === 2, "Berghem + return to Oss");
});

// ── report ───────────────────────────────────────────────────────────
const failed = results.filter((r) => r.status === "fail");
for (const r of results) {
  const tag = r.status === "pass" ? "PASS" : "FAIL";
  console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
