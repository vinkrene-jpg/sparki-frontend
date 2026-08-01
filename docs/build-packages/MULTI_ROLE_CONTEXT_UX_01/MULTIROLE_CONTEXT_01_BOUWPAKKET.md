# MULTIROLE_CONTEXT_01 — Bouwpakket (5-delig)

**Technische code:** `MULTIROLE_CONTEXT_01`
**Datum:** 1 augustus 2026 · **Status:** `OPEN` — **niet vrijgegeven**
**Doelmap:** `docs/build-packages/<nummer>_MULTIROLE_CONTEXT_01/` — nummering door ChatGPT
**Regelcodes:** `MRC-01..`
**Mobiele UX conform `MOBILE_UX_STANDARD_01` (v1.4).**

---

# DEEL 0 — KADER

| Code | Regel |
|---|---|
| MRC-01 | Dit pakket bouwt **geen nieuwe functies**. Het maakt bestaande rollen, schermen en componenten bruikbaar voor gebruikers met meerdere rollen. |
| MRC-02 | `CLUB_RECHTEN_01` blijft eigenaar van rollen, rechten, scopes en autorisatie. Dit pakket bouwt **geen tweede rechtenarchitectuur**. |
| MRC-03 | Geen rolomgeving vóór de rolwaarde server-side bestaat. |
| MRC-04 | Elke contextwissel is **server-side gevalideerd** en atomair. |
| MRC-05 | Fail-closed: twijfel leidt tot de beperktere toestand. |
| MRC-06 | Geen enkel gegeven uit een vorige context blijft zichtbaar of bereikbaar. |
| MRC-07 | Eén fase tegelijk vrijgegeven, elk met eigen bewijs op een vaste SHA en een Mirror-poort ertussen. |
| MRC-08 | Nieuwe componenten worden **eerst** aan `SPARKI_MOBILE_COMPONENT_LIBRARY.md` toegevoegd, niet in dit pakket bedacht. |

**Genomen besluiten (1 augustus 2026):** `MR-B01 = C` vaste posities, aantal, volgorde en iconen gelijk voor alle rollen, alleen de **naam** per rol verschillend · `MR-B02 = C` een context per **server-side bestaande rolwaarde**, geen vaste lijst · `MR-B03 = A` `CMP-45`, `CMP-46` en `CMP-47` worden aan de componentbibliotheek toegevoegd vóór F3.

**Nog blokkerend:** `MR-B04` permanente zichtbaarheid van de actieve context (**blokkeert F3**) · `MR-B05` onafgemaakt werk bij een ingetrokken rol · `MR-B06` groepsoverstijgende trainercontext · `MR-B07` ouderoverzicht over meerdere kinderen (alle drie **blokkeren F1**).

---

# DEEL 1 — REPLIT-BOUWOPDRACHT PER FASE

## MRC-F0 — Inventarisatie · **geen code**

**Doel:** vaststellen wat er al is voordat er iets wordt bedacht.
**Voorwaarde:** geen — dit is de enige fase die nu kan starten.

**Onderzoek, met vindplaats per regel:** hoe de huidige sessie de rol bepaalt · of er al een impliciete "actieve rol" bestaat en waar · welke rolwaarden server-side bestaan en welke ontbreken · hoe rechten worden opgehaald en waar ze in de client landen · welke caches bestaan en of ze een contextsleutel kennen · welke schermen nu al rolafhankelijk zijn · hoe notificaties worden gerouteerd en of ze een rol meedragen · welke deep links bestaan · hoe offline gegevens worden opgeslagen · hoe de AI nu bepaalt over wie een vraag gaat · welke gebruikers in de huidige database feitelijk meerdere rollen hebben, en hoeveel contexten dat maximaal oplevert.

**Opleveringen:** `MULTIROLE_INVENTARISATIE.md` · `MULTIROLE_CONTEXTTELLING.md` (feitelijke verdeling van het aantal contexten per gebruiker, als basis voor `RSW-16` en `MR-B08`).
**Bewijs:** diff bevat uitsluitend documenten · elke bevestiging met vindplaats · elke ontkenning met de plaats waar is gezocht.

