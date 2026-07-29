import { and, eq, isNull, inArray, or, gte } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  userProfilesTable,
  clubMembersTable,
  clubTeamMembersTable,
  clubGroupMembersTable,
  clubTrainerAssignmentsTable,
  type AthleteDailyMetric,
} from "@workspace/db";
import { getEffectivePrivacy } from "./privacy";
import { computeAge } from "./age";

// Minderjarigen (<16): delen met een coach vereist ouderlijke toestemming.
// Zonder geaccepteerde toestemming valt het coach-deelniveau terug op "none",
// ongeacht wat er in de instellingen staat (fail-closed). Onbekende leeftijd
// telt NIET als minderjarig — we weigeren alleen op basis van echte data.
export async function isMinorAthlete(
  athleteClerkId: string,
): Promise<boolean> {
  const [athlete] = await db
    .select({
      birthDate: athleteProfilesTable.birthDate,
      birthYear: athleteProfilesTable.birthYear,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, athleteClerkId));
  if (!athlete) return false;
  const age = computeAge(athlete.birthDate, athlete.birthYear);
  return age != null && age < 16;
}

/**
 * A coarse, heuristic readiness read derived from the latest self-reported daily
 * metric. This is NOT a validated sports-science model — it is an honest summary
 * of the signals the athlete logged. `score` is null when there is no signal.
 */
export type Readiness = {
  label: "fresh" | "ok" | "tired" | "unknown";
  score: number | null;
  basis: string[];
};

export function computeReadiness(metric: AthleteDailyMetric | null): Readiness {
  if (!metric) return { label: "unknown", score: null, basis: [] };
  const basis: string[] = [];
  const parts: number[] = [];
  // feelScore / fatigueScore are 1–10 self-reports. Higher feel = better,
  // higher fatigue = worse. Sleep quality 1–10 contributes when present.
  if (metric.feelScore != null) {
    parts.push(clamp01(metric.feelScore / 10));
    basis.push("gevoel");
  }
  if (metric.fatigueScore != null) {
    parts.push(clamp01(1 - metric.fatigueScore / 10));
    basis.push("vermoeidheid");
  }
  if (metric.sleepQuality != null) {
    parts.push(clamp01(metric.sleepQuality / 10));
    basis.push("slaapkwaliteit");
  }
  if (parts.length === 0) return { label: "unknown", score: null, basis };
  const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
  const score = Math.round(avg * 100);
  const label = score >= 67 ? "fresh" : score >= 40 ? "ok" : "tired";
  return { label, score, basis };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export async function hasAcceptedCoachLink(
  coachClerkId: string,
  athleteClerkId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ status: coachAthleteLinksTable.status })
    .from(coachAthleteLinksTable)
    .where(
      and(
        eq(coachAthleteLinksTable.coachClerkId, coachClerkId),
        eq(coachAthleteLinksTable.athleteClerkId, athleteClerkId),
      ),
    );
  return row?.status === "accepted";
}

/**
 * Sporters die via een GELDIGE club/teamtoewijzing bij deze trainer horen.
 * Geldig betekent, op leesmoment gecontroleerd (nooit gecachet):
 *  - er bestaat een expliciete rij in club_trainer_assignments (team of groep);
 *  - de trainer is zelf nog ACTIEF clublid (ended_at IS NULL) van die club;
 *  - de sporter is ACTIEF lid van precies dat team of die groep;
 *  - de sporter is ook nog ACTIEF clublid van dezelfde club.
 * Einde lidmaatschap of toewijzing trekt toegang dus direct in.
 * Dit geeft alleen ZICHTBAARHEID in de werkruimte; wat de trainer vervolgens
 * mag zien blijft per sporter gegated door coachSharingLevel (fail-closed,
 * incl. jeugdregel).
 */
