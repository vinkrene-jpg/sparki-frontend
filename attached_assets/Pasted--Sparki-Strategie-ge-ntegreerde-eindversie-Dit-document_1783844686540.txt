# Sparki — Strategie (geïntegreerde eindversie)

*Dit document vervangt "Sparki — Eerlijk verdienmodel & gezonde retentie" en integreert Sparki_strategie_v2 met de besluiten van 12 juli 2026. Bij tegenstrijdigheid gaan de nieuwste expliciete besluiten voor. Er wordt op basis van dit document nog niets geïmplementeerd: geen billing, geen abonnementen, geen betaalmuur, geen commerciële gebruikslimieten, geen engagementmechanieken.*

---

## 1. Leidende strategische volgorde

1. **Vertrouwensvloer** — veiligheid, datakwaliteit en betrouwbaarheid.
2. **Unieke productwaarde** — Sparki levert beslissingen en inzichten die de renner niet al uit Garmin, Strava of zijn eigen basiskennis haalt.
3. **Gezonde retentie** — renners keren vrijwillig terug vanwege aantoonbare waarde.
4. **Schaalbaarheid** — werking, support en rekenkosten blijven beheersbaar.
5. **Betalingsbereidheid** — pas testen nadat productwaarde en gebruik zijn aangetoond.
6. **Eventueel verdienmodel** — pas na de validatiefase en nooit automatisch.

**Productwaarde gaat vóór retentie. Retentie gaat vóór monetisatie.** Een stap wordt niet gestart voordat de vorige aantoonbaar staat.

---

## 2. Productpositionering

> **"Garmin registreert. Strava vergelijkt en deelt. Sparki interpreteert en stuurt verantwoord bij."**

**Dylan is de falsificatietest van deze propositie.** Het probleem is niet primair dat Dylan onvoldoende wordt teruggelokt; het probleem is dat hij nog onvoldoende reden ervaart om Sparki vrijwillig te openen. Wanneer Sparki voor hem geen relevante vraag beter beantwoordt dan Garmin en Strava, moet eerst de kernwaarde scherper worden — niet de engagementlaag agressiever.

Sparki moet voor een renner drie terugkerende vragen beantwoorden:

1. **Na een training:** "Wat betekende deze training werkelijk voor mijn ontwikkeling?"
2. **Voor een training:** "Wat is vandaag, gezien mijn belasting, herstel, doel en actuele context, verstandig?"
3. **Periodiek:** "Word ik aantoonbaar beter, waarin precies, en waardoor?"

De primaire waarde-eenheid is niet een scherm, antwoord, grafiek, badge of notificatie, maar:

> **"Een betrouwbare persoonlijke trainingsbeslissing die de renner zonder Sparki niet, later of minder goed had kunnen nemen."**

### Waarom dit model eerlijk kán zijn

Apps die aan **aandacht** verdienen (socials, gokken, oneindige feeds) kunnen niet eerlijk zijn: hun winst zit in verspilde tijd. Sparki verdient — als er ooit een verdienmodel komt — aan **resultaat en vertrouwen**: een renner die aantoonbaar beter wordt, een ouder die z'n kind verantwoord ziet trainen, een coach die tijd bespaart. In dat model is eerlijkheid geen rem maar de motor. Of dat ook een houdbaar bedrijf oplevert, is onbewezen en wordt volgens het bewijsplan (sectie 10) getoetst.

---

## 3. Vertrouwensvloer en release-poort

Betrouwbaarheid is geen onderscheidende feature, maar de minimale voorwaarde om coaching te mogen leveren. De ervaring van de afgelopen weken (basale maar verstorende bugs bij de hoofdtester) bevestigt dat dit nu de bindende beperking is.

### 3.1 Release-poort op de volledige kernreis

app openen → Vandaag bekijken → training openen → activiteit synchroniseren → analyse bekijken → aangepast schema controleren

De release-poort controleert minimaal op:

- correcte datums en tijdzones;
- correcte eenheden;
- geen dubbele activiteiten;
- geen verloren of verzonnen gegevens;
- correcte koppeling van activiteit, analyse en schema;
- realistische trainingsduur en belasting;
- geen extreme inhaaltrainingen;
- geen tegenstrijdig advies;
- geen stellige conclusie wanneer de data onvoldoende is;
- geen onveilig herstel-, belasting-, voedings- of trainingsadvies.

### 3.2 Synthetische referentierenners

De poort draait met synthetische referentierenners met bekende verwachte uitkomsten, waaronder:

- nieuwe renner zonder historie;
- renner met meerdere weken historie;
- renner met onvolledige sensordata;
- renner met gemiste trainingen;
- renner met verhoogde belasting;
- renner met wedstrijd;
- renner met een mogelijk veiligheids- of overbelastingssignaal.

### 3.3 Blokkadecriteria

Een release wordt geblokkeerd bij:

