// Today Orchestrator (WP-T1) — deterministische selectietest.
//
// Bewijst tegen de ECHTE engine + database dat:
//  1. gezondheid altijd wint (urgent lead, blijft staan bij herhaalde calls);
//  2. een geplande training de lead is zolang die niet is afgerond;
//  3. zonder plan een concreet handelingsperspectief verschijnt (opdracht §7),
//     met wedstrijd-aftelling wanneer die er echt is;
//  4. jeugd (<18) een eigen variant + eenvoudiger copy krijgt;
//  5. beginner (te weinig data) eerlijk zonder verzonnen inzicht blijft;
//  6. de weergavehistorie per Amsterdamse dag telt (2e call zelfde dag ⇒
//     daysShown blijft 1) en interacties vastlegt;
//  7. een rotating-item dat 3 dagen zonder klik getoond is, gepauzeerd wordt.
//
// Run: pnpm --filter @workspace/api-server run test:today-orchestrator

import {
  db,
  pool,
  athleteProfilesTable,
  plannedWorkoutsTable,
  racesTable,
  trainingSessionsTable,
  todayDisplayHistoryTable,
  userProfilesTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  orchestrateToday,
  recordTodayInteraction,
  amsterdamToday,
} from "../engines/today";

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

const IDS = {
  jeugd: "test_today_jeugd",
  wedstrijd: "test_today_wedstrijd",
  ziek: "test_today_ziek",
  training: "test_today_training",
  beginner: "test_today_beginner",
} as const;

async function cleanup() {
  for (const c of Object.values(IDS)) {
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, c));
  }
}

function ymdOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
}

async function seed() {
  await cleanup();
  for (const c of Object.values(IDS)) {
    await ensureAccount(c, `${c}@example.test`, `Test ${c}`, silentLogger);
  }
  const today = amsterdamToday();
  const year = Number(today.slice(0, 4));

  // Jeugd 15 jaar, geen plan, geen wedstrijd.
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: `${year - 15}-01-15`, experienceLevel: "intermediate" })
    .where(eq(athleteProfilesTable.clerkId, IDS.jeugd));
  // Jeugd heeft genoeg sessies om niet als beginner te tellen.
  for (let i = 1; i <= 5; i++) {
    await db.insert(trainingSessionsTable).values({
      clerkId: IDS.jeugd,
      sessionDate: ymdOffset(-i * 4),
      title: `Rit ${i}`,
      sport: "cycling",
    });
  }

  // Volwassen wedstrijdrenner, wedstrijd over 9 dagen, geen plan vandaag.
  await db
    .update(athleteProfilesTable)
    .set({
      birthDate: `${year - 30}-03-03`,
      experienceLevel: "intermediate",
      competitionLevel: "amateur",
    })
    .where(eq(athleteProfilesTable.clerkId, IDS.wedstrijd));
  for (let i = 1; i <= 6; i++) {
    await db.insert(trainingSessionsTable).values({
      clerkId: IDS.wedstrijd,
      sessionDate: ymdOffset(-i * 3),
      title: `Training ${i}`,
      sport: "cycling",
    });
  }
  await db.insert(racesTable).values({
    clerkId: IDS.wedstrijd,
    name: "Ronde van Test",
    raceDate: ymdOffset(9),
    priority: "A",
  });

  // Zieke sporter mét geplande training (gezondheid moet toch winnen).
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: `${year - 40}-06-06`, healthStatus: "sick" })
    .where(eq(athleteProfilesTable.clerkId, IDS.ziek));
  await db.insert(plannedWorkoutsTable).values({
    clerkId: IDS.ziek,
    scheduledDate: amsterdamToday(),
    title: "Duurtraining",
    source: "sparki",
  });

  // Sporter met geplande training vandaag.
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: `${year - 28}-02-02`, experienceLevel: "intermediate" })
    .where(eq(athleteProfilesTable.clerkId, IDS.training));
  for (let i = 1; i <= 6; i++) {
    await db.insert(trainingSessionsTable).values({
      clerkId: IDS.training,
      sessionDate: ymdOffset(-i * 2),
      title: `Sessie ${i}`,
      sport: "cycling",
    });
  }
  await db.insert(plannedWorkoutsTable).values({
    clerkId: IDS.training,
    scheduledDate: amsterdamToday(),
    title: "Intervaltraining",
    targetDurationMin: 75,
    source: "sparki",
  });

  // Beginner: volwassen, nul sessies.
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: `${year - 35}-09-09` })
    .where(eq(athleteProfilesTable.clerkId, IDS.beginner));
}

