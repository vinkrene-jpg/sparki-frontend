// ── Werkobjectlaag (SPARKI_INHAAL_01 BUILD_02, besluitenpatch hoofdstuk C) ────
// ÉÉN gedeelde werkobjectlaag voor koersplannen, trainingsweken, materiaal-
// plannen en ouderbriefingen. Geen tweede rechtenlaag: alle poorten lopen via
// de bestaande clubrechten (club-permissions). Gemount onder
// /api/clubs/:clubId/work-objects (zie routes/index.ts).
//
// Bindende regels uit de patch:
// • status verplicht: concept | gedeeld | afgerond
// • afgerond mag alleen de ploegleider nog wijzigen
// • delen is een expliciete actie van de ploegleider (ook elke nieuwe versie);
//   eerste keer delen bericht ALLEEN de staf, nooit de renners
// • per deel zichtbaar wie het invulde, met datum en tijd
// • volledige wijzigingsgeschiedenis alleen voor de ploegleider
// • of staf elkaars deel mag aanpassen bepaalt de ploegleider per object
// • gelijktijdig bewerken ⇒ waarschuwing (versieconflict, 409)
// • opmerkingen mogen door iedereen (ook renners), zichtbaar per onderdeel
// • renner vult eigen deel ⇒ alleen de ploegleider krijgt bericht
// • taken afvinkbaar door de toegewezene ⇒ ploegleider krijgt bericht
// • staflid weg uit de club ⇒ geschreven inhoud blijft staan
// • kopieerbaar naar volgende wedstrijd: alleen vaste onderdelen, geen
//   bezetting; clubs kunnen een eigen sjabloon vastleggen
// • offline is buiten scope van deze eerste versie

import { Router } from "express";
import {
  db,
  workObjectsTable,
  workObjectSectionsTable,
  workObjectCommentsTable,
  workObjectTasksTable,
  workObjectHistoryTable,
  workObjectTemplatesTable,
  clubMembersTable,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  getClubContext,
  canManageClub,
  hasClubRole,
  writeClubAudit,
  type ClubContext,
} from "../lib/club-permissions";
import { createNotification } from "../lib/notifications";

const router = Router({ mergeParams: true });

