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
const OTHER_CLERK_ID = `${CLERK_ID}_other`;

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
  for (const clerkId of [CLERK_ID, OTHER_CLERK_ID]) {
    await db
      .delete(journeyReflectionsTable)
      .where(eq(journeyReflectionsTable.clerkId, clerkId));
    await db.delete(racesTable).where(eq(racesTable.clerkId, clerkId));
    await db
      .delete(plannedWorkoutsTable)
      .where(eq(plannedWorkoutsTable.clerkId, clerkId));
    await db
      .delete(trainingSessionsTable)
      .where(eq(trainingSessionsTable.clerkId, clerkId));
    await db.delete(routesTable).where(eq(routesTable.clerkId, clerkId));
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));
  }
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

  // Seed: TWEEDE sporter (B) met eigen route/sessie/reflectie. A's rijen wijzen
  // via soft-reference-ID's naar B's data; her-filtering op clerkId moet
  // voorkomen dat B's namen/teksten ooit in A's naslagwerk lekken.
  await db.insert(userProfilesTable).values({
    clerkId: OTHER_CLERK_ID,
    email: `${OTHER_CLERK_ID}@test.local`,
    displayName: "Andere Sporter",
  });
  const [otherRoute] = await db
    .insert(routesTable)
    .values({
      clerkId: OTHER_CLERK_ID,
      name: "Geheime Lus van B",
      distanceKm: 99,
      source: "generated",
    })
    .returning();
  const [otherSession] = await db
    .insert(trainingSessionsTable)
    .values({
      clerkId: OTHER_CLERK_ID,
      sessionDate: isoInDays(-4),
      type: "ride",
      title: "Prive-rit van B",
      durationMin: 240,
      tss: 999,
      feelScore: 1,
    })
    .returning();
  // A's uitgevoerde training wijst naar B's sessie én B's route.
  await db.insert(plannedWorkoutsTable).values({
    clerkId: CLERK_ID,
    scheduledDate: isoInDays(-4),
    type: "ride",
    title: "Training met vreemde refs",
    targetDurationMin: 60,
    status: "completed",
    sessionId: otherSession!.id,
    routeId: otherRoute!.id,
  });
  // B's reflectie wijst naar A's wedstrijd-ID (soft ref op raceId).
  await db.insert(journeyReflectionsTable).values({
    clerkId: OTHER_CLERK_ID,
    raceId: raceNoResult!.id,
    reflection: "B geheime terugblik",
    lesson: "B geheime les",
    nextAction: "B geheime vervolgactie",
  });

  const block = (await terugblikBlock(CLERK_ID)) ?? "";

  await scenario("naslagwerk van andere sporter lekt nooit via soft refs", async () => {
    assert(
      block.includes(`"Training met vreemde refs"`),
      "A's eigen workoutregel ontbreekt",
    );
    assert(!block.includes("Geheime Lus van B"), "B's routenaam lekt");
    assert(!block.includes("gereden=240min"), "B's sessieduur lekt");
    assert(!block.includes("gereden-TSS=999"), "B's sessie-TSS lekt");
    assert(!block.includes("gevoel=1/5"), "B's gevoelsscore lekt");
    assert(!block.includes("B geheime terugblik"), "B's reflectie lekt");
    assert(!block.includes("B geheime les"), "B's les lekt");
    assert(!block.includes("B geheime vervolgactie"), "B's vervolgactie lekt");
  });

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

  await scenario("caps: max 8 trainingen en 5 wedstrijden in het blok", async () => {
    // Extra bulk-seeds bovenop de bestaande rijen zodat de caps geraakt worden.
    for (let i = 1; i <= 10; i++) {
      const [s] = await db
        .insert(trainingSessionsTable)
        .values({
          clerkId: CLERK_ID,
          sessionDate: isoInDays(-(5 + i)),
          type: "ride",
          title: `Bulk sessie ${i}`,
          durationMin: 60,
        })
        .returning();
      await db.insert(plannedWorkoutsTable).values({
        clerkId: CLERK_ID,
        scheduledDate: isoInDays(-(5 + i)),
        type: "ride",
        title: `Bulk training ${i}`,
        status: "completed",
        sessionId: s!.id,
      });
    }
    for (let i = 1; i <= 7; i++) {
      await db.insert(racesTable).values({
        clerkId: CLERK_ID,
        name: `Bulk koers ${i}`,
        raceDate: isoInDays(-(25 + i)),
        priority: "C",
      });
    }
    const capped = (await terugblikBlock(CLERK_ID)) ?? "";
    const lines = capped.split("\n");
    const trainStart = lines.findIndex((l) =>
      l.startsWith("UITGEVOERDE GEPLANDE TRAININGEN"),
    );
    const raceStart = lines.findIndex((l) =>
      l.startsWith("GEREDEN WEDSTRIJDEN"),
    );
    assert(trainStart >= 0 && raceStart > trainStart, "sectiekoppen ontbreken");
    const trainLines = lines
      .slice(trainStart + 1, raceStart)
      .filter((l) => l.startsWith("  - "));
    const raceLines = lines
      .slice(raceStart + 1)
      .filter((l) => l.startsWith("  - "));
    assert(
      trainLines.length === 8,
      `verwachtte exact 8 trainingsregels, kreeg ${trainLines.length}`,
    );
    assert(
      raceLines.length === 5,
      `verwachtte exact 5 wedstrijdregels, kreeg ${raceLines.length}`,
    );
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
