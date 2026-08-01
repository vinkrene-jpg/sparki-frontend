// SPARKI_INHAAL_01 BUILD_02 — werkobjectlaag (besluitenpatch hoofdstuk C).
//
// Bewijst via de echte Express-app de bindende regels:
//   1. Ploegleider maakt plan met onderdelen; renner ziet CONCEPT niet.
//   2. Delen door ploegleider: staf krijgt bericht, renner niet.
//   3. Staf vult eigen deel; wie+wanneer zichtbaar; elkaars deel geblokkeerd
//      tenzij de ploegleider dat per plan toestaat.
//   4. Gelijktijdig bewerken: verouderde basisversie ⇒ 409.
//   5. Renner vult eigen deel ⇒ alleen ploegleider bericht.
//   6. Opmerkingen mogen door iedereen (ook renner), per onderdeel.
//   7. Taak afvinken alleen door toegewezene ⇒ ploegleider bericht.
//   8. Afgerond: alleen ploegleider mag nog wijzigen.
//   9. Geschiedenis alleen voor ploegleider.
//  10. Kopiëren: alleen vaste onderdelen, geen inhoud/bezetting.
//  11. Sjabloon vastleggen + plan uit sjabloon.
//
// Run: pnpm --filter @workspace/api-server run test:work-objects

import type { Server } from "node:http";
import {
  db,
  clubsTable,
  clubMembersTable,
  clubRaceEventsTable,
  notificationsTable,
  userProfilesTable,
  athleteProfilesTable,
  workObjectsTable,
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

const T = "wobj";
const PLOEGLEIDER = `test-${T}-ploegleider`;
const SOIGNEUR = `test-${T}-soigneur`;
const MECHANIEKER = `test-${T}-mechanieker`;
const RENNER = `test-${T}-renner`;
const ALL = [PLOEGLEIDER, SOIGNEUR, MECHANIEKER, RENNER];

let server: Server;
let base: string;
let clubId = 0;
let eventId = 0;
let objectId = 0;
let sectionSoigneur = 0;
let sectionRenner = 0;
let sectionVast = 0;

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
  for (const c of clubs) {
    await db.delete(workObjectsTable).where(eq(workObjectsTable.clubId, c.id));
    await db.delete(clubsTable).where(eq(clubsTable.id, c.id));
  }
  await db.delete(notificationsTable).where(inArray(notificationsTable.clerkId, ALL));
  await db.delete(athleteProfilesTable).where(inArray(athleteProfilesTable.clerkId, ALL));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ALL));
}

async function seed() {
  for (const id of ALL) await ensureAccount(id, `${id}@example.test`, id, silentLogger);
  const [club] = await db
    .insert(clubsTable)
    .values({ name: `TESTCLUB-${T}`, ownerClerkId: PLOEGLEIDER, status: "actief" })
    .returning();
  clubId = club!.id;
  await db.insert(clubMembersTable).values([
    // Ploegleider is hier bewust GEEN owner-rol: de laag moet op de
    // ploegleider-rol zelf werken. (Owner-rij apart, ongebruikt.)
    { clubId, clerkId: PLOEGLEIDER, role: "ploegleider" },
    { clubId, clerkId: SOIGNEUR, role: "soigneur" },
    { clubId, clerkId: MECHANIEKER, role: "mechanieker" },
    { clubId, clerkId: RENNER, role: "member" },
  ]);
  const [event] = await db
    .insert(clubRaceEventsTable)
    .values({ clubId, name: `TESTRACE-${T}`, raceDate: "2026-09-12", createdByClerkId: PLOEGLEIDER })
    .returning();
  eventId = event!.id;
}

async function notesFor(clerkId: string, prefix: string) {
  return db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.clerkId, clerkId))
    .then((rows) => rows.filter((r) => String(r.dedupeKey ?? "").startsWith(prefix)));
}

