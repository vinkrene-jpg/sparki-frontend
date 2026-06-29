// Sparki World — feed, interactions & personalisation engine.
//
// The only place real users touch the world: they read the (validated) feed,
// follow/favorite Virtual Athletes, and like/comment on posts. The wall to real
// performance data is absolute — nothing here reads or writes a user's training
// data, and a Virtual Athlete never gains real-world data. Real-user actions are
// stored with actorClerkId; virtual actors use actorAthleteId.
//
// Personalisation v1 ranks the (already validated) posts by: who the viewer
// follows (favorites weigh more), discipline match with the viewer's own
// profile, and recency. No fabrication — every signal is real data the viewer
// supplied or an action they took.

import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  virtualAthletesTable,
  virtualMediaTable,
  virtualPostsTable,
  virtualInteractionsTable,
  virtualRelationshipsTable,
  virtualCareerEntriesTable,
  userVirtualFollowsTable,
} from "@workspace/db";
import { mediaUrl, readyHighlightUrls } from "../world-media";
import { getAffinity } from "../world-affinity";
import {
  scoreFeedItem,
  hasPersonalSignal,
  type FeedScoreContext,
  type FeedScoreInput,
} from "../../lib/world/feed-scoring";

const FEED_POOL = 200; // recent approved posts considered before ranking
// Guarantee a little breadth: even a tightly-personalised feed shows at least a
// couple of recognisable (cohort) and inspiration (prof/ex-prof) posts so the
// world never collapses into one niche.
const MIN_RECOGNIZABLE = 2;
const MIN_INSPIRATION = 2;

export type FeedAthlete = {
  id: number;
  slug: string;
  name: string;
  avatarUrl: string | null;
  discipline: string | null;
  level: string | null;
  archetype: string | null;
  nationality: string | null;
  followerScore: number;
  influenceCategory: string | null;
  role: string | null;
  cohort: string | null;
};

export type FeedItem = {
  id: number;
  kind: string;
  caption: string;
  mediaUrl: string | null;
  publishedAt: string | null;
  athlete: FeedAthlete;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  isFollowing: boolean;
  isFavorite: boolean;
  fictional: true; // ALWAYS true — the world is transparently simulated.
};

async function avatarMap(athleteRows: { avatarMediaId: number | null }[]) {
  const ids = [
    ...new Set(athleteRows.map((a) => a.avatarMediaId).filter((x): x is number => x != null)),
  ];
  if (ids.length === 0) return new Map<number, string | null>();
  const media = await db
    .select({ id: virtualMediaTable.id, objectPath: virtualMediaTable.objectPath })
    .from(virtualMediaTable)
    .where(inArray(virtualMediaTable.id, ids));
  return new Map(media.map((m) => [m.id, mediaUrl(m.objectPath)]));
}

