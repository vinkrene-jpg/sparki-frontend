# F9 — BEHEER/ADMIN herindeling: voor & na

**Schermen:**
- `/admin` (pagina `artifacts/sparki/src/pages/admin.tsx`)
- `/admin/ops` (pagina `artifacts/sparki/src/pages/admin-ops.tsx`)

**Toestel:** telefoonformaat **402 × 874** (kleinste ondersteunde maat).

**Bewijs:** deze schermen vereisen een echt **admin-recht** op de server
(`whoami.isAdmin`); niet-admins worden door de server naar `/` teruggestuurd.
Het vaste QA-account uit de WP-S1-harnas is **geen admin**, dus de gebruikelijke
Clerk-ticketlogin komt niet voorbij de admin-guard. De harness
`e2e/tests/f9-admin.mjs` is toegevoegd en draait dezelfde echte-klik-flow als
`f9-clubbeheer.mjs`; hij **detecteert en meldt eerlijk** wanneer het QA-account
geen admin is (dan legt hij de redirect-staat vast in plaats van te doen alsof).
Wanneer een admin-QA-account beschikbaar is:

```
F9_SHOT_DIR=voor node e2e/tests/f9-admin.mjs   # tegen de oude build (git HEAD)
F9_SHOT_DIR=na   node e2e/tests/f9-admin.mjs   # tegen de nieuwe build
```

Zolang er geen admin-QA-account is, rust het bewijs op **de code zelf** en op de
**geautomatiseerde rendertest** `artifacts/sparki/src/pages/admin-page-smoke.test.tsx`,
die met gevulde én lege data door de vier tabs klikt en per tab de juiste
secties aantoont (2/2 groen), plus dat de destructieve opschoning pas verschijnt
ná het openen van het stappenvenster.

## Meetbaar verschil

| | `/admin` voor | `/admin` na |
|---|---|---|
| Schil | bare `<main>` — **géén ScreenShell**, dus **geen rol/omgeving-badge** | `ScreenShell section="admin"` → gedeelde ContextRegel (rol + omgeving) zichtbaar |
| Indeling | **15 `<section>`-blokken** onder elkaar in één lange scroll | kop + 1 primaire actie + gezondheidsbanner + **4 échte tabs** |
| Primaire acties | meerdere gelijkwaardige knoppen verspreid door de scroll | precies **1** primaire knop in de kop ("Controleer nu") |
| Destructief | gegevens-opschoning **inline** in de scroll | achter een apart **stappenvenster** met droogdraai → expliciete bevestiging |

| | `/admin/ops` voor | `/admin/ops` na |
|---|---|---|
| Schil | ScreenShell aanwezig (badge OK) | ongewijzigd (ScreenShell blijft) |
| Indeling | 3 panelen onder elkaar (Systeemmodus · Beoordelingen · Auditlog) | **3 échte tabs** (Systeem · Beoordelingen · Auditlog) |
| Destructief | SERVICE_SHUTDOWN als modusknop met inline `window.confirm` | achter een apart **bevestigingsvenster** (verplichte reden + bevestigingsvinkje) |

(Vóór-cijfers gemeten op `git HEAD`: `grep -c "<section"` = 15; `grep -c
"ScreenShell"` = 0; `grep -c "<main"` = 1 voor `admin.tsx`. Ops had geen
`role="tab"`/`HoofdstukTabs`.)

## Nieuwe indeling — `/admin` (vier tabs)

Kop + gezondheidsbanner (kerninformatie) + één primaire actie staan in beeld bij
openen; daaronder de tabbalk. Niets wordt weggelaten — alles wat vroeger
inline stond, leeft nu onder een tab of achter een venster.

- **Overzicht** — kerncijfers ("In één oogopslag"), aandachtspunten
  (open storingen), geplande taken, en de doorverwijzing naar het
  operationele beheer (Ops-dashboard).
- **Gezondheid** — automatische datasync, Sparki-denkkracht (gateway),
  gezondheidschecks per categorie, testgeschiedenis en release-controles.
