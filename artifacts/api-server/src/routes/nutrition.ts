import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  nutritionHydrationLogsTable,
  nutritionContexts,
  athleteProfilesTable,
  trainingSessionsTable,
  plannedWorkoutsTable,
  racesTable,
  nutritionSeasonGoalsTable,
  type NutritionContext,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { computeAge } from "../lib/age";
import { analyzeNutritionLog } from "../lib/nutrition-rules";
import { persistObservation } from "../engines/coaching";
import { buildAthleteContext, systemPrompt } from "../lib/athlete-context";
import {
  normalizeMediaType,
  uploadMaterialPhoto,
  streamMaterialPhoto,
  readMaterialPhotoBase64,
  analyzeMaterial,
  analyzeMealText,
  type MaterialCategory,
  type MaterialPhotoInput,
  type MaterialAnalysisResult,
} from "../engines/material";

const router = Router();

const MAX_PHOTOS = 4;

// Local category for meal-photo assessment on a nutrition log. Deliberately NOT
// in the Materiaalcoach registry: this path is triggered by the rider logging a
// meal with a photo, not by picking a category chip.
const MEAL_CATEGORY: MaterialCategory = {
  key: "logged_meal",
  label: "Maaltijd",
  prompt: "Laat zien wat je at of dronk",
  kind: "nutrition",
};

const CONTEXT_HINTS: Record<string, string> = {
  training_day: "rond een training",
  race_day: "rond een wedstrijd",
  recovery_day: "op een hersteldag",
  normal_day: "op een gewone dag",
};

// Plain-Dutch labels for the training `type` column (values are English keys).
const SESSION_TYPE_LABELS: Record<string, string> = {
  ride: "Rit",
  endurance: "Duurtraining",
  interval: "Intervaltraining",
  tempo: "Tempotraining",
  threshold: "Drempeltraining",
  vo2max: "VO2max-training",
  recovery: "Herstelrit",
  race: "Wedstrijd",
  rest: "Rustdag",
  strength: "Krachttraining",
  run: "Duurloop",
};

const sessionTypeLabel = (type: string | null | undefined): string =>
  (type && SESSION_TYPE_LABELS[type]) || "Training";

// Gather everything Sparki already knows for a meal-photo assessment: who the
// rider is (age → youth gate for RED-S, weight, FTP, discipline) and what they
// train/trained that day. Intelligent-werkblad rule: combine real data first so
// the assessment reacts to the actual effort instead of giving generic food
// tips. Returns an honest hint string for the model, the youth flag, and a
// plain-Dutch training line for the UI (null when there is no training that day).
async function buildMealContext(
  clerkId: string,
  logDate: string,
  context: string,
): Promise<{
  athleteHint: string;
  youth: boolean;
  trainingContext: string | null;
}> {
  const [[athlete], sessions, planned] = await Promise.all([
    db
      .select({
        birthYear: athleteProfilesTable.birthYear,
        birthDate: athleteProfilesTable.birthDate,
        weightKg: athleteProfilesTable.weightKg,
        ftp: athleteProfilesTable.ftp,
        discipline: athleteProfilesTable.discipline,
        developmentGoal: athleteProfilesTable.developmentGoal,
      })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId)),
    db
      .select()
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          eq(trainingSessionsTable.sessionDate, logDate),
        ),
      ),
    db
      .select()
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, clerkId),
          eq(plannedWorkoutsTable.scheduledDate, logDate),
        ),
      ),
  ]);

  const age = computeAge(athlete?.birthDate, athlete?.birthYear);
  const youth = age != null && age < YOUTH_AGE_CUTOFF;

  // Describe the day's training in plain Dutch. Done sessions win (that is what
  // actually happened); otherwise fall back to the planned workout.
  let trainingContext: string | null = null;
  if (sessions.length > 0) {
    const parts = sessions.map((s) => {
      const bits: string[] = [s.title?.trim() || sessionTypeLabel(s.type)];
      if (s.durationMin != null) bits.push(`${s.durationMin} min`);
      if (s.distanceKm != null) bits.push(`${Number(s.distanceKm)} km`);
      if (s.tss != null) bits.push(`belasting ${s.tss}`);
      return bits.join(" · ");
    });
    trainingContext = `Gereden op deze dag: ${parts.join(" en ")}`;
  } else if (planned.length > 0) {
    const parts = planned.map((p) => {
      const bits: string[] = [p.title?.trim() || sessionTypeLabel(p.type)];
      if (p.targetDurationMin != null) bits.push(`${p.targetDurationMin} min`);
      if (p.targetTSS != null) bits.push(`belasting ${p.targetTSS}`);
      return bits.join(" · ");
    });
    trainingContext = `Gepland op deze dag: ${parts.join(" en ")}`;
  }

  const hintParts: string[] = [
    `Deze maaltijd/dit eten is gelogd ${CONTEXT_HINTS[context] ?? "die dag"} (${logDate}).`,
  ];
  if (age != null)
    hintParts.push(`Renner is ${age} jaar${youth ? " (jonge sporter)" : ""}.`);
  if (athlete?.weightKg != null)
    hintParts.push(`Gewicht ${Number(athlete.weightKg)} kg.`);
  if (athlete?.ftp != null) hintParts.push(`FTP ${athlete.ftp} watt.`);
  if (athlete?.discipline) hintParts.push(`Discipline: ${athlete.discipline}.`);
  hintParts.push(
    trainingContext
      ? `${trainingContext}.`
      : "Geen training bekend op deze dag.",
  );

  return { athleteHint: hintParts.join(" "), youth, trainingContext };
}

const numStr = (v: unknown): string | null =>
  v == null || v === "" ? null : String(v);

const intOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const strOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

type RawPhoto = { data?: unknown; mediaType?: unknown };

// Parse client-supplied meal photos. Photos are OPTIONAL on a nutrition log, so
// an absent/empty list is valid (returns []). A present-but-malformed entry is a
// hard error so the route fails honestly instead of silently dropping a photo.
function parsePhotos(raw: unknown): MaterialPhotoInput[] | "invalid" {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return "invalid";
  if (raw.length === 0) return [];
  const out: MaterialPhotoInput[] = [];
  for (const item of raw as RawPhoto[]) {
    if (!item || typeof item.data !== "string") return "invalid";
    let data = item.data;
    let mediaType =
      typeof item.mediaType === "string" ? item.mediaType : "image/jpeg";
    const dataUrl = data.match(/^data:([^;]+);base64,(.*)$/s);
    if (dataUrl) {
      mediaType = dataUrl[1]!;
      data = dataUrl[2]!;
    }
    const normalized = normalizeMediaType(mediaType);
    if (!normalized) return "invalid";
    const base64 = data.trim();
    if (!base64) return "invalid";
    out.push({ base64, mediaType: normalized });
  }
  return out;
}

// GET /api/nutrition?limit= — recent logs, newest first.
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  try {
    const logs = await db
      .select()
      .from(nutritionHydrationLogsTable)
      .where(eq(nutritionHydrationLogsTable.clerkId, clerkId))
      .orderBy(desc(nutritionHydrationLogsTable.logDate))
      .limit(limit);
    res.json({ logs });
  } catch (err) {
    req.log.error({ err }, "nutrition.list failed");
    res.status(500).json({ error: "Kon voedingslogboek niet laden" });
  }
});

