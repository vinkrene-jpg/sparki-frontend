import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { userProfilesTable } from "./users";

// ── Sparki World — veilige sociale omgeving ─────────────────────────────────
// Sparki World toont uitsluitend BEWUST gedeelde items. Er wordt nooit een
// tweede kopie van inhoud bewaard: een gedeeld item is een REFERENTIE naar de
// bron (Journey-media/-moment, activiteit, wedstrijd) plus de deelkeuzes
// (zichtbaarheid, geselecteerde velden, locatieprivacy). Alleen een los
// "bericht" heeft eigen tekst, omdat die nergens anders bestaat.
//
// Privacyregels (hard in de API, niet alleen UI):
//   - Minderjarig of onbekende leeftijd ⇒ standaard privé; openbaar delen
//     vereist geldige oudertoestemming én expliciete bevestiging (fail-closed).
//   - Gezondheid, herstel, coachnotities en ouderinformatie kunnen NOOIT
//     gedeeld worden — ze zijn geen geldig brontype/veld.
//   - Blokkeren werkt onmiddellijk en in beide richtingen.

export const WORLD_SOURCE_TYPES = [
  "bericht", // eigen tekst, geen externe bron
  "journey_media", // foto/video uit journey_media (moet "gedeeld" zijn)
  "journey_item", // mijlpaal/trainingskamp-moment
  "session", // activiteit uit training_sessions (veldselectie verplicht)
  "race", // wedstrijd uit races
] as const;
export type WorldSourceType = (typeof WORLD_SOURCE_TYPES)[number];

export const WORLD_VISIBILITY = [
  "prive",
  "coach_ouders",
  "club",
  "team",
  "volgers",
  "openbaar",
] as const;
export type WorldVisibility = (typeof WORLD_VISIBILITY)[number];

// Whitelist van deelbare prestatievelden voor activiteiten/wedstrijden.
// Alles wat hier niet in staat (gezondheid, herstel, hartslagzones,
// coachnotities…) kan technisch niet gedeeld worden.
export const WORLD_SHAREABLE_FIELDS = [
  "afstand",
  "duur",
  "hoogtemeters",
  "gemiddelde_snelheid",
  "vermogen",
  "hartslag",
  "route", // kaartlijn — altijd met locatieprivacy-transformatie
  "uitslag", // alleen bij wedstrijden
] as const;
export type WorldShareableField = (typeof WORLD_SHAREABLE_FIELDS)[number];

export const WORLD_ITEM_STATUSES = [
  "actief",
  "verborgen", // door moderatie verborgen (herstelbaar)
  "verwijderd", // bron weg of door eigenaar ingetrokken
] as const;
export type WorldItemStatus = (typeof WORLD_ITEM_STATUSES)[number];

export const worldSharedItemsTable = pgTable(
  "world_shared_items",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    sourceType: text("source_type").$type<WorldSourceType>().notNull(),
    // Bron-id binnen de brontabel; null alleen bij "bericht".
    sourceId: integer("source_id"),
    // Alleen bij sourceType "bericht": de tekst zelf (nergens anders opgeslagen).
    message: text("message"),
    // Optioneel onderschrift bij een gedeelde bron.
    caption: text("caption"),
    visibility: text("visibility")
      .$type<WorldVisibility>()
      .notNull()
      .default("prive"),
    // Openbaar delen vereist een expliciete bevestiging; dit is het bewijs.
    publicConfirmedAt: timestamp("public_confirmed_at", { withTimezone: true }),
    // Geselecteerde prestatievelden (whitelist). Leeg = alleen titel/datum.
    sharedFields: text("shared_fields")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // Locatieprivacy-keuzes voor route-delen: { hideStartEnd, privacyZone, simplify }
    locationPrivacy: jsonb("location_privacy").$type<{
      hideStartEnd: boolean;
      privacyZone: boolean;
      simplify: boolean;
    } | null>(),
    status: text("status")
      .$type<WorldItemStatus>()
      .notNull()
      .default("actief"),
    hiddenReason: text("hidden_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("world_items_clerk_idx").on(t.clerkId, t.createdAt),
    index("world_items_feed_idx").on(t.status, t.createdAt),
    // Eén deel-item per bron — nooit dubbele content in de feed.
    uniqueIndex("world_items_source_uniq")
      .on(t.clerkId, t.sourceType, t.sourceId)
      .where(sql`source_id IS NOT NULL`),
  ],
);