- **Signalen** — feedback-inbox (bugmeldingen), sporterfeedback, mislukte
  imports, en kwaliteit van analyses.
- **Gegevens** — gegevensbroncontrole, DataTrust-dashboard, support-/release-/
  rechten-/kennisbankbeheer, cijfers, en de **knop** "Opschoning openen" die het
  destructieve stappenvenster start.

## Nieuwe indeling — `/admin/ops` (drie tabs)

- **Systeem** — huidige systeemmodus + niet-destructieve modiwissel inline;
  de destructieve "Dienst stoppen" is een aparte knop die een
  bevestigingsvenster opent.
- **Beoordelingen** — build-ratings-paneel.
- **Auditlog** — admin-ops-log.

## Destructieve acties achter een venster

- `/admin`: de gegevens-opschoning zit in een `BeheerSheet` (titel
  "Gegevens-opschoning"). De opschoning zelf (met droogdraai en expliciete
  bevestiging) verschijnt **pas na** het klikken op "Opschoning openen" — de
  rendertest bevestigt dat "Droogdraai" niet inline op de pagina staat en wél
  in het geopende venster.
- `/admin/ops`: SERVICE_SHUTDOWN is uit de gewone modusknoppen gehaald en zit in
  een apart venster met een **verplichte reden** + een **bevestigingsvinkje**
  ("Ik begrijp dat dit de dienst voor iedereen stilzet") voordat de knop
  "Dienst stoppen" bruikbaar wordt.

## Per F9-regel

1. **Hoofdhandeling + kerninfo in beeld bij openen** — kop, gezondheidsbanner en
   één primaire knop staan boven de tabbalk; geen gedwongen scroll voor de
   kerninformatie. (TUX-24/26)
2. **Eén primaire actie per scherm** — `/admin` toont precies één primaire knop
   ("Controleer nu"). Op `/admin/ops` blijft "Modus instellen" de enige primaire
   actie; de destructieve shutdown is visueel apart (rood) en achter een venster.
3. **2–4 échte tabs** — `/admin` heeft vier gevulde tabs, `/admin/ops` drie;
   geen lege tabs.
4. **Onbevoegden: WEGLATEN, niet uitgrijzen** — de admin-guard (`Redirect to "/"`
   bij niet-admin) blijft ongewijzigd; er zijn geen nieuwe uitgegrijsde opties
   toegevoegd. De "nog opzetten"-status van geplande taken is **eerlijke
   gezondheidsstatus** (geen beheeroptie) en blijft daarom staan.
5. **Details naar apart scherm/venster** — de destructieve opschoning en de
   shutdown openen als venster i.p.v. inline.
6. **ScreenShell bezit de chrome** — `/admin` is nu in `ScreenShell section="admin"`
   gewikkeld met `terug={false}` (de pagina heeft geen eigen terugknop meer; de
   ContextRegel met rol + omgeving komt uit de gedeelde schil). Er zijn géén
   wijzigingen aan `screen-shell.tsx` nodig geweest.
7. **NL-copy, nooit "Sparki <werkwoord>"** — `check-brand-copy` groen.

## Verificatiepoorten (uitgevoerd)

- `npx tsc --noEmit` (in `artifacts/sparki`) — **schoon**.
- `npm run test:admin-page-smoke` — **2/2 groen** (klikt door alle vier tabs met
  gevulde én lege data; controleert dat de destructieve opschoning achter het
  venster zit).
- `npm run test:navigation` — **12/12 groen**.
- `node scripts/check-brand-copy.mjs` — **groen** (geen verboden merkvermeldingen).

## Eerlijke beperking

Er zijn (nog) **geen live screenshots** in `voor/`/`na/`: de admin-schermen
zitten achter een echte server-side admin-guard en het QA-account is geen admin,
dus de WP-S1-ticketlogin komt er niet langs. De harness `f9-admin.mjs` staat
klaar en meldt dit expliciet; zodra een admin-QA-account bestaat, levert hij de
voor/na-opnamen op 402×874. Tot dan onderbouwen de rendertest en de code
(hierboven) de herindeling.
