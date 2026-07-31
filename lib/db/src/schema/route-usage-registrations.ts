import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// ROUTE_PAKKET_02A (SPARKI-BESLUIT-2026-003) — telling van routegebruik.
//
// Eén rij = één gebruikte route per gebruiker per kalendermaand (Europe/
// Amsterdam). Alleen meten: er wordt hier niets geblokkeerd of beperkt.
// Waarom een eigen tabel en niet route_version_usages: die tabel legt vast
// WELKE VERSIE van een route een training/wedstrijd/activiteit gebruikte
// (uniek op route+context+contextId) en kent geen maandbegrip, geen
// pakket-snapshot en geen gebruiker+route+maand-uniciteit. De maandtelling
// heeft precies die drie nodig; hergebruik zou de bestaande semantiek breken.
//
// routeId is bewust een zachte verwijzing (geen FK): de telling is historie
// en mag niet verdwijnen of van sleutel veranderen wanneer een route later
// wordt verwijderd. Uniciteit (clerk_id, route_id, calendar_month) wordt op
// databaseniveau afgedwongen: dubbele of gelijktijdige verzoeken kunnen nooit
// twee registraties opleveren.
export const routeUsageRegistrationsTable = pgTable(
  "route_usage_registrations",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Zachte verwijzing naar routes.id (zie boven).
    routeId: integer("route_id").notNull(),
    // SAVED | GPX_EXPORTED | RIDDEN_20_PERCENT — de EERSTE tellende
    // gebeurtenis in de maand wint; latere gebeurtenissen voor dezelfde
    // route in dezelfde maand veranderen de rij niet (onConflictDoNothing).
    usageType: text("usage_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // "YYYY-MM", afgeleid in Europe/Amsterdam (nooit UTC/apparaat-tijdzone).
    calendarMonth: text("calendar_month").notNull(),
    // Snapshot van het pakket op het moment van gebruik (productVariant, of
    // de toegangsmodus wanneer er geen variant is). Wordt nooit herrekend.
    subscriptionTier: text("subscription_tier").notNull(),
    // Herkomst van de registratie (bijv. "opslaan:gpx-upload", "gpx-export").
    source: text("source").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("route_usage_reg_user_route_month_idx").on(
      t.clerkId,
      t.routeId,
      t.calendarMonth,
    ),
    index("route_usage_reg_user_month_idx").on(t.clerkId, t.calendarMonth),
  ],
);

export const insertRouteUsageRegistrationSchema = createInsertSchema(
  routeUsageRegistrationsTable,
).omit({ id: true });
export const selectRouteUsageRegistrationSchema = createSelectSchema(
  routeUsageRegistrationsTable,
);

export type RouteUsageRegistration =
  typeof routeUsageRegistrationsTable.$inferSelect;
export type InsertRouteUsageRegistration = z.infer<
  typeof insertRouteUsageRegistrationSchema
>;
