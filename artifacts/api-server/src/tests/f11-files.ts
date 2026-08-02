// SPARKI_BUILD F11 DEEL 1 — bewijs centrale bestands- en medialaag.
//
// Dekt de acceptatiecriteria van de centrale laag (los van module-omleggingen):
// - upload + download door bevoegde (eigenaar) werkt;
// - onbevoegde krijgt 404 (nooit lekken dat het bestand bestaat);
// - vervangen behoudt de historie (oude versie blijft downloadbaar);
// - ingetrokken bestand weigert op de serve-route (410), ook via oude link;
// - verkeerd/verkleed type wordt geweigerd (415);
// - te groot bestand wordt geweigerd (400);
// - dedupe op checksum wordt herkend (zelfde eigenaar, zelfde bytes);
// - path-traversal-bestandsnaam wordt gesaneerd.

import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import {
  db,
  pool,
  userProfilesTable,
  filesTable,
} from "@workspace/db";
import { eq, like } from "drizzle-orm";
import app from "../app";
import {
  registerFile,
  replaceFile,
  sniffContentType,
  sanitizeName,
  scanFile,
  FILES_MAX_UPLOAD_BYTES,
} from "../lib/files";

process.env["DEV_AUTH_BYPASS"] = "true";

const PREFIX = "f11-test-";
const ids = {
  owner: `${PREFIX}owner`,
  ander: `${PREFIX}ander`,
};

// Echte, geldige 8x8 PNG (her-encodeerbaar door sharp).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWPgqjiBFTEMLQkADShSgdHoYMoAAAAASUVORK5CYII=",
  "base64",
);
// Een tweede, andere geldige PNG (16x16, effen groen) voor de "vervangen"-versie.
const PNG2 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAGUlEQVQokWPgOqFBEmIY1XBiNJS4hmvSAADLcvoB1eeAlAAAAABJRU5ErkJggg==",
  "base64",
);
// Verkleed: naam claimt .png, maar de bytes zijn een ZIP (PK…).
const FAKE_ZIP = Buffer.from("504b0304140000000800", "hex");