// POST /api/nutrition — create a log (optionally with real meal photos), then run
// the rule analysis → observations. Photos are uploaded to object storage with
// the owner's ACL; only the normalized paths are stored on the row.
router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const logDate = strOrNull(body.logDate);
  if (!logDate) {
    res.status(400).json({ error: "logDate is verplicht (YYYY-MM-DD)" });
    return;
  }
  const rawContext = strOrNull(body.context) ?? "normal_day";
  const context: NutritionContext = (
    nutritionContexts as readonly string[]
  ).includes(rawContext)
    ? (rawContext as NutritionContext)
    : "normal_day";

  const photos = parsePhotos(body.photos);
  if (photos === "invalid") {
    res.status(400).json({ error: "Eén of meer foto's zijn ongeldig" });
    return;
  }
  if (photos.length > MAX_PHOTOS) {
    res.status(400).json({ error: `Maximaal ${MAX_PHOTOS} foto's` });
    return;
  }

  try {
    // Upload photos first so the row never references a failed upload.
    const photoPaths: string[] = [];
    for (const p of photos) {
      photoPaths.push(await uploadMaterialPhoto(clerkId, p));
    }

    const [log] = await db
      .insert(nutritionHydrationLogsTable)
      .values({
        clerkId,
        logDate,
        context,
        preTrainingFood: strOrNull(body.preTrainingFood),
        duringTrainingCarbsGrams: intOrNull(body.duringTrainingCarbsGrams),
        duringTrainingFluidMl: intOrNull(body.duringTrainingFluidMl),
        duringTrainingSodiumMg: intOrNull(body.duringTrainingSodiumMg),
        postTrainingFood: strOrNull(body.postTrainingFood),
        bodyWeightBefore: numStr(body.bodyWeightBefore),
        bodyWeightAfter: numStr(body.bodyWeightAfter),
        stomachIssues: body.stomachIssues === true,
        notes: strOrNull(body.notes),
        photoPaths,
      })
      .returning();

    // AI rule analysis — privacy-gated inside persistObservation.
    const observations = analyzeNutritionLog(log);
    void Promise.all(observations.map((o) => persistObservation(o))).catch(
      (err) => req.log.error({ err }, "nutrition.analyze failed"),
    );

    // Meal-photo assessment: a photo of food must get a real reaction, never
    // silently disappear into storage. Honest failure: on error the log is
    // still saved and we say so (photoAdviceFailed), never a fabricated verdict.
    let photoAdvice: MaterialAnalysisResult | null = null;
    let photoAdviceFailed = false;
    let trainingContext: string | null = null;

    // Food text the rider typed (without a photo) — the fields that describe
    // what they ate/drank. Notes alone don't trigger an estimate (they may not
    // be about food), but they enrich the description once food fields exist.
    const preFood = strOrNull(body.preTrainingFood);
    const postFood = strOrNull(body.postTrainingFood);
    const noteText = strOrNull(body.notes);
    const hasFoodText = !!(preFood || postFood);

    if (photos.length > 0) {
      try {
        const noteParts = [
          noteText,
          preFood && `Voor de training at ik: ${preFood}`,
          postFood && `Na de training at ik: ${postFood}`,
        ].filter((p): p is string => !!p);
        const mealCtx = await buildMealContext(clerkId, logDate, context);
        trainingContext = mealCtx.trainingContext;
        photoAdvice = await analyzeMaterial({
          category: MEAL_CATEGORY,
          photos,
          userNote: noteParts.join(". ") || null,
          athleteHint: mealCtx.athleteHint,
          youth: mealCtx.youth,
        });
        if (photoAdvice.advice.summary) {
          void persistObservation({
            clerkId,
            sourceType: "nutrition_analysis",
            category: "nutrition",
            severity: "info",
            confidence:
              photoAdvice.confidence === "unknown"
                ? "low"
                : photoAdvice.confidence,
            title: `Maaltijd bekeken: ${photoAdvice.detectedItem}`,
            observationText: photoAdvice.advice.summary,
            recommendedAction: photoAdvice.advice.risks[0] ?? null,
            detectedPattern: "meal_photo_review",
            supportingDataRefs: { nutritionLogId: log.id, logDate: log.logDate },
          }).catch((err) =>
            req.log.error({ err }, "nutrition.photo-advice persist failed"),
          );
        }
      } catch (err) {
        photoAdviceFailed = true;
        req.log.error({ err }, "nutrition.photo-advice failed");
      }
    } else if (hasFoodText) {
      // No photo, but the rider described food in text — still give a real
      // nutrition estimate instead of a dead-end with no values.
      try {
        const mealText = [
          preFood && `Voor de training: ${preFood}`,
          postFood && `Na de training: ${postFood}`,
          noteText && `Notitie: ${noteText}`,
        ]
          .filter((p): p is string => !!p)
          .join(". ");
        const mealCtx = await buildMealContext(clerkId, logDate, context);
        trainingContext = mealCtx.trainingContext;
        photoAdvice = await analyzeMealText({
          mealText,
          athleteHint: mealCtx.athleteHint,
          youth: mealCtx.youth,
        });
        if (photoAdvice.advice.summary) {
          void persistObservation({
            clerkId,
            sourceType: "nutrition_analysis",
            category: "nutrition",
            severity: "info",
            confidence:
              photoAdvice.confidence === "unknown"
                ? "low"
                : photoAdvice.confidence,
            title: `Voeding bekeken: ${photoAdvice.detectedItem}`,
            observationText: photoAdvice.advice.summary,
            recommendedAction: photoAdvice.advice.risks[0] ?? null,
            detectedPattern: "meal_text_review",
            supportingDataRefs: { nutritionLogId: log.id, logDate: log.logDate },
          }).catch((err) =>
            req.log.error({ err }, "nutrition.text-advice persist failed"),
          );
        }
      } catch (err) {
        photoAdviceFailed = true;
        req.log.error({ err }, "nutrition.text-advice failed");
      }
    }

    res.status(201).json({
      log,
      flagged: observations.length,
      photoAdvice,
      photoAdviceFailed,
      trainingContext,
    });
  } catch (err) {
    req.log.error({ err }, "nutrition.create failed");
    res.status(500).json({ error: "Kon log niet opslaan" });
  }
});

// DELETE /api/nutrition/:id — remove a log (owner only).
router.delete("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(nutritionHydrationLogsTable)
      .where(
        and(
          eq(nutritionHydrationLogsTable.id, id),
          eq(nutritionHydrationLogsTable.clerkId, clerkId),
        ),
      )
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Log niet gevonden" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "nutrition.delete failed");
    res.status(500).json({ error: "Kon log niet verwijderen" });
  }
});

