import { Router } from "express";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  notificationsTable,
  pushSubscriptionsTable,
  reminderKinds,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  getUnreadDayCount,
  groupNotificationsByDay,
} from "../lib/notifications";
import { getPrefs, updatePrefs, type PrefsPatch } from "../engines/reminders";
import { pushChannelStatus, isValidPushEndpoint } from "../lib/push";

const router = Router();

// ── Web Push ─────────────────────────────────────────────────────────────────
// GET /api/notifications/push/key — channel state + VAPID public key (so the
// browser can create a subscription). Honest: configured=false when no keys.
router.get("/push/key", requireAuth, async (_req, res) => {
  const status = pushChannelStatus();
  if (status.state === "ready") {
    res.json({ configured: true, publicKey: status.publicKey });
  } else {
    res.json({ configured: false, reason: status.reason });
  }
});

type SubscribeBody = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

// POST /api/notifications/push/subscribe — store (or refresh) this device's
// subscription. Upsert on the unique endpoint so re-subscribing is idempotent
// and a subscription that moved to another account is re-homed to the caller.
router.post("/push/subscribe", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as SubscribeBody;
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !auth) {
    res.status(400).json({ error: "Ongeldige push-aanmelding" });
    return;
  }
  // The endpoint is a URL the server later fetches when sending a push, so it
  // must belong to a known push service (SSRF guard) — never trust raw input.
  if (!isValidPushEndpoint(endpoint)) {
    res.status(400).json({ error: "Onbekende push-bestemming" });
    return;
  }
  const userAgent = req.get("user-agent")?.slice(0, 300) ?? null;
  try {
    await db
      .insert(pushSubscriptionsTable)
      .values({ clerkId, endpoint, p256dh, auth, userAgent })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: { clerkId, p256dh, auth, userAgent, lastSeenAt: new Date() },
      });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "notifications.push.subscribe failed");
    res.status(500).json({ error: "Kon push-aanmelding niet opslaan" });
  }
});

// POST /api/notifications/push/unsubscribe — remove this device's subscription.
router.post("/push/unsubscribe", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as { endpoint?: unknown };
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) {
    res.status(400).json({ error: "Ongeldige afmelding" });
    return;
  }
  try {
    await db
      .delete(pushSubscriptionsTable)
      .where(
        and(
          eq(pushSubscriptionsTable.clerkId, clerkId),
          eq(pushSubscriptionsTable.endpoint, endpoint),
        ),
      );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "notifications.push.unsubscribe failed");
    res.status(500).json({ error: "Kon afmelding niet verwerken" });
  }
});

// GET /api/notifications/preferences — the athlete's reminder preferences.
router.get("/preferences", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const preferences = await getPrefs(clerkId);
    res.json({ preferences });
  } catch (err) {
    req.log.error({ err }, "notifications.preferences.get failed");
    res.status(500).json({ error: "Kon voorkeuren niet laden" });
  }
});

// PUT /api/notifications/preferences — update reminder preferences (partial).
router.put("/preferences", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: PrefsPatch = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  for (const kind of reminderKinds) {
    if (typeof body[kind] === "boolean") {
      patch[kind] = body[kind] as boolean;
    }
  }
  try {
    const preferences = await updatePrefs(clerkId, patch);
    res.json({ preferences });
  } catch (err) {
    req.log.error({ err }, "notifications.preferences.put failed");
    res.status(500).json({ error: "Kon voorkeuren niet opslaan" });
  }
});

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
    // Fold the rows into at-most-one entry per calendar day for the bell. The
    // unread badge counts *days* with unread notifications, not the raw total.
    const groups = groupNotificationsByDay(notifications);
    const unreadCount = await getUnreadDayCount(clerkId);
    res.json({ groups, unreadCount });
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

// POST /api/notifications/read-batch — mark a set of notifications read in one
// go. Used when an athlete reads a combined day entry in the bell: the client
// passes every member id of that day so the whole day flips to read at once.
router.post("/read-batch", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as { ids?: unknown };
  const ids = Array.isArray(body.ids)
    ? body.ids
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v))
    : [];
  if (ids.length === 0) {
    res.status(400).json({ error: "Geen meldingen opgegeven" });
    return;
  }
  try {
    await db
      .update(notificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notificationsTable.clerkId, clerkId),
          inArray(notificationsTable.id, ids),
          isNull(notificationsTable.readAt),
        ),
      );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "notifications.readBatch failed");
    res.status(500).json({ error: "Kon meldingen niet bijwerken" });
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
