import { Router } from "express";
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  db,
  parentAthleteLinksTable,
  coachAthleteLinksTable,
  userProfilesTable,
  athleteProfilesTable,
  athleteDailyMetricsTable,
  plannedWorkoutsTable,
  racesTable,
  parentReportsTable,
  emergencyContactsTable,
  parentConfirmationsTable,
  parentMessagesTable,
  parentReportKinds,
  type ParentAthleteLink,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { writeAudit } from "../lib/security/audit";
import {
  coachSharingLevel,
  hasRole,
  getEffectiveParentConsent,
  effectiveParentAccess,
  getParentLink,
  sanitizePermissions,
  athleteAgeTier,
  type EffectiveParentAccess,
} from "../engines/coaching";
import { getAthleteContextForViewer } from "../engines/context-memory";
import { createNotification } from "../lib/notifications";

const router = Router();

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/parent/athletes — linked children with a wellbeing/safety view.
// dataSharingParent gates the depth: none → nothing, safety_only → health +
// recovery + wellbeing signals, summary → + upcoming schedule.
router.get("/athletes", requireAuth, async (req, res) => {
  const parentId = getClerkUserId(req)!;
  if (!(await hasRole(parentId, "parent"))) {
    res.status(403).json({ error: "Ouder-rol vereist" });
    return;
  }
  try {
    const links = await db
      .select()
      .from(parentAthleteLinksTable)
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, parentId),
          eq(parentAthleteLinksTable.status, "accepted"),
        ),
      );
    if (links.length === 0) {
      res.json({ athletes: [] });
      return;
    }
    const ids = links.map((l) => l.athleteClerkId);

    const profiles = await db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
        healthStatus: athleteProfilesTable.healthStatus,
      })
      .from(userProfilesTable)
      .leftJoin(
        athleteProfilesTable,
        eq(athleteProfilesTable.clerkId, userProfilesTable.clerkId),
      )
      .where(inArray(userProfilesTable.clerkId, ids));

    const athletes = await Promise.all(
      profiles.map(async (p) => {
        const link = links.find((l) => l.athleteClerkId === p.clerkId)!;
        const consent = await getEffectiveParentConsent(p.clerkId);
        // Per-categorie rechten van déze koppeling — zelfde fail-closed laag
        // als /overview (kill-switch, leeftijdstier, herbevestiging).
        const access = await effectiveParentAccess(link);
        const perm = access.permissions;
        const base = {
          athleteClerkId: p.clerkId,
          displayName: p.displayName,
          sharing: access.level,
          parentConsentStatus: consent.parentConsentStatus,
        };
        if (access.level === "none") return base;

        const result: Record<string, unknown> = { ...base };

        if (perm.gezondheid) {
          result.healthStatus = p.healthStatus;
        }

        // Welzijnssignalen alleen per toegestane categorie — nooit
        // vermogens-/prestatiedata.
        if (perm.herstel || perm.slaap) {
          const [metric] = await db
            .select()
            .from(athleteDailyMetricsTable)
            .where(eq(athleteDailyMetricsTable.clerkId, p.clerkId))
            .orderBy(desc(athleteDailyMetricsTable.metricDate))
            .limit(1);
          result.wellbeing = metric
            ? {
                metricDate: metric.metricDate,
                ...(perm.slaap
                  ? {
                      sleepHours: metric.sleepHours,
                      sleepQuality: metric.sleepQuality,
                      fatigueScore: metric.fatigueScore,
                    }
                  : {}),
                ...(perm.herstel ? { feelScore: metric.feelScore } : {}),
              }
            : null;
        }

        if (perm.planning) {
          const schedule = await db
            .select({
              scheduledDate: plannedWorkoutsTable.scheduledDate,
              title: plannedWorkoutsTable.title,
              type: plannedWorkoutsTable.type,
            })
            .from(plannedWorkoutsTable)
            .where(
              and(
                eq(plannedWorkoutsTable.clerkId, p.clerkId),
                gte(plannedWorkoutsTable.scheduledDate, todayISO()),
              ),
            )
            .orderBy(plannedWorkoutsTable.scheduledDate)
            .limit(5);
          result.schedule = schedule;
        }
        return result;
      }),
    );
    res.json({ athletes });
  } catch (err) {
    req.log.error({ err }, "parent.athletes failed");
    res.status(500).json({ error: "Kon gekoppelde atleten niet laden" });
  }
});

