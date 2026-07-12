# Sparki — Consolidatiematrix

Datum: 12 juli 2026. Analyse-only (geen aanbeveling tot bouwen — dit is de matrix waar een latere herontwerpronde op kan besluiten). Classificaties verwijzen naar `FEATURE_INVENTORY.md`/`.csv`. ⚠ = onzekerheid, zie `AUDIT_UNCERTAINTIES.md`.

**Kolommen:** Cluster · Betrokken features · Aard van de overlap · Consolidatierichting (analyse) · Risico bij consolideren.

---

## Cluster 1 — Inzicht op drie bestemmingen (grootste D-cluster)

| Feature | Rol nu |
|---|---|
| F-004 Coach-analyse "Wat valt op" (home) | dag-inzicht, leidend |
| F-078 Inzicht-pagina `/lab` | verzamelplek observaties — ⚠ geen duidelijke nav-ingang |
| F-070 `/you` lenzen/patronen | lange-termijn-beeld |
| F-011 Ontwikkelprioriteit-kaart (home) | hefboom-samenvatting |
| F-024 Trainingsverloop (/train) | trend |
| F-030 Ontwikkelkompas (/you) | doel+belastbaarheid+benutting |

**Overlap:** allemaal projecties van dezelfde observatie-/load-data; dedupe bestaat alleen per oppervlak, niet tussen oppervlakken. `/lab` is functioneel een subset van wat home + /you samen tonen.
**Richting:** één inzichtbestemming: "vandaag" blijft op home (F-004), al het duurzame (F-070/F-030/F-024-trend/F-078) samenvoegen op /you; `/lab` opheffen of tot doorverwijzing maken. F-011 wordt teaser die naar /you linkt.
**Risico:** laag-middel — /you wordt zwaarder belast; interne links naar /lab moeten mee.

## Cluster 2 — Lezen & leren (nieuws / kennis / intel / leskaart)

| Feature | Rol nu |
|---|---|
| F-090 Nieuws/Ontdekken `/feed` | gecureerd nieuws |
| F-092 Kennisbank `/kennis` (flag) | wetenschapsbibliotheek |
| F-093 Intel "Voor jou" (flag) | gepersonaliseerde selectie |
| F-008 Leskaart van de dag (home) | micro-les |

**Overlap:** vier ingangen voor "iets lezen/leren"; F-093 is al de personalisatielaag die F-090/F-092 zou moeten sturen.
**Richting:** één leesbestemming (Ontdekken) met tabbladen of één gemengde, intel-gestuurde rangschikking; leskaart wordt het home-uitsteeksel van diezelfde bron.
**Risico:** laag — voornamelijk navigatie/curatie; flags blijven bruikbaar als toegangsknop.

## Cluster 3 — Virtuele renners (Wereld / reel / race-room-media)

| Feature | Rol nu |
|---|---|
| F-101 Sparki World `/wereld` | eiland + verhalen (F-klasse: doel t.o.v. kernwaarde onvoldoende gedefinieerd ⚠ productkeuze) |
| F-094 Renners-reel in `/feed` | zelfde content als swipe-reel |
| F-054 Wedstrijd-room | gebruikt dezelfde media-engine |

**Overlap:** twee consumptie-oppervlakken (wereld + reel) voor dezelfde fictieve content; aparte header-ingang voor Wereld.
**Richting:** één consumptievorm kiezen (reel in Ontdekken als laagdrempelig, /wereld als optionele verdieping zonder eigen header-knop) — of Wereld bewust als op zichzelf staand "rustmoment" herpositioneren. Media-engine (cache-first) blijft gedeelde infrastructuur.
**Risico:** laag technisch; product-emotioneel gevoelig (bewuste designinvestering).

## Cluster 4 — Trainingsweergave van vandaag (herhaling, geen echte duplicatie)

| Feature | Rol nu |
|---|---|
| F-001/F-002 home-dagbeeld + StateCard | samenvatting + toestand |
| F-020 /train L3 "vandaag" | zelfde training in contextlaag |
| F-023 werkout-drawer | detail |

**Overlap:** dezelfde geplande training op drie niveaus — bewuste trechter (samenvatting → context → detail), geen fout; wel dubbel onderhoud van presentatielogica.
**Richting:** presentatiecomponent delen (één WorkoutSummary-bron), geen structuurwijziging.
**Risico:** zeer laag.

