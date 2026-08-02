// SPARKI_BUILD_04 F2 — klant, sporter en betaler.
//
// Bewijst:
//   1. Klant aanmaken: klantnummer per trainer oplopend, server-side; klant
//      is standaard zelf de betalende partij.
//   2. Ouder-met-twee-kinderen: één klant, twee sporterkoppelingen.
//   3. Betaalpartij wisselen (werkgever betaalt): oude partij eindigt met
//      historie, nieuwe actief.
//   4. Eigendom: andere trainer ziet/raakt de klant niet (404).
//   5. Koppeling beëindigen is soft-end (historie blijft).
//
// Run: pnpm --filter @workspace/api-server run test:trainer-clients

import type { Server } from "node:http";
import {
  db,
  trainerClientsTable,
  clientAthleteLinksTable,
  billingPartiesTable,
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

const TRAINER = "test-trcl-trainer";
const OTHER = "test-trcl-other";
const KID1 = "test-trcl-kind1";
const KID2 = "test-trcl-kind2";
const ALL = [TRAINER, OTHER, KID1, KID2];
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
  const clients = await db
    .select({ id: trainerClientsTable.id })
    .from(trainerClientsTable)
    .where(inArray(trainerClientsTable.trainerClerkId, ALL));
  const ids = clients.map((c) => c.id);
  if (ids.length) {
    await db.delete(billingPartiesTable).where(inArray(billingPartiesTable.clientId, ids));
    await db.delete(clientAthleteLinksTable).where(inArray(clientAthleteLinksTable.clientId, ids));
    await db.delete(trainerClientsTable).where(inArray(trainerClientsTable.id, ids));
  }
  await db.delete(athleteProfilesTable).where(inArray(athleteProfilesTable.clerkId, ALL));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ALL));
}

async function main() {
  await cleanup();
  for (const id of ALL) await ensureAccount(id, `${id}@example.test`, id, silentLogger);
  server = app.listen(0);
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;

  let clientId = 0;

  await scenario("klant aanmaken: nummer server-side oplopend + betaalpartij = klant zelf", async () => {
    const r1 = await api(TRAINER, "POST", "/api/trainer/clients", {
      name: "Fam. De Vries",
      clientType: "ouder",
      email: "devries@example.test",
    });
    assert(r1.status === 201, `create: ${r1.status}: ${JSON.stringify(r1.json)}`);
    assert(r1.json.clientNumber === 1, `nummer 1, kreeg ${r1.json.clientNumber}`);
    clientId = r1.json.id;
    const r2 = await api(TRAINER, "POST", "/api/trainer/clients", { name: "Bedrijf B.V.", clientType: "bedrijf" });
    assert(r2.json.clientNumber === 2, `nummer 2, kreeg ${r2.json.clientNumber}`);
    const party = await api(TRAINER, "GET", `/api/trainer/clients/${clientId}/billing-party`);
    assert(party.json?.name === "Fam. De Vries", "betaalpartij = klant zelf");
  });

  await scenario("ouder met twee kinderen: één klant, twee koppelingen", async () => {
    const l1 = await api(TRAINER, "POST", `/api/trainer/clients/${clientId}/athletes`, {
      athleteClerkId: KID1,
      relationType: "ouder",
    });
    const l2 = await api(TRAINER, "POST", `/api/trainer/clients/${clientId}/athletes`, {
      athleteClerkId: KID2,
      relationType: "ouder",
    });
    assert(l1.status === 201 && l2.status === 201, `koppelingen: ${l1.status}/${l2.status}`);
    // Idempotent
    const l1b = await api(TRAINER, "POST", `/api/trainer/clients/${clientId}/athletes`, {
      athleteClerkId: KID1,
      relationType: "ouder",
    });
    assert(l1b.status === 200 && l1b.json.id === l1.json.id, "dubbel koppelen idempotent");
    const list = await api(TRAINER, "GET", `/api/trainer/clients/${clientId}/athletes`);
    assert(list.json.length === 2, `twee koppelingen, kreeg ${list.json.length}`);
  });

  await scenario("betaalpartij wisselen: historie blijft, nieuwe actief", async () => {
    const r = await api(TRAINER, "PUT", `/api/trainer/clients/${clientId}/billing-party`, {
      name: "Werkgever B.V.",
      vatNumber: "NL000000000B01",
    });
    assert(r.status === 200 && r.json.name === "Werkgever B.V.", `wissel: ${r.status}`);
    const all = await db
      .select()
      .from(billingPartiesTable)
      .where(eq(billingPartiesTable.clientId, clientId));
    assert(all.length === 2, "oude partij bewaard als historie");
    assert(all.some((p) => p.endedAt !== null) && all.some((p) => p.endedAt === null), "één actief, één beëindigd");
  });

  await scenario("eigendom: andere trainer krijgt 404 op klant en subresources", async () => {
    const g = await api(OTHER, "PATCH", `/api/trainer/clients/${clientId}`, { name: "Kaping" });
    const a = await api(OTHER, "POST", `/api/trainer/clients/${clientId}/athletes`, {
      athleteClerkId: OTHER,
      relationType: "zelf",
    });
    const p = await api(OTHER, "GET", `/api/trainer/clients/${clientId}/billing-party`);
    assert(g.status === 404 && a.status === 404 && p.status === 404, `${g.status}/${a.status}/${p.status}`);
  });

  await scenario("koppeling beëindigen = soft-end, historie blijft", async () => {
    const list = await api(TRAINER, "GET", `/api/trainer/clients/${clientId}/athletes`);
    const link = list.json.find((l: any) => l.athleteClerkId === KID2);
    const d = await api(TRAINER, "DELETE", `/api/trainer/clients/${clientId}/athletes/${link.id}`);
    assert(d.status === 200 && d.json.endedAt, `soft-end: ${d.status}`);
    const rows = await db
      .select()
      .from(clientAthleteLinksTable)
      .where(eq(clientAthleteLinksTable.id, link.id));
    assert(rows.length === 1 && rows[0]!.endedAt, "rij bewaard met endedAt");
    const again = await api(TRAINER, "DELETE", `/api/trainer/clients/${clientId}/athletes/${link.id}`);
    assert(again.status === 404, "tweede keer beëindigen eerlijk 404");
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
