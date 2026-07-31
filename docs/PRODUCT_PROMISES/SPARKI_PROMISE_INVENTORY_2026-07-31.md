# Sparki belofte-inventaris — 31-07-2026

**Status van dit document: inventarisatie en beoordeling, géén herschrijving.**
Er is niets verwijderd, hernummerd, verruimd of van status veranderd. De kolom
"Huidige status" geeft weer wat er nú in de bron staat (letterlijke
statuswaarden), plus een toets tegen de voorgestelde statusindeling uit
`SPARKI_PROMISE_FRAMEWORK_PROPOSAL.md` — die toets is een voorstel, geen besluit.

## 0. Werkdefinitie: wat telt binnen Sparki als "belofte"?

Een **productbelofte** is een claim over wat Sparki voor de gebruiker doet of
nooit zal doen, die (a) ergens in de repository is vastgelegd (kalibratie-YAML,
governance-doc, besluitenregister, UI-tekst, API-contract of contracttest),
(b) een aanwijsbare norm heeft of hoort te hebben, en (c) waarop de gebruiker
of een toetser Sparki mag afrekenen. Alles wat alleen in chats of herinnering
bestaat is per opdracht §2 níet meegenomen.

Per categorie (definities kort; volledige uitwerking met bron/bewijs/fail-closed
per categorie staat in het frameworkdocument, hoofdstuk 1):

| Categorie | Werkelijk een belofte wanneer… | Alleen doel/ambitie wanneer… | Leidende bron |
|---|---|---|---|
| Harde functionele belofte | gedrag + norm vastgelegd én afdwingbaar in code/test | het "zou moeten kunnen" zonder norm of gate | kalibratie-YAML + contracttest |
| Veiligheidsbelofte | fail-closed gedrag met tegenvoorbeeld en uitgevoerde test | veiligheid als intentie zonder afkeurregel | kalibratie-YAML (hard_reject_rules) |
| Privacy-/rechtenbelofte | rechtenregel in code afgedwongen (403/404/masking) + test | privacy als uitgangspunt zonder gate | rechtenmatrix/besluiten + contracttest |
| Databron-/data-trustbelofte | herkomst/eerlijkheid afgedwongen (bronnenregister, geen verzonnen getallen) | "we willen transparant zijn" | source-quality register + tests |
| Prestatiebelofte | meetbare grens (tijd/afwijking) + meting uitgevoerd | richtgetal zonder meting | kalibratie-YAML + PERF-metingen |
| Beschikbaarheidsbelofte | uptime/gedrag-bij-uitval vastgelegd + bewaakt | "hoort altijd te werken" | (nu vrijwel afwezig — zie conflicten C10) |
| UX-belofte | doctrine-regel met sanity-poort (5b) | smaak/voorkeur | Product Proof Doctrine + Poort 5b |
| Coachings-/adviesbelofte | deterministische regel + eerlijkheidsgrens (geen advies zonder data) | coaching-visie | engine-code + kalibratie-YAML |
| Juridisch/compliance | wettelijke plicht (AVG, minderjarigen) — altijd belofte, nooit ambitie | n.v.t. | wet + besluitenregister |
| Commerciële belofte | in verkoop-/paywall-copy of variantmatrix vastgelegd | pricing-ideeën | Master Plan/variantmatrix (v3.02 ontbreekt!) |
| Toekomstbelofte | expliciet als "komt eraan" naar gebruikers gecommuniceerd | roadmap-item intern | roadmap/backlog |
| Interne technische invariant | door test/poort afgedwongen; wordt pas gebruikersbelofte na besluit René | conventie zonder gate | contracttests + validatiepoorten |
| Aspiratie/productvisie | nooit een afdwingbare belofte totdat norm+bewijs+besluit bestaan | altijd | Master Plan/visieteksten |

**Statusindeling**: dit document gebruikt de door René voorgestelde twaalf
statussen (`proposed` … `blocked_pending_decision`); definities en toegestane
overgangen staan in het frameworkdocument, hoofdstuk 2. De YAML gebruikt nu een
ándere set (`needs_calibration`/`calibrated`/`deprecated` + losse velden) — de
kolom "Huidige status" toont beide: eerst letterlijk, dan de dichtstbijzijnde
voorgestelde status tussen haken *(voorstel)*.

