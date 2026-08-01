# SPARKI — MOBIELE COMPONENTBIBLIOTHEEK v1.0

**Technische code:** `MOBILE_UX_STANDARD_01` — oplevering 2 van 5
**Hoort bij:** `SPARKI_MOBILE_UX_STANDARD_v1.4.md`
**Status:** BINDEND, afgeleid. Dit document werkt de standaard uit en mag hem niet tegenspreken.
**Datum:** 1 augustus 2026

---

## 0. Hoe dit document werkt

Het kerndocument zegt *wanneer* je welke vorm kiest (MUX-28). Dit document zegt *hoe die vorm eruitziet als gedrag*: wat het onderdeel doet, wat het moet kennen, en waar het niet voor bedoeld is.

**Componentcodes.** Ieder component heeft een code `CMP-nn`. Dezelfde governance als MUX-codes (MUX-95): nieuwe component is nieuwe code, codes worden nooit hergebruikt, codes zijn identificatie en geen volgorde, en bouwpakketten en Mirror-bevindingen verwijzen naar de code.

**Geen vormgeving.** Kleur, typografie, iconografie en het logo staan uitsluitend in `BRAND_IDENTITY_01`. Dit document beschrijft gedrag, opbouw en grenzen. Waar hieronder "het compacte merkteken" staat, wordt het element uit dat handboek bedoeld.

> **Openstaand, niet door dit document op te lossen:** het compacte S-merkteken is nog niet als bronbestand gevonden. Componenten die het gebruiken (CMP-01, CMP-33) worden gebouwd met de plaats gereserveerd; het merkteken wordt later ingevoegd. Geen enkel component tekent zelf een alternatief.

**Vaste opbouw per component.**

| Veld | Betekenis |
|---|---|
| Doel | waar dit component voor is, in één zin |
| Wanneer | de situatie waarin je het kiest |
| Wanneer niet | de situatie waarin het de verkeerde keuze is |
| Eisen | bindend gedrag, met de MUX-regel erbij |
| Lege toestand | wat het toont als er niets is |
| Wedstrijddag | de variant in de modus van MUX-96, of "niet van toepassing" |
| Sparki | een concreet voorbeeld uit het product |

---

## 1. Componentcontract

**CMP-00 — Wat voor élk component geldt.** Een component dat hier niet aan voldoet, wordt niet opgeleverd. Mirror toetst dit contract vóór het component zelf.

1. **Eén doel.** Een component doet één ding. Twee doelen is twee componenten.
2. **Bedienbaar formaat.** Tikvlak minimaal 48 × 48 dp met 8 dp tussenruimte; in de wedstrijddagmodus minimaal 64 × 64 dp (MUX-24, MUX-25).
3. **Tekstbudget.** Titel één regel. Lopende tekst maximaal 280 tekens; meer gaat achter het uitlegicoon (MUX-15, MUX-72).
4. **Kent zijn lege toestand.** Met uitleg, oorzaak, verantwoordelijke en eerstvolgende actie (MUX-48).
5. **Kent zijn laadtoestand.** Skeleton in de vorm van de verwachte inhoud, met de definitieve ruimte gereserveerd (MUX-56, MUX-93d).
6. **Kent zijn foutstoestand.** In gewone taal, zonder codes of veldnamen (MUX-52).
7. **Springt niet.** Wat later binnenkomt, verschuift niets wat al bedienbaar was (MUX-93, MUX-98f).
8. **Is uitspreekbaar.** Iedere knop, ieder icoon en iedere status heeft een leesbare naam voor de schermlezer (MUX-69).
9. **Kleur is nooit de enige drager.** Altijd ook een woord of vorm (MUX-67).
10. **Doet wat het label belooft.** Half werkende functies worden niet als knop getoond (MUX-81a).
11. **Loopt niet dood.** Elk component dat een eindpunt kan zijn, biedt een vervolgstap of een zichtbare terugweg (MUX-88).
12. **Hoort bij een hoofdtaak.** Een component dat informatie toont, benoemt waar die bij hoort en wat je ermee kunt (MUX-99).
13. **Blokkeert de kernbediening niet.** Zware inhoud in een component laadt uitgesteld (MUX-98).

---

## 2. Navigatie en structuur

### CMP-01 — Bottom navigation
**Doel:** de enige hoofdnavigatie op mobiel.
**Wanneer:** altijd aanwezig op elk hoofdscherm.
**Wanneer niet:** binnen een wizard, tijdens navigatie en in de wedstrijddagmodus — daar is de taak de context.
**Eisen:**
- Maximaal vijf items; aantal, namen, iconen en volgorde zijn voor **alle** rollen gelijk (MUX-14a–c).
- Alleen de inhoud achter een item verandert met de actieve rol (MUX-14d).
- Een item dat een rol niet gebruikt, blijft staan en toont een lege toestand (MUX-14e) — het verdwijnt niet en verschuift niet.
- Geen hamburgermenu als alternatief of aanvulling (MUX-60).
- Badges op items volgen CMP-28.
**Lege toestand:** niet van toepassing op het component zelf; wel op de inhoud erachter.
**Wedstrijddag:** vervangen door CMP-39; de gebruiker verlaat de modus expliciet om terug te keren.
**Sparki:** de trainer die zelf ook rijdt, ziet dezelfde vijf items in dezelfde volgorde — alleen de inhoud van "Vandaag" verschilt per actieve rol.

