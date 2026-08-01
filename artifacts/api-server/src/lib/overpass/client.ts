// ── Gedeelde Overpass-client (ROUTE_OVERPASS_STABILITEIT_01) ────────────────
//
// Eén ingang voor alle Overpass-verkeer in de routeketen. Doel: René plant
// een route op productie en krijgt hem elke keer — zonder dat een burst van
// zware queries de mirrors in rate-limiting jaagt en de fail-closed
// blokkadepoort terecht (maar onnodig) omvalt.
//
// De fail-closed regel (taak #505) blijft onaangetast: een query die na alle
// beleefde pogingen geen antwoord heeft, is en blijft `null` — een eerlijk
// gat, nooit "geen blokkades gevonden".
//
// Wat deze client centraal regelt:
//  1. SERIEEL — nooit twee Overpass-aanvragen tegelijk vanuit dit proces, met
//     een minimum-tussenpauze (mirrors rate-limiten juist de opeenvolging).
//  2. Herkansing MET OPLOPENDE PAUZE op dezelfde mirror bij 429/timeout,
//     niet meteen doorschuiven naar de volgende mirror.
//  3. Mirrorvolgorde op gemeten prestatie: maps.mail.ru eerst (aantoonbaar
//     werkend vanaf productie); een mirror die faalt krijgt een cooldown en
//     schuift tijdelijk achteraan.
//  4. Persistente cache in Postgres: wegdata verandert nauwelijks, dus een
//     eerder antwoord op exact dezelfde (genormaliseerde) vraag wordt
//     hergebruikt over sessies en deploys heen.
//  5. Aanvraagbudget per routegeneratie (AsyncLocalStorage): op = op, de
//     generatie stopt dan met een eerlijke melding via de bestaande
//     fail-closed paden — nooit tientallen extra pogingen.
//  6. Meting: per generatie aantallen aanvragen, cache-treffers,
//     herkansingen en per-mirror-uitkomsten.

import { createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../logger";

export type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: ({ lat: number; lon: number } | null)[];
  nodes?: number[];
  tags?: Record<string, string>;
};

export type OverpassAnswer = {
  elements: OverpassElement[];
  remark: string | null;
};

// ── Mirrors + gezondheidsstaat ──────────────────────────────────────────────
// Volgorde = gemeten prestatie vanaf productie (netwerkprobe 01-08-2026):
// maps.mail.ru 200/3,4s · overpass-api.de 504 · kumi geen antwoord in 20s.
const MIRRORS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

// Een falende mirror gaat deze periode achteraan in plaats van elke aanvraag
// opnieuw de rij op te houden. Kort genoeg om herstel snel op te merken.
const MIRROR_COOLDOWN_MS = 90_000;
const cooldownUntil = new Map<string, number>();

/** Mirrors in probeer-volgorde: gezonde eerst (vaste volgorde), koelende achteraan. */
export function orderedMirrors(now = Date.now()): string[] {
  const healthy: string[] = [];
  const cooling: string[] = [];
  for (const m of MIRRORS) {
    if ((cooldownUntil.get(m) ?? 0) > now) cooling.push(m);
    else healthy.push(m);
  }
  return [...healthy, ...cooling];
}

// ── Seriële uitvoering ──────────────────────────────────────────────────────
// Eén keten voor het hele proces: aanvragen wachten netjes op elkaar, met een
// minimumtussenruimte. Dit dooft de burst die de rate-limits veroorzaakte.
const MIN_GAP_MS = 700;
let chain: Promise<void> = Promise.resolve();
let lastRequestAt = 0;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      lastRequestAt = Date.now();
    }
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// ── Budget + meting per routegeneratie ──────────────────────────────────────
export type OverpassStats = {
  requests: number; // netwerk-aanvragen (excl. cache-treffers)
  cacheHits: number;
  retries: number; // extra pogingen bovenop de eerste per query
  budgetDenied: number; // aanvragen geweigerd omdat het budget op was
  perMirror: Record<string, { ok: number; fail: number }>;
  startedAt: number;
};

type BudgetContext = { max: number; stats: OverpassStats };
const budgetStore = new AsyncLocalStorage<BudgetContext>();