- veiligheidskritieke fouten;
- dataverlies of datacorruptie;
- materieel onjuiste trainingsinformatie;
- blokkade van een kernstap;
- onveilig of intern tegenstrijdig advies.

### 3.4 Operationele borging

Naast de poort: productie-monitoring, incidentregistratie en een geteste rollbackprocedure.

---

## 4. Definitie van "stabiele publieke bèta"

De start van de gratis periode wordt niet informeel, achteraf of op basis van alleen een publicatiedatum bepaald. De stabiele publieke bèta begint uitsluitend wanneer **alle** volgende voorwaarden zijn vervuld:

1. De volledige release-poort van de kernloop is succesvol doorlopen voor minimaal **drie opeenvolgende release-candidates**.
2. Er staan **geen openstaande rode incidenten of defects** open. Rood omvat minimaal: veiligheidsrisico; privacy- of toestemmingsfout; dataverlies of datacorruptie; materieel onjuiste trainingsdata; onveilig advies; blokkade van login, synchronisatie, Vandaag, training, analyse of schema.
3. Een representatieve testgroep heeft Sparki minimaal **vier aaneengesloten weken** gebruikt **zonder verstorende kernloopbug**. Een verstorende bug is een fout die: een kernstap onmogelijk maakt; verkeerde of verloren data veroorzaakt; een materieel onjuist getal toont; onveilig of tegenstrijdig advies geeft; of de normale dagelijkse gebruikersreis wezenlijk onderbreekt.
4. Productiemonitoring, incidentlogging en rollback zijn **actief en getest**.
5. De start wordt **formeel vastgelegd** met: exacte kalenderdatum; releaseversie; bewijs dat de criteria zijn gehaald; verantwoordelijke voor het besluit.

De periode begint niet automatisch bij de eerste tester, eerste deployment, besloten test of interne bèta. Na de formele startdatum wordt deze datum niet met terugwerkende kracht verschoven wanneer later een incident optreedt: zo'n incident activeert herstel- en releaseprocedures, maar verlengt of reset de commerciële toezegging niet.

---

## 5. 24 maanden: alle rennersfuncties gratis

**Besloten.** Gedurende 24 maanden vanaf de formele start van de stabiele publieke bèta zijn alle algemeen beschikbare Sparki-functionaliteiten voor renners gratis.

Gedurende deze validatiefase bestaan voor renners **niet**:

- Renner Premium;
- upgradeprompts;
- betaalmuren;
- commerciële gebruikslimieten;
- beperkte historie om conversie af te dwingen;
- limieten op wedstrijdanalyses;
- limieten op materiaalchecks;
- limieten op Core-voorspellingen;
- beperkte documentanalyse;
- automatisch aflopende proefperiodes.

Deze beperkingen zijn uit de actieve productstrategie verwijderd (de volledige lijst van geschrapte limieten staat in sectie 17). Prijsvoorstellen en toekomstige pakketten staan uitsluitend nog in sectie 12: *"Mogelijke modellen na validatie — onbewezen hypothesen."*

**Doel van deze periode:**

- unieke productwaarde bewijzen;
- aantonen dat renners vrijwillig terugkomen;
- aantonen dat adviezen tot bruikbare trainingsbeslissingen leiden;
- veiligheid, betrouwbaarheid en ontwikkelresultaat meten;
- werkelijke gebruiks- en denkkracht-kosten vaststellen.

**Reikwijdte:** de gratis periode is een globale productvalidatiefase — niet automatisch een afzonderlijke garantie van 24 maanden vanaf de registratiedatum van iedere nieuwe gebruiker.

**Na maand 24 volgt een beoordelingsmoment, niet automatisch een betaalmuur** (zie sectie 13).

**Transparantie vanaf dag één:** gebruikers worden vanaf het begin geïnformeerd dat Sparki zich in een gratis validatiefase bevindt en dat later een betaald model kan volgen. Er komt nooit een onverwachte betaalmuur. Vroege gebruikers krijgen een redelijke founder- of overgangsregeling en verliezen niet plotseling midden in een seizoen toegang tot eerder gebruikte kernwaarde.

---

## 6. Kostenwaarborg tijdens de gratis fase

24 maanden gratis gebruik betekent niet dat kosten onbeheerst mogen oplopen.

### 6.1 Meten vanaf het begin

- totale infrastructuurkosten;
- denkkracht-kosten per actieve renner;
- kosten per geïmporteerde activiteit;
- kosten per analyse;
- kosten per chatinteractie;
- kosten per zware voorspelling;
- cache-hitratio;
- supporttijd en supportkosten per actieve renner;
- kosten per cohort;
- ontwikkeling van kosten bij groei.

Vóór de start van de stabiele publieke bèta worden een numeriek kostenbudget, doelkosten per actieve renner en waarschuwingsgrenzen vastgesteld.

### 6.2 Escalatieladder bij kostenoverschrijding (in deze volgorde)

