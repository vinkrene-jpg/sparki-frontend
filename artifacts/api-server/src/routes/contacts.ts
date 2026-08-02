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
import { and, desc, eq, isNull, or } from "drizzle-orm";
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

// Markeer een review als samengevoegd (besloten). Gedeeld door de merge-paden.
type MergeTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function markMerged(
  tx: MergeTx,
  reviewId: number,
  targetContactId: number,
  clerkId: string,
  note: string | null,
) {
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
    .where(eq(contactMergeReviewTable.id, reviewId));
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
        // NIET verwijderd; we brengen zijn actieve relaties over naar het
        // doelcontact. Dataverlies wordt vermeden.
        if (!targetContactId) {
          return { needTarget: true as const };
        }
        const candidates = review.candidateContactIds ?? [];
        const mergeSourceId = review.contactId;
        if (!mergeSourceId || mergeSourceId === targetContactId) {
          // Niets over te brengen (geen apart broncontact); alleen markeren.
          await markMerged(tx, id, targetContactId, clerkId, note);
          return { merged: true as const, targetContactId, candidates, moved: 0, ended: 0 };
        }

        // Verliesvrij én conflictvrij samenvoegen. De partial unique index
        // (from,to,type) WHERE ended_at IS NULL verbiedt dubbele ACTIEVE
        // relaties. Blind ombuigen zou botsen (rollback) of een zelfrelatie
        // maken. We doen daarom, ALLEMAAL in deze ene transactie:
        //
        //   1. Beëindig bron↔doel-relaties (zouden na ombuigen een zelfrelatie
        //      worden — nooit toegestaan).
        //   2. Dedupliceer: als broncontact én doelcontact allebei een ACTIEVE
        //      relatie van hetzelfde type met dezelfde tegenpartij hebben, dan
        //      beëindig de BRONrelatie (het doel houdt de zijne) i.p.v. te
        //      verplaatsen — anders botst het op de unique index.
        //   3. Verplaats de resterende relaties (fromContactId, dan
        //      toContactId) naar het doelcontact.
        //
        // Alle beëindigingen en verplaatsingen worden traceerbaar gemaakt in
        // source_note (welke relatie, vanaf welk broncontact, naar welk doel).
        const now = new Date();
        const auditTag = (kind: string) =>
          `F10-merge ${kind}: broncontact #${mergeSourceId} → doelcontact #${targetContactId} (review #${id}, door ${clerkId})`;

        // Alle relaties waarin het broncontact voorkomt.
        const sourceRels = await tx
          .select()
          .from(contactRelationsTable)
          .where(
            or(
              eq(contactRelationsTable.fromContactId, mergeSourceId),
              eq(contactRelationsTable.toContactId, mergeSourceId),
            ),
          );

        // Actieve relaties van het DOELcontact — sleutel: type + tegenpartij +
        // richting — om deduplicatie te bepalen.
        const targetActive = await tx
          .select()
          .from(contactRelationsTable)
          .where(
            and(
              or(
                eq(contactRelationsTable.fromContactId, targetContactId),
                eq(contactRelationsTable.toContactId, targetContactId),
              ),
              isNull(contactRelationsTable.endedAt),
            ),
          );
        // Sleutel van een DOEL-relatie zoals die eruit ZOU zien vanuit het doel.
        const targetKey = new Set(
          targetActive.map((r) => {
            const from = r.fromContactId === targetContactId ? targetContactId : r.fromContactId;
            const to = r.toContactId === targetContactId ? targetContactId : r.toContactId;
            return `${from}|${to}|${r.relationType}`;
          }),
        );

        let moved = 0;
        let ended = 0;
        for (const rel of sourceRels) {
          const otherFrom = rel.fromContactId === mergeSourceId ? targetContactId : rel.fromContactId;
          const otherTo = rel.toContactId === mergeSourceId ? targetContactId : rel.toContactId;

          // 1. Bron↔doel-relatie ⇒ zou zelfrelatie worden ⇒ beëindig i.p.v. buigen.
          if (otherFrom === otherTo) {
            if (rel.endedAt == null) {
              await tx
                .update(contactRelationsTable)
                .set({ endedAt: now, sourceNote: auditTag("zelfrelatie-vermeden, beëindigd"), updatedAt: now })
                .where(eq(contactRelationsTable.id, rel.id));
              ended++;
            }
            continue;
          }

          // 2. Deduplicatie: doel heeft al eenzelfde ACTIEVE relatie ⇒ beëindig
          //    de bronrelatie (alleen als die zelf nog actief is).
          const wouldKey = `${otherFrom}|${otherTo}|${rel.relationType}`;
          if (rel.endedAt == null && targetKey.has(wouldKey)) {
            await tx
              .update(contactRelationsTable)
              .set({ endedAt: now, sourceNote: auditTag("dubbel, bronrelatie beëindigd"), updatedAt: now })
              .where(eq(contactRelationsTable.id, rel.id));
            ended++;
            continue;
          }

          // 3. Verplaats: buig de bron-kant om naar het doelcontact.
          await tx
            .update(contactRelationsTable)
            .set({
              fromContactId: otherFrom,
              toContactId: otherTo,
              sourceNote: auditTag("verplaatst"),
              updatedAt: now,
            })
            .where(eq(contactRelationsTable.id, rel.id));
          moved++;
          // Een verplaatste ACTIEVE relatie telt vanaf nu mee als "doel-actief"
          // zodat een volgende identieke bronrelatie óók wordt gededupliceerd.
          if (rel.endedAt == null) targetKey.add(wouldKey);
        }

        await markMerged(tx, id, targetContactId, clerkId, note);
        return { merged: true as const, targetContactId, candidates, moved, ended };
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
