// ── BUILD_03 Dagschema & logistiek (besluitenpatch hoofdstuk D) ──────────────
// Gemount onder /api/clubs/:clubId/races/:eventId (zie routes/index.ts).
//
// Bindende regels:
// • dagschema optioneel; per persoon; vertrektijd + verzamelpunt verplicht,
//   terugkeertijd optioneel; staf ziet ook elkaars tijden
// • schema verschuiven: ploegleider BEVESTIGT vóór het naar buiten gaat;
//   daarna krijgt de hele ploeg (incl. renners) bericht
// • vervoer per voertuig, chauffeur optioneel; renner ziet de hele indeling
// • materiaal per renner optioneel; de mechanieker vult de lijst en kan een
//   eigen sjabloon vastleggen; afvinkbaar bij inladen; ploegleider ziet dat
// • vertrekcontrole: openstaand materiaal en/of open taken ⇒ waarschuwing
//   (nooit blokkeren)

import { Router } from "express";
import {
  db,
  clubRaceEventsTable,
  clubRaceSelectionsTable,
  clubRaceDayScheduleTable,
  clubRaceVehiclesTable,
  clubRaceVehicleSeatsTable,
  clubRaceMaterialItemsTable,
  clubMaterialTemplatesTable,
} from "@workspace/db";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  getClubContext,
  canManageClub,
  hasClubRole,
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
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isPloegleiderRechten(ctx: ClubContext, event: { deputyClerkId: string | null }): boolean {
  return (
    canManageClub(ctx) ||
    hasClubRole(ctx, ["teammanager", "ploegleider"]) ||
    (event.deputyClerkId != null && event.deputyClerkId === ctx.membership.clerkId)
  );
}
function isStafRol(ctx: ClubContext): boolean {
  return (
    canManageClub(ctx) ||
    hasClubRole(ctx, [
      "hoofdtrainer",
      "trainer",
      "assistent",
      "teammanager",
      "ploegleider",
      "mechanieker",
      "soigneur",
      "medical_staff",
    ])
  );
}

async function loadCtxEvent(
  req: import("express").Request,
  res: import("express").Response,
): Promise<{ ctx: ClubContext; event: typeof clubRaceEventsTable.$inferSelect } | null> {
  const clerkId = getClerkUserId(req)!;
  const clubId = intParam(req.params["clubId"]);
  const eventId = intParam(req.params["eventId"]);
  if (clubId == null || eventId == null) {
    res.status(400).json({ error: "Ongeldige wedstrijd." });
    return null;
  }
  const ctx = await getClubContext(clubId, clerkId);
  if (!ctx) {
    res.status(403).json({ error: "Je bent geen actief lid van deze club." });
    return null;
  }
  const [event] = await db
    .select()
    .from(clubRaceEventsTable)
    .where(and(eq(clubRaceEventsTable.id, eventId), eq(clubRaceEventsTable.clubId, clubId)));
  if (!event) {
    res.status(404).json({ error: "Wedstrijd niet gevonden." });
    return null;
  }
  return { ctx, event };
}

async function ploegSelectie(eventId: number) {
  return db
    .select({ clerkId: clubRaceSelectionsTable.clerkId, role: clubRaceSelectionsTable.role })
    .from(clubRaceSelectionsTable)
    .where(eq(clubRaceSelectionsTable.eventId, eventId));
}

// ── Dagschema ────────────────────────────────────────────────────────────────

router.get("/schedule", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    const rows = await db
      .select()
      .from(clubRaceDayScheduleTable)
      .where(eq(clubRaceDayScheduleTable.eventId, le.event.id))
      .orderBy(asc(clubRaceDayScheduleTable.departTime));
    // Staf ziet alle tijden; een renner ziet de eigen regel + de hele
    // vervoersindeling (aparte endpoint), dus hier ook alles — dat is de
    // clubbrede afspraak: "een staflid ziet ook de tijden van de anderen";
    // renners zien hun eigen regel. We filteren voor niet-staf op de eigen rij.
    if (isStafRol(le.ctx)) {
      res.json(rows);
      return;
    }
    res.json(rows.filter((r) => r.clerkId === le.ctx.membership.clerkId));
  } catch (err) {
    req.log.error({ err }, "day schedule list failed");
    res.status(500).json({ error: "Dagschema ophalen is niet gelukt." });
  }
});

