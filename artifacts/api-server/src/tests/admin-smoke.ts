// Admin routes smoke test — merge-damage guard.
//
// During task 385, routes/admin.ts on main was corrupted by a manual merge:
// one wrong code block was pasted over ~10 handlers (health/run, health/resolve,
// testers, feedback, failed-imports, data-provenance, data-trust/cleanup). The
// file still parsed, so nothing failed until an admin opened the dashboard.
//
// This test boots the REAL Express app (dev auth bypass) and calls the most
// important admin endpoints, asserting 200 + the expected response SHAPE. If a
// future merge pastes the wrong handler body over one of these routes, the
// shape assertion fails loudly before a merge/publish can ship it.
//
// Requires NODE_ENV=development and DEV_AUTH_BYPASS=true (the dev bypass makes
// the resolved dev user an admin; fails closed in production).
//
// Run: `pnpm --filter @workspace/api-server run test:admin-smoke`
// Exits non-zero on any failure.

import type { Server } from "node:http";
import app from "../app";
import { pool } from "@workspace/db";

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

async function getJson(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}${path}`);
  assert(
    res.status === 200,
    `GET ${path} should return 200, got ${res.status} — an admin surface is broken`,
  );
  const ct = res.headers.get("content-type") ?? "";
  assert(
    ct.includes("application/json"),
    `GET ${path} should return JSON, got content-type "${ct}"`,
  );
  const body = (await res.json()) as Record<string, unknown>;
  assert(
    body && typeof body === "object",
    `GET ${path} should return a JSON object`,
  );
  return body;
}

async function postJson(
  path: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert(
    res.status === 200,
    `POST ${path} should return 200, got ${res.status} — an admin surface is broken`,
  );
  const body = (await res.json()) as Record<string, unknown>;
  assert(
    body && typeof body === "object",
    `POST ${path} should return a JSON object`,
  );
  return body;
}

async function main() {
  assert(
    process.env.NODE_ENV !== "production" &&
      process.env.DEV_AUTH_BYPASS === "true",
    "this test requires NODE_ENV=development and DEV_AUTH_BYPASS=true",
  );

  await startServer();

  // WP-S1: isAdmin heeft GEEN dev-bypass meer — de geïmpersoneerde identiteit
  // krijgt uitsluitend de rechten van de echte rij. Eerst bewijzen dat de
  // strikte poort dicht zit, daarna de dev-gebruiker expliciet admin maken
  // via SPARKI_ADMIN_IDS zodat de admin-oppervlakken zelf getest kunnen worden.
  let devClerkId = "";
  await scenario(
    "strikte poort: zonder SPARKI_ADMIN_IDS is de dev-gebruiker GEEN admin",
    async () => {
      const saved = process.env.SPARKI_ADMIN_IDS;
      delete process.env.SPARKI_ADMIN_IDS;
      try {
        const body = await getJson("/api/admin/whoami");
        assert(
          typeof body.clerkId === "string" && (body.clerkId as string).length > 0,
          `whoami should return a non-empty clerkId, got ${JSON.stringify(body)}`,
        );
        devClerkId = body.clerkId as string;
        assert(
          body.isAdmin === false,
          `whoami must report isAdmin:false without SPARKI_ADMIN_IDS (dev bypass removed in WP-S1), got ${JSON.stringify(body)}`,
        );
        const res = await fetch(`${baseUrl}/api/admin/status`);
        assert(
          res.status === 403,
          `GET /api/admin/status must be 403 for a non-admin, got ${res.status}`,
        );
      } finally {
        if (saved !== undefined) process.env.SPARKI_ADMIN_IDS = saved;
      }
    },
  );
  // Vanaf hier: expliciet admin gemaakt (zoals in productie via het secret).
  process.env.SPARKI_ADMIN_IDS = [
    process.env.SPARKI_ADMIN_IDS ?? "",
    devClerkId,
  ]
    .filter(Boolean)
    .join(",");

  await scenario("GET /api/admin/whoami → clerkId + isAdmin:true", async () => {
    const body = await getJson("/api/admin/whoami");
    assert(
      typeof body.clerkId === "string" && (body.clerkId as string).length > 0,
      `whoami should return a non-empty clerkId, got ${JSON.stringify(body)}`,
    );
    assert(
      body.isAdmin === true,
      `whoami should report isAdmin:true once SPARKI_ADMIN_IDS includes the dev user, got ${JSON.stringify(body)}`,
    );
  });

  await scenario("GET /api/admin/status → numeric system counts", async () => {
    const body = await getJson("/api/admin/status");
    const status = body.status as Record<string, unknown> | undefined;
    assert(
      status && typeof status === "object",
      `status should return { status: {...} }, got ${JSON.stringify(body)}`,
    );
    for (const key of ["users", "observations", "activity_imports"]) {
      assert(
        typeof status![key] === "number",
        `status.${key} should be a number, got ${JSON.stringify(status![key])} — ` +
          `handler body may have been replaced by a bad merge`,
      );
    }
  });

  await scenario("GET /api/admin/testers → tester roster array", async () => {
    const body = await getJson("/api/admin/testers");
    assert(
      Array.isArray(body.testers),
      `testers should return { testers: [...] }, got keys ${Object.keys(body).join(",")}`,
    );
    for (const row of body.testers as Record<string, unknown>[]) {
      assert(
        "invitationId" in row && "inviteStatus" in row && "feedbackTotal" in row,
        `tester rows should carry invitationId/inviteStatus/feedbackTotal, got keys ${Object.keys(row).join(",")}`,
      );
    }
  });

  await scenario("GET /api/admin/feedback → feedback rows array", async () => {
    const body = await getJson("/api/admin/feedback");
    assert(
      Array.isArray(body.feedback),
      `feedback should return { feedback: [...] }, got keys ${Object.keys(body).join(",")}`,
    );
    for (const row of body.feedback as Record<string, unknown>[]) {
      assert(
        "id" in row && "createdAt" in row,
        `feedback rows should carry id/createdAt, got keys ${Object.keys(row).join(",")}`,
      );
    }
  });

  await scenario("GET /api/admin/failed-imports → imports array", async () => {
    const body = await getJson("/api/admin/failed-imports");
    assert(
      Array.isArray(body.imports),
      `failed-imports should return { imports: [...] }, got keys ${Object.keys(body).join(",")}`,
    );
    for (const row of body.imports as Record<string, unknown>[]) {
      assert(
        "id" in row && "status" in row && "uploadedAt" in row,
        `failed-import rows should carry id/status/uploadedAt, got keys ${Object.keys(row).join(",")}`,
      );
      assert(
        row.status === "failed",
        `failed-imports should only contain failed rows, got status ${JSON.stringify(row.status)}`,
      );
    }
  });

  await scenario(
    "GET /api/admin/data-provenance → gebruiker + surfaces shape",
    async () => {
      // Provenance requires an existing user_profiles row. Use a real one from
      // the DB; if the DB has no users at all, verify the honest 400 on a
      // missing clerkId instead (still proves the handler body is intact).
      // Andere test-workflows draaien parallel en ruimen hun tijdelijke
      // test_-gebruikers op; mijd die rijen en probeer meerdere kandidaten,
      // anders 404't deze check op een net-verwijderde gebruiker (flaky race).
      const { rows } = await pool.query(
        `SELECT clerk_id FROM user_profiles
          ORDER BY (clerk_id LIKE 'test\\_%') ASC
          LIMIT 5`,
      );
      if (rows.length === 0) {
        const res = await fetch(`${baseUrl}/api/admin/data-provenance`);
        assert(
          res.status === 400,
          `data-provenance without clerkId should return 400, got ${res.status}`,
        );
        return;
      }
      let clerkId = "";
      let body: Record<string, unknown> | null = null;
      for (const row of rows) {
        clerkId = String(row.clerk_id);
        const res = await fetch(
          `${baseUrl}/api/admin/data-provenance?clerkId=${encodeURIComponent(clerkId)}`,
        );
        if (res.status === 404) continue; // gebruiker net verwijderd door parallelle test
        assert(res.ok, `data-provenance returned ${res.status} for ${clerkId}`);
        body = (await res.json()) as Record<string, unknown>;
        break;
      }
      if (body === null) {
        // Álle kandidaten verdwenen tijdens de run (alleen tijdelijke
        // test-gebruikers aanwezig) — toets dan de eerlijke 400 als bewijs
        // dat de handler intact is.
        const res = await fetch(`${baseUrl}/api/admin/data-provenance`);
        assert(
          res.status === 400,
          `data-provenance without clerkId should return 400, got ${res.status}`,
        );
        return;
      }
      const gebruiker = body.gebruiker as Record<string, unknown> | undefined;
      assert(
        gebruiker && gebruiker.clerkId === clerkId,
        `data-provenance should echo the requested user, got ${JSON.stringify(body.gebruiker)}`,
      );
      assert(
        Array.isArray(body.surfaces) && (body.surfaces as unknown[]).length > 0,
        "data-provenance.surfaces should be a non-empty array (one per data block)",
      );
      for (const s of body.surfaces as Record<string, unknown>[]) {
        for (const key of ["key", "label", "bron", "aantalRecords", "herkomst"]) {
          assert(
            key in s,
            `provenance surface rows should carry ${key}, got keys ${Object.keys(s).join(",")}`,
          );
        }
        assert(
          s.herkomst !== "controle mislukt — bron niet bereikbaar",
          `provenance surface "${String(s.key)}" reported an unreachable source — table/column drift?`,
        );
      }
    },
  );

  await scenario(
    "POST /api/admin/data-trust/cleanup (droogdraai) → kandidaten shape",
    async () => {
      // Dry run only — must never delete anything from this test.
      const body = await postJson("/api/admin/data-trust/cleanup", {
        clerkId: "admin-smoke-nonexistent-user",
      });
      assert(
        body.modus === "droogdraai",
        `cleanup without apply must stay a dry run, got modus ${JSON.stringify(body.modus)}`,
      );
      const kandidaten = body.kandidaten as Record<string, unknown> | undefined;
      assert(
        kandidaten && typeof kandidaten === "object",
        `cleanup should return { kandidaten: {...} }, got keys ${Object.keys(body).join(",")}`,
      );
      assert(
        Array.isArray(kandidaten!.engelstaligeObservaties) &&
          Array.isArray(kandidaten!.dubbeleFtpHistorie),
        `kandidaten should carry engelstaligeObservaties/dubbeleFtpHistorie arrays, got keys ${Object.keys(kandidaten!).join(",")}`,
      );
    },
  );

  await scenario(
    "GET /api/admin/data-trust/dashboard → data-trust snapshot shape",
    async () => {
      const body = await getJson("/api/admin/data-trust/dashboard");
      assert(
        Array.isArray(body.datasets),
        "data-trust dashboard.datasets should be an array",
      );
      assert(
        "ontbrekend" in body && "conflicten" in body && "duplicaten" in body,
        `dashboard should carry ontbrekend/conflicten/duplicaten, got keys ${Object.keys(body).join(",")}`,
      );
      const syncfouten = body.syncfouten as Record<string, unknown> | undefined;
      assert(
        syncfouten && Array.isArray(syncfouten.recent),
        "dashboard.syncfouten.recent should be an array",
      );
      assert(
        typeof body.opgehaald === "string",
        "dashboard.opgehaald should be an ISO timestamp string",
      );
    },
  );

  await scenario(
    "GET /api/release/admin/users → gebruikersbeheer users array",
    async () => {
      const body = await getJson("/api/release/admin/users");
      assert(
        Array.isArray(body.users),
        `admin users should return { users: [...] }, got keys ${Object.keys(body).join(",")}`,
      );
      for (const row of body.users as Record<string, unknown>[]) {
        for (const key of ["clerkId", "displayName", "email", "releaseGroup", "roles"]) {
          assert(
            key in row,
            `user rows should carry ${key}, got keys ${Object.keys(row).join(",")}`,
          );
        }
      }
    },
  );

  await scenario(
    "GET /api/admin/sync-diagnostics → sync-diagnose shape",
    async () => {
      const body = await getJson("/api/admin/sync-diagnostics");
      for (const key of ["providers", "recentRuns", "webhooks", "failedWebhooks"]) {
        assert(
          Array.isArray(body[key]),
          `sync-diagnostics.${key} should be an array, got keys ${Object.keys(body).join(",")}`,
        );
      }
      for (const row of body.providers as Record<string, unknown>[]) {
        assert(
          "provider" in row && typeof row.totalRuns === "number" && typeof row.failedRuns === "number",
          `provider rows should carry provider/totalRuns/failedRuns, got keys ${Object.keys(row).join(",")}`,
        );
      }
      for (const row of body.recentRuns as Record<string, unknown>[]) {
        assert(
          "id" in row && "provider" in row && "status" in row && "startedAt" in row,
          `recent run rows should carry id/provider/status/startedAt, got keys ${Object.keys(row).join(",")}`,
        );
      }
    },
  );

  await scenario(
    "GET /api/admin/quality → analysekwaliteit shape",
    async () => {
      const body = await getJson("/api/admin/quality");
      assert(
        body.totals && typeof body.totals === "object" && !Array.isArray(body.totals),
        `quality.totals should be an object, got keys ${Object.keys(body).join(",")}`,
      );
      assert(
        Array.isArray(body.byEngine) && Array.isArray(body.byRule) && Array.isArray(body.recentIncorrect),
        `quality should carry byEngine/byRule/recentIncorrect arrays, got keys ${Object.keys(body).join(",")}`,
      );
      for (const row of body.recentIncorrect as Record<string, unknown>[]) {
        assert(
          "id" in row && "reasonCode" in row && "updatedAt" in row,
          `recentIncorrect rows should carry id/reasonCode/updatedAt, got keys ${Object.keys(row).join(",")}`,
        );
      }
    },
  );

  await scenario("GET /api/admin/health → dashboard snapshot shape", async () => {
    const body = await getJson("/api/admin/health");
    assert(
      typeof body.overall === "string" &&
        ["green", "orange", "red", "grey"].includes(body.overall as string),
      `health.overall should be green/orange/red/grey, got ${JSON.stringify(body.overall)}`,
    );
    assert(
      Array.isArray(body.checks) && (body.checks as unknown[]).length > 0,
      "health.checks should be a non-empty array (every defined check renders, even before its first run)",
    );
    const first = (body.checks as Record<string, unknown>[])[0];
    for (const key of ["checkKey", "statusColor", "title"]) {
      assert(
        key in first,
        `health check rows should carry ${key}, got keys ${Object.keys(first).join(",")}`,
      );
    }
    assert(
      Array.isArray(body.openErrors),
      "health.openErrors should be an array",
    );
    assert(
      body.aggregates && typeof body.aggregates === "object",
      "health.aggregates should be an object",
    );
  });
}

async function shutdown(code: number) {
  await stopServer().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== admin routes smoke — test results ===");
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await shutdown(1);
  });
