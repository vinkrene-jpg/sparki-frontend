// WP-01 stap 3 — veilige sporterselectie voor de trainerwerkruimte.
//
// Bewijst, bovenop de governor-rolfixtures:
//   1. Trainer-1 heeft toegang via directe link ÉN via club/teamtoewijzing.
//   2. Trainer-2 (clublid zónder toewijzing/link) ziet geen enkele sporter.
//   3. Buitenstaander ziet niets.
//   4. Beëindigd teamlidmaatschap trekt toewijzings-toegang direct in
//      (op leesmoment), directe link blijft los daarvan gelden.
//   5. Beëindigd clublidmaatschap van de TRAINER trekt alle toewijzings-
//      toegang direct in.
//   6. Jeugd blijft gegated: zichtbaarheid via team ≠ data — coachSharingLevel
//      voor de jeugdsporter zonder ouderconsent is "none" (fail-closed).
//
// Run: node ./scripts/run-test.mjs trainer-workspace-isolation

import { db, pool, clubMembersTable, clubTeamMembersTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { createFixtures, removeFixtures, clerkIdFor } from "../scripts/governor-role-fixtures";
import { hasCoachAccess, clubAssignedAthleteIds, coachSharingLevel } from "../lib/sharing";

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
    results.push({ scenario: name, status: "fail", note: err instanceof Error ? err.message : String(err) });
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
    console.error("Deze test draait alleen buiten productie.");
    process.exit(1);
  }
  await removeFixtures();
  const { clubId, teamIds } = await createFixtures();
  const t1 = clerkIdFor("trainer-1");
  const t2 = clerkIdFor("trainer-2");
  const outsider = clerkIdFor("outsider");
  const adult = clerkIdFor("athlete-adult");
  const jeugd = clerkIdFor("athlete-jeugd");

  await scenario("1. trainer-1: toegang via link én teamtoewijzing", async () => {
    assert(await hasCoachAccess(t1, adult), "trainer-1 mist toegang tot gekoppelde sporter");
    const assigned = await clubAssignedAthleteIds(t1);
    assert(assigned.includes(adult) && assigned.includes(jeugd), `toewijzing mist teamleden: ${assigned.join(",")}`);
    assert(await hasCoachAccess(t1, jeugd), "trainer-1 mist toegang tot teamlid zonder directe link");
  });

  await scenario("2. trainer-2 (geen toewijzing, geen link) ziet niets", async () => {
    assert((await clubAssignedAthleteIds(t2)).length === 0, "trainer-2 kreeg toewijzings-sporters");
    assert(!(await hasCoachAccess(t2, adult)), "trainer-2 kreeg toegang tot sporter");
    assert(!(await hasCoachAccess(t2, jeugd)), "trainer-2 kreeg toegang tot jeugdsporter");
  });

  await scenario("3. buitenstaander ziet niets", async () => {
    assert((await clubAssignedAthleteIds(outsider)).length === 0, "buitenstaander kreeg sporters");
    assert(!(await hasCoachAccess(outsider, adult)), "buitenstaander kreeg toegang");
  });

  await scenario("4. beëindigd teamlidmaatschap sluit toewijzingspad direct; link blijft", async () => {
    await db
      .update(clubTeamMembersTable)
      .set({ endedAt: new Date() })
      .where(and(eq(clubTeamMembersTable.teamId, teamIds[0]), eq(clubTeamMembersTable.clerkId, jeugd), isNull(clubTeamMembersTable.endedAt)));
    try {
      const assigned = await clubAssignedAthleteIds(t1);
      assert(!assigned.includes(jeugd), "beëindigd teamlid bleef zichtbaar via toewijzing");
      assert(!(await hasCoachAccess(t1, jeugd)), "toegang tot beëindigd teamlid bleef bestaan");
      assert(await hasCoachAccess(t1, adult), "directe link verdween onterecht mee");
    } finally {
      await createFixtures(); // herstelt actieve teamlid-rij idempotent
    }
  });

  await scenario("5. beëindigd clublidmaatschap van de trainer sluit alles via toewijzing", async () => {
    await db
      .update(clubMembersTable)
      .set({ endedAt: new Date() })
      .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.clerkId, t1), isNull(clubMembersTable.endedAt)));
    try {
      assert((await clubAssignedAthleteIds(t1)).length === 0, "ex-clublid hield toewijzings-toegang");
      assert(!(await hasCoachAccess(t1, jeugd)), "ex-clublid hield toegang tot teamlid");
      assert(await hasCoachAccess(t1, adult), "directe link hoort los van club te blijven gelden");
    } finally {
      await createFixtures();
    }
  });

  await scenario("6. jeugd zonder ouderconsent: zichtbaar in werkruimte, data fail-closed", async () => {
    assert(await hasCoachAccess(t1, jeugd), "teamlid-zichtbaarheid ontbreekt");
    const level = await coachSharingLevel(jeugd);
    assert(level === "none", `jeugd zonder consent moet 'none' zijn, kreeg '${level}'`);
  });

  await removeFixtures();
  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) console.log(`${r.status === "pass" ? "PASS" : "FAIL"}  ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd.`);
  await pool.end();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
