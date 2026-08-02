# Besluitenoverzicht voor Replit — stand 2 augustus 2026

Dit document bevat **alle productbesluiten die René heeft genomen op 1 en 2 augustus 2026**, gegroepeerd per onderwerp.

**Waarom dit bestand bestaat:** bij de afstemming van 1 augustus bleek dat een groot deel van het werk nooit bij Replit is aangekomen. Er zijn daardoor vragen gesteld die al beantwoord waren. Dit overzicht is bedoeld om die achterstand in één keer weg te nemen.

**Status:** vastgestelde besluiten van René. Bij tegenspraak met een ouder document wint dit document. Waar iets nog open is, staat dat er expliciet bij.

---

## 1. Werkwijze en vrijgave

1.1 Eén goedgekeurde bouwopdracht is toestemming voor de **hele straat**: inventarisatie, code, migraties, tests, herstel, commits, pushes, acceptatiedeployment, featureflags binnen scope, productiepublicatie, productiemigraties en rollback. Rapporteren is geen wachtmoment.

1.2 **Geen vrijgave per pakket.** Replit werkt de wachtrij zelfstandig af in de afgesproken volgorde.

1.3 **Mirror is parallel en niet blokkerend.** MIRROR_PROVEN → door · HERSTEL NODIG → Replit herstelt zelf en gaat door · AFGEKEURD → alleen de geraakte lijn stopt · NIET BEWIJSBAAR → bewijs herstellen, de bouw ligt niet stil. Mirror blokkeert nooit op een cosmetisch gebrek, ontbrekend screenshot of documentatiefout.

1.4 **Elf harde stops blijven** en stoppen alleen de geraakte lijn: dataverlies · cross-account-, team- of consentlek · verzonnen persoonlijke data · medische diagnose of gevaarlijk veiligheidsadvies · onherstelbare migratiefout · productiedatabase onbereikbaar · build of tests blijven rood · ontbrekende rollback bij een destructieve wijziging · betaalstromen die bij Sparki terechtkomen · ontbrekende juridische productkeuze · echte inhoudelijke tegenstrijdigheid.

1.5 **ChatGPT is uit beeld.** Alle stopregels die op ChatGPT-goedkeuring wachten vervallen. Claude neemt de controlerol over (samenhang bewaken, tegenstrijdigheden melden); definitieve vrijgave blijft bij René.

1.6 **Eén gezamenlijke wachtrij.** De pakketten die via Claude zijn opgesteld — `SPARKI_BUILD_01` t/m `04`, `DOELEN_01`, `AI_INTELLIGENCE_ENGINE_02`, `MEDIA_UITLEG_01`, `MULTIROLE_CONTEXT_01`, de document-, rapportage- en UX-standaarden — worden samengevoegd met de eigen wachtrij van Replit. Niet twee stromen naast elkaar.

1.7 Open punten in drie soorten: **A** uitwerkingsvraag (Replit lost zelf op) · **B** technische blokkade (Replit herstelt en gaat door) · **C** echt productbesluit (één korte vraag aan René, terughoudend gebruiken). **Prijzen, benamingen en instellingen blokkeren nooit** — configureerbaar bouwen met een lege waarde.

1.8 **Bouwvolgorde na het lopende mobiele routepakket:** `DATA_TRUST_01` → `CLUB_RECHTEN_01` → `ABONNEMENT_01`. Binnen de clubbundel (19–23): clubplanning eerst, dan clubcommunicatie, dan ploegleider, dan teammechanieker, dan marktplaats.

1.9 **App en browser komen uit één codebasis.**

---

## 2. Release

2.1 De eerste publieke versie omvat **alles** — niet alleen fietsen en routes.

2.2 **Geen gesloten pilot.** Sparki gaat direct open.

2.3 **Betaald vanaf dag één**, naast het blijvende gratis pakket.

2.4 René beschouwt die eerste release feitelijk als een test. Daarom volstaat een webapp op de telefoon; App Store en Play Store komen later.

2.5 **Route en navigatie op de telefoon worden als eerste afgebouwd** — het enige onderdeel dat direct testbaar is voor wielrenners.

---

## 3. Abonnementen en prijzen

3.1 Team **€149 p/mnd · €1.490 p/jr**.

3.2 Sparki Trainer **€99 p/mnd · €990 p/jr**, geldig tot 25 sporters, **inclusief voeding** (`nutrition_specialist`) zonder meerprijs. Het pakket bevat training, analyse én voeding.

3.3 Tweede trainerstaffel tot 50 sporters: **€179 p/mnd · €1.790 p/jr**. Boven de 50: **€9,90 per sporter per maand**, vast bedrag, geen staffelkorting, ingaand bij sporter 51. Geen derde staffel.

3.4 Uitbreiden boven een staffel gebeurt met **direct bijbetalen**. Zakt een trainer terug, dan loopt de hogere staffel door tot het einde van de periode.

3.5 Een sporter telt mee in de limiet **zolang de koppeling bestaat**, ongeacht of hij actief traint. Bij meerdere trainers telt hij bij beiden mee.

