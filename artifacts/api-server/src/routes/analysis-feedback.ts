import { Router } from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  aiObservationsTable,
  analysisFeedbackTable,
  analysisFeedbackVerdicts,
  analysisFeedbackSubjectTypes,
  analysisFeedbackReasonCodes,
  analysisFeedbackActionKinds,
  type AnalysisFeedbackContext,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { hasCoachAccess, coachSharingLevel } from "../lib/sharing";
import { SPARKI_ENGINE_VERSION } from "../lib/engine-version";

// Feedbacklus op analyses en adviezen (Afbouwgolf 4).
//
// - Idempotent: één oordeel per (actor, subjectType, subjectKey); een nieuw
//   oordeel over hetzelfde onderwerp vervangt het vorige (upsert).
// - Kwaliteitsregistratie: bij ieder oordeel wordt de berekeningscontext
//   (engine, regel, versie, zekerheid, ontbrekende data) als momentopname
//   meegeschreven — voor observaties automatisch uit de databank.
// - Toestemmingsgate: een coach mag alleen feedback geven over een sporter met
//   een geaccepteerde koppeling én sharing ≠ "none" (fail-closed).
// - VEILIGHEID: feedback wordt alleen geregistreerd en geaggregeerd; er is
//   bewust géén schrijfpad dat op basis hiervan analyseregels of drempels
//   aanpast.

const router = Router();

const VERDICTS = analysisFeedbackVerdicts as readonly string[];
const SUBJECT_TYPES = analysisFeedbackSubjectTypes as readonly string[];
const REASON_CODES = analysisFeedbackReasonCodes as readonly string[];
const ACTION_KINDS = analysisFeedbackActionKinds as readonly string[];

// Bouw de contextmomentopname. Voor observaties komt de verantwoording direct
// uit de opgeslagen rij; voor andere onderwerpen levert de client wat bekend is
// (alleen witgelijste velden worden overgenomen — nooit vrije inhoud).
async function buildContext(
  subjectType: string,
  subjectKey: string,
  clientContext: unknown,
): Promise<AnalysisFeedbackContext | null> {
  if (subjectType === "observation") {
    const id = Number(subjectKey);
    if (Number.isInteger(id)) {
      const [row] = await db
        .select()
        .from(aiObservationsTable)
        .where(eq(aiObservationsTable.id, id))
        .limit(1);
      if (row) {
        return {
          engine: row.engine ?? null,
          ruleKey: row.ruleKey ?? null,
          engineVersion: row.engineVersion ?? null,
          confidenceScore:
            row.confidenceScore != null ? Number(row.confidenceScore) : null,
          confidenceLevel: row.confidence ?? null,
          severity: row.severity ?? null,
          category: row.category ?? null,
          missingData: Array.isArray(row.missingData) ? row.missingData : [],
          computedAt: row.createdAt
            ? new Date(row.createdAt).toISOString()
            : null,
        };
      }
    }
    return null;
  }
  const c = (clientContext ?? {}) as Record<string, unknown>;
  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : null;
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  return {
    engine: str(c.engine),
    ruleKey: str(c.ruleKey),
    engineVersion: str(c.engineVersion) ?? SPARKI_ENGINE_VERSION,
    confidenceScore: num(c.confidenceScore),
    confidenceLevel: str(c.confidenceLevel),
    severity: str(c.severity),
    category: str(c.category),
    missingData: Array.isArray(c.missingData)
      ? c.missingData
          .filter((m): m is string => typeof m === "string")
          .map((m) => m.slice(0, 120))
          .slice(0, 20)
      : [],
    computedAt: str(c.computedAt),
  };
}

// Verifieert dat de observatie bestaat en bij deze sporter hoort.
async function observationBelongsTo(
  subjectKey: string,
  athleteClerkId: string,
): Promise<boolean> {
  const id = Number(subjectKey);
  if (!Number.isInteger(id)) return false;
  const [row] = await db
    .select({ clerkId: aiObservationsTable.clerkId })
    .from(aiObservationsTable)
    .where(eq(aiObservationsTable.id, id))
    .limit(1);
  return row?.clerkId === athleteClerkId;
}

