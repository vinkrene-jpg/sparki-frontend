# Sparki — Rolwerkruimtemodel

**Datum:** 31-07-2026 · **Status:** VOORSTEL, ter goedkeuring aan René (niets gebouwd).
Per rol: doel, startpagina, hoofdmenu, secundaire navigatie, dagelijkse taken, toegestane gegevens, schrijf-/beheerrechten, telefoon- en desktopervaring, uitnodigings-/onboardingroute. Rechten zijn overal server-side (bestaande gates blijven de enige waarheid; geen parallel rechtenmodel).

## 0. Mirror-testwerkwijze (BINDEND — vastgelegd 31-07-2026)
Iedere belangrijke gebruikersclaim over een rolwerkruimte wordt getoetst aan **drie bronnen**: (1) afgesproken productwaarheid, (2) actuele broncode + server-side rechten, (3) werkelijke klikuitkomst in de draaiende app. Verplichte volgorde: vinden → werkelijk aanklikken → bewijs vastleggen → afwijkingen clusteren → herstelvoorstel → goedkeuring René → bouwen → dezelfde flow opnieuw testen → regressietest vastleggen. **Mirror-principe:** de browseragent kijkt naar dezelfde app als René, volgt dezelfde klikroute, vergelijkt gedrag met documenten en code, legt inconsistenties vast en doet pas daarna een herstelvoorstel. Kernregels: een rol geldt niet als gebouwd op basis van alleen een label, startkaart of client-side rolwissel; een scherm dat technisch laadt maar bij de verkeerde rol hoort is niet passend; wat een browseragent niet echt kan aanklikken is "niet getest"; DEV Preview is testgereedschap, productie is de officiële acceptatieomgeving; ieder bewijs vermeldt URL/omgeving/commit-SHA/identiteit/rol/apparaat/klikroute/verwacht/werkelijk/screenshots; herstelde fouten worden waar mogelijk vaste e2e-regressietests; René test begrijpelijkheid en bruikbaarheid, agents en automatische tests leveren de brede dekking. Canonieke, volledige beschrijving: `SPARKI_ROLE_DEVICE_INFORMATION_ARCHITECTURE_AUDIT.md` §0a.

## 1. Sporter (volwassen)
- **Doel:** trainen, rijden, begrijpen, verbeteren — telefoon-first.
- **Start:** Vandaag. **Hoofdmenu (mobiel):** Vandaag · Trainen · Rijden · Activiteiten · Meer. **Secundair:** Meer-hoofdstukken (Analyse, Lichaam, Samen, Kennis, …).
- **Dagelijks:** training bekijken/afronden, rit starten/terugkijken, gewicht/gevoel loggen.
- **Gegevens:** alleen eigen data; delen via expliciete koppelingen.
- **Schrijfrechten:** eigen profiel, trainingen, ritten, materiaal, privacy-instellingen.
- **Telefoon:** begeleide stappen, drawers/overlays, één primaire actie per scherm. **Desktop:** companion voor routeplanning/diepe analyse.
- **Uitnodiging/onboarding:** zelfregistratie of uitnodiging door trainer/club → sporteronboarding (bestaand pad).

## 2. Jeugdrenner (<18)
- Als sporter, plus: jeugdcopy zonder jargon, geen wedstrijd-rotatiedruk, fail-closed deelregels, geen voedingsgetallen (<17), oudertoestemming waar vereist.
- **Uitnodiging/onboarding:** via club/trainer of ouder; onboarding vraagt leeftijd eerst en schakelt jeugdregels direct in.

