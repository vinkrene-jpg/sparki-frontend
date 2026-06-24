import {
  pgTable,
  serial,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Materiaalcoach — photo-driven equipment & nutrition analysis.
//
// Each row is one "case": one or more real uploaded photos (stored in object
// storage, referenced by normalized object path), the structured analysis Sparki
// produced from those photos, and — for material (not nutrition) cases — a
// DIY-vs-professional cost estimate. Confidence is always explicit; when Sparki
// cannot judge confidently the case is left in "needs_more" with a follow-up
// question instead of guessing.

export const materialCategoryKeys = [
  "wheelset",
  "tyres",
  "brakes",
  "chain",
  "helmet",
  "breakfast",
  "race_nutrition",
  "bike_problem",
  "other",
] as const;
export type MaterialCategoryKey = (typeof materialCategoryKeys)[number];

export const materialConfidenceLevels = [
  "unknown",
  "low",
  "medium",
  "high",
] as const;
export type MaterialConfidenceLevel = (typeof materialConfidenceLevels)[number];

export const materialAnalysisStatuses = ["analyzed", "needs_more"] as const;
export type MaterialAnalysisStatus = (typeof materialAnalysisStatuses)[number];

// Structured advice block — plain Dutch strings, never fabricated.
export type MaterialAdvice = {
  summary: string;
  pros: string[];
  cons: string[];
  risks: string[];
  alternatives: string[];
};

// Cost estimate is only present for material (not nutrition) cases. Either side
// may be null when it cannot be estimated honestly; confidence is always set.
export type MaterialCostEstimate = {
  diy: {
    materials: string[];
    costRange: string;
    difficulty: string;
    timeEstimate: string;
  } | null;
  professional: {
    laborCost: string;
    totalCost: string;
  } | null;
  confidence: MaterialConfidenceLevel;
  note: string | null;
};

export const materialAnalysesTable = pgTable("material_analyses", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  category: text("category").notNull(),
  userNote: text("user_note"),
  status: text("status").notNull().default("analyzed"),
  // Normalized object paths (e.g. "/objects/uploads/<uuid>") of the uploaded photos.
  photoPaths: jsonb("photo_paths").$type<string[]>().notNull().default([]),
  detectedItem: text("detected_item"),
  confidence: text("confidence").notNull().default("unknown"),
  followUpQuestion: text("follow_up_question"),
  advice: jsonb("advice").$type<MaterialAdvice | null>(),
  costEstimate: jsonb("cost_estimate").$type<MaterialCostEstimate | null>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMaterialAnalysisSchema = createInsertSchema(
  materialAnalysesTable,
).omit({ id: true });
export const selectMaterialAnalysisSchema =
  createSelectSchema(materialAnalysesTable);

export type MaterialAnalysis = typeof materialAnalysesTable.$inferSelect;
export type InsertMaterialAnalysis = z.infer<
  typeof insertMaterialAnalysisSchema
>;
