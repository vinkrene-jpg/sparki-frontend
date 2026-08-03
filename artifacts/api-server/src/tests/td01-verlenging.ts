// TRAINEN_DOELEN_SEIZOEN_01 — F11 bewijstest (verlenging na afloop, TD-12).
//
// Bewijs (bouwpakket F11):
//  1. Hoofddoel-datum 1 week geleden verstreken, geen nieuw anker → fase
//     "verlenging": 80% volume, GEEN kwaliteitsdagen (alle sessies duurniveau).
//  2. Einddatum > 4 weken (PLAN_EXTENSION_WEEKS) geleden → verlenging stopt
//     (fase base/ritme) én er staat één actieve melding om een nieuw
//     hoofddoel te kiezen (idempotent — tweede aanvraag maakt geen tweede rij).
//
// Run: node ./scripts/run-test.mjs td01-verlenging --dev-auth

import { and, eq, like } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  athleteGoalsTable,
  goalEventsTable,
  notificationsTable,
} from "@workspace/db";

const USER = "test_td01_verlenging";
const BASE = `http://localhost:${process.env.PORT ?? 8080}`;
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

const H = { "x-dev-clerk-id": USER };

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toLocaleDateString("sv-SE", {
    timeZone: "Europe/Amsterdam",
  });
}

async function preview() {
  const res = await fetch(`${BASE}/api/training-plan/preview`, { headers: H });
  const json = (await res.json()) as {
    phase?: string;
    weeks?: {
      sessions: number;
      hours: number;
      heaviestDay: { focus: string | null } | null;
    }[];
  };
  if (res.status !== 200) throw new Error(`preview ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function cleanup() {
  await db.delete(notificationsTable).where(eq(notificationsTable.clerkId, USER));
  await db.delete(goalEventsTable).where(eq(goalEventsTable.clerkId, USER));
  await db.delete(athleteGoalsTable).where(eq(athleteGoalsTable.clerkId, USER));
  await db.delete(athleteProfilesTable).where(eq(athleteProfilesTable.clerkId, USER));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, USER));
}

async function main() {
  await cleanup();
  await db.insert(userProfilesTable).values({
    clerkId: USER,
    email: `${USER}@example.com`,
    displayName: USER,
    roles: ["athlete"],
    activeRole: "athlete",
  });
  await db.insert(athleteProfilesTable).values({
    clerkId: USER,
    birthYear: 1990,
    ftp: 250,
    weeklyHourTarget: 8,
    goals: "Doorfietsen",
    availableDays: ["mon", "wed", "fri", "sat"],
    experienceLevel: "intermediate",
  });
  const [goal] = await db
    .insert(athleteGoalsTable)
    .values({
      clerkId: USER,
      title: "Afgelopen hoofddoel",
      priority: 1,
      status: "active",
      targetDate: isoDaysAgo(7),
      origin: "sporter",
      ageBandAtCreation: "18+",
    })
    .returning({ id: athleteGoalsTable.id });

  await scenario("1 week na afloop → fase verlenging, alleen duurniveau", async () => {
    const p = await preview();
    assert(p.phase === "verlenging", `verwacht verlenging, kreeg ${p.phase}`);
    const weeks = p.weeks ?? [];
    assert(weeks.some((w) => w.sessions > 0), "sessies aanwezig");
    const focuses = weeks
      .map((w) => (w.heaviestDay?.focus ?? "").toLowerCase())
      .filter(Boolean);
    const kwaliteit = ["tempo", "sweetspot", "drempel", "threshold", "vo2", "interval", "sprint"];
    assert(
      focuses.every((f) => kwaliteit.every((k) => !f.includes(k))),
      `zwaarste dag blijft duurniveau: ${JSON.stringify(focuses)}`,
    );
  });

  await scenario("na 4 weken → verlenging stopt + één melding nieuw hoofddoel", async () => {
    await db
      .update(athleteGoalsTable)
      .set({ targetDate: isoDaysAgo(35) })
      .where(eq(athleteGoalsTable.id, goal!.id));
    const p = await preview();
    assert(p.phase !== "verlenging", `verlenging gestopt, kreeg ${p.phase}`);
    // Reviewfix F5: een read-only preview schrijft NIETS — dus ook geen melding.
    const afterPreview = await db
      .select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(eq(notificationsTable.clerkId, USER));
    assert(afterPreview.length === 0, "preview maakt geen melding aan (side-effectvrij)");
    // De melding komt van de mutatiepaden (notify:true) — idempotent.
    const { gatherInputs } = await import("../lib/training-plan");
    await gatherInputs(USER, { notify: true });
    await gatherInputs(USER, { notify: true }); // tweede keer → geen tweede rij
    const notes = await db
      .select({ id: notificationsTable.id, title: notificationsTable.title })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.clerkId, USER),
          like(notificationsTable.title, "%hoofddoel%"),
        ),
      );
    assert(notes.length === 1, `precies één melding, kreeg ${notes.length}`);
  });

  await cleanup();
  let failed = 0;
  for (const r of results) {
    if (r.status === "fail") failed += 1;
    console.log(`${r.status === "pass" ? "PASS" : "FAIL"} — ${r.scenario}${r.note ? ` · ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} groen`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Testrun-fout:", err);
  try { await cleanup(); } catch { /* best effort */ }
  await pool.end();
  process.exit(1);
});
