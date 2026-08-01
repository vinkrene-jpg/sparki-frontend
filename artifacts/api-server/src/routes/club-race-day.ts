// ── BUILD_03 Wedstrijddag-inhoud (besluitenpatch hoofdstuk D) ────────────────
// Gemount onder /api/clubs/:clubId/races/:eventId (zie routes/index.ts).
//
// Bindende regels:
// • briefings per doelgroep (renners | staf | iedereen); ploegleider schrijft
// • opdrachten per renner; IEDEREEN in de selectie ziet elkaars opdracht;
//   wijziging op de wedstrijddag ⇒ renner krijgt direct bericht; het
//   origineel wordt bewust NIET bewaard
// • uitslag handmatig — óók door de renner zelf; komt in de persoonlijke
//   wedstrijdhistorie (races-rij van de renner)
// • ploegevaluatie: iedereen uit de selectie + staf schrijft mee; sluit een
//   week na de wedstrijddag (daarna 403, eerlijk gemeld)
// • gasten via e-mail + link zonder account; gast ziet het hele plan
//   (leesbaar), vervalt automatisch na de wedstrijd, intrekbaar; de historie
//   toont dát er een gast was (e-mail), niet wat die bekeek

import { Router } from "express";
import { randomBytes } from "node:crypto";
import {
  db,
  clubRaceEventsTable,
  clubRaceSelectionsTable,
  clubRaceBriefingsTable,
  clubRaceAssignmentsTable,
  clubRaceResultsTable,
  clubRaceEvaluationsTable,
  clubRaceGuestsTable,
  clubRaceDayScheduleTable,
  clubRaceVehiclesTable,
  clubRaceVehicleSeatsTable,
  racesTable,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, isNull, isNotNull } from "drizzle-orm";
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

async function inSelectie(eventId: number, clerkId: string) {
  const [row] = await db
    .select()
    .from(clubRaceSelectionsTable)
    .where(and(eq(clubRaceSelectionsTable.eventId, eventId), eq(clubRaceSelectionsTable.clerkId, clerkId)));
  return row ?? null;
}

// Amsterdam-lokale datum (nooit toISOString — UTC-dag-trap).
function amsDate(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(d);
}

// ── Briefings ────────────────────────────────────────────────────────────────

router.get("/briefings", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    const rows = await db
      .select()
      .from(clubRaceBriefingsTable)
      .where(eq(clubRaceBriefingsTable.eventId, le.event.id))
      .orderBy(asc(clubRaceBriefingsTable.createdAt));
    const staf = isStafRol(le.ctx);
    // Renners zien "renners" + "iedereen"; staf ziet "staf" + "iedereen" én —
    // als ploegleiderrechten — alles.
    const alles = isPloegleiderRechten(le.ctx, le.event);
    res.json(
      rows.filter((b) => {
        if (alles) return true;
        if (b.audience === "iedereen") return true;
        return staf ? b.audience === "staf" : b.audience === "renners";
      }),
    );
  } catch (err) {
    req.log.error({ err }, "briefings list failed");
    res.status(500).json({ error: "Briefings ophalen is niet gelukt." });
  }
});

router.post("/briefings", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    if (!isPloegleiderRechten(le.ctx, le.event)) {
      res.status(403).json({ error: "Alleen de ploegleider schrijft briefings." });
      return;
    }
    const title = str(req.body?.title);
    const body = str(req.body?.body);
    const audience = str(req.body?.audience) ?? "iedereen";
    if (!title || !body || !["renners", "staf", "iedereen"].includes(audience)) {
      res.status(400).json({ error: "Titel, inhoud en doelgroep (renners|staf|iedereen) zijn verplicht." });
      return;
    }
    const [row] = await db
      .insert(clubRaceBriefingsTable)
      .values({ eventId: le.event.id, audience, title, body, createdByClerkId: le.ctx.membership.clerkId })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "briefing create failed");
    res.status(500).json({ error: "Briefing opslaan is niet gelukt." });
  }
});

// ── Opdrachten per renner ────────────────────────────────────────────────────

