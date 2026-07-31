# SPARKI MASTER PLAN ADDENDUM — GOVERNANCE, PRODUCTBELOFTEN EN AI-WERKWIJZE v3

> Canonieke plaats: `docs/SPARKI_MASTER_PLAN_ADDENDUM_GOVERNANCE_EN_KALIBRATIE.md` (v3, 2026-07-30). Hoort als set bij `docs/SPARKI_PRODUCT_PROOF_DOCTRINE.md` (v1.4), `docs/SPARKI_AI_REVIEW_GOVERNANCE.md` (v3) en het kalibratie-uitvoeringsplan.

**Datum:** 30 juli 2026, bijgewerkt 31 juli 2026 08:18 CEST  
**Status:** ACTIEVE WERKAFSPRAAK  
**Beslisser:** René Vink, Product Owner  
**Repository:** `vinkrene-jpg/sparki-frontend`  
**Bron van waarheid voor code:** GitHub `main`

## 1. Doel

Dit addendum voorkomt dat technische activiteit, groene tests, publicaties of veel commits worden verward met aantoonbare productkwaliteit. Sparki wordt per productbelofte gebouwd en pas vrijgegeven nadat de volledige gebruikersketen is bewezen.

## 2. Canonieke documentenset

Deze vier documenten horen als één samenhangende set te worden gelezen:

1. dit Master Plan-addendum;
2. `SPARKI_PROMISE_CALIBRATION_EXECUTION_PLAN_2026-07-30_v5.md`;
3. `SPARKI_PRODUCT_PROOF_DOCTRINE_v1.4_2026-07-30.md`;
4. `SPARKI_AI_REVIEW_GOVERNANCE_v3_2026-07-30.md`.

Daarnaast blijven in GitHub leidend:

- `docs/PRODUCT_PROMISES/SPARKI_PROMISE_CALIBRATION.yaml`;
- actuele code en tests op `main`;
- expliciete productbesluit- en architectuurdocumenten;
- actuele bewijsrapporten en ruwe proofdata.

Bij conflict geldt deze volgorde:

1. expliciet en recenter besluit van René;
2. actuele kalibratie in GitHub;
3. deze vier gesynchroniseerde governance-documenten;
4. overige addenda en plannen;
5. individuele opdrachten en rapporten.

## 3. Actuele stand per 30 juli 2026

### Gekalibreerd of inhoudelijk beantwoord

- **A — Start, profiel en doelen:** vragen beantwoord en retroreviewcorrecties verwerkt.
- **B+C — Training, coaching en analyse:** twintig besluiten verwerkt en reviewcorrecties vastgelegd.
- **D — Routes en navigatie:** inhoudelijke vragen beantwoord; Product Proof nog niet behaald.
- **H — Data, koppelingen en synchronisatie:** inhoudelijke vragen beantwoord; Product Proof nog niet behaald.

`rene_calibration.completed: true` betekent uitsluitend dat René de vragen heeft beantwoord. Het betekent niet automatisch dat de belofte, het acceptatiecontract, de code of Product Proof is goedgekeurd.

### In voorbereiding

- **F — Voeding, hydratatie en gewicht:** concept/inventarisatie; nog niet definitief gekalibreerd.
- **J — Club, coachorganisatie en ploegomgeving:** bindende kalibratieopdracht is vastgesteld. Replit mag uitsluitend onderzoek en het YAML-hoofdstuk opleveren; geen productcode of UI.
- **Gewone fietser/e-bike:** productrichting vastgesteld als volwaardige recreatieve gebruiker, met elektrische ondersteuning als fiets- en activiteiteigenschap; nog geen brede bouwopdracht.

### Routes — actuele waarheid

De routebewijsbatch over 12 lussen (MTB, gravel en race; 25–200 km) toonde dat 11 van 12 aangeboden lusroutes nog harde obstakels bevatten. De oorzaak is dat de gewone lusgenerator bij een langlopende obstakelmeting fail-open kan doorgaan. De waypoint/PTP-koude-cachefix dekt dit pad niet volledig.