function intParam(v: unknown): number | null {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// Staf = iedereen met een clubfunctie behalve gewone leden/gasten/ouders.
const STAF_ROLES = [
  "owner",
  "admin",
  "hoofdtrainer",
  "trainer",
  "assistent",
  "teammanager",
  "ploegleider",
  "mechanieker",
  "soigneur",
  "medical_staff",
] as const;

function isStaf(ctx: ClubContext): boolean {
  return hasClubRole(ctx, [...STAF_ROLES] as never);
}
// "Ploegleider-rechten" op de werkobjectlaag: de ploegleider zelf, plus
// teammanager/beheer (hiërarchie besluitenpatch B — teammanager staat boven
// de ploegleider; beheer is eindverantwoordelijk). Renners/leden nooit.
function isPloegleider(ctx: ClubContext): boolean {
  return hasClubRole(ctx, ["ploegleider", "teammanager"] as never) || canManageClub(ctx);
}

async function ctxOr403(
  req: import("express").Request,
  res: import("express").Response,
): Promise<ClubContext | null> {
  const clerkId = getClerkUserId(req)!;
  const clubId = intParam(req.params["clubId"]);
  if (clubId == null) {
    res.status(400).json({ error: "Ongeldige club" });
    return null;
  }
  const ctx = await getClubContext(clubId, clerkId);
  if (!ctx) {
    res.status(403).json({ error: "Je bent geen actief lid van deze club." });
    return null;
  }
  return ctx;
}

async function loadObject(clubId: number, objectId: number) {
  const [obj] = await db
    .select()
    .from(workObjectsTable)
    .where(and(eq(workObjectsTable.id, objectId), eq(workObjectsTable.clubId, clubId)));
  return obj ?? null;
}

async function history(
  objectId: number,
  actorClerkId: string,
  action: string,
  detail?: Record<string, unknown>,
  sectionId?: number,
) {
  await db.insert(workObjectHistoryTable).values({
    objectId,
    sectionId: sectionId ?? null,
    actorClerkId,
    action,
    detail: detail ?? null,
  });
}

// Leesbaarheid: staf ziet alles; renners/leden zien alleen GEDEELDE of
// AFGERONDE objecten. Concepten zijn stafwerk.
function canRead(ctx: ClubContext, status: string): boolean {
  if (isStaf(ctx)) return true;
  return status === "gedeeld" || status === "afgerond";
}

// Schrijfpoort per object: afgerond ⇒ alleen ploegleider. Gedeeld/concept ⇒
// staf, en renners alleen hun eigen deel (via sectie-eigenaarschap).
function writeBlockedReason(ctx: ClubContext, status: string): string | null {
  if (status === "afgerond" && !isPloegleider(ctx)) {
    return "Dit plan is afgerond; alleen de ploegleider kan het nog wijzigen.";
  }
  return null;
}

// ── Objecten ─────────────────────────────────────────────────────────────────

router.get("/", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const rows = await db
      .select()
      .from(workObjectsTable)
      .where(eq(workObjectsTable.clubId, ctx.club.id))
      .orderBy(desc(workObjectsTable.updatedAt));
    res.json(rows.filter((r) => canRead(ctx, r.status)));
  } catch (err) {
    req.log.error({ err }, "work objects list failed");
    res.status(500).json({ error: "Werkobjecten ophalen is niet gelukt." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!isStaf(ctx)) {
      res.status(403).json({ error: "Alleen staf kan een plan aanmaken." });
      return;
    }
    const title = str(req.body?.title);
    if (!title) {
      res.status(400).json({ error: "Titel is verplicht." });
      return;
    }
    const objectType = str(req.body?.objectType) ?? "koersplan";
    const eventId = req.body?.eventId != null ? intParam(String(req.body.eventId)) : null;
    const templateId = req.body?.templateId != null ? intParam(String(req.body.templateId)) : null;

    let sections: { title: string; position: number; vastOnderdeel: boolean }[] = [];
    if (templateId != null) {
      const [tpl] = await db
        .select()
        .from(workObjectTemplatesTable)
        .where(
          and(
            eq(workObjectTemplatesTable.id, templateId),
            eq(workObjectTemplatesTable.clubId, ctx.club.id),
          ),
        );
      if (!tpl) {
        res.status(404).json({ error: "Sjabloon niet gevonden." });
        return;
      }
      sections = (tpl.sections as typeof sections) ?? [];
    } else if (Array.isArray(req.body?.sections)) {
      sections = (req.body.sections as unknown[])
        .map((s, i) => ({
          title: str((s as Record<string, unknown>)?.title) ?? "",
          position: i,
          vastOnderdeel: (s as Record<string, unknown>)?.vastOnderdeel !== false,
        }))
        .filter((s) => s.title);
    }

    const [obj] = await db
      .insert(workObjectsTable)
      .values({
        clubId: ctx.club.id,
        eventId,
        objectType,
        title,
        createdByClerkId: ctx.membership.clerkId,
        templateId,
      })
      .returning();
    if (sections.length > 0) {
      await db.insert(workObjectSectionsTable).values(
        sections.map((s) => ({
          objectId: obj!.id,
          title: s.title,
          position: s.position,
          vastOnderdeel: s.vastOnderdeel,
        })),
      );
    }
    await history(obj!.id, ctx.membership.clerkId, "aangemaakt", { titel: title, objectType });
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "werkobject_aangemaakt",
      targetType: "work_object",
      targetId: obj!.id,
      detail: { titel: title, objectType },
    });
    res.status(201).json(obj);
  } catch (err) {
    req.log.error({ err }, "work object create failed");
    res.status(500).json({ error: "Plan aanmaken is niet gelukt." });
  }
});

