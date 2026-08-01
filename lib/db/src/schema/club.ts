import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { userProfilesTable } from "./users";

// ── Clubomgeving ──────────────────────────────────────────────────────────────
// Echte clubentiteit voor wielerverenigingen. Uitbreidend gebouwd naast de
// bestaande peer-links (coach/ouder): een club heeft leden met clubrollen,
// teams, trainingsgroepen, clubtrainingen, wedstrijdbeheer, communicatie,
// jeugd-toestemming, pakket/limieten en een append-only auditlog.
//
// Ontwerpprincipes:
// - user_profiles blijft de enige ledenbron (geen dubbele ledenlijst).
// - Lidmaatschap is historisch: uitschrijven zet endedAt, verwijdert nooit.
// - Least privilege: rollen bepalen wat een API teruggeeft; sportdata alleen
//   via expliciete consent (club_consents), nooit automatisch.

export const clubRoles = [
  "owner", // clubeigenaar
  "admin", // clubbeheerder
  "hoofdtrainer", // trainerrechten + trainer-toewijzingen beheren
  "trainer",
  "assistent", // helpt bij trainingen (aanwezigheid), geen sportdata-inzage
  "teammanager",
  // HERSTEL TEAM_ABONNEMENT_01: ploegleider is een APARTE server-side rol
  // (eerdere aanname ploegleider==teammanager is vervallen/SUPERSEDED).
  "ploegleider",
  "mechanieker", // mag materiaalvelden bijwerken, verder alleen-lezen
  "member", // lid (renner) — gebruikersnaam "Sporter"
  "parent", // ouder/verzorger
  "vrijwilliger", // leest kalender/berichten, geen beheer
  "alleen_lezen", // strikt alleen-lezen — gebruikersnaam "Gast"
  // TEAM_ABONNEMENT_01: begeleidende teamrollen. Least privilege — geen
  // beheerrechten, geen automatische sportdata-inzage (consent blijft leidend).
  "soigneur", // verzorger: kalender/berichten, geen beheer of sportdata
  // HERSTEL TEAM_ABONNEMENT_01: "medic" heet nu "medical_staff" (met
  // beschrijvend functietype zonder zelfstandige rechten).
  "medical_staff", // medische staf: kalender/berichten; sportdata alleen via consent
] as const;
export type ClubRole = (typeof clubRoles)[number];

// Beschrijvend functietype voor medical_staff. Geeft GEEN zelfstandige
// rechten — puur label voor wie welke medische functie vervult.
export const medicalSpecialties = [
  "arts",
  "fysiotherapeut",
  "dietist",
  "sportpsycholoog",
  "inspanningsfysioloog",
  "overig",
] as const;
export type MedicalSpecialty = (typeof medicalSpecialties)[number];

// Clubstatus (commerciële voorbereiding): beperkt = geen nieuwe toevoegingen,
// geschorst/beeindigd = alleen-lezen voor iedereen behalve eigenaar/beheer.
// CLUB_ONBOARDING_01: "concept" = club in oprichting — geen uitnodigingen,
// geen leden zichtbaar voor anderen, activatie zet hem op "actief".
export const clubStatuses = ["concept", "actief", "beperkt", "geschorst", "beeindigd"] as const;
export type ClubStatus = (typeof clubStatuses)[number];

// Beschikbare modules per club (aan/uit); default alles aan.
export const clubModules = ["trainingen", "wedstrijden", "berichten", "materiaal"] as const;
export type ClubModule = (typeof clubModules)[number];

