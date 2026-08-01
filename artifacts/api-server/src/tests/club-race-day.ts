// SPARKI_INHAAL_01 BUILD_03 — fase Wedstrijddag-inhoud (patch hoofdstuk D).
//
// Bewijst via de echte Express-app:
//   1. Briefings per doelgroep: renner ziet renners+iedereen, soigneur ziet
//      staf+iedereen, ploegleider alles.
//   2. Opdrachten: hele selectie ziet elkaars opdracht; buitenstaander 403;
//      origineel niet bewaard (upsert overschrijft).
//   3. Uitslag: renner vult eigen uitslag; komt in de persoonlijke
//      wedstrijdhistorie (races-rij); andere renner 403.
//   4. Taak weigeren (werkobjectlaag): alleen mét reden, blijft open,
//      ploegleider krijgt bericht.
//   5. Evaluatie: selectie + staf schrijven; sluit een week na de wedstrijd.
//   6. Gasten: link zonder account toont het plan; intrekken maakt hem
//      ongeldig; audit-historie toont dát er een gast was.
//
// Run: pnpm --filter @workspace/api-server run test:club-race-day

import type { Server } from "node:http";
import {
  db,
  clubsTable,
  clubMembersTable,
  clubAuditLogTable,
  notificationsTable,
  racesTable,
  userProfilesTable,
  athleteProfilesTable,
} from "@workspace/db";
import { and, eq, inArray, like } from "drizzle-orm";
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

