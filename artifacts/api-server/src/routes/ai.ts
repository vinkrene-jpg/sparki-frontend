import { Router } from "express";
import { and, eq, desc } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  trainingSessionsTable,
  plannedWorkoutsTable,
  athleteDailyMetricsTable,
  aiObservationsTable,
  aiPreferencesTable,
  aiObservationStatuses,
  aiCommunicationStyles,
  aiCoachingIntensities,
  aiExplanationLevels,
  type AiObservation,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  persistObservation,
  recordMemoryEvent,
  getActiveObservations,
  getContextObservations,
  formatObservationsForPrompt,
  extractObservations,
  getPreferences,
  styleDirective,
} from "../lib/ai-memory";

const router = Router();

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

async function buildAthleteContext(clerkId: string): Promise<string> {
  const today = todayStr();

  const [
    [user],
    [athlete],
    allWorkouts,
    recentSessions,
    recentMetrics,
    priorObservations,
  ] = await Promise.all([
    db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId)),
    db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId)),
    db
      .select()
      .from(plannedWorkoutsTable)
      .where(eq(plannedWorkoutsTable.clerkId, clerkId))
      .orderBy(desc(plannedWorkoutsTable.scheduledDate))
      .limit(14),
    db
      .select()
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.clerkId, clerkId))
      .orderBy(desc(trainingSessionsTable.sessionDate))
      .limit(7),
    db
      .select()
      .from(athleteDailyMetricsTable)
      .where(eq(athleteDailyMetricsTable.clerkId, clerkId))
      .orderBy(desc(athleteDailyMetricsTable.metricDate))
      .limit(14),
    getContextObservations(clerkId),
  ]);

  const todayPlan = allWorkouts.find((w) => w.scheduledDate === today) ?? null;
  const todayMetric = recentMetrics.find((m) => m.metricDate === today) ?? null;

  const parts: string[] = [];
  parts.push(`TODAY: ${today}`);
  parts.push(`ATHLETE: ${user?.displayName ?? "Unknown"}`);

  if (athlete) {
    const wkg =
      athlete.ftp && athlete.weightKg
        ? (athlete.ftp / Number(athlete.weightKg)).toFixed(2)
        : null;
    parts.push(
      `PROFILE: FTP=${athlete.ftp ?? "not set"}W${wkg ? `, ${wkg} W/kg` : ""}, Weight=${athlete.weightKg ?? "unknown"}kg, Discipline=${athlete.discipline ?? "road cycling"}`,
    );
    if (athlete.goals) parts.push(`SEASON GOALS: ${athlete.goals}`);
    if (athlete.weeklyHourTarget)
      parts.push(`TARGET WEEKLY HOURS: ${athlete.weeklyHourTarget}h`);
  }

  if (todayPlan) {
    parts.push(
      `TODAY'S PLANNED WORKOUT: ${todayPlan.title} (${todayPlan.type}, ${todayPlan.targetDurationMin ?? "?"}min, target TSS=${todayPlan.targetTSS ?? "?"}, status=${todayPlan.status})`,
    );
    if (todayPlan.description)
      parts.push(`WORKOUT DESCRIPTION: ${todayPlan.description}`);
  } else {
    parts.push(`TODAY'S PLANNED WORKOUT: None scheduled`);
  }

  if (todayMetric) {
    const fields = [
      todayMetric.hrv != null && `HRV=${todayMetric.hrv}ms`,
      todayMetric.restingHR != null && `RestingHR=${todayMetric.restingHR}bpm`,
      todayMetric.sleepHours != null && `Sleep=${todayMetric.sleepHours}h`,
      todayMetric.sleepQuality != null &&
        `SleepQuality=${todayMetric.sleepQuality}/5`,
      todayMetric.fatigueScore != null &&
        `Fatigue=${todayMetric.fatigueScore}/10`,
      todayMetric.feelScore != null && `Feel=${todayMetric.feelScore}/5`,
    ]
      .filter(Boolean)
      .join(", ");
    parts.push(`TODAY'S READINESS: ${fields}`);
  } else {
    parts.push(`TODAY'S READINESS: No check-in logged yet`);
  }

  if (recentSessions.length > 0) {
    parts.push(`RECENT SESSIONS:`);
    for (const s of recentSessions) {
      const d = [
        s.sessionDate,
        s.title ?? s.type,
        s.durationMin != null && `${s.durationMin}min`,
        s.normalizedPower != null && `NP=${s.normalizedPower}W`,
        s.tss != null && `TSS=${s.tss}`,
        s.feelScore != null && `Feel=${s.feelScore}/5`,
      ]
        .filter(Boolean)
        .join(", ");
      parts.push(`  - ${d}`);
    }
  } else {
    parts.push(`RECENT SESSIONS: No sessions logged yet`);
  }

  if (recentMetrics.length > 1) {
    const hrvTrend = recentMetrics
      .slice()
      .reverse()
      .map((m) => m.hrv ?? "-")
      .join(", ");
    parts.push(`HRV TREND (oldest→newest): ${hrvTrend}`);
  }

  const obsBlock = formatObservationsForPrompt(priorObservations);
  if (obsBlock) parts.push(obsBlock);

  return parts.join("\n");
}

