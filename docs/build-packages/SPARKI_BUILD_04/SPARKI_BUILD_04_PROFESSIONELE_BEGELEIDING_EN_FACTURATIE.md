# SPARKI BUILD 04 — PROFESSIONELE BEGELEIDING EN FACTURATIE

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Technische code:** `SPARKI_BUILD_04`
**Uitvoerder:** Replit · **Toetser:** Mirror (parallel) · **Opdrachtgever:** René
**Datum:** 1 augustus 2026 · **Status:** klaar voor vrijgave, nog niet gestart.
**Volgorde:** trainerdocumenten draaien op de werkobjectlaag uit `SPARKI_BUILD_02` (F1 t/m F6) en de factuur-PDF op de rapportgenerator. Dat zijn **technische** afhankelijkheden, geen wachtpoorten: registratie, klanten, diensten en de facturatiewerkplek bouwen parallel door.

---

> **UITVOERINGSVRIJGAVE** — Zodra René dit volledige bouwpakket als bouwopdracht aan Replit geeft, is de volledige beschreven bouw-, test-, herstel-, migratie-, deployment- en productiestraat vrijgegeven. Geen aanvullende fase- of productiegoedkeuring vereist.

## 0. Uitvoeringsregel

**Eén goedkeuring, hele straat.** René keurt de totale bouwopdracht één keer goed. Dat akkoord is toestemming voor: inventarisatie · productcode · migraties · tests · herstel · commits · pushes · acceptatiedeployment · featureflagactivatie binnen scope · productiepublicatie · productiemigraties · rollback wanneer een vrijgegeven versie faalt.

**Replit voert alle fasen zelfstandig achter elkaar uit.** Rapporteren gebeurt na iedere fase, maar rapportage is **geen wachtmoment** — Replit gaat direct door.

**Mirror toetst parallel en blokkeert onafhankelijke bouw niet.**
- `MIRROR_PROVEN` → doorgaan.
- `HERSTEL NODIG` → Replit herstelt zelfstandig binnen de goedgekeurde opdracht en gaat door.
- `AFGEKEURD` → uitsluitend het geraakte of afhankelijke onderdeel stopt, wordt hersteld en opnieuw getoetst.
- `NIET BEWIJSBAAR` → bewijs herstellen; de bouw ligt niet stil.

Mirror blokkeert **nooit** de bouwstraat om een cosmetisch gebrek, een ontbrekend screenshot, een oude Queue-kaart, een ontbrekend tussenrapport, een niet-kritieke hertoets of een documentatiefout die de productcode niet raakt.

### Enige toegestane harde stops

Replit stopt **alleen de geraakte of afhankelijke lijn** bij: aantoonbaar dataverlies · cross-account-, cross-team- of consentlek · verzonnen persoonlijke data · medische diagnose of gevaarlijk veiligheidsadvies · onherstelbare migratiefout · productiedatabase onbereikbaar of inconsistent · build, typecheck of verplichte tests blijven rood na gerichte herstelpogingen · ontbrekende rollback bij een destructieve wijziging · betaalstromen die onbedoeld bij Sparki terechtkomen · een ontbrekende juridische productkeuze die technisch niet veilig kan worden afgeleid · een echte inhoudelijke tegenstrijdigheid die niet uit bestaande besluiten oplosbaar is.

**Geen algemene bouwstop.** Onafhankelijke fasen lopen door; het probleem wordt gerapporteerd, en alleen bij een werkelijk nieuw productbesluit volgt één korte beslisvraag aan René.

### Open punten in drie soorten

**A — uitwerkingsvraag:** Replit lost het zelf op binnen de bestaande architectuur en productbesluiten.
**B — technische blokkade:** Replit herstelt zelf en gaat door.
**C — echt productbesluit:** alleen wanneer meerdere wezenlijk verschillende productuitkomsten mogelijk zijn en geen bestaand besluit richting geeft. **Terughoudend gebruiken.**

Prijzen, benamingen en configureerbare instellingen blokkeren de bouw niet: **configureerbaar bouwen met een lege waarde**.

---

## 1. Productdoel

Een compleet professioneel product voor **zelfstandige trainers, sporters en ouders**: begeleiding, documenten, rapportage en eenvoudige verkoopfacturatie.

**De twee criteria waaraan dit pakket wordt afgemeten:**
**Schaal** — met tien klanten blijft het dagelijks werk overzichtelijk.
**Geloofwaardigheid** — wat de trainer naar buiten stuurt, ziet er professioneel uit en klopt. Eén rapport met een placeholdernaam kost hem een klant.

---

## 2. Bindende besluiten

