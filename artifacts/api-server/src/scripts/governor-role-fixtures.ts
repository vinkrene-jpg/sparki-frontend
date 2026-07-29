// Governor Beslisblok 02 — fase 6: rol-testfixtures (development/test/staging ONLY).
//
// Doel: één samenhangende, duidelijk synthetische testcontext voor het rollen-,
// organisatie- en abonnementsfundament:
//   • 1 volwassen sporter, 1 jeugdsporter, 1 ouder, 2 trainers, 1 hoofdtrainer,
//     1 clubbeheerder, 1 ploegleider, 1 mechanieker, 1 admin/testbeheerder;
//   • 1 club ("TESTFIXTURE Governor Club") + 2 teams/selecties;
//   • expliciet gekoppelde én niet-gekoppelde controlegevallen
//     (trainer 1 = gekoppeld aan sporter + team A; trainer 2 = bewust NIET gekoppeld);
//   • Gratis-, Go- en Compleet-context via entitlementMode/productVariant/tier-trial.
//
// Garanties (Beslisblok 02-eisen):
//   • FAIL-CLOSED in productie: weigert bij NODE_ENV=production of REPLIT_DEPLOYMENT.
//   • Geen echte persoonsgegevens: alle namen "TESTFIXTURE …", e-mail @governor-fixtures.invalid.
//   • Duidelijk gemarkeerd: alle clerkIds beginnen met PREFIX "governor-fixture-".
//   • Idempotent: vaste ids + upserts; herhaald draaien verandert het eindbeeld niet.
//   • Volledig verwijderbaar: `remove` wist uitsluitend rijen met het prefix
//     (FK's cascaden vanuit user_profiles/clubs) en raakt niets anders aan.
//   • Geen invloed op bestaande data (René/Dylan): alleen prefix-rijen worden geraakt;
//     er worden geen echte uitnodigingen verstuurd en geen Clerk-accounts aangemaakt.
//
// Run:
//   scripts/governor/create-role-test-fixtures.sh   (create)
//   scripts/governor/remove-role-test-fixtures.sh   (remove)
//   of direct: pnpm --filter @workspace/api-server exec tsx src/scripts/governor-role-fixtures.ts create|remove|verify

import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  userEntitlementsTable,
  clubsTable,
  clubMembersTable,
  clubTeamsTable,
  clubTrainerAssignmentsTable,
  clubSubscriptionsTable,
} from "@workspace/db";
import { and, eq, like, inArray, isNull, sql } from "drizzle-orm";

export const GOVERNOR_FIXTURE_PREFIX = "governor-fixture-";
const CLUB_NAME = "TESTFIXTURE Governor Club";
const EMAIL_DOMAIN = "governor-fixtures.invalid";

// Fail-closed productie-poort — puur en testbaar.
export function isProductionBlocked(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === "production" || Boolean(env.REPLIT_DEPLOYMENT);
}

function assertNotProduction() {
  if (isProductionBlocked()) {
    // Fail-closed: dit script mag nooit in productie draaien.
    console.error("GEWEIGERD: rol-testfixtures zijn alleen voor development/test/staging.");
    process.exit(1);
  }
}

type Persona = {
  key: string; // clerkId = PREFIX + key
  name: string;
  roles: string[];
  activeRole: string;
  birthDate?: string; // alleen sporters
  entitlementMode: "legacy_unrestricted" | "subscription";
  productVariant?: string | null;
  tierTrial?: "GO" | "COMPLETE"; // Sparki-beheerde trial als tier-context
  clubRole?: string; // rol in de fixture-club
};

