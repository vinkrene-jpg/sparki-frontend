// Race-context resolver (task #4) — pure, testable logic.
//
// Given the athlete's races and "today", it picks the nearest relevant race and
// derives its race-week phase. This is the single source of truth used by both
// the day-type engine (to route Home) and the race homepages (to render). No
// fabricated data — only date arithmetic over athlete-entered races.

import type { Race, RaceContext, RacePhase } from "@/lib/race-types";

/** Parse a YYYY-MM-DD date string to a local midnight Date. */
function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Local midnight for a given date. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days from `today` to `dateStr` (0 = same day, 1 = tomorrow, <0 = past). */
export function daysUntil(dateStr: string, today: Date = new Date()): number {
  const a = startOfDay(today).getTime();
  const b = startOfDay(parseDateOnly(dateStr)).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Map days-until-race to a race-week phase, per the blueprint:
 *   7–4 days = training focus, 3–2 days = recovery focus, 1 day = preparation,
 *   race day = competition, 1–2 days after = recovery & analysis.
 * Returns null when the race is outside any race-context window.
 */
export function phaseFromDaysUntil(d: number): RacePhase | null {
  if (d === 0) return "race_day";
  if (d === 1) return "day_before";
  if (d >= 2 && d <= 3) return "race_week_taper";
  if (d >= 4 && d <= 7) return "race_week_build";
  if (d < 0 && d >= -2) return "post_race";
  return null;
}

/**
 * Resolve the active race context from the athlete's races. The nearest race in
 * a live window wins; an imminent race (race day / day before) always takes
 * priority over a recently-finished one. A travel day (race.travelDate === today,
 * before the race) is surfaced as the `travel` phase.
 */
export function resolveRaceContext(
  races: readonly Race[] | undefined | null,
  today: Date = new Date(),
): RaceContext | null {
  if (!races || races.length === 0) return null;

  const candidates: RaceContext[] = [];
  for (const race of races) {
    const d = daysUntil(race.raceDate, today);

    // Travel day: athlete marked a travel date that is today and the race is
    // still ahead. Surfaced as its own candidate but kept at lower priority than
    // race-day/day-before of the same race — both candidates are added and the
    // priority ordering below decides which one wins.
    if (race.travelDate && daysUntil(race.travelDate, today) === 0 && d >= 1) {
      candidates.push({ race, daysUntil: d, phase: "travel" });
    }

    const phase = phaseFromDaysUntil(d);
    if (phase) candidates.push({ race, daysUntil: d, phase });
  }

  if (candidates.length === 0) return null;

  // Priority ordering of phases (most urgent first).
  const order: Record<RacePhase, number> = {
    race_day: 0,
    day_before: 1,
    travel: 2,
    race_week_taper: 3,
    race_week_build: 4,
    post_race: 5,
  };

  candidates.sort((a, b) => {
    const byPhase = order[a.phase] - order[b.phase];
    if (byPhase !== 0) return byPhase;
    // Same phase → the closer race wins (smallest absolute days-until).
    return Math.abs(a.daysUntil) - Math.abs(b.daysUntil);
  });

  return candidates[0] ?? null;
}