**BB-60 (T-1)** Sparki Trainer **mag een betaald abonnement zijn.** Hiermee is besluit K-6 achterhaald.
**BB-61 (T-4)** Sparki ondersteunt **facturatie door de zelfstandige trainer aan diens eigen klanten.** Sparki beheert verkoopfacturen en betaalstatus; de volledige boekhouding blijft extern.
**BB-62** **Klant en sporter zijn aparte entiteiten**, altijd afzonderlijk vastgelegd: sporter · klant/afnemer · betaler · factuuradres · relatie. Een ouder betaalt voor een kind, een werkgever voor een medewerker, een sponsor betaalt, of de sporter betaalt zelf.
**BB-63 (F-B1)** **De klant betaalt rechtstreeks aan de trainer**, via diens eigen gekoppelde betaalaccount. Sparki faciliteert en **ontvangt of verdeelt het geld niet zelf**. Bankoverschrijving blijft mogelijk; handmatig betaald markeren blijft mogelijk. Een betaallink via een verbonden accountmodel wordt **pas geactiveerd na technische en juridische verificatie**.
**BB-64 (F-B2)** **Per onderneming één doorlopende factuurreeks.** Nooit per klant en nooit per Sparki-context. Nummer nooit hergebruiken. Reeks niet terugzetten.
**BB-65 (F-B3)** De **trainer** is verantwoordelijk voor tarief, vrijstelling, bedrijfsgegevens en factuurjuistheid. Sparki valideert technische volledigheid, rekent, en **geeft geen fiscaal advies**.
**BB-66 (F-B4)** De **kleineondernemersregeling** wordt ondersteund: geen btw berekenen, geen btw-bedrag tonen, toepasselijke vrijstelling vermelden. Wijziging geldt **alleen voor toekomstige facturen**; oude facturen blijven onveranderd.
**BB-67 (F-B5)** Na beëindiging van het trainerabonnement: geen nieuwe facturen, geen nieuwe verzending, **bestaand archief read-only**, export blijft beschikbaar, creditnota's en audit blijven herleidbaar, **geen factuur verwijderen door opzegging**.
**BB-68** Een **verzonden factuur wordt nooit overschreven of verwijderd.** Corrigeren gebeurt uitsluitend met een creditnota.
**BB-69** **Geen blind automatisch verzenden in v1.** Sparki maakt een conceptfactuur; de trainer controleert en verzendt.
**BB-70** **Geen gezondheidsinformatie op een factuur.** De omschrijving is "begeleiding maart", niet de reden waarom die begeleiding nodig was.
**BB-71** **Veiligheidsinformatie wordt nooit geblokkeerd bij een betaalprobleem.**
**BB-72** Sparki bouwt **geen** grootboek, inkoopadministratie, bankboek, btw-aangifte, balans, jaarrekening, loonadministratie of volledige boekhouding.

---

## 3. Verplicht hergebruik

| Bestaand onderdeel | Wat ermee gebeurt |
|---|---|
| werkobjectlaag uit `SPARKI_BUILD_02` | alle trainerdocumenten zijn werkobjecten; **geen 24 losse documentmodules** |
| rapportgenerator en templatebibliotheek | factuur, creditnota en alle rapporten lopen hierlangs; **geen tweede rapportgenerator** |
| rechten-, consent- en jeugdlaag uit `SPARKI_BUILD_01` | toegepast; geen tweede rechtenlaag |
| bestaande abonnements- en entitlementlaag | uitgebreid met het trainerabonnement; geen tweede entitlementengine |
| bestaande Stripe-infrastructuur | hergebruikt voor geldstroom A; voor geldstroom B geldt BB-63 |
| bestaande notificatielaag | uitgebreid; geen tweede systeem |
| AI-gateway en adviesherleidbaarheid | AI-concepten lopen hierlangs; geen tweede AI-memory |

---

## 3a. Centrale platformdiensten — hergebruiken, niet nabouwen

Dit pakket bouwt **geen** van de dertien centrale diensten.

| Dienst | Uit | Toepassing hier |
|---|---|---|
| PD-1 agenda | pakket 01 | traineragenda: intake · test · bikefit · begeleidingsgesprek · trainingsmoment · facturatiemoment · vervaldatum · evaluatie |
| PD-2 locaties | pakket 01 | testlocatie · bikefitlocatie · trainingslocatie |
| PD-3 contacten en relaties | pakket 01 | klant · betaler · werkgever · sponsor · ouder — **klant en sporter blijven aparte entiteiten** |
| PD-4 bestanden en media | pakket 01 | briefpapier · factuur-PDF · overeenkomst · bijlagen |
| PD-5 inbox en notificaties | pakket 01 | factuur verstuurd · vervaldatum nadert · betaling ontvangen · consent gewijzigd |
| PD-7 taken | pakket 02 | intake afronden · rapport opstellen · factuur controleren · betaling opvolgen |
| PD-8 sjablonen | pakket 02 | intake · plan · rapport · begeleidingsvoorstel · overeenkomst · factuur |
| PD-9 zoeken | pakket 02 | klanten · sporters · documenten · **facturen op factuurnummer** |
| PD-10 goedkeuring | pakket 02 | begeleidingsvoorstel · overeenkomst · plan · factuurconcept |
| PD-11 archief en bewaren | pakket 02 | facturen en creditnota's met hun eigen wettelijke termijn |
| PD-12 gebruikersaudit | pakket 02 | wie markeerde betaald · wie crediteerde · wie wijzigde de reeks |
| PD-13 import en export | pakket 02 | klanten importeren · facturen exporteren |

**Harde regel:** een eigen agenda, takenlijst, klantenlijst, zoekfunctie of meldingenlijst in dit pakket is een **directe herstelgrond**.

**"Mijn taken" van de trainer** toont taken uit alle bronnen: begeleiding, documenten én facturatie, in dezelfde vijf groepen (vandaag · te laat · binnenkort · geblokkeerd · afgerond).

---

## 3b. Facturatie en administratie als volwaardige werkplek

Facturatie is geen bijproduct van het trainerprofiel. Het is een **eigen werkomgeving** met een startscherm, een eigen structuur en een eigen ritme.

