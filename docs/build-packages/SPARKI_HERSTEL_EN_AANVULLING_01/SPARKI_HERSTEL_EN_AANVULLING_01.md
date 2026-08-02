# SPARKI_HERSTEL_EN_AANVULLING_01

**Type:** bouwopdracht voor Replit
**Status:** vastgesteld 02-08-2026
**Gemeten op:** `38a28a4b` (main, 2 augustus 07:16), rechtstreeks in de code
**Uitvoeringsregel:** deze opdracht is de volledige uitvoeringsvrijgave. Alle fasen zelfstandig achter elkaar, rapporteren zonder te wachten. Fasen zijn onderling onafhankelijk tenzij anders vermeld en mogen parallel.

**Waarom deze opdracht bestaat.** De repository is doorzocht en tegen de vastgelegde besluiten gelegd. Wat hieronder staat is gemeten, niet aangenomen — met bestandspad en regelnummer erbij, zodat er geen zoekwerk overblijft. Er is bewust géén nieuwe functionaliteit bedacht: dit dicht gaten in wat al besloten en deels gebouwd is.

---

## F1 — Rolbepaling: je landt niet op je eigen scherm

**Blokkerend voor elke praktijktest. Dit gaat eerst.**

`HA-01` — Gemeten: `artifacts/api-server/src/engines/today/roles.ts` kent in `todayRoles` maar **vijf** weergaven: `atleet`, `trainer`, `ouder`, `clubbeheer`, `hoofdtrainer`. In `availableTodayRoles` worden alleen `athlete`, `coach`, `parent`, `owner`/`admin` en `hoofdtrainer` afgeleid. Regel 110 doet `return available[0] ?? "atleet"`.

`HA-02` — Gevolg: ploegleider, teammanager, mechanieker, soigneur, `medical_staff`, `nutrition_specialist`, assistent, vrijwilliger en alleen-lezen vallen terug op de atleetweergave. De rolstartschermen bestaan wél (`rol-start.tsx`), maar niemand landt erop. Dit botst met het besluit van 01-08 dat **elke rol een eigen scherm krijgt**, en met MUX-81a en MUX-100.

`HA-03` — Bouw: `todayRoles` uitbreiden naar **elke server-side bestaande rolwaarde**. Niet een vaste lijst overtypen — afleiden uit de rolwaarden die de rechtenlaag kent, zodat een nieuwe rolwaarde vanzelf meekomt.

`HA-04` — De terugval `available[0] ?? "atleet"` vervalt. Heeft iemand geen enkele rolweergave, dan krijgt hij een **eerlijke lege toestand**, geen atleetscherm: welke rol, welke context, wat ontbreekt, wie het oplost, één eerste actie. Geen generiek welkom, geen fictieve personen.

`HA-05` — Klaar als: inloggen met elke rolwaarde landt op het bijbehorende scherm, en geen enkele rol krijgt stilzwijgend de atleetweergave.

---

## F2 — Zichtbare context

`HA-06` — Op **elk** scherm is zichtbaar welke rol actief is en in welke organisatie of omgeving je zit. Dit is besluit `MR-B04 = A` van 01-08.

`HA-07` — Een **test- of previewcontext is onmiskenbaar te onderscheiden** van productie. Nu is dat een banner in de preview; het moet een vast onderdeel van de contextregel worden, ook op de mobiele weergave.

`HA-08` — Gemeten aanleiding: op 2 augustus kon de eindopdrachtgever tijdens een praktijktest niet vaststellen in welke omgeving hij zat en welke rol actief was, en heeft de test daarom afgebroken.

`HA-09` — Klaar als: op elk scherm te benoemen valt wie je bent, waar je bent, en of je naar echte of naar testgegevens kijkt.

---

## F3 — Schone testfixtures A t/m H

`HA-10` — Gemeten: er bestaat een fixture-mechanisme (banner "TESTFIXTURE TRAINER ZELFSTANDIG"), maar geen volledige set. Mirror kan daardoor lege toestanden, foutpaden en rolscheiding niet toetsen.

`HA-11` — Lever als één gedocumenteerde set:
| | Stand |
|---|---|
| A | vers Gratis-account, nooit gekoppeld, geen activiteit |
| B | vers Go-account, idem |
| C | vers Compleet-account, idem |
| D | account met echte geïmporteerde providerdata |
| E | account met een falende providerkoppeling |
| F | trainer met één gekoppelde en één niet-gekoppelde sporter |
| G | ouder met een gekoppeld jeugdlid |
| H | club met twee teams |

`HA-12` — Neem de eerder gemelde ontbrekende fixtures voor `nutrition_specialist` en `medical_staff` hierin mee.

`HA-13` — Harde eisen: uitsluitend in dev en preview · nooit bereikbaar vanuit een normaal account · geen seed- of testdata in de productiedatabase · permanent zichtbaar gemarkeerd als testcontext · geen fictieve personen die als echte persoon worden gepresenteerd.

