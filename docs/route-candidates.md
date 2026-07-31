# Persoonlijke routebibliotheek uit gekoppelde ritgeschiedenis

Canonieke vastlegging van de opdracht van René (31-07-2026, "AANVULLING —
Persoonlijke routebibliotheek uit gekoppelde ritgeschiedenis"; de gestagede
brontekst staat in `attached_assets/Pasted-AANVULLING-Persoonlijke-routebibliotheek-uit-gekoppelde_1785473481558.txt`)
én van wat daarvan in deel 1 gebouwd is.

## Doel

Geïmporteerde ritten (Strava / Garmin / bestandsupload) zijn niet alleen
activiteitenhistorie maar ook grondstof voor een persoonlijke routebibliotheek.
**Geen tweede routesysteem**: hergebruik van Data Hub-import, routeopslag
(`routes`), profielkeuze en de fail-closed blokkadeverificatie (taak #505).

## Eisen (volledige opdracht)

1. **Routekandidaten opbouwen** uit geïmporteerde ritten: start-/eindgebied,
   afstand, duur, hoogte, wegtype, discipline, rondrit/A-B, fiets, tempo,
   herhalingsfrequentie, recentheid, GPS-dekking, pauzes/uitstapjes, autoritten
   vóór/na, bestaande labels, voorkeuren. Origineel blijft ongewijzigd.
2. **Opschonen en clusteren**: geometrische overlap, start-/doelgebied,
   afstand, hoogte, profiel, richting, terugkerende segmenten. Automatische
   labels ("vaak gereden", "klimroute", …), door de gebruiker te corrigeren.
3. **Transparante kwaliteitsscore**: frequentie, recentheid, GPS-volledigheid,
   consistentie, profielmatch, actuele wegcontrole, keren/stilstand,
   terugkeer naar start, gebruikersbeoordeling. Een oude route is nooit
   automatisch veilig: elke her-voorgestelde/opgeslagen/gestarte route gaat
   door de ACTUELE fail-closed verificatie.
4. **Route zoeken: eerst bestaand** (eigen historie → opgeslagen → gedeeld →
   pas dan nieuw genereren). *(deel 2)*
5. **Gemengde resultaten** (3–5 bestaand + ~2 nieuw, herkomst zichtbaar,
   per voorstel waarom het past). *(deel 2)*
6. **Hybride voorstellen** (bestaande route als basis, aangepast; herkomst en
   aanpassingen bewaard). *(deel 2)*
7. **Privacy en eigendom**: historie standaard privé, nooit automatisch
   openbaar, geen thuisadres delen, privacyzones (loopt via taak #513),
   uitsluiten/verwijderen mogelijk, jeugd-/ouder-/clubrechten.
8. **Onboarding na eerste volle sync**: "X activiteiten → Y bruikbare routes",
   met bekijken/labelen/favorieten/uitsluiten.
9. **Technisch**: nooit zware analyse bij paginalaad; incrementeel;
   route-fingerprints voor duplicaatdetectie; herkomst naar de activiteit;
   activiteiten onveranderd; herverificatie tegen actuele kaartdata; geen
   parallelle route-engine.
10. **Testscenario's**: 300 vergelijkbare ritten, meerdere woonplaatsen,
    gemengde disciplines, autorit vóór/na, slechte GPS, geblokkeerde weg,
    privacyzone, zoek met/zonder passende routes, hybride, dubbele imports,
    labelcorrectie.

## Gebouwd in deel 1 (taak #511)

- **Schema** (`lib/db/src/schema/route-candidates.ts`):
  - `route_candidates` — kandidaat per cluster: fingerprint (unique per
    gebruiker), representatieve geometrie (`[lat,lon]`-paren), rastercellen
    voor overlap-matching, start/eind, lus/A-B, afstand/hoogte/discipline,
    rideCount + tijdvenster, autoLabels + userLabels (correctie wint),
    favorite/excluded, transparante kwaliteitsscore (jsonb met 6 factoren),
    trimmedStart/EndM (eerlijk gemeld weggeknipt vervoer), savedRouteId.
  - `route_candidate_rides` — herkomst per rit (unique per gebruiker+sessie);
    de sessie zelf blijft onaangetast.
  - `route_candidate_scans` — incrementele cursor per gebruiker
    (`lastSessionId`) + eerlijke tellers voor de onboarding-samenvatting.
- **Engine** (`artifacts/api-server/src/lib/ridden-route-candidates.ts`):
  spooranalyse (polyline-decode voor Strava-samenvattingen, geometrie van
  bestandsimports), vervoer-trim aan de randen, slechte-GPS-afkeur,
  celgebaseerde fingerprint (richtinggevoelig) + Jaccard-clustering,
  deterministische labels, transparante kwaliteitsscore. Incrementele scan
  `scanRouteCandidatesForUser` — aangestoten ná een Data Hub-sync
  (`engines/data-hub/index.ts`) en ná een bestandsimport
  (`routes/activity-imports.ts`), nooit bij paginalaad.
- **API** (`routes/route-candidates.ts`, `/api/route-candidates`): lijst +
  onboarding-samenvatting, PATCH (labels/favoriet/uitsluiten), herkomst per
  kandidaat, `POST /:id/save` — bewaart als echte route **uitsluitend** ná de
  actuele fail-closed blokkademeting (zelfde poort als de routemaker; geen
  meting = geweigerd, harde blokkade = geweigerd).
- **Web** (`route-candidates-section.tsx`, Rijden → Bewaard): sectie "Uit jouw
  ritten" met onboarding-banner, labels corrigeren, favoriet, uitsluiten,
  kwaliteitsuitleg per factor + vaste veiligheidsnoot, bewaren-als-route.
- **Tests** (`test:route-candidates`, 13 scenario's): §10-scenario's van
  deel 1 gedekt (300 ritten → cluster, woonplaatsen, disciplines, autorit,
  slechte GPS, dubbele imports, labelcorrectie) + incrementele cursor,
  herkomst en onaangetaste activiteiten.

## Bewust nog niet in deel 1

- §4/5/6 (zoeken-eerst-bestaand, gemengde resultaten, hybride voorstellen).
- Privacyzones (aparte taak #513); tot die tijd blijven kandidaten privé en
  worden ze nergens gedeeld.
- Gebruikersbeoordeling als kwaliteitsfactor (er is nog geen beoordeel-UI op
  kandidaten; het bestaande sterrenregister kan later aanhaken).
- Strava-samenvattingspolylines zijn grover dan bestandssporen; de analyse is
  daar eerlijk over via de GPS-volledigheidsfactor.
