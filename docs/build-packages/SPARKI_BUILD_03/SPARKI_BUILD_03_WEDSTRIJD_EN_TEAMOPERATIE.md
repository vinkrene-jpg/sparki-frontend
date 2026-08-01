# SPARKI BUILD 03 — WEDSTRIJD- EN TEAMOPERATIE

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Technische code:** `SPARKI_BUILD_03`
**Uitvoerder:** Replit · **Toetser:** Mirror (parallel) · **Opdrachtgever:** René
**Datum:** 1 augustus 2026 · **Status:** klaar voor vrijgave, nog niet gestart.
**Volgorde:** het dagschema en het wedstrijdplan draaien op de werkobjectlaag uit `SPARKI_BUILD_02` (F1 t/m F3). Dat is een **technische** afhankelijkheid, geen wachtpoort: alles wat niet op die laag leunt — bezetting, conflicten, voertuigen, materiaal — bouwt parallel door.

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

De volledige operationele keten waarmee een club of team een wedstrijd **voorbereidt, uitvoert, wijzigt en evalueert**: bezetting, voertuigen, materiaal, dagschema, wedstrijdplan, conflictsignalering en een wedstrijddagmodus voor de staf.

**De belofte:** op de dag zelf weet iedereen wat hij doet, wanneer, met welk materiaal en in welk voertuig — ook als er 's ochtends iemand afmeldt.

---

## 2. Bindende besluiten

**BB-40 Wedstrijdwaarheid.** `club_race_events` is het **organisatie-evenement**. Geselecteerde renners krijgen een gekoppelde **persoonlijke** wedstrijdweergave in `races`. Organisatievelden synchroniseren gecontroleerd. Persoonlijke voorbereiding, checklist, opdracht en analyse blijven persoonlijk. **Geen dubbele handmatige invoer.**
**BB-41** Een organisatie-evenement verwijderen verwijdert **niet** automatisch persoonlijke historie. Wijzigingen zijn gelogd.
**BB-42** `race_assignments` is een **aparte structuur naast** de rennerselectie. Rennerselectie blijft: renner · reserve · beschikbaarheid · afmelding.
**BB-43** Wedstrijdbezetting mag afwijken van de seizoensbezetting.
**BB-44** Conflicten worden **zichtbaar en uitlegbaar** gemaakt en **niet automatisch geblokkeerd**. De mens beslist; de beslissing wordt geauditeerd.
**BB-45** Bij afmelding **geen automatische promotie** van een reserve zonder een daarvoor ingestelde regel.
**BB-46** Ploegleider en `medical_staff` zien noodcontact, inzetbaarheid en noodzakelijke praktische veiligheidsinformatie. **Nooit** diagnose, volledige medische reden of algemene medische notities. Elke inzage wordt gelogd.
**BB-47** V1 blijft **één wedstrijddag per evenement**. Meerdaagse en etappekoersen volgen later.
**BB-48** Team €149 mag **pas publiek worden vrijgegeven** wanneer het aantoonbaar meer biedt dan Club — zie hoofdstuk 9, F12.
**BB-49** In de wedstrijddagmodus: geen video, geen afleidende animatie, geen AI-onderbreking.

---

## 3. Verplicht hergebruik

| Bestaand onderdeel | Wat ermee gebeurt |
|---|---|
| werkobjectlaag uit `SPARKI_BUILD_02` | dagschema, wedstrijdplan, materiaalplan en briefing zijn werkobjecten; **geen eigen documentmodel** |
| rechten- en consentlaag uit `SPARKI_BUILD_01` | toegepast; geen tweede rechtenlaag |
| bestaande sporter-wedstrijddagmodus en Volgauto-bouwstenen | hergebruiken waar passend; niet opnieuw bouwen |
| `club_race_events` en `races` | bestaande tabellen, gekoppeld — niet vervangen |
| bestaande rennerselectie | blijft; `race_assignments` komt ernaast |
| rapportgenerator | dagschema, bezetting en materiaallijst als RT-12, RT-13, RT-14 |
| notificatielaag | uitgebreid; geen tweede systeem |
| componentbibliotheek, wedstrijddagcomponenten `CMP-37..39` | hergebruikt |

---

## 3a. Centrale platformdiensten — hergebruiken, niet nabouwen

Dit pakket bouwt **geen** van de dertien centrale diensten. Het gebruikt ze.

