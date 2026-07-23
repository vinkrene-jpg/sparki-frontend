import { Router } from "express";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import {
  db,
  friendLinksTable,
  clubTrainingsTable,
  clubTrainingSignupsTable,
  liveLocationSessionsTable,
  liveLocationGrantsTable,
  liveLocationPositionsTable,
  parentAthleteLinksTable,
  userProfilesTable,
  type LiveLocationAudience,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { athleteAgeTier } from "../lib/parent-permissions";
import {
  classifyAge,
  initialsFor,
  reliableHeading,
  sessionIsLive,
  validPosition,
  DROP_AFTER_MS,
  UNAVAILABLE_AFTER_MS,
} from "../lib/live-location";

const router = Router();

// ── Live locatie tijdens navigatie (Opdracht 4) — /api/live-location ────────
// Alle autorisatie zit server-side en wordt bij ELKE lezing opnieuw
// gecontroleerd: sessie actief, grant aanwezig, vriendschap nog geaccepteerd
// of groepsdeelname nog geldig. Standaard staat delen UIT; er bestaat geen
// enkel leesbaar eindpunt zonder actieve sessie + geldige toestemming.

/** Geaccepteerde vriendschappen van `clerkId` → set van vriend-ids. */
async function acceptedFriendIds(clerkId: string): Promise<Set<string>> {
  const rows = await db
    .select({
      requester: friendLinksTable.requesterClerkId,
      addressee: friendLinksTable.addresseeClerkId,
    })
    .from(friendLinksTable)
    .where(
      and(
        eq(friendLinksTable.status, "accepted"),
        or(
          eq(friendLinksTable.requesterClerkId, clerkId),
          eq(friendLinksTable.addresseeClerkId, clerkId),
        ),
      ),
    );
  const out = new Set<string>();
  for (const r of rows) out.add(r.requester === clerkId ? r.addressee : r.requester);
  return out;
}

/** Begeleiders (geaccepteerde ouderkoppelingen) van een sporter. */
async function guardianIds(athleteClerkId: string): Promise<Set<string>> {
  const rows = await db
    .select({ parent: parentAthleteLinksTable.parentClerkId })
    .from(parentAthleteLinksTable)
    .where(
      and(
        eq(parentAthleteLinksTable.athleteClerkId, athleteClerkId),
        eq(parentAthleteLinksTable.status, "accepted"),
      ),
    );
  return new Set(rows.map((r) => r.parent));
}

/** Actieve deelnemers (aangemeld) van een clubtraining. */
async function activeParticipants(trainingId: number): Promise<Set<string>> {
  const rows = await db
    .select({ clerkId: clubTrainingSignupsTable.clerkId })
    .from(clubTrainingSignupsTable)
    .where(
      and(
        eq(clubTrainingSignupsTable.trainingId, trainingId),
        eq(clubTrainingSignupsTable.status, "aangemeld"),
      ),
    );
  return new Set(rows.map((r) => r.clerkId));
}

/** Is de groepsrit vandaag en niet geannuleerd? (Amsterdam-lokale datum.) */
function trainingActiveToday(
  training: { trainingDate: string; status: string },
  now: Date,
): boolean {
  if (training.status === "geannuleerd") return false;
  const local = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Amsterdam",
  }).format(now); // YYYY-MM-DD
  return training.trainingDate === local;
}

async function endSessionsFor(clerkId: string, now: Date): Promise<number> {
  const open = await db
    .select({ id: liveLocationSessionsTable.id })
    .from(liveLocationSessionsTable)
    .where(
      and(
        eq(liveLocationSessionsTable.clerkId, clerkId),
        isNull(liveLocationSessionsTable.endedAt),
      ),
    );
  if (open.length === 0) return 0;
  const ids = open.map((r) => r.id);
  await db
    .update(liveLocationSessionsTable)
    .set({ endedAt: now })
    .where(inArray(liveLocationSessionsTable.id, ids));
  // Geen locatiegeschiedenis: positie direct verwijderen.
  await db
    .delete(liveLocationPositionsTable)
    .where(inArray(liveLocationPositionsTable.sessionId, ids));
  return ids.length;
}

