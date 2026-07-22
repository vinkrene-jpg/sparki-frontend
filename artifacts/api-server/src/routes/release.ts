// Golf 14 — pilot, support en gecontroleerde uitrol.
// Beheer: kill switches, versievereisten, releasegroepen/pilotbeheer,
// foutgroepen, uitrolbewaking, releaseberichten, rollback-registratie en het
// operationele beheerbord. Gebruiker: releaseberichten op Vandaag,
// pilotvoorwaarden en centrale foutmelding (web/mobiel).

import { Router } from "express";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  killSwitchesTable,
  versionRequirementsTable,
  errorGroupsTable,
  errorEventsTable,
  pilotConsentsTable,
  releaseNotesTable,
  releaseNoteReadsTable,
  rolloutGuardsTable,
  featureFlagsTable,
  userProfilesTable,
  clubsTable,
  securityAuditLogTable,
  KILL_SWITCH_KEYS,
  KILL_SWITCH_LABELS,
  RELEASE_GROUPS,
  RELEASE_PLATFORMS,
  FEATURE_KEYS,
  type KillSwitchKey,
  type FeatureKey,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { isAdmin, parsePlatform } from "../lib/flags";
import { effectiveReleaseGroup, isReleaseGroup } from "../lib/release-groups";
import { invalidateKillSwitchCache } from "../lib/kill-switches";
import { invalidateVersionCache, isParsableVersion } from "../lib/version-gate";
import {
  recordError,
  criticalEventCountSince,
  criticalEventCountAllSince,
} from "../lib/error-registry";
import { writeAudit } from "../lib/security/audit";
import { createNotification } from "../lib/notifications";

const router = Router();

function requireAdmin(
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof requireAuth>[1],
  next: Parameters<typeof requireAuth>[2],
) {
  const clerkId = getClerkUserId(req);
  if (!clerkId || !isAdmin(clerkId)) {
    res.status(403).json({ error: "Alleen voor beheerders" });
    return;
  }
  next();
}

async function notifyAdmins(title: string, body: string): Promise<void> {
  const ids = (process.env.SPARKI_ADMIN_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const clerkId of ids) {
    await createNotification({
      clerkId,
      type: "system",
      title,
      body,
      priority: "high",
      actionUrl: "/admin",
      dedupeWithin: { type: "system", matchBody: body },
    });
  }
}

// ── Foutregistratie (web + mobiel; ook zonder sessie, licht gelimiteerd) ─────
const errHits = new Map<string, { count: number; windowStart: number }>();
router.post("/errors", async (req, res) => {
  const ip = req.ip ?? "onbekend";
  const now = Date.now();
  const h = errHits.get(ip);
  if (!h || now - h.windowStart > 60_000) {
    errHits.set(ip, { count: 1, windowStart: now });
  } else if (++h.count > 30) {
    res.status(429).json({ error: "Te veel foutmeldingen. Probeer het later opnieuw." });
    return;
  }
  if (errHits.size > 5000) errHits.clear();

  const body = (req.body ?? {}) as Record<string, unknown>;
  const message = typeof body.message === "string" ? body.message.slice(0, 1000) : "";
  if (!message.trim()) {
    res.status(400).json({ error: "message is verplicht" });
    return;
  }
  const clerkId = getClerkUserId(req);
  const platform = parsePlatform(req.get("x-sparki-platform"));
  // Anonieme meldingen kunnen nooit "kritiek" zijn: anders kan iemand zonder
  // sessie de automatische uitrol-stop van flags forceren (misbruik).
  const claimed =
    body.severity === "kritiek" || body.severity === "waarschuwing" ? body.severity : "fout";
  const severity = claimed === "kritiek" && !clerkId ? "fout" : claimed;
  const flagKey =
    typeof body.flagKey === "string" && FEATURE_KEYS.includes(body.flagKey as (typeof FEATURE_KEYS)[number])
      ? body.flagKey
      : null;
  const groupId = await recordError({
    platform,
    message,
    stack: typeof body.stack === "string" ? body.stack.slice(0, 4000) : null,
    severity,
    clerkId: clerkId ?? null,
    releaseGroup: clerkId ? await effectiveReleaseGroup(clerkId) : null,
    appVersion: req.get("x-sparki-app-version") ?? null,
    screen: typeof body.screen === "string" ? body.screen : null,
    correlationId: String((req as { id?: string | number }).id ?? "") || null,
    flagKey,
  });

  // Uitrolbewaking: alleen bij een geauthenticeerde kritieke fout mét flag.
  if (severity === "kritiek" && clerkId && flagKey) {
    try {
      await checkRolloutGuards(req);
    } catch (err) {
      req.log.error({ err }, "rollout-guard check failed");
    }
  }
  res.status(202).json({ ok: true, groupId });
});

