import { pgTable, text, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { userProfilesTable } from "./users";

export const FEATURE_KEYS = [
  "ai_observations",
  "strava",
  "garmin",
  "route_planner",
  "coach_portal",
  "parent_portal",
  "testing_tools",
  "premium",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_DESCRIPTIONS: Record<FeatureKey, string> = {
  ai_observations: "AI-generated daily briefings, training insights, and coaching observations",
  strava: "Strava OAuth integration — activity sync, route import, power data",
  garmin: "Garmin Connect integration — HRV, sleep, RHR, activity sync",
  route_planner: "Route planner, elevation profiles, turn-by-turn navigation",
  coach_portal: "Coach portal — view and manage linked athlete training plans",
  parent_portal: "Parent portal — view linked athlete readiness and schedule",
  testing_tools: "Internal testing tools — flag management UI, data seeding, debug overlays",
  premium: "Premium feature tier — reserved for future paid features",
};

// Global flag definitions — one row per feature key.
// enabledGlobally:  true = on for every authenticated user by default.
// enabledRoles:     roles that get the feature by default (e.g. ["coach"]).
export const featureFlagsTable = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  description: text("description"),
  enabledGlobally: boolean("enabled_globally").notNull().default(false),
  enabledRoles: text("enabled_roles").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Per-user overrides — wins over global + role settings.
// enabled = true  → force ON  for this user regardless of global/role setting.
// enabled = false → force OFF for this user regardless of global/role setting.
export const userFlagOverridesTable = pgTable(
  "user_flag_overrides",
  {
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade" }),
    flagKey: text("flag_key")
      .notNull()
      .references(() => featureFlagsTable.key, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull(),
    setBy: text("set_by"),
    reason: text("reason"),
    setAt: timestamp("set_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.clerkId, t.flagKey] })],
);

export type FeatureFlag = typeof featureFlagsTable.$inferSelect;
export type UserFlagOverride = typeof userFlagOverridesTable.$inferSelect;
