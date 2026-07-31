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
  FILE_PARSER_VERSION,
} from "../lib/activity-file-ingest";
import { scanRouteCandidatesForUser } from "../lib/ridden-route-candidates";
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

  // ── Eerlijke voorcontrole (validatie vóór verwerking) ──
  // Onbekende bestandstypen worden geweigerd met een duidelijke uitleg — geen
  // stille placeholder-rij voor bv. .jpg of .docx. CSV blijft (bestaand gedrag)
  // een eerlijk bewaarde placeholder totdat er een echte parser is.
  if (fileType === "unknown") {
    res.status(400).json({
      error:
        "Dit bestandstype wordt niet ondersteund. Sparki leest FIT-, GPX- en TCX-bestanden.",
    });
    return;
  }
  const isBinary = fileType === "fit";
  if (!isBinary && !content.trim()) {
    res.status(400).json({ error: "Het bestand is leeg" });
    return;
  }
  if (isBinary && !contentBase64.trim()) {
    res.status(400).json({ error: "Het bestand is leeg" });
    return;
  }
  // Server-side groottegrens (de JSON-bodylimiet vangt dit meestal al af, maar
  // hier krijgt de gebruiker een duidelijke Nederlandse uitleg).
  const MAX_TEXT_BYTES = 11 * 1024 * 1024;
  const MAX_FIT_BYTES = 8 * 1024 * 1024;
  if (!isBinary && Buffer.byteLength(content, "utf8") > MAX_TEXT_BYTES) {
    res.status(400).json({ error: "Bestand te groot (max 11 MB)" });
    return;
  }

  const insertFailed = async (errorMessage: string) => {
    const [row] = await db
      .insert(activityImportsTable)
      .values({
        clerkId,
        fileName,
        fileType,
        status: "failed",
        errorMessage,
        parserVersion: FILE_PARSER_VERSION,
      })
      .returning();
    res.status(201).json({ import: row, parsed: false });
  };

  // ── Duplicaatwaarschuwing vóór opslaan ──
  // Zelfde bytes (ook onder een andere bestandsnaam) → geen tweede import-rij
  // en geen nieuwe ingest; de gebruiker krijgt een eerlijke melding met de
  // bestaande import. De training zelf bestaat al (ingest is idempotent).
  const findDuplicate = async (checksum: string) => {
    const [existing] = await db
      .select()
      .from(activityImportsTable)
      .where(
        and(
          eq(activityImportsTable.clerkId, clerkId),
          eq(activityImportsTable.checksum, checksum),
        ),
      )
      .orderBy(desc(activityImportsTable.uploadedAt))
      .limit(1);
    return existing ?? null;
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
    let dedupeStatus: "new" | "merged_existing" | "route_only" | null = null;
    try {
      const result = await ingestActivityFile(
        clerkId,
        kind,
        summary as never,
        externalId,
      );
      sessionId = result.sessionId;
      // Eerlijke dedupe-uitkomst uit de echte ingest-telling: nieuw aangemaakt,
      // samengevoegd met een bestaande activiteit (bv. dezelfde rit via
      // Strava), of alleen een route (geen starttijd → geen training).
      dedupeStatus =
        sessionId == null
          ? "route_only"
          : (result.counts.merged ?? 0) > 0
            ? "merged_existing"
            : "new";
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
        checksum: externalId,
        parserVersion: FILE_PARSER_VERSION,
        dedupeStatus,
      })
      .returning();
    res.status(201).json({ import: row, parsed: true, sessionId });
    // Persoonlijke routekandidaten: nieuwe geïmporteerde sessie incrementeel
    // analyseren (na de respons, fire-and-forget — nooit blokkerend, nooit
    // een geslaagde import laten mislukken).
    if (sessionId != null) {
      scanRouteCandidatesForUser(clerkId).catch((err) =>
        req.log.warn({ err }, "routekandidaten-scan na import overgeslagen"),
      );
    }
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
      const gpxDup = await findDuplicate(gpxExternalId);
      if (gpxDup) {
        res.status(200).json({
          duplicate: true,
          import: gpxDup,
          message:
            "Dit bestand is al geïmporteerd — het is niet opnieuw opgeslagen.",
        });
        return;
      }
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
      if (buf.length === 0) {
        res.status(400).json({ error: "Het bestand is leeg" });
        return;
      }
      if (buf.length > MAX_FIT_BYTES) {
        res.status(400).json({ error: "Bestand te groot (max 8 MB)" });
        return;
      }
      const fitDupId = fileExternalId(buf, fileName);
      const fitDup = await findDuplicate(fitDupId);
      if (fitDup) {
        res.status(200).json({
          duplicate: true,
          import: fitDup,
          message:
            "Dit bestand is al geïmporteerd — het is niet opnieuw opgeslagen.",
        });
        return;
      }
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
      const tcxDup = await findDuplicate(tcxExternalId);
      if (tcxDup) {
        res.status(200).json({
          duplicate: true,
          import: tcxDup,
          message:
            "Dit bestand is al geïmporteerd — het is niet opnieuw opgeslagen.",
        });
        return;
      }
      const tcxStops = await learnRoadObjects(
        extractTimedTrackFromTcx(content),
        tcxExternalId,
      );
      const tcxSummary = summary as unknown as Record<string, unknown>;
      if (tcxStops) tcxSummary.roadStops = tcxStops;
      await insertParsed("tcx", tcxSummary, tcxExternalId);
      return;
    }

    // CSV: record the upload honestly as a placeholder (no parser yet). Wel
    // met checksum, zodat een dubbele upload herkend wordt.
    const csvChecksum = fileExternalId(content, fileName);
    const csvDup = await findDuplicate(csvChecksum);
    if (csvDup) {
      res.status(200).json({
        duplicate: true,
        import: csvDup,
        message:
          "Dit bestand is al geïmporteerd — het is niet opnieuw opgeslagen.",
      });
      return;
    }
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
        checksum: csvChecksum,
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
