# Sparki — Rolwerkruimtemodel

**Datum:** 31-07-2026 · **Status:** VOORSTEL, ter goedkeuring aan René (niets gebouwd).
Per rol: doel, startpagina, hoofdmenu, secundaire navigatie, dagelijkse taken, toegestane gegevens, schrijf-/beheerrechten, telefoon- en desktopervaring, uitnodigings-/onboardingroute. Rechten zijn overal server-side (bestaande gates blijven de enige waarheid; geen parallel rechtenmodel).

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

## 3. Ouder/verzorger
- **Doel:** welzijn en veiligheid van het kind volgen binnen toegestane categorieën — telefoon-first.
- **Start:** Ouderoverzicht (welzijn kind + rolvandaag). **Hoofdmenu:** Kind(eren) · Meldingen · Profiel. **Secundair:** toestemmingen/herbevestiging, hulp.
- **Dagelijks:** dagsignaal kind, herbevestigingen, wedstrijdlogistiek.
- **Gegevens:** uitsluitend categorieën uit de ouderlink (permissies); minor fail-closed.
- **Schrijfrechten:** eigen account; toestemmingen; géén trainingsdata van het kind.
- **Uitnodiging/onboarding:** ouder-uitnodiging → **eigen ouderlanding** (nu ontbrekend: landt in sporteronboarding — herstellen in WP-S2).

## 4. Zelfstandige trainer
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

## 7. Clubbeheerder
- **Doel:** club besturen: leden, teams, rollen, capaciteit — desktop-first.
- **Start:** Clubbeheer-dashboard (rolvandaag clubbeheer: teams zonder trainer, open uitnodigingen, ledenstand). **Menu:** Leden · Teams · Uitnodigingen · Instellingen.
- **Gegevens:** ledenroster en clubadministratie; geen trainings-/gezondheidsdata.
- **Schrijfrechten:** clubrollen, teams, uitnodigingen (capaciteits- en jeugdregels blijven server-side).
- **Telefoon:** alleen kernacties (uitnodiging intrekken, lid accepteren).
- **Uitnodiging:** clublinks per rol (lid/trainer/beheer/ouder/mechanieker).

## 8. Mechanieker (clubrol)
- **Doel (voorstel):** materiaalstatus van clubfietsen/renners inzien en onderhoudsacties registreren — telefoon geschikt (werkplaats).
- **Vandaag:** géén eigen omgeving (bewust; eerlijke 403 op beheer/trainer-weergaven is getest). WP-S9 definieert een minimale eigen werkruimte; tot die tijd is de rol alleen roster-lidmaatschap.
- **Gegevens:** uitsluitend materiaal/garage-gegevens van sporters die dat delen; nooit training/gezondheid.
- **Naamconflict:** het sportersscherm "Mechanieker" hernoemen (bv. "Materiaal") zodra de rolomgeving bestaat.

## 9. Ploegleider
- **Technisch bestaat er geen aparte ploegleidersrol** — het is een coach-functie (wedstrijddagcontext in de trainerweergave, getest in de Vandaag-matrix). Geen nieuwe rol bouwen (opdrachtregel §9); WP-S8 bepaalt of wedstrijddag een eigen desktopweergave binnen de trainersomgeving krijgt.

## 10. Admin
- **Doel:** platformbeheer, gezondheidsdashboard, gegevensopschoning.
- **Start:** `/admin`. Volledig gescheiden van gebruikersnavigatie; alleen via expliciete SPARKI_ADMIN_IDS.
- **Regel:** admin-functies nooit in gebruikersmenu's; dev-bypass geldt nooit als bewijs.

## 11. Tester (incl. hoofdtester)
- **Doel:** gestructureerd testen met extra onderbouwing (bv. Vandaag-debugweergave via `debugAllowed`).
- **Start:** normale gebruikersomgeving + tester-extra's duidelijk gelabeld; tester-QR en testbeheer horen in de admin-omgeving, niet in gebruikersinstellingen.
- **Onboarding:** QR/link → automatische acceptatie → `/welkom-tester` (bestaand, werkt).

## Gedeelde wetten (alle rollen, beide apparaten)
Zelfde data, rechten, businesslogica, engines, auditlogging en veiligheidsregels. Telefoon en desktop mogen wezenlijk anders presenteren, nooit anders beslissen.
