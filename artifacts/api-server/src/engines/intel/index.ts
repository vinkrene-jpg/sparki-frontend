// Performance Intelligence Hub engine — the single facade routes import. Reads
// the athlete's real profile + interaction history, ranks the published intel
// cards for them (see ./personalize) and persists honest interaction signals.
// No fabricated content ever leaves this layer.

import { and, eq, desc, inArray } from "drizzle-orm";
import {
  db,
  intelCardsTable,
  intelInteractionsTable,
  athleteProfilesTable,
  type IntelCard,
  type IntelInteraction,
  type IntelTopic,
  type IntelCardKind,
  type MythAnswer,
} from "@workspace/db";
import {
  type IntelAthleteContext,
  type RankedCard,
  inferTopicInterests,
  normalizeDiscipline,
  normalizeLevel,
  disciplineLabel,
  levelLabel,
  rankCards,
} from "./personalize";

export type IntelInteractionState = {
  saved: boolean;
  readLater: boolean;
  interesting: boolean;
  mythAnswer: MythAnswer | null;
  mythCorrect: boolean | null;
};

export type IntelFeedItem = {
  card: IntelCard;
  reason: string;
  personalised: boolean;
  interaction: IntelInteractionState;
};

const EMPTY_STATE: IntelInteractionState = {
  saved: false,
  readLater: false,
  interesting: false,
  mythAnswer: null,
  mythCorrect: null,
};

function toState(row: IntelInteraction | undefined): IntelInteractionState {
  if (!row) return EMPTY_STATE;
  return {
    saved: row.saved,
    readLater: row.readLater,
    interesting: row.interesting,
    mythAnswer: (row.mythAnswer as MythAnswer | null) ?? null,
    mythCorrect: row.mythCorrect ?? null,
  };
}

// Build the deterministic personalisation context from real profile signals plus
// the topics the athlete actively engaged with (marked interesting / saved).
export async function buildIntelContext(
  clerkId: string,
): Promise<IntelAthleteContext> {
  const [profile] = await db
    .select({
      discipline: athleteProfilesTable.discipline,
      sport: athleteProfilesTable.sport,
      experienceLevel: athleteProfilesTable.experienceLevel,
      competitionLevel: athleteProfilesTable.competitionLevel,
      birthYear: athleteProfilesTable.birthYear,
      goals: athleteProfilesTable.goals,
      motivation: athleteProfilesTable.motivation,
      selfType: athleteProfilesTable.selfType,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId));

  // Topics from cards this athlete actively engaged with (real signal only).
  const engaged = await db
    .select({ topic: intelCardsTable.topic })
    .from(intelInteractionsTable)
    .innerJoin(
      intelCardsTable,
      eq(intelInteractionsTable.cardId, intelCardsTable.id),
    )
    .where(
      and(
        eq(intelInteractionsTable.clerkId, clerkId),
        eq(intelInteractionsTable.interesting, true),
      ),
    );
  const engagedTopics = Array.from(
    new Set(engaged.map((e) => e.topic as IntelTopic)),
  );

  const discipline = normalizeDiscipline(
    profile?.discipline ?? profile?.sport ?? null,
  );
  const level = normalizeLevel(profile?.experienceLevel ?? null);

  // Youth (<16) or true beginners get the simpler framing surfaced first.
  const now = new Date().getFullYear();
  const age = profile?.birthYear ? now - profile.birthYear : null;
  const simplify =
    (age != null && age < 16) || level === "beginner" || level === null;

  const topicInterests = inferTopicInterests({
    goals: profile?.goals ?? null,
    motivation: profile?.motivation ?? null,
    selfType: profile?.selfType ?? null,
    engagedTopics,
  });

  return {
    discipline,
    disciplineLabel: discipline ? disciplineLabel(discipline) : null,
    level,
    levelLabel: level ? levelLabel(level) : null,
    simplify,
    topicInterests,
  };
}

