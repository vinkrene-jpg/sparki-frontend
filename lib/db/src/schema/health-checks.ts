import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Admin Health Check engine persistence.
//
// Honesty contract: every status MUST come from a real probe, or be GREY with a
// plain-language reason ("nog niet gekoppeld"). There are no hard-coded greens.
//
// Three tables:
//  - health_check_results : the LATEST result per check key (one row per key).
//  - health_check_runs    : append-only history — one row per check execution.
//  - health_check_batches : one row per engine run (all checks), powering the
//                           test-history and release-check history views.

// The four allowed statuses, shown to the admin with fixed colours:
//  green  = works
//  orange = needs attention (slow, near a limit, token close to expiry)
//  red    = outage
//  grey   = not active / not connected yet (honestly unwired)
export const healthStatusColors = ["green", "orange", "red", "grey"] as const;
export type HealthStatusColor = (typeof healthStatusColors)[number];

export const healthUrgencies = ["low", "medium", "high", "critical"] as const;
export type HealthUrgency = (typeof healthUrgencies)[number];

// Logical area a check belongs to (drives the dashboard grouping).
export const healthCategories = [
  "auth",
  "database",
  "storage",
  "connector",
  "maps",
  "gps",
  "gpx",
  "mail",
  "notifications",
  "ai",
  "nightly",
  "goals",
  "onboarding",
  "invite",
  "parent",
  "feedback",
  "bugreport",
  "links",
] as const;
export type HealthCategory = (typeof healthCategories)[number];

// The mode a run was triggered in. Used to separate test history (any run)
// from release-check history (mode = "release").
export const healthRunModes = [
  "manual",
  "single",
  "daily",
  "weekly",
  "release",
] as const;
export type HealthRunMode = (typeof healthRunModes)[number];

// ── Latest result per check key (upserted on every run) ──────────────────────
export const healthCheckResultsTable = pgTable(
  "health_check_results",
  {
    id: serial("id").primaryKey(),
    // Stable check identifier from the engine registry, e.g. "auth_clerk".
    checkKey: text("check_key").notNull().unique(),
    category: text("category").$type<HealthCategory>().notNull(),
    // Plain-language label + description shown to a non-technical admin.
    title: text("title").notNull(),
    description: text("description").notNull(),
    // Which module/area is responsible (for routing a fix).
    responsibleModule: text("responsible_module").notNull(),
    statusColor: text("status_color").$type<HealthStatusColor>().notNull(),
    passed: boolean("passed").notNull(),
    responseTimeMs: integer("response_time_ms"),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    // Plain-language error / reason (never a raw "API 403").
    errorMessage: text("error_message"),
    // Optional technical detail for the admin who wants to dig in.
    technicalDetails: text("technical_details"),
    // Who is affected, in plain language (athletes/parents/coaches/admins).
    userImpact: text("user_impact").notNull(),
    urgency: text("urgency").$type<HealthUrgency>().notNull().default("low"),
    // Suggested next action in plain Dutch.
    remediation: text("remediation"),
    // Acknowledgement: set when an admin marks a failure as resolved.
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("hc_results_category_idx").on(t.category)],
);

// ── Append-only execution history (one row per check run) ─────────────────────
export const healthCheckRunsTable = pgTable(
  "health_check_runs",
  {
    id: serial("id").primaryKey(),
    checkKey: text("check_key").notNull(),
    // Links a row to the batch it was part of (null for ad-hoc single checks).
    batchId: integer("batch_id"),
    runMode: text("run_mode").$type<HealthRunMode>().notNull(),
    statusColor: text("status_color").$type<HealthStatusColor>().notNull(),
    passed: boolean("passed").notNull(),
    responseTimeMs: integer("response_time_ms"),
    errorMessage: text("error_message"),
    technicalDetails: text("technical_details"),
    ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("hc_runs_key_ran_idx").on(t.checkKey, t.ranAt)],
);

// ── One row per engine run (all checks) → test/release history ────────────────
export const healthCheckBatchesTable = pgTable(
  "health_check_batches",
  {
    id: serial("id").primaryKey(),
    runMode: text("run_mode").$type<HealthRunMode>().notNull(),
    // Worst status across all checks in the batch (grey excluded from "worst").
    overallStatus: text("overall_status")
      .$type<HealthStatusColor>()
      .notNull(),
    totalChecks: integer("total_checks").notNull().default(0),
    greenCount: integer("green_count").notNull().default(0),
    orangeCount: integer("orange_count").notNull().default(0),
    redCount: integer("red_count").notNull().default(0),
    greyCount: integer("grey_count").notNull().default(0),
    // clerkId of the admin who triggered it, or "scheduler" for cron runs.
    triggeredBy: text("triggered_by").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("hc_batches_mode_started_idx").on(t.runMode, t.startedAt)],
);

export const insertHealthCheckResultSchema = createInsertSchema(
  healthCheckResultsTable,
).omit({ id: true });
export const selectHealthCheckResultSchema = createSelectSchema(
  healthCheckResultsTable,
);
export const insertHealthCheckRunSchema = createInsertSchema(
  healthCheckRunsTable,
).omit({ id: true });
export const insertHealthCheckBatchSchema = createInsertSchema(
  healthCheckBatchesTable,
).omit({ id: true });

export type HealthCheckResult = typeof healthCheckResultsTable.$inferSelect;
export type InsertHealthCheckResult = z.infer<
  typeof insertHealthCheckResultSchema
>;
export type HealthCheckRun = typeof healthCheckRunsTable.$inferSelect;
export type InsertHealthCheckRun = z.infer<typeof insertHealthCheckRunSchema>;
export type HealthCheckBatch = typeof healthCheckBatchesTable.$inferSelect;
export type InsertHealthCheckBatch = z.infer<
  typeof insertHealthCheckBatchSchema
>;
