// Wedstrijdintelligence — wedstrijdpunten (kaartcontrole) end-to-end.
//
// Boot de ECHTE Express-app en bewijst:
//   • races dragen localLaps/assignment (normalisatie: int 0–99, anders null)
//   • handmatig punt = direct "bevestigd", zonder bron/betrouwbaarheid
//   • kaartklik zonder km snapt deterministisch op de gekoppelde route
//   • verplaatsen/tekstwijziging ⇒ status "aangepast"
//   • status kan NOOIT terug naar "voorgesteld" (400)
//   • afwijzen haalt het punt uit de actieve telling
//   • routes GET /:id levert bij usageType=wedstrijd het race-blok met
//     UITSLUITEND actieve punten (voorstellen blijven onzichtbaar)
//   • isolatie: account B ziet/bewerkt de punten van A niet (404)
//
// Run: `pnpm --filter @workspace/api-server run test:race-points`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  racePointsTable,
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

const RUN = `test_racepts_${Date.now()}`;
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
    await db.delete(racePointsTable).where(eq(racePointsTable.clerkId, c)).catch(() => {});
    await db.delete(racesTable).where(eq(racesTable.clerkId, c)).catch(() => {});
    await db.delete(routesTable).where(eq(routesTable.clerkId, c)).catch(() => {});
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, c)).catch(() => {});
  }
}

