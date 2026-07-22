import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  activityImportsTable,
  activityImportFileTypes,
  trainingSessionsTable,
  type ActivityImportFileType,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  parseGpx,
  parseGpxRoute,
  parseFit,
  parseTcx,
  computeRideSegments,
} from "../engines/route";
import {
  ingestActivityFile,
  fileExternalId,
  unlinkedImportStatus,
} from "../lib/activity-file-ingest";
import {
  extractTimedTrackFromGpx,
  extractTimedTrackFromTcx,
  recordStops,
  type TimedTrackPoint,
} from "../engines/road-objects";

const router = Router();

function detectType(fileName: string): ActivityImportFileType {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return (activityImportFileTypes as readonly string[]).includes(ext)
    ? (ext as ActivityImportFileType)
    : "unknown";
}

// GET /api/activity-imports — recent imports, newest first.
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  try {
    const imports = await db
      .select()
      .from(activityImportsTable)
      .where(eq(activityImportsTable.clerkId, clerkId))
      .orderBy(desc(activityImportsTable.uploadedAt))
      .limit(limit);
    res.json({ imports });
  } catch (err) {
    req.log.error({ err }, "activityImports.list failed");
    res.status(500).json({ error: "Kon imports niet laden" });
  }
});

// POST /api/activity-imports — upload an activity file.
//   body: { fileName, content (text — GPX/TCX/CSV), contentBase64 (binary — FIT) }
// GPX, FIT and TCX are parsed for real metrics AND ingested through the canonical
// Data Hub ("file" source): the upload becomes a real training session that
// merges with a same-time connector ride and feeds every downstream engine —
// the same path a manual TrainingPeaks export takes. A dated file links to its
// session ("linked"); a timeless GPX (a bare route) stays "parsed". CSV/unknown
// are recorded honestly as "uploaded" (no parser yet; never faked).
router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const fileName =
    typeof body.fileName === "string" && body.fileName.trim()
      ? body.fileName.trim()
      : null;
  if (!fileName) {
    res.status(400).json({ error: "fileName is verplicht" });
    return;
  }
  const content = typeof body.content === "string" ? body.content : "";
  // FIT is binary, so the client sends it base64-encoded. Strip a data-URL
  // prefix if one slipped in.
  const contentBase64 =
    typeof body.contentBase64 === "string"
      ? body.contentBase64.replace(/^data:[^;]*;base64,/, "")
      : "";
  const fileType = detectType(fileName);

  const insertFailed = async (errorMessage: string) => {
    const [row] = await db
      .insert(activityImportsTable)
      .values({ clerkId, fileName, fileType, status: "failed", errorMessage })
      .returning();
    res.status(201).json({ import: row, parsed: false });
  };

  // Persist a parsed file AND route it through the canonical Data Hub. When the
  // file carries a real start time it becomes (or merges into) a training
  // session and the import is "linked"; a timeless GPX (a bare route) has no
  // session and stays "parsed". A Data Hub hiccup never loses the parse — the
  // import is still recorded, with an honest note that no session was created.
  // Zelflerende wegobjecten: echte stops uit de van tijd voorziene track
  // voeden de Sparki Traffic Database (verkeerslichten/spoorwegovergangen).
  // Best-effort — een storing hier mag een upload nooit laten mislukken.
  // Retourneert de gedetecteerde stops (met kansverdeling) zodat ze in de
  // parsedSummary bewaard worden en de ritanalyse ze later kan tonen.
  const learnRoadObjects = async (
    track: TimedTrackPoint[],
    externalId: string,
  ) => {
    if (track.length < 3) return null;
    try {
      const result = await recordStops(clerkId, externalId, track);
      return result.stops.length > 0 ? result.stops : null;
    } catch (err) {
      req.log.error({ err }, "activityImports.roadObjects failed");
      return null;
    }
  };

  const insertParsed = async (
    kind: "gpx" | "fit" | "tcx",
    summary: Record<string, unknown>,
    externalId: string,
  ) => {
    let sessionId: number | null = null;
    let ingestError: string | null = null;
    try {
      const result = await ingestActivityFile(
        clerkId,
        kind,
        summary as never,
        externalId,
      );
      sessionId = result.sessionId;
    } catch (err) {
      req.log.error({ err }, "activityImports.ingest failed");
      ingestError = "Bestand verwerkt, maar er kon geen sessie worden aangemaakt";
    }
    const [row] = await db
      .insert(activityImportsTable)
      .values({
        clerkId,
        fileName,
        fileType,
        status: sessionId != null ? "linked" : "parsed",
        parsedSummary: summary,
        linkedTrainingSessionId: sessionId,
        errorMessage: ingestError,
      })
      .returning();
    res.status(201).json({ import: row, parsed: true, sessionId });
  };

  try {
    if (fileType === "gpx") {
      const summary = parseGpx(content);
      if (!summary) {
        await insertFailed("Geen geldige trackpunten gevonden in GPX-bestand");
        return;
      }
      // Also derive and keep the real track shape (geometry + elevation profile
      // + detected climbs) so this ridden ride can later be saved as a
      // re-ridable route — all from the same real <trkpt> data, never fabricated.
      const route = parseGpxRoute(content);
      // Rit-segmenten (klimmen/afdalingen mét echte prestatie per segment) —
      // alleen aanwezig als de track echte hoogte draagt; anders eerlijk weg.
      const segments = computeRideSegments(content);
      const merged: Record<string, unknown> = {
        ...(summary as unknown as Record<string, unknown>),
        segments: segments.length > 0 ? segments : null,
        route:
          route && route.geometry.length > 1
            ? {
                geometry: route.geometry,
                profile: route.profile,
                climbs: route.climbs,
                distanceKm: route.distanceKm,
                elevationGainM: route.elevationGainM,
                trackName: route.trackName,
              }
            : null,
      };
      const gpxExternalId = fileExternalId(content, fileName);
      const gpxStops = await learnRoadObjects(
        extractTimedTrackFromGpx(content),
        gpxExternalId,
      );
      if (gpxStops) merged.roadStops = gpxStops;
      await insertParsed("gpx", merged, gpxExternalId);
      return;
    }

    if (fileType === "fit") {
      if (!contentBase64) {
        await insertFailed("Geen geldige FIT-gegevens ontvangen");
        return;
      }
      const buf = Buffer.from(contentBase64, "base64");
      // Verzamel tijdens het parsen de echte GPS-samples (positie + tijd) voor
      // stop-detectie — het samenvattingsresultaat verandert hier niet door.
      const fitTrack: TimedTrackPoint[] = [];
      const summary = parseFit(buf, (lat, lon, timeMs) => {
        fitTrack.push({ lat, lon, timeMs });
      });
      if (!summary) {
        await insertFailed(
          "Geen geldige trainingsgegevens gevonden in FIT-bestand",
        );
        return;
      }
      const fitExternalId = fileExternalId(buf, fileName);
      const fitStops = await learnRoadObjects(fitTrack, fitExternalId);
      const fitSummary = summary as unknown as Record<string, unknown>;
      if (fitStops) fitSummary.roadStops = fitStops;
      await insertParsed("fit", fitSummary, fitExternalId);
      return;
    }

    if (fileType === "tcx") {
      const summary = parseTcx(content);
      if (!summary) {
        await insertFailed(
          "Geen geldige trainingsgegevens gevonden in TCX-bestand",
        );
        return;
      }
      const tcxExternalId = fileExternalId(content, fileName);
      const tcxStops = await learnRoadObjects(
        extractTimedTrackFromTcx(content),
        tcxExternalId,
      );
      const tcxSummary = summary as unknown as Record<string, unknown>;
      if (tcxStops) tcxSummary.roadStops = tcxStops;
      await insertParsed("tcx", tcxSummary, tcxExternalId);
      return;
    }

    // TCX/CSV (and unknown): record the upload honestly as a placeholder.
    const [row] = await db
      .insert(activityImportsTable)
      .values({
        clerkId,
        fileName,
        fileType,
        status: "uploaded",
        parsedSummary: {
          note: "Bestand geregistreerd. Parsing voor dit formaat komt later.",
        },
      })
      .returning();
    res.status(201).json({ import: row, parsed: false });
  } catch (err) {
    req.log.error({ err }, "activityImports.create failed");
    res.status(500).json({ error: "Kon bestand niet verwerken" });
  }
});

