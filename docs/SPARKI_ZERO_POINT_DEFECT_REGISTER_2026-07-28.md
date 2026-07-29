# Sparki — Zero-point Defectregister

## 1. Titel en snapshot

| Veld | Waarde |
|---|---|
| Document | SPARKI_ZERO_POINT_DEFECT_REGISTER_2026-07-28.md |
| Repository | vinkrene-jpg/sparki-frontend |
| Branch | main |
| Snapshot-commit | `76d2285b23cd517d4ae93e31e9dd24a2bc5f0d46` |
| Master plan | SPARKI_AI_MASTER_PLAN_v2_86.yaml |
| Uitgangspunt | Code- en runtimebewijs gaan vóór oude chatclaims en documentatieclaims |
| Auteur van dit document | Claude, als CONSISTENCY_OWNER / EVIDENCE_OWNER conform het master plan |
| Status | LEVEND DOCUMENT — wordt bijgewerkt naarmate items worden bevestigd, gerepareerd of geverifieerd |

Dit document is vanaf nu de enige centrale bron voor: bevestigde fouten, nog te bevestigen codebevindingen, runtimevalidaties, ontbrekende bouwscope, open product-/architectuurbesluiten, en herstelstatus met bewijs.

## 2. Regels en definities

**Regel:** iets wordt alleen "hard bevestigd" genoemd wanneer de oorzaak uit code, databasebewijs of runtimebewijs aantoonbaar is. Een tekstrapport alleen is nooit voldoende bewijs om een item te sluiten.

**Statussen:** OPEN · NEEDS_CONFIRMATION · NEEDS_RUNTIME_VALIDATION · READY_FOR_FIX · IN_PROGRESS · FIXED_NOT_VERIFIED · VERIFIED_FIXED · BLOCKED · ACCEPTED_AS_IS

**Categorieën:** DEFECT · CODE_RISK · RUNTIME_VALIDATION · MISSING_SCOPE · OPEN_DECISION · TECHNICAL_DEBT

**Ernst:** P0 (security/privacy/dataverlies) · P1 (blocker of onjuiste persoonlijke data) · P2 (grote functionele of responsive fout) · P3 (kleinere gebruiks-/visuele fout) · P4 (technische schuld/onderhoud)

## 3. Managementsamenvatting

Commit `76d2285` is **geen definitief 0-punt**. Er zijn 7 fouten hard bevestigd met code-evidence (A-01 t/m A-07), 1 codebevinding inmiddels ook hard bevestigd maar wachtend op een productbesluit (A2-01), 3 items die runtimevalidatie vereisen los van codewijziging (R-01 t/m R-03), 7 stukken bouwscope die alleen besloten/gedocumenteerd zijn of nog volledig ontbreken (B-01 t/m B-07), 4 open product-/architectuurbesluiten (C-01 t/m C-04), en 1 stuk technische schuld (T-01). Eén item uit een eerdere hypothese (`/you` vs `/profiel/:clerkId`) is onderzocht en is **geen** defect.

De belangrijkste observatie: de master plan loopt op sommige domeinen (Stripe/billing, AI Operations, technische founder-succession) ver voor op de code. Dat is op zichzelf geen fout, maar deze onderdelen mogen niet langer de indruk wekken dat ze "bijna klaar" zijn — ze zijn 0% geïmplementeerd.

## 4. A — Bevestigde fouten vóór het 0-punt

### A-01 — Plan-acties lopen buiten de kaart
- **Categorie:** DEFECT · **Ernst:** P2 · **Zekerheid:** Hard bevestigd (code) · **Status:** VERIFIED_FIXED
- **Route/rol/scherm:** `/train` (Plan), alle rollen, dagdetail-kaart naast de kalender
- **Bestand/regel:** `artifacts/sparki/src/pages/core-plan.tsx:364` (actierij), `:686` (`lg:w-64 lg:shrink-0`-container); `artifacts/sparki/src/components/ds/button.tsx:15` (`whitespace-nowrap`)
- **Bewijsbron:** Statische code-inspectie (Claude, deze sessie)
- **Technische oorzaak:** De dagdetail-kaart is vanaf `lg` (≥1024px) vastgezet op `lg:w-64` (256px). Daarbinnen zet `GeselecteerdeDagKaart` (regel 364) tot drie `DsButton`'s ("Training bekijken", "Afronden", "Overslaan") in een `flex flex-col sm:flex-row`-rij. `DsButton` zet systeemwijd `whitespace-nowrap` + `px-5`. Drie niet-afbrekende knoppen met padding passen niet in 256px.
- **Gebruikersimpact:** Actieknoppen op de trainingsdag-kaart zijn op desktop gedeeltelijk onbereikbaar of overlappen.
- **Data-/privacy-/veiligheidsimpact:** Geen.
- **Minimale veilige oplossing:** Lokale actierij in `core-plan.tsx` verticaal houden (`flex-col`) op alle breedtes, of container-aware laten wrappen (`flex-wrap`). Geen systeemwijde wijziging van `DsButton` zonder regressietest, want `whitespace-nowrap` wordt elders in de app bewust gebruikt.
- **Verplichte tests/viewports:** 390, 768, 1024, 1280, 1440px; geen horizontale overflow; alle acties klikbaar/bereikbaar.
- **Afhankelijkheden:** Geen.
- **Eigenaar:** Replit (implementatie), Claude/ChatGPT (verificatie)
- **Blokkade:** Geen
- **Verificatiebewijs:** Fix in commit `7625ec197d84a13bb7f764fd42c2df93c90a8a57`: actierij in `core-plan.tsx` (`GeselecteerdeDagKaart`) is nu altijd `flex flex-col gap-2` — `sm:flex-row` verwijderd, primaire actie ("Training bekijken") blijft bovenaan, knoppen vullen de kaartbreedte (≥44px hoog). Geen wijziging aan `DsButton` (niet nodig). Geverifieerd met screenshots van de actieve `/train`-route op 390, 768, 1024, 1280 en 1440px: alle drie de knoppen volledig binnen de kaart, geen afgekapte tekst, geen horizontale overflow; kalender en detailkaart verder ongewijzigd. Bewijs: `screenshots/train-1024-na-fix.jpg`, `screenshots/train-1440-na-fix.jpg` (zelfde commit). Statusgang: READY_FOR_FIX → FIXED_NOT_VERIFIED (na implementatie) → VERIFIED_FIXED (na viewport-tests met screenshots, 2026-07-28).
- **Laatst bijgewerkt:** 2026-07-28

