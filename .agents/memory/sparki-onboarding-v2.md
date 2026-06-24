---
name: Sparki Onboarding V2
description: Narrative 6-screen onboarding; founding-athlete + evidence-gated curiosity/honest engines governed by the Voice Engine; gotchas.
---

# Sparki Onboarding V2

Form-based quick-start replaced by a 6-screen narrative that lands the athlete straight in
the app. Self-type claim + Founding Athlete program + evidence-gated curiosity/honest
surfaces carry the storyline.

## Durable decisions

- **Founding number is DB-uniqueness-backed, never read-then-write.** Idempotent assignment that
  retries on Postgres `23505` under concurrent races. A `MAX(n)+1` read-then-write collides under
  burst signups; the DB UNIQUE constraint is the only safe serialization.

- **Insight surfaces (open-loops + honest) are governed by the Voice Engine, not a parallel
  reimplementation.** Tone/anti-fabrication gating lives in one shared helper that reuses the
  voice engine's tier→tone rule. Each loop/observation carries a voice tone; the route passes the
  athlete's REAL trust tier. Verbatim brief copy is preserved (lines stay fixed); the engine only
  decides *whether* a line may speak. **Why:** the prior standalone insight engines duplicated tone
  logic and bypassed the single-source voice rules — review blocker. Pointed lines (e.g. the
  "I doubt your theory" dry-humor observation) must be *earned* via trust, not shown to brand-new
  athletes; lower-trust contradiction → honest "insufficient" rather than a too-early jab.

- **Engines stay evidence-gated — never fabricate.** Loops emit only when their real-signal predicate
  passes; honest returns explicit "onvoldoende bewijs" when evidence is thin. Honest failures + no
  mock UI is a hard project rule; a fabricated "theory about you" breaks the narrative's trust premise.

- **Onboarding "Koppelen" must enter the REAL connect flow, not a duplicate.** It reuses the same
  ConnectionsSection / `/api/connectors` stack as settings (a dedicated connect step with a top
  "Terug" and a finish CTA); "Later" is the skip path. **Why:** review blocker — both buttons
  previously finished identically, so the connect flow was unreachable.

- **complete-v2 awaits the plan build inline (~30s), matching quick-start.** First plan exists before
  the success response so the user never lands planless. Known UX cost (button spins on both finish
  paths); deferred to a follow-up to make it background/non-blocking.

## Gotchas

- **DevPreview bypasses the auth router**, so new auth-gated screens are invisible in dev preview
  unless added to `dev-preview.tsx` (VIEWS entry + isActive branch + render branch). Onboarding V2 is
  at `/_dev/onboarding`. Any future onboarding/auth screen needs the same three additions.
- **The Profiel (you) page shows a pre-existing "Sparki vraagt na" adaptive modal** on load for users
  with pending context-memory follow-ups — it overlays the page and can't be dismissed in a static
  screenshot. Verify new you.tsx surfaces via endpoints (curl) or by clearing pending follow-ups,
  not by screenshot alone.
