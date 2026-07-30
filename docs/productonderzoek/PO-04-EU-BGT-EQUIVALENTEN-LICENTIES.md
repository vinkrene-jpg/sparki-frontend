# PO-04 — Licentietoets BGT-achtige wegdekbronnen per EU-prioriteitsland (BE per gewest/DE/FR)

**Datum:** 30-07-2026 · **Aanleiding:** PO-03 sloot Wikiloc/heatmaps uit als buitenland-wegdeksignaal; de enige eerlijke route naar een sterkere wegdek-belofte buiten NL is per land een BGT-achtige controlelaag. De kalibratie-YAML (ROUTES_GENERATOR_001) noteerde: "per-land-licenties niet uitgezocht". Onderzoeksopdracht, geen bouw. Alle bronnen geraadpleegd 30-07-2026. Aanvulling 30-07-2026: België per gewest afgemaakt — Wallonië (PICC) en Brussel (UrbIS) alsnog getoetst op licentie én verhardingsattribuut.

## Samenvatting

| Land | Bron | API | Licentie (commercieel?) | Verhardingsattribuut per wegvak |
|---|---|---|---|---|
| BE-Vlaanderen | GRB (Basiskaart Vlaanderen) | JA (OGC API Features, live) | JA — Gratis open data licentie Vlaanderen v1.02, naamvermelding verplicht | JA (VERH/LBLVERH) |
| BE-Wallonië | PICC | JA (ArcGIS REST/WMS/WFS geoservices.wallonie.be + downloads) | JA — sinds 21-05-2019 gratis voor elk gebruik incl. commercieel (CGA/CGU + Conditions particulières type C), naamvermelding "Service public de Wallonie" verplicht | NEE (alleen wegklasse NATUR: Communale/Nationale/Chemin ou sentier/…; geen revêtement) |
| BE-Brussel | UrbIS | JA (datastore.brussels: download + WFS/Atom/WMS) | JA — CC0 1.0 (Transport networks, Topo, Vector; per dataset op datastore.brussels vermeld) | NEE (straatassen-referentieel zonder wegdekattribuut) |
| DE | ATKIS Basis-DLM (per Land) | JA (per Land + basemap.de-opendata-dienst, GeoPackage) | JA — alle 16 Länder inmiddels open (DL-DE/BY-2.0, DL-DE/Zero, Bremen CC-BY 4.0); naamvermelding meestal verplicht | GROF (Befestigung befestigt/onbefestigd op weg-/padassen; geen materiaalsoort zoals BGT) |
| FR | IGN BD TOPO | JA (Géoplateforme data.geopf.fr, downloads + diensten) | JA — Licence Ouverte Etalab 2.0 sinds 1-1-2021, naamvermelding verplicht | NEE (alleen indirect via `Nature`: route empierrée/chemin/sentier) |

**Conclusie:** licenties zijn géén blokkade voor de getoetste bronnen — BE-Vlaanderen, BE-Wallonië, BE-Brussel, DE en FR zijn alle open en commercieel bruikbaar (met bronvermelding; Brussel zelfs CC0, Wallonië met prijs-in-verhouding-clausule). De echte beperking is inhoudelijk: alleen het Vlaamse GRB biedt een BGT-waardig verhardingsattribuut per wegvak. Duitsland biedt een grover binair signaal (befestigt/onbefestigd), Frankrijk alleen een wegtype-proxy. Een "0% aantoonbaar onverhard"-belofte op BGT-niveau is dus per direct alleen in Vlaanderen haalbaar; in DE is een zwakkere-maar-eerlijke verbetering mogelijk, in FR, Wallonië en Brussel nauwelijks meer dan wat OSM al geeft. **De Vlaamse GRB-laag mag dus nooit stilzwijgend "heel België" claimen: Wallonië en Brussel hebben geen verhardingsattribuut en houden de eerlijk-zwakkere buitenland-belofte (aanvulling 30-07-2026, taak per-gewest-toetsing).**

## 1. België

België heeft géén nationale BGT-equivalent; geodata is per gewest.

### Vlaanderen — GRB (Grootschalig Referentiebestand / Basiskaart Vlaanderen)
- **Licentie:** "Gratis open data licentie Vlaanderen v1.02". Iedereen (natuurlijke of rechtspersoon) mag het GRB kosteloos gebruiken, óók commercieel; enige voorwaarde is naamvermelding bij doorgifte/publicatie: "Bron: Grootschalig Referentie Bestand Vlaanderen, Digitaal Vlaanderen". Bron: vlaanderen.be/digitaal-vlaanderen → "GRB downloaden/bestellen", geraadpleegd 30-07-2026.
- **API:** live OGC API Features: `https://geo.api.vlaanderen.be/GRB/ogc/features/v1/collections/Wegsegment/items` (zelf bevraagd 30-07-2026, werkt zonder sleutel), plus WMS/WFS-webdiensten en downloadtoepassing.
- **Verhardingsattribuut:** JA. Entiteit `Wegsegment` draagt `VERH`/`LBLVERH` (o.a. "weg met vaste verharding") plus `MORF` (morfologische wegklasse, o.a. "wandel- of fietsweg, niet toegankelijk voor andere voertuigen"). Dit is functioneel vergelijkbaar met BGT `fysiek_voorkomen`. NB: geometrie is lijn (wegsegment), niet vlak zoals BGT-wegdelen — punt-op-lijn-matching i.p.v. punt-in-polygoon.
- **Oordeel:** volwaardige BGT-achtige controlelaag, juridisch en technisch klaar. Eerste kandidaat voor EU-uitrol.

