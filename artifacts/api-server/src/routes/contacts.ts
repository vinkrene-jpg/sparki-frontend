// SPARKI_BUILD_01 F10 (PD-3) — API voor de centrale contacten- en relatielaag.
//
// Bevoegd-only: dit is beheerfunctionaliteit (geen brede exposure). We volgen
// exact het bestaande adminpatroon (isAdmin + SPARKI_ADMIN_IDS). Er is
// bewust GEEN UI in scope — deze router levert alleen de server-kant.
//
// Endpoints:
//   POST   /              contact aanmaken (met dedupe-weigering bij duplicaat)
//   POST   /relations     relatie starten
//   POST   /relations/:id/end   relatie beëindigen (endedAt, historisch)
//   GET    /:id/relations  relaties van een contact (actief + historisch)
//   GET    /review        beoordelingslijst (open twijfelgevallen)
//   POST   /review/:id/decide  besluit vastleggen (samenvoegen | apart houden)

import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  contactsTable,
  contactRelationsTable,
  contactMergeReviewTable,
  contactMergeDecisions,
  type ContactKind,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { isAdmin } from "../lib/flags";
import {
  findOrCreateContact,
  startRelation,
  endRelation,
  readRelations,
  isContactKind,
  isRelationType,
} from "../lib/contacts";

const router = Router();

function requireAdmin(
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof requireAuth>[1],
  next: Parameters<typeof requireAuth>[2],
) {
  const clerkId = getClerkUserId(req);
  if (!clerkId || !isAdmin(clerkId)) {
    res.status(403).json({ error: "Alleen voor beheer." });
    return;
  }
  next();
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function parseId(v: unknown): number | null {
  const n = Number(String(v));
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseKinds(v: unknown): ContactKind[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isContactKind);
}

// ── Contact aanmaken (met dedupe) ─────────────────────────────────────────────
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const displayName = str(req.body?.displayName);
    if (!displayName) {
      res.status(400).json({ error: "Naam van het contact is verplicht." });
      return;
    }
    const result = await db.transaction((tx) =>
      findOrCreateContact(
        {
          clerkId: str(req.body?.clerkId),
          email: str(req.body?.email),
          displayName,
          phone: str(req.body?.phone),
          kindTags: parseKinds(req.body?.kindTags),
          sourceNote: str(req.body?.sourceNote),
          source: "api",
          sourceId: str(req.body?.sourceId),
        },
        tx,
      ),
    );

    if (result.status === "duplicate_rejected") {
      // Duidelijk duplicaat op aantoonbare identiteit: 409 met uitleg en het
      // bestaande contact benoemd.
      res.status(409).json({
        error: result.reason,
        existingContact: result.existing,
      });
      return;
    }
    if (result.status === "created_needs_review") {
      res.status(201).json({
        contact: result.contact,
        review: {
          message:
            "Contact aangemaakt, maar op de beoordelingslijst gezet: mogelijk een duplicaat.",
          candidateContactIds: result.candidateContactIds,
          reason: result.reason,
        },
      });
      return;
    }
    res
      .status(result.status === "created" ? 201 : 200)
      .json({ contact: result.contact, status: result.status });
  } catch (err) {
    req.log.error({ err }, "contact create failed");
    res.status(500).json({ error: "Contact aanmaken is niet gelukt." });
  }
});

// ── Relatie starten ────────────────────────────────────────────────────────────
router.post("/relations", requireAuth, requireAdmin, async (req, res) => {
  try {
    const fromContactId = parseId(req.body?.fromContactId);
    const toContactId = parseId(req.body?.toContactId);
    const relationType = req.body?.relationType;
    if (!fromContactId || !toContactId) {
      res.status(400).json({ error: "fromContactId en toContactId zijn verplicht." });
      return;
    }
    if (fromContactId === toContactId) {
      res.status(400).json({ error: "Een contact kan geen relatie met zichzelf hebben." });
      return;
    }
    if (!isRelationType(relationType)) {
      res.status(400).json({ error: "Onbekend relatietype (buiten de negen toegestane)." });
      return;
    }
    // Beide contacten moeten bestaan.
    const found = await db
      .select({ id: contactsTable.id })
      .from(contactsTable)
      .where(eq(contactsTable.id, fromContactId));
    const found2 = await db
      .select({ id: contactsTable.id })
      .from(contactsTable)
      .where(eq(contactsTable.id, toContactId));
    if (found.length === 0 || found2.length === 0) {
      res.status(404).json({ error: "Contact niet gevonden." });
      return;
    }
    const startedAt = str(req.body?.startedAt);
    const row = await startRelation({
      fromContactId,
      toContactId,
      relationType,
      startedAt: startedAt ? new Date(startedAt) : undefined,
      sourceNote: str(req.body?.sourceNote),
    });
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "start relation failed");
    res.status(500).json({ error: "Relatie starten is niet gelukt." });
  }
});

