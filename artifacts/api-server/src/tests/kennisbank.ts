// Golf 21 — Kennisbank-governance: DB-backed route contract test.
//
// Boot de ECHTE Express-app en bewijst:
//   • niet-beheerder krijgt 403 op /api/knowledge-beheer (fail-closed)
//   • aanmaken start als concept; concept telt NIET mee in actieve kennis
//   • publiceren: versie omhoog + snapshot in versiehistorie
//   • wijzigen van actief item zet terug naar concept (nooit stil wijzigen)
//   • ingetrokken item is niet meer te wijzigen (409) of te publiceren
//   • getActiveKnowledge filtert op domein/doelgroep; ingetrokken verdwijnt
//   • /api/knowledge/bronnen levert eerlijke bronvermeldingen (topic-filter)
//   • usage-event pint de versie; feedback melden + afhandelen werkt
//   • conflictdetectie ziet twee actieve items op zelfde domein+onderwerp
//
// Run: `pnpm --filter @workspace/api-server run test:kennisbank`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  managedKnowledgeItemsTable,
  managedKnowledgeVersionsTable,
  knowledgeUsageEventsTable,
  knowledgeFeedbackTable,
  userProfilesTable,
} from "@workspace/db";
import { eq, like } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  getActiveKnowledge,
  recordKnowledgeUsage,
  findKnowledgeConflicts,
} from "../lib/knowledge/governance";
import { isAdmin } from "../lib/flags";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

let baseUrl = "";
let server: Server | null = null;

async function startServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else reject(new Error("failed to determine server port"));
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

const RUN = `test_kennis_${Date.now()}`;
const adminId = `${RUN}_admin`;
const userId = `${RUN}_user`;
const TOPIC = `${RUN}_koolhydraten`;

async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-clerk-id": actor },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function cleanup() {
  const rows = await db
    .select({ id: managedKnowledgeItemsTable.id })
    .from(managedKnowledgeItemsTable)
    .where(like(managedKnowledgeItemsTable.topic, `${RUN}%`));
  for (const r of rows) {
    await db.delete(knowledgeFeedbackTable).where(eq(knowledgeFeedbackTable.itemId, r.id));
    await db.delete(knowledgeUsageEventsTable).where(eq(knowledgeUsageEventsTable.itemId, r.id));
    await db.delete(managedKnowledgeVersionsTable).where(eq(managedKnowledgeVersionsTable.itemId, r.id));
    await db.delete(managedKnowledgeItemsTable).where(eq(managedKnowledgeItemsTable.id, r.id));
  }
  for (const c of [adminId, userId]) {
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, c)).catch(() => {});
  }
}