// Draai de bewaking: drempel kritieke fouten binnen venster ⇒ flag automatisch
// uit (globaal, rollen, groepen, percentage 0) + audit + melding aan beheerders.
async function checkRolloutGuards(req: Parameters<typeof requireAuth>[0]): Promise<string[]> {
  const guards = await db
    .select()
    .from(rolloutGuardsTable)
    .where(eq(rolloutGuardsTable.active, true));
  const tripped: string[] = [];
  for (const guard of guards) {
    const windowStart = new Date(Date.now() - guard.windowMinutes * 60_000);
    // Niet opnieuw afgaan binnen hetzelfde venster.
    if (guard.lastTrippedAt && guard.lastTrippedAt > windowStart) continue;
    // Alleen kritieke voorvallen die aan DEZE flag zijn toegeschreven tellen —
    // nooit een globale teller, anders stopt één storing ongerelateerde flags.
    const n = await criticalEventCountSince(windowStart, guard.flagKey);
    if (n < guard.errorThreshold) continue;
    const [flag] = await db
      .select()
      .from(featureFlagsTable)
      .where(eq(featureFlagsTable.key, guard.flagKey));
    const wasOn =
      flag &&
      (flag.enabledGlobally || flag.enabledRoles.length > 0 || flag.enabledGroups.length > 0);
    if (!wasOn) continue;
    await db
      .update(featureFlagsTable)
      .set({
        enabledGlobally: false,
        enabledRoles: [],
        enabledGroups: [],
        rolloutPercentage: 0,
        updatedAt: new Date(),
      })
      .where(eq(featureFlagsTable.key, guard.flagKey));
    await db
      .update(rolloutGuardsTable)
      .set({ lastTrippedAt: new Date(), updatedAt: new Date() })
      .where(eq(rolloutGuardsTable.flagKey, guard.flagKey));
    await writeAudit({
      event: "rollout_autostop",
      meta: { flagKey: guard.flagKey, criticalCount: n, threshold: guard.errorThreshold, windowMinutes: guard.windowMinutes },
      req,
    });
    await notifyAdmins(
      "Uitrol automatisch gestopt",
      `De uitrol van "${guard.flagKey}" is automatisch stopgezet: ${n} kritieke fouten binnen ${guard.windowMinutes} minuten (drempel ${guard.errorThreshold}). Controleer het beheerbord.`,
    );
    tripped.push(guard.flagKey);
  }
  return tripped;
}

// ── Releaseberichten (gebruiker; alleen rustig op Vandaag) ───────────────────
router.get("/notes", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const group = await effectiveReleaseGroup(clerkId);
    const platform = parsePlatform(req.get("x-sparki-platform"));
    const notes = await db
      .select({
        id: releaseNotesTable.id,
        title: releaseNotesTable.title,
        body: releaseNotesTable.body,
        publishedAt: releaseNotesTable.publishedAt,
        releaseGroups: releaseNotesTable.releaseGroups,
        platforms: releaseNotesTable.platforms,
        readAt: releaseNoteReadsTable.readAt,
      })
      .from(releaseNotesTable)
      .leftJoin(
        releaseNoteReadsTable,
        and(
          eq(releaseNoteReadsTable.noteId, releaseNotesTable.id),
          eq(releaseNoteReadsTable.clerkId, clerkId),
        ),
      )
      .where(sql`${releaseNotesTable.publishedAt} IS NOT NULL`)
      .orderBy(desc(releaseNotesTable.publishedAt))
      .limit(20);
    const visible = notes.filter(
      (n) =>
        (n.releaseGroups.length === 0 || n.releaseGroups.includes(group)) &&
        (n.platforms.length === 0 || n.platforms.includes(platform)),
    );
    res.json({ notes: visible.map((n) => ({ ...n, read: n.readAt != null })) });
  } catch (err) {
    req.log.error({ err }, "release.notes failed");
    res.status(500).json({ error: "Kon releaseberichten niet laden" });
  }
});