// GET /api/nutrition/photo/:id/:idx — serve one stored meal photo (owner only).
router.get("/photo/:id/:idx", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const idx = Number(String(req.params.idx));
  if (!Number.isInteger(id) || !Number.isInteger(idx) || idx < 0) {
    res.status(400).json({ error: "Ongeldig verzoek" });
    return;
  }
  try {
    const [row] = await db
      .select({ photoPaths: nutritionHydrationLogsTable.photoPaths })
      .from(nutritionHydrationLogsTable)
      .where(
        and(
          eq(nutritionHydrationLogsTable.id, id),
          eq(nutritionHydrationLogsTable.clerkId, clerkId),
        ),
      );
    const path = row?.photoPaths[idx];
    if (!path) {
      res.status(404).json({ error: "Foto niet gevonden" });
      return;
    }
    const stream = await streamMaterialPhoto(path, res);
    stream.on("error", (err) => {
      req.log.error({ err }, "nutrition.photo stream failed");
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (err) {
    req.log.error({ err }, "nutrition.photo failed");
    if (!res.headersSent) res.status(404).json({ error: "Foto niet gevonden" });
  }
});

// POST /api/nutrition/:id/photo-advice — assess the stored photo(s) of an
// EXISTING log (owner only). Needed for logs whose photo was saved before the
// assessment existed or whose assessment failed at logging time: a photo of
// food must always be able to get a real reaction, never silently sit in
// storage. Honest failure: if the photos cannot be read or assessed we say so.
router.post("/:id/photo-advice", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [log] = await db
      .select()
      .from(nutritionHydrationLogsTable)
      .where(
        and(
          eq(nutritionHydrationLogsTable.id, id),
          eq(nutritionHydrationLogsTable.clerkId, clerkId),
        ),
      );
    if (!log) {
      res.status(404).json({ error: "Log niet gevonden" });
      return;
    }

    // Optional rider correction — e.g. "het waren 10 broodjes, niet 6". It is
    // authoritative over what the photo/text seemed to show (the rider was
    // there), so the estimate is recomputed on their stated amount.
    const body = (req.body ?? {}) as Record<string, unknown>;
    const correction = strOrNull(body.correction);
    const hasFoodText = !!(log.preTrainingFood || log.postTrainingFood);

    if (log.photoPaths.length === 0 && !hasFoodText && !correction) {
      res
        .status(400)
        .json({ error: "Deze log heeft geen foto of omschrijving om te beoordelen" });
      return;
    }

    const mealCtx = await buildMealContext(clerkId, log.logDate, log.context);
    let photoAdvice: MaterialAnalysisResult;

    if (log.photoPaths.length > 0) {
      const photos: MaterialPhotoInput[] = [];
      for (const p of log.photoPaths.slice(0, MAX_PHOTOS)) {
        const stored = await readMaterialPhotoBase64(p);
        const mediaType = normalizeMediaType(stored.mediaType);
        if (mediaType) photos.push({ base64: stored.base64, mediaType });
      }
      if (photos.length === 0) {
        res
          .status(502)
          .json({ error: "De foto kon niet gelezen worden uit de opslag" });
        return;
      }

      const noteParts = [
        log.notes,
        log.preTrainingFood && `Voor de training at ik: ${log.preTrainingFood}`,
        log.postTrainingFood && `Na de training at ik: ${log.postTrainingFood}`,
        correction && `Correctie van de renner (leidend): ${correction}`,
      ].filter((p): p is string => !!p);

      photoAdvice = await analyzeMaterial({
        category: MEAL_CATEGORY,
        photos,
        userNote: noteParts.join(". ") || null,
        athleteHint: mealCtx.athleteHint,
        youth: mealCtx.youth,
      });
    } else {
      // Text-only log (no photo) — assess (or re-assess with a correction) the
      // rider's description so it too gets real nutrition values.
      const mealText = [
        log.preTrainingFood && `Voor de training: ${log.preTrainingFood}`,
        log.postTrainingFood && `Na de training: ${log.postTrainingFood}`,
        log.notes && `Notitie: ${log.notes}`,
        correction && `Correctie van de renner (leidend): ${correction}`,
      ]
        .filter((p): p is string => !!p)
        .join(". ");
      photoAdvice = await analyzeMealText({
        mealText,
        athleteHint: mealCtx.athleteHint,
        youth: mealCtx.youth,
      });
    }

    if (photoAdvice.advice.summary) {
      void persistObservation({
        clerkId,
        sourceType: "nutrition_analysis",
        category: "nutrition",
        severity: "info",
        confidence:
          photoAdvice.confidence === "unknown" ? "low" : photoAdvice.confidence,
        title:
          log.photoPaths.length > 0
            ? `Maaltijd bekeken: ${photoAdvice.detectedItem}`
            : `Voeding bekeken: ${photoAdvice.detectedItem}`,
        observationText: photoAdvice.advice.summary,
        recommendedAction: photoAdvice.advice.risks[0] ?? null,
        detectedPattern:
          log.photoPaths.length > 0 ? "meal_photo_review" : "meal_text_review",
        supportingDataRefs: { nutritionLogId: log.id, logDate: log.logDate },
      }).catch((err) =>
        req.log.error({ err }, "nutrition.photo-advice persist failed"),
      );
    }

    res.json({ photoAdvice, trainingContext: mealCtx.trainingContext });
  } catch (err) {
    req.log.error({ err }, "nutrition.photo-advice (existing log) failed");
    res
      .status(502)
      .json({ error: "Dit kon nu niet beoordeeld worden. Probeer het zo opnieuw." });
  }
});

// ── GET /api/nutrition/day-analysis ──────────────────────────────────────────
// Whole-day nutrition analysis for ONE date: everything the rider logged that
// day (fields + meal photos) related to the training of that day (ridden and/or
// planned) and to WHO the rider is (age, weight, discipline, development goal).
// Age decides the depth: under 16 stays light and habit-focused (no gram
// targets, no performance pressure, RED-S-safe); 16+ gets concrete numbers.
// Honest gaps: what Sparki cannot know (e.g. meals that were not logged,
// missing birth year/weight) is named plainly, never filled in.

const MAX_DAY_PHOTOS = 6;