### A. Startscherm Facturatie
Vast, in deze volgorde: openstaand bedrag · te laat · deze maand gefactureerd · concepten · verstuurd · betaald · gecrediteerd · eerstvolgende facturatiemoment · klanten zonder actieve afspraak · ontbrekende gegevens · exportstatus · laatste wijzigingen.

**Één primaire actie:** de eerstvolgende factuur afhandelen.

### B. Klantadministratie
klantnummer · naam · type (particulier · bedrijf · ouder · sponsor) · adres · contactpersoon · e-mail · telefoon · btw-nummer · KvK · betalingstermijn · standaardtarief · standaarddienst · notitie · status (actief · inactief · in gesprek · beëindigd) · gekoppelde sporters · gekoppelde documenten · **factuurhistorie** · **betaalgedrag**.

**`betaalgedrag` is geen oordeel maar een feit:** gemiddelde betaaltermijn, aantal keer te laat. Geen score, geen kleurcode die een klant stigmatiseert.

### C. Dienstencatalogus
naam · omschrijving · prijs · btw of KOR · eenheid (uur · sessie · maand · pakket · traject) · duur · actief · zichtbaar op factuur · standaardomschrijving · categorie.

### D. Facturatiemomenten
maandelijks · per periode · per losse dienst · per traject · handmatig.
Sparki maakt een **conceptfactuur** met een herinnering; **verzenden gebeurt door de trainer** (BB-69).

### E. Factuurstatus en opvolging
concept · verstuurd · gedeeltelijk betaald · betaald · te laat · gecrediteerd · oninbaar · ingetrokken vóór verzending.
Opvolging: herinnering versturen · notitie plaatsen · betaalafspraak vastleggen · handmatig betaald markeren · gedeeltelijk betaald markeren · **oninbaar markeren met reden**.

**Geen automatisch incassotraject. Geen automatische aanmaning.** Sparki stelt voor; de trainer beslist.

### F. Rapportage voor de trainer
omzet per maand, kwartaal en jaar · omzet per klant · omzet per dienst · openstaand bedrag · gemiddelde betaaltermijn · aantal actieve klanten · aantal facturen · **btw-overzicht als informatief overzicht, geen aangifte**.

### G. Boekhoudkoppeling
Export in Excel en CSV met de vijftien velden uit F10, plus bulk-PDF. **Geen directe boekhoudkoppeling in v1.**

### H. Communicatie rond facturatie
factuur versturen per e-mail · herinnering versturen · bevestiging van betaling · communicatie loopt via de **centrale communicatielaag** en is terugvindbaar in de klanthistorie.

**Geen tweede mailsysteem.**

### I. Wat facturatie nooit doet
Geen boekhouding · geen bankkoppeling · geen incasso · geen automatische aanmaning · geen fiscaal advies · geen btw-aangifte · geen jaarrekening · geen loonadministratie.

---

## 3c0. Rolcatalogus begeleidingsdocumenten

Alle typen draaien op de werkobjectlaag en de centrale documentenbibliotheek uit pakket 02, met het **documenttypecontract (DTC)** van vierentwintig onderdelen. Gedeelde objecttypen waar mogelijk; per rol een eigen weergave.

**G. Trainer (21)** — intake · doelenoverzicht · jaarplan · seizoensplan · trainingsblok · weekplan · dagsessie · **groepsplan** · **individuele afwijking** · testprotocol · testverslag · FTP- en zoneverslag · voortgangsrapport · hersteladvies · wedstrijdvoorbereiding · wedstrijdanalyse · sporterbespreking · ouderbriefing · trainersevaluatie · overdrachtsdocument · eindrapport begeleiding.

**H. Hoofdtrainer (15)** — jaarplanning · seizoensstrategie · groepsindeling · trainerstoewijzing · trainerbespreking · sporterbespreking · talentontwikkeling · selectiekader · wedstrijdprogramma · trainingskwaliteitsoverzicht · **staffevaluatie** · teamoverstijgende analyse · seizoensevaluatie · organisatie-lessons-learned · overdracht volgend seizoen.
*Staffevaluatie en trainerbespreking vallen onder de regel geen geheime personeelsbeoordeling: wie beoordeeld wordt kan dat weten, en een score wordt nooit een automatische beslissing.*

**I. Medical Staff (12)** — inzetbaarheidsstatus · toestemmingsverzoek · blessuremelding · praktische beperking · hersteltraject · terugkeer-naar-sportplan · noodinformatie · incidentrapport · medische overdracht · evaluatie hersteltraject · **geschiktheidsbericht trainer** · **geschiktheidsbericht ploegleider**.
*De twee geschiktheidsberichten zijn de enige uitgang naar niet-medische rollen: die tonen geschiktheid, nooit de medische reden.*

**J. Ouder en minderjarige (14)** — toestemmingsformulier · ouderinformatie · ouderbriefing · sporterbriefing · vervoersbevestiging · aanwezigheidsbevestiging · noodcontactformulier · wedstrijdinformatie · trainingsinformatie · voortgangsrapport · wijzigingsmelding · incidentinformatie · consentintrekking · **overdracht bij meerderjarigheid**.

