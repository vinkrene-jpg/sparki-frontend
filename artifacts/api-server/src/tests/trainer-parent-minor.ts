// SPARKI_BUILD_04 F12 — ouder en minderjarige in de trainerlaag.
//
// Bewijst de vier testeisen uit het bouwpakket (§F12):
//  1. Twee kinderen bij één ouder-klant: één trainer_clients-rij (ouder),
//     twee client_athlete_links, elk met eigen kindcontext.
//  2. Overgang naar meerderjarigheid: athleteAdultNow is een AFGELEIDE
//     waarheid uit de geboortedatum (geen opgeslagen vlag) — kind <18 false,
//     nu-volwassen true, onbekende geboortedatum eerlijk null.
//  3. BB-71 (HARDE REGEL): een onbetaalde, verlopen factuur blokkeert NOOIT
//     veiligheidsinformatie — de ouderomgeving (safety_only) blijft de
//     gezondheidsmelding tonen; de code raadpleegt daar geen factuurstatus.
//  4. Ouder probeert coachadvies over het kind te zien: op safety_only komt
//     géén trainingsschema/coachadvies mee (marker-string afwezig).
//
// Draait op de echte Express-app met x-dev-clerk-id (DEV_AUTH_BYPASS).
// Cleanup verwijdert uitsluitend eigen rijen, vóór én na.

import type { Server } from "node:http";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  privacySettingsTable,
  parentAthleteLinksTable,
  parentReportsTable,
  plannedWorkoutsTable,
  trainerBusinessTable,
  trainerClientsTable,
  clientAthleteLinksTable,
  billingPartiesTable,
  trainerInvoicesTable,
  trainerInvoiceLinesTable,
  creditNotesTable,
  trainerServicesTable,
  recurringBillingTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount } from "../lib/account";

const TRAINER = "test-trparent-trainer";
const PARENT = "test-trparent-ouder";
const KID_MINOR = "test-trparent-kind1"; // 14 jaar
const KID_ADULT = "test-trparent-kind2"; // net 18
const ALL = [TRAINER, PARENT, KID_MINOR, KID_ADULT];

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as never;

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

async function api(
  actor: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
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

function isoYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() - 30); // ruim voorbij de verjaardag
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(d);
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
  await db.delete(parentReportsTable).where(inArray(parentReportsTable.athleteClerkId, ALL));
  await db.delete(plannedWorkoutsTable).where(inArray(plannedWorkoutsTable.clerkId, ALL));
  await db.delete(parentAthleteLinksTable).where(inArray(parentAthleteLinksTable.parentClerkId, ALL));
  await db.delete(privacySettingsTable).where(inArray(privacySettingsTable.clerkId, ALL));
  await db.delete(athleteProfilesTable).where(inArray(athleteProfilesTable.clerkId, ALL));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ALL));
}

