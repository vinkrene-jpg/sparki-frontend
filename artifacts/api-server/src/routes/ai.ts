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
} from "../engines/coaching";
import { resolveFlags } from "../lib/flags";
import {
  getRelevantKnowledge,
  formatKnowledgeForPrompt,
  type KnowledgeSource,
} from "../engines/knowledge";

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

const SPARKI_SYSTEM = `You are Sparki, an expert performance coach specializing in competitive cycling. You have deep knowledge of training science: periodization, power-based training, TSS/CTL/ATL/TSB, heart rate variability, recovery protocols, and race preparation. You give precise, data-driven coaching advice. Always reference the athlete's actual numbers when available. Be direct and concise — no fluff, no generic advice. Speak like a knowledgeable coach who respects the athlete's intelligence.`;

async function systemPrompt(clerkId: string): Promise<string> {
  const pref = await getPreferences(clerkId);
  const directive = styleDirective(pref);
  return directive ? `${SPARKI_SYSTEM}\n\n${directive}` : SPARKI_SYSTEM;
}

// Retrieval-augmented coaching: when the knowledge_base flag is enabled for the
// user, pull the most relevant REAL stored literature/news and return both a
// prompt block (for the model to cite) and the structured sources (for the
// client to render clickable links). Returns empty when the flag is off or the
// library has nothing relevant — coaching then proceeds without citations.
async function gatherKnowledge(
  clerkId: string,
  keywordText: string,
): Promise<{ promptBlock: string; sources: KnowledgeSource[] }> {
  try {
    const [profile] = await db
      .select({ activeRole: userProfilesTable.activeRole })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));
    const activeRole = String(profile?.activeRole ?? "athlete");
    const flags = await resolveFlags(clerkId, activeRole);
    if (!flags.knowledge_base) return { promptBlock: "", sources: [] };

    const keywords = keywordText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4)
      .slice(0, 40);
    const sources = await getRelevantKnowledge({ keywords, limit: 4 });
    if (!sources.length) return { promptBlock: "", sources: [] };

    const block = `RELEVANTE WETENSCHAP & NIEUWS UIT DE SPARKI-KENNISBANK (alleen ECHT opgeslagen bronnen):
${formatKnowledgeForPrompt(sources)}

CITEERREGELS (strikt):
- Verwijs alleen naar bovenstaande bronnen wanneer ze de athlete-data daadwerkelijk ondersteunen. Citeer met de titel (of auteur) van de bron.
- Verzin NOOIT een artikel, auteur, tijdschrift, bevinding of link. Gebruik uitsluitend de bronnen hierboven.
- Als geen bron relevant is, citeer dan niets.`;
    return { promptBlock: block, sources };
  } catch (err) {
    // Knowledge augmentation is best-effort; never block coaching on it.
    return { promptBlock: "", sources: [] };
  }
}

// ── POST /api/ai/brief ───────────────────────────────────────────────────────
router.post("/brief", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [context, system] = await Promise.all([
      buildAthleteContext(clerkId),
      systemPrompt(clerkId),
    ]);
    const { promptBlock, sources } = await gatherKnowledge(clerkId, context);
    const knowledgeSection = promptBlock ? `\n\n${promptBlock}` : "";

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system,
      messages: [
        {
          role: "user",
          content: `Generate a daily coaching brief based on this data:\n\n${context}${knowledgeSection}\n\nProvide 2-3 sentences covering: readiness assessment and today's workout guidance. Be specific to the actual numbers. If no check-in or plan exists, note what data would improve your guidance.${promptBlock ? " Where a stored source genuinely supports your advice, cite it by name." : ""}`,
        },
      ],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      res.status(500).json({ error: "Unexpected Sparki response" });
      return;
    }
    const brief = block.text;
    res.json({ brief, sources });

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
    res.status(500).json({ error: "Sparki service unavailable" });
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
    const { promptBlock, sources } = await gatherKnowledge(
      clerkId,
      `${question.trim()} ${context}`,
    );
    const knowledgeSection = promptBlock ? `\n\n${promptBlock}` : "";

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system,
      messages: [
        {
          role: "user",
          content: `Athlete data:\n${context}${knowledgeSection}\n\nQuestion: ${question.trim()}`,
        },
      ],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      res.status(500).json({ error: "Unexpected Sparki response" });
      return;
    }
    const answer = block.text;
    res.json({ answer, sources });

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
    res.status(500).json({ error: "Sparki service unavailable" });
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

