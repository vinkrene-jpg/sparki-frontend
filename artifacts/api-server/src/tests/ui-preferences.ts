// MEDIA_UITLEG_01 F1 — integratietest voor /api/ui-preferences.
//
// Toetst tegen de dev-DB (geen draaiende server nodig): default zonder rij,
// upsert in BEIDE richtingen (aan en weer uit — MTS-51), en dat de rij per
// gebruiker gescheiden blijft. Ruimt zijn eigen rijen volledig op.
//
// Run: `pnpm --filter @workspace/api-server run test:ui-preferences`

import {
  db,
  pool,
  userProfilesTable,
  uiPreferencesTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const RUN = `test_uipref_${Date.now()}`;
const userA = `${RUN}_a`;
const userB = `${RUN}_b`;
let failures = 0;

async function scenario(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${name}: ${err instanceof Error ? err.message : err}`);
  }
}

async function readPref(clerkId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(uiPreferencesTable)
    .where(eq(uiPreferencesTable.clerkId, clerkId))
    .limit(1);
  return rows[0]?.reduceMotion ?? false;
}

// Zelfde upsert-vorm als de route (routes/ui-preferences.ts PUT).
async function upsertPref(clerkId: string, reduceMotion: boolean) {
  await db
    .insert(uiPreferencesTable)
    .values({ clerkId, reduceMotion, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: uiPreferencesTable.clerkId,
      set: { reduceMotion, updatedAt: new Date() },
    });
}

async function main() {
  for (const id of [userA, userB]) {
    await db
      .insert(userProfilesTable)
      .values({ clerkId: id, email: `${id}@test.invalid` })
      .onConflictDoNothing();
  }

  await scenario("default zonder rij = false (veilige default)", async () => {
    assert((await readPref(userA)) === false, "verwachtte false zonder rij");
  });

  await scenario("aanzetten (richting 1)", async () => {
    await upsertPref(userA, true);
    assert((await readPref(userA)) === true, "verwachtte true na aanzetten");
  });

  await scenario("weer uitzetten (richting 2 — beide richtingen bewezen)", async () => {
    await upsertPref(userA, false);
    assert((await readPref(userA)) === false, "verwachtte false na uitzetten");
  });

  await scenario("per gebruiker gescheiden", async () => {
    await upsertPref(userA, true);
    assert((await readPref(userB)) === false, "userB mag userA's voorkeur niet zien");
  });

  // Opruimen (cascade via user_profiles).
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, [userA, userB]));

  await pool.end();
  if (failures > 0) process.exit(1);
  console.log("ui-preferences: alle scenario's geslaagd");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