### CMP-02 — Contextwisselaar
**Doel:** tonen in welke rol en organisatie de gebruiker werkt, en die laten wisselen.
**Wanneer:** bij iedere gebruiker met meer dan één rol, organisatie of gekoppeld kind.
**Wanneer niet:** bij een gebruiker met één context — dan is de context een stille regel, geen bedienbaar element.
**Eisen:**
- Permanent zichtbaar op elk hoofdscherm (MUX-62).
- Eén vaste plek; wisselen kan nergens anders.
- De context wisselt nooit vanzelf; automatische contextwissel binnen een rol is alleen toegestaan volgens MUX-97c en wordt altijd zichtbaar aangekondigd (MUX-93).
- Na wisselen blijft de gebruiker op het equivalente scherm, niet op een startpagina.
**Lege toestand:** niet van toepassing.
**Wedstrijddag:** toont de actieve rol en het evenement, maar staat wisselen niet toe tijdens een lopende operatie zonder bevestiging.
**Sparki:** ouder van twee kinderen die ook clubbeheerder is.

### CMP-03 — Tabs
**Doel:** twee tot vier gelijkwaardige weergaven van hetzelfde onderwerp.
**Wanneer:** MUX-34.
**Wanneer niet:** voor stappen in een proces (gebruik CMP-21), voor meer dan vier weergaven, of als de keuze iets opslaat.
**Eisen:** tabtitel één woord waar mogelijk; de actieve tab is herkenbaar zonder kleur; wisselen bewaart de scrollpositie per tab; inhoud van een niet-actieve tab laadt uitgesteld (MUX-98b).
**Lege toestand:** per tab, niet gedeeld — een lege tab zegt waarom hij leeg is.
**Wedstrijddag:** niet gebruiken. Eén weergave tegelijk.
**Sparki:** route — Overzicht / Hoogte / Bewaard.

### CMP-04 — Segment control
**Doel:** snel wisselen tussen twee of drie elkaar uitsluitende weergaven.
**Wanneer:** MUX-35.
**Wanneer niet:** bij meer dan drie opties, of als de keuze iets vastlegt in plaats van toont.
**Eisen:** de keuze verandert alleen de weergave, nooit de gegevens; de actieve stand is herkenbaar zonder kleur.
**Lege toestand:** de weergave eronder toont de lege toestand, het segment blijft bedienbaar.
**Wedstrijddag:** alleen bij twee opties, met tikvlakken van 64 dp.
**Sparki:** activiteitenoverzicht — Week / Maand.

### CMP-05 — Action sheet
**Doel:** het overloopmenu voor secundaire acties.
**Wanneer:** zodra er meer dan drie secundaire acties zijn (MUX-13, MUX-39).
**Wanneer niet:** voor de primaire actie, en niet als verkapte navigatie.
**Eisen:** maximaal zes items; destructieve items visueel gescheiden en onderaan (MUX-23); sluiten mag altijd zonder gevolg.
**Lege toestand:** een action sheet zonder items wordt niet geopend — dan is de knop er niet.
**Wedstrijddag:** maximaal drie items.
**Sparki:** op een activiteit — delen, exporteren, verwijderen, naar route.

### CMP-06 — Zwevende actieknop (FAB)
**Doel:** één dominante actie op een overzichtsscherm.
**Wanneer:** precies één per scherm, en alleen als die actie duidelijk dominant is (MUX-38).
**Wanneer niet:** bij twee of meer gelijkwaardige acties, en nooit samen met CMP-07 — die sluiten elkaar uit.
**Eisen:** blijft binnen de duimzone (MUX-21); nooit boven op inhoud die de gebruiker moet kunnen lezen; verdwijnt niet tijdens scrollen (MUX-93).
**Lege toestand:** blijft staan — juist bij een leeg scherm is dit vaak de eerstvolgende actie.
**Wedstrijddag:** niet gebruiken; de primaire actie staat in CMP-07.
**Sparki:** routeoverzicht — nieuwe route.

### CMP-07 — Vaste primaire actiebalk
**Doel:** de enige primaire actie van een scherm, altijd bereikbaar.
**Wanneer:** op elk scherm met een taak (MUX-12, MUX-22).
**Wanneer niet:** op puur informatieve overzichten zonder taak — die krijgen CMP-06 of niets.
**Eisen:** één gevulde knop; vast onderaan, scrollt niet uit beeld; het toetsenbord bedekt hem nooit (MUX-46); destructieve acties staan hier niet in (MUX-23); de knoptekst benoemt het resultaat, niet de handeling ("Bezetting bevestigen", niet "Opslaan").
**Lege toestand:** als de actie nu niet kan, blijft de knop zichtbaar maar uitgeschakeld mét de reden ernaast — nooit stil uitgeschakeld.
**Wedstrijddag:** 64 dp hoog, één regel, één handeling (MUX-96b, MUX-96f).
**Sparki:** wedstrijdbezetting — "Bezetting bevestigen".

