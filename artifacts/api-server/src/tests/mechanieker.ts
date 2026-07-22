// Mechanieker & materiaalkring — route- en engine-test (afbouwgolf 7).
//
// Dekt de eerlijkheidscontracten van de mechanieker:
//   - km/uren worden LIVE afgeleid uit gekoppelde activiteiten (nooit teller);
//   - auto-koppeling gokt nooit (alleen bij precies één actieve fiets of
//     Strava-gear) en overschrijft nooit een handmatige keuze;
//   - onderhoudsniveaus strikt gescheiden: controleadvies / vermoedelijke
//     slijtage / vastgesteld defect (dat laatste ALLEEN uit eigen registratie);
//   - logboek-events hebben expliciete gevolgen (vervanging reset montagedatum);
//   - materiaalkeuze per wedstrijd/training met eigendomscontrole;
//   - cross-account isolatie op de nieuwe schrijfroutes.
//
// Seeds real rows for two dedicated test users, boots the REAL Express app,
// calls the routes with dev-auth headers, and cleans up afterwards.
//
// Run: `pnpm --filter @workspace/api-server run test:mechanieker`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  pool,
  trainingSessionsTable,
  garageBikesTable,
  garageComponentsTable,
  componentEventsTable,
  equipmentChoicesTable,
  racesTable,
  userProfilesTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

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

const RUN = `test_mech_${Date.now()}`;
const userA = `${RUN}_a`;
const userB = `${RUN}_b`;

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

type Json = Record<string, unknown>;

async function call(
  user: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: Json }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "x-dev-clerk-id": user,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: Json = {};
  try {
    parsed = text ? (JSON.parse(text) as Json) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
}

async function seedSession(
  user: string,
  date: string,
  km: number,
  minutes: number,
  extra?: Partial<typeof trainingSessionsTable.$inferInsert>,
): Promise<number> {
  const [row] = await db
    .insert(trainingSessionsTable)
    .values({
      clerkId: user,
      sessionDate: date,
      type: "ride",
      title: `Testrit ${date}`,
      durationMin: minutes,
      distanceKm: km.toFixed(2),
      sport: "cycling",
      source: "manual",
      ...extra,
    })
    .returning({ id: trainingSessionsTable.id });
  return row!.id;
}

async function cleanup() {
  for (const user of [userA, userB]) {
    await db.delete(equipmentChoicesTable).where(eq(equipmentChoicesTable.clerkId, user));
    await db.delete(componentEventsTable).where(eq(componentEventsTable.clerkId, user));
    await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, user));
    await db.delete(garageComponentsTable).where(eq(garageComponentsTable.clerkId, user));
    await db.delete(garageBikesTable).where(eq(garageBikesTable.clerkId, user));
    await db.delete(racesTable).where(eq(racesTable.clerkId, user));
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, user));
  }
}

