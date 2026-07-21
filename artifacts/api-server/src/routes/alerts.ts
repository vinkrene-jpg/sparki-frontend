import { Router } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  userProfilesTable,
  pushSubscriptionsTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { createNotification } from "../lib/notifications";
import { sendPush, pushChannelStatus } from "../lib/push";

const router = Router();

// POST /api/alerts/crash — the rider's device detected a possible fall during a
// ride and the rider did not respond to the on-screen check. Notify every
// ACCEPTED linked coach and parent with the last known location. Honest: the
// response tells the rider exactly how many people were reached (0 is 0).
router.post("/crash", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;

  const lat = typeof req.body?.lat === "number" ? req.body.lat : null;
  const lon = typeof req.body?.lon === "number" ? req.body.lon : null;
  const speedKmh =
    typeof req.body?.speedKmh === "number" && Number.isFinite(req.body.speedKmh)
      ? Math.max(0, Math.round(req.body.speedKmh))
      : null;
  if (
    lat === null ||
    lon === null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    res.status(400).json({ error: "Locatie (lat/lon) is verplicht" });
    return;
  }

  const [me] = await db
    .select({ displayName: userProfilesTable.displayName })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId))
    .limit(1);
  if (!me) {
    res.status(404).json({ error: "Profiel niet gevonden" });
    return;
  }
  const name = me.displayName?.trim() || "Een renner";

  const coaches = await db
    .select({ recipient: coachAthleteLinksTable.coachClerkId })
    .from(coachAthleteLinksTable)
    .where(
      and(
        eq(coachAthleteLinksTable.athleteClerkId, clerkId),
        eq(coachAthleteLinksTable.status, "accepted"),
      ),
    );
  const parents = await db
    .select({ recipient: parentAthleteLinksTable.parentClerkId })
    .from(parentAthleteLinksTable)
    .where(
      and(
        eq(parentAthleteLinksTable.athleteClerkId, clerkId),
        eq(parentAthleteLinksTable.status, "accepted"),
      ),
    );

  const recipients = Array.from(
    new Set([...coaches, ...parents].map((r) => r.recipient)),
  ).filter((r) => r !== clerkId);

  const mapsUrl = `https://www.google.com/maps?q=${lat.toFixed(5)},${lon.toFixed(5)}`;
  const title = `Mogelijk gevallen: ${name}`;
  const body = [
    `${name} reageerde niet na een mogelijke val tijdens een rit.`,
    speedKmh !== null ? `Laatst bekende snelheid: ${speedKmh} km/u.` : null,
    `Locatie: ${mapsUrl}`,
  ]
    .filter(Boolean)
    .join(" ");

  const canPush = pushChannelStatus().state === "ready";
  let pushed = 0;

  for (const recipient of recipients) {
    await createNotification({
      clerkId: recipient,
      athleteClerkId: clerkId,
      type: "system",
      priority: "high",
      title,
      body,
      actionUrl: mapsUrl,
    });

    if (canPush) {
      const subs = await db
        .select({
          id: pushSubscriptionsTable.id,
          endpoint: pushSubscriptionsTable.endpoint,
          p256dh: pushSubscriptionsTable.p256dh,
          auth: pushSubscriptionsTable.auth,
        })
        .from(pushSubscriptionsTable)
        .where(eq(pushSubscriptionsTable.clerkId, recipient));
      for (const sub of subs) {
        const r = await sendPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          { title, body, url: mapsUrl },
        );
        if (r.ok) pushed++;
        else if (r.prune) {
          await db
            .delete(pushSubscriptionsTable)
            .where(eq(pushSubscriptionsTable.id, sub.id));
        }
      }
    }
  }

  res.json({ notified: recipients.length, pushed });
});

export default router;
