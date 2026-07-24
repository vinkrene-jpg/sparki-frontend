import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  date,
  uniqueIndex,
  unique,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./users";
import { knowledgeItemsTable } from "./knowledge";

// ---------------------------------------------------------------------------
// Sparki Foundation — additive tables for the AI Foundation layer.
//
// 1) knowledge_evidence: scientific-evidence metadata layered ON TOP of the
//    existing knowledge tables (knowledge_items / managed_knowledge_items).
//    Nothing is duplicated: DOI/author/source/publishedAt stay on the item
//    itself; this table only carries what did not exist yet (evidence level,
//    quality score, validity window, conflicts, curated tags, review notes).
// 2) athlete_model_extensions: automatically-extensible key/value layer of the
//    dynamic athlete model. Structured profile fields keep living in
//    athlete_profiles; new model dimensions land here without a migration.
// ---------------------------------------------------------------------------

export const evidenceLevels = [
  "meta-analyse",
  "rct",
  "cohort",
  "case-study",
  "expert-opinie",
  "onbekend",
] as const;
export type EvidenceLevel = (typeof evidenceLevels)[number];

// Which knowledge store the evidence row annotates.
export const evidenceSubjectKinds = ["knowledge_item", "managed_item"] as const;
export type EvidenceSubjectKind = (typeof evidenceSubjectKinds)[number];

export const knowledgeEvidenceTable = pgTable(
  "knowledge_evidence",
  {
    id: serial("id").primaryKey(),
    subjectKind: text("subject_kind").notNull().default("knowledge_item"),
    // FK only enforceable for knowledge_items; managed items are referenced by id
    // via subjectKind (checked in code) to keep this table additive.
    knowledgeItemId: integer("knowledge_item_id").references(
      () => knowledgeItemsTable.id,
      { onDelete: "cascade" },
    ),
    managedItemId: integer("managed_item_id"),
    evidenceLevel: text("evidence_level").notNull().default("onbekend"),
    // 0..100 — deterministic quality score with the scoring version recorded.
    qualityScore: integer("quality_score"),
    scoringVersion: text("scoring_version"),
    validFrom: date("valid_from"),
    validUntil: date("valid_until"),
    // Ids of knowledge_evidence rows this row conflicts with + a short reason.
    conflictsWith: jsonb("conflicts_with")
      .$type<Array<{ evidenceId: number; reden: string }>>()
      .notNull()
      .default([]),
    tags: text("tags").array().notNull().default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // nullsNotDistinct: exactly one evidence row per subject — a NULL
    // managed/knowledge id would otherwise never conflict (NULLs distinct).
    unique("knowledge_evidence_subject_uq")
      .on(t.subjectKind, t.knowledgeItemId, t.managedItemId)
      .nullsNotDistinct(),
  ],
);

export type KnowledgeEvidence = typeof knowledgeEvidenceTable.$inferSelect;
export type NewKnowledgeEvidence = typeof knowledgeEvidenceTable.$inferInsert;

// ---------------------------------------------------------------------------
// Dynamic athlete-model extensions (key/value, jsonb value).
// ---------------------------------------------------------------------------

export const athleteModelExtensionsTable = pgTable(
  "athlete_model_extensions",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Namespaced dimension key, e.g. "voorkeuren.informatie" or "leerstijl".
    key: text("key").notNull(),
    value: jsonb("value").$type<unknown>().notNull(),
    // Where this value came from (engine name, "sporter", connector, …).
    source: text("source").notNull().default("onbekend"),
    confidence: real("confidence"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("athlete_model_extensions_user_key_uq").on(t.clerkId, t.key),
  ],
);

export type AthleteModelExtension =
  typeof athleteModelExtensionsTable.$inferSelect;
export type NewAthleteModelExtension =
  typeof athleteModelExtensionsTable.$inferInsert;
