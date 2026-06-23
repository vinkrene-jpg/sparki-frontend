// Seed deterministic Social & Team testdata so the feature is visible in the dev
// preview. Idempotent: re-running upserts the same fixtures (stable clerkIds).
//
// Scenarios covered:
//  - solo athlete (no friends)                         → seed_social_solo
//  - athlete with 3 friends + club colors/logo + an
//    incoming joint-training proposal                  → the dev athlete (target)
//  - a friend who accepts a proposal                   → Anna
//  - a friend who declines a proposal                  → Bram
//  - a friend who does NOT share activity (fail-closed) → Chris
//
// Run: `pnpm --filter @workspace/api-server run seed:social`
// Requires: DATABASE_URL.

import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  privacySettingsTable,
  trainingSessionsTable,
  racesTable,
  friendLinksTable,
  teamIdentitiesTable,
  groupTrainingProposalsTable,
  groupTrainingInviteesTable,
} from "@workspace/db";
import { and, eq, inArray, or } from "drizzle-orm";

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function at(offsetDays: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function resolveDevClerkId(): Promise<string | null> {
  const pinned = process.env.DEV_AUTH_CLERK_ID;
  if (pinned) {
    const [row] = await db
      .select({ clerkId: userProfilesTable.clerkId })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, pinned));
    if (row) return row.clerkId;
  }
  const [first] = await db
    .select({ clerkId: userProfilesTable.clerkId })
    .from(userProfilesTable)
    .orderBy(userProfilesTable.createdAt, userProfilesTable.clerkId)
    .limit(1);
  return first?.clerkId ?? null;
}

async function upsertUser(
  clerkId: string,
  email: string,
  displayName: string,
) {
  await db
    .insert(userProfilesTable)
    .values({ clerkId, email, displayName })
    .onConflictDoUpdate({
      target: userProfilesTable.clerkId,
      set: { displayName, email },
    });
}

async function upsertAthlete(
  clerkId: string,
  data: { sport: string; availableDays: string[]; experienceLevel: string },
) {
  await db
    .insert(athleteProfilesTable)
    .values({ clerkId, ...data })
    .onConflictDoUpdate({
      target: athleteProfilesTable.clerkId,
      set: data,
    });
}

async function setShareActivity(clerkId: string, share: boolean) {
  await db
    .insert(privacySettingsTable)
    .values({ clerkId, shareActivityWithFriends: share })
    .onConflictDoUpdate({
      target: privacySettingsTable.clerkId,
      set: { shareActivityWithFriends: share },
    });
}

// Create (or reset) an accepted friendship between two users with explicit
// per-side training-buddy flags. `a` is stored as requester.
async function upsertFriendship(
  a: string,
  b: string,
  aBuddy: boolean,
  bBuddy: boolean,
) {
  await db
    .delete(friendLinksTable)
    .where(
      or(
        and(
          eq(friendLinksTable.requesterClerkId, a),
          eq(friendLinksTable.addresseeClerkId, b),
        ),
        and(
          eq(friendLinksTable.requesterClerkId, b),
          eq(friendLinksTable.addresseeClerkId, a),
        ),
      ),
    );
  await db.insert(friendLinksTable).values({
    requesterClerkId: a,
    addresseeClerkId: b,
    status: "accepted",
    requesterTrainingBuddy: aBuddy,
    addresseeTrainingBuddy: bBuddy,
    respondedAt: new Date(),
  });
}

