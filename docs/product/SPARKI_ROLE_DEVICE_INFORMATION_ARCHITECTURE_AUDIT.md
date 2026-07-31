# Sparki — Rol-, apparaat- en informatiearchitectuur-audit

**Datum:** 31-07-2026 · **Status:** TER GOEDKEURING AAN RENÉ — er is nog niets gebouwd of verplaatst.
**Aanleiding:** mobiele praktijktest toont een app-breed structuurprobleem (rol, apparaat, navigatie, uitnodigingen), geen losse UX-fouten.
**Bindende bronnen:** Master Plan-addendum (`docs/SPARKI_MASTER_PLAN_ADDENDUM_GOVERNANCE_EN_KALIBRATIE.md`), Product Proof Doctrine, bestaande IA-docs in `docs/product/`.

**Eerlijkheidsregel bij "Werkstatus":** een status is alleen `working` als er uitgevoerd bewijs is (testsuite of gedocumenteerde praktijktest). Alles zonder bewijs staat op `unclear` of `partially_working` — er wordt niets mooier voorgesteld dan aangetoond.

---

## 1. Scherm- en functie-inventaris (web-app `artifacts/sparki`)

Legenda apparaat: ✔ = ontworpen/geschikt, ± = werkt maar niet passend, ✘ = niet aanwezig/ongeschikt.

