# SPARKI BUILD 02 — WERKOBJECTEN EN ORGANISATIEGEHEUGEN

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Technische code:** `SPARKI_BUILD_02`
**Uitvoerder:** Replit · **Toetser:** Mirror · **Eindvrijgever:** René
**Datum:** 1 augustus 2026 · **Status:** klaar voor vrijgave, nog niet gestart.
**Volgorde:** start na `SPARKI_BUILD_01`. `SPARKI_BUILD_03` en `04` bouwen hierop voort.

---

## 1. Productdoel

Eén gedeelde platformlaag voor **levende werkobjecten**: plannen en schema's die door meerdere rollen samen worden gemaakt, gewijzigd, gepubliceerd, uitgevoerd, geëvalueerd en hergebruikt.

**Geen 24 losse documentmodules.** Eén laag, veel typen.

**De aanleiding:** de rapportlaag is vastgelegd — een PDF is een onveranderlijke momentopname. De andere helft, *het digitale object blijft actueel*, had tot nu toe geen eigenaar. Zeventien van de eenentwintig onderzochte objecttypen zijn naar hun aard een levend werkobject. Dit pakket geeft die laag een eigenaar.

---

## 2. Bindende besluiten

**BB-20** Eén gedeeld werkobjectmodel voor alle typen. Type-specifieke velden horen in het type, de kern blijft klein.
**BB-21** **Een PDF is nooit het primaire werkobject.** De PDF is uitvoer van één specifieke objectversie.
**BB-22** Een gepubliceerd object wordt **nooit stil overschreven**. Wijzigen maakt een nieuwe versie; de oude blijft bestaan.
**BB-23** Terugzetten maakt een **nieuwe** versie. Geschiedenis wordt nooit herschreven.
**BB-24** Een ingetrokken versie wordt nooit als geldig getoond — niet in de app, niet via een link, niet via een QR-code.
**BB-25** Elke nieuwe gepubliceerde versie draagt een **wijzigingssamenvatting**. Zonder die samenvatting leest niemand de nieuwe versie.
**BB-26** AI maakt een **concept**, nooit de definitieve waarheid. Een mens bevestigt of wijzigt.
**BB-27** Geen automatische sancties of selectie op basis van een AI-score.
**BB-28** Medische informatie komt niet in een algemene evaluatie.
**BB-29** Bij dupliceren worden gevoelige persoonsgegevens **niet blind gekopieerd**.
**BB-30** Geen geheime personeelsbeoordeling. Wie beoordeeld wordt, kan dat weten; inzage en rechten liggen vast.

---

## 3. Verplicht hergebruik

| Bestaand onderdeel | Wat ermee gebeurt |
|---|---|
| rechten- en consentlaag uit `SPARKI_BUILD_01` | toegepast; **geen tweede rechtenlaag** |
| bestaande rapportgenerator en templatebibliotheek | PDF loopt hierlangs; **geen tweede rapportgenerator** |
| bestaande notificatielaag | uitgebreid met objectgebeurtenissen; geen tweede systeem |
| bestaande documentopslag en bijlagenlaag (F7 uit pakket 1) | hergebruikt voor objectbijlagen |
| `KENNIS_01` | blijft eigenaar van inhoudelijke kennis; werkobjecten verwijzen ernaar |
| bestaande AI-gateway en adviesherleidbaarheid | AI-concepten lopen hierlangs; **geen tweede AI-memory** |
| componentbibliotheek `CMP-00..44` | objectweergaven gebruiken bestaande componenten |

---

## 3a. Centrale platformdiensten in dit pakket

Zeven diensten worden hier **één keer** gebouwd en door Club, Team, Trainer, Ouder, Wedstrijd en Facturatie hergebruikt. Pakket 03 en 04 implementeren ze niet opnieuw.

| Dienst | Wat het voorkomt |
|---|---|
| **PD-7 Centrale takenlaag** | een eigen taakmodel per module |
| **PD-8 Sjabloonbibliotheek** | een eigen templatesysteem per documenttype |
| **PD-9 Platformbreed zoeken** | een eigen zoekfunctie per module |
| **PD-10 Goedkeuring en bevestiging** | een eigen akkoordflow per document |
| **PD-11 Archief en bewaarmatrix** | verspreid gehardcodeerde bewaartermijnen |
| **PD-12 Gebruikersaudit en activiteitenhistorie** | technische logs die niemand kan lezen |
| **PD-13 Import- en exportprincipes** | een eigen import per domein |

Uit pakket 01 worden hergebruikt en **niet nagebouwd**: agenda en gebeurtenissen (PD-1) · locaties (PD-2) · contacten en relaties (PD-3) · bestanden en media (PD-4) · inbox en notificaties (PD-5).

### PD-7 — Taken

Een taak kan hangen aan: werkobject · wedstrijd · training · team · club · sporter · klant · factuur · incident · document · evaluatie.

`task`: task_id · title · description · owner_id · assigned_to · co_assignees · organisation_id · team_id · **context_type** · **context_id** · priority · status · due_at · completed_at · recurrence · **dependency_task_ids** · **evidence_attachment_ids** · created_by · created_at · updated_at.

Statussen: open · bezig · geblokkeerd · afgerond · vervallen · geannuleerd.
Ondersteunt: herhaling · afhankelijkheid · escalatie · bewijs of foto · opmerking · notificatie · audit · **taak overdragen** · taak per rol tonen · **taak bij ingetrokken rol opnieuw toewijzen**.

