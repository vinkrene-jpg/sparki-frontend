import { Router } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  userProfilesTable,
  parentReportsTable,
  parentMessagesTable,
  emergencyContactsTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { writeAudit } from "../lib/security/audit";
import {
  effectiveParentAccess,
  athleteAgeTier,
  sanitizePermissions,
  PARENT_CATEGORY_LABELS,
} from "../engines/coaching";
import {
  createNotification,
  resolveNotifications,
} from "../lib/notifications";

const router = Router();

// GET /api/links — the current athlete's linked coaches and parents, with the
// linked person's display name and link status. Used by the athlete You screen.
router.get("/", requireAuth, async (req, res) => {
  const me = getClerkUserId(req)!;
  try {
    const coaches = await db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
        email: userProfilesTable.email,
        status: coachAthleteLinksTable.status,
        createdAt: coachAthleteLinksTable.createdAt,
      })
      .from(coachAthleteLinksTable)
      .innerJoin(
        userProfilesTable,
        eq(userProfilesTable.clerkId, coachAthleteLinksTable.coachClerkId),
      )
      .where(eq(coachAthleteLinksTable.athleteClerkId, me));

    const parents = await db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
        email: userProfilesTable.email,
        status: parentAthleteLinksTable.status,
        createdAt: parentAthleteLinksTable.createdAt,
      })
      .from(parentAthleteLinksTable)
      .innerJoin(
        userProfilesTable,
        eq(userProfilesTable.clerkId, parentAthleteLinksTable.parentClerkId),
      )
      .where(eq(parentAthleteLinksTable.athleteClerkId, me));

    res.json({ coaches, parents });
  } catch (err) {
    req.log.error({ err }, "links.list failed");
    res.status(500).json({ error: "Kon koppelingen niet laden" });
  }
});

// DELETE /api/links/coach/:coachClerkId — athlete revokes a coach link.
router.delete("/coach/:coachClerkId", requireAuth, async (req, res) => {
  const me = getClerkUserId(req)!;
  try {
    // BB-09 (BUILD_01 F2): beëindigen = endedAt zetten, historie blijft.
    const result = await db
      .update(coachAthleteLinksTable)
      .set({ endedAt: new Date() })
      .where(
        and(
          eq(coachAthleteLinksTable.coachClerkId, String(req.params.coachClerkId)),
          eq(coachAthleteLinksTable.athleteClerkId, me),
          isNull(coachAthleteLinksTable.endedAt),
        ),
      );
    const removed = result.rowCount ?? 0;
    if (removed > 0) {
      void writeAudit({
        event: "link_change",
        actorClerkId: me,
        subjectClerkId: me,
        meta: { soort: "coach", coachClerkId: String(req.params.coachClerkId) },
        req,
      });
    }
    res.json({ ok: true, removed });
  } catch (err) {
    req.log.error({ err }, "links.revoke-coach failed");
    res.status(500).json({ error: "Kon koppeling niet verwijderen" });
  }
});

// DELETE /api/links/parent/:parentClerkId — athlete revokes a parent link.
router.delete("/parent/:parentClerkId", requireAuth, async (req, res) => {
  const me = getClerkUserId(req)!;
  try {
    // BB-09 (BUILD_01 F2): beëindigen = endedAt zetten, historie blijft.
    const result = await db
      .update(parentAthleteLinksTable)
      .set({ endedAt: new Date() })
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, String(req.params.parentClerkId)),
          eq(parentAthleteLinksTable.athleteClerkId, me),
          isNull(parentAthleteLinksTable.endedAt),
        ),
      );
    const removed = result.rowCount ?? 0;
    if (removed > 0) {
      void writeAudit({
        event: "link_change",
        actorClerkId: me,
        subjectClerkId: me,
        meta: { soort: "ouder", parentClerkId: String(req.params.parentClerkId) },
        req,
      });
    }
    res.json({ ok: true, removed });
  } catch (err) {
    req.log.error({ err }, "links.revoke-parent failed");
    res.status(500).json({ error: "Kon koppeling niet verwijderen" });
  }
});

