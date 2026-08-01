// TEAM_ONBOARDING_01 — zelfstandige Team-organisatie: van registratie tot
// actief team, op de BESTAANDE clubs-container.
//
// Boot de ECHTE Express-app en bewijs:
//   1.  Organisatietype: TEAM aanmaken in concept; onbekend type = 400;
//       weggelaten type blijft CLUB (bestaand gedrag ongemoeid).
//   2.  Organogram-kaarten: catalogus bevat 4 kaarten met uitsluitend
//       bestaande server-side rollen en zonder voorbeeldpersonen.
//   3.  Kaart toepassen maakt selecties + stafplekken; idempotent (tweede
//       keer voegt niets toe); onbekende kaart = 400.
//   4.  Kaart wisselen op een organisatie mét bestaande structuur is
//       uitsluitend additief — bestaande selecties/plekken blijven staan.
//   5.  Stafplekken: rol gevalideerd, functietype alleen bij medical_staff,
//       plek verwijderen raakt nooit een lidmaatschap.
//   6.  Vaste seizoensstaf in concept direct toewijzen (teammanager en
//       ploegleider apart; medical_staff mét functietype, zonder rechten).
//   7.  Hervatbare onboarding: GET /onboarding weerspiegelt de echte
//       toestand (organisationType, organogram, stafplekken, missing).
//   8.  Activatie: geblokkeerd zolang er iets ontbreekt (422), daarna
//       concept→actief; join met teamcode pas na activatie.
//   9.  Rolgestuurde eerste login: staf en renners zien de organisatie met
//       hun eigen rol terug in /api/clubs/mine.
//  10.  Isolatie: beheerder van organisatie A kan structuur van B niet
//       lezen of wijzigen (fail-closed).
//
// Run: `pnpm --filter @workspace/api-server run test:team-onboarding`
// Vereist DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  clubsTable,
  clubMembersTable,
  clubTeamsTable,
  clubTeamMembersTable,
  organisationStaffSlotsTable,
} from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import { getClubContext, canManageClub, canManageTrainings } from "../lib/club-permissions";

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
const RUN = `tob_${Date.now()}`;
const owner = `dev_${RUN}_owner`;
const manager = `dev_${RUN}_manager`; // teammanager
const leider = `dev_${RUN}_leider`; // ploegleider
const arts = `dev_${RUN}_arts`; // medical_staff
const renner = `dev_${RUN}_renner`;
const vreemde = `dev_${RUN}_vreemde`; // eigenaar van organisatie B
const ALL = [owner, manager, leider, arts, renner, vreemde];

let teamOrgId = 0; // organisatie A (TEAM)
let clubBId = 0; // organisatie B (isolatie)
const cleanupIds: number[] = [];

