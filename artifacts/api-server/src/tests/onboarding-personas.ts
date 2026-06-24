// Sparki Onboarding — 20-persona journey harness.
//
// Drives the REAL onboarding engine (the adaptive question selection, fact
// parsing, coaching-dimension tallies) through the EXACT merge/validation logic
// the `/api/onboarding/next-questions` + `/answer` routes use, simulating a full
// progressive-onboarding journey for 20 varied virtual athletes. Pure functions
// only — no fabricated data, no DB writes. It answers three product questions:
//
//   (a) How does Sparki respond to answers, including nonsensical ones — and does
//       an alternative onboarding path emerge?
//   (b) Does Sparki add EXTRA questions for a willing athlete who wants intensive
//       guidance, and does it use that signal directly?
//   (c) Data quality of a Q&A-only profile vs. one fed by a connected sport app.
//
// Run: `pnpm --filter @workspace/api-server run test:onboarding-personas`
// Requires: DATABASE_URL (only to import @workspace/db; no queries are issued).
// Exits non-zero on any invariant failure (real bug).

import type { AthleteProfile } from "@workspace/db";
import {
  selectNextQuestions,
  selectNextCoachingQuestions,
  parseFactAnswer,
  parseCoachingAnswer,
  getFact,
  isCoachingDimensionKey,
  estimateFtp,
  estimateWeeklyHours,
  defaultAvailableDays,
  type OnboardingQuestion,
  type ProgressiveFacts,
} from "../engines/onboarding";
import { dominantValue } from "../engines/profile";

