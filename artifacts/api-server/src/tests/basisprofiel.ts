// WEDSTRIJDDOEL_BASIS Laag 0 — test voor het basisprofiel wielrennen.
//
// Dekt: volledig profiel met scheefgroei-bewaking, meetniveau-poort
// (hartslag → vereenvoudigd, geen niveau + geen data → niet_beschikbaar),
// eerlijke nulls zonder data, en de sportfilter (alleen cycling telt).
//
// Run: `pnpm --filter @workspace/api-server run test:basisprofiel`

import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  ftpHistoryTable,
  trainingSessionsTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import {
  computeBasisprofiel,
  BASISPROFIEL_VENSTER_DAGEN,
} from "../lib/basisprofiel";

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

const RUN = `test_basisprof_${Date.now()}`;
const ids: string[] = [];
function newAthlete(tag: string): string {
  const id = `${RUN}_${tag}`;
  ids.push(id);
  return id;
}

async function seedUser(
  clerkId: string,
  profiel: Partial<typeof athleteProfilesTable.$inferInsert> = {},
) {
  await db.insert(userProfilesTable).values({
    clerkId,
    email: `${clerkId}@example.test`,
  });
  await db.insert(athleteProfilesTable).values({ clerkId, ...profiel });
}

function dagenGeleden(n: number): Date {
  return new Date(Date.now() - n * 86400000);
}
function dagStr(n: number): string {
  return dagenGeleden(n).toISOString().slice(0, 10);
}

async function seedSessie(
  clerkId: string,
  dagen: number,
  powerBests: Record<string, number> | null,
  sport = "cycling",
) {
  await db.insert(trainingSessionsTable).values({
    clerkId,
    sessionDate: dagStr(dagen),
    sport,
    powerBests,
  });
}

async function main() {
  await scenario("volledig profiel met scheefgroei-bewaking", async () => {
    const id = newAthlete("vol");
    await seedUser(id, { ftp: 250, ftpEstimated: false, measurementLevel: "pro" });
    // FTP vóór het venster: 230 → drempel gestegen.
    await db.insert(ftpHistoryTable).values({
      clerkId: id,
      measuredAt: dagStr(BASISPROFIEL_VENSTER_DAGEN + 30),
      ftpWatts: 230,
    });
    // Recent venster: 5min/1min omhoog, sprint omlaag t.o.v. vorig venster.
    await seedSessie(id, 10, { "5": 900, "60": 420, "300": 285 });
    await seedSessie(id, BASISPROFIEL_VENSTER_DAGEN + 20, {
      "5": 1000,
      "60": 380,
      "300": 260,
    });

    const p = await computeBasisprofiel(id);
    assert(p, "profiel ontbreekt");
    assert(p!.status === "volledig", `status ${p!.status} ≠ volledig`);
    assert(p!.waarden.length === 4, "verwacht 4 waarden");
    const bySleutel = Object.fromEntries(p!.waarden.map((w) => [w.sleutel, w]));
    assert(bySleutel.drempelvermogen.watts === 250, "FTP-waarde klopt niet");
    assert(
      bySleutel.drempelvermogen.richting === "gestegen",
      `drempel: ${bySleutel.drempelvermogen.richting}`,
    );
    assert(bySleutel.piekvermogen.watts === 900, "piek-waarde klopt niet");
    assert(
      bySleutel.piekvermogen.richting === "gezakt",
      `piek: ${bySleutel.piekvermogen.richting}`,
    );
    assert(
      bySleutel.aeroob_maximum.richting === "gestegen",
      `5min: ${bySleutel.aeroob_maximum.richting}`,
    );
    assert(p!.bewaking.scheefgroei === true, "scheefgroei niet benoemd");
    assert(
      typeof p!.bewaking.toelichting === "string" &&
        p!.bewaking.toelichting.includes("Piekvermogen"),
      "toelichting benoemt de zakkende waarde niet",
    );
  });

  await scenario("meetniveau hartslag → vereenvoudigd, geen watts", async () => {
    const id = newAthlete("hr");
    await seedUser(id, { measurementLevel: "hartslag" });
    // Zelfs mét een oude power-rij blijft de poort dicht: keuze van de renner.
    await seedSessie(id, 5, { "5": 800, "60": 350, "300": 250 });
    const p = await computeBasisprofiel(id);
    assert(p!.status === "vereenvoudigd", `status ${p!.status}`);
    assert(p!.waarden.length === 0, "vereenvoudigd mag geen wattwaarden dragen");
  });

  await scenario("geen niveau + geen vermogensdata → niet_beschikbaar", async () => {
    const id = newAthlete("leeg");
    await seedUser(id, {});
    const p = await computeBasisprofiel(id);
    assert(p!.status === "niet_beschikbaar", `status ${p!.status}`);
  });

  await scenario("geen niveau + wél vermogensdata → volledig (data als bewijs)", async () => {
    const id = newAthlete("data");
    await seedUser(id, {});
    await seedSessie(id, 7, { "5": 700, "60": 300, "300": 220 });
    const p = await computeBasisprofiel(id);
    assert(p!.status === "volledig", `status ${p!.status}`);
    const piek = p!.waarden.find((w) => w.sleutel === "piekvermogen")!;
    assert(piek.watts === 700, "piek klopt niet");
    assert(piek.richting === "onbekend", "zonder vorig venster is de trend onbekend");
  });

  await scenario("pro zonder data → eerlijke nulls, nooit 0", async () => {
    const id = newAthlete("nul");
    await seedUser(id, { measurementLevel: "pro" });
    const p = await computeBasisprofiel(id);
    assert(p!.status === "volledig", `status ${p!.status}`);
    for (const w of p!.waarden) {
      assert(w.watts === null, `${w.sleutel} moet null zijn, kreeg ${w.watts}`);
      assert(w.richting === "onbekend", `${w.sleutel} trend moet onbekend zijn`);
    }
  });

  await scenario("alleen cycling telt mee", async () => {
    const id = newAthlete("sport");
    await seedUser(id, { measurementLevel: "pro" });
    await seedSessie(id, 3, { "5": 999, "60": 500, "300": 400 }, "running");
    await seedSessie(id, 4, { "5": 600, "60": 280, "300": 200 }, "cycling");
    const p = await computeBasisprofiel(id);
    const piek = p!.waarden.find((w) => w.sleutel === "piekvermogen")!;
    assert(piek.watts === 600, `running-best lekte mee: ${piek.watts}`);
  });

  // Opruimen (FK-cascade ruimt kindrijen op).
  if (ids.length) {
    await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ids));
  }

  let failed = 0;
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`${results.length - failed}/${results.length} scenario's geslaagd`);
  await pool.end();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
