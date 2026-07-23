// Sparki sociaal netwerk: volgen, blokkeren, rapporteren, profielweergave,
// per-categorie privacy en privacyvriendelijke contactmatching.
//
// Alles hier is server-side afgedwongen; de rechtenlaag in
// lib/profile-privacy.ts is de enige waarheid. Fail-closed: geblokkeerd of
// afgeschermd profiel geeft dezelfde neutrale uitkomst — geen lekken via
// aantallen of foutmeldingen.

import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  teamIdentitiesTable,
  friendLinksTable,
  followLinksTable,
  profilePrivacyTable,
  socialReportsTable,
  worldBlocksTable,
  trainingSessionsTable,
  racesTable,
} from "@workspace/db";
import {
  PRIVACY_CATEGORIES,
  PRIVACY_CATEGORY_KEYS,
  PRIVACY_AUDIENCES,
  type PrivacyAudience,
  type ViewerRelation,
  loadPrivacyFor,
  effectiveCategories,
  getViewerRelation,
  isBlockedBetween,
  categoryVisible,
} from "../../lib/profile-privacy";
import { createNotification } from "../../lib/notifications";

// ── Types ────────────────────────────────────────────────────────────────────

export type PersonSummary = {
  clerkId: string;
  displayName: string;
  sport: string | null;
  club: string | null;
};

export type SocialOverview = {
  counts: { vrienden: number; volgers: number; gevolgd: number };
  volgers: PersonSummary[];
  gevolgd: PersonSummary[];
};

export type PublicProfileView = {
  clerkId: string;
  relation: Exclude<ViewerRelation, "self"> | "self";
  displayName: string | null; // null = naam niet zichtbaar
  sport: string | null;
  club: string | null;
  team: string | null;
  counts: { vrienden: number; volgers: number } | null;
  trainingSummary: {
    last28dCount: number;
    last28dHours: number;
    lastTrainingDate: string | null;
  } | null;
  nextRace: { name: string; date: string } | null;
  volgIk: boolean;
  isVriend: boolean;
  verzoekMogelijk: boolean;
  zichtbaar: Record<string, boolean>;
};

// ── Hulpjes ──────────────────────────────────────────────────────────────────

async function personSummaries(ids: string[]): Promise<PersonSummary[]> {
  if (ids.length === 0) return [];
  const [names, profiles, clubs] = await Promise.all([
    db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
      })
      .from(userProfilesTable)
      .where(inArray(userProfilesTable.clerkId, ids)),
    db
      .select({
        clerkId: athleteProfilesTable.clerkId,
        sport: athleteProfilesTable.sport,
        discipline: athleteProfilesTable.discipline,
      })
      .from(athleteProfilesTable)
      .where(inArray(athleteProfilesTable.clerkId, ids)),
    db
      .select({
        clerkId: teamIdentitiesTable.clerkId,
        clubName: teamIdentitiesTable.clubName,
      })
      .from(teamIdentitiesTable)
      .where(inArray(teamIdentitiesTable.clerkId, ids)),
  ]);
  const nameMap = new Map(names.map((n) => [n.clerkId, n.displayName]));
  const profMap = new Map(profiles.map((p) => [p.clerkId, p]));
  const clubMap = new Map(clubs.map((c) => [c.clerkId, c.clubName]));
  return ids.map((id) => ({
    clerkId: id,
    displayName: nameMap.get(id) ?? "Sporter",
    sport: profMap.get(id)?.sport ?? profMap.get(id)?.discipline ?? null,
    club: clubMap.get(id) ?? null,
  }));
}