export async function getWorldFeed(
  clerkId: string,
  limit = 24,
): Promise<{ items: FeedItem[]; personalized: boolean }> {
  // 1) recent validated posts
  const posts = await db
    .select({
      id: virtualPostsTable.id,
      kind: virtualPostsTable.kind,
      caption: virtualPostsTable.caption,
      mediaPath: virtualMediaTable.objectPath,
      publishedAt: virtualPostsTable.publishedAt,
      athleteId: virtualAthletesTable.id,
      slug: virtualAthletesTable.slug,
      name: virtualAthletesTable.name,
      discipline: virtualAthletesTable.discipline,
      level: virtualAthletesTable.level,
      archetype: virtualAthletesTable.archetype,
      nationality: virtualAthletesTable.nationality,
      avatarMediaId: virtualAthletesTable.avatarMediaId,
      role: virtualAthletesTable.role,
      expertise: virtualAthletesTable.expertise,
      cohort: virtualAthletesTable.cohort,
      followerScore: virtualAthletesTable.followerScore,
      influenceCategory: virtualAthletesTable.influenceCategory,
    })
    .from(virtualPostsTable)
    .innerJoin(virtualAthletesTable, eq(virtualPostsTable.athleteId, virtualAthletesTable.id))
    .leftJoin(virtualMediaTable, eq(virtualPostsTable.mediaId, virtualMediaTable.id))
    .where(
      and(
        eq(virtualPostsTable.validationStatus, "approved"),
        isNotNull(virtualPostsTable.publishedAt),
      ),
    )
    .orderBy(desc(virtualPostsTable.publishedAt))
    .limit(FEED_POOL);

  if (posts.length === 0) return { items: [], personalized: false };

  const postIds = posts.map((p) => p.id);

  // 2) interaction counts (one grouped query)
  const counts = await db
    .select({
      postId: virtualInteractionsTable.postId,
      kind: virtualInteractionsTable.kind,
      c: sql<number>`cast(count(*) as int)`,
    })
    .from(virtualInteractionsTable)
    .where(inArray(virtualInteractionsTable.postId, postIds))
    .groupBy(virtualInteractionsTable.postId, virtualInteractionsTable.kind);
  const likeCount = new Map<number, number>();
  const commentCount = new Map<number, number>();
  for (const row of counts) {
    if (row.kind === "like") likeCount.set(row.postId, row.c);
    else if (row.kind === "comment") commentCount.set(row.postId, row.c);
  }

  // 3) viewer's own likes + follows
  const myLikes = await db
    .select({ postId: virtualInteractionsTable.postId })
    .from(virtualInteractionsTable)
    .where(
      and(
        eq(virtualInteractionsTable.actorClerkId, clerkId),
        eq(virtualInteractionsTable.kind, "like"),
        inArray(virtualInteractionsTable.postId, postIds),
      ),
    );
  const likedSet = new Set(myLikes.map((l) => l.postId));

  const follows = await db
    .select({ athleteId: userVirtualFollowsTable.athleteId, favorite: userVirtualFollowsTable.favorite })
    .from(userVirtualFollowsTable)
    .where(eq(userVirtualFollowsTable.clerkId, clerkId));
  const followMap = new Map(follows.map((f) => [f.athleteId, f.favorite]));

  // viewer profile for discipline match
  const [profile] = await db
    .select({ discipline: athleteProfilesTable.discipline })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId));
  const myDiscipline = (profile?.discipline ?? "").toLowerCase();

  // learned affinity (T5) — what the viewer's behaviour revealed they like
  const affinity = await getAffinity(clerkId);
  let affinityMax = 0;
  for (const dim of affinity.values()) {
    for (const v of dim.values()) if (v.score > affinityMax) affinityMax = v.score;
  }

  const avatars = await avatarMap(posts);

  // 4) score + rank over many signals (pure, testable scoring)
  const ctx: FeedScoreContext = {
    nowMs: Date.now(),
    myDiscipline,
    follow: followMap,
    affinity,
    affinityMax,
  };
  const toScoreInput = (p: (typeof posts)[number]): FeedScoreInput => ({
    athleteId: p.athleteId,
    publishedAtMs: p.publishedAt ? p.publishedAt.getTime() : null,
    discipline: p.discipline,
    archetype: p.archetype,
    role: p.role,
    expertise: p.expertise,
    cohort: p.cohort,
    level: p.level,
    postKind: p.kind,
    followerScore: p.followerScore ?? 0,
    influenceCategory: p.influenceCategory,
  });
  const scored = posts.map((p) => ({ p, score: scoreFeedItem(toScoreInput(p), ctx).total }));
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (b.p.publishedAt?.getTime?.() ?? 0) - (a.p.publishedAt?.getTime?.() ?? 0),
  );

  // 5) selection with breadth injection — guarantee a couple of recognisable
  // (cohort) and inspiration (oud-prof / specialist / expert) posts surface even
  // when personalisation would otherwise crowd them out.
  const isRecognizable = (p: (typeof posts)[number]) => !!p.cohort;
  const isInspiration = (p: (typeof posts)[number]) =>
    p.role === "inspiration" || p.role === "specialist" || p.role === "expert";

  const picked: typeof scored = [];
  const pickedIds = new Set<number>();
  const take = (entry: (typeof scored)[number]) => {
    if (pickedIds.has(entry.p.id)) return;
    picked.push(entry);
    pickedIds.add(entry.p.id);
  };
  for (const entry of scored) {
    if (picked.length >= limit) break;
    take(entry);
  }
  const ensure = (pred: (p: (typeof posts)[number]) => boolean, min: number) => {
    let have = picked.filter((e) => pred(e.p)).length;
    if (have >= min) return;
    for (const entry of scored) {
      if (have >= min) break;
      if (pickedIds.has(entry.p.id) || !pred(entry.p)) continue;
      if (picked.length >= limit) picked.pop(); // make room, drop weakest tail
      take(entry);
      have++;
    }
  };
  ensure(isRecognizable, MIN_RECOGNIZABLE);
  ensure(isInspiration, MIN_INSPIRATION);
  picked.sort((a, b) => b.score - a.score);

  const items: FeedItem[] = picked.slice(0, limit).map(({ p }) => ({
    id: p.id,
    kind: p.kind,
    caption: p.caption,
    mediaUrl: mediaUrl(p.mediaPath),
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    athlete: {
      id: p.athleteId,
      slug: p.slug,
      name: p.name,
      avatarUrl: p.avatarMediaId != null ? (avatars.get(p.avatarMediaId) ?? null) : null,
      discipline: p.discipline,
      level: p.level,
      archetype: p.archetype,
      nationality: p.nationality,
      followerScore: p.followerScore ?? 0,
      influenceCategory: p.influenceCategory,
      role: p.role,
      cohort: p.cohort,
    },
    likeCount: likeCount.get(p.id) ?? 0,
    commentCount: commentCount.get(p.id) ?? 0,
    likedByMe: likedSet.has(p.id),
    isFollowing: followMap.has(p.athleteId),
    isFavorite: followMap.get(p.athleteId) ?? false,
    fictional: true,
  }));

  return { items, personalized: hasPersonalSignal(ctx) };
}

