# MEDIA_UITLEG_01 — REPLIT-OPDRACHTEN

**Deel 9 van 20** · fasen F0 t/m F11

---

## Hoe deze opdrachten werken

Eén fase per opdracht. **Alleen F0 mag na documentgoedkeuring direct worden vrijgegeven.** Elke volgende fase vereist `MIRROR_PROVEN` van de vorige én expliciete vrijgave door René.

Elke fase heeft twintig velden. Vier daarvan zijn voor alle fasen gelijk en staan hier één keer:

- **Rechten (7):** entitlement en rol server-side; nooit client-side verbergen; `CLUB_RECHTEN_01` en de entitlementlaag zijn eigenaar.
- **Niet bouwen (13), altijd:** parallelle contentdatabase · tweede rechtenlaag · videobibliotheek per module · motion-engine per scherm · helpomgeving per functie · nieuwe MUX-, CMP-, PAT- of MTS-codes.
- **Rollback (16):** iedere fase is afzonderlijk terug te draaien zonder de vorige te raken. Uitzondering: F1 terugdraaien betekent alle volgende fasen terugdraaien.
- **Vaste eind-SHA (18):** elke fase levert bewijs op één vaste gepushte SHA. Wijzigt de code tijdens de toets, dan vervalt de toets.

**Waar F0-uitkomsten nodig zijn**, staat dat als **input** genoemd. Replit beslist daar niets zelf; ontbreekt de input, dan gaat de fase terug naar René.

---

## F0 — Inventarisatie · `MEDIA_UITLEG_01_F0`

**Doel** — vaststellen wat er al is, zodat niets dubbel wordt gebouwd en geen enkele latere fase op een aanname staat.

**Scope** — aantoonbaar inventariseren: huidige frontendstack · bestaande animatiebibliotheken · gesturebibliotheken · videocomponenten · audiocomponenten · toegankelijkheidsinstellingen · ondersteuning van `prefers-reduced-motion` · bestaande Help-pagina · bestaande Academy- of kennisstructuur · bestaande oefenweergave · bestaande coachmeldingen · opslag voor gebruikersvoorkeuren · bestaande voortgangs- of bekekenstatus · bestaand contentmodel · objectopslag en CDN · media-upload en -beheer · ondertiteling · huidige route-, klim-, training- en voltooiingskaarten · mobiele en PWA-verschillen · iOS-, Android- en browserbeperkingen · analytics en logging · entitlementcontrole · jeugd- en toestemmingsregels · **de technische route naar Hulp & ondersteuning en de herbruikbare Help-code** · of er een favorietenpatroon bestaat.

**De Academy-locatie zelf is een vastgesteld besluit en geen onderzoeksvraag.** F0 onderzoekt uitsluitend hoe die route technisch loopt en wat aan Help-code herbruikbaar is.

**Bestaande onderdelen eerst** — dit ís die stap.

**Te wijzigen gebieden** — geen. Nul regels productiecode.

**Datamodel/API** — vaststellen welke velden uit deel 3 al bestaan en welke aantoonbaar ontbreken.

**Meetopstelling vaststellen** — welke **fysieke** iPhone en welke fysieke Android als referentietoestel dienen, en welke bestaande meetmiddelen beschikbaar zijn voor schermtijd, gedownloade data, CPU/GPU-belasting en batterijverbruik. Zonder vastgelegde referentietoestellen kan F10 niet meten.

**Mobiele UX / desktop / toegankelijkheid / performance / privacy en jeugd** — inventariseren, niet wijzigen.

**Tests** — niet van toepassing.

**Bewijs** — iedere claim "aanwezig" bevat bestand, component, endpoint of schema. Iedere claim "afwezig" vermeldt **waar is gezocht**. Een claim zonder bewijs telt als niet gedaan.

**Opleverrapport** — vijf documenten:
1. `MEDIA_UITLEG_INVENTARISATIE.md`
2. `MEDIA_UITLEG_HERGEBRUIKMATRIX.md`
3. `MEDIA_UITLEG_RISICOS.md`
4. `MEDIA_UITLEG_PILOTSELECTIE.md`
5. `MEDIA_UITLEG_OPEN_AFHANKELIJKHEDEN.md`

