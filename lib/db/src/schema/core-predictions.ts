import {
  pgTable,
  serial,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";
import { plannedWorkoutsTable } from "./athlete-training";

// ─────────────────────────────────────────────────────────────────────────────
// Core-prediction snapshots (task #89).
//
// Each row is an IMMUTABLE snapshot of Sparki's predicted Core effect for ONE
// planned workout, frozen at the moment it was computed. The full prediction
// (current → during → end → recovery rebound frames, determining factors with
// honest availability, and a confidence that is never 1.0) lives in `prediction`
// as deterministic JSON — nothing is fabricated.
//
// `inputHash` fingerprints the PRE-KNOWN inputs the prediction was based on
// (planned load, structure, current load, readiness, health, date). A new
// prediction is computed ONLY when that hash changes while the workout is still
// unexecuted; the previous row is then marked `supersededAt` (kept for history,
// never mutated). Once the workout is executed the snapshot is never recomputed.
// ─────────────────────────────────────────────────────────────────────────────
export const corePredictionsTable = pgTable(
  "core_predictions",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    plannedWorkoutId: integer("planned_workout_id")
      .notNull()
      .references(() => plannedWorkoutsTable.id, { onDelete: "cascade" }),
    // Fingerprint of the pre-known inputs this prediction was based on.
    inputHash: text("input_hash").notNull(),
    // The frozen deterministic prediction payload (see engine CorePrediction).
    prediction: jsonb("prediction").notNull(),
    // Set when a newer prediction supersedes this one (input changed pre-exec).
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("core_predictions_workout_idx").on(t.plannedWorkoutId),
    index("core_predictions_clerk_idx").on(t.clerkId),
  ],
);

export const insertCorePredictionSchema = createInsertSchema(
  corePredictionsTable,
).omit({ id: true });
export const selectCorePredictionSchema =
  createSelectSchema(corePredictionsTable);

export type CorePredictionRow = typeof corePredictionsTable.$inferSelect;
export type InsertCorePredictionRow = z.infer<
  typeof insertCorePredictionSchema
>;
