// Deterministic TSS estimate from a workout's block structure.
//
// When a planned workout has no explicit targetTSS, Sparki estimates it from the
// real block structure using the standard TSS identity:
//   TSS = Σ (durationMin / 60) · IF² · 100
// where IF (intensity factor) is the block's target as a fraction of FTP, or a
// fixed per-zone fallback when no %FTP target is set. This is sports-science
// arithmetic over the athlete's own plan — not a fabricated number. The caller
// marks the result as "estimated" so the UI is honest about its origin.

import type { WorkoutStructure } from "@workspace/db";

// Mid-zone intensity factors (fraction of FTP) — only used when a block has no
// explicit %FTP target. Conservative, standard coaching zone midpoints.
const ZONE_IF: Record<number, number> = {
  1: 0.55,
  2: 0.7,
  3: 0.83,
  4: 0.95,
  5: 1.1,
  6: 1.25,
};

export function estimateTssFromStructure(
  structure: WorkoutStructure | null | undefined,
): number | null {
  if (!structure || !Array.isArray(structure.blocks) || structure.blocks.length === 0) {
    return null;
  }
  let tss = 0;
  for (const b of structure.blocks) {
    const durationMin = typeof b.durationMin === "number" ? b.durationMin : 0;
    if (durationMin <= 0) continue;
    const reps = typeof b.reps === "number" && b.reps > 0 ? b.reps : 1;
    const ifFromPct =
      b.targetPctFtp != null && b.targetPctFtp > 0 ? b.targetPctFtp / 100 : null;
    const intensity = ifFromPct ?? ZONE_IF[b.zone] ?? 0.6;
    const hours = (durationMin * reps) / 60;
    tss += hours * intensity * intensity * 100;
  }
  const rounded = Math.round(tss);
  return rounded > 0 ? rounded : null;
}