`HA-14` — **Ruim het bestaande testresidu op.** In de gedeelde ontwikkeldatabase staan routes met namen als `Bulk-mirror-0..9` en `MirrorToets save1/save2`, elk met identieke statistieken. Die komen nergens in de code voor — het zijn resten van eerdere toetsen. Ze maken elke waarneming over lege toestanden waardeloos. Opruimen, en de fixtures zo inrichten dat toetsresten niet in een gedeelde database blijven staan.

`HA-15` — Klaar als: Mirror kan tussen de acht standen wisselen zonder inloggegevens te hoeven vragen, en een verse stand is aantoonbaar leeg.

---

## F4 — Eén documentgenerator

`HA-16` — Gemeten: **er zit geen enkele PDF-bibliotheek in de repo.** Geen `pdfkit`, `puppeteer`, `jspdf` of `pdf-lib`, in geen enkel `package.json`.

`HA-17` — Gevolg: er kan geen wedstrijdplan, dagschema, materiaallijst, trainerfactuur of accountuitdraai uit Sparki komen. Vier rapporttypen die in `REPORT_DESIGN_STANDARD_01` bindend zijn vastgelegd bestaan alleen op papier, en de facturatie van de zelfstandige trainer is zonder deze laag onmogelijk.

`HA-18` — Bouw **één generator en één templatebibliotheek**, conform `REPORT_DESIGN_STANDARD_01`. Geen tweede PDF-engine per domein, niets hardcoded in de frontend.

`HA-19` — Eerste drie uitvoeren, in deze volgorde: **dagschema** (RT-12) · **wedstrijdbezetting** (RT-13) · **materiaal- en voertuigenlijst** (RT-14). Die drie hebben hun gegevenskant al: de werkobjectlaag en de wedstrijdtabellen bestaan.

`HA-20` — Merktoepassing: merklocaties reserveren, huidig productiebeeldmerk laten staan waar technisch nodig, definitieve merktoepassing gemarkeerd als afhankelijk van het merkbesluit. Dat besluit blokkeert deze fase niet.

`HA-21` — Klaar als: een ploegleider een dagschema als PDF kan uitdraaien die er professioneel uitziet en klopt met wat er op het scherm staat.

---

## F5 — Stafbezetting per evenement

`HA-22` — Gemeten: `lib/db/src/schema/club.ts` regel 251 en 453 — `club_race_selections.role` staat nog op `renner | reserve | begeleider`. Er bestaan wél aparte tabellen voor briefings, evaluaties, gasten, voertuigen en materiaal (`club_race_briefings`, `club_race_evaluations`, `club_race_guests`, `club_race_vehicles`, `club_race_material_items`).

`HA-23` — Wat ontbreekt: **mechanieker, soigneur, `medical_staff`, chauffeur en ploegleider zijn niet als staf aan een evenement te koppelen.** De hele wedstrijddaglaag eromheen is gebouwd, maar de bezetting zelf is nog de oude drieslag.

`HA-24` — Bouw de staftoewijzing per evenement, met de al vastgelegde regels: seizoensbezetting is niet gelijk aan wedstrijdbezetting · een gast is een aparte toewijzing die na de wedstrijddag vervalt · noodinformatie uitsluitend voor ploegleider, teammanager en medische staf, met inzagelog · mechanieker en soigneur zien alleen naam en of de renner rijdt.

`HA-25` — Geen tweede rechtenarchitectuur. `CLUB_RECHTEN_01` blijft eigenaar van rollen, rechten en scopes.

---

## F6 — Clubdocumenten

`HA-26` — Gemeten: nul treffers op clubdocumenten in de code. Gedragscode, ouderafspraken en reglement bestaan niet.

`HA-27` — Bouw: alleen opslaan en tonen. **Alleen clubbeheer mag plaatsen**, hoofdtrainer en trainers niet. Documenten hangen aan de club, niet aan een persoon. Gebruik de bestaande bestandenlaag; geen aparte bibliotheek per module.

---

## F7 — Betaler en gebruiker afmaken

`HA-28` — Gemeten: de scheiding klant, sporter en betaler is vanochtend gebouwd **voor de zelfstandige trainer** (`billing_parties`, `trainer_clients`, `client_athlete_links`, migratie 0028). Voor **club en ouder** bestaat die scheiding nog niet.

`HA-29` — Bouw door op wat er ligt — geen tweede model. De vier combinaties die moeten werken: sporter betaalt zichzelf · club betaalt voor een lid · ouder betaalt voor een jeugdlid · club betaalt voor een jeugdlid met toestemming van de ouder.

`HA-30` — Clubafname volgens de vastgelegde regels: per lid kiezen · lid mag weigeren en dat telt als zelf opzeggen · bij overname wordt het resterende deel van de eigen betaling terugbetaald met bericht · **de club ziet uitsluitend aantallen**, niet welke leden gebruiken of weigeren · maandelijkse facturatie met staffelkorting in vaste tredes.

`HA-31` — Het vaste lidnummer staat in de aparte opdracht `ABONNEE_ADMIN_02` en hoort technisch ná deze fase.

---

