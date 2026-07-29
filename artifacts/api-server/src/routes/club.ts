import { Router } from "express";
import { and, eq, desc, asc, gte, isNull, inArray, sql } from "drizzle-orm";
import {
  db,
  clubsTable,
  clubMembersTable,
  clubTeamsTable,
  clubGroupsTable,
  clubTeamMembersTable,
  clubGroupMembersTable,
  clubTrainerAssignmentsTable,
  clubTrainingsTable,
  clubTrainingSignupsTable,
  clubRaceEventsTable,
  clubRaceSelectionsTable,
  clubMessagesTable,
  clubMessageReadsTable,
  clubConsentsTable,
  clubSubscriptionsTable,
  clubAuditLogTable,
  clubLocationsTable,
  clubConsentScopes,
  userProfilesTable,
  athleteProfilesTable,
  plannedWorkoutsTable,
  trainingSessionsTable,
  invitationsTable,
  clubRoles,
  clubSignupStatuses,
  type ClubRole,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { createNotification } from "../lib/notifications";
import {
  getClubContext,
  canManageClub,
  hasClubRole,
  checkCapacityForNew,
  countActive,
  assignedAthleteIds,
  hasClubConsent,
  grantedConsentScopes,
  isMinorForClub,
  isLinkedParent,
  writeClubAudit,
  CLUB_PACKAGES,
  canManageTrainings,
  canRecordAttendance,
  canManageTrainerAssignments,
  TRAINER_LIKE_ROLES,
  TRAINER_COUNT_ROLES,
  canEditMaterial,
  canPostMessages,
  canViewConsentedData,
  clubStatusAllowsMutation,
  type ClubContext,
} from "../lib/club-permissions";
import { computeAge } from "../lib/age";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function intParam(v: unknown): number | null {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function ctxOr403(
  req: import("express").Request,
  res: import("express").Response,
): Promise<ClubContext | null> {
  const clerkId = getClerkUserId(req)!;
  const clubId = intParam(req.params["clubId"]);
  if (clubId == null) {
    res.status(400).json({ error: "Ongeldige club" });
    return null;
  }
  const ctx = await getClubContext(clubId, clerkId);
  if (!ctx) {
    res.status(403).json({ error: "Je bent geen actief lid van deze club." });
    return null;
  }
  return ctx;
}

// Schrijfacties (plannen, aanmelden, berichten) alleen bij een actieve club.
// Bekijken blijft bij elke status mogelijk — er verdwijnt nooit data.
function clubWritableOr409(ctx: ClubContext, res: import("express").Response): boolean {
  if (ctx.club.status !== "actief") {
    res.status(409).json({
      error: "Deze club is op dit moment niet actief. Bekijken kan, wijzigen niet.",
    });
    return false;
  }
  return true;
}

// Korte, leesbare deelnamecode (zonder verwarrende tekens als 0/O, 1/I).
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateJoinCode(len = 8): string {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

// Clubstatus-bewaking voor mutaties: geschorst/beeindigd = alleen-lezen
// (behalve beheer). Geeft true terug als de mutatie door mag.
function statusGuard(ctx: ClubContext, res: import("express").Response): boolean {
  const check = clubStatusAllowsMutation(ctx);
  if (!check.ok) {
    res.status(403).json({ error: check.reason });
    return false;
  }
  return true;
}

async function profilesByIds(ids: string[]) {
  if (ids.length === 0) return new Map<string, { displayName: string | null; email: string }>();
  const rows = await db
    .select({
      clerkId: userProfilesTable.clerkId,
      displayName: userProfilesTable.displayName,
      email: userProfilesTable.email,
    })
    .from(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, ids));
  return new Map(rows.map((r) => [r.clerkId, { displayName: r.displayName, email: r.email }]));
}

// ── Club aanmaken & mijn clubs ────────────────────────────────────────────────

router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const name = str(req.body?.name);
  if (!name) {
    res.status(400).json({ error: "Geef de club een naam." });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [club] = await tx
        .insert(clubsTable)
        .values({
          name,
          description: str(req.body?.description),
          location: str(req.body?.location),
          contactEmail: str(req.body?.contactEmail),
          website: str(req.body?.website),
          primaryColor: str(req.body?.primaryColor),
          secondaryColor: str(req.body?.secondaryColor),
          contactPhone: str(req.body?.contactPhone),
          joinCode: generateJoinCode(),
          ownerClerkId: clerkId,
        })
        .returning();
      await tx.insert(clubMembersTable).values({
        clubId: club!.id,
        clerkId,
        role: "owner",
      });
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await tx.insert(clubSubscriptionsTable).values({
        clubId: club!.id,
        packageKey: "proef",
        status: "trial",
        trialEndsAt,
        maxMembers: CLUB_PACKAGES["proef"]!.maxMembers,
        maxTrainers: CLUB_PACKAGES["proef"]!.maxTrainers,
      });
      return club!;
    });
    await writeClubAudit({
      clubId: result.id,
      actorClerkId: clerkId,
      action: "club_aangemaakt",
      targetType: "club",
      targetId: result.id,
    });
    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "club create failed");
    res.status(500).json({ error: "Club aanmaken is niet gelukt." });
  }
});

router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const memberships = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clerkId, clerkId), isNull(clubMembersTable.endedAt)));
    const clubIds = memberships.map((m) => m.clubId);
    const clubs =
      clubIds.length > 0
        ? await db.select().from(clubsTable).where(inArray(clubsTable.id, clubIds))
        : [];
    res.json(
      memberships.map((m) => ({
        membership: m,
        club: clubs.find((c) => c.id === m.clubId) ?? null,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "clubs list failed");
    res.status(500).json({ error: "Clubs ophalen is niet gelukt." });
  }
});

