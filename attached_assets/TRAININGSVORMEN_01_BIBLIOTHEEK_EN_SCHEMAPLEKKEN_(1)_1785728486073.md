# TRAININGSVORMEN_01 — Bibliotheek van trainingsvormen en schemaplekken

**Code:** `TRAININGSVORMEN_01`
**Regelcodes:** `TRV-01` t/m `TRV-96`
**Datum:** 03-08-2026
**Status:** goedgekeurd door René op 03-08-2026 — uitvoeringsvrijgave conform `SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01`

---

## 0. Uitvoeringsregel (bindend, staat vóór alles)

`TRV-01` Deze goedgekeurde bouwopdracht is de **volledige uitvoeringsvrijgave**. Replit mag zelfstandig inventariseren, bouwen, testen, migreren, herstellen, committen, pushen, deployen, productie bijwerken en rollbacken. Geen tweede toestemming, geen wachtpoort per fase, geen verplichte Mirror-vrijgave vooraf.

`TRV-02` Replit rapporteert per fase maar wacht niet op antwoord. Mirror toetst parallel en blokkeert niet. `MIRROR_PROVEN` → door · `HERSTEL NODIG` → Replit herstelt zelf en gaat door · `AFGEKEURD` → alleen de geraakte lijn stopt · `NIET BEWIJSBAAR` → bewijs herstellen, bouw ligt niet stil.

`TRV-03` Featureflags alleen bij technische noodzaak (rollback, compatibele migratie, A/B, providerbeperking, overgang tussen incompatibele varianten). Nooit als bouwpoort of verborgen-houden van afgeronde functionaliteit.

`TRV-04` Open punten in drie soorten: **A** uitwerkingsvraag → Replit lost zelf op · **B** technische blokkade → Replit herstelt en gaat door · **C** echt productbesluit → één korte vraag aan René (zie hoofdstuk 18, terughoudend gebruiken).

`TRV-05` Harde stops zoals vastgelegd in de uitvoeringsregel blijven gelden en stoppen alleen de geraakte lijn. Voor dit pakket zijn de meest waarschijnlijke: gevaarlijk belastingsadvies, jeugdfunctionaliteit die de jeugdgrenzen schendt, en een echte inhoudelijke tegenstrijdigheid met `KENNIS_01` of `AI_INTELLIGENCE_ENGINE_02`.

---

## 1. Productdoel

`TRV-06` Sparki krijgt één **bibliotheek van trainingsvormen** waaruit Sparki, de trainer én de sporter kunnen kiezen. Een trainingsvorm is geen artikel en geen losse workout: het is een **familie met een parameterbereik** (bijvoorbeeld "VO2max-interval, 3–6 herhalingen, 3–5 minuten, 106–120% FTP"), met uitleg, doel, effect, gebruik, bron en onderbouwingsniveau.

`TRV-07` Het schema van een sporter bevat geen vaste sessies maar **schemaplekken met een bedoeling en een bandbreedte**. De sporter sleept een vorm naar een dag en ziet direct wat het met morgen doet. Hij mag duur en intensiteit aanpassen; blijft hij binnen de bandbreedte, dan gebeurt er niets bijzonders. Gaat hij eroverheen, dan is de plek niet meer vervuld en is dat zichtbaar.

`TRV-08` **Waarom dit vóór adaptieve coaching moet.** De bibliotheek is de gesloten woordenschat van de AI. Sparki verzint geen training, Sparki kiest een vorm. Daarmee heeft elk trainingsadvies automatisch een doel, een bron en een onderbouwingsniveau, en is `B7` (herleidbaarheid) uit `AI_INTELLIGENCE_ENGINE_02` structureel gedekt in plaats van achteraf aangebouwd.

`TRV-09` **Wat dit pakket niet doet.** Het bouwt geen trainingsschema-generator, geen periodiseringsmodel en geen adaptieve planaanpassing. Het levert de vormen, de plekken, de bandbreedtes, het aanpassen en de vooruitblik. `COACH_ADAPTIEF_01` gebruikt dit later; het bouwt er niets van na.

---

## 2. Bindende besluiten (René, 03-08-2026)

