import { and, desc, eq, lte, isNotNull } from "drizzle-orm";
import {
  db,
  personalContextMemoriesTable,
  type ContextVisibility,
  type PersonalContextMemory,
} from "@workspace/db";
import { getEffectivePrivacy } from "../../lib/privacy";
import { detectContextMoment, followUpPrompt } from "./detect";

export { detectContextMoment, followUpPrompt } from "./detect";
export type { DetectedContext } from "./detect";

// A due follow-up plus the exact prompt to show — direct question when fresh, or
// a gentle "Je zei laatst dat ..." recall when the athlete returns late.
export type DueFollowUp = PersonalContextMemory & { prompt: string };

export type CaptureResult = {
  detected: boolean;
  gated: boolean;
  memory: PersonalContextMemory | null;
};

/**
 * Detect a personal-context moment in the athlete's words and, when found and
 * permitted by privacy settings, persist it with a scheduled follow-up.
 * Privacy-gated identically to ai_observations: when ai_memory is disabled the
 * statement is recognised but nothing is stored (honest, no silent persistence).
 */
export async function captureContext(
  clerkId: string,
  statement: string,
  now: Date = new Date(),
): Promise<CaptureResult> {
  const detected = detectContextMoment(statement, now);
  if (!detected) return { detected: false, gated: false, memory: null };

  const privacy = await getEffectivePrivacy(clerkId);
  if (!privacy.aiMemoryEnabled) {
    return { detected: true, gated: true, memory: null };
  }

  const [row] = await db
    .insert(personalContextMemoriesTable)
    .values({
      clerkId,
      kind: detected.kind,
      statement,
      title: detected.title,
      detail: detected.detail,
      followUpQuestion: detected.followUpQuestion,
      followUpAt: detected.followUpAt,
      importance: detected.importance,
      emotionalTone: detected.emotionalTone,
      signals: detected.signals,
      status: "scheduled",
    })
    .returning();

  return { detected: true, gated: false, memory: row ?? null };
}

/** All of an athlete's context memories, newest first. Owner-scoped. */
export async function listContextMemories(
  clerkId: string,
): Promise<PersonalContextMemory[]> {
  return db
    .select()
    .from(personalContextMemoriesTable)
    .where(eq(personalContextMemoriesTable.clerkId, clerkId))
    .orderBy(desc(personalContextMemoriesTable.createdAt));
}

/**
 * Follow-ups that are due now: scheduled, enabled, with a follow-up time in the
 * past. This is the login check — surface these when the athlete next opens app.
 */
export async function getDueFollowUps(
  clerkId: string,
  now: Date = new Date(),
): Promise<DueFollowUp[]> {
  const rows = await db
    .select()
    .from(personalContextMemoriesTable)
    .where(
      and(
        eq(personalContextMemoriesTable.clerkId, clerkId),
        eq(personalContextMemoriesTable.status, "scheduled"),
        eq(personalContextMemoriesTable.enabled, true),
        isNotNull(personalContextMemoriesTable.followUpAt),
        lte(personalContextMemoriesTable.followUpAt, now),
      ),
    )
    .orderBy(personalContextMemoriesTable.followUpAt);

  // Compute the phrasing per row: fresh → direct question; long overdue (athlete
  // returned late) → gentle "Je zei laatst dat ..." recall.
  return rows.map((r) => ({ ...r, prompt: followUpPrompt(r, now) }));
}

/** Record the athlete's answer and mark the follow-up complete. Owner-scoped. */
export async function answerFollowUp(
  clerkId: string,
  id: number,
  response: string,
): Promise<PersonalContextMemory | null> {
  const [row] = await db
    .update(personalContextMemoriesTable)
    .set({
      status: "followed_up",
      followUpDone: true,
      response,
      followedUpAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(personalContextMemoriesTable.id, id),
        eq(personalContextMemoriesTable.clerkId, clerkId),
        // Only an open follow-up can be answered — prevents re-answering an
        // already completed or dismissed item from a stale client.
        eq(personalContextMemoriesTable.status, "scheduled"),
      ),
    )
    .returning();
  return row ?? null;
}

