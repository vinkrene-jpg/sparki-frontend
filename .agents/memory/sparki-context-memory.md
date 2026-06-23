---
name: Sparki personal-context memory
description: Relational context-memory feature design — deterministic detection, evening follow-ups, privacy-safe viewer projection
---

# Personal-context memory ("Sparki onthoudt")

Athlete narrates a life moment in free Dutch ("ik heb niet getraind want examen
morgen") → Sparki detects it, stores a memory, schedules an evening follow-up,
asks on next login, marks it followed-up; athlete can pause/delete.

## Design decisions worth keeping
- **Detection is deterministic, not model-based.** Pure Dutch keyword + temporal
  rules in `engines/context-memory/detect.ts` → `DetectedContext | null`. Kept
  pure (no DB) so it is unit-testable and predictable. Five scenario families:
  exam / race / injury / sleep / camp (+ general fallback). Returns null for
  non-matches so memories are created only on real hits.
  **Why:** the task demands *deterministic* detection and honest behaviour, not a
  probabilistic guess.
- **Follow-ups land in the evening (19:00)** of the relevant day. The "login
  check" is just `getDueFollowUps` (status=scheduled, enabled, followUpAt<=now);
  there is no cron — it surfaces whenever the athlete next opens the app.
- **Persistence is privacy-gated** exactly like ai_observations: `captureContext`
  checks `getEffectivePrivacy(clerkId).aiMemoryEnabled`; when off it returns
  `{detected:true, gated:true, memory:null}` and stores nothing (honest, no
  silent persistence).
- **Coach/parent never see raw words.** `getAthleteContextForViewer` is a
  hand-picked column projection that OMITS `statement` (athlete's words) and
  `response` (their answer) — only neutral title/detail/kind/status/timing. Route
  access additionally gated by accepted link + sharing level != none.
  **Why:** privacy rule — viewers get Sparki's neutral framing, never the
  athlete's private text.
- **Lifecycle guard:** answer/dismiss only act on rows with status=`scheduled`
  (predicate in the UPDATE), preventing re-answer of a completed/dismissed item
  from a stale client.
- **Follow-up prompt close semantics:** the top-right X = "Later" (local hide,
  non-destructive, reappears next login); the explicit "Overslaan" button = the
  destructive dismiss. Mounted in ScreenShell OUTSIDE the signed-in `Show` gate
  so it also fires in Development Preview Mode.

## Gotcha: JSX \u escapes do NOT work in text or attribute strings
`<p>...\u2014...</p>` and `placeholder="...\u2026"` render the literal
backslash-u sequence — JSX text content and double-quoted attribute values are
NOT JS string literals. Use the real character (—, …, ·) or an `{"\u2014"}`
expression. `\\u` only works inside JS string literals (e.g. inside `{...}`
expressions, ternaries, setState calls).
