import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userProfilesTable = pgTable("user_profiles", {
  clerkId: text("clerk_id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  roles: text("roles").array().notNull().default(["athlete"]),
  activeRole: text("active_role").notNull().default("athlete"),
  // Founding Athlete program — a stable sequential number assigned once, the
  // first time onboarding V2 completes. Unique; NULL until earned (Postgres
  // allows many NULLs under a UNIQUE constraint). Assigned atomically.
  foundingNumber: integer("founding_number").unique(),
  // Head-tester ("Hoofdtester") flag — set when a head-tester invite is
  // accepted. Drives Sparki's running self-deprecating tester joke.
  isHeadTester: boolean("is_head_tester").notNull().default(false),
  // Sequential head-tester badge ("Head Tester #001"), assigned exactly once
  // when the first head-tester invite is accepted. Unique; NULL until earned
  // (Postgres allows many NULLs under UNIQUE). Assigned atomically (MAX+1).
  headTesterNumber: integer("head_tester_number").unique(),
  // Lightweight session telemetry, refreshed on every /api/auth/me + /sync.
  // Honest gaps: NULL until the user has actually been seen / sent the data.
  // lastPlatform is parsed from the User-Agent ("iPhone" | "iPad" | "Android" |
  // "Desktop" | NULL when unknown). appVersion is the client build version sent
  // in the X-Sparki-App-Version header.
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  lastPlatform: text("last_platform"),
  appVersion: text("app_version"),
  // Tester lifecycle: when an admin marks a tester as "Klaar" (done testing).
  // NULL = still Actief/Uitgenodigd. Set/cleared from the tester overview.
  testerCompletedAt: timestamp("tester_completed_at", { withTimezone: true }),
  // Releasegroep voor gecontroleerde uitrol: intern | test | pilot | productie.
  // Default "productie" = de meest beperkte groep (fail-closed voor nieuwe features).
  releaseGroup: text("release_group").notNull().default("productie"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUserProfileSchema = createInsertSchema(userProfilesTable);
export const selectUserProfileSchema = createSelectSchema(userProfilesTable);

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;

export const validRoles = ["athlete", "coach", "parent"] as const;
export type Role = (typeof validRoles)[number];