| Dienst | Uit | Toepassing hier |
|---|---|---|
| PD-1 agenda en gebeurtenissen | pakket 01 | wedstrijddag, verzamelmoment, vertrek, briefing, evaluatie — elk met `source_module` en `source_record_id` naar het evenement |
| PD-2 locaties | pakket 01 | verzamelpunt, start, finish, hotel, parkeerplaats, bevoorrading, materiaalpost, ziekenhuis, noodlocatie |
| PD-3 contacten en relaties | pakket 01 | staf, chauffeurs, vrijwilligers, wedstrijdorganisatie, noodcontacten |
| PD-4 bestanden en media | pakket 01 | briefings, bewijsfoto's van materiaal, wedstrijdreglement |
| PD-5 inbox en notificaties | pakket 01 | afmelding, wijziging, conflict, kritieke melding |
| PD-7 taken | pakket 02 | alle dagschema-, materiaal- en voertuigtaken |
| PD-8 sjablonen | pakket 02 | wedstrijdplan, dagschema, briefing |
| PD-9 zoeken | pakket 02 | wedstrijden, plannen, taken, locaties |
| PD-10 goedkeuring | pakket 02 | selectie, dagschema, briefing, planwijziging |
| PD-11 archief en bewaren | pakket 02 | evenement-, bezettings- en inzagegegevens |
| PD-12 gebruikersaudit | pakket 02 | wie wijzigde de selectie, wie opende noodinformatie |
| PD-13 import en export | pakket 02 | wedstrijdkalender, bezetting, agenda-export |

**Harde regel:** één eigen agenda, takenlijst, locatielijst of meldingenlijst in dit pakket is een **directe herstelgrond**.

**Elke taak uit een dagschema verschijnt in "Mijn taken"** van de verantwoordelijke (PD-7). Een taak die alleen in het dagschema bestaat, telt als niet gebouwd.

### Beschikbaarheid en capaciteit

Zichtbaar per persoon, rol, team en periode: beschikbaar · beperkt beschikbaar · niet beschikbaar · onbekend · vakantie · geblesseerd (uitsluitend als **inzetbaarheid**, nooit met reden) · reeds ingepland elders · maximaal aantal dagdelen · reistijdconflict.

**Harde regel:** beschikbaarheid is een **feit**, geen medische mededeling. "Niet inzetbaar tot 12 augustus" is toegestaan; de reden niet.

---

## 3b0. Rolcatalogus operationele documenten

Alle typen hieronder draaien op de werkobjectlaag en de centrale documentenbibliotheek uit pakket 02. Elk type draagt het **documenttypecontract (DTC)** van vierentwintig onderdelen. **Gedeelde objecttypen waar mogelijk; per rol een passende template en weergave** — niet per rol een eigen objectmodel.

**A. Clubbeheer (22)** — clubjaarplan · seizoenstartplan · organogram · rollenmatrix · ledenimportverslag · gedragscode · huisregels · ouderafspraken · privacyinformatie · vertrouwenscontactinformatie · noodprocedure · clubcontactlijst · trainingsrooster · wedstrijdkalender · vrijwilligersplanning · accommodatieplan · voertuigenoverzicht · materiaaloverzicht · bestuursrapportage · incidentregister · seizoensevaluatie · overdrachtsdocument.

**B. Teammanager (16)** — teamjaarplan · teamseizoenplan · teamstafplan · selectieoverzicht · beschikbaarheidsoverzicht · teamkalender · wedstrijdprogramma · wedstrijdbezetting · vervoersplan · hotel- en verblijfsplan · materiaalplan · teambriefing · taakverdeling · conflictenoverzicht · evaluatie · teamoverdracht.

**C. Ploegleider (24)** — wedstrijdplan · koersstrategie · dagschema · selectie · reservelijst · stafbezetting · taakverdeling · rennerbriefing · stafbriefing · voertuigindeling · materiaalplan · parcoursanalyse · klim- en afdalingsinformatie · wind- en weersplan · voedings- en bevoorradingsplan · communicatieplan · noodplan · contactlijst · wijzigingsbericht · wedstrijddagchecklist · incidentrapport · wedstrijdanalyse · wedstrijdevaluatie · terugkomstrapport.

**D. Mechanieker (20)** — zie 3b.3.

**E. Soigneur en verzorger (15)** — zie 3b.4, aangevuld met **rennerbijzonderheden uitsluitend binnen rechten**.

**F. Voedingsdeskundige — `nutrition_specialist` (17)** — voedingsintake · allergieën en beperkingen · voedingsanalyse · voedingsdoelen · trainingsdagplan · rustdagplan · wedstrijddagplan · herstelvoedingsplan · reisdagplan · trainingskampplan · bevoorradingsadvies · hydratatieplan · supplementenoverzicht · voortgangsrapport · evaluatie · adviesbrief sporter · adviesbrief trainer. **Alleen binnen bevoegdheid en toestemming.**

**Waar rolcatalogi overlappen, is het één objecttype met twee weergaven.** Het materiaalplan van de teammanager en dat van de mechanieker zijn hetzelfde object; de ploegleider ziet er een derde weergave van. Drie kopieën is een afkeurgrond.

