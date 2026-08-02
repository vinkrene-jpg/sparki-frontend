// SPARKI_BUILD_04 — zelfstandige trainer: onderneming en profiel.
//
// BB-60: Sparki Trainer is een betaald abonnement — de tier TRAINER loopt via
// de BESTAANDE entitlementlaag (billing.ts COMMERCIAL_TIERS + resolver), er is
// hier bewust géén tweede rechten- of abonnementssysteem.
//
// 4.1 trainer_business: de onderneming van de trainer. Verplicht voor
// facturatie, NIET voor begeleiding (F1-test: ontbrekende bedrijfsgegevens
// blokkeren facturatie, niet het coachen).
//
// Factuurnummering (BB-64): één doorlopende reeks per onderneming. De reeks
// wordt hier alleen geconfigureerd (prefix + startnummer bij aanvang, zodat
// hij kan aansluiten op een bestaande externe reeks); toekenning gebeurt
// server-side bij verzending via een DB-teller, nooit in de client.

import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./users";

export const trainerBusinessTable = pgTable(
  "trainer_business",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    companyName: text("company_name"),
    tradeName: text("trade_name"),
    address: text("address"),
    kvkNumber: text("kvk_number"),
    vatNumber: text("vat_number"),
    iban: text("iban"),
    logoPath: text("logo_path"),
    letterheadTemplateId: integer("letterhead_template_id"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    // Betalingstermijn in dagen — standaard voor nieuwe facturen; per klant
    // overschrijfbaar (F2). Geen juridische waarde hardcoden: leeg = nog niet
    // gekozen door de trainer.
    paymentTermDays: integer("payment_term_days"),
    // BB-66 kleineondernemersregeling: alleen een schakelaar; wijziging geldt
    // alleen voor toekomstige facturen (afgedwongen in de factuurlaag, die de
    // KOR-stand per factuur bevriest).
    korActive: boolean("kor_active").notNull().default(false),
    // BB-64: reeksconfiguratie. nextInvoiceNumber wordt uitsluitend gemuteerd
    // in de verzend-transactie (F8) en mag nooit omlaag.
    invoicePrefix: text("invoice_prefix"),
    nextInvoiceNumber: integer("next_invoice_number"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("trainer_business_clerk_uq").on(t.clerkId)],
);

export type TrainerBusiness = typeof trainerBusinessTable.$inferSelect;

// Openbaar trainersprofiel (F1): specialisaties, certificeringen en
// beschikbaarheid. Los van de onderneming: begeleiding kan zonder
// bedrijfsgegevens, facturatie niet.
export const trainerProfilesTable = pgTable(
  "trainer_profiles",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    displayName: text("display_name"),
    bio: text("bio"),
    specialisations: jsonb("specialisations").$type<string[]>(),
    certifications: jsonb("certifications").$type<string[]>(),
    // Vrije beschikbaarheidstekst per dagdeel/weekdag — geen agenda (PD-1
    // blijft de agenda; dit is presentatie op het profiel).
    availabilityNote: text("availability_note"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("trainer_profiles_clerk_uq").on(t.clerkId)],
);

export type TrainerProfile = typeof trainerProfilesTable.$inferSelect;
