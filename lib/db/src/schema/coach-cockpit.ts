import {
  pgTable,
  serial,
  text,
  integer,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";
import { plannedWorkoutsTable } from "./athlete-training";

// ── Coach-cockpit ─────────────────────────────────────────────────────────────
// Aanvullend op de bestaande coachreis (invitations → coach_athlete_links →
// routes/coach.ts). Deze tabellen bevatten alleen wat nergens anders bestaat:
//   1. coach_signal_actions — het besluit van de coach op een aandachtssignaal
//      (accepteren/aanpassen/afwijzen/parkeren + korte notitie). Signalen zelf
//      worden deterministisch op leesmoment berekend, nooit opgeslagen.
//   2. coach_messages — compacte communicatie coach ↔ sporter, optioneel
//      gekoppeld aan een training, activiteit of signaal, met gelezen-status.
//   3. coach_context_items — door de coach vastgelegde begeleidingscontext
//      (blessure-afspraak, school/werk, beperking, wedstrijddoel, instructie).
//   4. coach_change_proposals — Sparki's voorstel om een COACH-training te
//      wijzigen. Wordt nooit automatisch toegepast: alleen de coach kan het
//      goedkeuren (dan pas wordt de training aangepast).

export const COACH_SIGNAL_ACTIONS = [
  "accepteren",
  "aanpassen",
  "afwijzen",
  "parkeren",
] as const;
export type CoachSignalAction = (typeof COACH_SIGNAL_ACTIONS)[number];

export const coachSignalActionsTable = pgTable(
  "coach_signal_actions",
  {
    id: serial("id").primaryKey(),
    coachClerkId: text("coach_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Stabiele signaalsleutel, bv. "herstel:2026-07-22" of "wedstrijd_nabij:12".
    signalKey: text("signal_key").notNull(),
    action: text("action").$type<CoachSignalAction>().notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("coach_signal_actions_unique").on(
      t.coachClerkId,
      t.athleteClerkId,
      t.signalKey,
    ),
    index("coach_signal_actions_athlete_idx").on(t.athleteClerkId),
  ],
);

export const COACH_MESSAGE_SUBJECTS = [
  "algemeen",
  "training",
  "activiteit",
  "signaal",
] as const;
export type CoachMessageSubject = (typeof COACH_MESSAGE_SUBJECTS)[number];

export const coachMessagesTable = pgTable(
  "coach_messages",
  {
    id: serial("id").primaryKey(),
    coachClerkId: text("coach_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Wie dit bericht schreef (coach óf sporter binnen dezelfde koppeling).
    senderClerkId: text("sender_clerk_id").notNull(),
    body: text("body").notNull(),
    subjectType: text("subject_type")
      .$type<CoachMessageSubject>()
      .notNull()
      .default("algemeen"),
    // training → planned_workouts.id, activiteit → training_sessions.id,
    // signaal → signalKey (als tekst in subjectKey hieronder).
    subjectId: integer("subject_id"),
    subjectKey: text("subject_key"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("coach_messages_pair_idx").on(t.coachClerkId, t.athleteClerkId),
  ],
);

export const COACH_CONTEXT_KINDS = [
  "blessure_afspraak",
  "school_werk",
  "beperking",
  "wedstrijddoel",
  "instructie",
] as const;
export type CoachContextKind = (typeof COACH_CONTEXT_KINDS)[number];

export const coachContextItemsTable = pgTable(
  "coach_context_items",
  {
    id: serial("id").primaryKey(),
    coachClerkId: text("coach_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    kind: text("kind").$type<CoachContextKind>().notNull(),
    body: text("body").notNull(),
    startDate: date("start_date"),
    // Inclusief; null = tot nader order.
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("coach_context_items_pair_idx").on(t.coachClerkId, t.athleteClerkId),
  ],
);

// WP-01C — ECHTE privénotities van een trainer over een sporter.
// Alleen zichtbaar voor de trainer die ze maakte (owner). Nooit voor de
// sporter, andere trainers of hoofdtrainer; nooit gebruikt door engines of
// AI-prompts; inhoud komt nooit in auditpayloads (alleen metadata).
export const coachPrivateNotesTable = pgTable(
  "coach_private_notes",
  {
    id: serial("id").primaryKey(),
    // Eigenaar — de enige die deze notitie ooit mag lezen of wijzigen.
    ownerCoachClerkId: text("owner_coach_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    body: text("body").notNull(),
    // Optionele vrije context (bijv. "voorjaar 2026", "gesprek 12 mei").
    context: text("context"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("coach_private_notes_owner_pair_idx").on(
      t.ownerCoachClerkId,
      t.athleteClerkId,
    ),
  ],
);

export const insertCoachPrivateNoteSchema = createInsertSchema(coachPrivateNotesTable);
export const selectCoachPrivateNoteSchema = createSelectSchema(coachPrivateNotesTable);
export type CoachPrivateNote = typeof coachPrivateNotesTable.$inferSelect;

export const COACH_PROPOSAL_STATUSES = [
  "open",
  "geaccepteerd",
  "aangepast",
  "afgewezen",
  "geparkeerd",
] as const;
export type CoachProposalStatus = (typeof COACH_PROPOSAL_STATUSES)[number];

export interface CoachProposalChanges {
  title?: string;
  scheduledDate?: string;
  targetDurationMin?: number;
  targetTSS?: number;
  intensity?: string;
  cancel?: boolean;
}

export const coachChangeProposalsTable = pgTable(
  "coach_change_proposals",
  {
    id: serial("id").primaryKey(),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    workoutId: integer("workout_id")
      .notNull()
      .references(() => plannedWorkoutsTable.id, { onDelete: "cascade" }),
    // Waarom Sparki dit voorstelt (echte aanleiding: feedback/signaal).
    reason: text("reason").notNull(),
    changes: jsonb("changes").$type<CoachProposalChanges>().notNull(),
    status: text("status")
      .$type<CoachProposalStatus>()
      .notNull()
      .default("open"),
    coachNote: text("coach_note"),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("coach_change_proposals_athlete_idx").on(t.athleteClerkId),
    // Race-veilige idempotentie: hooguit één OPEN voorstel per training,
    // afgedwongen in de database (niet alleen read-then-insert).
    uniqueIndex("coach_change_proposals_open_unique")
      .on(t.workoutId)
      .where(sql`${t.status} = 'open'`),
  ],
);

export const insertCoachSignalActionSchema = createInsertSchema(coachSignalActionsTable);
export const selectCoachSignalActionSchema = createSelectSchema(coachSignalActionsTable);
export const insertCoachMessageSchema = createInsertSchema(coachMessagesTable);
export const selectCoachMessageSchema = createSelectSchema(coachMessagesTable);
export const insertCoachContextItemSchema = createInsertSchema(coachContextItemsTable);
export const selectCoachContextItemSchema = createSelectSchema(coachContextItemsTable);
export const insertCoachChangeProposalSchema = createInsertSchema(coachChangeProposalsTable);
export const selectCoachChangeProposalSchema = createSelectSchema(coachChangeProposalsTable);

export type CoachSignalActionRow = typeof coachSignalActionsTable.$inferSelect;
export type CoachMessage = typeof coachMessagesTable.$inferSelect;
export type CoachContextItem = typeof coachContextItemsTable.$inferSelect;
export type CoachChangeProposal = typeof coachChangeProposalsTable.$inferSelect;
export type InsertCoachSignalAction = z.infer<typeof insertCoachSignalActionSchema>;
export type InsertCoachMessage = z.infer<typeof insertCoachMessageSchema>;
export type InsertCoachContextItem = z.infer<typeof insertCoachContextItemSchema>;
export type InsertCoachChangeProposal = z.infer<typeof insertCoachChangeProposalSchema>;