**Wat na inrichting als concept kan klaarstaan** — nooit automatisch gepubliceerd:
*Club, na onboarding:* organisatiesamenvatting · rollenoverzicht · teamoverzicht · trainingsrooster · contactlijst · ouderinformatie · gedragscodestructuur · noodprocedurestructuur · seizoenstartchecklist.
*Team, na teaminrichting:* teamoverzicht · stafindeling · seizoenplanning · wedstrijdvoorbereiding · materiaalchecklist · voertuigplanning · rolbriefings.

---

## 3b. Inhoud van de operationele documenttypen

Elk type hieronder draagt het **inhoudscontract van eenentwintig onderdelen** uit pakket 02, hoofdstuk 3b. Hier staat de inhoud; het contract staat daar.

### 3b.1 Wedstrijdplan — veertien blokken

**A. Algemene gegevens** — evenement · datum · categorie · organisatie · team · locatie · start- en finishtijd · contact organisator · reglement · inschrijfgegevens.
*Automatisch gevuld uit het organisatie-evenement en de locatielaag. De trainer typt dit niet over.*

**B. Doel en strategie** — sportief doel · resultaatdoel · ontwikkeldoel · hoofdstrategie · alternatieve strategie · beslismomenten · rol per renner · reservescenario.
*Handmatig verplicht. Dit is het deel dat een mens moet bedenken.*

**C. Parcours** — route · GPX · afstand · hoogtemeters · klimmen · afdalingen · technische punten · kasseien en onverhard · windgevoelige zones · bevoorradingspunten · materiaalposten · gevaarlijke punten · start en finish · parkeren.
*Automatisch uit de route- en locatielaag waar aanwezig; gevaarlijke punten komen mede uit eerdere evaluaties.*

**D. Weer en omstandigheden** — weersverwachting · temperatuur · wind · neerslag · kledingadvies · band- en materiaaladvies · hydratatie · hitte- en koudemaatregelen.
*AI-concept, met bron en tijdstip van de verwachting zichtbaar. Advies is voorstel, geen voorschrift.*

**E. Renners** — selectie · reserves · beschikbaarheid · taken · tactische rol · persoonlijke briefing · materiaal · voeding · noodcontact · **uitsluitend toegestane veiligheidsinformatie**.
*Nooit een medische reden. Alleen inzetbaarheid en wat ter plaatse nodig is.*

**F. Staf** — ploegleider · trainer · mechanieker · soigneur · `medical_staff` · chauffeur · vrijwilliger · taken · tijdvakken · bevestiging · contactgegevens.
*Uit `race_assignments` en de contactenlaag.*

**G. Voertuigen en vervoer** — voertuig · bestuurder · passagiers · materiaalcapaciteit · vertrekpunt · vertrektijd · route · parkeerplek · tanken en laden · terugrit · pechhulp.

**H. Materiaal** — fiets · reservefiets · wielen · banden · bandendruk · gereedschap · radio · transponder · kleding · onderdelen · reserveonderdelen · verantwoordelijke · controlestatus.

**I. Voeding en bevoorrading** — voor, tijdens en na de wedstrijd · bidons · gels · vaste voeding · bevoorradingsmomenten · locatie · verantwoordelijke · individuele afwijkingen · **allergieën en beperkingen uitsluitend binnen toestemming**.

**J. Communicatie** — briefing · radioafspraken · noodnummers · wijzigingskanaal · wie informeert wie · gelezen en bevestigd · fallback bij slechte verbinding.

**K. Nood en incident** — noodcontacten · ziekenhuis · ambulance · pech · verloren renner · materiaalprobleem · uitval staf · weersomslag · incidentregistratie · escalatie.

**L. Dagschema** — zie 3b.2. Het dagschema is een eigen werkobject en wordt **gekoppeld**, niet gekopieerd.

**M. Ervaring uit eerdere edities** — vorig plan · evaluatie · terugkerende problemen · materiaalproblemen · bevoorradingsproblemen · tijdsoverschrijdingen · routeproblemen · lessons learned · **welke punten nu zijn aangepast**.
*Dit blok is de kern van het organisatiegeheugen. Het laatste punt is het bewijs dat er iets met de ervaring is gedaan.*

**N. Uitvoering en evaluatie** — plan tegenover werkelijkheid · afwijkingen · incidenten · scores · opmerkingen staf · opmerkingen renners · AI-conceptsamenvatting · bevestigde lessons learned · verbeterpunten voor de volgende editie.

### 3b.2 Dagschema — twintig onderdelen

