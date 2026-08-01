# SPARKI — MOBIELE PATRONEN v1.0

**Technische code:** `MOBILE_UX_STANDARD_01` — oplevering 4 van 5
**Hoort bij:** `SPARKI_MOBILE_UX_STANDARD_v1.4.md`, `SPARKI_MOBILE_COMPONENT_LIBRARY.md`, `SPARKI_ROLE_BASED_MOBILE_FLOWS.md`
**Status:** BINDEND, afgeleid. Geen nieuwe MUX-regels, geen nieuwe componenten, geen productbesluiten.
**Datum:** 1 augustus 2026

---

## 0. Wat een patroon is

De drie eerdere documenten beschrijven **regels** (wat moet), **componenten** (waarmee) en **rollen** (voor wie). Dit document beschrijft **patronen**: de terugkerende oplossing voor een situatie die in Sparki telkens opnieuw opduikt.

Een patroon is geen nieuwe regel. Het is de afgesproken manier waarop bestaande regels en componenten worden gecombineerd, zodat dezelfde situatie in elk pakket hetzelfde oplost.

**Patrooncodes.** `PAT-nn`. Dezelfde governance als MUX-95: nieuwe patronen krijgen een nieuwe code, codes worden nooit hergebruikt, bouwpakketten en bevindingen verwijzen naar de code.

**Vaste opbouw per patroon:** situatie · patroon · componenten · regels · antipatroon · Sparki-voorbeeld.

**Het antipatroon is het belangrijkste veld.** Het benoemt de oplossing die vanzelf ontstaat als niemand oplet. Mirror zoekt daarnaar.

---

## 1. Binnenkomst en oriëntatie

### PAT-01 — First usable interaction
**Situatie:** een scherm met een zware laag (kaart, grafiek, profiel, beeld) waar de gebruiker iets wil doen.
**Patroon:** de kernbediening staat bovenaan de laadvolgorde en werkt zelfstandig. De zware laag komt erna, in ruimte die al gereserveerd was.
**Componenten:** CMP-13, CMP-17, CMP-31.
**Regels:**
- Kernbediening eerst, secundaire inhoud daarna (MUX-98a, b).
- Bedienbaar, niet alleen zichtbaar (MUX-98d).
- Eén trage bron blokkeert nooit het hele scherm (MUX-98g).
- Skeleton reserveert de definitieve ruimte, zodat niets verspringt (MUX-93d, MUX-98f).
- Getoetst op een gevuld account én een trage verbinding (MUX-98h).
**Antipatroon:** het scherm wacht tot de kaart klaar is en toont dan alles tegelijk. Voelt "netjes", en is de meest voorkomende manier om MUX-98 te overtreden.
**Sparki:** pagina Klimmen — zoekveld en resultaten werken; kaart en hoogteprofiel laden pas na selectie.

### PAT-02 — Rolintroductie
**Situatie:** eerste login, of een rolomgeving die nog leeg is.
**Patroon:** in plaats van een lege lijst toont het scherm wie je bent, waarvoor, wat je kunt, wat ontbreekt, en één eerste actie.
**Componenten:** CMP-14, daarna CMP-29.
**Regels:**
- De vijf verplichte onderdelen (MUX-100).
- Geen generiek welkom, geen fictieve personen, geen voorbeelddata (MUX-100a, b; MUX-51).
- Ontbrekende toewijzing noemt de verantwoordelijke (MUX-100d).
- Verdwijnt pas bij een echte toewijzing én een echte taak; blijft daarna oproepbaar via CMP-27 (MUX-100h).
**Antipatroon:** "Welkom bij Sparki!" met een illustratie. Vriendelijk, en volstrekt onbruikbaar voor een mechanieker die wil weten wat er vóór zaterdag klaar moet zijn.
**Sparki:** nieuwe soigneur die aan een team is gekoppeld maar nog geen dagschema heeft.

### PAT-03 — Eerlijke leegte
**Situatie:** er is niets te tonen.
**Patroon:** zeg wat er normaal staat, waarom het er niet is, wie dat oplost, en wat de gebruiker nu doet.
**Componenten:** CMP-29.
**Regels:**
- Vier verplichte elementen, altijd (MUX-48).
- Acht toestanden gedekt of expliciet niet van toepassing (MUX-49).
- "Geen open acties" is positief nieuws, geen leegte (MUX-50).
- Nooit voorbeelddata om het scherm te vullen (MUX-51).
**Antipatroon:** leegte verbergen met demodata, of leegte tonen als storing. Beide leren de gebruiker het scherm te wantrouwen.
**Sparki:** "Je hebt nog geen gekoppelde trainer. Je clubbeheerder kan die koppelen. Koppeling aanvragen."

---

## 2. Handelen

### PAT-04 — Eén taak per scherm
**Situatie:** een scherm waar meerdere dingen zouden kunnen.
**Patroon:** één primaire actie onderaan, maximaal drie secundaire zichtbaar, de rest achter het overloopmenu.
**Componenten:** CMP-07, CMP-05, eventueel CMP-06.
**Regels:** MUX-12, MUX-13, MUX-22, MUX-38. FAB en vaste actiebalk sluiten elkaar uit.
**Antipatroon:** vijf gelijkwaardige knoppen naast elkaar, omdat niemand durfde te kiezen. De gebruiker kiest dan ook niet.
**Sparki:** wedstrijdbezetting — "Bezetting bevestigen" is primair; delen, exporteren en verwijderen zitten in het overloopmenu.

