// Ouder-/verzorgeromgeving (Afbouwgolf 12).
//
// Ontwerpprincipes:
// - Rechten zijn PER koppeling (ouder×kind) — nooit automatisch gekopieerd
//   tussen ouders of tussen kinderen.
// - Zichtbaarheid is per gegevenstype (jsonb op parent_athlete_links, zie
//   links.ts). Vermogenswaarden, volledige analyses, medische details en
//   coachnotities worden NOOIT gedeeld — die categorieën bestaan bewust niet.
// - Een oudermelding (ziek/blessure) is een signaal, geen diagnose en geen
//   automatische trainingsbeslissing.

import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { userProfilesTable } from "./users";

// Gegevenstypes die een ouder per koppeling wel/niet mag zien.
export const parentDataCategories = [
  "planning",
  "aanwezigheid",
  "herstel",
  "gezondheid", // blessure-/ziektesignaal
  "slaap", // slaap-/vermoeidheidssamenvatting
  "locatie", // locatie tijdens activiteit
  "wedstrijd",
  "communicatie",
] as const;
export type ParentDataCategory = (typeof parentDataCategories)[number];
export type ParentPermissions = Partial<Record<ParentDataCategory, boolean>>;

// Leeftijdscategorieën voor ouderrechten. Bij het passeren van een grens is
// herbevestiging door de sporter nodig (fail-closed buiten het veiligheidsminimum).
export const parentAgeTiers = ["u16", "16_17", "adult", "unknown"] as const;
export type ParentAgeTier = (typeof parentAgeTiers)[number];

// Melding door een ouder: ziek / blessure / afwezigheid. Zichtbaar voor de
// sporter en (met toestemming) de bevoegde coach. Geen diagnoseveld — bewust.
export const parentReportKinds = ["ziek", "blessure", "afwezig"] as const;
export type ParentReportKind = (typeof parentReportKinds)[number];

export const parentReportsTable = pgTable(
  "parent_reports",
  {
    id: serial("id").primaryKey(),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    parentClerkId: text("parent_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    kind: text("kind").notNull(), // ParentReportKind
    note: text("note"), // vrije toelichting, géén diagnose
    status: text("status").notNull().default("open"), // open | gezien | afgerond
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("parent_reports_athlete_idx").on(t.athleteClerkId, t.status)],
);

// Noodcontacten van een sporter. Beheerd door sporter of gekoppelde ouder.
export const emergencyContactsTable = pgTable(
  "emergency_contacts",
  {
    id: serial("id").primaryKey(),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    relation: text("relation"), // bv. "moeder", "vader", "verzorger"
    priority: integer("priority").notNull().default(1),
    // SPARKI_BUILD_01 F10 (PD-3): verwijzing naar het centrale contactrecord
    // (type "noodcontact"). Nullable/additief; soft reference naar contacts.id.
    contactId: integer("contact_id"),
    createdByClerkId: text("created_by_clerk_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("emergency_contacts_athlete_idx").on(t.athleteClerkId)],
);

// Bevestiging/afwijzing door een ouder van iets dat ouderactie vraagt
// (wedstrijd, clubtraining, planning-item). Idempotent per ouder×onderwerp.
export const parentConfirmationsTable = pgTable(
  "parent_confirmations",
  {
    id: serial("id").primaryKey(),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    parentClerkId: text("parent_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    subjectType: text("subject_type").notNull(), // race | club_training | planning
    subjectId: text("subject_id").notNull(),
    decision: text("decision").notNull(), // bevestigd | afgewezen
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("parent_confirmations_unique").on(
      t.parentClerkId,
      t.athleteClerkId,
      t.subjectType,
      t.subjectId,
    ),
  ],
);

// Berichten ouder ↔ sporter binnen een toegestane context (categorie
// "communicatie" moet aan staan op de koppeling).
export const parentMessagesTable = pgTable(
  "parent_messages",
  {
    id: serial("id").primaryKey(),
    parentClerkId: text("parent_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    senderClerkId: text("sender_clerk_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    index("parent_messages_pair_idx").on(t.parentClerkId, t.athleteClerkId),
  ],
);

export const insertParentReportSchema = createInsertSchema(parentReportsTable);
export const insertEmergencyContactSchema = createInsertSchema(
  emergencyContactsTable,
);
export const insertParentConfirmationSchema = createInsertSchema(
  parentConfirmationsTable,
);
export const insertParentMessageSchema = createInsertSchema(parentMessagesTable);

export type ParentReport = typeof parentReportsTable.$inferSelect;
export type EmergencyContact = typeof emergencyContactsTable.$inferSelect;
export type ParentConfirmation = typeof parentConfirmationsTable.$inferSelect;
export type ParentMessage = typeof parentMessagesTable.$inferSelect;
