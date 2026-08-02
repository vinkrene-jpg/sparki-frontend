// SPARKI_BUILD_04 F5 — terugkerende coaching: conceptfacturen.
//
// Bewijst (testeisen F5):
//   1. Maandcyclus: verstreken maanden worden als CONCEPT klaargezet, met
//      periode, vervaldatum, btw en totaal; nummer is NULL (pas bij verzending).
//   2. Weekcyclus: weekperiodes correct.
//   3. Cyclus met einddatum: geen concepten voorbij de einddatum.
//   4. Concept blijft concept zonder handeling (geen enkel automatisch pad
//      naar "verzonden"); run-drafts is idempotent (geen dubbele periodes).
//   5. Ontbrekend btw-nummer wordt gemeld MET de verantwoordelijke erbij.
//   6. Cross-account: andermans cyclus/klant onzichtbaar (404).
//
// Run: pnpm --filter @workspace/api-server run test:trainer-billing

import type { Server } from "node:http";
import {
  db,
  trainerInvoicesTable,
  trainerInvoiceLinesTable,
  recurringBillingTable,
  trainerServicesTable,
  trainerClientsTable,
  clientAthleteLinksTable,
  billingPartiesTable,
  trainerBusinessTable,
  userProfilesTable,
  athleteProfilesTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

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

const T1 = "test-trbill-trainer1";
const T2 = "test-trbill-trainer2";
const ALL = [T1, T2];
let server: Server;
let base: string;

async function api(clerkId: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-clerk-id": clerkId },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* leeg */
  }
  return { status: res.status, json };
}

async function cleanup() {
  const clients = await db
    .select({ id: trainerClientsTable.id })
    .from(trainerClientsTable)
    .where(inArray(trainerClientsTable.trainerClerkId, ALL));
  const clientIds = clients.map((c) => c.id);
  const invs = await db
    .select({ id: trainerInvoicesTable.id })
    .from(trainerInvoicesTable)
    .where(inArray(trainerInvoicesTable.trainerClerkId, ALL));
  const invIds = invs.map((i) => i.id);
  if (invIds.length)
    await db.delete(trainerInvoiceLinesTable).where(inArray(trainerInvoiceLinesTable.invoiceId, invIds));
  await db.delete(trainerInvoicesTable).where(inArray(trainerInvoicesTable.trainerClerkId, ALL));
  await db.delete(recurringBillingTable).where(inArray(recurringBillingTable.trainerClerkId, ALL));
  await db.delete(trainerServicesTable).where(inArray(trainerServicesTable.trainerClerkId, ALL));
  if (clientIds.length) {
    await db.delete(billingPartiesTable).where(inArray(billingPartiesTable.clientId, clientIds));
    await db.delete(clientAthleteLinksTable).where(inArray(clientAthleteLinksTable.clientId, clientIds));
  }
  await db.delete(trainerClientsTable).where(inArray(trainerClientsTable.trainerClerkId, ALL));
  await db.delete(trainerBusinessTable).where(inArray(trainerBusinessTable.clerkId, ALL));
  await db.delete(athleteProfilesTable).where(inArray(athleteProfilesTable.clerkId, ALL));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ALL));
}

