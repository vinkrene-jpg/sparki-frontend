# ROUTE_PAKKET — BOUWREEKS 01 TOT EN MET 02d

**Voor:** Replit
**Onderwerp:** pakketrechten, gebruikstelling en limieten voor routes en navigatie
**Grondslag:** Besluit René 31-07-2026
**Versie:** eindversie na kwaliteitsronde

Eén reeks, vijf opdrachten, in deze volgorde:

| Code | Onderwerp | Besluitnummer |
|---|---|---|
| `ROUTE_PAKKET_01` | Sleutels en poorten | `SPARKI-BESLUIT-2026-002` |
| `ROUTE_PAKKET_02a` | Telling van routegebruik | `SPARKI-BESLUIT-2026-003` |
| `ROUTE_PAKKET_02b` | Limiet en reserveringen | `SPARKI-BESLUIT-2026-003` |
| `ROUTE_PAKKET_02c` | Opslag, verval en downgrade | `SPARKI-BESLUIT-2026-003` |
| `ROUTE_PAKKET_02d` | Admininzicht en fair-usemeting | `SPARKI-BESLUIT-2026-003` |

**Poortregel.** Elke opdracht start pas nadat de vorige is afgerond **én** door Mirror is bewezen. Ze mogen in de wachtrij staan, maar niet achter elkaar door worden gebouwd zonder tussentijdse toets. Ze raken alle vijf dezelfde entitlement- en routelogica.

---

# GELDT VOOR ALLE VIJF

## Voorwaarde vooraf — testidentiteiten

Er moeten drie bruikbare testidentiteiten in DEV Preview zijn, met respectievelijk variant **gratis**, **`sparki_go`** en **`sparki_pro`**. Geen van drieën mag op `legacy_unrestricted` staan, want dan heeft het account alle rechten en bewijst geen enkele test iets.

Bestaan die drie identiteiten niet, of staan ze op legacy: **dan is het aanmaken ervan onderdeel van `ROUTE_PAKKET_01` en wordt het als eerste opgeleverd, vóór de rest van die opdracht.** Zonder deze drie kan Mirror geen enkele opdracht in deze reeks bewijzen.

## Werkregels

1. Blijf binnen de scope van de opdracht die je uitvoert. Niets vooruitbouwen.
2. Hergebruik bestaande architectuur. Geen parallel systeem, geen herschrijving van route-, navigatie-, export- of abonnementslogica, geen refactor zonder aantoonbare noodzaak.
3. Alle beslissingen server-side. Frontendwaarden zijn nooit leidend. Fail-closed.
4. Bij twijfel over een endpoint, een regel of een productkeuze: melden en stoppen, niet zelf beslissen.
5. Geen mock-, seed-, demo- of fallbackdata als echte gebruikersdata.
6. Nederlandse namen in de interface, technische sleutel klein erachter.
7. Meld eerlijk wat je niet hebt kunnen testen.

## Bestaande tests

Bestaande tests worden niet gewijzigd of verwijderd. Wordt een bestaande test onhoudbaar door een nieuwe regel, dan is dat een **bevinding** die je meldt, en geen wijziging die je zelf doorvoert.

Op deze regel bestaat in deze hele reeks precies één uitzondering, en die staat expliciet in `ROUTE_PAKKET_02b` benoemd.

## Bewijsformat

Geen verslag. Per regel: commando, resultaat, exitcode.

Standaard bij elke opdracht:
- de nieuwe of gewijzigde testset, met aantal groene tests
- `pnpm --filter @workspace/api-server run test:entitlements`
- `pnpm --filter @workspace/api-server run test:stripe-billing`
- de routetestset — noem welke je hebt gedraaid
- `pnpm run typecheck:libs` en de typecheck van api-server
- gewijzigde bestanden, gebruikte bestaande componenten en services, eventuele migratie
- de startcommit en de eindcommit

## Stopcondities

Stop en rapporteer, zonder te gokken, wanneer:
- de abonnementsstatus niet betrouwbaar server-side beschikbaar is;
- route-ID's niet stabiel zijn tussen plannen, opslaan, exporteren en navigeren;
- bestaande productiegegevens door een migratie verloren kunnen gaan;
- een noodzakelijke wijziging een grote architectuurherschrijving vereist.

## Tijdzone

Alle kalendermaanden, resets en vervaltermijnen gaan expliciet op **`Europe/Amsterdam`**. Niet UTC, niet de tijdzone van het apparaat.

---
---

# ROUTE_PAKKET_01 — SLEUTELS EN POORTEN

**Vervolg op:** commit `688503d7` (`SPARKI-BESLUIT-2026-001`)

## Doel

