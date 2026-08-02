import {
  pgTable,
  serial,
  text,
  integer,
  date,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";
import { racesTable } from "./races";

// ── Journey ──────────────────────────────────────────────────────────────────
// De persoonlijke wieler-Journey is een SAMENGESTELDE tijdlijn: wedstrijden,
// trainingen, doelen, records en materiaal komen live uit hun bestaande
// tabellen (races, training_sessions, goal_events, garage_components) — die
// worden hier NOOIT gedupliceerd. Deze tabellen bevatten alleen wat nergens
// anders bestaat:
//   1. journey_items — handmatige mijlpalen, trainingskampen en
//      blessure-/herstelperiodes als verhaal-momenten. (De Leefagenda blijft
//      het plan-sturende systeem; deze items sturen het plan bewust NIET.)
//   2. journey_media — foto's/video's per Journey-onderwerp, met onderschrift,
//      volgorde en zichtbaarheid per item. Standaard altijd privé.
//   3. journey_reflections — het wedstrijddossier-deel dat de renner zelf
//      schrijft (terugblik, les, vervolgactie) plus de correctie van de
//      automatische activiteit-koppeling.

export const JOURNEY_ITEM_KINDS = [
  "mijlpaal",
  "trainingskamp",
  "blessure_herstel",
] as const;
export type JourneyItemKind = (typeof JOURNEY_ITEM_KINDS)[number];

export const journeyItemsTable = pgTable(
  "journey_items",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    kind: text("kind").$type<JourneyItemKind>().notNull(),
    title: text("title").notNull(),
    description: text("description"),
    startDate: date("start_date").notNull(),
    // Inclusief; null = één dag.
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("journey_items_clerk_idx").on(t.clerkId, t.startDate)],
);

// Onderwerp-typen waaraan media gekoppeld kunnen worden.
export const JOURNEY_MEDIA_SUBJECTS = ["race", "session", "item"] as const;
export type JourneyMediaSubject = (typeof JOURNEY_MEDIA_SUBJECTS)[number];

// Zichtbaarheid per media-item. "prive" = alleen de eigenaar; "gedeeld" =
// mag in een door de gebruiker samengestelde deelkaart worden opgenomen.
// Er bestaat GEEN publieke zichtbaarheid zonder expliciete keuze; voor
// minderjarigen wordt "gedeeld" op de route geweigerd.
export const JOURNEY_MEDIA_VISIBILITY = ["prive", "gedeeld"] as const;
export type JourneyMediaVisibility = (typeof JOURNEY_MEDIA_VISIBILITY)[number];

export const journeyMediaTable = pgTable(
  "journey_media",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    subjectType: text("subject_type").$type<JourneyMediaSubject>().notNull(),
    // Soft reference (races.id / training_sessions.id / journey_items.id);
    // eigendom wordt in de route-laag afgedwongen. Soft zodat een verwijderde
    // activiteit de Journey-media niet meesleept — het verhaal blijft bestaan.
    subjectId: integer("subject_id").notNull(),
    // Genormaliseerd object-storage pad ("/objects/uploads/<uuid>") van een
    // echte upload via de presign-flow. ACL wordt pas gezet als de bytes er
    // echt staan (persist), nooit ervoor.
    objectPath: text("object_path").notNull(),
    // F11: centrale files-rij als bron van waarheid voor deze media (veiligheids-
    // poort, intrekbaarheid via revokedAt, retentie). Nullable: legacy-media van
    // vóór de omlegging heeft geen fileId en blijft werken via objectPath (lazy
    // koppeling — geen destructieve backfill). Video's blijven buiten de centrale
    // her-encoding-poort (die dekt alleen beeld/PDF) en houden fileId null.
    fileId: integer("file_id"),
    mediaType: text("media_type").notNull(), // bijv. "image/jpeg", "video/mp4"
    caption: text("caption"),
    sortIndex: integer("sort_index").notNull().default(0),
    visibility: text("visibility")
      .$type<JourneyMediaVisibility>()
      .notNull()
      .default("prive"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("journey_media_subject_idx").on(
      t.clerkId,
      t.subjectType,
      t.subjectId,
    ),
  ],
);

// Hoe de activiteit aan een wedstrijd hangt:
//   "auto"   — Sparki koppelt op datum (beste match); herleidbaar en
//              corrigeerbaar.
//   "manual" — de renner koos zelf een activiteit (linkedSessionId).
//   "none"   — de renner gaf aan dat er geen activiteit bij hoort.
export const JOURNEY_LINK_MODES = ["auto", "manual", "none"] as const;
export type JourneyLinkMode = (typeof JOURNEY_LINK_MODES)[number];

export const journeyReflectionsTable = pgTable(
  "journey_reflections",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    raceId: integer("race_id")
      .notNull()
      .references(() => racesTable.id, { onDelete: "cascade" }),
    // Persoonlijke terugblik in eigen woorden.
    reflection: text("reflection"),
    // Belangrijkste les uit deze wedstrijd.
    lesson: text("lesson"),
    // Concrete vervolgactie.
    nextAction: text("next_action"),
    linkMode: text("link_mode").$type<JourneyLinkMode>().notNull().default("auto"),
    // Alleen gevuld bij linkMode "manual". Soft reference naar
    // training_sessions.id: een verwijderde activiteit beschadigt het dossier
    // niet — de koppeling wordt dan eerlijk als "activiteit verwijderd" getoond.
    linkedSessionId: integer("linked_session_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("journey_reflections_race_uq").on(t.clerkId, t.raceId)],
);

export const insertJourneyItemSchema = createInsertSchema(
  journeyItemsTable,
).omit({ id: true });
export const insertJourneyMediaSchema = createInsertSchema(
  journeyMediaTable,
).omit({ id: true });
export const insertJourneyReflectionSchema = createInsertSchema(
  journeyReflectionsTable,
).omit({ id: true });

export type JourneyItem = typeof journeyItemsTable.$inferSelect;
export type InsertJourneyItem = z.infer<typeof insertJourneyItemSchema>;
export type JourneyMedia = typeof journeyMediaTable.$inferSelect;
export type InsertJourneyMedia = z.infer<typeof insertJourneyMediaSchema>;
export type JourneyReflection = typeof journeyReflectionsTable.$inferSelect;
export type InsertJourneyReflection = z.infer<
  typeof insertJourneyReflectionSchema
>;
