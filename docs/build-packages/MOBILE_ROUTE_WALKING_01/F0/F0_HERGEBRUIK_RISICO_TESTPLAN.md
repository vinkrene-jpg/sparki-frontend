# MOBILE_ROUTE_WALKING_01 — F0 Hergebruikmatrix, risico's, testplan

## Hergebruikmatrix
| Nodig | Bestaat | Aanpak |
|---|---|---|
| Route-engine voet | `foot-walking`/`foot-hiking` in profile-selection + beide providers | Hergebruik; alleen kalibratie strafmotor+poorten per voetfamilie |
| Wegdekdata | OSM surface/smoothness + BGT/GRB-laag | Hergebruik; voet-specifieke wegingen toevoegen (zand/modder/gras acceptabel voor hike) |
| Veiligheidspoorten | hardRejectIfNeeded, blokkadepoort, route-remarks | Hergebruik; steps-regel per familie (fiets: afkeur; voet: toegestaan+getoond) |
| Hoogteprofiel | summarizeTrack-SSOT | Ongewijzigd hergebruik |
| GPX import/export | gpx-parse + routes.ts | Ongewijzigd hergebruik; sportfamilie meeschrijven |
| Navigatie | nav-live + route-match (segmentprojectie) | Hergebruik; voet-toetsing (re-prompt-drempels) in test |
| Opgeslagen routes | routes-schema + bibliotheek-poorten | Uitbreiden met sportfamilie-kolom (nullable, bestaand = fiets, expliciet gemigreerd met telling) |
| Wizard-UI | route-panel stappen/stepVisible + foutmodel stap-4 | Logica hergebruiken; mobiele compositie NIEUW (geen tweede flowlogica: zelfde state/handlers, andere presentatie) |
| Flags/entitlements | flag-infra + weergaveniveaus + usage-telling | Hergebruik; 3 nieuwe flag-keys |
| e2e | harness met viewports | Uitbreiden met 4 device-viewports + voet-scenario's |

## Risico's
- **R1 registerbesluit:** sportregister kent alleen families cycling/running/triathlon met trainingsengines als activatie-eis. Wandelen/hiken als ROUTEfamilie activeren zonder trainingsengine vereist een registeruitbreiding (route-actief ≠ training-actief), anders óf dode optie óf te vroege trainingsactivatie. Oplossing binnen bestaande architectuur: aparte route-activatiedimensie in het register + flags. Geen productkeuze buiten bestaande besluiten nodig (opdracht §14 zegt zelf: routefamilie).
- **R2 valse veiligheid:** fietskalibratie (unknown=×0.4) is niet voet-gevalideerd; voetroutes over private/verboden paden zijn directe afkeur. Voetpoorten eerst, UI-zichtbaarheid laatst (flags uit tot dan).
- **R3 blokkadepoort koude-cache fail-open** geldt ook voor voet; bewijs eist warme cache.
- **R4 één component van ~4900 regels:** mobiele compositie moet zonder de desktopflow te breken; regressienet route-klimmen + route-fout-stap4 is de wachter.
- **R5 navigatie-herprompt** is op fietssnelheid getest; te agressieve re-prompts bij wandeltempo controleren.
- **R6 geen tweede routearchitectuur:** mobiel = presentatielaag op dezelfde state/hooks (use-routes), nooit een fork.

## Testplan (samenvatting)
- e2e viewports: 375×667 (kleine iPhone), 430×932 (grote iPhone), 360×800 (kleine Android), 412×915 (grote Android) + bestaande 402×874/1440×900; 200% tekst; portret; overflow-check (scrollWidth<=innerWidth) per stap.
- Voet-scenario's (achter flags, testidentiteiten): stadswandeling verhard, boswandeling, gravelpad, steile hike, route met trappen (voet OK/fiets afkeur), privépad (afkeur), afgesloten pad (afkeur), onbekende ondergrond (confidence zichtbaar), rond + punt-tot-punt, GPX in/uit.
- Regressie: routeplanner-generatie, route-klimmen, route-fout-stap4, route-bibliotheek-go, loop-quality, privacy-zones — allemaal groen vóór elke fase-SHA.
- Foutstaten mobiel: zelfde stap-gebonden foutmodel als stap-4-herstel, aangevuld met locatiepermissie-geweigerd en offline.

## Fasering (voorstel, elk eigen commit+SHA)
- F1: mobiele wizard-compositie (Deel A) achter `mobile_routeplanner_v2` — fiets eerst, geen voet.
- F2: mobiele route-detailcompositie (bottom sheets).
- F3: sportfamilie-kolom + registeruitbreiding route-activatie (server), flags `walking_routes`/`hiking_routes` (uit).
- F4: voet-geschiktheid/poorten/moeilijkheid server-side + data-trust-velden.
- F5: wandelen/hiken in wizard (mobiel+desktop) achter flags; voorkeuren; startpuntkeuzes.
- F6: navigatie/GPX-toetsing voet + volledige e2e-matrix + opleverbundel.
