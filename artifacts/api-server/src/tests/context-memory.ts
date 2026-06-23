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
import { eq, inArray } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  detectContextMoment,
  captureContext,
  listContextMemories,
  getDueFollowUps,
  answerFollowUp,
  dismissFollowUp,
  setContextEnabled,
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
  // user_profiles cleaned via account helper not exposed here; leave disposable
  // namespaced rows (safe, unique per run). Delete profiles directly:
  const { userProfilesTable } = await import("@workspace/db");
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, ids));
}

// A fixed reference moment: Monday 2026-06-22 10:00 local. Detection timing is
// asserted relative to this so the test is deterministic.
const NOW = new Date(2026, 5, 22, 10, 0, 0);

async function main() {
  // 1-5. The five mandatory scenarios must each be detected with an evening
  // follow-up scheduled.
  await scenario("detectie: examen morgen", async () => {
    const d = detectContextMoment(
      "ik heb niet getraind want ik heb morgen examen",
      NOW,
    );
    assert(d, "examen niet herkend");
    assert(d!.kind === "exam", `verkeerde kind: ${d!.kind}`);
    assert(d!.followUpAt, "geen follow-up gepland");
    assert(d!.followUpAt!.getHours() === 19, "follow-up niet 's avonds");
    // morgen = NOW + 1 day
    assert(d!.followUpAt!.getDate() === 23, "follow-up niet op examendag");
  });

  await scenario("detectie: wedstrijd dit weekend", async () => {
    const d = detectContextMoment("ik heb een wedstrijd dit weekend", NOW);
    assert(d, "wedstrijd niet herkend");
    assert(d!.kind === "race", `verkeerde kind: ${d!.kind}`);
    assert(d!.followUpAt, "geen follow-up gepland");
    // Saturday is 2026-06-27; follow-up the evening after (28th).
    assert(d!.followUpAt!.getHours() === 19, "follow-up niet 's avonds");
  });

  await scenario("detectie: blessure", async () => {
    const d = detectContextMoment(
      "ik heb een blessure aan mijn knie en kan niet fietsen",
      NOW,
    );
    assert(d, "blessure niet herkend");
    assert(d!.kind === "injury", `verkeerde kind: ${d!.kind}`);
    assert(d!.followUpAt, "geen follow-up voor eerste training");
  });

  await scenario("detectie: slecht slapen door spanning", async () => {
    const d = detectContextMoment(
      "ik heb slecht geslapen door de spanning",
      NOW,
    );
    assert(d, "slaap/spanning niet herkend");
    assert(d!.kind === "sleep", `verkeerde kind: ${d!.kind}`);
    assert(d!.followUpAt, "geen follow-up gepland");
  });

  await scenario("detectie: vakantie/trainingskamp", async () => {
    const camp = detectContextMoment("ik ga volgende week op trainingskamp", NOW);
    assert(camp && camp.kind === "camp", "trainingskamp niet herkend");
    const vac = detectContextMoment("ik ben op vakantie deze week", NOW);
    assert(vac && vac.kind === "camp", "vakantie niet herkend");
    assert(camp!.followUpAt && vac!.followUpAt, "geen follow-up gepland");
  });

  // 6. Non-matching text creates nothing.
  await scenario("detectie: irrelevante tekst geeft null", async () => {
    const d = detectContextMoment("vandaag was een mooie dag", NOW);
    assert(d === null, "onterecht een context herkend");
  });

  // 7. Full capture → persist with scheduled follow-up.
  await scenario("captureContext bewaart + plant follow-up", async () => {
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
  });

  // 8. Privacy gate: ai_memory disabled → detected but NOT persisted.
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

  // 9. Follow-up lifecycle: due → answer → followed_up.
  await scenario("follow-up: due → beantwoorden", async () => {
    const athlete = newId("lifecycle");
    await ensureAccount(athlete, emailFor(athlete), "Pupil", silentLogger);
    const res = await captureContext(athlete, "ik heb morgen examen");
    const id = res.memory!.id;
    // Simulate time passing: ask for follow-ups due far in the future.
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const due = await getDueFollowUps(athlete, future);
    assert(due.some((d) => d.id === id), "follow-up niet als due gevonden");
    const answered = await answerFollowUp(athlete, id, "ging goed, weer fit");
    assert(answered, "antwoord niet opgeslagen");
    assert(answered!.status === "followed_up", "status niet followed_up");
    assert(answered!.response === "ging goed, weer fit", "antwoord niet bewaard");
    // No longer due after answering.
    const due2 = await getDueFollowUps(athlete, future);
    assert(!due2.some((d) => d.id === id), "blijft due na beantwoorden");
  });

  // 10. Dismiss path.
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

  // 11. Athlete control: disable stops follow-ups; delete removes the row.
  await scenario("athleet: pauzeren en verwijderen", async () => {
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

  // 12. Owner scoping: one athlete cannot touch another's memory.
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
    // Owner still has it intact.
    const all = await listContextMemories(a);
    assert(all.some((m) => m.id === id), "eigenaar verloor de memory");
  });

  // 13. Privacy projection: viewer never sees raw words or personal answers.
  await scenario("privacy: viewer-projectie verbergt ruwe tekst", async () => {
    const athlete = newId("viewer");
    await ensureAccount(athlete, emailFor(athlete), "Pupil", silentLogger);
    const res = await captureContext(
      athlete,
      "ik heb slecht geslapen door stress thuis",
    );
    await answerFollowUp(athlete, res.memory!.id, "privé antwoord");
    const shared = await getAthleteContextForViewer(athlete);
    assert(shared.length > 0, "viewer kreeg niets te zien");
    const row = shared[0]! as Record<string, unknown>;
    assert(!("statement" in row), "ruwe verklaring lekt naar viewer");
    assert(!("response" in row), "persoonlijk antwoord lekt naar viewer");
    assert("title" in row && "detail" in row, "veilige velden ontbreken");
  });

  // 14. Disabled memories are hidden from viewers too.
  await scenario("privacy: gepauzeerde memory verborgen voor viewer", async () => {
    const athlete = newId("viewer_disabled");
    await ensureAccount(athlete, emailFor(athlete), "Pupil", silentLogger);
    const res = await captureContext(athlete, "ik heb morgen examen");
    await setContextEnabled(athlete, res.memory!.id, false);
    const shared = await getAthleteContextForViewer(athlete);
    assert(
      !shared.some((m) => m.id === res.memory!.id),
      "gepauzeerde memory zichtbaar voor viewer",
    );
  });

  // 15. Auth-coverage guard: every route in memory.ts must require auth.
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
