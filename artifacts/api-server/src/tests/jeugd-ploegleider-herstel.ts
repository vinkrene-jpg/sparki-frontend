// JEUGD_EN_PLOEGLEIDER_HERSTEL_01 — bewijstest (faalt op de oude code).
//
// Deel 1: geboortedatum verplicht in missing-data (birthYear telt als aanwezig).
// Deel 2: nutrition_photo/nutrition_text hard geblokkeerd voor jeugd/onbekend;
//         brief/ask blijven gewoon werken voor jeugd.
// Deel 3: gewichtssturing vanaf 18 (17 → fail-closed null); voeding los ervan.
// Deel 4: overrule van de teammanager kan door NIEMAND behalve de teammanager
//         worden teruggedraaid — ook niet door de vervanger op deputyClerkId.
//
// Run: `node ./scripts/run-test.mjs jeugd-ploegleider-herstel`
// Deel 4 praat met de draaiende dev-API op poort 8080 (x-dev-clerk-id).

import { eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  privacySettingsTable,
  clubsTable,
  clubMembersTable,
  clubRaceEventsTable,
  clubRaceSelectionsTable,
} from "@workspace/db";
import { getMissingOnboardingData } from "../lib/connectors/missing-data";
import {
  aiMessage,
  AiBlockedError,
  __setAiTransportForTests,
} from "../lib/ai/gateway";
import {
  SEASON_GOAL_MIN_AGE,
  seasonGoalIneligible,
  loadSeasonGoalSteering,
} from "../lib/season-goal";

const API = process.env.TEST_API_BASE ?? "http://localhost:8080";

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

const PREFIX = "jph01-test-";
const U = {
  noBirth: `${PREFIX}nobirth`,
  yearOnly: `${PREFIX}yearonly`,
  minor: `${PREFIX}minor`,
  seventeen: `${PREFIX}seventeen`,
  adult: `${PREFIX}adult`,
  teammanager: `${PREFIX}tm`,
  ploegleider: `${PREFIX}pl`,
  deputy: `${PREFIX}deputy`,
  renner: `${PREFIX}renner`,
};

async function seedUser(clerkId: string, birth?: { date?: string; year?: number }) {
  await db
    .insert(userProfilesTable)
    .values({ clerkId, email: `${clerkId}@example.test`, displayName: clerkId })
    .onConflictDoNothing();
  await db
    .insert(athleteProfilesTable)
    .values({
      clerkId,
      birthDate: birth?.date ?? null,
      birthYear: birth?.year ?? null,
    })
    .onConflictDoUpdate({
      target: athleteProfilesTable.clerkId,
      set: { birthDate: birth?.date ?? null, birthYear: birth?.year ?? null },
    });
}

async function grantAiConsent(clerkId: string) {
  await db
    .insert(privacySettingsTable)
    .values({
      clerkId,
      aiCoachingEnabled: true,
      aiHealthAnalysisEnabled: true,
      aiVisionEnabled: true,
    } as never)
    .onConflictDoUpdate({
      target: privacySettingsTable.clerkId,
      set: {
        aiCoachingEnabled: true,
        aiHealthAnalysisEnabled: true,
        aiVisionEnabled: true,
      } as never,
    });
}

async function cleanup() {
  const ids = Object.values(U);
  await db.delete(clubRaceSelectionsTable).where(
    inArray(clubRaceSelectionsTable.clerkId, ids),
  );
  const clubs = await db
    .select({ id: clubsTable.id })
    .from(clubsTable)
    .where(eq(clubsTable.ownerClerkId, U.teammanager));
  for (const c of clubs) {
    await db.delete(clubRaceEventsTable).where(eq(clubRaceEventsTable.clubId, c.id));
    await db.delete(clubMembersTable).where(eq(clubMembersTable.clubId, c.id));
    await db.delete(clubsTable).where(eq(clubsTable.id, c.id));
  }
  await db.delete(privacySettingsTable).where(inArray(privacySettingsTable.clerkId, ids));
  await db.delete(athleteProfilesTable).where(inArray(athleteProfilesTable.clerkId, ids));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ids));
}