// GET /api/parent/athletes/:athleteId/context — the child's personal-context
// memories, for a linked parent. Requires an accepted parent link AND
// dataSharingParent != none. Only Sparki's neutral title/detail is exposed.
router.get("/athletes/:athleteId/context", requireAuth, async (req, res) => {
  const parentId = getClerkUserId(req)!;
  if (!(await hasRole(parentId, "parent"))) {
    res.status(403).json({ error: "Ouder-rol vereist" });
    return;
  }
  const athleteId = String(req.params.athleteId);
  try {
    const link = await getParentLink(parentId, athleteId);
    if (!link || link.status !== "accepted") {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    // Zelfde fail-closed rechtenlaag als /overview: context valt onder het
    // veiligheidssignaal (gezondheid) en respecteert kill-switch, tier en
    // herbevestiging.
    const access = await effectiveParentAccess(link);
    const sharing = access.level;
    if (sharing === "none" || !access.permissions.gezondheid) {
      res.json({ sharing, memories: [], message: "Atleet deelt geen data" });
      return;
    }
    void writeAudit({
      event: "viewed_by_parent",
      actorClerkId: parentId,
      subjectClerkId: athleteId,
      meta: { rol: "ouder", niveau: sharing },
      req,
    });
    const memories = await getAthleteContextForViewer(athleteId);
    res.json({ sharing, memories });
  } catch (err) {
    req.log.error({ err }, "parent.athlete-context failed");
    res.status(500).json({ error: "Kon context niet laden" });
  }
});

// ---------------------------------------------------------------------------
// Ouder-/verzorgeromgeving (Afbouwgolf 12)
// ---------------------------------------------------------------------------

// Guard: ouder-rol + geaccepteerde koppeling. Geeft link + effectieve toegang.
async function requireParentAccess(
  parentId: string,
  athleteId: string,
): Promise<{ link: ParentAthleteLink; access: EffectiveParentAccess } | null> {
  if (!(await hasRole(parentId, "parent"))) return null;
  const link = await getParentLink(parentId, athleteId);
  if (!link || link.status !== "accepted") return null;
  const access = await effectiveParentAccess(link);
  return { link, access };
}

// GET /api/parent/overview — één overzicht per kind met uitsluitend
// toegestane informatie. Fail-closed per categorie.
router.get("/overview", requireAuth, async (req, res) => {
  const parentId = getClerkUserId(req)!;
  if (!(await hasRole(parentId, "parent"))) {
    res.status(403).json({ error: "Ouder-rol vereist" });
    return;
  }
  try {
    const links = await db
      .select()
      .from(parentAthleteLinksTable)
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, parentId),
          eq(parentAthleteLinksTable.status, "accepted"),
        ),
      );
    const today = todayISO();
    const children = await Promise.all(
      links.map(async (link) => {
        const athleteId = link.athleteClerkId;
        const [profile] = await db
          .select({
            displayName: userProfilesTable.displayName,
            healthStatus: athleteProfilesTable.healthStatus,
          })
          .from(userProfilesTable)
          .leftJoin(
            athleteProfilesTable,
            eq(athleteProfilesTable.clerkId, userProfilesTable.clerkId),
          )
          .where(eq(userProfilesTable.clerkId, athleteId));
        const access = await effectiveParentAccess(link);
        const perm = access.permissions;

        const child: Record<string, unknown> = {
          athleteClerkId: athleteId,
          displayName: profile?.displayName ?? null,
          relationship: link.relationship,
          access,
        };

        // Herbevestiging nodig → stil signaal naar de sporter (gededupliceerd).
        if (access.reconfirmRequired) {
          void createNotification({
            clerkId: athleteId,
            type: "consent_required",
            title: "Herbevestiging ouder-toegang nodig",
            body: `Je leeftijdscategorie is veranderd. Bevestig opnieuw wat je met je ouder/verzorger deelt.`,
            actionUrl: "/you?focus=connections",
            dedupeWithin: {
              type: "consent_required",
              matchBody: `Je leeftijdscategorie is veranderd. Bevestig opnieuw wat je met je ouder/verzorger deelt.`,
            },
          });
        }

        // Actuele algemene status + veiligheidssignaal.
        if (perm.gezondheid) {
          child.healthStatus = profile?.healthStatus ?? "ok";
          const openReports = await db
            .select()
            .from(parentReportsTable)
            .where(
              and(
                eq(parentReportsTable.athleteClerkId, athleteId),
                or(
                  eq(parentReportsTable.status, "open"),
                  eq(parentReportsTable.status, "gezien"),
                ),
              ),
            )
            .orderBy(desc(parentReportsTable.createdAt))
            .limit(3);
          child.openReports = openReports;
        }

        // Algemene herstel-/slaapsamenvatting (nooit vermogensdata).
        if (perm.herstel || perm.slaap) {
          const [metric] = await db
            .select()
            .from(athleteDailyMetricsTable)
            .where(eq(athleteDailyMetricsTable.clerkId, athleteId))
            .orderBy(desc(athleteDailyMetricsTable.metricDate))
            .limit(1);
          if (metric) {
            child.wellbeing = {
              metricDate: metric.metricDate,
              ...(perm.slaap
                ? {
                    sleepHours: metric.sleepHours,
                    sleepQuality: metric.sleepQuality,
                    fatigueScore: metric.fatigueScore,
                  }
                : {}),
              ...(perm.herstel ? { feelScore: metric.feelScore } : {}),
            };
          } else {
            child.wellbeing = null;
          }
        }

        // Training of wedstrijd vandaag.
        if (perm.planning) {
          const todayWorkouts = await db
            .select({
              id: plannedWorkoutsTable.id,
              title: plannedWorkoutsTable.title,
              type: plannedWorkoutsTable.type,
              scheduledDate: plannedWorkoutsTable.scheduledDate,
            })
            .from(plannedWorkoutsTable)
            .where(
              and(
                eq(plannedWorkoutsTable.clerkId, athleteId),
                eq(plannedWorkoutsTable.scheduledDate, today),
              ),
            )
            .limit(3);
          child.today = todayWorkouts;
        }
        if (perm.wedstrijd) {
          const upcoming = await db
            .select({
              id: racesTable.id,
              name: racesTable.name,
              raceDate: racesTable.raceDate,
            })
            .from(racesTable)
            .where(
              and(
                eq(racesTable.clerkId, athleteId),
                gte(racesTable.raceDate, today),
              ),
            )
            .orderBy(racesTable.raceDate)
            .limit(3);
          // Wedstrijden waarvoor deze ouder nog niets bevestigd heeft = actie.
          const confirmed = upcoming.length
            ? await db
                .select({
                  subjectId: parentConfirmationsTable.subjectId,
                  decision: parentConfirmationsTable.decision,
                })
                .from(parentConfirmationsTable)
                .where(
                  and(
                    eq(parentConfirmationsTable.parentClerkId, parentId),
                    eq(parentConfirmationsTable.athleteClerkId, athleteId),
                    eq(parentConfirmationsTable.subjectType, "race"),
                    inArray(
                      parentConfirmationsTable.subjectId,
                      upcoming.map((r) => String(r.id)),
                    ),
                  ),
                )
            : [];
          const confirmedMap = new Map(
            confirmed.map((c) => [c.subjectId, c.decision]),
          );
          child.races = upcoming.map((r) => ({
            ...r,
            parentDecision: confirmedMap.get(String(r.id)) ?? null,
          }));
        }

        // Berichten (alleen aantal ongelezen — inhoud via het berichtenkanaal).
        if (perm.communicatie) {
          const unread = await db
            .select({ id: parentMessagesTable.id })
            .from(parentMessagesTable)
            .where(
              and(
                eq(parentMessagesTable.parentClerkId, parentId),
                eq(parentMessagesTable.athleteClerkId, athleteId),
                eq(parentMessagesTable.senderClerkId, athleteId),
                isNull(parentMessagesTable.readAt),
              ),
            );
          child.unreadMessages = unread.length;
        }

        const contacts = await db
          .select()
          .from(emergencyContactsTable)
          .where(eq(emergencyContactsTable.athleteClerkId, athleteId))
          .orderBy(emergencyContactsTable.priority);
        child.emergencyContacts = contacts;

        return child;
      }),
    );

    // Inzage in gevoelige samenvattingen — één auditregel per aanvraag.
    void writeAudit({
      event: "viewed_by_parent",
      actorClerkId: parentId,
      meta: { scope: "overview", kinderen: children.length },
      req,
    });
    res.json({ children });
  } catch (err) {
    req.log.error({ err }, "parent.overview failed");
    res.status(500).json({ error: "Kon overzicht niet laden" });
  }
});

