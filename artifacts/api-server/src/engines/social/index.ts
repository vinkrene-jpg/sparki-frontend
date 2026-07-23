// Sparki Social & Team engine.
//
// Friends ("Circle"), privacy-safe friend feed, joint-training suggestions +
// group proposals, and club/team identity. Everything is clerkId-scoped and
// privacy fails closed: a friend never sees your activity until you opt in
// (privacy_settings.share_activity_with_friends), and sensitive health states
// (ziek/blessure) are never shared.

import { and, desc, eq, gte, inArray, ne, or } from "drizzle-orm";
import {
  db,
  friendLinksTable,
  teamIdentitiesTable,
  groupTrainingProposalsTable,
  groupTrainingInviteesTable,
  userProfilesTable,
  athleteProfilesTable,
  trainingSessionsTable,
  racesTable,
  sprintResultsTable,
  type TeamIdentity,
} from "@workspace/db";
import { getEffectivePrivacy } from "../../lib/privacy";
import { getDueFollowUps } from "../context-memory";
import {
  isBlockedBetween,
  loadPrivacyFor,
  getViewerRelation,
  categoryVisible,
} from "../../lib/profile-privacy";
import { createNotification } from "../../lib/notifications";

export * from "./network";

// ── Types surfaced to the API layer ──────────────────────────────────────────
export type FriendSummary = {
  clerkId: string;
  displayName: string;
  sport: string | null;
  club: string | null;
  team: string | null;
  availableDays: string[];
  isTrainingBuddy: boolean;
};

export type FriendRequestSummary = {
  id: number;
  direction: "incoming" | "outgoing";
  clerkId: string;
  displayName: string;
  createdAt: Date;
};

export type AthleteSearchResult = {
  clerkId: string;
  displayName: string;
  sport: string | null;
  club: string | null;
  relation: "none" | "pending" | "friends";
};

export type FeedItemKind =
  | "training_done"
  | "race_planned"
  | "looking_for_buddy"
  | "rest_day";

export type FriendFeedItem = {
  id: string;
  kind: FeedItemKind;
  clerkId: string;
  displayName: string;
  title: string;
  detail: string | null;
  at: Date;
};

export type JointTrainingSuggestion =
  | {
      available: true;
      message: string;
      dayKey: string;
      dayLabel: string;
      suggestedType: string;
      suggestedDurationMin: number;
      buddies: { clerkId: string; displayName: string }[];
    }
  | { available: false; reason: string };

export type ProposalInvitee = {
  clerkId: string;
  displayName: string;
  status: string; // proposed | accepted | declined | expired
};

export type SentProposal = {
  id: number;
  scheduledAt: Date;
  trainingType: string;
  durationMin: number | null;
  area: string | null;
  intensity: string | null;
  note: string | null;
  status: string;
  invitees: ProposalInvitee[];
};

export type ReceivedProposal = {
  id: number;
  proposerClerkId: string;
  proposerName: string;
  scheduledAt: Date;
  trainingType: string;
  durationMin: number | null;
  area: string | null;
  intensity: string | null;
  note: string | null;
  myStatus: string; // proposed | accepted | declined | expired
};

// One unified "Circle" stream item. Merges friend activity, the athlete's own
// race info, and due memory follow-ups (Sparki wil weten hoe iets ging) into a
// single calm, relevant timeline — never an algorithmic attention feed.
export type CircleFeedItem = {
  id: string;
  type:
    | "follow_up"
    | "my_race"
    | "friend_training"
    | "friend_race"
    | "friend_buddy"
    | "friend_rest"
    | "sprint";
  at: Date;
  title: string;
  detail: string | null;
  displayName: string | null;
  clerkId: string | null;
  memoryId: number | null; // follow_up only
  prompt: string | null; // follow_up only
};

// Dutch weekday labels for availability keys.
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const WEEKDAY_LABEL: Record<string, string> = {
  mon: "maandag",
  tue: "dinsdag",
  wed: "woensdag",
  thu: "donderdag",
  fri: "vrijdag",
  sat: "zaterdag",
  sun: "zondag",
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Internal helpers ─────────────────────────────────────────────────────────

// Names keyed by clerkId for a set of users.
async function displayNames(
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({
      clerkId: userProfilesTable.clerkId,
      displayName: userProfilesTable.displayName,
    })
    .from(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, ids));
  for (const r of rows) map.set(r.clerkId, r.displayName ?? "Sporter");
  return map;
}

