import { Router } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { getUnreadCount } from "../lib/notifications";

const router = Router();

// GET /api/notifications?limit=&unread= — recent notifications + unread count.
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const unreadOnly = String(req.query.unread) === "true";
  try {
    const where = unreadOnly
      ? and(
          eq(notificationsTable.clerkId, clerkId),
          isNull(notificationsTable.readAt),
        )
      : eq(notificationsTable.clerkId, clerkId);
    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(where)
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limit);
    const unreadCount = await getUnreadCount(clerkId);
    res.json({ notifications, unreadCount });
  } catch (err) {
    req.log.error({ err }, "notifications.list failed");
    res.status(500).json({ error: "Kon meldingen niet laden" });
  }
});

// PATCH /api/notifications/:id/read — mark one read.
router.patch("/:id/read", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.clerkId, clerkId),
          isNull(notificationsTable.readAt),
        ),
      );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "notifications.read failed");
    res.status(500).json({ error: "Kon melding niet bijwerken" });
  }
});

// POST /api/notifications/read-all — mark all read.
router.post("/read-all", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.clerkId, clerkId),
          isNull(notificationsTable.readAt),
        ),
      );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "notifications.readAll failed");
    res.status(500).json({ error: "Kon meldingen niet bijwerken" });
  }
});

export default router;
