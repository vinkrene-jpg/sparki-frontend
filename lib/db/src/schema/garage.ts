import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
  boolean,
  date,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
  // Losse aandrijf-/stuuronderdelen — zo kan een renner ook één afwijkend
  // onderdeel vastleggen (bijv. alleen een Dura-Ace achterderailleur op een
  // verder Ultegra-fiets).
  "achterderailleur",
  "voorderailleur",
  "crankstel",
  "cassette",
  "ketting",
  "remmen",
  "cockpit",
  "zadel",
  "pedalen",
  "onderdeel", // overig los onderdeel dat niet in een vaste categorie past
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
  // Bouwjaar van de fiets (bijv. 2023). Null = onbekend.
  buildYear: integer("build_year"),
  // Gebruiksdoel in klare taal (bijv. "training", "wedstrijd", "woon-werk").
  purpose: text("purpose"),
  // "actief" | "archief" — een gearchiveerde fiets blijft bestaan (historie!)
  // maar doet niet meer mee in auto-koppeling en materiaalkeuze-voorstellen.
  status: text("status").notNull().default("actief"),
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
  // Uitvoering/variant (bijv. "Di2 12-speed", "C50 tubeless"). Optioneel —
  // alleen wat de gebruiker echt weet wordt vastgelegd.
  variant: text("variant"),
  // Bouwjaar of generatie (bijv. 2023 of "R9200-generatie" → jaartal).
  modelYear: integer("model_year"),
  // "mechanisch" | "elektronisch" — alleen zinvol voor aandrijfonderdelen.
  actuation: text("actuation"),
  // Aantal versnellingen (bijv. 11, 12). Null = onbekend/n.v.t.
  speeds: integer("speeds"),
  notes: text("notes"),
  // Montagedatum (YYYY-MM-DD). Gebruik (km/uren) wordt ALTIJD afgeleid uit
  // gekoppelde activiteiten vanaf deze datum — nooit als teller bijgehouden.
  installedAt: date("installed_at"),
  // Herkomst van deze registratie: "handmatig" | "scan" | "import".
  source: text("source").notNull().default("handmatig"),
  // Automatische herkenning (source="scan") begint onbevestigd; de gebruiker
  // bevestigt of corrigeert. Handmatige invoer is per definitie bevestigd.
  confirmed: boolean("confirmed").notNull().default(true),
  // "in_gebruik" | "vervangen" | "defect_vermoed" | "defect_vastgesteld".
  // "defect_vastgesteld" komt UITSLUITEND uit een gebruikersmelding/event,
  // nooit uit een foto-analyse.
  status: text("status").notNull().default("in_gebruik"),
  // Bewijs-/detailfoto's (object-storage paden), eigenaar-gecontroleerd.
  photoPaths: jsonb("photo_paths").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Fietsscan — begeleide opname van de eigen fiets (identiteitscheck-stijl).
//
// Eén scan is één begeleide sessie voor één fiets. Elke goedgekeurde stap
// levert een frame op: het ORIGINELE beeld blijft altijd bewaard
// (originalPath) en na achtergrondverwijdering komt daar een vrijstaand PNG
// bij (cutoutPath). Kwaliteitsmetingen (licht/scherpte/beweging/kadrering)
// worden per frame vastgelegd zoals ze op het moment van opname zijn gemeten —
// nooit achteraf verzonnen.

export const bikeScanSteps = [
  "volledig", // volledige fiets in het kader (linkerzijde, referentie)
  "links", // linkerzijde
  "voorzijde", // rond de voorzijde bewegen
  "rechts", // rechterzijde
  "aandrijving", // detailopname crank/cassette/derailleur
  "wielen", // detailopname wielen
  "cockpit", // detailopname stuur/cockpit
] as const;
export type BikeScanStep = (typeof bikeScanSteps)[number];

