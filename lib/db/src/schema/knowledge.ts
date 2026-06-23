import {
  pgTable,
  serial,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Sparki Knowledge Base — a GLOBAL, shared library of real sport-science
// literature and sport/equipment news. This table is intentionally NOT keyed by
// clerkId: it is shared knowledge, not per-athlete data. Retrieval is
// personalised at query time from the athlete's context.
//
// DATA-HONESTY CONTRACT: every row must come from a real source. `url` (and
// `doi` when present) point at the actual publication; `abstract` is the real
// fetched abstract; `summary` is an AI summary of that real abstract — never an
// invented finding. The daily scan only summarises and tags content it fetched;
// it never fabricates articles, authors, journals, or results.

// Discipline tags (Dutch, matching the product taxonomy).
export const knowledgeDisciplines = [
  "sportwetenschap",
  "sportpsychologie",
  "psychologie",
  "voedingsleer",
  "fysiologie",
  "inspanningsfysiologie",
  "materiaal",
  "sportnieuws",
] as const;
export type KnowledgeDiscipline = (typeof knowledgeDisciplines)[number];

// Whether the item is peer-reviewed research/preprint or a news article.
export const knowledgeItemTypes = ["research", "news"] as const;
export type KnowledgeItemType = (typeof knowledgeItemTypes)[number];

// Which fetcher produced the item (provenance / debugging).
export const knowledgeProviders = [
  "europepmc",
  "crossref",
  "openalex",
  "semanticscholar",
  "arxiv",
  "rss",
] as const;
export type KnowledgeProvider = (typeof knowledgeProviders)[number];

export const knowledgeItemsTable = pgTable(
  "knowledge_items",
  {
    id: serial("id").primaryKey(),
    // Stable de-duplication key: DOI (preferred) → normalised URL → normalised
    // title. Unique so the daily scan is idempotent (upsert / skip).
    dedupeKey: text("dedupe_key").notNull().unique(),
    type: text("type").notNull().default("research"),
    provider: text("provider").notNull(),
    title: text("title").notNull(),
    // Real author names as fetched (may be empty for some news items).
    authors: text("authors").array().notNull().default([]),
    // Journal / publisher / feed name.
    source: text("source"),
    url: text("url").notNull(),
    doi: text("doi"),
    publishedAt: text("published_at"), // ISO date string (YYYY-MM-DD) or null
    // Real fetched abstract / excerpt.
    abstract: text("abstract"),
    // AI summary of the real abstract (Dutch, concise). Null until summarised.
    summary: text("summary"),
    // Discipline tags assigned by the AI tagger (subset of knowledgeDisciplines).
    disciplines: text("disciplines").array().notNull().default([]),
    // Raw query/topic that surfaced this item (provenance).
    sourceQuery: text("source_query"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
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
    index("knowledge_published_idx").on(t.publishedAt),
    index("knowledge_type_idx").on(t.type),
    index("knowledge_disciplines_idx").using("gin", t.disciplines),
  ],
);

export const insertKnowledgeItemSchema = createInsertSchema(
  knowledgeItemsTable,
).omit({ id: true });
export const selectKnowledgeItemSchema =
  createSelectSchema(knowledgeItemsTable);

export type KnowledgeItem = typeof knowledgeItemsTable.$inferSelect;
export type InsertKnowledgeItem = z.infer<typeof insertKnowledgeItemSchema>;
