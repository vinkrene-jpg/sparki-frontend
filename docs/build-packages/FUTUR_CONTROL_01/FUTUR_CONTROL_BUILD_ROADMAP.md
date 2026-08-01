# FUTUR_CONTROL_BUILD_ROADMAP

**Status:** `OPEN` — **geen enkele fase is vrijgegeven** · **Datum:** 1 augustus 2026
Volgt het vaste 5-delige pakketsjabloon: per fase een uitvoerbare Replit-opdracht, een onafhankelijke Mirror-toets, een afhankelijkheidscheck, een herstelprotocol en een synchronisatiepatch.

---

# DEEL 0 — REGELS VOOR DE HELE REEKS

| Code | Regel |
|---|---|
| RM-01 | **Eén fase tegelijk vrijgegeven.** Replit bouwt niets vooruit, ook niet "omdat het toch nodig wordt". |
| RM-02 | Elke fase levert bewijs op een **vaste gepushte SHA**. Gebouwd zonder Mirror-bewijs = `BUILT_UNPROVEN`. |
| RM-03 | Geen schemawijziging, refactor of afhankelijkheid buiten de vrijgegeven fase. |
| RM-04 | Elke fase met opslag levert een **migratie met terugweg**. Zonder terugweg geen vrijgave. |
| RM-05 | Elke fase draagt het label **kern**, **connector** of **infra**, zodat altijd duidelijk is wat generiek is en wat Sparki-specifiek. |
| RM-06 | Is een fase te groot voor één Replit-opdracht, dan wordt zij gesplitst (a/b/c) en per deel vrijgegeven. |
| RM-07 | Geen fase presenteert een schatting. Ontbrekende meting = `Onbekend`. |
| RM-08 | Mobiele UX conform `MOBILE_UX_STANDARD_01` (v1.4); rapportage conform `REPORT_DESIGN_STANDARD_01`. |
| RM-09 | **F0 t/m F12 zijn allemaal read-only naar buiten.** Geen enkele fase bouwt een schrijf-, deploy-, herstart-, configuratie- of rechtenpad richting een product, dienst of apparaat. Interne mutaties binnen de Control-database (incidentstatus, notities, kennisitemversies, supportconcepten, goedkeuringen, blokkades) zijn wél toegestaan. Externe muterende functies worden pas in een **afzonderlijke toekomstige bouwreeks** gebouwd of vrijgegeven — zie `FUTUR_CONTROL_MUTATION_GATE.md` en fase `F13`. |
| RM-10 | **Geen functionele Control-handeling vóór `F1B MIRROR_PROVEN`.** Zolang het append-only auditspoor niet bewezen is, wordt er niets gedaan wat gelogd zou moeten worden. |

**Volgorde-argument.** Audit vóór alles wat gelogd moet worden. Registers vóór metingen, want een meting zonder geregistreerde bron is waardeloos. Read-only connector vóór statusschermen, want anders wordt status gevuld met aannames. Incidenten vóór kennisitems, want kennis komt uit gesloten zaken. Agents ná kennisitems, want een agent zonder bronvermelding is niet controleerbaar. Mobiel ná de inhoud, omdat een mobiel scherm keuzes maakt die pas te maken zijn als de inhoud vaststaat.

---

# DEEL 1 — FASEN

## F0 — Totale inventarisatie · **geen code** · kern + connector

**Doel:** vaststellen wat er in het bestaande Sparki-beheer werkelijk is en wat generiek herbruikbaar is.
**Voorwaarde:** geen. Dit is de enige fase die nu vrijgegeven mag worden.

**Onderzoek en leg per onderdeel vast — bestaat het · waar staat het · wie mag erbij · wordt het gebruikt · generiek herbruikbaar:**
authenticatie en rechten (incl. of `admin` een rolwaarde is of erbuiten staat) · admin-API's met methode en autorisatie · logging en of er een append-only spoor bestaat · monitoring, health-endpoints, crash reporting, alerting · achtergrondtaken · betalingen en webhookverwerking · support- en ticketstructuur · release en deployment (GitHub Actions, validators, typecheck, admin-smoke, productie-SHA, rollbackpad, migraties) · back-up en of herstel ooit is getest · continuïteitsonderdelen · bestaande bouwpakketten die dit gebied al beschrijven · bestaande agent- of automatiseringsruntime · alle externe diensten uit de startlijst in `FUTUR_CONTROL_DEPENDENCY_REGISTRY_STANDARD.md` §4 · aanwezige eigen infrastructuur (NAS, netwerk).

