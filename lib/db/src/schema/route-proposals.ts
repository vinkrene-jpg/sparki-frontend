import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";
import { routesTable } from "./routes";

// Routevoorstel naar een fietsmaatje (Golf: routedeling). De eigenaar van een
// route stelt die voor aan een geaccepteerde vriend. De ontvanger kan het
// voorstel accepteren (route wordt naar de eigen bibliotheek gekopieerd),
// afwijzen, of aanpassen. Een aangepaste versie is ALTIJD een NIEUWE routes-rij
// van de ontvanger (adjusted_route_id) — het origineel blijft ongewijzigd.
export const routeProposalStatuses = [
  "open",
  "geaccepteerd",
  "afgewezen",
  "aangepast",
] as const;
export type RouteProposalStatus = (typeof routeProposalStatuses)[number];

export const routeProposalsTable = pgTable(
  "route_proposals",
  {
    id: serial("id").primaryKey(),
    routeId: integer("route_id")
      .notNull()
      .references(() => routesTable.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    fromClerkId: text("from_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    toClerkId: text("to_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    status: text("status").notNull().default("open"),
    note: text("note"),
    // De aangepaste versie: een nieuwe routes-rij van de ontvanger. Null zolang
    // het voorstel niet is aangepast. Het origineel (route_id) blijft altijd
    // ongewijzigd bestaan.
    adjustedRouteId: integer("adjusted_route_id").references(
      () => routesTable.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    index("route_proposal_to_idx").on(t.toClerkId, t.status),
    index("route_proposal_from_idx").on(t.fromClerkId),
    index("route_proposal_route_idx").on(t.routeId),
  ],
);

export const insertRouteProposalSchema = createInsertSchema(
  routeProposalsTable,
).omit({ id: true });
export const selectRouteProposalSchema =
  createSelectSchema(routeProposalsTable);

export type RouteProposal = typeof routeProposalsTable.$inferSelect;
export type InsertRouteProposal = z.infer<typeof insertRouteProposalSchema>;