### PAT-05 — Kiezen boven typen
**Situatie:** een gegeven moet worden vastgelegd.
**Patroon:** afleiden als het kan, kiezen als het moet, typen als laatste redmiddel.
**Componenten:** CMP-25, CMP-19, CMP-20, pas dan CMP-23.
**Regels:** MUX-09, MUX-44 (vooringevuld), MUX-16 (maximaal drie velden per stap), MUX-47 (optioneel niet in de hoofdstroom).
**Antipatroon:** een leeg tekstveld voor iets wat het systeem al weet. Elke keer dat de gebruiker iets intypt wat Sparki kon invullen, is een ontwerpfout.
**Sparki:** afmeldreden uit een korte lijst in plaats van een vrij tekstveld.

### PAT-06 — Onderbreekbare taak
**Situatie:** een taak van meerdere stappen op een toestel dat onderbroken wordt.
**Patroon:** opslaan per stap, hervatten met een zichtbare regel, samenvatting vóór bevestigen.
**Componenten:** CMP-21, CMP-22, CMP-24, CMP-15.
**Regels:** MUX-11, MUX-41, MUX-42, MUX-43, MUX-64.
**Antipatroon:** een formulier dat alles pas bij "opslaan" bewaart. Eén telefoontje en het werk is weg — en de gebruiker begint er niet nog eens aan.
**Sparki:** clubonboarding, halverwege verlaten en de volgende dag hervat.

### PAT-07 — Bevestigen naar zwaarte
**Situatie:** de gebruiker doet iets met gevolgen.
**Patroon:** omkeerbaar → doen en achteraf bevestigen met ongedaan maken. Onomkeerbaar → vooraf bevestigen met benoemd gevolg.
**Componenten:** CMP-32 respectievelijk CMP-26.
**Regels:** MUX-40 (benoem wat verdwijnt), MUX-31 (max twee knoppen), MUX-55 (nooit lokaal bevestigen zonder server), MUX-23 (destructief niet in de duimzone).
**Antipatroon:** overal een "weet je het zeker?". Wie tien keer per dag bevestigt, leest de elfde niet meer — precies de keer dat het ertoe deed.
**Sparki:** taak afvinken → CMP-32. Renner definitief uit de selectie → CMP-26.

### PAT-08 — Functie naar hoofdtaak
**Situatie:** een functie die op zichzelf niets afmaakt.
**Patroon:** het scherm benoemt de hoofdtaak waar de functie bij hoort en biedt de vervolgstap aan.
**Componenten:** CMP-12, CMP-15.
**Regels:** MUX-99 in zijn geheel; MUX-88 voor het einde van de flow; MUX-81a voor de belofte van de knop.
**Antipatroon:** een mooi detailscherm zonder uitgang — de gebruiker kijkt ernaar, drukt op terug, en heeft niets gedaan. Dit is de meest verleidelijke fout in het hele document, omdat zo'n scherm er af uitziet.
**Sparki:** klim bekijken → "Toevoegen aan route". Analyse → "Plan aanpassen".

### PAT-09 — Inspiratie met uitgang
**Situatie:** een verkennings- of ontdekpagina zonder directe taak.
**Patroon:** verkennen mag, maar elke route eruit leidt naar een uitvoerbare hoofdtaak.
**Componenten:** CMP-08, CMP-12, CMP-13.
**Regels:** MUX-99c; de keten uit hoofdstuk 5 van het rolflowdocument.
**Antipatroon:** een ontdekpagina als eindbestemming. Leuk om te maken, en de gebruiker komt er niet verder.
**Sparki:** klimmen ontdekken → route maken → navigeren → analyse.

---

## 3. Wachten, veranderen en falen

### PAT-10 — Progressief tonen
**Situatie:** gegevens komen uit meerdere bronnen met verschillende snelheid.
**Patroon:** tonen wat binnen is, per onderdeel laden, per onderdeel een eigen toestand.
**Componenten:** CMP-31, CMP-30.
**Regels:** MUX-56, MUX-57, MUX-58, MUX-94a–f.
**Antipatroon:** één laadscherm voor het hele scherm. De traagste bron bepaalt dan de ervaring van alles.
**Sparki:** dagschema waarvan de bezetting sneller binnen is dan het weerbericht.

### PAT-11 — Aankondigen in plaats van verschuiven
**Situatie:** er komt nieuwe informatie binnen terwijl de gebruiker kijkt.
**Patroon:** een zichtbare aanduiding dat er iets nieuws is; de gebruiker bepaalt wanneer het in beeld komt.
**Componenten:** CMP-28, CMP-08, CMP-31.
**Regels:** MUX-93 in zijn geheel; ververs alleen het betreffende component; geen verlies van invoer; raakt het de lopende taak, dan onderbreken mét uitleg en keuze (MUX-93e).
**Antipatroon:** de lijst ververst zichzelf net terwijl de duim naar beneden gaat, en de gebruiker tikt op het verkeerde item. Dit is de fout die gebruikers niet melden maar wel onthouden.
**Sparki:** een renner meldt zich af terwijl de ploegleider de bezetting invult.

