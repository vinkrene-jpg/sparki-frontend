// Frontend mirror of the Performance Intelligence content model. These shapes
// match lib/db/src/schema/intel.ts exactly; we keep a local copy so the web app
// has no build-time dependency on api-server internals. The honesty contract
// holds on the client too: a null gear attribute renders as "—", never guessed.

export const INTEL_KINDS = [
  "myth_buster",
  "trend",
  "gear_compare",
  "academy",
  "debate",
] as const;
export type IntelKind = (typeof INTEL_KINDS)[number];

export const INTEL_TOPICS = [
  "materiaal",
  "voeding",
  "training",
  "aerodynamica",
  "herstel",
  "slaap",
  "wetenschap",
  "wedstrijden",
  "mentaal",
] as const;
export type IntelTopic = (typeof INTEL_TOPICS)[number];

export type MythAnswer = "waar" | "niet_waar" | "hangt_ervan_af";
export type IntelConfidence = "low" | "medium" | "high";

export type MythBusterContent = {
  statement: string;
  answer: MythAnswer;
  explanation: string;
  science: string;
  application: string;
  relevance: string;
};

export type TrendContent = {
  whatChanges: string;
  why: string;
  pros: string[];
  cons: string[];
  confidence: IntelConfidence;
  confidenceNote: string;
};

export type GearAttribute = {
  label: string;
  unit?: string;
  a: string | null;
  b: string | null;
  note?: string;
};

export type GearCompareContent = {
  productA: string;
  productB: string;
  attributes: GearAttribute[];
  strengthsA: string[];
  strengthsB: string[];
  weaknessesA: string[];
  weaknessesB: string[];
  verdict: string;
};

export type AcademyContent = {
  simple: string;
  deep: string;
  example: string;
  conclusion: string;
  readMinutes: number;
};

export type DebateContent = {
  proposition: string;
  argumentFor: string;
  argumentAgainst: string;
  science: string;
  proTeams: string;
  conclusion: string;
  hasConsensus: boolean;
};

export type IntelCardContent =
  | MythBusterContent
  | TrendContent
  | GearCompareContent
  | AcademyContent
  | DebateContent;

export type IntelCard = {
  id: number;
  dedupeKey: string;
  kind: IntelKind;
  topic: IntelTopic;
  title: string;
  summary: string;
  content: IntelCardContent;
  disciplines: string[];
  levels: string[];
  sourceLabel: string;
  sourceUrl: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IntelInteractionState = {
  saved: boolean;
  readLater: boolean;
  interesting: boolean;
  mythAnswer: MythAnswer | null;
  mythCorrect: boolean | null;
};

export type IntelFeedItem = {
  card: IntelCard;
  // Honest, plain-Dutch reason this card is shown to this athlete.
  reason: string;
  // Whether the reason reflects a real personal match (vs. generic relevance).
  personalised: boolean;
  interaction: IntelInteractionState;
};

export type IntelMeta = {
  kinds: IntelKind[];
  topics: IntelTopic[];
};

// ── Athlete-facing labels (plain Dutch, no "AI", no English jargon) ──────────

export const KIND_LABEL: Record<IntelKind, string> = {
  myth_buster: "Waar of niet waar",
  trend: "Trend in het peloton",
  gear_compare: "Materiaal naast elkaar",
  academy: "Sparki Academie",
  debate: "Het debat",
};

export const KIND_SHORT: Record<IntelKind, string> = {
  myth_buster: "Mythe",
  trend: "Trend",
  gear_compare: "Materiaal",
  academy: "Academie",
  debate: "Debat",
};

export const TOPIC_LABEL: Record<IntelTopic, string> = {
  materiaal: "Materiaal",
  voeding: "Voeding",
  training: "Training",
  aerodynamica: "Aerodynamica",
  herstel: "Herstel",
  slaap: "Slaap",
  wetenschap: "Wetenschap",
  wedstrijden: "Wedstrijden",
  mentaal: "Mentaal",
};

export const MYTH_ANSWER_LABEL: Record<MythAnswer, string> = {
  waar: "Waar",
  niet_waar: "Niet waar",
  hangt_ervan_af: "Hangt ervan af",
};

export const CONFIDENCE_LABEL: Record<IntelConfidence, string> = {
  low: "Voorzichtig",
  medium: "Redelijk zeker",
  high: "Sterk onderbouwd",
};

// Type guards so each card component reads its own content shape safely.
export function isMyth(c: IntelCard): c is IntelCard & { content: MythBusterContent } {
  return c.kind === "myth_buster";
}
export function isTrend(c: IntelCard): c is IntelCard & { content: TrendContent } {
  return c.kind === "trend";
}
export function isGear(c: IntelCard): c is IntelCard & { content: GearCompareContent } {
  return c.kind === "gear_compare";
}
export function isAcademy(c: IntelCard): c is IntelCard & { content: AcademyContent } {
  return c.kind === "academy";
}
export function isDebate(c: IntelCard): c is IntelCard & { content: DebateContent } {
  return c.kind === "debate";
}
