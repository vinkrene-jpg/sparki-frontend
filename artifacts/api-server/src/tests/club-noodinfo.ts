// SPARKI_INHAAL_01 BUILD_03 — fase Noodinformatie (besluitenpatch hoofdstuk D).
//
// Bewijst via de echte Express-app:
//   1. Ploegleider, teammanager en medical_staff zien noodinformatie;
//      mechanieker en soigneur uitdrukkelijk NIET.
//   2. Elke inzage wordt gelogd (voor alle drie de rollen).
//   3. De sporter ziet in het inzagelog wie keek en wanneer; een ander lid niet.
//   4. availabilityNote is in de wedstrijdlijst afgeschermd voor rollen zonder
//      noodinfo-recht (soigneur ziet null), maar het lid zelf ziet zijn eigen
//      notitie en de ploegleider ziet hem wel.
//
// Run: pnpm --filter @workspace/api-server run test:club-noodinfo

import type { Server } from "node:http";
import {
  db,
  clubsTable,
  clubMembersTable,
  clubNoodinfoViewsTable,
  emergencyContactsTable,
  notificationsTable,
  userProfilesTable,
  athleteProfilesTable,
  racesTable,
} from "@workspace/db";
import { eq, inArray, like } from "drizzle-orm";
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

const T = "noodinfo";
const PLOEGLEIDER = `test-${T}-ploegleider`;
const TEAMMANAGER = `test-${T}-teammanager`;
const MEDIC = `test-${T}-medic`;
const SOIGNEUR = `test-${T}-soigneur`;
const MECHANIEKER = `test-${T}-mechanieker`;
const RENNER = `test-${T}-renner`;
const ANDER_LID = `test-${T}-anderlid`;
const ALL = [PLOEGLEIDER, TEAMMANAGER, MEDIC, SOIGNEUR, MECHANIEKER, RENNER, ANDER_LID];

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
  return { status: res.status, json: json as any };
}

async function cleanup() {
  const clubs = await db
    .select({ id: clubsTable.id })
    .from(clubsTable)
    .where(like(clubsTable.name, `TESTCLUB-${T}%`));
  for (const c of clubs) await db.delete(clubsTable).where(eq(clubsTable.id, c.id));
  await db.delete(racesTable).where(inArray(racesTable.clerkId, ALL));
  await db.delete(emergencyContactsTable).where(inArray(emergencyContactsTable.athleteClerkId, ALL));
  await db.delete(notificationsTable).where(inArray(notificationsTable.clerkId, ALL));
  await db.delete(athleteProfilesTable).where(inArray(athleteProfilesTable.clerkId, ALL));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ALL));
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
    { clubId, clerkId: PLOEGLEIDER, role: "ploegleider" },
    { clubId, clerkId: TEAMMANAGER, role: "teammanager" },
    { clubId, clerkId: MEDIC, role: "medical_staff" },
    { clubId, clerkId: SOIGNEUR, role: "soigneur" },
    { clubId, clerkId: MECHANIEKER, role: "mechanieker" },
    { clubId, clerkId: RENNER, role: "member" },
    { clubId, clerkId: ANDER_LID, role: "member" },
  ]);
  await db.insert(emergencyContactsTable).values({
    athleteClerkId: RENNER,
    name: "Moeder Test",
    phone: "+31600000000",
    relation: "moeder",
  });
  server = app.listen(0);
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  const noodinfo = `/api/clubs/${clubId}/members/${RENNER}/noodinfo`;

  await scenario("ploegleider/teammanager/medical_staff zien noodinfo; mechanieker/soigneur niet", async () => {
    for (const wel of [PLOEGLEIDER, TEAMMANAGER, MEDIC]) {
      const r = await api(wel, "GET", noodinfo);
      assert(r.status === 200, `${wel}: verwacht 200, kreeg ${r.status}`);
      assert(r.json.contacts.length === 1 && r.json.contacts[0].name === "Moeder Test", `${wel}: contact zichtbaar`);
    }
    for (const niet of [SOIGNEUR, MECHANIEKER, ANDER_LID]) {
      const r = await api(niet, "GET", noodinfo);
      assert(r.status === 403, `${niet}: verwacht 403, kreeg ${r.status}`);
    }
  });

  await scenario("elke inzage is gelogd, voor alle drie de rollen", async () => {
    const rows = await db
      .select()
      .from(clubNoodinfoViewsTable)
      .where(eq(clubNoodinfoViewsTable.memberClerkId, RENNER));
    const rollen = new Set(rows.map((r) => r.viewerRole));
    assert(rows.length === 3, `verwacht 3 loggeregels, kreeg ${rows.length}`);
    assert(
      rollen.has("ploegleider") && rollen.has("teammanager") && rollen.has("medical_staff"),
      `alle rollen gelogd: ${[...rollen].join(",")}`,
    );
  });

  await scenario("sporter ziet wie keek en wanneer; ander lid niet", async () => {
    const own = await api(RENNER, "GET", `${noodinfo}-log`);
    assert(own.status === 200, `eigen log: ${own.status}`);
    assert(own.json.length === 3 && own.json.every((r: any) => r.viewedAt && r.viewerRole), "log volledig");
    const ander = await api(ANDER_LID, "GET", `${noodinfo}-log`);
    assert(ander.status === 403, `ander lid: verwacht 403, kreeg ${ander.status}`);
  });

  await scenario("availabilityNote afgeschermd voor soigneur, zichtbaar voor ploegleider en lid zelf", async () => {
    const races = `/api/clubs/${clubId}/races`;
    const ev = await api(PLOEGLEIDER, "POST", races, { name: `Koers-${T}`, raceDate: "2026-10-03" });
    assert(ev.status === 201, `event: ${ev.status}`);
    await api(PLOEGLEIDER, "POST", `${races}/${ev.json.id}/selection`, { clerkId: RENNER, role: "renner" });
    const note = await api(RENNER, "PUT", `${races}/${ev.json.id}/availability`, {
      availability: "niet_beschikbaar",
      note: "medische reden — vertrouwelijk",
    });
    assert(note.status === 200, `note: ${note.status}`);
    const asSoigneur = await api(SOIGNEUR, "GET", races);
    const evS = asSoigneur.json.find((e: any) => e.id === ev.json.id);
    const selS = evS.selections.find((s: any) => s.clerkId === RENNER);
    assert(selS.availabilityNote === null, `soigneur ziet note niet (kreeg: ${selS.availabilityNote})`);
    assert(selS.availability === "niet_beschikbaar", "status blijft wél zichtbaar");
    const asPl = await api(PLOEGLEIDER, "GET", races);
    const selP = asPl.json.find((e: any) => e.id === ev.json.id).selections.find((s: any) => s.clerkId === RENNER);
    assert(selP.availabilityNote?.includes("medische reden"), "ploegleider ziet note wel");
    const asSelf = await api(RENNER, "GET", races);
    const selZ = asSelf.json.find((e: any) => e.id === ev.json.id).mySelection;
    assert(selZ.availabilityNote?.includes("medische reden"), "lid ziet eigen note");
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