### PAT-12 — Eerlijk offline
**Situatie:** geen verbinding.
**Patroon:** een gestarte navigatie loopt door; al het andere zegt wat het niet kan en waarom.
**Componenten:** CMP-30, CMP-29.
**Regels:** MUX-53, MUX-54 (geen wachtrij), MUX-55 (geen lokale bevestiging), MUX-10 (nooit stille onzekerheid).
**Antipatroon:** de knop lijkt te werken en de melding "verzonden" verschijnt lokaal. De gebruiker denkt dat het geregeld is. Dit is de gevaarlijkste fout in het hele pakket, want hij komt pas aan het licht als het misgaat.
**Sparki:** ploegleider in een dal zonder bereik die een vervanging wil doorgeven.

### PAT-13 — Herstel na verbinding
**Situatie:** de verbinding is terug.
**Patroon:** automatisch opnieuw ophalen, met een zichtbare uitkomst.
**Componenten:** CMP-30.
**Regels:** MUX-53a — vier uitkomsten, benoemen wat bij gedeeltelijk succes ontbreekt, geen dubbele poging, geen stille achtergrondactie, en uitsluitend ophalen, nooit alsnog versturen.
**Antipatroon:** stil bijwerken. De gebruiker weet niet of hij naar oude of nieuwe gegevens kijkt, en gaat verversen uit wantrouwen.
**Sparki:** dagschema dat na een tunnel weer bijwerkt.

### PAT-14 — Fout zonder techniek
**Situatie:** er gaat iets mis.
**Patroon:** in gewone taal zeggen wat er is, bij het onderdeel waar het misging, met wat de gebruiker nu doet.
**Componenten:** CMP-29, CMP-23.
**Regels:** MUX-45, MUX-52, MUX-48 (dezelfde vier elementen).
**Antipatroon:** een foutcode of een veldnaam uit de database. De gebruiker kan er niets mee, en de supportzaak die volgt kost meer dan de fout zelf.
**Sparki:** mislukte synchronisatie van een activiteit.

---

## 4. Rol en context

### PAT-15 — Vaste plattegrond, wisselende inhoud
**Situatie:** een gebruiker met meer dan één rol.
**Patroon:** de navigatie blijft identiek; alleen wat erachter zit verandert.
**Componenten:** CMP-01, CMP-02.
**Regels:** MUX-14a–f; contextwissel altijd zichtbaar (MUX-62); nooit vanzelf.
**Antipatroon:** per rol een eigen menu. Voelt logisch bij het bouwen van één rol, en maakt de app onleerbaar voor iedereen met twee.
**Sparki:** trainer die zelf rijdt en ook ouder is van een jeugdlid.

### PAT-16 — Context binnen een rol
**Situatie:** dezelfde rol, andere situatie — thuis tegenover langs de weg.
**Patroon:** de volgorde en prominentie van informatie verandert; navigatie en rechten niet.
**Componenten:** CMP-02, CMP-08, CMP-09.
**Regels:** MUX-97a–g. Automatisch wisselen alleen op een controleerbaar feit, altijd aangekondigd, altijd handmatig terug te draaien.
**Antipatroon:** de app "raadt" de context uit locatie of tijdstip en zet het scherm om. Zodra hij het één keer misraadt, vertrouwt niemand het meer.
**Sparki:** mechanieker die van werkplaats naar vertrek gaat.

### PAT-17 — Gescheiden organisaties
**Situatie:** iemand hoort bij meerdere clubs, teams of kinderen.
**Patroon:** één actieve context tegelijk, expliciet gekozen, nooit gemengd getoond.
**Componenten:** CMP-02.
**Regels:** RB-10 uit het rolflowdocument; MUX-62.
**Antipatroon:** een gecombineerd overzicht "handig in één lijst". Dat is precies waar gegevens van de ene organisatie bij de andere terechtkomen.
**Sparki:** ouder met kinderen bij twee clubs.

### PAT-18 — Gegevens die de rol niet uit mogen
**Situatie:** een rol heeft een uitkomst nodig, maar niet de onderliggende gegevens.
**Patroon:** doorgeven wat nodig is voor de beslissing, niet wat eronder ligt.
**Componenten:** CMP-09, CMP-29.
**Regels:** MUX-48 en MUX-49 voor "geen toestemming"; de rolspecifieke grenzen uit het rolflowdocument.
**Antipatroon:** het volledige gegeven doorgeven omdat het toch al beschikbaar is. Elke rol die iets ziet wat hij niet nodig heeft, is een lek dat later een incident wordt.
**Sparki:** ploegleider ziet "niet inzetbaar", niet waarom.

---

## 5. AI

### PAT-19 — Advies zonder onderbreking
**Situatie:** de AI heeft iets zinnigs, maar de gebruiker is bezig.
**Patroon:** het advies wacht op een rustmoment en staat daar klaar, met vermelding waar het bij hoort.
**Componenten:** CMP-34, CMP-35.
**Regels:** MUX-90a–d; nooit tijdens navigatie, training, wedstrijd, onboarding of formulier; nooit uit zichzelf een sheet of scherm openen; wat echt niet kan wachten is geen advies maar een veiligheidsmelding.
**Antipatroon:** een tip halverwege het invullen van de bezetting. De tip wordt weggeklikt en de AI wordt daarna structureel genegeerd.
**Sparki:** herstelvoorstel dat verschijnt na afronding van de rit, niet ertijdens.

