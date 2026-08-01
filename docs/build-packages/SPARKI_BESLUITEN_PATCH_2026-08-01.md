# SPARKI_BESLUITEN_PATCH_2026-08-01

Aanvulling op `SPARKI_BUILD_01` t/m `04`. De pakketten zelf worden niet herschreven; dit document geldt ernaast en gaat vóór bij tegenspraak.

Bron: de besluiten die René op 1 augustus 2026 heeft genomen, ná het opstellen van de vier pakketten.

---

## A. Wat vervalt of wijzigt in de bestaande BB-regels

| Regel | Stond er | Wordt |
|---|---|---|
| **BB-11** | een trainer kan niet aan een jeugdgroep worden gekoppeld zonder verplichte VOG-status | de VOG-eis geldt **alleen bij jeugd en bij structurele rollen**. Bij het onboarden voegt clubbeheer alleen trainers met VOG toe en vinkt dat zelf aan, mét afgiftedatum. Een verlopen VOG (na drie jaar) **waarschuwt**, blokkeert niet. Een eendaagse helper wordt als **gast** toegevoegd en heeft geen VOG nodig |
| **BB-42** | `race_assignments` is een aparte structuur naast de rennerselectie | de wedstrijdbezetting leeft in de **uitgebreide `club_race_selections`**, niet in een aparte tabel |
| **BB-47** | v1 blijft één wedstrijddag per evenement; meerdaagse volgt later | **meerdaagse wedstrijden en etappekoersen komen nu mee**. Een wedstrijd krijgt begin- en einddatum met etappes |
| **BB-48** | Team €149 mag pas publiek na aantoonbare meerwaarde boven Club | de rechtvaardiging is **betalingsbereidheid**, niet een functieverschil: clubs draaien op vrijwilligers en lage budgetten, teams hebben budget en betalen voor gemak. De F12-toets blijft bestaan als productvrijgave, maar hoeft geen functioneel verschil te bewijzen |
| **BB-14** | bij minderjarigen geen gewichts- of caloriedoelen | strenger: **geen jeugdvoedingsadviezen, punt.** Geen artikelen, geen ongevraagde adviezen. Een directe vraag van een jeugdlid krijgt wél antwoord, maar **zonder getallen** — geen calorieën, macro's of gewichtsdoelen. Voeding zit verder in het Trainer-abonnement van €99 |
| **BB-06** | labels 1–4 mogen per rol verschillen; betekenis niet | aanvulling: voor iemand met een clubrol vervangt **Club** de positie **Analyse** |
| **BB-64** | per onderneming één doorlopende factuurreeks | blijft, met toevoeging: **Sparki beheert de nummering** en moet kunnen starten vanaf een opgegeven beginnummer, omdat de trainer al facturen buiten Sparki kan hebben |
| **BB-65** | de trainer is verantwoordelijk voor het tarief | blijft, met toevoeging: **Sparki rekent standaard 21%**; de kleineondernemersregeling overschrijft die standaard |

---

## B. Pakket 01 — fundament, veiligheid en toegang

**Jeugd en toestemming**
- ouderlijke toestemming mag worden gezet door de **gekoppelde ouder óf door de club namens een geregistreerde ouder**. Geen gedoogperiode. De minderjarige zelf blijft geblokkeerd (al gebouwd)
- **gelaagde leeftijdsgrenzen 16 en 18**, niet één grens op 18. Onbekende geboortedatum = strengste regime
- een minderjarige mag **niet** alles voor zijn ouder afschermen: gezondheid en herstel blijven altijd zichtbaar. `dataSharingParent = "none"` mag bij een minderjarige dus niet alles dichtzetten
- wordt een jeugdlid 18, dan **stopt de ouderkoppeling automatisch**. Trainer en sporter krijgen een week vooraf bericht. De koppeling met de trainer blijft wel bestaan; alleen het delen van adviezen valt uit en de sporter beslist opnieuw
- wordt de ouderkoppeling verbroken, dan blijft wat de ouder zag **in de historie bij het kind**
- de ouderomgeving komt **ook native in de mobiele app**

