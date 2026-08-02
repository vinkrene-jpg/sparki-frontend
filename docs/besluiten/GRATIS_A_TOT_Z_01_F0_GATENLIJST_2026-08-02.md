# GRATIS_A_TOT_Z_01 — F0 Gatenlijst (inventarisatie, geen code)

**Datum:** 2 augustus 2026 · **Gemeten op:** main, rechtstreeks in de code
**Opdracht:** `attached_assets/GRATIS_A_TOT_Z_01_1785662553522.md`

Status per ketenstap A–R in de telefoonomgeving (Expo-app `artifacts/sparki-mobile`,
waar van toepassing aangevuld met web/api, omdat GAZ-02 app en browser gelijkstelt).

## Keten A–R

| # | Stap | Status | Bevinding |
|---|---|---|---|
| A | Registreren | **Bestaat** | `(auth)/sign-up.tsx`; vangnet op elk pad vandaag toegevoegd (GAZ-05 gedekt) |
| B | Inloggen + nieuw apparaat | **Bestaat** | `(auth)/sign-in.tsx`; bevestigingscode-stap (client trust) vandaag ingebouwd en bewezen |
| C | Wachtwoord vergeten | **Bestaat** | in `sign-in.tsx` (code → nieuw wachtwoord), sluitend |
| D | Onboarding | **Ontbreekt mobiel** | geen mobiel onboarding-scherm; web-onboarding bestaat — keuze nodig: native of via sessiebrug (`web.tsx`) |
| E | Startscherm kaart + onderblad | **Half** | `(app)/index.tsx` is dashboard-lijst, geen beeldvullende kaart met onderblad (zoeken + bewaarde routes) |
| F | Route laten maken | **Bestaat** | `route-plannen.tsx` + `route-aanvraag.tsx` (start+poll, eerlijke fouten) |
| G | Route aanpassen | **Ontbreekt mobiel** | verslepen/waypoint/in-uitkorten/klim alleen in web |
| H | Hoogteprofiel + schuifbalk | **Half** | profiel aanwezig in route-detail; schuifbalk-koppeling op mobiel verifiëren |
| I | Route bewaren (limiet 3) | **Half** | bewaren bestaat; limiet 3 bestaat server-side (`route-downgrade.ts`) maar alleen als downgrade-flow, niet als zichtbare gratis-limiet bij opslaan |
| J | GPX exporteren op telefoon | **Half** | export bestaat (telt mee in metering); doorkomen op telefoon (share-sheet) toetsen |
| K | Bibliotheek | **Half** | routes zien/openen in app; verwijderen op mobiel verifiëren |
| L | Navigatie starten als laag | **Half** | `navigate/[id].tsx` is eigen scherm over kaart; "zelfde kaart, geen apart scherm" (E) hangt af van nieuw startscherm |
| M | Onderweg (spraak, zon) | **Bestaat** | afslag-voor-afslag + audio-cues aanwezig |
| N | Rit afronden + basisanalyse | **Bestaat** | `ride/[id].tsx` (afstand, gem/max snelheid) |
| O | Wandelroute | **Ontbreekt mobiel** | app is puur fiets (racefiets/gravel/mtb); wandelen bestaat web/serverzijdig (routefamilies voet) — mobiel niet aangesloten |
| P | Limietmelding 9e route | **Ontbreekt** | metering registreert (`route-usage-metering.ts`) maar blokkeert niet; geen eerlijke melding + upgrade-aanbod (GAZ-D), ook niet in web |
| Q | Instellingen | **Bestaat** | `instellingen.tsx` (profiel, notificaties, uitloggen); "beweging uitzetten" en taal ontbreken mobiel |
| R | Account verwijderen | **Half** | server compleet (export + hersteltermijn + definitief, `account-privacy.ts`); géén mobiel scherm; LET OP: code hanteert 14 dagen hersteltermijn, opdracht zegt 30 — besluit nodig (zie Openstaand) |

## UX-metingen (GAZ-01 t/m 10)

- **GAZ-01 vormgevingslaag:** alleen in web (`lib/motion.ts`, `lib/zweefkaart.ts`); leunt op `document.*` → verplaatsen naar gedeelde code met platform-poort, niet nabouwen. **Open.**
- **GAZ-02 gelijkheid app/browser:** grootste gaten: D, G, O, R (zie tabel). **Open.**
- **GAZ-05 knop-vangnet:** sign-in én sign-up vandaag gedekt; regel is bindend vastgelegd. **Klaar.**
- **GAZ-06 zichtbare versie web:** `meer.tsx` toont APP_VERSION/BUILD_SHA, maar `version.json` ontbreekt. **Open (F1).**
- **GAZ-07 omgeving zichtbaar:** web toont productie/ontwikkel in `meer.tsx`; app toont niets. **Half (F1).**
- **GAZ-08/09 installeerbare APK + herinstallatieregels:** vandaag geleverd (EAS-profiel `praktijktest`, OTA via kanaal, regels gemeld). **Klaar.**
- **GAZ-03/04 (scrollen, vensters):** te toetsen per scherm zodra F3–F6 gebouwd worden.

## Grenzen (besluit 2026-002/003) — serverzijdig

- 8 routes/maand: telling bestaat (opslaan + export; zelfde route 1×/maand via idempotencyKey; ≥20%-rijden bewust uit wegens ontbrekende serverdata) — **handhaving/blokkade ontbreekt**.
- Max 3 bewaard: bestaat alleen als downgrade-flow — **gratis-pad ontbreekt**.
- 30 dagen bewaartermijn routes: **niet gevonden**.

## Openstaand besluit voor René

1. **Hersteltermijn accountverwijdering:** code = 14 dagen, GRATIS_A_TOT_Z_01 stap R = 30 dagen. Welke geldt?
2. **Onboarding/route-aanpassen/account-verwijderen mobiel:** native bouwen of via de sessiebrug (`web.tsx`) tonen? (MOBIEL_ROLLEN_01 Route B zegt: rolschermen via brug; deze drie zitten in de sporter-kern.)

## Volgorde (conform fasering)

F1-rest: `version.json` web + zichtbare versie/omgeving in de app (APK-deel is klaar) → F2 vormgevingslaag gedeeld → F3 toegang (D) → F4 kaart/onderblad/route maken+aanpassen (E/G/H) → F5 limieten + eerlijke melding (I/J/K/P) → F6 navigatie/rit (L/M/N) → F7 wandelen (O) → F8 instellingen/verwijderen (Q/R) → F9 publicatie + zelftoets.