1. Dubbele of overbodige modelaanroepen verwijderen.
2. Resultaten cachen en identieke berekeningen hergebruiken.
3. Alleen opnieuw rekenen wanneer relevante brondata verandert.
4. Berekeningen batchen waar directe verwerking niet nodig is.
5. Eenvoudige, betrouwbare detecties uitvoeren met deterministische regels.
6. Een goedkoper model uitsluitend gebruiken wanneer benchmarktests aantonen dat veiligheid, feitelijke juistheid en bruikbaarheid niet materieel achteruitgaan.
7. Niet-kritieke experimenten en nieuwe featureontwikkeling tijdelijk bevriezen.
8. Groei of onboarding van nieuwe gebruikers transparant vertragen wanneer verdere groei de bestaande kwaliteitsbelofte bedreigt.

### 6.3 Wat kosten nooit mogen veroorzaken

- stilzwijgende kwaliteitsverlaging;
- minder nauwkeurige veiligheidsanalyse;
- het weglaten van overbelasting- of blessuresignalen;
- verzonnen of oppervlakkigere antwoorden die als gelijkwaardig worden gepresenteerd;
- een verborgen frequentielimiet voor normaal gebruik;
- een verkapte betaalmuur;
- voortijdige betaling door renners;
- slechtere dienstverlening voor bestaande renners zonder duidelijke communicatie.

Technische beveiligings- en anti-misbruiklimieten zijn toegestaan wanneer ze uitsluitend abnormaal, geautomatiseerd of frauduleus gebruik raken. Ze mogen normaal gebruik door een renner niet beperken en mogen niet als commerciële schaarste worden ingezet. Wanneer optimalisatie onvoldoende is, wordt eerst nieuwe instroom of niet-kritieke uitbreiding beperkt; de bestaande veiligheids- en kwaliteitsbelofte aan renners wordt niet stilletjes uitgehold.

---

## 7. Analysekwaliteit en kennisniveau

Sparki moet **boven het actuele kennisniveau van de individuele renner** opereren:

- basisuitleg voor beginners;
- patronen en context voor gevorderden;
- kwantificering, historische verbanden, uitzonderingen en onzekerheid voor ervaren renners zoals Dylan.

Onzekerheid en bewijsniveau worden in analyses expliciet gemaakt: geen stellige conclusie wanneer de data die niet draagt.

### 7.1 Analysefeedback

Bij analyses komt laagdrempelige feedback: **nuttig / al bekend / niet relevant / onjuist**, met gedefinieerde opvolging:

- **Nuttig** — identificeert welk type inzicht waarde leverde.
- **Al bekend** — de analyse was correct maar te oppervlakkig (onder het kennisniveau van deze renner).
- **Niet relevant** — de analyse sloot onvoldoende aan op het doel of beslismoment.
- **Onjuist** — opent een kwaliteitsincident met ernstclassificatie.

### 7.2 Gedragsdata ernaast

- vrijwillige openingen;
- terugkeer na nieuwe analyses;
- adviesopvolging;
- gewijzigde trainingsbeslissingen;
- correcties;
- gebruik van Garmin, Strava of een coach naast Sparki.

---

## 8. Gezonde retentie — de wet

Retentie wordt pas geoptimaliseerd nadat productwaarde is aangetoond (sectie 1). De regels gelden wel vanaf dag één.

### Toegestaan — retentie via echte waarde
- echte nieuwe inzichten (alleen melden als er echt iets nieuws is);
- relevante voortgang: doelen, ontwikkeling, mijlpalen die daadwerkelijk gehaald zijn;
- zinvolle trainings- en herstelherinneringen (training vandaag, wedstrijd nadert, herstel nodig);
- timing op ontvankelijkheid: porren op het moment dat de renner zelf gewend is te openen, niet op willekeurige piekmomenten;
- sociale waarde met toestemming (samen trainen, coach-feedback, ouder-inzicht — altijd privacy-gated).

### Verboden — dark patterns (expliciet, blijvend)
- nep-urgentie of nep-schaarste ("nog 2 plekken!", "3 mensen bekeken je profiel");
- guilt-tripping ("je bent 5 dagen weggeweest 😢");
- strafstreaks en variabele gokbeloningen (verrassings-badges om terug te lokken);
- oneindige feeds zonder eind;
- verborgen opt-outs; standaard alles-aan zonder duidelijke uitknop;
- notificaties zonder nieuwe waarde.

### De toetssteen (één vraag per feature)
> *"Haalt dit iemand terug voor iets dat écht klopt en hem verder helpt — of voor een truc?"*

Als het antwoord "truc" is, bouwen we het niet. **Veiligheids- en gezondheidsmeldingen krijgen altijd voorrang boven commerciële of engagementlogica.**

---

## 9. Financiële logica

Retentie is geen verdienmodel. Het verdienmodel beschrijft **wie betaalt, waarvoor, hoeveel en met welke frequentie**; retentie bepaalt vervolgens mede de levensduur en economische waarde van die klantrelatie.

### 9.1 Vereiste economische variabelen (per pakket te meten)

