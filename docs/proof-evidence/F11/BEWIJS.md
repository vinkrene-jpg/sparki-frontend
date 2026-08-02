# F11 — Centrale bestands- en medialaag — bewijsbundel

Datum: 02-08-2026 · Bindend document: `attached_assets/F11_Centrale_bestands_en_medialaag_Specificatie_1785683681784.md`
Veiligheidsbeleid: `docs/F11_VEILIGHEIDSBELEID.md` (eerlijk: geen echte virusscanner; wél magic-byte-controle, her-encoding, whitelist per doel, groottelimiet, geen uitvoerbare types).

## Acceptatiecriteria → bewijs

| Criterium (spec) | Bewijs |
| --- | --- |
| Upload, preview, download door bevoegde | `test-f11-files.log` — upload+download bevoegd ✓ |
| Vervangen behoudt oude versie | `test-f11-files.log` — vervangen behoudt historie ✓ (file_versions, migratie 0019) |
| Ingetrokken bestand niet meer downloadbaar, ook niet via oude link | `test-f11-files.log` — 410 op serve-route én generieke storage-route ✓; `test-f11-omlegging.log` — materiaalfoto fileId-aware 410 ✓ |
| Geweigerd type / te groot duidelijk afgewezen | `test-f11-files.log` — 415/413 met uitleg ✓; `test-f11-omlegging.log` — verkleed type via materiaalpoort 415 ✓ |
| Duplicaat op checksum herkend | `test-f11-files.log` — sha256-dedupe (zelfde eigenaar, hergebruikt object) ✓; revoke van rij A laat zusterrij B leven ✓ |
| Onbevoegde kan niet zien/downloaden | `test-f11-files.log` + `test-f11-omlegging.log` — 403/404 per route ✓ |
| Veilige bestandsnaam | `test-f11-files.log` — path-traversal-naam gesaneerd; uuid-opslagpad; veilige Content-Disposition ✓ |
| Schermlezertekst | alt/aria in FilePicker, MediaPreview, journey/photo-lab/profile-settings/club-beheer (web-tsc ✓) |
| F7-bijlagen op centrale laag | F7 gebruikte de files-tabel al; intrekken via centrale poort geverifieerd (`test-f11-files.log`, F7-poorttest) ✓ |

## Omleggingen (geen module een eigen uploadoplossing)
Materiaalcoach, fietsscan, garage, nutrition, Input Center, Journey (beeld), Photo Lab, trainer-briefpapier → allemaal door de centrale poort; lazy koppeling, geen dataverlies (migratie 0041 additief/nullable).

## Onafhankelijke review
Architect-review keurde de eerste oplevering AF op vier ernstige punten (intrek-bypass materiaal, IDOR presign-finalisatie, dedupe-revoke-semantiek, poort-bypass + rauwe bron). Alle vier hersteld en met regressietests gedekt (zie test-f11-omlegging.log, 11/11).

## Eerlijke beperkingen
- Video (Journey/race-room) blijft op presign zonder her-encoding — her-encoderen van video kan de poort niet; gedocumenteerd in het veiligheidsbeleid.
- Club-logo (SVG), CSV-ledenimport en GPX/FIT/TCX-activiteitenimport zijn geen mediabestanden en vallen buiten deze laag (gedocumenteerd).
- Bestaande `material`-routetest faalt 8/26 identiek mét en zónder F11 (AI-gateway-consent in testomgeving) — voorbestaand.

## Poorten (alle groen, exitcodes in deze map)
test:f11-files 12/12 · test:f11-omlegging 11/11 · test:mental 21/21 · admin-smoke 13/13 · typecheck libs+api+web · brand-copy · regressie journey 18/18, garage 16/16, garage-sensors 10/10.
