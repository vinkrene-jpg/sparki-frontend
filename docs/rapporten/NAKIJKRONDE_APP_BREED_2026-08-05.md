# App-brede nakijkronde met concurrentievergelijk — 5 augustus 2026

Opdracht René (na CLUB_AFRONDING_01): "alles van de laatste tijd afronden" +
app-brede nakijkronde met per module een vergelijk met de concurrentie.
Basis: code-inventaris van 05-08 (twee onafhankelijke verkenningsrondes over
web, api-server, mobiel, site) + de bekende productbesluiten. Concurrentie-
oordelen zijn een eerlijke inschatting op basis van publiek bekende feature-
sets (Strava, Komoot, TrainingPeaks, intervals.icu, TrainerRoad, JOIN,
Spond/Sportlink/AllUnited, WhatsApp); geen verse marktmeting.

Leeswijzer per module: **Stand** (af/bijna/half) · **Tegen wie** ·
**Waar Sparki wint** · **Waar de concurrent wint** · **Advies**.

---

## 1. Vandaag / dagcoach — Stand: AF
- **Tegen wie:** JOIN (dagelijkse aanpassing), TrainerRoad (adaptive training).
- **Wint:** deterministische dagstaat met uitleg (dagtype, readiness, één
  leidend Momentblok), eerlijkheid (geen verzonnen data), NL-taal, weer op
  echte thuislocatie. Geen concurrent combineert dagcoach + gezondheid +
  leefagenda.
- **Concurrent wint:** JOIN heeft een groter bewezen wetenschapsteam-imago;
  TrainerRoad heeft meer historische trainingsdata voor kalibratie.
- **Advies:** niets bouwen; bewijslast (Poort 5b/praktijktests) verder vullen.

## 2. Trainen (plan, workoutbouwer, export) — Stand: AF
- **Tegen wie:** TrainingPeaks, TrainerRoad, JOIN.
- **Wint:** vier-lagen-opbouw met uitleg, per-sessie-caps (geen onzin-6-uurs-
  rit), leefagenda stuurt het plan, .zwo/.fit-export, coach-adoptie.
- **Concurrent wint:** TrainingPeaks heeft een enorme coach-marktplaats en
  library van kant-en-klare plannen; TrainerRoad heeft indoor-integratie
  (ERG-besturing) die Sparki niet heeft.
- **Advies:** indoor/ERG bewust NIET bouwen (buiten scope); praktijkcheck
  .zwo/.fit op echt device staat nog open bij René.

## 3. Analyse / Performance Lab — Stand: AF (uitbreiding gepland)
- **Tegen wie:** intervals.icu (de maat), TrainingPeaks WKO.
- **Wint:** uitlegplicht (elke kaart twee zinnen), één belastingsmodel
  (geen dubbele berekeningen), breuk-eerlijkheid bij HR↔vermogen.
- **Concurrent wint:** intervals.icu heeft méér grafieken (powercurve-
  vergelijk, ontkoppeling, efficiëntie, eisprofiel) — precies wat
  ANALYSE_UITBREIDING_EN_ZANDBAK_01 dichtzet. B8-ijking wacht op
  intervals.icu-account (René).
- **Advies:** volgorde §9 van dat pakket aanhouden zodra startsein komt.

## 4. Routes & navigatie (web) — Stand: BIJNA
- **Tegen wie:** Komoot, Strava Routes, Garmin.
- **Wint:** geschiktheids-motor met wegdekcontrole (BGT/GRB), blokkadepoort,
  privacyzones, route-paspoort, bekend-eerst-zoeklaag, niveaus t/m
  "Wedstrijd". Komoot heeft niets vergelijkbaars voor wegdek-eerlijkheid.