## 1. Hoofdtabel — alle aangetroffen beloftes

Legenda kolommen: **ML** = measurement level zoals vastgelegd; **CE** =
counterexample aanwezig; **FC** = fail-closed vereist/afgedwongen; **B?** =
besluit René nodig. Eigenaar is overal "René (PO) / agent (uitvoering)" tenzij
anders vermeld — een expliciet eigenaarveld ontbreekt in vrijwel alle bronnen
(zie conflict C8). "Laatste controle" = laatst gedocumenteerde toets.

### Hoofdstuk D — Routes & navigatie (kalibratie-YAML 2026-07-30)

| ID | Naam | Code | Categorie | Belofte (gewone taal) | Norm/grens | Geldt voor | Bron(versie) | ML | CE | FC | Bewijs vereist | Huidig bewijs | Huidige status | Conflicten | Laatste controle | B? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| D1 | Routegenerator | routes_generator_001 | hard functioneel + veiligheid | Passende route, geen trappen/verboden/afgesloten poorten; racefiets nooit aantoonbaar onverhard | 0% onverhard (racefiets), <30 s | alle fietsers | YAML D.1 (30-07) | per_segment/per_meting | ja (o.a. Hengelo-seed-11, bewijsbatch 12 routes) | ja | autotest + praktijkrit | bewijsset-blokkadepoort + lusroutes-fail-closed deliverable; gegenereerde invarianten-suite (31-07) | needs_calibration *(partially_verified)* | overlap D4 (C1) | 31-07-2026 | ja — kalibratie |
| D2 | Hoogteprofiel | routes_hoogteprofiel_001 | prestatie/data-trust | Profiel en totaal hoogteverschil spreken elkaar nooit tegen; vlak = ~0 hm | één hm-SSOT (smooth ±150 m, 3 m-drempel) | alle routes | YAML D.2 | per_route | deels | ja | testrit-bewijs | code-SSOT aanwezig; praktijkbewijs beperkt | needs_calibration *(partially_verified)* | — | 30-07 | ja |
| D3 | Route-opmerkingen | routes_opmerkingen_001 | veiligheid | Waarschuwingen kloppen; nooit "geen bijzonderheden" als de bron faalde | ≥95% precisie; bronfout ⇒ eerlijk gat | alle routes | YAML D.3 | per_meting | ja | ja | praktijkproef | deels (praktijk beperkt) | needs_calibration *(partially_verified)* | — | 30-07 | ja |
| D4 | Wegdek-transparantie | routes_wegtypen_001 | hard functioneel | Eerlijk wegdekoverzicht; "onbekend" heet onbekend | 0 verboden km; onbekend nooit als verhard geteld | alle routes | YAML D.4 | per_segment | ja | ja | autotest-fixtures | deels | needs_calibration *(partially_verified)* | overlap D1 (C1); onbekend-wegdek racefiets = keuze-gate zonder harde norm (C9) | 30-07 | ja |
| D5 | Mobiele navigatie | routes_mobiele_navigatie_001 | UX/veiligheid | Betrouwbare turn-by-turn; nooit neppositie bij GPS-verlies | 0 fake snaps; off-route 30+2×GPS+1,5×snelheid (50–150 m); alarm na 3 metingen én 6 s | mobiele app | YAML D.5 + RN_01A (besloten 26-07) | per_meting | ja (GPX-replay) | ja | hardware-/latencytest | replay-bewijs aanwezig; hardwaretest open | needs_calibration *(partially_verified)* | RN_01A deels achterhaald als document (C5) | 30-07 | ja |
| D6 | Wedstrijdmodus | routes_wedstrijdmodus_001 | prestatie | Race-UI met prioritaire info | latency <100 ms | wedstrijdrijders | YAML D.6 | per_sessie | nee | nee | veldtest | geen | needs_calibration *(not_verified)* | naam "Wedstrijd" ook hoogste plannerweergave (C6) | 30-07 | ja |
| D7 | Volgauto | routes_volgauto_001 | veiligheid | Realtime positie voor volgauto's, tweerichtingsstatus | sync <5 s; ETA altijd "geschat" | wedstrijdbegeleiding | YAML D.7 | per_meting | deels | ja | stresstest >5 auto's | functioneel bewijs; stresstest open | needs_calibration *(partially_verified)* | — | 30-07 | ja |