// DELETE /api/links/as-coach/:athleteClerkId — a coach ends a link to an athlete
// from their own side. Scoped to coachClerkId = me, so a coach can only end a
// link where they are the coach (never someone else's link).
router.delete("/as-coach/:athleteClerkId", requireAuth, async (req, res) => {
  const me = getClerkUserId(req)!;
  try {
    await db
      .update(coachAthleteLinksTable)
      .set({ endedAt: new Date() })
      .where(
        and(
          eq(coachAthleteLinksTable.coachClerkId, me),
          eq(
            coachAthleteLinksTable.athleteClerkId,
            String(req.params.athleteClerkId),
          ),
          isNull(coachAthleteLinksTable.endedAt),
        ),
      );
    void writeAudit({
      event: "link_change",
      actorClerkId: me,
      subjectClerkId: String(req.params.athleteClerkId),
      meta: { soort: "coach", beeindigdDoor: "coach" },
      req,
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "links.end-as-coach failed");
    res.status(500).json({ error: "Kon koppeling niet verwijderen" });
  }
});

// DELETE /api/links/as-parent/:athleteClerkId — a parent ends a link to an
// athlete from their own side. Scoped to parentClerkId = me, so a parent can
// only end a link where they are the parent (never someone else's link).
router.delete("/as-parent/:athleteClerkId", requireAuth, async (req, res) => {
  const me = getClerkUserId(req)!;
  try {
    await db
      .update(parentAthleteLinksTable)
      .set({ endedAt: new Date() })
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, me),
          eq(
            parentAthleteLinksTable.athleteClerkId,
            String(req.params.athleteClerkId),
          ),
          isNull(parentAthleteLinksTable.endedAt),
        ),
      );
    void writeAudit({
      event: "link_change",
      actorClerkId: me,
      subjectClerkId: String(req.params.athleteClerkId),
      meta: { soort: "ouder", beeindigdDoor: "ouder" },
      req,
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "links.end-as-parent failed");
    res.status(500).json({ error: "Kon koppeling niet verwijderen" });
  }
});

// ---------------------------------------------------------------------------
// Sporter-kant van de ouderomgeving (Afbouwgolf 12)
// ---------------------------------------------------------------------------

// GET /api/links/parents/manage — per ouder-koppeling: relatie, effectieve
// toegang per gegevenstype en of herbevestiging nodig is.
router.get("/parents/manage", requireAuth, async (req, res) => {
  const me = getClerkUserId(req)!;
  try {
    const links = await db
      .select()
      .from(parentAthleteLinksTable)
      .where(eq(parentAthleteLinksTable.athleteClerkId, me));
    const parents = await Promise.all(
      links.map(async (link) => {
        const [p] = await db
          .select({
            displayName: userProfilesTable.displayName,
            email: userProfilesTable.email,
          })
          .from(userProfilesTable)
          .where(eq(userProfilesTable.clerkId, link.parentClerkId));
        const access =
          link.status === "accepted" && link.endedAt == null
            ? await effectiveParentAccess(link)
            : null;
        return {
          parentClerkId: link.parentClerkId,
          displayName: p?.displayName ?? null,
          email: p?.email ?? null,
          status: link.status,
          relationship: link.relationship,
          access,
          raw: link.permissions ?? null,
        };
      }),
    );
    res.json({ parents, categoryLabels: PARENT_CATEGORY_LABELS });
  } catch (err) {
    req.log.error({ err }, "links.parents-manage failed");
    res.status(500).json({ error: "Kon ouder-koppelingen niet laden" });
  }
});

