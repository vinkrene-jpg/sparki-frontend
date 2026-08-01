// Besluitenpatch 2026-08-01 (hoofdstuk B) — automatische beëindiging van de
// ouderkoppeling bij 18 jaar, met bericht één week vooraf.
//
// Bewijst tegen de echte dev-database:
//   1. Sporter die binnen een week 18 wordt → sporter én trainer krijgen het
//      week-vooraf-bericht; de koppeling blijft ACTIEF.
//   2. Sporter die al 18 is → koppeling krijgt endedAt (soft-end, historie
//      blijft), ouder en sporter krijgen een eindbericht.
//   3. Onbekende geboortedatum → koppeling blijft volledig ongemoeid (nooit
//      "volwassen raden").
//   4. Idempotentie: een tweede run stuurt géén tweede bericht en beëindigt
//      niets opnieuw.
//
// Run: node ./scripts/run-test.mjs parent-age-transition

import {
  db,
  athleteProfilesTable,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  userProfilesTable,
  notificationsTable,
} from "@workspace/db";
import { and, eq, inArray, like } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import { runParentAgeTransition } from "../lib/parent-age-transition";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
    console.log(`✓ ${name}`);
  } catch (err) {
    results.push({ scenario: name, status: "fail", note: String(err) });
    console.error(`✗ ${name}: ${String(err)}`);
  }
}

const T = "pat18";
const ATHLETE_SOON = `test-${T}-athlete-soon`;
const ATHLETE_ADULT = `test-${T}-athlete-adult`;
const ATHLETE_UNKNOWN = `test-${T}-athlete-unknown`;
const PARENT = `test-${T}-parent`;
const COACH = `test-${T}-coach`;
const ALL = [ATHLETE_SOON, ATHLETE_ADULT, ATHLETE_UNKNOWN, PARENT, COACH];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function seed() {
  for (const id of ALL) {
    await ensureAccount(id, `${id}@example.test`, id, silentLogger);
  }
  const now = new Date();
  // Wordt over 5 dagen 18.
  const soon = new Date(now.getTime() + 5 * 24 * 3600 * 1000);
  const soonBirth = isoDate(
    new Date(Date.UTC(soon.getUTCFullYear() - 18, soon.getUTCMonth(), soon.getUTCDate())),
  );
  // Werd 10 dagen geleden 18.
  const past = new Date(now.getTime() - 10 * 24 * 3600 * 1000);
  const adultBirth = isoDate(
    new Date(Date.UTC(past.getUTCFullYear() - 18, past.getUTCMonth(), past.getUTCDate())),
  );
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: soonBirth })
    .where(eq(athleteProfilesTable.clerkId, ATHLETE_SOON));
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: adultBirth })
    .where(eq(athleteProfilesTable.clerkId, ATHLETE_ADULT));
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: null })
    .where(eq(athleteProfilesTable.clerkId, ATHLETE_UNKNOWN));

  for (const a of [ATHLETE_SOON, ATHLETE_ADULT, ATHLETE_UNKNOWN]) {
    await db
      .insert(parentAthleteLinksTable)
      .values({ parentClerkId: PARENT, athleteClerkId: a, status: "accepted" })
      .onConflictDoNothing();
    await db
      .update(parentAthleteLinksTable)
      .set({ status: "accepted", endedAt: null })
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, PARENT),
          eq(parentAthleteLinksTable.athleteClerkId, a),
        ),
      );
  }
  await db
    .insert(coachAthleteLinksTable)
    .values({ coachClerkId: COACH, athleteClerkId: ATHLETE_SOON, status: "accepted" })
    .onConflictDoNothing();
  await db
    .update(coachAthleteLinksTable)
    .set({ status: "accepted", endedAt: null })
    .where(
      and(
        eq(coachAthleteLinksTable.coachClerkId, COACH),
        eq(coachAthleteLinksTable.athleteClerkId, ATHLETE_SOON),
      ),
    );
}