async function blockedIdsFor(viewer: string): Promise<Set<string>> {
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

// ── Overzicht (vrienden/volgers/gevolgd) ─────────────────────────────────────

export async function getSocialOverview(
  viewer: string,
  friendCount: number,
): Promise<SocialOverview> {
  const blocked = await blockedIdsFor(viewer);
  const [followerRows, followingRows] = await Promise.all([
    db
      .select({ id: followLinksTable.followerClerkId })
      .from(followLinksTable)
      .where(eq(followLinksTable.followeeClerkId, viewer)),
    db
      .select({ id: followLinksTable.followeeClerkId })
      .from(followLinksTable)
      .where(eq(followLinksTable.followerClerkId, viewer)),
  ]);
  const followerIds = followerRows.map((r) => r.id).filter((id) => !blocked.has(id));
  const followingIds = followingRows.map((r) => r.id).filter((id) => !blocked.has(id));
  const [volgers, gevolgd] = await Promise.all([
    personSummaries(followerIds),
    personSummaries(followingIds),
  ]);
  return {
    counts: {
      vrienden: friendCount,
      volgers: followerIds.length,
      gevolgd: followingIds.length,
    },
    volgers,
    gevolgd,
  };
}

// ── Volgen ───────────────────────────────────────────────────────────────────

const NEUTRAL_REFUSAL = "Deze actie is nu niet mogelijk.";

export async function followUser(
  viewer: string,
  target: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (viewer === target)
    return { ok: false, reason: "Je kunt jezelf niet volgen." };
  const [exists] = await db
    .select({ clerkId: userProfilesTable.clerkId })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, target));
  // Neutrale weigering: bestaat-niet, geblokkeerd en afgeschermd zijn
  // niet te onderscheiden voor de aanvrager.
  if (!exists) return { ok: false, reason: NEUTRAL_REFUSAL };
  if (await isBlockedBetween(viewer, target))
    return { ok: false, reason: NEUTRAL_REFUSAL };
  const [relation, categories] = await Promise.all([
    getViewerRelation(viewer, target),
    loadPrivacyFor(target),
  ]);
  if (!categoryVisible(relation, categories, "profiel"))
    return { ok: false, reason: NEUTRAL_REFUSAL };
  await db
    .insert(followLinksTable)
    .values({ followerClerkId: viewer, followeeClerkId: target })
    .onConflictDoNothing();
  await createNotification({
    clerkId: target,
    type: "world_update",
    title: "Nieuwe volger",
    body: "Iemand volgt je nu op Sparki. Bekijk je volgers bij Samen.",
    category: "sociaal",
    source: "social",
    dedupeKey: `follow:${viewer}:${target}`,
  }).catch(() => undefined);
  return { ok: true };
}

export async function unfollowUser(
  viewer: string,
  target: string,
): Promise<boolean> {
  const rows = await db
    .delete(followLinksTable)
    .where(
      and(
        eq(followLinksTable.followerClerkId, viewer),
        eq(followLinksTable.followeeClerkId, target),
      ),
    )
    .returning();
  return rows.length > 0;
}

// ── Blokkeren & rapporteren ──────────────────────────────────────────────────

export async function blockUser(viewer: string, target: string): Promise<void> {
  if (viewer === target) return;
  // Atomair: blokkade + verbreken van vriendschap en volgrelaties (beide
  // kanten) in één transactie, zodat er nooit een halve toestand ontstaat.
  await db.transaction(async (tx) => {
    await tx
      .insert(worldBlocksTable)
      .values({ blockerClerkId: viewer, blockedClerkId: target })
      .onConflictDoNothing();
    await tx
      .delete(friendLinksTable)
      .where(
        or(
          and(
            eq(friendLinksTable.requesterClerkId, viewer),
            eq(friendLinksTable.addresseeClerkId, target),
          ),
          and(
            eq(friendLinksTable.requesterClerkId, target),
            eq(friendLinksTable.addresseeClerkId, viewer),
          ),
        ),
      );
    await tx
      .delete(followLinksTable)
      .where(
        or(
          and(
            eq(followLinksTable.followerClerkId, viewer),
            eq(followLinksTable.followeeClerkId, target),
          ),
          and(
            eq(followLinksTable.followerClerkId, target),
            eq(followLinksTable.followeeClerkId, viewer),
          ),
        ),
      );
  });
}

export async function unblockUser(
  viewer: string,
  target: string,
): Promise<boolean> {
  const rows = await db
    .delete(worldBlocksTable)
    .where(
      and(
        eq(worldBlocksTable.blockerClerkId, viewer),
        eq(worldBlocksTable.blockedClerkId, target),
      ),
    )
    .returning();
  return rows.length > 0;
}

export async function listBlockedUsers(
  viewer: string,
): Promise<PersonSummary[]> {
  const rows = await db
    .select({ id: worldBlocksTable.blockedClerkId })
    .from(worldBlocksTable)
    .where(eq(worldBlocksTable.blockerClerkId, viewer));
  return personSummaries(rows.map((r) => r.id));
}

export async function reportUser(
  viewer: string,
  target: string,
  reason: string | null,
): Promise<void> {
  await db.insert(socialReportsTable).values({
    reporterClerkId: viewer,
    reportedClerkId: target,
    reason: reason ? reason.slice(0, 2000) : null,
  });
}