**Rollen**
- elke bestaande rolwaarde krijgt een **eigen startscherm** (bevestigt BB-08). Een eerlijk leeg scherm mag, terugval op de atleetweergave niet
- **teammanager staat boven ploegleider**: hij kan alles wat de ploegleider kan, plus overrulen. De ploegleider kan een overrule niet terugdraaien en krijgt er bericht van met zichtbaar wat er veranderde. Alleen bij wedstrijden
- een vrijwilliger of meekijkrol ziet **niets** tot hij ergens aan is toegewezen
- Club en Team komen in de hoofdnavigatie onderin voor wie een clubrol heeft
- rechten volgen de rol, niet het abonnement. Eén persoon mag tegelijk zelfstandig trainer zijn én een club draaien binnen hetzelfde account

**Rolwisselaar**
- de actieve context is **permanent zichtbaar op elk scherm**
- het zoekveld verschijnt vanaf **meer dan vijf** contexten
- rolwisselen mag **tijdens de wedstrijddagmodus altijd**, zonder bevestigingsstap
- een trainer met meerdere groepen krijgt **geen** groepsoverstijgende context
- een ouder met meerdere kinderen krijgt **wel** één overzicht over alle kinderen, met rechtencontrole per kind
- wordt een rol ingetrokken, dan blijft onafgemaakt werk **bij de organisatie**

**Club**
- herhalende trainingen worden voor een **heel seizoen** vooruit vastgelegd
- alleen **clubbeheer** mag clubdocumenten plaatsen (gedragscode, ouderafspraken, reglement)
- bij clubberichten mag **alles** als bijlage mee, video inbegrepen
- een vertrouwenscontactpersoon is **niet verplicht** voor jeugdinstroom
- alleen clubbeheer ziet welke stafleden geen geregistreerde VOG hebben
- mechanieker en soigneur zien van een renner **uitsluitend naam en of hij rijdt** — geen noodinformatie, geen fysieke aandachtspunten
- `medical_staff` deelt met de ploegleider **uitsluitend inzetbaar ja/nee**
- trainingskamp en clubactiviteit worden een **aparte entiteit**, geen soort wedstrijd

---

## C. Pakket 02 — werkobjecten

**W-B1 = A: er komt één gedeelde werkobjectlaag voor het hele product.** Het principe "één plan waar iedere rol zijn eigen deel van ziet" geldt ook voor trainingsweken, materiaalplannen en ouderbriefingen.

**Levenscyclus, zoals René hem beschreef:** de ploegleider activeert een plan en zet de lijnen uit · de staf vult het eigen onderdeel aan · iedereen kan opmerkingen achterlaten · het wordt definitief gemaakt en gedeeld · en blijft daarna aanpasbaar.

- elk plan heeft **verplicht een status**: concept, gedeeld, afgerond
- een afgerond plan mag alleen de **ploegleider** nog wijzigen
- de **ploegleider deelt**, ook elke gewijzigde versie. Geen automatische notificatie — hij is in de zichtbare hiërarchie de baas op wedstrijddag. *Overweging van René: mogelijk later een knop voor automatisch opnieuw delen*
- bij het eerste delen krijgt **alleen de staf** bericht, niet de renners
- bij elk deel is zichtbaar **wie het invulde, met datum en tijd**
- de volledige wijzigingsgeschiedenis is **alleen voor de ploegleider** terug te kijken
- of staf elkaars deel mag aanpassen bepaalt de ploegleider, **per wedstrijd**
- wijzigen twee mensen tegelijk hetzelfde deel, dan **waarschuwt** Sparki
- **opmerkingen mogen door iedereen**, ook renners, en zijn alleen zichtbaar binnen het onderdeel waar ze bij horen
- een renner vult zijn eigen deel aan (bijvoorbeeld een materiaalwens); daarvan krijgt **alleen de ploegleider** bericht
- taken zijn **verplicht afvinkbaar** door degene die ze heeft; de ploegleider krijgt daar bericht van
- verlaat een staflid de club, dan blijft alles wat hij schreef staan
- een plan is **kopieerbaar** naar een volgende wedstrijd: alleen de vaste onderdelen, niet de bezetting. Een club kan daarnaast een eigen **sjabloon** vastleggen
- **offline gaat uit de eerste versie** en komt bij een tweede update. Dan geldt: alles wat je opent werkt offline, en offline is **alleen-lezen**

