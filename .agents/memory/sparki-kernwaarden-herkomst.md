---
name: Kernwaarden herkomst-herstel (WP-K1..K3, K5)
description: Elk kernwaarde-schrijfpad moet een paspoort-event meeschrijven; herkomststatus op kaarten; laaddiscipline; simulatielabel.
---

Regel: een kernwaarde (ftp, weightKg, weeklyHourTarget, discipline, …) mag NOOIT
zonder paspoort-event veranderen — anders toont composePassport "herkomst onbekend".

- `recordEventsForPatch(input, tx)` in lib/passport.ts is de standaard voor
  patch-gebaseerde upserts (onboarding, seeds): oude rij vooraf lezen, upsert +
  events in ÉÉN transactie. `applyValueChange` blijft voor losse veld-updates.
- **Why:** onderzoek 2026-07-31 vond 5+ schrijfpaden (onboarding quick-start/V2/
  missing-data/answer, Strava-connector, profile-consistency, demo-seeds) die
  waarden zonder event schreven → kaarten met kale getallen/herkomst onbekend.
- **How to apply:** elk NIEUW schrijfpad naar athlete_profiles-kernvelden moet óf
  applyValueChange óf recordEventsForPatch in dezelfde tx gebruiken. Regressie:
  test:kernwaarden-herkomst (route-contract tegen echte app).

Valkuilen:
- Strava-FTP is een echte gebruikersinstelling: origin "berekend" (bron Strava)
  maar ftpEstimated MOET false blijven (extra update in zelfde flow), anders
  overschrijft de ondergrens-engine hem weer.
- Compare-and-set-paden (profile-consistency): update+event samen in tx, event
  alleen bij >0 rijen — guard niet slopen.
- GET /api/athlete/profile levert `herkomst` per kernveld ({origin, estimated,
  stale}); web-consumers (home-kop, Kerngetallen) tonen "· geschat"/"· niet
  bevestigd" — labels renderen via CSS uppercase, e2e-teksts dus case-insensitive
  matchen.
- WP-K3: "nog niet bekend"-empty-states pas renderen als de query klaar is
  (laadt-prop → skeleton); analyse-switch toont spinner tijdens flags-laden.
- WP-K5: "Verkenning · simulatie" staat vast op Doelscenario + Wattage-lab,
  nergens anders.
