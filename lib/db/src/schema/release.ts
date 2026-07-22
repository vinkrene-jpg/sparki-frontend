import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./users";

// ── Releasegroepen ───────────────────────────────────────────────────────────
// Gecontroleerde uitrol: iedere gebruiker en club hoort bij precies één
// releasegroep. Nieuwe/onbekende gebruikers vallen in "productie" (de meest
// beperkte groep) — features komen daar pas als ze bewust zijn vrijgegeven.
export const RELEASE_GROUPS = ["intern", "test", "pilot", "productie"] as const;
export type ReleaseGroup = (typeof RELEASE_GROUPS)[number];

export const RELEASE_PLATFORMS = ["web", "mobiel", "api"] as const;
export type ReleasePlatform = (typeof RELEASE_PLATFORMS)[number];

// ── Kill switches ────────────────────────────────────────────────────────────
// Directe noodstop per verwerkingsdomein, zonder deployment. Een actieve
// switch stopt NIEUWE verwerking; bestaande data blijft onaangetast.
export const KILL_SWITCH_KEYS = [
  "imports_sync", // imports en synchronisaties (Data Hub, bestanden, backfill)
  "analyses", // analyses/observaties/brief
  "auto_schema_adjust", // automatische schema-aanpassingen (voorstellen/generator)
  "mobile_upload", // mobiele upload (ritten/GPX vanaf de telefoon)
  "external_providers", // externe providers (Strava/Garmin/Wahoo/kalenders)
  "ai_processing", // Sparki-denkkracht (LLM-verwerking)
  "club_features", // clubfuncties
] as const;
export type KillSwitchKey = (typeof KILL_SWITCH_KEYS)[number];

export const KILL_SWITCH_LABELS: Record<KillSwitchKey, string> = {
  imports_sync: "Imports en synchronisaties",
  analyses: "Analyses",
  auto_schema_adjust: "Automatische schema-aanpassingen",
  mobile_upload: "Mobiele upload",
  external_providers: "Externe providers",
  ai_processing: "Sparki-denkkracht",
  club_features: "Clubfuncties",
};

export const killSwitchesTable = pgTable("kill_switches", {
  key: text("key").primaryKey(),
  active: boolean("active").notNull().default(false),
  reason: text("reason"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export type KillSwitch = typeof killSwitchesTable.$inferSelect;

// ── Versievereisten ──────────────────────────────────────────────────────────
// Minimaal ondersteunde clientversie per platform. Clients onder het minimum
// krijgen 426 met een duidelijke Nederlandse melding en een blokkeerscherm.
export const versionRequirementsTable = pgTable("version_requirements", {
  platform: text("platform").primaryKey(), // "web" | "mobiel"
  minVersion: text("min_version").notNull(),
  // Golf 28 — aanbevolen versie: nieuwer dan het minimum. Clients hieronder
  // krijgen een rustige update-melding, nooit een blokkade.
  recommendedVersion: text("recommended_version"),
  message: text("message"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export type VersionRequirement = typeof versionRequirementsTable.$inferSelect;

// ── Crash- en foutregistratie ────────────────────────────────────────────────
// Gelijke fouten worden gegroepeerd op fingerprint (hash van platform +
// genormaliseerde melding + stack-top). Groepsstatistieken (eerste/laatste
// voorkomen, aantallen) staan op de groep; individuele voorvallen in events.
export const ERROR_SEVERITIES = ["kritiek", "fout", "waarschuwing"] as const;
export type ErrorSeverity = (typeof ERROR_SEVERITIES)[number];

export const errorGroupsTable = pgTable(
  "error_groups",
  {
    id: serial("id").primaryKey(),
    fingerprint: text("fingerprint").notNull().unique(),
    platform: text("platform").notNull(), // web | mobiel | api
    severity: text("severity").notNull().default("fout"),
    message: text("message").notNull(), // representatieve (genormaliseerde) melding
    stackTop: text("stack_top"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    eventCount: integer("event_count").notNull().default(0),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("error_groups_last_seen_idx").on(t.lastSeenAt)],
);
export type ErrorGroup = typeof errorGroupsTable.$inferSelect;

export const errorEventsTable = pgTable(
  "error_events",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => errorGroupsTable.id, { onDelete: "cascade" }),
    // Bewust geen FK: fouten van net-verwijderde accounts blijven telbaar.
    clerkId: text("clerk_id"),
    releaseGroup: text("release_group"),
    appVersion: text("app_version"),
    screen: text("screen"),
    correlationId: text("correlation_id"),
    // Featureflag waaraan dit voorval toe te schrijven is (indien bekend).
    // De uitrolbewaking telt UITSLUITEND voorvallen met een matchende flag —
    // nooit een globale teller, anders zet één storing ongerelateerde flags uit.
    flagKey: text("flag_key"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("error_events_group_idx").on(t.groupId),
    index("error_events_at_idx").on(t.at),
  ],
);
export type ErrorEvent = typeof errorEventsTable.$inferSelect;

// ── Pilotvoorwaarden ─────────────────────────────────────────────────────────
// Acceptatie van de pilotvoorwaarden, per versie van de voorwaardentekst.
export const pilotConsentsTable = pgTable(
  "pilot_consents",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    termsVersion: text("terms_version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("pilot_consents_user_version").on(t.clerkId, t.termsVersion)],
);
export type PilotConsent = typeof pilotConsentsTable.$inferSelect;

// ── In-app releaseberichten ──────────────────────────────────────────────────
// Alleen relevante wijzigingen, gericht op releasegroepen/platforms. Worden
// uitsluitend rustig op Vandaag getoond — nooit tijdens training, analyse of
// navigatie, en nooit als pop-up.
export const releaseNotesTable = pgTable("release_notes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  // Lege array = alle groepen/platforms.
  releaseGroups: text("release_groups").array().notNull().default([]),
  platforms: text("platforms").array().notNull().default([]),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export type ReleaseNote = typeof releaseNotesTable.$inferSelect;

export const releaseNoteReadsTable = pgTable(
  "release_note_reads",
  {
    noteId: integer("note_id")
      .notNull()
      .references(() => releaseNotesTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.noteId, t.clerkId] })],
);

// ── Uitrolbewaking (automatische stop) ───────────────────────────────────────
// Per featureflag een kritieke foutdrempel: zoveel kritieke fouten binnen het
// venster ⇒ flag automatisch uit (globaal + rollen + groepen leeg) + audit +
// melding. Handmatig weer aanzetten is een bewust beheerbesluit.
export const rolloutGuardsTable = pgTable("rollout_guards", {
  flagKey: text("flag_key").primaryKey(),
  errorThreshold: integer("error_threshold").notNull().default(5),
  windowMinutes: integer("window_minutes").notNull().default(60),
  active: boolean("active").notNull().default(true),
  lastTrippedAt: timestamp("last_tripped_at", { withTimezone: true }),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export type RolloutGuard = typeof rolloutGuardsTable.$inferSelect;