router.get("/day-analysis", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const rawDate = strOrNull(req.query.date);
  // Fallback = the NL calendar day (server clock runs in UTC; a plain
  // toISOString() slice would point at yesterday between 00:00–02:00 NL time).
  const date =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Amsterdam",
        }).format(new Date());

  try {
    const [[athlete], logs, sessions, planned] = await Promise.all([
      db
        .select({
          birthYear: athleteProfilesTable.birthYear,
          birthDate: athleteProfilesTable.birthDate,
          weightKg: athleteProfilesTable.weightKg,
          discipline: athleteProfilesTable.discipline,
          developmentGoal: athleteProfilesTable.developmentGoal,
          ftp: athleteProfilesTable.ftp,
        })
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, clerkId)),
      db
        .select()
        .from(nutritionHydrationLogsTable)
        .where(
          and(
            eq(nutritionHydrationLogsTable.clerkId, clerkId),
            eq(nutritionHydrationLogsTable.logDate, date),
          ),
        )
        .orderBy(nutritionHydrationLogsTable.createdAt),
      db
        .select()
        .from(trainingSessionsTable)
        .where(
          and(
            eq(trainingSessionsTable.clerkId, clerkId),
            eq(trainingSessionsTable.sessionDate, date),
          ),
        ),
      db
        .select()
        .from(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.clerkId, clerkId),
            eq(plannedWorkoutsTable.scheduledDate, date),
          ),
        ),
    ]);

    if (logs.length === 0) {
      res.json({
        analysis: null,
        reason:
          "Er is op deze dag nog niets gelogd. Log eerst wat je at of dronk — dan kan de dag beoordeeld worden.",
      });
      return;
    }

    const age = computeAge(athlete?.birthDate, athlete?.birthYear);
    const isYouth = age != null && age < YOUTH_AGE_CUTOFF;

    const seasonBlock = await seasonGoalPromptBlock(
      clerkId,
      age,
      athlete?.weightKg != null ? Number(athlete.weightKg) : null,
      new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(
        new Date(),
      ),
    );

    // Real meal photos of the day (capped) as visual evidence.
    const photoInputs: MaterialPhotoInput[] = [];
    for (const log of logs) {
      for (const p of log.photoPaths) {
        if (photoInputs.length >= MAX_DAY_PHOTOS) break;
        try {
          const stored = await readMaterialPhotoBase64(p);
          const mediaType = normalizeMediaType(stored.mediaType);
          if (mediaType) {
            photoInputs.push({ base64: stored.base64, mediaType });
          }
        } catch (err) {
          req.log.warn({ err, path: p }, "nutrition.day photo read failed");
        }
      }
    }

    const logLines = logs
      .map((l, i) => {
        const parts: string[] = [`Log ${i + 1} (${CONTEXT_HINTS[l.context] ?? l.context})`];
        if (l.preTrainingFood) parts.push(`voor de training: ${l.preTrainingFood}`);
        if (l.postTrainingFood) parts.push(`na de training: ${l.postTrainingFood}`);
        if (l.duringTrainingCarbsGrams != null)
          parts.push(`${l.duringTrainingCarbsGrams} g koolhydraten tijdens`);
        if (l.duringTrainingFluidMl != null)
          parts.push(`${l.duringTrainingFluidMl} ml vocht tijdens`);
        if (l.duringTrainingSodiumMg != null)
          parts.push(`${l.duringTrainingSodiumMg} mg natrium tijdens`);
        if (l.stomachIssues) parts.push("maag-darmklachten gehad");
        if (l.notes) parts.push(`notitie: ${l.notes}`);
        if (l.photoPaths.length > 0)
          parts.push(`${l.photoPaths.length} foto('s) — zie bijgevoegde beelden`);
        return "- " + parts.join("; ");
      })
      .join("\n");

    const sessionLines =
      sessions.length > 0
        ? sessions
            .map((s) => {
              const parts = [
                `${s.title ?? s.type}`,
                s.durationMin != null ? `${s.durationMin} min` : null,
                s.distanceKm != null ? `${s.distanceKm} km` : null,
                s.tss != null ? `belastingsscore ${s.tss}` : null,
                s.avgPower != null ? `gem. ${s.avgPower} W` : null,
              ].filter(Boolean);
              return "- Gereden: " + parts.join(", ");
            })
            .join("\n")
        : null;
    const plannedLines =
      planned.length > 0
        ? planned
            .map((p) => {
              const parts = [
                p.title,
                p.targetDurationMin != null ? `${p.targetDurationMin} min gepland` : null,
                p.targetTSS != null ? `doel-belastingsscore ${p.targetTSS}` : null,
                `status: ${p.status}`,
              ].filter(Boolean);
              return "- Gepland: " + parts.join(", ");
            })
            .join("\n")
        : null;

    const personLines = [
      age != null ? `Leeftijd: ${age} jaar` : "Leeftijd: onbekend (geboortejaar niet ingevuld)",
      athlete?.weightKg != null ? `Gewicht: ${athlete.weightKg} kg` : "Gewicht: onbekend",
      athlete?.discipline ? `Discipline: ${athlete.discipline}` : null,
      athlete?.developmentGoal ? `Ontwikkeldoel: ${athlete.developmentGoal}` : null,
      athlete?.ftp != null ? `FTP: ${athlete.ftp} W` : null,
      "Geslacht: onbekend (wordt niet geregistreerd)",
    ].filter(Boolean);

    const audienceRule = isYouth
      ? `Deze sporter is ${age} jaar — een jeugdsporter. Houd de analyse LICHT en positief: gewoontes, genoeg en gevarieerd eten, op tijd eten rond de training, genoeg drinken. GEEN calorieën tellen, GEEN gram- of macrodoelen, GEEN prestatiedruk of afval-taal. Veiligheid voorop: eten is brandstof én plezier, nooit minder eten om lichter te worden.`
      : `Geef een concrete, volwassen analyse met echte richtgetallen waar dat eerlijk kan (koolhydraten per uur t.o.v. de duur/intensiteit van de training, vocht, eiwit voor herstel, timing).`;

    const message = await anthropic.messages.create(
      {
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: await systemPrompt(clerkId),
        messages: [
          {
            role: "user",
            content: [
              ...photoInputs.map((p) => ({
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: p.mediaType,
                  data: p.base64,
                },
              })),
              {
                type: "text" as const,
                text: `Analyseer de VOEDING VAN ÉÉN DAG (${date}) van deze sporter, in relatie tot de training van die dag en tot wie de sporter is.

WIE:
${personLines.join("\n")}

TRAINING DIE DAG:
${sessionLines ?? "- Geen gereden training bekend voor deze dag."}
${plannedLines ?? "- Geen geplande training voor deze dag."}

GELOGD DIE DAG:
${logLines}

${seasonBlock ? seasonBlock + "\n\n" : ""}${audienceRule}

EERLIJKHEID (verplicht): je ziet ALLEEN wat gelogd is — waarschijnlijk niet alle maaltijden van de dag. Trek dus geen conclusies over de totale dagvoeding alsof die compleet is; beoordeel wat er WEL is en benoem onder "gaps" wat je mist om een vollediger beeld te geven (bijv. niet-gelogde maaltijden, ontbrekend geboortejaar of gewicht). Verzin niets. Beoordeel foto's alleen op wat echt zichtbaar is.

Antwoord UITSLUITEND met geldige JSON (geen markdown eromheen):
{
  "summary": "2 tot 3 zinnen: het eerlijke totaalbeeld van deze dag, persoonlijk.",
  "points": [ { "title": "kort", "finding": "wat je ziet in de gelogde voeding t.o.v. training en persoon", "advice": "concreet wat hiermee te doen" } ],
  "gaps": [ "wat ontbreekt om een vollediger beeld te geven, in gewone taal" ]
}

2 tot 4 points. Platte tekst, gewoon Nederlands, geen Engels, nooit het woord "AI".`,
              },
            ],
          },
        ],
      },
      { timeout: 60000, maxRetries: 0 },
    );

    const block = message.content[0];
    if (!block || block.type !== "text") {
      res.status(502).json({ error: "Sparki kon de dag nu niet beoordelen" });
      return;
    }
    let parsed: Record<string, unknown> | null = null;
    try {
      const raw = block.text.trim();
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      parsed = JSON.parse(
        start >= 0 && end > start ? raw.slice(start, end + 1) : raw,
      ) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
    const summary = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
    const points = Array.isArray(parsed?.points)
      ? (parsed.points as unknown[])
          .map((p) => {
            const o = (p ?? {}) as Record<string, unknown>;
            return {
              title: typeof o.title === "string" ? o.title.trim() : "",
              finding: typeof o.finding === "string" ? o.finding.trim() : "",
              advice: typeof o.advice === "string" ? o.advice.trim() : "",
            };
          })
          .filter((p) => p.title && p.finding)
      : [];
    const gaps = Array.isArray(parsed?.gaps)
      ? (parsed.gaps as unknown[]).filter(
          (g): g is string => typeof g === "string" && g.trim() !== "",
        )
      : [];

    if (!summary || points.length === 0) {
      res.status(502).json({ error: "Sparki kon de dag nu niet beoordelen" });
      return;
    }

    res.json({
      analysis: {
        date,
        level: isYouth ? "youth" : "adult",
        summary,
        points,
        gaps,
        logCount: logs.length,
        photoCount: photoInputs.length,
        trainedThatDay: sessions.length > 0,
        plannedThatDay: planned.length > 0,
      },
    });
  } catch (err) {
    req.log.error({ err }, "nutrition.day-analysis failed");
    res.status(500).json({ error: "Sparki is even niet bereikbaar" });
  }
});