- **Concurrent wint:** Komoots community-content (highlights, foto's) en
  wereldwijde dekking; Strava's heatmap-data. Open bij ons: GRB-praktijktest
  op echte Vlaamse route (#477), foutmelding bij mislukte generatie (#31).
- **Advies:** die twee taken zijn de hoogste route-prioriteit; community-
  content bewust niet nabouwen (Sparki World is de eigen weg).

## 5. Mobiele app (opname, navigatie, sensoren) — Stand: BIJNA
- **Tegen wie:** Strava-app, Wahoo/Garmin-headunits, Komoot-app.
- **Wint:** integratie met de coach (fuel-snapshot, rit-verhaal, val-alarm,
  bordjes-sprint), BLE-sensoren, GPX-replay-bewijsketen.
- **Concurrent wint:** headunits winnen altijd op batterij/robuustheid;
  Strava op sociale massa. Open: bewijs achtergrondopname bij vergrendeld
  scherm (#215), rit overleven bij kill (#214), APK-praktijktest bij René.
- **Advies:** #214/#215 zijn de enige geloofwaardigheidsrisico's; APK-ronde
  bij René inplannen.

## 6. Club & team — Stand: BIJNA (na CLUB_AFRONDING_01)
- **Tegen wie:** Spond (planning/aanwezigheid), Sportlink/AllUnited
  (ledenadministratie), WhatsApp (communicatie).
- **Wint:** integratie met training/wedstrijd/materiaal (selecties met
  overrule-hiërarchie, wedstrijddag-logistiek, reeksen t/m seizoenseinde,
  VOG-registratie, jeugd-consent fail-closed). Spond heeft geen sportinhoud.
- **Concurrent wint:** Sportlink/AllUnited blijven de formele ledenadmin
  (bewust besluit: niet nabouwen); Spond is gratis en alom bekend —
  drempel om te wisselen is gedrag, geen functionaliteit.
- **Advies:** afgerond houden; alleen taak #586 (reeks-UI per training) en
  browser-doorloop clubbalken (#588) lopen nog.

## 7. Coach-cockpit — Stand: HALF/BIJNA
- **Tegen wie:** TrainingPeaks Coach Edition.
- **Wint:** Sparki-voorstellen naast het coachbesluit (coach-first afgedwongen),
  gedeelde geheugenlagen met privacy-niveaus.
- **Concurrent wint:** TP heeft facturatie, multi-atleet-kalenderbeheer op
  schaal en een gevestigde coach-community. Onze trainer-facturatie zit in
  BUILD_04 (loopt via bouwstraat).
- **Advies:** geen losse acties; volgt de bouwstraat (TRAINER/BUILD_04).

## 8. Ouderomgeving — Stand: BIJNA
- **Tegen wie:** niemand — geen enkele grote sportapp heeft een echte
  ouderlaag met toestemmingen en welzijnstoezicht. Dit is een uniek
  verkoopargument voor jeugdclubs.
- **Advies:** zo houden; alleen samengesteld-gezag-UI is bewust minimaal.

## 9. Voeding — Stand: HALF
- **Tegen wie:** MyFitnessPal (generiek), Foodcoach-achtigen (EF Pro
  Cycling/Jumbo-app destijds).
- **Wint:** deterministische fueling-richtwaarden gekoppeld aan de echte
  training, jeugd-zonder-getallen, RED-S-weigering — uniek eerlijk.
- **Concurrent wint:** voedingsapps hebben barcode-databases en maaltijd-
  tracking; wij bewust niet (scope).
- **Advies:** half is hier ONTWERP, geen achterstand: verdieping alleen als
  het productplan (VOEDING_01) wordt vrijgegeven.

## 10. Sociaal (Circle/Samen/World) — Stand: AF binnen scope
- **Tegen wie:** Strava (het onverslaanbare netwerk).
- **Wint:** privacy-fail-closed, jeugdveilig, transparant-fictief World,
  geen verslavingsmechanieken (bewust besluit 11-07).
- **Concurrent wint:** netwerkeffect — niet inhaalbaar en dat hoeft ook
  niet; ride-share naar Strava bestaat al.
- **Advies:** SOCIAL_01 pas na de afgesproken MIRROR_PROVEN-keten.

## 11. Kennis/Ontdekken — Stand: AF
- Geen directe concurrent (Strava's nieuwsfeed is geen kennislaag).
  Bronnenregister + relevance-guard zijn sterker dan alles in de markt.

## 12. Abonnementen/billing — Stand: HALF (bewust)
- Stripe-testmodus met echte HMAC en idempotente webhooks staat; livegang is
  een expliciet René-besluit (taak #379). Marketingsite is klaar (prijzen
  uit één SSOT). Geen bouwwerk nodig vóór dat besluit.

---

## Deel 2 — "alles van de laatste tijd": wat er feitelijk nog open staat

**Klaar gemaakt vandaag (05-08):** CLUB_AFRONDING_01 volledig (C1–C4 incl.
reviewfixes, migratie 0058 met dedup-preflight, C2-labels bevestigd,
C3-tablabels hernoemd, C-T6 standaard-clubbalk voor clubbeheer). Vervolg
loopt via taken #586/#587/#588 (taakagenten).

**Wacht aantoonbaar op René (geen agent-actie mogelijk):**
1. B8-ijking — intervals.icu-account nodig voor de vergelijkingskant.
2. Startsein ANALYSE_UITBREIDING_EN_ZANDBAK_01 (volgorde §9 ligt vast).
3. Voorstellen #573–#577 (meetniveau-vervolg) — accepteren/annuleren.
4. Strava-historie-import — wacht op stream-/bestandsroute-besluit.
5. Patch-besluiten J.1–J.5 + beslispunt H.
6. CI-herstel 0.1 — GitHub-connector mist workflow-scope; René via
   webeditor, of ik lever de workflow-bestanden aan.
7. Praktijkcheck .zwo/.fit op echt apparaat + APK-praktijktestronde.
8. Stripe-livegang (#379) en Publish-momenten.
9. Vrijgaven bouwstraat (golf-poort: CI groen + één routerit e2e).

**Advies-prioriteit als er één ding eerst mag:** CI-herstel 0.1 — het is de
benoemde belangrijkste blokkade van de hele bouwstraat en kost René naar
schatting tien minuten met door mij aangeleverde bestanden.
