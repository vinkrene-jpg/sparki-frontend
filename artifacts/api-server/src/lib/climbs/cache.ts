// DB-backed cache voor de Klimmenverkenner. Overpass-zoekopdrachten duren
// 10–15+ s; klimtoppen veranderen zelden. Deze laag onthoudt echte, eerder
// opgehaalde resultaten per (geo-gebied, straal) zodat herhaalde en nabije
// zoekopdrachten vrijwel direct antwoorden — óók na een server-herstart.
//
// Eerlijkheidscontract:
// - Er wordt alleen teruggegeven wat écht van de bron kwam.
// - Na de TTL wordt de rij genegeerd en volgt een verse echte fetch.
// - Cache-fouten zijn nooit fataal: bij een DB-probleem valt alles terug op de
//   live bron (het gedrag van vóór deze cache).

import { eq, lt, sql } from "drizzle-orm";
import { db, climbCacheTable } from "@workspace/db";

// Langste TTL van de cache-consumenten (geocode: 30 dagen, klimmen: 3 dagen).
// Rijen ouder dan dit worden bij het lezen sowieso al genegeerd; de periodieke
// opruimstap verwijdert ze ook echt zodat de tabel niet eindeloos groeit.
export const CLIMB_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dagen

// Testschakelaar: hermetische unit-tests (gemockte fetch, geen DB-staat tussen
// runs) zetten CLIMB_CACHE_DISABLED=1 zodat elke run de gestubde bron raakt.
function cacheDisabled(): boolean {
  return process.env.CLIMB_CACHE_DISABLED === "1";
}

// Test-seam: hermetische unit-tests op het eerlijkheidscontract van de cache
// (TTL verlopen ⇒ negeren, DB-fout ⇒ nooit fataal) vervangen de echte DB door
// een stub. Productiecode raakt dit nooit aan; standaard is dit de echte db.
type CacheDb = Pick<typeof db, "select" | "insert">;
let cacheDb: CacheDb = db;
export function __setClimbCacheDbForTests(replacement: CacheDb | null): void {
  cacheDb = replacement ?? db;
}

export async function cacheGetDb<T>(
  key: string,
  ttlMs: number,
): Promise<T | null> {
  if (cacheDisabled()) return null;
  try {
    const [row] = await cacheDb
      .select({
        payload: climbCacheTable.payload,
        fetchedAt: climbCacheTable.fetchedAt,
      })
      .from(climbCacheTable)
      .where(eq(climbCacheTable.cacheKey, key));
    if (!row) return null;
    if (Date.now() - new Date(row.fetchedAt).getTime() > ttlMs) return null;
    return row.payload as T;
  } catch {
    // Cache mag nooit de echte bron blokkeren.
    return null;
  }
}

export async function cachePutDb(key: string, payload: unknown): Promise<void> {
  if (cacheDisabled()) return;
  try {
    await cacheDb
      .insert(climbCacheTable)
      .values({ cacheKey: key, payload })
      .onConflictDoUpdate({
        target: climbCacheTable.cacheKey,
        set: { payload, fetchedAt: sql`now()` },
      });
  } catch {
    // Best-effort: een mislukte cache-write verandert het antwoord niet.
  }
}

// Periodieke opruimstap: verwijdert rijen ouder dan de langste TTL. Idempotent
// (een tweede run direct erna verwijdert 0 rijen) en geeft alleen metadata
// terug — nooit cache-inhoud. Fouten zijn nooit fataal voor de aanroeper.
export async function cleanupClimbCacheDb(
  now: number = Date.now(),
): Promise<{ deleted: number }> {
  const cutoff = new Date(now - CLIMB_CACHE_MAX_AGE_MS);
  const rows = await db
    .delete(climbCacheTable)
    .where(lt(climbCacheTable.fetchedAt, cutoff))
    .returning({ id: climbCacheTable.id });
  return { deleted: rows.length };
}