Daarom blijft taak **#505 — lusgeneratie structureel fail-closed** de hoogste productprioriteit. Een langere timeout alleen is geen geldige oplossing. Iedere kandidaat moet eindigen als `verified_clear`, `hard_blocked` of `unverifiable`; alleen `verified_clear` mag `KLAAR`, opslaan of navigeren toestaan.

Twee eerder gemelde UI-fouten zijn inmiddels in commit `1c4d4166a567371e514af91be9749759236c09ca` hersteld:

- Volgauto alleen op expliciete wedstrijdroutes, inclusief mobiele grendel;
- “wijzig met routepunten” wisselt vanuit Bewaard werkelijk naar Maken en behoudt de relevante querycontext.

Deze bugfix sluit niet het lus-obstakelgat.

### Kleuren en grafieken

De app-brede kleurdoctrine is technisch doorgevoerd:

- groen = positief/goed;
- amber = aandacht;
- rood = fout/risico;
- cyaan = merk- en actieaccent, niet automatisch positief;
- grafiek- en wegdekkleuren komen uit centrale semantische bronnen.

Technische typecheck/build is geen visuele goedkeuring. Echte schermcontrole blijft nodig.

## 4. Kernstatussen

Iedere module houdt minimaal deze statussen gescheiden:

1. `technical_status`;
2. `calibration_status`;
3. `acceptance_contract.approved`;
4. `validation.result`;
5. `product_proof.status`.

Geen status mag stilzwijgend een andere status verhogen.

## 5. Verticale productketen als bewijsobject

Een losse functie of test is niet het bewijsobject. Voor Routes is dat minimaal:

`invoer → kandidaatgeneratie → bronanalyse → verificatiestatus → harde afkeur → alternatiefselectie → presentatie → opslag → wijziging → navigatiestart → mobiel/export`

Een harde fout in één stap blokkeert de hele keten.

## 6. Vaste ontwikkelvolgorde

1. productbelofte en acceptatiegrenzen vastleggen;
2. externe bronnen en bestaande code onderzoeken;
3. tegenvoorbeelden en tests ontwerpen;
4. één afgebakende verticale wijziging bouwen;
5. Poort 5b uitvoeren;
6. onafhankelijke Poort 5c uitvoeren;
7. bevindingen herstellen;
8. gebruikerspad en praktijk testen;
9. testerfouten permanent verwerken volgens Poort 6a;
10. pas daarna Product Proof beoordelen.

## 7. Rollen

### René

Beslist productgedrag, grenzen, prioriteit en vrijgave; beoordeelt de laatste praktijktest.

### Replit

Onderzoekt en bouwt binnen de bestaande architectuur, voert tests en Poort 5b uit, maar geeft geen onafhankelijke eindgoedkeuring.

### GitHub Copilot

Reviewt de actuele diff tegen code, kalibratie en governance. Zolang automatische PR-review niet aantoonbaar actief is, wordt hij expliciet gestart.

### Claude/Cowork

Bewaakt periodiek nieuwe commits via persistente state. Bij ontbrekende shell, stale/cached bronnen of niet-bevestigde `main`-ref rapporteert hij `error` of `pending_verification`, nooit `no_changes` op basis van onzekerheid.

### ChatGPT/onafhankelijke reviewer

Controleert samenhang en codeclaims, verifieert waar mogelijk GitHub en maakt afgebakende herstelopdrachten.

## 8. Werkbeperking tijdens routeherstel

Totdat de lusrouteketen de bewijsronde doorstaat:

- geen brede route-uitbreiding;
- geen tweede route-engine;
- geen Product Proven-claim voor Routes;
- hoofdstuk J mag alleen als kalibratie-/onderzoekswerk doorgaan;
- overige nieuwe productbouw alleen na expliciete vrijgave door René.

## 9. Publicatie- en releasegrens

Publiceren voor gerichte test is toegestaan als kandidaatstatus duidelijk is. Publiceren is geen Product Proof.