---

## D. Pakket 03 — wedstrijd- en teamoperatie

**Structuur**
- **één wedstrijd voor iedereen**: `club_race_events` wordt gekoppeld aan `races`, zodat een door de ploegleider aangemaakte wedstrijd meteen in de eigen wedstrijdomgeving van de renner verschijnt
- de bezetting leeft in de uitgebreide `club_race_selections` (vervangt BB-42)
- een parcours koppelen is **optioneel**; `club_race_events` krijgt daarvoor het ontbrekende `routeId`
- ook de teammanager mag een wedstrijd aanmaken; de **ploegleider vult hem verder in** en is eindverantwoordelijk voor het plan
- Sparki legt **geen norm** vast voor minimale bezetting — de ploegleider bepaalt dat zelf. Een onvolledige bezetting mag gedeeld worden, met waarschuwing
- een vervanger voor de ploegleider is **optioneel**, wordt **handmatig geactiveerd door de teammanager** (of door de ploegleider zelf als er geen teammanager is), mag alles wat de ploegleider mocht, en de hele ploeg krijgt bericht. Komt de ploegleider terug, dan gaat het automatisch weer naar hem. Na afloop is niet meer zichtbaar dat er een vervanger is geweest

**Conflicten**
- v1 detecteert **uitsluitend persoonsdubbeling** — niet onbeschikbaarheid, niet onvolledige bezetting
- dezelfde renner op twee wedstrijden op één dag: **waarschuwen**, niet blokkeren. Idem voor twee wedstrijden met dezelfde ploegleider, twee taken op hetzelfde tijdstip, en meer renners dan autoplaatsen
- bij afmelding voor een wedstrijd schuift de reserve **niet** automatisch door — de ploegleider doet dat zelf

**Noodinformatie**
- zichtbaar voor **ploegleider, teammanager en `medical_staff`** — uitdrukkelijk niet voor mechanieker en soigneur
- **altijd** zichtbaar, niet alleen rond de wedstrijddag
- inzage wordt gelogd **voor alle drie**; de sporter of ouder ziet **wie er keek en wanneer**; het log blijft zolang de koppeling loopt
- het vrije veld `availabilityNote` wordt afgeschermd zodat medische redenen daar niet meelekken

**Dagschema en logistiek**
- een dagschema is **optioneel**, maar als het er is: **per persoon**, met verplichte vertrektijd en verzamelpunt. Terugkeertijd optioneel
- begint de wedstrijd later, dan verschuift het hele schema mee — de **ploegleider bevestigt** dat voor het naar buiten gaat. Daarna krijgt de **hele ploeg**, inclusief renners, bericht
- een staflid ziet ook de tijden van de anderen
- vervoer wordt **per voertuig** ingedeeld, met wie bij wie meerijdt. Chauffeur aanwijzen is optioneel. Een renner ziet de hele indeling
- materiaal per renner is optioneel; de **mechanieker** vult de lijst en kan een **eigen sjabloon** vastleggen. Materiaal is afvinkbaar bij inladen; de ploegleider ziet dat, en bij vertrek met openstaande punten volgt een waarschuwing
- staan er bij vertrek nog taken open: waarschuwing

**Taken, briefings en opdrachten**
- taakverdeling is optioneel; **ploegleider en teammanager** wijzen toe; een tijdstip is optioneel
- een staflid mag een taak **weigeren, met reden**. De ploegleider krijgt bericht en de taak blijft open staan
- een briefing per rol is optioneel, hoeft niet bevestigd te worden, en stafleden zien elkaars briefings
- een opdracht per renner (kopman, knecht, vrije rol) is optioneel. **Iedereen ziet elkaars opdracht**, ook reserves. De ploegleider mag ze op de dag zelf wijzigen; de renner krijgt direct bericht. De oorspronkelijke opdracht wordt niet bewaard

