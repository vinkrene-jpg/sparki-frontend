# Sparki Engine Architecture

Sparki is **engine-first**. All domain logic lives behind eight engines, each a
single typed public interface in `artifacts/api-server/src/engines/<engine>/`.
Routes are thin HTTP adapters: they authenticate, parse/validate input, call one
or more engine entry points, and shape the response. **Routes never import a
domain helper from `lib/` directly** — they go through the engine.

This document is the contract. It describes each engine's responsibility, its
inputs/outputs, which engines it depends on, and the tables it owns.

## Why engines

The same logic already existed, scattered across `routes/` and `lib/`, so the app
read as "loose screens". The engine layer gives each domain one boundary: a place
to call into, a place to test, and a place to evolve without touching HTTP code.
The underlying implementations still live in `lib/` (and inline route logic that
was extracted, e.g. zone/load math); the engine `index.ts` is the curated facade
that re-exports the public surface. Internal `lib`→`lib` calls are an engine's
private implementation detail; only cross-domain calls are expected to flow
through engine interfaces.

## Dependency diagram

**Athlete Profile is the hub.** Every other engine reads the athlete's profile
(identity, FTP, weight, goals, availability, home location). Arrows point from a
dependent engine to the engine it reads.

```
                         ┌──────────────────┐
                         │  Athlete Profile │  (hub: identity, zones, FTP,
                         │      (hub)       │   weight, goals, availability)
                         └──────────────────┘
                          ▲   ▲   ▲   ▲   ▲
            ┌─────────────┘   │   │   │   └─────────────┐
            │        ┌────────┘   │   └────────┐        │
            │        │            │            │        │
   ┌────────┴───┐ ┌──┴───────┐ ┌──┴──────┐ ┌───┴─────┐ ┌┴──────────┐
   │ Onboarding │ │ Recovery │ │Training │ │  Route  │ │Integration│
   │            │ │  & Load  │ │  Plan   │ │         │ │           │
   └────────────┘ └────┬─────┘ └──┬───┬──┘ └────┬────┘ └─────┬─────┘
         │             │          │   │         │            │
         │ first plan  │readiness │   │ routes  │            │ imports profile +
         └────────────►│  /load   │   └────────►│            │ activities/metrics
                       └─────────►│             │            │
                                  │             ▼            ▼
                            ┌─────┴──────┐   (writes Profile / Recovery&Load data)
                            │  Coaching  │
                            │            │◄──── Knowledge (retrieval-augmented
                            └────────────┘       coaching)
```

Edges in words:
- **Onboarding** → Profile (writes profile fields), → Training Plan (triggers the
  first plan once core data is present).
- **Recovery & Load** → Profile (needs FTP/weight context); read by Training Plan
  (adaptation) and Coaching (readiness in briefs/coach views).
- **Training Plan** → Profile, Recovery & Load (readiness/load), Route (attach
  generated routes to workouts).
- **Coaching** → Profile, Recovery & Load, Knowledge (literature/news for
  retrieval-augmented coaching).
- **Route** → Profile (home location, discipline/bike preferences).
- **Integration** → writes into Profile / Recovery & Load data (imported profile
  fields, activities, metrics) via per-user OAuth (see below).
- **Knowledge** is a near-leaf: it serves retrieval to Coaching and the feed and
  is fed by the admin scan job.

## The eight engines

### 1. Athlete Profile — `engines/profile` (the hub)
- **Responsibility:** the athlete's identity/profile record and the training data
  derived from it. The canonical read of FTP, weight, goals, availability, home.
- **Entry points:** `computeZones(ftp)` — derive the 6 power zones (pure). Profile
  read/update HTTP shapes live in `routes/athlete.ts` and call this engine for
  derived zones.
- **Depends on:** nothing (hub).
- **Owns tables:** `user_profiles`, `athlete_profiles`, `ftp_history`.

### 2. Onboarding — `engines/onboarding`
- **Responsibility:** onboarding state — adaptive core-question selection, fact
  parsing, quick-start baseline estimates, and the "what's still missing before a
  first plan" gate.
