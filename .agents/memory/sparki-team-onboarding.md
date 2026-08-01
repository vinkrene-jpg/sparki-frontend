---
name: TEAM-onboarding & organogram-kaarten
description: Zelfstandige Team-organisatie op de clubs-container; organogram-kaarten, stafplekken, e2e-valkuilen
---

- TEAM is GEEN tweede entiteit: `organisation_type` (CLUB|TEAM) op `clubs`; TEAM krijgt `organisationKind="ploeg"`. **Why:** één rechten-/abonnements-/ledenlaag hergebruiken (bindend besluit).
- Organogram-kaarten zijn pure conceptstructuur (selecties + `organisation_staff_slots`), nooit rechten of personen; toepassen is additief + idempotent en concurrency-safe via `pg_advisory_xact_lock(881101, clubId)` in de tx.
- Medische stafplekken tellen per rol ÉN functietype — een fysio-plek vervult nooit een vereiste arts-plek.
- TEAM-only routes (organogram, staff-slots POST) eisen een server-side gate op `organisationType` (409); frontend-verbergen is geen grens — reviewer ving dit.
- E2e-valkuilen: `/club` redirect naar `/` zonder lidmaatschap (instapkaarten via `/club?code=…`); QA-account moet `onboarding_state.is_complete` hebben; api-server-workflow HERSTARTEN vóór e2e (prod-build proxyt naar 127.0.0.1:80, oude code = misleidend bewijs); placeholders matchen niet via getByText.

## Addendum parallelle teams + rolgestuurde start (01-08-2026)
- Uitnodiging kan `teamId` dragen; accept koppelt atomair aan de selectie en MOET hard falen (409+rollback) bij verdwenen of volle selectie — nooit stilletjes als organisatie-brede uitnodiging laten landen. maxSize ook op het accept-pad bewaken.
- `onConflictDoNothing` op de partial unique index van club_team_members eist `where: sql\`ended_at IS NULL\`` (bij DoNothing heet de optie `where`, bij DoUpdate `targetWhere`).
- Rolgestuurde start (GET /:clubId/start): per rol precies één eerste actie óf lege toestand met 4 velden; ALLES afleiden uit echte staat (eigen selectie-toewijzingen, granted consents, seizoenen, conceptstatus) — vaste per-rol-teksten zijn oneerlijk en vielen in review. UI-doelen moeten allemaal echt navigeren (geen dode knoppen).
