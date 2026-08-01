// HERSTEL EN AANSLUITING TEAM_ABONNEMENT_01 — organisatie met meerdere teams
// én het herstelde rolmodel (ploegleider apart, medic → medical_staff).
//
// Boot de ECHTE Express-app en bewijs:
//   1.  Eén organisatie kan meerdere teams/selecties aanmaken.
//   2.  Staf per team koppelen (ploegleider als teamverantwoordelijke per team).
//   3.  Sporters per team indelen; één sporter kan in meerdere teams zitten.
//   4.  Organisatiebrede rol (hoofdtrainer) vs teamspecifieke verantwoordelijke.
//   5.  Cross-team fail-closed: teamverantwoordelijke van team A kan team B
//       niet wijzigen en ziet buiten zijn team geen leden.
//   6.  Centraal abonnement + centrale facturatie per organisatie (één
//       club_subscriptions-rij over alle teams heen; geen per-team facturatie).
//   7.  Ploegleider is een APARTE rolwaarde naast teammanager, met
//       trainings-/wedstrijdrechten maar zonder clubbeheer.
//   8.  medical_staff: functietype beschrijvend (geen rechten), onbekend
//       functietype 400, functietype gewist bij rolwissel.
//
// Run: `pnpm --filter @workspace/api-server run test:team-organisatie`
// Vereist DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  clubsTable,
  clubMembersTable,
  clubTeamsTable,
  clubTeamMembersTable,
  clubSubscriptionsTable,
} from "@workspace/db";
import { and, eq, isNull, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  getClubContext,
  canManageClub,
  canManageTrainings,
  canViewConsentedData,
} from "../lib/club-permissions";

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
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* leeg */
  }
  return { status: res.status, json };
}

// ── Fixtures ────────────────────────────────────────────────────────────────
const RUN = `torg_${Date.now()}`;
const owner = `dev_${RUN}_owner`;
const hoofdtrainer = `dev_${RUN}_hoofdtrainer`;
const leiderA = `dev_${RUN}_leider_a`; // ploegleider team A
const leiderB = `dev_${RUN}_leider_b`; // ploegleider team B
const medicus = `dev_${RUN}_medicus`;
const rider1 = `dev_${RUN}_rider1`; // in team A én team B
const rider2 = `dev_${RUN}_rider2`; // alleen team B
const ALL = [owner, hoofdtrainer, leiderA, leiderB, medicus, rider1, rider2];

let clubId = 0;
let teamA = 0;
let teamB = 0;
let selectieA = 0;
const memberIds = new Map<string, number>();

async function setRole(who: string, role: string, extra?: Record<string, unknown>) {
  const id = memberIds.get(who)!;
  return req("PUT", `/api/clubs/${clubId}/members/${id}/role`, owner, { role, ...extra });
}

