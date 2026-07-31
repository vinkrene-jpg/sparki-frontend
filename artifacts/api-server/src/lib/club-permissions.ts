import { and, eq, isNull, inArray, or, gte } from "drizzle-orm";
import {
  db,
  clubsTable,
  clubMembersTable,
  clubSubscriptionsTable,
  clubTrainerAssignmentsTable,
  clubTeamsTable,
  clubGroupsTable,
  clubTeamMembersTable,
  clubGroupMembersTable,
  clubConsentsTable,
  clubAuditLogTable,
  parentAthleteLinksTable,
  athleteProfilesTable,
  type Club,
  type ClubMember,
  type ClubSubscription,
  type ClubRole,
} from "@workspace/db";
import { computeAge } from "./age";

// ── Least-privilege rechtenlaag voor de clubomgeving ─────────────────────────
// Elke club-API resolvet eerst het ACTIEVE lidmaatschap (endedAt IS NULL) en
// toetst daarna de benodigde bevoegdheid. Geen lidmaatschap = geen toegang.
// Clubbeheerders krijgen NOOIT sportdata; trainers alleen toegewezen sporters
// mét geldige consent.

export type ClubContext = {
  club: Club;
  membership: ClubMember;
  subscription: ClubSubscription | null;
};

export async function getClubContext(
  clubId: number,
  clerkId: string,
): Promise<ClubContext | null> {
  const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId));
  if (!club) return null;
  const [membership] = await db
    .select()
    .from(clubMembersTable)
    .where(
      and(
        eq(clubMembersTable.clubId, clubId),
        eq(clubMembersTable.clerkId, clerkId),
        isNull(clubMembersTable.endedAt),
      ),
    );
  if (!membership) return null;
  const [subscription] = await db
    .select()
    .from(clubSubscriptionsTable)
    .where(eq(clubSubscriptionsTable.clubId, clubId));
  return { club, membership, subscription: subscription ?? null };
}

export function hasClubRole(ctx: ClubContext, roles: ClubRole[]): boolean {
  return roles.includes(ctx.membership.role as ClubRole);
}

// Trainerachtige rollen: mogen trainingen zien vanuit trainersperspectief.
// hoofdtrainer = trainer + trainer-toewijzingen beheren; assistent helpt bij
// aanwezigheid maar krijgt NOOIT consent-gated sportdata.
export const TRAINER_LIKE_ROLES: ClubRole[] = ["hoofdtrainer", "trainer", "assistent"];
// Rollen die tegen de trainerslimiet van het pakket tellen.
export const TRAINER_COUNT_ROLES: ClubRole[] = ["hoofdtrainer", "trainer", "assistent"];
// Strikt alleen-lezen rollen: geen berichten plaatsen, geen mutaties.
export const READ_ONLY_ROLES: ClubRole[] = ["vrijwilliger", "alleen_lezen"];

// Beheerrechten (clubprofiel, uitnodigingen, teams/groepen, export, audit).
export function canManageClub(ctx: ClubContext): boolean {
  return hasClubRole(ctx, ["owner", "admin"]);
}

// Trainingen/wedstrijden aanmaken en aanwezigheid registreren.
export function canManageTrainings(ctx: ClubContext): boolean {
  return canManageClub(ctx) || hasClubRole(ctx, ["hoofdtrainer", "trainer", "teammanager"]);
}

// Aanwezigheid registreren mag ook een assistent.
export function canRecordAttendance(ctx: ClubContext): boolean {
  return canManageTrainings(ctx) || hasClubRole(ctx, ["assistent"]);
}

// Trainer-toewijzingen beheren: beheer én hoofdtrainer.
export function canManageTrainerAssignments(ctx: ClubContext): boolean {
  return canManageClub(ctx) || hasClubRole(ctx, ["hoofdtrainer"]);
}

// Materiaalvelden (materiaalafspraken op trainingen/wedstrijden) bijwerken.
export function canEditMaterial(ctx: ClubContext): boolean {
  return canManageTrainings(ctx) || hasClubRole(ctx, ["mechanieker"]);
}

// Berichten plaatsen: iedereen behalve strikt alleen-lezen rollen.
export function canPostMessages(ctx: ClubContext): boolean {
  return !hasClubRole(ctx, READ_ONLY_ROLES);
}

// Consent-gated sportdata inzien: alleen echte trainers (assistent NIET).
export function canViewConsentedData(ctx: ClubContext): boolean {
  return hasClubRole(ctx, ["hoofdtrainer", "trainer"]);
}

