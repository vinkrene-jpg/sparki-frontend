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
