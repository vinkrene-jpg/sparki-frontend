import {
  pgTable,
  serial,
  text,
  integer,
  real,
  jsonb,
  timestamp,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// ─────────────────────────────────────────────────────────────────────────────
// Persoonlijke routekandidaten uit gekoppelde ritgeschiedenis.
//
// Geïmporteerde ritten (Strava / Garmin / bestandsupload) worden — naast
// activiteitenhistorie — grondstof voor herbruikbare routekandidaten. Dit is
// GEEN tweede routesysteem: een kandidaat wordt pas een echte route (rij in
// `routes`) via het bestaande opslagpad mét de actuele fail-closed
// blokkadeverificatie. De oorspronkelijke activiteit wordt NOOIT gewijzigd.
//
// Duplicaatdetectie gebeurt via een route-fingerprint (celreeks-hash);
// clustering van vrijwel gelijke ritten via geometrische celoverlap +
// start-/eindgebied + afstand/hoogte-tolerantie + richting.
// ─────────────────────────────────────────────────────────────────────────────

// Transparante kwaliteitsscore: per factor de echte meting + korte uitleg.
// Een oude of vaak gereden route is NOOIT automatisch "veilig" — veiligheid
// wordt pas beoordeeld door de actuele fail-closed verificatie bij opslaan/
// voorstellen/starten, nooit door deze score.
export type RouteCandidateQualityFactor = {
  factor:
    | "frequentie"
    | "recentheid"
    | "gps_volledigheid"
    | "consistentie"
    | "profiel_match"
    | "keren_stilstand";
  score: number; // 0–100 voor deze factor
  weight: number; // gewicht in de totaalscore
  toelichting: string; // korte Nederlandse uitleg van de echte meting
};

export type RouteCandidateQuality = {
  score: number; // 0–100 gewogen totaal
  factors: RouteCandidateQualityFactor[];
};

export const routeCandidatesTable = pgTable(
  "route_candidates",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Route-fingerprint (duplicaatdetectie): hash over de genormaliseerde
    // celreeks + lus-vlag. Byte-identieke of vrijwel identieke sporen van
    // dubbele imports leveren dezelfde fingerprint op.
    fingerprint: text("fingerprint").notNull(),
    // Representatieve geometrie ([lat, lon]-PAREN, zelfde vorm als routes /
    // route_library) van het best gemeten exemplaar in de cluster.
    geometry: jsonb("geometry").notNull(),
    // Genormaliseerde rastercellen (gesorteerde unieke celsleutels) voor
    // geometrische overlap-matching bij het clusteren van nieuwe ritten.
    cells: jsonb("cells").$type<string[]>().notNull(),
    startLat: real("start_lat").notNull(),
    startLon: real("start_lon").notNull(),
    endLat: real("end_lat").notNull(),
    endLon: real("end_lon").notNull(),
    isLoop: boolean("is_loop").notNull().default(false),
    distanceKm: real("distance_km").notNull(),
    elevationM: real("elevation_m"),
    sport: text("sport").notNull().default("cycling"),
    // Aantal ritten in deze cluster + tijdvenster (voor frequentie/recentheid).
    rideCount: integer("ride_count").notNull().default(1),
    firstRiddenAt: timestamp("first_ridden_at", { withTimezone: true }),
    lastRiddenAt: timestamp("last_ridden_at", { withTimezone: true }),
    // Automatische labels (deterministisch afgeleid, bv. "vaak gereden",
    // "klimroute"). De gebruiker kan ze corrigeren via userLabels — de
    // correctie wint ALTIJD van het automatische label in de weergave.
    autoLabels: jsonb("auto_labels").$type<string[]>().notNull().default([]),
    userLabels: jsonb("user_labels").$type<string[]>(),
    favorite: boolean("favorite").notNull().default(false),
    // Uitgesloten door de gebruiker: blijft bestaan (zodat een her-import niet
    // opnieuw dezelfde kandidaat opduikt) maar wordt nergens meer getoond of
    // voor voorstellen gebruikt.
    excluded: boolean("excluded").notNull().default(false),
    // Transparante kwaliteitsscore (RouteCandidateQuality).
    quality: jsonb("quality").$type<RouteCandidateQuality>(),
    // Gemiddelde onderlinge celoverlap van ritten in de cluster (0–1) — voedt
    // de consistentie-factor.
    overlapAvg: real("overlap_avg"),
    // Eerlijke vlaggen uit de analyse: bv. vervoer vóór/na de rit weggeknipt
    // uit de kandidaatgeometrie (de activiteit zelf blijft onaangetast).
    trimmedStartM: real("trimmed_start_m"),
    trimmedEndM: real("trimmed_end_m"),
    // Route die uit deze kandidaat is opgeslagen (soft-ref, geen FK om
    // schema-cycli te vermijden). Opslaan loopt ALTIJD door de fail-closed
    // verificatie.
    savedRouteId: integer("saved_route_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("unique_route_candidate").on(t.clerkId, t.fingerprint)],
);

// Herkomst: welke sessies (ritten) aan welke kandidaat bijdroegen. De sessie
// zelf blijft onaangetast; dit is een losse verwijstabel. Eén sessie draagt
// maximaal aan één kandidaat bij (unique per gebruiker+sessie).
export const routeCandidateRidesTable = pgTable(
  "route_candidate_rides",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    candidateId: integer("candidate_id")
      .notNull()
      .references(() => routeCandidatesTable.id, { onDelete: "cascade" }),
    // Soft-ref naar training_sessions (her-filteren op clerkId bij lezen).
    sessionId: integer("session_id").notNull(),
    riddenAt: timestamp("ridden_at", { withTimezone: true }),
    // Celoverlap van deze rit met de kandidaat op het moment van koppelen.
    overlap: real("overlap"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("unique_route_candidate_ride").on(t.clerkId, t.sessionId)],
);

// Incrementele analyse-cursor per gebruiker: de scan verwerkt alleen sessies
// met id > lastSessionId (nooit een zware volledige analyse bij paginalaad).
// Ook de bron voor de onboarding-samenvatting ("184 activiteiten → 23 routes").
export const routeCandidateScansTable = pgTable("route_candidate_scans", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .unique()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  lastSessionId: integer("last_session_id").notNull().default(0),
  lastScanAt: timestamp("last_scan_at", { withTimezone: true }),
  // Cumulatieve, eerlijke tellers over alle scans heen.
  activitiesSeen: integer("activities_seen").notNull().default(0),
  activitiesWithTrack: integer("activities_with_track").notNull().default(0),
  // Wanneer de gebruiker de onboarding-samenvatting heeft gezien/weggeklikt.
  onboardingSeenAt: timestamp("onboarding_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertRouteCandidateSchema = createInsertSchema(
  routeCandidatesTable,
).omit({ id: true });
export const selectRouteCandidateSchema =
  createSelectSchema(routeCandidatesTable);
export type RouteCandidate = typeof routeCandidatesTable.$inferSelect;
export type InsertRouteCandidate = z.infer<typeof insertRouteCandidateSchema>;

export type RouteCandidateRide = typeof routeCandidateRidesTable.$inferSelect;
export type RouteCandidateScan = typeof routeCandidateScansTable.$inferSelect;
