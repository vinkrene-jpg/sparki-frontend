// F5 — Herhalende trainingen: datumlogica + DB-route contract.
//
// Deel 1 (puur): seriesDates rekent met kalenderdagen, nooit via UTC — de
// zomertijdovergang mag geen dag laten dubbelen of verdwijnen.
// Deel 2 (DB): boot de echte Express-app als dev-gebruiker en pint:
//   1. Reeks aanmaken genereert zelfstandig bruikbare planned_workouts-rijen.
//   2. Wijzigen scope="one" raakt precies één training (losgekoppeld +
//      uitzondering), scope="all" werkt alleen op nog geplande rijen.
//   3. Beëindigen verwijdert alleen toekomstige geplande rijen; uitgevoerde
//      historie blijft.
//   4. Annuleren behoudt uitgevoerde trainingen (losgekoppeld, series_id NULL).
//   5. Bestaande losse trainingen worden nooit in een reeks getrokken.
//
// Run: `pnpm --filter @workspace/api-server run test:workout-series`
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { seriesDates, weekdayOf, validateRule, nextDay } from "../lib/workout-series";

// ── Deel 1: pure datumlogica ─────────────────────────────────────────────────

test("weekdayOf klopt op bekende dagen", () => {
  assert.equal(weekdayOf("2026-08-03"), 1); // maandag
  assert.equal(weekdayOf("2026-08-09"), 7); // zondag
  assert.equal(weekdayOf("2026-03-29"), 7); // zondag (zomertijd-ingang 2026)
});

test("daily-reeks over de zomertijdovergang: elke dag precies één keer", () => {
  // NL zomertijd 2026 gaat in op zo 29 maart; wintertijd op zo 25 oktober.
  const dates = seriesDates({
    frequency: "daily",
    startDate: "2026-03-27",
    endDate: "2026-03-31",
  });
  assert.deepEqual(dates, ["2026-03-27", "2026-03-28", "2026-03-29", "2026-03-30", "2026-03-31"]);
  const winter = seriesDates({
    frequency: "daily",
    startDate: "2026-10-24",
    endDate: "2026-10-26",
  });
  assert.deepEqual(winter, ["2026-10-24", "2026-10-25", "2026-10-26"]);
});

test("weekly volgt de weekdag van de startdatum, ook over zomertijd heen", () => {
  const dates = seriesDates({
    frequency: "weekly",
    startDate: "2026-03-24", // dinsdag
    endDate: "2026-04-14",
  });
  assert.deepEqual(dates, ["2026-03-24", "2026-03-31", "2026-04-07", "2026-04-14"]);
  for (const d of dates) assert.equal(weekdayOf(d), 2);
});

test("weekdays kiest exact de gekozen dagen; exceptions vallen weg", () => {
  const dates = seriesDates({
    frequency: "weekdays",
    weekdays: [2, 4], // di + do
    startDate: "2026-08-03",
    endDate: "2026-08-16",
    exceptions: ["2026-08-06"],
  });
  assert.deepEqual(dates, ["2026-08-04", "2026-08-11", "2026-08-13"]);
});

test("interval telt kalenderdagen vanaf de start", () => {
  const dates = seriesDates({
    frequency: "interval",
    intervalDays: 3,
    startDate: "2026-08-01",
    endDate: "2026-08-10",
  });
  assert.deepEqual(dates, ["2026-08-01", "2026-08-04", "2026-08-07", "2026-08-10"]);
});

test("nextDay over maand- en jaargrens", () => {
  assert.equal(nextDay("2026-01-31"), "2026-02-01");
  assert.equal(nextDay("2026-12-31"), "2027-01-01");
  assert.equal(nextDay("2028-02-28"), "2028-02-29"); // schrikkeljaar
});

test("validateRule weigert oneerlijke regels", () => {
  assert.equal(validateRule({ frequency: "daily", startDate: "2026-08-10", endDate: "2026-08-01" }).ok, false);
  assert.equal(validateRule({ frequency: "weekdays", weekdays: [], startDate: "2026-08-01", endDate: "2026-08-10" }).ok, false);
  assert.equal(validateRule({ frequency: "weekdays", weekdays: [0], startDate: "2026-08-01", endDate: "2026-08-10" }).ok, false);
  assert.equal(validateRule({ frequency: "interval", intervalDays: 1, startDate: "2026-08-01", endDate: "2026-08-10" }).ok, false);
  assert.equal(validateRule({ frequency: "daily", startDate: "2026-01-01", endDate: "2027-06-01" }).ok, false); // te lang
  assert.equal(validateRule({ frequency: "daily", startDate: "2026-08-01", endDate: "2026-08-10", exceptions: ["gisteren"] }).ok, false);
});

