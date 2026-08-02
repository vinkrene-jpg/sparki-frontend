// SPARKI_BUILD_01 F8 — bewijs clubdocumenten (versies + publicatie +
// zichtbaarheid). Bouwt voort op HA-26/HA-27:
// • beheer (owner/admin/hoofdtrainer) plaatst; trainer/lid niet (403);
// • bestandstype-poort van de F7-laag (ZIP verkleed als .pdf → geweigerd);
// • concept is onzichtbaar voor gewone leden, zichtbaar voor beheer;
// • publiceren maakt het document zichtbaar voor de juiste rollen;
// • versiewissel bewaart de oude versie en maakt de nieuwe de actieve;
// • rolzichtbaarheid: een gewoon lid ziet een 'trainers_bestuur'-document niet,
//   ook niet via directe download; een trainer wél;
// • gekoppelde ouder van een clublid ziet de leden_en_ouders-documenten;
// • onbevoegde directe download/API wordt geweigerd (404/403).
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import {
  db,
  pool,
  userProfilesTable,
  clubsTable,
  clubMembersTable,
  parentAthleteLinksTable,
} from "@workspace/db";
import { eq, like } from "drizzle-orm";
import app from "../app";

process.env["DEV_AUTH_BYPASS"] = "true";

const PREFIX = "clubdoc-test-";
const ids = {
  owner: `${PREFIX}owner`,
  hoofdtrainer: `${PREFIX}hoofdtrainer`,
  trainer: `${PREFIX}trainer`,
  lid: `${PREFIX}lid`,
  ouder: `${PREFIX}ouder`,
  buiten: `${PREFIX}buiten`,
};

// Minimale, echt geldige PDF (begint met %PDF-). PDFs worden ongewijzigd
// opgeslagen door de F7-laag, dus download-bytes zijn exact terug te lezen.
const PDF_V1 = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\nVERSIE-EEN",
  "utf8",
);
const PDF_V2 = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\nVERSIE-TWEE-NIEUW",
  "utf8",
);
// Verkleed bestand: naam claimt .pdf, bytes zijn een ZIP (PK…) → geweigerd.
const FAKE_ZIP = Buffer.from("504b0304140000000800", "hex");