// ── Relatie beëindigen (historisch) ────────────────────────────────────────────
router.post("/relations/:id/end", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Ongeldig relatie-id." });
      return;
    }
    const endedAt = str(req.body?.endedAt);
    const row = await endRelation(id, endedAt ? new Date(endedAt) : new Date());
    if (!row) {
      res.status(404).json({ error: "Actieve relatie niet gevonden." });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "end relation failed");
    res.status(500).json({ error: "Relatie beëindigen is niet gelukt." });
  }
});

// ── Relaties van een contact (actief + historisch) ─────────────────────────────
router.get("/:id/relations", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Ongeldig contact-id." });
      return;
    }
    const activeOnly = req.query.activeOnly === "true";
    const relations = await readRelations(id, { activeOnly });
    res.json(relations);
  } catch (err) {
    req.log.error({ err }, "read relations failed");
    res.status(500).json({ error: "Relaties ophalen is niet gelukt." });
  }
});

// ── Beoordelingslijst inzien ───────────────────────────────────────────────────
router.get("/review", requireAuth, requireAdmin, async (req, res) => {
  try {
    const onlyOpen = req.query.status !== "all";
    const rows = await db
      .select()
      .from(contactMergeReviewTable)
      .where(onlyOpen ? eq(contactMergeReviewTable.status, "open") : undefined)
      .orderBy(desc(contactMergeReviewTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "read review list failed");
    res.status(500).json({ error: "Beoordelingslijst ophalen is niet gelukt." });
  }
});

// ── Besluit vastleggen: samenvoegen (expliciet, met audit) of apart houden ─────
router.post("/review/:id/decide", requireAuth, requireAdmin, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Ongeldig review-id." });
      return;
    }
    const decision = req.body?.decision;
    if (!(contactMergeDecisions as readonly string[]).includes(decision)) {
      res.status(400).json({
        error: "Besluit moet 'samengevoegd' of 'apart_gehouden' zijn.",
      });
      return;
    }
    const note = str(req.body?.decisionNote);
    const targetContactId = parseId(req.body?.decidedTargetContactId);

    const result = await db.transaction(async (tx) => {
      const [review] = await tx
        .select()
        .from(contactMergeReviewTable)
        .where(eq(contactMergeReviewTable.id, id))
        .for("update");
      if (!review) return { notFound: true as const };
      if (review.status === "besloten") return { already: true as const };

      if (decision === "samengevoegd") {
        // Samenvoegen is een EXPLICIETE actie: er MOET een doelcontact zijn dat
        // behouden blijft. We voegen niet automatisch samen — dit gebeurt pas
        // hier, op menselijk besluit. Het samengevoegde (bron)contact wordt
        // NIET verwijderd; we verplaatsen zijn actieve relaties naar het
        // doelcontact en markeren de review. Dataverlies wordt vermeden.
        if (!targetContactId) {
          return { needTarget: true as const };
        }
        const candidates = review.candidateContactIds ?? [];
        const mergeSourceId = review.contactId;
        // Verplaats relaties van het broncontact naar het doelcontact (alleen
        // als er een apart broncontact is en het niet het doel zelf is).
        if (mergeSourceId && mergeSourceId !== targetContactId) {
          await tx
            .update(contactRelationsTable)
            .set({ fromContactId: targetContactId, updatedAt: new Date() })
            .where(eq(contactRelationsTable.fromContactId, mergeSourceId));
          await tx
            .update(contactRelationsTable)
            .set({ toContactId: targetContactId, updatedAt: new Date() })
            .where(eq(contactRelationsTable.toContactId, mergeSourceId));
        }
        await tx
          .update(contactMergeReviewTable)
          .set({
            status: "besloten",
            decision: "samengevoegd",
            decidedTargetContactId: targetContactId,
            decidedByClerkId: clerkId,
            decidedAt: new Date(),
            decisionNote: note,
            updatedAt: new Date(),
          })
          .where(eq(contactMergeReviewTable.id, id));
        return { merged: true as const, targetContactId, candidates };
      }

      // apart_gehouden: twee verschillende mensen. Niets samenvoegen.
      await tx
        .update(contactMergeReviewTable)
        .set({
          status: "besloten",
          decision: "apart_gehouden",
          decidedByClerkId: clerkId,
          decidedAt: new Date(),
          decisionNote: note,
          updatedAt: new Date(),
        })
        .where(eq(contactMergeReviewTable.id, id));
      return { keptApart: true as const };
    });

    if ("notFound" in result) {
      res.status(404).json({ error: "Beoordelingsgeval niet gevonden." });
      return;
    }
    if ("already" in result) {
      res.status(409).json({ error: "Dit geval is al besloten." });
      return;
    }
    if ("needTarget" in result) {
      res.status(400).json({
        error:
          "Samenvoegen vereist een expliciet doelcontact (decidedTargetContactId).",
      });
      return;
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    req.log.error({ err }, "decide review failed");
    res.status(500).json({ error: "Besluit vastleggen is niet gelukt." });
  }
});

export default router;
