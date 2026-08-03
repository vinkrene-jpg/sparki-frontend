import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./users";

// ── TRAININGSVORMEN_01 — bibliotheek van trainingsvormen (TRV-61) ────────────
// Eén centrale bibliotheek voor weg, indoor, baan, kracht, mobiliteit,
// techniek en wandelen (TRV-10). Een vorm is een FAMILIE met een
// parameterbereik, geen losse workout. Dit is een laag BOVEN het bestaande
// trainingsobject (planned_workouts.structure / WorkoutBlock) — uitdrukkelijk
// géén tweede workout-datamodel (TRV-22, F0-inventarisatie punt 1).

// Disciplines volgen het pakket letterlijk (bindende NL-domeinwaarden).
export const trainingFormDisciplines = [
  "weg",
  "indoor",
  "baan",
  "kracht",
  "mobiliteit",
  "techniek",
  "wandelen",
] as const;

// Tweede as (TRV-13/TRV-29): belastingssoort, zodat baan- en krachtvormen
// nooit als "verwaarloosbaar" tonen.
export const belastingssoorten = [
  "aeroob_duur",
  "aeroob_hoog",
  "anaeroob",
  "neuromusculair",
  "kracht",
  "techniek_licht",
  "herstel",
] as const;
export type Belastingssoort = (typeof belastingssoorten)[number];

// Drie onderbouwingslabels (TRV-14). Tot de inschalingsopdracht (TRV-94) is
// uitgevoerd staat elke Sparki-vorm op "praktijkvorm" met toelichting
// "nog niet ingeschaald" — de veiligste stand, hij belooft niets.
export const onderbouwingsniveaus = ["onderbouwd", "beperkt", "praktijkvorm"] as const;

export const trainingFormsTable = pgTable(
  "training_forms",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    naam: text("naam").notNull(),
    discipline: text("discipline").notNull(), // trainingFormDisciplines
    categorie: text("categorie").notNull(), // bv. "Tempo en drempel" (bijlage A)
    belastingssoort: text("belastingssoort").notNull(), // belastingssoorten
    doel: text("doel"),
    effect: text("effect"), // beschrijvend; NOOIT een prestatiebelofte (TRV-55)
    uitleg: text("uitleg"), // zonder geschreven uitleg → status "concept" (TRV-27)
    gebruik: text("gebruik"), // hoe uit te voeren
    veelgemaakteFouten: text("veelgemaakte_fouten"),
    onderbouwingsniveau: text("onderbouwingsniveau").notNull().default("praktijkvorm"),
    onderbouwingstoelichting: text("onderbouwingstoelichting")
      .notNull()
      .default("nog niet ingeschaald"),
    // Leeftijdsgeschiktheid: minimumleeftijd in jaren; null = alle leeftijden.
    // Jeugdgrenzen gelden daarnaast op parameterniveau (TRV-69).
    minimumLeeftijd: integer("minimum_leeftijd"),
    eigenaarType: text("eigenaar_type").notNull().default("sparki"), // sparki | trainer
    eigenaarClerkId: text("eigenaar_clerk_id").references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    // Zichtbaarheid (TRV-45): sparki (voor iedereen) | prive (eigen sporters
    // van de trainer) | marktplaats. Standaard bij trainersvorm: prive.
    zichtbaarheid: text("zichtbaarheid").notNull().default("sparki"),
    // Afspraakvormen (TRV-11/TRV-50): niet sleepbaar, maken een agenda-item.
    vereistAfspraak: boolean("vereist_afspraak").notNull().default(false),
    versie: integer("versie").notNull().default(1),
    // concept | gepubliceerd | ingetrokken — concept is niet zichtbaar voor
    // sporters (TRV-27); levenscyclus trainersvorm via werkobjectdenkwijze (TRV-44).
    status: text("status").notNull().default("concept"),
    laatsteControle: timestamp("laatste_controle", { withTimezone: true }),
    mediaRef: text("media_ref"), // verwijzing naar MEDIA_UITLEG_01-inhoud
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("training_forms_slug_uq").on(t.slug),
    index("training_forms_discipline_idx").on(t.discipline),
    index("training_forms_eigenaar_idx").on(t.eigenaarClerkId),
  ],
);

// Parameterbereiken van de familie (TRV-61). De sporter mag duur én
// intensiteit aanpassen binnen deze bereiken (TRV-17/TRV-39).
export const trainingFormParametersTable = pgTable(
  "training_form_parameters",
  {
    id: serial("id").primaryKey(),
    formId: integer("form_id")
      .notNull()
      .references(() => trainingFormsTable.id, { onDelete: "cascade" }),
    duurMinuten: integer("duur_min"),
    duurMaxMinuten: integer("duur_max"),
    duurStandaardMinuten: integer("duur_standaard"),
    // pct_ftp | zone | rpe | kg | herhalingen — bepaalt de eenheid van de
    // intensiteitsvelden hieronder.
    intensiteitsmaat: text("intensiteitsmaat"),
    intensiteitMin: integer("intensiteit_min"),
    intensiteitMax: integer("intensiteit_max"),
    intensiteitStandaard: integer("intensiteit_standaard"),
    herhalingenMin: integer("herhalingen_min"),
    herhalingenMax: integer("herhalingen_max"),
    pauzeMinMinuten: integer("pauze_min"),
    pauzeMaxMinuten: integer("pauze_max"),
    // Blokopbouw als hergebruik van het BESTAANDE blokformaat
    // (WorkoutBlock-vorm uit planned_workouts.structure) — geen tweede model.
    blokken: jsonb("blokken"),
  },
  (t) => [uniqueIndex("training_form_parameters_form_uq").on(t.formId)],
);

// Bronnen per vorm (TRV-61). Bronnen worden nooit verzonnen (TRV-27):
// zonder echte bron blijft deze tabel voor die vorm leeg en zegt de
// toelichting eerlijk "nog niet ingeschaald".
export const trainingFormSourcesTable = pgTable(
  "training_form_sources",
  {
    id: serial("id").primaryKey(),
    formId: integer("form_id")
      .notNull()
      .references(() => trainingFormsTable.id, { onDelete: "cascade" }),
    brontype: text("brontype").notNull(), // artikel | boek | richtlijn | praktijk
    titel: text("titel").notNull(),
    uitgever: text("uitgever"),
    jaar: integer("jaar"),
    url: text("url"),
    laag: text("laag").notNull().default("vindlaag"), // vindlaag | bewijslaag
    toelichting: text("toelichting"),
  },
  (t) => [index("training_form_sources_form_idx").on(t.formId)],
);
