// Race-wizard contract — GET /api/races/wizard-proposal + POST /api/races.
//
// The 5-step race wizard's only intelligence endpoint is wizard-proposal
// (deterministic priority/goal/preparation) and its only persistence path is
// POST /api/races. A regression in either silently breaks the sole new-race
// creation flow. This test boots the REAL Express app and asserts:
//   - proposal priority A for a >100 km race when the athlete has no A-races
//     this season;
//   - proposal priority C when the athlete already has ≥2 A-races this season;
//   - goal stays an HONEST null when experienceLevel is null (never fabricated)
//     and becomes a real proposal once experience is known;
//   - the wizard save (POST /api/races with the accepted proposal) persists a
//     row with the exact priority + goal + logistics the athlete confirmed.
//
// Cleanup removes only the rows/user this test created.
//
// Run: `pnpm --filter @workspace/api-server run test:race-wizard`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script). Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  pool,
  racesTable,
  athleteProfilesTable,
  userProfilesTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void>) {
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

const RUN = `test_racewiz_${Date.now()}`;
const userId = `${RUN}_user`;

// A race well in the future so daysUntil > 0 and the season (=year) is stable.
const nextYear = new Date().getFullYear() + 1;
const RACE_DATE = `${nextYear}-06-15`;

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
      } else {
        reject(new Error("failed to determine server port"));
      }
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

type Proposal = {
  priority: { value: string; rationale: string; confidence: number };
  goal: { text: string; rationale: string } | null;
  preparation: { text: string; rationale: string };
  basis: string;
};

