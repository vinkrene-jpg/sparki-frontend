# MOBIEL_ROLLEN_01 — Alle rollen in de app, uit één codebasis

**Type:** bouwopdracht voor Replit
**Status:** vastgesteld 02-08-2026
**Gemeten op:** `38a28a4b` (main, 2 augustus 07:16), rechtstreeks in de code
**Technische afhankelijkheid:** F1 en F2 van `SPARKI_HERSTEL_EN_AANVULLING_01` (rolbepaling en zichtbare context). Zolang de rolbepaling terugvalt op de atleetweergave, bouw je rolschermen waar niemand op landt. Dit is een afhankelijkheid, geen wachtpoort — F0 en F1 hieronder kunnen direct beginnen.

**Uitvoeringsregel:** deze opdracht is de volledige uitvoeringsvrijgave. Alle fasen zelfstandig achter elkaar, rapporteren zonder te wachten.

---

## 0. Wat er nu staat, gemeten

`MR-01` — De mobiele app (`artifacts/sparki-mobile`) heeft **dertien echte schermen**, en die gaan allemaal over fietsen: vandaag · ritten · rit-detail · rit opnemen · route plannen · route aanvragen · navigeren · GPX importeren · wedstrijddag · instellingen · support · diagnostiek · plus inloggen en registreren. Daarnaast zeventien componenten.

`MR-02` — Er komt **geen enkele rol** in voor behalve de sporter, met één uitzondering: de wedstrijddagmodus. Trainer, hoofdtrainer, clubbeheerder, teammanager, ploegleider, mechanieker, soigneur, medische staf, voedingsdeskundige, ouder en gast bestaan niet in de app.

`MR-03` — De webversie (`artifacts/sparki`) heeft die rolomgevingen wél, in een eigen codebasis. Dat zijn vandaag **twee gescheiden applicaties**.

`MR-04` — Besluit van René (02-08): **alle rollen komen in de native app**, bij de eerste publieke versie, want die versie is een test mét betalende klanten. Elke rol krijgt in de app hetzelfde als in de browser — geen uitgeklede mobiele versie. De browserversie blijft daarnaast bestaan.

`MR-05` — Tweede besluit van René (02-08): **app en browser komen uit één codebasis.** Zonder die samenvoeging wordt elk rolscherm twee keer gebouwd en elk defect twee keer gerepareerd. Dat is met betalende klanten niet houdbaar.

---

## 1. F0 — Bepaal de samenvoegroute

`MR-06` — **Dit is de belangrijkste fase van het pakket en er wordt hier geen schermwerk gedaan.** Lever een onderbouwd voorstel voor hoe de twee applicaties één codebasis worden, met de gevolgen per route.

