// SPARKI_BUILD_01 F10 (PD-3) — centrale contacten- en relatielaag.
//
// KERNPRINCIPE (bindend, incl. de drie correcties in het F10-document):
// - ÉÉN contactrecord per identiteit. Een persoon wordt niet opnieuw als los
//   contact aangemaakt als dezelfde identiteit al bestaat.
// - Klant en sporter zijn NOOIT één samengevoegde entiteit. Een contact dat
//   zowel klant als sporter is, draagt twee RELATIES — geen samengevoegd
//   record. Dat geldt voor élk rollenpaar (ouder + trainer, betaler + sporter…).
// - GEEN tweede personenlijst: de bestaande tabellen blijven bestaan voor hun
//   eigen doel; ze KRIJGEN een (nullable) verwijzing naar het contactrecord in
//   plaats van de persoonsgegevens te herhalen.
// - NOOIT automatisch samenvoegen bij twijfel. Twijfelgevallen komen op de
//   beoordelingslijst (contact_merge_review) en worden pas na een expliciet
//   menselijk besluit samengevoegd of apart gehouden.

import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── De twintig contacttypen (correctie 3: gebruik de opsomming, niet het getal).
// Een contact kan meerdere typen tegelijk dragen (kindTags is een array).
export const contactKinds = [
  "sporter",
  "ouder_verzorger",
  "trainer",
  "hoofdtrainer",
  "teammanager",
  "ploegleider",
  "mechanieker",
  "soigneur",
  "nutrition_specialist",
  "medical_staff",
  "vrijwilliger",
  "klant",
  "betaler",
  "werkgever",
  "sponsor",
  "leverancier",
  "wedstrijdorganisatie",
  "noodcontact",
  "bedrijf",
  "locatiecontact",
] as const;
export type ContactKind = (typeof contactKinds)[number];

// ── De negen relatietypen (correctie 3). GEEN nieuwe relatietypen buiten deze
// negen. Elke relatie heeft startedAt (NOT NULL) en een nullable endedAt.
export const contactRelationTypes = [
  "ouder_van",
  "trainer_van",
  "klant_voor",
  "betaler_voor",
  "lid_van",
  "staf_van",
  "noodcontact_van",
  "werkzaam_bij",
  "leverancier_aan",
] as const;
export type ContactRelationType = (typeof contactRelationTypes)[number];

