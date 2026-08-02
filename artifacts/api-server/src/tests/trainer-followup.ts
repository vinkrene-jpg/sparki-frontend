// SPARKI_BUILD_04 F14 — facturatiewerkplek: opvolging, startscherm, rapportage.
//
// Testeisen uit het bouwpakket (§F14):
//  1. Twaalf blokken in VASTE volgorde (3b-A) + één primaire actie.
//  2. Te laat met betaalafspraak (datum + afspraak = feit, geen incasso).
//  3. Oninbaar markeren kan alleen MET reden (400 zonder).
//  4. Omzet per kwartaal in de rapportage (btw-overzicht informatief).
//  5. Communicatie (herinnering) terugvindbaar in de klanthistorie; het
//     betaalgedrag is een feit (gem. betaaltermijn, keer te laat), geen score.
//  Mirror: een automatische aanmaning of stigmatiserende betaalscore = afkeur —
//  structureel geborgd: er bestaat geen automatisch pad; dit bewijst de
//  handmatige paden en de feiten-vorm van betaalgedrag.

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
  trainerClientEventsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount } from "../lib/account";

const T1 = "test-trfollow-trainer1";
const ALL = [T1];

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
  await db.delete(trainerClientEventsTable).where(inArray(trainerClientEventsTable.trainerClerkId, ALL));
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

const BLOCK_ORDER = [
  "openstaand_bedrag",
  "te_laat",
  "deze_maand_gefactureerd",
  "concepten",
  "verstuurd",
  "betaald",
  "gecrediteerd",
  "eerstvolgend_facturatiemoment",
  "klanten_zonder_actieve_afspraak",
  "ontbrekende_gegevens",
  "exportstatus",
  "laatste_wijzigingen",
];

