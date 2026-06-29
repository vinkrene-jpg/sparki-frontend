// Sparki World — learned-affinity engine.
//
// The adaptive layer. A user's tastes are DERIVED only from how they behave
// INSIDE Sparki World (views/saves/shares/likes/comments/follows on fictional
// content) — NEVER from their real performance data. There is no read of the
// athlete/training tables here; the hard wall is preserved.
//
// learnAffinity(clerkId) recomputes the user_virtual_affinity table from scratch
// each time: it walks every interaction the user has on world posts, looks up
// the post's athlete attributes (discipline, archetype, role, expertise, cohort,
// level) plus the post topic (kind), and accumulates a weighted score per
// (dimension, key). Stronger signals (share > save > comment > like > view) and
// follows/favorites weigh more. Because it is a full rebuild it is idempotent
// and can always be regenerated — honest by construction.

import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  virtualAthletesTable,
  virtualPostsTable,
  virtualInteractionsTable,
  userVirtualFollowsTable,
  userVirtualAffinityTable,
} from "@workspace/db";

// Weight per interaction kind. Quieter signals count less than deliberate ones.
const KIND_WEIGHT: Record<string, number> = {
  view: 1,
  like: 2,
  comment: 3,
  save: 4,
  share: 5,
};
const FOLLOW_WEIGHT = 6;
const FAVORITE_WEIGHT = 9;

type Acc = { score: number; support: number };

function add(map: Map<string, Acc>, dimension: string, key: string | null | undefined, weight: number) {
  const k = (key ?? "").toString().trim().toLowerCase();
  if (!k) return;
  const id = `${dimension}\u0000${k}`;
  const cur = map.get(id) ?? { score: 0, support: 0 };
  cur.score += weight;
  cur.support += 1;
  map.set(id, cur);
}

export type AffinitySummary = {
  clerkId: string;
  rows: number; // distinct (dimension,key) entries written
  support: number; // total interactions that fed the model
};

// Recompute and persist a user's learned affinity. Full rebuild → idempotent.
export async function learnAffinity(clerkId: string): Promise<AffinitySummary> {
  const acc = new Map<string, Acc>();

  // 1) post interactions (view/like/comment/save/share) → athlete attributes + topic
  const interactions = await db
    .select({
      kind: virtualInteractionsTable.kind,
      postKind: virtualPostsTable.kind,
      discipline: virtualAthletesTable.discipline,
      archetype: virtualAthletesTable.archetype,
      role: virtualAthletesTable.role,
      expertise: virtualAthletesTable.expertise,
      cohort: virtualAthletesTable.cohort,
      level: virtualAthletesTable.level,
    })
    .from(virtualInteractionsTable)
    .innerJoin(virtualPostsTable, eq(virtualInteractionsTable.postId, virtualPostsTable.id))
    .innerJoin(virtualAthletesTable, eq(virtualPostsTable.athleteId, virtualAthletesTable.id))
    .where(
      and(
        eq(virtualInteractionsTable.actorClerkId, clerkId),
        inArray(virtualInteractionsTable.kind, ["view", "like", "comment", "save", "share"]),
      ),
    );

  let support = 0;
  for (const r of interactions) {
    const w = KIND_WEIGHT[r.kind] ?? 1;
    add(acc, "discipline", r.discipline, w);
    add(acc, "archetype", r.archetype, w);
    add(acc, "role", r.role, w);
    add(acc, "expertise", r.expertise, w);
    add(acc, "cohort", r.cohort, w);
    add(acc, "level", r.level, w);
    add(acc, "topic", r.postKind, w);
    support += 1;
  }

  // 2) follows / favorites → the athlete's attributes (a deliberate, strong cue)
  const follows = await db
    .select({
      favorite: userVirtualFollowsTable.favorite,
      discipline: virtualAthletesTable.discipline,
      archetype: virtualAthletesTable.archetype,
      role: virtualAthletesTable.role,
      expertise: virtualAthletesTable.expertise,
      cohort: virtualAthletesTable.cohort,
      level: virtualAthletesTable.level,
    })
    .from(userVirtualFollowsTable)
    .innerJoin(virtualAthletesTable, eq(userVirtualFollowsTable.athleteId, virtualAthletesTable.id))
    .where(eq(userVirtualFollowsTable.clerkId, clerkId));

  for (const f of follows) {
    const w = f.favorite ? FAVORITE_WEIGHT : FOLLOW_WEIGHT;
    add(acc, "discipline", f.discipline, w);
    add(acc, "archetype", f.archetype, w);
    add(acc, "role", f.role, w);
    add(acc, "expertise", f.expertise, w);
    add(acc, "cohort", f.cohort, w);
    add(acc, "level", f.level, w);
    support += 1;
  }

  // 3) replace the user's affinity rows (full rebuild keeps it regenerable)
  await db.delete(userVirtualAffinityTable).where(eq(userVirtualAffinityTable.clerkId, clerkId));

  const rows = [...acc.entries()].map(([id, v]) => {
    const [dimension, key] = id.split("\u0000");
    return { clerkId, dimension: dimension!, key: key!, score: v.score, support: v.support };
  });
  if (rows.length > 0) {
    // Upsert (not plain insert): the view endpoint fires many requests at once,
    // so several full rebuilds for the same user can overlap. A plain insert
    // races the delete+insert of a concurrent rebuild and trips the unique
    // (clerkId, dimension, key) constraint. Upsert makes overlapping rebuilds
    // converge to the same deterministic scores instead of crashing.
    await db
      .insert(userVirtualAffinityTable)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          userVirtualAffinityTable.clerkId,
          userVirtualAffinityTable.dimension,
          userVirtualAffinityTable.key,
        ],
        set: {
          score: sql`excluded.score`,
          support: sql`excluded.support`,
          updatedAt: sql`now()`,
        },
      });
  }

  return { clerkId, rows: rows.length, support };
}

// Read a user's learned affinity as a lookup the feed scorer can consume:
//   affinity.get(dimension)!.get(key) -> { score, support }
export type AffinityIndex = Map<string, Map<string, { score: number; support: number }>>;

export async function getAffinity(clerkId: string): Promise<AffinityIndex> {
  const rows = await db
    .select({
      dimension: userVirtualAffinityTable.dimension,
      key: userVirtualAffinityTable.key,
      score: userVirtualAffinityTable.score,
      support: userVirtualAffinityTable.support,
    })
    .from(userVirtualAffinityTable)
    .where(eq(userVirtualAffinityTable.clerkId, clerkId));

  const idx: AffinityIndex = new Map();
  for (const r of rows) {
    if (!idx.has(r.dimension)) idx.set(r.dimension, new Map());
    idx.get(r.dimension)!.set(r.key, { score: r.score, support: r.support });
  }
  return idx;
}
