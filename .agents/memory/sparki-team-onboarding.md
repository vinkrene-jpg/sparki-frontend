---
name: TEAM-onboarding & organogram-kaarten
description: Zelfstandige Team-organisatie op de clubs-container; organogram-kaarten, stafplekken, e2e-valkuilen
---

- TEAM is GEEN tweede entiteit: `organisation_type` (CLUB|TEAM) op `clubs`; TEAM krijgt `organisationKind="ploeg"`. **Why:** één rechten-/abonnements-/ledenlaag hergebruiken (bindend besluit).
- Organogram-kaarten zijn pure conceptstructuur (selecties + `organisation_staff_slots`), nooit rechten of personen; toepassen is additief + idempotent en concurrency-safe via `pg_advisory_xact_lock(881101, clubId)` in de tx.
- Medische stafplekken tellen per rol ÉN functietype — een fysio-plek vervult nooit een vereiste arts-plek.
- TEAM-only routes (organogram, staff-slots POST) eisen een server-side gate op `organisationType` (409); frontend-verbergen is geen grens — reviewer ving dit.
- E2e-valkuilen: `/club` redirect naar `/` zonder lidmaatschap (instapkaarten via `/club?code=…`); QA-account moet `onboarding_state.is_complete` hebben; api-server-workflow HERSTARTEN vóór e2e (prod-build proxyt naar 127.0.0.1:80, oude code = misleidend bewijs); placeholders matchen niet via getByText.
