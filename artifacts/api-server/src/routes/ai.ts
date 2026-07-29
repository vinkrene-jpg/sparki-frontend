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
  humorLevels,
  plannedWorkoutsTable,
  coachChangeProposalsTable,
  type AiObservation,
} from "@workspace/db";
import { aiMessage, AiBlockedError } from "../lib/ai/gateway";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { requireCommercialFeature } from "../lib/entitlements";
import { killSwitchGuard } from "../lib/kill-switches";
import { decideAdjustment } from "../lib/adjust-rules";
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
import { sessionSeed, rotateWithinGroups } from "../lib/variation";
import {
  getActiveKnowledge,
  knowledgeSourceBlock,
  buildSourceCitations,
  recordKnowledgeUsage,
} from "../lib/knowledge/governance";

const router = Router();

// ── POST /api/ai/brief ───────────────────────────────────────────────────────
router.post("/brief", requireAuth, requireCommercialFeature("ai_observations"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [context, system] = await Promise.all([
      buildAthleteContext(clerkId, "brief"),
      systemPrompt(clerkId),
    ]);
    const [{ promptBlock, sources }, managedItems] = await Promise.all([
      gatherKnowledge(clerkId, context),
      getActiveKnowledge({ domain: ["training", "herstel"], limit: 4 }),
    ]);
    const managedBlock = knowledgeSourceBlock(managedItems);
    const knowledgeSection = [promptBlock, managedBlock]
      .filter(Boolean)
      .map((b) => `\n\n${b}`)
      .join("");

    const message = await aiMessage("brief", clerkId, {
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system,
      messages: [
        {
          role: "user",
          content: `Schrijf een dagelijkse coaching-update op basis van deze data:\n\n${context}${knowledgeSection}\n\nWeeg ALLE beschikbare signalen samen (belasting, vermogen, hartslag, HRV, rusthartslag, slaap, vermoeidheid/gevoel, voeding/hydratatie, leeftijd, ervaring, blessure-/gezondheidshistorie, wedstrijdkalender en eerdere observaties) — trek nooit een conclusie uit één getal. Beoordeel de gereedheid van vandaag, benoem de meest waarschijnlijke verklaring en geef de trainingsrichtlijn voor vandaag, met gekalibreerde zekerheid (waarschijnlijk/mogelijk/het lijkt erop). Als signalen elkaar tegenspreken, benoem die tegenstrijdigheid kort. Als twee verklaringen ongeveer even waarschijnlijk zijn of een beslissend gegeven ontbreekt, geef dan geen hard advies maar stel eerst 1 tot 3 korte gerichte vragen. Houd het kort en scanbaar: verdeel het in 2 tot 3 korte alinea's met een witregel ertussen (bijvoorbeeld hoe je ervoor staat, de meest waarschijnlijke verklaring, en wat dat voor vandaag betekent), samen doorgaans 3 tot 5 zinnen, concreet met de echte getallen. Gewone zinnen met witregels tussen de alinea's — geen koppen, opsommingen, opmaak of emoji.${promptBlock ? " Waar een opgeslagen bron jouw advies echt ondersteunt, verwijs er dan naar met de titel." : ""}`,
        },
      ],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      res.status(500).json({ error: "Unexpected Sparki response" });
      return;
    }
    const brief = block.text;
    res.json({
      brief,
      sources,
      bronnen: buildSourceCitations(managedItems),
    });
    // Herleidbaarheid: pin de gebruikte kennisversies (best-effort).
    void recordKnowledgeUsage(managedItems, "vandaag", clerkId).catch((err) =>
      req.log.error({ err }, "ai.brief knowledge usage record failed"),
    );

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
        const extracted = await extractObservations(clerkId, brief, context);
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
    // Bewuste blokkade (privacy-instelling, minderjarig, killswitch) is geen
    // serverfout — geef de eerlijke reden terug in plaats van een 500.
    if (err instanceof AiBlockedError) {
      res.status(403).json({ error: err.message, reason: err.reason });
      return;
    }
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
      buildAthleteContext(clerkId, "ask"),
      systemPrompt(clerkId),
    ]);
    const { promptBlock, sources } = await gatherKnowledge(
      clerkId,
      `${question.trim()} ${context}`,
    );
    const knowledgeSection = promptBlock ? `\n\n${promptBlock}` : "";

    const message = await aiMessage("ask", clerkId, {
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
          clerkId,
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
    if (err instanceof AiBlockedError) {
      res.status(403).json({ error: err.message, reason: err.reason });
      return;
    }
    req.log.error({ err }, "ai.ask failed");
    res.status(500).json({ error: "Sparki service unavailable" });
  }
});

