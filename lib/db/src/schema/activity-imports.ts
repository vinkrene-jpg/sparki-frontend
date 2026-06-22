import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";
import { trainingSessionsTable } from "./athlete-training";

// Manual activity import (GPX/FIT/TCX/CSV) — foundation before external
// integrations. v1 parses GPX metadata for real; FIT may be stored with a
// "uploaded" status and parsed later. Never fake parsed values.

export const activityImportFileTypes = [
  "gpx",
  "fit",
  "tcx",
  "csv",
  "unknown",
] as const;
export type ActivityImportFileType = (typeof activityImportFileTypes)[number];

export const activityImportStatuses = [
  "uploaded",
  "parsed",
  "failed",
  "linked",
] as const;
export type ActivityImportStatus = (typeof activityImportStatuses)[number];

export const activityImportsTable = pgTable("activity_imports", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull().default("unknown"),
  source: text("source").notNull().default("manual_upload"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  status: text("status").notNull().default("uploaded"),
  parsedSummary: jsonb("parsed_summary"),
  errorMessage: text("error_message"),
  linkedTrainingSessionId: integer("linked_training_session_id").references(
    () => trainingSessionsTable.id,
    { onDelete: "set null" },
  ),
});

export const insertActivityImportSchema = createInsertSchema(
  activityImportsTable,
).omit({ id: true });
export const selectActivityImportSchema =
  createSelectSchema(activityImportsTable);

export type ActivityImport = typeof activityImportsTable.$inferSelect;
export type InsertActivityImport = z.infer<typeof insertActivityImportSchema>;
