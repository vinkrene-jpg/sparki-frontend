// Sparki World — consistency harness + weak-spot dashboard (T007).
//
// A text-only, deterministic simulation over a LONG horizon (no DB, no images)
// that stress-tests the living world and reports WHERE it becomes unrealistic.
//
// Two layers:
//   1. HARD INVARIANTS — things that must always hold (population physiology,
//      determinism, approved posts re-pass validation, rejected posts carry a
//      reason, no forbidden wording, relationship-graph integrity). A broken
//      invariant fails the process.
//   2. BELIEVABILITY FINDINGS — a dashboard of weak spots the simulation can
//      drift into because day-events are generated independently (no day-to-day
//      memory): e.g. racing on back-to-back days, weeks without any rest, a hard
//      effort the day after an injury, monotonous lives, runaway weekly load.
//      Findings are graded info / warn / error and printed sorted by severity.
//      Only error-level findings (physically impossible, not merely unlikely)
//      fail the process — warnings are the honest "here be dragons" report.

import {
  generatePopulation,
  validatePopulation,
  type GeneratedAthlete,
} from "../lib/world/population";
import { simulateDay, type SimEvent, type SimPost } from "../lib/world/simulation";
import { validatePost } from "../lib/world/validation";

// ── harness config ───────────────────────────────────────────────────────────
const POP_COUNT = 50;
const POP_SEED = 1;
const START_DATE = "2026-01-01";
const HORIZON_DAYS = 90;

// ── tiny report plumbing ─────────────────────────────────────────────────────
type Severity = "info" | "warn" | "error";
type Finding = {
  id: string;
  severity: Severity;
  title: string;
  count: number;
  examples: string[];
};

const findings: Finding[] = [];
function report(
  id: string,
  severity: Severity,
  title: string,
  count: number,
  examples: string[] = [],
) {
  if (count <= 0) return;
  findings.push({ id, severity, title, count, examples: examples.slice(0, 4) });
}

