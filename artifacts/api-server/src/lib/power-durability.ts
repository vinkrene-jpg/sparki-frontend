// Volhoudbaarheid (durability): hoe goed houdt een renner vermogen vast nadat
// er al veel arbeid (kJ) is verricht? Om dat later te kunnen meten bewaren we
// bij ingest een COMPACTE samenvatting van de echte per-sample vermogensdata:
//
//   • totale cumulatieve arbeid van de rit (kJ), en
//   • best-vermogens per venster GESPLITST per arbeidsniveau: "vers" (0 kJ)
//     versus ná 1000 / 1500 / 2000 / 2500 kJ verrichte arbeid.
//
// Alleen ECHTE per-sample vermogensdata telt (zelfde regel als power-bests):
// een bestand zonder per-sample vermogen levert null — nooit geschat uit
// gemiddelden, geen backfill voor oude sessies. Hartslag-only ritten krijgen
// niets.
//
// Zelfde per-seconde-tijdlijnconventie als power-bests: seconden zonder sample
// tellen als 0 W (conservatief — gaten kunnen een best alleen verlagen, en
// voegen geen arbeid toe).

import { POWER_BEST_WINDOWS_SEC } from "./power-bests";

// Arbeidsniveaus (kJ verricht vóór het venster begint). "0" = vers.
export const DURABILITY_WORK_LEVELS_KJ = [0, 1000, 1500, 2000, 2500] as const;

// Safety cap: 24h of seconds. Anything longer is a corrupt timestamp span.
const MAX_TIMELINE_SEC = 24 * 3600;

export type PowerDurability = {
  /** Totale verrichte arbeid van de rit, in kJ (afgerond). */
  totalWorkKj: number;
  /**
   * Best-gemiddeld vermogen per venster (binnenste keys = vensterseconden,
   * zoals power_bests), gesplitst per arbeidsniveau (buitenste keys = kJ
   * verricht vóór de vensterstart: "0", "1000", "1500", "2000", "2500").
   * Een niveau dat de rit niet haalde (of waarna geen volledig venster meer
   * paste) is simpelweg afwezig — nooit met nullen opgevuld.
   */
  bestsByWork: Record<string, Record<string, number>>;
};

export type DurabilityCollector = {
  /** Add one real sample: epoch/relative seconds + watts. */
  add(timeSec: number, watts: number): void;
  /** Compute the durability summary, or null without usable power samples. */
  finish(): PowerDurability | null;
};

export function createDurabilityCollector(): DurabilityCollector {
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
      for (let i = 0; i < times.length; i++) {
        series[times[i]! - minT] = watts[i]!;
      }

      // Prefix sums: prefix[i] = joule (= watt·s) verricht in seconden [0, i).
      const prefix = new Float64Array(span + 1);
      for (let i = 0; i < span; i++) prefix[i + 1] = prefix[i]! + series[i]!;

      const totalJoules = prefix[span]!;
      // Vermogensmeter aanwezig maar nooit boven 0 W: geen echte arbeid.
      if (!(totalJoules > 0)) return null;

      const bestsByWork: Record<string, Record<string, number>> = {};
      for (const levelKj of DURABILITY_WORK_LEVELS_KJ) {
        const thresholdJ = levelKj * 1000;
        if (totalJoules < thresholdJ) continue; // niveau eerlijk niet gehaald

        // Eerste seconde waarvóór al ≥ threshold arbeid is verricht.
        let startIdx = 0;
        if (thresholdJ > 0) {
          // Binary search over de monotone prefix-som.
          let lo = 0;
          let hi = span;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (prefix[mid]! >= thresholdJ) hi = mid;
            else lo = mid + 1;
          }
          startIdx = lo;
        }

        const bests: Record<string, number> = {};
        for (const win of POWER_BEST_WINDOWS_SEC) {
          if (startIdx + win > span) continue; // geen volledig venster meer
          let best = -1;
          for (let start = startIdx; start + win <= span; start++) {
            const avg = (prefix[start + win]! - prefix[start]!) / win;
            if (avg > best) best = avg;
          }
          if (best >= 0) bests[String(win)] = Math.round(best);
        }
        const hasReal = Object.values(bests).some((v) => v > 0);
        if (hasReal) bestsByWork[String(levelKj)] = bests;
      }

      if (Object.keys(bestsByWork).length === 0) return null;
      return {
        totalWorkKj: Math.round(totalJoules / 1000),
        bestsByWork,
      };
    },
  };
}
