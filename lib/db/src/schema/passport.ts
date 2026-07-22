// Golf 20 — Sportpaspoort: herleidbare waardegeschiedenis + bevestigbare
// voorstellen bovenop athlete_profiles (dat de actuele-waarde-SSOT blijft).
//
// passport_value_events: append-only. IEDERE wijziging van een kernwaarde
// (ftp, gewicht, maxHr, zones-beïnvloedend, blessurestatus, …) krijgt een rij
// met herkomst (gemeten/handmatig/berekend/geschat), bron, wie of welke engine
// de wijziging deed en wanneer de waarde is gemeten. Rijen worden nooit
// bijgewerkt of verwijderd — historie blijft.
//
// passport_proposals: automatisch voorgestelde wijzigingen die trainingszones,
// veiligheidsregels of toekomstige trainingen raken. Alleen de sporter of een
// bevoegde (gekoppelde) coach mag besluiten; pas bij acceptatie wordt de
// waarde echt toegepast. Idempotent: hooguit één open voorstel per veld.
import {
  pgTable,
  serial,
  text,
  date,
  timestamp,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { userProfilesTable } from "./users";

// Herkomst van een waarde — bewust een klein, eerlijk vocabulaire.
export const passportOrigins = [
  "gemeten",
  "handmatig",
  "berekend",
  "geschat",
] as const;
export type PassportOrigin = (typeof passportOrigins)[number];

export const passportActorTypes = ["sporter", "coach", "engine"] as const;
export type PassportActorType = (typeof passportActorTypes)[number];

export const passportValueEventsTable = pgTable(
  "passport_value_events",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    // Veldnaam in athlete_profiles-termen (ftp, weightKg, maxHr, …).
    field: text("field").notNull(),
    // Waarden als tekst-snapshot zodat één tabel alle veldtypen aankan.
    oldValue: text("old_value"),
    newValue: text("new_value"),
    origin: text("origin").notNull(), // gemeten | handmatig | berekend | geschat
    // Menselijk leesbare bron: "FTP-test", "lactaattest", "Strava", "invoer", …
    source: text("source"),
    actorType: text("actor_type").notNull(), // sporter | coach | engine
    // clerkId van sporter/coach of de enginenaam.
    actorId: text("actor_id").notNull(),
    // Wanneer de waarde gemeten/vastgesteld is (≠ wanneer hij is opgeslagen).
    measuredAt: date("measured_at"),
    // 0–1; null = geen zinnige zekerheid te geven (nooit verzinnen).
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("passport_events_clerk_field_idx").on(t.clerkId, t.field),
    index("passport_events_clerk_created_idx").on(t.clerkId, t.createdAt),
  ],
);

export const passportProposalStatuses = [
  "open",
  "geaccepteerd",
  "afgewezen",
] as const;
export type PassportProposalStatus =
  (typeof passportProposalStatuses)[number];

export const passportProposalsTable = pgTable(
  "passport_proposals",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    field: text("field").notNull(),
    proposedValue: text("proposed_value").notNull(),
    currentValue: text("current_value"),
    origin: text("origin").notNull(),
    source: text("source"),
    // Eerlijke, Nederlandstalige onderbouwing (echte data, nooit verzonnen).
    reason: text("reason").notNull(),
    status: text("status").notNull().default("open"),
    // Enginenaam of clerkId van de voorsteller.
    proposedBy: text("proposed_by").notNull(),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("passport_proposals_open_unique")
      .on(t.clerkId, t.field)
      .where(sql`${t.status} = 'open'`),
    index("passport_proposals_clerk_idx").on(t.clerkId),
  ],
);

export const insertPassportValueEventSchema = createInsertSchema(
  passportValueEventsTable,
).omit({ id: true, createdAt: true });
export const selectPassportValueEventSchema = createSelectSchema(
  passportValueEventsTable,
);
export const insertPassportProposalSchema = createInsertSchema(
  passportProposalsTable,
).omit({ id: true, createdAt: true });
export const selectPassportProposalSchema = createSelectSchema(
  passportProposalsTable,
);