**Mirror-toets** — **formele Mirror-poort op een vaste SHA.** Claude-controle alleen is niet voldoende. Mirror toetst steekproefsgewijs:
- minimaal **vijf** bevindingen "aanwezig" tegen code en repository;
- minimaal **drie** bevindingen "afwezig" door **zelf** te zoeken;
- de technische route naar Hulp & ondersteuning en de herbruikbare Help-code;
- de bestaande motion-, media-, toegankelijkheids- en helptechniek.

**F1 mag pas starten na `F0 MIRROR_PROVEN`.**

**Synchronisatiepatch** — afbouwmatrix: domein "mediaweergave en uitleglaag" krijgt zijn eerste echte statussen in plaats van "onbekend".

---

## F1 — Gedeelde media- en motionbasis · `MEDIA_UITLEG_01_F1`

**Doel** — één basis waarop alle vijf componenten staan.

**Scope** — de motionconfiguratie uit architectuur F-1 t/m F-9 · de schakelaar Verminder beweging (systeem + eigen instelling, server-side bewaard) · ruimtereservering bij overgangen · de gedeelde mediafout- en lege-toestandafhandeling · het contract voor lazy loading.

**Bestaande onderdelen eerst** — hergebruikmatrix uit F0 bepaalt welke bibliotheek wordt gebruikt. Geen nieuwe animatiebibliotheek en geen 3D-engine toevoegen.

**Te wijzigen gebieden** — gedeelde frontendlaag; exacte bestanden volgen uit F0.

**Datamodel/API** — één veld voor de voorkeur "beweging verminderd" op de gebruiker; hergebruik van bestaande voorkeurenopslag indien aanwezig.

**Mobiele UX** — geen zichtbaar component in deze fase.

**Desktop** — dezelfde configuratie.

**Toegankelijkheid** — T-1 t/m T-5 volledig aantoonbaar.

**Performance** — meetbaar op een gemiddeld toestel; graceful degradation ingebouwd.

**Privacy en jeugd** — niet van toepassing.

**Niet bouwen** — geen zichtbaar component, geen speler, geen kaart.

**Tests** — schakelaar in beide richtingen · geen layoutshift · configuratie niet per component overschrijfbaar.

**Bewijs** — een testpagina die alleen voor toetsing bestaat en niet zichtbaar is voor gebruikers.

**Opleverrapport** — welke bibliotheek is hergebruikt, welke waarden de duurklassen hebben, en waarom.

**Mirror-toets** — MTS-50, MTS-51, MTS-52, MTS-68.

**Synchronisatiepatch** — afbouwmatrix: "verminder beweging" van niet gestart naar gebouwd.

---

## F2 — Diepte-/zweefkaart · `MEDIA_UITLEG_01_F2` (CMP-40)

**Doel** — één kaart subtiel laten loskomen, op precies één moment.

**Scope** — CMP-40 volgens het componentcontract, toegepast op **één** bestaand moment uit de toegestane lijst.

**Bestaande onderdelen eerst** — breidt de bestaande kaartcomponent uit; geen nieuwe kaart.

**Te wijzigen gebieden** — de bestaande kaartcomponent en het gekozen scherm.

**Datamodel/API** — geen.

**Mobiele UX** — kanteling alleen tijdens directe aanraking · veilige randen · zichtbare sluit- en terugactie in het scherm zelf.

**Desktop** — hover en klik, geen extra effecten.

**Toegankelijkheid** — leesvolgorde en schermlezeruitvoer ongewijzigd.

**Performance** — geen zware engine, geen continue beweging, geen layoutshift.

**Privacy en jeugd** — geen diepte bij medische of acute inhoud.

**Niet bouwen** — een tweede toepassing "omdat het toch al werkt".

**Tests** — zie de Mirror-toetsen, F2.

**Bewijs** — met en zonder beweging aantoonbaar identiek bruikbaar.

**Opleverrapport** — welk moment is gekozen en waarom.

**Mirror-toets** — MTS-50 t/m MTS-52 plus de F2-scenario's.

**Synchronisatiepatch** — afbouwmatrix: dieptecomponent.

---

## F3 — Mediaspeler · `MEDIA_UITLEG_01_F3` (CMP-41)

