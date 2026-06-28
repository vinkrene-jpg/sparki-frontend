// Sparki World — adaptive feed scoring (pure).
//
// Ranks already-validated posts for one viewer over many signals, with NO I/O so
// it is fully unit-testable and deterministic for a given input. Signals:
//   • recency        — newer posts rank higher (smooth decay)
//   • follow/fav     — the viewer explicitly follows (favorite weighs more)
//   • profile match  — the post athlete's discipline matches the viewer's own
//   • learned affinity — what the viewer's behaviour revealed they like, across
//                        discipline/archetype/role/expertise/cohort/level/topic
//   • influence      — believable follower reach / hero tier (a gentle boost so
//                      world stars surface without ever dominating)
//
// The wall to real performance data holds: the only "profile" signal is the
// viewer's self-declared discipline; everything else is in-world behaviour.

export type AffinityIndex = Map<string, Map<string, { score: number; support: number }>>;

export type FeedScoreInput = {
  athleteId: number;
  publishedAtMs: number | null;
  discipline: string | null;
  archetype: string | null;
  role: string | null; // peer | inspiration | specialist | expert
  expertise: string | null;
  cohort: string | null;
  level: string | null;
  postKind: string;
  followerScore: number;
  influenceCategory: string | null; // wereldster | prof | bekend | lokaal | beginner
};

export type FeedScoreContext = {
  nowMs: number;
  myDiscipline: string; // lowercase, "" if unknown
  follow: Map<number, boolean>; // athleteId -> favorite?
  affinity: AffinityIndex;
  // Largest single affinity score, used to normalise affinity contributions.
  affinityMax: number;
};

export type FeedScoreBreakdown = {
  total: number;
  recency: number;
  follow: number;
  profile: number;
  affinity: number;
  influence: number;
};

// Component caps (keep any one signal from overwhelming the rest).
const RECENCY_MAX = 40;
const RECENCY_HALFLIFE_H = 36; // hours until recency halves
const FOLLOW = 50;
const FAVORITE = 80;
const PROFILE_MATCH = 25;
const AFFINITY_MAX = 60;
const INFLUENCE_MAX = 15;

// Which post attribute feeds which affinity dimension, and its relative pull.
const AFFINITY_DIMS: Array<{ dim: string; field: keyof FeedScoreInput; weight: number }> = [
  { dim: "discipline", field: "discipline", weight: 1.0 },
  { dim: "archetype", field: "archetype", weight: 0.9 },
  { dim: "role", field: "role", weight: 0.6 },
  { dim: "expertise", field: "expertise", weight: 0.8 },
  { dim: "cohort", field: "cohort", weight: 1.0 },
  { dim: "level", field: "level", weight: 0.5 },
  { dim: "topic", field: "postKind", weight: 0.7 },
];

function recencyScore(publishedAtMs: number | null, nowMs: number): number {
  if (publishedAtMs == null) return 0;
  const ageH = Math.max(0, (nowMs - publishedAtMs) / 3.6e6);
  // Exponential decay: full marks fresh, halves every RECENCY_HALFLIFE_H hours.
  return RECENCY_MAX * Math.pow(0.5, ageH / RECENCY_HALFLIFE_H);
}

function influenceScore(followerScore: number, category: string | null): number {
  // Log-scaled follower reach (a few dozen → millions) mapped into [0, ~1].
  const reach = followerScore > 0 ? Math.log10(followerScore + 10) / 7 : 0; // log10(1e7)=7
  const tier =
    category === "wereldster" ? 1
    : category === "prof" ? 0.7
    : category === "bekend" ? 0.45
    : category === "lokaal" ? 0.2
    : 0.05;
  return INFLUENCE_MAX * Math.min(1, 0.5 * reach + 0.5 * tier);
}

function affinityScore(input: FeedScoreInput, ctx: FeedScoreContext): number {
  if (ctx.affinityMax <= 0) return 0;
  let sum = 0;
  let weightSum = 0;
  for (const { dim, field, weight } of AFFINITY_DIMS) {
    const raw = input[field];
    const key = raw == null ? "" : String(raw).trim().toLowerCase();
    if (!key) continue;
    const hit = ctx.affinity.get(dim)?.get(key);
    weightSum += weight;
    if (hit) sum += weight * (hit.score / ctx.affinityMax);
  }
  if (weightSum <= 0) return 0;
  // Normalise by the maximum possible weighted pull so the cap is meaningful.
  return AFFINITY_MAX * (sum / weightSum);
}

export function scoreFeedItem(input: FeedScoreInput, ctx: FeedScoreContext): FeedScoreBreakdown {
  const recency = recencyScore(input.publishedAtMs, ctx.nowMs);

  let follow = 0;
  if (ctx.follow.has(input.athleteId)) {
    follow = ctx.follow.get(input.athleteId) ? FAVORITE : FOLLOW;
  }

  let profile = 0;
  if (
    ctx.myDiscipline &&
    input.discipline &&
    (ctx.myDiscipline.includes(input.discipline.toLowerCase()) ||
      input.discipline.toLowerCase().includes(ctx.myDiscipline))
  ) {
    profile = PROFILE_MATCH;
  }

  const affinity = affinityScore(input, ctx);
  const influence = influenceScore(input.followerScore, input.influenceCategory);

  const total = recency + follow + profile + affinity + influence;
  return { total, recency, follow, profile, affinity, influence };
}

// True when the viewer has enough in-world signal for personalisation to mean
// something. Below this we fall back to an honest recency+influence ranking.
export function hasPersonalSignal(ctx: FeedScoreContext): boolean {
  return ctx.follow.size > 0 || ctx.affinityMax > 0 || ctx.myDiscipline.length > 0;
}
