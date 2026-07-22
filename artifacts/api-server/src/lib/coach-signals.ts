// Coach-aandachtssignalen — deterministisch berekend op leesmoment uit échte,
// bestaande data (dagmetrieken, sessies, geplande trainingen, wedstrijden,
// gezondheidsstatus, openstaande Sparki-voorstellen). Er wordt niets verzonnen
// en niets opgeslagen: alleen het BESLUIT van de coach op een signaal wordt
// bewaard (coach_signal_actions). Elk signaal legt uit: wat er veranderd is,
// op welke brondata het steunt, hoe zeker Sparki is, waarom dit menselijke
// beoordeling vraagt en welke actie Sparki voorstelt.

import { and, desc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import {
  db,
  athleteDailyMetricsTable,
  athleteProfilesTable,
  plannedWorkoutsTable,
  trainingSessionsTable,
  racesTable,
  coachChangeProposalsTable,
  coachSignalActionsTable,
  type CoachSignalAction,
} from "@workspace/db";
import { computeReadiness } from "./sharing";

export type SignalCategory =
  | "gezondheid"
  | "herstel"
  | "belasting"
  | "gemist"
  | "activiteit"
  | "schema"
  | "wedstrijd"
  | "data";

export interface CoachSignal {
  key: string;
  category: SignalCategory;
  /** 1 = hoogste prioriteit */
  priority: 1 | 2 | 3;
  title: string;
  /** Wat er precies is veranderd of afwijkt. */
  changed: string;
  /** Op welke echte brondata dit steunt. */
  sources: string[];
  confidence: "hoog" | "middel" | "laag";
  /** Waarom dit menselijke beoordeling vraagt. */
  whyHuman: string;
  /** Welke actie Sparki voorstelt. */
  proposedAction: string;
  /** Eerder besluit van deze coach op dit signaal (indien aanwezig). */
  action: { action: CoachSignalAction; note: string | null; at: string } | null;
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

function daysAheadStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

export async function buildCoachSignals(
  coachClerkId: string,
  athleteClerkId: string,
): Promise<CoachSignal[]> {
  const today = localDateStr(new Date());
  const signals: CoachSignal[] = [];

  const [profileRows, metrics, recentSessions, pastPlanned, upcomingRaces, openProposals] =
    await Promise.all([
      db
        .select({ healthStatus: athleteProfilesTable.healthStatus })
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, athleteClerkId))
        .limit(1),
      db
        .select()
        .from(athleteDailyMetricsTable)
        .where(eq(athleteDailyMetricsTable.clerkId, athleteClerkId))
        .orderBy(desc(athleteDailyMetricsTable.metricDate))
        .limit(3),
      db
        .select({
          id: trainingSessionsTable.id,
          sessionDate: trainingSessionsTable.sessionDate,
          title: trainingSessionsTable.title,
          durationMin: trainingSessionsTable.durationMin,
          tss: trainingSessionsTable.tss,
        })
        .from(trainingSessionsTable)
        .where(eq(trainingSessionsTable.clerkId, athleteClerkId))
        .orderBy(desc(trainingSessionsTable.sessionDate), desc(trainingSessionsTable.id))
        .limit(30),
      db
        .select({
          id: plannedWorkoutsTable.id,
          scheduledDate: plannedWorkoutsTable.scheduledDate,
          title: plannedWorkoutsTable.title,
          status: plannedWorkoutsTable.status,
          targetTSS: plannedWorkoutsTable.targetTSS,
          source: plannedWorkoutsTable.source,
        })
        .from(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.clerkId, athleteClerkId),
            gte(plannedWorkoutsTable.scheduledDate, daysAgoStr(7)),
            lt(plannedWorkoutsTable.scheduledDate, today),
            eq(plannedWorkoutsTable.status, "planned"),
          ),
        ),
      db
        .select({
          id: racesTable.id,
          name: racesTable.name,
          raceDate: racesTable.raceDate,
        })
        .from(racesTable)
        .where(
          and(
            eq(racesTable.clerkId, athleteClerkId),
            gte(racesTable.raceDate, today),
            // Geannuleerde wedstrijden geven geen coachsignalen.
            ne(racesTable.status, "geannuleerd"),
          ),
        )
        .orderBy(racesTable.raceDate)
        .limit(3),
      db
        .select()
        .from(coachChangeProposalsTable)
        .where(
          and(
            eq(coachChangeProposalsTable.athleteClerkId, athleteClerkId),
            eq(coachChangeProposalsTable.status, "open"),
          ),
        ),
    ]);

  // 1. Gezondheid (prio 1)
  const health = profileRows[0]?.healthStatus ?? null;
  if (health && health !== "gezond" && health !== "healthy") {
    signals.push({
      key: `gezondheid:${health}`,
      category: "gezondheid",
      priority: 1,
      title: "Gezondheidsmelding",
      changed: `De sporter heeft de gezondheidsstatus "${health}" doorgegeven.`,
      sources: ["Gezondheidsstatus uit het sportersprofiel"],
      confidence: "hoog",
      whyHuman:
        "Bij ziekte of blessure hoort een mens te beslissen over rust, aanpassing of contact — niet een rekenregel.",
      proposedAction:
        "Neem contact op met de sporter en pas het schema aan (rust of licht herstel).",
      action: null,
    });
  }

  // 2. Herstel/readiness (prio 1)
  const readiness = computeReadiness(metrics[0] ?? null);
  if (readiness.label === "tired" && metrics[0]) {
    signals.push({
      key: `herstel:${metrics[0].metricDate}`,
      category: "herstel",
      priority: 1,
      title: "Herstel staat onder druk",
      changed: `De laatste check-in (${metrics[0].metricDate}) wijst op vermoeidheid (score ${readiness.score ?? "?"}/100).`,
      sources: readiness.basis.map((b) => `Dagelijkse check-in: ${b}`),
      confidence: readiness.basis.length >= 2 ? "hoog" : "middel",
      whyHuman:
        "Alleen de coach kent de context (school, werk, privé) om te bepalen of dit incidenteel of structureel is.",
      proposedAction:
        "Verlaag de eerstvolgende training of plan een rustdag; vraag hoe de sporter zich voelt.",
      action: null,
    });
  }

  // 3. Belasting-afwijking laatste 7 dagen (prio 2) — alleen bij echte data.
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const doneTss = recentSessions
    .filter((s) => s.sessionDate >= daysAgoStr(7) && s.tss != null)
    .reduce((a, s) => a + (s.tss ?? 0), 0);
  const [plannedWeek] = await Promise.all([
    db
      .select({ targetTSS: plannedWorkoutsTable.targetTSS })
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, athleteClerkId),
          gte(plannedWorkoutsTable.scheduledDate, daysAgoStr(7)),
          lt(plannedWorkoutsTable.scheduledDate, today),
        ),
      ),
  ]);
  const plannedTss = plannedWeek.reduce((a, w) => a + (w.targetTSS ?? 0), 0);
  if (plannedTss > 0 && doneTss > 0) {
    const ratio = doneTss / plannedTss;
    if (ratio >= 1.3 || ratio <= 0.7) {
      const teVeel = ratio >= 1.3;
      signals.push({
        key: `belasting:${today}`,
        category: "belasting",
        priority: 2,
        title: teVeel ? "Meer belasting dan gepland" : "Minder belasting dan gepland",
        changed: `Afgelopen 7 dagen: ${doneTss} belastingpunten gereden tegenover ${plannedTss} gepland (${Math.round(ratio * 100)}%).`,
        sources: [
          "Belastingscore (TSS) van uitgevoerde sessies, afgelopen 7 dagen",
          "Doelbelasting van geplande trainingen, afgelopen 7 dagen",
        ],
        confidence: "middel",
        whyHuman:
          "Een afwijking kan bewust zijn (vakantie, extra rit) — alleen de coach weet of bijsturen nodig is.",
        proposedAction: teVeel
          ? "Bespreek of de komende dagen rustiger moeten om overbelasting te voorkomen."
          : "Vraag waarom trainingen kleiner uitvielen en pas het schema zo nodig aan.",
        action: null,
      });
    }
  }

  // 4. Gemiste trainingen (prio 2)
  if (pastPlanned.length > 0) {
    const sessionDates = new Set(
      recentSessions
        .map((s) => s.sessionDate),
    );
    const missed = pastPlanned.filter((w) => !sessionDates.has(w.scheduledDate));
    if (missed.length > 0) {
      signals.push({
        key: `gemist:${missed[missed.length - 1]!.scheduledDate}:${missed.length}`,
        category: "gemist",
        priority: 2,
        title: missed.length === 1 ? "Training gemist" : `${missed.length} trainingen gemist`,
        changed: `Gepland maar geen activiteit gevonden op: ${missed.map((m) => `${m.scheduledDate} (${m.title})`).join(", ")}.`,
        sources: [
          "Geplande trainingen (afgelopen 7 dagen, status gepland)",
          "Uitgevoerde sessies uit de Data Hub",
        ],
        confidence: "middel",
        whyHuman:
          "Een gemiste training kan een goede reden hebben; doorplannen zonder gesprek kan het probleem verergeren.",
        proposedAction:
          "Vraag naar de reden en beslis of de training wordt ingehaald of vervalt.",
        action: null,
      });
    }
  }

  // 5. Nieuwe activiteit (prio 3)
  const latest = recentSessions[0];
  if (latest && latest.sessionDate >= daysAgoStr(2)) {
    {
      signals.push({
        key: `activiteit:${latest.id}`,
        category: "activiteit",
        priority: 3,
        title: "Nieuwe activiteit binnen",
        changed: `"${latest.title ?? "Activiteit"}" (${latest.durationMin ?? "?"} min${latest.tss != null ? `, ${latest.tss} belastingpunten` : ""}) van ${latest.sessionDate}.`,
        sources: ["Uitgevoerde sessie uit de Data Hub"],
        confidence: "hoog",
        whyHuman: "Een blik van de coach op de uitvoering zegt meer dan cijfers alleen.",
        proposedAction: "Bekijk de activiteit en stuur eventueel een korte reactie.",
        action: null,
      });
    }
  }

  // 6. Openstaand Sparki-wijzigingsvoorstel op een coachtraining (prio 2)
  for (const p of openProposals) {
    signals.push({
      key: `schema:voorstel:${p.id}`,
      category: "schema",
      priority: 2,
      title: "Sparki stelt een schemawijziging voor",
      changed: p.reason,
      sources: ["Feedback van de sporter op een coachtraining"],
      confidence: "middel",
      whyHuman:
        "Dit is een training van de coach — Sparki past die nooit zelf aan. Alleen de coach beslist.",
      proposedAction: "Beoordeel het voorstel: overnemen, aanpassen, afwijzen of parkeren.",
      action: null,
    });
  }

  // 7. Wedstrijd nabij (prio 2)
  const nextRace = upcomingRaces[0];
  if (nextRace && nextRace.raceDate <= daysAheadStr(14)) {
    const daysTo = Math.round(
      (new Date(nextRace.raceDate + "T12:00:00").getTime() - Date.now()) / 86_400_000,
    );
    signals.push({
      key: `wedstrijd:${nextRace.id}`,
      category: "wedstrijd",
      priority: 2,
      title: `Wedstrijd over ${Math.max(daysTo, 0)} dagen`,
      changed: `"${nextRace.name}" staat gepland op ${nextRace.raceDate}.`,
      sources: ["Wedstrijdkalender van de sporter"],
      confidence: "hoog",
      whyHuman:
        "De aanloop (taper, laatste prikkel) is maatwerk dat de coach bepaalt.",
      proposedAction: "Controleer de laatste trainingsweek en plan de aanloop bewust.",
      action: null,
    });
  }

  // 8. Ontbrekende data (prio 3) — eerlijk benoemen wat er níet is.
  const noRecentMetric = !metrics[0] || metrics[0].metricDate < daysAgoStr(3);
  const noRecentSession = !latest || latest.sessionDate < daysAgoStr(14);
  if (noRecentMetric || noRecentSession) {
    const missing: string[] = [];
    if (noRecentMetric) missing.push("geen check-in in de laatste 3 dagen");
    if (noRecentSession) missing.push("geen activiteit in de laatste 14 dagen");
    signals.push({
      key: `data:${today}`,
      category: "data",
      priority: 3,
      title: "Gegevens ontbreken",
      changed: `Er is ${missing.join(" en ")}.`,
      sources: ["Dagelijkse check-ins", "Uitgevoerde sessies uit de Data Hub"],
      confidence: "hoog",
      whyHuman:
        "Zonder recente gegevens kan Sparki de toestand van de sporter niet betrouwbaar beoordelen.",
      proposedAction:
        "Vraag de sporter om een check-in te doen of een koppeling/bestand toe te voegen.",
      action: null,
    });
  }

  // Eerder besluit van deze coach op deze signalen erbij zetten.
  const keys = signals.map((s) => s.key);
  if (keys.length > 0) {
    const actions = await db
      .select()
      .from(coachSignalActionsTable)
      .where(
        and(
          eq(coachSignalActionsTable.coachClerkId, coachClerkId),
          eq(coachSignalActionsTable.athleteClerkId, athleteClerkId),
          inArray(coachSignalActionsTable.signalKey, keys),
        ),
      );
    const byKey = new Map(actions.map((a) => [a.signalKey, a]));
    for (const s of signals) {
      const a = byKey.get(s.key);
      if (a) {
        s.action = {
          action: a.action,
          note: a.note,
          at: a.updatedAt.toISOString(),
        };
      }
    }
  }

  signals.sort((a, b) => a.priority - b.priority);
  return signals;
}

/** Hoogste openstaande prioriteit (1 het urgentst; null = niets open). */
export function openPriority(signals: CoachSignal[]): number | null {
  const open = signals.filter(
    (s) => !s.action || s.action.action === "parkeren",
  );
  if (open.length === 0) return null;
  return Math.min(...open.map((s) => s.priority));
}