// All accepted friendships touching `clerkId`, returning the raw link rows.
async function acceptedLinks(clerkId: string) {
  return db
    .select()
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
}

// Given an accepted link row, the friend's id from `viewer`'s perspective.
function otherSide(
  link: { requesterClerkId: string; addresseeClerkId: string },
  viewer: string,
): string {
  return link.requesterClerkId === viewer
    ? link.addresseeClerkId
    : link.requesterClerkId;
}

// ── Friends / Circle ─────────────────────────────────────────────────────────

export async function searchAthletes(
  viewer: string,
  query: string,
): Promise<AthleteSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const rows = await db
    .select({
      clerkId: userProfilesTable.clerkId,
      displayName: userProfilesTable.displayName,
    })
    .from(userProfilesTable)
    .where(ne(userProfilesTable.clerkId, viewer))
    .limit(50);
  const matched = rows
    .filter((r) => (r.displayName ?? "").toLowerCase().includes(q))
    .slice(0, 24);
  if (matched.length === 0) return [];

  // Fail-closed: geblokkeerde relaties en profielen die op profielniveau
  // niet zichtbaar zijn voor deze kijker verschijnen NOOIT in zoekresultaten.
  const visible: typeof matched = [];
  for (const r of matched) {
    if (visible.length >= 12) break;
    if (await isBlockedBetween(viewer, r.clerkId)) continue;
    const [relation, categories] = await Promise.all([
      getViewerRelation(viewer, r.clerkId),
      loadPrivacyFor(r.clerkId),
    ]);
    if (!categoryVisible(relation, categories, "profiel")) continue;
    visible.push(r);
  }
  const matchedVisible = visible;
  if (matchedVisible.length === 0) return [];

  const ids = matchedVisible.map((r) => r.clerkId);
  // Existing relations in either direction.
  const links = await db
    .select()
    .from(friendLinksTable)
    .where(
      or(
        and(
          eq(friendLinksTable.requesterClerkId, viewer),
          inArray(friendLinksTable.addresseeClerkId, ids),
        ),
        and(
          eq(friendLinksTable.addresseeClerkId, viewer),
          inArray(friendLinksTable.requesterClerkId, ids),
        ),
      ),
    );
  const relation = new Map<string, "pending" | "friends">();
  for (const l of links) {
    const other = otherSide(l, viewer);
    relation.set(other, l.status === "accepted" ? "friends" : "pending");
  }

  const sports = await sportByClerk(ids);
  const clubs = await clubByClerk(ids);
  return matched.map((r) => ({
    clerkId: r.clerkId,
    displayName: r.displayName ?? "Sporter",
    sport: sports.get(r.clerkId) ?? null,
    club: clubs.get(r.clerkId) ?? null,
    relation: relation.get(r.clerkId) ?? "none",
  }));
}

async function sportByClerk(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({
      clerkId: athleteProfilesTable.clerkId,
      sport: athleteProfilesTable.sport,
      discipline: athleteProfilesTable.discipline,
    })
    .from(athleteProfilesTable)
    .where(inArray(athleteProfilesTable.clerkId, ids));
  for (const r of rows) {
    const s = r.sport ?? r.discipline;
    if (s) map.set(r.clerkId, s);
  }
  return map;
}

async function clubByClerk(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({
      clerkId: teamIdentitiesTable.clerkId,
      clubName: teamIdentitiesTable.clubName,
    })
    .from(teamIdentitiesTable)
    .where(inArray(teamIdentitiesTable.clerkId, ids));
  for (const r of rows) if (r.clubName) map.set(r.clerkId, r.clubName);
  return map;
}

