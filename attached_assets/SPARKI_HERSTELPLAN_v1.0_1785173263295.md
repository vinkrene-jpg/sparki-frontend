# SPARKI HERSTELPLAN v1.0

**Bronnen:** SPARKI_GAP_RAPPORT_v1.0 en SPARKI_AI_MASTER_PLAN_v2.42  
**Datum:** 2026-07-27  
**Status:** Uitvoeringskader — nog niet gestart  
**Besturingsregel:** één opdracht tegelijk, sequentieel, geen parallelle subagents, geen publicatie zonder afzonderlijke publicatiecontrole en expliciet akkoord van René.

---

## 1. Doel

Sparki terugbrengen naar één samenhangend product met:

- één centrale mobiele en desktop-schil;
- data en grafieken als primaire informatiedrager;
- korte zakelijke/wetenschappelijke duiding naast de data;
- uitgebreide uitleg uitsluitend na doorklikken;
- geen lange coachteksten op hoofdpagina’s;
- geen gebruikerszichtbare personificatie zoals “Vraag Sparki”;
- aantoonbaar betrouwbare gebruikersdata;
- bekende context niet opnieuw uitvragen;
- zichtbare feedback na iedere actie;
- consistente lege, laad-, fout- en verouderde toestanden;
- duidelijke productdifferentiatie tussen Gratis, Go en Compleet;
- Stripe als betaalprovider.

## 2. Productreferentie die voor alle herstelwaves geldt

### 2.1 Communicatie

**Gratis**
- alleen direct nuttige kerndata;
- weinig uitleg;
- eenvoudige, zakelijke taal;
- verdieping alleen waar noodzakelijk.

**Go**
- beperkte, eenvoudige grafieken;
- alleen data die nodig is voor de actuele rit, route, dag of beslissing;
- één korte praktische conclusie;
- één duidelijke vervolgstap;
- wetenschappelijke uitleg pas na doorklikken;
- zo min mogelijk technische termen;
- volwassen, rustig en niet kinderachtig.

**Compleet**
- uitgebreidere trends, vergelijkingen en historie;
- data en grafieken centraal;
- één korte zakelijke/wetenschappelijke interpretatie;
- duidelijke herkomstlabels: Gemeten, Berekend, Advies, Algemene richtlijn;
- uitgebreide onderbouwing pas na doorklikken.

### 2.2 Layout

- Mobiel: centrale onderste navigatie, veilige ruimte, geen overlap.
- Desktop: vaste zij-/hoofdnavigatie en echte multi-kolomindeling volgens Figma-node `43:6`.
- Geen uitgerekte mobiele kaartstapel als desktoplayout.
- Drawers, modals en formulieren gebruiken één centraal patroon.

### 2.3 Data-trust

- Alleen aantoonbaar echte gebruikersdata.
- Geen mock-, demo-, seed-, fallback- of hardcoded persoonlijke waarden.
- Ontbrekende data geeft een eerlijke lege toestand.
- API-fout geeft een fouttoestand.
- Oude cache wordt expliciet als verouderd aangeduid.
- Geen conclusie “echt” zonder volledige keten: component → hook → endpoint → response → databasebron → user-id.

---

## 3. Uitvoeringsregels

1. Per wave maximaal één hoofdonderwerp of één samenhangende module.
2. Eerst diagnose en bewijs, daarna pas wijziging.
3. Geen parallelle agents.
4. Geen brede refactor zonder aantoonbare noodzaak.
5. Bestaande engines, API’s, databamodellen en flows behouden.
6. Geen tests verwijderen, overslaan of versoepelen.
7. Iedere wave eindigt met:
   - gerichte tests;
   - volledige relevante webtestset;
   - typecheck;
   - twee productiebuilds;
   - ingelogde browsercontrole mobiel, tablet en desktop;
   - afzonderlijke publicatiecontrole;
   - expliciete publicatie door René.
8. Een onderdeel is pas “af” na visuele én functionele controle, niet alleen na groene tests.

---

# 4. Herstelvolgorde

## W0 — Data-trust herkomstonderzoek

**Doel:** vaststellen waar de door René waargenomen vreemde activiteiten en waarden vandaan komen.

**Backlog-ID’s:** DTRUST-01

**Scope:**
- Vandaag;
- Plan;
- Activiteiten;
- Analyse;
- Meer;
- bijbehorende caches, endpoints en databasekoppelingen.

**Uitvoering:**
- productieomgeving read-only onderzoeken;
- per zichtbare persoonlijke waarde de volledige herkomstketen bewijzen;
- Clerk user-id koppelen aan interne user-id en database-rijen;
- controleren op seed-, demo-, QA-, fallback-, cache- en cross-accountdata;
- niets wijzigen tijdens diagnose.

**Acceptatie:**
- alle zichtbare persoonlijke data is aantoonbaar van René; of
- exacte bron van onjuiste data is vastgesteld en als afzonderlijk herstelitem vastgelegd;
- geen enkele waarde krijgt status “betrouwbaar” zonder runtime- en databasebewijs.