`MR-07` — Beoordeel minimaal: welke gedeelde laag er al is (API-client, zod-schema's, rechtenlogica) · welke schermen technisch identiek kunnen zijn en welke echt apart moeten blijven · wat er gebeurt met de bestaande dertien app-schermen · wat de gevolgen zijn voor bouwtijd, publicatie en de dagelijkse publish · welke onderdelen native móéten blijven.

`MR-08` — Vier onderdelen zijn hoe dan ook native en blijven dat: **navigeren tijdens de rit · een rit opnemen · de wedstrijddagmodus · achtergrondlocatie.** Die gebruiken apparaatfuncties die een browser niet betrouwbaar levert. Een samenvoegroute die deze vier degradeert wordt afgewezen.

`MR-09` — Kies de route zelf en onderbouw hem. Vraag dit niet aan René: dit is een technische keuze, geen productbesluit. Leg de keuze vast in het besluitregister met de reden.

`MR-10` — Klaar als: er ligt één gekozen route met een migratiepad per bestaand scherm, en het is aantoonbaar dat een rolscherm daarna **één keer** gebouwd wordt.

---

## 2. F1 — Gedeelde schil

`MR-11` — Bouw de gedeelde schil volgens de gekozen route: navigatie met de **vaste vijf posities**, de **permanent zichtbare contextregel** (rol, organisatie, en of het test of productie is), de rolwisselaar met zoekveld vanaf meer dan vijf contexten, en de lege-toestandkaart.

`MR-12` — Vaste posities, rolgebonden labels: aantal, volgorde, plaats en icoon van de hoofditems zijn voor alle rollen gelijk; alleen de naam mag verschillen. Positie 5 heet altijd **Meer**. Voor wie een clubrol heeft vervangt **Club** de positie van Analyse.

`MR-13` — Positie 1 is per rol de vastgelegde eerste prioriteit: Sporter → Vandaag · Trainer → Trainingen · Hoofdtrainer → Groepen · Clubbeheerder → Organisatie · Teammanager → Teams · Ploegleider → Wedstrijddag · Mechanieker → Materiaal · Soigneur → Voeding · Medische staf → Gezondheid · Voedingsdeskundige → Voeding · Ouder → Kind · Gast → Introductie · Admin → Systeemstatus.

`MR-14` — Klaar als: dezelfde schil draait in de app en in de browser, uit dezelfde code.

---

## 3. F2 t/m F6 — De rollen zelf

Bouw per fase een groep rollen. Elke rol krijgt zijn eigen startscherm met een **eerlijke lege toestand** — welke rol, welke context, wat er kan, wat ontbreekt, wie het oplost, één eerste actie. Geen generiek welkom, geen fictieve personen.

| Fase | Rollen | Waarom deze volgorde |
|---|---|---|
| **F2** | Trainer · Hoofdtrainer | grootste betalende groep na de sporter; het Trainer-abonnement is €99 |
| **F3** | Ouder | jeugd is een besloten voorwaarde voor clubinstroom, en de ouderomgeving bestaat vandaag alleen in de browser |
| **F4** | Clubbeheerder · Teammanager | bureauwerk, maar hoort er bij de eerste versie in |
| **F5** | Ploegleider · Mechanieker · Soigneur · Gast | wedstrijddag; de dagmodus bestaat al en wordt hier uitgebreid naar de andere staffuncties |
| **F6** | Medische staf · Voedingsdeskundige · Admin | kleinste groepen, striktste rechten |

`MR-15` — Geen rolscherm wordt gebouwd voor een rolwaarde die niet server-side bestaat. Simuleren is uitgesloten.

`MR-16` — Elke rol toont uitsluitend wat die rol mag zien. De rechtencontrole blijft server-side; de app vertrouwt nooit op wat de client meestuurt.

`MR-17` — Bijzondere grenzen die in deze fasen gelden: mechanieker en soigneur zien uitsluitend naam en of de renner rijdt · noodinformatie alleen voor ploegleider, teammanager en medische staf, met inzagelog · een gast ziet het hele wedstrijdplan en verliest toegang na de wedstrijddag · een ouder krijgt één overzicht over al zijn kinderen · een trainer met meerdere groepen krijgt géén groepsoverstijgende weergave.

---

## 4. F7 — Wedstrijddagmodus verbreden

`MR-18` — De wedstrijddagmodus bestaat al voor ploegleider en teammanager. Breid hem uit naar mechanieker en soigneur, binnen hun eigen rechten.

`MR-19` — De twaalf regels van de wedstrijddagmodus blijven gelden: grote knoppen, bruikbaar met handschoenen, leesbaar in zonlicht, één regel tekst per melding, geen invoer waar het niet hoeft, een noodhandeling binnen bereik, werkend zonder verbinding, geen storende meldingen, bedienbaar in beweging.

---

## 5. F8 — Regressie en eindbewijs

`MR-20` — De bestaande dertien schermen moeten na de samenvoeging **onveranderd blijven werken**. Rijden, navigeren en opnemen zijn de kern van het product; een regressie daar weegt zwaarder dan een ontbrekend rolscherm.

`MR-21` — Meet op echte toestellen: schermtijd tot eerste bruikbare interactie, gedownloade data, batterijverbruik over een vaste testduur. Geen subjectief "lijkt soepel".

`MR-22` — Offline blijft buiten dit pakket. Dat is bewust uitgesteld naar de tweede versie.

---

## 6. Directe herstelgronden

`MR-23` — Een rolscherm dat in de app anders werkt dan in de browser zonder vastgelegde reden.
`MR-24` — Een rolscherm dat twee keer bestaat, in beide codebases.
`MR-25` — Een rolwaarde met een scherm terwijl die rolwaarde server-side niet bestaat.
`MR-26` — Een zesde hoofditem in de navigatie.
`MR-27` — Een scherm waarop de actieve rol en omgeving niet zichtbaar zijn.
`MR-28` — Een rechtencontrole die alleen in de app zit en niet server-side.
`MR-29` — Een regressie op navigeren, rit opnemen of de wedstrijddagmodus.
`MR-30` — Een lege rolomgeving met een generiek welkom of een verzonnen persoon.
`MR-31` — Een gast die na de wedstrijddag nog toegang heeft.

---

## 7. Wat ik hierin heb beslist

Deze keuzes zijn van Claude, niet van René, en met één zin terug te draaien.

1. **F0 gaat over de samenvoeging, niet over schermen.** Zonder die keuze bouw je alles twee keer, en dat is precies wat het besluit tot één codebasis moest voorkomen.
2. **Vier onderdelen blijven hoe dan ook native.** Navigeren, opnemen, wedstrijddag en achtergrondlocatie werken niet betrouwbaar in een browser; een samenvoeging die daar op inlevert is geen winst.
3. **Trainer gaat vóór club.** Dat is de eerste betalende rol na de sporter en het meest gebruikte scherm buiten het rijden.
4. **De volgorde van de rollen loopt van meest gebruikt naar minst gebruikt**, niet van eenvoudig naar moeilijk.
5. **Offline blijft eruit**, conform het bestaande besluit.
6. **Regressie op de rijfuncties weegt zwaarder dan een ontbrekend rolscherm.** Wat vandaag werkt mag niet stukgaan aan wat er bij komt.
