// Wizard-voorstel eerlijkheid — GET /api/races/wizard-proposal.
//
// Taak: als het ervaringsniveau van de atleet onbekend is (geen athlete
// profile), mag stap 4 van de wedstrijd-wizard niet doen alsof het niveau
// bekend is. Het contract:
//   - goal blijft null (UI toont "Onvoldoende data");
//   - de basis-string benoemt het gat expliciet: "ervaring onbekend";
//   - de prioriteits-confidence is verlaagd en blijft < 0.5.
// Met een bekend ervaringsniveau verschijnt "ervaring: <niveau>" in de basis
// en wordt de confidence NIET verlaagd.
//
// Boots de echte Express-app, seedt een dev-gebruiker, verwijdert diens
// athlete profile en bevraagt het endpoint via de dev-bypass header.
//
// Run: `pnpm --filter @workspace/api-server run test:race-wizard-proposal`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  pool,
  athleteProfilesTable,
  racesTable,
  userProfilesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
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

const RUN = `test_wizprop_${Date.now()}`;
const userId = `${RUN}_user`;

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

async function fetchProposal(): Promise<{ status: number; body: Proposal }> {
  // Datum ver vooruit + korte afstand ⇒ deterministische C-prioriteitstak.
  const res = await fetch(
    `${baseUrl}/api/races/wizard-proposal?raceDate=2027-06-12&discipline=criterium&distanceKm=45`,
    { headers: { "x-dev-clerk-id": userId } },
  );
  return { status: res.status, body: (await res.json()) as Proposal };
}

async function cleanup() {
  await db.delete(racesTable).where(eq(racesTable.clerkId, userId));
  await db
    .delete(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, userId));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, userId));
}

async function main() {
  await startServer();
  await ensureAccount(userId, `${userId}@example.test`, "Wizard", silentLogger);
  // "Geen athlete profile" is het te testen scenario — verwijder de door
  // ensureAccount aangemaakte rij.
  await db
    .delete(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, userId));

  await scenario(
    "zonder athlete profile: confidence < 0.5, goal null, basis benoemt 'ervaring onbekend'",
    async () => {
      const { status, body } = await fetchProposal();
      assert(status === 200, `expected 200, got ${status}`);
      assert(body.goal === null, `goal must be null, got ${JSON.stringify(body.goal)}`);
      assert(
        body.priority.confidence < 0.5,
        `priority confidence must be < 0.5 without a profile, got ${body.priority.confidence}`,
      );
      assert(
        body.basis.includes("ervaring onbekend"),
        `basis must state 'ervaring onbekend', got: ${body.basis}`,
      );
      assert(
        !body.basis.includes("ervaring:"),
        `basis must not claim a known level, got: ${body.basis}`,
      );
    },
  );

  await scenario(
    "met bekend ervaringsniveau: geen verlaging, basis toont niveau",
    async () => {
      await db.insert(athleteProfilesTable).values({
        clerkId: userId,
        experienceLevel: "intermediate",
      });
      const { status, body } = await fetchProposal();
      assert(status === 200, `expected 200, got ${status}`);
      assert(
        body.basis.includes("ervaring: intermediate"),
        `basis must state the known level, got: ${body.basis}`,
      );
      assert(
        !body.basis.includes("ervaring onbekend"),
        `basis must not carry the unknown marker, got: ${body.basis}`,
      );
      // Zelfde tak (C, 0.55) zonder verlaging.
      assert(
        body.priority.confidence >= 0.5,
        `confidence must not be lowered with a known level, got ${body.priority.confidence}`,
      );
      assert(body.goal !== null, "goal must be proposed for a known level");
    },
  );
}

async function shutdown(code: number) {
  await stopServer().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    await cleanup().catch(() => {});
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== wizard-proposal eerlijkheid — test results ===");
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await shutdown(1);
  });