async function main() {
  const target = await resolveDevClerkId();
  if (!target) {
    console.error(
      "No user_profiles row found. Sign in once (dev preview) before seeding.",
    );
    process.exit(1);
  }
  console.log(`Seeding social testdata around dev athlete: ${target}`);

  // ── Friend users ───────────────────────────────────────────────────────────
  const ANNA = "seed_social_anna";
  const BRAM = "seed_social_bram";
  const CHRIS = "seed_social_chris";
  const SOLO = "seed_social_solo";

  await upsertUser(ANNA, "anna@seed.sparki.dev", "Anna de Vries");
  await upsertUser(BRAM, "bram@seed.sparki.dev", "Bram Janssen");
  await upsertUser(CHRIS, "chris@seed.sparki.dev", "Chris Bakker");
  await upsertUser(SOLO, "solo@seed.sparki.dev", "Sven Solo");

  // Availability overlaps the dev athlete on sat/sun so the suggestion engine
  // can match (we also give the dev athlete those days below).
  await upsertAthlete(ANNA, {
    sport: "cycling",
    availableDays: ["tue", "thu", "sat", "sun"],
    experienceLevel: "intermediate",
  });
  await upsertAthlete(BRAM, {
    sport: "cycling",
    availableDays: ["wed", "sat", "sun"],
    experienceLevel: "advanced",
  });
  await upsertAthlete(CHRIS, {
    sport: "cycling",
    availableDays: ["mon", "fri"],
    experienceLevel: "beginner",
  });
  await upsertAthlete(SOLO, {
    sport: "cycling",
    availableDays: ["mon", "wed"],
    experienceLevel: "recreational",
  });

  // Make sure the dev athlete has cycling + weekend availability for matching.
  await db
    .insert(athleteProfilesTable)
    .values({
      clerkId: target,
      sport: "cycling",
      availableDays: ["tue", "thu", "sat", "sun"],
      experienceLevel: "intermediate",
    })
    .onConflictDoUpdate({
      target: athleteProfilesTable.clerkId,
      set: { sport: "cycling", availableDays: ["tue", "thu", "sat", "sun"] },
    });

  // ── Privacy: who shares activity with friends ────────────────────────────────
  await setShareActivity(ANNA, true); // Anna shows up in the feed
  await setShareActivity(BRAM, true); // Bram shows up in the feed
  await setShareActivity(CHRIS, false); // Chris stays private (fail-closed demo)
  await setShareActivity(target, true);

  // ── Friendships (dev athlete is requester) ───────────────────────────────────
  await upsertFriendship(target, ANNA, true, true); // both training buddies
  await upsertFriendship(target, BRAM, true, false); // dev marks Bram as buddy
  await upsertFriendship(target, CHRIS, false, false); // plain friend

  // ── Club / team identity for the dev athlete ─────────────────────────────────
  await db
    .insert(teamIdentitiesTable)
    .values({
      clerkId: target,
      clubName: "WV De Sprinters",
      teamName: "Sprinters Juniores A",
      logoUrl: "/club-crest.svg",
      primaryColor: "#0ea5b7",
      secondaryColor: "#0b1220",
      sport: "cycling",
      category: "Junioren",
      shirtBadge: "DS",
      role: "renner",
    })
    .onConflictDoUpdate({
      target: teamIdentitiesTable.clerkId,
      set: {
        clubName: "WV De Sprinters",
        teamName: "Sprinters Juniores A",
        logoUrl: "/club-crest.svg",
        primaryColor: "#0ea5b7",
        secondaryColor: "#0b1220",
        category: "Junioren",
        role: "renner",
        updatedAt: new Date(),
      },
    });
  // Give Anna a club too, so friend cards show club info.
  await db
    .insert(teamIdentitiesTable)
    .values({
      clerkId: ANNA,
      clubName: "WV De Sprinters",
      teamName: "Sprinters Dames",
      primaryColor: "#0ea5b7",
      secondaryColor: "#0b1220",
      sport: "cycling",
      category: "Nieuwelingen",
      role: "renner",
    })
    .onConflictDoUpdate({
      target: teamIdentitiesTable.clerkId,
      set: { clubName: "WV De Sprinters", teamName: "Sprinters Dames" },
    });

  // ── Feed sources ─────────────────────────────────────────────────────────────
  // Clear previously seeded fixtures so re-runs stay clean.
  await db
    .delete(trainingSessionsTable)
    .where(inArray(trainingSessionsTable.clerkId, [ANNA, BRAM, CHRIS]));
  await db
    .delete(racesTable)
    .where(inArray(racesTable.clerkId, [ANNA, BRAM, CHRIS]));

  // Anna completed a couple of rides recently → "training afgerond".
  await db.insert(trainingSessionsTable).values([
    {
      clerkId: ANNA,
      sessionDate: isoDate(-1),
      type: "ride",
      title: "Duurtraining langs de IJssel",
      durationMin: 105,
      sport: "cycling",
    },
    {
      clerkId: ANNA,
      sessionDate: isoDate(-3),
      type: "ride",
      title: "Intervaltraining heuvels",
      durationMin: 75,
      sport: "cycling",
    },
  ]);

  // Bram has an upcoming race → "wedstrijd gepland".
  await db.insert(racesTable).values({
    clerkId: BRAM,
    name: "Omloop van de Achterhoek",
    raceDate: isoDate(6),
    location: "Doetinchem",
    priority: "A",
  });

  // ── Group proposals ──────────────────────────────────────────────────────────
  // Wipe any prior seeded proposals (proposer or invitee in the seed set).
  const seedAll = [target, ANNA, BRAM, CHRIS];
  const prior = await db
    .select({ id: groupTrainingProposalsTable.id })
    .from(groupTrainingProposalsTable)
    .where(inArray(groupTrainingProposalsTable.proposerClerkId, seedAll));
  if (prior.length > 0) {
    await db.delete(groupTrainingProposalsTable).where(
      inArray(
        groupTrainingProposalsTable.id,
        prior.map((p) => p.id),
      ),
    );
  }

  // (a) Dev athlete's OUTBOX: invites Anna (accepts) + Bram (declines).
  const [outbox] = await db
    .insert(groupTrainingProposalsTable)
    .values({
      proposerClerkId: target,
      scheduledAt: at(2, 9),
      trainingType: "Duurrit samen",
      durationMin: 120,
      area: "Posbank",
      intensity: "rustig",
      note: "Rustig tempo, koffiestop halverwege.",
    })
    .returning();
  await db.insert(groupTrainingInviteesTable).values([
    {
      proposalId: outbox!.id,
      inviteeClerkId: ANNA,
      status: "accepted",
      respondedAt: new Date(),
    },
    {
      proposalId: outbox!.id,
      inviteeClerkId: BRAM,
      status: "declined",
      respondedAt: new Date(),
    },
  ]);

  // (b) Dev athlete's INBOX: Anna invites the dev athlete (still to answer).
  const [inbox] = await db
    .insert(groupTrainingProposalsTable)
    .values({
      proposerClerkId: ANNA,
      scheduledAt: at(4, 10),
      trainingType: "Intervaltraining",
      durationMin: 75,
      area: "Lokaal rondje",
      intensity: "pittig",
      note: "5x4 min in Z4, samen warm rijden.",
    })
    .returning();
  await db.insert(groupTrainingInviteesTable).values({
    proposalId: inbox!.id,
    inviteeClerkId: target,
    status: "proposed",
  });

  // (c) Bram has an OPEN proposal looking for company → feed "zoekt maatje".
  //     The dev athlete is invited so it also appears in their inbox.
  const [seeking] = await db
    .insert(groupTrainingProposalsTable)
    .values({
      proposerClerkId: BRAM,
      scheduledAt: at(5, 8),
      trainingType: "Lange duurrit",
      durationMin: 150,
      area: "Veluwe",
      intensity: "rustig",
      note: "Zoek iemand om samen lang te rijden.",
    })
    .returning();
  await db.insert(groupTrainingInviteesTable).values({
    proposalId: seeking!.id,
    inviteeClerkId: target,
    status: "proposed",
  });

  console.log("Social testdata seeded:");
  console.log(`  friends: Anna (buddy, shares), Bram (buddy, shares), Chris (private)`);
  console.log(`  club: WV De Sprinters · Junioren`);
  console.log(`  outbox proposal #${outbox!.id} (Anna accepted, Bram declined)`);
  console.log(`  inbox proposal #${inbox!.id} (from Anna, awaiting response)`);
  console.log(`  inbox proposal #${seeking!.id} (Bram seeking buddy)`);
  console.log(`  solo athlete with no friends: ${SOLO}`);
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
