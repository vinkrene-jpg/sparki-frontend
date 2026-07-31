// Race Intelligence — parcoursanalyse (Golf 16).
//
// Analyseert het parcours van een wedstrijd uit ECHTE bronnen: de aan de
// wedstrijd gekoppelde route (races.route_id → routes: afstand, hoogtemeters,
// hoogteprofiel, gedetecteerde beklimmingen, ondergrond, geschatte duur) plus de
// door de renner/gids ingevulde wedstrijdvelden (afstand, hoogtemeters,
// technische delen, parcoursomschrijving). Elke uitspraak draagt een soort:
//   • "feit"        — rechtstreeks uit een echte bron (wedstrijdrecord of route)
//   • "afgeleid"    — transparante rekensom over echte data (confidence < 1.0)
//   • "inschatting" — voorzichtige duiding waar geen harde data voor bestaat
//   • "ontbreekt"   — eerlijk gat, met één gerichte vervolgstap
// Niets wordt verzonnen: geen route en geen gidsdata ⇒ eerlijke gaten.

import { and, eq } from "drizzle-orm";
import {
  db,
  routesTable,
  type Race,
  type RouteClimb,
} from "@workspace/db";

export type CourseFactKind = "feit" | "afgeleid" | "inschatting" | "ontbreekt";

export type CourseFact = {
  key: string;
  label: string;
  kind: CourseFactKind;
  value: string | null;
  /** Herkomst — "wedstrijd", "route", "afgeleid uit route", … */
  origin: string;
  explanation?: string;
  confidence?: number;
  /** Alleen bij "ontbreekt": één gerichte vervolgstap. */
  question?: string;
};

export type CourseRouteSummary = {
  id: number;
  name: string;
  distanceKm: number | null;
  elevationGainM: number | null;
  surface: string;
  climbs: RouteClimb[];
  hasProfile: boolean;
};

export type RaceCourseAnalysis = {
  raceId: number;
  hasRoute: boolean;
  route: CourseRouteSummary | null;
  facts: CourseFact[];
  /** Eén eerlijke Nederlandse karakterisering van het parcours. */
  character: string;
  gaps: { key: string; label: string; question: string }[];
};

// ── Kleine helpers ───────────────────────────────────────────────────────────
function fmtKm(km: number): string {
  return `${Math.round(km * 10) / 10} km`;
}
function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h <= 0 ? `${m} min` : `${h}u${String(m).padStart(2, "0")}`;
}

const SURFACE_LABEL: Record<string, string> = {
  asfalt: "asfalt",
  gravel: "gravel",
  mtb: "onverhard (mtb)",
  mixed: "gemengd (deels onverhard)",
  pad: "paden",
};

