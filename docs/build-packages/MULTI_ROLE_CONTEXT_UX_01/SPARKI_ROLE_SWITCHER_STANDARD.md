# SPARKI_ROLE_SWITCHER_STANDARD

**Regelcodes:** `RSW-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026
De volledige uitwerking van de rolwisselaar. Componenten uit `SPARKI_MOBILE_COMPONENT_LIBRARY.md`; nieuwe componenten worden **daar** toegevoegd, niet hier bedacht (zie §9).

---

## 1. Wat de rolwisselaar is

**RSW-01:** één plek waar de gebruiker ziet welke contexten hij heeft, welke actief is, en waarmee hij wisselt. Geen instellingenscherm, geen menu-item tussen andere items, geen verborgen gebaar.
**RSW-02:** de rolwisselaar is **altijd dezelfde**, op elk apparaat en in elke rol. Hij verandert van vorm, niet van gedrag.
**RSW-03:** een gebruiker met één context ziet hem niet (`MRU-07`).

## 2. Locatie

| Apparaat | Locatie | Openen |
|---|---|---|
| **Mobiel** | De contextregel bovenaan het scherm | Tik op de contextregel |
| **Desktop** | De contextweergave in de kop | Klik op de contextweergave |
| **Tablet** | Volgt de desktopindeling bij voldoende breedte, anders de mobiele | Idem |

**RSW-04:** de rolwisselaar zit **niet** in de hoofdnavigatie en kost daar geen item. `MUX-14` blijft onaangeraakt.
**RSW-05:** hij is bereikbaar vanaf elk hoofdscherm en elk detailscherm. In wedstrijddagmodus is hij bereikbaar maar niet prominent, en vraagt hij altijd bevestiging (`MRU-25`).
**RSW-06:** er is precies één ingang. Geen tweede knop in het profielmenu, geen derde in de instellingen.

## 3. Vorm

**RSW-07 — mobiel:** een schermvullend of van onderaf opkomend paneel. Bovenaan de **actieve context**, duidelijk gemarkeerd. Daaronder, in deze volgorde: **favorieten** · **laatst gebruikt** · **alle contexten**, gegroepeerd per organisatie.
**RSW-08 — desktop:** hetzelfde in een uitklappaneel, met dezelfde volgorde. Desktop mag per context meer tonen (aantal sporters, aantal open taken); mobiel toont rol, organisatie en bereik.
**RSW-09:** per contextregel is zichtbaar: **rol** · **organisatie** · **bereik of onderwerp** · de eigenaarsrelatie waar van toepassing. De rol staat vooraan; die is de vraag die de gebruiker het eerst stelt.
**RSW-10:** de actieve context staat bovenaan en is niet aanklikbaar om naar zichzelf te wisselen.

## 4. Bediening en snelheid

**RSW-11:** wisselen kost **één handeling** vanuit de rolwisselaar: één tik op de gewenste context. Geen bevestigingsstap, tenzij een van de gevallen in `RSW-15` geldt.
**RSW-12:** het paneel opent onmiddellijk en toont de lijst uit de laatst bekende contextset, terwijl de server-side lijst wordt opgehaald. Wijzigt die lijst, dan wordt dat zichtbaar bijgewerkt — een verdwenen context wordt niet stil weggehaald maar gemarkeerd als niet meer beschikbaar.
**RSW-13:** na de tik verschijnt eerst de nieuwe contextregel en de kernbediening, daarna de inhoud (`MRU-29`). Inhoud van de vorige context is op geen enkel moment zichtbaar.
**RSW-14:** de wissel wordt bevestigd met een zichtbare, niet uitsluitend op kleur berustende terugkoppeling, en aangekondigd aan hulpsoftware (`MRU-27`).

**RSW-15 — wanneer er wél een bevestiging komt:**
- er is onafgemaakt werk (`MRU-23`);
- de gebruiker staat in wedstrijddagmodus;
- de wissel gaat naar een context met **ruimere** rechten (bijvoorbeeld naar clubbeheer) — dan bevestigt de gebruiker bewust dat hij die omgeving betreedt.

## 5. Zoeken, favorieten en laatst gebruikt

**RSW-16 — zoeken** verschijnt zodra er **meer dan zeven** contexten zijn. Daaronder is een lijst sneller dan een zoekveld.
**RSW-17:** zoeken doorzoekt rol, organisatie, bereik en onderwerp. Het doorzoekt **geen** inhoud — dit is een contextkiezer, geen zoekmachine.
**RSW-18 — favorieten** worden door de gebruiker gemarkeerd, staan bovenaan en behouden de door hem gekozen volgorde. Sparki markeert nooit zelf een favoriet.
**RSW-19 — laatst gebruikt** toont maximaal vijf contexten, nieuwste eerst, zonder de contexten die al onder favorieten staan.
**RSW-20:** alle contexten worden gegroepeerd **per organisatie**, met de organisatienaam als kop. Binnen een organisatie staan de rollen in de volgorde van `MUX-76a`, zodat de volgorde overal in Sparki dezelfde is.

## 6. Meerdere clubs, teams en sporters

**RSW-21:** meerdere clubs zijn groepen in de lijst, gelijkwaardig, zonder hoofdclub.
**RSW-22:** meerdere teams of groepen binnen één rol en één club zijn **afzonderlijke contextregels** (`CTX-04`), niet een filter binnen één regel.
**RSW-23:** meerdere sporters of kinderen zijn afzonderlijke contextregels met het onderwerp in beeld. Bij meer dan zeven daarvan geldt `RSW-16`.
**RSW-24:** wordt de lijst lang, dan blijft de indeling gelijk: favorieten, laatst gebruikt, alles per organisatie. Er komt geen tweede indelingslogica bij een bepaald aantal.

## 7. Wat een rolwissel nooit doet

**RSW-25:** nooit opnieuw laten inloggen.
**RSW-26:** nooit rechten overslaan — elke wissel is server-side gevalideerd (`CTX-11`).
**RSW-27:** nooit oude gegevens laten staan — open detailvensters sluiten, caches van de vorige context worden verworpen (`SPARKI_CONTEXT_SECURITY_STANDARD.md`).
**RSW-28:** nooit een tussentoestand tonen waarin de rol al gewisseld is en de rechten nog niet (`CTX-12`).
**RSW-29:** nooit stilzwijgend een andere context kiezen dan de aangetikte.

## 8. Foutgevallen

| Situatie | Gedrag |
|---|---|
| Context bestaat niet meer | Melding met reden, regel gemarkeerd als niet meer beschikbaar, oude context blijft actief |
| Rechten geweigerd | Melding met reden, geen wissel, oude context blijft actief (`CTX-13`) |
| Server onbereikbaar | Geen wissel. De rolwisselaar toont dat wisselen nu niet kan — hij zet niets in een wachtrij |
| Offline | Idem; de huidige context blijft leesbaar met zichtbare tijdstempel |
| Wissel duurt lang | Wachttoestand in het paneel, oude context blijft zichtbaar tot de nieuwe volledig staat |

**RSW-30:** een mislukte wissel laat de gebruiker **altijd** in een geldige context achter. Er bestaat geen uitkomst waarin hij nergens meer in zit.

## 9. Componenten — `CMP-45`, `CMP-46`, `CMP-47` (`MR-B03 = A`)

**RSW-31:** de rolwisselaar vraagt om drie componenten die nog niet in `SPARKI_MOBILE_COMPONENT_LIBRARY.md` staan. Conform de bestaande regel worden zij **eerst aan de bibliotheek toegevoegd** en niet in een bouwpakket bedacht. Onderstaande contracten zijn daarvoor het **voorstel ter opname**; de bibliotheek is en blijft de bron, dit document niet.

**Toevoeging vóór `MRC-F3`. Zonder deze opname start F3 niet.**

### CMP-45 — Contextregel
| | |
|---|---|
| **Doel** | Toont de actieve context en opent de rolwisselaar |
| **Inhoud** | Rol · organisatie · bereik of onderwerp · eigenaarsrelatie waar van toepassing |
| **Gedrag** | Tikbaar; opent `CMP-46`. Kort in bij ruimtegebrek van rechts naar links; de **rol** wordt nooit ingekort weggelaten |
| **Toestanden** | Normaal · verkort · enkele context (dan niet getoond) · wisselend (wachttoestand) |
| **Plaatsing** | Volgt uit `MR-B04` |
| **Toegankelijkheid** | Voorleesbaar als één mededeling in de volgorde rol → organisatie → bereik |
| **Verboden** | Meetellen als navigatie-item; het bruikbare raakvlak van de navigatie verkleinen; alleen op kleur berusten |
| **MUX-koppeling** | `MUX-14` · `MUX-93` · `MUX-94` · `MUX-96` |

### CMP-46 — Contextkiezerpaneel
| | |
|---|---|
| **Doel** | De volledige rolwisselaar |
| **Inhoud** | Actieve context bovenaan · favorieten · laatst gebruikt · alle contexten gegroepeerd per organisatie · zoekveld vanaf de drempel uit `RSW-16` |
| **Gedrag** | Één tik wisselt; bevestiging in de drie gevallen van `RSW-15` |
| **Toestanden** | Normaal · zoekend · leeg zoekresultaat · laden · offline (wisselen geweigerd) · context niet meer beschikbaar |
| **Plaatsing** | Mobiel van onderaf opkomend of schermvullend; desktop uitklappaneel |
| **Toegankelijkheid** | Volledig met toetsenbord bedienbaar; wissel wordt aangekondigd |
| **Verboden** | Tweede ingang elders; wachtrij bij offline; automatische keuze; inhoud doorzoeken |
| **MUX-koppeling** | `MUX-37` · `MUX-88` · `MUX-90` · `MUX-98` |

### CMP-47 — Contextregelitem
| | |
|---|---|
| **Doel** | Eén kiesbare context binnen `CMP-46` |
| **Inhoud** | Rol vooraan · organisatie · bereik of onderwerp · eigenaarsrelatie · favorietmarkering |
| **Gedrag** | Tikbaar tenzij het de actieve context is; favoriet aan- en uitzetten |
| **Toestanden** | Normaal · actief (niet kiesbaar) · favoriet · niet meer beschikbaar (gemarkeerd, niet verwijderd) |
| **Verboden** | Aantallen of inhoud uit die context tonen — dat is een contextlek (`CSE-07`) |
| **MUX-koppeling** | `MUX-93` · `MUX-99` |

**RSW-31a:** het laatste verbod bij `CMP-47` is niet cosmetisch: een lijstitem dat "3 open taken" toont, toont een gegeven uit een context waarin de gebruiker op dat moment niet werkt.

**RSW-32:** voor het overige gebruikt de rolwisselaar bestaande componenten en patronen: overlaypaneel, lijstitem, zoekveld, lege toestand, bevestiging, wachttoestand. Er wordt niets nieuws bedacht wat al bestaat.

**RSW-32:** voor het overige gebruikt de rolwisselaar bestaande componenten en patronen: overlaypaneel, lijstitem, zoekveld, lege toestand, bevestiging, wachttoestand. Er wordt niets nieuws bedacht wat al bestaat.
