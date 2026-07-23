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
