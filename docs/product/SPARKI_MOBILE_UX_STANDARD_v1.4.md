# SPARKI — MOBIELE UX-STANDAARD v1.4

**Technische code:** `MOBILE_UX_STANDARD_01`
**Versie:** v1.4 — vervangt v1.3 van dezelfde dag (gerichte patch MUX-76)
**Status:** BINDEND — vastgesteld door René, 1 augustus 2026
**Documenttype:** product- en UX-standaard. Geen code, geen Figma, geen wireframes.
**Oplevering:** 1 van 5 (kerndocument)

---

## 0. Hoe dit document werkt

Dit is het bindende deel. De vier naslagdocumenten (componentbibliotheek, rolflows, patronen, Mirror-teststandaard) werken dit uit maar mogen het niet tegenspreken.

**Regelnummers.** Iedere regel heeft een code `MUX-nn`. Bouwpakketten en Mirror-scenario's verwijzen naar die code, niet naar een paginanummer of een omschrijving.

**MUX-95 — Codegovernance.** De MUX-code is de enige geldige verwijzing naar een regel uit deze standaard.

- **a.** Iedere nieuwe UX-regel krijgt een **nieuwe** MUX-code. Een bestaande regel wordt uitgebreid onder zijn eigen code; een echt nieuwe regel krijgt nooit de code van een bestaande.
- **b.** Codes worden **nooit hergebruikt**. Vervalt een regel, dan blijft de code vervallen staan met de reden en de datum. Het nummer komt niet vrij voor iets anders.
- **c.** Codes zijn **identificatiecodes, geen volgorde**. Een hoger nummer betekent later toegevoegd, niet verderop in het document.
- **d.** Mirror, Claude en Replit verwijzen **uitsluitend** naar MUX-codes. Waar een code bestaat, is een vrije omschrijving ("de regel over lege schermen") niet toegestaan in een bouwpakket, testrapport of bevinding.
- **e.** Een bevinding zonder MUX-code is niet toetsbaar en wordt teruggelegd bij de indiener.
- **f.** Subcodes (`MUX-53a`, `MUX-76a`, `MUX-81a`) horen bij hun hoofdregel en volgen dezelfde regels.

**Afwijken.** Een bouwpakket mag alleen afwijken met expliciete productgoedkeuring van René, vastgelegd als besluit in het besluitregister met vermelding van de regelcode waarvan wordt afgeweken. Een afwijking zonder besluitnummer is een implementatieafwijking, geen keuze.

**Rangorde bij tegenstrijdigheid.**

1. Expliciet besluit van René, jongste datum wint
2. Deze standaard
3. Overige product- en beleidsdocumenten
4. De repository

De code bepaalt nooit wat de standaard zou moeten zijn. Als de app iets anders doet dan hier staat, is de app afwijkend — niet dit document.

**Wat dit document niet regelt.** `BRAND_IDENTITY_01` is de enige bron voor kleur, typografie en iconografie. Deze standaard verwijst daarnaar en herhaalt het niet: hier staat uitsluitend **gedrag** (wanneer welke vorm, hoeveel, hoe groot, hoe reageert het). Waar hieronder "het compacte logo" staat, wordt de S-vorm uit `BRAND_IDENTITY_01` bedoeld. Waar hier een minimumwaarde staat die het merk raakt — zoals de contrastverhouding in MUX-66 — is dat een gedragsondergrens waaraan het merkpalet moet voldoen, geen kleurkeuze van dit document.

---

## 1. Reikwijdte en apparaatdoctrine

### 1.1 Wat "mobiel" betekent

**MUX-01** — Mobiel betekent in Sparki: de app in de browser van een telefoon, geïnstalleerd of niet (web/PWA). Dit bevestigt de apparaatdoctrine uit het structuurherstel WP-R0..R8. Er is geen aparte native app en er wordt in v1 geen aparte native ervaring ontworpen.

**MUX-02** — Deze standaard geldt voor elk scherm dat op een telefoonbreedte wordt getoond, ongeacht welk pakket het bouwt.

**MUX-03** — Mobiel is geen verkleinde desktop. Dezelfde functionaliteit mag beschikbaar zijn; de ervaring mag fundamenteel verschillen. Desktop mag informatiever zijn, mobiel moet sneller en eenvoudiger zijn. Een scherm dat mobiel alleen maar smaller is geworden, voldoet niet.

### 1.2 Twee bevestigingen, één verduidelijking

**MUX-04 (bevestigt bestaand besluit)** — Voor het jeugd- en ouderdomein geldt mobiel **alleen-lezen-eerst**. Op een telefoon kunnen jeugdleden en ouders informatie zien en toestemmingen bevestigen; het inrichten, koppelen en wijzigen gebeurt op een groter scherm. Een bouwpakket dat hier schrijfacties aan toevoegt, heeft een nieuw besluit van René nodig.

**MUX-05 (verduidelijkt de feitelijke situatie)** — De routeplanner is een mobiele webpagina, geen appfunctie. Dat is de bestaande werkelijkheid en blijft zo in v1. De standaard schrijft dus geen "planner in de app" voor; hij schrijft voor hoe die mobiele webpagina zich moet gedragen — en die valt volledig onder MUX-02.

**MUX-06** — Waar een functie mobiel bewust niet beschikbaar is, toont het scherm dat als lege toestand volgens hoofdstuk 7, niet als een knop die niets doet en niet als stilte.

---

## 2. Vijf grondregels

Alles hieronder is een uitwerking van deze vijf. Bij twijfel over een detail: kies wat deze vijf het beste dient.

**MUX-07 — Eén volgende actie.** Elk mobiel scherm maakt binnen twee seconden duidelijk wat de gebruiker nú kan doen. Niet wat er allemaal is.

**MUX-08 — Duidelijkheid boven volledigheid.** Als informatie niet nodig is om de volgende actie te kiezen, hoort die niet op het eerste scherm.

**MUX-09 — Kiezen boven typen.** Iedere invoer die uit bestaande gegevens kan worden afgeleid of uit een lijst kan worden gekozen, wordt niet als vrij tekstveld gebouwd.

**MUX-10 — Nooit stille onzekerheid.** De gebruiker weet altijd of iets is opgeslagen, verstuurd, mislukt of onderweg. "Waarschijnlijk goed gegaan" bestaat niet.

**MUX-11 — Onderbreekbaar.** Elke taak van meer dan één stap kan worden verlaten en later hervat, zonder verlies en zonder opnieuw beginnen. Een telefoon wordt onderbroken; dat is de normale toestand, geen randgeval.

---

## 3. Schermbudget

Dit hoofdstuk is bewust in getallen. Getallen zijn toetsbaar; "rustig" en "overzichtelijk" zijn dat niet.

**MUX-12 — Primaire acties.** Maximaal **één** primaire actie per scherm. Herkenbaar als de enige gevulde knop.

**MUX-13 — Secundaire acties.** Maximaal **drie** secundaire acties zichtbaar zonder scrollen. Meer dan drie gaat naar een overloopmenu of een action sheet.

**MUX-14 — Bottom navigation.** Maximaal **vijf** hoofditems. De navigatie is een vaste plattegrond; de actieve rol bepaalt wat er in de kamers staat, niet hoe het gebouw eruitziet.

- **a.** De **namen** van de hoofditems zijn voor alle rollen gelijk.
- **b.** De **iconen** zijn voor alle rollen gelijk.
- **c.** Het **aantal** en de **volgorde** zijn voor alle rollen gelijk.
- **d.** Alleen de **inhoud achter** een hoofditem verandert met de actieve rol.
- **e.** Een rol die een hoofditem niet gebruikt, ziet dat item mét een lege toestand volgens MUX-49. Items verdwijnen niet en verschuiven niet — dat is de directe consequentie van a t/m c.
- **f.** Doel: wie van rol wisselt (de trainer die zelf ook rijdt, de ouder die ook clubbeheerder is) hoeft niet opnieuw te leren navigeren. Rolwissel verandert de inhoud, nooit de plattegrond.

**MUX-15 — Tekst.** Maximaal **280 tekens** aaneengesloten lopende tekst per blok. Langere uitleg gaat achter een uitklapregel of het uitlegicoon (hoofdstuk 11). Een tekstmuur op een telefoon wordt niet gelezen; hij wordt weggescrold.

**MUX-16 — Invoervelden.** Maximaal **drie** invoervelden per stap. Een vierde veld betekent een tweede stap, niet een langer scherm.

**MUX-17 — Wizardlengte.** Maximaal **vijf** stappen per wizard. Meer dan vijf betekent dat de taak te groot is voor mobiel en wordt opgesplitst in losse, afzonderlijk afrondbare taken.

**MUX-18 — Kaarten op een startscherm.** Maximaal **vier** kaarten boven de vouw, waarvan de eerste altijd de eerstvolgende actie of het scherpste signaal toont.

**MUX-19 — Diepte.** Maximaal **drie** niveaus diep vanaf een bottom-nav-item voordat de gebruiker bij een eindscherm is. Dieper betekent herstructureren, geen extra terugknop.

**MUX-20 — Getallen op één scherm.** Maximaal **zes** losse cijfers of meetwaarden zichtbaar zonder interactie. Daarboven wordt het een dashboard om naar te kijken in plaats van om iets mee te doen.

---

## 4. Duimzone en bediening

**MUX-21 — Duimzone.** Alles wat een gebruiker vaak doet, staat in de onderste **40%** van het scherm. De bovenkant is voor informatie en identificatie, niet voor acties.

