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
  "mechanieker", // mag materiaalvelden bijwerken, verder alleen-lezen
  "member", // lid (renner)
  "parent", // ouder/verzorger
  "vrijwilliger", // leest kalender/berichten, geen beheer
  "alleen_lezen", // strikt alleen-lezen
  // TEAM_ABONNEMENT_01: begeleidende teamrollen. Least privilege — geen
  // beheerrechten, geen automatische sportdata-inzage (consent blijft leidend).
  "soigneur", // verzorger: kalender/berichten, geen beheer of sportdata
  "medic", // medische begeleider: kalender/berichten; sportdata alleen via consent
] as const;
export type ClubRole = (typeof clubRoles)[number];

// Clubstatus (commerciële voorbereiding): beperkt = geen nieuwe toevoegingen,
// geschorst/beeindigd = alleen-lezen voor iedereen behalve eigenaar/beheer.
export const clubStatuses = ["actief", "beperkt", "geschorst", "beeindigd"] as const;
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
    // Vrij label, bv. "hoofdtrainer jeugd".
    label: text("label"),
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
    grantedByRelation: text("granted_by_relation").notNull(), // self | parent
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByClerkId: text("revoked_by_clerk_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("club_consents_unique").on(t.clubId, t.athleteClerkId, t.scope)],
);

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