export const clubsTable = pgTable("clubs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location"),
  // Alleen wielrennen in scope; veld bestaat voor eerlijkheid/expliciete waarde.
  sport: text("sport").notNull().default("wielrennen"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  website: text("website"),
  // Clubstatus: actief | beperkt | geschorst | beeindigd.
  status: text("status").notNull().default("actief"),
  // Beschikbare modules (jsonb array van clubModules-sleutels); null = alles.
  modules: jsonb("modules"),
  // Korte deelnamecode ("clubcode") waarmee bestaande accounts kunnen
  // aansluiten zonder persoonlijke uitnodiging. Regenereerbaar door beheer.
  // Uniek zodat een code nooit naar meerdere clubs kan wijzen.
  joinCode: text("join_code").unique(),
  ownerClerkId: text("owner_clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "restrict", onUpdate: "cascade" }),
  // Releasegroep voor gecontroleerde uitrol (pilotclubs): default productie.
  releaseGroup: text("release_group").notNull().default("productie"),
  // WP-03: soort organisatie (club | vereniging | ploeg | school | anders).
  // Additief; bestaande rijen blijven gewoon "club".
  organisationKind: text("organisation_kind").notNull().default("club"),
  // TEAM_ONBOARDING_01 (besluitendoc 01-08-2026): organisatietype op de
  // BESTAANDE container — géén tweede organisatie-entiteit. "CLUB" =
  // clubomgeving, "TEAM" = zelfstandige wedstrijdteam-organisatie.
  // organisationKind blijft het beschrijvende subtype.
  organisationType: text("organisation_type").notNull().default("CLUB"),
  // Gekozen organogram-kaart tijdens de team-onboarding. Puur conceptstructuur:
  // de kaart leidt NOOIT rechten af en is nooit destructief (bindende regels §3).
  organogramTemplate: text("organogram_template"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Lidmaatschappen — actief (endedAt null) en historisch (endedAt gezet).
// Eén actieve rij per (club, gebruiker); heraansluiten maakt een nieuwe rij
// zodat de historie intact blijft.
export const clubMembersTable = pgTable(
  "club_members",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    role: text("role").notNull().default("member"),
    // Alleen voor rol medical_staff: beschrijvend functietype (arts,
    // fysiotherapeut, …). Geen zelfstandige rechten.
    medicalSpecialty: text("medical_specialty"),
    // Vrij label, bv. "hoofdtrainer jeugd".
    label: text("label"),
    // BB-11 (besluitenpatch 2026-08-01, versoepeld): VOG-registratie — alleen
    // relevant voor STRUCTURELE functies die met jeugd werken. Geen upload;
    // de club vinkt aan dat een VOG getoond is, mét afgiftedatum. Ouder dan
    // 3 jaar ⇒ waarschuwing (afgeleid, niet opgeslagen). Gasten/incidentele
    // vrijwilligers vallen erbuiten.
    vogIssuedOn: date("vog_issued_on"),
    vogRecordedAt: timestamp("vog_recorded_at", { withTimezone: true }),
    vogRecordedByClerkId: text("vog_recorded_by_clerk_id"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedReason: text("ended_reason"),
    endedByClerkId: text("ended_by_clerk_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Eén ACTIEF lidmaatschap per club per gebruiker (historie mag meermaals).
    uniqueIndex("club_members_active_unique")
      .on(t.clubId, t.clerkId)
      .where(sql`ended_at IS NULL`),
    index("club_members_club_idx").on(t.clubId),
    index("club_members_clerk_idx").on(t.clerkId),
  ],
);

export const clubTeamsTable = pgTable("club_teams", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id")
    .notNull()
    .references(() => clubsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  // Categorie/niveau/seizoen in gewone taal, bv. "U15", "wedstrijd", "2026".
  category: text("category"),
  level: text("level"),
  season: text("season"),
  // Vaste trainingsdagen (jsonb array, bv. ["dinsdag","donderdag"]).
  trainingDays: jsonb("training_days"),
  defaultLocation: text("default_location"),
  maxSize: integer("max_size"),
  // Korte teamcode om direct bij dit team aan te sluiten (uniek).
  joinCode: text("join_code").unique(),
  // Teammanager is een clublid met rol teammanager; hier de aanwijzing per team.
  managerClerkId: text("manager_clerk_id"),
  // WP-03: selectie/subteam-hiërarchie — een selectie is een team met een
  // parentTeamId. Nullable en additief; bestaande teams blijven gewoon geldig.
  parentTeamId: integer("parent_team_id"),
  // WP-03: optionele koppeling aan een seizoen (club_seasons). Nullable.
  seasonId: integer("season_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clubGroupsTable = pgTable("club_groups", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id")
    .notNull()
    .references(() => clubsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  // Niveau in gewone taal, bv. "jeugd U15", "recreanten", "wedstrijd".
  level: text("level"),
  season: text("season"),
  trainingDays: jsonb("training_days"),
  defaultLocation: text("default_location"),
  maxSize: integer("max_size"),
  trainerClerkId: text("trainer_clerk_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── WP-03: Seizoenen ─────────────────────────────────────────────────────────
// Eén duidelijke actieve seizoencontext per organisatie (partial unique).
// Afsluiten zet status op "afgesloten" — historie blijft leesbaar, nooit DELETE.
export const clubSeasonStatuses = ["actief", "gepland", "afgesloten"] as const;
export type ClubSeasonStatus = (typeof clubSeasonStatuses)[number];

export const clubSeasonsTable = pgTable(
  "club_seasons",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // bv. "2026" of "2026–2027"
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    status: text("status").notNull().default("actief"),
    createdByClerkId: text("created_by_clerk_id"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("club_seasons_one_active_unique")
      .on(t.clubId)
      .where(sql`status = 'actief'`),
    index("club_seasons_club_idx").on(t.clubId),
  ],
);

export type ClubSeason = typeof clubSeasonsTable.$inferSelect;

// Indeling van leden in teams en trainingsgroepen.
export const clubTeamMembersTable = pgTable(
  "club_team_members",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => clubTeamsTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    role: text("role").notNull().default("renner"), // renner | reserve | begeleider
    // Historie: verlaten zet endedAt, verwijdert de rij nooit.
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("club_team_members_active_unique")
      .on(t.teamId, t.clerkId)
      .where(sql`ended_at IS NULL`),
  ],
);

export const clubGroupMembersTable = pgTable(
  "club_group_members",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => clubGroupsTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("club_group_members_active_unique")
      .on(t.groupId, t.clerkId)
      .where(sql`ended_at IS NULL`),
  ],
);

// ── Vaste clublocaties & parcoursen ──────────────────────────────────────────
// Herbruikbare verzamel-/trainingslocaties; optioneel gekoppeld aan een
// bestaande route (soft reference, eigendom in de routelaag gecontroleerd).
export const clubLocationsTable = pgTable(
  "club_locations",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    routeId: integer("route_id"),
    notes: text("notes"),
    createdByClerkId: text("created_by_clerk_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("club_locations_club_idx").on(t.clubId)],
);

// Trainers toegewezen aan een team of groep zien alleen sporters BINNEN die
// toewijzing (en alleen met consent). Toewijzing is expliciet, nooit impliciet.
export const clubTrainerAssignmentsTable = pgTable(
  "club_trainer_assignments",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    trainerClerkId: text("trainer_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    // Precies één van beide is gezet.
    teamId: integer("team_id").references(() => clubTeamsTable.id, { onDelete: "cascade" }),
    groupId: integer("group_id").references(() => clubGroupsTable.id, { onDelete: "cascade" }),
    // WP-03: contextgebonden toewijzing — geldigheidsvenster + seizoen.
    // Nullable/additief: bestaande toewijzingen blijven zonder venster geldig.
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    seasonId: integer("season_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("club_trainer_team_unique")
      .on(t.trainerClerkId, t.teamId)
      .where(sql`team_id IS NOT NULL`),
    uniqueIndex("club_trainer_group_unique")
      .on(t.trainerClerkId, t.groupId)
      .where(sql`group_id IS NOT NULL`),
  ],
);

// ── Clubtrainingen ────────────────────────────────────────────────────────────
export const clubTrainingsTable = pgTable(
  "club_trainings",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    trainingDate: date("training_date").notNull(),
    startTime: text("start_time"), // "HH:MM"
    location: text("location"),
    // Soft reference naar routes (zoals planned_workouts.routeId); eigendom
    // wordt in de routelaag gecontroleerd.
    routeId: integer("route_id"),
    level: text("level"),
    goal: text("goal"), // trainingsdoel in gewone taal
    trainerClerkId: text("trainer_clerk_id"),
    // Doelgroep: hele club, een team of een groep.
    teamId: integer("team_id").references(() => clubTeamsTable.id, { onDelete: "set null" }),
    groupId: integer("group_id").references(() => clubGroupsTable.id, { onDelete: "set null" }),
    maxParticipants: integer("max_participants"),
    durationMin: integer("duration_min"),
    // Materiaal- en veiligheidsafspraken in gewone taal.
    materialInfo: text("material_info"),
    safetyInfo: text("safety_info"),
    // Vaste clublocatie (optioneel, naast het vrije location-veld).
    locationId: integer("location_id").references(() => clubLocationsTable.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    status: text("status").notNull().default("gepland"), // gepland | geannuleerd | afgerond
    createdByClerkId: text("created_by_clerk_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("club_trainings_club_date_idx").on(t.clubId, t.trainingDate)],
);

export const clubSignupStatuses = ["aangemeld", "afgemeld", "misschien", "reserve"] as const;
export type ClubSignupStatus = (typeof clubSignupStatuses)[number];

export const clubTrainingSignupsTable = pgTable(
  "club_training_signups",
  {
    id: serial("id").primaryKey(),
    trainingId: integer("training_id")
      .notNull()
      .references(() => clubTrainingsTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    status: text("status").notNull().default("aangemeld"),
    // Aanwezigheid geregistreerd door trainer ná de training.
    attendance: text("attendance"), // aanwezig | afwezig | te_laat | null (niet geregistreerd)
    // Bewuste koppeling aan het individuele schema (planned_workouts, source
    // "club"). Nooit automatisch — alleen na expliciete keuze bij een conflict
    // of via "zet in mijn schema".
    plannedWorkoutId: integer("planned_workout_id"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("club_training_signups_unique").on(t.trainingId, t.clerkId)],
);

// ── Wedstrijdbeheer ───────────────────────────────────────────────────────────
export const clubRaceEventsTable = pgTable(
  "club_race_events",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    teamId: integer("team_id").references(() => clubTeamsTable.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    raceDate: date("race_date").notNull(),
    location: text("location"),
    discipline: text("discipline"),
    meetPoint: text("meet_point"), // verzamelpunt
    meetTime: text("meet_time"), // "HH:MM"
    transportInfo: text("transport_info"),
    materialInfo: text("material_info"),
    notes: text("notes"),
    // BUILD_03 (besluitenpatch hoofdstuk D — Structuur):
    // Parcours koppelen is optioneel.
    routeId: integer("route_id"),
    // Vervanger voor de ploegleider: handmatig geactiveerd door de
    // teammanager (of de ploegleider zelf als er geen teammanager is). Mag
    // alles wat de ploegleider mag. Terugkeer of afloop wist het veld — na
    // afloop is NIET meer zichtbaar dat er een vervanger was (bewust geen
    // historie).
    deputyClerkId: text("deputy_clerk_id"),
    resultSummary: text("result_summary"), // uitslag in gewone taal
    debrief: text("debrief"), // terugblik
    status: text("status").notNull().default("gepland"), // gepland | geannuleerd | afgerond
    createdByClerkId: text("created_by_clerk_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("club_race_events_club_date_idx").on(t.clubId, t.raceDate),
    // Geen dubbele wedstrijden: zelfde club + naam + datum bestaat maar één keer.
    uniqueIndex("club_race_events_dedupe_unique").on(t.clubId, t.name, t.raceDate),
  ],
);

export const clubRaceSelectionsTable = pgTable(
  "club_race_selections",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => clubRaceEventsTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    role: text("role").notNull().default("renner"), // renner | reserve | begeleider
    // Door de sporter (of ouder) zelf aangegeven.
    availability: text("availability").notNull().default("onbekend"), // beschikbaar | niet_beschikbaar | onbekend
    availabilityNote: text("availability_note"),
    resultNote: text("result_note"),
    // Besluitenpatch 2026-08-01 (hoofdstuk B): wie de selectiebeslissing als
    // laatste nam (voor de teammanager-overrule van een ploegleiderbesluit).
    selectedByClerkId: text("selected_by_clerk_id"),
    selectedByRole: text("selected_by_role"),
    // Overrule door de teammanager: definitief — de ploegleider kan dit niet
    // terugdraaien. Alleen bij wedstrijdselecties, nergens anders.
    overruledAt: timestamp("overruled_at", { withTimezone: true }),
    overruledByClerkId: text("overruled_by_clerk_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("club_race_selections_unique").on(t.eventId, t.clerkId)],
);

// ── Communicatie ──────────────────────────────────────────────────────────────
// Gericht clubbericht (club/team/groep), optioneel gekoppeld aan een training
// of wedstrijd. Reacties zijn rijen met parentId. Geen openbaar netwerk.
export const clubMessagesTable = pgTable(
  "club_messages",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    scope: text("scope").notNull().default("club"), // club | team | group
    teamId: integer("team_id").references(() => clubTeamsTable.id, { onDelete: "cascade" }),
    groupId: integer("group_id").references(() => clubGroupsTable.id, { onDelete: "cascade" }),
    trainingId: integer("training_id").references(() => clubTrainingsTable.id, {
      onDelete: "set null",
    }),
    raceEventId: integer("race_event_id").references(() => clubRaceEventsTable.id, {
      onDelete: "set null",
    }),
    authorClerkId: text("author_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    body: text("body").notNull(),
    allowReplies: boolean("allow_replies").notNull().default(true),
    parentId: integer("parent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("club_messages_club_idx").on(t.clubId, t.createdAt)],
);

export const clubMessageReadsTable = pgTable(
  "club_message_reads",
  {
    id: serial("id").primaryKey(),
    messageId: integer("message_id")
      .notNull()
      .references(() => clubMessagesTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("club_message_reads_unique").on(t.messageId, t.clerkId)],
);

// ── Jeugdveiligheid & toestemming ─────────────────────────────────────────────
// Per (club, sporter) een expliciete toestemming voor het delen van sportdata
// met toegewezen trainers. Voor minderjarigen mag ALLEEN een gekoppelde ouder
// deze geven. Intrekken werkt direct; alles wordt geauditeerd.
// Per-categorie toestemming. "training_summary" is de bestaande basisscope
// (samenvatting zonder gevoelige details); daarnaast expliciete categorieën.
export const clubConsentScopes = [
  "training_summary",
  "vermogen",
  "hartslag",
  "belasting",
  "herstel",
  "slaap",
  "voeding",
  "blessures",
  "coaching",
] as const;
export type ClubConsentScope = (typeof clubConsentScopes)[number];

export const clubConsentsTable = pgTable(
  "club_consents",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    scope: text("scope").notNull().default("training_summary"),
    status: text("status").notNull().default("granted"), // granted | revoked
    grantedByClerkId: text("granted_by_clerk_id").notNull(),
    // self | parent | club_namens_ouder (besluitenpatch 2026-08-01, hoofdstuk B:
    // clubbeheer registreert een buiten de app gegeven oudertoestemming).
    grantedByRelation: text("granted_by_relation").notNull(),
    // Alleen bij club_namens_ouder: wie de toestemming gaf en hoe (verplicht).
    grantedNote: text("granted_note"),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByClerkId: text("revoked_by_clerk_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("club_consents_unique").on(t.clubId, t.athleteClerkId, t.scope)],
);

// ── BUILD_03 Wedstrijddag-inhoud (besluitenpatch hoofdstuk D) ────────────────
// Briefings per rol (renners/staf/iedereen), opdrachten per renner (iedereen
// in de selectie ziet elkaars opdracht; wijziging op de dag ⇒ renner direct
// bericht, het origineel wordt NIET bewaard), handmatige uitslag (ook door de
// renner zelf; komt in de persoonlijke historie), ploegevaluatie (iedereen
// schrijft mee, sluit een week na de wedstrijd) en gasten via e-mail/link
// zonder account (vervalt na de wedstrijd, intrekbaar; historie toont dát er
// een gast was).
export const clubRaceBriefingsTable = pgTable("club_race_briefings", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => clubRaceEventsTable.id, { onDelete: "cascade" }),
  audience: text("audience").notNull().default("iedereen"), // renners | staf | iedereen
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdByClerkId: text("created_by_clerk_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clubRaceAssignmentsTable = pgTable(
  "club_race_assignments",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => clubRaceEventsTable.id, { onDelete: "cascade" }),
    riderClerkId: text("rider_clerk_id").notNull(),
    body: text("body").notNull(), // origineel wordt bij wijziging NIET bewaard
    updatedByClerkId: text("updated_by_clerk_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("club_race_assignments_unique").on(t.eventId, t.riderClerkId)],
);

export const clubRaceResultsTable = pgTable(
  "club_race_results",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => clubRaceEventsTable.id, { onDelete: "cascade" }),
    riderClerkId: text("rider_clerk_id").notNull(),
    position: integer("position"), // handmatig; eerlijk leeg als onbekend
    note: text("note"),
    enteredByClerkId: text("entered_by_clerk_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("club_race_results_unique").on(t.eventId, t.riderClerkId)],
);

export const clubRaceEvaluationsTable = pgTable("club_race_evaluations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => clubRaceEventsTable.id, { onDelete: "cascade" }),
  authorClerkId: text("author_clerk_id").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clubRaceGuestsTable = pgTable("club_race_guests", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => clubRaceEventsTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  invitedByClerkId: text("invited_by_clerk_id").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── BUILD_03 Dagschema & logistiek (besluitenpatch hoofdstuk D) ──────────────
// Dagschema is optioneel, maar als het er is: PER PERSOON, met verplichte
// vertrektijd en verzamelpunt; terugkeertijd optioneel. Een staflid ziet ook
// de tijden van de anderen. Verschuiven gaat via een expliciete bevestiging
// van de ploegleider, waarna de HELE ploeg (incl. renners) bericht krijgt.
export const clubRaceDayScheduleTable = pgTable(
  "club_race_day_schedule",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => clubRaceEventsTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id").notNull(),
    departTime: text("depart_time").notNull(), // "HH:MM" — verplicht
    meetPoint: text("meet_point").notNull(), // verplicht
    returnTime: text("return_time"), // optioneel
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("club_race_day_schedule_unique").on(t.eventId, t.clerkId)],
);

// Vervoer per voertuig; chauffeur optioneel; een renner ziet de hele indeling.
export const clubRaceVehiclesTable = pgTable("club_race_vehicles", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => clubRaceEventsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // bv. "Bus 1", "Volgauto"
  seats: integer("seats"), // optioneel; nodig voor de autoplaats-waarschuwing
  driverClerkId: text("driver_clerk_id"), // chauffeur optioneel
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clubRaceVehicleSeatsTable = pgTable(
  "club_race_vehicle_seats",
  {
    id: serial("id").primaryKey(),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => clubRaceVehiclesTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("club_race_vehicle_seats_unique").on(t.vehicleId, t.clerkId)],
);

// Materiaal per renner (optioneel): de mechanieker vult de lijst en kan een
// eigen sjabloon vastleggen; afvinkbaar bij inladen; ploegleider ziet dat.
export const clubRaceMaterialItemsTable = pgTable("club_race_material_items", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => clubRaceEventsTable.id, { onDelete: "cascade" }),
  riderClerkId: text("rider_clerk_id").notNull(),
  item: text("item").notNull(),
  loadedAt: timestamp("loaded_at", { withTimezone: true }), // afgevinkt bij inladen
  loadedByClerkId: text("loaded_by_clerk_id"),
  createdByClerkId: text("created_by_clerk_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Materiaalsjabloon van de mechanieker (per club, herbruikbaar).
export const clubMaterialTemplatesTable = pgTable(
  "club_material_templates",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    items: jsonb("items").notNull(), // ["reservewielen", "bidons", ...]
    createdByClerkId: text("created_by_clerk_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("club_material_templates_unique").on(t.clubId, t.name)],
);

// ── BUILD_03 Noodinformatie (besluitenpatch hoofdstuk D) ─────────────────────
// Inzage in noodinformatie (noodcontacten + zelfgekozen veiligheidsinfo) is
// beperkt tot ploegleider, teammanager en medical_staff — uitdrukkelijk niet
// mechanieker/soigneur — en wordt voor ALLE drie gelogd. De sporter (of
// ouder) ziet wie er keek en wanneer. Het log blijft zolang de koppeling
// loopt (cascade met het clublidmaatschap via clubId+memberClerkId).
export const clubNoodinfoViewsTable = pgTable(
  "club_noodinfo_views",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    memberClerkId: text("member_clerk_id").notNull(),
    viewerClerkId: text("viewer_clerk_id").notNull(),
    viewerRole: text("viewer_role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("club_noodinfo_views_member_idx").on(t.clubId, t.memberClerkId)],
);

// ── CLUB_ONBOARDING_01: ledenimport ──────────────────────────────────────────
// Import voegt nooit stilzwijgend toe: een batch staat eerst op
// "wacht_op_bevestiging" en pas een expliciete bevestiging verwerkt de rijen
// in één transactie (alles of niets). Rijen bevatten persoonsgegevens en
// worden na een configureerbare bewaartermijn opgeschoond (purgeAfter).
export const clubImportBatchStatuses = [
  "wacht_op_bevestiging",
  "bevestigd",
  "geannuleerd",
  "verlopen",
] as const;
export type ClubImportBatchStatus = (typeof clubImportBatchStatuses)[number];

// Rijstatus vóór bevestiging: klaar | dubbel | ongeldig | geen_account.
// Ná bevestiging: toegevoegd (klaar-rijen). Dubbel = geverifieerd e-mailadres
// is al actief lid (nooit op naam). geen_account = geen bestaand account met
// dit e-mailadres; uitnodigen kan pas ná activatie (CLUB_LEDEN_01).
export const clubImportRowStatuses = [
  "klaar",
  "dubbel",
  "ongeldig",
  "geen_account",
  "toegevoegd",
] as const;
export type ClubImportRowStatus = (typeof clubImportRowStatuses)[number];

export const clubImportBatchesTable = pgTable(
  "club_import_batches",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    createdByClerkId: text("created_by_clerk_id").notNull(),
    fileName: text("file_name"),
    status: text("status").notNull().default("wacht_op_bevestiging"),
    totalRows: integer("total_rows").notNull().default(0),
    okRows: integer("ok_rows").notNull().default(0),
    failedRows: integer("failed_rows").notNull().default(0),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    // Bewaartermijn persoonsgegevens (besluitpunt; configureerbaar via env).
    purgeAfter: timestamp("purge_after", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("club_import_batches_club_idx").on(t.clubId)],
);
export type ClubImportBatch = typeof clubImportBatchesTable.$inferSelect;

export const clubImportRowsTable = pgTable(
  "club_import_rows",
  {
    id: serial("id").primaryKey(),
    batchId: integer("batch_id")
      .notNull()
      .references(() => clubImportBatchesTable.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    email: text("email"),
    name: text("name"),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("ongeldig"),
    message: text("message"),
    // Gevonden account (user_profiles.clerkId) bij een e-mailmatch.
    matchedClerkId: text("matched_clerk_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("club_import_rows_batch_idx").on(t.batchId)],
);
export type ClubImportRow = typeof clubImportRowsTable.$inferSelect;

// ── Commerciële clubadministratie (geen boekhouding) ─────────────────────────
// Pakket + limieten + status. Overschrijding blokkeert nieuwe toevoegingen,
// verwijdert nooit data. Configureerbaar en klaar voor latere facturatie.
export const clubPackages = ["proef", "start", "basis", "groei", "team"] as const;
export type ClubPackage = (typeof clubPackages)[number];

export const clubSubscriptionsTable = pgTable("club_subscriptions", {
  clubId: integer("club_id")
    .primaryKey()
    .references(() => clubsTable.id, { onDelete: "cascade" }),
  packageKey: text("package_key").notNull().default("proef"),
  status: text("status").notNull().default("trial"), // trial | active | blocked | ended
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  maxMembers: integer("max_members").notNull().default(15),
  maxTrainers: integer("max_trainers").notNull().default(2),
  // Vrij veld voor latere facturatiekoppeling (extern klantnummer e.d.).
  billingRef: text("billing_ref"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Auditlog (append-only) ────────────────────────────────────────────────────
export const clubAuditLogTable = pgTable(
  "club_audit_log",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    actorClerkId: text("actor_clerk_id").notNull(),
    action: text("action").notNull(), // bv. "lid_uitgenodigd", "consent_ingetrokken"
    targetType: text("target_type"), // member | team | group | training | race | message | consent | subscription
    targetId: text("target_id"),
    detail: jsonb("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("club_audit_club_idx").on(t.clubId, t.createdAt)],
);

// ── TEAM_ONBOARDING_01: stafplekken (conceptstructuur, GEEN rechten) ─────────
// Een organogram-kaart of beheerder maakt "rolplekken" aan: welke stafrollen
// de organisatie wil invullen. Een plek is puur structuur — er hangt geen
// persoon, recht of zichtbaarheid aan. Echte namen en rechten ontstaan
// uitsluitend via club_members (na directe toewijzing of geaccepteerde
// uitnodiging). Een plek verwijderen raakt dus nooit een persoon of rol.
export const organisationStaffSlotsTable = pgTable(
  "organisation_staff_slots",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    // Optioneel gebonden aan één selectie/subteam (club_teams).
    teamId: integer("team_id").references(() => clubTeamsTable.id, { onDelete: "cascade" }),
    // Bestaande server-side rolwaarde (clubRoles) — kaarten tonen uitsluitend
    // rollen die echt bestaan.
    role: text("role").notNull(),
    // Alleen betekenisvol bij role="medical_staff": beschrijvend functietype
    // zonder eigen rechten (medicalSpecialties).
    medicalSpecialty: text("medical_specialty"),
    // Vrij label, bv. "Ploegleider voorjaarsblok". Nooit een persoonsnaam
    // vóór acceptatie — namen komen uit club_members.
    label: text("label"),
    createdByClerkId: text("created_by_clerk_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("organisation_staff_slots_club_idx").on(t.clubId)],
);

// ── Zod & types ───────────────────────────────────────────────────────────────
export const insertClubSchema = createInsertSchema(clubsTable).omit({ id: true });
export const selectClubSchema = createSelectSchema(clubsTable);

export type Club = typeof clubsTable.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;
export type ClubMember = typeof clubMembersTable.$inferSelect;
export type ClubTeam = typeof clubTeamsTable.$inferSelect;
export type ClubGroup = typeof clubGroupsTable.$inferSelect;
export type ClubTrainerAssignment = typeof clubTrainerAssignmentsTable.$inferSelect;
export type ClubTraining = typeof clubTrainingsTable.$inferSelect;
export type ClubTrainingSignup = typeof clubTrainingSignupsTable.$inferSelect;
export type ClubRaceEvent = typeof clubRaceEventsTable.$inferSelect;
export type ClubRaceSelection = typeof clubRaceSelectionsTable.$inferSelect;
export type ClubMessage = typeof clubMessagesTable.$inferSelect;
export type ClubMessageRead = typeof clubMessageReadsTable.$inferSelect;
export type ClubConsent = typeof clubConsentsTable.$inferSelect;
export type ClubSubscription = typeof clubSubscriptionsTable.$inferSelect;
export type ClubAuditEntry = typeof clubAuditLogTable.$inferSelect;
export type OrganisationStaffSlot = typeof organisationStaffSlotsTable.$inferSelect;

// TEAM_ONBOARDING_01: organisatietypen op de bestaande container.
export const organisationTypes = ["CLUB", "TEAM"] as const;
export type OrganisationType = (typeof organisationTypes)[number];
