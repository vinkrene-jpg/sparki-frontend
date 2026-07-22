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
