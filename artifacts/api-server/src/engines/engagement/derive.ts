// Engagement derivation — reads the athlete's own real telemetry and returns a
// deterministic engagement profile. Read-only; never writes. The heavy lifting
// (and all the honesty guarantees) lives in the pure computeEngagement().

import { and, desc, eq, gte } from "drizzle-orm";
import { db, testerEventsTable } from "@workspace/db";
import { computeEngagement, type EngagementProfile, type TelemetryHit } from "./compute";

// How far back to learn from. A rolling window keeps the rhythm current without
// letting long-stale habits dominate.
const LOOKBACK_DAYS = 60;
const MAX_ROWS = 5000;

export async function deriveEngagement(
  clerkId: string,
  now: Date = new Date(),
): Promise<EngagementProfile> {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
  const rows = await db
    .select({
      type: testerEventsTable.type,
      screen: testerEventsTable.screen,
      feature: testerEventsTable.feature,
      sessionId: testerEventsTable.sessionId,
      createdAt: testerEventsTable.createdAt,
    })
    .from(testerEventsTable)
    .where(
      and(
        eq(testerEventsTable.clerkId, clerkId),
        gte(testerEventsTable.createdAt, since),
      ),
    )
    .orderBy(desc(testerEventsTable.createdAt))
    .limit(MAX_ROWS);

  const events: TelemetryHit[] = rows.map((r) => ({
    type: r.type,
    screen: r.screen,
    feature: r.feature,
    sessionId: r.sessionId,
    createdAt: r.createdAt,
  }));

  return computeEngagement(events, now);
}
