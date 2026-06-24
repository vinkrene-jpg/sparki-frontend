// Sparki Onboarding V2 — insights engine + identity test.
//
// Covers the evidence-gated open-loops, the "Sparki, eerlijk?" honest
// observation, the Founding Athlete numbering (atomic + idempotent), and the
// Hoofdtester rotating line. Pure functions need no database; the founding-number
// scenarios seed disposable clerkIds to verify atomic assignment against real rows.
//
// Run: `pnpm --filter @workspace/api-server run test:onboarding-v2`
// Requires: DATABASE_URL. Exits non-zero on any failure.

import { db, pool } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  computeOpenLoops,
  OPEN_LOOPS,
  composeHonest,
  assignFoundingNumber,
  foundingLabel,
  headTesterLine,
  FOUNDING_LINES,
  HEAD_TESTER_LINES,
  type InsightSignals,
  type SelfType,
} from "../engines/insights";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => void | Promise<void>) {
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

// "AI" / "A.I." as a standalone word — NOT a substring. Plus obvious English jargon
// that must never reach a user-facing string.
function bannedWord(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bai\b/.test(lower)) return "AI";
  if (/a\.i\./.test(lower)) return "A.I.";
  const jargon = ["power", "performance", "recovery", "workout", "update", "score"];
  for (const w of jargon) {
    if (new RegExp(`\\b${w}\\b`).test(lower)) return w;
  }
  return null;
}

// A neutral baseline signal set: a brand-new athlete with nothing on record.
function baseSignals(over: Partial<InsightSignals> = {}): InsightSignals {
  return {
    totalSessions: 0,
    last14Count: 0,
    prev14Count: 0,
    recentAvgTss: null,
    baselineAvgTss: null,
    avgDurationMin: null,
    distinctTypes: 0,
    metricsCount: 0,
    memoriesCount: 0,
    selfType: null,
    ftpEstimated: false,
    weightMissing: false,
    daysKnown: 0,
    ...over,
  };
}

const RUN = `test_onb_v2_${Date.now()}`;
const ids: string[] = [];
function newId(tag: string): string {
  const id = `${RUN}_${tag}`;
  ids.push(id);
  return id;
}
const emailFor = (id: string) => `${id}@example.test`;

async function cleanup() {
  if (ids.length === 0) return;
  const { userProfilesTable } = await import("@workspace/db");
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ids));
}

