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
  clubNoodinfoViewsTable,
  emergencyContactsTable,
  healthSafetyInfoTable,
  clubMessagesTable,
  clubMessageReadsTable,
  clubConsentsTable,
  clubSubscriptionsTable,
  clubAuditLogTable,
  clubSeasonsTable,
  clubLocationsTable,
  clubConsentScopes,
  userProfilesTable,
  athleteProfilesTable,
  plannedWorkoutsTable,
  trainingSessionsTable,
  invitationsTable,
  clubRoles,
  medicalSpecialties,
  clubSignupStatuses,
  clubImportBatchesTable,
  clubImportRowsTable,
  adminOpsLogTable,
  organisationStaffSlotsTable,
  organisationTypes,
  type ClubRole,
} from "@workspace/db";
import {
  ORGANOGRAM_TEMPLATES,
  getOrganogramTemplate,
} from "../lib/organogram-templates";
import { billingSubscriptionsTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { createNotification } from "../lib/notifications";
import {
  syncPersonalRaceForSelection,
  removePersonalRaceForSelection,
  propagateEventUpdate,
} from "../lib/club-race-sync";
import { isValidInterval } from "../lib/billing";
import { getStripeGateway, TIER_PRICING } from "../lib/billing/stripe-gateway";
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
  activeAssignmentWindow,
  TRAINER_LIKE_ROLES,
  TRAINER_COUNT_ROLES,
  canEditMaterial,
  canPostMessages,
  canViewConsentedData,
  clubStatusAllowsMutation,
  type ClubContext,
} from "../lib/club-permissions";
import { computeAge } from "../lib/age";
import { writeVogAudit } from "../lib/security/vog-audit";
import { securityAuditLogTable } from "@workspace/db";
import { isAdmin } from "../lib/flags";

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

// F6: is een trainingsgroep een JEUGDgroep? Fail-closed benadering die geen
// nieuw statusveld toevoegt: het niveau-label wijst op jeugd (bv. "jeugd",
// "U15", "welpen", "aspiranten"), OF er zit een minderjarig actief lid in de
// groep. Zo blokkeren we ook groepen die niet als "jeugd" gelabeld zijn maar
// wél minderjarigen bevatten.
function levelSuggestsYouth(level: string | null | undefined): boolean {
  if (!level) return false;
  const l = level.toLowerCase();
  return (
    /\bjeugd\b|welp|pupil|aspirant|junior|nieuweling|\bu\s?-?\d{1,2}\b/.test(l)
  );
}

async function groupIsYouth(groupId: number): Promise<boolean> {
  const [group] = await db
    .select({ level: clubGroupsTable.level })
    .from(clubGroupsTable)
    .where(eq(clubGroupsTable.id, groupId));
  if (levelSuggestsYouth(group?.level)) return true;
  const members = await db
    .select({ clerkId: clubGroupMembersTable.clerkId })
    .from(clubGroupMembersTable)
    .where(and(eq(clubGroupMembersTable.groupId, groupId), isNull(clubGroupMembersTable.endedAt)));
  for (const m of members) {
    if (await isMinorForClub(m.clerkId)) return true;
  }
  return false;
}

// F6: is een VOG-afgiftedatum ouder dan 3 jaar (⇒ waarschuwing, geen blokkade)?
const VOG_EXPIRY_MS = 3 * 365.25 * 24 * 3600 * 1000;
function vogIsExpired(issuedOn: string | null | undefined): boolean {
  if (!issuedOn) return false;
  return Date.now() - Date.parse(issuedOn) > VOG_EXPIRY_MS;
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

// TEAM_ONBOARDING_01: catalogus van organogram-kaarten. Statisch en
// server-side — kaarten bevatten uitsluitend bestaande rollen en rolplekken,
// nooit voorbeeldpersonen. Vóór de /:clubId-routes gedeclareerd.
router.get("/organogram-templates", requireAuth, (_req, res) => {
  res.json({ templates: ORGANOGRAM_TEMPLATES });
});

router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const name = str(req.body?.name);
  if (!name) {
    res.status(400).json({ error: "Geef de organisatie een naam." });
    return;
  }
  // TEAM_ONBOARDING_01: organisatietype op de bestaande container. Rauwe
  // invoer wordt EERST gevalideerd (nooit stil naar CLUB terugvallen bij een
  // onbekende waarde).
  const rawType = req.body?.organisationType;
  const organisationType =
    rawType === undefined || rawType === null ? "CLUB" : String(rawType);
  if (!organisationTypes.includes(organisationType as (typeof organisationTypes)[number])) {
    res.status(400).json({ error: "Onbekend organisatietype. Kies CLUB of TEAM." });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [club] = await tx
        .insert(clubsTable)
        .values({
          // CLUB_ONBOARDING_01: via de onboarding start een club als "concept"
          // (geen uitnodigingen, leden onzichtbaar) tot expliciete activatie.
          status: req.body?.concept === true ? "concept" : "actief",
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
          organisationType,
          // Beschrijvend subtype: een zelfstandig team is "ploeg".
          organisationKind: organisationType === "TEAM" ? "ploeg" : "club",
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
      // CLUB_ONBOARDING_01: een club in oprichting wordt UITSLUITEND actief via
      // POST /activate (die de voorwaarden controleert). Elke andere
      // statuswijziging vanuit concept is een omzeiling van die poort.
      if (ctx.club.status === "concept") {
        res.status(409).json({
          error: "Deze club is nog in oprichting. Activeer de club eerst via de onboarding; daarna kun je de status wijzigen.",
        });
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

// ── Sparki Team-abonnement (TEAM_ABONNEMENT_01) ───────────────────────────────
// Centrale facturatie: de clubeigenaar betaalt één Stripe-abonnement (tier
// TEAM) dat via webhook het clubabonnement van precies deze organisatie
// aanstuurt. Geen parallel systeem: capaciteit en status lopen door de
// bestaande club_subscriptions-laag.

function teamAppBaseUrl(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  return domain ? `https://${domain}` : "http://localhost:5000";
}

router.get("/:clubId/team-subscription", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de clubbeheerder ziet het Team-abonnement." });
      return;
    }
    const counts = await countActive(ctx.club.id);
    // Facturatiestatus alleen via de gekoppelde subscription (billingRef);
    // nooit "de nieuwste subscription van de eigenaar" aannemen.
    let billing: { status: string; interval: string; currentPeriodEnd: Date | null } | null =
      null;
    const ref = ctx.subscription?.billingRef ?? null;
    if (ctx.subscription?.packageKey === "team" && ref) {
      const [row] = await db
        .select()
        .from(billingSubscriptionsTable)
        .where(eq(billingSubscriptionsTable.stripeSubscriptionId, ref));
      if (row && row.tier === "TEAM") {
        billing = {
          status: row.status,
          interval: row.interval,
          currentPeriodEnd: row.currentPeriodEnd,
        };
      }
    }
    res.json({
      subscription: ctx.subscription,
      isTeam: ctx.subscription?.packageKey === "team",
      counts,
      pricing: {
        monthCents: TIER_PRICING.TEAM.month,
        yearCents: TIER_PRICING.TEAM.year,
      },
      billing,
      checkoutAvailable:
        hasClubRole(ctx, ["owner"]) && getStripeGateway().isConfigured(),
    });
  } catch (err) {
    req.log.error({ err }, "club team-subscription status failed");
    res.status(500).json({ error: "Team-abonnement ophalen is niet gelukt." });
  }
});

router.post("/:clubId/team-subscription/checkout", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    // Centrale facturatie is aan de eigenaar voorbehouden (server-side).
    if (!hasClubRole(ctx, ["owner"]) || ctx.club.ownerClerkId !== ctx.membership.clerkId) {
      res.status(403).json({ error: "Alleen de clubeigenaar kan het Team-abonnement afsluiten." });
      return;
    }
    const interval = req.body?.interval;
    if (!isValidInterval(interval)) {
      res.status(400).json({ error: "Ongeldig interval (month of year)." });
      return;
    }
    // Exclusiviteit: geen tweede checkout terwijl er al een levende
    // Team-koppeling voor deze club bestaat (voorkomt dubbele subscriptions).
    if (ctx.subscription?.packageKey === "team" && ctx.subscription.billingRef) {
      const [row] = await db
        .select()
        .from(billingSubscriptionsTable)
        .where(eq(billingSubscriptionsTable.stripeSubscriptionId, ctx.subscription.billingRef));
      if (row && (row.status === "active" || row.status === "grace")) {
        res.status(409).json({ error: "Deze club heeft al een actief Team-abonnement." });
        return;
      }
    }
    if (!getStripeGateway().isConfigured()) {
      res.status(503).json({
        error: "Stripe-testmodus is niet geconfigureerd (STRIPE_SECRET_KEY sk_test_… ontbreekt)",
      });
      return;
    }
    const base = teamAppBaseUrl();
    const session = await getStripeGateway().createCheckoutSession({
      clerkId: ctx.membership.clerkId,
      tier: "TEAM",
      interval,
      successUrl: `${base}/club/beheer?team_billing=success`,
      cancelUrl: `${base}/club/beheer?team_billing=cancel`,
      clubId: ctx.club.id,
    });
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "team_abonnement_checkout_gestart",
      targetType: "subscription",
      targetId: ctx.club.id,
      detail: { interval },
    });
    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "club team-subscription checkout failed");
    res.status(500).json({ error: "Team-checkout starten is niet gelukt." });
  }
});

// ── Leden ─────────────────────────────────────────────────────────────────────

router.get("/:clubId/members", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const manage = canManageClub(ctx);
    const isTrainer = hasClubRole(ctx, ["trainer"]);
    // Ploegleider = aparte rol met dezelfde team-scoped inzage als teammanager.
    const isTeamManager = hasClubRole(ctx, ["teammanager", "ploegleider"]);
    if (!manage && !isTrainer && !isTeamManager) {
      res.status(403).json({ error: "Geen inzage in de ledenlijst." });
      return;
    }
    // Concept: leden zijn voor niemand anders zichtbaar dan het clubbeheer.
    if (ctx.club.status === "concept" && !manage) {
      res.status(403).json({ error: "Deze club is nog in oprichting; de ledenlijst is nog niet zichtbaar." });
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
        // BB-11: afgeleide VOG-status voor beheer — "geldig", "verlopen"
        // (afgifte > 3 jaar geleden ⇒ waarschuwing) of "ontbreekt". Nooit
        // opgeslagen, altijd vers berekend.
        const vogStatus =
          !manage
            ? undefined
            : m.role === "alleen_lezen"
              ? null // gast: geen VOG van toepassing
              : m.vogIssuedOn == null
                ? "ontbreekt"
                : Date.now() - Date.parse(m.vogIssuedOn) > 3 * 365.25 * 24 * 3600 * 1000
                  ? "verlopen"
                  : "geldig";
        return {
          ...m,
          displayName: p?.displayName ?? null,
          email: manage ? p?.email ?? null : null,
          isYouth: manage ? (age != null ? age < 16 : null) : undefined,
          vogStatus,
        };
      }),
    );
  } catch (err) {
    req.log.error({ err }, "club members failed");
    res.status(500).json({ error: "Ledenlijst ophalen is niet gelukt." });
  }
});