### A-02 — Analyse-acties verwijzen naar dezelfde route
- **Categorie:** DEFECT · **Ernst:** P2 · **Zekerheid:** Hard bevestigd (code) · **Status:** VERIFIED_FIXED
- **Route/rol/scherm:** `/analyse`, lege-grafiek-status (`LegeGrafiek`)
- **Bestand/regel:** `artifacts/sparki/src/pages/core-analyse.tsx:180` ("Platform koppelen") en `:189` ("Rit importeren")
- **Bewijsbron:** Statische code-inspectie
- **Technische oorzaak:** Beide knoppen roepen letterlijk dezelfde handler aan: `onClick={() => navigate("/connect")}`. Kopieerfout — "Rit importeren" is nooit gekoppeld aan een eigen importflow.
- **Gebruikersimpact:** "Rit importeren" doet iets anders dan de labeltekst belooft; gebruiker verwacht een handmatige/losse import, krijgt de platform-koppelflow.
- **Data-/privacy-/veiligheidsimpact:** Geen.
- **Minimale veilige oplossing:** "Platform koppelen" blijft naar `/connect`. "Rit importeren" moet naar de daadwerkelijke importflow (bijv. handmatige activiteit-upload) — geen nieuwe route verzinnen zonder eerst te bepalen of die al bestaat elders in de app.
- **Verplichte tests/viewports:** Functionele klik-test op beide knoppen; bevestigen dat ze naar verschillende, correcte bestemmingen navigeren.
- **Afhankelijkheden:** Vereist onderzoek of een losse "rit importeren"-flow al bestaat (bijv. bij Activiteiten) voordat de fix wordt gekozen. → Onderzocht: de bestaande, werkende importflow is het `ActivityImportPanel` (FIT/GPX/TCX-upload) op Sparki Connect (`/connect`, sectie "Bestand importeren"); geen nieuwe route of dubbel importsysteem nodig.
- **Verificatiebewijs:** "Rit importeren" in `LegeGrafiek` (`core-analyse.tsx`) navigeert nu naar `/connect?focus=import`; `sparki-connect.tsx` leest het bestaande `?focus=`-patroon en scrolt direct naar de bestandsimport-sectie (bestaand `ActivityImportPanel`). "Platform koppelen" blijft naar `/connect` (koppelingen bovenaan) gaan — de knoppen hebben aantoonbaar verschillend gedrag; import verwerkt via de bestaande datalaag, annuleren/terug = gewone navigatie zonder dataverlies. Geverifieerd met screenshots op 390 en 1440px: landing direct op "Bestand importeren"/"Bestand uploaden" (`screenshots/connect-focus-import-390.jpg`, `screenshots/connect-focus-import-1440.jpg`); geen consolefouten. Statusgang: READY_FOR_FIX → FIXED_NOT_VERIFIED → VERIFIED_FIXED (2026-07-28). Commit-SHA: zie commit met deze registerwijziging.
- **Eigenaar:** Replit / ChatGPT (onderzoek bestaande importflow), dan implementatie
- **Blokkade:** Onderzoek naar bestaande importflow nog niet gedaan
- **Verificatiebewijs:** Nog te leveren
- **Laatst bijgewerkt:** 2026-07-28

### A-03 — Ontdekken-voorkeuren mengen tussen accounts
- **Categorie:** DEFECT · **Ernst:** P2 (voorkeursdata, geen gezondheids-/betaalgegevens; wel accountoverstijgende zichtbaarheid van persoonlijk gedrag — vandaar niet P1) · **Zekerheid:** Hard bevestigd (code) · **Status:** VERIFIED_FIXED
- **Route/rol/scherm:** `/feed` (Ontdekken), alle rollen
- **Bestand/regel:** `artifacts/sparki/src/lib/feed-prefs.ts:28`
- **Bewijsbron:** Statische code-inspectie
- **Technische oorzaak:** `const KEY = "sparki.ontdekken.prefs.v1"` — één globale localStorage-sleutel zonder clerkId- of gebruikersscope.
- **Gebruikersimpact:** Op een gedeeld apparaat (bijv. familie-tablet, testtoestel) kunnen bewaarde items en "minder hiervan"-voorkeuren van de ene gebruiker zichtbaar blijven bij een andere die op hetzelfde apparaat inlogt.
- **Data-/privacy-/veiligheidsimpact:** Persoonlijke interesse-/gedragsdata (wat je bewaart, wat je dempt) lekt tussen accounts op hetzelfde apparaat. Geen gezondheids- of betaalgegevens betrokken.
- **Minimale veilige oplossing:** Sleutel per gebruiker scopen (bijv. `sparki.ontdekken.prefs.v1.${clerkId}`). Migratie van de oude ongescoped sleutel alleen eenmalig en veilig (niet automatisch aan een willekeurige ingelogde gebruiker toekennen). Bij logout/accountwissel nooit voorkeuren van de vorige gebruiker tonen.
- **Verplichte tests/viewports:** Functioneel: twee accounts op hetzelfde apparaat/browser-profiel, bevestigen dat voorkeuren niet mengen; logout/login-cyclus.
- **Afhankelijkheden:** Geen.
- **Eigenaar:** Replit (implementatie)
- **Blokkade:** Geen
- **Verificatiebewijs:** Sleutel is nu gebruikersgebonden: `sparki.ontdekken.prefs.v1.<clerkId>` (`feedPrefsKey()` in `lib/feed-prefs.ts`); gekozen user-id = `clerkId` uit de bestaande `UserContext` (geen displayName/e-mail, geen tweede context, geen mutable user-state in de lib — id wordt expliciet per aanroep doorgegeven). Migratiegedrag: oude globale sleutel wordt éénmalig toegekend aan de eerste ingelogde gebruiker zónder eigen sleutel, markering `sparki.ontdekken.prefs.migrated.v1` wordt gezet en de oude sleutel wordt daarna altijd verwijderd (corrupte legacy-JSON wordt weggegooid, nooit doorgegeven); een tweede account krijgt de oude data dus nooit. Zonder user-id wordt niets in localStorage gelezen/geschreven (sessie-only). Accountwissel zonder herladen: `/feed` herlaadt de voorkeuren via een effect op `clerkId` — geen oude React-state. Bewijs A→B→A + randgevallen: 8 unit-tests in `lib/feed-prefs.test.ts` (`pnpm --filter @workspace/sparki run test:feed-prefs`, alle groen 2026-07-28): sleutels verschillend per user-id; A→B→A zonder lek; eenmalige veilige migratie; migratie overschrijft nooit een eigen sleutel; corrupte opslag ⇒ leeg; geen user-id ⇒ geen globale opslag; geblokkeerde opslag (incognito) crasht niet; limiet 200 bewaarde items gehandhaafd. Statusgang: READY_FOR_FIX → FIXED_NOT_VERIFIED → VERIFIED_FIXED. Commit-SHA: zie commit met deze registerwijziging.
- **Laatst bijgewerkt:** 2026-07-28