// ── Deel 2: DB-route contract ────────────────────────────────────────────────

const TEST_CLERK_ID = "test_workout_series_f5";

let schema: typeof import("@workspace/db");
let db: (typeof import("@workspace/db"))["db"];
let server: import("node:http").Server;
let baseUrl = "";

before(async () => {
  schema = await import("@workspace/db");
  db = schema.db;
  const app = (await import("../app")).default;
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
  });
  const addr = server.address();
  if (typeof addr === "string" || addr == null) throw new Error("geen poort");
  baseUrl = `http://127.0.0.1:${addr.port}`;
  await db
    .insert(schema.userProfilesTable)
    .values({ clerkId: TEST_CLERK_ID, displayName: "TEST F5 Reeks", email: "f5-reeks@test.sparki" })
    .onConflictDoNothing();
});

after(async () => {
  const { eq } = await import("drizzle-orm");
  await db.delete(schema.plannedWorkoutsTable).where(eq(schema.plannedWorkoutsTable.clerkId, TEST_CLERK_ID));
  await db.delete(schema.workoutSeriesTable).where(eq(schema.workoutSeriesTable.clerkId, TEST_CLERK_ID));
  await db.delete(schema.userProfilesTable).where(eq(schema.userProfilesTable.clerkId, TEST_CLERK_ID));
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function api(
  method: string,
  path: string,
  body?: unknown,
  clerkId: string = TEST_CLERK_ID,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-dev-clerk-id": clerkId },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* leeg antwoord */
  }
  return { status: res.status, body: json };
}

test("reeks aanmaken genereert de juiste trainingen; losse training blijft los", async () => {
  const { and, eq } = await import("drizzle-orm");
  // Bestaande losse training vóór de reeks — mag NOOIT in de reeks getrokken worden.
  const loose = await api("POST", "/api/athlete/workouts", { scheduledDate: "2026-09-01", title: "Losse duurrit" });
  assert.equal(loose.status, 201);

  const res = await api("POST", "/api/workout-series", {
    title: "Dinsdag intervallen",
    frequency: "weekdays",
    weekdays: [2],
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    targetDurationMin: 60,
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  // september 2026: dinsdagen 1, 8, 15, 22, 29
  assert.equal(res.body.createdCount, 5);

  const rows = await db
    .select()
    .from(schema.plannedWorkoutsTable)
    .where(
      and(
        eq(schema.plannedWorkoutsTable.clerkId, TEST_CLERK_ID),
        eq(schema.plannedWorkoutsTable.seriesId, res.body.series.id),
      ),
    );
  assert.equal(rows.length, 5);
  // De losse training heeft geen seriesId gekregen.
  const [looseRow] = await db
    .select()
    .from(schema.plannedWorkoutsTable)
    .where(eq(schema.plannedWorkoutsTable.id, loose.body.id));
  assert.equal(looseRow!.seriesId, null);
});

test("scope=one raakt precies één training; scope=all alleen geplande rijen", async () => {
  const { and, eq } = await import("drizzle-orm");
  const created = await api("POST", "/api/workout-series", {
    title: "Ochtendrondje",
    frequency: "daily",
    startDate: "2026-10-01",
    endDate: "2026-10-05",
  });
  assert.equal(created.status, 201);
  const sid = created.body.series.id;

  // Markeer 3 oktober als uitgevoerd (historie).
  await db
    .update(schema.plannedWorkoutsTable)
    .set({ status: "completed" })
    .where(
      and(
        eq(schema.plannedWorkoutsTable.seriesId, sid),
        eq(schema.plannedWorkoutsTable.scheduledDate, "2026-10-03"),
      ),
    );

  // scope=one op 2 oktober.
  const one = await api("PUT", `/api/workout-series/${sid}`, { scope: "one", fromDate: "2026-10-02", title: "Ochtendrondje (aangepast)" });
  assert.equal(one.status, 200, JSON.stringify(one.body));
  assert.equal(one.body.updated, 1);
  const [oneRow] = await db
    .select()
    .from(schema.plannedWorkoutsTable)
    .where(
      and(
        eq(schema.plannedWorkoutsTable.clerkId, TEST_CLERK_ID),
        eq(schema.plannedWorkoutsTable.scheduledDate, "2026-10-02"),
        eq(schema.plannedWorkoutsTable.title, "Ochtendrondje (aangepast)"),
      ),
    );
  assert.ok(oneRow, "aangepaste training bestaat");
  assert.equal(oneRow!.seriesId, null, "losgekoppeld van de reeks");

  // scope=all: hernoemt alleen nog geplande reeksrijen (niet completed, niet de losgekoppelde).
  const all = await api("PUT", `/api/workout-series/${sid}`, { scope: "all", title: "Ochtendrondje v2" });
  assert.equal(all.status, 200);
  assert.equal(all.body.updated, 3); // 1, 4, 5 oktober
  const [doneRow] = await db
    .select()
    .from(schema.plannedWorkoutsTable)
    .where(and(eq(schema.plannedWorkoutsTable.seriesId, sid), eq(schema.plannedWorkoutsTable.scheduledDate, "2026-10-03")));
  assert.equal(doneRow!.title, "Ochtendrondje", "uitgevoerde historie blijft onaangeroerd");
});

test("annuleren behoudt uitgevoerde historie en verwijdert geplande rijen", async () => {
  const { and, eq } = await import("drizzle-orm");
  const created = await api("POST", "/api/workout-series", {
    title: "Herstelrit",
    frequency: "interval",
    intervalDays: 2,
    startDate: "2026-11-01",
    endDate: "2026-11-07",
  });
  assert.equal(created.status, 201);
  const sid = created.body.series.id;
  assert.equal(created.body.createdCount, 4); // 1, 3, 5, 7 november

  await db
    .update(schema.plannedWorkoutsTable)
    .set({ status: "completed" })
    .where(and(eq(schema.plannedWorkoutsTable.seriesId, sid), eq(schema.plannedWorkoutsTable.scheduledDate, "2026-11-01")));

  const del = await api("DELETE", `/api/workout-series/${sid}`);
  assert.equal(del.status, 200);
  assert.equal(del.body.removed, 3);

  const remaining = await db
    .select()
    .from(schema.plannedWorkoutsTable)
    .where(and(eq(schema.plannedWorkoutsTable.clerkId, TEST_CLERK_ID), eq(schema.plannedWorkoutsTable.scheduledDate, "2026-11-01")));
  assert.equal(remaining.length, 1, "uitgevoerde training blijft bestaan");
  assert.equal(remaining[0]!.seriesId, null, "historie is losgekoppeld");

  const [seriesRow] = await db
    .select()
    .from(schema.workoutSeriesTable)
    .where(eq(schema.workoutSeriesTable.id, sid));
  assert.equal(seriesRow!.status, "cancelled");
});

test("skip verwijdert één geplande dag en registreert een uitzondering", async () => {
  const { eq } = await import("drizzle-orm");
  const created = await api("POST", "/api/workout-series", {
    title: "Avondblokje",
    frequency: "daily",
    startDate: "2026-12-01",
    endDate: "2026-12-03",
  });
  assert.equal(created.status, 201);
  const sid = created.body.series.id;
  const skip = await api("POST", `/api/workout-series/${sid}/skip`, { date: "2026-12-02" });
  assert.equal(skip.status, 200);
  assert.equal(skip.body.removed, 1);
  const [row] = await db.select().from(schema.workoutSeriesTable).where(eq(schema.workoutSeriesTable.id, sid));
  assert.deepEqual(row!.exceptions, ["2026-12-02"]);
});

test("andermans reeks is onbereikbaar (404, geen lek)", async () => {
  const mine = await api("POST", "/api/workout-series", {
    title: "Privéreeks",
    frequency: "daily",
    startDate: "2027-01-01",
    endDate: "2027-01-02",
  });
  assert.equal(mine.status, 201);
  const other = await api("PUT", `/api/workout-series/${mine.body.series.id}`, { scope: "all", title: "gekaapt" }, "test_workout_series_other");
  assert.equal(other.status, 404);
});

test("scope=following splitst de reeks: oud eindigt vóór de grens, nieuw draagt het gewijzigde sjabloon", async () => {
  const { and, eq } = await import("drizzle-orm");
  const created = await api("POST", "/api/workout-series", {
    title: "Weekduurrit",
    frequency: "weekly",
    startDate: "2027-02-02", // dinsdag
    endDate: "2027-03-02",
  });
  assert.equal(created.status, 201);
  const sid = created.body.series.id;
  assert.equal(created.body.createdCount, 5); // 2, 9, 16, 23 feb + 2 mrt

  const resp = await api("PUT", `/api/workout-series/${sid}`, {
    scope: "following",
    fromDate: "2027-02-16",
    title: "Weekduurrit lang",
  });
  assert.equal(resp.status, 200, JSON.stringify(resp.body));
  assert.equal(resp.body.updated, 3); // 16, 23 feb + 2 mrt
  const newSid = resp.body.newSeries.id;
  assert.notEqual(newSid, sid);

  // Oorspronkelijke reeks eindigt vóór de grens; nieuwe start op de grensdag
  // met dezelfde weekdag en het nieuwe sjabloon.
  const [oldRow] = await db.select().from(schema.workoutSeriesTable).where(eq(schema.workoutSeriesTable.id, sid));
  assert.equal(oldRow!.endDate, "2027-02-15");
  assert.equal(oldRow!.title, "Weekduurrit");
  const [newRow] = await db.select().from(schema.workoutSeriesTable).where(eq(schema.workoutSeriesTable.id, newSid));
  assert.equal(newRow!.startDate, "2027-02-16");
  assert.equal(newRow!.endDate, "2027-03-02");
  assert.equal(newRow!.title, "Weekduurrit lang");

  // Rijen vóór de grens onaangeroerd bij de oude reeks; erna bij de nieuwe.
  const oldRows = await db
    .select()
    .from(schema.plannedWorkoutsTable)
    .where(and(eq(schema.plannedWorkoutsTable.clerkId, TEST_CLERK_ID), eq(schema.plannedWorkoutsTable.seriesId, sid)));
  assert.deepEqual(oldRows.map((r) => r.scheduledDate).sort(), ["2027-02-02", "2027-02-09"]);
  assert.ok(oldRows.every((r) => r.title === "Weekduurrit"));
  const newRows = await db
    .select()
    .from(schema.plannedWorkoutsTable)
    .where(and(eq(schema.plannedWorkoutsTable.clerkId, TEST_CLERK_ID), eq(schema.plannedWorkoutsTable.seriesId, newSid)));
  assert.deepEqual(newRows.map((r) => r.scheduledDate).sort(), ["2027-02-16", "2027-02-23", "2027-03-02"]);
  assert.ok(newRows.every((r) => r.title === "Weekduurrit lang"));
});

test("mutaties op een beëindigde/geannuleerde reeks geven 409", async () => {
  const created = await api("POST", "/api/workout-series", {
    title: "Stopreeks",
    frequency: "daily",
    startDate: "2027-04-01",
    endDate: "2027-04-03",
  });
  const sid = created.body.series.id;
  const del = await api("DELETE", `/api/workout-series/${sid}`);
  assert.equal(del.status, 200);
  assert.equal((await api("PUT", `/api/workout-series/${sid}`, { scope: "all", title: "x" })).status, 409);
  assert.equal((await api("POST", `/api/workout-series/${sid}/skip`, { date: "2027-04-02" })).status, 409);
  assert.equal((await api("POST", `/api/workout-series/${sid}/end`)).status, 409);
});

test("parallelle skips verliezen geen uitzonderingen (row lock)", async () => {
  const { eq } = await import("drizzle-orm");
  const created = await api("POST", "/api/workout-series", {
    title: "Racereeks",
    frequency: "daily",
    startDate: "2027-05-01",
    endDate: "2027-05-05",
  });
  const sid = created.body.series.id;
  const [a, b] = await Promise.all([
    api("POST", `/api/workout-series/${sid}/skip`, { date: "2027-05-02" }),
    api("POST", `/api/workout-series/${sid}/skip`, { date: "2027-05-04" }),
  ]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  const [row] = await db.select().from(schema.workoutSeriesTable).where(eq(schema.workoutSeriesTable.id, sid));
  assert.deepEqual([...(row!.exceptions ?? [])].sort(), ["2027-05-02", "2027-05-04"]);
});
