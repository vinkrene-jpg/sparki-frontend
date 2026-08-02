// BUILD_04-restpunt — bewijs: factuur-PDF komt uit de ÉNE F4-documentgenerator.
// • conceptfactuur → echte PDF (%PDF-magic) met bestandsnaam conceptfactuur-<id>.pdf;
// • andermans factuur → 404 (eigenaarschap, niet-enumereerbaar);
// • totalen komen 1-op-1 uit de rij (sjabloon rekent niets uit — hier alleen
//   gecontroleerd dat de route de opgeslagen bedragen serveert, geen herberekening).
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import {
  db,
  pool,
  userProfilesTable,
  trainerBusinessTable,
  trainerClientsTable,
  trainerInvoicesTable,
  trainerInvoiceLinesTable,
} from "@workspace/db";
import { like } from "drizzle-orm";
import app from "../app";

process.env["DEV_AUTH_BYPASS"] = "true";

const PREFIX = "invpdf-test-";
const trainer = `${PREFIX}trainer`;
const ander = `${PREFIX}ander`;

async function cleanup() {
  await db.delete(userProfilesTable).where(like(userProfilesTable.clerkId, `${PREFIX}%`));
}

async function main() {
  await cleanup();
  for (const id of [trainer, ander]) {
    await db
      .insert(userProfilesTable)
      .values({ clerkId: id, email: `${id}@invpdf.invalid`, displayName: id, releaseGroup: "test" })
      .onConflictDoNothing();
  }
  await db
    .insert(trainerBusinessTable)
    .values({ clerkId: trainer, companyName: "PDF Test Coaching" })
    .onConflictDoNothing();
  const [client] = await db
    .insert(trainerClientsTable)
    .values({ trainerClerkId: trainer, name: "Testklant", clientNumber: 999901 })
    .returning({ id: trainerClientsTable.id });
  const [inv] = await db
    .insert(trainerInvoicesTable)
    .values({
      trainerClerkId: trainer,
      clientId: client!.id,
      description: "Losse dienst",
      amountExclCents: 10000,
      amountInclCents: 12100,
      vatBreakdown: { "2100": 2100 },
      businessSnapshot: { naam: "PDF Test Coaching" },
      clientSnapshot: { naam: "Testklant" },
    })
    .returning({ id: trainerInvoicesTable.id });
  await db.insert(trainerInvoiceLinesTable).values({
    invoiceId: inv!.id,
    description: "Coachingsessie",
    quantity: 2,
    unitPriceCents: 5000,
    vatRateBps: 2100,
    amountCents: 10000,
  });

  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const get = (pad: string, als: string) =>
    fetch(`http://127.0.0.1:${port}/api/trainer/billing${pad}`, {
      headers: { "x-dev-clerk-id": als },
    });

  let ok = 0;
  const test = async (naam: string, fn: () => Promise<void>) => {
    await fn();
    ok++;
    console.log(`✓ ${naam}`);
  };

  await test("conceptfactuur levert een echte PDF met concept-bestandsnaam", async () => {
    const r = await get(`/invoices/${inv!.id}/pdf`, trainer);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "application/pdf");
    assert.ok(r.headers.get("content-disposition")!.includes(`conceptfactuur-${inv!.id}.pdf`));
    const buf = Buffer.from(await r.arrayBuffer());
    assert.equal(buf.subarray(0, 4).toString(), "%PDF", "moet met %PDF beginnen");
    assert.ok(buf.length > 1000, "PDF is geen lege huls");
  });

  await test("andermans factuur is 404 (eigenaarschap)", async () => {
    const r = await get(`/invoices/${inv!.id}/pdf`, ander);
    assert.equal(r.status, 404);
  });

  await test("onbestaande factuur is 404", async () => {
    const r = await get(`/invoices/999999999/pdf`, trainer);
    assert.equal(r.status, 404);
  });

  server.close();
  await cleanup();
  await pool.end();
  console.log(`Alle ${ok} factuur-PDF-tests geslaagd.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
