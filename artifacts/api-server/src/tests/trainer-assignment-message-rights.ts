// Assignment-only trainer ↔ berichten — server-side rechtenbewijs (besluit
// René 30-07-2026, aanvullende opdracht §1).
//
// Gemeld risico: een trainer die UITSLUITEND via een club-/sportertoewijzing
// toegang heeft, zou individuele berichten kunnen schrijven. Gewenst gedrag:
// assignment-only geeft alleen de expliciete lees-/begeleidingsrechten;
// berichten (en alle andere individuele schrijfacties) vereisen een DIRECTE
// geaccepteerde coach-sporterlink. Dit bewijs gaat langs de UI heen en vuurt
// de endpoints direct aan (API-manipulatie), precies zoals de opdracht eist.
//
// Dit test boot de ECHTE Express-app en seedt:
//   • trainer D — DIRECTE geaccepteerde link met sporter A (positieve controle)
//   • trainer T — ALLEEN een clubtoewijzing (club + team + toewijzing + sporter
//     als actief team- én clublid) — géén directe link
//   • sporter A — actief clublid + teamlid
//
// Bewezen wordt:
//   1. de toewijzing is ECHT (clubAssignedAthleteIds bevat A en het dashboard
//      toont A) — zodat de weigeringen hieronder nooit vals kunnen slagen
//      doordat de seeding stilletjes faalde;
//   2. trainer T krijgt 403 op GET én POST /api/coach/athletes/A/messages en
//      er wordt GEEN berichtenrij geschreven;
//   3. trainer T krijgt 403 op de overige individuele schrijfacties
//      (context-items, training aanmaken, plan adopteren);
//   4. trainer D (directe link) kan WEL een bericht sturen (201, rij bestaat);
//   5. sporter A kan NIET antwoorden richting trainer T (geen link → 403).
//
// Run: pnpm --filter @workspace/api-server run test:trainer-assignment-messages
// Vereist: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  userProfilesTable,
  coachAthleteLinksTable,
  coachMessagesTable,
  clubsTable,
  clubMembersTable,
  clubTeamsTable,
  clubTeamMembersTable,
  clubTrainerAssignmentsTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import app from "../app";
import { clubAssignedAthleteIds } from "../lib/sharing";

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
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Server boot ──────────────────────────────────────────────────────────────
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

