import {
  pgTable,
  serial,
  text,
  integer,
  real,
  doublePrecision,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// ── Sparki Traffic Database ─────────────────────────────────────────────────
// Eigen, zelflerende database van wegobjecten (verkeerslichten eerst; het
// `kind`-veld is bewust generiek zodat rotondes, drempels, spoorwegovergangen,
// stopborden, tunnels, bruggen, veeroosters en klimsegmenten later dezelfde
// tabel en engine gebruiken zonder schemawijziging).
//
// Eerlijkheidscontract: elk object heeft een expliciete bron en een confidence
// die alleen stijgt door echte bevestigingen (OSM-data, herhaalde echte stops
// van meerdere renners, handmatige verificatie) en langzaam daalt wanneer
// niemand het object nog bevestigt. Er wordt nooit een object verzonnen.

export const roadObjectKinds = [
  "traffic_signal",
  "railway_crossing",
  "roundabout",
  "speed_bump",
  "dangerous_junction",
  "stop_sign",
  "tunnel",
  "bridge",
  "cattle_grid",
  "climb_segment",
] as const;
export type RoadObjectKind = (typeof roadObjectKinds)[number];

export const roadObjectSources = [
  "osm",
  "here",
  "tomtom",
  "detection",
  "manual",
] as const;
export type RoadObjectSource = (typeof roadObjectSources)[number];

export const roadObjectsTable = pgTable(
  "road_objects",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(),
    // Bron van dit object. "detection" = afgeleid uit echt stopgedrag van
    // renners; "manual" = door een gebruiker bevestigd/aangemaakt.
    source: text("source").notNull(),
    // Stabiele identiteit binnen (kind, source): OSM node-id ("node/123") of
    // een rastercel-sleutel voor gedetecteerde objecten ("cell:52.1234,4.5678").
    externalId: text("external_id").notNull(),
    lat: doublePrecision("lat").notNull(),
    lon: doublePrecision("lon").notNull(),
    // Wegnaam en land — alleen gevuld wanneer de bron ze echt levert (OSM-tags);
    // nooit gegokt.
    roadName: text("road_name"),
    country: text("country"),
    // Basis-confidence 0..1 op het moment van de laatste validatie. De
    // effectieve confidence op leesmoment daalt deterministisch met de tijd
    // sinds lastValidatedAt (zie engine) — zo veroudert data eerlijk zonder
    // afhankelijk te zijn van een cronjob.
    confidence: real("confidence").notNull(),
    // Aantal onafhankelijke bevestigingen (OSM-hersync, gedetecteerde stops,
    // handmatige verificaties).
    confirmations: integer("confirmations").notNull().default(0),
    lastValidatedAt: timestamp("last_validated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("road_objects_identity_idx").on(t.kind, t.source, t.externalId),
    index("road_objects_lat_idx").on(t.lat),
    index("road_objects_lon_idx").on(t.lon),
  ],
);

// Ruwe stop-waarnemingen per renner per rastercel. Hieruit leert het systeem:
// meerdere gebruikers die herhaaldelijk op dezelfde plek stoppen → confidence
// omhoog / nieuw object. Eén rij per (renner, cel, activiteit) zodat het
// opnieuw uploaden van hetzelfde bestand nooit dubbel telt.
export const roadObjectReportsTable = pgTable(
  "road_object_reports",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Rastercel (~11 m) waarin de stop viel — de leersleutel.
    cellKey: text("cell_key").notNull(),
    lat: doublePrecision("lat").notNull(),
    lon: doublePrecision("lon").notNull(),
    // Werkelijke stilstandsduur in seconden (uit echte GPS-tijden).
    stopSec: integer("stop_sec").notNull(),
    // Deterministische classificatie op moment van waarneming.
    guessedKind: text("guessed_kind").notNull(),
    confidence: real("confidence").notNull(),
    // Activiteit waaruit deze stop komt (dedupe bij her-upload).
    activityExternalId: text("activity_external_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("road_object_reports_dedupe_idx").on(
      t.clerkId,
      t.cellKey,
      t.activityExternalId,
    ),
    index("road_object_reports_cell_idx").on(t.cellKey),
  ],
);

export const insertRoadObjectSchema = createInsertSchema(roadObjectsTable).omit({ id: true });
export const selectRoadObjectSchema = createSelectSchema(roadObjectsTable);
export type RoadObject = typeof roadObjectsTable.$inferSelect;
export type InsertRoadObject = z.infer<typeof insertRoadObjectSchema>;

export const insertRoadObjectReportSchema = createInsertSchema(roadObjectReportsTable).omit({ id: true });
export type RoadObjectReport = typeof roadObjectReportsTable.$inferSelect;
