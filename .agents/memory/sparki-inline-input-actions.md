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

## "Missing" gaps clear only on a fresh dashboard fetch (background refetch)

Each gap's presence comes from `useAthleteDashboard()` (`athleteProfile`,
`todayMetrics`) + `useRaces()`. The save hooks invalidate
`queryKeys.athlete.dashboard()`, but react-query keeps PREVIOUS data during the
background refetch, so a just-filled button can linger ~1-2s before disappearing.
This is correct behaviour — not a bug. When verifying via the testing subagent,
POLL for the button to disappear after each save instead of asserting immediately.
Backend `todayMetrics` is matched by `metricDate == todayStr()`; confirmed it
populates same-day check-ins correctly (no timezone gap at UTC==Amsterdam date).