router.post("/notes/:id/read", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    await db
      .insert(releaseNoteReadsTable)
      .values({ noteId: id, clerkId })
      .onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "release.notes.read failed");
    res.status(500).json({ error: "Kon bericht niet markeren" });
  }
});

// ── Pilotvoorwaarden (gebruiker) ─────────────────────────────────────────────
const PILOT_TERMS_VERSION = "2026-07";
router.get("/pilot-status", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const group = await effectiveReleaseGroup(clerkId);
    const [consent] = await db
      .select()
      .from(pilotConsentsTable)
      .where(
        and(
          eq(pilotConsentsTable.clerkId, clerkId),
          eq(pilotConsentsTable.termsVersion, PILOT_TERMS_VERSION),
        ),
      );
    res.json({
      releaseGroup: group,
      inPilot: group === "pilot" || group === "test" || group === "intern",
      termsVersion: PILOT_TERMS_VERSION,
      consentGiven: !!consent,
      consentAt: consent?.acceptedAt ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "release.pilotStatus failed");
    res.status(500).json({ error: "Kon pilotstatus niet laden" });
  }
});

router.post("/pilot-consent", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    await db
      .insert(pilotConsentsTable)
      .values({ clerkId, termsVersion: PILOT_TERMS_VERSION })
      .onConflictDoNothing();
    await writeAudit({
      event: "pilot_access_changed",
      actorClerkId: clerkId,
      subjectClerkId: clerkId,
      meta: { action: "consent_accepted", termsVersion: PILOT_TERMS_VERSION },
      req,
    });
    res.json({ ok: true, termsVersion: PILOT_TERMS_VERSION });
  } catch (err) {
    req.log.error({ err }, "release.pilotConsent failed");
    res.status(500).json({ error: "Kon toestemming niet opslaan" });
  }
});

// ── Versiestatus (client polt dit ook voor het blokkeerscherm) ───────────────
router.get("/version-check", async (req, res) => {
  // De versionGate-middleware heeft dit verzoek al beoordeeld: wie hier komt,
  // is compatibel (of stuurt geen versieheader mee).
  res.json({ ok: true });
});

// ═════════════════════════════ BEHEER ════════════════════════════════════════

// ── Kill switches ────────────────────────────────────────────────────────────
router.get("/admin/kill-switches", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(killSwitchesTable);
    res.json({
      switches: KILL_SWITCH_KEYS.map((key) => {
        const row = rows.find((r) => r.key === key);
        return {
          key,
          label: KILL_SWITCH_LABELS[key],
          active: row?.active ?? false,
          reason: row?.reason ?? null,
          updatedBy: row?.updatedBy ?? null,
          updatedAt: row?.updatedAt ?? null,
        };
      }),
    });
  } catch (err) {
    req.log.error({ err }, "release.killSwitches.list failed");
    res.status(500).json({ error: "Kon kill switches niet laden" });
  }
});

