// Personality Trust Score — how much character Sparki shows, derived purely from
// real interaction data. A brand-new athlete gets little humor and few assumptions;
// an athlete who has shared, answered and shown up earns more personality.
//
// computeScore / scoreToTier are pure (no DB) so they are exhaustively unit-tested.
// computeTrust reads the real signals from the database.

import { and, count, eq, or, inArray, isNull } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  onboardingStateTable,
  personalContextMemoriesTable,
  aiMemoryEventsTable,
  athleteDailyMetricsTable,
  friendLinksTable,
} from "@workspace/db";
import type { TrustProfile, TrustSignals, TrustTier } from "./types";

// Each signal is capped then weighted; weights sum to 1.0. Dismissals apply a
// small penalty (an athlete who keeps brushing Sparki off has earned less banter).
const WEIGHTS = {
  daysKnown: 0.2,
  onboarding: 0.1,
  memories: 0.15,
  answered: 0.2,
  positive: 0.15,
  metrics: 0.1,
  friends: 0.1,
} as const;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Pure: map real signals → a 0..1 trust score. */
export function computeScore(s: TrustSignals): number {
  const raw =
    clamp01(s.daysKnown / 30) * WEIGHTS.daysKnown +
    (s.onboardingComplete ? WEIGHTS.onboarding : 0) +
    clamp01(s.memoriesShared / 5) * WEIGHTS.memories +
    clamp01(s.followUpsAnswered / 5) * WEIGHTS.answered +
    clamp01(s.positiveEvents / 8) * WEIGHTS.positive +
    clamp01(s.metricsLogged / 10) * WEIGHTS.metrics +
    clamp01(s.friends / 3) * WEIGHTS.friends;
  const penalty = clamp01(s.followUpsDismissed / 10) * 0.1;
  return clamp01(raw - penalty);
}

/** Pure: map a 0..1 score → a trust tier. */
export function scoreToTier(score: number): TrustTier {
  if (score < 0.18) return "nieuw";
  if (score < 0.45) return "kennismaking";
  if (score < 0.72) return "vertrouwd";
  return "maat";
}

/** Read the real interaction signals for an athlete and compute their trust. */
export async function computeTrust(clerkId: string): Promise<TrustProfile> {
  const POSITIVE_EVENTS = [
    "user_acknowledged",
    "user_saved",
    "recommendation_followed",
  ];

  const [profile] = await db
    .select({ createdAt: userProfilesTable.createdAt })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));

  const [onboarding] = await db
    .select({ isComplete: onboardingStateTable.isComplete })
    .from(onboardingStateTable)
    .where(eq(onboardingStateTable.clerkId, clerkId));

  const [mem] = await db
    .select({ c: count() })
    .from(personalContextMemoriesTable)
    .where(
      and(
        eq(personalContextMemoriesTable.clerkId, clerkId),
        eq(personalContextMemoriesTable.enabled, true),
      ),
    );

  const [answered] = await db
    .select({ c: count() })
    .from(personalContextMemoriesTable)
    .where(
      and(
        eq(personalContextMemoriesTable.clerkId, clerkId),
        eq(personalContextMemoriesTable.status, "followed_up"),
      ),
    );

  const [dismissed] = await db
    .select({ c: count() })
    .from(personalContextMemoriesTable)
    .where(
      and(
        eq(personalContextMemoriesTable.clerkId, clerkId),
        eq(personalContextMemoriesTable.status, "dismissed"),
      ),
    );

  const [positive] = await db
    .select({ c: count() })
    .from(aiMemoryEventsTable)
    .where(
      and(
        eq(aiMemoryEventsTable.clerkId, clerkId),
        inArray(aiMemoryEventsTable.eventType, POSITIVE_EVENTS),
      ),
    );

  const [metrics] = await db
    .select({ c: count() })
    .from(athleteDailyMetricsTable)
    .where(eq(athleteDailyMetricsTable.clerkId, clerkId));

  const [friends] = await db
    .select({ c: count() })
    .from(friendLinksTable)
    .where(
      and(
        eq(friendLinksTable.status, "accepted"), isNull(friendLinksTable.endedAt),
        or(
          eq(friendLinksTable.requesterClerkId, clerkId),
          eq(friendLinksTable.addresseeClerkId, clerkId),
        ),
      ),
    );

  const daysKnown = profile?.createdAt
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(profile.createdAt).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : 0;

  const signals: TrustSignals = {
    daysKnown,
    onboardingComplete: Boolean(onboarding?.isComplete),
    memoriesShared: mem?.c ?? 0,
    followUpsAnswered: answered?.c ?? 0,
    followUpsDismissed: dismissed?.c ?? 0,
    positiveEvents: positive?.c ?? 0,
    metricsLogged: metrics?.c ?? 0,
    friends: friends?.c ?? 0,
  };

  const score = computeScore(signals);
  return { score, tier: scoreToTier(score), signals };
}
