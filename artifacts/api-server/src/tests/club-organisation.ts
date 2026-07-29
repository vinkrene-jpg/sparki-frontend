// WP-03 — Leden, rollen en toewijzingen (stap 3).
//
//  O1. rolwijziging door beheer → audit met lid/van/naar/reden;
//  O2. trainer kan geen clubrollen wijzigen (403);
//  O3. toewijzing beëindigen → toegang vervalt DIRECT op elk leesmoment
//      (assignedAthleteIds, clubAssignedAthleteIds, hoofdtrainer-overview);
//  O4. beëindigde toewijzing nogmaals beëindigen → 409 (historie blijft staan);
//  O5. ledenlijst met historie alleen voor beheer; beëindigd lid zichtbaar met endedAt;
//  O6. ploegleider/mechanieker kunnen lidmaatschap niet aanpassen.
//
// Run: node ./scripts/run-test.mjs club-organisation

import type { Server } from "node:http";
import { and, eq, desc } from "drizzle-orm";
import {
  db,
  clubsTable,
  clubMembersTable,
  clubTrainerAssignmentsTable,
  clubAuditLogTable,
} from "@workspace/db";
import app from "../app";
import { assignedAthleteIds } from "../lib/club-permissions";
import { clubAssignedAthleteIds } from "../lib/sharing";
import { createFixtures, removeFixtures, clerkIdFor } from "../scripts/governor-role-fixtures";

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
      } else reject(new Error("failed to determine server port"));
    });
  });
}
async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-clerk-id": actor },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function main() {
  await createFixtures();
  await startServer();
  const beheer = clerkIdFor("clubbeheerder");
  const hoofd = clerkIdFor("hoofdtrainer");
  const t1 = clerkIdFor("trainer-1");
  const t2 = clerkIdFor("trainer-2");
  const ploegleider = clerkIdFor("ploegleider");
  const adult = clerkIdFor("athlete-adult");

  const [club] = await db
    .select()
    .from(clubsTable)
    .where(eq(clubsTable.ownerClerkId, beheer))
    .orderBy(desc(clubsTable.id))
    .limit(1);
  if (!club) throw new Error("fixture-club niet gevonden");
  const clubId = club.id;

  const memberRow = async (clerkId: string) => {
    const [m] = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.clerkId, clerkId)))
      .orderBy(desc(clubMembersTable.id))
      .limit(1);
    return m;
  };

  try {
    await scenario("O1. rolwijziging → audit met lid/van/naar/reden", async () => {
      const m2 = await memberRow(t2);
      assert(m2, "trainer-2 lidmaatschap niet gevonden");
      const r = await req("PUT", `/api/clubs/${clubId}/members/${m2.id}/role`, beheer, {
        role: "assistent",
        reason: "WP03-test rolwijziging",
      });
      assert(r.status === 200, `rolwijziging gaf ${r.status}`);
      const [audit] = await db
        .select()
        .from(clubAuditLogTable)
        .where(and(eq(clubAuditLogTable.clubId, clubId), eq(clubAuditLogTable.action, "rol_gewijzigd")))
        .orderBy(desc(clubAuditLogTable.id))
        .limit(1);
      const d = (audit?.detail ?? {}) as Record<string, unknown>;
      assert(d.lid === t2 && d.van === "trainer" && d.naar === "assistent", "audit mist lid/van/naar");
      assert(d.reden === "WP03-test rolwijziging", "audit mist de reden");
      // Terugzetten.
      await req("PUT", `/api/clubs/${clubId}/members/${m2.id}/role`, beheer, { role: "trainer" });
    });

    await scenario("O2. trainer kan geen clubrollen wijzigen", async () => {
      const m2 = await memberRow(t2);
      const r = await req("PUT", `/api/clubs/${clubId}/members/${m2.id}/role`, t1, { role: "member" });
      assert(r.status === 403, `trainer kreeg ${r.status} (verwacht 403)`);
    });

    let assignmentId = 0;
    await scenario("O3. toewijzing beëindigen trekt toegang direct in", async () => {
      const [a] = await db
        .select()
        .from(clubTrainerAssignmentsTable)
        .where(
          and(
            eq(clubTrainerAssignmentsTable.clubId, clubId),
            eq(clubTrainerAssignmentsTable.trainerClerkId, t1),
          ),
        );
      assert(a, "fixture-toewijzing trainer-1 niet gevonden");
      assignmentId = a.id;
      const before = await assignedAthleteIds(clubId, t1);
      assert(before.length > 0, "verwachtte sporters vóór beëindiging");
      const r = await req("POST", `/api/clubs/${clubId}/trainer-assignments/${assignmentId}/end`, hoofd, {
        reason: "WP03-test einde",
      });
      assert(r.status === 200, `beëindigen gaf ${r.status}`);
      const after = await assignedAthleteIds(clubId, t1);
      assert(after.length === 0, "assignedAthleteIds levert nog sporters na beëindiging");
      const viaSharing = await clubAssignedAthleteIds(t1);
      assert(!viaSharing.includes(adult), "clubAssignedAthleteIds levert de sporter nog na beëindiging");
      const ov = await req("GET", `/api/clubs/${clubId}/hoofdtrainer/overview`, hoofd);
      const row = ((ov.json as { trainers?: Array<{ clerkId: string; assignments: unknown[]; assignedAthleteCount: number }> }).trainers ?? []).find((t) => t.clerkId === t1);
      assert(row && row.assignments.length === 0 && row.assignedAthleteCount === 0, "overview toont de beëindigde toewijzing nog");
      // Historie blijft staan (geen DELETE).
      const [still] = await db
        .select()
        .from(clubTrainerAssignmentsTable)
        .where(eq(clubTrainerAssignmentsTable.id, assignmentId));
      assert(still && still.endsOn != null, "toewijzingsrij is verdwenen of zonder einddatum");
    });

    await scenario("O4. nogmaals beëindigen → 409", async () => {
      const r = await req("POST", `/api/clubs/${clubId}/trainer-assignments/${assignmentId}/end`, hoofd);
      assert(r.status === 409, `tweede beëindiging gaf ${r.status} (verwacht 409)`);
    });

    await scenario("O5. historie in ledenlijst alleen voor beheer", async () => {
      const asBeheer = await req("GET", `/api/clubs/${clubId}/members?historie=1`, beheer);
      assert(asBeheer.status === 200, `beheer kreeg ${asBeheer.status}`);
      const asTrainer = await req("GET", `/api/clubs/${clubId}/members?historie=1`, t1);
      if (asTrainer.status === 200) {
        const rows = (asTrainer.json as Array<{ endedAt: string | null }>) ?? [];
        assert(rows.every((m) => !m.endedAt), "trainer ziet beëindigde leden via historie=1");
      }
    });

    // ── Stap 4: seizoenen & selecties ────────────────────────────────────────
    let seasonId = 0;
    await scenario("O7. seizoen aanmaken; tweede actief seizoen → 409", async () => {
      const r1 = await req("POST", `/api/clubs/${clubId}/seasons`, beheer, { name: "2026", startsOn: "2026-01-01" });
      assert(r1.status === 201, `seizoen aanmaken gaf ${r1.status}`);
      seasonId = (r1.json as { id: number }).id;
      const r2 = await req("POST", `/api/clubs/${clubId}/seasons`, beheer, { name: "2027" });
      assert(r2.status === 409, `tweede actieve seizoen gaf ${r2.status} (verwacht 409)`);
      const r3 = await req("POST", `/api/clubs/${clubId}/seasons`, beheer, { name: "2027", status: "gepland" });
      assert(r3.status === 201, `gepland seizoen gaf ${r3.status}`);
    });

    await scenario("O8. trainer kan geen seizoenen beheren", async () => {
      const r = await req("POST", `/api/clubs/${clubId}/seasons`, t1, { name: "X" });
      assert(r.status === 403, `trainer seizoen aanmaken gaf ${r.status}`);
    });

    let selectionTeamId = 0;
    await scenario("O9. selectie onder team; selectie-onder-selectie → 400", async () => {
      const teams = await db
        .select()
        .from((await import("@workspace/db")).clubTeamsTable)
        .where(eq((await import("@workspace/db")).clubTeamsTable.clubId, clubId));
      const root = teams.find((t) => t.parentTeamId == null);
      assert(root, "geen hoofdteam in fixtures");
      const r1 = await req("POST", `/api/clubs/${clubId}/teams`, beheer, {
        name: "WP03 Selectie A",
        parentTeamId: root!.id,
        seasonId,
      });
      assert(r1.status === 201, `selectie aanmaken gaf ${r1.status}`);
      selectionTeamId = (r1.json as { id: number }).id;
      const r2 = await req("POST", `/api/clubs/${clubId}/teams`, beheer, {
        name: "WP03 Sub-sub",
        parentTeamId: selectionTeamId,
      });
      assert(r2.status === 400, `selectie onder selectie gaf ${r2.status} (verwacht 400)`);
      const r3 = await req("POST", `/api/clubs/${clubId}/teams`, beheer, { name: "X", parentTeamId: 999999 });
      assert(r3.status === 400, `vreemd hoofdteam gaf ${r3.status} (verwacht 400)`);
    });

    await scenario("O10. afgesloten seizoen is read-only", async () => {
      const close = await req("POST", `/api/clubs/${clubId}/seasons/${seasonId}/close`, beheer);
      assert(close.status === 200, `afsluiten gaf ${close.status}`);
      const again = await req("POST", `/api/clubs/${clubId}/seasons/${seasonId}/close`, beheer);
      assert(again.status === 409, `tweede keer afsluiten gaf ${again.status}`);
      const edit = await req("PUT", `/api/clubs/${clubId}/teams/${selectionTeamId}`, beheer, { name: "Nieuwe naam" });
      assert(edit.status === 409, `team in afgesloten seizoen wijzigen gaf ${edit.status} (verwacht 409)`);
      const reactivate = await req("POST", `/api/clubs/${clubId}/seasons/${seasonId}/activate`, beheer);
      assert(reactivate.status === 409, `afgesloten seizoen activeren gaf ${reactivate.status} (verwacht 409)`);
    });

    await scenario("O6. ploegleider kan lidmaatschap niet aanpassen", async () => {
      const m2 = await memberRow(t2);
      const role = await req("PUT", `/api/clubs/${clubId}/members/${m2.id}/role`, ploegleider, { role: "member" });
      assert(role.status === 403, `ploegleider rolwijziging gaf ${role.status}`);
      const end = await req("POST", `/api/clubs/${clubId}/members/${m2.id}/end`, ploegleider, {});
      assert(end.status === 403, `ploegleider uitschrijven gaf ${end.status}`);
    });
  } finally {
    await stopServer();
    await removeFixtures();
  }

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} groen`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