function main() {
  // ── Open loops: catalog has the required ≥5 evidence-gated loops ────────────
  scenario("open-loops: catalog heeft minstens 5 lussen", () =>
    assert(OPEN_LOOPS.length >= 5, `te weinig lussen: ${OPEN_LOOPS.length}`));
  scenario("open-loops: elke lus heeft een bewijs-gate", () =>
    OPEN_LOOPS.forEach((l) =>
      assert(typeof l.evidence === "function", `lus ${l.id} mist bewijs-gate`),
    ));
  scenario("open-loops: elke lus heeft niet-lege tekst", () =>
    OPEN_LOOPS.forEach((l) => assert(l.text.trim().length > 0, `lege lus ${l.id}`)));

  // ── Open loops: nothing without evidence ───────────────────────────────────
  scenario("open-loops: nieuwe atleet krijgt geen lussen", () =>
    assert(computeOpenLoops(baseSignals()).length === 0, "verzon lussen zonder bewijs"));

  // ── Open loops: each gate fires on its real signal ─────────────────────────
  scenario("open-loops: theory_about_you vereist self-claim + 3 sessies", () => {
    const has = (s: InsightSignals) =>
      computeOpenLoops(s).some((l) => l.id === "theory_about_you");
    assert(!has(baseSignals({ selfType: "diesel", totalSessions: 2 })), "vuurde te vroeg");
    assert(has(baseSignals({ selfType: "diesel", totalSessions: 3 })), "vuurde niet bij bewijs");
    assert(!has(baseSignals({ selfType: null, totalSessions: 5 })), "vuurde zonder self-claim");
  });
  scenario("open-loops: missing_puzzle vuurt bij geschatte FTP of geen gewicht", () => {
    const has = (s: InsightSignals) =>
      computeOpenLoops(s).some((l) => l.id === "missing_puzzle");
    assert(has(baseSignals({ ftpEstimated: true })), "FTP-schatting gaf geen lus");
    assert(has(baseSignals({ weightMissing: true })), "ontbrekend gewicht gaf geen lus");
    assert(!has(baseSignals({ ftpEstimated: false, weightMissing: false })), "vuurde zonder reden");
  });
  scenario("open-loops: something_in_data vereist 5 sessies", () => {
    const has = (s: InsightSignals) =>
      computeOpenLoops(s).some((l) => l.id === "something_in_data");
    assert(!has(baseSignals({ totalSessions: 4 })), "vuurde bij 4");
    assert(has(baseSignals({ totalSessions: 5 })), "vuurde niet bij 5");
  });
  scenario("open-loops: two_explanations vereist variatie + sessies", () => {
    const has = (s: InsightSignals) =>
      computeOpenLoops(s).some((l) => l.id === "two_explanations");
    assert(has(baseSignals({ distinctTypes: 2, totalSessions: 4 })), "vuurde niet bij variatie");
    assert(!has(baseSignals({ distinctTypes: 1, totalSessions: 9 })), "vuurde zonder variatie");
  });
  scenario("open-loops: starting_to_understand vereist tijd + relatie", () => {
    const has = (s: InsightSignals) =>
      computeOpenLoops(s).some((l) => l.id === "starting_to_understand");
    assert(has(baseSignals({ daysKnown: 7, totalSessions: 6 })), "vuurde niet bij tijd+sessies");
    assert(has(baseSignals({ daysKnown: 8, memoriesCount: 1 })), "vuurde niet bij tijd+memory");
    assert(!has(baseSignals({ daysKnown: 3, totalSessions: 20 })), "vuurde te vroeg");
  });

  // ── Open loops: deterministic + priority order ─────────────────────────────
  scenario("open-loops: deterministisch bij gelijke signalen", () => {
    const s = baseSignals({ selfType: "diesel", totalSessions: 6, distinctTypes: 2, daysKnown: 9 });
    const a = computeOpenLoops(s).map((l) => l.id).join(",");
    const b = computeOpenLoops(s).map((l) => l.id).join(",");
    assert(a === b, "niet deterministisch");
  });
  scenario("open-loops: behoudt catalog-prioriteitsvolgorde", () => {
    const s = baseSignals({
      selfType: "diesel",
      totalSessions: 6,
      distinctTypes: 2,
      ftpEstimated: true,
      daysKnown: 9,
      memoriesCount: 1,
    });
    const got = computeOpenLoops(s).map((l) => l.id);
    const expected = OPEN_LOOPS.filter((l) => l.evidence(s)).map((l) => l.id);
    assert(JSON.stringify(got) === JSON.stringify(expected), `volgorde fout: ${got.join(",")}`);
  });

  // ── Honest observation: insufficient until real evidence ───────────────────
  scenario("eerlijk: te weinig sessies → onvoldoende bewijs", () => {
    const o = composeHonest(baseSignals({ totalSessions: 2 }));
    assert(o.kind === "insufficient" && !o.founded, "claimde iets zonder bewijs");
    assert(o.text === "Ik heb daar nog onvoldoende bewijs voor.", `verkeerde tekst: ${o.text}`);
  });
  scenario("eerlijk: duidelijke stap omhoog → better_than_thought", () => {
    const o = composeHonest(
      baseSignals({ totalSessions: 5, recentAvgTss: 80, baselineAvgTss: 60 }),
    );
    assert(o.kind === "better_than_thought" && o.founded, `kreeg ${o.kind}`);
  });
  scenario("eerlijk: tegengesproken claim → doubts_theory", () => {
    // sprinter claim, maar gemiddelde rit is lang → tegengesproken.
    const o = composeHonest(
      baseSignals({ totalSessions: 6, selfType: "sprinter", avgDurationMin: 120 }),
    );
    assert(o.kind === "doubts_theory" && o.founded, `kreeg ${o.kind}`);
  });
  scenario("eerlijk: bescheiden claim + stabiele basis → underestimates", () => {
    const o = composeHonest(
      baseSignals({
        totalSessions: 6,
        selfType: "geen_idee",
        recentAvgTss: 70,
        baselineAvgTss: 70,
      }),
    );
    assert(o.kind === "underestimates" && o.founded, `kreeg ${o.kind}`);
  });
  scenario("eerlijk: genoeg sessies maar niets opvallends → onvoldoende bewijs", () => {
    const o = composeHonest(baseSignals({ totalSessions: 4, selfType: "diesel" }));
    assert(o.kind === "insufficient" && !o.founded, `kreeg ${o.kind}`);
  });
  scenario("eerlijk: deterministisch", () => {
    const s = baseSignals({ totalSessions: 5, recentAvgTss: 80, baselineAvgTss: 60 });
    assert(composeHonest(s).text === composeHonest(s).text, "niet deterministisch");
  });
  scenario("eerlijk: bescheiden claims kunnen niet 'fout' zijn", () => {
    // ik_zie_wel met lange ritten mag nooit doubts_theory geven.
    const o = composeHonest(
      baseSignals({ totalSessions: 8, selfType: "ik_zie_wel", avgDurationMin: 130 }),
    );
    assert(o.kind !== "doubts_theory", "bescheiden claim werd tegengesproken");
  });

  // ── Founding label formatting ──────────────────────────────────────────────
  scenario("founding: label is nul-gevuld #00N", () => {
    assert(foundingLabel(1) === "Founding Athlete #001", foundingLabel(1));
    assert(foundingLabel(42) === "Founding Athlete #042", foundingLabel(42));
    assert(foundingLabel(123) === "Founding Athlete #123", foundingLabel(123));
  });
  scenario("founding: drie regels begeleidende copy", () => {
    assert(FOUNDING_LINES.length === 3, `verwacht 3 regels, kreeg ${FOUNDING_LINES.length}`);
    FOUNDING_LINES.forEach((l) => assert(l.trim().length > 0, "lege founding-regel"));
  });

  // ── Hoofdtester rotating line ──────────────────────────────────────────────
  scenario("hoofdtester: roteert deterministisch per dag", () => {
    const day1 = new Date(Date.UTC(2026, 0, 1));
    assert(headTesterLine(day1) === headTesterLine(day1), "zelfde dag verschilde");
  });
  scenario("hoofdtester: verschillende dagen kunnen verschillen", () => {
    const lines = new Set<string>();
    for (let d = 0; d < HEAD_TESTER_LINES.length; d++) {
      lines.add(headTesterLine(new Date(Date.UTC(2026, 0, 1 + d))));
    }
    assert(lines.size > 1, "lijn roteert niet over dagen");
  });
  scenario("hoofdtester: lijn komt altijd uit de catalogus", () => {
    for (let d = 0; d < 30; d++) {
      const line = headTesterLine(new Date(Date.UTC(2026, 0, 1 + d)));
      assert((HEAD_TESTER_LINES as readonly string[]).includes(line), `onbekende lijn: ${line}`);
    }
  });

  // ── Language: no banned words in any user-facing insights string ───────────
  scenario("taal: open-loop teksten bevatten geen verboden woorden", () => {
    const selfTypes: SelfType[] = ["diesel", "sprinter", "alleskunner", "geen_idee", "ik_zie_wel"];
    const seen = new Set<string>();
    for (const st of selfTypes) {
      for (const ts of [0, 3, 5, 8]) {
        for (const dt of [0, 2]) {
          const s = baseSignals({
            selfType: st,
            totalSessions: ts,
            distinctTypes: dt,
            ftpEstimated: true,
            weightMissing: true,
            daysKnown: 10,
            memoriesCount: 1,
          });
          for (const l of computeOpenLoops(s)) seen.add(l.text);
        }
      }
    }
    for (const text of seen) {
      const bad = bannedWord(text);
      assert(!bad, `verboden woord "${bad}" in lus: "${text}"`);
    }
    assert(seen.size >= 5, `te weinig unieke lussen gecontroleerd: ${seen.size}`);
  });
  scenario("taal: eerlijke observaties bevatten geen verboden woorden", () => {
    const variants: InsightSignals[] = [
      baseSignals({ totalSessions: 2 }),
      baseSignals({ totalSessions: 5, recentAvgTss: 80, baselineAvgTss: 60 }),
      baseSignals({ totalSessions: 6, selfType: "sprinter", avgDurationMin: 120 }),
      baseSignals({ totalSessions: 6, selfType: "geen_idee", recentAvgTss: 70, baselineAvgTss: 70 }),
    ];
    for (const s of variants) {
      const bad = bannedWord(composeHonest(s).text);
      assert(!bad, `verboden woord "${bad}" in eerlijke observatie`);
    }
  });
  scenario("taal: founding + hoofdtester copy bevat geen verboden woorden", () => {
    for (const l of [...FOUNDING_LINES, ...HEAD_TESTER_LINES, foundingLabel(1)]) {
      const bad = bannedWord(l);
      // "Founding Athlete" is a brand/program name, not the word "AI".
      if (l.startsWith("Founding Athlete")) continue;
      assert(!bad, `verboden woord "${bad}" in: "${l}"`);
    }
  });
}

