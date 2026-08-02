// SPARKI_BUILD_04 F13 — AI-concepten: testeisen uit het bouwpakket.
//
//  1. Geen kruisbestuiving (Mirror: één gegeven van klant A in een concept
//     voor klant B is directe afkeur): buildClientDraftContext bouwt de
//     context uitsluitend uit rijen van de opgegeven klant — een marker in
//     de notities van klant B komt nooit in de context van klant A.
//  2. Factuuromschrijving zonder bedrag: stripMoneyClaims verwijdert
//     deterministisch elk bedrag-/btw-patroon; bedragen komen alleen van de
//     trainer (F6/F8).
//  3. Concept blijft concept: een conceptaanvraag verandert nooit de status
//     van een bestaande factuur — ook niet wanneer de AI-poort weigert.
//  4. Cross-account: andermans klant = 404 (fail-closed vóór enige AI-stap).

import type { Server } from "node:http";
import {
  db,
  userProfilesTable,
  trainerClientsTable,
  trainerBusinessTable,
  billingPartiesTable,
  clientAthleteLinksTable,
  trainerInvoicesTable,
  trainerInvoiceLinesTable,
  trainerServicesTable,
  recurringBillingTable,
  creditNotesTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount } from "../lib/account";
import { buildClientDraftContext, stripMoneyClaims } from "../routes/trainer-ai-drafts";

const T1 = "test-traidraft-trainer1";
const T2 = "test-traidraft-trainer2";
const ALL = [T1, T2];

const silentLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as never;

let server: Server;
let base = "";
let failures = 0;

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}
async function scenario(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    failures++;
    console.log(`✗ ${name}: ${err}`);
  }
}
async function api(actor: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-clerk-id": actor },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json: any = null;
  try {
    json = JSON.parse(await res.text());
  } catch {
    /* leeg */
  }
  return { status: res.status, json };
}

async function cleanup(): Promise<void> {
  const invIds = (
    await db
      .select({ id: trainerInvoicesTable.id })
      .from(trainerInvoicesTable)
      .where(inArray(trainerInvoicesTable.trainerClerkId, ALL))
  ).map((r) => r.id);
  if (invIds.length)
    await db.delete(trainerInvoiceLinesTable).where(inArray(trainerInvoiceLinesTable.invoiceId, invIds));
  await db.delete(creditNotesTable).where(inArray(creditNotesTable.trainerClerkId, ALL));
  await db.delete(trainerInvoicesTable).where(inArray(trainerInvoicesTable.trainerClerkId, ALL));
  await db.delete(recurringBillingTable).where(inArray(recurringBillingTable.trainerClerkId, ALL));
  await db.delete(trainerServicesTable).where(inArray(trainerServicesTable.trainerClerkId, ALL));
  const clientIds = (
    await db
      .select({ id: trainerClientsTable.id })
      .from(trainerClientsTable)
      .where(inArray(trainerClientsTable.trainerClerkId, ALL))
  ).map((r) => r.id);
  if (clientIds.length) {
    await db.delete(billingPartiesTable).where(inArray(billingPartiesTable.clientId, clientIds));
    await db.delete(clientAthleteLinksTable).where(inArray(clientAthleteLinksTable.clientId, clientIds));
  }
  await db.delete(trainerClientsTable).where(inArray(trainerClientsTable.trainerClerkId, ALL));
  await db.delete(trainerBusinessTable).where(inArray(trainerBusinessTable.clerkId, ALL));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ALL));
}

async function main(): Promise<void> {
  await cleanup();
  for (const id of ALL) await ensureAccount(id, `${id}@test.sparki.local`, id, silentLogger);

  server = app.listen(0);
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;

  let clientA = 0;
  let clientB = 0;

  await scenario("F13: geen kruisbestuiving — klant B-marker komt nooit in context van klant A", async () => {
    const a = await api(T1, "POST", "/api/trainer/clients", {
      name: "Klant A",
      clientType: "particulier",
      note: "MARKER-KLANT-A houdt van lange duurritten",
    });
    const b = await api(T1, "POST", "/api/trainer/clients", {
      name: "Klant B",
      clientType: "particulier",
      note: "GEHEIM-KLANT-B blessuregeschiedenis knie",
    });
    assert(a.status === 201 && b.status === 201, `klanten: ${a.status}/${b.status}`);
    clientA = a.json.id;
    clientB = b.json.id;
    const ctxA = await buildClientDraftContext(T1, clientA);
    assert(ctxA, "context A bestaat");
    assert(ctxA!.context.includes("MARKER-KLANT-A"), "eigen notitie aanwezig");
    assert(!ctxA!.context.includes("GEHEIM-KLANT-B"), "GEEN gegeven van klant B in context van A");
    assert(!ctxA!.context.includes("Klant B"), "zelfs de naam van klant B ontbreekt");
  });

  await scenario("F13: factuuromschrijving zonder bedrag — bedrag-/btw-patronen gestript", async () => {
    const dirty =
      "Coaching maart: 4 sessies à € 75,00, totaal 300 euro exclusief 21% btw. Btw-tarief: 21%.";
    const { text, stripped } = stripMoneyClaims(dirty);
    assert(stripped === true, "strip gemeld");
    assert(!text.includes("€") && !/\b\d+\s?%/.test(text) && !/\b300\s?euro/i.test(text), `schoon: ${text}`);
    assert(text.includes("[bedrag door trainer]"), "eerlijke placeholder");
    const clean = stripMoneyClaims("Vier coachingsessies in maart, inclusief voorbespreking.");
    assert(clean.stripped === false && !clean.text.includes("[bedrag"), "schone tekst blijft onaangetast");
  });

  await scenario("F13: concept blijft concept — conceptaanvraag muteert nooit een factuurstatus", async () => {
    const draft = await api(T1, "POST", "/api/trainer/billing/invoices/draft", {
      clientId: clientA,
      lines: [{ description: "Handmatige regel", unitPriceCents: 5000 }],
    });
    assert(draft.status === 201 && draft.json.status === "concept", `factuur: ${draft.status}`);
    // Conceptaanvraag (slaagt of wordt door de AI-poort geweigerd — beide OK;
    // het bewijs is dat de factuur onaangeroerd blijft en niets verzonden is).
    const gen = await api(T1, "POST", "/api/trainer/ai-drafts", {
      clientId: clientA,
      kind: "factuuromschrijving",
    });
    assert([200, 403, 500].includes(gen.status), `gen: ${gen.status}`);
    if (gen.status === 200) {
      assert(gen.json.isConcept === true, "expliciet concept");
      assert(!/€|\d+\s?%|\d+\s?euro/i.test(gen.json.draft), "geen bedrag in AI-omschrijving");
    }
    const after = await api(T1, "GET", `/api/trainer/billing/invoices/${draft.json.id}`);
    assert(after.json.status === "concept" && after.json.invoiceNumber === null, "factuur onaangeroerd, niets verzonden");
  });

  await scenario("F13: andermans klant = 404 vóór enige AI-stap", async () => {
    const gen = await api(T2, "POST", "/api/trainer/ai-drafts", { clientId: clientA, kind: "intake" });
    assert(gen.status === 404, `cross-account: ${gen.status}`);
    const bad = await api(T1, "POST", "/api/trainer/ai-drafts", { clientId: clientB, kind: "onzin" });
    assert(bad.status === 400, `ongeldig kind: ${bad.status}`);
  });

  await cleanup();
  server.close();
  console.log(`${4 - failures}/4 passed, ${failures} failed.`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
