// Golf 26 — Gezondheid, herstel, blessures & veiligheid.
//
// health_complaints is de registratielaag voor ziekte/blessure/pijn — géén
// diagnose, alleen wat de sporter (of een andere bron) zelf doorgeeft.
// De bestaande athlete_profiles.health_status blijft de SSOT die de engines
// (planblokkade, coach-signalen, nooddagweergave) al lezen; klachten sturen
// die status via de engine (lib/health-flow) — nooit erlangs.
//
// health_complaint_updates is append-only verloop (herstelverloop, punt 12).
// health_safety_info is zelfgekozen noodinformatie (punt 11) met een
// expliciete deel-toestemming — zonder toestemming verlaat die info nooit
// het eigen account.

import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./users";

export const healthComplaintKinds = ["ziekte", "blessure", "pijn"] as const;
export type HealthComplaintKind = (typeof healthComplaintKinds)[number];

export const healthComplaintSeverities = ["licht", "matig", "ernstig"] as const;
export type HealthComplaintSeverity = (typeof healthComplaintSeverities)[number];

export const healthTrainingImpacts = [
  "geen",
  "aangepast",
  "niet_trainen",
] as const;
export type HealthTrainingImpact = (typeof healthTrainingImpacts)[number];

export const healthComplaintStatuses = [
  "actief",
  "herstellende",
  "hersteld",
] as const;
export type HealthComplaintStatus = (typeof healthComplaintStatuses)[number];

// Bron van het signaal — expliciet onderscheiden (punt 4).
export const healthSignalSources = [
  "zelfgerapporteerd",
  "sensor_afwijking",
  "herstelinschatting",
  "coachnotitie",
  "oudermelding",
  "medisch_bevestigd",
] as const;
export type HealthSignalSource = (typeof healthSignalSources)[number];

export const healthComplaintsTable = pgTable(
  "health_complaints",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    kind: text("kind").notNull().$type<HealthComplaintKind>(),
    // Lichaamslocatie (blessure/pijn) of categorie (ziekte, bv. "verkoudheid").
    bodyLocation: text("body_location"),
    severity: text("severity").notNull().$type<HealthComplaintSeverity>(),
    startDate: date("start_date").notNull(),
    trainingImpact: text("training_impact")
      .notNull()
      .$type<HealthTrainingImpact>(),
    status: text("status")
      .notNull()
      .default("actief")
      .$type<HealthComplaintStatus>(),
    source: text("source")
      .notNull()
      .default("zelfgerapporteerd")
      .$type<HealthSignalSource>(),
    // Instructie van een professional (arts/fysio) — letterlijk, nooit
    // geherinterpreteerd door Sparki.
    professionalInstruction: text("professional_instruction"),
    notes: text("notes"),
    // Gemaakt door (sporter zelf, of coach bij bron coachnotitie).
    createdByClerkId: text("created_by_clerk_id").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    // Expliciete hervattingsbevestiging (punt 8) — nooit automatisch.
    resumptionConfirmedAt: timestamp("resumption_confirmed_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("health_complaints_clerk_idx").on(t.clerkId, t.status)],
);

// Append-only verloop: iedere status-/impactwijziging of notitie is een rij.
export const healthComplaintUpdatesTable = pgTable(
  "health_complaint_updates",
  {
    id: serial("id").primaryKey(),
    complaintId: integer("complaint_id")
      .notNull()
      .references(() => healthComplaintsTable.id, { onDelete: "cascade" }),
    actorClerkId: text("actor_clerk_id").notNull(),
    statusAfter: text("status_after").$type<HealthComplaintStatus>(),
    trainingImpactAfter: text("training_impact_after").$type<HealthTrainingImpact>(),
    severityAfter: text("severity_after").$type<HealthComplaintSeverity>(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("health_complaint_updates_complaint_idx").on(t.complaintId)],
);

// Zelfgekozen nood-/veiligheidsinformatie. Delen is een expliciete keuze;
// standaard uit (fail-closed).
export const healthSafetyInfoTable = pgTable("health_safety_info", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .unique()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  infoText: text("info_text").notNull().default(""),
  shareWithContacts: boolean("share_with_contacts").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type HealthComplaint = typeof healthComplaintsTable.$inferSelect;
export type InsertHealthComplaint = typeof healthComplaintsTable.$inferInsert;
export type HealthComplaintUpdate =
  typeof healthComplaintUpdatesTable.$inferSelect;
export type HealthSafetyInfo = typeof healthSafetyInfoTable.$inferSelect;
