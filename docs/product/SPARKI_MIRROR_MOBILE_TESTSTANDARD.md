# SPARKI — MIRROR MOBILE TESTSTANDAARD v1.0

> **Vaste werkinstructie:** `docs/product/MIRROR_WERKWIJZE_01.md` (MW-01 t/m MW-20) geldt
> automatisch mee bij elke Mirror-opdracht: rapporteer herstelpunten aan Replit,
> samenhangvragen aan Claude, René krijgt per pakket één regel in gewone taal;
> nooit stilstaan, niets zelf oplossen.
>
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


**Technische code:** `MOBILE_UX_STANDARD_01` — oplevering 5 van 5
**Hoort bij:** `SPARKI_MOBILE_UX_STANDARD_v1.4.md` · `SPARKI_MOBILE_COMPONENT_LIBRARY.md` · `SPARKI_ROLE_BASED_MOBILE_FLOWS.md` · `SPARKI_MOBILE_PATTERNS.md`
**Status:** BINDEND, afgeleid. Geen nieuwe MUX-, CMP- of PAT-codes. Geen productbesluiten.
**Datum:** 1 augustus 2026

---

## 0. Waarvoor dit document dient

Mirror toetst of de mobiele belofte van een bouwpakket werkelijk waargemaakt is. Niet of het scherm er goed uitziet, en niet of de knop reageert — maar of de gebruiker in die rol, op die telefoon, onder die omstandigheden, kan doen wat het pakket belooft.

**Testcodes.** `MTS-nn`. Iedere bevinding verwijst naar een MTS-code én naar de onderliggende MUX-, CMP- of PAT-code (MUX-95d). Een bevinding zonder code is niet toetsbaar en gaat terug naar de indiener.

**Vaste SHA.** Mirror toetst uitsluitend op een vaste, gepushte commit-SHA. Wijzigt de code tijdens de toets, dan vervalt de toets.

**Onafhankelijk.** De implementeerder mag testen, maar niet als enige goedkeuren. Mirror toetst zelfstandig en levert bewijs per scenario.

---

## 1. Toetsprincipes

**MTS-01 — Echt toetsen, niet responsief bekijken.** Een scherm dat op een smalle browserbreedte "goed oogt", is niet getoetst. De toets gebeurt op een telefoonformaat, met de rolomgeving die erbij hoort (MUX-80).

**MTS-02 — Per flow, niet per scherm.** De eenheid van toetsing is de keten: functie → hoofdtaak → vervolgstap → einde (MUX-88e, MUX-99e). Een scherm dat los voldoet en in de keten doodloopt, zakt.

**MTS-03 — Realistisch gevuld account.** Een leeg testaccount bewijst niets. Getoetst wordt op het zwaarste realistische geval: volle wedstrijddag, volledige groep, lang seizoen (MUX-94f, MUX-98h).

**MTS-04 — Trage verbinding hoort bij de toets.** Elk pakket wordt minimaal één keer doorlopen op een merkbaar trage verbinding (MUX-98h).

**MTS-05 — Twee schermgroottes.** De kleinste ondersteunde breedte (360 dp) en een grote telefoon (MUX-81, punt 1).

**MTS-06 — Echt account per rol.** De rol wordt getoetst met een account dat die rol werkelijk heeft, niet met een beheerdersaccount dat "doet alsof" (MUX-81, punt 2).

**MTS-07 — Geen mockdata.** Aantreffen van voorbeeld-, placeholder- of demogegevens in een echte omgeving is een directe herstelgrond, ongeacht de rest van de uitkomst (MUX-51).

**MTS-08 — Cumulatief oordeel.** Voldoet elk scherm los maar is het geheel onbruikbaar, dan is de uitkomst afkeuring. Technisch binnen de norm en in de praktijk onbruikbaar telt als tekortkoming (MUX-94g).

---

## 2. Toetsomgeving

