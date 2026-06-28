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
import { parseGpx, parseFit } from "../engines/route";

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
// GPX and FIT are parsed for real metrics now. TCX/CSV are recorded with status
// "uploaded" (honest placeholder — parsing not implemented yet; never faked).
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

  const insertParsed = async (summary: unknown) => {
    const [row] = await db
      .insert(activityImportsTable)
      .values({
        clerkId,
        fileName,
        fileType,
        status: "parsed",
        parsedSummary: summary as Record<string, unknown>,
      })
      .returning();
    res.status(201).json({ import: row, parsed: true });
  };

  try {
    if (fileType === "gpx") {
      const summary = parseGpx(content);
      if (!summary) {
        await insertFailed("Geen geldige trackpunten gevonden in GPX-bestand");
        return;
      }
      await insertParsed(summary);
      return;
    }

    if (fileType === "fit") {
      if (!contentBase64) {
        await insertFailed("Geen geldige FIT-gegevens ontvangen");
        return;
      }
      const buf = Buffer.from(contentBase64, "base64");
      const summary = parseFit(buf);
      if (!summary) {
        await insertFailed(
          "Geen geldige trainingsgegevens gevonden in FIT-bestand",
        );
        return;
      }
      await insertParsed(summary);
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
    const unlinkedStatus =
      imp.parsedSummary && (imp.fileType === "gpx" || imp.fileType === "fit")
        ? ("parsed" as const)
        : ("uploaded" as const);
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