- **Entry points:** `getMissingOnboardingData`, `selectNextQuestions`, `getFact`,
  `parseFactAnswer`, `estimateWeeklyHours`, `estimateFtp`, `defaultAvailableDays`,
  `ageFromBirthYear`, plus `EXPERIENCE_LEVELS` and onboarding types.
- **Depends on:** Profile (reads profile to compute what's missing / writes
  profile fields), Training Plan (first plan once complete).
- **Owns tables:** `onboarding_state`.

### 3. Training Plan — `engines/training-plan`
- **Responsibility:** plan generation, preview/skeleton building, adaptation, and
  roll-forward of provisional weeks.
- **Entry points:** `gatherInputs`, `checkCompleteness`, `buildSkeleton`,
  `generatePlan`, `adaptPlan`, `maybeRollForward`, `autoAdaptPlan`,
  `generateThreeWeekPlan`, plus plan types.
- **Depends on:** Profile, Recovery & Load (readiness/load), Route (attach routes).
- **Owns tables:** `planned_workouts`, `training_plans` (plan horizon/skeleton).

### 4. Coaching — `engines/coaching`
- **Responsibility:** Sparki's coaching memory (observations + preferences that
  shape Sparki's voice) and the coach/parent sharing-access relationships. Frames
  everything as "Sparki" — the term "AI" never appears in user-facing copy.
- **Entry points:** `persistObservation`, `recordMemoryEvent`,
  `getActiveObservations`, `getContextObservations`,
  `formatObservationsForPrompt`, `extractObservations`, `getPreferences`,
  `styleDirective`; sharing access: `hasAcceptedCoachLink`,
  `hasAcceptedParentLink`, `coachSharingLevel`, `parentSharingLevel`,
  `getEffectiveParentConsent`, `hasRole`.
- **Depends on:** Profile, Recovery & Load (readiness), Knowledge (retrieval).
- **Owns tables:** `ai_observations`, `ai_preferences`, `ai_memory_events`,
  `coach_athlete_links`, `parent_athlete_links` (sharing relationships).

### 5. Route — `engines/route`
- **Responsibility:** real-world route generation (OpenRouteService), routing-
  profile selection, GPX parsing/summarising of uploads, the short-lived
  candidate store, and attaching generated routes to planned workouts.
- **Entry points:** `getRoutingProvider`, `selectRoutingProfile`,
  `profileToSurface`, `profileCruisingSpeedKmh`, `activityLabel`,
  `isCyclingProfile`, `parseGpx`, `parseGpxRoute`, `summarizeTrack`,
  `putCandidate`, `getCandidate`, `disciplineToBike`, `estimateDistanceKm`,
  `generateAndSavePlanRoute`, `attachRouteToWorkout`, plus routing types and the
  `sports`/`bikeTypes`/`elevationPreferences` enums.
- **Depends on:** Profile (home location, discipline/bike), Training Plan
  (workout to attach a route to).
- **Owns tables:** `routes` (saved/generated routes, path points).

### 6. Recovery & Load — `engines/recovery-load`
- **Responsibility:** the load model (CTL/ATL/TSB from training stress) and the
  daily readiness signal from morning check-ins.
- **Entry points:** `computeLoad(sessions)` (pure CTL/ATL/TSB), `computeReadiness`
  (pure), plus the `Readiness` type.
- **Depends on:** Profile.
- **Owns tables:** `athlete_daily_metrics`, `training_sessions` (TSS history),
  `workout_feedback`.

### 7. Knowledge — `engines/knowledge`
- **Responsibility:** retrieval of coaching literature/news for retrieval-
  augmented coaching and the personalised news feed, plus the admin library
  scan/ingest.
- **Entry points:** `getRelevantKnowledge`, `getPersonalizedNews`,
  `formatKnowledgeForPrompt`, `runKnowledgeScan`, `knowledgeCount`, plus
  knowledge types.
- **Depends on:** nothing at read time (Profile keywords are passed in by the
  caller). Fed by the `knowledge-scan` job.
- **Owns tables:** `knowledge_items`.

### 8. Integration — `engines/integration`
- **Responsibility:** the connector registry (which platforms exist, what each can
  provide, whether it is wireable today) and the per-provider sync
  implementations.
