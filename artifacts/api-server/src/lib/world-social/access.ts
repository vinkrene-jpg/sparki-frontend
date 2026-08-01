// Sparki World — toegangslaag. Dit is de ENIGE waarheid over wie een gedeeld
// item mag zien. Regels:
//   - Eigenaar ziet altijd zijn eigen items (ook verborgen: met status-label).
//   - Blokkade werkt onmiddellijk en in BEIDE richtingen.
//   - prive        → alleen eigenaar.
//   - coach_ouders → geaccepteerde coach- of ouderkoppeling.
//   - club         → gedeeld actief clublidmaatschap.
//   - team         → gedeeld actief team- of trainingsgroeplidmaatschap.
//   - volgers      → geaccepteerde vriendschaps-/volgkoppeling.
//   - openbaar     → iedereen, maar alléén als het item expliciet bevestigd is
//                    én de eigenaar openbaar MAG delen (volwassen, of
//                    minderjarig met geldige oudertoestemming). Fail-closed.
//   - Minderjarig of onbekende leeftijd ⇒ standaard privé; openbaar vereist
//     parentConsentStatus === "granted".

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  privacySettingsTable,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  friendLinksTable,
  clubMembersTable,
  clubTeamMembersTable,
  clubTeamsTable,
  clubGroupMembersTable,
  clubGroupsTable,
  worldBlocksTable,
  type WorldSharedItem,
  type WorldVisibility,
} from "@workspace/db";
import { computeAge } from "../age";

export interface OwnerShareStatus {
  isMinorOrUnknown: boolean;
  publicAllowed: boolean; // volwassen, of minderjarig met geldige oudertoestemming
}