// GET /api/parent/athletes/:athleteId/permissions — rechten van deze koppeling.
router.get("/athletes/:athleteId/permissions", requireAuth, async (req, res) => {
  const parentId = getClerkUserId(req)!;
  const athleteId = String(req.params.athleteId);
  try {
    const ctx = await requireParentAccess(parentId, athleteId);
    if (!ctx) {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    res.json({
      relationship: ctx.link.relationship,
      access: ctx.access,
      raw: ctx.link.permissions ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "parent.permissions.get failed");
    res.status(500).json({ error: "Kon rechten niet laden" });
  }
});

// PUT /api/parent/athletes/:athleteId/permissions — ouder wijzigt rechten.
// Alleen toegestaan wanneer het kind <16 is (ouderlijke toestemming vereist);
// vanaf 16 beheert de sporter dit zelf (alleen-lezen voor de ouder).
router.put("/athletes/:athleteId/permissions", requireAuth, async (req, res) => {
  const parentId = getClerkUserId(req)!;
  const athleteId = String(req.params.athleteId);
  try {
    const ctx = await requireParentAccess(parentId, athleteId);
    if (!ctx) {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    const body = req.body ?? {};
    const relationship =
      body.relationship === "verzorger" || body.relationship === "ouder"
        ? String(body.relationship)
        : null;

    let permissionsUpdate: Record<string, boolean> | null = null;
    if (body.permissions !== undefined) {
      if (!ctx.access.parentMayEdit) {
        res.status(403).json({
          error:
            "Vanaf 16 jaar beheert de sporter zelf wat er gedeeld wordt.",
        });
        return;
      }
      permissionsUpdate = sanitizePermissions(body.permissions);
      if (!permissionsUpdate) {
        res.status(400).json({ error: "Ongeldige rechten" });
        return;
      }
    }
    if (!permissionsUpdate && !relationship) {
      res.status(400).json({ error: "Niets te wijzigen" });
      return;
    }

    const tier = await athleteAgeTier(athleteId);
    await db
      .update(parentAthleteLinksTable)
      .set({
        ...(relationship ? { relationship } : {}),
        ...(permissionsUpdate
          ? {
              permissions: permissionsUpdate,
              permissionsUpdatedAt: new Date(),
              ageTierAtConsent: tier,
              consentConfirmedAt: new Date(),
            }
          : {}),
      })
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, parentId),
          eq(parentAthleteLinksTable.athleteClerkId, athleteId),
        ),
      );

    if (permissionsUpdate) {
      void writeAudit({
        event: "parent_permissions_changed",
        actorClerkId: parentId,
        subjectClerkId: athleteId,
        meta: { door: "ouder", rechten: permissionsUpdate },
        req,
      });
      void createNotification({
        clerkId: athleteId,
        type: "access_changed",
        title: "Toegang ouder/verzorger gewijzigd",
        body: "Je ouder/verzorger heeft aangepast welke gegevens gedeeld worden. Bekijk het bij je koppelingen.",
        actionUrl: "/you?focus=connections",
      });
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "parent.permissions.put failed");
    res.status(500).json({ error: "Kon rechten niet opslaan" });
  }
});

