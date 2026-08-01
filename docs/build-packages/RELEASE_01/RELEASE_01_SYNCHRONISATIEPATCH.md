# RELEASE_01 — SYNCHRONISATIEPATCH

Uit te voeren **nadat Mirror het releaserapport heeft opgeleverd**. De vrijgave zelf blijft een besluit van René.

## Afbouwmatrix
- per domein dat in `RELEASE_01` is geslaagd: `voortgang = RELEASE_READY`, met verwijzing naar het releaserapport en de release-SHA;
- een domein met bevindingen blijft `MIRROR_PROVEN` en krijgt een verwijzing naar de bevinding;
- een gefaald domein gaat terug naar `OPEN` met het eigenaar-pakket erbij;
- **niets komt op `RELEASE_READY` zonder een geslaagde rubriek in het releaserapport.**

## Dagkaart
> - `RELEASE_01` doorlopen op release-SHA `<SHA>`. Per domein een oordeel; bevindingen geroutefd naar hun eigen pakket. Vrijgavebesluit ligt bij René.

## Releasestatus
Onder **Bewezen** per geslaagd domein een regel met de release-SHA en de rubriek waarin het is aangetoond.

Onder **Releaseblokkades die blijven gelden** uitsluitend de domeinen die zijn gefaald, met hun eigenaar-pakket. Alles wat "geslaagd met bevindingen" is, is géén blokkade tenzij René dat zo besluit.

Voeg toe:
> - Prestatie en externe aanroepen per kernflow zijn gemeten en gerapporteerd, niet geoptimaliseerd. De kostenafweging is een besluit van René.

## Roadmap
- blok **Totale regressie** op prioriteit I, met de uitkomst per domein;
- de bevindingen verschijnen als vervolgstap bij hun eigen domeinpakket, niet als nieuwe taak hier.

## Besluitregister
> ## SPARKI-BESLUIT-2026-0XX — Releasevrijgave
> **Status:** te nemen door René ná het releaserapport
> - Welke domeinen gaan mee in de release en welke wachten.
> - Of de gemeten prestatie en het aantal externe aanroepen per flow aanvaardbaar zijn.
> - Of de openstaande bewaartermijnen een betaalde publieke release nog in de weg staan.
> - Of Stripe live gaat.

Vul dit besluit pas in nadat het rapport er ligt. Een vooraf ingevuld releasebesluit is precies het soort valse voortgang dat dit pakket moet uitsluiten.

## Functiematrix
Per functie de bewijsstatus bijwerken naar de uitkomst uit het releaserapport. Functies zonder rubriek in dat rapport blijven staan zoals ze stonden — een release toetst niet automatisch wat niemand heeft doorlopen.
