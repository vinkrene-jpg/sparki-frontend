---
name: Sparki interactive training schedule
description: Design decisions for the clickable 3-week plan + 4-section workout drawer with feedback→Sparki-proposal flow.
---

# Sparki interactive training schedule

Real periodized plan engine + real Sparki (Anthropic) calls drive the training schedule. No mock data; no "AI" wording user-facing (Dutch copy, framed as "Sparki").

## Feedback → proposal → apply flow
- Persist athlete feedback FIRST (await), THEN request the Sparki adjust proposal. Do not fire both in parallel — if feedback save fails the proposal must not appear.
  **Why:** uncoordinated parallel mutations let a proposal show while the feedback record silently failed.
  **How to apply:** in the workout drawer's feedback handler, `await submitFeedback.mutateAsync(...)` before `adjust.mutateAsync(...)`.

- Applying a proposal maps `changes.intensity` → the workout's `description` field (there is no structured-blocks field returned by the LLM). Duration/TSS/title/newDate map to their own columns.
  **Why:** the adjust LLM returns intensity only as a human-readable string; writing it to `description` makes the change durable and visible in the Practical section instead of being silently dropped.

## Server-side guardrails
- `PUT /api/athlete/workouts/:id` validates LLM-applied fields before writing: `scheduledDate` must match `^\d{4}-\d{2}-\d{2}$`, `targetDurationMin` 0–1440, `targetTSS` 0–1000. Bad payloads → 400.
  **Why:** proposal fields originate from an LLM; without bounds a malformed payload could corrupt a workout or 500.

## Explain endpoint
- `POST /ai/workout-explain` is the lazy "Waarom?" philosophy layer. Prompt forbids markdown; drawer also strips stray `#`/`**` defensively before rendering plain paragraphs.
