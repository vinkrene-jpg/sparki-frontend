// Account provisioning chain integration test.
//
// Exercises ensureAccount/reconcileRoles (the auth → sync → onboarding chain)
// against the dev DB across every account-state scenario. Each scenario uses a
// disposable clerkId/email and is fully cleaned up afterwards, so the test is
// safe to run repeatedly against a shared database.
//
// Run: `pnpm --filter @workspace/api-server run test:account`
// Requires: DATABASE_URL. Exits non-zero on any failure.

import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  onboardingStateTable,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { ensureAccount, reconcileRoles, silentLogger } from "../lib/account";

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

// Unique namespace per run so parallel/leftover rows never collide.
const RUN = `test_acct_${Date.now()}`;
const ids: string[] = [];
function newId(tag: string): string {
  const id = `${RUN}_${tag}`;
  ids.push(id);
  return id;
}
function emailFor(id: string): string {
  return `${id}@example.test`;
}

async function loadProfile(clerkId: string) {
  const [p] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));
  return p;
}

async function hasAthleteProfile(clerkId: string): Promise<boolean> {
  const [a] = await db
    .select({ clerkId: athleteProfilesTable.clerkId })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId));
  return !!a;
}

async function cleanup() {
  if (ids.length === 0) return;
  // Children first (most carry ON DELETE CASCADE from user_profiles, but delete
  // explicitly so the test cleans up even if a row was created out of band).
  await db
    .delete(coachAthleteLinksTable)
    .where(inArray(coachAthleteLinksTable.coachClerkId, ids));
  await db
    .delete(coachAthleteLinksTable)
    .where(inArray(coachAthleteLinksTable.athleteClerkId, ids));
  await db
    .delete(parentAthleteLinksTable)
    .where(inArray(parentAthleteLinksTable.parentClerkId, ids));
  await db
    .delete(parentAthleteLinksTable)
    .where(inArray(parentAthleteLinksTable.athleteClerkId, ids));
  await db
    .delete(onboardingStateTable)
    .where(inArray(onboardingStateTable.clerkId, ids));
  await db
    .delete(athleteProfilesTable)
    .where(inArray(athleteProfilesTable.clerkId, ids));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, ids));
}

