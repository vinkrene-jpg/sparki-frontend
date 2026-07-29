# Reviewset 07 — Club en Team

**Bron:** audit-commit `7e2f1983` · Status: CURRENT_AUDIT_SOURCE (PENDING_RENE_REVIEW bij twijfel).
**Vaste koers (correctie op fase 1):** Club en Team blijven in scope. Club = laagdrempelige acquisitie- en clublaag; Team = betaald professioneel product. Dit is **geen** ja/nee-vraag aan René meer. Ontbrekende Club-/Team-abonnementen of entitlements zijn een **productgat** (PROVEN_SUBSCRIPTION_GAP). Alleen exacte prijs en live Stripe blijven een latere beslispoort.

## Representatieve screenshots (max 8)
1. `club/390x844/boven.jpg` — clubomgeving (sporter-lid)
2. `club/390x844/fullpage.jpg` — volledige clubpagina
3. `club/1440x900/boven.jpg` — desktopvariant
4. `wedstrijd-room/390x844/boven.jpg` — wedstrijd-room (teamcontext)
5. — /club/beheer: geen screenshot (vergt clubbeheerrechten); bewijs: code + clubtests.

## Hoofdbevindingen (max 10)
1. **PROVEN_PRESENT** — clubfundament: clubomgeving, /club/beheer, least-privilege clubrechten, ledenlimieten (ook bij invite-accept), jeugd-consent fail-closed, FOR UPDATE op signup.
2. **PROVEN_PRESENT** — teamachtige functies verspreid aanwezig: wedstrijd-room, volgauto (mobiel), samen-feed.
3. **PROVEN_SUBSCRIPTION_GAP** — Club-abonnement bestaat niet in het entitlements-model (geen tier, geen prijs, geen feature-set). Productgat conform vaste koers.
4. **PROVEN_SUBSCRIPTION_GAP** — Team-abonnement (betaald professioneel product) bestaat niet; teamfuncties hangen los zonder commercieel model.
5. **PROVEN_ROLE_GAP** — clubbeheerder is geen platformrol (alleen clubrechten-laag); ploegleider ontbreekt geheel als rol (zie reviewset 08).
6. **PROVEN_MISSING** — geen koppeling club↔trainer(s)↔teams als organisatiestructuur (Master Plan TEAM_LEADER deels).
7. **CHATGPT_PRODUCT_REVIEW_REQUIRED** — voorstel feature-verdeling Club (acquisitie, laagdrempelig) vs Team (professioneel, betaald) op basis van Master Plan; René toetst daarna alleen prijs + eindverdeling.
8. **DEFERRED_BY_DECISION** — prijsstelling en live Stripe voor Club/Team: latere beslispoort.
9. **EVIDENCE_INSUFFICIENT** — clubbeheer-flows niet live doorlopen (geen beheer-testaccount).

## Automatische herstelkandidaten (max 5)
1. — geen; dit is bouw- en modelleerwerk, geen veilig automatisch herstel.

## Echte René-besluiten (max 3)
1. **Prijs- en beslispoort Club/Team** — pas aan de orde ná het ChatGPT-verdeelvoorstel (bewust nog geen kaart).
2. **Bouwvolgorde rollen/werkruimtes** → `rene-decisions/besluit-04-bouwvolgorde-rollen.md`.
