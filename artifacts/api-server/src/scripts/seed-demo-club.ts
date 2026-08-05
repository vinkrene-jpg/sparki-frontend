// ANALYSE_UITBREIDING §5.3 — Demo-omgeving voor clubs en trainers (laatst).
//
// Eén fictieve demoklub met een demotrainer en een groep voorbeeldsporters,
// zodat een club de trainersomgeving kan bekijken vóórdat hij betaalt.
// Regels (zelfde als §5.1):
// - alles is duidelijk als voorbeeld gemarkeerd en nooit te koppelen aan een
//   echte gebruiker (gereserveerde clerkId's + .invalid e-maildomein);
// - herhaalbaar en idempotent: elke run eindigt in dezelfde toestand;
// - leunt op §5.1: de sporters zijn de bestaande voorbeeld-/previewsporters
//   (seed-voorbeeldsporter + seed-preview-athletes) — geen eigen datamodel.
//
// Draaien: npx tsx src/scripts/seed-demo-club.ts
// (na seed-voorbeeldsporter.ts en seed-preview-athletes.ts, zodat de
//  sporters bestaan en gevuld zijn)

import {
  db,
  pool,
  userProfilesTable,
  clubsTable,
  clubMembersTable,
  clubTrainerAssignmentsTable,
  clubTeamsTable,
  clubTeamMembersTable,
  coachAthleteLinksTable,
} from "@workspace/db";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import { VOORBEELD_CLERK_ID } from "../lib/voorbeeldsporter";

export const DEMO_TRAINER_CLERK_ID = "voorbeeld_trainer";
const DEMO_TRAINER_EMAIL = "voorbeeldtrainer@voorbeeld.invalid";
const DEMO_TRAINER_NAAM = "Voorbeeldtrainer (fictief)";
const DEMO_CLUB_NAAM = "Demo Wielerclub (voorbeeld)";

// Groep: de §5.1-voorbeeldsporter + de bestaande previewsporters.
const DEMO_SPORTERS = [
  VOORBEELD_CLERK_ID,
  "seed_preview_dylan",
  "seed_preview_recreatief",
  "seed_preview_ervaren",
] as const;