### Hoofdstuk H — Datakoppelingen (YAML)

| ID | Naam | Code | Categorie | Belofte | Norm | Geldt voor | Bron | ML | CE | FC | Bewijs vereist | Huidig bewijs | Status | Conflicten | Controle | B? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| H1 | Centrale Data Hub | data_hub_001 | data-trust | Eén waarheid voor alle fitnessdata, geen dubbeltellingen | 0 duplicaten (dedupe-key) | alle data | YAML H.1 | per_actie | ja | ja | conflictbeleid + tests | dedupe-tests aanwezig | needs_calibration *(partially_verified)* | — | 30-07 | ja |
| H2 | Strava-sync | data_strava_001 | data-trust | Betrouwbare sync, privacy-instellingen gerespecteerd | sync <60 s | Strava-gebruikers | YAML H.2 | per_actie | deels | ja | rate-limit-bewaking | webhook-/importtests | needs_calibration *(partially_verified)* | — | 30-07 | ja |
| H3 | Garmin/Wahoo | data_garmin_wahoo_001 | data-trust | Automatische uitwisseling met fietscomputers | 100% succes (norm onrealistisch geformuleerd) | Garmin/Wahoo | YAML H.3 | per_actie | nee | nee | multi-device test | fail-closed secrets-gedrag bewezen | needs_calibration *(not_verified)* | norm "100%" niet haalbaar/meetbaar (C9) | 30-07 | ja |
| H4 | Bestandsimport | data_bestandimport_001 | hard functioneel | GPX/FIT/TCX correct ingelezen, alleen geldige data | schema-valid | importeurs | YAML H.4 | per_actie | ja | ja | grote-bestanden-perf | ingest-tests groen | needs_calibration *(partially_verified)* | — | 30-07 | ja |
| H5 | BLE-sensoren | data_ble_sensoren_001 | prestatie | Stabiele verbinding HR/vermogen/cadans | dropout-herstel <1 s | mobiel + sensoren | YAML H.5 | per_meting | nee | nee | interferentietest | Expo-Go eerlijk-onmogelijk gedocumenteerd | needs_calibration *(not_verified)* | — | 30-07 | ja |

### Hoofdstuk A — Start, profiel & doelen (YAML)

| ID | Naam | Code | Categorie | Belofte | Norm | Bron | CE | FC | Huidig bewijs | Status | B? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 | Onboarding | start_onboarding_001 | UX | Direct aan de slag, persoonlijk profiel | <5 min totaal | YAML A.1 | nee | nee | onboarding-tests | needs_calibration *(partially_verified)* | ja |
| A2 | Sportpaspoort | start_sportpaspoort_001 | privacy-rechten | Sporter is eigenaar van eigen data, heldere historie | 100% portabiliteit | YAML A.2 | deels | ja | herkomstlaag + exporttests | needs_calibration *(partially_verified)* | ja |
| A3 | Vandaag-scherm | start_vandaag_001 | UX | Relevante dagsamenvatting, Vandaag is SSOT | laadtijd <2 s | YAML A.3 | nee | nee | orchestrator-sanity deliverable (31-07) | needs_calibration *(partially_verified)* | ja |
| A4 | Doelen | start_doelen_001 | aspiratie | Voortgang richting seizoensdoelen volgen | **geen meetbare norm** | YAML A.4 | nee | nee | doelen-engine bestaat | needs_calibration *(proposed)* | ja |

### Hoofdstuk BC — Training, coaching & analyse (YAML)

