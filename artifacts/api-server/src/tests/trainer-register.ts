// SPARKI_BUILD_04 F1 — zelfstandige trainer: registratie en profiel.
//
// Bewijst:
//   1. Registratie zonder club of team: rol coach + trainersprofiel, geen
//      clublidmaatschap aangemaakt; idempotent.
//   2. Profiel zonder bedrijfsgegevens blokkeert facturatie (billingReady
//      false + eerlijke ontbrekende velden), niet de begeleiding.
//   3. Bedrijfsgegevens compleet ⇒ billingReady true.
//   4. Factuurreeks (BB-64): startnummer instellen mag, terugzetten wordt
//      geweigerd (409).
//   5. TRAINER is een geldige commerciële tier in de bestaande laag (geen
//      tweede entitlementengine).
//
// Run: pnpm --filter @workspace/api-server run test:trainer-register

import type { Server } from "node:http";
import {
  db,
  COMMERCIAL_TIERS,
  clubMembersTable,
  trainerBusinessTable,
  trainerProfilesTable,
  userProfilesTable,
  athleteProfilesTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
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

const TRAINER = "test-trainreg-zelfstandig";
const ALL = [TRAINER];
let server: Server;
let base: string;

async function api(clerkId: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-clerk-id": clerkId },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* leeg */
  }
  return { status: res.status, json: json as any };
}

async function cleanup() {
  await db.delete(trainerBusinessTable).where(inArray(trainerBusinessTable.clerkId, ALL));
  await db.delete(trainerProfilesTable).where(inArray(trainerProfilesTable.clerkId, ALL));
  await db.delete(athleteProfilesTable).where(inArray(athleteProfilesTable.clerkId, ALL));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ALL));
}

async function main() {
  await cleanup();
  await ensureAccount(TRAINER, `${TRAINER}@example.test`, TRAINER, silentLogger);
  server = app.listen(0);
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;

  await scenario("registratie zonder club: rol coach, profiel, geen clublidmaatschap", async () => {
    const r = await api(TRAINER, "POST", "/api/trainer/register", { displayName: "Coach Zelf" });
    assert(r.status === 201, `register: ${r.status}: ${JSON.stringify(r.json)}`);
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, TRAINER));
    assert(profile!.roles.includes("coach"), "rol coach toegekend");
    const memberships = await db
      .select()
      .from(clubMembersTable)
      .where(eq(clubMembersTable.clerkId, TRAINER));
    assert(memberships.length === 0, "geen clublidmaatschap aangemaakt");
    // Idempotent: nogmaals registreren breekt niets en dupliceert de rol niet.
    const r2 = await api(TRAINER, "POST", "/api/trainer/register", {});
    assert(r2.status === 201, `tweede register: ${r2.status}`);
    const [p2] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, TRAINER));
    assert(p2!.roles.filter((x) => x === "coach").length === 1, "rol niet gedupliceerd");
  });

  await scenario("zonder bedrijfsgegevens: facturatie geblokkeerd, begeleiding niet", async () => {
    const b = await api(TRAINER, "GET", "/api/trainer/business");
    assert(b.json.billingReady === false, "billingReady false zonder gegevens");
    assert(
      Array.isArray(b.json.missingForBilling) && b.json.missingForBilling.length > 0,
      "eerlijke lijst ontbrekende velden",
    );
    // Begeleiding: het trainersprofiel is gewoon bewerkbaar zonder onderneming.
    const p = await api(TRAINER, "PATCH", "/api/trainer/profile", {
      bio: "Wielrentrainer.",
      specialisations: ["tijdrit", "jeugd"],
    });
    assert(p.status === 200 && p.json.specialisations.length === 2, "profiel werkt zonder bedrijf");
  });

  await scenario("complete bedrijfsgegevens: billingReady true", async () => {
    const r = await api(TRAINER, "PATCH", "/api/trainer/business", {
      companyName: "Zelf Coaching",
      address: "Teststraat 1, Testdorp",
      iban: "NL00TEST0123456789",
      kvkNumber: "12345678",
      paymentTermDays: 14,
      invoicePrefix: "ZC",
      nextInvoiceNumber: 251,
    });
    assert(r.status === 200, `business: ${r.status}: ${JSON.stringify(r.json)}`);
    assert(r.json.billingReady === true, `billingReady: ${JSON.stringify(r.json.missingForBilling)}`);
  });

  await scenario("BB-64: factuurreeks terugzetten geweigerd", async () => {
    const lager = await api(TRAINER, "PATCH", "/api/trainer/business", { nextInvoiceNumber: 100 });
    assert(lager.status === 409, `terugzetten: verwacht 409, kreeg ${lager.status}`);
    const hoger = await api(TRAINER, "PATCH", "/api/trainer/business", { nextInvoiceNumber: 300 });
    assert(hoger.status === 200 && hoger.json.business.nextInvoiceNumber === 300, "vooruit mag");
  });

  await scenario("TRAINER is een tier in de bestaande entitlementlaag", () => {
    assert((COMMERCIAL_TIERS as readonly string[]).includes("TRAINER"), "tier bestaat");
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