/** Leeftijds- en toestemmingsstatus van een eigenaar (fail-closed). */
export async function getOwnerShareStatus(
  clerkId: string,
): Promise<OwnerShareStatus> {
  const [profile] = await db
    .select({
      birthDate: athleteProfilesTable.birthDate,
      birthYear: athleteProfilesTable.birthYear,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  const age = computeAge(profile?.birthDate ?? null, profile?.birthYear ?? null);
  const isMinorOrUnknown = age === null || age < 18;
  if (!isMinorOrUnknown) return { isMinorOrUnknown, publicAllowed: true };
  const [privacy] = await db
    .select({ parentConsentStatus: privacySettingsTable.parentConsentStatus })
    .from(privacySettingsTable)
    .where(eq(privacySettingsTable.clerkId, clerkId))
    .limit(1);
  return {
    isMinorOrUnknown,
    publicAllowed: privacy?.parentConsentStatus === "granted",
  };
}

/** Is er een blokkade tussen a en b, in welke richting dan ook? */
export async function isBlockedEitherWay(
  a: string,
  b: string,
): Promise<boolean> {
  if (a === b) return false;
  const rows = await db
    .select({ id: worldBlocksTable.id })
    .from(worldBlocksTable)
    .where(
      or(
        and(
          eq(worldBlocksTable.blockerClerkId, a),
          eq(worldBlocksTable.blockedClerkId, b),
        ),
        and(
          eq(worldBlocksTable.blockerClerkId, b),
          eq(worldBlocksTable.blockedClerkId, a),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Alle clerkIds waarmee de kijker een blokkade heeft (beide richtingen). */
export async function listBlockedIds(viewer: string): Promise<Set<string>> {
  const rows = await db
    .select({
      blocker: worldBlocksTable.blockerClerkId,
      blocked: worldBlocksTable.blockedClerkId,
    })
    .from(worldBlocksTable)
    .where(
      or(
        eq(worldBlocksTable.blockerClerkId, viewer),
        eq(worldBlocksTable.blockedClerkId, viewer),
      ),
    );
  const out = new Set<string>();
  for (const r of rows) out.add(r.blocker === viewer ? r.blocked : r.blocker);
  return out;
}

async function hasAcceptedCoachOrParentLink(
  viewer: string,
  owner: string,
): Promise<boolean> {
  const [coach] = await db
    .select({ x: coachAthleteLinksTable.coachClerkId })
    .from(coachAthleteLinksTable)
    .where(
      and(
        eq(coachAthleteLinksTable.coachClerkId, viewer),
        eq(coachAthleteLinksTable.athleteClerkId, owner),
        eq(coachAthleteLinksTable.status, "accepted"), isNull(coachAthleteLinksTable.endedAt),
      ),
    )
    .limit(1);
  if (coach) return true;
  const [parent] = await db
    .select({ x: parentAthleteLinksTable.parentClerkId })
    .from(parentAthleteLinksTable)
    .where(
      and(
        eq(parentAthleteLinksTable.parentClerkId, viewer),
        eq(parentAthleteLinksTable.athleteClerkId, owner),
        eq(parentAthleteLinksTable.status, "accepted"), isNull(parentAthleteLinksTable.endedAt),
      ),
    )
    .limit(1);
  return Boolean(parent);
}

async function areFriends(viewer: string, owner: string): Promise<boolean> {
  const [row] = await db
    .select({ id: friendLinksTable.id })
    .from(friendLinksTable)
    .where(
      and(
        eq(friendLinksTable.status, "accepted"), isNull(friendLinksTable.endedAt),
        or(
          and(
            eq(friendLinksTable.requesterClerkId, viewer),
            eq(friendLinksTable.addresseeClerkId, owner),
          ),
          and(
            eq(friendLinksTable.requesterClerkId, owner),
            eq(friendLinksTable.addresseeClerkId, viewer),
          ),
        ),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function activeClubIds(clerkId: string): Promise<number[]> {
  const rows = await db
    .select({ clubId: clubMembersTable.clubId })
    .from(clubMembersTable)
    .where(
      and(eq(clubMembersTable.clerkId, clerkId), isNull(clubMembersTable.endedAt)),
    );
  return rows.map((r) => r.clubId);
}

async function shareClub(viewer: string, owner: string): Promise<boolean> {
  const [a, b] = await Promise.all([activeClubIds(viewer), activeClubIds(owner)]);
  const set = new Set(a);
  return b.some((id) => set.has(id));
}

async function activeTeamAndGroupKeys(clerkId: string): Promise<Set<string>> {
  const [teams, groups] = await Promise.all([
    db
      .select({ teamId: clubTeamMembersTable.teamId })
      .from(clubTeamMembersTable)
      .where(
        and(
          eq(clubTeamMembersTable.clerkId, clerkId),
          isNull(clubTeamMembersTable.endedAt),
        ),
      ),
    db
      .select({ groupId: clubGroupMembersTable.groupId })
      .from(clubGroupMembersTable)
      .where(
        and(
          eq(clubGroupMembersTable.clerkId, clerkId),
          isNull(clubGroupMembersTable.endedAt),
        ),
      ),
  ]);
  const out = new Set<string>();
  for (const t of teams) out.add(`t${t.teamId}`);
  for (const g of groups) out.add(`g${g.groupId}`);
  return out;
}

async function shareTeamOrGroup(viewer: string, owner: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    activeTeamAndGroupKeys(viewer),
    activeTeamAndGroupKeys(owner),
  ]);
  for (const k of b) if (a.has(k)) return true;
  return false;
}

/**
 * Mag `viewer` dit gedeelde item zien? De eigenaar ziet eigen items altijd;
 * anderen alleen actieve items binnen de gekozen doelgroep en zonder blokkade.
 */
export async function viewerMaySeeItem(
  viewer: string,
  item: Pick<
    WorldSharedItem,
    "clerkId" | "visibility" | "status" | "publicConfirmedAt"
  >,
): Promise<boolean> {
  const owner = item.clerkId;
  if (viewer === owner) return true;
  if (item.status !== "actief") return false;
  if (await isBlockedEitherWay(viewer, owner)) return false;
  switch (item.visibility as WorldVisibility) {
    case "prive":
      return false;
    case "coach_ouders":
      return hasAcceptedCoachOrParentLink(viewer, owner);
    case "club":
      return shareClub(viewer, owner);
    case "team":
      return shareTeamOrGroup(viewer, owner);
    case "volgers":
      return areFriends(viewer, owner);
    case "openbaar": {
      if (!item.publicConfirmedAt) return false;
      const status = await getOwnerShareStatus(owner);
      return status.publicAllowed;
    }
    default:
      return false; // onbekende waarde ⇒ fail-closed
  }
}

/**
 * Verzamel alle eigenaren van wie de kijker via een relatie iets zou kunnen
 * zien — gebruikt om de feedquery te begrenzen (geen open einde).
 */
export async function relatedOwnerIds(viewer: string): Promise<{
  coachParentAthletes: string[];
  friends: string[];
  clubIds: number[];
  teamGroupKeys: Set<string>;
}> {
  const [coachRows, parentRows, friendRows, clubIds, teamGroupKeys] =
    await Promise.all([
      db
        .select({ athlete: coachAthleteLinksTable.athleteClerkId })
        .from(coachAthleteLinksTable)
        .where(
          and(
            eq(coachAthleteLinksTable.coachClerkId, viewer),
            eq(coachAthleteLinksTable.status, "accepted"), isNull(coachAthleteLinksTable.endedAt),
          ),
        ),
      db
        .select({ athlete: parentAthleteLinksTable.athleteClerkId })
        .from(parentAthleteLinksTable)
        .where(
          and(
            eq(parentAthleteLinksTable.parentClerkId, viewer),
            eq(parentAthleteLinksTable.status, "accepted"), isNull(parentAthleteLinksTable.endedAt),
          ),
        ),
      db
        .select({
          requester: friendLinksTable.requesterClerkId,
          addressee: friendLinksTable.addresseeClerkId,
        })
        .from(friendLinksTable)
        .where(
          and(
            eq(friendLinksTable.status, "accepted"), isNull(friendLinksTable.endedAt),
            or(
              eq(friendLinksTable.requesterClerkId, viewer),
              eq(friendLinksTable.addresseeClerkId, viewer),
            ),
          ),
        ),
      activeClubIds(viewer),
      activeTeamAndGroupKeys(viewer),
    ]);
  return {
    coachParentAthletes: [
      ...new Set([
        ...coachRows.map((r) => r.athlete),
        ...parentRows.map((r) => r.athlete),
      ]),
    ],
    friends: friendRows.map((r) =>
      r.requester === viewer ? r.addressee : r.requester,
    ),
    clubIds,
    teamGroupKeys,
  };
}