// ── Workout coaching helpers ─────────────────────────────────────────────────
// Load a workout (ownership-checked) and render its real structure into a
// compact text block the model can reason over. No invented data — only what the
// generator stored.
async function loadOwnedWorkout(clerkId: string, id: number) {
  const [workout] = await db
    .select()
    .from(plannedWorkoutsTable)
    .where(
      and(
        eq(plannedWorkoutsTable.id, id),
        eq(plannedWorkoutsTable.clerkId, clerkId),
      ),
    );
  return workout ?? null;
}

function describeWorkout(workout: {
  scheduledDate: string;
  type: string;
  title: string;
  targetDurationMin: number | null;
  targetTSS: number | null;
  status: string;
  structure: unknown;
}): string {
  const s = (workout.structure ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  parts.push(
    `GEPLANDE TRAINING: ${workout.title} op ${workout.scheduledDate} (${workout.type}, ${workout.targetDurationMin ?? "?"}min, doel-TSS ${workout.targetTSS ?? "?"}, status ${workout.status})`,
  );
  if (typeof s.intensity === "string") parts.push(`INTENSITEIT: ${s.intensity}`);
  if (typeof s.phase === "string" && typeof s.week === "number")
    parts.push(`PERIODISERING: fase ${s.phase}, week ${s.week} van het blok`);
  const blocks = Array.isArray(s.blocks)
    ? (s.blocks as Array<Record<string, unknown>>)
    : [];
  if (blocks.length) {
    parts.push("BLOKKEN:");
    for (const b of blocks) {
      parts.push(
        `  - ${String(b.label)}: ${Number(b.durationMin)}min, zone Z${Number(b.zone)}${b.targetPctFtp != null ? `, ~${Number(b.targetPctFtp)}% FTP` : ""}`,
      );
    }
  }
  const rationale = (s.rationale ?? {}) as Record<string, unknown>;
  if (typeof rationale.whyToday === "string")
    parts.push(`BEDOELING: ${rationale.whyToday}`);
  return parts.join("\n");
}

const FEEDBACK_LABEL: Record<string, string> = {
  done: "heeft de training afgerond",
  missed: "heeft de training gemist",
  too_hard: "vond de training te zwaar",
  too_light: "vond de training te licht",
  pain: "meldt pijn of een blessuregevoel",
  tired: "voelt zich vermoeid / niet hersteld",
  move: "wil de training verplaatsen naar een andere dag",
};

// ── POST /api/ai/workout-explain ─────────────────────────────────────────────
// The deeper "Waarom?" trainingsfilosofie-laag voor één specifieke training.
// Real Sparki reasoning grounded in the workout's actual structure + the
// athlete's data. Dutch, geen "AI"-woordgebruik.
router.post("/workout-explain", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { workoutId } = req.body as { workoutId?: number };
  const id = Number(workoutId);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "workoutId is required" });
    return;
  }

  try {
    const workout = await loadOwnedWorkout(clerkId, id);
    if (!workout) {
      res.status(404).json({ error: "Workout not found" });
      return;
    }

    const [context, system] = await Promise.all([
      buildAthleteContext(clerkId),
      systemPrompt(clerkId),
    ]);
    const workoutBlock = describeWorkout(workout);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1400,
      system,
      messages: [
        {
          role: "user",
          content: `Atleetcontext:\n${context}\n\n${workoutBlock}\n\nLeg in het NEDERLANDS de trainingsfilosofie achter JUIST DEZE training uit, zodat de atleet begrijpt waarom Sparki dit zo plant. Behandel — toegespitst op deze sessie, niet algemeen — de relevante principes uit: trainingsopbouw, belasting & herstel, progressieve overload, het nut van Z2, intensieve blokken, taper/herstelweek, periodisering, blessurepreventie, en de relatie tot het hoofddoel van de atleet.\n\nSchrijf 3–5 korte alinea's, coachend en concreet, met verwijzing naar de echte getallen waar zinvol. Schrijf platte tekst: GEEN markdown, geen kopjes, geen "#" of sterretjes/bold — alleen gewone alinea's gescheiden door een lege regel. Gebruik NOOIT het woord "AI" of "algoritme" — jij bent Sparki. Geen verzonnen data.`,
        },
      ],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      res.status(500).json({ error: "Unexpected Sparki response" });
      return;
    }
    res.json({ explanation: block.text });
  } catch (err) {
    req.log.error({ err }, "ai.workout-explain failed");
    res.status(500).json({ error: "Sparki service unavailable" });
  }
});

