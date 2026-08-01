# AANVULLING F1 — audit mobiele shell (commercial_shell) × mobile_routeplanner_v2

Datum: 01-08-2026. Onderzocht op verzoek van René (aanvulling op MOBILE_ROUTE_WALKING_01 F1).

## 1. Waar wordt commercial_shell gedefinieerd?

- **Flag-key:** `lib/feature-flags/src/index.ts` (`FEATURE_KEYS` bevat `commercial_shell`, met omschrijving in `FEATURE_DESCRIPTIONS`).
- **Component:** `artifacts/sparki/src/components/sparki/commercial-shell.tsx` (schil + Vandaag); pure presentatielogica in `artifacts/sparki/src/lib/commercial-shell.ts`; mobiele onderbalk in `bottom-nav.tsx`.
- **Serverresolutie:** `artifacts/api-server/src/lib/flags.ts` → `resolveFlags()`; geleverd via `/api/flags`.

## 2. Voor welke accounts/rollen actief?

Precedentie in `resolveFlags`: user-override → platformpoort → rol/releasegroep/globaal (binnen uitrolpercentage) → head-tester early access → false.

Voor `commercial_shell` geldt in de database: **`enabled_globally = true`**, geen platform- of rolbeperking, geen user-overrides. De schil is dus actief voor **alle accounts en alle rollen** — inclusief René's account en de e2e-testidentiteit. (Sporters krijgen de commerciële nav; coach/ouder krijgen binnen dezelfde schil hun eigen hoofdnavigatie via chapters.ts — dat is rolgedrag ín de schil, geen flaggedrag.)

## 3. Actief op acceptatie (dev-omgeving)?

**Ja.** Dev-database: `feature_flags.commercial_shell.enabled_globally = t`; nul rijen in `user_flag_overrides` voor deze key. Bovendien is de client fail-open: zolang flags laden rendert App.tsx de CommercialShell-variant.

## 4. Actief op productie?

**Ja.** Productie-database (read-only gecontroleerd 01-08-2026): `commercial_shell → enabled_globally = t`, geen overrides. `mobile_routeplanner_v2` bestaat in productie **niet** als rij → resolutie = false (default uit). Er is deze fase niets aan productieflags gewijzigd.

## 5. Welke mobiele schermen hangen aan de schil?

De schil is de enige chrome-eigenaar (gedeelde-shell-doctrine): elke pagina die via ScreenShell rendert, krijgt de CommercialShell-chrome (onderbalk, desktopnav). Direct flag-geschakelde schermen in App.tsx: Vandaag (`CommercialToday`), Trainen (`CorePlanPage`), Activiteiten (`CoreActiviteitenPage`), Analyse (`analyse-switch`), Core-Analyse (/lab), go-gate. De **routeplanner (/routes, route-panel.tsx) rendert bínnen deze schil** — de mobiele onderbalk op het planner-scherm ís de commercial shell.

## 6. Gedrag met flag uit?

`commercial_shell` uit ⇒ de donkere legacy-weergave (oude ScreenShell/Vandaag/TrainPage). `mobile_routeplanner_v2` uit ⇒ exact de bestaande routeplanner-weergave (desktop-stappenteller, niet-sticky knoppen); e2e bewijst dit expliciet (scenario "flag uit").

## 7. Heeft René's huidige account de flag?

**Ja, beide relevant:** `commercial_shell` is globaal aan, dus ook voor René (geen override nodig, geen override aanwezig). `mobile_routeplanner_v2` staat voor René **uit** (default; geen override) — bewust, tot vrijgave.

## 8. Activering per testidentiteit mogelijk?

**Ja.** `user_flag_overrides` (PK clerk_id+flag_key) heeft de hoogste precedentie. De e2e-test gebruikt precies dit pad: override alléén voor de e2e-testidentiteit, in `finally` weer verwijderd. Flag-waarden vóór/tijdens/na staan in `e2e/evidence/routeplanner-mobiel-v2/rapport.json` (`flagConfig`).

## 9. Veilige migratie nodig?

**Nee.** Geen schema- of datamigratie: beide flags bestaan al in het reguliere flags-stelsel; `commercial_shell` staat overal aan en `mobile_routeplanner_v2` is additief en default uit. Uitrol later = flag-rij aanzetten (globaal, per rol of per groep), geen migratie.

## Harde regel getoetst

> "De nieuwe mobiele routeplanner mag niet achter een flag worden gebouwd die op de testidentiteit niet actief is."

Voldaan: tijdens de acceptatietest is `mobile_routeplanner_v2` actief voor de testidentiteit (override), `commercial_shell` is voor diezelfde identiteit actief (globaal), en de e2e-check "mobiele shell (onderbalk) zichtbaar naast wizard" bewijst beide tegelijk op vier telefoon-viewports (screenshots in `e2e/evidence/routeplanner-mobiel-v2/`). Productieflags onaangeroerd.
