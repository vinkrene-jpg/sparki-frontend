# SPARKI_MULTIROLE_OPEN_BESLUITEN

**Datum:** 1 augustus 2026 · Codes zijn tijdelijk (`MR-B01..B09`); definitieve nummers pas ná het opschonen van de besluitreeks.

**Let op — hernummering.** `MR-B04` is op verzoek van René toegekend aan het nieuwe besluit *Actieve context permanent zichtbaar*. De eerdere `MR-B04..B08` zijn daarom **doorgeschoven naar `MR-B05..B09`**. Er is geen code hergebruikt voor een ander onderwerp; de reeks was nog niet in het besluitregister opgenomen. Vertaaltabel: oud B04 → nieuw B05 · oud B05 → B06 · oud B06 → B07 · oud B07 → B08 · oud B08 → B09.

---

## Genomen besluiten — niet meer open

| Code | Besluit | Gevolg |
|---|---|---|
| **MR-B01 = C** | **Vaste posities, rolgebonden labels.** Aantal, volgorde, plaats en icoon van de hoofditems zijn gelijk voor alle rollen; alleen de **naam** mag per rol verschillen | `MUX-14` wordt gewijzigd: namen mogen voortaan verschillen. Nieuwe subregel `MUX-14a` met de vijf vaste posities. Positie 1 volgt `MUX-76a`, positie 5 heet altijd "Meer". De afwijkingen in de opdrachtvoorbeelden (Trainer op *Dashboard*, Ploegleider op *Vandaag*) vervallen |
| **MR-B02 = C** | **Een context per server-side bestaande rolwaarde**, en verder niets | Geen vaste lijst die kan verouderen. `teammanager` en `ploegleider` krijgen een context; `medic` niet (`INGETROKKEN`); `gast` alleen als die rolwaarde server-side bestaat — zo niet, dan is gast een toestand vóór er contexten zijn. Nieuwe rolwaarden krijgen vanzelf een context |
| **MR-B03 = A** | **`CMP-45` contextregel · `CMP-46` contextkiezerpaneel · `CMP-47` contextregelitem** worden aan `SPARKI_MOBILE_COMPONENT_LIBRARY.md` toegevoegd vóór `MRC-F3` | De bibliotheek blijft de enige bron voor componenten. Contracten ter opname staan in `SPARKI_ROLE_SWITCHER_STANDARD.md` §9. Zonder die opname start F3 niet |

---

## MR-B04 — Actieve context permanent zichtbaar *(blokkeert F3)*

De standaard zegt nu dat rol en organisatie **altijd kenbaar** zijn. Wat "altijd" precies betekent is nog niet vastgelegd, en dat verschil is op mobiel niet klein: een permanente contextregel kost een regel verticale ruimte op elk scherm, op elk moment.

- **A — Permanent op elk scherm, altijd.** Hoofdschermen, detailschermen, formulieren, wedstrijddagmodus. *Gevolg:* de vraag "wie ben ik nu" is nooit te stellen, want het antwoord staat er. Elk screenshot spreekt voor zich. Prijs: op een klein toestel raak je een regel kwijt aan iets dat de meeste gebruikers — die maar één rol hebben — nooit nodig hebben, en in wedstrijddagmodus concurreert hij met de grote knoppen uit `MUX-96`.
- **B — Permanent op hoofdschermen, verkort op detailschermen.** Volledig (rol · organisatie · bereik) op de vijf hoofditems, verkort (rol · organisatie) daarbuiten. *Gevolg:* de context is overal kenbaar en kost minder ruimte waar het scherm het hardst nodig is. Prijs: op een diep detailscherm staat er minder, dus bij het delen van een screenshot vanaf zo'n scherm ontbreekt het bereik.
- **C — Permanent, maar door de gebruiker inklapbaar.** Standaard uitgeklapt; wie hem inklapt houdt een smalle markering met alleen de rol. *Gevolg:* de gebruiker kiest zelf. Prijs: een ingeklapte balk is een gebruiker die zijn eigen waarschuwing heeft uitgezet, en juist bij een contextvergissing is dat de duurste toestand — dit botst met `MUX-93` (geen verrassingen).
- **D — Permanent alleen bij meer dan één context.** Wie één rol heeft ziet niets; wie meerdere heeft ziet hem altijd. *Gevolg:* geen enkele kostenpost voor de meerderheid, volledige zekerheid voor wie het nodig heeft. Prijs: het scherm ziet er voor twee gebruikers verschillend uit, wat uitleg en ondersteuning ingewikkelder maakt — en iemand die zijn tweede rol krijgt, ziet de indeling ineens veranderen.