const T = "crday";
const PLOEGLEIDER = `test-${T}-ploegleider`;
const SOIGNEUR = `test-${T}-soigneur`;
const RENNER = `test-${T}-renner`;
const RENNER2 = `test-${T}-renner2`;
const BUITEN = `test-${T}-buiten`;
const ALL = [PLOEGLEIDER, SOIGNEUR, RENNER, RENNER2, BUITEN];

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
    { clubId, clerkId: SOIGNEUR, role: "soigneur" },
    { clubId, clerkId: RENNER, role: "member" },
    { clubId, clerkId: RENNER2, role: "member" },
    { clubId, clerkId: BUITEN, role: "member" },
  ]);
  server = app.listen(0);
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  const races = `/api/clubs/${clubId}/races`;
  const ev = await api(PLOEGLEIDER, "POST", races, { name: `Koers-${T}`, raceDate: "2026-08-15" });
  eventId = ev.json.id;
  const E = `${races}/${eventId}`;
  await api(PLOEGLEIDER, "POST", `${E}/selection`, { clerkId: RENNER, role: "renner" });
  await api(PLOEGLEIDER, "POST", `${E}/selection`, { clerkId: RENNER2, role: "renner" });
  await api(PLOEGLEIDER, "POST", `${E}/selection`, { clerkId: SOIGNEUR, role: "begeleider" });

  await scenario("briefings per doelgroep gefilterd", async () => {
    for (const [audience, title] of [
      ["renners", "Koersplan"],
      ["staf", "Stafbriefing"],
      ["iedereen", "Algemeen"],
    ] as const) {
      const r = await api(PLOEGLEIDER, "POST", `${E}/briefings`, { audience, title, body: "Inhoud." });
      assert(r.status === 201, `briefing ${audience}: ${r.status}`);
    }
    const renner = await api(RENNER, "GET", `${E}/briefings`);
    assert(
      renner.json.length === 2 && !renner.json.some((b: any) => b.audience === "staf"),
      `renner ziet renners+iedereen: ${JSON.stringify(renner.json.map((b: any) => b.audience))}`,
    );
    const soigneur = await api(SOIGNEUR, "GET", `${E}/briefings`);
    assert(
      soigneur.json.length === 2 && !soigneur.json.some((b: any) => b.audience === "renners"),
      "soigneur ziet staf+iedereen",
    );
    const pl = await api(PLOEGLEIDER, "GET", `${E}/briefings`);
    assert(pl.json.length === 3, "ploegleider ziet alles");
    const rennerPost = await api(RENNER, "POST", `${E}/briefings`, { title: "x", body: "y" });
    assert(rennerPost.status === 403, `renner schrijft niet: ${rennerPost.status}`);
  });

  await scenario("opdrachten: selectie ziet elkaars opdracht; origineel niet bewaard", async () => {
    const a = await api(PLOEGLEIDER, "PUT", `${E}/assignments/${RENNER}`, { body: "Vroege vlucht meegaan." });
    assert(a.status === 201, `opdracht: ${a.status}`);
    await api(PLOEGLEIDER, "PUT", `${E}/assignments/${RENNER2}`, { body: "Sprint aantrekken." });
    const zicht = await api(RENNER2, "GET", `${E}/assignments`);
    assert(zicht.json.length === 2, "renner2 ziet ook de opdracht van renner1");
    const buiten = await api(BUITEN, "GET", `${E}/assignments`);
    assert(buiten.status === 403, `buitenstaander: verwacht 403, kreeg ${buiten.status}`);
    // Overschrijven: origineel niet bewaard.
    await api(PLOEGLEIDER, "PUT", `${E}/assignments/${RENNER}`, { body: "Nieuw plan: waaiers." });
    const na = await api(RENNER, "GET", `${E}/assignments`);
    const mijn = na.json.find((x: any) => x.riderClerkId === RENNER);
    assert(mijn.body === "Nieuw plan: waaiers." && na.json.length === 2, "origineel overschreven, geen kopie");
  });

  await scenario("uitslag: renner vult zelf in; komt in persoonlijke historie; ander 403", async () => {
    const ander = await api(RENNER2, "PUT", `${E}/results/${RENNER}`, { position: 5 });
    assert(ander.status === 403, `andere renner: verwacht 403, kreeg ${ander.status}`);
    const zelf = await api(RENNER, "PUT", `${E}/results/${RENNER}`, { position: 7, note: "Goede koers" });
    assert(zelf.status === 201, `zelf invullen: ${zelf.status}: ${JSON.stringify(zelf.json)}`);
    const [personal] = await db
      .select()
      .from(racesTable)
      .where(and(eq(racesTable.clerkId, RENNER), eq(racesTable.clubEventId, eventId)));
    assert(personal, "persoonlijke race-rij bestaat");
    assert(
      (personal!.result as any)?.position === 7,
      `uitslag in persoonlijke historie: ${JSON.stringify(personal!.result)}`,
    );
  });

  await scenario("taak weigeren: alleen mét reden, blijft open, ploegleider bericht", async () => {
    const wo = await api(PLOEGLEIDER, "POST", `/api/clubs/${clubId}/work-objects`, {
      title: `Plan ${T}`,
      eventId,
    });
    assert(wo.status === 201, `werkobject: ${wo.status}: ${JSON.stringify(wo.json)}`);
    const objId = wo.json.id;
    const task = await api(PLOEGLEIDER, "POST", `/api/clubs/${clubId}/work-objects/${objId}/tasks`, {
      title: "Bidons vullen",
      assigneeClerkId: SOIGNEUR,
    });
    assert(task.status === 201, `taak: ${task.status}`);
    const zonder = await api(SOIGNEUR, "POST", `/api/clubs/${clubId}/work-objects/${objId}/tasks/${task.json.id}/decline`, {});
    assert(zonder.status === 400, `zonder reden: verwacht 400, kreeg ${zonder.status}`);
    const met = await api(SOIGNEUR, "POST", `/api/clubs/${clubId}/work-objects/${objId}/tasks/${task.json.id}/decline`, {
      reason: "Ik ben er die dag niet.",
    });
    assert(met.status === 200 && met.json.declinedAt && met.json.doneAt === null, "geweigerd maar blijft open");
    await new Promise((t) => setTimeout(t, 300));
    const notes = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.clerkId, PLOEGLEIDER));
    assert(
      notes.some((n) => n.dedupeKey === `task-declined:${task.json.id}`),
      "ploegleider kreeg weiger-bericht",
    );
  });

  await scenario("evaluatie: selectie+staf schrijven; sluit een week na de wedstrijd", async () => {
    const r = await api(RENNER, "POST", `${E}/evaluations`, { body: "Sterke ploeg vandaag." });
    assert(r.status === 201, `renner evalueert: ${r.status}`);
    const s = await api(SOIGNEUR, "POST", `${E}/evaluations`, { body: "Verzorging liep goed." });
    assert(s.status === 201, `soigneur evalueert: ${s.status}`);
    // Oude wedstrijd (meer dan een week geleden) ⇒ gesloten.
    const oud = await api(PLOEGLEIDER, "POST", races, { name: `Oude-${T}`, raceDate: "2026-07-01" });
    await api(PLOEGLEIDER, "POST", `${races}/${oud.json.id}/selection`, { clerkId: RENNER, role: "renner" });
    const dicht = await api(RENNER, "POST", `${races}/${oud.json.id}/evaluations`, { body: "te laat" });
    assert(dicht.status === 403, `gesloten evaluatie: verwacht 403, kreeg ${dicht.status}`);
  });

  await scenario("gast: link zonder account, intrekbaar, historie toont gast", async () => {
    // Zonder verantwoordelijkheidsvinkje geen uitnodiging.
    const geenVink = await api(PLOEGLEIDER, "POST", `${E}/guests`, { email: "gast@example.test" });
    assert(geenVink.status === 400, `zonder vinkje: verwacht 400, kreeg ${geenVink.status}`);
    const inv = await api(PLOEGLEIDER, "POST", `${E}/guests`, {
      email: "gast@example.test",
      responsible: true,
    });
    assert(inv.status === 201 && inv.json.guestUrl, `uitnodigen: ${inv.status}`);
    // Zonder account (geen x-dev-clerk-id) het plan bekijken.
    const view = await fetch(`${base}${inv.json.guestUrl}`);
    const plan = (await view.json()) as any;
    assert(view.status === 200 && plan.readonly === true, `gastweergave: ${view.status}`);
    assert(plan.event.name === `Koers-${T}` && Array.isArray(plan.assignments), "gast ziet het hele plan");
    const audits = await db
      .select()
      .from(clubAuditLogTable)
      .where(and(eq(clubAuditLogTable.clubId, clubId), eq(clubAuditLogTable.action, "wedstrijd_gast_uitgenodigd")));
    assert(audits.length === 1, "historie toont dát er een gast was");
    const rev = await api(PLOEGLEIDER, "DELETE", `${E}/guests/${inv.json.id}`);
    assert(rev.status === 200, `intrekken: ${rev.status}`);
    const na = await fetch(`${base}${inv.json.guestUrl}`);
    assert(na.status === 404, `na intrekken ongeldig: verwacht 404, kreeg ${na.status}`);
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