**Opleveringen:** `CONTROL_INVENTARISATIE.md` (per onderdeel `AANWEZIG` / `GEDEELTELIJK` / `AFWEZIG` / `ONBEKEND` met vindplaats) · `CONTROL_HERGEBRUIKMATRIX.md` (hergebruiken / uitbreiden / nieuw bouwen met reden) · `CONTROL_RISICOS.md` · `CONTROL_ARCHITECTUURVOORSTEL.md` (bevestiging of correctie van de voorgestelde plaatsing en fasering) · **`CONTROL_OVERLAPVOORSTEL.md`** — per overlappend pakket (`31_HELPDESK_01`, `32_ADMIN_OPERATIONS_01`, `33_CONTINUITEIT_01`, `RELEASE_01`) een voorstel met gevolg, conform `FC-B01 = C`. **René beslist daarna; `F1A` start pas nadat die beslissing is vastgelegd.** · **`CONTROL_HERSTELTESTVOORSTEL.md`** — inventarisatie van gegevenssoorten en beschikbare herstelomgeving, als basis voor `FC-B09`.
**Bewijs:** diff bevat uitsluitend documenten · elke `AANWEZIG` heeft een vindplaats · elke `AFWEZIG` vermeldt waar is gezocht.
**Niet doen:** geen tabellen, endpoints, schermen of dependencies.

**Mirror:** steekproef van vijf `AANWEZIG`-regels tegen de echte code; zelfstandig zoeken naar drie `AFWEZIG`-regels. **Afkeur:** diff bevat code · vindplaats ontbreekt · onderdeel gemeld dat niet bestaat.
**Afhankelijkheden:** geen. **Mag niet blokkeren:** alle openstaande Sparki-productvragen, bewaartermijnen, besluitnummering.

---

## F1 — Bootstrap, audit en beheerschil · kern

**Voorwaarde:** F0 `MIRROR_PROVEN` + het vastgelegde besluit van René op het overlapvoorstel (`FC-B01 = C`).
**Splitsing:** A → B → C, elk apart vrijgegeven. **Geen functionele Control-handeling vóór `F1B MIRROR_PROVEN`.**

### F1A — Beveiligde bootstrap
**Bouwen:** aparte deployment met eigen beveiligde beheer-URL · eigen beheeridentiteit (`FC-B03 = A`) · sterke authenticatie · secretvoorziening · **immutable provisioning- en platformlog** · gescheiden test-, acceptatie- en productieconfiguratie · tijdsynchronisatie-bewaking.
**Niet bouwen:** **nog geen functionele beheeracties** — geen registers, geen schermen met inhoud, geen connectors, geen agents.
**Bewijs:** aanmelden zonder tweede factor faalt · geen secret zichtbaar in enig scherm, log of export · een sleutel werkt in precies één omgeving · het provisioning-/platformlog is aantoonbaar onveranderlijk.

### F1B — Append-only Control-audit
**Bouwen:** insert-only opslag · update en delete geweigerd **op databaseniveau** · verplichte velden: actor · reden · zaak · resultaat, naast tijdstip, handeling, onderwerp, voor-/nawaarde, herkomst · schrijfhulp die overal wordt gebruikt · lees- en zoekweergave per product, identiteit, zaak en periode · export conform `REPORT_DESIGN_STANDARD_01`.
**Niet bouwen:** geen wijzigknop, geen bulkverwijdering, geen bewaartermijnautomatiek (juridisch open — configureerbaar, niet vaststellen).
**Bewijs:** update en delete falen aantoonbaar op databaseniveau · een handeling zonder actor, reden, zaak of resultaat wordt geweigerd · correctie is een nieuwe regel met verwijzing · de handelingen uit F1A staan in het spoor.

### F1C — Rechten- en beheerschil
**Bouwen:** volledige scopes `<handeling>:<objecttype>:<bereik>` · herbevestiging bij kritieke handelingen · break-glass conform `FCS-16` · **iedere handeling loopt nu verplicht via F1B**.
**Bewijs:** rechtenmatrix met **geweigerde** pogingen · break-glass meldt, logt en geeft geen vrijgave- of deployrecht · geen handeling mogelijk die het auditspoor omzeilt · geen schrijfscope richting een product, dienst of apparaat aanwezig (`FCS-28`).