router.put("/admin/kill-switches/:key", requireAuth, requireAdmin, async (req, res) => {
  const key = String(req.params.key);
  if (!(KILL_SWITCH_KEYS as readonly string[]).includes(key)) {
    res.status(400).json({ error: "Onbekende kill switch" });
    return;
  }
  const { active, reason } = (req.body ?? {}) as { active?: boolean; reason?: string };
  if (typeof active !== "boolean") {
    res.status(400).json({ error: "active (boolean) is verplicht" });
    return;
  }
  const adminClerkId = getClerkUserId(req)!;
  try {
    const [row] = await db
      .insert(killSwitchesTable)
      .values({ key, active, reason: reason ?? null, updatedBy: adminClerkId, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: killSwitchesTable.key,
        set: { active, reason: reason ?? null, updatedBy: adminClerkId, updatedAt: new Date() },
      })
      .returning();
    invalidateKillSwitchCache();
    await writeAudit({
      event: "kill_switch_changed",
      actorClerkId: adminClerkId,
      meta: { key, active, reason: reason ?? null },
      req,
    });
    res.json({ switch: row });
  } catch (err) {
    req.log.error({ err }, "release.killSwitches.put failed");
    res.status(500).json({ error: "Kon kill switch niet bijwerken" });
  }
});

// ── Versievereisten ──────────────────────────────────────────────────────────
router.get("/admin/versions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(versionRequirementsTable);
    res.json({ versions: rows });
  } catch (err) {
    req.log.error({ err }, "release.versions.list failed");
    res.status(500).json({ error: "Kon versievereisten niet laden" });
  }
});

router.put("/admin/versions/:platform", requireAuth, requireAdmin, async (req, res) => {
  const platform = String(req.params.platform);
  if (platform !== "web" && platform !== "mobiel") {
    res.status(400).json({ error: "Platform moet web of mobiel zijn" });
    return;
  }
  const { minVersion, message } = (req.body ?? {}) as { minVersion?: string; message?: string };
  if (typeof minVersion !== "string" || !isParsableVersion(minVersion)) {
    res.status(400).json({ error: "minVersion moet er uitzien als 1.2.3" });
    return;
  }
  const adminClerkId = getClerkUserId(req)!;
  try {
    const [row] = await db
      .insert(versionRequirementsTable)
      .values({
        platform,
        minVersion: minVersion.trim(),
        message: message?.trim() || null,
        updatedBy: adminClerkId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: versionRequirementsTable.platform,
        set: {
          minVersion: minVersion.trim(),
          message: message?.trim() || null,
          updatedBy: adminClerkId,
          updatedAt: new Date(),
        },
      })
      .returning();
    invalidateVersionCache();
    await writeAudit({
      event: "version_requirement_changed",
      actorClerkId: adminClerkId,
      meta: { platform, minVersion: minVersion.trim() },
      req,
    });
    res.json({ requirement: row });
  } catch (err) {
    req.log.error({ err }, "release.versions.put failed");
    res.status(500).json({ error: "Kon versievereiste niet opslaan" });
  }
});

// ── Pilotbeheer: releasegroepen van gebruikers en clubs ──────────────────────
router.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const group = String(req.query.group ?? "").trim();
  try {
    const rows = await db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
        email: userProfilesTable.email,
        releaseGroup: userProfilesTable.releaseGroup,
        roles: userProfilesTable.roles,
      })
      .from(userProfilesTable)
      .orderBy(desc(userProfilesTable.createdAt))
      .limit(500);
    let filtered = rows;
    if (isReleaseGroup(group)) filtered = filtered.filter((r) => r.releaseGroup === group);
    if (q)
      filtered = filtered.filter(
        (r) =>
          (r.displayName ?? "").toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q),
      );
    res.json({ users: filtered.slice(0, 100) });
  } catch (err) {
    req.log.error({ err }, "release.users.list failed");
    res.status(500).json({ error: "Kon gebruikers niet laden" });
  }
});

