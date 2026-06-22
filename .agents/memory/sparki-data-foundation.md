---
name: Sparki AI Memory & Core Data Foundation sprint
description: Durable decisions/conventions from the 10-phase foundation sprint (AI memory, privacy, coach/parent, nutrition, GPX, notifications, admin/bug-reports).
---

# Sparki AI Memory & Core Data Foundation

10-phase foundation sprint turning Sparki from a shell into a durable AI platform.

## Durable decisions (apply to all new tables/routes)
- **Identity = `clerkId`** (text FK → `user_profiles.clerkId`). Spec said `athlete_id`;
  we deliberately reuse `clerkId` everywhere instead of a numeric athlete id.
  **Why:** avoid duplicating identity / a second id space.
- **AI persistence is privacy-gated.** When `privacy_settings.ai_memory_enabled=false`,
  do NOT persist observations (only `system` source is exempt). Briefings still
  generate; they just aren't stored.
- **Observation dedup** via `dedupe_key`: skip insert if an active row
  (status in new/acknowledged/saved) with same `(clerkId, dedupe_key)` exists.
- **No fake AI / no fake data.** Heuristics labelled as rule-based; parsers return
  null/failed rather than inventing numbers; placeholders marked honestly.

## api-server route conventions (gotchas that bit us)
- **No zod in api-server routes** — `zod/v4` is unresolvable here; validate manually.
- **Express 5 `req.params`** is typed `string | string[]` → wrap with `String()` before
  `Number()`.
- **`noImplicitReturns` is ON** → never `return res.json(...)`; send then bare `return;`.
- **drizzle node-postgres `db.execute(sql\`...\`)` returns a `QueryResult`** → read
  `result.rows[0]`, it is NOT an array you can destructure with `[row]`.
- **Admin gating**: `isAdmin(clerkId)` reads `SPARKI_ADMIN_IDS` (comma-separated clerkIds
  in Secrets). Copy the `requireAdmin` middleware pattern from `routes/flags.ts`.
  Frontend `/api/admin/whoami` is for conditional render only; server is the real guard.
- After update-by-id, check `if (!row)` → return 404 (else returns 200 with undefined).

## Foundation-only / not yet wired (for roadmap honesty)
- Notifications: `race_reminder` & `missing_log` triggers need a scheduler/cron — NOT wired.
- Activity imports: only GPX is parsed (regex, haversine, elevation). FIT/TCX/CSV are
  stored with `uploaded` placeholder status (FIT needs a binary decoder + object storage).
- Bug-report screenshot is a free-text URL (no upload pipeline yet).

## Where the honest audit lives
- `docs/sparki-technical-roadmap.md` — real/placeholder/mock classification, debt, next 15.
