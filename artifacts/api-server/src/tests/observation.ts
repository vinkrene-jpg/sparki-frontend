// Observation & Coach Engine V1 — integration test.
//
// Most of the engine is pure (deterministic over a gathered intake), so the bulk
// of the tests build synthetic intakes and assert behaviour without a database:
// confidence maths, the no-single-datapoint guard, every observation rule, the
// contradiction/follow-up module, advice drivers, personalities, the six-part
// composer, the feedback mapping, and the "no AI / plain Dutch" copy contract.
// A few DB-backed scenarios at the end seed a disposable clerkId to exercise
// gatherSignals + runCoachAnalysis persistence end-to-end.
//
// Run: `pnpm --filter @workspace/api-server run test:observation`
// Requires: DATABASE_URL. Exits non-zero on any failure.

import { db, pool } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  buildSignals,
  computeConfidence,
  deriveObservations,
  detectContradictions,
  buildFollowUps,
  generateAdvice,
  resolvePersonality,
  composeCoachAnalysis,
  gatherSignals,
  runCoachAnalysis,
  mapFeedbackToDimensions,
  isCoachFeedbackSignal,
  COACH_FEEDBACK_SIGNALS,
  applyFollowUpAnswers,
  isValidFollowUpAnswer,
  optionsFor,
  type IntakeMetrics,
  type SignalIntake,
  type Personality,
} from "../engines/observation";

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

// "AI" / "A.I." as a standalone word (not a substring), plus obvious jargon.
function bannedWord(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bai\b/.test(lower)) return "AI";
  if (/a\.i\./.test(lower)) return "A.I.";
  return null;
}

// ── Synthetic intake builder ─────────────────────────────────────────────────

function baseMetrics(over: Partial<IntakeMetrics> = {}): IntakeMetrics {
  return {
    load: { ctl: 50, atl: 50, tsb: 0 },
    loadSessions: 0,
    readiness: { label: "unknown", score: null, basis: [] },
    risk: { level: "low", score: 0, acwr: null, reasons: [] },
    hrv: null,
    restingHr: null,
    sleep: { latest: null, avg: null, days: 0 },
    feel: { latest: null, avg: null, days: 0 },
    fatigue: { latest: null, avg: null, days: 0 },
    ftp: { trend: null, latest: null },
    feedback: { total: 0, done: 0, missed: 0, tooHard: 0, tooLight: 0, pain: 0, tired: 0 },
    races: { nextA: null, nextAny: null, count: 0 },
    nutrition: { logs: 0 },
    sessionsPerWeek: null,
    healthStatus: "ok",
    ...over,
  };
}

function intake(over: Partial<IntakeMetrics> = {}): SignalIntake {
  const metrics = baseMetrics(over);
  return {
    clerkId: "synthetic",
    today: "2026-06-24",
    athleteName: "Renner",
    metrics,
    signals: buildSignals(metrics),
    missing: buildSignals(metrics).filter((s) => s.status === "missing").map((s) => s.kind),
  };
}

const BEGINNER: Personality = resolvePersonality({ experienceLevel: "beginner" });