// PUT /api/links/parent/:parentClerkId/permissions — de sporter beheert zelf
// wat er per ouder gedeeld wordt (geldt als bevestiging van de huidige
// leeftijdscategorie).
router.put(
  "/parent/:parentClerkId/permissions",
  requireAuth,
  async (req, res) => {
    const me = getClerkUserId(req)!;
    const parentId = String(req.params.parentClerkId);
    try {
      const [link] = await db
        .select()
        .from(parentAthleteLinksTable)
        .where(
          and(
            eq(parentAthleteLinksTable.parentClerkId, parentId),
            eq(parentAthleteLinksTable.athleteClerkId, me),
          ),
        );
      if (!link || link.status !== "accepted" || link.endedAt != null) {
        res.status(404).json({ error: "Koppeling niet gevonden" });
        return;
      }
      const permissions = sanitizePermissions(req.body?.permissions);
      if (!permissions) {
        res.status(400).json({ error: "Ongeldige rechten" });
        return;
      }
      const tier = await athleteAgeTier(me);
      await db
        .update(parentAthleteLinksTable)
        .set({
          permissions,
          permissionsUpdatedAt: new Date(),
          ageTierAtConsent: tier,
          consentConfirmedAt: new Date(),
        })
        .where(
          and(
            eq(parentAthleteLinksTable.parentClerkId, parentId),
            eq(parentAthleteLinksTable.athleteClerkId, me),
          ),
        );
      void writeAudit({
        event: "parent_permissions_changed",
        actorClerkId: me,
        subjectClerkId: me,
        meta: { door: "sporter", parentClerkId: parentId, rechten: permissions },
        req,
      });
      void createNotification({
        clerkId: parentId,
        type: "access_changed",
        title: "Gedeelde gegevens gewijzigd",
        body: "De sporter heeft aangepast welke gegevens met jou gedeeld worden.",
        athleteClerkId: me,
        actionUrl: "/",
        source: "koppelingen",
        audience: "parent",
        expiresAt: new Date(Date.now() + 14 * 86_400_000),
      });
      res.json({ ok: true });
    } catch (err) {
      req.log.error({ err }, "links.parent-permissions failed");
      res.status(500).json({ error: "Kon rechten niet opslaan" });
    }
  },
);

// POST /api/links/parent/:parentClerkId/reconfirm — sporter herbevestigt de
// bestaande rechten na een leeftijdscategoriewissel (rechten blijven staan).
router.post(
  "/parent/:parentClerkId/reconfirm",
  requireAuth,
  async (req, res) => {
    const me = getClerkUserId(req)!;
    const parentId = String(req.params.parentClerkId);
    try {
      const [link] = await db
        .select()
        .from(parentAthleteLinksTable)
        .where(
          and(
            eq(parentAthleteLinksTable.parentClerkId, parentId),
            eq(parentAthleteLinksTable.athleteClerkId, me),
          ),
        );
      if (!link || link.status !== "accepted" || link.endedAt != null) {
        res.status(404).json({ error: "Koppeling niet gevonden" });
        return;
      }
      const tier = await athleteAgeTier(me);
      await db
        .update(parentAthleteLinksTable)
        .set({ ageTierAtConsent: tier, consentConfirmedAt: new Date() })
        .where(
          and(
            eq(parentAthleteLinksTable.parentClerkId, parentId),
            eq(parentAthleteLinksTable.athleteClerkId, me),
          ),
        );
      void writeAudit({
        event: "consent_change",
        actorClerkId: me,
        subjectClerkId: me,
        meta: { soort: "herbevestiging", parentClerkId: parentId, tier },
        req,
      });
      // Golf 24: de herbevestiging is gedaan — de open melding verdwijnt.
      await resolveNotifications(me, `herbevestiging:${me}`);
      res.json({ ok: true, tier });
    } catch (err) {
      req.log.error({ err }, "links.parent-reconfirm failed");
      res.status(500).json({ error: "Kon niet herbevestigen" });
    }
  },
);

// GET /api/links/parent-reports — meldingen die ouders over mij deden.
router.get("/parent-reports", requireAuth, async (req, res) => {
  const me = getClerkUserId(req)!;
  try {
    const reports = await db
      .select()
      .from(parentReportsTable)
      .where(eq(parentReportsTable.athleteClerkId, me))
      .orderBy(desc(parentReportsTable.createdAt))
      .limit(20);
    res.json({ reports });
  } catch (err) {
    req.log.error({ err }, "links.parent-reports failed");
    res.status(500).json({ error: "Kon meldingen niet laden" });
  }
});

// POST /api/links/parent-reports/:id/status — sporter markeert een melding.
router.post("/parent-reports/:id/status", requireAuth, async (req, res) => {
  const me = getClerkUserId(req)!;
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  if (!Number.isFinite(id) || !["gezien", "afgerond"].includes(status)) {
    res.status(400).json({ error: "Ongeldige status" });
    return;
  }
  try {
    const [report] = await db
      .update(parentReportsTable)
      .set({
        status,
        ...(status === "afgerond" ? { resolvedAt: new Date() } : {}),
      })
      .where(
        and(
          eq(parentReportsTable.id, id),
          eq(parentReportsTable.athleteClerkId, me),
        ),
      )
      .returning();
    if (!report) {
      res.status(404).json({ error: "Melding niet gevonden" });
      return;
    }
    res.json({ report });
  } catch (err) {
    req.log.error({ err }, "links.parent-report-status failed");
    res.status(500).json({ error: "Kon status niet opslaan" });
  }
});