**Elke relevante rol krijgt "Mijn taken"** met vijf groepen: vandaag · te laat · binnenkort · geblokkeerd · afgerond.

**Harde regel:** taken mogen **niet alleen verstopt zitten** binnen documenten of wedstrijdplannen. Een taak in een dagschema staat óók in Mijn taken van de verantwoordelijke.

### PD-8 — Sjablonen

Vijf niveaus: platformtemplate · organisatietemplate · teamtemplate · trainertemplate · persoonlijk template.

Ondersteunt: aanmaken · dupliceren · bewerken · verplichte secties · optionele secties · rolrechten · versie · publiceren · intrekken · preview · gebruiken als basis.

**Harde regel:** een update van een template **verandert bestaande objecten niet**. Bestaande objecten kunnen wél **bewust** naar een nieuwe templateversie worden gemigreerd, per object, met bevestiging.

Voor: wedstrijdplan · dagschema · briefing · intake · weekplan · evaluatie · incident · begeleidingsvoorstel · overeenkomst · factuur · clubdocument.

### PD-9 — Zoeken

Zoekbaar binnen rechten: personen · klanten · sporters · teams · clubs · wedstrijden · trainingen · werkobjecten · documenten · taken · locaties · facturen · evaluaties · incidenten · berichten.

Filters: type · naam · datum · seizoen · organisatie · team · sporter · klant · status · rol · tag · factuurnummer · objecttype.

**Harde regels:** **rechtenfilter vóór resultaatweergave** · geen titel of snippet van een verboden object tonen · geen resultaten uit een oude context na een rolwissel · mobiel zoekt eerst binnen de relevante context · desktop ondersteunt uitgebreid filteren.

**Een snippet is ook een lek.** Dat een gebruiker het object niet kan openen, is niet genoeg als de titel al verraadt wat er speelt.

### PD-10 — Goedkeuring en bevestiging

Toepasbaar op: consent · wedstrijdplan · dagschema · briefing · overeenkomst · begeleidingsvoorstel · rapport · intake · factuurconcept waar interne controle nodig is · selectie · planwijziging.

Statussen: akkoord gevraagd · bekeken · akkoord · afgewezen · wijziging gevraagd · vervallen · ingetrokken.
Opgeslagen: object · **versie** · persoon · rol · status · datum · reden of opmerking · geldigheidsduur · opnieuw akkoord nodig.

**Harde regels:** **akkoord geldt voor één specifieke versie** · een relevante wijziging maakt een nieuw akkoord nodig · **geen stilzwijgende goedkeuring** · auditbaar · eenvoudige bevestiging, **geen zwaar digitaal ondertekenplatform** tenzij wettelijk noodzakelijk.

### PD-11 — Archief en bewaarmatrix

Per objecttype: actieve periode · archiefstatus · bewaartermijn · wettelijke grond · eigenaar · wie mag verwijderen · wie mag exporteren · anonimisering · legal hold · beëindiging account · beëindiging organisatie · overdracht · herstel.

**Harde regels:** termijnen **centraal configureren**, nooit verspreid hardcoden · factuur, consent, medisch gegeven, taak en algemeen document krijgen **niet automatisch dezelfde termijn** · opzegging verwijdert wettelijk te bewaren gegevens niet · de gebruiker krijgt export vóór verwijdering waar passend · audit blijft herleidbaar **zonder onnodige persoonlijke inhoud**.

### PD-12 — Gebruikersaudit en activiteitenhistorie

Naast het technische auditlog een **begrijpelijke** historie voor bevoegde gebruikers: wie wijzigde de selectie · wie publiceerde het dagschema · wie wees een taak toe · wie markeerde een factuur betaald · wie trok toestemming in · **wie opende noodinformatie** · wie wijzigde een trainingsreeks · wie veranderde een documenttemplate.

**Toon alleen wat de gebruiker mag weten.** Geen technische systeemdetails waar die niet nodig zijn.

### PD-13 — Import en export

**Import:** dry-run · validatie · foutregels · bevestigen · annuleren · idempotentie · duplicaatdetectie · rollback · audit.
**Export:** Excel · CSV · PDF · ZIP · agendaformaat · rechten · privacyclassificatie · datum en versie · **exportlog**.
**Domeinen:** leden · klanten · contacten · facturen · agenda · taken · werkobjecten · documenten · audits · organisatie-overdracht.

---

## 3a2. Centrale documentenbibliotheek

**Eén plek voor alle documenten en werkobjecten. Geen documentenbibliotheek per module.**

**Vindplaats:** `Meer → Documenten`. Dat is de enige centrale ingang; de hoofdnavigatie houdt vijf items (MUX-14).

**Contextuele ingangen blijven bestaan** — ze openen dezelfde bibliotheek, voorgefilterd: Club · Team · Wedstrijd · Trainer · Sporter · Ouder · Mechanieker · Soigneur en verzorger · Voedingsdeskundige (`nutrition_specialist`) · `medical_staff` · Facturatie · Incidenten · Evaluaties.

**Ondersteunt minimaal:** zoeken · filteren op rol, organisatie, team, sporter, seizoen, evenement, documenttype, status, eigenaar, datum en versie · de statussen concept, gepubliceerd, uitgevoerd, geëvalueerd en gearchiveerd · dupliceren · nieuwe versie · export naar PDF en waar relevant Excel of CSV · rechten · archief · hergebruik.

