---
name: Sparki shared layout shell
description: CommercialShell is the single chrome owner (sidebar, bottom-nav, container, background) for ALL main routes; ScreenShell delegates to it.
---

The rule: **CommercialShell is the only layout shell.** Every main route renders through it — either directly (Core pages) or via ScreenShell, which now delegates all chrome (desktop sidebar, mobile bottom-nav, main container, background) to CommercialShell and only adds its own header/coach-cards/overlays inside.

**Why:** Two parallel shells (ScreenShell had its own copy of sidebar + bottom-nav + full-screen `#05070e` background) drifted apart, so routes randomly showed old layout/heavy black backgrounds despite per-page fixes.

**How to apply:**
- Deviations (cinematic scene background, chrome-less pages) go through CommercialShell props: `achtergrond` (ReactNode background layer) and `bare` (hides sidebar + bottom nav). Never a page-owned full-screen background or a new shell component.
- Active-nav matching is prefix-based (`actief === href || actief.startsWith(href + "/")`) on both desktop and mobile.
- Stacking: background layer behind, `main` is `relative z-10`, sidebar `fixed z-40`.
- `test:commercial-today` fails pre-existing (unrelated to shell work; verified via git stash).
