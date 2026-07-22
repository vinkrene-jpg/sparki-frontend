// Golf 26 — Gezondheids- en herstelflow (deterministische engine).
//
// Eén samenhangende keten: status → signalering → beperking → opvolging →
// herstel → hervatting. Deze module is de ENIGE plek die klachten,
// gezondheidsstatus, herstelsignalen en hervatting samenbrengt, zodat er
// nergens twee tegenstrijdige statussen kunnen bestaan (opdracht punt 10).
//
// Regels:
// - Geen diagnose: Sparki registreert wat de sporter doorgeeft en herhaalt
//   professionele instructies letterlijk — nooit een medisch oordeel.
// - Klacht → athlete_profiles.health_status (bestaande SSOT die planblokkade,
//   coach-signalen en nooddag al lezen) loopt via syncHealthStatus, altijd in
//   een transactie met een paspoort-event.
// - Herstel is NOOIT automatisch: gezond melden vergt een expliciete
//   hervattingsbevestiging (confirmResumption).
// - Ontbrekende data geeft nooit een slechte score: geen gegevens = "onbekend".

import { and, desc, eq, gte, inArray, ne, or } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  athleteDailyMetricsTable,
  healthComplaintsTable,
  healthComplaintUpdatesTable,
  healthSafetyInfoTable,
  parentReportsTable,
  plannedWorkoutsTable,
  type HealthComplaint,
  type HealthComplaintUpdate,
  type HealthSignalSource,
  type AthleteDailyMetric,
} from "@workspace/db";
import { computeReadiness, type Readiness } from "./sharing";
import { recordValueEvent } from "./passport";

// ── Types ────────────────────────────────────────────────────────────────────

export interface HealthSignal {
  source: HealthSignalSource;
  title: string;
  detail: string;
  severity: "info" | "let_op" | "ernstig";
  complaintId?: number;
  at: string; // ISO of datum
}

export interface ResumptionAdvice {
  active: boolean;
  /** Dagnummer in het opbouwvenster (1-gebaseerd), null buiten venster. */
  day: number | null;
  windowDays: number;
  advice: string | null;
  /** Aandeel van normale belasting dat verantwoord is (0–1). */
  loadFactor: number | null;
}

export interface HealthOverview {
  healthStatus: string;
  complaints: (HealthComplaint & { updates: HealthComplaintUpdate[] })[];
  signals: HealthSignal[];
  readiness: Readiness;
  resumption: ResumptionAdvice;
  /** Kan de sporter nu een hervatting bevestigen? */
  canResume: boolean;
}

// ── Datum-helpers (lokale kalenderdag, zie memory local-date-utc-trap) ───────

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(fromDateStr: string, to: Date): number {
  const from = new Date(`${fromDateStr}T12:00:00`);
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

// ── Statussync klacht → health_status ───────────────────────────────────────

/** Bepaal welke health_status hoort bij de actieve klachten. Geeft null terug
 *  wanneer klachten géén status afdwingen (dan blijft de huidige staan —
 *  gezond melden gaat uitsluitend via confirmResumption). */
export function statusFromComplaints(
  complaints: Pick<HealthComplaint, "kind" | "status" | "trainingImpact">[],
): "sick" | "injured" | null {
  const relevant = complaints.filter(
    (c) => c.status !== "hersteld" && c.trainingImpact !== "geen",
  );
  if (relevant.length === 0) return null;
  // Ziekte weegt zwaarder dan blessure/pijn voor de dagstatus.
  if (relevant.some((c) => c.kind === "ziekte")) return "sick";
  return "injured";
}

/**
 * Zet de gezondheidsstatus in lijn met de actieve klachten. Verhoogt alleen
 * (ok → sick/injured of sick↔injured op basis van klachten); verlaagt nooit
 * automatisch naar ok. Paspoort-event in dezelfde transactie.
 */
export async function syncHealthStatus(
  clerkId: string,
  actorClerkId: string,
): Promise<string> {
  return db.transaction(async (tx) => {
    const complaints = await tx
      .select({
        kind: healthComplaintsTable.kind,
        status: healthComplaintsTable.status,
        trainingImpact: healthComplaintsTable.trainingImpact,
      })
      .from(healthComplaintsTable)
      .where(
        and(
          eq(healthComplaintsTable.clerkId, clerkId),
          ne(healthComplaintsTable.status, "hersteld"),
        ),
      );
    const target = statusFromComplaints(complaints);
    const [before] = await tx
      .select({ healthStatus: athleteProfilesTable.healthStatus })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId))
      .limit(1);
    const current = before?.healthStatus ?? "ok";
    if (!before || target == null || target === current) return current;

    await tx
      .update(athleteProfilesTable)
      .set({ healthStatus: target, updatedAt: new Date() })
      .where(eq(athleteProfilesTable.clerkId, clerkId));
    await recordValueEvent(
      {
        clerkId,
        field: "healthStatus",
        oldValue: current,
        newValue: target,
        origin: "handmatig",
        source: "gezondheidsmelding",
        actorType: "sporter",
        actorId: actorClerkId,
      },
      tx,
    );
    return target;
  });
}

