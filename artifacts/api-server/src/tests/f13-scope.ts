// FIN-02 (F13 poortvoorwaarde 2) — geen sporterdata-lek naar de trainer na
// vertrek. Bewijst het herstel uit FIN-01 met een ECHT end-to-end scenario
// tegen de draaiende Express-app (directe API-aanroepen, niet alleen de
// helperfunctie), voor zowel het TEAM- als het GROEP-pad:
//
//   1. Seed: club + team + groep, trainer met team- én groepstoewijzing,
//      renner als actief team-/groepslid; renner geeft consent (training_summary).
//   2. Trainer ziet de renner: assignedAthleteIds bevat hem, GET
//      /trainer/athletes toont hem mét consent=true, en GET
//      /trainer/athletes/:id/summary geeft 200 (consent-gated data).
//   3. Renner verlaat het team (endedAt gezet — rij blijft staan, historie).
//   4. Trainer ziet hem NIET meer via het teampad: assignedAthleteIds bevat hem
//      niet, hij staat niet in GET /trainer/athletes, en de directe
//      summary-aanroep geeft 403. (Groepslidmaatschap nog actief ⇒ nog wél
//      zichtbaar — bewijst dat we per-lidmaatschap filteren.) Daarna verlaat de
//      renner ook de groep: nu volledig weg, summary 403.
//   5. Her-toevoegen aan het team (NIEUWE actieve rij naast de beëindigde)
//      maakt hem weer zichtbaar — bewijst filtering op de ACTIEVE rij, niet op
//      ooit-lid-zijn.
//
// Run: `pnpm --filter @workspace/api-server run test:f13-scope`
// Vereist DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  pool,
  clubsTable,
  clubMembersTable,
  clubTeamMembersTable,
  clubGroupMembersTable,
  athleteProfilesTable,
} from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import { assignedAthleteIds } from "../lib/club-permissions";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({ scenario: name, status: "fail", note: err instanceof Error ? err.message : String(err) });
  }
}

let baseUrl = "";
let server: Server | null = null;

async function startServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else reject(new Error("no address"));
    });
  });
}

async function req(method: string, path: string, actor: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-dev-clerk-id": actor },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* leeg */
  }
  return { status: res.status, json };
}

// ── Fixtures ────────────────────────────────────────────────────────────────
const RUN = `f13scope_${Date.now()}`;
const owner = `dev_${RUN}_owner`;
const trainer = `dev_${RUN}_trainer`;
const renner = `dev_${RUN}_renner`;
const ALL = [owner, trainer, renner];

let clubId = 0;
let teamId = 0;
let groupId = 0;
const memberIds = new Map<string, number>();