// Clubstatus-bewaking: beperkt/geschorst/beeindigd blokkeert nieuwe
// toevoegingen; geschorst/beeindigd blokkeert álle mutaties behalve door
// eigenaar/beheer (die moeten kunnen opruimen/heractiveren). Data blijft staan.
export function clubStatusAllowsMutation(
  ctx: ClubContext,
): { ok: true } | { ok: false; reason: string } {
  const status = (ctx.club as { status?: string }).status ?? "actief";
  if (status === "actief") return { ok: true };
  if (status === "beperkt") return { ok: true }; // alleen nieuwe leden/trainers geblokkeerd (capaciteitslaag)
  if (canManageClub(ctx)) return { ok: true };
  return {
    ok: false,
    reason:
      status === "geschorst"
        ? "De club is tijdelijk geschorst. Bekijken kan, wijzigen niet. Neem contact op met het clubbeheer."
        : "De club is beëindigd. Gegevens blijven leesbaar, maar wijzigen kan niet meer.",
  };
}

// ── Pakket & limieten ─────────────────────────────────────────────────────────
export const CLUB_PACKAGES: Record<
  string,
  { label: string; maxMembers: number; maxTrainers: number }
> = {
  proef: { label: "Proefperiode", maxMembers: 15, maxTrainers: 2 },
  start: { label: "Start", maxMembers: 30, maxTrainers: 4 },
  basis: { label: "Basis", maxMembers: 75, maxTrainers: 10 },
  groei: { label: "Groei", maxMembers: 200, maxTrainers: 25 },
  // TEAM_ABONNEMENT_01: Sparki Team-abonnement — maximaal 50 actieve leden
  // (per club configureerbaar via club_subscriptions.maxMembers).
  team: { label: "Sparki Team", maxMembers: 50, maxTrainers: 10 },
};

type DbExecutor = Pick<typeof db, "select" | "insert" | "update" | "execute">;

export async function countActive(clubId: number, dbx: DbExecutor = db): Promise<{
  members: number;
  trainers: number;
}> {
  const rows = await dbx
    .select({ role: clubMembersTable.role })
    .from(clubMembersTable)
    .where(and(eq(clubMembersTable.clubId, clubId), isNull(clubMembersTable.endedAt)));
  const trainers = rows.filter((r) =>
    TRAINER_COUNT_ROLES.includes(r.role as ClubRole),
  ).length;
  return { members: rows.length, trainers };
}

// Eerlijke blokkade: bij overschrijding of geblokkeerd abonnement mogen er geen
// nieuwe leden/trainers bij. Bestaande data blijft altijd volledig staan.
export async function checkCapacityForNew(
  ctx: ClubContext,
  kind: "member" | "trainer",
  dbx: DbExecutor = db,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const sub = ctx.subscription;
  if (!sub) return { ok: true };
  if (sub.status === "blocked" || sub.status === "ended") {
    return {
      ok: false,
      reason:
        "Het clubabonnement is geblokkeerd of beëindigd. Bestaande gegevens blijven bewaard, maar nieuwe leden of trainers toevoegen kan pas na heractivering.",
    };
  }
  if (sub.status === "trial" && sub.trialEndsAt && sub.trialEndsAt < new Date()) {
    return {
      ok: false,
      reason:
        "De proefperiode is afgelopen. Kies een pakket om nieuwe leden of trainers toe te voegen; bestaande gegevens blijven bewaard.",
    };
  }
  const counts = await countActive(ctx.club.id, dbx);
  if (kind === "trainer" && counts.trainers >= sub.maxTrainers) {
    return {
      ok: false,
      reason: `Het pakket staat maximaal ${sub.maxTrainers} trainers toe. Verhoog het pakket om meer trainers toe te voegen.`,
    };
  }
  if (counts.members >= sub.maxMembers) {
    return {
      ok: false,
      reason: `Het pakket staat maximaal ${sub.maxMembers} actieve leden toe. Verhoog het pakket om meer leden toe te voegen.`,
    };
  }
  return { ok: true };
}

// Capaciteitscheck zonder bestaand lidmaatschap (bv. bij het ACCEPTEREN van
// een clubuitnodiging: de accepteerder is nog geen lid). Zelfde regels als
// checkCapacityForNew, op basis van het club-abonnement.
export async function checkCapacityByClubId(
  clubId: number,
  kind: "member" | "trainer",
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId));
  if (!club) return { ok: false, reason: "Club niet gevonden." };
  const [subscription] = await db
    .select()
    .from(clubSubscriptionsTable)
    .where(eq(clubSubscriptionsTable.clubId, clubId));
  return checkCapacityForNew(
    { club, membership: null as unknown as ClubMember, subscription: subscription ?? null },
    kind,
  );
}

// WP-03: alleen toewijzingen zonder einddatum of met einddatum vandaag/later
// tellen mee — beëindiging werkt daarmee direct op ieder leesmoment.
export function activeAssignmentWindow() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
  return or(
    isNull(clubTrainerAssignmentsTable.endsOn),
    gte(clubTrainerAssignmentsTable.endsOn, today),
  );
}