// BB-11 (besluitenpatch 2026-08-01, versoepeld): VOG-registratie op een
// lidmaatschap. Alleen clubbeheer; alleen aanvinken-met-afgiftedatum (geen
// upload). Alleen zinvol voor structurele functies met jeugdcontact —
// gasten/alleen_lezen vallen erbuiten. Datum in de toekomst is ongeldig.
router.put("/:clubId/members/:memberId/vog", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen het clubbeheer kan een VOG registreren." });
      return;
    }
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
      res.status(404).json({ error: "Lid niet gevonden." });
      return;
    }
    if (target.role === "alleen_lezen") {
      res.status(400).json({ error: "Voor gasten wordt geen VOG geregistreerd." });
      return;
    }
    const issuedOn = str(req.body?.issuedOn);
    if (issuedOn === null && req.body?.issuedOn !== null) {
      res.status(400).json({ error: "Afgiftedatum ontbreekt (JJJJ-MM-DD) of stuur null om te wissen." });
      return;
    }
    if (issuedOn != null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(issuedOn) || Number.isNaN(Date.parse(issuedOn))) {
        res.status(400).json({ error: "Ongeldige afgiftedatum (JJJJ-MM-DD)." });
        return;
      }
      if (Date.parse(issuedOn) > Date.now()) {
        res.status(400).json({ error: "De afgiftedatum kan niet in de toekomst liggen." });
        return;
      }
    }
    // F6: geen echte wijziging als de afgiftedatum ongewijzigd blijft. Dan
    // ontstaat er GEEN auditrecord (één wijziging = precies één record).
    const oudeAfgiftedatum = target.vogIssuedOn ?? null;
    const nieuweAfgiftedatum = issuedOn ?? null;
    if (oudeAfgiftedatum === nieuweAfgiftedatum) {
      res.json(target);
      return;
    }
    const toelichting = str(req.body?.toelichting);
    // F6 (memory-les Sportpaspoort): de wijziging én het auditrecord staan in
    // DEZELFDE transactie. Faalt de audit, dan rolt de wijziging terug — geen
    // best-effort, geen fire-and-forget. Precies één auditrecord per wijziging.
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(clubMembersTable)
        .set(
          issuedOn == null
            ? { vogIssuedOn: null, vogRecordedAt: null, vogRecordedByClerkId: null, updatedAt: new Date() }
            : {
                vogIssuedOn: issuedOn,
                vogRecordedAt: new Date(),
                vogRecordedByClerkId: ctx.membership.clerkId,
                updatedAt: new Date(),
              },
        )
        .where(eq(clubMembersTable.id, memberId))
        .returning();
      await writeVogAudit(
        {
          event: issuedOn == null ? "vog_registratie_verwijderd" : "vog_registratie_gewijzigd",
          actorClerkId: ctx.membership.clerkId,
          subjectClerkId: target.clerkId,
          meta: {
            actorRol: ctx.membership.role,
            clubId: ctx.club.id,
            clubNaam: ctx.club.name,
            clubMemberId: memberId,
            oudeAfgiftedatum,
            nieuweAfgiftedatum,
            ...(toelichting != null ? { toelichting } : {}),
          },
        },
        tx,
      );
      return row;
    });
    // Naast het beveiligings-auditlog blijft ook het clubauditlog gevuld
    // (bestaand gedrag, niet afzwakken).
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: issuedOn == null ? "vog_gewist" : "vog_geregistreerd",
      targetType: "member",
      targetId: memberId,
      detail: { lid: target.clerkId, afgiftedatum: issuedOn },
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "club member vog failed");
    res.status(500).json({ error: "VOG registreren is niet gelukt." });
  }
});

// F6 — VOG-audithistorie van één persoon binnen deze club. Alleen clubbeheer
// (canManageClub) en platformbeheer (isAdmin) mogen dit lezen; onbevoegden
// krijgen 403, ook via een directe API-aanroep. Zelfde afscherming als elders
// waar security_audit_log wordt getoond (admin-only overzicht in admin.ts).
// Toont uitsluitend de VOG-gebeurtenissen (append-only, nooit het document).
router.get("/:clubId/members/:memberId/vog-audit", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const platform = isAdmin(ctx.membership.clerkId);
    if (!canManageClub(ctx) && !platform) {
      res.status(403).json({ error: "Alleen clubbeheer of platformbeheer mag de VOG-historie inzien." });
      return;
    }
    const memberId = intParam(req.params["memberId"]);
    if (memberId == null) {
      res.status(400).json({ error: "Ongeldig lid." });
      return;
    }
    const [target] = await db
      .select()
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.id, memberId), eq(clubMembersTable.clubId, ctx.club.id)));
    if (!target) {
      res.status(404).json({ error: "Lid niet gevonden." });
      return;
    }
    // Alleen de VOG-gebeurtenissen over dit subject binnen DEZE club. Filter op
    // clubId in meta zodat een persoon in meerdere clubs niet lekt.
    const rows = await db
      .select({
        id: securityAuditLogTable.id,
        at: securityAuditLogTable.at,
        event: securityAuditLogTable.event,
        actorClerkId: securityAuditLogTable.actorClerkId,
        subjectClerkId: securityAuditLogTable.subjectClerkId,
        meta: securityAuditLogTable.meta,
      })
      .from(securityAuditLogTable)
      .where(
        and(
          eq(securityAuditLogTable.subjectClerkId, target.clerkId),
          inArray(securityAuditLogTable.event, [
            "vog_registratie_gewijzigd",
            "vog_registratie_verwijderd",
            "vog_registratie_gemigreerd",
          ]),
          sql`(${securityAuditLogTable.meta} ->> 'clubId')::int = ${ctx.club.id}`,
        ),
      )
      .orderBy(desc(securityAuditLogTable.at));
    res.json({ memberId, subjectClerkId: target.clerkId, historie: rows });
  } catch (err) {
    req.log.error({ err }, "club member vog-audit failed");
    res.status(500).json({ error: "VOG-historie ophalen is niet gelukt." });
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
    // HERSTEL TEAM_ABONNEMENT_01: beschrijvend functietype, alleen voor
    // medical_staff, geeft geen rechten. Bij elke andere rol wordt het gewist.
    let medicalSpecialty: string | null = null;
    if (role === "medical_staff") {
      const raw = str(req.body?.medicalSpecialty);
      if (raw != null) {
        if (!medicalSpecialties.includes(raw as (typeof medicalSpecialties)[number])) {
          res.status(400).json({ error: "Onbekend functietype voor medische staf." });
          return;
        }
        medicalSpecialty = raw;
      } else {
        medicalSpecialty = target.role === "medical_staff" ? target.medicalSpecialty : null;
      }
    }
    const [updated] = await db
      .update(clubMembersTable)
      .set({ role, medicalSpecialty, updatedAt: new Date() })
      .where(eq(clubMembersTable.id, memberId))
      .returning();
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "rol_gewijzigd",
      targetType: "member",
      targetId: memberId,
      // WP-03: volledige rolwijzigings-audit — wie/oud/nieuw/reden. Nooit
      // gezondheids- of privé-inhoud in het logboek.
      detail: { lid: target.clerkId, van: target.role, naar: role, reden: str(req.body?.reason) ?? null },
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

// ── WP-03: Seizoenen ─────────────────────────────────────────────────────────
// Eén actieve seizoencontext per organisatie (partial unique in de DB).
// Afsluiten = status "afgesloten" + closedAt; nooit DELETE. Een afgesloten
// seizoen is read-only: eraan gekoppelde teams zijn niet meer te wijzigen.

// Unique-violation op "één actief seizoen" herkennen, ook als drizzle de
// pg-fout wikkelt (message zit dan in err.cause).
function isOneActiveSeasonConflict(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; i < 4 && cur instanceof Error; i++) {
    if (/club_seasons_one_active_unique/.test(cur.message)) return true;
    cur = (cur as Error & { cause?: unknown }).cause;
  }
  return false;
}

async function seasonOfClub(clubId: number, seasonId: number) {
  const [s] = await db
    .select()
    .from(clubSeasonsTable)
    .where(and(eq(clubSeasonsTable.id, seasonId), eq(clubSeasonsTable.clubId, clubId)));
  return s ?? null;
}

router.get("/:clubId/seasons", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const seasons = await db
      .select()
      .from(clubSeasonsTable)
      .where(eq(clubSeasonsTable.clubId, ctx.club.id))
      .orderBy(desc(clubSeasonsTable.id));
    res.json(seasons);
  } catch (err) {
    req.log.error({ err }, "club seasons list failed");
    res.status(500).json({ error: "Seizoenen ophalen is niet gelukt." });
  }
});

router.post("/:clubId/seasons", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de clubbeheerder beheert seizoenen." });
      return;
    }
    const name = str(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "Geef het seizoen een naam (bv. 2026)." });
      return;
    }
    const status = str(req.body?.status) === "gepland" ? "gepland" : "actief";
    const startsOn = str(req.body?.startsOn);
    const endsOn = str(req.body?.endsOn);
    for (const d of [startsOn, endsOn]) {
      if (d != null && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        res.status(400).json({ error: "Gebruik datums als JJJJ-MM-DD." });
        return;
      }
    }
    try {
      const [season] = await db
        .insert(clubSeasonsTable)
        .values({
          clubId: ctx.club.id,
          name,
          status,
          startsOn,
          endsOn,
          createdByClerkId: ctx.membership.clerkId,
        })
        .returning();
      await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "seizoen_aangemaakt", targetType: "season", targetId: season!.id, detail: { name, status } });
      res.status(201).json(season);
    } catch (err) {
      if (isOneActiveSeasonConflict(err)) {
        res.status(409).json({ error: "Er is al een actief seizoen. Sluit dat eerst af, of maak dit seizoen aan als gepland." });
        return;
      }
      throw err;
    }
  } catch (err) {
    req.log.error({ err }, "club season create failed");
    res.status(500).json({ error: "Seizoen aanmaken is niet gelukt." });
  }
});

router.post("/:clubId/seasons/:seasonId/close", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de clubbeheerder beheert seizoenen." });
      return;
    }
    const seasonId = intParam(req.params["seasonId"]);
    const season = seasonId != null ? await seasonOfClub(ctx.club.id, seasonId) : null;
    if (!season) {
      res.status(404).json({ error: "Seizoen niet gevonden." });
      return;
    }
    if (season.status === "afgesloten") {
      res.status(409).json({ error: "Dit seizoen is al afgesloten." });
      return;
    }
    const [updated] = await db
      .update(clubSeasonsTable)
      .set({ status: "afgesloten", closedAt: new Date(), updatedAt: new Date() })
      .where(eq(clubSeasonsTable.id, season.id))
      .returning();
    // WP-03: afsluiten van een seizoen beëindigt de trainerstoewijzingen van
    // dat seizoen (endsOn = vandaag Amsterdam). Historie blijft staan — nooit
    // DELETE — maar actieve toegang via deze toewijzingen stopt direct.
    const todayAms = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
    const endedAssignments = await db
      .update(clubTrainerAssignmentsTable)
      .set({ endsOn: todayAms })
      .where(
        and(
          eq(clubTrainerAssignmentsTable.clubId, ctx.club.id),
          eq(clubTrainerAssignmentsTable.seasonId, season.id),
          isNull(clubTrainerAssignmentsTable.endsOn),
        ),
      )
      .returning({ id: clubTrainerAssignmentsTable.id });
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "seizoen_afgesloten", targetType: "season", targetId: season.id, detail: { name: season.name, beeindigdeToewijzingen: endedAssignments.length } });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "club season close failed");
    res.status(500).json({ error: "Seizoen afsluiten is niet gelukt." });
  }
});