- gemiddelde omzet per betalende klant;
- maandelijkse of jaarlijkse churn;
- directe leveringskosten: denkkracht, opslag, gegevensverwerking en externe diensten;
- support- en onboardingkosten;
- verkoopkosten, vooral voor coaches en clubs;
- betaal- en administratiekosten;
- terugbetalingen en proefperioden;
- brutomarge;
- acquisitiekosten en terugverdientijd.

Een eenvoudige abonnementenbenadering:

> **Brutowinst-LTV ≈ maandelijkse omzet × brutomarge ÷ maandelijkse churn**

Dit is alleen bruikbaar wanneer churn en marge uit werkelijk gedrag komen. Een aangenomen verblijfsduur van twee jaar is geen bewijs.

### 9.2 Illustratief coachscenario — geen forecast

Bij een coachprijs van €29 per maand: €29 omzet is niet €29 marge; eerst moet blijken hoeveel denkkracht-, support- en onboardingkosten het roster veroorzaakt; een betaalde pilot moet aantonen dat de coach blijft omdat Sparki tijd of kwaliteit oplevert; en de acquisitie-inspanning moet binnen een acceptabele periode worden terugverdiend. De stelling "één coach blijft twee jaar, dus de klant verdient zich ruim terug" wordt pas geldig nadat omzet, marge, churn en acquisitiekosten zijn gemeten.

### 9.3 Kostenbeheersing zonder kwaliteitsverlies

- zware analyses alleen bij relevante nieuwe data of een expliciete vraag;
- resultaten cachen; deterministische berekeningen niet onnodig door een taalmodel laten herhalen;
- goedkope regels voor eenvoudige detectie; complexere modellen alleen bij echte meerwaarde;
- modeluitvoer loggen, evalueren en waar mogelijk hergebruiken;
- supportlast meenemen in productontwerp: heldere uitleg voorkomt veel handmatige vragen;
- geen kostenbesparing die onzeker advies stelliger of veiligheidscontrole zwakker maakt.

---

## 10. Bewijsplan: van Dylan naar een houdbaar product

### Fase A — intrinsieke rennerwaarde bewijzen

**Doel:** vaststellen of een renner Sparki vrijwillig opent voor interpretatie en bijsturing die hij elders niet krijgt.

**Testopzet:** Dylan en een kleine groep vergelijkbare renners gebruiken Sparki meerdere weken. Na elke relevante synchronisatie verschijnt één compact analyseblok: wat, waarom, volgende stap en zekerheid. Geen badges, streaks, generieke engagementmeldingen of extra sociale druk. Garmin en Strava blijven gewoon beschikbaar; Sparki moet naast die producten zijn eigen waarde verdienen.

**Te meten:** aandeel relevante activiteiten waarvan de analyse vrijwillig wordt geopend; tijd tussen synchronisatie en openen; expliciete beoordeling (nuttig / al bekend / niet relevant / onjuist); aantal analyses dat tot een concrete keuze of beter begrip leidt; terugkeer zonder pushmelding; informatie die de renner alsnog in Garmin, Strava of bij een coach moest zoeken; fouten, tegenstrijdigheden en te stellige conclusies.

**Voorlopige beslisdrempels (start van het experiment):** een duidelijke meerderheid van de testers kan zonder hulp benoemen wat Sparki uniek doet; herhaald gebruik ontstaat bij meerdere renners, niet alleen bij de oprichter of één enthousiaste tester; nuttige inzichten komen substantieel vaker voor dan generieke, dubbele of foutieve analyses; veiligheidskritieke planningsfouten (zoals extreme inhaaltrainingen) zijn uitgesloten voordat retentie wordt geoptimaliseerd.

**Stopregel:** wanneer dit niet lukt, wordt niet eerst aan notificaties of pricing gesleuteld — dan moet de kernanalyse verbeteren of de propositie worden versmald.

### Fase B — coachwaarde en betalingsbereidheid bewijzen

**Doel:** aantonen dat Sparki tijd bespaart of betere begeleiding mogelijk maakt.

**Testopzet:** enkele coaches met echte rosters; focus op uitzonderingen, planvoorstellen en opvolging; nulmeting van tijdsbesteding en huidige werkwijze; een beperkte **betaalde** pilot, niet alleen een vrijblijvende interessepeiling.

**Te meten:** tijd per renner per week; aantal relevante signalen dat eerder of makkelijker wordt gezien; percentage voorstellen dat wordt geaccepteerd, aangepast of afgewezen; reden van afwijzing; bereidheid om na de pilot daadwerkelijk te verlengen; support- en onboardinglast per coach.

### Fase C — ouderwaarde zorgvuldig valideren

**Doel:** bepalen of ouder-inzicht echte geruststelling en betere afstemming oplevert zonder dat de renner zich gevolgd voelt.

Test niet alleen betalingsbereidheid, maar ook: voorkeur van de renner; begrip van deelinstellingen; conflicten of druk die door gedeelde informatie ontstaan; welke veiligheidsinformatie werkelijk nuttig is; welke informatie niet gedeeld hoort te worden.

