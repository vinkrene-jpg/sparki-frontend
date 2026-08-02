# MOBIEL_ROLLEN_01 — F0: gekozen samenvoegroute

**Status:** technische keuze vastgelegd door Replit, 02-08-2026 (MR-09: dit is een
technische keuze, geen productbesluit; met één zin terug te draaien).
**Gemeten op:** main, 02-08-2026, rechtstreeks in de code.

---

## 1. Wat er feitelijk deelbaar is (gemeten)

| Laag | Web (`artifacts/sparki`) | App (`artifacts/sparki-mobile`) | Gedeeld vandaag? |
|---|---|---|---|
| API-client | `@workspace/api-client-react` | `@workspace/api-client-react` | **Ja** |
| Datalaag | TanStack React Query | TanStack React Query | **Ja** (zelfde bibliotheek) |
| Zod-schema's | via api-server (`@workspace/api-zod`) | idem | **Ja** (server-side) |
| Rechten | server-side afgedwongen; UI leest `profile.roles`/`activeRole` | server-side afgedwongen | **Ja** (de bron), UI-logica niet |
| UI-technologie | React DOM · Tailwind · shadcn/ds-primitieven · wouter | React Native · StyleSheet · expo-router | **Nee** — onverenigbaar |
| Schil | CommercialShell/ScreenShell + `shellNavForRole` (5 vaste posities) | eigen tabbalk | **Nee** |

De hele intelligentie (rechten, data, flags) is al één laag. Wat dubbel is, is
uitsluitend de **presentatie**. De webkant heeft ±50 pagina's inclusief álle
rolomgevingen; de app heeft 13 schermen die allemaal over rijden gaan.

## 2. Beoordeelde routes

**Route A — volledige universele app (react-native-web):** alle ±50 webpagina's
en het complete designsysteem (Tailwind/oklch/ds-componenten) herbouwen in
React Native. Verworpen: maanden herbouw, elke bestaande webpagina krijgt een
tweede implementatie tijdens de overgang (precies wat MR-24 verbiedt), en de
dagelijkse publish van de webkant zou stilvallen.

**Route C — gedeeld RN-web-pakket alleen voor nieuwe rolschermen:** nieuwe
rolschermen in een derde paradigma dat in beide draait. Verworpen: de
rolomgevingen bestáán al in de webcode (coach-cockpit, ouderomgeving,
rol-start, clubomgeving). Route C zou ze alsnog een tweede keer bouwen —
directe herstelgrond MR-24.

**Route B — GEKOZEN: native kern + ingebedde webomgeving met sessiebrug.**
De Expo-app blijft eigenaar van de vier native onderdelen (MR-08: navigeren ·
rit opnemen · wedstrijddagmodus · achtergrondlocatie) plus hun directe toevoer
(BLE-sensoren, GPX). Alle rolomgevingen en overige schermen rendert de app via
een ingebedde webweergave (`react-native-webview`) die de bestaande webapplicatie
laadt — dezelfde code, dezelfde schil, dezelfde `shellNavForRole`, uit dezelfde
dagelijkse publicatie.

## 3. Waarom Route B

1. **Eén keer bouwen, bewijsbaar (MR-10):** een rolscherm bestaat alleen in
   `artifacts/sparki`; app en browser tonen letterlijk dezelfde build.
2. **Geen uitgeklede mobiele versie (MR-04):** de webomgevingen zijn al
   mobiel-responsief (MUX-standaard, `DsMobileNav`); de app toont ze 1-op-1.
3. **De vier native onderdelen degraderen niet (MR-08):** ze blijven exact de
   bestaande native schermen; regressierisico op de rijfuncties ≈ nul (MR-20/MR-29).
4. **Dagelijkse publish blijft één stroom:** rolschermen komen mee met de
   web-publicatie; de app hoeft alleen door de stores bij wijzigingen aan de
   native kern of de brug (kanaal-header/426-mechanisme bestaat al).
5. **Rechten blijven server-side (MR-16/MR-28):** de webweergave draagt de echte
   Clerk-sessie; er komt geen tweede rechtenlaag.

## 4. Migratiepad per bestaand app-scherm

| Scherm | Pad |
|---|---|
| navigeren (`navigate/[id]`) | **native, ongewijzigd** (MR-08) |
| rit opnemen (`record`) | **native, ongewijzigd** (MR-08) |
| wedstrijddag (`wedstrijddag`) | **native, ongewijzigd**; F7 breidt binnen native uit |
| rit-detail (`ride/[id]`) | native, ongewijzigd (toevoer van opnemen) |
| route plannen / route aanvragen / GPX-import / routelijst (`index`) | native, ongewijzigd in v1 (MR-20 weegt zwaarder dan dedupliceren; samenvoegen kan later per scherm) |
| ritten (`rides`) | native, ongewijzigd in v1 |
| instellingen / support / diagnostiek | native, ongewijzigd in v1 |
| inloggen / registreren (incl. wachtwoord-vergeten) | native (Clerk expo), ongewijzigd — bron van de sessiebrug |
| **alle rolomgevingen** (trainer, hoofdtrainer, clubbeheerder, teammanager, ploegleider, mechanieker, soigneur, medische staf, voedingsdeskundige, ouder, gast, admin) | **web-ingebed** — bestaan alleen in `artifacts/sparki` |

Dubbelingen die vandaag al bestaan (bijv. route plannen native én web) zijn
sporter-schermen, geen rolschermen; MR-24 blijft geldig voor rolschermen en de
sporter-dubbelingen worden per scherm afgebouwd zodra de native variant geen
apparaatfunctie meer nodig heeft.

## 5. De sessiebrug (het enige nieuwe bouwwerk van F0→F1)

- De app is ingelogd via `@clerk/expo`. Voor de webweergave vraagt de app aan de
  api-server een **éénmalig Clerk sign-in-ticket voor de eigen account**
  (server-side gemunt met de Clerk backend-API; nooit voor een ander account,
  bestaand ticketpatroon, 300 s geldig).
- De webweergave laadt `…/sign-in?__clerk_ticket=…&redirect_url=<rolstart>` en
  is daarna een normale, cookie-geauthenticeerde websessie.
- Brug terug: de webschil stuurt `postMessage` voor de vier native handelingen
  (navigeren starten, rit opnemen, wedstrijddag, achtergrondlocatie); de app
  vangt die en opent het native scherm. Web-in-browser toont op die plekken de
  bestaande webgedragslijn.
- Contextregel (rol · organisatie · test/productie) komt uit de webschil zelf
  (SPARKI_HERSTEL_EN_AANVULLING_01 F2) en is daarmee automatisch identiek in
  app en browser.

## 6. Gevolgen

- **Bouwtijd:** F1 = brug + inbedding + contextregel; rolschermen (F2–F6) worden
  uitsluitend in de webcodebasis gebouwd en zijn daarmee direct ook browserwerk.
- **Publicatie:** webwijzigingen bereiken de app zonder store-release; alleen
  brug-/kernwijzigingen vergen een app-release.
- **Native blijft native:** een samenvoegroute die MR-08 raakt is hiermee
  uitgesloten; de vier onderdelen staan niet in de webweergave.
- **Offline:** buiten dit pakket (MR-22); de native kern behoudt zijn bestaande
  offline-gedrag.

## 7. Terugdraaien

Eén zin van René ("kies route A/C") volstaat; er is tot en met F1 niets gebouwd
dat een andere route blokkeert — de brug is additief.