router.get("/assignments", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    // Iedereen in de selectie (en staf) ziet elkaars opdracht — bewust open
    // binnen de ploeg.
    const zelf = await inSelectie(le.event.id, le.ctx.membership.clerkId);
    if (!zelf && !isStafRol(le.ctx)) {
      res.status(403).json({ error: "Opdrachten zijn zichtbaar voor de selectie en de staf." });
      return;
    }
    const rows = await db
      .select()
      .from(clubRaceAssignmentsTable)
      .where(eq(clubRaceAssignmentsTable.eventId, le.event.id))
      .orderBy(asc(clubRaceAssignmentsTable.riderClerkId));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "assignments list failed");
    res.status(500).json({ error: "Opdrachten ophalen is niet gelukt." });
  }
});

router.put("/assignments/:riderId", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    if (!isPloegleiderRechten(le.ctx, le.event)) {
      res.status(403).json({ error: "Alleen de ploegleider geeft opdrachten." });
      return;
    }
    const riderId = str(req.params["riderId"]);
    const body = str(req.body?.body);
    if (!riderId || !body) {
      res.status(400).json({ error: "Renner en opdracht zijn verplicht." });
      return;
    }
    const sel = await inSelectie(le.event.id, riderId);
    if (!sel || sel.role === "begeleider") {
      res.status(400).json({ error: "Deze persoon zit niet als renner in de selectie." });
      return;
    }
    const [bestaand] = await db
      .select()
      .from(clubRaceAssignmentsTable)
      .where(
        and(
          eq(clubRaceAssignmentsTable.eventId, le.event.id),
          eq(clubRaceAssignmentsTable.riderClerkId, riderId),
        ),
      );
    // Origineel wordt NIET bewaard — bewust besluit (patch D).
    const [row] = await db
      .insert(clubRaceAssignmentsTable)
      .values({
        eventId: le.event.id,
        riderClerkId: riderId,
        body,
        updatedByClerkId: le.ctx.membership.clerkId,
      })
      .onConflictDoUpdate({
        target: [clubRaceAssignmentsTable.eventId, clubRaceAssignmentsTable.riderClerkId],
        set: { body, updatedByClerkId: le.ctx.membership.clerkId, updatedAt: new Date() },
      })
      .returning();
    // Wijziging op de wedstrijddag zelf ⇒ renner krijgt DIRECT bericht.
    const isWedstrijddag = amsDate(new Date()) === le.event.raceDate;
    if (bestaand && isWedstrijddag) {
      void createNotification({
        clerkId: riderId,
        type: "club_update",
        title: "Je opdracht is aangepast",
        body: `Je opdracht voor "${le.event.name}" is op de wedstrijddag aangepast. Lees hem direct na.`,
        actionUrl: "/club",
        source: "club-races",
        dedupeKey: `assignment-daychange:${le.event.id}:${riderId}:${Date.now()}`,
      });
    }
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "assignment upsert failed");
    res.status(500).json({ error: "Opdracht opslaan is niet gelukt." });
  }
});

// ── Uitslag (handmatig) ──────────────────────────────────────────────────────