// ── GET /api/ai/observations ─────────────────────────────────────────────────
// Active observations grouped by category, each newest-first.
router.get("/observations", requireAuth, requireCommercialFeature("ai_observations"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    // Rotate real observations within their severity tier by the per-app-open
    // session seed so a different real insight leads each visit (urgent always
    // first). Pure presentation — the rows and their data are unchanged.
    const rows = rotateWithinGroups(
      await getActiveObservations(clerkId),
      (r) => r.severity,
      ["urgent", "important", "info"],
      sessionSeed(req),
    );
    const groups: Record<string, AiObservation[]> = {};
    for (const r of rows) (groups[r.category] ??= []).push(r);
    res.json({ observations: rows, groups });
  } catch (err) {
    req.log.error({ err }, "ai.observations failed");
    res.status(500).json({ error: "Failed to load observations" });
  }
});

// ── GET /api/ai/sources ──────────────────────────────────────────────────────
// The central source-quality register ("bronnenregister"): per databron the
// origin, last measurement, completeness, reliability, sensor status and
// validity. Read-only; the same register every analysis uses.
router.get("/sources", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const { getSourceQuality } = await import("../engines/source-quality");
    const sources = await getSourceQuality(clerkId);
    res.json({ sources });
  } catch (err) {
    req.log.error({ err }, "ai.sources failed");
    res.status(500).json({ error: "Failed to assess data sources" });
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

// ── GET /api/ai/connections/readiness ────────────────────────────────────────
// Eerlijk stappenplan: welke data is er al en wat is er minimaal nodig voordat
// de verbanden-analyse iets kán opleveren. Telt echte rijen, belooft niets.
router.get("/connections/readiness", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const { connectionReadiness } = await import(
      "../engines/memory-graph/readiness"
    );
    const readiness = await connectionReadiness(clerkId);
    res.json(readiness);
  } catch (err) {
    req.log.error({ err }, "ai.connections.readiness failed");
    res.status(500).json({ error: "Kon de datastatus niet bepalen." });
  }
});