export type CareerEntryView = {
  seasonYear: number;
  ageThatYear: number;
  phase: string;
  level: string | null;
  team: string | null;
  ftp: number | null;
  kind: string;
  title: string;
  summary: string | null;
};

export type AthleteProfileView = {
  athlete: FeedAthlete & {
    age: number | null;
    city: string | null;
    team: string | null;
    bio: string | null;
    ftp: number | null;
    careerPhase: string | null;
    traits: Record<string, unknown> | null;
    // A short looping highlight clip when one is ready; null otherwise.
    highlightUrl: string | null;
  };
  relationships: { kind: string; name: string; slug: string }[];
  career: CareerEntryView[];
  posts: FeedItem[];
  isFollowing: boolean;
  isFavorite: boolean;
  fictional: true;
};

export async function getAthleteProfile(
  slug: string,
  clerkId: string,
): Promise<AthleteProfileView | null> {
  const [a] = await db
    .select()
    .from(virtualAthletesTable)
    .where(eq(virtualAthletesTable.slug, slug));
  if (!a) return null;

  const avatars = await avatarMap([a]);

  const rels = await db
    .select({
      kind: virtualRelationshipsTable.kind,
      name: virtualAthletesTable.name,
      slug: virtualAthletesTable.slug,
    })
    .from(virtualRelationshipsTable)
    .innerJoin(
      virtualAthletesTable,
      eq(virtualRelationshipsTable.relatedAthleteId, virtualAthletesTable.id),
    )
    .where(eq(virtualRelationshipsTable.athleteId, a.id))
    .limit(20);

  const [follow] = await db
    .select({ favorite: userVirtualFollowsTable.favorite })
    .from(userVirtualFollowsTable)
    .where(
      and(
        eq(userVirtualFollowsTable.clerkId, clerkId),
        eq(userVirtualFollowsTable.athleteId, a.id),
      ),
    );

  // multi-year career timeline (oldest → newest)
  const careerRows = await db
    .select({
      seasonYear: virtualCareerEntriesTable.seasonYear,
      ageThatYear: virtualCareerEntriesTable.ageThatYear,
      phase: virtualCareerEntriesTable.phase,
      level: virtualCareerEntriesTable.level,
      team: virtualCareerEntriesTable.team,
      ftp: virtualCareerEntriesTable.ftp,
      kind: virtualCareerEntriesTable.kind,
      title: virtualCareerEntriesTable.title,
      summary: virtualCareerEntriesTable.summary,
    })
    .from(virtualCareerEntriesTable)
    .where(eq(virtualCareerEntriesTable.athleteId, a.id))
    .orderBy(virtualCareerEntriesTable.seasonYear);

  // recent posts by this athlete
  const posts = await db
    .select({
      id: virtualPostsTable.id,
      kind: virtualPostsTable.kind,
      caption: virtualPostsTable.caption,
      mediaPath: virtualMediaTable.objectPath,
      publishedAt: virtualPostsTable.publishedAt,
    })
    .from(virtualPostsTable)
    .leftJoin(virtualMediaTable, eq(virtualPostsTable.mediaId, virtualMediaTable.id))
    .where(
      and(
        eq(virtualPostsTable.athleteId, a.id),
        eq(virtualPostsTable.validationStatus, "approved"),
        isNotNull(virtualPostsTable.publishedAt),
      ),
    )
    .orderBy(desc(virtualPostsTable.publishedAt))
    .limit(30);

  const postIds = posts.map((p) => p.id);
  const counts = postIds.length
    ? await db
        .select({
          postId: virtualInteractionsTable.postId,
          kind: virtualInteractionsTable.kind,
          c: sql<number>`cast(count(*) as int)`,
        })
        .from(virtualInteractionsTable)
        .where(inArray(virtualInteractionsTable.postId, postIds))
        .groupBy(virtualInteractionsTable.postId, virtualInteractionsTable.kind)
    : [];
  const likeCount = new Map<number, number>();
  const commentCount = new Map<number, number>();
  for (const r of counts) {
    if (r.kind === "like") likeCount.set(r.postId, r.c);
    else if (r.kind === "comment") commentCount.set(r.postId, r.c);
  }
  const myLikes = postIds.length
    ? await db
        .select({ postId: virtualInteractionsTable.postId })
        .from(virtualInteractionsTable)
        .where(
          and(
            eq(virtualInteractionsTable.actorClerkId, clerkId),
            eq(virtualInteractionsTable.kind, "like"),
            inArray(virtualInteractionsTable.postId, postIds),
          ),
        )
    : [];
  const likedSet = new Set(myLikes.map((l) => l.postId));

  const avatarUrl = a.avatarMediaId != null ? (avatars.get(a.avatarMediaId) ?? null) : null;
  const highlights = await readyHighlightUrls([
    { slug: a.slug, discipline: a.discipline, archetype: a.archetype },
  ]);
  const athleteView = {
    id: a.id,
    slug: a.slug,
    name: a.name,
    avatarUrl,
    discipline: a.discipline,
    level: a.level,
    archetype: a.archetype,
    nationality: a.nationality,
    followerScore: a.followerScore ?? 0,
    influenceCategory: a.influenceCategory,
    role: a.role,
    cohort: a.cohort,
    age: a.age,
    city: a.city,
    team: a.team,
    bio: a.bio,
    ftp: a.ftp,
    careerPhase: a.careerPhase,
    traits: a.traits ?? null,
    highlightUrl: highlights.get(a.slug) ?? null,
  };

  return {
    athlete: athleteView,
    relationships: rels,
    career: careerRows,
    isFollowing: follow !== undefined,
    isFavorite: follow?.favorite ?? false,
    fictional: true,
    posts: posts.map((p) => ({
      id: p.id,
      kind: p.kind,
      caption: p.caption,
      mediaUrl: mediaUrl(p.mediaPath),
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      athlete: athleteView,
      likeCount: likeCount.get(p.id) ?? 0,
      commentCount: commentCount.get(p.id) ?? 0,
      likedByMe: likedSet.has(p.id),
      isFollowing: follow !== undefined,
      isFavorite: follow?.favorite ?? false,
      fictional: true as const,
    })),
  };
}

