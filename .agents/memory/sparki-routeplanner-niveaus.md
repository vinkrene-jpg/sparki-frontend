---
name: Routeplanner 4 weergaveniveaus + Wedstrijd-weergave
description: Productbesluit René (30/31-07-2026) over routeplanner-niveaus, abonnement Sparki Complete en het Bewaard één-lijst-contract.

**Naamcorrectie (besluit 30-07-2026):** het hoogste weergaveniveau heet **"Wedstrijd"**, uitdrukkelijk NIET "Compleet" — dat zou verwarren met het abonnement **Sparki Complete**. Weergaven: Gratis / Go gewone fietser / Go wielrenner-MTB-gravel / Wedstrijd. Automatisch voorgesteld, altijd handmatig aanpasbaar, keuze bewaard, terug-naar-automatisch mogelijk, volledig los van abonnement; veiligheid (blokkadepoort, eindverificatie, wegdekwaarschuwingen) op élk niveau.
---

# Routeplanner-niveaus (besluit René)

- Vier weergaveniveaus voor de routeplanner (eenvoudig → wedstrijdrenner), akkoord met de 4-niveaustabel.
- **Weergaveniveau staat LOS van abonnement**: automatisch bepaald op profiel, altijd zelf aanpasbaar; een Compleet-gebruiker moet net zo makkelijk naar de eenvoudige weergave kunnen.
- **Veiligheid is niveau-onafhankelijk**: blokkadepoort-status en wegdek-waarschuwingen blijven op élk niveau zichtbaar, ook Gratis. Nooit wegvereenvoudigen.
- Derde individuele bundel heet **"Compleet"** (naast Gratis en Go); moet als onderdeel van het niveaus-werk meegebouwd worden (niet als losse taak), anders hangt het wedstrijdrenner-niveau nergens aan. Trainers/teams/clubs krijgen aparte abonnementen.
- **Why:** expliciete AskQuestion-beslissing van René; afwijken = productbesluit overrulen.
- **How to apply:** bij elk routeplanner-UI- of entitlement-werk; Compleet gaat via het entitlement-fundament (AND met flags), niet via feature flags alleen.

# Gebouwd 31-07-2026 (weergavelaag)

- Weergavelaag = puur presentatie: `sparki/lib/planner-view.ts` (enum gratis|go_fietser|go_sport|wedstrijd + feature-map + deterministisch voorstel), keuze in `athlete_profiles.planner_view` (NULL = automatisch) via bestaand PUT-profielpad (enum-whitelist, null wist).
- **Verborgen optie = niet meesturen:** RouteGenerator gebruikt effectieve waarden (wens, N-wegen, trainingskoppeling) — een optie die de UI niet toont mag de routemotor nooit stiekem sturen. Uitzondering: onverhard-schuif blijft zichtbaar zodra gravel/MTB gekozen is, óók onder het go_sport-niveau (meesturend getal nooit onzichtbaar).
- "Eigen route"-modus blijft altijd bereikbaar bij route-wijzigen (bestaande waypoints), anders valt bestaande functionaliteit stil weg.
- #505 en #506 zijn afgerond en bewezen — nooit heropenen of opnieuw bevragen.

# Nacontrole 31-07-2026 (bewezen)

- Kliktest mobiel+desktop + API-persistentie: alle checkpunten PASS; rapport SANITY_5B_2026-07-31_planner-vier-weergaven-nacontrole.yaml, screenshots docs/product/evidence/planner-views/.
- **Profielenums kunnen NL óf EN zijn:** competition_level bevat zowel "regional" als "regionaal/nationaal" — elke afleiding uit profielenums moet beide talen matchen (suggestPlannerView gebruikt nu regex incl. lokaal/regionaal/nationaal en "gevorderd").
- Node-page-testmocks veroudereren stil: nieuwe import in de component-keten (use-planner-view→useMutation/@clerk/react/@/lib/dev, DsStatus) breekt de mock-dekking pas bij de eerstvolgende run — na elke wijziging aan route-panel de gate-tests draaien.
- Standaardtab /routes is "maken" (besluit René 31-07, commit ffc18aa9); ?route/?nav/?ritopties zonder view blijven op Bewaard landen.

# Bewaard één-lijst-contract (gebouwd 31-07-2026)

- /routes?view=bewaard: RouteLibrary is dé (ingeklapte) lijst; de grote RouteCard rendert alleen voor de route in `?route=`/`?nav=`/`?ritopties=`, lijst dan tijdelijk verborgen, terugknop "← Alle routes".
- Terugknop wist alléén `route`+`ritopties`, nooit `nav` (nav = veiligheidsherstel na herlaad midden in rit) en is verborgen zolang `?nav=` actief is.
- routes-tabs.test.tsx bewaakt dit contract (lijst verborgen bij selectie, zichtbaar zonder).

## Kaart-eerst startweergave (Komoot-opzet, 04-08-2026)
- Routes opent standaard kaart-eerst met voorstellen uit het eigen corpus; wizard blijft via "Zelf plannen". De nearby-bladerlaag draait de blokkadepoort NIET per kaartbeweging (Overpass-burst/koude-cache) — elke rij zegt eerlijk "controle bij gebruik" en elk gebruikspad checkt fail-closed.
- **Why:** volledigheid is de kernbelofte: ophalen mag nooit vóór de afstandsranking afkappen (bbox-voorselectie + volledige paginering), anders verdringt nieuw-ver stil oud-dichtbij; gedeeld/openbaar altijd kijkersweergave, fail-closed zonder bekend huisadres.
