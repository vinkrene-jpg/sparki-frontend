---
name: Clubbalken (C2) — bare-val en hoofdtrainer-toegang
description: CLUB_AFRONDING_01 C2 clubbalken; ScreenShell bare verbergt de onderbalk; hoofdtrainer heeft beperkte /club/beheer-toegang (alleen Structuur).
---

- **Bare-val:** `ScreenShell bare` verbergt óók de mobiele onderbalk en het hoofdmenu. /club/beheer stond op bare, waardoor de beheer-clubbalk onzichtbaar was op het startscherm van die rol. Regel: een pagina die doel is van een clubbalk-link mag nooit bare zijn.
- **Hoofdtrainer op /club/beheer:** de clubbalk linkt naar ?tab=structuur; de pagina laat hoofdtrainer nu toe in een alleen-Structuur-weergave (geen uitnodigen/locaties/documenten/aanmaakvelden — `canManage` op SeasonsTeamsSection). Server-rechten waren al passend (indeling wijzigen mag, aanmaken niet).
- **Why:** browserklik-doorloop (e2e/tests/club-balken-rollen.mjs) bewees dat typecheck+test:navigation dit gedrag niet vingen.
- **How to apply:** wijzigingen aan clubbalken of /club(/beheer)-tabs altijd herbewijzen via `node e2e/tests/club-balken-rollen.mjs` (prod-build eerst).
- **Twee balk-varianten:** DsMobileNav (shell-chrome, knoppen) én BottomNav (links) — BottomNav rendert in productie alléén in de paginacrash-fallback. De dev-preview/toetsomgeving miste de per-paginaboundary waardoor die fallback daar nooit verscheen; DevPreview wikkelt pagina's nu in dezelfde ErrorBoundary+PageErrorFallback (gedeeld component, components/sparki/page-error-fallback.tsx). E2e dekt beide varianten (crash eerlijk geforceerd via misvormd API-antwoord).