// Regel toevoegen/bijwerken (ploegleider): vertrektijd + verzamelpunt verplicht.
router.put("/schedule/:memberId", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    if (!isPloegleiderRechten(le.ctx, le.event)) {
      res.status(403).json({ error: "Alleen de ploegleider beheert het dagschema." });
      return;
    }
    const memberId = str(req.params["memberId"]);
    const departTime = str(req.body?.departTime);
    const meetPoint = str(req.body?.meetPoint);
    const returnTime = str(req.body?.returnTime);
    if (!memberId || !departTime || !TIME_RE.test(departTime) || !meetPoint) {
      res.status(400).json({ error: "Vertrektijd (HH:MM) en verzamelpunt zijn verplicht." });
      return;
    }
    if (returnTime && !TIME_RE.test(returnTime)) {
      res.status(400).json({ error: "Terugkeertijd moet HH:MM zijn." });
      return;
    }
    const memberCtx = await getClubContext(le.ctx.club.id, memberId);
    if (!memberCtx) {
      res.status(400).json({ error: "Deze persoon is geen actief clublid." });
      return;
    }
    const [row] = await db
      .insert(clubRaceDayScheduleTable)
      .values({
        eventId: le.event.id,
        clerkId: memberId,
        departTime,
        meetPoint,
        returnTime,
        note: str(req.body?.note),
      })
      .onConflictDoUpdate({
        target: [clubRaceDayScheduleTable.eventId, clubRaceDayScheduleTable.clerkId],
        set: { departTime, meetPoint, returnTime, note: str(req.body?.note), updatedAt: new Date() },
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "day schedule upsert failed");
    res.status(500).json({ error: "Dagschema bijwerken is niet gelukt." });
  }
});

// Schema verschuiven (bijv. latere start): ploegleider bevestigt expliciet;
// alle vertrek- en terugkeertijden schuiven mee; daarna bericht aan de HELE
// ploeg, inclusief renners.
router.post("/schedule/shift", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    if (!isPloegleiderRechten(le.ctx, le.event)) {
      res.status(403).json({ error: "Alleen de ploegleider verschuift het dagschema." });
      return;
    }
    const minutes = Number(req.body?.minutes);
    if (!Number.isInteger(minutes) || minutes === 0 || Math.abs(minutes) > 12 * 60) {
      res.status(400).json({ error: "Geef een verschuiving in minuten (±720)." });
      return;
    }
    if (req.body?.confirm !== true) {
      res.status(400).json({
        error: "De ploegleider moet de verschuiving expliciet bevestigen (confirm: true).",
      });
      return;
    }
    const rows = await db
      .select()
      .from(clubRaceDayScheduleTable)
      .where(eq(clubRaceDayScheduleTable.eventId, le.event.id));
    const shift = (hhmm: string): string => {
      const [h, m] = hhmm.split(":").map(Number);
      const tot = (((h! * 60 + m! + minutes) % 1440) + 1440) % 1440;
      return `${String(Math.floor(tot / 60)).padStart(2, "0")}:${String(tot % 60).padStart(2, "0")}`;
    };
    for (const r of rows) {
      await db
        .update(clubRaceDayScheduleTable)
        .set({
          departTime: shift(r.departTime),
          returnTime: r.returnTime ? shift(r.returnTime) : null,
          updatedAt: new Date(),
        })
        .where(eq(clubRaceDayScheduleTable.id, r.id));
    }
    // Hele ploeg — inclusief renners — krijgt bericht.
    const ploeg = await ploegSelectie(le.event.id);
    const richting = minutes > 0 ? "later" : "eerder";
    for (const lid of ploeg) {
      void createNotification({
        clerkId: lid.clerkId,
        type: "club_update",
        title: "Dagschema verschoven",
        body: `Het dagschema van "${le.event.name}" is ${Math.abs(minutes)} minuten ${richting} gezet. Kijk je nieuwe tijden na.`,
        actionUrl: "/club",
        source: "club-races",
        dedupeKey: `schedule-shift:${le.event.id}:${minutes}:${lid.clerkId}`,
      });
    }
    res.json({ shifted: rows.length, minutes });
  } catch (err) {
    req.log.error({ err }, "day schedule shift failed");
    res.status(500).json({ error: "Dagschema verschuiven is niet gelukt." });
  }
});

// ── Vervoer ──────────────────────────────────────────────────────────────────

