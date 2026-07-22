import { pgTable, text, boolean, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
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
  // Releasegroepen waarvoor de flag aan staat (intern/test/pilot/productie).
  // Leeg = geen groepsvrijgave (alleen global/rol/override telt dan).
  enabledGroups: text("enabled_groups").array().notNull().default([]),
  // Platforms waarop de flag mag werken. Leeg = alle platforms.
  enabledPlatforms: text("enabled_platforms").array().notNull().default([]),
  // Gefaseerde uitrol: percentage gebruikers (deterministische hash op
  // clerkId+key) waarvoor een group/global-vrijgave daadwerkelijk geldt.
  // 100 = iedereen in de vrijgegeven doelgroep. Overrides negeren dit.
  rolloutPercentage: integer("rollout_percentage").notNull().default(100),
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
      .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
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
