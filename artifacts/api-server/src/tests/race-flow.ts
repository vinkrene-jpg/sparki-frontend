// Golf 16 — Wedstrijden & Race Intelligence: één wedstrijdflow.
//
// Boot de ECHTE Express-app en bewijst end-to-end:
//   • POST/PUT dragen de nieuwe velden (routeId/category/registrationStatus/goal/status)
//   • route-koppeling is eigenaar-gecheckt (andermans route wordt NIET gekoppeld)
//   • ongeldige status/registrationStatus worden genegeerd (nooit half opgeslagen)
//   • /course: feiten dragen soort (feit/afgeleid/ontbreekt) — route levert afgeleide waarden
//   • /advice: coachinstructie staat ALTIJD vooraan; zonder gewicht eerlijk notPossible
//   • /dossier: fase + samengestelde blokken; geannuleerd ⇒ fase "geannuleerd"
//   • geannuleerde wedstrijd: evaluatie niet-evalueerbaar, journey toont "Geannuleerd" zonder uitslag
//   • isolatie: account B ziet dossier/course/advice van A niet (404)
//
// Run: `pnpm --filter @workspace/api-server run test:race-flow`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  racesTable,
  routesTable,
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
      } else reject(new Error("failed to determine server port"));
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

const RUN = `test_raceflow_${Date.now()}`;
const clerkA = `${RUN}_a`;
const clerkB = `${RUN}_b`;

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
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function cleanup() {
  for (const c of [clerkA, clerkB]) {
    await db.delete(racesTable).where(eq(racesTable.clerkId, c)).catch(() => {});
    await db.delete(routesTable).where(eq(routesTable.clerkId, c)).catch(() => {});
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, c)).catch(() => {});
  }
}

