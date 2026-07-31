import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  documentAnalysesTable,
  raceExportsTable,
  racePointsTable,
  racesTable,
  type CandidateRacePoint,
  type ExtractedField,
} from "@workspace/db";
import { candidateToInsert } from "../lib/race-points";
import { diffGuidePoints } from "../lib/race-export/guide-diff";
import { requireAuth, getClerkUserId } from "../lib/auth";
// PRODUCTBESLUIT (René, 31-07-2026, correctie op ROUTE_PAKKET_01): algemene
// documentupload/-analyse blijft race_intel; het aanmaken, koppelen, tonen,
// beheren of exporteren van course points is route_course_points (Compleet).
import {
  requireCommercialFeature,
  resolveEntitlements,
  hasCommercialFeature,
} from "../lib/entitlements";
import {
  analyzeDocument,
  applyAnswers,
  fieldsToRacePatch,
  isSupportedMediaType,
} from "../engines/document-analysis";

const router = Router();

// Zonder route_course_points wordt kandidaat-puntinformatie uit een analyse
// niet inhoudelijk teruggegeven: de lijst is leeg en pointsLocked zegt eerlijk
// waarom. Overige (niet-puntgebonden) wedstrijdinformatie blijft volledig.
type AnalysisRow = typeof documentAnalysesTable.$inferSelect;
function maskAnalysisPoints<T extends AnalysisRow>(
  row: T,
  pointsEntitled: boolean,
): T & { pointsLocked: boolean } {
  if (pointsEntitled) return { ...row, pointsLocked: false };
  return { ...row, candidatePoints: [], pointsLocked: true };
}

async function coursePointsEntitled(clerkId: string): Promise<boolean> {
  const resolved = await resolveEntitlements(clerkId);
  return hasCommercialFeature(resolved, "route_course_points");
}

// Strip an optional data-URL prefix so the client may send either raw base64 or
// a full "data:application/pdf;base64,...." string.
function stripDataUrl(input: string): string {
  const comma = input.indexOf(",");
  return input.startsWith("data:") && comma !== -1
    ? input.slice(comma + 1)
    : input;
}

// GET /api/document-analyses — recent analyses, newest first.
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  try {
    const rows = await db
      .select()
      .from(documentAnalysesTable)
      .where(eq(documentAnalysesTable.clerkId, clerkId))
      .orderBy(desc(documentAnalysesTable.createdAt))
      .limit(limit);
    const entitled = await coursePointsEntitled(clerkId);
    res.json({ analyses: rows.map((r) => maskAnalysisPoints(r, entitled)) });
  } catch (err) {
    req.log.error({ err }, "documentAnalyses.list failed");
    res.status(500).json({ error: "Kon documenten niet laden" });
  }
});

// GET /api/document-analyses/:id — single analysis (owner only).
router.get("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [row] = await db
      .select()
      .from(documentAnalysesTable)
      .where(
        and(
          eq(documentAnalysesTable.id, id),
          eq(documentAnalysesTable.clerkId, clerkId),
        ),
      );
    if (!row) {
      res.status(404).json({ error: "Document niet gevonden" });
      return;
    }
    res.json({
      analysis: maskAnalysisPoints(row, await coursePointsEntitled(clerkId)),
    });
  } catch (err) {
    req.log.error({ err }, "documentAnalyses.get failed");
    res.status(500).json({ error: "Kon document niet laden" });
  }
});

// POST /api/document-analyses — upload + analyse a document.
//   body: { fileName, mediaType, data (base64, optionally data-URL) }
// Real extraction only; nothing is faked. A failure is recorded honestly with
// status "failed" so the athlete sees what went wrong.
router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const fileName =
    typeof body.fileName === "string" && body.fileName.trim()
      ? body.fileName.trim()
      : null;
  const mediaType =
    typeof body.mediaType === "string" ? body.mediaType.trim() : "";
  const data = typeof body.data === "string" ? stripDataUrl(body.data) : "";

  if (!fileName) {
    res.status(400).json({ error: "fileName is verplicht" });
    return;
  }
  if (!isSupportedMediaType(mediaType)) {
    res
      .status(400)
      .json({ error: "Alleen PDF of afbeelding (PNG/JPG) wordt ondersteund" });
    return;
  }
  if (!data) {
    res.status(400).json({ error: "Bestandsinhoud ontbreekt" });
    return;
  }

  try {
    const result = await analyzeDocument(mediaType, data);
    const [row] = await db
      .insert(documentAnalysesTable)
      .values({
        clerkId,
        fileName,
        mediaType,
        status: "analyzed",
        documentKind: result.documentKind,
        summary: result.summary,
        extractedFields: result.extractedFields,
        foundFields: result.foundFields,
        missingFields: result.missingFields,
        followUpQuestions: result.followUpQuestions,
        sourcePages: result.sourcePages,
        candidatePoints: result.candidatePoints,
      })
      .returning();
    res.status(201).json({
      analysis: maskAnalysisPoints(row!, await coursePointsEntitled(clerkId)),
    });
  } catch (err) {
    req.log.error({ err }, "documentAnalyses.analyze failed");
    // Record the failed attempt honestly so the user knows it didn't work.
    try {
      const [row] = await db
        .insert(documentAnalysesTable)
        .values({
          clerkId,
          fileName,
          mediaType,
          status: "failed",
          errorMessage:
            "Sparki kon dit document niet lezen. Probeer een duidelijkere scan of een ander bestand.",
        })
        .returning();
      // Zelfde contractvorm als het succespad: ook een failed record gaat
      // door de maskerfunctie (uniform pointsLocked-veld).
      res.status(201).json({
        analysis: maskAnalysisPoints(row!, await coursePointsEntitled(clerkId)),
      });
    } catch (err2) {
      req.log.error({ err: err2 }, "documentAnalyses.failed-record failed");
      res.status(500).json({ error: "Kon document niet verwerken" });
    }
  }
});