**Wedstrijdgids en technische gids** *(toegevoegd 01-08-2026, besluit René)*
- **ploegleider én teammanager** kunnen bij een wedstrijd de wedstrijdgids of technische gids uploaden (PDF/document)
- Sparki haalt daar met de bestaande documentanalyse de informatie uit voor het **wedstrijdplan**: parcours, start- en finishlocatie, tijdschema, bevoorrading, reglementaire punten
- wat uit de gids komt is voor de **hele ploeg** zichtbaar in het wedstrijdplan, met bronvermelding (welke gids, welke pagina waar dat kan)
- de bestaande eerlijkheidsregels gelden onverkort: gevonden/afgeleid/ontbrekend blijft zichtbaar, Sparki verzint niets bij; en de bestaande regel blijft staan dat de technische gids **geen course points lekt zonder Compleet-recht**
- dit is dezelfde analyse-motor als bij de renner zelf — één keer gebouwd, twee ingangen

**Na afloop**
- uitslag per renner is optioneel, wordt **handmatig ingevoerd** door ploegleider of renner, komt ook in de persoonlijke wedstrijdhistorie, en is voor **iedereen** zichtbaar
- een ploegevaluatie is optioneel, **iedereen mag erin schrijven**, iedereen ziet elkaars bijdragen, en hij **sluit een week na de wedstrijd** — daarna alleen leesbaar. Geen herinnering vooraf, geen verlenging

**Gasten**
- een eendaagse helper wordt als **gast** toegevoegd door ploegleider of teammanager, die daarbij apart aanvinkt dat hij verantwoordelijk is
- toegang via **e-mail of link**, geen account nodig. De link **vervalt na de wedstrijd** en kan tussentijds worden ingetrokken. Gebruik wordt niet geteld
- de gast ziet **het hele plan**. Toegang verdwijnt direct na de wedstrijddag. In de historie blijft zichtbaar dat er een gast was
- een gast kan ook voor een meerdaagse wedstrijd worden toegevoegd

**Mobiel**
- de wedstrijddagmodus is **app-only**, voor ploegleider én teammanager

---

## E. Pakket 04 — trainer en facturatie

**Prijzen**
- Sparki Trainer **€99 p/mnd · €990 p/jr tot 25 sporters**, inclusief training, analyse én voeding
- tweede staffel **€179 p/mnd · €1.790 p/jr tot 50 sporters**
- daarboven **€9,90 per sporter per maand**, vast bedrag zonder staffelkorting, direct ingaand bij sporter 51
- zakt hij onder de 25, dan loopt de hogere tier tot het einde van de periode door
- een sporter telt mee zolang de **koppeling** bestaat, niet of hij nog traint

**Koppelingen**
- een sporter mag aan **meerdere trainers tegelijk** gekoppeld zijn. Die trainers zien elkaars schema's niet en een nieuwe trainer ziet niet dat de sporter eerder bij iemand anders liep. De sporter ziet zelf wél beide schema's naast elkaar. Beide trainers tellen hem mee in hun limiet
- plannen twee trainers op dezelfde dag een zware training, dan waarschuwt Sparki — **alleen de sporter** ziet dat
- koppelen aan een sporter die al bij een andere trainer loopt: waarschuwen, niet blokkeren
- een nieuwe trainer ziet de historie **alleen vanaf het moment van koppeling**
- **beide partijen** mogen verbreken. Beide krijgen bericht, zonder reden erbij. Daarna ziet de trainer direct niets meer; hij houdt alleen wat hij zelf maakte, de sporter houdt de schema's. De oude koppeling blijft in beider historie zichtbaar. Opnieuw koppelen vraagt opnieuw akkoord
- stopt de trainer met Sparki, dan kan de **sporter zelfstandig door** — geen alleen-lezen, geen afsluiting

**Facturatie**
- **T-8:** de begeleidingsovereenkomst tussen trainer en klant moet in Sparki **digitaal ondertekend** kunnen worden

