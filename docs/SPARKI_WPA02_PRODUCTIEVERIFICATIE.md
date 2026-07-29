# SPARKI — Productieverificatie WP-A02 / #383 (taak #399)

**Uitgevoerd:** 29 juli 2026, ±11:50 UTC (direct na publicatie door René).
**Karakter:** publicatiecontrole + read-only hertelling. Geen handmatige databasecorrectie uitgevoerd; de enige databasewijziging is de reeds gemergede #383-opschoning zelf (automatische sweep bij serverstart).

## 1. Publicatie

| Veld | Waarde |
|---|---|
| Gepubliceerde branch/commit | `main` @ `889fcb32` (bevat #390, #402, #403 en de statuscorrectie-doc) |
| Datum/tijd publicatie | 29 juli 2026, vóór 11:50 UTC (door René via Publish) |
| Productie-URL | https://sparki-frontend.replit.app (autoscale, public) |
| Buildstatus | success (`hasSuccessfulBuild: true`) |
| Typecheck vóór publicatie | groen (libs + api-server) |
| Serverbuild vóór publicatie | groen (esbuild) |
| Working tree | schoon, alles gepusht; #390/#402/#403 aantoonbaar in branch |

## 2. Productie-smoketest

- Homepage: HTTP 200; nieuwe frontend-bundle actief (`assets/index-CNWnqUgG.js`).
- API: `/api/healthz` → HTTP 200 `{"status":"ok"}` — server gestart zonder fouten.
- Sterkste bewijs dat de nieuwe build draait: de opschonings-sweep (die alleen in de nieuwe code bestaat) heeft in productie daadwerkelijk gedraaid (zie §3).
- Geen databasewijziging buiten de #383-opschoning: alleen `ai_observations.status` is verschoven van `new` naar `outdated` (nooit verwijderd); totalen per gebruiker ongewijzigd (René 120 rijen totaal, vóór én na).

## 3. Hertelling (#399, read-only, productie-replica)

| Meting | Vóór publicatie (29 jul, eerder) | Ná publicatie |
|---|---|---|
| Status `new` (René, `user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp`) | **120** | **38** ✅ (verwacht: 38) |
| Status `outdated` (René) | 0 | 82 |
| Totaal rijen René | 120 | 120 (niets verwijderd) |
| Actieve observaties met "331" (achterhaalde 331 W-tekst) | aanwezig | **0** ✅ |

**Gebruikersisolatie:** de enige andere gebruiker met observaties (`user_3FgBt2…`) heeft eigen, ongewijzigde totalen (41 rijen; 24 new / 17 outdated via dezelfde reguliere sweep-regels). Geen kruislingse vermenging; alle tellingen strikt per `clerk_id`.

## 4. Conclusie

- Taak **#399: UITGEVOERD** — hertelling levert exact de verwachte 38 actieve observaties; verouderde 331 W-observaties en duplicaten zijn niet meer actief (status `outdated`, auditbaar, niets verwijderd).
- **WP-A02 / #383: VERIFIED_FOR_R1.** De blokkade uit `docs/SPARKI_POST_WP000_STATUSCORRECTIE.md` §3 (120 ≠ 38 doordat productie de oude build draaide) is met deze publicatie opgeheven en de oorzaakanalyse is daarmee bevestigd.
- Geen secrets of tokens gebruikt of getoond; productie-queries liepen read-only via de replica.
