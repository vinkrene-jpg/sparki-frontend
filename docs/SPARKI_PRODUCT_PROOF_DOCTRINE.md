# SPARKI PRODUCT PROOF DOCTRINE v1.4

> Canonieke plaats: `docs/SPARKI_PRODUCT_PROOF_DOCTRINE.md` (v1.4, 2026-07-30). Vorige versie gearchiveerd als `docs/archive/SPARKI_PRODUCT_PROOF_DOCTRINE_v1.1.md`.

**Datum:** 30 juli 2026, bijgewerkt 21:38 CEST  
**Status:** ACTIEF

## 1. Geen functionaliteit zonder belofte

Iedere module begint met één heldere gebruikersbelofte. De belofte beschrijft waarde, voorwaarden en uitsluitingen, niet de techniek.

## 2. Geen bouw zonder productonderzoek

Voor bouw of wijziging worden bestaande Sparki-code, officiële bronnen, marktbenaderingen, databronnen, algoritmen, architectuur, licenties en gaps onderzocht.

## 3. Acceptatiegrenzen zijn productkeuzes

Iedere belofte heeft expliciete grenzen. Bij een ontbrekend besluit geldt tijdelijk de strengste eerlijke variant en wordt het open punt geregistreerd.

## 4. Hard falen wordt nooit gemiddeld

Eén hard falen keurt de individuele uitkomst af. Voorbeelden:

- één verboden routesegment keurt de route af;
- één ongeautoriseerde datalezing keurt de actie af;
- één contextlek tussen trainerrollen keurt de autorisatie af;
- één niet-verifieerbare veiligheidscontrole mag niet als veilig worden gepresenteerd.

## 5. Onbekend is geen akkoord

Voor veiligheids- en autorisatiekritische controles worden minimaal drie uitkomsten onderscheiden:

- aantoonbaar geldig;
- aantoonbaar ongeldig;
- niet betrouwbaar verifieerbaar.

Alleen aantoonbaar geldig mag worden vrijgegeven. `unverifiable` is geen zachte waarschuwing wanneer veiligheid of privacy op het spel staat.

## 6. Geen bouw zonder bewijsontwerp

Tegenvoorbeelden, meetniveau en bewijsstappen bestaan vóór implementatie. `designed/not_yet_tested` is eerlijk; het is geen uitgevoerd bewijs.

## 7. Technische afronding is geen productbewijs

Build, typecheck, unit-tests, merge, publicatie en zichtbare functionaliteit zijn noodzakelijk maar onvoldoende.

## 8. Het bewijsobject is de verticale gebruikersketen

Product Proof toetst het volledige pad waarin de gebruiker de waarde ontvangt. Een correcte detector met een latere fail-open stap faalt de belofte.

## 9. Product Proof-score en veto

Minimale dimensies:

- betrouwbaarheid;
- volledigheid;
- begrijpelijkheid;
- relevantie;
- consistentie;
- praktische bruikbaarheid.

Een module is pas gereed bij minimaal 9,0, vooraf vastgelegde meetcriteria per dimensie en zonder open hard-fail veto.

## 10. Onafhankelijke beoordeling

Product Proof vereist:

1. objectief technisch en gebruikerspadbewijs;
2. onafhankelijke code- en claimvalidatie;
3. echte praktijk- of producttest;
4. eindbeoordeling door René.

## 11. Poort 5b — sanity-check

Vóór praktijktestoplevering controleert de bouwer op echte schermen:

- iedere zichtbare bediening werkt;
- functies passen bij context, fiets, rol en scherm;
- navigatie leidt naar een gerenderde toestand;
- placeholders blijven niet als einduitkomst staan;
- ongeldigheid wordt niet als klaar gepresenteerd.

## 12. Poort 5c — onafhankelijke code- en ketenreview

De reviewer vergelijkt exacte SHA's, leest de diff, volgt de geraakte keten, controleert kalibratie en tests, en benoemt wat niet is uitgevoerd.

## 13. Poort 6a — testerfouten zijn contractkennis

Iedere testerfout wordt permanent verwerkt als regel, tegenvoorbeeld, meetniveau, regressietest, bewijs en commitreferentie.

## 14. Geen uitbreiding op een onvoldoende basis

Nieuwe functionaliteit binnen een domein wordt gepauzeerd wanneer de kernbelofte fundamenteel faalt. Onderzoeks- of kalibratiewerk mag alleen afgebakend doorgaan zonder productbouw te starten.

## 15. Eerlijke statussen

Technisch aanwezig, gekalibreerd, contract goedgekeurd, getest, praktisch bewezen en Product Proven blijven afzonderlijke statussen.

## 16. Definitie van gereed

> De oorspronkelijke, goedgekeurde productbelofte is via de volledige gebruikersketen objectief en onafhankelijk bewezen, praktisch bevestigd, scoort minimaal 9,0 en bevat geen open harde afkeur of onverifieerbare veiligheids-/privacytoestand.