// ── Pure composer ────────────────────────────────────────────────────────────
export function composeCourseAnalysis(
  race: Race,
  route: (typeof routesTable.$inferSelect) | null,
): RaceCourseAnalysis {
  const facts: CourseFact[] = [];
  const F = (f: CourseFact) => facts.push(f);

  const routeClimbs: RouteClimb[] = Array.isArray(route?.climbs)
    ? (route!.climbs as RouteClimb[])
    : [];
  const routeKm = route?.distanceKm ?? null;
  const routeElev = route?.elevationGainM ?? null;

  // Afstand — wedstrijdveld is leidend (feit), anders afgeleid uit de route.
  const raceKm = race.distanceKm != null ? Number(race.distanceKm) : null;
  const km = raceKm ?? routeKm;
  if (raceKm != null) {
    F({ key: "afstand", label: "Afstand", kind: "feit", value: fmtKm(raceKm), origin: "wedstrijd" });
  } else if (routeKm != null) {
    F({
      key: "afstand", label: "Afstand", kind: "afgeleid", value: fmtKm(routeKm),
      origin: "gekoppelde route",
      explanation: "Overgenomen van de gekoppelde route; controleer of die het volledige wedstrijdparcours dekt.",
      confidence: 0.75,
    });
  } else {
    F({
      key: "afstand", label: "Afstand", kind: "ontbreekt", value: null, origin: "wedstrijd",
      explanation: "Geen afstand ingevuld en geen route gekoppeld.",
      question: "Vul de afstand in of koppel de parcoursroute (GPX).",
    });
  }

  // Hoogtemeters — zelfde voorrang.
  const raceElev = race.elevationM ?? null;
  const elev = raceElev ?? (routeElev != null ? Math.round(routeElev) : null);
  if (raceElev != null) {
    F({ key: "hoogtemeters", label: "Hoogtemeters", kind: "feit", value: `${raceElev} m`, origin: "wedstrijd" });
  } else if (routeElev != null) {
    F({
      key: "hoogtemeters", label: "Hoogtemeters", kind: "afgeleid", value: `${Math.round(routeElev)} m`,
      origin: "gekoppelde route",
      explanation: "Berekend uit het hoogteprofiel van de gekoppelde route.",
      confidence: 0.8,
    });
  } else {
    F({
      key: "hoogtemeters", label: "Hoogtemeters", kind: "ontbreekt", value: null, origin: "wedstrijd",
      explanation: "Geen hoogtemeters bekend.",
      question: "Koppel de parcoursroute of vul de hoogtemeters uit de technische gids in.",
    });
  }

  // Beklimmingen — alleen uit echte routedetectie, nooit verzonnen.
  if (route && routeClimbs.length > 0) {
    const top = routeClimbs
      .slice()
      .sort((a, b) => b.lengthKm * b.avgGradePct - a.lengthKm * a.avgGradePct)
      .slice(0, 5);
    F({
      key: "beklimmingen", label: "Beklimmingen", kind: "feit",
      value: top.map((c) => `${c.name} (${fmtKm(c.lengthKm)} à ${c.avgGradePct}%)`).join("; "),
      origin: "gekoppelde route",
      explanation: `Uit het hoogteprofiel gedetecteerd: ${routeClimbs.length} beklimming(en).`,
    });
  } else if (route && route.profile != null) {
    F({
      key: "beklimmingen", label: "Beklimmingen", kind: "feit",
      value: "Geen noemenswaardige beklimmingen gedetecteerd",
      origin: "gekoppelde route",
      explanation: "Het hoogteprofiel van de route bevat geen aanhoudende stijgingen.",
    });
  } else {
    F({
      key: "beklimmingen", label: "Beklimmingen", kind: "ontbreekt", value: null, origin: "route",
      explanation: "Zonder gekoppelde route met hoogteprofiel kan er geen klimdetectie draaien.",
      question: "Koppel de parcoursroute (GPX) voor automatische klimdetectie.",
    });
  }

  // Ondergrond — uit de route wanneer bekend, eerlijk onbekend anders.
  if (route && route.surface && route.surface !== "unknown") {
    F({
      key: "ondergrond", label: "Ondergrond", kind: "feit",
      value: SURFACE_LABEL[route.surface] ?? route.surface, origin: "gekoppelde route",
    });
  } else {
    F({
      key: "ondergrond", label: "Ondergrond", kind: "ontbreekt", value: null, origin: "route",
      explanation: route
        ? "De gekoppelde route heeft geen ondergrond ingesteld."
        : "Geen route gekoppeld.",
      question: "Zet de ondergrond op de gekoppelde route (asfalt/gravel/gemengd).",
    });
  }

  // Technische delen — alleen uit het wedstrijdveld (renner/gids), nooit gegokt.
  if (race.technicalSections && race.technicalSections.trim()) {
    F({
      key: "technisch", label: "Technische passages", kind: "feit",
      value: race.technicalSections.trim(), origin: "wedstrijd",
    });
  } else {
    F({
      key: "technisch", label: "Technische passages", kind: "ontbreekt", value: null, origin: "wedstrijd",
      explanation: "Technische delen (bochten, kasseien, smalle stroken) staan niet in een bereikbare bron.",
      question: "Noteer de lastige delen uit de technische gids of je verkenning.",
    });
  }

  // Verwachte duur — route-provider duur (afgeleid) of afstand × tempo (inschatting).
  if (route?.durationSec != null && route.durationSec > 0) {
    F({
      key: "duur", label: "Verwachte duur", kind: "afgeleid",
      value: `~${fmtDuration(Math.round(route.durationSec / 60))}`,
      origin: "gekoppelde route",
      explanation: "Geschatte rijtijd van de routeprovider — wedstrijdtempo ligt meestal hoger.",
      confidence: 0.6,
    });
  } else if (km != null && km > 0) {
    const speed = 33; // conservatief gemiddelde; race-intel verfijnt per discipline
    F({
      key: "duur", label: "Verwachte duur", kind: "inschatting",
      value: `~${fmtDuration(Math.round((km / speed) * 60))}`,
      origin: "afgeleid",
      explanation: "Grove schatting uit afstand × gemiddeld tempo; pas aan op je eigen tempo.",
      confidence: 0.5,
    });
  } else {
    F({
      key: "duur", label: "Verwachte duur", kind: "ontbreekt", value: null, origin: "afgeleid",
      explanation: "Zonder afstand of route valt de duur niet te schatten.",
      question: "Vul de afstand in of koppel de parcoursroute.",
    });
  }

  // Windgevoeligheid — voorzichtige inschatting, ALLEEN wanneer het profiel
  // aantoonbaar vlak is (echte data); zonder profiel blijft dit eerlijk open.
  if (route && route.profile != null && km != null) {
    const flat = elev != null && km > 0 && elev / km < 5 && routeClimbs.length === 0;
    if (flat) {
      F({
        key: "wind", label: "Windgevoeligheid", kind: "inschatting",
        value: "Vlak en open parcours: wind en waaiers kunnen beslissend zijn",
        origin: "afgeleid uit route",
        explanation:
          "Het hoogteprofiel is vlak zonder beklimmingen; op zulke parcoursen weegt wind zwaar. Waar precies hangt af van bebouwing en beschutting — dat staat niet in de route.",
        confidence: 0.5,
      });
    } else {
      F({
        key: "wind", label: "Windgevoeligheid", kind: "inschatting",
        value: "Selectie valt eerder op de hellingen dan op de wind",
        origin: "afgeleid uit route",
        explanation: "Het profiel bevat klimwerk; hoogteverschil is dan meestal bepalender dan wind.",
        confidence: 0.5,
      });
    }
  } else {
    F({
      key: "wind", label: "Windgevoeligheid", kind: "ontbreekt", value: null, origin: "route",
      explanation: "Zonder gekoppelde route met hoogteprofiel valt hier niets over te zeggen.",
      question: "Koppel de parcoursroute; dan wordt het profiel beoordeeld.",
    });
  }

  // Karakterisering — één eerlijke zin uit wat er echt is.
  let character: string;
  if (km != null && elev != null && km > 0) {
    const perKm = elev / km;
    if (perKm >= 12) character = `Stevig klimwerk: ~${elev} m over ${fmtKm(km)}. Verdeel je krachten en spaar voor de zwaarste beklimmingen.`;
    else if (perKm >= 5) character = `Glooiend parcours: ~${elev} m over ${fmtKm(km)}. Selectie valt waarschijnlijk op de hellingen.`;
    else character = `Overwegend vlak: ~${elev} m over ${fmtKm(km)}. Reken op een gesloten koers waarin positie en wind tellen.`;
  } else if (km != null) {
    character = `Afstand ${fmtKm(km)}; hoogtemeters nog onbekend — koppel de route of vul de gids in.`;
  } else {
    character = "Parcours nog onbekend — koppel de parcoursroute (GPX) of vul afstand en hoogtemeters in.";
  }

  const gaps = facts
    .filter((f) => f.kind === "ontbreekt")
    .map((f) => ({ key: f.key, label: f.label, question: f.question ?? "" }));

  return {
    raceId: race.id,
    hasRoute: !!route,
    route: route
      ? {
          id: route.id,
          name: route.name,
          distanceKm: route.distanceKm,
          elevationGainM: route.elevationGainM,
          surface: route.surface,
          climbs: routeClimbs,
          hasProfile: route.profile != null,
        }
      : null,
    facts,
    character,
    gaps,
  };
}

// ── Async builder (laadt de gekoppelde route, eigenaar-gecheckt) ─────────────
export async function loadLinkedRoute(
  race: Race,
): Promise<(typeof routesTable.$inferSelect) | null> {
  // Voorrang: expliciete koppeling (races.route_id), anders de route die aan de
  // gekoppelde geplande training hangt (bestaand verkennings-pad).
  if (race.routeId != null) {
    const [r] = await db
      .select()
      .from(routesTable)
      .where(and(eq(routesTable.id, race.routeId), eq(routesTable.clerkId, race.clerkId)))
      .limit(1);
    if (r) return r;
  }
  if (race.plannedWorkoutId != null) {
    const [r] = await db
      .select()
      .from(routesTable)
      .where(
        and(
          eq(routesTable.clerkId, race.clerkId),
          eq(routesTable.linkedPlannedWorkoutId, race.plannedWorkoutId),
        ),
      )
      .limit(1);
    if (r) return r;
  }
  return null;
}

export async function buildCourseAnalysis(race: Race): Promise<RaceCourseAnalysis> {
  const route = await loadLinkedRoute(race).catch(() => null);
  return composeCourseAnalysis(race, route);
}
