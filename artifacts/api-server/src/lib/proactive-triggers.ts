// AI_COACH_KOPPELING_EN_GEHEUGEN_01 §4.2 — Proactieve coach-triggers.
//
// Zes deterministische checks (geen AI-detectie) die Sparki uit zichzelf een
// gesprek laten openen. Per treffer: één coachboodschap met dossier (§R3) en
// een geheugengebeurtenis ("proactive_trigger_shown").
//
// Pacing-regels (§4.2 + aandachtswet):
//  1. Nooit op dezelfde Amsterdam-dag als de §4.1-bevestigingsvraag.
//  2. Triggers dedupliceren per episode (zie onderstaande tabel), niet alleen per dag.
//  3. Privacy-poort: ai_memory_enabled moet aan staan (anders stille null).
//
// Geheugen-contract (§4.1 × §4.2):
//  - Triggers T3 en T5 VEREISEN een `bevestigde` herinnering (status="bevestigd").
//    Zonder bevestigde herinnering vuren ze niet.
//  - Triggers T1, T2, T4 en T6 zijn data-gedreven (geen geheugen vereist),
//    maar formuleren hun boodschap ALTIJD als observatie of vraag — nooit als
//    directief advies. Zo draagt geen trigger een ongefundeerde conclusie.
//
// Dedupliciatie per episode:
//  T1  per kalenderdag (belastingpiek kan elke dag opnieuw gelden)
//  T2  per race-ID (één keer per wedstrijd, niet dagelijks herhaald)
//  T3  per kalenderdag (één melding per herinnering per dag)
//  T4  per jaar-start (eerste hete dag dit seizoen)
//  T5  per kalenderdag (één melding per dag)
//  T6  per terugkeerdatum (één keer per terugkeer-episode)
//
// Starttriggers (René levert uitbreidingen aan via hetzelfde contract):
//  T1  derde_harde_dag       — 3 opeenvolgende dagen TSS boven het gemiddelde
//  T2  eerste_wedstrijd      — eerste wedstrijd na een trainingsblok (≥5 sess/14d); per race eenmalig
//  T3  zelfde_week_inzinking — dezelfde kalenderweek als een eerder BEVESTIGDE negatieve observatie
//  T4  eerste_rit_hitte      — eerste dag met verwachte max ≥ 28°C dit seizoen + aantoonbaar actief
//  T5  afwijkend_signaal     — HR/gevoel wijkt af + BEVESTIGDE patroon-herinnering aanwezig
//  T6  terugkeer_pauze       — eerste activiteit na een onderbreking van > 10 dagen

import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  trainingSessionsTable,
  athleteDailyMetricsTable,
  aiObservationsTable,
  aiMemoryEventsTable,
  racesTable,
} from "@workspace/db";
import type { AdviceDossierRow } from "@workspace/db";
import { getEffectivePrivacy } from "./privacy";
import { maakCoachDossier } from "./coach-dossier";
import { recordMemoryEvent } from "./ai-memory";
import { getHomeWeather } from "./weather/home";

// ── Hulpfuncties ─────────────────────────────────────────────────────────────

/** Amsterdam-dag als YYYY-MM-DD */
export function todayAms(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
}

/** ISO-weeknummer 1–53 voor een YYYY-MM-DD string */
export function isoWeek(ymd: string): number {
  const d = new Date(`${ymd}T12:00:00Z`);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const weekStart = new Date(jan4.getTime() - (jan4Day - 1) * 86_400_000);
  return Math.ceil((d.getTime() - weekStart.getTime()) / (7 * 86_400_000)) + 1;
}

/** Voeg N dagen toe aan een YYYY-MM-DD string */
export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Output-type ───────────────────────────────────────────────────────────────

export type TriggerFire = {
  triggerId: string;
  title: string;
  /**
   * Data-gedreven triggers (T1/T2/T4/T6): altijd als vraag of observatie.
   * Geheugen-gedreven triggers (T3/T5): bevat de bevestigde herinnering.
   */
  message: string;
  memoryObservationId: number | null;
  dossierId: number;
};

// ── Pacing- en episode-guards ─────────────────────────────────────────────────