/** Skip a follow-up without answering. Owner-scoped. */
export async function dismissFollowUp(
  clerkId: string,
  id: number,
): Promise<PersonalContextMemory | null> {
  const [row] = await db
    .update(personalContextMemoriesTable)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(
      and(
        eq(personalContextMemoriesTable.id, id),
        eq(personalContextMemoriesTable.clerkId, clerkId),
        eq(personalContextMemoriesTable.status, "scheduled"),
      ),
    )
    .returning();
  return row ?? null;
}

/** Enable/disable a memory (athlete control). Owner-scoped. */
export async function setContextEnabled(
  clerkId: string,
  id: number,
  enabled: boolean,
): Promise<PersonalContextMemory | null> {
  const [row] = await db
    .update(personalContextMemoriesTable)
    .set({ enabled, updatedAt: new Date() })
    .where(
      and(
        eq(personalContextMemoriesTable.id, id),
        eq(personalContextMemoriesTable.clerkId, clerkId),
      ),
    )
    .returning();
  return row ?? null;
}

/** Set sharing scope (private|shared) — athlete control. Owner-scoped. */
export async function setContextVisibility(
  clerkId: string,
  id: number,
  visibility: ContextVisibility,
): Promise<PersonalContextMemory | null> {
  const [row] = await db
    .update(personalContextMemoriesTable)
    .set({ visibility, updatedAt: new Date() })
    .where(
      and(
        eq(personalContextMemoriesTable.id, id),
        eq(personalContextMemoriesTable.clerkId, clerkId),
      ),
    )
    .returning();
  return row ?? null;
}

/** Permanently delete a memory. Owner-scoped. Returns true when a row was removed. */
export async function deleteContextMemory(
  clerkId: string,
  id: number,
): Promise<boolean> {
  const rows = await db
    .delete(personalContextMemoriesTable)
    .where(
      and(
        eq(personalContextMemoriesTable.id, id),
        eq(personalContextMemoriesTable.clerkId, clerkId),
      ),
    )
    .returning({ id: personalContextMemoriesTable.id });
  return rows.length > 0;
}

// Safe, non-raw projection for coach/parent viewers. The athlete's raw words
// (`statement`) and their personal answer (`response`) are NEVER exposed to a
// viewer — only Sparki's neutral title/detail and the timing. Callers MUST gate
// access by an accepted link + sharing level before calling this.
export type SharedContextMemory = {
  id: number;
  kind: string;
  title: string;
  detail: string | null;
  status: string;
  followUpAt: string | null;
  createdAt: string;
};

export async function getAthleteContextForViewer(
  athleteClerkId: string,
  limit = 20,
): Promise<SharedContextMemory[]> {
  const rows = await db
    .select({
      id: personalContextMemoriesTable.id,
      kind: personalContextMemoriesTable.kind,
      title: personalContextMemoriesTable.title,
      detail: personalContextMemoriesTable.detail,
      status: personalContextMemoriesTable.status,
      followUpAt: personalContextMemoriesTable.followUpAt,
      createdAt: personalContextMemoriesTable.createdAt,
    })
    .from(personalContextMemoriesTable)
    .where(
      and(
        eq(personalContextMemoriesTable.clerkId, athleteClerkId),
        eq(personalContextMemoriesTable.enabled, true),
        // Per-item athlete control: only items the athlete explicitly marked as
        // shared are eligible — on top of the global sharing-level gate enforced
        // by the caller. Private items NEVER reach a coach/parent.
        eq(personalContextMemoriesTable.visibility, "shared"),
      ),
    )
    .orderBy(desc(personalContextMemoriesTable.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    detail: r.detail,
    status: r.status,
    followUpAt: r.followUpAt ? r.followUpAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}
