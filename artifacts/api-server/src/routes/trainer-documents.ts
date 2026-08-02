// SPARKI_BUILD_04 F4 — documenten van de zelfstandige trainer op de GEDEELDE
// werkobjectlaag (BUILD_02). Geen eigen documentmodel: dezelfde tabellen
// (work_objects/work_object_sections/work_object_history), alleen een andere
// scope (ownerTrainerClerkId in plaats van clubId; DB-CHECK dwingt precies
// één scope af).
//
// - Objecttype moet in de rolcatalogus K (zelfstandige_trainer) staan.
// - Plantypen (3c.2) krijgen bij aanmaak automatisch de achttien
//   plansecties; de laatste vier (ai_concept, brondata, onzekerheid,
//   menselijke_bevestiging) zijn de kern en worden nooit weggelaten.
// - Intake als wizard: secties zijn de stappen; per sectie opslaan (met
//   versiecheck) = opslaan per stap; hervatten = object opnieuw openen.
// - Nieuw jaarplan terwijl een vorig jaarplan bestaat ⇒ concept mét bron
//   (copiedFromId + sectie brondata benoemt de bron). Zonder historie ⇒
//   eerlijk leeg, geen verzonnen basis.
// - Trainernotities blijven ongedeeld tenzij de trainer deelt (status
//   "gedeeld" is een expliciete actie); sporterfeedback is van de sporter.

import { Router } from "express";
import { and, desc, eq, asc } from "drizzle-orm";
import {
  db,
  workObjectsTable,
  workObjectSectionsTable,
  workObjectHistoryTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  ROLE_CATALOGS,
  PLAN_TYPES,
  PLAN_SECTIONS,
  isTypeAllowedForRole,
} from "../lib/document-catalog";

const router = Router();

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function loadOwnedObject(objectId: number, trainerClerkId: string) {
  const [obj] = await db
    .select()
    .from(workObjectsTable)
    .where(
      and(
        eq(workObjectsTable.id, objectId),
        eq(workObjectsTable.ownerTrainerClerkId, trainerClerkId),
      ),
    );
  return obj ?? null;
}

// Catalogus opvragen (K + de plansectielijst) — de UI bouwt hier de kiezer op.
router.get("/catalog", requireAuth, (_req, res) => {
  res.json({
    role: "zelfstandige_trainer",
    types: ROLE_CATALOGS.zelfstandige_trainer,
    planTypes: [...PLAN_TYPES].filter((t) =>
      (ROLE_CATALOGS.zelfstandige_trainer as readonly string[]).includes(t),
    ),
    planSections: PLAN_SECTIONS,
  });
});

router.get("/", requireAuth, async (req, res) => {
  const trainerClerkId = getClerkUserId(req)!;
  const objects = await db
    .select()
    .from(workObjectsTable)
    .where(eq(workObjectsTable.ownerTrainerClerkId, trainerClerkId))
    .orderBy(desc(workObjectsTable.updatedAt));
  res.json(objects);
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const objectType = str(req.body?.objectType);
    const title = str(req.body?.title);
    if (!objectType || !title) {
      res.status(400).json({ error: "objectType en title zijn verplicht." });
      return;
    }
    if (!isTypeAllowedForRole("zelfstandige_trainer", objectType)) {
      res.status(400).json({
        error: "Dit documenttype staat niet in de catalogus van de zelfstandige trainer.",
      });
      return;
    }

    // Vorige versie van hetzelfde plantype = eerlijke bron voor het concept.
    // Geen historie ⇒ eerlijk leeg (geen verzonnen basis).
    let sourceObject: typeof workObjectsTable.$inferSelect | null = null;
    if (PLAN_TYPES.has(objectType)) {
      const [prev] = await db
        .select()
        .from(workObjectsTable)
        .where(
          and(
            eq(workObjectsTable.ownerTrainerClerkId, trainerClerkId),
            eq(workObjectsTable.objectType, objectType),
          ),
        )
        .orderBy(desc(workObjectsTable.createdAt))
        .limit(1);
      sourceObject = prev ?? null;
    }

    const result = await db.transaction(async (tx) => {
      const [obj] = await tx
        .insert(workObjectsTable)
        .values({
          ownerTrainerClerkId: trainerClerkId,
          objectType,
          title,
          status: "concept",
          createdByClerkId: trainerClerkId,
          copiedFromId: sourceObject?.id ?? null,
        })
        .returning();

      if (PLAN_TYPES.has(objectType)) {
        // 3c.2: de achttien onderdelen, in vaste volgorde. brondata benoemt
        // de bron als die er is — nooit een verzonnen uitgangssituatie.
        let vorige: { title: string; content: string }[] = [];
        if (sourceObject) {
          vorige = await tx
            .select({
              title: workObjectSectionsTable.title,
              content: workObjectSectionsTable.content,
            })
            .from(workObjectSectionsTable)
            .where(eq(workObjectSectionsTable.objectId, sourceObject.id));
        }
        const vorigeMap = new Map(vorige.map((s) => [s.title, s.content]));
        await tx.insert(workObjectSectionsTable).values(
          PLAN_SECTIONS.map((name, i) => ({
            objectId: obj!.id,
            title: name,
            position: i,
            // Vast onderdeel: gaat mee bij kopiëren; sporterfeedback en
            // trainernotities zijn situatiegebonden en gaan nooit mee.
            vastOnderdeel: name !== "sporterfeedback" && name !== "trainernotities",
            content:
              name === "brondata" && sourceObject
                ? `Basis: vorig ${objectType} “${sourceObject.title}” (#${sourceObject.id}). Overgenomen vaste onderdelen zijn concept en vragen menselijke bevestiging.`
                : sourceObject && name !== "sporterfeedback" && name !== "trainernotities" && name !== "menselijke_bevestiging"
                  ? (vorigeMap.get(name) ?? "")
                  : "",
          })),
        );
      } else if (objectType === "intake") {
        // Intake-wizard: maximaal vijf stappen; per stap opslaan, hervatten
        // kan altijd. Trainer en sporter vullen elk hun eigen deel
        // (ownerClerkId op de sportersectie wordt gezet zodra gekoppeld).
        const stappen = [
          "achtergrond_en_doel",
          "beschikbare_tijd_en_middelen",
          "gezondheid_en_beperkingen",
          "sporter_eigen_deel",
          "afspraken_en_bevestiging",
        ];
        await tx.insert(workObjectSectionsTable).values(
          stappen.map((name, i) => ({
            objectId: obj!.id,
            title: name,
            position: i,
            vastOnderdeel: true,
            content: "",
          })),
        );
      }

      await tx.insert(workObjectHistoryTable).values({
        objectId: obj!.id,
        actorClerkId: trainerClerkId,
        action: "aangemaakt",
        detail: sourceObject ? `concept met bron #${sourceObject.id}` : "leeg concept",
      });
      return obj!;
    });
    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "trainer document create failed");
    res.status(500).json({ error: "Document aanmaken is niet gelukt." });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  const trainerClerkId = getClerkUserId(req)!;
  const obj = await loadOwnedObject(Number(req.params.id), trainerClerkId);
  if (!obj) {
    res.status(404).json({ error: "Document niet gevonden." });
    return;
  }
  const sections = await db
    .select()
    .from(workObjectSectionsTable)
    .where(eq(workObjectSectionsTable.objectId, obj.id))
    .orderBy(asc(workObjectSectionsTable.position));
  res.json({ ...obj, sections });
});