| Onderdeel | Eis |
|---|---|
| Schermbreedtes | 360 dp en een grote telefoon |
| Oriëntatie | staand; liggend alleen waar het pakket dat expliciet belooft |
| Netwerk | normaal · merkbaar traag · geen verbinding · herstel na geen verbinding |
| Accounts | één per betrokken rol, met echte toewijzing; plus één rol zonder toewijzing voor MTS-20 |
| Data | realistisch gevuld, en één lege rolomgeving voor MTS-20 |
| Tekstgrootte | standaard en 200% |
| Onderbreking | inkomend gesprek of app-wissel tijdens een meerstapstaak |
| Handschoenen | vereist bij elk pakket dat de wedstrijddagmodus raakt |
| Verboden | mockdata, demo-accounts met verzonnen namen, screenshots als bewijs zonder bijbehorende stappen |

---

## 3. De achttien toetsdimensies

Iedere mobiele toets dekt deze achttien. Wat niet van toepassing is, wordt expliciet als zodanig vastgelegd — niet stilzwijgend overgeslagen.

**MTS-09 — Schermgroottes.** Beide breedtes, geen afgesneden tekst, geen onbereikbare knoppen.
*Zakt bij:* inhoud die op 360 dp buiten beeld valt of de primaire actie bedekt.

**MTS-10 — Rol.** Getoetst met een echt account in de betrokken rol.
*Zakt bij:* toetsing met een account dat de rol niet werkelijk heeft.

**MTS-11 — Klikbare productbelofte.** Is de belofte van het pakket op de telefoon uitvoerbaar, niet alleen zichtbaar.
*Zakt bij:* een functie die alleen te bekijken is waar het pakket uitvoeren belooft.

**MTS-12 — Beloftetoets.** Levert elke knop wat zijn naam belooft (MUX-81a, PAT-08).
*Zakt bij:* "Route bewaren" die niet bewaart; "Trainer uitnodigen" waarbij geen uitnodiging aankomt; een half werkende functie die toch als knop staat.

**MTS-13 — Hervatten.** Taak overleeft onderbreking en opent met een zichtbare regel waar de gebruiker was (MUX-42, MUX-64, PAT-06).
*Zakt bij:* verlies van ingevulde gegevens, of stilzwijgend opnieuw beginnen.

**MTS-14 — Lege toestanden.** Alle van toepassing zijnde toestanden uit MUX-49, elk met de vier verplichte elementen (MUX-48, PAT-03).
*Zakt bij:* een lege toestand zonder verantwoordelijke of zonder eerstvolgende actie; "geen open acties" gebracht als storing.

**MTS-15 — Offline.** Alleen een gestarte navigatie loopt door; al het overige meldt eerlijk (MUX-53, MUX-54, PAT-12).
*Zakt bij:* een actie die offline als geslaagd wordt getoond. Dit is de zwaarste afkeurgrond van de standaard.

**MTS-16 — Herstel na verbinding.** Automatisch opnieuw ophalen, vier zichtbare uitkomsten, benoemen wat bij gedeeltelijk succes ontbreekt, geen dubbele poging, geen stille achtergrondactie (MUX-53a, PAT-13).
*Zakt bij:* stil bijwerken, of een tweede synchronisatie naast een lopende.

**MTS-17 — Notificatie tot actie.** Melding → deeplink → actie werkelijk uitvoerbaar (MUX-63, MUX-65).
*Zakt bij:* een melding die naar een overzicht leidt waar de gebruiker nog moet zoeken.

**MTS-18 — Tikvlakken en contrast.** ≥ 48 dp met 8 dp tussenruimte, ≥ 64 dp in de wedstrijddagmodus, contrast ≥ 4,5:1, status nooit alleen met kleur, bruikbaar bij 200% tekstgrootte (MUX-24, MUX-25, MUX-66 t/m MUX-69).
*Zakt bij:* status die alleen aan kleur te herkennen is — met name bij rode vlaggen en beschikbaarheid.

**MTS-19 — Geen doodlopende flow.** Elke flow eindigt met vervolgstap of zichtbare terugweg (MUX-88, PAT-27).
*Zakt bij:* een bevestigingsscherm met alleen een kruisje; een foutmelding zonder uitweg. Systeem-terug telt niet mee.

