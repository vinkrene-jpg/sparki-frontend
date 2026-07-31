# MIRROR-TOETS — ABONNEE_ADMIN_01

**Toetser:** Mirror
**Onderwerp:** lidnummer, abonneeregister, levenscyclus, AVG en uitzonderingen
**Type:** breed domeinpakket
**Voorwaarde:** Replit heeft opgeleverd met eindcommit en bewijs

## Vooraf vaststellen

1. Vraag de **vertaaltabel** op: levenscyclusstatus → onderliggende Stripe-/entitlementstatus → rechten. Je toetst daartegen.
2. Vraag de **bewaarmatrix** op en noteer welke termijnen zijn gemarkeerd als besluitpunt. Die toets je niet inhoudelijk.
3. Noteer of gedeeltelijke refund is gebouwd of gemeld als niet ondersteund.
4. Bevestig dat de omgeving in Stripe-**testmodus** draait. Zie je een sleutel die niet met `sk_test_` of `rk_test_` begint: stop en meld dat als blokkade.

**Accounts nodig:** nieuw Gratis · trial Go · actief Go · actief Compleet · account met mislukte betaling · account met refund · account met chargeback · minderjarige met oudertoestemming · beheerder mét bevoegdheid · beheerder **zonder** bevoegdheid.

## Wat deze toets moet vaststellen

Twee dingen, en het tweede is het zwaarst. **Klopt elke status met de rechten die eruit volgen**, en **verdwijnt er nergens iets dat niet mocht verdwijnen.** Een lifecycle die netjes werkt maar bij opzegging een account wist, is een afkeuring.

---

## A. Lidnummer

1. Registreer een nieuw account. Precies één lidnummer, formaat `SPK-JJJJ-NNNNNN`, zichtbaar in profiel en abonnementsoverzicht.
2. Vuur via de testhaak **twee gelijktijdige registraties** af. Twee verschillende nummers, geen botsing, geen fout.
3. Upgrade, downgrade, wijzig het e-mailadres, pauzeer en zeg op. Het nummer verandert bij geen van deze.
4. **Probeer met alleen een lidnummer toegang te krijgen** tot account-, betaal- of persoonsgegevens, via de interface en via directe API-aanroepen. Nergens toegang.
5. Controleer een bestaand account uit de migratie: precies één nummer, geen dubbele.
6. Controleer dat een nummer van een verwijderd account niet opnieuw is uitgegeven.

## B. Abonneeregister

7. Open het register voor drie accounts. Alle gevraagde velden zijn aanwezig en kloppen met de database.
8. **Geen volledige betaalkaartgegevens** zichtbaar, nergens.
9. Eén leidende actuele pakketstatus per account; historische subscriptions apart zichtbaar.
10. Forceer een conflict tussen Stripe en Sparki — bijvoorbeeld door een webhook niet te verwerken. Het register toont een **conflictstatus**; er wordt niet stilzwijgend één bron gevolgd, en er worden geen rechten toegekend op vermoeden.

## C. Levenscyclus

11. Loop door: trial → active · trial → cancelled · active → cancel_at_period_end → free · active → payment_failed → grace_period · grace → active na herstel · grace → free na verlopen termijn.
12. Bij elke overgang: rechten kloppen met de vertaaltabel, en de melding klopt met wat er gebeurt.
13. Zet een onbekende of conflicterende status. Geen rechten — en **geen enkel persoonsgegeven gewist**.

## D. De vijf gescheiden flows — het zwaartepunt

14. Zeg het abonnement op. **Het account bestaat nog**, alle gegevens zijn er, de gebruiker valt terug op Gratis op de einddatum.
15. Controleer dat opzeggen nergens accountverwijdering suggereert of als vervolgstap aanbiedt.
16. Pauzeer en hervat. Rechten bevriezen en komen terug; gegevens blijven.
17. Deactiveer een account. Dat is niet hetzelfde als verwijderen — controleer wat er wel en niet verdwijnt.
18. Downgrade met meer dan drie routes. Alle routes blijven zichtbaar; boven de limiet alleen-lezen; de gebruiker kiest drie; tot die keuze verdwijnt niets.

## E. Betaalincidenten raken geen data

19. Laat een betaling mislukken, laat grace verlopen, voer een refund uit, voer een chargeback uit. Na elk: **de sport-, route-, training- en gezondheidsdata is compleet en ongewijzigd.**
20. Dubbele webhook: geen tweede effect. Vertraagde webhook: eindtoestand klopt.

## F. Support en lidnummer

21. Maak een supportvraag aan. Hij koppelt aan het juiste lidnummer, pakket, rol, platform en categorie.
22. Ticketgegevens van account A zijn niet zichtbaar voor account B — ook niet via directe aanroep.
23. **Probeer een accountwijziging of refund aan te vragen met alleen een lidnummer als identificatie.** Geweigerd; een beveiligde identiteitscontrole is vereist.

