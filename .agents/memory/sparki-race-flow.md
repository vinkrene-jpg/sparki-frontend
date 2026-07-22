---
name: Sparki race flow & advies-typologie
description: Golf 16 one-race-flow lessons — advice typology, coach-first invariant, cancellation semantics, enum-ignore validation.
---

- **Coach-first invariant**: coach instructions are a distinct advice kind ("coachinstructie") rendered literally and sorted first — never paraphrased, never below engine advice. Enforce in the compose function, not the UI.
  **Why:** coach is always leading over Sparki's own rules/estimates.
- **Invalid enum input is ignored, not rejected**: race status/registrationStatus normalizers return `undefined` for unknown values so a PUT never half-applies or 400s the whole body. Test asserts the old value survives.
- **Cancellation semantics**: `status='geannuleerd'` must be filtered at every consumer (plan, goals, athlete-context, coach-signals, reminders), evaluation returns evaluable:false with an honest gap, journey keeps the race visible marked "Geannuleerd" with no result. Column is NOT NULL default 'gepland' so `ne(status,'geannuleerd')` is safe on legacy rows.
- **Route linking is ownership-checked server-side**: a foreign routeId is silently dropped (stored null), not an error — prevents cross-account probing.
- **Course facts carry provenance kinds** (feit/afgeleid/inschatting/ontbreekt) with an `origin` string and, only for "ontbreekt", one targeted question — the frontend renders gaps as a "Nog onbekend" list, never fabricates.
- Shell test runs need `DEV_AUTH_BYPASS=true` explicitly (workflow env sets it; bare `pnpm run test:*` does not).