const SPARKI_SYSTEM = `You are Sparki, an expert AI performance coach specializing in competitive cycling. You have deep knowledge of training science: periodization, power-based training, TSS/CTL/ATL/TSB, heart rate variability, recovery protocols, and race preparation. You give precise, data-driven coaching advice. Always reference the athlete's actual numbers when available. Be direct and concise — no fluff, no generic advice. Speak like a knowledgeable coach who respects the athlete's intelligence.`;

async function systemPrompt(clerkId: string): Promise<string> {
  const pref = await getPreferences(clerkId);
  const directive = styleDirective(pref);
  return directive ? `${SPARKI_SYSTEM}\n\n${directive}` : SPARKI_SYSTEM;
}

// ── POST /api/ai/brief ───────────────────────────────────────────────────────
router.post("/brief", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [context, system] = await Promise.all([
      buildAthleteContext(clerkId),
      systemPrompt(clerkId),
    ]);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system,
      messages: [
        {
          role: "user",
          content: `Generate a daily coaching brief based on this data:\n\n${context}\n\nProvide 2-3 sentences covering: readiness assessment and today's workout guidance. Be specific to the actual numbers. If no check-in or plan exists, note what data would improve your guidance.`,
        },
      ],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response" });
      return;
    }
    const brief = block.text;
    res.json({ brief });

    // Persist memory after responding (best-effort; never blocks the response).
    void (async () => {
      try {
        const today = todayStr();
        await persistObservation({
          clerkId,
          sourceType: "daily_briefing",
          title: `Dagelijkse briefing — ${today}`,
          summary: brief.slice(0, 280),
          observationText: brief,
          category: "general",
          severity: "info",
          confidence: "high",
          dedupeKey: `briefing:${today}`,
        });
        await recordMemoryEvent(clerkId, "briefing_generated", null, {
          date: today,
        });
        const extracted = await extractObservations(brief, context);
        for (const o of extracted) {
          await persistObservation({
            clerkId,
            sourceType: "training_analysis",
            title: o.title,
            summary: o.summary,
            observationText: o.observationText,
            category: o.category,
            severity: o.severity,
            confidence: o.confidence,
            detectedPattern: o.detectedPattern ?? null,
            recommendedAction: o.recommendedAction ?? null,
          });
        }
      } catch (err) {
        req.log.error({ err }, "ai.brief memory persistence failed");
      }
    })();
  } catch (err) {
    req.log.error({ err }, "ai.brief failed");
    res.status(500).json({ error: "AI service unavailable" });
  }
});

// ── POST /api/ai/ask ─────────────────────────────────────────────────────────
router.post("/ask", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { question } = req.body as { question?: string };

  if (!question?.trim()) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  try {
    const [context, system] = await Promise.all([
      buildAthleteContext(clerkId),
      systemPrompt(clerkId),
    ]);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system,
      messages: [
        {
          role: "user",
          content: `Athlete data:\n${context}\n\nQuestion: ${question.trim()}`,
        },
      ],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response" });
      return;
    }
    const answer = block.text;
    res.json({ answer });

    // Only persist genuinely important insights from Q&A — not every exchange.
    void (async () => {
      try {
        const extracted = await extractObservations(
          `Question: ${question.trim()}\n\nAnswer: ${answer}`,
          context,
        );
        for (const o of extracted) {
          if (o.severity !== "important" && o.severity !== "urgent") continue;
          await persistObservation({
            clerkId,
            sourceType: "ai_chat",
            title: o.title,
            summary: o.summary,
            observationText: o.observationText,
            category: o.category,
            severity: o.severity,
            confidence: o.confidence,
            detectedPattern: o.detectedPattern ?? null,
            recommendedAction: o.recommendedAction ?? null,
          });
        }
      } catch (err) {
        req.log.error({ err }, "ai.ask memory persistence failed");
      }
    })();
  } catch (err) {
    req.log.error({ err }, "ai.ask failed");
    res.status(500).json({ error: "AI service unavailable" });
  }
});