**MTS-20 — Rolintroductie.** Bij eerste login en lege rolomgeving: rol, context, mogelijkheden, wat ontbreekt, één eerste actie (MUX-100, PAT-02).
*Zakt bij:* een generiek welkom; een lege omgeving zonder verklaring; verzonnen namen.

**MTS-21 — Eerste bruikbare interactie.** Kernbediening werkt vóór de zware laag, op een gevuld account en een trage verbinding (MUX-98, PAT-01).
*Zakt bij:* de kernactie wacht op secundaire data; een zwaar onderdeel laadt eerst; de knop verspringt als de rest arriveert.

**MTS-22 — Volledige keten.** Functie benoemt zijn hoofdtaak en heeft een vervolgstap (MUX-99, PAT-08).
*Zakt bij:* een detail- of analysescherm zonder vervolg; een inspiratiepagina zonder uitgang.

**MTS-23 — Geen verrassingen.** Niets verschuift, verdwijnt of wisselt onaangekondigd; invoer gaat nooit verloren (MUX-93, PAT-11).
*Zakt bij:* de lijst ververst tijdens het tikken; een item verdwijnt stil omdat een recht is ingetrokken.

**MTS-24 — AI-gedrag.** Adviseert, voert niets uit zonder bevestiging, onderbreekt niet, onderbouwt altijd (MUX-89 t/m MUX-92, PAT-19 t/m PAT-21).
*Zakt bij:* een AI-melding tijdens navigatie, training, wedstrijd, onboarding of formulier; een advies zonder waarom, welke gegevens en welke onzekerheid; een voorstel dat na verloop van tijd alsnog is uitgevoerd.

**MTS-25 — Wedstrijddagmodus.** Van toepassing bij elk pakket dat de modus raakt: knopmaat, één regel tekst, geen invoer, bediening met handschoenen, geen storende meldingen, eerlijk offline (MUX-96, PAT-22 t/m PAT-25).
*Zakt bij:* een noodhandeling die zonder verbinding stil faalt (MUX-96h). Dit is een directe herstelgrond zonder herstelruimte binnen de toets.

**MTS-26 — Prestatiedoelen.** Eerste bruikbare informatie eerst, elke tik reageert onmiddellijk, vertraging wordt benoemd, nooit een zwart gat — getoetst op het zwaarste scherm (MUX-94).
*Zakt bij:* een scherm dat pas iets toont als de traagste bron klaar is.

**MTS-27 — Toegestane gegevens.** De rol ziet alleen wat hij mag zien (rolflowdocument, kolom "verboden informatie"; PAT-18).
*Zakt bij:* gezondheidsgegevens buiten de medische rol; gegevens van een andere organisatie of een ander kind; onderliggende medische gegevens bij de ploegleider in plaats van alleen de geschiktheidsuitkomst.

---

## 4. Antipatroonsweep

Naast de dimensies loopt Mirror de antipatronen uit `SPARKI_MOBILE_PATTERNS.md` af. Ze staan daar niet ter illustratie maar als zoeklijst: dit zijn de oplossingen die vanzelf ontstaan als niemand oplet.

**MTS-28 — Verplichte sweep.** Minimaal deze zeven worden bij elk pakket actief gezocht:

| Zoek naar | Patroon | Waarom dit er altijd in sluipt |
|---|---|---|
| Scherm wacht tot alles klaar is en toont dan alles tegelijk | PAT-01 | het voelt netjes |
| Detail- of analysescherm zonder uitgang | PAT-08 | zo'n scherm ziet er áf uit |
| Lijst ververst zichzelf tijdens het tikken | PAT-11 | wordt nooit gemeld, altijd onthouden |
| Lokale "verzonden"-bevestiging zonder server | PAT-12 | komt pas aan het licht als het ertoe deed |
| Kern weggestopt achter een uitklapregel | PAT-26 | het scherm oogt rustiger |
| "Gelukt!" met alleen een kruisje | PAT-27 | de taak is af, de gebruiker staat stil |
| Per rol een eigen menu | PAT-15 | logisch bij het bouwen van één rol |

