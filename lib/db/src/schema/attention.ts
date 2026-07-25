import {
  pgTable,
  serial,
  text,
  integer,
  date,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { userProfilesTable } from "./users";

// Aandacht-rotatie — houdt per gebruiker bij hoe vaak een niet-kritiek
// meerijdend bericht (nudge, releasekaart, onderhoudssignaal) daadwerkelijk in
// beeld is geweest. Een bericht dat een aantal dagen getoond is zonder dat de
// gebruiker er iets mee deed, krijgt een pauze zodat een ander bericht (of
// niets) de ruimte krijgt. De onderliggende melding/situatie blijft gewoon
// bestaan en bereikbaar (bel, Mechanieker, koppelingen) — dit stuurt alleen de
// presentatie op Vandaag. Kritieke berichten (gezondheid, vastgesteld defect,
// veiligheid/privacy) doen hier bewust NIET aan mee.
//
// Datumvelden zijn Amsterdamse kalenderdagen (YYYY-MM-DD), nooit UTC-dagen.
export const attentionImpressionsTable = pgTable(
  "attention_impressions",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Stabiele identiteit van het getoonde item, bijv.
    // "nudge:materiaal:ketting:123" of "release:45". Nieuwe situatie ⇒ nieuwe
    // sleutel ⇒ verse aandacht.
    itemKey: text("item_key").notNull(),
    firstSeenOn: date("first_seen_on").notNull(),
    lastSeenOn: date("last_seen_on").notNull(),
    // Aantal verschillende dagen getoond binnen de huidige cyclus (reset bij
    // elke pauze).
    daysSeen: integer("days_seen").notNull().default(1),
    // Tot en met wanneer het item pauzeert (exclusief: op deze dag mag het
    // weer). NULL of in het verleden = gewoon toonbaar.
    snoozedUntil: date("snoozed_until"),
    timesSnoozed: integer("times_snoozed").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("attention_clerk_item_idx").on(t.clerkId, t.itemKey),
  ],
);

export const insertAttentionImpressionSchema = createInsertSchema(
  attentionImpressionsTable,
).omit({ id: true });
export const selectAttentionImpressionSchema = createSelectSchema(
  attentionImpressionsTable,
);

export type AttentionImpression = typeof attentionImpressionsTable.$inferSelect;
export type InsertAttentionImpression = z.infer<
  typeof insertAttentionImpressionSchema
>;