router.put("/results/:riderId", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    const riderId = str(req.params["riderId"]);
    if (!riderId) {
      res.status(400).json({ error: "Ongeldige renner." });
      return;
    }
    // Ook de renner ZELF mag zijn uitslag invullen.
    const magInvullen =
      isPloegleiderRechten(le.ctx, le.event) || le.ctx.membership.clerkId === riderId;
    if (!magInvullen) {
      res.status(403).json({ error: "Alleen de ploegleider of de renner zelf vult de uitslag in." });
      return;
    }
    const sel = await inSelectie(le.event.id, riderId);
    if (!sel || sel.role === "begeleider") {
      res.status(400).json({ error: "Deze persoon zit niet als renner in de selectie." });
      return;
    }
    const positionRaw = req.body?.position;
    const position =
      positionRaw == null || positionRaw === "" ? null : intParam(String(positionRaw));
    if (positionRaw != null && positionRaw !== "" && (position == null || position < 1)) {
      res.status(400).json({ error: "Uitslagpositie moet een positief getal zijn (of leeg)." });
      return;
    }
    const note = str(req.body?.note);
    const [row] = await db
      .insert(clubRaceResultsTable)
      .values({
        eventId: le.event.id,
        riderClerkId: riderId,
        position,
        note,
        enteredByClerkId: le.ctx.membership.clerkId,
      })
      .onConflictDoUpdate({
        target: [clubRaceResultsTable.eventId, clubRaceResultsTable.riderClerkId],
        set: { position, note, enteredByClerkId: le.ctx.membership.clerkId, updatedAt: new Date() },
      })
      .returning();
    // Persoonlijke historie: de gesynchroniseerde races-rij van de renner
    // krijgt het resultaat mee (alleen als die rij bestaat — eerlijk, geen
    // rij verzinnen).
    if (position != null) {
      await db
        .update(racesTable)
        .set({ result: { status: "finished" as const, position, note }, updatedAt: new Date() })
        .where(
          and(
            eq(racesTable.clerkId, riderId),
            eq(racesTable.clubEventId, le.event.id),
            isNotNull(racesTable.clubEventId),
          ),
        );
    }
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "result upsert failed");
    res.status(500).json({ error: "Uitslag opslaan is niet gelukt." });
  }
});

router.get("/results", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    const rows = await db
      .select()
      .from(clubRaceResultsTable)
      .where(eq(clubRaceResultsTable.eventId, le.event.id))
      .orderBy(asc(clubRaceResultsTable.position));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "results list failed");
    res.status(500).json({ error: "Uitslagen ophalen is niet gelukt." });
  }
});

// ── Ploegevaluatie ───────────────────────────────────────────────────────────

router.get("/evaluations", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    const rows = await db
      .select()
      .from(clubRaceEvaluationsTable)
      .where(eq(clubRaceEvaluationsTable.eventId, le.event.id))
      .orderBy(asc(clubRaceEvaluationsTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "evaluations list failed");
    res.status(500).json({ error: "Evaluaties ophalen is niet gelukt." });
  }
});

router.post("/evaluations", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    const zelf = await inSelectie(le.event.id, le.ctx.membership.clerkId);
    if (!zelf && !isStafRol(le.ctx)) {
      res.status(403).json({ error: "De evaluatie is voor de selectie en de staf." });
      return;
    }
    // Sluit een week na de wedstrijddag — eerlijk gemeld.
    const sluit = new Date(`${le.event.raceDate}T23:59:59+02:00`);
    sluit.setDate(sluit.getDate() + 7);
    if (new Date() > sluit) {
      res.status(403).json({ error: "De evaluatie is gesloten (een week na de wedstrijd)." });
      return;
    }
    const body = str(req.body?.body);
    if (!body) {
      res.status(400).json({ error: "Schrijf eerst je evaluatie." });
      return;
    }
    const [row] = await db
      .insert(clubRaceEvaluationsTable)
      .values({ eventId: le.event.id, authorClerkId: le.ctx.membership.clerkId, body })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "evaluation create failed");
    res.status(500).json({ error: "Evaluatie opslaan is niet gelukt." });
  }
});

// ── Gasten (e-mail + link zonder account) ────────────────────────────────────

