// SPARKI_BUILD F11 DEEL 2 — bewijs van de module-OMLEGGING naar de centrale laag.
//
// Waar f11-files.ts de centrale laag zélf bewijst, bewijst dit de omlegging van
// de modules op die laag, met behoud van functionaliteit en het per-module
// rechtenmodel:
// - Materiaalcoach: de foto-poort (registerFile) weigert een verkleed/verkeerd
//   type met 415 (dezelfde poort die storeMaterialPhoto gebruikt);
// - Journey: verwijderen van eigen media trekt de centrale files-rij in
//   (revoke → 410 op de serve-route), en andermans media verwijderen faalt (404);
// - Generieke serve-route (/api/storage): een centraal-beheerd object gaat
//   ALTIJD door de centrale poort — eigenaar kan ophalen, onbevoegde krijgt 404,
//   en na intrekken valt ook de oude link dicht met 410.

import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import {
  db,
  pool,
  userProfilesTable,
  filesTable,
  journeyMediaTable,
  materialAnalysesTable,
} from "@workspace/db";
import { eq, like } from "drizzle-orm";
import app from "../app";
import {
  registerFile,
  scanFile,
  registerFromObjectPath,
  revokeFile,
} from "../lib/files";
import { ObjectStorageService } from "../lib/objectStorage";

const svc = new ObjectStorageService();

// Legt een RAUW presign-object neer (PUT via getekende URL) met een owner-ACL,
// precies zoals de presign→PUT-flow van een module. Geeft het genormaliseerde
// objectPath terug.
async function seedPresignObject(
  ownerClerkId: string,
  bytes: Buffer,
  mediaType: string,
): Promise<string> {
  const uploadUrl = await svc.getObjectEntityUploadURL();
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mediaType },
    body: bytes,
    signal: AbortSignal.timeout(30_000),
  });
  if (!put.ok) throw new Error(`presign PUT faalde (${put.status})`);
  return svc.trySetObjectEntityAclPolicy(uploadUrl, {
    owner: ownerClerkId,
    visibility: "private",
  });
}

process.env["DEV_AUTH_BYPASS"] = "true";

const PREFIX = "f11-oml-";
const ids = {
  owner: `${PREFIX}owner`,
  ander: `${PREFIX}ander`,
};

// Echte, geldige 8x8 PNG (her-encodeerbaar door sharp).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWPgqjiBFTEMLQkADShSgdHoYMoAAAAASUVORK5CYII=",
  "base64",
);
// Een tweede, ANDERE geldige PNG (16x16, effen groen) — voor scenario's waar we
// dedupe-botsingen willen vermijden (uniek object per test).
const PNG2 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAGUlEQVQokWPgOqFBEmIY1XBiNJS4hmvSAADLcvoB1eeAlAAAAABJRU5ErkJggg==",
  "base64",
);
// Een DERDE, unieke PNG (12x12, effen blauw) — uitsluitend voor de dedupe-test,
// zodat zijn gedeelde object niet met andere testregels botst.
const PNG3 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFUlEQVQYlWPgEjlBEDGMKmIYhEEAAM6dgWHXFn3yAAAAAElFTkSuQmCC",
  "base64",
);
// Verkleed: naam claimt afbeelding, maar de bytes zijn een ZIP (PK…).
const FAKE_ZIP = Buffer.from("504b0304140000000800", "hex");

async function cleanup() {
  await db.delete(journeyMediaTable).where(like(journeyMediaTable.clerkId, `${PREFIX}%`));
  await db.delete(materialAnalysesTable).where(like(materialAnalysesTable.clerkId, `${PREFIX}%`));
  await db.delete(filesTable).where(like(filesTable.ownerClerkId, `${PREFIX}%`));
  await db.delete(userProfilesTable).where(like(userProfilesTable.clerkId, `${PREFIX}%`));
}

let ok = 0;
const test = async (naam: string, fn: () => Promise<void>) => {
  await fn();
  ok++;
  console.log(`✓ ${naam}`);
};