// ── suggestions: recommended athletes & heroes ───────────────────────────────
// Rails for the world: people worth meeting that the viewer doesn't already
// follow. Two flavours — "recommended" (recognisable cohorts + inspiration,
// tilted toward the viewer's discipline + learned affinity) and "heroes" (the
// highest-reach inspiration figures). Deterministic ordering, no fabrication.

export type SuggestedAthlete = {
  id: number;
  slug: string;
  name: string;
  avatarUrl: string | null;
  discipline: string | null;
  level: string | null;
  archetype: string | null;
  nationality: string | null;
  role: string | null;
  cohort: string | null;
  followerScore: number;
  influenceCategory: string | null;
  reason: string; // plain-Dutch why this athlete is suggested
  // A short looping highlight clip when one is ready; null otherwise.
  highlightUrl: string | null;
  fictional: true;
};

const COHORT_LABELS: Record<string, string> = {
  "granfondo-ondernemer": "Granfondo-rijder met een druk leven",
  "criterium-sprinter": "Criteriumsprinter",
  "materiaalfanaat": "Materiaalliefhebber",
  "vroege-ochtend-ouder": "Ouder die 's ochtends vroeg traint",
};

function recommendReason(
  a: { role: string | null; cohort: string | null; discipline: string | null; expertise: string | null },
  myDiscipline: string,
): string {
  if (a.cohort && COHORT_LABELS[a.cohort]) return COHORT_LABELS[a.cohort];
  if (a.role === "expert" && a.expertise) {
    const ex: Record<string, string> = {
      voeding: "Deelt kennis over voeding",
      biomechanica: "Deelt kennis over houding en techniek",
      materiaal: "Deelt kennis over materiaal",
      sportarts: "Sportarts — deelt kennis over gezondheid",
    };
    return ex[a.expertise] ?? "Deelt vakkennis";
  }
  if (a.role === "specialist" && a.expertise) {
    const sp: Record<string, string> = {
      klimmen: "Klimspecialist",
      sprinten: "Sprintspecialist",
    };
    return sp[a.expertise] ?? "Specialist";
  }
  if (a.role === "inspiration") return "Ervaren renner om van te leren";
  if (
    myDiscipline &&
    a.discipline &&
    (myDiscipline.includes(a.discipline.toLowerCase()) ||
      a.discipline.toLowerCase().includes(myDiscipline))
  ) {
    return "Zelfde discipline als jij";
  }
  return "Misschien interessant voor jou";
}

