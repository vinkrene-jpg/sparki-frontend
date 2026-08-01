// SPARKI_INHAAL_01 BUILD_03 — pakket 03, fase Structuur + Conflicten
// (besluitenpatch hoofdstuk D).
//
// Bewijst via de echte Express-app:
//   1. "Eén wedstrijd voor iedereen": selectie als renner ⇒ persoonlijke
//      wedstrijd verschijnt in de eigen omgeving; begeleider niet.
//   2. Wedstrijdwijziging (naam/datum/parcours) werkt door in de
//      gesynchroniseerde persoonlijke wedstrijd.
//   3. Afmelden ⇒ persoonlijke wedstrijd verdwijnt weer; reserve schuift NIET
//      automatisch door.
//   4. Vervanger: teammanager activeert; ploeg krijgt bericht; vervanger mag
//      selectie beheren; beëindigen wist het veld (geen spoor).
//   5. Ploegleider mag alleen zelf een vervanger activeren als er geen
//      teammanager is.
//   6. Conflicten v1: dezelfde renner op twee wedstrijden op één dag ⇒
//      waarschuwing, geen blokkade.
//
// Run: pnpm --filter @workspace/api-server run test:club-race-structure

import type { Server } from "node:http";
import {
  db,
  clubsTable,
  clubMembersTable,
  clubRaceEventsTable,
  notificationsTable,
  racesTable,
  userProfilesTable,
  athleteProfilesTable,
} from "@workspace/db";
import { eq, inArray, like, and } from "drizzle-orm";
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

const T = "crstruct";
const TEAMMANAGER = `test-${T}-teammanager`;
const PLOEGLEIDER = `test-${T}-ploegleider`;
const VERVANGER = `test-${T}-vervanger`;
const RENNER = `test-${T}-renner`;
const ALL = [TEAMMANAGER, PLOEGLEIDER, VERVANGER, RENNER];

let server: Server;
let base: string;
let clubId = 0;
let eventId = 0;

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
  return { status: res.status, json: json as any };
}

async function cleanup() {
  const clubs = await db
    .select({ id: clubsTable.id })
    .from(clubsTable)
    .where(like(clubsTable.name, `TESTCLUB-${T}%`));
  for (const c of clubs) await db.delete(clubsTable).where(eq(clubsTable.id, c.id));
  await db.delete(racesTable).where(inArray(racesTable.clerkId, ALL));
  await db.delete(notificationsTable).where(inArray(notificationsTable.clerkId, ALL));
  await db.delete(athleteProfilesTable).where(inArray(athleteProfilesTable.clerkId, ALL));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ALL));
}

async function personalRaces(clerkId: string) {
  return db.select().from(racesTable).where(eq(racesTable.clerkId, clerkId));
}