// ── Seizoensdoel (17+) — season goal that steers the nutrition day-planning ──
// The athlete states when the race season starts, when the peak lies and what
// their target weight is. Sparki asks — and keeps asking — for exactly what is
// still missing (one targeted question at a time, never a blank form) and
// derives an honest, deterministic steering: safe pace only (max ~0,5 kg per
// week), fueling the training always comes first, never crash diets. Athletes
// under 17 get NO weight steering at all (RED-S safety) — the endpoint refuses
// honestly instead of hiding the rule.

const SEASON_GOAL_MIN_AGE = 17;
const SAFE_KG_PER_WEEK = 0.5;

type SeasonSteering = {
  deltaKg: number | null;
  weeksToSeasonStart: number | null;
  weeksToPeak: number | null;
  requiredKgPerWeek: number | null;
  feasible: boolean | null;
  summary: string;
  warning: string | null;
};

function weeksUntil(dateStr: string | null, todayStr: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T12:00:00Z").getTime();
  const today = new Date(todayStr + "T12:00:00Z").getTime();
  return Math.round(((target - today) / 86_400_000 / 7) * 10) / 10;
}

function computeSeasonSteering(
  currentKg: number | null,
  targetKg: number | null,
  seasonStartDate: string | null,
  peakDate: string | null,
  today: string,
): SeasonSteering | null {
  if (currentKg == null || targetKg == null) return null;
  const deltaKg = Math.round((currentKg - targetKg) * 10) / 10;
  const weeksToSeasonStart = weeksUntil(seasonStartDate, today);
  const weeksToPeak = weeksUntil(peakDate, today);
  // The season start is the moment the weight should be right; the peak is
  // the hard deadline. Steer on the nearest future milestone.
  const horizon =
    weeksToSeasonStart != null && weeksToSeasonStart > 0
      ? weeksToSeasonStart
      : weeksToPeak != null && weeksToPeak > 0
        ? weeksToPeak
        : null;

  if (Math.abs(deltaKg) <= 0.5) {
    return {
      deltaKg,
      weeksToSeasonStart,
      weeksToPeak,
      requiredKgPerWeek: 0,
      feasible: true,
      summary:
        "Je zit al op je streefgewicht. De voeding stuurt op behoud: genoeg eten voor je trainingen, niet minder.",
      warning: null,
    };
  }

  const direction = deltaKg > 0 ? "afvallen" : "aankomen";
  if (horizon == null || horizon <= 0) {
    return {
      deltaKg,
      weeksToSeasonStart,
      weeksToPeak,
      requiredKgPerWeek: null,
      feasible: null,
      summary: `Verschil met streefgewicht: ${Math.abs(deltaKg).toString().replace(".", ",")} kg (${direction}). Zonder toekomstige seizoensstart of piekdatum kan het tempo niet berekend worden.`,
      warning: null,
    };
  }

  const requiredKgPerWeek =
    Math.round((Math.abs(deltaKg) / horizon) * 100) / 100;
  const feasible = requiredKgPerWeek <= SAFE_KG_PER_WEEK;
  const horizonNl = horizon.toString().replace(".", ",");
  return {
    deltaKg,
    weeksToSeasonStart,
    weeksToPeak,
    requiredKgPerWeek,
    feasible,
    summary: feasible
      ? `${Math.abs(deltaKg).toString().replace(".", ",")} kg ${direction} in ${horizonNl} weken kan rustig: ongeveer ${requiredKgPerWeek.toString().replace(".", ",")} kg per week. Dat past naast je trainingen.`
      : `${Math.abs(deltaKg).toString().replace(".", ",")} kg ${direction} in ${horizonNl} weken vraagt ${requiredKgPerWeek.toString().replace(".", ",")} kg per week — dat is meer dan het veilige tempo van ${SAFE_KG_PER_WEEK.toString().replace(".", ",")} kg per week.`,
    warning: feasible
      ? null
      : "Dit tempo is niet gezond en kost je trainingskwaliteit. Stel je streefgewicht of je datum bij — de voeding stuurt nooit sneller dan het veilige tempo.",
  };
}

// Age gate: null when eligible, otherwise honest refusal payload.
function seasonGoalIneligible(
  age: number | null,
): { eligible: false; reason: string; message: string } | null {
  if (age == null) {
    return {
      eligible: false,
      reason: "birth_year_missing",
      message:
        "Je geboortejaar is nog niet ingevuld. Sturen op gewicht is er alleen voor renners van 17 jaar en ouder — vul eerst je geboortejaar in bij je profiel.",
    };
  }
  if (age < SEASON_GOAL_MIN_AGE) {
    return {
      eligible: false,
      reason: "too_young",
      message:
        "Sturen op gewicht doet Sparki bewust niet onder de 17. Op jouw leeftijd geldt: genoeg en gevarieerd eten, op tijd rond je trainingen — je lichaam is nog volop in ontwikkeling.",
    };
  }
  return null;
}

// The doorvraag ladder: the ONE next question Sparki asks, in a fixed order.
function nextSeasonGoalQuestion(input: {
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  seasonStartDate: string | null;
  peakDate: string | null;
}): { field: string; question: string; why: string } | null {
  if (input.seasonStartDate == null) {
    return {
      field: "seasonStartDate",
      question: "Wanneer begint je wedstrijdseizoen?",
      why: "Dan weet Sparki tegen wanneer je gewicht goed moet zitten en hoeveel tijd er is om rustig bij te sturen.",
    };
  }
  if (input.peakDate == null) {
    return {
      field: "peakDate",
      question: "Wanneer ligt het hoogtepunt van je seizoen?",
      why: "Rond je piek telt je gewicht het zwaarst — daar stuurt de dagvoeding uiteindelijk naartoe.",
    };
  }
  if (input.currentWeightKg == null) {
    return {
      field: "currentWeightKg",
      question: "Wat weeg je op dit moment?",
      why: "Zonder je huidige gewicht valt niet te zeggen of en hoeveel er bijgestuurd moet worden.",
    };
  }
  if (input.targetWeightKg == null) {
    return {
      field: "targetWeightKg",
      question: "Welk gewicht wil je hebben als het erop aankomt?",
      why: "Dit is het doel waar de dagvoeding naartoe rekent — altijd in een gezond tempo, nooit ten koste van je trainingen.",
    };
  }
  return null;
}

