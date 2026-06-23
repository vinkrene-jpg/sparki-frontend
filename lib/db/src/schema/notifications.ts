import {
  pgTable,
  serial,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// In-app notification foundation (no push/email yet — PWA push comes later).
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notif_clerk_read_idx").on(t.clerkId, t.readAt)],
);

export const insertNotificationSchema = createInsertSchema(
  notificationsTable,
).omit({ id: true });
export const selectNotificationSchema = createSelectSchema(notificationsTable);

export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