algemene daginformatie · tijdlijn · locatie per stap · rol per stap · verantwoordelijke · deelnemers · benodigd materiaal · voertuig · instructie · afhankelijkheid · bevestigingsstatus · wijziging · vertraging · noodalternatief · contactpersoon · persoonlijke rolweergave · afvinken · **werkelijk tijdstip** · **afwijking** · evaluatie.

**Sparki maakt automatisch persoonlijke weergaven** voor: ploegleider · renner · mechanieker · soigneur · chauffeur · `medical_staff` · vrijwilliger.

*"Werkelijk tijdstip" naast het geplande tijdstip is wat het dagschema van een planning tot een geheugen maakt. Zonder dat veld is achteraf niet te zien dat het vertrek structureel een kwartier uitloopt.*

### 3b.3 Mechaniekerdocumenten — twintig typen

materiaalchecklist · fiets per renner · reservefietsplan · wielenschema · bandenplan · bandendrukadvies · gereedschapslijst · onderdelenlijst · voorraadlijst · defectmelding · reparatieopdracht · onderhoudsrapport · vertrekcheck · wedstrijddagcheck · materiaalpostplan · terugkomstcheck · materiaaloverdracht · schadeoverzicht · reparatiehistorie · evaluatie materiaal.

**Velden waar relevant:** renner · fiets · component · serienummer · status · defect · urgentie · verantwoordelijke · tijdstip · oplossing · vervangend materiaal · kosten waar relevant · foto · historie · **terugkerend probleem** · lessons learned.

*Foto's lopen via de centrale bestandslaag (PD-4). "Terugkerend probleem" is het veld waarmee de derde kapotte spaak aan dezelfde wiel een signaal wordt in plaats van drie losse meldingen.*

### 3b.4 Soigneur- en verzorgingsdocumenten — vijftien typen

dagdeelplanning · bevoorradingsschema · bidonplan · gel- en voedingsuitgifte · hydratatieplan · herstelplanning · massagelijst · hotel- en kamerindeling · kleding- en wasplanning · vertrekcheck · verzorgingscheck · wedstrijddagcheck · terugkomstcheck · bevoorradingsevaluatie · herstelevaluatie.

### 3b.5 Voedingsdocumenten — veertien typen

intake · allergieën · beperkingen · voedingsanalyse · trainingsdagplan · wedstrijddagplan · rustdagplan · herstelplan · reisdagplan · supplementenoverzicht · voortgang · evaluatie · advies aan sporter · advies aan trainer.

**Harde grenzen, zonder uitzondering:** geen diagnose · geen verboden medische informatie · jeugdregels gelden onverkort · toestemming vereist · **geen gewichts- of caloriedoelen voor minderjarigen**.

> **Opgelost — besluit BB-14.** De rol bestaat: Nederlandse naam **Voedingsdeskundige**, rolwaarde **`nutrition_specialist`**, met eigen rolcontext en eigen startscherm. Hij wordt server-side aangemaakt in pakket 01, fase F3. **Zolang die rolwaarde er technisch nog niet is, wordt hij niet gesimuleerd en krijgen soigneur en trainer géén bredere rechten** — de bestaande bevoegdheden blijven ongewijzigd en deze fase wacht.
>
> **Rolgrenzen:** uitsluitend gegevens die voor voedingsbegeleiding noodzakelijk zijn · geen diagnose · geen medisch dossier zonder afzonderlijke toestemming · bij minderjarigen geen gewichts- of caloriedoelen · trainer, soigneur en ploegleider zien alleen de **uitvoeringsinformatie** (wat, wanneer, hoeveel), niet de analyse eronder.

---

## 4. Datamodel

### 4.1 Wedstrijdwaarheid
- `club_race_events` — organisatie-evenement: organisatie · team · naam · datum · locatie · type · categorie · status.
- `races` — persoonlijke weergave per geselecteerde renner, met `club_race_event_id` als koppeling.
- `race_event_sync_log` — welk organisatieveld wanneer naar welke persoonlijke weergave is gesynchroniseerd.

### 4.2 `race_assignments`
evenement · organisatie/team · persoon · **rol** (ploegleider · teammanager · trainer · hoofdtrainer waar relevant · mechanieker · soigneur · `medical_staff` · chauffeur · vrijwilliger) · operationele taak · tijdvak · bevestigingsstatus · toegewezen door · gewijzigd op.

### 4.3 Voertuigen
`race_vehicle`: voertuig · type · bestuurder · zitplaatsen · materiaalcapaciteit · kenteken · laad- en tankinformatie · vertrekpunt · vertrektijd · parkeerinformatie · pechhulp · verzekeringreferentie · team · evenement · tijdvak · terugrit.

