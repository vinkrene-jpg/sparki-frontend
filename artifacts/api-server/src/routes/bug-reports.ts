import { Router } from "express";
import { asc, desc, eq } from "drizzle-orm";
import {
  db,
  bugReportsTable,
  bugReportCommentsTable,
  userProfilesTable,
  bugReportStatuses,
  bugReportKinds,
  type BugReportStatus,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { isAdmin } from "../lib/flags";
import { ObjectStorageService } from "../lib/objectStorage";
import { createNotification } from "../lib/notifications";

const router = Router();
const objectStorageService = new ObjectStorageService();

// What the reporter is told when an admin moves their report to a new status.
// "new" is the submit default and never produces a notification.
const STATUS_NOTICE: Partial<
  Record<BugReportStatus, { title: string; body: (snippet: string) => string }>
> = {
  triaged: {
    title: "Je melding is opgepakt",
    body: (s) => `Sparki is met je melding aan de slag: "${s}"`,
  },
  fixed: {
    title: "Je melding is opgelost",
    body: (s) => `Goed nieuws — je melding is opgelost: "${s}"`,
  },
  rejected: {
    title: "Je melding is afgehandeld",
    body: (s) => `Sparki pakt deze melding niet verder op: "${s}"`,
  },
};

// Leid een leesbare schermnaam af uit de pagina-URL (alleen het pad).
function derivedScreen(pageUrl: string): string | null {
  try {
    const path = pageUrl.startsWith("http") ? new URL(pageUrl).pathname : pageUrl.split("?")[0]!;
    return path || null;
  } catch {
    return null;
  }
}

function snippetOf(description: string): string {
  const trimmed = description.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 79)}…` : trimmed;
}

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

  const kindRaw = typeof body.kind === "string" ? body.kind : "bug";
  const kind = (bugReportKinds as readonly string[]).includes(kindRaw)
    ? kindRaw
    : "bug";

  // A screenshot is an object just uploaded via the presigned PUT flow. Its
  // canonical path (e.g. /objects/<id>) is what the client sends. We register
  // ownership (private, owner = reporter) now that the bytes exist, then store
  // the path. Admins are additionally allowed to read it on the serve route.
  // Supportcontext (Golf 14): scherm/appversie/correlatie worden server-side
  // afgeleid; technische context reist alleen mee met expliciete toestemming.
  const contextConsent = body.contextConsent === true;
  const pageUrl = str(body.pageUrl);
  const screen = str(body.screen) ?? (pageUrl ? derivedScreen(pageUrl) : null);
  const appVersion = contextConsent
    ? (str(req.get("x-sparki-app-version")) ?? str(body.appVersion))
    : null;
  const correlationId = contextConsent
    ? String((req as { id?: string | number }).id ?? "") || null
    : null;

  const screenshotObjectPath = str(body.screenshotObjectPath);
  if (screenshotObjectPath) {
    try {
      await objectStorageService.trySetObjectEntityAclPolicy(
        screenshotObjectPath,
        { owner: clerkId, visibility: "private" },
      );
    } catch (err) {
      req.log.error({ err }, "bugReports.screenshot ACL set failed");
    }
  }

  try {
    const [row] = await db
      .insert(bugReportsTable)
      .values({
        clerkId,
        description,
        kind,
        userRole: str(body.userRole),
        pageUrl,
        screen,
        appVersion,
        correlationId,
        contextConsent,
        // Prefer the uploaded object path; fall back to a legacy URL string.
        screenshotUrl: screenshotObjectPath ?? str(body.screenshotUrl),
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
        kind: bugReportsTable.kind,
        pageUrl: bugReportsTable.pageUrl,
        screen: bugReportsTable.screen,
        appVersion: bugReportsTable.appVersion,
        correlationId: bugReportsTable.correlationId,
        contextConsent: bugReportsTable.contextConsent,
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
    // Read the current report first so we know the previous status and the
    // reporter to notify (and only notify when the status actually changes).
    const [existing] = await db
      .select()
      .from(bugReportsTable)
      .where(eq(bugReportsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Melding niet gevonden" });
      return;
    }

    const newStatus = status as BugReportStatus;
    const [row] = await db
      .update(bugReportsTable)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(bugReportsTable.id, id))
      .returning();

    // Close the loop with the original submitter: tell them in-app when their
    // report is picked up or resolved. Skip if nothing changed, and never spam
    // the same status twice (dedupe on the body).
    const notice = STATUS_NOTICE[newStatus];
    if (notice && existing.status !== newStatus) {
      const body = notice.body(snippetOf(existing.description));
      await createNotification({
        clerkId: existing.clerkId,
        type: "system",
        title: notice.title,
        body,
        priority: newStatus === "fixed" ? "high" : "normal",
        actionUrl: "/you",
        dedupeWithin: { type: "system", matchBody: body },
      });
    }

    res.json({ report: row });
  } catch (err) {
    req.log.error({ err }, "bugReports.updateStatus failed");
    res.status(500).json({ error: "Kon status niet bijwerken" });
  }
});

// Whoever may read/write a report's thread: the original reporter (their own
// report) or any admin. Returns the report plus the caller's role on it, or null
// when the report does not exist / the caller is not allowed.
async function authorizeThread(
  clerkId: string,
  reportId: number,
): Promise<{
  report: typeof bugReportsTable.$inferSelect;
  role: "reporter" | "admin";
} | null> {
  const [report] = await db
    .select()
    .from(bugReportsTable)
    .where(eq(bugReportsTable.id, reportId))
    .limit(1);
  if (!report) return null;
  if (report.clerkId === clerkId) return { report, role: "reporter" };
  if (isAdmin(clerkId)) return { report, role: "admin" };
  return null;
}

// GET /api/bug-reports/:id/comments — the chronological thread on a report.
// Readable by the reporter (own report) or any admin.
router.get("/:id/comments", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const access = await authorizeThread(clerkId, id);
    if (!access) {
      res.status(404).json({ error: "Melding niet gevonden" });
      return;
    }
    const comments = await db
      .select({
        id: bugReportCommentsTable.id,
        authorRole: bugReportCommentsTable.authorRole,
        body: bugReportCommentsTable.body,
        createdAt: bugReportCommentsTable.createdAt,
      })
      .from(bugReportCommentsTable)
      .where(eq(bugReportCommentsTable.bugReportId, id))
      .orderBy(asc(bugReportCommentsTable.createdAt));
    res.json({ comments });
  } catch (err) {
    req.log.error({ err }, "bugReports.comments.list failed");
    res.status(500).json({ error: "Kon reacties niet laden" });
  }
});

// POST /api/bug-reports/:id/comments — add a follow-up message to the thread.
// The reporter adds a missing detail / answers; an admin replies or asks back.
// When an admin posts, the reporter gets an in-app notice (framed as Sparki).
router.post("/:id/comments", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const text =
    typeof body.body === "string" ? body.body.trim() : "";
  if (text.length < 1) {
    res.status(400).json({ error: "Bericht is leeg" });
    return;
  }
  if (text.length > 2000) {
    res.status(400).json({ error: "Bericht is te lang" });
    return;
  }
  try {
    const access = await authorizeThread(clerkId, id);
    if (!access) {
      res.status(404).json({ error: "Melding niet gevonden" });
      return;
    }

    const [comment] = await db
      .insert(bugReportCommentsTable)
      .values({
        bugReportId: id,
        clerkId,
        authorRole: access.role,
        body: text,
      })
      .returning({
        id: bugReportCommentsTable.id,
        authorRole: bugReportCommentsTable.authorRole,
        body: bugReportCommentsTable.body,
        createdAt: bugReportCommentsTable.createdAt,
      });

    // Bump the report's updatedAt so a thread with new activity surfaces.
    await db
      .update(bugReportsTable)
      .set({ updatedAt: new Date() })
      .where(eq(bugReportsTable.id, id));

    // When an admin replies, close the loop with the reporter in-app. The
    // reporter posting their own message needs no self-notification.
    if (access.role === "admin") {
      await createNotification({
        clerkId: access.report.clerkId,
        type: "system",
        title: "Sparki heeft op je melding gereageerd",
        body: `Er staat een nieuw bericht bij je melding: "${snippetOf(
          access.report.description,
        )}"`,
        priority: "normal",
        actionUrl: "/you",
      });
    }

    res.status(201).json({ comment });
  } catch (err) {
    req.log.error({ err }, "bugReports.comments.create failed");
    res.status(500).json({ error: "Kon reactie niet opslaan" });
  }
});

export default router;