async function cleanup() {
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
    // ── Unit: veiligheidsketen ──────────────────────────────────────────────
    await test("sniffer herkent PNG op inhoud, weigert verkleed ZIP", async () => {
      assert.equal(sniffContentType(PNG).ok, true);
      assert.equal(sniffContentType(FAKE_ZIP).ok, false);
    });

    await test("verkeerd type wordt geweigerd (415) door scanFile", async () => {
      const r = await scanFile(FAKE_ZIP);
      assert.equal(r.ok, false);
      assert.equal((r as { status: number }).status, 415);
    });

    await test("te groot bestand wordt geweigerd (400) door scanFile", async () => {
      // Een buffer net boven de limiet; inhoud maakt niet uit — grootte eerst.
      const big = Buffer.alloc(FILES_MAX_UPLOAD_BYTES + 1, 0);
      const r = await scanFile(big);
      assert.equal(r.ok, false);
      assert.equal((r as { status: number }).status, 400);
    });

    await test("path-traversal-bestandsnaam wordt gesaneerd (geen pad/traversal)", async () => {
      const safe = sanitizeName("../../etc/passwd\u0000.exe", "jpg");
      assert.ok(!safe.includes("/"), "geen pad-scheidingstekens");
      assert.ok(!safe.includes(".."), "geen traversal");
      assert.ok(!/\u0000/.test(safe), "geen control chars");
      assert.ok(safe.endsWith(".jpg"), "extensie geforceerd op echt type");
    });

    // ── Register + dedupe ───────────────────────────────────────────────────
    let fileId = 0;
    let objectPath = "";
    await test("eigenaar uploadt (register) een geldige afbeelding", async () => {
      const reg = await registerFile({
        ownerClerkId: ids.owner,
        base64: PNG.toString("base64"),
        originalName: "foto.png",
        retentionCategory: "media",
      });
      assert.equal(reg.ok, true);
      if (!reg.ok) return;
      fileId = reg.file.id;
      objectPath = reg.file.objectPath;
      // Her-encodeerd (PNG → jpeg) en logicalId gezet op eigen id.
      assert.equal(reg.file.contentType, "image/jpeg");
      assert.equal(reg.file.logicalId, reg.file.id);
      assert.equal(reg.file.version, 1);
      assert.equal(reg.file.retentionCategory, "media");
      assert.equal(reg.deduped ?? false, false);
    });

    await test("dedupe: dezelfde eigenaar + dezelfde bytes hergebruikt het object", async () => {
      const reg = await registerFile({
        ownerClerkId: ids.owner,
        base64: PNG.toString("base64"),
        originalName: "foto-kopie.png",
        retentionCategory: "media",
      });
      assert.equal(reg.ok, true);
      if (!reg.ok) return;
      assert.equal(reg.deduped, true, "als duplicaat herkend");
      assert.equal(reg.file.objectPath, objectPath, "zelfde opgeslagen object hergebruikt");
      assert.notEqual(reg.file.id, fileId, "wel een eigen nieuwe files-rij");
    });

    await test("dedupe is NIET cross-eigenaar (privacy)", async () => {
      const reg = await registerFile({
        ownerClerkId: ids.ander,
        base64: PNG.toString("base64"),
        originalName: "foto.png",
      });
      assert.equal(reg.ok, true);
      if (!reg.ok) return;
      assert.equal(reg.deduped ?? false, false, "andere eigenaar dedupet niet");
      assert.notEqual(reg.file.objectPath, objectPath, "eigen object, geen kruislek");
    });

    // ── Download bevoegd / onbevoegd ────────────────────────────────────────
    await test("bevoegde (eigenaar) kan downloaden met nosniff + attachment", async () => {
      const dl = await api("GET", `/api/files/${fileId}/download`, ids.owner);
      assert.equal(dl.status, 200);
      assert.equal(dl.headers.get("x-content-type-options"), "nosniff");
      assert.match(dl.headers.get("content-disposition") ?? "", /attachment/);
    });

    await test("onbevoegde krijgt 404 (nooit lekken)", async () => {
      const dl = await api("GET", `/api/files/${fileId}/download`, ids.ander);
      assert.equal(dl.status, 404);
    });

    // ── Vervangen behoudt historie ──────────────────────────────────────────
    let versie2Id = 0;
    await test("vervangen zonder historieverlies: nieuwe versie + oude blijft downloadbaar", async () => {
      const rep = await replaceFile(fileId, {
        ownerClerkId: ids.owner,
        base64: PNG2.toString("base64"),
        originalName: "foto-v2.png",
        retentionCategory: "media",
      });
      assert.equal(rep.ok, true);
      if (!rep.ok) return;
      versie2Id = rep.file.id;
      assert.equal(rep.file.version, 2);
      assert.equal(rep.file.logicalId, fileId, "zelfde logische keten");

      // Oude versie wijst nu naar de nieuwe (superseded), maar blijft bewaard.
      const [oud] = await db.select().from(filesTable).where(eq(filesTable.id, fileId));
      assert.equal(oud!.supersededById, versie2Id, "oude versie wijst naar nieuwe");

      // Oude versie blijft downloadbaar voor de bevoegde (historie behouden).
      const dlOud = await api("GET", `/api/files/${fileId}/download`, ids.owner);
      assert.equal(dlOud.status, 200, "oude versie blijft downloadbaar");

      // Versiehistorie via de centrale router.
      const hist = await api("GET", `/api/files/${fileId}/versions`, ids.owner);
      assert.equal(hist.status, 200);
      const hj = (await hist.json()) as { versions: Array<{ version: number }> };
      assert.ok(hj.versions.length >= 2, "beide versies in de historie");
    });

    // ── Intrekken hard ──────────────────────────────────────────────────────
    await test("ingetrokken bestand weigert op de serve-route (410), ook via oude link", async () => {
      const rev = await api("POST", `/api/files/${fileId}/revoke`, ids.owner);
      assert.equal(rev.status, 200);
      // De "oude link" (dezelfde download-URL) valt nu dicht met 410.
      const dl = await api("GET", `/api/files/${fileId}/download`, ids.owner);
      assert.equal(dl.status, 410);
      // De niet-ingetrokken nieuwe versie blijft ophaalbaar.
      const dlV2 = await api("GET", `/api/files/${versie2Id}/download`, ids.owner);
      assert.equal(dlV2.status, 200, "intrekken van de één raakt de ander niet");
    });

    await test("generieke storage-route: dedupe-revoke doodt de nog levende zusterrij NIET", async () => {
      // F11 + reviewpunt 3: op dit objectPath heeft de eigenaar TWEE rijen —
      // de zojuist ingetrokken originele rij (fileId) én een levende dedupe-kopie
      // (dezelfde bytes/hetzelfde object). De generieke route serveert zolang er
      // ≥1 LEVENDE rij van de rechthebbende is: intrekken van de één mag de ander
      // niet doden. Dus 200, niet 410.
      const raw = await api("GET", `/api/storage${objectPath}`, ids.owner);
      assert.equal(raw.status, 200, "levende dedupe-zusterrij blijft serveerbaar");
      assert.equal(raw.headers.get("x-content-type-options"), "nosniff");
      // Een onbevoegde krijgt 404 (nooit lekken dat het bestaat).
      const other = await api("GET", `/api/storage${objectPath}`, ids.ander);
      assert.equal(other.status, 404, "onbevoegde: 404, geen lek");
    });

    console.log(`\n✅ F11 centrale bestands- en medialaag — ${ok} controles geslaagd`);
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