async function suggestionRows() {
  return db
    .select({
      id: virtualAthletesTable.id,
      slug: virtualAthletesTable.slug,
      name: virtualAthletesTable.name,
      avatarMediaId: virtualAthletesTable.avatarMediaId,
      discipline: virtualAthletesTable.discipline,
      level: virtualAthletesTable.level,
      archetype: virtualAthletesTable.archetype,
      nationality: virtualAthletesTable.nationality,
      role: virtualAthletesTable.role,
      cohort: virtualAthletesTable.cohort,
      expertise: virtualAthletesTable.expertise,
      followerScore: virtualAthletesTable.followerScore,
      influenceCategory: virtualAthletesTable.influenceCategory,
    })
    .from(virtualAthletesTable);
}

export async function getRecommended(
  clerkId: string,
  limit = 12,
): Promise<{ items: SuggestedAthlete[]; fictional: true }> {
  const [profile] = await db
    .select({ discipline: athleteProfilesTable.discipline })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId));
  const myDiscipline = (profile?.discipline ?? "").toLowerCase();

  const follows = await db
    .select({ athleteId: userVirtualFollowsTable.athleteId })
    .from(userVirtualFollowsTable)
    .where(eq(userVirtualFollowsTable.clerkId, clerkId));
  const followed = new Set(follows.map((f) => f.athleteId));

  const affinity = await getAffinity(clerkId);
  const affScore = (dim: string, key: string | null) => {
    if (!key) return 0;
    return affinity.get(dim)?.get(key.toLowerCase())?.score ?? 0;
  };

  const rows = (await suggestionRows()).filter(
    (a) => !followed.has(a.id) && (a.cohort != null || a.role === "inspiration" || a.role === "specialist" || a.role === "expert"),
  );

  const scored = rows.map((a) => {
    let s = 0;
    if (
      myDiscipline &&
      a.discipline &&
      (myDiscipline.includes(a.discipline.toLowerCase()) ||
        a.discipline.toLowerCase().includes(myDiscipline))
    )
      s += 30;
    s += affScore("discipline", a.discipline) * 2;
    s += affScore("cohort", a.cohort) * 3;
    s += affScore("role", a.role) * 1.5;
    s += affScore("expertise", a.expertise) * 1.5;
    if (a.cohort) s += 12; // recognisable
    if (a.role === "inspiration") s += 8;
    s += Math.log10((a.followerScore ?? 0) + 10); // gentle reach tiebreak
    return { a, s };
  });
  // Deterministic: score desc, then id asc.
  scored.sort((x, y) => y.s - x.s || x.a.id - y.a.id);

  const top = scored.slice(0, limit).map((e) => e.a);
  const avatars = await avatarMap(top);
  const highlights = await readyHighlightUrls(top);
  const items: SuggestedAthlete[] = top.map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    avatarUrl: a.avatarMediaId != null ? (avatars.get(a.avatarMediaId) ?? null) : null,
    discipline: a.discipline,
    level: a.level,
    archetype: a.archetype,
    nationality: a.nationality,
    role: a.role,
    cohort: a.cohort,
    followerScore: a.followerScore ?? 0,
    influenceCategory: a.influenceCategory,
    reason: recommendReason(a, myDiscipline),
    highlightUrl: highlights.get(a.slug) ?? null,
    fictional: true,
  }));
  return { items, fictional: true };
}