**Wat er hoe dan ook geldt:** rol en organisatie zijn nooit verborgen, nooit alleen af te leiden uit de inhoud, en nooit uitsluitend met kleur aangeduid. `MRU-02a` legt vast dat alleen de **plaats en de permanentie** van dit besluit afhangen.

---

## Blokkerend vóór F1

### MR-B05 — Wat gebeurt er met onafgemaakt werk als een rol wordt ingetrokken?
Bij een **vrijwillige** wissel krijgt de gebruiker drie keuzes. Bij een **gedwongen** verlies van de context is er niemand om iets te vragen.

- **A — Concept bewaren binnen de organisatie**, zichtbaar voor wie daar rechten heeft. *Gevolg:* niets gaat verloren; maar iemands halve notitie wordt zichtbaar voor een ander.
- **B — Verwijderen, met melding achteraf.** *Gevolg:* schoon en voorspelbaar; werk kan verloren gaan.
- **C — Bewaren bij de gebruiker**, alleen voor hemzelf, zonder dat hij het nog kan indienen. *Gevolg:* geen verlies en geen lek, maar wel een concept dat nergens meer heen kan.

### MR-B06 — Heeft een trainer met meerdere groepen ook een groepsoverstijgende context?
- **A — Ja, naast de groepscontexten**, mits de rechten dat toestaan. *Gevolg:* praktisch voor wie de hele jeugdafdeling doet; wel een context waarin meer zichtbaar is.
- **B — Nee, alleen per groep.** *Gevolg:* strikter en eenvoudiger uit te leggen; wisselen wordt vaker nodig.
- **C — Alleen voor de hoofdtrainer.** *Gevolg:* volgt de bestaande rolscheiding.

### MR-B07 — Krijgt een ouder een overzicht over meerdere kinderen?
- **A — Nee, één context per kind.** *Gevolg:* zuiverste scheiding, past bij de bestaande jeugdregels; onhandig voor een ouder met drie kinderen bij dezelfde club.
- **B — Ja, met rechtencontrole per kind** en zonder gegevens van kinderen waar de rechten ontbreken. *Gevolg:* prettiger in gebruik, maar het is precies het soort scherm waar een lek onopgemerkt blijft.
- **C — Alleen een agendaoverzicht**, geen gezondheids- of prestatiegegevens. *Gevolg:* lost het praktische probleem op (wie moet wanneer waarheen) zonder het gevoelige deel te combineren.

---

## Niet blokkerend

### MR-B08 — Vanaf hoeveel contexten verschijnt het zoekveld?
Voorstel in de standaard is **meer dan zeven**. Dat getal is beredeneerd, niet gemeten. `MRC-F0` levert de feitelijke verdeling; daarna is dit met één cijfer te onderbouwen. **Aanbeveling: laten staan tot F0 het cijfer geeft.**

### MR-B09 — Blijft de rolwisselaar bereikbaar in wedstrijddagmodus?
De standaard zegt nu: bereikbaar, niet prominent, altijd met bevestiging.
- **A — Zo laten.** *Gevolg:* een ploegleider die tijdens de wedstrijd iets in een andere rol moet nakijken kan dat, met een drempel.
- **B — Volledig blokkeren tijdens wedstrijddagmodus.** *Gevolg:* geen enkele onbedoelde wissel op het slechtst denkbare moment; maar een dubbelrol (ploegleider én mechanieker, wat in de praktijk voorkomt) moet dan de modus verlaten.

**Let op:** dit besluit hangt samen met `MR-B04` optie A — als de contextregel ook in wedstrijddagmodus permanent in beeld staat, is de rolwisselaar daar per definitie bereikbaar via die regel.

---

## Wat expliciet géén besluit vraagt

- de vier vragen en de kenbaarheid van rol en organisatie — volgt uit de opdracht zelf;
- server-side validatie van elke wissel, atomariteit en fail-closed — volgt uit bestaand beleid;
- dat rechten uit `CLUB_RECHTEN_01` komen en er geen tweede model bijkomt — al vastgelegde pakketgrens;
- dat geen rolomgeving bestaat zonder server-side rolwaarde — volgt nu automatisch uit `MR-B02 = C`;
- de eerste mobiele prioriteit per rol — ligt vast in `MUX-76a` en is positie 1 in het navigatiemodel;
- de labels op positie 2 tot en met 4 — voorstel in `MRU-22`, definitief vast te stellen in `MRC-F1` samen met het rolflowdocument; dat is uitwerking, geen productbesluit;
- dat tablet geen derde ontwerp krijgt — volgt uit de bestaande apparaatdoctrine;
- dat de actieve context per apparaat en per tabblad geldt en favorieten wel synchroniseren — technisch bepaald, met argumentatie in de architectuur.
