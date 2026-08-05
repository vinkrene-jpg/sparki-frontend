import type { CanonicalActivity, CanonicalDailyMetric, CanonicalFtp } from "./types";

// Data validation for the hub. Out-of-range / impossible values are dropped to
// null (never coerced to a fake number). This protects every downstream engine
// (load/recovery/zones) from garbage provider data.

export function inRange(
  v: number | null | undefined,
  min: number,
  max: number,
): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < min || v > max) return null;
  return v;
}

function intOrNull(v: number | null): number | null {
  return v == null ? null : Math.round(v);
}

/** Clean an activity: clamp/null impossible values. Returns null if unusable. */
export function cleanActivity(a: CanonicalActivity): CanonicalActivity | null {
  if (!a.externalId) return null;
  const started = new Date(a.startedAt);
  if (Number.isNaN(started.getTime())) return null;
  return {
    ...a,
    durationMin: intOrNull(inRange(a.durationMin, 1, 24 * 60)),
    // H4: seconden binnen dezelfde plausibiliteitsgrens als minuten.
    durationSec: intOrNull(inRange(a.durationSec, 1, 24 * 3600)),
    distanceKm: inRange(a.distanceKm, 0, 2000),
    elevationM: intOrNull(inRange(a.elevationM, 0, 20000)),
    avgPower: intOrNull(inRange(a.avgPower, 0, 2000)),
    normalizedPower: intOrNull(inRange(a.normalizedPower, 0, 2000)),
    avgHR: intOrNull(inRange(a.avgHR, 20, 250)),
    maxHR: intOrNull(inRange(a.maxHR, 20, 260)),
    avgCadence: intOrNull(inRange(a.avgCadence, 0, 250)),
    avgSpeedKph: inRange(a.avgSpeedKph, 0, 150),
    powerBests: cleanPowerBests(a.powerBests),
    powerDurability: cleanPowerDurability(a.powerDurability),
    tss: intOrNull(inRange(a.tss, 0, 1000)),
  };
}

// Keep only plausible best-power entries (positive-second windows, 1..3000 W).
// An empty result is null — absence, not a fake empty table.
function cleanPowerBests(
  bests: Record<string, number> | null | undefined,
): Record<string, number> | null {
  if (!bests || typeof bests !== "object") return null;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(bests)) {
    const win = Number(key);
    const w = intOrNull(inRange(value, 1, 3000));
    if (Number.isInteger(win) && win > 0 && w != null) out[String(win)] = w;
  }
  return Object.keys(out).length > 0 ? out : null;
}

// Keep only a plausible durability summary: positive total work (capped at a
// generous 50 000 kJ) and per-work-level best tables that pass the same
// plausibility rules as power bests. Empty/implausible → null (absence).
function cleanPowerDurability(
  d: CanonicalActivity["powerDurability"],
): CanonicalActivity["powerDurability"] {
  if (!d || typeof d !== "object") return null;
  const total = intOrNull(inRange(d.totalWorkKj, 1, 50000));
  if (total == null) return null;
  if (!d.bestsByWork || typeof d.bestsByWork !== "object") return null;
  const bestsByWork: Record<string, Record<string, number>> = {};
  for (const [levelKey, bests] of Object.entries(d.bestsByWork)) {
    const level = Number(levelKey);
    if (!Number.isInteger(level) || level < 0) continue;
    // Een niveau boven de totale arbeid kan niet echt zijn.
    if (level > total) continue;
    const cleaned = cleanPowerBests(bests);
    if (cleaned) bestsByWork[String(level)] = cleaned;
  }
  if (Object.keys(bestsByWork).length === 0) return null;
  return { totalWorkKj: total, bestsByWork };
}

export function cleanDailyMetric(
  m: CanonicalDailyMetric,
): CanonicalDailyMetric | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date)) return null;
  const cleaned: CanonicalDailyMetric = {
    date: m.date,
    hrv: intOrNull(inRange(m.hrv, 1, 400)),
    restingHR: intOrNull(inRange(m.restingHR, 20, 150)),
    sleepHours: inRange(m.sleepHours, 0, 24),
    sleepQuality: intOrNull(inRange(m.sleepQuality, 0, 100)),
    fatigueScore: intOrNull(inRange(m.fatigueScore, 0, 100)),
    weightKg: inRange(m.weightKg, 20, 300),
  };
  // Drop a metric row with nothing usable.
  const hasAny =
    cleaned.hrv != null ||
    cleaned.restingHR != null ||
    cleaned.sleepHours != null ||
    cleaned.sleepQuality != null ||
    cleaned.fatigueScore != null ||
    cleaned.weightKg != null;
  return hasAny ? cleaned : null;
}

export function cleanFtp(f: CanonicalFtp): CanonicalFtp | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.measuredAt)) return null;
  const watts = inRange(f.ftpWatts, 50, 600);
  if (watts == null) return null;
  return { measuredAt: f.measuredAt, ftpWatts: Math.round(watts), testType: f.testType };
}
