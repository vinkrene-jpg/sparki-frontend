// HERSTEL_EN_AANVULLING_01 F4 — bewijs: de drie eerste rapporttypen (RT-12
// dagschema, RT-13 bezetting, RT-14 materiaallijst) komen als echte PDF uit
// de ÉNE generator; rechtenpoorten blijven CLUB_RECHTEN_01; versienummer
// loopt per uitgifte op.
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
  clubRaceDayScheduleTable,
  clubRaceVehiclesTable,
  clubRaceMaterialItemsTable,
  clubRaceDocumentIssuesTable,
} from "@workspace/db";
import { eq, like } from "drizzle-orm";
import app from "../app";

process.env["DEV_AUTH_BYPASS"] = "true";

const PREFIX = "doc-test-";
const ids = {
  owner: `${PREFIX}owner`,
  ploegleider: `${PREFIX}pl`,
  renner: `${PREFIX}renner`,
  buitenstaander: `${PREFIX}buiten`,
};

async function ensureAccount(clerkId: string, name: string) {
  await db
    .insert(userProfilesTable)
    .values({ clerkId, email: `${clerkId}@doc-test.invalid`, displayName: name, releaseGroup: "test" })
    .onConflictDoNothing();
}

async function cleanup() {
  const clubs = await db.select({ id: clubsTable.id }).from(clubsTable).where(eq(clubsTable.name, "Doc-test club"));
  for (const c of clubs) await db.delete(clubsTable).where(eq(clubsTable.id, c.id));
  await db.delete(userProfilesTable).where(like(userProfilesTable.clerkId, `${PREFIX}%`));
}

async function main() {
  await cleanup();
  for (const [k, id] of Object.entries(ids)) await ensureAccount(id, `Doc Test ${k}`);

  const [club] = await db
    .insert(clubsTable)
    .values({ name: "Doc-test club", ownerClerkId: ids.owner, status: "actief" })
    .returning({ id: clubsTable.id });
  const clubId = club!.id;
  await db.insert(clubMembersTable).values([
    { clubId, clerkId: ids.owner, role: "owner" },
    { clubId, clerkId: ids.ploegleider, role: "ploegleider" },
    { clubId, clerkId: ids.renner, role: "member" },
  ]);
  const [event] = await db
    .insert(clubRaceEventsTable)
    .values({ clubId, name: "Doc-test koers", raceDate: "2026-08-15", meetPoint: "Clubhuis", meetTime: "07:30", createdByClerkId: ids.owner })
    .returning({ id: clubRaceEventsTable.id });
  const eventId = event!.id;
  await db.insert(clubRaceSelectionsTable).values([
    { eventId, clerkId: ids.renner, role: "renner", availability: "beschikbaar" },
    { eventId, clerkId: ids.ploegleider, role: "ploegleider", availability: "onbekend" },
  ]);
  await db.insert(clubRaceDayScheduleTable).values({ eventId, clerkId: ids.renner, departTime: "06:45", meetPoint: "Clubhuis" });
  await db.insert(clubRaceVehiclesTable).values({ eventId, name: "Volgauto", seats: 4, driverClerkId: ids.ploegleider });
  await db.insert(clubRaceMaterialItemsTable).values({ eventId, riderClerkId: ids.renner, item: "Reservewielen", createdByClerkId: ids.owner });

  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const get = async (pad: string, als: string) =>
    fetch(`http://127.0.0.1:${port}/api/clubs/${clubId}/races/${eventId}/documents/${pad}`, {
      headers: { "x-dev-clerk-id": als },
    });

  let ok = 0;
  const test = async (naam: string, fn: () => Promise<void>) => {
    await fn();
    ok++;
    console.log(`✓ ${naam}`);
  };

  await test("RT-12 dagschema is een echte PDF (staf)", async () => {
    const r = await get("dagschema.pdf", ids.ploegleider);
    if (r.status !== 200) console.error("BODY:", await r.text());
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "application/pdf");
    const buf = Buffer.from(await r.arrayBuffer());
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(buf.length > 1000);
  });

  await test("RT-12 ook voor geselecteerde renner", async () => {
    const r = await get("dagschema.pdf", ids.renner);
    assert.equal(r.status, 200);
  });

  await test("RT-12 geweigerd voor niet-lid", async () => {
    const r = await get("dagschema.pdf", ids.buitenstaander);
    assert.equal(r.status, 403);
  });

  await test("versienummer loopt op per uitgifte", async () => {
    const rows = await db
      .select({ version: clubRaceDocumentIssuesTable.version })
      .from(clubRaceDocumentIssuesTable)
      .where(eq(clubRaceDocumentIssuesTable.eventId, eventId));
    const versies = rows.map((r) => r.version).sort((a, b) => a - b);
    assert.deepEqual(versies, [1, 2]);
  });

  await test("RT-13 bezetting is een echte PDF", async () => {
    const r = await get("bezetting.pdf", ids.ploegleider);
    assert.equal(r.status, 200);
    const buf = Buffer.from(await r.arrayBuffer());
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  });

  await test("RT-14 materiaallijst: ploegleiding mag, renner niet", async () => {
    const r = await get("materiaallijst.pdf", ids.ploegleider);
    assert.equal(r.status, 200);
    const buf = Buffer.from(await r.arrayBuffer());
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
    const geweigerd = await get("materiaallijst.pdf", ids.renner);
    assert.equal(geweigerd.status, 403);
  });

  server.close();
  await cleanup();
  await pool.end();
  console.log(`Alle ${ok} documenttests geslaagd.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