// ── POST /api/analysis-feedback ──────────────────────────────────────────────
// Registreer of vervang een oordeel over een analyse/advies/voorstel.
router.post("/", requireAuth, async (req, res) => {
  const actorClerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const subjectType = String(body.subjectType ?? "");
  const subjectKey = String(body.subjectKey ?? "").slice(0, 200);
  const verdict = String(body.verdict ?? "");
  const athleteClerkId = body.athleteClerkId
    ? String(body.athleteClerkId)
    : actorClerkId;

  if (!SUBJECT_TYPES.includes(subjectType) || !subjectKey) {
    res.status(400).json({ error: "Ongeldig onderwerp." });
    return;
  }
  if (!VERDICTS.includes(verdict)) {
    res.status(400).json({ error: "Ongeldig oordeel." });
    return;
  }

  const reasonCode = body.reasonCode ? String(body.reasonCode) : null;
  if (reasonCode && !REASON_CODES.includes(reasonCode)) {
    res.status(400).json({ error: "Ongeldige reden." });
    return;
  }
  const reasonText = body.reasonText
    ? String(body.reasonText).trim().slice(0, 500) || null
    : null;
  // Bij "onjuist" is een reden verplicht — anders is de kwaliteitsregistratie leeg.
  if (verdict === "onjuist" && !reasonCode && !reasonText) {
    res.status(400).json({ error: "Geef aan wat er niet klopt (reden)." });
    return;
  }
  const actionKind = body.actionKind ? String(body.actionKind) : null;
  if (actionKind && !ACTION_KINDS.includes(actionKind)) {
    res.status(400).json({ error: "Ongeldige actie." });
    return;
  }

  try {
    // Toestemmingsgate: over andermans conclusies alleen als gekoppelde coach
    // met sharing ≠ none.
    let actorRole = "athlete";
    if (athleteClerkId !== actorClerkId) {
      const linked = await hasCoachAccess(actorClerkId, athleteClerkId);
      const level = linked ? await coachSharingLevel(athleteClerkId) : "none";
      if (!linked || level === "none") {
        res.status(403).json({ error: "Geen toegang tot deze sporter." });
        return;
      }
      actorRole = "coach";
    }

    // Ownership: een observatie-oordeel moet over een bestaande observatie van
    // deze sporter gaan (nooit over die van een ander).
    if (
      subjectType === "observation" &&
      !(await observationBelongsTo(subjectKey, athleteClerkId))
    ) {
      res.status(404).json({ error: "Onderwerp niet gevonden." });
      return;
    }

    const context = await buildContext(subjectType, subjectKey, body.context);

    const [row] = await db
      .insert(analysisFeedbackTable)
      .values({
        clerkId: athleteClerkId,
        actorClerkId,
        actorRole,
        subjectType,
        subjectKey,
        verdict,
        reasonCode,
        reasonText,
        actionKind,
        context,
      })
      .onConflictDoUpdate({
        target: [
          analysisFeedbackTable.actorClerkId,
          analysisFeedbackTable.subjectType,
          analysisFeedbackTable.subjectKey,
        ],
        set: {
          verdict,
          reasonCode,
          reasonText,
          actionKind,
          context,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.status(201).json({ feedback: row });
  } catch (err) {
    req.log.error({ err }, "analysis-feedback.post failed");
    res.status(500).json({ error: "Feedback opslaan mislukt." });
  }
});

// ── GET /api/analysis-feedback ───────────────────────────────────────────────
// Eigen oordelen van de actor, optioneel gefilterd op type en sleutels — zodat
// de UI toont wat al beoordeeld is (idempotentie zichtbaar maken).
router.get("/", requireAuth, async (req, res) => {
  const actorClerkId = getClerkUserId(req)!;
  const subjectType = req.query.subjectType
    ? String(req.query.subjectType)
    : null;
  const keys = req.query.subjectKeys
    ? String(req.query.subjectKeys).split(",").filter(Boolean).slice(0, 100)
    : null;
  try {
    const conds = [eq(analysisFeedbackTable.actorClerkId, actorClerkId)];
    if (subjectType && SUBJECT_TYPES.includes(subjectType)) {
      conds.push(eq(analysisFeedbackTable.subjectType, subjectType));
    }
    if (keys && keys.length > 0) {
      conds.push(inArray(analysisFeedbackTable.subjectKey, keys));
    }
    const rows = await db
      .select()
      .from(analysisFeedbackTable)
      .where(and(...conds));
    res.json({ feedback: rows });
  } catch (err) {
    req.log.error({ err }, "analysis-feedback.get failed");
    res.status(500).json({ error: "Feedback laden mislukt." });
  }
});

export default router;