// ── Test bookkeeping ─────────────────────────────────────────────────────────

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
function check(name: string, fn: () => void) {
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

// ── Faithful copy of the route's question merge (next-questions) ──────────────
// Mirrors routes/onboarding.ts so a bug in the cadence is caught here too.
function mergeQuestions(
  profileQs: OnboardingQuestion[],
  coachingQs: OnboardingQuestion[],
  limit: number,
): OnboardingQuestion[] {
  const merged: OnboardingQuestion[] = [];
  let pi = 0;
  let ci = 0;
  let guard = 0;
  while (
    merged.length < limit &&
    (pi < profileQs.length || ci < coachingQs.length)
  ) {
    if (guard++ > 1000) throw new Error("merge loop did not terminate");
    if (
      pi < profileQs.length &&
      (merged.length % 3 !== 2 || ci >= coachingQs.length)
    ) {
      merged.push(profileQs[pi++]!);
    } else if (ci < coachingQs.length) {
      merged.push(coachingQs[ci++]!);
    } else if (pi < profileQs.length) {
      merged.push(profileQs[pi++]!);
    }
  }
  return merged;
}

const CURRENT_YEAR = new Date().getUTCFullYear();

// A profile exactly as POST /api/onboarding/complete-v2 leaves it: cycling +
// beginner defaults, estimated FTP/hours, the self-claim — nothing else real.
function seededProfile(selfType: string): AthleteProfile {
  const experience = "beginner" as const;
  const days = 3;
  return {
    clerkId: "sim",
    sport: "cycling",
    experienceLevel: experience,
    trainingDaysPerWeek: days,
    availableDays: defaultAvailableDays(days),
    weeklyHourTarget: estimateWeeklyHours(experience, days),
    weeklyHourTargetEstimated: true,
    ftp: estimateFtp(experience),
    ftpEstimated: true,
    selfType,
    coachingMode: null,
    weightKg: null,
    loadCapacity: null,
    discipline: null,
    competitionLevel: null,
    birthYear: null,
    motivation: null,
    injuryHistory: null,
    typicalSleepHours: null,
    heightCm: null,
    trainingPreferences: null,
    goals: null,
  } as unknown as AthleteProfile;
}

// ── Persona model ────────────────────────────────────────────────────────────

type AnswerStyle = "willing" | "reluctant" | "nonsense" | "mixed";

interface Persona {
  name: string;
  selfType: string;
  age: number;
  experience: "beginner" | "intermediate" | "advanced" | "elite";
  coachingMode: "sparki" | "coach";
  guidanceNeed: "high" | "medium" | "low";
  style: AnswerStyle;
  // Whether this athlete asked for intensive guidance and is engaged.
  wantsIntensive: boolean;
}

// A sensible, in-range answer for each question, drawn from the persona.
function sensibleValue(p: Persona, q: OnboardingQuestion): unknown {
  switch (q.key) {
    case "coachingMode":
      return p.coachingMode;
    case "ftp":
      return p.experience === "elite" ? 330 : p.experience === "advanced" ? 290 : 230;
    case "weightKg":
      return 72;
    case "loadCapacity":
      return "moderate";
    case "discipline":
      return "Road";
    case "competitionLevel":
      return p.wantsIntensive ? "regional" : "recreational";
    case "age":
      return p.age;
    case "motivation":
      return "ik wil sterker worden en lekker blijven rijden";
    case "injuryHistory":
      return "geen";
    case "typicalSleepHours":
      return 7.5;
    case "heightCm":
      return 180;
    case "trainingPreferences":
      return "liefst buiten, hekel aan de rollerbank";
    // Coaching dimensions:
    case "guidanceNeed":
      return p.guidanceNeed;
    case "behaviorStyle":
      return "structured";
    case "motivationType":
      return "competitive";
    case "communicationStyle":
      return "supportive";
    case "learningPreference":
      return "practical";
    case "decisionMaking":
      return "collaborative";
    case "mentalSupportNeed":
      return "medium";
    case "goalOrientation":
      return "process";
    default:
      return "structured";
  }
}

// A value that should be REJECTED by the parser (out-of-range / invalid enum /
// empty text), used to probe how Sparki responds to nonsense.
function nonsenseValue(q: OnboardingQuestion): unknown {
  if (q.inputType === "number") {
    // Far outside every fact's accepted band (ftp/weight/age/sleep/height).
    return q.key === "ftp" ? 99999 : q.key === "age" ? 250 : 9999;
  }
  if (q.inputType === "choice") return "banaan";
  return ""; // text: empty string is the only rejectable text input
}

type Decision =
  | { action: "answer"; value: unknown }
  | { action: "skip" }
  | { action: "nonsense"; value: unknown };

function decide(p: Persona, q: OnboardingQuestion, round: number): Decision {
  switch (p.style) {
    case "willing":
      return { action: "answer", value: sensibleValue(p, q) };
    case "reluctant":
      // Answers only the very first prompt (coachingMode), skips the rest.
      return q.key === "coachingMode"
        ? { action: "answer", value: sensibleValue(p, q) }
        : { action: "skip" };
    case "nonsense":
      // Always feeds garbage. coachingMode answered sensibly so a profile exists.
      return q.key === "coachingMode"
        ? { action: "answer", value: sensibleValue(p, q) }
        : { action: "nonsense", value: nonsenseValue(q) };
    case "mixed":
      // Answers sensibly on even rounds, skips on odd — a half-engaged athlete.
      return round % 2 === 0
        ? { action: "answer", value: sensibleValue(p, q) }
        : { action: "skip" };
  }
}

// ── Local mirror of observeDimension's tally maths (pure, no DB) ─────────────
const DIRECT_ANSWER_WEIGHT = 5;
function observeLocal(
  tallies: Record<string, Record<string, number>>,
  key: string,
  value: string,
) {
  const dim = { ...(tallies[key] ?? {}) };
  dim[value] = (dim[value] ?? 0) + DIRECT_ANSWER_WEIGHT;
  tallies[key] = dim;
}

// ── Journey simulation ───────────────────────────────────────────────────────

interface JourneyResult {
  persona: string;
  rounds: number;
  order: string[]; // keys in the order they were surfaced
  accepted: string[];
  rejected: { key: string; round: number }[];
  skipped: string[];
  reachedEnd: boolean;
  profile: AthleteProfile;
  tallies: Record<string, Record<string, number>>;
  guidanceDirectiveReady: boolean; // guidanceNeed reached high confidence?
}

const LIMIT = 3; // server default
const MAX_ROUNDS = 40;

function runJourney(p: Persona): JourneyResult {
  const profile = seededProfile(p.selfType);
  const facts: ProgressiveFacts = {};
  const tallies: Record<string, Record<string, number>> = {};
  const order: string[] = [];
  const accepted: string[] = [];
  const rejected: { key: string; round: number }[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  let round = 0;
  let reachedEnd = false;
  for (; round < MAX_ROUNDS; round++) {
    const profileQs = selectNextQuestions(profile, facts, LIMIT);
    const coachingQs = selectNextCoachingQuestions(
      { tallies } as never,
      facts,
      LIMIT,
    );
    const merged = mergeQuestions(profileQs, coachingQs, LIMIT);

    // Invariant: never exceed the limit, never undefined, never duplicate within
    // a single batch.
    assert(merged.length <= LIMIT, `${p.name}: merge exceeded limit`);
    assert(
      merged.every((q) => q && typeof q.key === "string"),
      `${p.name}: merge produced an undefined question`,
    );
    assert(
      new Set(merged.map((q) => q.key)).size === merged.length,
      `${p.name}: merge produced a duplicate in one batch`,
    );

    if (merged.length === 0) {
      reachedEnd = true;
      break;
    }

    let progressed = false;
    for (const q of merged) {
      if (!seen.has(q.key)) {
        seen.add(q.key);
        order.push(q.key);
      }
      const d = decide(p, q, round);

      if (d.action === "skip") {
        const prev = facts[q.key];
        const snooze = new Date();
        snooze.setUTCDate(snooze.getUTCDate() + 3);
        facts[q.key] = {
          status: "skipped",
          askedCount: (prev?.askedCount ?? 0) + 1,
          lastAskedAt: new Date().toISOString(),
          skippedUntil: snooze.toISOString(),
        };
        if (!skipped.includes(q.key)) skipped.push(q.key);
        progressed = true;
        continue;
      }

      // answer / nonsense → run the SAME validation the route runs.
      if (q.group === "coaching" || isCoachingDimensionKey(q.key)) {
        const parsed = parseCoachingAnswer(q.key, d.value);
        if (!parsed) {
          rejected.push({ key: q.key, round });
          continue; // route returns 400; fact stays unanswered → resurfaces
        }
        observeLocal(tallies, q.key, parsed.value);
        facts[q.key] = { status: "answered", lastAskedAt: new Date().toISOString() };
        accepted.push(q.key);
        progressed = true;
      } else {
        assert(!!getFact(q.key), `${p.name}: surfaced unknown fact "${q.key}"`);
        const parsed = parseFactAnswer(q.key, d.value);
        if (!parsed) {
          rejected.push({ key: q.key, round });
          continue;
        }
        Object.assign(profile, parsed.patch);
        facts[q.key] = { status: "answered", lastAskedAt: new Date().toISOString() };
        accepted.push(q.key);
        progressed = true;
      }
    }

    // A pure-nonsense athlete never marks anything answered/skipped, so the same
    // top questions resurface forever. Break the simulation (and record it) once
    // a full round makes no forward progress.
    if (!progressed) {
      reachedEnd = false;
      break;
    }
  }

  const guidance = dominantValue(tallies["guidanceNeed"]);
  return {
    persona: p.name,
    rounds: round + (reachedEnd ? 0 : 1),
    order,
    accepted,
    rejected,
    skipped,
    reachedEnd,
    profile,
    tallies,
    guidanceDirectiveReady:
      guidance != null && guidance.value === p.guidanceNeed && guidance.confidence === "high",
  };
}

// ── The 20 virtual athletes ──────────────────────────────────────────────────

const PERSONAS: Persona[] = [
  { name: "01 Daan diesel — gretig, intensief", selfType: "diesel", age: 34, experience: "intermediate", coachingMode: "sparki", guidanceNeed: "high", style: "willing", wantsIntensive: true },
  { name: "02 Sanne sprinter — gretig, gemiddeld", selfType: "sprinter", age: 27, experience: "advanced", coachingMode: "sparki", guidanceNeed: "medium", style: "willing", wantsIntensive: false },
  { name: "03 Tom terughoudend — wil cijfers", selfType: "geen_idee", age: 41, experience: "beginner", coachingMode: "sparki", guidanceNeed: "low", style: "reluctant", wantsIntensive: false },
  { name: "04 Nina nonsens — onzin-antwoorden", selfType: "ik_zie_wel", age: 30, experience: "beginner", coachingMode: "sparki", guidanceNeed: "medium", style: "nonsense", wantsIntensive: false },
  { name: "05 Bram met coach — gretig", selfType: "alleskunner", age: 38, experience: "advanced", coachingMode: "coach", guidanceNeed: "low", style: "willing", wantsIntensive: false },
  { name: "06 Jeugd Jens (14) — gretig, intensief", selfType: "sprinter", age: 14, experience: "beginner", coachingMode: "coach", guidanceNeed: "high", style: "willing", wantsIntensive: true },
  { name: "07 Elite Eva — gretig, weinig sturing", selfType: "diesel", age: 24, experience: "elite", coachingMode: "sparki", guidanceNeed: "low", style: "willing", wantsIntensive: false },
  { name: "08 Veteraan Vera (58) — gretig, intensief", selfType: "geen_idee", age: 58, experience: "intermediate", coachingMode: "sparki", guidanceNeed: "high", style: "willing", wantsIntensive: true },
  { name: "09 Halfslachtige Hugo — wisselt", selfType: "ik_zie_wel", age: 33, experience: "beginner", coachingMode: "sparki", guidanceNeed: "medium", style: "mixed", wantsIntensive: false },
  { name: "10 Gretige Gwen — intensief, jong-volw.", selfType: "alleskunner", age: 21, experience: "intermediate", coachingMode: "sparki", guidanceNeed: "high", style: "willing", wantsIntensive: true },
  { name: "11 Pieter passief — skipt alles", selfType: "geen_idee", age: 47, experience: "beginner", coachingMode: "sparki", guidanceNeed: "low", style: "reluctant", wantsIntensive: false },
  { name: "12 Onzin-Otto — onzin + coach", selfType: "diesel", age: 36, experience: "advanced", coachingMode: "coach", guidanceNeed: "medium", style: "nonsense", wantsIntensive: false },
  { name: "13 Marit medior — gretig, gemiddeld", selfType: "sprinter", age: 29, experience: "intermediate", coachingMode: "sparki", guidanceNeed: "medium", style: "willing", wantsIntensive: false },
  { name: "14 Koen kind (10) — gretig, intensief", selfType: "geen_idee", age: 10, experience: "beginner", coachingMode: "coach", guidanceNeed: "high", style: "willing", wantsIntensive: true },
  { name: "15 Senna senior (66) — wisselt", selfType: "ik_zie_wel", age: 66, experience: "beginner", coachingMode: "sparki", guidanceNeed: "high", style: "mixed", wantsIntensive: true },
  { name: "16 Lars liefhebber — gretig, plezier", selfType: "alleskunner", age: 44, experience: "beginner", coachingMode: "sparki", guidanceNeed: "medium", style: "willing", wantsIntensive: false },
  { name: "17 Robin recreant — terughoudend", selfType: "ik_zie_wel", age: 52, experience: "beginner", coachingMode: "sparki", guidanceNeed: "low", style: "reluctant", wantsIntensive: false },
  { name: "18 Anouk ambitieus — gretig, intensief", selfType: "diesel", age: 19, experience: "advanced", coachingMode: "sparki", guidanceNeed: "high", style: "willing", wantsIntensive: true },
  { name: "19 Wessel wisselt — half onzin/half goed", selfType: "sprinter", age: 31, experience: "intermediate", coachingMode: "sparki", guidanceNeed: "medium", style: "mixed", wantsIntensive: false },
  { name: "20 Femke fanatiek — gretig, intensief, coach", selfType: "alleskunner", age: 26, experience: "elite", coachingMode: "coach", guidanceNeed: "high", style: "willing", wantsIntensive: true },
];

// ── Data-quality scoring (Q&A-only vs connected app) ─────────────────────────
// The six fields the first weekplan needs (REQUIRED_FIELDS in missing-data.ts),
// classified as REAL (athlete-supplied), ESTIMATED (Sparki guess) or DEFAULT.
function dataQuality(profile: AthleteProfile) {
  const ftpReal = profile.ftp != null && profile.ftpEstimated === false;
  const hoursReal =
    profile.weeklyHourTarget != null && profile.weeklyHourTargetEstimated === false;
  return {
    discipline: profile.discipline != null ? "echt" : "ontbreekt",
    weight: profile.weightKg != null ? "echt" : "ontbreekt",
    ftp: ftpReal ? "echt" : profile.ftp != null ? "schatting" : "ontbreekt",
    weeklyHours: hoursReal ? "echt" : profile.weeklyHourTarget != null ? "schatting" : "ontbreekt",
    trainingDays: profile.trainingDaysPerWeek != null ? "default" : "ontbreekt",
  };
}

// ── Run ──────────────────────────────────────────────────────────────────────

const journeys = PERSONAS.map(runJourney);

// Invariant checks (real bugs fail the suite).
for (const j of journeys) {
  const p = PERSONAS.find((x) => x.name === j.persona)!;

  check(`${j.persona}: simulatie termineert`, () =>
    assert(j.rounds <= MAX_ROUNDS, `liep tot de ronde-limiet (${j.rounds})`),
  );

  if (p.style === "willing") {
    check(`${j.persona}: gretige atleet doorloopt ALLE vragen`, () => {
      assert(j.reachedEnd, "kwam niet tot het einde van de vragen");
      assert(j.rejected.length === 0, `geldige antwoorden werden geweigerd: ${j.rejected.map((r) => r.key).join(",")}`);
      // Every distinct question that surfaced was answered (no leftovers). Tied
      // to the live catalog rather than a magic number, so it survives catalog
      // growth — only a regression that stops surfacing questions fails it.
      assert(
        j.accepted.length === j.order.length,
        `niet elke gestelde vraag werd beantwoord (${j.accepted.length}/${j.order.length})`,
      );
      // Floor: today's catalog is 12 profielfeiten + 8 begeleidingsdimensies.
      assert(j.accepted.length >= 20, `te weinig vragen gesteld: ${j.accepted.length}`);
    });
  }

  if (p.style === "nonsense") {
    check(`${j.persona}: alle onzin-antwoorden worden geweigerd`, () => {
      // coachingMode is answered sensibly; everything else is garbage and must
      // be rejected by the parser (no silent accept of out-of-range data).
      assert(j.rejected.length > 0, "onzin werd niet geweigerd");
      assert(
        j.accepted.length === 1 && j.accepted[0] === "coachingMode",
        `onzin lekte door als geldig: ${j.accepted.join(",")}`,
      );
      // And because nonsense never snoozes a question, no forward progress is
      // possible after coachingMode → the journey cannot complete.
      assert(!j.reachedEnd, "onzin-atleet 'voltooide' onboarding zonder echte data");
    });
  }

  // coachingMode (basePriority 100) is always the very first question surfaced.
  check(`${j.persona}: 'Wie begeleidt je?' komt als eerste`, () =>
    assert(j.order[0] === "coachingMode", `eerste vraag was ${j.order[0]}`),
  );
}

// guidanceNeed is used directly once answered (high confidence after 1 answer).
for (const j of journeys) {
  const p = PERSONAS.find((x) => x.name === j.persona)!;
  if (p.wantsIntensive && p.style === "willing") {
    check(`${j.persona}: 'intensief begeleiden' wordt direct vastgelegd`, () =>
      assert(
        j.guidanceDirectiveReady,
        "guidanceNeed=high bereikte geen hoge zekerheid na een direct antwoord",
      ),
    );
  }
}

// (b) Does willingness + high guidance EXPAND the question set? Compare the
// number of distinct questions surfaced for an intensive-willing athlete vs a
// non-intensive willing one. If Sparki adapted depth, these would differ.
const intensiveWilling = journeys.find(
  (j) => PERSONAS.find((p) => p.name === j.persona)!.wantsIntensive &&
    PERSONAS.find((p) => p.name === j.persona)!.style === "willing",
)!;
const casualWilling = journeys.find(
  (j) => !PERSONAS.find((p) => p.name === j.persona)!.wantsIntensive &&
    PERSONAS.find((p) => p.name === j.persona)!.style === "willing",
)!;
check("evaluatie(b): vraagomvang verschilt NIET op begeleidingsbehoefte", () =>
  // This documents the finding (not a bug): the catalog is fixed; high guidance
  // does not add deeper questions. If this ever changes, revisit the report.
  assert(
    intensiveWilling.order.length === casualWilling.order.length &&
      intensiveWilling.order.length === 20,
    `intensief=${intensiveWilling.order.length} vs casual=${casualWilling.order.length}`,
  ),
);

// ── Report ───────────────────────────────────────────────────────────────────

function printReport() {
  console.log("\n========================================================");
  console.log(" SPARKI ONBOARDING — 20 VIRTUELE ATLETEN (rapport)");
  console.log("========================================================\n");

  for (const j of journeys) {
    const p = PERSONAS.find((x) => x.name === j.persona)!;
    const q = dataQuality(j.profile);
    console.log(`▶ ${j.persona}`);
    console.log(
      `   stijl=${p.style} | begeleiding=${p.guidanceNeed} | coach=${p.coachingMode} | rondes=${j.rounds}`,
    );
    console.log(
      `   beantwoord=${j.accepted.length}  geskipt=${j.skipped.length}  geweigerd=${j.rejected.length}  einde-bereikt=${j.reachedEnd ? "ja" : "nee"}`,
    );
    console.log(
      `   datakwaliteit → discipline:${q.discipline} gewicht:${q.weight} ftp:${q.ftp} uren:${q.weeklyHours} dagen:${q.trainingDays}`,
    );
    if (j.rejected.length > 0) {
      const uniq = [...new Set(j.rejected.map((r) => r.key))];
      console.log(`   geweigerde vragen (blijven terugkomen): ${uniq.join(", ")}`);
    }
    console.log("");
  }

  // Aggregate data-quality view: a fully willing, Q&A-only athlete.
  const willing = journeys.find(
    (j) => PERSONAS.find((p) => p.name === j.persona)!.style === "willing",
  )!;
  const qq = dataQuality(willing.profile);
  console.log("--------------------------------------------------------");
  console.log(" (c) DATAKWALITEIT — alleen vraag&antwoord vs sport-app");
  console.log("--------------------------------------------------------");
  console.log(
    ` Een gretige atleet die ALLES invult bereikt: discipline:${qq.discipline}, gewicht:${qq.weight}, ftp:${qq.ftp}, uren:${qq.weeklyHours}.`,
  );
  console.log(
    " → FTP wordt 'echt' pas als de atleet een getal invult; tot dan een schatting per niveau.",
  );
  console.log(
    " → Een gekoppelde sport-app zou FTP/gewicht/historie met gemeten waarden vullen i.p.v. een zelfrapportage of schatting.",
  );
  console.log("");

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail");
  console.log("========================================================");
  console.log(" INVARIANTEN (echte bugs falen hier)");
  console.log("========================================================");
  for (const r of results) {
    console.log(
      `[${r.status === "pass" ? "PASS" : "FAIL"}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`,
    );
  }
  console.log(`\n${passed}/${results.length} invarianten geslaagd.\n`);
  return failed.length;
}

const failedCount = printReport();
process.exit(failedCount > 0 ? 1 : 0);
