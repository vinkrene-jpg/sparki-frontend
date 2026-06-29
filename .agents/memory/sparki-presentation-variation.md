---
name: Sparki presentation variation (fresh-feeling visit)
description: How Sparki makes each app-open feel fresh (varied order + a different real insight leading) without ever changing the real numbers.
---

# Presentation variation — "veel variatie" per app-open

The athlete wanted every login to feel fresh: different wording, a different
order, and a different REAL insight/data-point surfaced — across analyses AND
feeds. The rule that makes this safe and honest:

**Only PRESENTATION rotates. Numbers, conclusions, and persistence never change.**

## The seed (per app-open, not per request)
- Frontend mints one `SESSION_ID` per full app load (login/reload), stable for
  the visit, sent on every call via the `X-Sparki-Session` header.
- Backend `lib/variation.ts#sessionSeed(req)` hashes that header; **falls back to
  the calendar day** when absent, so server-side callers (jobs/reminders) still
  rotate day-to-day but stay stable within a day.
- **Why per-open, not per-request:** order must be stable while you use the app
  (re-fetches/refocus must not reshuffle under you), but fresh next visit.

## Honesty guardrails (the whole point)
- **Never demote urgent/important below info.** Rotation is *within* a severity
  tier only (`rotateWithinGroups` with order `["urgent","important","info"]`).
  A different urgent may lead, but an info item can never jump above an urgent.
- **Wording was already fresh:** `POST /api/ai/brief` always regenerates LLM
  prose; the daily `dedupeKey` only writes to memory, it does NOT short-circuit
  the response. React Query's in-memory cache is empty on a fresh open → refetch.
  So do NOT add a "vary the wording" layer — it already varies.
- Feeds use `windowedReorder` (bounded window) so relevance/recency ranking is
  preserved — items never move far, the order just feels fresh.
- Circle feed keeps `follow_up` items pinned on top (rotated among themselves);
  only the rest is windowed.

## Seed-0 = no-op (keeps tests + jobs byte-stable)
- `composeCoachAnalysis` applies rotation **only when `opts.variationSeed` is
  truthy**. Tests and `reminders/build.ts` pass no seed → identical legacy order.
- `seededRotate(arr, 0)` → offset 0 → unchanged.

## Gotcha — rotateWithinGroups regroups
`rotateWithinGroups` re-buckets by severity FIRST, then rotates within each
bucket. So for a seeded request the lead becomes "severity-first" rather than the
raw incoming order. This is intentional (urgent must lead) but IS a behavior
change vs prior newest-first; keep it gated behind a real seed.

**How to apply:** any new "surface a real item" list that should feel fresh per
visit goes through `lib/variation.ts` at the route/compose layer — reorder only,
honesty-tiered, seed-0 no-op. Never let it touch the data itself.
