import {
  pgTable,
  serial,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { isNull } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Acceptatiebewijs voor verplichte juridische documenten ──────────────────
// Append-only bewijslaag: één rij per acceptatie van (gebruiker, document,
// versie). Ontbrekend bewijs = niet geaccepteerd (fail-closed). Intrekken zet
// revoked_at op de bestaande rij; er wordt nooit een rij verwijderd, zodat
// "geaccepteerd op versie X op datum Y" altijd verifieerbaar blijft.
// clerk_id is bewust niet foreign-keyed: het bewijs moet een later verwijderd
// account blijven documenteren.
export const legalAcceptanceSources = [
  "web",
  "mobiel",
  "pwa",
  "onbekend",
] as const;
export type LegalAcceptanceSource = (typeof legalAcceptanceSources)[number];

export const legalAcceptancesTable = pgTable(
  "legal_acceptances",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id").notNull(),
    // Documentsoort: "terms" | "privacy" | "gezondheid" (gezondheids- en
    // trainingsdisclaimer). Bewust text: nieuwe verplichte documenten mogen
    // additief bijkomen zonder enum-migratie.
    kind: text("kind").notNull(),
    version: text("version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Client/bron van het akkoord: web | mobiel | pwa | onbekend.
    source: text("source").notNull().default("onbekend"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("legal_acceptances_clerk_kind_idx").on(t.clerkId, t.kind),
    // Hooguit één actief (niet-ingetrokken) akkoord per gebruiker+document+
    // versie — maakt accepteren race-veilig idempotent op DB-niveau.
    uniqueIndex("legal_acceptances_active_unique_idx")
      .on(t.clerkId, t.kind, t.version)
      .where(isNull(t.revokedAt)),
  ],
);

export const insertLegalAcceptanceSchema = createInsertSchema(
  legalAcceptancesTable,
);
export type LegalAcceptance = typeof legalAcceptancesTable.$inferSelect;
export type InsertLegalAcceptance = z.infer<typeof insertLegalAcceptanceSchema>;
