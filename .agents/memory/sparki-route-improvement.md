---
name: Sparki routebibliotheek-verbeterlus
description: Slecht beoordeelde bibliotheekroutes automatisch vervangen op echte feedback — ontwerpregels.
---

# Routebibliotheek-verbeterlus

Rule: een bibliotheekroute met gem. < 3 bij ≥ 3 echte stemmen wordt op de
achtergrond vervangen door een nieuw echt-gegenereerde variant. Terugkerende
opmerkingen sturen alleen de KEUZE tussen echte provider-kandidaten — nooit
geometrie-bewerking, nooit verzonnen scores.

**Why:** eerlijkheid. Eén losse opmerking of dezelfde gebruiker twee keer mag
de generatie niet sturen (terugkerend = ≥ 2 verschillende gebruikers);
tegenstrijdige feedback (te vlak én te zwaar) ⇒ geen sturing. De opvolger
start zonder rating (scores nooit erven) en draagt een eerlijke uitleg over
welke echte feedback meewoog.

**How to apply:**
- Het origineel blijft bestaan (commentaar-historie) met status "vervangen"
  + verwijzing naar de opvolger; lijstweergaven filteren op actief, details
  van oude links blijven opvraagbaar.
- Opvolger-insert en status-flip van het origineel horen in één transactie
  met status-guard; flipte er niets (elders al vervangen) ⇒ nieuwe rij
  terugdraaien. Generatienummer zit in de idempotentiesleutel.
- Vervanging is fire-and-forget na het commentaar; falen laat de oude route
  staan — nooit een gat op de kaart.
- Bewijsbatch 30-07-2026 (12 lussen MTB/gravel/race 25–200 km, Hengelo): afstandsspec altijd binnen ±13%, maar 11/12 lussen bevatten blokkerende obstakels (afgesloten poorten, trappen, fietsverbod). Oorzaak: LUS-generatie meet obstakels binnen het 2000–2500 ms omgevingsbudget en faalt open (ENV-COVERAGE env=miss); de blokkerend-wachten-fix van het koude-cache-gat dekt alleen waypoint/PTP. Herbruikbare tooling: src/tests/route-bewijsbatch.ts + route-bewijsbatch-remarks.ts (incrementeel op RESULT_FILE, in-process getRouteRemarks zonder 18s-previewbudget; Overpass 14–98 s per lus).
