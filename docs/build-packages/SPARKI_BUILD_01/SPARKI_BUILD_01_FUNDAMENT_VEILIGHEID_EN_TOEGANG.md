# SPARKI BUILD 01 — FUNDAMENT, VEILIGHEID EN TOEGANG

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Technische code:** `SPARKI_BUILD_01`
**Uitvoerder:** Replit · **Toetser:** Mirror (parallel) · **Opdrachtgever:** René
**Datum:** 1 augustus 2026 · **Status:** klaar voor vrijgave, nog niet gestart.
**Volgorde:** dit pakket gaat vóór `SPARKI_BUILD_02`, `03` en `04` — een **technische** volgorde, geen wachtpoort. Zodra een centrale dienst hier bruikbaar is, kan het volgende pakket erop verder; parallel bouwen aan onafhankelijke onderdelen mag.

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

Herstel alle fundamentele gaten en defecten in leeftijd, toestemming, rechten, rolcontext en navigatie **voordat** de operationele modules verder worden uitgebouwd. Wat hier niet klopt, plant zich voort in elk volgend pakket.

**De belofte van dit pakket:** iedere gebruiker ziet precies dat wat bij zijn rol, zijn organisatie en zijn toestemming hoort — en niets anders, ook niet via een omweg.

---

## 2. Bindende besluiten

Deze staan vast. Ze zijn geen suggestie en worden niet opnieuw afgewogen.

**BB-01** Eén centrale leeftijds- en toestemmingsservice. Frontend en backend gebruiken exact dezelfde consent-statussen.
**BB-02** Toestemming wordt **server-side** afgedwongen. Client-side verbergen telt niet.
**BB-03** Een minderjarige kan nooit zelf ouderlijke toestemming accepteren, en nooit zelf verplicht oudertoezicht uitschakelen.
**BB-04** Vier gescheiden soorten informatie: **operationele beschikbaarheid** · **praktische veiligheidsinformatie** · **afgeschermde medische reden** · **noodcontact**. Een operationele rol krijgt de eerste twee, nooit de derde.
**BB-05** Geen medische reden in een vrij tekstveld dat operationele rollen kunnen lezen.
**BB-06** Vaste vijf navigatieposities, met vaste betekenis: 1 startpunt · 2 hoofdonderwerp · 3 uitvoeren · 4 terugkijken · 5 **Meer**. Positie 5 heet altijd Meer. Labels 1–4 mogen per rol verschillen; aantal, volgorde en betekenis niet.
**BB-07** Geen zesde hoofditem, in geen enkele rol en in geen enkel pakket.
**BB-08** Iedere server-side rolwaarde heeft een eigen startpunt. **Geen enkele rol valt terug op de atleetweergave.**
**BB-09** Een beëindigde relatie verliest **onmiddellijk** actuele toegang. Historische records blijven bestaan zonder actuele toegang.
**BB-10** Bij twijfel over rechten: **fail-closed**. Niets tonen, en zeggen waarom.
**BB-11** Een trainer kan niet aan een jeugdgroep worden gekoppeld wanneer de verplichte VOG-status ontbreekt.
**BB-12** Geen gevoelige inhoud in een pushmelding. De melding zegt dát er iets is, niet wat.

**BB-14 — Voedingsdeskundige is een eigen rol.** Nederlandse naam **Voedingsdeskundige**, technische rolwaarde **`nutrition_specialist`**, server-side.

*Wat de rol doet:* voedingsintake, voedingsanalyse en voedingsplannen opstellen. Koppelbaar aan een **individuele sporter, een team of een organisatie**.

*Grenzen, alle server-side afgedwongen:*
- ziet **uitsluitend** gegevens die voor voedingsbegeleiding noodzakelijk zijn;
- **geen medische diagnose**;
- **geen toegang tot medische dossiers zonder afzonderlijke toestemming** — de koppeling als voedingsdeskundige is die toestemming niet;
- bij minderjarigen **geen gewichts- of caloriedoelen**;
- trainer, soigneur en ploegleider zien uitsluitend de voor hen noodzakelijke **uitvoeringsinformatie**, niet de onderliggende analyse;
- eigen rolcontext en een eerlijk eigen startscherm;
- **geen fallback naar de trainer- of atleetomgeving** (BB-08).

*Tot de rolwaarde technisch bestaat:* geen tijdelijke rol simuleren · geen bredere trainer- of soigneurrechten toevoegen · bestaande bevoegdheden ongewijzigd laten. MUX-75 blijft gelden: geen rolscherm vóór de rolwaarde server-side bestaat.

**BB-13 — Proactief en volledig.** *Bindend productprincipe voor alle vier de pakketten.*

