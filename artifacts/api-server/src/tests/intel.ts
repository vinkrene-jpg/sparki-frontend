// Performance Intelligence Hub — engine test.
//
// The ranking + reasoning layer (engines/intel/personalize) is pure, so the bulk
// of these tests build synthetic cards + athlete contexts and assert ordering,
// honest reasons, the no-fabrication contract and the myth-answer judgement
// without a database. A short DB-backed section at the end seeds a disposable
// athlete and exercises getFeed / setFlag / recordMythAnswer end-to-end against
// the real seeded cards.
//
// Run: `pnpm --filter @workspace/api-server run test:intel`
// Requires: DATABASE_URL (and the intel seed). Exits non-zero on any failure.

import {
  db,
  pool,
  intelCardsTable,
  type IntelCard,
  type IntelTopic,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  inferTopicInterests,
  normalizeDiscipline,
  normalizeLevel,
  rankCards,
  type IntelAthleteContext,
} from "../engines/intel/personalize";
import {
  buildIntelContext,
  getFeed,
  setFlag,
  recordMythAnswer,
} from "../engines/intel";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function scenario(name: string, fn: () => void) {
  try {
    fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

async function dbScenario(name: string, fn: () => Promise<void>) {
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

function card(partial: Partial<IntelCard>): IntelCard {
  return {
    id: 1,
    dedupeKey: "k",
    kind: "academy",
    topic: "training",
    title: "t",
    summary: "s",
    content: {} as never,
    disciplines: ["all"],
    levels: ["all"],
    sourceLabel: "src",
    sourceUrl: null,
    status: "published",
    publishedAt: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...partial,
  } as IntelCard;
}

function ctx(partial: Partial<IntelAthleteContext>): IntelAthleteContext {
  return {
    discipline: null,
    disciplineLabel: null,
    level: null,
    levelLabel: null,
    simplify: false,
    topicInterests: new Map(),
    ...partial,
  };
}

// ── Pure: normalisation ──────────────────────────────────────────────────────
scenario("normalizeDiscipline maps common Dutch/English terms", () => {
  assert(normalizeDiscipline("mountainbike") === "mtb", "mtb");
  assert(normalizeDiscipline("Gravel") === "gravel", "gravel");
  assert(normalizeDiscipline("veldrijden") === "cyclocross", "cx");
  assert(normalizeDiscipline("wielrennen op de weg") === "road", "road");
  assert(normalizeDiscipline("baan") === "track", "track");
  assert(normalizeDiscipline(null) === null, "null");
  assert(normalizeDiscipline("onzin xyz") === null, "unknown → null");
});

scenario("normalizeLevel only accepts known levels", () => {
  assert(normalizeLevel("beginner") === "beginner", "beginner");
  assert(normalizeLevel("elite") === "elite", "elite");
  assert(normalizeLevel("pro") === null, "unknown → null");
  assert(normalizeLevel(null) === null, "null");
});

// ── Pure: topic interest inference (honest, real signals only) ───────────────
scenario("inferTopicInterests reads goals/self-type/engagement", () => {
  const interests = inferTopicInterests({
    goals: "Ik wil afvallen en mijn voeding op orde krijgen",
    motivation: null,
    selfType: "sprinter",
    engagedTopics: ["herstel"],
  });
  assert(interests.has("voeding"), "voeding from goals");
  assert(interests.has("aerodynamica"), "aero from sprinter self-type");
  assert(interests.has("herstel"), "herstel from engagement");
  assert(
    interests.get("herstel")!.includes("interesse"),
    "engagement reason cites prior interest",
  );
});

scenario("inferTopicInterests uses word boundaries (no substring traps)", () => {
  // Whole word "fiets" SHOULD match materiaal; the glued-together "transportfiets"
  // must NOT, because keywords are matched on word boundaries.
  const matched = inferTopicInterests({
    goals: "ik wil mijn fiets afstellen",
    motivation: null,
    selfType: null,
    engagedTopics: [],
  });
  assert(matched.has("materiaal"), "standalone 'fiets' → materiaal");

  const noMatch = inferTopicInterests({
    goals: "ik rij op een transportfiets",
    motivation: null,
    selfType: null,
    engagedTopics: [],
  });
  assert(!noMatch.has("materiaal"), "'transportfiets' must not substring-match");
});

scenario("inferTopicInterests stays empty without signals", () => {
  const interests = inferTopicInterests({
    goals: null,
    motivation: null,
    selfType: "geen_idee",
    engagedTopics: [],
  });
  assert(interests.size === 0, "no fabricated interests");
});

// ── Pure: ranking ────────────────────────────────────────────────────────────
scenario("discipline match outranks generic card", () => {
  const mtb = card({ id: 1, disciplines: ["mtb"], topic: "materiaal" });
  const generic = card({ id: 2, disciplines: ["all"], topic: "materiaal" });
  const ranked = rankCards(
    [generic, mtb],
    ctx({ discipline: "mtb", disciplineLabel: "mountainbike" }),
    new Set(),
  );
  assert(ranked[0]!.card.id === 1, "mtb card first");
  assert(ranked[0]!.personalised, "marked personalised");
  assert(
    ranked[0]!.reason.includes("mountainbike"),
    "reason names the discipline",
  );
});

scenario("generic card gets honest non-personalised reason", () => {
  const generic = card({ id: 2, disciplines: ["all"], levels: ["all"] });
  const ranked = rankCards([generic], ctx({}), new Set());
  assert(!ranked[0]!.personalised, "not personalised");
  assert(
    ranked[0]!.reason.includes("Algemeen relevant"),
    "honest generic reason",
  );
});

scenario("topic interest beats level-only match", () => {
  const topicCard = card({ id: 1, topic: "voeding", levels: ["all"] });
  const levelCard = card({ id: 2, topic: "training", levels: ["advanced"] });
  const interests = new Map<IntelTopic, string>([
    ["voeding", "Sluit aan bij je doel rond voeding"],
  ]);
  const ranked = rankCards(
    [levelCard, topicCard],
    ctx({ level: "advanced", levelLabel: "ervaren", topicInterests: interests }),
    new Set(),
  );
  assert(ranked[0]!.card.id === 1, "topic card first");
});

scenario("already-engaged card is downranked but not hidden", () => {
  const a = card({ id: 1, disciplines: ["all"], levels: ["all"] });
  const b = card({ id: 2, disciplines: ["all"], levels: ["all"] });
  const ranked = rankCards([a, b], ctx({}), new Set([1]));
  assert(ranked.length === 2, "still present");
  assert(ranked[0]!.card.id === 2, "non-engaged first");
});

scenario("ranking is deterministic and stable on ties", () => {
  const a = card({ id: 5, publishedAt: new Date("2026-01-01") });
  const b = card({ id: 9, publishedAt: new Date("2026-01-01") });
  const r1 = rankCards([a, b], ctx({}), new Set());
  const r2 = rankCards([b, a], ctx({}), new Set());
  assert(
    r1.map((r) => r.card.id).join(",") === r2.map((r) => r.card.id).join(","),
    "input order does not change output",
  );
});

// ── DB-backed end-to-end against the real seed ───────────────────────────────
const TEST_CLERK = "test-intel-athlete";

async function main() {
  await dbScenario("seed present (run seed:intel first)", async () => {
    const rows = await db.select().from(intelCardsTable).limit(1);
    assert(rows.length > 0, "no intel cards — run `seed:intel`");
  });

  await dbScenario("getFeed ranks + attaches state", async () => {
    await ensureAccount(TEST_CLERK, "intel@test.local", "Intel Test", silentLogger);
    const items = await getFeed(TEST_CLERK, {});
    assert(items.length > 0, "feed empty");
    assert(
      items.every((i) => typeof i.reason === "string" && i.reason.length > 0),
      "every item has a reason",
    );
    assert(
      items.every((i) => i.interaction != null),
      "every item has interaction state",
    );
  });

  await dbScenario("buildIntelContext reads real profile", async () => {
    const c = await buildIntelContext(TEST_CLERK);
    assert(c != null, "context built");
    assert(typeof c.simplify === "boolean", "simplify flag present");
  });

  await dbScenario("setFlag saves + saved scope returns it", async () => {
    const feed = await getFeed(TEST_CLERK, {});
    const first = feed[0]!.card.id;
    await setFlag(TEST_CLERK, first, "saved", true);
    const saved = await getFeed(TEST_CLERK, { scope: "saved" });
    assert(
      saved.some((i) => i.card.id === first),
      "saved card appears in saved scope",
    );
    await setFlag(TEST_CLERK, first, "saved", false);
    const after = await getFeed(TEST_CLERK, { scope: "saved" });
    assert(!after.some((i) => i.card.id === first), "unsave removes it");
  });

  await dbScenario("recordMythAnswer judges against real verdict", async () => {
    const [myth] = await db
      .select()
      .from(intelCardsTable)
      .where(eq(intelCardsTable.kind, "myth_buster"))
      .limit(1);
    assert(myth, "a myth card exists");
    const correctAnswer = (myth!.content as { answer: string }).answer;
    const right = await recordMythAnswer(
      TEST_CLERK,
      myth!.id,
      correctAnswer as never,
    );
    assert(right?.correct === true, "correct answer judged correct");
    const wrongChoice = correctAnswer === "waar" ? "niet_waar" : "waar";
    const wrong = await recordMythAnswer(
      TEST_CLERK,
      myth!.id,
      wrongChoice as never,
    );
    assert(wrong?.correct === false, "wrong answer judged wrong");
  });

  await dbScenario("setFlag returns null for non-existent card", async () => {
    const result = await setFlag(TEST_CLERK, 999999999, "saved", true);
    assert(result === null, "bogus card id yields null (route maps to 404)");
  });

  // Summary
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  console.log("\n── Intel engine test ──");
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${passed} passed, ${failed} failed\n`);

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("[test:intel] crashed:", err);
  await pool.end();
  process.exit(1);
});