// GET /api/live-location/group-options — groepsritten van VANDAAG waarvoor
// deze gebruiker is aangemeld (voor de deelkeuze bij navigatiestart).
router.get("/group-options", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const now = new Date();
    const rows = await db
      .select({
        training: clubTrainingsTable,
      })
      .from(clubTrainingSignupsTable)
      .innerJoin(
        clubTrainingsTable,
        eq(clubTrainingsTable.id, clubTrainingSignupsTable.trainingId),
      )
      .where(
        and(
          eq(clubTrainingSignupsTable.clerkId, clerkId),
          eq(clubTrainingSignupsTable.status, "aangemeld"),
        ),
      );
    const options = rows
      .filter((r) => trainingActiveToday(r.training, now))
      .map((r) => ({
        clubTrainingId: r.training.id,
        title: r.training.title,
        startTime: r.training.startTime,
      }));
    res.json({ options });
  } catch (err) {
    req.log.error({ err }, "live-location.group-options failed");
    res.status(500).json({ error: "Kon groepsritten niet lezen." });
  }
});

// POST /api/live-location/sessions — start een deelsessie (expliciete opt-in).
router.post("/sessions", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const audience = body.audience as LiveLocationAudience;
  if (audience !== "vrienden" && audience !== "groep") {
    res.status(400).json({ error: "Kies met wie je deelt: vrienden of groep." });
    return;
  }
  const now = new Date();
  try {
    let viewers: string[] = [];
    let clubTrainingId: number | null = null;

    if (audience === "vrienden") {
      const requested = Array.isArray(body.friendClerkIds)
        ? body.friendClerkIds.filter((v): v is string => typeof v === "string")
        : [];
      const unique = [...new Set(requested)].filter((id) => id !== clerkId);
      if (unique.length === 0) {
        res.status(400).json({ error: "Kies minstens één vriend." });
        return;
      }
      const friends = await acceptedFriendIds(clerkId);
      const invalid = unique.filter((id) => !friends.has(id));
      if (invalid.length > 0) {
        // Fail-closed: nooit stilzwijgend delen met iemand die geen
        // geaccepteerde vriend (meer) is.
        res.status(400).json({
          error: "Je kunt alleen delen met geaccepteerde vrienden.",
        });
        return;
      }
      viewers = unique;
    } else {
      const idRaw = Number(body.clubTrainingId);
      if (!Number.isInteger(idRaw) || idRaw <= 0) {
        res.status(400).json({ error: "Ongeldige groepsrit." });
        return;
      }
      const [training] = await db
        .select()
        .from(clubTrainingsTable)
        .where(eq(clubTrainingsTable.id, idRaw))
        .limit(1);
      if (!training) {
        res.status(404).json({ error: "Groepsrit niet gevonden." });
        return;
      }
      if (!trainingActiveToday(training, now)) {
        res.status(409).json({ error: "Deze groepsrit is nu niet actief." });
        return;
      }
      const participants = await activeParticipants(idRaw);
      if (!participants.has(clerkId)) {
        res.status(403).json({ error: "Je bent geen deelnemer van deze rit." });
        return;
      }
      participants.delete(clerkId);
      viewers = [...participants];

      // Minderjarig of onbekende leeftijd: fail-closed — alleen zichtbaar
      // voor groepsleden die óók geaccepteerde vriend of begeleider zijn.
      const tier = await athleteAgeTier(clerkId);
      if (tier !== "adult") {
        const friends = await acceptedFriendIds(clerkId);
        const guardians = await guardianIds(clerkId);
        viewers = viewers.filter((v) => friends.has(v) || guardians.has(v));
      }
      clubTrainingId = idRaw;
    }

    // Eén actieve sessie per gebruiker: een nieuwe start beëindigt de oude.
    await endSessionsFor(clerkId, now);
    const [session] = await db
      .insert(liveLocationSessionsTable)
      .values({ clerkId, audience, clubTrainingId, startedAt: now })
      .returning();
    if (viewers.length > 0) {
      await db
        .insert(liveLocationGrantsTable)
        .values(viewers.map((v) => ({ sessionId: session.id, viewerClerkId: v })))
        .onConflictDoNothing();
    }
    res.status(201).json({
      session: {
        id: session.id,
        audience,
        clubTrainingId,
        startedAt: session.startedAt,
        viewerCount: viewers.length,
      },
    });
  } catch (err) {
    req.log.error({ err }, "live-location.start failed");
    res.status(500).json({ error: "Kon het delen niet starten." });
  }
});

