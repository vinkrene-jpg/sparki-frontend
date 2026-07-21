import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";
import { equipmentTable } from "./data-hub";

// Fietsengarage — the athlete's bikes and their equipment.
//
// A bike row is one physical bike (racefiets, MTB, gravel, TT, baan, …) with
// optional photos (object-storage paths) and an optional link back to an
// existing `equipment` row (e.g. imported from Strava) so nothing is entered
// twice. Components hang off a bike (groepset, wielen, banden, afwijkende
// onderdelen) or — with bikeId null — are personal gear (helm, kleding,
// schoenen). Ratings (klasse/aero/gewicht) are NEVER stored here: they are
// derived live from the curated component knowledge base in the api-server, so
// an unknown component stays honestly "onbekend".

export const garageBikeTypes = [
  "race",
  "mtb",
  "gravel",
  "tt",
  "baan",
  "cyclocross",
  "stads",
  "anders",
] as const;
export type GarageBikeType = (typeof garageBikeTypes)[number];

export const garageComponentCategories = [
  "groepset",
  "wielen",
  "banden",
  "onderdeel", // afwijkend los onderdeel (crank, cassette, remmen, …)
  "helm",
  "kleding",
  "schoenen",
  "anders",
] as const;
export type GarageComponentCategory =
  (typeof garageComponentCategories)[number];

export const garageBikesTable = pgTable("garage_bikes", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  bikeType: text("bike_type").notNull().default("race"),
  name: text("name").notNull(),
  brand: text("brand"),
  model: text("model"),
  // Optional link to an existing equipment row (e.g. Strava bike) so imported
  // gear is the starting point instead of duplicate manual entry.
  equipmentId: integer("equipment_id").references(() => equipmentTable.id, {
    onDelete: "set null",
  }),
  // Normalized object paths ("/objects/uploads/<uuid>") of real uploaded photos.
  photoPaths: jsonb("photo_paths").$type<string[]>().notNull().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const garageComponentsTable = pgTable("garage_components", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  // Null = personal gear (helm/kleding/schoenen), otherwise part of this bike.
  bikeId: integer("bike_id").references(() => garageBikesTable.id, {
    onDelete: "cascade",
  }),
  category: text("category").notNull(),
  brand: text("brand"),
  model: text("model"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertGarageBikeSchema = createInsertSchema(
  garageBikesTable,
).omit({ id: true });
export const selectGarageBikeSchema = createSelectSchema(garageBikesTable);
export const insertGarageComponentSchema = createInsertSchema(
  garageComponentsTable,
).omit({ id: true });
export const selectGarageComponentSchema = createSelectSchema(
  garageComponentsTable,
);

export type GarageBike = typeof garageBikesTable.$inferSelect;
export type InsertGarageBike = z.infer<typeof insertGarageBikeSchema>;
export type GarageComponent = typeof garageComponentsTable.$inferSelect;
export type InsertGarageComponent = z.infer<typeof insertGarageComponentSchema>;
