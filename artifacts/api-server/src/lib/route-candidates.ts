import { randomUUID } from "node:crypto";
import type { RouteEngineSurface } from "@workspace/db";
import type { RouteStep } from "./routing";

// Server-trusted generated route candidate. Saving a generated route must NEVER
// trust client-supplied geometry/distance/duration/elevation/nav — the data
// honesty guarantee (everything comes from the routing provider, nothing
// fabricated) is enforced here: /generate stores the real provider result and
// hands back an opaque id; /routes saves ONLY from this store, by id. A forged
// `source:"generated"` POST therefore cannot persist fake metrics.
export type StoredCandidate = {
  clerkId: string;
  name: string;
  surface: string;
  distanceKm: number | null;
  durationSec: number | null;
  elevationGainM: number | null;
  profile: number[];
  climbs: unknown[];
  nav: RouteStep[];
  geometry: [number, number][];
  // User-placed shaping points for interactive (waypoints-mode) routes. Empty
  // for loop/ptp candidates. The geometry above is still the real provider path.
  waypoints: [number, number][];
  rationale: string;
  plannedWorkoutId: number | null;
  // Wegdekmeting van de routemotor zélf (GraphHopper surface-details) op het
  // moment van genereren; null als de motor geen wegdek-details levert (ORS).
  // Bewaard zodat het routescherm motor- en kaartmeting eerlijk naast elkaar
  // kan leggen — bij tegenspraak wordt uitgelegd, nooit stil één bron gekozen.
  engineSurface: RouteEngineSurface | null;
  // Sportfamilie waarvoor deze kandidaat is gegenereerd ("cycling" |
  // "walking" | "hiking") — server-side vastgelegd bij generatie zodat de
  // opgeslagen route nooit een client-gegokte sport krijgt.
  sport: string | null;
  createdAt: number;
  // Gezet zodra dit voorstel als route is opgeslagen (aanvulling 02a):
  // latere exports van het voorstel tellen dan onder de route-identiteit,
  // zodat kandidaat- en route-telling nooit naast elkaar bestaan.
  savedRouteId?: number | null;
};

const TTL_MS = 30 * 60 * 1000; // candidates are ephemeral proposals (30 min)
const MAX_ENTRIES = 500;
const store = new Map<string, StoredCandidate>();

function evict(): void {
  const now = Date.now();
  for (const [id, c] of store) {
    if (now - c.createdAt > TTL_MS) store.delete(id);
  }
  if (store.size > MAX_ENTRIES) {
    const oldestFirst = [...store.entries()].sort(
      (a, b) => a[1].createdAt - b[1].createdAt,
    );
    const overflow = store.size - MAX_ENTRIES;
    for (let i = 0; i < overflow; i++) store.delete(oldestFirst[i]![0]);
  }
}

// Store a trusted candidate and return its opaque id.
export function putCandidate(
  candidate: Omit<StoredCandidate, "createdAt">,
): string {
  evict();
  const id = randomUUID();
  store.set(id, { ...candidate, createdAt: Date.now() });
  return id;
}

// Update the rationale of a stored candidate once the async AI-enrichment
// finishes. No-op when the candidate has already expired.
export function updateCandidateRationale(
  id: string,
  clerkId: string,
  rationale: string,
): void {
  const c = store.get(id);
  if (!c || c.clerkId !== clerkId) return;
  if (Date.now() - c.createdAt > TTL_MS) {
    store.delete(id);
    return;
  }
  store.set(id, { ...c, rationale });
}

// Markeer een kandidaat als opgeslagen (owner-gescoped). No-op wanneer de
// kandidaat al verlopen is.
export function markCandidateSaved(
  id: string,
  clerkId: string,
  routeId: number,
): void {
  const c = store.get(id);
  if (!c || c.clerkId !== clerkId) return;
  store.set(id, { ...c, savedRouteId: routeId });
}

// Look up a candidate by id, scoped to its owner. Returns null when missing,
// expired, or owned by someone else. Does NOT delete (save may be retried).
export function getCandidate(
  id: string,
  clerkId: string,
): StoredCandidate | null {
  evict();
  const c = store.get(id);
  if (!c || c.clerkId !== clerkId) return null;
  if (Date.now() - c.createdAt > TTL_MS) {
    store.delete(id);
    return null;
  }
  return c;
}
