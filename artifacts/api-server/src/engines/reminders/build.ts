// Build the set of genuinely-due reminders for one athlete at a given moment.
//
// Honesty contract: every item here corresponds to REAL, due data — a real
// missing evening check-in, a real open follow-up question Sparki raised, a real
// planned workout for tomorrow, a real upcoming race. Nothing is fabricated; if
// there is nothing due, the list is empty.
//
// Each item carries a stable `dedupeKey` so the delivery job creates/sends it at
// most once (idempotency lives in the notifications unique index).

import { and, eq, gte, lte, ne } from "drizzle-orm";
import {
  db,
  athleteDailyMetricsTable,
  athleteProfilesTable,
  plannedWorkoutsTable,
  racesTable,
  type NotificationType,
  type ReminderKind,
} from "@workspace/db";
import { runCoachAnalysis } from "../observation";
import {
  deriveEngagement,
  findWhatsNew,
  amsterdamHour,
  amsterdamYmd,
} from "../engagement";

export type ReminderItem = {
  kind: ReminderKind;
  type: NotificationType;
  dedupeKey: string;
  // In-app title/body — MOGEN specifiek blijven (staan alleen in de app achter
  // de eigen sessie van de gebruiker).
  title: string;
  body: string;
  // F12 (NOT-03): NEUTRALE push/e-mail-payload. Geen trainings-title/description,
  // geen wedstrijdnaam/locatie, geen item-titels, geen bestandsnamen,
  // gezondheids-/prestatiegetallen of naam van een minderjarige. De actionUrl
  // brengt de gebruiker in de juiste context waar de details wél staan.
  pushTitle: string;
  pushBody: string;
  emailSubject: string;
  // Neutrale e-mail-body (zelfde inhoudsregel als de push).
  emailBody: string;
  actionUrl: string;
};

// Local YYYY-MM-DD for a date (server tz). Dates in DB are plain dates.
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function dutchDate(iso: string): string {
  const [y, m, day] = iso.split("-").map((n) => Number(n));
  const months = [
    "januari", "februari", "maart", "april", "mei", "juni",
    "juli", "augustus", "september", "oktober", "november", "december",
  ];
  return `${day} ${months[(m ?? 1) - 1]} ${y}`;
}

// Evening check-in: due in the evening when no daily metric exists for today.
async function checkInItem(
  clerkId: string,
  now: Date,
): Promise<ReminderItem | null> {
  // Only an *evening* reminder makes sense for a daily check-in.
  if (now.getHours() < 17) return null;
  const today = isoDate(now);
  const [row] = await db
    .select({ id: athleteDailyMetricsTable.id })
    .from(athleteDailyMetricsTable)
    .where(
      and(
        eq(athleteDailyMetricsTable.clerkId, clerkId),
        eq(athleteDailyMetricsTable.metricDate, today),
      ),
    )
    .limit(1);
  if (row) return null; // already checked in today
  return {
    kind: "checkins",
    type: "checkin_reminder",
    dedupeKey: `reminder:checkin:${today}`,
    title: "Hoe voel je je vandaag?",
    body: "Je avond-check-in ontbreekt nog. Een korte check-in (fris / oké / vermoeid) helpt je advies voor morgen scherp te krijgen.",
    // Neutraal: geen gezondheids-/gemoedsinhoud in de push.
    pushTitle: "Hoe voel je je vandaag?",
    pushBody: "Je avond-check-in staat klaar — open de app om 'm in te vullen.",
    emailSubject: "Hoe voel je je vandaag?",
    emailBody: "Je avond-check-in staat klaar — open de app om 'm in te vullen.",
    actionUrl: "/",
  };
}

// Open follow-up questions Sparki raised today and the athlete hasn't answered.
async function followUpItem(clerkId: string): Promise<ReminderItem | null> {
  let open = 0;
  let analysisDate = "";
  try {
    const analysis = await runCoachAnalysis(clerkId);
    open = analysis.followUps.length;
    analysisDate = analysis.date;
  } catch {
    return null; // never fabricate a question if the analysis can't run
  }
  if (open === 0) return null;
  const plural = open === 1 ? "een vraag" : `${open} vragen`;
  return {
    kind: "followups",
    type: "followup_question",
    dedupeKey: `reminder:followup:${analysisDate}`,
    title: open === 1 ? "Er staat een vraag voor je open" : "Er staan een paar vragen open",
    body: `Er ${open === 1 ? "staat" : "staan"} ${plural} open om je advies preciezer te maken. Beantwoord ${open === 1 ? "die" : "ze"} kort in de app.`,
    // Neutraal: geen aantal of inhoud van de vragen in de push.
    pushTitle: "Er staat een vraag voor je open",
    pushBody: "Open de app om je openstaande vraag te beantwoorden.",
    emailSubject: "Er staat een vraag voor je open",
    emailBody: "Open de app om je openstaande vraag te beantwoorden.",
    actionUrl: "/",
  };
}