async function main() {
  await cleanup();
  for (const id of ALL) await ensureAccount(id, `${id}@example.test`, id, silentLogger);
  const [club] = await db
    .insert(clubsTable)
    .values({ name: `TESTCLUB-${T}`, ownerClerkId: TEAMMANAGER, status: "actief" })
    .returning();
  clubId = club!.id;
  await db.insert(clubMembersTable).values([
    { clubId, clerkId: TEAMMANAGER, role: "teammanager" },
    { clubId, clerkId: PLOEGLEIDER, role: "ploegleider" },
    { clubId, clerkId: VERVANGER, role: "soigneur" },
    { clubId, clerkId: RENNER, role: "member" },
  ]);
  server = app.listen(0);
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  const races = `/api/clubs/${clubId}/races`;

  await scenario("selectie als renner ⇒ persoonlijke wedstrijd; begeleider niet", async () => {
    const ev = await api(PLOEGLEIDER, "POST", races, {
      name: "GP Testland",
      raceDate: "2026-09-19",
      location: "Teststad",
    });
    assert(ev.status === 201, `event: ${ev.status}: ${JSON.stringify(ev.json)}`);
    eventId = ev.json.id;
    const sel = await api(PLOEGLEIDER, "POST", `${races}/${eventId}/selection`, {
      clerkId: RENNER,
      role: "renner",
    });
    assert(sel.status === 201, `selectie: ${sel.status}: ${JSON.stringify(sel.json)}`);
    const mine = await personalRaces(RENNER);
    assert(mine.length === 1, `renner heeft ${mine.length} persoonlijke wedstrijden (verwacht 1)`);
    assert(mine[0]!.clubEventId === eventId && mine[0]!.name === "GP Testland", "gekoppeld aan clubwedstrijd");
    // Begeleider krijgt géén persoonlijke wedstrijd.
    const sel2 = await api(PLOEGLEIDER, "POST", `${races}/${eventId}/selection`, {
      clerkId: VERVANGER,
      role: "begeleider",
    });
    assert(sel2.status === 201, `begeleider selectie: ${sel2.status}`);
    assert((await personalRaces(VERVANGER)).length === 0, "begeleider zonder persoonlijke wedstrijd");
    // Idempotent: nogmaals selecteren maakt geen tweede rij.
    await api(PLOEGLEIDER, "POST", `${races}/${eventId}/selection`, { clerkId: RENNER, role: "renner" });
    assert((await personalRaces(RENNER)).length === 1, "sync is idempotent");
  });

  await scenario("wedstrijdwijziging werkt door in de persoonlijke wedstrijd", async () => {
    const upd = await api(PLOEGLEIDER, "PUT", `${races}/${eventId}`, {
      name: "GP Testland — vernieuwd",
      raceDate: "2026-09-20",
    });
    assert(upd.status === 200, `update: ${upd.status}`);
    const [mine] = await personalRaces(RENNER);
    assert(mine!.name === "GP Testland — vernieuwd" && mine!.raceDate === "2026-09-20", "doorgewerkt");
  });

  await scenario("afmelden ⇒ persoonlijke wedstrijd verdwijnt; reserve schuift niet door", async () => {
    // Reserve toevoegen zodat aantoonbaar is dat die blijft staan als reserve.
    await api(PLOEGLEIDER, "POST", `${races}/${eventId}/selection`, { clerkId: VERVANGER, role: "reserve" });
    const del = await api(PLOEGLEIDER, "DELETE", `${races}/${eventId}/selection/${RENNER}`);
    assert(del.status === 200, `afmelden: ${del.status}: ${JSON.stringify(del.json)}`);
    assert((await personalRaces(RENNER)).length === 0, "persoonlijke wedstrijd opgeruimd");
    const detail = await api(PLOEGLEIDER, "GET", races);
    const event = detail.json.find((e: any) => e.id === eventId);
    const reserve = event.selections.find((s: any) => s.clerkId === VERVANGER);
    assert(reserve && reserve.role === "reserve", "reserve blijft reserve (schuift niet door)");
    // Terugzetten voor vervolg.
    await api(PLOEGLEIDER, "POST", `${races}/${eventId}/selection`, { clerkId: RENNER, role: "renner" });
  });

  await scenario("vervanger: teammanager activeert, ploeg krijgt bericht, rechten werken", async () => {
    // Ploegleider mag niet zelf terwijl er een teammanager is.
    const deny = await api(PLOEGLEIDER, "POST", `${races}/${eventId}/deputy`, { deputyClerkId: VERVANGER });
    assert(deny.status === 403, `ploegleider met teammanager: verwacht 403, kreeg ${deny.status}`);
    const act = await api(TEAMMANAGER, "POST", `${races}/${eventId}/deputy`, { deputyClerkId: VERVANGER });
    assert(act.status === 200 && act.json.deputyClerkId === VERVANGER, `activeren: ${act.status}`);
    await new Promise((t) => setTimeout(t, 300));
    const notes = await db
      .select()
      .from(notificationsTable)
      .where(inArray(notificationsTable.clerkId, [RENNER, VERVANGER]));
    assert(
      notes.some((n) => String(n.dedupeKey ?? "").startsWith(`deputy:${eventId}:`)),
      "ploeg kreeg vervanger-bericht",
    );
    // De vervanger (soigneur!) mag nu de selectie beheren op deze wedstrijd.
    const asDeputy = await api(VERVANGER, "POST", `${races}/${eventId}/selection`, {
      clerkId: RENNER,
      role: "reserve",
    });
    assert(asDeputy.status === 201, `vervanger beheert selectie: ${asDeputy.status}: ${JSON.stringify(asDeputy.json)}`);
    // Beëindigen wist het veld — geen spoor.
    const end = await api(TEAMMANAGER, "POST", `${races}/${eventId}/deputy`, { deputyClerkId: null });
    assert(end.status === 200 && end.json.deputyClerkId === null, `beëindigen: ${end.status}`);
    const [row] = await db
      .select({ deputyClerkId: clubRaceEventsTable.deputyClerkId })
      .from(clubRaceEventsTable)
      .where(eq(clubRaceEventsTable.id, eventId));
    assert(row!.deputyClerkId === null, "geen spoor van de vervanger");
    const after = await api(VERVANGER, "POST", `${races}/${eventId}/selection`, { clerkId: RENNER, role: "renner" });
    assert(after.status === 403, `rechten vervallen na beëindiging: verwacht 403, kreeg ${after.status}`);
    await api(PLOEGLEIDER, "POST", `${races}/${eventId}/selection`, { clerkId: RENNER, role: "renner" });
  });

  await scenario("ploegleider mag zelf activeren zonder teammanager", async () => {
    // Teammanager tijdelijk beëindigen.
    await db
      .update(clubMembersTable)
      .set({ endedAt: new Date() })
      .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.clerkId, TEAMMANAGER)));
    const act = await api(PLOEGLEIDER, "POST", `${races}/${eventId}/deputy`, { deputyClerkId: VERVANGER });
    assert(act.status === 200, `zonder teammanager: verwacht 200, kreeg ${act.status}`);
    await api(PLOEGLEIDER, "POST", `${races}/${eventId}/deputy`, { deputyClerkId: null });
    await db
      .update(clubMembersTable)
      .set({ endedAt: null })
      .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.clerkId, TEAMMANAGER)));
  });

  await scenario("conflict v1: dezelfde renner op twee wedstrijden op één dag ⇒ waarschuwing", async () => {
    const ev2 = await api(PLOEGLEIDER, "POST", races, { name: "Kermiskoers Elders", raceDate: "2026-09-20" });
    assert(ev2.status === 201, `tweede event: ${ev2.status}`);
    const sel = await api(PLOEGLEIDER, "POST", `${races}/${ev2.json.id}/selection`, {
      clerkId: RENNER,
      role: "renner",
    });
    assert(sel.status === 201, `dubbele selectie NIET geblokkeerd: ${sel.status}`);
    const conflicts = await api(PLOEGLEIDER, "GET", `${races}/${eventId}/conflicts`);
    assert(conflicts.status === 200, `conflicts: ${conflicts.status}`);
    assert(
      conflicts.json.warnings.some((w: any) => w.clerkId === RENNER && w.type === "dubbele_renner"),
      `waarschuwing aanwezig: ${JSON.stringify(conflicts.json)}`,
    );
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