### Fase D — clubproduct en schaalbaarheid bewijzen

Start pas wanneer coachwaarde aantoonbaar is. Gebruik betaalde pilots of concrete intentieverklaringen met duidelijke scope. Meet verkoopduur, onboarding, gebruik per rol, supportkosten en verlenging.

### Pilots tijdens de gratis rennerfase

Coach- en clubfunctionaliteit mag tijdens de gratis rennerfase afzonderlijk in betaalde pilots worden getest, mits:

- de renner geen functionaliteit verliest;
- het een afzonderlijke waarde voor coach of organisatie betreft;
- privacy en toestemming aantoonbaar zijn geregeld;
- veiligheidsvoordelen niet worden verkocht;
- pilotresultaten als hypothesetoets worden behandeld;
- de pilot transparant wordt gepresenteerd.

---

## 11. De juiste metriek

### 11.1 Primaire productmetriek

> **Aantal bruikbare, betrouwbare trainingsbeslissingen per actieve renner per week.**

Een beslissing telt alleen wanneer de gebruiker of coach bevestigt dat het inzicht tot handelen, aanpassen, vermijden of aantoonbaar beter begrip heeft geleid.

### 11.2 Ondersteunende productmetingen

- aandeel activiteiten met een werkelijk nieuw inzicht;
- nuttigheidsscore per type analyse;
- acceptatie en aanpassing van trainingsvoorstellen;
- terugkeer op natuurlijke momenten;
- doelvoortgang over meerdere weken;
- datakwaliteit en analysezekerheid;
- tijdsbesparing voor coaches;
- retentie per cohort;
- organische groei.

### 11.3 Bedrijfsmetingen (pas relevant bij betaalde lagen)

- actieve gratis renners naar betaalde klantrelaties;
- betaalde conversie per doelgroep;
- churn en verlenging;
- omzet per klant;
- brutomarge;
- acquisitiekosten;
- terugverdientijd;
- supportlast.

### 11.4 Ethische en veiligheidswaarborgen

- aantal fout-positieve en gemiste veiligheidsmeldingen;
- aantal te stellige of onvoldoende onderbouwde analyses;
- meldingsopt-outs en redenen;
- ervaren druk, schuld of surveillance;
- klachten over delen, privacy of autonomie;
- eenvoud van data-export, opzeggen en accountverwijdering;
- commerciële prompts die per ongeluk boven herstel of veiligheid verschenen.

**Schermtijd is geen succesmetriek.** Meer sessies zijn alleen positief wanneer ze samengaan met meer bruikbare beslissingen, vertrouwen en verantwoord resultaat.

---

## 12. Mogelijke modellen na validatie — onbewezen hypothesen

*Alles in deze sectie is hypothese. Niets hiervan bestaat tijdens de 24-maanden-validatiefase, niets wordt automatisch ingevoerd, en elke prijs is een pilotwaarde — geen tarief.*

### 12.1 Wie zou kunnen betalen (hypothese)

De jeugdwielermarkt is een niche en de renner zelf is prijsgevoelig. De hypothese is dat de betalers vooral om de renner heen zitten — ouders, coaches, clubs — terwijl de renner de volle kernwaarde houdt. **Onbewezen zijn onder meer:** de betalingsbereidheid van ouders, coaches en clubs; lage churn; mond-tot-mondgroei; lage marginale kosten; bijna nul acquisitiekosten via clubs; "één kind levert één of twee betalende ouders op"; "Premium verkoopt zichzelf"; een gemiddelde klantduur van twee jaar. Elk van deze aannames wordt pas voor waar gehouden na meting in een betaalde pilot.

### 12.2 Renner Premium (hypothese, ~€6/mnd of ~€59/jaar)

**Tiering-principe (voorlopige hypothese): gratis biedt de echte kernwaarde; betaald biedt meer diepte, frequentie en historie.** De intelligentie van Sparki mag niet volledig achter een betaalmuur: dan is de gratis laag inwisselbaar met een gratis Strava/Garmin-account en proeft niemand het verschil. De grens is niet "welke feature", maar diepte en frequentie; elke onderscheidende functie blijft gratis écht bruikbaar. Limieten zijn altijd transparant vooraf gecommuniceerd, nooit een verrassing. Betaalde waarde zou kunnen liggen in: diepere sessieanalyse en patroonherkenning; langetermijnontwikkeling en scenario's; uitgebreidere wedstrijdvoorbereiding en nabespreking; voedings- en herstelbegeleiding binnen duidelijke grenzen; document- en materiaalondersteuning; meer historische context en uitlegbaarheid.

**Indicatieve verdeling (hypothese, te herijken op wat gebruikers dan werkelijk waarderen):**

