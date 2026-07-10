// Adaptive coaching personalities.
//
// A personality changes HOW Sparki frames its analysis (vocabulary, amount of
// encouragement, level of detail) — never the underlying numbers, so the engine
// stays deterministic. Three personalities ship today (Beginner, Ervaren,
// Jeugdrenner); the model is extensible (Ouder, Trainer, Topsporter included).

import type { Personality, PersonalityKey } from "./types";
import { computeAge } from "../../lib/age";

const DEFS: Record<PersonalityKey, Omit<Personality, "basis">> = {
  beginner: {
    key: "beginner",
    label: "Beginner",
    vocabulary: "simpel",
    encouragement: "hoog",
    detail: "uitgebreid",
  },
  ervaren: {
    key: "ervaren",
    label: "Ervaren renner",
    vocabulary: "technisch",
    encouragement: "laag",
    detail: "kort",
  },
  jeugdrenner: {
    key: "jeugdrenner",
    label: "Jeugdrenner",
    vocabulary: "simpel",
    encouragement: "hoog",
    detail: "normaal",
  },
  ouder: {
    key: "ouder",
    label: "Ouder",
    vocabulary: "normaal",
    encouragement: "normaal",
    detail: "normaal",
  },
  trainer: {
    key: "trainer",
    label: "Trainer",
    vocabulary: "technisch",
    encouragement: "laag",
    detail: "uitgebreid",
  },
  topsporter: {
    key: "topsporter",
    label: "Topsporter",
    vocabulary: "technisch",
    encouragement: "laag",
    detail: "normaal",
  },
};

export type PersonalityInput = {
  birthYear?: number | null;
  birthDate?: string | null;
  experienceLevel?: string | null;
  competitionLevel?: string | null;
  activeRole?: string | null;
  /** Override "now" for deterministic age maths in tests. */
  today?: Date;
};

/**
 * Resolve the coaching personality from the athlete's real profile. Precedence:
 * the viewing role first (a parent/coach reads differently), then youth age, then
 * competition level, then training experience. Falls back to Beginner — the
 * safest, most explanatory voice — when there is no evidence yet. Deterministic.
 */
export function resolvePersonality(input: PersonalityInput): Personality {
  const role = input.activeRole ?? "athlete";
  if (role === "parent") return withBasis("ouder", "je kijkt mee als ouder");
  if (role === "coach") return withBasis("trainer", "je kijkt mee als trainer");

  const now = input.today ?? new Date();
  const age = computeAge(input.birthDate, input.birthYear, now);
  if (age != null && age <= 18) {
    return withBasis("jeugdrenner", `je bent ${age} jaar — nog jeugdrenner`);
  }

  const comp = (input.competitionLevel ?? "").toLowerCase();
  if (comp === "national") {
    return withBasis("topsporter", "je rijdt op nationaal niveau");
  }

  const exp = (input.experienceLevel ?? "").toLowerCase();
  if (exp === "advanced" || exp === "elite") {
    return withBasis("ervaren", `je traint op ${exp}-niveau`);
  }
  if (comp === "regional" || comp === "local") {
    return withBasis("ervaren", `je rijdt wedstrijden op ${comp}-niveau`);
  }
  if (exp === "beginner") {
    return withBasis("beginner", "je bent net begonnen met gericht trainen");
  }

  return withBasis("beginner", "Sparki kent je nog niet goed genoeg");
}

function withBasis(key: PersonalityKey, basis: string): Personality {
  return { ...DEFS[key], basis };
}

/**
 * Render a term at the right level for this personality: a technical reader gets
 * the precise term, everyone else gets the plain-language version. Used so the
 * same observation reads naturally for a youth rider and an experienced racer.
 */
export function term(p: Personality, technical: string, plain: string): string {
  return p.vocabulary === "technisch" ? technical : plain;
}

/** A short closing nudge for personalities that value encouragement; else "". */
export function encouragementLine(p: Personality): string {
  if (p.encouragement !== "hoog") return "";
  return p.key === "jeugdrenner"
    ? "Goed bezig — stap voor stap word je sterker."
    : "Je doet het goed; elke nette stap telt mee.";
}
