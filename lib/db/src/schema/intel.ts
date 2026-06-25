import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Performance Intelligence — Sparki's editorial, INTERACTIVE knowledge module
// (myth busters, peloton trends, gear comparisons, mini-masterclasses, debates).
//
// This is intentionally DISTINCT from `knowledge_items` (the research/news
// library): those rows link to external papers; these rows are structured,
// interactive editorial cards with per-kind fields the UI renders directly.
//
// DATA-HONESTY CONTRACT: every card is real, curated content with a stated
// `sourceLabel` (provenance). No fabricated specs or numbers — a Gear Wars
// attribute we cannot source is stored as null and shown as "—", never guessed.
// Confidence fields on trends/debates express an HONEST certainty level, never
// fake precision. The `dedupeKey` makes future automated ingestion idempotent.

export const intelCardKinds = [
  "myth_buster",
  "trend",
  "gear_compare",
  "academy",
  "debate",
] as const;
export type IntelCardKind = (typeof intelCardKinds)[number];

// Topic taxonomy (Dutch, athlete-facing). Drives search + topic filters and the
// "welke onderwerpen interesseren deze sporter" personalisation signal.
export const intelTopics = [
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
export type IntelTopic = (typeof intelTopics)[number];

// Targeting vocabulary. "all" means the card is relevant to every athlete of
// that axis; specific values let the engine rank a card higher for a matching
// athlete (a mountainbiker sees MTB cards first; an elite sees elite cards).
export const intelDisciplines = [
  "all",
  "road",
  "mtb",
  "gravel",
  "cyclocross",
  "track",
  "triathlon",
] as const;
export type IntelDiscipline = (typeof intelDisciplines)[number];

export const intelLevels = [
  "all",
  "beginner",
  "intermediate",
  "advanced",
  "elite",
] as const;
export type IntelLevel = (typeof intelLevels)[number];

export const intelConfidences = ["low", "medium", "high"] as const;
export type IntelConfidence = (typeof intelConfidences)[number];

export const mythAnswers = ["waar", "niet_waar", "hangt_ervan_af"] as const;
export type MythAnswer = (typeof mythAnswers)[number];

// ── Per-kind structured content (stored in the `content` jsonb column) ────────

export type MythBusterContent = {
  // The claim the athlete judges.
  statement: string;
  // The honest verdict revealed after the athlete answers.
  answer: MythAnswer;
  // Short plain-Dutch explanation of the verdict.
  explanation: string;
  // The science behind it (real mechanism, no fabricated study numbers).
  science: string;
  // How to apply it in your own training/riding.
  application: string;
  // Why this matters generally (the engine adds a per-athlete "voor jou" line).
  relevance: string;
};

export type TrendContent = {
  whatChanges: string;
  why: string;
  pros: string[];
  cons: string[];
  // Honest certainty that this trend holds + a plain-Dutch reason for it.
  confidence: IntelConfidence;
  confidenceNote: string;
};

export type GearAttribute = {
  label: string;
  unit?: string;
  // Real published value, or null → rendered as "—" (never guessed).
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
  // No winner is declared — context for when each option fits best.
  verdict: string;
};

export type AcademyContent = {
  // Two-tier: the short, directly readable version first; depth on demand.
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
  // True when there is real scientific consensus; false when it stays a debate.
  hasConsensus: boolean;
};

export type IntelCardContent =
  | MythBusterContent
  | TrendContent
  | GearCompareContent
  | AcademyContent
  | DebateContent;

export const intelCardsTable = pgTable(
  "intel_cards",
  {
    id: serial("id").primaryKey(),
    // Stable de-dup key so future automated ingestion is idempotent.
    dedupeKey: text("dedupe_key").notNull().unique(),
    kind: text("kind").notNull(),
    topic: text("topic").notNull(),
    title: text("title").notNull(),
    // Short teaser/dek shown on the card before drill-in.
    summary: text("summary").notNull(),
    // Per-kind structured body (see types above).
    content: jsonb("content").$type<IntelCardContent>().notNull(),
    // Targeting tags (subset of vocab; ["all"] = everyone).
    disciplines: text("disciplines").array().notNull().default(["all"]),
    levels: text("levels").array().notNull().default(["all"]),
    // Provenance — every factual card states where its content comes from.
    sourceLabel: text("source_label").notNull(),
    sourceUrl: text("source_url"),
    status: text("status").notNull().default("published"),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("intel_cards_kind_idx").on(t.kind),
    index("intel_cards_topic_idx").on(t.topic),
    index("intel_cards_status_published_idx").on(t.status, t.publishedAt),
    index("intel_cards_disciplines_idx").using("gin", t.disciplines),
  ],
);

// Per-athlete interaction with a card: favorites/read-later/interesting flags and
// the myth-buster answer the athlete gave. One row per (athlete, card). Real
// signals only — Sparki learns popular topics by aggregating these rows, never
// by inventing engagement.
export const intelInteractionsTable = pgTable(
  "intel_interactions",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    cardId: integer("card_id")
      .notNull()
      .references(() => intelCardsTable.id, { onDelete: "cascade" }),
    saved: boolean("saved").notNull().default(false),
    readLater: boolean("read_later").notNull().default(false),
    interesting: boolean("interesting").notNull().default(false),
    // Myth Buster only: the answer the athlete picked + whether it was correct.
    mythAnswer: text("myth_answer"),
    mythCorrect: boolean("myth_correct"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("intel_interactions_clerk_card_uniq").on(t.clerkId, t.cardId),
    index("intel_interactions_clerk_idx").on(t.clerkId),
    index("intel_interactions_card_idx").on(t.cardId),
  ],
);

export const insertIntelCardSchema = createInsertSchema(intelCardsTable).omit({
  id: true,
});
export const selectIntelCardSchema = createSelectSchema(intelCardsTable);
export const insertIntelInteractionSchema = createInsertSchema(
  intelInteractionsTable,
).omit({ id: true });
export const selectIntelInteractionSchema = createSelectSchema(
  intelInteractionsTable,
);

export type IntelCard = typeof intelCardsTable.$inferSelect;
export type InsertIntelCard = z.infer<typeof insertIntelCardSchema>;
export type IntelInteraction = typeof intelInteractionsTable.$inferSelect;
export type InsertIntelInteraction = z.infer<
  typeof insertIntelInteractionSchema
>;
