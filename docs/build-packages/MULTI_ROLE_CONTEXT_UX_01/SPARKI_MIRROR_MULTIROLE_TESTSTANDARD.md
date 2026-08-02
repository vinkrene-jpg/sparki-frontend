# SPARKI_MIRROR_MULTIROLE_TESTSTANDARD

> **Vast contextblok (02-08-2026 — geldt voor elke Mirror-toets)**
> Lees vóór het toetsen eerst `docs/besluiten/BESLUITEN_VOOR_REPLIT_2026-08-02.md` en
> `docs/besluiten/BOUWSTRAAT_2026-08-02.md`. Daarin staat wat als productbesluit vastligt
> en waar het te toetsen onderdeel in de bouwvolgorde zit.
>
> **Deze stukken zijn context, geen bewijs.** Ze vertellen wat de bedoeling en de prioriteit
> is — ze zeggen niets over wat er werkelijk gebouwd is. Wat Mirror toetst, stelt Mirror
> zelf vast op een vaste SHA. Wijkt de werkelijkheid af van een besluit, dan is dat een
> **bevinding**, geen aanleiding om het besluit aan te passen.
>
> Komt Mirror iets tegen dat buiten de opdracht valt maar wél een besluit raakt, dan meldt
> Mirror dat apart onder **"Signalen buiten scope"** — Mirror lost het niet zelf op.


> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Regelcodes:** `MMT-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026
Aanvullend op `SPARKI_MIRROR_MOBILE_TESTSTANDARD.md` (`MTS-01..69`), die onverkort blijft gelden.

---

## 1. Toetsprincipes

**MMT-01:** Mirror toetst op een vaste gepushte SHA, met **echte** meervoudige rollen — niet met één rol en een gesimuleerde tweede.
**MMT-02:** de toets vraagt een testopstelling met minimaal: een gebruiker met vijf contexten, waaronder twee in dezelfde club, twee clubs, en een ouder met twee kinderen. Zonder die opstelling is de toets niet uitvoerbaar en wordt dat gerapporteerd, niet omzeild.
**MMT-03:** rechten worden getoetst door ze te **overtreden**. Een verborgen knop is geen bewijs; een server-side weigering met auditregel wel.
**MMT-04:** contextlekken worden getoetst door **timing**: wisselen tijdens een lopende opvraging is de belangrijkste test, niet de laatste.
**MMT-05:** bij twijfel afkeuren. Een lek dat één op de tien keer optreedt is een lek.

## 2. Toetsdimensies

| Code | Dimensie | Wat Mirror doet |
|---|---|---|
| MMT-06 | Vier vragen | Controleert op twintig willekeurige schermen of rol en organisatie zichtbaar zijn zonder handeling, en de rechten binnen één handeling |
| MMT-07 | Rolwissel | Wisselt tussen alle contexten, in beide richtingen, en controleert dat er nooit opnieuw ingelogd hoeft te worden |
| MMT-08 | Server-side validatie | Vervalst een contextwissel naar een context zonder rechten; controleert weigering, reden en auditregel |
| MMT-09 | Atomariteit | Onderbreekt een wissel halverwege; controleert dat óf de oude óf de nieuwe context volledig geldt |
| MMT-10 | Laat antwoord | Start een trage opvraging, wisselt tijdens het wachten, controleert dat het antwoord wordt verworpen |
| MMT-11 | Open detailvensters | Opent een detailscherm, wisselt, controleert dat het gesloten is en niet terugkeert |
| MMT-12 | Tellers en badges | Controleert dat geen enkele teller een aantal uit een andere context toont |
| MMT-13 | Zoeken | Zoekt op een term die alleen in een andere context resultaat geeft; controleert dat er niets verschijnt en niets wordt gesuggereerd |
| MMT-14 | Cache | Wisselt heen en terug; controleert dat de tweede keer opnieuw wordt opgehaald en niets uit de eerste blijft staan |
| MMT-15 | Terugknop | Navigeert terug over een wissel heen; controleert de melding en de terugkeer naar het startscherm van de actieve context |
| MMT-16 | Deep links | Opent een link naar een context zonder rechten; controleert weigering zonder informatie over de inhoud |
| MMT-17 | Notificaties | Laat een melding uit een niet-actieve rol binnenkomen; controleert dat de titel contextvrij is, de rol zichtbaar, en dat aantikken zichtbaar wisselt |
| MMT-18 | Onafgemaakt werk | Wisselt met een half ingevuld formulier; controleert de drie keuzes en dat er niets stil verloren gaat of stil bewaard blijft |
| MMT-19 | AI-context | Stelt dezelfde vraag in drie contexten; controleert drie verschillende, contextzuivere antwoorden mét contextvermelding |
| MMT-20 | AI-grens | Stelt een vraag die alleen in een andere context beantwoordbaar is; controleert dat de AI dat zegt en niet zelf wisselt |
| MMT-21 | Rol ingetrokken | Trekt een rol in terwijl de gebruiker erin werkt; controleert weigering bij de eerstvolgende handeling, melding met reden en het keuzescherm |
| MMT-22 | Meerdere clubs | Controleert dat er geen hoofdclub of impliciete voorkeur bestaat |
| MMT-23 | Meerdere teams | Controleert dat twee groepen binnen één rol twee contextregels zijn, geen filter |
| MMT-24 | Meerdere sporters en ouders | Controleert een context per kind, en dat er geen gecombineerd overzicht ontstaat zonder rechtencontrole per kind |
| MMT-25 | Offline | Probeert te wisselen zonder verbinding; controleert weigering met melding en het ontbreken van een wachtrij |
| MMT-26 | Offline gegevens | Trekt een rol in, verbindt opnieuw, controleert dat de offline gegevens van die context zichtbaar worden verwijderd |
| MMT-27 | Meerdere tabbladen | Zet twee tabbladen in twee contexten; controleert onafhankelijkheid, zichtbaarheid en dat intrekken beide raakt |
| MMT-28 | Meerdere apparaten | Wisselt op de telefoon; controleert dat de desktop niet meewisselt en dat favorieten wél synchroniseren |
| MMT-29 | PWA | Herstart de PWA; controleert herstel van de laatst gebruikte context en niet van een ongeldig scherm |
| MMT-30 | Apparaten | Voert de volledige set uit op telefoon, tablet en desktop; tablet mag geen derde ontwerp zijn |
| MMT-31 | Wedstrijddagmodus | Controleert dat de rolwisselaar bereikbaar is, niet prominent, en altijd bevestiging vraagt |
| MMT-32 | Toegankelijkheid | Controleert voorleesbaarheid van de context als één mededeling en de aankondiging van een wissel |
| MMT-33 | Prestatie | Controleert dat na een wissel eerst contextregel en kernbediening verschijnen, en nooit inhoud van de vorige context |
| MMT-34 | Navigatie | Controleert maximaal vijf hoofditems, de eerste prioriteit per rol uit `MUX-76a`, en dat een leeg hoofditem toont waarom het leeg is |
| MMT-34a | Vaste posities | Wisselt door alle contexten en controleert dat **aantal, volgorde, plaats en icoon** van de hoofditems identiek blijven, en dat alleen de **namen** verschillen (`MR-B01 = C`) |
| MMT-34b | Vast anker | Controleert dat positie 5 in elke rol "Meer" heet en nergens is hernoemd |
| MMT-34c | Rolset | Controleert dat er precies één context bestaat per server-side rolwaarde: geen context voor een niet-bestaande rolwaarde, en geen ontbrekende context voor een bestaande (`MR-B02 = C`) |
| MMT-34d | Permanente zichtbaarheid | Controleert de uitkomst van `MR-B04` op hoofdschermen, detailschermen en in wedstrijddagmodus, op alle drie de apparaten |
| MMT-35 | Componentherkomst | Controleert dat elk gebruikt component in de componentbibliotheek staat en niet in het bouwpakket is bedacht |
| MMT-36 | Geen tweede rechtenmodel | Controleert dat rechten uitsluitend uit `CLUB_RECHTEN_01` komen |
| MMT-37 | Rolwaarde bestaat | Controleert dat er geen rolomgeving bestaat voor een rolwaarde die server-side ontbreekt |
| MMT-38 | Vastlegging | Controleert dat elke wissel én elke geweigerde wissel is vastgelegd, en dat inzage in gegevens van minderjarigen de context meedraagt |

## 3. Directe afkeurgronden

1. Rol of organisatie is op enig scherm niet zichtbaar zonder handeling.
2. Een rolwissel vraagt om opnieuw inloggen.
3. Een contextwissel is niet server-side gevalideerd.
4. Er bestaat een tussentoestand waarin rol en rechten niet overeenkomen.
5. Een gegeven uit een vorige context is na de wissel zichtbaar — in beeld, in een teller, in zoekresultaten of via de terugknop.
6. Een laat binnenkomend antwoord uit de vorige context wordt getoond.
7. Een cache wordt gedeeld tussen contexten.
8. De AI antwoordt met gegevens uit een andere context, of wisselt zelf van context.
9. Een notificatie toont inhoud die in de huidige context niet zichtbaar mag zijn.
10. Een deep link geeft toegang op grond van bezit.
11. Offline komt een contextwissel in een wachtrij.
12. De actieve context synchroniseert tussen apparaten.
13. Er bestaat een tweede rollen- of rechtenmodel naast `CLUB_RECHTEN_01`.
14. Er bestaat een rolomgeving voor een rolwaarde die server-side niet bestaat.
15. Een contextwissel of geweigerde poging wordt niet vastgelegd.
16. Een component is in het bouwpakket bedacht in plaats van in de componentbibliotheek opgenomen.
17. Onafgemaakt werk gaat stil verloren of wordt stil bewaard.
18. Tablet heeft een eigen, derde ontwerp.
19. Aantal, volgorde, plaats of icoon van de hoofditems verschilt tussen twee contexten.
20. Positie 5 heet ergens anders dan "Meer".
21. Er bestaat een context voor een rolwaarde die server-side niet bestaat, of een server-side rolwaarde zonder context.
22. Een contextregelitem toont een aantal of inhoud uit de context waarnaar het verwijst.
23. Een gebruikt component is niet als `CMP-45`, `CMP-46` of `CMP-47` in de componentbibliotheek opgenomen.

## 4. Afkeurgronden na weging

geen zoekveld bij meer dan zeven contexten · favorieten die door Sparki zelf worden gezet · een contextregel die de navigatie verkleint · een wissel zonder zichtbare terugkoppeling · een rolvolgorde die afwijkt van `MUX-76a` · een lange lijst met een tweede indelingslogica · trage wisseling zonder wachttoestand · een melding bij een verdwenen context zonder reden.

## 5. Bevindingssjabloon en poort

```
Bevinding <nummer>
Dimensie:     MMT-<nn> of directe herstelgrond <n>
Contexten:    welke contexten betrokken waren
Apparaat:     telefoon / tablet / desktop / PWA
Scenario:     stap voor stap
Waarneming:   wat gebeurde er werkelijk
Verwacht:     wat had moeten gebeuren
Bewijs:       SHA, tijdstip, scherm of respons
Ernst:        blokkerend / herstel vóór volgende fase / restpunt
```

**MMT-39:** één uitkomst per fase: `MIRROR_PROVEN` · `PARTIAL` met genummerde restpunten · `AFGEKEURD`. Geen voorwaardelijke goedkeuring. `MIRROR_PROVEN` is bewijs, geen productgoedkeuring; die blijft `RENE_APPROVED`.