3.6 **Club is gratis.** Het verschil met Team is betalingsbereidheid, geen functieverschil.

3.7 De gratis limiet blijft **acht routes per maand**, fiets en wandelen uit één potje.

3.8 **Bij het verlopen van een abonnement hangt het af van wie opzegt:** zegt de club op, dan blijft alles bewaard en zichtbaar; zegt de sporter zelf op, dan wordt het afgeschermd. Gaat hij later weer betalen, dan komt alles terug — niet alleen het laatste jaar. Afgeschermd materiaal blijft bewaard zolang het account bestaat, en de sporter ziet dát er iets is afgeschermd.

3.9 **Clubafname:** een club kan Compleet afnemen voor haar leden, kiest per lid, en wordt maandelijks gefactureerd met staffelkorting in vaste tredes. Een lid dat halverwege de maand wordt toegevoegd krijgt Compleet direct, maar wordt pas de volgende maand verrekend. Verlaat een lid de club, of stopt de club haar afname, dan houdt het lid Compleet nog één maand.

3.10 Had een sporter zelf al Compleet en neemt de club het over, dan betaalt de club en wordt het resterende deel van de eigen betaling terugbetaald. De sporter krijgt daar bericht van.

3.11 Een sporter mag weigeren dat zijn club voor hem betaalt; dat telt als zelf opzeggen (materiaal gaat op slot) en de betaling stopt direct. Hij kan later alsnog akkoord gaan. **De club ziet alleen aantallen**, niet welke leden gebruiken of weigeren.

3.12 Voor jeugdleden mag de club Compleet afnemen, maar **de ouder moet akkoord geven** en mag namens het kind weigeren.

3.13 De diepere analyse met data en grafieken hoort bij **Compleet en het Trainer-abonnement**, niet bij Go.

---

## 4. Accounts verwijderen

4.1 Na accountverwijdering blijft alles **dertig dagen** bewaard; de gebruiker kan ook kiezen voor direct definitief verwijderen. Hij krijgt bericht op het moment van verwijderen, geen aparte herinnering.

4.2 Voor **clubs geldt altijd dertig dagen** — direct definitief verwijderen kan niet. De clubomgeving blijft daarna in een archief bestaan dat de beheerder kan raadplegen; de clubhistorie (auditlog, oude plannen) blijft bereikbaar.

4.3 De eigen gegevens van individuele leden verdwijnen **niet** mee met de clubomgeving. Leden krijgen vooraf bericht. Een gedeeld wedstrijdplan verdwijnt wél mee bij de renner.

4.4 Zowel een individuele sporter als een club krijgt een uitdraai bij verwijdering.

---

## 5. Bewaartermijnen

De zeven besloten termijnen:

| Onderwerp | Termijn |
|---|---|
| Trainingsgegevens na opzegging account | 1 jaar |
| Toestemmingen en gegevens jeugdlid | zolang het kind lid is |
| Clubauditlog | 3 jaar, ook na verwijdering van de club |
| Vertrokken sporter zichtbaar bij de club | 6 maanden |
| Clubberichten en reacties | 1 jaar |
| Routes en ritgegevens | zolang het account bestaat |
| Wedstrijdplannen | bewaard in archief na afloop |

Aanvullend: routegebruiks- en fair-usedata 24 maanden herleidbaar, daarna onomkeerbaar geanonimiseerd. Verstuurde facturen vallen onder de wettelijke fiscale bewaarplicht.

**Actie voor Replit:** lever een toetsvoorstel waarin deze zeven termijnen naast de zes lege configuratiewaarden in de code worden gelegd. René bekrachtigt daarna.

---

## 6. Club — rollen, veiligheid, documenten

6.1 **Elke rol die in Sparki bestaat krijgt een eigen scherm.** Een rol zonder eigen weergave heeft geen waarde. Geen terugval op de atleetweergave.

6.2 **Club en Team komen in de hoofdnavigatie onderin** voor wie een clubrol heeft — Club neemt de positie van Analyse in. Geen zesde item.

6.3 **VOG:** bij het onboarden kan de clubbeheerder alleen trainers toevoegen die een VOG hebben en zet daar zelf een vinkje bij, met **afgiftedatum**. Sparki vraagt het document niet op en controleert niet inhoudelijk. Een VOG blijft **drie jaar** geldig; verloopt die termijn zonder actie, dan **waarschuwt** Sparki — geen blokkade. Alleen clubbeheer ziet wie geen geregistreerde VOG heeft.

6.4 De VOG-eis geldt **alleen bij jeugd en bij structurele rollen**, niet bij incidentele hulp. Een eendaagse helper wordt toegewezen als **gast**.

6.5 Een **vertrouwenscontactpersoon is niet verplicht** voordat jeugd kan instromen.

6.6 **Alleen clubbeheer mag clubdocumenten plaatsen** (gedragscode, ouderafspraken, reglement).

6.7 Bij clubberichten mag **alles als bijlage** worden meegestuurd, video inbegrepen.

6.8 Een **vrijwilliger of meekijkrol ziet niets** in de club totdat hij ergens aan is toegewezen.

