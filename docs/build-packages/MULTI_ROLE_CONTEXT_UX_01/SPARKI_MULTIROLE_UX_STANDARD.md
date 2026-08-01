# SPARKI_MULTIROLE_UX_STANDARD

**Technische code:** `MULTIROLE_CONTEXT_01` · **Regelcodes:** `MRU-01..`
**Datum:** 1 augustus 2026 · **Status:** `OPEN` — geen fase vrijgegeven
**Bindende bronnen:** `SPARKI_MOBILE_UX_STANDARD_v1.4.md` (`MUX-01..100`) · `SPARKI_MOBILE_COMPONENT_LIBRARY.md` (`CMP-00..44`) · `SPARKI_MOBILE_PATTERNS.md` (`PAT-01..39`) · `SPARKI_ROLE_BASED_MOBILE_FLOWS.md` v1.2 (`RB-01..18`) · `CLUB_RECHTEN_01` (rollen, rechten, scopes, autorisatie)

**Geen nieuwe functies.** Dit document beschrijft hoe bestaande rollen, schermen en componenten zich gedragen wanneer één gebruiker er meerdere tegelijk heeft.

---

## 1. Uitgangspunt

Eén gebruiker · één account · één login · meerdere rollen. **Er wordt nooit opnieuw ingelogd om van rol te wisselen.**

## 2. De vier vragen

**MRU-01:** op elk moment, op elk scherm, op elk apparaat moet de gebruiker zonder handeling kunnen zien:
1. **Wie ben ik nu?** — de actieve rol
2. **Voor wie werk ik nu?** — de actieve organisatie, en waar van toepassing het team of de sporter
3. **In welke omgeving zit ik nu?** — welk deel van Sparki
4. **Welke rechten horen daarbij?** — bereikbaar binnen één handeling, niet noodzakelijk permanent in beeld

**MRU-02:** vraag 1 en 2 zijn **altijd kenbaar**. Vraag 3 blijkt uit de navigatie. Vraag 4 is één tik weg. Nooit verborgen, nooit onduidelijk, nooit alleen af te leiden uit de inhoud van het scherm.

**MRU-02a — openstaand:** of "altijd kenbaar" betekent **permanent in beeld op elk scherm** dan wel permanent op hoofdschermen en verkort of inklapbaar daarbuiten, is `MR-B04` en is **blokkerend voor F3**. De rest van dit document is op beide uitkomsten van toepassing; alleen de plaats en de permanentie van de contextregel hangen ervan af.

## 3. Grondregels

| Code | Regel |
|---|---|
| MRU-03 | De actieve context is **één geheel**: rol + organisatie + (team/groep) + (sporter/kind). Losse onderdelen wisselen niet zelfstandig. |
| MRU-04 | Rechten volgen **altijd** uit `CLUB_RECHTEN_01`, server-side. De contextlaag toont rechten; zij kent ze niet toe en bouwt geen tweede rechtenarchitectuur. |
| MRU-05 | Geen rolomgeving wordt getoond vóór de rolwaarde **server-side bestaat**. Deze bestaande regel blijft onverkort gelden. |
| MRU-06 | Eigenaarschap is een **relatie**, geen rol (`owner` + `CLUB` → Clubeigenaar, `owner` + `TEAM` → Teameigenaar). De contextweergave toont die relatie naast de rol, niet in plaats daarvan. |
| MRU-07 | Een gebruiker met precies één context ziet **geen** rolwisselaar en geen contextbalk die ruimte kost — wel de rolvermelding waar die betekenis heeft. Eenvoud voor de meerderheid gaat vóór volledigheid voor de minderheid. |
| MRU-08 | Bij het voor het eerst betreden van een rol geldt `MUX-100`: rolintroductie met rol, context, mogelijkheden, wat ontbreekt en één eerste actie. Geen generiek welkom, geen fictieve personen. |
| MRU-09 | Een lege rolomgeving is eerlijk leeg (`PAT-08`, `MUX-100`) en toont wat er moet gebeuren om hem te vullen. |
| MRU-10 | De context verandert **nooit vanzelf**. Niet door een notificatie te tonen, niet door een zoekresultaat, niet door een AI-suggestie. Alleen door een expliciete handeling van de gebruiker of door het openen van een deep link, en dan zichtbaar. |
| MRU-11 | Alles wat de gebruiker in de ene context doet, is in een andere context **niet zichtbaar** tenzij het daar rechtmatig bij hoort. Zie `SPARKI_CONTEXT_SECURITY_STANDARD.md`. |

## 4. Zichtbaarheid per apparaat

