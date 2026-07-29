---
name: Sparki cluborganisatie (WP-03)
description: Seizoenen/selecties/toewijzingsvensters en de valkuilen rond wrapped unique-violations, advisory-lock-sleutels en venster-filters.
---

# Cluborganisatie-lessen (WP-03)

## Drizzle wikkelt pg unique-violations — check err.cause tot 4 niveaus
**Why:** een partial-unique-violation (bijv. één actief seizoen per club) komt bij drizzle niet als directe pg-error binnen; regex op `err.message` mist hem → 500 i.p.v. 409.
**How to apply:** loop `err.cause` door (tot ~4 niveaus) en match op de indexnaam (patroon `isOneActiveSeasonConflict` in club.ts).

## Toewijzingsvenster: één helper, ALLE leespaden
**Why:** review vond dat berichten-scope/leesfilters het `endsOn`-venster misten — beëindigde trainers hielden toegang. Eén vergeten pad = privacylek.
**How to apply:** `activeAssignmentWindow()` (endsOn null of ≥ vandaag Amsterdam via `toLocaleDateString("en-CA",{timeZone:"Europe/Amsterdam"})`) in ELKE query op club_trainer_assignments; grep bij elke nieuwe consumer.

## Capaciteitsraces: één gedeelde advisory-lock-sleutel voor alle paden
**Why:** join en invitation-accept hadden elk hun eigen locksleutel — twee "geserialiseerde" paden die elkaar niet zagen; de laatste plek kon dubbel vergeven worden.
**How to apply:** alle member-capacity-paden gebruiken exact dezelfde key `pg_advisory_xact_lock(881100, clubId)` binnen de transactie waarin ook de insert gebeurt.

## Seizoen afsluiten = toewijzingen beëindigen, nooit verwijderen
Afsluiten zet `endsOn` op de seizoenstoewijzingen (historie blijft); afgesloten seizoen is read-only, ook voor team-edits, en kan nooit terug naar actief.

## Overzichtsendpoints: server-side scopen, niet client-filteren
Een club-breed overzicht (uitnodigingen) mag niet uit een "mijn items"-endpoint + client-filter komen — multi-admin ziet dan te weinig; maak een beheer-gescoped `/clubs/:id/...`-endpoint.

## Dev-preview screenshots van beheerpagina's
Persona wisselen kan zonder UI: Playwright `addInitScript` zet `localStorage["sparki.dev.previewAthlete"]`. Vergeet de dev-preview-routetabel niet (aparte branch per pad, vóór het kortere prefix-pad).