router.get("/vehicles", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    // Een renner ziet de HELE indeling — bewust geen filtering.
    const vehicles = await db
      .select()
      .from(clubRaceVehiclesTable)
      .where(eq(clubRaceVehiclesTable.eventId, le.event.id))
      .orderBy(asc(clubRaceVehiclesTable.name));
    const seats = vehicles.length
      ? await db
          .select()
          .from(clubRaceVehicleSeatsTable)
          .where(inArray(clubRaceVehicleSeatsTable.vehicleId, vehicles.map((v) => v.id)))
      : [];
    res.json(
      vehicles.map((v) => ({
        ...v,
        passengers: seats.filter((s) => s.vehicleId === v.id).map((s) => s.clerkId),
      })),
    );
  } catch (err) {
    req.log.error({ err }, "vehicles list failed");
    res.status(500).json({ error: "Vervoer ophalen is niet gelukt." });
  }
});

router.post("/vehicles", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    if (!isPloegleiderRechten(le.ctx, le.event)) {
      res.status(403).json({ error: "Alleen de ploegleider deelt het vervoer in." });
      return;
    }
    const name = str(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "Naam van het voertuig is verplicht." });
      return;
    }
    const [row] = await db
      .insert(clubRaceVehiclesTable)
      .values({
        eventId: le.event.id,
        name,
        seats: req.body?.seats != null ? intParam(String(req.body.seats)) : null,
        driverClerkId: str(req.body?.driverClerkId), // chauffeur optioneel
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "vehicle create failed");
    res.status(500).json({ error: "Voertuig toevoegen is niet gelukt." });
  }
});

router.post("/vehicles/:vehicleId/passengers", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    if (!isPloegleiderRechten(le.ctx, le.event)) {
      res.status(403).json({ error: "Alleen de ploegleider deelt het vervoer in." });
      return;
    }
    const vehicleId = intParam(req.params["vehicleId"]);
    const clerkId = str(req.body?.clerkId);
    const [vehicle] = await db
      .select()
      .from(clubRaceVehiclesTable)
      .where(and(eq(clubRaceVehiclesTable.id, vehicleId ?? -1), eq(clubRaceVehiclesTable.eventId, le.event.id)));
    if (!vehicle || !clerkId) {
      res.status(404).json({ error: "Voertuig niet gevonden." });
      return;
    }
    await db
      .insert(clubRaceVehicleSeatsTable)
      .values({ vehicleId: vehicle.id, clerkId })
      .onConflictDoNothing();
    // Waarschuwen (niet blokkeren) bij meer inzittenden dan plaatsen.
    const seats = await db
      .select()
      .from(clubRaceVehicleSeatsTable)
      .where(eq(clubRaceVehicleSeatsTable.vehicleId, vehicle.id));
    const warning =
      vehicle.seats != null && seats.length > vehicle.seats
        ? `Let op: ${seats.length} inzittenden voor ${vehicle.seats} plaatsen in ${vehicle.name}.`
        : null;
    res.status(201).json({ vehicleId: vehicle.id, passengers: seats.map((s) => s.clerkId), warning });
  } catch (err) {
    req.log.error({ err }, "vehicle passenger failed");
    res.status(500).json({ error: "Indelen is niet gelukt." });
  }
});

// ── Materiaal per renner ─────────────────────────────────────────────────────

function magMateriaal(ctx: ClubContext, event: { deputyClerkId: string | null }): boolean {
  return hasClubRole(ctx, ["mechanieker"]) || isPloegleiderRechten(ctx, event);
}

router.get("/material", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    const rows = await db
      .select()
      .from(clubRaceMaterialItemsTable)
      .where(eq(clubRaceMaterialItemsTable.eventId, le.event.id))
      .orderBy(asc(clubRaceMaterialItemsTable.riderClerkId), asc(clubRaceMaterialItemsTable.id));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "material list failed");
    res.status(500).json({ error: "Materiaallijst ophalen is niet gelukt." });
  }
});

router.post("/material", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    if (!magMateriaal(le.ctx, le.event)) {
      res.status(403).json({ error: "Alleen de mechanieker (of ploegleider) vult de materiaallijst." });
      return;
    }
    const riderClerkId = str(req.body?.riderClerkId);
    if (!riderClerkId) {
      res.status(400).json({ error: "Renner is verplicht." });
      return;
    }
    // Eén item of een sjabloon toepassen.
    const templateId = req.body?.templateId != null ? intParam(String(req.body.templateId)) : null;
    if (templateId != null) {
      const [tpl] = await db
        .select()
        .from(clubMaterialTemplatesTable)
        .where(
          and(
            eq(clubMaterialTemplatesTable.id, templateId),
            eq(clubMaterialTemplatesTable.clubId, le.ctx.club.id),
          ),
        );
      if (!tpl) {
        res.status(404).json({ error: "Sjabloon niet gevonden." });
        return;
      }
      const items = (tpl.items as string[]).filter((i) => typeof i === "string" && i.trim());
      const rows = await db
        .insert(clubRaceMaterialItemsTable)
        .values(
          items.map((item) => ({
            eventId: le.event.id,
            riderClerkId,
            item,
            createdByClerkId: le.ctx.membership.clerkId,
          })),
        )
        .returning();
      res.status(201).json(rows);
      return;
    }
    const item = str(req.body?.item);
    if (!item) {
      res.status(400).json({ error: "Item is verplicht." });
      return;
    }
    const [row] = await db
      .insert(clubRaceMaterialItemsTable)
      .values({
        eventId: le.event.id,
        riderClerkId,
        item,
        createdByClerkId: le.ctx.membership.clerkId,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "material create failed");
    res.status(500).json({ error: "Materiaal toevoegen is niet gelukt." });
  }
});