// ── Trainer-toewijzing & consent ──────────────────────────────────────────────
// Sporters die een trainer mag zien = leden van de teams/groepen waaraan die
// trainer expliciet is toegewezen. Sportdata daarbovenop vereist consent.
export async function assignedAthleteIds(
  clubId: number,
  trainerClerkId: string,
): Promise<string[]> {
  const assignments = await db
    .select()
    .from(clubTrainerAssignmentsTable)
    .where(
      and(
        eq(clubTrainerAssignmentsTable.clubId, clubId),
        eq(clubTrainerAssignmentsTable.trainerClerkId, trainerClerkId),
        // WP-03: beëindigde toewijzing telt direct niet meer mee.
        activeAssignmentWindow(),
      ),
    );
  const teamIds = assignments.map((a) => a.teamId).filter((v): v is number => v != null);
  const groupIds = assignments.map((a) => a.groupId).filter((v): v is number => v != null);
  const ids = new Set<string>();
  // Defensieve club-join: alleen teams/groepen die écht van deze club zijn
  // tellen mee — nooit sporters uit een andere club zichtbaar maken.
  if (teamIds.length > 0) {
    const rows = await db
      .select({ clerkId: clubTeamMembersTable.clerkId })
      .from(clubTeamMembersTable)
      .innerJoin(clubTeamsTable, eq(clubTeamsTable.id, clubTeamMembersTable.teamId))
      .where(and(inArray(clubTeamMembersTable.teamId, teamIds), eq(clubTeamsTable.clubId, clubId)));
    for (const r of rows) ids.add(r.clerkId);
  }
  if (groupIds.length > 0) {
    const rows = await db
      .select({ clerkId: clubGroupMembersTable.clerkId })
      .from(clubGroupMembersTable)
      .innerJoin(clubGroupsTable, eq(clubGroupsTable.id, clubGroupMembersTable.groupId))
      .where(and(inArray(clubGroupMembersTable.groupId, groupIds), eq(clubGroupsTable.clubId, clubId)));
    for (const r of rows) ids.add(r.clerkId);
  }
  return [...ids];
}

export async function hasClubConsent(
  clubId: number,
  athleteClerkId: string,
  scope: string = "training_summary",
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(clubConsentsTable)
    .where(
      and(
        eq(clubConsentsTable.clubId, clubId),
        eq(clubConsentsTable.athleteClerkId, athleteClerkId),
        eq(clubConsentsTable.scope, scope),
        eq(clubConsentsTable.status, "granted"),
      ),
    );
  return !!row;
}

// Alle verleende consent-scopes van een sporter binnen een club.
export async function grantedConsentScopes(
  clubId: number,
  athleteClerkId: string,
): Promise<string[]> {
  const rows = await db
    .select({ scope: clubConsentsTable.scope })
    .from(clubConsentsTable)
    .where(
      and(
        eq(clubConsentsTable.clubId, clubId),
        eq(clubConsentsTable.athleteClerkId, athleteClerkId),
        eq(clubConsentsTable.status, "granted"),
      ),
    );
  return rows.map((r) => r.scope);
}

// Minderjarig (<16): consent mag ALLEEN door een gekoppelde ouder worden
// gegeven. Onbekende leeftijd telt fail-closed als minderjarig BINNEN de
// clubcontext (jeugdvereniging): zonder bekende leeftijd geen zelf-consent.
export async function isMinorForClub(athleteClerkId: string): Promise<boolean> {
  const [athlete] = await db
    .select({
      birthDate: athleteProfilesTable.birthDate,
      birthYear: athleteProfilesTable.birthYear,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, athleteClerkId));
  if (!athlete) return true; // fail-closed
  const age = computeAge(athlete.birthDate, athlete.birthYear);
  if (age == null) return true; // fail-closed
  return age < 16;
}

export async function isLinkedParent(
  parentClerkId: string,
  athleteClerkId: string,
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(parentAthleteLinksTable)
    .where(
      and(
        eq(parentAthleteLinksTable.parentClerkId, parentClerkId),
        eq(parentAthleteLinksTable.athleteClerkId, athleteClerkId),
        eq(parentAthleteLinksTable.status, "accepted"),
      ),
    );
  return !!row;
}

// ── Audit (append-only) ───────────────────────────────────────────────────────
export async function writeClubAudit(entry: {
  clubId: number;
  actorClerkId: string;
  action: string;
  targetType?: string;
  targetId?: string | number;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(clubAuditLogTable).values({
    clubId: entry.clubId,
    actorClerkId: entry.actorClerkId,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId != null ? String(entry.targetId) : null,
    detail: entry.detail ?? null,
  });
}
