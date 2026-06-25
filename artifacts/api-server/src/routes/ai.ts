import { Router } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  aiObservationsTable,
  aiObservationStatuses,
  aiPreferencesTable,
  aiCommunicationStyles,
  aiCoachingIntensities,
  aiExplanationLevels,
  plannedWorkoutsTable,
  type AiObservation,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  persistObservation,
  recordMemoryEvent,
  getActiveObservations,
  extractObservations,
  getPreferences,
} from "../engines/coaching";
import { runConnectionAnalysis } from "../engines/memory-graph";
import {
  todayStr,
  buildAthleteContext,
  systemPrompt,
  gatherKnowledge,
} from "../lib/athlete-context";

const router = Router();

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
          content: `Schrijf een dagelijkse coaching-update op basis van deze data:\n\n${context}${knowledgeSection}\n\nWeeg ALLE beschikbare signalen samen (belasting, vermogen, hartslag, HRV, rusthartslag, slaap, vermoeidheid/gevoel, voeding/hydratatie, leeftijd, ervaring, blessure-/gezondheidshistorie, wedstrijdkalender en eerdere observaties) — trek nooit een conclusie uit één getal. Beoordeel de gereedheid van vandaag, benoem de meest waarschijnlijke verklaring en geef de trainingsrichtlijn voor vandaag, met gekalibreerde zekerheid (waarschijnlijk/mogelijk/het lijkt erop). Als signalen elkaar tegenspreken, benoem die tegenstrijdigheid kort. Als twee verklaringen ongeveer even waarschijnlijk zijn of een beslissend gegeven ontbreekt, geef dan geen hard advies maar stel eerst 1 tot 3 korte gerichte vragen. Houd het kort: gewone lopende tekst, doorgaans 2 tot 4 zinnen, concreet met de echte getallen.${promptBlock ? " Waar een opgeslagen bron jouw advies echt ondersteunt, verwijs er dan naar met de titel." : ""}`,
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

// ── POST /api/ai/connections ─────────────────────────────────────────────────
// Run Sparki's deterministic cross-domain connection analysis: link training,
// sleep, recovery, races, feedback and prior observations into explainable
// insights (signals + confidence + alternatives). Privacy-gated via the memory
// store. Returns what was derived and what actually persisted.
router.post("/connections", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const result = await runConnectionAnalysis(clerkId);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "ai.connections failed");
    res.status(500).json({ error: "Verbanden zoeken mislukt." });
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
// Snelle eerste laag voor "Waarom?": alleen de korte kern (1–2 zinnen), zodat de
// uitleg vrijwel meteen verschijnt in plaats van ~20s op een spinner te hangen.
// De diepere onderbouwing komt pas op verzoek via /workout-explain-extended.
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

    const message = await anthropic.messages.create(
      {
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system,
        messages: [
          {
            role: "user",
            content: `Atleetcontext:\n${context}\n\n${workoutBlock}\n\nLeg in het NEDERLANDS in 1 tot 2 zinnen de KERN uit: waarom Sparki JUIST DEZE training vandaag zo plant. Direct leesbaar, geen jargon. Gebruik alleen echte data uit de context hierboven, verzin niets.\n\nAntwoord UITSLUITEND met geldige JSON (geen markdown, geen tekst eromheen): {"short": "..."}\n\nSchrijf platte tekst: GEEN markdown, geen kopjes, geen "#" of sterretjes/bold. Gebruik NOOIT het woord "AI" of "algoritme" — jij bent Sparki.`,
          },
        ],
      },
      // Fail fast instead of hanging the spinner: one attempt, hard ceiling.
      { timeout: 30000, maxRetries: 0 },
    );

    const block = message.content[0];
    if (!block || block.type !== "text") {
      res.status(500).json({ error: "Unexpected Sparki response" });
      return;
    }

    let parsed: { short?: unknown } | null = null;
    try {
      const raw = block.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      const json = start >= 0 && end >= 0 ? raw.slice(start, end + 1) : raw;
      parsed = JSON.parse(json) as { short?: unknown };
    } catch {
      parsed = null;
    }

    const short = typeof parsed?.short === "string" ? parsed.short.trim() : "";
    if (!short) {
      res.status(502).json({ error: "Sparki could not form an explanation" });
      return;
    }
    res.json({ short });
  } catch (err) {
    req.log.error({ err }, "ai.workout-explain failed");
    res.status(500).json({ error: "Sparki service unavailable" });
  }
});

// ── POST /api/ai/workout-explain-extended ────────────────────────────────────
// De diepere "Waarom?" trainingsfilosofie-laag voor één specifieke training,
// alleen geladen wanneer de atleet "Uitgebreid" opent (de zwaardere generatie).
// Real Sparki reasoning grounded in the workout's actual structure + the
// athlete's data. Dutch, geen "AI"-woordgebruik.
router.post("/workout-explain-extended", requireAuth, async (req, res) => {
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

    const message = await anthropic.messages.create(
      {
        model: "claude-sonnet-4-6",
        max_tokens: 1600,
        system,
        messages: [
          {
            role: "user",
            content: `Atleetcontext:\n${context}\n\n${workoutBlock}\n\nLeg in het NEDERLANDS uit waarom Sparki JUIST DEZE training zo plant. Geef twee niveaus: eerst de korte kern, daarna de uitgebreide onderbouwing met meer diepgang en de echte getallen. De uitgebreide versie geeft méér diepgang en data — niet zomaar méér tekst.\n\nAntwoord UITSLUITEND met geldige JSON (geen markdown, geen tekst eromheen) in dit schema:\n{\n  "short": "1 tot 2 zinnen, de kern: waarom deze training vandaag past. Direct leesbaar, geen jargon.",\n  "extended": "2 tot 4 korte alinea's met de trainingsfilosofie toegespitst op deze sessie — relevante principes uit trainingsopbouw, belasting & herstel, progressieve overload, nut van Z2, intensieve blokken, taper/herstelweek, periodisering, blessurepreventie en de relatie tot het hoofddoel. Verwijs naar de echte getallen (duur, TSS, zones, %FTP, week/fase). Platte tekst, alinea's gescheiden door een lege regel."\n}\n\nRegels: gebruik alleen echte data uit de context hierboven, verzin niets. Schrijf platte tekst in beide velden: GEEN markdown, geen kopjes, geen "#" of sterretjes/bold. Gebruik NOOIT het woord "AI" of "algoritme" — jij bent Sparki.`,
          },
        ],
      },
      // Fail fast instead of hanging the "Sparki denkt na…" spinner forever: a
      // single attempt (no retries) with a hard ceiling surfaces the honest
      // error UI instead of an indefinite spinner.
      { timeout: 60000, maxRetries: 0 },
    );

    const block = message.content[0];
    if (!block || block.type !== "text") {
      res.status(500).json({ error: "Unexpected Sparki response" });
      return;
    }

    // Parse the two-tier JSON robustly (strip any stray fencing).
    let parsed: { short?: unknown; extended?: unknown } | null = null;
    try {
      const raw = block.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      const json = start >= 0 && end >= 0 ? raw.slice(start, end + 1) : raw;
      parsed = JSON.parse(json) as { short?: unknown; extended?: unknown };
    } catch {
      parsed = null;
    }

    const extended =
      typeof parsed?.extended === "string" ? parsed.extended.trim() : "";

    if (!extended) {
      res.status(502).json({ error: "Sparki could not form an explanation" });
      return;
    }
    res.json({ extended });
  } catch (err) {
    req.log.error({ err }, "ai.workout-explain-extended failed");
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