export async function clubAssignedAthleteIds(
  coachClerkId: string,
): Promise<string[]> {
  const assignments = await db
    .select({
      clubId: clubTrainerAssignmentsTable.clubId,
      teamId: clubTrainerAssignmentsTable.teamId,
      groupId: clubTrainerAssignmentsTable.groupId,
    })
    .from(clubTrainerAssignmentsTable)
    .innerJoin(
      clubMembersTable,
      and(
        eq(clubMembersTable.clubId, clubTrainerAssignmentsTable.clubId),
        eq(clubMembersTable.clerkId, clubTrainerAssignmentsTable.trainerClerkId),
        isNull(clubMembersTable.endedAt),
      ),
    )
    .where(
      and(
        eq(clubTrainerAssignmentsTable.trainerClerkId, coachClerkId),
        // WP-03: een beëindigde toewijzing (ends_on in het verleden) telt op
        // ELK leesmoment direct niet meer mee. Amsterdamse kalenderdag.
        or(
          isNull(clubTrainerAssignmentsTable.endsOn),
          gte(
            clubTrainerAssignmentsTable.endsOn,
            new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" }),
          ),
        ),
      ),
    );
  if (assignments.length === 0) return [];

  const out = new Set<string>();
  const teamIds = assignments.filter((a) => a.teamId != null).map((a) => a.teamId!);
  const groupIds = assignments.filter((a) => a.groupId != null).map((a) => a.groupId!);

  const perClub = new Map<number, Set<string>>();
  const addCandidate = (clubId: number, clerkId: string) => {
    if (!perClub.has(clubId)) perClub.set(clubId, new Set());
    perClub.get(clubId)!.add(clerkId);
  };

  if (teamIds.length > 0) {
    const rows = await db
      .select({ clerkId: clubTeamMembersTable.clerkId, teamId: clubTeamMembersTable.teamId })
      .from(clubTeamMembersTable)
      .where(and(inArray(clubTeamMembersTable.teamId, teamIds), isNull(clubTeamMembersTable.endedAt)));
    for (const r of rows) {
      const a = assignments.find((x) => x.teamId === r.teamId);
      if (a) addCandidate(a.clubId, r.clerkId);
    }
  }
  if (groupIds.length > 0) {
    const rows = await db
      .select({ clerkId: clubGroupMembersTable.clerkId, groupId: clubGroupMembersTable.groupId })
      .from(clubGroupMembersTable)
      .where(and(inArray(clubGroupMembersTable.groupId, groupIds), isNull(clubGroupMembersTable.endedAt)));
    for (const r of rows) {
      const a = assignments.find((x) => x.groupId === r.groupId);
      if (a) addCandidate(a.clubId, r.clerkId);
    }
  }

  // Sporter moet óók nog actief clublid zijn van dezelfde club.
  for (const [clubId, candidates] of perClub) {
    const ids = [...candidates];
    if (ids.length === 0) continue;
    const active = await db
      .select({ clerkId: clubMembersTable.clerkId })
      .from(clubMembersTable)
      .where(
        and(
          eq(clubMembersTable.clubId, clubId),
          inArray(clubMembersTable.clerkId, ids),
          isNull(clubMembersTable.endedAt),
        ),
      );
    for (const r of active) {
      if (r.clerkId !== coachClerkId) out.add(r.clerkId);
    }
  }
  return [...out];
}

/**
 * Werkruimte-toegang van een trainer tot een sporter: directe geaccepteerde
 * coach-sporterkoppeling ÓF geldige club/teamtoewijzing. Elke read gaat door
 * deze check; client-side filtering is nooit de beveiliging. Deelniveaus
 * (coachSharingLevel) blijven daar bovenop onverkort gelden.
 */
export async function hasCoachAccess(
  coachClerkId: string,
  athleteClerkId: string,
): Promise<boolean> {
  if (await hasAcceptedCoachLink(coachClerkId, athleteClerkId)) return true;
  const assigned = await clubAssignedAthleteIds(coachClerkId);
  return assigned.includes(athleteClerkId);
}

/* ------------------------------------------------------------------ *
 * WP-01C — rechtendifferentiatie
 *
 * Twee relatievormen, elk met een eigen capability-set:
 *  - direct_coach_link      : geaccepteerde directe coach-sporterkoppeling
 *  - club_team_assignment   : geldige club-/teamtoewijzing (read-time checks)
 *
 * Individuele begeleiding (cockpit, individuele data, individueel plan,
 * individuele berichten, privénotities) vereist de DIRECTE koppeling.
 * Een club-/teamtoewijzing geeft alleen zichtbaarheid + team-/clubscope.
 * Deelniveaus (coachSharingLevel) blijven altijd als aparte laag gelden.
 * ------------------------------------------------------------------ */

export type TrainerRelation = {
  directLink: boolean;
  clubTeamAssignment: boolean;
};

