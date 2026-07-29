// WP-01C — rechtendifferentiatie trainerwerkruimte.
//
// Sectie A (stap 1): pure rechtenmatrix — relatie → capabilities, los van DB.
// Sectie B (stap 5) volgt: DB-vangnettests voor guards en privénotities.
//
// Run: node ./scripts/run-test.mjs trainer-rights

import { trainerCapabilities, type TrainerRelation } from "../lib/sharing";

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
  // ---------- Sectie A: pure matrix ----------
  const rel = (directLink: boolean, clubTeamAssignment: boolean): TrainerRelation => ({
    directLink,
    clubTeamAssignment,
  });

  await scenario("A1. directe coach zonder toewijzing: individueel wél, team niet", () => {
    const c = trainerCapabilities(rel(true, false));
    assert(c.hasAnyTrainerVisibility, "zichtbaarheid ontbreekt");
    assert(c.canReadIndividualCoachData, "individual_read ontbreekt");
    assert(c.canProposeIndividualTraining, "individual_plan_propose ontbreekt");
    assert(c.canMessageIndividually, "direct_message_individual ontbreekt");
    assert(c.canWriteCoachContext, "coachcontext ontbreekt");
    assert(c.canUsePrivateNotes, "private_note ontbreekt");
    assert(!c.canProposeTeamTraining, "team_plan_propose ten onrechte");
    assert(!c.canUseTeamCommunication, "team_message ten onrechte");
  });

  await scenario("A2. alleen club-/teamtrainer: identificeren + team, géén individueel", () => {
    const c = trainerCapabilities(rel(false, true));
    assert(c.hasAnyTrainerVisibility, "zichtbaarheid ontbreekt");
    assert(!c.canReadIndividualCoachData, "individual_read ten onrechte");
    assert(!c.canProposeIndividualTraining, "individual_plan_propose ten onrechte");
    assert(!c.canMessageIndividually, "direct_message_individual ten onrechte");
    assert(!c.canWriteCoachContext, "coachcontext ten onrechte");
    assert(!c.canUsePrivateNotes, "private_note ten onrechte");
    assert(c.canProposeTeamTraining, "team_plan_propose ontbreekt");
    assert(c.canUseTeamCommunication, "team_message ontbreekt");
  });

  await scenario("A3. beide relaties: unie van rechten", () => {
    const c = trainerCapabilities(rel(true, true));
    for (const [k, v] of Object.entries(c)) assert(v === true, `${k} ontbreekt bij beide relaties`);
  });

  await scenario("A4. geen relatie: helemaal niets", () => {
    const c = trainerCapabilities(rel(false, false));
    for (const [k, v] of Object.entries(c)) assert(v === false, `${k} ten onrechte zonder relatie`);
  });

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} groen`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