// Synthetische personas — geen echte persoonsgegevens.
export const PERSONAS: Persona[] = [
  // Abonnementscontexten: Gratis = subscription zonder rechten (fail-closed),
  // Go = subscription + tier:GO-trial, Compleet = subscription + tier:COMPLETE-trial.
  { key: "athlete-adult", name: "TESTFIXTURE Sporter Volwassen", roles: ["athlete"], activeRole: "athlete", birthDate: "1996-04-12", entitlementMode: "subscription", tierTrial: "GO", clubRole: "member" },
  { key: "athlete-jeugd", name: "TESTFIXTURE Sporter Jeugd", roles: ["athlete"], activeRole: "athlete", birthDate: "2012-09-03", entitlementMode: "subscription", clubRole: "member" },
  { key: "athlete-compleet", name: "TESTFIXTURE Sporter Compleet", roles: ["athlete"], activeRole: "athlete", birthDate: "1990-01-20", entitlementMode: "subscription", tierTrial: "COMPLETE" },
  { key: "parent", name: "TESTFIXTURE Ouder", roles: ["parent"], activeRole: "parent", entitlementMode: "subscription", clubRole: "parent" },
  { key: "trainer-1", name: "TESTFIXTURE Trainer Een", roles: ["coach"], activeRole: "coach", entitlementMode: "subscription", clubRole: "trainer" },
  { key: "trainer-2", name: "TESTFIXTURE Trainer Twee (niet gekoppeld)", roles: ["coach"], activeRole: "coach", entitlementMode: "subscription", clubRole: "trainer" },
  { key: "hoofdtrainer", name: "TESTFIXTURE Hoofdtrainer", roles: ["coach"], activeRole: "coach", entitlementMode: "subscription", clubRole: "hoofdtrainer" },
  { key: "clubbeheerder", name: "TESTFIXTURE Clubbeheerder", roles: ["athlete"], activeRole: "athlete", entitlementMode: "subscription", clubRole: "admin" },
  { key: "ploegleider", name: "TESTFIXTURE Ploegleider", roles: ["athlete"], activeRole: "athlete", entitlementMode: "subscription", clubRole: "teammanager" },
  { key: "mechanieker", name: "TESTFIXTURE Mechanieker", roles: ["athlete"], activeRole: "athlete", entitlementMode: "subscription", clubRole: "mechanieker" },
  // Admin/testbeheer: admin-rechten lopen via SPARKI_ADMIN_IDS (env), die we hier
  // bewust NIET aanpassen; deze persona bestaat voor menusmoke en audit-tests.
  { key: "admin", name: "TESTFIXTURE Admin Testbeheer", roles: ["athlete"], activeRole: "athlete", entitlementMode: "legacy_unrestricted" },
  // Controlegeval buiten de club (niet-gekoppeld aan wat dan ook).
  { key: "outsider", name: "TESTFIXTURE Buitenstaander", roles: ["athlete"], activeRole: "athlete", entitlementMode: "subscription" },
];

export const clerkIdFor = (key: string) => `${GOVERNOR_FIXTURE_PREFIX}${key}`;

// Serialiseer create/remove volledig: één advisory lock op één dedicated
// client (lock en unlock moeten op DEZELFDE verbinding gebeuren). Hiermee is
// idempotentie ook onder gelijktijdige runs gegarandeerd — de select→insert-
// paden hieronder kunnen dan nooit dubbel invoegen.
async function withFixtureLock<T>(fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('governor-role-fixtures'))");
    try {
      return await fn();
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext('governor-role-fixtures'))");
    }
  } finally {
    client.release();
  }
}

export async function createFixtures() {
  return withFixtureLock(() => createFixturesInner());
}

