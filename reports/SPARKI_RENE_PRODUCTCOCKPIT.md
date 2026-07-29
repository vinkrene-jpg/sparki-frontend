# Sparki Productcockpit voor René

**Peildatum:** 29 juli 2026 · Gebaseerd op audit-commit `7e2f1983` (live: `68df60f9`)
Dit is jouw leesbare overzicht van wat er nu in Sparki zit, wat er mist, en waar jij een besluit over moet nemen. De huidige versie is een **werkbron, geen goedgekeurd eindbeeld**.

## 1. Wat er nu staat (in gewone taal)

- **Voor sporters:** een complete dagelijkse coach — Vandaag, Trainen (automatisch plan), Analyse, Activiteiten, Routes met navigatie, Wedstrijdvoorbereiding, Lichaam (voeding/herstel), Mechanieker, Kennis, Samen, Ontdekken, Sportpaspoort, Journey, Klimmen, Bordjes-sprinten, Geluid.
- **Mobiele app (Sparki Navigatie):** rit opnemen, navigeren met scherm-HUD en audio, sensoren (BLE), val-alarm, volgauto, ritten delen — de "buiten"-kant van Sparki.
- **Voor trainers:** een cockpit per sporter, weekplanner voor meerdere sporters, uitnodigingen.
- **Voor ouders:** een welzijnsoverzicht van gekoppelde kinderen, met strenge privacy (bij twijfel dicht).
- **Voor jou als beheerder:** /admin met gezondheidschecks, testerbeheer, ops-log.
- **Commercieel:** Gratis/Go/Compleet bestaat technisch; betalen staat bewust nog uit (wacht op jouw akkoord voor Stripe).

## 2. De 7 belangrijkste zaken die op JOUW besluit wachten

1. **Wie betaalt waarvoor:** in de code zitten de slimme coach-functies onder "Go"; het Master Plan zegt dat coaching bij "Compleet" hoort en Go vooral navigatie-plus is. Dit moet jij beslissen vóór de winkel opengaat.
2. **Club/Team-abonnement:** de opdracht noemt ze, maar plan én code kennen ze niet. Wil je ze?
3. **Rollen:** hoofdtrainer, clubbeheerder, ploegleider en mechanieker bestaan niet als echte rollen met eigen werkruimte. Welke wil je echt?
4. **Navigatie desktop vs mobiel:** op desktop ontbreekt Wedstrijd en bestaat "Meer" niet; mobiel mist een directe Ontdekken-knop. Gelijktrekken?
5. **Analyse-scherm op desktop is licht** terwijl heel Sparki donker is. Donker maken?
6. **Photo Lab werkt maar is onvindbaar** (geen enkele knop verwijst ernaar). Terugbrengen of bewust laten rusten?
7. **Privacy en Voorwaarden** zijn alleen via een directe link bereikbaar. Footer-link toevoegen?

## 3. Wat er (t.o.v. het Master Plan) nog helemaal mist

Meertaligheid-fundament (alles is nu vast Nederlands), krachttraining, trainer-paspoort/campus/zoeken, instelbare navigatie met "terug naar standaard", landenwebsites, en de daadwerkelijke betaalflow (bewust uitgesteld).

## 4. Kleine dingen die snel beter kunnen (na jouw akkoord, niet nu gedaan)

Uitleg-stipjes bij TSS/CTL/ATL/TSB op drie plekken; eenheden op grafiek-assen; schermtitel "Plan" hernoemen naar "Trainen"; materiaalcoach geen advies laten tonen als hij het echt niet kan beoordelen.

## 5. Waar het bewijs staat

- 470 screenshots op 8 schermformaten: `artifacts/product-governor/fase1/7e2f1983/screenshots/`
- Alle rapporten: `reports/SPARKI_GOVERNOR_FASE1_*.md` + 4 CSV's
- Machineleesbare inventaris: `governance/*.json`

**Belangrijk:** er is niets hersteld, verplaatst of gewijzigd — dit was een pure meting. Alles gaat eerst naar ChatGPT voor beoordeling en prioritering; daarna bepaal jij wat we oppakken.
