import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  bugReportsTable,
  userProfilesTable,
  bugReportStatuses,
  type BugReportStatus,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { isAdmin } from "../lib/flags";

const router = Router();

function requireAdmin(
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof requireAuth>[1],
  next: Parameters<typeof requireAuth>[2],
) {
  const clerkId = getClerkUserId(req);
  if (!clerkId || !isAdmin(clerkId)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

// POST /api/bug-reports — any signed-in user/tester submits a report.
// Page URL + role are passed by the client (auto-captured there).
router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (description.length < 3) {
    res.status(400).json({ error: "Beschrijving is verplicht" });
    return;
  }
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  try {
    const [row] = await db
      .insert(bugReportsTable)
      .values({
        clerkId,
        description,
        userRole: str(body.userRole),
        pageUrl: str(body.pageUrl),
        screenshotUrl: str(body.screenshotUrl),
      })
      .returning();
    res.status(201).json({ report: row });
  } catch (err) {
    req.log.error({ err }, "bugReports.create failed");
    res.status(500).json({ error: "Kon melding niet opslaan" });
  }
});

// GET /api/bug-reports/mine — the caller's own reports.
router.get("/mine", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const reports = await db
      .select()
      .from(bugReportsTable)
      .where(eq(bugReportsTable.clerkId, clerkId))
      .orderBy(desc(bugReportsTable.createdAt))
      .limit(50);
    res.json({ reports });
  } catch (err) {
    req.log.error({ err }, "bugReports.mine failed");
    res.status(500).json({ error: "Kon meldingen niet laden" });
  }
});

// GET /api/bug-reports/admin — all reports with reporter name (admin only).
router.get("/admin", requireAuth, requireAdmin, async (req, res) => {
  try {
    const reports = await db
      .select({
        id: bugReportsTable.id,
        clerkId: bugReportsTable.clerkId,
        reporterName: userProfilesTable.displayName,
        userRole: bugReportsTable.userRole,
        pageUrl: bugReportsTable.pageUrl,
        description: bugReportsTable.description,
        screenshotUrl: bugReportsTable.screenshotUrl,
        status: bugReportsTable.status,
        createdAt: bugReportsTable.createdAt,
        updatedAt: bugReportsTable.updatedAt,
      })
      .from(bugReportsTable)
      .leftJoin(
        userProfilesTable,
        eq(bugReportsTable.clerkId, userProfilesTable.clerkId),
      )
      .orderBy(desc(bugReportsTable.createdAt))
      .limit(200);
    res.json({ reports });
  } catch (err) {
    req.log.error({ err }, "bugReports.adminList failed");
    res.status(500).json({ error: "Kon meldingen niet laden" });
  }
});

// PATCH /api/bug-reports/admin/:id — update triage status (admin only).
router.patch("/admin/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const status = (req.body ?? {}).status as unknown;
  if (
    typeof status !== "string" ||
    !(bugReportStatuses as readonly string[]).includes(status)
  ) {
    res.status(400).json({ error: "Ongeldige status" });
    return;
  }
  try {
    const [row] = await db
      .update(bugReportsTable)
      .set({ status: status as BugReportStatus, updatedAt: new Date() })
      .where(eq(bugReportsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Melding niet gevonden" });
      return;
    }
    res.json({ report: row });
  } catch (err) {
    req.log.error({ err }, "bugReports.updateStatus failed");
    res.status(500).json({ error: "Kon status niet bijwerken" });
  }
});

export default router;
