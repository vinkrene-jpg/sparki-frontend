# SPARKI_CONTEXT_SECURITY_STANDARD

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Regelcodes:** `CSE-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026
Hoe voorkomen wordt dat gegevens uit de ene context in een andere zichtbaar worden.

---

## 1. Grondregel

**CSE-01:** **geen enkel gegeven uit een vorige context is zichtbaar in een volgende.** Niet in beeld, niet in een cache, niet in een zoekresultaat, niet in een terugknop, niet in een tweede tabblad, niet in een offlinekopie.
**CSE-02:** de server is de enige autoriteit. Elke opvraging bevat de actieve context; de server controleert die en levert uitsluitend wat daarin is toegestaan. Filteren in de interface is **geen** beveiliging.
**CSE-03:** fail-closed. Bij twijfel over de context of de rechten wordt niets getoond en volgt een begrijpelijke melding. Een onbekende toestand leidt nooit tot de ruimere weergave.
**CSE-04:** een gebruiker die in twee contexten rechten heeft, mag die gegevens **niet gecombineerd** zien. Het recht is per context, niet per persoon.

## 2. Contextlekken

**CSE-05:** elke opvraging draagt de contextsleutel mee. Een antwoord dat bij een andere context hoort wordt door de client **verworpen**, niet getoond — ook als het toevallig binnen de rechten van de gebruiker valt.
**CSE-06:** een antwoord dat onderweg is wanneer de context wisselt, wordt bij binnenkomst verworpen. Dit is de meest voorkomende bron van lekken: het trage antwoord van de vorige rol dat na de wissel binnenkomt.
**CSE-07:** tellingen, badges, aantallen en samenvattingen zijn **ook** gegevens. Een teller die het aantal open taken uit een andere context toont is een lek.
**CSE-08:** zoekresultaten zijn beperkt tot de actieve context. Er bestaat geen accountbrede zoekfunctie over contexten heen.
**CSE-09:** foutmeldingen verraden niets over het bestaan of de inhoud van gegevens buiten de actieve context. "Geen toegang" is voldoende; "deze sporter zit in Club B" is een lek.

## 3. Caching

**CSE-10:** caches zijn **contextgebonden**: de contextsleutel maakt deel uit van de cachesleutel. Twee contexten delen nooit een cache-ingang.
**CSE-11:** bij een contextwissel wordt de cache van de vorige context **verworpen**, niet bewaard voor snel terugwisselen. Snelheid weegt hier niet op tegen het risico.
**CSE-12:** rechten worden niet langer gecacht dan de sessie en nooit over een contextwissel heen (`CTX-17`).
**CSE-13:** afbeeldingen, bijlagen en gegenereerde bestanden vallen onder dezelfde regel. Een miniatuur uit een andere context is een lek zoals elke andere.

## 4. Browser-back, geschiedenis en herstel

**CSE-14:** terugnavigeren mag nooit een scherm uit een vorige context tonen. Bij terugkeer naar een scherm dat niet bij de actieve context hoort, wordt de gebruiker naar het startscherm van de actieve context gebracht met een melding.
**CSE-15:** de terugknop wisselt **nooit** van context. Terug is terug binnen de context; naar een andere context ga je alleen via de rolwisselaar of een deep link.
**CSE-16:** het herstellen van een sessie na een herstart herstelt de laatst gebruikte context (`CTX-08`) — en niet het laatst geopende scherm, tenzij dat scherm in die context geldig is.

## 5. Deep links

**CSE-17:** een deep link wordt server-side gecontroleerd op rechten in de meegedragen context (`CTX-32`).
**CSE-18:** een weigering vertelt niet wat er achter de link zat, en niet of het bestaat.
**CSE-19:** een deep link die geopend wordt terwijl een andere context actief is, wisselt de context **zichtbaar** en met bevestiging bij onafgemaakt werk (`CTX-30`).
**CSE-20:** het bezit van een link is nooit een recht (`CTX-33`).

## 6. Screenshots en beeld

**CSE-21:** elk scherm toont de actieve context (`MRU-01`), zodat een screenshot altijd zelf zegt uit welke rol en organisatie hij komt. Dit is de goedkoopste bescherming tegen misverstanden achteraf.
**CSE-22:** Sparki blokkeert geen screenshots — dat is niet betrouwbaar af te dwingen en wekt valse zekerheid. Wat wel geldt: schermen met gezondheids- of medische gegevens tonen een zichtbare vertrouwelijkheidsmarkering, conform de privacyklassen uit `REPORT_DESIGN_STANDARD_01`.
**CSE-23:** een gedeelde weergave, export of rapport draagt altijd de context waarin het is gemaakt, en nooit gegevens van daarbuiten.

## 7. Offline

**CSE-24:** offline gegevens zijn contextgebonden opgeslagen en worden bij een contextwissel niet toegankelijk vanuit de nieuwe context.
**CSE-25:** offline weigert Sparki elke contextwissel; de huidige context blijft leesbaar met zichtbare tijdstempel (`RSW`-tabel §8). Er komt **geen** wachtrij van wissels.
**CSE-26:** bij het intrekken van een rol worden de offline gegevens van die context bij de eerstvolgende verbinding verwijderd. Dat verwijderen is zichtbaar, niet stil.
**CSE-27:** bij afmelden worden alle contextgebonden offline gegevens verwijderd.

## 8. Meerdere tabbladen

**CSE-28:** de actieve context geldt **per tabblad**, niet per browser. Twee tabbladen mogen in twee verschillende contexten staan — dat is een reëel gebruikspatroon op desktop.
**CSE-29:** elk tabblad toont zijn eigen context prominent, zodat verwisseling zichtbaar is. Dit is de reden dat `MRU-15` de context permanent in de kop zet.
**CSE-30:** een handeling in tabblad A verandert nooit de context van tabblad B.
**CSE-31:** wordt een rol ingetrokken, dan verliezen **alle** tabbladen die context bij hun eerstvolgende handeling, met melding.
**CSE-32:** afmelden geldt voor het hele account en dus voor alle tabbladen tegelijk.

## 9. Meerdere apparaten

**CSE-33:** de actieve context is **per apparaat**, niet gedeeld. Wisselen op de telefoon verandert niets op de desktop.
**CSE-34:** contexthistorie en favorieten zijn wél accountgebonden en synchroniseren; de **actieve** context niet.
**CSE-35:** een rechtenwijziging werkt op alle apparaten bij hun eerstvolgende handeling, niet pas bij de volgende aanmelding.

## 10. Vastlegging

**CSE-36:** elke contextwissel wordt vastgelegd (`CTX-14`). Voor gebruikers van 16 en 17 jaar geldt de bestaande volledige toegangslogging onverkort.
**CSE-37:** een geweigerde wissel of geweigerde opvraging wordt **ook** vastgelegd. Geweigerde pogingen zijn het bewijsmateriaal waarmee de rechtenmatrix wordt aangetoond.
**CSE-38:** inzage in gegevens van een minderjarige wordt vastgelegd met context, zodat achteraf zichtbaar is uit welke rol die inzage plaatsvond.

## 11. Directe afkeurgronden

1. Een gegeven uit een vorige context is zichtbaar na een wissel — in beeld, in een teller, in een zoekresultaat of via de terugknop.
2. Een laat binnenkomend antwoord uit de vorige context wordt getoond.
3. Rechten worden client-side afgeleid of gefilterd in plaats van server-side gecontroleerd.
4. Een cache wordt gedeeld tussen contexten, of bewaard voor snel terugwisselen.
5. Een foutmelding verraadt het bestaan of de inhoud van gegevens buiten de actieve context.
6. Een deep link geeft toegang op grond van bezit in plaats van rechten.
7. Offline gegevens van een ingetrokken rol blijven bestaan.
8. Een contextwissel komt offline in een wachtrij.
9. Twee tabbladen delen ongewild één context, of een handeling in het ene verandert het andere.
10. De actieve context synchroniseert tussen apparaten.
11. Een contextwissel of geweigerde poging wordt niet vastgelegd.
12. Gegevens uit twee contexten worden gecombineerd getoond omdat dezelfde persoon in beide rechten heeft.
