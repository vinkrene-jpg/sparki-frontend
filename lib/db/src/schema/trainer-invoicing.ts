// SPARKI_BUILD_04 F5/F6/F8 — diensten, terugkerende coaching en facturen.
//
// Bindend:
// - BB-61/BB-63: er loopt GEEN geld over Sparki; dit is administratie.
// - BB-64: één doorlopende factuurreeks per onderneming; nummer server-side
//   bij verzending (reeksteller in trainer_business, gemuteerd in de
//   verzend-tx), nooit bij het concept, nooit client-side.
// - BB-68: statussen concept · verzonden · betaald · te_laat · gecrediteerd ·
//   ingetrokken (vóór verzending). Na verzending nooit overschrijven —
//   correctie uitsluitend via creditnota.
// - BB-69: geen blind automatisch verzenden; Sparki maakt concepten klaar.
// - Klantgegevens worden op de factuur BEVROREN bij verzending (snapshot).

import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./users";
import { trainerClientsTable } from "./trainer-clients";

// 4.3 — dienstencatalogus van de trainer. Prijzen in eurocenten.
export const SERVICE_UNITS = ["maand", "week", "blok", "losse_sessie"] as const;

export const trainerServicesTable = pgTable(
  "trainer_services",
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
    priceCents: integer("price_cents").notNull(),
    // BTW-tarief in basispunten van procenten ×100 (21% = 2100). Bij KOR is
    // het tarief 0 en draagt de factuurregel de KOR-vermelding.
    vatRateBps: integer("vat_rate_bps").notNull().default(2100),
    unit: text("unit").notNull().default("maand"),
    durationNote: text("duration_note"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("trainer_services_trainer_idx").on(t.trainerClerkId)],
);

export type TrainerService = typeof trainerServicesTable.$inferSelect;

// 4.4 — terugkerende coachingcyclus per klant.
export const BILLING_CYCLES = ["wekelijks", "maandelijks"] as const;

export const recurringBillingTable = pgTable(
  "recurring_billing",
  {
    id: serial("id").primaryKey(),
    trainerClerkId: text("trainer_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    clientId: integer("client_id")
      .notNull()
      .references(() => trainerClientsTable.id, { onDelete: "cascade" }),
    cycle: text("cycle").notNull(), // wekelijks | maandelijks
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    vatRateBps: integer("vat_rate_bps").notNull().default(2100),
    korApplied: boolean("kor_applied").notNull().default(false),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    paymentTermDays: integer("payment_term_days").notNull().default(14),
    active: boolean("active").notNull().default(true),
    // Tot en met welke periode-einddatum er al een concept is aangemaakt —
    // maakt conceptgeneratie idempotent (nooit twee concepten voor dezelfde
    // periode).
    billedThrough: date("billed_through"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("recurring_billing_trainer_idx").on(t.trainerClerkId),
    index("recurring_billing_client_idx").on(t.clientId),
  ],
);

export type RecurringBilling = typeof recurringBillingTable.$inferSelect;

// 4.5 — factuur. Bedragen in eurocenten; klantsnapshot bevroren bij verzending.
export const INVOICE_STATUSES = [
  "concept",
  "verzonden",
  "betaald",
  "te_laat",
  "gecrediteerd",
  "ingetrokken",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const trainerInvoicesTable = pgTable(
  "trainer_invoices",
  {
    id: serial("id").primaryKey(),
    trainerClerkId: text("trainer_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    clientId: integer("client_id")
      .notNull()
      .references(() => trainerClientsTable.id, { onDelete: "restrict" }),
    // Sporter is een eigen veld op de factuur (3c.3-A): ouder betaalt voor
    // kind — klant én sporter staan er allebei op.
    athleteClerkId: text("athlete_clerk_id"),
    // NULL tot verzending; daarna definitief en nooit hergebruikt (BB-64).
    invoiceNumber: text("invoice_number"),
    invoiceDate: date("invoice_date"),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    serviceDate: date("service_date"),
    dueDate: date("due_date"),
    // Bevroren klant- en ondernemingsgegevens op het moment van verzending.
    clientSnapshot: jsonb("client_snapshot").$type<Record<string, unknown>>(),
    businessSnapshot: jsonb("business_snapshot").$type<Record<string, unknown>>(),
    description: text("description").notNull().default(""),
    amountExclCents: integer("amount_excl_cents").notNull().default(0),
    vatBreakdown: jsonb("vat_breakdown").$type<Record<string, number>>(),
    amountInclCents: integer("amount_incl_cents").notNull().default(0),
    korApplied: boolean("kor_applied").notNull().default(false),
    currency: text("currency").notNull().default("EUR"),
    status: text("status").notNull().default("concept"),
    templateVersion: integer("template_version"),
    recurringBillingId: integer("recurring_billing_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidCents: integer("paid_cents").notNull().default(0),
    creditNoteId: integer("credit_note_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Reeksintegriteit: nummer uniek per onderneming (NULL-concepten vallen
    // buiten de unieke index).
    uniqueIndex("trainer_invoices_number_uq").on(t.trainerClerkId, t.invoiceNumber),
    index("trainer_invoices_trainer_idx").on(t.trainerClerkId),
    index("trainer_invoices_client_idx").on(t.clientId),
  ],
);

export type TrainerInvoice = typeof trainerInvoicesTable.$inferSelect;

export const trainerInvoiceLinesTable = pgTable(
  "trainer_invoice_lines",
  {
    id: serial("id").primaryKey(),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => trainerInvoicesTable.id, { onDelete: "cascade" }),
    serviceId: integer("service_id"),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull(),
    vatRateBps: integer("vat_rate_bps").notNull().default(2100),
    amountCents: integer("amount_cents").notNull(),
    // F6: bewijs- of rapportkoppeling — maakt navolgbaar wat gefactureerd is
    // ("de FTP-test van 12 maart", niet "een test"). Verwijst naar een
    // werkobject (testverslag e.d.).
    evidenceWorkObjectId: integer("evidence_work_object_id"),
  },
  (t) => [index("trainer_invoice_lines_invoice_idx").on(t.invoiceId)],
);

export type TrainerInvoiceLine = typeof trainerInvoiceLinesTable.$inferSelect;

export const creditNotesTable = pgTable(
  "trainer_credit_notes",
  {
    id: serial("id").primaryKey(),
    trainerClerkId: text("trainer_clerk_id")
      .notNull()
      .references(() => userProfilesTable.clerkId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => trainerInvoicesTable.id, { onDelete: "restrict" }),
    // Creditnota's delen dezelfde doorlopende reeks van de onderneming.
    creditNumber: text("credit_number").notNull(),
    reason: text("reason").notNull(),
    partial: boolean("partial").notNull().default(false),
    amountInclCents: integer("amount_incl_cents").notNull(),
    status: text("status").notNull().default("verzonden"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("trainer_credit_notes_number_uq").on(t.trainerClerkId, t.creditNumber),
    index("trainer_credit_notes_invoice_idx").on(t.invoiceId),
  ],
);

export type CreditNote = typeof creditNotesTable.$inferSelect;
