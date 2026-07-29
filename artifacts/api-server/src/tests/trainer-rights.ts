// WP-01C — rechtendifferentiatie trainerwerkruimte.
//
// Sectie A (stap 1): pure rechtenmatrix — relatie → capabilities, los van DB.
// Sectie B (stap 5): DB-vangnettests voor guards, privénotities, AI-context en export.
//
// Run: node ./scripts/run-test.mjs trainer-rights

import { and, eq } from "drizzle-orm";
import { db, coachPrivateNotesTable, coachContextItemsTable, coachAthleteLinksTable } from "@workspace/db";
import {
  trainerCapabilities,
  getTrainerRelation,
  hasDirectCoachAccess,
  hasClubTeamTrainerAccess,
  hasCoachAccess,
  clubAssignedAthleteIds,
  type TrainerRelation,
} from "../lib/sharing";
import { buildAthleteContext } from "../lib/athlete-context";
import { exportAccountData } from "../lib/account-privacy";
import { createFixtures, removeFixtures, clerkIdFor } from "../scripts/governor-role-fixtures";

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

  // ---------- Sectie B: DB-vangnettests op de governor-fixtures ----------
  await createFixtures();
  const t1 = clerkIdFor("trainer-1"); // directe link (adult) + teamtoewijzing (adult+jeugd)
  const t2 = clerkIdFor("trainer-2"); // clublid zonder link én zonder toewijzing
  const hoofd = clerkIdFor("hoofdtrainer");
  const outsider = clerkIdFor("outsider");
  const adult = clerkIdFor("athlete-adult");
  const jeugd = clerkIdFor("athlete-jeugd");

  const NOTE_TEXT = "TESTPRIVE geheimzin die nergens mag opduiken 8271";
  let noteId = 0;

  try {
    await scenario("B1. directe coach heeft individuele toegang (cockpit-gate)", async () => {
      assert(await hasDirectCoachAccess(t1, adult), "directe link geeft geen individuele toegang");
      const relD = await getTrainerRelation(t1, adult);
      assert(relD.directLink, "relatie mist directLink");
    });

    await scenario("B2. alleen-teamtrainer: zichtbaar maar GEEN individuele toegang", async () => {
      assert(!(await hasDirectCoachAccess(t1, jeugd)), "teamtoewijzing gaf individuele toegang");
      assert(await hasClubTeamTrainerAccess(t1, jeugd), "teamzichtbaarheid ontbreekt");
      assert(await hasCoachAccess(t1, jeugd), "roster-zichtbaarheid (unie) ontbreekt");
    });

    await scenario("B3. teamtrainer ziet toegewezen sporters in teamscope", async () => {
      const ids = await clubAssignedAthleteIds(t1);
      assert(ids.includes(jeugd) && ids.includes(adult), "toegewezen sporters ontbreken in teamscope");
    });

    await scenario("B4. capability-afleiding uit echte relaties klopt", async () => {
      const cTeam = trainerCapabilities(await getTrainerRelation(t1, jeugd));
      assert(!cTeam.canReadIndividualCoachData && !cTeam.canUsePrivateNotes && cTeam.canProposeTeamTraining, "team-capabilities kloppen niet");
      const cDirect = trainerCapabilities(await getTrainerRelation(t1, adult));
      assert(cDirect.canReadIndividualCoachData && cDirect.canUsePrivateNotes, "direct-capabilities kloppen niet");
    });

    await scenario("B5. ongekoppelde clublid-trainer en buitenstaander: niets individueels", async () => {
      assert(!(await hasDirectCoachAccess(t2, adult)), "trainer-2 kreeg individuele toegang");
      assert(!(await hasClubTeamTrainerAccess(t2, adult)), "trainer-2 kreeg teamzichtbaarheid");
      assert(!(await hasDirectCoachAccess(outsider, adult)), "outsider kreeg individuele toegang");
      const cNone = trainerCapabilities(await getTrainerRelation(t2, adult));
      assert(!cNone.hasAnyTrainerVisibility, "trainer-2 heeft ten onrechte zichtbaarheid");
    });

    await scenario("B6. privénotitie aanmaken vereist directe link (guard-semantiek)", async () => {
      // Route-guard is hasDirectCoachAccess: t1→jeugd (alleen team) mag NIET.
      assert(!(await hasDirectCoachAccess(t1, jeugd)), "guard zou 403 moeten geven voor team-only");
      const [row] = await db
        .insert(coachPrivateNotesTable)
        .values({ ownerCoachClerkId: t1, athleteClerkId: adult, body: NOTE_TEXT })
        .returning();
      noteId = row.id;
      assert(noteId > 0, "notitie niet aangemaakt");
    });

    await scenario("B7. privénotitie onzichtbaar voor andere trainer én hoofdtrainer (owner-filter)", async () => {
      for (const viewer of [t2, hoofd, outsider]) {
        const rows = await db
          .select()
          .from(coachPrivateNotesTable)
          .where(
            and(
              eq(coachPrivateNotesTable.ownerCoachClerkId, viewer),
              eq(coachPrivateNotesTable.athleteClerkId, adult),
            ),
          );
        assert(rows.length === 0, `viewer ${viewer} ziet andermans privénotitie`);
      }
    });

    await scenario("B8. sporter ziet privénotitie NIET via transparantielaag (about-me = alleen context-items)", async () => {
      const items = await db
        .select()
        .from(coachContextItemsTable)
        .where(eq(coachContextItemsTable.athleteClerkId, adult));
      assert(!items.some((i) => i.body.includes("TESTPRIVE")), "privénotitie lekt via context-items");
    });

    await scenario("B9. privénotitie komt NIET in de AI-context van de sporter", async () => {
      const ctx = await buildAthleteContext(adult, "trainer_rights_test");
      assert(!ctx.includes("TESTPRIVE"), "privénotitie lekt in buildAthleteContext");
    });

    await scenario("B10. privénotitie lekt NIET via de gegevensexport van de sporter", async () => {
      const exp = await exportAccountData(adult);
      assert(!JSON.stringify(exp).includes("TESTPRIVE"), "privénotitie lekt via sporterexport");
    });

    await scenario("B11. privénotitie zit WEL in de export van de makende trainer", async () => {
      const exp = await exportAccountData(t1);
      assert(JSON.stringify(exp).includes("TESTPRIVE"), "eigenaar mist eigen notitie in export");
    });

    await scenario("B12. coachafspraak (context-item) is WEL transparant voor de sporter", async () => {
      const [item] = await db
        .insert(coachContextItemsTable)
        .values({ coachClerkId: t1, athleteClerkId: adult, kind: "instructie", body: "TESTAFSPRAAK rustig aan tot juni" })
        .returning();
      const mine = await db
        .select()
        .from(coachContextItemsTable)
        .where(eq(coachContextItemsTable.athleteClerkId, adult));
      assert(mine.some((i) => i.id === item.id), "coachafspraak niet zichtbaar voor sporter");
      await db.delete(coachContextItemsTable).where(eq(coachContextItemsTable.id, item.id));
    });

    await scenario("B13. einde directe koppeling trekt individuele toegang + privénotitie-API direct in", async () => {
      await db
        .update(coachAthleteLinksTable)
        .set({ status: "ended" })
        .where(and(eq(coachAthleteLinksTable.coachClerkId, t1), eq(coachAthleteLinksTable.athleteClerkId, adult)));
      try {
        assert(!(await hasDirectCoachAccess(t1, adult)), "individuele toegang bleef na einde link");
        // Notitie blijft bestaan (eigendom trainer) maar de route-guard weigert.
        const [still] = await db.select().from(coachPrivateNotesTable).where(eq(coachPrivateNotesTable.id, noteId));
        assert(still, "notitie onterecht verdwenen bij einde link");
      } finally {
        await db
          .update(coachAthleteLinksTable)
          .set({ status: "accepted" })
          .where(and(eq(coachAthleteLinksTable.coachClerkId, t1), eq(coachAthleteLinksTable.athleteClerkId, adult)));
      }
    });

    await scenario("B14. privénotitie is niet overdraagbaar: eigenaar-kolom is de enige sleutel", async () => {
      const rows = await db.select().from(coachPrivateNotesTable).where(eq(coachPrivateNotesTable.id, noteId));
      assert(rows.length === 1 && rows[0].ownerCoachClerkId === t1, "eigenaarschap klopt niet");
    });

    await scenario("B15. jeugdsporter: team-only trainer heeft ook dáár geen individuele rechten", async () => {
      const c = trainerCapabilities(await getTrainerRelation(t1, jeugd));
      assert(!c.canMessageIndividually && !c.canWriteCoachContext, "jeugd team-only kreeg individuele kanalen");
    });
  } finally {
    if (noteId) await db.delete(coachPrivateNotesTable).where(eq(coachPrivateNotesTable.id, noteId));
    await removeFixtures();
  }

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
