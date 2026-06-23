// Personal-context memory integration test.
//
// Exercises the deterministic detection engine + the persistence/follow-up
// lifecycle against the dev DB. Every scenario uses a disposable clerkId and is
// cleaned up afterwards, so the test is safe to re-run against a shared database.
//
// Run: `pnpm --filter @workspace/api-server run test:context-memory`
// Requires: DATABASE_URL. Exits non-zero on any failure.

import { readFileSync } from "node:fs";
import {
  db,
  pool,
  personalContextMemoriesTable,
  privacySettingsTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  detectContextMoment,
  followUpPrompt,
  captureContext,
  listContextMemories,
  getDueFollowUps,
  answerFollowUp,
  dismissFollowUp,
  setContextEnabled,
  setContextVisibility,
  deleteContextMemory,
  getAthleteContextForViewer,
} from "../engines/context-memory";

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
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

const RUN = `test_ctxmem_${Date.now()}`;
const ids: string[] = [];
function newId(tag: string): string {
  const id = `${RUN}_${tag}`;
  ids.push(id);
  return id;
}
const emailFor = (id: string) => `${id}@example.test`;

async function cleanup() {
  if (ids.length === 0) return;
  // personal_context_memories + privacy_settings cascade off user_profiles.
  await db
    .delete(personalContextMemoriesTable)
    .where(inArray(personalContextMemoriesTable.clerkId, ids));
  await db
    .delete(privacySettingsTable)
    .where(inArray(privacySettingsTable.clerkId, ids));
  const { userProfilesTable } = await import("@workspace/db");
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, ids));
}

// A fixed reference moment: Monday 2026-06-22 10:00 local. Detection timing is
// asserted relative to this so the test is deterministic.
const NOW = new Date(2026, 5, 22, 10, 0, 0);

