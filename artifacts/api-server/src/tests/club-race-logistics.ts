// SPARKI_INHAAL_01 BUILD_03 — fase Dagschema & logistiek (patch hoofdstuk D).
//
// Bewijst via de echte Express-app:
//   1. Dagschema: vertrektijd+verzamelpunt verplicht (400 zonder), staf ziet
//      alle regels, renner alleen de eigen regel.
//   2. Verschuiven eist expliciete bevestiging; daarna schuiven alle tijden
//      mee en krijgt de HELE ploeg (incl. renner) bericht.
//   3. Vervoer: renner ziet de hele indeling; overboeking geeft waarschuwing,
//      geen blokkade; chauffeur optioneel.
//   4. Materiaal: mechanieker vult (soigneur 403), sjabloon herbruikbaar,
//      afvinken idempotent.
//   5. Vertrekcontrole: open materiaal ⇒ waarschuwing, nooit blokkeren; na
//      afvinken alles gereed.
//
// Run: pnpm --filter @workspace/api-server run test:club-race-logistics

import type { Server } from "node:http";
import {
  db,
  clubsTable,
  clubMembersTable,
  notificationsTable,
  racesTable,
  userProfilesTable,
  athleteProfilesTable,
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

const T = "crlogist";
const PLOEGLEIDER = `test-${T}-ploegleider`;
const MECHANIEKER = `test-${T}-mechanieker`;
const SOIGNEUR = `test-${T}-soigneur`;
const RENNER = `test-${T}-renner`;
const RENNER2 = `test-${T}-renner2`;
const ALL = [PLOEGLEIDER, MECHANIEKER, SOIGNEUR, RENNER, RENNER2];

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

async function main() {
  await cleanup();
  for (const id of ALL) await ensureAccount(id, `${id}@example.test`, id, silentLogger);
  const [club] = await db
    .insert(clubsTable)
    .values({ name: `TESTCLUB-${T}`, ownerClerkId: PLOEGLEIDER, status: "actief" })
    .returning();
  clubId = club!.id;
  await db.insert(clubMembersTable).values([
    { clubId, clerkId: PLOEGLEIDER, role: "ploegleider" },
    { clubId, clerkId: MECHANIEKER, role: "mechanieker" },
    { clubId, clerkId: SOIGNEUR, role: "soigneur" },
    { clubId, clerkId: RENNER, role: "member" },
    { clubId, clerkId: RENNER2, role: "member" },
  ]);
  server = app.listen(0);
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  const races = `/api/clubs/${clubId}/races`;
  const ev = await api(PLOEGLEIDER, "POST", races, { name: `Koers-${T}`, raceDate: "2026-10-10" });
  eventId = ev.json.id;
  const E = `${races}/${eventId}`;
  await api(PLOEGLEIDER, "POST", `${E}/selection`, { clerkId: RENNER, role: "renner" });
  await api(PLOEGLEIDER, "POST", `${E}/selection`, { clerkId: RENNER2, role: "renner" });

  await scenario("dagschema: verplichte velden; staf ziet alles, renner alleen eigen regel", async () => {
    const zonder = await api(PLOEGLEIDER, "PUT", `${E}/schedule/${RENNER}`, { departTime: "08:30" });
    assert(zonder.status === 400, `zonder verzamelpunt: verwacht 400, kreeg ${zonder.status}`);
    const a = await api(PLOEGLEIDER, "PUT", `${E}/schedule/${RENNER}`, {
      departTime: "08:30",
      meetPoint: "Clubhuis",
      returnTime: "18:00",
    });
    assert(a.status === 201, `regel renner: ${a.status}: ${JSON.stringify(a.json)}`);
    const b = await api(PLOEGLEIDER, "PUT", `${E}/schedule/${RENNER2}`, {
      departTime: "09:00",
      meetPoint: "Carpool Noord",
    });
    assert(b.status === 201, `regel renner2: ${b.status}`);
    const staf = await api(SOIGNEUR, "GET", `${E}/schedule`);
    assert(staf.json.length === 2, `staf ziet ${staf.json.length} regels (verwacht 2)`);
    const eigen = await api(RENNER, "GET", `${E}/schedule`);
    assert(eigen.json.length === 1 && eigen.json[0].clerkId === RENNER, "renner ziet alleen eigen regel");
  });

  await scenario("verschuiven eist bevestiging; tijden schuiven mee; hele ploeg bericht", async () => {
    const nocnf = await api(PLOEGLEIDER, "POST", `${E}/schedule/shift`, { minutes: 45 });
    assert(nocnf.status === 400, `zonder confirm: verwacht 400, kreeg ${nocnf.status}`);
    const renner403 = await api(RENNER, "POST", `${E}/schedule/shift`, { minutes: 45, confirm: true });
    assert(renner403.status === 403, `renner: verwacht 403, kreeg ${renner403.status}`);
    const ok = await api(PLOEGLEIDER, "POST", `${E}/schedule/shift`, { minutes: 45, confirm: true });
    assert(ok.status === 200 && ok.json.shifted === 2, `shift: ${ok.status}: ${JSON.stringify(ok.json)}`);
    const rows = await api(PLOEGLEIDER, "GET", `${E}/schedule`);
    const r1 = rows.json.find((r: any) => r.clerkId === RENNER);
    assert(r1.departTime === "09:15" && r1.returnTime === "18:45", `tijden geschoven: ${r1.departTime}/${r1.returnTime}`);
    await new Promise((t) => setTimeout(t, 300));
    const notes = await db
      .select()
      .from(notificationsTable)
      .where(inArray(notificationsTable.clerkId, [RENNER, RENNER2]));
    assert(
      notes.filter((n) => String(n.dedupeKey ?? "").startsWith(`schedule-shift:${eventId}:`)).length >= 2,
      "beide renners kregen bericht",
    );
  });

  await scenario("vervoer: renner ziet hele indeling; overboeking waarschuwt, blokkeert niet", async () => {
    const v = await api(PLOEGLEIDER, "POST", `${E}/vehicles`, { name: "Bus 1", seats: 1 });
    assert(v.status === 201 && v.json.driverClerkId === null, `voertuig (chauffeur optioneel): ${v.status}`);
    const p1 = await api(PLOEGLEIDER, "POST", `${E}/vehicles/${v.json.id}/passengers`, { clerkId: RENNER });
    assert(p1.status === 201 && p1.json.warning === null, `eerste inzittende: ${p1.status}`);
    const p2 = await api(PLOEGLEIDER, "POST", `${E}/vehicles/${v.json.id}/passengers`, { clerkId: RENNER2 });
    assert(p2.status === 201 && typeof p2.json.warning === "string", `overboeking waarschuwt zonder blokkade: ${JSON.stringify(p2.json)}`);
    const zicht = await api(RENNER, "GET", `${E}/vehicles`);
    assert(zicht.json[0].passengers.length === 2, "renner ziet de hele indeling");
  });

  await scenario("materiaal: mechanieker vult (soigneur 403), sjabloon werkt, afvinken idempotent", async () => {
    const s403 = await api(SOIGNEUR, "POST", `${E}/material`, { riderClerkId: RENNER, item: "bidons" });
    assert(s403.status === 403, `soigneur: verwacht 403, kreeg ${s403.status}`);
    const tpl = await api(MECHANIEKER, "POST", `${E}/material-templates`, {
      name: "Standaard koers",
      items: ["reservewielen", "bidons"],
    });
    assert(tpl.status === 201, `sjabloon: ${tpl.status}`);
    const bulk = await api(MECHANIEKER, "POST", `${E}/material`, { riderClerkId: RENNER, templateId: tpl.json.id });
    assert(bulk.status === 201 && bulk.json.length === 2, `sjabloon toegepast: ${JSON.stringify(bulk.json)}`);
    const one = await api(MECHANIEKER, "POST", `${E}/material/${bulk.json[0].id}/loaded`, {});
    assert(one.status === 200 && one.json.loadedAt, `afvinken: ${one.status}`);
    const again = await api(MECHANIEKER, "POST", `${E}/material/${bulk.json[0].id}/loaded`, {});
    assert(again.status === 200 && again.json.loadedAt === one.json.loadedAt, "idempotent afvinken");
  });

  await scenario("vertrekcontrole: open materiaal waarschuwt, na afvinken gereed", async () => {
    const check = await api(PLOEGLEIDER, "GET", `${E}/departure-check`);
    assert(check.status === 200 && check.json.ready === false, `waarschuwing verwacht: ${JSON.stringify(check.json)}`);
    assert(check.json.warnings.some((w: string) => w.includes("materiaal")), "materiaalwaarschuwing aanwezig");
    for (const it of check.json.openMaterial) {
      await api(MECHANIEKER, "POST", `${E}/material/${it.id}/loaded`, {});
    }
    const na = await api(PLOEGLEIDER, "GET", `${E}/departure-check`);
    assert(na.json.ready === true, `na afvinken gereed: ${JSON.stringify(na.json.warnings)}`);
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