**K. Zelfstandige trainer (22)** — trainerprofiel · begeleidingsvoorstel · overeenkomst · **klantkaart** · **sporterkaart** · intake · doelenplan · jaarplan · weekplan · trainingsplan · testverslag · voortgangsrapport · wedstrijdvoorbereiding · wedstrijdanalyse · evaluatie · eindrapport · overdracht · coachingfactuur · aanvullende-dienstenfactuur · creditnota · betaalherinnering · boekhoudersexport.
*Klantkaart en sporterkaart zijn twee documenten omdat klant en sporter twee entiteiten zijn (BB-62).*

**M. Voedingsdeskundige in de individuele context — `nutrition_specialist`** — de zeventien documenttypen staan in pakket 03, hoofdstuk 3b0-F. Hier telt alleen de **koppeling aan een individuele sporter**: de voedingsdeskundige kan los van club of team aan één sporter hangen, met eigen toestemming per koppeling. Een zelfstandige trainer en een voedingsdeskundige bij dezelfde sporter zien elk hun eigen deel — **geen gedeeld dossier**, geen samengevoegd beeld.

**L. Sporter (12)** — persoonlijk doelenoverzicht · trainingsweek · wedstrijdbriefing · eigen taken · eigen materiaalcheck · eigen voedingsplan · aanwezigheidsbevestiging · feedbackformulier · wedstrijdevaluatie · voortgangsoverzicht · persoonlijke rapporten · **gegevens- en consentoverzicht**.
*Het laatste is geen extraatje: de sporter moet kunnen zien welke gegevens over hem bestaan en met wie ze gedeeld zijn.*

**Wat na onboarding als concept kan klaarstaan** — nooit automatisch gepubliceerd: trainerprofiel · begeleidingsvoorstel · overeenkomst · intake · klantkaart · facturatie-instellingen · standaard coachingfactuur · standaard aanvullende-dienstenfactuur · rapporttemplate · weekplan · evaluatieformulier.

---

## 3c. Inhoud van de trainer- en facturatiedocumenten

Elk type draagt het **inhoudscontract van eenentwintig onderdelen** uit pakket 02, hoofdstuk 3b, en volgt de vijftien stappen uit 3e. Hier staat de inhoud.

### 3c.1 Trainerdocumenten — tweeëntwintig typen

trainerprofiel · begeleidingsvoorstel · overeenkomst · intake · doelenoverzicht · jaarplan · seizoensplan · trainingsblok · weekplan · dagsessie · testprotocol · testverslag · FTP- en zoneverslag · voortgangsrapport · hersteladvies · wedstrijdvoorbereiding · wedstrijdanalyse · sporterbespreking · ouderbriefing · evaluatie · eindrapport · overdracht.

### 3c.2 Wat elk plan minimaal bevat — achttien onderdelen

doel · periode · uitgangssituatie · beschikbare tijd · beperkingen · prioriteiten · trainingen · belasting · herstel · wedstrijden · evaluatiemomenten · afwijkingen · trainernotities · sporterfeedback · **AI-concept** · **brondata** · **onzekerheid** · **menselijke bevestiging**.

**De laatste vier zijn geen bijlage maar de kern.** Een plan zonder brondata en zonder zichtbare onzekerheid is een mening; een plan zonder menselijke bevestiging is niet van de trainer.

**Wat automatisch wordt gevuld:** uitgangssituatie uit de laatste test en de recente belasting · beschikbare tijd uit de intake · wedstrijden uit de agenda · beperkingen uit de intake binnen toestemming · evaluatiemomenten uit het vorige traject.
**Wat de AI voorstelt:** opbouw, belastingverdeling, herstelmomenten — met bron en periode zichtbaar.
**Wat de trainer zelf doet:** prioriteiten stellen en bevestigen.

**Trainernotities zijn niet gedeeld tenzij de trainer dat kiest.** Sporterfeedback is van de sporter en wordt niet stilzwijgend in een rapport opgenomen.

### 3c.3 Facturatiedocumenten

**A. Coachingfactuur** — trainer · klant · sporter · periode · dienst · omschrijving · prijs · btw of KOR · factuurnummer · factuurdatum · vervaldatum · betaalgegevens · status · briefpapier · templateversie.
*Klant en sporter staan er allebei op en zijn allebei een eigen veld — een ouder betaalt voor een kind.*

**B. Aanvullende dienst** — diensttype · uitvoerdatum · klant · sporter · omschrijving · aantal · prijs · btw of KOR · notitie · **bewijs- of rapportkoppeling**.
*De koppeling maakt navolgbaar waarvoor precies is gefactureerd: de FTP-test van 12 maart, niet "een test".*

**C. Creditnota** — originele factuur · reden · geheel of gedeeltelijk · bedragen · nummer · datum · status · audit.

**D. Betaalherinnering** — originele factuur · openstaand bedrag · vervaldatum · eerdere herinnering · nieuwe termijn · **de trainer bevestigt de verzending** · **geen automatische aanmaning**.

**E. Boekhoudersexport** — vaste kolommen · periode · PDF-bulk · creditnota's · betaalstatus · audit.

### 3c.4 Wat Sparki hier proactief klaarzet

"Voor deze klant staat een coachingfactuur klaar" · "Deze test is uitgevoerd maar nog niet gefactureerd" · "Deze factuur vervalt over drie dagen" · "Bij deze klant ontbreekt het btw-nummer" · "Het vorige jaarplan van deze sporter is beschikbaar als basis" · "Deze training wijkt sterk af van het actieve doel".

**Altijd met bron, periode en onzekerheid. Altijd als voorstel. Nooit automatisch verstuurd.**

---

## 4. Datamodel

