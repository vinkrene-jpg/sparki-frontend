// HERSTEL_EN_AANVULLING_01 F6 (HA-26/HA-27) — bewijs clubdocumenten:
// alleen clubbeheer plaatst (trainer 403), elk actief lid leest, niet-lid
// 403, bestandstype-poort, download levert de originele bytes terug.
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { db, pool, userProfilesTable, clubsTable, clubMembersTable } from "@workspace/db";
import { eq, like } from "drizzle-orm";
import app from "../app";

process.env["DEV_AUTH_BYPASS"] = "true";

const PREFIX = "clubdoc-test-";
const ids = {
  owner: `${PREFIX}owner`,
  trainer: `${PREFIX}trainer`,
  lid: `${PREFIX}lid`,
  buiten: `${PREFIX}buiten`,
};

async function cleanup() {
  const clubs = await db.select({ id: clubsTable.id }).from(clubsTable).where(eq(clubsTable.name, "Clubdoc-test club"));
  for (const c of clubs) await db.delete(clubsTable).where(eq(clubsTable.id, c.id));
  await db.delete(userProfilesTable).where(like(userProfilesTable.clerkId, `${PREFIX}%`));
}

async function main() {
  await cleanup();
  for (const [k, id] of Object.entries(ids)) {
    await db
      .insert(userProfilesTable)
      .values({ clerkId: id, email: `${id}@clubdoc-test.invalid`, displayName: `Clubdoc ${k}`, releaseGroup: "test" })
      .onConflictDoNothing();
  }
  const [club] = await db
    .insert(clubsTable)
    .values({ name: "Clubdoc-test club", ownerClerkId: ids.owner, status: "actief" })
    .returning({ id: clubsTable.id });
  const clubId = club!.id;
  await db.insert(clubMembersTable).values([
    { clubId, clerkId: ids.owner, role: "owner" },
    { clubId, clerkId: ids.trainer, role: "trainer" },
    { clubId, clerkId: ids.lid, role: "member" },
  ]);

  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const api = (method: string, pad: string, als: string, body?: unknown) =>
    fetch(`http://127.0.0.1:${port}/api/clubs/${clubId}/documents${pad}`, {
      method,
      headers: { "content-type": "application/json", "x-dev-clerk-id": als },
      body: body ? JSON.stringify(body) : undefined,
    });

  const inhoud = "Gedragscode van de club: wees eerlijk, veilig en sportief.";
  const base64 = Buffer.from(inhoud, "utf8").toString("base64");

  let ok = 0;
  const test = async (naam: string, fn: () => Promise<void>) => {
    await fn();
    ok++;
    console.log(`✓ ${naam}`);
  };

  let documentId = 0;
  await test("clubbeheer plaatst een document", async () => {
    const r = await api("POST", "/", ids.owner, {
      title: "Gedragscode",
      category: "gedragscode",
      base64,
      mediaType: "text/plain",
    });
    assert.equal(r.status, 201);
    const row = (await r.json()) as { id: number };
    documentId = row.id;
  });

  await test("trainer mag niet plaatsen (403)", async () => {
    const r = await api("POST", "/", ids.trainer, { title: "X", category: "overig", base64, mediaType: "text/plain" });
    assert.equal(r.status, 403);
  });

  await test("onbekend bestandstype is 400", async () => {
    const r = await api("POST", "/", ids.owner, { title: "X", category: "overig", base64, mediaType: "application/zip" });
    assert.equal(r.status, 400);
  });

  await test("elk actief lid ziet de lijst; niet-lid 403", async () => {
    const r = await api("GET", "/", ids.lid);
    assert.equal(r.status, 200);
    const data = (await r.json()) as { documents: { title: string }[]; magPlaatsen: boolean };
    assert.equal(data.documents.length, 1);
    assert.equal(data.magPlaatsen, false);
    const buiten = await api("GET", "/", ids.buiten);
    assert.equal(buiten.status, 403);
  });

  await test("download levert de originele bytes", async () => {
    const r = await api("GET", `/${documentId}/download`, ids.lid);
    assert.equal(r.status, 200);
    assert.equal(await r.text(), inhoud);
  });

  await test("verwijderen: lid 403, beheer ok", async () => {
    const nee = await api("DELETE", `/${documentId}`, ids.lid);
    assert.equal(nee.status, 403);
    const ja = await api("DELETE", `/${documentId}`, ids.owner);
    assert.equal(ja.status, 200);
  });

  server.close();
  await cleanup();
  await pool.end();
  console.log(`Alle ${ok} clubdocumenttests geslaagd.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