---

## 3. Kaarten

### CMP-08 — Basiskaart
**Doel:** één samenhangend onderwerp op een overzicht.
**Wanneer:** als de gebruiker meerdere onderwerpen naast elkaar moet kunnen scannen.
**Wanneer niet:** voor een enkel onderwerp dat het hele scherm vult — dan is het geen kaart maar een scherm.
**Eisen:** maximaal vier kaarten boven de vouw (MUX-18); één titel op één regel; maximaal één actie per kaart; de hele kaart is aantikbaar als hij naar een detail leidt.
**Lege toestand:** de kaart verdwijnt niet, maar toont waarom hij leeg is (MUX-48).
**Wedstrijddag:** één regel tekst, geen samenvattende cijfers.
**Sparki:** "Vandaag" op het sporterstartscherm.

### CMP-09 — Statuskaart
**Doel:** één toestand tonen die de gebruiker moet kennen.
**Wanneer:** bij toestanden met gevolgen — beschikbaarheid, goedkeuring, koppeling, rode vlag.
**Wanneer niet:** voor voortgang (CMP-10) of voor een taak (CMP-11).
**Eisen:** status in woord én vorm, nooit alleen kleur (MUX-67); noemt sinds wanneer de status geldt; verandert niet zonder aankondiging (MUX-93c); benoemt de hoofdtaak waar hij bij hoort (MUX-99a).
**Lege toestand:** "status onbekend" is een geldige status en wordt als zodanig getoond, met wie dit kan oplossen.
**Wedstrijddag:** alleen statussen die de dag raken.
**Sparki:** materiaalstatus vóór vertrek → vervolgstap "Controle starten".

### CMP-10 — Voortgangskaart
**Doel:** laten zien hoe ver iets is.
**Wanneer:** bij meerstapsprocessen, seizoensopbouw, inrichting van een organisatie.
**Wanneer niet:** als er geen eindpunt is — voortgang zonder doel is een cijfer zonder betekenis.
**Eisen:** toont waar de gebruiker staat én wat de eerstvolgende stap is; nooit alleen een percentage; percentage wordt niet als projectstatus gebruikt.
**Lege toestand:** "nog niet begonnen" met de eerste stap als actie.
**Wedstrijddag:** vervangen door CMP-37.
**Sparki:** organisatie-inrichting bij `TEAM_ONBOARDING_01`.

### CMP-11 — Takenkaart
**Doel:** één taak die de gebruiker kan afronden.
**Wanneer:** overal waar iets van de gebruiker wordt gevraagd.
**Wanneer niet:** voor informatie zonder handeling.
**Eisen:** noemt wat er moet gebeuren, voor wie, en vóór wanneer; afvinken in één handeling met zichtbare bevestiging (CMP-32); afgeronde taken verdwijnen niet stil maar verplaatsen zichtbaar (MUX-93).
**Lege toestand:** geen taken = positief gebracht (MUX-50), niet als leeg vlak.
**Wedstrijddag:** CMP-37.
**Sparki:** "Bevestig je beschikbaarheid voor zaterdag".

### CMP-12 — Detailkaart met vervolgstap
**Doel:** een detail tonen én de gebruiker verder helpen.
**Wanneer:** op elk detailscherm dat anders alleen informatie zou tonen.
**Wanneer niet:** nooit weglaten — dit is de standaardvorm van een detail (MUX-99b).
**Eisen:** benoemt de hoofdtaak waar het detail bij hoort; biedt minimaal één uitvoerbare vervolgstap; als er echt geen vervolg is, staat er een zichtbare terugweg (MUX-88a); Mirror toetst de keten, niet de kaart (MUX-99e).
**Lege toestand:** detail zonder gegevens toont de reden en de weg terug.
**Wedstrijddag:** vervolgstap beperkt tot wat onderweg kan (MUX-96k).
**Sparki:** een klim bekijken → "Toevoegen aan route".

### CMP-13 — Eerste-actiekaart
**Doel:** het eerste bedienbare element van een scherm, beschikbaar vóór de rest laadt.
**Wanneer:** op elk scherm met een zware secundaire laag — kaart, grafiek, profiel, achtergrondbeeld.
**Wanneer niet:** op schermen die in hun geheel licht zijn.
**Eisen:** verschijnt en werkt vóór secundaire inhoud (MUX-98a, d); wordt niet verplaatst als de rest arriveert (MUX-98f); is bedienbaar, niet alleen zichtbaar; laadt zelf nooit uitgesteld.
**Lege toestand:** blijft bedienbaar ook als de achterliggende gegevens ontbreken.
**Wedstrijddag:** dit is dan de enige interactie in beeld.
**Sparki:** pagina Klimmen — zoekveld en resultatenlijst zijn bruikbaar; kaart en hoogteprofiel laden pas na selectie.

