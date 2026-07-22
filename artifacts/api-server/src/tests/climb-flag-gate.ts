// Klimmenverkenner — flag-gate regressietest.
//
// Regressie: de backend-gate (requireClimbFlag) moet dezelfde precedence
// gebruiken als GET /api/flags — inclusief head-tester early access. Zonder
// die fix toonde de UI de Klimmenverkenner terwijl /api/climbs/* 403 gaf.
//
// Scenario's (flag climb_explorer tijdens de test niet-globaal, geen rollen):
//   a. gewone gebruiker zonder flag → 403
//   b. gewone gebruiker met override enabled=true → gate passeert (400 op
//      ontbrekende zoekterm, géén 403; geen netwerkcall)
//   c. head-tester zonder override → gate passeert (400, géén 403)
//
// Run: `pnpm --filter @workspace/api-server run test:climb-flag-gate`
// Vereist DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  userProfilesTable,
  featureFlagsTable,
  userFlagOverridesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
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
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
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

const RUN = `test_climbflag_${Date.now()}`;
const clerkPlain = `${RUN}_plain`;
const clerkOverride = `${RUN}_override`;
const clerkHead = `${RUN}_head`;

async function req(path: string, actor: string): Promise<number> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { "x-dev-clerk-id": actor },
  });
  return res.status;
}

// Bewaar en herstel de bestaande flag-rij zodat de dev-omgeving niet
// permanent verandert door deze test.
let savedFlag: { enabledGlobally: boolean; enabledRoles: string[] } | null =
  null;
let flagExisted = false;

async function disableFlagGlobally() {
  const [row] = await db
    .select()
    .from(featureFlagsTable)
    .where(eq(featureFlagsTable.key, "climb_explorer"));
  if (row) {
    flagExisted = true;
    savedFlag = {
      enabledGlobally: row.enabledGlobally,
      enabledRoles: row.enabledRoles,
    };
    await db
      .update(featureFlagsTable)
      .set({ enabledGlobally: false, enabledRoles: [] })
      .where(eq(featureFlagsTable.key, "climb_explorer"));
  }
  // Geen rij = resolveFlags geeft sowieso false voor niet-head-testers.
}

async function restoreFlag() {
  if (flagExisted && savedFlag) {
    await db
      .update(featureFlagsTable)
      .set(savedFlag)
      .where(eq(featureFlagsTable.key, "climb_explorer"));
  }
}

async function cleanup() {
  await restoreFlag().catch(() => {});
  for (const c of [clerkPlain, clerkOverride, clerkHead]) {
    await db
      .delete(userFlagOverridesTable)
      .where(eq(userFlagOverridesTable.clerkId, c))
      .catch(() => {});
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, c))
      .catch(() => {});
  }
}

async function main() {
  await startServer();

  await ensureAccount(clerkPlain, `${clerkPlain}@example.test`, "Gewoon", silentLogger);
  await ensureAccount(clerkOverride, `${clerkOverride}@example.test`, "Override", silentLogger);
  await ensureAccount(clerkHead, `${clerkHead}@example.test`, "Hoofdtester", silentLogger);

  await disableFlagGlobally();

  await db.insert(userFlagOverridesTable).values({
    clerkId: clerkOverride,
    flagKey: "climb_explorer",
    enabled: true,
  });
  await db
    .update(userProfilesTable)
    .set({ isHeadTester: true })
    .where(eq(userProfilesTable.clerkId, clerkHead));

  await scenario("gewone gebruiker zonder flag krijgt 403", async () => {
    const status = await req("/api/climbs/search", clerkPlain);
    assert(status === 403, `verwacht 403, kreeg ${status}`);
  });

  await scenario("override enabled=true passeert de gate (400, geen 403)", async () => {
    const status = await req("/api/climbs/search", clerkOverride);
    assert(status === 400, `verwacht 400 (gate open, zoekterm mist), kreeg ${status}`);
  });

  await scenario("head-tester early access passeert de gate (400, geen 403)", async () => {
    const status = await req("/api/climbs/search", clerkHead);
    assert(status === 400, `verwacht 400 (gate open, zoekterm mist), kreeg ${status}`);
  });

  await cleanup();
  await stopServer();

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Testrun crashte:", err);
  await cleanup().catch(() => {});
  await stopServer().catch(() => {});
  process.exit(1);
});
