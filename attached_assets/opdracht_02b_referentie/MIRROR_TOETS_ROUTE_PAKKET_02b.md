# MIRROR-TOETS — ROUTE_PAKKET_02b

**Toetser:** Mirror
**Onderwerp:** gratis maandlimiet en navigatiereserveringen
**Voorwaarde:** Replit heeft `02b` opgeleverd met eindcommit en bewijs; `02a` is goedgekeurd
**Identiteiten:** `seed_persona_gratis`, `seed_persona_go`, `seed_persona_pro` — geen op `legacy_unrestricted`

## Vooraf vaststellen

Noteer als eerste **de stand van de 20%-vlag** waarmee is opgeleverd. Die bepaalt de helft van deze toets. Staat de vlag uit, dan bestaan reserveringen niet en zijn de scenario's D en E niet van toepassing — dat is dan geen tekortkoming maar de opgeleverde toestand.

## Wat deze toets moet vaststellen

`02b` is de eerste opdracht die iets weigert. De kern: **weigert hij precies het juiste, en niets méér.** Een limiet die ook maar één handeling raakt die vrij moet blijven, is een afkeuring — ook als de telling klopt.

---

## A. De limiet zelf (Gratis)

1. Gebruik acht verschillende routes. Alle acht slagen. Teller loopt zichtbaar op.
2. Probeer een negende route op te slaan. Geweigerd, met begrijpelijke uitleg.
3. Probeer een negende route als GPX te exporteren. Geweigerd, zelfde uitleg.
4. Plan een negende route. **Werkt.**
5. Pas die negende route aan op afstand, tijd, wegtype, hoogte en wind. **Werkt.**
6. Bekijk de negende route en het hoogteprofiel. **Werkt.**

## B. Al getelde routes blijven vrij

7. Exporteer bij 8 van 8 een route die deze maand al is geteld. Werkt, teller blijft 8.
8. Start bij 8 van 8 navigatie op een al getelde route. Werkt, geen reservering, teller blijft 8.

## C. Navigatie op een nieuwe route bij 8 van 8

9. Start navigatie op een route die deze maand nog niet is geteld. Geweigerd, met dezelfde uitleg als bij opslaan en exporteren.
   *Staat de 20%-vlag uit: navigatie wordt hier niet geweigerd. Noteer dat als de opgeleverde toestand.*

## D. Reserveringen — alleen met de vlag aan

10. Start navigatie op een nog niet getelde route terwijl er nog ruimte is. Er ontstaat een reservering en de beschikbare ruimte daalt met één.
11. Breek de rit af onder 20%. De reservering wordt vrijgegeven, de teller stijgt niet, de ruimte komt terug.
12. Rijd een tweede route tot 20% via de testhaak. De reservering wordt precies één registratie.
13. Laat een reservering verlopen (12 uur, of via de opgeleverde testhaak). De plek komt vrij.

## E. Gelijktijdigheid — alleen met de vlag aan

14. Start twee navigatiesessies tegelijk terwijl er nog één route beschikbaar is. Samen leveren ze **niet** twee registraties op. Voer dit uit via directe API-aanroepen, niet via twee browsertabbladen — de race moet echt gelijktijdig zijn.

## F. Go en Compleet

15. Gebruik als Go twintig routes. Geen blokkade, geen waarschuwing, **geen teller zichtbaar**.
16. Idem als Compleet.

## G. Meldingen

17. Bij 7 van 8: een rustige waarschuwing verschijnt. Er wordt niets geblokkeerd.
18. Bij 8 van 8: duidelijke uitleg van wat wel en niet meer kan, met het aanbod om naar Go te gaan.
19. **Geen aftelklok, geen misleidende urgentie, geen vooraf aangevinkte aankoop, geen suggestie dat routes verloren gaan.** Beoordeel de exacte tekst, niet alleen de aanwezigheid ervan.

## H. Maandgrens

20. Voor zover in DEV Preview te beïnvloeden: een nieuwe kalendermaand heft de blokkade op, volgens `Europe/Amsterdam`. Kan dat niet echt worden nagebootst, steun dan op de unittest en meld dat expliciet.

## I. Regressie op eerdere opdrachten

21. De zeven gratis functies uit `01` werken voor een gratis account **onder** zijn quotum.
22. De gratis basisbibliotheek werkt: eigen routes zien, openen, verwijderen.
23. `POST /api/routes/zoek` als Gratis: 200, geen 403.
24. De telling uit `02a` gedraagt zich onveranderd: plannen, aanpassen en bekijken tellen nog steeds niet.

## J. Testvervanging

25. Controleer dat er **precies één** bestaande test is vervangen, en dat dat test 18 uit `02a` is. Elke andere gewijzigde of verwijderde bestaande test is een afkeuringsgrond.

## K. Data-trust en apparaten

26. Geen mock-, seed- of demogegevens in teller, reserveringen of meldingen.
27. Herhaal de kernstappen op desktop en mobiel.

---

## Afkeuringsgronden

- een handeling die vrij moet blijven wordt geweigerd of vertraagd — met name plannen, aanpassen, bekijken, of gebruik van een al getelde route;
- Go of Compleet raakt de limiet;
- een reservering die niet wordt vrijgegeven of niet verloopt;
- gelijktijdige sessies die samen over de limiet komen;
- misleidende urgentie of een vooraf aangevinkte aankoop in de melding;
- meer dan één vervangen bestaande test;
- een wijziging buiten limiet, reserveringen en meldingen.

## Rapportvorm

Per scenario: verwacht, werkelijk, oordeel. Begin met de stand van de 20%-vlag. Noem expliciet wat je **niet** hebt kunnen toetsen en waarom. Sluit af met één eindoordeel: **goedgekeurd** of **afgekeurd met concrete blokkade**.

Bij goedkeuring: `ROUTE_PAKKET_02c` kan door René worden vrijgegeven — mits besluit D1 (downgrade bij meer dan drie bewaarde routes) dan genomen is.
