# DOCUMENTEN_COMMUNICATIE_01 — UPLOADEN, GENEREREN, DELEN EN MAILEN

## 0. Uitvoeringsregel (geldig vanaf 1 augustus 2026)

> Zodra René een volledige bouwopdracht aan Replit geeft, is de volledige daarin beschreven bouw-, test-, herstel-, migratie-, deployment-, productie- en rollbackstraat vrijgegeven. Replit voert alle fasen zelfstandig achter elkaar uit.
>
> Replit rapporteert per fase, maar wacht niet op antwoord. Rapporteren is geen wachtmoment.
>
> Mirror toetst parallel en vormt geen algemene wachtpoort. Mirror geeft geen menselijke bouwvrijgave, blokkeert geen onafhankelijke fasen en vraagt geen nieuwe toestemming voor reeds goedgekeurde scope. Ontbrekend bewijs is een herstelpunt, geen bouwstop.
>
> Productiepublicatie is een automatische poort met technische voorwaarden, geen menselijke goedkeuring: build groen · typecheck groen · verplichte tests groen · migraties gevalideerd · rollback beschikbaar · geen actieve harde stop.
>
> Alleen een aantoonbaar kritisch technisch, data-, privacy-, consent- of veiligheidsprobleem mag het direct afhankelijke onderdeel tijdelijk stoppen. Onafhankelijke bouw loopt door.
>
> Fasevolgorde binnen dit document is een technische afhankelijkheid, geen vrijgavepoort. "Eerst X, dan Y" betekent: Y heeft het resultaat van X nodig — niet: Y wacht op toestemming.
>
> Deze regel geldt binnen een gegeven opdracht. Een volgende opdracht in een reeks start niet vanzelf.
>
> (Bron: `SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01`, besluit René 01-08-2026, geregistreerd als `GOV-B1`.)


**Uitvoerder:** Replit
**Type:** breed domeinpakket
**Startcommit:** actuele `main`; bevestig de SHA in je eindrapport
**Status:** voorbereid werk. **Wordt actief zodra René deze opdracht als bouwopdracht geeft — de opdracht zelf is de vrijgave (zie §0); daarna loopt de volledige straat zelfstandig door.**
**Botst niet met:** de routeketen. Raakt wél `route_course_points` — zie afhankelijkheden.

## Doel

De bestaande flows voor uploaden, uitlezen, genereren, exporteren, delen en mailen zijn compleet en betrouwbaar, met echte gebruikersdata en eerlijke foutafhandeling.

## Scope

Bestanden en foto's uploaden · PDF uploaden · technische gids · documentanalyse · PDF genereren · rapporten · trainingsplannen · route- en wedstrijdexports · e-mailen · delen · downloaden · printen · notificaties · trainer-, club-, ouder- en sportercommunicatie.

## Buiten scope

Nieuwe marketingmailcampagnes · nieuw CRM · nieuwe facturatiemodule · nieuwe algemene documentarchitectuur · app-brede herbouw · OCR of vision anders dan waar dat al besloten en gebouwd is.

---

## 0. Bestaande bouwstenen — hergebruiken

| Bestaand | Vindplaats | Draagt al |
|---|---|---|
| Upload en ophalen | `routes/storage.ts` (POST L41, GET L99) | het opslagpad — dun, uit te breiden |
| Documentanalyse | `routes/document-analysis.ts` | lijst, detail, aanmaken, antwoorden |
| Technische gids → wedstrijd | `routes/document-analysis.ts` L257 `POST /:id/link`, gepoort achter `route_course_points` | de koppeling bestaat al **en is Compleet-gepoort** |
| `document_analyses` | `lib/db/src/schema/document-analyses.ts` | analyses per gebruiker |
| Notificaties | `routes/notifications.ts`, `schema/notifications.ts` | verzendkanaal en leesstatus |
| Delen van routes | `schema/route-shares.ts`, `routes/share.ts` | deelrechten |
| E-mail | `lib/email.ts` | het mailkanaal |
| Wedstrijdexport | `test:race-export` | bestaande exportlogica |
| Tests | `test:email-channel`, `test:notifications`, `test:notifications-read-batch`, `test:race-export`, `test:share-honesty`, `test:social-privacy` | vertrekpunt |

**De koppeling technische gids ↔ wedstrijd blijft achter `route_course_points`.** Die poort is Mirror-bewezen in `ROUTE_PAKKET_01` en mag niet worden versoepeld of omzeild.

