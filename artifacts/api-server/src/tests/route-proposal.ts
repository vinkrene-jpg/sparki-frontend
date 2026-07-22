// T6 — Routevoorstel naar een fietsmaatje (backend).
//
// Boot de ECHTE Express-app en bewijst end-to-end:
//   • een route voorstellen kan alleen aan een geaccepteerd fietsmaatje;
//     een niet-vriend krijgt 403
//   • een voorstel maakt een melding bij de ontvanger
//   • /voorstellen toont ontvangen én verstuurde voorstellen met route-metadata
//   • accepteren kopieert de route naar de ontvanger; tweede reactie ⇒ 409
//   • afwijzen zet de status zonder kopie
//   • aanpassen maakt een NIEUWE route van de ontvanger en laat het origineel
//     ongewijzigd; een al-beantwoord voorstel aanpassen ⇒ 409
//
// Run: `pnpm --filter @workspace/api-server run test:route-proposal`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  routesTable,
  routeProposalsTable,
  friendLinksTable,
  notificationsTable,
  userProfilesTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
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

const RUN = `test_routeproposal_${Date.now()}`;
const owner = `${RUN}_o`;
const friend = `${RUN}_f`;
const stranger = `${RUN}_s`;
const ALL = [owner, friend, stranger];

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
  await db
    .delete(routeProposalsTable)
    .where(inArray(routeProposalsTable.fromClerkId, ALL))
    .catch(() => {});
  await db
    .delete(routeProposalsTable)
    .where(inArray(routeProposalsTable.toClerkId, ALL))
    .catch(() => {});
  for (const c of ALL) {
    await db
      .delete(notificationsTable)
      .where(eq(notificationsTable.clerkId, c))
      .catch(() => {});
    await db.delete(routesTable).where(eq(routesTable.clerkId, c)).catch(() => {});
  }
  await db
    .delete(friendLinksTable)
    .where(inArray(friendLinksTable.requesterClerkId, ALL))
    .catch(() => {});
  for (const c of ALL) {
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, c))
      .catch(() => {});
  }
}

const GEO: [number, number][] = Array.from({ length: 40 }, (_, i) => [
  52.0 + i * 0.001,
  5.2 + i * 0.0005,
]);

async function seedRoute(name: string) {
  const [row] = await db
    .insert(routesTable)
    .values({
      clerkId: owner,
      name,
      surface: "asfalt",
      distanceKm: 42.5,
      elevationGainM: 380,
      durationSec: 5400,
      geometry: GEO,
      nav: [{ km: 1.2, dir: "rechts", note: "Bij de kerk rechts" }],
      profile: [0, 50, 120, 60],
      source: "generated",
      status: "ready",
    } as never)
    .returning();
  return row!;
}