async function fetchProposal(params: Record<string, string>): Promise<{
  status: number;
  body: Proposal;
}> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${baseUrl}/api/races/wizard-proposal?${qs}`, {
    headers: { "x-dev-clerk-id": userId },
  });
  return { status: res.status, body: (await res.json()) as Proposal };
}

async function cleanup() {
  await db.delete(racesTable).where(eq(racesTable.clerkId, userId));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, userId));
}

async function main() {
  await startServer();

  await scenario("dev user can reach the endpoint (precondition)", async () => {
    await ensureAccount(userId, `${userId}@example.test`, "Wizard", silentLogger);
    // Honest-null case needs an athlete without an experience level.
    await db
      .update(athleteProfilesTable)
      .set({ experienceLevel: null })
      .where(eq(athleteProfilesTable.clerkId, userId));
    const { status } = await fetchProposal({ raceDate: RACE_DATE });
    assert(
      status === 200,
      `expected 200 via dev bypass, got ${status} — ensure NODE_ENV!=production and DEV_AUTH_BYPASS=true`,
    );
  });

  await scenario("raceDate is required (400 without it)", async () => {
    const res = await fetch(`${baseUrl}/api/races/wizard-proposal`, {
      headers: { "x-dev-clerk-id": userId },
    });
    assert(res.status === 400, `expected 400 without raceDate, got ${res.status}`);
  });

  await scenario(">100 km + no A-races this season → priority A", async () => {
    const { status, body } = await fetchProposal({
      raceDate: RACE_DATE,
      distanceKm: "120",
      discipline: "Weg",
    });
    assert(status === 200, `expected 200, got ${status}`);
    assert(
      body.priority.value === "A",
      `expected priority A for 120 km with zero A-races, got ${body.priority.value}`,
    );
    assert(
      typeof body.priority.confidence === "number" && body.priority.confidence < 1,
      "priority confidence must be a number below 1 (never fully certain)",
    );
    assert(
      typeof body.priority.rationale === "string" && body.priority.rationale.length > 0,
      "priority must carry a readable rationale",
    );
  });

  await scenario("experienceLevel null → goal is an honest null", async () => {
    const { body } = await fetchProposal({
      raceDate: RACE_DATE,
      distanceKm: "120",
      discipline: "Weg",
    });
    assert(
      body.goal === null,
      `goal must be null when experienceLevel is unknown (never fabricated), got ${JSON.stringify(body.goal)}`,
    );
    // Preparation stays available: it only depends on daysUntil, real data.
    assert(
      typeof body.preparation.text === "string" && body.preparation.text.length > 0,
      "preparation proposal must still exist (depends only on days-until)",
    );
  });

  await scenario("≥2 A-races this season → priority C", async () => {
    await db.insert(racesTable).values([
      { clerkId: userId, name: `${RUN} A1`, raceDate: `${nextYear}-04-05`, priority: "A" },
      { clerkId: userId, name: `${RUN} A2`, raceDate: `${nextYear}-05-10`, priority: "A" },
    ]);
    const { body } = await fetchProposal({
      raceDate: RACE_DATE,
      distanceKm: "120",
      discipline: "Weg",
    });
    assert(
      body.priority.value === "C",
      `expected priority C with 2 existing A-races this season, got ${body.priority.value}`,
    );
  });

  await scenario("known experienceLevel → goal proposal returns", async () => {
    await db
      .update(athleteProfilesTable)
      .set({ experienceLevel: "intermediate" })
      .where(eq(athleteProfilesTable.clerkId, userId));
    const { body } = await fetchProposal({
      raceDate: RACE_DATE,
      distanceKm: "120",
      discipline: "Weg",
    });
    assert(
      body.goal != null && typeof body.goal.text === "string" && body.goal.text.length > 0,
      "expected a concrete goal proposal for a known experience level",
    );
  });

  await scenario("wizard save persists the accepted proposal end-to-end", async () => {
    // Simulate the wizard's step 5 save: the athlete accepted the AI proposal
    // (priority + goal) in step 4; the client POSTs the built RaceInput.
    const { body: proposal } = await fetchProposal({
      raceDate: RACE_DATE,
      distanceKm: "120",
      discipline: "Weg",
    });
    assert(proposal.goal != null, "precondition: goal proposal present");

    const raceName = `${RUN} Wizard-koers`;
    const input = {
      name: raceName,
      raceDate: RACE_DATE,
      startTime: "10:30",
      location: "Gent, Vlaanderen",
      priority: proposal.priority.value,
      discipline: "Weg",
      distanceKm: "120",
      elevationM: 900,
      category: "Amateurs",
      goal: proposal.goal!.text,
      registrationStatus: "ingeschreven",
      notes: `Voorbereiding: ${proposal.preparation.text}`,
      status: "gepland",
      logistics: {
        departureLocation: "Thuis",
        travelDurationMin: 60,
        arrivalBufferMin: 60,
        registrationMin: 20,
        warmupMin: 20,
        callUpMin: 10,
        breakfastBeforeDepartureMin: 90,
      },
    };
    const res = await fetch(`${baseUrl}/api/races`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dev-clerk-id": userId,
      },
      body: JSON.stringify(input),
    });
    assert(res.status === 201, `expected 201 on create, got ${res.status}`);

    // The row must exist in the DB with the exact confirmed priority + goal.
    const [row] = await db
      .select()
      .from(racesTable)
      .where(and(eq(racesTable.clerkId, userId), eq(racesTable.name, raceName)));
    assert(row, "saved race row missing from DB");
    assert(row!.raceDate === RACE_DATE, `raceDate must round-trip, got ${row!.raceDate}`);
    assert(
      row!.priority === proposal.priority.value,
      `priority must equal the accepted proposal (${proposal.priority.value}), got ${row!.priority}`,
    );
    assert(
      row!.goal === proposal.goal!.text,
      `goal must equal the accepted proposal text, got ${JSON.stringify(row!.goal)}`,
    );
    assert(row!.location === "Gent, Vlaanderen", "location must round-trip");
    assert(row!.status === "gepland", "status must be gepland");
    const lg = row!.logistics as Record<string, unknown> | null;
    assert(
      lg != null && lg["warmupMin"] === 20 && lg["departureLocation"] === "Thuis",
      "logistics jsonb must round-trip the wizard fields",
    );
  });

  await scenario("invalid priority in save falls back to B (never garbage)", async () => {
    const raceName = `${RUN} Rare-prio`;
    const res = await fetch(`${baseUrl}/api/races`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-clerk-id": userId },
      body: JSON.stringify({ name: raceName, raceDate: RACE_DATE, priority: "Z" }),
    });
    assert(res.status === 201, `expected 201, got ${res.status}`);
    const [row] = await db
      .select({ priority: racesTable.priority })
      .from(racesTable)
      .where(and(eq(racesTable.clerkId, userId), eq(racesTable.name, raceName)));
    assert(row?.priority === "B", `invalid priority must normalize to B, got ${row?.priority}`);
  });

  await cleanup();
  await stopServer();
  await pool.end();

  // ── Report ─────────────────────────────────────────────────────────────────
  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✅" : "❌";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} scenarios passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("race-wizard test crashed:", err);
  try {
    await cleanup();
    await stopServer();
    await pool.end();
  } catch {
    /* best effort */
  }
  process.exit(1);
});
