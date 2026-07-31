---
name: Routeplanner 4 weergaveniveaus + Compleet-tier
description: Productbesluit René (30/31-07-2026) over routeplanner-niveaus, abonnement "Compleet" en het Bewaard één-lijst-contract.
---

# Routeplanner-niveaus (besluit René)

- Vier weergaveniveaus voor de routeplanner (eenvoudig → wedstrijdrenner), akkoord met de 4-niveaustabel.
- **Weergaveniveau staat LOS van abonnement**: automatisch bepaald op profiel, altijd zelf aanpasbaar; een Compleet-gebruiker moet net zo makkelijk naar de eenvoudige weergave kunnen.
- **Veiligheid is niveau-onafhankelijk**: blokkadepoort-status en wegdek-waarschuwingen blijven op élk niveau zichtbaar, ook Gratis. Nooit wegvereenvoudigen.
- Derde individuele bundel heet **"Compleet"** (naast Gratis en Go); moet als onderdeel van het niveaus-werk meegebouwd worden (niet als losse taak), anders hangt het wedstrijdrenner-niveau nergens aan. Trainers/teams/clubs krijgen aparte abonnementen.
- **Why:** expliciete AskQuestion-beslissing van René; afwijken = productbesluit overrulen.
- **How to apply:** bij elk routeplanner-UI- of entitlement-werk; Compleet gaat via het entitlement-fundament (AND met flags), niet via feature flags alleen.

# Bewaard één-lijst-contract (gebouwd 31-07-2026)

- /routes?view=bewaard: RouteLibrary is dé (ingeklapte) lijst; de grote RouteCard rendert alleen voor de route in `?route=`/`?nav=`/`?ritopties=`, lijst dan tijdelijk verborgen, terugknop "← Alle routes".
- Terugknop wist alléén `route`+`ritopties`, nooit `nav` (nav = veiligheidsherstel na herlaad midden in rit) en is verborgen zolang `?nav=` actief is.
- routes-tabs.test.tsx bewaakt dit contract (lijst verborgen bij selectie, zichtbaar zonder).
