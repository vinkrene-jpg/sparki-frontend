import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  activityImportsTable,
  activityImportFileTypes,
  type ActivityImportFileType,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { parseGpx } from "../engines/route";

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
//   body: { fileName, content (text, for GPX), byteSize? }
// GPX is parsed for real metadata now. FIT/TCX/CSV are recorded with status
// "uploaded" (placeholder — parsing not implemented yet; we never fake values).
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
  const fileType = detectType(fileName);

  try {
    if (fileType === "gpx") {
      const summary = parseGpx(content);
      if (!summary) {
        const [row] = await db
          .insert(activityImportsTable)
          .values({
            clerkId,
            fileName,
            fileType,
            status: "failed",
            errorMessage: "Geen geldige trackpunten gevonden in GPX-bestand",
          })
          .returning();
        res.status(201).json({ import: row, parsed: false });
        return;
      }
      const [row] = await db
        .insert(activityImportsTable)
        .values({
          clerkId,
          fileName,
          fileType,
          status: "parsed",
          parsedSummary: summary,
        })
        .returning();
      res.status(201).json({ import: row, parsed: true });
      return;
    }

    // Non-GPX: record the upload honestly as a placeholder (not yet parsed).
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
