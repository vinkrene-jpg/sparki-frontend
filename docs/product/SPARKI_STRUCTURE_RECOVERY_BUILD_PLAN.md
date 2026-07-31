# Sparki — Structuurherstel-bouwplan (herzien: WP-R1 t/m WP-R8)

**Datum:** 31-07-2026 (herzien na echte kliktest "Rollen en werkruimtes end-to-end") · **Status:** VOORSTEL — wacht op goedkeuring van René; **er start niets automatisch en er is nog niets gebouwd.**
Basis: `SPARKI_ROLE_DEVICE_INFORMATION_ARCHITECTURE_AUDIT.md` §0 (nulmeting per rol) + rolwerkruimte-, navigatie- en uitnodigingsmodel.

**Verhouding tot het eerdere WP-S-plan:** WP-S1 (dev-rolimpersonatie/testcontext/e2e) is **afgerond op 31-07-2026** en blijft geldig (code-geverifieerd: dev-bypass achter `NODE_ENV !== "production"` ÉN `DEV_AUTH_BYPASS === "true"`). De overige WP-S-pakketten zijn hieronder heringedeeld naar WP-R1 t/m WP-R8 op basis van de werkelijke kliktestbevindingen; de WP-S-nummers worden niet meer gebruikt.

**Algemene regels voor élk pakket:** geen parallel backend- of rechtenmodel; bestaande engines/gates blijven de enige waarheid; geen bestaande werkende cockpit herschrijven zonder noodzaak; klein houden; per pakket eigen bewijs (tests + Poort 5b-rapport); geen pagina's verwijderen zonder inventarisatiebesluit.

**Statuswoorden (verplicht, uitsluitend):** `working` · `partially_working` · `sporter_copy` · `missing_workspace` · `not_testable` · `broken` · `proposal_only`. Een rol is nooit `working` op alleen een label, startkaart of pagina.

**Harde acceptatieregel (bindend):** een rol geldt pas als gebouwd bij aantoonbaar (1) eigen startpagina, (2) eigen navigatie, (3) juiste server-side rechten, (4) eigen hoofdtaak, (5) passende teksten, (6) passende lege en fouttoestanden, (7) vaste testidentiteit, (8) echte kliktest, (9) telefoon- en desktopbewijs waar relevant, (10) geen ongewenste sporterfuncties.

Omvang-schaal: S (≤ halve dag), M (± 1 dag), L (meerdere dagen).

---

## WP-R1 — Ouderomgeving en ouderonboarding (PRIORITEIT 1)
- **Huidige fout:** ouder = `sporter_copy` (bevestigd via klik): sporternavigatie, eigen training/doel/wedstrijd toevoegbaar, Rijden/Wedstrijd/Analyse/Ontdekken zichtbaar, sporterprofiel + sporteronboarding zichtbaar, geen kindkiezer, geen Vandaag/planning van het kind, geen kindgerichte meldingen/toestemmingen.
- **Gewenste uitkomst:** eigen ouderomgeving. Telefoon-onderbalk: Kind(eren) · Vandaag (kind) · Meldingen · Toestemmingen · Profiel/Hulp. Desktop: kindkiezer, overzicht per kind, planning lezen, meldingen/verzoeken, toestemmingen/privacy, contact met trainer. Ouder belandt nooit automatisch in sporteronboarding of een eigen sporterdashboard.
- **Bestaande code die wordt hergebruikt:** `PARENT_CHAPTERS` (core-meer.ts), rechtenlaag `lib/parent-permissions.ts` + `routes/parent.ts`, ouder-rolvandaag via `GET /api/today?rol=parent` (WP-T2, getest), uitnodigingsmechanisme "Atleet koppelen" (token/expiry/intrekken werkt).
- **Ontbrekende delen:** kindkiezer-component; rolbewuste bestemmingspagina's of server-side gate/redirect voor rol parent op `/vandaag`, `/train`, `/races`, `/you`; meldingen-/verzoekenscherm; toestemmingsbeheer gericht op het kind; contact-met-trainer-scherm; oudergerichte onboarding-landing.
- **Testidentiteit:** twee ouder-fixtures (1 kind; 2+ kinderen) + verse niet-geaccepteerde ouder-uitnodiging.
- **Rechten (stap 1, vóór al het UI-werk):** verifiëren of write-endpoints (training/races/profiel) server-side een rolcheck voor `parent` hebben; zo niet: dichtzetten (veiligheidsfix, mag per pauzeregels direct). `POST` training als parent zonder kindcontext ⇒ 403.
- **Desktop-/telefoonvariant:** beide (telefoon primair).
- **Automatische tests:** parent-home rendert ouderview (niet athlete-home); menu-items Rijden/Wedstrijd/Analyse/Ontdekken afwezig voor rol parent; onboarding-route geeft parent nooit sporterstappen; 403-contract op writes; cross-kind-isolatie.
- **Echte kliktest:** volledige 11-stappenflow (uitnodiging → link → login → ouderonboarding → koppeling → ouderhome → kind kiezen → Vandaag kind → planning → melding/toestemming → uitloggen/inloggen zelfde omgeving), telefoon + desktop via e2e.
- **Acceptatiebewijs:** testsuite + e2e-screenshots + Poort 5b-rapport.
- **Omvang:** L. **Afhankelijkheden:** geen (WP-S1 afgerond); rechtenverificatie eerst.