### PAT-20 — Advies met onderbouwing
**Situatie:** de AI adviseert iets.
**Patroon:** waarom, op welke gegevens, met welke onzekerheid — kort, boven de knoppen.
**Componenten:** CMP-35 binnen CMP-34.
**Regels:** MUX-91a–d. Ontbrekende gegevens worden benoemd, niet weggelaten. Geen zekerheid tonen die de gegevens niet dragen.
**Antipatroon:** "Sparki raadt aan om vandaag rustig te trainen." Zonder grond is dat geen coaching maar een gok met een logo erop.
**Sparki:** "Gebaseerd op je laatste drie ritten en je gemelde vermoeidheid. Slaapgegevens van deze week ontbreken."

### PAT-21 — Advies met vier uitgangen
**Situatie:** de gebruiker heeft een advies gelezen.
**Patroon:** bekijken, accepteren, aanpassen of negeren — en het gevolg is zichtbaar.
**Componenten:** CMP-34, CMP-15.
**Regels:** MUX-89a–d; genegeerd advies komt niet terug als herhaalde vraag; niets wordt na verloop van tijd alsnog uitgevoerd; de keuze wordt niet stilzwijgend teruggedraaid.
**Antipatroon:** een advies met alleen "OK". Dan is het geen advies maar een mededeling, en verdwijnt het onderscheid tussen adviseren en besturen.
**Sparki:** voorstel om een zware sessie te verplaatsen.

---

## 6. Wedstrijddag

### PAT-22 — Modus aanbieden, niet opleggen
**Situatie:** een evenement begint, of een navigatie start.
**Patroon:** de wedstrijddagmodus wordt aangeboden op grond van een controleerbaar feit; de gebruiker zet hem aan en uit.
**Componenten:** CMP-39.
**Regels:** MUX-96a, MUX-93 (geen onaangekondigde verandering), MUX-97f (welke contexten hem aanbieden).
**Antipatroon:** de app schakelt zelf om omdat het zaterdagochtend is. Wie dan iets anders wilde doen, is zijn scherm kwijt.
**Sparki:** ploegleider die 's ochtends bij het verzamelpunt aankomt.

### PAT-23 — Bedienen met handschoenen
**Situatie:** buiten, in beweging, onder tijdsdruk.
**Patroon:** grote vlakken, één regel tekst, één handeling per taak, geen invoer.
**Componenten:** CMP-37, CMP-32, CMP-07 in modusvariant.
**Regels:** MUX-96b t/m g; MUX-25 (max drie tikvlakken); MUX-70; typewerk wordt bewaard als taak voor na afloop.
**Antipatroon:** het gewone scherm met grotere letters. Een grotere letter lost een handschoen niet op.
**Sparki:** mechanieker die de controlelijst afvinkt naast de wagen.

### PAT-24 — Noodhandeling met eerlijke grens
**Situatie:** iets acuuts, mogelijk zonder bereik.
**Patroon:** één permanent bereikbare handeling, buiten de duimzone, met één korte bevestiging — en zonder verbinding een expliciete melding dat er níéts verstuurd is, plus het alternatief.
**Componenten:** CMP-38.
**Regels:** MUX-96h, MUX-54, MUX-55, MUX-23.
**Antipatroon:** een noodknop die er hetzelfde uitziet of hij nu werkt of niet. Stil falen is hier de ernstigste fout in de hele standaard en een directe afkeurgrond.
**Sparki:** val in de finale, in een dal zonder bereik.

### PAT-25 — Terug uit de modus
**Situatie:** het evenement is afgelopen.
**Patroon:** terug naar het normale startscherm van de rol, met een korte samenvatting van wat er gebeurd is en wat nog openstaat.
**Componenten:** CMP-39 → CMP-15 → CMP-01.
**Regels:** MUX-96l, MUX-88.
**Antipatroon:** de modus eindigt in het niets en de gebruiker staat op een leeg dashboard. Alles wat die dag is blijven liggen, blijft dan liggen.
**Sparki:** einde etappedag met openstaande terugkoppeling.

---

## 7. Doseren en doorlopen

### PAT-26 — Progressieve onthulling
**Situatie:** een onderwerp met meer informatie dan op een telefoon past, of dan de meeste gebruikers nodig hebben.
**Patroon:** toon wat nodig is om de volgende keuze te maken; de rest is opvraagbaar, in laagjes, op verzoek van de gebruiker.
**Componenten:** CMP-08, CMP-12, CMP-25, CMP-27.
**Regels:**
- Duidelijkheid boven volledigheid: wat niet nodig is om te kiezen, hoort niet op het eerste scherm (MUX-08).
- Maximaal 280 tekens lopende tekst per blok; de rest achter een uitklapregel of het uitlegicoon (MUX-15, MUX-72).
- Maximaal zes losse meetwaarden zonder interactie (MUX-20).
- Optionele velden staan niet in de hoofdstroom (MUX-47).
- **Harde grens:** wat opengeklapt moet worden om het scherm te begrijpen, hoort open te staan (MUX-37). Progressieve onthulling doseert bijzaak, verbergt nooit hoofdzaak.
- Elke laag die opengaat, doet dat op verzoek van de gebruiker — nooit vanzelf (MUX-93).
**Antipatroon:** twee tegenovergestelde fouten, beide veelvoorkomend. **Alles tonen** "voor het geval dat", waardoor de gebruiker zelf moet filteren. En **te veel wegstoppen**, waardoor de kern achter een uitklapregel verdwijnt en het scherm zonder tikken onbegrijpelijk is. De tweede is de gevaarlijkste, want hij ziet er rustig uit.
**Sparki:** analyse van een rit — afstand, tijd en gemiddelde direct in beeld; vermogensverdeling, segmenten en vergelijkingen een laag dieper.