### 4.1 Trainer als onderneming
`trainer_business`: gebruiker · bedrijfsnaam · handelsnaam · adres · KvK-nummer · btw-identificatienummer · IBAN · logo · briefpapiertemplate · contactgegevens · betalingstermijn · **KOR actief ja/nee** · factuurprefix · eerstvolgend factuurnummer.

### 4.2 Klant, sporter en betaler (BB-62)
`trainer_client`: trainer · naam · adres · e-mail · optioneel bedrijfsnaam en btw-nummer · klantnummer · status (actief · inactief · wachtlijst).
`client_athlete_link`: klant · sporter · relatietype (zelf · ouder · werkgever · sponsor) · `startedAt` · `endedAt`.
`billing_party`: welke partij factuuradres en betaalplicht draagt.

**Drie velden, geen één.** Wie dit later samenvoegt, moet het bij het eerste jeugdlid weer uit elkaar halen.

### 4.3 Diensten
`trainer_service`: trainer · naam · omschrijving · prijs · btw-tarief · eenheid (maand · week · blok · losse sessie) · looptijd · actief.

### 4.4 Terugkerende coaching (factuurmodel 1)
`recurring_billing`: trainer · klant · cyclus (wekelijks · maandelijks) · standaardomschrijving · bedrag · btw of KOR · startdatum · einddatum · betalingstermijn · actief.

### 4.5 Factuur
`invoice`: trainer · klant · **factuurnummer** · factuurdatum · periode of uitvoerdatum · vervaldatum · klantgegevens (bevroren op moment van verzending) · regels · bedrag exclusief · btw per tarief · totaal inclusief · betaalgegevens · **status** · **templateversie** · document-ID · betaaldatum · creditreferentie · valuta.
`invoice_line`: dienst of vrije omschrijving · aantal · stukprijs · btw-tarief · bedrag.
`credit_note`: eigen nummer · verwijzing naar de originele factuur · reden · geheel of gedeeltelijk · status · PDF.

**Statussen (BB-68):** concept · verzonden · betaald · te laat · gecrediteerd · ingetrokken vóór verzending. **Na verzending nooit overschrijven.**

### 4.6 Briefpapier
`trainer_letterhead`: trainer · bestand · formaat · veilige marges · leesbaarheidscontrole · **templateversie** · actief vanaf. Oude facturen bewaren de gebruikte templateversie; een nieuwe upload verandert nooit een bestaande factuur.

---

## 5. API

- `POST /trainer/register` — registratie **zonder** club of team.
- `GET/PATCH /trainer/business` — bedrijfsgegevens, KOR, prefix, startnummer.
- `POST /trainer/letterhead` — met leesbaarheids- en margecontrole en preview.
- `GET/POST /trainer/clients` · `POST /clients/{id}/link-athlete`
- `GET/POST /trainer/services`
- `GET/POST /trainer/recurring-billing`
- `POST /invoices/draft` — uit terugkerende cyclus of uit losse dienst.
- `POST /invoices/{id}/send` — kent het definitieve nummer toe; daarna onveranderlijk.
- `POST /invoices/{id}/mark-paid` — datum en bedrag; deelbetaling mogelijk.
- `POST /invoices/{id}/credit` — creditnota met reden en omvang.
- `GET /invoices/export?period=` — Excel en CSV.
- `GET /invoices/bulk-pdf?period=` — bulkdownload van facturen en creditnota's.

**Regel:** nummertoekenning gebeurt **server-side bij verzending**, nooit in de client en nooit bij het aanmaken van een concept.

---

## 6. Rechten

| Wie | Ziet |
|---|---|
| trainer | uitsluitend zijn eigen klanten, facturen en documenten |
| andere trainer | **niets** hiervan — ook niet binnen dezelfde club; fail-closed |
| klant | zijn eigen facturen |
| sporter | zijn eigen begeleiding; **niet** de facturatie tenzij hij ook de klant is |
| ouder | wat bij het kind hoort, plus de eigen facturen als hij de klant is; **nooit** medische details of coachnotities zonder grond |
| Sparki-admin | binnen een gemotiveerde grond van inzage, gelogd |

**Een factuur is vertrouwelijk.** Ontvanger en doel liggen vast; delen gaat als bijlage aan de klant of via een beveiligde link.

---

## 7. Mobiele UX

**Afhandelen, niet opbouwen.** Eerste scherm: Trainingen — wie wacht vandaag op mij. Eerste bruikbare interactie: de lijst met openstaande sporters, bedienbaar vóór grafieken laden.

Mobiel: sporter openen · feedback geven · bericht sturen · taak afhandelen · rapport lezen en delen · **factuur bekijken en als betaald markeren**.

Niet mobiel: factuur samenstellen, briefpapier instellen, terugkerende cycli inrichten, jaarplanning.

Structuur binnen de module: tabs **Vandaag · Sporters · Planning**; zakelijke instellingen, documenten en facturatie onder **Meer**. Geen zesde hoofditem.

## 8. Desktop UX

Opbouwen: jaar- en weekplanning · meerdere sporters vergelijken · uitgebreide analyse · documenten opstellen · rapporten samenstellen · klanten en diensten beheren · facturen maken en versturen · briefpapier instellen · export naar de boekhouder.

---

## 9. Fasen en Replit-opdrachten