async function cleanup() {
  await db
    .delete(notificationsTable)
    .where(inArray(notificationsTable.clerkId, ALL));
  await db
    .delete(parentAthleteLinksTable)
    .where(eq(parentAthleteLinksTable.parentClerkId, PARENT));
  await db
    .delete(coachAthleteLinksTable)
    .where(eq(coachAthleteLinksTable.coachClerkId, COACH));
  await db.delete(athleteProfilesTable).where(inArray(athleteProfilesTable.clerkId, ALL));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ALL));
}

async function notif(clerkId: string, keyPrefix: string) {
  return db
    .select({ id: notificationsTable.id, dedupeKey: notificationsTable.dedupeKey })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.clerkId, clerkId),
        like(notificationsTable.dedupeKey, `${keyPrefix}%`),
      ),
    );
}

async function link(athleteClerkId: string) {
  const [row] = await db
    .select()
    .from(parentAthleteLinksTable)
    .where(
      and(
        eq(parentAthleteLinksTable.parentClerkId, PARENT),
        eq(parentAthleteLinksTable.athleteClerkId, athleteClerkId),
      ),
    );
  return row ?? null;
}

async function main() {
  await cleanup();
  await seed();

  const first = await runParentAgeTransition();

  await scenario("bijna-18: week-vooraf-bericht aan sporter én trainer, koppeling blijft actief", async () => {
    const a = await notif(ATHLETE_SOON, "parent-18-notice:athlete:");
    assert(a.length === 1, `verwacht 1 sportermelding, kreeg ${a.length}`);
    const c = await notif(COACH, "parent-18-notice:coach:");
    assert(c.length === 1, `verwacht 1 trainermelding, kreeg ${c.length}`);
    const l = await link(ATHLETE_SOON);
    assert(l && l.endedAt == null, "koppeling mag NIET beëindigd zijn vóór de verjaardag");
  });

  await scenario("al 18: koppeling soft-beëindigd + eindberichten aan ouder en sporter", async () => {
    const l = await link(ATHLETE_ADULT);
    assert(l, "koppelingsrij moet blijven bestaan (historie)");
    assert(l!.endedAt != null, "endedAt moet gezet zijn");
    const p = await notif(PARENT, "parent-18-ended:parent:");
    assert(p.length === 1, `verwacht 1 oudermelding, kreeg ${p.length}`);
    const a = await notif(ATHLETE_ADULT, "parent-18-ended:athlete:");
    assert(a.length === 1, `verwacht 1 sportermelding, kreeg ${a.length}`);
  });

  await scenario("onbekende geboortedatum: koppeling volledig ongemoeid", async () => {
    const l = await link(ATHLETE_UNKNOWN);
    assert(l && l.endedAt == null && l.status === "accepted", "koppeling moet actief blijven");
    const rows = await db
      .select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(eq(notificationsTable.clerkId, ATHLETE_UNKNOWN));
    assert(rows.length === 0, "geen meldingen bij onbekende leeftijd");
  });

  await scenario("idempotent: tweede run stuurt niets opnieuw en beëindigt niets dubbel", async () => {
    const second = await runParentAgeTransition();
    assert(second.noticesSent === 0, `tweede run stuurde ${second.noticesSent} berichten`);
    assert(second.linksEnded === 0, `tweede run beëindigde ${second.linksEnded} koppelingen`);
    const a = await notif(ATHLETE_SOON, "parent-18-notice:athlete:");
    assert(a.length === 1, "nog steeds precies 1 sportermelding");
  });

  await scenario("eerste run telde eerlijk", () => {
    assert(first.linksEnded === 1, `verwacht 1 beëindigde koppeling, kreeg ${first.linksEnded}`);
    assert(first.noticesSent >= 2, `verwacht ≥2 berichten, kreeg ${first.noticesSent}`);
  });

  await cleanup();

  const failed = results.filter((r) => r.status === "fail");
  console.log(`\n${results.length - failed.length}/${results.length} passed, ${failed.length} failed.`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
