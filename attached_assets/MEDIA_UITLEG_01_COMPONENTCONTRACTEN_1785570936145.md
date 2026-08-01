# MEDIA_UITLEG_01 — COMPONENTCONTRACTEN

**Deel 4 van 20** · voor CMP-40 t/m CMP-44

---

## 0. Vaste opbouw

Per component: doel · hergebruik · input · state · events · API · loading · fout · leeg · offline · rechten · toegankelijkheid · verminder beweging · lage bandbreedte · mobiel · desktop · analytics · audit · verboden gebruik · Mirror-acceptatie.

**Hergebruik is een F0-uitkomst.** Waar hieronder "bestaande component" staat, vult F0 in wélke. Replit vult dat niet zelf in.

Het componentcontract CMP-00 uit de componentbibliotheek geldt onverkort en wordt hier niet herhaald.

---

## CMP-40 — Diepte-/zweefkaart

**Doel** — een kaart of paneel subtiel laten loskomen van de achtergrond op een betekenisvol moment. Subtiele diepte, geen spektakel.

**Hergebruik** — breidt de bestaande kaartcomponent uit. Geen nieuwe kaart.

**Input** — inhoud van de kaart · moment-type (uit de toegestane lijst) · of diepte is toegestaan in de huidige context · of beweging is uitgeschakeld.

**State** — rust · aangeraakt · geopend.

**Events** — aanraking start · aanraking eindigt · openen · sluiten.

**API** — geen. Dit component haalt niets op.

**Loading** — skeleton in de vorm van de kaart, definitieve ruimte gereserveerd.

**Fout** — het diepte-effect faalt → de kaart is een gewone kaart met identieke functie. Geen foutmelding.

**Leeg** — een zweefkaart zonder inhoud bestaat niet; dan CMP-29.

**Offline** — geen invloed; diepte is weergave, geen data.

**Rechten** — geen eigen rechten; volgt de kaart die hij toont.

**Toegankelijkheid** — het effect verandert niets aan de leesvolgorde, de schermlezeruitvoer of het tikvlak.

**Verminder beweging** — geen kanteling, geen drukanimatie, direct de eindtoestand. Identieke functionaliteit.

**Lage bandbreedte** — geen invloed.

**Mobiel** — veilige schermranden; tikvlak ≥ 48 dp; kanteling alleen tijdens directe aanraking.

**Desktop** — zelfde gedrag bij hover en klik; geen extra effecten.

**Analytics** — alleen het gebruik van bewegingsreductie (E-1). Geen meting per kaart.

**Audit** — niet van toepassing.

**Verboden gebruik** — actieve navigatie · actieve training · acute veiligheidsmelding · medische waarschuwing · elk lijstitem · elk standaardformulier · filters · continue parallax · een tweede toepassing zonder besluit.

**Mirror-acceptatie** — geen beweging zonder aanraking · geen layoutshift · met beweging uit identiek bruikbaar · uitsluitend op het vrijgegeven moment · geen zware 3D-engine.

---

## CMP-41 — Toegankelijke mediaspeler

**Doel** — video of animatie tonen zonder dat iemand ervan afhankelijk wordt.

**Hergebruik** — F0 stelt vast of er al een videocomponent is. Zo ja: uitbreiden. Zo nee: één nieuwe, gedeelde speler.

**Input** — content-ID · contentversie · poster · lage-resolutievariant · volledige variant · ondertiteling · tekstalternatief · duur · of media laden is toegestaan op het huidige netwerk.

**State** — poster · gevraagd · laden · spelend · gepauzeerd · voltooid · fout · media ontbreekt · geblokkeerd door netwerkbeleid.

**Events** — starten · pauzeren · hervatten · opnieuw · snelheid wijzigen · positie wijzigen · voltooien · fout · tekstvariant openen.

**API** — media-URL opvragen (4.4) · status bijwerken (4.3) · gebeurtenis melden (4.5).

**Loading** — poster staat er direct; laadindicatie alleen binnen de speler.

**Fout** — eigen fouttoestand **binnen** de speler. Het onderliggende scherm blijft volledig bruikbaar. Tekstvariant blijft bereikbaar. Opnieuw proberen is een zichtbare keuze.

**Leeg** — media ontbreekt → de vier verplichte elementen, met de tekstvariant als eerstvolgende actie.

**Offline** — poster en tekstvariant; geen laadpoging die blijft draaien.

**Rechten** — entitlement en leeftijd worden server-side gecontroleerd vóór de URL wordt afgegeven.

**Toegankelijkheid** — ondertiteling · volwaardig tekstalternatief · elke knop uitspreekbaar · bedienbaar zonder fijne motoriek · geen informatie die alleen in beeld of geluid zit.