| ID | Naam | Code | Categorie | Belofte | Norm | CE | FC | Huidig bewijs | Status | B? |
|---|---|---|---|---|---|---|---|---|---|---|
| BC0 | Besluitlogica | bc_besluit_020 | interne invariant | Besluiten alleen op geverifieerde data | 0 aannames | ja | ja | deterministische engines + tests | **calibrated** *(verified)* — enige gekalibreerde | nee |
| BC1 | Trainingsplan | train_plan_001 | coaching-advies | Plan past zich aan gemiste sessies aan | 0 verouderde plannen | deels | ja | plan-execution tests | needs_calibration *(partially_verified)* | ja |
| BC2 | Uitvoering | train_uitvoering_001 | prestatie | Realtime begeleiding tijdens training | <2% intensiteitsafwijking | nee | nee | beperkt | needs_calibration *(not_verified)* | ja |
| BC3 | Coaching | train_coaching_001 | coaching-advies | Contextueel advies, altijd "waarom" | 100% uitgelegd | nee | nee | uitleglaag + observation-engine | needs_calibration *(partially_verified)* | ja |
| BC4 | Cockpit | train_cockpit_001 | UX | Alle vitale metrics in één beeld | "0 clutter" (**niet meetbaar**) | nee | nee | — | needs_calibration *(proposed)* | ja |
| BC5 | Lab/belastingsmodel | train_lab_001 | data-trust | Eén belastingsmodel (CTL/ATL/TSB), geen nepdata | SSOT computeLoadSeries | ja | ja | performance-lab tests | needs_calibration *(partially_verified)* | ja |
| BC6 | Gezondheid | train_gezondheid_001 | veiligheid | HRV/slaap bewaken, waarschuwen bij vermoeidheid | **geen meetbare norm**; wel raises-only + resume-gate | deels | ja | health-flow tests | needs_calibration *(partially_verified)* | ja |
| BC7 | Grafieken | train_grafieken_001 | UX | Accurate, zoombare visualisaties | 0 renderfouten | nee | nee | sessiegrafieken-tests | needs_calibration *(partially_verified)* | ja |
| BC8 | Mentaal | train_mentaal_001 | aspiratie | Subjectief gevoel/RPE volgen | 100% RPE-prompt | nee | nee | mentale kaarten gebouwd | needs_calibration *(partially_verified)* | ja |

### Hoofdstuk F — Voeding, hydratatie & gewicht (YAML)

| ID | Naam | Code | Categorie | Belofte | Norm | CE | FC | Status | Conflicten | B? |
|---|---|---|---|---|---|---|---|---|---|---|
| F1 | Richtwaarden | voed_richtwaarden_001 | coaching-advies | Calorie-/macrodoelen op basis van plan | ±10% | nee | nee | needs_calibration *(partially_verified)* | — | ja |
| F2 | Hydratatie | voed_hydratatie_001 | veiligheid | Vochtadvies op temperatuur/inspanning | <1% gewichtsverlies | nee | nee | needs_calibration *(not_verified)* | — | ja |
| F3 | Logboek | voed_logboek_001 | UX | Snel loggen, barcode | <30 s per invoer | nee | nee | needs_calibration *(not_verified)* | barcode niet gebouwd (C4: aspiratie als belofte) | ja |
| F4 | Gewicht | voed_gewicht_001 | prestatie | Gewicht/vetpercentage volgen | ±0,1 kg | nee | nee | needs_calibration *(not_verified)* | — | ja |
| F5 | Jeugdvoeding | voed_jeugd_001 | veiligheid + juridisch | Leeftijdspassend, nooit tekort-focus; <17 geen afvaldoel (RED-S) | 0 afvaldoelen jeugd | ja | ja | needs_calibration *(partially_verified — code-gate + tests bestaan)* | — | ja |
| F6 | Wedstrijdvoeding | voed_wedstrijd_001 | prestatie | Koolhydraatplan tijdens wedstrijden | ≤90 g KH/u | deels | nee | needs_calibration *(partially_verified)* | — | ja |

### Hoofdstuk J — Club, coachorganisatie & ploeg (YAML)