### 4.4 Materiaal
`race_equipment`: evenement · renner · fiets · reservefiets · wielen · banden · gereedschap · radio · transponder · kleding · voeding · bidons · onderdelen · verantwoordelijke · controlestatus · defect · vervanging · afvinkstatus · terugkomstcontrole.

### 4.5 Conflicten
`operational_conflict`: evenement · type · betrokken entiteiten · ernst · uitleg · status (open · geaccepteerd · opgelost) · beslisser · beslismoment.

### 4.6 Noodinformatie
Hergebruikt de vier informatieklassen uit `SPARKI_BUILD_01`: `availability_status` · `safety_note` · `medical_reason` (afgeschermd) · `emergency_contact` (met logging).

**Geen nieuw medisch veld in dit pakket.**

---

## 5. API

- `GET /race-events/{id}` · `POST /race-events/{id}/select-riders` — maakt gekoppelde persoonlijke weergaven.
- `GET/POST/PATCH /race-assignments` — met conflictcontrole bij opslaan.
- `GET /race-events/{id}/conflicts` — met uitleg per conflict.
- `POST /race-events/{id}/withdrawal` — afmelding; informeert de ploegleider direct, toont reservekandidaten.
- `GET/POST /race-vehicles` · `GET/POST /race-equipment`
- `GET /race-events/{id}/dayplan` — het dagschema als werkobject, rolgefilterd.
- `GET /race-day/me` — de persoonlijke wedstrijddagweergave: huidige taak, volgende taak, tijd tot taak, wijzigingen.
- `POST /race-day/tasks/{id}/complete` · `POST /race-day/problem` · `POST /race-day/emergency`

**Regel:** rolfiltering server-side. `GET /race-day/me` geeft uitsluitend wat deze rol op dit evenement mag zien.

---

## 6. Rechten

| Rol | Ziet |
|---|---|
| ploegleider | volledige operatie van zijn evenement; van renners uitsluitend inzetbaarheid en praktische veiligheidsinformatie |
| `nutrition_specialist` | uitsluitend wat voor voedingsbegeleiding noodzakelijk is, binnen de koppeling aan sporter, team of organisatie; geen diagnose; geen medisch dossier zonder afzonderlijke toestemming |
| teammanager | bezetting, programma, staf; geen medische reden |
| trainer | eigen gekoppelde renners binnen het evenement |
| mechanieker | materiaal, voertuigen, eigen taken |
| soigneur | verzorging, voeding, eigen taken |
| `medical_staff` | medische reden binnen consent; inzage gelogd |
| chauffeur, vrijwilliger | eigen taken, tijden en locaties |
| renner | eigen persoonlijke weergave, eigen taken, eigen briefing |

**Nooit:** diagnose of medische notitie bij een operationele rol. **Nooit:** gegevens van een ander team of een andere organisatie in hetzelfde beeld.

---

## 7. Mobiele UX

**Wedstrijddagmodus voor staf** — hergebruikt `CMP-37`, `CMP-38`, `CMP-39`:

actieve rol en context · huidige taak · volgende taak · tijd tot taak · wijzigingen sinds je laatst keek · dagschema · bezetting · materiaal · voertuig · kaart · contacten · afvinken · probleem melden · noodhandeling.

**Eisen:** grote tikvlakken (≥ 64 dp) · zonlichtleesbaar · batterijzuinig · werkt bij slechte verbinding · geen video · geen afleidende animatie · geen AI-onderbreking · niet typen — alles is kiezen, afvinken of bevestigen.

**Noodhandeling:** permanent bereikbaar, buiten de duimzone, één korte bevestiging, bereikt de juiste persoon, **en zegt eerlijk wanneer er geen verbinding is** — een noodhandeling die stil faalt is een directe herstelgrond.

## 8. Desktop UX

Voorbereiding en evaluatie: bezetting samenstellen, voertuigen en materiaal indelen, dagschema opbouwen, wedstrijdplan schrijven, conflicten overzien, parallelle wedstrijden naast elkaar.

---

## 9. Fasen en Replit-opdrachten

### F0 — Inventarisatie (geen code)
**Scope:** huidige structuur van `club_race_events` en `races` en hun relatie · bestaande rennerselectie · bestaande voertuig- of materiaalregistratie · bestaande sporter-wedstrijddagmodus en Volgauto-bouwstenen · bestaande dagschema-opslag · bestaande notificaties rond een evenement · waar operationele rollen nu medische velden kunnen lezen.
**Bewijs:** per claim schema, endpoint of scherm; per afwezigheid de vindplaats.
**Mirror:** het laatste punt is het zwaarste — elke plek waar een operationele rol een medisch veld kan lezen, is een bevinding. **F1 start direct na de F0-rapportage.** Mirror toetst F0 parallel; blijkt een bevinding onjuist, dan is dat een herstelopdracht op de betrokken lijn — geen bouwstop.