// Gepland → actief (alleen als er nog geen actief seizoen is; afgesloten blijft afgesloten).
router.post("/:clubId/seasons/:seasonId/activate", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de clubbeheerder beheert seizoenen." });
      return;
    }
    const seasonId = intParam(req.params["seasonId"]);
    const season = seasonId != null ? await seasonOfClub(ctx.club.id, seasonId) : null;
    if (!season) {
      res.status(404).json({ error: "Seizoen niet gevonden." });
      return;
    }
    if (season.status !== "gepland") {
      res.status(409).json({ error: "Alleen een gepland seizoen kan actief worden. Een afgesloten seizoen blijft afgesloten." });
      return;
    }
    try {
      const [updated] = await db
        .update(clubSeasonsTable)
        .set({ status: "actief", updatedAt: new Date() })
        .where(eq(clubSeasonsTable.id, season.id))
        .returning();
      await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "seizoen_geactiveerd", targetType: "season", targetId: season.id, detail: { name: season.name } });
      res.json(updated);
    } catch (err) {
      if (isOneActiveSeasonConflict(err)) {
        res.status(409).json({ error: "Er is al een actief seizoen. Sluit dat eerst af." });
        return;
      }
      throw err;
    }
  } catch (err) {
    req.log.error({ err }, "club season activate failed");
    res.status(500).json({ error: "Seizoen activeren is niet gelukt." });
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
  // WP-03: selectie = team met parentTeamId (één niveau diep); seizoen optioneel.
  let parentTeamId: number | null = null;
  if (req.body?.parentTeamId != null) {
    parentTeamId = intParam(req.body.parentTeamId);
    const [parent] = parentTeamId != null
      ? await db.select().from(clubTeamsTable).where(and(eq(clubTeamsTable.id, parentTeamId), eq(clubTeamsTable.clubId, ctx.club.id)))
      : [];
    if (!parent) {
      res.status(400).json({ error: "Het hoofdteam hoort niet bij deze club." });
      return;
    }
    if (parent.parentTeamId != null) {
      res.status(400).json({ error: "Een selectie kan niet onder een andere selectie hangen." });
      return;
    }
  }
  let seasonId: number | null = null;
  if (req.body?.seasonId != null) {
    seasonId = intParam(req.body.seasonId);
    const season = seasonId != null ? await seasonOfClub(ctx.club.id, seasonId) : null;
    if (!season) {
      res.status(400).json({ error: "Dit seizoen hoort niet bij deze club." });
      return;
    }
    if (season.status === "afgesloten") {
      res.status(409).json({ error: "Dit seizoen is afgesloten en daarmee alleen-lezen." });
      return;
    }
  }
  const [team] = await db
    .insert(clubTeamsTable)
    .values({
      clubId: ctx.club.id,
      name,
      parentTeamId,
      seasonId,
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
    // WP-03: team gekoppeld aan een AFGESLOTEN seizoen is alleen-lezen.
    const [current] = await db
      .select()
      .from(clubTeamsTable)
      .where(and(eq(clubTeamsTable.id, teamId ?? -1), eq(clubTeamsTable.clubId, ctx.club.id)));
    if (!current) {
      res.status(404).json({ error: "Team niet gevonden." });
      return;
    }
    if (current.seasonId != null) {
      const season = await seasonOfClub(ctx.club.id, current.seasonId);
      if (season?.status === "afgesloten") {
        res.status(409).json({ error: "Dit team hoort bij een afgesloten seizoen en is alleen-lezen." });
        return;
      }
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of ["name", "description", "category", "level", "season", "trainingDays", "defaultLocation", "managerClerkId"] as const) {
      if (typeof req.body?.[key] === "string") patch[key] = req.body[key].trim() || null;
    }
    if (patch["name"] === null) delete patch["name"];
    if (req.body?.maxSize !== undefined) patch["maxSize"] = req.body.maxSize == null ? null : intParam(req.body.maxSize);
    if (req.body?.seasonId !== undefined) {
      const seasonId = req.body.seasonId == null ? null : intParam(req.body.seasonId);
      if (seasonId != null) {
        const season = await seasonOfClub(ctx.club.id, seasonId);
        if (!season) {
          res.status(400).json({ error: "Dit seizoen hoort niet bij deze club." });
          return;
        }
        if (season.status === "afgesloten") {
          res.status(409).json({ error: "Dit seizoen is afgesloten en daarmee alleen-lezen." });
          return;
        }
      }
      patch["seasonId"] = seasonId;
    }
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
        .where(and(eq(clubTrainerAssignmentsTable.clubId, clubId), activeAssignmentWindow())),
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
    // Bulk (géén N+1): alle team-/groepsleden van deze club in twee queries,
    // daarna per trainer in-memory de unieke sporters tellen.
    const clubTeamIds = teams.map((t) => t.id);
    const clubGroupIds = groups.map((g) => g.id);
    const [teamMembers, groupMembers] = await Promise.all([
      clubTeamIds.length > 0
        ? db
            .select({ teamId: clubTeamMembersTable.teamId, clerkId: clubTeamMembersTable.clerkId })
            .from(clubTeamMembersTable)
            .where(inArray(clubTeamMembersTable.teamId, clubTeamIds))
        : Promise.resolve([] as { teamId: number; clerkId: string }[]),
      clubGroupIds.length > 0
        ? db
            .select({ groupId: clubGroupMembersTable.groupId, clerkId: clubGroupMembersTable.clerkId })
            .from(clubGroupMembersTable)
            .where(inArray(clubGroupMembersTable.groupId, clubGroupIds))
        : Promise.resolve([] as { groupId: number; clerkId: string }[]),
    ]);
    const membersByTeam = new Map<number, string[]>();
    for (const r of teamMembers) {
      membersByTeam.set(r.teamId, [...(membersByTeam.get(r.teamId) ?? []), r.clerkId]);
    }
    const membersByGroup = new Map<number, string[]>();
    for (const r of groupMembers) {
      membersByGroup.set(r.groupId, [...(membersByGroup.get(r.groupId) ?? []), r.clerkId]);
    }
    const trainerRoles = new Set(TRAINER_COUNT_ROLES);
    const trainers = members
      .filter((m) => trainerRoles.has(m.role as (typeof TRAINER_COUNT_ROLES)[number]))
      .map((m) => {
        const mine = assignments.filter((a) => a.trainerClerkId === m.clerkId);
        const athleteIds = new Set<string>();
        for (const a of mine) {
          if (a.teamId != null) for (const id of membersByTeam.get(a.teamId) ?? []) athleteIds.add(id);
          if (a.groupId != null) for (const id of membersByGroup.get(a.groupId) ?? []) athleteIds.add(id);
        }
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
          assignedAthleteCount: athleteIds.size,
          trainingsLast30Days: trainingCount,
        };
      });
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
    // F6-gedrag (waarschuwing, geen blokkade): een VOG ouder dan 3 jaar mag de
    // toewijzing NIET tegenhouden — we melden het alleen.
    const vogWarnings: string[] = [];
    if (vogIsExpired(trainerCtx.membership.vogIssuedOn)) {
      vogWarnings.push(
        "Let op: de VOG-registratie van deze trainer is ouder dan 3 jaar. Vraag om een actuele VOG.",
      );
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
      // F6-gedrag (blokkade): een trainer ZONDER VOG-registratie mag niet aan
      // een jeugdgroep worden toegevoegd. Gasten (alleen_lezen) vallen erbuiten;
      // die kan sowieso geen trainer zijn. Eerlijke melding, geen stille afwijzing.
      if (
        trainerCtx.membership.vogIssuedOn == null &&
        (await groupIsYouth(groupId))
      ) {
        res.status(409).json({
          error:
            "Deze trainer heeft geen geregistreerde VOG en kan daarom niet aan een jeugdgroep worden toegewezen. Registreer eerst een VOG met afgiftedatum.",
        });
        return;
      }
    }
    const [row] = await db
      .insert(clubTrainerAssignmentsTable)
      .values({ clubId: ctx.club.id, trainerClerkId, teamId, groupId })
      .onConflictDoNothing()
      .returning();
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "trainer_toegewezen", targetType: "member", targetId: trainerClerkId, detail: { teamId, groupId } });
    res.status(201).json({ ...(row ?? { trainerClerkId, teamId, groupId }), ...(vogWarnings.length ? { waarschuwingen: vogWarnings } : {}) });
  } catch (err) {
    req.log.error({ err }, "club trainer assignment failed");
    res.status(500).json({ error: "Trainer toewijzen is niet gelukt." });
  }
});

// WP-03: trainer-toewijzing beëindigen — zet ends_on (historie blijft staan,
// nooit DELETE). Beëindiging telt direct op elk leesmoment (activeAssignmentWindow).
router.post("/:clubId/trainer-assignments/:assignmentId/end", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageTrainerAssignments(ctx)) {
      res.status(403).json({ error: "Alleen beheer of de hoofdtrainer beëindigt toewijzingen." });
      return;
    }
    const assignmentId = intParam(req.params["assignmentId"]);
    const [row] = await db
      .select()
      .from(clubTrainerAssignmentsTable)
      .where(
        and(
          eq(clubTrainerAssignmentsTable.id, assignmentId ?? -1),
          eq(clubTrainerAssignmentsTable.clubId, ctx.club.id),
        ),
      );
    if (!row) {
      res.status(404).json({ error: "Toewijzing niet gevonden." });
      return;
    }
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
    if (row.endsOn != null && row.endsOn < today) {
      res.status(409).json({ error: "Deze toewijzing was al beëindigd." });
      return;
    }
    // Einde per gisteren: vanaf nú telt de toewijzing niet meer mee.
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toLocaleDateString("en-CA", {
      timeZone: "Europe/Amsterdam",
    });
    const [updated] = await db
      .update(clubTrainerAssignmentsTable)
      .set({ endsOn: yesterday })
      .where(eq(clubTrainerAssignmentsTable.id, row.id))
      .returning();
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "trainer_toewijzing_beeindigd",
      targetType: "member",
      targetId: row.trainerClerkId,
      detail: { teamId: row.teamId, groupId: row.groupId, reden: str(req.body?.reason) ?? null },
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "club trainer assignment end failed");
    res.status(500).json({ error: "Toewijzing beëindigen is niet gelukt." });
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
  // HERSTEL TEAM_ABONNEMENT_01: ploegleider is een aparte rol met dezelfde
  // wedstrijdbeheerrechten als teammanager.
  return hasClubRole(ctx, ["owner", "admin", "teammanager", "ploegleider"]);
}

