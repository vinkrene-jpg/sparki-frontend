// Sparki World — deterministic multi-year career & relationship dynamics (pure).
//
// Given an athlete (from the population generator) this builds a believable
// season-by-season life story: the phases they moved through (jeugd → U23 →
// continentaal → prof → blessure → comeback → coach), how their FTP developed
// along a real age curve (rising into the late twenties, gently declining after,
// dipping around an injury), and the highs and lows worth flagging on a timeline.
//
// EVERYTHING here is deterministic and idempotent: the same athlete always gets
// the same career, so re-seeding never rewrites someone's past. The personality
// stays stable across the years (it lives on the athlete, not the timeline).
// Numbers are derived, never fabricated as real performance — this is fiction by
// construction (see the Sparki World honesty contract).

import type {
  GeneratedAthlete,
  CareerPhase,
  Level,
} from "./population";

// ── tiny deterministic rng (slug-stable, independent of the population rng) ────
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  private r: () => number;
  constructor(seed: number) {
    this.r = mulberry32(seed);
  }
  next(): number {
    return this.r();
  }
  int(min: number, max: number): number {
    return Math.floor(this.r() * (max - min + 1)) + min;
  }
  chance(p: number): boolean {
    return this.r() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.r() * arr.length)]!;
  }
}

// ── public types ─────────────────────────────────────────────────────────────
export type CareerEntryKind = "milestone" | "highlight" | "lowlight" | "normal";

export type CareerEntry = {
  seasonYear: number;
  ageThatYear: number;
  phase: CareerPhase;
  level: Level | null;
  team: string | null;
  ftp: number | null;
  kind: CareerEntryKind;
  title: string;
  summary: string | null;
};

export type RelationshipDynamics = {
  strength: number; // 1..100
  status: "active" | "faded" | "former";
};

// ── age → performance curve (relative to a ~28y peak) ────────────────────────
function ageFactor(age: number): number {
  if (age <= 18) return 0.78 + (age - 14) * 0.03; // 0.78 .. 0.90
  if (age <= 28) return 0.9 + (age - 18) * 0.01; // 0.90 .. 1.00
  return Math.max(0.78, 1.0 - (age - 28) * 0.012); // gentle decline
}

// How many seasons of history to tell for this athlete.
function careerStartAge(a: GeneratedAthlete, r: Rng): number {
  // Prof-track and specialists have a long story that starts in the youth.
  if (
    a.role === "inspiration" ||
    a.role === "specialist" ||
    a.careerPhase === "prof" ||
    a.careerPhase === "continentaal" ||
    a.careerPhase === "comeback"
  ) {
    return 15;
  }
  // Experts moved into coaching after an athletic past.
  if (a.role === "expert") return Math.max(16, a.age - r.int(14, 20));
  // Peers: a handful of seasons since they got into the sport.
  return Math.max(a.level === "jeugd" ? 12 : 16, a.age - r.int(3, 8));
}

// Which phase an athlete is living in at a given age, given their endpoint.
function phaseAtAge(
  a: GeneratedAthlete,
  age: number,
  injuryAge: number | null,
): CareerPhase {
  const profTrack =
    a.role === "inspiration" ||
    a.role === "specialist" ||
    a.careerPhase === "prof" ||
    a.careerPhase === "continentaal" ||
    a.careerPhase === "comeback";

  if (injuryAge !== null) {
    if (age === injuryAge) return "blessure";
    if (age === injuryAge + 1) return "comeback";
  }

  if (a.role === "expert") {
    // Athletic past, then the move to coaching in the most recent seasons.
    return age >= a.age - 2 ? "coach" : age <= 18 ? "jeugd" : "amateur";
  }

  if (profTrack) {
    if (age <= 18) return "jeugd";
    if (age <= 22) return "u23";
    if (age <= 24) return "continentaal";
    return "prof";
  }

  // Peers keep their everyday phase, with youth at the start.
  if (age <= 18) return "jeugd";
  if (a.careerPhase === "master") return "master";
  if (a.careerPhase === "recreant") return "recreant";
  return "amateur";
}

const PHASE_LABEL: Record<CareerPhase, string> = {
  jeugd: "jeugd",
  u23: "beloften (U23)",
  continentaal: "continentale ploeg",
  prof: "profcarrière",
  blessure: "blessurejaar",
  comeback: "comeback",
  coach: "coachrol",
  amateur: "amateur",
  recreant: "recreant",
  master: "master",
};