// POST /api/parent/athletes/:athleteId/reports — ziek/blessure/afwezig melden.
// Altijd mogelijk op een geaccepteerde koppeling (veiligheidsactie). De melding
// is een signaal — géén diagnose en géén automatische trainingsbeslissing.
router.post("/athletes/:athleteId/reports", requireAuth, async (req, res) => {
  const parentId = getClerkUserId(req)!;
  const athleteId = String(req.params.athleteId);
  try {
    const ctx = await requireParentAccess(parentId, athleteId);
    if (!ctx) {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    const kind = String(req.body?.kind ?? "");
    if (!(parentReportKinds as readonly string[]).includes(kind)) {
      res.status(400).json({ error: "Ongeldige melding" });
      return;
    }
    const note =
      typeof req.body?.note === "string"
        ? req.body.note.trim().slice(0, 500) || null
        : null;

    const [report] = await db
      .insert(parentReportsTable)
      .values({ athleteClerkId: athleteId, parentClerkId: parentId, kind, note })
      .returning();

    void writeAudit({
      event: "reported_by_parent",
      actorClerkId: parentId,
      subjectClerkId: athleteId,
      meta: { soort: kind },
      req,
    });

    const kindLabel =
      kind === "ziek" ? "ziekmelding" : kind === "blessure" ? "blessuremelding" : "afwezigheidsmelding";
    void createNotification({
      clerkId: athleteId,
      type: "parent_report",
      title: `Nieuwe ${kindLabel}`,
      body: `Je ouder/verzorger heeft een ${kindLabel} gedaan. Sparki past niets automatisch aan — bekijk de melding.`,
      priority: "high",
      athleteClerkId: athleteId,
      actionUrl: "/you?focus=connections",
    });

    // Bevoegde coaches: alleen geaccepteerde coach-koppeling én deelniveau
    // dat niet op "none" staat (toestemming van de sporter).
    const sharing = await coachSharingLevel(athleteId);
    if (sharing !== "none") {
      const coaches = await db
        .select({ coachClerkId: coachAthleteLinksTable.coachClerkId })
        .from(coachAthleteLinksTable)
        .where(
          and(
            eq(coachAthleteLinksTable.athleteClerkId, athleteId),
            eq(coachAthleteLinksTable.status, "accepted"),
          ),
        );
      for (const c of coaches) {
        void createNotification({
          clerkId: c.coachClerkId,
          type: "parent_report",
          title: `Oudermelding: ${kindLabel}`,
          body: `Er is een ${kindLabel} gedaan voor een van je sporters. Dit is een signaal, geen diagnose.`,
          priority: "high",
          athleteClerkId: athleteId,
          actionUrl: "/coach",
        });
      }
    }
    res.status(201).json({ report });
  } catch (err) {
    req.log.error({ err }, "parent.reports.post failed");
    res.status(500).json({ error: "Kon melding niet opslaan" });
  }
});

// GET /api/parent/athletes/:athleteId/reports — eigen meldingen voor dit kind.
router.get("/athletes/:athleteId/reports", requireAuth, async (req, res) => {
  const parentId = getClerkUserId(req)!;
  const athleteId = String(req.params.athleteId);
  try {
    const ctx = await requireParentAccess(parentId, athleteId);
    if (!ctx) {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    const reports = await db
      .select()
      .from(parentReportsTable)
      .where(
        and(
          eq(parentReportsTable.athleteClerkId, athleteId),
          eq(parentReportsTable.parentClerkId, parentId),
        ),
      )
      .orderBy(desc(parentReportsTable.createdAt))
      .limit(20);
    res.json({ reports });
  } catch (err) {
    req.log.error({ err }, "parent.reports.get failed");
    res.status(500).json({ error: "Kon meldingen niet laden" });
  }
});

// Noodcontacten — beheer door gekoppelde ouder (veiligheid, altijd toegestaan
// op een geaccepteerde koppeling). Maximaal 5 per sporter.
router.get(
  "/athletes/:athleteId/emergency-contacts",
  requireAuth,
  async (req, res) => {
    const parentId = getClerkUserId(req)!;
    const athleteId = String(req.params.athleteId);
    try {
      const ctx = await requireParentAccess(parentId, athleteId);
      if (!ctx) {
        res.status(403).json({ error: "Geen gekoppelde atleet" });
        return;
      }
      const contacts = await db
        .select()
        .from(emergencyContactsTable)
        .where(eq(emergencyContactsTable.athleteClerkId, athleteId))
        .orderBy(emergencyContactsTable.priority);
      res.json({ contacts });
    } catch (err) {
      req.log.error({ err }, "parent.contacts.get failed");
      res.status(500).json({ error: "Kon noodcontacten niet laden" });
    }
  },
);

router.post(
  "/athletes/:athleteId/emergency-contacts",
  requireAuth,
  async (req, res) => {
    const parentId = getClerkUserId(req)!;
    const athleteId = String(req.params.athleteId);
    try {
      const ctx = await requireParentAccess(parentId, athleteId);
      if (!ctx) {
        res.status(403).json({ error: "Geen gekoppelde atleet" });
        return;
      }
      const name = String(req.body?.name ?? "").trim().slice(0, 120);
      const phone = String(req.body?.phone ?? "").trim().slice(0, 40);
      const relation =
        typeof req.body?.relation === "string"
          ? req.body.relation.trim().slice(0, 60) || null
          : null;
      if (!name || !phone) {
        res.status(400).json({ error: "Naam en telefoonnummer zijn verplicht" });
        return;
      }
      // Atomair: advisory-lock per sporter, zodat gelijktijdige verzoeken de
      // limiet van 5 niet kunnen overschrijden (count-then-insert race).
      const contact = await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${`noodcontact:${athleteId}`}))`,
        );
        const existing = await tx
          .select({ id: emergencyContactsTable.id })
          .from(emergencyContactsTable)
          .where(eq(emergencyContactsTable.athleteClerkId, athleteId));
        if (existing.length >= 5) return null;
        const [row] = await tx
          .insert(emergencyContactsTable)
          .values({
            athleteClerkId: athleteId,
            name,
            phone,
            relation,
            priority: existing.length + 1,
            createdByClerkId: parentId,
          })
          .returning();
        return row;
      });
      if (!contact) {
        res.status(400).json({ error: "Maximaal 5 noodcontacten" });
        return;
      }
      void writeAudit({
        event: "link_change",
        actorClerkId: parentId,
        subjectClerkId: athleteId,
        meta: { soort: "noodcontact", actie: "toegevoegd" },
        req,
      });
      res.status(201).json({ contact });
    } catch (err) {
      req.log.error({ err }, "parent.contacts.post failed");
      res.status(500).json({ error: "Kon noodcontact niet opslaan" });
    }
  },
);

router.put(
  "/athletes/:athleteId/emergency-contacts/:id",
  requireAuth,
  async (req, res) => {
    const parentId = getClerkUserId(req)!;
    const athleteId = String(req.params.athleteId);
    const id = Number(req.params.id);
    try {
      const ctx = await requireParentAccess(parentId, athleteId);
      if (!ctx || !Number.isFinite(id)) {
        res.status(403).json({ error: "Geen gekoppelde atleet" });
        return;
      }
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof req.body?.name === "string" && req.body.name.trim())
        patch.name = req.body.name.trim().slice(0, 120);
      if (typeof req.body?.phone === "string" && req.body.phone.trim())
        patch.phone = req.body.phone.trim().slice(0, 40);
      if (typeof req.body?.relation === "string")
        patch.relation = req.body.relation.trim().slice(0, 60) || null;
      const [contact] = await db
        .update(emergencyContactsTable)
        .set(patch)
        .where(
          and(
            eq(emergencyContactsTable.id, id),
            eq(emergencyContactsTable.athleteClerkId, athleteId),
          ),
        )
        .returning();
      if (!contact) {
        res.status(404).json({ error: "Noodcontact niet gevonden" });
        return;
      }
      void writeAudit({
        event: "link_change",
        actorClerkId: parentId,
        subjectClerkId: athleteId,
        meta: { soort: "noodcontact", actie: "gewijzigd", id },
        req,
      });
      res.json({ contact });
    } catch (err) {
      req.log.error({ err }, "parent.contacts.put failed");
      res.status(500).json({ error: "Kon noodcontact niet opslaan" });
    }
  },
);

router.delete(
  "/athletes/:athleteId/emergency-contacts/:id",
  requireAuth,
  async (req, res) => {
    const parentId = getClerkUserId(req)!;
    const athleteId = String(req.params.athleteId);
    const id = Number(req.params.id);
    try {
      const ctx = await requireParentAccess(parentId, athleteId);
      if (!ctx || !Number.isFinite(id)) {
        res.status(403).json({ error: "Geen gekoppelde atleet" });
        return;
      }
      const result = await db
        .delete(emergencyContactsTable)
        .where(
          and(
            eq(emergencyContactsTable.id, id),
            eq(emergencyContactsTable.athleteClerkId, athleteId),
          ),
        );
      void writeAudit({
        event: "link_change",
        actorClerkId: parentId,
        subjectClerkId: athleteId,
        meta: { soort: "noodcontact", actie: "verwijderd", id },
        req,
      });
      res.json({ ok: true, removed: result.rowCount ?? 0 });
    } catch (err) {
      req.log.error({ err }, "parent.contacts.delete failed");
      res.status(500).json({ error: "Kon noodcontact niet verwijderen" });
    }
  },
);

// POST /api/parent/athletes/:athleteId/confirmations — beschikbaarheid of
// wedstrijd-/clubdeelname bevestigen of afwijzen. Idempotent per onderwerp.
router.post(
  "/athletes/:athleteId/confirmations",
  requireAuth,
  async (req, res) => {
    const parentId = getClerkUserId(req)!;
    const athleteId = String(req.params.athleteId);
    try {
      const ctx = await requireParentAccess(parentId, athleteId);
      if (!ctx) {
        res.status(403).json({ error: "Geen gekoppelde atleet" });
        return;
      }
      const subjectType = String(req.body?.subjectType ?? "");
      const subjectId = String(req.body?.subjectId ?? "").slice(0, 80);
      const decision = String(req.body?.decision ?? "");
      const note =
        typeof req.body?.note === "string"
          ? req.body.note.trim().slice(0, 300) || null
          : null;
      const requiredPerm: Record<string, "wedstrijd" | "planning" | "aanwezigheid"> = {
        race: "wedstrijd",
        planning: "planning",
        club_training: "aanwezigheid",
      };
      const perm = requiredPerm[subjectType];
      if (!perm || !subjectId || !["bevestigd", "afgewezen"].includes(decision)) {
        res.status(400).json({ error: "Ongeldige bevestiging" });
        return;
      }
      if (!ctx.access.permissions[perm]) {
        res.status(403).json({
          error: "Deze categorie wordt niet met jou gedeeld",
        });
        return;
      }
      const [confirmation] = await db
        .insert(parentConfirmationsTable)
        .values({
          athleteClerkId: athleteId,
          parentClerkId: parentId,
          subjectType,
          subjectId,
          decision,
          note,
        })
        .onConflictDoUpdate({
          target: [
            parentConfirmationsTable.parentClerkId,
            parentConfirmationsTable.athleteClerkId,
            parentConfirmationsTable.subjectType,
            parentConfirmationsTable.subjectId,
          ],
          set: { decision, note, updatedAt: new Date() },
        })
        .returning();
      void writeAudit({
        event: "consent_change",
        actorClerkId: parentId,
        subjectClerkId: athleteId,
        meta: { soort: "ouderbevestiging", subjectType, subjectId, decision },
        req,
      });
      void createNotification({
        clerkId: athleteId,
        type: "parent_update",
        title:
          decision === "bevestigd"
            ? "Ouder/verzorger heeft bevestigd"
            : "Ouder/verzorger heeft afgewezen",
        body: `Je ouder/verzorger heeft ${
          subjectType === "race"
            ? "je wedstrijddeelname"
            : subjectType === "club_training"
              ? "je aanwezigheid bij de clubtraining"
              : "je planning"
        } ${decision}.`,
        athleteClerkId: athleteId,
        actionUrl: subjectType === "race" ? "/races" : "/",
      });
      res.json({ confirmation });
    } catch (err) {
      req.log.error({ err }, "parent.confirmations.post failed");
      res.status(500).json({ error: "Kon bevestiging niet opslaan" });
    }
  },
);

// Berichten ouder ↔ sporter — alleen wanneer de categorie "communicatie" aan
// staat op deze koppeling.
router.get("/athletes/:athleteId/messages", requireAuth, async (req, res) => {
  const parentId = getClerkUserId(req)!;
  const athleteId = String(req.params.athleteId);
  try {
    const ctx = await requireParentAccess(parentId, athleteId);
    if (!ctx) {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    if (!ctx.access.permissions.communicatie) {
      res.status(403).json({ error: "Berichten staan niet aan voor deze koppeling" });
      return;
    }
    const messages = await db
      .select()
      .from(parentMessagesTable)
      .where(
        and(
          eq(parentMessagesTable.parentClerkId, parentId),
          eq(parentMessagesTable.athleteClerkId, athleteId),
        ),
      )
      .orderBy(desc(parentMessagesTable.createdAt))
      .limit(50);
    // Berichten van de sporter als gelezen markeren voor de ouder.
    await db
      .update(parentMessagesTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(parentMessagesTable.parentClerkId, parentId),
          eq(parentMessagesTable.athleteClerkId, athleteId),
          eq(parentMessagesTable.senderClerkId, athleteId),
          isNull(parentMessagesTable.readAt),
        ),
      );
    res.json({ messages });
  } catch (err) {
    req.log.error({ err }, "parent.messages.get failed");
    res.status(500).json({ error: "Kon berichten niet laden" });
  }
});

router.post("/athletes/:athleteId/messages", requireAuth, async (req, res) => {
  const parentId = getClerkUserId(req)!;
  const athleteId = String(req.params.athleteId);
  try {
    const ctx = await requireParentAccess(parentId, athleteId);
    if (!ctx) {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    if (!ctx.access.permissions.communicatie) {
      res.status(403).json({ error: "Berichten staan niet aan voor deze koppeling" });
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
        athleteClerkId: athleteId,
        senderClerkId: parentId,
        body,
      })
      .returning();
    void createNotification({
      clerkId: athleteId,
      type: "parent_update",
      title: "Nieuw bericht van je ouder/verzorger",
      body: body.slice(0, 120),
      athleteClerkId: athleteId,
      actionUrl: "/you?focus=connections",
    });
    res.status(201).json({ message });
  } catch (err) {
    req.log.error({ err }, "parent.messages.post failed");
    res.status(500).json({ error: "Kon bericht niet versturen" });
  }
});

// GET /api/parent/reports/for-coach — oudermeldingen voor de coach. Alleen
// sporters met een geaccepteerde coach-koppeling én deelniveau ≠ none.
router.get("/reports/for-coach", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await hasRole(coachId, "coach"))) {
    res.status(403).json({ error: "Coach-rol vereist" });
    return;
  }
  try {
    const links = await db
      .select({ athleteClerkId: coachAthleteLinksTable.athleteClerkId })
      .from(coachAthleteLinksTable)
      .where(
        and(
          eq(coachAthleteLinksTable.coachClerkId, coachId),
          eq(coachAthleteLinksTable.status, "accepted"),
        ),
      );
    const visible: string[] = [];
    for (const l of links) {
      if ((await coachSharingLevel(l.athleteClerkId)) !== "none") {
        visible.push(l.athleteClerkId);
      }
    }
    if (visible.length === 0) {
      res.json({ reports: [] });
      return;
    }
    const reports = await db
      .select({
        id: parentReportsTable.id,
        athleteClerkId: parentReportsTable.athleteClerkId,
        kind: parentReportsTable.kind,
        note: parentReportsTable.note,
        status: parentReportsTable.status,
        createdAt: parentReportsTable.createdAt,
        displayName: userProfilesTable.displayName,
      })
      .from(parentReportsTable)
      .innerJoin(
        userProfilesTable,
        eq(userProfilesTable.clerkId, parentReportsTable.athleteClerkId),
      )
      .where(
        and(
          inArray(parentReportsTable.athleteClerkId, visible),
          or(
            eq(parentReportsTable.status, "open"),
            eq(parentReportsTable.status, "gezien"),
          ),
        ),
      )
      .orderBy(desc(parentReportsTable.createdAt))
      .limit(20);
    res.json({ reports });
  } catch (err) {
    req.log.error({ err }, "parent.reports.for-coach failed");
    res.status(500).json({ error: "Kon meldingen niet laden" });
  }
});

export default router;