router.put("/admin/users/:clerkId/group", requireAuth, requireAdmin, async (req, res) => {
  const clerkId = String(req.params.clerkId);
  const { group } = (req.body ?? {}) as { group?: string };
  if (!isReleaseGroup(group)) {
    res.status(400).json({ error: "Ongeldige releasegroep" });
    return;
  }
  const adminClerkId = getClerkUserId(req)!;
  try {
    const [row] = await db
      .update(userProfilesTable)
      .set({ releaseGroup: group, updatedAt: new Date() })
      .where(eq(userProfilesTable.clerkId, clerkId))
      .returning({ clerkId: userProfilesTable.clerkId, releaseGroup: userProfilesTable.releaseGroup });
    if (!row) {
      res.status(404).json({ error: "Gebruiker niet gevonden" });
      return;
    }
    await writeAudit({
      event: "pilot_access_changed",
      actorClerkId: adminClerkId,
      subjectClerkId: clerkId,
      meta: { action: "user_group_set", group },
      req,
    });
    res.json({ user: row });
  } catch (err) {
    req.log.error({ err }, "release.users.setGroup failed");
    res.status(500).json({ error: "Kon releasegroep niet bijwerken" });
  }
});

router.get("/admin/clubs", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select({ id: clubsTable.id, name: clubsTable.name, releaseGroup: clubsTable.releaseGroup })
      .from(clubsTable)
      .orderBy(clubsTable.name)
      .limit(200);
    res.json({ clubs: rows });
  } catch (err) {
    req.log.error({ err }, "release.clubs.list failed");
    res.status(500).json({ error: "Kon clubs niet laden" });
  }
});

router.put("/admin/clubs/:id/group", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(String(req.params.id));
  const { group } = (req.body ?? {}) as { group?: string };
  if (!Number.isInteger(id) || !isReleaseGroup(group)) {
    res.status(400).json({ error: "Ongeldige invoer" });
    return;
  }
  const adminClerkId = getClerkUserId(req)!;
  try {
    const [row] = await db
      .update(clubsTable)
      .set({ releaseGroup: group, updatedAt: new Date() })
      .where(eq(clubsTable.id, id))
      .returning({ id: clubsTable.id, name: clubsTable.name, releaseGroup: clubsTable.releaseGroup });
    if (!row) {
      res.status(404).json({ error: "Club niet gevonden" });
      return;
    }
    await writeAudit({
      event: "pilot_access_changed",
      actorClerkId: adminClerkId,
      meta: { action: "club_group_set", clubId: id, group },
      req,
    });
    res.json({ club: row });
  } catch (err) {
    req.log.error({ err }, "release.clubs.setGroup failed");
    res.status(500).json({ error: "Kon releasegroep niet bijwerken" });
  }
});

// ── Foutgroepen (beheer) ─────────────────────────────────────────────────────
router.get("/admin/errors", requireAuth, requireAdmin, async (req, res) => {
  try {
    const groups = await db
      .select()
      .from(errorGroupsTable)
      .orderBy(desc(errorGroupsTable.lastSeenAt))
      .limit(100);
    const ids = groups.map((g) => g.id);
    const userCounts = ids.length
      ? await db
          .select({
            groupId: errorEventsTable.groupId,
            users: sql<number>`count(distinct ${errorEventsTable.clerkId})::int`,
          })
          .from(errorEventsTable)
          .where(inArray(errorEventsTable.groupId, ids))
          .groupBy(errorEventsTable.groupId)
      : [];
    const countMap = new Map(userCounts.map((u) => [u.groupId, u.users]));
    res.json({
      groups: groups.map((g) => ({ ...g, affectedUsers: countMap.get(g.id) ?? 0 })),
    });
  } catch (err) {
    req.log.error({ err }, "release.errors.list failed");
    res.status(500).json({ error: "Kon foutgroepen niet laden" });
  }
});

router.get("/admin/errors/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [group] = await db.select().from(errorGroupsTable).where(eq(errorGroupsTable.id, id));
    if (!group) {
      res.status(404).json({ error: "Foutgroep niet gevonden" });
      return;
    }
    const events = await db
      .select()
      .from(errorEventsTable)
      .where(eq(errorEventsTable.groupId, id))
      .orderBy(desc(errorEventsTable.at))
      .limit(50);
    res.json({ group, events });
  } catch (err) {
    req.log.error({ err }, "release.errors.detail failed");
    res.status(500).json({ error: "Kon foutgroep niet laden" });
  }
});