async function interactionMap(
  clerkId: string,
  cardIds: number[],
): Promise<Map<number, IntelInteraction>> {
  if (cardIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(intelInteractionsTable)
    .where(
      and(
        eq(intelInteractionsTable.clerkId, clerkId),
        inArray(intelInteractionsTable.cardId, cardIds),
      ),
    );
  return new Map(rows.map((r) => [r.cardId, r]));
}

export type FeedFilter = {
  kind?: IntelCardKind;
  topic?: IntelTopic;
  q?: string;
  // "saved" → only the athlete's saved cards; "all" (default) → ranked feed.
  scope?: "all" | "saved";
};

// The personalised "Voor jou" feed. Real cards, ranked deterministically, each
// carrying an honest reason and the athlete's interaction state.
export async function getFeed(
  clerkId: string,
  filter: FeedFilter = {},
): Promise<IntelFeedItem[]> {
  const conditions = [eq(intelCardsTable.status, "published")];
  if (filter.kind) conditions.push(eq(intelCardsTable.kind, filter.kind));
  if (filter.topic) conditions.push(eq(intelCardsTable.topic, filter.topic));

  const cards = await db
    .select()
    .from(intelCardsTable)
    .where(and(...conditions))
    .orderBy(desc(intelCardsTable.publishedAt));

  // Free-text search across title/summary (case-insensitive, honest substring).
  const q = filter.q?.trim().toLowerCase();
  const filtered = q
    ? cards.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.summary.toLowerCase().includes(q),
      )
    : cards;

  const interactions = await interactionMap(
    clerkId,
    filtered.map((c) => c.id),
  );

  // Saved scope: restrict to saved cards, keep recency order (no re-ranking).
  if (filter.scope === "saved") {
    return filtered
      .filter((c) => interactions.get(c.id)?.saved)
      .map((card) => ({
        card,
        reason: "Door jou opgeslagen",
        personalised: true,
        interaction: toState(interactions.get(card.id)),
      }));
  }

  const ctx = await buildIntelContext(clerkId);
  const engagedIds = new Set(
    Array.from(interactions.values())
      .filter((i) => i.interesting || i.mythAnswer != null)
      .map((i) => i.cardId),
  );
  const ranked: RankedCard[] = rankCards(filtered, ctx, engagedIds);

  return ranked.map((r) => ({
    card: r.card,
    reason: r.reason,
    personalised: r.personalised,
    interaction: toState(interactions.get(r.card.id)),
  }));
}

export async function getCard(
  clerkId: string,
  cardId: number,
): Promise<IntelFeedItem | null> {
  const [card] = await db
    .select()
    .from(intelCardsTable)
    .where(
      and(
        eq(intelCardsTable.id, cardId),
        eq(intelCardsTable.status, "published"),
      ),
    );
  if (!card) return null;

  const [row] = await db
    .select()
    .from(intelInteractionsTable)
    .where(
      and(
        eq(intelInteractionsTable.clerkId, clerkId),
        eq(intelInteractionsTable.cardId, cardId),
      ),
    );

  const ctx = await buildIntelContext(clerkId);
  const ranked = rankCards([card], ctx, new Set());
  return {
    card,
    reason: ranked[0]!.reason,
    personalised: ranked[0]!.personalised,
    interaction: toState(row),
  };
}

// Upsert one interaction flag for (athlete, card). Idempotent via the unique
// (clerk_id, card_id) constraint.
export async function setFlag(
  clerkId: string,
  cardId: number,
  field: "saved" | "readLater" | "interesting",
  value: boolean,
): Promise<IntelInteractionState | null> {
  // Guard: only allow flagging a real, published card. Without this a bogus id
  // hits the FK constraint and surfaces as a 500 instead of an honest 404.
  const [card] = await db
    .select({ id: intelCardsTable.id })
    .from(intelCardsTable)
    .where(
      and(
        eq(intelCardsTable.id, cardId),
        eq(intelCardsTable.status, "published"),
      ),
    );
  if (!card) return null;

  const column =
    field === "saved"
      ? "saved"
      : field === "readLater"
        ? "read_later"
        : "interesting";

  const [row] = await db
    .insert(intelInteractionsTable)
    .values({ clerkId, cardId, [field]: value })
    .onConflictDoUpdate({
      target: [intelInteractionsTable.clerkId, intelInteractionsTable.cardId],
      set: { [field]: value, updatedAt: new Date() },
    })
    .returning();
  void column;
  return toState(row);
}

// Record the athlete's Myth Buster answer. Correctness is judged against the
// card's real verdict; we never reveal it before an answer is given.
export async function recordMythAnswer(
  clerkId: string,
  cardId: number,
  answer: MythAnswer,
): Promise<{ correct: boolean; state: IntelInteractionState } | null> {
  const [card] = await db
    .select()
    .from(intelCardsTable)
    .where(
      and(
        eq(intelCardsTable.id, cardId),
        eq(intelCardsTable.kind, "myth_buster"),
        eq(intelCardsTable.status, "published"),
      ),
    );
  if (!card) return null;

  const content = card.content as { answer: MythAnswer };
  const correct = content.answer === answer;

  const [row] = await db
    .insert(intelInteractionsTable)
    .values({ clerkId, cardId, mythAnswer: answer, mythCorrect: correct })
    .onConflictDoUpdate({
      target: [intelInteractionsTable.clerkId, intelInteractionsTable.cardId],
      set: { mythAnswer: answer, mythCorrect: correct, updatedAt: new Date() },
    })
    .returning();

  return { correct, state: toState(row) };
}

export {
  inferTopicInterests,
  normalizeDiscipline,
  normalizeLevel,
  rankCards,
} from "./personalize";
export type { IntelAthleteContext, RankedCard } from "./personalize";