// PATCH /api/activity-imports/:id/link — link (or unlink) an import to one of
// the athlete's own training sessions. Both the import AND the session must
// belong to the caller (cross-tenant reference protection). Pass
// `{ sessionId: number }` to link, `{ sessionId: null }` to unlink.
router.patch("/:id/link", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const raw = body.sessionId;
  const sessionId =
    raw === null
      ? null
      : typeof raw === "number" && Number.isInteger(raw) && raw > 0
        ? raw
        : undefined;
  if (sessionId === undefined) {
    res.status(400).json({ error: "sessionId is verplicht (nummer of null)" });
    return;
  }
  try {
    const [imp] = await db
      .select()
      .from(activityImportsTable)
      .where(
        and(
          eq(activityImportsTable.id, id),
          eq(activityImportsTable.clerkId, clerkId),
        ),
      )
      .limit(1);
    if (!imp) {
      res.status(404).json({ error: "Import niet gevonden" });
      return;
    }
    if (sessionId != null && imp.status === "failed") {
      res
        .status(400)
        .json({ error: "Een mislukte import kun je niet koppelen" });
      return;
    }
    if (sessionId != null) {
      const [owned] = await db
        .select({ id: trainingSessionsTable.id })
        .from(trainingSessionsTable)
        .where(
          and(
            eq(trainingSessionsTable.id, sessionId),
            eq(trainingSessionsTable.clerkId, clerkId),
          ),
        )
        .limit(1);
      if (!owned) {
        res.status(400).json({ error: "Ongeldige trainingskoppeling" });
        return;
      }
    }
    // When unlinking, restore the honest pre-link status: "parsed" if the file
    // produced real metrics, otherwise "uploaded". ("failed" can't reach here.)
    const unlinkedStatus = unlinkedImportStatus(
      imp.fileType,
      !!imp.parsedSummary,
    );
    const [row] = await db
      .update(activityImportsTable)
      .set({
        linkedTrainingSessionId: sessionId,
        status: sessionId != null ? "linked" : unlinkedStatus,
      })
      .where(
        and(
          eq(activityImportsTable.id, id),
          eq(activityImportsTable.clerkId, clerkId),
        ),
      )
      .returning();
    res.json({ import: row });
  } catch (err) {
    req.log.error({ err }, "activityImports.link failed");
    res.status(500).json({ error: "Kon koppeling niet opslaan" });
  }
});

// DELETE /api/activity-imports/:id — remove an import (owner only).
router.delete("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    await db
      .delete(activityImportsTable)
      .where(
        and(
          eq(activityImportsTable.id, id),
          eq(activityImportsTable.clerkId, clerkId),
        ),
      );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "activityImports.delete failed");
    res.status(500).json({ error: "Kon import niet verwijderen" });
  }
});

export default router;