// ── GET /api/ai/observations ─────────────────────────────────────────────────
// Active observations grouped by category, each newest-first.
router.get("/observations", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const rows = await getActiveObservations(clerkId);
    const groups: Record<string, AiObservation[]> = {};
    for (const r of rows) (groups[r.category] ??= []).push(r);
    res.json({ observations: rows, groups });
  } catch (err) {
    req.log.error({ err }, "ai.observations failed");
    res.status(500).json({ error: "Failed to load observations" });
  }
});

// ── PATCH /api/ai/observations/:id ───────────────────────────────────────────
router.patch("/observations/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  const { status } = req.body as { status?: string };

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  if (
    !status ||
    !(aiObservationStatuses as readonly string[]).includes(status)
  ) {
    res.status(400).json({ error: "invalid status" });
    return;
  }

  try {
    const [updated] = await db
      .update(aiObservationsTable)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(aiObservationsTable.id, id),
          eq(aiObservationsTable.clerkId, clerkId),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "not found" });
      return;
    }

    const eventType =
      status === "saved"
        ? "user_saved"
        : status === "dismissed"
          ? "user_dismissed"
          : status === "acknowledged"
            ? "user_acknowledged"
            : null;
    if (eventType) await recordMemoryEvent(clerkId, eventType, id);

    res.json({ observation: updated });
  } catch (err) {
    req.log.error({ err }, "ai.observations.patch failed");
    res.status(500).json({ error: "Failed to update observation" });
  }
});

// ── GET /api/ai/preferences ──────────────────────────────────────────────────
router.get("/preferences", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const pref = await getPreferences(clerkId);
    res.json({
      preferences: pref ?? {
        clerkId,
        communicationStyle: "supportive",
        coachingIntensity: "normal",
        explanationLevel: "normal",
        sensitiveTopics: [],
        preferredUnits: "metric",
      },
    });
  } catch (err) {
    req.log.error({ err }, "ai.preferences.get failed");
    res.status(500).json({ error: "Failed to load preferences" });
  }
});

// ── PUT /api/ai/preferences ──────────────────────────────────────────────────
router.put("/preferences", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = req.body as Record<string, unknown>;

  const communicationStyle = body.communicationStyle;
  const coachingIntensity = body.coachingIntensity;
  const explanationLevel = body.explanationLevel;
  const valid =
    (communicationStyle === undefined ||
      (aiCommunicationStyles as readonly string[]).includes(
        String(communicationStyle),
      )) &&
    (coachingIntensity === undefined ||
      (aiCoachingIntensities as readonly string[]).includes(
        String(coachingIntensity),
      )) &&
    (explanationLevel === undefined ||
      (aiExplanationLevels as readonly string[]).includes(
        String(explanationLevel),
      ));
  if (!valid) {
    res.status(400).json({ error: "invalid preference value" });
    return;
  }

  const values = {
    clerkId,
    communicationStyle: communicationStyle
      ? String(communicationStyle)
      : "supportive",
    coachingIntensity: coachingIntensity
      ? String(coachingIntensity)
      : "normal",
    explanationLevel: explanationLevel ? String(explanationLevel) : "normal",
    sensitiveTopics: Array.isArray(body.sensitiveTopics)
      ? (body.sensitiveTopics as string[])
      : [],
    preferredUnits:
      typeof body.preferredUnits === "string" ? body.preferredUnits : "metric",
    updatedAt: new Date(),
  };

  try {
    const [row] = await db
      .insert(aiPreferencesTable)
      .values(values)
      .onConflictDoUpdate({
        target: aiPreferencesTable.clerkId,
        set: {
          communicationStyle: values.communicationStyle,
          coachingIntensity: values.coachingIntensity,
          explanationLevel: values.explanationLevel,
          sensitiveTopics: values.sensitiveTopics,
          preferredUnits: values.preferredUnits,
          updatedAt: values.updatedAt,
        },
      })
      .returning();
    res.json({ preferences: row });
  } catch (err) {
    req.log.error({ err }, "ai.preferences.put failed");
    res.status(500).json({ error: "Failed to save preferences" });
  }
});

export default router;
