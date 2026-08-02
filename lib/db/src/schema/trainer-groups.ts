// SPARKI_BUILD_04 F3 — sportergroepen van de zelfstandige trainer.
//
// Een groep is presentatie/organisatie (samen tonen, samen plannen), géén
// rechtenbron: rechten blijven uitsluitend bij de geaccepteerde directe
// koppeling (coach_athlete_links) — een groepslidmaatschap geeft nooit
// toegang tot sporterdata.

import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./users";

export const trainerGroupsTable = pgTable(
  "trainer_groups",
  {
    id: serial("id").primaryKey(),
    trainerClerkId: text("trainer_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("trainer_groups_name_uq").on(t.trainerClerkId, t.name),
    index("trainer_groups_trainer_idx").on(t.trainerClerkId),
  ],
);

export type TrainerGroup = typeof trainerGroupsTable.$inferSelect;

export const trainerGroupMembersTable = pgTable(
  "trainer_group_members",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => trainerGroupsTable.id, { onDelete: "cascade" }),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("trainer_group_members_uq").on(t.groupId, t.athleteClerkId),
    index("trainer_group_members_athlete_idx").on(t.athleteClerkId),
  ],
);

export type TrainerGroupMember = typeof trainerGroupMembersTable.$inferSelect;