// Detail: object + secties (met wie-vulde-wat), opmerkingen per sectie, taken.
router.get("/:objectId", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const objectId = intParam(req.params["objectId"]);
    if (objectId == null) {
      res.status(400).json({ error: "Ongeldig plan." });
      return;
    }
    const obj = await loadObject(ctx.club.id, objectId);
    if (!obj || !canRead(ctx, obj.status)) {
      res.status(404).json({ error: "Plan niet gevonden." });
      return;
    }
    const sections = await db
      .select()
      .from(workObjectSectionsTable)
      .where(eq(workObjectSectionsTable.objectId, objectId))
      .orderBy(asc(workObjectSectionsTable.position));
    const sectionIds = sections.map((s) => s.id);
    const comments = sectionIds.length
      ? await db
          .select()
          .from(workObjectCommentsTable)
          .where(inArray(workObjectCommentsTable.sectionId, sectionIds))
          .orderBy(asc(workObjectCommentsTable.createdAt))
      : [];
    const tasks = await db
      .select()
      .from(workObjectTasksTable)
      .where(eq(workObjectTasksTable.objectId, objectId))
      .orderBy(asc(workObjectTasksTable.createdAt));
    res.json({ object: obj, sections, comments, tasks });
  } catch (err) {
    req.log.error({ err }, "work object detail failed");
    res.status(500).json({ error: "Plan ophalen is niet gelukt." });
  }
});

// Instellingen (ploegleider): titel, staf-mag-elkaars-deel.
router.put("/:objectId", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const objectId = intParam(req.params["objectId"]);
    const obj = objectId != null ? await loadObject(ctx.club.id, objectId) : null;
    if (!obj) {
      res.status(404).json({ error: "Plan niet gevonden." });
      return;
    }
    if (!isPloegleider(ctx)) {
      res.status(403).json({ error: "Alleen de ploegleider beheert de planinstellingen." });
      return;
    }
    const set: Record<string, unknown> = { updatedAt: new Date() };
    const title = str(req.body?.title);
    if (title) set["title"] = title;
    if (typeof req.body?.stafMagElkaarsDeel === "boolean") {
      set["stafMagElkaarsDeel"] = req.body.stafMagElkaarsDeel;
    }
    const [row] = await db
      .update(workObjectsTable)
      .set(set)
      .where(eq(workObjectsTable.id, obj.id))
      .returning();
    await history(obj.id, ctx.membership.clerkId, "instellingen_gewijzigd", set as Record<string, unknown>);
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "work object update failed");
    res.status(500).json({ error: "Plan bijwerken is niet gelukt." });
  }
});

