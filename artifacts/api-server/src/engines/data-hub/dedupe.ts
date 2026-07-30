import type { HubSport } from "./sports";

// Cross-source de-duplication.
//
// When Dylan has Garmin + Strava + TrainingPeaks all connected, the SAME ride
// arrives three times — but each platform reports it slightly differently:
// start times drift by a minute or two, duration and distance disagree by a
// few percent (GPS smoothing, auto-pause, rounding). A fingerprint that hard-
// rounds duration/distance into the key shatters on those differences and fails
// to merge real duplicates.
//
// So the key is deliberately coarse and built ONLY from the things every source
// agrees on: sport + start time bucketed to 5 minutes. To survive a start time
// straddling a bucket boundary (07:04 vs 07:06), matching also checks the
// neighbouring buckets. A distance/duration *tolerance guard* then prevents two
// genuinely different activities that merely started close together from merging.

const START_BUCKET_MS = 5 * 60 * 1000; // 5 min

function startBucket(startedAt: string): number | null {
  const t = new Date(startedAt).getTime();
  return Number.isNaN(t) ? null : Math.floor(t / START_BUCKET_MS);
}

export interface DedupeInput {
  sport: HubSport;
  startedAt: string;
  durationMin?: number | null;
  distanceKm?: number | null;
}

/** Canonical fingerprint for an activity: sport + 5-min start bucket. */
export function computeActivityDedupeKey(input: DedupeInput): string {
  const b = startBucket(input.startedAt);
  return `${input.sport}|${b ?? "x"}`;
}

/**
 * Keys to search when looking for an existing canonical session for this
 * activity: the activity's own bucket plus the two neighbours, so a start time
 * sitting near a bucket edge still finds its duplicate.
 */
export function candidateDedupeKeys(input: DedupeInput): string[] {
  const b = startBucket(input.startedAt);
  if (b === null) return [`${input.sport}|x`];
  return [
    `${input.sport}|${b - 1}`,
    `${input.sport}|${b}`,
    `${input.sport}|${b + 1}`,
  ];
}

/**
 * Tolerance guard: are these plausibly the SAME real activity? Used after a
 * coarse key match to reject false merges (e.g. a 48 km ride vs a 5 km ride that
 * happened to start in the same 5-min window). Only compares fields both sides
 * actually have; missing data never blocks a merge.
 */
export function activitiesPlausiblyEqual(
  existing: { durationMin?: number | null; distanceKm?: number | string | null },
  incoming: { durationMin?: number | null; distanceKm?: number | null },
): boolean {
  const ed =
    existing.distanceKm != null && existing.distanceKm !== ""
      ? Number(existing.distanceKm)
      : null;
  const idist = incoming.distanceKm ?? null;
  if (ed != null && idist != null && !Number.isNaN(ed)) {
    if (Math.abs(ed - idist) > Math.max(2, ed * 0.2)) return false;
  }
  const edur = existing.durationMin ?? null;
  const idur = incoming.durationMin ?? null;
  if (edur != null && idur != null) {
    if (Math.abs(edur - idur) > Math.max(10, edur * 0.2)) return false;
  }
  return true;
}

// Fields that can be merged from a duplicate into an existing session.
const MERGEABLE_FIELDS = [
  "durationMin",
  "distanceKm",
  "elevationM",
  "normalizedPower",
  "avgPower",
  "avgHR",
  "maxHR",
  "avgCadence",
  "powerBests",
  "avgSpeedKph",
  "tss",
  "intensityFactor",
  "title",
  "notes",
] as const;

/**
 * Build a patch that fills gaps in `existing` from `incoming`. Existing non-null
 * values win (the first source to provide a field keeps it); incoming only fills
 * what's missing. Returns an empty object when there's nothing to add.
 *
 * Handmatige correcties zijn heilig: velden in `manualFields` worden NOOIT
 * gevuld of overschreven door een merge — ook niet wanneer de sporter het veld
 * bewust heeft leeggemaakt (null).
 *
 * `refreshFields` (optioneel): velden die EERDER door dezélfde bron zijn
 * geleverd. Wanneer die bron een gewijzigde waarde meldt (bijv. een op Strava
 * aangepaste titel of gecorrigeerde afstand), mag haar eigen waarde worden
 * ververst. Waarden van ándere bronnen of handmatige correcties blijven
 * onaangeroerd — eerste-bron-wint blijft gelden tussen bronnen.
 */
export function buildMergePatch(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  manualFields?: string[] | null,
  refreshFields?: Set<string> | null,
): Record<string, unknown> {
  const manual = new Set(manualFields ?? []);
  const patch: Record<string, unknown> = {};
  for (const f of MERGEABLE_FIELDS) {
    if (manual.has(f)) continue;
    const have = existing[f];
    const next = incoming[f];
    if (next === null || next === undefined) continue;
    if (have === null || have === undefined) {
      patch[f] = next;
    } else if (refreshFields?.has(f) && next !== have) {
      // Zelfde bron leverde dit veld eerder — haar update mag doorwerken.
      patch[f] = next;
    }
  }
  return patch;
}

/**
 * Per-veld herkomst bijwerken: registreer `provider` als bron voor ieder veld
 * dat in deze schrijfactie een echte waarde kreeg. Bestaande herkomst blijft
 * staan (de eerste bron die een veld leverde, houdt het).
 */
