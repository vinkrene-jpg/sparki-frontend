import { createHash } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import {
  db,
  aiObservationsTable,
  aiMemoryEventsTable,
  aiPreferencesTable,
  aiObservationCategories,
  aiObservationSeverities,
  aiObservationConfidences,
  type AiObservation,
  type AiObservationSourceType,
  type AiObservationCategory,
  type AiObservationSeverity,
  type AiObservationConfidence,
  type AiMemoryEventType,
  type AiPreference,
  type ObservationSignal,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { getEffectivePrivacy } from "./privacy";
import { createNotification } from "./notifications";

const ACTIVE_STATUSES = ["new", "acknowledged", "saved"] as const;
const DISMISS_COOLDOWN_DAYS = 14;
const CONTEXT_WINDOW_DAYS = 30;

export type ObservationInput = {
  clerkId: string;
  sourceType: AiObservationSourceType;
  title: string;
  summary?: string | null;
  observationText: string;
  confidence?: AiObservationConfidence;
  category?: AiObservationCategory;
  severity?: AiObservationSeverity;
  detectedPattern?: string | null;
  supportingDataRefs?: unknown;
  signals?: ObservationSignal[] | null;
  alternativeExplanations?: string[] | null;
  confidenceScore?: number | null;
  recommendedAction?: string | null;
  expiresAt?: Date | null;
  dedupeKey?: string | null;
};

function computeDedupeKey(input: ObservationInput): string {
  const basis = `${input.category ?? "general"}|${
    input.detectedPattern?.trim() || input.title.trim()
  }`.toLowerCase();
  return createHash("sha256").update(basis).digest("hex").slice(0, 32);
}

// Record an AI memory event (lightweight audit of what the memory system did).
export async function recordMemoryEvent(
  clerkId: string,
  eventType: AiMemoryEventType,
  relatedObservationId?: number | null,
  metadata?: unknown,
): Promise<void> {
  await db.insert(aiMemoryEventsTable).values({
    clerkId,
    eventType,
    relatedObservationId: relatedObservationId ?? null,
    metadata: (metadata as object) ?? null,
  });
}

// Persist a structured observation with two safeguards:
//   1. Privacy gate — if ai_memory_enabled is off, only `system` source is stored.
//   2. Deduplication — skip if an identical (clerkId, dedupeKey) observation is
//      currently active, or was dismissed within the cooldown window (no nagging).
// Returns the stored row, the existing duplicate, or null when gated/skipped.
export async function persistObservation(
  input: ObservationInput,
): Promise<AiObservation | null> {
  const privacy = await getEffectivePrivacy(input.clerkId);
  if (!privacy.aiMemoryEnabled && input.sourceType !== "system") return null;

  const dedupeKey = input.dedupeKey ?? computeDedupeKey(input);

  const [existing] = await db
    .select()
    .from(aiObservationsTable)
    .where(
      and(
        eq(aiObservationsTable.clerkId, input.clerkId),
        eq(aiObservationsTable.dedupeKey, dedupeKey),
      ),
    )
    .orderBy(desc(aiObservationsTable.createdAt))
    .limit(1);

  if (existing) {
    const isActive = (ACTIVE_STATUSES as readonly string[]).includes(
      existing.status,
    );
    const dismissedRecently =
      existing.status === "dismissed" &&
      Date.now() - new Date(existing.createdAt).getTime() <
        DISMISS_COOLDOWN_DAYS * 86_400_000;
    if (isActive || dismissedRecently) return existing;
  }

  const [row] = await db
    .insert(aiObservationsTable)
    .values({
      clerkId: input.clerkId,
      sourceType: input.sourceType,
      title: input.title,
      summary: input.summary ?? null,
      observationText: input.observationText,
      confidence: input.confidence ?? "medium",
      category: input.category ?? "general",
      severity: input.severity ?? "info",
      detectedPattern: input.detectedPattern ?? null,
      supportingDataRefs: (input.supportingDataRefs as object) ?? null,
      signals: input.signals ?? null,
      alternativeExplanations: input.alternativeExplanations ?? null,
      confidenceScore:
        input.confidenceScore != null ? input.confidenceScore.toFixed(2) : null,
      recommendedAction: input.recommendedAction ?? null,
      dedupeKey,
      expiresAt: input.expiresAt ?? null,
    })
    .returning();

  if (row) {
    await recordMemoryEvent(input.clerkId, "observation_created", row.id, {
      sourceType: input.sourceType,
      category: row.category,
      severity: row.severity,
    });

    // Surface high-signal observations in the notification center.
    if (row.severity === "important" || row.severity === "urgent") {
      void createNotification({
        clerkId: row.clerkId,
        type: "ai_observation",
        title: row.title,
        body: row.summary ?? row.observationText,
        priority: row.severity === "urgent" ? "high" : "normal",
        actionUrl: "/lab",
        dedupeWithin: {
          type: "ai_observation",
          matchBody: row.summary ?? row.observationText,
        },
      });
    }
  }
  return row ?? null;
}

// Active (non-dismissed, non-expired) observations, newest first.
export async function getActiveObservations(
  clerkId: string,
): Promise<AiObservation[]> {
  return db
    .select()
    .from(aiObservationsTable)
    .where(
      and(
        eq(aiObservationsTable.clerkId, clerkId),
        inArray(aiObservationsTable.status, [...ACTIVE_STATUSES]),
        or(
          isNull(aiObservationsTable.expiresAt),
          gt(aiObservationsTable.expiresAt, sql`now()`),
        ),
      ),
    )
    .orderBy(desc(aiObservationsTable.createdAt));
}

// Observations relevant for injecting into a new AI prompt. Safeguards:
//  - only saved/acknowledged (things the user kept/saw) plus important+ new ones
//  - within CONTEXT_WINDOW_DAYS, not expired, capped — so old/dismissed
//    observations are never over-used.
export async function getContextObservations(
  clerkId: string,
  limit = 8,
): Promise<AiObservation[]> {
  const since = new Date(Date.now() - CONTEXT_WINDOW_DAYS * 86_400_000);
  const rows = await db
    .select()
    .from(aiObservationsTable)
    .where(
      and(
        eq(aiObservationsTable.clerkId, clerkId),
        inArray(aiObservationsTable.status, [...ACTIVE_STATUSES]),
        gt(aiObservationsTable.createdAt, since),
        or(
          isNull(aiObservationsTable.expiresAt),
          gt(aiObservationsTable.expiresAt, sql`now()`),
        ),
      ),
    )
    .orderBy(desc(aiObservationsTable.createdAt));

  const relevant = rows.filter(
    (r) =>
      r.status === "saved" ||
      r.status === "acknowledged" ||
      r.severity === "important" ||
      r.severity === "urgent",
  );
  return relevant.slice(0, limit);
}

export function formatObservationsForPrompt(obs: AiObservation[]): string {
  if (obs.length === 0) return "";
  const lines = obs.map((o) => {
    const date = new Date(o.createdAt).toISOString().split("T")[0];
    return `  - [${date}] (${o.category}/${o.severity}) ${o.title}: ${o.summary ?? o.observationText}`;
  });
  return `EARLIER SAVED OBSERVATIONS (use these for continuity; do not contradict or blindly repeat them):\n${lines.join("\n")}`;
}

// ── Preferences ──────────────────────────────────────────────────────────────
export async function getPreferences(
  clerkId: string,
): Promise<AiPreference | null> {
  const [row] = await db
    .select()
    .from(aiPreferencesTable)
    .where(eq(aiPreferencesTable.clerkId, clerkId));
  return row ?? null;
}

export function styleDirective(pref: AiPreference | null): string {
  if (!pref) return "";
  const tone: Record<string, string> = {
    direct: "Be blunt and to the point.",
    supportive: "Be encouraging and motivating while honest.",
    analytical: "Be data-first and analytical.",
    concise: "Be very concise.",
    detailed: "Give thorough, detailed reasoning.",
  };
  const level: Record<string, string> = {
    simple: "Explain in simple, non-technical language.",
    normal: "Use normal coaching language.",
    expert: "Assume expert-level knowledge; use technical terms freely.",
  };
  const intensity: Record<string, string> = {
    low: "Keep coaching pressure gentle.",
    normal: "Apply normal coaching pressure.",
    high: "Be demanding and push hard.",
  };
  return `COACHING STYLE: ${tone[pref.communicationStyle] ?? ""} ${level[pref.explanationLevel] ?? ""} ${intensity[pref.coachingIntensity] ?? ""}`.trim();
}

// ── LLM extraction ───────────────────────────────────────────────────────────
type ExtractedObservation = {
  title: string;
  summary: string;
  observationText: string;
  category: AiObservationCategory;
  severity: AiObservationSeverity;
  confidence: AiObservationConfidence;
  detectedPattern?: string;
  recommendedAction?: string;
};

const EXTRACT_SYSTEM = `You extract durable, structured coaching observations from an analysis. Return STRICT JSON only — no prose, no markdown fences. Output an array (possibly empty) of objects with keys: title (short), summary (one sentence), observationText (1-3 sentences), category, severity, confidence, detectedPattern (optional), recommendedAction (optional). Only include genuinely useful, specific, data-grounded observations worth remembering across days. If nothing is noteworthy, return []. Never invent numbers not present in the data.

ABSOLUTE OUTPUT RULES:
- Write EVERY human-readable field (title, summary, observationText, detectedPattern, recommendedAction) in plain Dutch. Never use English — not even single words or headings. Translate technical terms into plain Dutch that a youth rider, parent or coach understands (e.g. "belasting" not "load", "herstel" not "recovery", "gereedheid" not "readiness", "slaapkwaliteit" not "SleepQuality", "gevoel" not "Feel"). You may keep widely-used abbreviations: FTP, TSS, CTL, ATL, TSB, HRV, watt, bpm.
- The keys category, severity and confidence stay as the exact English enum codes (do NOT translate those values) — only the human-readable fields are Dutch.
- Never use the word "AI" in any field.
- Never use the word "Core" in any field — it is internal architecture; say "je vorm" or "hoe je ervoor staat" instead.
- Neutral voice: state the observation or advice directly. Do not narrate Sparki perceiving or thinking (no "Sparki ziet", "Sparki denkt", "Sparki merkt op").`;

function coerceEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

// Ask the model to distil structured observations from generated text. Returns a
// validated array; never throws on bad model output (returns [] instead).
export async function extractObservations(
  sourceText: string,
  contextText: string,
): Promise<ExtractedObservation[]> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: EXTRACT_SYSTEM,
      messages: [
        {
          role: "user",
          content: `ATHLETE DATA:\n${contextText}\n\nANALYSIS TO DISTILL:\n${sourceText}\n\nReturn the JSON array of observations now.`,
        },
      ],
    });
    const block = message.content[0];
    if (!block || block.type !== "text") return [];
    let text = block.text.trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) text = fenced[1]!.trim();
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (o): o is Record<string, unknown> =>
          !!o && typeof o === "object" && typeof (o as any).title === "string",
      )
      .slice(0, 5)
      .map((o) => ({
        title: String(o.title).slice(0, 160),
        summary: String(o.summary ?? "").slice(0, 280),
        observationText: String(o.observationText ?? o.summary ?? o.title),
        category: coerceEnum(
          o.category,
          aiObservationCategories,
          "general",
        ),
        severity: coerceEnum(o.severity, aiObservationSeverities, "info"),
        confidence: coerceEnum(
          o.confidence,
          aiObservationConfidences,
          "medium",
        ),
        detectedPattern:
          typeof o.detectedPattern === "string"
            ? o.detectedPattern
            : undefined,
        recommendedAction:
          typeof o.recommendedAction === "string"
            ? o.recommendedAction
            : undefined,
      }));
  } catch {
    return [];
  }
}
