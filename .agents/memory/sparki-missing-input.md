---
name: Sparki Smart Missing Input Flow
description: App-wide empty-state framework (registry + focus/return/retry) and the dead-end gotcha to avoid when reusing the notice.
---

# Smart Missing Input Flow

App-wide rule: a missing-data/empty-state message is NEVER a dead-end. Each empty-state
explains what's missing (plain Dutch), offers ≥1 action button to the exact input flow,
returns the user to origin, and retries the original action.

Architecture (frontend only, all in `artifacts/sparki/src`):
- `lib/missing-input.ts` — `INPUT_TARGETS` registry is the single source of truth per target
  (label, route, `?focus` token, plain-Dutch why, optional `isSet(profile)` presence check).
  Helpers `missingTargets(keys, profile)` / `isTargetSet`.
- `hooks/use-missing-input.ts` — URL-param based, no context provider. `useStartFix()` →
  `route?focus=&returnTo=&retry=`; `useCompleteFix()` → back to `returnTo?retry=`;
  `useRetryAction(key, fn)` fires once on `?retry` match then strips the param.
- `components/sparki/missing-input-notice.tsx` — reusable notice. `targets`→buttons, plus
  optional `actions[]` and `primary` (ManualAction). `/you` reads `?focus` to auto-open +
  scroll + highlight the editor and calls `completeFix()` on save.

**Gotcha (caused a real dead-end, caught in code review):** if you pass a `targets` set
to `MissingInputNotice` that can become fully satisfied (every target's `isSet` true) and
you do NOT also supply `actions`/`primary`, the notice renders with ZERO buttons — a
dead-end that also shows misleading "missing X" copy even though X is present.

**Why:** the notice only renders buttons for targets whose `isSet` returns false; once all
are set the button list is empty.

**How to apply:** any call site that passes `profile` + profile-backed `targets` must branch
on `missingTargets(...).length`. If empty, render a fallback notice with a `primary`/`actions`
that still moves the user forward. Action-only targets (checkin, race, sportData — no `isSet`)
always render a button, so they're safe. Example: `/train` "no workout" state branches —
incomplete profile → target buttons; complete profile → primary "Bouw mijn plan" scrolling
to `#three-week-plan`.