Een module is niet betrouwbaar vrijgegeven wanneer een bekende `hard_blockage` of `unverifiable` uitkomst nog als klaar, opslaanbaar of navigeerbaar kan eindigen.

## 10. Definitie van vooruitgang

Vooruitgang is niet het aantal commits, agents, drafts, documenten of groene tests.

Vooruitgang is:

> Een volledige gebruikersketen die aantoonbaar aan de vastgelegde belofte voldoet en waarbij René in de praktijktest hooguit kleine resterende details vindt.

## 11. Besluiten René 30-07-2026 (aanvullende opdracht) — bindend

De aanvullende opdracht van 30-07-2026 is verwerkt in het canonieke
`docs/BESLUITENREGISTER_RENE_2026-07-30.md` (B1–B13). Kern voor dit addendum:

- **Oplevervolgorde §15 is bindend** en gaat vóór eerdere prioriteitsvolgordes:
  A rechtenlek (bewezen 31-07-2026) → B besluiten in docs → C routeplanner vier
  weergaven incl. **Wedstrijd** (niet "Compleet") → D externe coach/planherkomst →
  E inzage-/voortgangslogging → F zones/PDC/koolhydraat → G ramp-rate-VOORSTEL →
  H overige bewijzen.
- Hoofdstuk J-beperking "assignment-only trainer mag schrijven" is opgeheven en
  omgekeerd bewezen (besluitenregister B1).
- Open blijven uitsluitend: KNWU-verificatie (B13), Samen-nav-positie (B10),
  definitieve ramp-rate-grens (B9). Geen niet-goedgekeurde beleidskeuzes
  zelfstandig invoeren; waar een voorstel gevraagd is eerst voorstel + akkoord.

## 12. Telefoon-first voor sporters, rolgerichte desktop voor begeleiders — bindend besluit 31-07-2026

### 12.1 Hoofdregel

Sparki wordt niet ontworpen als één responsive desktopinterface die op alle schermen hetzelfde werkt. Telefoon en desktop zijn volwaardige, maar doelbewust verschillende gebruiksomgevingen.

- Voor sporters, jeugdrenners, recreatieve fietsers en wedstrijdrenners is de telefoon de primaire ontwerp- en acceptatieomgeving.
- Voor trainers, ploegleiders, hoofdtrainers en clubbeheerders is desktop een primaire werkomgeving voor overzicht, vergelijking, planning en beheer.
- Ouder/verzorger en mechanieker krijgen per taak een passende telefoon- of desktopwerking; niet automatisch dezelfde presentatie als de sporter.
- Rechten, brondata, beslisregels en veiligheidsgrenzen blijven op elk apparaat gelijk. De interactie, informatiedichtheid en beschikbare werkruimte mogen en moeten wezenlijk verschillen.

### 12.2 Telefoonervaring voor sporters

De sporterervaring wordt eerst voor een echte telefoon ontworpen en daarna naar grotere schermen uitgebreid.

Verplicht:

- één duidelijke hoofdtaak of beslissing per stap;
- begeleide stappen, overlays, modals, drawers of onderste schuifkaarten wanneer een proces meerdere keuzes bevat;
- progressive disclosure: details pas na een bewuste keuze;
- grote, begrijpelijke tikdoelen;
- geen verkleinde desktopdashboards;
- geen lange instellingenpagina als primaire gebruikersflow;
- kaart, activiteit of actuele coachingcontext blijft waar relevant centraal zichtbaar;
- telefoonflows worden op een echt toestel getest, niet uitsluitend in een versmalde desktopbrowser.

Voor de routeplanner betekent dit onder meer: kaart centraal, fietskeuze als eerste beslisstap en daarna een begeleide flow in plaats van een lange pagina met tabbladen en velden.

### 12.3 Desktopervaring voor trainers en organisatie-rollen

Desktop is voor onderstaande rollen geen uitvergrote telefoonversie, maar een eigen professionele werkruimte:

