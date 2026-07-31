# MIRROR-TOETS — AI_KWALITEIT_01

**Toetser:** Mirror · **Onderwerp:** bronvermelding, onzekerheid, taal en antwoordvorm
**Voorwaarde:** Replit heeft opgeleverd met eindcommit en bewijs

## Vooraf vaststellen
1. Vraag op hoe de drie zekerheidsniveaus worden bepaald.
2. Noteer of `DATA_TRUST_01` al Mirror-goedgekeurd is. Zo niet: de bronvermelding steunt op een niet-bewezen laag — meld dat als voorbehoud.
3. Bevestig dat er geen tweede bronvermeldings- of afkeurmechanisme is gebouwd.

**Accounts nodig:** sporter met veel echte data · sporter met **weinig** data · nieuw account zonder data.

## Wat deze toets moet vaststellen
Of de AI **nooit zekerder klinkt dan hij is** — en of elk getal aanwijsbaar is.

## A. Bronvermelding
1. Vraag drie persoonlijke adviezen op bij het account met veel data. Elk getal is opvraagbaar via het uitlegendpoint en klopt.
2. Zoek actief naar een getal dat niet herleidbaar is. Vind je er één, dan is dat een afkeuring.
3. Controleer dat er nergens "op basis van je gegevens" staat zonder aanwijsbare gegevens.

## B. Onzekerheid
4. Vraag hetzelfde advies bij het account met **weinig** data. Het antwoord is expliciet onzeker, niet zelfverzekerd.
5. Vraag het bij het **lege** account. Antwoord: onbekend, met wat er nodig is — geen algemeen advies dat persoonlijk leest.
6. Vergelijk de drie antwoorden naast elkaar. Het verschil in zekerheid is zichtbaar voor een gewone gebruiker, niet alleen in een veld.

## C. Ontbrekende data
7. Laat een advies uitblijven. De AI benoemt **welke** gegevens ontbreken en wat de gebruiker kan doen.

## D. Taal en toon
8. Doorloop tien AI-antwoorden op verschillende schermen. Geen Engelse restanten in gebruikersteksten.
9. Beoordeel de toon: geen aansporing, geen schuldgevoel, geen urgentie die er niet is. Beoordeel de exacte tekst, niet de bedoeling.
10. Antwoordlengte past bij de vraag.

## E. Tegenstrijdigheid en herhaling
11. Forceer een advies dat een eerder advies tegenspreekt. Het wordt herkend en uitgelegd, niet stil vervangen.
12. Vraag twee keer hetzelfde. Geen dubbel advies.

## F. Kwaliteitsweergave
13. Open de beheerweergave. Aantallen afgekeurde antwoorden, terugvallen en falende doelen kloppen met `ai_call_logs`.
14. **Geen gespreksinhoud** in die weergave.

## G. API en regressie
15. Directe API-aanroep levert dezelfde bronvermelding als de interface.
16. Bestaande kwaliteitstests zijn aanwezig en groen.
17. De Mirror-bewezen onderdelen uit eerdere pakketten zijn onaangetast.

## Afkeuringsgronden
- een persoonlijk getal zonder aanwijsbare bron;
- een zelfverzekerde formulering bij beperkte data;
- een leeg account dat een persoonlijk klinkend advies krijgt;
- een uitblijvend advies zonder uitleg wat ontbreekt;
- Engelse restanten of valse urgentie in gebruikersteksten;
- stil vervangen van een tegenstrijdig advies;
- gespreksinhoud in de kwaliteitsweergave;
- een tweede bronvermeldings- of afkeurmechanisme.

## Rapportvorm
Per scenario: verwacht, werkelijk, oordeel. Begin met de drie vaststellingen vooraf. Zet bij rubriek B de drie antwoorden **letterlijk** naast elkaar in je rapport. Eindoordeel: goedgekeurd of afgekeurd met concrete blokkade.

## Uitzonderingslijst voor herstel
Raakt een fix de bronvermeldingslaag, de zekerheidsbepaling of de afkeur- en terugvalregistratie, dan wordt deze toets **volledig** hernomen. Betreft het aantoonbaar alleen een geïsoleerde teksttemplate, dan volstaat het betrokken scenario plus rubriek G.
