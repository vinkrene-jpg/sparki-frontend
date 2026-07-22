// Golf 26 — Gezondheids- en herstelflow: klachtenregistratie (géén diagnose),
// contextuele check-in, hervattingsbevestiging en zelfgekozen noodinformatie.
// Alle leespaden lopen via lib/health-flow (één waarheid, geen dubbele status).

import { Router } from "express";
import { and, desc, eq, ne } from "drizzle-orm";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  db,
  athleteProfilesTable,
  healthComplaintsTable,
  healthComplaintUpdatesTable,
  healthSafetyInfoTable,
  healthComplaintKinds,
  healthComplaintSeverities,
  healthTrainingImpacts,
  healthComplaintStatuses,
  type HealthComplaintKind,
  type HealthComplaintSeverity,
  type HealthTrainingImpact,
  type HealthComplaintStatus,
} from "@workspace/db";
import {
  getHealthOverview,
  getComplaintHistory,
  getCheckinContext,
  syncHealthStatus,
} from "../lib/health-flow";
import { recordValueEvent } from "../lib/passport";

const router = Router();

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

// Geldige kalenderdatum (rondreis-validatie, geen verzonnen datums).
function isValidDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// ── GET /api/health-flow/overview ────────────────────────────────────────────
router.get("/overview", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    res.json(await getHealthOverview(clerkId));
  } catch (err) {
    req.log.error({ err }, "health-flow.overview failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/health-flow/checkin-context ─────────────────────────────────────
router.get("/checkin-context", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    res.json(await getCheckinContext(clerkId));
  } catch (err) {
    req.log.error({ err }, "health-flow.checkin-context failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/health-flow/history ─────────────────────────────────────────────
// Bewuste stap (punt 12): historie alleen op verzoek, nooit opgedrongen.
router.get("/history", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    res.json(await getComplaintHistory(clerkId));
  } catch (err) {
    req.log.error({ err }, "health-flow.history failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/health-flow/complaints ─────────────────────────────────────────
router.post("/complaints", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const b = req.body as Record<string, unknown>;
  if (!isOneOf<HealthComplaintKind>(b.kind, healthComplaintKinds)) {
    res.status(400).json({ error: "kind moet ziekte, blessure of pijn zijn" });
    return;
  }
  if (!isOneOf<HealthComplaintSeverity>(b.severity, healthComplaintSeverities)) {
    res.status(400).json({ error: "severity moet licht, matig of ernstig zijn" });
    return;
  }
  if (!isOneOf<HealthTrainingImpact>(b.trainingImpact, healthTrainingImpacts)) {
    res
      .status(400)
      .json({ error: "trainingImpact moet geen, aangepast of niet_trainen zijn" });
    return;
  }
  if (!isValidDate(b.startDate)) {
    res.status(400).json({ error: "startDate moet een geldige datum zijn (JJJJ-MM-DD)" });
    return;
  }
  // Zelfregistratie: alleen de bronnen die de sporter zelf mag claimen.
  const source =
    b.source === "medisch_bevestigd" ? "medisch_bevestigd" : "zelfgerapporteerd";
  try {
    const [complaint] = await db
      .insert(healthComplaintsTable)
      .values({
        clerkId,
        kind: b.kind,
        bodyLocation:
          typeof b.bodyLocation === "string" && b.bodyLocation.trim()
            ? b.bodyLocation.trim().slice(0, 120)
            : null,
        severity: b.severity,
        startDate: b.startDate,
        trainingImpact: b.trainingImpact,
        source,
        professionalInstruction:
          typeof b.professionalInstruction === "string" &&
          b.professionalInstruction.trim()
            ? b.professionalInstruction.trim().slice(0, 2000)
            : null,
        notes:
          typeof b.notes === "string" && b.notes.trim()
            ? b.notes.trim().slice(0, 2000)
            : null,
        createdByClerkId: clerkId,
      })
      .returning();
    const healthStatus = await syncHealthStatus(clerkId, clerkId);
    res.status(201).json({ complaint, healthStatus });
  } catch (err) {
    req.log.error({ err }, "health-flow.complaints POST failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/health-flow/complaints/:id/updates ─────────────────────────────
// Verloop bijwerken: status, invloed, ernst en/of notitie — append-only.
router.post("/complaints/:id/updates", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Ongeldige klacht-id" });
    return;
  }
  const b = req.body as Record<string, unknown>;
  const status = isOneOf<HealthComplaintStatus>(b.status, healthComplaintStatuses)
    ? b.status
    : null;
  const trainingImpact = isOneOf<HealthTrainingImpact>(
    b.trainingImpact,
    healthTrainingImpacts,
  )
    ? b.trainingImpact
    : null;
  const severity = isOneOf<HealthComplaintSeverity>(
    b.severity,
    healthComplaintSeverities,
  )
    ? b.severity
    : null;
  const note =
    typeof b.note === "string" && b.note.trim()
      ? b.note.trim().slice(0, 2000)
      : null;
  if (!status && !trainingImpact && !severity && !note) {
    res.status(400).json({ error: "Geef minimaal één wijziging of notitie door" });
    return;
  }
  // "Hersteld" mag hier niet — dat loopt via de expliciete hervattingsflow.
  if (status === "hersteld") {
    res.status(400).json({
      error:
        "Volledig herstel bevestig je via de hervattingsstap, niet via een tussentijdse update.",
    });
    return;
  }
  try {
    const [complaint] = await db
      .select()
      .from(healthComplaintsTable)
      .where(
        and(
          eq(healthComplaintsTable.id, id),
          eq(healthComplaintsTable.clerkId, clerkId),
        ),
      )
      .limit(1);
    if (!complaint) {
      res.status(404).json({ error: "Klacht niet gevonden" });
      return;
    }
    if (complaint.status === "hersteld") {
      res.status(409).json({ error: "Deze klacht is al hersteld gemeld" });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.insert(healthComplaintUpdatesTable).values({
        complaintId: id,
        actorClerkId: clerkId,
        statusAfter: status,
        trainingImpactAfter: trainingImpact,
        severityAfter: severity,
        note,
      });
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (status) set.status = status;
      if (trainingImpact) set.trainingImpact = trainingImpact;
      if (severity) set.severity = severity;
      await tx
        .update(healthComplaintsTable)
        .set(set)
        .where(eq(healthComplaintsTable.id, id));
    });
    const healthStatus = await syncHealthStatus(clerkId, clerkId);
    res.json({ ok: true, healthStatus });
  } catch (err) {
    req.log.error({ err }, "health-flow.complaint update failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/health-flow/resume ─────────────────────────────────────────────
// Expliciete hervattingsbevestiging (punt 8) — nooit automatisch. Sluit alle
// openstaande klachten, zet de status op ok en start het opbouwvenster.
router.post("/resume", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const open = await db
      .select()
      .from(healthComplaintsTable)
      .where(
        and(
          eq(healthComplaintsTable.clerkId, clerkId),
          ne(healthComplaintsTable.status, "hersteld"),
        ),
      );
    const blocking = open.filter(
      (c) => c.status === "actief" && c.trainingImpact === "niet_trainen",
    );
    if (blocking.length > 0) {
      res.status(409).json({
        error:
          "Er staat nog een actieve klacht met 'niet trainen' open. Zet die eerst op 'herstellende' als het echt beter gaat.",
      });
      return;
    }
    const [profile] = await db
      .select({ healthStatus: athleteProfilesTable.healthStatus })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId))
      .limit(1);
    if (!profile) {
      res.status(404).json({ error: "Profiel niet gevonden" });
      return;
    }
    // Hervatten is alleen betekenisvol als er iets te hervatten valt: een
    // niet-ok status of nog openstaande klachten. Anders is dit een no-op
    // die stiekem een opbouwvenster zou starten — eerlijk weigeren (409).
    if (profile.healthStatus === "ok" && open.length === 0) {
      res.status(409).json({
        error: "Er is niets te hervatten: je staat al op 'ok' zonder open klachten.",
      });
      return;
    }
    const now = new Date();
    await db.transaction(async (tx) => {
      for (const c of open) {
        await tx.insert(healthComplaintUpdatesTable).values({
          complaintId: c.id,
          actorClerkId: clerkId,
          statusAfter: "hersteld",
          note: "Hervatting bevestigd door de sporter.",
        });
        await tx
          .update(healthComplaintsTable)
          .set({
            status: "hersteld",
            resolvedAt: now,
            resumptionConfirmedAt: now,
            updatedAt: now,
          })
          .where(eq(healthComplaintsTable.id, c.id));
      }
      if (profile.healthStatus !== "ok") {
        await tx
          .update(athleteProfilesTable)
          .set({ healthStatus: "ok", updatedAt: now })
          .where(eq(athleteProfilesTable.clerkId, clerkId));
        await recordValueEvent(
          {
            clerkId,
            field: "healthStatus",
            oldValue: profile.healthStatus,
            newValue: "ok",
            origin: "handmatig",
            source: "hervattingsbevestiging",
            actorType: "sporter",
            actorId: clerkId,
          },
          tx,
        );
      }
      // Zonder klachtrij (snelle ziek/geblesseerd-knop) toch een
      // hervattingsmoment vastleggen zodat het opbouwvenster start.
      if (open.length === 0) {
        await tx.insert(healthComplaintsTable).values({
          clerkId,
          kind: profile.healthStatus === "sick" ? "ziekte" : "blessure",
          severity: "licht",
          startDate: now.toISOString().slice(0, 10),
          trainingImpact: "aangepast",
          status: "hersteld",
          source: "zelfgerapporteerd",
          createdByClerkId: clerkId,
          resolvedAt: now,
          resumptionConfirmedAt: now,
          notes: "Automatisch afgesloten bij hervattingsbevestiging (snelle statusmelding zonder details).",
        });
      }
    });
    res.json(await getHealthOverview(clerkId));
  } catch (err) {
    req.log.error({ err }, "health-flow.resume failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET/PUT /api/health-flow/safety-info ─────────────────────────────────────
router.get("/safety-info", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [row] = await db
      .select()
      .from(healthSafetyInfoTable)
      .where(eq(healthSafetyInfoTable.clerkId, clerkId))
      .limit(1);
    res.json(row ?? { infoText: "", shareWithContacts: false });
  } catch (err) {
    req.log.error({ err }, "health-flow.safety-info GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/safety-info", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const b = req.body as Record<string, unknown>;
  const infoText =
    typeof b.infoText === "string" ? b.infoText.trim().slice(0, 2000) : "";
  const shareWithContacts = b.shareWithContacts === true;
  try {
    const [row] = await db
      .insert(healthSafetyInfoTable)
      .values({ clerkId, infoText, shareWithContacts, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: healthSafetyInfoTable.clerkId,
        set: { infoText, shareWithContacts, updatedAt: new Date() },
      })
      .returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "health-flow.safety-info PUT failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
