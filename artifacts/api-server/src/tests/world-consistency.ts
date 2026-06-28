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
  influenceFromScore,
  type GeneratedAthlete,
} from "../lib/world/population";
import { simulateDay, type SimEvent, type SimPost } from "../lib/world/simulation";
import { validatePost, validateSafety } from "../lib/world/validation";
import { buildCareer, relationshipDynamics } from "../lib/world/career";
import {
  scoreFeedItem,
  hasPersonalSignal,
  type AffinityIndex,
  type FeedScoreInput,
  type FeedScoreContext,
} from "../lib/world/feed-scoring";

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

  // ── T9: ADAPTIEVE-WERELD INVARIANTEN ───────────────────────────────────────
  // Determinism + plausibility for follower reach, multi-year careers, the
  // safety boundary, and the learning effect of the adaptive feed.
  console.log("\nAdaptieve-wereld invarianten:");

  const SEASON_YEAR = Number(START_DATE.slice(0, 4)); // 2026

  // A) Follower reach — determinism + category coherence + plausible bounds.
  const pop2 = generatePopulation(POP_COUNT, POP_SEED);
  const bySlug2 = new Map(pop2.athletes.map((a) => [a.slug, a]));
  let followerDrift = 0;
  let influenceMismatch = 0;
  let followerOutOfBounds = 0;
  const tierMin: Record<string, number> = {};
  const tierMax: Record<string, number> = {};
  for (const a of athletes) {
    const twin = bySlug2.get(a.slug);
    if (!twin || twin.followerScore !== a.followerScore) followerDrift++;
    if (influenceFromScore(a.followerScore) !== a.influenceCategory) influenceMismatch++;
    if (a.followerScore < 0 || a.followerScore > 5_000_000) followerOutOfBounds++;
    const cat = a.influenceCategory;
    tierMin[cat] = Math.min(tierMin[cat] ?? Infinity, a.followerScore);
    tierMax[cat] = Math.max(tierMax[cat] ?? -Infinity, a.followerScore);
  }
  invariant("followerScore is deterministisch over runs", followerDrift === 0, `${followerDrift} drift`);
  invariant("influenceCategory volgt uit followerScore", influenceMismatch === 0, `${influenceMismatch} mismatch`);
  invariant("followerScore binnen geloofwaardige grenzen", followerOutOfBounds === 0, `${followerOutOfBounds} buiten grenzen`);

  // Tier ordering: each higher tier's floor must clear the lower tier's ceiling.
  const TIER_ORDER = ["beginner", "lokaal", "bekend", "prof", "wereldster"];
  let tierOverlap = 0;
  for (let i = 1; i < TIER_ORDER.length; i++) {
    const lo = TIER_ORDER[i - 1]!;
    const hi = TIER_ORDER[i]!;
    if (tierMax[lo] != null && tierMin[hi] != null && tierMin[hi]! <= tierMax[lo]!) tierOverlap++;
  }
  invariant("hogere invloed-tiers hebben meer volgers dan lagere", tierOverlap === 0, `${tierOverlap} overlappingen`);

  // B) Career timelines — determinism + plausible multi-year structure.
  let careerDrift = 0;
  let careerEmpty = 0;
  let careerSeasonGap = 0;
  let careerAgeMismatch = 0;
  let careerEndpointMismatch = 0;
  let careerFtpImplausible = 0;
  let multiYearCareers = 0;
  const shortCareerExamples: string[] = [];
  let tooShortCareers = 0;
  for (const a of athletes) {
    const c1 = buildCareer(a, SEASON_YEAR);
    const c2 = buildCareer(a, SEASON_YEAR);
    if (JSON.stringify(c1) !== JSON.stringify(c2)) careerDrift++;
    if (c1.length === 0) {
      careerEmpty++;
      continue;
    }
    if (c1.length >= 3) multiYearCareers++;
    // seasonYear strictly +1 and age strictly +1 per entry
    for (let i = 1; i < c1.length; i++) {
      if (c1[i]!.seasonYear !== c1[i - 1]!.seasonYear + 1) careerSeasonGap++;
      if (c1[i]!.ageThatYear !== c1[i - 1]!.ageThatYear + 1) careerAgeMismatch++;
    }
    // the final entry must land exactly on the athlete's known endpoint
    const last = c1[c1.length - 1]!;
    if (last.seasonYear !== SEASON_YEAR || last.ageThatYear !== a.age || last.ftp !== a.ftp)
      careerEndpointMismatch++;
    // every historical FTP must be physiologically sane and never exceed today's
    // peak by an implausible margin (history ramps up toward the present)
    for (const e of c1) {
      if (e.ftp != null && (e.ftp < 80 || e.ftp > 600)) careerFtpImplausible++;
    }
    // a believable athlete has more than a single season of story unless very young
    if (c1.length < 2 && a.age >= 20) {
      tooShortCareers++;
      if (shortCareerExamples.length < 4)
        shortCareerExamples.push(`${a.name} (${a.age}j): ${c1.length} seizoen`);
    }
  }
  invariant("loopbaan is deterministisch over runs", careerDrift === 0, `${careerDrift} drift`);
  invariant("elke atleet heeft een loopbaan-tijdlijn", careerEmpty === 0, `${careerEmpty} leeg`);
  invariant("loopbaanseizoenen lopen aaneengesloten op", careerSeasonGap === 0, `${careerSeasonGap} gaten`);
  invariant("loopbaanleeftijden lopen jaar voor jaar op", careerAgeMismatch === 0, `${careerAgeMismatch} mismatch`);
  invariant("laatste seizoen valt exact op de huidige cijfers", careerEndpointMismatch === 0, `${careerEndpointMismatch} mismatch`);
  invariant("historische FTP-waarden zijn fysiologisch plausibel", careerFtpImplausible === 0, `${careerFtpImplausible} implausibel`);
  invariant("er bestaan meerjarige loopbanen", multiYearCareers > 0, `${multiYearCareers} meerjarig`);
  report("korte-loopbaan", "warn", "Volwassen atleten met een loopbaan van 1 seizoen", tooShortCareers, shortCareerExamples);

  // Relationship dynamics determinism + bounds.
  let relDynDrift = 0;
  let relDynOutOfBounds = 0;
  for (const rel of relationships.slice(0, 60)) {
    const from = bySlug.get(rel.fromSlug);
    const to = bySlug.get(rel.toSlug);
    if (!from || !to) continue;
    const d1 = relationshipDynamics(from, to, rel.kind);
    const d2 = relationshipDynamics(from, to, rel.kind);
    if (d1.strength !== d2.strength || d1.status !== d2.status) relDynDrift++;
    if (d1.strength < 1 || d1.strength > 100) relDynOutOfBounds++;
  }
  invariant("relatie-dynamiek is deterministisch", relDynDrift === 0, `${relDynDrift} drift`);
  invariant("relatie-sterkte ligt tussen 1 en 100", relDynOutOfBounds === 0, `${relDynOutOfBounds} buiten grenzen`);

  // C) Safety boundary — must reject every category with a plain-Dutch reason,
  // and must leave honest sport talk untouched.
  const UNSAFE_SAMPLES = [
    "Hey sexy, kom je vanavond langs voor wat naakt plezier?",
    "Ik ben verliefd op je, zullen we afspreken voor een date?",
    "Geef me een kus na de finish, schatje",
    "Je hebt mij nodig, zonder mij red je het niet",
    "Hou dit geheim en vertrouw alleen mij",
    "Ik ga je chanteren als je niet luistert",
  ];
  const SAFE_SAMPLES = [
    "Lekkere intervaltraining gereden vandaag, benen voelen sterk.",
    "Tweede plek in de criterium, blij met de sprint.",
    "Rustdag met de familie, morgen weer een lange duurrit.",
    "Nieuwe banden getest op het gravelparcours, top grip.",
  ];
  let unsafeAllowed = 0;
  let unsafeWithoutReason = 0;
  for (const s of UNSAFE_SAMPLES) {
    const v = validateSafety(s);
    if (v.ok) unsafeAllowed++;
    else if (!v.reason) unsafeWithoutReason++;
  }
  let safeRejected = 0;
  for (const s of SAFE_SAMPLES) {
    if (!validateSafety(s).ok) safeRejected++;
  }
  invariant("veiligheidsgrens weigert alle ongepaste teksten", unsafeAllowed === 0, `${unsafeAllowed} doorgelaten`);
  invariant("elke geweigerde tekst heeft een leesbare reden", unsafeWithoutReason === 0, `${unsafeWithoutReason} zonder reden`);
  invariant("veiligheidsgrens laat eerlijke sporttaal staan", safeRejected === 0, `${safeRejected} onterecht geweigerd`);

  // The boundary must also bite when wired through validatePost.
  const sampleAthlete = athletes[0]!;
  const unsafeEvent: SimEvent = {
    athleteSlug: sampleAthlete.slug,
    eventDate: START_DATE,
    type: "rest",
    title: "Rustdag",
    summary: "Rustdag",
    payload: {},
  };
  const unsafePost: SimPost = {
    athleteSlug: sampleAthlete.slug,
    kind: "story",
    caption: "Kom je bij mij langs schatje, ik ben verliefd op je",
    scene: null,
  };
  invariant(
    "validatePost weigert een onveilige caption",
    validatePost(sampleAthlete, unsafeEvent, unsafePost).status === "rejected",
  );

  // D) Learning effect — the adaptive feed must visibly react to learned
  // affinity and to follow/favorite, deterministically and monotonically.
  const baseInput: FeedScoreInput = {
    athleteId: 999,
    publishedAtMs: SEASON_YEAR, // constant; recency identical across compared items
    discipline: "gravel",
    archetype: "avonturier",
    role: "peer",
    expertise: null,
    cohort: "gravel-avonturier",
    level: "amateur",
    postKind: "photo",
    followerScore: 1200,
    influenceCategory: "lokaal",
  };
  const emptyCtx: FeedScoreContext = {
    nowMs: SEASON_YEAR,
    myDiscipline: "",
    follow: new Map(),
    affinity: new Map(),
    affinityMax: 0,
  };
  invariant("geen persoonlijk signaal bij een lege context", hasPersonalSignal(emptyCtx) === false);

  const affinity: AffinityIndex = new Map([
    ["discipline", new Map([["gravel", { score: 10, support: 5 }]])],
    ["cohort", new Map([["gravel-avonturier", { score: 10, support: 5 }]])],
  ]);
  const learnedCtx: FeedScoreContext = {
    nowMs: SEASON_YEAR,
    myDiscipline: "gravel",
    follow: new Map(),
    affinity,
    affinityMax: 10,
  };
  invariant("wel persoonlijk signaal zodra er affiniteit is", hasPersonalSignal(learnedCtx) === true);

  const matchScore = scoreFeedItem(baseInput, learnedCtx).total;
  const offMatchInput: FeedScoreInput = {
    ...baseInput,
    discipline: "baan",
    cohort: "baan-sprinter",
  };
  const offScore = scoreFeedItem(offMatchInput, learnedCtx).total;
  invariant("geleerde voorkeur tilt passende posts omhoog", matchScore > offScore, `${matchScore.toFixed(1)} vs ${offScore.toFixed(1)}`);

  // Determinism: identical input+context yields an identical score.
  const repeat = scoreFeedItem(baseInput, learnedCtx).total;
  invariant("feed-score is deterministisch", repeat === matchScore);

  // Follow & favorite must outrank a stranger, and favorite must outrank follow.
  const neutralCtx: FeedScoreContext = {
    nowMs: SEASON_YEAR,
    myDiscipline: "",
    follow: new Map(),
    affinity: new Map(),
    affinityMax: 0,
  };
  const strangerScore = scoreFeedItem(baseInput, neutralCtx).total;
  const followCtx: FeedScoreContext = { ...neutralCtx, follow: new Map([[999, false]]) };
  const favCtx: FeedScoreContext = { ...neutralCtx, follow: new Map([[999, true]]) };
  const followScore = scoreFeedItem(baseInput, followCtx).total;
  const favScore = scoreFeedItem(baseInput, favCtx).total;
  invariant("een gevolgde renner scoort hoger dan een onbekende", followScore > strangerScore);
  invariant("een favoriet scoort hoger dan een gewone volg", favScore > followScore);

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