async function main() {
  for (const c of ALL) {
    await ensureAccount(c, `${c}@sparki.test`, `Fixture ${c.slice(-8)}`, silentLogger);
  }
  await startServer();

  await scenario("1. Organisatietype: TEAM in concept, onbekend = 400, default = CLUB", async () => {
    const bad = await req("POST", "/api/clubs", owner, { name: `X ${RUN}`, organisationType: "PLOEGJE" });
    assert(bad.status === 400, `onbekend type kreeg ${bad.status}, verwacht 400`);
    const mk = await req("POST", "/api/clubs", owner, {
      name: `Wedstrijdteam ${RUN}`,
      concept: true,
      organisationType: "TEAM",
    });
    assert(mk.status === 201, `team aanmaken faalde: ${mk.status} ${JSON.stringify(mk.json)}`);
    teamOrgId = Number(mk.json["id"]);
    cleanupIds.push(teamOrgId);
    assert(mk.json["organisationType"] === "TEAM", "organisationType niet TEAM");
    assert(mk.json["status"] === "concept", "team start niet in concept");
    const mkB = await req("POST", "/api/clubs", vreemde, { name: `Club B ${RUN}` });
    assert(mkB.status === 201, `club B: ${mkB.status}`);
    clubBId = Number(mkB.json["id"]);
    cleanupIds.push(clubBId);
    assert(mkB.json["organisationType"] === "CLUB", "default is niet CLUB");
  });

  await scenario("2. Organogram-catalogus: 4 kaarten, alleen echte rollen, geen personen", async () => {
    const cat = await req("GET", "/api/clubs/organogram-templates", owner);
    assert(cat.status === 200, `catalogus: ${cat.status}`);
    const templates = cat.json["templates"] as { key: string; staf: { role: string }[]; selecties: string[] }[];
    assert(templates.length === 4, `${templates.length} kaarten, verwacht 4`);
    const keys = templates.map((t) => t.key);
    for (const k of ["compact_wedstrijdteam", "prestatieploeg", "etappe_koersorganisatie", "zelf_samenstellen"]) {
      assert(keys.includes(k), `kaart ${k} ontbreekt`);
    }
    const raw = JSON.stringify(templates).toLowerCase();
    for (const verboden of ["jan ", "piet", "voorbeeldpersoon", "john"]) {
      assert(!raw.includes(verboden), `kaart bevat mock-persoon: ${verboden}`);
    }
  });

  await scenario("3. Kaart toepassen: structuur ontstaat, idempotent, onbekend = 400", async () => {
    const bad = await req("POST", `/api/clubs/${teamOrgId}/organogram`, owner, { template: "bestaat_niet" });
    assert(bad.status === 400, `onbekende kaart kreeg ${bad.status}`);
    const eerste = await req("POST", `/api/clubs/${teamOrgId}/organogram`, owner, { template: "compact_wedstrijdteam" });
    assert(eerste.status === 200, `toepassen: ${eerste.status} ${JSON.stringify(eerste.json)}`);
    assert(Number(eerste.json["selectiesToegevoegd"]) === 1, "verwacht 1 selectie");
    assert(Number(eerste.json["slotsToegevoegd"]) === 4, "verwacht 4 stafplekken");
    const tweede = await req("POST", `/api/clubs/${teamOrgId}/organogram`, owner, { template: "compact_wedstrijdteam" });
    assert(tweede.status === 200 && Number(tweede.json["selectiesToegevoegd"]) === 0 && Number(tweede.json["slotsToegevoegd"]) === 0,
      `niet idempotent: ${JSON.stringify(tweede.json)}`);
  });

  await scenario("4. Kaart wisselen is additief, nooit destructief", async () => {
    const teamsVoor = await db.select().from(clubTeamsTable).where(eq(clubTeamsTable.clubId, teamOrgId));
    const slotsVoor = await db.select().from(organisationStaffSlotsTable).where(eq(organisationStaffSlotsTable.clubId, teamOrgId));
    const wissel = await req("POST", `/api/clubs/${teamOrgId}/organogram`, owner, { template: "etappe_koersorganisatie" });
    assert(wissel.status === 200, `wissel: ${wissel.status}`);
    const teamsNa = await db.select().from(clubTeamsTable).where(eq(clubTeamsTable.clubId, teamOrgId));
    const slotsNa = await db.select().from(organisationStaffSlotsTable).where(eq(organisationStaffSlotsTable.clubId, teamOrgId));
    for (const t of teamsVoor) assert(teamsNa.some((n) => n.id === t.id), `selectie ${t.name} verdween`);
    for (const s of slotsVoor) assert(slotsNa.some((n) => n.id === s.id), `stafplek ${s.id} verdween`);
    // Etappe-kaart vult ploegleiders aan tot 3, mechaniekers tot 2, soigneurs tot 3, + arts.
    const perRol = new Map<string, number>();
    for (const s of slotsNa) perRol.set(s.role, (perRol.get(s.role) ?? 0) + 1);
    assert((perRol.get("ploegleider") ?? 0) === 3, `ploegleider-plekken: ${perRol.get("ploegleider")}`);
    assert((perRol.get("medical_staff") ?? 0) === 1, "arts-plek ontbreekt");
  });

  await scenario("5. Stafplekken: validatie + verwijderen raakt geen lidmaatschap", async () => {
    const badRole = await req("POST", `/api/clubs/${teamOrgId}/staff-slots`, owner, { role: "chauffeur" });
    assert(badRole.status === 400, `onbekende rol kreeg ${badRole.status}`);
    const badSpec = await req("POST", `/api/clubs/${teamOrgId}/staff-slots`, owner, { role: "soigneur", medicalSpecialty: "arts" });
    assert(badSpec.status === 400, "functietype bij niet-medische rol toegestaan");
    const badMed = await req("POST", `/api/clubs/${teamOrgId}/staff-slots`, owner, { role: "medical_staff", medicalSpecialty: "tandarts" });
    assert(badMed.status === 400, "onbekend functietype toegestaan");
    const ok = await req("POST", `/api/clubs/${teamOrgId}/staff-slots`, owner, { role: "medical_staff", medicalSpecialty: "fysiotherapeut" });
    assert(ok.status === 201, `stafplek: ${ok.status}`);
    const ledenVoor = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, teamOrgId), isNull(clubMembersTable.endedAt)));
    const del = await req("DELETE", `/api/clubs/${teamOrgId}/staff-slots/${ok.json["id"]}`, owner);
    assert(del.status === 200, `verwijderen: ${del.status}`);
    const ledenNa = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, teamOrgId), isNull(clubMembersTable.endedAt)));
    assert(ledenNa.length === ledenVoor.length, "plek verwijderen raakte lidmaatschappen");
  });

  await scenario("6. Vaste seizoensstaf in concept: aparte rollen, functietype zonder rechten", async () => {
    const mgr = await req("POST", `/api/clubs/${teamOrgId}/onboarding/managers`, owner, { email: `${manager}@sparki.test`, role: "teammanager" });
    assert(mgr.status === 201, `teammanager: ${mgr.status} ${JSON.stringify(mgr.json)}`);
    const pl = await req("POST", `/api/clubs/${teamOrgId}/onboarding/managers`, owner, { email: `${leider}@sparki.test`, role: "ploegleider" });
    assert(pl.status === 201, `ploegleider: ${pl.status}`);
    const badSpec = await req("POST", `/api/clubs/${teamOrgId}/onboarding/managers`, owner, { email: `${arts}@sparki.test`, role: "medical_staff", medicalSpecialty: "tandarts" });
    assert(badSpec.status === 400, "onbekend functietype toegestaan bij staf-toewijzing");
    const med = await req("POST", `/api/clubs/${teamOrgId}/onboarding/managers`, owner, { email: `${arts}@sparki.test`, role: "medical_staff", medicalSpecialty: "arts" });
    assert(med.status === 201, `medische staf: ${med.status}`);
    const rows = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, teamOrgId), isNull(clubMembersTable.endedAt)));
    const rollen = new Map(rows.map((r) => [r.clerkId, r]));
    assert(rollen.get(manager)?.role === "teammanager", "teammanager-rol ontbreekt");
    assert(rollen.get(leider)?.role === "ploegleider", "ploegleider-rol ontbreekt (aparte rol!)");
    assert(rollen.get(arts)?.role === "medical_staff" && rollen.get(arts)?.medicalSpecialty === "arts", "functietype niet opgeslagen");
    const ctx = await getClubContext(teamOrgId, arts);
    assert(ctx && !canManageClub(ctx) && !canManageTrainings(ctx), "medische staf kreeg rechten via functietype");
  });

  await scenario("7. Hervatbare onboarding weerspiegelt echte toestand", async () => {
    const ob = await req("GET", `/api/clubs/${teamOrgId}/onboarding`, owner);
    assert(ob.status === 200, `onboarding: ${ob.status}`);
    assert(ob.json["organisationType"] === "TEAM", "organisationType ontbreekt");
    const steps = ob.json["steps"] as Record<string, unknown>;
    assert(steps["organogram"] === true, "organogram-stap niet waar na kaartkeuze");
    assert(Number(steps["stafplekken"]) > 0, "stafplekken niet geteld");
    assert(Number(steps["teams"]) >= 1, "selecties niet geteld");
    // Contact ontbreekt nog bewust → eerlijk in missing.
    const missing = ob.json["missing"] as string[];
    assert(missing.some((m) => m.toLowerCase().includes("contact")), "ontbrekend contact niet gemeld");
  });

  await scenario("8. Activatie: 422 zolang iets ontbreekt, daarna actief + join mogelijk", async () => {
    const teVroeg = await req("POST", `/api/clubs/${teamOrgId}/activate`, owner);
    assert(teVroeg.status === 422, `activatie zonder contact kreeg ${teVroeg.status}, verwacht 422`);
    const fix = await req("PUT", `/api/clubs/${teamOrgId}`, owner, { contactEmail: `${owner}@sparki.test` });
    assert(fix.status === 200, `contact zetten: ${fix.status}`);
    // Join met teamcode vóór activatie faalt (concept onzichtbaar).
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, teamOrgId));
    const joinVroeg = await req("POST", "/api/clubs/join", renner, { code: club!.joinCode! });
    assert(joinVroeg.status >= 400, `join in concept kreeg ${joinVroeg.status}`);
    const act = await req("POST", `/api/clubs/${teamOrgId}/activate`, owner);
    assert(act.status === 200 && act.json["status"] === "actief", `activatie: ${act.status} ${JSON.stringify(act.json)}`);
    const join = await req("POST", "/api/clubs/join", renner, { code: club!.joinCode! });
    assert(join.status === 200 || join.status === 201, `join na activatie: ${join.status} ${JSON.stringify(join.json)}`);
  });

  await scenario("9. Rolgestuurde eerste login: iedereen ziet de organisatie met eigen rol", async () => {
    for (const [who, rol] of [
      [manager, "teammanager"],
      [leider, "ploegleider"],
      [arts, "medical_staff"],
      [renner, "member"],
    ] as const) {
      const mine = await req("GET", "/api/clubs", who);
      assert(mine.status === 200, `${who} mine: ${mine.status}`);
      const list = mine.json as unknown as { club: { id: number }; membership: { role: string } }[];
      const hit = (Array.isArray(list) ? list : []).find((r) => r.club.id === teamOrgId);
      assert(hit, `${rol} ziet de teamorganisatie niet na login`);
      assert(hit!.membership.role === rol, `${who} heeft rol ${hit!.membership.role}, verwacht ${rol}`);
    }
  });

  await scenario("10. Isolatie: beheerder van B kan structuur van A niet lezen of wijzigen", async () => {
    const lees = await req("GET", `/api/clubs/${teamOrgId}/staff-slots`, vreemde);
    assert(lees.status === 403, `vreemde las stafplekken (${lees.status})`);
    const schrijf = await req("POST", `/api/clubs/${teamOrgId}/organogram`, vreemde, { template: "prestatieploeg" });
    assert(schrijf.status === 403, `vreemde paste kaart toe (${schrijf.status})`);
    const slot = await req("POST", `/api/clubs/${teamOrgId}/staff-slots`, vreemde, { role: "ploegleider" });
    assert(slot.status === 403, `vreemde maakte stafplek (${slot.status})`);
  });

  await scenario("11. TEAM-gate: een CLUB kan geen organogram of stafplekken krijgen", async () => {
    const kaart = await req("POST", `/api/clubs/${clubBId}/organogram`, vreemde, { template: "compact_wedstrijdteam" });
    assert(kaart.status === 409, `club paste kaart toe (${kaart.status}), verwacht 409`);
    const slot = await req("POST", `/api/clubs/${clubBId}/staff-slots`, vreemde, { role: "ploegleider" });
    assert(slot.status === 409, `club maakte stafplek (${slot.status}), verwacht 409`);
  });

  await scenario("12. Medische plekken tellen per functietype: fysio vervult nooit de arts-plek", async () => {
    const mk = await req("POST", "/api/clubs", owner, { name: `Etappeteam ${RUN}`, concept: true, organisationType: "TEAM" });
    assert(mk.status === 201, `team C: ${mk.status}`);
    const orgC = Number(mk.json["id"]);
    cleanupIds.push(orgC);
    const fysio = await req("POST", `/api/clubs/${orgC}/staff-slots`, owner, { role: "medical_staff", medicalSpecialty: "fysiotherapeut" });
    assert(fysio.status === 201, `fysio-plek: ${fysio.status}`);
    const kaart = await req("POST", `/api/clubs/${orgC}/organogram`, owner, { template: "etappe_koersorganisatie" });
    assert(kaart.status === 200, `kaart: ${kaart.status}`);
    const slots = await db.select().from(organisationStaffSlotsTable).where(eq(organisationStaffSlotsTable.clubId, orgC));
    const medisch = slots.filter((s) => s.role === "medical_staff");
    assert(medisch.some((s) => s.medicalSpecialty === "arts"), "arts-plek ontbreekt naast bestaande fysio-plek");
    assert(medisch.some((s) => s.medicalSpecialty === "fysiotherapeut"), "fysio-plek verdween");
    const nogmaals = await req("POST", `/api/clubs/${orgC}/organogram`, owner, { template: "etappe_koersorganisatie" });
    assert(Number(nogmaals.json["slotsToegevoegd"]) === 0, `niet idempotent na functietype-aanvulling: ${JSON.stringify(nogmaals.json)}`);
  });

  await scenario("13. Gelijktijdig toepassen blijft idempotent (geen dubbele plekken)", async () => {
    const mk = await req("POST", "/api/clubs", owner, { name: `Parallelteam ${RUN}`, concept: true, organisationType: "TEAM" });
    assert(mk.status === 201, `team D: ${mk.status}`);
    const orgD = Number(mk.json["id"]);
    cleanupIds.push(orgD);
    const [a, b] = await Promise.all([
      req("POST", `/api/clubs/${orgD}/organogram`, owner, { template: "compact_wedstrijdteam" }),
      req("POST", `/api/clubs/${orgD}/organogram`, owner, { template: "compact_wedstrijdteam" }),
    ]);
    assert(a.status === 200 && b.status === 200, `parallel: ${a.status}/${b.status}`);
    const slots = await db.select().from(organisationStaffSlotsTable).where(eq(organisationStaffSlotsTable.clubId, orgD));
    assert(slots.length === 4, `verwacht 4 stafplekken na parallel toepassen, kreeg ${slots.length}`);
    const teams = await db.select().from(clubTeamsTable).where(eq(clubTeamsTable.clubId, orgD));
    assert(teams.length === 1, `verwacht 1 selectie na parallel toepassen, kreeg ${teams.length}`);
  });

  await scenario("14. Parallelle teams: elk team eigen bezetting, stafbasis en uitnodigingen", async () => {
    // Organisatie A is inmiddels actief en heeft één selectie uit de kaart.
    const bestaand = await db.select().from(clubTeamsTable).where(eq(clubTeamsTable.clubId, teamOrgId));
    assert(bestaand.length >= 1, "geen bestaande selectie in organisatie A");
    const teamA = bestaand[0]!;
    const mkB = await req("POST", `/api/clubs/${teamOrgId}/teams`, owner, { name: `U23 ${RUN}` });
    assert(mkB.status === 201, `tweede selectie: ${mkB.status} ${JSON.stringify(mkB.json)}`);
    const teamBId = Number(mkB.json["id"] ?? (mkB.json["team"] as Record<string, unknown> | undefined)?.["id"]);
    assert(Number.isFinite(teamBId) && teamBId !== teamA.id, "tweede selectie kreeg geen eigen id");

    // Eigen seizoensbezetting per team.
    const bezA = await req("POST", `/api/clubs/${teamOrgId}/teams/${teamA.id}/members`, owner, { clerkId: renner });
    assert([200, 201].includes(bezA.status), `bezetting team A: ${bezA.status}`);
    const bezB = await req("POST", `/api/clubs/${teamOrgId}/teams/${teamBId}/members`, owner, { clerkId: leider });
    assert([200, 201].includes(bezB.status), `bezetting team B: ${bezB.status}`);

    // Eigen stafbasis per team.
    const stafA = await req("POST", `/api/clubs/${teamOrgId}/staff-slots`, owner, { role: "mechanieker", teamId: teamA.id });
    assert(stafA.status === 201, `stafplek team A: ${stafA.status}`);
    const stafB = await req("POST", `/api/clubs/${teamOrgId}/staff-slots`, owner, { role: "soigneur", teamId: teamBId });
    assert(stafB.status === 201, `stafplek team B: ${stafB.status}`);
    const slots = await db
      .select()
      .from(organisationStaffSlotsTable)
      .where(eq(organisationStaffSlotsTable.clubId, teamOrgId));
    assert(slots.some((s) => s.teamId === teamA.id && s.role === "mechanieker"), "stafbasis team A ontbreekt");
    assert(slots.some((s) => s.teamId === teamBId && s.role === "soigneur"), "stafbasis team B ontbreekt");

    // Eigen uitnodiging per team: teamId reist mee en accepteren landt in
    // precies díé selectie. Onbestaande selectie = eerlijke 404.
    const fout = await req("POST", "/api/invitations", owner, { relationship: "club_member", clubId: teamOrgId, teamId: 99999999 });
    assert(fout.status === 404, `onbestaande selectie kreeg ${fout.status}, verwacht 404`);
    const invB = await req("POST", "/api/invitations", owner, { relationship: "club_member", clubId: teamOrgId, teamId: teamBId });
    assert(invB.status === 201, `uitnodiging team B: ${invB.status} ${JSON.stringify(invB.json)}`);
    assert(Number(invB.json["teamId"]) === teamBId, "uitnodiging draagt teamId niet");
    const nieuw = `dev_${RUN}_u23renner`;
    await ensureAccount(nieuw, `${nieuw}@sparki.test`, "Fixture U23", silentLogger);
    const acc = await req("POST", `/api/invitations/${invB.json["token"]}/accept`, nieuw);
    assert(acc.status === 200, `accept: ${acc.status} ${JSON.stringify(acc.json)}`);
    const rows = await db
      .select({ teamId: clubTeamMembersTable.teamId })
      .from(clubTeamMembersTable)
      .where(and(eq(clubTeamMembersTable.clerkId, nieuw), isNull(clubTeamMembersTable.endedAt)));
    assert(rows.length === 1 && rows[0]!.teamId === teamBId, `nieuw lid landde in ${JSON.stringify(rows)}, verwacht team B`);
  });

  await scenario("15. Rolgestuurde start: alle acht rollen krijgen eerste actie of eerlijke lege toestand", async () => {
    // Extra rollen direct toewijzen (trainer, mechanieker, soigneur, gast).
    const extra: [string, string][] = [
      [`dev_${RUN}_trainer`, "trainer"],
      [`dev_${RUN}_mech`, "mechanieker"],
      [`dev_${RUN}_soigneur`, "soigneur"],
      [`dev_${RUN}_gast`, "alleen_lezen"],
    ];
    for (const [who, rol] of extra) {
      await ensureAccount(who, `${who}@sparki.test`, `Fixture ${rol}`, silentLogger);
      await db.insert(clubMembersTable).values({ clubId: teamOrgId, clerkId: who, role: rol });
    }
    const rollen: [string, string][] = [
      [manager, "teammanager"],
      [leider, "ploegleider"],
      [arts, "medical_staff"],
      [renner, "member"],
      ...extra,
    ];
    for (const [who, rol] of rollen) {
      const start = await req("GET", `/api/clubs/${teamOrgId}/start`, who);
      assert(start.status === 200, `${rol} start: ${start.status}`);
      assert(start.json["role"] === rol, `${who} kreeg rol ${start.json["role"]}, verwacht ${rol}`);
      assert(typeof start.json["rolLabel"] === "string" && (start.json["rolLabel"] as string).length > 0, `${rol}: rolLabel ontbreekt`);
      assert(typeof start.json["werkgebied"] === "string" && (start.json["werkgebied"] as string).length > 0, `${rol}: werkgebied ontbreekt`);
      const actie = start.json["eersteActie"] as Record<string, unknown> | null;
      const leeg = start.json["legeToestand"] as Record<string, unknown> | null;
      assert((actie != null) !== (leeg != null), `${rol}: verwacht PRECIES één van eersteActie/legeToestand`);
      if (actie) {
        for (const veld of ["label", "uitleg", "doel"]) {
          assert(typeof actie[veld] === "string" && (actie[veld] as string).length > 0, `${rol}: eersteActie.${veld} ontbreekt`);
        }
      } else if (leeg) {
        for (const veld of ["soort", "watOntbreekt", "waarom", "wie", "vervolgstap"]) {
          assert(typeof leeg[veld] === "string" && (leeg[veld] as string).length > 0, `${rol}: legeToestand.${veld} ontbreekt`);
        }
      }
      // Buitenstaander blijft buiten: geen start zonder lidmaatschap.
      const buiten = await req("GET", `/api/clubs/${teamOrgId}/start`, vreemde);
      assert(buiten.status === 403, `vreemde kreeg start (${buiten.status}), verwacht 403`);
    }
    // Gast krijgt de "werkelijk geen open acties"-toestand, medical_staff de
    // toestemmingstoestand, mechanieker/soigneur de niet-toegewezen-toestand.
    const gast = await req("GET", `/api/clubs/${teamOrgId}/start`, extra[3]![0]);
    assert((gast.json["legeToestand"] as Record<string, unknown>)["soort"] === "geen_open_acties", "gast mist geen_open_acties");
    const med = await req("GET", `/api/clubs/${teamOrgId}/start`, arts);
    assert((med.json["legeToestand"] as Record<string, unknown>)["soort"] === "geen_toestemming", "medical_staff mist geen_toestemming");
    const mech = await req("GET", `/api/clubs/${teamOrgId}/start`, extra[1]![0]);
    assert((mech.json["legeToestand"] as Record<string, unknown>)["soort"] === "niet_toegewezen", "mechanieker mist niet_toegewezen");
    // Toewijzing verandert de toestand eerlijk: de ploegleider is in
    // scenario 14 aan team B toegewezen en krijgt dus een echte eerste actie.
    const pl = await req("GET", `/api/clubs/${teamOrgId}/start`, leider);
    assert(pl.json["eersteActie"] != null, "toegewezen ploegleider mist een eerste actie");
  });

  await scenario("16. Team-uitnodiging faalt eerlijk: verdwenen selectie en volle selectie", async () => {
    // Verdwenen selectie: uitnodiging wijst naar een selectie die daarna is
    // verwijderd → accept faalt (409) en er ontstaat GEEN lidmaatschap.
    const mkC = await req("POST", `/api/clubs/${teamOrgId}/teams`, owner, { name: `Tijdelijk ${RUN}` });
    assert(mkC.status === 201, `selectie C: ${mkC.status}`);
    const teamCId = Number(mkC.json["id"] ?? (mkC.json["team"] as Record<string, unknown> | undefined)?.["id"]);
    const invC = await req("POST", "/api/invitations", owner, { relationship: "club_member", clubId: teamOrgId, teamId: teamCId });
    assert(invC.status === 201, `uitnodiging C: ${invC.status}`);
    await db.delete(clubTeamsTable).where(eq(clubTeamsTable.id, teamCId));
    const spook = `dev_${RUN}_spook`;
    await ensureAccount(spook, `${spook}@sparki.test`, "Fixture spook", silentLogger);
    const accC = await req("POST", `/api/invitations/${invC.json["token"]}/accept`, spook);
    assert(accC.status === 409, `accept op verdwenen selectie: ${accC.status}, verwacht 409`);
    const lid = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, teamOrgId), eq(clubMembersTable.clerkId, spook), isNull(clubMembersTable.endedAt)));
    assert(lid.length === 0, "accept rolde niet terug: spook werd toch organisatielid");

    // Volle selectie (maxSize=1): accept overschrijdt de capaciteit nooit.
    const mkD = await req("POST", `/api/clubs/${teamOrgId}/teams`, owner, { name: `Vol ${RUN}`, maxSize: 1 });
    assert(mkD.status === 201, `selectie D: ${mkD.status}`);
    const teamDId = Number(mkD.json["id"] ?? (mkD.json["team"] as Record<string, unknown> | undefined)?.["id"]);
    const vulling = await req("POST", `/api/clubs/${teamOrgId}/teams/${teamDId}/members`, owner, { clerkId: renner });
    assert([200, 201].includes(vulling.status), `vulling team D: ${vulling.status}`);
    const invD = await req("POST", "/api/invitations", owner, { relationship: "club_member", clubId: teamOrgId, teamId: teamDId });
    assert(invD.status === 201, `uitnodiging D: ${invD.status}`);
    const accD = await req("POST", `/api/invitations/${invD.json["token"]}/accept`, spook);
    assert(accD.status === 409, `accept op volle selectie: ${accD.status}, verwacht 409`);
    const bezD = await db
      .select()
      .from(clubTeamMembersTable)
      .where(and(eq(clubTeamMembersTable.teamId, teamDId), isNull(clubTeamMembersTable.endedAt)));
    assert(bezD.length === 1, `volle selectie kreeg er toch iemand bij (${bezD.length})`);
  });

  // ── Opruimen ──────────────────────────────────────────────────────────────
  for (const id of cleanupIds) {
    await db.delete(clubsTable).where(eq(clubsTable.id, id));
  }

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
