# Routeplanner herstellen & herontwerpen — werkpakketten

Bron: opdracht René 31-07-2026 (mobiele praktijktest). Regels: geen parallelle
routemotor, fail-closed veiligheidscontrole blijft, geen UX-afronding claimen
zolang routegeneratie niet werkt. Abonnementen = Gratis/Go/Compleet;
plannerweergaven = Eenvoudig/Toer/Sportief/Wedstrijd (strikt gescheiden).

**Status:** alleen WP-1 is vrijgegeven. WP-2 en verder starten pas na
expliciete goedkeuring van René per werkpakket.

| WP | Doel | Betrokken bestanden (kern) | Afhankelijk van | Risico's | Acceptatiecriteria | Bewijs | Omvang |
|----|------|---------------------------|-----------------|----------|--------------------|--------|--------|
| **WP-1 Routegeneratie herstellen** | Oorzaak "berekening stopt" aantonen + herstellen; laad-/verificatie-/foutstatus; geen dubbele aanvragen; echte route op Gratis én Go; mobiele test | `api-server/src/routes/routes.ts`, `lib/routing/loop-quality.ts`, nieuw `lib/route-generation-jobs.ts`; `sparki/src/hooks/use-routes.ts`, `components/sparki/route-panel.tsx` | — | lange handlers verplaatsen; bestaande contract-tests (`test-route-alternates`, blokkadepoort-bewijsset) mogen niet breken; Overpass blijft traag bij koud gebied (eerlijk melden, niet maskeren) | statusfasen zichtbaar ("route berekenen" / "veiligheidscontrole"); nooit stil einde; knop geblokkeerd tijdens aanvraag; duidelijke foutreden + vervolgacties; keuzes blijven staan; 422/503 fail-closed blijft; route echt gegenereerd op Gratis én Go | metingen vóór/na, servertijden, e2e-kliktest mobiel viewport + screenshots, testruns | Groot |
| WP-2 Abonnement ≠ plannerweergave | Begrippen scheiden in code, copy en docs; nergens "Wedstrijd" als abonnement of "Compleet" als weergave | `planner-view-switcher.tsx`, entitlements-copy, docs | WP-1 | sluimerende copy op veel plekken | grep-schoon; matrixdocument | grep-bewijs + screenshots | Klein |
| WP-3 Kaartgerichte stappenflow | Eén kaart-hoofdscherm + begeleide stappen (schuifkaart/wizard), mobiel eerst | `route-panel.tsx` (opsplitsen), kaartcomponenten | WP-1, WP-2 | grootste UI-ombouw; regressierisico bestaande flows | gebruiker ziet altijd waar hij zit, terug kan, keuze kan wijzigen | e2e mobiel + screenshots | Zeer groot |
| WP-4 Visuele fietskeuze | Eerste stap = 4 visuele fietskaarten die profiel/weergave/instellingen sturen | nieuwe component + illustraties (AI-gegenereerd, merkvrij), Garage-voorselectie | WP-3 | illustratiestijl; toegankelijkheid | 4 tikbare kaarten, label altijd zichtbaar, stuurt routeprofiel + weergave | screenshots, a11y-check | Middel |
| WP-5 Punten veilig vastklikken | Tik op kaart → snap naar dichtstbijzijnd berijdbaar segment per fietstype; eerlijk weigeren | server snap-endpoint (GraphHopper/OSM), kaart-UI | WP-3 | snap-kwaliteit per fietstype; geen stil ver-weg-klikken | testmatrix weiland/gebouw/water/voetpad/snelweg/privéweg/onverhard/fietspad | testlog + screenshots | Groot |
| WP-6 Samen fietsen: functioneel of eruit | Inventariseren wat echt werkt; anders uit korte flow, als actie ná route | `route-panel.tsx`, samen-modules | WP-3 | schijnfunctionaliteit laten staan | geen lege stap; gedocumenteerd wat werkt/ontbreekt | inventarisdocument | Klein/Middel |
| WP-7 GPX + Bewaard compact + "Deze route gebruiken" | Compacte scanbare lijsten; detail pas na klik; primaire gebruiken-knop met herverificatie | `route-panel.tsx` (GPX/Bewaard-secties), routes-API | WP-1 | oude veiligheidsstatus blind vertrouwen (verboden) | lijstvelden per opdracht; "gebruiken" laadt in planner + herverifieert; Gratis-beperking zonder veiligheids-betaalmuur | e2e + screenshots | Groot |
| WP-8 Persoonlijke routegeschiedenis | Route-index uit Strava/Garmin-historie clusteren en eerst voorstellen | bestaat deels (taken #511/#512 in merge!) — afstemmen, niet dubbel bouwen | WP-7, merge #511–#513 | dubbel werk met task-agents; privacyzones (#513) | volgorde eigen→bewaard→nieuw; privacy standaard privé | tests + demo | Middel (na merge) |
| WP-9 Ontdek herstellen | Start bij actuele locatie; beperkt aantal resultaten; nul-resultaten verklaren en de defecte query onderzoeken | ontdek-routes-API + UI | WP-1 | oorzaak nul hits onbekend | locatiegedrag + resultaten aantoonbaar; eerlijke lege staat | testlog | Middel |
| WP-10 Contextuele instellingen + niet-werkende functies | Instellingen per fiets/weergave/sensoren/abonnement; functiecontrole (stops, spraak, navstart, …); Bordjes sprinten volledig blokkeren (UI/URL/API) | verspreid | WP-3/4 | verkeerd verbergen | matrix werkend/gedeeltelijk/defect/alleen-UI; niets schijn-actief | statusdocument + bewijs | Groot |
| WP-11 Abonnementsmatrix + volledige testmatrix + documentatie | Functiematrix Gratis/Go/Compleet in gebruikerstaal; volledige mobiele/desktop testmatrix (FASE 13); alle docs bijwerken | docs/, entitlements | alle vorige | — | alle FASE 13-combinaties met screenshotbewijs; docs-lijst uit opdracht compleet | testmatrix + screenshots | Groot |

Volgorde = opdracht §Uitvoeringsvolgorde. Hoofdopdracht pas "afgerond" wanneer
elk WP afzonderlijk bewezen en door René goedgekeurd is.

## WP-1 — bevindingen (reproductie 31-07-2026, dev)

Gemeten met echte aanvragen (racefiets, lus 30 km):
- `POST /api/routes/generate/options` deed **48–133 s** en eindigde in 422
  `NO_SUITABLE_ROUTE`. Het 25 s-tijdbudget begrenst alleen *tussen* varianten;
  één variant (ORS + blokkerende Overpass-veiligheidscontrole van meerdere
  kandidaten) loopt onbegrensd door.
- In lus-modus (de standaard) toont de web-app tijdens die minuten **geen enkele
  status**: de eerlijke tussenmelding (`slowNotice`) staat alleen aan voor
  waypoints/A→B; de knop toont enkel "Berekenen…".
- `apiFetch` heeft geen timeout/abort; een lange POST is kwetsbaar voor
  proxy-afkap (in de code gedocumenteerd rond ~25 s op de preview-endpoints) en
  voor mobiel schermvergrendeling/app-wissel — de browser breekt de fetch af en
  het resultaat is voorgoed weg: precies "berekening stopt, geen route".
- De 422-tekst bevat technische tellers ("forbidden=0 steps=3 blockedGates=0")
  en de profielcode ("cycling-regular") — onbegrijpelijk voor de renner, en
  zonder duidelijke vervolgacties.

Herstelrichting WP-1 (geen nieuwe routemotor): generatie wordt een **korte
start-aanvraag + statuspolling** (zelfde motor, zelfde fail-closed poorten):
de lange berekening loopt op de server door, de telefoon pollt lichtgewicht en
overleeft daarmee proxy-afkap én schermvergrendeling; de UI toont eerlijke
fasen ("route berekenen" → "veiligheidscontrole"), blokkeert dubbele taps en
geeft bij een eerlijke weigering begrijpelijke taal + vervolgacties.
