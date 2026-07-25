# Sparki — feitelijk logboek van herstelwerk, correctierondes en dubbel werk

**Doel en status van dit document.** Dit is een neutraal, feitelijk overzicht op basis van
controleerbare bronnen in dit project (commitgeschiedenis, projectdocumenten, correctieorders).
Het is géén juridisch document, bevat géén schuldtoewijzing aan een persoon of leverancier en
géén kostenberekening — het project bevat geen tijd- of kostenregistratie, dus bedragen zijn
niet uit deze bronnen af te leiden. Voor vragen over kosten of vergoedingen: Replit-support.

**Bronbasis.** 696 commits op `main`, periode 21 juni t/m 25 juli 2026; 82 publicatiemomenten
("Published your App"). Elk item hieronder verwijst naar een commit-hash of document als bewijs.

---

## 1. Verlies en herstel van het oorspronkelijke ontwerp (21–23 juni 2026)

Bij de migratie van Next.js/Vercel naar dit project ging de oorspronkelijke visuele identiteit
("v0") verloren en moest deze in meerdere rondes worden teruggebracht.

| Datum | Bewijs | Feit |
|---|---|---|
| 22 juni | `cefef7d` | "Restore v0 visual identity and update core components" |
| 22 juni | `d3350aa` | "Restore original typography and styling across the application" — typografie was gebroken (lettertype viel terug op browser-serif door een niet-werkende `var(--font-…)`-verwijzing uit de oude stack) |
| 22 juni | canvasorder | Opdracht: "The reported v0 restoration is not visually visible in the preview. Do not make new design changes." — het gemelde herstel was niet zichtbaar; extra ronde nodig |
| 22–23 juni | canvasorder | Opdracht: "Before making further visual refinements, perform a Design Audit. The current frontend no longer resembles…" — volledige ontwerp-audit nodig vóór verdere stappen |
| 23 juni | `8b7d338` | Smart Route Planner moest apart worden teruggezet ("Restore … as feature-flagged Train section") |

## 2. Gebroken basisflows kort na de migratie (23 juni 2026)

| Datum | Bewijs | Feit |
|---|---|---|
| 23 juni | `d8ec89b` | "Fix onboarding flow to prevent profile creation errors" — nieuwe gebruikers konden geen profiel aanmaken |
| 23 juni | `e869aa1` | Onboarding opnieuw gebroken + Engelstalige teksten die naar het Nederlands vertaald moesten worden |
| 23 juni | `f7bcf40` | "Fix Vite configuration to prevent build failures" — build faalde |
| 23 juni | `7dd2cce` | Vastgelegde gebruikersregel "fix errors before review" — nodig geworden doordat opleveringen fouten bevatten |

## 3. Regressies na eerdere opleveringen (juni–juli 2026)

Functionaliteit die werkte, later brak en opnieuw hersteld moest worden.

| Datum | Bewijs | Feit |
|---|---|---|
| 26 juni | `8a190f8` | Modalknoppen verborgen achter de onderste navigatiebalk |
| 29 juni | `67f60ee` | Zelfde inzicht ("Geen check-in") drievoudig getoond op /you |
| 11 juli | `cdae00d` + `e755355` | Identieke fix tweemaal gecommit (Gezondheidscheck Strava-probe) |
| 20 juli | `3ed2581` + `320c20d` | Routegeneratie negeerde vlak/heuvelachtig-voorkeur en doelafstand — twee opeenvolgende fixrondes |
| 20 juli | `fe3360c` | Mobiele nav-app: webbundel crashte |
| 21 juli | `516b1e2` + `fd6f123` | "Voeg een doel toe" landde op het verkeerde formulier — twee fixcommits |
| 22 juli | `84cda8f`, `a45d5e8` | Routeplanner, routedeling, live navigatie, climbfinder en ritafronding hersteld nadat ze gebroken waren |
| 23 juli | `3c6b36b` | Valse "Je wijkt af van de route"-meldingen (web + mobiel) |
| 23 juli | `e833a1c` | Deploy-buildfix nodig bij afronding wedstrijdintelligence |
| 24 juli | `680a9f7` | Race in het ophalen van feature-flags: één mislukte aanroep schakelde o.a. de routeplanner voor gebruikers uit |
| 24 juli | `33f0803` | Publicatie geblokkeerd door mobiele build (Metro-poort + watcher) |
| 23 juni | `96bbb72` (23 juli) | Admin-toegang was verdwenen en moest hersteld worden |

