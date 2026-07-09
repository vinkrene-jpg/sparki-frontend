import {
  pgTable,
  serial,
  text,
  integer,
  date,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// ── Doelen-engine (task: meerjarige doelen met dagelijkse bewaking) ───────────
// The athlete's goal picture: a main goal plus sub-goals across season/year/
// multi-year horizons. Manual goals live here; DERIVED goals (A/B races,
// developmentGoal, nutrition season goal) are composed at read time by the
// goals engine and are NOT duplicated into these rows. Every meaningful change
// (adjustment, injury impact, achieved, proposal accepted/rejected) is recorded
// as an immutable goal_events row — nothing is silently changed.

export const goalHorizons = ["season", "year", "multi_year"] as const;
export type GoalHorizon = (typeof goalHorizons)[number];

export const goalStatuses = [
  "active",
  "achieved",
  "adjusted",
  "paused",
  "dropped",
] as const;
export type GoalStatus = (typeof goalStatuses)[number];

export const athleteGoalsTable = pgTable(
  "athlete_goals",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Sub-goal support: a sub-goal points at its main goal. Soft self-reference
    // (plain int) — enforced in the goals engine, cleared when the parent goes.
    parentGoalId: integer("parent_goal_id"),
    title: text("title").notNull(),
    description: text("description"),
    horizon: text("horizon").notNull().default("season"), // season | year | multi_year
    targetDate: date("target_date"),
    // Honest measurability: how progress is judged. free text like
    // "FTP naar 300 W" plus optional numeric target for deterministic checks.
    measure: text("measure"),
    targetValue: text("target_value"),
    priority: integer("priority").notNull().default(2), // 1 = hoofddoel, 2/3 = subdoel
    status: text("status").notNull().default("active"),
    statusReason: text("status_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("athlete_goals_clerk_idx").on(t.clerkId, t.status)],
);

export const goalEventTypes = [
  "created",
  "adjusted",
  "injury_impact",
  "achieved",
  "paused",
  "resumed",
  "dropped",
  "proposal_created",
  "proposal_accepted",
  "proposal_rejected",
] as const;
export type GoalEventType = (typeof goalEventTypes)[number];

export const goalEventsTable = pgTable(
  "goal_events",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    goalId: integer("goal_id")
      .notNull()
      .references(() => athleteGoalsTable.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    note: text("note"),
    // Structured event payload (before/after values, proposal contents, etc.).
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("goal_events_goal_idx").on(t.goalId)],
);

// Monthly (and on-demand) adjustment proposals per goal. The athlete confirms
// or rejects; only an accepted proposal changes the goal (via the engine).
export const goalProposalKinds = [
  "load", // trainingsbelasting aanpassen
  "nutrition", // voeding bijsturen
  "recovery", // herstel/rust inbouwen
  "goal_adjust", // het doel zelf bijstellen (datum/meetlat/status)
  "goal_review", // overige doelen herzien na behaald/vervallen doel
] as const;
export type GoalProposalKind = (typeof goalProposalKinds)[number];

export const goalProposalsTable = pgTable(
  "goal_proposals",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Null for goal_review proposals that span the whole picture.
    goalId: integer("goal_id").references(() => athleteGoalsTable.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").notNull(), // GoalProposalKind
    title: text("title").notNull(),
    reasoning: text("reasoning").notNull(), // deterministic, plain-Dutch onderbouwing
    // Structured change the proposal would apply when accepted, e.g.
    // { targetDate: "2027-05-01" } or { status: "adjusted", statusReason: "..." }.
    proposedChange: jsonb("proposed_change"),
    status: text("status").notNull().default("open"), // open | accepted | rejected | expired
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    // Idempotency for the monthly job: one proposal per goal+kind+period.
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("goal_proposals_clerk_idx").on(t.clerkId, t.status),
    // Hard idempotency guarantee: one proposal per athlete+dedupeKey, safe
    // under concurrent job/API runs (insert with onConflictDoNothing).
    uniqueIndex("goal_proposals_dedupe_uq").on(t.clerkId, t.dedupeKey),
  ],
);

export const insertAthleteGoalSchema = createInsertSchema(
  athleteGoalsTable,
).omit({ id: true });
export const selectAthleteGoalSchema = createSelectSchema(athleteGoalsTable);
export const insertGoalEventSchema = createInsertSchema(goalEventsTable).omit({
  id: true,
});
export const insertGoalProposalSchema = createInsertSchema(
  goalProposalsTable,
).omit({ id: true });

export type AthleteGoal = typeof athleteGoalsTable.$inferSelect;
export type InsertAthleteGoal = z.infer<typeof insertAthleteGoalSchema>;
export type GoalEvent = typeof goalEventsTable.$inferSelect;
export type InsertGoalEvent = z.infer<typeof insertGoalEventSchema>;
export type GoalProposal = typeof goalProposalsTable.$inferSelect;
export type InsertGoalProposal = z.infer<typeof insertGoalProposalSchema>;