| Code | Besluit |
|---|---|
| `TRV-10` | De bibliotheek omvat **weg, indoor, baan, kracht, mobiliteit, techniek en wandelen** — niet alleen fietsvormen. |
| `TRV-11` | Baanvormen met derny of motor worden een **aparte afspraak met plaats en tijd**, geen gewone sleepbare training. |
| `TRV-12` | Een **trainer mag eigen vormen toevoegen**. Per vorm kiest hij zelf of die privé blijft voor zijn eigen sporters of de marktplaats op gaat. |
| `TRV-13` | Naast de rekenbare belasting komt een **tweede as: belastingssoort**, zodat baan- en krachtvormen niet als verwaarloosbaar tonen. |
| `TRV-14` | **Drie onderbouwingslabels:** onderbouwd · beperkt onderbouwd · praktijkvorm zonder onderzoek. |
| `TRV-15` | **Geen harde wetenschapsdrempel op het aanbod.** Een vorm met magere onderbouwing (sweet spot) staat gewoon in de bibliotheek en mag gewoon gebruikt worden; er wordt enkel bij benoemd dat de onderbouwing mager is. |
| `TRV-16` | De drempel uit het besluit van 02-08 geldt voor het **toepassen van een model of regel** met te weinig bronnen, niet voor wat er in de bibliotheek staat. Besluit 02-08 wordt niet herschreven, alleen in reikwijdte begrensd. |
| `TRV-17` | De sporter mag **duur én intensiteit** van een training zelf aanpassen. |
| `TRV-18` | Een afwijking van het schema **blijft zichtbaar**, maar het aanspreken daarop is de taak van de **trainer**, niet van Sparki. |
| `TRV-19` | Heeft de sporter **geen trainer**, dan neemt Sparki die rol over — maar meldt **pas wanneer de afwijking gevolgen heeft voor het doel**. Niet per afwijking, niet als weekoverzicht. |
| `TRV-20` | De **bandbreedte** van een schemaplek wordt bepaald door de **trainer**, en bij afwezigheid daarvan door de **AI**. Niet vast in de bibliotheekvorm zelf. |

---

## 3. Verplicht hergebruik — geen tweede architectuur

`TRV-21` Dit pakket bouwt **niets** van het volgende na. Bestaat het niet, dan is dat een bevinding in F0, geen aanleiding om een eigen variant te bouwen.

| Bestaand onderdeel | Wat dit pakket ervan gebruikt |
|---|---|
| Belastingsmodel (TSS/CTL/ATL/TSB, eFTP) | de rekenbare as van de vooruitblik |
| `KENNIS_01` | inhoud, bronvermelding, maker, licentie, leeftijdsgeschiktheid, versies, publicatiestatus van elke vorm |
| `MEDIA_UITLEG_01` | weergavelaag: mediaspeler, oefenkaart `CMP-43`, uitlegflow `CMP-42` |
| `AI_INTELLIGENCE_ENGINE_02` | gateway `aiMessage(...)`, adviesdossier, confidence, wetenschapscontrole, bronhiërarchie |
| `DOELEN_01` | doelbewaking — de bron waaruit `TRV-19` bepaalt of een afwijking gevolgen heeft |
| Werkobjectlaag (pakket 02) | levenscyclus en versies van een trainersvorm |
| `PD-1` agenda · `PD-2` locaties · `PD-3` contacten | afspraakvormen (`TRV-11`): baan, derny, motorrijder |
| `MOBILE_UX_STANDARD_01 v1.4` + componentbibliotheek | alle schermen; nieuw component alleen via de componentbibliotheek, niet ad hoc hier |
| Marktplaats (`19_PLAN_MARKTPLAATS_01`) | publicatiekanaal voor trainersvormen |

`TRV-22` **Eén trainingsobject.** Bestaat er al een gestructureerd trainingsobject in de code, dan wordt dát uitgebreid. Er komt geen tweede workout-datamodel naast het bestaande. Dit is een directe afkeurgrond (hoofdstuk 17).

---

## 4. Fasering

### F0 — Inventarisatie en meting (geen code)

`TRV-23` Replit meet en rapporteert, met bestandspad en regelnummer:

1. Bestaat er een **gestructureerd trainingsobject** (blokken, herhalingen, doelzones, pauzes) of alleen duur + TSS + omschrijving?
2. Krijgt een **geplande** training vooraf al een belastingsschatting? Zonder dit kan de sleepvooruitblik niets tonen.
3. Bestaat er al enige vorm van workout-bibliotheek, oefeningenlijst of trainingssjabloon (ook in `KENNIS_01`-aanzetten of in de mediapilot van zes oefeningen)?
4. Bestaat er export naar Garmin/Zwift of een structured-workout-formaat?
5. Welke velden draagt een kracht-, wandel- of niet-fietsactiviteit nu, en krijgt die enige belastingswaarde?
6. Wat is de feitelijke status van `DOELEN_01` in de wachtrij — gebouwd, gepland, of nog niet begonnen?
7. Hoe is de trainer-sporterrelatie server-side vastgelegd, en bestaat er een "sporter zonder trainer"-toestand die betrouwbaar te bepalen is?