export async function sendFriendRequest(
  requester: string,
  addressee: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (requester === addressee)
    return { ok: false, reason: "Je kunt jezelf niet toevoegen." };
  const [target] = await db
    .select({ clerkId: userProfilesTable.clerkId })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, addressee));
  // Neutrale weigering: bestaat-niet en geblokkeerd zijn niet te
  // onderscheiden — geen lek via foutmeldingen.
  if (!target)
    return { ok: false, reason: "Dit verzoek kan niet worden verstuurd." };
  if (await isBlockedBetween(requester, addressee))
    return { ok: false, reason: "Dit verzoek kan niet worden verstuurd." };
  // Fail-closed: een profiel dat op profielniveau niet zichtbaar is voor de
  // aanvrager krijgt dezelfde neutrale weigering als niet-bestaand/geblokkeerd.
  const [relForRequest, catsForRequest] = await Promise.all([
    getViewerRelation(requester, addressee),
    loadPrivacyFor(addressee),
  ]);
  if (!categoryVisible(relForRequest, catsForRequest, "profiel"))
    return { ok: false, reason: "Dit verzoek kan niet worden verstuurd." };

  const [existing] = await db
    .select()
    .from(friendLinksTable)
    .where(
      or(
        and(
          eq(friendLinksTable.requesterClerkId, requester),
          eq(friendLinksTable.addresseeClerkId, addressee),
        ),
        and(
          eq(friendLinksTable.requesterClerkId, addressee),
          eq(friendLinksTable.addresseeClerkId, requester),
        ),
      ),
    );
  if (existing) {
    if (existing.status === "accepted")
      return { ok: false, reason: "Jullie zijn al verbonden." };
    if (existing.status === "pending")
      return { ok: false, reason: "Er staat al een verzoek open." };
    // Eerder geweigerd: dezelfde aanvrager mag NIET opnieuw vragen
    // (geen herhaald lastigvallen). Alleen als de weigeraar zelf nu het
    // initiatief neemt, wordt de rij heropend als vers verzoek.
    if (existing.requesterClerkId === requester) {
      return { ok: false, reason: "Dit verzoek kan niet worden verstuurd." };
    }
    await db
      .update(friendLinksTable)
      .set({
        requesterClerkId: requester,
        addresseeClerkId: addressee,
        status: "pending",
        respondedAt: null,
      })
      .where(eq(friendLinksTable.id, existing.id));
    await notifyFriendRequest(requester, addressee);
    return { ok: true };
  }

  await db
    .insert(friendLinksTable)
    .values({ requesterClerkId: requester, addresseeClerkId: addressee });
  await notifyFriendRequest(requester, addressee);
  return { ok: true };
}

async function notifyFriendRequest(
  requester: string,
  addressee: string,
): Promise<void> {
  const names = await displayNames([requester]);
  await createNotification({
    clerkId: addressee,
    type: "world_update",
    title: "Nieuw vriendschapsverzoek",
    body: `${names.get(requester) ?? "Een sporter"} wil je toevoegen als vriend. Bekijk het verzoek bij Samen.`,
    category: "sociaal",
    source: "social",
    dedupeKey: `friend-request:${requester}:${addressee}`,
  }).catch(() => undefined);
}

export async function respondFriendRequest(
  viewer: string,
  requestId: number,
  accept: boolean,
): Promise<{ ok: boolean; reason?: string }> {
  // Only the addressee of a pending request may respond.
  const [row] = await db
    .update(friendLinksTable)
    .set({
      status: accept ? "accepted" : "declined",
      respondedAt: new Date(),
    })
    .where(
      and(
        eq(friendLinksTable.id, requestId),
        eq(friendLinksTable.addresseeClerkId, viewer),
        eq(friendLinksTable.status, "pending"),
      ),
    )
    .returning();
  if (!row) return { ok: false, reason: "Verzoek niet gevonden." };
  if (accept) {
    const names = await displayNames([viewer]);
    await createNotification({
      clerkId: row.requesterClerkId,
      type: "world_update",
      title: "Vriendschapsverzoek geaccepteerd",
      body: `${names.get(viewer) ?? "Een sporter"} heeft je verzoek geaccepteerd. Jullie zijn nu vrienden op Sparki.`,
      category: "sociaal",
      source: "social",
      dedupeKey: `friend-accept:${row.id}`,
    }).catch(() => undefined);
  }
  return { ok: true };
}

export async function listFriends(viewer: string): Promise<FriendSummary[]> {
  const links = await acceptedLinks(viewer);
  if (links.length === 0) return [];
  const friendIds = links.map((l) => otherSide(l, viewer));

  const [names, profiles, clubs] = await Promise.all([
    displayNames(friendIds),
    db
      .select({
        clerkId: athleteProfilesTable.clerkId,
        sport: athleteProfilesTable.sport,
        discipline: athleteProfilesTable.discipline,
        availableDays: athleteProfilesTable.availableDays,
      })
      .from(athleteProfilesTable)
      .where(inArray(athleteProfilesTable.clerkId, friendIds)),
    db
      .select({
        clerkId: teamIdentitiesTable.clerkId,
        clubName: teamIdentitiesTable.clubName,
        teamName: teamIdentitiesTable.teamName,
      })
      .from(teamIdentitiesTable)
      .where(inArray(teamIdentitiesTable.clerkId, friendIds)),
  ]);

  const profileMap = new Map(profiles.map((p) => [p.clerkId, p]));
  const clubMap = new Map(clubs.map((c) => [c.clerkId, c]));

  return links.map((link) => {
    const friendId = otherSide(link, viewer);
    const p = profileMap.get(friendId);
    const c = clubMap.get(friendId);
    const isBuddy =
      link.requesterClerkId === viewer
        ? link.requesterTrainingBuddy
        : link.addresseeTrainingBuddy;
    return {
      clerkId: friendId,
      displayName: names.get(friendId) ?? "Sporter",
      sport: p?.sport ?? p?.discipline ?? null,
      club: c?.clubName ?? null,
      team: c?.teamName ?? null,
      availableDays: p?.availableDays ?? [],
      isTrainingBuddy: isBuddy,
    };
  });
}

