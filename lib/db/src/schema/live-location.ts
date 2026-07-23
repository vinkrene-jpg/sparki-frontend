import {
  pgTable,
  serial,
  integer,
  text,
  real,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./users";
import { clubTrainingsTable } from "./club";

// ── Live locatie tijdens navigatie (Opdracht 4) ──────────────────────────────
// Locatiedeling is expliciet opt-in, tijdelijk en per navigatiesessie.
// Standaard staat delen UIT: zonder actieve sessie + grant bestaat er geen
// enkele leesroute naar iemands positie. Er wordt bewust GEEN
// locatiegeschiedenis bewaard: per sessie bestaat er hoogstens één
// positierij, die bij het beëindigen van de sessie wordt verwijderd.

export const liveLocationAudiences = ["vrienden", "groep"] as const;
export type LiveLocationAudience = (typeof liveLocationAudiences)[number];

export const liveLocationSessionsTable = pgTable(
  "live_location_sessions",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    audience: text("audience").notNull(), // vrienden | groep
    // Alleen gevuld bij audience "groep": de actieve clubtraining/groepsrit.
    clubTrainingId: integer("club_training_id").references(
      () => clubTrainingsTable.id,
      { onDelete: "cascade" },
    ),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // null = actief. Wordt gezet bij expliciet stoppen, einde navigatie,
    // einde rit of uitloggen. Server-side verloopt een sessie ook wanneer er
    // te lang geen positie meer is ontvangen (idle-verval).
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [index("live_location_sessions_user_idx").on(t.clerkId, t.endedAt)],
);

// Wie mag deze sessie zien. Bij "vrienden" één rij per gekozen vriend; bij
// "groep" één rij per mede-deelnemer op het moment van starten. Lezen wordt
// bij ELKE opvraging opnieuw server-side gecontroleerd (vriendschap nog
// geaccepteerd / deelname nog geldig) — een grant alleen is niet genoeg.
export const liveLocationGrantsTable = pgTable(
  "live_location_grants",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => liveLocationSessionsTable.id, { onDelete: "cascade" }),
    viewerClerkId: text("viewer_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (t) => [
    uniqueIndex("live_location_grants_unique").on(t.sessionId, t.viewerClerkId),
    index("live_location_grants_viewer_idx").on(t.viewerClerkId),
  ],
);

// Hoogstens één rij per sessie (upsert). Geen geschiedenis; de rij wordt
// verwijderd zodra de sessie eindigt.
export const liveLocationPositionsTable = pgTable("live_location_positions", {
  sessionId: integer("session_id")
    .primaryKey()
    .references(() => liveLocationSessionsTable.id, { onDelete: "cascade" }),
  lat: real("lat").notNull(),
  lon: real("lon").notNull(),
  // Bewegingsrichting alleen wanneer betrouwbaar (voldoende snelheid),
  // anders null — nooit een verzonnen richting.
  headingDeg: real("heading_deg"),
  speedMps: real("speed_mps"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type LiveLocationSession = typeof liveLocationSessionsTable.$inferSelect;
export type LiveLocationGrant = typeof liveLocationGrantsTable.$inferSelect;
export type LiveLocationPosition = typeof liveLocationPositionsTable.$inferSelect;
