# Technische controle van kaarten en navigatie
Technische code: RN_01A

## Waarom
Voordat nieuwe kaarten, navigatiegedrag, 3D, waypoints of sfeer worden gebouwd, moet eerst aantoonbaar worden vastgesteld wat al aanwezig is, hoe het werkt en waar de risico's zitten.

Dit is uitsluitend een audit. Bouw niets nieuws.

## Harde tijdgrens
Maximaal 4 uur totale uitvoeringstijd.

Stop na 4 uur, ook wanneer niet alles is afgerond. Lever dan de bevindingen, ontbrekende informatie en een voorstel voor het vervolg. Ga niet zelfstandig door.

## Toegestaan
- Repository en bestaande documentatie lezen.
- Bestaande tests uitvoeren.
- Bestaande applicatie lokaal starten wanneer nodig.
- Bestaande route-, kaart- en navigatiecode inventariseren.
- Bestaande prestaties, providerverzoeken en foutgedrag meten.
- Alleen auditdocumenten en bewijsbestanden toevoegen.

## Verboden
- Geen productiecode wijzigen.
- Geen visuele wijziging.
- Geen nieuwe kaartstijl of ontwerpvariant.
- Geen database- of schemawijziging.
- Geen migratie.
- Geen nieuwe dependency.
- Geen provider vervangen.
- Geen deployment.
- Geen refactor of herschrijving.
- Geen oplossing bouwen voor gevonden problemen.

## Verplichte onderzoeksvragen

### 1. Huidige architectuur
Leg vast:
- gebruikte componenten en bestanden voor routeplanner en navigatie;
- gebruikte kaart-renderer;
- gebruikte kaart- en tegelproviders;
- gebruikte routingprovider;
- gebruik van OSM/Overpass;
- GPS-, map-matching-, off-route- en reroutinglogica;
- klimdetectie en hoogteprofiel;
- waypoints en routepunten;
- offline- en cachemechanismen;
- feature flags;
- relevante API's, tabellen en databronnen.

Maak een eenvoudig afhankelijkheidsoverzicht. Benoem wat gedeeld wordt en waar dubbele of parallelle logica bestaat.

### 2. Bewijs van huidige werking
Geef per functie één status:
- BEWEZEN_WERKEND
- AANWEZIG_MAAR_ONBEWEZEN
- ONTBREEKT
- DEFECT
- NIET_TE_VERIFIËREN

Onderzoek minimaal:
- route aanmaken;
- route wijzigen;
- waypoints;
- GPS-positie;
- kaart volgen en vrij bewegen;
- handmatig zoomen;
- off-route-detectie;
- automatische rerouting;
- terugkeer op de route;
- terug naar start;
- klimkaart;
- 2D/3D-mogelijkheden;
- offline routecorridor;
- fietsprofielen weg/gravel/MTB.

### 3. Provider-, licentie- en schaalrisico
Onderzoek voor Mapbox, OpenRouteService, Overpass en andere aangetroffen providers:
- huidige account- of facturatietier, voor zover aantoonbaar;
- huidige limieten;
- actuele gebruikspunten in de code;
- verwachte productiebelasting;
- rate-limit-gedrag;
- caching- en offlinevoorwaarden;
- attributieverplichtingen;
- commercieel gebruik;
- risico van publieke endpoints;
- wat niet kon worden geverifieerd.

Geen aannames als feit opschrijven. Verwijs naar concrete configuratie, code, accountinstelling of officiële bron.

### 4. Prestatie en batterij
Meet of inventariseer:
- initiële laadtijd van de kaart;
- bundelbijdrage van kaartbibliotheken;
- geheugengebruik voor zover praktisch meetbaar;
- frequentie van locatie-updates;
- frequentie van providerverzoeken;
- mogelijke batterijrisico's;
- gedrag bij zwak of wegvallend GPS-signaal.

### 5. Open productbeslissingen
Lever een aparte beslislijst voor René op. Neem minimaal op:
- concrete off-route-drempel;
- aantal opeenvolgende GPS-metingen;
- wanneer waarschuwen;
- wanneer automatisch herrouteren;
- terug naar oorspronkelijke route of verder naar bestemming;
- wanneer een routewijziging bevestiging vereist;
- afhankelijkheid van klimkaart aan het toekomstige kaartlagensysteem;
- gegevensbehoefte voor mogelijke 3D-weergave;
- offline haalbaarheid per kaartsoort.

Geen waarden zelf als productbesluit invoeren. Geef wel technische bandbreedtes en consequenties wanneer de repository of meetresultaten dat ondersteunen.

## Verplichte oplevering
Maak uitsluitend deze auditbestanden:

- `docs/SPARKI_RN_01A_CURRENT_STATE.md`
- `docs/SPARKI_RN_01A_PROVIDER_RISK.md`
- `docs/SPARKI_RN_01A_OPEN_DECISIONS.md`
- `docs/SPARKI_RN_01A_EVIDENCE.json`

Het evidencebestand bevat minimaal:
- onderzochte commit;
- datum en duur;
- uitgevoerde commando's;
- testresultaten;
- aangetroffen providers;
- gewijzigde bestanden;
- bevestiging dat geen productiecode is gewijzigd.

## Eindrapport
Sluit af met:
1. belangrijkste 10 bevindingen;
2. releaseblokkades;
3. technische risico's;
4. onderdelen die hergebruikt kunnen worden;
5. onderdelen die mogelijk defect of dubbel zijn;
6. ontbrekende bewijsstukken;
7. voorstel voor de kleinste veilige vervolgstap.

Markeer geen onderdeel als gereed voor productie. Doe geen zelfstandig bouwvoorstel buiten de audit.
