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
  pure (no DB) so it is unit-testable and predictable. Categories:
  school / sport / work / family / illness / injury / stress / sleep /
  motivation / race / camp (+ general fallback). Returns null for non-matches so
  memories are created only on real hits.
  **Why:** the task demands *deterministic* detection and honest behaviour, not a
  probabilistic guess.
  **How to apply:** rules are an ORDERED array — first match wins, so order
  encodes precedence. Critical case: `sleep` MUST precede `stress`, otherwise
  "slecht geslapen door spanning" misclassifies as stress (the sleep complaint
  should win). When adding a category, place specific rules before generic ones.
- **Each detection also carries importance + emotionalTone.** `importanceFor()`
  and `detectTone()` derive `ContextImportance` (low/medium/high) and
  `EmotionalTone`; illness/family/high-tone moments weigh `high`. These surface
  in the overview as badges + a "Waarom" (signals) line.
- **Late-return phrasing via `followUpPrompt(memory, now)`.** If the follow-up is
  overdue >36h (athlete returned days later) it switches from the direct question
  to gentle recall: "Je zei laatst dat <clause>. Hoe is dat gegaan?" (per-kind
  RECALL_CLAUSE map). `getDueFollowUps` returns `memory + computed prompt`; the
  dialog renders `current.prompt`, never the raw question. Param kind is typed
  `string` (DB returns string) with a cast + `general` fallback.
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
- **Sharing is opt-in per memory and fails closed.** Schema `visibility`
  defaults to `'private'`; `getAthleteContextForViewer` requires
  `visibility='shared'` AND `enabled=true`. So a freshly captured memory is never
  visible to a coach/parent until the athlete flips the toggle ("Gedeeld met
  begeleiding" / "Alleen voor jou"). `setContextVisibility(clerkId,id,level)` is
  clerkId-scoped; `PATCH /context/:id` validates against `contextVisibilityLevels`.
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