### PAT-27 — Altijd een volgende stap
**Situatie:** elk moment waarop de gebruiker klaar is met iets — geslaagd, mislukt, leeg, geblokkeerd of simpelweg uitgekeken.
**Patroon:** op dat moment staat er een logische vervolgstap of een zichtbare terugweg. Altijd één van de twee, nooit geen van beide.
**Componenten:** CMP-15, CMP-29, CMP-12, CMP-14.
**Regels:**
- MUX-88 in zijn geheel, inclusief de bevestiging als eindscherm (MUX-88b) en het geblokkeerde scherm (MUX-88c).
- Systeem-terug of het gebaar van het toestel telt niet als terugweg — die moet in het scherm zelf zichtbaar zijn (MUX-88d).
- Ook een lege of geweigerde toestand heeft een eerstvolgende actie; dat is het vierde verplichte element (MUX-48).
- Ook de rolintroductie eindigt in een vervolgstap (MUX-100g).
- Mirror toetst per flow, niet per scherm (MUX-88e).
**Verschil met PAT-08:** PAT-08 gaat over de *functie* — hoort dit ergens bij, en waar. PAT-27 gaat over het *moment* — kan de gebruiker hiervandaan verder. Een functie kan netjes bij een hoofdtaak horen en tóch eindigen op een scherm waar niets meer te doen is.
**Antipatroon:** "Gelukt!" met alleen een kruisje rechtsboven. De taak is af, de gebruiker staat stil, en wat er daarna moest gebeuren blijft liggen. Tweede variant: een foutmelding zonder uitweg, waarna de enige optie de app afsluiten is.
**Sparki:** "Uitnodiging verstuurd" → "Nog iemand uitnodigen" of "Terug naar de ledenlijst".

---

## 8. Diepte, media en uitleg

Toegevoegd door `MOBILE_MEDIA_COMPONENTS_01`. Deze twaalf patronen dragen een uitgebreider veldenschema, omdat media meer faalvormen kent dan een gewoon scherm: bandbreedte, rechten, ontbrekende bestanden en toegankelijkheid komen er allemaal bij.

### PAT-28 — Subtiele diepte zonder drukte
**Doel:** een moment laten opvallen zonder de app onrustig te maken.
**Startconditie:** een van de zeven toegestane momenten van CMP-40.
**Stappen:** kaart komt subtiel los → gebruiker raakt aan → lichte kanteling en drukanimatie → openen naar detail → sluiten via de zichtbare terugactie.
**Verwijzingen:** CMP-40; MUX-93 (niets verandert onaangekondigd), MUX-98c (blokkeert de kernbediening niet), MUX-88d (terugweg in het scherm).
**Succes:** het moment valt op, en de rest van de app voelt niet drukker.
**Fout:** diepte-effect faalt → de kaart wordt een gewone kaart, met identieke functie.
**Offline:** geen invloed; diepte is weergave, geen data.
**Toegankelijkheid:** systeeminstelling "verminder beweging" schakelt kanteling en drukanimatie uit.
**Verboden:** continue beweging, kanteling zonder aanraking, gebruik op lijstitems of formulieren, gebruik tijdens navigatie of een acute melding.
**Antipatroon:** diepte overal, "omdat het mooi staat". Dan valt niets meer op en is het effect alleen nog een prestatiekost.
**Mirror:** MTS-50, MTS-52.

### PAT-29 — Bewegende uitleg op eerste gebruik
**Doel:** een nieuwe functie in 20–45 seconden begrijpelijk maken.
**Startconditie:** eerste opening van die functie, buiten een actieve taak.
**Stappen:** vraag stellen → gebruiker kiest → uitleg speelt met ondertiteling → pauzeren of overslaan kan → eindigt met een uitvoerbare eerste actie.
**Verwijzingen:** CMP-42, CMP-41; MUX-90 (nooit tijdens een taak), MUX-100 (eindigt met één eerste actie), MUX-88.
**Succes:** de gebruiker doet daarna de eerste actie zelf.
**Fout:** uitleg niet beschikbaar → de vraag verschijnt niet; de functie opent gewoon.
**Offline:** geen uitleg aanbieden; de functie werkt zonder.
**Toegankelijkheid:** zonder geluid volledig begrijpelijk; tekstvariant altijd beschikbaar.
**Verboden:** automatisch starten, herhalen bij elke opening, verouderde of nagebouwde schermen tonen.
**Antipatroon:** een verplichte rondleiding van vijf schermen bij eerste login. Iedereen tikt hem weg, en daarna weet niemand meer dat er uitleg bestaat.
**Mirror:** MTS-55, MTS-56, MTS-61.

