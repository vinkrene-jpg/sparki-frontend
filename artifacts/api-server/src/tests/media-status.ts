// MEDIA_UITLEG_01 F4 — integratietest voor /api/media-status.
//
// Boot de ECHTE Express-app en toetst de vier statuscalls tegen de dev-DB:
// aanbod + D-3-versiewisselregel (hoogstens één her-aanbod per versie),
// D-4 (historie/first_offered_at blijft), D-1 (acuut: nooit "niet meer tonen"),
// D-2 fail-closed (minderjarig ÉN onbekende leeftijd geweigerd),
// D-7 cross-account-afscherming, en strikte veld-whitelist.
//
// Run: `pnpm --filter @workspace/api-server run test:media-status`
// Vereist: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  mediaContentStatusTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import app from "../app";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const RUN = `test_mediastatus_${Date.now()}`;
const adult = `${RUN}_adult`;
const minor = `${RUN}_minor`;
const unknown = `${RUN}_unknown`;
const other = `${RUN}_other`;
const ALL = [adult, minor, unknown, other];
const CONTENT = `${RUN}_uitleg_ftp`;
let failures = 0;

let baseUrl = "";
let server: Server | null = null;

async function scenario(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${name}: ${err instanceof Error ? err.message : err}`);
  }
}

async function call(
  user: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}/api/media-status${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": user,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function main() {
  // Testgebruikers: volwassen (1990), jeugd (2012), leeftijd onbekend, en een
  // tweede account voor cross-account-afscherming.
  for (const id of ALL) {
    await db
      .insert(userProfilesTable)
      .values({ clerkId: id, email: `${id}@test.invalid` })
      .onConflictDoNothing();
  }
  await db.insert(athleteProfilesTable).values([
    { clerkId: adult, birthDate: "1990-05-01" },
    { clerkId: minor, birthDate: "2012-05-01" },
    { clerkId: other, birthDate: "1990-05-01" },
  ]);

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else reject(new Error("geen poort"));
    });
  });

  await scenario("aanbod registreren maakt rij aan; zelfde versie niet opnieuw", async () => {
    const first = await call(adult, "POST", `/${CONTENT}/offered`, { contentVersion: 1 });
    assert(first.status === 200 && first.json.offered === true, `eerste aanbod: ${JSON.stringify(first)}`);
    const again = await call(adult, "POST", `/${CONTENT}/offered`, { contentVersion: 1 });
    assert(again.json.offered === false && again.json.reason === "al_bekend", `herhaald aanbod: ${JSON.stringify(again.json)}`);
  });

  await scenario("status bijwerken: gestart→voltooid, first_offered_at blijft (D-4)", async () => {
    const before = await call(adult, "GET", `/?ids=${CONTENT}`);
    const firstOfferedAt = before.json.statuses[0]?.firstOfferedAt;
    assert(firstOfferedAt, "first_offered_at ontbreekt na aanbod");
    const started = await call(adult, "PUT", `/${CONTENT}`, { contentVersion: 1, state: "gestart", lastPositionSeconds: 42, playbackSpeed: 0.5 });
    assert(started.status === 200 && started.json.status.state === "gestart", JSON.stringify(started.json));
    const done = await call(adult, "PUT", `/${CONTENT}`, { contentVersion: 1, state: "voltooid" });
    assert(done.json.status.state === "voltooid" && done.json.status.completedAt, "voltooid zonder completedAt");
    assert(done.json.status.firstOfferedAt === firstOfferedAt, "first_offered_at is gewist of gewijzigd (D-4)");
    assert(done.json.status.lastPositionSeconds === 42, "positie kwijtgeraakt");
  });

  await scenario("versiewissel: precies één her-aanbod per nieuwe versie (D-3)", async () => {
    const re = await call(adult, "POST", `/${CONTENT}/offered`, { contentVersion: 2 });
    assert(re.json.offered === true && re.json.reoffer === true, `her-aanbod v2: ${JSON.stringify(re.json)}`);
    const re2 = await call(adult, "POST", `/${CONTENT}/offered`, { contentVersion: 2 });
    assert(re2.json.offered === false && re2.json.reason === "al_bekend", `tweede v2-aanbod: ${JSON.stringify(re2.json)}`);
  });

  await scenario("niet meer tonen: volwassene mag; daarna geen aanbod meer", async () => {
    const put = await call(adult, "PUT", `/${CONTENT}`, { contentVersion: 2, state: "overgeslagen", doNotShowAgain: true });
    assert(put.status === 200 && put.json.status.doNotShowAgain === true, JSON.stringify(put.json));
    const offer = await call(adult, "POST", `/${CONTENT}/offered`, { contentVersion: 2 });
    assert(offer.json.offered === false && offer.json.reason === "niet_meer_tonen", JSON.stringify(offer.json));
  });

  await scenario("D-2: minderjarige én onbekende leeftijd krijgen 403 op niet-meer-tonen", async () => {
    for (const u of [minor, unknown]) {
      const r = await call(u, "PUT", `/${CONTENT}`, { contentVersion: 1, state: "overgeslagen", doNotShowAgain: true });
      assert(r.status === 403, `${u}: verwacht 403, kreeg ${r.status}`);
      // Zonder doNotShowAgain mag overslaan gewoon.
      const ok = await call(u, "PUT", `/${CONTENT}`, { contentVersion: 1, state: "overgeslagen" });
      assert(ok.status === 200, `${u}: overslaan zonder vlag moet 200 zijn`);
    }
  });

  await scenario("D-1: acute content weigert niet-meer-tonen ook voor volwassene", async () => {
    const r = await call(adult, "PUT", `/acuut:${CONTENT}`, { contentVersion: 1, state: "bekeken", doNotShowAgain: true });
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
  });

  await scenario("D-7: cross-account — ander account ziet en overschrijft niets", async () => {
    const read = await call(other, "GET", `/?ids=${CONTENT}`);
    assert(read.json.statuses.length === 0, "ander account ziet andermans status");
    await call(other, "PUT", `/${CONTENT}`, { contentVersion: 1, state: "gestart" });
    const adultRead = await call(adult, "GET", `/?ids=${CONTENT}`);
    assert(adultRead.json.statuses[0].state === "overgeslagen", "andermans schrijfactie raakte deze gebruiker");
  });

  await scenario("PUT weigert versie-terugval (409) en vult first_offered_at hoogstens één keer", async () => {
    const C2 = `${CONTENT}_v2pad`;
    // Rij ontstaat via PUT (zonder aanbod): first_offered_at is dan leeg.
    const started = await call(adult, "PUT", `/${C2}`, { contentVersion: 3, state: "gestart" });
    assert(started.json.status.firstOfferedAt === null, "first_offered_at hoort leeg te zijn zonder aanbod");
    // Latere 'aangeboden'-PUT vult hem alsnog — maar precies één keer.
    const offered = await call(adult, "PUT", `/${C2}`, { contentVersion: 3, state: "aangeboden" });
    const stamp = offered.json.status.firstOfferedAt;
    assert(stamp, "first_offered_at niet gevuld bij aangeboden-status");
    const offered2 = await call(adult, "PUT", `/${C2}`, { contentVersion: 3, state: "aangeboden" });
    assert(offered2.json.status.firstOfferedAt === stamp, "first_offered_at overschreven (D-4)");
    // Verouderde client met lagere versie wordt geweigerd.
    const stale = await call(adult, "PUT", `/${C2}`, { contentVersion: 2, state: "voltooid" });
    assert(stale.status === 409, `versie-terugval: verwacht 409, kreeg ${stale.status}`);
  });

  await scenario("D-3 onder gelijktijdigheid: dubbel her-aanbod kan niet", async () => {
    const C3 = `${CONTENT}_race`;
    await call(adult, "POST", `/${C3}/offered`, { contentVersion: 1 });
    const [a, b] = await Promise.all([
      call(adult, "POST", `/${C3}/offered`, { contentVersion: 2 }),
      call(adult, "POST", `/${C3}/offered`, { contentVersion: 2 }),
    ]);
    const offeredCount = [a, b].filter((r) => r.json?.offered === true).length;
    assert(offeredCount === 1, `precies één her-aanbod verwacht, kreeg ${offeredCount} (${JSON.stringify([a.json, b.json])})`);
  });

  await scenario("whitelist: onbekende velden en ongeldige waarden geven 400", async () => {
    const bad = await call(adult, "PUT", `/${CONTENT}`, { contentVersion: 1, state: "gestart", inhoud: "x" });
    assert(bad.status === 400, `onbekend veld: ${bad.status}`);
    const badState = await call(adult, "PUT", `/${CONTENT}`, { contentVersion: 1, state: "misschien" });
    assert(badState.status === 400, `ongeldige toestand: ${badState.status}`);
    const badVersion = await call(adult, "PUT", `/${CONTENT}`, { contentVersion: 0, state: "gestart" });
    assert(badVersion.status === 400, `ongeldige versie: ${badVersion.status}`);
    const badEvent = await call(adult, "POST", `/${CONTENT}/event`, { contentVersion: 1, eventType: "iets_anders" });
    assert(badEvent.status === 400, `onbekend gebeurtenistype: ${badEvent.status}`);
    const okEvent = await call(adult, "POST", `/${CONTENT}/event`, { contentVersion: 1, eventType: "weergave_gestart" });
    assert(okEvent.status === 200, `geldig gebeurtenistype: ${okEvent.status}`);
  });

  // Opruimen: alleen eigen rijen.
  await db.delete(mediaContentStatusTable).where(inArray(mediaContentStatusTable.clerkId, ALL));
  await db.delete(athleteProfilesTable).where(inArray(athleteProfilesTable.clerkId, ALL));
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ALL));

  if (server) await new Promise<void>((r) => server!.close(() => r()));
  await pool.end();
  if (failures > 0) {
    console.error(`${failures} scenario('s) gefaald`);
    process.exit(1);
  }
  console.log("Alle media-status-scenario's geslaagd");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
