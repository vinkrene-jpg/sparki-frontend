import {
  pgTable,
  serial,
  integer,
  real,
  text,
  boolean,
  jsonb,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// ─────────────────────────────────────────────────────────────────────────────
// Sparki World — a living, TRANSPARENTLY-FICTIONAL sport world.
//
// Every athlete in here is a "Virtual Athlete": a simulated character, never a
// real person and never disguised as one. Sparki World content is kept on its
// own island — it must NEVER bleed into a real user's performance/coaching data
// (no virtual FTP in your analysis, no virtual race on your calendar). The hard
// wall is enforced by keeping these tables fully separate from the athlete
// tables: real users only ever *reference* Virtual Athletes via follows and
// interactions, never the other way around.
//
// Honesty contract still holds: numbers are deterministic and plausible (no
// impossible feats); prose/personality is generated but validated before it is
// published; when something can't be generated we stay honest (no placeholder
// posing as real content).
// ─────────────────────────────────────────────────────────────────────────────

// ── Media Engine cache ───────────────────────────────────────────────────────
// The single source of truth for every generated image. The whole point of this
// table is AGGRESSIVE REUSE: a deterministic `promptKey` is derived from the
// semantic attributes of a desired image (sport + discipline + scene + weather
// + …). Two requests with the same key resolve to the SAME stored object — we
// only ever generate a brand-new image when no row matches. Avatars are unique
// per athlete (key includes the athlete slug); scenes are shared across the
// whole world. Video is intentionally out of scope for the MVP (kind stays
// "image"); the column exists so phase-2 video slots in without a migration.
export const virtualMediaKinds = ["image", "video"] as const;
export type VirtualMediaKind = (typeof virtualMediaKinds)[number];

export const virtualMediaStatuses = ["ready", "failed"] as const;
export type VirtualMediaStatus = (typeof virtualMediaStatuses)[number];

export const virtualMediaTable = pgTable("virtual_media", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull().default("image"),
  // What this asset depicts, used to scope reuse (e.g. "avatar", "scene",
  // "equipment", "podium", "coffee_stop").
  purpose: text("purpose").notNull(),
  // Deterministic cache key — UNIQUE so reuse is enforced at the DB level.
  promptKey: text("prompt_key").notNull().unique(),
  // The full prompt actually sent to the generator (kept for auditing/regen).
  prompt: text("prompt").notNull(),
  // Normalized object-storage path (e.g. "/objects/uploads/<uuid>"), or null
  // when generation failed (status "failed" + an honest failureReason).
  objectPath: text("object_path"),
  aspectRatio: text("aspect_ratio").notNull().default("1:1"),
  status: text("status").notNull().default("ready"),
  failureReason: text("failure_reason"),
  // Semantic attributes the key was derived from (for debugging/dashboards).
  attributes: jsonb("attributes").$type<Record<string, unknown>>(),
  // How many posts/athletes point at this asset — proof the cache is working.
  reuseCount: integer("reuse_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Virtual Athletes (the population) ────────────────────────────────────────
// Queryable, believability-critical fields are real columns (used for feed
// personalization and plausibility checks); the long tail of personality and
// preferences lives in `traits` jsonb.
export const virtualAthleteStatuses = ["active", "draft"] as const;
export type VirtualAthleteStatus = (typeof virtualAthleteStatuses)[number];

export const virtualAthletesTable = pgTable("virtual_athletes", {
  id: serial("id").primaryKey(),
  // Stable handle (e.g. "lotte-van-den-berg"); used in URLs and media keys.
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  age: integer("age"),
  gender: text("gender"), // "v" | "m" | "x"
  nationality: text("nationality"),
  city: text("city"),
  language: text("language").notNull().default("nl"),
  sport: text("sport").notNull().default("wielrennen"),
  discipline: text("discipline"), // weg | gravel | mtb | baan | triatlon
  level: text("level"), // jeugd | recreant | amateur | master | elite | prof
  // A recognisable character archetype (e.g. "klimmer", "sprinter",
  // "tijdrijder", "gravelspecialist", "ultra", "materiaalexpert",
  // "jonge belofte", "master", "wetenschappelijke coach", "humoristische recreant").
  archetype: text("archetype"),
  heightCm: integer("height_cm"),
  weightKg: real("weight_kg"),
  ftp: integer("ftp"),
  vo2max: real("vo2max"),
  recoveryCapacity: text("recovery_capacity"), // laag | gemiddeld | hoog
  team: text("team"),
  sponsor: text("sponsor"),
  coachName: text("coach_name"),
  // The athlete's story (verhaal), in plain Dutch.
  bio: text("bio"),
  // The long tail: humor, intelligence, ambition, perseverance, stress
  // resilience, social traits, materiaalvoorkeur, voeding, favorite trainings/
  // routes/music, injury history, doelen[], family, etc.
  traits: jsonb("traits").$type<Record<string, unknown>>(),
  avatarMediaId: integer("avatar_media_id").references(
    () => virtualMediaTable.id,
    { onDelete: "set null" },
  ),
  status: text("status").notNull().default("active"),
  // Which generator version produced this athlete (eases regen/migration).
  seedVersion: integer("seed_version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Relationships between Virtual Athletes ───────────────────────────────────
// friend | rival | teammate | coach | family. Directed rows; the simulation and
// social engine read both directions as needed.
export const virtualRelationshipKinds = [
  "friend",
  "rival",
  "teammate",
  "coach",
  "family",
] as const;
export type VirtualRelationshipKind =
  (typeof virtualRelationshipKinds)[number];

export const virtualRelationshipsTable = pgTable(
  "virtual_athlete_relationships",
  {
    id: serial("id").primaryKey(),
    athleteId: integer("athlete_id")
      .notNull()
      .references(() => virtualAthletesTable.id, { onDelete: "cascade" }),
    relatedAthleteId: integer("related_athlete_id")
      .notNull()
      .references(() => virtualAthletesTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.athleteId, t.relatedAthleteId, t.kind)],
);

// ── Living life — the event timeline ─────────────────────────────────────────
// Each row is one thing that happened to an athlete on a given day. The nightly
// simulation appends these; posts are generated from them. `payload` carries the
// structured, deterministic specifics (e.g. race result, training metrics) so
// nothing is fabricated at render time.
export const virtualEventsTable = pgTable("virtual_events", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id")
    .notNull()
    .references(() => virtualAthletesTable.id, { onDelete: "cascade" }),
  // The in-world calendar date this happened (YYYY-MM-DD).
  eventDate: text("event_date").notNull(),
  // training | rest | race | equipment | maintenance | altitude_camp |
  // training_camp | vacation | new_team | sponsor | relationship | injury |
  // recovery | win | loss | disappointment | motivation | weather | illness
  type: text("type").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Feed posts ───────────────────────────────────────────────────────────────
// Generated from events. A post is only ever shown when validationStatus is
// "approved"; rejected content carries a reason and is regenerated, never shown.
export const virtualPostKinds = [
  "photo",
  "reel",
  "story",
  "poll",
  "review",
  "training_log",
  "nutrition",
  "humor",
  "observation",
] as const;
export type VirtualPostKind = (typeof virtualPostKinds)[number];

export const virtualPostValidationStatuses = [
  "pending",
  "approved",
  "rejected",
] as const;
export type VirtualPostValidationStatus =
  (typeof virtualPostValidationStatuses)[number];

export const virtualPostsTable = pgTable("virtual_posts", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id")
    .notNull()
    .references(() => virtualAthletesTable.id, { onDelete: "cascade" }),
  eventId: integer("event_id").references(() => virtualEventsTable.id, {
    onDelete: "set null",
  }),
  kind: text("kind").notNull().default("photo"),
  // Plain-Dutch caption / body.
  caption: text("caption").notNull(),
  mediaId: integer("media_id").references(() => virtualMediaTable.id, {
    onDelete: "set null",
  }),
  // For polls: the options + (later) tallies.
  pollOptions: jsonb("poll_options").$type<string[]>(),
  validationStatus: text("validation_status").notNull().default("pending"),
  validationNotes: text("validation_notes"),
  // In-world publish timestamp (drives feed ordering), null until approved.
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Interactions (likes / comments) ──────────────────────────────────────────
// Either a Virtual Athlete (actorAthleteId) or a real user (actorClerkId) acts
// on a post — exactly one of the two is set. Real-user interactions are how the
// community feels two-way without breaking the fiction.
export const virtualInteractionKinds = ["like", "comment"] as const;
export type VirtualInteractionKind =
  (typeof virtualInteractionKinds)[number];

export const virtualInteractionsTable = pgTable(
  "virtual_interactions",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => virtualPostsTable.id, { onDelete: "cascade" }),
    // Virtual actor (one of actorAthleteId / actorClerkId is set).
    actorAthleteId: integer("actor_athlete_id").references(
      () => virtualAthletesTable.id,
      { onDelete: "cascade" },
    ),
    // Real-user actor.
    actorClerkId: text("actor_clerk_id").references(
      () => userProfilesTable.clerkId,
      { onDelete: "cascade", onUpdate: "cascade" },
    ),
    kind: text("kind").notNull(),
    // Plain-Dutch comment body (null for likes).
    body: text("body"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

// ── Real user → Virtual Athlete follows / favorites ──────────────────────────
export const userVirtualFollowsTable = pgTable(
  "user_virtual_follows",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    athleteId: integer("athlete_id")
      .notNull()
      .references(() => virtualAthletesTable.id, { onDelete: "cascade" }),
    // A followed athlete the user explicitly marked as a favorite.
    favorite: boolean("favorite").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.clerkId, t.athleteId)],
);

// ── Zod + inferred types ─────────────────────────────────────────────────────
export const insertVirtualMediaSchema = createInsertSchema(
  virtualMediaTable,
).omit({ id: true });
export const insertVirtualAthleteSchema = createInsertSchema(
  virtualAthletesTable,
).omit({ id: true });
export const insertVirtualRelationshipSchema = createInsertSchema(
  virtualRelationshipsTable,
).omit({ id: true });
export const insertVirtualEventSchema = createInsertSchema(
  virtualEventsTable,
).omit({ id: true });
export const insertVirtualPostSchema = createInsertSchema(
  virtualPostsTable,
).omit({ id: true });
export const insertVirtualInteractionSchema = createInsertSchema(
  virtualInteractionsTable,
).omit({ id: true });
export const insertUserVirtualFollowSchema = createInsertSchema(
  userVirtualFollowsTable,
).omit({ id: true });

export const selectVirtualAthleteSchema =
  createSelectSchema(virtualAthletesTable);
export const selectVirtualPostSchema = createSelectSchema(virtualPostsTable);

export type VirtualMedia = typeof virtualMediaTable.$inferSelect;
export type VirtualAthlete = typeof virtualAthletesTable.$inferSelect;
export type VirtualRelationship =
  typeof virtualRelationshipsTable.$inferSelect;
export type VirtualEvent = typeof virtualEventsTable.$inferSelect;
export type VirtualPost = typeof virtualPostsTable.$inferSelect;
export type VirtualInteraction = typeof virtualInteractionsTable.$inferSelect;
export type UserVirtualFollow = typeof userVirtualFollowsTable.$inferSelect;

export type InsertVirtualMedia = z.infer<typeof insertVirtualMediaSchema>;
export type InsertVirtualAthlete = z.infer<typeof insertVirtualAthleteSchema>;
export type InsertVirtualRelationship = z.infer<
  typeof insertVirtualRelationshipSchema
>;
export type InsertVirtualEvent = z.infer<typeof insertVirtualEventSchema>;
export type InsertVirtualPost = z.infer<typeof insertVirtualPostSchema>;
export type InsertVirtualInteraction = z.infer<
  typeof insertVirtualInteractionSchema
>;
export type InsertUserVirtualFollow = z.infer<
  typeof insertUserVirtualFollowSchema
>;