---

## MRC-F1 — Contextmodel server-side

**Voorwaarde:** F0 `MIRROR_PROVEN` + `MR-B05`, `MR-B06`, `MR-B07` beantwoord. (`MR-B01`, `MR-B02` en `MR-B03` zijn genomen.)

**Bouwen:** contextobject conform `SPARKI_CONTEXT_ARCHITECTURE.md` §1 · afleiding van beschikbare contexten uit rollen en relaties · actieve context per sessie en per apparaat · contexthistorie, laatst gebruikte context en favorieten · server-side wisselhandeling met validatie, atomariteit en vastlegging · weigering met reden.

**Niet bouwen:** geen interface, geen rolwisselaar, geen tweede rechtenmodel, geen wijziging in `CLUB_RECHTEN_01`.

**Bewijs:** een vervalste wissel naar een context zonder rechten wordt geweigerd, met reden en auditregel · een onderbroken wissel laat óf de oude óf de nieuwe context volledig actief · een ingetrokken rol verdwijnt uit de beschikbare contexten, ook als hij favoriet was · elke wissel en elke geweigerde wissel staat vastgelegd.

---

## MRC-F2 — Contextzuivere gegevenstoegang

**Voorwaarde:** F1 `MIRROR_PROVEN`.

**Bouwen:** contextsleutel op elke opvraging · server-side controle daarvan · verwerping van antwoorden die bij een andere context horen · contextgebonden cachesleutels · verwerping van de cache bij een wissel · contextgebonden opslag van offline gegevens · zoekbereik beperkt tot de actieve context.

**Niet bouwen:** geen interfacefiltering als vervanging van server-side controle.

**Bewijs:** een laat binnenkomend antwoord uit de vorige context wordt aantoonbaar verworpen · twee contexten delen geen cache-ingang · een zoekterm die alleen elders resultaat geeft levert niets en suggereert niets · een foutmelding verraadt geen bestaan of inhoud buiten de context.

---

## MRC-F3 — Contextweergave

**Voorwaarde:** F2 `MIRROR_PROVEN` + `CMP-45..47` opgenomen in de componentbibliotheek + `MR-B04` beantwoord.

**Bouwen:** contextregel mobiel · contextweergave en breadcrumb desktop · tabletgedrag als breedtekeuze · rechtenweergave binnen één handeling · voorleesbaarheid en aankondiging bij wissel.

**Niet bouwen:** nog geen wisselmogelijkheid — dit is uitsluitend tonen.

**Bewijs:** op twintig willekeurige schermen zijn rol en organisatie zichtbaar zonder handeling · de contextregel verkleint het bruikbare raakvlak van de navigatie niet · een gebruiker met één context ziet geen contextbalk die ruimte kost · echt mobiel bewijs op een fysiek toestel.

---

## MRC-F4 — Rolwisselaar

**Voorwaarde:** F3 `MIRROR_PROVEN`.

**Bouwen:** de rolwisselaar conform `SPARKI_ROLE_SWITCHER_STANDARD.md` — locatie, vorm, volgorde favorieten/laatst gebruikt/alles per organisatie, zoeken vanaf meer dan zeven contexten, één handeling wisselen, de drie bevestigingsgevallen, foutgedrag, offlinegedrag zonder wachtrij.

**Niet bouwen:** geen tweede ingang, geen automatische wissel, geen wachtrij.

**Bewijs:** wisselen tussen alle contexten in beide richtingen zonder opnieuw inloggen · open detailvensters gesloten na de wissel · onafgemaakt werk biedt drie keuzes en verliest niets stil · een mislukte wissel laat de gebruiker altijd in een geldige context · echt mobiel bewijs.

---

## MRC-F5 — Rolgestuurde navigatie en dashboard

**Voorwaarde:** F4 `MIRROR_PROVEN`.

**Bouwen:** vijf vaste posities met vaste iconen en volgorde en **rolgebonden namen** conform `MRU-18..24` · positie 1 conform `MUX-76a` · positie 5 altijd "Meer" · lege hoofditems die tonen waarom ze leeg zijn · rolintroductie bij eerste betreding (`MUX-100`) · lege rolomgeving.