**Doel** — media kunnen tonen zonder dat iemand ervan afhankelijk wordt.

**Scope** — CMP-41 volledig: poster · ondertiteling · tekstalternatief · 1× en 0,5× · pauze en hervatten · geen autoplay · mobiele-datakeuze · lazy loading · lage-resolutievariant · fouttoestand · ontbrekende-mediatoestand · pauzeren bij een actieve taak.

**Bestaande onderdelen eerst** — bestaand videocomponent uitbreiden indien aanwezig (F0).

**Te wijzigen gebieden** — gedeelde componentlaag.

**Datamodel/API** — media-URL opvragen (4.4) met entitlement- en leeftijdscontrole vóór afgifte; gebeurtenis melden (4.5).

**Mobiele UX** — knoppen ≥ 48 dp; speler bedekt nooit de primaire actie van het onderliggende scherm.

**Desktop** — grotere speler, zelfde regels, ook daar geen autoplay.

**Toegankelijkheid** — T-6 t/m T-11 volledig.

**Performance** — lazy loading; geen vooraf ophalen; batterijverbruik gemeten.

**Privacy en jeugd** — leeftijdscontrole vóór URL-afgifte.

**Niet bouwen** — geen definitieve interface-opnames, geen inhoud, geen Academy-pagina.

**Tests** — twaalf scenario's, zie Mirror-toetsen F3.

**Bewijs** — alle toestanden aantoonbaar, inclusief afgebroken download.

**Blokkerende input** — **één technisch geschikt testmediabestand** met aantoonbare bron, maker, licentie, gebruiksrecht en versie. Dit testasset is **niet afhankelijk van definitieve `KENNIS_01`-inhoud**. Zonder rechtenvrij testasset blijft F3 `OPEN`; er is **geen `PARTIAL`-doorgang** en F4 wacht altijd op volledig `F3 MIRROR_PROVEN`.

**Opleverrapport** — welk testasset is gebruikt, met het volledige rechtenbewijs.

**Mirror-toets** — MTS-53, 54, 57, 58, 59, 65, 66.

**Synchronisatiepatch** — afbouwmatrix: mediaspeler.

---

## F4 — Gebruikersstatus en contentbinding · `MEDIA_UITLEG_01_F4`

**Doel** — onthouden wat een gebruiker heeft gezien, en inhoud koppelen aan schermen zonder iets te hardcoden.

**Scope** — de statusvelden uit deel 3 hoofdstuk 2 · de vier statuscalls · contentbinding op content-ID en contentversie · versiewisselregel · cross-accountafscherming.

**Bestaande onderdelen eerst** — bestaande voortgangs- of bekekenstatus hergebruiken indien aanwezig (F0).

**Te wijzigen gebieden** — datalaag en API.

**Datamodel/API** — dit is de kern van deze fase; zie deel 3.

**Mobiele UX** — geen zichtbaar component; wel: niets wordt lokaal als bevestigd getoond.

**Desktop** — zelfde status, gedeeld over toestellen.

**Toegankelijkheid** — niet van toepassing.

**Performance** — statusophaling voor een scherm in één call, niet per item.

**Privacy en jeugd** — `do_not_show_again` server-side geweigerd bij acute meldingen en bij minderjarigen; weigering gelogd. Bewaren volgt bestaand beleid.

**Niet bouwen** — geen eigen contentopslag; geen eigen leeftijdsbepaling.

**Tests** — statuswisselingen · versiewissel · cross-account · geweigerde `do_not_show_again`.

**Bewijs** — een statuswijziging overleeft afsluiten en opnieuw openen op een ander toestel.

**Opleverrapport** — welke bestaande modellen zijn hergebruikt, welke velden zijn toegevoegd.

**Mirror-toets** — zie F4 in de Mirror-toetsen.

**Synchronisatiepatch** — afbouwmatrix: gebruikersstatus.

---

## F5 — Uitlegflow · `MEDIA_UITLEG_01_F5` (CMP-42)

**Doel** — een functie kort en begrijpelijk kunnen uitleggen, zonder op te dringen.

