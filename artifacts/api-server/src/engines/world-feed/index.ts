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
  userVirtualFollowsTable,
} from "@workspace/db";
import { mediaUrl } from "../world-media";

const FEED_POOL = 200; // recent approved posts considered before ranking

export type FeedAthlete = {
  id: number;
  slug: string;
  name: string;
  avatarUrl: string | null;
  discipline: string | null;
  level: string | null;
  archetype: string | null;
  nationality: string | null;
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

  const avatars = await avatarMap(posts);

  // 4) score + rank
  const now = Date.now();
  const scored = posts.map((p) => {
    const ageHrs = p.publishedAt ? (now - new Date(p.publishedAt).getTime()) / 3.6e6 : 9999;
    let score = Math.max(0, 100 - ageHrs); // recency
    const fav = followMap.get(p.athleteId);
    if (fav !== undefined) score += fav ? 60 : 35; // followed / favorite
    if (myDiscipline && p.discipline && myDiscipline.includes(p.discipline.toLowerCase()))
      score += 20; // discipline match
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score || (b.p.publishedAt?.getTime?.() ?? 0) - (a.p.publishedAt?.getTime?.() ?? 0));

  const items: FeedItem[] = scored.slice(0, limit).map(({ p }) => ({
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
    },
    likeCount: likeCount.get(p.id) ?? 0,
    commentCount: commentCount.get(p.id) ?? 0,
    likedByMe: likedSet.has(p.id),
    isFollowing: followMap.has(p.athleteId),
    isFavorite: followMap.get(p.athleteId) ?? false,
    fictional: true,
  }));

  return { items, personalized: followMap.size > 0 || myDiscipline.length > 0 };
}

export type AthleteProfileView = {
  athlete: FeedAthlete & {
    age: number | null;
    city: string | null;
    team: string | null;
    bio: string | null;
    ftp: number | null;
    traits: Record<string, unknown> | null;
  };
  relationships: { kind: string; name: string; slug: string }[];
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
  const athleteView = {
    id: a.id,
    slug: a.slug,
    name: a.name,
    avatarUrl,
    discipline: a.discipline,
    level: a.level,
    archetype: a.archetype,
    nationality: a.nationality,
    age: a.age,
    city: a.city,
    team: a.team,
    bio: a.bio,
    ftp: a.ftp,
    traits: a.traits ?? null,
  };

  return {
    athlete: athleteView,
    relationships: rels,
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