// BUILD_03 (besluitenpatch D): de geactiveerde vervanger mag op DEZE wedstrijd
// alles wat de ploegleider mag — nergens anders.
function canManageRaceEvent(
  ctx: ClubContext,
  event: { deputyClerkId: string | null } | null | undefined,
): boolean {
  if (canManageRaces(ctx)) return true;
  return event?.deputyClerkId != null && event.deputyClerkId === ctx.membership.clerkId;
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
    // BUILD_03 Noodinformatie: het vrije veld availabilityNote wordt
    // afgeschermd zodat medische redenen niet meelekken. Alleen het lid zelf
    // en de noodinfo-gerechtigden (ploegleider, teammanager, medical_staff,
    // beheer) zien de tekst; iedereen ziet wél de beschikbaarheidsstatus.
    const magNote =
      canManageClub(ctx) || hasClubRole(ctx, ["teammanager", "ploegleider", "medical_staff"]);
    // HERSTEL F5 (HA-24): mechanieker en soigneur zien van de bezetting alleen
    // naam, functie en óf de renner rijdt — geen notities, geen wie-besliste-
    // wat en geen overrule-spoor. Dit is een weergaveregel; rechten blijven
    // bij CLUB_RECHTEN_01.
    const beperkteWeergave =
      !canManageClub(ctx) && !hasClubRole(ctx, ["teammanager", "ploegleider", "hoofdtrainer", "trainer"]) &&
      hasClubRole(ctx, ["mechanieker", "soigneur"]);
    res.json(
      events.map((e) => ({
        ...e,
        selections: selections
          .filter((s) => s.eventId === e.id)
          .map((s) =>
            beperkteWeergave && s.clerkId !== ctx.membership.clerkId
              ? {
                  id: s.id,
                  eventId: s.eventId,
                  clerkId: s.clerkId,
                  role: s.role,
                  rijdt: s.role === "renner" && s.availability !== "niet_beschikbaar",
                  availability: s.availability,
                  availabilityNote: null,
                  displayName: names.get(s.clerkId)?.displayName ?? null,
                }
              : {
                  ...s,
                  availabilityNote:
                    magNote || s.clerkId === ctx.membership.clerkId ? s.availabilityNote : null,
                  displayName: names.get(s.clerkId)?.displayName ?? null,
                },
          ),
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
    const eventId = intParam(req.params["eventId"]);
    const [event] = await db
      .select()
      .from(clubRaceEventsTable)
      .where(and(eq(clubRaceEventsTable.id, eventId ?? -1), eq(clubRaceEventsTable.clubId, ctx.club.id)));
    if (!event) {
      res.status(404).json({ error: "Wedstrijd niet gevonden." });
      return;
    }
    // Mechanieker: mag ALLEEN de materiaalinformatie van een wedstrijd bijwerken.
    // De geactiveerde vervanger telt op deze wedstrijd als ploegleider.
    const raceFullEdit = canManageRaceEvent(ctx, event);
    const raceMaterialOnly = !raceFullEdit && canEditMaterial(ctx);
    if (!raceFullEdit && !raceMaterialOnly) {
      res.status(403).json({ error: "Alleen beheer of een teammanager kan clubwedstrijden beheren." });
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
    // BUILD_03: parcours koppelen is optioneel (routeId, expliciet null om te
    // ontkoppelen).
    if (!raceMaterialOnly && "routeId" in (req.body ?? {})) {
      patch["routeId"] = req.body.routeId == null ? null : intParam(String(req.body.routeId));
    }
    const [updated] = await db
      .update(clubRaceEventsTable)
      .set(patch)
      .where(eq(clubRaceEventsTable.id, event.id))
      .returning();
    // "Eén wedstrijd voor iedereen": wijzigingen werken door in de
    // gesynchroniseerde persoonlijke wedstrijden van de selectie.
    if (updated) await propagateEventUpdate(updated);
    await writeClubAudit({ clubId: ctx.club.id, actorClerkId: ctx.membership.clerkId, action: "wedstrijd_gewijzigd", targetType: "race", targetId: event.id });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "club race update failed");
    res.status(500).json({ error: "Wedstrijd wijzigen is niet gelukt." });
  }
});

// HERSTEL_EN_AANVULLING_01 F5 (HA-22…HA-25): wedstrijdbezetting kent naast
// renner/reserve/begeleider ook echte staffuncties. Seizoensbezetting
// (clubrol) is bewust NIET gelijk aan wedstrijdbezetting (deze rijen): een
// clublid met clubrol mechanieker rijdt alleen mee als hij hier per evenement
// is toegewezen. CLUB_RECHTEN_01 blijft eigenaar van rollen en rechten —
// dit is inhoud (wie gaat mee), geen tweede rechtenlaag.
export const WEDSTRIJD_BEZETTING_ROLLEN = [
  "renner",
  "reserve",
  "begeleider",
  "ploegleider",
  "mechanieker",
  "soigneur",
  "medical_staff",
  "chauffeur",
] as const;

// Selectie beheren (beheer/teammanager) — renners én staf per evenement.
router.post("/:clubId/races/:eventId/selection", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!clubWritableOr409(ctx, res)) return;
    const eventId = intParam(req.params["eventId"]);
    const clerkId = str(req.body?.clerkId);
    const role = str(req.body?.role) ?? "renner";
    if (eventId == null || !clerkId || !(WEDSTRIJD_BEZETTING_ROLLEN as readonly string[]).includes(role)) {
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
    if (!canManageRaceEvent(ctx, event)) {
      res.status(403).json({ error: "Alleen beheer of een teammanager beheert de selectie." });
      return;
    }
    const memberCtx = await getClubContext(ctx.club.id, clerkId);
    if (!memberCtx) {
      res.status(400).json({ error: "Deze persoon is geen actief clublid." });
      return;
    }

    // Besluitenpatch 2026-08-01 (hoofdstuk B): de teammanager staat bij
    // wedstrijden boven de ploegleider en mag diens selectiebesluit overrulen.
    // Een overrule is DEFINITIEF: de ploegleider kan hem niet terugdraaien
    // (beheer/owner/teammanager wél). Geldt uitsluitend hier, bij
    // wedstrijdselecties — nergens anders.
    const actorRole = ctx.membership.role;
    const [existing] = await db
      .select()
      .from(clubRaceSelectionsTable)
      .where(
        and(
          eq(clubRaceSelectionsTable.eventId, eventId),
          eq(clubRaceSelectionsTable.clerkId, clerkId),
        ),
      );
    if (
      existing?.overruledAt != null &&
      actorRole === "ploegleider" &&
      existing.role !== role
    ) {
      res.status(403).json({
        error:
          "Deze selectie is door de teammanager vastgezet en kan door de ploegleider niet worden teruggedraaid.",
      });
      return;
    }
    const isOverrule =
      actorRole === "teammanager" &&
      existing != null &&
      existing.selectedByRole === "ploegleider" &&
      existing.role !== role;

    const [row] = await db
      .insert(clubRaceSelectionsTable)
      .values({
        eventId,
        clerkId,
        role,
        selectedByClerkId: ctx.membership.clerkId,
        selectedByRole: actorRole,
      })
      .onConflictDoUpdate({
        target: [clubRaceSelectionsTable.eventId, clubRaceSelectionsTable.clerkId],
        set: {
          role,
          selectedByClerkId: ctx.membership.clerkId,
          selectedByRole: actorRole,
          ...(isOverrule
            ? { overruledAt: new Date(), overruledByClerkId: ctx.membership.clerkId }
            : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    if (isOverrule && existing.selectedByClerkId) {
      // Bericht mét diff aan de overrulede ploegleider — eerlijk en volledig.
      void createNotification({
        clerkId: existing.selectedByClerkId,
        type: "club_update",
        title: "Je selectiebesluit is door de teammanager gewijzigd",
        body: `Voor "${event.name}" (${event.raceDate}) is de rol van dit clublid gewijzigd van ${existing.role} naar ${role}. Dit besluit van de teammanager is definitief.`,
        athleteClerkId: clerkId,
        source: "club-races",
        dedupeKey: `selectie-overrule:${eventId}:${clerkId}:${existing.role}->${role}`,
      });
    }
    // BUILD_03: "één wedstrijd voor iedereen" — renner/reserve krijgt de
    // wedstrijd meteen in de eigen wedstrijdomgeving; begeleider niet.
    await syncPersonalRaceForSelection(event, clerkId, role);

    void createNotification({
      clerkId,
      type: "club_update",
      title: "Je bent geselecteerd",
      body: `Je staat als ${role} in de selectie voor "${event.name}" op ${event.raceDate}. Geef je beschikbaarheid door in de club.`,
      actionUrl: "/club",
    });
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: isOverrule ? "selectie_overruled" : "selectie_gewijzigd",
      targetType: "race",
      targetId: eventId,
      detail: {
        lid: clerkId,
        rol: role,
        ...(isOverrule
          ? { van: existing.role, ploegleider: existing.selectedByClerkId }
          : {}),
      },
    });
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "club race selection failed");
    res.status(500).json({ error: "Selectie wijzigen is niet gelukt." });
  }
});

// Selectie verwijderen (afmelding). De reserve schuift NIET automatisch door —
// de ploegleider doet dat zelf (besluitenpatch D, Conflicten).
router.delete("/:clubId/races/:eventId/selection/:memberId", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!clubWritableOr409(ctx, res)) return;
    const eventId = intParam(req.params["eventId"]);
    const memberId = str(req.params["memberId"]);
    if (eventId == null || !memberId) {
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
    if (!canManageRaceEvent(ctx, event)) {
      res.status(403).json({ error: "Alleen beheer, teammanager of ploegleider beheert de selectie." });
      return;
    }
    const [existing] = await db
      .select()
      .from(clubRaceSelectionsTable)
      .where(and(eq(clubRaceSelectionsTable.eventId, eventId), eq(clubRaceSelectionsTable.clerkId, memberId)));
    if (!existing) {
      res.status(404).json({ error: "Deze persoon staat niet in de selectie." });
      return;
    }
    if (existing.overruledAt != null && ctx.membership.role === "ploegleider") {
      res.status(403).json({
        error: "Deze selectie is door de teammanager vastgezet en kan door de ploegleider niet worden teruggedraaid.",
      });
      return;
    }
    await db
      .delete(clubRaceSelectionsTable)
      .where(eq(clubRaceSelectionsTable.id, existing.id));
    await removePersonalRaceForSelection(eventId, memberId);
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "selectie_verwijderd",
      targetType: "race",
      targetId: eventId,
      detail: { lid: memberId, rol: existing.role },
    });
    res.json({ removed: true });
  } catch (err) {
    req.log.error({ err }, "club race selection remove failed");
    res.status(500).json({ error: "Afmelden is niet gelukt." });
  }
});

// ── Noodinformatie (besluitenpatch D) ────────────────────────────────────────
// Zichtbaar voor ploegleider, teammanager en medical_staff (en beheer) —
// uitdrukkelijk NIET voor mechanieker en soigneur. Altijd zichtbaar, niet
// alleen rond de wedstrijddag. Elke inzage wordt gelogd; de sporter of ouder
// ziet wie er keek en wanneer.
function canViewNoodinfo(ctx: ClubContext): boolean {
  return canManageClub(ctx) || hasClubRole(ctx, ["teammanager", "ploegleider", "medical_staff"]);
}

router.get("/:clubId/members/:memberId/noodinfo", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canViewNoodinfo(ctx)) {
      res.status(403).json({
        error: "Noodinformatie is alleen zichtbaar voor ploegleider, teammanager en medische staf.",
      });
      return;
    }
    const memberId = str(req.params["memberId"]);
    if (!memberId) {
      res.status(400).json({ error: "Ongeldig lid." });
      return;
    }
    const memberCtx = await getClubContext(ctx.club.id, memberId);
    if (!memberCtx) {
      res.status(404).json({ error: "Dit lid is geen actief clublid." });
      return;
    }
    const contacts = await db
      .select()
      .from(emergencyContactsTable)
      .where(eq(emergencyContactsTable.athleteClerkId, memberId))
      .orderBy(asc(emergencyContactsTable.priority));
    const [safety] = await db
      .select({
        infoText: healthSafetyInfoTable.infoText,
        updatedAt: healthSafetyInfoTable.updatedAt,
      })
      .from(healthSafetyInfoTable)
      .where(eq(healthSafetyInfoTable.clerkId, memberId));
    // Inzage LOGGEN — voor alle drie de rollen, vóór het antwoord.
    await db.insert(clubNoodinfoViewsTable).values({
      clubId: ctx.club.id,
      memberClerkId: memberId,
      viewerClerkId: ctx.membership.clerkId,
      viewerRole: ctx.membership.role,
    });
    res.json({
      contacts,
      safetyInfo: safety ?? null,
      // Eerlijk: leeg is leeg — er wordt niets afgeleid of verzonnen.
    });
  } catch (err) {
    req.log.error({ err }, "club noodinfo failed");
    res.status(500).json({ error: "Noodinformatie ophalen is niet gelukt." });
  }
});

// Inzagelog: het lid zelf, of een gekoppelde ouder, ziet wie keek en wanneer.
router.get("/:clubId/members/:memberId/noodinfo-log", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const memberId = str(req.params["memberId"]);
    if (!memberId) {
      res.status(400).json({ error: "Ongeldig lid." });
      return;
    }
    const me = ctx.membership.clerkId;
    const allowed = me === memberId || (await isLinkedParent(me, memberId));
    if (!allowed) {
      res.status(403).json({ error: "Het inzagelog is alleen voor de sporter zelf of de ouder." });
      return;
    }
    const rows = await db
      .select()
      .from(clubNoodinfoViewsTable)
      .where(
        and(
          eq(clubNoodinfoViewsTable.clubId, ctx.club.id),
          eq(clubNoodinfoViewsTable.memberClerkId, memberId),
        ),
      )
      .orderBy(desc(clubNoodinfoViewsTable.createdAt));
    const names = await profilesByIds(rows.map((r) => r.viewerClerkId));
    res.json(
      rows.map((r) => ({
        viewerClerkId: r.viewerClerkId,
        viewerName: names.get(r.viewerClerkId)?.displayName ?? null,
        viewerRole: r.viewerRole,
        viewedAt: r.createdAt,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "club noodinfo log failed");
    res.status(500).json({ error: "Inzagelog ophalen is niet gelukt." });
  }
});

// ── Vervanger voor de ploegleider (besluitenpatch D — Structuur) ──────────────
// Handmatig geactiveerd door de teammanager, of door de ploegleider zelf als
// er geen teammanager is. De vervanger mag alles wat de ploegleider mag; de
// hele ploeg krijgt bericht. Terugkeer van de ploegleider (of afloop) wist het
// veld — er blijft bewust GEEN spoor achter dat er een vervanger was.
router.post("/:clubId/races/:eventId/deputy", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!clubWritableOr409(ctx, res)) return;
    const eventId = intParam(req.params["eventId"]);
    const [event] = await db
      .select()
      .from(clubRaceEventsTable)
      .where(and(eq(clubRaceEventsTable.id, eventId ?? -1), eq(clubRaceEventsTable.clubId, ctx.club.id)));
    if (!event) {
      res.status(404).json({ error: "Wedstrijd niet gevonden." });
      return;
    }
    const actorRole = ctx.membership.role;
    const isBeheer = canManageClub(ctx);
    const isTeammanager = actorRole === "teammanager" || isBeheer;
    if (!isTeammanager) {
      // Ploegleider mag alleen zelf activeren als de club géén actieve
      // teammanager heeft.
      if (actorRole !== "ploegleider") {
        res.status(403).json({ error: "Alleen de teammanager activeert een vervanger." });
        return;
      }
      const [tm] = await db
        .select({ id: clubMembersTable.id })
        .from(clubMembersTable)
        .where(
          and(
            eq(clubMembersTable.clubId, ctx.club.id),
            eq(clubMembersTable.role, "teammanager"),
            isNull(clubMembersTable.endedAt),
          ),
        );
      if (tm) {
        res.status(403).json({ error: "Er is een teammanager; alleen die activeert een vervanger." });
        return;
      }
    }
    const deputyClerkId = str(req.body?.deputyClerkId);
    if (deputyClerkId === null && req.body?.deputyClerkId !== null) {
      res.status(400).json({ error: "Geef de vervanger op, of null om te beëindigen." });
      return;
    }
    if (deputyClerkId) {
      const deputyCtx = await getClubContext(ctx.club.id, deputyClerkId);
      if (!deputyCtx) {
        res.status(400).json({ error: "De vervanger is geen actief clublid." });
        return;
      }
    }
    await db
      .update(clubRaceEventsTable)
      .set({ deputyClerkId: deputyClerkId ?? null, updatedAt: new Date() })
      .where(eq(clubRaceEventsTable.id, event.id));
    if (deputyClerkId) {
      // De hele ploeg (selectie) krijgt bericht.
      const selectie = await db
        .select({ clerkId: clubRaceSelectionsTable.clerkId })
        .from(clubRaceSelectionsTable)
        .where(eq(clubRaceSelectionsTable.eventId, event.id));
      const names = await profilesByIds([deputyClerkId]);
      const naam = names.get(deputyClerkId) ?? "een vervanger";
      for (const s of selectie) {
        void createNotification({
          clerkId: s.clerkId,
          type: "club_update",
          title: "Vervangende ploegleider",
          body: `Voor "${event.name}" (${event.raceDate}) neemt ${naam} de rol van ploegleider waar.`,
          actionUrl: "/club",
          source: "club-races",
          dedupeKey: `deputy:${event.id}:${deputyClerkId}:${s.clerkId}`,
        });
      }
    }
    // Bewust GEEN audit met de naam van de vervanger: na afloop mag niet meer
    // zichtbaar zijn dat er een vervanger is geweest (besluitenpatch D).
    res.json({ deputyClerkId: deputyClerkId ?? null });
  } catch (err) {
    req.log.error({ err }, "club race deputy failed");
    res.status(500).json({ error: "Vervanger instellen is niet gelukt." });
  }
});

