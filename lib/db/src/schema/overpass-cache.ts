import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// ── Persistente Overpass-antwoordcache (ROUTE_OVERPASS_STABILITEIT_01) ──────
// Wegdata verandert nauwelijks; dezelfde gebiedsvraag hoeft niet elke sessie
// opnieuw naar de (rate-limitende) mirrors. Sleutel = SHA-256 van de volledige
// query (bbox genormaliseerd vóór het bouwen van de query, zodat licht
// verschoven vragen dezelfde treffer geven). Eerlijkheidscontract: er staat
// hier alleen wat écht van de bron kwam; na de TTL (client-side) wordt de rij
// genegeerd en volgt een verse echte fetch.
export const overpassQueryCacheTable = pgTable("overpass_query_cache", {
  cacheKey: text("cache_key").primaryKey(),
  // Het echte bron-antwoord: { elements: [...], remark: string|null }.
  payload: jsonb("payload").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type OverpassQueryCacheEntry =
  typeof overpassQueryCacheTable.$inferSelect;