let hardPassed = 0;
let hardFailed = 0;
function invariant(name: string, cond: boolean, detail = "") {
  if (cond) {
    hardPassed++;
    console.log(`  \u2713 ${name}`);
  } else {
    hardFailed++;
    console.log(`  \u2717 ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function datesFrom(start: string, days: number): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    out.push(d.toISOString().split("T")[0]!);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// ── run the world ────────────────────────────────────────────────────────────
type DayRecord = { date: string; event: SimEvent; post: SimPost };

function main() {
  console.log("\nSparki World — Consistentie-harness (T007)\n");

  const { athletes, relationships } = generatePopulation(POP_COUNT, POP_SEED);
  const dates = datesFrom(START_DATE, HORIZON_DAYS);
  const bySlug = new Map(athletes.map((a) => [a.slug, a]));

  // Per-athlete chronological timeline of (event, post).
  const timeline = new Map<string, DayRecord[]>();
  let total = 0;
  let approved = 0;
  let rejected = 0;
  let rejectedWithoutReason = 0;
  let approvedFailingValidator = 0;
  let forbiddenLeak = 0;
  let photoWithoutScene = 0;
  let placeholderLeak = 0;
  const globalCaptions = new Map<string, number>();
  const eventTypes = new Set<string>();

  for (const a of athletes) {
    const recs: DayRecord[] = [];
    for (const date of dates) {
      const { event, post } = simulateDay(a, date, { withImage: false });
      const verdict = validatePost(a, event, post);
      total++;
      eventTypes.add(event.type);
      globalCaptions.set(post.caption, (globalCaptions.get(post.caption) ?? 0) + 1);

      if (verdict.status === "approved") {
        approved++;
        if (validatePost(a, event, post).status !== "approved") approvedFailingValidator++;
        if (/\bA\.?I\.?\b/i.test(post.caption) || /Sparki (ziet|denkt|weet|merkt|leest|kijkt|baseert|zag)/i.test(post.caption))
          forbiddenLeak++;
        if (/\{[a-z]+\}/i.test(post.caption)) placeholderLeak++;
        if (post.kind === "photo" && !post.scene) photoWithoutScene++;
      } else {
        rejected++;
        if (!verdict.notes) rejectedWithoutReason++;
      }
      recs.push({ date, event, post });
    }
    timeline.set(a.slug, recs);
  }

  // ── HARD INVARIANTS ────────────────────────────────────────────────────────
  console.log("Harde invarianten:");

  const popIssues = validatePopulation({ athletes, relationships });
  invariant(
    "populatie-fysiologie is plausibel",
    popIssues.length === 0,
    popIssues.slice(0, 3).map((i) => `${i.slug}: ${i.problem}`).join("; "),
  );

  invariant("een lange wereld-horizon produceert posts", total > 0, `total=${total}`);
  invariant("er zijn goedgekeurde posts", approved > 0, `approved=${approved}`);
  invariant("elke goedgekeurde post doorstaat validatie opnieuw", approvedFailingValidator === 0, `${approvedFailingValidator} faalden`);
  invariant("elke afgekeurde post heeft een reden", rejectedWithoutReason === 0, `${rejectedWithoutReason} zonder reden`);
  invariant("geen verboden formulering in goedgekeurde caption", forbiddenLeak === 0, `${forbiddenLeak} lekken`);
  invariant("geen ongevulde placeholder in goedgekeurde caption", placeholderLeak === 0, `${placeholderLeak} lekken`);
  invariant("geen foto-post zonder beeld goedgekeurd", photoWithoutScene === 0);

  // determinism over the whole horizon for a sample of athletes
  let nonDeterministic = 0;
  for (const a of athletes.slice(0, 5)) {
    for (const date of dates) {
      const x = simulateDay(a, date);
      const y = simulateDay(a, date);
      if (JSON.stringify(x.event) !== JSON.stringify(y.event) || x.post.caption !== y.post.caption)
        nonDeterministic++;
    }
  }
  invariant("simulatie is deterministisch over de horizon", nonDeterministic === 0, `${nonDeterministic} afwijkingen`);

  // relationship-graph integrity
  let danglingRel = 0;
  let selfRel = 0;
  let asymmetric = 0;
  const relSet = new Set(relationships.map((r) => `${r.fromSlug}|${r.toSlug}|${r.kind}`));
  const symmetricKinds = new Set(["friend", "rival", "teammate"]);
  for (const r of relationships) {
    if (!bySlug.has(r.fromSlug) || !bySlug.has(r.toSlug)) danglingRel++;
    if (r.fromSlug === r.toSlug) selfRel++;
    if (symmetricKinds.has(r.kind) && !relSet.has(`${r.toSlug}|${r.fromSlug}|${r.kind}`))
      asymmetric++;
  }
  invariant("alle relaties verwijzen naar bestaande atleten", danglingRel === 0, `${danglingRel} dangling`);
  invariant("geen relatie met zichzelf", selfRel === 0, `${selfRel} self-rel`);
  invariant("vriend/rivaal/ploeggenoot relaties zijn symmetrisch", asymmetric === 0, `${asymmetric} asymmetrisch`);

  // ── BELIEVABILITY FINDINGS (the dashboard) ─────────────────────────────────

  // 1) Caption monoculture — global uniqueness ratio.
  const uniqueRatio = globalCaptions.size / total;
  if (uniqueRatio < 0.1)
    report("caption-monoculture", "warn", "Weinig variatie in captions over de hele wereld", 1, [
      `${(uniqueRatio * 100).toFixed(1)}% uniek (${globalCaptions.size}/${total})`,
    ]);

  // 2) Most-repeated captions (informational — shows where copy gets stale).
  const topCaptions = [...globalCaptions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const overRepeated = topCaptions.filter(([, c]) => c > total * 0.03);
  if (overRepeated.length > 0)
    report(
      "caption-herhaling",
      "info",
      "Sommige captions komen vaak terug",
      overRepeated.length,
      overRepeated.map(([cap, c]) => `${c}\u00d7 "${cap.slice(0, 48)}"`),
    );

  // Per-athlete timeline analysis.
  let racersBackToBack = 0;
  const backToBackExamples: string[] = [];
  let racersTripleStreak = 0;
  const tripleExamples: string[] = [];
  let noRestAthletes = 0;
  const noRestExamples: string[] = [];
  let hardAfterInjury = 0;
  const hardAfterInjuryExamples: string[] = [];
  let monotoneAthletes = 0;
  const monotoneExamples: string[] = [];
  let runawayWeeks = 0;
  const runawayExamples: string[] = [];
  let identicalCaptionRun = 0;
  const identicalRunExamples: string[] = [];

  const REST_TYPES = new Set(["rest", "recovery", "illness", "injury"]);

  for (const a of athletes) {
    const recs = timeline.get(a.slug)!;

    // a) back-to-back & triple race streaks
    let raceStreak = 0;
    let maxRaceStreak = 0;
    for (const r of recs) {
      if (r.event.type === "race") {
        raceStreak++;
        maxRaceStreak = Math.max(maxRaceStreak, raceStreak);
      } else raceStreak = 0;
    }
    if (maxRaceStreak >= 2) {
      racersBackToBack++;
      if (backToBackExamples.length < 4) backToBackExamples.push(`${a.name}: ${maxRaceStreak} koersdagen op rij`);
    }
    if (maxRaceStreak >= 3) {
      racersTripleStreak++;
      if (tripleExamples.length < 4) tripleExamples.push(`${a.name}: ${maxRaceStreak} koersdagen op rij`);
    }

    // b) longest streak without any rest/recovery/illness/injury
    let trainStreak = 0;
    let maxTrainStreak = 0;
    for (const r of recs) {
      if (REST_TYPES.has(r.event.type)) trainStreak = 0;
      else {
        trainStreak++;
        maxTrainStreak = Math.max(maxTrainStreak, trainStreak);
      }
    }
    if (maxTrainStreak >= 21) {
      noRestAthletes++;
      if (noRestExamples.length < 4) noRestExamples.push(`${a.name}: ${maxTrainStreak} dagen zonder rust`);
    }

    // c) hard effort the day after injury/illness
    for (let i = 1; i < recs.length; i++) {
      const prev = recs[i - 1]!.event;
      const cur = recs[i]!.event;
      const wasHurt = prev.type === "injury" || prev.type === "illness";
      const hardNow =
        cur.type === "race" ||
        (cur.type === "training" && Number(cur.payload.tss ?? 0) >= 80);
      if (wasHurt && hardNow) {
        hardAfterInjury++;
        if (hardAfterInjuryExamples.length < 4)
          hardAfterInjuryExamples.push(`${a.name}: ${prev.type} → ${cur.type} op ${recs[i]!.date}`);
        break;
      }
    }

    // d) monotone life — too few distinct event types over 90 days
    const distinct = new Set(recs.map((r) => r.event.type));
    if (distinct.size < 3) {
      monotoneAthletes++;
      if (monotoneExamples.length < 4) monotoneExamples.push(`${a.name}: ${distinct.size} soorten events`);
    }

    // e) runaway weekly training load (week-over-week ramp)
    const weekTss: number[] = [];
    for (let w = 0; w * 7 < recs.length; w++) {
      let sum = 0;
      for (let d = w * 7; d < Math.min((w + 1) * 7, recs.length); d++) {
        const e = recs[d]!.event;
        if (e.type === "training" || e.type === "race") sum += Number(e.payload.tss ?? 0);
      }
      weekTss.push(sum);
    }
    for (let w = 1; w < weekTss.length; w++) {
      if (weekTss[w]! > 700 && weekTss[w]! > weekTss[w - 1]! * 2.0) {
        runawayWeeks++;
        if (runawayExamples.length < 4)
          runawayExamples.push(`${a.name}: week ${w} TSS ${weekTss[w - 1]}\u2192${weekTss[w]}`);
        break;
      }
    }

    // f) identical caption repeated on consecutive days for one athlete
    let capRun = 1;
    let maxCapRun = 1;
    for (let i = 1; i < recs.length; i++) {
      if (recs[i]!.post.caption === recs[i - 1]!.post.caption) {
        capRun++;
        maxCapRun = Math.max(maxCapRun, capRun);
      } else capRun = 1;
    }
    if (maxCapRun >= 3) {
      identicalCaptionRun++;
      if (identicalRunExamples.length < 4)
        identicalRunExamples.push(`${a.name}: zelfde caption ${maxCapRun} dagen op rij`);
    }
  }

  report("koers-back-to-back", "warn", "Atleten koersen op opeenvolgende dagen", racersBackToBack, backToBackExamples);
  report("koers-triple", "error", "Atleten koersen 3+ dagen op rij (fysiek onmogelijk)", racersTripleStreak, tripleExamples);
  report("geen-rust", "warn", "Atleten trainen 3+ weken zonder rust/herstel", noRestAthletes, noRestExamples);
  report("hard-na-blessure", "warn", "Harde inspanning de dag na blessure/ziekte", hardAfterInjury, hardAfterInjuryExamples);
  report("monotoon-leven", "warn", "Atleten met te weinig variatie in events", monotoneAthletes, monotoneExamples);
  report("explosieve-belasting", "warn", "Onrealistische wekelijkse belastingssprong (>2\u00d7)", runawayWeeks, runawayExamples);
  report("caption-run", "warn", "Zelfde caption meerdere dagen op rij per atleet", identicalCaptionRun, identicalRunExamples);

  // ── dashboard print ────────────────────────────────────────────────────────
  const order: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
  const icon: Record<Severity, string> = { error: "\u26d4", warn: "\u26a0\ufe0f ", info: "\u2139\ufe0f " };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);

  console.log("\nDashboard — zwakke plekken (gesorteerd op ernst):");
  if (findings.length === 0) {
    console.log("  (geen zwakke plekken gevonden in deze horizon)");
  } else {
    for (const f of findings) {
      console.log(`  ${icon[f.severity]} [${f.severity.toUpperCase()}] ${f.title} — ${f.count}`);
      for (const ex of f.examples) console.log(`        \u2022 ${ex}`);
    }
  }

  // ── summary & exit ─────────────────────────────────────────────────────────
  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");
  console.log(
    `\n  Samenvatting: ${total} atleet-dagen over ${HORIZON_DAYS} dagen, ${approved} goedgekeurd, ${rejected} afgekeurd.`,
  );
  console.log(`  Event-types: ${[...eventTypes].sort().join(", ")}`);
  console.log(`  Unieke captions: ${globalCaptions.size} (${(uniqueRatio * 100).toFixed(1)}%)`);
  console.log(`  Bevindingen: ${errors.length} error, ${warns.length} warn, ${findings.length - errors.length - warns.length} info.`);
  console.log(`\n  Harde invarianten: ${hardPassed}/${hardPassed + hardFailed} geslaagd.`);

  if (hardFailed > 0 || errors.length > 0) {
    console.log(
      `\n\u2717 Harness faalt: ${hardFailed} invariant(en) gebroken, ${errors.length} error-bevinding(en).`,
    );
    process.exit(1);
  }
  console.log("\n\u2713 Harness geslaagd (warnings zijn rapportage, geen blokkers).");
}

main();
