import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { clubsTable, clubRaceEventsTable } from "./club";
import { userProfilesTable } from "./users";

// ── Werkobjectlaag (SPARKI_INHAAL_01 BUILD_02, besluitenpatch hoofdstuk C) ────
// W-B1 = A: ÉÉN gedeelde werkobjectlaag voor het hele product — koersplannen,
// trainingsweken, materiaalplannen, ouderbriefingen. Uitdrukkelijk GEEN 41
// losse documentmodellen, geen tweede rechtenlaag (clubrechten blijven de
// bron), geen tweede rapportgenerator.
//
// Levenscyclus: concept → gedeeld → afgerond. Een afgerond object mag alleen
// de ploegleider nog wijzigen. Delen doet de ploegleider expliciet (ook elke
// gewijzigde versie) — geen automatische notificatie. Wijzigingsgeschiedenis
// is alleen voor de ploegleider zichtbaar.

export const workObjectStatuses = ["concept", "gedeeld", "afgerond"] as const;

export const workObjectsTable = pgTable("work_objects", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id")
    .notNull()
    .references(() => clubsTable.id, { onDelete: "cascade" }),
  // Optionele koppeling aan een clubwedstrijd (koersplan). Andere typen
  // (trainingsweek, materiaalplan, ouderbriefing) laten dit leeg.
  eventId: integer("event_id").references(() => clubRaceEventsTable.id, {
    onDelete: "set null",
  }),
  objectType: text("object_type").notNull().default("koersplan"),
  title: text("title").notNull(),
  status: text("status").notNull().default("concept"), // concept | gedeeld | afgerond
  // Per wedstrijd bepaalt de ploegleider of staf elkaars deel mag aanpassen.
  stafMagElkaarsDeel: boolean("staf_mag_elkaars_deel").notNull().default(false),
  createdByClerkId: text("created_by_clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
  // Delen: expliciete actie van de ploegleider; eerste keer bericht ALLEEN
  // aan de staf, nooit aan de renners.
  sharedAt: timestamp("shared_at", { withTimezone: true }),
  sharedByClerkId: text("shared_by_clerk_id"),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  // Kopiëren/sjabloon: herkomst blijft zichtbaar.
  copiedFromId: integer("copied_from_id"),
  templateId: integer("template_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Onderdelen (secties). Elk deel toont wie het invulde, met datum en tijd.
// `vastOnderdeel` bepaalt wat bij kopiëren meegaat (bezetting gaat nooit mee).
// `version` draagt de gelijktijdig-bewerken-waarschuwing: schrijven met een
// verouderde basisversie levert een 409 op.
export const workObjectSectionsTable = pgTable("work_object_sections", {
  id: serial("id").primaryKey(),
  objectId: integer("object_id")
    .notNull()
    .references(() => workObjectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  // Vast onderdeel (gaat mee bij kopiëren) vs bezetting/situatiegebonden.
  vastOnderdeel: boolean("vast_onderdeel").notNull().default(true),
  // Eigenaar van het deel: staflid of renner die dit deel invult. Leeg =
  // vrij deel (ploegleider/staf naar beleid).
  ownerClerkId: text("owner_clerk_id"),
  content: text("content").notNull().default(""),
  version: integer("version").notNull().default(0),
  filledByClerkId: text("filled_by_clerk_id"),
  filledAt: timestamp("filled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Opmerkingen: iedereen (ook renners), alleen zichtbaar binnen het onderdeel.
export const workObjectCommentsTable = pgTable("work_object_comments", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id")
    .notNull()
    .references(() => workObjectSectionsTable.id, { onDelete: "cascade" }),
  authorClerkId: text("author_clerk_id").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Taken: verplicht afvinkbaar door degene die ze heeft; ploegleider krijgt
// bericht van het afvinken.
export const workObjectTasksTable = pgTable("work_object_tasks", {
  id: serial("id").primaryKey(),
  objectId: integer("object_id")
    .notNull()
    .references(() => workObjectsTable.id, { onDelete: "cascade" }),
  sectionId: integer("section_id").references(() => workObjectSectionsTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  assigneeClerkId: text("assignee_clerk_id").notNull(),
  createdByClerkId: text("created_by_clerk_id").notNull(),
  doneAt: timestamp("done_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Wijzigingsgeschiedenis — ALLEEN voor de ploegleider terug te kijken.
// Schrijven van content blijft ook staan wanneer een staflid de club verlaat
// (rijen worden nooit aan lidmaatschap gekoppeld verwijderd).
export const workObjectHistoryTable = pgTable("work_object_history", {
  id: serial("id").primaryKey(),
  objectId: integer("object_id")
    .notNull()
    .references(() => workObjectsTable.id, { onDelete: "cascade" }),
  sectionId: integer("section_id"),
  actorClerkId: text("actor_clerk_id").notNull(),
  action: text("action").notNull(), // aangemaakt | deel_ingevuld | status_gewijzigd | gedeeld | taak_afgevinkt | ...
  detail: jsonb("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Clubsjablonen: vaste onderdelen als herbruikbare structuur.
export const workObjectTemplatesTable = pgTable(
  "work_object_templates",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    objectType: text("object_type").notNull().default("koersplan"),
    // [{ title, position, vastOnderdeel }] — géén bezetting, géén inhoud.
    sections: jsonb("sections").notNull(),
    createdByClerkId: text("created_by_clerk_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("work_object_templates_unique").on(t.clubId, t.name)],
);

export type WorkObject = typeof workObjectsTable.$inferSelect;
export type WorkObjectSection = typeof workObjectSectionsTable.$inferSelect;
export type WorkObjectTask = typeof workObjectTasksTable.$inferSelect;