export async function listFriendRequests(
  viewer: string,
): Promise<FriendRequestSummary[]> {
  const rows = await db
    .select()
    .from(friendLinksTable)
    .where(
      and(
        eq(friendLinksTable.status, "pending"),
        or(
          eq(friendLinksTable.requesterClerkId, viewer),
          eq(friendLinksTable.addresseeClerkId, viewer),
        ),
      ),
    );
  if (rows.length === 0) return [];
  const others = rows.map((r) => otherSide(r, viewer));
  const names = await displayNames(others);
  return rows.map((r) => {
    const incoming = r.addresseeClerkId === viewer;
    const other = otherSide(r, viewer);
    return {
      id: r.id,
      direction: incoming ? "incoming" : "outgoing",
      clerkId: other,
      displayName: names.get(other) ?? "Sporter",
      createdAt: r.createdAt,
    };
  });
}

export async function setTrainingBuddy(
  viewer: string,
  friendClerkId: string,
  selected: boolean,
): Promise<{ ok: boolean; reason?: string }> {
  const [link] = await db
    .select()
    .from(friendLinksTable)
    .where(
      and(
        eq(friendLinksTable.status, "accepted"),
        or(
          and(
            eq(friendLinksTable.requesterClerkId, viewer),
            eq(friendLinksTable.addresseeClerkId, friendClerkId),
          ),
          and(
            eq(friendLinksTable.requesterClerkId, friendClerkId),
            eq(friendLinksTable.addresseeClerkId, viewer),
          ),
        ),
      ),
    );
  if (!link) return { ok: false, reason: "Geen vriend gevonden." };
  const patch =
    link.requesterClerkId === viewer
      ? { requesterTrainingBuddy: selected }
      : { addresseeTrainingBuddy: selected };
  await db
    .update(friendLinksTable)
    .set(patch)
    .where(eq(friendLinksTable.id, link.id));
  return { ok: true };
}

export async function removeFriend(
  viewer: string,
  friendClerkId: string,
): Promise<boolean> {
  const result = await db
    .delete(friendLinksTable)
    .where(
      or(
        and(
          eq(friendLinksTable.requesterClerkId, viewer),
          eq(friendLinksTable.addresseeClerkId, friendClerkId),
        ),
        and(
          eq(friendLinksTable.requesterClerkId, friendClerkId),
          eq(friendLinksTable.addresseeClerkId, viewer),
        ),
      ),
    )
    .returning();
  return result.length > 0;
}

// ── Friend feed (privacy-safe) ───────────────────────────────────────────────