**MUX-22 — Primaire actie onderaan.** De primaire actie staat onderaan, vast in beeld, niet meescrollend uit zicht.

**MUX-23 — Destructieve acties niet in de duimzone.** Verwijderen, afmelden, annuleren en overdragen staan bewust buiten de vaste duimpositie, en altijd achter een bevestiging (MUX-40).

**MUX-24 — Tikvlak.** Minimaal **48 × 48 dp**, met minimaal **8 dp** tussenruimte tussen twee tikvlakken.

**MUX-25 — Onderweg-schermen.** Op schermen die tijdens rijden, wedstrijddag of navigatie worden gebruikt: minimaal **64 × 64 dp** tikvlakken, maximaal **drie** tikvlakken in beeld, en geen enkele actie die precisie vereist (geen slepen, geen kleine schuifbalk, geen dubbeltik).

**MUX-26 — Eén hand.** Iedere taak die vaker dan eens per week voorkomt, is met één hand uit te voeren. Twee handen mag alleen bij zeldzame inrichtingstaken — en die horen volgens MUX-04 en MUX-19 vaak sowieso niet mobiel.

**MUX-27 — Swipe.** Swipe mag alleen als versnelling van een actie die ook zichtbaar aanwezig is. Een functie die uitsluitend via swipe bereikbaar is, bestaat niet voor de gebruiker die het niet weet.

---

## 5. Welke vorm gebruik je waarvoor

Dit is de kern van de standaard. De componentbibliotheek werkt de vormen uit; hier staat wanneer je welke kiest. Bij twijfel: kies de zwaardere vorm (nieuw scherm) boven de lichtere (bottom sheet).

### 5.1 Beslisregel

**MUX-28** — Kies in deze volgorde:

1. Kan het zonder nieuwe vorm, direct op het scherm? → doe dat.
2. Is het een keuze uit een korte lijst, zonder invoer? → **bottom sheet**.
3. Is het een bevestiging van iets onomkeerbaars? → **dialog**.
4. Is het een taak met invoer of meerdere stappen? → **nieuw scherm** of **wizard**.
5. Anders → nieuw scherm.

### 5.2 Per vorm

**Bottom sheet** *(MUX-29)*
Wanneer: kiezen uit maximaal acht opties, filteren, een detail bekijken zonder de context te verliezen.
Niet: bij invoervelden, bij een taak die je wilt kunnen hervatten, bij iets wat je binnen de sheet nog een niveau dieper voert.
Grens: maximaal 60% schermhoogte, maximaal één niveau diep, sluiten mag altijd zonder verlies.
Sparki-voorbeeld: renner toewijzen aan een selectie; een filter op het activiteitenoverzicht.

**Nieuw scherm** *(MUX-30)*
Wanneer: elke taak met invoer, elke taak die hervat moet kunnen worden, alles met een eigen terugpad.
Niet: voor een enkele bevestiging.
Sparki-voorbeeld: wedstrijdbezetting invullen; materiaal registreren; profiel aanvullen.

**Dialog** *(MUX-31)*
Wanneer: alleen bij onomkeerbare handelingen en blokkerende meldingen.
Niet: voor informatie, tips, promoties of "wist u dat".
Grens: maximaal twee knoppen, maximaal twee regels tekst, de gevaarlijke knop is nooit de standaardknop.
Sparki-voorbeeld: renner definitief uit een selectie verwijderen; abonnement opzeggen.

**Popup** *(MUX-32)*
Verboden, behalve als dialog volgens MUX-31. Een popup die de gebruiker niet zelf heeft uitgelokt, wordt niet gebouwd.

**Wizard** *(MUX-33)*
Wanneer: een taak van 2 tot 5 stappen met invoer, waarbij de volgorde vaststaat.
Eisen: voortgang zichtbaar ("stap 2 van 4"), opslaan per stap, terug zonder verlies, samenvatting vóór bevestigen.
Sparki-voorbeeld: organisatie aanmaken; uitnodiging accepteren en profiel aanvullen.

**Tabs** *(MUX-34)*
Wanneer: twee tot vier gelijkwaardige weergaven van hetzelfde onderwerp.
Niet: voor stappen in een proces, en niet voor meer dan vier tabs.
Sparki-voorbeeld: route — Overzicht / Hoogte / Bewaard.

**Segment control** *(MUX-35)*
Wanneer: twee of drie elkaar uitsluitende weergaven die de gebruiker snel wisselt.
Niet: als er meer dan drie zijn, of als de keuze iets opslaat in plaats van iets toont.

**Chips** *(MUX-36)*
Wanneer: filters en snelle selecties die zichtbaar mogen blijven.
Niet: als navigatie, en niet als er meer dan zes tegelijk in beeld staan.

**Accordion** *(MUX-37)*
Wanneer: aanvullende uitleg of details die de meeste gebruikers niet nodig hebben.
Niet: voor de kerninhoud van een scherm. Wat opengeklapt moet worden om het scherm te begrijpen, hoort open te staan.

**FAB (zwevende knop)** *(MUX-38)*
Wanneer: precies één, en alleen als er op dat scherm één duidelijk dominante actie is.
Niet: bij twee of meer gelijkwaardige acties, en niet op schermen waar de primaire actie al vast onderaan staat (MUX-22). Een FAB en een vaste primaire knop sluiten elkaar uit.

**Action sheet** *(MUX-39)*
Wanneer: het overloopmenu van MUX-13.
Grens: maximaal zes items, destructieve items visueel gescheiden en onderaan.

---

## 6. Formulieren

**MUX-40 — Bevestiging vóór onomkeerbaar.** Elke onomkeerbare handeling krijgt een bevestiging die benoemt wat er precies verdwijnt of verandert. "Weet je het zeker?" zonder onderwerp voldoet niet.

**MUX-41 — Automatisch opslaan.** Elke stap wordt opgeslagen bij het verlaten van de stap, niet pas bij afronden.

**MUX-42 — Hervatten.** Bij terugkomst opent de taak op de laatst afgeronde stap, met een zichtbare regel die vertelt waar de gebruiker was gebleven. Nooit stilzwijgend opnieuw beginnen.

**MUX-43 — Samenvatting.** Vóór definitieve bevestiging toont het scherm wat er wordt vastgelegd, wie het te zien krijgt, en wat de gevolgen zijn.

**MUX-44 — Vooringevuld.** Alles wat het systeem al weet, staat ingevuld. Een leeg veld dat het systeem zelf had kunnen invullen is een fout, geen keuze.

**MUX-45 — Validatie.** Fouten worden getoond bij het veld, in gewone taal, met wat de gebruiker moet doen. Nooit uitsluitend bovenaan, nooit uitsluitend na verzenden, nooit als technische foutcode.

**MUX-46 — Toetsenbord.** Het juiste toetsenbordtype per veld (getal, e-mail, telefoon), en het toetsenbord bedekt nooit het actieve veld of de primaire knop.

**MUX-47 — Verplicht versus optioneel.** Optionele velden worden op mobiel niet getoond in de hoofdstroom; ze staan achter "meer invullen". Op mobiel wordt alleen gevraagd wat nodig is om verder te kunnen.

---

## 7. Lege en fouttoestanden

**MUX-48 — De vier verplichte elementen.** Iedere lege of fouttoestand bevat, zonder uitzondering:

1. **Uitleg** — wat je hier normaal ziet
2. **Oorzaak** — waarom het er nu niet is
3. **Verantwoordelijke** — wie dit kan oplossen (jijzelf, je trainer, je clubbeheerder, Sparki)
4. **Eerstvolgende actie** — één knop of één zin die zegt wat je nu doet

Een lege toestand met alleen een illustratie en "Nog niets hier" voldoet niet en wordt door Mirror afgekeurd.

**MUX-49 — De acht toestanden.** Elk scherm dekt deze acht, of legt vast welke niet van toepassing zijn:

| Toestand | Kern van de boodschap | Verantwoordelijke is meestal |
|---|---|---|
| Nog niet ingericht | Dit onderdeel moet eerst worden opgezet | de beheerder van de organisatie |
| Niet gekoppeld | Er ontbreekt een koppeling (bijv. Strava, Garmin, trainer) | de gebruiker zelf |
| Geen toestemming | Je mag dit niet zien, en waarom niet | de beheerder of de ouder |
| Geen resultaten | Je filter of zoekopdracht levert niets op | de gebruiker zelf |
| Geen open acties | Er is niets te doen — dit is goed nieuws | niemand |
| Offline | Zie hoofdstuk 8 | de verbinding |
| Synchroniseren | Gegevens worden opgehaald, met verwachte duur | het systeem |
| Fout | Er ging iets mis, met wat de gebruiker nu doet | Sparki |

**MUX-50 — "Geen open acties" is positief.** Deze toestand wordt niet als leegte gepresenteerd. Een trainer die niets hoeft te doen, moet dat als bevestiging ervaren, niet als vermoeden dat er iets stuk is.

**MUX-51 — Nooit verzonnen inhoud.** Een leeg scherm toont nooit voorbeeldgegevens, placeholdernamen of demodata. Dit is een harde regel na eerdere bevindingen met plaatsvervangende namen in beeld. De voorbeeldmodus (hoofdstuk 11) is de enige uitzondering en is permanent als zodanig gemarkeerd.

**MUX-52 — Foutmeldingen bevatten geen techniek.** Geen statuscodes, geen veldnamen uit de database, geen stacktrace. Wel: één zin over wat de gebruiker nu doet, en waar nodig een verwijzing naar support.