## F8 — Zichtbaarheid van de versie

`HA-32` — Gemeten: `/api/version` geeft op productie inmiddels een echte commit-SHA — dat werkt. Wat ontbreekt is de **webkant**: er is geen `version.json`, dus in de browser is niet te zien welke build je voor je hebt.

`HA-33` — Aanleiding: er wordt vanaf nu **elke ochtend gepubliceerd**. Zonder zichtbare versie is niet vast te stellen of je naar het werk van vandaag kijkt of naar dat van eergisteren — en dat heeft op 2 augustus al tot een waardeloze praktijktest geleid.

`HA-34` — Gevolg voor jullie: elke databasewijziging moet altijd veilig mee kunnen in een dagelijkse publicatie, zonder overleg vooraf. Idempotente migraties met een terugweg, altijd.

---

## F9 — Opruimen

`HA-35` — **PR's #2 t/m #5.** Gemeten: `.github/workflows/pr-checks.yml` staat wél op main (eerst `597c75b`, laatst `b9fc3c8`), maar deze vier PR's hebben nooit een controle gehad omdat hun laatste commit ouder is dan het workflowbestand. Er is niets rood en niets kapot. Per PR: is de inhoud nog actueel → rebase op main en push zodat de controles alsnog draaien; is hij achterhaald → sluiten met korte reden. Conflicten zelf oplossen.

`HA-36` — **Copilot-branches.** `copilot/fix-admin-smoke-check` en `copilot/fix-github-actions-admin-smoke` bevatten mogelijk bruikbaar werk aan de admin-smoke controle. Neem het bruikbare over in de hoofdlijn en ruim de rest op. Geen losse reparatiebranches naast de hoofdlijn.

`HA-37` — **Toetsdocument corrigeren.** In `DATA_TRUST_01_MIRROR_TOETS.md` staat `POST /api/routes/search`. Gemeten: dat pad bestaat niet en heeft nooit bestaan. De routeplanner gebruikt `GET /api/routes/geocode` en `GET /api/routes/ontdek`; platformbreed zoeken loopt via de `/search`-router. Corrigeer het document; dit is geen bouwfout.

`HA-38` — **Vast contextblok voor Mirror.** Zet bovenaan de Mirror-teststandaard een vast blok dat verwijst naar het besluitenoverzicht en de bouwstraat, met de toevoeging dat die stukken context zijn en geen bewijs, en dat Mirror signalen buiten zijn opdracht apart meldt in plaats van ze zelf op te lossen. De volledige tekst staat in `MIRROR_WERKWIJZE_01`.

---

## Volgorde en afhankelijkheden

- **F1 en F2 gaan eerst** en zijn samen klein. Zolang die er niet zijn, heeft geen enkele praktijktest zin en wordt er geen praktijktest gevraagd.
- **F3** kan parallel en deblokkeert Mirror.
- **F4** is het grootste blok en raakt het meeste tegelijk: wedstrijdplan, dagschema, facturatie en accountuitdraai.
- **F5, F6, F7** zijn onderling onafhankelijk.
- **F8 en F9** zijn klein en kunnen ertussendoor.

---

## Directe herstelgronden

`HA-39` — Een rolwaarde die stilzwijgend de atleetweergave krijgt.
`HA-40` — Een scherm waarop niet zichtbaar is welke rol actief is.
`HA-41` — Een testcontext die niet van productie te onderscheiden is.
`HA-42` — Testdata die zichtbaar is in een normaal account, of testresten in een gedeelde database die als gebruikersdata worden getoond.
`HA-43` — Een tweede PDF-engine naast de centrale generator.
`HA-44` — Een uitdraai met verzonnen of placeholdergegevens.
`HA-45` — Een tweede rechtenlaag naast `CLUB_RECHTEN_01`.
`HA-46` — Een club die kan zien welke leden Compleet gebruiken of geweigerd hebben.
`HA-47` — Een migratie die niet mee kan in een dagelijkse publicatie, of zonder terugweg.

---

## Wat ik hierin heb beslist

Deze keuzes zijn van Claude, niet van René, en met één zin terug te draaien.

1. **F1 en F2 gaan vóór alles**, ook vóór nieuwe functionaliteit. Zonder zichtbare rol en omgeving is testen onmogelijk, en testen is de enige manier waarop René nog bijstuurt.
2. **De rollenlijst wordt afgeleid, niet overgetypt.** Anders staan we bij de volgende rolwaarde weer op dezelfde plek.
3. **De documentgenerator komt nu**, niet later. Hij raakt vier domeinen tegelijk en blokkeert de facturatie.
4. **Eerste drie rapporten zijn dagschema, wedstrijdbezetting en materiaallijst**, omdat hun gegevenskant al bestaat en de trainerfactuur nog op btw-afhandeling wacht.
5. **Testresidu opruimen hoort bij de fixtureset**, niet bij een aparte opdracht — het is dezelfde oorzaak.
6. **Het merkbesluit blokkeert de rapportlaag niet.** Locaties reserveren, huidig beeldmerk laten staan.
