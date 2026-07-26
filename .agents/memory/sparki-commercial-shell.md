---
name: Sparki commerciële lichte schil
description: Presentation-only commercial "Vandaag" shell behind flag commercial_shell — copy/testing conventions and traps
---

# Sparki commerciële lichte schil

- The commercial shell is a **presentation layer only** on top of existing engines (dashboard, readiness, races). Rule: never touch engines/APIs for its copy — rewrite engine sentences in the presentation layer (`movementLabel`) instead.
- **Why:** CUX orders demand exact Dutch copy while engines are shared with the main app; rewriting at presentation keeps both honest.
- **Exact-copy testing pattern:** all mandated strings live in one `COMMERCIAL_COPY` const in the pure lib, consumed by both the component and unit tests — so "exact text" acceptance criteria are pinned without DOM testing infra.
- **Responsive visibility trap:** a section styled `hidden lg:block` silently drops content on mobile; a CUX round was failed on exactly this (season card missing on mobile). When an order says "same content on mobile and desktop", grep the shell for `hidden lg:` first.
- **Browser validation:** the project has no repo-level browser test framework; mandatory browser checks are done with the Playwright testing subagent against the dev-preview route `/_dev/commercial` (no login needed in dev). Note: two status pills exist in the DOM (mobile/desktop variants) — assert *visible* count, not DOM count.
- Evidence convention for CUX orders: `test-artifacts/<ORDER>/` with screenshots + `testuitvoer.log` + machine-readable `resultaten.json`.