---

## 8. Offline en prestaties

**MUX-53 — Definitie van offline in v1.** Offline betekent in Sparki v1 **uitsluitend** dat een reeds gestarte navigatie doorloopt: de actieve route en het benodigde kaartmateriaal blijven beschikbaar tot de rit is beëindigd. Alle overige schermen tonen de offlinetoestand volgens MUX-48.

**MUX-53a — Herstel van de verbinding.** Zodra de verbinding terug is:

1. Sparki probeert **automatisch** opnieuw te synchroniseren. De gebruiker hoeft niets te doen en hoeft niet te vernieuwen.
2. De gebruiker krijgt **zichtbare terugkoppeling** in vier mogelijke uitkomsten: bezig · volledig gelukt · gedeeltelijk gelukt · mislukt.
3. Bij **gedeeltelijk gelukt** staat erbij wát niet is bijgewerkt en wat de gebruiker nu doet — de vier elementen van MUX-48 gelden onverkort.
4. **Geen dubbele synchronisatie.** Een lopende poging wordt niet naast een tweede gestart, een geslaagde poging wordt niet herhaald, en heen-en-weer schakelende verbinding leidt niet tot een reeks pogingen.
5. **Geen verborgen achtergrondacties.** Er gebeurt niets wat de gebruiker niet kan zien of navertellen. Stille herstelpogingen zonder zichtbare uitkomst zijn niet toegestaan.
6. **Reikwijdte.** Synchroniseren betekent hier uitsluitend **opnieuw ophalen**. Handelingen die tijdens de offlineperiode zijn geprobeerd worden niet alsnog verstuurd — die zijn er niet, want die worden volgens MUX-54 niet bewaard. Deze regel is dus geen achterdeur naar een offline wachtrij.

**MUX-54 — Geen schrijfacties offline.** Er is in v1 geen wachtrij voor offline uitgevoerde handelingen. Een actie die niet verstuurd kan worden, wordt niet als geslaagd getoond en niet stil bewaard. De gebruiker krijgt te zien dat het niet is verstuurd en wat hij nu doet.

**MUX-55 — Geen valse zekerheid.** Een vinkje, een "opgeslagen"-melding of een verdwenen formulier suggereren dat de server het heeft ontvangen. Die signalen worden nooit lokaal gegeven zonder serverbevestiging.

**MUX-56 — Skeletons.** Boven 200 ms laadtijd toont het scherm een skeleton in de vorm van de verwachte inhoud, geen ronddraaiende cirkel op een leeg vlak.

**MUX-57 — Wachtgrens.** Boven 5 seconden krijgt de gebruiker uitleg over wat er gebeurt en een uitweg (annuleren, opnieuw, terug). Onbegrensd wachten bestaat niet.

**MUX-58 — Progressief tonen.** Wat al binnen is, wordt getoond. Een scherm wacht niet op de traagste bron voordat het iets laat zien.

**MUX-59 — Synchronisatie is zichtbaar.** De gebruiker kan altijd zien wanneer gegevens voor het laatst zijn bijgewerkt. Op schermen met gedeelde operationele gegevens (wedstrijddag, dagschema, bezetting) is dat verplicht in beeld.

**MUX-94 — Prestatiedoelen.** Prestatie wordt op mobiel beoordeeld aan wat de gebruiker ervaart, niet aan een technische meetwaarde.

- **a. Eerste bruikbare informatie.** Bij het openen van een scherm verschijnt eerst waar de gebruiker iets aan heeft — de kern, niet de omlijsting. Een scherm dat wacht tot alles compleet is, faalt ook als het technisch snel is.
- **b. Laden is gericht.** Wat laadt, is herkenbaar als datgene wat komt (MUX-56), niet als een algemene wachtanimatie op een leeg vlak.
- **c. Interactie reageert onmiddellijk.** Elke tik geeft direct een zichtbare reactie, ook als het resultaat later komt. Een knop die "niets lijkt te doen" terwijl er wel iets gebeurt, is een fout.
- **d. Vertraging wordt benoemd.** Duurt iets langer dan de gebruiker redelijkerwijs verwacht, dan zegt het scherm wat er gebeurt en biedt een uitweg (MUX-57).
- **e. Nooit een zwart gat.** Er bestaat geen moment waarop de gebruiker niet weet of het systeem bezig is, klaar is of vastloopt (MUX-10).
- **f. Het drukste geval telt.** Prestatie wordt beoordeeld op het zwaarste realistische scherm — volle wedstrijddag, volledige groep, lang seizoen — niet op een leeg testaccount.
- **g. Verhouding tot MUX-56 en MUX-57.** Die twee blijven de toetsbare ondergrens (skeleton bij merkbare wachttijd, uitweg bij lange wachttijd). MUX-94 beschrijft het ervaringsdoel daarboven. Bij tegenstrijdigheid wint het ervaringsdoel: technisch binnen de norm maar in de praktijk onbruikbaar is een afkeurgrond.

**MUX-98 — Eerste bruikbare interactie.** Bij het openen van een mobiel scherm kan de gebruiker zo snel mogelijk iets zinvols *doen*, ook terwijl de rest nog laadt.

*Verhouding tot MUX-94a:* dat gaat over wat de gebruiker als eerste **ziet**. MUX-98 gaat over wat hij als eerste kan **bedienen**. Een scherm dat direct informatie toont maar pas na tien seconden reageert, voldoet aan MUX-94a en zakt op MUX-98.

- **a.** De kernactie of kernbediening verschijnt vóór secundaire inhoud.
- **b.** Zware onderdelen laden uitgesteld.
- **c.** Kaart, profiel, grafieken en achtergrondbeelden blokkeren de eerste interactie nooit.
- **d.** Zoekveld, filter, primaire knop of kernkaart is als eerste bruikbaar — niet alleen zichtbaar, maar bedienbaar.
- **e.** Progressief laden volgens MUX-58: wat binnen is, wordt getoond.
- **f.** Skeletons reserveren de definitieve ruimte (MUX-56, MUX-93d), zodat de kernbediening niet verspringt zodra de rest arriveert.
- **g.** Eén trage databron blokkeert nooit het hele scherm. Het trage deel toont zijn eigen laadtoestand; de rest werkt.
- **h.** Mirror toetst dit op een **realistisch gevuld account** én op een **trage verbinding**, niet op een leeg testaccount met wifi.
- **i.** Geen nieuwe milliseconde-eis. MUX-94 blijft het algemene prestatiedoel; MUX-98 bepaalt de volgorde waarin dat doel wordt bereikt.

*Voorbeeld — de pagina Klimmen.* Zoekveld en resultatenlijst zijn als eerste bruikbaar. De kaart laadt pas na selectie van een klim. Het hoogteprofiel laadt pas na selectie. Een zware achtergrondafbeelding mag de zoekactie niet vertragen en laadt als laatste of niet.

---

## 9. Navigatie

**MUX-60 — Bottom navigation is de enige hoofdnavigatie.** Geen hamburgermenu als hoofdstructuur op mobiel.

**MUX-61 — Terug is voorspelbaar.** Terug gaat altijd één stap terug in de taak, nooit naar een startscherm en nooit uit een half afgeronde taak zonder de hervatregel van MUX-42.

**MUX-62 — Wisselen van rol of organisatie.** Wie meerdere rollen of organisaties heeft, ziet permanent in beeld in welke context hij werkt, en wisselt via één vaste plek. De context wisselt nooit vanzelf.

**MUX-63 — Deeplink opent volledig.** Een link uit een notificatie of e-mail opent het bedoelde scherm met een werkende terugweg naar de hoofdnavigatie, ook als de gebruiker nog moet inloggen.

**MUX-64 — Onderbreking overleeft.** Binnenkomend telefoontje, app wisselen, scherm uit: bij terugkeer staat de gebruiker waar hij was. Dit is de mobiele vertaling van MUX-11 en is een Mirror-testpunt, geen wens.

**MUX-65 — Notificaties.** Iedere notificatie leidt naar een scherm waar de bijbehorende actie ook echt kan worden uitgevoerd. Een melding die naar een overzicht leidt waar je nog moet zoeken, voldoet niet.

**MUX-88 — Geen doodlopende schermen.** Iedere mobiele flow eindigt met **een logische vervolgstap** óf **een duidelijke terugweg**. Nooit met geen van beide.

De gebruiker mag nooit:

- vastlopen op een scherm zonder uitgang;
- moeten gokken wat de volgende stap is;
- moeten zoeken waar hij verder kan;
- op een leeg eindscherm terechtkomen.

Concreet betekent dit:

- **a.** Elk eindscherm van een taak toont wat er nu gebeurt of gebeurd is, én ten minste één weg verder — de logische volgende taak, of terug naar de plek waar de gebruiker vandaan kwam.
- **b.** Een afgeronde taak ("Uitnodiging verstuurd", "Bezetting bevestigd") is een eindscherm en valt hier volledig onder. Een bevestiging zonder vervolg is een doodlopend scherm.
- **c.** Een geblokkeerd scherm (geen toestemming, niet ingericht, offline) is nooit een doodlopend scherm: het valt onder MUX-48 en noemt dus altijd de verantwoordelijke en de eerstvolgende actie.
- **d.** "Terug" via de systeemknop of het gebaar van het toestel telt niet als duidelijke terugweg. De terugweg moet in het scherm zelf zichtbaar zijn.
- **e.** Mirror toetst dit expliciet per flow, niet per scherm: het gaat om waar de gebruiker uitkomt, niet om of elk los scherm een knop heeft.