**Scope** — CMP-42 volledig, inclusief de vraag vooraf, ondertiteling, pauzeren, overslaan, heropenen via Help, en de **versievastheid**: uitleg die niet meer overeenkomt met de schermversie wordt geblokkeerd.

**Bestaande onderdelen eerst** — eerste-keer-detectie en Help-omgeving (F0). Bestaan die niet, dan worden ze hier gebouwd en apart benoemd.

**Te wijzigen gebieden** — gedeelde componentlaag en Help.

**Datamodel/API** — inhoud opvragen; status via F4.

**Mobiele UX** — richtwaarde 20–45 seconden, geen harde afkap die begrip schaadt; eindigt met een echte uitvoerbare hoofdactie.

**Desktop** — zelfde flow.

**Toegankelijkheid** — zonder geluid volledig begrijpelijk; tekstvariant altijd bereikbaar.

**Performance** — de uitleg vertraagt het openen van de functie niet.

**Privacy en jeugd** — veiligheidsuitleg blijft heropenbaar (J-10).

**Niet bouwen** — geen definitieve opnames, en **geen placeholdervideo, mockuitleg of nagebootste Sparki-inhoud** die zichtbaar wordt in Preview of productie.

**Testfixture** — toetsen gebeurt uitsluitend met een **afgesloten technische testfixture**: niet publiceerbaar, niet bereikbaar voor gewone gebruikers, geen fictieve persoonlijke data. Definitieve uitleg volgt pas na Mirror-bewijs van het echte doelscherm.

**Tests** — tien scenario's, zie Mirror-toetsen F5.

**Bewijs** — status wordt gerespecteerd; de vraag komt niet terug na overslaan.

**Opleverrapport** — welke functie is gekozen, en waarom die stabiel genoeg is.

**Mirror-toets** — MTS-55, 56, 59, 61.

**Synchronisatiepatch** — afbouwmatrix: uitlegflow.

---

## F6 — Oefenkaart · `MEDIA_UITLEG_01_F6` (CMP-43)

**Doel** — één oefening zo tonen dat iemand hem veilig kan uitvoeren.

**Scope** — CMP-43 volledig, inclusief stopregel, leeftijdsclassificatie en gelijkwaardige tekstvariant.

**Bestaande onderdelen eerst** — bestaande oefenweergave (F0 bevestigt of die er is).

**Te wijzigen gebieden** — oefenweergave en gedeelde componentlaag.

**Datamodel/API** — inhoud opvragen; status via F4.

**Mobiele UX** — tekst eerst, media daarna; stopregel permanent zichtbaar.

**Desktop** — zelfde inhoud, ruimer.

**Toegankelijkheid** — tekstvariant functioneel gelijkwaardig: uitvoerbaar zonder beeld.

**Performance** — media laadt uitgesteld.

**Privacy en jeugd** — de volledige jeugdpoort J-1 t/m J-12 geldt hier het zwaarst. Toewijzing aan een minderjarige wordt geauditeerd: wie wees toe, wanneer.

**Niet bouwen** — geen oefeningen, geen oefeningenbeheer, geen inhoudelijke beoordeling. Dat is `KENNIS_01`.

**Blokkerende input** — het contentmodel van `KENNIS_01` én een aanwijsbare, bevoegde inhoudelijke beoordelaar. Zonder beide start F6 niet.

**Tests** — acht scenario's, zie Mirror-toetsen F6.

**Bewijs** — een minderjarig testaccount ziet aantoonbaar geen 1RM-, gewichts- of caloriedoel.

**Opleverrapport** — welke oefening is gebruikt, met welk rechtenbewijs.

**Mirror-toets** — MTS-60, 62, 67.

**Synchronisatiepatch** — afbouwmatrix: oefenkaartweergave.

---

## F7 — Coachmelding · `MEDIA_UITLEG_01_F7` (CMP-44)

**Doel** — een belangrijke niet-acute melding rustig kunnen brengen, en een acute melding correct.

**Scope** — **uitsluitend de niet-acute** zwevende coachmelding van CMP-44: sluiten, uitstellen, niet meer tonen waar toegestaan.

**Uitdrukkelijk niet:** een nieuw acute-meldingenregime. Acute veiligheids- en medische meldingen blijven in hun **bestaande veiligheidslaag** en worden hier niet nagebouwd, niet overgenomen en niet vervangen.