**Clubafname (nieuw, staat in geen enkel pakket)**
- een club kan **Compleet afnemen voor haar leden**, en kiest **per lid**
- de sporter krijgt bericht en **mag weigeren**; weigert hij, dan stopt de betaling direct en telt dat als **zelf opzeggen**
- had de sporter zelf al Compleet, dan neemt de club het over en wordt het **resterende deel terugbetaald**
- bij een jeugdlid moet de **ouder akkoord geven** en mag hij namens het kind weigeren
- de club ziet **alleen aantallen** — niet welke leden gebruiken, niet wie weigerde
- maandelijkse facturatie met **staffelkorting in vaste tredes**. Toevoegen kan maandelijks; Compleet gaat **direct** in maar wordt pas de volgende maand verrekend
- stopt de club, dan houden de leden het nog **één maand**, met bericht vooraf
- dit vraagt een **scheiding tussen betaler en gebruiker** in de facturatie, die vandaag nergens bestaat

---

## F. Productbreed

**Gratis en Compleet**
- gratis: **acht routes** en **twintig AI-vragen** per maand, uit twee aparte potjes. Compleet: onbeperkt
- de kennisartikelen zitten **alleen in Compleet**; de AI-vraagfunctie is **gratis** en geeft hetzelfde antwoord als voor een betalende gebruiker, met een verwijzing naar het artikel

**Bij verlopen abonnement**
- zegt de **club** op, dan blijft alles bewaard **en zichtbaar**
- zegt de sporter **zelf** op, dan wordt het **afgeschermd** maar bewaard zolang het account bestaat. Hij ziet dát er iets is afgeschermd. Gaat hij later weer betalen, dan komt **alles** terug

**Bewaartermijnen**
| Gegeven | Termijn |
|---|---|
| trainingsgegevens na opzegging account | één jaar |
| toestemmingen en gegevens jeugdlid | zolang het kind lid is |
| clubauditlog | drie jaar, ook na verwijdering van de club |
| vertrokken clublid zichtbaar bij de club | zes maanden |
| clubberichten en reacties | één jaar |
| routes en ritgegevens | zolang het account bestaat |
| wedstrijdplannen | blijven in archief |
| inzagelog noodinformatie | zolang de koppeling loopt |

**Verwijderen**
- accountverwijdering: **dertig dagen** bewaard, met bericht op het moment van verwijderen. Binnen die termijn terugkomen geeft alles terug. Direct definitief verwijderen kan ook
- een club die haar omgeving verwijdert: **ook dertig dagen**, geen directe optie. Leden krijgen vooraf bericht en hun **eigen gegevens blijven bestaan**; gedeelde wedstrijdplannen verdwijnen wel. De clubomgeving blijft daarna in een **archief** raadpleegbaar voor de beheerder
- bij verwijdering krijgen zowel club als individuele sporter een **uitdraai**

---

## G. Intelligentielaag

**Bronnen en conflicten**
- **O-2 beslist:** bij conflicterende waarden wint de **bron die de gebruiker zelf instelt**, bij de eerste koppeling. Achteraf wijzigbaar, geldt alleen voor nieuwe ritten
- afwijkingen worden daarna **stil verwerkt** — de AIE-regel "conflicterende bronnen worden getoond, niet stil samengevoegd" wordt hierop aangepast
- komt dezelfde rit via Strava én Garmin binnen, dan **vraagt Sparki het aan de gebruiker**. De niet-gekozen rit blijft onbeperkt bewaard
- **O-3 beslist:** per brontype wordt ingesteld hoe lang een gegeven bruikbaar blijft. Een oudere meting mag gebruikt worden, met waarschuwing

**Adviezen**
- Sparki kan **altijd** tonen waarop een advies is gebaseerd
- bij te weinig gegevens **adviseert** Sparki met voorbehoud in plaats van te zwijgen. Het voorbehoud staat achter een doorklik — **behalve bij gezondheid en herstel, daar direct in beeld**
- **bij minderjarigen zwijgt Sparki wél** bij te weinig gegevens over gezondheid en herstel
- oude adviezen zonder onderbouwing worden eerlijk als zodanig benoemd
- Sparki blijft bij trainingsbelasting en herstel. Gezondheidssignalen zijn **observatie met doorverwijzing**, nooit een vaststelling — om buiten de MDR-kwalificatie als medisch hulpmiddel te blijven. Dit is een **harde Mirror-toets**: geen enkele gezondheidsmelding mag een vaststelling doen

