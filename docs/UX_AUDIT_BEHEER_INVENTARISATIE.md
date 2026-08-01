# UX-audit — Module Beheer (UX_AUDIT_MODULES_01A)

> **Testbasis** — branch `main`, vaste gepushte start-SHA `3452844e91a095c97096c361dd86180c5782238b`. Bewijs vastgelegd met eigen headless-browserrun (Chromium/Playwright) tegen de dev-server op exact deze SHA, met de vaste rol-testidentiteiten (governor-fixtures, DEV Preview identiteitsheader `x-dev-clerk-id`). Kanttekening (eerlijkheid): DEV Preview gebruikt een eigen route-tabel en de dev-gebruiker lost op als head-tester, dus flag-gestuurde paginavarianten kunnen afwijken van een echt ingelogde sessie. Geen fictieve data aangemaakt; lege secties zijn echte lege toestanden van de fixture-club.

## Route/URL
- `/admin` (AdminPage), `/admin/ops` (AdminOpsPage), `/admin/health/:checkKey` (detail) — `App.tsx` r775-781. Niet in dev-preview-routetabel (rolgebonden). Meer-menu: "Beheer" (Shield) alleen bij `isAdmin` (`pages/core-meer.tsx` r65/84).
- Gate: `useAdminWhoami` → server `isAdmin(clerkId)` op `SPARKI_ADMIN_IDS` (`routes/admin.ts` r67, `lib/flags.ts` r112); niet-admin → redirect naar `/` (`admin.tsx` r711). In dev geldt de dev-bypass-admin (zo ook vastgelegd op de screenshots).

## Eerste scherm & secties (`/admin`)
"Beheer & gezondheid": OverallBanner (groen/oranje/rood, r50), knop **"Controleer nu"** (r731), Geplande taken (cron-rijen, r752; "Nog opzetten" grijs bij niet-groen r208), Automatische datasync (providerkaarten, r787), Gezondheid per module (CheckRow-links → `/admin/health/:key`), Gegevensbroncontrole (1 veld clerkId, r238), Data-trust-dashboard (r363), Opschoning met **Droogdraai/Uitvoeren** (1 veld + 2 knoppen, r550), Support-, Release-, Entitlements-, Kennisbank-secties, Cijfers-grid (r1250).

## `/admin/ops`
SystemModePanel (modusknoppen + reden-veld + bevestigen; SERVICE_SHUTDOWN eist dubbele bevestiging r125), BuildRatingsPanel (gemiddelde sterren per onderdeel, r163), OpsLogPanel (auditlog, r238).

## Tabs/wizards
Geen tabs (verticaal gestapeld), geen wizards.

## Toestanden
Laden: "Laden…", "Bezig met controleren…" (r745). Leeg/fout: "check failed", "geen acties geregistreerd", "gebruiker niet gevonden" (r318). GREY = eerlijk niet-gemeten (honesty-contract healthcheck).

## Rollen/context, mobiel/desktop
Getest met persona `governor-fixture-admin` onder de dev-adminresolutie; in productie uitsluitend `SPARKI_ADMIN_IDS`. Mobiel: bruikbaar maar zeer lange verticale pagina. Doodlopend: geen; alles bereikbaar vanaf `/admin`.

## Bewijs
- `UX_AUDIT_MODULES_SCREENSHOTS/beheer_admin_{desktop,mobiel}.png`
- `UX_AUDIT_MODULES_SCREENSHOTS/beheer_admin_ops_{desktop,mobiel}.png`
- Codebewijs: `artifacts/sparki/src/pages/admin.tsx`, `pages/admin-ops.tsx`, `artifacts/api-server/src/routes/admin.ts`, `lib/flags.ts` r112.