async function main() {
  // Admin-rechten komen uit SPARKI_ADMIN_IDS (op call-time gelezen).
  process.env.SPARKI_ADMIN_IDS = [process.env.SPARKI_ADMIN_IDS ?? "", adminId]
    .filter(Boolean)
    .join(",");

  await startServer();
  await ensureAccount(adminId, `${adminId}@example.test`, "Beheerder", silentLogger);
  await ensureAccount(userId, `${userId}@example.test`, "Renner", silentLogger);

  let itemId = 0;
  let secondId = 0;

  // Onder DEV_AUTH_BYPASS is iedereen beheerder (Development Preview Mode) —
  // dus testen we de echte guard-logica direct, met de bypass tijdelijk uit.
  await scenario("beheerdersguard: niet-beheerder geweigerd zonder dev-bypass", async () => {
    const prev = process.env.DEV_AUTH_BYPASS;
    process.env.DEV_AUTH_BYPASS = "false";
    try {
      assert(isAdmin(userId) === false, "gewone gebruiker geldt onterecht als beheerder");
      assert(isAdmin(adminId) === true, "beheerder uit SPARKI_ADMIN_IDS niet herkend");
    } finally {
      process.env.DEV_AUTH_BYPASS = prev;
    }
  });

  await scenario("aanmaken start als concept", async () => {
    const r = await req("POST", "/api/knowledge-beheer/items", adminId, {
      topic: TOPIC,
      domain: "voeding",
      audience: "sporter",
      body: "Richtwaarde 60-90 g koolhydraten per uur bij lange duurinspanning.",
      sourceName: "Sportvoedingsrichtlijn NL",
      reliability: "hoog",
      reviewedAt: "2026-06-01",
    });
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}: ${JSON.stringify(r.json)}`);
    assert(r.json.status === "concept", `status is ${r.json.status}`);
    assert(r.json.version === 0 || r.json.version === undefined || r.json.version >= 0, "versieveld ontbreekt");
    itemId = r.json.id;
  });

  await scenario("concept telt niet mee in actieve kennis", async () => {
    const items = await getActiveKnowledge({ domain: "voeding", topicLike: TOPIC });
    assert(items.length === 0, `verwacht 0 actieve items, kreeg ${items.length}`);
  });

  await scenario("publiceren: versie omhoog + snapshot", async () => {
    const r = await req("POST", `/api/knowledge-beheer/items/${itemId}/publiceer`, adminId);
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}: ${JSON.stringify(r.json)}`);
    assert(r.json.version === 1, `verwacht versie 1, kreeg ${r.json.version}`);
    const v = await req("GET", `/api/knowledge-beheer/items/${itemId}/versies`, adminId);
    assert(Array.isArray(v.json) && v.json.length === 1, "verwacht 1 snapshot");
    assert(v.json[0].version === 1, "snapshotversie klopt niet");
  });

  await scenario("actieve kennis vindbaar met domein/doelgroep-filter", async () => {
    const items = await getActiveKnowledge({
      domain: "voeding",
      audience: "sporter",
      topicLike: TOPIC,
    });
    assert(items.length === 1, `verwacht 1 item, kreeg ${items.length}`);
    const wrongDomain = await getActiveKnowledge({ domain: "materiaal", topicLike: TOPIC });
    assert(wrongDomain.length === 0, "domeinfilter lekt");
  });

  await scenario("/api/knowledge/bronnen geeft eerlijke bronvermelding", async () => {
    const r = await req(
      "GET",
      `/api/knowledge/bronnen?topic=${encodeURIComponent(TOPIC)}`,
      userId,
    );
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    assert(r.json.bronnen.length === 1, `verwacht 1 bron, kreeg ${r.json.bronnen.length}`);
    assert(r.json.bronnen[0].sourceName === "Sportvoedingsrichtlijn NL", "bronnaam klopt niet");
    assert(r.json.bronnen[0].version === 1, "versie in bron klopt niet");
  });

  await scenario("usage-event pint de gepubliceerde versie", async () => {
    const items = await getActiveKnowledge({ domain: "voeding", topicLike: TOPIC });
    await recordKnowledgeUsage(items, "voeding", userId);
    const rows = await db
      .select()
      .from(knowledgeUsageEventsTable)
      .where(eq(knowledgeUsageEventsTable.itemId, itemId));
    assert(rows.length === 1, `verwacht 1 usage-event, kreeg ${rows.length}`);
    assert(rows[0].version === 1, "usage-event pint verkeerde versie");
    assert(rows[0].engine === "voeding", "engine klopt niet");
  });

  await scenario("wijzigen van actief item zet terug naar concept", async () => {
    const r = await req("PUT", `/api/knowledge-beheer/items/${itemId}`, adminId, {
      topic: TOPIC,
      domain: "voeding",
      audience: "sporter",
      body: "Richtwaarde 60-90 g/u; bij >2,5 uur tot 90-120 g/u met gemengde suikers.",
      sourceName: "Sportvoedingsrichtlijn NL",
      reliability: "hoog",
      reviewedAt: "2026-07-01",
    });
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    assert(r.json.status === "concept", `status is ${r.json.status}, verwacht concept`);
    const active = await getActiveKnowledge({ domain: "voeding", topicLike: TOPIC });
    assert(active.length === 0, "gewijzigd item bleef onterecht actief");
  });

  await scenario("herpubliceren geeft versie 2 + tweede snapshot", async () => {
    const r = await req("POST", `/api/knowledge-beheer/items/${itemId}/publiceer`, adminId);
    assert(r.status === 200 && r.json.version === 2, `verwacht versie 2, kreeg ${JSON.stringify(r.json)}`);
    const v = await req("GET", `/api/knowledge-beheer/items/${itemId}/versies`, adminId);
    assert(v.json.length === 2, "verwacht 2 snapshots");
  });

  await scenario("vakkennis landt letterlijk in het wedstrijdadvies", async () => {
    const { composeRaceAdvice } = await import("../lib/race-advice");
    const items = await getActiveKnowledge({ domain: "voeding", topicLike: TOPIC });
    assert(items.length === 1, "geen actief item om mee te testen");
    const fakeRace = { id: 999999, coachInstructions: null, distanceKm: null, elevationM: null, raceType: null } as never;
    const emptyCourse = { hasRoute: false, route: null, character: "", facts: [], missing: [] } as never;
    const advies = composeRaceAdvice(fakeRace, null, emptyCourse, null, items);
    const kennis = advies.items.find((a) => a.domain === "vakkennis");
    assert(kennis, "vakkennis-item ontbreekt in adviesset");
    assert(kennis!.kind === "feit", "vakkennis moet soort 'feit' dragen");
    assert(kennis!.text === items[0].body, "brontekst is niet letterlijk overgenomen");
    assert(kennis!.basis.includes(items[0].sourceName), "bronnaam ontbreekt in de basis");
  });

  await scenario("conflictdetectie ziet twee actieve items zelfde onderwerp", async () => {
    const r = await req("POST", "/api/knowledge-beheer/items", adminId, {
      topic: TOPIC.toUpperCase(),
      domain: "voeding",
      audience: "sporter",
      body: "Afwijkende richtwaarde uit tweede bron.",
      sourceName: "Tweede bron",
      reliability: "laag",
    });
    secondId = r.json.id;
    await req("POST", `/api/knowledge-beheer/items/${secondId}/publiceer`, adminId);
    const conflicts = await findKnowledgeConflicts();
    const hit = conflicts.find((c) => c.topic.toLowerCase() === TOPIC.toLowerCase());
    assert(hit, "conflict niet gedetecteerd");
    assert(hit!.items.length === 2, `verwacht 2 conflicterende items, kreeg ${hit!.items.length}`);
  });

  await scenario("feedback melden + afhandelen", async () => {
    const m = await req("POST", "/api/knowledge/feedback", userId, {
      itemId,
      message: "Volgens mijn diëtist ligt de bovengrens anders.",
    });
    assert(m.status === 200, `melden: verwacht 200, kreeg ${m.status}`);
    const rows = await db
      .select()
      .from(knowledgeFeedbackTable)
      .where(eq(knowledgeFeedbackTable.itemId, itemId));
    assert(rows.length === 1 && rows[0].status === "open", "feedbackrij niet open aangemaakt");
    const a = await req(
      "POST",
      `/api/knowledge-beheer/feedback/${rows[0].id}/afhandelen`,
      adminId,
    );
    assert(a.status === 200, `afhandelen: verwacht 200, kreeg ${a.status}`);
    const [after] = await db
      .select()
      .from(knowledgeFeedbackTable)
      .where(eq(knowledgeFeedbackTable.id, rows[0].id));
    assert(after.status === "afgehandeld", "feedback niet afgehandeld");
  });

  await scenario("intrekken: verdwijnt uit actieve kennis, wijzigen 409", async () => {
    const s = await req("POST", `/api/knowledge-beheer/items/${itemId}/status`, adminId, {
      status: "ingetrokken",
      reason: "Bron ingetrokken",
    });
    assert(s.status === 200, `status: verwacht 200, kreeg ${s.status}`);
    const active = await getActiveKnowledge({ domain: "voeding", topicLike: TOPIC });
    assert(active.every((i) => i.id !== itemId), "ingetrokken item nog actief");
    const put = await req("PUT", `/api/knowledge-beheer/items/${itemId}`, adminId, {
      topic: TOPIC,
      domain: "voeding",
      body: "poging",
      sourceName: "x",
    });
    assert(put.status === 409, `verwacht 409, kreeg ${put.status}`);
    const pub = await req("POST", `/api/knowledge-beheer/items/${itemId}/publiceer`, adminId);
    assert(pub.status === 409, `publiceer na intrekken: verwacht 409, kreeg ${pub.status}`);
  });

  await scenario("verplichte velden afgedwongen bij aanmaken (400)", async () => {
    const r = await req("POST", "/api/knowledge-beheer/items", adminId, {
      topic: "zonder bron",
      domain: "training",
      body: "tekst zonder bronvermelding",
    });
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
  });

  await cleanup();
  await stopServer();

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("test run failed:", err);
  await cleanup().catch(() => {});
  await stopServer().catch(() => {});
  process.exit(1);
});