export async function getHeroes(
  clerkId: string,
  limit = 8,
): Promise<{ items: SuggestedAthlete[]; fictional: true }> {
  const follows = await db
    .select({ athleteId: userVirtualFollowsTable.athleteId })
    .from(userVirtualFollowsTable)
    .where(eq(userVirtualFollowsTable.clerkId, clerkId));
  const followed = new Set(follows.map((f) => f.athleteId));

  // Heroes = highest-reach inspiration / prof figures.
  const rows = (await suggestionRows()).filter(
    (a) =>
      a.role === "inspiration" ||
      a.influenceCategory === "wereldster" ||
      a.influenceCategory === "prof",
  );
  rows.sort((x, y) => (y.followerScore ?? 0) - (x.followerScore ?? 0) || x.id - y.id);

  const top = rows.slice(0, limit);
  const avatars = await avatarMap(top);
  const highlights = await readyHighlightUrls(top);
  const items: SuggestedAthlete[] = top.map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    avatarUrl: a.avatarMediaId != null ? (avatars.get(a.avatarMediaId) ?? null) : null,
    discipline: a.discipline,
    level: a.level,
    archetype: a.archetype,
    nationality: a.nationality,
    role: a.role,
    cohort: a.cohort,
    followerScore: a.followerScore ?? 0,
    influenceCategory: a.influenceCategory,
    reason: followed.has(a.id) ? "Je volgt deze renner al" : "Toonaangevend in de wereld",
    highlightUrl: highlights.get(a.slug) ?? null,
    fictional: true,
  }));
  return { items, fictional: true };
}

async function athleteExists(athleteId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: virtualAthletesTable.id })
    .from(virtualAthletesTable)
    .where(eq(virtualAthletesTable.id, athleteId))
    .limit(1);
  return Boolean(row);
}

async function approvedPostExists(postId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: virtualPostsTable.id })
    .from(virtualPostsTable)
    .where(and(eq(virtualPostsTable.id, postId), eq(virtualPostsTable.validationStatus, "approved")))
    .limit(1);
  return Boolean(row);
}

export async function setFollow(
  clerkId: string,
  athleteId: number,
  favorite: boolean,
): Promise<{ following: boolean; favorite: boolean } | null> {
  if (!(await athleteExists(athleteId))) return null;
  await db
    .insert(userVirtualFollowsTable)
    .values({ clerkId, athleteId, favorite })
    .onConflictDoUpdate({
      target: [userVirtualFollowsTable.clerkId, userVirtualFollowsTable.athleteId],
      set: { favorite },
    });
  return { following: true, favorite };
}

export async function unfollow(clerkId: string, athleteId: number): Promise<void> {
  await db
    .delete(userVirtualFollowsTable)
    .where(
      and(
        eq(userVirtualFollowsTable.clerkId, clerkId),
        eq(userVirtualFollowsTable.athleteId, athleteId),
      ),
    );
}

export async function toggleLike(
  clerkId: string,
  postId: number,
): Promise<{ liked: boolean; likeCount: number } | null> {
  if (!(await approvedPostExists(postId))) return null;
  const [existing] = await db
    .select({ id: virtualInteractionsTable.id })
    .from(virtualInteractionsTable)
    .where(
      and(
        eq(virtualInteractionsTable.postId, postId),
        eq(virtualInteractionsTable.actorClerkId, clerkId),
        eq(virtualInteractionsTable.kind, "like"),
      ),
    );
  if (existing) {
    await db.delete(virtualInteractionsTable).where(eq(virtualInteractionsTable.id, existing.id));
  } else {
    await db
      .insert(virtualInteractionsTable)
      .values({ postId, actorClerkId: clerkId, kind: "like" });
  }
  const [{ c }] = await db
    .select({ c: sql<number>`cast(count(*) as int)` })
    .from(virtualInteractionsTable)
    .where(
      and(
        eq(virtualInteractionsTable.postId, postId),
        eq(virtualInteractionsTable.kind, "like"),
      ),
    );
  return { liked: !existing, likeCount: c ?? 0 };
}

export type CommentView = {
  id: number;
  body: string;
  byMe: boolean;
  authorName: string;
  createdAt: string;
};