### CMP-14 — Rolintroductiekaart
**Doel:** de gebruiker laten begrijpen waarom hij hier is en wat hij nu doet.
**Wanneer:** bij eerste login en bij een rolomgeving die nog leeg is (MUX-100).
**Wanneer niet:** als generiek welkom, en niet als de rolomgeving gevuld is.
**Eisen:** toont vijf dingen — actieve rol · voor welke organisatie, groep, team of sporter · wat je met deze rol kunt · wat nog ontbreekt · één concrete eerste actie; geen fictieve personen en geen voorbeelddata (MUX-51); ontbreekt de toewijzing, dan staat erbij wie dat oplost (MUX-100d); verdwijnt pas volgens MUX-100h en blijft daarna oproepbaar via CMP-27.
**Lege toestand:** dit component *is* de nette lege toestand — het vervangt CMP-29 in deze situatie.
**Wedstrijddag:** niet van toepassing; wie in de modus komt, heeft al een toewijzing.
**Sparki:** "Je bent mechanieker van [team]. Start de materiaalcontrole voor het eerstvolgende evenement."

### CMP-15 — Eindscherm- en bevestigingskaart
**Doel:** afsluiten van een taak zonder dood te lopen.
**Wanneer:** aan het einde van elke taak van meer dan één stap.
**Wanneer niet:** bij een enkele directe handeling — die gebruikt CMP-32.
**Eisen:** zegt wat er is gebeurd en wat het gevolg is; biedt minimaal één vervolgstap of een zichtbare terugweg (MUX-88a, b); systeem-terug telt niet mee (MUX-88d); toont wie er nu iets van merkt.
**Lege toestand:** niet van toepassing.
**Wedstrijddag:** korte samenvatting van wat er is gebeurd en wat nog openstaat (MUX-96l).
**Sparki:** "Uitnodiging verstuurd naar [naam]" → "Nog iemand uitnodigen" / "Terug naar de ledenlijst".

### CMP-16 — Eigenaarskaart
**Doel:** eigendom, facturatie en overdracht bereikbaar maken zonder er een rol van te maken.
**Wanneer:** op het startscherm van de beheerrol, alleen voor de eigenaar (MUX-77).
**Wanneer niet:** als apart tabblad, eigen navigatie-item of aparte rolomgeving.
**Eisen:** bovenaan het startscherm van de beheerrol; toont de organisatie en het type (Clubeigenaar / Teameigenaar); eigendomsoverdracht altijd achter CMP-26.
**Lege toestand:** niet van toepassing.
**Wedstrijddag:** niet tonen.
**Sparki:** Teameigenaar die dagelijks als teammanager werkt.

---

## 4. Invoer en selectie

### CMP-17 — Zoekveld
**Doel:** iets vinden zonder te navigeren.
**Wanneer:** zodra een lijst langer wordt dan één schermhoogte.
**Wanneer niet:** als de lijst korter is dan tien items — gebruik dan CMP-18.
**Eisen:** is bruikbaar vóór de lijst geladen is (MUX-98d); resultaten verschijnen progressief (MUX-58); geen resultaten is een lege toestand met een suggestie (MUX-49); zoekopdracht blijft staan bij terugkeer (MUX-42).
**Lege toestand:** "geen resultaten voor [term]" met een weg terug naar de volledige lijst.
**Wedstrijddag:** niet gebruiken — er wordt niet getypt (MUX-96g).
**Sparki:** klim zoeken.

### CMP-18 — Filterrij
**Doel:** een lijst beperken zonder een scherm te verlaten.
**Wanneer:** bij lijsten met een beperkt aantal duidelijke assen.
**Wanneer niet:** als er meer dan zes filters tegelijk zichtbaar zouden zijn (MUX-36) — dan naar CMP-25.
**Eisen:** actieve filters blijven zichtbaar; wissen kan in één handeling; een filter is nooit navigatie; het resultaat verandert direct, want de gebruiker heeft het zelf gedaan (MUX-93b).
**Lege toestand:** het filter dat nul resultaten geeft, zegt dat en biedt "filter wissen".
**Wedstrijddag:** hoogstens twee filters, als chips van 64 dp.
**Sparki:** activiteiten filteren op type.

### CMP-19 — Chip
**Doel:** één selecteerbare of verwijderbare waarde.
**Wanneer:** filters, gekozen renners, gekozen materiaal.
**Wanneer niet:** als navigatie of als knop.
**Eisen:** minimaal 48 dp hoog ondanks de kleine visuele vorm; verwijderen heeft een zichtbaar tikvlak, geen swipe-only (MUX-27).
**Lege toestand:** geen chips = het onderliggende veld toont zijn eigen lege toestand.
**Wedstrijddag:** alleen tonen, niet bewerken.
**Sparki:** geselecteerde renners voor een wedstrijd.

### CMP-20 — Aantalregelaar (stepper)
**Doel:** een klein geheel getal instellen zonder toetsenbord.
**Wanneer:** aantallen tot ongeveer twintig — bidons, wielsets, plaatsen in een voertuig.
**Wanneer niet:** voor grote getallen, vrije waarden of metingen.
**Eisen:** plus en min elk minimaal 48 dp met 8 dp ertussen (MUX-24); waarde is ook direct bewerkbaar buiten de wedstrijddagmodus; grenzen zijn zichtbaar vóórdat je ertegenaan loopt.
**Lege toestand:** een niet-ingevulde waarde toont "—", niet "0".
**Wedstrijddag:** 64 dp, alleen plus en min.
**Sparki:** aantal reservewielen per voertuig.

