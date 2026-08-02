// SPARKI_BUILD_04 F3 — klanten en sporters beheren: rechten vanaf acceptatie.
//
// Bewijst:
//   1. Zonder geaccepteerde koppeling: sporter kan NIET aan een groep worden
//      toegevoegd (403, fail-closed) — rechten gelden vanaf acceptatie.
//   2. Na acceptatie: toevoegen lukt; dubbel toevoegen is idempotent.
//   3. Ontkoppelen (endedAt): sporter verdwijnt ONMIDDELLIJK uit groepsreads
//      (read-time hercheck), rij-opruiming is geen voorwaarde.
//   4. Tweede trainer bij dezelfde sporter: eigen groepen, wederzijds
//      onzichtbaar (cross-account 404 op elkaars groepen).
//   5. Groepsnaam per trainer uniek (409 bij dubbel).
//
// Run: pnpm --filter @workspace/api-server run test:trainer-groups

import type { Server } from "node:http";
import {
  db,
  trainerGroupsTable,
  trainerGroupMembersTable,
  coachAthleteLinksTable,
  userProfilesTable,
  athleteProfilesTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
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

const T1 = "test-trgrp-trainer1";
const T2 = "test-trgrp-trainer2";
const ATH = "test-trgrp-sporter";
const ALL = [T1, T2, ATH];
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
  const groups = await db
    .select({ id: trainerGroupsTable.id })
    .from(trainerGroupsTable)
    .where(inArray(trainerGroupsTable.trainerClerkId, ALL));
  const ids = groups.map((g) => g.id);
  if (ids.length) {
    await db.delete(trainerGroupMembersTable).where(inArray(trainerGroupMembersTable.groupId, ids));
    await db.delete(trainerGroupsTable).where(inArray(trainerGroupsTable.id, ids));
  }
  await db.delete(coachAthleteLinksTable).where(inArray(coachAthleteLinksTable.coachClerkId, [T1, T2]));
  await db.delete(athleteProfilesTable).where(inArray(athleteProfilesTable.clerkId, ALL));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ALL));
}

async function main() {
  await cleanup();
  for (const id of ALL) await ensureAccount(id, `${id}@example.test`, id, silentLogger);
  server = app.listen(0);
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;

  const g1 = await api(T1, "POST", "/api/trainer/groups", { name: "Wedstrijdgroep" });
  assert(g1.status === 201, `setup groep: ${g1.status}`);
  const groupId = g1.json.id;

  await scenario("zonder geaccepteerde koppeling: toevoegen fail-closed 403", async () => {
    const r = await api(T1, "POST", `/api/trainer/groups/${groupId}/members`, { athleteClerkId: ATH });
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
    // Ook een pending link geeft géén rechten (vanaf acceptatie, BB/F3).
    await db.insert(coachAthleteLinksTable).values({ coachClerkId: T1, athleteClerkId: ATH, status: "pending" });
    const r2 = await api(T1, "POST", `/api/trainer/groups/${groupId}/members`, { athleteClerkId: ATH });
    assert(r2.status === 403, `pending: verwacht 403, kreeg ${r2.status}`);
  });

  await scenario("na acceptatie: toevoegen lukt, idempotent", async () => {
    await db
      .update(coachAthleteLinksTable)
      .set({ status: "accepted" })
      .where(and(eq(coachAthleteLinksTable.coachClerkId, T1), eq(coachAthleteLinksTable.athleteClerkId, ATH)));
    const r = await api(T1, "POST", `/api/trainer/groups/${groupId}/members`, { athleteClerkId: ATH });
    assert(r.status === 201, `add: ${r.status}`);
    const r2 = await api(T1, "POST", `/api/trainer/groups/${groupId}/members`, { athleteClerkId: ATH });
    assert(r2.status === 200 && r2.json.alreadyMember, "idempotent");
    const list = await api(T1, "GET", `/api/trainer/groups/${groupId}/members`);
    assert(list.json.length === 1, `één lid, kreeg ${list.json.length}`);
  });

  await scenario("ontkoppelen: toegang vervalt onmiddellijk (read-time hercheck)", async () => {
    await db
      .update(coachAthleteLinksTable)
      .set({ endedAt: new Date() })
      .where(and(eq(coachAthleteLinksTable.coachClerkId, T1), eq(coachAthleteLinksTable.athleteClerkId, ATH)));
    const list = await api(T1, "GET", `/api/trainer/groups/${groupId}/members`);
    assert(list.json.length === 0, `lid onzichtbaar na endedAt, kreeg ${list.json.length}`);
    const add = await api(T1, "POST", `/api/trainer/groups/${groupId}/members`, { athleteClerkId: ATH });
    assert(add.status === 403, "opnieuw toevoegen geweigerd");
  });

  await scenario("tweede trainer: eigen groepen, wederzijds onzichtbaar", async () => {
    await db.insert(coachAthleteLinksTable).values({ coachClerkId: T2, athleteClerkId: ATH, status: "accepted" });
    const g2 = await api(T2, "POST", "/api/trainer/groups", { name: "Basisgroep" });
    assert(g2.status === 201, `groep T2: ${g2.status}`);
    const add = await api(T2, "POST", `/api/trainer/groups/${g2.json.id}/members`, { athleteClerkId: ATH });
    assert(add.status === 201, `T2 add: ${add.status}`);
    // Cross-account fail-closed: T2 ziet/raakt de groep van T1 niet.
    const peek = await api(T2, "GET", `/api/trainer/groups/${groupId}/members`);
    const poke = await api(T2, "POST", `/api/trainer/groups/${groupId}/members`, { athleteClerkId: ATH });
    assert(peek.status === 404 && poke.status === 404, `${peek.status}/${poke.status}`);
    const mine = await api(T1, "GET", "/api/trainer/groups");
    assert(mine.json.every((g: any) => g.trainerClerkId === T1), "T1 ziet alleen eigen groepen");
  });

  await scenario("groepsnaam per trainer uniek", async () => {
    const dup = await api(T1, "POST", "/api/trainer/groups", { name: "Wedstrijdgroep" });
    assert(dup.status === 409, `verwacht 409, kreeg ${dup.status}`);
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
