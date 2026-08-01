# TEAM_ONBOARDING_01 — REPLIT-BOUWOPDRACHT

**Onderwerp:** ZELFSTANDIGE TEAM-ORGANISATIE — ONBOARDING, STRUCTUUR, STAF EN ORGANOGRAM
**Uitvoerder:** Replit Agent
**Type:** breed domeinpakket
**Startcommit:** actuele `main`; SHA bevestigen in het eindrapport
**Vrijgave:** René
**Grondslag:** `SPARKI_BESLUITEN_EN_BOUWVERDELING_CLUB_TEAM_ROLLEN_2026-08-01.md` (bindend),
SPARKI-BESLUIT-2026-010, besluitregister, `SPARKI_SJABLOON_DOMEINPAKKET`

## 1. Doel

Maak de volledige instroom van een zelfstandige Team-organisatie productiegeschikt:
van registratie tot actieve teamomgeving. Na oplevering is aantoonbaar waar een
gebruiker:

1. een zelfstandige Team-organisatie aanmaakt (organisatietype `TEAM`, los van een club);
2. een teamorganogram-kaart kiest (Compact wedstrijdteam / Prestatieploeg /
   Etappe-/koersorganisatie / Zelf samenstellen);
3. selecties/subteams aanmaakt (bijv. elite, U23, junioren, dames, development);
4. de stafstructuur inricht (teammanager, ploegleider, trainer, mechanieker,
   soigneur, medical_staff met functietype, member = "Sporter", alleen_lezen = "Gast");
5. uitnodigingen verstuurt en geaccepteerd ziet worden;
6. een onderbroken onboarding hervat;
7. de Team-organisatie activeert;
8. dit alles op desktop én mobiel/PWA doet.

## 2. Bindende architectuurregels

1. **Geen tweede organisatie-entiteit.** Een zelfstandige Team-organisatie wordt
   opgeslagen in de bestaande `clubs`/organisatiearchitectuur met organisatietype
   `TEAM`; een Club-organisatie gebruikt organisatietype `CLUB`.
2. `club_teams` wordt hergebruikt voor selecties/ploegen/subteams binnen zowel
   Club als Team.
3. De bestaande Team-checkout met `club_id`-metadata blijft bruikbaar als
   organisatie-ID; dit betekent níét dat een Team productmatig een Club is.
4. **Geen eigen rechtenlaag.** Het centrale rollen- en rechtenmodel is eigendom
   van CLUB_RECHTEN_01; dit pakket consumeert het alleen.
5. Rolwaarden zijn de bestaande server-side waarden; `ploegleider` en
   `teammanager` zijn en blijven gescheiden rollen; `medical_staff` heeft een
   beschrijvend functietype zonder eigen rechten.
6. Bestaande hervatbare-onboarding- en uitnodigingsmechanieken uit
   CLUB_ONBOARDING_01 worden hergebruikt, niet gedupliceerd.

## 3. Organogram-kaarten (bindende regels)

- kaarten tonen uitsluitend rollen die server-side bestaan;
- kaarten maken uitsluitend een CONCEPTstructuur en leiden geen rechten af;
- na activering worden rollen, groepen en relaties afzonderlijk beheerd;
- een nieuw sjabloon kan nooit destructief over een actieve organisatie worden gelegd;
- bestaande personen en rollen verdwijnen nooit door een latere structuurwijziging;
- kaarten tonen rolplekken, geen voorbeeldpersonen of mocknamen;
- echte namen verschijnen pas na geaccepteerde uitnodiging of geldige koppeling;
- onderbroken onboarding is hervatbaar.

## 4. Definition of Done

1. De hele gebruikersketen uit §1 werkt op desktop en mobiel/PWA.
2. Frontend, backend, database, rechten, foutpaden en lege toestanden zijn afgerond.
3. Bestaande architectuur is hergebruikt; er is geen tweede organisatie- of
   rechtenmodel ontstaan.
4. Alle nieuwe en relevante bestaande tests groen (minimaal: team-organisatie,
   team-abonnement, club, club-onboarding, cross-account-isolation, typecheck).
5. Migratie bewezen op verse database én representatieve kopie met bestaande data;
   bestaande Club-organisaties blijven byte-voor-byte ongemoeid.
6. Directe API-aanroepen dwingen dezelfde rechten af als de UI.
7. Eindrapport met start-/eind-SHA, commando's, exitcodes en bewijs; commit + push.
8. Geen zichtbare flow "bijna klaar", placeholder of mockgedreven.

## 5. Buiten scope

- rechtenarchitectuur (CLUB_RECHTEN_01);
- operationele wedstrijdflow (PLOEGLEIDER_01);
- materiaal-/voorraadflows (TEAM_MECHANIEKER_01);
- abonnement/Stripe/facturatie (TEAM_ABONNEMENT_01);
- medische dossierinhoud (medische teamflow, apart);
- clubonboarding (CLUB_ONBOARDING_01, variant 1 bindend).

## 6. Product- en gebruikersregels

1. Iedere handeling heeft één aantoonbare eigenaar, actor, tijdstip en bron.
2. Statusovergangen (concept → actief) zijn expliciet, server-side gevalideerd,
   idempotent en auditbaar; activering alleen via het activatiepad.
3. Historie blijft behouden; niets wordt stilzwijgend gewist.
4. Jeugd-/oudertoestemming en CYD-regels gelden onverkort in teamverband.
5. Lege toestanden zijn eerlijk; geen voorbeeldinhoud.
6. Korte, concrete Nederlandse uitleg bij blokkade, fout of vervolgstap.
7. Gelijktijdige acties veroorzaken geen dubbele organisaties, uitnodigingen of
   tegenstrijdige status (locks/uniciteit zoals in CLUB_ONBOARDING_01).

## 7. Bewijsplicht

- rolaantallen vóór/na (geen persoonsdatamigratie verwacht);
- testuitvoer met exitcodes;
- desktop- én mobielbewijs (screenshots in `bewijsarchief/`);
- Poort 5b-sanityrapport;
- eindrapport uitsluitend met status **BUILD_DELIVERED**; vrijgave is aan René
  na Mirror-toets.
