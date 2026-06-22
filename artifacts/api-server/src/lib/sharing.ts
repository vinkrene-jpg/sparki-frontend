import { and, eq } from "drizzle-orm";
import {
  db,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  userProfilesTable,
  type AthleteDailyMetric,
} from "@workspace/db";
import { getEffectivePrivacy } from "./privacy";

/**
 * A coarse, heuristic readiness read derived from the latest self-reported daily
 * metric. This is NOT a validated sports-science model — it is an honest summary
 * of the signals the athlete logged. `score` is null when there is no signal.
 */
export type Readiness = {
  label: "fresh" | "ok" | "tired" | "unknown";
  score: number | null;
  basis: string[];
};

export function computeReadiness(metric: AthleteDailyMetric | null): Readiness {
  if (!metric) return { label: "unknown", score: null, basis: [] };
  const basis: string[] = [];
  const parts: number[] = [];
  // feelScore / fatigueScore are 1–10 self-reports. Higher feel = better,
  // higher fatigue = worse. Sleep quality 1–10 contributes when present.
  if (metric.feelScore != null) {
    parts.push(clamp01(metric.feelScore / 10));
    basis.push("gevoel");
  }
  if (metric.fatigueScore != null) {
    parts.push(clamp01(1 - metric.fatigueScore / 10));
    basis.push("vermoeidheid");
  }
  if (metric.sleepQuality != null) {
    parts.push(clamp01(metric.sleepQuality / 10));
    basis.push("slaapkwaliteit");
  }
  if (parts.length === 0) return { label: "unknown", score: null, basis };
  const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
  const score = Math.round(avg * 100);
  const label = score >= 67 ? "fresh" : score >= 40 ? "ok" : "tired";
  return { label, score, basis };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export async function hasAcceptedCoachLink(
  coachClerkId: string,
  athleteClerkId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ status: coachAthleteLinksTable.status })
    .from(coachAthleteLinksTable)
    .where(
      and(
        eq(coachAthleteLinksTable.coachClerkId, coachClerkId),
        eq(coachAthleteLinksTable.athleteClerkId, athleteClerkId),
      ),
    );
  return row?.status === "accepted";
}

export async function hasAcceptedParentLink(
  parentClerkId: string,
  athleteClerkId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ status: parentAthleteLinksTable.status })
    .from(parentAthleteLinksTable)
    .where(
      and(
        eq(parentAthleteLinksTable.parentClerkId, parentClerkId),
        eq(parentAthleteLinksTable.athleteClerkId, athleteClerkId),
      ),
    );
  return row?.status === "accepted";
}

/** Resolve the athlete's coach-sharing preference. */
export async function coachSharingLevel(athleteClerkId: string) {
  const p = await getEffectivePrivacy(athleteClerkId);
  return p.dataSharingCoach as "none" | "summary" | "full";
}

/** Resolve the athlete's parent-sharing preference. */
export async function parentSharingLevel(athleteClerkId: string) {
  const p = await getEffectivePrivacy(athleteClerkId);
  return p.dataSharingParent as "none" | "safety_only" | "summary";
}

/** Parent consent status, used by the parent surface and consent placeholders. */
export async function getEffectiveParentConsent(athleteClerkId: string) {
  const p = await getEffectivePrivacy(athleteClerkId);
  return {
    parentConsentRequired: p.parentConsentRequired,
    parentConsentStatus: p.parentConsentStatus,
  };
}

export async function hasRole(clerkId: string, role: string): Promise<boolean> {
  const [row] = await db
    .select({ roles: userProfilesTable.roles })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));
  return !!row?.roles?.includes(role);
}