// POST /api/document-analyses/:id/answers — answer Sparki's follow-up questions.
//   body: { answers: { <fieldKey>: <value> } }
router.post("/:id/answers", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const rawAnswers =
    body.answers && typeof body.answers === "object"
      ? (body.answers as Record<string, unknown>)
      : {};
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawAnswers)) {
    if (typeof v === "string") answers[k] = v;
  }

  try {
    const [existing] = await db
      .select()
      .from(documentAnalysesTable)
      .where(
        and(
          eq(documentAnalysesTable.id, id),
          eq(documentAnalysesTable.clerkId, clerkId),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Document niet gevonden" });
      return;
    }

    const current =
      (existing.extractedFields as Record<string, ExtractedField> | null) ?? {};
    const merged = applyAnswers(current, answers);

    const [row] = await db
      .update(documentAnalysesTable)
      .set({
        extractedFields: merged.extractedFields,
        foundFields: merged.foundFields,
        missingFields: merged.missingFields,
        followUpQuestions: merged.followUpQuestions,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documentAnalysesTable.id, id),
          eq(documentAnalysesTable.clerkId, clerkId),
        ),
      )
      .returning();
    res.json({
      analysis: maskAnalysisPoints(row!, await coursePointsEntitled(clerkId)),
    });
  } catch (err) {
    req.log.error({ err }, "documentAnalyses.answers failed");
    res.status(500).json({ error: "Kon antwoorden niet opslaan" });
  }
});