router.get("/season-goal", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [[athlete], [goal]] = await Promise.all([
      db
        .select({
          birthYear: athleteProfilesTable.birthYear,
          birthDate: athleteProfilesTable.birthDate,
          weightKg: athleteProfilesTable.weightKg,
        })
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, clerkId)),
      db
        .select()
        .from(nutritionSeasonGoalsTable)
        .where(eq(nutritionSeasonGoalsTable.clerkId, clerkId)),
    ]);

    const age = computeAge(athlete?.birthDate, athlete?.birthYear);
    const blocked = seasonGoalIneligible(age);
    if (blocked) {
      res.json(blocked);
      return;
    }

    const currentWeightKg =
      athlete?.weightKg != null ? Number(athlete.weightKg) : null;
    const targetWeightKg =
      goal?.targetWeightKg != null ? Number(goal.targetWeightKg) : null;
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Amsterdam",
    }).format(new Date());

    res.json({
      eligible: true,
      goal: {
        seasonStartDate: goal?.seasonStartDate ?? null,
        peakDate: goal?.peakDate ?? null,
        targetWeightKg,
        note: goal?.note ?? null,
      },
      currentWeightKg,
      nextQuestion: nextSeasonGoalQuestion({
        currentWeightKg,
        targetWeightKg,
        seasonStartDate: goal?.seasonStartDate ?? null,
        peakDate: goal?.peakDate ?? null,
      }),
      steering: computeSeasonSteering(
        currentWeightKg,
        targetWeightKg,
        goal?.seasonStartDate ?? null,
        goal?.peakDate ?? null,
        today,
      ),
    });
  } catch (err) {
    req.log.error({ err }, "nutrition.season-goal get failed");
    res.status(500).json({ error: "Sparki is even niet bereikbaar" });
  }
});

router.put("/season-goal", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [athlete] = await db
      .select({
        birthYear: athleteProfilesTable.birthYear,
        birthDate: athleteProfilesTable.birthDate,
        weightKg: athleteProfilesTable.weightKg,
      })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));
    const age = computeAge(athlete?.birthDate, athlete?.birthYear);
    const blocked = seasonGoalIneligible(age);
    if (blocked) {
      res.status(403).json({ error: blocked.message });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const parseDate = (v: unknown): string | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      if (typeof v !== "string" || !dateRe.test(v)) return undefined;
      // Strict calendar check: round-trip so 2026-99-99 never reaches the DB.
      const d = new Date(v + "T12:00:00Z");
      return Number.isNaN(d.getTime()) ||
        d.toISOString().slice(0, 10) !== v
        ? undefined
        : v;
    };
    const parseWeight = (v: unknown): number | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      return Number.isFinite(n) && n >= 35 && n <= 150 ? Math.round(n * 10) / 10 : undefined;
    };

    const seasonStartDate = parseDate(body.seasonStartDate);
    const peakDate = parseDate(body.peakDate);
    const targetWeightKg = parseWeight(body.targetWeightKg);
    const currentWeightKg = parseWeight(body.currentWeightKg);
    const note =
      body.note === undefined
        ? undefined
        : body.note === null || body.note === ""
          ? null
          : String(body.note).slice(0, 500);

    if (
      (body.seasonStartDate !== undefined && seasonStartDate === undefined) ||
      (body.peakDate !== undefined && peakDate === undefined)
    ) {
      res.status(400).json({ error: "Datum moet als JJJJ-MM-DD" });
      return;
    }
    if (
      (body.targetWeightKg !== undefined && targetWeightKg === undefined) ||
      (body.currentWeightKg !== undefined && currentWeightKg === undefined)
    ) {
      res.status(400).json({ error: "Gewicht moet tussen 35 en 150 kg liggen" });
      return;
    }

    // Current weight lives on the athlete profile — single source of truth.
    if (currentWeightKg !== undefined && currentWeightKg !== null) {
      await db
        .update(athleteProfilesTable)
        .set({ weightKg: String(currentWeightKg), updatedAt: new Date() })
        .where(eq(athleteProfilesTable.clerkId, clerkId));
    }

    const goalValues: Record<string, unknown> = { updatedAt: new Date() };
    if (seasonStartDate !== undefined) goalValues.seasonStartDate = seasonStartDate;
    if (peakDate !== undefined) goalValues.peakDate = peakDate;
    if (targetWeightKg !== undefined)
      goalValues.targetWeightKg = targetWeightKg == null ? null : String(targetWeightKg);
    if (note !== undefined) goalValues.note = note;

    await db
      .insert(nutritionSeasonGoalsTable)
      .values({ clerkId, ...goalValues })
      .onConflictDoUpdate({
        target: nutritionSeasonGoalsTable.clerkId,
        set: goalValues,
      });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "nutrition.season-goal put failed");
    res.status(500).json({ error: "Sparki is even niet bereikbaar" });
  }
});

// Shared: the deterministic season-goal steering block injected into the
// fueling-plan and day-analysis prompts for adult (17+) athletes with a goal.
async function seasonGoalPromptBlock(
  clerkId: string,
  age: number | null,
  currentWeightKg: number | null,
  today: string,
): Promise<string | null> {
  if (age == null || age < SEASON_GOAL_MIN_AGE) return null;
  const [goal] = await db
    .select()
    .from(nutritionSeasonGoalsTable)
    .where(eq(nutritionSeasonGoalsTable.clerkId, clerkId));
  if (!goal) return null;
  const targetWeightKg =
    goal.targetWeightKg != null ? Number(goal.targetWeightKg) : null;
  const steering = computeSeasonSteering(
    currentWeightKg,
    targetWeightKg,
    goal.seasonStartDate,
    goal.peakDate,
    today,
  );
  const lines = [
    "SEIZOENSDOEL (door de sporter zelf ingesteld, weegt mee in het advies):",
    goal.seasonStartDate ? `- Wedstrijdseizoen begint: ${goal.seasonStartDate}` : null,
    goal.peakDate ? `- Hoogtepunt van het seizoen: ${goal.peakDate}` : null,
    targetWeightKg != null ? `- Streefgewicht: ${targetWeightKg} kg` : null,
    steering ? `- Berekende sturing: ${steering.summary}` : null,
    steering?.warning ? `- Waarschuwing: ${steering.warning}` : null,
    goal.note ? `- Toelichting van de sporter: ${goal.note}` : null,
    `REGELS: de training van vandaag wordt ALTIJD volledig gevoed — nooit besparen rond of tijdens een training. Sturing op gewicht gebeurt uitsluitend via de gewone maaltijden op rustige momenten, in een tempo van maximaal ${SAFE_KG_PER_WEEK.toString().replace(".", ",")} kg per week. Nooit crashdiëten of maaltijden overslaan adviseren.`,
  ].filter(Boolean);
  return lines.length > 1 ? lines.join("\n") : null;
}

