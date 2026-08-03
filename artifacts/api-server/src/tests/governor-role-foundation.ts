// Governor Beslisblok 02 — fase 7: rechten- en isolatietests op het
// rollen-/organisatie-/abonnementsfundament, bovenop de rol-testfixtures.
//
// Bewijst:
//   1. Fixture-aanmaak is idempotent (tweede run verandert het eindbeeld niet).
//   2. Gekoppeld vs niet-gekoppeld: trainer-1 heeft een geaccepteerde link;
//      trainer-2 (controlegeval) heeft er géén en ook geen team-toewijzing.
//   3. Organisatie-isolatie: buitenstaander heeft geen clubcontext; lid van
//      club A heeft geen context in club B.
//   4. Einde lidmaatschap trekt clubcontext onmiddellijk in (endedAt op leesmoment).
//   5. Multi-role: platformrol en clubrol bestaan naast elkaar (unie-model).
//   6. Abonnementsdiepte-contexten: Gratis fail-closed, GO-trial en
//      COMPLETE-trial resolven via dezelfde entitlements-engine (geen tweede engine).
//   7. Ouder-link jeugd is fail-closed: permissions null ⇒ alleen veiligheidsminimum.
//   8. Productie-poort: fixturescript weigert bij NODE_ENV=production of REPLIT_DEPLOYMENT.
//   9. Remove verwijdert alles (0/0) en create herstelt daarna het volledige beeld.
//
// Run: node ./scripts/run-test.mjs governor-role-foundation
// Vereist DATABASE_URL + NODE_ENV!=production.

