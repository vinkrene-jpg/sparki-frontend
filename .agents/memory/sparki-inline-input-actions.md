---
name: Sparki inline input actions (coach surface)
description: Home coach-surface empty states must offer direct inline actions, never "go searching" text.
---

# Home coach surface: inline actions over "ga naar X"

When a required input for the daily analysis is missing (FTP, weekly hours, goal,
today's check-in, an upcoming race), the Home coach surface must offer a DIRECT
inline action — a button that opens a small modal form right there — and never
text that sends the athlete elsewhere ("Stel je FTP in bij Profiel", "Log
gereedheid in You", "Voeg toe via Train").

**Why:** the audience (youth riders, parents, coaches of varying levels) should
never have to hunt for where to fix a gap; the fix lives where the gap is shown.

**How to apply:**
- Reuse `QuickActionButton` / `CoachInputNeeds` from
  `components/sparki/coach-input-actions.tsx`. Each action writes through an
  EXISTING real mutation hook (`useLogFtp`, `useUpdateAthleteProfile` for
  weeklyHourTarget+goals, `useLogDailyMetrics`, `useCreateRace`) — all of which
  invalidate `queryKeys.athlete.dashboard()`, so saving returns straight to a
  refreshed daily analysis. No new endpoints were needed.
- "Missing" is detected from live data only (dashboard `athleteProfile` +
  `todayMetrics`, `useRaces()`), never assumed — `CoachInputNeeds` renders
  nothing when everything is present (no nagging).
- Modal must have a top-anchored close (X) + Escape/backdrop close (back-out rule).
- There is NO dedicated goal endpoint — goals live on `athlete_profiles` via
  `PUT /api/athlete/profile { goals }`.
- `home-sections.tsx` exports a `todayLabel` helper alongside components, so Vite
  Fast Refresh can't HMR it (does a full reload). Harmless, not a bug.

## CoachInputNeeds must live at SHELL level, not in a day-type component

`CoachInputNeeds` renders in `screen-shell.tsx` gated on `isHome` (after
`HomeProfilePrompt`), NOT inside `training-day-home.tsx` or any single day-type
component.

**Why:** Home dispatches to ~10 day-type components via `day-home.tsx`'s registry
(general/recovery/rest/etc.). Saving a gap (e.g. a check-in) can change the
detected day-type, which swaps the rendered day component. If the card lived in
one day component it would VANISH after a save that changed the day-type — a
dead-end. Lifting it to the shell keeps it visible across every day-type, so it
persists until all gaps are genuinely filled.

**How to apply:** any Home-wide coach surface that must survive day-type changes
belongs in the shell gated on `isHome`, not in a day component. `coach-input-actions.tsx`
also has an athlete-role gate (`useUserProfile`) so coach/parent views don't see it.

## A coach action that only navigates feels broken — land on the real target

`ScreenShell` renders the `CoachAnalysisCard` at the TOP of home/train/lab/races,
and `ScrollToTop` lands navigations at the top. So a coach-card action that just
`setLocation("/train")` / `setLocation("/lab")` drops the user back onto another
coach card — the actual training plan / nutrition input is off-screen and the
button feels dead ("doen het niet"), even though navigation worked.

**Why:** the destination's most relevant content is below the shared shell coach
card; without scrolling there, nothing visibly changed.

**How to apply:** route coach actions through the `?focus=` convention (the same
one `ScrollToTop` already skips on) — e.g. `/train?focus=plan`, `/lab?focus=nutrition`
— and have the destination page read `useFixParams().focus`, smooth-scroll to the
target element (`#three-week-plan`, `#nutrition`), briefly highlight it, then strip
the param via `navigate(path,{replace:true})` so refresh/back don't re-scroll.
Stripping the query is safe: `ScrollToTop` keys on the path only, so removing the
query won't re-fire scroll-to-top.

## Feedback/empty-state copy must be tense-aware (never ask past-tense about a future thing)

A workout/event surface must NOT ask "Laat weten hoe het ging" (Gedaan/Gemist/
Vermoeid/Pijn) about a session that hasn't happened yet — it reads as robotic
form-filling, not an understanding Sparki. Compute timing from `scheduledDate` vs
local today (build `YYYY-MM-DD` from `getFullYear/Month/Date`, NOT
`toLocaleDateString` which is locale/runtime dependent) and switch framing:
- upcoming (future date, status != completed) → forward "Past deze training?" +
  forward options (Verplaatsen / Te zwaar ingepland / Te licht ingepland / Niet
  fit). These are still valid `WorkoutFeedbackType` values, so submit/adjust/history
  paths stay compatible.
- today/past/completed → retrospective "Jouw feedback" + full option set.

**Why:** the user explicitly flagged this as "formulieren invullen ipv een
interactieve begrijpende Sparki" and said it applies "op alle onderdelen".

**How to apply:** treat this as an app-wide principle — any surface that asks for
reflection/feedback should branch on whether the thing is past vs future before
choosing tense and options. (workout-detail-drawer.tsx section 04 is the first
instance.)

## Don't repeat identical empty placeholders — fold absent sections into ONE honest note

A panel with several labeled sub-sections (e.g. the coach card's optional lenses
Patronen / Beter dan verwacht / Verdient aandacht) must NOT render the same
"te weinig gegevens" placeholder under every empty heading. Three identical
apologies in a row read as a robotic form, "te geautomatiseerd / niet
intelligent". Render only the sub-sections that genuinely have a body; collapse
all absent ones into a SINGLE plain-Dutch note that names the gap and how it
unlocks (e.g. "meer ritten en check-ins logt").

**Why:** the user explicitly flagged the repeated light-grey placeholder text as
unintelligent. Honesty (disclose the gap) does NOT require one placeholder per
empty heading — one consolidated honest line satisfies it and reads like a coach.

**How to apply:** keep "spine" parts always visible; split optional parts into
present (render normally) vs absent (one consolidated note). Treat both `null`
and `""` as absent. (coach-analysis-card.tsx card variant is the reference.)

## A primary action button must DO the action, never just scroll to another button

If a button is labelled with an action ("Bouw mijn plan"), its onClick must
perform that action (call the real mutation), not `scrollIntoView` to a second,
identical button further down the page. A scroll-only action button reads to the
user as "werkt niet" — they click it, the page jumps, and nothing happened.

**Why:** /train had TWO "Bouw mijn plan" buttons — the three-week-plan one
generated for real, but the section-01 ("De sessie") one only scrolled to it.
Users clicked the first, saw no plan built, and reported it broken. This is the
same dead-end class as "ga naar X" text: an action surface that doesn't act.

**How to apply:** when the real action hook already exists (useGeneratePlan),
wire every button with that label to call it directly (loading label, disabled +
`if (isPending) return` guard, honest error incl. profile_incomplete), then
optionally scroll to where the result renders on success. Don't duplicate a CTA
as a navigation shim.

## "Missing" gaps clear only on a fresh dashboard fetch (background refetch)

Each gap's presence comes from `useAthleteDashboard()` (`athleteProfile`,
`todayMetrics`) + `useRaces()`. The save hooks invalidate
`queryKeys.athlete.dashboard()`, but react-query keeps PREVIOUS data during the
background refetch, so a just-filled button can linger ~1-2s before disappearing.
This is correct behaviour — not a bug. When verifying via the testing subagent,
POLL for the button to disappear after each save instead of asserting immediately.
Backend `todayMetrics` is matched by `metricDate == todayStr()`; confirmed it
populates same-day check-ins correctly (no timezone gap at UTC==Amsterdam date).