router.post("/admin/errors/:id/resolve", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const [row] = await db
      .update(errorGroupsTable)
      .set({ resolvedAt: new Date() })
      .where(eq(errorGroupsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Foutgroep niet gevonden" });
      return;
    }
    res.json({ group: row });
  } catch (err) {
    req.log.error({ err }, "release.errors.resolve failed");
    res.status(500).json({ error: "Kon foutgroep niet bijwerken" });
  }
});

// ── Uitrolbewaking ───────────────────────────────────────────────────────────
router.get("/admin/guards", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(rolloutGuardsTable);
    res.json({ guards: rows });
  } catch (err) {
    req.log.error({ err }, "release.guards.list failed");
    res.status(500).json({ error: "Kon uitrolbewaking niet laden" });
  }
});

router.put("/admin/guards/:flagKey", requireAuth, requireAdmin, async (req, res) => {
  const flagKey = String(req.params.flagKey);
  if (!(FEATURE_KEYS as readonly string[]).includes(flagKey)) {
    res.status(400).json({ error: "Onbekende flag" });
    return;
  }
  const { errorThreshold, windowMinutes, active } = (req.body ?? {}) as {
    errorThreshold?: number;
    windowMinutes?: number;
    active?: boolean;
  };
  if (
    (errorThreshold !== undefined && (!Number.isInteger(errorThreshold) || errorThreshold < 1)) ||
    (windowMinutes !== undefined && (!Number.isInteger(windowMinutes) || windowMinutes < 1))
  ) {
    res.status(400).json({ error: "Drempel en venster moeten positieve gehele getallen zijn" });
    return;
  }
  const adminClerkId = getClerkUserId(req)!;
  try {
    const [row] = await db
      .insert(rolloutGuardsTable)
      .values({
        flagKey,
        errorThreshold: errorThreshold ?? 5,
        windowMinutes: windowMinutes ?? 60,
        active: active ?? true,
        updatedBy: adminClerkId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: rolloutGuardsTable.flagKey,
        set: {
          ...(errorThreshold !== undefined && { errorThreshold }),
          ...(windowMinutes !== undefined && { windowMinutes }),
          ...(active !== undefined && { active }),
          updatedBy: adminClerkId,
          updatedAt: new Date(),
        },
      })
      .returning();
    res.json({ guard: row });
  } catch (err) {
    req.log.error({ err }, "release.guards.put failed");
    res.status(500).json({ error: "Kon bewaking niet opslaan" });
  }
});

// ── Releaseberichten (beheer) ────────────────────────────────────────────────
router.get("/admin/notes", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(releaseNotesTable)
      .orderBy(desc(releaseNotesTable.createdAt))
      .limit(50);
    res.json({ notes: rows });
  } catch (err) {
    req.log.error({ err }, "release.adminNotes.list failed");
    res.status(500).json({ error: "Kon releaseberichten niet laden" });
  }
});

router.post("/admin/notes", requireAuth, requireAdmin, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!title || !text) {
    res.status(400).json({ error: "Titel en tekst zijn verplicht" });
    return;
  }
  const groups = Array.isArray(body.releaseGroups)
    ? body.releaseGroups.filter((g): g is string => isReleaseGroup(g))
    : [];
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.filter((p): p is string => (RELEASE_PLATFORMS as readonly string[]).includes(String(p)))
    : [];
  const publish = body.publish === true;
  const adminClerkId = getClerkUserId(req)!;
  try {
    const [row] = await db
      .insert(releaseNotesTable)
      .values({
        title,
        body: text,
        releaseGroups: groups,
        platforms,
        publishedAt: publish ? new Date() : null,
        createdBy: adminClerkId,
      })
      .returning();
    if (publish) {
      await writeAudit({
        event: "release_note_published",
        actorClerkId: adminClerkId,
        meta: { noteId: row?.id, title },
        req,
      });
    }
    res.status(201).json({ note: row });
  } catch (err) {
    req.log.error({ err }, "release.adminNotes.create failed");
    res.status(500).json({ error: "Kon releasebericht niet opslaan" });
  }
});

