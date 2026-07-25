---
name: Sparki World architecture
description: Foundation of the transparently-fictional Virtual Athletes world — schema, Media Engine cache, hard walls and honesty rules.
---

# Sparki World

A living, **transparently-fictional** sport world of "Virtual Athletes", built in
parallel with V1. MVP = ~50 athletes, photos + stories, feed (follow/like/comment),
personalisation v1, validation v1. **Video is phase 2** (the `virtual_media.kind`
column already allows "video" so it slots in without a migration).

## Non-negotiable rules
- **Never disguise fiction.** Every athlete is labelled "Sparki World / Virtual
  Athlete". "Sparki World" and "Virtual Athletes" are accepted brand terms despite
  the no-"AI"/plain-Dutch rules.
- **Hard wall to real data.** Sparki World tables are a separate island; real users
  only *reference* Virtual Athletes (follows/interactions), never the reverse. No
  virtual FTP/race ever enters a real user's analysis/calendar.
- **Deterministic numbers, generated prose.** Stats must be plausible (no impossible
  feats); LLM only writes prose/personality; posts are validated before publish.
- **Honest gaps.** When media/content can't be produced, say so (null path / rejected
  status), never a placeholder posing as real.

## Schema (`lib/db/src/schema/sparki-world.ts`)
`virtual_media` (Media-Engine cache, **promptKey UNIQUE**), `virtual_athletes`
(queryable cols + `traits` jsonb long-tail), `virtual_athlete_relationships`
(friend/rival/teammate/coach/family), `virtual_events` (living-life timeline →
posts are generated from these), `virtual_posts` (validationStatus pending/approved/
rejected; only approved are shown), `virtual_interactions` (exactly one of
actorAthleteId / actorClerkId set), `user_virtual_follows` (favorite flag).

## Media Engine (`artifacts/api-server/src/engines/world-media/`)
**Reason to exist = aggressive reuse.** `buildPromptKey(purpose, attrs)` is a
deterministic, order-independent, human-readable key. `resolveMedia` is cache-first:
a `ready` row with the same key is returned untouched (no regeneration, reuseCount++);
only a miss generates. **Avatars include the athlete slug (unique per athlete);
scenes carry NO identity (shared world-wide).**
- Generation via `@workspace/integrations-gemini-ai/image` `generateImage(prompt)`
  (text→image, `gemini-2.5-flash-image`). `resolveMedia(input, deps?)` takes
  injectable `{generate, upload}` deps so tests prove caching with NO real model call.
- Storage: upload bytes to object storage (presigned PUT), set ACL
  `{owner:"sparki-world", visibility:"public"}` → any signed-in user reads it via the
  existing `GET /api/storage/objects/*` route. `mediaUrl(objectPath)` →
  `/api/storage<objectPath>`.
- Failure is honest: persists `status:"failed"` + `failureReason`, `objectPath:null`;
  a failed row is retried on next resolve, a ready row never is.
- **Why public ACL:** the world feed is shared; private owner-gated objects (photo-lab
  pattern) would be invisible to other users.

## Test wiring (api-server convention)
New tests need THREE edits: `src/tests/<name>.ts`, an entry in `build.mjs`
`entryPoints`, and a `test:<name>` script in `package.json`. Run e.g.
`pnpm --filter @workspace/api-server run test:world-media`. (Media-engine test stubs
generate/upload so it never bills the image model.)

## Feed API & interactions (`engines/world-feed`, `routes/sparki-world.ts`)
- Feed/profile read only `validationStatus:"approved"` posts; every response carries
  `fictional:true` so the frontend "gesimuleerd" label stays honest.
- Personalisation v1 ranks already-validated posts by follows (favorites weigh more),
  discipline match with the viewer's own profile, and recency — all real viewer signals.
- Real-user actions store `actorClerkId`; virtual actors store `actorAthleteId` (exactly
  one set). Walls hold: a real action never mutates a virtual athlete/post.
- **Mutation existence-guard:** follow/like/comment FK their target, so a bad/stale id
  used to FK-violate → 500. Engine helpers `athleteExists` / `approvedPostExists` make
  `setFollow`/`toggleLike`/`addComment` return `null`; routes translate that to a Dutch
  404. When you make an engine fn nullable, update `tests/world-feed.ts` guards too.