Draait op PD-9 (zoeken) en PD-4 (bestanden). Bouwt daarvan niets na.

---

## 3a3. Slimme start per document

Bij "Nieuw document" verschijnt **geen leeg wit scherm**. De volgorde is:

1. context kiezen · 2. template kiezen · 3. Sparki verzamelt bestaande gegevens · 4. AI maakt concept waar toegestaan · 5. ontbrekende onderdelen worden gemarkeerd · 6. gebruiker controleert · 7. betrokken rollen vullen hun secties aan · 8. reviewer controleert · 9. bevoegde rol publiceert · 10. het document blijft als werkobject actueel · 11. PDF of export is een momentopname · 12. na uitvoering volgt evaluatie · 13. het object is later herbruikbaar.

*Dit is de schermvolgorde van de vijftien stappen uit 3e; stap 14 en 15 daar — organisatiegeheugen bijwerken en hergebruik mogelijk maken — gebeuren na afloop en zonder scherm.*

---

## 3a4. Auto-creatie en auto-voorstel

Sparki mag **automatisch een concept voorstellen** bij: nieuw team ingericht · nieuw seizoen · wedstrijd aangemaakt · selectie vastgesteld · training ingepland · trainer-sporterrelatie gestart · intake afgerond · test uitgevoerd · incident geregistreerd · einde facturatieperiode · abonnement gestart · evenement uitgevoerd · evaluatiemoment bereikt.

**Nooit automatisch publiceren of verzenden.** Voorstellen, niet doen.

### Continue aanvulling

Komt er nieuwe informatie binnen, dan mag Sparki een bestaand concept aanvullen of een **nieuwe conceptversie** voorstellen. Aanleidingen: renner meldt beschikbaarheid · selectie verandert · voertuig toegewezen · materiaaldefect gemeld · route definitief · trainer past doel aan · sporter geeft feedback · testresultaat toegevoegd · evaluatie afgerond · betaling ontvangen · consent gewijzigd.

**Wat Sparki daarbij altijd doet:** nooit stil een gepubliceerde versie overschrijven · tonen **wat** nieuw is · tonen **welke bron** dit veroorzaakte · waar nodig een nieuwe conceptversie maken · de bevoegde gebruiker laten bevestigen · betrokkenen informeren ná publicatie · de oude versie bewaren.

---

## 3b. Inhoudscontract per documenttype

**Een documenttype is niet compleet wanneer alleen naam en status zijn beschreven.** Ieder type dat op deze laag draait, draagt een inhoudsdefinitie met **vierentwintig verplichte onderdelen**. Zonder die definitie wordt het type niet vrijgegeven. Dit is het **documenttypecontract (DTC)** waarnaar de andere drie pakketten verwijzen.

| # | Onderdeel | Wat erin staat |
|---|---|---|
| 1 | doel | wat de lezer na afloop weet of kan |
| 2 | eigenaar | wie verantwoordelijk is |
| 3 | betrokken rollen | wie mag bijdragen |
| 4 | lezers | wie het mag zien |
| 5 | brongegevens | uit welke systemen en objecten de inhoud komt |
| 6 | vaste secties | wat er altijd in staat |
| 7 | optionele secties | wat er kan bijkomen |
| 8 | automatisch ingevulde onderdelen | wat Sparki uit bestaande gegevens vult |
| 9 | AI-gegenereerde conceptonderdelen | wat als concept wordt voorgesteld |
| 10 | handmatig verplichte onderdelen | wat een mens moet invullen |
| 11 | veiligheids- en privacygrenzen | wat er nooit in mag |
| 12 | goedkeuringsflow | wie akkoord geeft, op welke versie |
| 13 | versiegedrag | wat een nieuwe versie maakt |
| 14 | notificaties | wie wanneer wordt geïnformeerd |
| 15 | mobiele rolweergave | wat elke rol op de telefoon ziet |
| 16 | desktopbewerking | wat er alleen op desktop kan |
| 17 | PDF en export | welk rapporttype en welke template |
| 18 | evaluatie | wat er na uitvoering wordt vastgelegd |
| 19 | hergebruik | hoe het als bron voor een nieuw object dient |
| 20 | bewaarcategorie | welke termijn uit de bewaarmatrix PD-11 |
| 21 | organisatiegeheugen | wat het bijdraagt aan het geheugen |
| 22 | documentnaam en objecttype | onder welke naam en welk type het in de bibliotheek staat |
| 23 | statusflow | welke statussen dit type doorloopt en welke het overslaat |
| 24 | archief | wanneer het uit de dagelijkse stroom verdwijnt en waar het blijft |

**Geen lege template zonder velddefinitie.** Een template die alleen secties heeft maar geen velden met herkomst, is niet vrijgegeven.

**Regel 8 tegenover 9 tegenover 10 is het scherpst.** Wat uit bestaande gegevens komt, wordt gevuld — niet gevraagd. Wat de AI voorstelt, is concept en is als zodanig gemarkeerd. Wat een mens moet weten, wordt gevraagd en niet geraden.

---

## 3c. Organisatiegeheugen als standaard

Bij **ieder uitgevoerd werkobject** hoort standaard: evaluatie beschikbaar · score waar passend · opmerkingen per rol · plan tegenover uitvoering · afwijkingen · incidenten · terugkerende problemen · lessons learned · bevestigde verbeterpunten · bruikbaar als bron voor een nieuw object.