async function main() {
  await cleanup();
  for (const id of ALL) await ensureAccount(id, `${id}@example.test`, id, silentLogger);
  server = app.listen(0);
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;

  await api(T1, "POST", "/api/trainer/register", {});
  await api(T2, "POST", "/api/trainer/register", {});
  const klantA = await api(T1, "POST", "/api/trainer/clients", {
    name: "Klant A",
    email: "a@example.test",
    companyName: "A BV", // bedrijfsklant zónder btw-nummer ⇒ signaal
  });
  assert(klantA.status === 201, `klant: ${klantA.status}`);
  const clientId = klantA.json.id;

  await scenario("maandcyclus zet verstreken maanden als concept klaar", async () => {
    const cyc = await api(T1, "POST", "/api/trainer/billing/recurring-billing", {
      clientId,
      cycle: "maandelijks",
      description: "Coaching maandpakket",
      amountCents: 15000,
      startDate: "2026-05-01",
      paymentTermDays: 14,
    });
    assert(cyc.status === 201, `cyclus: ${cyc.status}: ${JSON.stringify(cyc.json)}`);
    const run = await api(T1, "POST", "/api/trainer/billing/recurring-billing/run-drafts", {
      today: "2026-08-02",
    });
    // Mei, juni, juli volledig verstreken ⇒ 3 concepten.
    assert(run.json.count === 3, `verwacht 3 concepten, kreeg ${run.json.count}`);
    const inv = run.json.created[0];
    assert(inv.status === "concept" && inv.invoiceNumber === null, "concept zonder nummer");
    assert(inv.periodStart === "2026-05-01" && inv.periodEnd === "2026-05-31", "periode mei");
    assert(inv.dueDate === "2026-06-14", `vervaldatum: ${inv.dueDate}`);
    assert(inv.amountExclCents === 15000 && inv.amountInclCents === 18150, "btw 21% en totaal");
  });

  await scenario("run-drafts is idempotent (geen dubbele periodes)", async () => {
    const again = await api(T1, "POST", "/api/trainer/billing/recurring-billing/run-drafts", {
      today: "2026-08-02",
    });
    assert(again.json.count === 0, `tweede run: ${again.json.count} nieuwe concepten`);
  });

  await scenario("weekcyclus met einddatum: niets voorbij de einddatum", async () => {
    const klantB = await api(T1, "POST", "/api/trainer/clients", {
      name: "Klant B",
      email: "b@example.test",
    });
    const cyc = await api(T1, "POST", "/api/trainer/billing/recurring-billing", {
      clientId: klantB.json.id,
      cycle: "wekelijks",
      description: "Weekbegeleiding",
      amountCents: 5000,
      startDate: "2026-07-06",
      endDate: "2026-07-19", // precies twee weken
    });
    assert(cyc.status === 201, `cyclus: ${cyc.status}`);
    const run = await api(T1, "POST", "/api/trainer/billing/recurring-billing/run-drafts", {
      today: "2026-08-02",
    });
    assert(run.json.count === 2, `verwacht 2 weekconcepten, kreeg ${run.json.count}`);
    const periods = run.json.created.map((i: any) => `${i.periodStart}..${i.periodEnd}`).sort();
    assert(
      periods[0] === "2026-07-06..2026-07-12" && periods[1] === "2026-07-13..2026-07-19",
      `periodes: ${periods.join(", ")}`,
    );
  });

  await scenario("concept blijft concept zonder handeling", async () => {
    // Geen enkel automatisch pad zet iets op "verzonden": her-run + signalen
    // opvragen en dan de status verifiëren.
    await api(T1, "POST", "/api/trainer/billing/recurring-billing/run-drafts", { today: "2026-08-02" });
    await api(T1, "GET", "/api/trainer/billing/signals");
    const rows = await db
      .select({ status: trainerInvoicesTable.status })
      .from(trainerInvoicesTable)
      .where(inArray(trainerInvoicesTable.trainerClerkId, [T1]));
    assert(rows.length === 5 && rows.every((r) => r.status === "concept"), "alles nog concept");
  });

  await scenario("btw-signaal noemt de verantwoordelijke", async () => {
    const sig = await api(T1, "GET", "/api/trainer/billing/signals");
    const klant = sig.json.find((s: any) => s.kind === "btw_ontbreekt_klant");
    const zelf = sig.json.find((s: any) => s.kind === "btw_ontbreekt_onderneming");
    assert(klant && klant.message.includes("Klant A"), "klant-signaal met verantwoordelijke");
    assert(zelf && zelf.message.includes("jijzelf"), "eigen-btw-signaal met verantwoordelijke");
    assert(sig.json.filter((s: any) => s.kind === "concept_klaar").length === 5, "concept-signalen");
  });

  await scenario("cross-account fail-closed", async () => {
    const r = await api(T2, "POST", "/api/trainer/billing/recurring-billing", {
      clientId,
      cycle: "maandelijks",
      description: "Kaping",
      amountCents: 1,
      startDate: "2026-01-01",
    });
    assert(r.status === 404, `andermans klant: ${r.status}`);
    const list = await api(T2, "GET", "/api/trainer/billing/recurring-billing");
    assert(Array.isArray(list.json) && list.json.length === 0, "andermans cycli onzichtbaar");
  });

  server.close();
  await cleanup();
  const failed = results.filter((r) => r.status === "fail");
  console.log(`\n${results.length - failed.length}/${results.length} passed, ${failed.length} failed.`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