### F0 — Inventarisatie (geen code)
**Scope:** kan een trainer zich registreren **zonder** club of team · bestaat er een trainer-sporterrelatie buiten een organisatie · bestaat er een entitlement dat aan de trainer hangt in plaats van aan de sporter · bestaat er een zakelijk profiel · bestaat er enige facturatie · huidige Stripe-inrichting · bestaande trainerdocumenten en waar ze staan · bestaande intake · bestaande rapportage.
**Bewijs:** per claim codepad, schema, endpoint of scherm; per afwezigheid de vindplaats.
**Mirror:** de eerste vijf vragen bepalen of de zelfstandige trainer als rol überhaupt bestaat. **F1 start direct na de F0-rapportage.** Mirror toetst F0 parallel; blijkt een bevinding onjuist, dan is dat een herstelopdracht op de betrokken lijn — geen bouwstop.

### F1 — Zelfstandige trainer: registratie en profiel
**Scope:** registratie zonder club · trainerprofiel · bedrijfsgegevens uit 4.1 · logo · specialisaties · certificeringen · beschikbaarheid · contactgegevens · trainerabonnement als entitlement.
**Niet bouwen:** een tweede entitlementengine; een prijs (zie hoofdstuk 18).
**Tests:** registratie zonder organisatie · profiel zonder bedrijfsgegevens blokkeert facturatie, niet begeleiding.
**Mirror:** BB-60.

### F2 — Klant, sporter en betaler
**Scope:** de drie entiteiten uit 4.2 met hun relaties; de vier voorbeelden (ouder betaalt voor kind · werkgever voor medewerker · sponsor · sporter zelf) werken alle vier.
**Niet bouwen:** klant en sporter als één record.
**Migratie:** bestaande sporters krijgen géén automatische klantrol; de trainer koppelt bewust.
**Tests:** alle vier de betaalrelaties · minderjarige met ouder als klant · klant zonder sporter · sporter zonder klant.
**Mirror:** BB-62 — één samengevoegd record is afkeur.

### F3 — Klanten en sporters beheren
**Scope:** uitnodigen · koppelen · ontkoppelen · meerdere trainers bij één sporter · sportergroepen · actief en inactief · wachtlijst.
**Rechten:** rechten gelden **vanaf acceptatie**, niet met terugwerkende kracht; ontkoppelen laat toegang onmiddellijk vervallen (`endedAt` uit pakket 1).
**Tests:** uitnodiging · acceptatie · ontkoppelen · tweede trainer · cross-account fail-closed.

### F4 — Trainerdocumenten
**Scope:** de rolcatalogi G t/m L uit 3c0 — trainer (21), hoofdtrainer (15), `medical_staff` (12), ouder en minderjarige (14), zelfstandige trainer (22) en sporter (12) — op de werkobjectlaag uit pakket 2, elk met het documenttypecontract van vierentwintig onderdelen en met de achttien planonderdelen uit 3c.2 waar het een plan betreft.
**Niet bouwen:** een eigen documentmodel; zestien losse modules.
**UX:** intake als wizard, maximaal vijf stappen en drie velden per stap, opslaan per stap, hervatten; trainer en sporter vullen elk hun eigen deel.
**Tests:** intake hervatten · ouderbriefing zonder coachadvies over het kind · overdracht met toestemming · **nieuw jaarplan met een vorig jaarplan aanwezig → concept met bron** · nieuw plan zonder enige historie → eerlijk leeg · trainernotitie blijft ongedeeld tenzij de trainer deelt · sporterfeedback niet stilzwijgend in een rapport.

### F5 — Factuurmodel 1: terugkerende coaching
**Scope:** per klant een cyclus instellen (4.4); Sparki maakt automatisch een **conceptfactuur** met factuurnummer, factuurdatum, periode, vervaldatum, klantgegevens, omschrijving, bedrag, btw en totaal.
**Harde regel:** de trainer controleert en verzendt. **Geen blind automatisch verzenden in v1** (BB-69).
**Tests:** maandcyclus · weekcyclus · cyclus met einddatum · concept blijft concept zonder handeling · uitgevoerde test die nog niet gefactureerd is wordt gesignaleerd · ontbrekend btw-nummer wordt gemeld met de verantwoordelijke erbij.

### F6 — Factuurmodel 2: aanvullende diensten
**Scope:** losse dienst factureren: wedstrijdbegeleiding · uitgevoerde test · FTP-test · lactaattest · bikefit · trainingskamp · analyse · adviesgesprek · persoonlijk plan · kracht- of mobiliteitssessie. De trainer kiest klant · dienst · vrije omschrijving · uitvoerdatum · aantal · prijs · btw of KOR · notitie.
**Tests:** losse factuur · meerdere regels · combinatie met een lopende cyclus · **bewijs- of rapportkoppeling aanwezig** bij een gefactureerde test.

### F7 — Briefpapier en templates
**Scope:** eigen briefpapier of huisstijl uploaden: PDF of ondersteund beeldformaat · leesbaarheidscontrole · veilige marges · actieve templateversie · preview · **standaard Sparki-template als fallback**.
**Harde regel:** oude facturen bewaren de gebruikte templateversie; een nieuwe upload verandert **nooit** een bestaande factuur.
**Tests:** upload met te krappe marges wordt geweigerd · oude factuur na nieuwe upload ongewijzigd · fallback bij ontbrekend briefpapier.