### F1 — Wedstrijdwaarheid
**Scope:** BB-40 en BB-41 implementeren: koppeling `club_race_events` → `races`, gecontroleerde synchronisatie van organisatievelden, persoonlijke velden blijven persoonlijk, geen dubbele invoer, verwijderen raakt persoonlijke historie niet, alles gelogd.
**Niet bouwen:** een derde evenementtabel.
**Migratie:** bestaande losse `races` zonder organisatie-evenement blijven bestaan en werken; ze worden **niet stil gekoppeld**.
**Tests:** renner selecteren maakt persoonlijke weergave · organisatieveld wijzigen synchroniseert · persoonlijk veld wijzigen synchroniseert niet terug · evenement verwijderen laat historie staan.
**Mirror:** BB-40, BB-41.

### F2 — Wedstrijdbezetting
**Scope:** `race_assignments` naast de rennerselectie; alle rollen uit 4.2; taak, tijdvak, bevestigingsstatus; afwijking van de seizoensbezetting toegestaan.
**Niet bouwen:** de rennerselectie vervangen.
**Tests:** staflid toewijzen · bevestiging · afwijking van seizoensbezetting · rol zonder invulling.
**Mirror:** BB-42, BB-43.

### F3 — Conflictsignalering
**Scope:** de negen conflicttypen: persoon dubbel ingepland · onbeschikbaarheid · overlappende reistijd · voertuig dubbel ingepland · renner in twee selecties · materiaal dubbel toegewezen · minimale bezetting ontbreekt · rol niet ingevuld · afmelding zonder vervanging.
**Regels:** zichtbaar · uitlegbaar · **niet automatisch geblokkeerd** · menselijke beslissing · audit.
**Tests:** elk van de negen, plus: conflict accepteren en de reden vastleggen.
**Mirror:** BB-44 — automatische blokkade is afkeur.

### F4 — Afmelding en reserves
**Scope:** ploegleider direct informeren · reservekandidaten tonen · **geen automatische promotie zonder ingestelde regel** · wijzigingen werken door naar bezetting, briefing en dagschema · betrokkenen informeren · oude versie bewaren.
**Tests:** afmelding op de dag zelf · doorwerking naar drie objecten · notificatie naar de juiste personen · oude versie blijft.
**Mirror:** BB-45.

### F5 — Voertuigen
**Scope:** alle velden uit 4.3, met conflictdetectie op dubbele inzet en op de terugrit.
**Tests:** voertuig dubbel ingepland · te weinig zitplaatsen · bestuurder ook elders ingepland.

### F6 — Materiaal
**Scope:** alle velden uit 4.4, met afvinken, defect, vervanging en terugkomstcontrole.
**UX:** afvinken met handschoenen, één tik, 64 dp.
**Tests:** materiaal dubbel toegewezen · defect vóór vertrek · terugkomstcontrole met ontbrekend materiaal.

### F7 — Dagschema en taken
**Scope:** het dagschema **als werkobject** op de laag uit pakket 2, met de zestien standaardmomenten: verzamelen · vertrek · aankomst · inschrijving · briefing · verkenning · voeding · warming-up · start · bevoorrading · materiaalpost · finish · dopingcontrole · herstel · terugreis · evaluatie. Per rol een persoonlijke weergave.
**Niet bouwen:** een eigen dagschemamodel naast de werkobjectlaag.
**Tests:** vier rollen zien elk hun eigen taken · publiceren maakt versie met wijzigingssamenvatting · PDF is RT-12.
**Mirror:** dit is tevens de pilotbevestiging van pakket 2.

### F8 — Wedstrijdplan
**Scope:** doel · strategie · rol per renner · parcours · kritieke punten · klimmen · afdalingen · wind · materiaalkeuze · voeding · communicatie · reserveplan · beslismomenten · noodscenario · briefing. Als werkobject.
**Tests:** publiceren · renner ziet zijn eigen rol · wijziging leidt tot melding.

### F9 — Wedstrijddagmodus voor staf
**Scope:** de veertien onderdelen uit hoofdstuk 7, op de bestaande wedstrijddagcomponenten.
**Niet bouwen:** een tweede modus naast de sporterversie; video of animatie.
**Tests:** handschoenen · zonlicht · slechte verbinding · afgebroken verbinding tijdens afvinken · noodhandeling zonder bereik · batterij- en dataverbruik op een referentietoestel.
**Mirror:** BB-49; een stil falende noodhandeling is directe afkeur.

