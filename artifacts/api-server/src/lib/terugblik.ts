import { and, desc, eq, gte, inArray, isNotNull, lt, ne } from "drizzle-orm";
import {
  db,
  plannedWorkoutsTable,
  trainingSessionsTable,
  racesTable,
  routesTable,
  journeyReflectionsTable,
  type RaceResult,
} from "@workspace/db";

// ── Naslagwerk / terugblik ───────────────────────────────────────────────────
// Sparki's "naslagwerk": per uitgevoerde geplande training en per gereden
// wedstrijd worden de UITKOMST (verdict, plan-vs-werkelijk), de gebruikte route
// en de eigen terugblik/les SAMENGESTELD uit de bestaande tabellen
// (planned_workouts↔training_sessions-executielink, routes, races.result,
// journey_reflections). Er wordt hier bewust NIETS gedupliceerd of opnieuw
// opgeslagen — het dossier bestaat al; dit blok maakt het onderdeel van elke
// analyse en elk advies, zodat Sparki structureel terugkijkt op wat eerder wel
// en niet werkte. Alleen echte data; ontbrekende velden worden weggelaten,
// nooit verzonnen.

const LOOKBACK_DAYS = 42;
const MAX_EXECUTED = 8;
const MAX_PAST_RACES = 5;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().split("T")[0]!;
}

function clip(text: string, max = 180): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

const VERDICT_NL: Record<string, string> = {
  completed: "volgens plan uitgevoerd",
  partial: "gedeeltelijk uitgevoerd",
  adjusted: "zwaarder/langer uitgevoerd dan gepland",
};

function raceResultLine(result: RaceResult | null): string | null {
  if (!result) return null;
  const bits = [
    result.status === "finished" && "uitgereden",
    result.status === "dnf" && "niet uitgereden (DNF)",
    result.status === "dns" && "niet gestart (DNS)",
    result.status === "dsq" && "gediskwalificeerd",
    result.position != null &&
      `positie ${result.position}${result.fieldSize != null ? `/${result.fieldSize}` : ""}`,
    result.timeSec != null && `tijd ${Math.round(result.timeSec / 60)}min`,
    result.points != null && `${result.points} punten`,
    result.note && `notitie="${clip(result.note, 100)}"`,
  ].filter(Boolean);
  return bits.length ? bits.join(", ") : null;
}

// Bouwt het NASLAGWERK-promptblok. Additief en eerlijk: geeft null terug
// wanneer er (nog) niets uitgevoerd of gereden is — het contextbestand
// vermeldt dan niets in plaats van een leeg of verzonnen blok.
export async function terugblikBlock(clerkId: string): Promise<string | null> {
  const today = new Date().toISOString().split("T")[0]!;
  const cutoff = isoDaysAgo(LOOKBACK_DAYS);

  const [executed, pastRaces] = await Promise.all([
    db
      .select()
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, clerkId),
          isNotNull(plannedWorkoutsTable.sessionId),
          inArray(plannedWorkoutsTable.status, [
            "completed",
            "partial",
            "adjusted",
          ]),
          gte(plannedWorkoutsTable.scheduledDate, cutoff),
        ),
      )
      .orderBy(desc(plannedWorkoutsTable.scheduledDate))
      .limit(MAX_EXECUTED),
    db
      .select()
      .from(racesTable)
      .where(
        and(
          eq(racesTable.clerkId, clerkId),
          lt(racesTable.raceDate, today),
          ne(racesTable.status, "geannuleerd"),
        ),
      )
      .orderBy(desc(racesTable.raceDate))
      .limit(MAX_PAST_RACES),
  ]);

  if (executed.length === 0 && pastRaces.length === 0) return null;

  // Gekoppelde sessies (werkelijke uitvoering) en routes in één slag ophalen.
  const sessionIds = executed
    .map((w) => w.sessionId)
    .filter((id): id is number => id != null);
  const routeIds = executed
    .map((w) => w.routeId)
    .filter((id): id is number => id != null);
  const raceIds = pastRaces.map((r) => r.id);

  const [sessions, routes, reflections] = await Promise.all([
    sessionIds.length
      ? db
          .select()
          .from(trainingSessionsTable)
          .where(
            and(
              eq(trainingSessionsTable.clerkId, clerkId),
              inArray(trainingSessionsTable.id, sessionIds),
            ),
          )
      : Promise.resolve([]),
    routeIds.length
      ? db
          .select({
            id: routesTable.id,
            name: routesTable.name,
            distanceKm: routesTable.distanceKm,
          })
          .from(routesTable)
          .where(
            and(
              eq(routesTable.clerkId, clerkId),
              inArray(routesTable.id, routeIds),
            ),
          )
      : Promise.resolve([]),
    raceIds.length
      ? db
          .select()
          .from(journeyReflectionsTable)
          .where(
            and(
              eq(journeyReflectionsTable.clerkId, clerkId),
              inArray(journeyReflectionsTable.raceId, raceIds),
            ),
          )
      : Promise.resolve([]),
  ]);

  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const routeById = new Map(routes.map((r) => [r.id, r]));
  const reflectionByRace = new Map(reflections.map((r) => [r.raceId, r]));

  const parts: string[] = [];
  parts.push(
    `NASLAGWERK (uitgevoerde trainingen & gereden wedstrijden — kijk hier ACTIEF op terug):`,
  );

  if (executed.length > 0) {
    parts.push(`UITGEVOERDE GEPLANDE TRAININGEN (laatste ${LOOKBACK_DAYS} dagen):`);
    for (const w of executed) {
      const s = w.sessionId != null ? sessionById.get(w.sessionId) : undefined;
      const route = w.routeId != null ? routeById.get(w.routeId) : undefined;
      const d = [
        `${w.scheduledDate} "${w.title}"`,
        VERDICT_NL[w.status] ?? w.status,
        w.targetDurationMin != null && `plan=${w.targetDurationMin}min`,
        s?.durationMin != null && `gereden=${s.durationMin}min`,
        w.targetTSS != null && `plan-TSS=${w.targetTSS}`,
        s?.tss != null && `gereden-TSS=${s.tss}`,
        s?.feelScore != null && `gevoel=${s.feelScore}/5`,
        route &&
          `route="${route.name}"${route.distanceKm != null ? ` (${Math.round(route.distanceKm)}km)` : ""}`,
      ]
        .filter(Boolean)
        .join(", ");
      parts.push(`  - ${d}`);
    }
  }

  if (pastRaces.length > 0) {
    parts.push(`GEREDEN WEDSTRIJDEN (meest recent eerst):`);
    for (const r of pastRaces) {
      const refl = reflectionByRace.get(r.id);
      const d = [
        `${r.raceDate} "${r.name}"`,
        raceResultLine((r.result as RaceResult | null) ?? null) ??
          "uitslag niet vastgelegd",
        refl?.reflection && `terugblik="${clip(refl.reflection)}"`,
        refl?.lesson && `les="${clip(refl.lesson)}"`,
        refl?.nextAction && `vervolgactie="${clip(refl.nextAction)}"`,
      ]
        .filter(Boolean)
        .join(", ");
      parts.push(`  - ${d}`);
    }
  }

  parts.push(
    `NASLAG-INSTRUCTIE: gebruik dit naslagwerk actief in je analyses en adviezen — vergelijk nieuw advies met wat eerder wel of niet werkte (verdicts, gevoel, uitslagen), herhaal een eerder geleerde les wanneer die nu relevant is, en verwijs waar passend kort naar de betreffende training of wedstrijd. Verzin nooit iets dat hier niet staat.`,
  );

  return parts.join("\n");
}