// Afvinken bij inladen (mechanieker of ploegleider).
router.post("/material/:itemId/loaded", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    if (!magMateriaal(le.ctx, le.event)) {
      res.status(403).json({ error: "Alleen de mechanieker (of ploegleider) vinkt materiaal af." });
      return;
    }
    const itemId = intParam(req.params["itemId"]);
    const [item] = await db
      .select()
      .from(clubRaceMaterialItemsTable)
      .where(
        and(
          eq(clubRaceMaterialItemsTable.id, itemId ?? -1),
          eq(clubRaceMaterialItemsTable.eventId, le.event.id),
        ),
      );
    if (!item) {
      res.status(404).json({ error: "Item niet gevonden." });
      return;
    }
    if (item.loadedAt != null) {
      res.json(item); // idempotent
      return;
    }
    const [row] = await db
      .update(clubRaceMaterialItemsTable)
      .set({ loadedAt: new Date(), loadedByClerkId: le.ctx.membership.clerkId })
      .where(eq(clubRaceMaterialItemsTable.id, item.id))
      .returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "material loaded failed");
    res.status(500).json({ error: "Afvinken is niet gelukt." });
  }
});

// Materiaalsjabloon van de mechanieker.
router.post("/material-templates", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    if (!magMateriaal(le.ctx, le.event)) {
      res.status(403).json({ error: "Alleen de mechanieker legt een materiaalsjabloon vast." });
      return;
    }
    const name = str(req.body?.name);
    const items = Array.isArray(req.body?.items)
      ? (req.body.items as unknown[]).filter((i): i is string => typeof i === "string" && !!i.trim())
      : [];
    if (!name || items.length === 0) {
      res.status(400).json({ error: "Naam en minstens één item zijn verplicht." });
      return;
    }
    const [row] = await db
      .insert(clubMaterialTemplatesTable)
      .values({ clubId: le.ctx.club.id, name, items, createdByClerkId: le.ctx.membership.clerkId })
      .onConflictDoUpdate({
        target: [clubMaterialTemplatesTable.clubId, clubMaterialTemplatesTable.name],
        set: { items },
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "material template failed");
    res.status(500).json({ error: "Sjabloon vastleggen is niet gelukt." });
  }
});

// ── Vertrekcontrole ──────────────────────────────────────────────────────────
// Bij vertrek met openstaande materiaalpunten of open taken: WAARSCHUWING —
// nooit blokkeren. (Taken uit de werkobjectlaag van deze wedstrijd.)
router.get("/departure-check", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    const open = await db
      .select()
      .from(clubRaceMaterialItemsTable)
      .where(
        and(
          eq(clubRaceMaterialItemsTable.eventId, le.event.id),
          isNull(clubRaceMaterialItemsTable.loadedAt),
        ),
      );
    const { workObjectsTable, workObjectTasksTable } = await import("@workspace/db");
    const objecten = await db
      .select({ id: workObjectsTable.id })
      .from(workObjectsTable)
      .where(eq(workObjectsTable.eventId, le.event.id));
    const openTaken = objecten.length
      ? await db
          .select()
          .from(workObjectTasksTable)
          .where(
            and(
              inArray(workObjectTasksTable.objectId, objecten.map((o) => o.id)),
              isNull(workObjectTasksTable.doneAt),
            ),
          )
      : [];
    const warnings: string[] = [];
    if (open.length > 0) warnings.push(`Nog ${open.length} materiaalpunt(en) niet ingeladen.`);
    if (openTaken.length > 0) warnings.push(`Nog ${openTaken.length} open taak/taken.`);
    res.json({ ready: warnings.length === 0, warnings, openMaterial: open, openTasks: openTaken });
  } catch (err) {
    req.log.error({ err }, "departure check failed");
    res.status(500).json({ error: "Vertrekcontrole is niet gelukt." });
  }
});

export default router;