// ── Conflictsignalering v1 (besluitenpatch D — Conflicten) ────────────────────
// Detecteert UITSLUITEND persoonsdubbeling en waarschuwt — blokkeert nooit:
// • dezelfde renner in twee wedstrijden op één dag
// • dezelfde ploegleider (begeleider) op twee wedstrijden op één dag
// Onbeschikbaarheid en onvolledige bezetting zijn bewust géén conflict (v1);
// autoplaats- en taaktijd-conflicten volgen zodra vervoer/taaktijden bestaan.
router.get("/:clubId/races/:eventId/conflicts", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const eventId = intParam(req.params["eventId"]);
    const [event] = await db
      .select()
      .from(clubRaceEventsTable)
      .where(and(eq(clubRaceEventsTable.id, eventId ?? -1), eq(clubRaceEventsTable.clubId, ctx.club.id)));
    if (!event) {
      res.status(404).json({ error: "Wedstrijd niet gevonden." });
      return;
    }
    // Alle andere wedstrijden van deze club op dezelfde dag.
    const sameDay = await db
      .select()
      .from(clubRaceEventsTable)
      .where(
        and(
          eq(clubRaceEventsTable.clubId, ctx.club.id),
          eq(clubRaceEventsTable.raceDate, event.raceDate),
        ),
      );
    const otherIds = sameDay.filter((e) => e.id !== event.id).map((e) => e.id);
    const warnings: { type: string; clerkId: string; message: string }[] = [];
    if (otherIds.length > 0) {
      const mySel = await db
        .select()
        .from(clubRaceSelectionsTable)
        .where(eq(clubRaceSelectionsTable.eventId, event.id));
      const otherSel = await db
        .select()
        .from(clubRaceSelectionsTable)
        .where(inArray(clubRaceSelectionsTable.eventId, otherIds));
      const names = await profilesByIds([...new Set([...mySel, ...otherSel].map((s) => s.clerkId))]);
      const byEvent = new Map(sameDay.map((e) => [e.id, e.name]));
      for (const s of mySel) {
        const dubbel = otherSel.filter((o) => o.clerkId === s.clerkId);
        for (const d of dubbel) {
          const naam = names.get(s.clerkId) ?? s.clerkId;
          warnings.push({
            type: s.role === "begeleider" || d.role === "begeleider" ? "dubbele_begeleider" : "dubbele_renner",
            clerkId: s.clerkId,
            message: `${naam} staat op ${event.raceDate} ook in de selectie van "${byEvent.get(d.eventId) ?? "een andere wedstrijd"}".`,
          });
        }
      }
    }
    res.json({ warnings });
  } catch (err) {
    req.log.error({ err }, "club race conflicts failed");
    res.status(500).json({ error: "Conflictcontrole is niet gelukt." });
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
          activeAssignmentWindow(),
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
          activeAssignmentWindow(),
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
        activeAssignmentWindow(),
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
    let grantedByRelation: "self" | "parent" | "club_namens_ouder";
    let grantedNote: string | null = null;
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
      if (parentOk) {
        grantedByRelation = "parent";
      } else if (req.body?.namensOuder === true) {
        // Besluitenpatch 2026-08-01 (hoofdstuk B): clubbeheer registreert een
        // BUITEN de app gegeven oudertoestemming — expliciet gescheiden pad,
        // alleen voor beheer, met verplichte vastlegging van wie en hoe.
        // Intrekken namens de ouder kan de club NIET: dat blijft bij ouder of
        // (volwassen) sporter zelf.
        const actorCtx = await getClubContext(clubId, clerkId);
        if (!actorCtx || !canManageClub(actorCtx)) {
          res.status(403).json({
            error: "Alleen clubbeheer kan een oudertoestemming namens de ouder registreren.",
          });
          return;
        }
        if (action !== "grant") {
          res.status(400).json({
            error: "Intrekken kan alleen de ouder of de sporter zelf, niet de club.",
          });
          return;
        }
        const ouderNaam = str(req.body?.ouderNaam);
        const wijze = str(req.body?.wijze); // bijv. "schriftelijk formulier d.d. …"
        if (!ouderNaam || !wijze) {
          res.status(400).json({
            error:
              "Registreren namens de ouder vereist de naam van de ouder én hoe de toestemming is gegeven.",
          });
          return;
        }
        grantedByRelation = "club_namens_ouder";
        grantedNote = `Ouder/verzorger: ${ouderNaam}; wijze: ${wijze}`;
      } else {
        res.status(403).json({ error: "Alleen een gekoppelde ouder kan dit voor deze sporter regelen." });
        return;
      }
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
        grantedNote,
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
                grantedNote,
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
      detail: {
        relatie: grantedByRelation,
        scope,
        ...(grantedNote ? { vastlegging: grantedNote } : {}),
      },
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

// WP-03: uitnodigingenoverzicht van een club — server-side, alleen beheer.
// (Het generieke /api/invitations toont alleen de eigen uitnodigingen van de
// aanvrager; een multi-admin club heeft een club-breed overzicht nodig.)
router.get("/:clubId/invitations", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de clubbeheerder ziet het uitnodigingenoverzicht." });
      return;
    }
    const rows = await db
      .select({
        id: invitationsTable.id,
        token: invitationsTable.token,
        relationship: invitationsTable.relationship,
        clubId: invitationsTable.clubId,
        email: invitationsTable.email,
        status: invitationsTable.status,
        expiresAt: invitationsTable.expiresAt,
        createdAt: invitationsTable.createdAt,
      })
      .from(invitationsTable)
      .where(eq(invitationsTable.clubId, ctx.club.id))
      .orderBy(desc(invitationsTable.createdAt))
      .limit(100);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "club invitations list failed");
    res.status(500).json({ error: "Uitnodigingen ophalen is niet gelukt." });
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

// ── CLUB_ONBOARDING_01: van registratie tot actief ───────────────────────────
// Een club in "concept" is in oprichting: elke stap wordt server-side bewaard
// (hervatbaar), er vertrekt geen uitnodiging en leden zijn niet zichtbaar voor
// anderen. Activatie is één server-side handeling die de voorwaarden
// controleert en eerlijk weigert met een lijst van wat ontbreekt.

// Bewaartermijn importrijen (persoonsgegevens). Besluitpunt — configureerbaar.
function importRetentionDays(): number {
  const n = Number(process.env["SPARKI_IMPORT_RETENTION_DAYS"]);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 365) : 30;
}

// Opportunistische opschoning: verlopen batches verliezen hun rijen
// (persoonsgegevens weg), de batch zelf blijft als telling/auditspoor.
async function purgeExpiredImportRows(clubId: number): Promise<void> {
  const expired = await db
    .select({ id: clubImportBatchesTable.id })
    .from(clubImportBatchesTable)
    .where(
      and(
        eq(clubImportBatchesTable.clubId, clubId),
        sql`${clubImportBatchesTable.purgeAfter} < now()`,
      ),
    );
  const ids = expired.map((b) => b.id);
  if (ids.length === 0) return;
  await db.delete(clubImportRowsTable).where(inArray(clubImportRowsTable.batchId, ids));
  await db
    .update(clubImportBatchesTable)
    .set({ status: "verlopen", updatedAt: new Date() })
    .where(
      and(
        inArray(clubImportBatchesTable.id, ids),
        eq(clubImportBatchesTable.status, "wacht_op_bevestiging"),
      ),
    );
}

async function writeAdminOpsLog(entry: {
  action: string;
  actorClerkId: string;
  newState?: Record<string, unknown>;
  reason?: string | null;
}): Promise<void> {
  // Fire-and-forget: audit mag een geslaagde handeling nooit blokkeren.
  try {
    await db.insert(adminOpsLogTable).values({
      action: entry.action,
      actorClerkId: entry.actorClerkId,
      previousState: null,
      newState: entry.newState ?? null,
      reason: entry.reason ?? null,
      actorIp: null,
    });
  } catch {
    // Bewust stil: de handeling zelf is geslaagd; het clubauditlog heeft de
    // gebeurtenis al vastgelegd.
  }
}

// Activatievoorwaarden — één plek, gebruikt door checklist én activatie.
async function onboardingMissing(clubId: number) {
  const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId));
  if (!club) return { club: null, missing: ["club"] as string[], teams: 0, seasons: 0 };
  const teams = await db
    .select({ id: clubTeamsTable.id })
    .from(clubTeamsTable)
    .where(eq(clubTeamsTable.clubId, clubId));
  const seasons = await db
    .select({ id: clubSeasonsTable.id })
    .from(clubSeasonsTable)
    .where(eq(clubSeasonsTable.clubId, clubId));
  const owner = await db
    .select({ id: clubMembersTable.id })
    .from(clubMembersTable)
    .where(
      and(
        eq(clubMembersTable.clubId, clubId),
        eq(clubMembersTable.role, "owner"),
        isNull(clubMembersTable.endedAt),
      ),
    );
  const missing: string[] = [];
  if (!club.name?.trim()) missing.push("Een clubnaam");
  if (!club.contactEmail?.trim() && !club.contactPhone?.trim())
    missing.push("Contactgegevens (e-mailadres of telefoonnummer)");
  if (owner.length === 0) missing.push("Een eigenaar");
  if (teams.length === 0) missing.push("Minstens één team");
  return { club, missing, teams: teams.length, seasons: seasons.length };
}

// Onboardingtoestand — hervatbaar: alles komt uit wat al echt is opgeslagen.
router.get("/:clubId/onboarding", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de eigenaar of clubbeheerder mag de onboarding uitvoeren." });
      return;
    }
    const { club, missing, teams, seasons } = await onboardingMissing(ctx.club.id);
    if (!club) {
      res.status(404).json({ error: "Club niet gevonden." });
      return;
    }
    const admins = await db
      .select({ id: clubMembersTable.id, role: clubMembersTable.role })
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, club.id), isNull(clubMembersTable.endedAt)));
    // TEAM_ONBOARDING_01: stafplekken tellen mee in de hervatbare toestand.
    const stafSlots = await db
      .select({ id: organisationStaffSlotsTable.id })
      .from(organisationStaffSlotsTable)
      .where(eq(organisationStaffSlotsTable.clubId, club.id));
    res.json({
      status: club.status,
      organisationType: club.organisationType,
      missing,
      steps: {
        profiel: Boolean(club.name?.trim()),
        contact: Boolean(club.contactEmail?.trim() || club.contactPhone?.trim()),
        logo: Boolean(club.logoUrl),
        seizoen: seasons > 0,
        organogram: Boolean(club.organogramTemplate),
        stafplekken: stafSlots.length,
        teams,
        beheerders: admins.filter((m) => ["owner", "admin"].includes(m.role)).length,
        trainers: admins.filter((m) => ["hoofdtrainer", "trainer"].includes(m.role)).length,
        leden: admins.length,
      },
      klaarVoorActivatie: missing.length === 0,
    });
  } catch (err) {
    req.log.error({ err }, "club onboarding state failed");
    res.status(500).json({ error: "Onboardingtoestand ophalen is niet gelukt." });
  }
});

