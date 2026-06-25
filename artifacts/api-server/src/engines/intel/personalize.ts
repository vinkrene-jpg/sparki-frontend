// Deterministic personalisation for the Performance Intelligence Hub.
//
// Pure, side-effect-free ranking: given an athlete's real profile signals and a
// set of intel cards, decide the order and produce an HONEST plain-Dutch "voor
// jou" reason for every card. Every reason cites a real matched signal (your
// discipline, your level, a topic you engaged with). When nothing specific
// matches we say so plainly ("Algemeen relevant voor elke renner") — we never
// fabricate a personal connection. This module has no DB access so it is unit
// testable in isolation.

import type {
  IntelCard,
  IntelDiscipline,
  IntelLevel,
  IntelTopic,
} from "@workspace/db";

export type IntelAthleteContext = {
  discipline: IntelDiscipline | null;
  disciplineLabel: string | null;
  level: IntelLevel | null;
  levelLabel: string | null;
  // Youth riders / true beginners get the simpler framing surfaced first.
  simplify: boolean;
  // Topics the athlete has shown real interest in (goals, self-claim, or by
  // marking earlier cards interesting), each with the reason we inferred it.
  topicInterests: Map<IntelTopic, string>;
};

export type RankedCard = {
  card: IntelCard;
  score: number;
  // Honest, plain-Dutch reason this card is shown to THIS athlete.
  reason: string;
  // Whether the reason reflects a real personal match (vs. generic relevance).
  personalised: boolean;
};

const DISCIPLINE_LABELS: Record<IntelDiscipline, string> = {
  all: "alle disciplines",
  road: "weg",
  mtb: "mountainbike",
  gravel: "gravel",
  cyclocross: "veldrijden",
  track: "baan",
  triathlon: "triatlon",
};

const LEVEL_LABELS: Record<IntelLevel, string> = {
  all: "elk niveau",
  beginner: "beginner",
  intermediate: "gevorderd",
  advanced: "ervaren",
  elite: "elite",
};

const TOPIC_LABELS: Record<IntelTopic, string> = {
  materiaal: "materiaal",
  voeding: "voeding",
  training: "training",
  aerodynamica: "aerodynamica",
  herstel: "herstel",
  slaap: "slaap",
  wetenschap: "wetenschap",
  wedstrijden: "wedstrijden",
  mentaal: "mentale aspecten",
};

// Plain-Dutch keyword cues per topic, matched against the athlete's free-text
// goals/motivation. Word-boundary matched to avoid substring traps.
const TOPIC_KEYWORDS: Record<IntelTopic, string[]> = {
  materiaal: ["materiaal", "fiets", "wielen", "banden", "versnelling", "afstelling", "zadel"],
  voeding: ["voeding", "eten", "gel", "koolhydraten", "afvallen", "gewicht", "hydratatie"],
  training: ["training", "drempel", "ftp", "intervallen", "vermogen", "watt", "conditie"],
  aerodynamica: ["aero", "aerodynamica", "positie", "tijdrit", "snelheid"],
  herstel: ["herstel", "rust", "vermoeidheid", "recovery", "regeneratie"],
  slaap: ["slaap", "slapen", "nachtrust"],
  wetenschap: ["wetenschap", "onderzoek", "studie"],
  wedstrijden: ["wedstrijd", "race", "koers", "criterium", "fondo", "klassieker", "winnen"],
  mentaal: ["mentaal", "focus", "stress", "motivatie", "kopzorg", "zenuwen"],
};

const SELF_TYPE_TOPICS: Record<string, IntelTopic[]> = {
  sprinter: ["aerodynamica", "materiaal", "wedstrijden"],
  diesel: ["training", "herstel"],
  alleskunner: ["training"],
};

export function normalizeDiscipline(raw: string | null): IntelDiscipline | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (/(mountain|mtb|atb)/.test(s)) return "mtb";
  if (/gravel/.test(s)) return "gravel";
  if (/(veld|cyclo|cross)/.test(s)) return "cyclocross";
  if (/(baan|track|piste)/.test(s)) return "track";
  if (/(tri|duathlon)/.test(s)) return "triathlon";
  if (/(weg|road|race|wielren|koers)/.test(s)) return "road";
  return null;
}

export function normalizeLevel(raw: string | null): IntelLevel | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (["beginner", "intermediate", "advanced", "elite"].includes(s)) {
    return s as IntelLevel;
  }
  return null;
}

export function disciplineLabel(d: IntelDiscipline): string {
  return DISCIPLINE_LABELS[d] ?? d;
}

export function levelLabel(l: IntelLevel): string {
  return LEVEL_LABELS[l] ?? l;
}

