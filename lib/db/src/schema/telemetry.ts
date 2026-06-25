import {
  pgTable,
  bigserial,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Raw, append-only usage telemetry. One row per real user action — never
// fabricated. The whole Test Management Dashboard (sessions, time-in-app,
// active days, screen coverage, feature use) is derived by aggregating this
// table. Until a tester actually does something, there are no rows for them and
// the dashboard shows honest "nog niet gemeten" — never a placeholder number.
//
// Event types:
//  - "screen_view": the user navigated to / opened a tracked screen.
//  - "feature_use": the user interacted with a tracked feature.
//  - "heartbeat": the tab is open + visible (periodic, lets us measure real
//    time-in-app per session honestly instead of guessing).
export const telemetryEventTypes = [
  "screen_view",
  "feature_use",
  "heartbeat",
] as const;
export type TelemetryEventType = (typeof telemetryEventTypes)[number];

export const testerEventsTable = pgTable(
  "tester_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Groups events into a single browsing session (one per tab/app load).
    sessionId: text("session_id").notNull(),
    type: text("type").notNull(),
    // Canonical screen key (e.g. "home", "training", "voeding"); null for
    // heartbeats and feature-only events.
    screen: text("screen"),
    // Canonical feature key for "feature_use" events; null otherwise.
    feature: text("feature"),
    // App version at the time of the event (for "tested since release" signals).
    appVersion: text("app_version"),
    // Coarse device label ("iPhone" | "Android" | "iPad" | "Desktop").
    platform: text("platform"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tester_events_clerk_created_idx").on(t.clerkId, t.createdAt),
    index("tester_events_screen_idx").on(t.screen),
    index("tester_events_session_idx").on(t.sessionId),
  ],
);

export const insertTesterEventSchema = createInsertSchema(testerEventsTable).omit(
  { id: true },
);
export const selectTesterEventSchema = createSelectSchema(testerEventsTable);

export type TesterEvent = typeof testerEventsTable.$inferSelect;
export type InsertTesterEvent = z.infer<typeof insertTesterEventSchema>;