export function updateFieldSources(
  existing: Record<string, string> | null | undefined,
  written: Record<string, unknown>,
  provider: string,
): Record<string, string> {
  const out: Record<string, string> = { ...(existing ?? {}) };
  for (const f of MERGEABLE_FIELDS) {
    if (f in written && written[f] !== null && written[f] !== undefined && !out[f]) {
      out[f] = provider;
    }
  }
  return out;
}

export function mergeSources(existing: string[] | null, provider: string): string[] {
  const set = new Set(existing ?? []);
  set.add(provider);
  return [...set];
}

// ── Intern samenvoeg-/conflictlogboek ────────────────────────────────────────

export interface MergeLogEntry {
  at: string;
  source: string;
  sources: string[];
  differences: {
    field: string;
    kept: string | number | null;
    offered: string | number | null;
    keptSource: string;
  }[];
  reason: string;
}

// Bewaar maximaal zoveel samenvoegregels per sessie (oudste vervalt eerst).
export const MERGE_LOG_MAX = 20;

function loggableValue(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "string") return v;
  return JSON.stringify(v).slice(0, 200);
}

/**
 * Bouw één regel voor het interne conflictlogboek van een samenvoeging:
 * welke bron erbij kwam, welke velden verschilden (behouden vs aangeboden)
 * en waarom de behouden waarde won. `patch` bevat de velden die deze bron
 * WEL mocht schrijven; alles wat verschilt maar niet in de patch zit is een
 * echt conflict waar de bestaande waarde won.
 */
export function buildMergeLogEntry(
  existing: Record<string, unknown> & {
    fieldSources?: Record<string, string> | null;
    manualFields?: string[] | null;
  },
  incoming: Record<string, unknown>,
  patch: Record<string, unknown>,
  provider: string,
  sourcesAfter: string[],
  now: Date = new Date(),
): MergeLogEntry {
  const manual = new Set(existing.manualFields ?? []);
  const fieldSources = existing.fieldSources ?? {};
  const differences: MergeLogEntry["differences"] = [];
  let manualHit = false;
  for (const f of MERGEABLE_FIELDS) {
    const offered = incoming[f];
    if (offered === null || offered === undefined) continue;
    if (f in patch) continue; // deze bron mocht schrijven — geen conflict
    const kept = existing[f];
    if (kept === null || kept === undefined) {
      // niet geschreven én niets behouden ⇒ handmatig leeggemaakt veld
      if (manual.has(f)) {
        manualHit = true;
        differences.push({
          field: f,
          kept: null,
          offered: loggableValue(offered),
          keptSource: "handmatig",
        });
      }
      continue;
    }
    // Vergelijk als string zodat numeric-kolommen ("42.00" vs 42) eerlijk matchen.
    if (String(kept) === String(offered)) continue;
    if (manual.has(f)) manualHit = true;
    differences.push({
      field: f,
      kept: loggableValue(kept),
      offered: loggableValue(offered),
      keptSource: manual.has(f) ? "handmatig" : (fieldSources[f] ?? "onbekend"),
    });
  }
  const refreshed = Object.keys(patch).some(
    (f) => existing[f] !== null && existing[f] !== undefined,
  );
  const reason = manualHit
    ? "handmatige correcties zijn heilig; overige velden: eerste bron wint"
    : refreshed
      ? "eigen eerder geleverde velden ververst; overige velden: eerste bron wint"
      : "eerste bron wint; latere bronnen vullen alleen ontbrekende velden aan";
  return {
    at: now.toISOString(),
    source: provider,
    sources: sourcesAfter,
    differences,
    reason,
  };
}

// ── Bronconflicten voor de rit-detailweergave ────────────────────────────────
//
// Kalibratie (30-07-2026): wanneer twee bronnen voor hetzelfde veld andere
// getallen geven (bv. Strava 250 W vs bestand 243 W) kiest Sparki stil de
// behouden waarde, maar het verschil moet bij de rit terug te vinden zijn.
// Deze afleiding vat het interne mergeLog samen tot één regel per veld:
// welke waarde behouden is (en van welke bron), en welke waarde een andere
// bron aanbood. Bij meerdere merges per veld wint de recentste constatering.

export interface SourceConflict {
  field: string;
  chosen: string | number | null;
  chosenSource: string;
  offered: string | number | null;
  offeredSource: string;
  at: string;
}

export function deriveSourceConflicts(
  log: MergeLogEntry[] | null | undefined,
): SourceConflict[] {
  const byField = new Map<string, SourceConflict>();
  for (const entry of log ?? []) {
    if (!entry || !Array.isArray(entry.differences)) continue;
    for (const d of entry.differences) {
      if (!d || typeof d.field !== "string") continue;
      // Een bron die haar éígen eerdere waarde aanbood is geen conflict
      // tussen bronnen; die zit al niet in differences (zie buildMergeLogEntry).
      byField.set(d.field, {
        field: d.field,
        chosen: d.kept ?? null,
        chosenSource: d.keptSource,
        offered: d.offered ?? null,
        offeredSource: entry.source,
        at: entry.at,
      });
    }
  }
  return [...byField.values()];
}

/** Voeg een regel toe aan het logboek, begrensd tot MERGE_LOG_MAX regels. */
export function appendMergeLog(
  existing: MergeLogEntry[] | null | undefined,
  entry: MergeLogEntry,
): MergeLogEntry[] {
  const log = [...(existing ?? []), entry];
  return log.slice(-MERGE_LOG_MAX);
}
