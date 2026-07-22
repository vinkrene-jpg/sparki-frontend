import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";
import { routesTable } from "./routes";

// Golf 19 — routes veilig delen + versiegebruik vastleggen.
//
// route_shares: met wie een route gedeeld is. Delen verwijst altijd naar de
// route zelf (reference-only); kijkers krijgen op leesmoment een
// privacy-getransformeerde geometrie (start/einde afgekapt, privacyzone rond
// het huis van de eigenaar) — de originele route blijft intern intact.
//
// route_version_usages: welke routeversie een training, wedstrijd, activiteit
// of navigatiesessie gebruikte. Snapshotvelden (routeName) zodat historie
// leesbaar blijft, ook wanneer de route later wordt verwijderd (routeId wordt
// dan null, de rij blijft).

export const routeShareAudiences = [
  "coach",
  "club",
  "team",
  "persoon",
] as const;
export type RouteShareAudience = (typeof routeShareAudiences)[number];

export const routeSharesTable = pgTable(
  "route_shares",
  {
    id: serial("id").primaryKey(),
    routeId: integer("route_id")
      .notNull()
      .references(() => routesTable.id, { onDelete: "cascade" }),
    ownerClerkId: text("owner_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // coach | club | team | persoon
    audience: text("audience").notNull(),
    // Alleen gevuld bij audience "persoon".
    targetClerkId: text("target_clerk_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // nullsNotDistinct: doelgroep-shares (coach/club/team) hebben target NULL;
    // zonder deze vlag ziet Postgres iedere NULL als uniek en is nogmaals
    // delen niet idempotent (dubbele rijen).
    unique("route_shares_unique")
      .on(t.routeId, t.audience, t.targetClerkId)
      .nullsNotDistinct(),
    index("route_shares_route_idx").on(t.routeId),
    index("route_shares_target_idx").on(t.targetClerkId),
  ],
);

export const routeUsageContexts = [
  "training",
  "wedstrijd",
  "activiteit",
  "navigatie",
] as const;
export type RouteUsageContext = (typeof routeUsageContexts)[number];

export const routeVersionUsagesTable = pgTable(
  "route_version_usages",
  {
    id: serial("id").primaryKey(),
    // set null bij verwijderen: de historie-rij blijft bestaan.
    routeId: integer("route_id").references(() => routesTable.id, {
      onDelete: "set null",
    }),
    // Snapshot zodat historie leesbaar blijft na verwijderen van de route.
    routeName: text("route_name").notNull(),
    version: integer("version").notNull(),
    context: text("context").notNull(),
    contextId: integer("context_id").notNull(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Idempotent: één usage-rij per route+context+contextId.
    uniqueIndex("route_version_usages_unique").on(
      t.routeId,
      t.context,
      t.contextId,
    ),
    index("route_version_usages_clerk_idx").on(t.clerkId),
  ],
);

export const insertRouteShareSchema = createInsertSchema(
  routeSharesTable,
).omit({ id: true });
export const selectRouteShareSchema = createSelectSchema(routeSharesTable);
export const insertRouteVersionUsageSchema = createInsertSchema(
  routeVersionUsagesTable,
).omit({ id: true });

export type RouteShare = typeof routeSharesTable.$inferSelect;
export type InsertRouteShare = z.infer<typeof insertRouteShareSchema>;
export type RouteVersionUsage = typeof routeVersionUsagesTable.$inferSelect;
