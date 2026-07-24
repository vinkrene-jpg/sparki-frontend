// Sparki Foundation — regressietest.
//
// Bewijst:
//   1. Flag-gate: zonder `ai_foundation`-flag is de hele foundation 403;
//      met een user-override werkt hij (nothing auto-on).
//   2. GET /api/foundation/status meldt eerlijk wat er beschikbaar is en
//      wat ontbreekt (ontbrekend-lijst, geen verzinsels).
//   3. POST /api/foundation/analyse draait alle 7 engines: snapshot, model,
//      strategie, patronen, ≥2 scenario's (nooit één verplicht advies),
//      uitleg met berekeningsketen van 7 stappen en vertrouwen < 100.
//   4. Kennis-engine: registerEvidence + kwaliteitsscore deterministisch;
//      findEvidence vindt op tags.
//   5. Athlete-model-uitbreidingen: POST /model/extensions is idempotent
//      (upsert) en komt terug in de analyse.
//   6. Cross-account: de analyse van A bevat nooit sessies van B.
//
// Run: `pnpm --filter @workspace/api-server run test:ai-foundation`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  trainingSessionsTable,
  userProfilesTable,
  athleteProfilesTable,
  athleteModelExtensionsTable,
  knowledgeItemsTable,
  knowledgeEvidenceTable,
  computationTracesTable,
  userFlagOverridesTable,
  featureFlagsTable,
} from "@workspace/db";
import { eq, inArray, like } from "drizzle-orm";

const RUN = `test_foundation_${Date.now()}`;
const A = `${RUN}_a`;
const B = `${RUN}_b`;
const ALL = [A, B];

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
    json = text ? JSON.parse(text) : null;
  } catch {
    /* leeg */
  }
  return { status: res.status, json };
}

// Bewaar/herstel de globale flag-rij zodat de dev-omgeving niet verandert.
let savedFlag: { enabledGlobally: boolean; enabledRoles: string[] } | null = null;
let flagExisted = false;

async function disableFlagGlobally() {
  const [row] = await db
    .select()
    .from(featureFlagsTable)
    .where(eq(featureFlagsTable.key, "ai_foundation"));
  if (row) {
    flagExisted = true;
    savedFlag = {
      enabledGlobally: row.enabledGlobally,
      enabledRoles: row.enabledRoles,
    };
    await db
      .update(featureFlagsTable)
      .set({ enabledGlobally: false, enabledRoles: [] })
      .where(eq(featureFlagsTable.key, "ai_foundation"));
  }
}

async function restoreFlag() {
  if (flagExisted && savedFlag) {
    await db
      .update(featureFlagsTable)
      .set(savedFlag)
      .where(eq(featureFlagsTable.key, "ai_foundation"));
  }
}

let seededItemId: number | null = null;

async function cleanup() {
  await restoreFlag().catch(() => {});
  if (seededItemId != null) {
    await db
      .delete(knowledgeEvidenceTable)
      .where(eq(knowledgeEvidenceTable.knowledgeItemId, seededItemId))
      .catch(() => {});
    await db
      .delete(knowledgeItemsTable)
      .where(eq(knowledgeItemsTable.id, seededItemId))
      .catch(() => {});
  }
  await db
    .delete(computationTracesTable)
    .where(inArray(computationTracesTable.clerkId, ALL))
    .catch(() => {});
  await db
    .delete(athleteModelExtensionsTable)
    .where(inArray(athleteModelExtensionsTable.clerkId, ALL))
    .catch(() => {});
  await db
    .delete(userFlagOverridesTable)
    .where(inArray(userFlagOverridesTable.clerkId, ALL))
    .catch(() => {});
  await db
    .delete(trainingSessionsTable)
    .where(inArray(trainingSessionsTable.clerkId, ALL))
    .catch(() => {});
  await db
    .delete(athleteProfilesTable)
    .where(inArray(athleteProfilesTable.clerkId, ALL))
    .catch(() => {});
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, ALL))
    .catch(() => {});
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split("T")[0]!;
}

