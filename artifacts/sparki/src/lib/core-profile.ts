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
    "Sparki ziet je grootste winst in regelmaat — vaker trainen weegt voor jou nu zwaarder dan harder trainen.",
  wedstrijdcoach:
    "Sparki leest je als iemand die naar een koers toe traint — vorm, timing en herstel rond je wedstrijden staan voorop.",
  prestatiecoach:
    "Sparki leest je als prestatiegericht — je traint om meer vermogen en hardere inspanningen aan te kunnen.",
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
    archetypeLabel: archetype ? ARCHETYPE_LABEL[archetype] : "Sparki leert je nog kennen",
    descriptor: archetype
      ? ARCHETYPE_DESCRIPTOR[archetype]
      : "Sparki heeft nog te weinig van je gezien om je als sporter te typeren.",
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
        "Hoe vaak je de afgelopen vier weken daadwerkelijk hebt getraind — Sparki's belangrijkste maat voor consistentie.",
      tone: recent.length >= 8 ? "up" : recent.length === 0 ? "down" : "flat",
    });
  }

  return { items, hasAny: items.length > 0 };
}
