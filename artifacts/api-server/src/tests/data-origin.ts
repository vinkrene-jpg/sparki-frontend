// Data Origin & Data Trust — contracttest.
//
// Bewijst:
//   1. /api/data-origin/explain/session/:id is owner-scoped (eigen sessie =
//      volledige herkomst; andermans sessie = 404) en meldt eerlijk wat mist.
//   2. Het berekeningstype-allowlist weigert onbekende types (400) en een
//      type zonder geregistreerde berekening antwoordt eerlijk met
//      "Onvoldoende gegevens beschikbaar." — nooit verzonnen.
//   3. Een geregistreerde berekening (computation_traces) komt terug via
//      /explain/computation met engine + versie + parameters.
//   4. Sessiedetail (/api/sessions/:id) draagt additief een `herkomst`-blok;
//      /api/athlete/load ook — bestaande velden blijven onaangetast.
//   5. Het admin Data Trust Dashboard is afgeschermd (403 voor niet-admins)
//      en levert voor een admin de echte telblokken.
//
// Run: `node ./scripts/run-test.mjs data-origin` (vanuit artifacts/api-server)
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  trainingSessionsTable,
  userProfilesTable,
  athleteProfilesTable,
  computationTracesTable,
  syncRunsTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";

const RUN = `test_origin_${Date.now()}`;
const A = `${RUN}_a`;
const B = `${RUN}_b`;
const ALL = [A, B];

// Admin-gate: A wordt admin gemaakt (isAdmin leest env per request).
process.env["SPARKI_ADMIN_IDS"] = `${process.env["SPARKI_ADMIN_IDS"] ?? ""},${A}`;

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

async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-clerk-id": actor },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* leeg */
  }
  return { status: res.status, json };
}

async function cleanup() {
  await db
    .delete(computationTracesTable)
    .where(inArray(computationTracesTable.clerkId, ALL));
  await db
    .delete(trainingSessionsTable)
    .where(inArray(trainingSessionsTable.clerkId, ALL));
  await db
    .delete(athleteProfilesTable)
    .where(inArray(athleteProfilesTable.clerkId, ALL));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, ALL));
}

