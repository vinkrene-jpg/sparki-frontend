# TESTDEPLOY_SYNC_01 — Opleverdossier acceptatieomgeving (Mirror-toetsomgeving)

Datum: 2026-08-01 · Status: **BUILD_DELIVERED** · Opgeleverd op main-SHA: zie `/version.json` van de omgeving (dossier geschreven op stand `ccc6485f`; de afsluitende dossier-commit schuift de SHA één keer door — omgeving en main bewegen samen).

## 1. Doel en omvang

Eén afzonderlijke, toetsbare niet-productieomgeving, exact op de actuele main-SHA, zonder hot reload, met aantoonbare versie, uitsluitend tegen de testdatabase, met vooraf vastgelegde migratie-, backup- en rollbackafspraken en een volledig doorlopen controlelijst. Productie is in de hele operatie niet gepubliceerd en niet gewijzigd.

Omgevings-URL (acceptatie): de publieke dev-URL van de werkruimte. Productie: https://sparki-frontend.replit.app (onveranderd op de F2-stand `3452844e`).

## 2. EISEN-lijst en status

| # | Eis | Status | Bewijs |
|---|-----|--------|--------|
| 1 | Aparte test-/acceptatieomgeving | ✅ | Publieke dev-URL, los van productie |
| 2 | Niet naar productie publiceren | ✅ | Prod-bundel ongewijzigd (`3452844e`), publicatieknop uitsluitend bij René |
| 3 | Exact op actuele main-SHA | ✅ | `git ls-remote` = lokale HEAD = `/api/version` = `/version.json`, 0 ongecommitte wijzigingen |
| 4 | SHA aantoonbaar | ✅ | `/version.json` (no-store) · buildlabel/testcontext-lint in de UI · `/api/version` |
| 5 | Geen hot-reload-preview | ✅ | Acceptatiemodus: `SPARKI_ACCEPT_MODE=true` ⇒ web-workflow bouwt éénmalig een productiebuild en serveert die bevroren (vite build + preview); geen vite-client in de pagina. Testcontext-identiteiten blijven beschikbaar via ingebakken `__SPARKI_ACCEPT_MODE__` (publicatiebuild bakt hard `false`; server blijft fail-closed) |
| 6 | Migraties alleen tegen testdatabase | ✅ | Migratie 0016 alleen op `heliumdb`; productiedatabase niet benaderd |
| 7 | Vooraf: migratieoverzicht, backup, rollbackplan | ✅ | §3–§5 |
| 8 | Controles: build/typecheck/tests/health/auth/db/kernroutes | ✅ | §6 |
| 9 | Geen productiegegevens wijzigen | ✅ | Geen productieverbinding geopend; enige productie-inzage was lezend (logboeken) |
| 10 | Geen productiepublicatie zonder René | ✅ | Bindende werkafspraak; alleen René geeft vrij |

## 3. Migratieoverzicht

Verschil productiedatabase → teststand:

| Migratie | Doel | Testdatabase | Productiedatabase | Destructief |
|---|---|---|---|---|
| `0016_media_content_status.sql` | Tabel `media_content_status` (F4) | ✅ uitgevoerd | ❌ bewust niet | Nee (alleen toevoegen) |

Volledige historie genummerde migraties: 0001–0010 (legal, AI-consents, coachnotities, Vandaag-historie, plannerweergave, privacyzones, routekandidaten, routegebruik, routeselecties) — alle reeds in beide omgevingen, alle non-destructief. Nummering springt van 0010 naar 0016: tussenliggende wijzigingen gingen via schema-sync (drizzle push).

**Les voor de volgende productievrijgave:** productie mist óók de tabel `ui_preferences` (F1) — de publicatie van 2026-08-01 bevat F1-code maar de tabel is destijds alleen via schema-sync in dev gekomen; productie logt daardoor 500's op `/api/ui-preferences` (app blijft bruikbaar, valt terug op standaard). Bij de volgende vrijgave moeten dus **`ui_preferences` én `media_content_status`** in de schemasync mee. Valt onder bestaande taak #36.

## 4. Backup/herstelpunt (vooraf gemaakt)

- Volledige `pg_dump` van de testdatabase, formaat custom (herstel met `pg_restore --clean`):
  - `testdb_ccc6485f_20260801T090219.dump` (±3,0 MB), lokaal in `/tmp/testdeploy-sync-01/`
  - SHA-256: `434c0a0c3423b8bdc4781a6ce3c4a7b675181429ab51f522a719151e6b3ae222`
  - Bewust niet in de repo (sportersdata hoort niet in versiebeheer). Eerlijke beperking: lokale opslag is tijdelijk; vlak vóór een herstelnoodzaak in seconden opnieuw te maken.
- Code-herstelpunt: elke main-SHA op GitHub.
- Platform-checkpoints (code + database samen), terugzetbaar door René.

## 5. Rollbackplan

- **A — foute wijziging:** vastleggen (SHA + schermbewijs) → `git revert` → push → workflows herstarten; nooit force-push.
- **B — testdatabase beschadigd:** API stoppen → `pg_restore --clean` uit de backup (±1 min) → herstart → controle op bekende fixture.
- **C — hele omgeving terug:** Replit-checkpoint (René's knop).
- **D — acceptatiemodus zelf:** `SPARKI_ACCEPT_MODE` verwijderen + webworkflow herstarten ⇒ terugval op gewone ontwikkelserver.
- Productie: geen rollback nodig (niet aangeraakt); toekomstige prod-rollback = republish van eerdere SHA, uitsluitend door René.

## 6. Controleresultaten (eis 8, alle uitgevoerd op `ccc6485f`)

| Controle | Uitslag | Kern van het bewijs |
|---|---|---|
| Build | ✅ | Web-productiebuild 09:00:02 (bundels + `version.json` uit dist); API esbuild + start 09:00:40 |
| Typecheck | ✅ | Web-tsc groen; `typecheck-api`-keten groen incl. 41 geldige sanity-rapporten + merkcopy-lint |
| Tests | ✅ 6/6 | `test:ui-preferences`, `test:media-status` (10 gevallen), `test:motion`, `test:uitleg-content`, `test:admin-smoke`, `test:health-endpoints` |
| Health | ✅ | `/api/healthz` 200 (let op: heet `healthz`, niet `health`) · `/api/version` · `/version.json` |
| Auth | ✅ | Clerk-login werkt; fail-closed bewezen met tweede API-instantie zónder testschakelaar: 401 zonder auth én 401 mét `x-dev-clerk-id` |
| Databaseverbinding | ✅ | `heliumdb` (PG 16.10), 195 tabellen, 182 profielen, `media_content_status` aanwezig en leeg; API→DB leesproef 200 |
| Kernroutes | ✅ 14/14 | Web: `/`, `/train`, `/you`, `/routes`, `/analyse`, `/meer` · API: today, dashboard, state, routes, entitlements, flags, notifications, passport |

## 7. Spelregels tijdens de Mirror-ronde

- Omgeving bevroren: geen commits tot de ronde is afgerond (deze dossier-commit is de laatste).
- Elke bevinding koppelen aan de SHA uit `/version.json`.
- Testidentiteiten: rolwissel via de testcontext-lint (16 governor-fixtures; geen soigneur/medical-fixture beschikbaar).
- Flags `media_uitleg_motion` / `media_uitleg_dieptekaart` staan default UIT; op verzoek zet ik ze aan voor toets-identiteiten.