// ── contacts ─────────────────────────────────────────────────────────────────
// Eén rij per identiteit. clerkId is het identiteitsanker voor accounthouders:
// uniek waar niet-null (Postgres staat vele NULLs toe onder een UNIQUE index),
// zodat één identiteit nooit twee contacten kan krijgen. Contacten zonder
// account (klant zonder Sparki-login, noodcontact, leverancier) hebben clerkId
// NULL en worden alleen op aantoonbare identiteit ontdubbeld (geverifieerd
// e-mail), nooit op naam alleen.
export const contactsTable = pgTable(
  "contacts",
  {
    id: serial("id").primaryKey(),
    // Identiteitsanker voor accounthouders. NULL voor contacten zonder account.
    clerkId: text("clerk_id"),
    // Genormaliseerd (lowercase, getrimd) e-mailadres. Nullable — niet elk
    // contact heeft een e-mailadres. NIET uniek op databaseniveau: twee
    // bronnen kunnen (nog) verschillende gegevens dragen; ontdubbeling gebeurt
    // bewust in findOrCreateContact, nooit blind door een constraint.
    primaryEmail: text("primary_email"),
    displayName: text("display_name").notNull(),
    phone: text("phone"),
    // De contacttypen die dit contact draagt (zie contactKinds). Een contact
    // kan er meerdere hebben. Array i.p.v. junction: past bij de bestaande
    // codebase (roles op user_profiles is ook een text[]-array) en houdt de
    // laag licht.
    kindTags: text("kind_tags").array().notNull().default(sql`ARRAY[]::text[]`),
    // Vrije herkomstnotitie (bv. "gemigreerd uit trainer_clients #12").
    sourceNote: text("source_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Eén contact per accountidentiteit; vele NULLs toegestaan.
    uniqueIndex("contacts_clerk_uq")
      .on(t.clerkId)
      .where(sql`clerk_id IS NOT NULL`),
    index("contacts_primary_email_idx").on(t.primaryEmail),
  ],
);

export type Contact = typeof contactsTable.$inferSelect;

// ── contact_relations ─────────────────────────────────────────────────────────
// Een relatie tussen twee contacten (of naar een organisatie-contact, dat is
// óók een contact — bv. type "bedrijf" of "wedstrijdorganisatie"). fromContactId
// is de "actor" (de ouder, de trainer, de klant, het lid, de leverancier),
// toContactId de "target" (het kind, de sporter, de organisatie, de werkgever).
// Beëindigen zet endedAt; de rij blijft historisch zichtbaar en het contact
// blijft altijd bestaan.
export const contactRelationsTable = pgTable(
  "contact_relations",
  {
    id: serial("id").primaryKey(),
    fromContactId: integer("from_contact_id")
      .notNull()
      .references(() => contactsTable.id, { onDelete: "cascade" }),
    toContactId: integer("to_contact_id")
      .notNull()
      .references(() => contactsTable.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(), // ContactRelationType
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    sourceNote: text("source_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("contact_relations_from_idx").on(t.fromContactId),
    index("contact_relations_to_idx").on(t.toContactId),
    // Eén ACTIEVE relatie van dit type tussen dit paar; historie (endedAt
    // gezet) mag meermaals bestaan.
    uniqueIndex("contact_relations_active_uq")
      .on(t.fromContactId, t.toContactId, t.relationType)
      .where(sql`ended_at IS NULL`),
  ],
);

export type ContactRelation = typeof contactRelationsTable.$inferSelect;

// ── contact_merge_review ──────────────────────────────────────────────────────
// Beoordelingslijst voor twijfelgevallen. Wordt gevuld door de migratie en door
// findOrCreateContact wanneer een aanmaak niet duidelijk een duplicaat is maar
// ook niet duidelijk een nieuwe identiteit (bv. zelfde naam + telefoon, ander
// of geen e-mail). NOOIT automatisch samenvoegen: een beslisser bekijkt de
// kandidaten en legt een expliciet besluit vast (samenvoegen of apart houden).
export const contactMergeReviewStatuses = ["open", "besloten"] as const;
export type ContactMergeReviewStatus =
  (typeof contactMergeReviewStatuses)[number];

// Besluit bij een besloten review: samenvoegen (met een gekozen doelcontact)
// of apart houden (twee verschillende mensen).
export const contactMergeDecisions = ["samengevoegd", "apart_gehouden"] as const;
export type ContactMergeDecision = (typeof contactMergeDecisions)[number];

export const contactMergeReviewTable = pgTable(
  "contact_merge_review",
  {
    id: serial("id").primaryKey(),
    // Bron van het twijfelgeval, bv. "trainer_clients", "billing_parties",
    // "invitations", of "api" (aanmaakpoging via de route).
    source: text("source").notNull(),
    // Sleutel binnen de bron (bv. het rij-id of e-mail), voor traceerbaarheid.
    sourceId: text("source_id"),
    // Het (net aangemaakte of voorgestelde) contact dat beoordeeld moet worden.
    contactId: integer("contact_id").references(() => contactsTable.id, {
      onDelete: "set null",
    }),
    // Kandidaat-contacten waarmee dit mogelijk hetzelfde is (contact-id's).
    candidateContactIds: integer("candidate_contact_ids").array(),
    // Waarom dit op de lijst staat (in gewone taal).
    reason: text("reason").notNull(),
    status: text("status").notNull().default("open"), // open | besloten
    decision: text("decision"), // samengevoegd | apart_gehouden (bij besloten)
    // Bij samenvoegen: het contact dat behouden blijft (het doelcontact).
    decidedTargetContactId: integer("decided_target_contact_id").references(
      () => contactsTable.id,
      { onDelete: "set null" },
    ),
    decidedByClerkId: text("decided_by_clerk_id"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("contact_merge_review_status_idx").on(t.status),
    index("contact_merge_review_source_idx").on(t.source, t.sourceId),
  ],
);

export type ContactMergeReview = typeof contactMergeReviewTable.$inferSelect;