- **Entry points:** `connectorRegistry`, `getConnectorDefinition`,
  `isConnectorAvailable`, `syncStrava`, plus connector types and
  `ProviderSyncResult`.
- **Depends on:** writes imported data into Profile (`athlete_profiles`,
  `ftp_history`) and Recovery & Load (`training_sessions`,
  `athlete_daily_metrics`).
- **Owns tables:** `connector_connections` (per-user tokens + connection state).

## Data-model overview (table ownership)

Each product table has exactly one owning engine. Other engines read through the
owner's entry points rather than querying directly.

| Engine            | Owns                                                                 |
| ----------------- | ------------------------------------------------------------------- |
| Athlete Profile   | `user_profiles`, `athlete_profiles`, `ftp_history`                  |
| Onboarding        | `onboarding_state`                                                  |
| Training Plan     | `planned_workouts`, `training_plans`                               |
| Coaching          | `ai_observations`, `ai_preferences`, `ai_memory_events`, `coach_athlete_links`, `parent_athlete_links` |
| Route             | `routes`                                                            |
| Recovery & Load   | `athlete_daily_metrics`, `training_sessions`, `workout_feedback`    |
| Knowledge         | `knowledge_items`                                                   |
| Integration       | `connector_connections`                                            |

Cross-cutting tables not owned by a single engine (used as infrastructure by
many): `feature_flags` / overrides, `privacy_settings`, `notifications`,
`activity_imports`, `nutrition_logs`, `invitations`, `bug_reports`, `races`.
These are served by their own `lib/` helpers and routes and are intentionally
**not** part of the eight engines.

`clerkId` (text, FK → `user_profiles.clerkId`) is the identity key used across
every engine. There is no separate numeric athlete id.

## Design decision: Integration uses per-user OAuth

Third-party data (Strava, Garmin, …) is **per-athlete** data. Replit integration
connectors are bound at the **Replit account/workspace level**, not per end-user:
the credential proxy returns the *developer's* connected account. In a multi-
tenant app (each athlete has their own Clerk account), sourcing a per-user import
from the account-level connector would import one bound account's data into *any*
authenticated user — cross-user data contamination.

Therefore the Integration engine imports via **per-user OAuth**: app-level client
id/secret stored as secrets, each athlete authorises individually, and tokens are
stored **per `clerkId` in `connector_connections`** (`accessToken`,
`refreshToken`, `tokenExpiresAt`, `externalUserId`). `/sync` only runs when a
connected row with tokens exists for the requesting `clerkId`. The account-level
connector is appropriate only for single-tenant/admin data, never per-end-user
data. (The full per-user OAuth flow is built in the engines implementation task;
this layer fixes the contract.)

## Test plan & harness

`src/tests/smoke.ts` (run via `pnpm --filter @workspace/api-server run
test:smoke`) is a smoke harness that exercises **every engine's public entry
points through the engine interface**, proving the boundary is real and reachable.

- **Pure-function checks** (always run, no DB): `computeZones`, `computeLoad`,
  `computeReadiness`, `styleDirective` + `formatObservationsForPrompt`,
  `selectRoutingProfile` + `profileToSurface`, `estimateFtp`, and the connector
  registry.
- **Read-only DB-bound checks** (against a seeded dev user — first
  `user_profiles` row, or `DEV_AUTH_CLERK_ID` when set): `gatherInputs` +
  `checkCompleteness` + `buildSkeleton`, `getMissingOnboardingData`,
  `selectNextQuestions`, coaching observations + preferences,
  `getRelevantKnowledge`, `getPersonalizedNews`, `knowledgeCount`.

The harness never mutates data (generate/adapt/sync are out of smoke scope and
exercised in feature tests). When no seeded user exists, DB-bound checks are
**skipped, not failed**, so the harness runs on a fresh database. It exits
non-zero on any failure. Requires `DATABASE_URL`.

**Test plan going forward:** as each engine gains real capability (the engines
implementation task), add behavioural tests per entry point (correct numbers for
load/zones, plan adapts to readiness, route generation returns real-or-absent
geometry, retrieval relevance guards). The smoke harness stays as the fast "is
the boundary intact" check.