export async function addComment(
  clerkId: string,
  postId: number,
  body: string,
): Promise<CommentView | null> {
  if (!(await approvedPostExists(postId))) return null;
  const [row] = await db
    .insert(virtualInteractionsTable)
    .values({ postId, actorClerkId: clerkId, kind: "comment", body })
    .returning({ id: virtualInteractionsTable.id, createdAt: virtualInteractionsTable.createdAt });
  return {
    id: row!.id,
    body,
    byMe: true,
    authorName: "Jij",
    createdAt: row!.createdAt.toISOString(),
  };
}

// ── quiet signals: view / save / share ───────────────────────────────────────
// These are the behaviours the adaptive feed learns from. view + share are
// recorded once per (user, post) so repeated impressions don't inflate the
// model; save is a toggle (the user keeps / un-keeps a post).

async function hasInteraction(
  clerkId: string,
  postId: number,
  kind: "view" | "save" | "share",
): Promise<{ id: number } | null> {
  const [row] = await db
    .select({ id: virtualInteractionsTable.id })
    .from(virtualInteractionsTable)
    .where(
      and(
        eq(virtualInteractionsTable.postId, postId),
        eq(virtualInteractionsTable.actorClerkId, clerkId),
        eq(virtualInteractionsTable.kind, kind),
      ),
    )
    .limit(1);
  return row ?? null;
}

// Record that the user saw a post (idempotent per user+post). Returns whether
// this was the first view (so callers can decide to recompute affinity).
export async function recordView(
  clerkId: string,
  postId: number,
): Promise<{ viewed: boolean; firstTime: boolean } | null> {
  if (!(await approvedPostExists(postId))) return null;
  const existing = await hasInteraction(clerkId, postId, "view");
  if (existing) return { viewed: true, firstTime: false };
  await db
    .insert(virtualInteractionsTable)
    .values({ postId, actorClerkId: clerkId, kind: "view" });
  return { viewed: true, firstTime: true };
}

// Toggle "saved" (bewaard) on a post.
export async function toggleSave(
  clerkId: string,
  postId: number,
): Promise<{ saved: boolean } | null> {
  if (!(await approvedPostExists(postId))) return null;
  const existing = await hasInteraction(clerkId, postId, "save");
  if (existing) {
    await db.delete(virtualInteractionsTable).where(eq(virtualInteractionsTable.id, existing.id));
    return { saved: false };
  }
  await db
    .insert(virtualInteractionsTable)
    .values({ postId, actorClerkId: clerkId, kind: "save" });
  return { saved: true };
}

// Record a share (idempotent per user+post).
export async function recordShare(
  clerkId: string,
  postId: number,
): Promise<{ shared: boolean; firstTime: boolean } | null> {
  if (!(await approvedPostExists(postId))) return null;
  const existing = await hasInteraction(clerkId, postId, "share");
  if (existing) return { shared: true, firstTime: false };
  await db
    .insert(virtualInteractionsTable)
    .values({ postId, actorClerkId: clerkId, kind: "share" });
  return { shared: true, firstTime: true };
}