### Mobiel
**MRU-12:** een **contextregel** bovenaan elk hoofdscherm: rol · organisatie · (team of sporter). Eén regel, afgekort van rechts naar links wanneer de ruimte ontbreekt — de **rol** wordt nooit afgekort weggelaten, de organisatienaam wel ingekort.
**MRU-13:** de contextregel is tikbaar en opent de rolwisselaar. Het gedrag op detailschermen en in wedstrijddagmodus (`MUX-96`) volgt uit `MR-B04`; tot dat besluit geldt als werkaanname: verkorte vorm (rol + organisatie) op detailschermen, niet prominent in wedstrijddagmodus.
**MRU-14:** de contextregel telt niet mee als navigatie-item en verandert niets aan `MUX-14` (namen, iconen, aantal en volgorde van hoofditems).

### Desktop
**MRU-15:** context staat permanent in de kop: rol · organisatie · team/sporter, plus de eigenaarsrelatie waar van toepassing. Daarnaast een **breadcrumb** die begint bij de organisatie, niet bij het scherm.
**MRU-16:** desktop mag de rechten van de actieve context uitklappen als lijst; mobiel niet — daar is het een apart scherm.

### Tablet
**MRU-17:** tablet volgt de **desktopindeling** zodra de breedte dat toelaat, met de mobiele contextregel als terugval. Er komt geen derde ontwerp: tablet is een breedtekeuze tussen twee bestaande ontwerpen, geen eigen apparaatdoctrine.

## 5. Tabbladen en navigatie — **vaste posities, rolgebonden labels** (`MR-B01 = C`)

**MRU-18 — het model.** Aantal, volgorde, plaats en icoon van de hoofditems liggen **vast en zijn gelijk voor alle rollen**. Alleen de **naam** van een item mag per rol verschillen, zodat de taal klopt bij het werk van die rol. Een rolwissel verandert daarmee nooit waar iets staat — alleen hoe het heet en wat erachter zit.

**MRU-19 — vijf vaste posities:**

| Positie | Vaste betekenis | Icoon | Naam |
|---|---|---|---|
| **1** | Startpunt van de rol — waar deze rol begint | vast | De eerste mobiele prioriteit uit `MUX-76a` |
| **2** | Hoofdonderwerp — waar de rol dagelijks mee werkt | vast | Rolgebonden |
| **3** | Uitvoeren — de handeling die de rol verricht | vast | Rolgebonden |
| **4** | Terugkijken en context — historie, overzicht, communicatie | vast | Rolgebonden |
| **5** | **Meer** | vast | **Vast: altijd "Meer"** |

**MRU-20:** positie 5 heet in **elke** rol "Meer" en wordt nooit hernoemd. Dat is het vaste ankerpunt: waar de gebruiker ook zit, het laatste item is voorspelbaar. De opdrachtvoorbeelden noemden voor clubbeheer *Beheer* op positie 5; dat wordt "Meer", met beheer als eerste onderdeel daarbinnen.

**MRU-21:** positie 1 volgt **onverkort** `MUX-76a` en verandert hier niet: Sporter → Vandaag · Trainer → Trainingen · Hoofdtrainer → Groepen · Clubbeheerder → Organisatie · Teammanager → Teams · Ploegleider → Wedstrijddag · Mechanieker → Materiaal · Soigneur → Voeding · Medical Staff → Gezondheid · Ouder → Kind · Admin → Systeemstatus. De afwijkingen in de opdrachtvoorbeelden (Trainer op *Dashboard*, Ploegleider op *Vandaag*) vervallen daarmee.

**MRU-22 — labelvoorstel per rol.** Onderstaande namen voor positie 2 tot en met 4 zijn een **VOORSTEL** en worden definitief vastgesteld in `MRC-F1`, samen met `SPARKI_ROLE_BASED_MOBILE_FLOWS.md`. Zij zijn afgeleid van bestaande schermen; er wordt hier geen functie bedacht.

| Rol | 1 Startpunt | 2 Hoofdonderwerp | 3 Uitvoeren | 4 Terugkijken | 5 |
|---|---|---|---|---|---|
| Sporter | Vandaag | Plan | Rijden | Activiteiten | Meer |
| Trainer | Trainingen | Sporters | Planning | Communicatie | Meer |
| Hoofdtrainer | Groepen | Trainers | Planning | Communicatie | Meer |
| Clubbeheerder | Organisatie | Leden | Teams | Planning | Meer |
| Teammanager | Teams | Renners | Planning | Communicatie | Meer |
| Ploegleider | Wedstrijddag | Wedstrijd | Renners | Voertuigen | Meer |
| Mechanieker | Materiaal | Fietsen | Onderdelen | Planning | Meer |
| Soigneur | Voeding | Renners | Planning | Historie | Meer |
| Medical Staff | Gezondheid | Sporters | Meldingen | Historie | Meer |
| Ouder | Kind | Agenda | Toestemmingen | Historie | Meer |
| Admin | Systeemstatus | Incidenten | Support | Releases | Meer |

