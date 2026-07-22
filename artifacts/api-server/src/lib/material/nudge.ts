import { and, eq } from "drizzle-orm";
import {
  db,
  trainingSessionsTable,
  materialAnalysesTable,
  notificationsTable,
} from "@workspace/db";

// ─────────────────────────────────────────────────────────────────────────────
// Materiaalcoach — proactive wear nudge.
//
// Today the Materiaalcoach is fully reactive: the athlete must open Inzicht and
// pick a topic. This engine lets Sparki *notice* worn equipment from REAL
// training data and gently suggest a check — never a form, never mandatory.
//
// The signal is deterministic and honest: accumulated cycling distance since the
// last time Sparki looked at a given wear part (chain / tyres / brakes), or all
// logged cycling distance when that part was never checked. A nudge only fires
// when that real distance crosses a realistic wear threshold. No fabricated
// triggers — zero data means zero nudges.
// ─────────────────────────────────────────────────────────────────────────────

export type MaterialNudgeCategory = "chain" | "tyres" | "brakes";

type WearRule = {
  category: MaterialNudgeCategory;
  // Plain-Dutch part label, lower-case for inline use in a sentence.
  label: string;
  // Realistic, conservative wear interval in cycling kilometres.
  thresholdKm: number;
  // Why the part wears — keeps the nudge honest about its reasoning.
  reason: string;
};

// Ordered by how early the part wears. Conservative thresholds: a chain stretches
// well before tyres harden, which wear before brake pads. These are gentle
// reminders, not hard limits.
const WEAR_RULES: readonly WearRule[] = [
  {
    category: "chain",
    label: "ketting",
    thresholdKm: 3000,
    reason: "Een ketting rekt langzaam uit met de kilometers",
  },
  {
    category: "tyres",
    label: "banden",
    thresholdKm: 4000,
    reason: "Banden slijten en verharden naarmate je meer rijdt",
  },
  {
    category: "brakes",
    label: "remblokken",
    thresholdKm: 5000,
    reason: "Remblokken slijten geleidelijk weg",
  },
];

export type MaterialNudge = {
  category: MaterialNudgeCategory;
  label: string;
  title: string;
  message: string;
  // Real accumulated cycling distance since the part was last seen (rounded).
  distanceSinceKm: number;
  thresholdKm: number;
  // How many full wear intervals deep the athlete is (>= 1). Encoded in the
  // notification action url so a nudge only re-surfaces after another full
  // interval of real riding — honest escalation, never spam.
  bucket: number;
  lastCheckedAt: string | null;
  actionUrl: string;
};

function roundKm(km: number): number {
  // "zo'n X km" — round to the nearest 100 for a natural, non-fake-precise feel.
  return Math.max(0, Math.round(km / 100) * 100);
}

function buildMessage(rule: WearRule, km: number, checked: boolean): string {
  const shown = roundKm(km);
  if (checked) {
    return `Je hebt zo'n ${shown} km gereden sinds Sparki je ${rule.label} voor het laatst zag. ${rule.reason} — laat 'm eens zien?`;
  }
  return `Je hebt al zo'n ${shown} km in de benen en Sparki heeft je ${rule.label} nog nooit bekeken. ${rule.reason} — even laten checken?`;
}

function buildTitle(rule: WearRule): string {
  return `Tijd om je ${rule.label} te laten zien?`;
}

// Deterministically evaluate whether one wear part is overdue for a check. Reads
// only real data; returns the single most-overdue part, or null when nothing
// crosses a threshold (or there is no cycling data at all).
export async function evaluateMaterialNudge(
  clerkId: string,
): Promise<MaterialNudge | null> {
  // Real cycling sessions only — these parts are bike parts.
  const sessions = await db
    .select({
      date: trainingSessionsTable.sessionDate,
      dist: trainingSessionsTable.distanceKm,
    })
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.clerkId, clerkId),
        eq(trainingSessionsTable.sport, "cycling"),
      ),
    );

  if (sessions.length === 0) return null;

  const parsed = sessions
    .map((s) => ({
      date: s.date,
      km: s.dist == null ? 0 : Number(s.dist),
    }))
    .filter((s) => s.date != null && Number.isFinite(s.km) && s.km > 0);

  if (parsed.length === 0) return null;

  // Last time Sparki looked at each wear category (newest analysis per category).
  const checks = await db
    .select({
      category: materialAnalysesTable.category,
      createdAt: materialAnalysesTable.createdAt,
    })
    .from(materialAnalysesTable)
    .where(eq(materialAnalysesTable.clerkId, clerkId));

  const lastByCategory = new Map<string, Date>();
  for (const c of checks) {
    const when = c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt);
    const prev = lastByCategory.get(c.category);
    if (!prev || when > prev) lastByCategory.set(c.category, when);
  }

  let best: MaterialNudge | null = null;
  let bestRatio = 0;

  for (const rule of WEAR_RULES) {
    const lastCheck = lastByCategory.get(rule.category) ?? null;
    const lastCheckDay = lastCheck ? lastCheck.toISOString().slice(0, 10) : null;

    const distanceSince = parsed.reduce((sum, s) => {
      if (lastCheckDay && s.date < lastCheckDay) return sum;
      return sum + s.km;
    }, 0);

    if (distanceSince < rule.thresholdKm) continue;

    const ratio = distanceSince / rule.thresholdKm;
    if (ratio <= bestRatio) continue;

    const bucket = Math.floor(distanceSince / rule.thresholdKm);
    bestRatio = ratio;
    best = {
      category: rule.category,
      label: rule.label,
      title: buildTitle(rule),
      message: buildMessage(rule, distanceSince, lastCheck != null),
      distanceSinceKm: roundKm(distanceSince),
      thresholdKm: rule.thresholdKm,
      bucket,
      lastCheckedAt: lastCheck ? lastCheck.toISOString() : null,
      actionUrl: `/vandaag?materiaal=${rule.category}&n=${bucket}`,
    };
  }

  return best;
}

export type EnsuredMaterialNudge = {
  nudge: MaterialNudge;
  notificationId: number;
  dismissed: boolean;
};

// Evaluate the nudge and make sure a matching in-app notification exists so the
// suggestion surfaces globally (the bell), not just inside Materiaalcoach. The
// notification's actionUrl encodes category + wear bucket, so it is created at
// most once per (category, bucket): a dismissed nudge never re-creates for the
// same bucket, and a fresh one only appears after another full wear interval.
export async function ensureMaterialNudgeNotification(
  clerkId: string,
): Promise<EnsuredMaterialNudge | null> {
  const nudge = await evaluateMaterialNudge(clerkId);
  if (!nudge) return null;

  const [existing] = await db
    .select({
      id: notificationsTable.id,
      readAt: notificationsTable.readAt,
    })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.clerkId, clerkId),
        eq(notificationsTable.type, "system"),
        eq(notificationsTable.actionUrl, nudge.actionUrl),
      ),
    )
    .limit(1);

  if (existing) {
    return {
      nudge,
      notificationId: existing.id,
      dismissed: existing.readAt != null,
    };
  }

  const [created] = await db
    .insert(notificationsTable)
    .values({
      clerkId,
      type: "system",
      title: nudge.title,
      body: nudge.message,
      priority: "low",
      actionUrl: nudge.actionUrl,
    })
    .returning({ id: notificationsTable.id });

  return { nudge, notificationId: created!.id, dismissed: false };
}
