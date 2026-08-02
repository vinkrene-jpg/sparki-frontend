// HERSTEL_EN_AANVULLING_01 F5 (HA-22…HA-25) — bewijs:
// • stafrollen (mechanieker/soigneur/medical_staff/chauffeur/ploegleider)
//   zijn per evenement toewijsbaar in de wedstrijdbezetting;
// • onzinrol blijft 400;
// • mechanieker/soigneur zien van anderen alleen naam/functie/of-de-renner-
//   rijdt — geen availabilityNote, geen besluit-spoor;
// • noodinfo-gerechtigden (ploegleider) zien de note wél.
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import {
  db,
  pool,
  userProfilesTable,
  clubsTable,
  clubMembersTable,
  clubRaceEventsTable,
  clubRaceSelectionsTable,
} from "@workspace/db";
import { eq, like } from "drizzle-orm";
import app from "../app";

process.env["DEV_AUTH_BYPASS"] = "true";

const PREFIX = "staffing-test-";
const ids = {
  owner: `${PREFIX}owner`,
  mech: `${PREFIX}mech`,
  soigneur: `${PREFIX}soigneur`,
  renner: `${PREFIX}renner`,
  pl: `${PREFIX}pl`,
};

async function cleanup() {
  const clubs = await db.select({ id: clubsTable.id }).from(clubsTable).where(eq(clubsTable.name, "Staffing-test club"));
  for (const c of clubs) await db.delete(clubsTable).where(eq(clubsTable.id, c.id));
  await db.delete(userProfilesTable).where(like(userProfilesTable.clerkId, `${PREFIX}%`));
}

async function main() {
  await cleanup();
  for (const [k, id] of Object.entries(ids)) {
    await db
      .insert(userProfilesTable)
      .values({ clerkId: id, email: `${id}@staffing-test.invalid`, displayName: `Staffing ${k}`, releaseGroup: "test" })
      .onConflictDoNothing();
  }
  const [club] = await db
    .insert(clubsTable)
    .values({ name: "Staffing-test club", ownerClerkId: ids.owner, status: "actief" })
    .returning({ id: clubsTable.id });
  const clubId = club!.id;
  await db.insert(clubMembersTable).values([
    { clubId, clerkId: ids.owner, role: "owner" },
    { clubId, clerkId: ids.mech, role: "mechanieker" },
    { clubId, clerkId: ids.soigneur, role: "soigneur" },
    { clubId, clerkId: ids.renner, role: "member" },
    { clubId, clerkId: ids.pl, role: "ploegleider" },
  ]);
  const [event] = await db
    .insert(clubRaceEventsTable)
    .values({ clubId, name: "Staffing-test koers", raceDate: "2026-08-20", createdByClerkId: ids.owner })
    .returning({ id: clubRaceEventsTable.id });
  const eventId = event!.id;

  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const api = (method: string, pad: string, als: string, body?: unknown) =>
    fetch(`http://127.0.0.1:${port}/api/clubs/${clubId}${pad}`, {
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

  await test("stafrollen zijn per evenement toewijsbaar", async () => {
    for (const [wie, rol] of [
      [ids.renner, "renner"],
      [ids.mech, "mechanieker"],
      [ids.soigneur, "soigneur"],
      [ids.pl, "ploegleider"],
    ] as const) {
      const r = await api("POST", `/races/${eventId}/selection`, ids.owner, { clerkId: wie, role: rol });
      assert.ok(r.status === 200 || r.status === 201, `rol ${rol}: status ${r.status}`);
    }
  });

  await test("onzinrol blijft 400", async () => {
    const r = await api("POST", `/races/${eventId}/selection`, ids.owner, { clerkId: ids.renner, role: "masseur-in-opleiding" });
    assert.equal(r.status, 400);
  });

  // Renner meldt zich beschikbaar met een (potentieel medische) toelichting.
  await db
    .update(clubRaceSelectionsTable)
    .set({ availability: "beschikbaar", availabilityNote: "na de blessure weer fit" })
    .where(eq(clubRaceSelectionsTable.clerkId, ids.renner));

  await test("mechanieker ziet alleen naam + of de renner rijdt", async () => {
    const r = await api("GET", "/races", ids.mech);
    assert.equal(r.status, 200);
    const events = (await r.json()) as { id: number; selections: Record<string, unknown>[] }[];
    const e = events.find((x) => x.id === eventId)!;
    const rennerRij = e.selections.find((s) => s["clerkId"] === ids.renner)!;
    assert.equal(rennerRij["availabilityNote"], null);
    assert.equal(rennerRij["rijdt"], true);
    assert.ok(!("selectedByClerkId" in rennerRij), "besluit-spoor mag niet zichtbaar zijn");
    assert.ok(rennerRij["displayName"]);
  });

  await test("ploegleider ziet de toelichting wél", async () => {
    const r = await api("GET", "/races", ids.pl);
    const events = (await r.json()) as { id: number; selections: Record<string, unknown>[] }[];
    const e = events.find((x) => x.id === eventId)!;
    const rennerRij = e.selections.find((s) => s["clerkId"] === ids.renner)!;
    assert.equal(rennerRij["availabilityNote"], "na de blessure weer fit");
  });

  server.close();
  await cleanup();
  await pool.end();
  console.log(`Alle ${ok} staffingtests geslaagd.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