export async function getFriendFeed(viewer: string): Promise<FriendFeedItem[]> {
  const friends = await listFriends(viewer);
  if (friends.length === 0) return [];

  // Only friends who opted in to friend-sharing contribute to the feed.
  const sharing = await Promise.all(
    friends.map(async (f) => ({
      f,
      privacy: await getEffectivePrivacy(f.clerkId),
    })),
  );
  const sharers = sharing
    .filter((s) => s.privacy.shareActivityWithFriends)
    .map((s) => s.f);
  if (sharers.length === 0) return [];

  const ids = sharers.map((f) => f.clerkId);
  const nameOf = new Map(sharers.map((f) => [f.clerkId, f.displayName]));
  const items: FriendFeedItem[] = [];

  const since = new Date();
  since.setDate(since.getDate() - 10);
  const sinceStr = isoDate(since);
  const todayStr = isoDate(new Date());

  // 1. Completed training sessions (last 10 days).
  const sessions = await db
    .select({
      id: trainingSessionsTable.id,
      clerkId: trainingSessionsTable.clerkId,
      sessionDate: trainingSessionsTable.sessionDate,
      type: trainingSessionsTable.type,
      title: trainingSessionsTable.title,
      durationMin: trainingSessionsTable.durationMin,
    })
    .from(trainingSessionsTable)
    .where(
      and(
        inArray(trainingSessionsTable.clerkId, ids),
        gte(trainingSessionsTable.sessionDate, sinceStr),
      ),
    );
  for (const s of sessions) {
    const dur = s.durationMin ? ` · ${s.durationMin} min` : "";
    items.push({
      id: `session-${s.id}`,
      kind: "training_done",
      clerkId: s.clerkId,
      displayName: nameOf.get(s.clerkId) ?? "Sporter",
      title: `${nameOf.get(s.clerkId) ?? "Sporter"} heeft een training afgerond`,
      detail: `${s.title ?? "Training"}${dur}`,
      at: new Date(`${s.sessionDate}T12:00:00`),
    });
  }

  // 2. Upcoming races (planned).
  const races = await db
    .select({
      id: racesTable.id,
      clerkId: racesTable.clerkId,
      name: racesTable.name,
      raceDate: racesTable.raceDate,
      location: racesTable.location,
    })
    .from(racesTable)
    .where(
      and(
        inArray(racesTable.clerkId, ids),
        gte(racesTable.raceDate, todayStr),
      ),
    );
  for (const r of races) {
    items.push({
      id: `race-${r.id}`,
      kind: "race_planned",
      clerkId: r.clerkId,
      displayName: nameOf.get(r.clerkId) ?? "Sporter",
      title: `${nameOf.get(r.clerkId) ?? "Sporter"} heeft een wedstrijd gepland`,
      detail: r.location ? `${r.name} · ${r.location}` : r.name,
      at: new Date(`${r.raceDate}T09:00:00`),
    });
  }

  // 3. Looking for a training buddy: an open future group proposal signals the
  //    friend wants company.
  const open = await db
    .select({
      id: groupTrainingProposalsTable.id,
      clerkId: groupTrainingProposalsTable.proposerClerkId,
      scheduledAt: groupTrainingProposalsTable.scheduledAt,
      trainingType: groupTrainingProposalsTable.trainingType,
      status: groupTrainingProposalsTable.status,
    })
    .from(groupTrainingProposalsTable)
    .where(
      and(
        inArray(groupTrainingProposalsTable.proposerClerkId, ids),
        eq(groupTrainingProposalsTable.status, "open"),
        gte(groupTrainingProposalsTable.scheduledAt, new Date()),
      ),
    );
  for (const o of open) {
    items.push({
      id: `proposal-${o.id}`,
      kind: "looking_for_buddy",
      clerkId: o.clerkId,
      displayName: nameOf.get(o.clerkId) ?? "Sporter",
      title: `${nameOf.get(o.clerkId) ?? "Sporter"} zoekt een trainingsmaatje`,
      detail: `${o.trainingType} gepland`,
      at: o.scheduledAt,
    });
  }

  // Most recent first; cap to a calm feed length.
  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.slice(0, 30);
}

// ── Unified Circle feed ──────────────────────────────────────────────────────
const FRIEND_KIND_MAP: Record<FeedItemKind, CircleFeedItem["type"]> = {
  training_done: "friend_training",
  race_planned: "friend_race",
  looking_for_buddy: "friend_buddy",
  rest_day: "friend_rest",
};