// Budget-onderbouwing: een normale generatie gebruikt <20 Overpass-aanvragen
// (obstakelmeting winnaar + omgeving + wegdek). Het zwaarste eerlijke geval —
// meerdere kandidaten die stuk voor stuk hard geblokkeerd doorschuiven, plus
// een kwadrant-splitsing in een dichte stadskern (4 kwadranten × diepte) —
// blijft onder de 60. Alles daarboven is pathologisch herhalen dat de mirrors
// alleen maar verder dichtzet; dan stoppen we eerlijk.
export const OVERPASS_BUDGET_PER_GENERATION = 60;

export async function withOverpassBudget<T>(
  fn: () => Promise<T>,
  max = OVERPASS_BUDGET_PER_GENERATION,
): Promise<{ result: T; stats: OverpassStats }> {
  const ctx: BudgetContext = {
    max,
    stats: {
      requests: 0,
      cacheHits: 0,
      retries: 0,
      budgetDenied: 0,
      perMirror: {},
      startedAt: Date.now(),
    },
  };
  const result = await budgetStore.run(ctx, fn);
  return { result, stats: ctx.stats };
}

function stats(): OverpassStats | null {
  return budgetStore.getStore()?.stats ?? null;
}

// ── Persistente cache ───────────────────────────────────────────────────────
// Wegdata verandert langzaam; 14 dagen is ruim vers genoeg voor wegdek en
// obstakels en scheelt op productie vrijwel alle herhaalvragen. De sleutel is
// de hash van de volledige query — wie treffers wil voor licht verschoven
// bboxes normaliseert de bbox vóór het bouwen van de query (normalizeBbox).
export const OVERPASS_CACHE_TTL_MS = 14 * 24 * 60 * 60_000;

// Kleine in-memory laag bovenop de DB-cache (zelfde levensduur als het
// proces) — spaart de DB-roundtrip bij herhaalde vragen binnen één sessie.
const MEM_CACHE = new Map<string, { at: number; answer: OverpassAnswer }>();
const MEM_CACHE_MAX = 200;

function queryKey(query: string): string {
  return createHash("sha256").update(query).digest("hex");
}

async function cacheRead(
  key: string,
  ttlMs: number,
): Promise<OverpassAnswer | null> {
  const mem = MEM_CACHE.get(key);
  if (mem && Date.now() - mem.at < ttlMs) return mem.answer;
  try {
    const res = await db.execute(
      sql`SELECT payload, fetched_at FROM overpass_query_cache WHERE cache_key = ${key}`,
    );
    const row = res.rows[0] as
      | { payload: OverpassAnswer; fetched_at: string | Date }
      | undefined;
    if (!row) return null;
    const at = new Date(row.fetched_at).getTime();
    if (Number.isNaN(at) || Date.now() - at >= ttlMs) return null;
    const payload = row.payload;
    if (!payload || !Array.isArray(payload.elements)) return null;
    return { elements: payload.elements, remark: payload.remark ?? null };
  } catch (err) {
    // Cachestoring mag een meting nooit blokkeren — gewoon vers ophalen.
    logger.warn({ err }, "overpass cache read faalde — vers ophalen");
    return null;
  }
}

async function cacheWrite(key: string, answer: OverpassAnswer): Promise<void> {
  MEM_CACHE.set(key, { at: Date.now(), answer });
  if (MEM_CACHE.size > MEM_CACHE_MAX) {
    const first = MEM_CACHE.keys().next().value;
    if (first) MEM_CACHE.delete(first);
  }
  try {
    await db.execute(
      sql`INSERT INTO overpass_query_cache (cache_key, payload, fetched_at)
          VALUES (${key}, ${JSON.stringify(answer)}::jsonb, now())
          ON CONFLICT (cache_key)
          DO UPDATE SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at`,
    );
  } catch (err) {
    logger.warn({ err }, "overpass cache write faalde — antwoord blijft geldig");
  }
}

// ── Bbox-normalisatie ───────────────────────────────────────────────────────
// Snap een bbox NAAR BUITEN op een vast raster, zodat licht verschoven vragen
// dezelfde (iets ruimere) gebiedsvraag — en dus dezelfde cache-treffer —
// opleveren. Naar buiten snappen is veilig: het antwoord is een superset en
// alle consumenten filteren zelf op hun eigen geometrie.
export const BBOX_GRID_DEG = 0.005; // ~550 m — ruim binnen de bestaande padding-orde
export function normalizeBbox(
  minLat: number,
  minLon: number,
  maxLat: number,
  maxLon: number,
  grid = BBOX_GRID_DEG,
): [number, number, number, number] {
  const down = (v: number) => Math.floor(v / grid) * grid;
  const up = (v: number) => Math.ceil(v / grid) * grid;
  const r = (v: number) => Math.round(v * 1e6) / 1e6;
  return [r(down(minLat)), r(down(minLon)), r(up(maxLat)), r(up(maxLon))];
}

