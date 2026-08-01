import {
  pgTable,
  text,
  boolean,
  integer,
  real,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { userProfilesTable } from "./users";

// MEDIA_UITLEG_01 F4 — generieke gebruikersstatus voor mediacontent (deel 3 §2).
// Eén tabel voor ALLE mediacontent (lessen, uitleg, oefeningen, coach-
// toelichtingen); geen status per module. Eén rij per gebruiker per content-ID.
//
// Harde regels (deel 3 §3):
// - D-3 versiewisselregel: `lastReofferedVersion` registreert voor welke
//   contentversie al één her-aanbod is gedaan (hoogstens één keer per versie).
// - D-4 historie blijft: first_offered_at en tijdstempels worden nooit gewist
//   door overslaan of "niet meer tonen".
// - D-5 geen fictieve voortgang: velden zijn null tot er echt iets gemeten is.
// - D-7 cross-account: clerk_id zit in de sleutel; reads filteren er altijd op.
export const mediaContentStatusTable = pgTable(
  "media_content_status",
  {
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    contentId: text("content_id").notNull(),
    // Versie die de gebruiker het laatst zag/bevestigde.
    contentVersion: integer("content_version").notNull(),
    state: text("state").notNull(), // aangeboden|gestart|bekeken|voltooid|overgeslagen|uitgesteld|opnieuw_geopend
    firstOfferedAt: timestamp("first_offered_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    skippedAt: timestamp("skipped_at", { withTimezone: true }),
    dismissedUntil: timestamp("dismissed_until", { withTimezone: true }),
    doNotShowAgain: boolean("do_not_show_again").notNull().default(false),
    lastPositionSeconds: integer("last_position_seconds"),
    playbackSpeed: real("playback_speed"),
    // D-3: hoogste versie waarvoor al een her-aanbod is geregistreerd.
    lastReofferedVersion: integer("last_reoffered_version"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.clerkId, t.contentId] })],
);

export const insertMediaContentStatusSchema = createInsertSchema(
  mediaContentStatusTable,
);
export const selectMediaContentStatusSchema = createSelectSchema(
  mediaContentStatusTable,
);
export type MediaContentStatus = typeof mediaContentStatusTable.$inferSelect;