async function main() {
  const { default: app } = await import("../app");
  const { ensureAccount, silentLogger } = await import("../lib/account");
  const { recordComputation } = await import("../engines/data-origin");

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

  await ensureAccount(A, `${A}@test.local`, "Origin A", silentLogger);
  await ensureAccount(B, `${B}@test.local`, "Origin B", silentLogger);

  // Sessie voor A (handmatig, zonder vermogen ⇒ ontbrekend moet eerlijk zijn).
  const [sessionA] = await db
    .insert(trainingSessionsTable)
    .values({
      clerkId: A,
      sessionDate: "2026-07-20",
      type: "endurance",
      source: "manual",
      durationMin: 90,
      title: "Herkomsttest-rit",
    })
    .returning();
  if (!sessionA) throw new Error("seed session failed");

  await scenario("explain/session eigen sessie geeft herkomst", async () => {
    const r = await req("GET", `/api/data-origin/explain/session/${sessionA.id}`, A);
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    assert(typeof r.json?.onderwerp === "string", "onderwerp ontbreekt");
    assert(Array.isArray(r.json?.gebruikteGegevens), "gebruikteGegevens geen array");
    assert(
      r.json.gebruikteGegevens.some((g: any) =>
        String(g.bron).toLowerCase().includes("handmatig"),
      ),
      "bron 'handmatig' niet vermeld",
    );
    assert(Array.isArray(r.json?.ontbrekend), "ontbrekend geen array");
    assert(typeof r.json?.betrouwbaarheid === "string", "betrouwbaarheid ontbreekt");
  });

  await scenario("explain/session andermans sessie = 404", async () => {
    const r = await req("GET", `/api/data-origin/explain/session/${sessionA.id}`, B);
    assert(r.status === 404, `verwacht 404, kreeg ${r.status}`);
  });

  await scenario("explain/computation onbekend type = 400", async () => {
    const r = await req("GET", `/api/data-origin/explain/computation/evil_type`, A);
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
  });

  await scenario(
    "explain/computation zonder registratie = eerlijk onvoldoende",
    async () => {
      const r = await req("GET", `/api/data-origin/explain/computation/ftp_floor`, A);
      assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
      assert(
        r.json?.melding === "Onvoldoende gegevens beschikbaar.",
        "melding is niet de eerlijke onvoldoende-tekst",
      );
      assert(r.json?.berekeningen?.length === 0, "berekeningen hoort leeg te zijn");
    },
  );

  await scenario("geregistreerde berekening komt terug via explain", async () => {
    await recordComputation({
      clerkId: A,
      subjectType: "derived_tss",
      subjectId: String(sessionA.id),
      engine: "derived-tss",
      engineVersion: "1",
      parameters: { ftp: 250, normalizedPower: 200 },
      inputs: [
        {
          bron: "handmatig",
          tabel: "training_sessions",
          recordId: sessionA.id,
        },
      ],
    });
    const r = await req(
      "GET",
      `/api/data-origin/explain/computation/derived_tss?subjectId=${sessionA.id}`,
      A,
    );
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    assert(
      r.json?.berekeningen?.some(
        (b: any) => b.engine === "derived-tss" && b.versie === "1",
      ),
      "engine/versie niet teruggegeven",
    );
    assert(r.json?.melding == null, "melding hoort leeg te zijn bij echte trace");
  });

  await scenario("sessiedetail draagt additief herkomst-blok", async () => {
    const r = await req("GET", `/api/athlete/sessions/${sessionA.id}`, A);
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    const s = r.json?.session ?? r.json;
    assert(s?.id === sessionA.id, "bestaand sessieveld id aangetast");
    assert(r.json?.herkomst != null, "herkomst-blok ontbreekt");
    assert(typeof r.json.herkomst.bron === "string", "herkomst.bron ontbreekt");
  });

  await scenario("athlete/load draagt herkomst-blok", async () => {
    const r = await req("GET", `/api/athlete/load`, A);
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    assert(r.json?.herkomst != null, "herkomst-blok ontbreekt");
    assert(
      String(r.json.herkomst.engine ?? "").length > 0,
      "herkomst.engine ontbreekt",
    );
  });

  await scenario(
    "sync-ID is exact per sessie — nooit de nieuwste run",
    async () => {
      // Twee strava-runs; twee sessies elk aangemaakt binnen precies één run.
      const t0 = Date.now();
      const [run1] = await db
        .insert(syncRunsTable)
        .values({
          clerkId: A,
          provider: "strava",
          trigger: "manual",
          status: "success",
          startedAt: new Date(t0 - 60 * 60 * 1000),
          finishedAt: new Date(t0 - 55 * 60 * 1000),
        })
        .returning();
      const [run2] = await db
        .insert(syncRunsTable)
        .values({
          clerkId: A,
          provider: "strava",
          trigger: "manual",
          status: "success",
          startedAt: new Date(t0 - 10 * 60 * 1000),
          finishedAt: new Date(t0 - 5 * 60 * 1000),
        })
        .returning();
      if (!run1 || !run2) throw new Error("seed sync runs failed");
      const [oldSession] = await db
        .insert(trainingSessionsTable)
        .values({
          clerkId: A,
          sessionDate: "2026-07-18",
          type: "endurance",
          source: "strava",
          durationMin: 60,
          createdAt: new Date(t0 - 58 * 60 * 1000),
        })
        .returning();
      if (!oldSession) throw new Error("seed old session failed");

      const r = await req(
        "GET",
        `/api/data-origin/explain/session/${oldSession.id}`,
        A,
      );
      assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
      // De detailroute is de plek waar syncRunId wordt bepaald; controleer
      // daar de exacte koppeling.
      const d = await req("GET", `/api/athlete/sessions/${oldSession.id}`, A);
      assert(d.status === 200, `detail verwacht 200, kreeg ${d.status}`);
      assert(
        d.json?.herkomst?.synchronisatieId === run1.id,
        `verwacht run ${run1.id}, kreeg ${d.json?.herkomst?.synchronisatieId} (nieuwste run is ${run2.id})`,
      );

      // Handmatige sessie zonder bewijsbare run ⇒ eerlijk null.
      const dm = await req("GET", `/api/athlete/sessions/${sessionA.id}`, A);
      assert(
        dm.json?.herkomst?.synchronisatieId == null,
        "handmatige sessie hoort geen sync-ID te dragen",
      );
      await db.delete(syncRunsTable).where(inArray(syncRunsTable.clerkId, ALL));
    },
  );

  await scenario("dashboard 403 voor niet-admin", async () => {
    // De dev-bypass maakt isAdmin() onvoorwaardelijk true; isAdmin leest de
    // env per aanroep, dus tijdelijk uitzetten test de echte 403-poort
    // (A staat wél in SPARKI_ADMIN_IDS, B niet).
    const savedBypass = process.env["DEV_AUTH_BYPASS"];
    process.env["DEV_AUTH_BYPASS"] = "false";
    try {
      const r = await req("GET", `/api/admin/data-trust/dashboard`, B);
      assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
    } finally {
      process.env["DEV_AUTH_BYPASS"] = savedBypass;
    }
  });

  await scenario("dashboard levert echte telblokken voor admin", async () => {
    const r = await req("GET", `/api/admin/data-trust/dashboard`, A);
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    assert(Array.isArray(r.json?.datasets), "datasets geen array");
    assert(r.json?.ontbrekend != null, "ontbrekend ontbreekt");
    assert(r.json?.syncfouten != null, "syncfouten ontbreekt");
    assert(Array.isArray(r.json?.berekeningen), "berekeningen geen array");
    assert(
      r.json.berekeningen.some((b: any) => b.type === "derived_tss"),
      "geregistreerde derived_tss-berekening niet zichtbaar in dashboard",
    );
  });

  await cleanup();
  await new Promise<void>((resolve) => server?.close(() => resolve()));

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
  console.error("test run failed:", err);
  try {
    await cleanup();
  } catch {
    /* leeg */
  }
  process.exit(1);
});
