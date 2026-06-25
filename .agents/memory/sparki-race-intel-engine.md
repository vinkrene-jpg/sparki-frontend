---
name: Sparki central Race Intelligence Engine
description: Source-agnostic race-context field model, raceType auto-enrich rules, read-only-GET contract, permanent honest gaps.
---

# Central Race Intelligence Engine

A generic intelligence layer over a single Race (NOT a "smart races page"): one
source-agnostic context object that other domains (Routes/Health/Strava/Garmin/
Agenda) can later feed the exact same shape. Distinct from the older deterministic
`sparki-race-intel.md` (prep/report/fuel/checklist) — this is the field-model layer
that wraps it.

## Field model
Every signal is a `RaceContextField {key, label, status, value, origin, explanation?, confidence?, question?}`:
- `found` — straight from a real source (race record / forecast / route)
- `derived` — transparent arithmetic, always carries `explanation` + `confidence` < 1.0
- `missing` — genuinely unavailable, carries plain-Dutch `explanation` + ONE targeted `question`
`gaps` are just the projection of all `missing` fields. Pure `composeRaceContext`
takes already-fetched sources (weather/travel/logistics/routeLinked) so it is fully
deterministic + unit-testable; async `buildRaceContext` does the I/O.

## Permanent honest gaps (never faked)
Some fields have NO reachable, permitted source and must stay `missing` forever:
`uitslagen_eerder` (prior results), `deelnemerslijst` (participant list), and
`vertrektijd` (road travel time — straight-line km is derivable, road time is not).
**Why:** honesty contract — Sparki must say "geen bereikbare bron" rather than
fabricate. Don't "fix" these by scraping; route the athlete to notes instead.

## raceType auto-enrich rule (create vs edit)
- **POST (create):** `body.raceType ?? deriveRaceTypeValue({discipline, name}) ?? null` — derive when absent, stay null when nothing matches (no guessed default).
- **PUT (edit):** derive ONLY when (1) no explicit `raceType` in body, AND (2) `name` or `discipline` is changing, AND (3) the existing race has no type yet. Uses effective values (incoming ?? existing).
- **Why:** "auto-enrich on create/edit" must fill gaps without ever clobbering an athlete's explicit type choice. PUT must load the existing race first to know the current type/effective fields.

## Read-only GET contract
`GET /:id/context` and `GET /:id/evaluation` are strictly read-only — they compute
and return, never persist. Memory persistence happens ONLY on `PUT` when a `result`
is saved (best-effort `void persistRaceEvaluation(...).catch(...)`, never blocks the
response). Post-race evaluation: future race ⇒ not evaluable; past + no result + no
matched activity ⇒ asks, never assumes; dedupeKey `race-eval:<id>`, privacy-gated.

## How to apply
When adding a new race signal: add a field with the right status + herkomst, give
derived values a sub-1.0 confidence and explanation, give missing values a reason +
one question. Feed the same shape from new sources rather than inventing parallel
structures. Keep all rendered strings plain Dutch with no "AI".
