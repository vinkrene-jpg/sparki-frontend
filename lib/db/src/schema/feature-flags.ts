import { pgTable, text, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { userProfilesTable } from "./users";
import {
  FEATURE_KEYS,
  FEATURE_DESCRIPTIONS,
  type FeatureKey,
} from "@workspace/feature-flags";

export { FEATURE_KEYS, FEATURE_DESCRIPTIONS, type FeatureKey };

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