async function createFixturesInner() {
  const now = new Date();
  // 1. Gebruikersprofielen (idempotent: vaste clerkIds, upsert werkt alles bij).
  for (const p of PERSONAS) {
    await db
      .insert(userProfilesTable)
      .values({
        clerkId: clerkIdFor(p.key),
        email: `${p.key}@${EMAIL_DOMAIN}`,
        displayName: p.name,
        roles: p.roles,
        activeRole: p.activeRole,
        entitlementMode: p.entitlementMode,
        productVariant: p.productVariant ?? null,
        releaseGroup: "test",
      })
      .onConflictDoUpdate({
        target: userProfilesTable.clerkId,
        set: {
          email: `${p.key}@${EMAIL_DOMAIN}`,
          displayName: p.name,
          roles: p.roles,
          activeRole: p.activeRole,
          entitlementMode: p.entitlementMode,
          productVariant: p.productVariant ?? null,
          releaseGroup: "test",
        },
      });
    if (p.birthDate) {
      await db
        .insert(athleteProfilesTable)
        .values({ clerkId: clerkIdFor(p.key), birthDate: p.birthDate })
        .onConflictDoUpdate({
          target: athleteProfilesTable.clerkId,
          set: { birthDate: p.birthDate },
        });
    }
  }

  // 2. Tier-trials (Gratis = geen rij; Go/Compleet = tier-trial, bron "test").
  for (const p of PERSONAS) {
    const clerkId = clerkIdFor(p.key);
    await db.delete(userEntitlementsTable).where(eq(userEntitlementsTable.clerkId, clerkId));
    if (p.tierTrial) {
      await db.insert(userEntitlementsTable).values({
        clerkId,
        entitlementKey: `tier:${p.tierTrial}`,
        entitlementType: "trial",
        status: "active",
        source: "test",
        startsAt: now,
        endsAt: null,
        metadata: { governorFixture: true },
        createdBy: clerkIdFor("admin"),
      });
    }
  }

  // 3. Club + abonnement (limieten) + 2 teams/selecties.
  const owner = clerkIdFor("clubbeheerder");
  const existing = await db
    .select({ id: clubsTable.id })
    .from(clubsTable)
    .where(and(eq(clubsTable.name, CLUB_NAME), eq(clubsTable.ownerClerkId, owner)));
  let clubId: number;
  if (existing.length > 0) {
    clubId = existing[0].id;
  } else {
    const inserted = await db
      .insert(clubsTable)
      .values({
        name: CLUB_NAME,
        description: "Synthetische testclub voor het rollen-/organisatiefundament (Beslisblok 02). Geen echte club.",
        ownerClerkId: owner,
        joinCode: "GOVFIX01",
        releaseGroup: "test",
      })
      .returning({ id: clubsTable.id });
    clubId = inserted[0].id;
  }
  await db
    .insert(clubSubscriptionsTable)
    .values({ clubId, packageKey: "proef", status: "trial", maxMembers: 25, maxTrainers: 5, notes: "governor-fixture" })
    .onConflictDoUpdate({
      target: clubSubscriptionsTable.clubId,
      set: { maxMembers: 25, maxTrainers: 5, notes: "governor-fixture" },
    });

  const teamNames = ["TESTFIXTURE Team A (selectie wedstrijd)", "TESTFIXTURE Team B (selectie jeugd)"];
  const teamIds: number[] = [];
  for (const name of teamNames) {
    const t = await db
      .select({ id: clubTeamsTable.id })
      .from(clubTeamsTable)
      .where(and(eq(clubTeamsTable.clubId, clubId), eq(clubTeamsTable.name, name)));
    if (t.length > 0) teamIds.push(t[0].id);
    else {
      const ins = await db
        .insert(clubTeamsTable)
        .values({ clubId, name, category: name.includes("jeugd") ? "jeugd" : "wedstrijd", managerClerkId: clerkIdFor("ploegleider") })
        .returning({ id: clubTeamsTable.id });
      teamIds.push(ins[0].id);
    }
  }

  // 4. Lidmaatschappen (idempotent: één actieve rij per club×gebruiker).
  for (const p of PERSONAS) {
    if (!p.clubRole) continue; // outsider/admin/compleet blijven bewust buiten de club
    const clerkId = clerkIdFor(p.key);
    const active = await db
      .select({ id: clubMembersTable.id, role: clubMembersTable.role })
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.clerkId, clerkId), isNull(clubMembersTable.endedAt)));
    if (active.length === 0) {
      await db.insert(clubMembersTable).values({ clubId, clerkId, role: p.clubRole });
    } else if (active[0].role !== p.clubRole) {
      await db.update(clubMembersTable).set({ role: p.clubRole }).where(eq(clubMembersTable.id, active[0].id));
    }
  }

  // 5. Trainer-toewijzing: trainer-1 → team A. Trainer-2 bewust GEEN toewijzing
  //    (controlegeval: clublid zonder scope ziet geen sportersdata).
  const t1 = clerkIdFor("trainer-1");
  const assigned = await db
    .select({ id: clubTrainerAssignmentsTable.id })
    .from(clubTrainerAssignmentsTable)
    .where(and(eq(clubTrainerAssignmentsTable.clubId, clubId), eq(clubTrainerAssignmentsTable.trainerClerkId, t1)));
  if (assigned.length === 0) {
    await db.insert(clubTrainerAssignmentsTable).values({ clubId, trainerClerkId: t1, teamId: teamIds[0] });
  }

  // 6. Directe links: trainer-1 ↔ volwassen sporter (accepted);
  //    ouder ↔ jeugdsporter (accepted). Trainer-2 bewust ONGEKOPPELD.
  await db
    .insert(coachAthleteLinksTable)
    .values({ coachClerkId: t1, athleteClerkId: clerkIdFor("athlete-adult"), status: "accepted" })
    .onConflictDoUpdate({
      target: [coachAthleteLinksTable.coachClerkId, coachAthleteLinksTable.athleteClerkId],
      set: { status: "accepted" },
    });
  await db
    .insert(parentAthleteLinksTable)
    .values({
      parentClerkId: clerkIdFor("parent"),
      athleteClerkId: clerkIdFor("athlete-jeugd"),
      status: "accepted",
    })
    .onConflictDoUpdate({
      target: [parentAthleteLinksTable.parentClerkId, parentAthleteLinksTable.athleteClerkId],
      set: { status: "accepted" },
    });

  return { clubId, teamIds };
}