## 3. Ouder/verzorger — PRIORITEIT 1 · huidige status: `sporter_copy` (kliktest 31-07-2026)
- **Waarom de huidige ouderomgeving FOUT is (allemaal bevestigd via echte klik):**
  - de ouder ziet dezelfde sporternavigatie (Vandaag, Trainen, Rijden, Wedstrijd, Activiteiten, Analyse, Ontdekken, Meer);
  - kan een **eigen training toevoegen**;
  - kan **eigen doelen en wedstrijden toevoegen**;
  - Rijden, Wedstrijd, Analyse en Ontdekken zijn zichtbaar;
  - sporterprofiel én sporteronboarding ("01 Wie je bent als sporter") zijn zichtbaar;
  - er bestaat **geen kindkiezer**;
  - er bestaat **geen Vandaag van het kind**;
  - er bestaat **geen kindplanning**;
  - er zijn geen kindgerichte meldingen of toestemmingen zichtbaar (alleen "Delen met coach/ouder"-toggles op het eigen profiel — verkeerde context).
- **Preciezere diagnose (broncode):** `PARENT_CHAPTERS` in `core-meer.ts` bestaat al (menu-laag is rolbewust), maar de bestemmingspagina's (`/vandaag`, `/train`, `/races`, `/you`) zijn dat niet — die tonen elke rol dezelfde sporterinhoud.
- **Server-side geverifieerd (31-07-2026, broncode-inspectie):** de write-endpoints (o.a. `POST /api/races`, training-inserts in `routes/athlete.ts`) eisen alleen authenticatie en schrijven uitsluitend onder het **eigen** clerkId. Er is dus **géén cross-account-lek**: een ouder kan geen data van het kind of een andere sporter muteren. Wél ontbreekt een server-side rolgate voor `parent`, zodat een ouderaccount sporterdata op het eigen account kan aanmaken — een rolmodel-fout (product/UI + ontbrekende gate), geen data-isolatielek. Dichtzetten (403 voor `parent` zonder kindcontext) blijft onderdeel van WP-R1.
- **Doel:** welzijn en veiligheid van het kind volgen binnen toegestane categorieën — telefoon-first.
- **Gewenste omgeving telefoon (onderbalk):** **Kind(eren) · Vandaag (van het kind) · Meldingen · Toestemmingen · Profiel/Hulp.**
- **Gewenste omgeving desktop:** kindkiezer (vast bovenaan); overzicht per kind; planning bekijken (van het kind, lezen); meldingen en verzoeken; toestemmingen en privacy; contact met trainer; **geen eigen sporterfuncties als standaard ouderomgeving.**
- **Harde regel:** de ouder belandt **nooit automatisch** in sporteronboarding of een eigen sporterdashboard.
- **Dagelijks:** kind kiezen, dagstatus kind, planning kind inzien, meldingen/verzoeken beoordelen, toestemming/privacy beheren, contact met trainer.
- **Gegevens:** uitsluitend categorieën uit de ouderlink (permissies); minor fail-closed.
- **Schrijfrechten:** eigen account; toestemmingen; géén trainingsdata van het kind.
- **Testidentiteiten nodig:** één ouder met 1 kind, één ouder met 2+ kinderen (kindkiezer + cross-kind-isolatie), plus een verse niet-geaccepteerde ouder-uitnodiging.
- **Uitnodiging/onboarding:** ouder-uitnodiging → **eigen ouderlanding en oudergerichte onboarding** (nu ontbrekend: landt in sporteronboarding — herstellen in WP-R1).