*Nummering:* MUX-codes zijn vaste identificatiecodes, geen volgorde. MUX-88 staat hier inhoudelijk op zijn plek; het nummer volgt de reeks (MUX-95c).

**MUX-93 — Geen verrassingen.** Tijdens gebruik verandert een scherm niet onaangekondigd. De gebruiker moet kunnen vertrouwen op wat hij ziet terwijl hij ernaar kijkt.

Niet toegestaan:

- kaarten die verdwijnen terwijl de gebruiker ernaar kijkt;
- knoppen die van plaats wisselen zodra de rest van het scherm binnenkomt;
- menu's waarvan de inhoud wisselt zonder aanleiding;
- acties die verdwijnen zonder uitleg;
- een rolwissel of contextwissel die vanzelf gebeurt.

Wel toegestaan, mits aangekondigd of logisch verklaard:

- **a.** Nieuwe informatie komt binnen via een zichtbare aanduiding ("nieuwe melding — tikken om bij te werken"), niet door de inhoud onder de duim te laten verschuiven.
- **b.** Wat de gebruiker zelf verandert (filter zetten, taak afvinken) mag onmiddellijk veranderen — dat is geen verrassing maar een reactie.
- **c.** Verdwijnt iets omdat een recht, toewijzing of toestemming is ingetrokken, dan zegt het scherm dat volgens MUX-48. Stil weghalen is niet toegestaan.
- **d.** Tijdens laden wordt de definitieve ruimte gereserveerd (MUX-56); niets springt als de inhoud arriveert.
- **e.** Een wijziging die van buiten komt en de huidige taak raakt (de wedstrijd waar je bezetting voor invult wordt afgelast) onderbreekt de gebruiker wél — maar met uitleg en een keuze, nooit door het scherm onder hem te vervangen.

**MUX-99 — Geen losse functie zonder logisch vervolg.** Iedere functie is onderdeel van een herkenbare hoofdtaak en heeft een duidelijke vervolgstap. Een functie wordt niet als zelfstandig hoofdonderdeel gebouwd wanneer de gebruiker na gebruik niet weet wat hij ermee moet.

Niet voldoende als zelfstandig onderdeel:

- alleen een klim zoeken en bekijken;
- alleen een materiaalwaarde tonen;
- alleen een analyse tonen zonder vervolg;
- alleen een AI-advies tonen zonder actie.

Wel, met de hoofdtaak erbij benoemd:

| Hoofdtaak | Vervolgstap |
|---|---|
| Route maken | klim toevoegen aan de route |
| Wedstrijd voorbereiden | klimprofiel bekijken |
| Materiaalstatus | controle of reparatie starten |
| Analyse | training of plan aanpassen |
| AI-advies | voorstel bekijken, accepteren, aanpassen of negeren |

Regels:

- **a.** Ieder onderdeel benoemt zijn hoofdtaak. "Waar hoort dit bij?" is beantwoordbaar vanaf het scherm zelf.
- **b.** Ieder detailscherm heeft een logisch vervolg. Geen doodlopend informatiescherm (MUX-88).
- **c.** Een verkennings- of inspiratiepagina mag bestaan, maar linkt door naar een uitvoerbare hoofdtaak. Inspiratie zonder uitgang is een doodlopend scherm met een mooier woord.
- **d.** Sluit aan op MUX-81a: wat een scherm belooft, moet ook ergens toe leiden.
- **e.** Mirror toetst de **volledige keten** — functie → hoofdtaak → vervolgstap — niet het losse scherm.

---

## 10. Toegankelijkheid

**MUX-66 — Contrast.** Minimaal 4,5:1 voor tekst, 3:1 voor betekenisdragende grafische elementen.

**MUX-67 — Kleur nooit alleen.** Status wordt nooit uitsluitend met kleur aangeduid. Altijd ook een woord, een vorm of een icoon. Geldt met name voor rode vlaggen, beschikbaarheid en goedkeuringsstatus.

**MUX-68 — Tekstgrootte.** Het scherm blijft bruikbaar bij 200% systeemtekstgrootte: geen afgesneden tekst, geen onbereikbare knoppen.

**MUX-69 — Schermlezer.** Iedere knop, elk icoon en elke statusaanduiding heeft een leesbare naam. Een icoon zonder tekstalternatief bestaat niet.

**MUX-70 — Handschoenen en beweging.** Onderweg-schermen (MUX-25) gaan uit van dikke vingers, handschoenen en trillingen. Grote vlakken, veel marge, geen precisie.

**MUX-71 — Geluid en trilling zijn aanvullend.** Nooit de enige drager van informatie; altijd ook zichtbaar.

---

## 11. Uitleglaag en voorbeeldmodus

**MUX-72 — Uitlegicoon.** Waar op desktop uitleg bij mouse-over verschijnt, gebruikt mobiel een vraagtekenicoon naast de kop van het onderdeel. Openen gebeurt in een bottom sheet volgens MUX-29.

**MUX-73 — Uitleg vervangt geen duidelijkheid.** Een scherm dat zonder uitleg onbegrijpelijk is, wordt herzien. Het uitlegicoon is een verdieping, geen reparatie.

**MUX-74 — Voorbeeldmodus permanent gemarkeerd.** In de voorbeeldmodus staat de markering permanent in beeld, ook op de kleinste schermbreedte, en ook tijdens navigatie. Voorbeeldgegevens zijn nooit mengbaar met een echte organisatie.

---

## 12. AI-gedrag

AI is in Sparki geen aparte wereld met eigen omgangsvormen. Alles wat de AI op een telefoon doet, valt onder dezelfde standaard als de rest van de app.

**MUX-89 — AI ondersteunt, bestuurt niet.** De AI geeft advies. De AI neemt nooit zelfstandig een gebruikersactie over zonder expliciete toestemming.

- **a.** Advies is altijd herkenbaar als advies, niet als een voldongen feit.
- **b.** De AI plant, wijzigt, verstuurt, annuleert of bevestigt niets namens de gebruiker zonder dat de gebruiker die handeling zelf bevestigt.
- **c.** Een voorstel dat de gebruiker niet beantwoordt, wordt niet na verloop van tijd alsnog uitgevoerd. Geen stilzwijgende instemming.
- **d.** De gebruiker kan een advies negeren zonder dat het terugkomt als herhaalde vraag.
- **e.** Uitzondering die géén uitzondering is: waar bestaande besluiten de coach een grens laten bewaken (acute signalen), is dat geen zelfstandige actie maar het niet-plannen van iets. De AI toont de reden en verbiedt niets.

**MUX-90 — AI onderbreekt nooit.** Tijdens navigatie, training, wedstrijd, onboarding en het invullen van een formulier verschijnen geen AI-meldingen die de gebruiker onderbreken.

- **a.** De AI wacht op een logisch rustmoment: na afloop van de rit, na afronding van de stap, bij terugkeer op een overzichtsscherm.
- **b.** Uitgestelde adviezen gaan niet verloren; ze staan klaar op het rustmoment en tonen waar ze bij horen.
- **c.** Wat écht niet kan wachten, is per definitie geen AI-advies maar een veiligheidsmelding, en volgt de regels voor meldingen — niet die van de AI.
- **d.** De AI opent nooit uit zichzelf een bottom sheet, dialog of nieuw scherm (MUX-31, MUX-32).

**MUX-91 — AI legt uit.** Bij ieder advies staat kort:

1. **waarom** dit advies wordt gegeven;
2. **welke gegevens** ervoor zijn gebruikt;
3. **welke onzekerheid** eraan zit.

- **a.** Geen black-boxadviezen. Een advies zonder deze drie is niet toonbaar.
- **b.** De uitleg past binnen het mobiele tekstbudget (MUX-15). Wat langer is, gaat achter het uitlegicoon (MUX-72).
- **c.** Ontbreken gegevens, dan zegt de AI dat expliciet in plaats van het advies zelfverzekerder te maken dan het is.
- **d.** De AI presenteert geen zekerheid die de onderliggende gegevens niet dragen — ook niet in de korte samenvattingsregel.

**MUX-92 — AI volgt dezelfde UX-regels.** De AI creëert geen uitzonderingen. Ook AI-schermen en AI-onderdelen voldoen aan ten minste:

| Regel | Betekenis voor de AI |
|---|---|
| MUX-12 | één primaire actie in een AI-voorstel, niet drie gelijkwaardige knoppen |
| MUX-28 | een AI-voorstel kiest zijn vorm volgens dezelfde beslisregel als elk ander onderdeel |
| MUX-48 | "de AI kan hier nu niets over zeggen" is een lege toestand met vier elementen, geen leeg vlak |
| MUX-53 | offline geeft de AI geen advies uit een oude cache alsof het actueel is |
| MUX-81a | een AI-knop levert wat zijn naam belooft — "Plan aanpassen" past het plan werkelijk aan |
| MUX-88 | een AI-gesprek of AI-advies eindigt met een vervolgstap of een zichtbare terugweg |
| MUX-93 | de AI verandert geen scherm onder de gebruiker vandaan |

---

## 13. Wedstrijddagmodus

**MUX-96 — Wedstrijddagmodus.** Een aparte schermmodus voor situaties waarin het toestel buiten, in beweging en onder tijdsdruk wordt gebruikt: **wedstrijddag, trainingskamp, etappekoers en begeleiding onderweg**.