| Onderdeel | Gratis (Renner) | Renner Premium |
|---|---|---|
| Account, profiel, doelen, sportbron koppelen + import | ✔ volledig | ✔ |
| Trainingsschema + dagelijkse trainingsdag | ✔ volledig | ✔ |
| Sessie-analyse (oordeel + uitleg per rit) | ✔ elke rit | ✔ |
| Patronen & trends | recente periode | onbeperkte historie |
| Wedstrijd-intelligentie | je A-doelen | onbeperkt |
| Materiaalcoach | beperkt aantal checks | onbeperkt + kostenadvies |
| Voedingscoach | dagelijkse basis | volledig fueling-plan + seizoensdoel (17+) |
| Levend Core-profiel | huidig beeld | + Ontwikkelkompas & evolutie |
| Core-voorspelling per training | proef-frequentie | elke training |
| Documentanalyse | bij je A-wedstrijden | onbeperkt |
| Veiligheids- & gezondheidssignalen | **✔ altijd, onbegrensd** | **✔ altijd, onbegrensd** |

### 12.3 Coach (hypothese, ~€29/mnd tot een afgesproken rosteromvang)

Verkocht op aantoonbare productiviteit: overzicht van renners die aandacht nodig hebben; uitzonderingen en risico's in plaats van een muur aan grafieken; voorstelbare schema-aanpassingen met onderbouwing; gedeelde context en coachnotities; controle (advies accepteren, aanpassen of afwijzen); rapportage van tijdsbesparing en opvolging. Een staffel per renner kan later worden getest, maar mag rostergroei niet onnodig bestraffen. Commercieel activeren kan pas na een geslaagde betaalde pilot (fase B).

### 12.4 Ouder-inzicht (prijs en vorm niet vastleggen)

Eerst valideren welke informatie werkelijk gewenst en passend is. Ontwerpprincipes: de renner weet wat wordt gedeeld; deelniveaus zijn begrijpelijk en wijzigbaar; geen continue surveillance of prestatievergelijking; veiligheidsinformatie zorgvuldig onderscheiden van normale trainingsdetails; ouderwaarde is afstemming en geruststelling, niet controle.

### 12.5 Club/team (hypothese, ~€250–750/jaar)

Alleen te testen nadat duidelijk is wat de club werkelijk afneemt: rol- en rechtenbeheer; onboarding van coaches en renners; uniforme maar aanpasbare trainingsprincipes; rapportage zonder ongewenste ranglijsten; support, export, continuïteit en governance. Een clubcontract is pas schaalbaar wanneer onboarding en support grotendeels herhaalbaar zijn — start pas na bewezen coachwaarde (fase D).

---

## 13. Beslismoment na 24 maanden

Een betaalmodel wordt na 24 maanden **alleen overwogen** wanneer aantoonbaar is dat:

- de kernloop betrouwbaar werkt;
- renners Sparki vrijwillig openen;
- Sparki bruikbare beslissingen oplevert;
- Sparki iets toevoegt ten opzichte van Garmin en Strava;
- gebruikers structureel terugkomen zonder dark patterns;
- kosten per actieve renner beheersbaar zijn;
- support schaalbaar is;
- daadwerkelijke betalingsbereidheid bestaat;
- duidelijk is welke kernwaarde gratis blijft;
- vroege gebruikers een eerlijke overgang krijgen.

**Een groot ledenaantal is op zichzelf onvoldoende bewijs van betalingsbereidheid.**

**Altijd gratis — ook na de validatiefase:** urgente signalen over blessure en overbelasting; correcties op onveilig trainingsadvies; toegang tot en export van eigen gegevens; privacy- en toestemmingsbeheer; opzeggen en accountverwijdering.

---

## 14. Feature-review voor iedere sprint

Iedere feature moet vooraf acht vragen beantwoorden:

1. Welke concrete gebruikersvraag lost dit op?
2. Op welk natuurlijk moment ontstaat die vraag?
3. Welke data ondersteunt de uitkomst?
4. Hoe wordt onzekerheid zichtbaar gemaakt?
5. Welke beslissing of welk begrip volgt eruit?
6. Levert Garmin, Strava of een andere bestaande dienst dit al vrijwel hetzelfde?
7. Kan de feature druk, surveillance of onveilig gedrag veroorzaken?
8. Hoe meten we echte waarde zonder schermtijd als doel te nemen?

Een feature zonder overtuigende antwoorden wordt niet gebouwd, of wordt als experiment met een expliciete stopregel uitgevoerd.

---

## 15. Fasering en sprintvolgorde

De fasering volgt de strategische volgorde uit sectie 1:

