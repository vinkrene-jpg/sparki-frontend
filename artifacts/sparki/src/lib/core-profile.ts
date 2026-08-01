// ── Sparki Core profile composer ──────────────────────────────────────────────
// Deterministic, client-side composition of "what Sparki has DERIVED about the
// athlete" — NOT what the athlete typed into a form. It turns the real engine
// outputs (State Engine, ai_observations, coach archetype, FTP/load/weight
// history) into the living Core page's sections.
//
// Honesty contract (project rule): never fabricate. Every section computes from
// real data and returns an honest-empty result when the data isn't there yet.
// The page renders a section only when it has a genuine reason to be visible.

import type { AthleteProfile, FtpHistoryEntry, TrainingSession } from "@/lib/athlete-types";
import { computeAge } from "@/lib/age";
import type { AiObservation } from "@/hooks/use-ai-memory";
import type { LoadData } from "@/hooks/use-load";
import {
  coachInputFromProfile,
  decideCoach,
  inferExperience,
  type CoachArchetype,
} from "@/lib/coach-engine";

// ── Identity: "Wie ben jij als sporter" ──────────────────────────────────────
// Sparki's derived read of the athlete — archetype (from goal/volume), level
// (from volume), and the engine facts it actually knows. Confidence reflects how
// much real signal backs the read.

export type IdentityFact = { label: string; value: string; accent?: boolean };

export type CoreIdentity = {
  archetype: CoachArchetype | null;
  archetypeLabel: string;
  descriptor: string;
  levelLabel: string;
  disciplineLabel: string | null;
  facts: IdentityFact[];
  confidence: number; // 0..1
  confidenceLabel: string;
  /** Plain-Dutch list of what would sharpen the read, when confidence is low. */
  sharpenWith: string[];
};

const ARCHETYPE_LABEL: Record<CoachArchetype, string> = {
  consistentiecoach: "De volhouder",
  wedstrijdcoach: "De wedstrijdrenner",
  prestatiecoach: "De prestatiejager",
};

const ARCHETYPE_DESCRIPTOR: Record<CoachArchetype, string> = {
  consistentiecoach:
    "Je grootste winst zit in regelmaat — vaker trainen weegt voor jou nu zwaarder dan harder trainen.",
  wedstrijdcoach:
    "Je traint naar een koers toe — vorm, timing en herstel rond je wedstrijden staan voorop.",
  prestatiecoach:
    "Je bent prestatiegericht — je traint om meer vermogen en hardere inspanningen aan te kunnen.",
};

const LEVEL_LABEL: Record<"beginner" | "intermediate" | "advanced", string> = {
  beginner: "Beginnend",
  intermediate: "Gevorderd",
  advanced: "Ervaren",
};

const CONFIDENCE_LABEL = (c: number): string => {
  if (c >= 0.75) return "een scherp beeld";
  if (c >= 0.45) return "een redelijk beeld";
  if (c > 0) return "een eerste beeld";
  return "nog nauwelijks beeld";
};

export function deriveIdentity(
  profile: AthleteProfile | null | undefined,
  sessionsCount: number,
): CoreIdentity | null {
  if (!profile) return null;

  const input = coachInputFromProfile(profile, null, null);
  const decision = input ? decideCoach(input) : null;
  const archetype = decision?.archetype ?? null;

  const weeklyHours = profile.weeklyHourTarget ?? 0;
  const level = LEVEL_LABEL[inferExperience(weeklyHours)];

  // What Sparki actually knows about the athlete's engine (real values only).
  const facts: IdentityFact[] = [];
  if (profile.ftp != null) facts.push({ label: "FTP", value: `${profile.ftp} W` });
  if (profile.wkg != null) facts.push({ label: "W/kg", value: String(profile.wkg), accent: true });
  if (profile.weightKg != null && Number(profile.weightKg) > 0)
    facts.push({ label: "Gewicht", value: `${profile.weightKg} kg` });
  if (profile.weeklyHourTarget != null)
    facts.push({ label: "Uren/week", value: `${profile.weeklyHourTarget} u` });

  // Confidence: how many independent signals back the read (out of 5).
  const signals = [
    !!(profile.goals && profile.goals.trim().length > 0),
    profile.weeklyHourTarget != null,
    !!(profile.discipline && profile.discipline.trim().length > 0),
    profile.ftp != null,
    sessionsCount > 0,
  ];
  const present = signals.filter(Boolean).length;
  const confidence = present / signals.length;

  const sharpenWith: string[] = [];
  if (!(profile.goals && profile.goals.trim().length > 0)) sharpenWith.push("je doel");
  if (profile.weeklyHourTarget == null) sharpenWith.push("hoeveel uur je per week traint");
  if (!(profile.discipline && profile.discipline.trim().length > 0))
    sharpenWith.push("welke discipline je rijdt");
  if (sessionsCount === 0) sharpenWith.push("je eerste ritten");

  return {
    archetype,
    archetypeLabel: archetype ? ARCHETYPE_LABEL[archetype] : "Profiel nog in opbouw",
    descriptor: archetype
      ? ARCHETYPE_DESCRIPTOR[archetype]
      : "Er is nog te weinig bekend om je als sporter te typeren.",
    levelLabel: level,
    disciplineLabel: profile.discipline?.trim() ? profile.discipline.trim() : null,
    facts,
    confidence,
    confidenceLabel: CONFIDENCE_LABEL(confidence),
    sharpenWith,
  };
}