`TRV-24` Punt 1 en 2 zijn categorie **A of B**, geen wachtpoort. Ontbreekt het gestructureerde object, dan bouwt F1 het als uitbreiding van het bestaande trainingsobject. Ontbreekt de vooraf berekende belasting, dan bouwt F2 die; de sleepvooruitblik hangt daaraan en schuift mee naar F4.

`TRV-25` F0 levert een **hergebruikmatrix**: per regel uit hoofdstuk 3 de vindplaats in de code of de vaststelling "bestaat niet". Onbekend wordt als onbekend gerapporteerd, nooit als aanname.

### F1 — Datamodel en bibliotheek

`TRV-26` Tabellen uit hoofdstuk 5 aanmaken, inclusief onderbouwingslabel en bronnen.
`TRV-27` Startvulling met de vormen uit bijlage A, met parameterbereiken en categorie. Uitlegteksten en bronnen worden **niet verzonnen**: een vorm zonder geschreven uitleg krijgt status `concept` en is niet zichtbaar voor sporters.
`TRV-28` Zoeken en filteren over: discipline, categorie, belastingssoort, duur, onderbouwingsniveau, leeftijdsgeschiktheid, eigenaar.

### F2 — Tweede as: belastingssoort en frisheidskost

`TRV-29` Elke vorm krijgt één **belastingssoort**: `aeroob_duur` · `aeroob_hoog` · `anaeroob` · `neuromusculair` · `kracht` · `techniek_licht` · `herstel`.
`TRV-30` Per uitgevoerde of geplande sessie wordt naast de rekenbare belasting een **frisheidskost per soort** bijgehouden (schaal 0–3, aflopend over dagen). Dit is een **coachregel, geen gevalideerd model**, en wordt overal als zodanig gemarkeerd — in de UI, in het adviesdossier en in de rapportage.
`TRV-31` Waar de rekenbare belasting ontbreekt of onbetrouwbaar laag is (baan, sprint, kracht, mobiliteit, wandelen), toont Sparki de belastingssoort **in plaats van** een misleidend laag getal, nooit "verwaarloosbaar".

### F3 — Schemaplekken en bandbreedte

`TRV-32` `plan_slots` met bedoeling, belastingssoort, bandbreedte (duur min/max, intensiteit min/max), vervangcategorie, herkomst en status (`leeg` · `vervuld` · `afgeweken`).
`TRV-33` De trainer stelt **per sporter één keer** de ruimte in (strak · normaal · vrij) als standaard. De AI vult binnen die ruimte het concrete bereik per plek in. De trainer kan één specifieke plek per keer overschrijven.
`TRV-34` Heeft de sporter geen trainer, dan bepaalt de AI de ruimte volledig.
`TRV-35` De bandbreedte van de trainer wint van de AI over **wát** er getraind wordt. Over gezondheid en herstel blijft Sparki waarschuwen, conform het bestaande besluit "waarschuwen, geen blokkade".

### F4 — Slepen en vooruitblik

`TRV-36` Een vorm is sleepbaar naar een dag. Bij het slepen toont Sparki, vóór loslaten:
- effect op de conditieopbouw en op de balans van morgen (rekenbaar, uit het belastingsmodel);
- effect op de frisheid per belastingssoort (coachregel, gemarkeerd);
- of de plek daarmee vervuld blijft;
- wat gisteren was, als dat het beeld verandert.
`TRV-37` Ontbreekt een van die gegevens, dan toont Sparki **onbekend** met de reden. Geen schatting, geen benadering, geen voorlopig getal.
`TRV-38` Op de telefoon geldt `MUX-98`: de kaart en het bereik van de dag laden eerst, de vooruitblik mag na de selectie komen. Slepen moet met één duim werkbaar zijn; is dat niet haalbaar op een klein scherm, dan is er een gelijkwaardige "plaats op dag"-actie — geen doodlopende interactie (`MUX-88`).