// ── DB-backed: founding-number assignment is atomic + idempotent ─────────────
async function dbScenarios() {
  await scenario("db: founding-nummer wordt toegekend en is idempotent", async () => {
    const athlete = newId("founding");
    await ensureAccount(athlete, emailFor(athlete), "Founding Sporter", silentLogger);
    const first = await assignFoundingNumber(athlete);
    assert(first >= 1, `ongeldig nummer: ${first}`);
    const second = await assignFoundingNumber(athlete);
    assert(second === first, `niet idempotent: ${first} → ${second}`);
  });

  await scenario("db: gelijktijdige toekenningen botsen niet (uniek)", async () => {
    const a = newId("race_a");
    const b = newId("race_b");
    await ensureAccount(a, emailFor(a), "Renner A", silentLogger);
    await ensureAccount(b, emailFor(b), "Renner B", silentLogger);
    const [na, nb] = await Promise.all([
      assignFoundingNumber(a),
      assignFoundingNumber(b),
    ]);
    assert(na !== nb, `twee atleten kregen hetzelfde nummer: ${na}`);
  });
}

main();
dbScenarios()
  .then(async () => {
    await cleanup();
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== Sparki Onboarding V2 — test results ===");
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
    await pool.end().catch(() => {});
    process.exit(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await pool.end().catch(() => {});
    process.exit(1);
  });
