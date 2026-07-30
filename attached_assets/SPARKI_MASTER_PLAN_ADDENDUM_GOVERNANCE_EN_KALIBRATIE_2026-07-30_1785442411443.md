# SPARKI MASTER PLAN ADDENDUM — GOVERNANCE, PRODUCTBELOFTEN EN AI-WERKWIJZE v3

**Datum:** 30 juli 2026, bijgewerkt 21:38 CEST  
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
