# SPARKI APPLICATIE-AUDIT — Kwaliteitsprogramma Fase 1

Datum: 29 juli 2026 · Status: inventarisatie afgerond, geen codewijzigingen uitgevoerd.

## 1. Aanpak
- Statische code-audit per module over de web-app (`artifacts/sparki`), de API-server (`artifacts/api-server`) en de mobiele app (`artifacts/sparki-mobile`), uitgevoerd door parallelle alleen-lezen inspecties per modulecluster plus een app-brede technische sweep (mockdata, dode code, dubbele routes, silent catches, limits).
- Live-signalen meegenomen uit server-, browser- en deploymentlogs van vandaag (o.a. een echte productie-achtige fout in de Strava-koppeling).
- Als contrastmateriaal: de volledige bestaande testbatterij draaide vandaag groen (o.a. cross-account-isolatie 19/19, ouderomgeving, coach/parent-suites, sessies/ingest, admin-smoke 12/12, typechecks). De bevindingen hieronder zijn dus vooral zaken die **buiten** de bestaande testdekking vallen.
- Elke bevinding staat met uniek ID, module, scherm, ernst (P1–P4), oorzaak, aanbevolen oplossing, hergebruik en regressietest-noodzaak in `docs/SPARKI_BUG_REGISTER.csv` (gesorteerd op ernst).

Ernst: **P1** blokkerend · **P2** ernstig · **P3** normaal · **P4** cosmetisch.

## 2. Totaalbeeld

| Ernst | Aantal |
|---|---|
| P1 | 4 |
| P2 | 36 |
| P3 | 62 |
| P4 | 26 |
| **Totaal** | **128** |

Per module:

| Module | Bevindingen | P1 | P2 |
|---|---|---|---|
| LOGIN | 4 | 0 | 3 |
| VANDAAG | 13 | 1 | 4 |
| PLAN | 7 | 1 | 4 |
| ANALYSE | 5 | 0 | 1 |
| ACTIVITEITEN | 3 | 0 | 0 |
| RIJDEN | 18 | 1 | 5 |
| ROUTES | 11 | 0 | 3 |
| COACH | 15 | 0 | 4 |
| CLUB | 9 | 0 | 4 |
| PROFIEL | 11 | 0 | 3 |
| INSTELLINGEN | 7 | 1 | 2 |
| ADMIN | 6 | 0 | 2 |
| TECHNIEK | 19 | 0 | 1 |

## 3. Bevindingen per module (samenvatting)

### LOGIN (4)
- **SPARKI-LOG-001** (P2, Onboarding): De `OnboardingV2` component (onboarding-v2.tsx:136) herstelt de state uit `sessionStorage`, maar als een gebruiker de onboarding verlaat en later terugkomt via een andere tab, kan hij in een inconsistente staat belanden omdat de database nog niet op 'complete' staat maar de `sessionStorage` leeg is.
- **SPARKI-LOG-002** (P2, Onboarding): In `api-server/src/routes/athlete.ts:200` wordt de lengte gevalideerd tussen 100 en 250 cm. Sporters buiten deze range (bijv. zeer jonge talenten of uitzonderlijk lange mensen) kunnen hun profiel niet opslaan zonder duidelijke foutmelding in de UI (het wordt stilzwijgend genegeerd en blijft `undefined`).
- **SPARKI-LOG-003** (P2, Onboarding): Nieuwe gebruikers kunnen in een lus komen of de app niet in als provisioning (sync) faalt; 'AccountNotReady' blokkeert toegang tot de app zonder user_profile. (artifacts/sparki/src/App.tsx:212)
- **SPARKI-LOG-004** (P4, Clerk): Cosmetisch: Logo-URL in Clerk-appearance gebruikt window.location.origin, wat problemen geeft bij redirects vanaf andere subdomains/proxy's. (artifacts/sparki/src/App.tsx:144)

