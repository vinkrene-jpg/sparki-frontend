---
name: Sparki Mechanieker & materiaalkring
description: Multi-bike garage wave — derived usage, honest maintenance signals, equipment choices; key contracts and traps.
---

**Rules:**
- km/uren per fiets/component worden ALTIJD live afgeleid uit gekoppelde `training_sessions.bike_id` (nooit een teller) — verwijderde/dubbele activiteit corrigeert zichzelf.
- Auto-link gokt nooit: alleen Strava gear_id of precies één actieve fiets; `bike_link_source="handmatig"` (ook handmatige ONTkoppeling met bikeId null) wordt nooit overschreven.
- Drie signaalniveaus strikt gescheiden: controleadvies / vermoedelijke_slijtage (km-drempels) / vastgesteld_defect — dat laatste ALLEEN uit eigen gebruikersregistratie (event/status), nooit uit foto's of km. Nul gebruiksdata = nul signalen.
- Vandaag-context filtert controleadviezen weg (relevantSignals); garage/wedstrijd tonen alles. Op Vandaag rijdt het paneel mee als compact (null bij leeg) — aandachtswet blijft intact.
- Event "vervanging" schuift `installedAt` naar de eventdatum (km-historie start op 0); kmAtEvent is de afgeleide stand op dat moment.
- Scanweergave heet eerlijk "Interactieve fotoweergave" (eigen foto's); alleen het parametrische Bike3D-model mag "3D" heten.

**Traps:**
- POST /components vergat `installedAt` te persisteren → componentgebruik viel stil terug op registratiedatum; route-test op `basis: "montagedatum"` ving dit.
- equipment_choices upsert: partiële unieke indexen (clerkId+raceId / clerkId+workoutId, WHERE NOT NULL) + `onConflictDoUpdate` met **`targetWhere`** (niet `where` — dat is deprecated/ambigu in deze drizzle-versie; `where` gaf "no unique constraint matching ON CONFLICT" 500).

**Test:** `test:mechanieker` (17 scenario's, route-level, twee users, run via shell wegens workflow-limiet).