- **a. Aanzetten.** De modus wordt aangeboden, nooit stil opgelegd (MUX-93). Aanleiding is een controleerbaar feit: een lopend evenement waaraan de gebruiker is toegewezen, of een gestarte navigatie of training. De gebruiker kan hem altijd zelf aan- en uitzetten.
- **b. Knopmaat.** Minimaal 64 × 64 dp (MUX-25), maximaal drie tikvlakken in beeld, geen enkele handeling die precisie vereist.
- **c. Handschoenen.** Geen swipe als enige weg, geen dubbeltik, geen slepen, geen lang indrukken als enige manier om iets te bereiken.
- **d. Zonlicht.** Maximale contrastvariant, zware letterdikte, geen dunne lijnen, geen lichtgrijs op wit. Status nooit alleen met kleur (MUX-67).
- **e. Tekst.** Eén regel per element. Wat niet in één regel past, hoort niet in deze modus.
- **f. Bevestigen in één handeling.** Taken worden met één tik afgevinkt of bevestigd, met zichtbare bevestiging en een korte ongedaan-mogelijkheid achteraf, in plaats van een dialog vooraf.
- **g. Geen invoer.** In deze modus wordt niet getypt. Alles is kiezen, afvinken of bevestigen (MUX-09). Wat typen vereist, wordt bewaard als taak voor na afloop.
- **h. Noodhandeling.** Eén permanent bereikbare handeling voor een acute situatie (val, medisch, stilstand door materiaalpech), die de juiste persoon in de organisatie bereikt en zichtbaar bevestigt dát de melding is verstuurd. Staat buiten de vaste duimpositie (MUX-23) en vraagt één korte bevestiging, zodat hij niet per ongeluk afgaat.
  **Grens:** zonder verbinding kan deze melding niet worden verstuurd (MUX-54). De modus zegt dat dan expliciet en noemt het alternatief. Een noodhandeling die stil faalt is de ernstigste vorm van MUX-55 en een directe afkeurgrond.
- **i. Offline.** Uitsluitend volgens MUX-53: een gestarte navigatie loopt door, al het overige toont de offlinetoestand. Bij herstel geldt MUX-53a.
- **j. Meldingen.** Alleen wat de huidige situatie raakt. Al het overige wordt uitgesteld tot de modus eindigt. AI-adviezen zwijgen volledig (MUX-90).
- **k. Bediening in beweging.** Een handeling die stilstand vereist, wordt niet gepresenteerd alsof hij onderweg kan. Wat stilstand vereist, zegt dat.
- **l. Einde.** Bij afloop keert de gebruiker terug naar het normale startscherm van zijn rol, met een korte samenvatting van wat er is gebeurd en wat nog openstaat (MUX-88).

---

## 14. Rollen

**MUX-75 — Harde bouwregel.** Er wordt geen rolgestuurd scherm gebouwd voordat de bijbehorende rolwaarde server-side bestaat en in `clubRoles` is opgenomen. Een rol die alleen in een ontwerp bestaat, krijgt geen scherm, geen navigatie-item en geen notificatie. Deze regel bestaat om herhaling te voorkomen van eerdere situaties waarin een structuur werd getekend voordat hij bestond.

**MUX-76 — Rollenstatus.** Onderstaande tabel is de stand op commit `93ba41e`, 1 augustus 2026. De rolflows in `SPARKI_ROLE_BASED_MOBILE_FLOWS.md` worden voor alle rollen uitgewerkt; de statuskolom bepaalt wat gebouwd mag worden.

| Rol in de opdracht | Rolwaarde | Status | Eerste mobiele prioriteit | Opmerking |
|---|---|---|---|---|
| Sporter | bestaat | bouwbaar | **Vandaag** | |
| Trainer | bestaat | bouwbaar | **Trainingen** | één trainerrol in verschillende contexten |
| Hoofdtrainer | bestaat | bouwbaar | **Groepen** | |
| Clubbeheerder | bestaat | bouwbaar | **Organisatie** | standaardrol van de eigenaar bij `CLUB` |
| Teammanager | bestaat | bouwbaar | **Teams** | standaardrol van de eigenaar bij `TEAM` |
| Ploegleider | `ploegleider` | bouwbaar | **Wedstrijddag** | rolwaarde bestaat server-side sinds commit `30ad85f` |
| Mechanieker | bestaat | bouwbaar | **Materiaal** | |
| Soigneur | `soigneur` | bouwbaar | **Voeding** | toegevoegd sinds 31-07 |
| Medical Staff | `medical_staff` | bouwbaar | **Gezondheid** | `medic` is ingetrokken; functietype is beschrijvend en verleent geen rechten |
| Ouder | bestaat | bouwbaar, alleen-lezen-eerst (MUX-04) | **Kind** | |
| Gast | bestaat | bouwbaar | **Introductie** | |
| Admin | bestaat | bouwbaar | **Systeemstatus** | |

**MUX-76a — Uitwerking van de eerste mobiele prioriteit.** Per rol: waar de gebruiker landt, wat hij daar als eerste moet weten, en welke actie daar als primaire actie (MUX-12) staat. De rolflows werken dit verder uit; deze drie regels per rol zijn bindend.

**Sporter → Vandaag**
Informatie: wat er vandaag op het programma staat, en of dat is afgestemd op hoe hij ervoor staat. Eén dag, niet de week.
Eerste actie: training starten, of een uitgevoerde rit afronden en terugkoppelen.

**Trainer → Trainingen**
Informatie: welke sporters vandaag iets van hem nodig hebben — niet de volledige groepshistorie.
Eerste actie: een training goedkeuren, aanpassen of terugkoppeling geven aan één sporter.

**Hoofdtrainer → Groepen**
Informatie: bezetting en signalen per groep; welke groep zonder trainer of zonder plan zit.
Eerste actie: een trainer aan een groep koppelen, of een signaal doorzetten naar de juiste trainer.

**Clubbeheerder → Organisatie**
Informatie: wat nog niet is ingericht en wat op hem wacht — openstaande uitnodigingen, toestemmingen, roltoekenningen.
Eerste actie: één openstaand verzoek afhandelen.

**Teammanager → Teams**
Informatie: samenstelling en beschikbaarheid voor het komende blok.
Eerste actie: een renner of staflid toevoegen, bevestigen of vervangen.

**Ploegleider → Wedstrijddag**
Informatie: het eerstvolgende evenement met bezetting, tijden en rode vlaggen.
Eerste actie: bezetting bevestigen of een vervanging regelen.
*Pakketgrens: `CLUB_RECHTEN_01` beheert rollen, rechten, scopes en autorisatie; `PLOEGLEIDER_01` bouwt uitsluitend de operationele wedstrijdlaag en geen tweede rechtenarchitectuur.*

**Mechanieker → Materiaal**
Informatie: welk materiaal aandacht nodig heeft vóór het eerstvolgende evenement.
Eerste actie: een materiaaltaak afvinken of een probleem melden.

**Soigneur → Voeding**
Informatie: verzorgings- en voedingstaken voor het eerstvolgende dagdeel, per renner.
Eerste actie: een taak afvinken of een bijzonderheid melden.
*Bij minderjarigen worden geen gewichts- of calorieadviezen getoond — die grens geldt onverkort ook in deze rolweergave.*

**Medical Staff → Gezondheid**
Informatie: acute meldingen eerst, daarna beschikbaarheidsstatus.
Eerste actie: een melding beoordelen en afhandelen.
*Gezondheidsgegevens verschijnen niet in algemene team- of groepsoverzichten van andere rollen.*

**Ouder → Kind**
Informatie: wat er voor het kind gepland staat en welke toestemming van de ouder wordt gevraagd.
Eerste actie: toestemming geven of afwezigheid melden.
*Mobiel alleen-lezen-eerst (MUX-04); toestemming bevestigen en afwezigheid melden zijn de toegestane uitzonderingen. Inrichten en koppelen gebeurt op een groter scherm.*

**Gast → Introductie**
Informatie: wat Sparki is, wat zonder account kan, en wat er achter aanmelden zit.
Eerste actie: een route plannen, of een account aanmaken.

**Admin → Systeemstatus**
Informatie: storingen, mislukte synchronisaties en openstaande supportzaken.
Eerste actie: een incident openen of toewijzen.

**Eigenaar (relatie, geen rol)**
Geen eigen eerste scherm. De eigenaar landt op het startscherm van zijn beheerrol — Clubbeheerder bij `CLUB`, Teammanager bij `TEAM` — met de eigenaarskaart bovenaan (MUX-77).

**MUX-97 — Rolcontexten.** Een rol is niet één gebruikssituatie. Dezelfde trainer heeft thuis op de bank iets anders nodig dan langs de kant van de weg. Deze regel legt de structuur vast; de detailflows komen in `SPARKI_ROLE_BASED_MOBILE_FLOWS.md`.

| Rol | Contexten |
|---|---|
| Sporter | dagelijks · trainen · koers · herstel |
| Trainer | thuis · training · wedstrijd · onderweg |
| Ploegleider | voorbereiding · wedstrijddag · koers · evaluatie |
| Mechanieker | werkplaats · vertrek · wedstrijd · terugkomst |
| Soigneur | voorbereiding · verzorging · voeding · herstel |
| Medical Staff | monitoring · blessure · herstel · wedstrijd |

Regels:

