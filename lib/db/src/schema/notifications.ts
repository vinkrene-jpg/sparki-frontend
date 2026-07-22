import {
  pgTable,
  serial,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// In-app notification foundation. Reminders are also delivered out-of-app via a
// real channel (email to start) by the scheduled reminder-delivery job; that
// path adds `dedupeKey` (idempotency) + `sentAt` (when the email was delivered).
// `clerkId` is the recipient (spec "user_id"); `athleteClerkId` is the athlete
// the notification is about, when relevant (spec "athlete_id", nullable).

export const notificationTypes = [
  "ai_observation",
  "training_reminder",
  "recovery_warning",
  "race_reminder",
  "coach_update",
  "parent_update",
  "system",
  // Reminder-delivery types (created by the scheduled reminder job).
  "checkin_reminder",
  "followup_question",
  // One-question nudge for a genuinely-missing core profile field.
  "profile_nudge",
  // Smartly-timed nudge when there is GENUINELY new content for the athlete
  // (a real new insight or fresh news), delivered at a receptive moment.
  "something_new",
  // Clubomgeving: reserve doorgeschoven, selectie, clubberichten.
  "club_update",
  // Sparki World: reacties/waarderingen op je gedeelde items en moderatie.
  "world_update",
  // Ouderomgeving: veiligheidsmelding, toestemming vereist, gewijzigde rechten.
  "parent_report",
  "consent_required",
  "access_changed",
  // Golf 24: centrale meldingslaag — synchronisatiefout (verdwijnt bij herstel),
  // en kritieke privacy/veiligheidsmeldingen (nooit volledig uitschakelbaar).
  "sync_error",
  "security_alert",
] as const;
export type NotificationType = (typeof notificationTypes)[number];

// Golf 24: iedere melding hoort bij één categorie. Voorkeuren en stille uren
// werken per categorie; `veiligheid` en `privacy` zijn kritiek en kunnen nooit
// volledig worden uitgeschakeld (wel terughoudend geleverd).
export const notificationCategories = [
  "training",
  "wedstrijd",
  "herstel",
  "coach",
  "club",
  "ouder",
  "materiaal",
  "sync",
  "privacy",
  "veiligheid",
  "sociaal",
  "systeem",
] as const;
export type NotificationCategory = (typeof notificationCategories)[number];

export const notificationPriorities = ["low", "normal", "high"] as const;
export type NotificationPriority = (typeof notificationPriorities)[number];

export const notificationsTable = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
    athleteClerkId: text("athlete_clerk_id").references(
      () => userProfilesTable.clerkId,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    priority: text("priority").notNull().default("normal"),
    readAt: timestamp("read_at", { withTimezone: true }),
    actionUrl: text("action_url"),
    // Idempotency key for reminder-delivery rows (e.g. "reminder:checkin:2026-06-26").
    // NULL for ordinary in-app notifications. A partial unique index on
    // (clerkId, dedupeKey) guarantees the same reminder is created at most once.
    dedupeKey: text("dedupe_key"),
    // When the out-of-app delivery (email) actually went out. NULL = not yet
    // delivered (in-app only, or pending/failed email — the job retries).
    sentAt: timestamp("sent_at", { withTimezone: true }),
    // ── Golf 24: centrale meldingscontract (additief) ────────────────────────
    // Categorie (zie notificationCategories); NULL op oude rijen = afgeleid van
    // `type` op het leespad. Voorkeuren/stille uren werken per categorie.
    category: text("category"),
    // Waar de melding vandaan komt (bijv. "reminders", "data-hub", "coach",
    // "club", "materiaal") — voor logging/diagnose zonder gevoelige inhoud.
    source: text("source"),
    // Doelgroep-rol van de ontvanger op moment van aanmaken: athlete/coach/
    // parent/club. Bewaakt dat een melding alleen binnen de eigen bevoegdheid
    // wordt getoond, ook als rollen later wijzigen.
    audience: text("audience"),
    // Geldigheidsperiode: na dit moment wordt de melding niet meer getoond of
    // geleverd (verlopen ≠ verwijderd; de rij blijft voor historie).
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    // Opgelost: de onderliggende situatie is voorbij (sync hersteld, toestemming
    // gegeven, materiaal-actie afgerond, …). Opgeloste meldingen verdwijnen.
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    // Sleutel waarop een oplossing meldingen wegneemt, bijv.
    // "sync:<connectionId>" of "consent:<linkId>". NULL = niet oplosbaar.
    resolutionKey: text("resolution_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notif_clerk_read_idx").on(t.clerkId, t.readAt),
    uniqueIndex("notif_clerk_dedupe_idx")
      .on(t.clerkId, t.dedupeKey)
      .where(sql`${t.dedupeKey} IS NOT NULL`),
    // Eén open situatie ⇒ één melding, ook onder gelijktijdige schrijvers: de
    // read-then-insert in createNotification is best-effort; deze partiële
    // unieke index is de harde garantie (opgeloste rijen tellen niet mee).
    uniqueIndex("notif_clerk_open_resolution_idx")
      .on(t.clerkId, t.resolutionKey)
      .where(sql`${t.resolutionKey} IS NOT NULL AND ${t.resolvedAt} IS NULL`),
  ],
);

export const insertNotificationSchema = createInsertSchema(
  notificationsTable,
).omit({ id: true });
export const selectNotificationSchema = createSelectSchema(notificationsTable);

export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
