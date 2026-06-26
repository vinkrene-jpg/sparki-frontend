---
name: Sparki experience-first restructure
description: The approved Beleven→Ontdekken→Begrijpen→Verbeteren reorg, new 5-tab nav, phasing, and prototype-first rule.
---

# Sparki experience-first restructure (approved direction)

A major UX reorg of the whole app around four steps, in this order on EVERY screen:
**Beleven → Ontdekken → Begrijpen → Verbeteren** (Experience → Discover → Understand → Improve).

- **Beleven**: lead with the lived ride experience (hero image/route, the moment, how it felt) — NOT coach text.
- **Ontdekken**: then Sparki surfaces what's notable ("Sparki ziet…", records, comparisons).
- **Begrijpen**: tap-to-expand "Waarom ziet Sparki dit?" — reasoning + small visual + confidence + honest missing-data line.
- **Verbeteren**: advice LAST and only when genuinely relevant. Never lead with coach advice. ONLY exception: a real warning may sit at the very top, styled as a warning.

**Why:** the old app led with coach advice on top; the new direction is experience-first, advice-last, calmer.

## Approved nav simplification (5 tabs)
**Vandaag · Activiteiten · Ontdekken · Trainen · Jij**
- Nieuws + Kennis + Inzicht → merged into **Ontdekken** (a discovery feed).
- Races → folded into **Trainen**.
- Samen → reachable via profiel/header, not a top tab.
- Core → demoted to an internal engine only (no nav entry).

## Phasing
F1 = nav + Home + opening flow · F2 = Activiteit-detail · F3 = Ontdekken tab · F4 = Trainen + rest.

## Implementation status (real app)
- **Nav shipped**: `bottom-nav.tsx` athlete nav is now the 5 approved tabs; floating Core shortcut removed (route `/core` kept, no nav entry); the old `knowledge_base` Races→Kennis swap was dropped for athletes. Coach/parent navs left unchanged.
- **Activiteiten shipped**: real surface `pages/activiteiten.tsx` (route in BOTH `App.tsx` and `dev-preview.tsx`; section key `activiteiten` added to ScreenShell SECTION_SCENE/SECTION_DISPLAY, NOT in COACH_CARD_SECTIONS so no coach card — advice-last). Lists `useSessions`, taps open existing `SessionDetailDrawer`. **Honesty reconciliation:** the prototype's weather/atmosphere chips were OMITTED because `TrainingSession` has no weather data — never fabricate them on real cards.
- **Interim**: "Ontdekken" tab points to `/feed` until the merged discovery surface is built in F3. "Trainen" → `/train`; races fold in F4.
- **Still TODO**: experience-first reorder of the Vandaag/Home day-type engine (the riskiest F1 piece — touches HomeViewContext state/full surfaces + ScreenShell coach-card injection); F3 merged Ontdekken (Nieuws+Kennis+Inzicht); F4 Trainen+races fold + Samen→header/profiel.

## Prototype-first rule (hard requirement from user)
Build a CLICKABLE canvas prototype first (Home, Activiteit-detail, new nav) and get explicit approval BEFORE touching the real app. Prototype lives in the mockup-sandbox:
`artifacts/mockup-sandbox/src/components/mockups/sparki-reboot/Prototype.tsx` (single self-contained clickable mobile file).

## Honesty constraint surfaced during prototype
`training_sessions` store only AGGREGATES (no per-second streams); GPX has summary only. So per-second power/HR CURVES only exist when device-stream data was imported. Elevation/speed can be derived from GPX. Prototype must show BOTH a populated curve (stream ride) and an honest empty curve ("nog niet beschikbaar — geen seconde-data").