async function call(
  actor: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": actor,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: Record<string, unknown> | null = null;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const RUN = `test_tamsg_${Date.now()}`;
const trainerAssign = `${RUN}_trainer_assign`; // alleen toewijzing
const trainerDirect = `${RUN}_trainer_direct`; // directe link
const athlete = `${RUN}_athlete`;
const clubOwner = `${RUN}_clubowner`;
let clubId = 0;
let teamId = 0;

async function seed() {
  for (const [clerkId, roles, activeRole] of [
    [trainerAssign, ["coach"], "coach"],
    [trainerDirect, ["coach"], "coach"],
    [athlete, ["athlete"], "athlete"],
    [clubOwner, ["athlete"], "athlete"],
  ] as const) {
    await db.insert(userProfilesTable).values({
      clerkId,
      email: `${clerkId}@test.invalid`,
      displayName: clerkId,
      roles: [...roles],
      activeRole,
      releaseGroup: "test",
    });
  }
  const [club] = await db
    .insert(clubsTable)
    .values({
      name: `TEST ${RUN} club`,
      ownerClerkId: clubOwner,
      joinCode: RUN.slice(-8),
      releaseGroup: "test",
    })
    .returning({ id: clubsTable.id });
  clubId = club!.id;
  const [team] = await db
    .insert(clubTeamsTable)
    .values({ clubId, name: `TEST ${RUN} team` })
    .returning({ id: clubTeamsTable.id });
  teamId = team!.id;
  // Actieve lidmaatschappen: trainer (rol trainer) en sporter (rol member).
  await db.insert(clubMembersTable).values([
    { clubId, clerkId: trainerAssign, role: "trainer" },
    { clubId, clerkId: athlete, role: "member" },
  ]);
  await db
    .insert(clubTeamMembersTable)
    .values({ teamId, clerkId: athlete, role: "renner" });
  await db
    .insert(clubTrainerAssignmentsTable)
    .values({ clubId, trainerClerkId: trainerAssign, teamId });
  // Directe geaccepteerde link voor de positieve controle.
  await db.insert(coachAthleteLinksTable).values({
    coachClerkId: trainerDirect,
    athleteClerkId: athlete,
    status: "accepted",
  });
}

async function cleanup() {
  await db
    .delete(coachMessagesTable)
    .where(eq(coachMessagesTable.athleteClerkId, athlete));
  await db
    .delete(clubTrainerAssignmentsTable)
    .where(eq(clubTrainerAssignmentsTable.clubId, clubId));
  await db
    .delete(clubTeamMembersTable)
    .where(eq(clubTeamMembersTable.teamId, teamId));
  await db.delete(clubTeamsTable).where(eq(clubTeamsTable.clubId, clubId));
  await db.delete(clubMembersTable).where(eq(clubMembersTable.clubId, clubId));
  await db.delete(clubsTable).where(eq(clubsTable.id, clubId));
  await db
    .delete(coachAthleteLinksTable)
    .where(eq(coachAthleteLinksTable.athleteClerkId, athlete));
  await db
    .delete(userProfilesTable)
    .where(
      inArray(userProfilesTable.clerkId, [
        trainerAssign,
        trainerDirect,
        athlete,
        clubOwner,
      ]),
    );
}

async function messageRowCount(coachId: string): Promise<number> {
  const rows = await db
    .select({ id: coachMessagesTable.id })
    .from(coachMessagesTable)
    .where(
      and(
        eq(coachMessagesTable.coachClerkId, coachId),
        eq(coachMessagesTable.athleteClerkId, athlete),
      ),
    );
  return rows.length;
}

async function main() {
  await seed();
  await startServer();
  try {
    // 1. Positieve controle op de seeding zelf: de toewijzing is echt.
    await scenario("toewijzing is echt: clubAssignedAthleteIds bevat sporter", async () => {
      const ids = await clubAssignedAthleteIds(trainerAssign);
      assert(ids.includes(athlete), `verwachtte ${athlete} in [${ids.join(",")}]`);
    });
    await scenario("toewijzing is echt: dashboard toont sporter (tier-2 zichtbaarheid)", async () => {
      const r = await call(trainerAssign, "GET", "/api/coach/dashboard");
      assert(r.status === 200, `dashboard status ${r.status}`);
      const athletes = (r.json?.athletes ?? []) as { athleteClerkId?: string; clerkId?: string }[];
      assert(
        athletes.some((a) => a.athleteClerkId === athlete || a.clerkId === athlete),
        "sporter ontbreekt in dashboard van toegewezen trainer",
      );
    });

    // 2. Berichten: assignment-only → 403, geen rij.
    await scenario("assignment-only: GET berichten → 403", async () => {
      const r = await call(trainerAssign, "GET", `/api/coach/athletes/${athlete}/messages`);
      assert(r.status === 403, `verwachtte 403, kreeg ${r.status}`);
    });
    await scenario("assignment-only: POST bericht → 403 en NUL rijen geschreven", async () => {
      const r = await call(trainerAssign, "POST", `/api/coach/athletes/${athlete}/messages`, {
        body: "poging tot bericht zonder directe link",
      });
      assert(r.status === 403, `verwachtte 403, kreeg ${r.status}`);
      assert((await messageRowCount(trainerAssign)) === 0, "berichtenrij is tóch geschreven");
    });

    // 3. Overige individuele schrijfacties: ook dicht.
    await scenario("assignment-only: POST context-item → 403", async () => {
      const r = await call(trainerAssign, "POST", `/api/coach/athletes/${athlete}/context-items`, {
        kind: "instructie",
        body: "poging tot context-item zonder directe link",
      });
      assert(r.status === 403, `verwachtte 403, kreeg ${r.status}`);
    });
    await scenario("assignment-only: POST training aanmaken → 403", async () => {
      const r = await call(trainerAssign, "POST", `/api/coach/athletes/${athlete}/workouts`, {
        scheduledDate: "2026-08-01",
        title: "poging tot training zonder directe link",
      });
      assert(r.status === 403, `verwachtte 403, kreeg ${r.status}`);
    });
    await scenario("assignment-only: POST plan adopteren → 403", async () => {
      // planDayIds meesturen: de route valideert de body vóór de autorisatie,
      // dus alleen met een geldige body bewijst de 403 de rechtenpoort zelf.
      const r = await call(trainerAssign, "POST", `/api/coach/athletes/${athlete}/plan/adopt`, {
        planDayIds: [999999],
      });
      assert(r.status === 403, `verwachtte 403, kreeg ${r.status}`);
    });

    // 4. Positieve controle: directe link mag WEL berichten.
    await scenario("directe link: POST bericht → 201 en rij bestaat", async () => {
      const r = await call(trainerDirect, "POST", `/api/coach/athletes/${athlete}/messages`, {
        body: "bericht met directe link",
      });
      assert(r.status === 201, `verwachtte 201, kreeg ${r.status}: ${JSON.stringify(r.json)}`);
      assert((await messageRowCount(trainerDirect)) === 1, "berichtenrij ontbreekt");
    });

    // 5. Sporter kan niet 'antwoorden' richting een niet-gekoppelde trainer.
    await scenario("sporter: reply naar assignment-only trainer → 403", async () => {
      const r = await call(athlete, "POST", "/api/coach/messages/reply", {
        coachClerkId: trainerAssign,
        body: "poging tot antwoord",
      });
      assert(r.status === 403, `verwachtte 403, kreeg ${r.status}`);
      assert((await messageRowCount(trainerAssign)) === 0, "reply-rij is tóch geschreven");
    });
  } finally {
    await stopServer();
    await cleanup();
  }

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