// GET /api/live-location/sessions/current — eigen actieve sessie (indicator).
router.get("/sessions/current", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const now = new Date();
    const [session] = await db
      .select()
      .from(liveLocationSessionsTable)
      .where(
        and(
          eq(liveLocationSessionsTable.clerkId, clerkId),
          isNull(liveLocationSessionsTable.endedAt),
        ),
      )
      .limit(1);
    if (!session) {
      res.json({ session: null });
      return;
    }
    const [pos] = await db
      .select()
      .from(liveLocationPositionsTable)
      .where(eq(liveLocationPositionsTable.sessionId, session.id))
      .limit(1);
    if (!sessionIsLive(session, pos?.updatedAt ?? null, now)) {
      await endSessionsFor(clerkId, now);
      res.json({ session: null });
      return;
    }
    const grants = await db
      .select({ id: liveLocationGrantsTable.id })
      .from(liveLocationGrantsTable)
      .where(eq(liveLocationGrantsTable.sessionId, session.id));
    res.json({
      session: {
        id: session.id,
        audience: session.audience,
        clubTrainingId: session.clubTrainingId,
        startedAt: session.startedAt,
        viewerCount: grants.length,
      },
    });
  } catch (err) {
    req.log.error({ err }, "live-location.current failed");
    res.status(500).json({ error: "Kon de deelstatus niet lezen." });
  }
});

// DELETE /api/live-location/sessions/current — stop delen (direct, server-side).
router.delete("/sessions/current", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const ended = await endSessionsFor(clerkId, new Date());
    res.json({ ok: true, ended });
  } catch (err) {
    req.log.error({ err }, "live-location.stop failed");
    res.status(500).json({ error: "Kon het delen niet stoppen." });
  }
});

// POST /api/live-location/positions — eigen positie bijwerken (alleen met
// actieve sessie; geen sessie = 409, er wordt niets opgeslagen).
router.post("/positions", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const pos = validPosition(body.lat, body.lon);
  if (!pos) {
    res.status(400).json({ error: "Ongeldige positie." });
    return;
  }
  const speedMps =
    typeof body.speedMps === "number" && Number.isFinite(body.speedMps) && body.speedMps >= 0
      ? body.speedMps
      : null;
  const headingDeg =
    typeof body.headingDeg === "number" && Number.isFinite(body.headingDeg)
      ? body.headingDeg
      : null;
  try {
    const now = new Date();
    const [session] = await db
      .select()
      .from(liveLocationSessionsTable)
      .where(
        and(
          eq(liveLocationSessionsTable.clerkId, clerkId),
          isNull(liveLocationSessionsTable.endedAt),
        ),
      )
      .limit(1);
    const [lastPos] = session
      ? await db
          .select({ updatedAt: liveLocationPositionsTable.updatedAt })
          .from(liveLocationPositionsTable)
          .where(eq(liveLocationPositionsTable.sessionId, session.id))
          .limit(1)
      : [];
    // Idle-verval telt vanaf de laatste positie, niet vanaf de sessiestart:
    // wie actief blijft sturen, blijft delen — hoe lang de rit ook duurt.
    if (!session || !sessionIsLive(session, lastPos?.updatedAt ?? null, now)) {
      res.status(409).json({ error: "Er is geen actieve deelsessie." });
      return;
    }
    await db
      .insert(liveLocationPositionsTable)
      .values({
        sessionId: session.id,
        lat: pos.lat,
        lon: pos.lon,
        speedMps,
        headingDeg,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: liveLocationPositionsTable.sessionId,
        set: { lat: pos.lat, lon: pos.lon, speedMps, headingDeg, updatedAt: now },
      });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "live-location.position failed");
    res.status(500).json({ error: "Kon de positie niet opslaan." });
  }
});

