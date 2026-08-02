// HERSTEL_EN_AANVULLING_01 F4 (HA-16…HA-21) — documentuitdraai per evenement.
// Gemount onder /api/clubs/:clubId/races/:eventId/documents (routes/index.ts).
//
// Drie eerste rapporttypen door de ÉNE generator (lib/documents):
//   GET /dagschema.pdf        RT-12 — staf + geselecteerde renners
//   GET /bezetting.pdf        RT-13 — staf + geselecteerde renners
//   GET /materiaallijst.pdf   RT-14 — mechanieker, ploegleiderrechten, chauffeurs
//
// Rechten blijven bij CLUB_RECHTEN_01 (club-permissions) — deze laag leest
// alleen. Versienummer = telsom van uitdraai per evenement+type via
// admin_ops_log? Nee: deterministisch uit de laatste wijziging is niet
// betrouwbaar; we gebruiken een eenvoudige, eerlijke regel — versie = aantal
// eerdere uitgiftes + 1, bijgehouden in club_race_document_issues.

import { Router } from "express";
import {
  db,
  clubRaceEventsTable,
  clubRaceSelectionsTable,
  clubRaceDayScheduleTable,
  clubRaceVehiclesTable,
  clubRaceVehicleSeatsTable,
  clubRaceMaterialItemsTable,
  clubRaceDocumentIssuesTable,
  userProfilesTable,
} from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { getClubContext, canManageClub, hasClubRole, type ClubContext } from "../lib/club-permissions";
import { renderDocument } from "../lib/documents/generator";
import { bouwDagschema, bouwBezetting, bouwMateriaallijst } from "../lib/documents/templates";

const router = Router({ mergeParams: true });

function intParam(v: unknown): number | null {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
}
function amsVandaag(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
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
    hasClubRole(ctx, ["hoofdtrainer", "trainer", "assistent", "teammanager", "ploegleider", "mechanieker", "soigneur", "medical_staff"])
  );
}

async function loadCtxEvent(req: import("express").Request, res: import("express").Response) {
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
  return { ctx, event, clerkId };
}

async function inSelectie(eventId: number, clerkId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: clubRaceSelectionsTable.id })
    .from(clubRaceSelectionsTable)
    .where(and(eq(clubRaceSelectionsTable.eventId, eventId), eq(clubRaceSelectionsTable.clerkId, clerkId)));
  return row != null;
}

async function namenVoor(clerkIds: string[]): Promise<Map<string, string>> {
  const uniek = [...new Set(clerkIds)].filter(Boolean);
  if (uniek.length === 0) return new Map();
  const rows = await db
    .select({ clerkId: userProfilesTable.clerkId, displayName: userProfilesTable.displayName })
    .from(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, uniek));
  return new Map(rows.map((r) => [r.clerkId, r.displayName ?? "Onbekend lid"]));
}

/** Versie = aantal eerdere uitgiftes van dit type voor dit evenement + 1 —
 *  atomair vastgelegd in club_race_document_issues (wie, wat, wanneer). */
async function volgendeVersie(eventId: number, docType: string, clerkId: string): Promise<number> {
  const [row] = await db
    .insert(clubRaceDocumentIssuesTable)
    .values({
      eventId,
      docType,
      issuedByClerkId: clerkId,
      version: sql`(SELECT COALESCE(MAX(version), 0) + 1 FROM club_race_document_issues WHERE event_id = ${eventId} AND doc_type = ${docType})`,
    })
    .returning({ version: clubRaceDocumentIssuesTable.version });
  return row!.version;
}

function stuurPdf(res: import("express").Response, naam: string, buf: Buffer) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${naam}"`);
  res.send(buf);
}