**Mirror (F1A–C):** aanmelden zonder tweede factor; kritieke handeling zonder herbevestiging; scope buiten bereik; break-glass gebruiken; update en delete op auditrecords; handeling zonder reden; zoeken naar secrets en naar schrijfscopes. **Afkeur:** één poging slaagt · break-glass geeft vrijgaverecht · secret zichtbaar · gedeelde sleutel over omgevingen · handeling zonder auditregel · functionele handeling mogelijk vóór F1B bewezen is · een schrijfscope naar buiten bestaat.
**Afhankelijkheden:** F0 + vastgelegd overlapbesluit. **Mag niet blokkeren:** ontbrekende monitoring in Sparki · openstaande productvragen · nog niet aangesloten producten · bewaartermijnen.

---

## F2 — *vervallen*

**F2 is opgegaan in `F1B`.** De fasenummers F3 en verder zijn ongewijzigd gebleven, zodat verwijzingen elders blijven kloppen.

---

## F3 — Product-, dependency- en infrastructuurregister · kern

**Voorwaarde:** F1C `MIRROR_PROVEN`. **Splitsing:** a → b → c, elk apart vrijgegeven.

### F3a — Productregister
**Bouwen:** alle velden uit `FCA-10`, met herkomst per veld (`uit connector` / `handmatig` / `Onbekend`) · productrecords voor Sparki, FPS Connect en Forge, waarvan de laatste twee **leeg op N0**. **Forge is een beheerd product en nooit een tweede beheerlaag** (`FC-B08 = C`); de Control-kern kent geen afhankelijkheid van Forge.
**Bewijs:** een leeg product toont overal `Onbekend`, nergens een aanname · handmatige velden tonen datum en auteur · geen verzonnen gegevens voor FPS Connect en Forge.

### F3b — Dependencyregister
**Bouwen:** alle velden uit `FUTUR_CONTROL_DEPENDENCY_REGISTRY_STANDARD.md` §2 · risicoclassificatie · relatie *getroffen productfuncties* als echte relatie · de Sparki-startlijst (§4) als **lege regels ter verificatie**.
**Bewijs:** geen dienst met overgenomen leveranciersgegevens zonder verificatie · elke regel zonder verificatie staat op `Onbekend`.

### F3c — Infrastructuurregister
**Bouwen:** velden uit `FUTUR_CONTROL_INFRASTRUCTURE_STANDARD.md` · records voor NAS en (leeg) mini-server, zonder metingen.
**Bewijs:** alle metingen `Onbekend`; geen enkele waarde handmatig ingevuld als ware zij gemeten.

**Mirror (F3a–c):** velden tellen; leeg product openen; verzonnen gegevens zoeken; relatie *getroffen productfuncties* aanklikken. **Afkeur:** ontbrekend veld · aanname bij een leeg product · vrije tekst waar een relatie hoort · een register dat een eigen statusvocabulaire invoert.
**Mag niet blokkeren:** ontbrekende connectors · onbekende leveranciers · mini-server bestaat nog niet.

---

## F4 — Sparki read-only connector · connector

**Voorwaarde:** F3 `MIRROR_PROVEN`. **Splitsing:** a → b.

### F4a — Basisvelden (niveau N1)
**Bouwen:** connectoridentiteit met eigen sleutel per omgeving · velden healthstatus, versie en commit-SHA, API-status, database-status, degradatiestatus · zeven metagegevens per veld · contractversie · backoff bij falen.
**Bewijs:** connector schrijft aantoonbaar niets · een sleutel werkt in slechts één omgeving · niet-geleverd veld toont `Onbekend` · gecachte waarde toont haar leeftijd · een poging tot data buiten het contract wordt geweigerd en gelogd.

### F4b — Uitbreiding naar niveau N2
**Bouwen:** achtergrondtaken · foutmeldingen · gebruikersimpact (bovengrens uit registratie) · synchronisatiestatus · datatruststatus · beveiligingssignalen.
**Bewijs:** gebruikersimpact is herleidbaar tot registratie, geen schatting · ontbrekende impact toont `Onbekend`.