---

## 1. Exacte herstelpunten

### 1.1 Uploadstatus en fouten

Vandaag is de uploadlaag dun. Bouw:

- zichtbare voortgang tijdens upload;
- expliciete bestandstype- en groottelimieten, **server-side afgedwongen**, met een begrijpelijke melding bij overschrijding;
- onderscheid tussen: te groot · verkeerd type · netwerkfout · serverfout · geweigerd wegens rechten;
- een mislukte upload laat geen half bestand achter.

### 1.2 Veiligheidscontrole

Voer een veiligheidscontrole uit **waar de bestaande infrastructuur dat ondersteunt**. Bestaat die ondersteuning niet: dat is een bevinding met een voorstel, geen eigen implementatie van een virusscanner. Meld wat er wel en niet kan.

### 1.3 PDF genereren — het enige werkelijk nieuwe onderdeel

**Er is vandaag geen PDF-generatie in de repository.** Geen `pdfkit`, geen `puppeteer`, geen `PDFDocument`, geen `jspdf`. Dit is dus geen reparatie maar nieuwe bouw, en daarmee het grootste risico op scope-uitloop in dit pakket.

Afbakening:

- **precies twee** documenttypen in deze opdracht: een trainingsplan en een wedstrijd- of routedossier;
- uitsluitend echte gebruikersdata, met dezelfde herkomstregels als `DATA_TRUST_01`. Ontbreekt data: die staat niet in het document, met een eerlijke regel in plaats van een leeg vak;
- geen sjabloonontwerpsysteem, geen huisstijlbouwer, geen instelbare rapporten;
- bibliotheekkeuze en de reden ervoor horen in het eindrapport;
- geen PDF die persoonlijke gegevens bevat van iemand anders dan de eigenaar of een rechthebbende.

Blijkt dit onhaalbaar binnen de opdracht: lever de rest op en meld PDF-generatie als restpunt. **Dat is geen stopconditie.**

### 1.4 Bestandsnamen en downloads

Geldige, veilige bestandsnamen — geen padtekens, geen persoonsgegevens die er niet in horen, geen botsingen. Een download levert het juiste bestand aan de juiste gebruiker, of een weigering.

### 1.5 E-mail

- verzendstatus zichtbaar: verzonden · mislukt · in de wachtrij;
- een mislukte verzending toont een echte foutmelding, geen stille stilte;
- bijlagen worden meegestuurd of de verzending faalt zichtbaar — nooit een mail zonder de beloofde bijlage;
- geen mail naar een adres dat niet van de ontvanger is.

### 1.6 Delen met de juiste rechten

Delen respecteert de bestaande rol- en toestemmingsregels. Een gedeeld item is bereikbaar voor precies de bedoelde ontvanger en voor niemand anders — ook niet via een geraden of hergebruikte link. Hergebruik `route_shares` en de bestaande privacyregels; bouw geen tweede deelmechanisme.

### 1.7 Geen stille fallback

Geen enkele upload-, generatie-, verzend- of deelflow valt terug op voorbeeldinhoud. Mislukt het, dan zegt het scherm dat het mislukt is.

### 1.8 Auditlog

Verzenden, delen en genereren worden vastgelegd: wie, wat, wanneer, voor wie. Hergebruik de bestaande auditvoorziening waar die bestaat; is er geen: additief toevoegen, niet een breed nieuw logsysteem.

### 1.9 API en UI

Elke rechtencontrole in deze flows geldt ook bij directe aanroep. Bewijs dat per flow.

---

## Migratierisico's

| Risico | Beheersing |
|---|---|
| Nieuwe groottelimiet weigert bestaande bestanden | limiet alleen op nieuwe uploads; bestaande bestanden blijven bereikbaar |
| Hernoemen van bestanden breekt bestaande verwijzingen | geen bestaande bestandsnamen wijzigen; regel geldt vooruit |
| Nieuwe deelrechten trekken bestaande gedeelde items in | bestaande deelrelaties blijven; strengere regel alleen op nieuwe |
| PDF-bibliotheek brengt een zware afhankelijkheid mee | keuze motiveren, bouwtijd en pakketgrootte melden |

## Tests