## Cluster 5 — Invoerkanalen

| Feature | Rol nu |
|---|---|
| F-010 Zelf-update hub (Vandaag) | bewust ENIGE zelfinvoer-oppervlak (doctrine) |
| F-149 Input Center (chat rij 2) | bijlagen/composer |
| F-041 Bestand-import (/activiteiten) | ritbestanden |
| F-071 Instellingen-sheet (/you) | profielwaarden |

**Overlap:** vier plekken waar de gebruiker iets "geeft"; de zelf-update-doctrine (alles via Vandaag) botst zachtjes met bestand-import op /activiteiten en profielinvoer op /you.
**Richting:** geen samenvoeging nodig; wél één mentale regel per invoertype documenteren (dagelijkse signalen → Vandaag; bestanden → Activiteiten; identiteit → Jij; alles-met-context → chat).
**Risico:** n.v.t. (analyse: huidige spreiding is verdedigbaar, alleen uitlegbaarheid bewaken).

## Cluster 6 — Weesfuncties en verborgen routes (E-klasse)

| Feature | Situatie | Richting |
|---|---|---|
| F-053 race-evaluatie-endpoint | backend zonder UI | óf UI-hook geven in racedetail (past bij Dylan-gat #8) óf verwijderen |
| F-045 Garmin-flag | flag zonder provider-code ⚠ | flag laten staan als roadmap-marker of verwijderen; nooit als "koppeling" tonen |
| F-046 activity-imports GET/DELETE | endpoints zonder gevonden UI-aanroep ⚠ | verifiëren of import-historie-UI bestaat; anders opruimen |
| F-160 /core playground | bewust prototype | archiveren zodra Core-vormtaal in productie gestold is |
| F-161 /photo-lab | experiment zonder ingang | besluit: productiseren (bij Materiaal/profiel) of archiveren |
| F-134 /geluid + wekker | route zonder nav-ingang ⚠ | ingang geven (instellingen) of expliciet experiment verklaren |
| F-162 bio-radar-component | gebruik onduidelijk ⚠ | referenties tellen; ongebruikt → verwijderen |
| F-065 mentale-veerkracht-kaart | bereikbaarheid onzeker ⚠ | zelfde |
| PUT /api/auth/me/role ⚠ vs rolwisselaar | dubbel pad mogelijk | verifiëren welke route de UI echt gebruikt |

## Cluster 7 — Meldingen & aansporingen

| Feature | Rol nu |
|---|---|
| F-130 notificatiebel (dag-vouw) | pull |
| F-013 engagement-nudges | push-achtig |
| F-131 herinneringen (mail/push) | gepland |
| F-044 connector-herstel-nudge | technisch |
| F-062 materiaal-nudge | domein |

**Overlap:** vijf aansporingssystemen met eigen logica; dedupe/dagvouw bestaat alleen in de bel.
**Richting:** één aansporingsbudget/prioriteitenregel over alle nudge-bronnen heen (urgent/gezondheid nooit gedempt — regel bestaat al in engagement-engine), zodat home nooit >1 nudge tegelijk toont.
**Risico:** middel — regels per bron zijn nu onafhankelijk getest; centrale demping mag gezondheids-/verbindingsnudges niet verstikken.

---

## Samenvatting classificatieverdeling

- **A (kern):** 22 features — dag-engine, toestand, analyse, plan, activiteiten, profiel/inzicht, chat, doelen.
- **B (contextueel):** 21 — races, voeding, materiaal, kennis, samen, coach/ouder-portalen.
- **C (infrastructuur):** ~30 — auth, privacy, hub, flags, admin, meldingen, opslag.
- **D (overlappend):** clusters 1–3 hierboven (≈8 features geraakt).
- **E (wees):** F-045, F-046, F-053, F-160, F-161, F-162 (6).
- **F (afleidend/ongedefinieerd):** F-094/F-101 (Wereld-duo, productkeuze vereist), F-134 (geluid), F-065 (mentaal, status onzeker).

**Belangrijkste consolidatiewinst (analyse):** cluster 1 (één inzichtbestemming) en cluster 2 (één leesbestemming) — samen goed voor het merendeel van de waargenomen versnippering, met laag technisch risico. Cluster 7 is de stilste maar meest gebruikersgevoelige (aandacht-huishouding op Vandaag).