**Sparki toont geen leeg formulier wanneer relevante gegevens al beschikbaar zijn.**

Bij elk nieuw object of document doet Sparki, in deze volgorde:
verzamelt bestaande gegevens · kiest relevante bronobjecten · stelt een **compleet concept** samen · markeert ontbrekende informatie · geeft aan **wie** die ontbrekende informatie kan aanvullen · stelt relevante vervolgstappen voor · toont eerdere evaluaties en lessons learned · maakt waar passend een nieuwe conceptversie · **publiceert of verstuurt nooit zonder bevoegde bevestiging**.

De gebruiker corrigeert, verrijkt en bevestigt. **Hij hoeft bekende informatie niet opnieuw over te typen.**

**Onboardinggegevens zijn bron.** Alles wat tijdens onboarding is vastgelegd, wordt vanaf dat moment gebruikt om voor te vullen en **nooit opnieuw gevraagd**: organisatienaam · team · seizoen · locaties · betrokken rollen · deelnemers · sporters · contactgegevens · voertuigen · materiaal · routes · planning · doelen · klantgegevens · bedrijfsgegevens · factuurgegevens · consentstatus · relevante veiligheidsinformatie.

**Acht regels voor veilige voorinvulling.**
**BB-13a** Geen verzonnen invulling.
**BB-13b** Geen voorbeeldpersoon als echte persoon.
**BB-13c** Ontbrekende gegevens blijven **zichtbaar ontbrekend**, niet stil leeg.
**BB-13d** De **bron van een voorinvulling is opvraagbaar**: waar komt dit vandaan, van wanneer.
**BB-13e** Gevoelige velden worden **alleen gevuld wanneer rol én toestemming dat toestaan**. Bij twijfel leeg laten, met de reden erbij.
**BB-13f** De gebruiker bevestigt belangrijke inhoud vóór publicatie.
**BB-13g** AI-tekst blijft **concept** tot menselijke bevestiging.
**BB-13h** **Bestaande feiten worden niet door AI gewijzigd.** Aanvullen mag, overschrijven niet.

*Toepassing:* elk documenttype in pakket 02, 03 en 04 voldoet aan het documenttypecontract (DTC) uit pakket 02 hoofdstuk 3b, en aan de vijftien stappen van de objectlevenscyclus daar. Een leeg formulier terwijl de gegevens er zijn, is een directe herstelgrond in alle vier de pakketten.

---

## 3. Verplicht hergebruik

**Wordt uitgebreid, nooit gedupliceerd:**

| Bestaand onderdeel | Wat ermee gebeurt |
|---|---|
| bestaande rollen- en rechtenlaag (`CLUB_RECHTEN_01`) | uitbreiden; **geen tweede rechtenlaag** |
| bestaand jeugd- en consentmodel | centraliseren in één service; geen tweede definitie |
| bestaande notificatielaag | uitbreiden; **geen tweede notificatiesysteem** |
| bestaande componentbibliotheek (`CMP-00..44`) | de drie contextcomponenten worden hierin opgenomen |
| bestaande mobiele UX-standaard (`MUX-01..100`) | bindend; geen afwijking zonder besluit van René |
| bestaande rapportgenerator | **geen tweede rapportgenerator** |
| bestaande trainings- en agendastructuur | uitbreiden met herhaling; geen parallel schema |
| bestaande documentopslag | hergebruiken voor clubdocumenten waar mogelijk |

**Nooit bouwen in dit pakket:** tweede rechtenlaag · tweede consentmodel · tweede notificatiesysteem · tweede documentarchitectuur · tweede rapportgenerator · tweede AI-memory.

---

## 3a. Centrale platformdiensten in dit pakket

**Waarom hier.** Vijf diensten worden meer dan één keer gebruikt: door Club, Team, Trainer, Ouder, Wedstrijd, Werkobjecten én Facturatie. Ze worden **één keer gebouwd, in het pakket dat als eerste draait.** Pakket 02, 03 en 04 hergebruiken ze en implementeren ze niet opnieuw.

| Dienst | Wat het voorkomt |
|---|---|
| **PD-1 Centrale agenda- en gebeurtenislaag** | een eigen agenda per module |
| **PD-2 Centrale locatielaag** | vrije-tekstlocaties per module |
| **PD-3 Centrale contacten- en relatielaag** | dezelfde persoon drie keer als los contact |
| **PD-4 Centrale bestands- en medialaag** | een eigen uploadoplossing per module |
| **PD-5 Centrale inbox en notificaties** | een eigen meldingenlijst per module |

