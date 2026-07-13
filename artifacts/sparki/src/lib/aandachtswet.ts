// De aandachtswet — Fase 2 priority law for the Vandaag surface.
//
// Source of truth: docs/product/NIEUWE_KERNERVARING.md §5. One ordered ruleset
// decides what the single leading Momentblok is (§5.1) and what may ride along
// beneath it (§5.2). This module is PURE and deterministic — it takes already-
// resolved real signals and returns decisions. It never fetches, never invents:
// callers feed it honest signals (health status, ride-moment phase, planned
// workout, rest day, connector/material/engagement availability) and it only
// orders them. Higher priority always wins; health/overload is never dimmed and
// never moved by presentation variation.

/** The single leading block on Vandaag, in strict priority order. */
export type MomentKind =
  | "health" // 1 — gezondheids-/overbelastingssignaal (never dimmed/rotated)
  | "racedag" // 2 — a race is on today's calendar
  | "na-rit" // 3 — a fresh ride is in, analysis ready
  | "rit-binnen" // 4 — a fresh ride is in, analysis still processing
  | "voorstel" // 5 — an outstanding schema-adjustment proposal
  | "voor-training" // 6 — a planned training today, not yet ridden
  | "herstel" // 7 — a rest day
  | "balans"; // 8 — otherwise: the calm toestand (State Card)

/** Real, already-resolved signals that decide the leading Momentblok. */
export type MomentSignals = {
  /** Athlete-set sick/injured — the safety surface leads, always. */
  healthActive: boolean;
  /** Ride-moment phase from /api/ride-story/moment (null when none). */
  ridePhase: "racedag" | "verwerken" | "na-rit" | null;
  /** An outstanding, still-open schema-adjustment proposal exists. */
  hasProposal: boolean;
  /** A training is planned for today and has not been ridden yet. */
  plannedWorkoutToday: boolean;
  /** Today is an explicit rest day. */
  restDay: boolean;
};

/**
 * Resolve the single leading Momentblok from the §5.1 priority table. The first
 * matching rule wins; nothing below it can override it.
 */
export function selectMoment(s: MomentSignals): MomentKind {
  if (s.healthActive) return "health";
  if (s.ridePhase === "racedag") return "racedag";
  if (s.ridePhase === "na-rit") return "na-rit";
  if (s.ridePhase === "verwerken") return "rit-binnen";
  if (s.hasProposal) return "voorstel";
  if (s.plannedWorkoutToday) return "voor-training";
  if (s.restDay) return "herstel";
  return "balans";
}

/**
 * Weather rides along ONLY where it is a real decision factor: right before a
 * training and on race day (§5.2 #3). Everywhere else it is absent (reachable
 * via its own destination). The caller still applies the honest weather gate on
 * top of this (weather only when it truly resolved).
 */
export function weatherAllowed(m: MomentKind): boolean {
  return m === "voor-training" || m === "racedag";
}

/**
 * The leskaart rides along ONLY on the calm moments where there is room to learn
 * (herstel/rustdag and balans) — never when a ride, race or safety signal is
 * leading (§5.2 #3). The caller still applies the honest flag/content gate.
 */
export function leskaartAllowed(m: MomentKind): boolean {
  return m === "herstel" || m === "balans";
}

/**
 * A single nudge source. Health is deliberately NOT here — it is prio 1 in the
 * Momentblok itself and never competes for the nudge budget (§5.2 #2).
 */
export type NudgeSource = "connector" | "material" | "engagement" | "reminder";

// Fixed rank (§5.2 #2): a broken connection outranks a gear-safety notice, which
// outranks everything else ("overige").
const NUDGE_RANK: NudgeSource[] = [
  "connector", // verbinding-kapot
  "material", // materiaal-veiligheid
  "engagement", // overige (profielvraag)
  "reminder", // overige (herinnering)
];

/**
 * The nudge budget: at most ONE nudge per visit across all sources. Given which
 * sources genuinely have something to say, pick the single highest-ranked one.
 * Returns null when nothing is pending.
 */
export function pickNudge(available: readonly NudgeSource[]): NudgeSource | null {
  for (const source of NUDGE_RANK) {
    if (available.includes(source)) return source;
  }
  return null;
}