async function main() {
  await cleanup();
  await seed();
  server = app.listen(0);
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  const root = `/api/clubs/${clubId}/work-objects`;

  await scenario("ploegleider maakt plan; renner ziet concept niet, staf wel", async () => {
    const r = await api(PLOEGLEIDER, "POST", root, {
      title: "Koersplan Ronde van Testland",
      eventId,
      sections: [
        { title: "Route & tactiek", vastOnderdeel: true },
        { title: "Verzorging", vastOnderdeel: true },
        { title: "Materiaal renner", vastOnderdeel: false },
      ],
    });
    assert(r.status === 201, `aanmaken: verwacht 201, kreeg ${r.status}: ${JSON.stringify(r.json)}`);
    objectId = r.json.id;
    const rennerList = await api(RENNER, "GET", root);
    assert(rennerList.status === 200 && rennerList.json.length === 0, "renner ziet concept niet");
    const stafList = await api(SOIGNEUR, "GET", root);
    assert(stafList.json.length === 1, "staf ziet concept wel");
    const rennerDetail = await api(RENNER, "GET", `${root}/${objectId}`);
    assert(rennerDetail.status === 404, `renner detail concept: verwacht 404, kreeg ${rennerDetail.status}`);
    // Sectie-eigenaren toewijzen voor vervolg-scenario's.
    const detail = await api(PLOEGLEIDER, "GET", `${root}/${objectId}`);
    sectionVast = detail.json.sections[0].id;
    sectionSoigneur = detail.json.sections[1].id;
    sectionRenner = detail.json.sections[2].id;
    const { workObjectSectionsTable } = await import("@workspace/db");
    await db.update(workObjectSectionsTable).set({ ownerClerkId: SOIGNEUR }).where(eq(workObjectSectionsTable.id, sectionSoigneur));
    await db.update(workObjectSectionsTable).set({ ownerClerkId: RENNER, vastOnderdeel: false }).where(eq(workObjectSectionsTable.id, sectionRenner));
  });

  await scenario("delen: alleen ploegleider; staf krijgt bericht, renner niet", async () => {
    const deny = await api(SOIGNEUR, "POST", `${root}/${objectId}/status`, { status: "gedeeld" });
    assert(deny.status === 403, `soigneur deelt: verwacht 403, kreeg ${deny.status}`);
    const r = await api(PLOEGLEIDER, "POST", `${root}/${objectId}/status`, { status: "gedeeld" });
    assert(r.status === 200 && r.json.status === "gedeeld", `delen: ${r.status}`);
    await new Promise((t) => setTimeout(t, 300)); // fire-and-forget notificaties
    assert((await notesFor(SOIGNEUR, "work-object-shared:")).length === 1, "soigneur kreeg deelbericht");
    assert((await notesFor(MECHANIEKER, "work-object-shared:")).length === 1, "mechanieker kreeg deelbericht");
    assert((await notesFor(RENNER, "work-object-shared:")).length === 0, "renner kreeg GEEN deelbericht");
    const rennerList = await api(RENNER, "GET", root);
    assert(rennerList.json.length === 1, "renner ziet gedeeld plan wel");
  });

  await scenario("staf vult eigen deel (wie+wanneer); elkaars deel geblokkeerd zonder toestemming", async () => {
    const own = await api(SOIGNEUR, "PUT", `${root}/${objectId}/sections/${sectionSoigneur}`, {
      content: "Bidons: 12, gels: 24",
      baseVersion: 0,
    });
    assert(own.status === 200, `eigen deel: verwacht 200, kreeg ${own.status}`);
    assert(own.json.filledByClerkId === SOIGNEUR && own.json.filledAt, "wie+wanneer vastgelegd");
    const other = await api(MECHANIEKER, "PUT", `${root}/${objectId}/sections/${sectionSoigneur}`, {
      content: "x",
      baseVersion: 1,
    });
    assert(other.status === 403, `andermans deel: verwacht 403, kreeg ${other.status}`);
    // Ploegleider staat het per plan toe → dan mag het wel.
    const allow = await api(PLOEGLEIDER, "PUT", `${root}/${objectId}`, { stafMagElkaarsDeel: true });
    assert(allow.status === 200, `toestaan: ${allow.status}`);
    const retry = await api(MECHANIEKER, "PUT", `${root}/${objectId}/sections/${sectionSoigneur}`, {
      content: "Bidons: 12, gels: 24, reservewielen klaar",
      baseVersion: 1,
    });
    assert(retry.status === 200, `na toestemming: verwacht 200, kreeg ${retry.status}`);
  });

  await scenario("gelijktijdig bewerken: verouderde basisversie ⇒ 409 met waarschuwing", async () => {
    const stale = await api(SOIGNEUR, "PUT", `${root}/${objectId}/sections/${sectionSoigneur}`, {
      content: "overschrijf",
      baseVersion: 1, // inmiddels 2
    });
    assert(stale.status === 409, `verwacht 409, kreeg ${stale.status}`);
    assert(typeof stale.json.currentVersion === "number", "409 meldt de actuele versie");
  });

  await scenario("renner vult eigen deel ⇒ alleen ploegleider bericht", async () => {
    const r = await api(RENNER, "PUT", `${root}/${objectId}/sections/${sectionRenner}`, {
      content: "Wens: 54x11, dichte velgen",
      baseVersion: 0,
    });
    assert(r.status === 200, `renner eigen deel: verwacht 200, kreeg ${r.status}`);
    const vreemd = await api(RENNER, "PUT", `${root}/${objectId}/sections/${sectionVast}`, {
      content: "x",
      baseVersion: 0,
    });
    assert(vreemd.status === 403, `renner andermans deel: verwacht 403, kreeg ${vreemd.status}`);
    await new Promise((t) => setTimeout(t, 300));
    assert((await notesFor(PLOEGLEIDER, "work-object-renner:")).length === 1, "ploegleider kreeg bericht");
    assert((await notesFor(SOIGNEUR, "work-object-renner:")).length === 0, "staf kreeg geen renner-bericht");
  });

  await scenario("opmerkingen: iedereen mag, per onderdeel zichtbaar", async () => {
    const c1 = await api(RENNER, "POST", `${root}/${objectId}/sections/${sectionVast}/comments`, {
      body: "Let op de kasseistrook op km 80.",
    });
    assert(c1.status === 201, `renner opmerking: verwacht 201, kreeg ${c1.status}`);
    const detail = await api(PLOEGLEIDER, "GET", `${root}/${objectId}`);
    const comments = detail.json.comments.filter((c: any) => c.sectionId === sectionVast);
    assert(comments.length === 1, "opmerking hangt aan het juiste onderdeel");
  });

  await scenario("taak: alleen toegewezene vinkt af; ploegleider krijgt bericht", async () => {
    const t = await api(PLOEGLEIDER, "POST", `${root}/${objectId}/tasks`, {
      title: "Reservewielen inladen",
      assigneeClerkId: MECHANIEKER,
    });
    assert(t.status === 201, `taak aanmaken: ${t.status}`);
    const wrong = await api(SOIGNEUR, "POST", `${root}/${objectId}/tasks/${t.json.id}/done`);
    assert(wrong.status === 403, `ander vinkt af: verwacht 403, kreeg ${wrong.status}`);
    const done = await api(MECHANIEKER, "POST", `${root}/${objectId}/tasks/${t.json.id}/done`);
    assert(done.status === 200 && done.json.doneAt, `afvinken: ${done.status}`);
    await new Promise((s) => setTimeout(s, 300));
    assert((await notesFor(PLOEGLEIDER, "work-object-task-done:")).length === 1, "ploegleider kreeg afvink-bericht");
  });

  await scenario("afgerond: alleen ploegleider mag nog wijzigen", async () => {
    const r = await api(PLOEGLEIDER, "POST", `${root}/${objectId}/status`, { status: "afgerond" });
    assert(r.status === 200 && r.json.status === "afgerond", `afronden: ${r.status}`);
    const staf = await api(SOIGNEUR, "PUT", `${root}/${objectId}/sections/${sectionSoigneur}`, {
      content: "te laat",
      baseVersion: 2,
    });
    assert(staf.status === 403, `staf na afronding: verwacht 403, kreeg ${staf.status}`);
    const pl = await api(PLOEGLEIDER, "PUT", `${root}/${objectId}/sections/${sectionSoigneur}`, {
      content: "correctie door ploegleider",
      baseVersion: 2,
    });
    assert(pl.status === 200, `ploegleider na afronding: verwacht 200, kreeg ${pl.status}`);
  });

  await scenario("geschiedenis: alleen ploegleider", async () => {
    const deny = await api(SOIGNEUR, "GET", `${root}/${objectId}/history`);
    assert(deny.status === 403, `staf geschiedenis: verwacht 403, kreeg ${deny.status}`);
    const r = await api(PLOEGLEIDER, "GET", `${root}/${objectId}/history`);
    assert(r.status === 200 && r.json.length >= 5, `geschiedenis: ${r.status}, ${r.json?.length} rijen`);
  });

  await scenario("kopiëren: alleen vaste onderdelen, zonder inhoud of bezetting", async () => {
    const r = await api(PLOEGLEIDER, "POST", `${root}/${objectId}/copy`, { title: "Volgende koers" });
    assert(r.status === 201, `kopie: ${r.status}`);
    const detail = await api(PLOEGLEIDER, "GET", `${root}/${r.json.id}`);
    const secties = detail.json.sections;
    assert(secties.length === 2, `alleen vaste onderdelen: verwacht 2, kreeg ${secties.length}`);
    assert(secties.every((s: any) => s.content === "" && s.ownerClerkId == null && s.filledByClerkId == null), "geen inhoud/bezetting mee");
    assert(detail.json.object.status === "concept", "kopie start als concept");
  });

  await scenario("sjabloon vastleggen en plan uit sjabloon starten", async () => {
    const tpl = await api(PLOEGLEIDER, "POST", `${root}/templates`, {
      name: "Standaard koersplan",
      fromObjectId: objectId,
    });
    assert(tpl.status === 201, `sjabloon: ${tpl.status}`);
    const nieuw = await api(SOIGNEUR, "POST", root, {
      title: "Plan uit sjabloon",
      templateId: tpl.json.id,
    });
    assert(nieuw.status === 201, `uit sjabloon: ${nieuw.status}`);
    const detail = await api(SOIGNEUR, "GET", `${root}/${nieuw.json.id}`);
    assert(detail.json.sections.length === 2, "sjabloononderdelen aanwezig");
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
