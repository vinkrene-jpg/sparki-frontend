---
name: Sparki Social & Team
description: Friends/Circle, privacy-safe friend feed, joint-training proposals, club/team identity — durable gotchas from building the Samen feature.
---

# Sparki Social & Team

Feature surfaces: `/samen` page (friends, privacy-safe feed, joint-training suggestion + group proposals), club/team identity editor in profile, club crest on home header. API at `/api/social`, engine `engines/social/`, schema `lib/db/src/schema/social.ts`.

## Durable gotchas / decisions

- **ScreenShell scene fallback leaks home-only UI.** `scene = SECTION_SCENE[section] ?? "home"`. Any section not in the map (e.g. `samen`) silently resolves to the `home` scene. Anything that must be home-only (club crest, `HomeProfilePrompt`) MUST be gated on an explicit `section.toLowerCase() === "home"` check, NOT on `scene === "home"` — otherwise it appears on every unmapped page.
  **Why:** the crest + profile prompt leaked onto `/samen` because samen used the home-scene fallback for its cinematic background.
  **How to apply:** when adding a new section that reuses an existing scene's background, add it to `SECTION_SCENE` AND keep home-only widgets behind the explicit `isHome` flag.

- **Club crest renders OUTSIDE the Clerk `<Show when="signed-in">` gate.** The home scene is only ever reached by an authenticated user (real) or Development Preview (signed-out in Clerk's eyes). Gating the crest on signed-in hides it in preview. The crest component returns null when there's no team, so unconditional render on the home scene is safe.

- **Team-identity update must allow `null` to clear columns.** The `PUT /team` `str()` helper must map `undefined → undefined` (leave unchanged) but `null`/`""` → `null` (clear). The engine uses drizzle `onConflictDoUpdate({ set: {...data} })`; a field set to `undefined` is omitted from the UPDATE, so mapping null→undefined makes clearing silently impossible. `setTeamIdentity`'s param type is `Partial<Record<..., string | null>>`.

- **Sport is stored as English keys** (`cycling`, `running`, …) in DB. Never render the raw value — map via a `sportLabel()` Dutch lookup (`cycling → Wielrennen`). Same applies anywhere DB enum-ish values surface to the user.

- **Privacy is fail-closed in the feed.** A friend's activity only appears when their `privacy_settings.shareActivityWithFriends` is true; sensitive details (e.g. sick) are never surfaced. Verified: seeded "Chris" (private) is correctly absent from the feed.

- **Feature naming:** user-facing is "Samen" / "Mijn vrienden" — the internal concept "Circle" is English and must not appear in rendered copy (plain-Dutch rule).