`GO_FEATURE_KEYS` is in de vorige opdracht bewust leeg gelaten. Deze opdracht vult de grens gratis/Go/Compleet in voor routes en navigatie, en niet verder.

Twee dingen moeten daarna aantoonbaar waar zijn: drie functies zitten achter een poort die er nu niet is, en zeven functies zijn en blijven gratis — bewaakt door een test, zodat ze er later niet per ongeluk achter schuiven. Dat tweede is geen bijzaak: de gratis routeplanner is de acquisitiestrategie.

## Buiten scope

Telling, limieten, opslagregels, vervaltermijnen, admin. Ook: routecollecties en bundels (besloten als add-on, die laag bestaat nog niet), en de functies met "basis gratis, volledig Go" — route-opmerkingen en route onderweg inkorten. Wat "basis" daar is, is nog niet gedefinieerd. Niet aanraken.

## Te bouwen

### 0. Testidentiteiten

Zie de voorwaarde vooraf. Ontbreken de drie identiteiten, dan lever je die eerst op, met vermelding van hun variant en de manier waarop Mirror ertussen wisselt.

### 1. Drie nieuwe sleutels

| Sleutel | Nederlandse naam | Hoort bij | Wat het afschermt |
|---|---|---|---|
| `route_library_manage` | Routebibliotheek beheren | **Go** | Opgeslagen routes beheren, zoeken en sorteren |
| `route_course_points` | Course points en wedstrijdinformatie | **Compleet** | Course points aanmaken en wedstrijdinformatie in een route (bevoorrading, gevaarlijke punten, technische gids) |
| `live_friends_map` | Vrienden en ploeg op de kaart | **Compleet** | Live positie van vrienden of ploeggenoten op de kaart |

`route_library_manage` gaat naar `GO_FEATURE_KEYS`, de andere twee naar `COMPLEET_FEATURE_KEYS`.

**Let op het type.** `CommercialFeatureKey` is nu een alias van `CompleetFeatureKey`. Dat klopt niet meer zodra Go eigen sleutels heeft. Maak er een unie van beide verzamelingen van en laat `requireCommercialFeature` daarop steunen. `GoFeatureKey` mag als alias blijven bestaan, maar mag niet langer "alle commerciële sleutels" betekenen.

**Superset blijft gelden.** Compleet (`sparki_pro`) krijgt Go plus Compleet. De invariant-test uit de vorige opdracht moet dat blijven bewaken, nu met een niet-lege Go-verzameling — precies het geval dat die test nog nooit echt heeft getoetst.

### 2. Poorten aanzetten

Zet `requireCommercialFeature` server-side op de endpoints achter deze drie sleutels. Geen recht is weigeren, niet stilzwijgend een lege lijst.

De frontend mag de knop verbergen of uitschakelen, maar de beslissing valt server-side. Een directe aanroep buiten de UI om krijgt dezelfde weigering.

Zoek de endpoints zelf op en noem ze met bestand en regelnummer. Kom je een endpoint tegen dat hier logisch bij hoort maar niet in de tabel staat: melden als open punt, niet zelf indelen.

### 3. Deze zeven blijven gratis, en dat wordt bewaakt

Schrijf een test die faalt zodra een van deze een commerciële poort krijgt:

1. Route plannen en genereren
2. Route aanpassen op afstand, tijd, wegtype, hoogte en wind
3. GPX exporteren
4. Afslag-voor-afslag navigatie in Sparki
5. Spraakaanwijzingen
6. Hoogteprofiel met schuifbalk
7. Een route bekijken

De test toont aan dat het endpoint bereikbaar is voor een account zonder enig commercieel recht — niet alleen dat er geen sleutel voor bestaat.

**Afbakening van deze test.** Hij bewaakt uitsluitend de afwezigheid van een **entitlement-poort** (`requireCommercialFeature`). Een weigering op grond van het maandquotum uit `02b` is géén overtreding van deze test. Voer hem daarom uit met een gratis account dat onder zijn quotum zit. Deze test blijft ongewijzigd geldig vanaf `01` tot en met `02d`.

### 4. 403-tekst corrigeren

De weigeringstekst zegt nu dat een functie "hoort bij Sparki Go". Voor `autonomous_training`, `race_intel`, `ai_observations` en `performance_lab` is dat sinds de vorige opdracht onjuist. Maak de tekst afhankelijk van de sleutel, zodat hij het juiste pakket noemt. Dit is zichtbaar voor gebruikers en hoort daarom hier, niet in een latere opruimronde.

## Privacy en veiligheid

Veiligheids- en gezondheidskritieke informatie valt nooit onder een commerciële poort. `live_friends_map` raakt locatiedeling: de bestaande toestemmingslaag blijft leidend en gaat vóór het abonnement. Een Compleet-abonnee zonder toestemming ziet niets.