// Berichten sporter ↔ ouder, gespiegeld aan de ouderkant. Alleen wanneer de
// categorie "communicatie" op deze koppeling aan staat.
router.get("/parent/:parentClerkId/messages", requireAuth, async (req, res) => {
  const me = getClerkUserId(req)!;
  const parentId = String(req.params.parentClerkId);
  try {
    const [link] = await db
      .select()
      .from(parentAthleteLinksTable)
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, parentId),
          eq(parentAthleteLinksTable.athleteClerkId, me),
        ),
      );
    if (!link || link.status !== "accepted" || link.endedAt != null) {
      res.status(404).json({ error: "Koppeling niet gevonden" });
      return;
    }
    const access = await effectiveParentAccess(link);
    if (!access.permissions.communicatie) {
      res
        .status(403)
        .json({ error: "Berichten staan niet aan voor deze koppeling" });
      return;
    }
    const messages = await db
      .select()
      .from(parentMessagesTable)
      .where(
        and(
          eq(parentMessagesTable.parentClerkId, parentId),
          eq(parentMessagesTable.athleteClerkId, me),
        ),
      )
      .orderBy(desc(parentMessagesTable.createdAt))
      .limit(50);
    await db
      .update(parentMessagesTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(parentMessagesTable.parentClerkId, parentId),
          eq(parentMessagesTable.athleteClerkId, me),
          eq(parentMessagesTable.senderClerkId, parentId),
          isNull(parentMessagesTable.readAt),
        ),
      );
    res.json({ messages });
  } catch (err) {
    req.log.error({ err }, "links.parent-messages.get failed");
    res.status(500).json({ error: "Kon berichten niet laden" });
  }
});

router.post("/parent/:parentClerkId/messages", requireAuth, async (req, res) => {
  const me = getClerkUserId(req)!;
  const parentId = String(req.params.parentClerkId);
  try {
    const [link] = await db
      .select()
      .from(parentAthleteLinksTable)
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, parentId),
          eq(parentAthleteLinksTable.athleteClerkId, me),
        ),
      );
    if (!link || link.status !== "accepted" || link.endedAt != null) {
      res.status(404).json({ error: "Koppeling niet gevonden" });
      return;
    }
    const access = await effectiveParentAccess(link);
    if (!access.permissions.communicatie) {
      res
        .status(403)
        .json({ error: "Berichten staan niet aan voor deze koppeling" });
      return;
    }
    const body = String(req.body?.body ?? "").trim().slice(0, 1000);
    if (!body) {
      res.status(400).json({ error: "Bericht is leeg" });
      return;
    }
    const [message] = await db
      .insert(parentMessagesTable)
      .values({
        parentClerkId: parentId,
        athleteClerkId: me,
        senderClerkId: me,
        body,
      })
      .returning();
    void createNotification({
      clerkId: parentId,
      type: "parent_update",
      title: "Nieuw bericht van je sporter",
      body: body.slice(0, 120),
      athleteClerkId: me,
      actionUrl: "/",
    });
    res.status(201).json({ message });
  } catch (err) {
    req.log.error({ err }, "links.parent-messages.post failed");
    res.status(500).json({ error: "Kon bericht niet versturen" });
  }
});

// GET /api/links/emergency-contacts — eigen noodcontacten van de sporter.
router.get("/emergency-contacts", requireAuth, async (req, res) => {
  const me = getClerkUserId(req)!;
  try {
    const contacts = await db
      .select()
      .from(emergencyContactsTable)
      .where(eq(emergencyContactsTable.athleteClerkId, me))
      .orderBy(emergencyContactsTable.priority);
    res.json({ contacts });
  } catch (err) {
    req.log.error({ err }, "links.emergency-contacts failed");
    res.status(500).json({ error: "Kon noodcontacten niet laden" });
  }
});

export default router;
