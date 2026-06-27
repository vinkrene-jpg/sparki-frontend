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
    if (o.confidence === "low") uncertainty.push(o);
    else if (o.detectedPattern && o.detectedPattern.trim().length > 0) patterns.push(o);
    else if (needsAttention(o)) development.push(o);
    else strengths.push(o);
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

  const chart = load?.chartData ?? [];
  const allSessions = sessions ?? [];
  const now = Date.now();
  const DAY = 86_400_000;

  // Sessions in the trailing 6-week window — the basis for the rhythm read.
  const WEEKS = 6;
  const inWindow = allSessions.filter((s) => {
    const t = new Date(s.sessionDate).getTime();
    return !Number.isNaN(t) && now - t <= WEEKS * 7 * DAY && now - t >= 0;
  });

  // Honest gate: too little to say anything reliable.
  if (chart.length < 10 || inWindow.length < 6) {
    return EMPTY(
      "Sparki heeft minstens een paar weken aan ritten nodig om je belastbaarheid betrouwbaar in te schatten. Koppel je sportdata of log meer ritten.",
    );
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
    const variance =
      buckets.reduce((a, b) => a + (b - mean) ** 2, 0) / WEEKS;
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

  let score01 = 0.4 * rhythm + 0.35 * capacity + 0.25 * rampSafety;

  // Health gate — sickness/injury holds the read back, honestly flagged.
  const healthCapped =
    profile?.healthStatus === "sick" || profile?.healthStatus === "injured";
  if (healthCapped) score01 = Math.min(score01, 0.35);

  const score = Math.round(score01 * 100);
  const band: BelastbaarheidBand =
    score >= 70 ? "robuust" : score >= 45 ? "redelijk" : "beperkt";

  // Confidence + window honesty — based on how much data actually backs the read.
  const firstT = new Date(chart[0].date).getTime();
  const spanWeeks = Number.isNaN(firstT)
    ? WEEKS
    : Math.max(1, Math.round((now - firstT) / (7 * DAY)));
  const confidenceLabel =
    spanWeeks >= 8 && inWindow.length >= 15
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
    ? `${baseMeaning} Omdat je nu ${profile?.healthStatus === "injured" ? "geblesseerd" : "ziek"} bent, houdt Sparki je belastbaarheid bewust laag tot je hersteld bent.`
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