**Bewijs:** maximaal vijf hoofditems op elk apparaat · de eerste prioriteit per rol klopt voor alle twaalf rollen · geen doodlopend scherm · geen fictieve personen in de rolintroductie.

---

## MRC-F6 — Notificaties en AI-context

**Voorwaarde:** F5 `MIRROR_PROVEN`.

**Bouwen:** contextvermelding op elke notificatie · contextvrije titel · openen in de juiste context met zichtbare bevestiging en met de bevestigingsstap bij onafgemaakt werk · AI die uitsluitend binnen de actieve context werkt, de context bij elk antwoord benoemt, zelf nooit wisselt en de wissel aanbiedt als handeling van de gebruiker.

**Bewijs:** dezelfde vraag levert in drie contexten drie contextzuivere antwoorden met contextvermelding · een melding uit een niet-actieve rol toont de rol en geen inhoud · aantikken wisselt zichtbaar · de AI onderbreekt niet tijdens navigatie, training, wedstrijd, onboarding of formulier.

---

## MRC-F7 — Bewijsbundel

**Voorwaarde:** F6 `MIRROR_PROVEN`.

**Opleveren:** vaste eind-SHA · volledige testuitvoer · rechtenbewijs met geweigerde pogingen · lekbewijs (de timingtoetsen uit `MMT-10`) · bewijs op telefoon, tablet, desktop en PWA · vastleggingsbewijs · bewijs dat geen tweede rechtenmodel bestaat.

---

# DEEL 2 — MIRROR-TOETSOPDRACHT

Volledig volgens `SPARKI_MIRROR_MULTIROLE_TESTSTANDARD.md` (`MMT-01..39`), met per fase:

| Fase | Kernscenario's | Directe afkeurgronden |
|---|---|---|
| F0 | Vijf bevestigde regels natrekken; drie ontkende zelf zoeken | Diff bevat code · vindplaats ontbreekt |
| F1 | MMT-07, 08, 09, 21, 38 | Wissel niet server-side · tussentoestand · ingetrokken rol blijft beschikbaar · wissel niet vastgelegd |
| F2 | MMT-10, 12, 13, 14 | Laat antwoord getoond · gedeelde cache · teller uit andere context · zoekresultaat over contexten heen |
| F3 | MMT-06, 30, 32, 33, 34d | Rol of organisatie niet zichtbaar · zichtbaarheid wijkt af van `MR-B04` · derde tabletontwerp · inhoud vorige context tijdens laden |
| F4 | MMT-07, 11, 18, 25, 31, 35 | Opnieuw inloggen · detailvenster blijft · stil dataverlies · wachtrij offline · component niet uit de bibliotheek |
| F5 | MMT-34, 34a, 34b, 34c, 37 | Meer dan vijf hoofditems · verschuivende posities of iconen · positie 5 hernoemd · verkeerde eerste prioriteit · rolomgeving zonder server-side rolwaarde |
| F6 | MMT-17, 19, 20 | AI gebruikt gegevens uit andere context · AI wisselt zelf · notificatie toont verboden inhoud |
| F7 | Herhaling van één scenario per eerdere fase op de eind-SHA | Een eerder bewezen scenario faalt opnieuw |

**Verplichte testopstelling:** `MMT-02` — vijf contexten, twee in dezelfde club, twee clubs, een ouder met twee kinderen. Zonder die opstelling is de toets niet uitvoerbaar; dat wordt gerapporteerd, niet omzeild.

---

# DEEL 3 — AFHANKELIJKHEDEN

| Fase | Verplicht `MIRROR_PROVEN` | Extra voorwaarde | Mag **niet** blokkeren |
|---|---|---|---|
| F0 | — | — | alle lopende Sparki-bouwpakketten · openstaande productbesluiten |
| F1 | F0 | MR-B05, MR-B06, MR-B07 | ontbrekende rolschermen · `MEDIA_UITLEG_01` · `KENNIS_01` |
| F2 | F1 | — | offline-uitbreidingen · bewaartermijnen |
| F3 | F2 | `CMP-45..47` in de bibliotheek · MR-B04 | merkbesluit (`BRAND_IDENTITY_01`) — merklocaties worden gereserveerd |
| F4 | F3 | — | rollen die nog geen eigen omgeving hebben |
| F5 | F4 | — | `MUX-76` in v1.4 · nog niet gebouwde rolomgevingen |
| F6 | F5 | — | AI-engine-uitbreidingen · `MEDIA_UITLEG_01` |
| F7 | F6 | — | alles buiten dit pakket |