## Extra bewijs

- `curl /api/entitlements` voor de drie testidentiteiten, met de sleutellijst per account
- Twee directe aanroepen op een gepoort endpoint: één zonder recht (verwacht: weigering), één met recht (verwacht: doorgang)

## Acceptatiecriteria

1. De drie testidentiteiten bestaan, staan niet op legacy, en Mirror kan ertussen wisselen.
2. Een gratis account kan de zeven functies uit §3 gebruiken en de drie uit §1 niet.
3. Een Go-account heeft daarbij `route_library_manage` en de twee Compleet-sleutels niet.
4. Een Compleet-account heeft alle vijf.
5. Weigering gebeurt server-side, niet alleen in de UI.
6. De 403-tekst noemt het juiste pakket.
7. Alle tests groen, typecheck exit 0.
8. Geen wijziging buiten routes en navigatie.

## Wat Mirror toetst

Inloggen als gratis, Go en Compleet en per rol vaststellen welke van de tien functies bereikbaar zijn; of de weigering ook geldt bij een directe aanroep buiten de UI om; of de weigeringstekst het juiste pakket noemt. Desktop en mobiel.

---
---

# ROUTE_PAKKET_02a — TELLING VAN ROUTEGEBRUIK

**Start pas na Mirror-goedkeuring van 01.**

## Doel

Bouw de telling. Alleen meten. Nog niets blokkeren, nog geen limiet, nog geen melding.

Na deze opdracht is aantoonbaar waar:
1. Elk routegebruik wordt server-side geregistreerd met een sluitende reden.
2. Dezelfde route telt maximaal één keer per kalendermaand, ongeacht hoe vaak of via welke weg.
3. Plannen, aanpassen en bekijken tellen nooit.
4. Er wordt gemeten voor **alle** pakketten en er wordt voor niemand iets geblokkeerd.
5. De teller is uitleesbaar.

Punt 4 is bewust: deze telling is straks ook de bron voor het meten van werkelijk functiegebruik. Later alsnog voor Go en Compleet gaan tellen is een migratie die je nu voor niets voorkomt.

## Buiten scope

De limiet en het blokkeren (02b), reserveringen (02b), meldingen aan de gebruiker (02b), opslaglimiet en vervaltermijn (02c), admin en fair use (02d). Een half aangelegde limiet die nog niet werkt is gevaarlijker dan geen limiet.

## Productregels

Een route telt als één gebruikte route zodra één van deze gebeurtenissen plaatsvindt:

| usageType | Gebeurtenis |
|---|---|
| `SAVED` | De route wordt definitief opgeslagen |
| `GPX_EXPORTED` | De route wordt succesvol als GPX geëxporteerd |
| `RIDDEN_20_PERCENT` | Minimaal 20% van de route is in Sparki gereden |

1. Plannen is onbeperkt en telt niet.
2. Routepunten verschuiven en herberekenen telt niet.
3. Bekijken telt niet.
4. Dezelfde route telt binnen dezelfde kalendermaand één keer. Opslaan én daarna exporteren is samen één. Exporteren én daarna 20% rijden is samen één.
5. Mislukte opslag telt niet. Mislukte export telt niet. Een rit onder 20% telt niet.
6. Een kopie of wezenlijk gewijzigde route krijgt een eigen route-ID en telt afzonderlijk.

Bij punt 6: leg vast hoe "wezenlijk gewijzigd" in de huidige architectuur wordt herkend en gebruik bestaande versie- of duplicatielogica. Bestaat die niet, dan is dat een bevinding — niet iets om zelf te verzinnen.

## De 20%-trigger staat apart

`RIDDEN_20_PERCENT` is technisch het moeilijkst en mag de rest niet gijzelen.

Bouw de registratie generiek over `usageType`. `SAVED` en `GPX_EXPORTED` zijn harde eis. Zet `RIDDEN_20_PERCENT` achter een operationele vlag die apart aan en uit kan.

Het percentage wordt berekend op **werkelijk afgelegde routeafstand** — de afstand die op de geplande route is gereden — en niet op verstreken tijd, aantal GPS-punten of totaal gereden kilometers.

Kun je dat niet betrouwbaar bepalen met de bestaande rit- en navigatiegegevens: zet de vlag uit, lever de andere twee op, en rapporteer wat er ontbreekt. De opdracht geldt dan alsnog als afgerond, met dat punt als expliciet restpunt. **Dit is geen stopconditie.** Ga niet gokken en bouw geen benadering die er precies genoeg uitziet.