| Scherm/functie | Gewone Nederlandse naam | Huidige route | Bedoeld voor | Actieve rol | Telefoon | Desktop | Hoofdtaak | Huidige navigatieplek | Gewenste plek | Benodigde rechten | Backend/API | Werkstatus | Probleem | Voorstel |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Vandaag | Vandaag (startpagina) | `/vandaag` | sporter (rolvarianten trainer/ouder/club) | atleet e.a. | ✔ | ✔ | dagstart: wat nu | onderbalk tab 1 | blijft | AccountGate | `/api/today` (+`?rol=`) | working (tests 7/7·14/14·22/22) | rolvarianten zijn ingehangen in coach/parent-home, niet als eigen omgeving | WP-S3: rol-startpagina's formaliseren |
| Trainen | Trainingsplan | `/train` | sporter | atleet | ✔ | ✔ | plan volgen/aanpassen | onderbalk | blijft | AccountGate + flag | `/api/plan*` | partially_working | vier-lagen-opzet deels; desktopbenutting matig | WP-S6 |
| Rijden/Routes | Routeplanner | `/routes` | sporter | atleet | ± | ✔ | route kiezen/maken/navigeren | onderbalk | blijft (mobiel vereenvoudigd) | AccountGate | `/api/routes*` | partially_working | desktop-first gebouwd, mobiel verkleind; niveaus-werk staat klaar maar is GEBLOKKEERD tot na dit herstel | WP-S6 |
| Wedstrijden | Wedstrijden | `/races` | sporter | atleet | ✔ | ✔ | wedstrijdvoorbereiding | onderbalk/desktopzijbalk | blijft | AccountGate | `/api/races*` | working (suites) | — | — |
| Activiteiten | Ritten | `/activiteiten` | sporter | atleet | ✔ | ✔ | ritgeschiedenis/analyse per rit | Meer/raster + desktopzijbalk | eerste niveau mobiel heroverwegen | AccountGate | `/api/sessions*` | working (suites) | mobiel verstopt achter Meer | WP-S3 |
| Analyse | Prestatie-analyse | `/analyse` | sporter | atleet | ± | ✔ | trends/vermogen | Meer/raster + zijbalk | desktop-eerst, mobiel samenvatting | AccountGate | `/api/analyse*` | working (suites) | dichte grafieken op telefoon | WP-S6 |
| Jij/Profiel | Jouw profiel | `/you` | sporter | allen | ✔ | ✔ | identiteit, getallen, instellingen | raster/profiel | herindelen (zie §7-D) | AccountGate | `/api/auth/me` e.a. | partially_working | **"Samen trainen" staat bovenaan Profiel**; lichaamsgegevens verstopt achter tandwiel | WP-S4 |
| Lichaam | Lichaam & herstel | `/lichaam` | sporter | atleet | ✔ | ✔ | voeding/herstel/biodata | Meer/raster | direct vindbaar vanaf Profiel | AccountGate | `/api/nutrition*` e.a. | partially_working | **gewicht invoeren slecht vindbaar; geen "Nieuw weegmoment"-actie** | WP-S4 |
| Meer | Meer-menu | `/meer` | sporter | allen | ✔ | ✔ | overige hoofdstukken | onderbalk tab 5 | blijft, opgeschoond | AccountGate | — | working | admin-/testitems staan tussen gebruikersfuncties | WP-S3 |
| Samen | Samen (sociaal) | `/samen` | sporter | atleet | ✔ | ✔ | vrienden/team/feed | Meer | blijft (keuze #10 open) | AccountGate | `/api/social*` | working (suites) | — | — |
| Ontdekken/Feed | Ontdekken | `/feed` | sporter | atleet | ✔ | ✔ | nieuws/inspiratie | raster/zijbalk | blijft | AccountGate | `/api/knowledge*` | working | — | — |
| Kennis | Kennisbank | `/kennis` | sporter | atleet | ✔ | ✔ | uitleg/verdieping | Meer | blijft | AccountGate + flag | `/api/knowledge*` | working | — | — |
| Kalender | Seizoenskalender | `/kalender` | sporter | atleet | ± | ✔ | seizoensplanning | Meer | desktop-eerst | AccountGate | `/api/plan*` | partially_working | desktopkracht onbenut op mobiel te vol | WP-S6/S7 |
| Mechanieker | Materiaal & onderhoud | `/mechanieker` | sporter | atleet | ✔ | ✔ | fietsgarage/onderhoud | Meer | blijft; aparte mechanieker-ROL zie §2 | AccountGate | `/api/garage*` | working (suites) | naam botst met clubrol "mechanieker" | WP-S9 |
| Paspoort | Sportpaspoort | `/paspoort` | sporter | atleet | ✔ | ✔ | herkomst gegevens | Meer | blijft | AccountGate | `/api/passport*` | working (suites) | — | — |
| Klimmen | Klimmenverkenner | `/klimmen` | sporter | atleet | ± | ✔ | klimmen verkennen | Meer | blijft | AccountGate | `/api/climbs*` | working | — | — |
| Geluid | Geluid & wekker | `/geluid` | sporter | atleet | ✔ | ± | geluidsinstellingen | Meer | blijft | AccountGate | `/api/audio*` | working | — | — |
| Club | Mijn club | `/club` | clublid | atleet | ✔ | ✔ | cluboverzicht | Meer/deeplink | blijft | AccountGate + lidmaatschap | `/api/club*` | working (suites) | — | — |
| Clubbeheer | Clubbeheer | `/club/beheer` | clubbeheerder | owner/admin | ± | ✔ | leden/teams/uitnodigingen | deeplink vanuit Club | eigen desktopwerkruimte | clubrol owner/admin (server) | `/api/club*` | partially_working | desktop-werkruimte ontbreekt; mobiel te vol | WP-S8 |
| Coach-home | Trainersoverzicht | `/` (bij activeRole=coach) | trainer | coach | ± | ± | sporterslijst + rolvandaag | rolwissel | eigen desktopwerkruimte | rol coach | `/api/coach*` | partially_working | geen professionele desktop-cockpitindeling (tabellen/bulk) | WP-S7 |
| Coach-cockpit | Sporter-cockpit | `/coach/athletes/:id/cockpit` | trainer | coach | ✘ | ✔ | analyse & sturing per sporter | deeplink roster | trainerdesktop | directe link + deelniveau (server) | `/api/coach/cockpit*` | working (suites) | alleen via deeplink vindbaar | WP-S7 |
| Coach-plan | Schema per sporter | `/coach/athletes/:id/plan` | trainer | coach | ✘ | ✔ | plan beheren | deeplink roster | trainerdesktop | directe link (server) | `/api/coach*` | working (suites) | idem | WP-S7 |
| Parent-home | Ouderoverzicht | `/` (bij activeRole=parent) | ouder/verzorger | parent | ✔ | ✔ | welzijn kind | rolwissel | blijft, opgeschoond | ouderlink + permissies (server) | `/api/parent*` | working (suites) | uitnodigen/beheer onduidelijk geplaatst | WP-S2/S3 |
| Uitnodigingen | Uitnodigingen | `/invitations` | coach/ouder/admin | coach/parent | ± | ✔ | links maken/beheren | coach/ouder-nav | per rol in eigen omgeving | rolcheck server-side | `/api/invitations*` | partially_working | **abstracte "rol-uitnodiging"; alleen kale link, geen deelmenu/e-mail/WhatsApp; betekenis verstuurde invites onduidelijk** | WP-S2 |
| Invite-accept | Uitnodiging accepteren | `/invite/:token` | ontvanger | n.v.t. | ✔ | ✔ | accepteren + juiste onboarding | deeplink | blijft | Clerk-sessie; server valideert token | `/api/invitations/accept` | partially_working | **landing na acceptatie niet rolgericht (ouder → sporteronboarding)** | WP-S2 |
| Tester-QR | Testtoegang (QR) | `/tester-qr` | admin | admin | ✔ | ✔ | testers onboarden | Profiel→Instellingen→Tester-toegang | ALLEEN admin-omgeving | isAdmin | `/api/invitations*` | working | **interne functie zichtbaar nabij gebruikersinstellingen** | WP-S3 |
| Welkom tester | Tester-welkom | `/welkom-tester` | hoofdtester | n.v.t. | ✔ | ✔ | welkomstmoment | automatisch | blijft | isHeadTester | — | working | — | — |
| Admin | Testdashboard/beheer | `/admin` | admin/hoofdtester | n.v.t. | ± | ✔ | systeemstatus, bugs, data | deeplink/Meer(admin) | ALLEEN admin-omgeving | isAdmin/isHeadTester | `/api/admin*` | partially_working | **stond in praktijktest tussen gebruikersfuncties en "werkt niet" op mobiel — mobiele werking onbewezen** | WP-S3 + apart bugonderzoek |
| Admin-ops | Beheeroperaties | `/admin/ops` | admin | n.v.t. | ✘ | ✔ | onderhoudsacties | deeplink | admin-omgeving | isAdmin | `/api/admin/ops*` | working (suites) | — | — |
| Connect | Koppelingen | `/connect` | sporter | atleet | ✔ | ✔ | Strava/Garmin/Wahoo | Meer | blijft | AccountGate | `/api/connect*` | working (suites) | — | — |
| Support | Hulp | `/support` | allen | allen | ✔ | ✔ | hulp & melden | Meer | blijft (WP-S5) | AccountGate | `/api/support*` | working (suites) | — | — |
| Privacy/Voorwaarden | Privacy · Voorwaarden | `/privacy` `/voorwaarden` | publiek | — | ✔ | ✔ | juridisch | footer/Meer | blijft (WP-S5) | — | — | working | — | — |
| Onboarding | Kennismaking | (gate, geen route) | nieuwe gebruiker | — | ✔ | ✔ | account compleet maken | automatisch | rolgericht maken | onboarding-gate | `/api/onboarding*` | partially_working | **één sporterspad; ouder/trainer/club/tester horen elk een eigen landing** | WP-S2 |
| DEV Preview | Ontwikkel-voorbeeld | (dev-paneel) | ontwikkelaar | — | ✔ | ✔ | identiteit wisselen in dev | alleen dev-build | alleen dev, gelabeld | DEV_PREVIEW + server-bypass | `x-dev-clerk-id` | partially_working | zie §6 — ongeschikt als acceptatiebewijs | WP-S1 |

**Mobiele native app (`artifacts/sparki-mobile`, Sparki Navigatie):** rit-navigatie, opname (achtergrond), BLE-sensoren, val-alarm, live delen/volgauto, offline wachtrij. Bewust ride-only; geen planning/club/analyse. Status: working voor de ride-keten (replay-/recovery-bewijzen), buiten scope van dit herstel behalve consistente naamgeving.

---

## 2. Problemen geclusterd (§7 van de opdracht)

### A. Rechten- of privacyrisico
1. `isAdmin` heeft een dev-bypass (iedereen admin in dev-preview) — in productie dicht, maar het maakt élk dev-screenshot van admin-/rechtenschermen ongeldig als bewijs (zie §6). *(Geen bekend productielek; bestaande suites voor cross-account/coach/parent/club-isolatie zijn groen.)*
2. Rolwissel-UI leunt deels op `activeRole` client-side voor navigatiekeuze; alle datapaden zijn server-side gegate (goed), maar navigatie en datarechten moeten uit één bron blijven komen bij de herbouw (bewaken in WP-S3, geen parallel rechtenmodel).

### B. Onbereikbare of verkeerde rolflow
3. Ouderuitnodiging landt in sporteronboarding — de accept-route stuurt generiek naar `/`, niet naar een rolgerichte landing.
4. Coach-cockpit en coach-plan zijn alleen via deeplinks bereikbaar; geen echte trainerswerkruimte.
5. Mechanieker (clubrol) heeft géén eigen omgeving; botst qua naam met het sporter-scherm "Mechanieker".
6. Hoofdtrainer/clubbeheer hebben rolvandaag-blokken maar geen eigen navigatie/werkruimte.

### C. Kapotte kernfunctie
7. Testdashboard (`/admin`) werkte niet in de mobiele praktijktest — oorzaak onbekend (desktop-first opbouw waarschijnlijk); mobiel nooit getest met bewijs.
8. Verstuurde uitnodigingen tonen geen betekenis/status/acties (wat gebeurde ermee? intrekken? opnieuw sturen?).

### D. Verkeerde navigatie of plaatsing
9. "Samen trainen" staat bovenaan Profiel (`you.tsx` regel ~605) — hoort niet daar (besluit 30-07: bovenaan Sámen-pagina).
10. Lichaamsgegevens en gewicht invoeren zitten verstopt achter Profiel→tandwiel; er is geen actie "Nieuw weegmoment".
11. Tester-QR bereikbaar via Profiel→Instellingen→Tester-toegang — interne functie tussen gebruikersinstellingen.
12. Activiteiten mobiel verstopt achter Meer terwijl het een dagelijkse taak is.

### E. Telefoon-/desktopmismatch
13. Routeplanner, Kalender, Analyse, Clubbeheer: desktop-first gebouwd en verkleind naar mobiel (schending apparaatdoctrine).
14. Coach-/club-omgevingen missen desktopkracht (tabellen, filters, bulkacties, zijpanelen).
15. Mobiel en desktop hebben verschillende menu's (onderbalk 5 tabs vs. zijbalk 8 items) zonder gedocumenteerde samenhang.

### F. Interne testfunctie zichtbaar voor gebruiker
16. Testdashboard/tester-QR in of nabij normale navigatie (zie 7/11).
17. DEV-paneelbegrippen ("rol-uitnodiging", relatie-enums) lekken naar gebruikers-UI.

### G. Onduidelijke tekst of naam
18. "Rol-uitnodiging" en relatienamen (`coach_athlete`, `none`) als productbegrip zichtbaar; knoppen heten "UITNODIGINGSLINK MAKEN" i.p.v. taakgericht ("Nodig je sporter uit").
19. "Mechanieker" betekent twee dingen (sportersscherm én clubrol).

### H. Alleen visueel of lagere prioriteit
20. Meerdere schermen ogen desktop-first verkleind (typografie/dichtheid) zonder functioneel defect — meenemen in de betreffende WP's, geen eigen pakket.

---

## 3. Beoordeling DEV Preview (§6 van de opdracht)

**Wat de selector werkelijk wijzigt:** de identiteitskeuze zet een `clerkId` in localStorage; elke API-call krijgt `x-dev-clerk-id` mee; de server (alleen bij `NODE_ENV!==production` én `DEV_AUTH_BYPASS=true`, fails closed) behandelt die ID als ingelogde gebruiker. Dat is **echte identiteits-impersonatie**: user-ID, rol, relaties, data en API-context wisselen mee.

**Maar — drie beperkingen maken hem ongeschikt als rol-/rechtenacceptatiebewijs:**
1. **`isAdmin` is in dev-bypass voor iederéén true** → elk dev-scherm kan admin-elementen tonen die een echte gebruiker nooit ziet; rechten-screenshots uit dev zijn dus niet geldig.
2. De **dagtype- en coach-scenario-selectors zijn visuele/scenario-overrides** (frontend), geen datawissel — schermen daarmee zijn illustratie, geen bewijs.
3. DEV Preview bestaat **niet in productie**; abonnement/entitlements en Clerk-sessiegedrag worden er niet mee getest.

**Besluit (voorgesteld):** tot WP-S1 (echte, gelabelde testimpersonatie zonder admin-bypass-bijwerking) geldt: DEV Preview **niet gebruiken als bewijs** dat coach-, ouder- of clubomgevingen werken; bestaande dev-screenshots gelden als illustratie, niet als acceptatie. Geldig bewijs = ingelogde validatie (Clerk ticket-login) of testsuites.

---

## 4. Verwijzingen
- Rolwerkruimtemodel: `docs/product/SPARKI_ROLE_WORKSPACE_MODEL.md`
- Navigatiemodel: `docs/product/SPARKI_NAVIGATION_MODEL_BY_ROLE_AND_DEVICE.md`
- Uitnodigingsmodel: `docs/product/SPARKI_INVITATION_MODEL.md`
- Herstelbouwplan: `docs/product/SPARKI_STRUCTURE_RECOVERY_BUILD_PLAN.md`