// Logo koppelen — eerlijke fout bij te groot of verkeerd type.
const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
router.post("/:clubId/logo", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de eigenaar of clubbeheerder mag het logo wijzigen." });
      return;
    }
    const logoUrl = str(req.body?.logoUrl);
    if (!logoUrl) {
      res.status(400).json({ error: "Geen logobestand ontvangen." });
      return;
    }
    // Server-side waarheid: het object moet echt bestaan, door de aanvrager
    // zelf zijn geüpload, en de OPGESLAGEN metadata (niet de clientclaim)
    // bepaalt type en grootte.
    const { ObjectStorageService } = await import("../lib/objectStorage");
    const { getObjectAclPolicy } = await import("../lib/objectAcl");
    let contentType = "";
    let size = 0;
    try {
      const storage = new ObjectStorageService();
      const file = await storage.getObjectEntityFile(logoUrl);
      const acl = await getObjectAclPolicy(file);
      if (acl && acl.owner !== ctx.membership.clerkId) {
        res.status(403).json({ error: "Dit bestand is niet door jou geüpload." });
        return;
      }
      const [metadata] = await file.getMetadata();
      contentType = String(metadata.contentType ?? "").toLowerCase().split(";")[0]!.trim();
      size = Number(metadata.size ?? 0);
    } catch {
      res.status(400).json({ error: "Het logobestand is niet gevonden. Upload het opnieuw." });
      return;
    }
    if (!LOGO_TYPES.includes(contentType)) {
      res.status(400).json({
        error: "Dit bestandstype kan niet als logo. Gebruik JPG, PNG, WebP of SVG.",
      });
      return;
    }
    if (!Number.isFinite(size) || size <= 0 || size > LOGO_MAX_BYTES) {
      res.status(400).json({
        error: "Het logobestand is te groot (maximaal 5 MB). Verklein het bestand en probeer opnieuw.",
      });
      return;
    }
    const [updated] = await db
      .update(clubsTable)
      .set({ logoUrl, updatedAt: new Date() })
      .where(eq(clubsTable.id, ctx.club.id))
      .returning();
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "clublogo_gewijzigd",
      targetType: "club",
      targetId: ctx.club.id,
    });
    res.json({ logoUrl: updated?.logoUrl ?? logoUrl });
  } catch (err) {
    req.log.error({ err }, "club logo failed");
    res.status(500).json({ error: "Logo opslaan is niet gelukt." });
  }
});

// Eerste beheerders/trainers in concept: direct toewijzen aan een BESTAAND
// account op geverifieerd e-mailadres. Bewust géén uitnodiging — in concept
// vertrekt er geen (productregel 2).
router.post("/:clubId/onboarding/managers", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de eigenaar of clubbeheerder mag rollen toewijzen." });
      return;
    }
    const email = str(req.body?.email)?.toLowerCase();
    const role = str(req.body?.role);
    // TEAM_ONBOARDING_01: bij een Team-organisatie wordt de VOLLEDIGE vaste
    // seizoensstaf in concept direct toegewezen (teammanager en ploegleider
    // blijven aparte rollen; medical_staff met beschrijvend functietype).
    const allowed =
      ctx.club.organisationType === "TEAM"
        ? [
            "admin",
            "hoofdtrainer",
            "trainer",
            "teammanager",
            "ploegleider",
            "mechanieker",
            "soigneur",
            "medical_staff",
          ]
        : ["admin", "hoofdtrainer", "trainer"];
    if (!email || !role || !allowed.includes(role)) {
      res.status(400).json({ error: "Geef een e-mailadres en een geldige stafrol." });
      return;
    }
    // Functietype: alleen bij medical_staff, en alleen uit de vaste lijst.
    const medicalSpecialty = str(req.body?.medicalSpecialty);
    if (medicalSpecialty && role !== "medical_staff") {
      res.status(400).json({ error: "Een functietype hoort alleen bij medische staf." });
      return;
    }
    if (
      role === "medical_staff" &&
      medicalSpecialty &&
      !medicalSpecialties.includes(medicalSpecialty as (typeof medicalSpecialties)[number])
    ) {
      res.status(400).json({ error: "Onbekend functietype voor medische staf." });
      return;
    }
    const [profile] = await db
      .select({ clerkId: userProfilesTable.clerkId })
      .from(userProfilesTable)
      .where(sql`lower(${userProfilesTable.email}) = ${email}`);
    if (!profile) {
      res.status(404).json({
        error: "Er bestaat nog geen account met dit e-mailadres. Uitnodigen kan zodra de club actief is.",
      });
      return;
    }
    const existing = await getClubContext(ctx.club.id, profile.clerkId);
    if (existing) {
      res.status(409).json({ error: "Dit account is al lid van de club." });
      return;
    }
    // Capaciteit: trainersrollen tellen als trainer, overige staf als lid.
    const cap = await checkCapacityForNew(
      ctx,
      ["hoofdtrainer", "trainer"].includes(role) ? "trainer" : "member",
    );
    if (!cap.ok) {
      res.status(409).json({ error: cap.reason });
      return;
    }
    await db.insert(clubMembersTable).values({
      clubId: ctx.club.id,
      clerkId: profile.clerkId,
      role,
      medicalSpecialty: role === "medical_staff" ? medicalSpecialty : null,
    });
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "onboarding_rol_toegewezen",
      targetType: "member",
      detail: { role },
    });
    res.status(201).json({ toegevoegd: true, role });
  } catch (err) {
    req.log.error({ err }, "club onboarding manager failed");
    res.status(500).json({ error: "Rol toewijzen is niet gelukt." });
  }
});

// Ledenimport stap 1: rijen aanleveren → batch "wacht_op_bevestiging".
// Er wordt hier NOOIT iets toegevoegd (productregel 6).
router.post("/:clubId/import", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de eigenaar of clubbeheerder mag leden importeren." });
      return;
    }
    await purgeExpiredImportRows(ctx.club.id);
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!rows || rows.length === 0) {
      res.status(400).json({ error: "Het bestand bevat geen rijen om te importeren." });
      return;
    }
    if (rows.length > 2000) {
      res.status(400).json({ error: "Maximaal 2000 rijen per import." });
      return;
    }
    // Bestaande ACTIEVE leden op e-mailadres (dubbel = geverifieerd
    // e-mailadres, nooit naam — productregel 7).
    const activeMembers = await db
      .select({ clerkId: clubMembersTable.clerkId, email: userProfilesTable.email })
      .from(clubMembersTable)
      .innerJoin(userProfilesTable, eq(userProfilesTable.clerkId, clubMembersTable.clerkId))
      .where(and(eq(clubMembersTable.clubId, ctx.club.id), isNull(clubMembersTable.endedAt)));
    const memberEmails = new Set(activeMembers.map((m) => m.email.toLowerCase()));
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const seen = new Set<string>();
    const prepared: {
      rowNumber: number;
      email: string | null;
      name: string | null;
      role: string;
      status: string;
      message: string | null;
      matchedClerkId: string | null;
    }[] = [];
    const emails = rows
      .map((r: Record<string, unknown>) => (typeof r?.["email"] === "string" ? r["email"].trim().toLowerCase() : ""))
      .filter((e: string) => emailRe.test(e));
    const profiles = emails.length
      ? await db
          .select({ clerkId: userProfilesTable.clerkId, email: userProfilesTable.email })
          .from(userProfilesTable)
          .where(inArray(sql`lower(${userProfilesTable.email})`, emails))
      : [];
    const profileByEmail = new Map(profiles.map((p) => [p.email.toLowerCase(), p.clerkId]));
    rows.forEach((r: Record<string, unknown>, i: number) => {
      const email = typeof r?.["email"] === "string" ? r["email"].trim().toLowerCase() : "";
      const name = typeof r?.["name"] === "string" ? r["name"].trim() || null : null;
      const row = {
        rowNumber: i + 1,
        email: email || null,
        name,
        role: "member",
        status: "ongeldig",
        message: null as string | null,
        matchedClerkId: null as string | null,
      };
      if (!emailRe.test(email)) {
        row.message = "Geen geldig e-mailadres.";
      } else if (seen.has(email)) {
        row.status = "dubbel";
        row.message = "Dit e-mailadres staat al eerder in dit bestand.";
      } else if (memberEmails.has(email)) {
        row.status = "dubbel";
        row.message = "Dit e-mailadres hoort al bij een actief clublid.";
      } else {
        seen.add(email);
        const clerkId = profileByEmail.get(email);
        if (!clerkId) {
          row.status = "geen_account";
          row.message = "Nog geen account met dit e-mailadres — uitnodigen kan na activatie.";
        } else {
          row.status = "klaar";
          row.matchedClerkId = clerkId;
        }
      }
      prepared.push(row);
    });
    const okCount = prepared.filter((r) => r.status === "klaar").length;
    const purgeAfter = new Date(Date.now() + importRetentionDays() * 24 * 60 * 60 * 1000);
    const batch = await db.transaction(async (tx) => {
      const [b] = await tx
        .insert(clubImportBatchesTable)
        .values({
          clubId: ctx.club.id,
          createdByClerkId: ctx.membership.clerkId,
          fileName: str(req.body?.fileName),
          totalRows: prepared.length,
          purgeAfter,
        })
        .returning();
      await tx
        .insert(clubImportRowsTable)
        .values(prepared.map((r) => ({ ...r, batchId: b!.id })));
      return b!;
    });
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "ledenimport_klaargezet",
      targetType: "import",
      targetId: batch.id,
      detail: { totalRows: prepared.length, klaar: okCount },
    });
    const rowsOut = await db
      .select()
      .from(clubImportRowsTable)
      .where(eq(clubImportRowsTable.batchId, batch.id))
      .orderBy(asc(clubImportRowsTable.rowNumber));
    res.status(201).json({ batch, rows: rowsOut, klaar: okCount });
  } catch (err) {
    req.log.error({ err }, "club import failed");
    res.status(500).json({ error: "Import klaarzetten is niet gelukt." });
  }
});

// Ledenimport stap 2: expliciete bevestiging → één transactie, alles of niets.
router.post("/:clubId/import/:batchId/confirm", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de eigenaar of clubbeheerder mag een import bevestigen." });
      return;
    }
    const batchId = Number(req.params["batchId"]);
    const result = await db.transaction(async (tx) => {
      // Eén club-brede lock serialiseert confirm, cancel en capaciteitspaden;
      // de batchstatus wordt PAS na de lock gelezen en geclaimd, zodat een
      // tweede confirm (of een gelijktijdige cancel) eerlijk 409/404 krijgt.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(881100, ${ctx.club.id})`);
      const [batch] = await tx
        .select()
        .from(clubImportBatchesTable)
        .where(
          and(eq(clubImportBatchesTable.id, batchId), eq(clubImportBatchesTable.clubId, ctx.club.id)),
        );
      if (!batch) return { notFound: true } as const;
      if (batch.status !== "wacht_op_bevestiging") {
        return { error: `Deze import is al ${batch.status.replace(/_/g, " ")}.` } as const;
      }
      const rows = await tx
        .select()
        .from(clubImportRowsTable)
        .where(eq(clubImportRowsTable.batchId, batch.id));
      const ready = rows.filter((r) => r.status === "klaar" && r.matchedClerkId);
      // Capaciteit: hele import past of niets (alles-of-niets, eerlijk).
      const [subscription] = await tx
        .select()
        .from(clubSubscriptionsTable)
        .where(eq(clubSubscriptionsTable.clubId, ctx.club.id));
      const active = await tx
        .select({ id: clubMembersTable.id })
        .from(clubMembersTable)
        .where(and(eq(clubMembersTable.clubId, ctx.club.id), isNull(clubMembersTable.endedAt)));
      const maxMembers = subscription?.maxMembers ?? 0;
      if (subscription && active.length + ready.length > maxMembers) {
        return {
          error: `Deze import past niet binnen het ledenmaximum (${maxMembers}). Er is niets toegevoegd.`,
        } as const;
      }
      if (ready.length > 0) {
        await tx.insert(clubMembersTable).values(
          ready.map((r) => ({ clubId: ctx.club.id, clerkId: r.matchedClerkId!, role: "member" })),
        );
        await tx
          .update(clubImportRowsTable)
          .set({ status: "toegevoegd", message: null })
          .where(
            inArray(
              clubImportRowsTable.id,
              ready.map((r) => r.id),
            ),
          );
      }
      const failed = rows.length - ready.length;
      await tx
        .update(clubImportBatchesTable)
        .set({
          status: "bevestigd",
          okRows: ready.length,
          failedRows: failed,
          confirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(clubImportBatchesTable.id, batch.id));
      return { ok: ready.length, failed, batchId: batch.id } as const;
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "Importbatch niet gevonden." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "ledenimport_bevestigd",
      targetType: "import",
      targetId: result.batchId,
      detail: { toegevoegd: result.ok, nietVerwerkt: result.failed },
    });
    await writeAdminOpsLog({
      action: "club_ledenimport_bevestigd",
      actorClerkId: ctx.membership.clerkId,
      newState: { clubId: ctx.club.id, batchId: result.batchId, toegevoegd: result.ok, nietVerwerkt: result.failed },
    });
    res.json({ toegevoegd: result.ok, nietVerwerkt: result.failed });
  } catch (err) {
    req.log.error({ err }, "club import confirm failed");
    res.status(500).json({ error: "Import bevestigen is niet gelukt. Er is niets toegevoegd." });
  }
});