async function main() {
  const { default: app } = await import("../app");
  const { ensureAccount, silentLogger } = await import("../lib/account");
  const { createKnowledgeEngine } = await import("../engines/ai-foundation");

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

  await ensureAccount(A, `${A}@test.local`, "Foundation A", silentLogger);
  await ensureAccount(B, `${B}@test.local`, "Foundation B", silentLogger);

  await disableFlagGlobally();

  // Seed: sessies voor A (met TSS), één herkenbare sessie voor B.
  const sessions = [] as Array<typeof trainingSessionsTable.$inferInsert>;
  for (let i = 0; i < 12; i++) {
    sessions.push({
      clerkId: A,
      sessionDate: isoDaysAgo(3 + i * 6),
      type: "endurance",
      source: "manual",
      durationMin: 90,
      tss: 70 + (i % 3) * 10,
      title: `Foundation-rit ${i}`,
    });
  }
  sessions.push({
    clerkId: B,
    sessionDate: isoDaysAgo(5),
    type: "endurance",
    source: "manual",
    durationMin: 60,
    tss: 55,
    title: "GEHEIME_RIT_VAN_B",
  });
  await db.insert(trainingSessionsTable).values(sessions);

  await scenario("zonder flag is foundation 403 (nothing auto-on)", async () => {
    const r = await req("GET", "/api/foundation/status", A);
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
  });

  // Flag aan voor A via user-override. De flag-rij moet bestaan (FK) —
  // idempotent aanmaken, standaard uit (nothing auto-on).
  await db
    .insert(featureFlagsTable)
    .values({
      key: "ai_foundation",
      description: "Sparki Foundation — testrij",
      enabledGlobally: false,
      enabledRoles: [],
    })
    .onConflictDoNothing();
  await db.insert(userFlagOverridesTable).values({
    clerkId: A,
    flagKey: "ai_foundation",
    enabled: true,
  });

  await scenario("status meldt eerlijk beschikbaar + ontbrekend", async () => {
    const r = await req("GET", "/api/foundation/status", A);
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    assert(r.json?.beschikbaar?.sessies >= 12, "sessies niet geteld");
    assert(Array.isArray(r.json?.ontbrekend), "ontbrekend geen array");
    assert(
      r.json.ontbrekend.some((o: string) => o.startsWith("dagmetingen")),
      "ontbrekende dagmetingen niet eerlijk gemeld",
    );
    assert(Array.isArray(r.json?.engines) && r.json.engines.length === 7, "geen 7 engines");
  });

  await scenario("kennis: registerEvidence deterministisch + findEvidence op tags", async () => {
    const [item] = await db
      .insert(knowledgeItemsTable)
      .values({
        dedupeKey: `foundation_${RUN}`,
        provider: "test",
        title: `Foundation testartikel ${RUN}`,
        source: "test-journal",
        authors: ["Tester, T."],
        doi: null,
        publishedAt: "2024-01-01",
        summary: "Testartikel voor de foundation-regressietest.",
        url: `https://example.test/${RUN}`,
      } as any)
      .returning();
    assert(item, "kennisitem-seed mislukt");
    seededItemId = item!.id;

    const engine = createKnowledgeEngine();
    const rec1 = await engine.registerEvidence({
      subjectKind: "knowledge_item",
      knowledgeItemId: seededItemId,
      evidenceLevel: "rct",
      tags: [`tag_${RUN}`],
    });
    const rec2 = await engine.registerEvidence({
      subjectKind: "knowledge_item",
      knowledgeItemId: seededItemId,
      evidenceLevel: "rct",
      tags: [`tag_${RUN}`],
    });
    assert(rec1.evidenceId === rec2.evidenceId, "upsert niet idempotent");
    assert(rec1.kwaliteitsscore === rec2.kwaliteitsscore, "score niet deterministisch");
    assert(rec1.kwaliteitsscore === 80, `rct hoort 80 te scoren, kreeg ${rec1.kwaliteitsscore}`);

    const found = await engine.findEvidence({ tags: [`tag_${RUN}`] });
    assert(found.length === 1, `verwacht 1 evidence-rij, kreeg ${found.length}`);
    assert(found[0]!.titel.includes("Foundation testartikel"), "titel niet gekoppeld");
  });

  await scenario("model-uitbreiding: upsert idempotent", async () => {
    const r1 = await req("POST", "/api/foundation/model/extensions", A, {
      key: "leerstijl",
      value: "visueel",
    });
    assert(r1.status === 200, `verwacht 200, kreeg ${r1.status}`);
    const r2 = await req("POST", "/api/foundation/model/extensions", A, {
      key: "leerstijl",
      value: "praktisch",
    });
    assert(r2.status === 200, `tweede upsert faalde: ${r2.status}`);
    const rows = await db
      .select()
      .from(athleteModelExtensionsTable)
      .where(eq(athleteModelExtensionsTable.clerkId, A));
    assert(rows.length === 1, `verwacht 1 rij, kreeg ${rows.length}`);
    assert(rows[0]!.value === "praktisch", "laatste waarde wint niet");
  });

  await scenario("lege sleutel wordt geweigerd (400)", async () => {
    const r = await req("POST", "/api/foundation/model/extensions", A, {
      key: "   ",
      value: "x",
    });
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
  });

  let analyse: any = null;
  await scenario("analyse draait alle 7 engines met stappenketen", async () => {
    const r = await req("POST", "/api/foundation/analyse", A);
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    analyse = r.json;
    assert(analyse?.snapshot?.sessies?.length >= 12, "snapshot mist sessies");
    assert(analyse?.model?.leerstijl === "praktisch", "uitbreiding niet in model");
    assert(Array.isArray(analyse?.strategie?.prioriteiten), "strategie ontbreekt");
    assert(Array.isArray(analyse?.patronen), "patronen ontbreken");
    assert(analyse?.stappen?.length === 7, `verwacht 7 stappen, kreeg ${analyse?.stappen?.length}`);
    assert(
      analyse.stappen.every((s: any) => s.ok === true),
      "niet alle stappen ok",
    );
  });

  await scenario("beslisondersteuning geeft ≥2 scenario's, nooit één advies", async () => {
    const sc = analyse?.beslisondersteuning?.scenarios;
    assert(Array.isArray(sc) && sc.length >= 2, `verwacht ≥2 scenario's, kreeg ${sc?.length}`);
    for (const s of sc) {
      assert(s.kansVanSlagen?.score > 0 && s.kansVanSlagen?.score < 100, "kans niet gekalibreerd");
      assert(["laag", "middel", "hoog"].includes(s.risico), "risico ongeldig");
      assert(Array.isArray(s.verwachteEffecten), "verwachte effecten ontbreken");
    }
  });

  await scenario("uitleg: vertrouwen <100, aannames, modellen, keten", async () => {
    const u = analyse?.uitleg;
    assert(u, "uitleg ontbreekt");
    assert(u.vertrouwen?.score > 0 && u.vertrouwen?.score < 100, "vertrouwen niet gekalibreerd");
    assert(u.gebruikteModellen?.length === 7, "niet alle engineversies vermeld");
    assert(Array.isArray(u.aannames) && u.aannames.length > 0, "aannames ontbreken");
    assert(u.berekeningsketen?.length === 7, "berekeningsketen niet volledig");
  });

  await scenario("herkomst geregistreerd via data-origin (computation_traces)", async () => {
    const rows = await db
      .select()
      .from(computationTracesTable)
      .where(eq(computationTracesTable.clerkId, A));
    const found = rows.find((r) => r.subjectType === "foundation_analyse");
    assert(found, "geen computation_trace voor foundation_analyse");
    assert(found!.engine === "ai-foundation", "engine-naam onjuist");
    assert(found!.aiUsed === "nee", "aiUsed hoort 'nee' te zijn");
  });

  await scenario("cross-account: analyse van A bevat niets van B", async () => {
    const blob = JSON.stringify(analyse);
    assert(!blob.includes("GEHEIME_RIT_VAN_B"), "sessie van B lekt in analyse van A");
    const ids = new Set(
      (
        await db
          .select({ id: trainingSessionsTable.id })
          .from(trainingSessionsTable)
          .where(eq(trainingSessionsTable.clerkId, B))
      ).map((r) => r.id),
    );
    for (const s of analyse.snapshot.sessies) {
      assert(!ids.has(s.id), "sessie-id van B in snapshot van A");
    }
  });

  await scenario("B zonder flag blijft 403 op analyse", async () => {
    const r = await req("POST", "/api/foundation/analyse", B);
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
  });
}

main()
  .catch((err) => {
    results.push({
      scenario: "test-run",
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  })
  .finally(async () => {
    await cleanup().catch(() => {});
    if (server) server.close();
    const failed = results.filter((r) => r.status === "fail");
    for (const r of results) {
      console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
    process.exit(failed.length > 0 ? 1 : 0);
  });
