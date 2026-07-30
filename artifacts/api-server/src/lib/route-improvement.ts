// Verbeterlus voor de Sparki-routebibliotheek: een route die door echte
// gebruikers slecht beoordeeld wordt (gemiddeld < 3 bij ≥ 3 stemmen) wordt
// automatisch vervangen door een nieuwe, écht gegenereerde variant. De
// terugkerende opmerkingen uit het commentaar sturen daarbij de keuze tussen
// kandidaten (bijv. "druk verkeer" → kandidaat met minste stopobjecten).
//
// Eerlijkheid:
// - De beslissing draait uitsluitend op echte scores en echt commentaar —
//   nooit verzonnen data.
// - Een thema telt pas als "terugkerend" wanneer ≥ 2 verschillende gebruikers
//   het noemen; één losse opmerking stuurt de generatie niet.
// - De nieuwe variant komt integraal uit de echte routeprovider (ORS). Faalt
//   de generatie, dan blijft de oude route gewoon staan — nooit een lege of
//   verzonnen vervanger.
// - De oude rij blijft bestaan (commentaar-historie) met status "vervangen"
//   en een verwijzing naar de opvolger; de opvolger draagt een eerlijke
//   uitleg (improveNote) over wélke terugkerende feedback is meegenomen.

import { and, eq } from "drizzle-orm";
import {
  db,
  routeLibraryTable,
  routeLibraryCommentsTable,
  type LibraryBikeType,
  type RoutePathPoint,
} from "@workspace/db";
import {
  getRoutingProvider,
  generateVariedLoop,
  type RoutingProfile,
  type SceneryWish,
} from "./routing";
import { getRouteEnvironment } from "./route-insight";
import { routeObstaclesOf } from "./route-remarks";
import { controlUnpavedShare } from "./surface-control";
import { summarizeTrack } from "./gpx-parse";
import { seedFor } from "./route-library";
import { logger } from "./logger";

const log = logger.child({ module: "route-improvement" });

// Drempel: gemiddeld < 3 bij minstens 3 echte stemmen.
export const REPLACE_MAX_AVG = 3;
export const REPLACE_MIN_VOTES = 3;

export function shouldReplaceRoute(route: {
  status: string;
  avgRating: number | null;
  ratingCount: number;
}): boolean {
  return (
    route.status === "actief" &&
    route.avgRating != null &&
    route.avgRating < REPLACE_MAX_AVG &&
    route.ratingCount >= REPLACE_MIN_VOTES
  );
}

// ── Terugkerende opmerkingen → generatiethema's ────────────────────────────
// Deterministische, conservatieve trefwoordherkenning (Nederlands). Alleen
// thema's die de kandidaatkeuze ook écht kan sturen; wat we niet kunnen
// sturen (bijv. wegdek) claimen we ook niet.
export type FeedbackTheme =
  | "druk_verkeer" // druk / verkeer / stoplichten → minste stopobjecten
  | "saai" // saai / eentonig → meeste natuur
  | "te_vlak" // "te vlak" → heuvelachtiger kandidaat
  | "te_zwaar" // te steil / te veel klimmen → vlakkere kandidaat
  | "bochtig" // veel bochten / draaien → bochtenarm
  | "dubbel_spoor"; // zelfde weg twee keer / heen-en-terug → minste overlap