### F5 — Aanpassen en afwijking

`TRV-39` Duur en intensiteit zijn per sessie aanpasbaar binnen de parameterbereiken van de vorm.
`TRV-40` Blijft de aanpassing binnen de bandbreedte van de plek → status `vervuld`, geen melding.
`TRV-41` Gaat de aanpassing eroverheen, of wordt een vorm uit een andere vervangcategorie geplaatst → status `afgeweken`, met vastlegging van wat er is losgelaten. Uitvoering wordt **niet geblokkeerd**.
`TRV-42` Heeft de sporter een trainer: de afwijking is zichtbaar voor die trainer, Sparki zegt er zelf niets over.
`TRV-43` Heeft de sporter geen trainer: Sparki zwijgt tot de doelbewaking van `DOELEN_01` vaststelt dat het doel geraakt wordt. Dan één melding, met wat er is afgeweken en wat het gevolg is. Bestaat `DOELEN_01` nog niet, dan wordt de afwijking wel vastgelegd en verschijnt de melding zodra de doelbewaking bestaat — er komt geen tijdelijke eigen doelbenadering in dit pakket.

### F6 — Trainersvormen en marktplaats

`TRV-44` Een trainer maakt een eigen vorm op de werkobjectlaag (concept → gepubliceerd → ingetrokken → nieuwe versie).
`TRV-45` Zichtbaarheid **per vorm**: `privé` (alleen zijn eigen sporters) of `marktplaats`. Standaard bij aanmaken is `privé`; de keuze is een bewuste handeling.
`TRV-46` Een trainersvorm draagt altijd het label **praktijkvorm zonder onderzoek** en kan nooit hoger worden ingeschaald — niemand toetst hem.
`TRV-47` De AI kiest **nooit zelfstandig** een trainersvorm. Plaatsen mag alleen door de trainer zelf of door de sporter. Een AI-advies dat naar een trainersvorm verwijst is een afkeurgrond.
`TRV-48` Een trainersvorm is herkenbaar aan de maker, ook op de marktplaats.
`TRV-49` De jeugdgrenzen gelden onverkort voor trainersvormen: geen gewichtsdoel, geen 1RM-doel, geen zware belastingsvoorschriften bij minderjarigen. Publicatie die dat bevat wordt geweigerd bij het opslaan, niet achteraf.

### F7 — Afspraakvormen (baan, derny, motor)

`TRV-50` Vormen met `vereist_afspraak = true` zijn niet sleepbaar als gewone training. Ze maken een agenda-item via `PD-1` met plaats (`PD-2`) en, waar van toepassing, een derde persoon (`PD-3`).
`TRV-51` De vooruitblik werkt er wel op: zodra de afspraak staat, telt de vorm mee in de frisheidskost van de dagen erna.
`TRV-52` Vervalt de afspraak, dan vervalt de belasting mee en wordt de plek weer `leeg`.

### F8 — AI-koppeling

`TRV-53` De AI kiest uitsluitend uit de toegestane verzameling: Sparki-vormen, passend bij discipline, leeftijdsgeschiktheid, plek en bandbreedte.
`TRV-54` Elk AI-voorstel schrijft in het adviesdossier: gekozen vorm · gekozen parameters · waarom deze plek · welke alternatieven zijn afgevallen en waarom · onderbouwingsniveau van de vorm.
`TRV-55` **De vorm mag, de effectbelofte niet.** Bij een vorm met label `beperkt onderbouwd` of `praktijkvorm` is de reden in het advies "gebruikelijk in de praktijk" — nooit een verzonnen prestatiebelofte. Een uitspraak over verwacht effect ten opzichte van een andere vorm is een modeluitspraak en valt onder de drempel van 02-08.
`TRV-56` Bij minderjarigen blijft gelden: geen gewichts-, calorie- of 1RM-doelen, en zwijgen bij te weinig gegevens voor een gezondheids- of hersteladvies.

### F9 — Niet-fietsvormen

`TRV-57` Kracht, mobiliteit, techniek en wandelen krijgen dezelfde kaartopbouw en dezelfde labels, met `MEDIA_UITLEG_01` voor het bewegende beeld en de zes pilotoefeningen als startpunt.
`TRV-58` Deze vormen dragen belastingssoort en frisheidskost, ook zonder rekenbare belasting.
`TRV-59` Wandelen blijft binnen de bestaande wandelafbakening; dit pakket verandert die niet.

