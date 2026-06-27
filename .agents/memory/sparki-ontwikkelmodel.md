---
name: Sparki Ontwikkelmodel (long-term development model)
description: Foundation of the multi-sprint "ontwikkelmodel" — structured development goal + deterministic belastbaarheid read + Ontwikkelkompas section on /you.
---

# Ontwikkelmodel — Fundament v1

The honest foundation of Sparki's long-term development model. First slice of a
multi-sprint vision; later sprints add potentieel-bandbreedtes, ontwikkel­prioriteiten/
bottleneck-engine, wetenschapsengine met bewijsweging, persoonlijke validatie, trainer-
dashboard. Communicate those as roadmap, NOT built.

## What it is
- **Structured `developmentGoal`** — a text enum on `athlete_profiles` (col `development_goal`)
  that is THE reference point every coaching decision is weighed against. Keys:
  `recreatief | granfondo | topamateur | elite_u23 | prof | persoonlijk`. `persoonlijk`
  reuses the existing free-text `goals` field for the athlete's own words — they are NOT
  the same field; goal = structured ambition, goals = free-text toelichting/season notes.
- **Belastbaarheid** — a deterministic, REAL-data read of how much load the athlete can
  absorb. NOT the same as the State Engine's instantaneous y; this is a longitudinal,
  first-window estimate.
- **Ontwikkelkompas** — the /you section that unifies doel + belastbaarheid + benutting
  (the existing evolution/verloop items live INSIDE this section, not as a separate one).

## Key design rules (honesty)
- Belastbaarheid is gated: returns `hasData:false` with a plain-Dutch reason when there is
  too little real data (needs ~10 load points AND ≥6 sessions in 6wk). Never fabricated.
- It is explicitly a **first-window estimate** — copy says "eerste inschatting op basis van
  X weken", NEVER fake "jaren" / years of data. Confidence labels are honest and never
  claim certainty beyond "redelijk zeker".
- Score = 0.4·trainingsregelmaat (weekly-session CV) + 0.35·opgebouwde basis (CTL/70 clamp)
  + 0.25·opbouwtempo (acute:chronic ATL/CTL ratio, controlled ≤1.3). Health sick/injured
  caps the score ≤0.35 and says so. Bands: ≥70 robuust / ≥45 redelijk / else beperkt.
- The "70" CTL anchor and the weights are honest *scales*, not absolute truths — comments
  say so. If you tune them, keep the honesty framing.

## Potentieel-bandbreedte (sprint 2 — growth range)
- `deriveBandbreedte(ftpHistory, load, profile)` in `core-profile.ts` returns an honest
  FTP growth RANGE (low/expected/high) over a fixed ~12-week (one block) horizon — NEVER
  a single promise, NEVER "jaren". Surfaced in Ontwikkelkompas (/you §09) after belastbaarheid.
- Inputs are REAL only: least-squares slope of `ftpHistory.ftpWatts` (W/wk), CTL trend from
  `load.chartData`, age trainability from `birthYear`, and the data window (n + span).
- Honest gates: needs ≥2 FTP measurements AND a ≥21-day span, else `hasData:false` with a
  plain-Dutch reason + a "FTP invullen" button (`startFix("ftp")`).
- Band math is a deliberately conservative *scale* (not absolute truth, comments say so):
  expected rate = slope·0.7 (taper for diminishing returns), high scales with age headroom,
  low ≈ slope·0.3 (consolidation); CTL-down shrinks the upside, CTL-up widens it. Ordering
  is enforced low ≤ expected ≤ high. Plateau (tiny spread) is its own honest headline.
- Confidence label: ≥5 pts & ≥12wk "redelijk zeker"; ≥3 & ≥6wk "een eerste indruk"; else
  "nog voorzichtig". Goal label is woven into copy when set, never required.

## Wiring gotchas
- `developmentGoal` is whitelisted on `PUT /api/athlete/profile`: explicit `null` clears,
  a valid enum key sets, unknown strings are IGNORED (not trusted). GET returns it via the
  `...athlete` spread already.
- Frontend `AthleteProfile` type must carry `developmentGoal` so `useUpdateAthleteProfile`
  (`Partial<AthleteProfile>`) can save it.
- Missing-input target `developmentGoal` REUSES `focus: "goal"` (no new SETTINGS_FOCUS_TOKEN
  needed) — startFix("developmentGoal") → /you?focus=goal opens settings + scrolls to the
  Doelen/GoalsSection which holds both the structured picker and the free-text toelichting.
- Do NOT add `developmentGoal` to the /you `gapTargets` list — the Ontwikkelkompas renders
  its own goal prompt; adding it to gaps would double-prompt.
- The catalog + label/info helpers + `deriveBelastbaarheid` all live in
  `artifacts/sparki/src/lib/core-profile.ts` (frontend lib). `DEVELOPMENT_GOALS` is imported
  by both you.tsx and profile-settings GoalsSection.
- athlete-context.ts goal line is plain Dutch ("LANGETERMIJNDOEL: … — weeg elke beslissing
  af tegen deze ambitie") even though the surrounding internal prompt is English-keyed —
  acceptance required a Dutch goal line.

## Contract test
- `tests/development-goal.ts` (`test:development-goal`) locks the whitelist: valid enum
  persists, unknown/empty string ignored, explicit null clears, omitted field untouched,
  all GET-round-tripped. **Why HTTP-level:** the whitelist lives inline in the PUT handler
  (not an exported fn), so the test boots the real `app` and uses the dev-auth bypass
  (`x-dev-clerk-id` header → disposable seeded user). Its script MUST export
  `NODE_ENV=development` + `DEV_AUTH_BYPASS=true` (other test scripts don't) or every
  request 401s and the contract assertions are vacuous — the test asserts the 200
  precondition to catch that.

## Ontwikkelprioriteit / bottleneck-engine (built)
- `deriveOntwikkelprioriteit(load, sessions, profile)` in core-profile.ts names the ONE limiter
  that most holds development back. Reuses the SAME factors as belastbaarheid — both now read
  from a single `computeLoadFactors()` helper (rhythm/capacity/rampSafety + NEW `recovery` from
  sustained TSB) so the two reads can never drift. Refactor preserved belastbaarheid scoring.
- Limiters: `regelmaat|basis|opbouwtempo|herstel`. gap = 1−score (0..1); impact = gap × goal weight
  (`GOAL_WEIGHTS` per developmentGoal, NEUTRAL when no goal). Highest impact wins.
- Honesty: same evidence gate as belastbaarheid (hasData=false → reason). When the top gap is
  < `GAP_THRESHOLD` (0.3) it returns `balanced:true` ("geen duidelijke rem") instead of inventing
  a problem. Health sick/injured caps `recovery` ≤0.3 and the herstel copy says so.
- Surfaced in the Ontwikkelkompas (you.tsx) ABOVE the Belastbaarheid card via `PrioriteitCard`
  (finding + concrete action + "Waarop dit is gebaseerd" disclosure showing all 4 factor readouts).
  Weights/0.7-CTL anchor are honest *scales*, not truths — keep that framing if you tune them.