async function main() {
  console.log("Demoklub voor trainers seeden …");

  // 1. Demotrainer-account (fictief, .invalid-domein) met coachrol.
  const trainer = await ensureAccount(
    DEMO_TRAINER_CLERK_ID,
    DEMO_TRAINER_EMAIL,
    DEMO_TRAINER_NAAM,
    silentLogger,
  );
  if (!trainer) throw new Error("ensureAccount gaf geen trainerprofiel terug");
  await db
    .update(userProfilesTable)
    .set({ roles: ["coach"] })
    .where(eq(userProfilesTable.clerkId, DEMO_TRAINER_CLERK_ID));

  // 2. Controleer dat de voorbeeldsporters bestaan (eerst hun seeds draaien).
  const bestaand = await db
    .select({ clerkId: userProfilesTable.clerkId })
    .from(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, [...DEMO_SPORTERS]));
  const aanwezig = new Set(bestaand.map((r) => r.clerkId));
  const sporters = DEMO_SPORTERS.filter((id) => aanwezig.has(id));
  const ontbrekend = DEMO_SPORTERS.filter((id) => !aanwezig.has(id));
  if (ontbrekend.length > 0) {
    console.warn(
      `Let op: ${ontbrekend.join(", ")} bestaan niet — draai eerst seed-voorbeeldsporter.ts en seed-preview-athletes.ts. Deze worden overgeslagen.`,
    );
  }
  if (sporters.length === 0) throw new Error("Geen enkele voorbeeldsporter aanwezig");

  // 3. Demoklub (idempotent op naam+eigenaar).
  let [club] = await db
    .select({ id: clubsTable.id })
    .from(clubsTable)
    .where(and(eq(clubsTable.name, DEMO_CLUB_NAAM), eq(clubsTable.ownerClerkId, DEMO_TRAINER_CLERK_ID)))
    .limit(1);
  if (!club) {
    [club] = await db
      .insert(clubsTable)
      .values({
        name: DEMO_CLUB_NAAM,
        description:
          "Fictieve demo-omgeving: zo ziet de trainersomgeving eruit met een gevulde groep. Alle sporters en data zijn voorbeelden.",
        ownerClerkId: DEMO_TRAINER_CLERK_ID,
      })
      .returning({ id: clubsTable.id });
  }
  const clubId = club!.id;

  // 4. Lidmaatschappen: trainer + sporters (idempotent: alleen als er geen
  //    actieve rij is).
  const leden: Array<{ clerkId: string; role: string }> = [
    { clerkId: DEMO_TRAINER_CLERK_ID, role: "hoofdtrainer" },
    ...sporters.map((id) => ({ clerkId: id, role: "member" })),
  ];
  for (const lid of leden) {
    const [actief] = await db
      .select({ id: clubMembersTable.id })
      .from(clubMembersTable)
      .where(
        and(
          eq(clubMembersTable.clubId, clubId),
          eq(clubMembersTable.clerkId, lid.clerkId),
          isNull(clubMembersTable.endedAt),
        ),
      )
      .limit(1);
    if (!actief) {
      await db.insert(clubMembersTable).values({ clubId, clerkId: lid.clerkId, role: lid.role });
    }
  }

  // 5. Demoteam + teamleden + trainer-toewijzing op het team (toewijzingen
  //    lopen via team of groep, niet per losse sporter).
  let [team] = await db
    .select({ id: clubTeamsTable.id })
    .from(clubTeamsTable)
    .where(and(eq(clubTeamsTable.clubId, clubId), eq(clubTeamsTable.name, "Demo Selectie")))
    .limit(1);
  if (!team) {
    [team] = await db
      .insert(clubTeamsTable)
      .values({ clubId, name: "Demo Selectie", description: "Voorbeeldgroep (fictief)" })
      .returning({ id: clubTeamsTable.id });
  }
  const teamId = team!.id;
  for (const sporterId of sporters) {
    const [lid] = await db
      .select({ id: clubTeamMembersTable.id })
      .from(clubTeamMembersTable)
      .where(
        and(
          eq(clubTeamMembersTable.teamId, teamId),
          eq(clubTeamMembersTable.clerkId, sporterId),
          isNull(clubTeamMembersTable.endedAt),
        ),
      )
      .limit(1);
    if (!lid) {
      await db.insert(clubTeamMembersTable).values({ teamId, clerkId: sporterId });
    }
  }
  const [toewijzing] = await db
    .select({ id: clubTrainerAssignmentsTable.id })
    .from(clubTrainerAssignmentsTable)
    .where(
      and(
        eq(clubTrainerAssignmentsTable.trainerClerkId, DEMO_TRAINER_CLERK_ID),
        eq(clubTrainerAssignmentsTable.teamId, teamId),
      ),
    )
    .limit(1);
  if (!toewijzing) {
    await db.insert(clubTrainerAssignmentsTable).values({
      clubId,
      trainerClerkId: DEMO_TRAINER_CLERK_ID,
      teamId,
    });
  }

  for (const sporterId of sporters) {
    // Directe coachlink (actief) — schrijfrechten in de cockpit eisen een
    // directe link, niet alleen een clubtoewijzing.
    const [link] = await db
      .select({ coachClerkId: coachAthleteLinksTable.coachClerkId })
      .from(coachAthleteLinksTable)
      .where(
        and(
          eq(coachAthleteLinksTable.coachClerkId, DEMO_TRAINER_CLERK_ID),
          eq(coachAthleteLinksTable.athleteClerkId, sporterId),
          isNull(coachAthleteLinksTable.endedAt),
        ),
      )
      .limit(1);
    if (!link) {
      await db.insert(coachAthleteLinksTable).values({
        coachClerkId: DEMO_TRAINER_CLERK_ID,
        athleteClerkId: sporterId,
        status: "active",
      });
    }
  }

  console.log(
    `Klaar: club ${clubId} (“${DEMO_CLUB_NAAM}”), trainer ${DEMO_TRAINER_CLERK_ID}, sporters: ${sporters.join(", ")}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void pool.end());
