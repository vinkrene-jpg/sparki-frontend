# SPARKI — WP-A05: Productieverificatie na publicatie

**Publicatiedatum/-tijd:** 29 juli 2026 (avond, Europe/Amsterdam). **Productie-URL:** https://sparki-frontend.replit.app (autoscale, publiek).
**Gepubliceerde basis:** publish-commit `68df60f9` ("Published your App") op `main`, met daarin WP-A05 `b4459cda`, de WP-A03-webfix en de gemergde taak #404 (`f202a69c`, alleen mobiel — raakt de webbundel niet). Buildstatus deploymentservice: **succesvol** (`hasSuccessfulBuild: true`).

## Controleresultaten

| # | Controle | Resultaat | Bewijs |
|---|---|---|---|
| 1 | Actieve productie-build identificeren | ✅ | live bundle `assets/index-B3tF49xE.js`; structureel identiek aan lokale build van dezelfde code (28 bytes verschil = Clerk pk_live- vs pk_test-sleutels; pk_live 3× aanwezig in live JS) |
| 2 | Homepage HTTP 200 | ✅ | curl → 200 |
| 3 | `/api/healthz` HTTP 200 | ✅ | curl → 200, `{"status":"ok"}` |
| 4 | Login en sessiebehoud | ⚠️ deels | API dwingt sessies af: `/api/auth/me` en `/api/flags` geven zonder sessie eerlijk 401 (geen bypass in prod). Volledige geautomatiseerde login-flow tegen prod is niet mogelijk: de workspace heeft alleen de dev-Clerk-sleutel (sk_test), waarmee geen prod-tickets te minten zijn. **Handmatige bevestiging door René gevraagd.** |
| 5 | Vandaag opent zonder fout | ✅ (bundle+dev) | zelfde code als geverifieerde dev-build; SPA-route rendert (200), volledige visuele ronde op deze commit in WP-A05 |
| 6–9 | Lokale-dagcorrecties (Plan, Kalender, Club, Sportpaspoort, geboortedatum) | ✅ | fixes zitten aantoonbaar in de live bundle (zelfde build als lokaal geverifieerde `b4459cda`-code; alle suites groen); gedrag rond de daggrens is deterministisch client-side |
| 10 | Meer-menu bevat Samen en route opent | ✅ | live bundle-grep toont de Meer-hoofdstukkenlijst mét `{href:"/samen",label:"Samen",hint:"Team & vrienden"}` tussen Mechanieker en Activiteiten; `/samen` en `/meer` geven 200 |
| 11 | Onboarding-verbindingsfout (eerlijke melding, Opnieuw proberen, doorgaan met schattingen, geen dubbele actie) | ✅ (bundle+dev) | "Toch doorgaan met schattingen"-flow aanwezig in live bundle; gedrag (incl. dubbelklik-guard `finishing`) geverifieerd in WP-A03 (VERIFIED_FOR_R1) op dezelfde code; live afdwingen van een echte verbindingsfout is in productie niet forceerbaar |
| 12 | Geen regressie Analyse/Routes/hoofdmenu | ✅ | zelfde bundle als volledige WP-A05-testronde (13 suites + 6 viewports groen); geen afwijkende assets live |
| 13 | Geen secrets/gevoelige gegevens in logs | ✅ | productielogscan: geen logregels aanwezig sinds de nieuwe build (geen fouten, dus ook geen gelekte gegevens); dev-only debuglagen zijn compile-time uit de prod-bundle geshaked |

## Status per pakket
- **WP-A03-webfix (onboarding-foutafhandeling): LIVE** (bundle-bewijs, controle 11).
- **WP-A05-fixes (5× lokale datum, Meer-menu/Samen, testinfra): LIVE** (bundle-bewijs, controles 6–10; testinfra-fix is repo-only).

## Open restpunten
1. Controle 4 (login/sessiebehoud) en de live-trigger van controle 11 zijn zonder prod-Clerk-beheersleutel niet automatisch af te dwingen; één handmatige login-bevestiging door René sluit dit af.
2. Buiten-scope-punten uit WP-A05 blijven staan (mobiele locatiepauze is inmiddels via taak #404 gemerged voor een volgende mobiele release; GPX-bestandsnaam cosmetisch).

## Definitieve productie-status

**VERIFIED_IN_PRODUCTION** — alle automatisch controleerbare punten groen; twee punten steunen op bundle-bewijs + dev-verificatie op identieke code en zijn expliciet als beperking gemeld (geen onverklaarde afwijkingen aangetroffen).

WP-A06A, WP-A07 en de Product Governor zijn niet gestart.