6.9 **Herhalende trainingen worden voor een heel seizoen vooruit vastgelegd.**

6.10 Trainingskamp en clubactiviteit worden een **aparte entiteit**, geen soort wedstrijd.

6.11 Er komt een aparte server-side rol **Voedingsdeskundige** (`nutrition_specialist`): stelt voedingsintake, -analyse en -plannen op, koppelbaar aan sporter, team of organisatie, geen diagnose, geen medisch dossier zonder aparte toestemming, bij minderjarigen geen gewichts- of caloriedoelen. Trainer, soigneur en ploegleider zien alleen de uitvoeringsinformatie, niet de analyse eronder. Geen samengevoegd dossier met de trainer.

---

## 7. Wedstrijd en wedstrijdplan

7.1 **Eén wedstrijdplan als gedeeld werkobject.** Ploegleider, mechanieker, soigneur en renner werken in hetzelfde plan en zien elk hun eigen deel. Geen 24 aparte documenttypen met eigen datamodel.

7.2 **Eén gedeelde werkobjectlaag voor het hele product** — ook voor trainingsweken, materiaalplannen en ouderbriefingen. Volgorde: `WORK_OBJECT_CORE_01` → `WORK_OBJECT_COLLAB_01` → `WORK_OBJECT_PILOT_01` met het **dagschema** als pilot.

7.3 **Eén wedstrijd voor iedereen:** `club_race_events` wordt gekoppeld aan `races`, zodat een door de ploegleider aangemaakte wedstrijd meteen in de eigen wedstrijdomgeving van de renner verschijnt. Een parcours koppelen is optioneel; `club_race_events` krijgt het ontbrekende `routeId`-veld.

7.4 **Meerdaagse wedstrijden en etappekoersen worden meegenomen** — begin- en einddatum met etappes in plaats van één `raceDate`.

7.5 **Conflicten worden gesignaleerd als waarschuwing, niet geblokkeerd.** v1 detecteert uitsluitend persoonsdubbeling. Sparki legt geen norm vast voor minimale bezetting.

7.6 **Statussen:** elk plan heeft verplicht concept · gedeeld · afgerond. Een plan mag gedeeld worden terwijl de bezetting nog niet compleet is, met waarschuwing. Een afgerond plan mag alleen de ploegleider nog wijzigen.

7.7 **Delen is de verantwoordelijkheid van de ploegleider**, ook van elke gewijzigde versie. Bij de eerste keer delen krijgt **alleen de staf** bericht, niet de renners.

7.8 **Opmerkingen** zijn alleen zichtbaar binnen het onderdeel waar ze bij horen. **Ook renners mogen opmerkingen plaatsen.** Een renner mag zijn eigen deel aanvullen; alleen de ploegleider krijgt daar bericht van.

7.9 Bij elk deel is zichtbaar **wie het heeft ingevuld, met datum en tijd**. De volledige wijzigingsgeschiedenis is alleen voor de ploegleider. Of staf elkaars deel mag aanpassen bepaalt de ploegleider **per wedstrijd**.

7.10 **Wijzigen twee mensen tegelijk hetzelfde deel, dan waarschuwt Sparki** — geen stille "laatste wijziging wint".

7.11 Een plan kan **gekopieerd** worden als basis voor een volgende wedstrijd; alleen de vaste onderdelen gaan mee, niet de bezetting. Een club kan daarnaast een **eigen sjabloon** vastleggen.

7.12 Een renner kan een gedeeld plan **blijven terugkijken** na afloop. Verlaat een staflid de club, dan blijft wat hij schreef staan.

7.13 Het plan moet **offline beschikbaar** zijn in de app, alleen voor de ploegleider, en offline is **alleen-lezen**.

---

## 8. Wedstrijddag — operatie

8.1 **Dagschema:** optioneel om te mogen delen · **per persoon** (ieder ziet zijn eigen tijden) · een staflid ziet ook de tijden van anderen · vertrektijd en verzamelpunt verplicht, terugkeertijd optioneel · twee taken op hetzelfde tijdstip bij dezelfde persoon → waarschuwing · begint de wedstrijd later, dan verschuift het hele schema mee, maar **de ploegleider bevestigt dat eerst** · bij een wijziging krijgt de hele ploeg bericht, renners inbegrepen.

8.2 **Vervoer** wordt per voertuig ingedeeld, met wie bij wie meerijdt. Chauffeur aanwijzen is optioneel. Meer renners dan plaatsen → waarschuwing. Een renner ziet de hele indeling.

8.3 **Materiaal:** per renner vastleggen is optioneel, één ploeglijst volstaat · de mechanieker vult de lijst in en mag een **eigen sjabloon** vastleggen (van hem, niet van de club) · de lijst begint per wedstrijd opnieuw · afvinken bij het inladen is verplicht mogelijk · de ploegleider ziet of het is afgevinkt · vertrekken met openstaande punten → waarschuwing.