**Testhaak.** Een rit tot een bepaald percentage is niet met de hand in DEV Preview te rijden. Lever daarom een gedocumenteerde manier op waarmee een rit tot een opgegeven percentage van een route kan worden gesimuleerd, bruikbaar door Mirror. Kan dat niet veilig — bijvoorbeeld omdat het productiepaden zou raken — dan is de 20%-trigger uitsluitend met unittests bewezen en meld je dat expliciet als beperking, met de reden.

## Te bouwen

### 1. Eén centrale registratiefunctie

Alle telling loopt server-side via één functie. Per registratie minimaal:

`userId` · `routeId` · `usageType` · `occurredAt` · `calendarMonth` (afgeleid in `Europe/Amsterdam`) · `subscriptionTier` op het moment van gebruik · `source` · `idempotencyKey`

`subscriptionTier` wordt bevroren zoals hij op dat moment was en niet later herrekend. Anders verandert de historie mee met een upgrade en is de meting achteraf waardeloos.

### 2. Idempotentie en gelijktijdigheid

- Een herhaald verzoek, een retry of een herladen telt niet dubbel.
- Twee gelijktijdige verzoeken voor dezelfde route leveren samen één registratie op. Los dat op met een **unieke sleutel in de database** op de combinatie gebruiker + route + kalendermaand, niet met een controle in applicatiecode.

### 3. Uitleesbare teller

Een server-side endpoint dat per gebruiker teruggeeft: de huidige kalendermaand, het aantal gebruikte routes, en de onderliggende registraties met `usageType` en tijdstip. Zonder dit kan Mirror niets vaststellen, dus dit hoort hier en niet in 02d.

### 4. Bestaande gegevens

- Bestaande routes, exports en ritten leiden **niet** met terugwerkende kracht tot registraties. De telling begint bij ingebruikname.
- Beschrijf expliciet hoe je met historische routes bent omgegaan.

### 5. Geen blokkade

Er wordt voor niemand iets geweigerd, verborgen of beperkt. Een gratis account dat vijftien routes gebruikt, gebruikt er vijftien en merkt niets. Dat is een acceptatiecriterium, geen tussenstand.

## Tests

1. Plannen telt niet.
2. Routepunten verschuiven en herberekenen telt niet.
3. Bekijken telt niet.
4. Succesvol opslaan telt één keer.
5. Mislukte opslag telt niet.
6. Succesvolle GPX-export telt één keer.
7. Mislukte GPX-export telt niet.
8. 19,9% gereden telt niet.
9. 20,0% gereden telt wel.
10. Opslaan en daarna exporteren van dezelfde route telt samen één keer.
11. Exporteren en daarna 20% rijden van dezelfde route telt samen één keer.
12. Een dubbele API-aanroep telt niet dubbel.
13. Twee gelijktijdige verzoeken leveren samen één registratie op.
14. Een nieuwe kalendermaand begint op nul.
15. Maandgrens: gebruik op 31 juli 23.30 uur Amsterdamse tijd valt in juli, op 1 augustus 00.30 uur in augustus — ook wanneer de server op UTC draait.
16. Mock-, seed- of fallbackdata beïnvloedt de telling niet.
17. Een Go-account en een Compleet-account worden ook geteld.
18. Een gratis account kan twaalf routes gebruiken zonder dat er iets wordt geblokkeerd. **Deze test geldt tot en met `02a` en wordt in `02b` gecontroleerd vervangen** — zie daar.
19. Een kopie of wezenlijk gewijzigde route telt afzonderlijk.
20. Met de 20%-vlag uit blijven tests 4 tot en met 7 en 10 groen.

Tests 8, 9 en 11 vervallen wanneer de vlag uitstaat; meld dat dan expliciet.

## Extra bewijs

Uitlezing van de teller voor de drie testidentiteiten na een reeks handelingen; stand van de 20%-vlag met motivatie; de gedocumenteerde testhaak of de reden waarom die er niet is; het API-contract van de tellerendpoint.

## Acceptatiecriteria

1. Opslaan, succesvolle export en (indien aan) 20% gereden leiden tot precies één registratie per route per kalendermaand.
2. Plannen, aanpassen en bekijken leiden nooit tot een registratie.
3. Dubbele en gelijktijdige verzoeken leiden niet tot dubbele registraties.
4. Maandgrenzen volgen `Europe/Amsterdam`.
5. Er wordt geteld voor alle drie de pakketten.
6. Er wordt voor niemand iets geblokkeerd, beperkt of gewaarschuwd.
7. De teller is uitleesbaar per gebruiker.
8. Alle tests groen, typecheck exit 0.
9. Geen wijziging buiten de telling.

## Wat Mirror toetst