async function main() {
  // ── Detection: ≥10 distinct categories ─────────────────────────────────────

  await scenario("detectie 1: examen/school morgen", async () => {
    const d = detectContextMoment(
      "ik heb niet getraind want ik heb morgen examen",
      NOW,
    );
    assert(d, "school niet herkend");
    assert(d!.kind === "school", `verkeerde kind: ${d!.kind}`);
    assert(d!.followUpAt, "geen follow-up gepland");
    assert(d!.followUpAt!.getHours() === 19, "follow-up niet 's avonds");
    assert(d!.followUpAt!.getDate() === 23, "follow-up niet op examendag");
  });

  await scenario("detectie 2: wedstrijd dit weekend", async () => {
    const d = detectContextMoment("ik heb een wedstrijd dit weekend", NOW);
    assert(d, "wedstrijd niet herkend");
    assert(d!.kind === "race", `verkeerde kind: ${d!.kind}`);
    assert(d!.followUpAt!.getHours() === 19, "follow-up niet 's avonds");
  });

  await scenario("detectie 3: ziek/griep", async () => {
    const d = detectContextMoment("ik ben ziek, flinke griep en koorts", NOW);
    assert(d, "ziekte niet herkend");
    assert(d!.kind === "illness", `verkeerde kind: ${d!.kind}`);
    assert(d!.importance === "high", "ziekte hoort hoog te wegen");
  });

  await scenario("detectie 4: blessure", async () => {
    const d = detectContextMoment(
      "ik heb een blessure aan mijn knie en kan niet fietsen",
      NOW,
    );
    assert(d, "blessure niet herkend");
    assert(d!.kind === "injury", `verkeerde kind: ${d!.kind}`);
    assert(d!.followUpAt, "geen follow-up voor eerste training");
  });

  await scenario("detectie 5: werk in de weg", async () => {
    const d = detectContextMoment(
      "ik moest overwerken, drukke week op werk dus niet gefietst",
      NOW,
    );
    assert(d, "werk niet herkend");
    assert(d!.kind === "work", `verkeerde kind: ${d!.kind}`);
  });

  await scenario("detectie 6: familie/thuis", async () => {
    const d = detectContextMoment(
      "het was de begrafenis van mijn opa, druk met familie",
      NOW,
    );
    assert(d, "familie niet herkend");
    assert(d!.kind === "family", `verkeerde kind: ${d!.kind}`);
    assert(d!.importance === "high", "familie hoort hoog te wegen");
  });

  await scenario("detectie 7: slecht slapen door spanning", async () => {
    const d = detectContextMoment(
      "ik heb slecht geslapen door de spanning",
      NOW,
    );
    assert(d, "slaap niet herkend");
    // Sleep wins over stress: the sentence leads with the sleep complaint.
    assert(d!.kind === "sleep", `verkeerde kind: ${d!.kind}`);
    assert(d!.emotionalTone === "gespannen", `verkeerde toon: ${d!.emotionalTone}`);
  });

  await scenario("detectie 8: pure spanning/stress", async () => {
    const d = detectContextMoment("ik heb heel veel stress deze week", NOW);
    assert(d, "stress niet herkend");
    assert(d!.kind === "stress", `verkeerde kind: ${d!.kind}`);
    assert(d!.importance === "high", "gespannen toon hoort hoog te wegen");
  });

  await scenario("detectie 9: motivatie kwijt", async () => {
    const d = detectContextMoment(
      "ik heb even geen zin meer, motivatie kwijt",
      NOW,
    );
    assert(d, "motivatie niet herkend");
    assert(d!.kind === "motivation", `verkeerde kind: ${d!.kind}`);
    assert(d!.emotionalTone === "ongemotiveerd", `verkeerde toon: ${d!.emotionalTone}`);
  });

  await scenario("detectie 10: vakantie/trainingskamp", async () => {
    const camp = detectContextMoment("ik ga volgende week op trainingskamp", NOW);
    assert(camp && camp.kind === "camp", "trainingskamp niet herkend");
    const vac = detectContextMoment("ik ben op vakantie deze week", NOW);
    assert(vac && vac.kind === "camp", "vakantie niet herkend");
    assert(camp!.followUpAt && vac!.followUpAt, "geen follow-up gepland");
  });

  await scenario("detectie 11: zware training/herstel", async () => {
    const d = detectContextMoment(
      "ik heb een rustdag genomen, benen helemaal vol",
      NOW,
    );
    assert(d, "sport/herstel niet herkend");
    assert(d!.kind === "sport", `verkeerde kind: ${d!.kind}`);
  });

  await scenario("detectie 12: irrelevante tekst geeft null", async () => {
    const d = detectContextMoment("vandaag was een mooie dag", NOW);
    assert(d === null, "onterecht een context herkend");
  });

  // ── Late return: "Je zei laatst dat ..." recall phrasing ───────────────────
  await scenario("follow-up: late terugkomst geeft laatst-formulering", async () => {
    const d = detectContextMoment("ik heb morgen examen", NOW);
    const memory = {
      kind: d!.kind,
      followUpQuestion: d!.followUpQuestion,
      followUpAt: d!.followUpAt,
    };
    // Fresh (just due) → direct question.
    const fresh = followUpPrompt(memory, new Date(d!.followUpAt!.getTime() + 1000));
    assert(fresh === d!.followUpQuestion, "verse vraag niet direct gesteld");
    // Long overdue (athlete returned days later) → gentle recall.
    const late = followUpPrompt(
      memory,
      new Date(d!.followUpAt!.getTime() + 1000 * 60 * 60 * 24 * 4),
    );
    assert(late.startsWith("Je zei laatst dat"), `geen recall-formulering: ${late}`);
    assert(late.includes("examen"), "recall noemt het onderwerp niet");
  });

  // ── Full capture → persist with scheduled follow-up + new fields ───────────
  await scenario("captureContext bewaart + plant follow-up + velden", async () => {
    const athlete = newId("capture");
    await ensureAccount(athlete, emailFor(athlete), "Pupil", silentLogger);
    const res = await captureContext(
      athlete,
      "ik heb morgen examen dus niet getraind",
    );
    assert(res.detected && !res.gated, "niet gedetecteerd of onterecht gated");
    assert(res.memory, "geen geheugen aangemaakt");
    assert(res.memory!.status === "scheduled", "status niet scheduled");
    assert(res.memory!.followUpAt, "geen follow-up tijd");
    assert(res.memory!.importance, "importance niet ingevuld");
    assert(res.memory!.visibility === "private", "visibility hoort privé te zijn");
    assert(res.memory!.followUpDone === false, "followUpDone hoort false te zijn");
  });

  // ── Privacy gate: ai_memory disabled → detected but NOT persisted ──────────
  await scenario("aiMemoryEnabled=false blokkeert opslag", async () => {
    const athlete = newId("gated");
    await ensureAccount(athlete, emailFor(athlete), "Pupil", silentLogger);
    await db
      .insert(privacySettingsTable)
      .values({ clerkId: athlete, aiMemoryEnabled: false });
    const res = await captureContext(athlete, "ik heb morgen examen");
    assert(res.detected, "had nog steeds gedetecteerd moeten worden");
    assert(res.gated, "had gated moeten zijn");
    assert(res.memory === null, "mocht niets opslaan");
    const all = await listContextMemories(athlete);
    assert(all.length === 0, "er is toch opgeslagen ondanks uitgezet geheugen");
  });

  // ── Follow-up lifecycle: due → answer → followed_up ────────────────────────
  await scenario("follow-up: due → beantwoorden zet followUpDone", async () => {
    const athlete = newId("lifecycle");
    await ensureAccount(athlete, emailFor(athlete), "Pupil", silentLogger);
    const res = await captureContext(athlete, "ik heb morgen examen");
    const id = res.memory!.id;
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const due = await getDueFollowUps(athlete, future);
    const dueItem = due.find((d) => d.id === id);
    assert(dueItem, "follow-up niet als due gevonden");
    assert(typeof dueItem!.prompt === "string" && dueItem!.prompt.length > 0, "geen prompt op due-item");
    const answered = await answerFollowUp(athlete, id, "ging goed, weer fit");
    assert(answered, "antwoord niet opgeslagen");
    assert(answered!.status === "followed_up", "status niet followed_up");
    assert(answered!.followUpDone === true, "followUpDone niet gezet");
    assert(answered!.response === "ging goed, weer fit", "antwoord niet bewaard");
    const due2 = await getDueFollowUps(athlete, future);
    assert(!due2.some((d) => d.id === id), "blijft due na beantwoorden");
  });

  // ── Dismiss path ───────────────────────────────────────────────────────────
  await scenario("follow-up: overslaan (dismiss)", async () => {
    const athlete = newId("dismiss");
    await ensureAccount(athlete, emailFor(athlete), "Pupil", silentLogger);
    const res = await captureContext(athlete, "ik heb morgen examen");
    const out = await dismissFollowUp(athlete, res.memory!.id);
    assert(out && out.status === "dismissed", "niet gedismissed");
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const due = await getDueFollowUps(athlete, future);
    assert(!due.some((d) => d.id === res.memory!.id), "dismissed nog steeds due");
  });

  // ── Athlete control: disable stops follow-ups; delete removes the row ──────
  await scenario("athleet: niet meer gebruiken en verwijderen", async () => {
    const athlete = newId("control");
    await ensureAccount(athlete, emailFor(athlete), "Pupil", silentLogger);
    const res = await captureContext(athlete, "ik heb morgen examen");
    const id = res.memory!.id;
    await setContextEnabled(athlete, id, false);
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const due = await getDueFollowUps(athlete, future);
    assert(!due.some((d) => d.id === id), "gepauzeerde memory nog due");
    const removed = await deleteContextMemory(athlete, id);
    assert(removed, "verwijderen mislukt");
    const all = await listContextMemories(athlete);
    assert(!all.some((m) => m.id === id), "memory nog aanwezig na verwijderen");
  });

  // ── Owner scoping: one athlete cannot touch another's memory ──────────────
  await scenario("eigenaarscope: vreemde id niet bewerkbaar", async () => {
    const a = newId("owner_a");
    const b = newId("owner_b");
    await ensureAccount(a, emailFor(a), "A", silentLogger);
    await ensureAccount(b, emailFor(b), "B", silentLogger);
    const res = await captureContext(a, "ik heb morgen examen");
    const id = res.memory!.id;
    const stolen = await answerFollowUp(b, id, "hack");
    assert(stolen === null, "vreemde gebruiker kon antwoord opslaan");
    const removed = await deleteContextMemory(b, id);
    assert(!removed, "vreemde gebruiker kon verwijderen");
    const all = await listContextMemories(a);
    assert(all.some((m) => m.id === id), "eigenaar verloor de memory");
  });

  // ── Privacy: private items NEVER reach a viewer; sharing is opt-in ─────────
  await scenario("privacy: privé verborgen, gedeeld zichtbaar voor viewer", async () => {
    const athlete = newId("visibility");
    await ensureAccount(athlete, emailFor(athlete), "Pupil", silentLogger);
    const res = await captureContext(athlete, "ik heb morgen examen");
    const id = res.memory!.id;
    // Default private → viewer sees nothing.
    let shared = await getAthleteContextForViewer(athlete);
    assert(!shared.some((m) => m.id === id), "privé memory lekte naar viewer");
    // Athlete opts in → now eligible for the viewer.
    await setContextVisibility(athlete, id, "shared");
    shared = await getAthleteContextForViewer(athlete);
    assert(shared.some((m) => m.id === id), "gedeelde memory niet zichtbaar");
  });

  // ── Privacy projection: viewer never sees raw words or personal answers ────
  await scenario("privacy: viewer-projectie verbergt ruwe tekst", async () => {
    const athlete = newId("viewer");
    await ensureAccount(athlete, emailFor(athlete), "Pupil", silentLogger);
    const res = await captureContext(
      athlete,
      "ik heb slecht geslapen door stress thuis",
    );
    await setContextVisibility(athlete, res.memory!.id, "shared");
    await answerFollowUp(athlete, res.memory!.id, "privé antwoord");
    const shared = await getAthleteContextForViewer(athlete);
    assert(shared.length > 0, "viewer kreeg niets te zien");
    const row = shared[0]! as Record<string, unknown>;
    assert(!("statement" in row), "ruwe verklaring lekt naar viewer");
    assert(!("response" in row), "persoonlijk antwoord lekt naar viewer");
    assert("title" in row && "detail" in row, "veilige velden ontbreken");
  });

  // ── Disabled shared memories are hidden from viewers too ───────────────────
  await scenario("privacy: gepauzeerde memory verborgen voor viewer", async () => {
    const athlete = newId("viewer_disabled");
    await ensureAccount(athlete, emailFor(athlete), "Pupil", silentLogger);
    const res = await captureContext(athlete, "ik heb morgen examen");
    await setContextVisibility(athlete, res.memory!.id, "shared");
    await setContextEnabled(athlete, res.memory!.id, false);
    const shared = await getAthleteContextForViewer(athlete);
    assert(
      !shared.some((m) => m.id === res.memory!.id),
      "gepauzeerde memory zichtbaar voor viewer",
    );
  });

  // ── Auth-coverage guard: every route in memory.ts must require auth ────────
  await scenario("auth-coverage: alle memory-routes vereisen auth", async () => {
    const src = readFileSync("src/routes/memory.ts", "utf8");
    const routeLines = src
      .split("\n")
      .filter((l) => /router\.(get|post|patch|delete|put)\(/.test(l));
    assert(routeLines.length >= 7, `te weinig routes gevonden: ${routeLines.length}`);
    for (const line of routeLines) {
      assert(
        line.includes("requireAuth"),
        `route zonder requireAuth: ${line.trim()}`,
      );
    }
  });
}

async function shutdown(code: number) {
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    await cleanup();
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== Personal-context memory — test results ===");
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await shutdown(1);
  });