function main() {
  // ── Confidence maths ────────────────────────────────────────────────────────
  scenario("confidence: 2 agreeing → medium", () => {
    const c = computeConfidence({ agreeing: 2, trendDays: 0, contradictions: 0, decisiveMissing: 0, reasons: [], uncertainties: [] });
    assert(c.score === 65 && c.level === "medium", `got ${c.score}/${c.level}`);
  });
  scenario("confidence: 3 agreeing + trend → high", () => {
    const c = computeConfidence({ agreeing: 3, trendDays: 5, contradictions: 0, decisiveMissing: 0, reasons: [], uncertainties: [] });
    assert(c.level === "high", `level ${c.level}`);
  });
  scenario("confidence: contradiction lowers score", () => {
    const a = computeConfidence({ agreeing: 3, trendDays: 0, contradictions: 0, decisiveMissing: 0, reasons: [], uncertainties: [] });
    const b = computeConfidence({ agreeing: 3, trendDays: 0, contradictions: 1, decisiveMissing: 0, reasons: [], uncertainties: [] });
    assert(b.score < a.score, "contradiction did not lower score");
  });
  scenario("confidence: never reaches 100", () => {
    const c = computeConfidence({ agreeing: 10, trendDays: 30, contradictions: 0, decisiveMissing: 0, reasons: [], uncertainties: [] });
    assert(c.score <= 92, `score ${c.score} exceeded cap`);
  });

  // ── Personalities ───────────────────────────────────────────────────────────
  scenario("personality: parent role → ouder", () => assert(resolvePersonality({ activeRole: "parent" }).key === "ouder", "not ouder"));
  scenario("personality: coach role → trainer", () => assert(resolvePersonality({ activeRole: "coach" }).key === "trainer", "not trainer"));
  scenario("personality: age 16 → jeugdrenner", () => assert(resolvePersonality({ birthYear: 2026 - 16, today: new Date("2026-06-24") }).key === "jeugdrenner", "not jeugdrenner"));
  scenario("personality: national → topsporter", () => assert(resolvePersonality({ competitionLevel: "national" }).key === "topsporter", "not topsporter"));
  scenario("personality: advanced → ervaren", () => assert(resolvePersonality({ experienceLevel: "advanced" }).key === "ervaren", "not ervaren"));
  scenario("personality: beginner → beginner", () => assert(resolvePersonality({ experienceLevel: "beginner" }).key === "beginner", "not beginner"));
  scenario("personality: unknown → beginner fallback", () => assert(resolvePersonality({}).key === "beginner", "not beginner fallback"));

  // ── Missing-first-class ─────────────────────────────────────────────────────
  scenario("intake: empty athlete reports honest gaps", () => {
    const sigs = buildSignals(baseMetrics());
    const load = sigs.find((s) => s.kind === "training_load")!;
    assert(load.status === "missing" && !!load.reason, "training load not honest-missing");
    const weather = sigs.find((s) => s.kind === "weather")!;
    assert(weather.status === "missing", "weather should be missing without a home location");
  });
  scenario("intake: weather missing without home location", () => {
    const sigs = buildSignals(baseMetrics({ loadSessions: 10, readiness: { label: "fresh", score: 80, basis: ["gevoel"] } }));
    const w = sigs.find((s) => s.kind === "weather")!;
    assert(w.status === "missing" && /thuislocatie/.test(w.reason ?? ""), "weather should be honest-missing without home");
  });
  scenario("intake: weather present when home forecast available", () => {
    const sigs = buildSignals(baseMetrics({
      weather: { available: true, reason: "ok", locationLabel: "Utrecht", summaryText: "Regen, 8–14°C", severity: "caution", todayForecast: null },
    }));
    const w = sigs.find((s) => s.kind === "weather")!;
    assert(w.status === "present" && /Regen/.test(w.value ?? ""), "weather should be present with a real forecast");
  });
  scenario("intake: health is always a known fact", () => {
    const sigs = buildSignals(baseMetrics());
    assert(sigs.find((s) => s.kind === "health")!.status === "present", "health not present");
  });

  // ── No single-datapoint conclusions ─────────────────────────────────────────
  scenario("rules: a single signal yields no observation", () => {
    const obs = deriveObservations(intake({ readiness: { label: "tired", score: 30, basis: ["gevoel"] } }), []);
    assert(obs.length === 0, `expected silence, got ${obs.map((o) => o.topic).join(",")}`);
  });

  // ── Observation rules ───────────────────────────────────────────────────────
  scenario("rules: accumulated fatigue fires on ≥2 signals", () => {
    const i = intake({
      loadSessions: 10,
      load: { ctl: 60, atl: 85, tsb: -25 },
      readiness: { label: "tired", score: 30, basis: ["gevoel"] },
      fatigue: { latest: 8, avg: 7, days: 5 },
      risk: { level: "high", score: 60, acwr: 1.4, reasons: ["piek"] },
    });
    const obs = deriveObservations(i, detectContradictions(i.metrics));
    const f = obs.find((o) => o.topic === "fatigue_load");
    assert(f != null, "fatigue_load not derived");
    assert(f!.confidence.reasons.length > 0, "no confidence reasons");
    assert(f!.signalsUsed.length >= 2, "used fewer than 2 signals");
  });
  scenario("rules: good form fires when fresh + positive balance", () => {
    const i = intake({
      loadSessions: 10,
      load: { ctl: 60, atl: 50, tsb: 10 },
      readiness: { label: "fresh", score: 85, basis: ["gevoel"] },
      sleep: { latest: 8, avg: 8, days: 7 },
      risk: { level: "low", score: 5, acwr: 0.9, reasons: [] },
    });
    const obs = deriveObservations(i, []);
    assert(obs.some((o) => o.topic === "good_form" && o.tone === "positive"), "good_form not derived");
  });
  scenario("rules: recovery concern from objective markers", () => {
    const i = intake({
      restingHr: { direction: "rising", first: 48, last: 56, delta: 8, days: 6 },
      hrv: { direction: "falling", first: 70, last: 55, delta: -15, days: 6 },
      sleep: { latest: 6, avg: 6, days: 6 },
    });
    const obs = deriveObservations(i, []);
    assert(obs.some((o) => o.topic === "recovery_concern"), "recovery_concern not derived");
  });
  scenario("rules: power progress needs trend + frequency", () => {
    const i = intake({
      ftp: { trend: { direction: "rising", first: 250, last: 270, delta: 20, days: 3 }, latest: 270 },
      sessionsPerWeek: 4,
      loadSessions: 12,
    });
    const obs = deriveObservations(i, []);
    assert(obs.some((o) => o.topic === "power_progress"), "power_progress not derived");
  });
  scenario("rules: health fact derived as urgent (single allowed)", () => {
    const i = intake({ healthStatus: "injured" });
    const obs = deriveObservations(i, []);
    const h = obs.find((o) => o.topic === "health");
    assert(h != null && h.severity === "urgent", "injured health not urgent observation");
  });

  // ── Contradictions & follow-ups ─────────────────────────────────────────────
  scenario("contradiction: fresh feel vs deep fatigue", () => {
    const m = baseMetrics({
      loadSessions: 10,
      load: { ctl: 60, atl: 80, tsb: -20 },
      readiness: { label: "fresh", score: 80, basis: ["gevoel"] },
      feel: { latest: 8, avg: 8, days: 5 },
    });
    const f = detectContradictions(m);
    assert(f.some((x) => x.id === "fresh_but_fatigued"), "contradiction not detected");
    const q = buildFollowUps(m, f);
    assert(q.length >= 1 && q.length <= 3, "follow-up count out of range");
    assert(!!q[0]!.question && !!q[0]!.because, "follow-up missing question/reason");
  });
  scenario("contradiction: missing check-in asks for one", () => {
    const m = baseMetrics({ loadSessions: 5 });
    const q = buildFollowUps(m, []);
    assert(q.some((x) => x.id === "missing_checkin"), "did not ask for check-in");
  });
  scenario("follow-ups: capped at 3", () => {
    const m = baseMetrics({
      loadSessions: 10,
      load: { ctl: 60, atl: 80, tsb: -20 },
      readiness: { label: "fresh", score: 80, basis: ["gevoel"] },
      feel: { latest: 8, avg: 8, days: 5 },
      hrv: { direction: "rising", first: 50, last: 60, delta: 10, days: 6 },
      restingHr: { direction: "rising", first: 48, last: 56, delta: 8, days: 6 },
      sleep: { latest: 8, avg: 8, days: 6 },
      feedback: { total: 2, done: 0, missed: 0, tooHard: 0, tooLight: 2, pain: 0, tired: 0 },
    });
    const q = buildFollowUps(m, detectContradictions(m));
    assert(q.length <= 3, `got ${q.length} follow-ups`);
  });

  // ── Advice drivers (5 explainers always present) ────────────────────────────
  const driverCases: Array<[string, Partial<IntakeMetrics>, string]> = [
    ["injured → rust", { healthStatus: "injured" }, "rust"],
    ["sick → rust", { healthStatus: "sick" }, "rust"],
    ["high risk → herstel", { risk: { level: "high", score: 60, acwr: 1.5, reasons: ["piek"] }, loadSessions: 10 }, "herstel"],
    ["race in 2d → rustig (taper)", { races: { nextA: { name: "Omloop", date: "2026-06-26", daysUntil: 2 }, nextAny: null, count: 1 } }, "rustig"],
    ["fatigue → rustig", { readiness: { label: "tired", score: 30, basis: ["gevoel"] } }, "rustig"],
    ["fresh → stevig", { readiness: { label: "fresh", score: 85, basis: ["gevoel"] }, load: { ctl: 60, atl: 50, tsb: 10 }, risk: { level: "low", score: 5, acwr: 0.9, reasons: [] } }, "stevig"],
    ["thin data → rustig", {}, "rustig"],
    ["steady → normaal", { loadSessions: 10, readiness: { label: "ok", score: 55, basis: ["gevoel"] } }, "normaal"],
  ];
  for (const [name, over, expected] of driverCases) {
    scenario(`advice: ${name}`, () => {
      const i = intake(over);
      const a = generateAdvice(i, BEGINNER, detectContradictions(i.metrics));
      assert(a.intensity === expected, `intensity ${a.intensity} ≠ ${expected}`);
      const e = a.explainers;
      for (const [k, v] of Object.entries(e)) assert(v.trim().length > 0, `explainer ${k} empty`);
      assert(a.headline.trim().length > 0, "headline empty");
    });
  }

  scenario("advice: severe weather eases a hard day and names it", () => {
    const freshOver: Partial<IntakeMetrics> = { loadSessions: 10, load: { ctl: 60, atl: 50, tsb: 10 }, readiness: { label: "fresh", score: 80, basis: ["gevoel"] } };
    const dry = intake(freshOver);
    const dryAdvice = generateAdvice(dry, BEGINNER, detectContradictions(dry.metrics));
    assert(dryAdvice.intensity === "stevig", `expected stevig without weather, got ${dryAdvice.intensity}`);
    const stormy = intake({
      ...freshOver,
      weather: { available: true, reason: "ok", locationLabel: "Utrecht", summaryText: "Onweer, wind tot 60 km/u", severity: "severe", todayForecast: null },
    });
    const stormyAdvice = generateAdvice(stormy, BEGINNER, detectContradictions(stormy.metrics));
    assert(stormyAdvice.intensity === "normaal", `severe weather did not ease stevig, got ${stormyAdvice.intensity}`);
    assert(/weer/i.test(stormyAdvice.headline), "eased headline should name the weather");
    assert(/weer/i.test(stormyAdvice.explainers.watIkZie), "watIkZie should name the weather when it eased advice");
  });
  scenario("advice: caution weather does NOT override a hard day", () => {
    const i = intake({
      loadSessions: 10, load: { ctl: 60, atl: 50, tsb: 10 }, readiness: { label: "fresh", score: 80, basis: ["gevoel"] },
      weather: { available: true, reason: "ok", locationLabel: "Utrecht", summaryText: "Bewolkt, 12–18°C", severity: "caution", todayForecast: null },
    });
    const a = generateAdvice(i, BEGINNER, detectContradictions(i.metrics));
    assert(a.intensity === "stevig", `caution weather should not ease, got ${a.intensity}`);
  });

  // ── Six-part composer ───────────────────────────────────────────────────────
  scenario("compose: six parts, advice always present", () => {
    const i = intake({
      loadSessions: 10,
      load: { ctl: 60, atl: 85, tsb: -25 },
      readiness: { label: "tired", score: 30, basis: ["gevoel"] },
      fatigue: { latest: 8, avg: 7, days: 5 },
      risk: { level: "high", score: 60, acwr: 1.4, reasons: ["piek"] },
    });
    const a = composeCoachAnalysis(i, BEGINNER);
    assert(a.adviesVandaag.trim().length > 0, "adviesVandaag empty");
    assert(a.waaromAdvies.trim().length > 0, "waaromAdvies empty");
    assert(a.verdientAandacht != null, "expected a concern");
    assert("watValtOp" in a && "patronen" in a && "beterDanVerwacht" in a, "missing parts");
  });
  scenario("compose: thin data stays honest (null parts)", () => {
    const a = composeCoachAnalysis(intake(), BEGINNER);
    assert(a.watValtOp === null && a.verdientAandacht === null, "thin data should not invent observations");
    assert(a.adviesVandaag.trim().length > 0, "advice still required");
    assert(a.missing.length > 0, "missing list should not be empty for thin data");
  });

  // ── Advice confidence, actions, follow-up options ───────────────────────────
  scenario("advice: carries a calibrated confidence (never 100)", () => {
    const a = composeCoachAnalysis(intake({ loadSessions: 4 }), BEGINNER);
    assert(a.advice.confidence.score > 0 && a.advice.confidence.score < 100, `got ${a.advice.confidence.score}`);
  });
  scenario("actions: every advice yields at least one next step", () => {
    const a = composeCoachAnalysis(intake(), BEGINNER);
    assert(a.actions.length >= 1, "no dead-end: expected an action");
    assert(a.actions.every((x) => x.label && x.reason), "actions need label + reason");
  });
  scenario("actions: missing check-in offers a check-in step", () => {
    const a = composeCoachAnalysis(intake(), BEGINNER);
    assert(a.actions.some((x) => x.kind === "check_in"), "expected a check_in action");
  });
  scenario("follow-ups: missing check-in carries pickable options", () => {
    const a = composeCoachAnalysis(intake({ loadSessions: 4 }), BEGINNER);
    const q = a.followUps.find((f) => f.id === "missing_checkin");
    assert(q != null && q.options.length === 3, "missing_checkin needs 3 options");
  });
  scenario("follow-up validation: only listed options accepted", () => {
    assert(isValidFollowUpAnswer("missing_checkin", "vermoeid"), "valid option rejected");
    assert(!isValidFollowUpAnswer("missing_checkin", "banaan"), "invalid option accepted");
    assert(optionsFor("nope_unknown").length === 0, "unknown id should have no options");
  });

  // ── Feedback loop: answering changes the advice ─────────────────────────────
  scenario("loop: a 'vermoeid' check-in flips advice toward rest", () => {
    const m = baseMetrics({ loadSessions: 4, load: { ctl: 55, atl: 60, tsb: -5 } });
    const before = composeCoachAnalysis(intake({ loadSessions: 4, load: { ctl: 55, atl: 60, tsb: -5 } }), BEGINNER);
    const { metrics, resolvedIds } = applyFollowUpAnswers(m, [
      { questionId: "missing_checkin", answer: "vermoeid" },
    ]);
    assert(resolvedIds.includes("missing_checkin"), "answer should resolve the question");
    const after = composeCoachAnalysis(
      { ...intake(), metrics, signals: buildSignals(metrics), missing: buildSignals(metrics).filter((s) => s.status === "missing").map((s) => s.kind) },
      BEGINNER,
      { resolvedFollowUpIds: new Set(resolvedIds) },
    );
    assert(metrics.readiness.label === "tired", `readiness should be tired, got ${metrics.readiness.label}`);
    assert(after.advice.intensity !== before.advice.intensity, "advice intensity should change after the check-in");
    assert(!after.followUps.some((f) => f.id === "missing_checkin"), "answered question should not be re-asked");
  });
  scenario("loop: invalid answers are ignored, not applied", () => {
    const m = baseMetrics({ loadSessions: 4 });
    const { metrics, resolvedIds } = applyFollowUpAnswers(m, [
      { questionId: "missing_checkin", answer: "banaan" },
    ]);
    assert(resolvedIds.length === 0, "invalid answer should resolve nothing");
    assert(metrics.readiness.label === "unknown", "invalid answer must not change metrics");
  });

  // ── Copy contract: plain Dutch, never "AI" ──────────────────────────────────
  scenario("copy: composed analysis never says AI", () => {
    const i = intake({
      loadSessions: 10,
      load: { ctl: 60, atl: 85, tsb: -25 },
      readiness: { label: "tired", score: 30, basis: ["gevoel"] },
      fatigue: { latest: 8, avg: 7, days: 5 },
      risk: { level: "high", score: 60, acwr: 1.4, reasons: ["piek"] },
      feedback: { total: 3, done: 0, missed: 0, tooHard: 3, tooLight: 0, pain: 0, tired: 2 },
    });
    const a = composeCoachAnalysis(i, BEGINNER);
    const strings: string[] = [
      a.adviesVandaag,
      a.waaromAdvies,
      a.watValtOp ?? "",
      a.patronen ?? "",
      a.beterDanVerwacht ?? "",
      a.verdientAandacht ?? "",
      ...Object.values(a.advice.explainers),
      ...a.observations.map((o) => o.statement),
      ...a.observations.flatMap((o) => [...o.confidence.reasons, ...o.confidence.uncertainties]),
      ...a.followUps.flatMap((q) => [q.question, q.because]),
      ...a.observations.flatMap((o) => o.signalsUsed.map((s) => `${s.label} ${s.value ?? ""}`)),
    ];
    for (const s of strings) {
      const hit = bannedWord(s);
      assert(hit === null, `banned word "${hit}" in: ${s}`);
    }
  });

  // ── Feedback loop mapping ───────────────────────────────────────────────────
  scenario("feedback: every signal maps to ≥1 dimension nudge", () => {
    for (const sig of COACH_FEEDBACK_SIGNALS) {
      const nudges = mapFeedbackToDimensions(sig);
      assert(nudges.length >= 1, `no nudges for ${sig}`);
      for (const n of nudges) assert(n.weight > 0, `non-positive weight for ${sig}`);
    }
  });
  scenario("feedback: unknown signal is rejected", () => {
    assert(!isCoachFeedbackSignal("nonsense"), "accepted bogus signal");
    assert(isCoachFeedbackSignal("too_strict"), "rejected valid signal");
  });
}

