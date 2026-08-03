# Eindbewijs — bouwpakket TRAINEN_DOELEN_SEIZOEN_01

Datum: 2026-08-03 · Bron: `attached_assets/TRAINEN_DOELEN_SEIZOEN_01_(1)_1785725015171.md` (TD-01…TD-17, fasen F0–F13)

## Testmatrix per fase

| Fase | Inhoud | Bewijstest | Resultaat | Commit |
|---|---|---|---|---|
| F0–F1 | Voorbereiding + fundament | — (infrastructuur) | n.v.t. | vóór 0a2ee11b |
| F2 | Meetniveau per sporter + TD-17-melding per sessie | `td01-meetniveau` | 4/4 groen | c07727c1 |
| F3 | Belasting op hartslag (Karvonen), nooit opgeteld bij vermogen | `td01-hr-belasting` | 5/5 groen | a915b54c |
| F4 | Doellaag naar Trainen; hoofddoel eist datum; besluit over oud doel | `td01-hoofddoel` | 6/6 groen | 0a2ee11b |
| F5 | Bevestigingsscherm vóór plan; preview schrijft niets | `td01-plan-preview` | 3/3 groen | 0717116e |
| F6 | Fase-anker volgt hoofddoel, niet de eerstvolgende wedstrijd | `td01-fase-anker` | 4/4 groen | f5750f31 |
| F7 | Seizoenslaag: vormblokken, dip = onderhoud (nooit base) | `td01-seizoenslaag` | 7/7 groen | 16e91700 |
| F8 | Ploegbelang + eigen rol; promotie alleen omhoog, label-only | `td01-race-labels` | 4/4 groen | 220ce9a4 |
| F9 | Zonder uitslag blijft het doel onbeoordeeld; nergens "gehaald" | `td01-uitslag-onbeoordeeld` | 3/3 groen | 8e4cc50f |
| F10 | Doelvorm Ritme: max 2 proxy's; <14 nergens een getal (TD-15/16) | `td01-ritme-jeugd` | 4/4 groen | 675bfadd |
| F11 | Verlenging na afloop: 80%, duurniveau, max 4 weken (configureerbaar) | `td01-verlenging` | 2/2 groen | 1922c8ff |
| F12 | Voeding volgt de fase; geen tweede model; jeugd zonder caloriebudget | `td01-voeding-fase` | 4/4 groen | edec5f16 |
| F13 | Eindbewijs + onafhankelijke reviewronde | dit document | — | — |

Alle 12 testbestanden staan in `artifacts/api-server/src/tests/` en draaien via
`node ./scripts/run-test.mjs <naam> --dev-auth`. Volledige herrun op 2026-08-03
ná de reviewfixes: **50/50 scenario's groen.**

## Onafhankelijke reviewronde (architect-subagent)

Eerste oordeel: **FAIL** met vier bevindingen. Alle vier hersteld in commit
137cd97d en opnieuw bewezen:

1. **F5 side-effect:** `gatherInputs` kon vanuit de read-only preview een
   notificatie schrijven → melding zit nu achter `notify:true`, alleen op de
   drie mutatiepaden; de F11-test bewijst dat preview niets schrijft.
2. **F7 refresh:** vernieuwen werd overgeslagen zodra er één sporter-blok
   bestond → refresh vernieuwt nu áltijd uitsluitend `source="afgeleid"`.
3. **F9 verdict:** het doel hield een inhoudelijk voortgangsoordeel terwijl de
   uitslag ontbrak → progress wordt nu expliciet `niet_meetbaar` ("onbeoordeeld")
   met de reden erbij.
4. **F12 jeugd fail-open:** onbekende leeftijd kreeg het volwassen
   voedingsmodel op 5 paden → overal `age == null || age < grens` (fail-closed).

## Openstaande eerlijkheid

- TD-13 (wandelen/e-bike uitsluitend Ritme) is gedragsregel in de sportlagen;
  de ritme-motorlaag zelf is sport-agnostisch gebouwd.
- `test-cross-account-isolation` stond al rood op main vóór dit pakket
  (bekend, buiten scope).

## Toets-SHA

De SHA-256 van dit document (exclusief deze regel) is vastgelegd in
`TOETS-SHA.txt` naast dit bestand; eindcommit-SHA van het pakket: zie
`TOETS-SHA.txt`.