## Frontend tab (`pages/wereld.tsx`, `hooks/use-world.ts`, `lib/world-types.ts`)
- Dedicated `/wereld` route (athletes-only header `WereldButton`, Globe icon, next to
  Samen). Wired in `App.tsx` (ProtectedPage), `dev-preview.tsx` (VIEWS+location), and a
  `wereld` entry in ScreenShell SECTION_SCENE/SECTION_DISPLAY. `query-keys.world` factory.
- Page = feed cards (avatar, Virtual Athlete tag, like/comment, follow/favorite) + honest
  "Sparki World — gesimuleerd" banner + athlete drill-in with top "Terug" back button.

## Consistency harness (`tests/world-consistency.ts`, `test:world-consistency`)
- Pure (no-DB) deterministic sim, 50 athletes × 90 days. HARD INVARIANTS (population
  physiology, determinism, approved posts re-pass validation, rejected carry reason, no
  forbidden wording, relationship graph: no dangling/self, symmetry) MUST pass.
- A severity-graded believability DASHBOARD (info/warn/error) surfaces weak spots; only
  **error-level** (physically impossible) findings fail the process — warnings are report.
- Events are independent per (slug,date) with no day-to-day carry-over, so back-to-back
  races / no-rest streaks are EXPECTED weak spots the dashboard reports (not bugs).

## Adaptive world v2 (per-user) — career, followers, affinity, rails
- Schema adds to virtual_athletes: careerPhase/role/expertise/cohort/followerScore/
  influenceCategory; relationships gain strength/status/updatedAt; interactions kinds +=
  view/save/share; new `virtual_career_entries` (multi-year timeline) + `user_virtual_affinity`.
- `lib/world/career.ts` `buildCareer` = deterministic multi-year timeline (jeugd→U23→
  continentaal→prof→blessure→comeback→coach) with age-curve FTP development; pure/seeded.
- `influenceFromScore` tiers: wereldster≥250k, prof≥25k, bekend≥3k, lokaal≥300, else beginner.
- `engines/world-affinity` `learnAffinity(clerkId)` recomputes user_virtual_affinity from
  weighted view/save/share/follow signals × post→athlete attrs. **NEVER touches real perf data.**
- Adaptive feed v2: pure `scoreFeedItem`/`hasPersonalSignal` scoring (profile match, learned
  affinity, follow/fav, influence, recency); follow weighs < favorite; honest low-data fallback.
- Routes: GET /api/world/recommended (recognizable+inspiration), /heroes (top influence);
  profile += career[] + followerScore; feed athlete objects += followerScore/influenceCategory/
  role/cohort. **Profile route is `/athletes/:slug` (plural).**
- Frontend `/wereld`: Tijdlijn/Bewaard tabs, Voorgesteld+Toonaangevend rails, FollowerCount
  (null if score≤0), CareerTimeline, save/share + IntersectionObserver view tracking. Profile
  drill-in is now a REAL route `/wereld/athlete/:slug` (wouter useRoute in wereld.tsx,
  registered in App.tsx) → shareable/deep-linkable; backToWorld()→`/wereld`. Internal API
  route stays `/api/world/athletes/:slug` (plural).
- **Dev DB drift gotcha:** the `virtual_*` tables can be seeded under an OLD schema (missing
  columns on virtual_athletes + virtual_athlete_relationships; missing virtual_career_entries /
  user_virtual_affinity), making `/wereld` 500. `pnpm db push` ABORTS (wants to truncate
  relationships). Fix = apply additive DDL (ADD COLUMN IF NOT EXISTS + CREATE TABLE IF NOT
  EXISTS, match lib/db/src/schema/sparki-world.ts, add unique constraints only after verifying
  zero dups) then re-run `seed:sparki-world` — it is idempotent & fiction-only (safe to reseed,
  upserts by slug, dedupes by unique constraints). Never push-force (truncates).
- Harness `test:world-consistency` extended: follower/career determinism + tier ordering +
  timeline plausibility + validateSafety reject/accept battery + feed learning effect. 35/35.
- **Stale-bundle gotcha:** after backend engine/route edits, RESTART the api-server workflow —
  HMR only covers frontend; a stale bundle returns `Cannot GET` on new routes + drops new
  feed fields (looked like a frontend bug; was just an un-rebuilt server).