export const WORLD_REACTION_KINDS = ["waardering", "reactie"] as const;
export type WorldReactionKind = (typeof WORLD_REACTION_KINDS)[number];

export const worldReactionsTable = pgTable(
  "world_reactions",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id")
      .notNull()
      .references(() => worldSharedItemsTable.id, { onDelete: "cascade" }),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    kind: text("kind").$type<WorldReactionKind>().notNull(),
    // Alleen bij kind "reactie".
    body: text("body"),
    status: text("status")
      .$type<WorldItemStatus>()
      .notNull()
      .default("actief"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("world_reactions_item_idx").on(t.itemId, t.createdAt),
    // Eén waardering per persoon per item.
    uniqueIndex("world_reactions_like_uniq")
      .on(t.itemId, t.clerkId)
      .where(sql`kind = 'waardering'`),
  ],
);

export const worldBlocksTable = pgTable(
  "world_blocks",
  {
    id: serial("id").primaryKey(),
    blockerClerkId: text("blocker_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    blockedClerkId: text("blocked_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("world_blocks_pair_uniq").on(t.blockerClerkId, t.blockedClerkId),
    index("world_blocks_blocked_idx").on(t.blockedClerkId),
  ],
);

export const WORLD_REPORT_TARGETS = ["item", "reactie", "account"] as const;
export type WorldReportTarget = (typeof WORLD_REPORT_TARGETS)[number];

export const WORLD_REPORT_STATUSES = ["open", "beoordeeld"] as const;
export type WorldReportStatus = (typeof WORLD_REPORT_STATUSES)[number];

export const WORLD_MODERATION_ACTIONS = [
  "geen",
  "verborgen",
  "hersteld",
  "sanctie",
] as const;
export type WorldModerationAction = (typeof WORLD_MODERATION_ACTIONS)[number];

export const worldReportsTable = pgTable(
  "world_reports",
  {
    id: serial("id").primaryKey(),
    // Rapporteur; "sparki-signaal" bij automatische detectie (die alleen
    // signaleert en nooit zelf verwijdert).
    reporterClerkId: text("reporter_clerk_id").notNull(),
    targetType: text("target_type").$type<WorldReportTarget>().notNull(),
    // item-/reactie-id als tekst; bij "account" het clerkId.
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    status: text("status")
      .$type<WorldReportStatus>()
      .notNull()
      .default("open"),
    action: text("action").$type<WorldModerationAction>(),
    moderatorClerkId: text("moderator_clerk_id"),
    moderationNote: text("moderation_note"),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("world_reports_status_idx").on(t.status, t.createdAt),
    index("world_reports_target_idx").on(t.targetType, t.targetId),
  ],
);

export const worldNotificationPrefsTable = pgTable("world_notification_prefs", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .unique()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  notifyReactions: boolean("notify_reactions").notNull().default(true),
  notifyMentions: boolean("notify_mentions").notNull().default(true),
  notifyRequests: boolean("notify_requests").notNull().default(true),
  notifyClubMessages: boolean("notify_club_messages").notNull().default(true),
  notifyModeration: boolean("notify_moderation").notNull().default(true),
  // Geen storende meldingen tijdens ritregistratie of navigatie.
  muteDuringRide: boolean("mute_during_ride").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertWorldSharedItemSchema = createInsertSchema(
  worldSharedItemsTable,
).omit({ id: true });
export const selectWorldSharedItemSchema = createSelectSchema(
  worldSharedItemsTable,
);

export type WorldSharedItem = typeof worldSharedItemsTable.$inferSelect;
export type WorldReaction = typeof worldReactionsTable.$inferSelect;
export type WorldBlock = typeof worldBlocksTable.$inferSelect;
export type WorldReport = typeof worldReportsTable.$inferSelect;
export type WorldNotificationPrefs =
  typeof worldNotificationPrefsTable.$inferSelect;