**Harde koppeling naar buiten:** `CLUB_RECHTEN_01` moet de rollen en scopes leveren waarop de contextafleiding berust. Dit pakket wijzigt daar niets aan en wacht er niet op — het gebruikt wat er is en toont `Onbekend` waar een rolwaarde ontbreekt.

---

# DEEL 4 — HERSTELPROTOCOL

Grondregel: een fout in een fase blijft in die fase. Een eerder bewezen fase wordt niet heropend tenzij Mirror aantoont dat de oorzaak daar ligt.

1. Mirror levert per bevinding scenario · waarneming · verwachte uitkomst · ernst.
2. Replit herstelt uitsluitend blokkerende bevindingen, binnen dezelfde fase, zonder nieuwe scope.
3. Herbewijs is volledig, koud en warm.
4. Restpunten worden genummerd meegenomen en blokkeren de volgende fase niet, tenzij René dat besluit.
5. Na twee herstelrondes zonder goedkeuring stopt de reeks en gaat de fase terug naar `OPEN` met oorzaakanalyse.

**MRC-09:** een **contextlek** is nooit een restpunt. Het is per definitie blokkerend, ook wanneer het zelden optreedt.
**MRC-10:** blijkt een component te ontbreken, dan wordt hij aan de componentbibliotheek toegevoegd en pas daarna gebruikt — het pakket wacht, het improviseert niet.
**MRC-11:** blijkt de rechtenstructuur ontoereikend, dan is dat een bevinding op `CLUB_RECHTEN_01`, geen reden voor een uitzondering hier.

---

# DEEL 5 — SYNCHRONISATIEPATCH

**Het Master Plan wordt niet bijgewerkt.**

| Document | Wat erin komt |
|---|---|
| **Afbouwmatrix** | Nieuw domein `MULTIROLE_CONTEXT_01` met fasen F0..F7, elk met eigen status |
| **Dagkaart** | Regel per vrijgave, oplevering en Mirror-oordeel, met SHA |
| **Releasestatus** | Niet blokkerend voor de besloten pilot; **wel** blokkerend voor de betaalde publieke release zodra er gebruikers met meerdere rollen zijn |
| **Roadmap** | Reeks naast de lopende domeinpakketten; expliciete notitie dat F0 geen code oplevert |
| **Besluitregister** | Genomen: `MR-B01 = C` · `MR-B02 = C` · `MR-B03 = A`. Open: `MR-B04..B09`. Definitieve nummers pas ná het opschonen van de nummerreeks |
| **`SPARKI_MOBILE_COMPONENT_LIBRARY.md`** | `CMP-45` contextregel · `CMP-46` contextkiezerpaneel · `CMP-47` contextregelitem — **vóór** F3, met de contracten uit `SPARKI_ROLE_SWITCHER_STANDARD.md` §9 en de MUX-koppeling |
| **`SPARKI_MOBILE_UX_STANDARD_v1.4.md`** | **`MUX-14` wijzigen**: aantal, volgorde, plaats en icoon blijven gelijk voor alle rollen; de **naam** mag per rol verschillen. Nieuwe subregel `MUX-14a` met de vijf vaste posities en de regel dat positie 5 altijd "Meer" heet. Dit is de enige wijziging aan het kerndocument |
| **`SPARKI_ROLE_BASED_MOBILE_FLOWS.md`** | Verwijzing naar dit pakket voor het gedrag bij meerdere rollen; de roluitwerkingen zelf blijven ongewijzigd |
| **`SPARKI_MIRROR_MOBILE_TESTSTANDARD.md`** | Verwijzing naar `MMT-01..39` als aanvullende toets; `MTS-01..69` blijft ongewijzigd |