// Status: concept → gedeeld → afgerond (en terug naar concept door
// ploegleider). Delen = expliciete actie; eerste keer bericht ALLEEN de staf.
router.post("/:objectId/status", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const objectId = intParam(req.params["objectId"]);
    const status = str(req.body?.status);
    const obj = objectId != null ? await loadObject(ctx.club.id, objectId) : null;
    if (!obj) {
      res.status(404).json({ error: "Plan niet gevonden." });
      return;
    }
    if (!status || !["concept", "gedeeld", "afgerond"].includes(status)) {
      res.status(400).json({ error: "Ongeldige status." });
      return;
    }
    if (!isPloegleider(ctx)) {
      res.status(403).json({ error: "Alleen de ploegleider wijzigt de status of deelt het plan." });
      return;
    }
    const eersteKeerDelen = status === "gedeeld" && obj.sharedAt == null;
    const now = new Date();
    const [row] = await db
      .update(workObjectsTable)
      .set({
        status,
        ...(status === "gedeeld"
          ? { sharedAt: now, sharedByClerkId: ctx.membership.clerkId }
          : {}),
        ...(status === "afgerond" ? { finishedAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(workObjectsTable.id, obj.id))
      .returning();
    await history(obj.id, ctx.membership.clerkId, status === "gedeeld" ? "gedeeld" : "status_gewijzigd", {
      van: obj.status,
      naar: status,
    });
    if (eersteKeerDelen) {
      // Bericht ALLEEN aan de staf (nooit renners), en niet aan de deler zelf.
      const stafLeden = await db
        .select({ clerkId: clubMembersTable.clerkId, role: clubMembersTable.role })
        .from(clubMembersTable)
        .where(
          and(
            eq(clubMembersTable.clubId, ctx.club.id),
            isNull(clubMembersTable.endedAt),
            inArray(clubMembersTable.role, [...STAF_ROLES]),
          ),
        );
      for (const lid of stafLeden) {
        if (lid.clerkId === ctx.membership.clerkId) continue;
        void createNotification({
          clerkId: lid.clerkId,
          type: "club_update",
          title: "Plan gedeeld",
          body: `"${obj.title}" is gedeeld door de ploegleider. Vul je eigen onderdeel aan.`,
          actionUrl: "/club",
          source: "work-objects",
          dedupeKey: `work-object-shared:${obj.id}:${lid.clerkId}`,
        });
      }
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "work object status failed");
    res.status(500).json({ error: "Status wijzigen is niet gelukt." });
  }
});

// ── Secties ──────────────────────────────────────────────────────────────────

router.post("/:objectId/sections", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const objectId = intParam(req.params["objectId"]);
    const obj = objectId != null ? await loadObject(ctx.club.id, objectId) : null;
    if (!obj) {
      res.status(404).json({ error: "Plan niet gevonden." });
      return;
    }
    const blocked = writeBlockedReason(ctx, obj.status);
    if (blocked) {
      res.status(403).json({ error: blocked });
      return;
    }
    if (!isStaf(ctx)) {
      res.status(403).json({ error: "Alleen staf voegt onderdelen toe." });
      return;
    }
    const title = str(req.body?.title);
    if (!title) {
      res.status(400).json({ error: "Titel is verplicht." });
      return;
    }
    const [row] = await db
      .insert(workObjectSectionsTable)
      .values({
        objectId: obj.id,
        title,
        position: intParam(String(req.body?.position ?? "")) ?? 0,
        vastOnderdeel: req.body?.vastOnderdeel !== false,
        ownerClerkId: str(req.body?.ownerClerkId),
      })
      .returning();
    await history(obj.id, ctx.membership.clerkId, "onderdeel_toegevoegd", { titel: title }, row!.id);
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "work object section create failed");
    res.status(500).json({ error: "Onderdeel toevoegen is niet gelukt." });
  }
});