Een gratis gebruiker plant vijf routes en verschuift punten — teller blijft nul. Bekijken — teller blijft staan. Eén route exporteren — teller 1. Dezelfde route daarna opslaan — teller blijft 1. Een tweede route opslaan — teller 2. Een route voor 10% rijden telt niet, voor 20% wel, uitgevoerd via de opgeleverde testhaak — vervalt wanneer de vlag uitstaat of de haak niet kon worden gebouwd. Go en Compleet worden ook geteld. Een gratis account gaat door tot twaalf gebruikte routes en wordt nergens geblokkeerd of gewaarschuwd. Geen mock- of demogegevens zichtbaar als echt gebruik. Desktop en mobiel.

## Documentatie

`docs/SPARKI_ROUTE_USAGE_LIMITS.md` — alleen het hoofdstuk telling.

---
---

# ROUTE_PAKKET_02b — LIMIET EN RESERVERINGEN

**Start pas na Mirror-goedkeuring van 02a.**

## Doel

Dwing de gratis maandlimiet af: maximaal 8 gebruikte routes per kalendermaand. Plannen, aanpassen en bekijken blijven onbeperkt, ook bij 8 van 8.

## Buiten scope

De opslaglimiet van 3 routes en de bewaartermijn van 30 dagen (02c). Admin en fair use (02d).

## Eén toegestane testvervanging

Test 18 uit `02a` — "een gratis account kan twaalf routes gebruiken zonder dat er iets wordt geblokkeerd" — wordt door deze opdracht onhoudbaar. Je mag hem vervangen door tests 1 tot en met 5 hieronder.

**Dit is de enige bestaande test die je in deze hele reeks mag wijzigen.** Elke andere bestaande test die onhoudbaar lijkt te worden is een bevinding die je meldt en niet zelf oplost. Vermeld in je oplevering expliciet dat je precies deze ene test hebt vervangen.

## Productregels

1. De limiet geldt **uitsluitend voor Gratis**. Go en Compleet worden nooit door deze limiet geraakt.
2. Bij 8 van 8 blijven plannen, aanpassen en bekijken volledig werken.
3. Bij 8 van 8 worden geblokkeerd: opslaan, GPX-exporteren en het definitief in gebruik nemen van een **nieuwe** route.
4. **Een route die deze maand al is geteld, blijft vrij bruikbaar.** Opnieuw exporteren of opnieuw rijden van een al getelde route levert geen nieuwe registratie op en mag dus ook niet worden geblokkeerd. De poort geldt alleen voor handelingen die een nieuwe registratie zouden opleveren.
5. **Navigatie bij 8 van 8:** het starten van navigatie op een route die deze maand nog niet is geteld wordt geweigerd, met dezelfde uitleg als bij opslaan en exporteren. Navigatie op een route die deze maand al is geteld blijft toegestaan en maakt geen reservering aan.
6. Er wordt gecontroleerd vóór: definitief opslaan, starten van een GPX-export, en starten van een navigatiesessie.

## Reserveringen

1. **Elke navigatiesessie op een nog niet getelde route reserveert**, ongeacht hoeveel routes de gebruiker nog over heeft. Niet alleen bij de laatste.
2. Reserveren gebeurt bij het starten van de navigatie, niet bij het plannen.
3. Een reservering wordt definitief omgezet in een registratie bij 20% gereden.
4. Een reservering wordt vrijgegeven wanneer: de rit eindigt onder 20%, de route niet daadwerkelijk is gestart, of de reservering technisch verloopt.
5. **Verlooptermijn: 12 uur** na het starten van de navigatie. Die moet ruimer zijn dan de langst denkbare rit; wijk hier alleen van af met motivatie.
6. Gelijktijdige sessies mogen samen nooit over de maandlimiet komen. Een reservering telt mee in de controle alsof hij al een registratie is.
7. **Staat de 20%-vlag uit** (zie 02a), dan wordt er bij navigatie niet gereserveerd en niet geblokkeerd — een reservering die nooit kan converteren zou anders elke gebruiker onterecht een route kosten. Meld dit gedrag expliciet.

## Meldingen

Toon bij Gratis:
- "Je hebt deze maand X van 8 routes gebruikt."
- "Plannen en bekijken blijft gratis."
- "Een route telt wanneer je hem opslaat, exporteert of minimaal 20% rijdt."

Bij 7 van 8: een rustige waarschuwing. Blokkeer nog niets.

Bij 8 van 8: een duidelijke uitleg van wat wel en niet meer kan, met het aanbod om naar Go te gaan. **Geen misleidende urgentie, geen aftelklok, geen vooraf aangevinkte aankoop.**

Go en Compleet zien deze teller en deze meldingen niet.

## Tests