async function main() {
  // 1. New user — no rows exist; ensureAccount provisions everything.
  await scenario("nieuwe gebruiker", async () => {
    const id = newId("new");
    const profile = await ensureAccount(id, emailFor(id), "Nieuw", silentLogger);
    assert(profile, "expected a profile");
    assert(profile!.clerkId === id, "clerkId mismatch");
    assert(profile!.email === emailFor(id), "email mismatch");
    assert(
      JSON.stringify(profile!.roles) === JSON.stringify(["athlete"]),
      `roles should default to [athlete], got ${JSON.stringify(profile!.roles)}`,
    );
    assert(profile!.activeRole === "athlete", "activeRole should be athlete");
    assert(await hasAthleteProfile(id), "athlete_profile should be created");
  });

  // 2. Existing user — second sync is idempotent, preserves data.
  await scenario("bestaande gebruiker", async () => {
    const id = newId("existing");
    await ensureAccount(id, emailFor(id), "Bestaand", silentLogger);
    // Mutate displayName to verify the second call does not clobber on conflict.
    await db
      .update(userProfilesTable)
      .set({ displayName: "Aangepast" })
      .where(eq(userProfilesTable.clerkId, id));
    const profile = await ensureAccount(id, emailFor(id), "Anders", silentLogger);
    assert(profile, "expected a profile");
    assert(
      profile!.displayName === "Aangepast",
      `existing displayName must be preserved, got ${profile!.displayName}`,
    );
    assert(await hasAthleteProfile(id), "athlete_profile should still exist");
  });

  // 3. Existing email under a defunct clerkId — re-create Clerk account → re-link.
  await scenario("gebruiker met bestaand e-mailadres (re-link)", async () => {
    const oldId = newId("relink_old");
    const newClerkId = newId("relink_new");
    const email = emailFor(oldId); // same email, new clerkId
    // Provision the original account and give it history (coach role).
    await ensureAccount(oldId, email, "Origineel", silentLogger);
    await db
      .update(userProfilesTable)
      .set({ roles: ["athlete", "coach"], activeRole: "coach" })
      .where(eq(userProfilesTable.clerkId, oldId));
    // Same person signs in with a NEW clerkId but the SAME verified email.
    const profile = await ensureAccount(newClerkId, email, "Nieuw", silentLogger);
    assert(profile, "expected a re-linked profile");
    assert(
      profile!.clerkId === newClerkId,
      "profile should now belong to the new clerkId",
    );
    // History (roles) must survive the re-link.
    assert(
      profile!.roles.includes("coach"),
      `re-linked profile should keep coach role, got ${JSON.stringify(profile!.roles)}`,
    );
    // Old clerkId must no longer exist.
    assert(!(await loadProfile(oldId)), "old clerkId row should be gone");
    assert(
      await hasAthleteProfile(newClerkId),
      "athlete_profile should follow re-link",
    );
  });

  // 4. Partial profile — user_profiles exists but role data is corrupted.
  await scenario("gebruiker met gedeeltelijk profiel (corrupte rollen)", async () => {
    const id = newId("partial");
    await ensureAccount(id, emailFor(id), "Partial", silentLogger);
    // Corrupt: empty roles + activeRole pointing outside roles[].
    await db
      .update(userProfilesTable)
      .set({ roles: [], activeRole: "coach" })
      .where(eq(userProfilesTable.clerkId, id));
    const profile = await ensureAccount(id, emailFor(id), "Partial", silentLogger);
    assert(profile, "expected a profile");
    assert(
      profile!.roles.includes("athlete"),
      "athlete baseline role must be restored",
    );
    assert(
      profile!.roles.includes(profile!.activeRole),
      `activeRole must be within roles, got active=${profile!.activeRole} roles=${JSON.stringify(profile!.roles)}`,
    );
    assert(
      profile!.activeRole === "athlete",
      "drifted activeRole should fall back to athlete",
    );
  });

  // 5. User without athlete_profile — child row lost; ensureAccount recreates it.
  await scenario("gebruiker zonder athlete_profile", async () => {
    const id = newId("noathlete");
    await ensureAccount(id, emailFor(id), "NoAthlete", silentLogger);
    await db
      .delete(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, id));
    assert(
      !(await hasAthleteProfile(id)),
      "precondition: athlete_profile deleted",
    );
    const profile = await ensureAccount(id, emailFor(id), "NoAthlete", silentLogger);
    assert(profile, "expected a profile");
    assert(
      await hasAthleteProfile(id),
      "athlete_profile should be auto-restored",
    );
  });

  // 6. Coach role — accepted coach link re-adds the role if it went missing.
  await scenario("gebruiker met coachrol", async () => {
    const coachId = newId("coach");
    const athleteId = newId("coach_athlete");
    await ensureAccount(coachId, emailFor(coachId), "Coach", silentLogger);
    await ensureAccount(athleteId, emailFor(athleteId), "Pupil", silentLogger);
    await db.insert(coachAthleteLinksTable).values({
      coachClerkId: coachId,
      athleteClerkId: athleteId,
      status: "accepted",
    });
    // Role missing from roles[] despite an accepted link — must be reconciled.
    await db
      .update(userProfilesTable)
      .set({ roles: ["athlete"], activeRole: "athlete" })
      .where(eq(userProfilesTable.clerkId, coachId));
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, coachId));
    const reconciled = await reconcileRoles(profile!, silentLogger);
    assert(
      reconciled.roles.includes("coach"),
      `coach role should be restored from accepted link, got ${JSON.stringify(reconciled.roles)}`,
    );
  });

  // 7. Parent role — accepted parent link re-adds the role if it went missing.
  await scenario("gebruiker met ouderrol", async () => {
    const parentId = newId("parent");
    const childId = newId("parent_child");
    await ensureAccount(parentId, emailFor(parentId), "Ouder", silentLogger);
    await ensureAccount(childId, emailFor(childId), "Kind", silentLogger);
    await db.insert(parentAthleteLinksTable).values({
      parentClerkId: parentId,
      athleteClerkId: childId,
      status: "accepted",
    });
    await db
      .update(userProfilesTable)
      .set({ roles: ["athlete"], activeRole: "athlete" })
      .where(eq(userProfilesTable.clerkId, parentId));
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, parentId));
    const reconciled = await reconcileRoles(profile!, silentLogger);
    assert(
      reconciled.roles.includes("parent"),
      `parent role should be restored from accepted link, got ${JSON.stringify(reconciled.roles)}`,
    );
  });

  // 8. Pending (not accepted) link must NOT grant a role.
  await scenario("openstaande uitnodiging geeft geen rol", async () => {
    const coachId = newId("pending_coach");
    const athleteId = newId("pending_athlete");
    await ensureAccount(coachId, emailFor(coachId), "Coach", silentLogger);
    await ensureAccount(athleteId, emailFor(athleteId), "Pupil", silentLogger);
    await db.insert(coachAthleteLinksTable).values({
      coachClerkId: coachId,
      athleteClerkId: athleteId,
      status: "pending",
    });
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, coachId));
    const reconciled = await reconcileRoles(profile!, silentLogger);
    assert(
      !reconciled.roles.includes("coach"),
      "pending link must not grant the coach role",
    );
  });
}

async function shutdown(code: number) {
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    await cleanup();
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== Account provisioning chain — test results ===");
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(
      `\n${results.length - failed.length}/${results.length} passed.\n`,
    );
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await shutdown(1);
  });