### F10 — Noodinformatie
**Scope:** de vier informatieklassen toepassen; ploegleider en `medical_staff` zien uitsluitend wat BB-46 toestaat; elke inzage gelogd.
**Niet bouwen:** een nieuw medisch veld; een vrij tekstveld waar een medische reden in past.
**Tests:** ploegleider opent een renner met een beperking → ziet inzetbaarheid en praktische veiligheidsinformatie, **geen reden** · inzage verschijnt in het logboek.
**Mirror:** BB-46 — één zichtbare medische reden bij een operationele rol is afkeur.

### F11 — Parallelle wedstrijden
**Scope:** meerdere teams · meerdere wedstrijden · gedeelde staf · gedeelde voertuigen · gedeeld materiaal · afzonderlijke documenten · afzonderlijke context · **gecombineerde conflicten** · geen gegevensmix.
**Niet bouwen:** meerdaagse of etappekoersen (BB-47).
**Tests:** twee wedstrijden op dezelfde dag met één mechanieker · gedeeld voertuig · contextwissel zonder mix.

### F12 — Beschikbaarheid en capaciteit
**Scope:** de negen beschikbaarheidstoestanden per persoon, rol, team en periode; koppeling aan PD-1 zodat een reeds ingeplande gebeurtenis elders zichtbaar wordt als conflict; maximaal aantal dagdelen; reistijdconflict.
**Niet bouwen:** een eigen agenda; een medische reden bij een beschikbaarheidsstatus.
**Tests:** persoon elders ingepland · vakantie · beperkt beschikbaar · reistijd tussen twee wedstrijden · geblesseerd toont uitsluitend inzetbaarheid.
**Mirror:** één zichtbare medische reden bij een beschikbaarheidsstatus is directe afkeur.

### F13 — Mechanieker-, verzorgings- en voedingsdocumenten
**Scope:** de rolcatalogi A t/m F uit 3b0 — clubbeheer (22), teammanager (16), ploegleider (24), mechanieker (20), soigneur en verzorger (15) en voedingsdeskundige `nutrition_specialist` (17) — elk op de werkobjectlaag met het documenttypecontract van vierentwintig onderdelen, en met gedeelde objecttypen waar de catalogi overlappen.
**Niet bouwen:** een eigen documentmodel per rol · een rolscherm voor een niet-bestaande rolwaarde · gewichts- of caloriedoelen bij minderjarigen · bredere trainer- of soigneurrechten als vervanging voor `nutrition_specialist`.

**Technische afhankelijkheid:** de voedingsdocumenten hangen aan de rolwaarde `nutrition_specialist` (pakket 01, F3). Bestaat die nog niet, dan bouwt Replit het documentmodel wél en koppelt hij de rol zodra hij er is. **Wat niet mag:** de rol simuleren of soigneur en trainer intussen bredere rechten geven.
**Rechten:** voedingsdocumenten binnen toestemming; allergieën en beperkingen uitsluitend waar de grondslag dat toestaat; nooit een diagnose.
**UX mobiel:** afvinken en melden met handschoenen; één regel per punt.
**Tests:** minderjarige met een voedingsplan → geen gewichts- of caloriedoel · allergie zonder toestemming → niet zichtbaar · `nutrition_specialist` opent een medisch dossier zonder afzonderlijke toestemming → geweigerd en gelogd · trainer opent een voedingsplan → ziet uitvoeringsinformatie, niet de analyse · voedingsdeskundige gekoppeld aan één sporter ziet geen andere sporters · terugkerend materiaalprobleem na drie meldingen · foto bij defect zonder recht → geweigerd.
**Mirror:** één gewichts- of caloriedoel bij een minderjarige is directe afkeur.

### F14 — Teamproduct en eindbewijs
**Scope:** aantonen dat Team meer biedt dan Club, op alle twaalf punten: meerdere teams · parallelle wedstrijden · complete operationele organisatie · staf · voertuigen · materiaal · taken · persoonlijke briefings · conflictsignalering · levende werkobjecten · wedstrijddagmodus · organisatiebreed overzicht · professionele exports.
**Bewijs:** een zij-aan-zij vergelijking Club versus Team, per punt, met bewijs. **Zonder dit bewijs blijft Team €149 geblokkeerd voor publieke vrijgave** (BB-48).

---

## 10. Migratieregels

**M-1** Bestaande `races` zonder organisatie-evenement blijven werken en worden niet stil gekoppeld. **M-2** Bestaande dagschema's worden omgezet met telling voor en na; wat niet kan, blijft staan en wordt gemeld. **M-3** Geen migratie zonder rollback. **M-4** Persoonlijke wedstrijdhistorie wordt nooit door een organisatiewijziging geraakt.

## 11. Testmatrix