async function main() {
  await seed();

  await scenario("ziek ⇒ urgente gezondheid-lead wint van geplande training", async () => {
    const r = await orchestrateToday(IDS.ziek);
    assert(r.lead, "lead ontbreekt");
    assert(r.lead!.key === "lead:health:sick", `lead is ${r.lead!.key}`);
    assert(r.lead!.urgent === true, "health-lead moet urgent zijn");
    // Blijft staan bij een tweede call (openstaande urgentie rot niet weg).
    const r2 = await orchestrateToday(IDS.ziek);
    assert(r2.lead?.key === "lead:health:sick", "health-lead verdween bij herhaalde call");
  });

  await scenario("geplande training ⇒ workout-lead met titel en actie", async () => {
    const r = await orchestrateToday(IDS.training);
    assert(r.lead?.key.startsWith("lead:workout_today:"), `lead is ${r.lead?.key}`);
    assert(r.lead!.body.includes("Intervaltraining"), "workout-titel ontbreekt in lead");
    assert(r.lead!.actions.length >= 1, "workout-lead zonder actie");
  });

  await scenario("geen plan + wedstrijd over 9 dagen ⇒ §7-handelingsperspectief", async () => {
    const r = await orchestrateToday(IDS.wedstrijd);
    assert(r.lead?.key === "lead:no_plan_advice", `lead is ${r.lead?.key}`);
    assert(r.lead!.body.includes("geen training gepland"), "kernzin ontbreekt");
    assert(r.lead!.body.includes("Ronde van Test"), "wedstrijdnaam ontbreekt");
    assert(r.lead!.body.includes("9 dagen"), "aftelling ontbreekt");
    assert(
      r.lead!.actions.some((a) => a.label.includes("voorstellen")),
      "voorstel-actie ontbreekt",
    );
    assert(r.profile.variant === "wedstrijd", `variant is ${r.profile.variant}`);
  });

  await scenario("jeugd 15 ⇒ variant jeugd + eenvoudige copy zonder prikkel-jargon", async () => {
    const r = await orchestrateToday(IDS.jeugd);
    assert(r.profile.variant === "jeugd", `variant is ${r.profile.variant}`);
    assert(r.profile.minor === true, "minor-vlag ontbreekt");
    assert(r.profile.age === 15, `leeftijd is ${r.profile.age}`);
    assert(r.lead?.key === "lead:no_plan_advice", `lead is ${r.lead?.key}`);
    assert(!r.lead!.body.includes("gerichte prikkel"), "jeugd kreeg volwassen jargon");
    assert(r.lead!.body.includes("vrije dag"), "jeugd-copy ontbreekt");
  });

  await scenario("beginner zonder data ⇒ variant beginner, geen verzonnen inzicht", async () => {
    const r = await orchestrateToday(IDS.beginner);
    assert(r.profile.variant === "beginner", `variant is ${r.profile.variant}`);
    // Geen sessies ⇒ geen trend-inzicht; slot eerlijk leeg met reden.
    assert(r.insight === null, "inzicht verzonnen zonder data");
    assert(
      r.passedOver.some((p) => p.key === "insight:trend"),
      "afgevallen inzicht niet verantwoord",
    );
  });

  await scenario("weergavehistorie: 2e call zelfde dag telt niet dubbel; klik wordt vastgelegd", async () => {
    const r1 = await orchestrateToday(IDS.training);
    await orchestrateToday(IDS.training);
    const rows = await db
      .select()
      .from(todayDisplayHistoryTable)
      .where(
        and(
          eq(todayDisplayHistoryTable.clerkId, IDS.training),
          eq(todayDisplayHistoryTable.itemKey, r1.lead!.key),
        ),
      );
    assert(rows.length === 1, "historie-rij ontbreekt of dubbel");
    assert(rows[0]!.daysShown === 1, `daysShown is ${rows[0]!.daysShown}, verwacht 1`);
    const ok = await recordTodayInteraction(IDS.training, r1.lead!.key, "clicked");
    assert(ok, "interactie niet gevonden");
    const [after] = await db
      .select()
      .from(todayDisplayHistoryTable)
      .where(
        and(
          eq(todayDisplayHistoryTable.clerkId, IDS.training),
          eq(todayDisplayHistoryTable.itemKey, r1.lead!.key),
        ),
      );
    assert(after!.clicked === true, "clicked niet vastgelegd");
  });

  await scenario("rotating 3 dagen zonder klik ⇒ gepauzeerd", async () => {
    // Forceer historie: route-suggestie 3 dagen getoond, nooit geklikt.
    const key = "rotating:route_suggestion";
    await db
      .insert(todayDisplayHistoryTable)
      .values({
        clerkId: IDS.beginner,
        itemKey: key,
        slot: "rotating",
        firstShownOn: ymdOffset(-3),
        lastShownOn: ymdOffset(-1),
        daysShown: 3,
      })
      .onConflictDoUpdate({
        target: [todayDisplayHistoryTable.clerkId, todayDisplayHistoryTable.itemKey],
        set: { daysShown: 3, clicked: false, completed: false },
      });
    const r = await orchestrateToday(IDS.beginner);
    assert(r.rotating?.key !== key, "gepauzeerd item werd toch getoond");
    assert(
      r.passedOver.some((p) => p.key === key),
      "pauze niet verantwoord in passedOver",
    );
  });

  await cleanup();

  let failed = 0;
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("testrun crashte:", err);
  try {
    await cleanup();
  } catch {}
  await pool.end();
  process.exit(1);
});