## 4. Review- en correctierondes op opgeleverd werk

| Datum | Bewijs | Feit |
|---|---|---|
| 9 juli | `a1e5869` | Doelen-engine: "review-fixes ronde 2" — twee reviewrondes nodig |
| 10 juli | `987548b` | Drie door tester Dylan gemelde fouten: FTP-reset, verkeerde leeftijd, check-in-volgorde |
| 22 juli | `45c7f97` | Golf 14: extra ronde "architectfixes uitrolbewaking" |
| 23 juli | `8e310c6` | Sociale omgeving: afronding vergde aparte review-fixes |
| 23 juli | `85537bb` | Volgauto: "contractfixes" nodig na eerste oplevering |
| 25 juli | `064ce34` | Routes-opruiming: aparte review-fixronde |

## 5. Eerlijkheids-/mockdata-hersteltraject (23–25 juli 2026)

De projectwet verbiedt nepgegevens. Toch waren er meerdere hersteltrajecten nodig:

| Datum | Bewijs | Feit |
|---|---|---|
| 23 juli | `cef9e91` | Applicatiebrede data-trust audit (mockdata-controle) uitgevoerd |
| 23 juli | `edccd88`, `711a6cb` | "OPDRACHT 0A.1 — data-trust herstellen" + vervolgronde met bewijsvoering |
| 25 juli | `ca5552c` | Fix van "mock data"-klachten: sync-zelfherstel, eerlijk trainingsvolume, gemiddelde snelheid |

## 6. Afgekeurde opleveringen met formele correctieorders (25 juli 2026)

| Datum | Bewijs | Feit |
|---|---|---|
| 25 juli | `6697069` | UX_00A-herstelronde: Engelse labels (R10), afgekapte tegels (R8), naamgeving — correcties op eerdere UX-oplevering |
| 25 juli | `87d46a3` → `b1ba099` | UX_00B eerste oplevering bracht de verkeerde basis in kaart (oude UX_00A-baseline i.p.v. de 8 goedgekeurde Figma-frames); formele correctieorder UX_00B-R1 volgde; het bestand is volledig vervangen |

## 7. Dubbel of overlappend uitgevoerde opdrachten

| Bewijs | Feit |
|---|---|
| `45d815f` + `21fcb7e` (22 juli) | "Afbouwgolf 6 — Coachomgeving (coach cockpit)" komt tweemaal als commit voor |
| `9a0a335` (Golf 10) + `b6cdb09` (Opdracht 15), beide 22 juli | Clubomgeving in twee golven op één dag opgeleverd ("volwaardige clubomgeving" en daarna "uitgebreid") |
| `docs/app-indeling-hoofdmenu.md` + `docs/app-herindeling-hoofdmenu.md` | Twee planbestanden voor herindeling van het hoofdmenu |
| `cdae00d` + `e755355` (11 juli) | Identieke fix tweemaal gecommit (zie ook §3) |
| Taak #290 (25 juli) | Voorgesteld en direct geannuleerd ("Mechanieker-pagina … dev/prod-database") — geen uitgevoerd werk, wel planlast |

## 8. Structurele vertragers (vastgelegd als projectlessen)

Terugkerende technische valkuilen die meerdere keren tijd hebben gekost en daarom als vaste
werkregels zijn vastgelegd (bron: interne lessenregistratie van dit project):

- Testworkflows delen één build-map en moeten strikt na elkaar draaien; parallel starten gaf valse rode tests.
- Datum-afhandeling (UTC vs. lokale Amsterdamse dag) veroorzaakte meerdere off-by-one-fouten.
- Achtergrondprocessen overleven geen sessiegrenzen; lange taken moesten als workflow worden herbouwd.
- Na het samenvoegen van parallel uitgevoerde taken braken kruisverwijzingen; sindsdien is een vaste controle (typecheck + serverbuild) vóór publicatie nodig.
- Zip-/bewijs-opleveringen wisselden per correctieorder van vorm (wel/geen bewijs-zip), wat extra rondes gaf.

---

## Beperkingen van dit overzicht

1. Gebaseerd op wat in dít project controleerbaar is; gesprekken of besluiten buiten het project vallen erbuiten.
2. Geen tijd- of geldbedragen: die registratie bestaat niet in het project.
3. Commitberichten beschrijven het herstel, niet altijd de oorspronkelijke oorzaak; waar de oorzaak vastligt, is die genoemd.
4. Dit document doet geen uitspraak over verantwoordelijkheid of aansprakelijkheid van welke partij dan ook.