- **a.** Een context verandert de **volgorde en prominentie** van informatie binnen het rolstartscherm. Hij verandert nooit de hoofdnavigatie (MUX-14) en nooit de rechten van de rol.
- **b.** Een context is **geen rol**: geen extra rolwaarde, geen extra rechten, geen scherm dat buiten MUX-75 valt.
- **c.** Automatisch wisselen mag alleen op grond van een feit dat de gebruiker zelf kan controleren — een evenement waaraan hij is toegewezen, een gestarte training, een bevestigd vertrek. Nooit op grond van een schatting of een voorspelling.
- **d.** De actieve context is zichtbaar en de wissel is verklaarbaar (MUX-93). De gebruiker kan altijd handmatig terug naar de standaardcontext.
- **e.** De eerste mobiele prioriteit uit MUX-76a is de **standaardcontext** van de rol. Elke andere context is een afwijking daarvan en beschrijft wat er naar boven komt, niet een nieuw scherm.
- **f.** De contexten *koers*, *wedstrijd*, *wedstrijddag* en *vertrek* activeren het aanbod van de wedstrijddagmodus (MUX-96a).
- **g.** Rollen die hier niet staan (hoofdtrainer, clubbeheerder, teammanager, ouder, gast, admin) hebben in v1 één context: de standaard. Uitbreiding gebeurt door aanvulling van deze tabel, niet door een nieuwe regel.

**MUX-77 — Eigenaarschap is geen rol.** De opdracht noemt twaalf rollen maar geen eigenaar. Eigenaarschap is een relatie met de organisatie: `owner` + `CLUB` → "Clubeigenaar", `owner` + `TEAM` → "Teameigenaar". De eigenaar heeft daarnaast altijd een operationele rol. Mobiel betekent dit: het eigenaarsscherm is een **extra kaart** op het startscherm van de beheerrol (eigendom, facturatie, overdracht), geen apart tabblad en geen aparte navigatiestructuur.

**MUX-78 — Eén startscherm per rol, niet per pakket.** Een gebruiker met twee rollen ziet één startscherm met een zichtbare contextwisselaar (MUX-62), niet twee losse ingangen.

**MUX-79 — Notificaties zijn rolgebonden.** Een gebruiker ontvangt uitsluitend meldingen die horen bij de rol waarin hij op dat moment werkt, plus meldingen die zijn eigen account raken.

**MUX-100 — Iedere rol begrijpt direct waarom hij hier is.** Bij eerste login, en bij een rolomgeving die nog leeg is, ziet de gebruiker geen kale lege toestand maar een **rolintroductie met handelingsperspectief**.

Verplicht zichtbaar:

1. welke **rol** actief is;
2. voor welke **organisatie, groep, team of sporter**;
3. wat de gebruiker **met deze rol kan**;
4. wat er nog **ontbreekt**;
5. **één concrete eerste actie**.

Voorbeelden van de toon (met echte namen uit de eigen omgeving, nooit verzonnen):

- *Trainer* — "Je bent trainer van [groep]. Je kunt vandaag een training plannen, sporters bekijken of terugkoppeling geven."
- *Ploegleider* — "Je bent gekoppeld aan [team]. Voeg een wedstrijd toe of vul de eerstvolgende bezetting aan."
- *Mechanieker* — "Je bent mechanieker van [team]. Start de materiaalcontrole voor het eerstvolgende evenement."
- *Soigneur* — "Je bent verzorger van [team]. Bekijk de eerstvolgende verzorgings- en voedingstaken."
- *Medical Staff* — "Je bent gekoppeld als medische begeleiding. Vraag toestemming aan, of open een dossier waarvoor je al toestemming hebt."

Regels:

- **a.** Geen generiek welkom. "Welkom bij Sparki" zonder rol en zonder organisatie voldoet niet.
- **b.** Geen fictieve personen, geen voorbeelddata in een echte omgeving (MUX-51). Ontbreekt een naam, dan wordt dat gezegd — niet ingevuld.
- **c.** De actieve context is altijd zichtbaar (MUX-62).
- **d.** Ontbreekt de toewijzing, dan staat er precies **wie** dit moet oplossen — de clubbeheerder, de teammanager, de ouder of Sparki (MUX-48).
- **e.** Zijn er geen open acties, dan wordt dat positief weergegeven (MUX-50), niet als leegte.
- **f.** De eerste actie is de standaardcontext uit MUX-76a, tenzij die door het ontbrekende punt uit 4 geblokkeerd wordt; dan is de eerste actie het oplossen daarvan.
- **g.** De introductie eindigt in een vervolgstap of een zichtbare terugweg (MUX-88).
- **h. Wanneer verdwijnt de introductie.** Toetsbaar gemaakt: pas wanneer de rol **een echte toewijzing heeft** (organisatie, groep, team of sporter gekoppeld) **én er ten minste één echte eerstvolgende taak of echt gegeven in de rolomgeving staat**. Zolang één van beide ontbreekt, blijft de introductie. Daarna blijft hij oproepbaar via het uitlegicoon (MUX-72) en verschijnt hij opnieuw als de rolomgeving weer leeg raakt.

---

## 15. Mirror-toets

**MUX-80 — Mobiel wordt echt getoetst, niet responsief bekeken.** Een scherm dat op een smalle browserbreedte "goed oogt" is niet getoetst. Mirror toetst de gebruikerservaring per rol, op een vaste gepushte SHA.

**MUX-81 — Verplichte toetsdimensies.** Iedere mobiele Mirror-toets dekt minimaal:

1. Twee schermgroottes: de kleinste ondersteunde breedte (360 dp) en een grote telefoon
2. De rol waarvoor het pakket gebouwd is, met een echt account in die rol
3. Klikbare productbelofte: is de belofte van het pakket op de telefoon uit te voeren, niet alleen zichtbaar
4. Hervatten na onderbreking (MUX-64)
5. Alle van toepassing zijnde lege toestanden uit MUX-49, getoetst op de vier verplichte elementen
6. Offlinegedrag volgens MUX-53 en MUX-54
7. Notificatie → deeplink → actie daadwerkelijk uitvoerbaar (MUX-63, MUX-65)
8. Tikvlakken en contrast (MUX-24, MUX-66)
9. **Beloftetoets** (zie MUX-81a)
10. Geen doodlopende schermen (MUX-88), getoetst per flow
11. Automatische hersynchronisatie na verbindingsherstel, met zichtbare uitkomst (MUX-53a)
12. Geen verrassingen: niets verschuift, verdwijnt of wisselt onaangekondigd (MUX-93)
13. AI-gedrag: ondersteunt, onderbreekt niet, legt uit, volgt dezelfde regels (MUX-89 t/m MUX-92)
14. Wedstrijddagmodus, indien van toepassing op het pakket (MUX-96), inclusief het gedrag van de noodhandeling zonder verbinding (MUX-96h)
15. Prestatiedoelen op het zwaarste realistische scherm, niet op een leeg testaccount (MUX-94)
16. Eerste bruikbare interactie, getoetst op een gevuld account én een trage verbinding (MUX-98)
17. De volledige keten functie → hoofdtaak → vervolgstap, niet het losse scherm (MUX-99)
18. Rolintroductie bij eerste login en bij een lege rolomgeving (MUX-100)

**MUX-81a — Beloftetoets.** Mirror toetst niet of de knop werkt, maar of de knop **levert wat zijn naam belooft**. De vraag is niet "gebeurt er iets?" maar "krijgt de gebruiker wat hij redelijkerwijs mocht verwachten?"

- Een knop "Wedstrijd plannen" moet ertoe leiden dat er werkelijk een wedstrijd gepland kán worden — niet dat er een scherm opent waar het halverwege ophoudt.
- Een knop "Route bewaren" moet de route werkelijk opslaan, vindbaar terug.
- Een knop "Trainer uitnodigen" moet ertoe leiden dat de trainer de uitnodiging werkelijk ontvangt.

Geen scherm mag een functie suggereren die niet volledig uitvoerbaar is. Een half werkende functie wordt niet als knop getoond: hij is er wel, of hij is er niet en het scherm zegt volgens MUX-06 waarom.

**MUX-82 — Afkeurgronden.** Een pakket wordt afgekeurd bij: een lege toestand zonder de vier elementen, voorbeeld- of placeholdergegevens in beeld, een technische foutmelding, een verloren taak na onderbreking, een actie die offline als geslaagd wordt getoond, een rolscherm voor een rol die server-side niet bestaat, een flow die doodloopt (MUX-88), of een knop die niet levert wat zijn naam belooft (MUX-81a). Aanvullend afkeurend: een AI die zonder toestemming een handeling uitvoert (MUX-89), een AI-melding tijdens navigatie, training, wedstrijd, onboarding of een formulier (MUX-90), een advies zonder onderbouwing (MUX-91), een scherm dat onaangekondigd verandert (MUX-93), en een noodhandeling die zonder verbinding stil faalt (MUX-96h). Sinds v1.3 aanvullend afkeurend: een kernactie die geblokkeerd wordt door secundaire data, een zwaar onderdeel dat laadt vóór de bruikbare interactie (beide MUX-98), een functie die eindigt zonder hoofdtaak of vervolg (MUX-99), een rolomgeving die leeg opent zonder te verklaren waarom de gebruiker daar is, en een gebruiker die na eerste login niet weet wat zijn eerste actie is (beide MUX-100).