**Zoeken en voorstellen gebeurt op negen assen:** zelfde evenement · zelfde route · zelfde team · zelfde categorie · vergelijkbare omstandigheden · zelfde sporter · zelfde materiaal · vergelijkbare evaluatie · vergelijkbare problemen.

**Harde regel:** een evaluatie zonder bronobject bestaat niet. Een oordeel dat nergens aan hangt, is een mening in een systeem.

---

## 3d. Proactieve compositie en AI

AI doet hier meer dan tekst voorinvullen. Hij mag **proactief voorstellen**:

een vergelijkbaar oud plan gebruiken · een ontbrekende sectie aanvullen · een conflict voorleggen als menselijke keuze · een eerdere fout onder de aandacht brengen · lessons learned meenemen · een onvolledige briefing aanvullen · een ontbrekende rol benoemen · een materiaalprobleem uit de historie signaleren · een tijdsplanning realistischer maken · een evaluatiemoment inplannen · een volgende versie voorbereiden.

**Zo klinkt dat, met echte bronnen:**
"Bij de vorige drie wedstrijden ontbrak reservewiel X." · "Deze mechanieker is al op een andere wedstrijd ingepland." · "Het bevoorradingsmoment was vorig jaar te laat." · "De oudertoestemming voor deze minderjarige is niet geldig." · "Voor deze klant staat een coachingfactuur klaar." · "Deze training wijkt sterk af van het actieve doel."

**Ieder AI-concept draagt tien vaste velden:** gebruikte bronnen · gebruikte periode · gebruikte rollen · ontbrekende informatie · confidence en onzekerheid · datum · **maker: AI-concept** · **status: concept** · menselijke eigenaar · bevestigingsstatus.

**AI mag concepten maken voor:** samenvatting · instructie · briefing · evaluatie · lessons learned · wedstrijdplan · dagschema · taakverdeling · materiaalplan · voedingsplan · ouderbriefing · sporterbriefing · voortgangsrapport · intake · begeleidingsvoorstel · overeenkomst · factuuromschrijving · incidentanalyse · seizoensevaluatie.

**AI mag niet:** een diagnose stellen · financiële bedragen zelfstandig bepalen · de btw-status bepalen · medische informatie breder delen · scores als feit presenteren · een personeelsbeoordeling definitief maken · een selectie of plan zelfstandig publiceren · een document versturen zonder bevoegde bevestiging · **oude documenten herschrijven**.

**Harde regels:** bron zichtbaar · periode zichtbaar · onzekerheid zichtbaar · **voorstel, nooit een definitieve actie** · geen automatische publicatie · geen automatische personeelsbeoordeling · geen medische conclusie · **geen verzonnen feit**.

**AI-uitval maakt een document nooit onbruikbaar.** Valt de AI weg, dan verschijnt het object zonder concepten, met de automatisch gevulde onderdelen en de eerlijke lege plekken — en blijft het volledig bewerkbaar.

---

## 3e. De vijftien stappen bij elk nieuw object

1. context selecteren · 2. relevante oude objecten zoeken · 3. relevante brondata verzamelen · 4. AI-concept genereren · 5. ontbrekende informatie tonen · 6. verantwoordelijke per ontbrekend veld tonen · 7. betrokken rollen laten bijdragen · 8. review · 9. goedkeuring · 10. publicatie · 11. persoonlijke weergaven genereren · 12. uitvoering · 13. evaluatie · 14. organisatiegeheugen bijwerken · 15. hergebruik mogelijk maken.

**Geen leeg scherm. Geen bekende informatie opnieuw vragen. Geen publicatie zonder controle.**

---

## 3f. Compleetheidstoets per documenttype

Een type is pas compleet wanneer **alle vijftien** aantoonbaar werken:

inhoudsmodel bestaat · brondata bestaat · AI-concept werkt · ontbrekende data is eerlijk zichtbaar · rollen kunnen bijdragen · versiebeheer werkt · goedkeuring werkt · mobiele rolweergave werkt · PDF en export werken · evaluatie werkt · dupliceren werkt · **het origineel blijft bestaan** · organisatiegeheugen wordt gevoed · rechten en consent werken · fout- en lege toestand werken.

Mirror toetst deze vijftien per type, niet per pakket.

---

## 4. Datamodel

### 4.1 De gedeelde kern

`work_object`: object-ID · objecttype · titel · eigenaar · organisatie · team · sporter · evenement · status · versie · geldigheidsperiode · deelnemers · rollen · secties · taken · opmerkingen · bijlagen · brondata · privacyclassificatie · gepubliceerd op · ingetrokken op · gearchiveerd op · **templatebron** · **afgeleid-van-object** · **versieherkomst**.

**De laatste drie zijn het organisatiegeheugen in het datamodel.** Zonder `afgeleid-van-object` en `versieherkomst` is niet na te gaan waar een plan vandaan komt, en is hergebruik een kopie zonder spoor.

### 4.2 Typen op deze kern
wedstrijdplan · dagschema · bezettingsplan · materiaalplan · voertuigenplan · voedingsplan · trainingskamp · weekplan · jaarplan · intake · briefing · checklist · incidentrapport · evaluatie · overdracht · clubactiviteit · trainerdocumenten.

Elk type definieert alleen zijn eigen secties en verplichte velden. **Nooit een eigen tabel met eigen versiebeheer.**

