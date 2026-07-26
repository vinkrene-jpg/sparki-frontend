# Providerrechten, attributie en schaalbaarheid voorbereiden
Technische code: RN_01A2
Status: pas uitvoeren nadat DT_01A door René is beoordeeld

## Doel in gewone taal
Maak de bestaande kaart- en navigatieproviders controleerbaar voor commercieel gebruik,
zonder provider te vervangen en zonder nieuwe navigatiefuncties te bouwen.

## Aanleiding
De navigatie-audit vond drie releaseblokkades:
- commerciële gebruiksrechten van webtegelbronnen zijn niet bewezen;
- verplichte Mapbox/OSM-attributie op mobiel is niet aangetroffen;
- OpenRouteService-accounttier en productielimieten zijn onbekend.

## Toegestaan
- Bestaande providerconfiguratie inventariseren.
- Alle providerverwijzingen centraliseren in documentatie.
- Vastleggen welke accountgegevens René buiten de code moet controleren.
- Officiële voorwaarden en attributie-eisen als bewijs opnemen.
- Een technische wijzigingsspecificatie maken voor ontbrekende attributie.
- Alleen tests of audithelpers toevoegen wanneer zij geen runtimegedrag wijzigen.

## Verboden
- Geen kaartprovider vervangen.
- Geen nieuwe provider toevoegen.
- Geen productiesleutels tonen in rapporten.
- Geen kaart- of navigatie-UI wijzigen.
- Geen attributiecode implementeren zonder aparte bouwgoedkeuring.
- Geen offline caching bouwen.
- Geen 3D bouwen.
- Geen Overpass-clients samenvoegen.
- Geen deployment.

## Onderzoek
Voor iedere aangetroffen provider:
- naam en functie;
- alle bestanden en endpoints;
- web of mobiel;
- account- of billingtier: bewezen, onbekend of niet van toepassing;
- limieten en rate limits;
- commercieel gebruik;
- verplichte attributie;
- caching en offlinevoorwaarden;
- privacy- en logrisico;
- fallbackgedrag;
- productie- en schaalrisico;
- benodigde beslissing door René.

Minimaal:
- Mapbox;
- OpenRouteService;
- CARTO;
- OSM standaardtiles;
- CyclOSM;
- Esri;
- Overpass;
- Nominatim;
- iedere overige aangetroffen provider.

## Verplichte oplevering
Maak:
- `docs/SPARKI_PROVIDER_REGISTER.md`
- `docs/SPARKI_PROVIDER_COMPLIANCE_MATRIX.csv`
- `docs/SPARKI_PROVIDER_ACCOUNT_CHECKLIST.md`
- `docs/SPARKI_ATTRIBUTION_IMPLEMENTATION_SPEC.md`
- `docs/SPARKI_PROVIDER_EVIDENCE.json`

## Accountchecklist voor René
Geef exact aan waar René moet kijken voor:
- actief abonnement;
- maandelijkse of dagelijkse limieten;
- toegestane commerciële toepassing;
- offline- en cachegebruik;
- facturatie- en overschrijdingsrisico;
- domein- of applicatiebeperkingen.

Vraag nooit om sleutels of wachtwoorden in documentatie te plakken.

## Attributiespecificatie
Beschrijf exact:
- welke tekst of logo verplicht is;
- op welke schermen;
- minimale zichtbaarheid;
- klikbare links waar vereist;
- gedrag bij fullscreen navigatie;
- mobiel en web;
- tests die later moeten bewijzen dat attributie zichtbaar blijft.

Bouw dit nog niet.

## Acceptatie
- Geen productiecode gewijzigd.
- Geen provider vervangen.
- Geen geheimen in bewijsbestanden.
- Alle onzekerheden expliciet benoemd.
- Iedere juridische of productclaim ondersteund door officiële providerbron.
- Een aparte, kleine latere bouwopdracht kan rechtstreeks uit de specificatie worden gemaakt.
