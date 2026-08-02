# F11 — Centrale bestands- en medialaag

**Pakket:** SPARKI_BUILD_01  
**Fase:** F11 — Centrale bestands- en medialaag  
**Status:** Uitgewerkt als 2e AI-bouwopdracht  
**Datum:** 2 augustus 2026

---

## Doel

Eén centrale bestands- en medialaag voor het hele platform.  
Alle uploads (inclusief de bijlagen uit F7) lopen hierover. Geen aparte uploadoplossing per module.

---

## Eindtoestand die bereikt moet zijn

### 1. Basisfunctionaliteit
- Uploaden van bestanden
- Preview
- Download
- Versiebeheer
- Vervangen van een bestand **zonder historieverlies** (oude versie blijft bewaard)
- Intrekken van een bestand (niet meer downloadbaar)

### 2. Veiligheid & controle
- Virusscan (of equivalent veiligheidsbeleid) vóór beschikbaarstelling
- Bestandstypecontrole
- Groottebeperking
- Veilige bestandsnaam (geen path-traversal, geen gevaarlijke tekens)
- Duplicaatherkenning op checksum

### 3. Rechten & retentie
- Rechtenafdwinging (alleen bevoegden kunnen zien/downloaden)
- Retentiecategorie per bestand (of overgenomen van het gekoppelde object)

### 4. Toegankelijkheid
- Schermlezertekst (alt-tekst / aria-labels waar relevant)

### 5. Integratie
- F7 (Communicatie met bijlagen) wordt op deze centrale laag omgezet.
- Geen module mag nog een eigen uploadoplossing hebben.

---

## Niet bouwen

- Een uploadoplossing per module.
- Een tweede mediabibliotheek.
- Complexe media-bewerking (bijsnijden, filters, etc.) — dat hoort niet in deze fase.

---

## Acceptatiecriteria / tests

- Bestand kan geüpload, bekeken (preview) en gedownload worden door bevoegde gebruiker.
- Vervangen van een bestand behoudt de oude versie in de historie.
- Ingetrokken bestand is niet meer downloadbaar (ook niet via oude link).
- Geweigerd bestandstype of te groot bestand wordt duidelijk afgewezen.
- Duplicaat op checksum wordt herkend.
- Onbevoegde gebruiker kan het bestand niet zien of downloaden.
- Bestandsnaam is veilig opgeslagen.
- Schermlezertekst is aanwezig waar nodig.
- F7-bijlagen gebruiken deze centrale laag.

---

## Instructie aan Replit

Meet eerst de huidige staat van bestandsopslag, media, uploads en eventuele bestaande mediainfrastructuur.  
Bouw of herstel alleen wat bovenstaande eindtoestand nog niet dekt.  
Zorg dat bestaande bijlagen (F7) en eventuele andere uploads naar deze centrale laag worden omgezet of al correct aansluiten.  
Lever daarna de bewijsbundel voor deze fase.
