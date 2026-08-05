// Besluitenpatch 2026-08-01 (hoofdstuk B) — teammanager-overrule bij
// wedstrijdselecties.
//
// Bewijst via de echte Express-app:
//   1. Ploegleider zet een selectie (renner) — selectedByRole wordt vastgelegd.
//   2. Teammanager wijzigt die selectie → overrule: overruledAt gezet, audit
//      "selectie_overruled", ploegleider krijgt een bericht mét diff.
//   3. Ploegleider probeert de overrule terug te draaien → 403, rij ongewijzigd.
//   4. Teammanager (of beheer) kan de rij daarna nog wél wijzigen.
//
// Run: pnpm --filter @workspace/api-server run test:club-selection-overrule

import type { Server } from "node:http";
import {
  db,
  clubsTable,
  clubMembersTable,
  clubRaceEventsTable,
  clubRaceSelectionsTable,
  clubAuditLogTable,
  notificationsTable,
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

const T = "ovr";
const OWNER = `test-${T}-owner`;
const PLOEGLEIDER = `test-${T}-ploegleider`;
const TEAMMANAGER = `test-${T}-teammanager`;
const RENNER = `test-${T}-renner`;
// CLUB_AFRONDING_01 C4: vervanger op deputyClerkId met een ANDERE clubrol.
const DEPUTY = `test-${T}-deputy`;
const ALL = [OWNER, PLOEGLEIDER, TEAMMANAGER, RENNER, DEPUTY];

let server: Server;
let base: string;
let clubId = 0;
let eventId = 0;

async function api(clerkId: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": clerkId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* leeg */
  }
  return { status: res.status, json: json as Record<string, unknown> | null };
}

async function cleanup() {
  const clubs = await db
    .select({ id: clubsTable.id })
    .from(clubsTable)
    .where(like(clubsTable.name, `TESTCLUB-${T}%`));
  for (const c of clubs) {
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
    .values({ name: `TESTCLUB-${T}`, ownerClerkId: OWNER, status: "actief" })
    .returning();
  clubId = club!.id;
  await db.insert(clubMembersTable).values([
    { clubId, clerkId: OWNER, role: "owner" },
    { clubId, clerkId: PLOEGLEIDER, role: "ploegleider" },
    { clubId, clerkId: TEAMMANAGER, role: "teammanager" },
    { clubId, clerkId: RENNER, role: "member" },
    { clubId, clerkId: DEPUTY, role: "mechanieker" },
  ]);
  const [event] = await db
    .insert(clubRaceEventsTable)
    .values({
      clubId,
      name: `TESTRACE-${T}`,
      raceDate: "2026-09-01",
      createdByClerkId: OWNER,
      deputyClerkId: DEPUTY,
    })
    .returning();
  eventId = event!.id;
}

async function selection() {
  const [row] = await db
    .select()
    .from(clubRaceSelectionsTable)
    .where(
      and(
        eq(clubRaceSelectionsTable.eventId, eventId),
        eq(clubRaceSelectionsTable.clerkId, RENNER),
      ),
    );
  return row ?? null;
}

async function main() {
  await cleanup();
  await seed();
  server = app.listen(0);
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;

  await scenario("ploegleider zet selectie: selectedByRole vastgelegd, geen overrule", async () => {
    const r = await api(PLOEGLEIDER, "POST", `/api/clubs/${clubId}/races/${eventId}/selection`, {
      clerkId: RENNER,
      role: "renner",
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}: ${JSON.stringify(r.json)}`);
    const row = await selection();
    assert(row?.selectedByRole === "ploegleider", "selectedByRole = ploegleider");
    assert(row?.overruledAt == null, "geen overrule bij eerste besluit");
  });

  await scenario("teammanager wijzigt ploegleiderbesluit: overrule + audit + diff-bericht", async () => {
    const r = await api(TEAMMANAGER, "POST", `/api/clubs/${clubId}/races/${eventId}/selection`, {
      clerkId: RENNER,
      role: "reserve",
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    const row = await selection();
    assert(row?.role === "reserve", "rol gewijzigd naar reserve");
    assert(row?.overruledAt != null, "overruledAt gezet");
    assert(row?.overruledByClerkId === TEAMMANAGER, "overruledBy = teammanager");
    const audits = await db
      .select()
      .from(clubAuditLogTable)
      .where(
        and(
          eq(clubAuditLogTable.clubId, clubId),
          eq(clubAuditLogTable.action, "selectie_overruled"),
        ),
      );
    assert(audits.length === 1, `verwacht 1 overrule-audit, kreeg ${audits.length}`);
    const msgs = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.clerkId, PLOEGLEIDER),
          like(notificationsTable.dedupeKey, "selectie-overrule:%"),
        ),
      );
    assert(msgs.length === 1, `verwacht 1 diff-bericht aan ploegleider, kreeg ${msgs.length}`);
    assert(
      String(msgs[0]!.body).includes("renner") && String(msgs[0]!.body).includes("reserve"),
      "bericht bevat de diff (van renner naar reserve)",
    );
  });

  await scenario("ploegleider kan de overrule NIET terugdraaien (403, rij ongewijzigd)", async () => {
    const r = await api(PLOEGLEIDER, "POST", `/api/clubs/${clubId}/races/${eventId}/selection`, {
      clerkId: RENNER,
      role: "renner",
    });
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
    const row = await selection();
    assert(row?.role === "reserve", "rol blijft reserve");
  });

  await scenario("C4: vervanger (deputyClerkId, andere clubrol) kan de overrule NIET terugdraaien", async () => {
    const r = await api(DEPUTY, "POST", `/api/clubs/${clubId}/races/${eventId}/selection`, {
      clerkId: RENNER,
      role: "renner",
    });
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}: ${JSON.stringify(r.json)}`);
    const row = await selection();
    assert(row?.role === "reserve", "rol blijft reserve — overrule intact");
  });

  await scenario("teammanager kan daarna nog wél wijzigen", async () => {
    const r = await api(TEAMMANAGER, "POST", `/api/clubs/${clubId}/races/${eventId}/selection`, {
      clerkId: RENNER,
      role: "renner",
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    const row = await selection();
    assert(row?.role === "renner", "teammanager-wijziging doorgevoerd");
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
