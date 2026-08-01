# SPARKI — MEDIA EN UITLEG: PRODUCTBESLUIT v1.0

**Technische code:** `MOBILE_MEDIA_COMPONENTS_01` → voorwaarden voor bouwpakket `MEDIA_UITLEG_01`
**Datum:** 1 augustus 2026
**Status:** vastgelegd wat René heeft besloten; open punten expliciet als open gemarkeerd. Dit document neemt zelf geen nieuwe productbesluiten.

---

## 1. Doel

Sparki krijgt een weergavelaag voor subtiele diepte, korte bewegende uitleg, oefendemonstraties en rustige coachmeldingen. Doel: uitleggen en laten zien wat met tekst alleen te traag of te vaag blijft — zonder de app onrustig te maken en zonder dat iemand afhankelijk wordt van beeld, geluid of bandbreedte.

**Wat dit niet is.** Geen visuele herbouw, geen 3D-avatar, geen animatiefilter over de hele app. Beweging is versiering; de app moet met alle animatie uit precies hetzelfde kunnen.

---

## 2. Grens met `KENNIS_01`

Definitief vastgelegd. Er komt geen tweede contentarchitectuur.

| `MEDIA_UITLEG_01` beheert | `KENNIS_01` beheert |
|---|---|
| weergavelaag | inhoud |
| speler | lessen |
| dieptecomponent | oefeningen |
| uitlegflow | bronvermelding |
| voortgang | maker |
| bekeken/overgeslagen-status | licentie |
| toegankelijkheid | inhoudelijke controle |
| lazy loading | leeftijdsgeschiktheid |
| mediafoutafhandeling | versies en publicatiestatus |

**Gevolg voor de bouw:** de weergavelaag toont alleen wat `KENNIS_01` als gepubliceerd en vrijgegeven aanlevert. Is de herkomst onbekend, dan verschijnt er niets (PAT-36).

---

## 3. Pakketgrens

Vastgelegd als **verwijzing**. Dit document bouwt geen entitlements en wijzigt geen bestaande pakketindeling.

**Altijd gratis — uitleg over het product zelf.** Hoe Sparki werkt · onboarding · routeplanner · GPX · navigatie · instellingen · abonnementen begrijpen · toegankelijkheid en veiligheid.

**Sparki Compleet — inhoudelijke sportkennis.** FTP · trainingszones · herstel · intervaltraining · klimmen · voeding · wedstrijdvoorbereiding · kracht en mobiliteit.

**De redenering achter de grens:** begrijpen hoe je Sparki bedient, is geen betaalde functie — dat is de voorwaarde om het product überhaupt te kunnen gebruiken. Begrijpen hoe je beter traint, is wél waar Compleet voor betaald wordt. Uitleg over een functie die je niet hebt, verkoopt niets en verwart alleen; die verschijnt dus niet.

---

## 4. Veiligheid

1. **Geen blessurerevalidatie zonder bevoegde begeleiding.** Oefenmateriaal is instructie, geen behandeling.
2. **Stopregel bij pijn** is permanent zichtbaar bij elke oefening en niet weg te klikken.
3. **Geen speelse animatie of diepte** bij een acute of medische waarschuwing.
4. **Acute meldingen zijn nooit permanent onderdrukbaar** en sluiten pas nadat de inhoud is gelezen; de passende verantwoordelijke blijft geïnformeerd.
5. **Geen media tijdens een actieve taak**: navigatie, training, wedstrijddagmodus, onboarding, formulier of acute flow.
6. **Coachadvies komt uit echte gebruikersgegevens.** Advies op basis van mock- of verzonnen data wordt niet getoond — een directe afkeurgrond.

---

## 5. Minderjarigen

Bovenop de bestaande grens (geen gewichts- of calorieadvies aan minderjarigen):

1. Geen gewichtsdoelen.
2. Geen 1RM-doelen.
3. Geen zware belastingvoorschriften.
4. Geen individuele voedingsvideo zonder passende bron en inhoudelijke controle via `KENNIS_01` — dit raakt met name de soigneurrol.
5. **"Niet meer tonen" bestaat niet voor een minderjarige.** Ook een niet-acute melding blijft terugkomen tot hij is beantwoord.
6. Een acute melding is voor een minderjarige niet negeerbaar.
7. Leeftijdsclassificatie is een eigenschap van de inhoud in `KENNIS_01`, niet een instelling in de weergavelaag.

---

## 6. Toegankelijkheid als voorwaarde, niet als extra

- Alles blijft volledig bruikbaar met animatie uit (PAT-39).
- De systeeminstelling "verminder beweging" wordt gerespecteerd (PAT-33).
- Elke video heeft ondertiteling en een **gelijkwaardige** tekstvariant — geen samenvatting (PAT-30).
- Zonder geluid is elke uitleg volledig te volgen.
- Elke spelerknop is uitspreekbaar voor een schermlezer.
- Geen autoplay, in welke situatie dan ook.

---

## 7. Voorwaarden voor bouwpakket `MEDIA_UITLEG_01`

