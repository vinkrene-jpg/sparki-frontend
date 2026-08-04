// Real per-sample activity streams (vermogen, hartslag, cadans, snelheid,
// hoogte, temperatuur, afstand) collected while parsing a FIT/TCX file and
// downsampled to a bounded number of buckets for storage in
// activity_imports.parsedSummary.streams.
//
// Honesty rules:
// - A channel is null when the file carried NO samples for it — never filled.
// - Within a channel, a bucket with no samples stays null (sensor gap stays
//   visible as a gap; it is never interpolated away).
// - Speed is only derived from real distance deltas when the file has no
//   speed channel of its own — a deterministic derivation from real data,
//   flagged via `speedDerived`.

export type ActivityStreams = {
  /** Seconds since activity start per bucket (ascending). */
  t: number[];
  power: Array<number | null> | null;
  heartRate: Array<number | null> | null;
  cadence: Array<number | null> | null;
  speedKph: Array<number | null> | null;
  elevationM: Array<number | null> | null;
  temperatureC: Array<number | null> | null;
  distanceKm: Array<number | null> | null;
  /** True when speedKph was derived from distance deltas, not measured. */
  speedDerived: boolean;
  /** Raw sample count before downsampling — transparency, not a metric. */
  sampleCount: number;
};

export type StreamSample = {
  /** Absolute time in seconds (any epoch — only deltas matter). */
  tSec: number;
  power?: number | null;
  heartRate?: number | null;
  cadence?: number | null;
  speedKph?: number | null;
  elevationM?: number | null;
  temperatureC?: number | null;
  distanceM?: number | null;
};

const MAX_BUCKETS = 720;
/** Raw-sample cap: ~12h at 1 Hz. Beyond that we stop collecting (honest cap). */
const MAX_SAMPLES = 50_000;

type Channel = keyof Pick<
  StreamSample,
  | "power"
  | "heartRate"
  | "cadence"
  | "speedKph"
  | "elevationM"
  | "temperatureC"
  | "distanceM"
>;
const CHANNELS: Channel[] = [
  "power",
  "heartRate",
  "cadence",
  "speedKph",
  "elevationM",
  "temperatureC",
  "distanceM",
];

// ── Time-in-zone over stored streams ─────────────────────────────────────────
// Coggan power zones on FTP — MUST mirror the frontend zone table
// (artifacts/sparki/src/lib/stream-analysis.ts) so per-ride and per-week
// distributions agree.
export const POWER_ZONES: Array<{
  zone: string;
  label: string;
  lo: number;
  hi: number | null;
}> = [
  { zone: "Z1", label: "Herstel", lo: 0, hi: 0.55 },
  { zone: "Z2", label: "Duur", lo: 0.55, hi: 0.75 },
  { zone: "Z3", label: "Tempo", lo: 0.75, hi: 0.9 },
  { zone: "Z4", label: "Drempel", lo: 0.9, hi: 1.05 },
  { zone: "Z5", label: "VO2max", lo: 1.05, hi: 1.2 },
  { zone: "Z6", label: "Anaeroob", lo: 1.2, hi: null },
];

// MEETNIVEAU_EN_UITLEG_01 §3.1 SPOOR_H — hartslagzones op %maxHR. Vijf zones
// (klassieke indeling), MOET dezelfde tabel blijven als wat de frontend bij
// een hartslag-zonekaart toont. Alleen bruikbaar met een echte maxHR
// (profiel) of een expliciet als schatting gelabelde leeftijdsformule.
export const HR_ZONES: Array<{
  zone: string;
  label: string;
  lo: number;
  hi: number | null;
}> = [
  { zone: "Z1", label: "Herstel", lo: 0, hi: 0.6 },
  { zone: "Z2", label: "Duur", lo: 0.6, hi: 0.7 },
  { zone: "Z3", label: "Tempo", lo: 0.7, hi: 0.8 },
  { zone: "Z4", label: "Drempel", lo: 0.8, hi: 0.9 },
  { zone: "Z5", label: "Maximaal", lo: 0.9, hi: null },
];

/**
 * Seconds per hartslagzone from stored (downsampled) streams against maxHR.
 * Null when there is no usable heart-rate channel or maxHR — never a
 * fabricated distribution. Same bucket-duration rule as the power variant.
 */
export function hrZoneSecondsFromStreams(
  streams: unknown,
  maxHr: number | null,
): number[] | null {
  if (!maxHr || maxHr < 120 || maxHr > 230) return null;
  const s = streams as { t?: unknown; heartRate?: unknown } | null;
  if (!s || !Array.isArray(s.t) || !Array.isArray(s.heartRate)) return null;
  const t = s.t.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (t.length < 2 || t.length !== s.t.length) return null;

  const dts: number[] = [];
  for (let i = 1; i < t.length; i++) dts.push(t[i]! - t[i - 1]!);
  const medianDt = dts.length
    ? [...dts].sort((a, b) => a - b)[Math.floor(dts.length / 2)]!
    : 1;

  const seconds = HR_ZONES.map(() => 0);
  let any = false;
  for (let i = 0; i < t.length && i < s.heartRate.length; i++) {
    const v = (s.heartRate as unknown[])[i];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 40 || v > 230) continue;
    const ratio = v / maxHr;
    let idx = HR_ZONES.findIndex(
      (z) => ratio >= z.lo && (z.hi == null || ratio < z.hi),
    );
    if (idx < 0) idx = ratio < 0 ? 0 : HR_ZONES.length - 1;
    seconds[idx]! += medianDt;
    any = true;
  }
  if (!any) return null;
  return seconds.map((v) => Math.round(v));
}