| ID | Naam | Code | Categorie | Belofte | Norm | CE | FC | Huidig bewijs | Status | B? |
|---|---|---|---|---|---|---|---|---|---|---|
| J1 | Rolmodel | club_rolmodel_001 | juridisch/privacy | Strikte rollen; individueel schrijven/berichten alléén met directe geaccepteerde link | RBAC strikt; 403 zonder hasDirectCoachLink | ja (oud contract als regressie-tegenvoorbeeld) | ja | write-contract 5/5 + message-rights 9/9 (31-07); reviewer: codepad onafhankelijk gecontroleerd, testclaims niet herhaald | needs_calibration *(partially_verified)* | ja |
| J2 | Clubomgeving | club_clubomgeving_001 | commercieel | Club-eigen omgeving voor leden | **geen norm** | nee | nee | clubomgeving gebouwd | needs_calibration *(proposed)* | ja |
| J3 | Teamomgeving | club_teamomgeving_001 | UX | Gedeelde kalender, groepsberichten | **geen norm** | nee | nee | gebouwd | needs_calibration *(proposed)* | ja |
| J4 | Externe coach | club_externe_coach | data-trust/privacy | Veilig delen met externe coach, alleen met toestemming | consent-based | deels | ja | sharing-levels tests | needs_calibration *(partially_verified)* | ja |
| J5 | Minderjarigen | club_minderjarigen | veiligheid/juridisch | Oudertoestemming leidend; fail-closed | 100% ouder-geleid | ja | ja | parent-environment tests; **bekende ongelijkheid: algemene coach-sharing-laag behandelt onbekende leeftijd níet als minderjarig, andere modules wel (C3)** | needs_calibration *(conflicting)* | **ja — veiligheidsconflict** |
| J6 | VOG/veilig sporten | club_vog_veiligsporten | juridisch | VOG-workflow voor trainers | 3-jaars herhaling | nee | ja | workflow gebouwd | needs_calibration *(partially_verified)* | ja |
| J7 | Trainingsinhoud | club_trainingsinhoud | coaching-advies | Gedeelde bibliotheek met kwaliteitsbewaking | **geen norm** | nee | nee | — | needs_calibration *(proposed)* | ja |
| J8 | Uitnodigingen | club_uitnodigingen | UX | Eenvoudig via QR/link | 1 scan | deels | nee | invite-tests | needs_calibration *(partially_verified)* | ja |
| J9 | Sessielogistiek | club_sessielogistiek | UX | Verzamelpunten, aanwezigheid | **geen norm** | nee | nee | — | needs_calibration *(proposed)* | ja |

### Addendum BC — Analyse-datakaarten (YAML)