// Deel invullen. Gelijktijdig bewerken: schrijven eist baseVersion; een
// verouderde basisversie levert 409 met waarschuwing. Renners mogen alleen
// hun EIGEN deel invullen; daarvan krijgt alleen de ploegleider bericht.
router.put("/:objectId/sections/:sectionId", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const objectId = intParam(req.params["objectId"]);
    const sectionId = intParam(req.params["sectionId"]);
    const obj = objectId != null ? await loadObject(ctx.club.id, objectId) : null;
    if (!obj || sectionId == null) {
      res.status(404).json({ error: "Plan niet gevonden." });
      return;
    }
    const [section] = await db
      .select()
      .from(workObjectSectionsTable)
      .where(
        and(
          eq(workObjectSectionsTable.id, sectionId),
          eq(workObjectSectionsTable.objectId, obj.id),
        ),
      );
    if (!section) {
      res.status(404).json({ error: "Onderdeel niet gevonden." });
      return;
    }
    const blocked = writeBlockedReason(ctx, obj.status);
    if (blocked) {
      res.status(403).json({ error: blocked });
      return;
    }
    const me = ctx.membership.clerkId;
    const eigenDeel = section.ownerClerkId === me;
    if (!isPloegleider(ctx)) {
      if (!isStaf(ctx)) {
        // Renner/lid: alleen het eigen deel, en alleen als het plan gedeeld is.
        if (!eigenDeel || obj.status !== "gedeeld") {
          res.status(403).json({ error: "Je kunt alleen je eigen onderdeel aanvullen." });
          return;
        }
      } else if (!eigenDeel && section.ownerClerkId != null && !obj.stafMagElkaarsDeel) {
        res.status(403).json({
          error: "De ploegleider heeft voor dit plan bepaald dat staf alleen het eigen deel invult.",
        });
        return;
      }
    }
    const content = typeof req.body?.content === "string" ? req.body.content : null;
    const baseVersion = intParam(String(req.body?.baseVersion ?? ""));
    if (content == null || baseVersion == null) {
      res.status(400).json({ error: "Inhoud en basisversie zijn verplicht." });
      return;
    }
    const now = new Date();
    // Voorwaardelijke update op versie = de gelijktijdig-bewerken-waarschuwing.
    const updated = await db
      .update(workObjectSectionsTable)
      .set({
        content,
        version: section.version + 1,
        filledByClerkId: me,
        filledAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(workObjectSectionsTable.id, section.id),
          eq(workObjectSectionsTable.version, baseVersion),
        ),
      )
      .returning();
    if (updated.length === 0) {
      res.status(409).json({
        error:
          "Iemand anders heeft dit onderdeel net gewijzigd. Bekijk de nieuwste versie en probeer het opnieuw.",
        currentVersion: section.version,
      });
      return;
    }
    await history(obj.id, me, "deel_ingevuld", { titel: section.title }, section.id);
    // Renner vult eigen deel ⇒ alleen de ploegleider(s) bericht.
    if (!isStaf(ctx)) {
      const leiders = await db
        .select({ clerkId: clubMembersTable.clerkId })
        .from(clubMembersTable)
        .where(
          and(
            eq(clubMembersTable.clubId, ctx.club.id),
            isNull(clubMembersTable.endedAt),
            eq(clubMembersTable.role, "ploegleider"),
          ),
        );
      for (const l of leiders) {
        void createNotification({
          clerkId: l.clerkId,
          type: "club_update",
          title: "Renner vulde zijn onderdeel aan",
          body: `In "${obj.title}" is het onderdeel "${section.title}" aangevuld.`,
          actionUrl: "/club",
          source: "work-objects",
          dedupeKey: `work-object-renner:${section.id}:${section.version + 1}`,
        });
      }
    }
    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "work object section update failed");
    res.status(500).json({ error: "Onderdeel bijwerken is niet gelukt." });
  }
});

// ── Opmerkingen (iedereen, per onderdeel) ────────────────────────────────────

router.post("/:objectId/sections/:sectionId/comments", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const objectId = intParam(req.params["objectId"]);
    const sectionId = intParam(req.params["sectionId"]);
    const obj = objectId != null ? await loadObject(ctx.club.id, objectId) : null;
    if (!obj || sectionId == null || !canRead(ctx, obj.status)) {
      res.status(404).json({ error: "Plan niet gevonden." });
      return;
    }
    const [section] = await db
      .select()
      .from(workObjectSectionsTable)
      .where(
        and(
          eq(workObjectSectionsTable.id, sectionId),
          eq(workObjectSectionsTable.objectId, obj.id),
        ),
      );
    if (!section) {
      res.status(404).json({ error: "Onderdeel niet gevonden." });
      return;
    }
    const body = str(req.body?.body);
    if (!body) {
      res.status(400).json({ error: "Opmerking mag niet leeg zijn." });
      return;
    }
    const [row] = await db
      .insert(workObjectCommentsTable)
      .values({ sectionId: section.id, authorClerkId: ctx.membership.clerkId, body })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "work object comment failed");
    res.status(500).json({ error: "Opmerking plaatsen is niet gelukt." });
  }
});

// ── Taken ────────────────────────────────────────────────────────────────────