### A-04 — Sfeerbeeld kan als bronfoto worden geïnterpreteerd
- **Categorie:** DEFECT · **Ernst:** P3 · **Zekerheid:** Hard bevestigd (code) · **Status:** VERIFIED_FIXED
- **Route/rol/scherm:** `/feed` (Ontdekken), kaarten met afbeelding (nieuws, materiaal, trainingstip, etc.)
- **Bestand/regel:** `artifacts/sparki/src/pages/feed.tsx` (beeld-chip-rendering, rond de `TYPE_META`-chip op de afbeelding)
- **Bewijsbron:** Statische code-inspectie
- **Technische oorzaak:** De chip op de afbeelding toont alleen een categorielabel (icoon + "NIEUWS"/"MATERIAAL"/etc.). Codecommentaar bevestigt de bedoeling ("nooit gepresenteerd als foto van het artikel zelf"), maar dat onderscheid is nergens zichtbaar in de gerenderde UI.
- **Gebruikersimpact:** Gebruiker kan een generiek sfeerbeeld aanzien voor de daadwerkelijke foto bij het nieuwsbericht/materiaal.
- **Data-/privacy-/veiligheidsimpact:** Geen directe privacy-impact; wel een data-trust-kwestie (gepresenteerde herkomst klopt niet).
- **Minimale veilige oplossing:** Klein, rustig label toevoegen (bijv. "Sfeerbeeld") op of naast de chip — geen zware overlay, geen extra tekst over drukke fotodelen.
- **Verplichte tests/viewports:** Visuele check 390/768/1440px; label leesbaar zonder contrastprobleem; geen overlap met bestaande categorie-chip.
- **Afhankelijkheden:** Geen.
- **Eigenaar:** Replit (implementatie)
- **Blokkade:** Geen
- **Verificatiebewijs:** In `feed.tsx` (FeedKaartView) is een compact label "Sfeerbeeld" toegevoegd, rechtsonder in het beeldvak (`bg-black/45`-pil, mono 8px caps, backdrop-blur — visueel ondergeschikt, geen zware overlay, geen tekst over drukke fotodelen). Onderscheid is expliciet in code, niet op bestandsnaam: `artikelBeeld` (echte artikelfoto uit `kaart.beeldUrl`, alleen bij `ref.nieuwsId`) vs `beeld` (atmosphere-bibliotheek via `beeldVoor()`) vs geen beeld. Label rendert uitsluitend bij `!artikelBeeld && beeld` — een echte bronfoto krijgt het label dus nooit; kaarten zonder beeld ongewijzigd. Categoriechip linksboven behouden (nooit dubbel); sfeerbeeld blijft decoratief met `alt=""`; label is tekstueel ("SFEERBEELD") en dus zonder kleur begrijpelijk, wit-op-donkere pil = voldoende contrast. Feedvolgorde/personalisatie onaangeraakt. Visueel geverifieerd op 390 en 1440px (wedstrijdkaart met sfeerbeeld toont label; nieuwskaart met echte artikelfoto zonder label): `screenshots/feed-sfeerbeeld-390.jpg`, `screenshots/feed-sfeerbeeld-1440.jpg`; geen nieuwe consolefouten (alleen bekende flag-403 tijdens Clerk-settling). Statusgang: READY_FOR_FIX → FIXED_NOT_VERIFIED → VERIFIED_FIXED (2026-07-28). Commit-SHA: zie commit met deze registerwijziging.
- **Laatst bijgewerkt:** 2026-07-28

### A-05 — Reduced-motion niet consequent toegepast
- **Categorie:** DEFECT · **Ernst:** P3 · **Zekerheid:** Hard bevestigd (code) · **Status:** VERIFIED_FIXED
- **Route/rol/scherm:** `/analyse` (en mogelijk andere schermen met eigen skeletons)
- **Bestand/regel:** Drie losse skeleton-implementaties bevestigd: `artifacts/sparki/src/components/ui/skeleton.tsx` (gedeeld, `animate-pulse`, geen motion-guard), `artifacts/sparki/src/pages/feed.tsx:402` (lokaal, gebruikt wél `motion-safe:animate-pulse`), `artifacts/sparki/src/pages/core-analyse.tsx:152` (lokale `Skel`, `animate-pulse`, geen motion-guard)
- **Bewijsbron:** Statische code-inspectie
- **Technische oorzaak:** De eerder gemelde reduced-motion-fix is alleen lokaal in `feed.tsx` doorgevoerd, niet in de gedeelde component of in `core-analyse.tsx`'s eigen `Skel`. Drie losse implementaties van in wezen hetzelfde component is zelf ook een onderhoudsprobleem (duplicate component pattern).
- **Gebruikersimpact:** Gebruikers met "verminderde beweging" ingeschakeld krijgen op Analyse en mogelijk elders alsnog pulserende animatie te zien.
- **Data-/privacy-/veiligheidsimpact:** Toegankelijkheidsregressie.
- **Minimale veilige oplossing:** Systeemwijd inventariseren welke schermen een eigen skeleton-implementatie hebben; ofwel allemaal laten verwijzen naar één gedeelde, motion-safe component, ofwel elke lokale variant individueel voorzien van `motion-safe:`/`motion-reduce:animate-none`. Geen animatieverlies voor gebruikers zonder de voorkeur.
- **Verplichte tests/viewports:** Test met `prefers-reduced-motion: reduce` geëmuleerd, op alle pagina's met een laadstatus.
- **Afhankelijkheden:** Overlapt met T-01-achtige opruiming (duplicate components) — mogelijk in één keer combineren met een generieke skeleton-consolidatie.
- **Eigenaar:** Replit (implementatie)
- **Blokkade:** Geen
- **Verificatiebewijs:** Inventaris: ~70 actieve bestanden gebruiken `animate-pulse`/`animate-spin`/`animate-ping` (o.a. gedeelde `ui/skeleton.tsx`, `ui/spinner.tsx`, `App.tsx`-opstartscherm, `core-analyse.tsx` `Skel`, Connect/import-spinners, coach-cockpit, voeding). Per bestand patchen is foutgevoelig; gekozen kleinste veilige patroon = één centrale vangrail in `src/index.css`: onder `@media (prefers-reduced-motion: reduce)` staan `.animate-pulse/.animate-spin/.animate-bounce/.animate-ping` op `animation: none !important` — dekt álle bestaande en toekomstige gebruikers, terwijl gewone gebruikers alle animaties behouden. Bewust alleen oneindige loopanimaties: transities en eenmalige statusovergangen blijven werken, dus geen verborgen content en eindtoestanden verschijnen direct. Statische indicatoren blijven zichtbaar (spinner-ring/skeletonvlak zonder beweging) en laadstatus blijft tekstueel gedragen; `App.tsx`-opstartscherm kreeg `role="status"`/`aria-live="polite"` + `aria-hidden` op de ring + expliciet `motion-reduce:animate-none`; gedeelde `ui/spinner.tsx` had al `role="status"`. Scene-achtergrondanimaties waren al gedekt door een bestaand reduced-motion-blok. Bewakingstest: `src/lib/reduced-motion.test.ts` (script `test:reduced-motion`, 3 tests groen 2026-07-28) parseert de reduced-motion-blokken in de brón `index.css` en faalt zodra de vangrail of de scene-dekking verdwijnt — geen grep over gegenereerde bestanden. Visueel: normale instelling ongewijzigd (screenshot `screenshots/reduced-motion-analyse-390.jpg`, geen layoutverspringing, geen consolefouten); reduced-motion-gedrag is deterministisch via de CSS-mediaquery en door de statische test geborgd. Statusgang: READY_FOR_FIX → FIXED_NOT_VERIFIED → VERIFIED_FIXED (2026-07-28). Commit-SHA: zie commit met deze registerwijziging.
- **Laatst bijgewerkt:** 2026-07-28