> **Afwijking van de verdeling, bewust en met reden.** De verdeling plaatst agenda en locaties bij pakket 03 en 04. Dat kan niet: pakket 01 bouwt zelf al herhalende trainingen met herhalingsregels — dat **is** de agendakern — en pakket 04 heeft locaties nodig (test, bikefit) zonder van pakket 03 af te hangen. Zouden ze in 03 en 04 apart komen, dan ontstaan precies de twee agenda's en de twee locatielijsten die deze aanvulling wil voorkomen. Ze staan daarom hier, en 03 en 04 hergebruiken ze.

### PD-1 — Agenda en gebeurtenissen

**Harde regel:** één gebeurtenis heeft **één bronrecord** en kan meerdere rolgerichte weergaven hebben. **Geen kopieën per module.**

Dient voor: persoonlijke agenda · sporteragenda · traineragenda · clubagenda · teamagenda · wedstrijddag · trainingen · wedstrijden · taken en deadlines · intakegesprekken · testen · bikefits · facturatiemomenten · evaluaties · documenten die op een datum geldig worden · herhalende afspraken.

`event`: event_id · event_type · title · description · owner_id · organisation_id · team_id · athlete_id · work_object_id · location_id · starts_at · ends_at · timezone · recurrence_rule · recurrence_exception · status · visibility_scope · required_roles · participants · capacity · **source_module** · **source_record_id** · created_at · updated_at · cancelled_at.

Ondersteunt: herhaling · uitzonderingen · wijzig één · wijzig deze en volgende · wijzig hele reeks · annuleren · contextwissel · beschikbaarheid · conflicten · agenda-export · notificaties · **terugweg naar het bronobject** · mobiel en desktop.

**`source_module` en `source_record_id` zijn de kern.** Zonder die twee is een gebeurtenis niet terug te voeren op het object dat hem veroorzaakte, en ontstaat er alsnog een tweede waarheid.

### PD-2 — Locaties

`location`: location_id · naam · adres · coördinaten · type · contactpersoon · openingstijden · instructie · parkeerinformatie · kaartlink · route_id · organisatie/team · actief/inactief.

Typen: clubhuis · trainingslocatie · verzamelpunt · start · finish · hotel · parkeerplaats · bevoorrading · materiaalpost · ziekenhuis · noodlocatie · werkplaats · bikefitlocatie · testlocatie.

**Geen losse vrije-tekstlocatie** waar een herbruikbare locatie past.

### PD-3 — Contacten en relaties

**Harde regel:** een persoon wordt **niet opnieuw als los contact aangemaakt** wanneer dezelfde identiteit al bestaat.

Contacttypen: sporter · ouder/verzorger · trainer · hoofdtrainer · teammanager · ploegleider · mechanieker · soigneur · `nutrition_specialist` · `medical_staff` · vrijwilliger · klant · betaler · werkgever · sponsor · leverancier · wedstrijdorganisatie · noodcontact · bedrijf · locatiecontact.

Relaties: ouder van · trainer van · klant voor · betaler voor · lid van · staf van · noodcontact van · werkzaam bij · leverancier aan. Elke relatie draagt `startedAt` en `endedAt`.

**Klant en sporter blijven afzonderlijke entiteiten** — een contact kan beide rollen dragen, maar dat zijn twee relaties, geen samengevoegd record.

### PD-4 — Bestanden en media

`file`: file_id · owner_id · organisation_id · team_id · context_type · context_id · filename · **accessible_name** · mime_type · size · checksum · storage_reference · version · rights_scope · privacy_classification · scan_status · publication_status · created_at · **superseded_by** · withdrawn_at · **retention_category**.

Ondersteunt: upload · preview · download · versie · **vervangen zonder historie te wissen** · intrekken · virusscan · bestandstypecontrole · groottebeperking · rechten · retentie · duplicaatherkenning op checksum · veilige bestandsnaam · schermlezertekst · bulkdownload waar toegestaan.

Voor: bijlagen · afbeeldingen · briefpapier · PDF · rapporten · werkobjecten · instructies · bewijsfoto's · exports · contracten · facturen · clubdocumenten. **Geen losse uploadoplossing per module.**

### PD-5 — Inbox en notificaties

Eén centrale inbox voor alle rollen en contexten, met tien soorten: actie vereist · herinnering · wijziging · waarschuwing · kritiek · ter informatie · support · facturatie · consent · systeemstatus.

`notification`: notificatie_id · user_id · **active_role** · organisation_id · team_id · context_type · context_id · severity · title · **safe_preview** · requires_action · read_at · **handled_at** · expires_at · created_at.

