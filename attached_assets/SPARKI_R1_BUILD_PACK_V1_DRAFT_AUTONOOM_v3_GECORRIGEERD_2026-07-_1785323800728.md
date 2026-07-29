# SPARKI R1 BUILD PACK — V1 (AUTONOOM, v3)
**Status: `DRAFT_R1_BUILD_PACK_V1_NOG_NIET_VRIJGEGEVEN`**

## Bronbasis

| Veld | Waarde |
|---|---|
| Master Plan | SPARKI_AI_MASTER_PLAN_v3_02.yaml — **geverifieerd beschikbaar; interne documentversie `3.02`, datum `2026-07-29`, status `AUTHORITATIVE_PRODUCT_TARGET`.** |
| Branch | `main` |
| GitHub-SHA | `666b702` — geregistreerde kandidaat-SHA (laatst bevestigd in v3.01); live verificatie verplicht in WP-000, niet als bewezen te presenteren vóór dat bewijs geleverd is |
| Totaal werkpakketten | **73** (exact) |
| Track A — harde R1-keten | **31** (incl. WP-000) |
| Track B — parallel autonoom spoor | **18** (incl. nieuw WP-B04A) |
| Track INFRA — VPS/deployment/productiegereedheid | **12** |
| Track MARKT — commercie, marketing, releaseactivatie | **12** (was 6) |
| Track C — latere productvoorraad | **18** items, geen werkpakket-ID (niet meegeteld in de 73) |
| Echte René-beslispoorten | **5 vaste** (WP-A06B, WP-A29, WP-B07, WP-B08, WP-B16) + **2 voorwaardelijke** (domeinkeuze in INFRA-09; onoplosbare externe API-toegang). Track MARKT introduceert er geen nieuwe |
| Menselijke praktijktestmomenten | **5**, in **2** werkpakketten (WP-A14, WP-A28) |
| Automatisch uitvoerbare pakketten | **66** (73 minus 5 vaste beslispoorten minus 2 praktijktest-wachtpakketten) |
| Pakketten vereist vóór publieke release | **48** (Track A 31 + Track INFRA 12 + Track MARKT-releasebasis 5: MARKT-03/04/05/10/11) |
| Deferred-onderdelen (met reden) | WP-B07, WP-B08, plus 18 Track C-items |
| Expliciet géén noodzakelijke afhankelijkheid | dure marketingtools, externe bureaus, betaalde advertenties, betaalde websitebuilders |

**Uitvoeringsmodel**: één werkpakket → één agent → eerst read-only
inventariseren → gericht uitvoeren → testen → bewijs vastleggen → status
bijwerken → bij groen resultaat automatisch door naar het eerstvolgende
vrijgegeven werkpakket. Audit-/verificatiewerkpakketten stoppen niet
standaard bij succes. De keten stopt alléén bij een echte blokkade of een
beslispoort. Claude bouwt en voert hier niets van uit.

---

## Beslispoorten (René, definitief)

**Vast (5)**: Stripe fase 2/productiebetaling + definitieve prijs (WP-A06B,
gecombineerd); destructieve productiemigratie (universele stopconditie,
geen los pakket); eerste extern clubplatform (WP-B16); medisch/juridisch
gevoelige uitbreiding (WP-B07 fysiologielaag, WP-B08 club-medisch, twee
losse gates); afwijking van Master Plan v3.02 (universele stopconditie);
definitieve R1 GO/NO-GO (WP-A29, vereist Track A + INFRA-12 + Track
MARKT-releasebasis).

**Voorwaardelijk (2)**: domeinkeuze — alleen een gate als deze nog niet
vastligt tegen de tijd dat INFRA-09 start (ook input voor MARKT-03/11);
ontbrekende externe API-toegang — alleen een gate wanneer dit niet
technisch oplosbaar is.

Normale auditrapporten en faseovergangen zijn **geen** beslispoort zolang
alles binnen goedgekeurde scope blijft.

## Stopcondities (elk werkpakket)

Risico op dataverlies; destructieve productiemigratie; falende test die na
één gerichte herstelpoging niet slaagt; cross-user-/cross-club-datalek;
privacy-/jeugd-/toestemmings-/rechtenprobleem; ontbrekende sleutel/
API-toegang/externe toestemming; onverwachte architectuur die een tweede
engine of grote herschrijving lijkt te vereisen; conflict met Master Plan
v3.02; medisch/juridisch productbesluit; productiebetaling/Stripe fase 2;
definitieve prijsbeslissing; keuze eerste extern clubplatform; een situatie
waarin de agent zou moeten gokken.

---

## WP-000 — Bronbasis: live GitHub-verificatie en taakontdubbeling

- Doel: `666b702` (v3.01) live bevestigen — het MP is een
  registratiedocument, geen zelfstandig bewijs van de actuele repostand
- Verplicht bewijs: `git branch --show-current`, `git rev-parse HEAD`,
  `git log -1 --oneline`, `git status --short`, `git remote -v`
- Bij afwijking tussen MP-registratie en live SHA: de live SHA wordt de
  bronbasis, dit document wordt bijgewerkt, afhankelijke pakketten worden
  tegen de nieuwe SHA herbeoordeeld — geen stilzwijgende aanname
- Scope: branch/SHA-verificatie, volledige Replit-taakinventaris, doublures
  markeren, #382/#383-status vaststellen, baseline-export
- Buiten scope: functionele codewijziging
- Afhankelijkheden: geen (eerste pakket)
- Acceptatie: live git-bewijs vastgelegd; volledige taaklijst geclassificeerd;
  #382/#383-status eenduidig
- Rollback: n.v.t. (leesoperatie)
- `AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A01 én INFRA-01
  (parallel) · `NEXT_ON_BLOCK`: stop (ontbrekende repo-toegang is een harde
  blokkade)
- `REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

---

## TRACK A — Harde R1-keten (31, incl. WP-000)