export async function getTrainerRelation(
  coachClerkId: string,
  athleteClerkId: string,
): Promise<TrainerRelation> {
  const directLink = await hasAcceptedCoachLink(coachClerkId, athleteClerkId);
  // Toewijzing wordt óók bepaald als er al een directe link is: rosters en
  // rapportage willen beide relaties eerlijk kunnen tonen.
  const assigned = await clubAssignedAthleteIds(coachClerkId);
  return { directLink, clubTeamAssignment: assigned.includes(athleteClerkId) };
}

export type TrainerCapabilities = {
  /** Sporter mag in de werkruimte geïdentificeerd worden (roster). */
  hasAnyTrainerVisibility: boolean;
  /** Individuele coachdata lezen (cockpit, herstel/gezondheid binnen deelniveau). */
  canReadIndividualCoachData: boolean;
  /** Individuele training of planaanpassing voorstellen/adopteren. */
  canProposeIndividualTraining: boolean;
  /** Individuele berichten sturen/lezen. */
  canMessageIndividually: boolean;
  /** Transparante coachafspraken (coach_context_items) vastleggen. */
  canWriteCoachContext: boolean;
  /** Echte privénotities maken/lezen (alleen eigen notities). */
  canUsePrivateNotes: boolean;
  /** Team-/groepstraining voorstellen (clubcontext). */
  canProposeTeamTraining: boolean;
  /** Team-/clubcommunicatie gebruiken (club_messages-scopes). */
  canUseTeamCommunication: boolean;
};

/**
 * Pure rechtenmatrix — de ENIGE plek waar relatie → capability wordt vertaald.
 * Bewust een pure functie zodat de matrix los van de database testbaar is.
 */
export function trainerCapabilities(rel: TrainerRelation): TrainerCapabilities {
  const any = rel.directLink || rel.clubTeamAssignment;
  return {
    hasAnyTrainerVisibility: any,
    canReadIndividualCoachData: rel.directLink,
    canProposeIndividualTraining: rel.directLink,
    canMessageIndividually: rel.directLink,
    canWriteCoachContext: rel.directLink,
    canUsePrivateNotes: rel.directLink,
    canProposeTeamTraining: rel.clubTeamAssignment,
    canUseTeamCommunication: rel.clubTeamAssignment,
  };
}

/** Directe geaccepteerde coachkoppeling — vereist voor individuele begeleiding. */
export async function hasDirectCoachAccess(
  coachClerkId: string,
  athleteClerkId: string,
): Promise<boolean> {
  return hasAcceptedCoachLink(coachClerkId, athleteClerkId);
}

/** Geldige club-/teamtoewijzing (zonder uitspraak over directe link). */
export async function hasClubTeamTrainerAccess(
  coachClerkId: string,
  athleteClerkId: string,
): Promise<boolean> {
  const assigned = await clubAssignedAthleteIds(coachClerkId);
  return assigned.includes(athleteClerkId);
}

export async function hasAcceptedParentLink(
  parentClerkId: string,
  athleteClerkId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ status: parentAthleteLinksTable.status })
    .from(parentAthleteLinksTable)
    .where(
      and(
        eq(parentAthleteLinksTable.parentClerkId, parentClerkId),
        eq(parentAthleteLinksTable.athleteClerkId, athleteClerkId),
      ),
    );
  return row?.status === "accepted";
}

/**
 * Resolve the athlete's coach-sharing preference. For minors (<16) without
 * accepted parental consent this is forced to "none" (fail-closed).
 */
export async function coachSharingLevel(athleteClerkId: string) {
  const p = await getEffectivePrivacy(athleteClerkId);
  const level = p.dataSharingCoach as "none" | "summary" | "full";
  if (level === "none") return level;
  if (p.parentConsentStatus !== "accepted" && (await isMinorAthlete(athleteClerkId))) {
    return "none" as const;
  }
  return level;
}

/** Resolve the athlete's parent-sharing preference. */
export async function parentSharingLevel(athleteClerkId: string) {
  const p = await getEffectivePrivacy(athleteClerkId);
  return p.dataSharingParent as "none" | "safety_only" | "summary";
}

/** Parent consent status, used by the parent surface and consent placeholders. */
export async function getEffectiveParentConsent(athleteClerkId: string) {
  const p = await getEffectivePrivacy(athleteClerkId);
  return {
    parentConsentRequired: p.parentConsentRequired,
    parentConsentStatus: p.parentConsentStatus,
  };
}

export async function hasRole(clerkId: string, role: string): Promise<boolean> {
  const [row] = await db
    .select({ roles: userProfilesTable.roles })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));
  return !!row?.roles?.includes(role);
}