### VANDAAG (13)
- **SPARKI-VAN-001** (P1, Emergency): Blokkerend: 'Ik ben weer hersteld' knop voert triggerPlanRefresh uit op server, maar frontend UI-state (DayType) hangt af van dashboard-invalidate die soms te vroeg vuurt. (artifacts/api-server/src/routes/athlete.ts:414)
- **SPARKI-VAN-002** (P2, Home): De "HealthMomentBlock" (day-home.tsx:139) toont een harde waarschuwing bij ziekte/blessure, maar de knop "Ik ben weer hersteld" voert een mutatie uit zonder de lokale cache van `useAthleteDashboard` direct bij te werken (alleen de API wordt aangeroepen), wat kan leiden tot een trage UI-update (optimistic update ontbreekt).
- **SPARKI-VAN-003** (P2, Vandaag): In `day-home.tsx:246` wordt de weer-sectie getoond op basis van `weatherAllowed(leadMoment)`. De `leadMoment` wordt berekend op basis van client-side vlaggen. Als de API voor het dashboard faalt, kan de app in een 'loading' state blijven hangen zonder duidelijke error-state voor de gebruiker buiten de StateCard.
- **SPARKI-VAN-004** (P2, Home): Data-trust risico: Weather-module toont fallback/mock data als herkenbaar echte data ('onbekend' of 'geen data' ontbreekt in weergave). (artifacts/sparki/src/components/sparki/home-weather-row.tsx)
- **SPARKI-VAN-005** (P2, Home): Mobiel vs Desktop layout: BottomNav is fixed op mobiel, maar ScreenShell op desktop mist soms consistente zijbalk-sync voor alle hoofdstukken. (artifacts/sparki/src/components/sparki/bottom-nav.tsx:62)
- **SPARKI-VAN-006** (P3, Home): De "StateCard" (gebruikt op home) toont een begroeting op basis van de lokale tijd van de browser, maar de logica in `greeting()` (state-card.tsx:76) houdt geen rekening met tijdzones als de server-tijd zou afwijken (hoewel client-side uitgevoerd).
- **SPARKI-VAN-007** (P3, Home): In `StateDayHome` (day-home.tsx:195) wordt bij een `focus === "nutrition"` deep-link de view omgezet naar `voedingOpen`, maar de URL wordt direct vervangen door `/`. Dit verbreekt de browser 'back' knop functionaliteit voor gebruikers die via een link kwamen.
- **SPARKI-VAN-008** (P3, Momentblok): N+1 query risico bij het laden van dashboard-data (vandaagWorkout, vandaagMetrics, allSessions, load) in één request. (artifacts/api-server/src/routes/athlete.ts:436)
- **SPARKI-VAN-009** (P3, Training): Ontbrekende handler: 'Route, weer & beste vertrektijd' in Sparki-uitleg-blok is hardcoded tekst zonder werkende link of data. (artifacts/sparki/src/components/sparki/training-day-home.tsx:207)
- **SPARKI-VAN-010** (P3, AddTraining): Onlogische flow: Datumkeuze in LogSessionForm staat 'gisteren' toe bij inplannen, en 'morgen' bij loggen via contextDate. (artifacts/sparki/src/components/sparki/add-training.tsx:341)
- **SPARKI-VAN-011** (P3, Training): Data-expositie: Sparkline voor fitheid (CTL) toont lege staat ('Log sessies...') ipv empty-state component met call-to-action. (artifacts/sparki/src/components/sparki/training-day-home.tsx:537)
- **SPARKI-VAN-012** (P3, Home): Performance: Strava-sync wordt bij ELKE dashboard-load getriggerd (void schedule) wat onnodige server-load geeft. (artifacts/api-server/src/routes/athlete.ts:444)
- **SPARKI-VAN-013** (P3, Home): Foutafhandeling: 'AccountNotReady' retry-knop voert refetch() uit, maar herstelt niet van netwerk-timeout in Clerk-SDK zelf. (artifacts/sparki/src/App.tsx:233)

### PLAN (7)
- **SPARKI-PLA-001** (P1, DayHome): Mogelijkheid tot 'blank crash' bij ongeregistreerd DayType (day-home.tsx:492)
- **SPARKI-PLA-002** (P2, PlanWizard): Gebruiker kan de wizard voltooien zonder trainingsdagen te selecteren als ze stap overslaan (plan-wizard.tsx:123)
- **SPARKI-PLA-003** (P2, TrainingPlanPanel): Geen foutmelding of alternatief als thuislocatie ontbreekt bij route-generatie (training-plan-panel.tsx:430)
- **SPARKI-PLA-004** (P2, AddTraining): Geen validatie op toekomstige datum bij 'Training inplannen' (add-training.tsx:341)
- **SPARKI-PLA-005** (P2, GeneralDayHome): Onboarding-flow voor nieuwe sporters mist diepe integratie (general-day-home.tsx:70)
- **SPARKI-PLA-006** (P3, PlanWizard): Onlogische flow: agenda-items moeten persist zijn voordat plan wordt gebouwd, maar formulier suggereert dat 'Periode toevoegen' optioneel is in de wizard (plan-wizard.tsx:175)
- **SPARKI-PLA-007** (P4, TrainingPlanPanel): Datum-labels gebruiken browser-locale in plaats van vaste app-taal (training-plan-panel.tsx:177)

### ANALYSE (5)
- **SPARKI-ANA-001** (P2, InsightsSection): Lege 'Wat vandaag opvalt' sectie zonder actie bij geen data (insights-section.tsx:49)
- **SPARKI-ANA-002** (P3, SessionGraphs): Geen 'empty-state' voor ontbrekende hartslag/vermogen zones, toont lege ChartFrame (session-graphs.tsx:261)
- **SPARKI-ANA-003** (P3, SessionGraphs): Zone-verdeling op basis van schatting wordt alleen in kleine letters genoemd (session-graphs.tsx:271)
- **SPARKI-ANA-004** (P3, SessionGraphs): Vergelijking met vorige rit kan onterecht resultaten tonen bij minimale overlap (session-graphs.tsx:42)
- **SPARKI-ANA-005** (P3, WattageLab): Hardcoded FTP-ranges in uitleg kunnen afwijken van berekende zones (wattage-lab.tsx)