### F10 — Eindbewijs

`TRV-60` Zie hoofdstuk 15.

---

## 5. Datamodel

`TRV-61` Uitbreiding van het bestaande trainingsobject, geen tweede model.

**`training_forms`** — id · slug · naam · discipline (`weg` `indoor` `baan` `kracht` `mobiliteit` `techniek` `wandelen`) · categorie · belastingssoort · doel · effect · uitleg · gebruik (hoe uit te voeren) · veelgemaakte fouten · onderbouwingsniveau (`onderbouwd` `beperkt` `praktijkvorm`) · onderbouwingstoelichting · leeftijdsgeschiktheid · eigenaar_type (`sparki` `trainer`) · eigenaar_id · zichtbaarheid (`sparki` `prive` `marktplaats`) · vereist_afspraak · versie · status · laatste_controle · media_ref

**`training_form_parameters`** — form_id · duur_min/max/standaard · intensiteitsmaat (`pct_ftp` `zone` `rpe` `kg` `herhalingen`) · intensiteit_min/max/standaard · herhalingen_min/max · pauze_min/max · blokken

**`training_form_sources`** — form_id · brontype · titel · uitgever · jaar · url · laag (`vindlaag` `bewijslaag`) · toelichting

**`plan_slots`** — id · sporter_id · datum · bedoeling · belastingssoort · duur_min/max · intensiteit_min/max · vervangcategorie · herkomst (`trainer` `ai` `sporter`) · status (`leeg` `vervuld` `afgeweken`) · afwijkingstoelichting

**`planned_sessions`** — slot_id · form_id · gekozen parameters · geschatte_belasting · belasting_bekend (bool) · frisheidskost_per_soort · keuzebron (`sporter` `trainer` `ai`) · advies_dossier_id

**`trainer_slot_defaults`** — trainer_id · sporter_id · ruimte (`strak` `normaal` `vrij`) · geldig_vanaf

**`freshness_costs`** — sporter_id · datum · soort · waarde · afkomstig_van (sessie_id) · methode (`coachregel_v1`)

`TRV-62` `belasting_bekend = false` is een geldige toestand en wordt in de UI als **onbekend** getoond. Nooit vervangen door 0 of door een schatting.

---

## 6. API

`TRV-63` `GET /training-forms` (filters: discipline, categorie, belastingssoort, duur, niveau, leeftijd, eigenaar) · `GET /training-forms/:id` · `POST /training-forms` (alleen trainer, alleen eigen) · `PATCH /training-forms/:id` (versie) · `POST /training-forms/:id/publiceren` (zichtbaarheidskeuze)
`TRV-64` `GET /plan/:sporterId/slots` · `PATCH /plan/slots/:id` (bandbreedte, alleen trainer of AI) · `POST /plan/slots/:id/sessie` (vorm plaatsen, met parameters) · `DELETE /plan/slots/:id/sessie`
`TRV-65` `POST /plan/voorschouw` — invoer: sporter, datum, form_id, parameters. Uitvoer: effect op balans van morgen · frisheidskost per soort · plekstatus · per veld of het bekend is. **Geen enkele waarde wordt geraden.**
`TRV-66` Alle endpoints respecteren de bestaande rechten- en scopelaag uit `CLUB_RECHTEN_01`. Dit pakket bouwt geen eigen autorisatie.

---

## 7. Rechten

`TRV-67` **Sporter:** ziet Sparki-vormen, de vormen van zijn eigen trainer(s) en gekochte marktplaatsvormen. Mag plaatsen, aanpassen binnen de parameterbereiken, en afwijken.
`TRV-68` **Trainer:** alles van de sporter, plus bandbreedte instellen, eigen vormen maken en publiceren, en de afwijkingen van zijn sporters zien.
`TRV-69` **Minderjarige:** de jeugdgrenzen gelden op vormniveau (leeftijdsgeschiktheid) én op parameterniveau (geen zware belasting, geen 1RM). De ouder ziet wat er in het schema staat conform de bestaande ouderregels.
`TRV-70` **Marktplaats:** een gepubliceerde vorm is leesbaar voor wie hem heeft; de maker blijft eigenaar van de versies.

---

## 8. Mobiele UX

