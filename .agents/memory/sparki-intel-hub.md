---
name: Sparki Performance Intelligence Hub
description: The /kennis "Voor jou" intel module — schema, engine, personalization, and the flag-gating + route-ordering rules that bite.
---

# Performance Intelligence Hub ("Voor jou" tab of /kennis)

Real, DB-backed, interactive cycling-knowledge module. Five card kinds:
`myth_buster` (quiz, verdict revealed only after answer), `trend`, `gear_compare`
(no-winner comparison, null specs render "—"), `academy` (tiered depth), `debate`.

## Durable rules / gotchas

- **Gated by the shared `knowledge_base` flag** (same gate as the research
  Bibliotheek). Per the flag system, a flag with **no DB row** stays false even
  for head-testers — so the whole Kennis surface is invisible until a
  `feature_flags` row exists. Enabling it is a **release decision**, not part of
  building the feature; don't silently flip it globally as scope creep.
- **Route ordering in `routes/intel.ts`**: the feed lives at **root `/`** (not
  `/feed`); `/meta` and `/` must be declared before `/:id`, or literal paths get
  parsed as an `:id` and 400 with "Invalid id".
- **Flag mutations must verify the card exists+published before upserting the
  interaction row.** Without the guard a bogus `cardId` hits the FK constraint and
  surfaces as a 500; the engine returns `null` → route maps to 404.
- **Personalization is deterministic & honest** (`engines/intel/personalize.ts`):
  every "voor jou" reason cites a real matched signal (discipline / topic interest
  from goals+selfType+engagement / level); generic cards get an explicit
  non-personalised reason, never a fabricated personal connection. Topic keyword
  matching uses **word boundaries** (`\bfiets\b`) so "transportfiets" ≠ "fiets".
- **`ctx.simplify`** (youth <16 or true beginner/unknown level) must actually bias
  ranking — boost beginner/all-level cards, downrank advanced/elite-only — bounded
  so it never overrides a real discipline/topic/level match. (Computing it without
  using it was flagged as an incomplete "depth personalization".)

- **Content source is the curated `scripts/seed-intel.ts` ONLY** — no
  auto-generation/ingestion. An empty topic *filter* (e.g. mentaal, slaap,
  aerodynamica) is honest thin-seed coverage, NOT a bug; the feed never zero-filters
  the base "Alles + Alle onderwerpen" view. Keep ≥2 real, sourced cards per
  `intelTopic` or that topic's filter shows the empty state. Cards must stay honest:
  qualitative/ranges over fabricated precise specs, `null`→"—", `sourceLabel` always.

## Test/build path

- After schema change: `pnpm --filter @workspace/db run build`.
- api-server esbuild needs `scripts/seed-intel.ts` + `tests/intel.ts` entries in
  `build.mjs`; run seed `node dist/scripts/seed-intel.mjs`, test
  `node dist/tests/intel.mjs`. Seed is idempotent via `dedupeKey`.