**Verminder beweging** — geen automatische overgangen rond de speler; de speler zelf blijft bruikbaar.

**Lage bandbreedte** — lage-resolutievariant aanbieden; gebruiker kiest zelf; scherm werkt volledig zonder dat de video ooit laadt.

**Mobiel** — geen autoplay · standaard geen videodownload via mobiele data, bewust per apparaat aan te zetten en later weer uit te schakelen · poster en tekstvariant blijven altijd beschikbaar · geen stille download of prefetch · bedieningsknoppen ≥ 48 dp.

**Desktop** — grotere speler, zelfde regels. Geen autoplay, ook niet op wifi.

**Analytics** — gestart · voltooid · fout · tekstvariant gebruikt · geblokkeerd door netwerkbeleid. Nooit inhoud.

**Audit** — niet van toepassing, behalve rechtenweigering (E-1).

**Verboden gebruik** — tijdens navigatie · actieve training · wedstrijddagmodus · onboarding · formulieren · acute of medische flows. Een spelende video pauzeert zodra zo'n situatie begint.

**Mirror-acceptatie** — geen autoplay in welke situatie dan ook · tekstvariant gelijkwaardig, geen samenvatting · mediafout blokkeert niets · afgebroken download eindigt in een keuze, niet in een eeuwige laadanimatie.

---

## CMP-42 — Uitlegflow

**Doel** — een functie in korte tijd begrijpelijk maken, op het moment dat de gebruiker die functie voor het eerst opent.

**Hergebruik** — bestaande eerste-keer-detectie en Help-omgeving, indien aanwezig (F0).

**Input** — content-ID · contentversie · schermversie waar de uitleg bij hoort · huidige status van de gebruiker · of er een actieve taak loopt.

**State** — niet aangeboden · vraag getoond · gestart · gepauzeerd · voltooid · overgeslagen · geblokkeerd (verouderde schermversie).

**Events** — vraag beantwoorden · starten · pauzeren · overslaan · voltooien · heropenen via Help · eerste actie uitvoeren.

**API** — inhoud opvragen (4.1) · status ophalen en bijwerken (4.2, 4.3) · media via CMP-41.

**Loading** — de vraag verschijnt pas als de uitleg beschikbaar is. Nooit een lege speler.

**Fout** — uitleg niet beschikbaar → de vraag verschijnt niet; de functie opent gewoon.

**Leeg** — geen uitleg voor dit scherm → geen vraag, geen icoon, geen lege plek.

**Offline** — geen uitleg aanbieden; de functie werkt zonder.

**Rechten** — uitleg over een functie die de gebruiker niet heeft, wordt niet aangeboden.

**Toegankelijkheid** — ondertiteling · zonder geluid volledig begrijpelijk · tekstvariant · pauzeren en overslaan altijd bereikbaar.

**Verminder beweging** — de uitleg zelf is media, niet animatie; de omlijsting beweegt niet.

**Lage bandbreedte** — tekstvariant wordt als eerste aangeboden; video is de keuze van de gebruiker.

**Mobiel** — richtwaarde 20 tot 45 seconden. **Geen harde afkap die begrip schaadt:** loopt de uitleg iets uit omdat de functie dat vraagt, dan is dat toegestaan en wordt de duur getoond.

**Desktop** — zelfde flow, grotere weergave.

**Analytics** — aangeboden · gestart · voltooid · overgeslagen · opnieuw geopend.

**Audit** — niet van toepassing.

**Verboden gebruik** — tijdens een actieve taak · automatisch starten · herhalen na "overgeslagen" · een nagebouwd of verouderd scherm tonen.

**Versievastheid** — de uitleg draagt de schermversie waarop hij is opgenomen. Komt die niet meer overeen met het huidige scherm, dan wordt de uitleg **geblokkeerd** en niet getoond. Verouderde uitleg is erger dan geen uitleg.

**Mirror-acceptatie** — begint met een vraag · eindigt met een echte, uitvoerbare hoofdactie · status wordt gerespecteerd · verouderde uitleg verschijnt niet.

---

## CMP-43 — Oefenkaart

**Doel** — één oefening zo tonen dat iemand hem veilig kan uitvoeren.

**Hergebruik** — bestaande oefenweergave indien aanwezig (F0 bevestigt of die bestaat).

**Input** — content-ID · contentversie · begin- en eindpositie · herhalingen of tijd · techniekpunten · veelgemaakte fouten · veiligheidswaarschuwing · leeftijdsclassificatie · media via CMP-41 · tekstvariant.

**State** — getoond · media spelend · afgevinkt.