### A-06 — Lab/Analyse wijkt af in dev-preview
- **Categorie:** DEFECT · **Ernst:** P2 · **Zekerheid:** Hard bevestigd (code) · **Status:** VERIFIED_FIXED
- **Route/rol/scherm:** `/lab` (productie-redirect) vs. dev-preview "Lab"-ingang
- **Bestand/regel:** `artifacts/sparki/src/App.tsx:668-670` (`<Route path="/lab"><Redirect to="/analyse" /></Route>`); `artifacts/sparki/src/components/sparki/dev-preview.tsx:91` (menu-item "Lab" → `/lab`), `:426-428` (eigen if/else-tak die `CoreAnalysePage` rendert, met commentaar dat dit "productie mirrort")
- **Bewijsbron:** Statische code-inspectie
- **Technische oorzaak:** Productie gebruikt een echte `<Redirect>`. Dev-preview herbouwt dat gedrag handmatig in een losse if/else-tak in plaats van dezelfde Route/Redirect-definitie te hergebruiken. Nu identiek resultaat, maar het is een met de hand bijgehouden kopie: verandert de echte redirect-doelpagina of de logica in `AnalyseSwitchPage` (bijv. door feature-flags of tier-gating), dan loopt dev-preview niet automatisch mee.
- **Gebruikersimpact:** Geen impact op eindgebruikers vandaag; risico voor ontwikkelaars/testers die dev-preview gebruiken om productiegedrag te verifiëren.
- **Data-/privacy-/veiligheidsimpact:** Geen direct, wel risico op verkeerde aannames tijdens QA.
- **Minimale veilige oplossing:** Dev-preview moet dezelfde actieve route/redirect-definitie hergebruiken als productie in plaats van een eigen if/else-kopie. Legacy "Lab"-label alleen behouden als er een aantoonbare, expliciete reden is om het als apart legacy-testdoel te bewaren.
- **Verplichte tests/viewports:** Vergelijk dev-preview en productie-gedrag voor `/lab` na elke wijziging aan `AnalyseSwitchPage`.
- **Afhankelijkheden:** Geen.
- **Eigenaar:** Replit (implementatie)
- **Blokkade:** Geen
- **Verificatiebewijs:** De handmatig bijgehouden kopie is vervangen door één gedeelde component: `AnalyseSwitchPage` is verplaatst uit `App.tsx` naar `src/pages/analyse-switch.tsx` (identieke logica: flag `commercial_shell` aan of ladend → `CoreAnalysePage`, uit → legacy `LabPage`; fail-open ongewijzigd). De echte router (`App.tsx` `/analyse`-route) én de dev-preview importeren nu exact deze component — verandert de switchlogica ooit, dan loopt de dev-preview automatisch mee. Dev-preview-menu: item "Lab" → "Analyse" (pad `/analyse`); geen dubbelzinnige Lab/Analyse-keuze meer; `/lab` blijft werken als alias (dev-preview-tak matcht beide, productie-`<Redirect to="/analyse">` onaangeraakt). Legacy `LabPage` staat bewust niet als apart menu-item: hij is geen dood testdoel maar de live uit-stand van de flag, bereikbaar via dezelfde switch. Routebewijs/vergelijking: `/analyse` (390px) en alias `/lab` (1440px) renderen beide dezelfde Analyse-pagina met identieke shell, tabs, kaarten en grafieken — `screenshots/devpreview-analyse-390.jpg`, `screenshots/devpreview-lab-alias-1440.jpg`; actieve navigatiemarkering "Analyse" klopt, geen consolefouten. TypeScript-check groen. Statusgang: READY_FOR_FIX → FIXED_NOT_VERIFIED → VERIFIED_FIXED (2026-07-28). Commit-SHA: zie commit met deze registerwijziging.
- **Laatst bijgewerkt:** 2026-07-28

