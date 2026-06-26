// Build the set of genuinely-due reminders for one athlete at a given moment.
//
// Honesty contract: every item here corresponds to REAL, due data — a real
// missing evening check-in, a real open follow-up question Sparki raised, a real
// planned workout for tomorrow, a real upcoming race. Nothing is fabricated; if
// there is nothing due, the list is empty.
//
// Each item carries a stable `dedupeKey` so the delivery job creates/sends it at
// most once (idempotency lives in the notifications unique index).

import { and, eq, gte, lte } from "drizzle-orm";
import {
  db,
  athleteDailyMetricsTable,
  plannedWorkoutsTable,
  racesTable,
  type NotificationType,
  type ReminderKind,
} from "@workspace/db";
import { runCoachAnalysis } from "../observation";

export type ReminderItem = {
  kind: ReminderKind;
  type: NotificationType;
  dedupeKey: string;
  title: string;
  // In-app + email body. Plain Dutch, no "AI" wording.
  body: string;
  emailSubject: string;
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
    body: "Sparki heeft je avond-check-in nog niet. Een korte check-in (fris / oké / vermoeid) helpt Sparki je advies voor morgen scherp te krijgen.",
    emailSubject: "Sparki: hoe voel je je vandaag?",
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
    title: open === 1 ? "Sparki heeft een vraag voor je" : "Sparki heeft een paar vragen",
    body: `Sparki heeft ${plural} openstaan om je advies preciezer te maken. Beantwoord ${open === 1 ? "die" : "ze"} kort in de app.`,
    emailSubject: "Sparki heeft een vraag voor je",
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
    title: `Morgen op het programma: ${r.title}`,
    body: r.description
      ? `Morgen staat "${r.title}" gepland. ${r.description}`
      : `Morgen staat "${r.title}" gepland. Bekijk de details in de app.`,
    emailSubject: `Sparki: morgen traint je — ${r.title}`,
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
      ),
    );
  return rows.map((r) => {
    const where = r.location ? ` in ${r.location}` : "";
    return {
      kind: "races" as const,
      type: "race_reminder" as NotificationType,
      dedupeKey: `reminder:race:${r.id}`,
      title: `Binnenkort: ${r.name}`,
      body: `Je wedstrijd "${r.name}"${where} is op ${dutchDate(r.raceDate)}. Sparki helpt je met de voorbereiding in de app.`,
      emailSubject: `Sparki: ${r.name} komt eraan`,
      actionUrl: "/races",
    };
  });
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
  return items;
}
