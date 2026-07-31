# RRA_2026-07-31_bibliotheek-straal-zoeken

Risicoanalyse voor de wijziging aan `artifacts/api-server/src/routes/routes.ts`
(endpoint `GET /api/routes/bibliotheek`): naast de bestaande kaartuitsnede
(bbox) accepteert het endpoint nu ook `lat`/`lon`/`radiusKm` en filtert het
bibliotheekroutes op werkelijke hemelsbrede afstand van hun startpunt tot het
gezochte startpunt (correctie René 31-07-2026: bij zoeken op plaatsnaam nooit
stilzwijgend routes tientallen kilometers verderop tonen).

| Veld | Invulling |
|---|---|
| Betreffende regel | `routes.ts`, handler `GET /bibliotheek`: nieuwe straal-variant — parametervalidatie (lat −60..75, lon −30..45, radiusKm 0,5..100), ophaal-bbox afgeleid van de straal, daarna exacte filter `haversineKm(start, centrum) ≤ radiusKm`, `startAfstandKm` per route (1 decimaal) en sortering op afstand. Geen bestaande poort of afkeurregel gewijzigd. |
| Verwachte werking | Bij zoeken rond een punt worden uitsluitend routes teruggegeven waarvan de start binnen de gevraagde straal ligt, met eerlijke afstandsvermelding; de bbox-variant blijft byte-gelijk aan het oude gedrag. |
| Mogelijke faalwijzen | (a) foute haversine-implementatie ⇒ verkeerde afstanden; (b) te krappe ophaal-bbox ⇒ routes op de rand van de straal gemist; (c) cos(lat)→0 bij extreme breedte ⇒ delen door bijna nul; (d) parameterverwarring tussen bbox- en straalvorm. |
| Foutpositieven | Onterecht uitsluiten kan alleen als de ophaal-bbox krapper is dan de straal. De bbox gebruikt dLat=radius/111 en dLon=radius/(111·cos(lat)) met een cos-vloer van 0,2 — op NL/BE-breedtes (~52°) is die bbox ruimer dan de cirkel, dus geen uitsluiting binnen de straal. De cos-vloer maakt de bbox alleen maar ruimer, nooit krapper. **Aanscherping na reviewronde (zelfde dag):** de DB-limiet van 60 rijen was rating-gesorteerd en kon dichtbijgelegen routes verdringen (vals-lege uitslag); in straal-modus haalt `routesInBbox` nu onbeperkt op en beperkt `filterOpStraal` pas ná de afstandssortering tot 60 — gedekt door de 70-rijen-regressiecase. Acceptabel restrisico: geen. |
| Foutnegatieven | Routes buiten de straal doorlaten kan niet: de exacte haversine-filter loopt over álle opgehaalde rijen en verwerpt d>radius, onafhankelijk van de bbox. De haversine is de standaardformule (R=6371) en wordt door de nieuwe regressietest tegen bekende afstanden gecontroleerd. |
| Gedrag bij timeout | Er is geen externe meting: het endpoint leest uitsluitend de eigen database (`routesInBbox`). Een DB-fout valt in de bestaande catch en geeft 500 met eerlijke foutmelding — nooit een stil leeg "succes". |
| Gedrag bij onbereikbare kaartbron | Niet van toepassing op dit endpoint (geen Overpass/BGT/GRB-aanroep). De geocodering die het startpunt levert loopt via het bestaande `/geocode`-endpoint dat bij een onbereikbare provider 503/500 geeft; de webclient toont dan "Zoeken lukte niet" en laadt géén routes op een gokpositie. |
| Gedrag bij gedeeltelijke data | Routes zonder geldige startcoördinaten bestaan niet in `route_library` (NOT NULL-kolommen `start_lat`/`start_lon`); er is dus geen pad waarin een route zonder start "voor de zekerheid" wordt getoond. Ongeldige of ontbrekende query-parameters geven 400, nooit een default-straal. |
| Risico bij lange routes | De filter gebruikt alleen het startpunt, niet de geometrie — routelengte is irrelevant voor de rekentijd. Limiet van 60 rijen uit `routesInBbox` blijft gelden. |
| Risico bij gelijktijdige routes | Endpoint is read-only en stateless; geen gedeelde cache, geen rate-limited externe bron. Gelijktijdige straal- en bbox-aanvragen beïnvloeden elkaar niet. |
| Counterexamples | (1) Route met start ~7 km van het centrum bij straal 5 km ⇒ uitgesloten (getest in `test:route-library-straal`). (2) Straal-parameters buiten bereik (radiusKm=0, radiusKm=1000, lat=NaN) ⇒ 400, geen fallback naar bbox of default (zelfde test). (3) Bekende afstand Hengelo(OV)–Enschede ≈ 9 km ⇒ haversine binnen 5% van de referentie. |
| Fail-closed gedrag | Elk onduidelijk pad eindigt in weigeren of eerlijk-leeg: ongeldige parameters ⇒ 400; DB-fout ⇒ 500; geen routes binnen straal ⇒ lege lijst waarbij de UI expliciet zegt dat er niets dichtbij is en verruimen een expliciete gebruikerskeuze is. Er bestaat geen pad dat stilzwijgend de straal vergroot of op de oude bbox terugvalt. |
| Benodigde regressietests | Bestaand: `test:route-library-gates` (poorten ongemoeid), `test:routing-generated` (generatie ongemoeid). Nieuw: `test:route-library-straal` (artifacts/api-server/src/tests/route-library-straal.ts) — haversine-referentie, binnen/buiten-straal-filter, afstandssortering, parametervalidatie 400, bbox-variant ongewijzigd. |

**Ondertekening:** 31-07-2026, ingevuld door Replit Agent (main); ter beoordeling
in de architect-reviewronde van deze oplevering (AI-reviewgovernance v3).