// ── GET /api/nutrition/fueling-plan ──────────────────────────────────────────
// When the training or race of a day is known IN ADVANCE, Sparki proposes a
// four-phase fueling plan: voorbereiding → tijdens → direct erna → de uren
// erna (herstel). Grounded in the REAL planned workout / race of that date and
// the athlete's profile. Honest reason when nothing is planned — never a
// generic made-up plan. Youth <16 stays light and RED-S-safe (no numbers).

router.get("/fueling-plan", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const rawDate = strOrNull(req.query.date);
  const date =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Amsterdam",
        }).format(new Date());

  try {
    const [[athlete], planned, dayRaces] = await Promise.all([
      db
        .select({
          birthYear: athleteProfilesTable.birthYear,
          birthDate: athleteProfilesTable.birthDate,
          weightKg: athleteProfilesTable.weightKg,
          discipline: athleteProfilesTable.discipline,
          developmentGoal: athleteProfilesTable.developmentGoal,
          ftp: athleteProfilesTable.ftp,
        })
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, clerkId)),
      db
        .select()
        .from(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.clerkId, clerkId),
            eq(plannedWorkoutsTable.scheduledDate, date),
          ),
        ),
      db
        .select()
        .from(racesTable)
        .where(
          and(eq(racesTable.clerkId, clerkId), eq(racesTable.raceDate, date)),
        ),
    ]);

    const openPlanned = planned.filter((p) => p.status !== "completed");
    if (openPlanned.length === 0 && dayRaces.length === 0) {
      res.json({
        plan: null,
        reason:
          "Er staat voor deze dag geen training of wedstrijd gepland. Zodra er iets in je schema staat, kan er vooraf een voedingsplan gemaakt worden.",
      });
      return;
    }

    const age = computeAge(athlete?.birthDate, athlete?.birthYear);
    const isYouth = age != null && age < YOUTH_AGE_CUTOFF;

    const seasonBlock = await seasonGoalPromptBlock(
      clerkId,
      age,
      athlete?.weightKg != null ? Number(athlete.weightKg) : null,
      new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(
        new Date(),
      ),
    );

    const effortLines: string[] = [];
    for (const r of dayRaces) {
      const parts = [
        `WEDSTRIJD: ${r.name}`,
        r.discipline ? `discipline ${r.discipline}` : null,
        r.distanceKm != null ? `${r.distanceKm} km` : null,
      ].filter(Boolean);
      effortLines.push("- " + parts.join(", "));
    }
    for (const p of openPlanned) {
      const parts = [
        `TRAINING: ${p.title}`,
        p.description ? p.description : null,
        p.targetDurationMin != null ? `${p.targetDurationMin} min gepland` : null,
        p.targetTSS != null ? `doel-belastingsscore ${p.targetTSS}` : null,
      ].filter(Boolean);
      effortLines.push("- " + parts.join(", "));
    }

    const personLines = [
      age != null ? `Leeftijd: ${age} jaar` : "Leeftijd: onbekend (geboortejaar niet ingevuld)",
      athlete?.weightKg != null ? `Gewicht: ${athlete.weightKg} kg` : "Gewicht: onbekend",
      athlete?.discipline ? `Discipline: ${athlete.discipline}` : null,
      athlete?.developmentGoal ? `Ontwikkeldoel: ${athlete.developmentGoal}` : null,
      athlete?.ftp != null ? `FTP: ${athlete.ftp} W` : null,
      "Geslacht: onbekend (wordt niet geregistreerd)",
    ].filter(Boolean);

    const audienceRule = isYouth
      ? `Deze sporter is ${age} jaar — een jeugdsporter. Houd het plan LICHT en positief: gewone maaltijden op tijd, een gevulde bidon, iets kleins meenemen voor onderweg bij lange ritten, gewoon eten na afloop. GEEN calorieën, GEEN gram- of macrodoelen, GEEN prestatiedruk of afval-taal. Eten is brandstof én plezier; nooit minder eten om lichter te worden.`
      : `Geef een concreet, volwassen plan met echte richtgetallen waar dat eerlijk kan: koolhydraten in de uren vooraf, koolhydraten per uur tijdens (afgestemd op duur en intensiteit — onder de 60–75 minuten is extra voeding tijdens meestal niet nodig, zeg dat dan eerlijk), vocht en natrium, koolhydraten + eiwit direct na, en volwaardige maaltijden in de uren erna.`;

    const message = await anthropic.messages.create(
      {
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: await systemPrompt(clerkId),
        messages: [
          {
            role: "user",
            content: `Maak een VOEDINGSPLAN VOORAF voor de inspanning van ${date}, in vier fasen. Baseer het UITSLUITEND op wat hieronder echt gepland staat en op wie de sporter is.

WIE:
${personLines.join("\n")}

GEPLAND OP ${date}:
${effortLines.join("\n")}

${seasonBlock ? seasonBlock + "\n\n" : ""}${audienceRule}

EERLIJKHEID (verplicht): baseer hoeveelheden op de geplande duur en intensiteit die hierboven staan. Ontbreekt de duur of intensiteit, zeg dat dan bij "gaps" en houd het advies daar voorzichtig in plaats van getallen te verzinnen. Starttijd is onbekend — formuleer timing relatief ("2 tot 3 uur voor de start"), nooit met kloktijden.

Antwoord UITSLUITEND met geldige JSON (geen markdown eromheen):
{
  "summary": "1 tot 2 zinnen: waar dit plan op gebouwd is en wat de kern is.",
  "phases": [
    { "phase": "voorbereiding", "title": "Voorbereiding", "advice": "concreet advies voor de uren vóór de start" },
    { "phase": "tijdens", "title": "Tijdens", "advice": "concreet advies tijdens de inspanning" },
    { "phase": "direct_erna", "title": "Direct erna", "advice": "concreet advies voor de eerste 30 tot 60 minuten na afloop" },
    { "phase": "herstel", "title": "De uren erna", "advice": "concreet advies voor herstel de rest van de dag" }
  ],
  "gaps": [ "wat ontbreekt om het plan preciezer te maken, in gewone taal" ]
}

Precies deze 4 fasen, in deze volgorde. Platte tekst, gewoon Nederlands, geen Engels, nooit het woord "AI".`,
          },
        ],
      },
      { timeout: 60000, maxRetries: 0 },
    );

    const block = message.content[0];
    if (!block || block.type !== "text") {
      res.status(502).json({ error: "Sparki kon nu geen voedingsplan maken" });
      return;
    }
    let parsed: Record<string, unknown> | null = null;
    try {
      const raw = block.text.trim();
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      parsed = JSON.parse(
        start >= 0 && end > start ? raw.slice(start, end + 1) : raw,
      ) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
    const summary = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
    // Enforce the four-phase contract: exactly voorbereiding → tijdens →
    // direct_erna → herstel, deduped by key and in canonical order. Anything
    // less is an honest 502, never a partial plan.
    const PHASE_ORDER = ["voorbereiding", "tijdens", "direct_erna", "herstel"] as const;
    const PHASE_TITLES: Record<(typeof PHASE_ORDER)[number], string> = {
      voorbereiding: "Voorbereiding",
      tijdens: "Tijdens",
      direct_erna: "Direct erna",
      herstel: "De uren erna",
    };
    const byKey = new Map<string, { phase: string; title: string; advice: string }>();
    if (Array.isArray(parsed?.phases)) {
      for (const p of parsed.phases as unknown[]) {
        const o = (p ?? {}) as Record<string, unknown>;
        const key = typeof o.phase === "string" ? o.phase.trim() : "";
        const advice = typeof o.advice === "string" ? o.advice.trim() : "";
        if (
          (PHASE_ORDER as readonly string[]).includes(key) &&
          advice &&
          !byKey.has(key)
        ) {
          byKey.set(key, {
            phase: key,
            title: PHASE_TITLES[key as (typeof PHASE_ORDER)[number]],
            advice,
          });
        }
      }
    }
    const phases = PHASE_ORDER.map((k) => byKey.get(k)).filter(
      (p): p is { phase: string; title: string; advice: string } => p != null,
    );
    const gaps = Array.isArray(parsed?.gaps)
      ? (parsed.gaps as unknown[]).filter(
          (g): g is string => typeof g === "string" && g.trim() !== "",
        )
      : [];

    if (!summary || phases.length !== PHASE_ORDER.length) {
      res.status(502).json({ error: "Sparki kon nu geen voedingsplan maken" });
      return;
    }

    res.json({
      plan: {
        date,
        level: isYouth ? "youth" : "adult",
        summary,
        phases,
        gaps,
        raceCount: dayRaces.length,
        workoutCount: openPlanned.length,
      },
    });
  } catch (err) {
    req.log.error({ err }, "nutrition.fueling-plan failed");
    res.status(500).json({ error: "Sparki is even niet bereikbaar" });
  }
});