/**
 * Seconds per Coggan zone from stored (downsampled) streams against FTP.
 * Null when there is no usable power channel or FTP — never a fabricated
 * distribution. Buckets with a power gap simply do not count.
 */
export function powerZoneSecondsFromStreams(
  streams: unknown,
  ftp: number | null,
): number[] | null {
  if (!ftp || ftp <= 0) return null;
  const s = streams as { t?: unknown; power?: unknown } | null;
  if (!s || !Array.isArray(s.t) || !Array.isArray(s.power)) return null;
  const t = s.t.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (t.length < 2 || t.length !== s.t.length) return null;

  // Each bucket stands for the time until the next bucket (last gets median dt)
  // — same rule as the per-ride frontend computation.
  const dts: number[] = [];
  for (let i = 1; i < t.length; i++) dts.push(t[i]! - t[i - 1]!);
  const medianDt = dts.length
    ? [...dts].sort((a, b) => a - b)[Math.floor(dts.length / 2)]!
    : 1;

  const seconds = POWER_ZONES.map(() => 0);
  let any = false;
  for (let i = 0; i < t.length && i < s.power.length; i++) {
    const v = (s.power as unknown[])[i];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const ratio = v / ftp;
    let idx = POWER_ZONES.findIndex(
      (z) => ratio >= z.lo && (z.hi == null || ratio < z.hi),
    );
    if (idx < 0) idx = ratio < 0 ? 0 : POWER_ZONES.length - 1;
    seconds[idx]! += medianDt;
    any = true;
  }
  if (!any) return null;
  return seconds.map((v) => Math.round(v));
}

export function createStreamCollector() {
  const samples: StreamSample[] = [];
  return {
    add(sample: StreamSample) {
      if (samples.length >= MAX_SAMPLES) return;
      if (!Number.isFinite(sample.tSec)) return;
      samples.push(sample);
    },
    finish(): ActivityStreams | null {
      return buildStreams(samples);
    },
  };
}
export type StreamCollector = ReturnType<typeof createStreamCollector>;

export function buildStreams(
  samples: StreamSample[],
): ActivityStreams | null {
  if (samples.length < 2) return null;
  const sorted = [...samples].sort((a, b) => a.tSec - b.tSec);
  const t0 = sorted[0]!.tSec;
  const tEnd = sorted[sorted.length - 1]!.tSec;
  const span = tEnd - t0;
  if (!(span > 0)) return null;

  // Derive speed from distance deltas only when no measured speed exists.
  const hasSpeed = sorted.some((s) => s.speedKph != null);
  const hasDistance = sorted.some((s) => s.distanceM != null);
  let speedDerived = false;
  if (!hasSpeed && hasDistance) {
    speedDerived = true;
    let prev: { tSec: number; distanceM: number } | null = null;
    for (const s of sorted) {
      if (s.distanceM == null) continue;
      if (prev && s.tSec > prev.tSec) {
        const dt = s.tSec - prev.tSec;
        // Ignore long gaps (pauses) — a derived speed across a pause is fiction.
        if (dt <= 15) {
          const mps = (s.distanceM - prev.distanceM) / dt;
          if (mps >= 0 && mps < 35) s.speedKph = Math.round(mps * 3.6 * 10) / 10;
        }
      }
      prev = { tSec: s.tSec, distanceM: s.distanceM };
    }
  }

  const bucketCount = Math.min(
    MAX_BUCKETS,
    Math.max(2, Math.floor(span) + 1),
  );
  const bucketSpan = span / bucketCount;

  const t: number[] = [];
  const sums: Record<Channel, number[]> = Object.fromEntries(
    CHANNELS.map((c) => [c, new Array(bucketCount).fill(0)]),
  ) as Record<Channel, number[]>;
  const counts: Record<Channel, number[]> = Object.fromEntries(
    CHANNELS.map((c) => [c, new Array(bucketCount).fill(0)]),
  ) as Record<Channel, number[]>;

  for (const s of sorted) {
    const idx = Math.min(
      bucketCount - 1,
      Math.floor((s.tSec - t0) / bucketSpan),
    );
    for (const c of CHANNELS) {
      const v = s[c];
      if (v != null && Number.isFinite(v)) {
        sums[c][idx]! += v;
        counts[c][idx]! += 1;
      }
    }
  }

  const channelOut: Record<Channel, Array<number | null>> = {} as never;
  for (const c of CHANNELS) {
    channelOut[c] = new Array(bucketCount).fill(null);
  }
  for (let i = 0; i < bucketCount; i++) {
    t.push(Math.round(i * bucketSpan));
    for (const c of CHANNELS) {
      if (counts[c][i]! > 0) {
        const avg = sums[c][i]! / counts[c][i]!;
        channelOut[c][i] = Math.round(avg * 10) / 10;
      }
    }
  }

  const channel = (c: Channel): Array<number | null> | null =>
    channelOut[c].some((v) => v != null) ? channelOut[c] : null;

  const distanceBuckets = channel("distanceM");

  return {
    t,
    power: channel("power"),
    heartRate: channel("heartRate"),
    cadence: channel("cadence"),
    speedKph: channel("speedKph"),
    elevationM: channel("elevationM"),
    temperatureC: channel("temperatureC"),
    distanceKm: distanceBuckets
      ? distanceBuckets.map((v) =>
          v == null ? null : Math.round((v / 1000) * 100) / 100,
        )
      : null,
    speedDerived,
    sampleCount: sorted.length,
  };
}