### CMP-21 — Wizard
**Doel:** een taak met vaste volgorde in behapbare stappen.
**Wanneer:** twee tot vijf stappen met invoer (MUX-17, MUX-33).
**Wanneer niet:** bij meer dan vijf stappen — dan opsplitsen in losse afrondbare taken.
**Eisen:** maximaal drie invoervelden per stap (MUX-16); opslaan bij het verlaten van elke stap (MUX-41); terug zonder verlies; hervatten met zichtbare regel waar je was gebleven (MUX-42); samenvatting vóór bevestigen (CMP-24); bottom navigation is verborgen tijdens de wizard.
**Lege toestand:** een stap zonder keuzemogelijkheden wordt overgeslagen, met vermelding in de samenvatting.
**Wedstrijddag:** niet gebruiken.
**Sparki:** organisatie aanmaken; uitnodiging accepteren en profiel aanvullen.

### CMP-22 — Stapvoortgang
**Doel:** laten zien waar in een wizard de gebruiker is.
**Wanneer:** altijd bij CMP-21.
**Wanneer niet:** los van een wizard.
**Eisen:** "stap 2 van 4" in woorden; het totaal verandert niet halverwege (MUX-93).
**Lege toestand:** niet van toepassing.
**Wedstrijddag:** niet van toepassing.
**Sparki:** clubonboarding.

### CMP-23 — Formulierveld
**Doel:** één gegeven vastleggen.
**Wanneer:** alleen als het gegeven niet gekozen of afgeleid kan worden (MUX-09).
**Wanneer niet:** als het systeem het al weet — dan is het vooringevuld (MUX-44).
**Eisen:** juiste toetsenbordtype (MUX-46); fout wordt bij het veld getoond in gewone taal (MUX-45); label blijft zichtbaar tijdens het typen; optionele velden staan niet in de hoofdstroom (MUX-47).
**Lege toestand:** een verplicht leeg veld toont wat er wordt gevraagd, niet "verplicht".
**Wedstrijddag:** niet gebruiken (MUX-96g); typewerk wordt bewaard als taak voor na afloop.
**Sparki:** lidnummer bij clubinstroom.

### CMP-24 — Samenvatting vóór bevestigen
**Doel:** de gebruiker laat zien wat hij vastlegt vóór hij het vastlegt.
**Wanneer:** vóór elke definitieve bevestiging in een wizard of meerstapstaak (MUX-43).
**Wanneer niet:** bij een enkele omkeerbare handeling.
**Eisen:** toont wat wordt vastgelegd, **wie het te zien krijgt**, en wat het gevolg is; elke regel is aantikbaar om terug te springen naar de bijbehorende stap.
**Lege toestand:** niet van toepassing.
**Wedstrijddag:** teruggebracht tot één regel met bevestiging.
**Sparki:** wedstrijdbezetting vóór verzenden naar de staf.

---

## 5. Overlays

### CMP-25 — Bottom sheet
**Doel:** kiezen of bekijken zonder de context te verliezen.
**Wanneer:** maximaal acht opties, filteren, of een detail bekijken (MUX-29).
**Wanneer niet:** bij invoervelden, bij een taak die hervat moet kunnen worden, of als er nog een niveau onder zit.
**Eisen:** maximaal 60% schermhoogte; maximaal één niveau diep; sluiten mag altijd zonder verlies; opent nooit uit zichzelf, ook niet door de AI (MUX-90d).
**Lege toestand:** een sheet zonder opties wordt niet geopend.
**Wedstrijddag:** maximaal drie opties, 64 dp per regel.
**Sparki:** renner toewijzen aan een selectie.

### CMP-26 — Dialog
**Doel:** een onomkeerbare handeling bevestigen of een blokkerende melding tonen.
**Wanneer:** uitsluitend daarvoor (MUX-31).
**Wanneer niet:** voor informatie, tips, promoties of "wist u dat" (MUX-32).
**Eisen:** maximaal twee knoppen en twee regels tekst; benoemt wat er precies verdwijnt of verandert (MUX-40); de gevaarlijke knop is nooit de standaardknop; verschijnt nooit tijdens navigatie, training, wedstrijd, onboarding of een formulier (MUX-90).
**Lege toestand:** niet van toepassing.
**Wedstrijddag:** alleen bij de noodhandeling (CMP-38); verder wordt bevestigd via CMP-32.
**Sparki:** renner definitief uit een selectie verwijderen.

### CMP-27 — Uitlegsheet
**Doel:** uitleggen wat een onderdeel doet, zonder het scherm vol te schrijven.
**Wanneer:** achter het vraagtekenicoon naast een kop (MUX-72).
**Wanneer niet:** om een onduidelijk scherm te repareren (MUX-73) — dan wordt het scherm herzien.
**Eisen:** opent als CMP-25; sluit zonder gevolg; bevat geen acties; is ook de plek waar de rolintroductie (CMP-14) na afloop opvraagbaar blijft.
**Lege toestand:** een onderdeel zonder uitleg toont geen icoon.
**Wedstrijddag:** niet gebruiken.
**Sparki:** uitleg bij "belastbaarheid" op het analysescherm.