### ACTIVITEITEN (3)
- **SPARKI-ACT-001** (P3, RouteLibrary): Geen bevestiging bij verwijderen van route die in wedstrijden wordt gebruikt (route-library.tsx:512)
- **SPARKI-ACT-002** (P3, RouteLibrary): Menu 'Zichtbaarheid' (Openbaar) geeft geen indicatie van huidige staat in het menu zelf (route-library.tsx:440)
- **SPARKI-ACT-003** (P4, RouteDiscover): Kaartstijl (Voyager) wijkt af van de rest van de app (dark-mode) (route-discover.tsx:53)

### RIJDEN (18)
- **SPARKI-RIJ-001** (P1, Live Navigatie): Locatieverlies tijdens rit pauzeert navigatie (reeds hersteld in Taak #404) maar hervatting niet geautomatiseerd getest
- **SPARKI-RIJ-002** (P2, Ritregistratie): Locatiepermissie-uitleg blokkeert rit-start maar systeemdialoog kan alsnog geweigerd worden
- **SPARKI-RIJ-003** (P2, Ritregistratie): Crash-recovery (onSaveRecovered) wist recovery store pas na succesvolle save, maar cancel wist points-state
- **SPARKI-RIJ-004** (P2, Mobiel): Navigation-backwards flow (goBack) gebruikt hardcoded router.replace("/") bij lege stack
- **SPARKI-RIJ-005** (P2, navigate/[id].tsx): Gebruiker kan navigatie verlaten zonder actieve rit te stoppen; app-badge (setRideActive) en actieve navigatie (saveActiveNav) blijven in de achtergrond draaien zonder dat de gebruiker dit ziet of eenvoudig kan stoppen bij terugkomst.
- **SPARKI-RIJ-006** (P2, useRideRecorder.ts): Dataverlies bij crash: de gereden rit wordt in de voorgrond (web/geen permissie) wel naar disk geschreven (persistForegroundRide), maar bij een herstart op de mobiele app (index.tsx) wordt de actieve navigatie hersteld ZONDER de gereden punten, waardoor de gebruiker de rit niet kan afmaken met behoud van de eerdere track.
- **SPARKI-RIJ-007** (P3, Ritregistratie): Voedingstik-tellers worden na opslaan direct gereset; bij mislukte POST naar /api/nutrition zijn tikken weg
- **SPARKI-RIJ-008** (P3, Navigatie): MeldNavigatieStart faalt stil bij netwerkfout, backend mist gebruiksdata
- **SPARKI-RIJ-009** (P3, Ritregistratie): Automatisch rit-einde (autoEnded) in record.tsx:158 kan abusievelijk belangrijke data afknippen
- **SPARKI-RIJ-010** (P3, Ritregistratie): Gezondheidswaarschuwing (sick/injured) wordt genegeerd na ophalen
- **SPARKI-RIJ-011** (P3, Sensors): Bluetooth sensor-samples (stoppedSamples) kunnen leeg zijn bij recovery
- **SPARKI-RIJ-012** (P3, Ritregistratie): Tijd-snapshot (logDate) in record.tsx:242 gebruikt lokale tijd, risico op verkeerde dag bij middernacht-ritten
- **SPARKI-RIJ-013** (P3, navigate/[id].tsx): Onlogische flow: bij het stoppen van een rit wordt direct saveRide.mutateAsync aangeroepen (regel 1358) voordat de gebruiker de kans krijgt om de rit te beoordelen of de naam te wijzigen (wat wel kan bij recovered rides). Dit leidt tot "Naamloze route" of hardcoded routenamen in de activiteitslijst.
- **SPARKI-RIJ-014** (P3, useRideRecorder.ts): Sensordata wordt alleen gelogd als het scherm aan staat (JS timer in useEffect, regel 282), terwijl de GPS-track in de native achtergrond doorloopt. Dit creëert grote "gaten" in vermogens- en hartslagdata bij ritten met de telefoon in de achterzak, wat de trainingsanalyse onbetrouwbaar maakt.
- **SPARKI-RIJ-015** (P3, navigate/[id].tsx): Wanneer de gebruiker de kaart handmatig verschuift (onUserPan), stopt de navigatie met volgen (following = false, regel 766). Er is echter geen duidelijke "recenter" knop in de UI om het volgen weer te activeren; de gebruiker moet de "Navigeer" knop onderin vinden (regel 1238) die niet als "recenter" oogt.
- **SPARKI-RIJ-016** (P4, Ritoverzicht): Datumformattering in RideDetailScreen gebruikt lokale systeemtijd ipv rit-tijdzone
- **SPARKI-RIJ-017** (P4, Ritdetail): Delen van rit-afbeelding faalt stil op Web
- **SPARKI-RIJ-018** (P4, Mobiel): Inconsistent gebruik van Lucide (web) vs Ionicons (mobiel) in navigatie-iconen

### ROUTES (11)
- **SPARKI-ROU-001** (P2, Routeplanner): GPX-import accepteert 'surface' van client zonder validatie tegen schema
- **SPARKI-ROU-002** (P2, routes.ts): Data-trust: Bij GPX-import via de API (routes.ts:3365) wordt de distance_km en elevation_gain_m direct uit de GPX-parser overgenomen, maar de parser (gpx-parse.ts:188) rondt de afstand af met Math.round(distanceKm * 100) / 100. Dit kan leiden tot kleine discrepanties tussen de opgetelde punten in de geometry en de opgeslagen afstand in de database.
- **SPARKI-ROU-003** (P2, routes.ts): N+1 Query in openbare route-ontdekking: In de /api/routes/ontdek route (routes.ts:932) wordt per unieke eigenaar (max 100) een aparte query uitgevoerd naar isMinorAthlete en ownerHome (regels 971-987), wat de response-tijd van de ontdek-pagina ernstig vertraagt bij veel verschillende auteurs.
- **SPARKI-ROU-004** (P3, Routebibliotheek): Ontbrekende 'Navigeer' knop bij route-details (reeds gemeld als Taak #25)
- **SPARKI-ROU-005** (P3, Routeplanner): RejoinRoute faalt zonder duidelijke fallback-instructie voor de renner
- **SPARKI-ROU-006** (P3, route-panel.tsx): Slechte foutafhandeling: Bij een mislukte GPX-upload (regel 3169) wordt alleen een generieke melding "Route kon niet worden verwerkt" getoond, ongeacht of de fout lag aan een corrupte GPX, een serverfout (500), of een validatiefout (422 - geen trackpunten).
- **SPARKI-ROU-007** (P3, routes.ts): Toegankelijkheid/Privacy: De /api/routes/bibliotheek route (regel 1108) controleert geen eigenaarschap of autorisatie op de individuele routes (gebruikt routesInBbox), terwijl de web-UI suggereert dat dit persoonlijke of startset-routes zijn. Hoewel dit startset-data is, ontbreekt een duidelijke check of de opvrager in die regio "mag" kijken.
- **SPARKI-ROU-008** (P4, Routeoverzicht): N+1 risico in routes.ts:143 door ontbrekende joins voor statistieken
- **SPARKI-ROU-009** (P4, Routebibliotheek): Zoekregister (zoekregister.ts) is case-sensitive of mist accent-insensitivity
- **SPARKI-ROU-010** (P4, route-library.tsx): Cosmetisch: De "Verwijderen" actie (regel 516) gebruikt een browser window.confirm(). Dit wijkt af van de rest van de Sparki-designtaal die gebruik maakt van Radix/custom modals.
- **SPARKI-ROU-011** (P4, route-panel.tsx): Geen empty-state: Wanneer een gebruiker geen bewaarde routes heeft en op "Bewaarde routes" klikt (regel 3218), gebeurt er niets (de lijst wordt niet getoond omdat routes.length > 0 is). De gebruiker krijgt geen feedback dat de lijst leeg is.

### COACH (15)
- **SPARKI-COA-001** (P2, COACH-COCKPIT): Individuele cockpit en data-inzage zijn strikt fail-closed op hasDirectCoachLink (artifacts/api-server/src/routes/coach-cockpit.ts:70), waardoor club-trainers zonder directe link GEEN individuele signalen, trainingen of berichten kunnen zien, ondanks dat ze wel verantwoordelijk zijn voor de sporter in een teamcontext.
- **SPARKI-COA-002** (P2, coach-cockpit.tsx:702): Privénotities tonen een generieke foutmelding ("niet beschikbaar") bij isError, terwijl dit ook door een tijdelijke API-storing kan komen ipv een ontbrekende koppeling.
- **SPARKI-COA-003** (P2, coach-cockpit.ts:288): API forceert een verplichte notitie bij 'parkeren', terwijl dit in de UI vaak als een snelle 'later-doen' actie wordt gezien.
- **SPARKI-COA-004** (P2, coach-cockpit.ts:518): Cross-coach isolatie staat bewerking toe door elke coach als coachClerkId NULL is (legacy); dit kan leiden tot data-overschrijving tussen concurrerende coaches.
- **SPARKI-COA-005** (P3, COACH-COCKPIT): Sparki-wijzigingsvoorstellen op coachtrainingen kunnen door de coach geaccepteerd of afgewezen worden, maar de 'aanpassen' optie in de UI (artifacts/sparki/src/pages/coach-cockpit.tsx:137) heeft geen specifieke handler die afwijkt van de standaard signal action, wat verwarrend kan zijn voor de coach.
- **SPARKI-COA-006** (P3, COACH-COCKPIT): De planning-sectie toont Sparki-trainingen als read-only (artifacts/sparki/src/pages/coach-cockpit.tsx:300), maar de coach kan deze niet 'overnemen' of 'adopteren' naar een coachtraining om deze zelf te beheren, wat een veelvoorkomende workflow is.
- **SPARKI-COA-007** (P3, coach-cockpit.tsx:126): Besluitknoppen op signalen (Overnemen/Aanpassen/Afwijzen/Parkeren) missen een visuele "active" state voor het huidige besluit; alleen de label-chip bovenaan verraadt de status.
- **SPARKI-COA-008** (P3, coach-cockpit.ts:412): Handmatige invoer van targetDurationMin > 1440 (24u) geeft 400 error; hoewel logisch voor 1 sessie, is de foutmelding generiek.
- **SPARKI-COA-009** (P3, coach-cockpit.tsx:521): Berichtenlijst in de cockpit gebruikt hardcoded 'mine' check op athleteId; dit breekt als een sporter meerdere coaches heeft en zij elkaars berichten zouden zien (indien toegestaan).
- **SPARKI-COA-010** (P3, coach-cockpit.tsx:123): Bronnen van een signaal worden getoond als rauwe strings; als een bronnaam wijzigt in de backend of spaties bevat, oogt het slordig.
- **SPARKI-COA-011** (P3, coach-cockpit.ts:639): Bij herhalen van trainingen (repeat) wordt de raceId in structure simpelweg gekopieerd; als de race inmiddels voorbij is op de nieuwe datum, is de data inconsistent.
- **SPARKI-COA-012** (P4, COACH-COCKPIT): De 'lastReviewedAt' datum wordt bijgehouden op de link (artifacts/api-server/src/routes/coach-cockpit.ts:331), maar in de cockpit-UI (artifacts/sparki/src/pages/coach-cockpit.tsx) is er geen visuele indicatie of knop om deze beoordeling direct te markeren zonder een signaalactie.
- **SPARKI-COA-013** (P4, coach-cockpit.tsx:213): Workout-datumkiezer in het formulier gebruikt de standaard browser-styling die vloekt met het premium dark-theme van de cockpit.
- **SPARKI-COA-014** (P4, coach-cockpit.tsx:236): Numerieke inputs (Duur/Belasting) strippen niet-cijfers via regex, maar tonen geen foutmelding als de gebruiker letters probeert te typen.
- **SPARKI-COA-015** (P4, coach-cockpit.tsx:640): EndDate tooltip ("Geldig tot (optioneel)") op de context-input is niet toegankelijk voor keyboard-only gebruikers.

### CLUB (9)
- **SPARKI-CLU-001** (P2, CLUB-BEHEER): Een club-owner kan de status van de club wijzigen naar 'beperkt', 'geschorst' of 'beëindigd' (artifacts/sparki/src/pages/club-beheer.tsx:133), maar de backend (artifacts/api-server/src/routes/club.ts) controleert deze status NIET consistent bij schrijfacties zoals het plannen van trainingen of het versturen van berichten.
- **SPARKI-CLU-002** (P2, club-beheer.tsx:558): Uitschrijven van leden gebruikt window.confirm, wat op mobiel een storende browser-native popup geeft ipv een consistente UI-modal.
- **SPARKI-CLU-003** (P2, club-permissions.ts:311): isMinorForClub faalt 'closed' (true) als het profiel ontbreekt, wat correct is voor privacy, maar geen audit-log genereert van deze toegangsweigering.
- **SPARKI-CLU-004** (P2, club.ts:183): countActive telt alle leden; als een pakketlimiet wordt bereikt, kunnen ook 'alleen-lezen' rollen niet meer worden toegevoegd, wat operationeel belemmerend is.
- **SPARKI-CLU-005** (P3, CLUB-BEHEER): Bij het uitnodigen van nieuwe leden (artifacts/sparki/src/pages/club-beheer.tsx:282) is het e-mailveld optioneel. Als dit leeg blijft, wordt een token-link gegenereerd die door iedereen gebruikt kan worden, wat een risico vormt voor ongewenste aanmeldingen bij publieke verspreiding.
- **SPARKI-CLU-006** (P3, CLUB-BEHEER): Bij het aanmaken van seizoenen (artifacts/api-server/src/routes/club.ts:908) is er geen controle op overlappende data of dubbele namen, wat kan leiden tot verwarring in de kalender en bij teamtoewijzingen.
- **SPARKI-CLU-007** (P3, club-beheer.tsx:197): Kopieerknop voor clubcode geeft geen visuele bevestiging (vinkje/toast) na het klikken; gebruiker weet niet of het gelukt is.
- **SPARKI-CLU-008** (P3, club.ts:400): API ondersteunt maxParticipants voor clubtrainingen, maar de club-beheer UI (regel 382) toont nergens hoeveel mensen zich al hebben aangemeld bij het inplannen.
- **SPARKI-CLU-009** (P4, CLUB-BEHEER): De locaties-sectie (artifacts/sparki/src/pages/club-beheer.tsx:223) toont geen foutmeldingen van de server als het toevoegen van een locatie mislukt door netwerkfouten, alleen lokale validatie op lege naam.

### PROFIEL (11)
- **SPARKI-PRO-001** (P2, Instellingen): In `TeamIdentitySection` (profile-settings.tsx:140) worden foutmeldingen bij logo-uploads (zoals `logoError`) getoond, maar er is geen toegankelijkheids-announcement (aria-live) voor deze fouten, waardoor ze gemist kunnen worden door screenreaders.
- **SPARKI-PRO-002** (P2, Sportpaspoort): Data-privacy: Export-functie bevat gevoelige velden (gezondheid, locatie) die handmatig uitgezet moeten worden; default is 'aan' voor historie/ontwikkeling. (artifacts/sparki/src/components/sparki/sport-passport.tsx:64)
- **SPARKI-PRO-003** (P2, You): Owner-check: ownsObservation filtert client-side op 'you' categorie; API stuurt alle observaties ongefilterd mee. (artifacts/sparki/src/pages/you.tsx:413)
- **SPARKI-PRO-004** (P3, You): Op de `/you` pagina wordt in `useEffect` (you.tsx:344) een interval van 250ms gebruikt om te scrollen naar een sectie tot de layout stabiel is. Dit kan leiden tot "jank" en onnodige CPU belasting op mobiele apparaten.
- **SPARKI-PRO-005** (P3, Instellingen): De `CheckInForm` (profile-settings.tsx:668) valideert de HRV-input (`min={20}, max={250}`) alleen in de HTML-attributen, niet in de `handleSave` functie. Handmatige invoer via de console of oude browsers kan ongeldige data versturen.
- **SPARKI-PRO-006** (P3, Instellingen): Bij het wijzigen van het humorniveau (profile-settings.tsx:413) wordt `update.mutate` direct aangeroepen bij elke klik op een knop. Er is geen 'Save' knop, wat kan leiden tot veel onnodige API calls als een gebruiker twijfelt.
- **SPARKI-PRO-007** (P3, You): De `useAthleteExtendedProfile` hook (use-athlete-extended-profile.ts:14) is enabled als `isSignedIn === true
- **SPARKI-PRO-008** (P3, Sportpaspoort): Data-trust: 'Berekend' en 'Geschat' waarden in paspoort hebben identieke visuele weging als 'Gemeten' (alleen kleurverschil in chip). (artifacts/sparki/src/components/sparki/sport-passport.tsx:30)
- **SPARKI-PRO-009** (P4, You): De `identity.facts` op de `/you` pagina (you.tsx:564) hebben een vaste breedte `flex-1` zonder wrapping, wat op zeer smalle schermen (bijv. iPhone SE) tekstoverlap kan veroorzaken.
- **SPARKI-PRO-010** (P4, You): De `/you` pagina gebruikt `HoofdstukTabs` (you.tsx:522) met een `variant="donker"`. Andere schermen in de app lijken een andere tab-stijl te gebruiken (gebaseerd op `ui/tabs.tsx`), wat zorgt voor een inconsistente visuele ervaring.
- **SPARKI-PRO-011** (P4, You): Cosmetisch: Tab-switching (?tab=) en focus (?focus=) veroorzaken 2.5s jitter door re-scrolling logic om async content te vangen. (artifacts/sparki/src/pages/you.tsx:347)

### INSTELLINGEN (7)
- **SPARKI-INS-001** (P1, Koppelingen (Strava)): Strava koppelen faalt hard: OAuth-callback gooit 'SPARKI_TOKEN_KEY ontbreekt: gevoelige tokens kunnen niet veilig worden opgeslagen' (routes/connectors.ts:548 via lib/token-crypto.ts:42). Gezien in deployment-logs 2026-07-29.
- **SPARKI-INS-002** (P2, Privacy): De `ParentShareRow` (links-section.tsx:94) past harde privacy-regels toe voor minderjarigen (onder 16), maar de `tier` (u16/adult) wordt uitsluitend uit de initiële `access` prop gelezen die niet reactief lijkt op wijzigingen in het profiel (geboortedatum) zonder een volledige refresh.
- **SPARKI-INS-003** (P2, Privacy): Privacy-lek: Deel-instellingen voor ouders/coaches en profielprivacy-grid zijn gescheiden; wijziging in de een werkt niet door in de ander. (artifacts/sparki/src/components/sparki/profile-privacy-grid.tsx:54)
- **SPARKI-INS-004** (P3, Koppelingen): De `handleRevoke` functie (links-section.tsx:206) toont een melding als een koppeling al verwijderd was, maar gebruikt daarvoor een generieke `setNotice`. De gebruiker krijgt geen visuele feedback welke rij precies mislukte als er meerdere in afwachting waren.
- **SPARKI-INS-005** (P3, Links): Silent catch / Gebrekkige foutafhandeling: Bij mislukken van revoke-link wordt een amber-alert getoond ipv een harde error of retry. (artifacts/sparki/src/components/sparki/links-section.tsx:214)
- **SPARKI-INS-006** (P3, Privacy): Toegankelijkheid: Form-elementen (select) in PrivacyGrid hebben kleine touch-targets (py-1.5) en missen duidelijke labels voor screenreaders. (artifacts/sparki/src/components/sparki/profile-privacy-grid.tsx:71)
- **SPARKI-INS-007** (P3, Links): Toegankelijkheid: 'Koppeling verwijderen' knop (X) heeft kleine hitbox (h-8 w-8) en lage kleurcontrast (white/35). (artifacts/sparki/src/components/sparki/links-section.tsx:174)

### ADMIN (6)
- **SPARKI-ADM-001** (P2, ADMIN-OPS): De 'ProvenanceSection' (artifacts/sparki/src/pages/admin.tsx:238) staat toe om elk willekeurig clerkId in te vullen om dataherkomst te controleren. Hoewel gegated door requireAdmin, is er geen audit-log van WELKE sporter wordt gecontroleerd, wat privacygevoelig is voor beheerders.
- **SPARKI-ADM-002** (P2, admin.tsx:603): Gegevens-opschoning 'Uitvoeren' knop is direct klikbaar na een droogdraai zonder expliciete extra waarschuwing dat dit onomkeerbaar is (behalve de native confirm).
- **SPARKI-ADM-003** (P3, HEALTH): Health checks kunnen handmatig worden gestart (artifacts/api-server/src/routes/admin.ts:246), maar er is geen rate-limit op deze zware operatie, waardoor een admin per ongeluk de server kan overbelasten door herhaaldelijk op 'Run' te klikken.
- **SPARKI-ADM-004** (P3, admin.tsx:279): Admin Provenance clerkId input mist validatie op het format vóór verzenden; lege strings of ongeldige karakters leiden tot onnodige 404/500 API calls.
- **SPARKI-ADM-005** (P4, admin.tsx:442): Datasets per bron lijst in Data Trust dashboard gebruikt hardcoded 'green/red' uit STATUS_META; bij theme-wijzigingen kan het contrast wegvallen.
- **SPARKI-ADM-006** (P4, admin-health-detail.tsx:56): Terug-knop op de health-detail pagina is een harde link naar /admin ipv window.history.back; dit verbreekt de flow als de admin vanaf een specifiek dashboard kwam.

### TECHNIEK (19)
- **SPARKI-TEC-001** (P2, Algemeen): Data-trust: Hardcoded fallback-teksten in TrainingDayHome.tsx:208 wekken indruk van live data
- **SPARKI-TEC-002** (P3, api-server/src/routes): Ontbrekende query limits op veel DB-selects vergroot risico op memory issues bij groeiende datasets.
- **SPARKI-TEC-003** (P3, sparki/src/lib/api.ts:53): Silent catch bij mislukte JSON-parsing van error response kan foutdiagnose bemoeilijken.
- **SPARKI-TEC-004** (P3, sparki/src/components/sparki/day-homes): Potentieel dode/ongebruikte schermen: emergency-day-home.tsx en race-day-home.tsx lijken nog niet actief aangeroepen (zie Task #5).
- **SPARKI-TEC-005** (P3, sparki/src/App.tsx:707): Wouter-routes zijn niet gegroepeerd in een Switch, wat kan leiden tot dubbele rendering als paden overlappen.
- **SPARKI-TEC-006** (P3, sparki/src/hooks/use-load.ts:16): Data-trust risico: useLoad hook staat data-fetching toe zonder auth als DEV_PREVIEW aan staat.
- **SPARKI-TEC-007** (P3, sparki/src/components/sparki/training-builder.tsx:21): Zware berekening (buildTimeline) wordt direct in de render-loop aangeroepen.
- **SPARKI-TEC-008** (P3, api-server/src/lib/routing/providers/ors.ts:173): Performance logging met performance.now() zonder centrale registratie.
- **SPARKI-TEC-009** (P3, sparki/src/components/sparki/route-navigator.tsx:4438): Silent ignore bij falende browser speech engine (TTS) kan verwarrend zijn voor de gebruiker.
- **SPARKI-TEC-010** (P3, api-server/src/scripts/backfill-world-photos.ts:98): Potentieel memory-lek of performance issue bij backfills door slice() op volledige tabel-rows.
- **SPARKI-TEC-011** (P3, sparki/src/components/ui/sidebar.tsx:12): useEffect zonder dependency array of met onvolledige dependencies kan infinite loops triggeren.
- **SPARKI-TEC-012** (P3, Home): Upgrade-nudge voor AI-briefing blokkeert volledige briefing sectie
- **SPARKI-TEC-013** (P3, API-server): Boot-waarschuwing FTP-inconsistentie: profiel-FTP leeg terwijl nieuwste geldige meting 268 W is (derived-load backfill).
- **SPARKI-TEC-014** (P4, sparki/src/pages/lab.tsx:1): Dode code/testpagina: /lab is een omvangrijke testpagina met veel imports die waarschijnlijk niet in productie hoort.
- **SPARKI-TEC-015** (P4, api-server/src/routes/routes.ts:502): Actieve console.log statements in productie-paden (o.a. in routes.ts en jobs) vervuilen server logs.
- **SPARKI-TEC-016** (P4, sparki/src/components/sparki/beheer-popup.tsx:39): Vaste breedte-classes (sm:max-w-2xl) in sheets kunnen layout-problemen geven op zeer kleine mobiele schermen.
- **SPARKI-TEC-017** (P4, sparki/src/components/sparki/entitlements-admin.tsx:11): Hardcoded strings voor 'temporary_addon' etc. maken i18n/onderhoud lastiger.
- **SPARKI-TEC-018** (P4, sparki/src/components/sparki/connections-section.tsx:27): Magic numbers/kleuren in component styling (rgba(251,191,36,0.22)).
- **SPARKI-TEC-019** (P4, API-server): Continue GET / 404-logregels op de api-server in dev (platform-pings); vervuilt logs en bemoeilijkt diagnose.

## 4. Technische dwarsdoorsnede
- **Mock-/fallback-/hardcoded data**: weerweergave en enkele Vandaag-teksten kunnen als echte data ogen (SPARKI-VAN-004, SPARKI-TEC-001); verder geen structurele mockdata in productie-paden gevonden — het "eerlijk of afwezig"-principe is grotendeels doorgevoerd.
- **Ongebruikte componenten / dode code**: /lab-testpagina, emergency/race-day-homes nog niet aangesloten (TEC-register).
- **Dubbele routes**: geen echte dubbele Express-paden gevonden; wél route-declaratievolgorde-risico's die eerder al conventie zijn (specifiek vóór /:id). Wouter-routes staan zonder Switch (SPARKI-TEC-register), wat overlap-rendering kan geven.
- **Console errors / netwerkfouten (live logs vandaag)**: Strava-callback faalt hard op ontbrekende SPARKI_TOKEN_KEY (SPARKI-INS-001); FTP-inconsistentiewaarschuwing bij elke boot; continue 404-pings op de service-root. Browserconsole was schoon op een Clerk-dev-keys-waarschuwing na.
- **Performance**: N+1 in route-ontdekking (SPARKI-ROU-003), ontbrekende query-limits op meerdere lijst-selects, zware berekeningen in render-loops, 250ms-scroll-intervals op /you.
- **Toegankelijkheid**: ontbrekende aria-live bij uploadfouten, kleine touch-targets in privacy-grid, title-attributen i.p.v. ARIA, window.confirm-dialogen buiten de designtaal.

## 5. Advies: top-20 bugs met de grootste kwaliteitswinst

Volgorde = aanbevolen aanpakvolgorde. Criteria: gebruikersimpact (dataverlies, instroom, vertrouwen), privacy/rechten, en zichtbaarheid.

| # | ID | Ernst | Waarom deze eerst |
|---|---|---|---|
| 1 | SPARKI-INS-001 | P1 | Strava koppelen faalt nu hard — raakt elke nieuwe gebruiker die wil koppelen. |
| 2 | SPARKI-VAN-001 | P1 | Herstel-knop op Vandaag kan UI in verkeerde dagstaat laten hangen — kernscherm. |
| 3 | SPARKI-PLA-001 | P1 | Onbekend dagtype kan een leeg scherm geven op het belangrijkste scherm. |
| 4 | SPARKI-RIJ-001 | P1 | Hervatting na GPS-verlies tijdens rit is onbewezen — rit-opname is kernwaarde. |
| 5 | SPARKI-RIJ-006 | P2 | Crash tijdens rit = trackverlies bij herstel; direct dataverlies voor de sporter. |
| 6 | SPARKI-RIJ-005 | P2 | Navigatie verlaten laat opname/route stil doorlopen — batterij en spookritten. |
| 7 | SPARKI-RIJ-003 | P2 | Annuleren na crash-herstel kan opgenomen punten wissen. |
| 8 | SPARKI-LOG-001 | P2 | Onboarding-state via sessionStorage breekt bij OAuth/tab-wissel — instroomrisico. |
| 9 | SPARKI-LOG-003 | P2 | Sync-fout bij eerste login kan nieuwe gebruikers buitensluiten. |
| 10 | SPARKI-LOG-002 | P2 | Stille afwijzing van lengte buiten 100–250 cm — profiel lijkt opgeslagen maar is het niet. |
| 11 | SPARKI-COA-004 | P2 | Legacy-trainingen zonder coach-eigenaar door elke coach bewerkbaar — rechtenlek. |
| 12 | SPARKI-CLU-001 | P2 | Geschorste/beëindigde club kan gewoon blijven plannen en berichten sturen. |
| 13 | SPARKI-PRO-003 | P2 | Observaties worden client-side gefilterd; API stuurt te veel mee — datamininimalisatie. |
| 14 | SPARKI-INS-003 | P2 | Twee losse privacy-lagen die niet doorwerken — kans op onbedoelde deling. |
| 15 | SPARKI-PRO-002 | P2 | Export zet gevoelige categorieën standaard aan — privacy-verwachting. |
| 16 | SPARKI-VAN-004 | P2 | Weer-fallback kan als echte data ogen — raakt het data-trust-fundament. |
| 17 | SPARKI-TEC-001 | P2 | Placeholder-tekst op Vandaag wekt indruk van live functionaliteit. |
| 18 | SPARKI-ROU-003 | P2 | N+1 maakt de ontdek-feed traag bij groei — direct merkbare performance. |
| 19 | SPARKI-PLA-002 | P2 | Wizard zonder trainingsdagen levert een leeg/onbruikbaar plan. |
| 20 | SPARKI-PLA-003 | P2 | Route-generatie zonder thuislocatie faalt zonder uitleg — stille doodlopende flow. |

## 6. Afsluiting
- Totaal aantal bevindingen: **128** (P1: 4 · P2: 36 · P3: 62 · P4: 26).
- Volledig register: `docs/SPARKI_BUG_REGISTER.csv` (gesorteerd op ernst, ; als scheidingsteken).
- Er zijn géén codewijzigingen gedaan en géén commits uitgevoerd, conform de opdracht.
- Kanttekening bij eerlijkheid: dit is een statische audit aangevuld met logbewijs. Bevindingen zijn in de code aanwijsbaar, maar niet elk scenario is live gereproduceerd; bevindingen met "regressietest ja" verdienen bij het fixen een reproducerende test vooraf.
