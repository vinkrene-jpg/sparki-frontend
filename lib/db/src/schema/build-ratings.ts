import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Sterren-beoordelingen op onderdelen die Sparki voor de sporter bouwt
// (gegenereerde routes, planweken, dagadviezen, …).
//
// - Idempotent: één beoordeling per (gebruiker, onderwerp-type, onderwerp-id);
//   opnieuw beoordelen overschrijft de HELE rij (score + toelichting), er
//   blijven nooit twee oordelen naast elkaar bestaan.
// - Privacy: beoordelingen zijn persoonlijk; audits en de beheeromgeving zien
//   uitsluitend geaggregeerde cijfers (gemiddelde + aantal), nooit wie wat gaf.
// - Vrije tekst is altijd optioneel — één tik op een ster is genoeg.

// Uitbreidbaar register van beoordeelbare onderwerp-typen. Nieuwe bouwsels
// (bv. materiaaladvies) voeg je hier toe; de API weigert onbekende typen.
export const buildRatingSubjectTypes = [
  "gegenereerde_route",
  "bewaarde_route",
  "trainingsplan_week",
  "dagadvies",
  "race_advies",
  "materiaal_advies",
] as const;
export type BuildRatingSubjectType = (typeof buildRatingSubjectTypes)[number];

// Nederlandse labels voor rapportage (beheer/audit) — één plek.
export const buildRatingSubjectLabels: Record<BuildRatingSubjectType, string> =
  {
    gegenereerde_route: "Gegenereerde route",
    bewaarde_route: "Bewaarde route",
    trainingsplan_week: "Trainingsplan (week)",
    dagadvies: "Dagadvies",
    race_advies: "Race-advies",
    materiaal_advies: "Materiaaladvies",
  };

export const buildRatingsTable = pgTable(
  "build_ratings",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    /** 1–5 sterren. */
    rating: integer("rating").notNull(),
    /** Optionele korte toelichting (nooit verplicht). */
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("build_ratings_user_subject_uq").on(
      t.clerkId,
      t.subjectType,
      t.subjectId,
    ),
    index("build_ratings_subject_type_idx").on(t.subjectType),
    index("build_ratings_updated_idx").on(t.updatedAt),
  ],
);

export const insertBuildRatingSchema = createInsertSchema(
  buildRatingsTable,
).omit({ id: true });
export const selectBuildRatingSchema = createSelectSchema(buildRatingsTable);

export type BuildRating = typeof buildRatingsTable.$inferSelect;
export type InsertBuildRating = z.infer<typeof insertBuildRatingSchema>;