8.4 **Taken:** taakverdeling optioneel · de ploegleider wijst toe, de teammanager mag dat ook · tijdstip optioneel · een staflid mag weigeren **met verplichte reden** · de ploegleider krijgt bericht · een geweigerde taak blijft open · afvinken is verplicht mogelijk en de ploegleider krijgt bericht · openstaande taken bij vertrek → waarschuwing.

8.5 **Briefings** per rol zijn optioneel; lezen volstaat, geen bevestiging; een staflid ziet ook de briefings van anderen.

8.6 **Renneropdrachten** (kopman, knecht, vrije rol) zijn optioneel · elke renner ziet die van al zijn ploeggenoten, ook reserverenners · de ploegleider kan ze op de dag zelf wijzigen · de renner krijgt direct bericht · **geen versiehistorie**: de oorspronkelijke opdracht blijft niet zichtbaar.

8.7 **Uitslagen** zijn optioneel, worden handmatig ingevoerd door ploegleider of renner, komen ook in de eigen wedstrijdhistorie van de renner, en **zowel staf als renners zien ze terug**.

8.8 **Ploegevaluatie** is optioneel · iedereen mag schrijven, staf én renners · renners zien elkaars bijdragen · sluit **een week** na de wedstrijd, blijft daarna leesbaar · geen herinnering vooraf · de termijn is niet te verlengen.

8.9 **Teammanager:** kan alles wat de ploegleider kan, plus het recht diens besluiten te overrulen — **alleen bij wedstrijden**. De ploegleider ziet precies wat er veranderd is, krijgt bericht, en mag een overrule **niet terugdraaien**. De ploegleider blijft eindverantwoordelijk voor het plan en blijft degene die deelt. De teammanager mag zelf een wedstrijd aanmaken; de ploegleider vult die verder in en wordt de ploegleider van dat plan.

8.10 **Vervanging:** optioneel per wedstrijd · de vervanger mag alles wat de ploegleider mocht · neemt **niet automatisch** over, iemand activeert handmatig · alleen de teammanager activeert (heeft de club er geen, dan de ploegleider zelf) · de hele ploeg krijgt bericht · komt de ploegleider terug, dan gaat het automatisch weer naar hem · na afloop is niet meer zichtbaar dat er een vervanger is geweest.

8.11 **Gasten:** krijgen toegang via e-mail of link, zonder eigen account · zien **het hele wedstrijdplan** · toegang verdwijnt direct na de wedstrijddag · kan ook voor een meerdaagse · de link vervalt na afloop en kan tussentijds worden ingetrokken · gebruik wordt niet geteld · ploegleider én teammanager mogen toevoegen · wie toevoegt vinkt aan daarvoor verantwoordelijk te zijn · in de historie blijft zichtbaar dat er een gast was.

8.12 **Noodinformatie:** uitsluitend zichtbaar voor **ploegleider en medical_staff**, altijd (niet alleen rond de wedstrijddag). Inzage wordt **voor beiden gelogd**. De sporter of ouder ziet **wie er heeft gekeken en wanneer**. Het inzagelog blijft bewaard zolang de koppeling loopt. De teammanager ziet dezelfde noodinformatie, op dezelfde manier gelogd. Mechanieker en soigneur zien uitsluitend **naam en of de renner rijdt**.

8.13 Bij afmelding voor een **wedstrijd** schuift de reserve **niet** automatisch door — de ploegleider doet dat zelf. Bij een **training** schuift de reserve wél door mét notificatie. Die asymmetrie is bewust.

8.14 Twee wedstrijden op dezelfde dag met dezelfde ploegleider → waarschuwing, geen blokkade.

---

## 9. Jeugd en ouders

9.1 **`parentConsentStatus` mag worden gezet door de gekoppelde ouder of door de club namens een geregistreerde ouder.** De minderjarige zelf is geblokkeerd (403 + auditlog). Geen gedoogperiode. De club-route moet nog gebouwd worden.

9.2 **Gelaagde leeftijdsgrenzen 16 en 18**, niet één grens op 18. Bij onbekende geboortedatum geldt de strengste regel.

9.3 **Een minderjarige mag niet alles voor de ouder afschermen** — gezondheid en herstel blijven altijd zichtbaar. `dataSharingParent = "none"` mag bij een minderjarige dus niet alles dichtzetten.

9.4 **Beeld-AI blijft toegestaan voor minderjarigen** (maaltijdfoto, stijlanalyse); **AI die gezondheidsvragen stelt wordt geblokkeerd**.

9.5 **De ouderomgeving komt ook native in de mobiele app.**

9.6 **Wordt een jeugdlid 18, dan stopt de ouderkoppeling automatisch** — geen bevestiging door het kind. Delen met de trainer valt daarbij uit; de trainerkoppeling zelf blijft. Trainer en sporter krijgen **een week vooraf** bericht. De historie blijft volledig bewaard en de sporter kan delen daarna direct zelf weer aanzetten.

9.7 Wordt de ouder-kindkoppeling verbroken, dan blijft **wat de ouder zag zichtbaar in de historie bij het kind**.

