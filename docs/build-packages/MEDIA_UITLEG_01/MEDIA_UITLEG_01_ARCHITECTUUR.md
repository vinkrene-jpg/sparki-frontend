# MEDIA_UITLEG_01 — ARCHITECTUUR

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Deel 2 van 20** · hoort bij `README.md`

---

## A. Presentatielaag

**A-1 Eén gedeelde motionconfiguratie.** Alle beweging in de app komt uit één configuratie: duurklassen, easing, maximale verplaatsing, maximale kanteling, en de schakelaar die alles uitzet. Geen component definieert eigen beweging.

**A-2 Eén mediaspeler.** Eén implementatie voor alle video en animatie in de app (CMP-41). Geen tweede speler per module.

**A-3 Eén uitlegflow.** Eén implementatie voor productuitleg (CMP-42), aangeroepen met een content-ID. Geen uitlegvariant per scherm.

**A-4 Eén oefenkaartcontract.** Eén weergave (CMP-43), gevoed door `KENNIS_01`.

**A-5 Eén coachmeldingcontract.** Eén weergave (CMP-44). **CMP-44 presenteert uitsluitend niet-acute coachmeldingen.** Acute veiligheids- en medische meldingen blijven volledig onderdeel van de bestaande veiligheidslaag. `MEDIA_UITLEG_01` bouwt daarvoor geen variant, regime of alternatief meldingspad. Mirror bewijst dat acute en medische meldingen nooit via CMP-44 worden aangeboden en geen diepte-, video- of speelse animatielaag krijgen.

**A-6 Web, PWA en mobiel.** Dezelfde componenten, dezelfde contracten. Verschillen tussen PWA en browser worden in F0 vastgesteld en in de betrokken fase expliciet benoemd; ze leiden nooit tot een tweede component.

**A-7 Desktop.** Dezelfde componenten met meer ruimte: langere tekst, grotere speler, meer items naast elkaar. Nooit andere functionaliteit, nooit een functie die alleen op desktop bestaat.

**A-8 Geen inhoud in schermcomponenten.** Een scherm vraagt om een content-ID; het bevat geen tekst, geen lijst met oefeningen en geen verwijzing naar een bestand.

---

## B. Contentbinding

**B-1** De weergavelaag verwijst naar `KENNIS_01`-contentrecords. Zij haalt op; zij bewaart niets inhoudelijks.

**B-2 Altijd samen ophalen:** content-ID **en** contentversie. Een scherm dat alleen een ID kent, kan niet vaststellen of het nog om dezelfde inhoud gaat.

**B-3 Filtercriteria bij het ophalen:** taal · doelgroep · rol · pakkettoegang · mediatype · scherm of functie.

**B-4 De weergavelaag toont alleen wat `KENNIS_01` als gepubliceerd én rechten-gecontroleerd aanlevert.** Alles anders bestaat niet voor de gebruiker.

**B-5 Ontbrekende velden zijn een blokkade, geen invulopdracht.** Ontbreekt de ondertiteling of het tekstalternatief, dan wordt de content niet getoond — de weergavelaag genereert er geen.

**B-6 Versiewissel.** Wijzigt de contentversie, dan mag de uitleg gecontroleerd opnieuw worden aangeboden. "Gecontroleerd" betekent: alleen wanneer de wijziging inhoudelijk is, en nooit vaker dan één keer per versie.

---

## C. Gebruikersstatus

**C-1 Toestanden:** aangeboden · gestart · bekeken · voltooid · overgeslagen · uitgesteld · opnieuw geopend · niet meer tonen (waar toegestaan).

**C-2 Aanvullend bewaard:** laatste positie in de media · gekozen afspeelsnelheid · of beweging is verminderd.

**C-3 Server-side.** De status wordt op de server bewaard. Lokaal wordt niets als bevestigd getoond zonder serverantwoord (MUX-55).

**C-4 Per gebruiker, nooit gedeeld.** Cross-account voortgang is een directe herstelgrond.

**C-5 Historie blijft herleidbaar.** Overslaan wist niet dat er ooit is aangeboden.

**C-6 Geen fictieve voortgang.** Geen "je hebt 40% bekeken" wanneer dat niet gemeten is.

---

## D. Levering

**D-1 Opslag.** Media staat in objectopslag of CDN, niet in de repository. F0 stelt vast wat er al is.

**D-2 Beveiligde URL** waar de content niet openbaar mag zijn. Openbaar deelbare uitleg mag een gewone URL hebben.

**D-3 Caching en versie-invalidatie.** De cachesleutel bevat de contentversie, zodat een nieuwe versie niet achter een oude blijft hangen.

