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

## Aanvulling 02-08-2026 (F9)

> Nagelezen tegen main `56985d32e8909a55fb30f8c1aadf0c0460a888ff` (2 augustus 2026). De bovenstaande tekst is nagelopen tegen de huidige code en klopt inhoudelijk; alleen de regelnummers zijn verschoven (routes staan nu in `App.tsx` r847-855, niet r775-781). Onderstaande aanvulling verwerkt de nieuwe telefoonstandaard (`SPARKI_TELEFOON_UX_01` v1.1) en vult ontbrekende schermdelen aan.

### Aanvullende schermen/secties (waargenomen in code)
- `/admin` (`admin.tsx` r721): één zeer lange verticaal gestapelde pagina met ~12 secties (OverallBanner, Geplande taken, Automatische datasync, Gezondheid per module, Gegevensbroncontrole, Data-trust-dashboard, Opschoning, Support, Release, Entitlements, Kennisbank, Cijfers-grid). Geen tabs, geen wizard, geen apart detailscherm behalve `/admin/health/:checkKey`.
- `/admin/ops` (ScreenShell): SystemModePanel, BuildRatingsPanel, OpsLogPanel — eveneens verticaal gestapeld.

### F9-regelovertredingen (werklijst)
1. **Geen rol/omgeving zichtbaar op `/admin`** (schendt `TUX-04`/`TUX-03` en F9-regel "rol+omgeving zichtbaar"). Gemeten: `admin.tsx` r721 rendert een kale `<main className="relative min-h-dvh …">` zónder `ScreenShell` en zónder `DsContextRegel`. `DEV_PREVIEW` wordt alleen voor de auth-gate gebruikt (r713), niet als zichtbare omgevingsmarkering. Anders dan `/admin/ops` (dat wél ScreenShell gebruikt) mist `/admin` de permanente rol+omgevingsbadge die de gedeelde `DsContextRegel` (`components/ds/context.tsx` r73-101) levert.
2. **Meerdere primaire acties per scherm** (schendt "max één primaire actie"): "Controleer nu", "Droogdraai", "Uitvoeren", plus modusknoppen op `/admin/ops`. Elke sectie draagt een eigen bevestigende knop; geen enkele primaire.
3. **Ver boven vier kaarten boven de vouw** (schendt "max vier kaarten boven de vouw" + `TUX-24`/`TUX-25`): ~12 secties op één pagina; de hoofdhandeling ("Controleer nu") staat weliswaar bovenaan, maar het merendeel is alleen na lang scrollen bereikbaar. Dit is een `TUX-25`-geval: het scherm is te vol, moet gesplitst worden in tabs of aparte schermen.
4. **Geen tabs waar het hoort** (schendt "2–4 echte tabs"): de twaalf secties lenen zich voor 2–4 tabs (bv. Gezondheid · Data · Beheer · Systeem) maar staan nu allemaal open.
5. **Uitgrijzen i.p.v. weglaten** (schendt "beheeropties weglaten i.p.v. uitgrijzen"): "Geplande taken → Nog opzetten" wordt **grijs** getoond bij niet-groene status (`admin.tsx` r208 in de oude SHA-nummering) i.p.v. weggelaten.
6. **Meerstapshandeling niet als stappenvenster** (schendt `TUX-27`/`TUX-28`): Opschoning (Droogdraai → Uitvoeren) en SERVICE_SHUTDOWN met dubbele bevestiging zijn inline i.p.v. een stappenvenster met zichtbare voortgang.
7. **Details deels inline** (schendt "details apart scherm"): alleen healthchecks hebben een apart detailscherm (`/admin/health/:key`); Data-trust, Opschoning-resultaten en OpsLog tonen detail inline.