**Mirror:** elk veld naar zijn bron volgen; connector afknijpen; schrijfpoging; sleutel in tweede omgeving; contractversie verwijderen. **Afkeur:** schrijfactie mogelijk · veld zonder bron · laatst bekende waarde als actueel gepresenteerd · onbekende contractversie geaccepteerd · geclaimd niveau niet bewezen.
**Mag niet blokkeren:** lopende Sparki-bouwpakketten (`ROUTE_PAKKET_02b..02d`, taak #536, PR 507) · openstaande productbesluiten · ontbrekende monitoring.

---

## F5 — Systeemstatus en functionele healthchecks · kern + connector + infra

**Voorwaarde:** F4 `MIRROR_PROVEN`. **Splitsing:** a → b → c.

### F5a — Systeemstatusdashboard (desktop, alleen lezen)
**Bouwen:** statusblokken per product met status, tijdstip van de meting en bron. Blok waarvan de bron in F0 als `AFWEZIG` is vastgesteld toont `Onbekend` met vermelding welke meting ontbreekt — niet verborgen, niet geschat.
**Bewijs:** minstens één echt `Onbekend`-blok · geen schrijfhandeling in de netwerkinspectie.

### F5b — Functionele controles
**Bouwen:** de controles uit `FUTUR_CONTROL_HEALTHCHECK_STANDARD.md` §3 voor de diensten die in F0 als aanwezig zijn bevestigd · per controle naam, stappen, verwachte uitkomst, tijd, frequentie, houdbaarheid · degradatiegedrag uit §6.
**Bewijs:** geen controle raakt echte gebruikersdata · test/live-scheiding bij betalingen apart bewezen · een gefaalde controle vermeldt **welke stap** faalde · een niet-gedraaide controle levert `Onbekend`.

### F5c — Infrastructuurcontroles
**Bouwen:** NAS-controles uit `FUTUR_CONTROL_NAS_CONNECTOR_STANDARD.md`, uitgaand aangeleverd.
**Bewijs:** back-up geldt pas `Gezond` bij aantoonbare herstelbaarheid · ontbrekende sensor toont `Onbekend`.

**Mirror:** bronnen afknijpen; houdbaarheid overschrijden; leveranciersstatuspagina groen zetten terwijl de functionele controle faalt. **Afkeur:** vals groen · ping als gezondheidsbewijs · statuspagina overschrijft eigen controle · totaalcijfer aanwezig.
**Mag niet blokkeren:** diensten die in F0 `Onbekend` bleven · ontbrekende sensoren · mini-server.

---

## F6 — Incidenten, impactketen en kennisitems · kern

**Voorwaarde:** F5 `MIRROR_PROVEN`. **Splitsing:** a → b → c.

### F6a — Incidentregister en incidentdetail
**Bouwen:** lijst met filter op ernst, status en product · detail met titel, ernst, starttijd, getroffen onderdelen, getroffen gebruikers, foutbewijs, vermoedelijke oorzaak, analyse, voorgestelde oplossing, risico, herstelplan, rollbackplan, verantwoordelijke, status, auditlog · flow `GEDETECTEERD → GEANALYSEERD → VOORSTEL → GOEDGEKEURD → UITGEVOERD → GETEST → GESLOTEN`.
**Bewijs:** sluiten zonder oorzaak én preventiemaatregel is onmogelijk · statussprong onmogelijk · elke wijziging in het auditspoor.

### F6b — Impactketen
**Bouwen:** keten dienst/infra → connector → productfunctie → gebruikersgroep → incident → herstelactie, als relaties · weergave van geraakte functies, bovengrens getroffen gebruikers, aanwezigheid van fallback, mogelijkheid tot veilige degradatie, wie geïnformeerd moet worden, welke herstelhandeling mogelijk is.
**Bewijs:** elke schakel klikbaar · onbekende gebruikersaantallen tonen `Onbekend`, geen percentage.

### F6c — Kennisitems
**Bouwen:** kennisitem met de tien verplichte velden · automatisch conceptitem bij het sluiten van elke afgeronde zaak · versiebeheer met auteur, datum en reden · koppeling zaak ↔ kennisitem in beide richtingen · herkomstproduct.
**Bewijs:** zaak sluiten zonder conceptitem lukt niet · wijziging zonder versie/auteur/datum lukt niet · gepubliceerd item is terug te voeren op een echte gesloten zaak.

**Mirror:** incident sluiten zonder oorzaak; keten volgen tot gebruikersgroep; kennisitem wijzigen zonder auteur. **Afkeur:** sluiten zonder oorzaak/preventie · keten als vrije tekst · geschat gebruikersaantal · kennisitem zonder herkomst.
**Mag niet blokkeren:** agentinfrastructuur · automatische detectie · bewaartermijnen.

---

## F7 — Product Health en Capability Matrix · kern

**Voorwaarde:** F6 `MIRROR_PROVEN`. **Splitsing:** a → b.

### F7a — Product Health
**Bouwen:** zestien indicatoren per product, elk met bron, laatste meting, trend, status en waarom · infrastructuur als eigen kolom · **geen totaalcijfer op enig niveau**.
**Bewijs:** minstens drie indicatoren aantoonbaar `Onbekend` met reden · crashpercentage, testdekking, supportdruk en actief functiegebruik staan op `Onbekend` · geen totaalcijfer in UI of API · geen schatting of handmatige waarde.

### F7b — Capability Matrix
**Bouwen:** domeinen × twaalf kolommen (ontworpen · gebouwd · getest · Mirror bewezen · live · actief gebruikt · technische schuld · open blokkades · agent mag onderzoeken · agent mag voorstellen · agent mag uitvoeren · René vereist) · zichtbare vermelding dat dit **geen roadmap** is · domeinen die niet bestaan blijven staan als `Nog niet aanwezig` · kolom *Agent mag uitvoeren* staat voor alle domeinen op `Nee`.
**Bewijs:** elke gevulde cel herleidbaar tot een bron · geen handmatig ingetypte cel zonder bron · geen score, geen rangschikking, geen datums.

**Mirror:** domeinen en kolommen tellen; vijf cellen naar hun bron volgen; zoeken naar planningstaal en scores. **Afkeur:** totaalcijfer · schatting · één `Ja` bij *Agent mag uitvoeren* · roadmaptaal · weggelaten domein of kolom.
**Mag niet blokkeren:** ontbrekende gebruiksmeting · domeinen zonder connector.

---

## F8 — Agentanalyse en voorstellen · kern

**Voorwaarde:** F7 `MIRROR_PROVEN` + `FC-B04` (vastgelegd: analist en voorstelmaker).

**Bouwen:** agenttaak met opdracht en reikwijdte · onderzoek starten · agent aan incident koppelen · analyse, voorstel en **conceptdiff** · diffweergave · goedkeuren · afwijzen met reden · pauzeren · stoppen · **productoverstijgende noodstop** · rechtenmatrix die de verbodslijst server-side afdwingt · verplichte bronvermelding met kennisitem-ID en versie · registratie van agentverbruik.
**Niet bouwen:** geen uitvoering, geen deploy, geen rollback, geen kennisitemwijziging door de agent zelf.
**Bewijs:** elk van de verboden handelingen wordt server-side geweigerd met auditregel · noodstop getest vanaf drie schermen en werkend op alle producten en op de lokale runtime · afwijzing zonder reden onmogelijk · voorstel zonder bronvermelding wordt niet aangeboden.

**Mirror:** agentaccount laat elke verboden handeling proberen; noodstop tijdens lopende taak; voorstel zonder bron; agent probeert eigen reikwijdte te verruimen. **Afkeur:** één verboden handeling slaagt · noodstop traag, onbereikbaar of beïnvloedbaar · uitvoering mogelijk · voorstel zonder bron aanvaard.
**Mag niet blokkeren:** keuze over agentleverancier · toekomstig uitvoerrechtenpakket · `FC-B08` (positie Forge).

---

## F9 — Support en releaseketen · kern

**Voorwaarde:** F8 `MIRROR_PROVEN`. **Splitsing:** a → b.

### F9a — Supportinbox (beheerderskant)
**Voorwaarde aanvullend:** `FC-B05` beantwoord.
**Bouwen:** één inbox over alle producten voor gebruikersvragen, technische fouten, synchronisatieproblemen, abonnementen, privacyverzoeken, organisatiebeheer, route- en navigatieproblemen · AI mag classificeren, documentatie zoeken, technische gegevens verzamelen, incident koppelen, conceptantwoord in begrijpelijk Nederlands schrijven · René keurt gevoelige en definitieve antwoorden goed · zaakgebonden minimale inzage met logging.
**Bewijs:** geen verzending buiten René om · elke inzage gelogd met reden · geen toegang breder dan de zaak · degradatie zichtbaar vóór het antwoord.

### F9b — Releaseketen
**Bouwen:** per product: productie-SHA · kandidaat · wijzigingen · tests · Mirror-oordeel · open blokkades · migraties · rollbackmogelijkheid · DEV/PREVIEW/PRODUCTIE · ketenstatus `BUILT → TESTED → MIRROR_PROVEN → RENE_APPROVED → DEPLOYED → LIVE_VERIFIED`.
**Bewijs:** deploy zonder `RENE_APPROVED` faalt server-side · ketenstatus niet handmatig vooruit te zetten · release zonder rollbackpad zichtbaar geblokkeerd · geen vals livebewijs.

**Mirror:** antwoord verzenden zonder goedkeuring; gegevens buiten de zaak opvragen; deploy zonder goedkeuring; ketenstatus manipuleren. **Afkeur:** één van deze slaagt.
**Mag niet blokkeren:** gebruikersgerichte AI-helpdesk in het product · openstaande abonnementsbesluiten · bewaartermijnen.

---

## F10 — Vandaag als beheerder en mobiel · kern

**Voorwaarde:** F9 `MIRROR_PROVEN`. **Splitsing:** a → b.

### F10a — Vandaag als beheerder (desktop)
**Bouwen:** twaalf kaarten in vaste volgorde, elk met samenvatting, één primaire actie, detailpagina, auditlink en laatste wijziging · per product een regel binnen elke kaart · onderscheid tussen `Geen` en `Onbekend` · infrastructuur zichtbaar in Back-ups, Nieuwe waarschuwingen en Product Health.

### F10b — Mobiele beheeromgeving
**Voorwaarde aanvullend:** `FC-B06` beantwoord.
**Bouwen:** eigen mobiel ontwerp volgens `FUTUR_CONTROL_MOBILE_DESKTOP_UX.md` · offline weigert handelingen met melding, zonder wachtrij · noodstop permanent bereikbaar en bruikbaar onder wedstrijddagomstandigheden.
**Bewijs:** **echt** mobiel bewijs op een fysiek toestel · toetsing tegen `SPARKI_MIRROR_MOBILE_TESTSTANDARD.md` (`MTS-01..69`) · geen horizontaal scrollen · geen doodlopend scherm · geen voorbeelddata.

**Mirror:** kaarten tellen en volgorde controleren op beide apparaten; auditlinks openen; lege omgeving; bron afknijpen; offline handeling. **Afkeur:** ontbrekende of verkeerd geplaatste kaart · meer dan één primaire actie · handeling in wachtrij · responsive kopie · `Geen` waar `Onbekend` hoort.
**Mag niet blokkeren:** merkbesluit (merklocaties worden gereserveerd) · nog niet aangesloten producten.

---

## F11 — Continuïteit · kern + infra

**Voorwaarde:** F10 `MIRROR_PROVEN` + `FC-B07` beantwoord. **Splitsing: A hoort bij de basisversie, B is `DEFERRED`.**

### F11A — Continuïteitsobservatie en noodvoorbereiding *(basisversie)*
**Bouwen:** continuïteitsstatus per product en per infrastructuurknoop · de scenario's uit `FUTUR_CONTROL_CONTINUITY_STANDARD.md` §4 als bewaakte toestanden · noodhandleidingen · contactpersonen · **eigen Control-read-onlymodus** · agents binnen Control stoppen · **voorstellen** voor productmaatregelen · back-up van Control zelf met hersteltest · read-only noodweergave apart gehost · noodexport zonder secrets · vaste herstelvolgorde.
**Niet bouwen:** geen enkel uitvoerend pad naar een product, dienst of apparaat; geen automatische activering op grond van afwezigheid zolang `FC-B07` dat niet toestaat.
**Bewijs:** een geslaagde hersteltest van de Control-back-up · read-only noodweergave werkt met Control uit · nooddocumentatie zonder secrets · een voorgestelde productmaatregel is aantoonbaar alleen een voorstel · alles gelogd.

### F11B — Externe noodhandelingen · **`DEFERRED`**
Betalingen pauzeren · abonnementen blokkeren · onderhoudsbericht activeren · product read-only zetten.
**Valt buiten de basisversie** en wordt niet gebouwd tot de volledige mutatiepoort `MIRROR_PROVEN` is (`F13`) en René per functie heeft vrijgegeven. Tot die tijd voert een mens deze handelingen uit, in het product zelf.

**Mirror (F11A):** Control-read-onlymodus met schrijfpoging; noodweergave met Control uit; nooddocumentatie doorzoeken op secrets; controleren dat een noodmaatregel niets buiten Control raakt. **Afkeur:** schrijfactie komt door · secret in nooddocumentatie · noodweergave in dezelfde omgeving als Control · enig extern effect vanuit een noodhandeling · een onderdeel van F11B is toch gebouwd.
**Mag niet blokkeren:** juridische bewaartermijnen (configureerbaar bouwen) · opvolgingsdocumenten · mini-server.

---

## F12 — Eindbewijs · kern + connector + infra

**Voorwaarde:** F11A `MIRROR_PROVEN`.

**Opleveren:** vaste eind-SHA · volledige testuitvoer · desktopbewijs · echt mobiel bewijs · rechtenbewijs (elke identiteit tegen elke handeling, met geweigerde pogingen) · **bewijs dat er geen schrijfpad naar buiten bestaat** · auditbewijs (een handeling uit elke fase teruggevonden) · rollbackbewijs (echte rollback uitgevoerd en teruggedraaid buiten productie) · herstelbewijs (geslaagde hersteltest van Control én van een productback-up) · connectorbewijs (Sparki op het geclaimde niveau, geen enkel schrijfrecht) · overdraagbare beheerhandleiding zonder secrets en zonder persoonsgegevens.

**Mirror:** herhaling van één scenario uit elke eerdere fase op de eind-SHA. **Afkeur:** een eerder bewezen scenario faalt opnieuw.

---

## F13 — Uitvoeringsketen bewijzen · vrijgavepoort

**Voorwaarde:** F12 `MIRROR_PROVEN` + `FC-B11` beantwoord (wat zijn Guardian en Governor).
**Doel:** aantonen dat één muterende functie van opdracht tot en met teruggedraaide wijziging als één geheel bewijsbaar is — vóórdat er ooit iets muteert.

**Aanpak:** de keten wordt bewezen op een **oefenobject buiten productie**. De rollback wordt **werkelijk uitgevoerd, buiten productie**. Pas wanneer dat `MIRROR_PROVEN` is en René heeft vrijgegeven, wordt per externe muterende functie een eigen fase geopend in een **afzonderlijke bouwreeks** — niet binnen F0..F12.

**Opleveren — alle twaalf op één vaste commit-SHA:** oorspronkelijke opdracht · voorgestelde wijziging · daadwerkelijke codewijziging · tests met exitcodes · Guardian-beoordeling · Governor-vrijgave · gegenereerd artifact · rollbackplan · uitgevoerd rollbackbewijs · herstel naar de juiste eindtoestand · volledig auditspoor · de SHA waarop dit alles aantoonbaar bij elkaar hoort.

**Mirror:** de negen controles `MUT-07..15`. **Afkeur:** elk van de veertien gronden in `FUTUR_CONTROL_MUTATION_GATE.md` §9.
**Na `MIRROR_PROVEN`:** expliciete vrijgave door René blijft verplicht, per functie — niet per categorie.
**Mag niet blokkeren:** alles wat niet-muterend is; F0..F12 zijn zonder deze fase volledig bruikbaar.

---

# DEEL 2 — MIRROR PER FASE

Zie per fase hierboven, plus de algemene toetsen `FCM-A..` in `FUTUR_CONTROL_MIRROR_TESTSTANDARD.md` en `IMT-01..` in `FUTUR_CONTROL_INFRASTRUCTURE_MIRROR_TESTSTANDARD.md`. Mirror toetst uitsluitend op een vaste gepushte SHA en neemt geen bewering van Replit over zonder eigen waarneming.

# DEEL 3 — AFHANKELIJKHEDEN

| Fase | Verplicht `MIRROR_PROVEN` | Extra besluit | Mag niet blokkeren |
|---|---|---|---|
| F0 | — | — | alle openstaande productvragen |
| F1A | F0 | vastgelegd besluit op het overlapvoorstel (FC-B01 = C) | ontbrekende monitoring · niet-aangesloten producten |
| F1B | F1A | — | bewaartermijnen |
| F1C | F1B | — | bewaartermijnen · rapportsjablonen |
| F3a/b/c | F1C | — | ontbrekende connectors · onbekende leveranciers · mini-server |
| F4a/b | F3 | — | lopende Sparki-bouwpakketten |
| F5a/b/c | F4 | — | diensten die `Onbekend` bleven · ontbrekende sensoren |
| F6a/b/c | F5 | — | agentinfrastructuur · automatische detectie |
| F7a/b | F6 | — | ontbrekende gebruiksmeting |
| F8 | F7 | FC-B04 (vastgelegd) | agentleverancier · toekomstig uitvoerpakket |
| F9a | F8 | FC-B05 | product-AI-helpdesk · abonnementsbesluiten |
| F9b | F9a | — | lopende releases van producten |
| F10a | F9 | — | merkbesluit |
| F10b | F10a | FC-B06 | merkbesluit · niet-aangesloten producten |
| F11A | F10 | FC-B07 | bewaartermijnen · mini-server |
| F11B | **`DEFERRED`** — pas na F13 en vrijgave per functie | — | — |
| F12 | F11A | — | alles buiten Futur Control |
| F13 | F12 | FC-B11 (Guardian/Governor) | alles wat read-only is |

# DEEL 4 — HERSTELPROTOCOL

**Grondregel:** een fout in een fase blijft in die fase. Een eerder bewezen fase wordt niet heropend, tenzij Mirror aantoont dat de oorzaak daar ligt.

1. Mirror levert per bevinding: scenario · waarneming · verwachte uitkomst · ernst (`blokkerend` / `herstel vóór volgende fase` / `restpunt`).
2. Replit herstelt uitsluitend de blokkerende bevindingen, binnen dezelfde fase, zonder nieuwe scope.
3. Herbewijs is volledig, koud en warm — niet gedeeltelijk.
4. Restpunten worden genummerd meegenomen en blokkeren de volgende fase niet, tenzij René dat besluit.
5. Blijft een fase na twee herstelrondes afgekeurd, dan stopt de reeks en gaat de fase terug naar `OPEN` met een oorzaakanalyse. Geen derde poging.

**Fout die later blijkt:** de veroorzakende fase gaat naar `PARTIAL`; latere fasen behouden hun status met de markering *afhankelijk van herstel in Fx*. Niets wordt stilzwijgend gerepareerd.
**Productstoring tijdens de bouw:** Control-werk pauzeert, het productie-incident gaat voor, de pauze staat in de dagkaart.
**Rollback:** elke fase met opslag levert een migratie met terugweg; zonder terugweg geen vrijgave.
**Infrastructuurfout:** een fout in NAS of mini-server tijdens een fase wordt behandeld als productstoring, niet als bouwfout — tenzij zij door de fase is veroorzaakt.

# DEEL 5 — SYNCHRONISATIEPATCH

Bij vrijgave van dit pakket en opnieuw na elke `MIRROR_PROVEN`-fase. **Het Master Plan wordt niet bijgewerkt.**

| Document | Wat erin komt |
|---|---|
| **Afbouwmatrix** | Nieuw domein `FUTUR_CONTROL_01` met alle fasen en subfasen (F0 · F1A/B/C · F3a/b/c · F4a/b · F5a/b/c · F6a/b/c · F7a/b · F8 · F9a/b · F10a/b · F11A · F11B `DEFERRED` · F12 · F13), elk met eigen status; `SPARKI_CONTROL_CONNECTOR_01` als eigen regel |
| **Dagkaart** | Regel per vrijgave, per oplevering en per Mirror-oordeel, met SHA |
| **Releasestatus** | Futur Control is **niet** blokkerend voor de besloten Sparki-pilot, **wel** voor de betaalde publieke release (geen publieke betaalde release zonder werkende incident-, support- en continuïteitsbewaking) |
| **Roadmap** | Control-reeks naast de lopende Sparki-domeinpakketten, met de notitie dat F0 geen code oplevert |
| **Besluitregister** | Genomen besluiten `FC-B01 = C` · `FC-B02` · `FC-B03 = A` · `FC-B04 = B` · `FC-B08 = C` · `FC-B12` (F11-splitsing) · `FC-B13` (geen Control-commando bij ransomware); nog open `FC-B05`, `FC-B06`, `FC-B07`, `FC-B09`, `FC-B10`, `FC-B11`. Definitieve `SPARKI-BESLUIT`-nummers pas ná het opschonen van de nummerreeks |
| **Capability Matrix** | Zodra F7b leeft: na elke `MIRROR_PROVEN`-fase van elk domein wordt de betreffende rij bijgewerkt |
| **`REPORT_DESIGN_STANDARD_01`** | Toevoegen: auditexport · incidentrapport · releaserapport · continuïteitsrapport · capability-matrixuitdraai · product-healthrapport · infrastructuurrapport · noodexport |
| **`MOBILE_UX_STANDARD_01`** | Geen wijziging. Control volgt de standaard; de rol Admin heeft daar al de eerste mobiele prioriteit `Systeemstatus` |
| **`SPARKI_CONTROL_01_BOUWPAKKET v1.1`** | Blijft bestaan als bronpakket met verwijzing naar de vertaaltabel. **Niet intrekken zonder expliciet besluit** (`FC-B01`) |