// ── RT-12 Dagschema ─────────────────────────────────────────────────────────
router.get("/dagschema.pdf", requireAuth, async (req, res) => {
  try {
    const loaded = await loadCtxEvent(req, res);
    if (!loaded) return;
    const { ctx, event, clerkId } = loaded;
    if (!isStafRol(ctx) && !(await inSelectie(event.id, clerkId))) {
      res.status(403).json({ error: "Het dagschema is voor staf en geselecteerde deelnemers." });
      return;
    }
    const [regels, selectie] = await Promise.all([
      db.select().from(clubRaceDayScheduleTable).where(eq(clubRaceDayScheduleTable.eventId, event.id)),
      db.select().from(clubRaceSelectionsTable).where(eq(clubRaceSelectionsTable.eventId, event.id)),
    ]);
    const namen = await namenVoor([...regels.map((r) => r.clerkId), ...selectie.map((s) => s.clerkId)]);
    const versie = await volgendeVersie(event.id, "RT-12", clerkId);
    const ploegleiders = selectie.filter((s) => s.role === "ploegleider" || s.role === "teammanager");
    const contact = ploegleiders.length > 0 ? ploegleiders.map((p) => `${namen.get(p.clerkId) ?? "Onbekend lid"} (${p.role === "teammanager" ? "teammanager" : "ploegleider"})`).join(" · ") : null;
    const { kop, blokken } = bouwDagschema({
      event,
      regels,
      selectie,
      namen,
      contact,
      versie,
      vandaag: amsVandaag(),
      opsteller: "Ploegleider",
      wijzigingen: versie === 1 ? null : "Controleer de tijdlijn — dit is een nieuwe uitgifte; eerdere prints vervallen.",
    });
    stuurPdf(res, `dagschema-${event.raceDate}-v${versie}.pdf`, await renderDocument(kop, blokken));
  } catch (err) {
    (req.log?.error ?? console.error).call(req.log ?? console, { err }, "dagschema-pdf faalde");
    res.status(500).json({ error: "Dagschema kon niet worden gemaakt." });
  }
});

// ── RT-13 Wedstrijdbezetting ────────────────────────────────────────────────
router.get("/bezetting.pdf", requireAuth, async (req, res) => {
  try {
    const loaded = await loadCtxEvent(req, res);
    if (!loaded) return;
    const { ctx, event, clerkId } = loaded;
    if (!isStafRol(ctx) && !(await inSelectie(event.id, clerkId))) {
      res.status(403).json({ error: "De bezetting is voor staf en geselecteerde deelnemers." });
      return;
    }
    const selectie = await db.select().from(clubRaceSelectionsTable).where(eq(clubRaceSelectionsTable.eventId, event.id));
    const namen = await namenVoor(selectie.map((s) => s.clerkId));
    const versie = await volgendeVersie(event.id, "RT-13", clerkId);
    const { kop, blokken } = bouwBezetting({
      event,
      selectie,
      namen,
      versie,
      vandaag: amsVandaag(),
      opsteller: "Ploegleider",
    });
    stuurPdf(res, `bezetting-${event.raceDate}-v${versie}.pdf`, await renderDocument(kop, blokken));
  } catch (err) {
    req.log?.error({ err }, "bezetting-pdf faalde");
    res.status(500).json({ error: "Wedstrijdbezetting kon niet worden gemaakt." });
  }
});

// ── RT-14 Materiaal- en voertuigenlijst ─────────────────────────────────────
router.get("/materiaallijst.pdf", requireAuth, async (req, res) => {
  try {
    const loaded = await loadCtxEvent(req, res);
    if (!loaded) return;
    const { ctx, event, clerkId } = loaded;
    // Doelgroep RT-14: mechanieker, ploegleiderrechten en chauffeurs.
    const voertuigen = await db.select().from(clubRaceVehiclesTable).where(eq(clubRaceVehiclesTable.eventId, event.id));
    const isChauffeur = voertuigen.some((v) => v.driverClerkId === clerkId);
    if (!hasClubRole(ctx, ["mechanieker"]) && !isPloegleiderRechten(ctx, event) && !isChauffeur) {
      res.status(403).json({ error: "De materiaallijst is voor mechanieker, ploegleiding en chauffeurs." });
      return;
    }
    const [zitplaatsen, materiaal] = await Promise.all([
      voertuigen.length > 0
        ? db.select().from(clubRaceVehicleSeatsTable).where(inArray(clubRaceVehicleSeatsTable.vehicleId, voertuigen.map((v) => v.id)))
        : Promise.resolve([]),
      db.select().from(clubRaceMaterialItemsTable).where(eq(clubRaceMaterialItemsTable.eventId, event.id)),
    ]);
    const namen = await namenVoor([
      ...voertuigen.map((v) => v.driverClerkId).filter((x): x is string => x != null),
      ...zitplaatsen.map((z) => z.clerkId),
      ...materiaal.map((m) => m.riderClerkId),
    ]);
    const versie = await volgendeVersie(event.id, "RT-14", clerkId);
    const { kop, blokken } = bouwMateriaallijst({
      event,
      voertuigen,
      zitplaatsen,
      materiaal,
      namen,
      versie,
      vandaag: amsVandaag(),
      opsteller: "Mechanieker",
    });
    stuurPdf(res, `materiaallijst-${event.raceDate}-v${versie}.pdf`, await renderDocument(kop, blokken));
  } catch (err) {
    req.log?.error({ err }, "materiaallijst-pdf faalde");
    res.status(500).json({ error: "Materiaallijst kon niet worden gemaakt." });
  }
});

export default router;