// ── Hervatting ───────────────────────────────────────────────────────────────

const RESUMPTION_WINDOW_DAYS = 7;

/** Deterministisch, stapsgewijs hervattingsadvies (opdracht punt 8). */
export function computeResumption(
  healthStatus: string,
  lastResumptionAt: Date | null,
  now = new Date(),
): ResumptionAdvice {
  const none: ResumptionAdvice = {
    active: false,
    day: null,
    windowDays: RESUMPTION_WINDOW_DAYS,
    advice: null,
    loadFactor: null,
  };
  if (healthStatus !== "ok" || !lastResumptionAt) return none;
  const day =
    daysBetween(localDateStr(lastResumptionAt), now) + 1; // dag 1 = dag van bevestiging
  if (day < 1 || day > RESUMPTION_WINDOW_DAYS) return none;
  let advice: string;
  let loadFactor: number;
  if (day <= 2) {
    advice =
      "Dag " + day + " van je opbouw: houd het bij een korte, rustige sessie of rust. Geen intensiteit.";
    loadFactor = 0.4;
  } else if (day <= 4) {
    advice =
      "Dag " + day + " van je opbouw: rustige duur mag, nog geen intervallen of wedstrijdprikkels.";
    loadFactor = 0.6;
  } else {
    advice =
      "Dag " + day + " van je opbouw: bouw richting normaal, maar stop of schaal terug bij terugkerende klachten.";
    loadFactor = 0.8;
  }
  return {
    active: true,
    day,
    windowDays: RESUMPTION_WINDOW_DAYS,
    advice,
    loadFactor,
  };
}

/** Meest recente hervattingsbevestiging van deze sporter (of null). */
export async function lastResumption(clerkId: string): Promise<Date | null> {
  const [row] = await db
    .select({ at: healthComplaintsTable.resumptionConfirmedAt })
    .from(healthComplaintsTable)
    .where(
      and(
        eq(healthComplaintsTable.clerkId, clerkId),
        eq(healthComplaintsTable.status, "hersteld"),
      ),
    )
    .orderBy(desc(healthComplaintsTable.resumptionConfirmedAt))
    .limit(1);
  return row?.at ?? null;
}

// ── Sensor-afwijking (berekend, nooit opgeslagen als feit) ───────────────────

/**
 * Eerlijke, conservatieve afwijkingsdetectie op rusthartslag: pas een signaal
 * bij ≥5 metingen in 14 dagen en een verhoging van ≥10% t.o.v. het gemiddelde.
 * Geen data ⇒ geen signaal (nooit een slechte score bij ontbrekende data).
 */
export function detectSensorDeviation(
  metrics: Pick<AthleteDailyMetric, "metricDate" | "restingHR">[],
): HealthSignal | null {
  const withHr = metrics.filter((m) => m.restingHR != null);
  if (withHr.length < 5) return null;
  const latest = withHr[0]!;
  const rest = withHr.slice(1);
  if (rest.length < 4) return null;
  const avg = rest.reduce((a, m) => a + m.restingHR!, 0) / rest.length;
  if (avg <= 0) return null;
  const ratio = latest.restingHR! / avg;
  if (ratio < 1.1) return null;
  return {
    source: "sensor_afwijking",
    title: "Rusthartslag hoger dan normaal",
    detail: `Je laatste rusthartslag (${latest.restingHR} sl/min op ${latest.metricDate}) ligt ${Math.round((ratio - 1) * 100)}% boven je gemiddelde van de afgelopen twee weken (${Math.round(avg)} sl/min). Dat kán op vermoeidheid of opkomende ziekte wijzen — geen diagnose, wel een reden om vandaag rustig aan te doen.`,
    severity: "let_op",
    at: latest.metricDate,
  };
}

// ── Overzicht (SSOT voor alle oppervlakken) ──────────────────────────────────

const COMPLAINT_KIND_LABEL: Record<string, string> = {
  ziekte: "Ziekte",
  blessure: "Blessure",
  pijn: "Pijnklacht",
};