### Wallonië — PICC (Projet Informatique de Cartographie Continue) — getoetst 30-07-2026
- **Licentie:** JA, commercieel bruikbaar. Sinds 21-05-2019 valt het PICC (samen met orthofoto's en relief) onder de "Conditions générales d'accès" + "Conditions générales d'utilisation" (v1.1, 03-08-2016) aangevuld met de **Conditions particulières d'utilisation type C**: iedere natuurlijke of rechtspersoon krijgt gratis toegang voor onbepaalde duur, ongeacht het gebruik (dus óók commercieel); redistributie aan derden en publicatie via een webservice zijn expliciet toegestaan. Verplichting: bronvermelding "Sources des données : Service public de Wallonie" (of "SPW"), zo mogelijk met hyperlink naar geoportail.wallonie.be. Kanttekening bij commercieel gebruik: de verkoopprijs moet in verhouding staan tot de eigen bewerking van de data (geen kale doorverkoop). Bronnen: geoportail.wallonie.be nieuwsbericht "Assouplissement des conditions d'accès et d'utilisation" (23-05-2019) + DataSPW-CGU.pdf + DataSPW-CPU-TypeC.pdf, geraadpleegd 30-07-2026.
- **API:** JA. ArcGIS REST feature-service `geoservices.wallonie.be/arcgis/rest/services/TOPOGRAPHIE/PICC_VDIFF/MapServer` (zelf bevraagd 30-07-2026, query zonder sleutel werkt), plus WMS/WFS en downloads via de geoportail-downloadtoepassing. Sinds okt-2023 ook vlakken: `VOIRIE_SURFACE`-tabel (Voirie - Surface, laag 24).
- **Verhardingsattribuut:** **NEE.** Zelf de veldenlijst en distinct-waarden bevraagd (30-07-2026): `Voirie - Axe` (laag 21) draagt alleen `NATUR_CODE/NATUR_DESC` = wegklasse (Communale, Nationale, Autoroute, Ring, Piste cyclable, Chemin ou sentier) en `TYPE_DESC` (Sentier / Non Détaillé); `Voirie - Surface` (laag 24) alleen Tronçon/Carrefour/Ouvrage d'art/Aire de repos + breedtes. Geen revêtement-/materiaalattribuut. Hooguit een grove proxy zoals FR-`Nature`: "Chemin ou sentier"/"Sentier" ⇒ mogelijk onverhard — nauwelijks meer dan OSM-highway al geeft.
- **Oordeel:** juridisch begaanbaar (met SPW-bronvermelding en prijs-in-verhouding-clausule bij commercieel gebruik), inhoudelijk **geen** BGT-waardige controlelaag. Zelfde categorie als Frankrijk: wegtype-proxy, geen wegdek. De buitenland-copy "minder zeker over wegdek" blijft in Wallonië nodig.

### Brussel — UrbIS — getoetst 30-07-2026
- **Licentie:** JA, commercieel bruikbaar. De relevante datasets op datastore.brussels ("UrbIS - Transport networks", "UrbIS - Topo", "UrbIS - Vector", beheerder Paradigm) staan onder **CC0 1.0** ("no conditions for reuse, the data is in the public domain"), toegangsrestrictie "No limitations to public access". Bron: datasetpagina's datastore.brussels, geraadpleegd 30-07-2026. Licentie is per dataset vermeld; bij activering de CC0-vermelding van de concrete gebruikte dataset vastleggen.
- **API:** JA. datastore.brussels biedt per dataset download (Shapefile/GeoPackage/DWG) én WFS/Atom/WMS-diensten; straatassen ook via data.mobility.brussels.
- **Verhardingsattribuut:** **NEE.** De straatassen (UrbIS-Adm/Vector "Street axes") zijn een wegenreferentieel (geometrie + straatnaam/ICAR-koppeling), zonder revêtement-/wegdekattribuut; ook Topo/Vector-lagen (wegen als lijnen/vlakken, trottoirs) dragen geen materiaalsoort. Praktisch belang klein: het gewest is een vrijwel volledig verhard stedelijk netwerk van ~161 km².
- **Oordeel:** juridisch de makkelijkste bron van alle getoetste (CC0), inhoudelijk geen wegdeksignaal en praktisch nauwelijks nodig. Geen activeringskandidaat voor de wegdeklaag; de zwakkere OSM-belofte volstaat.

## 2. Duitsland — ATKIS Basis-DLM (per Bundesland); ALKIS niet geschikt

- **Bron:** het topografische ATKIS Basis-DLM (1:25.000, per Land bijgehouden) is de relevante laag; ALKIS (kadastraal) biedt geen bruikbaar landsdekkend wegdeksignaal voor routes.
- **Licentie:** per Bundesland, maar inmiddels bieden **alle 16 Länder** hun Basis-DLM als open data aan; basemap.de (officieel AdV-product) bundelt de "Open Data Länder" en linkt per Land de licentie: doorgaans Datenlizenz Deutschland Namensnennung 2.0 (DL-DE/BY-2.0, naamvermelding verplicht) of DL-DE/Zero, Bremen CC-BY 4.0, enkele Länder met eigen AGNB-tekst (Brandenburg, MV, Sachsen, SH, Hessen via VermGeoInfG). Commercieel gebruik is onder al deze varianten toegestaan; de exacte bronvermeldingstekst verschilt per Land en moet bij activering per Land worden overgenomen. Bron: basemap.de/open-data (geraadpleegd 30-07-2026, alle 16 Länderwappen met licentielink aanwezig).
- **API:** basemap.de levert de Basis-DLM-data van de open-data-Länder via één dienst in GeoPackage (basemap.de-datamodel); daarnaast per Land eigen open-geodata-portalen (Bayern, NRW, NI, …). Geen uniforme feature-API zoals PDOK; eerder bulk-download + eigen index.
- **Verhardingsattribuut:** GROF. GeoInfoDok kent op weg-/padobjecten (o.a. AX_Fahrwegachse, AX_WegPfadSteig) het attribuut *Befestigung* (befestigt/onbefestigd); voor gewone straten wordt verharding verondersteld. Geen materiaalsoort per wegvak zoals BGT `fysiek_voorkomen`. Bruikbaar als binaire controle op het OSM-onbekend-gat (m.n. Wege/Fahrwege — precies waar racefiets-risico zit), niet als volwaardige BGT-vervanger.
- **Oordeel:** juridisch begaanbaar (met per-Land bronvermelding), technisch bewerkelijk (16 leveringen of basemap.de-bundel), inhoudelijk een zwakker maar eerlijk signaal.

## 3. Frankrijk — IGN BD TOPO

- **Licentie:** sinds 1-1-2021 zijn alle publieke IGN-data, incl. BD TOPO, vrij en gratis onder **Licence Ouverte Etalab 2.0** — commercieel gebruik toegestaan, naamvermelding (IGN) verplicht. Bronnen: data.gouv.fr BD TOPO-datasetpagina; IGN-aankondiging jan 2021 (geraadpleegd 30-07-2026).
- **API:** Géoplateforme (data.geopf.fr): downloads per departement/regio + webdiensten; documentatie via bdtopoexplorer.ign.fr (weigert overigens geautomatiseerde toegang met 403 — documentatie via de PDF "Descriptif de contenu" op data.geopf.fr).
- **Verhardingsattribuut:** NEE. `Tronçon de route` heeft geen surface-/revêtement-attribuut; alleen `Nature` (route à 1 chaussée, route empierrée, chemin, sentier, …) geeft een grove proxy: "route empierrée"/"chemin"/"sentier" ⇒ (half)onverhard, overige routes ⇒ verondersteld verhard. Dat is nauwelijks meer dan OSM-highway-classificatie al biedt en dicht het surface-onbekend-gat niet per wegvak.
- **Oordeel:** juridisch volledig open, inhoudelijk onvoldoende voor een BGT-waardige belofte. Hooguit een tweede-opinie-signaal naast OSM; de buitenland-copy "minder zeker over wegdek" blijft in FR nodig.

## 4. Doorwerking

- Kalibratie-YAML ROUTES_GENERATOR_001: candidate_source "EU-equivalenten van BGT" per land uitgesplitst met licentie/API/attribuut; `missing_information`-regel over per-land-licenties bijgewerkt (heel België — Vlaanderen/Wallonië/Brussel — plus DE/FR getoetst per 30-07-2026; alleen overige EU-landen nog open).
- Volgorde-advies voor de EU-uitrol van de wegdeklaag: **1) Vlaanderen (GRB)** — bijna 1-op-1 BGT-patroon; **2) Duitsland (Basis-DLM, binair)** — eerlijk-zwakkere claim; **3) Frankrijk** — geen sterkere claim mogelijk, copy blijft "minder zeker".
- Provider-compliance-les bevestigd: "open" geodata is per land/gewest anders gelicenseerd; bij activering per land de exacte bronvermeldingstekst vastleggen.
