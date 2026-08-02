// HERSTEL_EN_AANVULLING_01 F7 (HA-28…HA-30) — bewijs betaler ≠ gebruiker:
// • club biedt per lid aan; lid accepteert → actief;
// • lid weigert → geweigerd (telt als zelf opzeggen);
// • jeugdlid + club betaalt: zonder oudertoestemming 409 (fail-closed),
//   mét toestemming activeerbaar;
// • ouder betaalt gekoppeld jeugdlid direct;
// • club-samenvatting bevat UITSLUITEND aantallen (nooit namen) + staffel;
// • dubbele dekking per sporter is 409 (partial unique index).
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  clubsTable,
  clubMembersTable,
  parentAthleteLinksTable,
  subscriptionPayerArrangementsTable,
} from "@workspace/db";
import { eq, like } from "drizzle-orm";
import app from "../app";

process.env["DEV_AUTH_BYPASS"] = "true";

const PREFIX = "payer-test-";
const ids = {
  owner: `${PREFIX}owner`,
  lid: `${PREFIX}lid`,
  jeugd: `${PREFIX}jeugd`,
  ouder: `${PREFIX}ouder`,
  jeugd2: `${PREFIX}jeugd2`,
};

async function cleanup() {
  await db
    .delete(subscriptionPayerArrangementsTable)
    .where(like(subscriptionPayerArrangementsTable.athleteClerkId, `${PREFIX}%`));
  const clubs = await db.select({ id: clubsTable.id }).from(clubsTable).where(eq(clubsTable.name, "Payer-test club"));
  for (const c of clubs) await db.delete(clubsTable).where(eq(clubsTable.id, c.id));
  await db.delete(userProfilesTable).where(like(userProfilesTable.clerkId, `${PREFIX}%`));
}