**MTS-29 — Sweepverslag.** Per gezocht antipatroon: gevonden of niet gevonden, met de plek. "Niet actief gezocht" is geen geldige uitkomst.

---

## 5. Rolgerichte toetsflows

**MTS-30 — Rolflow.** Voor elke betrokken rol wordt de rolspecifieke toetslijst uit `SPARKI_ROLE_BASED_MOBILE_FLOWS.md` hoofdstuk 3 uitgevoerd. Die lijst is per rol al opgesteld en wordt hier niet herhaald.

**MTS-31 — Vaste vier per rol.** Bovenop de rolspecifieke lijst geldt voor elke rol:

1. Klopt het eerste scherm met MUX-76a.
2. Klopt de primaire hoofdtaak, en is er precies één primaire actie.
3. Klopt de eerste bruikbare interactie (MTS-21).
4. Is de rolintroductie aanwezig bij een lege omgeving (MTS-20).

**MTS-32 — Meervoudige rol.** Ten minste één toets met een account dat twee rollen heeft: de plattegrond blijft identiek, de contextwissel is zichtbaar, en de gegevens van beide contexten worden nooit gemengd (MUX-14, MUX-62, PAT-15, PAT-17).

**MTS-33 — Ouderrol.** Waar het pakket het jeugd- of ouderdomein raakt: mobiel alleen-lezen-eerst, met toestemming geven en afwezigheid melden als enige toegestane schrijfacties (MUX-04).

**MTS-34 — Centrale rolwaarde.** De rol wordt herkend via de centrale rolwaarde uit `CLUB_RECHTEN_01`. Een pakket dat een eigen rolbegrip of een tweede rechtenlaag introduceert, wordt afgekeurd ongeacht de rest.

---

## 6. Componenttoets

**MTS-35 — Contract eerst.** Voor ieder gebruikt component wordt eerst CMP-00 getoetst (dertien eisen), daarna het component zelf. Een component dat het contract niet haalt, wordt niet verder beoordeeld.

**MTS-36 — Geen eigen componenten.** Een component dat niet in het register van `SPARKI_MOBILE_COMPONENT_LIBRARY.md` staat, is een afwijking en heeft productgoedkeuring van René nodig (MUX-84). Zonder besluitnummer: afkeuring.

**MTS-37 — Verbodenlijst.** Hoofdstuk 9 van de componentbibliotheek wordt afgelopen: ongevraagde popup, hamburgermenu als hoofdnavigatie, FAB naast een vaste actiebalk, functie alleen via swipe, lege toestand met alleen een illustratie, foutmelding met techniek, lokale bevestiging zonder server, AI-melding op een verboden moment, AI-advies zonder onderbouwing.

---

## 7. Afkeurgronden

**MTS-38 — Directe afkeur.** Onafhankelijk van de rest van de uitkomst. Voor pakketten met mediacomponenten geldt MTS-69 aanvullend:

1. Een noodhandeling die zonder verbinding stil faalt (MUX-96h).
2. Een actie die offline als geslaagd wordt getoond (MUX-55).
3. Voorbeeld-, placeholder- of demogegevens in een echte omgeving (MUX-51).
4. Een rol die gegevens ziet die hij niet mag zien (hoofdstuk 5, MTS-27).
5. Een eigen rolbegrip of tweede rechtenlaag (MTS-34).
6. Een AI die zonder toestemming een handeling uitvoert (MUX-89).

**MTS-39 — Afkeur na weging.** Afkeurend, tenzij het pakket aantoont dat het geval niet van toepassing is:

- lege toestand zonder de vier elementen (MUX-48);
- technische foutmelding (MUX-52);
- verloren taak na onderbreking (MUX-42, MUX-64);
- doodlopende flow (MUX-88);
- knop die niet levert wat zijn naam belooft (MUX-81a);
- functie zonder hoofdtaak of vervolg (MUX-99);
- scherm dat onaangekondigd verandert (MUX-93);
- kernactie geblokkeerd door secundaire data (MUX-98);
- zwaar onderdeel dat laadt vóór de bruikbare interactie (MUX-98);
- rolomgeving die leeg opent zonder verklaring (MUX-100);
- AI-melding tijdens navigatie, training, wedstrijd, onboarding of formulier (MUX-90);
- AI-advies zonder onderbouwing (MUX-91).