### WP-A01 — FTP-historie en belastingsscores (opdracht #382)
Scope: FTP-keten, `[achterhaald]`-uitsluiting, historische TSS/IF/load,
voor/na-audit, idempotentie. **Verboden**: wijziging van de huidige 258 W.
Afhankelijkheden: WP-000. Tests: idempotentie-test, voor/na-vergelijking.
Eindstatus: `VERIFIED_FOR_R1`.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A02 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A02 — AI-observaties (opdracht #383)
Scope: verouderde 331 W-referenties, inhoudelijke duplicaten, dagkopieën,
retentie-/herhalingsregels, herkomst en gebruikersisolatie.
Afhankelijkheden: WP-A01. Tests: dedup-test, herkomstcontrole.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A03 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A03 — Mock/fallback/lege toestanden
Scope: mock/seed/demo/fallback/hardcoded persoonlijke data verwijderen,
eerlijke lege staten. **Verboden**: voorbeelddata als gebruikersdata.
Afhankelijkheden: WP-A02.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A04 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A04 — Accountisolatie, historische afgeleide data, onafhankelijke verificatie
Scope: cross-user/cross-club-isolatietest, historische afgeleide waarden vs.
bronwaarden (steekproef), onafhankelijke verificatie van WP-A01–A03 als
afsluitende kwaliteitspoort van Fase Data-trust.
Afhankelijkheden: WP-A03. Tests: cross-user isolatietest, steekproefaudit.
`AUTO_CONTINUE_ALLOWED`: YES (audit mag zelf vrijgeven) · `NEXT_ON_SUCCESS`: WP-A05 · `NEXT_ON_BLOCK`: terug naar betrokken A0x
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A05 — Kernstabilisatie: Vandaag/Plan/Analyse/routes/navigatie/kalender/shell
Scope: runtime-/regressiecontrole op alle kernschermen (desktop+mobiel,
6 verplichte viewports), correcte lege toestanden, visuele samenhang shell.
Afhankelijkheden: WP-A04. Tests: e2e smoke, regressiesuite, viewport-check.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A06A én WP-A07 (parallel) · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A06A — Team-billingarchitectuur en testmode
Scope: organisatiebilling-architectuur, grandfathering, geen dubbele
facturatie, testmode, featureflag. **Geen live betalingen.** Blokkeert de
harde R1-keten niet zolang testmode groen is.
Afhankelijkheden: WP-A05. Tests: testmode end-to-end organisatiebilling.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A07 (WP-A06B loopt los, geen blokkade) · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A06B — Definitieve prijs en Stripe-productie (beslispoort)
Scope: René beslist prijs, abonnementsvorm, livegang. Pas nodig vóór
commerciële productieactivatie — **buiten de harde functionele bouwketen**.
Afhankelijkheden: WP-A06A (architectuur moet bestaan, geen functionele
blokkade van de rest van Track A).
`AUTO_CONTINUE_ALLOWED`: NO · `NEXT_ON_SUCCESS`: activeert live betalingen · `NEXT_ON_BLOCK`: blijft testmode
`REQUIRES_RENE_DECISION`: **YES — vaste beslispoort** · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A07 — Club/Jeugd/rechten consolidatie-audit
Scope: CT_00–08, CJT_00–15, CYD_01–12, clubrollen, parent-permissions,
entitlements, consent, auditlogging, leeftijdsovergangen, multi-guardian,
locatiepermissie, teamrollen — classificeer elk als `BEWEZEN_BESTAAND` /
`BUILT_NOT_VERIFIED` / `ALLEEN_RUNTIMEVALIDATIE_NODIG` /
`GEDEELTELIJK_BESTAAND` / `WERKELIJK_ONTBREKEND` /
`VERVALLEN_DOOR_NIEUWER_BESLUIT`. **Medisch-teamtoestemming (CT_06) blijft
hier alleen classificatie — de bouw ervan verhuist naar WP-B08.**
Afhankelijkheden: WP-A05. Verboden: nieuw parallel rechten-/consentmodel.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A08 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A08 — Club/Jeugd: aanvullen wat aantoonbaar ontbreekt
Scope: alleen `WERKELIJK_ONTBREKEND`/`GEDEELTELIJK_BESTAAND`-items uit
WP-A07 bouwen (rollen, kalender/locaties/evenementen/aanwezigheid,
aankondigingen/communicatie/auditlog, toestemmingspoort, jeugd/ouder-consent,
reconfirmatie). Medisch (CT_06) expliciet **buiten scope** hier.
Afhankelijkheden: WP-A07.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A09 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A09 — Club release-readiness
Scope: minimaal organisatie-betaalmodel actieve sporters (koppelt aan
WP-A06A) + release-readiness-/bewijsrapport clublaag.
Afhankelijkheden: WP-A08.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A10 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A10 — Groep/selectie en trainingsplanning
Scope: groep/team/selectie kiezen, training maken/kiezen, datum/tijd plannen.
Afhankelijkheden: WP-A09.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A11 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A11 — Rennercontrole, uitzonderingen en personalisatie
Scope: past-de-training-check per renner, uitzonderingen tonen,
persoonlijke uitvoeringsversie (FTP/zones/leeftijd/herstel/belasting/
blessures/tijd/materiaal/rol). **Verboden**: stilzwijgende verandering van
trainersintentie. Afhankelijkheden: WP-A10.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A12 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A12 — Publicatie naar Vandaag, Plan en clubkalender
Scope: publiceren + doorwerking naar de 3 doelschermen, geen apart
clubtrainingsmodel. Afhankelijkheden: WP-A11.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A13 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A13 — Aanwezigheid, uitvoering en feedback
Scope: aangemeld/afgemeld/aanwezig/niet verschenen, uitvoering vastleggen,
korte feedback. Afhankelijkheden: WP-A12.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A14 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A14 — Traineroverzicht en integrale end-to-endvalidatie (praktijktest 1/5)
Scope: groepsoverzicht + individuele detail, één volledige e2e-test van de
hele dagelijkse trainerflow. Afhankelijkheden: WP-A13.
`AUTO_CONTINUE_ALLOWED`: NO (wacht op praktijktest) · `NEXT_ON_SUCCESS`: WP-A15 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: **YES**

### WP-A15 — Gedeelde workspace-architectuur en rolwisselaar
Scope: centrale data-/rechtenlaag, gedeelde componenten, multi-rol-wisselaar
(cockpit + informatielogica, niet alleen knoppen). **Verboden**: losse
apps, dubbele engines. Afhankelijkheden: WP-A14.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A16 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A16 — Persoonlijke werkruimtes: renner en ouder/verzorger
Scope: renner (Vandaag/Plan/Analyse/herstel/doelen/routes/wedstrijden,
eenvoudig) + ouder (kind-selectie/training/wedstrijd/aanwezigheid/
toestemming/meldingen/toegangsoverzicht, rustig/laag-technisch).
Afhankelijkheden: WP-A15.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A17 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A17 — Trainerwerkruimtes: clubtrainer en hoofdtrainer/coach
Scope: clubtrainer (groepen/trainingsweek/publiceren/uitzonderingen/
aanwezigheid/feedback) + hoofdtrainer (meerdere groepen/periodisering/
belasting-herstel/doelen/trainersplanning/kwaliteitscontrole/vergelijking).
Afhankelijkheden: WP-A16.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A18 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A18 — Teamoperatie: ploegleider/teammanager en teambegeleiding
Scope: selectie/wedstrijden/taken/logistiek/Koerskamer/volgauto/
verzorgingspunten/teamstatus + gedeelde-taken/rolgebonden-info.
Afhankelijkheden: WP-A17.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A19 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A19 — Materiaalwerkruimte: mechanieker
Scope: renners/fietsen, materiaalprofielen, onderhoud, defecten,
reserveonderdelen, wedstrijdvoorbereiding, uitgifte/retour.
Afhankelijkheden: WP-A18.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A20 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A20 — Beheerwerkruimte: clubbeheerder
Scope: leden/rollen/groepen/uitnodigingen/toestemming/auditlog/
organisatiepakket/koppelingsvelden (nog niet actief zonder WP-B16-keuze).
Afhankelijkheden: WP-A19.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A21 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A21 — Integrale rechten-, responsive- en datalekvalidatie (rollen)
Scope: rolwissel veroorzaakt geen data-/rechtenlek; alle cockpits
responsive op 6 verplichte viewports. Afhankelijkheden: WP-A16–A20.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A22 · `NEXT_ON_BLOCK`: stop (datalek = harde stopconditie)
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A22 — Koerskamer naam-/architectuuraudit
Scope: classificeer bestaande `wedstrijd-room.tsx`/`race-room` als
Koerskamer, Wedstrijdcompilatie, of te splitsen. Afhankelijkheden: WP-A21.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A23 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A23 — Koerskamer basis: parcours, selectie, rollen, taken
Scope: voorbereidingsfase-structuur. Afhankelijkheden: WP-A22.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A24 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A24 — Koerskamer uitvoering en evaluatie
Scope: materiaalcheck, mechaniekerkoppeling, volgauto/teamauto (hergebruik
bestaande engine), verzorgingspunten, eenvoudige teamcommunicatie,
wedstrijddagstatus (R1-licht, geen live-volgen), evaluatie, archief.
Locatiepermissie altijd expliciet; onbetrouwbare live status nooit als
zeker tonen. Afhankelijkheden: WP-A23.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A25 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A25 — R1-TECHNIEK
Scope: runtime, regressie, data-trust-herbevestiging, desktoptest,
mobieltest. Afhankelijkheden: WP-A24, WP-A09.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A26 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A26 — R1-RECHTEN-EN-PRIVACY
Scope: rollen, jeugd, ouders, toestemming, cross-user, cross-club, privacy.
Afhankelijkheden: WP-A25.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A27 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A27 — R1-COMMERCIEEL-EN-INTEGRATIE
Scope: testbilling, entitlement, featureflags, organisatiebilling,
kritieke end-to-end-integraties (functioneel, geen live Stripe).
Afhankelijkheden: WP-A26.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-A28 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-A28 — Menselijke praktijktests (praktijktest 2/5 t/m 5/5)
Scope: praktijktest René, praktijktest Dylan, realistische clubflow
end-to-end, realistische teamflow end-to-end — **4 momenten in dit pakket**.
Afhankelijkheden: WP-A27.
`AUTO_CONTINUE_ALLOWED`: NO (wacht op mensen) · `NEXT_ON_SUCCESS`: WP-A29 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO (uitvoering van een test, geen besluit) · `REQUIRES_HUMAN_PRACTICE_TEST`: **YES**

### WP-A29 — Release-readinessrapport en R1 GO/NO-GO (beslispoort)
Scope: consolidatierapport + definitieve GO/NO-GO. **Vereist**: Track A
functioneel groen, INFRA-12 groen, minimale Track MARKT-releasebasis groen
(MARKT-03 publieke website, MARKT-04 pilot/wachtlijst/CRM, MARKT-05
contentstrategie, MARKT-10 commerciële meetlaag, MARKT-11 releasecampagne +
contentvoorraad), geen open data-/privacy-/rechten-/securityblokkers, en de
menselijke praktijktests afgerond. **Hoeft niet te wachten op**: volledige
Media-room, live Koerskamer, externe clubintegratie, medische
specialistrollen, volledige automatische social-publicatie, betaalde
advertenties, of volledige contentautomatisering.
Afhankelijkheden: WP-A28, INFRA-12, MARKT-03, MARKT-04, MARKT-05, MARKT-10,
MARKT-11.
`AUTO_CONTINUE_ALLOWED`: NO · `NEXT_ON_SUCCESS`: R1 vrijgegeven · `NEXT_ON_BLOCK`: geen release
`REQUIRES_RENE_DECISION`: **YES — vaste beslispoort** · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

---

## TRACK B — Parallel autonoom spoor (18)

### WP-B01 — VIS-00: data-/visualisatie-audit
Verboden: codewijziging tijdens audit. Mag VIS-vervolg zelf annuleren/
samenvoegen/herordenen.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-B02 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B02 — VIS-correctie en nieuwe views
Scope: CTL/ATL/TSB, VI/EF/decoupling, power curve (alleen indien WP-B01
dit aantoont), post-training-view, trendview, doelkoppeling.
Afhankelijkheden: WP-B01.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-B03 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B03 — VIS verbanden/correlatie + responsive/toegankelijkheid
Afhankelijkheden: WP-B02.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-B04 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B04 — PLAN-00/01: audit + centraal datacontract
Scope: bestaande Plan-code/doelen/databronnen auditeren, herkomst-/
betrouwbaarheidscontract. Afhankelijkheden: geen harde koppeling aan
Track A (mag parallel).
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-B05 en WP-B04A (parallel) · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B04A — Adaptieve Analyse voor Gratis, Go en Compleet
Vaste productregel: abonnement bepaalt diepte; doel bepaalt prioriteit;
taalniveau bepaalt terminologie.
Scope: (A) abonnementen free/go/complete; (B) primaire doelen — gezond
actief blijven, fitter worden, afvallen, prestatie verbeteren,
wedstrijdgericht; (C) terminologie — begrijpelijke taal naast sporttermen;
(D) **één gedeelde Analyse-architectuur, geen drie losse Analyse-apps, geen
parallelle engines, dezelfde centrale data/berekeningen** — alleen
kaartvolgorde, samenvatting en standaarddetailniveau verschillen; technische
details blijven altijd beschikbaar; gebruiker kan doel/terminologie zelf
wijzigen; (E) Gratis: basisweekoverzicht, eenvoudige voortgang,
begrijpelijke samenvatting, beperkte gewichtstrend indien aanwezig, geen
betaalmuur op basisbegrijpelijkheid; (F) Go: beweegmomenten, actieve tijd,
regelmaat, herstel, gewichtstrend, rustig vs. stevig, haalbare volgende
stap, sporttermen optioneel; (G) Compleet: volledige technische analyse
(CTL/ATL/TSB/FTP/vermogen), Plan-koppeling, scenario's, wedstrijdgerichte en
geavanceerde herstel-/belastinganalyse; (H) afvallen: start-/huidig-/
doelgewicht, trend over 4/12/26 weken, geen exacte einddatum, geen
crashdieetadvies, geen medische diagnose, calorieverbruik alleen als
schatting, gewicht standaard privé, minderjarigen alleen binnen bestaand
consentmodel; (I) begrijpelijke termen minimaal: CTL→Conditieopbouw,
ATL→Recente belasting, TSB→Balans tussen inspanning en herstel,
FTP→Duurzaam fietsvermogen, HRV→Herstelsignaal,
Trainingsvolume→Totale beweegtijd, Intensiteitsverdeling→Rustig en stevig
bewegen, Readiness→Hoe klaar je lichaam is voor inspanning.
**Dataregels**: geen mockdata, geen fallback als persoonlijke data, UNKNOWN
stuurt geen advies, geen berekeningswijziging, geen cross-user-lek, sport-/
gezondheidsdata niet naar marketinganalytics.
Afhankelijkheden: bestaande Analyse-code, centrale doelenbron, entitlements,
abonnementen, WP-A05 (kernstabilisatie), WP-B01 (VIS-audit, indien relevant).
Mag parallel aan de PLAN-reeks lopen. Blokkeert Track A alleen bij een
concreet data-, privacy-, rechten- of veiligheidsprobleem in de bestaande
R1-Analyse.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: meldt gereed, geen blokkade van WP-B05 · `NEXT_ON_BLOCK`: stop, alleen Track A-blokkade bij data-/privacy-/rechten-/veiligheidsprobleem
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B05 — Plan zakelijke laag, adaptatie en haalbaarheid
Scope: begrensd adaptief gesprek (vaste domeinen), zakelijke laag (geen
illustratie), herberekening alleen bij vastgelegde triggers, haalbaarheid
als bandbreedte. **Stopconditie**: een puntvoorspelling i.p.v. bandbreedte
is een blokkade. Afhankelijkheden: WP-B04.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-B06 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B06 — Motivatiecontract en integrale Plan-validatie
Scope: WOOP-obstakel, procesdoelen, terugkomritme, doorwerking naar Analyse
(één centraal model), afsluitende Plan-validatie. Afhankelijkheden: WP-B05.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: einde Plan-reeks · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B07 — Fysiologie-/contextlaag (beslispoort)
Scope: PLAN-08 — wacht op medische/juridische validatie vóór bouw.
Afhankelijkheden: WP-B06.
`AUTO_CONTINUE_ALLOWED`: NO · `NEXT_ON_SUCCESS`: wacht op René · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: **YES — vaste beslispoort** · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B08 — Club medisch-teamtoestemming (beslispoort)
Scope: CT_06 — toestemmingsmodel voor specialistische clubrollen, zonder
automatische brede verspreiding van gevoelige data. **Verhuisd uit Track A
— blokkeert de gewone Club/Team-pilot niet.** Gewone trainer-/ouder-/club-/
teamrechten (WP-A07/A08) lopen door zonder op dit pakket te wachten.
Afhankelijkheden: WP-A07 (classificatie).
`AUTO_CONTINUE_ALLOWED`: NO · `NEXT_ON_SUCCESS`: wacht op René · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: **YES — vaste beslispoort** · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B09 — Media-basis
Scope: kosten-/opslag-/privacyaudit (eerste read-only stap) + evenementroom,
uitnodiging/QR/tijdelijke link, upload, opslagarchitectuur, rechten.
Status: `PARALLEL_PILOT`, plaatsing (R1/pilot/R1.1) volgt uit de audit.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-B10 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B10 — Media-weergave
Scope: mediagrid, tijdlijn, beheer, handmatige persoons-/momentbevestiging,
verwijderen. Afhankelijkheden: WP-B09.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-B11 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B11 — Media-AI-en-privacy
Scope: duplicaat-/kwaliteitsdetectie, AI-conceptselectie/-samenvatting,
beheerdersgoedkeuring, bewaartermijn, toestemming intrekken, auditlog.
Niet-minimaal (buiten scope): gezichtsherkenning, volautomatische montage,
publieke publicatie, algemene AI-training, livestreaming.
Afhankelijkheden: WP-B10.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-B12 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B12 — Wedstrijdcompilatie: classificatie + MVP
Scope: afhankelijk van WP-A22-classificatie; album, samenvatting,
highlightvideo, publicatiecontrole. Status: `R1_1_CANDIDATE`.
Afhankelijkheden: WP-A22, WP-B11.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-B13 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B13 — Koerskamer livefuncties (uitgebreide versie)
Scope: live-volgen, uitgebreide evaluatie — geen R1-vereiste.
Afhankelijkheden: WP-A24. Status: `PARALLEL_PILOT`.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-B14 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B14 — Analyse-grafiek stylingpakket
Scope: SPARKI_GRAFIEK_DESIGN_SPEC toepassen — CTL blijft visueel primair,
ATL ondersteunend en minder visueel gewicht, geen ATL-area-fill dominanter
dan CTL, tokens centraal hergebruiken. **Verboden**: elke wijziging aan
onderliggende berekeningen/cijfers/assen/scenario's. Geen R1-blocker tenzij
een concrete regressie dit noodzakelijk maakt.
Tests: visuele regressietest (cijfers identiek), responsive-/contrasttest.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: WP-B15 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B15 — Externe clubintegratie-audit
Scope: AllUnited/Sportlink/Spond/Cyql — API/export, leden, teams, groepen,
rollen, kalender, wedstrijden, aanwezigheid, clubidentiteit, privacy,
sync-richting, conflictafhandeling, kosten, haalbaarheid.
Afhankelijkheden: WP-A20.
`AUTO_CONTINUE_ALLOWED`: YES (onderzoek, geen besluit) · `NEXT_ON_SUCCESS`: WP-B16 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B16 — Keuze eerste extern clubplatform (beslispoort)
Afhankelijkheden: WP-B15.
`AUTO_CONTINUE_ALLOWED`: NO · `NEXT_ON_SUCCESS`: WP-B17 · `NEXT_ON_BLOCK`: n.v.t.
`REQUIRES_RENE_DECISION`: **YES — vaste beslispoort** · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### WP-B17 — Integratiebouw gekozen platform
Scope: bouw per datacategorie voor het gekozen platform. Principe:
synchroniseren waar mogelijk, zelf bouwen waar onderscheidend — mag
Sparki's rechten-/toestemmings-/isolatiemodel nooit omzeilen.
Status: `DEFERRED_MET_REDEN` (reden: wacht op WP-B16).
Afhankelijkheden: WP-B16.
`AUTO_CONTINUE_ALLOWED`: YES (na WP-B16) · `NEXT_ON_SUCCESS`: einde parallel spoor · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

---

## TRACK INFRA — VPS, deployment en productiegereedheid (12)

Bekende actuele status (v3.01, live server-inventarisatie): VPS
`sparki-vps2`, IP `141.138.141.205`, Ubuntu 24.04.4 LTS, SSH-toegang bewezen
werkend, server bereikbaar en vrijwel leeg, geen Sparki-repository aanwezig,
Node/npm/PM2/Docker/Certbot ontbreken, firewall staat uit, applicatie nog
niet gedeployed, productie nog niet gereed.

Track INFRA loopt parallel aan Track A/B, geïsoleerd. **Definitieve R1
GO/NO-GO (WP-A29) vereist zowel Track A functioneel groen als INFRA-12
groen.**

### INFRA-01 — VPS-baseline en beveiligingsinventarisatie
Scope: Ubuntu-updates, actieve services, open poorten, SSH-configuratie,
root-login, password authentication, bestaande gebruikers, schijf/geheugen/
load. **Geen wijzigingen zonder bewijs.** Afhankelijkheden: WP-000.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: INFRA-02 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### INFRA-02 — Veilige deploygebruiker en SSH-hardening
Scope: aparte deployuser, key-based login, sudo-beperking, root-login
beperken, password authentication uitschakelen. **Verplicht**: eerst een
tweede actieve SSH-sessie testen vóór wijziging; rollbackplan tegen
buitensluiten. Afhankelijkheden: INFRA-01.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: INFRA-03 · `NEXT_ON_BLOCK`: stop (risico op buitensluiting = harde stopconditie)
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### INFRA-03 — Firewall en netwerkbasis
Scope: UFW configureren, alleen noodzakelijke poorten (SSH/HTTP/HTTPS),
voor/na-bewijs. **Geen applicatiepoorten publiek open laten.**
Afhankelijkheden: INFRA-02.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: INFRA-04 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### INFRA-04 — Runtime en procesbeheer
Scope: actuele ondersteunde Node LTS, npm/corepack waar nodig, PM2 (geen
Docker tenzij de repo dit aantoonbaar vereist), versie-/autostarttest.
Afhankelijkheden: INFRA-03.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: INFRA-05 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### INFRA-05 — Repository, deploypad en bronbasis
Scope: repo `vinkrene-jpg/sparki-frontend`, branch `main`, deploypad,
juiste rechten, clone/fetch zonder secrets in repo, **actuele live SHA
vastleggen (gekoppeld aan WP-000-bewijs)**, schoon werkpad bewijzen.
Afhankelijkheden: INFRA-04, WP-000.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: INFRA-06 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### INFRA-06 — Productie-environmentconfiguratie
Scope: benodigde environmentvariabelen inventariseren, secrets buiten Git.
**Ontbrekende secrets = geregistreerde blokkade, geen secretwaarden in
rapportage.** Staging/productie duidelijk gescheiden. Afhankelijkheden: INFRA-05.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: INFRA-07 · `NEXT_ON_BLOCK`: stop bij ontbrekende secret (niet technisch oplosbaar = voorwaardelijke gate)
`REQUIRES_RENE_DECISION`: alleen bij ontbrekende, niet-oplosbare externe toegang · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### INFRA-07 — Build en applicatieservice
Scope: dependencies installeren, productiebuild, startcommando bewijzen,
PM2/systemd-service, restart na crash, autostart na reboot, logs zonder
secrets. Afhankelijkheden: INFRA-06.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: INFRA-08 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### INFRA-08 — Nginx en reverse proxy
Scope: Nginx installeren/configureren, frontend + API-routing, headers,
compressie, timeoutlimieten. **Verboden**: bestaande FPS Connect-
configuratie raken (aparte server, aparte infrastructuur).
Afhankelijkheden: INFRA-07.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: INFRA-09 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### INFRA-09 — Domein, DNS en SSL
Scope: bedoeld Sparki-domein vaststellen, A/CNAME-controle, Certbot/
gelijkwaardig, HTTPS, automatische certificaatvernieuwing, HTTP→HTTPS.
**Stopt wanneer DNS of domeinkeuze ontbreekt.** Afhankelijkheden: INFRA-08.
`AUTO_CONTINUE_ALLOWED`: YES, tenzij domein nog niet gekozen · `NEXT_ON_SUCCESS`: INFRA-10 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: **voorwaardelijke beslispoort — alleen als domein nog niet vastligt** · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### INFRA-10 — GitHub Actions-deployment
Scope: bestaande workflows eerst inventariseren, GitHub-deploykey/secrets
controleren (alleen secretnamen rapporteren), veilige deployment naar VPS,
rollback naar vorige release, deployment gekoppeld aan exacte commit-SHA.
**Geen automatische productie-release zonder geldige tests.**
Afhankelijkheden: INFRA-09.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: INFRA-11 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: alleen bij ontbrekende, niet-oplosbare externe API-toegang · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### INFRA-11 — Logging, monitoring en backup
Scope: applicatielogs, logrotatie, service-status, schijfwaarschuwing,
uptimecontrole, backup van productieconfiguratie/data, hersteltest of
aantoonbaar herstelplan. Afhankelijkheden: INFRA-10.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: INFRA-12 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### INFRA-12 — Productie-smoketest en infrastructuurvrijgave
Scope: HTTPS bereikbaar, juiste applicatieversie, login, API-koppeling,
databaseverbinding, statische assets, foutpagina's, reboot-/autostarttest,
deployrollbacktest, geen kritieke securitybevindingen.
Eindstatus: `PRODUCTION_INFRA_READY` of `BLOCKED`.
Afhankelijkheden: INFRA-11. **Voedt WP-A29 (R1 GO/NO-GO) als vereiste input.**
`AUTO_CONTINUE_ALLOWED`: YES (resultaat gaat naar WP-A29, geen zelfstandige
productiefreigave) · `NEXT_ON_SUCCESS`: meldt gereed aan WP-A29 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

---

## TRACK MARKT — Commercie, marketing en release-activatie (12)

Loopt parallel aan Track A en Track INFRA. **Vaste kostenregel**: geen
marketingbureau, geen dure socialmedia-/marketingtoolabonnementen, geen
betaalde websitebuilder als standaardkeuze, geen advertentiebudget als
R1-voorwaarde — eerst organische groei en eigen software, pas betalen
wanneer een kanaal aantoonbaar converteert. **Introduceert geen nieuwe
harde beslispoorten.**

### MARKT-01 — Marktpositie en doelgroepboodschappen
Scope: merkbelofte, positionering, probleem dat Sparki oplost, onderscheid
t.o.v. Strava/TrainingPeaks/Garmin/Komoot/clubsoftware, boodschap per
doelgroep (Gratis/Go/Compleet-gebruiker, renner, ouder, trainer, club,
team), claimscontrole, tone of voice. **Verboden**: medische of
gegarandeerde resultaatclaims. Afhankelijkheden: WP-000.
Acceptatie: per doelgroep één hoofdprobleem, één kernbelofte, één
hoofdactie, geen tegenstrijdige positionering.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: MARKT-02 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### MARKT-02 — Website- en funnelarchitectuur
Scope: publieke websitestructuur (hoofdpagina, Gratis/Go/Compleet, Club,
Team, Trainer, Ouder, pilot, wachtlijst, demo, kennisartikelen, privacy,
contact), duidelijke conversiepaden. **Verboden**: één pagina vol met alle
functies zonder doelgroepfocus. Afhankelijkheden: MARKT-01.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: MARKT-03 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### MARKT-03 — Publieke website en landingspagina's (releasebasis)
Scope: daadwerkelijke websitebouw, snelle/toegankelijke pagina's, mobiel en
desktop, eigen code (geen verplicht Wix/HubSpot/Webflow-abonnement),
formulieren, SEO-basis, privacyvriendelijke analytics. **Verboden**:
sport-/gezondheidsdata in marketingtracking. Afhankelijkheden: MARKT-02.
**Vereist voor publieke release (WP-A29).**
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: MARKT-04 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### MARKT-04 — Pilot, wachtlijst en eenvoudige commerciële CRM (releasebasis)
Scope: clubpilot-aanmelding, teaminteresse, rennerwachtlijst,
trainercontact, herkomst/status/vervolgactie (demo gepland/pilot
gestart/conversie), eenvoudige interne CRM-weergave. **Geen volledig
extern CRM-abonnement vereist.** Afhankelijkheden: MARKT-03. **Vereist voor
publieke release.**
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: MARKT-05 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### MARKT-05 — Contentstrategie en vaste formats (releasebasis)
Scope: contentpijlers, vaste formats (Instagram/TikTok/LinkedIn/YouTube/
websiteartikelen/nieuwsbrief/clubberichten), echte praktijkverhalen — René
en Dylan als testers/praktijkbron, **niet als verplichte influencers** —
onderwerpen (wedstrijd/training/herstel/materiaal/routes/clubs/teams),
publicatieritme, contentkalender. Afhankelijkheden: MARKT-04. **Vereist
voor publieke release.**
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: MARKT-06 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### MARKT-06 — Sparki Marketingwerkruimte
Scope: intern contentbeheer (ideeën/campagnes/doelgroep/scripts/captions/
hashtags/status/publicatiedatum/campagnecode/resultaten/goedkeuringsstatus).
**Geen extern betaald planningspakket nodig.** Afhankelijkheden: MARKT-05.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: MARKT-07 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### MARKT-07 — Contentgenerator, hergebruik en mediabibliotheek
Scope: één praktijkverhaal hergebruiken als korte video/reel/TikTok-script/
carrousel/LinkedIn-post/websiteartikel/nieuwsbrief/clubbericht, centrale
mediabibliotheek. **Alleen materiaal met geldige toestemming, geen
automatische gezichtsherkenning, geen algemene AI-training op clubbeelden**,
duidelijke bron en toestemming. Afhankelijkheden: MARKT-06.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: MARKT-08 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### MARKT-08 — Handmatige publicatiewachtrij en optionele social-API's
Scope: status "klaar voor publicatie", per-platform export (caption/
formaat/thumbnail/link/campagnecode). **Handmatig publiceren via gratis
platformapps is R1-voldoende** — API-publicatie pas later wanneer
technisch/juridisch/praktisch zinvol. **Verboden**: automatische onbeheerde
publicatie. Afhankelijkheden: MARKT-07.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: MARKT-09 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### MARKT-09 — Referral-, clubcode- en organische groeimotor
Scope: clubcodes, uitnodigingslinks (trainer/team), QR-codes,
herkomstmeting, doorverwijzingen, pilotwerving, organische clubgroei.
**Verboden**: piramide- of agressief affiliate-model. Afhankelijkheden:
MARKT-08.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: MARKT-10 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### MARKT-10 — Commerciële meetlaag en dashboard (releasebasis)
Scope: bezoekers/kanaal/campagne/doelgroep/landingspagina/aanmelding/
proefperiode/actieve gebruiker/clubuitnodiging/betaald abonnement/
opzegging/conversie, kosten-per-acquisitie zodra betaalde tests later
bestaan. **Volledig gescheiden van persoonlijke sport-/gezondheidsdata.**
Afhankelijkheden: MARKT-09. **Vereist voor publieke release.**
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: MARKT-11 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### MARKT-11 — Releasecampagne en contentvoorraad (releasebasis)
Scope: eerste contentvoorraad, releasekalender, website live, pilotlijst,
demo's, perskit, screenshots, uitlegvideo's, club-/teamverhalen, FAQ,
supportinformatie, kanalen/verantwoordelijkheden. **Geen publieke release
zonder deze minimale contentbasis.** Afhankelijkheden: MARKT-10, INFRA-09
(domein). **Vereist voor publieke release — meldt gereed aan WP-A29.**
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: meldt gereed aan WP-A29 · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

### MARKT-12 — Reputatie, feedback en optimalisatie
Scope: reacties, reviews, gebruikersvragen, klachten, terugkerende
bezwaren, verkeerde claims corrigeren, content verbeteren op basis van
echte vragen, kanaalresultaten vergelijken. **Verboden**: geautomatiseerde
openbare reacties zonder menselijke controle. Afhankelijkheden: MARKT-11.
Status: `PARALLEL_PILOT` — mag na de releasebasis doorontwikkelen.
`AUTO_CONTINUE_ALLOWED`: YES · `NEXT_ON_SUCCESS`: doorlopend, geen vast eindpunt · `NEXT_ON_BLOCK`: stop
`REQUIRES_RENE_DECISION`: NO · `REQUIRES_HUMAN_PRACTICE_TEST`: NO

---

## TRACK C — Latere productvoorraad (18, geen werkpakket-ID, niet meegeteld in de 73)

| Onderdeel | Status |
|---|---|
| Trainer Campus | `TOEKOMSTIG_ONDERDEEL` |
| Volledige trainermarktplaats | `TOEKOMSTIG_ONDERDEEL` |
| Trainer Passport (zelfstandig) | `TOEKOMSTIG_ONDERDEEL` |
| Volledige native mobiele pariteit | `DEFERRED_MET_REDEN` (web/PWA-first) |
| Multisport | `DEFERRED_MET_REDEN` (eerst cycling-product compleet/stabiel) |
| Verdere Media-room-uitbreidingen | `PARALLEL_PILOT` |
| Verdere Wedstrijdcompilatie-uitbreidingen | `R1_1_CANDIDATE` |
| Verdere routes-/navigatie-uitbreiding | `R1_1_CANDIDATE` |
| Verdere materiaalmodules | `R1_1_CANDIDATE` |
| Admin-prijsconsole (BILL-10) | `DEFERRED_MET_REDEN` (eerder al zo besloten) |
| Overige v3.02-onderdelen buiten R1 | `R1_1_CANDIDATE`/`DEFERRED_MET_REDEN`, te bevestigen in WP-000/WP-A07 |
| Automatische social-API-publicatie | `DEFERRED_MET_REDEN` (eerst organische conversie bewijzen) |
| Betaalde advertentiecampagnes | `DEFERRED_MET_REDEN` (eerst organische conversie bewijzen) |
| Externe marketingbureaus | `DEFERRED_MET_REDEN` (eerst organische conversie bewijzen) |
| Geavanceerde marketingautomatisering | `DEFERRED_MET_REDEN` (eerst organische conversie bewijzen) |
| Uitgebreide nieuwsbriefautomatisering | `DEFERRED_MET_REDEN` (eerst organische conversie bewijzen) |
| Influencerprogramma | `DEFERRED_MET_REDEN` (eerst organische conversie bewijzen) |
| Betaalde acquisitie-experimenten | `DEFERRED_MET_REDEN` (eerst organische conversie bewijzen) |

Niets uit deze lijst is verwijderd — alleen buiten de R1-uitvoeringsketen
geplaatst.

---

## Afhankelijkhedengrafiek (5 sporen)

```
TRACK A (functioneel):
WP-000 -> A01..A04 -> A05 -> {A06A -> A07..A09 | A06B (los, geen blokkade)}
 -> A10..A14 -> A15 -> A16..A20 -> A21 -> A22..A24
 -> A25..A27 -> A28 -> A29 (vereist ook INFRA-12 + MARKT-03/04/05/10/11)

TRACK B (parallel, achter featureflags):
WP-000 -> B01..B03 (VIS) 
       -> B04 (Plan-audit) -> B04A (Adaptieve Analyse, parallel, los van B05)
       -> B05..B06 (Plan) -> B07 (gate, los)
       -> [na A07] B08 (gate, los)
       -> [na B06] B09..B11 (Media) -> [na A22] B12 (Compilatie)
       -> [na A24] B13 (Koerskamer live)
       -> B14 (styling, los, geen afhankelijkheid)
       -> [na A20] B15 -> B16 (gate) -> B17

TRACK INFRA (parallel, geïsoleerd):
WP-000 -> INFRA-01..12 -> meldt gereed aan A29

TRACK MARKT (parallel, geïsoleerd):
WP-000 -> MARKT-01..02 -> MARKT-03 (releasebasis) -> MARKT-04 (releasebasis)
       -> MARKT-05 (releasebasis) -> MARKT-06..09 -> MARKT-10 (releasebasis)
       -> MARKT-11 (releasebasis, na INFRA-09) -> meldt gereed aan A29
       -> MARKT-12 (doorlopend, na releasebasis)

TRACK C: geen uitvoering vóór R1, alleen referentie.
```

**Vastgelegd**: Track A, Track INFRA en Track MARKT mogen alle drie
parallel lopen; Track B mag parallel lopen achter featureflags; Track C
wordt niet uitgevoerd vóór R1; definitieve R1 GO/NO-GO vereist Track A
functioneel groen, INFRA-12 groen, én de Track MARKT-releasebasis
(MARKT-03/04/05/10/11) gereed — **niet** de volledige Media-room, live
Koerskamer, externe clubintegratie, medische specialistrollen, volledige
automatische social-publicatie, betaalde advertenties, of volledige
contentautomatisering; een blokkade in een optioneel parallel onderdeel
(Track B, of niet-releasebasis MARKT-pakketten) blokkeert Track A niet; een
data-, rechten-, privacy- of securityblokker blokkeert wel de relevante
release.

---

## Besluitenregister

| Open besluit | Status |
|---|---|
| Master Plan v3.02 geverifieerd | **gesloten — bestand beschikbaar en intern bevestigd als versie `3.02` d.d. `2026-07-29`** |
| Live GitHub-SHA-verificatie | open — WP-000 (kandidaat `666b702`, laatst bevestigd in v3.01) |
| Volledige taakontdubbeling | open — WP-000 |
| #382/#383 huidige status | open — WP-000 bepaalt, WP-A01/A02 verwerken |
| Definitieve prijs + Stripe-productie | open — WP-A06B |
| Medisch/juridische validatie (fysiologielaag) | open — WP-B07 |
| Medisch/juridische validatie (club-specialistrollen) | open — WP-B08 |
| Eerste extern clubplatform | open — WP-B16 |
| Cyql koppelen/concurreren/beide | open |
| Sparki-domeinkeuze | open — INFRA-09, ook input voor MARKT-03/11 |
| Classificatie `wedstrijd-room.tsx` | open — WP-A22 |
| Media-room: R1/pilot/R1.1 | open — WP-B09 |
| Vercel: uitschakelen/behouden voor preview/later gebruiken | open (v3.01) |
| Wanneer een marketingkanaal "aantoonbaar convergeert" en dus betaalde opschaling rechtvaardigt | open — geen vast criterium vastgelegd |

**Broncontrole afgerond**: `SPARKI_AI_MASTER_PLAN_v3_02.yaml` is beschikbaar en gecontroleerd. De interne documentversie is `3.02`, de datum is `2026-07-29` en de status is `AUTHORITATIVE_PRODUCT_TARGET`. De Build Pack-bronverwijzing is daarmee geldig.

---

## Statusregister

Alle pakketten starten op `NOT_STARTED`, behalve WP-000 dat direct
`READY_TO_START` is. Na uitvoering: `BUILT_NOT_VERIFIED`,
`VERIFIED_FOR_R1`, `BLOCKED`, `REMOVED_AS_ALREADY_EXISTING`, of
`SUPERSEDED_BY_MP_UPDATE`. Track INFRA-eindstatus: `PRODUCTION_INFRA_READY`
of `BLOCKED`. Track MARKT-releasebasis-eindstatus (MARKT-03/04/05/10/11):
`RELEASE_BASIS_READY` of `BLOCKED`.

---

## Eerstvolgende automatische uitvoerreeks

**Start met WP-000.** Bij succes automatisch en gelijktijdig door naar:
WP-A01 (Track A, data-trust), INFRA-01 (Track INFRA, VPS-baseline), én
MARKT-01 (Track MARKT, marktpositie). Track B start zodra de eerste
relevante afhankelijkheid vrij is (WP-B01 VIS-audit kan direct na WP-000
starten; WP-B04A kan starten zodra WP-B04 en WP-A05 beide gereed zijn),
onafhankelijk van Track A/INFRA/MARKT verder.

---

*Status blijft `DRAFT_R1_BUILD_PACK_V1_NOG_NIET_VRIJGEGEVEN` totdat: de
live GitHub-SHA is geverifieerd in WP-000, open Replit-taken zijn
ontdubbeld, #382/#383-status is vastgesteld, Adaptieve Analyse (WP-B04A) en
Track MARKT compleet zijn (beide: gedaan in dit document), René het
werkpakketregister heeft goedgekeurd zonder elk pakket afzonderlijk te
hoeven beoordelen, en ChatGPT heeft gecontroleerd dat dit aansluit op het
échte Master Plan v3.02. Claude bouwt en voert hier niets van uit.*