// Planned workouts scheduled for tomorrow (the day-before reminder).
async function trainingItems(
  clerkId: string,
  now: Date,
): Promise<ReminderItem[]> {
  const tomorrow = isoDate(addDays(now, 1));
  const rows = await db
    .select({
      id: plannedWorkoutsTable.id,
      title: plannedWorkoutsTable.title,
      description: plannedWorkoutsTable.description,
      scheduledDate: plannedWorkoutsTable.scheduledDate,
    })
    .from(plannedWorkoutsTable)
    .where(
      and(
        eq(plannedWorkoutsTable.clerkId, clerkId),
        eq(plannedWorkoutsTable.scheduledDate, tomorrow),
        eq(plannedWorkoutsTable.status, "planned"),
      ),
    );
  return rows.map((r) => ({
    kind: "training" as const,
    type: "training_reminder" as NotificationType,
    dedupeKey: `reminder:training:${r.id}`,
    // In-app mag de titel/omschrijving wél tonen.
    title: `Morgen op het programma: ${r.title}`,
    body: r.description
      ? `Morgen staat "${r.title}" gepland. ${r.description}`
      : `Morgen staat "${r.title}" gepland. Bekijk de details in de app.`,
    // NOT-03: geen trainings-titel/omschrijving in push/e-mail.
    pushTitle: "Je training van vandaag staat klaar",
    pushBody: "Bekijk je programma in de app.",
    emailSubject: "Je training staat klaar",
    emailBody: "Bekijk je programma voor morgen in de app.",
    actionUrl: "/train",
  }));
}

// Races within the next 3 days (a single reminder per race).
async function raceItems(clerkId: string, now: Date): Promise<ReminderItem[]> {
  const today = isoDate(now);
  const horizon = isoDate(addDays(now, 3));
  const rows = await db
    .select({
      id: racesTable.id,
      name: racesTable.name,
      raceDate: racesTable.raceDate,
      location: racesTable.location,
    })
    .from(racesTable)
    .where(
      and(
        eq(racesTable.clerkId, clerkId),
        gte(racesTable.raceDate, today),
        lte(racesTable.raceDate, horizon),
        // Geen herinneringen voor geannuleerde wedstrijden.
        ne(racesTable.status, "geannuleerd"),
      ),
    );
  return rows.map((r) => {
    const where = r.location ? ` in ${r.location}` : "";
    return {
      kind: "races" as const,
      type: "race_reminder" as NotificationType,
      dedupeKey: `reminder:race:${r.id}`,
      // In-app mag naam/locatie/datum wél tonen.
      title: `Binnenkort: ${r.name}`,
      body: `Je wedstrijd "${r.name}"${where} is op ${dutchDate(r.raceDate)}. In de app vind je hulp bij de voorbereiding.`,
      // NOT-03: geen wedstrijdnaam/locatie in push/e-mail.
      pushTitle: "Je hebt binnenkort een wedstrijd",
      pushBody: "Bekijk je voorbereiding in de app.",
      emailSubject: "Je hebt binnenkort een wedstrijd",
      emailBody: "Bekijk je voorbereiding in de app.",
      actionUrl: "/races",
    };
  });
}

// ISO-8601 week bucket ("2026-W26") — the dedupe window for profile nudges. One
// nudge per missing field per week: it persists (re-nudges) until the field is
// filled, then the engine moves on to the next genuinely-missing field.
function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// One core profile field that is genuinely missing — in priority order, the most
// valuable one first. Each carries the focused deep link that opens exactly that
// one question in the app (a push can never hold an input field itself).
type ProfileField = {
  id: string;
  title: string;
  body: string;
  actionUrl: string;
};