router.post("/:objectId/tasks", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const objectId = intParam(req.params["objectId"]);
    const obj = objectId != null ? await loadObject(ctx.club.id, objectId) : null;
    if (!obj) {
      res.status(404).json({ error: "Plan niet gevonden." });
      return;
    }
    const blocked = writeBlockedReason(ctx, obj.status);
    if (blocked) {
      res.status(403).json({ error: blocked });
      return;
    }
    if (!isStaf(ctx)) {
      res.status(403).json({ error: "Alleen staf maakt taken aan." });
      return;
    }
    const title = str(req.body?.title);
    const assigneeClerkId = str(req.body?.assigneeClerkId);
    if (!title || !assigneeClerkId) {
      res.status(400).json({ error: "Titel en toegewezene zijn verplicht." });
      return;
    }
    const assigneeCtx = await getClubContext(ctx.club.id, assigneeClerkId);
    if (!assigneeCtx) {
      res.status(400).json({ error: "De toegewezene is geen actief clublid." });
      return;
    }
    const [row] = await db
      .insert(workObjectTasksTable)
      .values({
        objectId: obj.id,
        sectionId: req.body?.sectionId != null ? intParam(String(req.body.sectionId)) : null,
        title,
        assigneeClerkId,
        createdByClerkId: ctx.membership.clerkId,
      })
      .returning();
    await history(obj.id, ctx.membership.clerkId, "taak_aangemaakt", { titel: title, aan: assigneeClerkId });
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "work object task create failed");
    res.status(500).json({ error: "Taak aanmaken is niet gelukt." });
  }
});

// Weigeren: mag, maar alleen MET reden; de taak blijft open en de ploegleider
// krijgt bericht (BUILD_03, besluitenpatch hoofdstuk D).
router.post("/:objectId/tasks/:taskId/decline", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const objectId = intParam(req.params["objectId"]);
    const taskId = intParam(req.params["taskId"]);
    const obj = objectId != null ? await loadObject(ctx.club.id, objectId) : null;
    if (!obj || taskId == null) {
      res.status(404).json({ error: "Plan niet gevonden." });
      return;
    }
    const [task] = await db
      .select()
      .from(workObjectTasksTable)
      .where(and(eq(workObjectTasksTable.id, taskId), eq(workObjectTasksTable.objectId, obj.id)));
    if (!task) {
      res.status(404).json({ error: "Taak niet gevonden." });
      return;
    }
    if (task.assigneeClerkId !== ctx.membership.clerkId) {
      res.status(403).json({ error: "Alleen degene die de taak heeft kan hem weigeren." });
      return;
    }
    if (task.doneAt != null) {
      res.status(409).json({ error: "Deze taak is al afgevinkt." });
      return;
    }
    const reason = str(req.body?.reason);
    if (!reason) {
      res.status(400).json({ error: "Weigeren kan alleen met een reden." });
      return;
    }
    const [row] = await db
      .update(workObjectTasksTable)
      .set({ declinedAt: new Date(), declineReason: reason })
      .where(eq(workObjectTasksTable.id, task.id))
      .returning();
    await history(obj.id, ctx.membership.clerkId, "taak_geweigerd", { titel: task.title, reden: reason });
    const leiders = await db
      .select({ clerkId: clubMembersTable.clerkId })
      .from(clubMembersTable)
      .where(
        and(
          eq(clubMembersTable.clubId, ctx.club.id),
          isNull(clubMembersTable.endedAt),
          eq(clubMembersTable.role, "ploegleider"),
        ),
      );
    for (const l of leiders) {
      void createNotification({
        clerkId: l.clerkId,
        type: "club_update",
        title: "Taak geweigerd",
        body: `"${task.title}" in "${obj.title}" is geweigerd: ${reason}. De taak blijft open.`,
        actionUrl: "/club",
        source: "work-objects",
        dedupeKey: `task-declined:${task.id}`,
      });
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "work object task decline failed");
    res.status(500).json({ error: "Taak weigeren is niet gelukt." });
  }
});

