import {
  pgTable,
  serial,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ── Klimmenverkenner server-side cache ──────────────────────────────────────
// Overpass-zoekopdrachten duren 10–15+ s; klimtoppen veranderen zelden. Deze
// tabel onthoudt ECHTE, eerder opgehaalde resultaten per sleutel:
//   - "climbs:<lat3>,<lon3>:r<straal>"  → rauwe ClimbHit[] uit Overpass
//   - "geo:<genormaliseerde zoekterm>"  → Nominatim-geocoderesultaat
// Eerlijkheidscontract: er staat hier alleen wat écht van de bron kwam; na de
// TTL wordt de rij genegeerd en volgt een verse echte fetch. Er wordt nooit
// iets verzonnen of bijgeschat.
export const climbCacheTable = pgTable(
  "climb_cache_entries",
  {
    id: serial("id").primaryKey(),
    cacheKey: text("cache_key").notNull(),
    // Het echte bron-antwoord (JSON), precies zoals opgehaald/afgeleid.
    payload: jsonb("payload").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("climb_cache_key_idx").on(t.cacheKey)],
);

export type ClimbCacheEntry = typeof climbCacheTable.$inferSelect;