**MUX-83 — Statuswoord.** Mobiele toetsing gebruikt dezelfde statuswoorden als de rest van het project: `PROVEN_READY` · `BUILT_UNPROVEN` · `PARTIAL` · `OPEN` · `DEFERRED`. Gebouwd zonder mobiele Mirror-toets is `BUILT_UNPROVEN`.

---

## 16. Werking richting bouwpakketten

**MUX-84 — Verwijzingsregel.** Ieder bouwpakket vanaf 1 augustus 2026 bevat de regel:

> Mobiele UX conform `MOBILE_UX_STANDARD_01`.

**MUX-85 — Verplichte paragraaf.** Ieder pakket dat een scherm oplevert, bevat een korte paragraaf "Mobiele uitwerking" met: het schermtype, de gekozen presentatievorm met de bijbehorende MUX-code, de lege toestanden die van toepassing zijn, en de rol(len) waarvoor het geldt.

**MUX-86 — Pakketten die dit direct raken.** Deze pakketten moeten de verwijzing krijgen vóórdat ze gebouwd worden, omdat ze een rolgestuurd dashboard opleveren:

- `TEAM_ONBOARDING_01`
- `CLUB_ONBOARDING_01` (bindende variant 1)
- `22_PLOEGLEIDER_01` — bouw geblokkeerd door MUX-75 tot de rolwaarde bestaat
- `23_TEAM_MECHANIEKER_01`
- `30_PROFIEL_01`
- `15_CLUB_LEDEN_01` · `16_JEUGD_OUDER_01` · `17_TRAINER_KOPPELING_01` · `18_ZZP_TRAINER_01`
- `34_TOEGANKELIJKHEID_01` — moet naar hoofdstuk 10 verwijzen in plaats van eigen normen te stellen
- `NOTIFICATIES_01` — moet naar MUX-63, MUX-65 en MUX-79 verwijzen

**MUX-87 — Reeds gebouwde pakketten.** Bestaande pakketten worden niet met terugwerkende kracht herbouwd. Ze worden getoetst bij de eerstvolgende wijziging aan een van hun schermen; gevonden afwijkingen komen op de herstellijst, niet in een aparte herbouwronde.

---

## 17. Besluiten ter registratie

Onderstaande besluiten zijn op 1 augustus 2026 door René genomen en horen in het centrale besluitregister.

**Nummering nog niet toekennen.** Conform de afspraak van dezelfde dag krijgen deze besluiten pas een definitief `SPARKI-BESLUIT-2026-nnn`-nummer nadat de reeks is opgeschoond en `-006` t/m `-013` betrouwbaar zijn vastgesteld. Tot die tijd gelden onderstaande letters als tijdelijke aanduiding en wordt er geen nummer aangenomen.

| Tijdelijk | Besluit |
|---|---|
| MUX-B1 | Mobiel is de web/PWA-ervaring op telefoonbreedte. De apparaatdoctrine uit WP-R0..R8 wordt bevestigd: web/PWA-eerst, jeugd- en ouderdomein mobiel alleen-lezen-eerst. Verduidelijking: de routeplanner is en blijft in v1 een mobiele webpagina. |
| MUX-B2 | Offline betekent in v1 uitsluitend dat een gestarte navigatie doorloopt. Geen offline schrijfacties, geen wachtrij, geen lokale bevestiging zonder server. Een uitgebreidere offlinelaag is een afzonderlijk toekomstig pakket. |
| MUX-B3 | Er wordt geen rolgestuurd scherm gebouwd voordat de rolwaarde server-side bestaat. Rollen mogen wel vooruit worden ontworpen. |
| MUX-B4 | `MOBILE_UX_STANDARD_01` is bindend voor alle mobiele schermen. Afwijken alleen met expliciete productgoedkeuring van René, vastgelegd met vermelding van de MUX-code. |

**Openstaand, niet door dit document beslist:** geen. De eerdere twee punten (naamkeuze medische rol en het bestaan van de rolwaarde `ploegleider`) zijn op 1 augustus 2026 beslist en in MUX-76 verwerkt.

**Niet gedaan, op instructie:** het Master Plan is niet aangepast.

---

## Bijlage A — Toetslijst per scherm

Eén pagina, bruikbaar door Replit vóór oplevering en door Mirror bij toetsing.

- [ ] Eén primaire actie, onderaan, vast in beeld (MUX-12, MUX-22)
- [ ] Maximaal drie secundaire acties zichtbaar (MUX-13)
- [ ] Geen tekstblok boven 280 tekens (MUX-15)
- [ ] Maximaal drie invoervelden per stap (MUX-16)
- [ ] Presentatievorm gekozen volgens de beslisregel, MUX-code vermeld (MUX-28)
- [ ] Tikvlakken ≥ 48 dp, onderweg ≥ 64 dp (MUX-24, MUX-25)
- [ ] Alle van toepassing zijnde lege toestanden aanwezig, elk met de vier elementen (MUX-48, MUX-49)
- [ ] Geen voorbeeld- of placeholdergegevens (MUX-51)
- [ ] Geen technische foutmeldingen (MUX-52)
- [ ] Offlinegedrag conform v1-definitie (MUX-53, MUX-54, MUX-55)
- [ ] Taak overleeft onderbreking en hervat met zichtbare regel (MUX-42, MUX-64)
- [ ] Status nooit alleen met kleur (MUX-67)
- [ ] Bruikbaar bij 200% tekstgrootte (MUX-68)
- [ ] Iedere knop en elk icoon heeft een leesbare naam (MUX-69)
- [ ] Rol bestaat server-side (MUX-75)
- [ ] Notificatie leidt naar een scherm waar de actie uitvoerbaar is (MUX-65)
- [ ] Hoofditems: aantal, namen, iconen en volgorde gelijk voor alle rollen (MUX-14)
- [ ] Eerste scherm, kerninformatie en eerste actie conform de rolprioriteit (MUX-76a)
- [ ] Na verbindingsherstel automatisch hersynchroniseren, uitkomst zichtbaar, geen dubbele poging (MUX-53a)
- [ ] Knop levert wat de naam belooft; geen half uitvoerbare functie zichtbaar (MUX-81a)
- [ ] Flow eindigt met vervolgstap óf zichtbare terugweg — geen doodlopend scherm (MUX-88)
- [ ] Niets verschuift, verdwijnt of wisselt onaangekondigd (MUX-93)
- [ ] AI adviseert, voert niets zelfstandig uit, onderbreekt niet, en onderbouwt elk advies (MUX-89 t/m MUX-92)
- [ ] Wedstrijddagmodus voldoet aan knopmaat, één-regel-tekst, geen invoer en zichtbaar noodgedrag (MUX-96)
- [ ] Eerste bruikbare informatie eerst; elke tik reageert direct; getoetst op het zwaarste scherm (MUX-94)
- [ ] Rolcontext verandert alleen volgorde en prominentie, nooit navigatie of rechten (MUX-97)
- [ ] Iedere bevinding verwijst naar een MUX-code, niet naar een omschrijving (MUX-95d)
- [ ] Kernbediening is als eerste bruikbaar; geen zwaar onderdeel ervóór (MUX-98)
- [ ] Functie benoemt zijn hoofdtaak en heeft een vervolgstap (MUX-99)
- [ ] Rolintroductie aanwezig bij eerste login en lege rolomgeving, met rol, context, mogelijkheden, wat ontbreekt en één eerste actie (MUX-100)

---

## Bijlage B — Wijzigingslog

### v1.4 — 1 augustus 2026 (gerichte patch MUX-76)

Uitsluitend drie feitelijke correcties in de rollentabel en de bijbehorende uitwerking. Geen nieuwe regels, geen hernummering, geen productbesluiten, verder niets aangeraakt.

| Onderdeel | Wijziging |
|---|---|
| MUX-76 | Ploegleider: rolwaarde `ploegleider`, status **bouwbaar** — bestaat server-side sinds commit `30ad85f`. Alle verwijzingen naar ontbreken of blokkade vervallen. |
| MUX-76 | Medical Staff: technische rolwaarde `medical_staff`. `medic` is ingetrokken. Een functietype binnen de rol is beschrijvend en verleent geen rechten. |
| MUX-76a | Bij Ploegleider is de blokkadenotitie vervangen door de pakketgrens: `CLUB_RECHTEN_01` beheert rollen, rechten, scopes en autorisatie; `PLOEGLEIDER_01` bouwt alleen de operationele wedstrijdlaag en geen tweede rechtenarchitectuur. |
| Hoofdstuk 17 | De twee openstaande punten die hiermee beslist zijn, zijn verwijderd. |

MUX-75 blijft ongewijzigd van kracht als algemene regel; hij raakt de ploegleider alleen niet meer.

### v1.3 — 1 augustus 2026 (`MOBILE_UX_STANDARD_01C`)

Sluitronde. Drie nieuwe regels, geen nieuwe hoofdstukken, geen hernummering. Geen nieuwe productbesluiten, besluitregister en Master Plan ongewijzigd.