// Ledenimport annuleren — rijen (persoonsgegevens) meteen weg.
router.post("/:clubId/import/:batchId/cancel", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de eigenaar of clubbeheerder mag een import annuleren." });
      return;
    }
    const batchId = Number(req.params["batchId"]);
    // Zelfde club-lock als confirm: annuleren en bevestigen kunnen elkaar
    // nooit doorkruisen; de status wordt pas NA de lock gelezen.
    const cancelled = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(881100, ${ctx.club.id})`);
      const [batch] = await tx
        .select()
        .from(clubImportBatchesTable)
        .where(
          and(eq(clubImportBatchesTable.id, batchId), eq(clubImportBatchesTable.clubId, ctx.club.id)),
        );
      if (!batch || batch.status !== "wacht_op_bevestiging") return false;
      await tx.delete(clubImportRowsTable).where(eq(clubImportRowsTable.batchId, batch.id));
      await tx
        .update(clubImportBatchesTable)
        .set({ status: "geannuleerd", updatedAt: new Date() })
        .where(eq(clubImportBatchesTable.id, batch.id));
      return true;
    });
    if (!cancelled) {
      res.status(404).json({ error: "Geen openstaande importbatch gevonden." });
      return;
    }
    res.json({ geannuleerd: true });
  } catch (err) {
    req.log.error({ err }, "club import cancel failed");
    res.status(500).json({ error: "Import annuleren is niet gelukt." });
  }
});

// Activatie — één server-side handeling; weigert met wat ontbreekt.
// ── TEAM_ONBOARDING_01: organogram-kaart toepassen ───────────────────────────
// Maakt uitsluitend CONCEPTstructuur aan: ontbrekende selecties (club_teams)
// en ontbrekende stafplekken (organisation_staff_slots). Additief en
// idempotent — nooit destructief: bestaande selecties, personen en rollen
// blijven altijd staan, ook wanneer een kaart later opnieuw of anders wordt
// gekozen op een actieve organisatie. Er worden GEEN rechten afgeleid.
router.post("/:clubId/organogram", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de eigenaar of beheerder mag de structuur kiezen." });
      return;
    }
    if (ctx.club.organisationType !== "TEAM") {
      res.status(409).json({ error: "Organogram-kaarten zijn er alleen voor teamorganisaties." });
      return;
    }
    if (!["concept", "actief"].includes(ctx.club.status)) {
      res.status(409).json({ error: "Deze organisatie kan nu geen structuurwijziging ontvangen." });
      return;
    }
    const template = getOrganogramTemplate(String(req.body?.template ?? ""));
    if (!template) {
      res.status(400).json({ error: "Onbekende organogram-kaart." });
      return;
    }
    const result = await db.transaction(async (tx) => {
      // Concurrency-idempotentie: twee gelijktijdige toepassingen zouden anders
      // beide dezelfde bestaande toestand lezen en duplicaten aanvullen.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(881101, ${ctx.club.id})`);
      const bestaandeTeams = await tx
        .select({ id: clubTeamsTable.id, name: clubTeamsTable.name })
        .from(clubTeamsTable)
        .where(eq(clubTeamsTable.clubId, ctx.club.id));
      const bestaandeNamen = new Set(bestaandeTeams.map((t) => t.name.toLowerCase()));
      let selectiesToegevoegd = 0;
      for (const naam of template.selecties) {
        if (bestaandeNamen.has(naam.toLowerCase())) continue;
        await tx.insert(clubTeamsTable).values({
          clubId: ctx.club.id,
          name: naam,
          joinCode: generateJoinCode(),
        });
        selectiesToegevoegd += 1;
      }
      const bestaandeSlots = await tx
        .select({
          role: organisationStaffSlotsTable.role,
          medicalSpecialty: organisationStaffSlotsTable.medicalSpecialty,
        })
        .from(organisationStaffSlotsTable)
        .where(eq(organisationStaffSlotsTable.clubId, ctx.club.id));
      // Tellen per rol én (voor medische staf) per functietype: een bestaande
      // fysiotherapeut-plek vervult nooit een vereiste arts-plek.
      const slotKey = (role: string, specialty: string | null | undefined) =>
        role === "medical_staff" ? `${role}|${specialty ?? ""}` : role;
      const perRol = new Map<string, number>();
      for (const s of bestaandeSlots) {
        const k = slotKey(s.role, s.medicalSpecialty);
        perRol.set(k, (perRol.get(k) ?? 0) + 1);
      }
      let slotsToegevoegd = 0;
      for (const staf of template.staf) {
        const k = slotKey(staf.role, staf.medicalSpecialty);
        const huidige = perRol.get(k) ?? 0;
        for (let i = huidige; i < staf.aantal; i += 1) {
          await tx.insert(organisationStaffSlotsTable).values({
            clubId: ctx.club.id,
            role: staf.role,
            medicalSpecialty: staf.role === "medical_staff" ? (staf.medicalSpecialty ?? null) : null,
            createdByClerkId: ctx.membership.clerkId,
          });
          slotsToegevoegd += 1;
        }
        perRol.set(k, Math.max(huidige, staf.aantal));
      }
      await tx
        .update(clubsTable)
        .set({ organogramTemplate: template.key, updatedAt: new Date() })
        .where(eq(clubsTable.id, ctx.club.id));
      return { selectiesToegevoegd, slotsToegevoegd };
    });
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "organogram_kaart_toegepast",
      targetType: "club",
      targetId: ctx.club.id,
      detail: { template: template.key, ...result },
    });
    res.json({ template: template.key, ...result });
  } catch (err) {
    req.log.error({ err }, "organogram apply failed");
    res.status(500).json({ error: "Structuur toepassen is niet gelukt." });
  }
});

// ── TEAM_ONBOARDING_01: stafplekken (conceptstructuur, geen rechten) ─────────
router.get("/:clubId/staff-slots", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de eigenaar of beheerder ziet de stafplekken." });
      return;
    }
    const slots = await db
      .select()
      .from(organisationStaffSlotsTable)
      .where(eq(organisationStaffSlotsTable.clubId, ctx.club.id))
      .orderBy(asc(organisationStaffSlotsTable.id));
    // Vervulling wordt AFGELEID uit echte lidmaatschappen — namen verschijnen
    // uitsluitend via club_members (na toewijzing of geaccepteerde uitnodiging).
    const leden = await db
      .select({ role: clubMembersTable.role })
      .from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, ctx.club.id), isNull(clubMembersTable.endedAt)));
    const bezetPerRol = new Map<string, number>();
    for (const l of leden) bezetPerRol.set(l.role, (bezetPerRol.get(l.role) ?? 0) + 1);
    res.json({ slots, bezetting: Object.fromEntries(bezetPerRol) });
  } catch (err) {
    req.log.error({ err }, "staff slots list failed");
    res.status(500).json({ error: "Stafplekken ophalen is niet gelukt." });
  }
});

router.post("/:clubId/staff-slots", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de eigenaar of beheerder mag stafplekken toevoegen." });
      return;
    }
    if (ctx.club.organisationType !== "TEAM") {
      res.status(409).json({ error: "Stafplekken zijn er alleen voor teamorganisaties." });
      return;
    }
    const role = str(req.body?.role);
    if (!role || !clubRoles.includes(role as ClubRole)) {
      res.status(400).json({ error: "Onbekende rol voor deze stafplek." });
      return;
    }
    const medicalSpecialty = str(req.body?.medicalSpecialty);
    if (medicalSpecialty && role !== "medical_staff") {
      res.status(400).json({ error: "Een functietype hoort alleen bij medische staf." });
      return;
    }
    if (
      role === "medical_staff" &&
      medicalSpecialty &&
      !medicalSpecialties.includes(medicalSpecialty as (typeof medicalSpecialties)[number])
    ) {
      res.status(400).json({ error: "Onbekend functietype voor medische staf." });
      return;
    }
    const teamId = req.body?.teamId != null ? intParam(req.body.teamId) : null;
    if (teamId != null) {
      const [team] = await db
        .select({ id: clubTeamsTable.id })
        .from(clubTeamsTable)
        .where(and(eq(clubTeamsTable.id, teamId), eq(clubTeamsTable.clubId, ctx.club.id)));
      if (!team) {
        res.status(404).json({ error: "Deze selectie bestaat niet binnen de organisatie." });
        return;
      }
    }
    const [slot] = await db
      .insert(organisationStaffSlotsTable)
      .values({
        clubId: ctx.club.id,
        teamId,
        role,
        medicalSpecialty: role === "medical_staff" ? medicalSpecialty : null,
        label: str(req.body?.label),
        createdByClerkId: ctx.membership.clerkId,
      })
      .returning();
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "stafplek_toegevoegd",
      targetType: "club",
      targetId: slot!.id,
      detail: { role, medicalSpecialty, teamId },
    });
    res.status(201).json(slot);
  } catch (err) {
    req.log.error({ err }, "staff slot create failed");
    res.status(500).json({ error: "Stafplek toevoegen is niet gelukt." });
  }
});

// Een stafplek verwijderen raakt uitsluitend de plek — nooit een persoon,
// lidmaatschap of rol (bindende regel: personen verdwijnen nooit door een
// structuurwijziging).
router.delete("/:clubId/staff-slots/:slotId", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de eigenaar of beheerder mag stafplekken verwijderen." });
      return;
    }
    const slotId = intParam(req.params["slotId"]);
    const [removed] = await db
      .delete(organisationStaffSlotsTable)
      .where(
        and(
          eq(organisationStaffSlotsTable.id, slotId ?? -1),
          eq(organisationStaffSlotsTable.clubId, ctx.club.id),
        ),
      )
      .returning();
    if (!removed) {
      res.status(404).json({ error: "Deze stafplek bestaat niet (meer)." });
      return;
    }
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "stafplek_verwijderd",
      targetType: "club",
      targetId: removed.id,
      detail: { role: removed.role },
    });
    res.json({ verwijderd: true });
  } catch (err) {
    req.log.error({ err }, "staff slot delete failed");
    res.status(500).json({ error: "Stafplek verwijderen is niet gelukt." });
  }
});

// ── TEAM_ONBOARDING_01 addendum: rolgestuurde start ──────────────────────────
// Iedere rol landt op een eigen startblok met handelingsperspectief: óf één
// begrijpelijke eerste actie, óf een eerlijke lege toestand die vermeldt wat
// ontbreekt, waarom, wie het kan oplossen en de vervolgstap. Alles wordt
// AFGELEID uit werkelijke inrichting — nooit uit een verzonnen lijst.
const START_ROLE_LABELS: Record<string, string> = {
  owner: "Eigenaar",
  admin: "Beheerder",
  hoofdtrainer: "Hoofdtrainer",
  trainer: "Trainer",
  assistent: "Assistent-trainer",
  teammanager: "Teammanager",
  ploegleider: "Ploegleider",
  soigneur: "Soigneur",
  medical_staff: "Medische staf",
  mechanieker: "Mechanieker",
  vrijwilliger: "Vrijwilliger",
  alleen_lezen: "Gast",
  parent: "Ouder",
  member: "Sporter",
};