### A-07 — Clerk-inlogscherm is Engelstalig
- **Categorie:** DEFECT · **Ernst:** P3 · **Zekerheid:** Hard bevestigd (code) · **Status:** VERIFIED_FIXED
- **Route/rol/scherm:** `/sign-in`, `/sign-up`
- **Bestand/regel:** `artifacts/sparki/src/App.tsx:601-612`
- **Bewijsbron:** Statische code-inspectie
- **Technische oorzaak:** De `localization`-prop van `ClerkProvider` overschrijft uitsluitend `signIn.start.title/subtitle` en `signUp.start.title/subtitle` — en de overschreven tekst zelf is Engels ("Welcome back", "Sign in to your Sparki account", "Join Sparki", "Sparki-powered cycling performance"). Alle overige Clerk-teksten (knoppen, foutmeldingen, "wachtwoord vergeten", etc.) gebruiken Clerk's ingebouwde Engelse default. Dit is dus geen gedeeltelijke, maar een volledige Engelstalige ervaring op dit scherm.
- **Gebruikersimpact:** Inconsistente taalervaring in een verder Nederlandstalige app.
- **Data-/privacy-/veiligheidsimpact:** Geen.
- **Minimale veilige oplossing:** Volledige Nederlandse lokalisatie via Clerk's `localization`-object (alle relevante sleutels, niet alleen start-titel/subtitel).
- **Verplichte tests/viewports:** Visuele controle van het volledige sign-in/sign-up-traject, inclusief foutmeldingen en wachtwoord-vergeten-flow.
- **Afhankelijkheden:** Geen.
- **Eigenaar:** Replit (implementatie)
- **Blokkade:** Geen
- **Verificatiebewijs:** Gekozen methode: Clerk's officiële volledige Nederlandse locale `nlNL` uit `@clerk/localizations` (nieuw dependency in `artifacts/sparki`), als geheel doorgegeven aan `ClerkProvider.localization` — dus géén half-vertaalde mix van Engelse defaults met losse overrides: alle knoppen, velden, foutmeldingen, verificatie-, wachtwoord-vergeten- en social-login-teksten komen uit de officiële vertaling. Alleen de twee starttitels zijn Sparki-eigen overschreven binnen dezelfde structuur: sign-in "Welkom terug"/"Log in op je Sparki-account", sign-up "Maak je Sparki-account"/"Begin met slimmer fietsen en trainen" (vervangt "Welcome back"/"Join Sparki"/etc.). Functionaliteit onaangeraakt: redirects, `?redirect_url=` (invite-flow), OAuth en routing staan los van de `localization`-prop. Bewijs tegen een échte productie-build (dev-preview toont deze schermen niet): `vite build` + statisch geserveerde `dist/public` + eigen Playwright — gerenderde tekst op /sign-in: "Welkom terug · Log in op je Sparki-account · Ga verder met Google · E-mailadres · Wachtwoord · Doorgaan · Geen account? Registreren"; /sign-up: "Maak je Sparki-account · Begin met slimmer fietsen en trainen · Heb je al een account? Inloggen" — geen zichtbare Engelse systeemtekst, geen consolefouten, nette uitlijning op 390 en 1440px. Screenshots: `screenshots/clerk-nl-signin-390.jpg`, `clerk-nl-signin-1440.jpg`, `clerk-nl-signup-390.jpg`. Diepe toestanden (verkeerd wachtwoord, verificatiecode, code opnieuw verzenden, wachtwoord resetten) vergen een echt account + e-mailloop en zijn gedekt doordat ze integraal uit dezelfde officiële `nlNL`-vertaling komen. TypeScript-check groen. Statusgang: READY_FOR_FIX → FIXED_NOT_VERIFIED → VERIFIED_FIXED (2026-07-28). Commit-SHA: zie commit met deze registerwijziging.
- **Laatst bijgewerkt:** 2026-07-28

## 5. A2 — Nog te bevestigen codebevinding