| ID | Naam | Code | Categorie | Norm | CE | FC | Status | B? |
|---|---|---|---|---|---|---|---|---|
| K1 | Vermogensduurcurve | analyse_datakaart_pdc | prestatie | SSOT | deels | ja | needs_calibration *(partially_verified)* | ja |
| K2 | Piekvermogens | analyse_datakaart_piek | prestatie | — (**geen norm**) | nee | nee | needs_calibration *(proposed)* | ja |
| K3 | TSS/IF | analyse_datakaart_tss | prestatie | SSOT (derived-TSS at ingest) | ja | ja | needs_calibration *(partially_verified)* | ja |
| K4 | Ramp rate | analyse_datakaart_ramp | prestatie | **grenswaarden wachten op voorstel+besluit (open keuze #13)** | nee | nee | needs_calibration *(blocked_pending_decision)* | **ja** |
| K5 | Decoupling | analyse_datakaart_decoup | prestatie | — | nee | nee | needs_calibration *(proposed)* | ja |
| K6 | Zones | analyse_datakaart_zones | prestatie | — | nee | nee | needs_calibration *(proposed)* | ja |
| K7 | W'/FRC | analyse_datakaart_wprime | prestatie | — | nee | nee | needs_calibration *(proposed)* | ja |
| K8 | Extra lab-grafieken | analyse_lab_extra | UX | — | nee | nee | needs_calibration *(proposed)* | ja |
| K9 | Koolhydraatscenario | scenario_koolhydraat | prestatie | — | nee | nee | needs_calibration *(proposed)* | ja |
| K10 | Wetenschapspijplijn | analyse_contentpipeline | coaching-advies | peer-reviewed bronnen | nee | nee | needs_calibration *(partially_verified — bronnenregister bestaat)* | ja |

### Addendum — Recreatief / e-bike (YAML)

| ID | Naam | Code | Categorie | Norm | CE | FC | Status | B? |
|---|---|---|---|---|---|---|---|---|
| E1 | E-bike-ritten gescheiden | recreatief_ebike_sync | data-trust | herkomst-SSOT, nooit FTP-vervuiling | ja | ja | needs_calibration *(partially_verified)* | ja |
| E2 | Motorondersteuning-inzicht | recreatief_ebike_supp | hard functioneel | **geen norm** | nee | nee | needs_calibration *(proposed)* | ja |
| E3 | E-bike-onboarding | recreatief_ebike_onb | UX | **geen norm** | nee | nee | needs_calibration *(proposed)* | ja |
| E4 | E-bike-routes | recreatief_ebike_route | hard functioneel | **geen norm** (laadpunten) | nee | nee | needs_calibration *(proposed)* | ja |
| E5 | Coachtaal e-bike | recreatief_ebike_coach | coaching-advies | **geen norm** | nee | nee | needs_calibration *(proposed)* | ja |

### Buiten de YAML: besluiten, governance, code en UI

| ID | Naam | Code | Categorie | Belofte | Norm/grens | Bron(versie) | CE | FC | Huidig bewijs | Status (toets) | Conflicten | B? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G1 | Lusroutes fail-closed | (taakhistorie routeketen) | veiligheid | Geen route geleverd bij blokkade of onverifieerbare meting | verified_clear vereist; 422/409 anders | sanity-rapporten 30/31-07 + code | ja | ja | 12-routes-batch + blokkadepoort-bewijs + gegenereerde suite | *(verified — nog niet independently_verified: praktijkrit ontbreekt)* | — | ja (kalibratie) |
| G2 | Routekern alleen met risicoanalyse | rra | veiligheid/proces | Geen wijziging aan harde routeregels zonder ingevulde RRA | poortscript fail-closed | AI-reviewgovernance §11a (31-07) | ja | ja | script uitgevoerd; GitHub-afdwinging wacht op workflows-push René | *(implemented)* | afdwinging nog handmatig (C7) | ja (#507-afronding) |
| G3 | Cross-account-isolatie | auth_isolation | veiligheid/privacy | Nooit andermans data via :id | 0 lekken; 403/404 | contracttests (cross-account, links-isolation e.a.) | ja | ja | e2e-tests groen (herhaald in CI-workflows) | *(verified)* | — | nee (wel canoniseren) |
| G4 | Minderjarigen-bescherming | minor_protection | juridisch | Delen valt terug op "none" zonder oudertoestemming | fail-closed 'none' | code + tests | ja | ja | tests groen; zie C3-ongelijkheid | *(conflicting — zie J5)* | C3 | **ja** |
| G5 | Data-export zonder geheimen | data_export_audit | privacy-rechten | Export bevat alleen eigen data, nooit tokens; auditregel verplicht | tokenmasking; auditlog | privacy-security code+tests | ja | ja | tests groen | *(verified)* | — | nee (canoniseren) |
| G6 | Eerlijkheidsbelofte getallen | data_trust_honesty | data-trust | Sparki verzint nooit getallen; ontbrekend = eerlijk gat | 0 verzonnen waarden | uitleg-content-tests, source-quality register, doctrine | ja | ja | tests + doctrine | *(verified als invariant; als gebruikersbelofte niet gecanoniseerd)* | C2 (invariant→belofte zonder besluit) | ja |
| G7 | Afvaldoel raakt training nooit | season_goal_promise | hard functioneel | Trainingen blijven volledig gevoed; bijsturing alleen via rustige maaltijden | 0 impact op trainingsvoeding; één canonieke zin | code + day-advice-tests | ja | ja | tests groen | *(verified als invariant)* | C2 | ja |
| G8 | Materiaalcoach-eerlijkheid | mat_coach_eerlijk | coaching-advies | Geen advies bij onvoldoende fotozekerheid | confidence-gate | material-advice tests | ja | ja | tests groen | *(verified als invariant)* | C2 | ja |
| G9 | Geen verzonnen gereedheidsscore | comm_state_trust | UX/commercieel | Geen 0–100-sfeergetal; echte band + statuszin | 0 verzonnen scores | commercial-shell copy + state-engine | deels | ja | code-gedrag | *(implemented)* | C2 | ja |
| G10 | Privacy-/veiligheidsmeldingen niet uitschakelbaar | priv_push_01 | veiligheid | Kritieke meldingen kennen geen opt-out | geen opt-out-pad | reminder-settings UI + server | nee | ja | UI + servergedrag | *(implemented — geen contracttest)* | — | ja |
| G11 | Live locatie opt-in, geen historie | loc_liv | privacy | Alleen per sessie, autorisatie bij elke lezing, één positierij | idle-expiry; hercheck per read | code + 21 tests (Current State §10) | ja | ja | tests groen | *(verified)* | — | nee (canoniseren) |
| G12 | Trainer-rechten (direct-link) | coa_link | privacy | Individueel lezen/schrijven alléén met directe geaccepteerde link | 403 anders | besluit B1 (30-07) + tests | ja | ja | 9/9 + 5/5 tests (31-07) | *(verified)* | — | nee (canoniseren) |
| G13 | Verplichte client-upgrade nooit tijdens rit | client_version_gate | beschikbaarheid | 426 nooit tijdens actieve rit (latch+flush) | kanaal-plafond, latch | rollout-code | ja | ja | code + tests | *(verified als invariant)* | C2 | ja |
| G14 | Poort 5b vóór elke oplevering | sanity_check | UX/proces | Geen dode knoppen, geen context-onzin, geen placeholders als eindresultaat | check-sanity-reports fail-closed | POORT_5B doctrine + 15 rapporten | ja | ja | 15 sanity-rapporten, alle deliverable | *(implemented, doorlopend)* | — | nee |
| G15 | Kalibratie-YAML altijd valide | promise_calibration | interne invariant | Elke afkeurregel draagt rule_type + verplichte velden | check-promise-calibration | scripts + workflow | ja | ja | poort groen | *(verified als invariant)* | — | nee |
| G16 | AI via één gateway | ai_gateway | privacy/data-trust | Elke modelcall door killswitch→consent→minderjarig→redactie | één aiMessage()-poort | gateway-code + tests | ja | ja | tests | *(verified als invariant)* | C2 | ja |
| G17 | Sparki Complete/Go-varianten | commercieel | commercieel | Variant-specifieke rechten (Gratis/Go/Complete); hoogste plannerweergave heet "Wedstrijd" | entitlements AND flags | besluit 30-07 + entitlement-code; **Master Plan v3.02 ontbreekt in repo** | nee | ja | entitlement-tests | *(blocked_pending_decision — variantmatrix onvindbaar)* | C6/C10 | **ja** |
| G18 | EU-uitrol & meertaligheid | eu_rollout | toekomstbelofte | EU-breed, alle EU-talen, landensites | **geen norm/datum** | besluitenregister | nee | n.v.t. | copy nog hard-coded NL | *(approved als richting, not_verified als belofte)* | C4 | ja |

## 2. Conflicten en dubbelingen (niets beslecht — alles ter beoordeling)

- **C1 — Zelfde onderwerp, twee normen:** routes_generator_001 (0% onverhard racefiets) en routes_wegtypen_001 (0 forbiddenKm + transparantie) overlappen op onverhard/verboden; norm staat op twee plekken en kan uiteenlopen.
- **C2 — Invariant geworden gebruikersbelofte zonder besluit:** G6–G9, G13, G16 zijn in code/tests afgedwongen en klinken als gebruikersbeloftes, maar staan nergens als door René goedgekeurde belofte (rene_approved) vastgelegd.
- **C3 — Veiligheidsongelijkheid minderjarigen (gedocumenteerd, onopgelost):** de algemene coach-sharing-laag behandelt onbékende leeftijd niet als minderjarig; ouderomgeving en andere modules clampen wél naar veiligheidsminimum. Twee bronnen, twee gedragingen — voorgelegd, geen keuze gemaakt.
- **C4 — Aspiratie als belofte opgeschreven:** barcode-scannen (F3), laadpunten (E4), EU-talen (G18), Master-Plan-visieteksten; nergens bewijs of norm.
- **C5 — Documentatie loopt achter:** SPARKI_RN_01A_OPEN_DECISIONS.md bevat vragen die 26-07 al besloten zijn; SPARKI_CURRENT_STATE.md noemt 19/22 gebieden "Volledig" terwijl onderliggende onderdelen "open/experimenteel" heten (aspiratie-als-feit binnen één document).
- **C6 — Naamdubbeling "Wedstrijd":** wedstrijdmodus (D6), hoogste plannerweergave "Wedstrijd" (besluit 30-07) en wedstrijddossier gebruiken hetzelfde woord voor drie dingen; abonnement heet "Sparki Complete". Verwarring in UI-claims mogelijk.
- **C7 — Beloofde afdwinging bestaat nog niet:** PR-poorten (promise-calibration, sanity, RRA, regressiematrix) draaien lokaal/als workflow, maar GitHub dwingt niets af zolang `.github/workflows/` leeg is (wacht op handmatige stap René, #507).
- **C8 — Vrijwel geen belofte heeft een eigenaar of hercontroledatum:** de YAML kent geen owner- of recheck-veld; sanity-rapporten kennen checked_by maar geen vervaldatum.
- **C9 — Beloftes zonder haalbare of meetbare norm:** "100% succes" (H3), "0 clutter" (BC4), "geen norm" bij 15+ regels hierboven vetgedrukt.
- **C10 — Geen enkele beschikbaarheidsbelofte:** nergens is uptime, hersteltijd of gedrag-bij-storing als belofte vastgelegd, terwijl commerciële varianten (G17) verkocht gaan worden.
- **C11 — Twee statusvocabulaires:** YAML (needs_calibration/calibrated/deprecated + evidence_status/practice_status) versus de twaalf statussen uit deze opdracht; mapping is nu interpretatie (in deze tabel expliciet als *(voorstel)* gemarkeerd).

## 3. Telling (oplevering §9)

- **Totaal geïnventariseerd: 73 beloftes/claims** (55 in kalibratie-YAML, 18 daarbuiten in besluiten/governance/code/UI).
- Per categorie: hard functioneel 9 · veiligheid 12 · privacy/rechten 8 · data-trust 9 · prestatie 15 · beschikbaarheid 1 (G13, en die is eigenlijk een invariant — zie C10) · UX 12 · coaching-advies 8 · juridisch/compliance 4 · commercieel 3 · toekomst 1 · interne invariant 5 · aspiratie 3. (Sommige tellen dubbel door menging; hoofdcategorie geteld.)
- Zonder meetbare norm: **17** (vetgedrukt "geen norm" + niet-meetbare zoals "0 clutter").
- Zonder counterexample: **31**.
- Met conflict/dubbeling: **14** (C1–C6, C9, C11-betrokken rijen).
- Verouderd/achterlopend gedocumenteerd: **3 documenten** (RN_01A, Current State-gedeelten, ontbrekende Master Plan v3.02).
- Werkelijk onafhankelijk bewezen (onafhankelijke reviewer én uitgevoerde praktijktest): **1** volledig (lusroutes fail-closed: 12-routes-batch + onafhankelijke review; praktijkrit deels), plus 1 gekalibreerd (bc_besluit_020). Alle overige hoogstens technisch bewezen.
- Besluit René nodig: **62** rijen (alle needs_calibration + alle C2-canonisaties + C3 + G17/G18).

## 4. Gebruikte en niet-doorzochte bronnen

**Doorzocht:** SPARKI_PROMISE_CALIBRATION.yaml (30-07, 6351 regels, alle hoofdstukken), POORT_5B_SANITY_CHECK.md, alle 15 sanity-rapporten, SPARKI_PRODUCT_PROOF_DOCTRINE.md, SPARKI_AI_REVIEW_GOVERNANCE.md (incl. §11a), BESLUITENREGISTER_RENE_2026-07-30.md, besluit-club-trainer-rechten.md, SPARKI_CURRENT_STATE.md, SPARKI_RN_01A_OPEN_DECISIONS.md, engine-architecture.md, routing-/RRA-docs, EVIDENCE_ARCHIVE_INVENTORY.md, .agents/open-choices.md, contracttests in artifacts/api-server/src/tests, validatiescripts in scripts/, UI-copy met concrete claims (web + commercial shell), rollout-/entitlement-code.

**Niet doorzocht of ontbrekend:** **SPARKI_MASTER_PLAN v3.02 ontbreekt in de repo** (laatst aanwezig: v2.89) — de variant-specifieke commerciële beloftes (Gratis/Go/Complete) zijn daardoor niet toetsbaar; mobiele-app-copy is slechts steekproefsgewijs gescand; historische chats/attached_assets zijn per opdracht §2 bewust níet als bron gebruikt; productie-omgeving is niet bevraagd.

**Bekende beperkingen:** categorie-indeling en status-mapping tussen haken zijn interpretatie van de agent (voorstel, geen besluit); de YAML-samenvatting per rij comprimeert langere afkeurregels — de YAML zelf blijft de volledige bron; tellingen zijn handmatig en kunnen ±2 afwijken bij mengcategorieën.