## 4. Zelfstandige trainer — status: `partially_working` (kliktest 31-07-2026)
- **Feitelijk vastgesteld:** de coach-startpagina en de cockpit (`/coach/athletes/:id/cockpit`) zijn **echt en grotendeels passend** (signaalkaarten, geschraagde planning, berichten, correcte lege-toestanden). De hoofdsidebar is echter nog sportergericht (volledige persoonlijke sportersnavigatie naast de trainersfuncties). Het uitnodigingslabel "Rol-uitnodiging" is **verboden gebruikerstaal**.
- **Subrollen niet testbaar:** zelfstandige trainer, clubtrainer en hoofdtrainer zijn **niet afzonderlijk testbaar** — er is één trainersidentiteit ("Coach Bram"). Voor elk van de drie subrollen is een **eigen testidentiteit** nodig, en rechten/zichtbaarheid moeten **per subrol afzonderlijk bewezen** worden.
- **Harde regel:** geen nieuwe trainerbackend bouwen — de bestaande cockpit en servergates zijn herbruikbaar en blijven de enige waarheid.
- **Doel:** meerdere sporters volgen, plannen en bijsturen — **desktop-first**.
- **Start:** Trainersoverzicht (aandachtssporters, rolvandaag). **Hoofdmenu (desktop):** Sporters · Planning · Voorstellen · Uitnodigingen · Profiel. **Secundair:** per sporter cockpit/plan.
- **Dagelijks:** aandachtslijst, gemiste trainingen, voorstellen beoordelen.
- **Gegevens:** per sporter volgens deelniveau; privénotities owner-only.
- **Schrijfrechten:** plannen/voorstellen bij directe link; nooit gezondheid schrijven.
- **Telefoon:** compacte kernacties (aandacht, akkoord/afwijzen), geen bulk.
- **Uitnodiging/onboarding:** trainer nodigt sporter uit ("Nodig je sporter uit") → sporteronboarding met koppelvoorstel.

## 5. Clubtrainer
- Als zelfstandige trainer, maar sporters via clubtoewijzing (team): roster-zichtbaarheid zonder individuele data tenzij directe link. Startpagina toont teams i.p.v. losse sporters.

## 6. Hoofdtrainer
- **Doel:** organisatorisch overzicht over trainers/teams — desktop-first. **Nooit individuele sportersdata.**
- **Start:** Organisatie-overzicht (teams zonder trainer, bezetting, rolvandaag hoofdtrainer). **Menu:** Teams · Trainers · Toewijzingen · Profiel.
- **Schrijfrechten:** toewijzingen; geen sporterdata.
- **Uitnodiging:** nodigt clubtrainers uit (clublink met rol).

## 7. Clubbeheerder — status: `missing_workspace` / `not_testable` (kliktest 31-07-2026)
- **Feitelijk vastgesteld:** geen testidentiteit en geen vindbare workspace; `CLUB_CHAPTER` bestaat als menu-config in `core-meer.ts`, maar er is geen bijbehorende route/werkruimte aangetroffen.
- **Benodigd vóór bouwacceptatie:** vaste testidentiteit; eigen startpagina; eigen navigatie; leden; teams; trainers; uitnodigingen; instellingen; geen ongeoorloofde individuele sportdata (fail-closed vanaf de eerste bouwstap, server-side getest); desktop als primaire werkruimte; compacte mobiele kernacties.
- **Doel:** club besturen: leden, teams, rollen, capaciteit — desktop-first.
- **Start:** Clubbeheer-dashboard (rolvandaag clubbeheer: teams zonder trainer, open uitnodigingen, ledenstand). **Menu:** Leden · Teams · Uitnodigingen · Instellingen.
- **Gegevens:** ledenroster en clubadministratie; geen trainings-/gezondheidsdata.
- **Schrijfrechten:** clubrollen, teams, uitnodigingen (capaciteits- en jeugdregels blijven server-side).
- **Telefoon:** alleen kernacties (uitnodiging intrekken, lid accepteren).
- **Uitnodiging:** clublinks per rol (lid/trainer/beheer/ouder/mechanieker).