router.post("/guests", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    if (!isPloegleiderRechten(le.ctx, le.event)) {
      res.status(403).json({ error: "Alleen de ploegleider nodigt gasten uit." });
      return;
    }
    const email = str(req.body?.email)?.toLowerCase() ?? null;
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      res.status(400).json({ error: "Een geldig e-mailadres is verplicht." });
      return;
    }
    // Patch D: de uitnodiger vinkt apart aan dat hij verantwoordelijk is voor
    // deze gast — zonder dat vinkje geen uitnodiging.
    if (req.body?.responsible !== true) {
      res.status(400).json({
        error: "Vink eerst aan dat je verantwoordelijk bent voor deze gast (responsible: true).",
      });
      return;
    }
    const token = randomBytes(24).toString("base64url");
    const [row] = await db
      .insert(clubRaceGuestsTable)
      .values({ eventId: le.event.id, email, token, invitedByClerkId: le.ctx.membership.clerkId })
      .returning();
    // Historie toont dát er een gast was.
    await writeClubAudit({
      clubId: le.ctx.club.id,
      actorClerkId: le.ctx.membership.clerkId,
      action: "wedstrijd_gast_uitgenodigd",
      targetType: "club_race_event",
      targetId: le.event.id,
      detail: { email },
    });
    res.status(201).json({ id: row!.id, email, guestUrl: `/api/race-guest/${token}` });
  } catch (err) {
    req.log.error({ err }, "guest invite failed");
    res.status(500).json({ error: "Gast uitnodigen is niet gelukt." });
  }
});

router.delete("/guests/:guestId", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    if (!isPloegleiderRechten(le.ctx, le.event)) {
      res.status(403).json({ error: "Alleen de ploegleider trekt gasttoegang in." });
      return;
    }
    const guestId = intParam(req.params["guestId"]);
    const [row] = await db
      .update(clubRaceGuestsTable)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(clubRaceGuestsTable.id, guestId ?? -1), eq(clubRaceGuestsTable.eventId, le.event.id)),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Gast niet gevonden." });
      return;
    }
    await writeClubAudit({
      clubId: le.ctx.club.id,
      actorClerkId: le.ctx.membership.clerkId,
      action: "wedstrijd_gast_ingetrokken",
      targetType: "club_race_event",
      targetId: le.event.id,
      detail: { email: row.email },
    });
    res.json({ revoked: true });
  } catch (err) {
    req.log.error({ err }, "guest revoke failed");
    res.status(500).json({ error: "Intrekken is niet gelukt." });
  }
});

// ── Wedstrijddagmodus (app-only, ploegleider én teammanager) ─────────────────
// Eén gebundeld overzicht voor op de telefoon: selectie, dagschema, vervoer,
// materiaalstatus, briefings, opdrachten en de vertrekcontrole in één call.
// De WEERGAVE is app-only (patch D); dit endpoint is de datalaag ervoor en
// weigert rollen zonder ploegleiderrechten.
router.get("/day-mode", requireAuth, async (req, res) => {
  try {
    const le = await loadCtxEvent(req, res);
    if (!le) return;
    if (!isPloegleiderRechten(le.ctx, le.event)) {
      res.status(403).json({ error: "De wedstrijddagmodus is voor de ploegleider en teammanager." });
      return;
    }
    const [selections, schedule, vehicles, briefings, assignments, results, evaluations] =
      await Promise.all([
        db.select().from(clubRaceSelectionsTable).where(eq(clubRaceSelectionsTable.eventId, le.event.id)),
        db
          .select()
          .from(clubRaceDayScheduleTable)
          .where(eq(clubRaceDayScheduleTable.eventId, le.event.id))
          .orderBy(asc(clubRaceDayScheduleTable.departTime)),
        db.select().from(clubRaceVehiclesTable).where(eq(clubRaceVehiclesTable.eventId, le.event.id)),
        db
          .select()
          .from(clubRaceBriefingsTable)
          .where(eq(clubRaceBriefingsTable.eventId, le.event.id))
          .orderBy(asc(clubRaceBriefingsTable.createdAt)),
        db
          .select()
          .from(clubRaceAssignmentsTable)
          .where(eq(clubRaceAssignmentsTable.eventId, le.event.id)),
        db
          .select()
          .from(clubRaceResultsTable)
          .where(eq(clubRaceResultsTable.eventId, le.event.id))
          .orderBy(asc(clubRaceResultsTable.position)),
        db
          .select()
          .from(clubRaceEvaluationsTable)
          .where(eq(clubRaceEvaluationsTable.eventId, le.event.id))
          .orderBy(desc(clubRaceEvaluationsTable.createdAt)),
      ]);
    const seats = vehicles.length
      ? await db
          .select()
          .from(clubRaceVehicleSeatsTable)
          .where(inArray(clubRaceVehicleSeatsTable.vehicleId, vehicles.map((v) => v.id)))
      : [];
    const { clubRaceMaterialItemsTable } = await import("@workspace/db");
    const material = await db
      .select()
      .from(clubRaceMaterialItemsTable)
      .where(eq(clubRaceMaterialItemsTable.eventId, le.event.id));
    const openMaterial = material.filter((m) => m.loadedAt == null);
    res.json({
      event: le.event,
      isRaceDay: amsDate(new Date()) === le.event.raceDate,
      selections,
      schedule,
      vehicles: vehicles.map((v) => ({
        ...v,
        passengers: seats.filter((s) => s.vehicleId === v.id).map((s) => s.clerkId),
      })),
      material: {
        total: material.length,
        loaded: material.length - openMaterial.length,
        open: openMaterial,
      },
      briefings,
      assignments,
      results,
      evaluations,
    });
  } catch (err) {
    req.log.error({ err }, "day mode failed");
    res.status(500).json({ error: "Wedstrijddagmodus laden is niet gelukt." });
  }
});