**Publicatie:** niet van toepassing bij alleen diagnose.

---

## W1 — Centrale navigatiecontinuïteit: Rijden en Ontdekken

**Backlog-ID’s:** A-01, A-02, A-20, COMM-04 (Feed)

### W1A — Rijden `/routes`

- migreren naar centrale CommercialShell;
- bestaande RoutePanel, RouteLibrary, RouteDiscover en NavSettingsPanel behouden;
- mobiele Core-navigatie zichtbaar;
- desktop vaste navigatie zichtbaar;
- flag-uit-pad intact;
- geen functionele route- of navigatielogica wijzigen.

### W1B — Ontdekken `/feed`

- migreren naar centrale CommercialShell;
- alle bestaande feedfuncties behouden;
- HumorLine verwijderen van primaire laag;
- eerlijke lege toestand;
- flag-uit-pad intact.

### Besluit A-20 vóór implementatie

Leg één consistente navigatielijn vast:
- mobiel item 5 blijft **Meer**;
- desktop toont zowel **Ontdekken** als **Meer** als afzonderlijke bestemmingen wanneer ruimte beschikbaar is;
- geen functie verdwijnt door breakpointverschil.

**Acceptatie:** alle primaire navigatiebestemmingen gebruiken één centrale schil en zijn op mobiel en desktop bereikbaar.

---

## W2 — Vandaag als definitief referentiescherm

**Backlog-ID’s:** COMM-01, COMM-02, COMM-03, COMM-05, COMM-06, DESK-01

**Doel:** Vandaag volledig afmaken als visuele, inhoudelijke en functionele standaard voor de rest van de app.

### W2A — Desktopreferentie

- implementeren volgens Figma-node `43:6`;
- echte multi-kolomindeling op 1440×900;
- mobiele layout ongewijzigd;
- centrale shell mag geen andere pagina’s inhoudelijk herindelen;
- generieke shellstructuur centraal, paginaspecifieke kolomindeling in Vandaag.

### W2B — Lege ruimte onder “Hoe voel je je?”

- oorzaak verwijderen;
- geen verborgen container die hoogte inneemt;
- geen CSS-hack of negatieve marge.

### W2C — Training toevoegen

- na selectie en opslag zichtbaar resultaat;
- succes: bevestiging plus bijgewerkte trainingkaart;
- fout: duidelijke foutmelding;
- annuleren: expliciete terugkeer zonder wijziging;
- bestaande endpoint- en planningslogica behouden.

### W2D — Communicatie en personificatie

- alle zichtbare “Vraag Sparki”-teksten verwijderen;
- functionele benamingen gebruiken, bijvoorbeeld “Materiaal beoordelen”, “Analyse openen”, “Onderbouwing bekijken”;
- geen chatpersona verbergen achter alleen een icoon als de functie zakelijk benoemd kan worden;
- HumorLine verwijderen van primaire Core-oppervlakken zolang humor `active_now: false` is.

### W2E — Data-eerst patroon

Op Vandaag en direct geopende panelen:
- data/grafiek eerst;
- maximaal één korte zakelijke/wetenschappelijke conclusie;
- herkomstlabel;
- uitgebreide tekst pas na doorklikken.

**Acceptatie:** René keurt Vandaag op mobiel én desktop expliciet goed als referentiescherm, inclusief alle knoppen, drawers en foutpaden.

---

## W3 — Profiel, Lichaam, Voeding, Mechanieker en Connect

**Backlog-ID’s:** A-03, A-04, A-05, A-14, COMM-07, VOEDING-01, VOEDING-02

Deze wave wordt sequentieel opgesplitst:

### W3A — Jij `/you`
- centrale shell;
- volledige profielsecties behouden;
- data/grafiek eerst;
- coachende lappen tekst vervangen door korte duiding met doorklik;
- provenance consequent.

### W3B — Lichaam `/lichaam`
- centrale shell;
- HealthFlowSection, CheckinSheet, MentalResilienceCard en Voeding behouden;
- bestaande dagtype-afleiding hergebruiken.

### W3C — Voeding
- bekende context stil hergebruiken: rustdag, trainingsdag, wedstrijd, duur, intensiteit, profiel en waar relevant weer;
- generieke doelen labelen als **Algemene richtlijn**;
- persoonlijke waarden alleen als persoonlijk tonen wanneer aantoonbaar berekend uit persoonlijke gegevens;
- temperatuur alleen vragen of tonen wanneer relevant;
- wetenschappelijke uitleg achter doorklik.

### W3D — Mechanieker `/mechanieker`
- centrale shell;
- “Vraag Sparki” vervangen door functionele acties;
- MaterialCoach, BikeGarage, MaterialTest en Bike3DWerkblad behouden;
- resultaten voorzien van duidelijke provenance.

### W3E — Connect `/connect`
- centrale shell;
- ConnectionsSection en ActivityImportPanel behouden;
- fout-, lege- en synchronisatiestatus consistent.

---