// The user's saved (bewaarde) posts, newest-saved first.
export async function getSavedPosts(
  clerkId: string,
  limit = 50,
): Promise<{ items: FeedItem[] }> {
  const saved = await db
    .select({
      postId: virtualInteractionsTable.postId,
      savedAt: virtualInteractionsTable.createdAt,
    })
    .from(virtualInteractionsTable)
    .where(
      and(
        eq(virtualInteractionsTable.actorClerkId, clerkId),
        eq(virtualInteractionsTable.kind, "save"),
      ),
    )
    .orderBy(desc(virtualInteractionsTable.createdAt))
    .limit(limit);

  if (saved.length === 0) return { items: [] };
  const savedIds = saved.map((s) => s.postId);
  const savedOrder = new Map(savedIds.map((id, i) => [id, i]));

  const posts = await db
    .select({
      id: virtualPostsTable.id,
      kind: virtualPostsTable.kind,
      caption: virtualPostsTable.caption,
      mediaPath: virtualMediaTable.objectPath,
      publishedAt: virtualPostsTable.publishedAt,
      athleteId: virtualAthletesTable.id,
      slug: virtualAthletesTable.slug,
      name: virtualAthletesTable.name,
      discipline: virtualAthletesTable.discipline,
      level: virtualAthletesTable.level,
      archetype: virtualAthletesTable.archetype,
      nationality: virtualAthletesTable.nationality,
      avatarMediaId: virtualAthletesTable.avatarMediaId,
      role: virtualAthletesTable.role,
      cohort: virtualAthletesTable.cohort,
      followerScore: virtualAthletesTable.followerScore,
      influenceCategory: virtualAthletesTable.influenceCategory,
    })
    .from(virtualPostsTable)
    .innerJoin(virtualAthletesTable, eq(virtualPostsTable.athleteId, virtualAthletesTable.id))
    .leftJoin(virtualMediaTable, eq(virtualPostsTable.mediaId, virtualMediaTable.id))
    .where(
      and(
        inArray(virtualPostsTable.id, savedIds),
        eq(virtualPostsTable.validationStatus, "approved"),
      ),
    );

  const counts = await db
    .select({
      postId: virtualInteractionsTable.postId,
      kind: virtualInteractionsTable.kind,
      c: sql<number>`cast(count(*) as int)`,
    })
    .from(virtualInteractionsTable)
    .where(inArray(virtualInteractionsTable.postId, savedIds))
    .groupBy(virtualInteractionsTable.postId, virtualInteractionsTable.kind);
  const likeCount = new Map<number, number>();
  const commentCount = new Map<number, number>();
  for (const row of counts) {
    if (row.kind === "like") likeCount.set(row.postId, row.c);
    else if (row.kind === "comment") commentCount.set(row.postId, row.c);
  }

  const myLikes = await db
    .select({ postId: virtualInteractionsTable.postId })
    .from(virtualInteractionsTable)
    .where(
      and(
        eq(virtualInteractionsTable.actorClerkId, clerkId),
        eq(virtualInteractionsTable.kind, "like"),
        inArray(virtualInteractionsTable.postId, savedIds),
      ),
    );
  const likedSet = new Set(myLikes.map((l) => l.postId));

  const follows = await db
    .select({ athleteId: userVirtualFollowsTable.athleteId, favorite: userVirtualFollowsTable.favorite })
    .from(userVirtualFollowsTable)
    .where(eq(userVirtualFollowsTable.clerkId, clerkId));
  const followMap = new Map(follows.map((f) => [f.athleteId, f.favorite]));

  const avatars = await avatarMap(posts);

  const items: FeedItem[] = posts
    .map((p) => ({
      id: p.id,
      kind: p.kind,
      caption: p.caption,
      mediaUrl: mediaUrl(p.mediaPath),
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      athlete: {
        id: p.athleteId,
        slug: p.slug,
        name: p.name,
        avatarUrl: p.avatarMediaId != null ? (avatars.get(p.avatarMediaId) ?? null) : null,
        discipline: p.discipline,
        level: p.level,
        archetype: p.archetype,
        nationality: p.nationality,
        followerScore: p.followerScore ?? 0,
        influenceCategory: p.influenceCategory,
        role: p.role,
        cohort: p.cohort,
      },
      likeCount: likeCount.get(p.id) ?? 0,
      commentCount: commentCount.get(p.id) ?? 0,
      likedByMe: likedSet.has(p.id),
      isFollowing: followMap.has(p.athleteId),
      isFavorite: followMap.get(p.athleteId) ?? false,
      fictional: true as const,
    }))
    .sort((a, b) => (savedOrder.get(a.id) ?? 0) - (savedOrder.get(b.id) ?? 0));

  return { items };
}

export async function listComments(
  postId: number,
  clerkId: string,
): Promise<CommentView[]> {
  const rows = await db
    .select({
      id: virtualInteractionsTable.id,
      body: virtualInteractionsTable.body,
      actorClerkId: virtualInteractionsTable.actorClerkId,
      actorAthleteName: virtualAthletesTable.name,
      createdAt: virtualInteractionsTable.createdAt,
    })
    .from(virtualInteractionsTable)
    .leftJoin(
      virtualAthletesTable,
      eq(virtualInteractionsTable.actorAthleteId, virtualAthletesTable.id),
    )
    .where(
      and(
        eq(virtualInteractionsTable.postId, postId),
        eq(virtualInteractionsTable.kind, "comment"),
      ),
    )
    .orderBy(desc(virtualInteractionsTable.createdAt))
    .limit(100);
  return rows.map((r) => ({
    id: r.id,
    body: r.body ?? "",
    byMe: r.actorClerkId === clerkId,
    authorName: r.actorClerkId === clerkId ? "Jij" : (r.actorAthleteName ?? "Virtual Athlete"),
    createdAt: r.createdAt.toISOString(),
  }));
}