### A2-01 — Onboarding: localStorage als fail-open fallback bij aanhoudende serverfout
- **Categorie:** CODE_RISK · **Ernst:** P2 · **Zekerheid:** Hard bevestigd in code (correctie t.o.v. eerdere versie van dit document, die dit niet had gereproduceerd) · **Status:** FIXED_NOT_VERIFIED (productbesluit genomen 2026-07-29: fail-closed; fix + eigen tests uitgevoerd, wacht op onafhankelijke controle voor VERIFIED_FIXED)
- **Route/rol/scherm:** Onboarding-traject, component `SignedInHomeReady`
- **Bestand/regel:** `artifacts/sparki/src/App.tsx`, functie `SignedInHomeReady` (rond regel 246-300): `lsKey`/`lsDone` op regel 261-262, fallback-tak in de `catch` van de retry-lus (rond regel 296-300), `handleComplete` op regel 315
- **Bewijsbron:** Statische code-inspectie (Claude, na correctie door menselijke/ChatGPT-review)
- **Technische oorzaak:** `lsKey = sparki_onboarded_${profile.clerkId}` is **wel** per clerkId gescoped — dit is dus geen accountmenging. De code-comment op regel ~264 zegt expliciet: "DB is the source of truth. localStorage is only a fast-path cache and a migration bridge...". De request naar `/api/onboarding/state` wordt tot 3 keer geprobeerd (met oplopende backoff). Als alle 3 pogingen falen (netwerk/serverfout, geen positief antwoord van de server) én `lsDone === true`, wordt alsnog `setOnboarded(true)` gezet — de gebruiker komt door zonder dat de database op dat moment bevestigt dat onboarding voltooid is. Is `lsDone` niet waar, dan verschijnt terecht een retry-scherm (`checkFailed`) in plaats van onboarding opnieuw te starten.
- **Nuance:** dit is een bewuste ontwerpkeuze (gedocumenteerd in de code, gericht op het voorkomen dat een tijdelijke serverstoring een terugkerende gebruiker onterecht opnieuw door onboarding stuurt), geen onopgemerkte fout. Het blijft niettemin een fail-open pad: een lokale, in theorie manipuleerbare of verouderde vlag kan tijdelijk de plaats innemen van een positieve databasebevestiging. De aparte juridische `ConsentGate` zit hier buiten — die wrapt `SignedInHomeReady` van buitenaf (`AccountGate` → `ConsentGate` → `SignedInHomeReady`, regel ~231) en wordt volgens de code-comment sowieso server-side afgedwongen via middleware; deze fallback slaat dus alleen de onboarding-stap over, niet de consent-verplichting.
- **Gebruikersimpact:** Bij een aanhoudende serverstoring kan een gebruiker die onboarding al eerder op dit apparaat voltooide, doorgaan zonder verse serverbevestiging — geen impact voor gebruikers die onboarding nog nooit voltooiden (die krijgen het retry-scherm).
- **Data-/privacy-/veiligheidsimpact:** Beperkt — geen accountmenging (bevestigd, clerkId-gescoped), geen omzeiling van de juridische consent-verplichting (die zit server-side elders). Wel een moment waarop de kortstondige databronwaarheid niet gecontroleerd wordt.
- **Minimale veilige oplossing:** Nog geen product-/technisch besluit genomen over de gewenste afweging (bijv. aantal retries, of een zichtbare "niet geverifieerd"-indicatie tonen, of dit gedrag expliciet accepteren als bewust vangnet). Niet automatisch wijzigen zonder die afweging, want het voorkomt ook een reëel probleem (onterecht opnieuw onboarden bij een flaky verbinding).
- **Verplichte tests/viewports:** N.v.t. tot het productbesluit genomen is; daarna functionele test van de retry-/fallback-keten met gesimuleerde serverfouten.
- **Afhankelijkheden:** Productbesluit vereist (zie hierboven) vóór implementatie.
- **Eigenaar:** René (productbesluit), daarna Replit (eventuele implementatie)
- **Blokkade:** Wacht op productbesluit over de gewenste afweging
- **Verificatiebewijs:** Code-locatie hierboven; geen aanvullend runtimebewijs nodig — dit is met statische code-analyse volledig te herleiden
- **Herstel (2026-07-29, FIXED_NOT_VERIFIED):** Productbesluit: fail-closed. De besluitregels zijn geëxtraheerd naar `artifacts/sparki/src/lib/onboarding-gate.ts` (`decideOnboardingOutcome`, `lsKeyFor`); `SignedInHomeReady` (App.tsx) gebruikt die nu. Nieuwe beslisboom: server-afgerond → app; server-bereikbaar-niet-afgerond + lokale hint → hint migreren naar DB + app (bestaande gebruikers nooit opnieuw door onboarding); server-bereikbaar-niet-afgerond zonder hint → onboarding; server onbereikbaar na 3 retries → ALTIJD beperkt foutscherm (`OnboardingCheckFailed`, role=status, "Opnieuw proberen"), ongeacht de lokale waarde — nooit de app, nooit automatische nieuwe onboarding. ConsentGate onaangeraakt (aparte laag). Tests: `pnpm --filter @workspace/sparki run test:onboarding-gate` (6/6 pass, dekt scenario's 1–5 + migratiehint); TypeScript groen; screenshots foutstatus 390/1440 px in `screenshots/onboarding-failed-{390,1440}.jpg` (dev-preview `/_dev/onboarding-failed`).
- **Laatst bijgewerkt:** 2026-07-28 (gecorrigeerd na review)

## 6. R — Runtimevalidatie vereist

### R-01 — P01 achterhaalde FTP-rij
- **Categorie:** RUNTIME_VALIDATION · **Status:** NEEDS_RUNTIME_VALIDATION
- **Bewijsbron:** Master plan v2.84 revisie: rij 8 gemarkeerd "achterhaald" en behouden (niet verwijderd)
- **Te controleren:**
  - wordt rij 8 server-side uitgesloten als actuele FTP-waarde?
  - kan geen enkele analyse, zone-berekening, planlogica of advies deze rij als actuele waarde gebruiken?
  - is de markering expliciet en toetsbaar (bijv. een status-kolom), niet impliciet?
  - verschijnt de rij uitsluitend in historische context (bijv. FTP-geschiedenis), nooit als "huidige FTP"?
- **Nuance uit review:** dit is geen actieve fout die verwijderd moet worden — het acceptatiepunt is uitsluitend of de markering server-side gerespecteerd wordt.
- **Eigenaar:** Replit (query/DB-onderzoek) + onafhankelijke reviewer
- **Laatst bijgewerkt:** 2026-07-28

### R-02 — P03 Nederlandse ai_observations
- **Categorie:** RUNTIME_VALIDATION · **Status:** NEEDS_RUNTIME_VALIDATION
- **Bewijsbron:** `docs/P03_LANGUAGE_REPAIR_APPLY_2026-07-28.md` — een apply-document, **geen database-uittreksel**
- **Te controleren op productieprimary:**
  - de bedoelde 12 observaties zijn daadwerkelijk aangepast;
  - taal is daadwerkelijk Nederlands (niet alleen het documentclaim);
  - geen dubbele of foutieve observaties ontstaan door de aanpassing;
  - documentatieclaim wordt niet als bewijs geaccepteerd zonder query-resultaat.
- **Eigenaar:** Replit (DB-query + resultaat), onafhankelijke reviewer
- **Laatst bijgewerkt:** 2026-07-28

### R-03 — Naam "Lars"
- **Categorie:** RUNTIME_VALIDATION · **Status:** NEEDS_RUNTIME_VALIDATION
- **Bewijsbron:** Screenshot-melding (eerdere sessie); statische code-inspectie deze sessie vond "Lars" uitsluitend als testfixture in `artifacts/sparki/src/lib/core-analyse.test.ts:117,122` — niet in actieve applicatiecode.
- **Te controleren:**
  - productieprofiel (echte gebruikersdata);
  - dev-preview-atleten/testdata;
  - database-seeddata;
  - Clerk-metadata;
  - cache/localStorage;
  - testfixtures mogen blijven staan zolang bevestigd is dat ze nooit een runtime-pad naar de UI bereiken.
- **Regel:** niet sluiten voordat de daadwerkelijke UI en databron zijn bewezen — "niet gevonden in actieve code" ≠ "opgelost".
- **Eigenaar:** Replit (runtime/DB-controle), onafhankelijke reviewer
- **Laatst bijgewerkt:** 2026-07-28

## 7. B — Ontbrekende bouwscope

### B-01 — Stripe en billing
- **Categorie:** MISSING_SCOPE · **Ernst:** P2 voor verkoopgereedheid · **Status:** OPEN
- **Bewijsbron:** Repo-brede zoekactie (`grep -rli stripe`) — nul treffers in de hele codebase.
- **Vastgelegd:** geen Stripe-code aanwezig; BILL-00 t/m BILL-06 (master plan v2.77–v2.79) zijn definitieve besluiten, geen implementatie; geen webhookflow, checkout, customer portal, facturatie- of abonnementsstatuslogica gevonden.
- **Laatst bijgewerkt:** 2026-07-28

### B-02 — CommercialTier-migratie
- **Categorie:** MISSING_SCOPE · **Status:** OPEN
- **Bewijsbron:** `lib/db/src/schema/entitlements.ts` — `PRODUCT_VARIANTS = ["sparki_go", "sparki_basic", "sparki_performance", "sparki_pro"]`; geen `commercialTier`-veld gevonden in de hele repo (`grep -rln commercialTier` → 0 treffers).
- **Vastgelegd:** bestaand entitlement-model gebruikt oude namen die niet overeenkomen met de master plan-vereiste FREE/GO/COMPLETE-indeling met een apart `commercialTier`-veld, onderscheiden van de bestaande UX-persona/variant. Vereist schema- én datamigratie, geen kleine aanpassing.
- **Laatst bijgewerkt:** 2026-07-28

### B-03 — Profielvergelijkingsgrafieken
- **Categorie:** MISSING_SCOPE · **Status:** OPEN
- **Bestand:** `artifacts/sparki/src/pages/profiel.tsx` (324 regels)
- **Bewijsbron:** Statische code-inspectie — nul treffers op grafiek-/vergelijk-/chart-gerelateerde logica.
- **Vastgelegd:** volledig afwezig, niet gedeeltelijk gebouwd. Niet presenteren als "bijna klaar".
- **Laatst bijgewerkt:** 2026-07-28

### B-04 — Atmosphere-assets niet volledig aangesloten
- **Categorie:** MISSING_SCOPE · **Status:** OPEN
- **Bewijsbron:** `find public/atmosphere -type f` → 84 bestanden; `atmosphere-library.ts` registreert circa 30 entries.
- **Vastgelegd:** materiaal- en klim-kaarttypen hergebruiken nu andere categorieën als workaround (`materiaal` → `samen-fietsen`-prefix, `klim` → `routes`-categorie) bij gebrek aan een eigen pool. Exacte aantallen dienen opnieuw programmatisch bepaald te worden (geen handmatige telling als eindstand). Niet automatisch alle 84 bestanden aansluiten zonder kwaliteitsselectie (zie ook C-04).
- **Laatst bijgewerkt:** 2026-07-28

### B-05 — AI Operations en Technical Helpdesk
- **Categorie:** MISSING_SCOPE · **Status:** OPEN
- **Bewijsbron:** Repo-brede zoekactie op ops-ai/autonomy-gerelateerde termen — 0 treffers.
- **Vastgelegd:** ontwerp en besluiten aanwezig in master plan v2.80; geen operationele agent, autonomy-levels, incidentmatrix of technische helpdesk in code gevonden.
- **Laatst bijgewerkt:** 2026-07-28

### B-06 — Technische founder-succession
- **Categorie:** MISSING_SCOPE · **Status:** OPEN
- **Bewijsbron:** Alleen `docs/SPARKI_FOUNDER_SUCCESSION_CONTINUITY_v1.0.md` gevonden; geen `founder_status`-veld of vergelijkbare code.
- **Vastgelegd:** documentatie aanwezig (master plan v2.81/v2.82), geen founder_status-model of technische continuity-controls in code. Onderscheid nog te maken tussen wat in Sparki zelf hoort, wat in Secure Vault Keeper hoort, en wat puur juridisch/notarieel werk blijft (zie C-02).
- **Laatst bijgewerkt:** 2026-07-28

### B-07 — Betaalde routes en routebundels
- **Categorie:** MISSING_SCOPE · **Ernst:** P2 voor omzetkans, geen blocker voor bestaand product · **Status:** OPEN
- **Bewijsbron:** Repo-brede zoekactie naar routecatalogus/aankoop-/routebundel-logica — geen treffers. Wel bevestigd: `lib/db/src/schema/entitlements.ts` kent al een `route_content`-entitlementtype met een voorbeeld-key-notatie (`"route:123"`), en `artifacts/api-server/src/lib/entitlements.ts:176-177` behandelt `route_content` al apart als contentrecht (geen feature-key). Dit is dus een data-model-placeholder die al op deze functionaliteit anticipeert, maar er bestaat geen catalogus, checkout, download-/gebruiksrechtcontrole, bundel-logica of GPX/course-point-verkooppijplijn omheen.
- **Productidee (vastgelegd door René):** drie aparte producten — (1) losse route/etappe, eenmalige aankoop; (2) routebundel (bijv. alle AGR-klimmen, een volledige Tour-week); (3) premium routebeleving (route + navigatie + klimbegeleiding + wedstrijdinformatie + voedingspunten + persoonlijke aanpassing). Bedoeld als laagdrempelige instap (indicatief €3–€6 per pakket) naast de Go/Complete-abonnementen, met als doel latere doorstroom naar een abonnement.
- **Voorbeeldcontent:** Gold Race-toerversie/AGR-klimmen, Ronde van Vlaanderen-routes en hellingen, Tour de France-etappes, Giro- en Vuelta-etappes, klassiekers (Luik-Bastenaken-Luik, Parijs-Roubaix, Strade Bianche), meerdaagse fietsvakanties, trainingsstages, regionale klimcollecties, gravel-/MTB-bundels.
- **Beoogde toegevoegde waarde t.o.v. een los GPX-bestand:** gecontroleerde actuele route, routevarianten op afstand/zwaarte, klimprofielen, course points, waarschuwingen voor gevaarlijke afdalingen/slechte wegen, bevoorrading/koffie/water/parkeerpunten, gesproken navigatie, informatie over hellingen/koersmomenten, geschiktheid racefiets/gravel/MTB/e-bike, meerdaagse planning per dag, automatische actualisatie bij wegwijzigingen.
- **Ontbrekende ketenonderdelen (vastgelegd, nog niet gebouwd):** routecatalogus; productprijs; aankoopflow; eigendomsrecht/toegangscontrole na aankoop; download-/gebruikstoegang; routebundel-logica; Stripe-afhandeling voor losse aankopen (naast abonnementen); herstel van aankopen; auteursrechten en bronregistratie van routedata; actualisatie van reeds gekochte routes bij wegwijzigingen.
- **Afhankelijkheden:** B-01 (Stripe/billing) en B-02 (commercialTier/entitlements) moeten mee ontworpen worden — dit is een derde, eenmalige aankoopvorm naast abonnementen, geen vervanging; routekwaliteitscontrole en GPX/course-point-pipeline (nieuw te bouwen of bestaande route-tools te hergebruiken — zie `route-navigator.tsx`, `route-panel.tsx`, `route-explorer.tsx` als mogelijk hergebruikbare basis, nog niet beoordeeld op geschiktheid); juridische controle op naamgebruik (bijv. "Amstel Gold Race", "Tour de France" als merknamen), kaartdata-licenties en routebronnen.
- **Minimale veilige oplossing:** N.v.t. — dit is nieuwe bouwscope, geen reparatie. Vereist eerst een productbesluit over volgorde t.o.v. B-01/B-02 (zie C-03) voordat ontwerp/implementatie start.
- **Verplichte tests/viewports:** N.v.t. tot ontwerpfase.
- **Eigenaar:** René (productbesluit/scope), Claude/ChatGPT (specificatie), Replit (implementatie na goedkeuring)
- **Blokkade:** Wacht op prioritering t.o.v. overige bouwscope (B-01/B-02) en op juridisch onderzoek naar naamgebruik van bestaande wedstrijden/klassiekers
- **Verificatiebewijs:** N.v.t.
- **Laatst bijgewerkt:** 2026-07-28

## 8. C — Open besluiten

### C-01 — Web- en mobiel-gelijkheid
- **Categorie:** OPEN_DECISION · **Status:** OPEN
- **Bewijsbron:** Bestandsaantal-vergelijking: `sparki-mobile` 84 bestanden vs. `sparki` (web) 418 bestanden.
- **Vastgelegd:** bestandsaantal is uitsluitend een signaal, geen functiedekkingspercentage. Productbesluit nodig: welke functies moeten vóór een pilot op mobiel aanwezig zijn?
- **Laatst bijgewerkt:** 2026-07-28

### C-02 — Succession: Sparki of Secure Vault Keeper
- **Categorie:** OPEN_DECISION · **Status:** OPEN
- **Laatst bijgewerkt:** 2026-07-28

### C-03 — Volgorde Stripe tegenover UX en data-trust
- **Categorie:** OPEN_DECISION · **Status:** OPEN
- **Aanvulling:** raakt nu ook de volgorde van B-07 (betaalde routes/routebundels), dat als eenmalige-aankoopvorm afhankelijk is van dezelfde Stripe/billing-fundering als de abonnementen.
- **Laatst bijgewerkt:** 2026-07-28

### C-04 — Moeten alle 84 sfeerbeelden gebruikt worden?
- **Categorie:** OPEN_DECISION · **Status:** OPEN
- **Vastgelegd:** kwaliteit en categoriedekking gaan vóór aantallen.
- **Laatst bijgewerkt:** 2026-07-28

## 9. T — Technische schuld

### T-01 — `.migration-backup` oude Next.js-app
- **Categorie:** TECHNICAL_DEBT · **Ernst:** P3 of P4 · **Status:** NEEDS_CONFIRMATION
- **Bewijsbron:** `.migration-backup/` bevat een volledig losse Next.js-app (eigen `next.config.mjs`, `package.json`, `app/feed/page.tsx`, `app/lab/page.tsx`, etc.). De actieve app (`App.tsx`/`dev-preview.tsx`, Vite + wouter) verwijst hier nergens naar voor zover statische route-analyse kan bepalen.
- **Onderzoek verplicht:**
  - bevestig dat de actieve build, Replit-runconfig (`.replit`), deployment en CI deze map niet gebruiken;
  - controleer `next.config.mjs` en `package.json` op eventuele losse run-targets;
  - risico: zoekresultaten en audits (inclusief toekomstige Claude/ChatGPT-sessies) kunnen vervuild raken door deze map, en Replit-agenten kunnen naar de verkeerde bestanden verwezen worden.
- **Relatie tot v2.86 "visual_preview_defect":** dit zou de technische bron kunnen zijn van het in de master plan genoemde "oude schil"-symptoom (oude performance-home shell, oude hoofdstukknoppen, gedupliceerde Samen/Ontdekken), maar dat is **niet bevestigd** — statische analyse toont geen actieve verwijzing ernaar; een live-render-check is nodig om dit hard te maken of te weerleggen.
- **Minimale veilige aanpak:** niet verwijderen voordat herkomst en afhankelijkheden bewezen zijn; wel markeren, en na bevestiging archiveren buiten de actieve repo-structuur.
- **Laatst bijgewerkt:** 2026-07-28

## 10. Onderzocht en geen defect

- **`/you` vs. `/profiel/:clerkId`** — geen duplicaat. `App.tsx` bevestigt: `/you` is de eigen gebruikersomgeving (`YouPage`); `/profiel/:clerkId` toont een specifiek ander profiel op basis van clerkId (bijv. vanuit Samen/Circle). Alleen heropenen als runtime ander gedrag toont dan de routedefinitie suggereert.

## 11. Reparatievolgorde

1. P0/P1 data-, privacy- en accountisolatie (momenteel geen bevestigd P0/P1 in dit register). A-03 is het meest urgente item in deze categorie. A2-01 is hard bevestigd maar geen accountmenging; die wacht op een productbesluit (zie A2-01), niet op verder onderzoek.
2. Routing- en functionele fouten (A-02, A-06).
3. Responsive en toegankelijkheid (A-01, A-05).
4. Runtimevalidaties P01/P03/Lars (R-01, R-02, R-03).
5. Screenshots en visuele regressie (inclusief A-04, T-01-verificatie).
6. Ontbrekende bouwscope opnieuw prioriteren (B-01 t/m B-06, met C-01 t/m C-04 als randvoorwaardelijke besluiten).
7. Pas daarna een nieuw 0-punt.

## 12. Definitie van het nieuwe 0-punt

Commit `76d2285` is **nog geen definitief 0-punt**. Een nieuw 0-punt mag pas worden vastgesteld na:
- alle P0/P1 opgelost én geverifieerd;
- alle in-scope P2 opgelost of expliciet geblokkeerd met reden;
- P01, P03 en Lars (R-01/R-02/R-03) runtime-gevalideerd;
- typecheck en relevante tests groen;
- responsive bewijs op de verplichte viewports (390×874, 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080 waar relevant);
- onafhankelijke controle door een niet-uitvoerende reviewer (niet dezelfde partij die de fix bouwde);
- dit defectregister bijgewerkt met bewijs per item;
- een exacte nieuwe commit-SHA vastgelegd als de nieuwe basis.

## 13. Wijzigingslog

- **2026-07-28** — Document aangemaakt door Claude op basis van (a) een eerste, onafhankelijke ChatGPT/René-audit van 8 gemelde fouten, (b) Claude's eigen code-verificatie van diezelfde 8 punten (7 bevestigd, 1 niet reproduceerbaar), en (c) Claude's bredere audit van master plan v2.86 tegen de code (ontbrekende bouwscope B-01 t/m B-06). Screenshotronde voor de resterende visuele bevindingen (tekstdichtheid, achtergrondsfeer, oude-schil-symptoom) staat nog open.
- **2026-07-28 (correctie)** — A2-01 herzien na aanvullende review: de exacte code is alsnog gelokaliseerd in `App.tsx` (`SignedInHomeReady`, `lsKey`/`lsDone`, regel ~246-315) en door Claude geverifieerd. Zekerheid gewijzigd van "niet bevestigd" naar "hard bevestigd in code"; status van NEEDS_CONFIRMATION naar NEEDS_DECISION; ernst gespecificeerd als P2. Bevestigd: geen accountmenging (clerkId-gescoped) en de juridische ConsentGate wordt hierdoor niet omzeild (zit apart, server-side afgedwongen). Reparatievolgorde-punt 1 aangepast.
- **2026-07-28 (uitbreiding)** — B-07 toegevoegd: betaalde routes en routebundels als nieuwe, nog niet gebouwde bouwscope (drie productvormen: losse route, routebundel, premium routebeleving). Bevestigd in code: `entitlements.ts` bevat al een `route_content`-entitlementtype als data-model-placeholder, maar geen catalogus, checkout, toegangscontrole, bundel-logica of GPX/course-point-verkooppijplijn.
