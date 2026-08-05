// CLUB_AFRONDING_01 C1 — herhalende clubtrainingen.
//
// Bewijst via de echte Express-app de acceptatietests C-T1 t/m C-T5:
//   C-T1 wekelijkse reeks voor het hele seizoen → echte club_trainings-rijen
//        tot de seizoenseinddatum, elk zelfstandig te openen
//   C-T2 één training verplaatsen → alleen die training verschuift
//   C-T3 "deze en volgende" wijzigen → reeks splitst, eerdere ongewijzigd
//   C-T4 reeks beëindigen halverwege → toekomst weg, uitgevoerde blijven
//   C-T5 twee gelijktijdige wijzigingen → geen verloren wijziging (FOR UPDATE)
// Plus: skip (uitzondering zonder reeksbreuk) en rechten (member = 403).
//
// Run: pnpm --filter @workspace/api-server run test:club-training-series

import type { Server } from "node:http";
import {
  db,
  clubsTable,
  clubMembersTable,
  clubSeasonsTable,
  clubTrainingsTable,
  clubTrainingSeriesTable,
  userProfilesTable,
  athleteProfilesTable,
} from "@workspace/db";
import { and, asc, eq, inArray, like } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
async function scenario(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
    console.log(`✓ ${name}`);
  } catch (err) {
    results.push({ scenario: name, status: "fail", note: String(err) });
    console.error(`✗ ${name}: ${String(err)}`);
  }
}

const T = "ctsx";
const OWNER = `test-${T}-owner`;
const TRAINER = `test-${T}-trainer`;
const MEMBER = `test-${T}-member`;
const ALL = [OWNER, TRAINER, MEMBER];

let server: Server;
let base: string;
let clubId = 0;

async function api(clerkId: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-clerk-id": clerkId },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* leeg */
  }
  return { status: res.status, json: json as Record<string, unknown> | null };
}

async function cleanup() {
  const clubs = await db
    .select({ id: clubsTable.id })
    .from(clubsTable)
    .where(like(clubsTable.name, `TESTCLUB-${T}%`));
  for (const c of clubs) await db.delete(clubsTable).where(eq(clubsTable.id, c.id));
  await db.delete(athleteProfilesTable).where(inArray(athleteProfilesTable.clerkId, ALL));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ALL));
}

async function seed() {
  for (const id of ALL) await ensureAccount(id, `${id}@example.test`, id, silentLogger);
  const [club] = await db
    .insert(clubsTable)
    .values({ name: `TESTCLUB-${T}`, ownerClerkId: OWNER, status: "actief" })
    .returning();
  clubId = club!.id;
  await db.insert(clubMembersTable).values([
    { clubId, clerkId: OWNER, role: "owner" },
    { clubId, clerkId: TRAINER, role: "trainer" },
    { clubId, clerkId: MEMBER, role: "member" },
  ]);
  // Actief seizoen t/m eind oktober: de reeks moet hierop begrensd worden.
  await db.insert(clubSeasonsTable).values({
    clubId,
    name: "2026",
    startsOn: "2026-08-01",
    endsOn: "2026-10-31",
    status: "actief",
  });
}

async function trainingsOf(seriesId: number) {
  return db
    .select()
    .from(clubTrainingsTable)
    .where(and(eq(clubTrainingsTable.clubId, clubId), eq(clubTrainingsTable.seriesId, seriesId)))
    .orderBy(asc(clubTrainingsTable.trainingDate));
}