| Fase | Inhoud | Klaar wanneer |
|---|---|---|
| **1. Vertrouwensvloer** | Release-poort kernloop; synthetische referentierenners; veiligheidsinvarianten in de planner (geen extreme inhaaltrainingen, harde grenzen, uitlegbare reden bij grote planwijziging); productie-monitoring, incidentregistratie, rollback | Criteria "stabiele publieke bèta" (sectie 4) gehaald |
| **2. Unieke waarde** | Post-activity insight card (wat / waarom relevant voor het doel / wat verandert er / hoe zeker); pre-training decision card (doel, reden, aanpassingscriteria, wat niet hoeft te worden ingehaald); meetinstrumentatie (geopend, nuttig, al bekend, niet relevant, onjuist, actie genomen, reden van afwijzing); wekelijkse ontwikkelsamenvatting alleen bij voldoende data | Fase-A-drempels (sectie 10) gehaald |
| **3. Gezonde retentie** | Retentie uitsluitend volgens de wet (sectie 8); timing op ontvankelijkheid | Vrijwillige terugkeer aangetoond zonder dark patterns |
| **4. Schaalbaarheid** | Kosteninstrumentatie en -waarschuwingen (sectie 6); supportlast meetbaar; cache-strategie | Kosten per actieve renner binnen budget bij groei |
| **5. Betalingsvalidatie** | Coach-exception view → betaalde coachpilot (fase B); oudervalidatie (fase C); club (fase D) | Betalingsbereidheid gemeten, niet gepeild |
| **6. Eventueel verdienmodel** | Beslismoment sectie 13; hypothesen sectie 12 toetsen | Nooit automatisch |

**Nog niet prioriteren:** betaalmuren en uitgebreide billing; badges, streaks en engagementgamification; nog meer algemene dashboards; sociale feeds; omvangrijk clubbeheer; brede multi-sportuitbreiding; marketingclaims over prestatieverbetering die nog niet zijn aangetoond. De betaalarchitectuur kan technisch worden voorbereid, maar commercieel activeren gebeurt pas nadat de betreffende waarde in een pilot is bewezen.

---

## 16. Technische ticketlijst (nog niet implementeren — ter beoordeling)

1. **Release-poort kernloop** — geautomatiseerde doorloop van app openen → Vandaag → training → synchronisatie → analyse → schema, met de controles uit sectie 3.1; blokkeert een release bij de criteria uit 3.3.
2. **Synthetische referentierenners** — testdataset met de zeven profielen uit sectie 3.2 en bekende verwachte uitkomsten per profiel; onderdeel van de release-poort.
3. **Productie-monitoring & incidentproces** — foutmonitoring in productie, incidentregistratie met ernstclassificatie (rood-definitie uit sectie 4), geteste rollbackprocedure.
4. **Analysefeedback** — per analyse: geopend, nuttig, al bekend, niet relevant, onjuist, actie genomen, reden van afwijzing; "onjuist" opent een kwaliteitsincident; koppeling aan gedragsdata (sectie 7.2).
5. **Kosteninstrumentatie** — meten van de posten uit sectie 6.1 per actieve renner en per cohort; cache-hitratio zichtbaar.
6. **Kostenwaarschuwingen** — numeriek budget, doelkosten per actieve renner en waarschuwingsgrenzen; overschrijding activeert de escalatieladder uit sectie 6.2.

---

## 17. Verwijderde Premium-limieten uit de oude strategie

De volgende limieten voor renners uit het oude proef-model zijn voor de eerste 24 maanden verwijderd en bestaan niet in het actieve product:

1. Patronen & trends beperkt tot de laatste ~6 weken historie.
2. Wedstrijd-intelligentie beperkt tot 2 wedstrijden per seizoen.
3. Materiaalcoach beperkt tot 2 checks per jaar (en kostenadvies alleen betaald).
4. Voedingscoach beperkt tot basisadviezen (volledig fueling-plan + seizoensdoel alleen betaald).
5. Core-profiel zonder Ontwikkelkompas & evolutie (alleen betaald).
6. Core-voorspelling beperkt tot 1× per week.
7. Documentanalyse beperkt tot 2 A-wedstrijden.
8. Renner Premium als product, inclusief upgradeprompts, proefperiodes en elke betaalmuur voor renners.

Deze lijst blijft uitsluitend bestaan als geparkeerde hypothese in sectie 12.2.

---

## 18. Bewezen / hypothese / nog onbekend

