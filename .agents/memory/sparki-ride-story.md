---
name: Sparki Rit-verhaal (Fase 1 De keten)
description: Ride story chain behind flag rit_verhaal — sync line decoupling, consequence ladder, pre-hoc prediction rule.
---

# Rit-verhaal — Fase 1 "De keten" (flag `rit_verhaal`)

- **Sync-status line (chain step 1) must render independently of the fresh story.** The NA-RIT moment block on Vandaag may only show the story card for a fresh (<18h) import that isn't health-suppressed, but the honest sync/analysis status line ("Je koppeling") must stay visible whenever there is something real to say (connection, sync run, or import). Hiding it with the story was an architect-flagged fail.
  - **Why:** users need to see "geen/gereed/mislukt" even between rides; hiding it makes sync failures invisible.
  - **How to apply:** in the moment payload, `sync` accompanies a `story: null` response; UI branches on story presence, not on payload presence.
- **Consequence ladder is deterministic:** wedstrijd > voorstel (negative feedback + real causeLine) > geen (|tss−target| within max(8, 12%)) > onbekend with honest `missing` (feedback and/or sensorgegevens). Never invent a consequence.
- **`predictionAvailable` is pre-hoc only:** a `core_predictions` row counts only when `createdAt < session.createdAt`. Predictions are NEVER constructed after the ride — chapter 2 says so plainly when none existed.
- **Chat context is server-validated:** unowned or malformed sessionContext on the input-center message route is a hard 400 before any engine call; the context block injects only real ride data and the UI shows a visible "Gaat over" chip.
- **Test gotcha:** the test seeds `connector_activities` but no `connector_connections` row, so `sync.hasConnection` is false there — assert on `lastActivity` instead. A failing assert mid-scenario skips that scenario's restore step and cascades into later scenarios.
- Workflow limit (10) is far exceeded in this project — new test suites run via shell (`pnpm --filter @workspace/api-server run test:ride-story`), sequentially (shared dist/).

## Race-day phases (racedag → verwerken → na-rit)

The moment endpoint is phase-based on a race day: `racedag` (race row on today's Amsterdam calendar, no fresh analysed ride) → `verwerken` (import arrived, analysis pending) → `na-rit` (fresh today-ride displaces the racedag block).

- **`verwerken` must be race-day-scoped at row level:** predicate = fresh import with `normalizedSessionId IS NULL` whose Amsterdam date (`startedAt` ?? `importedAt`) equals today — NOT "any fresh import + sync.analysis". A late-processed yesterday import must never read as "je wedstrijdrit is binnen".
- **Displacement only by a today-dated session** (`sessionDate === amsterdamToday()`); yesterday's fresh opener never displaces the racedag block.
- **Weather only when location AND startTime exist** on the race row; forecast resolves honestly or stays null — never invented, no generic race advice.
- **Race selection needs stable ordering** (`priority, startTime, id`) or multiple same-day races pick nondeterministically.
- **Test "today" must use the same Amsterdam-tz formatter** as the backend helper (`Intl.DateTimeFormat en-CA, Europe/Amsterdam`); server-local `getDate()` flips near midnight on non-NL hosts (architect-flagged flake).