async function main() {
  await cleanup();

  const nowYear = new Date().getFullYear();

  // ── Deel 1: geboortedatum in missing-data ──────────────────────────────────
  await scenario("1a. zonder geboortedatum → birthDate in missing", async () => {
    await seedUser(U.noBirth);
    const r = await getMissingOnboardingData(U.noBirth);
    assert(
      r.missing.some((f) => f.key === "birthDate"),
      "birthDate ontbreekt in missing-lijst",
    );
    const spec = r.missing.find((f) => f.key === "birthDate")!;
    assert(spec.type === "date" && spec.label === "Geboortedatum", "spec klopt niet");
  });

  await scenario("1b. alleen birthYear → NIET opnieuw gevraagd", async () => {
    await seedUser(U.yearOnly, { year: nowYear - 30 });
    const r = await getMissingOnboardingData(U.yearOnly);
    assert(
      !r.missing.some((f) => f.key === "birthDate"),
      "birthYear-account krijgt het veld tóch voorgelegd",
    );
  });

  await scenario("1c. na invullen birthDate verdwijnt het veld", async () => {
    await seedUser(U.noBirth, { date: `${nowYear - 30}-05-15`, year: nowYear - 30 });
    const r = await getMissingOnboardingData(U.noBirth);
    assert(!r.missing.some((f) => f.key === "birthDate"), "veld blijft in missing");
  });

  await scenario("1d. schrijfpad weigert toekomst-/onzin-datum, accepteert echte", async () => {
    await seedUser(U.yearOnly); // reset: helemaal leeg
    const post = (birthDate: string) =>
      fetch(`${API}/api/onboarding/missing-data`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-dev-clerk-id": U.yearOnly },
        body: JSON.stringify({ values: { birthDate } }),
      });
    const future = `${nowYear + 1}-01-15`;
    for (const bad of [future, "2001-02-30", "geen-datum", "1850-01-01"]) {
      const r = await post(bad);
      assert(r.ok, `POST met ongeldige datum gaf ${r.status}`);
      const [row] = await db
        .select({ birthDate: athleteProfilesTable.birthDate })
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, U.yearOnly));
      assert(row?.birthDate == null, `ongeldige datum "${bad}" werd tóch opgeslagen`);
    }
    const good = `${nowYear - 30}-05-15`;
    const r = await post(good);
    assert(r.ok, `POST met geldige datum gaf ${r.status}`);
    const [row] = await db
      .select({
        birthDate: athleteProfilesTable.birthDate,
        birthYear: athleteProfilesTable.birthYear,
      })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, U.yearOnly));
    assert(row?.birthDate === good, "geldige datum niet opgeslagen");
    assert(row?.birthYear === nowYear - 30, "birthYear niet afgeleid uit de datum");
  });

  // ── Deel 2: jeugdblokkade op de twee gevoelige AI-doelen ──────────────────
  __setAiTransportForTests(async () => ({ text: "testantwoord" }) as never);

  await scenario("2a. minderjarige → nutrition_photo geweigerd", async () => {
    await seedUser(U.minor, { year: nowYear - 15 });
    await grantAiConsent(U.minor);
    try {
      await aiMessage("nutrition_photo", U.minor, {
        system: "t",
        messages: [{ role: "user", content: "t" }],
      } as never);
      assert(false, "nutrition_photo werd NIET geweigerd voor een minderjarige");
    } catch (err) {
      assert(err instanceof AiBlockedError, `verkeerd fouttype: ${err}`);
      assert((err as AiBlockedError).message.length > 10, "geen leesbare melding");
    }
  });

  await scenario("2b. minderjarige → nutrition_text geweigerd", async () => {
    try {
      await aiMessage("nutrition_text", U.minor, {
        system: "t",
        messages: [{ role: "user", content: "t" }],
      } as never);
      assert(false, "nutrition_text werd NIET geweigerd voor een minderjarige");
    } catch (err) {
      assert(err instanceof AiBlockedError, `verkeerd fouttype: ${err}`);
    }
  });

  await scenario("2c. minderjarige → brief en ask werken gewoon", async () => {
    for (const purpose of ["brief", "ask"] as const) {
      const out = await aiMessage(purpose, U.minor, {
        system: "t",
        messages: [{ role: "user", content: "t" }],
      } as never);
      assert(out != null, `${purpose} weigert een minderjarige ten onrechte`);
    }
  });

  await scenario("2d. onbekende leeftijd → melding verwijst naar profiel", async () => {
    await seedUser(U.noBirth); // reset: geen geboortedatum
    await grantAiConsent(U.noBirth);
    try {
      await aiMessage("nutrition_text", U.noBirth, {
        system: "t",
        messages: [{ role: "user", content: "t" }],
      } as never);
      assert(false, "onbekende leeftijd werd NIET geweigerd");
    } catch (err) {
      assert(err instanceof AiBlockedError, `verkeerd fouttype: ${err}`);
      assert(
        /geboortedatum/i.test((err as AiBlockedError).message),
        `melding verwijst niet naar de geboortedatum: ${(err as AiBlockedError).message}`,
      );
    }
  });

  // ── Deel 3: gewichtssturing 17 → 18 ────────────────────────────────────────
  await scenario("3a. grens staat op 18", () => {
    assert(SEASON_GOAL_MIN_AGE === 18, `grens is ${SEASON_GOAL_MIN_AGE}, verwacht 18`);
    assert(seasonGoalIneligible(17) != null, "17 wordt niet geweigerd");
    assert(seasonGoalIneligible(18) == null, "18 wordt ten onrechte geweigerd");
    assert(/18/.test(seasonGoalIneligible(17)!.message), "weigertekst noemt de grens niet");
    assert(/18/.test(seasonGoalIneligible(null)!.message), "onbekend-tekst noemt de grens niet");
  });

  await scenario("3b. 17-jarige met streefgewicht → steering null", async () => {
    await seedUser(U.seventeen, { year: nowYear - 17 });
    // Bewust een doelrij aanwezig laten zijn: de poort moet hem negeren.
    const { nutritionSeasonGoalsTable } = await import("@workspace/db");
    await db
      .insert(nutritionSeasonGoalsTable)
      .values({
        clerkId: U.seventeen,
        targetWeightKg: "62.0",
        seasonStartDate: `${nowYear + 1}-03-01`,
      } as never)
      .onConflictDoNothing();
    const steering = await loadSeasonGoalSteering(U.seventeen);
    assert(steering == null, "17-jarige krijgt tóch gewichtssturing");
    await db
      .delete(nutritionSeasonGoalsTable)
      .where(eq(nutritionSeasonGoalsTable.clerkId, U.seventeen));
  });

  await scenario("3c. 18-jarige met streefgewicht → steering werkt", async () => {
    await seedUser(U.adult, { year: nowYear - 19 });
    await db
      .update(athleteProfilesTable)
      .set({ weightKg: "70.0" })
      .where(eq(athleteProfilesTable.clerkId, U.adult));
    const { nutritionSeasonGoalsTable } = await import("@workspace/db");
    await db
      .insert(nutritionSeasonGoalsTable)
      .values({
        clerkId: U.adult,
        targetWeightKg: "67.0",
        seasonStartDate: `${nowYear + 1}-03-01`,
      } as never)
      .onConflictDoNothing();
    const steering = await loadSeasonGoalSteering(U.adult);
    assert(steering != null, "18+ krijgt geen gewichtssturing meer");
    await db
      .delete(nutritionSeasonGoalsTable)
      .where(eq(nutritionSeasonGoalsTable.clerkId, U.adult));
  });

  // ── Deel 4: overrule-terugdraai alleen door de teammanager ─────────────────
  let clubId = 0;
  let eventId = 0;
  await scenario("4-setup. club + wedstrijd + vastgezette selectie", async () => {
    for (const id of [U.teammanager, U.ploegleider, U.deputy, U.renner]) {
      await seedUser(id, { year: nowYear - 30 });
    }
    const [club] = await db
      .insert(clubsTable)
      .values({ name: `JPH01 testclub ${Date.now()}`, ownerClerkId: U.teammanager })
      .returning();
    clubId = club.id;
    await db.insert(clubMembersTable).values([
      { clubId, clerkId: U.teammanager, role: "teammanager" },
      { clubId, clerkId: U.ploegleider, role: "ploegleider" },
      { clubId, clerkId: U.deputy, role: "mechanieker" },
      { clubId, clerkId: U.renner, role: "member" },
    ]);
    const [event] = await db
      .insert(clubRaceEventsTable)
      .values({
        clubId,
        name: "JPH01 testwedstrijd",
        raceDate: `${nowYear + 1}-04-01`,
        createdByClerkId: U.teammanager,
        deputyClerkId: U.deputy,
      })
      .returning();
    eventId = event.id;
    await db.insert(clubRaceSelectionsTable).values({
      eventId,
      clerkId: U.renner,
      role: "renner",
      selectedByClerkId: U.teammanager,
      selectedByRole: "teammanager",
      overruledAt: new Date(),
      overruledByClerkId: U.teammanager,
    });
  });

  const del = (asUser: string) =>
    fetch(`${API}/api/clubs/${clubId}/races/${eventId}/selection/${U.renner}`, {
      method: "DELETE",
      headers: { "x-dev-clerk-id": asUser },
    });

  await scenario("4a. vervanger (andere clubrol) → 403", async () => {
    const r = await del(U.deputy);
    assert(r.status === 403, `vervanger kreeg ${r.status}, verwacht 403`);
    const body = (await r.json()) as { error?: string };
    assert(
      body.error != null && !/door de ploegleider/.test(body.error),
      "foutmelding noemt nog uitsluitend de ploegleider",
    );
  });

  await scenario("4b. ploegleider → 403 (bestaande blokkade intact)", async () => {
    const r = await del(U.ploegleider);
    assert(r.status === 403, `ploegleider kreeg ${r.status}, verwacht 403`);
  });

  await scenario("4c. teammanager zelf → toegestaan", async () => {
    const r = await del(U.teammanager);
    assert(r.ok, `teammanager kreeg ${r.status}, verwacht 2xx`);
  });

  await cleanup();

  let failed = 0;
  for (const r of results) {
    if (r.status === "fail") failed++;
    console.log(`${r.status === "pass" ? "✔" : "✖"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} geslaagd`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Testrun stukgelopen:", err);
  try {
    await cleanup();
  } catch {}
  await pool.end();
  process.exit(1);
});