### PAT-30 — Video met poster en tekstfallback
**Doel:** dezelfde informatie overbrengen, ongeacht of de video speelt.
**Startconditie:** een scherm met video- of animatie-inhoud.
**Stappen:** posterbeeld staat er → gebruiker start zelf → speler laadt lazy → ondertiteling aan → tekstvariant altijd bereikbaar.
**Verwijzingen:** CMP-41; MUX-48 (lege toestand), MUX-98 (blokkeert de kernbediening niet).
**Succes:** wie de video niet ziet, mist geen informatie.
**Fout:** speler faalt → fouttoestand binnen de speler, tekstvariant blijft, onderliggend scherm blijft bruikbaar.
**Offline:** posterbeeld en tekstvariant; geen laadpoging die blijft draaien.
**Toegankelijkheid:** ondertiteling, tekstalternatief, schermlezerbediening, 0,5×-snelheid.
**Verboden:** autoplay; video als enige drager van informatie.
**Antipatroon:** de tekstvariant is een samenvatting in plaats van een gelijkwaardig alternatief. Dan is "toegankelijk" een vinkje geworden.
**Mirror:** MTS-53, MTS-57, MTS-58.

### PAT-31 — Oefening bekijken en uitvoeren
**Doel:** een oefening veilig laten uitvoeren, ook zonder beeld.
**Startconditie:** een oefening in een plan, of gedeeld door een trainer.
**Stappen:** oefenkaart openen → beeld of poster → begin- en eindpositie → aandachtspunten → veelgemaakte fouten → uitvoeren → afvinken.
**Verwijzingen:** CMP-43, CMP-41; MUX-99 (hoort bij een hoofdtaak), MUX-88.
**Succes:** de gebruiker voert de oefening uit en weet waar hij op moet letten.
**Fout:** media ontbreekt → tekstvariant met begin- en eindpositie blijft volledig bruikbaar.
**Offline:** tekstvariant beschikbaar; video niet.
**Toegankelijkheid:** ondertiteling, tekstalternatief, 0,5×, stopregel bij pijn permanent zichtbaar.
**Verboden bij minderjarigen:** gewichtsdoelen, 1RM-doelen, zware belastingvoorschriften. Voor iedereen: blessurerevalidatie zonder bevoegde begeleiding.
**Antipatroon:** de oefening tonen als losse video zonder aandachtspunten en zonder stopregel. Dat is geen instructie maar een filmpje.
**Mirror:** MTS-60, MTS-62.

### PAT-32 — Coachmelding op rustmoment
**Doel:** een belangrijke niet-acute melding overbrengen zonder te storen.
**Startconditie:** einde van een rit, afronding van een stap, of terugkeer op een overzicht.
**Stappen:** melding zweeft rustig binnen → reden, gegevens en onzekerheid staan erbij → actieknoppen, sluiten of uitstellen.
**Verwijzingen:** CMP-44, CMP-35; MUX-89, MUX-90, MUX-91.
**Succes:** de melding wordt gelezen en beantwoord in plaats van weggetikt.
**Fout:** onderliggende gegevens ontbreken → geen melding tonen, alleen de reden waarom er niets te zeggen valt.
**Offline:** geen coachmelding; er is geen actuele grond.
**Toegankelijkheid:** geen geluid als enige drager; sluiten met een tikvlak van 48 dp.
**Verboden:** verschijnen tijdens navigatie, training, wedstrijd, onboarding of formulier; "niet meer tonen" bij een acute melding of bij een minderjarige.
**Antipatroon:** de melding als banner boven de primaire actie. De gebruiker mist zijn knop en leert de melding wegtikken.
**Mirror:** MTS-59, MTS-63, MTS-64.

### PAT-33 — Verminder beweging
**Doel:** de app volledig bruikbaar houden voor wie beweging niet verdraagt of niet wil.
**Startconditie:** systeeminstelling "verminder beweging" aan, of de eigen instelling in Sparki.
**Stappen:** kantelingen uit → drukanimaties uit → overgangen worden directe wisselingen → alle functies blijven op dezelfde plek.
**Verwijzingen:** CMP-40, CMP-41; MUX-66 t/m MUX-71.
**Succes:** geen enkele functie is verdwenen, geen enkele stap is langer geworden.
**Fout:** niet van toepassing — dit is zelf de veilige toestand.
**Offline:** geen invloed.
**Toegankelijkheid:** dit patroon *is* de toegankelijkheidseis.
**Verboden:** een functie die alleen via een animatie bereikbaar is; een overgang die niet uitgeschakeld kan worden.
**Antipatroon:** animatie uitzetten en de bijbehorende knop meenemen. Dan is de instelling een straf geworden.
**Mirror:** MTS-51, MTS-52.

### PAT-34 — Media op lage bandbreedte
**Doel:** bruikbaar blijven op een trage of dure verbinding.
**Startconditie:** merkbaar trage verbinding, of mobiele data zonder toestemming voor media.
**Stappen:** posterbeeld direct → lage-resolutievariant aanbieden → gebruiker kiest zelf of hij laadt → tekstvariant blijft altijd bereikbaar.
**Verwijzingen:** CMP-41; MUX-94, MUX-98.
**Succes:** het scherm werkt volledig, ook als de video nooit laadt.
**Fout:** download breekt af → posterbeeld en tekstvariant blijven; opnieuw proberen is een zichtbare keuze.
**Offline:** geen laadpoging; tekstvariant.
**Toegankelijkheid:** ongewijzigd.
**Verboden:** laden via mobiele data zonder toestemming; een laadanimatie die blijft draaien zonder uitweg (MUX-57).
**Antipatroon:** de video toch alvast op de achtergrond ophalen "voor de zekerheid". Dat kost de gebruiker geld dat hij niet heeft toegezegd.
**Mirror:** MTS-53, MTS-54, MTS-65.

