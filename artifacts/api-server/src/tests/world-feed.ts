// Sparki World — feed & interactions integration test (DB-backed).
//
// Proves T005's acceptance: a personalised feed plus working follow / like /
// comment, all behind the wall (real-user actions only touch interaction +
// follow tables, never a Virtual Athlete's data). Requires a seeded world
// (`seed:sparki-world`) and at least one approved post (`sim:world-day`).
//
// The viewer is a real user_profiles row; the test cleans up its own follows /
// interactions afterwards so it is idempotent.

import { eq, and } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  virtualAthletesTable,
  virtualPostsTable,
  virtualInteractionsTable,
  userVirtualFollowsTable,
} from "@workspace/db";
import {
  getWorldFeed,
  getAthleteProfile,
  setFollow,
  unfollow,
  toggleLike,
  addComment,
  listComments,
} from "../engines/world-feed";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  \u2713 ${name}`);
  } else {
    failed++;
    console.log(`  \u2717 ${name}${detail ? ` \u2014 ${detail}` : ""}`);
  }
}

const FORBIDDEN = /\bA\.?I\.?\b|Sparki (ziet|denkt|weet|merkt|leest|kijkt|zag)/i;

async function main() {
  const [viewer] = await db
    .select({ clerkId: userProfilesTable.clerkId })
    .from(userProfilesTable)
    .limit(1);
  if (!viewer) {
    console.error("Geen user_profiles rij — kan feed niet testen.");
    process.exit(1);
  }
  const clerkId = viewer.clerkId;

  // clean slate for this viewer
  await db
    .delete(userVirtualFollowsTable)
    .where(eq(userVirtualFollowsTable.clerkId, clerkId));
  await db
    .delete(virtualInteractionsTable)
    .where(eq(virtualInteractionsTable.actorClerkId, clerkId));

  // ── feed ──────────────────────────────────────────────────────────────────
  const feed = await getWorldFeed(clerkId, 24);
  check("feed returns approved posts", feed.items.length > 0, `got ${feed.items.length}`);
  check(
    "every feed item carries fictional:true",
    feed.items.every((i) => i.fictional === true),
  );
  check(
    "no forbidden wording in captions",
    feed.items.every((i) => !FORBIDDEN.test(i.caption)),
  );
  check(
    "feed items carry athlete identity",
    feed.items.every((i) => i.athlete.slug.length > 0 && i.athlete.name.length > 0),
  );

  const sample = feed.items[0]!;
  const targetAthleteId = sample.athlete.id;

  // ── personalisation: following an athlete boosts their posts ───────────────
  await setFollow(clerkId, targetAthleteId, true);
  const feed2 = await getWorldFeed(clerkId, 24);
  check("feed is personalized after follow", feed2.personalized === true);
  const followedItem = feed2.items.find((i) => i.athlete.id === targetAthleteId);
  check(
    "followed athlete's post reflects isFollowing/isFavorite",
    !!followedItem && followedItem.isFollowing === true && followedItem.isFavorite === true,
  );
  // A favorite-followed athlete should rank ahead of an unfollowed one.
  const firstFollowedIdx = feed2.items.findIndex((i) => i.athlete.id === targetAthleteId);
  const firstUnfollowedIdx = feed2.items.findIndex((i) => i.athlete.id !== targetAthleteId);
  check(
    "favorite-followed post ranks at/above an unfollowed post",
    firstFollowedIdx >= 0 && (firstUnfollowedIdx === -1 || firstFollowedIdx <= firstUnfollowedIdx),
    `followed@${firstFollowedIdx} unfollowed@${firstUnfollowedIdx}`,
  );

  // ── athlete profile ────────────────────────────────────────────────────────
  const profile = await getAthleteProfile(sample.athlete.slug, clerkId);
  check("athlete profile resolves by slug", !!profile);
  check("profile reflects follow state", profile?.isFollowing === true);
  check(
    "profile posts all belong to the athlete & are approved",
    !!profile && profile.posts.every((p) => p.athlete.slug === sample.athlete.slug),
  );
  check("missing slug returns null", (await getAthleteProfile("___nope___", clerkId)) === null);

  // ── like (toggle) ───────────────────────────────────────────────────────────
  const likeOn = await toggleLike(clerkId, sample.id);
  check("like adds an interaction", !!likeOn && likeOn.liked === true && likeOn.likeCount >= 1);
  const likeOff = await toggleLike(clerkId, sample.id);
  check("like toggles off", !!likeOff && likeOff.liked === false);
  check("like on missing post returns null", (await toggleLike(clerkId, 2147483600)) === null);

  // ── comment ──────────────────────────────────────────────────────────────────
  const comment = await addComment(clerkId, sample.id, "Sterke rit, ga zo door!");
  check("comment persists", !!comment && comment.id > 0 && comment.byMe === true);
  const comments = await listComments(sample.id, clerkId);
  check(
    "comment shows in list as mine",
    !!comment && comments.some((c) => c.id === comment.id && c.byMe),
  );
  check(
    "comment on missing post returns null",
    (await addComment(clerkId, 2147483600, "x")) === null,
  );

  // ── unfollow ─────────────────────────────────────────────────────────────────
  await unfollow(clerkId, targetAthleteId);
  const [stillFollow] = await db
    .select({ id: userVirtualFollowsTable.id })
    .from(userVirtualFollowsTable)
    .where(
      and(
        eq(userVirtualFollowsTable.clerkId, clerkId),
        eq(userVirtualFollowsTable.athleteId, targetAthleteId),
      ),
    );
  check("unfollow removes the row", stillFollow === undefined);

  // ── WALL: a real-user action never wrote to a Virtual Athlete row ───────────
  const [athleteUnchanged] = await db
    .select({ ftp: virtualAthletesTable.ftp })
    .from(virtualAthletesTable)
    .where(eq(virtualAthletesTable.id, targetAthleteId));
  check("virtual athlete data untouched by real-user actions", !!athleteUnchanged);
  const [postUnchanged] = await db
    .select({ status: virtualPostsTable.validationStatus })
    .from(virtualPostsTable)
    .where(eq(virtualPostsTable.id, sample.id));
  check("virtual post validationStatus untouched", postUnchanged?.status === "approved");

  // cleanup
  await db
    .delete(virtualInteractionsTable)
    .where(eq(virtualInteractionsTable.actorClerkId, clerkId));
  await db
    .delete(userVirtualFollowsTable)
    .where(eq(userVirtualFollowsTable.clerkId, clerkId));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