// Sectie bijwerken = wizardstap opslaan. Optimistische versiecheck (409).
router.put("/:id/sections/:sectionId", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const obj = await loadOwnedObject(Number(req.params.id), trainerClerkId);
    if (!obj) {
      res.status(404).json({ error: "Document niet gevonden." });
      return;
    }
    const baseVersion = req.body?.baseVersion;
    const content = typeof req.body?.content === "string" ? req.body.content : null;
    if (content === null || typeof baseVersion !== "number") {
      res.status(400).json({ error: "content en baseVersion zijn verplicht." });
      return;
    }
    const [section] = await db
      .select()
      .from(workObjectSectionsTable)
      .where(
        and(
          eq(workObjectSectionsTable.id, Number(req.params.sectionId)),
          eq(workObjectSectionsTable.objectId, obj.id),
        ),
      );
    if (!section) {
      res.status(404).json({ error: "Onderdeel niet gevonden." });
      return;
    }
    if (section.version !== baseVersion) {
      res.status(409).json({ error: "Dit onderdeel is intussen gewijzigd. Herlaad en probeer opnieuw." });
      return;
    }
    const [row] = await db
      .update(workObjectSectionsTable)
      .set({
        content,
        version: section.version + 1,
        filledByClerkId: trainerClerkId,
        filledAt: new Date(),
      })
      .where(eq(workObjectSectionsTable.id, section.id))
      .returning();
    await db.insert(workObjectHistoryTable).values({
      objectId: obj.id,
      actorClerkId: trainerClerkId,
      action: "deel_ingevuld",
      detail: section.title,
    });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "trainer document section failed");
    res.status(500).json({ error: "Onderdeel opslaan is niet gelukt." });
  }
});

// Delen/afronden is een EXPLICIETE actie — trainernotities blijven ongedeeld
// tot de trainer dit doet.
router.post("/:id/status", requireAuth, async (req, res) => {
  try {
    const trainerClerkId = getClerkUserId(req)!;
    const obj = await loadOwnedObject(Number(req.params.id), trainerClerkId);
    if (!obj) {
      res.status(404).json({ error: "Document niet gevonden." });
      return;
    }
    const status = str(req.body?.status);
    if (!status || !["concept", "gedeeld", "afgerond"].includes(status)) {
      res.status(400).json({ error: "status moet concept, gedeeld of afgerond zijn." });
      return;
    }
    const [row] = await db
      .update(workObjectsTable)
      .set({
        status,
        sharedAt: status === "gedeeld" ? new Date() : obj.sharedAt,
        sharedByClerkId: status === "gedeeld" ? trainerClerkId : obj.sharedByClerkId,
        finishedAt: status === "afgerond" ? new Date() : obj.finishedAt,
        updatedAt: new Date(),
      })
      .where(eq(workObjectsTable.id, obj.id))
      .returning();
    await db.insert(workObjectHistoryTable).values({
      objectId: obj.id,
      actorClerkId: trainerClerkId,
      action: "status_gewijzigd",
      detail: status,
    });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "trainer document status failed");
    res.status(500).json({ error: "Status wijzigen is niet gelukt." });
  }
});

export default router;
