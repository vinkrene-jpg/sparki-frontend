// SPARKI_BUILD_04 F2 — klant, sporter en betaler (BB-62).
//
// DRIE ENTITEITEN, GEEN ÉÉN. De klant/afnemer is wie de dienst afneemt en
// gefactureerd wordt; de sporter is wie begeleid wordt; de betalende partij
// (billing_party) draagt factuuradres en betaalplicht. Een ouder betaalt voor
// een kind, een werkgever voor een medewerker, een sponsor betaalt, of de
// sporter betaalt zelf. Wie dit samenvoegt moet het bij het eerste jeugdlid
// weer uit elkaar halen — samenvoegen is een directe afkeurgrond (§14).

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

export const TRAINER_CLIENT_TYPES = ["particulier", "bedrijf", "ouder", "sponsor"] as const;
export type TrainerClientType = (typeof TRAINER_CLIENT_TYPES)[number];

export const TRAINER_CLIENT_STATUSES = ["actief", "inactief", "wachtlijst", "beeindigd"] as const;
export type TrainerClientStatus = (typeof TRAINER_CLIENT_STATUSES)[number];

// De klant van een zelfstandige trainer. clientNumber is per trainer
// oplopend en wordt in de aanmaak-transactie toegekend (geen SELECT MAX()+1
// buiten de tx; unieke index vangt races af).
export const trainerClientsTable = pgTable(
  "trainer_clients",
  {
    id: serial("id").primaryKey(),
    trainerClerkId: text("trainer_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    clientNumber: integer("client_number").notNull(),
    name: text("name").notNull(),
    clientType: text("client_type").notNull().default("particulier"),
    address: text("address"),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    companyName: text("company_name"),
    vatNumber: text("vat_number"),
    kvkNumber: text("kvk_number"),
    paymentTermDays: integer("payment_term_days"),
    defaultServiceNote: text("default_service_note"),
    note: text("note"),
    status: text("status").notNull().default("actief"),
    // Als de klant zelf een Sparki-account heeft (bv. de ouder of de sporter
    // zelf), koppelt dit veld — optioneel, een klant hoeft geen account te
    // hebben.
    clientClerkId: text("client_clerk_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("trainer_clients_number_uq").on(t.trainerClerkId, t.clientNumber),
    index("trainer_clients_trainer_idx").on(t.trainerClerkId),
  ],
);

export type TrainerClient = typeof trainerClientsTable.$inferSelect;

export const CLIENT_ATHLETE_RELATIONS = ["zelf", "ouder", "werkgever", "sponsor"] as const;
export type ClientAthleteRelation = (typeof CLIENT_ATHLETE_RELATIONS)[number];

// Koppeling klant ↔ sporter met relatietype en looptijd. Eén klant kan
// meerdere sporters dragen (ouder met twee kinderen) en één sporter kan bij
// meerdere klanten horen (gescheiden ouders, sponsor + zelf).
export const clientAthleteLinksTable = pgTable(
  "client_athlete_links",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => trainerClientsTable.id, { onDelete: "cascade" }),
    athleteClerkId: text("athlete_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    relationType: text("relation_type").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [
    index("client_athlete_links_client_idx").on(t.clientId),
    index("client_athlete_links_athlete_idx").on(t.athleteClerkId),
  ],
);

export type ClientAthleteLink = typeof clientAthleteLinksTable.$inferSelect;

// De betalende partij per klant: wie draagt factuuradres en betaalplicht.
// Meestal de klant zelf, maar expliciet apart vastgelegd zodat factuuradres
// en betaalplicht kunnen afwijken (werkgever betaalt, contactpersoon is de
// medewerker).
export const billingPartiesTable = pgTable(
  "billing_parties",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => trainerClientsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    email: text("email"),
    vatNumber: text("vat_number"),
    // Eén actieve betaalpartij per klant; historie blijft staan via endedAt.
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [index("billing_parties_client_idx").on(t.clientId)],
);

export type BillingParty = typeof billingPartiesTable.$inferSelect;