// ── GET /api/nutrition/guidance ──────────────────────────────────────────────
// Sparki's real, age-tuned voedingsbegeleiding for THIS athlete: what / why / how
// per onderwerp, grounded in the athlete's actual context. Age decides the depth
// and tone — under 16 stays light and habit-focused (gezond, genoeg eten, plezier,
// geen getallen of prestatiedruk; veilig rond RED-S), 16+ krijgt concrete fueling
// met echte getallen. Honest failure, never fabricated. No "AI" wording.

type GuidanceTopic = { title: string; what: string; why: string; how: string };

const YOUTH_AGE_CUTOFF = 16;

router.get("/guidance", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;

  try {
    const [athlete] = await db
      .select({
        birthYear: athleteProfilesTable.birthYear,
        birthDate: athleteProfilesTable.birthDate,
        discipline: athleteProfilesTable.discipline,
      })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));

    const age = computeAge(athlete?.birthDate, athlete?.birthYear);
    const isYouth = age != null && age < YOUTH_AGE_CUTOFF;
    const level: "youth" | "adult" = isYouth ? "youth" : "adult";

    const [context, system] = await Promise.all([
      buildAthleteContext(clerkId, "nutrition_day_analysis"),
      systemPrompt(clerkId),
    ]);

    const audienceInstruction = isYouth
      ? `Deze sporter is ${age} jaar — een jonge/jeugdsporter. Houd het LICHT en positief: focus op gezonde gewoontes, genoeg en gevarieerd eten, plezier in eten, en simpele dingen rond de training (op tijd eten, genoeg drinken). GEEN gramberekeningen, GEEN macro's of prestatiedruk, GEEN streng dieet-advies. Veiligheid voorop: eten is brandstof én plezier, nooit minder eten om lichter te worden. Geef 2 tot 3 onderwerpen.`
      : age != null
        ? `Deze sporter is ${age} jaar (volwassen/serieuze sporter). Ga de diepte in met concrete, toepasbare fueling-begeleiding: gebruik echte richtgetallen waar dat past (bijv. koolhydraten per uur afhankelijk van duur/intensiteit, vocht en natrium, eiwit voor herstel, voor/tijdens/na, wedstrijdvoeding). Stem af op de discipline en trainingsbelasting uit de context. Geef 3 tot 5 onderwerpen.`
        : `De leeftijd van deze sporter is onbekend (geboortejaar niet ingevuld). Geef gebalanceerde, praktische begeleiding voor een volwassen sporter met concrete richtgetallen waar dat past, en noem in de intro kort dat je het advies nog scherper kunt maken zodra het geboortejaar bekend is. Geef 3 tot 4 onderwerpen.`;

    const message = await anthropic.messages.create(
      {
        model: "claude-sonnet-4-6",
        max_tokens: 1800,
        system,
        messages: [
          {
            role: "user",
            content: `Atleetcontext:\n${context}\n\n${audienceInstruction}\n\nGeef in het NEDERLANDS Sparki's voedingsbegeleiding voor DEZE sporter. Per onderwerp leg je drie dingen uit: WAT (de kern, één zin, direct leesbaar), WAAROM (waarom dit voor deze sporter belangrijk is) en HOE (concreet hoe je het aanpakt). Stem alles af op de echte data in de context hierboven; verzin niets. Als iets onbekend is, benoem dat eerlijk in plaats van het in te vullen.\n\nAntwoord UITSLUITEND met geldige JSON (geen markdown, geen tekst eromheen) in dit schema:\n{\n  "intro": "1 tot 2 zinnen die kort kaderen waar deze begeleiding over gaat, persoonlijk voor deze sporter.",\n  "topics": [\n    { "title": "kort onderwerp", "what": "de kern in één zin", "why": "waarom dit belangrijk is voor deze sporter", "how": "concreet hoe je het aanpakt" }\n  ]\n}\n\nSchrijf platte tekst in alle velden: GEEN markdown, geen kopjes, geen "#" of sterretjes/bold. Gebruik NOOIT het woord "AI" of "algoritme" — jij bent Sparki.`,
          },
        ],
      },
      { timeout: 60000, maxRetries: 0 },
    );

    const block = message.content[0];
    if (!block || block.type !== "text") {
      res.status(500).json({ error: "Onverwacht Sparki-antwoord" });
      return;
    }

    let parsed: { intro?: unknown; topics?: unknown } | null = null;
    try {
      const raw = block.text
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "");
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      const json = start >= 0 && end >= 0 ? raw.slice(start, end + 1) : raw;
      parsed = JSON.parse(json) as { intro?: unknown; topics?: unknown };
    } catch {
      parsed = null;
    }

    const intro = typeof parsed?.intro === "string" ? parsed.intro.trim() : "";
    const topics: GuidanceTopic[] = Array.isArray(parsed?.topics)
      ? (parsed.topics as unknown[])
          .map((t) => {
            const o = (t ?? {}) as Record<string, unknown>;
            return {
              title: typeof o.title === "string" ? o.title.trim() : "",
              what: typeof o.what === "string" ? o.what.trim() : "",
              why: typeof o.why === "string" ? o.why.trim() : "",
              how: typeof o.how === "string" ? o.how.trim() : "",
            };
          })
          .filter((t) => t.title && t.what && t.why && t.how)
      : [];

    if (topics.length === 0) {
      res
        .status(502)
        .json({ error: "Sparki kon nu geen voedingsbegeleiding maken" });
      return;
    }

    res.json({ guidance: { level, intro, topics } });
  } catch (err) {
    req.log.error({ err }, "nutrition.guidance failed");
    res.status(500).json({ error: "Sparki is even niet bereikbaar" });
  }
});

export default router;
