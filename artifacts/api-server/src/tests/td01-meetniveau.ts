// TRAINEN_DOELEN_SEIZOEN_01 — F2 bewijstest (meetniveau + signalen + TD-17).
//
// Bewijs (bouwpakket §5, F2):
//  1. Meetniveau is per sporter te kiezen (GET/PUT, met uitleg per niveau).
//  2. Per uitgevoerde sessie wordt vastgelegd welke signalen er feitelijk
//     binnenkwamen — op het ingest-moment, nooit geraden.
//  3. Rit onder het gekozen niveau ⇒ eerlijke melding (TD-17, nooit stil);
//     rit op niveau ⇒ geen melding.
//  4. Bestaande rijen van vóór F2 blijven signals=null (eerlijk onbekend).
//
// Run: node ./scripts/run-test.mjs td01-meetniveau --dev-auth

import { eq } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  trainingSessionsTable,
} from "@workspace/db";
import app from "../app";
import type { Server } from "node:http";
import { ingestManualSession } from "../lib/manual-session-ingest";
import {
  deriveSessionSignals,
  effectiveLevel,
  measurementGapNote,
} from "../lib/measurement-level";

const USER = "test_td01_meetniveau";
type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
async function scenario(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({ scenario: name, status: "fail", note: err instanceof Error ? err.message : String(err) });
  }
}

let server: Server;
let base = "";
async function http(method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": USER,
    },
    ...(body != null ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, json: (await res.json().catch(() => null)) as any };
}

async function cleanup() {
  await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, USER));
  await db.delete(athleteProfilesTable).where(eq(athleteProfilesTable.clerkId, USER));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, USER));
}

async function main() {
  await cleanup();
  await db.insert(userProfilesTable).values({
    clerkId: USER,
    email: `${USER}@example.com`,
    displayName: USER,
    roles: ["athlete"],
    activeRole: "athlete",
  });
  await db.insert(athleteProfilesTable).values({ clerkId: USER });

  server = app.listen(0);
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;

  await scenario("meetniveau kiezen: GET levert uitleg, PUT valideert en bewaart", async () => {
    const before = await http("GET", "/api/athlete/measurement-level");
    assert(before.status === 200 && before.json.measurementLevel === null, "verwacht null vóór keuze");
    assert(before.json.levels?.pro?.uitleg && before.json.levels?.aanwezigheid?.uitleg, "uitleg per niveau ontbreekt");
    const bad = await http("PUT", "/api/athlete/measurement-level", { measurementLevel: "supersonisch" });
    assert(bad.status === 400, `onzinniveau moet 400 geven, kreeg ${bad.status}`);
    const ok = await http("PUT", "/api/athlete/measurement-level", { measurementLevel: "pro" });
    assert(ok.status === 200 && ok.json.measurementLevel === "pro", "PUT pro faalde");
  });

  let zonderMeterId = 0;
  await scenario("ingest legt feitelijke signalen vast (nooit geraden)", async () => {
    const a = await ingestManualSession(USER, {
      sessionDate: "2026-08-01",
      type: "duur",
      durationMin: 90,
    } as Parameters<typeof ingestManualSession>[1]);
    zonderMeterId = a.session.id;
    const [rowA] = await db
      .select({ signals: trainingSessionsTable.signals })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.id, a.session.id));
    assert(
      rowA?.signals && rowA.signals.duration === true && rowA.signals.power === false && rowA.signals.hr === false,
      `signalen zonder meter kloppen niet: ${JSON.stringify(rowA?.signals)}`,
    );
    const b = await ingestManualSession(USER, {
      sessionDate: "2026-08-02",
      type: "interval",
      durationMin: 60,
      avgPower: 210,
      avgHR: 152,
    } as Parameters<typeof ingestManualSession>[1]);
    const [rowB] = await db
      .select({ signals: trainingSessionsTable.signals })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.id, b.session.id));
    assert(
      rowB?.signals && rowB.signals.power === true && rowB.signals.hr === true && rowB.signals.duration === true,
      `signalen met meter kloppen niet: ${JSON.stringify(rowB?.signals)}`,
    );
  });

  await scenario("TD-17: rit onder gekozen niveau geeft eerlijke melding; op niveau geen", async () => {
    const zonderMeter = deriveSessionSignals({ durationMin: 90 });
    assert(effectiveLevel("pro", zonderMeter) === "tijd_gevoel", "effectief niveau moet eerlijk terugvallen");
    const note = measurementGapNote("pro", zonderMeter);
    assert(note && note.includes("vermogen") && note.includes("hartslag"), `melding onvolledig: ${note}`);
    const metMeter = deriveSessionSignals({ avgPower: 210, avgHR: 152, durationMin: 60 });
    assert(measurementGapNote("pro", metMeter) === null, "op niveau mag er geen melding zijn");
    assert(measurementGapNote(null, zonderMeter) === null, "zonder keuze geen melding");
  });

  await scenario("rij van vóór F2 blijft signals=null (eerlijk onbekend)", async () => {
    const [legacy] = await db
      .insert(trainingSessionsTable)
      .values({
        clerkId: USER,
        sessionDate: "2019-04-04",
        type: "duur",
        durationMin: 120,
        source: "manual",
      })
      .returning({ id: trainingSessionsTable.id, signals: trainingSessionsTable.signals });
    assert(legacy && legacy.signals === null, "directe insert zonder signalen hoort null te blijven");
    void zonderMeterId;
  });

  await cleanup();
  server.close();

  let failed = 0;
  for (const r of results) {
    if (r.status === "fail") failed += 1;
    console.log(`${r.status === "pass" ? "PASS" : "FAIL"} — ${r.scenario}${r.note ? ` · ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} groen`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Testrun-fout:", err);
  try { await cleanup(); } catch { /* best effort */ }
  try { server?.close(); } catch { /* ok */ }
  await pool.end();
  process.exit(1);
});