1. Acht verschillende gebruikte routes zijn toegestaan.
2. De negende wordt geblokkeerd bij opslaan.
3. De negende wordt geblokkeerd bij exporteren.
4. Plannen van de negende route blijft mogelijk.
5. Aanpassen en bekijken van de negende route blijft mogelijk.
6. Een route die deze maand al geteld is, kan bij 8 van 8 nog steeds worden geëxporteerd en gereden.
7. Bij 8 van 8 wordt navigatie op een nog niet getelde route geweigerd.
8. Bij 8 van 8 blijft navigatie op een al getelde route werken en maakt die geen reservering aan.
9. Go wordt niet geblokkeerd bij twintig gebruikte routes.
10. Compleet wordt niet geblokkeerd bij twintig gebruikte routes.
11. Een navigatiesessie op een nog niet getelde route maakt een reservering aan.
12. Afbreken onder 20% geeft de reservering vrij en de teller stijgt niet.
13. 20% rijden zet de reservering om in één registratie.
14. Een reservering verloopt na 12 uur en geeft de plek vrij.
15. Twee gelijktijdige navigatiesessies bij nog één beschikbare route kunnen samen niet twee registraties opleveren.
16. Met de 20%-vlag uit wordt bij navigatie niet gereserveerd en niet geblokkeerd.
17. Een nieuwe kalendermaand heft de blokkade op.
18. De test uit `01 §3` blijft groen voor een gratis account onder zijn quotum.

## Acceptatiecriteria

1. Gratis wordt bij 8 van 8 geblokkeerd op opslaan, exporteren en navigeren van nieuwe routes, en op niets anders.
2. Plannen, aanpassen en bekijken werken onbeperkt door.
3. Al getelde routes blijven bruikbaar en navigeerbaar.
4. Go en Compleet worden nergens geraakt.
5. Reserveringen werken, verlopen en worden vrijgegeven.
6. Gelijktijdigheid kan de limiet niet omzeilen.
7. Meldingen kloppen en bevatten geen misleidende urgentie.
8. Precies één bestaande test is vervangen, en dat is test 18 uit `02a`.
9. Alle tests groen, typecheck exit 0.

## Wat Mirror toetst

Een gratis gebruiker gebruikt acht routes en ziet de teller oplopen; bij zeven verschijnt een rustige waarschuwing; bij acht wordt opslaan, exporteren en navigeren van een nieuwe route geweigerd met een duidelijke uitleg; plannen en bekijken werken nog; een al getelde route kan nog worden geëxporteerd en gereden; een navigatie die na 10% wordt afgebroken kost geen route; Go en Compleet zien geen teller en worden niet geblokkeerd. Daarnaast: controleren dat er precies één bestaande test is vervangen. Desktop en mobiel.

## Documentatie

`docs/SPARKI_ROUTE_USAGE_LIMITS.md` — hoofdstuk limiet en reserveringen. `docs/SPARKI_PACKAGE_GATES.md` bijwerken.

---
---

# ROUTE_PAKKET_02c — OPSLAG, VERVAL EN DOWNGRADE

**Start pas na Mirror-goedkeuring van 02b.**

> **Vóór start bevestigen door René:** wat er gebeurt met de routes boven de limiet bij een downgrade naar Gratis. Het voorstel hieronder is dat de gebruiker zelf drie routes kiest die hij houdt en de rest naar de vervallen-status gaat, herstelbaar. Niet bouwen voordat dit bevestigd is.

## Doel

Bouw de opslagregels voor Gratis: maximaal drie bewaarde routes, dertig dagen bewaartermijn, en een net verloop bij vervallen en bij downgrade.

## Productregels

1. Gratis mag maximaal **3 routes tegelijk bewaard** houden. Een vierde opslagpoging wordt geweigerd met een duidelijke uitleg en de keuze om een bestaande route te vervangen.
2. Een gratis bewaarde route vervalt na **30 dagen**.
3. Bij elke gratis bewaarde route is de resterende bewaartermijn zichtbaar.
4. **7 dagen** vóór vervallen krijgt de gebruiker een waarschuwing.
5. Vervallen is geen permanente verwijdering. De route gaat naar een herstelbare vervallen-status en blijft daar **30 dagen** staan voordat hij definitief wordt verwijderd. Documenteer die termijn.
6. Bij vervallen geldt één regel: **gedeelde links vervallen mee en de gebruiker wordt daar vooraf op gewezen; een navigatie die al is gestart blijft werken tot die rit is afgelopen.**
7. Een upgrade naar Go of Compleet vóór de vervaldatum behoudt de route, inclusief zijn historie.
8. Go en Compleet kennen geen opslaglimiet en geen vervaltermijn.
9. Bij downgrade naar Gratis wordt vooraf getoond welke routes buiten de limiet vallen en wat ermee gebeurt. **Niets wordt stilzwijgend verwijderd.** De gebruiker kiest zelf welke drie hij houdt; de rest gaat naar de vervallen-status met dezelfde hersteltermijn.
10. Bestaande echte opgeslagen routes blijven behouden. Voeg geen verzonnen voorbeeldroutes toe.