export async function removeFixtures() {
  return withFixtureLock(async () => {
    // Strikte fixture-handtekening: prefix ÉN synthetisch e-maildomein ÉN
    // releasegroep "test" — nooit alleen een LIKE op prefix, zodat een
    // (theoretische) namespace-botsing met echte data nooit iets wist.
    // FK's met onDelete:cascade ruimen kindrijen van deze synthetische
    // accounts op; per definitie is al hun data door dit script aangemaakt.
    const owner = clerkIdFor("clubbeheerder");
    await db.delete(clubsTable).where(and(eq(clubsTable.name, CLUB_NAME), eq(clubsTable.ownerClerkId, owner)));
    await db
      .delete(userProfilesTable)
      .where(
        and(
          like(userProfilesTable.clerkId, `${GOVERNOR_FIXTURE_PREFIX}%`),
          like(userProfilesTable.email, `%@${EMAIL_DOMAIN}`),
          eq(userProfilesTable.releaseGroup, "test"),
        ),
      );
  });
}

export async function verifyFixtures() {
  const users = await db
    .select({ clerkId: userProfilesTable.clerkId })
    .from(userProfilesTable)
    .where(like(userProfilesTable.clerkId, `${GOVERNOR_FIXTURE_PREFIX}%`));
  const clubs = await db.select({ id: clubsTable.id }).from(clubsTable).where(eq(clubsTable.name, CLUB_NAME));
  return { userCount: users.length, clubCount: clubs.length };
}

async function main() {
  assertNotProduction();
  const mode = process.argv[2];
  if (mode === "create") {
    const r = await createFixtures();
    const v = await verifyFixtures();
    console.log(`Fixtures aangemaakt: club ${r.clubId}, teams ${r.teamIds.join("+")}, ${v.userCount} gebruikers.`);
  } else if (mode === "remove") {
    await removeFixtures();
    const v = await verifyFixtures();
    console.log(`Fixtures verwijderd. Resterend: ${v.userCount} gebruikers, ${v.clubCount} clubs (verwacht 0/0).`);
  } else if (mode === "verify") {
    console.log(JSON.stringify(await verifyFixtures()));
  } else {
    console.error("Gebruik: governor-role-fixtures.ts create|remove|verify");
    process.exit(1);
  }
  await pool.end();
}

// Alleen als CLI draaien (niet bij import vanuit tests).
const invokedDirectly = process.argv[1]?.includes("governor-role-fixtures");
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