// GET /api/live-location/friends — posities die IK mag zien. Autorisatie
// wordt hier op leesmoment volledig opnieuw gecontroleerd.
router.get("/friends", requireAuth, async (req, res) => {
  const viewer = getClerkUserId(req)!;
  try {
    const now = new Date();
    const rows = await db
      .select({
        session: liveLocationSessionsTable,
        position: liveLocationPositionsTable,
        name: userProfilesTable.displayName,
      })
      .from(liveLocationGrantsTable)
      .innerJoin(
        liveLocationSessionsTable,
        eq(liveLocationGrantsTable.sessionId, liveLocationSessionsTable.id),
      )
      .leftJoin(
        liveLocationPositionsTable,
        eq(liveLocationPositionsTable.sessionId, liveLocationSessionsTable.id),
      )
      .innerJoin(
        userProfilesTable,
        eq(userProfilesTable.clerkId, liveLocationSessionsTable.clerkId),
      )
      .where(
        and(
          eq(liveLocationGrantsTable.viewerClerkId, viewer),
          isNull(liveLocationSessionsTable.endedAt),
        ),
      );

    const friends = await acceptedFriendIds(viewer);
    const out: Array<{
      clerkId: string;
      name: string;
      initials: string;
      lat: number | null;
      lon: number | null;
      headingDeg: number | null;
      ageSec: number | null;
      status: string;
      statusKind: string;
    }> = [];

    for (const row of rows) {
      const s = row.session;
      if (!sessionIsLive(s, row.position?.updatedAt ?? null, now)) continue;

      // Her-controle van de relatie op leesmoment (grant alleen is niet genoeg).
      if (s.audience === "vrienden") {
        if (!friends.has(s.clerkId)) continue; // vriendschap ingetrokken
      } else if (s.audience === "groep") {
        if (s.clubTrainingId == null) continue;
        const [training] = await db
          .select()
          .from(clubTrainingsTable)
          .where(eq(clubTrainingsTable.id, s.clubTrainingId))
          .limit(1);
        if (!training || !trainingActiveToday(training, now)) continue;
        const participants = await activeParticipants(s.clubTrainingId);
        if (!participants.has(viewer)) continue; // deelname beëindigd
        // Fail-closed her-controle op leesmoment: deelt een minderjarige of
        // iemand zonder bekende leeftijd, dan moet de kijker NU nog steeds
        // een geaccepteerde vriend of begeleider zijn — een grant van bij
        // de start is niet genoeg.
        const tier = await athleteAgeTier(s.clerkId);
        if (tier !== "adult") {
          const sharerFriends = await acceptedFriendIds(s.clerkId);
          const guardians = await guardianIds(s.clerkId);
          if (!sharerFriends.has(viewer) && !guardians.has(viewer)) continue;
        }
      } else {
        continue;
      }

      const pos = row.position;
      const ageMs = pos ? now.getTime() - pos.updatedAt.getTime() : null;
      if (ageMs != null && ageMs >= DROP_AFTER_MS) continue;
      const status =
        ageMs == null
          ? { kind: "niet_beschikbaar" as const, label: "Locatie niet meer beschikbaar" }
          : classifyAge(ageMs);
      const showCoords =
        pos != null && ageMs != null && ageMs < UNAVAILABLE_AFTER_MS;
      const name = row.name?.trim() || "Sparki-vriend";
      out.push({
        clerkId: s.clerkId,
        name,
        initials: initialsFor(name),
        // Verouderd voorbij de grens: eerlijk GEEN coördinaten — de marker
        // wordt nooit met geschatte of verzonnen data verplaatst.
        lat: showCoords ? pos.lat : null,
        lon: showCoords ? pos.lon : null,
        headingDeg: showCoords
          ? reliableHeading(pos.headingDeg, pos.speedMps)
          : null,
        ageSec: ageMs != null ? Math.round(ageMs / 1000) : null,
        status: status.label,
        statusKind: status.kind,
      });
    }
    res.json({ friends: out });
  } catch (err) {
    req.log.error({ err }, "live-location.friends failed");
    res.status(500).json({ error: "Kon vriendposities niet lezen." });
  }
});

export default router;