export default router;

// ── Publieke gastweergave (zonder account) ───────────────────────────────────
// Aparte router, gemount op /api/race-guest/:token — bewust ZONDER
// requireAuth. Gast ziet het hele plan leesbaar; toegang vervalt automatisch
// nadat de wedstrijddag voorbij is en bij intrekking.
export const raceGuestPublicRouter = Router();

raceGuestPublicRouter.get("/:token", async (req, res) => {
  try {
    const token = str(req.params["token"]);
    const [guest] = token
      ? await db.select().from(clubRaceGuestsTable).where(eq(clubRaceGuestsTable.token, token))
      : [];
    if (!guest || guest.revokedAt != null) {
      res.status(404).json({ error: "Deze gastlink is niet (meer) geldig." });
      return;
    }
    const [event] = await db
      .select()
      .from(clubRaceEventsTable)
      .where(eq(clubRaceEventsTable.id, guest.eventId));
    if (!event) {
      res.status(404).json({ error: "Deze gastlink is niet (meer) geldig." });
      return;
    }
    // Vervalt automatisch ná de wedstrijddag.
    if (amsDate(new Date()) > event.raceDate) {
      res.status(410).json({ error: "Deze gastlink is verlopen: de wedstrijd is voorbij." });
      return;
    }
    const [selections, schedule, vehicles, briefings, assignments] = await Promise.all([
      db.select().from(clubRaceSelectionsTable).where(eq(clubRaceSelectionsTable.eventId, event.id)),
      db.select().from(clubRaceDayScheduleTable).where(eq(clubRaceDayScheduleTable.eventId, event.id)),
      db.select().from(clubRaceVehiclesTable).where(eq(clubRaceVehiclesTable.eventId, event.id)),
      db
        .select()
        .from(clubRaceBriefingsTable)
        .where(eq(clubRaceBriefingsTable.eventId, event.id)),
      db
        .select()
        .from(clubRaceAssignmentsTable)
        .where(eq(clubRaceAssignmentsTable.eventId, event.id)),
    ]);
    const seats = vehicles.length
      ? await db
          .select()
          .from(clubRaceVehicleSeatsTable)
          .where(inArray(clubRaceVehicleSeatsTable.vehicleId, vehicles.map((v) => v.id)))
      : [];
    res.json({
      event: { name: event.name, raceDate: event.raceDate, location: event.location },
      selections: selections.map((s) => ({ clerkId: s.clerkId, role: s.role })),
      schedule,
      vehicles: vehicles.map((v) => ({
        ...v,
        passengers: seats.filter((s) => s.vehicleId === v.id).map((s) => s.clerkId),
      })),
      briefings,
      assignments,
      readonly: true,
    });
  } catch (err) {
    req.log.error({ err }, "guest view failed");
    res.status(500).json({ error: "Gastweergave is niet gelukt." });
  }
});
