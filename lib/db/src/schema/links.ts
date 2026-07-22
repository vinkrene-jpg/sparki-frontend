import { pgTable, text, timestamp, primaryKey, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

export const coachAthleteLinksTable = pgTable(
  "coach_athlete_links",
  {
    coachClerkId: text("coach_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Wanneer de coach deze atleet voor het laatst bewust heeft beoordeeld
    // (dashboardknop "Beoordeeld"). Null = nog nooit.
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.coachClerkId, t.athleteClerkId] })],
);

export const parentAthleteLinksTable = pgTable(
  "parent_athlete_links",
  {
    parentClerkId: text("parent_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Ouder-/verzorgeromgeving (additief):
    // relatie tot het kind — "ouder" of "verzorger" (weergave, geen rechten).
    relationship: text("relationship").notNull().default("ouder"),
    // Per-gegevenstype zichtbaarheid voor DEZE koppeling (nooit gekopieerd).
    // Keys: zie parentDataCategories in parent.ts. Null = alleen het
    // veiligheidsminimum (gezondheid + herstel), fail-closed.
    permissions: jsonb("permissions").$type<Record<string, boolean>>(),
    permissionsUpdatedAt: timestamp("permissions_updated_at", {
      withTimezone: true,
    }),
    // Leeftijdscategorie van de sporter op het moment van (her)bevestiging.
    // Wijkt de actuele categorie af, dan is herbevestiging nodig en vallen
    // niet-veiligheidscategorieën terug op dicht (fail-closed).
    ageTierAtConsent: text("age_tier_at_consent"),
    consentConfirmedAt: timestamp("consent_confirmed_at", {
      withTimezone: true,
    }),
  },
  (t) => [primaryKey({ columns: [t.parentClerkId, t.athleteClerkId] })],
);

export const insertCoachAthleteLinkSchema = createInsertSchema(coachAthleteLinksTable);
export const insertParentAthleteLinkSchema = createInsertSchema(parentAthleteLinksTable);

export type CoachAthleteLink = typeof coachAthleteLinksTable.$inferSelect;
export type ParentAthleteLink = typeof parentAthleteLinksTable.$inferSelect;

export type InsertCoachAthleteLink = z.infer<typeof insertCoachAthleteLinkSchema>;
export type InsertParentAthleteLink = z.infer<typeof insertParentAthleteLinkSchema>;
