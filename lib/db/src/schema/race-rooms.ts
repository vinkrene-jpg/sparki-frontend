import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";
import { racesTable } from "./races";

// Wedstrijd-room — Phase 1 (single-user). An athlete creates a room (optionally
// tied to one of their races), uploads media + writes text updates per race day,
// and generates a real ffmpeg montage compilation of a day's contributions.
//
// The schema is intentionally Phase-2-ready: every item and compilation carries
// the contributor's clerkId so a future multi-person room (riders/parents/staff
// invited to share into the same room) can reuse these exact tables without a
// redesign. No fabricated content is ever stored — media are real uploads in
// object storage and compilations are real rendered files.
export const raceRoomsTable = pgTable("race_rooms", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  // Optional link to an existing race in the athlete's calendar.
  raceId: integer("race_id").references(() => racesTable.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  // First race day. days >= 1: a one-day race finishes after day 1; a multi-day
  // race spans startDate .. startDate + (days - 1).
  startDate: date("start_date").notNull(),
  days: integer("days").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// A single contribution to a room, tied to a specific race day.
// kind = "media": objectPath + mediaType point at the real uploaded file; caption
//   is an optional short line shown over the clip in a compilation.
// kind = "update": text holds the written update; it becomes a caption card.
export const raceRoomItemsTable = pgTable("race_room_items", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id")
    .notNull()
    .references(() => raceRoomsTable.id, { onDelete: "cascade" }),
  // Contributor (Phase 1: always the room owner; Phase 2: any invited member).
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  dayIndex: integer("day_index").notNull().default(1),
  kind: text("kind").notNull(), // "media" | "update"
  objectPath: text("object_path"), // "/objects/..." for media
  mediaType: text("media_type"), // e.g. "image/jpeg", "video/mp4"
  durationSec: numeric("duration_sec", { precision: 6, scale: 2 }), // video only
  caption: text("caption"), // optional line over a media clip
  text: text("text"), // the written update (kind = "update")
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// A rendered compilation for one race day (Phase 1). dayIndex null is reserved
// for a future whole-event compilation. status is honest: a day with no usable
// media is "empty" (with a plain-Dutch reason), a render error is "failed".
export const raceRoomCompilationsTable = pgTable("race_room_compilations", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id")
    .notNull()
    .references(() => raceRoomsTable.id, { onDelete: "cascade" }),
  clerkId: text("clerk_id")
    .notNull()
    .references(() => userProfilesTable.clerkId, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  dayIndex: integer("day_index"),
  status: text("status").notNull().default("pending"), // pending|processing|ready|empty|failed
  objectPath: text("object_path"), // "/objects/..." for the rendered mp4
  musicTrack: text("music_track"), // music bed key used
  itemCount: integer("item_count").notNull().default(0),
  durationSec: numeric("duration_sec", { precision: 6, scale: 2 }),
  reason: text("reason"), // plain-Dutch explanation when empty/failed
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertRaceRoomSchema = createInsertSchema(raceRoomsTable).omit({
  id: true,
});
export const selectRaceRoomSchema = createSelectSchema(raceRoomsTable);
export const insertRaceRoomItemSchema = createInsertSchema(
  raceRoomItemsTable,
).omit({ id: true });
export const selectRaceRoomItemSchema = createSelectSchema(raceRoomItemsTable);
export const insertRaceRoomCompilationSchema = createInsertSchema(
  raceRoomCompilationsTable,
).omit({ id: true });
export const selectRaceRoomCompilationSchema = createSelectSchema(
  raceRoomCompilationsTable,
);

export type RaceRoom = typeof raceRoomsTable.$inferSelect;
export type InsertRaceRoom = z.infer<typeof insertRaceRoomSchema>;
export type RaceRoomItem = typeof raceRoomItemsTable.$inferSelect;
export type InsertRaceRoomItem = z.infer<typeof insertRaceRoomItemSchema>;
export type RaceRoomCompilation = typeof raceRoomCompilationsTable.$inferSelect;
export type InsertRaceRoomCompilation = z.infer<
  typeof insertRaceRoomCompilationSchema
>;