**Delen met de trainer**
- de trainer ziet **uitsluitend wat de sporter deelt**. Eén schakelaar, standaard uit, en de trainer krijgt bericht als hij aangaat
- de trainer mag **reageren**, en die reactie staat bij het advies zelf
- zet de sporter delen uit, dan verdwijnen de gedeelde adviezen **en de reacties** direct
- bij een minderjarige beslist de **ouder**, en het kind moet **ook zelf** akkoord geven. De ouder ziet die adviezen en alle reacties van de trainer

**Signalen**
- slechte herstelwaarden bij een geplande rit: **waarschuwen**, ook bij minderjarigen
- structureel te hard trainen: **direct melden**. Naar de trainer alleen als delen aanstaat; naar de **ouder altijd**, ook als delen uitstaat. De sporter ziet dat het is verstuurd, en een jeugdlid weet **vooraf** dat bepaalde signalen altijd naar zijn ouder gaan. De ouder ziet precies dezelfde melding, bij minderjarigen zachter geformuleerd voor het kind zelf

**Wetenschapscontrole**
- Sparki controleert **dagelijks** of inzichten zijn herzien, aangevuld of vervangen, op een **vaste bronlijst** in twee lagen (zie `SPARKI_WETENSCHAPSBRONNEN_01`)
- een onderwerp moet **meervoudig bevestigd** zijn. Experimenteel onderzoek wordt getoond als "mogelijk interessant"; bewezen onderzoek wordt **voorgesteld** — Sparki past adviezen niet zelfstandig aan
- voor de gebruiker is zichtbaar wanneer een advies op herzien inzicht is aangepast

---

## H. Kennis, media en mobiel

**Kennisinhoud**
- Sparki **schrijft zelf**, met **altijd een bron** erbij en een verplichte datum van laatste bijwerking
- jeugdinhoud wordt apart gemarkeerd voor training en materiaal
- **niemand toetst vooraf** — daarom geen jeugdvoedingsinhoud (zie A, BB-14)
- een jeugdlid dat zelf een eetvraag stelt krijgt antwoord **zonder getallen**
- de ouder ziet **niet** welke vragen zijn kind stelt; die blijven bewaard in het account van het kind

**Media en Academy**
- uitrollen zodra de fietsketen bewezen is (`KETEN_FIETS_01`), niet na de clubmodules

**Mobiele app**
- **alle rollen** komen in de app, inclusief trainer, en **allemaal bij de eerste release**
- elke rol krijgt in de app **hetzelfde als in de browser**; de browser blijft naast de app bestaan
- clubbeheer op de telefoon is optioneel, geen eis
- **app-only:** navigeren tijdens de rit en de wedstrijddagmodus
- de app hoeft bij release **niet in de stores** — de eerste release is feitelijk een test, dus een webapp volstaat
- **beslispunt voor Replit:** komen app en browser uit één codebasis of worden ze apart gebouwd? Met alle rollen native én een blijvende browserversie is één gedeelde codebasis vrijwel de enige haalbare route

**Wandelen**
- uitrollen zodra de fietsketen bewezen is. Dit vervangt de eerdere startvoorwaarde "Mirror-goedkeuring van reeks 01–02d"

---

## I. Release

- de minimale eerste publieke versie is **alles**
- **geen gesloten pilot** — direct open
- **betaald vanaf dag één**
- René beschouwt die eerste release feitelijk als een **test**

---

## J. Nog te beslissen

1. de drempel voor "meervoudig bevestigd" in de wetenschapscontrole — twee of drie onafhankelijke bronnen
2. wie een voorstel goedkeurt voordat een bestaand advies wijzigt
3. of afgekeurde wetenschapssignalen bewaard blijven, zodat dezelfde studie niet elke week terugkomt
4. het beginnummer van de factuurreeks per trainer
5. of de zeven vastgelegde bewaartermijnen overeenkomen met de zes lege configuratiewaarden in de code
