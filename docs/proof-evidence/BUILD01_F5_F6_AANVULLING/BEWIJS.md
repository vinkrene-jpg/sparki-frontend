# SPARKI_BUILD_01 — Bewijs F5 (Herhalende trainingen) + F6-aanvulling (VOG en jeugdveiligheid)

**Getoetst op:** 2026-08-03 (dev, na review-fixes)
**Spec:** `docs/build-packages/SPARKI_BUILD_01/SPARKI_BUILD_01_FUNDAMENT_VEILIGHEID_EN_TOEGANG.md` §F5 en §F6
**Let op naamclash:** de bundels in `docs/proof-evidence/F13/` heten óók F5/F6 maar
horen bij `SPARKI_HERSTEL_EN_AANVULLING_01` (stafbezetting resp. VOG-audit).
Dit dossier gaat over de BUILD_01-fasen.

---

## F5 — Herhalende trainingen (nieuw gebouwd)

- Tabel `workout_series` + `planned_workouts.series_id` (migratie `0043_f5_herhalende_trainingen.sql`).
- Reeks materialiseert direct zelfstandige trainingen (géén parallel agendaschema); max 200.
- Datumgeneratie puur op kalenderdagen (y/m/d), dus zomertijd-veilig — geen Date/UTC.
- Wijzigen: `one` (loskoppelen + uitzondering) · `following` (reeks wordt gesplitst:
  oude reeks eindigt vóór de grens, nieuwe reeks draagt het gewijzigde sjabloon) ·
  `all` (sjabloon + alleen nog geplande rijen).
- Beëindigen/annuleren: uitgevoerde historie blijft altijd staan (losgekoppeld).
- Alle serie-mutaties row-locked (`SELECT … FOR UPDATE`) + status-check (409 op
  beëindigd/geannuleerd) — parallelle skips verliezen geen uitzonderingen.
- Web: herhaal-optie in "Training inplannen" (dagelijks/wekelijks/weekdagen/interval + einddatum).
- Geen notificatie per gegenereerde rij; één bevestiging per reeks-actie.

**Test:** `pnpm --filter @workspace/api-server run test:workout-series`
**Log:** `logs/f5-workout-series.log` — **15/15 geslaagd** (incl. DST-overgangen
2026-03-29 en 2026-10-25, following-split, 409-statussen, parallel-skip-race,
cross-account 404, losse training wordt nooit in een reeks getrokken).

## F6 — VOG en jeugdveiligheid (aanvulling op bestaand werk)

Bestond al: VOG-registratie per lidmaatschap (beheer-only, audit in tx),
weigering (409) van een trainer zónder VOG op een jeugdgroep, verlopen VOG
(>3 jaar) = waarschuwing (besluitenpatch 01-08, versoepeld — bewust géén blokkade).

Nieuw in deze aanvulling:
- **Bewijsreferentie** `club_members.vog_reference` (kenmerk/Justis-nummer; nooit
  het document zelf — spec verbiedt documentopslag). Migratie `0044_f6_vog_reference.sql`.
- **Inventarisatie** `GET /api/clubs/:clubId/vog-overzicht` (beheer-only): alle
  actieve trainer-koppelingen met jeugdmarkering en VOG-status
  (`geldig`/`verlopen`/`ontbreekt`); jeugdkoppelingen zonder geldige VOG worden
  **gemarkeerd en gemeld, nooit stil verbroken** — verbreken blijft een besluit
  van de organisatie.

**Test:** `pnpm --filter @workspace/api-server run test:club-vog`
**Log:** `logs/f6-club-vog.log` — **6/6 geslaagd** (bevoegdheid, referentie+audit,
weigering zonder VOG, geldige koppeling, verlopen-VOG-markering, overzicht beheer-only).

## Eerlijke afbakening

- Dev-omgeving; productie toont dit pas na een nieuwe publish (René).
- Reeks-beheer-UI (wijzig één/volgende/alle vanuit de agenda) is nog niet in de
  web-UI aangesloten; de API en het aanmaken mét herhaling wel.
- `test-cross-account-isolation` rood op main is pre-existing (415 uploadMaterialPhoto), los van dit werk.