### 4.3 Versies
`work_object_version`: object · versienummer · status · gemaakt door · gemaakt op · **wijzigingssamenvatting** · vorige versie · reden bij terugzetten.

### 4.4 Samenwerking
`work_object_participant`: object · gebruiker · rol in het object (eigenaar · bijdrager · reviewer · uitgever · lezer) · sectierechten.
`work_object_comment`: object · sectie · auteur · tekst · status (open · opgelost) · gemaakt op.
`work_object_task`: object · sectie · verantwoordelijke · deadline · status · afgevinkt door en op.

### 4.5 Evaluatie en geheugen
`work_object_evaluation`: object · wat ging goed · wat ging niet goed · wat ontbrak · wat kostte extra tijd · wat moet anders · veiligheidsbevindingen · materiaalbevindingen · communicatiebevindingen · planningbevindingen · lessons learned.
`work_object_score`: object · dimensie (voorbereiding · communicatie · planning · materiaal · uitvoering · samenwerking · veiligheid) · score · door wie · bevoegdheidscontrole.

### 4.6 Audit
Elke statuswijziging, publicatie, intrekking, duplicatie en scorewijziging is append-only vastgelegd: wie · wanneer · op welke grond.

---

## 5. API

- `POST /work-objects` · `GET /work-objects/{id}` · `GET /work-objects?type=&org=&team=&event=`
- `POST /work-objects/{id}/versions` — publiceren maakt een nieuwe versie met verplichte wijzigingssamenvatting.
- `GET /work-objects/{id}/versions/{v}` · `GET .../compare?a=&b=` — vergelijking.
- `POST /work-objects/{id}/restore/{v}` — maakt een **nieuwe** versie.
- `POST /work-objects/{id}/withdraw` — intrekken.
- `POST /work-objects/{id}/duplicate` — met sectiekeuze en herbevestiging van datum, deelnemers en context.
- `POST /work-objects/{id}/comments` · `/tasks` · `/participants`
- `POST /work-objects/{id}/evaluation` · `/scores`
- `GET /work-objects/search` — seizoensgeheugen: vergelijkbare wedstrijden, routes, locaties, evenementtypen, terugkerende problemen.
- `POST /work-objects/{id}/export` — PDF via de bestaande rapportgenerator, van één specifieke versie.

**Regel:** rechten en scope server-side. Sectierechten worden op de server toegepast, niet door de client verborgen.

---

## 6. Rechten

| Objectrol | Mag |
|---|---|
| eigenaar | alles binnen zijn scope, inclusief publiceren en intrekken |
| bijdrager | eigen secties bewerken, opmerkingen, taken |
| reviewer | lezen, opmerkingen, review afronden |
| uitgever | publiceren |
| lezer | lezen wat zijn rol mag zien |

Daarbovenop: organisatiescope · teamscope · consent · veld- en sectierechten · `endedAt`-filter uit pakket 1. Wie zijn rol verliest, verliest onmiddellijk toegang; zijn bijdragen blijven als historie staan.

**`nutrition_specialist`** krijgt objectrollen binnen zijn koppeling aan sporter, team of organisatie: hij maakt en publiceert voedingsobjecten, en ziet uitsluitend wat voor voedingsbegeleiding noodzakelijk is. Geen diagnose, geen medisch dossier zonder afzonderlijke toestemming (BB-14).

**Scoren mag alleen binnen de eigen bevoegdheid.** Een mechanieker scoort materiaal, geen samenwerking van de staf.

---

## 7. Mobiele UX

**Het object toont op mobiel jouw deel, niet het geheel.**

- Persoonlijke samenvatting · alleen relevante secties · huidige taak · volgende taak · bevestigen en afvinken in één handeling · **wat er is gewijzigd sinds jij het laatst zag** · actieve rol en context zichtbaar · zichtbare terugweg.
- **Geen brede editor op de telefoon.** Beperkte wijziging: afvinken, bevestigen, één veld corrigeren.
- Offline: alleen een gestarte navigatie loopt door; een afvinkactie wordt **niet** als geslaagd getoond zonder server.
- In de wedstrijddagmodus wordt het object een takenlijst met één regel per taak.

## 8. Desktop UX

Volledige bewerking: secties vullen, versies vergelijken, deelnemers en rechten beheren, publiceren, evalueren, dupliceren, templates beheren.

---

## 9. Fasen en Replit-opdrachten

### F0 — Inventarisatie (geen code)
**Scope:** bestaat er een generieke documenttabel of één per domein · bestaat er versiebeheer buiten rapporten · bestaat er een statusbegrip buiten `KENNIS_01` · bestaan er opmerkingen op object of sectie · bestaat er taakkoppeling · bestaat er een editor waarin twee rollen samenwerken · bestaat er een templatebibliotheek buiten rapporttemplates · bestaan er veld- of sectierechten · waar worden dagschema, bezettingsplan en trainingsplan nu opgeslagen · **hoeveel verschillende manieren van "opslaan en later terugzien" bestaan er naast elkaar**.
**Bewijs:** elke claim met schema, endpoint of scherm; elke afwezigheid met vindplaats.
**Mirror:** het antwoord op de laatste vraag is het aantal bestaande architecturen — dat getal bepaalt de migratieomvang. **F1 start pas na `F0 MIRROR_PROVEN`.**