// ── Aansluiten met clubcode of teamcode ──────────────────────────────────────
// Een bestaand account sluit aan zonder persoonlijke uitnodiging. Capaciteit
// en pakketlimieten gelden ook hier (eerlijk 409). Teamcode = clublid + team.
router.post("/join", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const code = str(req.body?.code)?.toUpperCase();
    if (!code) {
      res.status(400).json({ error: "Vul een clubcode of teamcode in." });
      return;
    }
    const [byClub] = await db.select().from(clubsTable).where(eq(clubsTable.joinCode, code));
    let club = byClub ?? null;
    let team: typeof clubTeamsTable.$inferSelect | null = null;
    if (!club) {
      const [byTeam] = await db
        .select()
        .from(clubTeamsTable)
        .where(eq(clubTeamsTable.joinCode, code));
      if (byTeam) {
        team = byTeam;
        const [c] = await db.select().from(clubsTable).where(eq(clubsTable.id, byTeam.clubId));
        club = c ?? null;
      }
    }
    if (!club) {
      res.status(404).json({ error: "Deze code is niet (meer) geldig. Controleer de code bij je club." });
      return;
    }
    if (club.status !== "actief") {
      res.status(409).json({ error: "Deze club neemt op dit moment geen nieuwe leden aan." });
      return;
    }
    const existing = await getClubContext(club.id, clerkId);
    if (existing) {
      res.status(409).json({ error: "Je bent al lid van deze club." });
      return;
    }
    // Pakketlimieten gelden ook bij aansluiten met een code. Capaciteitscheck
    // en insert zitten in één transactie met een advisory lock per club, zodat
    // gelijktijdige joins de limiet niet kunnen overschrijden.
    const joined = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(881100, ${club.id})`);
      const [subscription] = await tx
        .select()
        .from(clubSubscriptionsTable)
        .where(eq(clubSubscriptionsTable.clubId, club.id));
      const cap = await checkCapacityForNew(
        { club, membership: { role: "member" }, subscription: subscription ?? null } as unknown as ClubContext,
        "member",
        tx,
      );
      if (!cap.ok) {
        return { error: cap.reason ?? "Deze club zit vol." } as const;
      }
      // Teamcapaciteit (maxSize) eerlijk bewaken.
      if (team?.maxSize != null) {
        const rows = await tx
          .select({ id: clubTeamMembersTable.id })
          .from(clubTeamMembersTable)
          .where(and(eq(clubTeamMembersTable.teamId, team.id), isNull(clubTeamMembersTable.endedAt)));
        if (rows.length >= team.maxSize) {
          return { error: "Dit team zit vol. Vraag de club om een andere indeling." } as const;
        }
      }
      const [member] = await tx
        .insert(clubMembersTable)
        .values({ clubId: club.id, clerkId, role: "member" })
        .returning();
      if (team) {
        await tx
          .insert(clubTeamMembersTable)
          .values({ teamId: team.id, clerkId })
          .onConflictDoNothing();
      }
      return { member: member! } as const;
    });
    if ("error" in joined) {
      res.status(409).json({ error: joined.error });
      return;
    }
    const member = joined.member;
    await writeClubAudit({
      clubId: club.id,
      actorClerkId: clerkId,
      action: "lid_aangesloten_met_code",
      targetType: "member",
      targetId: member!.id,
      detail: { via: team ? "teamcode" : "clubcode", teamId: team?.id ?? null },
    });
    res.status(201).json({ club, team, membership: member });
  } catch (err) {
    req.log.error({ err }, "club join failed");
    res.status(500).json({ error: "Aansluiten is niet gelukt." });
  }
});

// ── Clubdashboard ─────────────────────────────────────────────────────────────

router.get("/:clubId", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const clubId = ctx.club.id;
    const manage = canManageClub(ctx);
    const today = new Date().toISOString().slice(0, 10);

    const [teams, groups, trainings, races, counts] = await Promise.all([
      db.select().from(clubTeamsTable).where(eq(clubTeamsTable.clubId, clubId)),
      db.select().from(clubGroupsTable).where(eq(clubGroupsTable.clubId, clubId)),
      db
        .select()
        .from(clubTrainingsTable)
        .where(and(eq(clubTrainingsTable.clubId, clubId), gte(clubTrainingsTable.trainingDate, today)))
        .orderBy(asc(clubTrainingsTable.trainingDate))
        .limit(10),
      db
        .select()
        .from(clubRaceEventsTable)
        .where(and(eq(clubRaceEventsTable.clubId, clubId), gte(clubRaceEventsTable.raceDate, today)))
        .orderBy(asc(clubRaceEventsTable.raceDate))
        .limit(10),
      countActive(clubId),
    ]);

    const base = {
      club: ctx.club,
      membership: ctx.membership,
      teams,
      groups,
      upcomingTrainings: trainings,
      upcomingRaces: races,
      memberCounts: counts,
    };

    if (!manage) {
      res.json(base);
      return;
    }

    // Beheer-extra's: open uitnodigingen, recente afmeldingen, consent-status,
    // pakketstatus + eerlijke signalen.
    const trainingIds = trainings.map((t) => t.id);
    const [openInvites, signups, consents] = await Promise.all([
      db
        .select()
        .from(invitationsTable)
        .where(and(eq(invitationsTable.clubId, clubId), eq(invitationsTable.status, "pending"))),
      trainingIds.length > 0
        ? db
            .select()
            .from(clubTrainingSignupsTable)
            .where(inArray(clubTrainingSignupsTable.trainingId, trainingIds))
        : Promise.resolve([] as (typeof clubTrainingSignupsTable.$inferSelect)[]),
      db.select().from(clubConsentsTable).where(eq(clubConsentsTable.clubId, clubId)),
    ]);

    const afmeldingen = signups.filter((s) => s.status === "afgemeld").length;
    const signals: string[] = [];
    const sub = ctx.subscription;
    if (sub) {
      if (sub.status === "trial" && sub.trialEndsAt) {
        const daysLeft = Math.ceil((sub.trialEndsAt.getTime() - Date.now()) / 86_400_000);
        if (daysLeft <= 7)
          signals.push(
            daysLeft > 0
              ? `De proefperiode loopt over ${daysLeft} dag${daysLeft === 1 ? "" : "en"} af.`
              : "De proefperiode is afgelopen — kies een pakket om nieuwe leden toe te voegen.",
          );
      }
      if (counts.members >= sub.maxMembers)
        signals.push("Het ledenmaximum van het pakket is bereikt.");
    }
    if (afmeldingen > 0)
      signals.push(`Er zijn ${afmeldingen} afmelding${afmeldingen === 1 ? "" : "en"} voor komende trainingen.`);

    res.json({
      ...base,
      subscription: sub,
      openInvitations: openInvites.length,
      recentAfmeldingen: afmeldingen,
      consents: consents.map((c) => ({
        athleteClerkId: c.athleteClerkId,
        status: c.status,
        grantedByRelation: c.grantedByRelation,
      })),
      signals,
    });
  } catch (err) {
    req.log.error({ err }, "club dashboard failed");
    res.status(500).json({ error: "Clubgegevens ophalen is niet gelukt." });
  }
});

router.put("/:clubId", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de clubbeheerder kan het clubprofiel wijzigen." });
      return;
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of ["name", "description", "location", "contactEmail", "contactPhone", "website", "primaryColor", "secondaryColor", "logoUrl"] as const) {
      if (typeof req.body?.[key] === "string") patch[key] = req.body[key].trim() || null;
    }
    if (typeof req.body?.name === "string" && !req.body.name.trim()) {
      res.status(400).json({ error: "De clubnaam mag niet leeg zijn." });
      return;
    }
    // Clubstatus wijzigen: alleen de eigenaar (commerciële voorbereiding).
    if (typeof req.body?.status === "string") {
      const status = req.body.status.trim();
      if (!["actief", "beperkt", "geschorst", "beeindigd"].includes(status)) {
        res.status(400).json({ error: "Onbekende clubstatus." });
        return;
      }
      if (!hasClubRole(ctx, ["owner"])) {
        res.status(403).json({ error: "Alleen de clubeigenaar kan de clubstatus wijzigen." });
        return;
      }
      patch["status"] = status;
    }
    // Modules aan/uit (jsonb array van bekende sleutels).
    if (Array.isArray(req.body?.modules)) {
      const known = ["trainingen", "wedstrijden", "berichten", "materiaal"];
      patch["modules"] = req.body.modules.filter((m: unknown) => typeof m === "string" && known.includes(m));
    }
    const [updated] = await db
      .update(clubsTable)
      .set(patch)
      .where(eq(clubsTable.id, ctx.club.id))
      .returning();
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "clubprofiel_gewijzigd",
      targetType: "club",
      targetId: ctx.club.id,
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "club update failed");
    res.status(500).json({ error: "Clubprofiel wijzigen is niet gelukt." });
  }
});

// Deelnamecode (club of team) opnieuw genereren — beheer.
router.post("/:clubId/join-code", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de clubbeheerder kan de deelnamecode vernieuwen." });
      return;
    }
    const teamId = req.body?.teamId != null ? intParam(req.body.teamId) : null;
    const code = generateJoinCode();
    if (teamId != null) {
      const [team] = await db
        .update(clubTeamsTable)
        .set({ joinCode: code, updatedAt: new Date() })
        .where(and(eq(clubTeamsTable.id, teamId), eq(clubTeamsTable.clubId, ctx.club.id)))
        .returning();
      if (!team) {
        res.status(404).json({ error: "Team niet gevonden." });
        return;
      }
      await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "teamcode_vernieuwd", targetType: "team", targetId: teamId });
      res.json({ teamId, joinCode: code });
      return;
    }
    await db.update(clubsTable).set({ joinCode: code, updatedAt: new Date() }).where(eq(clubsTable.id, ctx.club.id));
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "clubcode_vernieuwd", targetType: "club", targetId: ctx.club.id });
    res.json({ joinCode: code });
  } catch (err) {
    req.log.error({ err }, "club join-code failed");
    res.status(500).json({ error: "Deelnamecode vernieuwen is niet gelukt." });
  }
});

// ── Locaties ──────────────────────────────────────────────────────────────────

router.get("/:clubId/locations", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const rows = await db
      .select()
      .from(clubLocationsTable)
      .where(eq(clubLocationsTable.clubId, ctx.club.id))
      .orderBy(asc(clubLocationsTable.name));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "club locations failed");
    res.status(500).json({ error: "Locaties ophalen is niet gelukt." });
  }
});

router.post("/:clubId/locations", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de clubbeheerder beheert locaties." });
      return;
    }
    const name = str(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "Geef de locatie een naam." });
      return;
    }
    const [row] = await db
      .insert(clubLocationsTable)
      .values({
        clubId: ctx.club.id,
        name,
        address: str(req.body?.address),
        notes: str(req.body?.notes),
        routeId: req.body?.routeId != null ? intParam(req.body.routeId) : null,
        createdByClerkId: ctx.membership.clerkId,
      })
      .returning();
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "locatie_aangemaakt", targetType: "location", targetId: row!.id });
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "club location create failed");
    res.status(500).json({ error: "Locatie aanmaken is niet gelukt." });
  }
});

router.put("/:clubId/locations/:locationId", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de clubbeheerder beheert locaties." });
      return;
    }
    const locationId = intParam(req.params["locationId"]);
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of ["name", "address", "notes"] as const) {
      if (typeof req.body?.[key] === "string") patch[key] = req.body[key].trim() || null;
    }
    if (patch["name"] === null) delete patch["name"];
    if (req.body?.routeId === null) patch["routeId"] = null;
    else if (Number.isInteger(req.body?.routeId)) patch["routeId"] = req.body.routeId;
    const [row] = await db
      .update(clubLocationsTable)
      .set(patch)
      .where(and(eq(clubLocationsTable.id, locationId ?? -1), eq(clubLocationsTable.clubId, ctx.club.id)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Locatie niet gevonden." });
      return;
    }
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "locatie_gewijzigd", targetType: "location", targetId: row.id });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "club location update failed");
    res.status(500).json({ error: "Locatie wijzigen is niet gelukt." });
  }
});

// ── Clubkalender (trainingen + wedstrijden samengevoegd) ─────────────────────

router.get("/:clubId/calendar", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const from = str(req.query["from"]) ?? new Date().toISOString().slice(0, 10);
    const [trainings, races] = await Promise.all([
      db
        .select()
        .from(clubTrainingsTable)
        .where(and(eq(clubTrainingsTable.clubId, ctx.club.id), gte(clubTrainingsTable.trainingDate, from)))
        .orderBy(asc(clubTrainingsTable.trainingDate)),
      db
        .select()
        .from(clubRaceEventsTable)
        .where(and(eq(clubRaceEventsTable.clubId, ctx.club.id), gte(clubRaceEventsTable.raceDate, from)))
        .orderBy(asc(clubRaceEventsTable.raceDate)),
    ]);
    const items = [
      ...trainings.map((t) => ({ kind: "training" as const, date: t.trainingDate, time: t.startTime, item: t })),
      ...races.map((r) => ({ kind: "wedstrijd" as const, date: r.raceDate, time: r.meetTime, item: r })),
    ].sort((a, b) => (a.date === b.date ? (a.time ?? "").localeCompare(b.time ?? "") : a.date.localeCompare(b.date)));
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "club calendar failed");
    res.status(500).json({ error: "Clubkalender ophalen is niet gelukt." });
  }
});

// ── Abonnement / pakket ───────────────────────────────────────────────────────

router.get("/:clubId/subscription", requireAuth, async (req, res) => {
  const ctx = await ctxOr403(req, res);
  if (!ctx) return;
  if (!canManageClub(ctx)) {
    res.status(403).json({ error: "Alleen de clubbeheerder ziet het abonnement." });
    return;
  }
  const counts = await countActive(ctx.club.id);
  res.json({ subscription: ctx.subscription, counts, packages: CLUB_PACKAGES });
});

router.put("/:clubId/subscription", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!hasClubRole(ctx, ["owner"])) {
      res.status(403).json({ error: "Alleen de clubeigenaar kan het pakket wijzigen." });
      return;
    }
    const pkgKey = str(req.body?.packageKey);
    if (!pkgKey || !CLUB_PACKAGES[pkgKey]) {
      res.status(400).json({ error: "Onbekend pakket." });
      return;
    }
    const pkg = CLUB_PACKAGES[pkgKey]!;
    const [updated] = await db
      .update(clubSubscriptionsTable)
      .set({
        packageKey: pkgKey,
        status: pkgKey === "proef" ? "trial" : "active",
        maxMembers: pkg.maxMembers,
        maxTrainers: pkg.maxTrainers,
        updatedAt: new Date(),
      })
      .where(eq(clubSubscriptionsTable.clubId, ctx.club.id))
      .returning();
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "pakket_gewijzigd",
      targetType: "subscription",
      targetId: ctx.club.id,
      detail: { packageKey: pkgKey },
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "club subscription update failed");
    res.status(500).json({ error: "Pakket wijzigen is niet gelukt." });
  }
});

// ── Leden ─────────────────────────────────────────────────────────────────────

router.get("/:clubId/members", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const manage = canManageClub(ctx);
    const isTrainer = hasClubRole(ctx, ["trainer"]);
    const isTeamManager = hasClubRole(ctx, ["teammanager"]);
    if (!manage && !isTrainer && !isTeamManager) {
      res.status(403).json({ error: "Geen inzage in de ledenlijst." });
      return;
    }
    const includeHistory = manage && req.query["historie"] === "1";
    const members = await db
      .select()
      .from(clubMembersTable)
      .where(
        includeHistory
          ? eq(clubMembersTable.clubId, ctx.club.id)
          : and(eq(clubMembersTable.clubId, ctx.club.id), isNull(clubMembersTable.endedAt)),
      )
      .orderBy(desc(clubMembersTable.joinedAt));

    // Trainer/teammanager: alleen de sporters binnen de eigen toewijzing.
    let visible = members;
    if (!manage) {
      const scope = new Set(await assignedAthleteIds(ctx.club.id, ctx.membership.clerkId));
      if (isTeamManager) {
        const teams = await db
          .select()
          .from(clubTeamsTable)
          .where(
            and(
              eq(clubTeamsTable.clubId, ctx.club.id),
              eq(clubTeamsTable.managerClerkId, ctx.membership.clerkId),
            ),
          );
        const teamIds = teams.map((t) => t.id);
        if (teamIds.length > 0) {
          const rows = await db
            .select({ clerkId: clubTeamMembersTable.clerkId })
            .from(clubTeamMembersTable)
            .where(inArray(clubTeamMembersTable.teamId, teamIds));
          for (const r of rows) scope.add(r.clerkId);
        }
      }
      visible = members.filter((m) => scope.has(m.clerkId) || m.clerkId === ctx.membership.clerkId);
    }

    const names = await profilesByIds(visible.map((m) => m.clerkId));
    // Jeugdstatus (alleen ja/nee) voor beheer — nodig voor toestemmingsbeheer.
    const birthRows = manage
      ? await db
          .select({
            clerkId: athleteProfilesTable.clerkId,
            birthDate: athleteProfilesTable.birthDate,
            birthYear: athleteProfilesTable.birthYear,
          })
          .from(athleteProfilesTable)
          .where(inArray(athleteProfilesTable.clerkId, visible.map((m) => m.clerkId)))
      : [];
    const birthMap = new Map(birthRows.map((r) => [r.clerkId, r]));

    res.json(
      visible.map((m) => {
        const p = names.get(m.clerkId);
        const b = birthMap.get(m.clerkId);
        const age = b ? computeAge(b.birthDate, b.birthYear) : null;
        return {
          ...m,
          displayName: p?.displayName ?? null,
          email: manage ? p?.email ?? null : null,
          isYouth: manage ? (age != null ? age < 16 : null) : undefined,
        };
      }),
    );
  } catch (err) {
    req.log.error({ err }, "club members failed");
    res.status(500).json({ error: "Ledenlijst ophalen is niet gelukt." });
  }
});

// Rol wijzigen (owner/admin; alleen owner mag admin/owner-rollen aanpassen).
router.put("/:clubId/members/:memberId/role", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de clubbeheerder kan rollen wijzigen." });
      return;
    }
    const memberId = intParam(req.params["memberId"]);
    const role = str(req.body?.role) as ClubRole | null;
    if (memberId == null || !role || !clubRoles.includes(role)) {
      res.status(400).json({ error: "Ongeldige rol." });
      return;
    }
    const [target] = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.id, memberId), eq(clubMembersTable.clubId, ctx.club.id)));
    if (!target || target.endedAt) {
      res.status(404).json({ error: "Lid niet gevonden." });
      return;
    }
    const sensitive = role === "owner" || role === "admin" || target.role === "owner" || target.role === "admin";
    if (sensitive && !hasClubRole(ctx, ["owner"])) {
      res.status(403).json({ error: "Alleen de clubeigenaar kan beheerdersrollen wijzigen." });
      return;
    }
    if (target.role === "owner" && role !== "owner") {
      res.status(400).json({ error: "Draag eerst het eigenaarschap over voordat je deze rol wijzigt." });
      return;
    }
    if (
      TRAINER_COUNT_ROLES.includes(role as never) &&
      !TRAINER_COUNT_ROLES.includes(target.role as never)
    ) {
      const cap = await checkCapacityForNew(ctx, "trainer");
      if (!cap.ok) {
        res.status(409).json({ error: cap.reason });
        return;
      }
    }
    const [updated] = await db
      .update(clubMembersTable)
      .set({ role, updatedAt: new Date() })
      .where(eq(clubMembersTable.id, memberId))
      .returning();
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "rol_gewijzigd",
      targetType: "member",
      targetId: memberId,
      detail: { van: target.role, naar: role },
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "club member role failed");
    res.status(500).json({ error: "Rol wijzigen is niet gelukt." });
  }
});

// Uitschrijven — zet endedAt, verwijdert NOOIT. Zelf uitschrijven mag altijd;
// anderen alleen door beheer. De eigenaar kan zichzelf niet uitschrijven.
router.post("/:clubId/members/:memberId/end", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const memberId = intParam(req.params["memberId"]);
    if (memberId == null) {
      res.status(400).json({ error: "Ongeldig lid." });
      return;
    }
    const [target] = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.id, memberId), eq(clubMembersTable.clubId, ctx.club.id)));
    if (!target || target.endedAt) {
      res.status(404).json({ error: "Actief lidmaatschap niet gevonden." });
      return;
    }
    const self = target.clerkId === ctx.membership.clerkId;
    if (!self && !canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de clubbeheerder kan een ander lid uitschrijven." });
      return;
    }
    if (target.role === "owner") {
      res.status(400).json({ error: "De clubeigenaar kan niet worden uitgeschreven. Draag eerst het eigenaarschap over." });
      return;
    }
    const [updated] = await db
      .update(clubMembersTable)
      .set({
        endedAt: new Date(),
        endedReason: str(req.body?.reason) ?? (self ? "zelf_uitgeschreven" : "uitgeschreven_door_beheer"),
        endedByClerkId: ctx.membership.clerkId,
        updatedAt: new Date(),
      })
      .where(and(eq(clubMembersTable.id, memberId), isNull(clubMembersTable.endedAt)))
      .returning();
    if (!updated) {
      res.status(409).json({ error: "Lidmaatschap was al beëindigd." });
      return;
    }
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "lid_uitgeschreven",
      targetType: "member",
      targetId: memberId,
      detail: { zelf: self },
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "club member end failed");
    res.status(500).json({ error: "Uitschrijven is niet gelukt." });
  }
});

// ── Teams & groepen ───────────────────────────────────────────────────────────

router.post("/:clubId/teams", requireAuth, async (req, res) => {
  const ctx = await ctxOr403(req, res);
  if (!ctx) return;
  if (!canManageClub(ctx)) {
    res.status(403).json({ error: "Alleen de clubbeheerder kan teams aanmaken." });
    return;
  }
  const name = str(req.body?.name);
  if (!name) {
    res.status(400).json({ error: "Geef het team een naam." });
    return;
  }
  const [team] = await db
    .insert(clubTeamsTable)
    .values({
      clubId: ctx.club.id,
      name,
      description: str(req.body?.description),
      managerClerkId: str(req.body?.managerClerkId),
      category: str(req.body?.category),
      level: str(req.body?.level),
      season: str(req.body?.season),
      trainingDays: str(req.body?.trainingDays),
      defaultLocation: str(req.body?.defaultLocation),
      maxSize: req.body?.maxSize != null ? intParam(req.body.maxSize) : null,
      joinCode: generateJoinCode(),
    })
    .returning();
  await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "team_aangemaakt", targetType: "team", targetId: team!.id });
  res.status(201).json(team);
});

router.put("/:clubId/teams/:teamId", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de clubbeheerder kan teams wijzigen." });
      return;
    }
    const teamId = intParam(req.params["teamId"]);
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of ["name", "description", "category", "level", "season", "trainingDays", "defaultLocation", "managerClerkId"] as const) {
      if (typeof req.body?.[key] === "string") patch[key] = req.body[key].trim() || null;
    }
    if (patch["name"] === null) delete patch["name"];
    if (req.body?.maxSize !== undefined) patch["maxSize"] = req.body.maxSize == null ? null : intParam(req.body.maxSize);
    const [team] = await db
      .update(clubTeamsTable)
      .set(patch)
      .where(and(eq(clubTeamsTable.id, teamId ?? -1), eq(clubTeamsTable.clubId, ctx.club.id)))
      .returning();
    if (!team) {
      res.status(404).json({ error: "Team niet gevonden." });
      return;
    }
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "team_gewijzigd", targetType: "team", targetId: team.id });
    res.json(team);
  } catch (err) {
    req.log.error({ err }, "club team update failed");
    res.status(500).json({ error: "Team wijzigen is niet gelukt." });
  }
});

router.post("/:clubId/groups", requireAuth, async (req, res) => {
  const ctx = await ctxOr403(req, res);
  if (!ctx) return;
  if (!canManageClub(ctx)) {
    res.status(403).json({ error: "Alleen de clubbeheerder kan trainingsgroepen aanmaken." });
    return;
  }
  const name = str(req.body?.name);
  if (!name) {
    res.status(400).json({ error: "Geef de groep een naam." });
    return;
  }
  const [group] = await db
    .insert(clubGroupsTable)
    .values({
      clubId: ctx.club.id,
      name,
      level: str(req.body?.level),
      description: str(req.body?.description),
      trainerClerkId: str(req.body?.trainerClerkId),
      season: str(req.body?.season),
      trainingDays: str(req.body?.trainingDays),
      defaultLocation: str(req.body?.defaultLocation),
      maxSize: req.body?.maxSize != null ? intParam(req.body.maxSize) : null,
    })
    .returning();
  await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "groep_aangemaakt", targetType: "group", targetId: group!.id });
  res.status(201).json(group);
});

// Leden indelen (team). Beheer of teammanager van het team.
router.post("/:clubId/teams/:teamId/members", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const teamId = intParam(req.params["teamId"]);
    const clerkId = str(req.body?.clerkId);
    if (teamId == null || !clerkId) {
      res.status(400).json({ error: "Ongeldige invoer." });
      return;
    }
    const [team] = await db
      .select()
      .from(clubTeamsTable)
      .where(and(eq(clubTeamsTable.id, teamId), eq(clubTeamsTable.clubId, ctx.club.id)));
    if (!team) {
      res.status(404).json({ error: "Team niet gevonden." });
      return;
    }
    // WP-02: de hoofdtrainer verdeelt sporters over teams (organisatiecontext).
    const isManager = team.managerClerkId === ctx.membership.clerkId;
    if (!canManageClub(ctx) && !hasClubRole(ctx, ["hoofdtrainer"]) && !isManager) {
      res.status(403).json({ error: "Alleen beheer, de hoofdtrainer of de teammanager kan de teamindeling wijzigen." });
      return;
    }
    // Alleen actieve clubleden kunnen worden ingedeeld.
    const memberCtx = await getClubContext(ctx.club.id, clerkId);
    if (!memberCtx) {
      res.status(400).json({ error: "Deze persoon is geen actief clublid." });
      return;
    }
    const [row] = await db
      .insert(clubTeamMembersTable)
      .values({ teamId, clerkId, role: str(req.body?.role) ?? "renner" })
      .onConflictDoUpdate({
        target: [clubTeamMembersTable.teamId, clubTeamMembersTable.clerkId],
        // De unique index is partial (ended_at IS NULL); zonder targetWhere
        // matcht ON CONFLICT hem niet en klapt de insert met een 500.
        targetWhere: sql`ended_at IS NULL`,
        set: { role: str(req.body?.role) ?? "renner" },
      })
      .returning();
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "teamindeling_gewijzigd", targetType: "team", targetId: teamId, detail: { lid: clerkId } });
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "club team member failed");
    res.status(500).json({ error: "Teamindeling wijzigen is niet gelukt." });
  }
});

router.post("/:clubId/groups/:groupId/members", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const groupId = intParam(req.params["groupId"]);
    const clerkId = str(req.body?.clerkId);
    if (groupId == null || !clerkId) {
      res.status(400).json({ error: "Ongeldige invoer." });
      return;
    }
    const [group] = await db
      .select()
      .from(clubGroupsTable)
      .where(and(eq(clubGroupsTable.id, groupId), eq(clubGroupsTable.clubId, ctx.club.id)));
    if (!group) {
      res.status(404).json({ error: "Groep niet gevonden." });
      return;
    }
    // WP-02: de hoofdtrainer verdeelt sporters over groepen (organisatiecontext).
    const isGroupTrainer = group.trainerClerkId === ctx.membership.clerkId;
    if (!canManageClub(ctx) && !hasClubRole(ctx, ["hoofdtrainer"]) && !isGroupTrainer) {
      res.status(403).json({ error: "Alleen beheer, de hoofdtrainer of de groepstrainer kan de groepsindeling wijzigen." });
      return;
    }
    const memberCtx = await getClubContext(ctx.club.id, clerkId);
    if (!memberCtx) {
      res.status(400).json({ error: "Deze persoon is geen actief clublid." });
      return;
    }
    const [row] = await db
      .insert(clubGroupMembersTable)
      .values({ groupId, clerkId })
      .onConflictDoNothing()
      .returning();
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "groepsindeling_gewijzigd", targetType: "group", targetId: groupId, detail: { lid: clerkId } });
    res.status(201).json(row ?? { groupId, clerkId });
  } catch (err) {
    req.log.error({ err }, "club group member failed");
    res.status(500).json({ error: "Groepsindeling wijzigen is niet gelukt." });
  }
});

// WP-02 — Hoofdtraineroverzicht: trainers binnen de eigen organisatiecontext,
// hun toewijzingen en planactiviteit. BEWUST zonder gezondheids-, herstel- of
// privédata: alleen organisatorische feiten (wie, waar toegewezen, hoeveel
// sporters, hoeveel geplande clubtrainingen recent).
router.get("/:clubId/hoofdtrainer/overview", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageTrainerAssignments(ctx)) {
      res.status(403).json({ error: "Alleen beheer of de hoofdtrainer kan dit overzicht zien." });
      return;
    }
    const clubId = ctx.club.id;
    const [members, assignments, teams, groups] = await Promise.all([
      db
        .select({
          clerkId: clubMembersTable.clerkId,
          role: clubMembersTable.role,
          displayName: userProfilesTable.displayName,
        })
        .from(clubMembersTable)
        .leftJoin(userProfilesTable, eq(userProfilesTable.clerkId, clubMembersTable.clerkId))
        .where(and(eq(clubMembersTable.clubId, clubId), isNull(clubMembersTable.endedAt))),
      db
        .select()
        .from(clubTrainerAssignmentsTable)
        .where(eq(clubTrainerAssignmentsTable.clubId, clubId)),
      db.select().from(clubTeamsTable).where(eq(clubTeamsTable.clubId, clubId)),
      db.select().from(clubGroupsTable).where(eq(clubGroupsTable.clubId, clubId)),
    ]);
    const teamName = new Map(teams.map((t) => [t.id, t.name]));
    const groupName = new Map(groups.map((g) => [g.id, g.name]));
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const sinceISO = since.toISOString().slice(0, 10);
    const recentTrainings = await db
      .select({
        trainerClerkId: clubTrainingsTable.trainerClerkId,
        createdByClerkId: clubTrainingsTable.createdByClerkId,
        trainingDate: clubTrainingsTable.trainingDate,
      })
      .from(clubTrainingsTable)
      .where(and(eq(clubTrainingsTable.clubId, clubId), gte(clubTrainingsTable.trainingDate, sinceISO)));
    const trainerRoles = new Set(TRAINER_COUNT_ROLES);
    const trainers = await Promise.all(
      members
        .filter((m) => trainerRoles.has(m.role as (typeof TRAINER_COUNT_ROLES)[number]))
        .map(async (m) => {
          const mine = assignments.filter((a) => a.trainerClerkId === m.clerkId);
          const athleteIds = await assignedAthleteIds(clubId, m.clerkId);
          const trainingCount = recentTrainings.filter(
            (t) => t.trainerClerkId === m.clerkId || t.createdByClerkId === m.clerkId,
          ).length;
          return {
            clerkId: m.clerkId,
            displayName: m.displayName ?? null,
            role: m.role,
            assignments: mine.map((a) => ({
              teamId: a.teamId,
              team: a.teamId != null ? (teamName.get(a.teamId) ?? null) : null,
              groupId: a.groupId,
              group: a.groupId != null ? (groupName.get(a.groupId) ?? null) : null,
            })),
            assignedAthleteCount: athleteIds.length,
            trainingsLast30Days: trainingCount,
          };
        }),
    );
    res.json({ trainers, sinds: sinceISO });
  } catch (err) {
    req.log.error({ err }, "club hoofdtrainer overview failed");
    res.status(500).json({ error: "Overzicht ophalen is niet gelukt." });
  }
});

// Trainer-toewijzing aan team/groep (beheer).
router.post("/:clubId/trainer-assignments", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageTrainerAssignments(ctx)) {
      res.status(403).json({ error: "Alleen beheer of de hoofdtrainer wijst trainers toe." });
      return;
    }
    const trainerClerkId = str(req.body?.trainerClerkId);
    const teamId = req.body?.teamId != null ? intParam(req.body.teamId) : null;
    const groupId = req.body?.groupId != null ? intParam(req.body.groupId) : null;
    if (!trainerClerkId || (teamId == null) === (groupId == null)) {
      res.status(400).json({ error: "Kies een trainer en precies één team of groep." });
      return;
    }
    const trainerCtx = await getClubContext(ctx.club.id, trainerClerkId);
    if (!trainerCtx || !TRAINER_LIKE_ROLES.includes(trainerCtx.membership.role as never)) {
      res.status(400).json({ error: "Deze persoon heeft geen trainersrol in de club." });
      return;
    }
    // Cross-club isolatie: het team of de groep moet van DEZE club zijn.
    if (teamId != null) {
      const [team] = await db
        .select({ id: clubTeamsTable.id })
        .from(clubTeamsTable)
        .where(and(eq(clubTeamsTable.id, teamId), eq(clubTeamsTable.clubId, ctx.club.id)));
      if (!team) {
        res.status(400).json({ error: "Dit team hoort niet bij deze club." });
        return;
      }
    }
    if (groupId != null) {
      const [group] = await db
        .select({ id: clubGroupsTable.id })
        .from(clubGroupsTable)
        .where(and(eq(clubGroupsTable.id, groupId), eq(clubGroupsTable.clubId, ctx.club.id)));
      if (!group) {
        res.status(400).json({ error: "Deze groep hoort niet bij deze club." });
        return;
      }
    }
    const [row] = await db
      .insert(clubTrainerAssignmentsTable)
      .values({ clubId: ctx.club.id, trainerClerkId, teamId, groupId })
      .onConflictDoNothing()
      .returning();
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "trainer_toegewezen", targetType: "member", targetId: trainerClerkId, detail: { teamId, groupId } });
    res.status(201).json(row ?? { trainerClerkId, teamId, groupId });
  } catch (err) {
    req.log.error({ err }, "club trainer assignment failed");
    res.status(500).json({ error: "Trainer toewijzen is niet gelukt." });
  }
});

// ── Clubtrainingen ────────────────────────────────────────────────────────────

router.post("/:clubId/trainings", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!clubWritableOr409(ctx, res)) return;
    if (!canManageTrainings(ctx)) {
      res.status(403).json({ error: "Alleen beheer of een trainer kan clubtrainingen plannen." });
      return;
    }
    if (!statusGuard(ctx, res)) return;
    const title = str(req.body?.title);
    const trainingDate = str(req.body?.trainingDate);
    if (!title || !trainingDate || !/^\d{4}-\d{2}-\d{2}$/.test(trainingDate)) {
      res.status(400).json({ error: "Titel en een geldige datum zijn verplicht." });
      return;
    }
    const [training] = await db
      .insert(clubTrainingsTable)
      .values({
        clubId: ctx.club.id,
        title,
        trainingDate,
        startTime: str(req.body?.startTime),
        location: str(req.body?.location),
        level: str(req.body?.level),
        goal: str(req.body?.goal),
        notes: str(req.body?.notes),
        trainerClerkId: str(req.body?.trainerClerkId) ?? (ctx.membership.role === "trainer" ? ctx.membership.clerkId : null),
        teamId: req.body?.teamId != null ? intParam(req.body.teamId) : null,
        groupId: req.body?.groupId != null ? intParam(req.body.groupId) : null,
        maxParticipants: req.body?.maxParticipants != null ? intParam(req.body.maxParticipants) : null,
        durationMin: req.body?.durationMin != null ? intParam(req.body.durationMin) : null,
        routeId: req.body?.routeId != null ? intParam(req.body.routeId) : null,
        materialInfo: str(req.body?.materialInfo),
        safetyInfo: str(req.body?.safetyInfo),
        locationId: req.body?.locationId != null ? intParam(req.body.locationId) : null,
        createdByClerkId: ctx.membership.clerkId,
      })
      .returning();
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "training_gepland", targetType: "training", targetId: training!.id });
    res.status(201).json(training);
  } catch (err) {
    req.log.error({ err }, "club training create failed");
    res.status(500).json({ error: "Training plannen is niet gelukt." });
  }
});

router.get("/:clubId/trainings", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const from = str(req.query["from"]) ?? new Date().toISOString().slice(0, 10);
    const trainings = await db
      .select()
      .from(clubTrainingsTable)
      .where(and(eq(clubTrainingsTable.clubId, ctx.club.id), gte(clubTrainingsTable.trainingDate, from)))
      .orderBy(asc(clubTrainingsTable.trainingDate));
    const ids = trainings.map((t) => t.id);
    const signups =
      ids.length > 0
        ? await db
            .select()
            .from(clubTrainingSignupsTable)
            .where(inArray(clubTrainingSignupsTable.trainingId, ids))
        : [];
    const manage = canManageTrainings(ctx);
    const names = manage ? await profilesByIds(signups.map((s) => s.clerkId)) : new Map();
    res.json(
      trainings.map((t) => {
        const su = signups.filter((s) => s.trainingId === t.id);
        return {
          ...t,
          counts: {
            aangemeld: su.filter((s) => s.status === "aangemeld").length,
            afgemeld: su.filter((s) => s.status === "afgemeld").length,
            reserve: su.filter((s) => s.status === "reserve").length,
            misschien: su.filter((s) => s.status === "misschien").length,
          },
          mySignup: su.find((s) => s.clerkId === ctx.membership.clerkId) ?? null,
          signups: manage
            ? su.map((s) => ({
                ...s,
                displayName: names.get(s.clerkId)?.displayName ?? null,
              }))
            : undefined,
        };
      }),
    );
  } catch (err) {
    req.log.error({ err }, "club trainings list failed");
    res.status(500).json({ error: "Trainingen ophalen is niet gelukt." });
  }
});

router.put("/:clubId/trainings/:trainingId", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!clubWritableOr409(ctx, res)) return;
    const trainingId = intParam(req.params["trainingId"]);
    const [training] = await db
      .select()
      .from(clubTrainingsTable)
      .where(and(eq(clubTrainingsTable.id, trainingId ?? -1), eq(clubTrainingsTable.clubId, ctx.club.id)));
    if (!training) {
      res.status(404).json({ error: "Training niet gevonden." });
      return;
    }
    const isOwnTraining = training.trainerClerkId === ctx.membership.clerkId || training.createdByClerkId === ctx.membership.clerkId;
    const fullEdit =
      canManageClub(ctx) ||
      hasClubRole(ctx, ["hoofdtrainer"]) ||
      (hasClubRole(ctx, ["trainer", "assistent"]) && isOwnTraining);
    // Mechanieker: mag ALLEEN materiaal- en veiligheidsinformatie bijwerken.
    const materialOnly = !fullEdit && canEditMaterial(ctx);
    if (!fullEdit && !materialOnly) {
      res.status(403).json({ error: "Alleen beheer of de eigen trainer kan deze training wijzigen." });
      return;
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const textKeys = materialOnly
      ? (["materialInfo", "safetyInfo"] as const)
      : (["title", "startTime", "location", "level", "goal", "notes", "status", "materialInfo", "safetyInfo"] as const);
    for (const key of textKeys) {
      if (typeof req.body?.[key] === "string") patch[key] = req.body[key].trim() || null;
    }
    if (patch["title"] === null) delete patch["title"];
    if (!materialOnly) {
      if (typeof req.body?.trainingDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.trainingDate))
        patch["trainingDate"] = req.body.trainingDate;
      if (req.body?.maxParticipants !== undefined) patch["maxParticipants"] = intParam(req.body.maxParticipants);
      if (req.body?.durationMin !== undefined) patch["durationMin"] = intParam(req.body.durationMin);
      if (req.body?.locationId !== undefined) patch["locationId"] = req.body.locationId == null ? null : intParam(req.body.locationId);
    }
    const [updated] = await db
      .update(clubTrainingsTable)
      .set(patch)
      .where(eq(clubTrainingsTable.id, training.id))
      .returning();
    // WP-02: geen stil overschrijven — als iemand andermans training wijzigt
    // (bijv. hoofdtrainer of beheer), legt het audittrail expliciet vast wiens
    // training het was en welke velden zijn geraakt.
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "training_gewijzigd",
      targetType: "training",
      targetId: training.id,
      detail: isOwnTraining
        ? { eigenTraining: true, velden: Object.keys(patch).filter((k) => k !== "updatedAt") }
        : {
            eigenTraining: false,
            trainerVanTraining: training.trainerClerkId ?? training.createdByClerkId ?? null,
            velden: Object.keys(patch).filter((k) => k !== "updatedAt"),
          },
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "club training update failed");
    res.status(500).json({ error: "Training wijzigen is niet gelukt." });
  }
});

// Aanmelden/afmelden. Vol = eerlijk op reserve; afmelding schuift de eerste
// reserve automatisch door (met melding).
router.post("/:clubId/trainings/:trainingId/signup", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!clubWritableOr409(ctx, res)) return;
    const trainingId = intParam(req.params["trainingId"]);
    const wanted = str(req.body?.status) ?? "aangemeld";
    if (!clubSignupStatuses.includes(wanted as never)) {
      res.status(400).json({ error: "Ongeldige status." });
      return;
    }
    const [training] = await db
      .select()
      .from(clubTrainingsTable)
      .where(and(eq(clubTrainingsTable.id, trainingId ?? -1), eq(clubTrainingsTable.clubId, ctx.club.id)));
    if (!training || training.status !== "gepland") {
      res.status(404).json({ error: "Deze training is niet (meer) beschikbaar." });
      return;
    }
    const clerkId = ctx.membership.clerkId;

    const result = await db.transaction(async (tx) => {
      // Row-lock op de training: serialiseert gelijktijdige aan-/afmeldingen
      // zodat capaciteit en reservepromotie nooit overboeken.
      await tx
        .select({ id: clubTrainingsTable.id })
        .from(clubTrainingsTable)
        .where(eq(clubTrainingsTable.id, training.id))
        .for("update");
      const existing = await tx
        .select()
        .from(clubTrainingSignupsTable)
        .where(eq(clubTrainingSignupsTable.trainingId, training.id));
      const mine = existing.find((s) => s.clerkId === clerkId);
      let status = wanted;
      if (wanted === "aangemeld" && training.maxParticipants != null) {
        const aangemeld = existing.filter((s) => s.status === "aangemeld" && s.clerkId !== clerkId).length;
        if (aangemeld >= training.maxParticipants) status = "reserve";
      }
      const [row] = mine
        ? await tx
            .update(clubTrainingSignupsTable)
            .set({ status, note: str(req.body?.note), updatedAt: new Date() })
            .where(eq(clubTrainingSignupsTable.id, mine.id))
            .returning()
        : await tx
            .insert(clubTrainingSignupsTable)
            .values({ trainingId: training.id, clerkId, status, note: str(req.body?.note) })
            .returning();

      // Afmelding of "misschien" maakt plek vrij: promoveer de langst
      // wachtende reserve.
      let promoted: typeof row | null = null;
      if (mine?.status === "aangemeld" && (status === "afgemeld" || status === "misschien")) {
        const reserve = existing
          .filter((s) => s.status === "reserve" && s.clerkId !== clerkId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
        if (reserve) {
          const [p] = await tx
            .update(clubTrainingSignupsTable)
            .set({ status: "aangemeld", updatedAt: new Date() })
            .where(and(eq(clubTrainingSignupsTable.id, reserve.id), eq(clubTrainingSignupsTable.status, "reserve")))
            .returning();
          promoted = p ?? null;
        }
      }
      return { row: row!, promoted };
    });

    if (result.promoted) {
      void createNotification({
        clerkId: result.promoted.clerkId,
        type: "club_update",
        title: "Je bent doorgeschoven van reserve",
        body: `Er kwam een plek vrij voor "${training.title}" op ${training.trainingDate}. Je staat nu aangemeld.`,
        actionUrl: "/club",
      });
    }
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: clerkId,
      action: `training_${result.row.status}`,
      targetType: "training",
      targetId: training.id,
    });

    // Eerlijke conflictmelding: bestaat er al een eigen geplande training op
    // deze dag, dan melden we dat — we passen NOOIT zelf iets aan.
    const conflicts =
      result.row.status === "aangemeld"
        ? await db
            .select()
            .from(plannedWorkoutsTable)
            .where(
              and(
                eq(plannedWorkoutsTable.clerkId, clerkId),
                eq(plannedWorkoutsTable.scheduledDate, training.trainingDate),
                eq(plannedWorkoutsTable.status, "planned"),
              ),
            )
        : [];

    res.json({
      signup: result.row,
      conflicts: conflicts.map((w) => ({
        id: w.id,
        title: w.title,
        source: w.source,
        scheduledDate: w.scheduledDate,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "club training signup failed");
    res.status(500).json({ error: "Aanmelden is niet gelukt." });
  }
});

// Bewuste koppeling aan het eigen schema. Maakt een NIEUWE planned_workouts-rij
// (source "club"). Een bestaande coachtraining wordt nooit overschreven; bij
// keuze "vervang" mag alleen een eigen (niet-coach) training worden vervangen.
router.post("/:clubId/trainings/:trainingId/link-schedule", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!clubWritableOr409(ctx, res)) return;
    const trainingId = intParam(req.params["trainingId"]);
    const mode = str(req.body?.mode) ?? "toevoegen"; // toevoegen | vervangen
    const replaceWorkoutId = req.body?.replaceWorkoutId != null ? intParam(req.body.replaceWorkoutId) : null;
    const clerkId = ctx.membership.clerkId;

    const [training] = await db
      .select()
      .from(clubTrainingsTable)
      .where(and(eq(clubTrainingsTable.id, trainingId ?? -1), eq(clubTrainingsTable.clubId, ctx.club.id)));
    if (!training) {
      res.status(404).json({ error: "Training niet gevonden." });
      return;
    }
    const [signup] = await db
      .select()
      .from(clubTrainingSignupsTable)
      .where(
        and(
          eq(clubTrainingSignupsTable.trainingId, training.id),
          eq(clubTrainingSignupsTable.clerkId, clerkId),
        ),
      );
    if (!signup || signup.status !== "aangemeld") {
      res.status(400).json({ error: "Meld je eerst aan voor deze training." });
      return;
    }
    if (signup.plannedWorkoutId != null) {
      res.status(409).json({ error: "Deze clubtraining staat al in je schema." });
      return;
    }

    if (mode === "vervangen") {
      if (replaceWorkoutId == null) {
        res.status(400).json({ error: "Geef aan welke eigen training je wilt vervangen." });
        return;
      }
      const [existing] = await db
        .select()
        .from(plannedWorkoutsTable)
        .where(and(eq(plannedWorkoutsTable.id, replaceWorkoutId), eq(plannedWorkoutsTable.clerkId, clerkId)));
      if (!existing) {
        res.status(404).json({ error: "Te vervangen training niet gevonden." });
        return;
      }
      if (existing.source === "coach") {
        res.status(409).json({
          error:
            "Deze training is door je coach klaargezet en wordt nooit automatisch vervangen. Overleg met je coach of houd beide trainingen aan.",
        });
        return;
      }
      await db
        .update(plannedWorkoutsTable)
        .set({ status: "skipped", updatedAt: new Date() })
        .where(eq(plannedWorkoutsTable.id, existing.id));
    }

    const [workout] = await db
      .insert(plannedWorkoutsTable)
      .values({
        clerkId,
        scheduledDate: training.trainingDate,
        type: "ride",
        title: `Clubtraining: ${training.title}`,
        description: [training.goal, training.location ? `Locatie: ${training.location}` : null, training.startTime ? `Start: ${training.startTime}` : null]
          .filter(Boolean)
          .join(" · ") || null,
        targetDurationMin: training.durationMin,
        source: "club",
      })
      .returning();
    await db
      .update(clubTrainingSignupsTable)
      .set({ plannedWorkoutId: workout!.id, updatedAt: new Date() })
      .where(eq(clubTrainingSignupsTable.id, signup.id));
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: clerkId,
      action: "training_in_schema",
      targetType: "training",
      targetId: training.id,
      detail: { mode },
    });
    res.status(201).json({ workout });
  } catch (err) {
    req.log.error({ err }, "club training link failed");
    res.status(500).json({ error: "In je schema zetten is niet gelukt." });
  }
});

// Aanwezigheid registreren (trainer van de training of beheer).
router.put("/:clubId/trainings/:trainingId/attendance", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const trainingId = intParam(req.params["trainingId"]);
    const [training] = await db
      .select()
      .from(clubTrainingsTable)
      .where(and(eq(clubTrainingsTable.id, trainingId ?? -1), eq(clubTrainingsTable.clubId, ctx.club.id)));
    if (!training) {
      res.status(404).json({ error: "Training niet gevonden." });
      return;
    }
    const isTrainer = training.trainerClerkId === ctx.membership.clerkId || training.createdByClerkId === ctx.membership.clerkId;
    if (!canManageClub(ctx) && !isTrainer && !canRecordAttendance(ctx)) {
      res.status(403).json({ error: "Alleen de trainer van deze training, een assistent of beheer registreert aanwezigheid." });
      return;
    }
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    let updated = 0;
    for (const e of entries) {
      const clerkId = str(e?.clerkId);
      const attendance = str(e?.attendance);
      if (!clerkId || !attendance || !["aanwezig", "afwezig", "te_laat"].includes(attendance)) continue;
      const rows = await db
        .update(clubTrainingSignupsTable)
        .set({ attendance, updatedAt: new Date() })
        .where(
          and(
            eq(clubTrainingSignupsTable.trainingId, training.id),
            eq(clubTrainingSignupsTable.clerkId, clerkId),
          ),
        )
        .returning();
      updated += rows.length;
    }
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "aanwezigheid_geregistreerd", targetType: "training", targetId: training.id, detail: { aantal: updated } });
    res.json({ updated });
  } catch (err) {
    req.log.error({ err }, "club attendance failed");
    res.status(500).json({ error: "Aanwezigheid registreren is niet gelukt." });
  }
});

// ── Wedstrijdbeheer ───────────────────────────────────────────────────────────

function canManageRaces(ctx: ClubContext): boolean {
  return hasClubRole(ctx, ["owner", "admin", "teammanager"]);
}

router.post("/:clubId/races", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!clubWritableOr409(ctx, res)) return;
    if (!canManageRaces(ctx)) {
      res.status(403).json({ error: "Alleen beheer of een teammanager kan clubwedstrijden beheren." });
      return;
    }
    if (!statusGuard(ctx, res)) return;
    const name = str(req.body?.name);
    const raceDate = str(req.body?.raceDate);
    if (!name || !raceDate || !/^\d{4}-\d{2}-\d{2}$/.test(raceDate)) {
      res.status(400).json({ error: "Naam en een geldige datum zijn verplicht." });
      return;
    }
    // Dubbele invoer voorkomen: zelfde club + naam + datum bestaat al.
    const [dup] = await db
      .select({ id: clubRaceEventsTable.id })
      .from(clubRaceEventsTable)
      .where(
        and(
          eq(clubRaceEventsTable.clubId, ctx.club.id),
          eq(clubRaceEventsTable.name, name),
          eq(clubRaceEventsTable.raceDate, raceDate),
        ),
      );
    if (dup) {
      res.status(409).json({ error: "Deze wedstrijd staat al in de clubkalender (zelfde naam en datum)." });
      return;
    }
    const [event] = await db
      .insert(clubRaceEventsTable)
      .values({
        clubId: ctx.club.id,
        teamId: req.body?.teamId != null ? intParam(req.body.teamId) : null,
        name,
        raceDate,
        location: str(req.body?.location),
        discipline: str(req.body?.discipline),
        meetPoint: str(req.body?.meetPoint),
        meetTime: str(req.body?.meetTime),
        transportInfo: str(req.body?.transportInfo),
        materialInfo: str(req.body?.materialInfo),
        notes: str(req.body?.notes),
        createdByClerkId: ctx.membership.clerkId,
      })
      .returning();
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "wedstrijd_aangemaakt", targetType: "race", targetId: event!.id });
    res.status(201).json(event);
  } catch (err) {
    req.log.error({ err }, "club race create failed");
    res.status(500).json({ error: "Wedstrijd aanmaken is niet gelukt." });
  }
});

router.get("/:clubId/races", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const events = await db
      .select()
      .from(clubRaceEventsTable)
      .where(eq(clubRaceEventsTable.clubId, ctx.club.id))
      .orderBy(asc(clubRaceEventsTable.raceDate));
    const ids = events.map((e) => e.id);
    const selections =
      ids.length > 0
        ? await db
            .select()
            .from(clubRaceSelectionsTable)
            .where(inArray(clubRaceSelectionsTable.eventId, ids))
        : [];
    const names = await profilesByIds(selections.map((s) => s.clerkId));
    res.json(
      events.map((e) => ({
        ...e,
        selections: selections
          .filter((s) => s.eventId === e.id)
          .map((s) => ({ ...s, displayName: names.get(s.clerkId)?.displayName ?? null })),
        mySelection: selections.find((s) => s.eventId === e.id && s.clerkId === ctx.membership.clerkId) ?? null,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "club races failed");
    res.status(500).json({ error: "Wedstrijden ophalen is niet gelukt." });
  }
});

router.put("/:clubId/races/:eventId", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!clubWritableOr409(ctx, res)) return;
    // Mechanieker: mag ALLEEN de materiaalinformatie van een wedstrijd bijwerken.
    const raceFullEdit = canManageRaces(ctx);
    const raceMaterialOnly = !raceFullEdit && canEditMaterial(ctx);
    if (!raceFullEdit && !raceMaterialOnly) {
      res.status(403).json({ error: "Alleen beheer of een teammanager kan clubwedstrijden beheren." });
      return;
    }
    const eventId = intParam(req.params["eventId"]);
    const [event] = await db
      .select()
      .from(clubRaceEventsTable)
      .where(and(eq(clubRaceEventsTable.id, eventId ?? -1), eq(clubRaceEventsTable.clubId, ctx.club.id)));
    if (!event) {
      res.status(404).json({ error: "Wedstrijd niet gevonden." });
      return;
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const raceKeys = raceMaterialOnly
      ? (["materialInfo"] as const)
      : (["name", "location", "discipline", "meetPoint", "meetTime", "transportInfo", "materialInfo", "notes", "resultSummary", "debrief", "status"] as const);
    for (const key of raceKeys) {
      if (typeof req.body?.[key] === "string") patch[key] = req.body[key].trim() || null;
    }
    if (patch["name"] === null) delete patch["name"];
    if (!raceMaterialOnly && typeof req.body?.raceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.raceDate))
      patch["raceDate"] = req.body.raceDate;
    const [updated] = await db
      .update(clubRaceEventsTable)
      .set(patch)
      .where(eq(clubRaceEventsTable.id, event.id))
      .returning();
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "wedstrijd_gewijzigd", targetType: "race", targetId: event.id });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "club race update failed");
    res.status(500).json({ error: "Wedstrijd wijzigen is niet gelukt." });
  }
});

// Selectie beheren (beheer/teammanager) — renner/reserve/begeleider.
router.post("/:clubId/races/:eventId/selection", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!clubWritableOr409(ctx, res)) return;
    if (!canManageRaces(ctx)) {
      res.status(403).json({ error: "Alleen beheer of een teammanager beheert de selectie." });
      return;
    }
    const eventId = intParam(req.params["eventId"]);
    const clerkId = str(req.body?.clerkId);
    const role = str(req.body?.role) ?? "renner";
    if (eventId == null || !clerkId || !["renner", "reserve", "begeleider"].includes(role)) {
      res.status(400).json({ error: "Ongeldige selectie." });
      return;
    }
    const [event] = await db
      .select()
      .from(clubRaceEventsTable)
      .where(and(eq(clubRaceEventsTable.id, eventId), eq(clubRaceEventsTable.clubId, ctx.club.id)));
    if (!event) {
      res.status(404).json({ error: "Wedstrijd niet gevonden." });
      return;
    }
    const memberCtx = await getClubContext(ctx.club.id, clerkId);
    if (!memberCtx) {
      res.status(400).json({ error: "Deze persoon is geen actief clublid." });
      return;
    }
    const [row] = await db
      .insert(clubRaceSelectionsTable)
      .values({ eventId, clerkId, role })
      .onConflictDoUpdate({
        target: [clubRaceSelectionsTable.eventId, clubRaceSelectionsTable.clerkId],
        set: { role, updatedAt: new Date() },
      })
      .returning();
    void createNotification({
      clerkId,
      type: "club_update",
      title: "Je bent geselecteerd",
      body: `Je staat als ${role} in de selectie voor "${event.name}" op ${event.raceDate}. Geef je beschikbaarheid door in de club.`,
      actionUrl: "/club",
    });
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "selectie_gewijzigd", targetType: "race", targetId: eventId, detail: { lid: clerkId, rol: role } });
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "club race selection failed");
    res.status(500).json({ error: "Selectie wijzigen is niet gelukt." });
  }
});

// Eigen beschikbaarheid doorgeven (het lid zelf).
router.put("/:clubId/races/:eventId/availability", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!clubWritableOr409(ctx, res)) return;
    const eventId = intParam(req.params["eventId"]);
    const availability = str(req.body?.availability);
    if (eventId == null || !availability || !["beschikbaar", "niet_beschikbaar", "onbekend"].includes(availability)) {
      res.status(400).json({ error: "Ongeldige beschikbaarheid." });
      return;
    }
    const [event] = await db
      .select()
      .from(clubRaceEventsTable)
      .where(and(eq(clubRaceEventsTable.id, eventId), eq(clubRaceEventsTable.clubId, ctx.club.id)));
    if (!event) {
      res.status(404).json({ error: "Wedstrijd niet gevonden." });
      return;
    }
    const [row] = await db
      .insert(clubRaceSelectionsTable)
      .values({
        eventId,
        clerkId: ctx.membership.clerkId,
        availability,
        availabilityNote: str(req.body?.note),
      })
      .onConflictDoUpdate({
        target: [clubRaceSelectionsTable.eventId, clubRaceSelectionsTable.clerkId],
        set: { availability, availabilityNote: str(req.body?.note), updatedAt: new Date() },
      })
      .returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "club race availability failed");
    res.status(500).json({ error: "Beschikbaarheid doorgeven is niet gelukt." });
  }
});

// ── Communicatie ──────────────────────────────────────────────────────────────

async function canPostToScope(
  ctx: ClubContext,
  scope: string,
  teamId: number | null,
  groupId: number | null,
): Promise<boolean> {
  if (canManageClub(ctx)) return true;
  if (scope === "club") return false;
  if (scope === "team" && teamId != null) {
    const [team] = await db
      .select()
      .from(clubTeamsTable)
      .where(and(eq(clubTeamsTable.id, teamId), eq(clubTeamsTable.clubId, ctx.club.id)));
    if (!team) return false;
    if (team.managerClerkId === ctx.membership.clerkId) return true;
    const assigned = await db
      .select()
      .from(clubTrainerAssignmentsTable)
      .where(
        and(
          eq(clubTrainerAssignmentsTable.trainerClerkId, ctx.membership.clerkId),
          eq(clubTrainerAssignmentsTable.teamId, teamId),
        ),
      );
    return assigned.length > 0;
  }
  if (scope === "group" && groupId != null) {
    const [group] = await db
      .select()
      .from(clubGroupsTable)
      .where(and(eq(clubGroupsTable.id, groupId), eq(clubGroupsTable.clubId, ctx.club.id)));
    if (!group) return false;
    if (group.trainerClerkId === ctx.membership.clerkId) return true;
    const assigned = await db
      .select()
      .from(clubTrainerAssignmentsTable)
      .where(
        and(
          eq(clubTrainerAssignmentsTable.trainerClerkId, ctx.membership.clerkId),
          eq(clubTrainerAssignmentsTable.groupId, groupId),
        ),
      );
    return assigned.length > 0;
  }
  return false;
}

// Voor welke scopes mag dit lid berichten LEZEN?
async function readableScopeFilter(ctx: ClubContext) {
  const teamRows = await db
    .select({ teamId: clubTeamMembersTable.teamId })
    .from(clubTeamMembersTable)
    .innerJoin(clubTeamsTable, eq(clubTeamsTable.id, clubTeamMembersTable.teamId))
    .where(and(eq(clubTeamsTable.clubId, ctx.club.id), eq(clubTeamMembersTable.clerkId, ctx.membership.clerkId)));
  const groupRows = await db
    .select({ groupId: clubGroupMembersTable.groupId })
    .from(clubGroupMembersTable)
    .innerJoin(clubGroupsTable, eq(clubGroupsTable.id, clubGroupMembersTable.groupId))
    .where(and(eq(clubGroupsTable.clubId, ctx.club.id), eq(clubGroupMembersTable.clerkId, ctx.membership.clerkId)));
  const teamIds = new Set(teamRows.map((r) => r.teamId));
  const groupIds = new Set(groupRows.map((r) => r.groupId));
  // Trainers/teammanagers lezen ook hun toegewezen scopes.
  const assignments = await db
    .select()
    .from(clubTrainerAssignmentsTable)
    .where(
      and(
        eq(clubTrainerAssignmentsTable.clubId, ctx.club.id),
        eq(clubTrainerAssignmentsTable.trainerClerkId, ctx.membership.clerkId),
      ),
    );
  for (const a of assignments) {
    if (a.teamId != null) teamIds.add(a.teamId);
    if (a.groupId != null) groupIds.add(a.groupId);
  }
  const managed = await db
    .select()
    .from(clubTeamsTable)
    .where(and(eq(clubTeamsTable.clubId, ctx.club.id), eq(clubTeamsTable.managerClerkId, ctx.membership.clerkId)));
  for (const t of managed) teamIds.add(t.id);
  return { teamIds, groupIds };
}

router.post("/:clubId/messages", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!clubWritableOr409(ctx, res)) return;
    if (!canPostMessages(ctx)) {
      res.status(403).json({ error: "Met een alleen-lezen rol kun je geen berichten plaatsen." });
      return;
    }
    if (!statusGuard(ctx, res)) return;
    const body = str(req.body?.body);
    if (!body) {
      res.status(400).json({ error: "Het bericht mag niet leeg zijn." });
      return;
    }
    const parentId = req.body?.parentId != null ? intParam(req.body.parentId) : null;

    if (parentId != null) {
      // Reactie: mag door elk lid dat het oorspronkelijke bericht kan lezen en
      // als reacties open staan.
      const [parent] = await db
        .select()
        .from(clubMessagesTable)
        .where(and(eq(clubMessagesTable.id, parentId), eq(clubMessagesTable.clubId, ctx.club.id)));
      if (!parent) {
        res.status(404).json({ error: "Bericht niet gevonden." });
        return;
      }
      if (!parent.allowReplies) {
        res.status(403).json({ error: "Reacties staan uit voor dit bericht." });
        return;
      }
      if (!canManageClub(ctx) && parent.scope !== "club") {
        const { teamIds, groupIds } = await readableScopeFilter(ctx);
        const readable =
          (parent.scope === "team" && parent.teamId != null && teamIds.has(parent.teamId)) ||
          (parent.scope === "group" && parent.groupId != null && groupIds.has(parent.groupId));
        if (!readable) {
          res.status(403).json({ error: "Je kunt niet reageren op dit bericht." });
          return;
        }
      }
      const [msg] = await db
        .insert(clubMessagesTable)
        .values({
          clubId: ctx.club.id,
          scope: parent.scope,
          teamId: parent.teamId,
          groupId: parent.groupId,
          authorClerkId: ctx.membership.clerkId,
          body,
          parentId,
        })
        .returning();
      res.status(201).json(msg);
      return;
    }

    const scope = str(req.body?.scope) ?? "club";
    const teamId = req.body?.teamId != null ? intParam(req.body.teamId) : null;
    const groupId = req.body?.groupId != null ? intParam(req.body.groupId) : null;
    if (!["club", "team", "group"].includes(scope)) {
      res.status(400).json({ error: "Ongeldige doelgroep." });
      return;
    }
    if (!(await canPostToScope(ctx, scope, teamId, groupId))) {
      res.status(403).json({ error: "Je mag geen bericht sturen naar deze doelgroep." });
      return;
    }
    const [msg] = await db
      .insert(clubMessagesTable)
      .values({
        clubId: ctx.club.id,
        scope,
        teamId: scope === "team" ? teamId : null,
        groupId: scope === "group" ? groupId : null,
        trainingId: req.body?.trainingId != null ? intParam(req.body.trainingId) : null,
        raceEventId: req.body?.raceEventId != null ? intParam(req.body.raceEventId) : null,
        authorClerkId: ctx.membership.clerkId,
        body,
        allowReplies: req.body?.allowReplies !== false,
      })
      .returning();
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "bericht_geplaatst", targetType: "message", targetId: msg!.id, detail: { scope } });
    res.status(201).json(msg);
  } catch (err) {
    req.log.error({ err }, "club message post failed");
    res.status(500).json({ error: "Bericht plaatsen is niet gelukt." });
  }
});

router.get("/:clubId/messages", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const all = await db
      .select()
      .from(clubMessagesTable)
      .where(eq(clubMessagesTable.clubId, ctx.club.id))
      .orderBy(desc(clubMessagesTable.createdAt))
      .limit(200);
    let visible = all;
    if (!canManageClub(ctx)) {
      const { teamIds, groupIds } = await readableScopeFilter(ctx);
      visible = all.filter(
        (m) =>
          m.scope === "club" ||
          (m.scope === "team" && m.teamId != null && teamIds.has(m.teamId)) ||
          (m.scope === "group" && m.groupId != null && groupIds.has(m.groupId)),
      );
    }
    const reads = await db
      .select()
      .from(clubMessageReadsTable)
      .where(
        and(
          inArray(clubMessageReadsTable.messageId, visible.length > 0 ? visible.map((m) => m.id) : [-1]),
          eq(clubMessageReadsTable.clerkId, ctx.membership.clerkId),
        ),
      );
    const readSet = new Set(reads.map((r) => r.messageId));
    const names = await profilesByIds(visible.map((m) => m.authorClerkId));
    res.json(
      visible.map((m) => ({
        ...m,
        authorName: names.get(m.authorClerkId)?.displayName ?? null,
        read: readSet.has(m.id),
      })),
    );
  } catch (err) {
    req.log.error({ err }, "club messages failed");
    res.status(500).json({ error: "Berichten ophalen is niet gelukt." });
  }
});

router.post("/:clubId/messages/:messageId/read", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const messageId = intParam(req.params["messageId"]);
    const [msg] = await db
      .select()
      .from(clubMessagesTable)
      .where(and(eq(clubMessagesTable.id, messageId ?? -1), eq(clubMessagesTable.clubId, ctx.club.id)));
    if (!msg) {
      res.status(404).json({ error: "Bericht niet gevonden." });
      return;
    }
    await db
      .insert(clubMessageReadsTable)
      .values({ messageId: msg.id, clerkId: ctx.membership.clerkId })
      .onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "club message read failed");
    res.status(500).json({ error: "Gelezen-status opslaan is niet gelukt." });
  }
});

// ── Jeugd-toestemming ─────────────────────────────────────────────────────────
// Sportdata delen met toegewezen trainers. Volwassen sporter: zelf. Minderjarig
// (of onbekende leeftijd, fail-closed): ALLEEN een gekoppelde ouder.

router.get("/:clubId/consents/mine", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const clerkId = getClerkUserId(req)!;
    const rows = await db
      .select()
      .from(clubConsentsTable)
      .where(
        and(
          eq(clubConsentsTable.clubId, ctx.club.id),
          eq(clubConsentsTable.athleteClerkId, clerkId),
        ),
      );
    const minor = await isMinorForClub(clerkId);
    // Compatibel: `consent` blijft de training_summary-rij; `consents` = alle scopes.
    res.json({
      consent: rows.find((r) => r.scope === "training_summary") ?? null,
      consents: rows,
      scopes: clubConsentScopes,
      isMinor: minor,
    });
  } catch (err) {
    req.log.error({ err }, "club consent mine failed");
    res.status(500).json({ error: "Toestemming ophalen is niet gelukt." });
  }
});

router.post("/:clubId/consents", requireAuth, async (req, res) => {
  try {
    const clerkId = getClerkUserId(req)!;
    const clubId = intParam(req.params["clubId"]);
    const athleteClerkId = str(req.body?.athleteClerkId) ?? clerkId;
    const action = str(req.body?.action) ?? "grant"; // grant | revoke
    const scope = str(req.body?.scope) ?? "training_summary";
    if (
      clubId == null ||
      !["grant", "revoke"].includes(action) ||
      !(clubConsentScopes as readonly string[]).includes(scope)
    ) {
      res.status(400).json({ error: "Ongeldige invoer." });
      return;
    }
    // De sporter moet actief clublid zijn.
    const athleteCtx = await getClubContext(clubId, athleteClerkId);
    if (!athleteCtx) {
      res.status(400).json({ error: "Deze sporter is geen actief clublid." });
      return;
    }
    const self = athleteClerkId === clerkId;
    const minor = await isMinorForClub(athleteClerkId);
    let grantedByRelation: "self" | "parent";
    if (self) {
      if (minor) {
        res.status(403).json({
          error:
            "Voor jeugdleden kan alleen een gekoppelde ouder of verzorger toestemming geven.",
        });
        return;
      }
      grantedByRelation = "self";
    } else {
      const parentOk = await isLinkedParent(clerkId, athleteClerkId);
      if (!parentOk) {
        res.status(403).json({ error: "Alleen een gekoppelde ouder kan dit voor deze sporter regelen." });
        return;
      }
      grantedByRelation = "parent";
    }

    const now = new Date();
    const [row] = await db
      .insert(clubConsentsTable)
      .values({
        clubId,
        athleteClerkId,
        scope,
        status: action === "grant" ? "granted" : "revoked",
        grantedByClerkId: clerkId,
        grantedByRelation,
        grantedAt: now,
        revokedAt: action === "revoke" ? now : null,
        revokedByClerkId: action === "revoke" ? clerkId : null,
      })
      .onConflictDoUpdate({
        target: [clubConsentsTable.clubId, clubConsentsTable.athleteClerkId, clubConsentsTable.scope],
        set:
          action === "grant"
            ? {
                status: "granted",
                grantedByClerkId: clerkId,
                grantedByRelation,
                grantedAt: now,
                revokedAt: null,
                revokedByClerkId: null,
                updatedAt: now,
              }
            : { status: "revoked", revokedAt: now, revokedByClerkId: clerkId, updatedAt: now },
      })
      .returning();
    await writeClubAudit({
      clubId,
      actorClerkId: clerkId,
      action: action === "grant" ? "consent_gegeven" : "consent_ingetrokken",
      targetType: "consent",
      targetId: athleteClerkId,
      detail: { relatie: grantedByRelation, scope },
    });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "club consent failed");
    res.status(500).json({ error: "Toestemming verwerken is niet gelukt." });
  }
});

// ── Trainer: toegewezen sporters + samenvattingen (consent-gated) ─────────────

router.get("/:clubId/trainer/athletes", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canViewConsentedData(ctx)) {
      res.status(403).json({ error: "Alleen trainers hebben deze weergave." });
      return;
    }
    const ids = await assignedAthleteIds(ctx.club.id, ctx.membership.clerkId);
    const names = await profilesByIds(ids);
    const result = [];
    for (const id of ids) {
      const scopes = await grantedConsentScopes(ctx.club.id, id);
      result.push({
        clerkId: id,
        displayName: names.get(id)?.displayName ?? null,
        consent: scopes.includes("training_summary"),
        consentScopes: scopes,
      });
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "club trainer athletes failed");
    res.status(500).json({ error: "Sporters ophalen is niet gelukt." });
  }
});

router.get("/:clubId/trainer/athletes/:athleteId/summary", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canViewConsentedData(ctx)) {
      res.status(403).json({ error: "Alleen trainers hebben deze weergave." });
      return;
    }
    const athleteId = String(req.params["athleteId"]);
    const ids = await assignedAthleteIds(ctx.club.id, ctx.membership.clerkId);
    if (!ids.includes(athleteId)) {
      res.status(403).json({ error: "Deze sporter is niet aan jou toegewezen." });
      return;
    }
    if (!(await hasClubConsent(ctx.club.id, athleteId))) {
      res.status(403).json({
        error:
          "Er is geen toestemming om trainingsgegevens van deze sporter te delen. Vraag de sporter (of bij jeugd: de ouder) om toestemming in de club.",
      });
      return;
    }
    const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sessions = await db
      .select({
        sessionDate: trainingSessionsTable.sessionDate,
        durationMin: trainingSessionsTable.durationMin,
        distanceKm: trainingSessionsTable.distanceKm,
        tss: trainingSessionsTable.tss,
      })
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, athleteId),
          gte(trainingSessionsTable.sessionDate, since),
        ),
      )
      .orderBy(desc(trainingSessionsTable.sessionDate));
    const totalMin = sessions.reduce((s, r) => s + (r.durationMin ?? 0), 0);
    const totalKm = sessions.reduce((s, r) => s + (r.distanceKm ? Number(r.distanceKm) : 0), 0);
    // Transparantie: inzage in sportdata wordt altijd vastgelegd.
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "sportdata_ingezien",
      targetType: "member",
      targetId: athleteId,
      detail: { scope: "training_summary" },
    });
    const consentScopes = await grantedConsentScopes(ctx.club.id, athleteId);
    res.json({
      periodDays: 28,
      sessionCount: sessions.length,
      totalDurationMin: totalMin,
      totalDistanceKm: Math.round(totalKm * 10) / 10,
      lastSessionDate: sessions[0]?.sessionDate ?? null,
      consentScopes,
    });
  } catch (err) {
    req.log.error({ err }, "club trainer summary failed");
    res.status(500).json({ error: "Samenvatting ophalen is niet gelukt." });
  }
});

// ── Export & audit (beheer) ───────────────────────────────────────────────────

router.get("/:clubId/export", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de clubbeheerder kan exporteren." });
      return;
    }
    // Administratieve export — bewust ZONDER sportdata.
    const [members, teams, groups, trainings, races] = await Promise.all([
      db.select().from(clubMembersTable).where(eq(clubMembersTable.clubId, ctx.club.id)),
      db.select().from(clubTeamsTable).where(eq(clubTeamsTable.clubId, ctx.club.id)),
      db.select().from(clubGroupsTable).where(eq(clubGroupsTable.clubId, ctx.club.id)),
      db.select().from(clubTrainingsTable).where(eq(clubTrainingsTable.clubId, ctx.club.id)),
      db.select().from(clubRaceEventsTable).where(eq(clubRaceEventsTable.clubId, ctx.club.id)),
    ]);
    const names = await profilesByIds(members.map((m) => m.clerkId));
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "export_gemaakt", targetType: "club", targetId: ctx.club.id });
    res.json({
      exportedAt: new Date().toISOString(),
      club: ctx.club,
      members: members.map((m) => ({
        ...m,
        displayName: names.get(m.clerkId)?.displayName ?? null,
        email: names.get(m.clerkId)?.email ?? null,
      })),
      teams,
      groups,
      trainings,
      races,
    });
  } catch (err) {
    req.log.error({ err }, "club export failed");
    res.status(500).json({ error: "Export maken is niet gelukt." });
  }
});

router.get("/:clubId/audit", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de clubbeheerder ziet de logboek-weergave." });
      return;
    }
    const rows = await db
      .select()
      .from(clubAuditLogTable)
      .where(eq(clubAuditLogTable.clubId, ctx.club.id))
      .orderBy(desc(clubAuditLogTable.createdAt))
      .limit(200);
    const names = await profilesByIds(rows.map((r) => r.actorClerkId));
    res.json(rows.map((r) => ({ ...r, actorName: names.get(r.actorClerkId)?.displayName ?? null })));
  } catch (err) {
    req.log.error({ err }, "club audit failed");
    res.status(500).json({ error: "Logboek ophalen is niet gelukt." });
  }
});

export default router;
