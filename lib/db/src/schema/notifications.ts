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
] as const;
export type NotificationType = (typeof notificationTypes)[number];

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notif_clerk_read_idx").on(t.clerkId, t.readAt),
    uniqueIndex("notif_clerk_dedupe_idx")
      .on(t.clerkId, t.dedupeKey)
      .where(sql`${t.dedupeKey} IS NOT NULL`),
  ],
);

export const insertNotificationSchema = createInsertSchema(
  notificationsTable,
).omit({ id: true });
export const selectNotificationSchema = createSelectSchema(notificationsTable);

export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
