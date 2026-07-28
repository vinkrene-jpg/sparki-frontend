// Naslagwerk/terugblik contracttest.
//
// Borgt dat het NASLAGWERK-blok in de coachingcontext echt wordt samengesteld
// uit de bestaande tabellen (executielink, routes, races.result,
// journey_reflections) en eerlijk blijft:
//   1. lege atleet ⇒ null (geen leeg/verzonnen blok);
//   2. uitgevoerde geplande training toont verdict + plan-vs-gereden + route;
//   3. gereden wedstrijd toont uitslag + terugblik/les/vervolgactie;
//   4. wedstrijd zonder result ⇒ "uitslag niet vastgelegd" (nooit verzonnen);
//   5. geannuleerde wedstrijden en niet-gekoppelde workouts blijven eruit;
//   6. buildAthleteContext bevat het blok end-to-end.
//
// Run: `pnpm --filter @workspace/api-server run test:terugblik`

import {
  db,
  pool,
  userProfilesTable,
  plannedWorkoutsTable,
  trainingSessionsTable,
  racesTable,
  routesTable,
  journeyReflectionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { terugblikBlock } from "../lib/terugblik";
import { buildAthleteContext } from "../lib/athlete-context";

const CLERK_ID = `test_terugblik_${Date.now()}`;

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
function isoInDays(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().split("T")[0]!;
}

async function cleanup() {
  await db
    .delete(journeyReflectionsTable)
    .where(eq(journeyReflectionsTable.clerkId, CLERK_ID));
  await db.delete(racesTable).where(eq(racesTable.clerkId, CLERK_ID));
  await db
    .delete(plannedWorkoutsTable)
    .where(eq(plannedWorkoutsTable.clerkId, CLERK_ID));
  await db
    .delete(trainingSessionsTable)
    .where(eq(trainingSessionsTable.clerkId, CLERK_ID));
  await db.delete(routesTable).where(eq(routesTable.clerkId, CLERK_ID));
  await db
    .delete(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, CLERK_ID));
}

async function main() {
  await cleanup();
  await db.insert(userProfilesTable).values({
    clerkId: CLERK_ID,
    email: `${CLERK_ID}@test.local`,
    displayName: "Terugblik Tester",
  });

  await scenario("lege atleet geeft null (geen leeg blok)", async () => {
    const block = await terugblikBlock(CLERK_ID);
    assert(block === null, `verwachtte null, kreeg: ${JSON.stringify(block)}`);
  });

  // Seed: route + sessie + uitgevoerde geplande training (executielink).
  const [route] = await db
    .insert(routesTable)
    .values({
      clerkId: CLERK_ID,
      name: "Testlus Veluwe",
      distanceKm: 62,
      source: "generated",
    })
    .returning();
  const [session] = await db
    .insert(trainingSessionsTable)
    .values({
      clerkId: CLERK_ID,
      sessionDate: isoInDays(-3),
      type: "ride",
      title: "Duurrit gereden",
      durationMin: 115,
      tss: 78,
      feelScore: 4,
    })
    .returning();
  await db.insert(plannedWorkoutsTable).values({
    clerkId: CLERK_ID,
    scheduledDate: isoInDays(-3),
    type: "ride",
    title: "Duurrit",
    targetDurationMin: 120,
    targetTSS: 80,
    status: "completed",
    sessionId: session!.id,
    routeId: route!.id,
  });
  // Niet-gekoppelde geplande training: mag NIET in het naslagwerk komen.
  await db.insert(plannedWorkoutsTable).values({
    clerkId: CLERK_ID,
    scheduledDate: isoInDays(-2),
    type: "ride",
    title: "Overgeslagen training",
    status: "missed",
  });

  // Seed: gereden wedstrijd + reflectie, en een geannuleerde wedstrijd.
  const [race] = await db
    .insert(racesTable)
    .values({
      clerkId: CLERK_ID,
      name: "Ronde van Test",
      raceDate: isoInDays(-10),
      priority: "B",
      result: { status: "finished", position: 14, fieldSize: 80 },
    })
    .returning();
  await db.insert(journeyReflectionsTable).values({
    clerkId: CLERK_ID,
    raceId: race!.id,
    reflection: "Te hard gestart in de eerste ronde.",
    lesson: "Eerste 20 minuten onder drempel blijven.",
    nextAction: "Startprotocol oefenen in training.",
  });
  await db.insert(racesTable).values({
    clerkId: CLERK_ID,
    name: "Geannuleerde Koers",
    raceDate: isoInDays(-5),
    priority: "C",
    status: "geannuleerd",
  });
  const [raceNoResult] = await db
    .insert(racesTable)
    .values({
      clerkId: CLERK_ID,
      name: "Koers Zonder Uitslag",
      raceDate: isoInDays(-20),
      priority: "C",
    })
    .returning();
  assert(raceNoResult, "seed raceNoResult");

  const block = (await terugblikBlock(CLERK_ID)) ?? "";

  await scenario("uitgevoerde training: verdict + plan-vs-gereden + route", async () => {
    assert(block.includes("NASLAGWERK"), "kop ontbreekt");
    assert(block.includes(`"Duurrit"`), "workouttitel ontbreekt");
    assert(block.includes("volgens plan uitgevoerd"), "verdict-NL ontbreekt");
    assert(block.includes("plan=120min"), "plan-duur ontbreekt");
    assert(block.includes("gereden=115min"), "gereden-duur ontbreekt");
    assert(block.includes("plan-TSS=80"), "plan-TSS ontbreekt");
    assert(block.includes("gereden-TSS=78"), "gereden-TSS ontbreekt");
    assert(block.includes(`route="Testlus Veluwe" (62km)`), "route ontbreekt");
  });

  await scenario("wedstrijd: uitslag + terugblik/les/vervolgactie", async () => {
    assert(block.includes(`"Ronde van Test"`), "wedstrijdnaam ontbreekt");
    assert(block.includes("uitgereden"), "uitslagstatus ontbreekt");
    assert(block.includes("positie 14/80"), "positie ontbreekt");
    assert(block.includes("Te hard gestart"), "terugblik ontbreekt");
    assert(block.includes("onder drempel blijven"), "les ontbreekt");
    assert(block.includes("Startprotocol oefenen"), "vervolgactie ontbreekt");
  });

  await scenario("wedstrijd zonder result blijft eerlijk", async () => {
    assert(
      block.includes(`"Koers Zonder Uitslag", uitslag niet vastgelegd`),
      "eerlijke geen-uitslag-regel ontbreekt",
    );
  });

  await scenario("geannuleerd/niet-gekoppeld blijft eruit", async () => {
    assert(!block.includes("Geannuleerde Koers"), "geannuleerde race lekt");
    assert(!block.includes("Overgeslagen training"), "missed workout lekt");
  });

  await scenario("buildAthleteContext bevat het naslagwerk end-to-end", async () => {
    const ctx = await buildAthleteContext(CLERK_ID, "terugblik_test");
    assert(ctx.includes("NASLAGWERK"), "context mist NASLAGWERK-blok");
    assert(ctx.includes("Ronde van Test"), "context mist wedstrijdregel");
    assert(ctx.includes("NASLAG-INSTRUCTIE"), "context mist instructieregel");
  });

  await cleanup();

  let failed = 0;
  for (const r of results) {
    console.log(
      `${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`,
    );
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("terugblik-test crash:", err);
  try {
    await cleanup();
  } catch {}
  await pool.end();
  process.exit(1);
});