### PAT-35 — Media ontbreekt
**Doel:** eerlijk zijn als er geen beeld is.
**Startconditie:** media niet aanwezig, verwijderd, of niet vrijgegeven.
**Stappen:** lege toestand met de vier elementen → tekstvariant als eerstvolgende actie → onderliggend scherm blijft volledig werken.
**Verwijzingen:** CMP-41, CMP-43, CMP-29; MUX-48, MUX-51.
**Succes:** de gebruiker weet wat ontbreekt, wie het oplost, en kan door.
**Fout:** dit patroon *is* de foutafhandeling.
**Offline:** hetzelfde gedrag, met de verbinding als oorzaak.
**Toegankelijkheid:** de tekstvariant is volwaardig, geen samenvatting.
**Verboden:** een lege speler tonen; een plaatsvervangend filmpje van iets anders; voorbeelddata.
**Antipatroon:** een grijs vlak met een gebroken-beeldicoon. Technisch correct, en de gebruiker denkt dat de app stuk is.
**Mirror:** MTS-57, MTS-66.

### PAT-36 — Mediarechten en versie
**Doel:** nooit media tonen waarvan de herkomst niet vaststaat.
**Startconditie:** elke opname van media in een scherm.
**Stappen:** `KENNIS_01` levert bron, maker, licentie, leeftijdsgeschiktheid, versie en publicatiestatus → de weergavelaag toont wat is vrijgegeven → wat niet is vrijgegeven, verschijnt niet.
**Verwijzingen:** CMP-41, CMP-43; grens met `KENNIS_01`.
**Succes:** van elk getoond mediabestand is aantoonbaar wie het maakte en onder welke voorwaarden.
**Fout:** rechten onbekend → media wordt niet getoond, PAT-35 neemt het over.
**Offline:** geen invloed op de rechtenvraag.
**Toegankelijkheid:** ondertiteling en tekstalternatief horen bij de rechtencontrole — media zonder alternatief is niet vrijgegeven.
**Verboden:** media zonder aantoonbare rechten; media uit een andere versie dan de gepubliceerde.
**Antipatroon:** "we halen de rechten later wel na". Dat is het moment waarop een oefenvideo van een derde in productie staat.
**Mirror:** MTS-67.

### PAT-37 — Uitleg bekeken of overgeslagen
**Doel:** de uitleg één keer aanbieden en daarna respecteren wat de gebruiker koos.
**Startconditie:** eerste opening van een functie.
**Stappen:** vraag → keuze wordt per gebruiker onthouden (bekeken · overgeslagen · opnieuw bekijken) → uitleg blijft vindbaar via Help.
**Verwijzingen:** CMP-42; MUX-89d (genegeerd komt niet terug als herhaalde vraag), MUX-93.
**Succes:** niemand krijgt dezelfde uitleg twee keer ongevraagd.
**Fout:** status niet opgeslagen → uitleg wordt niet opnieuw aangeboden; hij blijft alleen via Help bereikbaar.
**Offline:** de keuze wordt niet lokaal bevestigd zonder server (MUX-55).
**Toegankelijkheid:** ongewijzigd.
**Verboden:** de vraag opnieuw stellen na "overgeslagen"; de uitleg onvindbaar maken na overslaan.
**Antipatroon:** de uitleg terugbrengen "omdat de gebruiker hem toch niet heeft gezien". Dat is de app die het beter weet.
**Mirror:** MTS-56.

### PAT-38 — Geen video tijdens actieve taak
**Doel:** aandacht beschermen op het moment dat die ergens anders hoort.
**Startconditie:** navigatie, actieve training, wedstrijddagmodus, onboarding, formulier, of een acute medische of veiligheidsflow.
**Stappen:** media wordt niet aangeboden en niet afgespeeld → uitleg blijft bewaard voor daarna → de taak loopt door.
**Verwijzingen:** CMP-41, CMP-42; MUX-90, MUX-96j.
**Succes:** geen enkele mediastart tijdens een van deze zes situaties.
**Fout:** een reeds spelende video wordt gepauzeerd zodra de taak begint, niet doorgespeeld op de achtergrond.
**Offline:** ongewijzigd.
**Toegankelijkheid:** ongewijzigd.
**Verboden:** autoplay tijdens navigatie of wedstrijddag — dit is een directe afkeurgrond.
**Antipatroon:** "een korte uitleg terwijl de route laadt". Precies het moment waarop de gebruiker wegrijdt.
**Mirror:** MTS-59, MTS-64.