export function topicLabel(t: IntelTopic): string {
  return TOPIC_LABELS[t] ?? t;
}

function matchesKeyword(haystack: string, keyword: string): boolean {
  return new RegExp(`\\b${keyword}\\b`, "i").test(haystack);
}

// Infer topic interests from real, athlete-provided signals only. `engagedTopics`
// are topics from cards the athlete actively marked interesting/saved.
export function inferTopicInterests(opts: {
  goals: string | null;
  motivation: string | null;
  selfType: string | null;
  engagedTopics: IntelTopic[];
}): Map<IntelTopic, string> {
  const interests = new Map<IntelTopic, string>();
  const freeText = [opts.goals, opts.motivation].filter(Boolean).join(" ");

  if (freeText.trim()) {
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS) as [
      IntelTopic,
      string[],
    ][]) {
      if (keywords.some((k) => matchesKeyword(freeText, k))) {
        interests.set(topic, `Sluit aan bij je doel rond ${TOPIC_LABELS[topic]}`);
      }
    }
  }

  if (opts.selfType) {
    for (const topic of SELF_TYPE_TOPICS[opts.selfType] ?? []) {
      if (!interests.has(topic)) {
        interests.set(topic, `Past bij jouw type renner`);
      }
    }
  }

  for (const topic of opts.engagedTopics) {
    interests.set(
      topic,
      `Omdat je eerder interesse toonde in ${TOPIC_LABELS[topic]}`,
    );
  }

  return interests;
}

// Score a single card for the athlete. Higher = more relevant. The reason always
// reflects the dominant matched signal honestly.
function scoreCard(
  card: IntelCard,
  ctx: IntelAthleteContext,
  alreadyEngaged: boolean,
): { score: number; reason: string; personalised: boolean } {
  let score = 0;
  let reason = "Algemeen relevant voor elke renner";
  let personalised = false;
  // Track the strongest reason by the points it contributed.
  let bestReasonWeight = 0;

  const disciplines = (card.disciplines ?? []) as IntelDiscipline[];
  const levels = (card.levels ?? []) as IntelLevel[];
  const topic = card.topic as IntelTopic;

  // Discipline match (strongest personal signal).
  if (ctx.discipline && disciplines.includes(ctx.discipline)) {
    score += 4;
    if (4 > bestReasonWeight) {
      bestReasonWeight = 4;
      reason = `Past bij jouw discipline (${ctx.disciplineLabel})`;
      personalised = true;
    }
  } else if (disciplines.includes("all")) {
    score += 0.5;
  }

  // Topic interest match.
  const topicReason = ctx.topicInterests.get(topic);
  if (topicReason) {
    score += 3;
    if (3 > bestReasonWeight) {
      bestReasonWeight = 3;
      reason = topicReason;
      personalised = true;
    }
  }

  // Level match.
  if (ctx.level && levels.includes(ctx.level)) {
    score += 2;
    if (2 > bestReasonWeight) {
      bestReasonWeight = 2;
      reason = `Afgestemd op jouw niveau (${ctx.levelLabel})`;
      personalised = true;
    }
  } else if (levels.includes("all")) {
    score += 0.3;
  }

  // Depth fit for youth (<16) / true beginners: surface accessible cards first
  // and gently push purely advanced/elite material down. Deterministic, bounded
  // so it never overrides a real discipline/topic/level match above.
  if (ctx.simplify) {
    const accessible = levels.includes("beginner") || levels.includes("all");
    const onlyAdvanced =
      levels.length > 0 &&
      levels.every((l) => l === "advanced" || l === "elite");
    if (accessible) score += 1;
    if (onlyAdvanced) score -= 1;
  }

  // Light recency tiebreaker (newer first), bounded so it never overrides match.
  const ageDays =
    (Date.now() - new Date(card.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 1 - ageDays / 365) * 0.4;

  // Surface fresh content: gently downrank cards the athlete already engaged
  // with so the feed keeps offering something new (never hidden entirely).
  if (alreadyEngaged) score -= 1.5;

  return { score, reason, personalised };
}

export function rankCards(
  cards: IntelCard[],
  ctx: IntelAthleteContext,
  engagedCardIds: Set<number>,
): RankedCard[] {
  return cards
    .map((card) => {
      const { score, reason, personalised } = scoreCard(
        card,
        ctx,
        engagedCardIds.has(card.id),
      );
      return { card, score, reason, personalised };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Stable, deterministic tiebreak by recency then id.
      const at = new Date(a.card.publishedAt).getTime();
      const bt = new Date(b.card.publishedAt).getTime();
      if (bt !== at) return bt - at;
      return b.card.id - a.card.id;
    });
}