// Vindt de renner terug in de trainer-athletes-lijst (directe API-response).
function inTrainerList(list: unknown, who: string): { clerkId: string; consent?: boolean } | undefined {
  if (!Array.isArray(list)) return undefined;
  return (list as Array<{ clerkId: string; consent?: boolean }>).find((a) => a.clerkId === who);
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
    console.error("Deze test draait alleen buiten productie.");
    process.exit(1);
  }

  for (const c of ALL) {
    await ensureAccount(c, `${c}@sparki.test`, `Fixture ${c.slice(-8)}`, silentLogger);
  }
  // De renner is meerderjarig zodat hij zélf consent kan geven (jeugd <16 zou
  // fail-closed zijn en oudertoestemming vereisen — buiten scope van FIN-02).
  await db
    .update(athleteProfilesTable)
    .set({ birthYear: 1990 })
    .where(eq(athleteProfilesTable.clerkId, renner));

  await startServer();

  // Organisatie opzetten (bestaande flow: direct actief).
  const mk = await req("POST", "/api/clubs", owner, { name: `Club ${RUN}` });
  assert(mk.status === 201, `club aanmaken faalde: ${mk.status}`);
  clubId = Number((mk.json as { id: number }).id);
  const joinCode = String((mk.json as { joinCode: string }).joinCode);
  for (const who of [trainer, renner]) {
    const j = await req("POST", "/api/clubs/join", who, { code: joinCode });
    assert(j.status === 200 || j.status === 201, `${who} join faalde: ${j.status}`);
  }
  const members = await db
    .select()
    .from(clubMembersTable)
    .where(and(eq(clubMembersTable.clubId, clubId), isNull(clubMembersTable.endedAt)));
  for (const m of members) memberIds.set(m.clerkId, m.id);

  // Trainer krijgt de trainersrol (owner zet 'm).
  const rt = await req("PUT", `/api/clubs/${clubId}/members/${memberIds.get(trainer)}/role`, owner, { role: "trainer" });
  assert(rt.status === 200, `trainersrol faalde: ${rt.status} ${JSON.stringify(rt.json)}`);

  // Team + groep + toewijzingen + renner als lid + consent.
  await scenario("0. Seed: team+groep, trainer toegewezen, renner lid + consent", async () => {
    const t = await req("POST", `/api/clubs/${clubId}/teams`, owner, { name: `Team ${RUN}` });
    assert(t.status === 201, `team aanmaken: ${t.status}`);
    teamId = Number((t.json as { id: number }).id);
    const g = await req("POST", `/api/clubs/${clubId}/groups`, owner, { name: `Groep ${RUN}` });
    assert(g.status === 201, `groep aanmaken: ${g.status}`);
    groupId = Number((g.json as { id: number }).id);

    const at = await req("POST", `/api/clubs/${clubId}/trainer-assignments`, owner, { trainerClerkId: trainer, teamId });
    assert(at.status === 201, `teamtoewijzing: ${at.status} ${JSON.stringify(at.json)}`);
    const ag = await req("POST", `/api/clubs/${clubId}/trainer-assignments`, owner, { trainerClerkId: trainer, groupId });
    assert(ag.status === 201, `groepstoewijzing: ${ag.status} ${JSON.stringify(ag.json)}`);

    const mt = await req("POST", `/api/clubs/${clubId}/teams/${teamId}/members`, owner, { clerkId: renner });
    assert(mt.status === 201, `renner in team: ${mt.status}`);
    const mg = await req("POST", `/api/clubs/${clubId}/groups/${groupId}/members`, owner, { clerkId: renner });
    assert(mg.status === 201, `renner in groep: ${mg.status}`);

    // Renner geeft zelf consent voor sportdata (training_summary).
    const cs = await req("POST", `/api/clubs/${clubId}/consents`, renner, { action: "grant", scope: "training_summary" });
    assert(cs.status === 200, `consent geven: ${cs.status} ${JSON.stringify(cs.json)}`);
  });

  await scenario("1. Trainer ziet de renner: scope, lijst én consent-gated summary (200)", async () => {
    const ids = await assignedAthleteIds(clubId, trainer);
    assert(ids.includes(renner), `assignedAthleteIds mist de renner: ${ids.join(",")}`);

    const list = await req("GET", `/api/clubs/${clubId}/trainer/athletes`, trainer);
    assert(list.status === 200, `trainer-athletes: ${list.status}`);
    const found = inTrainerList(list.json, renner);
    assert(found, "renner ontbreekt in trainer-athletes-lijst");
    assert(found!.consent === true, "consent staat niet op true in de lijst");

    const summary = await req("GET", `/api/clubs/${clubId}/trainer/athletes/${renner}/summary`, trainer);
    assert(summary.status === 200, `summary vóór vertrek moet 200 zijn, kreeg ${summary.status} ${JSON.stringify(summary.json)}`);
  });

  await scenario("2. Renner verlaat het TEAM (endedAt gezet, rij blijft) — teampad dicht", async () => {
    const upd = await db
      .update(clubTeamMembersTable)
      .set({ endedAt: new Date() })
      .where(and(eq(clubTeamMembersTable.teamId, teamId), eq(clubTeamMembersTable.clerkId, renner), isNull(clubTeamMembersTable.endedAt)))
      .returning();
    assert(upd.length === 1, "verwachtte precies één beëindigde teamlid-rij");
    // Historie blijft: de rij bestaat nog, alleen met endedAt.
    const stillThere = await db
      .select()
      .from(clubTeamMembersTable)
      .where(and(eq(clubTeamMembersTable.teamId, teamId), eq(clubTeamMembersTable.clerkId, renner)));
    assert(stillThere.length === 1 && stillThere[0]!.endedAt != null, "teamlid-rij is verdwenen i.p.v. beëindigd (historie weg)");

    // Groepslidmaatschap is nog actief ⇒ de renner blijft via het GROEPPAD
    // zichtbaar. Dat bewijst dat we per lidmaatschap filteren, niet globaal.
    const ids = await assignedAthleteIds(clubId, trainer);
    assert(ids.includes(renner), "renner viel onterecht volledig weg terwijl groepslidmaatschap nog actief is");
    const summaryGroep = await req("GET", `/api/clubs/${clubId}/trainer/athletes/${renner}/summary`, trainer);
    assert(summaryGroep.status === 200, `via nog-actieve groep hoort summary 200 te zijn, kreeg ${summaryGroep.status}`);
  });

  await scenario("3. Renner verlaat ook de GROEP — volledig uit scope; summary 403", async () => {
    const upd = await db
      .update(clubGroupMembersTable)
      .set({ endedAt: new Date() })
      .where(and(eq(clubGroupMembersTable.groupId, groupId), eq(clubGroupMembersTable.clerkId, renner), isNull(clubGroupMembersTable.endedAt)))
      .returning();
    assert(upd.length === 1, "verwachtte precies één beëindigde groepslid-rij");

    // Helperlaag: leeg (renner niet meer in team of groep).
    const ids = await assignedAthleteIds(clubId, trainer);
    assert(!ids.includes(renner), `renner bleef in assignedAthleteIds na vertrek: ${ids.join(",")}`);

    // Directe API-response: renner NIET in de lijst.
    const list = await req("GET", `/api/clubs/${clubId}/trainer/athletes`, trainer);
    assert(list.status === 200, `trainer-athletes: ${list.status}`);
    assert(!inTrainerList(list.json, renner), "renner bleef zichtbaar in trainer-athletes na vertrek — LEK");

    // Directe summary-aanroep faalt hard, ondanks bestaande consent.
    const summary = await req("GET", `/api/clubs/${clubId}/trainer/athletes/${renner}/summary`, trainer);
    assert(summary.status === 403, `summary na vertrek moet 403 zijn (geen datalek), kreeg ${summary.status} ${JSON.stringify(summary.json)}`);
  });

  await scenario("4. Her-toevoegen (nieuwe actieve rij) maakt de renner weer zichtbaar", async () => {
    const mt = await req("POST", `/api/clubs/${clubId}/teams/${teamId}/members`, owner, { clerkId: renner });
    assert(mt.status === 201, `her-indeling team: ${mt.status} ${JSON.stringify(mt.json)}`);

    // Er staat nu een beëindigde ÉN een nieuwe actieve rij: bewijs dat we op de
    // actieve rij filteren, niet op "ooit lid geweest".
    const rows = await db
      .select()
      .from(clubTeamMembersTable)
      .where(and(eq(clubTeamMembersTable.teamId, teamId), eq(clubTeamMembersTable.clerkId, renner)));
    assert(rows.length === 2, `verwachtte 2 rijen (beëindigd + nieuw actief), kreeg ${rows.length}`);
    assert(rows.filter((r) => r.endedAt == null).length === 1, "verwachtte precies één actieve rij na her-toevoegen");

    const ids = await assignedAthleteIds(clubId, trainer);
    assert(ids.includes(renner), "renner werd niet weer zichtbaar na her-toevoegen");
    const summary = await req("GET", `/api/clubs/${clubId}/trainer/athletes/${renner}/summary`, trainer);
    assert(summary.status === 200, `summary na her-toevoegen moet weer 200 zijn, kreeg ${summary.status}`);
  });

  // ── Opruimen ──────────────────────────────────────────────────────────────
  await db.delete(clubsTable).where(eq(clubsTable.id, clubId));

  server?.close();
  let failed = 0;
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  // eslint-disable-next-line no-console
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("test-run faalde:", err);
  process.exit(1);
});