## WP-R2 — Navigatieregister per rol en apparaat
- **Huidige fout:** menu's per rol/apparaat zijn niet uit één bron; trainer ziet sportersbalk; admin-/testitems tussen gebruikersfuncties; mobiel/desktop-menu's zonder gedocumenteerde samenhang.
- **Gewenste uitkomst:** één navigatieregister (SSOT: labels, volgorde, rechtenvereiste) per rol waar onderbalk én zijbalk uit renderen; T-functies alleen naar `/admin`.
- **Hergebruik:** `lib/core-meer.ts` (rolhoofdstukken bestaan al), `commercial-shell`/`screen-shell`.
- **Ontbrekend:** het register zelf + rendering per apparaat; opschoning Meer-groep "Beheer".
- **Testidentiteit:** bestaande fixtures per rol (incl. nieuwe uit R1/R3).
- **Rechten:** navigatie en datarechten uit één bron; geen parallel rechtenmodel.
- **Varianten:** beide apparaten. **Automatische tests:** `test:navigation`-uitbreiding (per rol: verplichte + verboden items). **Kliktest:** per rol menu-doorloop mobiel+desktop (e2e). **Bewijs:** suite + Poort 5b. **Omvang:** M/L. **Afhankelijkheden:** WP-R1 (ouderdefinities).

## WP-R3 — Trainer-subrollen en testidentiteiten
- **Huidige fout:** cockpit echt en werkend (`partially_working`), maar hoofdnavigatie sportergericht; "Rol-uitnodiging" = verboden taal; zelfstandig/club/hoofdtrainer niet afzonderlijk testbaar (één identiteit).
- **Gewenste uitkomst:** trainersnavigatie zonder persoonlijke sportersbalk (desktop-first: Sporters · Planning · Voorstellen · Uitnodigingen · Profiel); taakgerichte uitnodigingstaal; drie subrol-testidentiteiten met per subrol bewezen rechten/zicht (hoofdtrainer nooit individuele sporterdata — herbevestigen met eigen klikbewijs, niet alleen de bouwplan-claim).
- **Hergebruik:** volledige cockpit + `coach-home.tsx` + bestaande servergates (geen nieuwe trainerbackend).
- **Ontbrekend:** subrol-fixtures; navigatiescheiding; uitnodigingslabels.
- **Testidentiteit:** trainer-zelfstandig, clubtrainer, hoofdtrainer (vast).
- **Rechten:** per subrol afzonderlijk bewezen (403-grenzen). **Varianten:** desktop primair, telefoon kernacties. **Automatische tests:** sidebar-assert per subrol; hoofdtrainer 403 op individuele detailroutes; uitnodiging bestemming parent toont "Ouder uitnodigen". **Kliktest:** per subrol e2e. **Bewijs:** suites + Poort 5b. **Omvang:** L. **Afhankelijkheden:** WP-R2.