async function main() {
  for (const c of ALL) {
    await ensureAccount(c, `${c}@sparki.test`, `Fixture ${c.slice(-8)}`, silentLogger);
  }
  await startServer();

  // Organisatie opzetten (bestaande flow: direct actief).
  const mk = await req("POST", "/api/clubs", owner, { name: `Organisatie ${RUN}` });
  assert(mk.status === 201, `club aanmaken faalde: ${mk.status}`);
  clubId = Number(mk.json["id"]);
  const joinCode = String(mk.json["joinCode"]);
  for (const who of ALL.filter((c) => c !== owner)) {
    const j = await req("POST", "/api/clubs/join", who, { code: joinCode });
    assert(j.status === 200 || j.status === 201, `${who} join faalde: ${j.status}`);
  }
  const members = await db
    .select()
    .from(clubMembersTable)
    .where(and(eq(clubMembersTable.clubId, clubId), isNull(clubMembersTable.endedAt)));
  for (const m of members) memberIds.set(m.clerkId, m.id);

  await scenario("1. Eén organisatie, meerdere teams en een selectie", async () => {
    const a = await req("POST", `/api/clubs/${clubId}/teams`, owner, { name: `Team A ${RUN}` });
    assert(a.status === 201, `team A: ${a.status}`);
    teamA = Number(a.json["id"]);
    const b = await req("POST", `/api/clubs/${clubId}/teams`, owner, { name: `Team B ${RUN}` });
    assert(b.status === 201, `team B: ${b.status}`);
    teamB = Number(b.json["id"]);
    const sel = await req("POST", `/api/clubs/${clubId}/teams`, owner, { name: `Selectie A1 ${RUN}`, parentTeamId: teamA });
    assert(sel.status === 201, `selectie: ${sel.status}`);
    selectieA = Number(sel.json["id"]);
    const teams = await db.select().from(clubTeamsTable).where(eq(clubTeamsTable.clubId, clubId));
    assert(teams.length === 3, `${teams.length} teams, verwacht 3`);
  });

  await scenario("2. Staf per team: ploegleiders als teamverantwoordelijke", async () => {
    const rA = await setRole(leiderA, "ploegleider");
    assert(rA.status === 200, `rol ploegleider A: ${rA.status} ${JSON.stringify(rA.json)}`);
    const rB = await setRole(leiderB, "ploegleider");
    assert(rB.status === 200, `rol ploegleider B: ${rB.status}`);
    const rH = await setRole(hoofdtrainer, "hoofdtrainer");
    assert(rH.status === 200, `rol hoofdtrainer: ${rH.status}`);
    // Teamverantwoordelijke per team (managerClerkId).
    await db.update(clubTeamsTable).set({ managerClerkId: leiderA }).where(eq(clubTeamsTable.id, teamA));
    await db.update(clubTeamsTable).set({ managerClerkId: leiderB }).where(eq(clubTeamsTable.id, teamB));
    const teams = await db.select().from(clubTeamsTable).where(inArray(clubTeamsTable.id, [teamA, teamB]));
    assert(teams.every((t) => t.managerClerkId), "teamverantwoordelijke ontbreekt");
  });

  await scenario("3. Sporters per team; één sporter in meerdere teams", async () => {
    for (const [team, who] of [
      [teamA, rider1],
      [teamB, rider1],
      [teamB, rider2],
    ] as const) {
      const r = await req("POST", `/api/clubs/${clubId}/teams/${team}/members`, owner, { clerkId: who });
      assert(r.status === 201, `indeling team ${team}/${who}: ${r.status}`);
    }
    const rows = await db
      .select()
      .from(clubTeamMembersTable)
      .where(and(eq(clubTeamMembersTable.clerkId, rider1), isNull(clubTeamMembersTable.endedAt)));
    assert(rows.length === 2, `rider1 zit in ${rows.length} teams, verwacht 2`);
  });

  await scenario("4. Organisatiebrede vs teamspecifieke rol", async () => {
    // Hoofdtrainer (organisatiebreed) mag élk team indelen.
    const r = await req("POST", `/api/clubs/${clubId}/teams/${selectieA}/members`, hoofdtrainer, { clerkId: rider2 });
    assert(r.status === 201, `hoofdtrainer indeling selectie: ${r.status}`);
    // Ploegleider A mag zijn EIGEN team indelen.
    const own = await req("POST", `/api/clubs/${clubId}/teams/${teamA}/members`, leiderA, { clerkId: rider2 });
    assert(own.status === 201, `ploegleider eigen team: ${own.status}`);
  });

  await scenario("5. Cross-team fail-closed: ander team niet wijzigbaar, leden niet zichtbaar", async () => {
    const cross = await req("POST", `/api/clubs/${clubId}/teams/${teamB}/members`, leiderA, { clerkId: rider1 });
    assert(cross.status === 403, `ploegleider A wijzigde team B (${cross.status}), verwacht 403`);
    // Ledenlijst: teamverantwoordelijke B ziet alleen eigen teamleden + zichzelf.
    const list = await req("GET", `/api/clubs/${clubId}/members`, leiderB);
    assert(list.status === 200, `ledenlijst: ${list.status}`);
    const seen = new Set((list.json as unknown as Array<{ clerkId: string }>).map((m) => m.clerkId));
    assert(seen.has(rider2), "leider B ziet zijn eigen teamlid niet");
    assert(!seen.has(medicus), "leider B ziet een lid buiten zijn team (medicus) — lek");
  });

  await scenario("6. Centraal abonnement + facturatie per organisatie", async () => {
    const subs = await db
      .select()
      .from(clubSubscriptionsTable)
      .where(eq(clubSubscriptionsTable.clubId, clubId));
    assert(subs.length <= 1, `${subs.length} abonnementen op één organisatie — moet centraal (max 1) zijn`);
    // Abonnement/facturatie hangt aan de CLUB (organisatie), nooit aan een team:
    // er bestaat geen per-team facturatiekolom en de ledenlimiet telt clubbreed.
    const teamCols = Object.keys(clubTeamsTable);
    assert(!teamCols.some((c) => /billing|subscription|invoice/i.test(c)), "club_teams draagt facturatievelden — per-team facturatie is niet toegestaan");
  });

  await scenario("7. Ploegleider is een aparte rol naast teammanager", async () => {
    const [row] = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clerkId, leiderA), isNull(clubMembersTable.endedAt)));
    assert(row?.role === "ploegleider", `rol is ${row?.role}, verwacht ploegleider`);
    const ctx = await getClubContext(clubId, leiderA);
    assert(ctx && canManageTrainings(ctx), "ploegleider mist trainings-/wedstrijdrechten");
    assert(ctx && !canManageClub(ctx), "ploegleider heeft clubbeheerrechten — te breed");
    assert(ctx && !canViewConsentedData(ctx), "ploegleider ziet consent-sportdata — te breed");
    // Directe API-toets: ploegleider kan wedstrijden beheren (niet alleen de helper).
    const race = await req("POST", `/api/clubs/${clubId}/races`, leiderA, {
      name: `Koers ${RUN}`,
      raceDate: "2026-09-01",
    });
    assert(race.status === 201, `ploegleider wedstrijd aanmaken: ${race.status} ${JSON.stringify(race.json)}`);
    // Sporter (member) mag dat niet — fail-closed blijft staan.
    const geenRecht = await req("POST", `/api/clubs/${clubId}/races`, rider1, {
      name: `Kaap ${RUN}`,
      raceDate: "2026-09-02",
    });
    assert(geenRecht.status === 403, `sporter kon wedstrijd aanmaken (${geenRecht.status})`);
  });

  await scenario("8. medical_staff: functietype beschrijvend, geen rechten", async () => {
    const bad = await setRole(medicus, "medical_staff", { medicalSpecialty: "tandarts" });
    assert(bad.status === 400, `onbekend functietype kreeg ${bad.status}, verwacht 400`);
    const ok = await setRole(medicus, "medical_staff", { medicalSpecialty: "fysiotherapeut" });
    assert(ok.status === 200, `functietype zetten: ${ok.status}`);
    assert(ok.json["medicalSpecialty"] === "fysiotherapeut", "functietype niet opgeslagen");
    const ctx = await getClubContext(clubId, medicus);
    assert(ctx && !canManageClub(ctx) && !canManageTrainings(ctx) && !canViewConsentedData(ctx),
      "functietype gaf rechten — het is puur beschrijvend");
    // Rolwissel wist het functietype.
    const wissel = await setRole(medicus, "soigneur");
    assert(wissel.status === 200 && wissel.json["medicalSpecialty"] == null, "functietype bleef staan na rolwissel");
    // Oude waarde "medic" bestaat niet meer als geldige rol.
    const oud = await setRole(medicus, "medic");
    assert(oud.status === 400, `oude rol 'medic' kreeg ${oud.status}, verwacht 400`);
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
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("test-run faalde:", err);
  process.exit(1);
});
