import { Router } from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  buildRatingsTable,
  buildRatingSubjectTypes,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";

// Sterren-beoordelingen op onderdelen die Sparki bouwt (routes, planweken,
// dagadviezen, …).
//
// - Idempotent: één beoordeling per (gebruiker, onderwerp-type, onderwerp-id).
//   Een nieuwe beoordeling ververst de HELE rij — score én toelichting —
//   zodat er nooit een verouderde toelichting bij een nieuwe score blijft
//   staan (zelfde conventie als de analyse-feedbacklus).
// - Register: alleen onderwerp-typen uit het vaste register worden
//   geaccepteerd; uitbreiden gebeurt in de databanklaag, nooit ad hoc.
// - Privacy: een gebruiker leest uitsluitend zijn EIGEN beoordelingen;
//   aggregatie gebeurt alleen in de beheer-/auditlaag.

const router = Router();

const SUBJECT_TYPES = buildRatingSubjectTypes as readonly string[];
const MAX_COMMENT = 280;
const MAX_SUBJECT_ID = 120;

// Eigen beoordelingen opvragen voor één onderwerp-type (optioneel beperkt tot
// specifieke ids via ?subjectIds=a,b,c) — zo kan de UI de gekozen sterren
// tonen zonder per kaart een aparte call.
router.get("/", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req);
    if (!clerkId) return res.status(401).json({ error: "Niet ingelogd" });

    const subjectType = String(req.query.subjectType ?? "");
    if (!SUBJECT_TYPES.includes(subjectType)) {
      return res.status(400).json({ error: "Onbekend onderwerp-type" });
    }
    const idsRaw = String(req.query.subjectIds ?? "").trim();
    const subjectIds = idsRaw
      ? idsRaw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100)
      : [];

    const where = subjectIds.length
      ? and(
          eq(buildRatingsTable.clerkId, clerkId),
          eq(buildRatingsTable.subjectType, subjectType),
          inArray(buildRatingsTable.subjectId, subjectIds),
        )
      : and(
          eq(buildRatingsTable.clerkId, clerkId),
          eq(buildRatingsTable.subjectType, subjectType),
        );

    const rows = await db
      .select({
        subjectType: buildRatingsTable.subjectType,
        subjectId: buildRatingsTable.subjectId,
        rating: buildRatingsTable.rating,
        comment: buildRatingsTable.comment,
        updatedAt: buildRatingsTable.updatedAt,
      })
      .from(buildRatingsTable)
      .where(where)
      .limit(200);

    return res.json({ ratings: rows });
  } catch (err) {
    console.error("[build-ratings] lezen mislukt:", err);
    return res
      .status(500)
      .json({ error: "Beoordelingen konden niet worden gelezen" });
  }
});

// Beoordeling opslaan of overschrijven (idempotente upsert).
router.put("/", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req);
    if (!clerkId) return res.status(401).json({ error: "Niet ingelogd" });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const subjectType = String(body.subjectType ?? "");
    const subjectId = String(body.subjectId ?? "").trim();
    const rating = Number(body.rating);

    if (!SUBJECT_TYPES.includes(subjectType)) {
      return res.status(400).json({ error: "Onbekend onderwerp-type" });
    }
    if (!subjectId || subjectId.length > MAX_SUBJECT_ID) {
      return res.status(400).json({ error: "Ongeldig onderwerp-id" });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Score moet 1 t/m 5 sterren zijn" });
    }
    // Toelichting is ALTIJD optioneel; leeg = null (geen lege strings bewaren).
    const rawComment =
      typeof body.comment === "string" ? body.comment.trim() : "";
    const comment = rawComment ? rawComment.slice(0, MAX_COMMENT) : null;

    const [row] = await db
      .insert(buildRatingsTable)
      .values({ clerkId, subjectType, subjectId, rating, comment })
      .onConflictDoUpdate({
        target: [
          buildRatingsTable.clerkId,
          buildRatingsTable.subjectType,
          buildRatingsTable.subjectId,
        ],
        // Volledige rij verversen — óók de toelichting, zodat een oude
        // toelichting nooit bij een nieuwe score blijft hangen.
        set: { rating, comment, updatedAt: new Date() },
      })
      .returning({
        subjectType: buildRatingsTable.subjectType,
        subjectId: buildRatingsTable.subjectId,
        rating: buildRatingsTable.rating,
        comment: buildRatingsTable.comment,
        updatedAt: buildRatingsTable.updatedAt,
      });

    return res.json({ rating: row });
  } catch (err) {
    console.error("[build-ratings] opslaan mislukt:", err);
    return res
      .status(500)
      .json({ error: "Beoordeling kon niet worden opgeslagen" });
  }
});

export default router;