// ── Observations split into honest lenses ─────────────────────────────────────
// Each observation lands in EXACTLY ONE bucket (no duplication across the
// strengths / development / patterns / uncertainty sections), by precedence:
//   1. low confidence            → uncertainty  (Sparki noticed, isn't sure)
//   2. has a detected pattern    → patterns
//   3. severity needs attention  → development
//   4. otherwise (steady/info)   → strengths
// "learned" is the single highest-signal lead, framed as the headline of what
// Sparki has derived; the breakdown below carries the detail.

export type CoreObservations = {
  total: number;
  lead: AiObservation | null;
  strengths: AiObservation[];
  development: AiObservation[];
  patterns: AiObservation[];
  uncertainty: AiObservation[];
};

const SEVERITY_RANK: Record<AiObservation["severity"], number> = {
  urgent: 3,
  important: 2,
  watch: 1,
  info: 0,
};

const CONFIDENCE_RANK: Record<AiObservation["confidence"], number> = {
  high: 2,
  medium: 1,
  low: 0,
};

function needsAttention(o: AiObservation): boolean {
  return o.severity === "watch" || o.severity === "important" || o.severity === "urgent";
}

// The single lens an observation belongs in, by precedence (first match wins):
//   1. low confidence         → uncertainty
//   2. has a detected pattern → patterns
//   3. needs attention        → development
//   4. otherwise (steady)     → strengths
// Exported so other surfaces (e.g. /you) can route GROUPED insights into the
// same lens as categorizeObservations, keeping one source of truth and never
// showing the same maatstaf in two sections.
export type ObservationLane = "strengths" | "development" | "patterns" | "uncertainty";

export function observationLane(o: AiObservation): ObservationLane {
  if (o.confidence === "low") return "uncertainty";
  if (o.detectedPattern && o.detectedPattern.trim().length > 0) return "patterns";
  if (needsAttention(o)) return "development";
  return "strengths";
}

// Transient daily messages (the "today" briefing) belong on Core Status, not in
// the durable profile lenses — they're a momentary read, not a derived trait.
const TRANSIENT_SOURCE_TYPES = new Set(["daily_briefing", "daily_n"]);

export function categorizeObservations(observations: AiObservation[]): CoreObservations {
  // Only consider durable observations Sparki still stands behind.
  const live = observations.filter(
    (o) =>
      o.status !== "dismissed" &&
      o.status !== "outdated" &&
      !TRANSIENT_SOURCE_TYPES.has(o.sourceType),
  );

  const strengths: AiObservation[] = [];
  const development: AiObservation[] = [];
  const patterns: AiObservation[] = [];
  const uncertainty: AiObservation[] = [];

  for (const o of live) {
    switch (observationLane(o)) {
      case "uncertainty":
        uncertainty.push(o);
        break;
      case "patterns":
        patterns.push(o);
        break;
      case "development":
        development.push(o);
        break;
      default:
        strengths.push(o);
    }
  }

  // Lead = the most important, most confident, most recent insight overall.
  const lead =
    [...live].sort((a, b) => {
      const s = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
      if (s !== 0) return s;
      const c = CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
      if (c !== 0) return c;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })[0] ?? null;

  return {
    total: live.length,
    lead,
    strengths,
    development,
    patterns,
    uncertainty,
  };
}

// ── Evolution: "Hoe is je sportprofiel veranderd" ─────────────────────────────
// Real change over time from the actual series. Each item is honest about its
// own evidence; the section is empty (and says so) when there's too little.

export type EvolutionTone = "up" | "down" | "flat";

export type EvolutionItem = {
  key: string;
  label: string;
  current: string;
  change: string;
  detail: string;
  tone: EvolutionTone;
};

