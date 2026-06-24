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
