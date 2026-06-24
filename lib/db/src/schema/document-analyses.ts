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
import { racesTable } from "./races";

// Document Analysis — Sparki reads an uploaded race/technical guide (technische
// gids, wedstrijdgids, etappeboek, routekaart, tijdschema) and extracts the
// key facts for real. Never fakes values: a field that is not literally in the
// document is recorded as missing, and Sparki asks a follow-up question instead.

// Detected kind of document.
export const documentAnalysisKinds = [
  "technische_gids",
  "wedstrijdgids",
  "etappeboek",
  "routekaart",
  "tijdschema",
  "onbekend",
] as const;
export type DocumentAnalysisKind = (typeof documentAnalysisKinds)[number];

export const documentAnalysisStatuses = [
  "analyzing",
  "analyzed",
  "failed",
] as const;
export type DocumentAnalysisStatus =
  (typeof documentAnalysisStatuses)[number];

// One extracted field. `value` is null when the document does not state it;
// `confidence` reflects how sure the extraction is when a value IS present.
export type ExtractedField = {
  key: string;
  value: string | null;
  confidence: "high" | "medium" | "low" | null;
};

export const documentAnalysesTable = pgTable("document_analyses", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  fileName: text("file_name").notNull(),
  mediaType: text("media_type").notNull(),
  documentKind: text("document_kind").notNull().default("onbekend"),
  status: text("status").notNull().default("analyzing"),
  // Plain-Dutch one-line summary of what the document is.
  summary: text("summary"),
  // Map of fieldKey -> ExtractedField (value possibly null).
  extractedFields: jsonb("extracted_fields"),
  // Field keys that are present (non-null value).
  foundFields: jsonb("found_fields"),
  // Field keys that are absent but expected (core or desired).
  missingFields: jsonb("missing_fields"),
  // Targeted Dutch follow-up questions for the missing/uncertain fields.
  followUpQuestions: jsonb("follow_up_questions"),
  errorMessage: text("error_message"),
  linkedRaceId: integer("linked_race_id").references(() => racesTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertDocumentAnalysisSchema = createInsertSchema(
  documentAnalysesTable,
).omit({ id: true });
export const selectDocumentAnalysisSchema = createSelectSchema(
  documentAnalysesTable,
);

export type DocumentAnalysis = typeof documentAnalysesTable.$inferSelect;
export type InsertDocumentAnalysis = z.infer<
  typeof insertDocumentAnalysisSchema
>;