// Afvinken: verplicht door degene die de taak heeft; ploegleider krijgt bericht.
router.post("/:objectId/tasks/:taskId/done", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const objectId = intParam(req.params["objectId"]);
    const taskId = intParam(req.params["taskId"]);
    const obj = objectId != null ? await loadObject(ctx.club.id, objectId) : null;
    if (!obj || taskId == null) {
      res.status(404).json({ error: "Plan niet gevonden." });
      return;
    }
    const [task] = await db
      .select()
      .from(workObjectTasksTable)
      .where(and(eq(workObjectTasksTable.id, taskId), eq(workObjectTasksTable.objectId, obj.id)));
    if (!task) {
      res.status(404).json({ error: "Taak niet gevonden." });
      return;
    }
    if (task.assigneeClerkId !== ctx.membership.clerkId) {
      res.status(403).json({ error: "Alleen degene die de taak heeft kan hem afvinken." });
      return;
    }
    if (task.doneAt != null) {
      res.json(task); // idempotent
      return;
    }
    const [row] = await db
      .update(workObjectTasksTable)
      .set({ doneAt: new Date() })
      .where(eq(workObjectTasksTable.id, task.id))
      .returning();
    await history(obj.id, ctx.membership.clerkId, "taak_afgevinkt", { titel: task.title });
    const leiders = await db
      .select({ clerkId: clubMembersTable.clerkId })
      .from(clubMembersTable)
      .where(
        and(
          eq(clubMembersTable.clubId, ctx.club.id),
          isNull(clubMembersTable.endedAt),
          eq(clubMembersTable.role, "ploegleider"),
        ),
      );
    for (const l of leiders) {
      void createNotification({
        clerkId: l.clerkId,
        type: "club_update",
        title: "Taak afgevinkt",
        body: `"${task.title}" is afgevinkt in "${obj.title}".`,
        actionUrl: "/club",
        source: "work-objects",
        dedupeKey: `work-object-task-done:${task.id}`,
      });
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "work object task done failed");
    res.status(500).json({ error: "Taak afvinken is niet gelukt." });
  }
});

// ── Geschiedenis (alleen ploegleider) ────────────────────────────────────────

router.get("/:objectId/history", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const objectId = intParam(req.params["objectId"]);
    const obj = objectId != null ? await loadObject(ctx.club.id, objectId) : null;
    if (!obj) {
      res.status(404).json({ error: "Plan niet gevonden." });
      return;
    }
    if (!isPloegleider(ctx)) {
      res.status(403).json({ error: "De wijzigingsgeschiedenis is alleen voor de ploegleider." });
      return;
    }
    const rows = await db
      .select()
      .from(workObjectHistoryTable)
      .where(eq(workObjectHistoryTable.objectId, obj.id))
      .orderBy(desc(workObjectHistoryTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "work object history failed");
    res.status(500).json({ error: "Geschiedenis ophalen is niet gelukt." });
  }
});

// ── Kopiëren & sjablonen ─────────────────────────────────────────────────────