// ── Netwerklaag ─────────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = 25_000;
// Oplopende pauzes op DEZELFDE mirror bij 429/timeout (opdracht 2.1): eerst
// kort wachten en herkansen, pas daarna doorschuiven naar de volgende mirror.
const SAME_MIRROR_PAUSES_MS = [2_000, 5_000];

type AttemptOutcome =
  | { kind: "ok"; answer: OverpassAnswer }
  | { kind: "ratelimit" } // 429/504/timeout — herkansbaar op dezelfde mirror
  | { kind: "hard" }; // overige fouten — meteen volgende mirror

async function attempt(
  endpoint: string,
  query: string,
  timeoutMs: number,
): Promise<AttemptOutcome> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Sparki/1.0 (cycling training app)",
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 429 || res.status === 504 || res.status === 503) {
      return { kind: "ratelimit" };
    }
    if (!res.ok) return { kind: "hard" };
    const json = (await res.json()) as {
      elements?: OverpassElement[];
      remark?: string;
    };
    if (!Array.isArray(json.elements)) return { kind: "hard" };
    return {
      kind: "ok",
      answer: { elements: json.elements, remark: json.remark ?? null },
    };
  } catch {
    // AbortError (timeout) of netwerkfout: behandelen als herkansbaar —
    // precies het intermitterende gedrag dat we eerder zagen.
    return { kind: "ratelimit" };
  }
}

export type RunOverpassOptions = {
  timeoutMs?: number;
  /** Persistente cache gebruiken (default true). */
  cache?: boolean;
  cacheTtlMs?: number;
};

/**
 * Voer één Overpass-query uit: cache → serieel netwerk met beleefde
 * herkansing en mirror-gezondheid. `null` = eerlijk gat (alle mirrors op,
 * of het aanvraagbudget van deze generatie is bereikt).
 */
export async function runOverpassQuery(
  query: string,
  opts: RunOverpassOptions = {},
): Promise<OverpassAnswer | null> {
  const useCache = opts.cache !== false;
  const ttl = opts.cacheTtlMs ?? OVERPASS_CACHE_TTL_MS;
  const key = queryKey(query);

  if (useCache) {
    const hit = await cacheRead(key, ttl);
    if (hit) {
      const s = stats();
      if (s) s.cacheHits++;
      return hit;
    }
  }

  // Budgetcontrole (alleen binnen een generatiecontext): op = op — eerlijk
  // gat, de bestaande fail-closed paden maken daar de juiste melding van.
  const ctx = budgetStore.getStore();
  if (ctx && ctx.stats.requests >= ctx.max) {
    ctx.stats.budgetDenied++;
    logger.warn(
      { max: ctx.max },
      "overpass aanvraagbudget van deze routegeneratie bereikt — eerlijk gat",
    );
    return null;
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const answer = await serialize(async () => {
    for (const endpoint of orderedMirrors()) {
      // Eerste poging + oplopende herkansingen op dezelfde mirror.
      for (let i = 0; i <= SAME_MIRROR_PAUSES_MS.length; i++) {
        const s = stats();
        if (s) {
          if (s.requests >= (ctx?.max ?? Infinity)) {
            s.budgetDenied++;
            return null;
          }
          s.requests++;
          if (i > 0) s.retries++;
          s.perMirror[endpoint] ??= { ok: 0, fail: 0 };
        }
        const out = await attempt(endpoint, query, timeoutMs);
        if (out.kind === "ok") {
          if (s) s.perMirror[endpoint]!.ok++;
          return out.answer;
        }
        if (s) s.perMirror[endpoint]!.fail++;
        if (out.kind === "hard") break; // deze mirror is stuk voor deze query
        const pause = SAME_MIRROR_PAUSES_MS[i];
        if (pause == null) break; // herkansingen op deze mirror op
        await sleep(pause);
      }
      // Mirror faalde ondanks herkansing: tijdelijk achteraan.
      cooldownUntil.set(endpoint, Date.now() + MIRROR_COOLDOWN_MS);
    }
    return null;
  });

  if (answer && useCache) await cacheWrite(key, answer);
  return answer;
}