## G. Privacy en verwijdering

24. Vraag inzage en export aan. Het bestand bevat de eigen gegevens en niets van een ander.
25. Start accountverwijdering. Identiteitscontrole, gevolgen zichtbaar, export aangeboden, en een **dry-run die exact toont wat wordt verwijderd of geanonimiseerd**.
26. Bevestig niet. Er is niets veranderd.
27. Controleer dat verwijdering niet lukt via één onbeschermde endpointaanroep of client-side.
28. Zet een privacy hold en probeer daarna te verwijderen. Geweigerd zolang de hold staat.
29. Controleer dat een lopende wettelijke bewaarplicht verwijdering niet stilzwijgend omzeilt.

## H. Anonimisering

30. Laat gebruiks- en fair-usedata ouder dan 24 maanden anonimiseren.
31. **Probeer actief te herleiden** wie het was, via combinaties van velden en via vrije tekst. Lukt dat, dan is de anonimisering ontoereikend.

## I. Jeugd en toestemming

32. Trek de oudertoestemming in bij de minderjarige. De jeugdtoegang past zich correct aan; er verdwijnt geen sportdata van het kind.

## J. Adminbevoegdheden

33. Probeer als beheerder **zonder** bevoegdheid: een refund, een verwijdering, `DECEASED` zetten, een privacy hold opheffen, een abonnement wijzigen. Alle vijf geweigerd.
34. Herhaal via directe API-aanroepen.
35. Voer als bevoegde beheerder één gevoelige actie uit. Het auditlog bevat wie, wanneer, actie, reden, oude en nieuwe waarde, lidnummer, bron en correlatie-ID.
36. Controleer dat er geen knop bestaat waarmee alle abonnees, logs of levenscyclusdata zonder dubbele bevestiging verdwijnen.

## K. Overlijden

37. Zet `DECEASED` als bevoegde beheerder, met verificatie. Facturatie stopt, **er wordt niets verwijderd**, en de status is omkeerbaar.

## L. Jobs

38. Draai elke nieuwe destructieve job. Hij start in **dry-run** en wijzigt niets.
39. Laat één job daarna echt lopen op een goedgekeurde selectie. Uitsluitend die selectie is verwerkt.

## M. AI-helpdesk

40. Probeer via de AI-helpdesk een refund, een verwijdering of een statuswijziging definitief te laten uitvoeren. **Niet mogelijk** — AI triëert en bereidt voor, een bevoegde workflow of beheerder beslist.

## N. Consistentie en regressie

41. Desktop en mobiel tonen dezelfde levenscyclusstatus.
42. Directe API-aanroepen dwingen dezelfde rechten af als de interface.
43. Geen mock-, seed-, demo- of fallbackdata als echte abonneedata.
44. De Mirror-bewezen onderdelen uit `ROUTE_PAKKET_01` en de flows uit `ABONNEMENT_01` zijn onveranderd.

---

## Afkeuringsgronden

- twee accounts met hetzelfde lidnummer, of een nummer dat verandert;
- toegang tot enig gegeven op basis van alleen een lidnummer;
- opzeggen dat een account verwijdert of dat suggereert;
- een betaalincident dat gebruikersdata verwijdert;
- een status zonder gedefinieerde rechten, of rechten die afwijken van de vertaaltabel;
- stilzwijgend één bron laten winnen bij een conflict;
- verwijdering zonder dry-run, zonder bevestiging, of via één onbeschermde aanroep;
- anonimisering die herleidbaar blijkt;
- een gevoelige actie zonder bevoegdheid, zonder audit, of definitief uitgevoerd door AI;
- een destructieve job die niet in dry-run start;
- volledige betaalkaartgegevens zichtbaar;
- een verwijderde rij in `admin_ops_log`.

## Rapportvorm

Per scenario: verwacht, werkelijk, oordeel. Begin met de vier vaststellingen vooraf en de gebruikte accounts. Voeg toe: het resultaat van de gelijktijdige-registratietest, de dry-runuitvoer van de accountverwijdering, en je herleidingspoging na anonimisering. Noem expliciet wat je niet hebt kunnen toetsen en waarom.

Eindoordeel: **goedgekeurd** of **afgekeurd met concrete blokkade**.

## Uitzonderingslijst voor herstel

Raakt een herstelactie de lidnummeruitgifte, de statusmachine en haar vertaaltabel, de verwijder- en anonimiseerlaag, of `admin_ops_log` en de bevoegdhedencontrole, dan blijft de fout niet lokaal en wordt deze toets **volledig** hernomen. Alle andere herstelacties worden hertoetst op de betrokken rubriek plus rubriek N.
