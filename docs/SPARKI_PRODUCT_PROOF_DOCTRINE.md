# SPARKI PRODUCT PROOF DOCTRINE v1.0

Deze doctrine vervangt featuregedreven ontwikkeling.

Vanaf nu wordt Sparki gebouwd op basis van bewezen productbeloften.

----------------------------------------
1. GEEN FUNCTIONALITEIT ZONDER BELOFTE
----------------------------------------

Iedere module begint met één heldere productbelofte.

Niet:

"Routeplanner"

Maar bijvoorbeeld:

"Een wielrenner kan binnen 30 seconden een betrouwbare route genereren die geschikt is voor zijn gekozen fiets, doel en omstandigheden."

De belofte beschrijft altijd de waarde voor de gebruiker, nooit de techniek.

----------------------------------------
2. GEEN BOUW ZONDER BEWIJS
----------------------------------------

Na implementatie moet bewezen worden dat de oorspronkelijke belofte daadwerkelijk is waargemaakt.

Niet voldoende:

- Build succesvol
- Tests groen
- Pull Request gemerged
- Feature aanwezig

Wel voldoende:

Objectief bewijs dat de gebruiker de oorspronkelijke belofte daadwerkelijk ervaart.

----------------------------------------
3. PRODUCT PROOF SCORE
----------------------------------------

Iedere module wordt beoordeeld op minimaal:

- Betrouwbaarheid
- Volledigheid
- Begrijpelijkheid
- Relevantie
- Consistentie
- Praktische bruikbaarheid

De beoordeling gaat over de WAARDE van de module, niet over de kwaliteit van de code.

----------------------------------------
4. DE 9-REGEL
----------------------------------------

Een module is pas gereed bij een eindscore van minimaal 9,0.

Voorbeelden:

9,6 = Gereed

9,2 = Gereed

8,9 = Niet gereed

8,0 = Opnieuw verbeteren

7,0 = Herontwerpen

5,0 = Fundament opnieuw beoordelen

Onder een 9 wordt nooit als productiegeschikt beschouwd.

----------------------------------------
5. BIJ AFKEUR WORDT DE OORZAAK BEPAALD
----------------------------------------

Wanneer de belofte geen 9 behaalt moet automatisch worden vastgesteld waardoor dit komt.

Mogelijke oorzaken:

- verkeerde productbelofte
- verkeerde architectuur
- verkeerde databron
- verkeerde implementatie
- ontbrekende functionaliteit
- onvoldoende validatie
- onvoldoende integratie
- onvoldoende betrouwbaarheid
- onvoldoende gebruikerswaarde

Niet alleen melden DAT iets onvoldoende is.

Maar ook WAAROM.

----------------------------------------
6. GEEN UITBREIDING OP EEN ONVOLDOENDE BASIS
----------------------------------------

Nieuwe functionaliteit wordt niet gebouwd zolang de kernbelofte van de betreffende module geen 9 of hoger behaalt.

Eerst kwaliteit.

Daarna uitbreiding.

----------------------------------------
7. ONAFHANKELIJKE PRODUCT PROOF
----------------------------------------

De ontwikkelaar beoordeelt zijn eigen werk nooit als eindbeoordelaar.

De Product Proof bestaat uit:

1. Objectief bewijs
2. Onafhankelijke AI-validatie
3. Praktijktest
4. Eindbeoordeling

Pas daarna krijgt een module de status:

PRODUCT PROVEN

----------------------------------------
8. HET BELANGRIJKSTE PRINCIPE
----------------------------------------

Sparki wordt niet ontwikkeld om functies toe te voegen.

Sparki wordt ontwikkeld om productbeloften aantoonbaar waar te maken.

Een feature die aanwezig is maar zijn belofte niet waarmaakt bestaat feitelijk niet.

De enige definitie van "gereed" is:

"De oorspronkelijke productbelofte is objectief bewezen met een score van minimaal 9,0."
----------------------------------------
9. GEEN BOUW ZONDER PRODUCTONDERZOEK
----------------------------------------

Voordat een module wordt gebouwd of aangepast moet eerst worden onderzocht hoe vergelijkbare productieproducten dezelfde productbelofte waarmaken.

Het onderzoek beschrijft minimaal:

- de productbelofte;
- de huidige Sparki-aanpak;
- de best beschikbare marktbenadering;
- de benodigde databronnen;
- de benodigde algoritmen;
- de benodigde architectuur;
- de verschillen (gaps);
- de voorgestelde oplossing.

Pas na goedkeuring van dit Productonderzoek mag de implementatie starten.

Sparki wordt nooit aangepast aan de beperkingen van de huidige implementatie zonder eerst te bewijzen dat een betere oplossing redelijkerwijs niet haalbaar is.
