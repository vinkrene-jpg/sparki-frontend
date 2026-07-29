// WP-02 — Hoofdtraineruitbreiding.
//
// Boot de ECHTE Express-app op de governor-fixtures en toets:
//  H1. hoofdtrainer verdeelt sporters over teams (teamindeling) — trainer niet;
//  H2. hoofdtrainer verdeelt sporters over groepen — trainer zonder groepsband niet;
//  H3. hoofdtraineroverzicht: 200 voor hoofdtrainer/beheer, 403 voor trainer;
//  H4. overzicht bevat GEEN gezondheids-/herstel-/privévelden;
//  H5. hoofdtrainer wijzigt andermans clubtraining → audittrail met
//      eigenTraining:false + trainerVanTraining + velden (geen stil overschrijven);
//  H6. buitenstaander (geen clublid) krijgt nergens toegang.
//
// Run: node ./scripts/run-test.mjs hoofdtrainer-workspace

import type { Server } from "node:http";
import { and, eq, desc } from "drizzle-orm";
import {
  db,
  clubsTable,
  clubMembersTable,
  clubTeamsTable,
  clubGroupsTable,
  clubTeamMembersTable,
  clubGroupMembersTable,
  clubTrainingsTable,
  clubAuditLogTable,
} from "@workspace/db";
import app from "../app";
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
  const hoofd = clerkIdFor("hoofdtrainer");
  const t1 = clerkIdFor("trainer-1");
  const outsider = clerkIdFor("outsider");
  const adult = clerkIdFor("athlete-adult");
  const beheer = clerkIdFor("clubbeheerder");

  // Fixture-club + teams/groepen opzoeken.
  const [club] = await db
    .select()
    .from(clubsTable)
    .where(eq(clubsTable.ownerClerkId, beheer))
    .orderBy(desc(clubsTable.id))
    .limit(1);
  if (!club) throw new Error("fixture-club niet gevonden");
  const clubId = club.id;
  const teams = await db.select().from(clubTeamsTable).where(eq(clubTeamsTable.clubId, clubId));
  const team = teams[0];
  if (!team) throw new Error("fixture-team niet gevonden");

  let trainingId = 0;
  let groupId = 0;
  try {
    await scenario("H1. hoofdtrainer mag teamindeling wijzigen; gewone trainer niet", async () => {
      const denied = await req("POST", `/api/clubs/${clubId}/teams/${team.id}/members`, t1, { clerkId: adult });
      assert(denied.status === 403, `trainer kreeg ${denied.status} (verwacht 403)`);
      const ok = await req("POST", `/api/clubs/${clubId}/teams/${team.id}/members`, hoofd, { clerkId: adult });
      assert(ok.status === 201, `hoofdtrainer kreeg ${ok.status} (verwacht 201)`);
    });

    await scenario("H2. hoofdtrainer mag groepsindeling wijzigen; trainer zonder groepsband niet", async () => {
      const [group] = await db
        .insert(clubGroupsTable)
        .values({ clubId, name: "TESTFIXTURE WP02-groep" })
        .returning();
      groupId = group.id;
      const denied = await req("POST", `/api/clubs/${clubId}/groups/${groupId}/members`, t1, { clerkId: adult });
      assert(denied.status === 403, `trainer kreeg ${denied.status} (verwacht 403)`);
      const ok = await req("POST", `/api/clubs/${clubId}/groups/${groupId}/members`, hoofd, { clerkId: adult });
      assert(ok.status === 201, `hoofdtrainer kreeg ${ok.status} (verwacht 201)`);
    });

    await scenario("H3. hoofdtraineroverzicht: hoofdtrainer+beheer 200, trainer 403", async () => {
      const okH = await req("GET", `/api/clubs/${clubId}/hoofdtrainer/overview`, hoofd);
      assert(okH.status === 200, `hoofdtrainer kreeg ${okH.status}`);
      const okB = await req("GET", `/api/clubs/${clubId}/hoofdtrainer/overview`, beheer);
      assert(okB.status === 200, `beheer kreeg ${okB.status}`);
      const denied = await req("GET", `/api/clubs/${clubId}/hoofdtrainer/overview`, t1);
      assert(denied.status === 403, `trainer kreeg ${denied.status} (verwacht 403)`);
    });

    await scenario("H4. overzicht bevat geen gezondheids-/herstel-/privévelden", async () => {
      const r = await req("GET", `/api/clubs/${clubId}/hoofdtrainer/overview`, hoofd);
      const body = JSON.stringify(r.json).toLowerCase();
      for (const banned of ["hartslag", "hrv", "readiness", "herstel", "gezondheid", "medisch", "gewicht", "ftp", "privénotitie", "privenotitie", "note"]) {
        assert(!body.includes(banned), `overzicht lekt veld met "${banned}"`);
      }
      const trainers = (r.json as { trainers?: Array<{ clerkId: string }> }).trainers ?? [];
      assert(trainers.some((t) => t.clerkId === t1), "trainer-1 ontbreekt in overzicht");
    });

    await scenario("H5. andermans training wijzigen → audittrail met eigenaar + velden", async () => {
      const [training] = await db
        .insert(clubTrainingsTable)
        .values({
          clubId,
          title: "TESTFIXTURE WP02 training",
          trainingDate: "2026-08-05",
          trainerClerkId: t1,
          createdByClerkId: t1,
          status: "gepland",
        })
        .returning();
      trainingId = training.id;
      const r = await req("PUT", `/api/clubs/${clubId}/trainings/${trainingId}`, hoofd, {
        title: "TESTFIXTURE WP02 training (bijgesteld)",
        notes: "Hoofdtrainer-bijstelling",
      });
      assert(r.status === 200, `wijzigen gaf ${r.status}`);
      const [audit] = await db
        .select()
        .from(clubAuditLogTable)
        .where(
          and(
            eq(clubAuditLogTable.clubId, clubId),
            eq(clubAuditLogTable.actorClerkId, hoofd),
            eq(clubAuditLogTable.action, "training_gewijzigd"),
          ),
        )
        .orderBy(desc(clubAuditLogTable.id))
        .limit(1);
      assert(audit, "geen auditregel geschreven");
      const detail = (audit.detail ?? {}) as Record<string, unknown>;
      assert(detail.eigenTraining === false, "audit markeert niet dat het andermans training was");
      assert(detail.trainerVanTraining === t1, "audit mist de trainer van de training");
      assert(Array.isArray(detail.velden) && (detail.velden as string[]).includes("title"), "audit mist de gewijzigde velden");
    });

    await scenario("H6. buitenstaander krijgt nergens toegang", async () => {
      for (const [method, path] of [
        ["GET", `/api/clubs/${clubId}/hoofdtrainer/overview`],
        ["POST", `/api/clubs/${clubId}/teams/${team.id}/members`],
      ] as const) {
        const r = await req(method, path, outsider, method === "POST" ? { clerkId: adult } : undefined);
        assert(r.status === 403 || r.status === 404, `${method} ${path}: outsider kreeg ${r.status}`);
      }
    });
  } finally {
    // Opruimen van testrestanten vóór fixture-verwijdering.
    if (trainingId) await db.delete(clubTrainingsTable).where(eq(clubTrainingsTable.id, trainingId));
    if (groupId) {
      await db.delete(clubGroupMembersTable).where(eq(clubGroupMembersTable.groupId, groupId));
      await db.delete(clubGroupsTable).where(eq(clubGroupsTable.id, groupId));
    }
    await db
      .delete(clubTeamMembersTable)
      .where(and(eq(clubTeamMembersTable.teamId, team.id), eq(clubTeamMembersTable.clerkId, adult)));
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