**Popup — verboden.** Een venster dat de gebruiker niet zelf heeft uitgelokt, bestaat niet in Sparki mobiel (MUX-32). Er is geen component voor.

---

## 6. Signalering en toestand

### CMP-28 — Badge
**Doel:** aangeven dat er iets nieuws of openstaands is.
**Wanneer:** op een navigatie-item of een kaart met openstaande acties.
**Wanneer niet:** voor aantallen die niets vragen van de gebruiker.
**Eisen:** een badge betekent altijd "er wacht iets op jou", nooit "er is data"; het getal komt overeen met wat de gebruiker daadwerkelijk aantreft; verdwijnt pas als het echt is afgehandeld, niet bij openen.
**Lege toestand:** geen badge, geen leeg bolletje.
**Wedstrijddag:** alleen op de noodhandeling en op wat de dag raakt.
**Sparki:** drie openstaande beschikbaarheidsverzoeken.

### CMP-29 — Lege-toestandblok
**Doel:** eerlijk zeggen waarom er niets staat.
**Wanneer:** bij elk van de acht toestanden van MUX-49.
**Wanneer niet:** als CMP-14 van toepassing is — die vervangt hem bij een lege rolomgeving.
**Eisen:** bevat altijd vier elementen — uitleg, oorzaak, verantwoordelijke, eerstvolgende actie (MUX-48); nooit alleen een illustratie met "nog niets hier"; "geen open acties" wordt positief gebracht (MUX-50); geen voorbeelddata (MUX-51).
**Lege toestand:** dit *is* de lege toestand.
**Wedstrijddag:** teruggebracht tot oorzaak en actie, één regel elk.
**Sparki:** "Je hebt nog geen gekoppelde trainer. Je clubbeheerder kan die koppelen. Vraag koppeling aan."

### CMP-30 — Offline- en synchronisatiebanner
**Doel:** de verbindingstoestand en de actualiteit van de gegevens zichtbaar maken.
**Wanneer:** zodra de verbinding wegvalt, en op elk scherm met gedeelde operationele gegevens (MUX-59).
**Wanneer niet:** als permanente decoratie bij een goede verbinding.
**Eisen:** offline betekent alleen dat een gestarte navigatie doorloopt (MUX-53); toont wanneer de gegevens voor het laatst zijn bijgewerkt; bij herstel automatisch opnieuw ophalen met vier zichtbare uitkomsten — bezig, volledig gelukt, gedeeltelijk gelukt, mislukt (MUX-53a); bij gedeeltelijk succes staat erbij wát ontbreekt; geen dubbele poging; geen stille herstelpoging.
**Lege toestand:** niet van toepassing.
**Wedstrijddag:** permanent in beeld, één regel.
**Sparki:** dagschema tijdens een etappekoers.

### CMP-31 — Skeleton
**Doel:** laten zien wat er komt en de ruimte alvast vastzetten.
**Wanneer:** zodra laden merkbaar wordt (MUX-56).
**Wanneer niet:** als vervanging van een lege toestand — leeg is niet hetzelfde als laden.
**Eisen:** heeft de vorm van de verwachte inhoud, geen ronddraaiende cirkel op een leeg vlak; reserveert de definitieve ruimte zodat niets springt (MUX-93d); blokkeert de kernbediening niet (MUX-98c); boven de wachtgrens komt uitleg en een uitweg (MUX-57).
**Lege toestand:** gaat over in CMP-29 als er niets blijkt te zijn.
**Wedstrijddag:** maximaal één skeleton in beeld.
**Sparki:** hoogteprofiel dat na selectie van een klim laadt.

### CMP-32 — Bevestigingsmelding met ongedaan maken
**Doel:** een uitgevoerde handeling bevestigen zonder een dialog vooraf.
**Wanneer:** bij omkeerbare handelingen — afvinken, toevoegen, verwijderen uit een selectie.
**Wanneer niet:** bij onomkeerbare handelingen — die gaan via CMP-26.
**Eisen:** verschijnt alleen ná serverbevestiging (MUX-55); nooit lokaal "opgeslagen" tonen zonder dat het verstuurd is; ongedaan maken is kort beschikbaar en zichtbaar; blokkeert de primaire actie niet.
**Lege toestand:** niet van toepassing.
**Wedstrijddag:** dit is de standaardbevestiging (MUX-96f).
**Sparki:** materiaaltaak afgevinkt.

### CMP-33 — Voorbeeldmodusmarkering
**Doel:** onmiskenbaar maken dat dit geen echte organisatie is.
**Wanneer:** in de volledige voorbeeldmodus.
**Wanneer niet:** nergens anders — nooit als demolabel binnen een echte omgeving.
**Eisen:** permanent in beeld, ook op de kleinste breedte en tijdens navigatie (MUX-74); voorbeeldgegevens zijn nooit mengbaar met een echte organisatie; de markering is niet weg te klikken.
**Lege toestand:** niet van toepassing.
**Wedstrijddag:** blijft staan.
**Sparki:** verkennende clubomgeving vóór echte instroom.

---

## 7. AI-componenten

