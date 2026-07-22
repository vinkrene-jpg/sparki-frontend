import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Golf 21 — Beheerde kennislaag ("kennisbank-governance").
//
// Dit is GEEN tweede kennisbank naast knowledge_items: knowledge_items blijft
// de automatisch gescande literatuur/nieuws-bibliotheek; deze tabellen voegen
// er de BEHEERDE vaklaag aan toe: door een beheerder gecontroleerde
// kennisitems met status, versie, betrouwbaarheid en herleidbaar gebruik.
// Eerlijkheidscontract: Sparki gebruikt voor nieuw advies uitsluitend items
// met status "actief"; verouderde/ingetrokken kennis wordt nooit opnieuw
// gebruikt, maar historisch gebruik blijft via knowledge_usage_events
// herleidbaar naar de exacte versie van dat moment.

export const managedKnowledgeDomains = [
  "training",
  "herstel",
  "voeding",
  "materiaal",
  "wedstrijd",
  "veiligheid",
] as const;
export type ManagedKnowledgeDomain = (typeof managedKnowledgeDomains)[number];

export const managedKnowledgeStatuses = [
  "concept",
  "actief",
  "verouderd",
  "ingetrokken",
] as const;
export type ManagedKnowledgeStatus =
  (typeof managedKnowledgeStatuses)[number];

export const managedKnowledgeReliabilities = ["hoog", "gemiddeld", "laag"] as const;
export type ManagedKnowledgeReliability =
  (typeof managedKnowledgeReliabilities)[number];

export const managedKnowledgeAudiences = [
  "sporter",
  "jeugd",
  "coach",
  "ouder",
  "iedereen",
] as const;
export type ManagedKnowledgeAudience =
  (typeof managedKnowledgeAudiences)[number];

// Soorten kennis in Sparki-adviezen — gedeelde typologie zodat iedere uiting
// herkenbaar gelabeld kan worden.
export const knowledgeKinds = [
  "vakkennis", // vastgelegd beheerd kennisitem
  "regel", // deterministische Sparki-regel
  "sporterdata", // persoonlijke meetwaarden van de sporter
  "coachinstructie", // letterlijke instructie van de coach
  "ai_uitleg", // door AI geformuleerde uitleg van bestaande conclusies
  "onzeker", // onzekerheid of ontbrekende informatie
] as const;
export type KnowledgeKind = (typeof knowledgeKinds)[number];

export const managedKnowledgeItemsTable = pgTable(
  "managed_knowledge_items",
  {
    id: serial("id").primaryKey(),
    topic: text("topic").notNull(), // onderwerp (bv. "koolhydraatinname lange duurritten")
    domain: text("domain").notNull(), // ManagedKnowledgeDomain
    discipline: text("discipline"), // bv. "weg", "mtb", null = alle
    audience: text("audience").notNull().default("iedereen"),
    // Inhoud (Nederlands) — de gecontroleerde vaktekst zelf.
    body: text("body").notNull(),
    // Beperkingen / geldigheidsvoorwaarden (eerlijk, compact).
    limitations: text("limitations"),
    // Wanneer professionele controle nodig is (medisch/voeding/veiligheid).
    professionalCheck: text("professional_check"),
    // Bron van de vakkennis.
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url"),
    publishedAt: text("published_at"), // publicatiedatum bron (YYYY-MM-DD)
    reviewedAt: text("reviewed_at"), // laatste controledatum (YYYY-MM-DD)
    version: integer("version").notNull().default(0), // 0 = nog nooit gepubliceerd
    reliability: text("reliability").notNull().default("gemiddeld"),
    ownerClerkId: text("owner_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    status: text("status").notNull().default("concept"),
    statusReason: text("status_reason"), // reden bij verouderd/ingetrokken
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("mki_status_domain_idx").on(t.status, t.domain),
    index("mki_topic_idx").on(t.topic),
  ],
);

// Snapshot per gepubliceerde versie — historische analyses blijven herleidbaar
// naar exact de tekst/bron van dat moment, ook na latere wijziging/intrekking.
export const managedKnowledgeVersionsTable = pgTable(
  "managed_knowledge_versions",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id")
      .notNull()
      .references(() => managedKnowledgeItemsTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    topic: text("topic").notNull(),
    domain: text("domain").notNull(),
    body: text("body").notNull(),
    limitations: text("limitations"),
    professionalCheck: text("professional_check"),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url"),
    publishedAt: text("published_at"),
    reviewedAt: text("reviewed_at"),
    reliability: text("reliability").notNull(),
    publishedBy: text("published_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("mkv_item_version_uq").on(t.itemId, t.version)],
);

// Gebruik per Sparki-engine — pint de gebruikte VERSIE zodat een historisch
// advies herleidbaar blijft, ook als het item later verandert of vervalt.
export const knowledgeUsageEventsTable = pgTable(
  "knowledge_usage_events",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id")
      .notNull()
      .references(() => managedKnowledgeItemsTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    engine: text("engine").notNull(), // vandaag | analyse | plan | voeding | race | mechanieker | coach | uitleg
    clerkId: text("clerk_id"), // sporter voor wie het advies was (null = systeem)
    contextRef: text("context_ref"), // vrij referentieveld (bv. "race:12")
    usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("kue_item_idx").on(t.itemId),
    index("kue_engine_idx").on(t.engine, t.usedAt),
  ],
);

// Terugkerende foutfeedback op kennisitems.
export const knowledgeFeedbackTable = pgTable(
  "knowledge_feedback",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id")
      .notNull()
      .references(() => managedKnowledgeItemsTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    message: text("message").notNull(),
    status: text("status").notNull().default("open"), // open | afgehandeld
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("kf_item_status_idx").on(t.itemId, t.status)],
);

export const insertManagedKnowledgeItemSchema = createInsertSchema(
  managedKnowledgeItemsTable,
);
export const selectManagedKnowledgeItemSchema = createSelectSchema(
  managedKnowledgeItemsTable,
);
export type ManagedKnowledgeItem = z.infer<
  typeof selectManagedKnowledgeItemSchema
>;
export type NewManagedKnowledgeItem = z.infer<
  typeof insertManagedKnowledgeItemSchema
>;
export const selectManagedKnowledgeVersionSchema = createSelectSchema(
  managedKnowledgeVersionsTable,
);
export type ManagedKnowledgeVersion = z.infer<
  typeof selectManagedKnowledgeVersionSchema
>;