// Combine friend activity, the athlete's own upcoming races, and due memory
// follow-ups into one stream. Privacy fails closed via getFriendFeed; follow-ups
// and own races are the viewer's own data. Due follow-ups are pinned on top
// (Sparki actively wants an answer), the rest is most-recent-first.
export async function getCircleFeed(clerkId: string): Promise<CircleFeedItem[]> {
  const items: CircleFeedItem[] = [];

  // 1. Friend activity (already opt-in + health-safe inside getFriendFeed).
  const friendItems = await getFriendFeed(clerkId);
  for (const f of friendItems) {
    items.push({
      id: f.id,
      type: FRIEND_KIND_MAP[f.kind],
      at: f.at,
      title: f.title,
      detail: f.detail,
      displayName: f.displayName,
      clerkId: f.clerkId,
      memoryId: null,
      prompt: null,
    });
  }

  // 2. The athlete's own upcoming races (their own race info).
  const todayStr = isoDate(new Date());
  const myRaces = await db
    .select({
      id: racesTable.id,
      name: racesTable.name,
      raceDate: racesTable.raceDate,
      location: racesTable.location,
      priority: racesTable.priority,
    })
    .from(racesTable)
    .where(
      and(eq(racesTable.clerkId, clerkId), gte(racesTable.raceDate, todayStr)),
    );
  for (const r of myRaces) {
    items.push({
      id: `myrace-${r.id}`,
      type: "my_race",
      at: new Date(`${r.raceDate}T09:00:00`),
      title: r.name,
      detail: r.location
        ? `${r.location} · ${r.priority}-koers`
        : `${r.priority}-koers`,
      displayName: null,
      clerkId,
      memoryId: null,
      prompt: null,
    });
  }

  // 3. Due memory follow-ups (Sparki wil weten hoe iets ging).
  const due = await getDueFollowUps(clerkId);
  for (const m of due) {
    items.push({
      id: `memory-${m.id}`,
      type: "follow_up",
      at: m.followUpAt ? new Date(m.followUpAt) : new Date(),
      title: m.title,
      detail: m.detail,
      displayName: null,
      clerkId,
      memoryId: m.id,
      prompt: m.prompt,
    });
  }

  // 4. Shared bordje-sprints — the rider's own, plus friends' who opted into
  // friend-sharing. Only sprints the owner explicitly shared appear here.
  const sprintSince = new Date();
  sprintSince.setDate(sprintSince.getDate() - 14);

  const friends = await listFriends(clerkId);
  const friendSharers: { clerkId: string; displayName: string }[] = [];
  for (const f of friends) {
    const privacy = await getEffectivePrivacy(f.clerkId);
    if (privacy.shareActivityWithFriends) {
      friendSharers.push({ clerkId: f.clerkId, displayName: f.displayName });
    }
  }
  const sprintOwnerIds = [clerkId, ...friendSharers.map((f) => f.clerkId)];
  const nameOfSprinter = new Map(
    friendSharers.map((f) => [f.clerkId, f.displayName]),
  );

  const sharedSprints = await db
    .select({
      id: sprintResultsTable.id,
      clerkId: sprintResultsTable.clerkId,
      placeName: sprintResultsTable.placeName,
      totalPoints: sprintResultsTable.totalPoints,
      occurredAt: sprintResultsTable.occurredAt,
    })
    .from(sprintResultsTable)
    .where(
      and(
        inArray(sprintResultsTable.clerkId, sprintOwnerIds),
        eq(sprintResultsTable.shared, "true"),
        eq(sprintResultsTable.status, "scored"),
        gte(sprintResultsTable.occurredAt, sprintSince),
      ),
    )
    .orderBy(desc(sprintResultsTable.occurredAt))
    .limit(20);

  for (const s of sharedSprints) {
    const mine = s.clerkId === clerkId;
    items.push({
      id: `sprint-${s.id}`,
      type: "sprint",
      at: s.occurredAt,
      title: mine
        ? `Jij sprintte voor het bordje van ${s.placeName}`
        : `${nameOfSprinter.get(s.clerkId) ?? "Een teamgenoot"} sprintte voor ${s.placeName}`,
      detail: `${s.totalPoints} sprintpunten`,
      displayName: mine ? null : (nameOfSprinter.get(s.clerkId) ?? null),
      clerkId: s.clerkId,
      memoryId: null,
      prompt: null,
    });
  }

  // Follow-ups float to the top (they're actionable, timely); the rest is
  // most-recent-first. Calm cap — never an endless timeline.
  items.sort((a, b) => {
    const aFollow = a.type === "follow_up" ? 0 : 1;
    const bFollow = b.type === "follow_up" ? 0 : 1;
    if (aFollow !== bFollow) return aFollow - bFollow;
    return b.at.getTime() - a.at.getTime();
  });
  return items.slice(0, 40);
}

// ── Joint-training suggestion ────────────────────────────────────────────────