Het bouwpakket mag pas starten wanneer aan alle zeven is voldaan.

1. **Vijf componenten liggen vast** in de componentbibliotheek: CMP-40 t/m CMP-44. Geen zesde component wordt in het bouwpakket bedacht.
2. **Twaalf patronen liggen vast**: PAT-28 t/m PAT-39, elk met een Mirror-verwijzing.
3. **`KENNIS_01` levert het contentmodel** met bron, maker, licentie, leeftijdsgeschiktheid, versie en publicatiestatus. Zonder dat model is er geen media om te tonen en start het bouwpakket niet.
4. **Geen media wordt in dit pakket geproduceerd.** Het pakket bouwt de weergavelaag; de pilotinhoud is een aparte opdracht.
5. **De pilotomvang is klein**: één diepte-kaart, één zwevende coachmelding, één bewegende uitleg, twee oefendemonstraties, de pagina Uitleg en Academy, en de instelling voor minder beweging.
6. **Bewijslast bij oplevering**: aantonen dat alles zonder animatie identiek bruikbaar blijft (MTS-52), en dat geen enkele functie beweging nodig heeft om te bestaan.
7. **Mirror toetst volgens MTS-50 t/m MTS-69**, inclusief de zeven directe afkeurgronden.

---

## 8. Open afhankelijkheden

Geen van deze punten wordt hier beslist.

1. **Contentbron en rechten.** Er is nog geen vastgestelde bron voor oefen- en uitlegmedia. Zolang die er niet is, kan de weergavelaag gebouwd worden maar is er niets vrijgegeven om te tonen. Media zonder aantoonbare rechten verschijnt niet.
2. **Wie doet de inhoudelijke controle** op oefeningen en op leeftijdsgeschiktheid — en met welke bevoegdheid. Hoort bij `KENNIS_01`.
3. **De pilotset oefeningen** (circa zes) is als idee vastgelegd maar nog niet als inhoudsopdracht.
4. **Merkafhankelijkheid.** Kleur, typografie, iconografie en de vormtaal van de diepte komen uit `BRAND_IDENTITY_01`, dat nog wacht op het definitieve beeldmerk. De componenten zijn beschreven in gedrag en zijn daardoor niet geblokkeerd; de definitieve vormgeving wel.
5. **Toestemmingsvraag bij mobiele data.** Het mechanisme ligt vast (geen download zonder toestemming); waar die toestemming wordt gevraagd en of hij per keer of per apparaat geldt, is nog open.
~~6. Uitleg en Academy als omgeving.~~ **Beslist door René op 1 augustus 2026** (zie besluitregister, tijdelijk besluit MUX-B5): Uitleg en Academy wordt **geen** zesde hoofdnavigatie-item — de vijf vaste hoofditems blijven intact (MUX-14). De omgeving krijgt zijn definitieve plaats onder **Hulp & ondersteuning → Uitleg en Academy**, met daarbinnen twee delen:
   - **Sparki gebruiken** (gratis): productuitleg, onboarding, routeplanner, GPX, navigatie, training, analyses, instellingen, abonnementen, veiligheid, toegankelijkheid.
   - **Beter fietsen en trainen** (Sparki Compleet): FTP, zones, herstel, intervaltraining, klimmen, dalen, voeding, wedstrijdvoorbereiding, kracht, mobiliteit.

   Er komt geen nieuwe navigatiearchitectuur; de toegangsgrens gratis/Compleet komt uitsluitend uit de centrale entitlementlaag, nooit uit de weergavelaag zelf.

---

## 9. Gewijzigde en nieuwe documenten

| Document | Wijziging |
|---|---|
| `SPARKI_MOBILE_COMPONENT_LIBRARY.md` | nieuw hoofdstuk 9 met CMP-40 t/m CMP-44; acht regels toegevoegd aan de verbodenlijst; register uitgebreid |
| `SPARKI_MOBILE_PATTERNS.md` | nieuw hoofdstuk 8 met PAT-28 t/m PAT-39; register uitgebreid |
| `SPARKI_ROLE_BASED_MOBILE_FLOWS.md` | v1.2 — nieuw hoofdstuk 4 met media-aanvullingen per rol, inclusief de grens per rol |
| `SPARKI_MIRROR_MOBILE_TESTSTANDARD.md` | nieuw hoofdstuk 10 met MTS-50 t/m MTS-69, waarvan MTS-69 zeven directe afkeurgronden |
| `SPARKI_MEDIA_UITLEG_PRODUCTBESLUIT.md` | nieuw (dit document) |

**Niet gewijzigd, bewust:** `SPARKI_MOBILE_UX_STANDARD_v1.4.md`. Er zijn geen nieuwe MUX-regels nodig — alle mediacomponenten en -patronen zijn te herleiden tot bestaande regels, met name MUX-90, MUX-91, MUX-51, MUX-48 en het toegankelijkheidshoofdstuk.

---

*Einde `SPARKI_MEDIA_UITLEG_PRODUCTBESLUIT.md`.*
