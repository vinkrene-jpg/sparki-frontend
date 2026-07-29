# PRODUCTONDERZOEK PO-01 — Routes die écht geschikt zijn voor je gekozen fiets

Conform Product Proof Doctrine art. 9. Status: **TER GOEDKEURING** — geen implementatie gestart.
Datum: 29 juli 2026 · Taak #419

## 1. Productbelofte

> "Een wielrenner genereert binnen 30 seconden een route die aantoonbaar geschikt is voor zijn gekozen fiets: geen verboden wegen, geen ongeschikt wegdek, en een hoogtebeeld dat klopt."

## 2. Huidige Sparki-aanpak (feitelijk)

- **Routing**: OpenRouteService (ORS) publieke API, profielen `cycling-road` / `cycling-regular` / `cycling-mountain`; `avoid_features` beperkt tot ferries/trappen; rondritten via `round_trip` + eigen best-of-N-lusconstructie met kwaliteitspoorten (overlap/spur/mini-lus).
- **Wegdek/wegtype/verboden wegen**: NÁ het routeren bepaald via Overpass (OSM) — `route-surfaces.ts` telt o.a. `bicycle=no`, `access=private`, onverhard, kasseien.
- **Geschiktheid**: `computeBikeSuitability` rekent achteraf een oordeel uit op basis van die Overpass-verdeling.

**De structurele fout**: de motor die de route kiest (ORS) kent de criteria niet waarop Sparki de route daarna beoordeelt. Sparki genereert eerst en keurt daarna af — vandaar routes met tientallen "hier mag je niet fietsen"-meldingen. Dit is geen bug maar een architectuurkeuze: beoordeling en generatie zijn gescheiden.

## 3. Best beschikbare marktbenadering

| Product | Aanpak |
|---|---|
| **Komoot** | Eigen routing per sporttype; wegdek/wegtype-classificatie zit ÍN de routekeuze; moeilijkheidsgraad per sport; toont way type & surface vooraf. De facto de belofte-referentie. |
| **RideWithGPS** | OSM-wegdekdata in de planner ("never over- or under-biked"); paved/unpaved/unknown eerlijk getoond, incl. "unknown" als aparte categorie. |
| **Strava** | Populariteitsheatmap als extra signaal: waar fietsers echt rijden. |

Onder de motorkap gebruiken zulke producten **surface-bewuste kostenfuncties tijdens het routeren**:

- **GraphHopper custom models** (JSON-regels: `if surface==GRAVEL → multiply priority`, `bike_access==no → 0`): beschikbaar in de betaalde GraphHopper Directions API én open-source self-hosted.
- **BRouter**: open-source, puur voor fietsen gebouwd; profielen (`.brf`) geven volledige controle over wegdek-, wegtype- en toegangskosten per fietstype; zeer lichte hosting (segmentbestanden, bescheiden RAM).
- **Valhalla**: dynamic costing per request, self-hosted.
- **ORS custom models**: bestaan, maar **experimenteel en expliciet NIET beschikbaar op de publieke API** — alleen self-hosted. De publieke ORS-API die Sparki gebruikt kan wegdek/fietsverbod dus principieel niet vermijden (bevestigd in ORS-docs en issue #107).

Conclusie markt: **niemand die deze belofte waarmaakt, beoordeelt achteraf; iedereen stuurt tijdens het routeren.**

## 4. Benodigde databronnen

- OSM-tags `surface`, `highway`, `bicycle`, `access`, `tracktype`, `smoothness` — dezelfde data die Sparki nu al via Overpass leest, maar dan ín de routing-graaf.
- Hoogtedata uit één bron voor zowel profiel als hoogtemeters-som (huidige tegenspraak komt door twee bronnen/berekeningen).
- Optioneel later: populariteitssignaal (heatmap-achtig) — niet nodig voor de kernbelofte.

## 5. Benodigde algoritmen

1. **Surface-bewuste kostenfunctie per fietstype** tijdens het routeren (racefiets: onverhard/kasseien zwaar bestraffen, `bicycle=no` uitsluiten; gravel/MTB: eigen wegingen).
2. **Verificatiepoort ná generatie** (hergebruik van bestaande Overpass-analyse): route wordt pas getoond als `restrictedKm == 0` en offroad% onder de fietstype-drempel; anders automatisch opnieuw genereren (best-of-N bestaat al) of eerlijk "geen geschikte route gevonden".
3. **Eén hoogtepijplijn**: profiel én som uit dezelfde reeks.

## 6. Benodigde architectuur

Sparki heeft al een provider-abstractie (`routing/providers/`). Drie realistische invullingen:

- **Optie A — BRouter self-hosted** (voorkeur): fiets-specifiek, gratis, volledige profielcontrole, lichte hosting (NL/EU-segmenten passen binnen de Replit-limieten). Lussen bouwt Sparki al zelf. Gap: zelf beheren + eigen lus-logica blijft nodig.
- **Optie B — GraphHopper Directions API met custom models**: managed, snelste route naar kwaliteit, round-trips ondersteund. Gap: doorlopende API-kosten, EU-schaal telt aan.
- **Optie C — ORS behouden + alleen de verificatiepoort (fase 1)**: geen nieuwe motor; bestaande Overpass-analyse verschuift van "informatie achteraf" naar "poort vooraf" (afkeuren + hergenereren i.p.v. tonen met meldingen). Haalt de ergste vertrouwensbreuk weg, maar kan de belofte nooit volledig waarmaken (de motor blijft blind voor wegdek).

## 7. Gaps (huidige situatie → belofte)

| Gap | Oorzaakcategorie (doctrine art. 5) |
|---|---|
| Motor kent wegdek/fietsverbod niet | **verkeerde databron/architectuur** (publieke ORS-API kán het niet) |
| Beoordeling achteraf getoond i.p.v. afgedwongen vooraf | onvoldoende validatie |
| Hoogteprofiel ≠ hoogtemeters | onvoldoende integratie (twee bronnen) |
| Bergklassement op vlakke route, "gedeeltelijk geschikt" zonder waarom | onvoldoende validatie/verantwoording |

## 8. Voorgestelde oplossing (gefaseerd, elk met eigen Product Proof)

- **Fase 1 (direct)**: verificatiepoort + één hoogtepijplijn op de bestaande ORS-motor (optie C). Bewijs: gegenereerde racefietsroutes bevatten 0 km verboden weg of worden niet getoond; profiel en som identieke bron.
- **Fase 2 (de belofte zelf)**: motorwissel naar **BRouter self-hosted** (optie A), met GraphHopper API (optie B) als terugvaloptie als hosting binnen Replit niet haalbaar blijkt. Bewijs: steekproef van 25 routes per fietstype, onafhankelijk getoetst op wegdek/legaliteit/consistentie, score ≥9,0.

Doctrine-toets art. 9 laatste zin: er wordt dus **niet** versmald naar de huidige beperkingen — fase 2 bewijst eerst of de betere oplossing haalbaar is; alleen aantoonbare onhaalbaarheid van A én B zou versmalling rechtvaardigen.

**Beslispunt voor René**: akkoord met fase 1 + fase 2-richting (BRouter eerst verkennen)? Bij optie B horen doorlopende kosten — die keuze is aan jou.