router.get("/:clubId/start", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    const role = ctx.membership.role;
    const isTeam = ctx.club.organisationType === "TEAM";
    const orgWoord = isTeam ? "team" : "club";
    const beheerWoord = isTeam ? "de teammanager" : "de clubbeheerder";
    const today = new Date().toISOString().slice(0, 10);

    const [teams, seizoenen, [training], [uitnodiging], eigenSelecties, [consentRij]] = await Promise.all([
      db
        .select({ id: clubTeamsTable.id, name: clubTeamsTable.name })
        .from(clubTeamsTable)
        .where(eq(clubTeamsTable.clubId, ctx.club.id)),
      db
        .select({ id: clubSeasonsTable.id })
        .from(clubSeasonsTable)
        .where(eq(clubSeasonsTable.clubId, ctx.club.id)),
      db
        .select({ id: clubTrainingsTable.id })
        .from(clubTrainingsTable)
        .where(and(eq(clubTrainingsTable.clubId, ctx.club.id), gte(clubTrainingsTable.trainingDate, today)))
        .limit(1),
      db
        .select({ id: invitationsTable.id })
        .from(invitationsTable)
        .where(and(eq(invitationsTable.clubId, ctx.club.id), eq(invitationsTable.status, "pending")))
        .limit(1),
      // Eigen actieve selectie-toewijzingen binnen deze organisatie — de
      // eerlijke basis voor "je bent (niet) toegewezen".
      db
        .select({ teamId: clubTeamMembersTable.teamId, naam: clubTeamsTable.name })
        .from(clubTeamMembersTable)
        .innerJoin(clubTeamsTable, eq(clubTeamsTable.id, clubTeamMembersTable.teamId))
        .where(
          and(
            eq(clubTeamsTable.clubId, ctx.club.id),
            eq(clubTeamMembersTable.clerkId, ctx.membership.clerkId),
            isNull(clubTeamMembersTable.endedAt),
          ),
        ),
      // Is er minstens één sporter die inzage-toestemming gaf (welke scope
      // dan ook)? Bepaalt de eerlijke medische starttoestand.
      db
        .select({ id: clubConsentsTable.id })
        .from(clubConsentsTable)
        .where(and(eq(clubConsentsTable.clubId, ctx.club.id), eq(clubConsentsTable.status, "granted")))
        .limit(1),
    ]);

    type EersteActie = { label: string; uitleg: string; doel: string };
    type LegeToestand = {
      soort: "nog_niet_ingericht" | "niet_toegewezen" | "geen_toestemming" | "geen_open_acties";
      watOntbreekt: string;
      waarom: string;
      wie: string;
      vervolgstap: string;
    };
    let werkgebied: string;
    let eersteActie: EersteActie | null = null;
    let legeToestand: LegeToestand | null = null;

    const beheerder = ["owner", "admin", "teammanager"].includes(role);
    if (beheerder) {
      werkgebied = `Inrichting en beheer van ${isTeam ? "de teamorganisatie" : "de club"}: structuur, staf, leden en uitnodigingen.`;
      if (ctx.club.status === "concept") {
        eersteActie = {
          label: "Rond de inrichting af",
          uitleg: `${isTeam ? "Het team" : "De club"} staat nog in oprichting — doorloop de resterende stappen en activeer daarna.`,
          doel: "onboarding",
        };
      } else if (seizoenen.length === 0) {
        eersteActie = {
          label: "Stel het seizoen in",
          uitleg: "Er is nog geen seizoen — zonder seizoen is er geen kader voor de vaste bezetting.",
          doel: "onboarding",
        };
      } else if (!uitnodiging && teams.length > 0) {
        eersteActie = {
          label: "Nodig je vaste bezetting uit",
          uitleg: "Er staat geen enkele uitnodiging open — nodig renners en staf uit voor de selecties.",
          doel: "leden",
        };
      } else {
        eersteActie = {
          label: "Bekijk de ledenstand",
          uitleg: "Controleer wie er al binnen is en welke plekken nog open staan.",
          doel: "leden",
        };
      }
    } else if (role === "ploegleider") {
      werkgebied = "Selecties en seizoensbezetting: wie hoort bij welke ploeg.";
      if (eigenSelecties.length > 0) {
        eersteActie = {
          label: eigenSelecties.length === 1 ? `Bekijk je selectie: ${eigenSelecties[0]!.naam}` : "Bekijk je selecties",
          uitleg: `Je bent toegewezen aan ${eigenSelecties.length === 1 ? "1 selectie" : `${eigenSelecties.length} selecties`} — bekijk de bezetting.`,
          doel: "teams",
        };
      } else if (teams.length > 0) {
        legeToestand = {
          soort: "niet_toegewezen",
          watOntbreekt: "Je bent nog aan geen enkele selectie toegewezen.",
          waarom: `Er ${teams.length === 1 ? "bestaat wel 1 selectie" : `bestaan wel ${teams.length} selecties`}, maar jij hoort er nog bij geen enkele.`,
          wie: beheerWoord,
          vervolgstap: `Vraag ${beheerWoord} om je aan een selectie toe te wijzen.`,
        };
      } else {
        legeToestand = {
          soort: "nog_niet_ingericht",
          watOntbreekt: "Er zijn nog geen selecties aangemaakt.",
          waarom: `De structuur van het ${orgWoord} is nog niet ingericht.`,
          wie: beheerWoord,
          vervolgstap: `Vraag ${beheerWoord} om selecties aan te maken (bijvoorbeeld via een organogram-kaart).`,
        };
      }
    } else if (["trainer", "hoofdtrainer", "assistent"].includes(role)) {
      werkgebied = "Trainingen: planning en begeleiding van de groep.";
      if (training) {
        eersteActie = {
          label: "Bekijk de geplande trainingen",
          uitleg: "Er staat minstens één training gepland — bekijk de kalender.",
          doel: "trainingen",
        };
      } else {
        legeToestand = {
          soort: "nog_niet_ingericht",
          watOntbreekt: "Er staat nog geen training gepland.",
          waarom: "De trainingskalender is nog leeg.",
          wie: role === "assistent" ? "de (hoofd)trainer of " + beheerWoord : `jij of ${beheerWoord}`,
          vervolgstap: role === "assistent" ? "Vraag de trainer wanneer de eerste training komt." : "Plan de eerste training in de kalender.",
        };
      }
    } else if (["mechanieker", "soigneur", "vrijwilliger"].includes(role)) {
      werkgebied =
        role === "mechanieker"
          ? "Materiaal: ondersteuning rond fietsen en onderhoud."
          : role === "soigneur"
            ? "Verzorging: ondersteuning van de renners rond trainingen en wedstrijden."
            : "Ondersteuning: kalender en berichten volgen.";
      if (eigenSelecties.length > 0) {
        eersteActie = {
          label: eigenSelecties.length === 1 ? `Bekijk je selectie: ${eigenSelecties[0]!.naam}` : "Bekijk je selecties",
          uitleg: "Je bent aan een selectie toegewezen — bekijk wie erbij horen en wat er gepland staat.",
          doel: "teams",
        };
      } else {
        legeToestand = {
          soort: "niet_toegewezen",
          watOntbreekt: "Je bent nog aan geen enkele selectie toegewezen.",
          waarom: `Het ${orgWoord} heeft je nog niet aan een selectie of moment gekoppeld.`,
          wie: beheerWoord,
          vervolgstap: `Vraag ${beheerWoord} om je aan een selectie toe te wijzen; tot die tijd zie je kalender en berichten.`,
        };
      }
    } else if (role === "medical_staff") {
      werkgebied = "Medische begeleiding — inzage in sportdata kan alleen na expliciete toestemming van de sporter.";
      if (consentRij) {
        eersteActie = {
          label: "Bekijk wie je inzage gaf",
          uitleg: "Minstens één sporter gaf toestemming voor inzage — bekijk de ledenlijst en de gedeelde gegevens.",
          doel: "leden",
        };
      } else {
        legeToestand = {
          soort: "geen_toestemming",
          watOntbreekt: "Je hebt nog van geen enkele sporter toestemming voor inzage.",
          waarom: "Gezondheids- en sportgegevens zijn pas zichtbaar nadat een sporter dat zelf toestaat.",
          wie: "de sporter zelf",
          vervolgstap: "Bespreek met de sporter of die je toestemming wil geven; zonder toestemming blijft je beeld beperkt tot kalender en berichten.",
        };
      }
    } else if (role === "alleen_lezen") {
      werkgebied = `Meekijken: je volgt het ${orgWoord} als gast, zonder acties.`;
      legeToestand = {
        soort: "geen_open_acties",
        watOntbreekt: "Er zijn geen acties voor je — en dat klopt.",
        waarom: "Een gast kijkt alleen mee en hoeft niets te doen.",
        wie: beheerWoord,
        vervolgstap: `Wil je meedoen, vraag dan ${beheerWoord} om een andere rol.`,
      };
    } else {
      // member (Sporter), parent en overige leesrollen.
      werkgebied =
        role === "parent"
          ? `Meekijken als ouder/verzorger binnen het ${orgWoord}.`
          : `Meedoen als sporter: trainingen, wedstrijden en berichten van het ${orgWoord}.`;
      if (training) {
        eersteActie = {
          label: "Bekijk de eerstvolgende training",
          uitleg: "Er staat een training gepland — kijk wanneer je verwacht wordt.",
          doel: "trainingen",
        };
      } else {
        legeToestand = {
          soort: "nog_niet_ingericht",
          watOntbreekt: "Er staat nog niets voor je gepland.",
          waarom: `Het ${orgWoord} heeft nog geen trainingen of activiteiten in de kalender gezet.`,
          wie: beheerWoord,
          vervolgstap: "Houd de berichten in de gaten; zodra er iets gepland staat, zie je het hier.",
        };
      }
    }

    res.json({
      role,
      rolLabel: START_ROLE_LABELS[role] ?? role,
      organisationType: ctx.club.organisationType,
      clubStatus: ctx.club.status,
      werkgebied,
      eersteActie,
      legeToestand,
      seizoenen: seizoenen.length,
      selecties: teams.length,
    });
  } catch (err) {
    req.log.error({ err }, "role start failed");
    res.status(500).json({ error: "Startoverzicht ophalen is niet gelukt." });
  }
});

router.post("/:clubId/activate", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxOr403(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen de eigenaar of clubbeheerder mag de club activeren." });
      return;
    }
    if (ctx.club.status === "actief") {
      res.json({ status: "actief", alActief: true });
      return;
    }
    if (ctx.club.status !== "concept") {
      res.status(409).json({ error: "Deze club is niet in oprichting en kan zo niet worden geactiveerd." });
      return;
    }
    const { missing } = await onboardingMissing(ctx.club.id);
    if (missing.length > 0) {
      res.status(422).json({
        error: "De club kan nog niet worden geactiveerd. Dit ontbreekt nog:",
        ontbreekt: missing,
      });
      return;
    }
    await db
      .update(clubsTable)
      .set({ status: "actief", updatedAt: new Date() })
      .where(and(eq(clubsTable.id, ctx.club.id), eq(clubsTable.status, "concept")));
    await writeClubAudit({
      clubId: ctx.club.id,
      actorClerkId: ctx.membership.clerkId,
      action: "club_geactiveerd",
      targetType: "club",
      targetId: ctx.club.id,
    });
    await writeAdminOpsLog({
      action: "club_geactiveerd",
      actorClerkId: ctx.membership.clerkId,
      newState: { clubId: ctx.club.id, naam: ctx.club.name },
    });
    await createNotification({
      clerkId: ctx.membership.clerkId,
      type: "club_update",
      source: "club-onboarding",
      title: "Je club is actief",
      body: `${ctx.club.name} is geactiveerd. Vanaf nu kun je leden uitnodigen.`,
    }).catch(() => undefined);
    res.json({ status: "actief" });
  } catch (err) {
    req.log.error({ err }, "club activate failed");
    res.status(500).json({ error: "Club activeren is niet gelukt." });
  }
});

export default router;