9.8 Blijvende jeugdgrenzen: geen gewichts- of calorieadvies · geen 1RM-doelen · geen zware belastingvoorschriften · "niet meer tonen" bestaat niet voor minderjarigen · acute meldingen zijn niet negeerbaar · geen blessurerevalidatie zonder bevoegde begeleiding · stopregel bij pijn permanent zichtbaar.

9.9 Een minderjarige negeert **nooit** een planwijziging, ook niet een niet-acute.

---

## 10. Zelfstandige trainer

10.1 **Sparki Trainer is een betaald abonnement.** Het eerdere besluit K-6 (rol zonder commerciële laag tot na de pilot) is daarmee vervallen.

10.2 **Sparki ondersteunt facturatie door de trainer aan zijn eigen klanten.** Verkoopfacturen en betaalstatus in Sparki; volledige boekhouding blijft extern. **Geen boekhoudpakket bouwen.**

10.3 **Een klantbetaling komt binnen op de rekening van de trainer zelf**, via diens eigen aangesloten account. Sparki komt niet in die geldstroom te staan.

10.4 **Sparki nummert de facturen door**, per trainer een eigen doorlopende reeks, beginnend bij **`2026-0001`** (jaartal plus volgnummer).

10.5 **Standaard 21% btw**, met ondersteuning voor de **kleineondernemersregeling** (factureren zonder btw overschrijft de standaard).

10.6 Een verstuurde factuur is **onveranderlijk**; corrigeren alleen met creditnota. Geen gezondheidsinformatie op een factuur. Facturen van de ene trainer nooit zichtbaar voor een andere. **Klant en sporter zijn twee aparte velden.**

10.7 Zegt een trainer op, dan blijven zijn verstuurde facturen **uitsluitend downloadbaar** — niet zichtbaar in de omgeving, niet verwijderd.

10.8 De **begeleidingsovereenkomst moet digitaal ondertekend** kunnen worden, niet alleen bevestigd.

10.9 **Stopt de trainer, dan kan de sporter zelfstandig door** — geen alleen-lezen, geen afsluiting. De data blijft bij de sporter.

10.10 **Koppelingen:** een sporter mag aan meerdere trainers gekoppeld zijn; die trainers zien elkaars schema's niet, de sporter ziet beide naast elkaar. Koppelt een trainer een sporter die al bij een ander loopt → waarschuwing, geen blokkade. Plannen twee trainers op dezelfde dag een zware training → waarschuwing die **alleen de sporter** ziet.

10.11 Een nieuwe trainer ziet de historie **alleen vanaf het moment van koppeling**, en ziet niet dat de sporter eerder bij een andere trainer liep.

10.12 Verbreken: wie ook verbreekt, de ander krijgt bericht **zonder reden**. De trainer ziet direct niets meer, geen nalooptermijn, en houdt alleen wat hij zelf maakte. De schema's blijven ook bij de sporter. De oude koppeling blijft in de historie van beiden zichtbaar; opnieuw koppelen vraagt opnieuw akkoord van de sporter.

10.13 **Rechten volgen de rol, niet het abonnement.** Wedstrijden organiseren hangt aan de ploegleidersrol, niet aan het Trainer-abonnement. Eén persoon mag zowel zelfstandig trainer zijn als een club draaien binnen hetzelfde account.

---

## 11. Kennis en AI-vragen

11.1 **Sparki schrijft de kennisinhoud zelf** — niet uitbesteed, niet gemengd. **Niemand toetst vooraf.** Bij elk artikel staat een bron en wanneer het voor het laatst is bijgewerkt. Er hoeft niet zichtbaar te zijn dat het niet door een deskundige is getoetst.

11.2 **Jeugdinhoud wordt apart gemarkeerd** voor training en materiaal.

11.3 **Geen jeugdvoedingsinhoud** — breed, dus ook geen AI-prompts, niet alleen artikelen. **Maar:** stelt een jeugdlid zelf een vraag over eten, dan antwoordt Sparki wél, **zonder getallen** — geen calorieën, geen macro's, geen gewichtsdoelen.

11.4 **De ouder ziet niet welke vragen zijn kind stelt.** Vragen en antwoorden blijven bewaard in het account van het jeugdlid.

11.5 De kennisartikelen zitten **alleen in Compleet**. De **AI-vraagfunctie zit in het gratis pakket**: twintig vragen per maand, uit een apart potje los van de acht routes. In Compleet onbeperkt. Een gratis gebruiker krijgt **hetzelfde antwoord**, geen kortere versie, met verwijzing naar het artikel als dat achter Compleet zit.

---

## 12. Wetenschappelijke actualiteit

12.1 Sparki controleert **dagelijks zelf** of inzichten zijn herzien. Geen menselijke beoordelaar. Vaste lijst van websites, geen vrij zoeken.

12.2 De bronlijst heeft twee lagen: **vindlaag** (KnowledgeIsWatt, vakbladen, KNWU-kennisplatform) signaleert · **bewijslaag** (peer-reviewed onderzoek en richtlijnen van instanties) bevestigt.