**Harde regels:** melding opent altijd de juiste rol en context · **gelezen is niet hetzelfde als afgehandeld** · geen medische of gevoelige inhoud in de pushtekst · herhaalde meldingen worden gebundeld · geen notificatiespam · stilte-uren · een urgente veiligheidsmelding blijft bereikbaar, ook binnen stilte-uren · een ingetrokken rol maakt de melding niet meer toegankelijk · browser, PWA en mobiel gedragen zich gelijkwaardig.

### PD-6 — Hulp en uitleg (norm, geen aparte dienst)

Iedere professionele module krijgt: eerlijke lege toestand · korte uitleg · voorbeeld waar passend · foutmelding in gewone taal · vermelding wie kan helpen · supportticket **met context** · koppeling naar de relevante handleiding · uitleg opnieuw te openen. **Geen generieke foutcode als enige boodschap.** Gebruikt `MEDIA_UITLEG_01` zodra die laag beschikbaar is. **Geen tweede Academy of helpcentrum.**

---

## 4. Datamodel

**Alleen deltas.** F0 stelt vast wat er al is; wat bestaat wordt uitgebreid.

### 4.1 Leeftijd en consent
- `consent_grant`: id · subject (gebruiker) · grantor (ouder/verzorger) · type · status · gegeven op · ingetrokken op · geldig tot · grondslag · bron.
- `consent_status` als **één** enumeratie, gedeeld door frontend en backend.
- `age_class` afgeleid uit het profiel, **niet** uit chat of zelfverklaring. Bij onbekende leeftijd geldt het strengste regime.
- `reconfirmation_due_at`: herbevestiging bij de relevante leeftijdsgrens.
- `consent_audit`: append-only.

### 4.2 Informatieklassen (BB-04)
- `availability_status` — operationeel, breed leesbaar.
- `safety_note` — praktische veiligheidsinformatie, leesbaar voor wie ter plaatse verantwoordelijk is.
- `medical_reason` — afgeschermd, uitsluitend `medical_staff` binnen consent.
- `emergency_contact` — apart, met eigen inzageregels en logging.

### 4.3 Relaties
- Alle relatietabellen (trainer–sporter, teamlidmaatschap, clublidmaatschap, ouder–kind) krijgen **`startedAt`** en **`endedAt`**.
- Elke scope-query filtert op `endedAt IS NULL OR endedAt > now()`.

### 4.4 Rolcontext
- `active_context`: gebruiker · rol · organisatie · team/groep · geldig vanaf.
- Server-side gevalideerd bij elke aanvraag. Nooit uit de client overgenomen.

### 4.5 Herhalende trainingen
- `training_series`: id · organisatie · team/groep · patroon (dagelijks · wekelijks · specifieke weekdagen · interval) · begin · einde · tijdzone.
- `training_series_exception`: datum · type (overgeslagen · gewijzigd · geannuleerd).
- Elke gegenereerde training houdt `series_id` én blijft een zelfstandig object.

### 4.6 VOG
- `vog_record`: persoon · organisatie · status · afgiftedatum · vervaldatum · hercontroledatum · **bewijsreferentie** (nooit het volledige document) · beheerder · audit.

### 4.7 Bijlagen
- `attachment`: id · eigenaar · scope · bestandstype · grootte · veiligheidscontrolestatus · retentie · ingetrokken op · koppeling naar bericht of werkobject.

### 4.8 Clubdocumenten
- `org_document`: organisatie · type · titel · versie · geldig vanaf · publicatiestatus · rechten. Gebruikt dezelfde opslag-, versie- en rechtenprincipes als de rest.

---

## 5. API

- `GET /consent/{user}` — statussen, geldigheid, herbevestigingsdatum.
- `POST /consent/grant` — uitsluitend door een bevoegde grantor; **weigert een minderjarige die zichzelf toestemming geeft** (BB-03), server-side, gelogd.
- `POST /consent/revoke` — werkt onmiddellijk vooruit.
- `GET /context/active` · `POST /context/switch` — server-side gevalideerd.
- `GET /roles/available` — alleen rollen die de gebruiker werkelijk heeft.
- `GET /start/{role}` — het startpunt van die rol; **nooit een terugval op atleet**.
- `POST /training-series` · `PATCH /training-series/{id}` met bereik `single` · `this_and_future` · `all`.
- `GET/POST /vog` — bevoegd beheer, audit.
- `POST /attachments` — met typecontrole en veiligheidscontrole vóór beschikbaarstelling.
- `GET /org-documents` — rolgefilterd.

**Regel voor elk endpoint:** rechten en scope worden server-side bepaald. Een endpoint dat alles teruggeeft en de client laat filteren, wordt afgekeurd.

---

## 6. Rechten

