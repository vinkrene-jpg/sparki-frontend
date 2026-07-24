// Sparki Foundation — Pattern Engine.
//
// Detects OBJECTIVE patterns only: trends, deviations, correlations, personal
// patterns and clearly-labeled extrapolations. It never advises — that is the
// Decision Support Engine's job. Deterministic statistics over the snapshot;
// thin data yields fewer patterns (with honest uncertainty), never guesses.

import type {
  DataSnapshot,
  DetectedPattern,
  FoundationConfidence,
  PatternEngine,
} from "./contracts";
import { FOUNDATION_CONFIG } from "./config";
import { engineLogger } from "./logging";

const log = engineLogger("pattern");

function conf(
  score: number,
  redenen: string[],
  onzekerheden: string[],
): FoundationConfidence {
  return { score: Math.max(0, Math.min(99, Math.round(score))), redenen, onzekerheden };
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

export function createPatternEngine(): PatternEngine {
  return {
    detect(snapshot: DataSnapshot): DetectedPattern[] {
      const cfg = FOUNDATION_CONFIG.pattern;
      const patterns: DetectedPattern[] = [];
      const chart = snapshot.belasting?.chartData ?? [];

      // ── Trend: CTL-richting over het venster.
      if (chart.length >= 14) {
        const eerste = chart[0]!.ctl;
        const laatste = chart[chart.length - 1]!.ctl;
        const delta = laatste - eerste;
        patterns.push({
          soort: "trend",
          code: "ctl_trend",
          beschrijving:
            delta >= 3
              ? `Je opgebouwde belasting stijgt (${eerste} → ${laatste} over ${chart.length} dagen).`
              : delta <= -3
                ? `Je opgebouwde belasting daalt (${eerste} → ${laatste} over ${chart.length} dagen).`
                : `Je opgebouwde belasting is stabiel rond ${laatste}.`,
          waarde: delta,
          vertrouwen: conf(
            Math.min(90, 40 + chart.length),
            [`${chart.length} dagen belastingsgegevens`],
            snapshot.sessies.length < 10 ? ["weinig sessies in het venster"] : [],
          ),
        });
      }

      // ── Afwijkingen: dagen met TSS ver boven het eigen gemiddelde (z-score).
      const tssDays = chart.filter((p) => p.tss > 0).map((p) => ({ date: p.date, tss: p.tss }));
      if (tssDays.length >= 5) {
        const mean = tssDays.reduce((a, b) => a + b.tss, 0) / tssDays.length;
        const sd = Math.sqrt(
          tssDays.reduce((a, b) => a + (b.tss - mean) ** 2, 0) / tssDays.length,
        );
        const zLimit = Number(cfg.parameters["afwijkingZScore"] ?? 2);
        if (sd > 0) {
          for (const d of tssDays) {
            const z = (d.tss - mean) / sd;
            if (z >= zLimit) {
              patterns.push({
                soort: "afwijking",
                code: "tss_uitschieter",
                beschrijving: `Op ${d.date} lag je trainingsbelasting (${Math.round(d.tss)}) ver boven je eigen gemiddelde (${Math.round(mean)}).`,
                waarde: Math.round(z * 100) / 100,
                vertrouwen: conf(
                  70,
                  [`z-score ${z.toFixed(1)} over ${tssDays.length} trainingsdagen`],
                  [],
                ),
              });
            }
          }
        }
      }

      // ── Correlatie: slaapuren vs TSS de dag erna (alleen echte overlap).
      const minPunten = Number(cfg.parameters["correlatieMinPunten"] ?? 10);
      const tssByDate = new Map(chart.map((p) => [p.date, p.tss]));
      const pairs: Array<[number, number]> = [];
      for (const m of snapshot.dagmetingen) {
        if (m.sleepHours == null) continue;
        const next = new Date(m.metricDate);
        next.setUTCDate(next.getUTCDate() + 1);
        const nextIso = next.toISOString().split("T")[0]!;
        const tss = tssByDate.get(nextIso);
        if (tss != null && tss > 0) pairs.push([m.sleepHours, tss]);
      }
      if (pairs.length >= minPunten) {
        const r = pearson(
          pairs.map((p) => p[0]),
          pairs.map((p) => p[1]),
        );
        if (r != null && Math.abs(r) >= 0.3) {
          patterns.push({
            soort: "correlatie",
            code: "slaap_vs_belasting",
            beschrijving: `Er is een ${r > 0 ? "positieve" : "negatieve"} samenhang (r=${r.toFixed(2)}) tussen je slaapuren en je trainingsbelasting de dag erna. Samenhang is geen oorzaak.`,
            waarde: Math.round(r * 100) / 100,
            vertrouwen: conf(
              Math.min(75, 30 + pairs.length * 3),
              [`${pairs.length} nachten met een training de dag erna`],
              ["samenhang bewijst geen oorzaak-gevolg"],
            ),
          });
        }
      }

      // ── Persoonlijk patroon: vaste trainingsdagen.
      if (snapshot.sessies.length >= 8) {
        const perDag = new Map<number, number>();
        for (const s of snapshot.sessies) {
          const dow = new Date(s.sessionDate).getUTCDay();
          perDag.set(dow, (perDag.get(dow) ?? 0) + 1);
        }
        const dagen = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
        const top = [...perDag.entries()].sort((a, b) => b[1] - a[1])[0]!;
        const aandeel = top[1] / snapshot.sessies.length;
        if (aandeel >= 0.3) {
          patterns.push({
            soort: "persoonlijk",
            code: "vaste_trainingsdag",
            beschrijving: `${dagen[top[0]]} is je vaste trainingsdag (${top[1]} van ${snapshot.sessies.length} sessies).`,
            waarde: Math.round(aandeel * 100) / 100,
            vertrouwen: conf(
              Math.min(85, 40 + snapshot.sessies.length),
              [`${snapshot.sessies.length} sessies in 90 dagen`],
              [],
            ),
          });
        }
      }

      // ── Voorspelling: lineaire extrapolatie van CTL — expliciet "geschat".
      const horizon = Number(cfg.parameters["voorspellingHorizonDagen"] ?? 14);
      if (chart.length >= 21) {
        const recent = chart.slice(-14);
        const perDagDelta =
          (recent[recent.length - 1]!.ctl - recent[0]!.ctl) / (recent.length - 1);
        const verwacht = Math.round(
          chart[chart.length - 1]!.ctl + perDagDelta * horizon,
        );
        patterns.push({
          soort: "voorspelling",
          code: "ctl_extrapolatie",
          beschrijving: `Bij gelijk trainingsritme komt je opgebouwde belasting over ${horizon} dagen geschat rond ${verwacht} uit. Dit is een schatting, geen zekerheid.`,
          waarde: verwacht,
          vertrouwen: conf(
            45,
            ["lineaire doortrekking van de laatste 14 dagen"],
            ["gaat uit van ongewijzigd trainingsritme", "ziekte/weer/planning niet meegenomen"],
          ),
        });
      }

      log.info({ patronen: patterns.length }, "foundation.pattern.detect");
      return patterns;
    },
  };
}