### F8 — Nummering, btw, KOR, statussen en creditnota
**Scope:** één doorlopende reeks per onderneming, met prefix en startnummer bij aanvang, aansluitend op een bestaande externe reeks (BB-64) · daarna automatisch · nummer nooit hergebruiken · verzonden factuur niet verwijderen · statussen uit 4.5 · creditnota met verwijzing, reden, geheel of gedeeltelijk, eigen nummer, PDF, status, aanpassing van de betaalstatus en audit · btw en KOR volgens BB-65 en BB-66.
**Niet bouwen:** fiscaal advies; een reeks per klant of per context.
**Tests:** nummer bij verzending toegekend · poging tot verwijderen geweigerd · KOR aan en uit met bestaande facturen ongewijzigd · gedeeltelijke creditnota · reeks terugzetten geweigerd.
**Mirror:** BB-64, BB-66, BB-68.

### F9 — Geldstroom en betaling
**Scope:** BB-63 implementeren: klant betaalt rechtstreeks aan de trainer via diens eigen gekoppelde betaalaccount; Sparki faciliteert en ontvangt niets zelf; bankoverschrijving en handmatig betaald markeren blijven mogelijk; deelbetaling mogelijk.
**Niet bouwen:** een geldstroom over de rekening van Sparki. **De betaallink via een verbonden accountmodel wordt pas geactiveerd na technische én juridische verificatie** — tot dan is de module volledig bruikbaar met handmatige betaalstatus.
**Tests:** handmatig betaald markeren · deelbetaling · te laat · betaling na creditnota.

### F10 — Export naar de boekhouder
**Scope:** Excel en CSV per maand, kwartaal, jaar of vrije periode, met: factuurnummer · factuurdatum · vervaldatum · klant · klantnummer · omschrijving · periode of uitvoerdatum · exclusief btw · btw-percentage · btw-bedrag · inclusief btw · status · betaaldatum · creditreferentie · bedrijfsnaam · valuta. Plus bulkdownload van PDF-facturen en creditnota's.
**Niet bouwen:** een koppeling met ieder boekhoudpakket in v1.
**Tests:** export over een kwartaal met creditnota's · bulkdownload · lege periode.

### F11 — Opzegging en bewaren
**Scope:** BB-67: geen nieuwe facturen · geen nieuwe verzending · archief read-only · export blijft · creditnota's en audit herleidbaar · **geen factuur verwijderen door opzegging** · wettelijke bewaartermijn toepassen, **centraal configureerbaar**.
**Niet bouwen:** een hardcoded bewaartermijn ergens in de code.
**Tests:** opzeggen · daarna exporteren · daarna een factuur proberen te maken · daarna een factuur proberen te verwijderen.

### F12 — Ouder en minderjarige
**Scope:** correcte consent uit pakket 1 · klant versus sporter · ouder betaalt voor kind · ouderbriefing · ouder ziet alleen toegestane data · meerdere kinderen · juiste kindcontext · **overgang naar meerderjarigheid** · beëindiging relatie.
**Harde regel:** **veiligheidsinformatie wordt nooit geblokkeerd bij een betaalprobleem** (BB-71).
**Tests:** twee kinderen bij één ouder · overgang naar 18 jaar · onbetaalde factuur met een openstaande veiligheidsmelding · ouder die coachadvies over het kind probeert te zien.
**Mirror:** BB-71 — één geblokkeerde veiligheidsmelding is afkeur.

### F13 — AI-concepten
**Scope:** AI maakt concepten voor intake · doelen · plan · feedback · rapport · communicatie · **factuuromschrijving** · evaluatie.
**AI mag niet:** een bedrag bepalen zonder de trainer · de btw-status bepalen · een factuur automatisch versturen · een medische diagnose geven · gegevens van een andere klant gebruiken.
**Tests:** concept blijft concept · factuuromschrijving zonder bedrag · geen kruisbestuiving tussen klanten.
**Mirror:** één gegeven van klant A in een concept voor klant B is directe afkeur.

### F14 — Facturatiewerkplek
**Scope:** het startscherm uit 3b-A met de twaalf blokken in vaste volgorde en één primaire actie · klantadministratie 3b-B · dienstencatalogus 3b-C · facturatiemomenten 3b-D · opvolging 3b-E · trainerrapportage 3b-F.
**Niet bouwen:** automatisch incassotraject · automatische aanmaning · btw-aangifte · een tweede mailsysteem · een betaalgedragscore die een klant stigmatiseert.
**Rechten:** uitsluitend de eigen trainer; andere trainers zien niets, ook niet binnen dezelfde club.
**UX mobiel:** factuur bekijken, herinnering versturen, betaald markeren. **Niet** samenstellen.
**UX desktop:** volledige werkplek.
**Tests:** twaalf blokken in vaste volgorde · één primaire actie · klant met twee sporters · dienst met KOR · te laat met betaalafspraak · oninbaar met reden · omzet per kwartaal · communicatie terugvindbaar in de klanthistorie.
**Mirror:** een automatische aanmaning of een stigmatiserende betaalscore is directe afkeur.

### F15 — Eindbewijs
Bewijsbundel per fase plus de veertien ketens van het minimale betaalde product, elk end-to-end.

---

## 10. Migratieregels

**M-1** Bestaande sporters worden **niet** automatisch klant. **M-2** Bestaande trainers worden niet automatisch zelfstandig trainer. **M-3** Geen migratie zonder rollback en telling voor en na. **M-4** Bestaande documenten worden per type omgezet naar de werkobjectlaag; wat niet kan, blijft staan en wordt gemeld. **M-5** Er worden nooit facturen aangemaakt uit historische gegevens.

