// AIE2 F1 — Adviesdossier (AIE2-27 t/m AIE2-31).
//
// Elk NIEUW advies krijgt één dossier-rij met twintig inhoudelijke velden.
// Het dossier VERWIJST naar bestaande onderbouwing (source-quality,
// data-origin, KENNIS_01, observaties) en dupliceert die niet (F0 §7.3).
// Bestaande adviezen worden nooit met verzonnen waarden aangevuld: een
// advies zonder dossier is per definitie LEGACY_NIET_VOLLEDIG_HERLEIDBAAR
// (afgeleid bij lezen, geen backfill — AIE2-29).

import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const adviceDossiersTable = pgTable(
  "advice_dossiers",
  {
    id: serial("id").primaryKey(),
    clerkId: varchar("clerk_id", { length: 64 }).notNull(),

    // 1–4: wat is het advies
    adviceType: varchar("advice_type", { length: 48 }).notNull(), // register in api-server lib
    adviceKey: varchar("advice_key", { length: 160 }).notNull(), // stabiele verwijzing naar het advies zelf
    title: text("title").notNull(),
    adviceText: text("advice_text").notNull(),

    // 5–9: waarop gebaseerd
    basedOn: jsonb("based_on").notNull(), // concrete datapunten [{kind,label,value,date}]
    sourcesUsed: jsonb("sources_used").notNull(), // source-quality keys
    sourcesExcluded: jsonb("sources_excluded").notNull(), // uitgesloten bronnen + reden
    rulesApplied: jsonb("rules_applied").notNull(), // deterministische regel-ids
    knowledgeRefs: jsonb("knowledge_refs").notNull(), // KENNIS_01 evidence-ids + versie

    // 10–11: zekerheid (nooit als score naar de gebruiker — AIE2-09)
    confidenceFactors: jsonb("confidence_factors").notNull(), // interne factoren
    confidenceLevel: varchar("confidence_level", { length: 24 }).notNull(), // 4 taalniveaus

    // 12–14: afweging (12–13 zijn de structureel vergeten velden, AIE2-27)
    alternativesConsidered: jsonb("alternatives_considered").notNull(),
    whyAlternativeRejected: text("why_alternative_rejected").notNull(),
    risks: jsonb("risks").notNull(),

    // 15–17: reikwijdte en totstandkoming
    validUntil: timestamp("valid_until"), // null = geen natuurlijke houdbaarheid
    computedBy: jsonb("computed_by").notNull(), // engines + versies in de keten
    aiInvolvement: jsonb("ai_involvement").notNull(), // {used:boolean, purpose?} — metadata-only

    // 18–20: doorwerking en uitkomst
    audience: varchar("audience", { length: 24 }).notNull().default("sporter"),
    outcome: text("outcome"), // "latere uitkomst" (AIE2-27) — later ingevuld, nooit verzonnen
    outcomeAt: timestamp("outcome_at"),

    status: varchar("status", { length: 40 }).notNull().default("actief"), // actief | vervallen
    dedupeKey: varchar("dedupe_key", { length: 200 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("advice_dossiers_dedupe_idx").on(t.dedupeKey),
    index("advice_dossiers_user_idx").on(t.clerkId, t.adviceType, t.createdAt),
    index("advice_dossiers_key_idx").on(t.clerkId, t.adviceKey),
  ],
);

export type AdviceDossierRow = typeof adviceDossiersTable.$inferSelect;
export type AdviceDossierInsert = typeof adviceDossiersTable.$inferInsert;