12.3 **Bewijsdrempel — onderin de sportwetenschappelijke bandbreedte.** Bevestigd = één meta-analyse of systematische review, óf twee onafhankelijke onderzoeken in dezelfde richting, óf één richtlijn van een gezaghebbende instantie. Alles daaronder is **signaal** en wordt getoond als "mogelijk interessant" zonder iets aan te sturen. Bevestiging telt alleen uit de bewijslaag.

12.4 **Gevolgweging.** Bij een **groot gevolg** blijft het altijd een voorstel aan René, ook bij bevestiging. Groot gevolg is: gezondheid en herstel · voeding · alles rond jeugd · zware belasting en blessurerisico. Bij een **klein gevolg** past Sparki het zelf toe en meldt achteraf. Bij een voorzichtig geformuleerde conclusie blijft het sowieso advies.

12.5 **Afgekeurde signalen worden bewaard met reden van afwijzing**, zodat hetzelfde onderzoek niet elke maand opnieuw langskomt.

12.6 Voor de gebruiker is **zichtbaar** wanneer een advies op herzien inzicht is aangepast.

---

## 13. Doelen

13.1 Vrije invoer blijft mogelijk; **Sparki vertaalt die naar een meetbaar doel** en laat het bevestigen. Lukt dat niet: **maximaal twee keer doorvragen**, dan stelt Sparki zelf het dichtstbijzijnde meetbare doel voor. Wijst de sporter dat af, dan volgt een **meerkeuze**. Nooit een onbewaakt doel.

13.2 Drie doelsoorten: **event** (wedstrijd + datum) · **prestatie** (FTP, PR op een klim) · **gedrag** (uren per week, volgehouden weken, herstel).

13.3 **Leeftijdsbanden, serverzijdig afgedwongen:**

| Band | Doelvorm |
|---|---|
| < 14 | schuifbalk per thema (plezier · minder moe · beter klimmen · langer volhouden), **geen enkele meetwaarde** |
| 14–16 | event · gedrag · prestatie in **absoluut vermogen** |
| 16–18 | alles behalve w/kg, gewicht en 1RM |
| 18+ | alles |

13.4 **De sporter stelt zijn eigen doel vast**, ook met een trainer erbij. De trainer mag **voorstellen**; de sporter accepteert of weigert, met **optionele** reden. De trainer krijgt altijd bericht bij een weigering.

13.5 De sporter mag **naast het trainerdoel een eigen doel** zetten. Het **sporterdoel leidt**, maar het trainerdoel wordt **óók bewaakt**. Loopt de sporter achter op het trainerdoel, dan zien sporter én trainer dat.

13.6 Een doelvoorstel maakt doelen **automatisch zichtbaar voor die trainer**, los van de deelschakelaar voor adviezen. Dat is bewust een tweede deelregel en moet in beide schermen benoemd worden. Bij accepteren toont Sparki expliciet: *"hiermee ziet je trainer je doelen en je voortgang, zolang dit doel bestaat."*

13.7 Die inzage is **niet uit te zetten** zolang het trainerdoel bestaat. De sporter mag het trainerdoel wél altijd zelf **verwijderen**.

13.8 Bij minderjarigen **keurt het kind zelf goed** en kan de ouder bijsturen. Een **droomdoel mag blijven staan**; bijsturen speelt alleen bij een onrealistisch meetbaar doel.

---

## 14. Delen van adviezen met de trainer

14.1 **De trainer ziet uitsluitend wat de sporter deelt.** Delen is **één schakelaar**, niet per advies, en staat bij een nieuwe koppeling **standaard uit**.

14.2 De sporter ziet pas dat zijn trainer kan meekijken **wanneer hij deelt** — geen permanente melding.

14.3 De trainer krijgt bericht wanneer delen wordt aangezet, en **mag reageren** op een gedeeld advies; die reactie staat **bij het advies**.

14.4 Zet de sporter delen uit, dan **verdwijnen gedeelde adviezen én trainerreacties direct**.

14.5 Bij een minderjarige beslist **de ouder** over delen **en de minderjarige moet ook akkoord geven**. De ouder ziet die adviezen zelf ook, en **alles wat de trainer terugschrijft**.

14.6 **Een overtrainingssignaal gaat bij een minderjarige ook naar de ouder, óók als delen uitstaat.** Het kind ziet dezelfde melding, zachter geformuleerd; de ouder ziet **precies dezelfde melding**, niet samengevat. Een jeugdlid weet **vooraf** welke signalen altijd naar zijn ouder gaan.

---

## 15. Data en advies

15.1 **De bron die de gebruiker zelf instelt wint** bij conflicterende waarden, ingesteld **bij de eerste koppeling**. Is die keuze er nog niet en komt dezelfde rit via twee bronnen binnen, dan vraagt Sparki het. Is de keuze er wél, dan wordt een afwijking **stil** verwerkt.

15.2 Een niet-gekozen dubbele rit blijft **onbeperkt** bewaard. De voorkeursbron is te wijzigen, maar geldt **alleen voor nieuwe ritten**.