---

## 8. Uitkomst en rapportage

**MTS-40 — Statuswoorden voor een bouwpakket.** `PROVEN_READY` · `BUILT_UNPROVEN` · `PARTIAL` · `OPEN` · `DEFERRED` (MUX-83). Gebouwd zonder mobiele Mirror-toets is `BUILT_UNPROVEN` — niet "waarschijnlijk goed".

**MTS-41 — Statuswoorden voor een documentpakket.** Een goedgekeurd documentpakket krijgt `MIRROR_PROVEN`; de implementatie blijft `OPEN` tot die apart is getoetst; daarna geeft René `RENE_APPROVED`. Documenttoetsing gebruikt niet `PROVEN_READY`.

**MTS-42 — Bewijs per scenario.** Per dimensie: wat is gedaan, op welke SHA, met welk account, onder welke netwerkconditie, en wat de uitkomst was. Een uitkomst zonder stappen is geen bewijs.

**MTS-43 — Bevindingssjabloon.** Iedere bevinding bevat:

| Veld | Inhoud |
|---|---|
| MTS-code | welke toets dit betrof |
| MUX/CMP/PAT-code | welke regel, component of patroon geschonden is |
| Rol en context | met welk account en in welke situatie |
| SHA | de vaste commit |
| Omstandigheid | schermbreedte, netwerk, tekstgrootte |
| Waargenomen | wat er gebeurde |
| Verwacht | wat de regel voorschrijft |
| Zwaarte | directe afkeur (MTS-38) of afkeur na weging (MTS-39) |

**MTS-44 — Geen vrije omschrijvingen.** Waar een code bestaat, wordt die gebruikt. Een bevinding als "de lege schermen zijn onduidelijk" wordt teruggelegd bij de indiener (MUX-95d, MUX-95e).

**MTS-45 — Niet van toepassing is een uitkomst.** Een dimensie die niet van toepassing is, wordt met reden vastgelegd. Stilzwijgend overslaan maakt de hele toets ongeldig.

---

## 9. De poort

**MTS-46 — Wanneer mag een pakket door.** Alle achttien dimensies uitgevoerd of gemotiveerd niet van toepassing · geen directe herstelgrond · geen openstaande bevinding uit MTS-39 zonder besluit · antipatroonsweep uitgevoerd met verslag · bewijs per scenario aanwezig op één vaste SHA.

**MTS-47 — Volgorde.** Toetsen gebeurt ná bouwen en vóór vrijgave van het volgende pakket. Eén pakket tegelijk.

**MTS-48 — Herstel.** Gevonden tekortkomingen gaan naar de herstellijst met hun codes. Herstel van een `MTS-38`-grond vereist een volledige hertoets van de betrokken dimensie, niet alleen van het gerepareerde scherm.

**MTS-49 — Bestaande pakketten.** Reeds gebouwde pakketten worden niet met terugwerkende kracht herbouwd. Ze worden getoetst bij de eerstvolgende wijziging aan een van hun schermen (MUX-87).

---

## 10. Media, beweging en uitleg

Toegevoegd door `MOBILE_MEDIA_COMPONENTS_01`. Van toepassing op elk pakket dat CMP-40 t/m CMP-44 gebruikt.