// ── PATCH /api/ai/observations/:id ───────────────────────────────────────────
router.patch("/observations/:id", requireAuth, requireCommercialFeature("ai_observations"), async (req, res) => {
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
        humorLevel: "normaal",
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
  const humorLevel = body.humorLevel;
  const valid =
    (humorLevel === undefined ||
      (humorLevels as readonly string[]).includes(String(humorLevel))) &&
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
    humorLevel: humorLevel ? String(humorLevel) : "normaal",
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
          humorLevel: values.humorLevel,
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
      buildAthleteContext(clerkId, "workout_explain"),
      systemPrompt(clerkId),
    ]);
    const workoutBlock = describeWorkout(workout);

    // Timeout (30s) en 0 retries staan nu centraal in het doelenregister van
    // de gateway ("workout_explain") — fail fast blijft gedrag.
    const message = await aiMessage("workout_explain", clerkId, {
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system,
        messages: [
          {
            role: "user",
            content: `Atleetcontext:\n${context}\n\n${workoutBlock}\n\nLeg in het NEDERLANDS in 1 tot 2 zinnen de KERN uit: waarom Sparki JUIST DEZE training vandaag zo plant. Direct leesbaar, geen jargon. Gebruik alleen echte data uit de context hierboven, verzin niets.\n\nAntwoord UITSLUITEND met geldige JSON (geen markdown, geen tekst eromheen): {"short": "..."}\n\nSchrijf platte tekst: GEEN markdown, geen kopjes, geen "#" of sterretjes/bold. Gebruik NOOIT het woord "AI" of "algoritme" — jij bent Sparki.`,
          },
        ],
      });

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
    if (err instanceof AiBlockedError) {
      res.status(403).json({ error: err.message, reason: err.reason });
      return;
    }
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
      buildAthleteContext(clerkId, "workout_explain_extended"),
      systemPrompt(clerkId),
    ]);
    const workoutBlock = describeWorkout(workout);

    // Timeout (60s) en 0 retries staan centraal in het doelenregister.
    const message = await aiMessage("workout_explain_extended", clerkId, {
        model: "claude-sonnet-4-6",
        max_tokens: 1600,
        system,
        messages: [
          {
            role: "user",
            content: `Atleetcontext:\n${context}\n\n${workoutBlock}\n\nLeg in het NEDERLANDS uit waarom Sparki JUIST DEZE training zo plant. Geef twee niveaus: eerst de korte kern, daarna de uitgebreide onderbouwing met meer diepgang en de echte getallen. De uitgebreide versie geeft méér diepgang en data — niet zomaar méér tekst.\n\nAntwoord UITSLUITEND met geldige JSON (geen markdown, geen tekst eromheen) in dit schema:\n{\n  "short": "1 tot 2 zinnen, de kern: waarom deze training vandaag past. Direct leesbaar, geen jargon.",\n  "extended": "2 tot 4 korte alinea's met de trainingsfilosofie toegespitst op deze sessie — relevante principes uit trainingsopbouw, belasting & herstel, progressieve overload, nut van Z2, intensieve blokken, taper/herstelweek, periodisering, blessurepreventie en de relatie tot het hoofddoel. Verwijs naar de echte getallen (duur, TSS, zones, %FTP, week/fase). Platte tekst, alinea's gescheiden door een lege regel."\n}\n\nRegels: gebruik alleen echte data uit de context hierboven, verzin niets. Schrijf platte tekst in beide velden: GEEN markdown, geen kopjes, geen "#" of sterretjes/bold. Gebruik NOOIT het woord "AI" of "algoritme" — jij bent Sparki.`,
          },
        ],
      });

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
    if (err instanceof AiBlockedError) {
      res.status(403).json({ error: err.message, reason: err.reason });
      return;
    }
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
  /** Deterministische onderbouwing (Golf 23) — letterlijk toonbaar. */
  basis?: string[];
  /** 0–1 zekerheid van de deterministische beslislaag. */
  confidence?: number;
};