1. Upload met voortgang; een geslaagde upload is daarna ophaalbaar.
2. Te groot bestand: geweigerd met begrijpelijke melding, geen half bestand.
3. Verkeerd bestandstype: geweigerd.
4. Netwerkfout tijdens upload: eerlijke fout, geen voorbeeldinhoud.
5. Veiligheidscontrole draait waar ondersteund, of is expliciet gemeld als niet beschikbaar.
6. PDF-trainingsplan bevat uitsluitend echte gegevens van de eigenaar.
7. PDF met ontbrekende data toont een eerlijke regel, geen leeg vak of nul.
8. Wedstrijd- en route-export leveren een geldig bestand met de juiste naam.
9. Download levert het juiste bestand aan de eigenaar en weigert bij een ander.
10. Mail met bijlage: bijlage komt mee, status is zichtbaar.
11. Mislukte mail toont een echte foutmelding.
12. Delen respecteert rollen: trainer, ouder, club en sporter zien alleen wat mag.
13. Een gedeelde link is niet bereikbaar voor een niet-rechthebbende.
14. Technische gids koppelen aan een wedstrijd blijft achter `route_course_points`; Gratis en Go krijgen 403 met de juiste pakketnaam.
15. Auditlog registreert verzenden, delen en genereren, met wie en voor wie.
16. Directe API-aanroep geeft dezelfde weigering als de interface.
17. Geen enkele flow valt terug op voorbeeldinhoud.
18. Desktop en mobiel gedragen zich gelijk.

## Acceptatiecriteria

1. Elke upload-, generatie-, verzend- en deelflow heeft een zichtbare toestand en een eerlijke fout.
2. Limieten worden server-side afgedwongen.
3. Gegenereerde documenten bevatten uitsluitend echte data van de rechthebbende.
4. Delen en mailen lekken niets tussen gebruikers of rollen.
5. De `route_course_points`-poort is ongewijzigd.
6. Auditlog is compleet voor verzenden, delen en genereren.
7. Geen stille fallback naar voorbeeldinhoud.
8. Bestaande bestanden, deelrelaties en verwijzingen blijven werken.
9. Alle tests groen, typecheck exit 0.
10. Geen nieuwe documentarchitectuur; bestaande tabellen en services hergebruikt.

## Bewijsformat

Per regel: commando, resultaat, exitcode. Verder: de gekozen PDF-bibliotheek met motivatie · de server-side limieten per bestandstype · een gegenereerde PDF van elk van de twee typen, met daarnaast het API-antwoord waaruit dezelfde gegevens komen · de auditlogregels van één verzending, één deling en één generatie · schermafbeeldingen van elke fouttoestand, desktop en mobiel · start- en eindcommit · gewijzigde bestanden.

## Stopcondities

- de bestaande opslaglaag kan geen betrouwbare voortgang of foutstatus leveren zonder herschrijving;
- een veiligheidscontrole vereist infrastructuur die er niet is — melden, niet zelf bouwen;
- PDF-generatie vereist een afhankelijkheid die de bouw of de omvang onaanvaardbaar maakt — melden als restpunt, doorgaan met de rest;
- delen vereist een wijziging in het rechtenmodel;
- een bestaande test wordt onhoudbaar.

## Afhankelijkheden

| Nodig | Bron | Blokkerend? |
|---|---|---|
| `route_course_points`-poort werkend | `ROUTE_PAKKET_01`, MIRROR_PROVEN | ja |
| Rol- en toestemmingsmodel ongewijzigd | bestaand | ja |
| Herkomstregels voor gegenereerde documenten | `DATA_TRUST_01` | **sterk aanbevolen vóóraf** — anders komt er onherleidbare data in een PDF die de gebruiker bewaart en deelt |
| Routegebruikstelling | `02a`/`02b` | nee |

## Herstelprotocol

Bij afkeuring: alleen de benoemde blokkade herstellen, op een nieuwe commit vanaf de afgekeurde commit. Geen refactor, geen scope-uitbreiding. Oorzaak onbekend: melden, niet gokken.

Hertesten: het afgekeurde scenario, alles wat dezelfde code raakt, plus `test:email-channel`, `test:notifications`, `test:share-honesty`, `test:social-privacy` en typecheck.

**Uitzonderingslijst — hier blijft een fout niet lokaal:** de opslag- en uploadlaag · het deel- en rechtenmechanisme · het mailkanaal · de `route_course_points`-poort. Raakt de fix een van deze vier, dan wordt het hele pakket hertoetst.

Na twee herstelronden op dezelfde blokkade: naar René.

## Documentatie

`docs/SPARKI_DOCUMENTEN_EN_COMMUNICATIE.md` — limieten, fouttoestanden, deelrechten en de twee PDF-typen.