// Kopieer naar een volgende wedstrijd: ALLEEN de vaste onderdelen, zonder
// inhoud/bezetting; status begint weer op concept.
router.post("/:objectId/copy", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const objectId = intParam(req.params["objectId"]);
    const obj = objectId != null ? await loadObject(ctx.club.id, objectId) : null;
    if (!obj) {
      res.status(404).json({ error: "Plan niet gevonden." });
      return;
    }
    if (!isStaf(ctx)) {
      res.status(403).json({ error: "Alleen staf kopieert een plan." });
      return;
    }
    const title = str(req.body?.title) ?? `${obj.title} (kopie)`;
    const eventId = req.body?.eventId != null ? intParam(String(req.body.eventId)) : null;
    const vaste = await db
      .select()
      .from(workObjectSectionsTable)
      .where(
        and(
          eq(workObjectSectionsTable.objectId, obj.id),
          eq(workObjectSectionsTable.vastOnderdeel, true),
        ),
      )
      .orderBy(asc(workObjectSectionsTable.position));
    const [copy] = await db
      .insert(workObjectsTable)
      .values({
        clubId: ctx.club.id,
        eventId,
        objectType: obj.objectType,
        title,
        createdByClerkId: ctx.membership.clerkId,
        copiedFromId: obj.id,
      })
      .returning();
    if (vaste.length > 0) {
      await db.insert(workObjectSectionsTable).values(
        vaste.map((s) => ({
          objectId: copy!.id,
          title: s.title,
          position: s.position,
          vastOnderdeel: true,
          // Bewust GEEN ownerClerkId, content of invuller: bezetting en
          // inhoud gaan nooit mee.
        })),
      );
    }
    await history(copy!.id, ctx.membership.clerkId, "gekopieerd", { van: obj.id });
    res.status(201).json(copy);
  } catch (err) {
    req.log.error({ err }, "work object copy failed");
    res.status(500).json({ error: "Plan kopiëren is niet gelukt." });
  }
});

router.get("/templates/list", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!isStaf(ctx)) {
      res.status(403).json({ error: "Alleen staf gebruikt sjablonen." });
      return;
    }
    const rows = await db
      .select()
      .from(workObjectTemplatesTable)
      .where(eq(workObjectTemplatesTable.clubId, ctx.club.id))
      .orderBy(asc(workObjectTemplatesTable.name));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "work object templates failed");
    res.status(500).json({ error: "Sjablonen ophalen is niet gelukt." });
  }
});

// Sjabloon vastleggen vanuit een bestaand plan (alleen vaste onderdelen) of
// met een expliciete sectielijst.
router.post("/templates", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!isPloegleider(ctx)) {
      res.status(403).json({ error: "Alleen de ploegleider of beheer legt een clubsjabloon vast." });
      return;
    }
    const name = str(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "Naam is verplicht." });
      return;
    }
    let sections: { title: string; position: number; vastOnderdeel: boolean }[] = [];
    const fromObjectId = req.body?.fromObjectId != null ? intParam(String(req.body.fromObjectId)) : null;
    if (fromObjectId != null) {
      const obj = await loadObject(ctx.club.id, fromObjectId);
      if (!obj) {
        res.status(404).json({ error: "Bronplan niet gevonden." });
        return;
      }
      const vaste = await db
        .select()
        .from(workObjectSectionsTable)
        .where(
          and(
            eq(workObjectSectionsTable.objectId, obj.id),
            eq(workObjectSectionsTable.vastOnderdeel, true),
          ),
        )
        .orderBy(asc(workObjectSectionsTable.position));
      sections = vaste.map((s) => ({ title: s.title, position: s.position, vastOnderdeel: true }));
    } else if (Array.isArray(req.body?.sections)) {
      sections = (req.body.sections as unknown[])
        .map((s, i) => ({
          title: str((s as Record<string, unknown>)?.title) ?? "",
          position: i,
          vastOnderdeel: true,
        }))
        .filter((s) => s.title);
    }
    if (sections.length === 0) {
      res.status(400).json({ error: "Een sjabloon heeft minstens één onderdeel nodig." });
      return;
    }
    const [row] = await db
      .insert(workObjectTemplatesTable)
      .values({
        clubId: ctx.club.id,
        name,
        objectType: str(req.body?.objectType) ?? "koersplan",
        sections,
        createdByClerkId: ctx.membership.clerkId,
      })
      .onConflictDoUpdate({
        target: [workObjectTemplatesTable.clubId, workObjectTemplatesTable.name],
        set: { sections, objectType: str(req.body?.objectType) ?? "koersplan" },
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "work object template create failed");
    res.status(500).json({ error: "Sjabloon vastleggen is niet gelukt." });
  }
});

export default router;