## WP-R4 — Clubbeheerderworkspace
- **Huidige fout:** `missing_workspace` / `not_testable` — geen identiteit, geen route; `CLUB_CHAPTER`-config zonder bestemming.
- **Gewenste uitkomst:** desktop-first workspace: eigen startpagina + navigatie (Overzicht · Leden · Teams · Trainers · Uitnodigingen · Instellingen); compacte mobiele kernacties; geen ongeoorloofde individuele sportdata (fail-closed vanaf de eerste bouwstap).
- **Hergebruik:** clubbackend (`lib/club-permissions.ts`, 16 tabellen, audit-log), trainerdesktop-patronen uit R3.
- **Ontbrekend:** rolroute/workspace-UI, testidentiteit, ledenbeheer-UI, team/trainer-koppel-UI, audittrail-UI.
- **Testidentiteit:** vaste clubbeheerder-fixture (+club met leden/teams).
- **Rechten:** clubbeheer ziet nooit trainings-/gezondheidsdata; ledenlijst alleen eigen club; server-side getest vóór UI-acceptatie. **Varianten:** desktop primair. **Automatische tests:** 403 op individuele-trainingdetailroute van een lid tenzij expliciet gedeeld. **Kliktest:** e2e desktop + mobiele kernacties. **Bewijs:** suites + Poort 5b. **Omvang:** L. **Afhankelijkheden:** WP-R3.

## WP-R5 — Onderscheid "Materiaal" versus mechaniekerrol
- **Huidige fout:** naamsverwarring — `/mechanieker` is een sporterpagina voor de eigen fiets; een mechanieker-clubrol bestaat niet (`proposal_only`).
- **Gewenste uitkomst:** (a) bestaande sporterpagina hernoemd naar **"Materiaal"** (alleen naam/navigatie, geen functiewijziging); (b) mechaniekerrol pas gebouwd na productbesluit René over materiaal-gegevensdeling — met eigen testidentiteit, rechten, werkplaats-werkruimte, alleen-toegestane-sporters-data, fail-closed deling, eigen navigatie.
- **Hergebruik:** garage-/materiaalbackend (`/api/garage*`, onderhoudssignalen).
- **Ontbrekend:** productbesluit deel-toestemming (fail-closed), fixture, Werkplaats-UI, onderhoudsregistratie-UI.
- **Testidentiteit:** mechanieker-fixture + delende/niet-delende sporters.
- **Rechten:** uitsluitend materiaalvelden van delende sporters; niet-delende sporters onzichtbaar. **Varianten:** telefoon primair. **Automatische tests:** fail-closed suite. **Kliktest:** e2e. **Bewijs:** suite + Poort 5b. **Omvang:** hernoemen S; rol M. **Afhankelijkheden:** hernoemen kan na R2; rol na R4 + productbesluit.

## WP-R6 — Admin en tester scheiden
- **Huidige fout:** geen aparte admin/testerworkspace; ADMIN-link `broken` (navigeert niet weg van `/`); "undefined"-labels; interne testerlabels ("ONDERBOUWING (TESTER)") in gewone gebruikersschermen; hoofdtester is een vlag op een sporteridentiteit.
- **Gewenste uitkomst:** adminfuncties uitsluitend onder `/admin` (link gerepareerd); testerextra's alleen expliciet toegestaan én gelabeld; normale sporters zien geen test-/adminfuncties; aparte admin-/testfixtures voor acceptatietests; verplichte terugvaltekst op elk rol-/contextlabel (nooit letterlijke `undefined`).
- **Hergebruik:** WP-S1-poorten (strikte `SPARKI_ADMIN_IDS`/`isHeadTester`, `debugAllowed`), bestaande `/admin`-pagina's.
- **Ontbrekend:** bugfix ADMIN-link; verplaatsing tester-QR/testfuncties; label-fallbacks + lint/testregel op `undefined` in gerenderde tekst.
- **Testidentiteit:** admin-fixture + hoofdtester-fixture (gescheiden van gewone sporter-fixtures).
- **Rechten:** niet-admin ⇒ 403 op alle `/admin`-subroutes. **Varianten:** desktop primair; mobiele werking `/admin` eerst bewijzen (nu onbewezen). **Automatische tests:** geen scherm buiten `/admin` bevat literal "undefined"; 403-suite. **Kliktest:** e2e admin-ingang + afwezigheid testlabels als gewone sporter. **Bewijs:** suites + Poort 5b. **Omvang:** M. **Afhankelijkheden:** WP-R2.