router.post("/workout-adjust", requireAuth, requireCommercialFeature("autonomous_training"), killSwitchGuard("auto_schema_adjust"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { workoutId, feedbackType, note, rpe, completion } = req.body as {
    workoutId?: number;
    feedbackType?: string;
    note?: string;
    rpe?: number | null;
    completion?: string | null;
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

    // Coachautoriteit: op een coachtraining doet Sparki géén eigen
    // aanpassingsvoorstel. Eerlijk en deterministisch antwoord (geen model-
    // aanroep), zodat de sporter weet waarom en wat de vervolgstap is.
    if (workout.source === "coach") {
      // Leg de aanleiding als OPEN wijzigingsvoorstel voor aan de coach —
      // Sparki past de coachtraining nooit zelf aan. Idempotent per training:
      // geen tweede open voorstel voor dezelfde training.
      const wantsProposal = [
        "too_hard",
        "pain",
        "tired",
        "too_light",
        "missed",
        "move",
      ].includes(feedbackType);
      if (wantsProposal) try {
        const [existing] = await db
          .select({ id: coachChangeProposalsTable.id })
          .from(coachChangeProposalsTable)
          .where(
            and(
              eq(coachChangeProposalsTable.workoutId, workout.id),
              eq(coachChangeProposalsTable.status, "open"),
            ),
          )
          .limit(1);
        if (!existing) {
          // Race-veilig: de partiële unique index (workout_id WHERE status='open')
          // dwingt hooguit één open voorstel af; een gelijktijdige tweede insert
          // wordt stil overgeslagen.
          await db.insert(coachChangeProposalsTable).values({
            athleteClerkId: clerkId,
            workoutId: workout.id,
            reason: `De sporter ${FEEDBACK_LABEL[feedbackType]}${note?.trim() ? ` — toelichting: "${note.trim().slice(0, 300)}"` : ""} bij "${workout.title}" (${workout.scheduledDate}).`,
            changes:
              feedbackType === "too_hard" || feedbackType === "pain" || feedbackType === "tired"
                ? {
                    targetDurationMin: workout.targetDurationMin
                      ? Math.round(workout.targetDurationMin * 0.7)
                      : undefined,
                    intensity: "herstel",
                  }
                : feedbackType === "too_light"
                  ? {
                      targetTSS: workout.targetTSS
                        ? Math.round(workout.targetTSS * 1.15)
                        : 60,
                    }
                  : { cancel: true },
          }).onConflictDoNothing();
        }
      } catch (proposalErr) {
        req.log.error({ err: proposalErr }, "coach change proposal persist failed");
      }
      const proposal: AdjustProposal = {
        recommendation: "keep",
        title: "Overleg dit met je coach",
        message:
          "Deze training staat in het schema van je coach. Sparki past coachtrainingen niet zelf aan. Je feedback ligt nu als voorstel bij je coach — die beslist of de training anders moet.",
        changes: null,
      };
      res.json({ proposal, coachOwned: true });
      return;
    }

    // Deterministische beslislaag (Golf 23): de aanbeveling, wijzigingen,
    // onderbouwing en zekerheid komen uit pure regels — reproduceerbaar en
    // nooit "creatief". Het taalmodel verwoordt hieronder alleen kop + uitleg.
    const today = todayStr();
    const decision = decideAdjustment({
      feedbackType,
      rpe: typeof rpe === "number" ? rpe : null,
      completion: typeof completion === "string" ? completion : null,
      workout: {
        targetDurationMin: workout.targetDurationMin,
        targetTSS: workout.targetTSS,
        scheduledDate: workout.scheduledDate,
        title: workout.title,
      },
      today,
    });

    // Verwoording door Sparki — met deterministische Nederlandse fallback als
    // het model niet (bruikbaar) antwoordt. Het voorstel zelf verandert nooit.
    let title = decision.fallbackTitle;
    let messageText = decision.fallbackMessage;
    try {
      const [context, system] = await Promise.all([
        buildAthleteContext(clerkId, "workout_adjust"),
        systemPrompt(clerkId),
      ]);
      const workoutBlock = describeWorkout(workout);
      const message = await aiMessage("workout_adjust", clerkId, {
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system,
        messages: [
          {
            role: "user",
            content: `Atleetcontext:\n${context}\n\n${workoutBlock}\n\nDE ATLEET ${FEEDBACK_LABEL[feedbackType].toUpperCase()}${note?.trim() ? ` — eigen toelichting: "${note.trim()}"` : ""}.\n\nSparki heeft al besloten (dit besluit staat VAST, verander er niets aan):\n- aanbeveling: ${decision.recommendation}\n- wijzigingen: ${JSON.stringify(decision.changes)}\n- onderbouwing: ${decision.basis.join(" ")}\n\nVerwoord dit besluit voor de atleet. Vandaag is ${today}. Antwoord UITSLUITEND met geldige JSON (geen markdown):\n{\n  "title": "korte kop (max 6 woorden, Nederlands)",\n  "message": "2-4 zinnen uitleg in het Nederlands, coachend en concreet, trouw aan het vaststaande besluit"\n}\n\nGebruik NOOIT het woord "AI" — jij bent Sparki. Noem geen andere getallen dan die in het besluit staan.`,
          },
        ],
      });
      const block = message.content[0];
      if (block && block.type === "text") {
        const raw = block.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        const json = start >= 0 && end >= 0 ? raw.slice(start, end + 1) : raw;
        const parsed = JSON.parse(json) as { title?: unknown; message?: unknown };
        if (
          typeof parsed.title === "string" &&
          parsed.title.trim() &&
          typeof parsed.message === "string" &&
          parsed.message.trim()
        ) {
          title = parsed.title.trim();
          messageText = parsed.message.trim();
        }
      }
    } catch (llmErr) {
      req.log.warn({ err: llmErr }, "ai.workout-adjust wording fallback used");
    }

    const proposal: AdjustProposal = {
      recommendation: decision.recommendation,
      title,
      message: messageText,
      changes: decision.changes,
      basis: decision.basis,
      confidence: decision.confidence,
    };

    res.json({ proposal });
  } catch (err) {
    req.log.error({ err }, "ai.workout-adjust failed");
    res.status(500).json({ error: "Sparki service unavailable" });
  }
});

export default router;
