import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// ── Friendships (athlete-to-athlete "Circle") ────────────────────────────────
// A single directed row per pair. `requester` invited `addressee`; once accepted
// it represents a mutual friendship. Each side independently flags the other as
// a "training buddy" (someone they pre-selected to train with) — so the flag is
// per-direction, read from the current viewer's own side.
export const friendLinkStatuses = ["pending", "accepted", "declined"] as const;
export type FriendLinkStatus = (typeof friendLinkStatuses)[number];

export const friendLinksTable = pgTable(
  "friend_links",
  {
    id: serial("id").primaryKey(),
    requesterClerkId: text("requester_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    addresseeClerkId: text("addressee_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    status: text("status").notNull().default("pending"),
    // requester's own selection of this friend as a training buddy
    requesterTrainingBuddy: boolean("requester_training_buddy")
      .notNull()
      .default(false),
    // addressee's own selection of this friend as a training buddy
    addresseeTrainingBuddy: boolean("addressee_training_buddy")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    // SPARKI_BUILD_01 F2 (BB-09): relatiehistorie. endedAt gezet = beëindigd —
    // geen actuele toegang meer, rij blijft bestaan als historie.
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [unique().on(t.requesterClerkId, t.addresseeClerkId)],
);

// ── Volgen (eenzijdig) ───────────────────────────────────────────────────────
// Los van vriendschap: `follower` volgt `followee` eenzijdig. Volgen kan alleen
// wanneer het profiel van de gevolgde dit toestaat (server-side afgedwongen).
export const followLinksTable = pgTable(
  "follow_links",
  {
    id: serial("id").primaryKey(),
    followerClerkId: text("follower_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    followeeClerkId: text("followee_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.followerClerkId, t.followeeClerkId)],
);

// ── Per-categorie profielprivacy ─────────────────────────────────────────────
// Eén rij per gebruiker. `categories` is een map categorie → publiek
// (iedereen | sparki | volgers | vrienden | begeleiders | alleen_ik).
// Ontbrekende categorieën vallen terug op de server-side defaults
// (gezondheid en live locatie standaard "alleen_ik").
export const profilePrivacyTable = pgTable("profile_privacy", {
  clerkId: text("clerk_id")
    .primaryKey()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  categories: jsonb("categories")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Rapportages (blokkeren zit in world_blocks) ──────────────────────────────
export const socialReportsTable = pgTable("social_reports", {
  id: serial("id").primaryKey(),
  reporterClerkId: text("reporter_clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  reportedClerkId: text("reported_clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Club / team identity ─────────────────────────────────────────────────────
// One row per athlete. Holds the club/team branding shown subtly in profile/home.
// Cycling-first (ploeg/club + categorie + shirt/badge) but generic enough to
// extend to team sports later.
export const teamIdentitiesTable = pgTable("team_identities", {
  clerkId: text("clerk_id")
    .primaryKey()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  clubName: text("club_name"),
  teamName: text("team_name"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  sport: text("sport"),
  // wielrennen: categorie (bv. "Nieuweling", "Junioren", "Amateurs")
  category: text("category"),
  // shirt / rugnummer-badge tekst (optioneel)
  shirtBadge: text("shirt_badge"),
  // rol van de sporter binnen het team (bv. "renner", "kopman", "aanvoerder")
  role: text("role"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Group training proposals ─────────────────────────────────────────────────
// A proposer suggests a joint training to one or more friends. Proposal status is
// the lifecycle of the plan itself; each invitee has their own accept/decline.
export const groupTrainingStatuses = [
  "open",
  "completed",
  "cancelled",
] as const;
export type GroupTrainingStatus = (typeof groupTrainingStatuses)[number];

export const groupTrainingProposalsTable = pgTable(
  "group_training_proposals",
  {
    id: serial("id").primaryKey(),
    proposerClerkId: text("proposer_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    trainingType: text("training_type").notNull(),
    durationMin: integer("duration_min"),
    area: text("area"),
    intensity: text("intensity"),
    note: text("note"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const groupTrainingInviteeStatuses = [
  "proposed",
  "accepted",
  "declined",
] as const;
export type GroupTrainingInviteeStatus =
  (typeof groupTrainingInviteeStatuses)[number];

export const groupTrainingInviteesTable = pgTable(
  "group_training_invitees",
  {
    id: serial("id").primaryKey(),
    proposalId: integer("proposal_id")
      .notNull()
      .references(() => groupTrainingProposalsTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    inviteeClerkId: text("invitee_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    status: text("status").notNull().default("proposed"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [unique().on(t.proposalId, t.inviteeClerkId)],
);

export const insertFriendLinkSchema = createInsertSchema(friendLinksTable).omit({
  id: true,
});
export const insertTeamIdentitySchema = createInsertSchema(teamIdentitiesTable);
export const insertGroupTrainingProposalSchema = createInsertSchema(
  groupTrainingProposalsTable,
).omit({ id: true });
export const insertGroupTrainingInviteeSchema = createInsertSchema(
  groupTrainingInviteesTable,
).omit({ id: true });
export const selectTeamIdentitySchema =
  createSelectSchema(teamIdentitiesTable);

export type FriendLink = typeof friendLinksTable.$inferSelect;
export type FollowLink = typeof followLinksTable.$inferSelect;
export type ProfilePrivacy = typeof profilePrivacyTable.$inferSelect;
export type SocialReport = typeof socialReportsTable.$inferSelect;
export type TeamIdentity = typeof teamIdentitiesTable.$inferSelect;
export type GroupTrainingProposal =
  typeof groupTrainingProposalsTable.$inferSelect;
export type GroupTrainingInvitee =
  typeof groupTrainingInviteesTable.$inferSelect;

export type InsertFriendLink = z.infer<typeof insertFriendLinkSchema>;
export type InsertTeamIdentity = z.infer<typeof insertTeamIdentitySchema>;
export type InsertGroupTrainingProposal = z.infer<
  typeof insertGroupTrainingProposalSchema
>;
export type InsertGroupTrainingInvitee = z.infer<
  typeof insertGroupTrainingInviteeSchema
>;