## WP-R7 — Rolrechten server-side testen
- **Huidige fout:** rechten per rol/subrol zijn niet systematisch per rol bewezen; open risico's: parent-writes (R1 stap 1), clubtrainer buiten eigen team, hoofdtrainer-individuele-data (claim, niet herbevestigd).
- **Gewenste uitkomst:** één rechten-testmatrix rollen × endpoints (lezen/schrijven/403), draaiend als vaste suite; elke rolgrens machine-toetsbaar.
- **Hergebruik:** bestaande isolatie-suites (cross-account, coach-parent, links, club) als fundament.
- **Ontbrekend:** matrixdekking voor parent-writes, subrollen, clubbeheer, mechanieker (zodra bestaand), admin.
- **Testidentiteit:** alle fixtures uit R1/R3/R4/R5/R6.
- **Rechten:** dit pakket ís het rechtenbewijs. **Varianten:** n.v.t. (server). **Automatische tests:** de matrix zelf. **Kliktest:** n.v.t. **Bewijs:** suite groen + Poort 5b. **Omvang:** M. **Afhankelijkheden:** loopt mee vanaf R1 (parent-writes eerst), volledig af te ronden na R6.

## WP-R8 — Telefoon- en desktopacceptatietest per rol
- **Huidige fout:** telefoonweergave nog niet betrouwbaar getest (`not_testable` in de kliktestomgeving); geen integrale rol×apparaat-acceptatie.
- **Gewenste uitkomst:** matrix rollen × apparaten × kerntaken via echte e2e-browserkliks (Clerk ticket-login, mobiele én desktop-viewport; DEV Preview is geen bewijs); per rol de harde acceptatieregel (10 punten) afgevinkt; geprioriteerde restpuntenlijst.
- **Hergebruik:** e2e-omgeving uit WP-S1 (`e2e/`).
- **Ontbrekend:** matrixscripts per rol; telefoon-bewijsmethode is er al (viewport in e2e).
- **Testidentiteit:** alle vaste fixtures. **Rechten:** geen T-functie zichtbaar buiten admin. **Varianten:** beide, per rol het primaire apparaat leidend. **Automatische tests:** e2e-matrix. **Kliktest:** dit pakket ís de kliktest. **Bewijs:** acceptatierapport + screenshots + Poort 5b. **Omvang:** M/L. **Afhankelijkheden:** alle vorige.

---

## Volgorde en pauzeregels
R1 → R2 → R3 → R4 → R5 → R6 → (R7 loopt mee vanaf R1, rondt af na R6) → R8.
Veiligheidsfixes en actieve rechtenlekken (m.n. parent-write-verificatie, R1 stap 1) mogen tussendoor, mits ze niet op structuurkeuzes wachten. Sporter-telefoonflows (oud WP-S6, incl. gepauzeerd routeplanner-weergavenwerk) en Profiel/Lichaam/Samen-herindeling (oud WP-S4) en Hulp/Privacy-plaatsing (oud WP-S5) blijven bestaan als later werk ná R8, tenzij René anders besluit.

## Beslissingen die nog van René nodig zijn
1. **Goedkeuring van dit herziene WP-R-plan** (er start niets zonder).
2. **Ouder-onderbalk telefoon:** akkoord met 5 items (Kind(eren) · Vandaag · Meldingen · Toestemmingen · Profiel/Hulp)?
3. **Trainer-subrolverschillen:** bevestiging van de voorgestelde scope-verschillen zelfstandig/club/hoofdtrainer.
4. **Materiaal-gegevensdeling mechanieker:** productbesluit over opt-in-deling (fail-closed) — vereist vóór elke bouwstap aan de mechaniekerrol.
5. **Hernoeming sporterpagina "Mechanieker" → "Materiaal":** akkoord (alleen naam, geen functiewijziging)?
6. **Sporter-onderbalkwissel** (Activiteiten i.p.v. Analyse, oud WP-S3-besluit) — blijft open.
7. Reeds open keuzes: #12 mappingvalidatie wielercategorieën, #13 ramp-rate-voorstel, #10 Samen-tab.