**Events** — openen · media starten · afvinken · melden dat het pijn doet.

**API** — inhoud opvragen · status bijwerken.

**Loading** — tekstdeel eerst, media daarna (MUX-98).

**Fout** — media faalt → tekstvariant volledig bruikbaar.

**Leeg** — geen oefeninhoud → de kaart verschijnt niet.

**Offline** — tekstvariant beschikbaar, media niet.

**Rechten** — leeftijdsclassificatie en entitlement server-side gecontroleerd. Toewijzing aan een jeugdgroep gebeurt door de trainer of bevoegde beheerder, niet automatisch.

**Toegankelijkheid** — tekstvariant **functioneel gelijkwaardig**: wie hem leest, kan de oefening uitvoeren.

**Verminder beweging** — media blijft, omlijsting beweegt niet.

**Lage bandbreedte** — poster en tekst; video optioneel.

**Mobiel** — stopregel bij pijn permanent zichtbaar en niet weg te klikken.

**Desktop** — zelfde inhoud, ruimer.

**Analytics** — getoond · media gestart · afgevinkt. Nooit prestatiegegevens van de gebruiker.

**Audit** — toewijzing aan een minderjarige wordt vastgelegd: wie wees toe, wanneer.

**Verboden gebruik** — bij minderjarigen: 1RM-doelen · gewichtsdoelen · caloriebeperking · zware belastingvoorschriften. Voor iedereen: blessurerevalidatie zonder bevoegde professional. Nooit een medische diagnose.

**Mirror-acceptatie** — stopregel aanwezig · leeftijdsgeschiktheid afgedwongen · tekstvariant volstaat zonder media · geen ongecontroleerde revalidatie.

---

## CMP-44 — Zwevende coachmelding

**Doel** — een belangrijke maar **niet-acute** melding rustig presenteren.

**Hergebruik** — bestaande coachmeldingslaag indien aanwezig (F0).

**Input** — meldingstekst · reden · gebruikte gegevens · gemeten periode · onzekerheid · beschikbare acties · of de gebruiker minderjarig is · of er een actieve taak loopt.

**State** — niet getoond · getoond · uitgesteld · gesloten · niet meer tonen (waar toegestaan).

**Events** — tonen · actie kiezen · sluiten · uitstellen · niet meer tonen.

**API** — status bijwerken (4.3). De melding zelf komt uit de bestaande coachlaag.

**Loading** — geen. Een melding verschijnt volledig of niet.

**Fout** — onderliggende gegevens ontbreken → geen melding; alleen de reden waarom er niets te zeggen valt.

**Leeg** — geen melding betekent geen component in beeld.

**Offline** — geen coachmelding; er is geen actuele grond.

**Rechten** — geen gepersonaliseerd coachadvies over een kind aan de ouder; geen advies buiten de eigen rol.

**Toegankelijkheid** — geluid nooit de enige drager · sluiten met een tikvlak van 48 dp · schermlezer leest reden en onzekerheid mee.

**Verminder beweging** — verschijnt zonder animatie, op dezelfde plek.

**Lage bandbreedte** — geen invloed; de melding bevat geen media.

**Mobiel** — blokkeert nooit de primaire actie van het onderliggende scherm.

**Desktop** — zelfde inhoud, zelfde regels.

**Analytics** — getoond · actie gekozen · uitgesteld · gesloten. **Nooit de inhoud van de melding.**

**Audit** — een geweigerde `do_not_show_again` wordt gelogd (E-1).

**Verboden gebruik** — tijdens navigatie · training · wedstrijd · onboarding · formulier · elke acute flow. Geen automatische actie. Geen advies uit mock- of verzonnen persoonlijke gegevens.

**Acute en medische meldingen — buiten dit component.** CMP-44 is uitsluitend de **niet-acute** melding. Acute veiligheids- en medische meldingen blijven in hun **bestaande veiligheidslaag** en worden hier niet nagebouwd, overgenomen of vervangen.

Wat daar geldt en wat in F7 aantoonbaar wordt getoetst:
- acute en medische meldingen komen nooit via CMP-44 in beeld;
- ze krijgen geen diepte en geen speelse animatie;
- ze worden niet permanent onderdrukbaar;
- bij minderjarigen zijn ze niet negeerbaar waar de bestaande regels dat bepalen.

**Mirror-acceptatie** — reden, gegevens, periode en onzekerheid aanwezig · niet tijdens een actieve taak · geen automatische uitvoering · aantoonbaar dat acute en medische meldingen nooit via CMP-44 worden aangeboden en geen diepte-, video- of speelse animatielaag krijgen.

---

*Deel 4 van 20.*
