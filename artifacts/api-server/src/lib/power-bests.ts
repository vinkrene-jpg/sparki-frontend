// Best average power over fixed windows (5s / 10s / 20s / 60s / 5min / 20min),
// computed from REAL timestamped power samples harvested while parsing a
// FIT/TCX file. Nothing is estimated: a file without per-sample power yields
// null, and a window longer than the ride is simply absent.
//
// Samples are placed on a per-second timeline keyed by their real timestamps.
// Seconds without a sample count as 0 W — the conservative reading (pauses /
// dropouts can only LOWER a best, never inflate it), matching how mainstream
// analysis tools treat gaps.

export const POWER_BEST_WINDOWS_SEC = [5, 10, 20, 60, 300, 1200] as const;

// Safety cap: 24h of seconds. Anything longer is a corrupt timestamp span.
const MAX_TIMELINE_SEC = 24 * 3600;

export type PowerSampleCollector = {
  /** Add one real sample: epoch/relative seconds + watts. */
  add(timeSec: number, watts: number): void;
  /** Compute bests, or null when there were no usable power samples. */
  finish(): Record<string, number> | null;
};

export function createPowerSampleCollector(): PowerSampleCollector {
  const times: number[] = [];
  const watts: number[] = [];

  return {
    add(timeSec: number, w: number) {
      if (!Number.isFinite(timeSec) || !Number.isFinite(w) || w < 0) return;
      times.push(Math.floor(timeSec));
      watts.push(w);
    },
    finish() {
      if (times.length === 0) return null;

      let minT = Infinity;
      let maxT = -Infinity;
      for (const t of times) {
        if (t < minT) minT = t;
        if (t > maxT) maxT = t;
      }
      const span = maxT - minT + 1;
      if (!(span >= 1) || span > MAX_TIMELINE_SEC) return null;

      // Per-second timeline; last sample for a second wins.
      const series = new Float64Array(span);
      const seen = new Uint8Array(span);
      for (let i = 0; i < times.length; i++) {
        const idx = times[i]! - minT;
        series[idx] = watts[i]!;
        seen[idx] = 1;
      }

      // Prefix sums for O(1) window averages.
      const prefix = new Float64Array(span + 1);
      for (let i = 0; i < span; i++) prefix[i + 1] = prefix[i]! + series[i]!;

      const bests: Record<string, number> = {};
      for (const win of POWER_BEST_WINDOWS_SEC) {
        if (win > span) continue;
        let best = -1;
        for (let start = 0; start + win <= span; start++) {
          const avg = (prefix[start + win]! - prefix[start]!) / win;
          if (avg > best) best = avg;
        }
        if (best >= 0) bests[String(win)] = Math.round(best);
      }
      // All-zero data (power meter present but never above 0) is not a "best".
      const hasReal = Object.values(bests).some((v) => v > 0);
      return hasReal ? bests : null;
    },
  };
}