**Wel aantoonbaar toetsen** dat acute en medische meldingen: nooit via CMP-44 worden weergegeven · geen diepte- of speelse animatie krijgen · niet permanent onderdrukbaar worden · bij minderjarigen niet negeerbaar zijn waar de bestaande regels dat bepalen.

**Bestaande onderdelen eerst** — bestaande coachmeldingslaag (F0).

**Te wijzigen gebieden** — meldingslaag en gedeelde componentlaag.

**Datamodel/API** — status via F4; de melding zelf komt uit de bestaande coachlaag.

**Mobiele UX** — verschijnt alleen op een rustmoment; blokkeert nooit de primaire actie.

**Desktop** — zelfde regels.

**Toegankelijkheid** — geluid nooit de enige drager; reden en onzekerheid worden meegelezen.

**Performance** — geen media, geen laadtijd.

**Privacy en jeugd** — J-9 en J-13 t/m J-19. Geen advies over een kind aan de ouder.

**Niet bouwen** — de adviesengine zelf.

**Blokkerende input** — ten minste één echte adviesgrond uit bestaande gebruikersgegevens. Is die er niet, dan wordt de melding **niet** met voorbeelddata getoond en blijft de fase `OPEN`.

**Tests** — negen scenario's, zie Mirror-toetsen F7.

**Bewijs** — de niet-acute melding aantoonbaar, met een minderjarig testaccount voor J-9, plus het bewijs dat acute en medische meldingen buiten CMP-44 blijven.

**Opleverrapport** — welke adviesgrond is gebruikt en waar die vandaan komt.

**Mirror-toets** — MTS-59, 63, 64.

**Synchronisatiepatch** — afbouwmatrix: coachmelding.

---

## F8 — Uitleg en Academy-structuur · `MEDIA_UITLEG_01_F8`

**Doel** — één vindbare plek voor uitleg en inhoud, met de juiste tweedeling.

**Scope** — de structuur onder Hulp & ondersteuning · de twee delen · deeplinks met terugweg · zoekfunctie volgens het bestaande patroon · voortgang en laatst bekeken · rol- en pakketfiltering · heropenen van overgeslagen uitleg. Favorieten **alleen** als er al een favorietenpatroon bestaat.

**Bestaande onderdelen eerst** — bestaande Help- en kennisstructuur (F0).

**Te wijzigen gebieden** — navigatie onder Hulp & ondersteuning; geen wijziging aan de vijf hoofditems.

**Datamodel/API** — inhoud opvragen met filters; status via F4.

**Mobiele UX** — geen zesde hoofditem, geen stil toegevoegd menu.

**Desktop** — meer items naast elkaar, zelfde structuur.

**Toegankelijkheid** — zoekveld bedienbaar vóór de lijst geladen is; lege categorie eerlijk.

**Performance** — lijst eerst, media later.

**Privacy en jeugd** — leeftijdsfiltering in de lijst, niet pas bij het openen.

**Niet bouwen** — entitlements; de bestaande laag wordt gebruikt.

**Blokkerende input** — de technische route naar Hulp & ondersteuning en de herbruikbare Help-code uit F0. De locatie zelf staat vast en is geen open besluit.

**Tests** — zeven scenario's, zie Mirror-toetsen F8.

**Bewijs** — hoofdnavigatie geteld: nog steeds vijf items, gelijk voor alle rollen.

**Opleverrapport** — de gekozen plaatsing, met screenshot van de navigatietelling.

**Mirror-toets** — MTS-55, 56, 57.

**Synchronisatiepatch** — afbouwmatrix: Academy-structuur.

---

## F9 — Pilotcontent en rolgerichte integratie · `MEDIA_UITLEG_01_F9`

**Doel** — de componenten op de juiste plek per rol, met echte pilotinhoud.

**Scope** — toepassing volgens deel 5 hoofdstuk 4, per rol de aanvulling én de grens · de pilotinhoud uit `KENNIS_01` · de acht onderdelen van de pilotset uit het pilotadvies.

**Bestaande onderdelen eerst** — bestaande rolomgevingen; geen nieuwe rolschermen.