async function main() {
  await cleanup();
  await seed();
  server = app.listen(0);
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;

  let seriesId = 0;

  await scenario("C-T1: wekelijkse reeks materialiseert echte rijen tot de seizoenseinddatum", async () => {
    const r = await api(TRAINER, "POST", `/api/clubs/${clubId}/training-series`, {
      title: "Dinsdagavondtraining",
      frequency: "weekly",
      startDate: "2026-08-11", // een dinsdag
      startTime: "19:00",
      location: "Clubhuis",
      // géén endDate: moet de seizoenseinddatum (2026-10-31) pakken
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}: ${JSON.stringify(r.json)}`);
    const series = r.json?.["series"] as Record<string, unknown>;
    seriesId = Number(series["id"]);
    assert(String(series["endDate"]) === "2026-10-31", `einddatum = seizoenseinde, kreeg ${series["endDate"]}`);
    const rows = await trainingsOf(seriesId);
    // dinsdagen 11-08 t/m 27-10 = 12 stuks
    assert(rows.length === 12, `verwacht 12 trainingen, kreeg ${rows.length}`);
    assert(rows[rows.length - 1]!.trainingDate <= "2026-10-31", "geen rij voorbij het seizoen");
    assert(rows.every((t) => t.startTime === "19:00" && t.location === "Clubhuis"), "sjabloon overgenomen");
  });

  await scenario("rechten: gewoon lid kan geen reeks aanmaken (403)", async () => {
    const r = await api(MEMBER, "POST", `/api/clubs/${clubId}/training-series`, {
      title: "X",
      frequency: "weekly",
      startDate: "2026-08-12",
    });
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
  });

  await scenario("C-T2: één training verplaatsen raakt alleen die training", async () => {
    const before = await trainingsOf(seriesId);
    const r = await api(TRAINER, "PUT", `/api/clubs/${clubId}/training-series/${seriesId}`, {
      scope: "one",
      fromDate: "2026-08-18",
      trainingDate: "2026-08-19",
    });
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}: ${JSON.stringify(r.json)}`);
    const after = await trainingsOf(seriesId);
    assert(after.length === before.length - 1, "verplaatste training losgekoppeld van de reeks");
    const moved = await db
      .select()
      .from(clubTrainingsTable)
      .where(and(eq(clubTrainingsTable.clubId, clubId), eq(clubTrainingsTable.trainingDate, "2026-08-19")));
    assert(moved.length === 1 && moved[0]!.seriesId == null, "training staat zelfstandig op de nieuwe datum");
    const [series] = await db
      .select()
      .from(clubTrainingSeriesTable)
      .where(eq(clubTrainingSeriesTable.id, seriesId));
    assert((series!.exceptions ?? []).includes("2026-08-18"), "datum als uitzondering geregistreerd");
  });

  await scenario("skip: één datum overslaan zonder de reeks te breken", async () => {
    const r = await api(TRAINER, "POST", `/api/clubs/${clubId}/training-series/${seriesId}/skip`, {
      date: "2026-08-25",
    });
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    const rows = await trainingsOf(seriesId);
    assert(!rows.some((t) => t.trainingDate === "2026-08-25"), "overgeslagen datum weg");
    assert(rows.some((t) => t.trainingDate === "2026-09-01"), "volgende training blijft staan");
  });

  let newSeriesId = 0;
  await scenario("C-T3: 'deze en volgende' splitst de reeks; eerdere blijven ongewijzigd", async () => {
    const r = await api(TRAINER, "PUT", `/api/clubs/${clubId}/training-series/${seriesId}`, {
      scope: "following",
      fromDate: "2026-09-15",
      startTime: "19:30",
    });
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}: ${JSON.stringify(r.json)}`);
    newSeriesId = Number((r.json?.["newSeries"] as Record<string, unknown>)["id"]);
    const oldRows = await trainingsOf(seriesId);
    const newRows = await trainingsOf(newSeriesId);
    assert(oldRows.every((t) => t.trainingDate < "2026-09-15"), "oude reeks houdt alleen eerdere data");
    assert(oldRows.every((t) => t.startTime === "19:00"), "eerdere trainingen ongewijzigd");
    assert(newRows.length > 0 && newRows.every((t) => t.startTime === "19:30"), "latere trainingen dragen het nieuwe sjabloon");
    const [oldSeries] = await db
      .select()
      .from(clubTrainingSeriesTable)
      .where(eq(clubTrainingSeriesTable.id, seriesId));
    assert(String(oldSeries!.endDate) === "2026-09-14", "oude reeks eindigt de dag vóór de grens");
  });

  await scenario("C-T4: reeks beëindigen — toekomst weg, uitgevoerde blijven met deelnemers", async () => {
    // Markeer de eerste training van de nieuwe reeks als afgerond (historie).
    const rows = await trainingsOf(newSeriesId);
    const first = rows[0]!;
    await db
      .update(clubTrainingsTable)
      .set({ status: "afgerond" })
      .where(eq(clubTrainingsTable.id, first.id));
    const r = await api(OWNER, "POST", `/api/clubs/${clubId}/training-series/${newSeriesId}/end`);
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    const after = await trainingsOf(newSeriesId);
    assert(after.length === 1 && after[0]!.id === first.id, "alleen de afgeronde training blijft staan");
    assert(after[0]!.status === "afgerond", "historie behouden");
  });

  await scenario("C-T5: gelijktijdige wijzigingen verliezen niets (FOR UPDATE)", async () => {
    // Verse reeks; twee parallelle skips op verschillende datums moeten
    // BEIDE als uitzondering eindigen (geen verloren update op exceptions).
    const r = await api(TRAINER, "POST", `/api/clubs/${clubId}/training-series`, {
      title: "Donderdagtraining",
      frequency: "weekly",
      startDate: "2026-08-13",
      endDate: "2026-09-30",
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    const sid = Number((r.json?.["series"] as Record<string, unknown>)["id"]);
    const [a, b] = await Promise.all([
      api(TRAINER, "POST", `/api/clubs/${clubId}/training-series/${sid}/skip`, { date: "2026-08-20" }),
      api(OWNER, "POST", `/api/clubs/${clubId}/training-series/${sid}/skip`, { date: "2026-08-27" }),
    ]);
    assert(a.status === 200 && b.status === 200, `beide skips 200, kreeg ${a.status}/${b.status}`);
    const [series] = await db
      .select()
      .from(clubTrainingSeriesTable)
      .where(eq(clubTrainingSeriesTable.id, sid));
    const ex = series!.exceptions ?? [];
    assert(ex.includes("2026-08-20") && ex.includes("2026-08-27"), `beide uitzonderingen bewaard, kreeg ${JSON.stringify(ex)}`);
  });

  await scenario("annuleren: geplande rijen weg, reeks op cancelled", async () => {
    const r = await api(OWNER, "DELETE", `/api/clubs/${clubId}/training-series/${seriesId}`);
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    const rows = await trainingsOf(seriesId);
    assert(rows.length === 0, "geen gekoppelde geplande rijen meer");
    const [series] = await db
      .select()
      .from(clubTrainingSeriesTable)
      .where(eq(clubTrainingSeriesTable.id, seriesId));
    assert(series!.status === "cancelled", "reeksstatus cancelled");
  });

  server.close();
  await cleanup();
  const failed = results.filter((r) => r.status === "fail");
  console.log(`\n${results.length - failed.length}/${results.length} passed, ${failed.length} failed.`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