### F1 — Kern, status en versie
**Scope:** `work_object` met alle velden uit 4.1 · de levenscyclus concept → in review → gepubliceerd → uitgevoerd → geëvalueerd → ingetrokken → gearchiveerd → gebruikt als bron · versies met verplichte wijzigingssamenvatting · vergelijking · terugzetten als nieuwe versie · intrekken.
**Niet bouwen:** typen, evaluatie, duplicatie, PDF. Alleen de laag.
**Migratie:** bestaande plannen **niet** automatisch omzetten. F0 bepaalt welke; omzetten gebeurt per type in F7 en in pakket 3 en 4, telkens met telling voor en na.
**Tests:** publiceren maakt versie · gepubliceerd object niet overschrijfbaar · terugzetten maakt nieuwe versie · ingetrokken versie nergens meer geldig.
**Rollback:** laag uitschakelbaar; bestaande opslag blijft intact.
**Mirror:** BB-21 t/m BB-25.

### F2 — Samenwerking
**Scope:** de vijf objectrollen · opmerkingen per object en per sectie · taken met verantwoordelijke, deadline en status · gelezen en bevestigd · wijzigingsmelding · veld- en sectierechten · audit.
**Niet bouwen:** een tweede notificatiesysteem; een chatfunctie.
**Tests:** gelijktijdige wijziging · ingetrokken rol tijdens bewerken · versieconflict · opmerking op een sectie die de lezer niet mag zien.
**Mirror:** geen lek via een opmerking of taak.

### F3 — Dupliceren en hergebruiken
**Scope:** dupliceren naar een nieuwe wedstrijd, seizoen, trainingsweek, clinic, trainingskamp, intake of briefing. Origineel blijft intact. Gebruiker kiest welke secties meegaan. Datum, deelnemers en actuele context worden **opnieuw bevestigd**. Verlopen informatie wordt gemarkeerd. Nieuwe versie krijgt eigen ID en audit, met `afgeleid-van-object` gevuld.
**Niet bouwen:** blind kopiëren.
**Rechten:** **gevoelige persoonsgegevens worden niet meegekopieerd** (BB-29); de gebruiker ziet expliciet wat wegvalt.
**Tests:** dupliceren met persoonsgegevens · dupliceren over teams heen · verlopen informatie.
**Mirror:** BB-29 — één blind gekopieerd persoonsgegeven is afkeur.

### F4 — Evaluatie en organisatiegeheugen
**Scope:** evaluatie na uitvoering met de tien velden uit 4.5 · scores op zeven dimensies binnen bevoegdheid · AI-conceptnotities voor hoofdtrainer en teammanager over uitvoering van plannen, staffunctioneren, samenwerking, rennersuitvoering, terugkerende problemen en seizoensontwikkeling.
**Harde regels bij AI:** concept, nooit waarheid · bronobjecten zichtbaar · gebruikte periode zichtbaar · confidence en onzekerheid · mens bevestigt of wijzigt · **geen geheime personeelsbeoordeling** · inzage en rechten vastgelegd · geen medische informatie in een algemene evaluatie · **geen automatische sancties of selectie op een AI-score**.
**Niet bouwen:** een beoordelingssysteem met gevolgen. Dit is geheugen, geen personeelsdossier.
**Tests:** AI-concept zonder bevestiging blijft concept · scoren buiten bevoegdheid geweigerd · medische informatie geweigerd in een algemene evaluatie.
**Mirror:** BB-26 t/m BB-28, BB-30.

### F5 — Seizoensgeheugen
**Scope:** zoeken en vergelijken op vergelijkbare wedstrijden · vergelijkbare routes · zelfde locatie · zelfde evenementtype · terugkerende materiaalproblemen · terugkerende planningsproblemen · evaluaties per seizoen en per team · lessons learned · hergebruikte plannen · afwijking tussen plan en uitvoering. Bij een nieuw object stelt Sparki voor: vorig plan gebruiken · materiaalplan meenemen · dagschema meenemen · briefing meenemen · evaluatie raadplegen · lessons learned meenemen.
**Niet bouwen:** automatisch overnemen. Elk voorstel wordt bevestigd.
**Tests:** oude objecten blijven terugvindbaar · voorstel is een voorstel.

### F6 — PDF en rapportage
**Scope:** uitvoer via de bestaande rapportgenerator van **één specifieke objectversie**, met document-ID · object-ID · objectversie · templateversie · datum · afzender · organisatie · co-branding · privacyclassificatie · QR of link naar de actuele digitale versie waar toegestaan.
**Harde regels:** oude PDF verandert nooit · een ingetrokken PDF die via Sparki wordt geopend, krijgt een digitale waarschuwing.
**Niet bouwen:** een tweede rapportgenerator; een PDF die als bron dient.
**Tests:** oude PDF na vier nieuwe versies · ingetrokken PDF openen via Sparki · QR na ingetrokken toegang.
**Mirror:** BB-21, BB-24.

### F7 — Pilot: dagschema
**Scope:** één type, helemaal, met minimaal vier rollen: ploegleider · mechanieker · soigneur · renner.
**Bewijs, alle elf:** gezamenlijk invullen · rolgerichte secties · publiceren · mobiele persoonlijke weergave · wijziging · gerichte notificatie · nieuwe versie · PDF · uitvoering · evaluatie · dupliceren voor een nieuwe wedstrijddag.
**Waarom dit type:** het wijzigt het vaakst, de kosten van een fout zijn het hoogst, de rapportkant ligt al vast, en vier rollen kijken er tegelijk in. Slaagt het dagschema, dan is de laag bewezen.
**Migratie:** bestaande dagschema's omzetten met telling voor en na; wat niet omgezet kan worden, blijft staan en wordt gemeld.
**Mirror:** de elf bewijspunten, elk apart.

