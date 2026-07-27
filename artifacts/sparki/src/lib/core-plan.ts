import type { TrainingPlanResponse } from "@/hooks/use-training-plan";
import type { TrainingSession } from "@/lib/athlete-types";
import { localISODate } from "./commercial-shell";

export function bronZin(plan: TrainingPlanResponse | undefined, hasManual: boolean): string {
  if (plan?.hasCoach) return "Schema van je trainer";
  if (plan?.plan && plan.mode === "autonomous") return "Opgebouwd door Sparki";
  if (hasManual) return "Zelf samengesteld";
  return "Nog geen schema";
}

export function kiesPlanActie(
  plan: TrainingPlanResponse | undefined,
  canBuildNow: boolean
): "missing" | "generate" | "adapt" | "none" {
  if (plan?.hasCoach) return "none";
  if (plan?.plan && plan.mode === "autonomous") return "adapt";
  if (!canBuildNow) return "missing";
  return "generate";
}

export function afleidDagStatus(type: string | undefined | null): "training" | "herstel" | "leeg" {
  if (!type) return "leeg";
  if (type === "rest") return "herstel";
  return "training";
}

// Ensure local time operations.
export function startOfLocalWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  // Monday is 1, Sunday is 0 -> Monday should be start
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
}

export function buildWeekGridLocal(baseDate: Date, offsetWeeks: number): Date[] {
  const start = startOfLocalWeek(baseDate);
  start.setDate(start.getDate() + offsetWeeks * 7);
  const out: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    out.push(cur);
  }
  return out;
}

export function derivedFacts(s: TrainingSession): string[] {
  const out: string[] = [];
  if (s.durationMin != null) out.push(`${s.durationMin} min`);
  if (s.distanceKm != null && s.distanceKm !== "") out.push(`${s.distanceKm} km`);
  if (s.elevationM != null) out.push(`${s.elevationM} hm`);
  if (s.avgPower != null) out.push(`${s.avgPower} W gem.`);
  if (s.normalizedPower != null) out.push(`${s.normalizedPower} W NP`);
  if (s.avgHR != null) out.push(`${s.avgHR} bpm`);
  if (s.tss != null) out.push(`${s.tss} TSS`);
  return out;
}

const SELF_REPORTED_SOURCES = new Set(["manual", "sparki"]);

export function awaitsFeel(s: TrainingSession): boolean {
  return !SELF_REPORTED_SOURCES.has(s.source.toLowerCase()) && s.feelScore == null;
}

const FEEL_PROMPT_WINDOW_DAYS = 14;

export function withinFeelWindow(s: TrainingSession): boolean {
  const days = Math.floor(
    (Date.now() - new Date(s.sessionDate + "T12:00:00Z").getTime()) / 86_400_000,
  );
  return days >= 0 && days <= FEEL_PROMPT_WINDOW_DAYS;
}

const SOURCE_LABELS: Record<string, string> = {
  strava: "Strava",
  garmin: "Garmin",
  wahoo: "Wahoo",
  import: "import",
  gpx: "GPX-bestand",
};

export function sourceLabel(s: string): string {
  return SOURCE_LABELS[s.toLowerCase()] ?? s;
}
