// Deterministic scoring for the Test Management Dashboard. Every number here is
// derived purely from REAL telemetry + existing data passed in by the caller —
// there is no randomness, no fabrication, no time-of-day drift. When a tester has
// no telemetry the scores are honestly 0 and reliability is "geen", so the UI can
// show "nog niet gemeten" instead of a fake value.

// The ten canonical screens we measure coverage against. Kept in sync with the
// frontend registry (artifacts/sparki/src/lib/tracked-screens.ts) by intent: the
// keys must match the values trackScreen() emits.
export const COVERAGE_SCREENS = [
  { key: "home", label: "Vandaag" },
  { key: "coach", label: "Coach" },
  { key: "training", label: "Training" },
  { key: "lab", label: "Inzicht" },
  { key: "social", label: "Samen" },
  { key: "routes", label: "Routes" },
  { key: "race", label: "Wedstrijden" },
  { key: "nutrition", label: "Voeding" },
  { key: "connect", label: "Koppelingen" },
  { key: "settings", label: "Instellingen" },
] as const;

export type CoverageStatus = "never" | "viewed" | "active";

// 0 views = never opened, 1-2 = just looked, 3+ = actually exercised.
export function coverageStatus(views: number): CoverageStatus {
  if (views <= 0) return "never";
  if (views < 3) return "viewed";
  return "active";
}

export interface TesterRawData {
  sessions: number;
  totalSeconds: number;
  activeDays30: number;
  lastActivityAt: Date | null;
  featureUses: number;
  // screen key -> number of screen_view events
  coverage: Record<string, number>;
  onboarding: {
    coreCompletedAt: Date | null;
    isComplete: boolean;
    completedSteps: number;
  } | null;
  connectedConnectors: number;
  feedback: {
    total: number;
    bugs: number;
    ideas: number;
    others: number;
    avgDescLen: number;
  };
}

export type ReliabilityLevel = "geen" | "laag" | "gemiddeld" | "hoog";
export type TestPhase =
  | "nog-niet-gestart"
  | "onboarding"
  | "verkennend"
  | "actief"
  | "grondig";

export interface ScreenCoverage {
  key: string;
  label: string;
  views: number;
  status: CoverageStatus;
}

export interface TesterScores {
  compleetheid: number;
  activiteit: number;
  feedbackkwaliteit: number;
  herhaalbaarheid: number;
  testscore: number;
  reliability: ReliabilityLevel;
  phase: TestPhase;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const ratio = (value: number, target: number) =>
  target <= 0 ? 0 : Math.min(value / target, 1);

// How "set up" the tester is: onboarding progress + at least one real connection.
function completenessScore(r: TesterRawData): number {
  let s = 0;
  if (r.onboarding?.coreCompletedAt) s += 50;
  if (r.onboarding?.isComplete) s += 30;
  if (r.connectedConnectors > 0) s += 20;
  return clamp(s);
}

// How much they actually use the app: sessions, time-in-app, spread of days.
function activityScore(r: TesterRawData): number {
  const sessionsScore = ratio(r.sessions, 10) * 40;
  const daysScore = ratio(r.activeDays30, 14) * 30;
  const timeScore = ratio(r.totalSeconds / 60, 120) * 30;
  return clamp(sessionsScore + daysScore + timeScore);
}

// Quality of the feedback they give: volume, variety of kinds, and depth.
function feedbackQualityScore(r: TesterRawData): number {
  const f = r.feedback;
  if (f.total === 0) return 0;
  const volume = ratio(f.total, 5) * 40;
  const kinds =
    (f.bugs > 0 ? 1 : 0) + (f.ideas > 0 ? 1 : 0) + (f.others > 0 ? 1 : 0);
  const variety = (kinds / 3) * 30;
  const depth = ratio(f.avgDescLen, 120) * 30;
  return clamp(volume + variety + depth);
}

// Do they keep coming back? Spread of active days + how recent the last visit is.
function repeatabilityScore(r: TesterRawData): number {
  const daysScore = ratio(r.activeDays30, 12) * 70;
  let recency = 0;
  if (r.lastActivityAt) {
    const ageDays =
      (Date.now() - r.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays <= 7) recency = 30;
    else if (ageDays <= 14) recency = 15;
  }
  return clamp(daysScore + recency);
}

// Reliability is a judgement about how much we can trust the usage picture, so
// it is ONLY ever based on real usage telemetry. Feedback or a finished
// onboarding does not make the usage data trustworthy — without sessions we make
// no claim ("geen"). The no-telemetry case is handled by the gate in
// scoreTester(); this function only runs for telemetry-active testers.
function reliabilityLevel(r: TesterRawData): ReliabilityLevel {
  if (r.sessions >= 5 && r.activeDays30 >= 3) return "hoog";
  if (r.sessions >= 2) return "gemiddeld";
  return "laag";
}

function testPhase(r: TesterRawData, activiteit: number): TestPhase {
  if (r.sessions === 0 && r.featureUses === 0) return "nog-niet-gestart";
  if (!r.onboarding?.coreCompletedAt) return "onboarding";
  if (activiteit < 30) return "verkennend";
  if (activiteit < 60) return "actief";
  return "grondig";
}

export function scoreTester(r: TesterRawData): TesterScores {
  // Real non-telemetry signals — honest even before any usage is measured, and
  // surfaced independently in the UI (each with its own presence check).
  const compleetheid = completenessScore(r);
  const feedbackkwaliteit = feedbackQualityScore(r);

  // Telemetry gate: without any measured usage we make NO usage-based claim.
  // activiteit/herhaalbaarheid are 0 (purely usage-derived), the overall
  // testscore is 0 (the UI shows "—", not a number), reliability is "geen" and
  // the phase is "nog-niet-gestart". This keeps the honesty contract: a tester
  // who only completed onboarding or filed feedback is never shown as if they
  // had actually exercised the app.
  const hasTelemetry = r.sessions > 0 || r.featureUses > 0;
  if (!hasTelemetry) {
    return {
      compleetheid,
      activiteit: 0,
      feedbackkwaliteit,
      herhaalbaarheid: 0,
      testscore: 0,
      reliability: "geen",
      phase: "nog-niet-gestart",
    };
  }

  const activiteit = activityScore(r);
  const herhaalbaarheid = repeatabilityScore(r);
  const testscore = clamp(
    0.3 * activiteit +
      0.2 * compleetheid +
      0.25 * feedbackkwaliteit +
      0.25 * herhaalbaarheid,
  );
  return {
    compleetheid,
    activiteit,
    feedbackkwaliteit,
    herhaalbaarheid,
    testscore,
    reliability: reliabilityLevel(r),
    phase: testPhase(r, activiteit),
  };
}

export function buildCoverage(
  coverage: Record<string, number>,
): ScreenCoverage[] {
  return COVERAGE_SCREENS.map((s) => {
    const views = coverage[s.key] ?? 0;
    return { key: s.key, label: s.label, views, status: coverageStatus(views) };
  });
}

// Percentage of the ten canonical screens this tester has opened at least once.
export function coveragePct(coverage: Record<string, number>): number {
  const opened = COVERAGE_SCREENS.filter(
    (s) => (coverage[s.key] ?? 0) > 0,
  ).length;
  return Math.round((opened / COVERAGE_SCREENS.length) * 100);
}
