import {
  pgTable,
  serial,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Relational personal-context memory.
//
// When an athlete tells Sparki about a life moment ("ik heb niet getraind want
// examen morgen"), Sparki stores it here and schedules a follow-up. This is NOT
// the same as ai_observations (cross-domain pattern detection): this table is the
// athlete's own narrated context plus a scheduled check-in. Keyed off clerkId
// like every other table.
//
// Persistence is privacy-gated (privacy_settings.ai_memory_enabled) at the
// service layer, identical to ai_observations.

export const contextMemoryKinds = [
  "exam",
  "race",
  "injury",
  "sleep",
  "camp",
  "general",
] as const;
export type ContextMemoryKind = (typeof contextMemoryKinds)[number];

// Lifecycle: scheduled → (athlete answers) followed_up | (athlete skips) dismissed.
// `enabled=false` keeps the item but stops follow-ups (athlete control).
export const contextMemoryStatuses = [
  "scheduled",
  "followed_up",
  "dismissed",
] as const;
export type ContextMemoryStatus = (typeof contextMemoryStatuses)[number];

// One transparency signal: what Sparki recognised in the athlete's words. Shown
// in the UI so the feature never feels like silent surveillance.
export type ContextSignal = { label: string; value: string };

export const personalContextMemoriesTable = pgTable(
  "personal_context_memories",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Detected category (see contextMemoryKinds).
    kind: text("kind").notNull().default("general"),
    // The athlete's own words that triggered the memory.
    statement: text("statement").notNull(),
    // Short Dutch label, e.g. "Examen".
    title: text("title").notNull(),
    // Dutch summary of what Sparki understood (no "AI" wording).
    detail: text("detail"),
    // Dutch question to ask at follow-up time.
    followUpQuestion: text("follow_up_question").notNull(),
    // When to surface the follow-up. Null = no follow-up scheduled.
    followUpAt: timestamp("follow_up_at", { withTimezone: true }),
    status: text("status").notNull().default("scheduled"),
    // The athlete's answer when the follow-up is completed.
    response: text("response"),
    // Athlete control: disabled items keep their history but stop following up.
    enabled: boolean("enabled").notNull().default(true),
    // What Sparki recognised (keywords / timing), for transparency.
    signals: jsonb("signals").$type<ContextSignal[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    followedUpAt: timestamp("followed_up_at", { withTimezone: true }),
  },
  (t) => [
    index("pcm_clerk_status_idx").on(t.clerkId, t.status),
    index("pcm_clerk_followup_idx").on(t.clerkId, t.followUpAt),
  ],
);

export const insertPersonalContextMemorySchema = createInsertSchema(
  personalContextMemoriesTable,
).omit({ id: true });
export const selectPersonalContextMemorySchema = createSelectSchema(
  personalContextMemoriesTable,
);

export type PersonalContextMemory =
  typeof personalContextMemoriesTable.$inferSelect;
export type InsertPersonalContextMemory = z.infer<
  typeof insertPersonalContextMemorySchema
>;
