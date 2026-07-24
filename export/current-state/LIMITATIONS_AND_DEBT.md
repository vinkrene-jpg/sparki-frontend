# Beperkingen, technische schuld en productiestatus — Sparki (24 juli 2026)

## Bekende beperkingen (bewust en eerlijk in de UI gemeld)

1. **Garmin/Wahoo**: code compleet, wacht op fabrikant-API-sleutels (`configured: false`).
2. **E-mail**: geen geverifieerd domein; Resend-sandbox bezorgt alleen aan de accounteigenaar; herinnerings-/meldingsmails slaan eerlijk over.
3. **KNWU-kalender**: volledige kalender achter onbereikbare login-SPA; import eerlijk beperkt.
4. **BLE + achtergrondopname mobiel**: vereisen een native (EAS) build; Expo Go/web melden "niet ondersteund".
5. **Wekker/alarm web**: web kan een vergrendelde telefoon niet laten rinkelen — wordt letterlijk zo gezegd.
6. **Weer in analyses**: weer is beschikbaar op Vandaag (Open-Meteo) maar telt in de observatie-engine bewust als "ontbrekend signaal" voor historische analyses.
7. **Externe afhankelijkheden**: Overpass (POI's/wegtypen), ORS (routing), Open-Meteo — storingen worden eerlijk getoond, nooit met verzonnen data gemaskeerd.
8. **Route-generator**: vrije-tekst-wens stuurt alleen de toelichting (ORS kan geen wegen "kiezen op wens"); eerlijk "kan niet + alternatief".
9. **Exacte FTP**: zonder power-curve alleen een eerlijke ondergrens-afleiding.
10. **Fitbit**: registry-vermelding zonder implementatie (niet aangeboden in UI).

## Technische schuld (klein, gedocumenteerd)

1. **api-server serverbundel is groot** (multi-MB esbuild-bundel; server-side, niet naar de browser — echte verkleining vraagt route-lazy loading).
2. **Testworkflows delen één `dist/`** en moeten sequentieel draaien (build-semafoor + retry-runner aanwezig; workflow-limiet van het platform is bereikt, nieuwe tests draaien via shell).
3. **Drizzle push drift-lussen**: 63-tekens naamafkapping en array-default `'{}'` geven eeuwige no-op-diffs (gedocumenteerd, onschadelijk).
4. **`.migration-backup/`**: originele Next.js-bron als referentie in de repo (bewust bewaard als content-SSOT voor Insights).
5. **pino worker-transport** is flaky in tests/jobs → sync stream in tests (prod JSON ongewijzigd).
6. **Open TODO's/FIXME's in code: 0** (grep bevestigd op exportdatum).

## Productiestatus (deployment)

- Autoscale-deployment voor web+API (Vite-build + esbuild-serverbundel); liveness vereist een antwoord op de kale `/api`-basis (aanwezig).
- Scheduled Deployments nodig voor de vijf jobs (cadans in BACKGROUND_PROCESSES.md); zonder deze draaien alleen de in-proces mechanismen.
- Productie-secrets vereist: Clerk-sleutels, `DATABASE_URL`, `SPARKI_ADMIN_IDS`, Strava-sleutels, `VAPID_PRIVATE_KEY`, `MAPBOX_ACCESS_TOKEN`.
- Mobiel: distributie via releasecandidate-straat + store-distributiekanaal (426-mechanisme; nooit tijdens actieve rit).
- Release-gate: health-check `release`-modus faalt op onopgeloste rode checks — verplicht vóór promotie.
