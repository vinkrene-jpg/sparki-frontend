# Attributie-implementatiespecificatie (bouwspec — NOG NIET BOUWEN)

Opdracht RN_01A2, 26 juli 2026. Deze specificatie beschrijft exact welke attributie
ontbreekt en hoe een latere, kleine bouwopdracht die moet toevoegen. In déze
opdracht is bewust niets gebouwd (verbod uit de opdracht). Een aparte
bouwgoedkeuring van René is vereist.

---

## A. Mobiele app — Mapbox-attributie (hoogste prioriteit, releaseblokkade RB-2)

**Officiële eis** (https://docs.mapbox.com/help/dive-deeper/attribution/): kaarten met
Mapbox-stijlen of -data moeten **twee** onderdelen tonen:

1. **Mapbox-logo** (het gestileerde woordmerk) — op de kaart zelf, standaard linksonder;
   een andere hoek mag, weglaten niet. Officiële logo-assets: wit en donker beschikbaar
   via Mapbox (voor onze donkere `dark-v11`-stijl: de witte variant).
2. **Tekst-attributie** met drie klikbare links:
   `© Mapbox` → https://www.mapbox.com/about/maps/
   `© OpenStreetMap` → https://www.openstreetmap.org/copyright
   `Improve this map` → https://apps.mapbox.com/feedback/ (met kaartpositie waar mogelijk)

**Waar (elke plek die `UrlTile` met `MAPBOX_TILE_URL` rendert):**

| Scherm/component | Bestand | Bijzonderheid |
|---|---|---|
| Rit opnemen | `app/(app)/record.tsx` via `components/TrackMap.tsx` | kaart deels bedekt door HUD-overlays — attributie mag NIET overlappen met bestaande overlays (kaart krimpt al voor overlays; attributie in de kaarthoek die vrij blijft) |
| Rit-detail | `app/(app)/ride/[id].tsx` via `TrackMap`/`RouteMap` | statische kaart, linksonder vrij |
| Navigatie (HUD) | `app/(app)/navigate/[id].tsx` | fullscreen navigatie — zie regel "fullscreen" hieronder |
| Volgauto-chauffeursmodus | `components/VolgautoDriverMode.tsx` | eigen kaartweergave, zelfde eis |

**Aanpak (voorstel voor de bouwopdracht):** één herbruikbare component
`MapboxAttribution` (logo + tekstregel) die in `TrackMap` en `RouteMap` zelf wordt
gerenderd — dan is elke huidige én toekomstige consument automatisch gedekt.
Props: hoekkeuze (om HUD-overlaps te vermijden). Links openen via
`Linking.openURL`.

**Minimale zichtbaarheid:**
- Logo: minimaal ~50 px breed, niet transparanter dan 70%, altijd binnen het kaartvlak.
- Tekstregel: leesbaar (≥10 pt equivalent), contrasterend op de donkere kaart, mag
  compact ("© Mapbox © OpenStreetMap · Verbeter deze kaart") maar alle drie de links
  moeten tikbaar zijn. NB: linklabels mogen in het Nederlands ("Verbeter deze kaart"),
  de © -vermeldingen zelf zijn merknamen en blijven zoals ze zijn.

**Fullscreen navigatie:** Mapbox staat toe dat tekst-attributie achter een
info-knop zit bij kleine/fullscreen weergaven, maar het **logo moet zichtbaar
blijven**. Voorstel: tijdens actieve navigatie logo klein linksonder in het
kaartvlak; tekst-attributie achter een ⓘ-knop die een klein paneel opent
(zelfde patroon als de bestaande HUD-panelen; nooit bovenop de kaartoverlays).

**Offline/edge:** zonder Mapbox-token wordt geen Mapbox-kaart getoond
(`hasMapbox=false`) — dan ook geen Mapbox-attributie tonen (geen logo op een
niet-Mapbox-oppervlak).

## B. Web — bestaande attributie (grotendeels op orde, drie verbeterpunten)

Aanwezig en correct: alle vijf Leaflet-kaartcomponenten tonen
`© OpenStreetMap © CARTO` (of de laagspecifieke variant OSM/CyclOSM/Esri) via de
attributionControl, met klikbare links.

Verbeterpunten voor dezelfde bouwopdracht:
1. **`attributionControl.setPrefix(false)`** verwijdert het Leaflet-prefix — dat is
   toegestaan (Leaflet-attributie is geen juridische eis van de tegelbronnen), geen
   actie nodig; alleen vastgelegd.
2. **Referer:** de OSMF-tilepolicy eist dat vanaf webpagina's een geldige HTTP
   Referer meegaat. Controleer dat de app geen `Referrer-Policy: no-referrer` zet
   (test hieronder).
3. **Zichtbaarheid op mobiele viewport:** de attributieregel mag op smalle schermen
   niet achter de onderste navigatiebalk verdwijnen (bekende z-index-valkuil);
   visuele test vereist.

## C. Weerdata — Open-Meteo (CC BY 4.0)

**Eis** (https://open-meteo.com/en/terms + /en/licence): bronvermelding onder CC BY 4.0
bij weergegeven weerdata.

**Waar weer zichtbaar is:** Vandaag-scherm (thuisweer + rit-advies), race-voorbereiding
(wedstrijdweer), routenavigator web (actuele wind).

**Voorstel:** één klein, vast bronregeltje "Weergegevens: Open-Meteo.com" (klikbare
link) op de plek waar het weerblok gerenderd wordt — via de bestaande
uitleglaag/bronvermeldingspatronen (bronnenregister bestaat al). Eén gedeelde
component zodat elk toekomstig weeroppervlak automatisch meedoet. Geen "AI"-,
geen Engelse UI-teksten (provider-eigennaam "Open-Meteo.com" is toegestaan als
eigennaam).

## D. Klimomschrijvingen — Wikipedia (CC BY-SA)

Bronlabels "Wikipedia"/"Wikidata" bestaan al in de web-UI (`climb-types.ts`).
CC BY-SA vereist naamsvermelding **met link naar het bronartikel** en vermelding
van de licentie bij overgenomen tekst. Bouwopdracht: controleer of het klimdetail
de bronlink toont; zo niet, bronlabel klikbaar maken naar het artikel en
"(CC BY-SA)" toevoegen. Wikidata (CC0) vereist juridisch niets; label mag blijven.

## E. Overpass/Nominatim-afgeleide data — ODbL

`route-surfaces.ts` en `route-remarks.ts` verwijzen al naar
openstreetmap.org/copyright. Kaartschermen tonen OSM-attributie. Klimmenverkenner
en POIs tonen OSM-afgeleide data óp een kaart met OSM-attributie — dat dekt de eis.
Geen extra bouwwerk nodig; alleen de regel: **elke nieuwe niet-kaart-weergave van
OSM-afgeleide data krijgt een "Gegevens: © OpenStreetMap-bijdragers (ODbL)"-regel.**

## F. Tests die de latere bouwopdracht moet leveren (bewijs dat attributie zichtbaar blijft)

1. **Mobiel (unit/render):** `TrackMap` en `RouteMap` renderen bij `hasMapbox=true`
   het logo-element én de drie links; bij `hasMapbox=false` géén van beide.
2. **Mobiel (protocol):** uitbreiding van `docs/mobile-testprotocol.md` — visuele
   controle in record-, ride-, navigate- en volgautoscherm dat logo + ⓘ zichtbaar
   zijn en niet door HUD-overlays bedekt worden (portret + liggend).
3. **Web (e2e/DOM):** op elk van de vijf kaartcomponenten bevat
   `.leaflet-control-attribution` de verwachte links; bij laagwissel in de navigator
   wisselt de attributie mee (CARTO→OSM→CyclOSM→Esri).
4. **Web (headers):** responsheaders van de app bevatten geen Referrer-Policy die de
   Referer naar tegelservers blokkeert.
5. **Weer:** elk oppervlak dat weerdata toont rendert de Open-Meteo-bronregel
   (querybare testid); geen weer = geen bronregel (eerlijkheid).
6. **Regressie:** bestaande navigatietests blijven groen; attributie mag geen
   interactie-elementen bedekken (tap-target-test op mobiel).

## G. Uitdrukkelijk NIET in deze spec

Geen providerwissel, geen nieuwe provider, geen offline caching, geen 3D, geen
samenvoegen van Overpass-clients, geen deployment. Dit document is uitsluitend de
bouwtekening; implementatie vereist een aparte, kleine bouwopdracht met
goedkeuring van René.
