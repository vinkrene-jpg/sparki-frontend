---
name: Sparki Core living profile page
description: /you is a derived "what Sparki knows about you" page, not a form; settings relocated to a drill-in sheet; observation lenses + ?focus= continuity rules.
---

# Sparki Core living profile (/you)

The Profiel page (`/you`, nav "PROFIEL") is a LIVING surface showing what Sparki has DERIVED about the athlete — NOT a settings form. Settings/editors live in an "Instellingen" drill-in sheet behind a gear, reached on demand.

**Why:** product direction — every Sparki surface must carry derived intelligence, not static lists/forms. The profile is the athlete's mirror of Sparki's understanding.

**How to apply when extending it:**
- Composition is a pure, deterministic, no-fabrication module (`lib/core-profile.ts`): identity (archetype from coach-engine), observation lenses, evolution. Honest-empty everywhere; a section renders only when it has a real reason.
- **Observation lenses rule:** each observation lands in EXACTLY ONE bucket by precedence — low-confidence→uncertainty, has detectedPattern→patterns, severity watch/important/urgent→development, else (info)→strengths. Never double-count across sections. The "lead" (highest severity→confidence→recency) is shown once as a headline and may also reappear in its lens (lead+detail is allowed per coach-card-dedup lesson).
- **Exclude transient `daily_briefing` (and legacy `daily_n`) sourceTypes** from the profile lenses — they're today's momentary read and belong on Core Status (`<StateCard/>`), not durable derived traits. Without this filter, daily briefings polluted "Sterke eigenschappen".
- **`?focus=` continuity (critical):** many app pages deep-link to `/you?focus=<token>`. The Core page must auto-open the Instellingen sheet for settings tokens (ftp/weeklyHours/weight/sportProfile/goal/checkin/connections — note sportData target's focus IS "connections") and pass `focus` into `ProfileSettings`, which keeps `cfg-<token>` ids + per-editor `autoOpen` so the right editor opens + highlights. Closing strips `?focus` by navigating to the wouter-relative `"/you"` (NOT basePath — wouter handles the base prefix; basePath would misroute under a non-root base).
- Data-gaps section uses `missingTargets([...], profile)` + `useStartFix()`; add a `sportData` gap when `sessions.length===0`. When nothing is missing, render a positive confirmation line, never empty buttons (missing-input dead-end rule).