## Dev DB world-table drift recovery (durable)
- World tables are FULLY REGENERABLE (`seed:sparki-world`, deterministic seed=1). When the dev DB
  drifts behind `sparki-world.ts` (missing adaptive-layer columns / `virtual_career_entries` /
  `user_virtual_affinity`), do NOT run global `push-force` — it can truncate real user/training
  data (separate task owns global reconciliation). Instead apply NON-DESTRUCTIVE world-only DDL
  (ADD COLUMN IF NOT EXISTS with defaults, CREATE TABLE IF NOT EXISTS, dedupe-then-add unique
  constraint) then re-seed the world. Rebuild `lib/db` afterwards so tsc resolves new members.
- `test:world-affinity` is the end-to-end learning-loop guard: real view/save/share → learnAffinity
  → live feed reorders, plus two wall checks (clean-slate empty model; no real-perf table row-count
  change). Picks most-represented NON-viewer discipline to isolate learned affinity from profile-match boost.
- **Dev-DB drift gotcha (world tables):** The dev DB lagged the schema badly (missing virtual_athletes cols role/expertise/cohort/
  follower_score/influence_category/career_phase AND whole tables like user_virtual_affinity) →
  world-feed test threw `column/relation does not exist`. `db push` (even `push-force`) BLOCKS on
  an interactive TTY truncation prompt for the `virtual_athlete_relationships` unique constraint.
  Fix: `TRUNCATE virtual_athlete_relationships` (seed data) manually, then `db push` runs clean,
  then re-seed with `seed:sparki-world`. World tables are all deterministically re-seedable, so
  truncate+reseed is safe and recoverable.

## Affinity rebuild must be conflict-tolerant (view endpoint fans out)
- `learnAffinity(clerkId)` is a delete-all-then-insert full rebuild of `user_virtual_affinity`.
  The world feed fires one `POST /api/world/posts/:id/view` per visible post AT ONCE, so many
  rebuilds for the SAME user overlap and a plain `insert` races on unique
  `(clerkId,dimension,key)` → 500. **The insert MUST be `onConflictDoUpdate`** (target those 3
  cols, set score/support/updatedAt from `excluded`) so overlapping rebuilds converge instead of
  crashing. **Why:** values are a deterministic recompute, so last-writer-wins is correct; upsert
  only removes the crash. Residual (non-blocking) caveat: the delete→write pair is still un-locked,
  so a concurrent reader can briefly see an empty/stale model — add a per-clerkId advisory lock only
  if strict read-consistency is ever required.
- **Population/avatar scale:** seed count is parameterised (`seed:sparki-world --count=`, default 200;
  + ~15 fixtures). Avatars are generated by the cache-first Media Engine (~3–13s each); detached
  background jobs get reaped by the sandbox, so backfill in FOREGROUND chunks (`backfill:avatars`,
  resumable via `avatar_media_id IS NULL`, bounded concurrency ~8). Scenes are shared/cache-first so
  cheap; `sim:world-day --images` is idempotent per date (already-simulated athletes skipped) and not
  everyone posts every day (a full run leaves many athletes with no event that day — realistic, honest).

## Feed presentation = TikTok/Instagram reel (`components/sparki/world-reel.tsx`)
- The `/wereld` "Tijdlijn" + "Bewaard" tabs render a full-screen VERTICAL scroll-snap reel
  (`snap-y snap-mandatory overscroll-contain`), one post per viewport — not a stacked card list.
  Discovery rails (Voorgesteld/Toonaangevend) moved to their own "Ontdek" tab so the reel stays
  immersive. `PostCard` (the old card) survives only on the athlete profile drill-in.
- **Honesty moved onto each slide:** the single top "gesimuleerd" banner is gone from the reel —
  EVERY slide carries a "Virtual Athlete · gesimuleerd" marker so fiction is unmissable while
  swiping. Text-only posts (no `mediaUrl`) NEVER fabricate an image: they render a deterministic
  on-brand gradient (`textGradient(post.id)`) with the caption as a centered hero.
- **Layering:** bottom nav is `fixed z-50`; reel action rail/meta must be lifted clear of it
  (`bottom-32` rail, `pb-28` meta) or they hide behind the nav (looks like "buttons missing").
  Comments are a body-`createPortal` bottom sheet at `z-[80]` (above nav) with dialog semantics.
