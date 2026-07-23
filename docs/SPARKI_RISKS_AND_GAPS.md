# Sparki — Risico's en gaten

**Peildatum:** 23 juli 2026. Alle punten zijn onderbouwd met code; er zijn geen verborgen defecten aangetroffen — de genoemde beperkingen worden in de UI eerlijk gecommuniceerd.

## 1. Externe afhankelijkheden (grootste operationele risico)

| Dienst | Gebruikt voor | Risico | Mitigatie in code |
|---|---|---|---|
| Overpass/OSM (publiek) | Routeopmerkingen, wegtypen, POI's, klimmen, verkeerslichten, volgauto-parkings | Geen SLA; time-outs/504's | Eerlijke 502/datanotities, caches, compacte queries, spiegelkeuze (`lib/route-remarks.ts`, `lib/route-surfaces.ts`) |
| openrouteservice | Routegeneratie, volgauto | Quota/latency | Eerlijk "geen route" i.p.v. hemelsbrede lijnen |
| Open-Meteo | Weer (thuis + wedstrijd) | Uitval ⇒ weer ontbreekt | Weer is altijd optioneel; observatie-engine behandelt weer als "missing" |
| Strava API | Import/export, webhook | Token-/quotabeleid Strava | Per-gebruiker OAuth, sync-diagnostiek in admin |
| Anthropic/Gemini (via Replit AI-proxy) | Proza, documentanalyse, foto's | Uitval ⇒ geen verse teksten | Kill switch + deterministische kern blijft werken; `ai_call_logs` metadata-only |

## 2. Bewust beperkte of voorbereide functies

1. **E-mail (Gedeeltelijk):** geen geverifieerd verzenddomein; Resend-sandbox bezorgt alleen aan de accounteigenaar; reminders slaan eerlijk over (`lib/email.ts` r.9–19). **Gat:** sporters ontvangen geen e-mailherinneringen. Oplossing buiten code: domein verifiëren + `REMINDER_FROM_EMAIL`.
2. **Garmin/Wahoo device-sync (Voorbereid):** volledige OAuth/webhook-keten aanwezig maar `configured: false` zonder fabrikantsleutels (`lib/connectors/providers/device-sync.ts` r.14). **Gat:** automatische sync met de twee grootste fietscomputermerken wacht op externe goedkeuring.
3. **BLE-sensoren (Gedeeltelijk):** alleen in de volledige native build; Expo Go/web melden eerlijk "niet ondersteund" (`sparki-mobile/lib/ble-sensors.ts` r.68).
4. **KNWU-kalender (limited):** alleen de ±5 server-gerenderde "Komende wedstrijden"; volledige kalender zit in een onbereikbare SPA — bewust niet nagemaakt (`lib/calendar/`).
5. **Wahoo/Karoo-wedstrijdexport:** geen sync-knop, alleen eerlijke uitleg (bewust; geen publieke push-API).
6. **Fitbit:** registry-vermelding zonder providerimplementatie; wordt in de UI niet als werkend aangeboden.

## 3. Operationele gaten

1. **Scheduled Deployments zijn handwerk:** jobs (health-check daily/weekly/release, goal-review, nachtelijke scan, reminders) bestaan als CLI-commando's; ze doen alleen iets als de gebruiker ze als Scheduled Deployment heeft ingericht. De lees-pad-zelfheling (bijv. nieuwsversheid) dempt maar vervangt dit niet.
2. **Geen lint-configuratie:** typecheck is de enige statische poort; stijl-/bugpatroonanalyse (eslint) ontbreekt in alle werkruimtes.
3. **Testomgevingsvereiste:** api-servertests vereisen `DEV_AUTH_BYPASS=true` + `DATABASE_URL`; buiten de testworkflows kan dit tot vals-negatieve runs leiden (tijdens deze review eenmaal gebeurd; met juiste env 9/9 groen).
4. **Web-bundelomvang:** productie-webbundel geeft chunk-groottewaarschuwing (>500 kB); functioneel onschadelijk, maar route-lazy laden zou de eerste laadtijd verbeteren (bewust niet aangepast — geen bouwopdracht).
5. **`replit.md` groeit fors** (±17k tokens) — als centrale projectdocumentatie waardevol, maar herstructurering zou onderhoud vergemakkelijken.

## 4. Concentratie- en kennisrisico's

1. **Grote samenhangende codebase** (161 tabellen, 74 routebestanden, 38 engines): inwerkkosten hoog; domeinregels leven deels in documentatie/geheugen naast de code.
2. **Eén productie-database zonder migratiebestanden** (drizzle push): wijzigingen zijn per afspraak uitsluitend uitbreidend; discipline is regel-gebonden, niet tool-afgedwongen.
3. **Mobiele distributie:** pilot/productie-buildprofielen staan klaar (eas.json gecontroleerd, geen secrets), maar app-store-distributie is een extern traject met eigen doorlooptijd.

## 5. Wat géén risico bleek

- Geen placeholders, dode knoppen of onbereikbare schermen aangetroffen.
- Geen wachtwoorden/tokens/persoonsgegevens in de reviewdocumenten of eas.json (expliciet gecontroleerd).
- Alle 14 recent opgeleverde opdrachten zijn werkelijk in de code aanwezig en getest (`docs/SPARKI_RECENT_TASK_VALIDATION.md`).
