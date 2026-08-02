import {
  pgTable,
  serial,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Sparki Input Center — the one central place where an athlete hands Sparki
// information: a photo, an image/PDF/file upload, a pasted link or a typed
// question. Every turn is persisted here so the conversation (including the
// uploaded items) stays visible across sessions — it is NOT ephemeral UI state.
//
// This is the foundation other features (Document Analysis, Race Intelligence,
// Materiaalcoach) build on. Keyed off clerkId like every other table.

// Who produced the turn. "athlete" = the rider's input; "sparki" = Sparki's
// reply. (The term "AI" never appears in user-facing copy.)
export const inputMessageRoles = ["athlete", "sparki"] as const;
export type InputMessageRole = (typeof inputMessageRoles)[number];

// Coarse kind of an attachment, derived from its content type at upload time.
// Drives how the item renders in the conversation (thumbnail vs file chip).
export const inputAttachmentKinds = [
  "photo",
  "image",
  "pdf",
  "file",
] as const;
export type InputAttachmentKind = (typeof inputAttachmentKinds)[number];

// One stored file in object storage, linked to the athlete via the message row.
// `objectPath` is the normalized "/objects/..." path used to build the serving
// URL (GET /api/storage<objectPath>). Bytes live in GCS, never in the DB.
export type InputAttachment = {
  objectPath: string;
  name: string;
  contentType: string;
  size: number | null;
  kind: InputAttachmentKind;
  // F11: centrale files-rij die bij deze bijlage hoort. Wordt bij het finaliseren
  // van een bericht gezet (registratie via de veiligheidspoort). Nullable: legacy-
  // bijlagen van vóór de omlegging hebben geen fileId en blijven werken via
  // objectPath (lazy koppeling — geen destructieve backfill).
  fileId?: number | null;
};

// A cited source returned alongside a Sparki reply (mirrors the knowledge-base
// shape used elsewhere). Stored so the conversation keeps its citations.
export type InputMessageSource = {
  id: number;
  title: string;
  url: string;
  source: string | null;
};

export const sparkiInputMessagesTable = pgTable(
  "sparki_input_messages",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    role: text("role").notNull(),
    // The athlete's typed question or Sparki's reply. Nullable: an athlete turn
    // may be only an upload or only a link with no words.
    text: text("text"),
    // A pasted link the athlete wants Sparki to look at. Nullable.
    link: text("link"),
    // Stored uploads for this turn (photo/image/pdf/file). Null when none.
    attachments: jsonb("attachments").$type<InputAttachment[]>(),
    // Cited sources for a Sparki reply. Null for athlete turns / no citations.
    sources: jsonb("sources").$type<InputMessageSource[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sim_clerk_created_idx").on(t.clerkId, t.createdAt)],
);

export const insertSparkiInputMessageSchema = createInsertSchema(
  sparkiInputMessagesTable,
).omit({ id: true });
export const selectSparkiInputMessageSchema = createSelectSchema(
  sparkiInputMessagesTable,
);

export type SparkiInputMessage = typeof sparkiInputMessagesTable.$inferSelect;
export type InsertSparkiInputMessage = z.infer<
  typeof insertSparkiInputMessageSchema
>;
