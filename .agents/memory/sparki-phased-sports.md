---
name: Sparki phased multi-sport rollout
description: How sport availability is gated for the phased rollout (cycling active; running/triathlon coming_soon) and the coerce-before-validate trap.
---

# Sparki phased multi-sport rollout

Sparki ships sports in phases. The shared registry `lib/feature-flags/src/sports.ts`
(exported via `@workspace/feature-flags`) is the single source of truth: each sport has
`status` (`active` | `coming_soon`), and `isSportActive(type)` is THE availability gate.
Currently cycling=active; running/triathlon=coming_soon. `DEFAULT_SPORT="cycling"`.

## Durable decisions
- **Gate at entry points, not in the engine.** Two domains must stay separate:
  - Product sport registry (`cycling`/`running`/`triathlon`) = rollout policy.
  - Routing ENGINE capability tuple in `lib/routing/profile-selection.ts`
    (`cycling`/`running`/`walking`/`hiking`) = what the routing provider *can* do.
  Do NOT merge them. Instead block inactive product sports at every user entry point
  (onboarding quick-start + `POST /api/routes/generate` + the route-panel UI). Inactive
  sports then never reach the engine, so the engine tuple can stay broad.
- **No menu items / functional paths for inactive sports.** UI must filter sport options
  through `isSportActive` and hide a single-option selector entirely (route-panel hides
  the SPORT block when `SPORT_OPTIONS.length <= 1`). Onboarding shows coming_soon tiles as
  disabled "Binnenkort" — visible roadmap, not selectable.
- **Block message (Dutch, user-facing):** `"Deze sport is nog niet beschikbaar in Sparki."`

## The coerce-before-validate trap (architect caught this)
`coerceSport()` in `routes.ts` defaults ANY unknown value to `"cycling"`. If you validate
AFTER coercion, an explicit inactive sport (`triathlon`, `voetbal`, junk) silently becomes
cycling and passes the gate.
**Rule:** validate the RAW request value against `isSportActive` BEFORE coercion; only an
absent field may default to cycling. **How to apply:** any time a "coerce/normalize with a
safe default" helper feeds a policy gate, gate the raw input first, then coerce — otherwise
the default mask defeats the gate. Onboarding was already correct (it checks
`(body.sport ?? DEFAULT_SPORT)` raw, no coercion).