## 8. Mechanieker (clubrol) — status: `proposal_only` / `not_testable` (kliktest 31-07-2026)
- **Strikt onderscheid (bindend):** **"Materiaal"** = bestaande sporterfunctie voor de eigen fiets (huidige pagina `/mechanieker` — wordt in het plan voorlopig hernoemd naar "Materiaal" om begripsverwarring te voorkomen). **"Mechanieker"** = mogelijke clubrol met eigen werkruimte — bestaat nu **niet**.
- **De mechaniekerrol geldt pas als bestaand bij:** eigen testidentiteit; eigen rechten; eigen werkplaats(-werkruimte); materiaalgegevens van alleen toegestane sporters; fail-closed gegevensdeling; eigen navigatie.
- **Doel (voorstel):** materiaalstatus van clubfietsen/renners inzien en onderhoudsacties registreren — telefoon geschikt (werkplaats).
- **Gegevens:** uitsluitend materiaal/garage-gegevens van sporters die dat expliciet delen (opt-in); nooit training/gezondheid; niet-delende sporters onzichtbaar (fail-closed).
- **Afhankelijkheid:** productbesluit René over materiaal-gegevensdeling is er nog niet — bouwen vóór dat besluit is verboden (WP-R5).

## 9. Ploegleider
- **SUPERSEDED (01-08-2026, HERSTEL TEAM_ABONNEMENT_01 / SPARKI-BESLUIT-2026-010):** de onderstaande aanname is vervallen. Er bestaat nu WÉL een aparte server-side clubrol `ploegleider` (naast `teammanager`), met trainings-/wedstrijd- en team-scoped rechten maar zonder clubbeheer. Tevens: `medic` → `medical_staff` met beschrijvend functietype zonder rechten; gebruikersnamen `member`="Sporter", `alleen_lezen`="Gast".
- ~~**Technisch bestaat er geen aparte ploegleidersrol** — het is een coach-functie (wedstrijddagcontext in de trainerweergave, getest in de Vandaag-matrix). Geen nieuwe rol bouwen (opdrachtregel §9).~~ WP-S8 bepaalt of wedstrijddag een eigen desktopweergave binnen de trainersomgeving krijgt.

## 10. Admin — status: `broken`/`partially_working` (kliktest 31-07-2026)
- **Feitelijk vastgesteld:** er is géén echte aparte admin/testerworkspace; de ADMIN-link werkt niet (navigeert niet weg van `/`); testfuncties en interne labels ("ONDERBOUWING (TESTER)", "undefined · rol: athlete") zitten in gewone gebruikersschermen.
- **Doel:** platformbeheer, gezondheidsdashboard, gegevensopschoning.
- **Regels (bindend):** adminfuncties **uitsluitend onder `/admin`**; alleen via expliciete SPARKI_ADMIN_IDS; admin-functies nooit in gebruikersmenu's; dev-bypass geldt nooit als bewijs; aparte admin-/testfixtures voor acceptatietests.

## 11. Tester (incl. hoofdtester) — status: vlag, geen workspace
- **Feitelijk vastgesteld:** hoofdtester is nu een vlag op een sporteridentiteit — geen aparte rol of workspace.
- **Regels (bindend):** testerextra's alleen zichtbaar wanneer expliciet toegestaan (server-gated, `debugAllowed`) én duidelijk gelabeld; normale sporters zien nooit test- of adminfuncties; interne labels of een letterlijke `undefined` in gerenderde tekst zijn per definitie fout.
- **Onboarding:** QR/link → automatische acceptatie → `/welkom-tester` (bestaand, werkt).

## Gedeelde wetten (alle rollen, beide apparaten)
Zelfde data, rechten, businesslogica, engines, auditlogging en veiligheidsregels. Telefoon en desktop mogen wezenlijk anders presenteren, nooit anders beslissen.

## Harde acceptatieregel (bindend voor élke rol)
Een rol geldt pas als **gebouwd** wanneer aantoonbaar aanwezig zijn:
1. eigen startpagina;
2. eigen navigatie;
3. juiste server-side rechten;
4. eigen hoofdtaak;
5. passende teksten;
6. passende lege en fouttoestanden;
7. vaste testidentiteit;
8. echte kliktest;
9. telefoon- en desktopbewijs waar relevant;
10. geen ongewenste sporterfuncties.

Een label, startkaart of pagina alléén is nooit voldoende voor de status `working`.