### F8 — Centrale takenlaag (PD-7)
**Scope:** het `task`-model, de zes statussen, herhaling, afhankelijkheid, escalatie, bewijs, overdracht, opnieuw toewijzen bij ingetrokken rol, en **"Mijn taken" met vijf groepen** voor elke relevante rol.
**Niet bouwen:** een taakmodel per module; taken die alleen binnen een document bestaan.
**Migratie:** bestaande taken uit werkobjecten worden hierop omgezet met telling voor en na.
**Tests:** taak in een dagschema verschijnt in Mijn taken · geblokkeerde taak met afhankelijkheid · ingetrokken rol → taak opnieuw toewijzen · bewijsfoto zonder recht.

### F9 — Sjabloonbibliotheek (PD-8)
**Scope:** vijf niveaus, versies, publiceren, intrekken, preview, verplichte en optionele secties, rolrechten.
**Harde regel:** een template-update verandert **geen** bestaand object; migratie per object met bevestiging.
**Tests:** template wijzigen na publicatie · bestaand object ongewijzigd · bewuste migratie van één object · trainertemplate zichtbaar voor andere trainer → geweigerd.

### F10 — Platformbreed zoeken (PD-9)
**Scope:** vijftien objecttypen, dertien filters, rechtenfilter vóór resultaat, contextgevoelig op mobiel.
**Niet bouwen:** een zoekfunctie per module.
**Tests:** zoeken naar een object zonder recht → geen titel, geen snippet · zoeken na rolwissel → geen oude context · zoeken op factuurnummer als niet-eigenaar.
**Mirror:** een zichtbare titel van een verboden object is directe afkeur.

### F11 — Goedkeuring en bevestiging (PD-10)
**Scope:** de zeven statussen, versiegebonden akkoord, geldigheidsduur, opnieuw akkoord bij relevante wijziging, audit.
**Niet bouwen:** een zwaar ondertekenplatform.
**Tests:** akkoord op versie 3, daarna versie 4 → nieuw akkoord nodig · afgewezen met reden · geen stilzwijgend akkoord bij verlopen termijn.

### F12 — Archief en bewaarmatrix (PD-11)
**Scope:** de dertien velden per objecttype, centraal configureerbaar, legal hold, anonimisering, export vóór verwijdering.
**Niet bouwen:** een termijn ergens in de code.
**Tests:** vijf objecttypen met vijf verschillende termijnen · opzegging met wettelijk te bewaren gegeven · legal hold blokkeert verwijdering.

### F13 — Gebruikersaudit en activiteitenhistorie (PD-12)
**Scope:** leesbare historie per object en per gebruiker, rolgefilterd.
**Tests:** wie opende noodinformatie · historie voor een gebruiker die minder mag zien · geen technische details waar ze niet nodig zijn.

### F14 — Import en export (PD-13)
**Scope:** de negen importstappen en de vijf exportformaten, met exportlog, voor de tien domeinen.
**Tests:** import met foutregels · dry-run zonder effect · duplicaat · rollback na bevestiging · export met privacyclassificatie.

### F15 — Proactieve objectcompositie
**Scope:** de centrale documentenbibliotheek uit 3a2 · de slimme start uit 3a3 · de auto-voorstellen en continue aanvulling uit 3a4 · en de vijftien stappen uit 3e als één werkende keten. Concreet: contextselectie · zoeken naar vergelijkbare oude objecten op de negen assen · brondata verzamelen · AI-concept genereren met zichtbare bron, periode en onzekerheid · ontbrekende velden tonen mét verantwoordelijke · bijdragen per rol · review · goedkeuring · publicatie · persoonlijke weergaven.
**Niet bouwen:** automatische publicatie · een concept dat als definitief wordt gepresenteerd · een suggestie zonder bron.
**Rechten:** een voorstel bevat nooit een gegeven dat de gebruiker zelf niet mag zien. Ook een suggestie is een weergave.
**Tests:** onboarding voltooid · onboarding incompleet · voldoende data · gedeeltelijke data · conflicterende data · verouderde data · ingetrokken toestemming · gewijzigde rol · meerdere teams · meerdere wedstrijden · minderjarige · oude templateversie · **AI niet beschikbaar** · document zonder AI volledig bruikbaar · AI-concept blijft concept · publicatie vereist menselijke bevestiging · dupliceren behoudt het origineel · privacyvelden worden niet verkeerd voorgevuld · oude PDF blijft onveranderd · nieuwe informatie maakt een nieuwe conceptversie.
**Mirror:** een leeg formulier terwijl er bruikbare bronobjecten zijn, is directe afkeur. Een verzonnen feit in een concept ook.

### F16 — Eindbewijs
Bewijsbundel per fase plus de volledige testmatrix.

---

## 10. Migratieregels

**M-1** Geen migratie zonder rollback en zonder telling voor en na. **M-2** Bestaande plannen worden per type omgezet, nooit allemaal tegelijk. **M-3** Wat niet omgezet kan worden, blijft bestaan en wordt gemeld — nooit stil verwijderd. **M-4** Een omgezet object behoudt zijn oorspronkelijke datum en auteur. **M-5** Oude PDF's blijven onaangeraakt.

## 11. Testmatrix

