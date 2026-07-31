import {
  pgTable,
  serial,
  text,
  real,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Privacyzones (opdracht René 31-07-2026 §7): door de gebruiker beheerde
// gevoelige locaties (woning, werk, andere gevoelige plek). Elke gedeelde of
// getoonde routeweergave voor NIET-eigenaren verwijdert alle punten binnen de
// zone-straal — op leesmoment (read-time transform), nooit als aangepaste
// kopie in de database. Het huisadres uit athlete_profiles telt daarnaast
// ALTIJD impliciet mee als zone; deze tabel is de aanvulling voor werk en
// andere plekken.

export const privacyZoneKinds = ["woning", "werk", "gevoelig"] as const;
export type PrivacyZoneKind = (typeof privacyZoneKinds)[number];

export const PRIVACY_ZONE_MIN_RADIUS_M = 200;
export const PRIVACY_ZONE_MAX_RADIUS_M = 5000;
export const PRIVACY_ZONE_DEFAULT_RADIUS_M = 750;

export const privacyZonesTable = pgTable(
  "privacy_zones",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    label: text("label").notNull(),
    kind: text("kind").notNull().default("gevoelig"),
    lat: real("lat").notNull(),
    lon: real("lon").notNull(),
    radiusM: integer("radius_m").notNull().default(PRIVACY_ZONE_DEFAULT_RADIUS_M),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("privacy_zones_clerk_idx").on(t.clerkId)],
);

export const insertPrivacyZoneSchema = createInsertSchema(
  privacyZonesTable,
).omit({ id: true });
export const selectPrivacyZoneSchema = createSelectSchema(privacyZonesTable);

export type PrivacyZoneRow = typeof privacyZonesTable.$inferSelect;
export type InsertPrivacyZone = z.infer<typeof insertPrivacyZoneSchema>;