router.post("/admin/notes/:id/publish", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const adminClerkId = getClerkUserId(req)!;
  try {
    const [row] = await db
      .update(releaseNotesTable)
      .set({ publishedAt: new Date() })
      .where(and(eq(releaseNotesTable.id, id), isNull(releaseNotesTable.publishedAt)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Bericht niet gevonden of al gepubliceerd" });
      return;
    }
    await writeAudit({
      event: "release_note_published",
      actorClerkId: adminClerkId,
      meta: { noteId: id, title: row.title },
      req,
    });
    res.json({ note: row });
  } catch (err) {
    req.log.error({ err }, "release.adminNotes.publish failed");
    res.status(500).json({ error: "Kon bericht niet publiceren" });
  }
});

// ── Rollback-registratie ─────────────────────────────────────────────────────
// Rollback zelf = het vorige, werkende checkpoint opnieuw publiceren (platform-
// stap buiten de API om). Hier wordt het besluit vastgelegd in het auditlog,
// zodat het beheerbord en de geschiedenis kloppen.
router.post("/admin/rollback", requireAuth, requireAdmin, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length < 5) {
    res.status(400).json({ error: "Omschrijf kort wat er is teruggedraaid en waarom" });
    return;
  }
  const adminClerkId = getClerkUserId(req)!;
  try {
    await writeAudit(
      {
        event: "rollback_recorded",
        actorClerkId: adminClerkId,
        meta: {
          description,
          checkpoint: typeof body.checkpoint === "string" ? body.checkpoint.slice(0, 120) : null,
        },
        req,
      },
      { required: true },
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "release.rollback failed");
    res.status(500).json({ error: "Kon rollback niet vastleggen" });
  }
});

// ── Operationeel beheerbord ──────────────────────────────────────────────────
router.get("/admin/operations", requireAuth, requireAdmin, async (req, res) => {
  try {
    const since24h = new Date(Date.now() - 24 * 3600_000);
    const [switches, versions, guards, groupCounts, openErrors, criticalCount, recentAudit, latestNotes] =
      await Promise.all([
        db.select().from(killSwitchesTable),
        db.select().from(versionRequirementsTable),
        db.select().from(rolloutGuardsTable),
        db
          .select({
            group: userProfilesTable.releaseGroup,
            n: sql<number>`count(*)::int`,
          })
          .from(userProfilesTable)
          .groupBy(userProfilesTable.releaseGroup),
        db
          .select()
          .from(errorGroupsTable)
          .where(isNull(errorGroupsTable.resolvedAt))
          .orderBy(desc(errorGroupsTable.lastSeenAt))
          .limit(10),
        criticalEventCountAllSince(since24h),
        db
          .select()
          .from(securityAuditLogTable)
          .where(
            inArray(securityAuditLogTable.event, [
              "flag_changed",
              "kill_switch_changed",
              "pilot_access_changed",
              "version_requirement_changed",
              "rollout_autostop",
              "rollback_recorded",
              "release_note_published",
            ]),
          )
          .orderBy(desc(securityAuditLogTable.at))
          .limit(25),
        db
          .select()
          .from(releaseNotesTable)
          .orderBy(desc(releaseNotesTable.createdAt))
          .limit(5),
      ]);
    res.json({
      killSwitches: KILL_SWITCH_KEYS.map((key) => {
        const row = switches.find((s) => s.key === key);
        return { key, label: KILL_SWITCH_LABELS[key], active: row?.active ?? false, reason: row?.reason ?? null };
      }),
      versions,
      guards,
      releaseGroupCounts: RELEASE_GROUPS.map((g) => ({
        group: g,
        users: groupCounts.find((c) => c.group === g)?.n ?? 0,
      })),
      openErrorGroups: openErrors,
      criticalEvents24h: criticalCount,
      recentAudit,
      latestNotes,
    });
  } catch (err) {
    req.log.error({ err }, "release.operations failed");
    res.status(500).json({ error: "Kon beheerbord niet laden" });
  }
});

export default router;
