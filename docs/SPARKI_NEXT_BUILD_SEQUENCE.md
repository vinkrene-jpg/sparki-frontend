# SPARKI NEXT BUILD SEQUENCE

Datum: 24 juli 2026. Gebaseerd op `docs/SPARKI_MODULE_BUILD_MATRIX.md`. Volgorde weegt: defecte kernfuncties → Data Trust → veiligheid/privacy → technische afhankelijkheden → gebruikersimpact → commerciële waarde → concurrentiepositie → basis voor vervolgmodules.

**Randvoorwaarde:** `SPARKI_AI_MASTER_PLAN_v2.16_CONFIRMED_ANSWERS.md` ontbreekt in de repository. Stappen 3 en verder die variantinhoud of nieuwe productscope vereisen, kunnen pas definitief worden na aanlevering van dat bestand. Open plan-besluiten zijn NIET zelf ingevuld.

---

VOLGORDE: 1
MODULE: Routes/flags — publicatie van de flags-race-fix
REDEN: enige bekende defecte kernflow in productie (routeplanner onzichtbaar na inlog-race); fix staat al in de code maar bereikt gebruikers pas na publicatie.
AFHANKELIJKHEDEN: geen (alleen publiceren).
GESCHATTE OMVANG: geen code — publicatieactie.
RISICONIVEAU: laag.
VERPLICHTE TESTS: bestaande suite (reeds groen bij oplevering fix).
BEWIJS VAN OPLEVERING: productielog toont na een verse inlogsessie een geslaagde flags-oproep (200) zonder blijvende 403-terugval; head tester ziet de routeplanner.

---

VOLGORDE: 2
MODULE: Master Plan-koppeling afronden
REDEN: het planbestand is de bron voor variant-indeling (Go/Basic/Performance/Pro), add-on-besluiten en scopebesluiten (dating, voorraad, ANT+, mentale kaarten, externe mechanieker). Zonder dit bestand blijven die velden `MASTERPLAN_SOURCE_REQUIRED` en kan er geen commerciële bouwlijn worden vastgezet.
AFHANKELIJKHEDEN: aanlevering van `SPARKI_AI_MASTER_PLAN_v2.16_CONFIRMED_ANSWERS.md` door René (extern; kan niet uit de repo komen).
GESCHATTE OMVANG: klein — bestand ongewijzigd plaatsen in `docs/`, daarna matrixvelden invullen met planverwijzingen als bewijs.
RISICONIVEAU: laag.
VERPLICHTE TESTS: geen code.
BEWIJS VAN OPLEVERING: planbestand in `docs/`, matrix zonder onnodige `MASTERPLAN_SOURCE_REQUIRED`-markeringen, afwijkingen plan↔code expliciet gelabeld.

---

VOLGORDE: 3
MODULE: Entitlement-fundament (varianten zonder betalingen en zonder feature-toewijzing)
REDEN: grootste ontbrekende bouwsteen met directe commerciële waarde; alle latere variant-/add-on-/aankoopfunctionaliteit steunt hierop; kan neutraal gebouwd worden zónder open plan-besluiten in te vullen (variantinhoud blijft leeg tot stap 2).
AFHANKELIJKHEDEN: bestaand feature-flag-systeem (hergebruik verplicht), `user_profiles`. Kan parallel aan/vóór stap 2 omdat het geen variantinhoud vastlegt.
GESCHATTE OMVANG: klein (1 kolom + resolutielaag + endpoint + adminweergave + tests). Zie `docs/NEXT_REPLIT_ASSIGNMENT.md`.
RISICONIVEAU: laag-middel (raakt rechtenresolutie; uitbreidend, geen gedragswijziging voor bestaande gebruikers).
VERPLICHTE TESTS: nieuwe entitlement-resolutietests + bestaande flag-/isolatietests groen.
BEWIJS VAN OPLEVERING: werkende flow (endpoint + adminzicht), regressie groen, geen gedragsverandering voor bestaande gebruikers (default-variant = huidig gedrag).

---

VOLGORDE: 4
MODULE: Variant→feature-mapping + upgrades/downgrades/proefperioden
REDEN: maakt varianten functioneel; vereist Master Plan (stap 2) voor de inhoud per variant.
AFHANKELIJKHEDEN: stap 2 én stap 3.
GESCHATTE OMVANG: middel; opsplitsen in (a) mapping-tabel + resolutie-integratie, (b) proefperiode-mechaniek, (c) admin-beheer.
RISICONIVEAU: middel.
VERPLICHTE TESTS: entitlement-matrixtests per variant, downgrade-fail-closed-tests, jeugd/ouder-toestemmingstests indien betaald.
BEWIJS VAN OPLEVERING: testaccount per variant ziet exact de afgesproken features; wissel omhoog/omlaag aantoonbaar correct.

---

VOLGORDE: 5
MODULE: Betaalprovider-koppeling en losse aankopen (incl. route-/GPX-aankopen, contentpakketten)
REDEN: pas zinvol na werkende entitlements; providerkeuze is een open besluit (niet zelf invullen).
AFHANKELIJKHEDEN: stap 4; providerbesluit; jeugd-/ouderregels.
GESCHATTE OMVANG: middel-groot; opsplitsen per aankooptype.
RISICONIVEAU: hoog (geld, jeugd, wetgeving).
VERPLICHTE TESTS: end-to-end aankoopflow, refund/annulering, entitlement-intrekking, minderjarigen-blokkade.
BEWIJS VAN OPLEVERING: echte (test-modus) aankoop levert entitlement; intrekking neemt hem aantoonbaar weg.

---

VOLGORDE: 6
MODULE: Garmin/Wahoo device-sync activeren
REDEN: hoge gebruikersimpact (automatische data-aanvoer); code staat klaar en is fail-closed; wacht uitsluitend op fabrikantsleutels (externe actie).
AFHANKELIJKHEDEN: API-sleutels Garmin/Wahoo (René, extern).
GESCHATTE OMVANG: klein (secrets + webhookverificatie + smoke-test).
RISICONIVEAU: laag (voorbereid, manualFields heilig).
VERPLICHTE TESTS: webhook-ingest-test met echt device.
BEWIJS VAN OPLEVERING: activiteit van echt device verschijnt via webhook in Data Hub zonder handmatige actie.

---

VOLGORDE: 7
MODULE: Scopebesluit-modules (mentale kaarten-uitbreiding, voorraad/reserveonderdelen, externe mechanieker-rol, ANT+, dating voor volwassenen)
REDEN: allemaal NOT_BUILT of PARTIALLY_BUILT met onbepaalde scope; bouwen zonder plan = open besluiten zelf invullen (verboden). Dating heeft daarbovenop een zeer hoog veiligheids-/privacyrisico (jeugd op hetzelfde platform) en is NO-GO tot expliciet veiligheidsontwerp.
AFHANKELIJKHEDEN: stap 2 (Master Plan) per module; dating bovendien 18+-verificatieontwerp.
GESCHATTE OMVANG: per module vast te stellen ná besluit; elk opsplitsen in kleine zelfstandig testbare stappen.
RISICONIVEAU: variabel; dating hoog.
VERPLICHTE TESTS: per module vast te stellen; rechten-/leeftijdstests verplicht.
BEWIJS VAN OPLEVERING: per module vast te stellen.

---

Opmerking: alle overige hoofdmodules staan op BUILT_STABLE met groene tests en krijgen géén plek in de volgorde — afbouwregel 1 (behouden, niet opnieuw bouwen).