// The single most valuable missing core field for this athlete, or null when the
// profile is complete (nothing is fabricated; we only ever ask for a real gap).
async function profileItem(
  clerkId: string,
  now: Date,
): Promise<ReminderItem | null> {
  const [p] = await db
    .select({
      ftp: athleteProfilesTable.ftp,
      weightKg: athleteProfilesTable.weightKg,
      goals: athleteProfilesTable.goals,
      heightCm: athleteProfilesTable.heightCm,
      birthYear: athleteProfilesTable.birthYear,
      homeLat: athleteProfilesTable.homeLat,
      homeLon: athleteProfilesTable.homeLon,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  if (!p) return null; // no profile row yet — handled by onboarding, not a nudge

  const missing: ProfileField[] = [];
  if (p.ftp == null) {
    missing.push({
      id: "ftp",
      title: "Wat is je FTP?",
      body: "Met je FTP worden je trainingszones en je belasting berekend. Geef je FTP door — of laat 'm schatten als je 'm niet weet.",
      actionUrl: "/you?focus=ftp",
    });
  }
  if (p.weightKg == null || Number(p.weightKg) <= 0) {
    missing.push({
      id: "weight",
      title: "Wat is je gewicht?",
      body: "Met je gewicht worden je vermogen per kilo (W/kg) en je voedingsadvies bijgehouden. Geef even je gewicht door.",
      actionUrl: "/you?focus=weight",
    });
  }
  if (!p.goals || p.goals.trim().length === 0) {
    missing.push({
      id: "goal",
      title: "Wat is je doel?",
      body: "Zonder doel is er geen richting om naartoe te trainen. Geef kort door waar je naartoe wilt.",
      actionUrl: "/you?focus=goal",
    });
  }
  if (p.heightCm == null) {
    missing.push({
      id: "height",
      title: "Wat is je lengte?",
      body: "Je lengte hoort bij je profiel en telt mee in je voedings- en houdingsadvies. Geef even je lengte door.",
      actionUrl: "/you?focus=height",
    });
  }
  if (p.birthYear == null) {
    missing.push({
      id: "birthyear",
      title: "In welk jaar ben je geboren?",
      body: "Met je geboortejaar worden je zones en advies afgestemd op je leeftijd. Geef even je geboortejaar door.",
      actionUrl: "/you?focus=birthYear",
    });
  }
  if (p.homeLat == null || p.homeLon == null) {
    missing.push({
      id: "home",
      title: "Waar woon je?",
      body: "Met je thuislocatie wordt het weer bij jou in de buurt opgehaald en je training daarop afgestemd. Geef je thuislocatie door.",
      actionUrl: "/train?focus=homeLocation",
    });
  }

  const field = missing[0];
  if (!field) return null; // profile complete — nothing to nudge

  return {
    kind: "profile",
    type: "profile_nudge",
    dedupeKey: `reminder:profile:${field.id}:${isoWeek(now)}`,
    title: field.title,
    body: field.body,
    // Neutraal: geen specifieke profielvraag/waarde in push/e-mail.
    pushTitle: "Maak je profiel compleet",
    pushBody: "Er ontbreekt nog iets in je profiel — vul het aan in de app.",
    emailSubject: "Maak je profiel compleet",
    emailBody: "Er ontbreekt nog iets in je profiel — vul het aan in de app.",
    actionUrl: field.actionUrl,
  };
}

// The smartly-timed "er is iets nieuws voor je" nudge. It fires only when ALL
// of these are true, so it is helpful and never nagging or fabricated:
//   1. the athlete is NOT currently/recently active (away from the app) — the
//      pulse is for reaching someone who left, never to interrupt an active use;
//   2. the moment falls inside the athlete's receptive window (learned from
//      their own real usage, or an honest calm-evening default while there is
//      too little data to know their rhythm);
//   3. there is GENUINELY something new since their last open (a real new
//      insight or fresh news) — if nothing is new, no nudge is created.
// Deduped to at most one per real (Amsterdam) calendar day.
const RECENT_ACTIVE_HOURS = 8;
const FALLBACK_SINCE_DAYS = 7;

async function whatsNewItem(
  clerkId: string,
  now: Date,
): Promise<ReminderItem | null> {
  const engagement = await deriveEngagement(clerkId, now);

  // 1. Don't nudge someone who is already active.
  if (
    engagement.hoursSinceLastOpen != null &&
    engagement.hoursSinceLastOpen < RECENT_ACTIVE_HOURS
  ) {
    return null;
  }

  // 2. Only inside the receptive window.
  const hour = amsterdamHour(now);
  const { startHour, endHour } = engagement.receptiveWindow;
  const inWindow =
    endHour > startHour
      ? hour >= startHour && hour < endHour
      : hour >= startHour || hour < endHour; // defensive: window across midnight
  if (!inWindow) return null;

  // 3. Only on genuinely new content since the last open (honest fallback window
  //    when we have never seen an open before).
  const since = engagement.lastOpenAt
    ? new Date(engagement.lastOpenAt)
    : new Date(now.getTime() - FALLBACK_SINCE_DAYS * 86_400_000);
  const whatsNew = await findWhatsNew(clerkId, since, now);
  if (!whatsNew) return null;

  const body =
    whatsNew.count === 1
      ? `Er staat iets nieuws voor je klaar: ${whatsNew.lead.title}.`
      : `Er staan ${whatsNew.count} nieuwe dingen voor je klaar. Om te beginnen: ${whatsNew.lead.title}.`;

  return {
    kind: "pulse",
    type: "something_new",
    dedupeKey: `reminder:whatsnew:${amsterdamYmd(now)}`,
    title: "Er is iets nieuws voor je",
    body,
    // NOT-03: geen item-titels in push/e-mail.
    pushTitle: "Er is iets nieuws voor je",
    pushBody: "Open de app om te kijken wat er voor je klaarstaat.",
    emailSubject: "Er is iets nieuws voor je",
    emailBody: "Open de app om te kijken wat er voor je klaarstaat.",
    actionUrl: whatsNew.lead.actionUrl,
  };
}

// All genuinely-due reminders for one athlete at `now`. Caller filters by prefs.
export async function buildDueReminders(
  clerkId: string,
  now: Date = new Date(),
): Promise<ReminderItem[]> {
  const items: ReminderItem[] = [];
  const checkin = await checkInItem(clerkId, now);
  if (checkin) items.push(checkin);
  const followup = await followUpItem(clerkId);
  if (followup) items.push(followup);
  items.push(...(await trainingItems(clerkId, now)));
  items.push(...(await raceItems(clerkId, now)));
  const profile = await profileItem(clerkId, now);
  if (profile) items.push(profile);
  const pulse = await whatsNewItem(clerkId, now);
  if (pulse) items.push(pulse);
  return items;
}