### PAT-39 — Animatie uit, functionaliteit gelijk
**Doel:** bewijzen dat beweging versiering is en geen functie.
**Startconditie:** alle animatie uitgeschakeld.
**Stappen:** elke flow uit de rolflows wordt doorlopen → elke stap is bereikbaar → geen extra tik, geen omweg, geen verdwenen knop.
**Verwijzingen:** CMP-40, CMP-41; MUX-66 t/m MUX-71, PAT-33.
**Succes:** identieke uitkomst met en zonder animatie.
**Fout:** een functie blijkt alleen via een overgang bereikbaar → afkeur, niet repareren met een extra knop achteraf.
**Offline:** ongewijzigd.
**Toegankelijkheid:** dit is de sluitsteen van hoofdstuk 10 van de standaard.
**Verboden:** een functie die animatie nodig heeft om te bestaan.
**Antipatroon:** de animatie-uitstand bouwen als aparte, minder complete variant van de app. Dan is er stilletjes een tweede product ontstaan.
**Mirror:** MTS-51, MTS-52.

---

## 9. Patroonregister

| Code | Patroon | Kernregels |
|---|---|---|
| PAT-01 | First usable interaction | MUX-98 |
| PAT-02 | Rolintroductie | MUX-100 |
| PAT-03 | Eerlijke leegte | MUX-48, 49, 50, 51 |
| PAT-04 | Eén taak per scherm | MUX-12, 13, 22, 38 |
| PAT-05 | Kiezen boven typen | MUX-09, 16, 44, 47 |
| PAT-06 | Onderbreekbare taak | MUX-11, 41, 42, 43, 64 |
| PAT-07 | Bevestigen naar zwaarte | MUX-31, 40, 55 |
| PAT-08 | Functie naar hoofdtaak | MUX-99, 88, 81a |
| PAT-09 | Inspiratie met uitgang | MUX-99c |
| PAT-10 | Progressief tonen | MUX-56, 57, 58, 94 |
| PAT-11 | Aankondigen in plaats van verschuiven | MUX-93 |
| PAT-12 | Eerlijk offline | MUX-53, 54, 55, 10 |
| PAT-13 | Herstel na verbinding | MUX-53a |
| PAT-14 | Fout zonder techniek | MUX-45, 52 |
| PAT-15 | Vaste plattegrond, wisselende inhoud | MUX-14, 62 |
| PAT-16 | Context binnen een rol | MUX-97 |
| PAT-17 | Gescheiden organisaties | MUX-62, RB-10 |
| PAT-18 | Gegevens die de rol niet uit mogen | MUX-48, 49 |
| PAT-19 | Advies zonder onderbreking | MUX-90 |
| PAT-20 | Advies met onderbouwing | MUX-91 |
| PAT-21 | Advies met vier uitgangen | MUX-89 |
| PAT-22 | Modus aanbieden, niet opleggen | MUX-96a, 93 |
| PAT-23 | Bedienen met handschoenen | MUX-96b–g, 25 |
| PAT-24 | Noodhandeling met eerlijke grens | MUX-96h, 54, 55 |
| PAT-25 | Terug uit de modus | MUX-96l, 88 |
| PAT-26 | Progressieve onthulling | MUX-08, 15, 20, 37, 47, 72 |
| PAT-27 | Altijd een volgende stap | MUX-88, 48, 100g |
| PAT-28 | Subtiele diepte zonder drukte | CMP-40, MUX-93, 98c |
| PAT-29 | Bewegende uitleg op eerste gebruik | CMP-42, MUX-90, 100 |
| PAT-30 | Video met poster en tekstfallback | CMP-41, MUX-48, 98 |
| PAT-31 | Oefening bekijken en uitvoeren | CMP-43, MUX-99 |
| PAT-32 | Coachmelding op rustmoment | CMP-44, MUX-89, 90, 91 |
| PAT-33 | Verminder beweging | MUX-66–71 |
| PAT-34 | Media op lage bandbreedte | CMP-41, MUX-94, 98 |
| PAT-35 | Media ontbreekt | CMP-29, MUX-48, 51 |
| PAT-36 | Mediarechten en versie | grens `KENNIS_01` |
| PAT-37 | Uitleg bekeken of overgeslagen | CMP-42, MUX-89d |
| PAT-38 | Geen video tijdens actieve taak | MUX-90, 96j |
| PAT-39 | Animatie uit, functionaliteit gelijk | MUX-66–71, PAT-33 |

---

## 10. Gebruik door bouwpakketten

- De paragraaf "Mobiele uitwerking" (MUX-85) noemt de toegepaste PAT-codes naast de CMP- en MUX-codes.
- Een patroon wordt niet in een bouwpakket bedacht. Ontbreekt er een situatie, dan wordt dit document eerst uitgebreid met een nieuwe PAT-code.
- Bij twijfel tussen twee oplossingen wint het patroon. Dat is het hele punt: dezelfde situatie mag niet in elk pakket anders worden opgelost.
- Mirror gebruikt de antipatronen als zoeklijst; ze staan er niet ter illustratie maar als toetscriterium.

**Consistentiecontrole uitgevoerd:** alle genoemde MUX-codes bestaan in v1.4, alle CMP-codes in de componentbibliotheek, RB-10 in het rolflowdocument. Geen nieuwe regels, componenten of productbesluiten toegevoegd.

---

*Einde `SPARKI_MOBILE_PATTERNS.md`. Laatste oplevering: `SPARKI_MIRROR_MOBILE_TESTSTANDARD.md`.*