vier rollen op één dagschema · afmelding op de dag zelf · negen conflicttypen · gedeeld voertuig tussen twee wedstrijden · materiaal dubbel toegewezen · minderjarige renner · ploegleider met beperkingsinformatie · `medical_staff` met en zonder consent · slechte verbinding · afgebroken verbinding tijdens afvinken · noodhandeling zonder bereik · handschoenen · zonlicht · batterij en data op referentietoestel · twee tabbladen met verschillende evenementen · notificatie opent juiste evenement en rol · offline · 360 dp · desktop · 200% tekst.

## 12. Mirror-toets per fase

| Fase | Kern |
|---|---|
| F0 | waar kan een operationele rol nu een medisch veld lezen |
| F1 | koppeling en synchronisatie, geen dubbele invoer |
| F2 | bezetting naast selectie, afwijking toegestaan |
| F3 | negen conflicten zichtbaar en uitlegbaar, niet geblokkeerd |
| F4 | geen automatische promotie; doorwerking naar drie objecten |
| F5 | voertuigconflicten |
| F6 | materiaal afvinkbaar met handschoenen |
| F7 | dagschema als werkobject, vier rolweergaven |
| F8 | wedstrijdplan als werkobject |
| F9 | modus zonder video, noodhandeling eerlijk offline |
| F10 | geen medische reden bij een operationele rol; inzage gelogd |
| F11 | geen gegevensmix bij parallelle wedstrijden |
| F12 | beschikbaarheid zonder medische reden; conflict bij dubbele inplanning |
| F13 | jeugdgrens in voeding; terugkerend probleem gesignaleerd |
| F14 | Team-meerwaarde op twaalf punten aangetoond |

## 13. Rollback

Elke fase afzonderlijk. F1 terugdraaien betekent F2 t/m F14 terugdraaien, omdat de koppeling eronder ligt. Een half gemigreerd dagschema gaat terug naar de oude opslag.

## 14. Directe afkeurgronden

Rechtenlek · dataverlies · onveilige migratie · tweede architectuur · niet-groene build, typecheck of tests · ontbrekende rollback · verzonnen persoonlijke informatie · **medische reden zichtbaar voor een operationele rol** · **noodhandeling die zonder verbinding stil faalt** · automatische blokkade bij een conflict · automatische promotie van een reserve zonder ingestelde regel · dubbele handmatige invoer van wedstrijdgegevens · gegevensmix tussen teams of wedstrijden · video of afleidende animatie in de wedstrijddagmodus · een tweede dagschemamodel naast de werkobjectlaag · **een eigen agenda, takenlijst, locatielijst, contactenlijst, notificatie-inbox, zoekfunctie of sjabloonsysteem in dit pakket** · een dagschematak die niet in "Mijn taken" verschijnt · een medische reden bij een beschikbaarheidsstatus · een vrije-tekstlocatie waar PD-2 een locatie kent · **een leeg wedstrijdplan of dagschema terwijl er een vorige editie bestaat** · een wedstrijdplan zonder blok M (ervaring uit eerdere edities) · een dagschema zonder werkelijk tijdstip en afwijking · een gewichts- of caloriedoel bij een minderjarige · een diagnose in een voedings- of verzorgingsdocument · een rolscherm voor een rolwaarde die server-side niet bestaat · **hetzelfde objecttype dat in drie rolcatalogi als drie aparte modellen wordt gebouwd** · een clubdocument dat als concept automatisch wordt gepubliceerd · **`nutrition_specialist` met toegang tot een medisch dossier zonder afzonderlijke toestemming** · een trainer, soigneur of ploegleider die de voedingsanalyse ziet in plaats van alleen de uitvoeringsinformatie · een gesimuleerde voedingsrol zolang de rolwaarde nog niet bestaat.

## 15. Eindbewijs

Per fase SHA en scenario's. Plus één integrale doorloop van een volledige wedstrijddag met vier rollen: voorbereiden, publiceren, afmelding verwerken, uitvoeren in de modus, evalueren, dupliceren naar de volgende wedstrijd. En de Club-versus-Team-vergelijking uit F12.

## 16. Productiepublicatie

**Automatische poort, geen menselijke wachtpoort.** Publiceren mag zodra: build groen · typecheck groen · verplichte tests groen · migraties succesvol gevalideerd · rollback beschikbaar · geen actieve harde stopconditie.

Een acceptatieomgeving mag worden gebruikt voor bewijs en regressietests, maar is **geen verplichte menselijke poort**. Rollback mag automatisch worden uitgevoerd wanneer een vrijgegeven versie faalt.

**Wat wél buiten dit pakket blijft:** een betaalde publieke release blijft geblokkeerd zolang de wettelijke bewaartermijnen onbepaald zijn — dat is een ontbrekende juridische productkeuze en daarmee een harde stop op die lijn, niet op de bouw.

---

*Einde `SPARKI_BUILD_03`.*