15.3 **Per brontype** wordt ingesteld hoe lang een gegeven bruikbaar blijft. Een verouderde meting mag nog gebruikt worden, **met waarschuwing**.

15.4 De import uit Strava en Garmin haalt de **volledige historie**, maar **gefaseerd**. Slaap, stress en subjectief gevoel komen daar niet mee.

15.5 **Subjectief gevoel wordt alleen na zware ritten uitgevraagd.** Bij onboarding mogen vijf tot acht of meer contextvragen gesteld worden.

15.6 **Sparki moet bij elk advies altijd kunnen tonen waarop het gebaseerd is.** Bij te weinig gegevens geeft Sparki wél advies, met **zichtbaar voorbehoud** — dat voorbehoud staat achter een doorklik, **behalve bij gezondheid en herstel**, daar direct zichtbaar. **Uitzondering: bij minderjarigen zwijgt Sparki** als er te weinig gegevens zijn voor een gezondheids- of hersteladvies.

15.7 Bestaande adviezen worden **niet met verzonnen waarden aangevuld** maar gemarkeerd als `LEGACY_NIET_VOLLEDIG_HERLEIDBAAR`.

15.8 **Gezondheidssignalen zijn observatie met doorverwijzing, nooit vaststelling van een aandoening.**

15.9 Plant iemand een rit bij slechte herstelwaarden → **waarschuwing**, geen blokkade, ook bij minderjarigen. Traint iemand structureel te hard → **directe melding**.

15.10 De trainer krijgt een **groepsoverzicht met signalen**: wie aandacht nodig heeft, in één beeld.

---

## 16. Routeplanner en navigatie

16.1 **Hoofdhandeling: kiezen uit bestaande routes, of via filteren een route laten maken.** Niet zelf tekenen. De planner is in de eerste plaats voor de renner zelf.

16.2 **Schermmodel volgt de lijn van Komoot:** kaart op circa 80% · zoekveld en driepuntsmenu bovenop de kaart · filters als bolletjes op de kaart, waarvan **het eerste het trainingstype is** · kaartbediening rechtsonder · sleep-open blad met routefoto's · vast menu van vijf onderin met Club op de positie van Analyse.

16.3 Bij het starten van een route **legt de navigatielaag zich over dezelfde kaart** — geen apart navigatiescherm.

16.4 **De route past zich aan de training aan** (Compleet): interval → na de warming-up rechte stukken, weinig bochten · duurtraining → mag recreatief met bezienswaardigheden · herstel → geen heuvels. **Vaste regel ongeacht training: geen woonwijken** — ook bij een vrije rit.

16.5 Staat er een training in het schema voor vandaag, dan **doet de planner daarvoor een voorstel dat je kunt overslaan**.

16.6 Een route uit de bibliotheek **mag je aanpassen**: punt verslepen · waypoint toevoegen · inkorten of verlengen · **klimmetjes toevoegen** (kiezen uit klimmen in de buurt van de route, niet zoeken op naam).

16.7 **De bibliotheek vult zich uit alle bronnen tegelijk:** eigen ritten · routes van andere gebruikers · import van Strava en Garmin · door Sparki samengesteld. Heeft iemand niets gekoppeld en nog niets gereden, dan toont de bibliotheek routes uit de buurt van anderen plus samengestelde routes — **niet meteen om koppelen vragen**.

16.8 **Routes van andere gebruikers zijn openbaar voor iedereen.** Begin en eind worden **afgekapt** zodat het huisadres van de maker niet zichtbaar is.

16.9 **Koffieplekjes en eetadresjes komen uit een bestaande kaartbron**; gebruikers voegen ze niet zelf toe.

16.10 **Vrienden live op de kaart:** alleen wederzijds geaccepteerde vrienden · standaard uit, **per vriend afzonderlijk** aan te zetten · alleen tijdens een rit, daarna stopt het vanzelf · **grofmazig**, een gebied en geen punt · **jeugdleden komen niet live op de kaart.**

16.11 **Onderweg getoonde data hangt af van wie je bent:** wandelen = afstand, te gaan, totaal, snelheid · gewone fietser = idem plus accu · wielrenner, mtb, gravel = idem plus alles via ANT+ en Bluetooth. E-bikebereik toont **"onbekend"** zonder bron.

16.12 De sfeerfoto's mogen gebruikt worden voor het dagvoorstel, lege toestanden en kopjes — **nooit om een specifieke route te duiden**. Daarvoor een kaartuitsnede met de lijn of het hoogteprofiel.

---

## 17. Mobiel

17.1 **Alle rollen komen in de mobiele app**, allemaal al bij de eerste publieke versie, en **elke rol krijgt in de app hetzelfde als in de browser**. De browserversie blijft naast de app bestaan.

17.2 Sommige functies horen **alleen in de app**: navigeren tijdens de rit en de wedstrijddagmodus.

17.3 Een clubbeheerder kan zijn werk **optioneel** op de telefoon doen; het blijft grotendeels bureauwerk.

17.4 **Offline werken gaat uit de eerste versie** en komt bij een tweede update. Dan geldt: alles wat je opent werkt offline, en offline is alleen-lezen.

