// Bordjes sprinten GESTOPT — regressietest op de blokkade.
//
// Besluit 31-07-2026: het sprintspel is stopgezet wegens veiligheidsrisico op
// de openbare weg. Dit contract bewaakt dat de stop niet stilletjes terugdraait:
// - alle vijf startpaden geven 410 (ook ZONDER inlog — de blokkade zit vóór auth)
//   met een eerlijke stopmelding en stopped:true;
// - GET /api/sprints/season blijft bestaan (alleen-lezen historie) en is dus
//   géén 410 (auth-gedrag blijft zoals het was);
// - de webapp routeert /sprinten niet meer en de actieve navigator bevat geen
//   sprint-startpad meer (bron-greps).
//
// Run: `pnpm --filter @workspace/api-server run test:sprints-stop`

import { readFileSync } from "node:fs";
import { join } from "node:path";
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

const BLOCKED: { method: string; path: string }[] = [
  { method: "GET", path: "/api/sprints/route/1" },
  { method: "POST", path: "/api/sprints/route/1/rescan" },
  { method: "POST", path: "/api/sprints/result" },
  { method: "POST", path: "/api/sprints/place" },
  { method: "POST", path: "/api/sprints/result/1/share" },
];

// De test draait vanuit artifacts/api-server (gecompileerd naar dist-tests),
// dus de webbron wordt via de werkmap gevonden, niet via __dirname.
const WEB_SRC = join(process.cwd(), "../sparki/src");

async function main() {
  await startServer();

  for (const ep of BLOCKED) {
    await scenario(`410 zonder inlog: ${ep.method} ${ep.path}`, async () => {
      const res = await fetch(`${baseUrl}${ep.path}`, { method: ep.method });
      assert(res.status === 410, `verwacht 410, kreeg ${res.status}`);
      const body = (await res.json()) as { error?: string; stopped?: boolean };
      assert(body.stopped === true, "stopped:true ontbreekt");
      assert(
        typeof body.error === "string" && body.error.includes("gestopt"),
        "eerlijke stopmelding ontbreekt",
      );
    });
  }

  await scenario("historie blijft: GET /api/sprints/season is geen 410", async () => {
    const res = await fetch(`${baseUrl}/api/sprints/season`);
    assert(res.status !== 410, `season mag nooit 410 zijn, kreeg ${res.status}`);
  });

  await scenario("web: /sprinten is niet meer gerout", async () => {
    const appTsx = readFileSync(join(WEB_SRC, "App.tsx"), "utf8");
    assert(!appTsx.includes('"/sprinten"'), "App.tsx routeert /sprinten nog");
    assert(!/SprintenPage/.test(appTsx), "App.tsx importeert SprintenPage nog");
  });

  await scenario("web: actieve navigator bevat geen sprint-startpad", async () => {
    const nav = readFileSync(
      join(WEB_SRC, "components/sparki/route-navigator.tsx"),
      "utf8",
    );
    for (const forbidden of [
      "useSprintBoards",
      "useSubmitSprint",
      "makeSprintClientKey",
      "SprintBoard",
    ]) {
      assert(!nav.includes(forbidden), `route-navigator gebruikt nog ${forbidden}`);
    }
  });

  await stopServer();
  await pool.end();

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "[PASS]" : "[FAIL]";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
