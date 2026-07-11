// "Wat is er nieuw?" — the honest source of truth for whether there is GENUINELY
// something new for an athlete since a given moment (their last app-open). Never
// fabricates: it only counts real, unexpired new insights the engine derived for
// this athlete, plus fresh news that actually arrived. When nothing is new it
// returns null, so the "er is iets nieuws voor je" nudge simply does not fire.

import { and, desc, eq, gt, isNull, ne, or } from "drizzle-orm";
import { db, aiObservationsTable, knowledgeItemsTable } from "@workspace/db";

export type WhatsNew = {
  count: number;
  observationCount: number;
  newsCount: number;
  // The single best thing to lead with — a personal insight when we have one
  // (more relevant than global news), otherwise the freshest news item.
  lead: { title: string; kind: "observation" | "news"; actionUrl: string };
};

export async function findWhatsNew(
  clerkId: string,
  since: Date,
  now: Date = new Date(),
): Promise<WhatsNew | null> {
  // Genuinely new personal insights: real derived observations created since the
  // last open, still "new" (unseen) and not expired. Daily briefings are the
  // recurring prose, not a discrete new insight, so they are excluded.
  const observations = await db
    .select({
      title: aiObservationsTable.title,
      createdAt: aiObservationsTable.createdAt,
    })
    .from(aiObservationsTable)
    .where(
      and(
        eq(aiObservationsTable.clerkId, clerkId),
        gt(aiObservationsTable.createdAt, since),
        eq(aiObservationsTable.status, "new"),
        ne(aiObservationsTable.sourceType, "daily_briefing"),
        or(
          isNull(aiObservationsTable.expiresAt),
          gt(aiObservationsTable.expiresAt, now),
        ),
      ),
    )
    .orderBy(desc(aiObservationsTable.createdAt))
    .limit(20);

  // Fresh news that actually arrived since the last open (global library).
  const news = await db
    .select({
      title: knowledgeItemsTable.title,
      fetchedAt: knowledgeItemsTable.fetchedAt,
    })
    .from(knowledgeItemsTable)
    .where(
      and(eq(knowledgeItemsTable.type, "news"), gt(knowledgeItemsTable.fetchedAt, since)),
    )
    .orderBy(desc(knowledgeItemsTable.fetchedAt))
    .limit(20);

  const observationCount = observations.length;
  const newsCount = news.length;
  const count = observationCount + newsCount;
  if (count === 0) return null;

  const lead =
    observationCount > 0
      ? { title: observations[0].title, kind: "observation" as const, actionUrl: "/" }
      : { title: news[0].title, kind: "news" as const, actionUrl: "/feed" };

  return { count, observationCount, newsCount, lead };
}