**MRU-23 — regels bij de labels:**
- maximaal vijf hoofditems, op elk apparaat;
- een label is **één woord** waar dat kan, en nooit langer dan de smalste ondersteunde breedte toelaat;
- twee rollen mogen op dezelfde positie hetzelfde label hebben; dat is geen fout maar een teken dat het werk daar hetzelfde is;
- een hoofditem dat in de actieve context geen inhoud kan hebben wordt **niet leeg getoond en niet stil weggelaten** — het toont waarom het leeg is (`MUX-88`, `PAT-08`);
- een rol waarvoor geen zinnig label bestaat op een positie, krijgt daar het **generieke** label van die positie; er wordt geen positie geschrapt.

**MRU-24 — gevolg voor `MUX-14`:** deze uitkomst wijzigt `MUX-14`, dat nu nog zegt dat óók de namen gelijk zijn. De wijziging loopt via de synchronisatiepatch van het bouwpakket en niet via dit document.

## 6. Wat een contextwissel wél verandert

navigatie-inhoud · dashboard · notificatiefilter · zoekresultaten · rechten · filters en voorkeuren die bij de rol horen · actieve schermen · breadcrumbs · AI-context · open detailvensters.

**MRU-25:** open detailvensters worden **gesloten**, niet meegenomen. Een geopende sporterkaart uit de trainercontext heeft in de clubbeheercontext geen geldige betekenis en mag daar niet blijven staan.

## 7. Wat een contextwissel niet verandert

login · sessie · account · taal · persoonlijke instellingen (thema, tekstgrootte, verminderde beweging, toegankelijkheid, meldingsvoorkeuren op accountniveau).

**MRU-26:** persoonlijke instellingen zijn accountgebonden en overleven elke wissel. Rolgebonden voorkeuren (filters, sorteringen, kolomkeuzes) zijn **contextgebonden** en keren terug wanneer de gebruiker in die context terugkomt.

## 8. Onderbreking en onafgemaakt werk

**MRU-27:** heeft de gebruiker onafgemaakt werk in de huidige context (ingevuld formulier, concept, lopende invoer), dan vraagt de rolwisselaar om bevestiging en biedt: **opslaan als concept** · **doorgaan zonder opslaan** · **annuleren**. Geen stille dataverlies, geen stille bewaring.
**MRU-28:** tijdens een lopende navigatie, training, wedstrijd, onboarding of formulier onderbreekt niets de gebruiker om een rolwissel voor te stellen (`MUX-90`). De rolwisselaar blijft bereikbaar; hij dringt zich niet op.
**MRU-29:** in wedstrijddagmodus (`MUX-96`) is de rolwisselaar bereikbaar maar niet prominent, en vraagt hij altijd bevestiging — een onbedoelde wissel op een wedstrijddag is duurder dan een extra tik.

## 9. Toegankelijkheid

**MRU-30:** de actieve context is voorleesbaar als één samenhangende mededeling, in de volgorde rol → organisatie → team/sporter.
**MRU-31:** een contextwissel wordt aangekondigd aan hulpsoftware en bevestigd met een zichtbare, niet uitsluitend op kleur berustende terugkoppeling.
**MRU-32:** de contextregel voldoet aan de contrast- en raakvlaknormen uit de mobiele standaard en verkleint het bruikbare raakvlak van de navigatie niet.

## 10. Prestaties

**MRU-33:** een rolwissel toont binnen de ervaringsnorm van `MUX-94` eerst de nieuwe contextregel en de kernbediening, daarna de inhoud (`MUX-98`). Er wordt nooit inhoud van de vorige context getoond terwijl de nieuwe laadt.
**MRU-34:** een trage bron in de nieuwe context blokkeert het hele scherm niet; het betreffende onderdeel toont zijn eigen wachttoestand.

## 11. Verboden

- Een scherm waarop de actieve rol of organisatie niet af te leiden is.
- Een contextwissel die geen zichtbare bevestiging geeft.
- Inhoud van de vorige context die tijdens of na de wissel nog in beeld staat.
- Een rolwisselaar die om opnieuw inloggen vraagt.
- Rechten die in de interface worden afgeleid in plaats van server-side opgehaald.
- Een tweede rollen- of rechtenmodel naast `CLUB_RECHTEN_01`.
- Een rolomgeving voor een rolwaarde die server-side niet bestaat.
- Automatisch wisselen van context zonder handeling van de gebruiker.
