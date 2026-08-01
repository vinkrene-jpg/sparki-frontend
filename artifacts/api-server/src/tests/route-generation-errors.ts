// F-P1-04 (SPARKI_AUDIT_RECOVERY_AND_COMPLETION_01) — routegeneratie-jobs:
// elke gestarte job eindigt in succes of een EXPLICIETE fout; nooit stil hangen.
//
// Scenario's:
//   1. Ongeldige aanvraag → job eindigt met expliciete foutstatus (4xx) + eerlijke fouttekst.
//   2. Onbekend job-id → 404 (niet eeuwig "bezig").
//   3. Andermans job → 404 (ownership).
//   4. finishJob is idempotent: eerste einduitslag telt, tweede aanroep verandert niets.
//   5. Crashende handler-belofte → job eindigt 502 met eerlijke fouttekst (patroon uit routes.ts).
//
// Run: `pnpm --filter @workspace/api-server run test:route-generation-errors`
// Vereist DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import { db, userProfilesTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  createRouteGenerationJob,
  finishJob,
  getRouteGenerationJob,
} from "../lib/route-generation-jobs";

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

const USER_A = "user_e2e_routegenjobs_a";
const USER_B = "user_e2e_routegenjobs_b";

function head(user: string) {
  return {
    "content-type": "application/json",
    "x-dev-clerk-id": user,
  };
}

async function main() {
  // Beide testgebruikers moeten echt bestaan: de dev-bypass negeert een
  // x-dev-clerk-id zonder profielrij en valt dan terug op de standaard
  // dev-gebruiker (waardoor A en B stiekem dezelfde zouden zijn).
  await ensureAccount(USER_A, `${USER_A}@e2e.sparki.test`, "RouteGenJobs A", silentLogger);
  await ensureAccount(USER_B, `${USER_B}@e2e.sparki.test`, "RouteGenJobs B", silentLogger);

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else reject(new Error("geen poort"));
    });
  });

  await scenario("1. ongeldige aanvraag eindigt in expliciete fout", async () => {
    const start = await fetch(`${baseUrl}/api/routes/generate/start`, {
      method: "POST",
      headers: head(USER_A),
      body: JSON.stringify({ onzin: true }),
    });
    assert(start.status === 202, `start hoort 202 te zijn, was ${start.status}`);
    const { jobId } = (await start.json()) as { jobId: string };
    assert(typeof jobId === "string" && jobId.length > 0, "geen jobId");

    type PollUitslag = { done: boolean; status?: number; body?: { error?: string } };
    let laatste: PollUitslag | null = null;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const poll = await fetch(`${baseUrl}/api/routes/generate-jobs/${jobId}`, {
        headers: head(USER_A),
      });
      assert(poll.status === 200, `poll hoort 200, was ${poll.status}`);
      laatste = (await poll.json()) as PollUitslag;
      if (laatste?.done) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert(laatste?.done, "job bleef hangen: nooit done binnen 30s");
    assert(
      typeof laatste!.status === "number" && laatste!.status! >= 400,
      `verwachtte expliciete foutstatus, kreeg ${laatste!.status}`,
    );
    const err = (laatste!.body as { error?: string } | null)?.error;
    assert(typeof err === "string" && err.length > 0, "foutbody zonder eerlijke fouttekst");
  });

  await scenario("2. onbekend job-id = 404, niet eeuwig bezig", async () => {
    const r = await fetch(`${baseUrl}/api/routes/generate-jobs/rgj_bestaatniet`, {
      headers: head(USER_A),
    });
    assert(r.status === 404, `verwachtte 404, kreeg ${r.status}`);
  });

  await scenario("3. andermans job = 404 (ownership)", async () => {
    const start = await fetch(`${baseUrl}/api/routes/generate/start`, {
      method: "POST",
      headers: head(USER_A),
      body: JSON.stringify({}),
    });
    const { jobId } = (await start.json()) as { jobId: string };
    const alsB = await fetch(`${baseUrl}/api/routes/generate-jobs/${jobId}`, {
      headers: head(USER_B),
    });
    assert(alsB.status === 404, `verwachtte 404 voor andermans job, kreeg ${alsB.status}`);
  });

  await scenario("4. finishJob idempotent — eerste uitslag telt", () => {
    const job = createRouteGenerationJob(USER_A);
    finishJob(job, 422, { error: "eerste" });
    finishJob(job, 200, { ok: true });
    const terug = getRouteGenerationJob(job.id, USER_A);
    assert(terug?.done === true, "job niet done");
    assert(terug?.status === 422, `status veranderd: ${terug?.status}`);
    assert((terug?.body as { error?: string })?.error === "eerste", "body veranderd");
  });

  await scenario("5. crashende handler → job eindigt 502 (nooit stil)", async () => {
    // Zelfde vangnetpatroon als startGenerationJob in routes.ts.
    const job = createRouteGenerationJob(USER_A);
    await Promise.resolve(
      (async () => {
        throw new Error("gesimuleerde crash");
      })(),
    ).catch(() => {
      if (!job.done) finishJob(job, 502, { error: "Routegeneratie mislukt door een serverfout. Probeer het opnieuw." });
    });
    const terug = getRouteGenerationJob(job.id, USER_A);
    assert(terug?.done === true && terug.status === 502, "crash eindigde niet in expliciete 502");
  });

  server?.close();

  let fails = 0;
  for (const r of results) {
    if (r.status === "fail") fails += 1;
    console.log(`[${r.status === "pass" ? "OK" : "FOUT"}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\nroute-generation-errors: ${results.length - fails}/${results.length} OK`);
  process.exit(fails > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
