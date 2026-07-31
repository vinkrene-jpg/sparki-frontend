---
name: Sparki route-zoeklaag (bekende routes eerst)
description: Beleid: bij een routeaanvraag eerst eigen/gedeelde bekende routes voorstellen vóór nieuwe generatie; hybride varianten alleen op eigen basisroutes.
---

# Route-zoeklaag: bekend eerst, nieuw daarna

- **Volgorde is sequentieel, niet parallel**: de klant zoekt éérst bekende routes; nieuwe generatie start alleen automatisch wanneer er géén bruikbare bekende route is, anders pas na een expliciete keuze van de rijder. Gelijktijdig vuren telt als "niet eerst".
- **Fail-closed geldt óók voor bekende routes**: elke treffer gaat vóór levering door dezelfde blokkademeting als nieuwe generatie. Geen antwoord of crash ⇒ "niet controleerbaar" en niet bruikbaar; blokkade ⇒ gemarkeerd met eerlijke reden. Routes zonder geometrie zijn onverifieerbaar en dus nooit voorstelbaar.
- **Limiet ná verificatie**: rangschik ruim (±12 kandidaten), verifieer tot er genoeg (5) bruikbare zijn, en pas de voorstel-limiet toe op de brúikbare uitkomsten — anders verdringt een geblokkeerde top-5 permanent schone lager gerangschikte routes.
- **Gedeelde routes**: matchen en leveren uitsluitend op de privacy-veilige kijkersgeometrie; nooit direct start-baar en nooit hybride basis. Fail-closed op eigenaar: huisadres onbekend ⇒ geen rij, en alleen AANTOONBAAR volwassen (≥16) eigenaren — onbekende leeftijd is óók uitsluiten (strikter dan de minderjarigheidscheck, die onbekend als niet-minor telt).
- **Hybride variant**: alleen een EIGEN route als basis; via-punten deterministisch uit de eerste helft (terugweg wordt opnieuw gepland + geverifieerd). Herkomst hoort in naam én motivering zodat hij bij opslaan meereist; AI-verrijking wordt voor hybride overgeslagen omdat die de herkomstregel stilletjes zou overschrijven.
- **Zoekresultaten zijn criterium-gebonden**: de bekende-lijst hoort bij precies één criteria-sleutel (start/modus/afstand/fietssoort/…); wijzigt één veld ⇒ lijst wissen, anders omzeilt de volgende aanvraag de verplichte zoekstap of toont routes van een vorig startpunt.
- **Why:** eerlijkheidsprincipe — nooit een oude route ongecheckt aanbieden, geen privacylek via de zoeklaag, en "eerst bestaand" moet ook in het aanvraaggedrag waar zijn.
- **How to apply:** elke nieuwe consumer van bekende routes (mobiel, coach) gebruikt dezelfde rank-→verify-→limiet-volgorde en dezelfde sequentiële zoek-dan-genereer-flow.