gelijktijdige wijziging · ingetrokken rol tijdens bewerken · versieconflict · oude PDF na nieuwe versies · dupliceren met persoonsgegevens · cross-team · minderjarige · offline · lage verbinding · notificatie opent de juiste objectversie · AI-concept zonder bevestiging blijft concept · oude objecten terugvindbaar · scoren buiten bevoegdheid · medische informatie in algemene evaluatie · ingetrokken versie via link · QR na intrekking · 360 dp · desktop · 200% tekst · schermlezer.

## 12. Mirror-toets per fase

| Fase | Kern van de toets |
|---|---|
| F0 | hoeveel parallelle opslagmanieren bestaan er |
| F1 | publiceren, versie, terugzetten, intrekken |
| F2 | geen lek via opmerking of taak; ingetrokken rol |
| F3 | geen blind gekopieerd persoonsgegeven |
| F4 | AI-concept blijft concept; geen sanctie op score |
| F5 | voorstel wordt bevestigd, niet toegepast |
| F6 | oude PDF onveranderd; ingetrokken PDF gewaarschuwd |
| F7 | de elf bewijspunten van het dagschema |
| F8 | taak zichtbaar in Mijn taken, niet alleen in het document |
| F9 | template-update raakt bestaand object niet |
| F10 | geen titel of snippet van een verboden object |
| F11 | akkoord is versiegebonden |
| F12 | vijf termijnen, centraal, legal hold werkt |
| F13 | leesbare historie, rolgefilterd |
| F14 | dry-run zonder effect; exportlog aanwezig |
| F15 | concept met zichtbare bron; leeg bij écht niets; werkt zonder AI |
| F16 | volledige matrix, geen regressie |

## 13. Rollback

Elke fase afzonderlijk. **Uitzondering:** F1 terugdraaien betekent F2 t/m F16 terugdraaien. F8 t/m F14 zijn centrale diensten: terugdraaien raakt ook pakket 03 en 04 en gebeurt nooit zonder afstemming. Een half omgezet type gaat terug naar de oude opslag, niet naar een tussentoestand.

## 14. Directe afkeurgronden

Rechtenlek · dataverlies · onveilige migratie · tweede architectuur · niet-groene build, typecheck of tests · ontbrekende rollback · verzonnen persoonlijke informatie · gepubliceerd object stil overschreven · geschiedenis herschreven · ingetrokken versie als geldig getoond · PDF als primair werkobject · blind gekopieerd persoonsgegeven · AI-concept als definitieve waarheid gepresenteerd · automatische sanctie of selectie op AI-score · medische informatie in een algemene evaluatie · tweede documentarchitectuur naast deze laag · **een tweede takenlijst, zoekfunctie, sjabloonsysteem, goedkeuringsflow of bewaarmatrix naast een centrale dienst** · een taak die alleen in een document bestaat · een titel of snippet van een verboden object in een zoekresultaat · een template-update die een bestaand object wijzigt · stilzwijgende goedkeuring · een bewaartermijn in de code · **een leeg formulier terwijl bruikbare bronobjecten bestaan** · een AI-concept met een verzonnen feit · een voorstel zonder zichtbare bron · een evaluatie zonder bronobject · een documenttype dat alleen een naam en een status heeft · **AI-uitval die een document onbruikbaar maakt** · een oud plan dat niet herbruikbaar is · organisatiegeheugen dat niet gevuld wordt · **een documentenbibliotheek per module** · een lege template zonder velddefinitie · een AI-concept zonder de tien vaste velden · automatische publicatie of verzending van een concept · een gepubliceerde versie die stil wordt overschreven bij nieuwe informatie.

## 15. Eindbewijs

Per fase SHA, scenario's en uitkomst. Plus één integrale doorloop van de dagschemapilot met vier echte accounts in vier rollen, van aanmaken tot dupliceren.

## 16. Productiepoort

Alle fasen `MIRROR_PROVEN` · geen openstaande afkeurgrond · migratie omkeerbaar aangetoond · **expliciete vrijgave door René**.

## 17. Rapportagevorm voor Replit

```
Fase: F#
SHA: <vaste commit>
Gebouwd: <in één regel>
Niet gebouwd: <bewust overgeslagen>
Migratie: <type> — telling voor/na, niet-omgezet: <aantal en reden>
Tests: <groen/rood>
Bewijs: <verwijzing>
Blokkade: <geen / welke>
```

## 18. Geblokkeerde besluiten

- **Welke van de eenentwintig typen worden werkobject en welke blijven rapport.** F1 t/m F6 bouwen de laag; F7 doet het dagschema. De omzetting van de overige typen wacht op dit besluit van René en wordt **niet zelf ingevuld**.
- **Is er een verplichte reviewstap, of volstaat publiceren?** De statusketen bevat `in review`; of die stap verplicht is per type, is een besluit van René. Tot dan is review **beschikbaar en niet verplicht**.
- **Bewaartermijnen** voor objecten, versies en evaluaties. Configureerbaar bouwen, centraal, nooit verspreid hardcoded. De bewaarmatrix uit PD-11 wordt **leeg** opgeleverd; de termijnen komen van jurist of accountant, niet van Replit.
- **Welke objecttypen een verplichte goedkeuringsstap krijgen** en met welke geldigheidsduur. PD-10 wordt gebouwd; welke typen hem verplicht gebruiken, is een besluit van René.

---

*Einde `SPARKI_BUILD_02`.*
