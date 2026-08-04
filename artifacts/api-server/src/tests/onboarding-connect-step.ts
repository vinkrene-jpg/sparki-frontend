// New-athlete connect step — end-to-end "can't get stuck" route contract test.
//
// The onboarding now routes every new athlete through a mandatory connect step,
// then a gap-fill that asks ONLY the required fields still missing after any
// import, before the first plan is built. The write path was previously only
// smoke-tested against a dev user who already had complete data, so the
// persistence + "only-missing-remaining" behaviour for a TRULY EMPTY new account
// was never observed end to end. A regression here silently blocks signup or
// re-asks data a connection already supplied.
//
// This test boots the REAL Express app and drives the exact HTTP endpoints the
// onboarding UI calls, as a fresh dev user (x-dev-clerk-id), for two accounts:
//
//   A. Empty account → full gap-fill flow. Proves: missing-data lists ONLY the
//      genuinely-missing required fields, POST persists each to its canonical
//      table (displayName→user_profiles; discipline/weightKg/ftp/
//      weeklyHourTarget/availableDays→athlete_profiles) with the measured flags
//      set, the follow-up progressive questions never re-ask a gap-fill field,
//      and complete-v2 lands the athlete on a built plan.
//
//   B. Empty account → connect step WITHOUT connecting and WITHOUT filling the
//      gap-fill (the honest no-platform-available case). Proves complete-v2
//      still seeds estimated defaults and builds a plan — never a dead-end.
//
// Run: `pnpm --filter @workspace/api-server run test:onboarding-connect-step`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script). Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  onboardingStateTable,
  trainingPlansTable,
  plannedWorkoutsTable,
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

const RUN = `test_onb_connect_${Date.now()}`;
const ids: string[] = [];
function newId(tag: string): string {
  const id = `${RUN}_${tag}`;
  ids.push(id);
  return id;
}
const emailFor = (id: string) => `${id}@example.test`;

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
      } else {
        reject(new Error("failed to determine server port"));
      }
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

// ── HTTP helpers acting as a dev user via the x-dev-clerk-id header. ──────────
interface RequiredFieldSpec {
  key: string;
  label: string;
  type: string;
  unit?: string;
  options?: { value: string; label: string }[];
}
interface MissingDataResult {
  missing: RequiredFieldSpec[];
  present: string[];
  complete: boolean;
}

async function getMissing(clerkId: string): Promise<{
  status: number;
  body: MissingDataResult;
}> {
  const res = await fetch(`${baseUrl}/api/onboarding/missing-data`, {
    headers: { "x-dev-clerk-id": clerkId },
  });
  return { status: res.status, body: (await res.json()) as MissingDataResult };
}

async function postMissing(
  clerkId: string,
  values: Record<string, unknown>,
): Promise<{ status: number; body: MissingDataResult }> {
  const res = await fetch(`${baseUrl}/api/onboarding/missing-data`, {
    method: "POST",
    headers: { "x-dev-clerk-id": clerkId, "content-type": "application/json" },
    body: JSON.stringify({ values }),
  });
  return { status: res.status, body: (await res.json()) as MissingDataResult };
}