async function cleanup() {
  const clubs = await db
    .select({ id: clubsTable.id })
    .from(clubsTable)
    .where(eq(clubsTable.name, "Clubdoc-test club"));
  for (const c of clubs) await db.delete(clubsTable).where(eq(clubsTable.id, c.id));
  await db.delete(parentAthleteLinksTable).where(like(parentAthleteLinksTable.parentClerkId, `${PREFIX}%`));
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
    { clubId, clerkId: ids.hoofdtrainer, role: "hoofdtrainer" },
    { clubId, clerkId: ids.trainer, role: "trainer" },
    { clubId, clerkId: ids.lid, role: "member" },
  ]);
  // Ouder gekoppeld aan het clublid (accepted, actief).
  await db.insert(parentAthleteLinksTable).values({
    parentClerkId: ids.ouder,
    athleteClerkId: ids.lid,
    status: "accepted",
  });

  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const api = (method: string, pad: string, als: string, body?: unknown) =>
    fetch(`http://127.0.0.1:${port}/api/clubs/${clubId}/documents${pad}`, {
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

  // ── Aanmaken & rechten ──────────────────────────────────────────────────────
  let ledenDocId = 0;
  await test("beheer maakt een concept-document (leden_en_ouders)", async () => {
    const r = await api("POST", "/", ids.owner, {
      title: "Gedragscode",
      category: "gedragscode",
      visibility: "leden_en_ouders",
      base64: PDF_V1.toString("base64"),
      originalName: "gedragscode.pdf",
      // publish weggelaten ⇒ concept
    });
    assert.equal(r.status, 201);
    const row = (await r.json()) as { id: number };
    ledenDocId = row.id;
  });

  await test("trainer mag geen document maken (403)", async () => {
    const r = await api("POST", "/", ids.trainer, {
      title: "X",
      category: "overig",
      base64: PDF_V1.toString("base64"),
    });
    assert.equal(r.status, 403);
  });

  await test("lid mag geen document maken (403)", async () => {
    const r = await api("POST", "/", ids.lid, {
      title: "X",
      category: "overig",
      base64: PDF_V1.toString("base64"),
    });
    assert.equal(r.status, 403);
  });

  await test("hoofdtrainer mág beheren (nieuwe categorie huisregels)", async () => {
    const r = await api("POST", "/", ids.hoofdtrainer, {
      title: "Huisregels",
      category: "huisregels",
      base64: PDF_V1.toString("base64"),
      originalName: "huisregels.pdf",
      publish: true,
    });
    assert.equal(r.status, 201);
  });

  await test("verkleed bestand (ZIP als .pdf) wordt geweigerd", async () => {
    const r = await api("POST", "/", ids.owner, {
      title: "Nep",
      category: "overig",
      base64: FAKE_ZIP.toString("base64"),
      originalName: "nep.pdf",
    });
    assert.equal(r.status, 415);
  });

  await test("onbekende categorie is 400", async () => {
    const r = await api("POST", "/", ids.owner, {
      title: "X",
      category: "bestaat-niet",
      base64: PDF_V1.toString("base64"),
    });
    assert.equal(r.status, 400);
  });

  // ── Concept-zichtbaarheid ───────────────────────────────────────────────────
  await test("concept: lid ziet het document niet in de lijst", async () => {
    const r = await api("GET", "/", ids.lid);
    assert.equal(r.status, 200);
    const data = (await r.json()) as { documents: { id: number; title: string }[] };
    assert.ok(!data.documents.some((d) => d.id === ledenDocId), "concept mag niet zichtbaar zijn voor lid");
  });

  await test("concept: beheer ziet het wél, met versiehistorie", async () => {
    const r = await api("GET", "/", ids.owner);
    assert.equal(r.status, 200);
    const data = (await r.json()) as {
      magBeheren: boolean;
      documents: { id: number; versions?: { versionNumber: number; status: string }[] }[];
    };
    assert.equal(data.magBeheren, true);
    const doc = data.documents.find((d) => d.id === ledenDocId);
    assert.ok(doc, "beheer moet het concept zien");
    assert.ok(doc!.versions && doc!.versions.length === 1);
    assert.equal(doc!.versions![0]!.status, "concept");
  });

  await test("concept: directe download door lid → 404 (niet lekken)", async () => {
    const r = await api("GET", `/${ledenDocId}/download`, ids.lid);
    assert.equal(r.status, 404);
  });

  // ── Publiceren + zichtbaar voor juiste rollen ───────────────────────────────
  let v1Id = 0;
  await test("beheer publiceert versie 1 → zichtbaar voor lid", async () => {
    // versie-id ophalen uit de beheerlijst
    const lijst = (await (await api("GET", "/", ids.owner)).json()) as {
      documents: { id: number; versions?: { id: number; versionNumber: number }[] }[];
    };
    const doc = lijst.documents.find((d) => d.id === ledenDocId)!;
    v1Id = doc.versions!.find((v) => v.versionNumber === 1)!.id;
    const r = await api("POST", `/${ledenDocId}/versions/${v1Id}/publish`, ids.owner);
    assert.equal(r.status, 200);

    const ledenLijst = (await (await api("GET", "/", ids.lid)).json()) as {
      documents: { id: number; current: { versionNumber: number; publishedAt: string } | null }[];
    };
    const zichtbaar = ledenLijst.documents.find((d) => d.id === ledenDocId);
    assert.ok(zichtbaar, "lid moet het gepubliceerde document zien");
    assert.equal(zichtbaar!.current!.versionNumber, 1);
    assert.ok(zichtbaar!.current!.publishedAt, "publicatiedatum moet vastgelegd zijn");
  });

  await test("gepubliceerde download door lid levert de bytes", async () => {
    const r = await api("GET", `/${ledenDocId}/download`, ids.lid);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-disposition")?.includes("attachment"), true);
    const buf = Buffer.from(await r.arrayBuffer());
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  });

  // ── Versiewissel: oude blijft bewaard, nieuwe wordt actief ──────────────────
  await test("nieuwe versie (concept) laat de actieve versie 1 ongemoeid", async () => {
    const r = await api("POST", `/${ledenDocId}/versions`, ids.owner, {
      base64: PDF_V2.toString("base64"),
      originalName: "gedragscode-v2.pdf",
      // concept
    });
    assert.equal(r.status, 201);
    // Lid ziet nog steeds versie 1 als actieve.
    const ledenLijst = (await (await api("GET", "/", ids.lid)).json()) as {
      documents: { id: number; current: { versionNumber: number } | null }[];
    };
    assert.equal(ledenLijst.documents.find((d) => d.id === ledenDocId)!.current!.versionNumber, 1);
  });

  await test("versie 2 publiceren: v2 actief, v1 blijft bewaard", async () => {
    const beheerLijst = (await (await api("GET", "/", ids.owner)).json()) as {
      documents: { id: number; versions?: { id: number; versionNumber: number; status: string }[] }[];
    };
    const doc = beheerLijst.documents.find((d) => d.id === ledenDocId)!;
    assert.equal(doc.versions!.length, 2, "beide versies moeten bewaard blijven");
    const v2Id = doc.versions!.find((v) => v.versionNumber === 2)!.id;
    const r = await api("POST", `/${ledenDocId}/versions/${v2Id}/publish`, ids.owner);
    assert.equal(r.status, 200);

    const ledenLijst = (await (await api("GET", "/", ids.lid)).json()) as {
      documents: { id: number; current: { versionNumber: number } | null }[];
    };
    assert.equal(ledenLijst.documents.find((d) => d.id === ledenDocId)!.current!.versionNumber, 2);

    // Oude versie 1 blijft opvraagbaar voor beheer via expliciete versieId.
    const oud = await api("GET", `/${ledenDocId}/download?versionId=${v1Id}`, ids.owner);
    assert.equal(oud.status, 200);
    const buf = Buffer.from(await oud.arrayBuffer());
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  });

  await test("lid kan geen oude versie via versieId opvragen (404)", async () => {
    const r = await api("GET", `/${ledenDocId}/download?versionId=${v1Id}`, ids.lid);
    assert.equal(r.status, 404);
  });

  // ── Rolzichtbaarheid: trainers_bestuur ──────────────────────────────────────
  let bestuurDocId = 0;
  await test("beheer maakt en publiceert een trainers_bestuur-document", async () => {
    const r = await api("POST", "/", ids.owner, {
      title: "Noodprocedures staf",
      category: "noodprocedures",
      visibility: "trainers_bestuur",
      base64: PDF_V1.toString("base64"),
      originalName: "nood.pdf",
      publish: true,
    });
    assert.equal(r.status, 201);
    bestuurDocId = ((await r.json()) as { id: number }).id;
  });

  await test("gewoon lid ziet het trainers_bestuur-document NIET in de lijst", async () => {
    const data = (await (await api("GET", "/", ids.lid)).json()) as { documents: { id: number }[] };
    assert.ok(!data.documents.some((d) => d.id === bestuurDocId));
  });

  await test("gewoon lid krijgt 404 bij directe download van trainers_bestuur", async () => {
    const r = await api("GET", `/${bestuurDocId}/download`, ids.lid);
    assert.equal(r.status, 404);
  });

  await test("trainer ziet en downloadt het trainers_bestuur-document wél", async () => {
    const data = (await (await api("GET", "/", ids.trainer)).json()) as { documents: { id: number }[] };
    assert.ok(data.documents.some((d) => d.id === bestuurDocId));
    const r = await api("GET", `/${bestuurDocId}/download`, ids.trainer);
    assert.equal(r.status, 200);
  });

  await test("ouder krijgt 403 bij het trainers_bestuur-document", async () => {
    const r = await api("GET", `/${bestuurDocId}/download`, ids.ouder);
    assert.equal(r.status, 403);
  });

  // ── Ouder-ingang ────────────────────────────────────────────────────────────
  await test("gekoppelde ouder kan het leden_en_ouders-document downloaden", async () => {
    const r = await api("GET", `/${ledenDocId}/download`, ids.ouder);
    assert.equal(r.status, 200);
    const buf = Buffer.from(await r.arrayBuffer());
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  });

  await test("niet-lid zonder ouderkoppeling: lijst 403, download 403", async () => {
    const lijst = await api("GET", "/", ids.buiten);
    assert.equal(lijst.status, 403);
    const dl = await api("GET", `/${ledenDocId}/download`, ids.buiten);
    assert.equal(dl.status, 403);
  });

  // ── Bijwerken & verwijderen ─────────────────────────────────────────────────
  await test("beheer wijzigt titel/zichtbaarheid; lid mag niet", async () => {
    const nee = await api("PATCH", `/${ledenDocId}`, ids.lid, { title: "Hack" });
    assert.equal(nee.status, 403);
    const ja = await api("PATCH", `/${ledenDocId}`, ids.owner, { title: "Gedragscode 2026" });
    assert.equal(ja.status, 200);
    const row = (await ja.json()) as { title: string };
    assert.equal(row.title, "Gedragscode 2026");
  });

  await test("verwijderen: lid 403, beheer ok (alle versies mee weg)", async () => {
    const nee = await api("DELETE", `/${ledenDocId}`, ids.lid);
    assert.equal(nee.status, 403);
    const ja = await api("DELETE", `/${ledenDocId}`, ids.owner);
    assert.equal(ja.status, 200);
    // Daarna niet meer zichtbaar voor beheer.
    const data = (await (await api("GET", "/", ids.owner)).json()) as { documents: { id: number }[] };
    assert.ok(!data.documents.some((d) => d.id === ledenDocId));
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