## W4 — Wedstrijd, Kalender, Samen, Kennis en Journey

**Backlog-ID’s:** A-06, A-07, A-08, A-09, A-10, COMM-04 (Samen), COMM-08

Uitvoeren als afzonderlijke subwaves, één routegroep per run:

- W4A: Wedstrijd `/races`, `/wedstrijd-room`, `/sprinten`
- W4B: Kalender `/kalender`
- W4C: Samen `/samen`
- W4D: Kennis `/kennis`
- W4E: Journey `/journey`
- W4F: resterende HumorLine-oppervlakken in ThreeWeekPlan, BikeGarage, RoutePanel en TrainingDayHome

Voor iedere subwave:
- centrale shell;
- bestaande functies volledig behouden;
- data-eerst communicatie;
- geen HumorLine op primaire laag;
- responsive en data-trust aantoonbaar.

---

## W5 — Overige schermen en rollen

**Backlog-ID’s:** A-11 t/m A-19

Uitvoeren in deze volgorde:

1. Klimmen `/klimmen`
2. Sportpaspoort `/paspoort`
3. Geluid `/geluid`
4. Support `/support`
5. Sociaal profiel `/profiel/:clerkId`
6. Coach `/coach/athletes/:id/plan` en `/cockpit`
7. Ouder- en uitnodigingsflows
8. Club `/club` en `/club/beheer`
9. Tester-onboarding `/tester-qr`, `/welkom-tester`

Adminroutes blijven zonder Core-shell waar dat intentioneel is, maar worden apart functioneel en responsive gevalideerd.

---

## W6 — Stripe, abonnementen en entitlements

**Backlog-ID’s:** BILL-01 t/m BILL-06

**Vaste commerciële keuzes:**
- Stripe is betaalprovider.
- Gratis: €0.
- Go: €9,99 per maand / €99,90 per jaar.
- Compleet: €24,99 per maand / €249,90 per jaar.
- 14 dagen Compleet proberen zonder betaalkaart.
- Geen automatische omzetting na proefperiode.

### W6A — Centrale product- en entitlementmatrix

- iedere functie mappen op Gratis, Go en Compleet;
- geen directe pakketnaamchecks in pagina’s;
- één centrale entitlementservice;
- essentiële veiligheid, export en basisfuncties blijven toegankelijk;
- data blijft behouden bij downgrade.

### W6B — Stripe-infrastructuur

- Stripe producten en price-ID’s;
- maand- en jaarprijzen;
- checkout en Customer Portal;
- webhookverwerking;
- idempotentie en logging;
- betaalstatus vertaald naar centrale entitlements.

### W6C — Proefperiode

- 14 dagen Compleet zonder betaalkaart;
- geen automatische omzetting;
- na afloop terug naar passend gratis/Go-niveau;
- data blijft behouden.

### W6D — Upgrade, downgrade en mislukte betalingen

- contextuele upgradeflow;
- directe activatie na betaling;
- downgrade zonder dataverlies;
- grace period vóór implementatie expliciet vastleggen.

### W6E — BTW en zakelijke producten

- Stripe Tax / btw-inrichting;
- Nederlandse btw en EU-OSS afhandeling;
- coach- en clubproducten apart;
- clubleden niet dubbel laten betalen voor gesponsorde functies.

---

## W7 — Stale-cache en laatste data-trust-afsluiting

**Backlog-ID’s:** DTRUST-02 plus alle uit W0 voortgekomen herstelitems.

- app-breed één patroon voor laatste update, stale data en refetchfouten;
- geen oude data als actueel presenteren;
- accountwissel en opnieuw inloggen moeten caches correct scheiden;
- volledige data-trust-audit opnieuw uitvoeren voordat pilot of verkoop start.

---

# 5. Definitie van gereed per wave

Een wave is pas gereed wanneer:

1. alle toegewezen backlog-ID’s zijn afgehandeld;
2. geen nieuwe afwijking stil buiten de backlog blijft;
3. alle bestaande functies behouden zijn;
4. data-trust bewezen is;
5. mobiel 390×874, tablet 768×1024 en desktop 1440×900 zijn gecontroleerd;
6. alle knoppen, drawers, modals en foutpaden in scope zijn getest;
7. communicatie voldoet aan Gratis/Go/Compleet;
8. tests, typecheck en twee builds groen zijn;
9. René de visuele uitkomst heeft gezien;
10. een aparte publicatiecontrole is geslaagd;
11. René zelf publiceert.

---

# 6. Startbesluit

De eerstvolgende uitvoeringsstap is **W0 — Data-trust herkomstonderzoek**.

Reden: de gebruiker heeft vreemde activiteiten en waarden gezien. Zolang de herkomst daarvan niet bewezen is, mogen verdere schermmigraties niet als productmatig betrouwbaar worden aangemerkt.

Na W0 volgt **W1A — Rijden**, daarna **W1B — Ontdekken**. Vandaag wordt vervolgens in **W2** volledig afgerond als referentiescherm vóór verdere domeinmigratie.
