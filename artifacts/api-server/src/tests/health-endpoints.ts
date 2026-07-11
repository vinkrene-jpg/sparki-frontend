// Liveness/health endpoint contract test — publish-safety guard.
//
// The deployment platform's liveness probe hits the api-server's BARE service
// base path ("/api") in addition to the configured startup path
// ("/api/healthz"). If a future refactor of the health/router wiring drops the
// bare "/api" 200, the app still "works" in dev but the publish is marked
// unhealthy and restarts in a loop — a silent break that is easy to miss.
//
// This test boots the REAL Express app and asserts BOTH endpoints answer
// HTTP 200 with a JSON body of { status: "ok" }. If either handler or its
// mount wiring drifts, this fails loudly before a publish can break.
//
// Run: `pnpm --filter @workspace/api-server run test:health-endpoints`
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

async function assertHealthy(path: string): Promise<void> {
  const res = await fetch(`${baseUrl}${path}`);
  assert(
    res.status === 200,
    `GET ${path} should return 200, got ${res.status} — the liveness probe ` +
      `would mark the publish unhealthy`,
  );
  const ct = res.headers.get("content-type") ?? "";
  assert(
    ct.includes("application/json"),
    `GET ${path} should return JSON, got content-type "${ct}"`,
  );
  const body = (await res.json()) as { status?: string };
  assert(
    body.status === "ok",
    `GET ${path} should return { status: "ok" }, got ${JSON.stringify(body)}`,
  );
}

async function main() {
  await startServer();

  await scenario('GET /api returns 200 { status: "ok" }', async () => {
    await assertHealthy("/api");
  });

  await scenario('GET /api/healthz returns 200 { status: "ok" }', async () => {
    await assertHealthy("/api/healthz");
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
    console.log("\n=== liveness/health endpoint contract — test results ===");
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