// ── DB-backed scenarios ──────────────────────────────────────────────────────

const RUN = `test_obs_${Date.now()}`;
const ids: string[] = [];
function newId(tag: string): string {
  const id = `${RUN}_${tag}`;
  ids.push(id);
  return id;
}

async function cleanup() {
  if (ids.length === 0) return;
  const { userProfilesTable } = await import("@workspace/db");
  await db.delete(userProfilesTable).where(inArray(userProfilesTable.clerkId, ids));
}

async function dbScenarios() {
  await dbScenario("db: gatherSignals reports honest gaps for a bare account", async () => {
    const id = newId("bare");
    await ensureAccount(id, `${id}@example.test`, "Kale Renner", silentLogger);
    const sig = await gatherSignals(id);
    assert(sig.missing.includes("training_load"), "bare account should miss training load");
    assert(sig.missing.includes("readiness"), "bare account should miss readiness");
    assert(sig.metrics.healthStatus === "ok", "default health not ok");
  });

  await dbScenario("db: runCoachAnalysis returns an analysis with advice", async () => {
    const id = newId("analysis");
    await ensureAccount(id, `${id}@example.test`, "Analyse Renner", silentLogger);
    const { athleteProfilesTable, trainingSessionsTable, athleteDailyMetricsTable } = await import("@workspace/db");
    const { eq: eqProfile } = await import("drizzle-orm");
    // ensureAccount already provisioned an athlete_profiles row — update it.
    await db
      .update(athleteProfilesTable)
      .set({ experienceLevel: "advanced", ftp: 300, healthStatus: "ok" })
      .where(eqProfile(athleteProfilesTable.clerkId, id));
    const today = new Date();
    const rows = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      rows.push({ clerkId: id, sessionDate: d.toISOString().split("T")[0]!, tss: 120, durationMin: 90, type: "ride" });
    }
    await db.insert(trainingSessionsTable).values(rows);
    await db.insert(athleteDailyMetricsTable).values({ clerkId: id, metricDate: today.toISOString().split("T")[0]!, feelScore: 3, fatigueScore: 8 });
    const a = await runCoachAnalysis(id, { persist: true });
    assert(a.adviesVandaag.trim().length > 0, "no advice produced");
    assert(a.personality.key === "ervaren", `expected ervaren, got ${a.personality.key}`);
  });

  await dbScenario("db: persisted observations are deduped on re-run", async () => {
    const id = ids.find((x) => x.endsWith("analysis"))!;
    const { aiObservationsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const before = await db.select().from(aiObservationsTable).where(eq(aiObservationsTable.clerkId, id));
    await runCoachAnalysis(id, { persist: true });
    const after = await db.select().from(aiObservationsTable).where(eq(aiObservationsTable.clerkId, id));
    assert(after.length === before.length, `re-run created duplicates: ${before.length} → ${after.length}`);
  });
}

main();
dbScenarios()
  .then(async () => {
    await cleanup();
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== Observation & Coach Engine V1 — test results ===");
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