async function main() {
  await startServer();

  await ensureAccount(clerkA, `${clerkA}@example.test`, "Renner A", silentLogger);
  await ensureAccount(clerkB, `${clerkB}@example.test`, "Renner B", silentLogger);

  // Route van A: rechte lijn noordwaarts (~11 km) zodat snappen voorspelbaar is.
  const geometry: [number, number][] = [];
  for (let i = 0; i <= 100; i++) geometry.push([50.8 + i * 0.001, 5.9]);
  const [routeA] = await db
    .insert(routesTable)
    .values({
      clerkId: clerkA,
      name: "Wedstrijdparcours",
      surface: "asfalt",
      usageType: "wedstrijd",
      distanceKm: 11.1,
      geometry,
    })
    .returning();

  let raceId = 0;
  let proposedId = 0;
  let manualId = 0;

  await scenario("race draagt localLaps + assignment (normalisatie)", async () => {
    const r = await req("POST", "/api/races", clerkA, {
      name: "Ronde van Sittard",
      raceDate: "2099-08-01",
      routeId: routeA!.id,
      localLaps: 3,
      assignment: "Voorin zitten bij de lokale ronden.",
    });
    assert(r.status === 201, `expected 201, got ${r.status}`);
    raceId = r.json.id;
    assert(r.json.localLaps === 3, "localLaps opgeslagen");
    assert(String(r.json.assignment).includes("Voorin"), "assignment opgeslagen");
    const bad = await req("PUT", `/api/races/${raceId}`, clerkA, { localLaps: 250 });
    assert(bad.status === 200, `expected 200, got ${bad.status}`);
    assert(bad.json.localLaps === null, "localLaps buiten bereik ⇒ null");
    const fix = await req("PUT", `/api/races/${raceId}`, clerkA, { localLaps: 3 });
    assert(fix.json.localLaps === 3, "localLaps hersteld");
  });

  await scenario("handmatig punt = direct bevestigd, zonder bron", async () => {
    const r = await req("POST", `/api/races/${raceId}/points`, clerkA, {
      kind: "gevaar",
      description: "Krappe bocht na de brug",
      raceKm: 4.2,
    });
    assert(r.status === 201, `expected 201, got ${r.status}`);
    manualId = r.json.point.id;
    assert(r.json.point.status === "bevestigd", "status bevestigd");
    assert(r.json.point.confidence === null, "geen betrouwbaarheid");
    assert(r.json.point.sourceFile === null, "geen bron");
    assert(r.json.point.pointClass === "info", "gevaar is info-klasse");
  });

  await scenario("kaartklik zonder km snapt op de route", async () => {
    // Klik halverwege de lijn (index 50 ≈ 5.56 km).
    const r = await req("POST", `/api/races/${raceId}/points`, clerkA, {
      kind: "sprint",
      lat: 50.85,
      lng: 5.9,
    });
    assert(r.status === 201, `expected 201, got ${r.status}`);
    const km = r.json.point.raceKm;
    assert(typeof km === "number" && km > 4.5 && km < 6.5, `km gesnapt (${km})`);
    assert(r.json.point.pointClass === "wedstrijd", "sprint is wedstrijd-klasse");
  });

  await scenario("voorgesteld punt: bevestigen werkt, terug naar voorgesteld niet", async () => {
    const [p] = await db
      .insert(racePointsTable)
      .values({
        raceId,
        clerkId: clerkA,
        kind: "bergprijs",
        pointClass: "wedstrijd",
        label: "Bergprijs",
        description: "Uit de technische gids",
        sourceFile: "gids.pdf",
        sourcePage: 3,
        confidence: "medium",
        status: "voorgesteld",
      })
      .returning();
    proposedId = p!.id;
    const back = await req("PATCH", `/api/races/${raceId}/points/${proposedId}`, clerkA, {
      status: "voorgesteld",
    });
    assert(back.status === 400, `terug naar voorgesteld ⇒ 400, got ${back.status}`);
    const ok = await req("PATCH", `/api/races/${raceId}/points/${proposedId}`, clerkA, {
      status: "bevestigd",
    });
    assert(ok.status === 200 && ok.json.point.status === "bevestigd", "bevestigen werkt");
  });

  await scenario("verplaatsen ⇒ status aangepast + km mee-gesnapt", async () => {
    const r = await req("PATCH", `/api/races/${raceId}/points/${proposedId}`, clerkA, {
      lat: 50.88,
      lng: 5.9,
    });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    assert(r.json.point.status === "aangepast", "status aangepast");
    const km = r.json.point.raceKm;
    assert(typeof km === "number" && km > 7.5 && km < 10.5, `km mee-gesnapt (${km})`);
  });

  await scenario("afwijzen haalt punt uit actieve telling", async () => {
    const before = await req("GET", `/api/races/${raceId}/points`, clerkA);
    const r = await req("PATCH", `/api/races/${raceId}/points/${manualId}`, clerkA, {
      status: "afgewezen",
    });
    assert(r.status === 200, `expected 200, got ${r.status}`);
    const after = await req("GET", `/api/races/${raceId}/points`, clerkA);
    assert(
      after.json.activeCount === before.json.activeCount - 1,
      `actieve telling daalt (${before.json.activeCount} → ${after.json.activeCount})`,
    );
    assert(after.json.localLaps === 3, "GET points draagt localLaps");
  });

  await scenario("route GET levert race-blok met alleen actieve punten", async () => {
    // Voeg nog een onbevestigd voorstel toe: mag NIET meekomen.
    await db.insert(racePointsTable).values({
      raceId,
      clerkId: clerkA,
      kind: "spoorwegovergang",
      pointClass: "info",
      label: "Spoorwegovergang",
      description: "Voorstel uit gids",
      status: "voorgesteld",
    });
    const r = await req("GET", `/api/routes/${routeA!.id}`, clerkA);
    assert(r.status === 200, `expected 200, got ${r.status}`);
    const race = r.json.race;
    assert(race, "race-blok aanwezig bij usageType=wedstrijd");
    assert(race.localLaps === 3, "race-blok draagt localLaps");
    const statuses = new Set((race.points as any[]).map((p) => p.status ?? "?"));
    // Punten in het race-blok zijn alleen bevestigd/aangepast — nooit
    // voorgesteld of afgewezen.
    for (const p of race.points as any[]) {
      assert(p.kind !== "spoorwegovergang", `voorstel lekt niet mee (${[...statuses]})`);
    }
    assert((race.points as any[]).length >= 2, "actieve punten aanwezig");
  });

  await scenario("isolatie: B ziet en bewerkt de punten van A niet", async () => {
    const list = await req("GET", `/api/races/${raceId}/points`, clerkB);
    assert(list.status === 404, `list ⇒ 404, got ${list.status}`);
    const patch = await req("PATCH", `/api/races/${raceId}/points/${proposedId}`, clerkB, {
      status: "afgewezen",
    });
    assert(patch.status === 404, `patch ⇒ 404, got ${patch.status}`);
    const del = await req("DELETE", `/api/races/${raceId}/points/${proposedId}`, clerkB);
    assert(del.status === 404, `delete ⇒ 404, got ${del.status}`);
    const [row] = await db
      .select()
      .from(racePointsTable)
      .where(eq(racePointsTable.id, proposedId));
    assert(row && row.status === "aangepast", "punt van A onaangetast");
  });

  await scenario("verwijderen werkt voor de eigenaar", async () => {
    const r = await req("DELETE", `/api/races/${raceId}/points/${manualId}`, clerkA);
    assert(r.status === 200, `expected 200, got ${r.status}`);
    const [row] = await db
      .select()
      .from(racePointsTable)
      .where(eq(racePointsTable.id, manualId));
    assert(!row, "rij echt weg");
  });

  await stopServer();
  await cleanup();

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
  console.error("test crashed:", err);
  await cleanup().catch(() => {});
  process.exit(1);
});