**D-4 Drie varianten per mediabestand:** poster · lage resolutie · volledige resolutie. Ontbreekt de poster, dan wordt de media niet gepubliceerd.

**D-5 Downloadbeleid mobiele data — definitief vastgelegd.**
- Standaard **geen** videodownload via mobiele data.
- De gebruiker kan dit **bewust per apparaat** toestaan.
- De instelling is later weer uit te schakelen.
- Poster en de volledige tekstvariant blijven altijd beschikbaar, ook zonder toestemming.
- **Geen stille download en geen prefetch** via mobiele data, in geen enkele situatie.

**D-6 Lazy loading.** Media laadt pas wanneer het in beeld komt én de gebruiker het start. Geen vooraf ophalen "voor de zekerheid".

---

## E. Logging

**E-1 Wat gelogd wordt:** technische mediafout · ontbrekende media · voltooiing · overslaan · rechtenweigering · leeftijdsweigering · licentieblokkade · voorkomen autoplay · gebruik van bewegingsreductie.

**E-2 Wat nooit gelogd wordt:** persoonlijke gezondheidsinhoud · de inhoud van een coachmelding · een medische reden · vrije tekst van de gebruiker.

**E-3 Doelgebonden en minimaal.** Elke meting heeft een vastgelegd doel. Geen meting "omdat het kan".

**E-4** Uitgewerkt in `..._RAPPORTAGE.md`.

---

## F. Motion- en dieptestandaard

Eén centrale technische standaard. Zolang `BRAND_IDENTITY_01` niet definitief is, worden **geen merkkleuren en geen exacte visuele stijl** vastgelegd — alleen gedrag.

### F-1 Animatiecategorieën

| Categorie | Waarvoor | Toegestaan |
|---|---|---|
| **Verschijnen** | een element komt in beeld | alleen na een gebruikershandeling of een noodzakelijke statusovergang |
| **Drukken** | reactie op aanraking | altijd, kort |
| **Openen** | detail of scherm opent | na een gebruikershandeling |
| **Diepte** | subtiel loskomen van de achtergrond | alleen op de vastgelegde momenten van CMP-40 |

Er is geen vijfde categorie. Wat hier niet in past, wordt niet geanimeerd.

### F-2 Duurklassen

Drie klassen: **kort** (reactie op aanraking), **normaal** (verschijnen en openen), **traag** (alleen waar een overgang anders onbegrijpelijk wordt). Exacte waarden worden in F1 vastgelegd in de configuratie en zijn daarna niet per component aanpasbaar.

### F-3 Easing

Eén in-easing en één out-easing voor de hele app. Geen stuiter, geen overshoot, geen veereffect.

### F-4 Grenzen

- Maximale verplaatsing bij verschijnen: klein genoeg om niet als "vliegen" te lezen.
- Maximale kanteling bij diepte: subtiel; merkbaar bij aanraking, onopvallend zonder.
- **Maximaal twee gelijktijdig bewegende elementen** in beeld. Meer betekent onrust.

### F-5 Geen beweging zonder aanleiding

Geen animatie zonder gebruikershandeling, behalve een noodzakelijke statusovergang (bijvoorbeeld: een taak wordt afgerond en verplaatst zichtbaar). Geen continue parallax, geen ademende kaarten, geen bewegende achtergrond.

### F-6 Uitzetten

- `prefers-reduced-motion` uit het systeem wordt gerespecteerd.
- De appinstelling Verminder beweging werkt onafhankelijk daarvan.
- Bij uitgeschakelde beweging verschijnt **direct de eindtoestand**. Niet een snellere animatie, niet een andere layout.
- **Geen functieverlies, geen aparte inferieure variant** (R-A).

### F-7 Verboden plaatsen

Geen beweging of diepte bij: medische of acute inhoud · standaardlijsten · filters · formulieren · actieve navigatie · actieve training · wedstrijddagmodus · onboarding.

### F-8 Budget

- Geen zware 3D-engine. De bestaande stack wordt hergebruikt; wat er niet in zit, wordt niet toegevoegd zonder expliciet besluit.
- Batterij- en GPU-verbruik blijven binnen wat een gemiddeld toestel aankan; F9 en F10 meten dit.
- **Graceful degradation:** kan het toestel de beweging niet vloeiend tonen, dan valt het terug op de eindtoestand — niet op een haperende animatie.

### F-9 Geen layoutshift

Elke overgang reserveert de definitieve ruimte vooraf (MUX-93d). Laat geladen media mag niets verschuiven — dat is een directe herstelgrond.

---

*Deel 2 van 20.*