- **Gotcha — no `savedByMe` field:** `WorldPost` carries no per-post saved flag, so a slide's
  bookmark state can't be derived from the feed. The "Bewaard" tab passes `initialSaved` to seed
  it true (every item there IS saved); elsewhere it honestly defaults false. Like/comment show real
  counts; save/share have no count data so they show none (don't fabricate a number).

## Video highlights (phase 2 — looping clips)
- `virtual_media.kind="video"` already existed → NO migration. Highlight clips associate by a
  deterministic `promptKey` (`highlightKeyFor(slug)`), NOT a new column. `resolveMedia` branches
  on kind: video→`generateVideo` (Veo, `@workspace/integrations-gemini-ai/video`, 16:9 dur6,
  bounded poll ≤5min, videoBytes-or-uri), else `generateImage`. Cache-first + honest failed/null
  path identical to images.
- `getOrCreateHighlight(slug)` + `readyHighlightUrls(slugs)` (slug→url map, ONLY ready rows with
  objectPath). world-feed adds `highlightUrl: string|null` to athlete/suggested views (heroes,
  recommended, profile). Frontend `HighlightClip` (autoplay/loop/muted/playsInline) shows clip
  when present, else falls back to avatar — never a fabricated placeholder.
- Clips are opt-in: `world:highlights` script backfills hero athletes only (role inspiration /
  influence wereldster|prof). If the Gemini proxy lacks Veo, generation throws → failed row → UI
  shows avatar fallback (honesty contract holds). No clips exist until the script is run.

## Off-bike visual variety (lifestyle/recovery/nutrition/rest photos)
- To make the feed feel alive (activities/environment/variety), more REAL off-bike moments
  become `photo` posts: recovery→`recovery_home`, nutrition→`cooking`/`groceries`,
  rest→~50% lifestyle (cafe/grandparents/bakery), plus a richer lifestyle pool & higher freq.
  Honesty holds because a plausible everyday photo is not a fabricated metric/claim.
- **Coupling trap:** giving an event type a `photo` kind in `buildPost` ALSO requires adding
  `photo` to that event's `ALLOWED_KINDS` in `lib/world/validation.ts`, or `runWorldDay`
  rejects the post pre-persist. `backfill-world-photos` BYPASSES validation (it only sets
  media_id on already-approved rows), so a backfill can "succeed" while fresh sims silently
  reject — verify both paths. The `photo ⇒ scene` guard in validation keeps it honest.

## Empty prod World after publish — copy-seed, never regenerate
- Publishing copies the DB *schema*, not its *content* → a freshly published database shows the honest empty World ("nog geen renners"), even though dev is full.
- **Why no regen is needed:** object storage (App Storage bucket) is SHARED between dev and the deployment, so every `object_path` stays valid once the rows are copied. Regenerating would be paid image generation for no reason.
- **Why it must run in-app:** the agent's prod access is READ-ONLY; the only writer to the prod DB is the deployed runtime. So the seed has to run inside the app on boot (or as an explicit `seed:world-copy` release step) — and it only takes effect after a re-publish.
- Copy engine `ensureWorldSeed` (lib/world-seed.ts, bundled dev export at scripts/data/world-seed.json): empty-guard + transaction advisory-lock + FK-ordered inserts + `ON CONFLICT (id) DO NOTHING` + `setval` sequence repair. Excludes real-user rows: user_virtual_follows, user_virtual_affinity, and virtual_interactions with a non-null actor_clerk_id (they FK to users absent in a fresh prod DB).
- **How to apply:** to seed any per-instance/empty prod table from dev without paid work, confirm the referenced blob storage is env-shared, then copy rows — don't re-run the generator.
- **Switched off (juli 2026, user: "mag helemaal uitgezet worden"):** all user-facing entry points removed (samen WereldLink+WorldSocialSection, feed "Renners" tab+WorldReel, /wereld routes, chapters, zoekregister, dev-preview). Per afbouwregels backend /world+/world-social routers, ensureWorldSeed, DB data and wereld.tsx (unrouted) are KEPT — uitzetten ≠ verwijderen. Re-enabling = re-wiring entry points only.