async function main() {
  await cleanup();
  for (const [k, id] of Object.entries(ids)) {
    await db
      .insert(userProfilesTable)
      .values({ clerkId: id, email: `${id}@f11.invalid`, displayName: `F11 ${k}`, releaseGroup: "test" })
      .onConflictDoNothing();
  }

  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const api = (method: string, pad: string, als: string, body?: unknown) =>
    fetch(`http://127.0.0.1:${port}${pad}`, {
      method,
      headers: { "content-type": "application/json", "x-dev-clerk-id": als },
      body: body ? JSON.stringify(body) : undefined,
    });

  try {
    // ── Materiaalcoach: de foto-poort weigert verkleed/verkeerd type ─────────
    await test("materiaalfoto-poort weigert een verkleed type (415)", async () => {
      // storeMaterialPhoto gebruikt exact deze poort; wij prikken de poort direct.
      const r = await scanFile(FAKE_ZIP);
      assert.equal(r.ok, false);
      assert.equal((r as { status: number }).status, 415);
    });

    await test("materiaalfoto-poort accepteert een geldige afbeelding (media-retentie)", async () => {
      const reg = await registerFile({
        ownerClerkId: ids.owner,
        base64: PNG.toString("base64"),
        originalName: "materiaalfoto",
        retentionCategory: "media",
      });
      assert.equal(reg.ok, true);
      if (!reg.ok) return;
      assert.equal(reg.file.retentionCategory, "media");
      assert.equal(reg.file.contentType, "image/jpeg", "her-encodeerd door de poort");
    });

    // ── Journey: media dragen een centrale files-rij; verwijderen trekt in ───
    // Registreer een centrale rij en koppel er journey-media aan (zoals de
    // POST /media-route na de gate doet), zodat we het intrekgedrag echt zien.
    // Uniek beeld (PNG2) zodat er geen dedupe-zusterrij ontstaat en het intrekken
    // van deze journey-media het gedeelde object volledig doodt.
    const reg = await registerFile({
      ownerClerkId: ids.owner,
      base64: PNG2.toString("base64"),
      originalName: "journeyfoto",
      retentionCategory: "media",
    });
    assert.equal(reg.ok, true);
    if (!reg.ok) throw new Error("register faalde onverwacht");
    const fileId = reg.file.id;
    const objectPath = reg.file.objectPath;

    const [media] = await db
      .insert(journeyMediaTable)
      .values({
        clerkId: ids.owner,
        subjectType: "race",
        subjectId: 999999,
        objectPath,
        mediaType: reg.file.contentType,
        fileId,
        sortIndex: 0,
      })
      .returning();

    await test("centraal-beheerd object: eigenaar haalt op via de generieke route", async () => {
      const raw = await api("GET", `/api/storage${objectPath}`, ids.owner);
      assert.equal(raw.status, 200);
      assert.equal(raw.headers.get("x-content-type-options"), "nosniff");
    });

    await test("centraal-beheerd object: onbevoegde krijgt 404 (geen lek)", async () => {
      const raw = await api("GET", `/api/storage${objectPath}`, ids.ander);
      assert.equal(raw.status, 404);
    });

    await test("andermans journey-media verwijderen faalt (404), niets ingetrokken", async () => {
      const d = await api("DELETE", `/api/journey/media/${media!.id}`, ids.ander);
      assert.equal(d.status, 404);
      const [row] = await db.select().from(filesTable).where(eq(filesTable.id, fileId));
      assert.equal(row!.revokedAt, null, "andermans poging trekt niets in");
    });

    await test("eigen journey-media verwijderen trekt de centrale files-rij in (revoke)", async () => {
      const d = await api("DELETE", `/api/journey/media/${media!.id}`, ids.owner);
      assert.equal(d.status, 200);
      const [row] = await db.select().from(filesTable).where(eq(filesTable.id, fileId));
      assert.notEqual(row!.revokedAt, null, "files-rij is ingetrokken");
    });

    await test("na intrekken valt ook de oude serve-link dicht (410)", async () => {
      const dl = await api("GET", `/api/files/${fileId}/download`, ids.owner);
      assert.equal(dl.status, 410);
      const raw = await api("GET", `/api/storage${objectPath}`, ids.owner);
      assert.equal(raw.status, 410, "generieke route eerbiedigt intrekking");
    });

    // ── Reviewpunt 1: ingetrokken materiaalfoto is dood op de module-serve-route ─
    await test("materiaalfoto-serve is fileId-aware: ingetrokken ⇒ 410", async () => {
      const mreg = await registerFile({
        ownerClerkId: ids.owner,
        base64: PNG.toString("base64"),
        originalName: "materiaalfoto",
        retentionCategory: "media",
      });
      assert.equal(mreg.ok, true);
      if (!mreg.ok) return;
      const [analyse] = await db
        .insert(materialAnalysesTable)
        .values({
          clerkId: ids.owner,
          category: "ketting",
          status: "analyzed",
          photoPaths: [mreg.file.objectPath],
          photoFileIds: [mreg.file.id],
        })
        .returning();
      // Vóór intrekken: bevoegde haalt op (200).
      const ok200 = await api("GET", `/api/material/photo/${analyse!.id}/0`, ids.owner);
      assert.equal(ok200.status, 200, "foto met fileId is serveerbaar");
      // Intrekken → de module-serve-route (niet alleen /api/files) geeft 410.
      await revokeFile(mreg.file.id, ids.owner);
      const gone = await api("GET", `/api/material/photo/${analyse!.id}/0`, ids.owner);
      assert.equal(gone.status, 410, "ingetrokken materiaalfoto ⇒ 410 op /api/material/photo");
    });

    // ── Reviewpunt 2: finalisatie op ANDERMANS objectPath wordt geweigerd (IDOR) ─
    await test("registerFromObjectPath weigert andermans presign-object (403, geen takeover)", async () => {
      // 'ander' uploadt een presign-object op eigen naam.
      const foreignPath = await seedPresignObject(ids.ander, PNG, "image/png");
      // 'owner' probeert dat object te finaliseren als eigen bestand.
      const reg = await registerFromObjectPath({
        ownerClerkId: ids.owner,
        objectPath: foreignPath,
        originalName: "gejat",
        retentionCategory: "media",
      });
      assert.equal(reg.ok, false, "andermans object finaliseren faalt");
      if (reg.ok) return;
      assert.equal(reg.status, 403, "takeover geblokkeerd met 403");
      // De rechtmatige eigenaar kan zijn eigen object wél finaliseren.
      const eigen = await registerFromObjectPath({
        ownerClerkId: ids.ander,
        objectPath: foreignPath,
        originalName: "eigen",
        retentionCategory: "media",
      });
      assert.equal(eigen.ok, true, "eigenaar mag zijn eigen object wél finaliseren");
    });

    // ── Reviewpunt 3: dedupe A-revoke laat B leven ──────────────────────────
    await test("dedupe: revoke van rij A laat de levende rij B op /api/storage leven", async () => {
      const a = await registerFile({
        ownerClerkId: ids.owner,
        base64: PNG3.toString("base64"),
        originalName: "dubbel-a",
        retentionCategory: "media",
      });
      const b = await registerFile({
        ownerClerkId: ids.owner,
        base64: PNG3.toString("base64"),
        originalName: "dubbel-b",
        retentionCategory: "media",
      });
      assert.equal(a.ok && b.ok, true);
      if (!a.ok || !b.ok) return;
      assert.equal(b.deduped, true, "B is een dedupe van A (zelfde bytes/object)");
      assert.equal(a.file.objectPath, b.file.objectPath, "gedeeld object");
      // Trek A in; B blijft levend.
      await revokeFile(a.file.id, ids.owner);
      const raw = await api("GET", `/api/storage${a.file.objectPath}`, ids.owner);
      assert.equal(raw.status, 200, "levende rij B houdt het gedeelde object serveerbaar");
      // Directe download van A (specifiek ingetrokken) blijft 410.
      const dlA = await api("GET", `/api/files/${a.file.id}/download`, ids.owner);
      assert.equal(dlA.status, 410, "A specifiek blijft ingetrokken");
      // Trek nu ook B in ⇒ alle rijen dood ⇒ generieke route 410.
      await revokeFile(b.file.id, ids.owner);
      const rawGone = await api("GET", `/api/storage${a.file.objectPath}`, ids.owner);
      assert.equal(rawGone.status, 410, "alle rijen ingetrokken ⇒ 410");
    });

    // ── Reviewpunt 4b: rauwe presign-bron is na finalisatie dood ────────────
    await test("rauwe presign-bron is na finalisatie gequarantaineerd (niet meer op te halen)", async () => {
      const src = await seedPresignObject(ids.owner, PNG, "image/png");
      const reg = await registerFromObjectPath({
        ownerClerkId: ids.owner,
        objectPath: src,
        originalName: "bron",
        retentionCategory: "media",
      });
      assert.equal(reg.ok, true);
      if (!reg.ok) return;
      // De veilige kopie heeft een NIEUW pad (poort her-encodeert naar nieuw object).
      assert.notEqual(reg.file.objectPath, src, "veilige kopie op nieuw pad");
      // De rauwe bron is verwijderd/gequarantaineerd: eigenaar kan hem niet meer
      // via de generieke route ophalen (404: object weg, of geen files-rij + geen
      // toegankelijke ACL meer).
      const rawSrc = await api("GET", `/api/storage${src}`, ids.owner);
      assert.notEqual(rawSrc.status, 200, "rauwe bron niet meer serveerbaar");
    });

    console.log(`\n✅ F11 module-omlegging — ${ok} controles geslaagd`);
  } finally {
    server.close();
    await cleanup();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