### CMP-34 — AI-voorstelkaart
**Doel:** een advies tonen dat de gebruiker kan aannemen, aanpassen of negeren.
**Wanneer:** op een rustmoment, nooit tijdens navigatie, training, wedstrijd, onboarding of een formulier (MUX-90).
**Wanneer niet:** als middel om iets alvast te doen — de AI voert niets uit zonder expliciete bevestiging (MUX-89b).
**Eisen:** herkenbaar als advies, niet als voldongen feit (MUX-89a); één primaire actie (MUX-12); vier mogelijke uitkomsten — bekijken, accepteren, aanpassen, negeren (MUX-99); wordt niet na verloop van tijd alsnog uitgevoerd (MUX-89c); komt niet terug als herhaalde vraag na negeren (MUX-89d); opent nooit uit zichzelf een sheet, dialog of scherm (MUX-90d); bevat altijd CMP-35.
**Lege toestand:** "de AI kan hier nu niets over zeggen" met oorzaak en verantwoordelijke (MUX-92).
**Wedstrijddag:** zwijgt volledig (MUX-96j).
**Sparki:** voorstel om een zware sessie te verplaatsen → "Voorstel bekijken".

### CMP-35 — AI-onderbouwingsblok
**Doel:** een advies uitlegbaar maken.
**Wanneer:** verplicht bij elk AI-advies (MUX-91).
**Wanneer niet:** nooit weglaten — een advies zonder onderbouwing is niet toonbaar.
**Eisen:** noemt waarom, op welke gegevens, en met welke onzekerheid; past binnen het tekstbudget, de rest achter CMP-27 (MUX-91b); ontbrekende gegevens worden benoemd, niet verzwegen (MUX-91c); presenteert geen zekerheid die de gegevens niet dragen (MUX-91d); offline nooit een oud advies als actueel tonen (MUX-92).
**Lege toestand:** ontbreken de gegevens, dan verschijnt het advies niet — alleen de reden.
**Wedstrijddag:** niet van toepassing.
**Sparki:** "Gebaseerd op je laatste drie ritten en je gemelde vermoeidheid. Er ontbreken slaapgegevens van deze week."

### CMP-36 — AI-vraagveld
**Doel:** de gebruiker een vraag laten stellen.
**Wanneer:** alleen op schermen waar de gebruiker rust heeft.
**Wanneer niet:** tijdens een taak, in een wizard, of in de wedstrijddagmodus.
**Eisen:** volgt CMP-23 voor invoergedrag; het gesprek eindigt met een vervolgstap of een zichtbare terugweg (MUX-88); een antwoord dat tot een handeling leidt, gaat via CMP-34 en dus via bevestiging.
**Lege toestand:** toont voorbeelden van wat je kunt vragen, geen verzonnen gesprek.
**Wedstrijddag:** niet aanwezig.
**Sparki:** vraag over de opbouw van de komende week.

---

## 8. Wedstrijddagcomponenten

De wedstrijddagmodus (MUX-96) is geen apart ontwerp maar een **variant** van bestaande componenten, plus drie eigen. Wat hierboven per component onder "Wedstrijddag" staat, is bindend.

### CMP-37 — Wedstrijddagtaakregel
**Doel:** één taak, afvinkbaar met handschoenen.
**Wanneer:** in de modus, als vervanging van CMP-10 en CMP-11.
**Wanneer niet:** buiten de modus.
**Eisen:** één regel tekst (MUX-96e); tikvlak minimaal 64 dp (MUX-96b); afvinken in één tik met CMP-32 en korte ongedaan-mogelijkheid (MUX-96f); geen invoer (MUX-96g); geen swipe-only, geen dubbeltik, geen slepen, geen lang indrukken als enige weg (MUX-96c); maximaal drie tegelijk in beeld.
**Lege toestand:** "niets meer te doen voor nu", positief (MUX-50).
**Sparki:** "Bidons klaarzetten wagen 2".

### CMP-38 — Noodhandeling
**Doel:** in een acute situatie de juiste persoon bereiken.
**Wanneer:** permanent bereikbaar binnen de modus.
**Wanneer niet:** buiten de modus, en nooit als gewone knop tussen andere acties.
**Eisen:** staat buiten de vaste duimpositie zodat hij niet per ongeluk afgaat (MUX-23, MUX-96h); vraagt één korte bevestiging; bereikt de juiste persoon in de organisatie; bevestigt zichtbaar **dát** de melding is verstuurd.
**Harde grens:** zonder verbinding kan de melding niet worden verstuurd (MUX-54). Het component zegt dat dan expliciet en noemt het alternatief. Stil falen is een directe afkeurgrond (MUX-82) en de ernstigste vorm van MUX-55.
**Lege toestand:** niet van toepassing.
**Sparki:** val in de finale, materiaalpech met stilstand.

### CMP-39 — Wedstrijddagkop
**Doel:** vervangt de bottom navigation binnen de modus.
**Wanneer:** zolang de modus actief is.
**Wanneer niet:** daarbuiten.
**Eisen:** toont het evenement, de eigen rol en de verbindingstoestand (CMP-30); bevat de zichtbare uitgang uit de modus; de modus wordt aangeboden, nooit stil opgelegd (MUX-96a, MUX-93); bij verlaten volgt CMP-15 met een korte samenvatting (MUX-96l).
**Lege toestand:** niet van toepassing.
**Sparki:** etappedag met wisselende ploegleiding.