async function main(): Promise<void> {
  await cleanup();
  for (const id of ALL) await ensureAccount(id, `${id}@test.sparki.local`, id, silentLogger);

  server = app.listen(0);
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;

  let clientId = 0;
  let invoiceId = 0;

  // Opzet: klant + bedrijfsgegevens + één verzonden, verlopen factuur.
  const client = await api(T1, "POST", "/api/trainer/clients", {
    name: "Klant Opvolging",
    clientType: "particulier",
    email: "opvolging@test.sparki.local",
  });
  clientId = client.json.id;
  await api(T1, "PATCH", "/api/trainer/business", {
    companyName: "Opvolg Coaching",
    invoicePrefix: "OV-",
    nextInvoiceNumber: 1,
  });
  const draft = await api(T1, "POST", "/api/trainer/billing/invoices/draft", {
    clientId,
    lines: [{ description: "Coaching april", unitPriceCents: 12000 }],
  });
  invoiceId = draft.json.id;
  await api(T1, "POST", `/api/trainer/billing/invoices/${invoiceId}/send`);
  await db
    .update(trainerInvoicesTable)
    .set({ dueDate: "2026-01-15" })
    .where(eq(trainerInvoicesTable.id, invoiceId));

  await scenario("F14: startscherm heeft de twaalf blokken in vaste volgorde + één primaire actie", async () => {
    const dash = await api(T1, "GET", "/api/trainer/billing/dashboard");
    assert(dash.status === 200, `dashboard: ${dash.status}`);
    const keys = dash.json.blocks.map((b: any) => b.key);
    assert(JSON.stringify(keys) === JSON.stringify(BLOCK_ORDER), `volgorde wijkt af: ${keys.join(",")}`);
    // 12000 excl + 21% btw = 14520 incl.
    assert(dash.json.blocks[0].amountCents === 14520, "openstaand bedrag klopt");
    assert(dash.json.blocks[1].count === 1, "te laat geteld");
    // Eén primaire actie: geen concepten meer ⇒ oudste te-late factuur.
    assert(dash.json.primaryAction?.kind === "te_laat_opvolgen", "primaire actie = te laat opvolgen");
    assert(dash.json.primaryAction.invoiceId === invoiceId, "verwijst naar de juiste factuur");
  });

  await scenario("F14: te laat met betaalafspraak — feit met datum, geen incasso", async () => {
    const bad = await api(T1, "POST", `/api/trainer/billing/invoices/${invoiceId}/payment-agreement`, {
      note: "zonder datum",
    });
    assert(bad.status === 400, `zonder datum: ${bad.status}`);
    const ok = await api(T1, "POST", `/api/trainer/billing/invoices/${invoiceId}/payment-agreement`, {
      date: "2026-09-01",
      note: "Betaalt na salarisdatum",
    });
    assert(ok.status === 200, `afspraak: ${ok.status}`);
    assert(ok.json.paymentAgreementDate === "2026-09-01", "afspraakdatum vastgelegd");
    assert(ok.json.status !== "betaald", "status onaangeroerd — een afspraak is geen betaling");
  });

  await scenario("F14: oninbaar alleen mét reden", async () => {
    const bad = await api(T1, "POST", `/api/trainer/billing/invoices/${invoiceId}/uncollectible`, {});
    assert(bad.status === 400, `zonder reden: ${bad.status}`);
    // Eerst herinnering en notitie (voor de klanthistorie-check hierna).
    const rem = await api(T1, "POST", `/api/trainer/billing/invoices/${invoiceId}/reminder`);
    assert(rem.status === 200, `herinnering: ${rem.status}`);
    const note = await api(T1, "POST", `/api/trainer/billing/invoices/${invoiceId}/note`, {
      body: "Klant gebeld, belooft betaling.",
    });
    assert(note.status === 201, `notitie: ${note.status}`);
    const ok = await api(T1, "POST", `/api/trainer/billing/invoices/${invoiceId}/uncollectible`, {
      reason: "Klant is failliet verklaard",
    });
    assert(ok.status === 200 && ok.json.status === "oninbaar", `oninbaar: ${ok.status}`);
    assert(ok.json.uncollectibleReason === "Klant is failliet verklaard", "reden bewaard");
  });

  await scenario("F14: omzet per kwartaal + informatief btw-overzicht", async () => {
    const year = new Date().getFullYear();
    const rep = await api(T1, "GET", `/api/trainer/billing/reports?year=${year}`);
    assert(rep.status === 200, `reports: ${rep.status}`);
    const quarters = Object.keys(rep.json.perQuarter);
    assert(quarters.length >= 1 && quarters[0]!.startsWith("K"), "kwartaalomzet aanwezig");
    assert(rep.json.totalCents === 14520, `jaaromzet: ${rep.json.totalCents}`);
    assert(rep.json.vatOverview.note.includes("geen btw-aangifte"), "btw expliciet informatief");
    const bad = await api(T1, "GET", "/api/trainer/billing/reports?year=20x6");
    assert(bad.status === 400, "ongeldig jaar = 400");
  });

  await scenario("F14: communicatie en betaalgedrag terugvindbaar in de klanthistorie, als feiten", async () => {
    const hist = await api(T1, "GET", `/api/trainer/billing/clients/${clientId}/history`);
    assert(hist.status === 200, `history: ${hist.status}`);
    const kinds = hist.json.events.map((e: any) => e.kind);
    for (const expected of ["verzending", "herinnering", "notitie", "betaalafspraak", "oninbaar"]) {
      assert(kinds.includes(expected), `event '${expected}' terugvindbaar`);
    }
    const pb = hist.json.paymentBehavior;
    assert("avgPaymentDays" in pb && "timesLate" in pb, "betaalgedrag = feiten");
    assert(!("score" in pb) && !("color" in pb) && !("rating" in pb), "geen score of kleurcode");
    assert(pb.timesLate === 1, `keer te laat: ${pb.timesLate}`);
  });

  await cleanup();
  server.close();
  console.log(`${5 - failures}/5 passed, ${failures} failed.`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