async function main() {
  await cleanup();
  for (const [k, id] of Object.entries(ids)) {
    await db
      .insert(userProfilesTable)
      .values({ clerkId: id, email: `${id}@payer-test.invalid`, displayName: `Payer ${k}`, releaseGroup: "test" })
      .onConflictDoNothing();
  }
  // Volwassen lid: expliciete geboortedatum — onbekende leeftijd clampt
  // (terecht, fail-closed) naar minderjarig en zou consent eisen.
  await db
    .insert(athleteProfilesTable)
    .values({ clerkId: ids.lid, birthDate: "1990-05-01" })
    .onConflictDoNothing();
  // Jeugdleden: volledige geboortedatum ⇒ minderjarig (14 jaar).
  for (const j of [ids.jeugd, ids.jeugd2]) {
    await db
      .insert(athleteProfilesTable)
      .values({ clerkId: j, birthDate: "2012-03-15" })
      .onConflictDoNothing();
  }
  const [club] = await db
    .insert(clubsTable)
    .values({ name: "Payer-test club", ownerClerkId: ids.owner, status: "actief" })
    .returning({ id: clubsTable.id });
  const clubId = club!.id;
  await db.insert(clubMembersTable).values([
    { clubId, clerkId: ids.owner, role: "owner" },
    { clubId, clerkId: ids.lid, role: "member" },
    { clubId, clerkId: ids.jeugd, role: "member" },
  ]);
  await db.insert(parentAthleteLinksTable).values({
    parentClerkId: ids.ouder,
    athleteClerkId: ids.jeugd,
    status: "active",
  });
  await db.insert(parentAthleteLinksTable).values({
    parentClerkId: ids.ouder,
    athleteClerkId: ids.jeugd2,
    status: "active",
  });

  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const api = (method: string, pad: string, als: string, body?: unknown) =>
    fetch(`http://127.0.0.1:${port}/api/billing/payers${pad}`, {
      method,
      headers: { "content-type": "application/json", "x-dev-clerk-id": als },
      body: body ? JSON.stringify(body) : undefined,
    });

  let ok = 0;
  const test = async (naam: string, fn: () => Promise<void>) => {
    await fn();
    ok++;
    console.log(`✓ ${naam}`);
  };

  await test("club biedt per lid aan; lid accepteert → actief", async () => {
    const aanbod = await api("POST", `/clubs/${clubId}/coverage`, ids.owner, { clerkId: ids.lid, tier: "GO" });
    assert.equal(aanbod.status, 201);
    const mijn = await api("GET", "/me", ids.lid);
    const { arrangements } = (await mijn.json()) as { arrangements: { id: number; status: string }[] };
    assert.equal(arrangements.length, 1);
    const acc = await api("POST", `/me/${arrangements[0]!.id}/accept`, ids.lid);
    assert.equal(acc.status, 200);
  });

  await test("dubbele dekking voor dezelfde sporter is 409", async () => {
    const r = await api("POST", `/clubs/${clubId}/coverage`, ids.owner, { clerkId: ids.lid, tier: "COMPLETE" });
    assert.equal(r.status, 409);
  });

  let jeugdArrangementId = 0;
  await test("jeugdlid: accepteren zonder oudertoestemming is 409 (fail-closed)", async () => {
    const aanbod = await api("POST", `/clubs/${clubId}/coverage`, ids.owner, { clerkId: ids.jeugd, tier: "GO" });
    assert.equal(aanbod.status, 201);
    const mijn = await api("GET", "/me", ids.jeugd);
    const { arrangements } = (await mijn.json()) as { arrangements: { id: number; parentConsentRequired: boolean }[] };
    assert.equal(arrangements[0]!.parentConsentRequired, true, "jeugdlid moet consent-verplicht zijn");
    jeugdArrangementId = arrangements[0]!.id;
    const acc = await api("POST", `/me/${jeugdArrangementId}/accept`, ids.jeugd);
    assert.equal(acc.status, 409);
  });

  await test("mét oudertoestemming wél activeerbaar", async () => {
    const consent = await api("POST", `/parent/consent/${jeugdArrangementId}`, ids.ouder);
    assert.equal(consent.status, 200);
    const acc = await api("POST", `/me/${jeugdArrangementId}/accept`, ids.jeugd);
    assert.equal(acc.status, 200);
  });

  await test("weigeren telt als zelf opzeggen (geweigerd + reden)", async () => {
    // Nieuw aanbod voor jeugd2 kan niet (geen clublid) — weiger-pad testen we
    // op een vers aanbod aan het gewone lid nadat de actieve dekking is
    // beëindigd; simpeler: direct arrangement voor jeugd2 via ouder is actief,
    // dus we testen weigeren met een tweede clublid-scenario: eerst de
    // actieve dekking van 'lid' beëindigen.
    await db
      .update(subscriptionPayerArrangementsTable)
      .set({ status: "beeindigd", endedAt: new Date() })
      .where(eq(subscriptionPayerArrangementsTable.athleteClerkId, ids.lid));
    const aanbod = await api("POST", `/clubs/${clubId}/coverage`, ids.owner, { clerkId: ids.lid, tier: "GO" });
    assert.equal(aanbod.status, 201);
    const mijn = await api("GET", "/me", ids.lid);
    const { arrangements } = (await mijn.json()) as { arrangements: { id: number; status: string }[] };
    const open = arrangements.find((a) => a.status === "aangeboden")!;
    const r = await api("POST", `/me/${open.id}/decline`, ids.lid);
    assert.equal(r.status, 200);
    const [rij] = await db
      .select()
      .from(subscriptionPayerArrangementsTable)
      .where(eq(subscriptionPayerArrangementsTable.id, open.id));
    assert.equal(rij!.status, "geweigerd");
    assert.equal(rij!.endedReason, "geweigerd_door_lid");
  });

  await test("ouder betaalt gekoppeld jeugdlid direct (combinatie 3)", async () => {
    const r = await api("POST", "/parent/coverage", ids.ouder, { athleteClerkId: ids.jeugd2, tier: "GO" });
    assert.equal(r.status, 201);
    const nee = await api("POST", "/parent/coverage", ids.lid, { athleteClerkId: ids.jeugd2, tier: "GO" });
    assert.equal(nee.status, 403, "niet-gekoppelde betaler moet 403 krijgen");
  });

  await test("club ziet uitsluitend aantallen + staffel (HA-30)", async () => {
    const r = await api("GET", `/clubs/${clubId}/coverage/summary`, ids.owner);
    assert.equal(r.status, 200);
    const body = (await r.json()) as {
      aantallen: Record<string, number>;
      facturatie: { interval: string; staffelKortingPct: number };
    };
    const tekst = JSON.stringify(body);
    assert.ok(!tekst.includes(ids.lid) && !tekst.includes(ids.jeugd), "geen namen/ids in de samenvatting");
    assert.equal(body.aantallen["actief"], 1); // jeugd actief; lid beëindigd+geweigerd
    assert.equal(body.aantallen["geweigerd"], 1);
    assert.equal(body.facturatie.interval, "maand");
    assert.equal(typeof body.facturatie.staffelKortingPct, "number");
    const lid = await api("GET", `/clubs/${clubId}/coverage/summary`, ids.lid);
    assert.equal(lid.status, 403, "gewoon lid ziet de clubsamenvatting niet");
  });

  server.close();
  await cleanup();
  await pool.end();
  console.log(`Alle ${ok} betalerstests geslaagd.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