| Onderwerp | Regel |
|---|---|
| Scope | organisatie · team · relatie, altijd met `endedAt`-filter |
| Ouder | ziet wat bij het kind hoort; **nooit** medische details, vermogenswaarden of coachnotities zonder geldige grond |
| Ploegleider | uitsluitend inzetbaarheid en noodzakelijke praktische veiligheidsinformatie |
| `nutrition_specialist` | uitsluitend wat voor voedingsbegeleiding noodzakelijk is; geen medisch dossier zonder afzonderlijke toestemming; geen diagnose |
| `medical_staff` | medische reden uitsluitend binnen consent; elke inzage gelogd |
| Beëindigde relatie | geen actuele toegang, historie blijft |
| Meerdere rollen | uitsluitend de actieve context; geen samengevoegd beeld |
| Onbevoegd | beheerfunctie **niet zichtbaar**, ook niet uitgegrijsd |

---

## 7. Mobiele UX

- Vaste vijf posities (BB-06), gelijk in aantal, volgorde en betekenis voor alle rollen.
- Actieve rol, organisatie en team/groep **permanent zichtbaar** (CMP-02).
- Rolwissel zonder nieuwe login; na wisselen blijft de gebruiker op het equivalente scherm.
- Rolintroductie bij eerste login en lege rolomgeving: rol · context · wat je kunt · wat ontbreekt · één eerste actie (CMP-14, MUX-100).
- Lege rolomgeving: eerlijke lege toestand met vier elementen (CMP-29) — **nooit terugvallen op een andere rol**.
- Eén primaire actie, maximaal vier kaarten boven de vouw, twee tot vier tabs, geen lege tabs.
- Geen aantallen uit andere contexten in de contextkiezer.

## 8. Desktop UX

- Zelfde structuur, meer ruimte: bredere lijsten, meer kolommen, meerdere panelen naast elkaar.
- Beheertaken (rollen, VOG, clubdocumenten, herhalingsreeksen instellen) zijn **desktop leidend**.
- Mobiel toont dezelfde gegevens als lijst, nooit als brede tabel.

---

## 9. Fasen en Replit-opdrachten

Elke fase: scope · niet bouwen · datamodel · API · rechten · UX · migratie · tests · rollback · bewijs · vaste SHA · Mirror-toets. Replit mag gefaseerd doorbouwen; Mirror loopt parallel mee op elke gepushte fase-SHA.

### F0 — Inventarisatie (geen code)
**Scope:** vaststellen wat er werkelijk is: consentmodel en -statussen · leeftijdsbepaling · alle relatietabellen en of ze `endedAt` hebben · alle server-side rolwaarden · huidige startschermen per rol en waar ze naar terugvallen · contextmechanisme · navigatiestructuur · trainings- en agendastructuur · bestaande VOG-registratie · communicatielaag en bijlagen · documentopslag · notificatielaag · alle plekken waar rechten client-side worden bepaald.
**Niet bouwen:** niets. Nul regels productiecode.
**Bewijs:** elke claim "aanwezig" met bestand, functie, endpoint of schema; elke claim "afwezig" met de **vindplaats van de zoekactie**.
**Oplevering:** `BUILD_01_INVENTARISATIE.md` · `BUILD_01_HERGEBRUIKMATRIX.md` · `BUILD_01_RISICOS.md`.
**Mirror:** steekproef van vijf "aanwezig" tegen code en drie "afwezig" waarbij Mirror zelf zoekt; alle server-side rolwaarden benoemd. **F1 start direct na de F0-rapportage.** Mirror toetst F0 parallel; blijkt een bevinding onjuist, dan is dat een herstelopdracht op de betrokken lijn — geen bouwstop.

### F1 — Centrale leeftijds- en toestemmingsservice
**Scope:** één service, één definitie van leeftijd en minderjarigheid, één enumeratie van consent-statussen voor frontend en backend; server-side afdwinging; herbevestiging bij leeftijdsgrens; intrekken; historie en audit.
**Niet bouwen:** een tweede consentmodel; consentlogica in de frontend.
**Datamodel:** 4.1. **API:** `/consent/*`. **Rechten:** grantor moet bevoegd zijn; minderjarige wordt geweigerd en de poging gelogd.
**UX:** consentstatus zichtbaar voor wie hem mag zien; intrekken altijd bereikbaar voor de rechthebbende.
**Migratie:** bestaande toestemmingen omzetten naar de nieuwe statussen zonder verlies; onbekende toestemmingen krijgen het **strengste** regime, niet het gunstigste.
**Tests:** jeugdaccount probeert zichzelf toestemming te geven → geweigerd · minderjarige zet oudertoezicht uit → geweigerd · meerdere ouders · meerdere kinderen · intrekken werkt onmiddellijk · herbevestiging bij grens.
**Rollback:** service uitschakelen valt terug op het oude model; migratie is omkeerbaar.
**Bewijs:** een minderjarig testaccount kan aantoonbaar geen van beide.
**Mirror:** BB-01 t/m BB-03.