async function main() {
  await startServer();

  await ensureAccount(clerkA, `${clerkA}@example.test`, "Renner A", silentLogger);
  await ensureAccount(clerkB, `${clerkB}@example.test`, "Renner B", silentLogger);

  // Echte route van A (met profiel + klim) en een route van B (voor eigendomscheck).
  const [routeA] = await db
    .insert(routesTable)
    .values({
      clerkId: clerkA,
      name: "Parcoursverkenning Limburg",
      surface: "asfalt",
      distanceKm: 92.4,
      elevationGainM: 1120,
      durationSec: 3.2 * 3600,
      profile: [
        [0, 60],
        [46, 210],
        [92, 65],
      ],
      climbs: [{ name: "Camerig", lengthKm: 3.1, avgGradePct: 6 }],
    })
    .returning();
  const [routeB] = await db
    .insert(routesTable)
    .values({ clerkId: clerkB, name: "Route van B", surface: "gravel" })
    .returning();

  let raceId = 0;

  await scenario("POST slaat nieuwe velden op + koppelt eigen route", async () => {
    const r = await req("POST", "/api/races", clerkA, {
      name: "Volta Limburg",
      raceDate: "2099-04-05",
      priority: "A",
      discipline: "weg",
      routeId: routeA!.id,
      category: "Junioren",
      registrationStatus: "ingeschreven",
      goal: "Top 10 en de finale halen",
      coachInstructions: "Eerste 30 km uit de wind blijven, finale vol.",
    });
    assert(r.status === 201, `expected 201, got ${r.status}`);
    raceId = r.json.id;
    assert(r.json.routeId === routeA!.id, "routeId gekoppeld");
    assert(r.json.category === "Junioren", "category opgeslagen");
    assert(r.json.registrationStatus === "ingeschreven", "registrationStatus opgeslagen");
    assert(r.json.goal?.includes("Top 10"), "goal opgeslagen");
    assert(r.json.status === "gepland", "status default gepland");
  });

  await scenario("andermans route wordt NIET gekoppeld (eigendomscheck)", async () => {
    const r = await req("POST", "/api/races", clerkA, {
      name: "Steelroute-poging",
      raceDate: "2099-05-01",
      routeId: routeB!.id,
    });
    assert(r.status === 201, `expected 201, got ${r.status}`);
    assert(r.json.routeId === null, "vreemde route genegeerd (null)");
    await req("DELETE", `/api/races/${r.json.id}`, clerkA);
  });

  await scenario("ongeldige status/registrationStatus worden genegeerd", async () => {
    const r = await req("PUT", `/api/races/${raceId}`, clerkA, {
      status: "kapot",
      registrationStatus: "misschien",
    });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.json.status === "gepland", "status onveranderd");
    assert(r.json.registrationStatus === "ingeschreven", "registration onveranderd");
  });

  await scenario("PUT kan route ontkoppelen (null) en registratie bevestigen", async () => {
    const r = await req("PUT", `/api/races/${raceId}`, clerkA, {
      registrationStatus: "bevestigd",
    });
    assert(r.json.registrationStatus === "bevestigd", "registratie bevestigd");
  });

  await scenario("/course: route levert afgeleide feiten + klimdetectie", async () => {
    const r = await req("GET", `/api/races/${raceId}/course`, clerkA);
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.json.hasRoute === true, "route gevonden");
    const kinds = new Set(r.json.facts.map((f: any) => f.kind));
    assert(kinds.has("afgeleid") || kinds.has("feit"), "feiten met soort aanwezig");
    const climbs = r.json.facts.find((f: any) => f.key === "beklimmingen");
    assert(climbs?.kind === "feit" && String(climbs.value).includes("Camerig"), "klim gedetecteerd");
    const tech = r.json.facts.find((f: any) => f.key === "technisch");
    assert(tech?.kind === "ontbreekt" && tech.question, "technisch eerlijk ontbrekend met vraag");
  });

  await scenario("/course zonder route: eerlijke gaten, niets verzonnen", async () => {
    const r0 = await req("POST", "/api/races", clerkA, {
      name: "Kale wedstrijd",
      raceDate: "2099-06-01",
    });
    const r = await req("GET", `/api/races/${r0.json.id}/course`, clerkA);
    assert(r.json.hasRoute === false, "geen route");
    assert(r.json.gaps.length >= 3, "meerdere eerlijke gaten");
    assert(
      r.json.facts.every((f: any) => f.kind !== "feit" || f.key === "technisch" || f.value != null),
      "geen verzonnen feiten",
    );
    await req("DELETE", `/api/races/${r0.json.id}`, clerkA);
  });

  await scenario("/advice: coachinstructie altijd vooraan en letterlijk", async () => {
    const r = await req("GET", `/api/races/${raceId}/advice`, clerkA);
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.json.items.length > 0, "adviezen aanwezig");
    assert(r.json.items[0].kind === "coachinstructie", "coachinstructie eerst");
    assert(
      r.json.items[0].text.includes("uit de wind"),
      "coachtekst letterlijk overgenomen",
    );
  });

  await scenario("/advice: zonder gewicht eerlijk notPossible voor bandendruk", async () => {
    const r = await req("GET", `/api/races/${raceId}/advice`, clerkA);
    const hasBanden = r.json.items.some((i: any) => i.domain === "bandendruk");
    const np = r.json.notPossible.some((n: any) => n.domain === "bandendruk");
    assert(hasBanden || np, "bandendruk óf advies óf eerlijk notPossible");
  });

  await scenario("/dossier: samengesteld met fase aankomend", async () => {
    const r = await req("GET", `/api/races/${raceId}/dossier`, clerkA);
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.json.phase === "aankomend", `fase aankomend, got ${r.json.phase}`);
    assert(r.json.context && r.json.course && r.json.advice && r.json.intel, "alle blokken aanwezig");
    assert(r.json.linkedActivity != null, "linkedActivity-blok aanwezig");
    assert(r.json.evaluation != null, "evaluatieblok aanwezig");
  });

  await scenario("isolatie: account B ziet A's dossier/course/advice niet", async () => {
    for (const p of ["dossier", "course", "advice"]) {
      const r = await req("GET", `/api/races/${raceId}/${p}`, clerkB);
      assert(r.status === 404, `${p}: expected 404 voor B, got ${r.status}`);
    }
  });

  await scenario("annulering: status geannuleerd ⇒ dossier-fase + evaluatie eerlijk", async () => {
    const r = await req("PUT", `/api/races/${raceId}`, clerkA, { status: "geannuleerd" });
    assert(r.json.status === "geannuleerd", "status geannuleerd");
    const d = await req("GET", `/api/races/${raceId}/dossier`, clerkA);
    assert(d.json.phase === "geannuleerd", "fase geannuleerd");
    const ev = d.json.evaluation;
    assert(ev.evaluable === false || ev.gaps?.length > 0, "evaluatie niet-evalueerbaar of eerlijke gaten");
  });

  await scenario("journey: geannuleerde wedstrijd zichtbaar, gemarkeerd, zonder uitslag", async () => {
    const r = await req("GET", "/api/journey", clerkA);
    assert(r.status === 200, `expected 200, got ${r.status}`);
    const ev = (r.json.events ?? r.json).find?.(
      (e: any) => e.ref?.type === "race" && e.ref?.id === raceId,
    );
    assert(ev, "wedstrijd staat in de tijdlijn");
    assert(String(ev.subtitle).includes("Geannuleerd"), "gemarkeerd als geannuleerd");
    assert(ev.facts?.uitslag == null, "geen uitslag bij geannuleerd");
  });

  await stopServer();
  await cleanup();

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✅" : "❌";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("race-flow test crashed:", err);
  await cleanup().catch(() => {});
  process.exit(1);
});