**MTS-50 — Animatie aan en uit.** Beide standen doorlopen.
**MTS-51 — Verminder beweging.** Systeeminstelling aan: geen kanteling, geen drukanimatie, geen overgangsafhankelijkheid (PAT-33).
**MTS-52 — Geen functieverlies zonder animatie.** Elke flow uit de rolflows is met animatie uit identiek uitvoerbaar — geen extra tik, geen omweg, geen verdwenen knop (PAT-39).
**MTS-53 — Lage bandbreedte.** Posterbeeld direct, lage-resolutievariant beschikbaar, scherm volledig bruikbaar zonder dat de video ooit laadt.
**MTS-54 — Mobiele data zonder toestemming.** Geen enkele mediadownload zonder expliciete toestemming.
**MTS-55 — Uitlegflow.** Vraag vooraf, ondertiteling, zonder geluid begrijpelijk, pauzeren en overslaan mogelijk, eindigt met een uitvoerbare eerste actie.
**MTS-56 — Bekeken of overgeslagen.** De keuze wordt onthouden en gerespecteerd; de vraag komt niet terug; de uitleg blijft vindbaar via Help.
**MTS-57 — Ontbrekende media.** Vier verplichte elementen, tekstvariant als vervolgstap, onderliggend scherm blijft werken.
**MTS-58 — Ondertiteling, tekstalternatief en schermlezer.** De tekstvariant is gelijkwaardig, geen samenvatting; elke spelerknop heeft een leesbare naam.
**MTS-59 — Geen media tijdens een actieve taak.** Navigatie, training, wedstrijddagmodus, onboarding, formulier en acute flows: geen start, en een lopende video pauzeert.
**MTS-60 — Leeftijdsgeschikte inhoud.** Een minderjarige krijgt geen gewichtsdoel, geen 1RM-doel en geen zwaar belastingvoorschrift; leeftijdsclassificatie en stopregel bij pijn zijn zichtbaar.
**MTS-61 — Uitleg toont de echte interface.** Geen nagebouwd of verouderd scherm.
**MTS-62 — Oefenkaart compleet.** Begin- en eindpositie, aandachtspunten, veelgemaakte fouten, stopregel — ook in de tekstvariant.
**MTS-63 — Coachmelding onderbreekt niet.** Verschijnt alleen op een rustmoment, bevat reden, gegevens en onzekerheid, en blokkeert de primaire actie niet.
**MTS-64 — Acute melding.** Niet permanent onderdrukbaar; bij een minderjarige niet negeerbaar; alleen te sluiten nadat de inhoud is gelezen; de verantwoordelijke blijft geïnformeerd.
**MTS-65 — Afgebroken download.** Posterbeeld en tekstvariant blijven; opnieuw proberen is een zichtbare keuze; geen eindeloze laadanimatie.
**MTS-66 — Speler blokkeert niets.** Een mediafout laat het onderliggende scherm volledig bruikbaar.
**MTS-67 — Rechten en versie.** Van elk getoond mediabestand zijn bron, maker, licentie, leeftijdsgeschiktheid, versie en publicatiestatus aantoonbaar via `KENNIS_01`.
**MTS-68 — Verbruik en zwaarte.** Batterij- en dataverbruik blijven redelijk; geen zware 3D-engine.

**MTS-69 — Directe afkeur, media.** Naast MTS-38:

1. Autoplay tijdens navigatie of wedstrijddag.
2. Een functie die zonder animatie onbruikbaar is.
3. Media zonder aantoonbare rechten.
4. Coachadvies uit mock- of verzonnen persoonlijke gegevens.
5. Een acute melding die permanent onderdrukbaar is.
6. Een minderjarige die een ongeschikte oefening krijgt.
7. Een mediafout die het onderliggende scherm blokkeert.

---

## 11. Consistentiecontrole

- Alle genoemde MUX-codes bestaan in `SPARKI_MOBILE_UX_STANDARD_v1.4.md`.
- Alle genoemde CMP-codes bestaan in de componentbibliotheek (CMP-00 t/m CMP-44); alle PAT-codes in het patronendocument (PAT-01 t/m PAT-39).
- De achttien dimensies uit MUX-81 zijn één op één gedekt door MTS-09 t/m MTS-27.
- De afkeurgronden uit MUX-82 zijn volledig opgenomen in MTS-38 en MTS-39, met de zwaarste twee als directe afkeur.
- Geen nieuwe MUX-, CMP- of PAT-codes toegevoegd; geen productbesluiten genomen.

---

*Einde `SPARKI_MIRROR_MOBILE_TESTSTANDARD.md`. Hiermee is de reeks van vijf opleveringen bij `MOBILE_UX_STANDARD_01` compleet.*