async function main() {
  await ensureAccount(userA, `${userA}@example.test`, "Mechanieker A", silentLogger);
  await ensureAccount(userB, `${userB}@example.test`, "Mechanieker B", silentLogger);
  await startServer();

  let bikeId = 0;
  let bikeBId = 0;

  await scenario("fiets aanmaken met bouwjaar en doel", async () => {
    const { status, body } = await call(userA, "POST", "/api/garage/bikes", {
      name: "Racer",
      bikeType: "race",
      buildYear: 2023,
      purpose: "wedstrijd",
    });
    assert(status === 200, `verwacht 200, kreeg ${status}: ${JSON.stringify(body)}`);
    const bike = body.bike as Json;
    assert(bike && Number.isInteger(bike.id), "bike.id verwacht");
    assert(bike.buildYear === 2023, `buildYear moet 2023 zijn, kreeg ${bike.buildYear}`);
    assert(bike.purpose === "wedstrijd", `purpose moet wedstrijd zijn`);
    bikeId = Number(bike.id);
  });

  await scenario("auto-koppeling: één actieve fiets krijgt losse fietsritten", async () => {
    await seedSession(userA, "2026-07-01", 60, 120);
    await seedSession(userA, "2026-07-02", 40, 80);
    const { status, body } = await call(userA, "GET", "/api/garage/usage");
    assert(status === 200, `verwacht 200, kreeg ${status}`);
    const usage = (body.usage as Json)[String(bikeId)] as Json;
    assert(usage, "usage voor de fiets verwacht");
    assert(Number(usage.km) === 100, `km moet 100 zijn, kreeg ${usage.km}`);
    assert(Number(usage.rides) === 2, `rides moet 2 zijn, kreeg ${usage.rides}`);
    assert(Math.abs(Number(usage.hours) - 3.3) < 0.05, `hours ~3.3 verwacht, kreeg ${usage.hours}`);
  });

  await scenario("gebruik is afgeleid, geen teller: sessie weg = km weg", async () => {
    const tempId = await seedSession(userA, "2026-07-03", 25, 50);
    let r = await call(userA, "GET", "/api/garage/usage");
    let usage = ((r.body.usage as Json)[String(bikeId)] ?? {}) as Json;
    assert(Number(usage.km) === 125, `km moet 125 zijn na extra rit, kreeg ${usage.km}`);
    await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.id, tempId));
    r = await call(userA, "GET", "/api/garage/usage");
    usage = ((r.body.usage as Json)[String(bikeId)] ?? {}) as Json;
    assert(Number(usage.km) === 100, `km moet terug naar 100, kreeg ${usage.km}`);
  });

  await scenario("handmatige ontkoppeling (geen fiets) wordt nooit auto-overschreven", async () => {
    const sid = await seedSession(userA, "2026-07-04", 30, 60);
    const put = await call(userA, "PUT", `/api/garage/sessions/${sid}/bike`, { bikeId: null });
    assert(put.status === 200, `verwacht 200, kreeg ${put.status}`);
    // Usage-call draait auto-link opnieuw — de handmatige keuze moet standhouden.
    await call(userA, "GET", "/api/garage/usage");
    const [row] = await db
      .select({ bikeId: trainingSessionsTable.bikeId, src: trainingSessionsTable.bikeLinkSource })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.id, sid));
    assert(row!.bikeId === null, "bikeId moet null blijven");
    assert(row!.src === "handmatig", `bron moet handmatig blijven, kreeg ${row!.src}`);
  });

  await scenario("twee actieve fietsen: nieuwe rit blijft eerlijk ongekoppeld", async () => {
    const second = await call(userA, "POST", "/api/garage/bikes", {
      name: "Trainingsfiets",
      bikeType: "race",
    });
    const secondId = Number((second.body.bike as Json).id);
    const sid = await seedSession(userA, "2026-07-05", 20, 40);
    await call(userA, "GET", "/api/garage/usage");
    const [row] = await db
      .select({ bikeId: trainingSessionsTable.bikeId })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.id, sid));
    assert(row!.bikeId === null, "bij twee actieve fietsen wordt niet gegokt");
    // Handmatig corrigeren werkt wel:
    const put = await call(userA, "PUT", `/api/garage/sessions/${sid}/bike`, { bikeId: secondId });
    assert(put.status === 200, "handmatige koppeling moet lukken");
    // Ruim de tweede fiets + rit weer op zodat latere scenario's één actieve fiets zien.
    await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.id, sid));
    const del = await call(userA, "DELETE", `/api/garage/bikes/${secondId}`);
    assert(del.status === 200, "tweede fiets verwijderen moet lukken");
  });

  await scenario("cross-account: andermans fiets aan je rit koppelen faalt", async () => {
    const bBike = await call(userB, "POST", "/api/garage/bikes", { name: "B-fiets", bikeType: "race" });
    bikeBId = Number((bBike.body.bike as Json).id);
    const sid = await seedSession(userA, "2026-07-06", 10, 20, { bikeLinkSource: "handmatig" });
    const put = await call(userA, "PUT", `/api/garage/sessions/${sid}/bike`, { bikeId: bikeBId });
    assert(put.status === 404, `verwacht 404, kreeg ${put.status}`);
    const [row] = await db
      .select({ bikeId: trainingSessionsTable.bikeId })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.id, sid));
    assert(row!.bikeId === null, "rit mag niet aan andermans fiets hangen");
  });

  let chainId = 0;
  await scenario("componentgebruik telt vanaf montagedatum (basis eerlijk benoemd)", async () => {
    const comp = await call(userA, "POST", "/api/garage/components", {
      bikeId,
      category: "ketting",
      brand: "Shimano",
      model: "CN-M8100",
      installedAt: "2026-07-02",
    });
    assert(comp.status === 200, `verwacht 200, kreeg ${comp.status}`);
    chainId = Number((comp.body.component as Json).id);
    const u = await call(userA, "GET", `/api/garage/components/${chainId}/usage`);
    assert(u.status === 200, `verwacht 200, kreeg ${u.status}`);
    const usage = u.body.usage as Json;
    assert(usage.basis === "montagedatum", `basis moet montagedatum zijn, kreeg ${usage.basis}`);
    // Alleen de rit van 2026-07-02 (40 km) telt; die van 2026-07-01 niet.
    assert(Number(usage.km) === 40, `km sinds montage moet 40 zijn, kreeg ${usage.km}`);
  });

  await scenario("nul gebruiksdata = nul slijtagesignalen (eerlijk stil)", async () => {
    // Ketting heeft pas 40 km — ver onder iedere drempel.
    const r = await call(userA, "GET", "/api/garage/signals?context=garage");
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    const signals = r.body.signals as Json[];
    assert(
      !signals.some((s) => s.componentId === chainId),
      "geen signaal voor een verse ketting",
    );
  });

  await scenario("controleadvies bij 2500+ km, vermoedelijke slijtage bij 4000+", async () => {
    await seedSession(userA, "2026-07-10", 3000, 6000);
    let r = await call(userA, "GET", "/api/garage/signals?context=garage");
    let sig = (r.body.signals as Json[]).find((s) => s.componentId === chainId);
    assert(sig, "controleadvies verwacht bij ~3040 km");
    assert(sig!.level === "controleadvies", `verwacht controleadvies, kreeg ${sig!.level}`);
    assert(String(sig!.message).includes("km"), "uitleg met echte kilometers verwacht");
    await seedSession(userA, "2026-07-11", 1500, 3000);
    r = await call(userA, "GET", "/api/garage/signals?context=garage");
    sig = (r.body.signals as Json[]).find((s) => s.componentId === chainId);
    assert(sig && sig.level === "vermoedelijke_slijtage", `verwacht vermoedelijke_slijtage, kreeg ${sig?.level}`);
    assert(
      String(sig!.advice).toLowerCase().includes("controle") ||
        String(sig!.advice).toLowerCase().includes("meet"),
      "voorzichtig advies (meten/controle) verwacht, nooit een diagnose",
    );
  });

  await scenario("vandaag-context filtert controleadviezen, houdt slijtage/defect", async () => {
    const r = await call(userA, "GET", "/api/garage/signals?context=vandaag");
    const signals = r.body.signals as Json[];
    assert(
      signals.every((s) => s.level !== "controleadvies"),
      "vandaag toont geen controleadviezen",
    );
    assert(
      signals.some((s) => s.componentId === chainId && s.level === "vermoedelijke_slijtage"),
      "vermoedelijke slijtage blijft zichtbaar op vandaag",
    );
  });

  await scenario("vastgesteld defect kan ALLEEN uit eigen registratie (event)", async () => {
    const ev = await call(userA, "POST", `/api/garage/components/${chainId}/events`, {
      eventType: "defect_vastgesteld",
      eventDate: "2026-07-12",
      note: "Ketting slaat over onder belasting",
    });
    assert(ev.status === 200, `verwacht 200, kreeg ${ev.status}`);
    assert((ev.body.component as Json).status === "defect_vastgesteld", "componentstatus moet defect_vastgesteld worden");
    const r = await call(userA, "GET", "/api/garage/signals?context=vandaag");
    const sig = (r.body.signals as Json[]).find(
      (s) => s.componentId === chainId && s.level === "vastgesteld_defect",
    );
    assert(sig, "defect-signaal verwacht");
    assert(
      String(sig!.advice).toLowerCase().includes("veiligheid"),
      "voorzichtig veiligheidsadvies verwacht",
    );
  });

  await scenario("event 'vervanging': montagedatum schuift mee en km-historie start opnieuw", async () => {
    const ev = await call(userA, "POST", `/api/garage/components/${chainId}/events`, {
      eventType: "vervanging",
      eventDate: "2026-07-15",
    });
    assert(ev.status === 200, `verwacht 200, kreeg ${ev.status}`);
    const comp = ev.body.component as Json;
    assert(comp.installedAt === "2026-07-15", `installedAt moet 2026-07-15 zijn, kreeg ${comp.installedAt}`);
    assert(comp.status === "in_gebruik", `status moet weer in_gebruik zijn, kreeg ${comp.status}`);
    // kmAtEvent is de eerlijke, afgeleide stand op dat moment (sinds oude montage).
    const event = ev.body.event as Json;
    assert(event.kmAtEvent != null && Number(event.kmAtEvent) >= 4500, `kmAtEvent moet de afgeleide stand dragen, kreeg ${event.kmAtEvent}`);
    const u = await call(userA, "GET", `/api/garage/components/${chainId}/usage`);
    assert(Number((u.body.usage as Json).km) === 0, "km sinds nieuwe montage moet 0 zijn");
  });

  await scenario("logboek: ongeldig type en ongeldige datum worden geweigerd", async () => {
    const bad1 = await call(userA, "POST", `/api/garage/components/${chainId}/events`, {
      eventType: "smeren",
      eventDate: "2026-07-15",
    });
    assert(bad1.status === 400, `verwacht 400 voor onbekend type, kreeg ${bad1.status}`);
    const bad2 = await call(userA, "POST", `/api/garage/components/${chainId}/events`, {
      eventType: "onderhoud",
      eventDate: "15-07-2026",
    });
    assert(bad2.status === 400, `verwacht 400 voor ongeldige datum, kreeg ${bad2.status}`);
  });

  await scenario("logboek is per gebruiker afgeschermd (cross-account leeg)", async () => {
    const r = await call(userB, "GET", `/api/garage/components/${chainId}/events`);
    // userB bezit dit component niet: lijst is leeg (clerk-filter), geen lek.
    assert(r.status === 200 || r.status === 404, `verwacht 200/404, kreeg ${r.status}`);
    if (r.status === 200) {
      assert((r.body.events as Json[]).length === 0, "andermans logboek moet leeg zijn");
    }
    const write = await call(userB, "POST", `/api/garage/components/${chainId}/events`, {
      eventType: "onderhoud",
      eventDate: "2026-07-15",
    });
    assert(write.status === 404, `schrijven op andermans component moet 404 geven, kreeg ${write.status}`);
  });

  let raceId = 0;
  await scenario("materiaalkeuze per wedstrijd: upsert + terug te lezen", async () => {
    const [race] = await db
      .insert(racesTable)
      .values({ clerkId: userA, name: "Testkoers", raceDate: "2026-08-01" })
      .returning({ id: racesTable.id });
    raceId = race!.id;
    const put1 = await call(userA, "PUT", "/api/garage/choices", {
      raceId,
      bikeId,
      wheels: "Hoge velgen",
      tires: "GP5000 28mm",
      pressureBar: 4.8,
    });
    assert(put1.status === 200, `verwacht 200, kreeg ${put1.status}: ${JSON.stringify(put1.body)}`);
    const put2 = await call(userA, "PUT", "/api/garage/choices", {
      raceId,
      bikeId,
      wheels: "Lage velgen",
      tires: "GP5000 28mm",
      pressureBar: 5.0,
    });
    assert(put2.status === 200, "tweede PUT (upsert) moet lukken");
    const get = await call(userA, "GET", `/api/garage/choices?raceId=${raceId}`);
    const choice = get.body.choice as Json;
    assert(choice && choice.wheels === "Lage velgen", "upsert moet de bestaande keuze bijwerken");
    const [count] = await db
      .select({ id: equipmentChoicesTable.id })
      .from(equipmentChoicesTable)
      .where(and(eq(equipmentChoicesTable.clerkId, userA), eq(equipmentChoicesTable.raceId, raceId)));
    assert(count, "precies één keuze-rij per wedstrijd");
  });

  await scenario("materiaalkeuze: validatie (doel verplicht, spanning begrensd, eigendom)", async () => {
    const both = await call(userA, "PUT", "/api/garage/choices", { raceId, workoutId: 1, bikeId });
    assert(both.status === 400, `raceId én workoutId moet 400 geven, kreeg ${both.status}`);
    const neither = await call(userA, "PUT", "/api/garage/choices", { bikeId });
    assert(neither.status === 400, "geen doel moet 400 geven");
    const badPressure = await call(userA, "PUT", "/api/garage/choices", { raceId, pressureBar: 15 });
    assert(badPressure.status === 400, "15 bar moet 400 geven");
    const foreignBike = await call(userA, "PUT", "/api/garage/choices", { raceId, bikeId: bikeBId });
    assert(foreignBike.status === 404, `andermans fiets moet 404 geven, kreeg ${foreignBike.status}`);
    const foreignRace = await call(userB, "PUT", "/api/garage/choices", { raceId, bikeId: bikeBId });
    assert(foreignRace.status === 404, "andermans wedstrijd moet 404 geven");
  });

  await scenario("fiets verwijderen ontkoppelt ritten maar bewaart de activiteiten", async () => {
    const before = await db
      .select({ id: trainingSessionsTable.id })
      .from(trainingSessionsTable)
      .where(and(eq(trainingSessionsTable.clerkId, userA), eq(trainingSessionsTable.bikeId, bikeId)));
    assert(before.length > 0, "er moeten gekoppelde ritten zijn");
    const del = await call(userA, "DELETE", `/api/garage/bikes/${bikeId}`);
    assert(del.status === 200, `verwacht 200, kreeg ${del.status}`);
    const orphaned = await db
      .select({ id: trainingSessionsTable.id, bikeId: trainingSessionsTable.bikeId })
      .from(trainingSessionsTable)
      .where(inArray(trainingSessionsTable.id, before.map((s) => s.id)));
    assert(orphaned.length === before.length, "activiteiten mogen nooit verdwijnen");
    assert(orphaned.every((s) => s.bikeId === null), "alle ritten moeten ontkoppeld zijn");
  });

  await stopServer();
  await cleanup();
  await pool.end();

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✓" : "✗"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
  if (failed.length > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await stopServer();
    await cleanup();
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