| Claim | Status |
|---|---|
| De kernfuncties draaien technisch (schema, import, analyse, races, voeding, materiaal, Core) | **Bewezen** (geautomatiseerde tests), maar zie volgende regel |
| De kernloop is betrouwbaar in dagelijks gebruik | **Niet bewezen** — recente basale maar verstorende bugs bij de hoofdtester; vertrouwensvloer nog niet gehaald |
| Retentiemechaniek zonder dark patterns bestaat en leert van echt openingsritme | **Bewezen** (gebouwd en getest), effect op vrijwillige terugkeer **nog onbekend** |
| Sparki beantwoordt voor Dylan een vraag beter dan Garmin/Strava | **Nog onbekend** — huidig signaal is eerder negatief ("weinig te halen") |
| Analyses opereren boven het kennisniveau van een ervaren jeugdrenner | **Nog onbekend** — meetinstrumentatie (nuttig/al bekend/onjuist) ontbreekt nog |
| Renners keren vrijwillig terug voor de inhoud | **Nog onbekend** |
| Adviezen leiden tot bruikbare trainingsbeslissingen | **Nog onbekend** — primaire metriek wordt nog niet gemeten |
| Betalingsbereidheid coach (~€29/mnd) | **Hypothese** — pas geldig na betaalde pilot |
| Betalingsbereidheid ouders | **Hypothese** — vorm en prijs niet vastgelegd |
| Betalingsbereidheid clubs (~€250–750/jr) | **Hypothese** — pas na bewezen coachwaarde te testen |
| Conversie gratis → Renner Premium; "Premium verkoopt zichzelf" | **Hypothese** (fase-2, geparkeerd) |
| Lage churn / klantduur van twee jaar | **Hypothese** — geen enkele meting |
| Mond-tot-mondgroei; bijna nul acquisitiekosten via clubs | **Hypothese** |
| Lage marginale kosten per extra renner | **Hypothese** — denkkracht-kosten per actieve renner zijn nog nooit gemeten |
| Denkkracht- en supportkosten per actieve renner | **Nog onbekend** — instrumentatie ontbreekt |
| Eén kind levert één of twee betalende ouders op | **Hypothese** |

---

## 19. Changelog (inhoudelijke keuzes en opgeloste tegenstrijdigheden)

1. **Sparki_strategie_v2 is leidend** op discipline en bewijslast; uit de oude Replit-versie zijn behouden: het aandacht-vs-resultaat-fundament (§2), de retentie-wet + toetssteen (§8), het tiering-principe "gratis biedt de echte kernwaarde" en de tabel — maar uitsluitend als geparkeerde hypothese (§12.2), en het principe dat veiligheid nooit wordt begrensd.
2. **Alle renner-limieten geschrapt voor de validatiefase** — expliciete lijst in §17; oude teksten waarin het proef-model als fase-2-*plan* stond zijn vervangen door "onbewezen hypothese, alleen te overwegen op het beslismoment".
3. **Tegenstrijdigheid opgelost — start van de gratis periode:** oude versie zei "fase 1, richtjaar ~2 jaar" vanaf nu; nieuw besluit: 24 maanden vanaf de **formele start van de stabiele publieke bèta** met harde criteria (§4). Geen impliciete klok; geen reset met terugwerkende kracht.
4. **Tegenstrijdigheid opgelost — na de gratis fase:** oude versie suggereerde dat fase 2 (Renner Premium) daarna zou volgen; nieuw: na maand 24 volgt een **beoordelingsmoment** (§13), nooit automatisch een betaalmuur.
5. **Stellige commerciële claims herschreven als hypothesen** (§12.1, §18): betalingsbereidheid ouders/coaches/clubs, lage churn, mond-tot-mondgroei, lage marginale kosten, bijna nul acquisitiekosten via clubs, "1 kind → 1–2 betalende ouders", "Premium verkoopt zichzelf", klantduur van twee jaar. De oude "hefboom per laag"-tabel is vervallen; de redenering leeft alleen nog als hypothese.
6. **"Retentie ís het verdienmodel" definitief gecorrigeerd** naar: retentie bepaalt mede levensduur en waarde van de klantrelatie; het verdienmodel beschrijft wie betaalt, waarvoor, hoeveel en hoe vaak (§9).
7. **Toegevoegd (nieuw t.o.v. beide bronnen):** definitie en startcriteria "stabiele publieke bèta" (§4), kostenwaarborg met meetlijst, budget vooraf en escalatieladder (§6), en de opvolgingsdefinities bij analysefeedback (§7.1).
8. **Volgorde vastgelegd als wet:** veiligheid → productwaarde → gezonde retentie → schaalbaarheid → betalingsbereidheid → eventueel verdienmodel; productwaarde vóór retentie, retentie vóór monetisatie (§1).
9. **Dylan geherpositioneerd:** van "tester die terugverleid moet worden" naar falsificatietest van de productpropositie (§2); zijn feedback stuurt fase A.
10. **Positionering vastgelegd:** "Garmin registreert. Strava vergelijkt en deelt. Sparki interpreteert en stuurt verantwoord bij."

---

## 20. Samenvatting

Sparki kán een eerlijk en houdbaar product worden, maar die conclusie is niet bewezen. De volgorde is bepalend: eerst een betrouwbare kernloop (vertrouwensvloer, release-poort, stabiele publieke bèta), dan bewijzen dat Sparki voor renners zoals Dylan een vraag beantwoordt die Garmin en Strava niet beantwoorden, dan aantonen dat renners daarvoor vrijwillig terugkomen — en pas daarna, na 24 maanden volledig gratis rennergebruik en een expliciet beoordelingsmoment, eventueel een verdienmodel toetsen dat op resultaat en vertrouwen rust, nooit op aandacht. Coach- en ouderwaarde mogen ondertussen in betaalde pilots worden getoetst, zolang de renner niets verliest en veiligheid nooit te koop is.
