---
name: Sparki Onboarding V2
description: Narrative 6-screen onboarding replacing form quick-start; founding athlete + evidence-gated curiosity/honest engines; gotchas.
---

# Sparki Onboarding V2

Replaced the form-based QuickStartFlow with a 6-screen narrative onboarding that lands the
athlete directly in the app. Self-type claim + Founding Athlete program + evidence-gated
"curiosity" surfaces are the core of the storyline.

## Key design decisions

- **Founding number assignment is DB-uniqueness-backed, not read-then-write.** `user_profiles.founding_number`
  is a UNIQUE column; `assignFoundingNumber()` is idempotent (early-return if the row already has a number)
  and retries on Postgres `23505` under concurrent races. Do NOT replace this with a `MAX(n)+1` read-then-write —
  it will collide under burst signups.
  **Why:** multiple new athletes can complete onboarding simultaneously; the only safe serialization is the DB constraint.

- **Open-loops and honest engines must stay evidence-gated — never fabricate.** `computeOpenLoops()` emits only
  loops whose evidence predicate passes against real `computeInsightSignals` (sessions/metrics/memories/profile/account-age);
  `composeHonest()` returns explicit "onvoldoende bewijs" (kind `insufficient`) when evidence is thin.
  **Why:** the project's hard rule is honest failures + no mock UI; a fabricated "theory about you" breaks the entire trust premise of the narrative.

- **complete-v2 awaits the LLM-backed plan build inline (~30s), matching quick-start.** The first plan is generated
  before the success response so the user never lands on a planless app. This is a known UX cost (button spins ~30s on
  both Koppelen and Later); deferred to a follow-up to make it background/non-blocking.
  **Why:** consistency with the existing quick-start endpoint and the documented "plan must exist on landing" requirement.

## Gotchas

- **DevPreview bypasses the auth router**, so new auth-gated screens are invisible in dev preview unless explicitly
  added to `dev-preview.tsx` (VIEWS entry + `isActive` branch + render branch). Onboarding V2 is wired at
  `/_dev/onboarding`. Any future onboarding/auth screen needs the same three additions or it won't be previewable.
- **The Profiel (you) page shows a pre-existing "Sparki vraagt na" adaptive modal** on load for users with pending
  context-memory follow-ups — it overlays the page and can't be dismissed in a static screenshot. Verify new you.tsx
  surfaces via the endpoints (curl) or by clearing the user's pending follow-ups, not by screenshot alone.
- selfType allowed keys: `diesel | sprinter | alleskunner | geen_idee | ik_zie_wel` (backend returns 400 on anything else / missing).
