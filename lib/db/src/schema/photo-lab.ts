import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Sparki Photo Lab — isolated, testable photo upload + "Sparki-style" edit flow.
//
// Each row is one upload session: the athlete's REAL uploaded photo (the
// "original" variant, stored in object storage by normalized object path) and,
// when the Sparki-style relight succeeds, the styled variant ("sparki_style").
// Both variants are kept side by side — the original is NEVER overwritten. The
// styled variant may be absent (styleStatus "failed") and we stay honest about
// that: the original always remains usable. chosenVariant is only set once the
// user explicitly picks which one to keep.

export const photoLabStyleStatuses = ["styled", "failed"] as const;
export type PhotoLabStyleStatus = (typeof photoLabStyleStatuses)[number];

export const photoLabVariants = ["original", "sparki_style"] as const;
export type PhotoLabVariant = (typeof photoLabVariants)[number];

export const photoLabUploadsTable = pgTable("photo_lab_uploads", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  // Normalized object path (e.g. "/objects/uploads/<uuid>") of the real upload.
  originalPath: text("original_path").notNull(),
  // F11: centrale files-rij van de originele upload (bron van waarheid voor de
  // veiligheidspoort, intrekbaarheid en retentie). Nullable: legacy-rijen die
  // vóór de omlegging zijn aangemaakt hebben geen fileId en blijven werken via
  // originalPath (lazy koppeling — geen destructieve backfill).
  originalFileId: integer("original_file_id"),
  // Normalized object path of the Sparki-styled variant, or null when styling
  // failed (in which case styleStatus is "failed" and the original stays usable).
  styledPath: text("styled_path"),
  styleStatus: text("style_status").notNull().default("failed"),
  // Plain-Dutch reason kept only when styling failed, for an honest message.
  failureReason: text("failure_reason"),
  // Which variant the user chose to keep. Null until they explicitly pick one —
  // nothing is ever treated as "kept" without that choice.
  chosenVariant: text("chosen_variant"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPhotoLabUploadSchema = createInsertSchema(
  photoLabUploadsTable,
).omit({ id: true });
export const selectPhotoLabUploadSchema =
  createSelectSchema(photoLabUploadsTable);

export type PhotoLabUpload = typeof photoLabUploadsTable.$inferSelect;
export type InsertPhotoLabUpload = z.infer<typeof insertPhotoLabUploadSchema>;
