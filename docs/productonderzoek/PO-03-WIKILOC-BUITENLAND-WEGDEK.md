# PO-03 — Kan Wikiloc-routekennis het wegdek-gat buiten Nederland eerlijk vullen?

**Datum:** 30-07-2026 · **Aanleiding:** kalibratie-antwoord René (30-07-2026): buiten NL geldt een eerlijk zwakkere wegdek-belofte (geen BGT-controlelaag). René vroeg of Wikiloc (grote community-routedatabase, veel EU-dekking) die kennis kan aanvullen. Onderzoeksopdracht, geen bouw.

## Conclusie: NEE

Wikiloc kan **niet** legaal en **niet** zinvol als extra buitenland-wegdeksignaal dienen. De alternatieven (waymarkedtrails, Strava-heatmap) voegen evenmin een legaal bruikbaar wegdeksignaal toe boven wat we al uit OSM halen. De buitenland-copy blijft daarom "minder zeker over wegdek".

## 1. Licentie/voorwaarden Wikiloc (het eerste toetspunt — en meteen dodelijk)

Bron: Wikiloc Terms of Use (wikiloc.com/wikiloc/terms_en.html, versie maart 2022, geraadpleegd 30-07-2026):

- **Geen publieke API.** Wikiloc biedt geen developer-API aan; alle bestaande tooling van derden is scraping.
- **Uitsluitend privégebruik.** §1.2: "The User undertakes to use the Services only for domestic and private purposes. The use of the Services … for any purpose other than their personal use, such as commercial, for-profit or business purposes, is not authorised."
- **Scraping expliciet verboden.** "It is prohibited to use robots, spiders or any other mechanism … to access, copy or control any part of the Website … without the express prior authorization from Wikiloc."
- **Sui-generis databankrecht.** Wikiloc claimt het databankrecht op alle content en verbiedt extractie/hergebruik van substantiële delen én herhaalde extractie van niet-substantiële delen.
- Download van content is alleen toegestaan "for personal and non-commercial … use".

Sparki is een commercieel product (entitlement-fundament, Stripe-testomgeving in aanbouw). Elk geautomatiseerd gebruik van Wikiloc-tracks in Sparki schendt dus meerdere bepalingen tegelijk. Dit bevestigt de provider-compliance-les: gratis community-bronnen zijn vrijwel altijd non-commercieel-only.

## 2. Datakwaliteit (zou het inhoudelijk helpen? — ook nee)

Zelfs mét licentie is het signaal ongeschikt voor de wegdek-belofte:

- Community-GPS-tracks zeggen **waar gefietst/gewandeld wordt, niet wat verhard is**. Een druk bereden track kan gravel, singletrack of bospad zijn — juist het soort meters dat de racefiets-belofte (0% aantoonbaar onverhard) moet weren.
- Wikiloc is sterk hiking/MTB-georiënteerd; populariteit daar is eerder een **contra-indicatie** voor racefietsgeschiktheid.
- Tracks zijn momentopnames zonder actualiteitsgarantie en zonder per-wegvak-attributen; ze zijn niet te mappen op de bronneneisen (coverage/actuality/limitations zijn niet objectiveerbaar per wegvak).

## 3. Alternatieven getoetst

- **cycling.waymarkedtrails.org** — visualiseert OSM-fietsrouterelaties (ODbL). De onderliggende data hebben we al volledig via Overpass; het voegt geen wegdekinformatie toe (routerelaties ≠ verhardingstags). De site zelf is een hobby-/donatieproject zonder commerciële API-garantie. Geen winst.
- **Strava Global Heatmap** — licentie staat alleen gebruik voor **OSM-editing** toe, niet als datalaag in een commercieel product; hetzelfde where-not-what-probleem als Wikiloc. Afgewezen.
- **OSM-usage/populariteitssignalen algemeen** — populariteit is geen verhardingsbewijs; de enige eerlijke EU-route blijft OSM-surface-tags + per-land BGT-achtige registers (zie bestaande kandidaat "EU-equivalenten van BGT" in de kalibratie-YAML).

## 4. Doorwerking

- Geen candidate_source toegevoegd; bevinding vastgelegd onder `missing_information` van ROUTES_GENERATOR_001 in `docs/PRODUCT_PROMISES/SPARKI_PROMISE_CALIBRATION.yaml`.
- Buitenland-copy blijft: **"minder zeker over wegdek"** buiten Nederland.
- De echte route naar een betere buitenland-belofte blijft de al genoteerde kandidaat: per land een BGT-achtige controlelaag (ALKIS/ATKIS, GRB, BD TOPO), per land licentie-getoetst vóór EU-uitrol.