import {
  db,
  pool,
  userProfilesTable,
  clubsTable,
  clubMembersTable,
  clubTeamsTable,
  coachAthleteLinksTable,
  clubTrainerAssignmentsTable,
  parentAthleteLinksTable,
} from "@workspace/db";
import { and, eq, isNull, like } from "drizzle-orm";
import {
  createFixtures,
  removeFixtures,
  verifyFixtures,
  clerkIdFor,
  isProductionBlocked,
  GOVERNOR_FIXTURE_PREFIX,
} from "../scripts/governor-role-fixtures";
import { getClubContext } from "../lib/club-permissions";
import { effectiveParentAccess, SAFETY_CATEGORIES } from "../lib/parent-permissions";
import { resolveEntitlements, hasCommercialFeature, COMPLEET_FEATURE_KEYS } from "../lib/entitlements";

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
    results.push({ scenario: name, status: "fail", note: err instanceof Error ? err.message : String(err) });
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
    console.error("Deze test draait alleen buiten productie.");
    process.exit(1);
  }

  // Schone start + eerste create.
  await removeFixtures();
  const first = await createFixtures();
  const clubId = first.clubId;
  const [teamA] = first.teamIds;

  await scenario("1. idempotentie: tweede create verandert het eindbeeld niet", async () => {
    const before = await verifyFixtures();
    const second = await createFixtures();
    const after = await verifyFixtures();
    assert(second.clubId === clubId, "tweede run maakte een NIEUWE club");
    assert(before.userCount === after.userCount && after.userCount === 25, `verwacht 25 gebruikers, kreeg ${after.userCount}`);
    assert(after.clubCount === 1, `verwacht 1 club, kreeg ${after.clubCount}`);
    const teams = await db.select({ id: clubTeamsTable.id }).from(clubTeamsTable).where(eq(clubTeamsTable.clubId, clubId));
    assert(teams.length === 2, `verwacht 2 teams, kreeg ${teams.length}`);
  });

  await scenario("2. gekoppeld vs controlegeval niet-gekoppeld", async () => {
    const l1 = await db
      .select()
      .from(coachAthleteLinksTable)
      .where(and(eq(coachAthleteLinksTable.coachClerkId, clerkIdFor("trainer-1")), eq(coachAthleteLinksTable.status, "accepted")));
    assert(l1.length === 1 && l1[0].athleteClerkId === clerkIdFor("athlete-adult"), "trainer-1 mist de geaccepteerde link");
    const l2 = await db.select().from(coachAthleteLinksTable).where(eq(coachAthleteLinksTable.coachClerkId, clerkIdFor("trainer-2")));
    assert(l2.length === 0, "trainer-2 hoort GEEN links te hebben");
    const a2 = await db
      .select()
      .from(clubTrainerAssignmentsTable)
      .where(eq(clubTrainerAssignmentsTable.trainerClerkId, clerkIdFor("trainer-2")));
    assert(a2.length === 0, "trainer-2 hoort GEEN team-toewijzing te hebben");
    const a1 = await db
      .select()
      .from(clubTrainerAssignmentsTable)
      .where(and(eq(clubTrainerAssignmentsTable.trainerClerkId, clerkIdFor("trainer-1")), eq(clubTrainerAssignmentsTable.teamId, teamA)));
    assert(a1.length === 1, "trainer-1 hoort aan team A toegewezen te zijn");
  });

  await scenario("3. organisatie-isolatie (club A ≠ club B, buitenstaander niets)", async () => {
    const outsiderCtx = await getClubContext(clubId, clerkIdFor("outsider"));
    assert(!outsiderCtx || !("membership" in outsiderCtx) || !outsiderCtx.membership, "buitenstaander kreeg clubcontext");
    // Tijdelijke club B van de buitenstaander: fixture-leden hebben daar niets.
    const [clubB] = await db
      .insert(clubsTable)
      .values({ name: "TESTFIXTURE Tijdelijke Club B", ownerClerkId: clerkIdFor("outsider"), releaseGroup: "test" })
      .returning({ id: clubsTable.id });
    try {
      const trainerInB = await getClubContext(clubB.id, clerkIdFor("trainer-1"));
      assert(!trainerInB || !trainerInB.membership, "trainer van club A kreeg context in club B");
      const membersB = await db
        .select()
        .from(clubMembersTable)
        .where(and(eq(clubMembersTable.clubId, clubB.id), isNull(clubMembersTable.endedAt)));
      assert(membersB.length === 0, "club B hoort geen leden van club A te zien");
    } finally {
      await db.delete(clubsTable).where(eq(clubsTable.id, clubB.id));
    }
  });

  await scenario("4. einde lidmaatschap trekt toegang op leesmoment in", async () => {
    const t1 = clerkIdFor("trainer-1");
    const before = await getClubContext(clubId, t1);
    assert(before && before.membership, "trainer-1 hoort vooraf clubcontext te hebben");
    await db
      .update(clubMembersTable)
      .set({ endedAt: new Date(), endedReason: "test-einde" })
      .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.clerkId, t1), isNull(clubMembersTable.endedAt)));
    try {
      const after = await getClubContext(clubId, t1);
      assert(!after || !after.membership, "beëindigd lid kreeg nog steeds clubcontext");
    } finally {
      await createFixtures(); // herstelt actieve rij idempotent
    }
    const restored = await getClubContext(clubId, t1);
    assert(restored && restored.membership, "herstel van lidmaatschap faalde");
  });

  await scenario("5. multi-role: platformrol + clubrol bestaan naast elkaar", async () => {
    const [beheerder] = await db
      .select({ roles: userProfilesTable.roles, activeRole: userProfilesTable.activeRole })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkIdFor("clubbeheerder")));
    assert(beheerder && beheerder.roles.includes("athlete"), "clubbeheerder mist platformrol athlete");
    const ctx = await getClubContext(clubId, clerkIdFor("clubbeheerder"));
    assert(ctx && ctx.membership && ctx.membership.role === "admin", "clubbeheerder mist clubrol admin");
  });

  await scenario("6. abonnementscontexten via één entitlements-engine", async () => {
    const gratis = await resolveEntitlements(clerkIdFor("outsider"));
    const go = await resolveEntitlements(clerkIdFor("athlete-adult"));
    const compleet = await resolveEntitlements(clerkIdFor("athlete-compleet"));
    assert(gratis.entitlementMode === "subscription", "gratis-context hoort subscription te zijn");
    // Besluit René 31-07-2026 (SPARKI-BESLUIT-2026-001): de vier onderdelen
    // zijn Compleet-sleutels; GO_FEATURE_KEYS is (tot Opdracht 2) leeg, dus we
    // tellen over de Compleet-sleutels om een betekenisvolle trap te toetsen.
    for (const key of COMPLEET_FEATURE_KEYS) {
      assert(!hasCommercialFeature(gratis, key), `gratis mag ${key} niet hebben (fail-closed)`);
    }
    // GO- en COMPLETE-trial lopen door DEZELFDE resolutie; ze mogen niet
    // minder opleveren dan gratis en COMPLETE niet minder dan GO.
    const count = (r: Awaited<ReturnType<typeof resolveEntitlements>>) =>
      COMPLEET_FEATURE_KEYS.filter((k) => hasCommercialFeature(r, k)).length;
    assert(count(go) >= count(gratis), "GO-trial resolvet minder dan gratis");
    assert(count(compleet) >= count(go), "COMPLETE-trial resolvet minder dan GO");
  });

  await scenario("7. ouder-link jeugd is fail-closed (alleen veiligheidsminimum)", async () => {
    const [link] = await db
      .select()
      .from(parentAthleteLinksTable)
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, clerkIdFor("parent")),
          eq(parentAthleteLinksTable.athleteClerkId, clerkIdFor("athlete-jeugd")),
        ),
      );
    assert(link, "ouder-link ontbreekt");
    const access = await effectiveParentAccess(link as Parameters<typeof effectiveParentAccess>[0]);
    // Veiligheidsminimum = SAFETY_CATEGORIES + slaap (backward-compatibele
    // standaard in defaultsForLevel); alles daarbuiten moet dicht zijn zolang
    // er geen expliciete, bevestigde toestemming is.
    const safetyMinimum = new Set<string>([...SAFETY_CATEGORIES, "slaap"]);
    for (const [cat, allowed] of Object.entries(access.permissions as Record<string, boolean>)) {
      if (!safetyMinimum.has(cat)) {
        assert(!allowed, `niet-veiligheidscategorie ${cat} stond open zonder expliciete toestemming`);
      }
    }
  });

  await scenario("8. productie-poort fail-closed", () => {
    assert(isProductionBlocked({ NODE_ENV: "production" }), "NODE_ENV=production hoort geblokkeerd");
    assert(isProductionBlocked({ REPLIT_DEPLOYMENT: "1" }), "REPLIT_DEPLOYMENT hoort geblokkeerd");
    assert(!isProductionBlocked({ NODE_ENV: "development" }), "development hoort toegestaan");
  });

  await scenario("9. remove wist alles (ook kindrijen), create herstelt", async () => {
    await removeFixtures();
    const gone = await verifyFixtures();
    assert(gone.userCount === 0 && gone.clubCount === 0, `na remove verwacht 0/0, kreeg ${gone.userCount}/${gone.clubCount}`);
    const leftovers = await db
      .select({ clerkId: userProfilesTable.clerkId })
      .from(userProfilesTable)
      .where(like(userProfilesTable.clerkId, `${GOVERNOR_FIXTURE_PREFIX}%`));
    assert(leftovers.length === 0, "prefix-rijen bleven achter");
    // Kindrijen expliciet gecontroleerd (niet alleen op cascade vertrouwd).
    const members = await db.select().from(clubMembersTable).where(like(clubMembersTable.clerkId, `${GOVERNOR_FIXTURE_PREFIX}%`));
    assert(members.length === 0, "club_members-rijen bleven achter");
    const assigns = await db
      .select()
      .from(clubTrainerAssignmentsTable)
      .where(like(clubTrainerAssignmentsTable.trainerClerkId, `${GOVERNOR_FIXTURE_PREFIX}%`));
    assert(assigns.length === 0, "trainer-toewijzingen bleven achter");
    const coachLinks = await db
      .select()
      .from(coachAthleteLinksTable)
      .where(like(coachAthleteLinksTable.coachClerkId, `${GOVERNOR_FIXTURE_PREFIX}%`));
    assert(coachLinks.length === 0, "coach-links bleven achter");
    const parentLinks = await db
      .select()
      .from(parentAthleteLinksTable)
      .where(like(parentAthleteLinksTable.parentClerkId, `${GOVERNOR_FIXTURE_PREFIX}%`));
    assert(parentLinks.length === 0, "ouder-links bleven achter");
    await createFixtures();
    const back = await verifyFixtures();
    assert(back.userCount === 25 && back.clubCount === 1, "herstel na remove faalde");
  });

  await scenario("10. remove raakt niet-fixture-rijen niet (non-interference)", async () => {
    // Controle-account dat op de fixture lijkt maar NIET aan de strikte
    // handtekening voldoet (ander prefix + ander e-maildomein).
    const controlId = "governor-CONTROL-not-a-fixture";
    await db
      .insert(userProfilesTable)
      .values({ clerkId: controlId, email: "control@example-not-fixture.invalid", displayName: "TESTCONTROL", releaseGroup: "test" })
      .onConflictDoNothing();
    try {
      await removeFixtures();
      const [survivor] = await db
        .select({ clerkId: userProfilesTable.clerkId })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.clerkId, controlId));
      assert(survivor, "remove wiste een niet-fixture-rij");
    } finally {
      await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, controlId));
      await createFixtures();
    }
  });

  await scenario("11. gelijktijdige create-runs blijven idempotent (advisory lock)", async () => {
    await removeFixtures();
    const [a, b] = await Promise.all([createFixtures(), createFixtures()]);
    assert(a.clubId === b.clubId, "parallelle runs maakten verschillende clubs");
    const v = await verifyFixtures();
    assert(v.userCount === 25 && v.clubCount === 1, `na parallelle runs verwacht 25/1, kreeg ${v.userCount}/${v.clubCount}`);
    const teams = await db.select({ id: clubTeamsTable.id }).from(clubTeamsTable).where(eq(clubTeamsTable.clubId, a.clubId));
    assert(teams.length === 2, `verwacht 2 teams na parallelle runs, kreeg ${teams.length}`);
  });

  // Netjes achterlaten: fixtures verwijderd (dev-database blijft schoon).
  await removeFixtures();

  const failed = results.filter((r) => r.status === "fail").length;
  for (const r of results) {
    console.log(`${r.status === "pass" ? "PASS" : "FAIL"}  ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd.`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
