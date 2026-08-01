---
name: Klimmen in Route maken
description: Klimstap in de routeplanner — voorkeuren, specifieke klim via via-punten, server-side meetkundige verificatie.
---

# Klimmen in Route maken

- **Specifieke klim = via-lus**: client stuurt `viaPoints` = [klimvoet (profile.points[0] uit klimdetail), top] + `climbCheck {osmId,name,summitLat,summitLon}` naar `POST /api/routes/generate`. Dit dwingt het ENKELVOUDIGE generate-pad af — de 3-afstanden-kiezer (`/generate/options`) kan geen via-punten garanderen.
- **Verificatie is punt-tot-SEGMENT**, niet punt-tot-punt: een top midden op een lang segment ligt op de lijn maar ver van elk padpunt. Lokaal equirectangulair projecteren rond de top, ≤250 m = `climbInclusion.verified`, anders 422 `CLIMB_NOT_ON_ROUTE`. Verificatie MOET op cache-hit én cache-miss pad draaien (geometrie-cache hergebruikt paden).
- **Deep-link nooit vertrouwen**: `?klim=&klimNaam=&klimLat=&klimLon=` is alleen startselectie; naam/top voor climbCheck komen canoniek uit het serverdetail op osmId (anders kan een geknutselde link een andere plek "geverifieerd" labelen). Coördinaat-bereik valideren bij parse.
- Klimzoeken in de planner: `GET /api/climbs/search?lat=&lon=` (geocode-bypass via `at`); flag-gated op `climb_explorer`. Voorkeuren "enkele"/"max" mappen client-side op elevationPreference "hilly" (+targetElevationGainM) — eerlijk als voorkeur gecommuniceerd, geen garantie.
- **Why:** belofte was "gekozen klim aantoonbaar in de route" — alleen meetgebaseerde verificatie of eerlijke weigering telt.
- E2e-valkuilen: prod-build eerst verversen (serve-prod bouwt NIET zelf); racefiets-kandidaat met onbekend wegdek blokkeert "Bewaar route" tot de expliciete keuze is aangetikt; featureFlagsTable heeft géén `enabled`-kolom (override-rij regelt aan/uit).