// NB: Nederlandse stammen matchen met \w* binnen \b-groepen (samenstellingen
// als "verkeerslichten", "drukke").
const THEME_PATTERNS: Record<FeedbackTheme, RegExp> = {
  druk_verkeer:
    /\b(druk\w*|verkeer\w*|stoplicht\w*|auto'?s|autoweg\w*|oversteek\w*)\b/i,
  saai: /\b(saai\w*|eentonig\w*|industrie\w*|bebouw\w*)\b/i,
  te_vlak: /\bte\s+vlak\b|\bvlak\s+en\s+saai\b/i,
  te_zwaar:
    /\b(te\s+(steil|zwaar|heuvelachtig)|te\s*veel\s+(klim\w*|hoogtemeter\w*))\b/i,
  bochtig: /\b(bocht\w*|zigzag\w*|draai\w*|kronkel\w*)\b/i,
  dubbel_spoor:
    /\b(zelfde\s+weg|twee\s+keer|dubbel\w*|heen\s+en\s+terug|terugweg\s+hetzelfde)\b/i,
};

// Thema's die uit echt commentaar terugkeren: genoemd door ≥ 2 verschillende
// gebruikers. Volgorde is vast (deterministisch).
export function extractRecurringThemes(
  comments: { clerkId: string; comment: string | null }[],
): FeedbackTheme[] {
  const users = new Map<FeedbackTheme, Set<string>>();
  for (const c of comments) {
    if (!c.comment) continue;
    for (const theme of Object.keys(THEME_PATTERNS) as FeedbackTheme[]) {
      if (THEME_PATTERNS[theme].test(c.comment)) {
        if (!users.has(theme)) users.set(theme, new Set());
        users.get(theme)!.add(c.clerkId);
      }
    }
  }
  return (Object.keys(THEME_PATTERNS) as FeedbackTheme[]).filter(
    (t) => (users.get(t)?.size ?? 0) >= 2,
  );
}

const THEME_NOTE: Record<FeedbackTheme, string> = {
  druk_verkeer: "minder druk verkeer en stopmomenten",
  saai: "meer natuur onderweg",
  te_vlak: "meer hoogtemeters",
  te_zwaar: "minder klimwerk",
  bochtig: "minder bochten",
  dubbel_spoor: "minder dezelfde weg twee keer",
};

// Eerlijke uitleg voor bij de opvolger — alleen op basis van échte
// terugkerende opmerkingen. Null als er geen terugkerend thema was.
export function buildImproveNote(themes: FeedbackTheme[]): string | null {
  if (themes.length === 0) return null;
  return `Vervangen na terugkerende feedback: gekozen op ${themes
    .map((t) => THEME_NOTE[t])
    .join(", ")}.`;
}

// Vertaal terugkerende thema's naar generatie-opties. Sturen kan alleen door
// méér echte kandidaten te vergelijken — nooit door geometrie te bewerken.
export function themeGenerationOptions(themes: FeedbackTheme[]): {
  elevationPreference: "flat" | "hilly" | "any";
  scenery: SceneryWish | null;
  preferUninterrupted: boolean;
  candidates: number;
} {
  const scenery: SceneryWish = {
    nature: themes.includes("saai"),
    avoidTrafficLights: themes.includes("druk_verkeer"),
  };
  return {
    // Bij tegenstrijdige feedback (zowel "te vlak" als "te zwaar") sturen we
    // niet — dan is er geen terugkerende richting.
    elevationPreference:
      themes.includes("te_vlak") && !themes.includes("te_zwaar")
        ? "hilly"
        : themes.includes("te_zwaar") && !themes.includes("te_vlak")
          ? "flat"
          : "any",
    scenery: scenery.nature || scenery.avoidTrafficLights ? scenery : null,
    preferUninterrupted: themes.includes("bochtig"),
    // Een vervanger verdient een ruime pool echte kandidaten; "dubbel spoor"
    // vraagt om nóg meer keuze op overlap.
    candidates: themes.includes("dubbel_spoor") ? 10 : 8,
  };
}

// Zelfde profielkeuze als de startset (route-library.ts).
function bikeProfile(bike: LibraryBikeType): RoutingProfile {
  if (bike === "racefiets") return "cycling-road";
  if (bike === "mtb") return "cycling-mountain";
  if (bike === "gravel") return "cycling-gravel";
  return "cycling-regular";
}

// Voorkomt dubbele vervanging binnen dit proces; de status-check in de
// transactie vangt de rest (bijv. twee instanties).
const inFlight = new Set<number>();

// Achtergrondstap na een nieuw commentaar: vervang de route als de echte
// scores daarom vragen. Blokkeert de aanroeper nooit; faalt stil-maar-gelogd
// (de oude route blijft dan gewoon staan — eerlijker dan een lege kaart).
export async function maybeReplacePoorRoute(routeId: number): Promise<
  | { replaced: true; newId: number; themes: FeedbackTheme[] }
  | { replaced: false; reason: string }
> {
  if (inFlight.has(routeId)) return { replaced: false, reason: "bezig" };
  inFlight.add(routeId);
  try {
    return await replacePoorRoute(routeId);
  } finally {
    inFlight.delete(routeId);
  }
}

async function replacePoorRoute(routeId: number): Promise<
  | { replaced: true; newId: number; themes: FeedbackTheme[] }
  | { replaced: false; reason: string }
> {
  const [route] = await db
    .select()
    .from(routeLibraryTable)
    .where(eq(routeLibraryTable.id, routeId))
    .limit(1);
  if (!route) return { replaced: false, reason: "niet gevonden" };
  if (!shouldReplaceRoute(route)) {
    return { replaced: false, reason: "drempel niet gehaald" };
  }

  const provider = getRoutingProvider();
  if (!provider || !provider.isConfigured()) {
    log.warn({ routeId }, "geen routeprovider — vervanging overgeslagen");
    return { replaced: false, reason: "geen provider" };
  }

  // Echt commentaar van deze route → terugkerende thema's.
  const comments = await db
    .select({
      clerkId: routeLibraryCommentsTable.clerkId,
      comment: routeLibraryCommentsTable.comment,
    })
    .from(routeLibraryCommentsTable)
    .where(eq(routeLibraryCommentsTable.libraryRouteId, routeId));
  const themes = extractRecurringThemes(comments);
  const opts = themeGenerationOptions(themes);

  const bike = route.bikeType as LibraryBikeType;
  const nextGen = route.generation + 1;
  // Nieuwe deterministische seed, ruim weg van de vorige generatie zodat de
  // variant echt anders is (zelfde priemstap-gedachte als loop-quality).
  const baseSeed = route.seed ?? seedFor(route.cellKey, bike, route.targetKm);
  const seed = (baseSeed + nextGen * 104729) % 1_000_000;

  let result;
  try {
    result = await generateVariedLoop(
      provider,
      {
        start: { lat: route.startLat, lon: route.startLon },
        distanceKm: route.targetKm,
        profile: bikeProfile(bike),
        seed,
        elevationPreference: opts.elevationPreference,
      },
      {
        candidates: opts.candidates,
        scenery: opts.scenery,
        environmentOf: opts.scenery ? getRouteEnvironment : undefined,
        preferUninterrupted: opts.preferUninterrupted,
        // Officiële-kaart-controlelaag (BGT alleen Nederland, GRB alleen Vlaanderen): racefietsvarianten die volgens
        // de overheidswegenkaart onverhard blijken, verliezen.
        unpavedShareOf: controlUnpavedShare,
        // Obstakel-poort: trap/fietsverbod/afgesloten poort = harde afkeur;
        // minste poorten wint (grenzen René 30-07-2026).
        obstaclesOf: routeObstaclesOf(),
      },
    );
  } catch (err) {
    log.warn({ err, routeId }, "vervangende generatie faalde — route blijft");
    return { replaced: false, reason: "generatie faalde" };
  }
  if (!result.path || result.path.length < 2) {
    return { replaced: false, reason: "generatie faalde" };
  }

  const stats = summarizeTrack(result.points);
  // Gedrempelde hoogtemeters uit het spoor gaan vóór rauwe provider-ascend
  // (die telt SRTM-ruis mee als valse hoogtemeters, taak #429).
  const ascent = stats?.elevationGainM ?? result.ascentM ?? null;
  const km =
    result.distanceKm != null ? Math.round(result.distanceKm) : route.targetKm;
  const improveNote = buildImproveNote(themes);

  // Atomair: opvolger invoegen + oude route markeren. De status-guard in de
  // UPDATE voorkomt dubbele vervanging over instanties heen — verandert er
  // niets (al vervangen), dan rollen we de nieuwe rij terug.
  const newId = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(routeLibraryTable)
      .values({
        cellKey: route.cellKey,
        name: route.name.replace(/ · v\d+$/, "") + ` · v${nextGen}`,
        bikeType: bike,
        targetKm: route.targetKm,
        startLat: route.startLat,
        startLon: route.startLon,
        distanceKm: result.distanceKm,
        elevationGainM: ascent,
        durationSec: result.durationSec,
        geometry: result.path as RoutePathPoint[],
        seed,
        source: "sparki_verbeterd",
        generation: nextGen,
        improveNote,
      })
      .onConflictDoNothing()
      .returning({ id: routeLibraryTable.id });
    if (!inserted) return null; // opvolger bestond al (andere instantie)
    const updated = await tx
      .update(routeLibraryTable)
      .set({
        status: "vervangen",
        replacedById: inserted.id,
        replacedAt: new Date(),
      })
      .where(
        and(
          eq(routeLibraryTable.id, routeId),
          eq(routeLibraryTable.status, "actief"),
        ),
      )
      .returning({ id: routeLibraryTable.id });
    if (updated.length === 0) {
      // Al vervangen door een ander proces — geen tweede opvolger laten staan.
      throw new ReplacedElsewhere();
    }
    return inserted.id;
  }).catch((err) => {
    if (err instanceof ReplacedElsewhere) return null;
    throw err;
  });

  if (newId == null) return { replaced: false, reason: "al vervangen" };
  log.info(
    { routeId, newId, themes, generation: nextGen },
    "slecht beoordeelde route vervangen door nieuwe variant",
  );
  return { replaced: true, newId, themes };
}

class ReplacedElsewhere extends Error {
  constructor() {
    super("route werd elders al vervangen");
  }
}