async function main(): Promise<void> {
  await cleanup();
  for (const id of ALL) {
    await ensureAccount(id, `${id}@test.sparki.local`, id, silentLogger);
  }
  // Ouder-rol (ensureAccount geeft standaard alleen "athlete").
  await db
    .update(userProfilesTable)
    .set({ roles: ["athlete", "parent"] })
    .where(eq(userProfilesTable.clerkId, PARENT));
  // Geboortedata: kind1 = 14 jaar (minderjarig), kind2 = 18 (net volwassen).
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: isoYearsAgo(14) })
    .where(eq(athleteProfilesTable.clerkId, KID_MINOR));
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: isoYearsAgo(18) })
    .where(eq(athleteProfilesTable.clerkId, KID_ADULT));

  server = app.listen(0);
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;

  let clientId = 0;
  let linkMinorId = 0;

  await scenario("F12: twee kinderen bij één ouder-klant, elk eigen kindcontext", async () => {
    const client = await api(TRAINER, "POST", "/api/trainer/clients", {
      name: "Ouder Jansen",
      clientType: "ouder",
      clientClerkId: PARENT,
    });
    assert(client.status === 201, `klant: ${client.status}: ${JSON.stringify(client.json)}`);
    clientId = client.json.id;
    const l1 = await api(TRAINER, "POST", `/api/trainer/clients/${clientId}/athletes`, {
      athleteClerkId: KID_MINOR,
      relationType: "ouder",
    });
    const l2 = await api(TRAINER, "POST", `/api/trainer/clients/${clientId}/athletes`, {
      athleteClerkId: KID_ADULT,
      relationType: "ouder",
    });
    assert(l1.status === 201 && l2.status === 201, `links: ${l1.status}/${l2.status}`);
    linkMinorId = l1.json.id;
    const list = await api(TRAINER, "GET", `/api/trainer/clients/${clientId}/athletes`);
    assert(list.json.length === 2, "twee koppelingen");
    const ids = list.json.map((l: any) => l.athleteClerkId).sort();
    assert(ids[0] === KID_MINOR && ids[1] === KID_ADULT, "juiste kindcontext per koppeling");
  });

  await scenario("F12: overgang naar 18 is afgeleid, nooit een opgeslagen vlag", async () => {
    const list = await api(TRAINER, "GET", `/api/trainer/clients/${clientId}/athletes`);
    const minor = list.json.find((l: any) => l.athleteClerkId === KID_MINOR);
    const adult = list.json.find((l: any) => l.athleteClerkId === KID_ADULT);
    assert(minor.athleteAdultNow === false, "14-jarige: adultNow=false");
    assert(adult.athleteAdultNow === true, "18-jarige: adultNow=true");
    // Onbekende geboortedatum = eerlijk null (nooit gegokt).
    await db
      .update(athleteProfilesTable)
      .set({ birthDate: null, birthYear: null })
      .where(eq(athleteProfilesTable.clerkId, KID_MINOR));
    const list2 = await api(TRAINER, "GET", `/api/trainer/clients/${clientId}/athletes`);
    const unknown = list2.json.find((l: any) => l.athleteClerkId === KID_MINOR);
    assert(unknown.athleteAdultNow === null, "onbekend = null");
    await db
      .update(athleteProfilesTable)
      .set({ birthDate: isoYearsAgo(14) })
      .where(eq(athleteProfilesTable.clerkId, KID_MINOR));
  });

  await scenario("BB-71: onbetaalde verlopen factuur blokkeert veiligheidsinfo NOOIT", async () => {
    // Ouderkoppeling in de ouderomgeving (geaccepteerd, safety_only default).
    await db.insert(parentAthleteLinksTable).values({
      parentClerkId: PARENT,
      athleteClerkId: KID_MINOR,
      status: "accepted",
      ageTierAtConsent: "u16",
    });
    // Openstaande veiligheidsmelding (ziek) van het kind.
    const report = await api(PARENT, "POST", `/api/parent/athletes/${KID_MINOR}/reports`, {
      kind: "ziek",
      note: "VEILIGHEIDSMELDING-BB71 koorts sinds vannacht",
    });
    assert(report.status === 201 || report.status === 200, `melding: ${report.status}`);
    // Onbetaalde, verlopen factuur voor deze ouder-klant.
    const draft = await api(TRAINER, "POST", "/api/trainer/billing/invoices/draft", {
      clientId,
      lines: [{ description: "Maandbegeleiding", unitPriceCents: 9900 }],
    });
    await api(TRAINER, "PATCH", "/api/trainer/business", {
      companyName: "Jeugdcoach BV",
      invoicePrefix: "JC-",
      nextInvoiceNumber: 1,
    });
    const sent = await api(TRAINER, "POST", `/api/trainer/billing/invoices/${draft.json.id}/send`);
    assert(sent.status === 200, `send: ${sent.status}`);
    await db
      .update(trainerInvoicesTable)
      .set({ dueDate: "2026-01-01" })
      .where(eq(trainerInvoicesTable.id, draft.json.id));
    const det = await api(TRAINER, "GET", `/api/trainer/billing/invoices/${draft.json.id}`);
    assert(det.json.isOverdue === true, "factuur staat echt open en is te laat");
    // De ouderomgeving blijft de veiligheidsmelding gewoon tonen.
    const reports = await api(PARENT, "GET", `/api/parent/athletes/${KID_MINOR}/reports`);
    assert(reports.status === 200, `reports: ${reports.status}`);
    assert(
      JSON.stringify(reports.json).includes("VEILIGHEIDSMELDING-BB71"),
      "veiligheidsmelding zichtbaar ondanks onbetaalde factuur",
    );
    const overview = await api(PARENT, "GET", "/api/parent/overview");
    assert(overview.status === 200, `overview: ${overview.status} — nooit geblokkeerd op betaling`);
  });

  await scenario("F12: ouder ziet op safety_only géén coachadvies/trainingsschema", async () => {
    // Coachadvies-marker als gepland workout van het kind.
    await db.insert(plannedWorkoutsTable).values({
      clerkId: KID_MINOR,
      scheduledDate: "2099-01-01",
      type: "ride",
      title: "COACHADVIES-GEHEIM-F12 intervaltraining",
      source: "coach",
    } as any);
    const overview = await api(PARENT, "GET", "/api/parent/overview");
    assert(overview.status === 200, `overview: ${overview.status}`);
    assert(
      !JSON.stringify(overview.json).includes("COACHADVIES-GEHEIM-F12"),
      "coachadvies-marker mag op safety_only nergens meekomen",
    );
    const ctx = await api(PARENT, "GET", `/api/parent/athletes/${KID_MINOR}/context`);
    assert(
      !JSON.stringify(ctx.json ?? {}).includes("COACHADVIES-GEHEIM-F12"),
      "ook de contextweergave lekt geen coachadvies",
    );
  });

  await cleanup();
  server.close();
  const total = 4;
  console.log(`${total - failures}/${total} passed, ${failures} failed.`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
