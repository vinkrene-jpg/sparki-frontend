import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  nutritionHydrationLogsTable,
  nutritionContexts,
  athleteProfilesTable,
  type NutritionContext,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { analyzeNutritionLog } from "../lib/nutrition-rules";
import { persistObservation } from "../engines/coaching";
import { buildAthleteContext, systemPrompt } from "../lib/athlete-context";
import {
  normalizeMediaType,
  uploadMaterialPhoto,
  streamMaterialPhoto,
  analyzeMaterial,
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
    if (photos.length > 0) {
      try {
        const noteParts = [
          strOrNull(body.notes),
          strOrNull(body.preTrainingFood) &&
            `Voor de training at ik: ${strOrNull(body.preTrainingFood)}`,
          strOrNull(body.postTrainingFood) &&
            `Na de training at ik: ${strOrNull(body.postTrainingFood)}`,
        ].filter((p): p is string => !!p);
        photoAdvice = await analyzeMaterial({
          category: MEAL_CATEGORY,
          photos,
          userNote: noteParts.join(". ") || null,
          athleteHint: `Deze maaltijd/dit eten is gelogd ${CONTEXT_HINTS[context] ?? "vandaag"}.`,
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
    }

    res.status(201).json({
      log,
      flagged: observations.length,
      photoAdvice,
      photoAdviceFailed,
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
    await db
      .delete(nutritionHydrationLogsTable)
      .where(
        and(
          eq(nutritionHydrationLogsTable.id, id),
          eq(nutritionHydrationLogsTable.clerkId, clerkId),
        ),
      );
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
        discipline: athleteProfilesTable.discipline,
      })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));

    const age =
      athlete?.birthYear != null
        ? new Date().getFullYear() - athlete.birthYear
        : null;
    const isYouth = age != null && age < YOUTH_AGE_CUTOFF;
    const level: "youth" | "adult" = isYouth ? "youth" : "adult";

    const [context, system] = await Promise.all([
      buildAthleteContext(clerkId),
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