- zelfstandige trainer/coach;
- clubtrainer;
- hoofdtrainer;
- ploegleider;
- clubbeheerder;
- waar relevant mechanieker en admin.

Desktop mag en moet meer informatie gelijktijdig tonen wanneer dat het werk ondersteunt, zoals:

- meerdere sporters of teams naast elkaar;
- afwijkingen, prioriteiten en open acties;
- planning, kalender en wedstrijden;
- belasting, TSS en trends binnen de geldende rechten;
- te beoordelen plannen en coachvoorstellen;
- berichten, feedback en auditinformatie;
- filters, bulkacties en vergelijkingen;
- club-, team- en rollenbeheer.

Gebruik hiervoor waar passend tabellen, kolommen, zijpanelen, split views en dashboards. Deze patronen mogen niet zonder herontwerp naar de telefoon worden gekrompen.

### 12.4 Wezenlijk verschillende werking per apparaat

Het verschil tussen telefoon en desktop mag niet beperkt blijven tot CSS, afmetingen of het verbergen van enkele kaarten.

Per kernonderdeel moet expliciet worden bepaald:

- hoofdtaak op telefoon;
- hoofdtaak op desktop;
- informatie die tegelijk zichtbaar moet zijn;
- acties die op telefoon stapsgewijs verlopen;
- acties die op desktop naast elkaar of in bulk mogen plaatsvinden;
- veilige overdracht van een begonnen taak tussen apparaten;
- welke context, filters en conceptwijzigingen bewaard blijven.

Voorbeelden:

- Een sporter maakt op de telefoon stapsgewijs een route; een trainer kan op desktop meerdere routes, sporters en trainingen vergelijken en koppelen.
- Een sporter ziet op Vandaag één actuele hoofdboodschap; een trainer ziet op desktop een aandachtsoverzicht van meerdere sporters.
- Een ouder ziet op telefoon de relevante actie rond het eigen kind; een clubbeheerder ziet op desktop teams, trainers, rechten en auditinformatie.

### 12.5 Gedeelde kern, geen parallel product

De verschillende ervaringen gebruiken dezelfde:

- domeinlogica;
- API's;
- autorisatie;
- databronnen;
- engines;
- veiligheidsregels;
- auditlogging.

Bouw geen tweede los product of parallel analysesysteem voor desktop. Maak rol- en apparaatgerichte presentaties en workflows bovenop dezelfde betrouwbare kern.

### 12.6 Acceptatie en bewijs

Een kernflow is niet afgerond op basis van alleen responsive rendering.

Minimaal bewijs:

- echte telefoontest voor iedere primaire sporterflow;
- desktoptest voor trainer, ploegleider, hoofdtrainer en clubbeheerder wanneer de flow voor die rol relevant is;
- aantoonbaar verschillende navigatie, informatiedichtheid en acties waar de rol dit vereist;
- server-side rechten blijven gelijk en worden afzonderlijk getest;
- geen horizontale overflow, verborgen hoofdacties of onbereikbare bediening;
- screenshots of schermopnames van beide gebruiksvormen;
- praktijktest door René en waar passend Dylan.

Een smalle desktopviewport of enkel een browser-emulator geldt niet als volledig telefoonbewijs. Een mobiele pagina die alleen groter wordt weergegeven geldt niet als volwaardige desktopwerkruimte voor begeleiders.

### 12.7 Gevolg voor bestaande en nieuwe bouw

Iedere nieuwe opdracht en iedere relevante herziening moet benoemen:

1. voor welke rol de flow is;
2. of telefoon, desktop of beide primair zijn;
3. hoe de werking per apparaat verschilt;
4. welke gedeelde kern wordt hergebruikt;
5. welk mobiel en desktopbewijs wordt geleverd.

Bestaande onderdelen die feitelijk desktop-first zijn gebouwd en alleen responsive zijn gemaakt, worden bij wijziging niet automatisch volledig herschreven. Ze worden per prioritaire gebruikersflow gericht herontworpen, met behoud van werkende architectuur en data.