// POST /api/document-analyses/:id/link — couple this analysis to a race in the
// agenda, and enrich that race with the fields we confidently extracted (never
// overwriting an existing non-empty value).
// Compleet-poort (productbesluit 31-07-2026): koppelen maakt race_points aan
// en valt daarmee onder route_course_points. Gratis/Go krijgt hier 403 en er
// wordt zonder recht nooit een (verborgen) punt aangemaakt.
router.post("/:id/link", requireAuth, requireCommercialFeature("route_course_points"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const body = (req.body ?? {}) as Record<string, unknown>;
  const raceId = Number(body.raceId);
  if (!Number.isInteger(id) || !Number.isInteger(raceId)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }

  try {
    const [analysis] = await db
      .select()
      .from(documentAnalysesTable)
      .where(
        and(
          eq(documentAnalysesTable.id, id),
          eq(documentAnalysesTable.clerkId, clerkId),
        ),
      );
    if (!analysis) {
      res.status(404).json({ error: "Document niet gevonden" });
      return;
    }

    const [race] = await db
      .select()
      .from(racesTable)
      .where(and(eq(racesTable.id, raceId), eq(racesTable.clerkId, clerkId)));
    if (!race) {
      res.status(404).json({ error: "Wedstrijd niet gevonden" });
      return;
    }

    // Enrich the race only where it's currently empty.
    const fields =
      (analysis.extractedFields as Record<string, ExtractedField> | null) ?? {};
    const patch = fieldsToRacePatch(fields);
    const raceUpdate: Record<string, unknown> = {};
    if (patch.startTime && !race.startTime)
      raceUpdate.startTime = patch.startTime;
    if (patch.location && !race.location) raceUpdate.location = patch.location;
    if (patch.distanceKm && !race.distanceKm)
      raceUpdate.distanceKm = patch.distanceKm;
    if (patch.course && !race.course) raceUpdate.course = patch.course;

    if (Object.keys(raceUpdate).length > 0) {
      raceUpdate.updatedAt = new Date();
      await db
        .update(racesTable)
        .set(raceUpdate)
        .where(and(eq(racesTable.id, raceId), eq(racesTable.clerkId, clerkId)));
    }

    // Kandidaat-wedstrijdpunten uit de gids → race_points met status
    // "voorgesteld". Idempotent: als deze analyse al punten voor deze
    // wedstrijd aanleverde, worden er geen dubbelen bijgezet. Heeft de
    // wedstrijd al punten uit een EERDERE gids, dan draait de gids-diff:
    // gewijzigde actieve punten vragen herbevestiging (nooit automatisch
    // overschreven), alleen echt nieuwe kandidaten komen erbij als voorstel,
    // en eerdere exporten worden als "verouderd" gemarkeerd.
    const candidates = Array.isArray(analysis.candidatePoints)
      ? (analysis.candidatePoints as CandidateRacePoint[])
      : [];
    let proposedPoints = 0;
    let reconfirmPoints = 0;
    if (candidates.length > 0) {
      const fromThisAnalysis = await db
        .select({ id: racePointsTable.id })
        .from(racePointsTable)
        .where(
          and(
            eq(racePointsTable.raceId, raceId),
            eq(racePointsTable.sourceAnalysisId, id),
          ),
        )
        .limit(1);
      if (fromThisAnalysis.length === 0) {
        const existingPoints = await db
          .select()
          .from(racePointsTable)
          .where(eq(racePointsTable.raceId, raceId));
        if (existingPoints.length === 0) {
          const values = candidates.map((c) =>
            candidateToInsert(c, {
              raceId,
              clerkId,
              analysisId: id,
              fileName: analysis.fileName,
            }),
          );
          await db.insert(racePointsTable).values(values);
          proposedPoints = values.length;
        } else {
          const diff = diffGuidePoints(existingPoints, candidates, analysis.fileName);
          if (diff.newCandidates.length > 0) {
            const values = diff.newCandidates.map((c) =>
              candidateToInsert(c, {
                raceId,
                clerkId,
                analysisId: id,
                fileName: analysis.fileName,
              }),
            );
            await db.insert(racePointsTable).values(values);
            proposedPoints = values.length;
          }
          for (const u of diff.updateProposals) {
            await db
              .update(racePointsTable)
              .set({
                raceKm: u.raceKm,
                description: u.description,
                sourceAnalysisId: id,
                sourceFile: analysis.fileName,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(racePointsTable.id, u.pointId),
                  eq(racePointsTable.raceId, raceId),
                  eq(racePointsTable.status, "voorgesteld"),
                ),
              );
          }
          const flagged = [...diff.reconfirm, ...diff.disappeared];
          for (const f of flagged) {
            await db
              .update(racePointsTable)
              .set({
                needsReconfirm: true,
                reviewNote: f.note,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(racePointsTable.id, f.pointId),
                  eq(racePointsTable.raceId, raceId),
                ),
              );
          }
          reconfirmPoints = flagged.length;
          // Wijzigt de nieuwe gids iets (nieuw, aangepast of verdwenen)?
          // Dan zijn eerder gemaakte exportbestanden ingehaald.
          if (proposedPoints > 0 || flagged.length > 0 || diff.updateProposals.length > 0) {
            await db
              .update(raceExportsTable)
              .set({
                status: "verouderd",
                staleReason: `Nieuwe technische gids gekoppeld (${analysis.fileName}).`,
              })
              .where(
                and(
                  eq(raceExportsTable.raceId, raceId),
                  eq(raceExportsTable.status, "actueel"),
                ),
              );
          }
        }
      }
    }

    const [row] = await db
      .update(documentAnalysesTable)
      .set({ linkedRaceId: raceId, updatedAt: new Date() })
      .where(
        and(
          eq(documentAnalysesTable.id, id),
          eq(documentAnalysesTable.clerkId, clerkId),
        ),
      )
      .returning();
    res.json({
      analysis: row,
      enriched: Object.keys(raceUpdate),
      proposedPoints,
      reconfirmPoints,
    });
  } catch (err) {
    req.log.error({ err }, "documentAnalyses.link failed");
    res.status(500).json({ error: "Kon document niet koppelen" });
  }
});

// DELETE /api/document-analyses/:id — remove an analysis (owner only).
router.delete("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    await db
      .delete(documentAnalysesTable)
      .where(
        and(
          eq(documentAnalysesTable.id, id),
          eq(documentAnalysesTable.clerkId, clerkId),
        ),
      );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "documentAnalyses.delete failed");
    res.status(500).json({ error: "Kon document niet verwijderen" });
  }
});

export default router;
