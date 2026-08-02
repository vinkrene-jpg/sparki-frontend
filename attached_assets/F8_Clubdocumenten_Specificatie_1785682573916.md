# F8 — Clubdocumenten

**Pakket:** SPARKI_BUILD_01  
**Fase:** F8 — Clubdocumenten  
**Status:** Uitgewerkt als 2e AI-bouwopdracht  
**Datum:** 2 augustus 2026

---

## Doel

Clubs kunnen vaste documenten publiceren en beheren (gedragscode, huisregels, ouderafspraken, privacyinformatie, vertrouwenscontactpersoon, noodprocedures, clubinstructies).  
Zelfde opslag-, versie- en rechtenprincipes als de rest van het platform.

---

## Eindtoestand die bereikt moet zijn

### 1. Documenttypen
Ondersteunde documenten minimaal:
- Gedragscode
- Huisregels
- Ouderafspraken
- Privacyinformatie
- Vertrouwenscontactpersoon
- Noodprocedures
- Clubinstructies

(Exacte lijst mag uitbreidbaar zijn, maar bovenstaande moeten ondersteund worden.)

### 2. Opslag, versie en publicatie
- Documenten hebben versies.
- Publicatie is expliciet (concept → gepubliceerd).
- Bij versiewissel blijft de oude versie bewaard (geen stilzwijgend overschrijven).
- Zelfde opslag- en versieprincipes als elders in het platform.

### 3. Rechten & zichtbaarheid
- Alleen bevoegde rollen kunnen documenten aanmaken, wijzigen en publiceren.
- Zichtbaarheid is rol-afhankelijk (bijv. sommige documenten alleen voor trainers/bestuur, andere voor alle leden/ouders).
- Onbevoegden zien het document niet (ook niet via directe link/API).

### 4. Weergave
- Leden / ouders / trainers kunnen de voor hen relevante gepubliceerde documenten inzien.
- Duidelijke aanduiding van versie en publicatiedatum.

---

## Niet bouwen

- Een levende werkobjectlaag (opmerkingen, taken, real-time samenwerking op het document).  
  Dat hoort bij pakket 02 (`WORK_OBJECT_*`).
- Een generieke documentbibliotheek voor het hele platform (dat komt later). Dit is specifiek clubdocumenten.

---

## Acceptatiecriteria / tests

- Publicatie van een document werkt en is zichtbaar voor de juiste rollen.
- Versiewissel: oude versie blijft bewaard, nieuwe versie wordt de actieve.
- Rolzichtbaarheid: onbevoegde rol ziet het document niet.
- Bevoegde beheerder kan documenten beheren (aanmaken, wijzigen, publiceren).
- Geen toegang via directe API voor onbevoegden.

---

## Instructie aan Replit

Meet eerst de huidige staat van clubdocumenten, versiebeheer, publicatiestatus en rechten.  
(Er is inmiddels al iets van een contacten- en documentlaag in het schema aanwezig — controleer dit.)  
Bouw of herstel alleen wat bovenstaande eindtoestand nog niet dekt.  
Lever daarna de bewijsbundel voor deze fase.
