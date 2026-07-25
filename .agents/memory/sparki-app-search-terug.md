---
name: Sparki app-brede zoek + auto-Terug
description: App-wide search (header icon, every ScreenShell page) and the automatic top-anchored "Terug" heuristic with its opt-out contract.
---

# App-wide search
- `GET /api/search?q=` groups eigen data: trainingen (owner-scoped), routes (not deleted), wedstrijden (not geannuleerd), kennis (only when `knowledge_base` flag resolves true; flag failure warns, never blocks). q<2 ⇒ empty groups; LIKE `\%_` escaped.
- Client side: `lib/zoekregister.ts` derives page entries from `lib/chapters` (SSOT) + Dutch keyword map; `zoek-overlay.tsx` (portal z-[80], 250ms debounce) merges page hits + API hits. Regression test `zoekregister.test.ts` guards route-existence / no-"AI" / club gating.

# Auto-Terug contract (ScreenShell)
- ScreenShell prop `terug` (default true) renders a top-anchored Terug on every page whose pathname is NOT a nav root for the active role (`navRootsForRole`). goBack = history.back() else "/".
- **Rule:** any page that renders its OWN top back control inside ScreenShell MUST pass `terug={false}` — otherwise two stacked back buttons appear. When adding a new page with its own back, opt out.
- **Why:** the first opt-out sweep missed 8 pages (geluid, paspoort, sparki-connect, sprinten, tester-qr, club-beheer, wedstrijd-room, invitations) — found only by grepping all pages for their own "Terug" render, not by memory. Always `grep -l 'Terug' pages/` and check each ScreenShell usage when touching this heuristic.
- State-based subviews with a *different-semantics* internal back (klimmen detail "Terug naar zoeken") keep the auto-Terug; route-based subviews with a real back (wereld athlete slug) opt out conditionally (`terug={!openSlug}`).
- Intentionally without search/Terug header: admin pages, photo-lab, landing, not-found (no ScreenShell).