### F2 — Rechtenlekken dichten
**Scope:** `endedAt` in alle scope-queries, met de trainerscope als eerste; beëindigde trainer-, team- en sporterrelaties verliezen onmiddellijk toegang; cache-invalidatie na rol- of contextwissel; deep links; browser-back; meerdere tabbladen; offline opgeslagen gegevens.
**Niet bouwen:** een tweede rechtenlaag.
**Rechten:** cross-account, cross-team en cross-club fail-closed.
**Migratie:** bestaande relaties zonder `endedAt` krijgen dat veld; lopende relaties blijven `NULL`.
**Tests:** trainer na beëindigd lidmaatschap · twee tabbladen met verschillende context · deep link naar een andere organisatie · browser-back na contextwissel · offline gegevens na intrekking.
**Bewijs:** elk van de tien scenario's aantoonbaar dicht.
**Mirror:** BB-09, BB-10. **Een gevonden lek is een directe herstelgrond.**

### F3 — Rolgestuurde startschermen
**Scope:** elke server-side rolwaarde krijgt een eigen startpunt: atleet · trainer · hoofdtrainer · ouder/verzorger · clubbeheerder · teammanager · ploegleider · mechanieker · soigneur · **`nutrition_specialist`** · `medical_staff` · assistent · vrijwilliger · alleen_lezen · plus elke andere werkelijk bestaande rolwaarde uit F0.

**Nieuwe rolwaarde `nutrition_specialist` (BB-14)** wordt in deze fase server-side aangemaakt, met eigen rolcontext en eerlijk startscherm — eerste mobiele prioriteit: **Voeding**. Zolang de rolomgeving nog dun is, geldt de eerlijke lege toestand; nooit een terugval op trainer of atleet.
**Niet bouwen:** een startpunt voor een rolwaarde die server-side niet bestaat.
**UX:** heeft een rol nog te weinig functies, dan een **eerlijke lege toestand**: wat ontbreekt · wie het oplost · één vervolgstap. **Nooit terugvallen op de atleetweergave.**
**Tests:** elke rolwaarde apart ingelogd; geen enkele terugval.
**Mirror:** BB-08 — één terugval is afkeur.

### F4 — Multi-role context en navigatie
**Scope:** vaste vijf posities met vaste betekenis (BB-06); actieve rol, organisatie en team/groep permanent zichtbaar; rolwissel zonder nieuwe login; server-side contextvalidatie; notificaties openen in de juiste context; geen informatie of aantallen uit niet-actieve contexten. De drie contextcomponenten worden **in de bestaande componentbibliotheek** opgenomen.
**Niet bouwen:** een zesde hoofditem; een eigen menu per rol.
**Tests:** meerdere rollen · contextwissel · terugknop · meerdere tabbladen · notificatiecontext · aantallen in de contextkiezer.
**Mirror:** BB-06, BB-07.

### F5 — Herhalende trainingen
**Scope:** dagelijks · wekelijks · specifieke weekdagen · interval · begin- en einddatum · uitzonderingsdatum · wijzigen van één, van deze en volgende, of van de hele reeks · annuleren · reeks beëindigen · historie behouden · tijdzone en zomertijd.
**Niet bouwen:** een parallel agendaschema. Gegenereerde trainingen blijven **zelfstandig bruikbaar**.
**Migratie:** bestaande losse trainingen blijven los. Ze worden **niet stil in reeksen veranderd**.
**Tests:** reeks over de zomertijdovergang · wijziging van één versus reeks · annulering · geen dubbele notificaties.
**Mirror:** één notificatie per gebeurtenis; geen stille migratie.

### F6 — VOG en jeugdveiligheid
**Scope:** status · datum · vervaldatum en hercontrole · bewijsreferentie · bevoegd beheer · audit; koppeling aan een jeugdgroep wordt server-side geweigerd wanneer de verplichte status ontbreekt, met een eerlijke foutmelding.
**Niet bouwen:** opslag van het volledige gevoelige document.
**Migratie:** bestaande koppelingen inventariseren; een koppeling zonder verplichte status wordt **gemarkeerd en gemeld**, niet stil verbroken — verbreken is een besluit van de organisatie.
**Tests:** VOG ontbreekt · VOG verlopen · koppelpoging · bevoegdheid van de beheerder.
**Mirror:** BB-11.

