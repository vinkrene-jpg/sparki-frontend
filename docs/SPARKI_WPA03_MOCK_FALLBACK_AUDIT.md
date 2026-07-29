# SPARKI — WP-A03: Mock-, fallback- en eerlijke lege toestanden

**Uitgevoerd:** 29 juli 2026. **Bronbasis:** `main` @ `aa19fa6a` (productie: `889fcb32`).
**Werkwijze:** Fase 1 read-only inventarisatie (vier parallelle codebase-verkenningen: web-kern, api-server, web-overig, mobiel + eigen gerichte zoekslagen), Fase 2 gericht herstel van alleen de aantoonbare fouten. Geen herschrijving, geen tweede data-engine, architectuur onaangetast.

## 1. Totaalbeeld

De app hanteert consequent een "honest UI"-principe: ontbrekende data → eerlijke lege toestand, fouten → foutstatus, demo/dev-data → hard afgegrendeld. Volledige inventaris: `docs/SPARKI_MOCK_FALLBACK_INVENTORY.csv` (18 bevindingen).

**Aantallen per classificatie:**
| Classificatie | Aantal |
|---|---|
| FOUTAFHANDELING_ONVOLDOENDE | 2 (F01, F02 — **hersteld**) |
| CROSS_USER_RISICO | 1 (F03 — **hersteld**) |
| EXPLICIETE_DEMO (correct afgegrendeld) | 4 (F05, F06, F09, F18) |
| VEILIGE_UI_PLACEHOLDER | 3 (F08, F12, F14) |
| EERLIJKE_LEGE_TOESTAND_BESTAAT | 4 (F10, F11, F15, F17) |
| GEEN_PROBLEEM | 4 (F04, F07, F13, F16) |
| ONVEILIGE_PERSOONLIJKE_FALLBACK | **0** |
| HARDCODED_PERSOONLIJKE_DATA | **0** |

Er is **nergens** gevonden dat mock-, seed- of demo-data als data van de ingelogde gebruiker wordt getoond, en **nergens** een API/DB-fout die stilletjes voorbeelddata oplevert. Sparki World (fictieve renners) leeft strikt gescheiden in `virtual_*`-tabellen; dev-preview-personas (`seed_*`-clerkIds) zitten alleen achter dev-only routes en compile-time gestripte UI (`import.meta.env.DEV`, eerder bewezen via bundle-grep van de productiebundle).

## 2. Herstelde fouten (Fase 2)

**F01 — Onboarding gap-fill verzweeg een API-fout (web).**
`onboarding-gap-fill.tsx` markeerde bij een mislukte `/api/onboarding/missing-data`-call de stap stil als "alles compleet", waarna het eerste plan op geschatte defaults werd gebouwd zonder dat de atleet de oorzaak kende. Nu: eerlijke foutstaat ("Even geen verbinding") met **Opnieuw proberen** en een expliciete keuze **"Toch doorgaan met schattingen"** — de gebruiker beslist, niets gebeurt meer stil.

**F02 — Volgauto-positie delen faalde stil (mobiel).**
`postVolgautoPosition` slikte netwerkfouten in; renner én volgauto-bestuurder dachten dat de ander hen live zag. Nu geeft de call eerlijk terug of het versturen lukte; na 2 opeenvolgende missers verschijnt in de HUD "Positie delen … hapert — geen verbinding. … ziet je nu mogelijk niet." (bij beide rollen). De leeskant was al eerlijk (verouderd = leeg); nu is de zendkant dat ook. Vrienden-live-delen (`postLivePosition`) deed dit al goed (F04).

**F03 — BLE-sensor-fallback zonder waarschuwing (mobiel).**
Wanneer de gekoppelde voorkeurssensor niet binnen de zoek-graceperiode gevonden wordt, verbindt de app eerlijk met de eerste passende sensor — maar het paneel meldde niet dat dit een ANDERE sensor was (risico in een groep: andermans hartslag als eigen waarde). Nu draagt de verbinding een `usedFallback`-vlag en toont het sensorpaneel expliciet "· let op: andere sensor dan je gekoppelde".

## 3. Bewust behouden (veilig)

- Skeletons/laadstatussen zonder persoonlijke waarden; HTML-placeholders in invoervelden (F14).
- Deterministische route-rationale zolang de AI-uitleg asynchroon nog rekent (feiten uit echte routedata, F12).
- AI-plan-fallback met generieke templates — cijfers komen altijd uit het deterministische schema (F08).
- Sparki World en dev-preview-personas als expliciete, afgegrendelde demo-omgevingen (F09, F18).
- Web-stubs van de mobiele app die eerlijk "niet ondersteund" zeggen (F16).

## 4. Tests & bewijs

| Poort | Resultaat |
|---|---|
| Typecheck web (sparki) | groen |
| Typecheck mobiel (sparki-mobile) | groen |
| Typecheck api (libs + api-server) | groen |
| Serverbuild (esbuild) | groen |
| Productiebuild web (vite) | groen |
| Regressie: ride-tracker (mobiel) | groen |
| Regressie: cross-account-isolation (accountisolatie, gebruiker A ziet nooit B) | groen |

Scenariodekking: lege-account-/geen-FTP-/geen-hersteldata-/geen-koppelingen-gedrag is per bevinding in de code geverifieerd (F10, F11, F15, F17 — eerlijke lege toestanden bestaan); accountisolatie via de bestaande isolatiesuite; clubisolatie ongewijzigd (geen clubcode geraakt, bestaande least-privilege-laag). Eerder deze sessie is /analyse visueel bevestigd (desktop + smal viewport). De gewijzigde web-flow (F01) is een pure foutpad-staat die alleen bij een API-storing rendert; de mobiele wijzigingen (F02/F03) zijn native-only en met typecheck + ride-tracker-suite geverifieerd.

## 5. Gewijzigde bestanden

- `artifacts/sparki/src/components/sparki/onboarding-gap-fill.tsx` (F01)
- `artifacts/sparki-mobile/lib/volgauto-api.ts`, `app/(app)/navigate/[id].tsx`, `components/VolgautoDriverMode.tsx` (F02)
- `artifacts/sparki-mobile/lib/ble-sensors.ts`, `hooks/useLiveSensors.ts`, `components/LiveSensorsPanel.tsx` (F03)
- Documenten: dit rapport + `docs/SPARKI_MOCK_FALLBACK_INVENTORY.csv`

Geen productiegegevens geraakt; geen databasecorrectie; geen berekeningen gewijzigd.

## 6. Eindstatus

**WP-A03: VERIFIED_FOR_R1** — geen onveilige persoonlijke fallbacks of hardcoded gebruikersdata aanwezig; de drie gevonden eerlijkheids-/isolatiegaten zijn hersteld en alle poorten zijn groen.

**Productiepublicatie nodig: ja** (F01 zit in de webbundel; F02/F03 in de mobiele app — die bereikt gebruikers via de eerstvolgende mobiele build/release, niet via de webpublicatie).
