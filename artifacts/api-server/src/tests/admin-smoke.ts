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

async function main() {
  assert(
    process.env.NODE_ENV !== "production" &&
      process.env.DEV_AUTH_BYPASS === "true",
    "this test requires NODE_ENV=development and DEV_AUTH_BYPASS=true",
  );

  await startServer();

  await scenario("GET /api/admin/whoami → clerkId + isAdmin:true", async () => {
    const body = await getJson("/api/admin/whoami");
    assert(
      typeof body.clerkId === "string" && (body.clerkId as string).length > 0,
      `whoami should return a non-empty clerkId, got ${JSON.stringify(body)}`,
    );
    assert(
      body.isAdmin === true,
      `whoami should report isAdmin:true under the dev bypass, got ${JSON.stringify(body)}`,
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
