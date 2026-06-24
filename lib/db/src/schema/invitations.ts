import {
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Invitation links (tester / coach / parent onboarding).
//
// A token-based invite. On acceptance it (1) grants `targetRole` to the accepting
// user and (2) — for relationship invites — creates the corresponding link row in
// coach_athlete_links / parent_athlete_links.
//
//   relationship "coach_athlete"  → inviter is the coach, accepter is the athlete
//   relationship "parent_athlete" → inviter is the parent/guardian, accepter is
//                                    the (minor) athlete
//   relationship "none"           → role grant only (admin-created), no link
//   relationship "head_tester"    → admin-minted; marks the accepter as the
//                                    Hoofdtester (sets user_profiles.isHeadTester).
//                                    No link row; targetRole stays "athlete".
//
// status lifecycle: pending → accepted | revoked | expired
export const invitationStatuses = [
  "pending",
  "accepted",
  "expired",
  "revoked",
] as const;
export type InvitationStatus = (typeof invitationStatuses)[number];

export const invitationRelationships = [
  "coach_athlete",
  "parent_athlete",
  "none",
  "head_tester",
] as const;
export type InvitationRelationship = (typeof invitationRelationships)[number];

export const invitationsTable = pgTable("invitations", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),

  // Who created the invite and in what capacity.
  inviterClerkId: text("inviter_clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade", onUpdate: "cascade" }),
  createdByRole: text("created_by_role").notNull(), // "admin" | "coach" | "parent"

  // What the accepter gets.
  targetRole: text("target_role").notNull(), // "athlete" | "coach" | "parent"
  relationship: text("relationship").notNull().default("none"),

  // Optional intended recipient (display only — acceptance is token-based).
  email: text("email"),

  status: text("status").notNull().default("pending"),
  acceptedByClerkId: text("accepted_by_clerk_id").references(
    () => userProfilesTable.clerkId,
    { onDelete: "set null", onUpdate: "cascade" },
  ),

  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertInvitationSchema = createInsertSchema(invitationsTable).omit({
  id: true,
});
export const selectInvitationSchema = createSelectSchema(invitationsTable);

export type Invitation = typeof invitationsTable.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