// ── POST /api/ai/workout-adjust ──────────────────────────────────────────────
// Athlete feedback → een concreet Sparki-aanpassingsvoorstel. Real LLM met
// strikte JSON-output, zodat de client het voorstel kan tonen én toepassen.
type AdjustProposal = {
  recommendation: "keep" | "adjust" | "move" | "recovery" | "replan_week";
  title: string;
  message: string;
  changes: {
    targetDurationMin?: number;
    targetTSS?: number;
    intensity?: string;
    newDate?: string;
    title?: string;
  } | null;
};

router.post("/workout-adjust", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { workoutId, feedbackType, note } = req.body as {
    workoutId?: number;
    feedbackType?: string;
    note?: string;
  };
  const id = Number(workoutId);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "workoutId is required" });
    return;
  }
  if (!feedbackType || !FEEDBACK_LABEL[feedbackType]) {
    res.status(400).json({ error: "valid feedbackType is required" });
    return;
  }

  try {
    const workout = await loadOwnedWorkout(clerkId, id);
    if (!workout) {
      res.status(404).json({ error: "Workout not found" });
      return;
    }

    const [context, system] = await Promise.all([
      buildAthleteContext(clerkId),
      systemPrompt(clerkId),
    ]);
    const workoutBlock = describeWorkout(workout);
    const today = todayStr();

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system,
      messages: [
        {
          role: "user",
          content: `Atleetcontext:\n${context}\n\n${workoutBlock}\n\nDE ATLEET ${FEEDBACK_LABEL[feedbackType].toUpperCase()}${note?.trim() ? ` — eigen toelichting: "${note.trim()}"` : ""}.\n\nBepaal als Sparki het beste antwoord en geef een concreet voorstel. Vandaag is ${today}. Antwoord UITSLUITEND met geldige JSON (geen markdown, geen tekst eromheen) in dit schema:\n{\n  "recommendation": "keep" | "adjust" | "move" | "recovery" | "replan_week",\n  "title": "korte kop (max 6 woorden, Nederlands)",\n  "message": "2-4 zinnen uitleg in het Nederlands, coachend en concreet, verwijzend naar de echte data",\n  "changes": null | {\n    "targetDurationMin"?: number,\n    "targetTSS"?: number,\n    "intensity"?: "string",\n    "newDate"?: "YYYY-MM-DD",\n    "title"?: "string"\n  }\n}\n\nRegels: bij "keep" is changes null. Bij "move" zet je newDate (een logische datum vanaf vandaag). Bij "adjust"/"recovery" geef je realistische nieuwe targetDurationMin/targetTSS/intensity. Bij pijn/blessure kies je herstel of verplaatsen, nooit zwaarder. Gebruik NOOIT het woord "AI" — jij bent Sparki.`,
        },
      ],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      res.status(500).json({ error: "Unexpected Sparki response" });
      return;
    }

    // Parse the JSON robustly (strip any stray fencing).
    let proposal: AdjustProposal | null = null;
    try {
      const raw = block.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      const json = start >= 0 && end >= 0 ? raw.slice(start, end + 1) : raw;
      proposal = JSON.parse(json) as AdjustProposal;
    } catch {
      proposal = null;
    }

    const valid =
      proposal &&
      ["keep", "adjust", "move", "recovery", "replan_week"].includes(
        proposal.recommendation,
      ) &&
      typeof proposal.title === "string" &&
      typeof proposal.message === "string";

    if (!valid) {
      res.status(502).json({ error: "Sparki could not form a proposal" });
      return;
    }

    res.json({ proposal });
  } catch (err) {
    req.log.error({ err }, "ai.workout-adjust failed");
    res.status(500).json({ error: "Sparki service unavailable" });
  }
});

export default router;
