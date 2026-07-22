// Rit delen — eerlijkheidstest.
//
// Vergrendelt het eerlijkheidscontract van de share-engine:
// 1. Platform-bron (strava/garmin/wahoo) ⇒ geen upload (duplicaat-reden).
// 2. Geen Strava-koppeling ⇒ eerlijke koppel-reden.
// 3. Koppeling zonder activity:write ⇒ eerlijke opnieuw-koppelen-reden.
// 4. Volledige koppeling maar geen echte starttijd ⇒ eerlijke weigering
//    (Sparki verzint geen starttijd).
// 5. uploadSessionToStrava gooit dezelfde eerlijke redenen (geen netwerk-call).
// 6. Deterministische deeltekst bevat uitsluitend echte waarden.
//
// Run: `pnpm --filter @workspace/api-server run test:share-honesty`

import { and, eq } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  trainingSessionsTable,
  connectorConnectionsTable,
} from "@workspace/db";
import {
  buildDeterministicShareText,
  getShareCapabilities,
  uploadSessionToStrava,
} from "../engines/share";

const CLERK_ID = "test_share_honesty";

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
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

async function cleanup() {
  await db
    .delete(trainingSessionsTable)
    .where(eq(trainingSessionsTable.clerkId, CLERK_ID));
  await db
    .delete(connectorConnectionsTable)
    .where(eq(connectorConnectionsTable.clerkId, CLERK_ID));
  await db
    .delete(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, CLERK_ID));
}

async function seedSession(source: string) {
  const [row] = await db
    .insert(trainingSessionsTable)
    .values({
      clerkId: CLERK_ID,
      sessionDate: "2026-07-20",
      type: "ride",
      title: "Testrit delen",
      durationMin: 90,
      distanceKm: "45.50",
      source,
    })
    .returning();
  return row!;
}

async function setConnection(scopes: string[] | null) {
  await db
    .delete(connectorConnectionsTable)
    .where(
      and(
        eq(connectorConnectionsTable.clerkId, CLERK_ID),
        eq(connectorConnectionsTable.provider, "strava"),
      ),
    );
  if (scopes == null) return;
  await db.insert(connectorConnectionsTable).values({
    clerkId: CLERK_ID,
    provider: "strava",
    status: "connected",
    scopes,
  });
}

async function main() {
  await cleanup();
  await db.insert(userProfilesTable).values({
    clerkId: CLERK_ID,
    email: "share-honesty@test.local",
    displayName: "Share Honesty",
  });

  const platformSession = await seedSession("strava");
  const ownSession = await seedSession("file");

  await scenario("platform-bron ⇒ duplicaat-reden, geen upload", async () => {
    const caps = await getShareCapabilities(CLERK_ID, platformSession);
    assert(!caps.strava.canUpload, "canUpload had false moeten zijn");
    assert(
      caps.strava.reason?.includes("duplicaat"),
      `verwachtte duplicaat-reden, kreeg: ${caps.strava.reason}`,
    );
  });

  await scenario("geen koppeling ⇒ koppel-reden", async () => {
    await setConnection(null);
    const caps = await getShareCapabilities(CLERK_ID, ownSession);
    assert(!caps.strava.canUpload, "canUpload had false moeten zijn");
    assert(
      caps.strava.reason?.includes("nog niet gekoppeld"),
      `verwachtte koppel-reden, kreeg: ${caps.strava.reason}`,
    );
  });

  await scenario("koppeling zonder activity:write ⇒ opnieuw koppelen", async () => {
    await setConnection(["read", "activity:read_all"]);
    const caps = await getShareCapabilities(CLERK_ID, ownSession);
    assert(!caps.strava.canUpload, "canUpload had false moeten zijn");
    assert(
      caps.strava.reason?.includes("upload-toestemming"),
      `verwachtte scope-reden, kreeg: ${caps.strava.reason}`,
    );
  });

  await scenario("write-scope maar geen echte starttijd ⇒ eerlijke weigering", async () => {
    await setConnection(["read", "activity:read_all", "activity:write"]);
    const caps = await getShareCapabilities(CLERK_ID, ownSession);
    assert(!caps.strava.canUpload, "canUpload had false moeten zijn");
    assert(
      caps.strava.reason?.includes("starttijd"),
      `verwachtte starttijd-reden, kreeg: ${caps.strava.reason}`,
    );
  });

  await scenario("uploadSessionToStrava gooit dezelfde eerlijke reden", async () => {
    let threw = false;
    try {
      await uploadSessionToStrava(CLERK_ID, ownSession, null);
    } catch (err) {
      threw = true;
      assert(
        err instanceof Error && err.message.includes("starttijd"),
        `verwachtte starttijd-fout, kreeg: ${err instanceof Error ? err.message : err}`,
      );
    }
    assert(threw, "upload had moeten weigeren");
  });

  await scenario("deterministische deeltekst bevat alleen echte waarden", () => {
    const text = buildDeterministicShareText(ownSession);
    assert(text.includes("45,5"), `afstand ontbreekt in: ${text}`);
    assert(text.includes("1u30"), `duur ontbreekt in: ${text}`);
    assert(!text.includes("hoogtemeters"), "hoogtemeters is null en mag niet verschijnen");
    assert(!/\bAI\b/.test(text), "geen 'AI' in gebruikersteksten");
  });

  await cleanup();

  let failed = 0;
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(`${r.status === "pass" ? "✓" : "✗"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