**Te wijzigen gebieden** — de bestaande rolstartschermen en de gekozen pilotschermen.

**Datamodel/API** — geen nieuwe.

**Mobiele UX** — per rol aantoonbaar wat wél en wat niet verschijnt.

**Desktop** — zelfde verdeling.

**Toegankelijkheid** — elke rolflow met beweging uit.

**Performance** — gemeten op het zwaarste realistische scherm.

**Privacy en jeugd** — geen coachadvies over een kind aan de ouder; geen individuele voedingsvideo voor een minderjarige zonder bron en controle.

**Niet bouwen** — nieuwe rolschermen; brede visuele herbouw.

**Tests** — de rolmatrix uit de Mirror-toetsen, beide kanten: wat moet verschijnen en wat niet mag.

**Bewijs** — per rol een doorlopen flow met uitkomst.

**Opleverrapport** — de pilotset zoals opgeleverd, met rechtenbewijs per mediabestand.

**Mirror-toets** — MTS-59, 60, 63, 64 plus de rolspecifieke lijsten.

**Synchronisatiepatch** — afbouwmatrix: rolgerichte presentatie.

---

## F10 — Mobiele en desktopregressie · `MEDIA_UITLEG_01_F10`

**Doel** — aantonen dat er niets is stukgegaan.

**Scope** — de volledige testmatrix uit deel 11 · alle flows uit de rolflows met beweging uit én met media uit · lage bandbreedte · ontbrekende media · afgebroken download · batterij- en dataverbruik.

**Bestaande onderdelen eerst** — niet van toepassing.

**Te wijzigen gebieden** — alleen herstel van gevonden tekortkomingen.

**Datamodel/API** — geen wijzigingen.

**Mobiele UX / desktop / toegankelijkheid / performance** — dit is de toets zelf.

**Privacy en jeugd** — de jeugdpoort volledig, met een echt minderjarig testaccount.

**Niet bouwen** — niets nieuws.

**Tests** — de volledige matrix, plus de **vooraf vastgelegde meetscenario's**: schermtijd · hoeveelheid gedownloade data · CPU/GPU-belasting waar meetbaar · batterijverbruik over een vaste testduur · animatie aan versus uit · video versus tekstvariant. Gemeten op de referentietoestellen uit F0. **Geen subjectief oordeel "lijkt soepel".**

**Bewijs** — per matrixcel een uitkomst; "niet getest" is geen uitkomst.

**Opleverrapport** — de regressiebundel met herstellijst.

**Mirror-toets** — MTS-50 t/m MTS-69 volledig.

**Synchronisatiepatch** — releasestatus bijwerken.

---

## F11 — Eindbewijs en beheerdocumentatie · `MEDIA_UITLEG_01_F11`

**Doel** — de laag overdraagbaar maken.

**Scope** — bewijsbundel per fase (SHA, scenario's, uitkomst, openstaande punten) · het beheercontract uit deel 16 · de vertaaltabel · de bijgewerkte lijst met pakketten die naar deze laag verwijzen.

**Bestaande onderdelen eerst** — niet van toepassing.

**Te wijzigen gebieden** — documentatie.

**Datamodel/API** — geen.

**Mobiele UX / desktop / toegankelijkheid / performance / privacy en jeugd** — samenvatten, niet wijzigen.

**Niet bouwen** — een volledige beheeromgeving, tenzij die al bestaat.

**Tests** — controle dat elke fase een bewijs heeft op een vaste SHA.

**Bewijs** — de bundel zelf.

**Opleverrapport** — eindrapport met de vier beweringen B1 t/m B4 uit het README, elk met bewijs.

**Mirror-toets** — de productbelofte als geheel.

**Synchronisatiepatch** — besluitregister, afbouwmatrix, releasestatus, roadmap, dagkaart.

---

## Wanneer een fase gesplitst wordt

Splits verder wanneer de fase: meer dan één schemawijziging vereist · meerdere onafhankelijke componenten bouwt · meer dan één productbelofte tegelijk moet bewijzen · niet veilig binnen één herstelronde kan worden afgerond.

Splitsen is een aanleiding om terug te gaan naar René, niet om zelf twee opdrachten te maken.

---

*Deel 9 van 20.*
