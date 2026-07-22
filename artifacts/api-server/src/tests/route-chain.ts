// Golf 19 — complete routeketen: bibliotheek, delen, versies en vergelijken.
//
// Boot de ECHTE Express-app en bewijst end-to-end:
//   • bibliotheek: zoeken (q), scopes (mijn/favoriet/archief) en sorteren
//   • favoriet en archiveren via PUT; archief staat niet tussen "mijn"
//   • inhoudelijke wijziging (naam) verhoogt het versienummer; favoriet niet
//   • dupliceren maakt een eigen kopie (versie 1, niet gedeeld)
//   • delen met coach: coach ziet lijst /gedeeld + privacy-detail (geen nav,
//     geen waypoints, afgeschermde geometrie); een vreemde krijgt 404
//   • navigatie-start legt versiegebruik vast (context "navigatie", idempotent)
//   • wedstrijd-koppeling legt versiegebruik vast (context "wedstrijd")
//   • vergelijken met een echt gereden track: dekking + verschillen +
//     versiegebruik (context "activiteit"); import zonder track ⇒ eerlijke 422
//   • verwijderen: route met historie wordt ZACHT verwijderd (dossier blijft
//     kloppen), route zonder historie verdwijnt echt
//
// Run: `pnpm --filter @workspace/api-server run test:route-chain`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  racesTable,
  routesTable,
  routeSharesTable,
  routeVersionUsagesTable,
  activityImportsTable,
  coachAthleteLinksTable,
  userProfilesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
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

const RUN = `test_routechain_${Date.now()}`;
const athlete = `${RUN}_a`;
const coach = `${RUN}_c`;
const stranger = `${RUN}_s`;

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
  for (const c of [athlete, coach, stranger]) {
    await db.delete(racesTable).where(eq(racesTable.clerkId, c)).catch(() => {});
    await db
      .delete(routeVersionUsagesTable)
      .where(eq(routeVersionUsagesTable.clerkId, c))
      .catch(() => {});
    await db
      .delete(routeSharesTable)
      .where(eq(routeSharesTable.ownerClerkId, c))
      .catch(() => {});
    await db
      .delete(activityImportsTable)
      .where(eq(activityImportsTable.clerkId, c))
      .catch(() => {});
    await db.delete(routesTable).where(eq(routesTable.clerkId, c)).catch(() => {});
    await db
      .delete(coachAthleteLinksTable)
      .where(eq(coachAthleteLinksTable.coachClerkId, c))
      .catch(() => {});
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, c))
      .catch(() => {});
  }
}

// Een klein maar echt lijntje (Utrechtse Heuvelrug), ± noord-zuid.
const GEO: [number, number][] = Array.from({ length: 40 }, (_, i) => [
  52.0 + i * 0.001,
  5.2 + i * 0.0005,
]);

async function seedRoute(name: string, extra: Record<string, unknown> = {}) {
  const [row] = await db
    .insert(routesTable)
    .values({
      clerkId: athlete,
      name,
      surface: "asfalt",
      distanceKm: 42.5,
      elevationGainM: 380,
      durationSec: 5400,
      geometry: GEO,
      nav: [{ km: 1.2, dir: "rechts", note: "Bij de kerk rechts" }],
      profile: [0, 50, 120, 60],
      meetpoints: [
        { lat: GEO[10]![0], lon: GEO[10]![1], name: "Bakkerij", note: null },
        { lat: 51.0, lon: 4.0, name: "Ver weg", note: null },
      ],
      source: "generated",
      status: "ready",
      ...extra,
    } as never)
    .returning();
  return row!;
}

