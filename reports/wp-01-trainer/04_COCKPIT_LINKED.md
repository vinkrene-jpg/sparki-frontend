# WP-01 — STAP 4: COACHCOCKPIT GEKOPPELD

Geen nieuwe bouw nodig: de bestaande cockpit (`/coach/athletes/:id/cockpit`) dekt de minimale eisen al en is via stap 3 nu ook bereikbaar voor sporters uit een geldige club/teamtoewijzing (zelfde `hasCoachAccess`-poort, zelfde deelniveaus).

## Zichtbaar (bestaand, geverifieerd)
- Naam + afgesproken profielinformatie (deelniveau-gegated), gedeelde planning (PlanningSection), recente gedeelde activiteit, feedback/RPE, planstatus, bestaande traineracties (training toevoegen/wijzigen/herhalen/annuleren, signaalbesluiten, voorstellen, berichten).

## Niet zichtbaar zonder toestemming (bestaand bewijs, opnieuw groen na stap 3)
- coach-parent-sharing-levels 13/13 (none/summary/full), coach-parent-share-nothing 15/15, coach-parent-private-memory 3/3 (alleen visibility=shared), coach-parent-shared-raw-fields 3/3 (nooit rauwe tekst), coach-parent-link-isolation 13/13.
- coach-cockpit-suite 19/19 — o.a.: dashboard 403 zonder coach-rol; signalen fail-closed; coach kan Sparki-/sportertraining niet aanpassen; tweede gekoppelde coach kan trainingen van coach A niet aanraken; context-items 403 bij deelt-niet.
- Oudergegevens en andermans notities: geen leesroute in de cockpit (notes strikt `coachClerkId=caller`).

Geen nieuwe analyse-engine; alleen bestaande berekeningen/API's. Geen codewijziging in deze stap.
