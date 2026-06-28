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