| Regel | Wijziging |
|---|---|
| MUX-98 | **Nieuw.** Eerste bruikbare interactie: kernbediening vóór secundaire inhoud, zware onderdelen uitgesteld, één trage bron blokkeert nooit het hele scherm. Expliciet afgebakend tegen MUX-94a — dat gaat over wat je ziet, MUX-98 over wat je kunt bedienen. Geen nieuwe milliseconde-eis. Voorbeeld uitgewerkt op de pagina Klimmen. |
| MUX-99 | **Nieuw.** Geen losse functie zonder logisch vervolg. Iedere functie benoemt zijn hoofdtaak en heeft een vervolgstap; een inspiratiepagina moet doorlinken naar een uitvoerbare taak. Mirror toetst de keten, niet het scherm. |
| MUX-100 | **Nieuw.** Rolintroductie bij eerste login en lege rolomgeving: rol, context, mogelijkheden, wat ontbreekt, één eerste actie. Subregel h maakt toetsbaar wanneer de introductie verdwijnt — pas bij een echte toewijzing én ten minste één echte taak of echt gegeven. |
| MUX-81 | Toetsdimensies uitgebreid van vijftien naar achttien. |
| MUX-82 | Vijf afkeurgronden toegevoegd. |
| Bijlage A | Drie regels toegevoegd aan de toetslijst. |

**Doorwerking in de nog te leveren documenten.**

- `SPARKI_MOBILE_COMPONENT_LIBRARY.md` — vier componenten erbij: first-action card, progressive loading, rolintroductiekaart, detailkaart met verplichte vervolgstap.
- `SPARKI_ROLE_BASED_MOBILE_FLOWS.md` — per rol: eerste-loginflow, lege rolomgeving, eerste echte taak, en de hoofdtaak waaraan elke functie van die rol hangt.
- `SPARKI_MOBILE_PATTERNS.md` — vier patronen erbij: first usable interaction, functie naar hoofdtaak, rolintroductie, inspiratiepagina naar uitvoerbare taak.
- `SPARKI_MIRROR_MOBILE_TESTSTANDARD.md` — achttien toetsdimensies; eerste bruikbare interactie, volledige productketen, rolintroductie en "geen losse functie zonder vervolg" als afzonderlijke scenario's.

### v1.2 — 1 augustus 2026 (`MOBILE_UX_STANDARD_01B`)

Uitbreidingsronde. Geen nieuwe architectuur, geen nieuwe productbesluiten, besluitregister en Master Plan ongewijzigd. Twee nieuwe hoofdstukken (12 AI-gedrag, 13 Wedstrijddagmodus); de daaropvolgende hoofdstukken zijn doorgenummerd naar 14 t/m 17.

| Regel | Wijziging |
|---|---|
| MUX-89 | **Nieuw.** AI ondersteunt, bestuurt niet. Geen handeling zonder expliciete toestemming, geen stilzwijgende instemming, geen herhaalde vraag na negeren. |
| MUX-90 | **Nieuw.** AI onderbreekt nooit tijdens navigatie, training, wedstrijd, onboarding of formulier. Uitgestelde adviezen gaan niet verloren. Wat niet kan wachten is per definitie geen AI-advies maar een veiligheidsmelding. |
| MUX-91 | **Nieuw.** Ieder advies noemt waarom, op welke gegevens, en met welke onzekerheid. Geen black box. Ontbrekende gegevens worden benoemd in plaats van weggelaten. |
| MUX-92 | **Nieuw.** AI creëert geen uitzonderingen; tabel met de betekenis van MUX-12, 28, 48, 53, 81a, 88 en 93 voor AI-onderdelen. |
| MUX-93 | **Nieuw.** Geen verrassingen: niets verschuift, verdwijnt of wisselt onaangekondigd. Vijf verboden gedragingen, vijf toegestane uitzonderingen met voorwaarde. |
| MUX-94 | **Nieuw.** Prestatiedoelen als ervaringsnorm in plaats van technische milliseconden. Subregel g regelt de verhouding tot MUX-56 en MUX-57: die blijven de toetsbare ondergrens, het ervaringsdoel wint bij tegenstrijdigheid. |
| MUX-95 | **Nieuw.** Codegovernance: nieuwe regel is nieuwe code, codes worden nooit hergebruikt, codes zijn identificatie en geen volgorde, verwijzen gebeurt uitsluitend per code, een bevinding zonder code is niet toetsbaar. |
| MUX-96 | **Nieuw.** Wedstrijddagmodus voor wedstrijddag, trainingskamp, etappekoers en begeleiding onderweg. Twaalf subregels a–l. Subregel h begrenst de noodhandeling expliciet: zonder verbinding kan hij niet worden verstuurd, dat wordt gezegd, en stil falen is een directe afkeurgrond. |
| MUX-97 | **Nieuw.** Rolcontexten voor sporter, trainer, ploegleider, mechanieker, soigneur en medical staff. Structuur en regels; detailflows volgen later. Een context verandert volgorde en prominentie, nooit navigatie of rechten. |
| MUX-81 | Toetsdimensies uitgebreid van elf naar vijftien. |
| MUX-82 | Vijf afkeurgronden toegevoegd, waaronder de stil falende noodhandeling. |
| Bijlage A | Zeven regels toegevoegd aan de toetslijst. |

**Doorwerking in de nog te leveren documenten.**

- `SPARKI_MOBILE_COMPONENT_LIBRARY.md` — AI-voorstelkaart als eigen component met verplichte onderbouwingsregel (MUX-91); wedstrijddagvarianten van kaart, taakregel en bevestiging (MUX-96b–f); skeleton reserveert definitieve ruimte (MUX-93d).
- `SPARKI_ROLE_BASED_MOBILE_FLOWS.md` — iedere rolflow wordt uitgewerkt per context uit MUX-97, met de standaardcontext als vertrekpunt.
- `SPARKI_MOBILE_PATTERNS.md` — patroon "advies zonder onderbreking" (MUX-90), patroon "aankondigen in plaats van verschuiven" (MUX-93a), patroon "wedstrijddagmodus aan/uit" (MUX-96a).
- `SPARKI_MIRROR_MOBILE_TESTSTANDARD.md` — vijftien toetsdimensies; AI-gedrag, wedstrijddagmodus en het offline-noodgedrag als afzonderlijke scenario's.

### v1.1 — 1 augustus 2026 (`MOBILE_UX_STANDARD_01A`)

Verfijningsronde. Geen nieuwe architectuur, geen nieuwe besluiten, besluitregister en Master Plan ongewijzigd.

| Regel | Wijziging |
|---|---|
| MUX-14 | Uitgebreid van één alinea naar zes subregels a–f: namen, iconen, aantal en volgorde van de hoofditems zijn voor alle rollen gelijk; alleen de inhoud erachter verandert. Subregel e legt de consequentie vast: een ongebruikt hoofditem verdwijnt niet maar toont een lege toestand. |
| MUX-53a | **Nieuw.** Gedrag na verbindingsherstel: automatisch opnieuw synchroniseren, vier zichtbare uitkomsten, benoemen wat bij gedeeltelijk succes ontbreekt, geen dubbele synchronisatie, geen verborgen achtergrondacties. Punt 6 begrenst de regel expliciet tot opnieuw ophalen, zodat hij niet in strijd komt met MUX-54 (geen offline schrijfacties). |
| MUX-76 | Kolom "Eerste mobiele prioriteit" toegevoegd voor alle twaalf rollen. |
| MUX-76a | **Nieuw.** Per rol uitgewerkt: eerste scherm, belangrijkste informatie, belangrijkste eerste actie. Inclusief de eigenaar, die geen eigen eerste scherm heeft maar op het startscherm van zijn beheerrol landt. |
| MUX-81 | Drie toetsdimensies toegevoegd: beloftetoets, geen doodlopende schermen, hersynchronisatie na herstel. |
| MUX-81a | **Nieuw.** Beloftetoets: Mirror toetst of een knop levert wat zijn naam belooft, niet of er iets gebeurt. Een half uitvoerbare functie wordt niet als knop getoond. |
| MUX-82 | Twee afkeurgronden toegevoegd: doodlopende flow, knop die zijn naam niet waarmaakt. |
| MUX-88 | **Nieuw.** Geen doodlopende schermen. Iedere flow eindigt met een logische vervolgstap óf een zichtbare terugweg. Systeem-terug telt niet mee. Mirror toetst per flow, niet per scherm. |
| Bijlage A | Vijf regels toegevoegd aan de toetslijst. |

**Doorwerking in de nog te leveren documenten.** De vier naslagdocumenten nemen dit ongewijzigd over:

- `SPARKI_MOBILE_COMPONENT_LIBRARY.md` — bottom navigation krijgt de vaste-plattegrondregel (MUX-14 a–f) als componenteis; eindscherm/bevestigingskaart krijgt MUX-88 als vormvereiste.
- `SPARKI_ROLE_BASED_MOBILE_FLOWS.md` — MUX-76a is het uitgangspunt per rol; iedere uitgewerkte flow eindigt aantoonbaar volgens MUX-88.
- `SPARKI_MOBILE_PATTERNS.md` — synchronisatiepatroon volgens MUX-53a; beloftepatroon volgens MUX-81a.
- `SPARKI_MIRROR_MOBILE_TESTSTANDARD.md` — elf toetsdimensies in plaats van acht; beloftetoets en doodloopcheck als afzonderlijke scenario's, per flow uitgevoerd.

### v1.0 — 1 augustus 2026

Eerste vaststelling. Regels MUX-01 t/m MUX-87, vier besluiten `MUX-B1..B4` (nummering nog niet toegekend), toetslijst.

---

*Einde `SPARKI_MOBILE_UX_STANDARD_v1.4.md`. Volgende opleveringen: `SPARKI_MOBILE_COMPONENT_LIBRARY.md`, `SPARKI_ROLE_BASED_MOBILE_FLOWS.md`, `SPARKI_MOBILE_PATTERNS.md`, `SPARKI_MIRROR_MOBILE_TESTSTANDARD.md`.*