## Terugwaarts veilige vervalstatus

De vervallen-status is een **toegevoegd veld met een standaardwaarde die oudere code leest als normaal bewaard**. Bestaande waarden worden niet herschreven en er wordt geen bestaande kolom van betekenis veranderd.

Eis: het terugdraaien van `02c` mag geen enkele route onzichtbaar of onbereikbaar maken, ook niet routes die al in de vervallen-status stonden. Toon dat aan met een terugdraaitest.

## Vervaltaak start in rapportagestand

De geplande taak die routes laat vervallen draait **eerst uitsluitend in rapportagestand**: hij logt welke routes hij zou laten vervallen, van welke gebruiker en met welk pakket, en wijzigt niets.

Pas nadat die lijst is gecontroleerd — en aantoonbaar geen enkele route van een Go- of Compleet-gebruiker bevat — wordt de taak vrijgegeven om echt te wijzigen. De schakelaar tussen beide standen is expliciet en instelbaar.

## Samenhang met 02a en 02b

Opslaan telt als gebruik (02a) en kan bij 8 van 8 geblokkeerd zijn (02b). De opslaglimiet van 3 is een **aparte** grens die eerder kan bijten. Een gratis gebruiker kan dus bij 2 van 8 al tegen de opslaglimiet aanlopen. Beide meldingen moeten los van elkaar kloppen en mogen elkaar niet overschrijven.

## Tests

1. Maximaal drie gratis opgeslagen routes.
2. Een vierde opslagpoging wordt geweigerd met de keuze om te vervangen.
3. Vervangen werkt en laat het aantal op drie.
4. Een route vervalt na 30 dagen.
5. De waarschuwing verschijnt 7 dagen vooraf.
6. Vervallen zet de route in een herstelbare status en verwijdert hem niet.
7. Herstel binnen de hersteltermijn werkt.
8. Na de hersteltermijn is de route definitief weg.
9. Een gedeelde link van een vervallen route werkt niet meer, en dat is vooraf aangekondigd.
10. Een navigatie die vóór het vervallen is gestart, loopt door tot het einde van die rit.
11. Upgrade vóór de vervaldatum behoudt de route en de historie.
12. Go en Compleet hebben geen opslaglimiet en geen vervaltermijn.
13. Downgrade verwijdert geen routes zonder waarschuwing.
14. Downgrade toont welke routes buiten de limiet vallen en laat de gebruiker drie kiezen.
15. De opslaglimiet en de maandlimiet geven onafhankelijke, kloppende meldingen.
16. De vervaltaak in rapportagestand wijzigt niets en levert een leesbare lijst op.
17. De vervaltaak selecteert geen enkele route van een Go- of Compleet-gebruiker.
18. Na terugdraaien van `02c` zijn alle routes nog zichtbaar en bereikbaar, ook die in de vervallen-status stonden.

## Acceptatiecriteria

1. Drie bewaarde routes bij Gratis, netjes geweigerd bij de vierde.
2. Bewaartermijn zichtbaar, waarschuwing op tijd.
3. Vervallen is herstelbaar en gedocumenteerd.
4. De regel over gedeelde links en lopende navigaties werkt zoals beschreven.
5. Downgrade verliest niets stilzwijgend.
6. Go en Compleet ongemoeid.
7. De vervaltaak heeft in rapportagestand gedraaid en is pas daarna vrijgegeven.
8. De terugdraaitest is uitgevoerd en toont geen verlies.
9. Alle tests groen, typecheck exit 0.

## Wat Mirror toetst

Een gratis gebruiker bewaart drie routes en krijgt bij de vierde een nette keuze; de resterende bewaartermijn is zichtbaar; een route vlak voor vervallen toont de waarschuwing; een vervallen route is terug te halen; een gedeelde link van een vervallen route werkt niet meer; een upgrade behoudt alles; bij downgrade kiest de gebruiker zelf. Daarnaast: de rapportage van de vervaltaak lezen en vaststellen dat er geen Go- of Compleet-routes in staan, vóórdat de taak wordt vrijgegeven. Desktop en mobiel.

## Documentatie

`docs/SPARKI_ROUTE_USAGE_LIMITS.md` — hoofdstuk opslag en verval.

---
---

# ROUTE_PAKKET_02d — ADMININZICHT EN FAIR-USEMETING

**Start pas na Mirror-goedkeuring van 02c.**

## Doel

Maak zichtbaar wat er wordt geteld, en leg de meting aan waarmee later een fair-usedrempel kan worden gekozen. Nog geen drempel, nog geen blokkade.

## Routeberekeningen zijn nieuw bouwwerk

