import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userProfilesTable = pgTable("user_profiles", {
  clerkId: text("clerk_id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  roles: text("roles").array().notNull().default(["athlete"]),
  activeRole: text("active_role").notNull().default("athlete"),
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