// ── Per-categorie privacy ────────────────────────────────────────────────────

export async function getProfilePrivacy(viewer: string): Promise<{
  categories: Record<string, PrivacyAudience>;
  registry: typeof PRIVACY_CATEGORIES;
  audiences: readonly string[];
}> {
  const categories = await loadPrivacyFor(viewer);
  return { categories, registry: PRIVACY_CATEGORIES, audiences: PRIVACY_AUDIENCES };
}

export async function updateProfilePrivacy(
  viewer: string,
  updates: Record<string, unknown>,
): Promise<{ ok: boolean; reason?: string; categories?: Record<string, PrivacyAudience> }> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (!PRIVACY_CATEGORY_KEYS.includes(key))
      return { ok: false, reason: `Onbekende categorie: ${key}` };
    if (
      typeof value !== "string" ||
      !(PRIVACY_AUDIENCES as readonly string[]).includes(value)
    )
      return { ok: false, reason: `Ongeldig zichtbaarheidsniveau voor ${key}.` };
    clean[key] = value;
  }
  if (Object.keys(clean).length === 0)
    return { ok: false, reason: "Geen wijzigingen opgegeven." };
  const [existing] = await db
    .select({ categories: profilePrivacyTable.categories })
    .from(profilePrivacyTable)
    .where(eq(profilePrivacyTable.clerkId, viewer));
  const merged = { ...(existing?.categories ?? {}), ...clean };
  await db
    .insert(profilePrivacyTable)
    .values({ clerkId: viewer, categories: merged, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: profilePrivacyTable.clerkId,
      set: { categories: merged, updatedAt: new Date() },
    });
  return { ok: true, categories: effectiveCategories(merged) };
}

// ── Profielweergave (gefilterde projectie) ───────────────────────────────────

export async function getPublicProfile(
  viewer: string,
  owner: string,
): Promise<PublicProfileView | null> {
  const [exists] = await db
    .select({ clerkId: userProfilesTable.clerkId, displayName: userProfilesTable.displayName })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, owner));
  if (!exists) return null;
  if (viewer !== owner && (await isBlockedBetween(viewer, owner))) return null;

  const [relation, categories] = await Promise.all([
    getViewerRelation(viewer, owner),
    loadPrivacyFor(owner),
  ]);
  if (!categoryVisible(relation, categories, "profiel")) return null;

  const see = (key: string) => categoryVisible(relation, categories, key);
  const zichtbaar: Record<string, boolean> = {};
  for (const key of PRIVACY_CATEGORY_KEYS) zichtbaar[key] = see(key);

  // Identiteit
  const displayName = see("naam") ? (exists.displayName ?? "Sporter") : null;

  let sport: string | null = null;
  if (see("sportProfiel")) {
    const [p] = await db
      .select({
        sport: athleteProfilesTable.sport,
        discipline: athleteProfilesTable.discipline,
      })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, owner));
    sport = p?.sport ?? p?.discipline ?? null;
  }

  let club: string | null = null;
  let team: string | null = null;
  if (see("clubTeam")) {
    const [t] = await db
      .select({
        clubName: teamIdentitiesTable.clubName,
        teamName: teamIdentitiesTable.teamName,
      })
      .from(teamIdentitiesTable)
      .where(eq(teamIdentitiesTable.clerkId, owner));
    club = t?.clubName ?? null;
    team = t?.teamName ?? null;
  }

  // Aantallen alleen tonen als het profiel zichtbaar is (dat is het hier).
  const [friendCountRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(friendLinksTable)
    .where(
      and(
        eq(friendLinksTable.status, "accepted"),
        or(
          eq(friendLinksTable.requesterClerkId, owner),
          eq(friendLinksTable.addresseeClerkId, owner),
        ),
      ),
    );
  const [followerCountRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(followLinksTable)
    .where(eq(followLinksTable.followeeClerkId, owner));

  // Trainingssamenvatting (echte data, alleen bij toestemming)
  let trainingSummary: PublicProfileView["trainingSummary"] = null;
  if (see("trainingen")) {
    const since = new Date(Date.now() - 28 * 24 * 3600 * 1000);
    const rows = await db
      .select({
        date: trainingSessionsTable.sessionDate,
        durationMin: trainingSessionsTable.durationMin,
      })
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, owner),
          gte(trainingSessionsTable.sessionDate, since.toISOString().slice(0, 10)),
        ),
      )
      .orderBy(desc(trainingSessionsTable.sessionDate));
    const minutes = rows.reduce((s, r) => s + (r.durationMin ?? 0), 0);
    trainingSummary = {
      last28dCount: rows.length,
      last28dHours: Math.round((minutes / 60) * 10) / 10,
      lastTrainingDate: rows[0]?.date ?? null,
    };
  }

  // Eerstvolgende wedstrijd
  let nextRace: PublicProfileView["nextRace"] = null;
  if (see("wedstrijden")) {
    const today = new Date().toISOString().slice(0, 10);
    const [race] = await db
      .select({ name: racesTable.name, raceDate: racesTable.raceDate })
      .from(racesTable)
      .where(
        and(eq(racesTable.clerkId, owner), gte(racesTable.raceDate, today)),
      )
      .orderBy(racesTable.raceDate)
      .limit(1);
    if (race) nextRace = { name: race.name, date: race.raceDate };
  }

  // Relatiestatus voor de knoppen
  const [followRow] = await db
    .select({ id: followLinksTable.id })
    .from(followLinksTable)
    .where(
      and(
        eq(followLinksTable.followerClerkId, viewer),
        eq(followLinksTable.followeeClerkId, owner),
      ),
    )
    .limit(1);
  const [pendingOrDeclined] = await db
    .select({ status: friendLinksTable.status, requester: friendLinksTable.requesterClerkId })
    .from(friendLinksTable)
    .where(
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
    )
    .limit(1);
  const isVriend = relation === "vriend";
  const verzoekMogelijk =
    viewer !== owner &&
    !isVriend &&
    (!pendingOrDeclined ||
      (pendingOrDeclined.status === "declined" &&
        pendingOrDeclined.requester !== viewer));

  return {
    clerkId: owner,
    relation,
    displayName,
    sport,
    club,
    team,
    counts: { vrienden: friendCountRow?.n ?? 0, volgers: followerCountRow?.n ?? 0 },
    trainingSummary,
    nextRace,
    volgIk: Boolean(followRow),
    isVriend,
    verzoekMogelijk,
    zichtbaar,
  };
}