Routeberekeningen worden op dit moment **nergens geregistreerd**. Deze opdracht legt die instrumentatie zelf aan, op het plan- en herberekenendpoint. Dat is bouwwerk, geen weergave van bestaande gegevens.

Dat pad is het enige in deze hele reeks dat onbeperkt en gratis moet blijven. Daarom gelden twee harde eisen:

- Plannen en herberekenen worden door deze meting **niet trager** en kunnen er **nooit** door worden geweigerd. Faalt de registratie, dan gaat de berekening gewoon door.
- Draai de volledige routetestset **vóór en ná** deze wijziging en lever beide resultaten op.

## Admininzicht

Per gebruiker, uitsluitend voor beheerders en server-side afgeschermd:

- gebruikte routes per kalendermaand
- aantal opgeslagen routes en hun vervaldatums
- telling per `usageType`
- openstaande reserveringen
- registraties die dubbel of verdacht lijken
- routeberekeningen per dag en per maand

**Geen knop die zonder bevestiging alle tellingen wist.** Een correctie op een individuele registratie mag, met vastlegging van wie het deed en waarom.

## Fair-usemeting

Uitsluitend meten en loggen. Fair use blokkeert in deze opdracht niemand en is voor gebruikers onzichtbaar.

Meet minimaal: routeberekeningen per gebruiker per dag en per maand · abnormale pieken · herhaalde identieke berekeningen · patronen die op geautomatiseerd of scriptmatig gebruik wijzen.

## Privacy

Dit is gedragsdata over gebruikers. Leg vast welke velden worden bewaard en hoe lang. **De bewaartermijnen zijn nog een open besluit** (besluit G-3 uit het meetdossier): stel een termijn voor, bouw hem in als instelbare waarde, en leg de keuze aan René voor. Niet zelf definitief vaststellen.

Verzamel niet meer dan nodig is om de drempel te kunnen kiezen.

## Tests

1. Adminweergave is niet bereikbaar zonder beheerdersrecht, ook niet via een directe aanroep.
2. De getallen in de adminweergave komen overeen met de teller van de gebruiker zelf.
3. Routeberekeningen worden geteld en horen niet bij de gebruikte routes.
4. Een correctie op een registratie wordt vastgelegd met wie en waarom.
5. Er bestaat geen route om alle tellingen in één handeling te wissen.
6. Fair-usemeting blokkeert niemand.
7. De bewaartermijn is instelbaar en niet hardgecodeerd.
8. Een mislukte registratie van een routeberekening blokkeert de berekening niet.
9. De routetestset is vóór en ná de instrumentatie gedraaid en geeft hetzelfde resultaat.

## Acceptatiecriteria

1. Beheerders zien de volledige telling per gebruiker; anderen niets.
2. Fair use wordt gemeten en gelogd, en blokkeert niets.
3. De query's en de weergave waarmee het gebruiksbeeld ontstaat zijn opgeleverd en werken. **Met de huidige gegevens is een lege of vrijwel lege uitkomst het verwachte resultaat en geen bevinding.** Er wordt geen voorbeelddata toegevoegd om de weergave gevuld te laten lijken.
4. Plannen en herberekenen zijn niet trager geworden en worden nergens geweigerd.
5. Bewaartermijnen zijn instelbaar en als besluit aan René voorgelegd.
6. Alle tests groen, typecheck exit 0.

## Wat Mirror toetst

Een niet-beheerder komt er niet in, ook niet via een directe aanroep. De cijfers voor één testgebruiker kloppen met wat die gebruiker zelf ziet. Fair-usemeting is voor een gewone gebruiker nergens zichtbaar en blokkeert niets. Plannen en herberekenen werken onveranderd. De gebruiksweergave is leeg of vrijwel leeg, en bevat geen voorbeeldgegevens.

## Documentatie

`docs/SPARKI_ROUTE_USAGE_LIMITS.md` — hoofdstuk admin en fair use. `docs/SPARKI_MIRROR_ROUTE_USAGE_TEST.md` afronden met de volledige testset over alle vijf opdrachten.

---
---

# OPENSTAANDE BESLUITEN

| Besluit | Blokkeert | Stand |
|---|---|---|
| Wat gebeurt er bij downgrade met routes boven de limiet | `02c` | Voorstel ligt er: gebruiker kiest drie, rest herstelbaar vervallen |
| Bewaartermijn van gebruiks- en fair-usegegevens (G-3) | `02d` afronden | Open; Replit doet een voorstel, René beslist |
| Fair-usedrempel | Nog niets | Bewust open tot er meetgegevens zijn |
| Wat "basis gratis, volledig Go" betekent bij route-opmerkingen en route onderweg inkorten | Een latere opdracht | Open; niet in deze reeks |