async function main() {
  await startServer();
  await ensureAccount(athlete, `${athlete}@example.test`, "Renner", silentLogger);
  await ensureAccount(coach, `${coach}@example.test`, "Coach", silentLogger);
  await ensureAccount(stranger, `${stranger}@example.test`, "Vreemde", silentLogger);

  // Geaccepteerde coach-koppeling voor het delen-met-coach-pad.
  await db.insert(coachAthleteLinksTable).values({
    coachClerkId: coach,
    athleteClerkId: athlete,
    status: "accepted",
  } as never);

  const r1 = await seedRoute("Heuvelrug rondje");
  const r2 = await seedRoute("Vlakke polder", {
    distanceKm: 61.1,
    elevationGainM: 40,
  });

  await scenario("bibliotheek: zoeken op naam vindt alleen de juiste route", async () => {
    const res = await req("GET", "/api/routes?q=polder&scope=mijn", athlete);
    assert(res.status === 200, `status ${res.status}`);
    const names = res.json.routes.map((r: any) => r.name);
    assert(names.includes("Vlakke polder"), "polder ontbreekt");
    assert(!names.includes("Heuvelrug rondje"), "zoekfilter lekt");
  });

  await scenario("bibliotheek: sorteren op afstand zet de langste eerst", async () => {
    const res = await req("GET", "/api/routes?scope=mijn&sort=afstand", athlete);
    const mine = res.json.routes.filter((r: any) =>
      [r1.id, r2.id].includes(r.id),
    );
    assert(mine[0]?.id === r2.id, "langste route staat niet eerst");
  });

  await scenario("favoriet: PUT zet ster, scope=favoriet filtert, versie blijft", async () => {
    const put = await req("PUT", `/api/routes/${r1.id}`, athlete, {
      favorite: true,
    });
    assert(put.status === 200, `status ${put.status}`);
    assert(put.json.route.favorite === true, "favorite niet gezet");
    assert(put.json.route.version === 1, "favoriet mag versie niet verhogen");
    const fav = await req("GET", "/api/routes?scope=favoriet", athlete);
    const ids = fav.json.routes.map((r: any) => r.id);
    assert(ids.includes(r1.id) && !ids.includes(r2.id), "favoriet-scope klopt niet");
  });

  await scenario("versie: naam wijzigen verhoogt het versienummer", async () => {
    const put = await req("PUT", `/api/routes/${r1.id}`, athlete, {
      name: "Heuvelrug rondje v2",
    });
    assert(put.status === 200, `status ${put.status}`);
    assert(put.json.route.version === 2, `versie ${put.json.route.version}, verwacht 2`);
  });

  await scenario("archief: archiveren haalt route uit 'mijn', archief-scope toont hem", async () => {
    await req("PUT", `/api/routes/${r2.id}`, athlete, { status: "archived" });
    const mijn = await req("GET", "/api/routes?scope=mijn", athlete);
    assert(
      !mijn.json.routes.some((r: any) => r.id === r2.id),
      "gearchiveerde route staat nog in mijn",
    );
    const arch = await req("GET", "/api/routes?scope=archief", athlete);
    assert(
      arch.json.routes.some((r: any) => r.id === r2.id),
      "archief-scope mist de route",
    );
    await req("PUT", `/api/routes/${r2.id}`, athlete, { status: "ready" });
  });

  await scenario("dupliceren: kopie is versie 1, eigen bezit, met (kopie) in de naam", async () => {
    const res = await req("POST", `/api/routes/${r1.id}/duplicate`, athlete);
    assert(res.status === 201 || res.status === 200, `status ${res.status}`);
    assert(res.json.route.version === 1, "kopie moet op versie 1 beginnen");
    assert(res.json.route.clerkId === athlete, "kopie niet van renner");
    assert(String(res.json.route.name).includes("kopie"), "naam mist (kopie)");
  });

  let shareId = 0;
  await scenario("delen: eigenaar deelt met coach (idempotent)", async () => {
    const res = await req("POST", `/api/routes/${r1.id}/delen`, athlete, {
      audience: "coach",
    });
    assert(res.status === 201, `status ${res.status}`);
    shareId = res.json.share.id;
    const again = await req("POST", `/api/routes/${r1.id}/delen`, athlete, {
      audience: "coach",
    });
    assert(again.status === 200, `tweede keer status ${again.status}`);
    assert(again.json.share.id === shareId, "idempotentie faalt");
  });

  await scenario("delen: coach ziet route in /gedeeld met versienummer", async () => {
    const res = await req("GET", "/api/routes/gedeeld", coach);
    assert(res.status === 200, `status ${res.status}`);
    const item = res.json.routes.find((r: any) => r.id === r1.id);
    assert(item, "gedeelde route ontbreekt bij coach");
    assert(item.gedeeldVia === "coach", "gedeeldVia klopt niet");
    assert(item.version === 2, "versienummer ontbreekt/verkeerd");
  });

  await scenario("privacy: coach-detail heeft geen nav/waypoints en afgeschermde geometrie", async () => {
    const res = await req("GET", `/api/routes/${r1.id}`, coach);
    assert(res.status === 200, `status ${res.status}`);
    const v = res.json.route;
    assert(v.gedeeld === true, "kijkersweergave niet gemarkeerd");
    assert(v.nav === null && v.waypoints === null, "nav/waypoints lekken");
    assert(
      Array.isArray(v.geometry) && v.geometry.length < GEO.length,
      "geometrie niet afgeschermd/vereenvoudigd",
    );
    assert(typeof v.privacyNote === "string", "privacy-uitleg ontbreekt");
  });

  await scenario("isolatie: een vreemde krijgt 404 op de gedeelde route", async () => {
    const res = await req("GET", `/api/routes/${r1.id}`, stranger);
    assert(res.status === 404, `status ${res.status}, verwacht 404`);
  });

  await scenario("isolatie: een vreemde kan geen navigatie-start melden (404)", async () => {
    const res = await req("POST", `/api/routes/${r1.id}/navigatie-start`, stranger);
    assert(res.status === 404, `status ${res.status}, verwacht 404`);
  });

  await scenario("navigatie-start: legt versiegebruik vast (idempotent per versie)", async () => {
    const res = await req("POST", `/api/routes/${r1.id}/navigatie-start`, athlete);
    assert(res.status === 200, `status ${res.status}`);
    assert(res.json.version === 2, "versie in antwoord klopt niet");
    await req("POST", `/api/routes/${r1.id}/navigatie-start`, athlete);
    const rows = await db
      .select()
      .from(routeVersionUsagesTable)
      .where(
        and(
          eq(routeVersionUsagesTable.routeId, r1.id),
          eq(routeVersionUsagesTable.context, "navigatie"),
          eq(routeVersionUsagesTable.clerkId, athlete),
        ),
      );
    assert(rows.length === 1, `verwacht 1 gebruiksrij, kreeg ${rows.length}`);
    assert(rows[0]!.version === 2, "vastgelegde versie klopt niet");
  });

  await scenario("wedstrijd: route koppelen legt versiegebruik 'wedstrijd' vast", async () => {
    const res = await req("POST", "/api/races", athlete, {
      name: "Ronde van de Heuvelrug",
      raceDate: "2026-09-06",
      routeId: r1.id,
    });
    assert(res.status === 201, `status ${res.status}`);
    const rows = await db
      .select()
      .from(routeVersionUsagesTable)
      .where(
        and(
          eq(routeVersionUsagesTable.routeId, r1.id),
          eq(routeVersionUsagesTable.context, "wedstrijd"),
        ),
      );
    assert(rows.length === 1, `verwacht 1 wedstrijd-gebruiksrij, kreeg ${rows.length}`);
    assert(rows[0]!.contextId === res.json.id, "contextId ≠ race-id");
  });

  await scenario("vergelijk: echt gereden track geeft dekking + verschillen + meetpunten", async () => {
    // Gereden spoor = de route zelf plus een bewuste afwijking in het midden.
    const ridden = GEO.map((p, i) =>
      i >= 15 && i <= 24 ? [p[0], p[1] + 0.02] : p,
    );
    const [imp] = await db
      .insert(activityImportsTable)
      .values({
        clerkId: athlete,
        fileName: "rit.gpx",
        fileType: "gpx",
        source: "upload",
        status: "parsed",
        parsedSummary: {
          pointCount: ridden.length,
          distanceKm: 44.1,
          elevationGainM: 401,
          route: { geometry: ridden },
        },
      } as never)
      .returning();
    const res = await req(
      "GET",
      `/api/routes/${r1.id}/vergelijk?importId=${imp!.id}`,
      athlete,
    );
    assert(res.status === 200, `status ${res.status}: ${JSON.stringify(res.json)}`);
    const v = res.json.vergelijk;
    assert(v.dekkingPct > 0 && v.dekkingPct < 100, `dekking ${v.dekkingPct}%`);
    assert(v.afwijkingen.length >= 1, "afwijking niet gedetecteerd");
    assert(v.afstand.verschilKm === 1.6, `verschilKm ${v.afstand.verschilKm}`);
    assert(
      v.meetpunten.totaal === 2 &&
        v.meetpunten.gemist.some((m: any) => m.name === "Ver weg"),
      "meetpunten kloppen niet",
    );
    const rows = await db
      .select()
      .from(routeVersionUsagesTable)
      .where(
        and(
          eq(routeVersionUsagesTable.routeId, r1.id),
          eq(routeVersionUsagesTable.context, "activiteit"),
        ),
      );
    assert(rows.length === 1, "activiteit-gebruiksrij ontbreekt");
  });

  await scenario("vergelijk: import zonder track weigert eerlijk met 422", async () => {
    const [imp] = await db
      .insert(activityImportsTable)
      .values({
        clerkId: athlete,
        fileName: "zonder-track.fit",
        fileType: "fit",
        source: "upload",
        status: "parsed",
        parsedSummary: { distanceKm: 30 },
      } as never)
      .returning();
    const res = await req(
      "GET",
      `/api/routes/${r1.id}/vergelijk?importId=${imp!.id}`,
      athlete,
    );
    assert(res.status === 422, `status ${res.status}, verwacht 422`);
  });

  await scenario("verwijderen: route met historie wordt zacht verwijderd", async () => {
    const res = await req("DELETE", `/api/routes/${r1.id}`, athlete);
    assert(res.status === 200, `status ${res.status}`);
    const [row] = await db
      .select()
      .from(routesTable)
      .where(eq(routesTable.id, r1.id));
    assert(row, "route hard verdwenen ondanks historie");
    assert(row!.deletedAt != null, "deletedAt niet gezet");
    const list = await req("GET", "/api/routes?scope=mijn", athlete);
    assert(
      !list.json.routes.some((r: any) => r.id === r1.id),
      "zacht verwijderde route staat nog in de lijst",
    );
  });

  await scenario("verwijderen: route zonder historie verdwijnt echt", async () => {
    const res = await req("DELETE", `/api/routes/${r2.id}`, athlete);
    assert(res.status === 200, `status ${res.status}`);
    const [row] = await db
      .select()
      .from(routesTable)
      .where(eq(routesTable.id, r2.id));
    assert(!row, "route zonder historie is niet hard verwijderd");
  });

  await stopServer();
  await cleanup();

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(
      `${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`,
    );
  }
  console.log(
    `\n${results.length - failed.length}/${results.length} scenario's geslaagd`,
  );
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("route-chain test crashed:", err);
  await cleanup().catch(() => {});
  process.exit(1);
});
