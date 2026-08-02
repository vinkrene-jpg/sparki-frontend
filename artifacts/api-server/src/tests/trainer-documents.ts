// SPARKI_BUILD_04 F4 — trainerdocumenten op de gedeelde werkobjectlaag.
//
// Bewijst:
//   1. Catalogusvalidatie: type buiten rolcatalogus K wordt geweigerd (400).
//   2. Nieuw plan ZONDER historie ⇒ eerlijk leeg concept (geen verzonnen
//      basis), mét alle 18 plansecties incl. de kernvier.
//   3. Intake-wizard: stappen als secties, per stap opslaan met versiecheck
//      (409 op verouderde basisversie), hervatten toont opgeslagen stap.
//   4. Nieuw jaarplan MET vorig jaarplan ⇒ concept met bron (copiedFromId +
//      brondata-sectie benoemt de bron); sporterfeedback/trainernotities
//      gaan nooit mee.
//   5. Trainernotities blijven ongedeeld: status blijft concept tot de
//      trainer expliciet deelt.
//   6. Cross-account fail-closed: andere trainer 404; clubroutes zien
//      trainerdocumenten niet (scope-scheiding).
//
// Run: pnpm --filter @workspace/api-server run test:trainer-documents

import type { Server } from "node:http";
import {
  db,
  workObjectsTable,
  workObjectSectionsTable,
  workObjectHistoryTable,
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

const T1 = "test-trdoc-trainer1";
const T2 = "test-trdoc-trainer2";
const ALL = [T1, T2];
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
  const objs = await db
    .select({ id: workObjectsTable.id })
    .from(workObjectsTable)
    .where(inArray(workObjectsTable.ownerTrainerClerkId, ALL));
  const ids = objs.map((o) => o.id);
  if (ids.length) {
    await db.delete(workObjectHistoryTable).where(inArray(workObjectHistoryTable.objectId, ids));
    await db.delete(workObjectSectionsTable).where(inArray(workObjectSectionsTable.objectId, ids));
    await db.delete(workObjectsTable).where(inArray(workObjectsTable.id, ids));
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

  await scenario("type buiten rolcatalogus K geweigerd", async () => {
    const r = await api(T1, "POST", "/api/trainer/documents", {
      objectType: "staffevaluatie",
      title: "Mag niet",
    });
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
  });

  let plan1 = 0;
  await scenario("nieuw jaarplan zonder historie: eerlijk leeg + 18 secties", async () => {
    const r = await api(T1, "POST", "/api/trainer/documents", {
      objectType: "jaarplan",
      title: "Jaarplan 2026",
    });
    assert(r.status === 201, `create: ${r.status}: ${JSON.stringify(r.json)}`);
    assert(r.json.copiedFromId === null, "geen verzonnen bron");
    plan1 = r.json.id;
    const d = await api(T1, "GET", `/api/trainer/documents/${plan1}`);
    assert(d.json.sections.length === 18, `18 secties, kreeg ${d.json.sections.length}`);
    for (const kern of ["ai_concept", "brondata", "onzekerheid", "menselijke_bevestiging"]) {
      assert(d.json.sections.some((s: any) => s.title === kern), `kernsectie ${kern}`);
    }
    assert(d.json.sections.every((s: any) => s.content === ""), "alle secties eerlijk leeg");
  });

  await scenario("intake-wizard: per stap opslaan, versiecheck, hervatten", async () => {
    const r = await api(T1, "POST", "/api/trainer/documents", {
      objectType: "intake",
      title: "Intake sporter X",
    });
    assert(r.status === 201, `intake: ${r.status}`);
    const d = await api(T1, "GET", `/api/trainer/documents/${r.json.id}`);
    assert(d.json.sections.length === 5, `5 stappen, kreeg ${d.json.sections.length}`);
    const stap1 = d.json.sections[0];
    const s1 = await api(T1, "PUT", `/api/trainer/documents/${r.json.id}/sections/${stap1.id}`, {
      content: "Doel: eerste granfondo.",
      baseVersion: stap1.version,
    });
    assert(s1.status === 200, `stap opslaan: ${s1.status}`);
    // Verouderde basisversie ⇒ 409 (gelijktijdig bewerken eerlijk gemeld).
    const s1b = await api(T1, "PUT", `/api/trainer/documents/${r.json.id}/sections/${stap1.id}`, {
      content: "Overschrijven met oude versie",
      baseVersion: stap1.version,
    });
    assert(s1b.status === 409, `verouderde versie: verwacht 409, kreeg ${s1b.status}`);
    // Hervatten: opnieuw openen toont de opgeslagen stap.
    const d2 = await api(T1, "GET", `/api/trainer/documents/${r.json.id}`);
    assert(d2.json.sections[0].content === "Doel: eerste granfondo.", "hervatten toont opgeslagen stap");
  });

  await scenario("nieuw jaarplan mét vorig jaarplan: concept met bron", async () => {
    // Vul het eerste plan deels, ook de niet-meekopieerbare delen.
    const d = await api(T1, "GET", `/api/trainer/documents/${plan1}`);
    for (const naam of ["doel", "trainernotities", "sporterfeedback"]) {
      const sec = d.json.sections.find((s: any) => s.title === naam);
      await api(T1, "PUT", `/api/trainer/documents/${plan1}/sections/${sec.id}`, {
        content: `${naam}-inhoud 2026`,
        baseVersion: sec.version,
      });
    }
    const r = await api(T1, "POST", "/api/trainer/documents", {
      objectType: "jaarplan",
      title: "Jaarplan 2027",
    });
    assert(r.status === 201 && r.json.copiedFromId === plan1, `bron: ${r.json.copiedFromId}`);
    const d2 = await api(T1, "GET", `/api/trainer/documents/${r.json.id}`);
    const brondata = d2.json.sections.find((s: any) => s.title === "brondata");
    assert(brondata.content.includes(`#${plan1}`), "brondata benoemt de bron");
    const doel = d2.json.sections.find((s: any) => s.title === "doel");
    assert(doel.content === "doel-inhoud 2026", "vast onderdeel als concept overgenomen");
    for (const naam of ["trainernotities", "sporterfeedback"]) {
      const sec = d2.json.sections.find((s: any) => s.title === naam);
      assert(sec.content === "", `${naam} gaat nooit mee`);
    }
    const bevestiging = d2.json.sections.find((s: any) => s.title === "menselijke_bevestiging");
    assert(bevestiging.content === "", "menselijke bevestiging nooit voorgevuld");
  });

  await scenario("delen is expliciet: concept blijft concept", async () => {
    const d = await api(T1, "GET", `/api/trainer/documents/${plan1}`);
    assert(d.json.status === "concept" && d.json.sharedAt === null, "niet stilzwijgend gedeeld");
    const s = await api(T1, "POST", `/api/trainer/documents/${plan1}/status`, { status: "gedeeld" });
    assert(s.status === 200 && s.json.sharedAt, "expliciet delen werkt");
  });

  await scenario("cross-account en scope-scheiding fail-closed", async () => {
    const peek = await api(T2, "GET", `/api/trainer/documents/${plan1}`);
    const poke = await api(T2, "POST", `/api/trainer/documents/${plan1}/status`, { status: "afgerond" });
    assert(peek.status === 404 && poke.status === 404, `${peek.status}/${poke.status}`);
    // Scope: trainerdocumenten hebben geen clubId (DB-CHECK) — clubroutes
    // filteren op clubId en kunnen deze rijen dus niet zien.
    const [row] = await db.select().from(workObjectsTable).where(eq(workObjectsTable.id, plan1));
    assert(row!.clubId === null && row!.ownerTrainerClerkId === T1, "scope exclusief trainer");
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
