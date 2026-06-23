// Canonical Sparki sport taxonomy for the Data Hub.
//
// Every platform names sports differently ("Ride", "VirtualRide", "EBikeRide",
// "Run", "TrailRun", …). The hub maps all of them onto ONE internal set so an
// athlete's history is coherent regardless of which platforms it came from.
//
// NOTE: this is the *data* taxonomy (what the hub can normalise & store). It is
// deliberately separate from `lib/feature-flags` SPORTS, which gates which sport
// families are *active* in the product UI. Preparing a sport here (so its data
// can be ingested) does not activate its coaching engine — that stays phased.

export const HUB_SPORTS = [
  "cycling",
  "running",
  "triathlon",
  "mountainbike",
  "gravel",
  "hiking",
  "skating",
  "swimming",
  "team_sport",
] as const;
export type HubSport = (typeof HUB_SPORTS)[number];

export const HUB_SPORT_LABELS: Record<HubSport, string> = {
  cycling: "Wielrennen",
  running: "Hardlopen",
  triathlon: "Triatlon",
  mountainbike: "Mountainbike",
  gravel: "Gravel",
  hiking: "Wandelen",
  skating: "Schaatsen",
  swimming: "Zwemmen",
  team_sport: "Teamsport",
};

// Provider activity-type aliases → canonical hub sport. Keys are normalised
// (lowercased, separators stripped) before lookup.
const SPORT_ALIASES: Record<string, HubSport> = {
  // cycling
  ride: "cycling",
  virtualride: "cycling",
  ebikeride: "cycling",
  handcycle: "cycling",
  velomobile: "cycling",
  cycling: "cycling",
  road: "cycling",
  track: "cycling",
  indoorcycling: "cycling",
  // mountainbike / gravel split out (still cycling family, tracked distinctly)
  mountainbikeride: "mountainbike",
  mtb: "mountainbike",
  mountainbike: "mountainbike",
  mountain: "mountainbike",
  gravelride: "gravel",
  gravel: "gravel",
  // running
  run: "running",
  trailrun: "running",
  virtualrun: "running",
  running: "running",
  treadmill: "running",
  // triathlon / multisport
  triathlon: "triathlon",
  multisport: "triathlon",
  // hiking / walking
  hike: "hiking",
  walk: "hiking",
  walking: "hiking",
  hiking: "hiking",
  // skating
  iceskate: "skating",
  inlineskate: "skating",
  skating: "skating",
  speedskating: "skating",
  // swimming
  swim: "swimming",
  swimming: "swimming",
  openwaterswim: "swimming",
  // team sports
  soccer: "team_sport",
  football: "team_sport",
  hockey: "team_sport",
  basketball: "team_sport",
  volleyball: "team_sport",
  handball: "team_sport",
  rugby: "team_sport",
};

function aliasKey(raw: string): string {
  return raw.toLowerCase().replace(/[\s_-]/g, "");
}

/** Strict match: returns the canonical sport, or null when unrecognised. */
export function matchSport(raw: string | null | undefined): HubSport | null {
  if (!raw) return null;
  return SPORT_ALIASES[aliasKey(raw)] ?? null;
}

/**
 * Normalise a provider sport string to a canonical hub sport. Unknown values
 * fall back to "cycling" (Sparki's phase-1 default) — the original string is
 * always preserved in `connector_activities.raw`, so nothing is lost.
 */
export function normalizeSport(raw: string | null | undefined): HubSport {
  return matchSport(raw) ?? "cycling";
}

export function isHubSport(value: unknown): value is HubSport {
  return (
    typeof value === "string" && (HUB_SPORTS as readonly string[]).includes(value)
  );
}

// Legacy `training_sessions.type` synonym kept for backward compatibility with
// older consumers that read `type` (the `sport` column is authoritative).
export function legacyTypeForSport(sport: HubSport): string {
  switch (sport) {
    case "running":
      return "run";
    case "swimming":
      return "swim";
    case "hiking":
      return "hike";
    case "skating":
      return "skate";
    default:
      return "ride";
  }
}