async function getNextQuestions(clerkId: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/api/onboarding/next-questions?limit=5`, {
    headers: { "x-dev-clerk-id": clerkId },
  });
  const json = (await res.json()) as { questions?: { key: string }[] };
  return (json.questions ?? []).map((q) => q.key);
}

async function completeV2(
  clerkId: string,
): Promise<{ status: number; planReady: boolean }> {
  const res = await fetch(`${baseUrl}/api/onboarding/complete-v2`, {
    method: "POST",
    headers: { "x-dev-clerk-id": clerkId, "content-type": "application/json" },
    body: JSON.stringify({ selfType: "geen_idee" }),
  });
  const json = (await res.json()) as { planReady?: boolean };
  return { status: res.status, planReady: json.planReady === true };
}

// A fresh account with NO displayName and an empty athlete profile — the truest
// possible "brand-new athlete" state after auth/sync gave no name.
async function freshEmptyAccount(tag: string): Promise<string> {
  const id = newId(tag);
  await ensureAccount(id, emailFor(id), null, silentLogger);
  return id;
}

async function hasActivePlan(clerkId: string): Promise<boolean> {
  const [plan] = await db
    .select({ id: trainingPlansTable.id })
    .from(trainingPlansTable)
    .where(
      and(
        eq(trainingPlansTable.clerkId, clerkId),
        eq(trainingPlansTable.status, "active"),
      ),
    )
    .limit(1);
  return !!plan;
}

async function cleanup() {
  if (ids.length === 0) return;
  // planned_workouts + training_plans are not guaranteed to cascade from the
  // user; remove ours explicitly, then the profile row (children cascade).
  await db
    .delete(plannedWorkoutsTable)
    .where(inArray(plannedWorkoutsTable.clerkId, ids));
  await db
    .delete(trainingPlansTable)
    .where(inArray(trainingPlansTable.clerkId, ids));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, ids));
}

async function main() {
  await startServer();

  // Precondition: the dev-auth bypass must authorize a fresh user, otherwise
  // every request is a 401/403 and every assertion below is meaningless.
  await scenario("dev bypass authorizes a fresh athlete (precondition)", async () => {
    const id = await freshEmptyAccount("precheck");
    const { status } = await getMissing(id);
    assert(
      status === 200,
      `expected 200 via dev bypass, got ${status} — ensure NODE_ENV!=production ` +
        `and DEV_AUTH_BYPASS=true`,
    );
  });

  // ── Scenario A: empty account → full gap-fill flow ─────────────────────────
  await scenario(
    "A1: empty account lists ALL required fields as missing (nothing present)",
    async () => {
      const id = await freshEmptyAccount("full");
      const { body } = await getMissing(id);
      assert(body.complete === false, "empty account reported complete");
      assert(body.present.length === 0, `present should be empty: ${body.present}`);
      const keys = new Set(body.missing.map((f) => f.key));
      for (const k of [
        "displayName",
        "discipline",
        "birthDate",
        "weightKg",
        "ftp",
        "weeklyHourTarget",
        "availableDays",
      ]) {
        assert(keys.has(k), `missing did not include required field ${k}`);
      }
    },
  );

  await scenario(
    "A2: gap-fill discipline options are canonical registry values (savable)",
    async () => {
      const id = await freshEmptyAccount("disc");
      const { body } = await getMissing(id);
      const disc = body.missing.find((f) => f.key === "discipline");
      assert(disc?.options && disc.options.length > 0, "discipline had no options");
      // Canonical cycling subdisciplines are capitalised (Road/Gravel/...).
      // A lowercase value would silently fail isValidSubdiscipline on save.
      assert(
        disc!.options!.some((o) => o.value === "Road"),
        `discipline options not canonical: ${JSON.stringify(disc!.options)}`,
      );
    },
  );

  await scenario(
    "A3: saving the gaps persists each field to its canonical table + flags",
    async () => {
      const id = await freshEmptyAccount("save");
      const { body } = await postMissing(id, {
        displayName: "  Nieuwe Renner  ",
        discipline: "Road",
        birthDate: "2008-03-15",
        weightKg: "72.4",
        ftp: "250",
        weeklyHourTarget: "10",
        availableDays: ["mon", "wed", "sat"],
      });
      assert(body.complete === true, `after save should be complete: ${JSON.stringify(body)}`);
      assert(body.missing.length === 0, `still missing after save: ${JSON.stringify(body.missing)}`);

      const [user] = await db
        .select()
        .from(userProfilesTable)
        .where(eq(userProfilesTable.clerkId, id));
      assert(user?.displayName === "Nieuwe Renner", `displayName not trimmed/persisted: ${user?.displayName}`);

      const [prof] = await db
        .select()
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, id));
      assert(prof?.discipline === "Road", `discipline not persisted: ${prof?.discipline}`);
      // JEUGD_EN_PLOEGLEIDER_HERSTEL_01: geboortedatum is verplicht en moet
      // exact als ingevoerd bewaard worden (datum + afgeleid jaar).
      assert(prof?.birthDate === "2008-03-15", `birthDate not persisted: ${prof?.birthDate}`);
      assert(prof?.birthYear === 2008, `birthYear not derived: ${prof?.birthYear}`);
      assert(Number(prof?.weightKg) === 72.4, `weightKg not persisted: ${prof?.weightKg}`);
      assert(prof?.ftp === 250, `ftp not persisted: ${prof?.ftp}`);
      // Manual entries must be marked measured, or the progressive engine re-asks.
      assert(prof?.ftpEstimated === false, "ftp not marked measured (ftpEstimated!==false)");
      assert(prof?.weeklyHourTarget === 10, `weeklyHourTarget not persisted: ${prof?.weeklyHourTarget}`);
      assert(
        prof?.weeklyHourTargetEstimated === false,
        "weeklyHourTarget not marked measured",
      );
      assert(
        Array.isArray(prof?.availableDays) &&
          prof!.availableDays!.length === 3 &&
          ["mon", "wed", "sat"].every((d) => prof!.availableDays!.includes(d)),
        `availableDays not persisted: ${JSON.stringify(prof?.availableDays)}`,
      );
      assert(prof?.trainingDaysPerWeek === 3, `trainingDaysPerWeek not derived: ${prof?.trainingDaysPerWeek}`);
    },
  );

  await scenario(
    "A4: follow-up questions never re-ask a field the gap-fill filled",
    async () => {
      const id = await freshEmptyAccount("noreask");
      await postMissing(id, {
        displayName: "Test Renner",
        discipline: "Road",
        weightKg: "70",
        ftp: "240",
        weeklyHourTarget: "8",
        availableDays: ["tue", "thu", "sat"],
      });
      const asked = await getNextQuestions(id);
      // ftp/weightKg/discipline are the fields that overlap the progressive
      // catalog; once gap-fill supplied them (ftp measured), they must not recur.
      for (const k of ["ftp", "weightKg", "discipline"]) {
        assert(!asked.includes(k), `follow-up re-asked gap-fill field "${k}" (asked: ${asked})`);
      }
    },
  );

  await scenario(
    "A5: after gap-fill, complete-v2 lands the athlete on a built plan",
    async () => {
      const id = await freshEmptyAccount("plan");
      await postMissing(id, {
        displayName: "Plan Renner",
        discipline: "Road",
        weightKg: "68",
        ftp: "230",
        weeklyHourTarget: "9",
        availableDays: ["mon", "wed", "fri", "sun"],
      });
      const { status, planReady } = await completeV2(id);
      assert(status === 201, `complete-v2 status ${status}`);
      assert(planReady === true, "complete-v2 reported no plan built");
      assert(await hasActivePlan(id), "no active training plan persisted");

      const [ob] = await db
        .select({ isComplete: onboardingStateTable.isComplete })
        .from(onboardingStateTable)
        .where(eq(onboardingStateTable.clerkId, id));
      assert(ob?.isComplete === true, "onboarding not marked complete");
    },
  );

  // ── Scenario B: connect step WITHOUT connecting AND without gap-fill ────────
  await scenario(
    "B1: no connection + no gap-fill still lands on a built plan (no dead-end)",
    async () => {
      const id = await freshEmptyAccount("empty");
      // Athlete proceeds through the mandatory connect step without connecting
      // anything and fills nothing in the gap-fill. complete-v2 must still seed
      // estimated defaults and build a real plan.
      const { status, planReady } = await completeV2(id);
      assert(status === 201, `complete-v2 status ${status}`);
      assert(planReady === true, "empty athlete got no plan — dead-end");
      assert(await hasActivePlan(id), "no active plan for the no-connection case");

      // The seeded planning inputs must exist so the plan is real, not a stub.
      const [prof] = await db
        .select()
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, id));
      assert(prof?.ftp != null, "no FTP seeded for empty athlete");
      assert(prof?.weeklyHourTarget != null, "no weekly hours seeded");
      assert(
        Array.isArray(prof?.availableDays) && prof!.availableDays!.length > 0,
        "no available days seeded",
      );
    },
  );
}

async function shutdown(code: number) {
  await stopServer().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    await cleanup().catch(() => {});
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== onboarding connect step (new athlete) — test results ===");
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await shutdown(1);
  });