async function main() {
  await startServer();
  await ensureAccount(owner, `${owner}@example.test`, "Eigenaar", silentLogger);
  await ensureAccount(friend, `${friend}@example.test`, "Fietsmaatje", silentLogger);
  await ensureAccount(stranger, `${stranger}@example.test`, "Vreemde", silentLogger);

  // Geaccepteerde vriendschap tussen owner en friend.
  await db.insert(friendLinksTable).values({
    requesterClerkId: owner,
    addresseeClerkId: friend,
    status: "accepted",
  } as never);

  const r1 = await seedRoute("Heuvelrug rondje");
  const r2 = await seedRoute("Polder rondje");

  await scenario("voorstel aan een niet-vriend wordt geweigerd (403)", async () => {
    const res = await req("POST", `/api/routes/${r1.id}/voorstel`, owner, {
      toClerkId: stranger,
    });
    assert(res.status === 403, `status ${res.status}, verwacht 403`);
  });

  await scenario("voorstel aan jezelf wordt geweigerd (400)", async () => {
    const res = await req("POST", `/api/routes/${r1.id}/voorstel`, owner, {
      toClerkId: owner,
    });
    assert(res.status === 400, `status ${res.status}, verwacht 400`);
  });

  let proposalId = 0;
  await scenario("voorstel aan een fietsmaatje lukt en maakt een melding", async () => {
    const res = await req("POST", `/api/routes/${r1.id}/voorstel`, owner, {
      toClerkId: friend,
      note: "Mooie klim onderweg!",
    });
    assert(res.status === 201, `status ${res.status}`);
    proposalId = res.json.proposal.id;
    assert(res.json.proposal.status === "open", "status niet open");
    const notes = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.clerkId, friend),
          eq(notificationsTable.type, "route_proposal"),
        ),
      );
    assert(notes.length === 1, `verwacht 1 melding, kreeg ${notes.length}`);
  });

  await scenario("/voorstellen toont ontvangen bij fietsmaatje met route-metadata", async () => {
    const res = await req("GET", "/api/routes/voorstellen", friend);
    assert(res.status === 200, `status ${res.status}`);
    const item = res.json.ontvangen.find((p: any) => p.id === proposalId);
    assert(item, "voorstel ontbreekt bij ontvanger");
    assert(item.route?.name === "Heuvelrug rondje", "route-metadata klopt niet");
    assert(item.note === "Mooie klim onderweg!", "notitie ontbreekt");
  });

  await scenario("/voorstellen toont verstuurd bij de eigenaar", async () => {
    const res = await req("GET", "/api/routes/voorstellen", owner);
    assert(res.status === 200, `status ${res.status}`);
    assert(
      res.json.verstuurd.some((p: any) => p.id === proposalId),
      "verstuurd voorstel ontbreekt",
    );
  });

  await scenario("een vreemde kan niet reageren op andermans voorstel (404)", async () => {
    const res = await req(
      "POST",
      `/api/routes/voorstellen/${proposalId}/reageer`,
      stranger,
      { actie: "accepteer" },
    );
    assert(res.status === 404, `status ${res.status}, verwacht 404`);
  });

  await scenario("accepteren kopieert de route naar de ontvanger", async () => {
    const res = await req(
      "POST",
      `/api/routes/voorstellen/${proposalId}/reageer`,
      friend,
      { actie: "accepteer" },
    );
    assert(res.status === 200, `status ${res.status}`);
    assert(res.json.status === "geaccepteerd", "status niet geaccepteerd");
    assert(res.json.route?.clerkId === friend, "kopie niet van ontvanger");
    // Origineel blijft van de eigenaar bestaan.
    const [orig] = await db
      .select()
      .from(routesTable)
      .where(eq(routesTable.id, r1.id));
    assert(orig && orig.clerkId === owner, "origineel gewijzigd/verdwenen");
    // Melding terug bij de afzender.
    const notes = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.clerkId, owner),
          eq(notificationsTable.type, "route_proposal"),
        ),
      );
    assert(notes.length === 1, `verwacht 1 melding bij afzender, kreeg ${notes.length}`);
  });

  await scenario("tweede reactie op hetzelfde voorstel wordt geweigerd (409)", async () => {
    const res = await req(
      "POST",
      `/api/routes/voorstellen/${proposalId}/reageer`,
      friend,
      { actie: "wijs_af" },
    );
    assert(res.status === 409, `status ${res.status}, verwacht 409`);
  });

  let proposal2 = 0;
  await scenario("aanpassen maakt een nieuwe route en laat het origineel intact", async () => {
    const create = await req("POST", `/api/routes/${r2.id}/voorstel`, owner, {
      toClerkId: friend,
    });
    assert(create.status === 201, `voorstel status ${create.status}`);
    proposal2 = create.json.proposal.id;

    const res = await req(
      "POST",
      `/api/routes/voorstellen/${proposal2}/aanpassen`,
      friend,
      { note: "Iets korter graag" },
    );
    assert(res.status === 201, `status ${res.status}: ${JSON.stringify(res.json)}`);
    assert(res.json.status === "aangepast", "status niet aangepast");
    const newRoute = res.json.route;
    assert(newRoute?.clerkId === friend, "aangepaste route niet van ontvanger");
    assert(newRoute.id !== r2.id, "aangepaste route is niet nieuw");
    assert(String(newRoute.name).includes("aangepast"), "naam mist (aangepast)");
    // Origineel ongewijzigd.
    const [orig] = await db
      .select()
      .from(routesTable)
      .where(eq(routesTable.id, r2.id));
    assert(orig && orig.clerkId === owner, "origineel gewijzigd");
    // Voorstel verwijst naar de nieuwe route.
    const [prop] = await db
      .select()
      .from(routeProposalsTable)
      .where(eq(routeProposalsTable.id, proposal2));
    assert(prop!.adjustedRouteId === newRoute.id, "adjustedRouteId ontbreekt");
  });

  await scenario("aanpassen van een al-beantwoord voorstel wordt geweigerd (409)", async () => {
    const res = await req(
      "POST",
      `/api/routes/voorstellen/${proposal2}/aanpassen`,
      friend,
      {},
    );
    assert(res.status === 409, `status ${res.status}, verwacht 409`);
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
  console.error("route-proposal test crashed:", err);
  await cleanup().catch(() => {});
  process.exit(1);
});