### F7 — Communicatie met bijlagen
**Scope:** bestanden · afbeeldingen · links · koppeling aan een werkobject · bestandstypecontrole · veiligheidscontrole vóór beschikbaarstelling · rechten · retentie · download · ingetrokken bestand · gelezenstatus · notificatie.
**Niet bouwen:** een tweede communicatiekanaal of een losse berichtenapp.
**UX:** **geen gevoelige inhoud in een pushmelding** (BB-12); openen brengt de gebruiker in de juiste context.
**Tests:** bijlage zonder recht · ingetrokken bestand · geweigerd bestandstype · pushmelding-inhoud.

### F8 — Clubdocumenten
**Scope:** gedragscode · huisregels · ouderafspraken · privacyinformatie · vertrouwenscontactpersoon · noodprocedures · clubinstructies. Zelfde opslag-, versie- en rechtenprincipes als de rest.
**Niet bouwen:** een levende werkobjectlaag — dat is `SPARKI_BUILD_02`. Dit zijn organisatiedocumenten met versie en publicatiestatus, meer niet.
**Tests:** publicatie · versiewissel · rolzichtbaarheid.

### F9 — UX-herindeling per rolmodule
**Scope:** eerst de **echte scherminventarisatie** per rolmodule, daarna herindelen volgens: maximaal één primaire actie · maximaal vier kaarten boven de vouw · twee tot vier echte tabs · geen lege tabs · beheer niet uitgegrijsd tonen aan onbevoegden · details naar een apart scherm · invoer in een wizard · geen zesde hoofditem · mobiel geen verkleinde desktop.
**Niet bouwen:** nieuwe functies. Verplaatsen mag; weglaten niet zonder besluit.
**Volgorde:** clubbeheer eerst — daar staan nu de meeste secties op één pagina.
**Tests:** per module de negen punten hierboven.

### F10 — Centrale contacten- en relatielaag (PD-3)
**Scope:** één contactrecord per identiteit · de negentien contacttypen · de negen relatietypen met `startedAt` en `endedAt` · duplicaatherkenning bij aanmaken.
**Niet bouwen:** een tweede personenlijst; klant en sporter als één record.
**Technische input:** de inventarisatie uit F0 van bestaande personen-, klant-, leden- en organisatiegegevens. Ontbreekt die nog, dan bouwt Replit het model alvast en vult de samenvoeging daarna aan — geen wachtmoment.
**Migratie:** bestaande gegevens worden **samengevoegd op aantoonbare identiteit**, met een lijst van twijfelgevallen ter beoordeling. Nooit automatisch samenvoegen bij twijfel.
**Tests:** dezelfde persoon als ouder én trainer · klant die ook sporter is · duplicaatpoging · beëindigde relatie.
**Mirror:** één identiteit, meerdere relaties — geen dubbel contact.

### F11 — Centrale bestands- en medialaag (PD-4)
**Scope:** het `file`-model, upload, preview, download, versie, vervangen zonder historieverlies, intrekken, virusscan, typecontrole, groottebeperking, rechten, retentiecategorie, duplicaatherkenning, veilige bestandsnaam, schermlezertekst.
**Niet bouwen:** een uploadoplossing per module. F7 (bijlagen) wordt hierop **omgezet**.
**Tests:** vervangen laat de oude versie bestaan · ingetrokken bestand · geweigerd type · duplicaat op checksum · bulkdownload zonder recht.

### F12 — Centrale inbox en notificaties (PD-5)
**Scope:** het `notification`-model, de tien soorten, de inbox per rol en context, bundeling, stilte-uren, `read_at` versus `handled_at`.
**Niet bouwen:** een meldingenlijst per module. Bestaande meldingen worden hierop omgezet.
**Tests:** melding opent juiste rol en context · gelezen ≠ afgehandeld · pushtekst zonder gevoelige inhoud · bundeling bij tien wijzigingen · stilte-uren met een urgente veiligheidsmelding · ingetrokken rol.
**Mirror:** één gevoelig gegeven in een pushtekst is directe afkeur.