17.5 Vaste **eerste mobiele prioriteit per rol:** Sporter → Vandaag · Trainer → Trainingen · Hoofdtrainer → Groepen · Clubbeheerder → Organisatie · Teammanager → Teams · Ploegleider → Wedstrijddag · Mechanieker → Materiaal · Soigneur → Voeding · Medical Staff → Gezondheid · Ouder → Kind · Gast → Introductie · Admin → Systeemstatus.

17.6 **Vaste posities, rolgebonden labels:** aantal, volgorde, plaats en icoon van de vijf hoofditems zijn voor alle rollen gelijk; alleen de naam mag verschillen. Positie 5 heet altijd **Meer**.

17.7 **De actieve context is permanent zichtbaar op elk scherm.** Rolwisselen mag altijd, ook tijdens de wedstrijddagmodus, **zonder bevestigingsstap**. Het zoekveld in de rolwisselaar verschijnt vanaf **meer dan vijf** contexten.

17.8 Een ouder met meerdere kinderen krijgt **één overzicht over alle kinderen**. Een trainer met meerdere groepen krijgt **géén** groepsoverstijgende context.

---

## 18. Wandelen

18.1 Wandelen hoort bij **Gratis en Go**, afgebakend tot routeplanning en navigeren, met **één potje** voor de gratis maandlimiet.

18.2 **Uitzondering op de afbakening:** wandelingen terugzien mag wél analyse bevatten — afstand, tijd, gemiddelde snelheid, hoogtemeters en profiel, tempo per kilometer, hartslag — en ook vergelijken over tijd. Bron: zowel wat in Sparki genavigeerd is als wat uit Strava en Garmin binnenkomt.

18.3 **Wandelen wordt uitgerold zodra de fietsketen bewezen is** — niet wachten op de clubmodules, niet uitstellen tot na de release.

---

## 19. Merk

19.1 **De bliksemschicht vervalt volledig.** De merkidentiteit is het woordmerk SPARKI plus het S-symbool opgebouwd uit richtingspijlen. Oude logo's worden gemarkeerd als `INGETROKKEN`.

19.2 **Let op — dit ligt stil:** het S-beeldmerk met richtingspijlen is niet gevonden in de repo (volledige historie, 1227 commits) en niet in Figma. Alle aanwezige beeldmerken zijn bliksemschicht-varianten. Er is niets nieuws getekend. Tot het bronbestand er is, blijft het huidige productiebeeldmerk staan waar technisch nodig.

---

## 20. Uitleg, media en Academy

20.1 **Uitlegvideo's en Academy worden uitgerold zodra de fietsketen bewezen is** — niet na de clubmodules, niet pas na de release.

20.2 **Navigatie:** Hulp & ondersteuning → Uitleg en Academy, met "Sparki gebruiken" (altijd gratis) en "Beter fietsen en trainen" (Compleet). **Geen zesde hoofditem.**

20.3 **Grens:** `MEDIA_UITLEG_01` beheert de weergave (speler, diepte, uitlegflow, voortgang, toegankelijkheid); `KENNIS_01` beheert inhoud, bronvermelding, licentie, leeftijdsgeschiktheid en publicatiestatus. **Geen dubbele contentarchitectuur.**

20.4 **Mobiele data:** standaard geen videodownload, bewust per apparaat toe te staan en weer uit te schakelen; poster en volledige tekstvariant blijven beschikbaar; **geen stille download of prefetch**.

20.5 **Geen pratende 3D-avatar.** Alleen een rustig zwevend paneel met tekst, reden en actieknoppen. Alle coachadviezen uit echte gebruikersdata, geen mock. De zwevende coachmelding is **uitsluitend niet-acuut**; acute meldingen blijven in de bestaande veiligheidslaag.

---

## 21. Kleine standaardinstellingen

21.1 Bewaartermijn importrijen bij clubonboarding: **30 dagen**.

21.2 Clublogo: maximaal **5 MB**, formaten JPG, PNG, WebP, SVG.

---

## 22. Wat nog echt open is

- **De sitelijst voor de wetenschapslaag** — Claude stelt een voorstel op, René bekrachtigt. Blokkeert alleen fase F10 van de intelligentielaag.
- **Jaarprijs bij €179-staffel** is vastgesteld op €1.790; overige prijsdetails van hogere tiers zijn gedekt.
- **`AIE2 O-11`** — welke bestaande adviesvormen alsnog een dossier krijgen. Beantwoord in F1 op basis van de inventarisatie uit F0.
- **De hergebruikmatrix (F0 van de intelligentielaag)** — blokkeert alle volgende fasen van dat pakket.
- **`O-2` bij doelen** — wat "bijsturen" door de ouder concreet mag. Tot dat besluit alleen meekijkrecht bouwen.
- **De zes bewaartermijnen in code** — toetsvoorstel door Replit, zie hoofdstuk 5.
- **Besluitregister** — de nummers `-006` t/m `-013` zijn nog niet vastgelegd; de nummerreeks moet opgeschoond worden voordat nieuwe nummers worden toegekend.