`TRV-71` Conform `MOBILE_UX_STANDARD_01 v1.4`. Nieuwe componenten worden eerst in de componentbibliotheek toegevoegd, niet hier bedacht.
`TRV-72` Bibliotheekkaart toont in deze volgorde: naam · waarvoor · duur en intensiteit · belastingssoort · onderbouwingslabel · maker (bij trainersvorm). Uitleg, bronnen en fouten komen achter een doorklik.
`TRV-73` Het onderbouwingslabel is één woord met een doorklik naar de toelichting. Bij `praktijkvorm` staat er letterlijk dat er geen onderzoek onder ligt en dat het gebruikelijk is in de praktijk.
`TRV-74` De vooruitblik bij slepen is één beeld, maximaal twee regels tekst plus twee waarden. Niet vier grafieken.
`TRV-75` De AI onderbreekt nooit tijdens het slepen (`MUX-90`).

## 9. Desktop UX

`TRV-76` Desktop mag informatiever: volledige uitlegtekst, bronnenlijst, parameterbereik en een weekbeeld met plekstatussen naast elkaar. De trainer stelt de ruimte per sporter hier in.

---

## 10. Migratie

`TRV-77` Bestaande geplande trainingen worden **niet** met terugwerkende kracht in plekken geduwd. Ze krijgen status `legacy_zonder_plek` en blijven gewoon zichtbaar en uitvoerbaar.
`TRV-78` Bestaande trainingen krijgen geen verzonnen belastingssoort. Ontbreekt die, dan is de waarde leeg en toont de UI onbekend.
`TRV-79` Elke migratie is omkeerbaar en gaat mee in de dagelijkse publicatie zonder overleg vooraf.

---

## 11. Tests

`TRV-80` Een vorm zonder onderbouwingslabel kan niet gepubliceerd worden.
`TRV-81` Een sprint- of krachtvorm toont in de vooruitblik nooit "verwaarloosbaar".
`TRV-82` Een aanpassing binnen de bandbreedte geeft géén afwijkingsstatus; eroverheen wél.
`TRV-83` De AI kan in geen enkel scenario een trainersvorm kiezen.
`TRV-84` Een sporter zonder trainer krijgt géén melding bij een afwijking zonder doelgevolg, en wél één zodra de doelbewaking gevolgen vaststelt.
`TRV-85` Een minderjarige krijgt geen enkele vorm of parameter te zien die een gewichts-, calorie- of 1RM-doel bevat.
`TRV-86` Ontbrekende belastingsschatting leidt tot "onbekend" in de UI, nooit tot 0.
`TRV-87` Een afspraakvorm is niet sleepbaar en maakt altijd een agenda-item met plaats.

---

## 12. Mirror per fase

`TRV-88` Mirror toetst per fase op een vaste SHA en rapporteert aan Replit, niet aan René. René krijgt per fase één regel in gewone taal: werkt · werkt niet · niet te bewijzen. Mirror krijgt standaard het besluitenoverzicht en de bouwstraat als context mee, en neemt niets als bewezen aan omdat het in een document staat.

---

## 13. Rollback

`TRV-89` Elke fase is afzonderlijk terug te draaien. De bibliotheek is additief: terugdraaien van F3 t/m F5 laat de vormen staan en zet het schema terug op vaste sessies.

---

## 14. Directe afkeurgronden

`TRV-90`
1. Een tweede workout-datamodel naast het bestaande trainingsobject.
2. Een vooruitblik die "verwaarloosbaar" of 0 toont bij een neuromusculaire, kracht-, baan- of wandelvorm.
3. Een geschatte of benaderde waarde waar het gegeven onbekend is.
4. Een AI-advies dat een trainersvorm kiest.
5. Een effectbelofte op een vorm met label `beperkt onderbouwd` of `praktijkvorm`.
6. Een vorm zonder onderbouwingslabel of zonder bronveld.
7. Een gewichts-, calorie- of 1RM-doel bij een minderjarige.
8. Een schema dat stil wordt aangepast zonder afwijkingsstatus.
9. Een tweede bibliotheek per module in plaats van één centrale.
10. Een frisheidskost die als gevalideerd model wordt gepresenteerd in plaats van als coachregel.
11. Een afspraakvorm die als gewone sleepbare training is gebouwd.
12. Een sporter zonder trainer die bij elke afwijking een melding krijgt.

---

## 15. Eindbewijs