### F13 — Eindbewijs
**Scope:** bewijsbundel per fase (SHA, scenario's, uitkomst, openstaande punten) en de volledige testmatrix uit hoofdstuk 11.
**Niet bouwen:** niets nieuws; alleen herstel van gevonden tekortkomingen met hertoets van de betrokken dimensie.

---

## 10. Migratieregels

**M-1** Geen migratie zonder rollback. **M-2** Geen migratie die gegevens verwijdert; markeren in plaats van wissen. **M-3** Onbekende toestemming → strengste regime, nooit het gunstigste. **M-4** Losse trainingen worden niet stil in reeksen veranderd. **M-5** VOG-koppelingen worden gemarkeerd, niet stil verbroken. **M-6** Elke migratie draait eerst op een kopie en levert een telling voor en na.

## 11. Testmatrix

jeugdaccount · ouderaccount · meerdere ouders · meerdere kinderen · trainer na beëindigd lidmaatschap · VOG ontbreekt · VOG verlopen · meerdere rollen · contextwissel · terugknop · meerdere tabbladen · deep link naar vreemde organisatie · notificatiecontext · herhalende training over zomertijd · wijziging één versus reeks · bijlage zonder recht · ingetrokken bijlage · foutstate · lege state · degraded state · trage verbinding · 360 dp en grote telefoon · desktop · 200% tekstgrootte · schermlezer.

## 12. Mirror-toets per fase

| Fase | Kern van de toets |
|---|---|
| F0 | steekproef vijf aanwezig, drie afwezig zelf gezocht |
| F1 | minderjarige kan zichzelf niets toestaan; één statusdefinitie |
| F2 | tien lekscenario's dicht; `endedAt` overal toegepast |
| F3 | geen enkele rol valt terug op atleet |
| F4 | vijf posities, vaste betekenis, server-side context |
| F5 | zomertijd; één versus reeks; geen dubbele notificatie |
| F6 | koppeling zonder VOG geweigerd |
| F7 | geen gevoelige inhoud in push; bijlage zonder recht geweigerd |
| F8 | rolzichtbaarheid en versie |
| F9 | de negen UX-punten per module |
| F10 | één identiteit, geen dubbel contact |
| F11 | vervangen zonder historieverlies; geen module-eigen upload |
| F12 | juiste context; gelezen ≠ afgehandeld; veilige pushtekst |
| F13 | volledige matrix, geen regressie |

## 13. Rollback

Elke fase afzonderlijk terug te draaien. **Uitzondering:** F1 terugdraaien betekent F2 t/m F13 terugdraaien, omdat de consentservice eronder ligt. F10, F11 en F12 zijn centrale diensten: terugdraaien raakt ook pakket 02, 03 en 04 en gebeurt nooit zonder afstemming. Half afgebouwd blijft niet staan achter een schakelaar; het gaat terug.

## 14. Directe afkeurgronden

Rechtenlek · dataverlies · onveilige migratie · tweede architectuur · niet-groene build, typecheck of tests · ontbrekende rollback · verzonnen persoonlijke informatie · minderjarige die zichzelf toestemming geeft · rol die terugvalt op atleet · medische reden zichtbaar voor een operationele rol · gevoelige inhoud in een pushmelding · zesde hoofditem · client-side rechtenbepaling · beheerfunctie uitgegrijsd getoond aan een onbevoegde · **een tweede agenda, takenlijst, notificatie-inbox, contactenlijst of bestandsopslag naast een centrale dienst** · een gebeurtenis zonder `source_module` en `source_record_id` · een vrije-tekstlocatie waar een herbruikbare locatie past · gevoelige inhoud in een pushtekst · een generieke foutcode als enige boodschap · **een leeg formulier terwijl de gegevens al beschikbaar zijn** (BB-13) · een voorinvulling waarvan de bron niet opvraagbaar is (BB-13d) · een gevoelig veld voorgevuld zonder dat rol en toestemming dat toestaan (BB-13e) · AI die een bestaand feit overschrijft (BB-13h) · **`nutrition_specialist` met toegang tot een medisch dossier zonder afzonderlijke toestemming** · een gewichts- of caloriedoel bij een minderjarige · een voedingsrol die terugvalt op de trainer- of atleetomgeving.

**Replit stopt onmiddellijk** bij elk van deze en meldt het; hij repareert niet door.

## 15. Eindbewijs

Per fase: SHA · scenario's · uitkomst · openstaande punten. Plus één integrale doorloop van de testmatrix met een minderjarig account, een ouderaccount, een trainer met beëindigd lidmaatschap en een gebruiker met drie rollen.

## 16. Productiepublicatie

**Automatische poort, geen menselijke wachtpoort.** Publiceren mag zodra: build groen · typecheck groen · verplichte tests groen · migraties succesvol gevalideerd · rollback beschikbaar · geen actieve harde stopconditie.

Een acceptatieomgeving mag worden gebruikt voor bewijs en regressietests, maar is **geen verplichte menselijke poort**. Rollback mag automatisch worden uitgevoerd wanneer een vrijgegeven versie faalt.

**Wat wél buiten dit pakket blijft:** een betaalde publieke release blijft geblokkeerd zolang de wettelijke bewaartermijnen onbepaald zijn — dat is een ontbrekende juridische productkeuze en daarmee een harde stop op die lijn, niet op de bouw.

---

*Einde `SPARKI_BUILD_01`.*