export async function suggestJointTraining(
  viewer: string,
): Promise<JointTrainingSuggestion> {
  const [me] = await db
    .select({
      sport: athleteProfilesTable.sport,
      discipline: athleteProfilesTable.discipline,
      experienceLevel: athleteProfilesTable.experienceLevel,
      availableDays: athleteProfilesTable.availableDays,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, viewer));

  const myDays = me?.availableDays ?? [];
  const mySport = me?.sport ?? me?.discipline ?? null;
  if (myDays.length === 0)
    return {
      available: false,
      reason:
        "Stel eerst je beschikbare trainingsdagen in bij Training, dan kan Sparki maatjes matchen.",
    };

  const friends = await listFriends(viewer);
  const buddies = friends.filter((f) => f.isTrainingBuddy);
  if (buddies.length === 0)
    return {
      available: false,
      reason:
        "Selecteer eerst een paar trainingsmaatjes in je Circle, dan stelt Sparki samen trainen voor.",
    };

  // Match: same sport (when known) + overlapping available day.
  const matching = buddies.filter((b) => {
    const sportOk = !mySport || !b.sport || b.sport === mySport;
    const overlap = b.availableDays.some((d) => myDays.includes(d));
    return sportOk && overlap;
  });
  if (matching.length === 0)
    return {
      available: false,
      reason:
        "Je maatjes hebben nu geen overlappende beschikbaarheid. Pas je dagen aan of voeg een maatje toe.",
    };

  // Pick the soonest shared day (ordered by week starting today).
  const order = rotatedWeek(new Date());
  let chosenDay: string | null = null;
  for (const day of order) {
    if (
      myDays.includes(day) &&
      matching.some((b) => b.availableDays.includes(day))
    ) {
      chosenDay = day;
      break;
    }
  }
  if (!chosenDay)
    return {
      available: false,
      reason: "Geen gedeelde dag gevonden in de komende week.",
    };

  const dayBuddies = matching.filter((b) =>
    b.availableDays.includes(chosenDay!),
  );
  const names = dayBuddies.map((b) => b.displayName);
  const namesText =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} en ${names[names.length - 1]}`;
  const dayLabel = WEEKDAY_LABEL[chosenDay] ?? chosenDay;

  return {
    available: true,
    dayKey: chosenDay,
    dayLabel,
    suggestedType: "rustige duurtraining",
    suggestedDurationMin: 90,
    buddies: dayBuddies.map((b) => ({
      clerkId: b.clerkId,
      displayName: b.displayName,
    })),
    message: `Op ${dayLabel} past een rustige duurtraining goed. ${namesText} ${
      names.length === 1 ? "heeft" : "hebben"
    } dan ook tijd. Zal ik een voorstel maken?`,
  };
}

// Week keys ordered from today forward, e.g. starting Wednesday → wed..tue.
function rotatedWeek(now: Date): string[] {
  // JS getDay(): 0=Sun..6=Sat. Map to our mon-first index.
  const jsDay = now.getDay();
  const todayIdx = jsDay === 0 ? 6 : jsDay - 1;
  const out: string[] = [];
  for (let i = 0; i < 7; i++) out.push(WEEKDAY_KEYS[(todayIdx + i) % 7]!);
  return out;
}

// ── Group proposals ──────────────────────────────────────────────────────────

export async function createProposal(
  proposer: string,
  input: {
    scheduledAt: Date;
    trainingType: string;
    durationMin?: number | null;
    area?: string | null;
    intensity?: string | null;
    note?: string | null;
    inviteeClerkIds: string[];
  },
): Promise<{ ok: boolean; reason?: string; id?: number }> {
  // Only accepted friends may be invited.
  const friends = await listFriends(proposer);
  const friendIds = new Set(friends.map((f) => f.clerkId));
  const invitees = [...new Set(input.inviteeClerkIds)].filter((id) =>
    friendIds.has(id),
  );
  if (invitees.length === 0)
    return { ok: false, reason: "Kies minstens één vriend uit je Circle." };

  const [proposal] = await db
    .insert(groupTrainingProposalsTable)
    .values({
      proposerClerkId: proposer,
      scheduledAt: input.scheduledAt,
      trainingType: input.trainingType,
      durationMin: input.durationMin ?? null,
      area: input.area ?? null,
      intensity: input.intensity ?? null,
      note: input.note ?? null,
    })
    .returning();

  await db.insert(groupTrainingInviteesTable).values(
    invitees.map((id) => ({
      proposalId: proposal!.id,
      inviteeClerkId: id,
    })),
  );
  return { ok: true, id: proposal!.id };
}

export async function respondToProposal(
  viewer: string,
  proposalId: number,
  accept: boolean,
): Promise<{ ok: boolean; reason?: string }> {
  const [row] = await db
    .update(groupTrainingInviteesTable)
    .set({
      status: accept ? "accepted" : "declined",
      respondedAt: new Date(),
    })
    .where(
      and(
        eq(groupTrainingInviteesTable.proposalId, proposalId),
        eq(groupTrainingInviteesTable.inviteeClerkId, viewer),
        eq(groupTrainingInviteesTable.status, "proposed"),
      ),
    )
    .returning();
  if (!row) return { ok: false, reason: "Voorstel niet gevonden." };
  return { ok: true };
}

// Compute the user-facing status: a still-"proposed" invite whose training is in
// the past is shown as "expired" (verlopen) without mutating the row.
function effectiveStatus(raw: string, scheduledAt: Date, now: Date): string {
  if (raw === "proposed" && scheduledAt.getTime() < now.getTime())
    return "expired";
  return raw;
}

export async function listSentProposals(
  viewer: string,
): Promise<SentProposal[]> {
  const proposals = await db
    .select()
    .from(groupTrainingProposalsTable)
    .where(eq(groupTrainingProposalsTable.proposerClerkId, viewer))
    .orderBy(desc(groupTrainingProposalsTable.scheduledAt));
  if (proposals.length === 0) return [];

  const proposalIds = proposals.map((p) => p.id);
  const invitees = await db
    .select()
    .from(groupTrainingInviteesTable)
    .where(inArray(groupTrainingInviteesTable.proposalId, proposalIds));
  const names = await displayNames(invitees.map((i) => i.inviteeClerkId));
  const now = new Date();

  return proposals.map((p) => ({
    id: p.id,
    scheduledAt: p.scheduledAt,
    trainingType: p.trainingType,
    durationMin: p.durationMin,
    area: p.area,
    intensity: p.intensity,
    note: p.note,
    status: p.status,
    invitees: invitees
      .filter((i) => i.proposalId === p.id)
      .map((i) => ({
        clerkId: i.inviteeClerkId,
        displayName: names.get(i.inviteeClerkId) ?? "Sporter",
        status: effectiveStatus(i.status, p.scheduledAt, now),
      })),
  }));
}

export async function listReceivedProposals(
  viewer: string,
): Promise<ReceivedProposal[]> {
  const rows = await db
    .select({
      inviteeStatus: groupTrainingInviteesTable.status,
      id: groupTrainingProposalsTable.id,
      proposerClerkId: groupTrainingProposalsTable.proposerClerkId,
      scheduledAt: groupTrainingProposalsTable.scheduledAt,
      trainingType: groupTrainingProposalsTable.trainingType,
      durationMin: groupTrainingProposalsTable.durationMin,
      area: groupTrainingProposalsTable.area,
      intensity: groupTrainingProposalsTable.intensity,
      note: groupTrainingProposalsTable.note,
    })
    .from(groupTrainingInviteesTable)
    .innerJoin(
      groupTrainingProposalsTable,
      eq(groupTrainingInviteesTable.proposalId, groupTrainingProposalsTable.id),
    )
    .where(eq(groupTrainingInviteesTable.inviteeClerkId, viewer))
    .orderBy(desc(groupTrainingProposalsTable.scheduledAt));
  if (rows.length === 0) return [];

  const names = await displayNames(rows.map((r) => r.proposerClerkId));
  const now = new Date();
  return rows.map((r) => ({
    id: r.id,
    proposerClerkId: r.proposerClerkId,
    proposerName: names.get(r.proposerClerkId) ?? "Sporter",
    scheduledAt: r.scheduledAt,
    trainingType: r.trainingType,
    durationMin: r.durationMin,
    area: r.area,
    intensity: r.intensity,
    note: r.note,
    myStatus: effectiveStatus(r.inviteeStatus, r.scheduledAt, now),
  }));
}

// ── Club / team identity ─────────────────────────────────────────────────────

export async function getTeamIdentity(
  clerkId: string,
): Promise<TeamIdentity | null> {
  const [row] = await db
    .select()
    .from(teamIdentitiesTable)
    .where(eq(teamIdentitiesTable.clerkId, clerkId));
  return row ?? null;
}

export async function setTeamIdentity(
  clerkId: string,
  data: Partial<
    Record<
      | "clubName"
      | "teamName"
      | "logoUrl"
      | "primaryColor"
      | "secondaryColor"
      | "sport"
      | "category"
      | "shirtBadge"
      | "role",
      string | null
    >
  >,
): Promise<TeamIdentity> {
  const [row] = await db
    .insert(teamIdentitiesTable)
    .values({ clerkId, ...data })
    .onConflictDoUpdate({
      target: teamIdentitiesTable.clerkId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning();
  return row!;
}