---

## 9. Verboden en vervallen

| Niet gebruiken | Reden |
|---|---|
| Popup die de gebruiker niet zelf uitlokte | MUX-32 |
| Hamburgermenu als hoofdnavigatie | MUX-60 |
| FAB naast een vaste primaire actiebalk | MUX-38, CMP-06 |
| Functie die alleen via swipe bereikbaar is | MUX-27 |
| Lege toestand met alleen een illustratie | MUX-48 |
| Voorbeeld- of placeholdergegevens in een echte omgeving | MUX-51 |
| Foutmelding met code, veldnaam of stacktrace | MUX-52 |
| Lokale "opgeslagen"-bevestiging zonder serverantwoord | MUX-55 |
| Component dat zichzelf uit beeld haalt tijdens gebruik | MUX-93 |
| Detailscherm zonder vervolgstap of terugweg | MUX-88, MUX-99 |
| AI-melding tijdens navigatie, training, wedstrijd, onboarding of formulier | MUX-90 |
| AI-advies zonder onderbouwing | MUX-91 |

---

## 10. Componentregister

| Code | Component | Belangrijkste regels |
|---|---|---|
| CMP-00 | Componentcontract | alle |
| CMP-01 | Bottom navigation | MUX-14, MUX-60 |
| CMP-02 | Contextwisselaar | MUX-62, MUX-97d |
| CMP-03 | Tabs | MUX-34 |
| CMP-04 | Segment control | MUX-35 |
| CMP-05 | Action sheet | MUX-13, MUX-39 |
| CMP-06 | Zwevende actieknop | MUX-38 |
| CMP-07 | Vaste primaire actiebalk | MUX-12, MUX-22 |
| CMP-08 | Basiskaart | MUX-18 |
| CMP-09 | Statuskaart | MUX-67, MUX-99a |
| CMP-10 | Voortgangskaart | MUX-88 |
| CMP-11 | Takenkaart | MUX-50, MUX-93 |
| CMP-12 | Detailkaart met vervolgstap | MUX-99 |
| CMP-13 | Eerste-actiekaart | MUX-98 |
| CMP-14 | Rolintroductiekaart | MUX-100 |
| CMP-15 | Eindscherm- en bevestigingskaart | MUX-88 |
| CMP-16 | Eigenaarskaart | MUX-77 |
| CMP-17 | Zoekveld | MUX-98d, MUX-49 |
| CMP-18 | Filterrij | MUX-36, MUX-93b |
| CMP-19 | Chip | MUX-27, MUX-36 |
| CMP-20 | Aantalregelaar | MUX-09, MUX-24 |
| CMP-21 | Wizard | MUX-17, MUX-33, MUX-41 |
| CMP-22 | Stapvoortgang | MUX-33 |
| CMP-23 | Formulierveld | MUX-44 t/m MUX-47 |
| CMP-24 | Samenvatting vóór bevestigen | MUX-43 |
| CMP-25 | Bottom sheet | MUX-29 |
| CMP-26 | Dialog | MUX-31, MUX-40 |
| CMP-27 | Uitlegsheet | MUX-72, MUX-73 |
| CMP-28 | Badge | MUX-65, MUX-79 |
| CMP-29 | Lege-toestandblok | MUX-48, MUX-49 |
| CMP-30 | Offline- en synchronisatiebanner | MUX-53, MUX-53a, MUX-59 |
| CMP-31 | Skeleton | MUX-56, MUX-93d, MUX-98 |
| CMP-32 | Bevestiging met ongedaan maken | MUX-55 |
| CMP-33 | Voorbeeldmodusmarkering | MUX-74 |
| CMP-34 | AI-voorstelkaart | MUX-89, MUX-90 |
| CMP-35 | AI-onderbouwingsblok | MUX-91 |
| CMP-36 | AI-vraagveld | MUX-88, MUX-92 |
| CMP-37 | Wedstrijddagtaakregel | MUX-96b–g |
| CMP-38 | Noodhandeling | MUX-96h, MUX-54, MUX-55 |
| CMP-39 | Wedstrijddagkop | MUX-96a, l |

---

## 11. Gebruik door bouwpakketten

- Ieder pakket dat een scherm oplevert, noemt in zijn paragraaf "Mobiele uitwerking" (MUX-85) welke CMP-codes het gebruikt.
- Een nieuw component wordt niet in een bouwpakket bedacht. Ontbreekt er iets, dan wordt deze bibliotheek eerst uitgebreid met een nieuwe CMP-code.
- Een component dat niet in het register staat, is een afwijking en heeft productgoedkeuring van René nodig (MUX-84).
- Mirror-bevindingen verwijzen naar CMP- én MUX-code (MUX-95d).

---

*Einde `SPARKI_MOBILE_COMPONENT_LIBRARY.md`. Volgende opleveringen: `SPARKI_ROLE_BASED_MOBILE_FLOWS.md`, `SPARKI_MOBILE_PATTERNS.md`, `SPARKI_MIRROR_MOBILE_TESTSTANDARD.md`.*