export async function getHealthOverview(
  clerkId: string,
): Promise<HealthOverview> {
  const fourteenAgo = localDateStr(
    new Date(Date.now() - 14 * 86_400_000),
  );
  const [profileRows, complaints, metrics, openParentReports] =
    await Promise.all([
      db
        .select({ healthStatus: athleteProfilesTable.healthStatus })
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, clerkId))
        .limit(1),
      db
        .select()
        .from(healthComplaintsTable)
        .where(eq(healthComplaintsTable.clerkId, clerkId))
        .orderBy(desc(healthComplaintsTable.createdAt))
        .limit(20),
      db
        .select()
        .from(athleteDailyMetricsTable)
        .where(
          and(
            eq(athleteDailyMetricsTable.clerkId, clerkId),
            gte(athleteDailyMetricsTable.metricDate, fourteenAgo),
          ),
        )
        .orderBy(desc(athleteDailyMetricsTable.metricDate)),
      db
        .select()
        .from(parentReportsTable)
        .where(
          and(
            eq(parentReportsTable.athleteClerkId, clerkId),
            inArray(parentReportsTable.kind, ["ziek", "blessure"]),
            or(
              eq(parentReportsTable.status, "open"),
              eq(parentReportsTable.status, "gezien"),
            ),
          ),
        )
        .orderBy(desc(parentReportsTable.createdAt))
        .limit(5),
    ]);

  const healthStatus = profileRows[0]?.healthStatus ?? "ok";
  const readiness = computeReadiness(metrics[0] ?? null);

  const complaintIds = complaints.map((c) => c.id);
  const updates = complaintIds.length
    ? await db
        .select()
        .from(healthComplaintUpdatesTable)
        .where(inArray(healthComplaintUpdatesTable.complaintId, complaintIds))
        .orderBy(desc(healthComplaintUpdatesTable.createdAt))
    : [];
  const updatesByComplaint = new Map<number, HealthComplaintUpdate[]>();
  for (const u of updates) {
    const list = updatesByComplaint.get(u.complaintId) ?? [];
    list.push(u);
    updatesByComplaint.set(u.complaintId, list);
  }

  const signals: HealthSignal[] = [];
  for (const c of complaints) {
    if (c.status === "hersteld") continue;
    signals.push({
      source: c.source,
      title: `${COMPLAINT_KIND_LABEL[c.kind] ?? c.kind}${c.bodyLocation ? ` — ${c.bodyLocation}` : ""}`,
      detail: `Ernst: ${c.severity}. Invloed op training: ${c.trainingImpact === "niet_trainen" ? "niet trainen" : c.trainingImpact}. Status: ${c.status}.`,
      severity: c.severity === "ernstig" ? "ernstig" : "let_op",
      complaintId: c.id,
      at: c.startDate,
    });
  }
  for (const r of openParentReports) {
    signals.push({
      source: "oudermelding",
      title: r.kind === "ziek" ? "Oudermelding: ziek" : "Oudermelding: blessure",
      detail: r.note
        ? `Melding van een ouder/verzorger: ${r.note}`
        : "Een ouder/verzorger heeft dit gemeld.",
      severity: "let_op",
      at: r.createdAt.toISOString(),
    });
  }
  const sensor = detectSensorDeviation(metrics);
  if (sensor) signals.push(sensor);
  if (readiness.label === "tired" && metrics[0]) {
    signals.push({
      source: "herstelinschatting",
      title: "Herstel staat onder druk",
      detail: `Je laatste check-in wijst op vermoeidheid (score ${readiness.score ?? "?"}/100, op basis van ${readiness.basis.join(", ")}).`,
      severity: "let_op",
      at: metrics[0].metricDate,
    });
  }

  const resumption = computeResumption(
    healthStatus,
    await lastResumption(clerkId),
  );

  // Hervatten kan wanneer de status niet-ok is en er geen actieve klacht
  // meer met "niet trainen" openstaat (herstellende klachten mogen).
  const blocking = complaints.some(
    (c) => c.status === "actief" && c.trainingImpact === "niet_trainen",
  );
  const canResume = healthStatus !== "ok" && !blocking;

  return {
    healthStatus,
    complaints: complaints.map((c) => ({
      ...c,
      updates: updatesByComplaint.get(c.id) ?? [],
    })),
    signals,
    readiness,
    resumption,
    canResume,
  };
}

// ── Historie (bewuste stap, punt 12) ─────────────────────────────────────────

export interface ComplaintHistoryEntry {
  complaint: HealthComplaint;
  updates: HealthComplaintUpdate[];
  durationDays: number | null;
  missedWorkouts: number;
  adjustedWorkouts: number;
  resumedAt: string | null;
}