async function confirmQuestionShownToday(clerkId: string): Promise<boolean> {
  const today = todayAms();
  const rows = await db
    .select({ id: aiMemoryEventsTable.id })
    .from(aiMemoryEventsTable)
    .where(
      and(
        eq(aiMemoryEventsTable.clerkId, clerkId),
        eq(aiMemoryEventsTable.eventType, "confirm_question_shown"),
        gte(
          sql`${aiMemoryEventsTable.createdAt} at time zone 'Europe/Amsterdam'`,
          sql`${today}::date`,
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Per-dag dedup voor triggers zonder eigen episode-sleutel (T1, T3, T5). */
async function triggerAlreadyFiredToday(clerkId: string, triggerId: string): Promise<boolean> {
  const today = todayAms();
  const rows = await db
    .select({ id: aiMemoryEventsTable.id })
    .from(aiMemoryEventsTable)
    .where(
      and(
        eq(aiMemoryEventsTable.clerkId, clerkId),
        eq(aiMemoryEventsTable.eventType, "proactive_trigger_shown"),
        gte(
          sql`${aiMemoryEventsTable.createdAt} at time zone 'Europe/Amsterdam'`,
          sql`${today}::date`,
        ),
        sql`${aiMemoryEventsTable.metadata}->>'triggerId' = ${triggerId}`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** T2-dedup: per race-ID — voorkomt dat dezelfde wedstrijd elke dag opnieuw vuur t. */
async function triggerAlreadyFiredForRace(clerkId: string, raceId: number): Promise<boolean> {
  const rows = await db
    .select({ id: aiMemoryEventsTable.id })
    .from(aiMemoryEventsTable)
    .where(
      and(
        eq(aiMemoryEventsTable.clerkId, clerkId),
        eq(aiMemoryEventsTable.eventType, "proactive_trigger_shown"),
        sql`${aiMemoryEventsTable.metadata}->>'triggerId' = ${"eerste_wedstrijd_na_blok"}`,
        sql`${aiMemoryEventsTable.metadata}->>'raceId' = ${String(raceId)}`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** T6-dedup: per terugkeerdatum — voorkomt dat dezelfde terugkeer-episode elke dag vuur t. */
async function triggerAlreadyFiredForReturn(
  clerkId: string,
  returnDate: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: aiMemoryEventsTable.id })
    .from(aiMemoryEventsTable)
    .where(
      and(
        eq(aiMemoryEventsTable.clerkId, clerkId),
        eq(aiMemoryEventsTable.eventType, "proactive_trigger_shown"),
        sql`${aiMemoryEventsTable.metadata}->>'triggerId' = ${"terugkeer_pauze"}`,
        sql`${aiMemoryEventsTable.metadata}->>'returnDate' = ${returnDate}`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// ── Dossier + event ───────────────────────────────────────────────────────────

async function fireTrigger(
  clerkId: string,
  triggerId: string,
  title: string,
  message: string,
  memoryObservationId: number | null,
  whyAlternativeRejected: string,
  extraMetadata?: Record<string, unknown>,
): Promise<TriggerFire> {
  const dossier: AdviceDossierRow = await maakCoachDossier({
    clerkId,
    adviceType: "coach_signaal",
    adviceKey: `proactive:${triggerId}:${todayAms()}`,
    title,
    adviceText: message,
    aiPurpose: "proactieve trigger §4.2",
    whyAlternativeRejected,
    alternativesConsidered: [
      { option: "Geen actie — sporter zelf laten ontdekken" },
    ],
    risks: [
      {
        risk:
          "Data-gedreven triggers zijn observaties/vragen, geen diagnoses — de sporter beslist zelf.",
      },
    ],
    extraRules: [
      `proactive-trigger:${triggerId}`,
      memoryObservationId != null
        ? `geheugen-contract:bevestigde-herinnering-aangehecht`
        : `geheugen-contract:data-gedreven-vraag`,
    ],
    ...(memoryObservationId != null
      ? {
          extraBasedOn: [
            {
              kind: "herinnering" as const,
              label: "bevestigde herinnering (§4.1)",
              value: `observatie #${memoryObservationId}`,
              date: todayAms(),
            },
          ],
        }
      : {}),
  });

  await recordMemoryEvent(clerkId, "proactive_trigger_shown", memoryObservationId, {
    triggerId,
    title,
    dossierId: dossier.id,
    firedAt: todayAms(),
    ...extraMetadata,
  });

  return {
    triggerId,
    title,
    message,
    memoryObservationId,
    dossierId: dossier.id,
  };
}

// ── T1: derde opeenvolgende dag met belasting boven het gemiddelde ────────────
// Data-gedreven — formulering als VRAAG (geen directief advies).
// Dedup: per kalenderdag.

export function checkDerdeHardeDagLogic(
  sessions: { sessionDate: string; tss: string | number | null }[],
  today: string,
): Omit<TriggerFire, "dossierId"> | null {
  if (sessions.length < 5) return null;

  const dag1 = addDays(today, -2);
  // 28-daags rollend gemiddelde, exclusief de laatste 3 dagen
  const recent28 = sessions
    .filter((s) => s.sessionDate >= addDays(today, -28) && s.sessionDate < dag1)
    .map((s) => (s.tss != null ? Number(s.tss) : 0));
  if (recent28.length < 5) return null;
  const avg28 = recent28.reduce((a, b) => a + b, 0) / recent28.length;
  if (avg28 < 5) return null;

  const dag2 = addDays(today, -1);
  const byDate = new Map(sessions.map((s) => [s.sessionDate, Number(s.tss ?? 0)]));
  const tss1 = byDate.get(dag1) ?? 0;
  const tss2 = byDate.get(dag2) ?? 0;
  const tss3 = byDate.get(today) ?? 0;

  if (tss1 <= avg28 || tss2 <= avg28 || tss3 <= avg28) return null;

  return {
    triggerId: "derde_harde_dag",
    title: "Derde zware dag op rij",
    message: `De afgelopen drie dagen lag je belasting steeds boven je gemiddelde (gem. ${Math.round(avg28)} TSS/dag). Wil je dag drie lichter aanpakken?`,
    memoryObservationId: null,
  };
}

// ── T2: eerste wedstrijd na een trainingsblok ─────────────────────────────────
// Data-gedreven — formulering als INFO + VRAAG.
// Dedup: per race-ID (eenmalig per wedstrijd).
// Extra check: er was geen andere wedstrijd tijdens de trainingsblok.

export function checkEersteWedstrijdLogic(
  sessions: { sessionDate: string; tss: string | number | null }[],
  nextRace: { id: number; name: string; raceDate: string } | null,
  pastRaces: { id: number; raceDate: string }[], // wedstrijden in de afgelopen 14 dagen
  today: string,
): (Omit<TriggerFire, "dossierId"> & { raceId: number }) | null {
  if (!nextRace) return null;
  const raceDays = Math.round(
    (new Date(`${nextRace.raceDate}T12:00:00Z`).getTime() -
      new Date(`${today}T12:00:00Z`).getTime()) /
      86_400_000,
  );
  if (raceDays > 7 || raceDays < 0) return null;

  const cutoff = addDays(today, -14);

  // Controleer trainingsblok: ≥5 sessies in de afgelopen 14 dagen
  const recentSessions = sessions.filter(
    (s) => s.sessionDate >= cutoff && s.sessionDate <= today,
  );
  if (recentSessions.length < 5) return null;

  // Controleer dat er GEEN andere wedstrijd was tijdens dit blok
  // (zodat "eerste wedstrijd" echt de eerste is, niet een herhaling)
  const racesDuringBlock = pastRaces.filter(
    (r) => r.raceDate >= cutoff && r.raceDate < today,
  );
  if (racesDuringBlock.length > 0) return null;

  const dagen = raceDays === 0 ? "vandaag" : raceDays === 1 ? "morgen" : `over ${raceDays} dagen`;
  return {
    triggerId: "eerste_wedstrijd_na_blok",
    title: "Wedstrijd na trainingsblok",
    message: `${nextRace.name} is ${dagen}. Je hebt de afgelopen twee weken getraind (${recentSessions.length} sessies). Hoe is je herstel?`,
    memoryObservationId: null,
    raceId: nextRace.id,
  };
}

// ── T3: dezelfde kalenderweek als een eerder ingezakte periode ────────────────
// VEREIST een `bevestigd` observatie uit eerdere jaren in dezelfde week.
// Dedup: per kalenderdag.

export function checkZelfdeWeekInzinkingLogic(
  observations: {
    id: number;
    createdAt: Date | null;
    category: string;
    severity: string;
    status: string;
    title: string;
    detectedPattern: string | null;
  }[],
  today: string,
): Omit<TriggerFire, "dossierId"> | null {
  const weekNow = isoWeek(today);
  const yearNow = Number(today.slice(0, 4));

  const historische = observations.filter((obs) => {
    if (obs.status !== "bevestigd") return false; // harde poort
    if (!obs.createdAt) return false;
    const obsDate = obs.createdAt.toISOString().slice(0, 10);
    const obsYear = Number(obsDate.slice(0, 4));
    if (obsYear >= yearNow) return false;
    if (yearNow - obsYear > 3) return false;
    const obsWeek = isoWeek(obsDate);
    if (Math.abs(obsWeek - weekNow) > 1) return false;
    if (!["watch", "important", "urgent"].includes(obs.severity)) return false;
    if (!["training", "recovery", "health"].includes(obs.category)) return false;
    return true;
  });

  if (historische.length === 0) return null;

  const best = historische.sort((a, b) => {
    const sev = { urgent: 3, important: 2, watch: 1 };
    return (
      (sev[b.severity as keyof typeof sev] ?? 0) -
      (sev[a.severity as keyof typeof sev] ?? 0)
    );
  })[0]!;

  const jaar = best.createdAt ? new Date(best.createdAt).getFullYear() : "eerder";
  return {
    triggerId: "zelfde_week_inzinking",
    title: "Herinnering aan vorig jaar",
    message: `In week ${weekNow} van ${jaar} was er een aandachtspunt dat je zelf bevestigde: "${best.title}". Herken je dit patroon dit jaar ook?`,
    memoryObservationId: best.id,
  };
}

// ── T4: eerste rit boven 28 graden dit seizoen ───────────────────────────────
// Data-gedreven (weer) — formulering als OBSERVATIE.
// Vereist: (1) hete dag-forecast, (2) sporter is aantoonbaar actief (sessie in de afgelopen 3 dagen).
// Dedup: per seizoen (jaar-start).

async function checkEersteRitHitte(
  clerkId: string,
  homeLat: string | null,
  homeLon: string | null,
  recentSessions: { sessionDate: string }[],
  today: string,
): Promise<Omit<TriggerFire, "dossierId"> | null> {
  // Vereiste: sporter is actief (sessie in de afgelopen 3 dagen)
  // Zonder recente activiteit heeft de hittewaarschuwing geen relevantie.
  const activeWindow = addDays(today, -3);
  const isActief = recentSessions.some(
    (s) => s.sessionDate >= activeWindow && s.sessionDate <= today,
  );
  if (!isActief) return null;

  // Controleer of de trigger dit jaar al eerder gevuurd heeft
  const jaarStart = `${today.slice(0, 4)}-01-01`;
  const alVroeger = await db
    .select({ id: aiMemoryEventsTable.id })
    .from(aiMemoryEventsTable)
    .where(
      and(
        eq(aiMemoryEventsTable.clerkId, clerkId),
        eq(aiMemoryEventsTable.eventType, "proactive_trigger_shown"),
        gte(aiMemoryEventsTable.createdAt, new Date(`${jaarStart}T00:00:00Z`)),
        sql`${aiMemoryEventsTable.metadata}->>'triggerId' = ${"eerste_rit_hitte"}`,
      ),
    )
    .limit(1);
  if (alVroeger.length > 0) return null;

  const weather = await getHomeWeather(homeLat, homeLon, null).catch(() => null);
  if (!weather?.todayForecast) return null;
  const maxTemp = weather.todayForecast.tempMaxC;
  if (maxTemp == null || maxTemp < 28) return null;

  return {
    triggerId: "eerste_rit_hitte",
    title: "Eerste warme dag dit seizoen",
    message: `Vandaag kan het ${Math.round(maxTemp)}°C worden — voor het eerst boven de 28 graden dit jaar. Houd daar rekening mee als je buiten fietst.`,
    memoryObservationId: null,
  };
}

// ── T5: rusthartslag of gevoel wijkt af met BEVESTIGDE patroon-herinnering ───
// VEREIST een `bevestigd` observatie. Zonder vuur t T5 niet.
// Dedup: per kalenderdag.

export function checkAfwijkendSignaalLogic(
  metrics: { metricDate: string; restingHR: number | null; feelScore: number | null }[],
  observations: {
    id: number;
    category: string;
    severity: string;
    status: string;
    detectedPattern: string | null;
  }[],
  today: string,
): Omit<TriggerFire, "dossierId"> | null {
  const todayMetric = metrics.find((m) => m.metricDate === today);
  if (!todayMetric) return null;

  const vorige = metrics.filter((m) => m.metricDate < today);
  if (vorige.length < 5) return null;

  let hrAfwijking = false;
  if (todayMetric.restingHR != null) {
    const hrWaarden = vorige.map((m) => m.restingHR).filter((v): v is number => v != null);
    if (hrWaarden.length >= 5) {
      const gem = hrWaarden.reduce((a, b) => a + b, 0) / hrWaarden.length;
      hrAfwijking = todayMetric.restingHR > gem * 1.1;
    }
  }

  const slechteFeeling = todayMetric.feelScore != null && todayMetric.feelScore <= 3;

  if (!hrAfwijking && !slechteFeeling) return null;

  // Harde poort: alleen vuren als er een BEVESTIGDE herinnering bij past.
  const relevantObs = observations.find(
    (o) =>
      o.status === "bevestigd" &&
      ["recovery", "health", "training"].includes(o.category) &&
      o.detectedPattern != null,
  );
  if (!relevantObs) return null;

  const why = hrAfwijking
    ? "Je rusthartslag is vandaag hoger dan normaal"
    : "Je gevoel scoort vandaag laag";

  return {
    triggerId: "afwijkend_signaal",
    title: "Signaal dat aandacht vraagt",
    message: `${why}. Je hebt eerder het patroon bevestigd: "${relevantObs.detectedPattern}". Herken je dit signaal?`,
    memoryObservationId: relevantObs.id,
  };
}

// ── T6: terugkeer na meer dan 10 dagen zonder activiteit ─────────────────────
// Data-gedreven — vuurt ALLEEN bij de eerste activiteit na de pauze (geen inactiviteit-alarm).
// Dedup: per terugkeerdatum (returnDate) — zo vuur t dezelfde terugkeer maar één keer.
//
// Correcte detectie: scant ALLE sessies in de afgelopen twee dagen op een
// >10-daagse kloof vóórdat ze. Chronologisch oudste wordt als returnDate gebruikt
// zodat "gisteren teruggekeerd + vandaag opnieuw gereden" niet gemist wordt.

export function checkTerugkeerLogic(
  sessions: { sessionDate: string }[],
  today: string,
): (Omit<TriggerFire, "dossierId"> & { returnDate: string }) | null {
  if (sessions.length < 4) return null;

  // Aflopend gesorteerd (nieuwste eerst) — klaar voor gap-detectie
  const gesorteerd = [...sessions].sort((a, b) =>
    b.sessionDate.localeCompare(a.sessionDate),
  );

  // Kandidaten: alle sessies van gisteren of vandaag (mogelijke terugkeer-momenten)
  const kandidaten = gesorteerd
    .filter((s) => s.sessionDate >= addDays(today, -1) && s.sessionDate <= today)
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)); // oplopend = oudste kandidaat eerst

  if (kandidaten.length === 0) return null;

  // Zoek de oudste kandidaat die een >10-daagse kloof heeft vóór zich
  // ("vóór zich" = de laatste sessie met een vroegere datum dan de kandidaat)
  for (const kandidaat of kandidaten) {
    const vorigeSessies = gesorteerd.filter((s) => s.sessionDate < kandidaat.sessionDate);
    if (vorigeSessies.length < 3) continue; // te weinig sessies vóór de terugkeer

    const vorigeSessie = vorigeSessies[0]!; // meest recente sessie vóór de terugkeer
    const dagsSinceLast = Math.round(
      (new Date(`${kandidaat.sessionDate}T12:00:00Z`).getTime() -
        new Date(`${vorigeSessie.sessionDate}T12:00:00Z`).getTime()) /
        86_400_000,
    );

    if (dagsSinceLast > 10) {
      return {
        triggerId: "terugkeer_pauze",
        title: `Terug na ${dagsSinceLast} dagen`,
        message: `Je was ${dagsSinceLast} dagen niet actief. Hoe voel je je voor je eerste training terug?`,
        memoryObservationId: null,
        returnDate: kandidaat.sessionDate, // de datum van de terugkeer-sessie
      };
    }
  }

  return null;
}

// ── Hoofdfunctie ──────────────────────────────────────────────────────────────

/**
 * Controleert alle proactieve triggers en geeft de eerste treffer terug.
 * Maakt een coach-dossier aan voor de boodschap en registreert de vuuring.
 * Geeft null terug als: privacy uit, pacing blokkeert, of geen trigger voldoet.
 */
export async function checkProactiveTriggers(clerkId: string): Promise<TriggerFire | null> {
  // Privacy-poort
  const privacy = await getEffectivePrivacy(clerkId);
  if (!privacy.aiMemoryEnabled) return null;

  // Pacing: nooit op dezelfde dag als de §4.1-bevestigingsvraag
  const confirmToday = await confirmQuestionShownToday(clerkId);
  if (confirmToday) return null;

  const today = todayAms();
  const cutoff60 = addDays(today, -60);
  const cutoff14 = addDays(today, -14);

  const [sessions, metrics, observations, nextRaceRows, pastRaceRows, profileRows] =
    await Promise.all([
      db
        .select({
          sessionDate: trainingSessionsTable.sessionDate,
          tss: trainingSessionsTable.tss,
        })
        .from(trainingSessionsTable)
        .where(
          and(
            eq(trainingSessionsTable.clerkId, clerkId),
            gte(trainingSessionsTable.sessionDate, cutoff60),
          ),
        )
        .orderBy(desc(trainingSessionsTable.sessionDate))
        .limit(60),
      db
        .select({
          metricDate: athleteDailyMetricsTable.metricDate,
          restingHR: athleteDailyMetricsTable.restingHR,
          feelScore: athleteDailyMetricsTable.feelScore,
        })
        .from(athleteDailyMetricsTable)
        .where(
          and(
            eq(athleteDailyMetricsTable.clerkId, clerkId),
            gte(athleteDailyMetricsTable.metricDate, cutoff14),
          ),
        )
        .orderBy(desc(athleteDailyMetricsTable.metricDate)),
      db
        .select({
          id: aiObservationsTable.id,
          createdAt: aiObservationsTable.createdAt,
          category: aiObservationsTable.category,
          severity: aiObservationsTable.severity,
          status: aiObservationsTable.status,
          title: aiObservationsTable.title,
          detectedPattern: aiObservationsTable.detectedPattern,
        })
        .from(aiObservationsTable)
        .where(
          and(
            eq(aiObservationsTable.clerkId, clerkId),
            inArray(aiObservationsTable.status, [
              "bevestigd",
              "new",
              "acknowledged",
              "saved",
            ]),
          ),
        )
        .orderBy(desc(aiObservationsTable.createdAt))
        .limit(50),
      // Aanstaande wedstrijd (binnen 7 dagen)
      db
        .select({
          id: racesTable.id,
          name: racesTable.name,
          raceDate: racesTable.raceDate,
        })
        .from(racesTable)
        .where(
          and(
            eq(racesTable.clerkId, clerkId),
            gte(racesTable.raceDate, today),
            lte(racesTable.raceDate, addDays(today, 7)),
          ),
        )
        .orderBy(asc(racesTable.raceDate))
        .limit(1),
      // Wedstrijden in de afgelopen 14 dagen (voor T2-controle "eerste wedstrijd")
      db
        .select({
          id: racesTable.id,
          raceDate: racesTable.raceDate,
        })
        .from(racesTable)
        .where(
          and(
            eq(racesTable.clerkId, clerkId),
            gte(racesTable.raceDate, cutoff14),
            lte(racesTable.raceDate, today),
          ),
        ),
      db
        .select({
          homeLat: athleteProfilesTable.homeLat,
          homeLon: athleteProfilesTable.homeLon,
        })
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, clerkId))
        .limit(1),
    ]);

  const profile = profileRows[0] ?? null;
  const nextRace = nextRaceRows[0] ?? null;

  // ── Evalueer triggers ────────────────────────────────────────────────────

  // T1: derde harde dag — per dag-dedup
  {
    const candidate = checkDerdeHardeDagLogic(sessions, today);
    if (candidate) {
      const alGevuurd = await triggerAlreadyFiredToday(clerkId, "derde_harde_dag");
      if (!alGevuurd) {
        return fireTrigger(
          clerkId,
          candidate.triggerId,
          candidate.title,
          candidate.message,
          candidate.memoryObservationId,
          "Sporter houdt zelf de belasting bij",
        );
      }
    }
  }

  // T5: afwijkend signaal + bevestigde herinnering — per dag-dedup
  {
    const candidate = checkAfwijkendSignaalLogic(metrics, observations, today);
    if (candidate) {
      const alGevuurd = await triggerAlreadyFiredToday(clerkId, "afwijkend_signaal");
      if (!alGevuurd) {
        return fireTrigger(
          clerkId,
          candidate.triggerId,
          candidate.title,
          candidate.message,
          candidate.memoryObservationId,
          "Dagelijkse variatie is normaal",
        );
      }
    }
  }

  // T6: terugkeer na pauze — per terugkeerdatum-dedup
  {
    const candidate = checkTerugkeerLogic(sessions, today);
    if (candidate) {
      const alGevuurd = await triggerAlreadyFiredForReturn(clerkId, candidate.returnDate);
      if (!alGevuurd) {
        return fireTrigger(
          clerkId,
          candidate.triggerId,
          candidate.title,
          candidate.message,
          candidate.memoryObservationId,
          "Sporter weet zelf dat hij/zij terugkeert",
          { returnDate: candidate.returnDate },
        );
      }
    }
  }

  // T2: eerste wedstrijd na blok — per race-ID-dedup
  {
    const candidate = checkEersteWedstrijdLogic(sessions, nextRace, pastRaceRows, today);
    if (candidate) {
      const alGevuurd = await triggerAlreadyFiredForRace(clerkId, candidate.raceId);
      if (!alGevuurd) {
        return fireTrigger(
          clerkId,
          candidate.triggerId,
          candidate.title,
          candidate.message,
          candidate.memoryObservationId,
          "Sporter plant zelf de tapering",
          { raceId: String(candidate.raceId) },
        );
      }
    }
  }

  // T3: zelfde week inzinking — per dag-dedup
  {
    const candidate = checkZelfdeWeekInzinkingLogic(observations, today);
    if (candidate) {
      const alGevuurd = await triggerAlreadyFiredToday(clerkId, "zelfde_week_inzinking");
      if (!alGevuurd) {
        return fireTrigger(
          clerkId,
          candidate.triggerId,
          candidate.title,
          candidate.message,
          candidate.memoryObservationId,
          "Historisch patroon is toeval — directe interventie gaat te ver",
        );
      }
    }
  }

  // T4: eerste rit hitte — asynchroon (weeroproep), seizoens-dedup zit in de functie
  {
    const candidate = await checkEersteRitHitte(
      clerkId,
      profile?.homeLat != null ? String(profile.homeLat) : null,
      profile?.homeLon != null ? String(profile.homeLon) : null,
      sessions,
      today,
    );
    if (candidate) {
      return fireTrigger(
        clerkId,
        candidate.triggerId,
        candidate.title,
        candidate.message,
        candidate.memoryObservationId,
        "Sporter is al gewend aan warmte",
      );
    }
  }

  return null;
}