// ── career builder ───────────────────────────────────────────────────────────
export function buildCareer(
  a: GeneratedAthlete,
  currentSeasonYear: number,
): CareerEntry[] {
  const r = new Rng(fnv1a(`career:${a.slug}`));
  const startAge = Math.min(careerStartAge(a, r), a.age);

  // An injury dip for comeback stories (and occasionally for others).
  let injuryAge: number | null = null;
  if (a.careerPhase === "comeback" && a.age - startAge >= 3) {
    injuryAge = a.age - 1; // injury last year, comeback now
  } else if (a.age - startAge >= 5 && r.chance(0.25)) {
    injuryAge = startAge + r.int(2, Math.max(2, a.age - startAge - 2));
  }

  const entries: CareerEntry[] = [];
  let prevPhase: CareerPhase | null = null;
  let bestFtp = -1;
  let bestIdx = -1;

  for (let age = startAge; age <= a.age; age++) {
    const seasonYear = currentSeasonYear - (a.age - age);
    const phase = phaseAtAge(a, age, injuryAge);
    const yearsIn = age - startAge;
    const expRamp = Math.min(1, 0.82 + 0.035 * yearsIn);
    let ftp = Math.round(
      (a.ftp * ageFactor(age) * expRamp) / (ageFactor(a.age) || 1),
    );
    if (phase === "blessure") ftp = Math.round(ftp * 0.86);
    // The current season must land exactly on the athlete's known numbers.
    if (age === a.age) ftp = a.ftp;

    if (ftp > bestFtp && phase !== "blessure") {
      bestFtp = ftp;
      bestIdx = entries.length;
    }

    const isFirst = age === startAge;
    const isCurrent = age === a.age;
    const phaseChanged = prevPhase !== null && phase !== prevPhase;

    let kind: CareerEntryKind = "normal";
    let title = `Seizoen — ${PHASE_LABEL[phase]}`;
    let summary: string | null = null;

    if (isFirst) {
      kind = "milestone";
      title = "Eerste seizoen";
      summary = `Begon als ${PHASE_LABEL[phase]} in het wielrennen.`;
    } else if (phase === "blessure") {
      kind = "lowlight";
      title = "Blessurejaar";
      summary = "Een seizoen grotendeels aan de kant door een blessure.";
    } else if (phase === "comeback") {
      kind = "milestone";
      title = "Comeback";
      summary = "Stap voor stap terug op de fiets na een zwaar jaar.";
    } else if (phaseChanged) {
      kind = "milestone";
      title = `Naar de ${PHASE_LABEL[phase]}`;
      summary = `De overstap naar de ${PHASE_LABEL[phase]}.`;
    } else if (
      (phase === "prof" || phase === "continentaal") &&
      r.chance(0.4)
    ) {
      kind = "highlight";
      title = r.pick([
        "Sterk seizoen",
        "Knappe uitslagen",
        "Vorm op het juiste moment",
      ]);
      summary = "Een seizoen met resultaten om trots op te zijn.";
    }

    if (isCurrent) {
      kind = "milestone";
      title = "Dit seizoen";
      summary = `Nu actief als ${PHASE_LABEL[phase]}.`;
    }

    entries.push({
      seasonYear,
      ageThatYear: age,
      phase,
      level: isCurrent ? a.level : null,
      team: isCurrent ? a.team : null,
      ftp,
      kind,
      title,
      summary,
    });
    prevPhase = phase;
  }

  // Flag the single best (non-current) season as a highlight if not already.
  if (bestIdx >= 0 && bestIdx !== entries.length - 1) {
    const e = entries[bestIdx]!;
    if (e.kind === "normal") {
      e.kind = "highlight";
      e.title = "Beste vorm tot nu toe";
      e.summary = `Hoogste niveau in zijn/haar ontwikkeling tot dan toe.`;
    }
  }

  return entries;
}

// ── relationship strength & status (deterministic from shared context) ───────
// Stronger bonds come from shared team/discipline/age and the kind of tie;
// older, divergent pairs fade. Never deleted — history stays honest.
export function relationshipDynamics(
  from: GeneratedAthlete,
  to: GeneratedAthlete,
  kind: string,
): RelationshipDynamics {
  const key = [from.slug, to.slug].sort().join("|");
  const r = new Rng(fnv1a(`rel:${kind}:${key}`));

  let strength = 50;
  if (kind === "teammate") strength += 18;
  if (kind === "coach") strength += 22;
  if (kind === "family") strength += 30;
  if (kind === "friend") strength += 12;
  if (kind === "rival") strength += 6;

  if (from.team && from.team === to.team) strength += 12;
  if (from.discipline === to.discipline) strength += 6;
  if (Math.abs(from.age - to.age) <= 4) strength += 6;
  if (from.nationality === to.nationality) strength += 4;

  strength += r.int(-8, 8);
  strength = Math.max(1, Math.min(100, strength));

  // Status: weak or divergent bonds fade; some teammate/rival ties become
  // "former" when the athletes no longer share a team.
  let status: RelationshipDynamics["status"] = "active";
  const divergentTeam =
    (kind === "teammate" || kind === "rival") &&
    from.team !== to.team &&
    from.team !== null &&
    to.team !== null;
  if (strength < 30) status = "faded";
  if (divergentTeam && r.chance(0.4)) status = "former";

  return { strength, status };
}