export async function getComplaintHistory(
  clerkId: string,
): Promise<ComplaintHistoryEntry[]> {
  const complaints = await db
    .select()
    .from(healthComplaintsTable)
    .where(eq(healthComplaintsTable.clerkId, clerkId))
    .orderBy(desc(healthComplaintsTable.startDate));
  if (complaints.length === 0) return [];
  const ids = complaints.map((c) => c.id);
  const updates = await db
    .select()
    .from(healthComplaintUpdatesTable)
    .where(inArray(healthComplaintUpdatesTable.complaintId, ids))
    .orderBy(desc(healthComplaintUpdatesTable.createdAt));

  const out: ComplaintHistoryEntry[] = [];
  for (const c of complaints) {
    const endStr = c.resolvedAt
      ? localDateStr(c.resolvedAt)
      : localDateStr(new Date());
    // Gemiste/aangepaste trainingen in het klachtvenster — echte plandata.
    const windowWorkouts = await db
      .select({
        status: plannedWorkoutsTable.status,
        scheduledDate: plannedWorkoutsTable.scheduledDate,
      })
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, clerkId),
          gte(plannedWorkoutsTable.scheduledDate, c.startDate),
        ),
      );
    const inWindow = windowWorkouts.filter((w) => w.scheduledDate <= endStr);
    const missed = inWindow.filter((w) => w.status === "missed").length;
    const adjusted = inWindow.filter(
      (w) => w.status === "modified" || w.status === "adjusted",
    ).length;
    out.push({
      complaint: c,
      updates: updates.filter((u) => u.complaintId === c.id),
      durationDays: c.resolvedAt ? daysBetween(c.startDate, c.resolvedAt) : null,
      missedWorkouts: missed,
      adjustedWorkouts: adjusted,
      resumedAt: c.resumptionConfirmedAt
        ? c.resumptionConfirmedAt.toISOString()
        : null,
    });
  }
  return out;
}

// ── Contextuele check-in (punt 1) ────────────────────────────────────────────

export interface CheckinContext {
  /** Vragen die vandaag zinvol zijn (rest is overslaan/optioneel). */
  ask: string[];
  /** Vandaag al ingevuld? */
  doneToday: boolean;
  /** Actieve klacht ⇒ ziekte-/pijnvraag vervangen door opvolgvraag. */
  hasActiveComplaint: boolean;
}

export async function getCheckinContext(
  clerkId: string,
): Promise<CheckinContext> {
  const today = localDateStr(new Date());
  const threeAgo = localDateStr(new Date(Date.now() - 3 * 86_400_000));
  const [todayMetric] = await db
    .select()
    .from(athleteDailyMetricsTable)
    .where(
      and(
        eq(athleteDailyMetricsTable.clerkId, clerkId),
        eq(athleteDailyMetricsTable.metricDate, today),
      ),
    )
    .limit(1);
  const recent = await db
    .select()
    .from(athleteDailyMetricsTable)
    .where(
      and(
        eq(athleteDailyMetricsTable.clerkId, clerkId),
        gte(athleteDailyMetricsTable.metricDate, threeAgo),
      ),
    )
    .orderBy(desc(athleteDailyMetricsTable.metricDate));
  const active = await db
    .select({ id: healthComplaintsTable.id })
    .from(healthComplaintsTable)
    .where(
      and(
        eq(healthComplaintsTable.clerkId, clerkId),
        ne(healthComplaintsTable.status, "hersteld"),
      ),
    )
    .limit(1);

  const ask: string[] = [];
  const t = todayMetric;
  // Kernvragen: alleen wat vandaag nog ontbreekt.
  if (!t || t.feelScore == null) ask.push("feelScore");
  if (!t || t.fatigueScore == null) ask.push("fatigueScore");
  if (!t || t.sleepQuality == null) ask.push("sleepQuality");
  if (!t || t.sorenessScore == null) ask.push("sorenessScore");
  if (!t || t.stressScore == null) ask.push("stressScore");
  // HRV/rusthartslag alleen vragen als de sporter die weleens invult
  // (anders is het ruis) én er de laatste 3 dagen niets is.
  const usesHrv = recent.some((m) => m.hrv != null);
  const usesRhr = recent.some((m) => m.restingHR != null);
  if (usesHrv && (!t || t.hrv == null)) ask.push("hrv");
  if (usesRhr && (!t || t.restingHR == null)) ask.push("restingHR");
  // Ziekte-/pijnvraag alleen zonder actieve klacht (anders opvolgen, niet
  // opnieuw uitvragen).
  const hasActiveComplaint = active.length > 0;
  if (!hasActiveComplaint) ask.push("healthFlag");

  const doneToday =
    !!t &&
    (t.feelScore != null || t.fatigueScore != null || t.sleepQuality != null);
  return { ask, doneToday, hasActiveComplaint };
}