export type BikeScanFrameQuality = {
  // 0..1 gemiddelde luminantie van het beeld.
  brightness: number;
  // Laplacian-variantie als scherptemaat (hoger = scherper).
  sharpness: number;
  // 0..1 aandeel gewijzigde pixels t.o.v. het vorige frame (bewegingsmaat).
  motion: number;
  // 0..1 aandeel van het kader dat door het onderwerp wordt gevuld.
  coverage: number;
};

export const bikeScansTable = pgTable("bike_scans", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  bikeId: integer("bike_id")
    .notNull()
    .references(() => garageBikesTable.id, { onDelete: "cascade" }),
  // "bezig" | "afgerond" | "afgebroken"
  status: text("status").notNull().default("bezig"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const bikeScanFramesTable = pgTable("bike_scan_frames", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  scanId: integer("scan_id")
    .notNull()
    .references(() => bikeScansTable.id, { onDelete: "cascade" }),
  bikeId: integer("bike_id")
    .notNull()
    .references(() => garageBikesTable.id, { onDelete: "cascade" }),
  step: text("step").notNull(),
  // Volgorde binnen de scan (rondom-frames voor 360-weergave).
  seq: integer("seq").notNull().default(0),
  // Origineel beeld — altijd bewaard.
  originalPath: text("original_path").notNull(),
  // Vrijstaand PNG (transparante achtergrond) — null zolang de
  // achtergrondverwijdering nog niet gelukt/goedgekeurd is.
  cutoutPath: text("cutout_path"),
  quality: jsonb("quality").$type<BikeScanFrameQuality>(),
  approved: integer("approved").notNull().default(0), // 0/1 — door checks goedgekeurd
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Productbeelden voor onderdelen (groepset/wielen) — uitsluitend met
// herkomst. Elke rij is één beeld gekoppeld aan één garage-component, met
// verplichte bron en licentiestatus. Geen scraping; alleen bronnen waarvan
// hergebruik is toegestaan of een handmatige upload door de eigenaar.

export const equipmentAssetSources = [
  "fabrikant", // officiële fabrikantbron
  "distributeur", // officiële distributeur
  "catalogus", // gecontroleerde productcatalogus
  "upload", // handmatige upload door beheerder of gebruiker
] as const;
export type EquipmentAssetSource = (typeof equipmentAssetSources)[number];

export const equipmentAssetsTable = pgTable("equipment_assets", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  componentId: integer("component_id")
    .notNull()
    .references(() => garageComponentsTable.id, { onDelete: "cascade" }),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  variant: text("variant"),
  // Herkomst — verplicht en beperkt tot de vier toegestane brontypes.
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  // Gebruiksrecht in klare taal (bijv. "eigen foto", "perskit — vrij voor
  // productweergave"). Verplicht: zonder duidelijke licentie geen beeld.
  license: text("license").notNull(),
  imagePath: text("image_path").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Draadloze onderdelen — Bluetooth sensors and wireless equipment. A sensor
// belongs to the athlete and optionally to one bike (bikeId null = loose gear
// such as a heart-rate strap that travels with the body, not a bike). Whether a
// kind can be live-paired in the browser is DERIVED from the kind (standard
// Bluetooth GATT profiles: power, heart rate, cadence/speed) — a watch or an
// electronic derailleur uses proprietary protocols the browser cannot read, so
// those are registered as equipment only, never shown as live-linkable.

export const garageSensorKinds = [
  "wattagemeter",
  "hartslagmeter",
  "cadans_snelheid",
  "horloge",
  "derailleur",
] as const;
export type GarageSensorKind = (typeof garageSensorKinds)[number];

// Kinds with a standard Bluetooth profile the browser can pair with live.
export const pairableSensorKinds: readonly GarageSensorKind[] = [
  "wattagemeter",
  "hartslagmeter",
  "cadans_snelheid",
] as const;

export const garageSensorsTable = pgTable("garage_sensors", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  // Null = loose sensor (not tied to one bike). A deleted bike releases its
  // sensors instead of destroying them — the device still exists.
  bikeId: integer("bike_id").references(() => garageBikesTable.id, {
    onDelete: "set null",
  }),
  kind: text("kind").notNull(),
  brand: text("brand"),
  model: text("model"),
  // Bluetooth advertising name captured during a real pairing (pairable kinds
  // only) — used to recognise the device again at ride start.
  deviceName: text("device_name"),
  // Optional plain-text battery note (e.g. "CR2032, vervangen mrt 2026").
  batteryNote: text("battery_note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Componentgebeurtenissen — onderhoud, reparaties, vervangingen, controles en
// vastgestelde defecten per component. Dit is het logboek waaruit de
// onderhoudshistorie en de "vastgesteld defect"-status komen. Een vervanging
// start een nieuwe gebruikshistorie: de route zet dan ook installedAt van het
// component op de vervangingsdatum (gebruik wordt afgeleid vanaf die datum).

export const componentEventTypes = [
  "onderhoud",
  "reparatie",
  "vervanging",
  "controle",
  "defect_vastgesteld",
] as const;
export type ComponentEventType = (typeof componentEventTypes)[number];

export const componentEventsTable = pgTable("component_events", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  componentId: integer("component_id")
    .notNull()
    .references(() => garageComponentsTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  eventDate: date("event_date").notNull(),
  note: text("note"),
  // Werkelijke afgeleide kilometerstand van het component op het moment van
  // het event (uit gekoppelde activiteiten) — vastgelegd als momentopname.
  kmAtEvent: numeric("km_at_event", { precision: 9, scale: 1 }),
  // Bewijsfoto's (object-storage paden), eigenaar-gecontroleerd geserveerd.
  photoPaths: jsonb("photo_paths").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Materiaalkeuze per wedstrijd of training — welke fiets/wielen/banden/druk/
// cassette de renner kiest. Advies wordt live berekend uit ECHTE gegevens
// (parcours, weer, onderhoudssignalen); alleen de KEUZE wordt opgeslagen.

export const equipmentChoicesTable = pgTable(
  "equipment_choices",
  {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  // Precies één context: een wedstrijd (raceId) óf een geplande training
  // (workoutId). Beide null is ongeldig (route-guard).
  raceId: integer("race_id"),
  workoutId: integer("workout_id"),
  bikeId: integer("bike_id").references(() => garageBikesTable.id, {
    onDelete: "set null",
  }),
  wheels: text("wheels"),
  tires: text("tires"),
  // Bandendruk in bar (bijv. 4.8). Null = nog niet gekozen.
  pressureBar: numeric("pressure_bar", { precision: 4, scale: 2 }),
  cassette: text("cassette"),
  other: text("other"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  },
  (t) => [
    // Precies één keuze per doel — partiële unieke indexen zodat de route een
    // atomische ON CONFLICT-upsert kan doen (geen read-then-write race).
    uniqueIndex("equipment_choices_race_uq")
      .on(t.clerkId, t.raceId)
      .where(sql`${t.raceId} IS NOT NULL`),
    uniqueIndex("equipment_choices_workout_uq")
      .on(t.clerkId, t.workoutId)
      .where(sql`${t.workoutId} IS NOT NULL`),
  ],
);

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

export const insertComponentEventSchema = createInsertSchema(
  componentEventsTable,
).omit({ id: true });
export const selectComponentEventSchema =
  createSelectSchema(componentEventsTable);
export const insertEquipmentChoiceSchema = createInsertSchema(
  equipmentChoicesTable,
).omit({ id: true });
export const selectEquipmentChoiceSchema =
  createSelectSchema(equipmentChoicesTable);

export type ComponentEvent = typeof componentEventsTable.$inferSelect;
export type InsertComponentEvent = z.infer<typeof insertComponentEventSchema>;
export type EquipmentChoice = typeof equipmentChoicesTable.$inferSelect;
export type InsertEquipmentChoice = z.infer<typeof insertEquipmentChoiceSchema>;

export type GarageBike = typeof garageBikesTable.$inferSelect;
export type InsertGarageBike = z.infer<typeof insertGarageBikeSchema>;
export type GarageComponent = typeof garageComponentsTable.$inferSelect;
export type InsertGarageComponent = z.infer<typeof insertGarageComponentSchema>;
