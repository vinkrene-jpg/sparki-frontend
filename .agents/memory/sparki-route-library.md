---
name: Sparki routebibliotheek kwaliteitspoorten
description: Drie harde poorten tegen doodlopende wegen en mini-lusjes in bibliotheekroutes; geometry-vorm-trap.
---

# Routebibliotheek — kwaliteitspoorten

**Regel:** elke bibliotheeklus moet door DRIE poorten (zelfde checks in generator `generateStarterSet` én in eenmalige opruimscripts):
1. `pathOverlapFraction ≤ MAX_LIBRARY_OVERLAP` (0.05) — totaal dubbelgereden aandeel.
2. `longestRepeatedStretchM ≤ MAX_LIBRARY_SPUR_M` (150 m) — langste aaneengesloten heen-en-terug-strook (één spur van ~500 m oogt al als doodlopende weg terwijl de totale overlap piepklein blijft).
3. `smallestSubLoopM ≥ MIN_LIBRARY_SUBLOOP_M` (2500 m) — mini-lusjes hebben GÉÉN dubbel spoor en zijn met overlap/spur onvindbaar; cel-hervisit-metriek nodig.

**Why:** harde eis van de gebruiker: bibliotheekroutes mogen er nooit uitzien als doodlopende weg of mini-rondje. In de praktijk zit het overgrote deel van de lelijke routes in poort 3 (sub-lusjes van honderden meters tot ~1 km) — de overlap-check alleen mist die volledig.

**Traps:**
- `route_library.geometry` is opgeslagen als `[lat, lon]`-PAREN (arrays), niet `{lat,lon}`-objecten. Metrics op objectvorm geven NaN → cleanup "vindt niets".
- Afgewezen lus ⇒ eerlijk géén rij; `generateStarterSet` probeert 2 seeds per combinatie en laat gaten staan; gaten worden bij een volgende vulvraag hervuld (cel-vol-guard op VOLLEDIGE set, niet ≥10).
- ORS-dagquotum raakt op bij massaal hervullen (continu 429) — dan stoppen en hervullen aan quota-vernieuwing/nachttaak overlaten.
- POST /bibliotheek/hier: ligt de woonlocatie in dezelfde cel als het kaartcentrum, dan starten routes exact bij huis.