// ── Contactmatching (privacyvriendelijk) ─────────────────────────────────────
// De client stuurt UITSLUITEND sha256-hashes van genormaliseerde e-mailadressen
// (lowercase, getrimd). Er wordt niets opgeslagen; we vergelijken alleen tegen
// hashes van geregistreerde e-mailadressen. Telefoonnummers kunnen we eerlijk
// NIET matchen: Sparki slaat geen telefoonnummers op.

const MAX_CONTACT_HASHES = 500;

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export async function matchContacts(
  viewer: string,
  hashes: string[],
): Promise<{ ok: boolean; reason?: string; matches?: PersonSummary[] }> {
  const clean = [
    ...new Set(
      hashes
        .filter((h) => typeof h === "string" && /^[0-9a-f]{64}$/i.test(h))
        .map((h) => h.toLowerCase()),
    ),
  ];
  if (clean.length === 0)
    return { ok: false, reason: "Geen geldige contact-hashes ontvangen." };
  if (clean.length > MAX_CONTACT_HASHES)
    return {
      ok: false,
      reason: `Maximaal ${MAX_CONTACT_HASHES} contacten per keer.`,
    };

  const wanted = new Set(clean);
  const users = await db
    .select({
      clerkId: userProfilesTable.clerkId,
      email: userProfilesTable.email,
    })
    .from(userProfilesTable);
  const blocked = await blockedIdsFor(viewer);

  const matchedIds: string[] = [];
  for (const u of users) {
    if (u.clerkId === viewer || blocked.has(u.clerkId)) continue;
    const h = sha256Hex(u.email.trim().toLowerCase());
    if (wanted.has(h)) matchedIds.push(u.clerkId);
  }

  // Alleen mensen tonen van wie het profiel op Sparki-niveau vindbaar is.
  const visible: string[] = [];
  for (const id of matchedIds) {
    const categories = await loadPrivacyFor(id);
    const relation = await getViewerRelation(viewer, id);
    if (categoryVisible(relation, categories, "profiel")) visible.push(id);
  }
  return { ok: true, matches: await personSummaries(visible) };
}