function fmtDateNL(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

export function deriveEvolution(
  ftpHistory: FtpHistoryEntry[] | undefined,
  load: LoadData | undefined,
  sessions: TrainingSession[] | undefined,
): { items: EvolutionItem[]; hasAny: boolean } {
  const items: EvolutionItem[] = [];

  // FTP trend — needs ≥2 real measurements.
  const ftps = (ftpHistory ?? [])
    .slice()
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
  if (ftps.length >= 2) {
    const first = ftps[0];
    const last = ftps[ftps.length - 1];
    const delta = last.ftpWatts - first.ftpWatts;
    const tone: EvolutionTone = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    const sign = delta > 0 ? "+" : "";
    items.push({
      key: "ftp",
      label: "FTP",
      current: `${last.ftpWatts} W`,
      change: delta === 0 ? "gelijk gebleven" : `${sign}${delta} W`,
      detail: `Van ${first.ftpWatts} W (${fmtDateNL(first.measuredAt)}) naar ${last.ftpWatts} W (${fmtDateNL(last.measuredAt)}), over ${ftps.length} metingen.`,
      tone,
    });
  }

  // Training-load trend (CTL = fitness) — derived from the load chart series.
  const chart = load?.chartData ?? [];
  if (chart.length >= 2) {
    const firstCtl = chart[0].ctl;
    const lastCtl = chart[chart.length - 1].ctl;
    const delta = Math.round(lastCtl - firstCtl);
    const tone: EvolutionTone = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    const sign = delta > 0 ? "+" : "";
    items.push({
      key: "ctl",
      label: "Conditie (CTL)",
      current: String(Math.round(lastCtl)),
      change: delta === 0 ? "stabiel" : `${sign}${delta}`,
      detail:
        "Je opgebouwde conditie — het langetermijngemiddelde van je trainingsbelasting. Stijgt als je structureel meer traint.",
      tone,
    });
  }

  // Weight trend — from the most recent vs earliest session-adjacent metric is
  // not reliable, so we only report weight change when ≥2 FTP-adjacent points
  // exist via sessions cadence instead. Cadence is honest and always real.
  const recent = (sessions ?? []).filter((s) => {
    const t = new Date(s.sessionDate).getTime();
    return !Number.isNaN(t) && Date.now() - t <= 28 * 86_400_000;
  });
  if ((sessions ?? []).length > 0) {
    const perWeek = (recent.length / 4).toFixed(1).replace(".", ",");
    items.push({
      key: "cadence",
      label: "Trainingsritme",
      current: `${perWeek}/wk`,
      change: `${recent.length} ritten · 4 wk`,
      detail:
        "Hoe vaak je de afgelopen vier weken daadwerkelijk hebt getraind — de belangrijkste maat voor consistentie.",
      tone: recent.length >= 8 ? "up" : recent.length === 0 ? "down" : "flat",
    });
  }

  return { items, hasAny: items.length > 0 };
}

// ── Ontwikkeldoel (long-term development goal) ────────────────────────────────
// The structured long-term ambition the athlete chose. It is the reference point
// every coaching decision is weighed against (Ontwikkelmodel). "persoonlijk"
// lets the athlete describe their own goal in the free-text `goals` field.

export type DevelopmentGoalKey =
  | "recreatief"
  | "granfondo"
  | "topamateur"
  | "elite_u23"
  | "prof"
  | "persoonlijk";

export const DEVELOPMENT_GOALS: {
  key: DevelopmentGoalKey;
  label: string;
  blurb: string;
}[] = [
  {
    key: "recreatief",
    label: "Recreatief & fit",
    blurb: "Lekker blijven fietsen, gezond en fit, zonder wedstrijddruk.",
  },
  {
    key: "granfondo",
    label: "Gran fondo / toertocht",
    blurb: "Een zware toertocht of gran fondo goed kunnen uitrijden.",
  },
  {
    key: "topamateur",
    label: "Wedstrijden bij de amateurs",
    blurb: "Meedoen en presteren in amateurwedstrijden.",
  },
  {
    key: "elite_u23",
    label: "Richting elite / U23",
    blurb: "Doorgroeien naar elite- of beloftenniveau.",
  },
  {
    key: "prof",
    label: "Professioneel",
    blurb: "De ambitie om prof te worden of te blijven.",
  },
  {
    key: "persoonlijk",
    label: "Eigen doel",
    blurb: "Een persoonlijk doel dat je zelf omschrijft.",
  },
];

export function developmentGoalInfo(
  key: string | null | undefined,
): { key: DevelopmentGoalKey; label: string; blurb: string } | null {
  if (!key) return null;
  return DEVELOPMENT_GOALS.find((g) => g.key === key) ?? null;
}

export function developmentGoalLabel(key: string | null | undefined): string | null {
  return developmentGoalInfo(key)?.label ?? null;
}

// ── Belastbaarheid (load tolerance / Body Boost) ──────────────────────────────
// An honest, deterministic first-window read of how much training load the
// athlete can robustly absorb, derived purely from REAL longitudinal data:
//   1. Trainingsregelmaat — how consistent the weekly session rhythm is.
//   2. Opgebouwde basis    — the accumulated fitness (CTL) actually present.
//   3. Opbouwtempo         — whether recent load rose in a controlled way
//                            (acute:chronic ratio), not in unsustainable spikes.
// Health status caps the read. When there is too little data we say so honestly
// (hasData=false) instead of inventing a number. This is explicitly a first-
// window estimate — it never pretends to be built on "years" of data.

export type BelastbaarheidBand = "robuust" | "redelijk" | "beperkt";

export type Belastbaarheid = {
  hasData: boolean;
  score: number | null; // 0..100
  band: BelastbaarheidBand | null;
  headline: string;
  meaning: string;
  confidenceLabel: string;
  windowLabel: string;
  factors: { label: string; value: string }[];
  /** Plain-Dutch reason shown when hasData=false. */
  reason: string | null;
  /** True when the read is held back because the athlete is sick/injured. */
  healthCapped: boolean;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// ── Shared load factors ───────────────────────────────────────────────────────
// The single source of truth for the real, deterministic factors that both the
// Belastbaarheid read and the Ontwikkelprioriteit (bottleneck) engine build on.
// Computed purely from longitudinal load + sessions, so the two stay consistent.
// Each factor is 0..1 where 1 = strong. Honest gate: returns ok=false with a
// plain-Dutch reason when there is too little real data.

type LoadFactors = {
  rhythm: number; // trainingsregelmaat (weekly-session consistency)
  capacity: number; // opgebouwde basis (CTL/70 scale)
  rampSafety: number; // opbouwtempo (acute:chronic control)
  recovery: number; // herstel (sustained TSB / vorm)
  lastCtl: number;
  maxRatio: number;
  avgTsb: number;
  inWindowCount: number;
  spanWeeks: number;
  healthCapped: boolean;
};

function computeLoadFactors(
  load: LoadData | undefined,
  sessions: TrainingSession[] | undefined,
  profile: AthleteProfile | null | undefined,
): { ok: false; reason: string } | { ok: true; f: LoadFactors } {
  const chart = load?.chartData ?? [];
  const allSessions = sessions ?? [];
  const now = Date.now();
  const DAY = 86_400_000;
  const WEEKS = 6;

  // Sessions in the trailing 6-week window — the basis for the rhythm read.
  const inWindow = allSessions.filter((s) => {
    const t = new Date(s.sessionDate).getTime();
    return !Number.isNaN(t) && now - t <= WEEKS * 7 * DAY && now - t >= 0;
  });

  // Honest gate: too little to say anything reliable.
  if (chart.length < 10 || inWindow.length < 6) {
    return {
      ok: false,
      reason:
        "Er zijn minstens een paar weken aan ritten nodig om dit betrouwbaar in te schatten. Koppel je sportdata of log meer ritten.",
    };
  }

  // 1. Trainingsregelmaat — weekly session counts, consistency = 1 - CV.
  const buckets = new Array(WEEKS).fill(0) as number[];
  for (const s of inWindow) {
    const ageDays = (now - new Date(s.sessionDate).getTime()) / DAY;
    const idx = Math.min(WEEKS - 1, Math.floor(ageDays / 7));
    buckets[idx] += 1;
  }
  const mean = buckets.reduce((a, b) => a + b, 0) / WEEKS;
  let rhythm = 0;
  if (mean > 0) {
    const variance = buckets.reduce((a, b) => a + (b - mean) ** 2, 0) / WEEKS;
    const cv = Math.sqrt(variance) / mean;
    rhythm = clamp01(1 - cv);
  }

  // 2. Opgebouwde basis — current CTL. ~70 CTL reflects a solidly trained
  //    amateur; the mapping is honest about being a scale, not an absolute truth.
  const lastCtl = Math.round(chart[chart.length - 1].ctl);
  const capacity = clamp01(lastCtl / 70);

  // 3. Opbouwtempo — acute:chronic workload ratio over the last 14 days. A ratio
  //    that stays controlled (≤1.3) reads as robust; sharp spikes lower it.
  const recentPts = chart.slice(-14);
  let maxRatio = 0;
  for (const p of recentPts) {
    if (p.ctl > 0) maxRatio = Math.max(maxRatio, p.atl / p.ctl);
  }
  let rampSafety = 1;
  if (maxRatio > 1.3) rampSafety = clamp01(1 - (maxRatio - 1.3) / 0.5);

  // 4. Herstel — sustained form (TSB) over the last 14 days. Form that sits deep
  //    in the negative means load isn't landing; -10..-30 is the honest decline
  //    band. Sickness/injury caps recovery low and is flagged.
  const avgTsb =
    recentPts.length > 0
      ? recentPts.reduce((a, p) => a + p.tsb, 0) / recentPts.length
      : 0;
  let recovery = clamp01((avgTsb + 30) / 20);
  const healthCapped =
    profile?.healthStatus === "sick" || profile?.healthStatus === "injured";
  if (healthCapped) recovery = Math.min(recovery, 0.3);

  const firstT = new Date(chart[0].date).getTime();
  const spanWeeks = Number.isNaN(firstT)
    ? WEEKS
    : Math.max(1, Math.round((now - firstT) / (7 * DAY)));

  return {
    ok: true,
    f: {
      rhythm,
      capacity,
      rampSafety,
      recovery,
      lastCtl,
      maxRatio,
      avgTsb,
      inWindowCount: inWindow.length,
      spanWeeks,
      healthCapped,
    },
  };
}

export function deriveBelastbaarheid(
  load: LoadData | undefined,
  sessions: TrainingSession[] | undefined,
  profile: AthleteProfile | null | undefined,
): Belastbaarheid {
  const EMPTY = (reason: string): Belastbaarheid => ({
    hasData: false,
    score: null,
    band: null,
    headline: "Belastbaarheid nog niet in te schatten",
    meaning: "",
    confidenceLabel: "",
    windowLabel: "",
    factors: [],
    reason,
    healthCapped: false,
  });

  const computed = computeLoadFactors(load, sessions, profile);
  if (!computed.ok) return EMPTY(computed.reason);
  const { rhythm, capacity, rampSafety, lastCtl, maxRatio, inWindowCount, spanWeeks, healthCapped } =
    computed.f;

  let score01 = 0.4 * rhythm + 0.35 * capacity + 0.25 * rampSafety;

  // Health gate — sickness/injury holds the read back, honestly flagged.
  if (healthCapped) score01 = Math.min(score01, 0.35);

  const score = Math.round(score01 * 100);
  const band: BelastbaarheidBand =
    score >= 70 ? "robuust" : score >= 45 ? "redelijk" : "beperkt";

  // Confidence + window honesty — based on how much data actually backs the read.
  const confidenceLabel =
    spanWeeks >= 8 && inWindowCount >= 15
      ? "redelijk zeker"
      : spanWeeks >= 4
        ? "een eerste indruk"
        : "nog voorzichtig";
  const windowLabel = `eerste inschatting op basis van ${spanWeeks} ${spanWeeks === 1 ? "week" : "weken"} aan data`;

  const headline =
    band === "robuust"
      ? "Je lichaam kan veel training aan"
      : band === "redelijk"
        ? "Je belastbaarheid is redelijk"
        : "Je belastbaarheid is nog beperkt";

  const baseMeaning =
    band === "robuust"
      ? "Je traint regelmatig en hebt een stevige basis opgebouwd. Daardoor kun je nu meer en hardere training verdragen — mits je herstel blijft kloppen."
      : band === "redelijk"
        ? "Je hebt een redelijke basis, maar er is nog ruimte om steviger te worden. Bouw rustig op en houd je regelmaat vast voordat je de belasting flink verhoogt."
        : "Je basis is nog dun of je ritme wisselt sterk. Eerst regelmaat en geleidelijke opbouw — grote sprongen in belasting zijn nu het grootste risico.";
  const meaning = healthCapped
    ? `${baseMeaning} Omdat je nu ${profile?.healthStatus === "injured" ? "geblesseerd" : "ziek"} bent, wordt je belastbaarheid bewust laag gehouden tot je hersteld bent.`
    : baseMeaning;

  const factors: { label: string; value: string }[] = [
    { label: "Trainingsregelmaat", value: `${Math.round(rhythm * 100)}%` },
    { label: "Opgebouwde basis", value: `CTL ${lastCtl}` },
    {
      label: "Opbouwtempo",
      value: maxRatio <= 1.3 ? "gecontroleerd" : maxRatio <= 1.6 ? "pittig" : "te grillig",
    },
  ];

  return {
    hasData: true,
    score,
    band,
    headline,
    meaning,
    confidenceLabel,
    windowLabel,
    factors,
    reason: null,
    healthCapped,
  };
}

// ── Potentieel-bandbreedte (realistic growth range) ───────────────────────────
// An honest, deterministic estimate of where the athlete can realistically
// develop their FTP over the COMING MONTHS — expressed as a range
// (behoudend / verwacht / optimistisch), never a single guaranteed number and
// never a fake "jaren"-projection. It is derived purely from REAL data:
//   1. FTP-verloop      — the least-squares slope of real FTP measurements.
//   2. Conditietrend    — whether CTL (training load base) is rising/falling.
//   3. Leeftijdsruimte  — physiological trainability headroom from birthYear.
//   4. Datavenster      — how many measurements over how long back the read
//                         (drives the confidence + the width of the range).
// When there is too little real data we say so honestly (hasData=false) instead
// of inventing a band. The horizon is deliberately ONE training block (~3
// months); it never pretends to project years ahead.

export type BandbreedteTone = "up" | "flat" | "down";

export type Bandbreedte = {
  hasData: boolean;
  /** Current FTP the band is anchored on (W). */
  current: number | null;
  /** Conservative end — progress largely stalls / consolidation (W). */
  low: number | null;
  /** Most likely outcome with steady training (W). */
  expected: number | null;
  /** Optimistic end — training and recovery line up well (W). */
  high: number | null;
  unit: string;
  horizonLabel: string;
  goalLabel: string | null;
  tone: BandbreedteTone;
  headline: string;
  meaning: string;
  confidenceLabel: string;
  factors: { label: string; value: string }[];
  /** Plain-Dutch reason shown when hasData=false. */
  reason: string | null;
};

const HORIZON_WEEKS = 12; // one training block (~3 months) — never years.

function ftpSlopePerWeek(
  points: { t: number; y: number }[],
): number {
  // Ordinary least-squares slope of y over t (t in weeks). Caller guarantees
  // ≥2 points with non-zero time spread.
  const n = points.length;
  const meanT = points.reduce((a, p) => a + p.t, 0) / n;
  const meanY = points.reduce((a, p) => a + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - meanT) * (p.y - meanY);
    den += (p.t - meanT) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

// Physiological trainability headroom by age. This is an honest *scale* (younger
// riders have more room to grow, masters trend toward maintenance), not an
// absolute truth — it only widens/narrows the optimistic end of the range.
function ageTrainability(
  birthDate: string | null | undefined,
  birthYear: number | null | undefined,
): { factor: number; label: string } {
  const age = computeAge(birthDate, birthYear);
  if (age == null || age <= 0 || age > 100)
    return { factor: 0.6, label: "onbekend" };
  if (age < 16) return { factor: 0.7, label: "groeit nog" };
  if (age <= 22) return { factor: 1.0, label: "veel ruimte" };
  if (age <= 34) return { factor: 0.75, label: "ruim" };
  if (age <= 44) return { factor: 0.55, label: "gemiddeld" };
  if (age <= 54) return { factor: 0.4, label: "beperkter" };
  return { factor: 0.3, label: "behoud voorop" };
}

function fmtRate(w: number): string {
  const r = Math.round(w * 10) / 10;
  const sign = r > 0 ? "+" : "";
  return `${sign}${r.toFixed(1).replace(".", ",")} W/wk`;
}

export function deriveBandbreedte(
  ftpHistory: FtpHistoryEntry[] | undefined,
  load: LoadData | undefined,
  profile: AthleteProfile | null | undefined,
): Bandbreedte {
  const goalLabel = developmentGoalLabel(profile?.developmentGoal);
  const DAY = 86_400_000;

  const EMPTY = (reason: string): Bandbreedte => ({
    hasData: false,
    current: null,
    low: null,
    expected: null,
    high: null,
    unit: "W",
    horizonLabel: "",
    goalLabel,
    tone: "flat",
    headline: "Groeiruimte nog niet in te schatten",
    meaning: "",
    confidenceLabel: "",
    factors: [],
    reason,
  });

  const ftps = (ftpHistory ?? [])
    .filter((f) => Number.isFinite(f.ftpWatts) && f.ftpWatts > 0)
    .slice()
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());

  // Honest gate: a slope needs at least two real measurements.
  if (ftps.length < 2) {
    return EMPTY(
      "Er zijn minstens twee FTP-metingen nodig om je groeiruimte in te schatten. Doe een FTP-test of koppel je sportdata zodat metingen binnenkomen.",
    );
  }

  const first = ftps[0];
  const last = ftps[ftps.length - 1];
  const t0 = new Date(first.measuredAt).getTime();
  const spanDays = (new Date(last.measuredAt).getTime() - t0) / DAY;

  // And those measurements must span enough time for a slope to mean anything.
  if (spanDays < 21) {
    return EMPTY(
      "Je FTP-metingen liggen nog te dicht op elkaar. Over een paar weken kan een betrouwbare groeirichting worden afgeleid.",
    );
  }

  const points = ftps.map((f) => ({
    t: (new Date(f.measuredAt).getTime() - t0) / (7 * DAY),
    y: f.ftpWatts,
  }));
  const slope = ftpSlopePerWeek(points); // W per week (real, signed)

  const current = profile?.ftp ?? last.ftpWatts;

  // Conditietrend — rising CTL supports growth, falling CTL suppresses it.
  const chart = load?.chartData ?? [];
  let ctlTone: BandbreedteTone = "flat";
  if (chart.length >= 2) {
    const d = chart[chart.length - 1].ctl - chart[0].ctl;
    ctlTone = d > 2 ? "up" : d < -2 ? "down" : "flat";
  }

  const age = ageTrainability(profile?.birthDate, profile?.birthYear);

  // Confidence + range width — more measurements over a longer window make the
  // read tighter and more trustworthy; thin data widens the band honestly.
  const n = ftps.length;
  const spanWeeks = spanDays / 7;
  let confidenceLabel: string;
  if (n >= 5 && spanWeeks >= 12) confidenceLabel = "redelijk zeker";
  else if (n >= 3 && spanWeeks >= 6) confidenceLabel = "een eerste indruk";
  else confidenceLabel = "nog voorzichtig";

  // Build three weekly rates from the observed slope. Gains decelerate, so the
  // expected case deliberately tapers the raw slope (a conservative scale, not
  // an absolute truth). The optimistic end scales with age headroom; the
  // conservative end falls back toward consolidation.
  const taper = 0.7;
  let rateExpected = slope > 0 ? slope * taper : slope;
  let rateHigh = slope > 0 ? slope * (1 + age.factor * 0.8) : Math.max(0, slope * 0.3 + 0.2);
  const rateLow = slope > 0 ? slope * 0.3 : slope;

  // Conditietrend modulates the upside: you rarely gain FTP while your base is
  // shrinking, and a rising base earns a little extra headroom.
  if (ctlTone === "down") {
    rateExpected *= 0.6;
    rateHigh *= 0.6;
  } else if (ctlTone === "up") {
    rateHigh *= 1.1;
  }

  let expected = Math.round(current + rateExpected * HORIZON_WEEKS);
  let high = Math.round(current + rateHigh * HORIZON_WEEKS);
  let low = Math.round(current + rateLow * HORIZON_WEEKS);

  // Enforce a sane ordering: low ≤ expected ≤ high.
  low = Math.min(low, expected);
  high = Math.max(high, expected);

  const deltaExp = expected - current;
  const spread = high - low;

  const tone: BandbreedteTone =
    deltaExp >= 3 ? "up" : deltaExp <= -3 ? "down" : "flat";

  const goalSuffix = goalLabel ? ` richting "${goalLabel}"` : "";

  let headline: string;
  let baseMeaning: string;
  if (spread < 2 && Math.abs(deltaExp) < 3) {
    headline = "Je zit rond een plateau";
    baseMeaning = `Je FTP is de laatste tijd vlak. Verdere groei${goalSuffix} vraagt nu vooral een nieuwe prikkel — meer volume, gerichtere intervallen of beter herstel — eerder dan simpelweg doorgaan.`;
  } else if (tone === "up") {
    headline = "Er zit groei in";
    baseMeaning = `Op basis van je FTP-verloop, conditietrend en leeftijd ligt je FTP over de komende ~3 maanden naar verwachting rond ${expected} W, met een realistische bandbreedte van ${low}–${high} W${goalSuffix}. Dit is een schatting, geen belofte — je werkelijke groei hangt af van hoe je traint en herstelt.`;
  } else if (tone === "down") {
    headline = "Je vorm staat onder druk";
    baseMeaning = `Je FTP-verloop wijst nu omlaag. Zonder bijsturing ligt je FTP over de komende ~3 maanden eerder rond ${expected} W (bandbreedte ${low}–${high} W). Met regelmaat en opbouw is de bovenkant van die band haalbaar — het is een richting, geen vaststaand resultaat.`;
  } else {
    headline = "Je houdt je niveau vast";
    baseMeaning = `Je FTP blijft naar verwachting rond ${expected} W over de komende ~3 maanden, met ruimte tot ${high} W als training en herstel goed samenvallen${goalSuffix}. Een schatting op basis van je eigen data, geen belofte.`;
  }

  const factors: { label: string; value: string }[] = [
    { label: "Tempo nu", value: fmtRate(slope) },
    { label: "Leeftijdsruimte", value: age.label },
    {
      label: "Conditietrend",
      value: ctlTone === "up" ? "stijgend" : ctlTone === "down" ? "dalend" : "stabiel",
    },
  ];

  return {
    hasData: true,
    current,
    low,
    expected,
    high,
    unit: "W",
    horizonLabel: "de komende ~3 maanden",
    goalLabel,
    tone,
    headline,
    meaning: baseMeaning,
    confidenceLabel,
    factors,
    reason: null,
  };
}

// ── Ontwikkelprioriteit (the single biggest limiter) ──────────────────────────
// Directive, not just descriptive: out of the SAME real belastbaarheid factors
// (regelmaat / basis / opbouwtempo / herstel) it names the ONE limiter that,
// improved, moves the athlete most toward their developmentGoal. Each limiter's
// "gap" (how far below ideal) is weighted by how much it matters for the goal;
// the highest-impact gap wins and gets a concrete, honest next action.
//
// Honesty: same evidence gate as belastbaarheid (hasData=false otherwise). When
// no factor is genuinely holding the athlete back, it says so (balanced) rather
// than inventing a problem. Neutral voice, plain Dutch, never fabricates depth.

export type LimiterKey = "regelmaat" | "basis" | "opbouwtempo" | "herstel";

export type Ontwikkelprioriteit = {
  hasData: boolean;
  /** Plain-Dutch reason shown when hasData=false. */
  reason: string | null;
  /** True when no single factor clearly holds development back. */
  balanced: boolean;
  key: LimiterKey | null;
  label: string;
  /** Neutral observation of what is holding development back. */
  finding: string;
  /** A concrete, honest next action. */
  action: string;
  /** The real signals behind the read (the "why"). */
  signals: { label: string; value: string }[];
  /** Transparent ranking of every limiter, strongest gap first. */
  ranked: { key: LimiterKey; label: string; gap: number; impact: number }[];
  /** The goal this is weighed against, when one is set. */
  goalRef: string | null;
};

const LIMITER_LABEL: Record<LimiterKey, string> = {
  regelmaat: "Regelmaat",
  basis: "Aerobe basis",
  opbouwtempo: "Opbouwtempo",
  herstel: "Herstel",
};

// How much each limiter matters for a given long-term goal. These are honest
// emphases (relative weights), not absolute truths — every limiter still counts.
// Default (no goal chosen) treats all factors equally.
const GOAL_WEIGHTS: Record<DevelopmentGoalKey, Record<LimiterKey, number>> = {
  recreatief: { regelmaat: 1.2, basis: 0.8, opbouwtempo: 1.0, herstel: 1.0 },
  granfondo: { regelmaat: 1.0, basis: 1.3, opbouwtempo: 0.9, herstel: 1.0 },
  topamateur: { regelmaat: 1.0, basis: 1.2, opbouwtempo: 1.1, herstel: 1.0 },
  elite_u23: { regelmaat: 0.9, basis: 1.2, opbouwtempo: 1.2, herstel: 1.1 },
  prof: { regelmaat: 0.9, basis: 1.2, opbouwtempo: 1.2, herstel: 1.2 },
  persoonlijk: { regelmaat: 1.0, basis: 1.0, opbouwtempo: 1.0, herstel: 1.0 },
};

const NEUTRAL_WEIGHTS: Record<LimiterKey, number> = {
  regelmaat: 1.0,
  basis: 1.0,
  opbouwtempo: 1.0,
  herstel: 1.0,
};

// A factor is only treated as a real limiter once its gap is meaningful. Below
// this, the athlete is honestly told nothing is holding them back (balanced).
const GAP_THRESHOLD = 0.3;

export function deriveOntwikkelprioriteit(
  load: LoadData | undefined,
  sessions: TrainingSession[] | undefined,
  profile: AthleteProfile | null | undefined,
): Ontwikkelprioriteit {
  const goalKey = developmentGoalInfo(profile?.developmentGoal)?.key ?? null;
  const goalRef = goalKey ? developmentGoalInfo(goalKey)!.label : null;

  const EMPTY = (reason: string): Ontwikkelprioriteit => ({
    hasData: false,
    reason,
    balanced: false,
    key: null,
    label: "",
    finding: "",
    action: "",
    signals: [],
    ranked: [],
    goalRef,
  });

  const computed = computeLoadFactors(load, sessions, profile);
  if (!computed.ok) return EMPTY(computed.reason);
  const { rhythm, capacity, rampSafety, recovery, lastCtl, maxRatio, avgTsb, healthCapped } =
    computed.f;

  const weights = goalKey ? GOAL_WEIGHTS[goalKey] : NEUTRAL_WEIGHTS;

  const scores: Record<LimiterKey, number> = {
    regelmaat: rhythm,
    basis: capacity,
    opbouwtempo: rampSafety,
    herstel: recovery,
  };

  // Gap = how far below ideal; impact = gap weighted by goal relevance.
  const ranked = (Object.keys(scores) as LimiterKey[])
    .map((key) => {
      const gap = clamp01(1 - scores[key]);
      return { key, label: LIMITER_LABEL[key], gap, impact: gap * weights[key] };
    })
    .sort((a, b) => b.impact - a.impact);

  // The real factor readouts — shown as the "why" behind whichever wins.
  const signals: { label: string; value: string }[] = [
    { label: "Trainingsregelmaat", value: `${Math.round(rhythm * 100)}%` },
    { label: "Opgebouwde basis", value: `CTL ${lastCtl}` },
    {
      label: "Opbouwtempo",
      value: maxRatio <= 1.3 ? "gecontroleerd" : maxRatio <= 1.6 ? "pittig" : "te grillig",
    },
    {
      label: "Herstel (vorm)",
      value: `TSB ${avgTsb >= 0 ? "+" : ""}${Math.round(avgTsb)}`,
    },
  ];

  const top = ranked[0];

  // Honest "nothing is holding you back" when no gap is meaningful.
  if (top.gap < GAP_THRESHOLD) {
    return {
      hasData: true,
      reason: null,
      balanced: true,
      key: null,
      label: "Geen duidelijke rem",
      finding:
        "Geen enkele factor remt je ontwikkeling nu duidelijk af — je regelmaat, basis, opbouw en herstel zijn op orde.",
      action: goalRef
        ? `Houd dit vast. De volgende winst zit in geleidelijk meer of gerichter trainen richting "${goalRef}".`
        : "Houd dit vast. De volgende winst zit in geleidelijk meer of gerichter trainen.",
      signals,
      ranked,
      goalRef,
    };
  }

  const goalSuffix = goalRef ? ` richting "${goalRef}"` : "";

  let finding: string;
  let action: string;
  switch (top.key) {
    case "regelmaat":
      finding = `Je traint onregelmatig — de ene week veel, de andere week weinig. Regelmaat is nu je grootste rem${goalSuffix}: je lichaam bouwt het snelst op met een vast ritme.`;
      action =
        "Kies een haalbaar aantal vaste trainingsmomenten per week en houd dat een paar weken vast — liever drie keer elke week dan vijf keer in de ene en één keer in de volgende.";
      break;
    case "basis":
      finding = `Je aerobe basis is nog dun (CTL ${lastCtl}). Een bredere basis is je grootste hefboom${goalSuffix}: er valt meer te winnen met rustige duurtraining dan met losse harde inspanningen.`;
      action =
        "Voeg de komende weken rustige duurkilometers toe (zone 2) en bouw je wekelijkse omvang in kleine stappen op — volgehouden, niet in één sprong.";
      break;
    case "opbouwtempo":
      finding = `Je belasting maakt sprongen — recente trainingen lopen flink voor op je opgebouwde basis. Te grillig opbouwen is nu je grootste rem${goalSuffix}: het verhoogt de kans op vermoeidheid en blessures.`;
      action =
        "Vlak je opbouw af: verhoog je wekelijkse belasting met kleine stappen in plaats van pieken, en wissel zware blokken af met lichtere.";
      break;
    case "herstel":
    default:
      finding = healthCapped
        ? `Omdat je nu ${profile?.healthStatus === "injured" ? "geblesseerd" : "ziek"} bent, is herstel nu je eerste prioriteit${goalSuffix} — pas als je hersteld bent kan training weer landen.`
        : `Je herstel blijft achter — je vorm staat al langer diep in de min. Onvoldoende herstel is nu je grootste rem${goalSuffix}: je trainingen kunnen zo niet renderen.`;
      action =
        "Las herstel in: een paar lichtere dagen of een rustweek zodat je belasting kan landen. Bouw daarna pas weer op.";
      break;
  }

  return {
    hasData: true,
    reason: null,
    balanced: false,
    key: top.key,
    label: LIMITER_LABEL[top.key],
    finding,
    action,
    signals,
    ranked,
    goalRef,
  };
}