`TRV-91` De bouw is af wanneer, aantoonbaar op een vaste SHA:
- de bibliotheek gevuld is met de vormen uit bijlage A, elk met label en bron of met status `concept`;
- een sporter een vorm naar een dag sleept en vóór loslaten de twee assen ziet, met onbekend waar het onbekend is;
- duur en intensiteit aanpasbaar zijn en de plekstatus correct meebeweegt;
- een trainer bandbreedte per sporter instelt en de afwijkingen van zijn sporters ziet;
- een trainer een eigen vorm maakt, hem privé houdt, en hem daarna op de marktplaats publiceert;
- een derny-afspraak in de agenda staat met plaats en meetelt in de frisheid;
- de AI aantoonbaar alleen uit de toegestane verzameling kiest en dat in het adviesdossier vastlegt.

---

## 16. Productiepublicatie

`TRV-92` Automatische poort: build groen · typecheck groen · verplichte tests groen · migraties gevalideerd · rollback beschikbaar · geen actieve harde stop. Geen menselijke wachtpoort.

---

## 17. Rapportagevorm

`TRV-93` Per fase: wat is gebouwd · wat is gemeten (pad en regelnummer) · wat is onbekend gebleven en welke meting dat zou sluiten · welke open punten van soort A, B of C zijn ontstaan. Geen samenvattingen die meer beweren dan gemeten is.

---

## 18. Openstaande productbesluiten (categorie C)

`TRV-94` **Inschaling van de vormen.** Het toekennen van `onderbouwd` / `beperkt` / `praktijkvorm` aan veertig à zestig vormen is handwerk: per vorm zoeken wat er ligt en dat vastleggen. Dat is een **aparte opdracht met echte doorlooptijd**, geen bijproduct van deze bouw. Tot die opdracht is uitgevoerd staat elke Sparki-vorm op `praktijkvorm` met de toelichting "nog niet ingeschaald" — de veiligste stand, want hij belooft niets.

`TRV-95` **Marktplaatsvoorwaarden.** Of een trainersvorm gratis, betaald of alleen ruilbaar is, en wie een geschil beslecht, is niet in dit pakket besloten. Tot dat besluit is publiceren wel mogelijk maar zonder prijs.

`TRV-96` **Reikwijdte van de frisheidskost.** De coachregel is nu een eigen aanname en heeft geen bron. Dat is toegestaan zolang hij als coachregel gemarkeerd staat en geen modeluitspraak doet. Wordt hij ooit sturend voor adviezen, dan valt hij alsnog onder de drempel van 02-08 en moet hij ingeschaald worden.

---

## Bijlage A — Startvulling bibliotheek

Parameterbereiken zijn startwaarden; ze worden per vorm bij het inschalen (`TRV-94`) definitief.

**Duur en herstel** — herstelrit · duurrit laag tempo · lange duurrit · gefractioneerde duurrit
**Tempo en drempel** — tempoblok · sweet spot-blok · drempelinterval · gebroken drempel (over-under) · subthreshold serie
**Hoge intensiteit** — VO2max-interval klassiek · korte intervallen 30/15 · 40/20 · piramide-interval · maximale aerobe test
**Anaeroob en sprint** — anaerobe capaciteitsserie · sprintserie vanuit lage snelheid · sprintserie vanuit tempo · heuvelsprints · lange sprint
**Klimmen** — klimblok tempo · klimblok drempel · klimherhalingen · laag toerental klimmen (torque)
**Baan** — staande start · vliegende 200 · achtervolgingsinspanning · derny (afspraakvorm) · motortraining (afspraakvorm) · ploegkoers-simulatie · standing lap
**Techniek** — bochtentechniek · daaltechniek · groepsrijden en wielrennen · bidon- en voedingshandelingen · cadansdrills · eenbenige drills
**Kracht** — squat · deadlift · lunge · glute bridge · core plank · dead bug · eenbenige stabiliteit · rompkracht circuit
**Mobiliteit** — heupmobiliteit · thoracale mobiliteit · enkelmobiliteit · hamstringroutine
**Wandelen** — herstelwandeling · lange wandeling · heuvelwandeling

Afspraakvormen (`vereist_afspraak = true`): derny, motortraining, en alle baanvormen die een velodroom vereisen.

---

## Bijlage B — Wat dit pakket bewust niet oplost

- Periodisering en het opbouwen van een heel schema (`COACH_ADAPTIEF_01`).
- De inhoudelijke inschaling van de vormen (`TRV-94`).
- Prijsstelling op de marktplaats (`TRV-95`).
- De doelbewaking zelf (`DOELEN_01`); dit pakket gebruikt hem alleen.