## 11. Testmatrix

registratie zonder club · trainer met en zonder bedrijfsgegevens · vier betaalrelaties · minderjarige met ouder als klant · twee kinderen bij één ouder · overgang naar meerderjarigheid · tweede trainer bij dezelfde sporter · ontkoppelde trainer · cross-account · tien klanten in het overzicht · intake hervatten · maandcyclus · losse dienst · KOR aan en uit · nummer bij verzending · poging tot verwijderen · gedeeltelijke creditnota · handmatig betaald · deelbetaling · te laat · export per kwartaal · bulkdownload · opzegging daarna export · onbetaalde factuur met veiligheidsmelding · AI-concept tussen twee klanten · briefpapier met krappe marges · oude factuur na nieuwe upload · 360 dp · desktop · 200% tekst · schermlezer · trage verbinding.

## 12. Mirror-toets per fase

| Fase | Kern |
|---|---|
| F0 | bestaat de zelfstandige trainer als rol |
| F1 | registratie zonder organisatie |
| F2 | klant en sporter zijn aparte records |
| F3 | rechten vanaf acceptatie; ontkoppelen werkt onmiddellijk |
| F4 | documenten op de werkobjectlaag, geen eigen model |
| F5 | concept blijft concept zonder handeling |
| F6 | losse dienst met meerdere regels |
| F7 | oude factuur ongewijzigd na nieuwe upload |
| F8 | nummering, KOR, geen verwijdering, creditnota |
| F9 | geen geldstroom over Sparki |
| F10 | export compleet, inclusief creditreferentie |
| F11 | archief read-only, niets verwijderd |
| F12 | veiligheidsinformatie nooit geblokkeerd bij betaalprobleem |
| F13 | geen gegevens van een andere klant in een concept |
| F14 | twaalf blokken, één primaire actie, geen automatische aanmaning |
| F15 | veertien ketens end-to-end |

## 13. Rollback

Elke fase afzonderlijk. **Uitzondering:** F2 terugdraaien betekent F3 t/m F15 terugdraaien, omdat klant, sporter en betaler eronder liggen. **Een verzonden factuur wordt door een rollback nooit verwijderd** — een rollback herstelt code en schema, niet de administratie.

## 14. Directe afkeurgronden

Rechtenlek · dataverlies · onveilige migratie · tweede architectuur · niet-groene build, typecheck of tests · ontbrekende rollback · verzonnen persoonlijke informatie · **klant en sporter als één record** · **verzonden factuur gewijzigd of verwijderd** · factuurnummer hergebruikt · reeks per klant of per context · **geldstroom over de rekening van Sparki** · automatisch verzonden factuur in v1 · fiscaal advies door Sparki · gezondheidsinformatie op een factuur · **veiligheidsinformatie geblokkeerd bij een betaalprobleem** · gegevens van klant A in een concept voor klant B · facturen van de ene trainer zichtbaar voor een andere · hardcoded bewaartermijn · een tweede rapportgenerator voor de factuur-PDF · **een eigen agenda, takenlijst, klantenlijst, zoekfunctie, sjabloonsysteem of meldingenlijst naast een centrale dienst** · een facturatietaak die niet in "Mijn taken" verschijnt · een automatisch incassotraject of automatische aanmaning · een tweede mailsysteem voor factuurcommunicatie · een betaalgedragscore die een klant stigmatiseert · **een leeg planformulier terwijl er een vorig plan bestaat** · een plan zonder brondata of zonder zichtbare onzekerheid · een AI-concept dat als definitief plan wordt gepresenteerd · een trainernotitie of sporterfeedback die stilzwijgend in een gedeeld rapport belandt · een gefactureerde aanvullende dienst zonder bewijs- of rapportkoppeling · een automatisch verzonden betaalherinnering · **een sporter die zijn eigen gegevens- en consentoverzicht niet kan inzien** · een geschiktheidsbericht dat de medische reden bevat · een staffevaluatie waarvan de betrokkene niet mag weten dat hij bestaat · **een gedeeld dossier tussen trainer en `nutrition_specialist` bij dezelfde sporter**.

## 15. Eindbewijs

Per fase SHA en scenario's. Plus één integrale doorloop: trainer registreert zonder club → profiel met bedrijfsgegevens → klant aanmaken met ouder als betaler → sporter koppelen → intake → plan → training → analyse → maandrapport → maandfactuur → betaald markeren → creditnota → export naar de boekhouder → opzegging met behoud van archief.

## 16. Productiepublicatie

**Automatische poort, geen menselijke wachtpoort.** Publiceren mag zodra: build groen · typecheck groen · verplichte tests groen · migraties succesvol gevalideerd · rollback beschikbaar · geen actieve harde stopconditie.

Een acceptatieomgeving mag worden gebruikt voor bewijs en regressietests, maar is **geen verplichte menselijke poort**. Rollback mag automatisch worden uitgevoerd wanneer een vrijgegeven versie faalt.

**Wat wél buiten dit pakket blijft:** een betaalde publieke release blijft geblokkeerd zolang de wettelijke bewaartermijnen onbepaald zijn — dat is een ontbrekende juridische productkeuze en daarmee een harde stop op die lijn, niet op de bouw.

---

*Einde `SPARKI_BUILD_04`.*
