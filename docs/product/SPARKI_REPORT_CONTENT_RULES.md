# SPARKI — RAPPORTINHOUDSREGELS v1.0

**Technische code:** `REPORT_DESIGN_STANDARD_01` — oplevering 3 van 5
**Hoort bij:** `SPARKI_REPORT_DESIGN_STANDARD_v1.0.md` en `SPARKI_REPORT_TEMPLATE_LIBRARY.md` (beide bindend)
**Status:** BINDEND, afgeleid. Geen nieuwe merkregels, geen nieuwe productbesluiten.
**Datum:** 1 augustus 2026

---

## 0. Hoe dit document werkt

Twee delen. Eerst de **inhoudsregels** (`RCR`) die voor iedere uitdraai gelden: grafieken, tabellen, cijfers en waarheidsgetrouwheid. Daarna de **23 rapporttypen** (`RT`), elk met zijn belofte, zijn template en zijn verplichte inhoud.

**Codegovernance.** Nieuwe regel of nieuw rapporttype is een nieuwe code; codes worden nooit hergebruikt; bouwpakketten en Mirror-bevindingen verwijzen naar de code.

**Vaste opbouw per rapporttype.** Belofte in gewone taal (RPT-53), daarna een tabel met tien vaste velden. De privacyclassificatie is een **voorlopige indeling** — de reeks zelf wordt vastgesteld in `SPARKI_REPORT_PRIVACY_STANDARD.md` en vraagt bevestiging.

---

## 1. Inhoudsregels

### 1.1 Waarheid

**RCR-01 — Eén waarheid.** Wat het rapport toont, is identiek aan wat het scherm, de API en de databron tonen. Een verschil is een fout in de generator, geen weergavevariant (RPT-09).

**RCR-02 — Geen mock-, demo- of placeholderdata.** In geen enkel rapport, in geen enkele sectie, in geen enkele grafiek. Directe afkeurgrond.

**RCR-03 — Bron en periode zichtbaar.** Iedere grafiek en iedere tabel toont waar de gegevens vandaan komen en over welke periode ze gaan.

**RCR-04 — Genereermoment apart van bronperiode.** De documentdatum is het moment van genereren; de bronperiode staat er los naast (RPT-18, RPT-52).

**RCR-05 — Ontbrekende gegevens worden benoemd, niet gladgestreken.** Geen interpolatie, geen schatting, geen doorgetrokken lijn over een gat. Wat ontbreekt, staat in de brontoelichting (BLK-10).

**RCR-06 — Geen stille afronding.** Waar afronding de conclusie kan veranderen, staat de eenheid en de nauwkeurigheid erbij.

### 1.2 Grafieken

**RCR-07 — Geen ruwe systeemgrafiek.** Een grafiek die rechtstreeks uit een meetreeks komt zonder titel, eenheid, as-labels en legenda, hoort niet in een rapport.

**RCR-08 — Juiste eenheden, altijd zichtbaar.** Watt, uren, kilometers, hartslag, gewicht van materiaal — de eenheid staat bij de as, niet alleen in de titel.

**RCR-09 — Legenda is begrijpelijk zonder voorkennis.** Geen interne veldnamen, geen afkortingen die alleen in de code bestaan.

**RCR-10 — Geen afgesneden labels.** Past een label niet, dan wordt de grafiek aangepast — niet het label.

**RCR-11 — Leesbaar in zwart-wit.** Onderscheid gebeurt met vorm, arcering, lijnstijl of markering, niet met kleur alleen (RPT-36).

**RCR-12 — Status nooit alleen met kleur.** Rood, oranje en groen dragen altijd ook een woord of symbool.

**RCR-13 — Assen niet misleidend.** Een afgekapte y-as wordt als zodanig aangeduid. Een verschil dat groot lijkt door de schaal, is geen conclusie.

**RCR-14 — Grafiek breekt niet over pagina's.** Past hij niet, dan gaat hij naar de volgende pagina of naar een landschapspagina (RPT-38).

**RCR-15 — Grafiek zonder gegevens verschijnt niet.** In plaats daarvan vervalt de sectie, of er staat uitleg waarom er niets is (RPT-58). Een lege assenstelsel is een fout.

### 1.3 Tabellen

**RCR-16 — Kolomkoppen herhalen op elke pagina.**

**RCR-17 — Logische afbreking.** Een rij breekt niet over twee pagina's; een groep blijft bij elkaar waar dat betekenis heeft.

**RCR-18 — Totalen, afwijkingen en waarschuwingen zijn gemarkeerd** in woord én vorm, en zijn als zodanig herkenbaar zonder de rest te lezen.

**RCR-19 — Nul rijen is geen lege tabel.** Ofwel de sectie vervalt, ofwel er staat wat er verwacht werd en waarom het er niet is.

**RCR-20 — Kolommen die niets toevoegen, vervallen.** Een tabel is geen database-export.

### 1.4 Inhoud en toon

**RCR-21 — Kernsamenvatting in gewone taal.** Geen vaktermen zonder uitleg, geen interne begrippen, geen afkortingen die alleen binnen Sparki bestaan.

**RCR-22 — Geen data zonder conclusie of vervolgstap** (RPT-54). Enige uitzondering: de ruwe AVG-export (RT-22).

**RCR-23 — Actiepunten zijn concreet.** Wat, door wie, vóór wanneer. "Aandacht besteden aan herstel" is geen actiepunt.

**RCR-24 — Geen gezondheidsinterpretatie buiten de medische rapporten.** Een trainings- of teamrapport meldt beschikbaarheid en geschiktheid, niet de onderliggende gezondheidsgegevens.

**RCR-25 — Geen gewichts- of calorieadvies aan minderjarigen**, in geen enkel rapporttype, ook niet als de ontvanger een volwassene is.

**RCR-26 — AI-tekst is gemarkeerd** met bron, periode en onzekerheid (RPT-62 t/m RPT-65, BLK-11). **Geen AI-tekst in operationele dagstukken** (TPL-05).

---

## 2. De 23 rapporttypen

De velden per type: **doelgroep en ontvanger · opsteller · template en lengte · verplichte inhoud · optionele inhoud · classificatie · grafiek en tabel · actiepunten · weergave · bewaring · Mirror**.

### RT-01 — Trainingsrapport
*Belofte: de sporter weet wat hij deze periode heeft gedaan, hoe dat zich verhoudt tot het plan, en wat de eerstvolgende stap is.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | sporter; trainer als tweede lezer |
| Opsteller | trainer, of Sparki bij een ongekoppelde sporter |
| Template en lengte | TPL-02 · 2–4 pagina's |
| Verplicht | periode · uitgevoerde sessies tegenover gepland · belasting en verdeling · conclusie · één actiepunt |
| Optioneel | vergelijking met vorige periode · zonesverdeling · terugkoppeling van de sporter |
| Classificatie | intern |
| Grafiek en tabel | belastingverloop (grafiek) · sessieoverzicht (tabel) |
| Actiepunten | verplicht |
| Weergave | desktoppreview volledig · mobiel leesbaar zonder zoomen · print in zwart-wit |
| Bewaring | volgens bewaarbeleid |
| Mirror | belofte waargemaakt · geplande en uitgevoerde sessies kloppen met het scherm · actiepunt aanwezig |

### RT-02 — Voortgangsrapport
*Belofte: sporter en trainer zien of de ontwikkeling de goede kant op gaat, en waaraan dat te zien is.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | sporter en trainer |
| Opsteller | trainer |
| Template en lengte | TPL-02 · 2–4 pagina's |
| Verplicht | periode · ontwikkeling op enkele vaste maatstaven · duiding · vervolgstap |
| Optioneel | vergelijking met groep (geanonimiseerd) · doelen |
| Classificatie | intern |
| Grafiek en tabel | trendgrafiek per maatstaf |
| Actiepunten | verplicht |
| Weergave | als RT-01 |
| Bewaring | volgens bewaarbeleid |
| Mirror | trend komt overeen met de bron · geen groepsvergelijking die tot een persoon herleidbaar is |

### RT-03 — Wedstrijdanalyse
*Belofte: de sporter en de trainer begrijpen wat er tijdens de wedstrijd gebeurde, welke factoren bepalend waren, en welke concrete vervolgstap logisch is.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | sporter en trainer; op verzoek de ploegleider |
| Opsteller | trainer |
| Template en lengte | TPL-02 · 3–6 pagina's |
| Verplicht | wedstrijdgegevens · verloop · bepalende momenten · uitkomst · duiding · vervolgstap |
| Optioneel | vergelijking met eerdere wedstrijden · materiaalgebruik · weersomstandigheden |
| Classificatie | intern |
| Grafiek en tabel | verloopgrafiek · momententabel |
| Actiepunten | verplicht |
| Weergave | desktoppreview volledig · mobiel leesbaar · printbaar |
| Bewaring | volgens bewaarbeleid |
| Mirror | dit is het referentievoorbeeld van RPT-53: een analyse zonder duiding en vervolgstap wordt afgekeurd |

### RT-04 — Seizoensanalyse
*Belofte: sporter, trainer en organisatie weten wat het seizoen heeft opgeleverd en wat de basis is voor het volgende.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | sporter, trainer, organisatie |
| Opsteller | trainer of hoofdtrainer |
| Template en lengte | TPL-03 · 6–12 pagina's |
| Verplicht | seizoensperiode · opbouw · hoogtepunten en tegenvallers · conclusie · richting voor volgend seizoen |
| Optioneel | wedstrijdoverzicht · materiaal · aanwezigheid |
| Classificatie | intern |
| Grafiek en tabel | jaarverloop · blokkenoverzicht · wedstrijdtabel |
| Actiepunten | verplicht |
| Weergave | voorblad met inhoudsopgave · landschapspagina's voor brede tabellen |
| Bewaring | volgens bewaarbeleid |
| Mirror | conclusie hangt samen met de getoonde gegevens · geen losse hoofdstukken zonder samenvatting |

### RT-05 — FTP- en testverslag
*Belofte: de sporter weet wat de test heeft opgeleverd, onder welke omstandigheden, en wat er met de uitkomst gebeurt.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | sporter en trainer |
| Opsteller | trainer |
| Template en lengte | TPL-01 of TPL-02 · 1–3 pagina's |
| Verplicht | testprotocol · omstandigheden · uitkomst met eenheid · vergelijking met vorige test · gevolg voor de zones |
| Optioneel | verloop tijdens de test · subjectieve beleving |
| Classificatie | intern |
| Grafiek en tabel | testverloop · zonetabel |
| Actiepunten | verplicht — de uitkomst leidt tot een aanpassing of tot de vaststelling dat er niets verandert |
| Weergave | compact, één pagina waar mogelijk |
| Bewaring | volgens bewaarbeleid |
| Mirror | protocol en omstandigheden aanwezig · zones sluiten aan op de uitkomst |

### RT-06 — Hersteloverzicht
*Belofte: de sporter en zijn begeleider zien hoe belasting en herstel zich verhouden, en wat dat betekent voor de komende dagen.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | sporter; trainer; medische begeleiding waar toestemming bestaat |
| Opsteller | trainer, of medische begeleiding |
| Template en lengte | TPL-04 · 2–4 pagina's |
| Verplicht | periode · belasting tegenover herstel · signalen · gevolg voor de planning |
| Optioneel | slaap- en hartslaggegevens waar toestemming bestaat |
| Classificatie | vertrouwelijk; medisch-vertrouwelijk zodra gezondheidsgegevens zijn opgenomen |
| Grafiek en tabel | belasting-hersteltrend |
| Actiepunten | verplicht |
| Weergave | watermerk · ontvanger en doel benoemd |
| Bewaring | gezondheidsgerelateerd — volgens bewaarbeleid, nog onbepaald |
| Mirror | classificatie klopt · geen doorgifte naar algemene team- of clubrapporten |

### RT-07 — Gezondheids- of begeleidingsrapport
*Belofte: de bevoegde ontvanger heeft een volledig en herleidbaar beeld van de begeleiding, binnen de gegeven toestemming.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | medische begeleiding; de sporter zelf; ouder waar rechthebbend |
| Opsteller | medische begeleiding |
| Template en lengte | TPL-04 · lengte volgt de inhoud |
| Verplicht | toestemmingsgrond · periode · bevindingen · gevolg voor de beschikbaarheid · ontvanger en doel · geldigheidsdatum |
| Optioneel | verwijzing naar externe zorg |
| Classificatie | medisch-vertrouwelijk |
| Grafiek en tabel | terughoudend; alleen waar het de conclusie draagt |
| Actiepunten | verplicht |
| Weergave | watermerk · alleen delen via beveiligde link · verstrekking gelogd |
| Bewaring | volgens bewaarbeleid gezondheidsdata, nog onbepaald |
| Mirror | geen verstrekking zonder toestemmingsgrond · nooit als bijlage · nooit in een algemeen rapport |

### RT-08 — Voedingsrapport
*Belofte: de lezer weet welke voedingsafspraken er gelden en hoe die aansluiten op de belasting.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | sporter; soigneur; trainer |
| Opsteller | soigneur of trainer |
| Template en lengte | TPL-02 · 1–3 pagina's |
| Verplicht | periode · afspraken · aansluiting op de belasting · bron van de adviezen |
| Optioneel | bevoorradingsschema |
| Classificatie | intern; vertrouwelijk zodra het individueel wordt |
| Grafiek en tabel | schema als tabel |
| Actiepunten | verplicht |
| Weergave | mobiel leesbaar; vaak in de auto gelezen |
| Bewaring | volgens bewaarbeleid |
| Mirror | **bij een minderjarige geen gewichts- of calorieweergave** (RCR-25) · bron van de adviezen aanwezig |

### RT-09 — Materiaalrapport
*Belofte: de eigenaar of beheerder weet wat de staat van het materiaal is en wat er moet gebeuren.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | mechanieker; teammanager; sporter voor eigen materiaal |
| Opsteller | mechanieker |
| Template en lengte | TPL-02 · 1–4 pagina's |
| Verplicht | materiaaloverzicht · kilometerstanden · slijtage · openstaande defecten · eerstvolgende controle |
| Optioneel | onderhoudshistorie · kosten |
| Classificatie | intern |
| Grafiek en tabel | materiaaltabel met status in woord én vorm |
| Actiepunten | verplicht |
| Weergave | printbaar voor in de werkplaats |
| Bewaring | volgens bewaarbeleid |
| Mirror | status niet alleen met kleur · geen gezondheidsgegevens van renners |

### RT-10 — Routegids
*Belofte: wie deze route gaat rijden, weet vooraf wat hem te wachten staat.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | sporter; groep; gast met gedeelde route |
| Opsteller | Sparki, met de maker van de route benoemd |
| Template en lengte | TPL-02 · 2–5 pagina's |
| Verplicht | afstand · hoogtemeters · hoogteprofiel · kaartbeeld · aandachtspunten · vertrekpunt |
| Optioneel | klimdetails · bevoorradingspunten · alternatieve routes |
| Classificatie | openbaar deelbaar wanneer de route dat is |
| Grafiek en tabel | hoogteprofiel met zichtbare eenheden |
| Actiepunten | niet verplicht; de vervolgstap is de route rijden |
| Weergave | printbaar; QR naar de digitale versie |
| Bewaring | volgt de bewaartermijn van de route |
| Mirror | profiel en afstand identiek aan het scherm · QR werkt |

### RT-11 — Wedstrijdgids
*Belofte: iedereen die meegaat weet vooraf wat het parcours vraagt en wat de afspraken zijn.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | renners en staf van het evenement |
| Opsteller | ploegleider of trainer |
| Template en lengte | TPL-02 · 3–8 pagina's |
| Verplicht | wedstrijdgegevens · parcours en profiel · tijden · afspraken · aandachtspunten |
| Optioneel | weersverwachting · concurrentie · materiaalkeuze |
| Classificatie | intern |
| Grafiek en tabel | hoogteprofiel · tijdentabel |
| Actiepunten | verplicht |
| Weergave | printbaar; wordt vaak op papier meegenomen |
| Bewaring | volgens bewaarbeleid |
| Mirror | tijden komen overeen met het dagschema (RT-12) |

### RT-12 — Dagschema
*Belofte: iedereen weet wat er vandaag wanneer gebeurt en wie waarvoor verantwoordelijk is.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | volledige staf en renners van het evenement |
| Opsteller | ploegleider |
| Template en lengte | TPL-05 · 1–2 pagina's |
| Verplicht | evenement · datum · versie · tijdlijn · wie doet wat · locaties · contactregel · wijzigingen sinds vorige versie |
| Optioneel | reisinformatie |
| Classificatie | intern |
| Grafiek en tabel | tijdlijn als tabel; geen grafieken |
| Actiepunten | de tijdlijn zelf |
| Weergave | groot lettertype · zwart-wit · printbaar · leesbaar in de auto |
| Bewaring | kort; volgt het evenement |
| Mirror | **geen AI-tekst** (RCR-26) · versienummer prominent · wijzigingsblok aanwezig |

### RT-13 — Wedstrijdbezetting
*Belofte: het is ondubbelzinnig wie er rijdt, wie er meegaat, en wie wat doet.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | staf en renners |
| Opsteller | ploegleider |
| Template en lengte | TPL-05 · 1–2 pagina's |
| Verplicht | evenement · geselecteerde renners · toegewezen staf · rollen · bevestigingsstatus · versie |
| Optioneel | reserves · vervangingsafspraken |
| Classificatie | intern |
| Grafiek en tabel | bezettingstabel |
| Actiepunten | openstaande bevestigingen |
| Weergave | als RT-12 |
| Bewaring | kort |
| Mirror | **alleen geschiktheid, nooit de onderliggende gezondheidsreden** (RCR-24) · geen AI-tekst |

### RT-14 — Materiaal- en voertuigenlijst
*Belofte: bij vertrek is duidelijk wat mee moet, wat mee is, en wat ontbreekt.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | mechanieker · ploegleider · chauffeurs |
| Opsteller | mechanieker |
| Template en lengte | TPL-05 · 1–2 pagina's |
| Verplicht | evenement · voertuigen · toegewezen materiaal per renner · afvinkstatus · ontbrekende zaken |
| Optioneel | reservemateriaal |
| Classificatie | intern |
| Grafiek en tabel | afvinktabel |
| Actiepunten | wat nog ontbreekt |
| Weergave | printbaar, in de werkplaats en aan de wagen |
| Bewaring | kort |
| Mirror | ontbrekende zaken expliciet · geen AI-tekst |

### RT-15 — Aanwezigheidsrapport
*Belofte: de organisatie weet wie er was, wie niet, en of daar een patroon in zit.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | trainer · hoofdtrainer · clubbeheerder |
| Opsteller | trainer |
| Template en lengte | TPL-01 · 1–2 pagina's |
| Verplicht | periode · groep · aanwezigheid per sessie · totaal |
| Optioneel | afmeldredenen op geaggregeerd niveau |
| Classificatie | intern |
| Grafiek en tabel | aanwezigheidstabel |
| Actiepunten | alleen waar een patroon om opvolging vraagt |
| Weergave | compact |
| Bewaring | volgens bewaarbeleid |
| Mirror | **geen individuele afmeldreden die een gezondheidsgegeven prijsgeeft** (RCR-24) |

### RT-16 — Trainerplan
*Belofte: de sporter weet wat de trainer met hem voor heeft en waarom.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | sporter; ouder bij een minderjarige |
| Opsteller | trainer |
| Template en lengte | TPL-06 · 2–5 pagina's |
| Verplicht | periode · doel · opbouw · wekelijkse structuur · onderbouwing · eerste stap |
| Optioneel | testmomenten · wedstrijdkalender |
| Classificatie | intern |
| Grafiek en tabel | blokkenoverzicht |
| Actiepunten | verplicht |
| Weergave | co-branded; opsteller en organisatie in de kop |
| Bewaring | volgens bewaarbeleid |
| Mirror | opsteller aanwezig · disclaimer benoemt dat Sparki het platform is (RPT-32) |

### RT-17 — Clubrapport
*Belofte: het clubbestuur ziet hoe de club ervoor staat, zonder in individuele gegevens te kijken.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | clubbeheerder · bestuur · leden bij een jaarrapport |
| Opsteller | clubbeheerder |
| Template en lengte | TPL-03 of TPL-06 · 4–10 pagina's |
| Verplicht | periode · ledenontwikkeling · groepen en bezetting · activiteiten · conclusie |
| Optioneel | trainerbezetting · aanwezigheidstrends |
| Classificatie | intern; openbaar deelbaar deel bij een jaarrapport |
| Grafiek en tabel | ledenontwikkeling · groepsbezetting |
| Actiepunten | verplicht |
| Weergave | co-branding waar de club het naar buiten brengt |
| Bewaring | volgens bewaarbeleid |
| Mirror | **geen gezondheidsdata** · geen tot een persoon herleidbare cijfers in geaggregeerde grafieken |

### RT-18 — Teamrapport
*Belofte: het team en zijn belanghebbenden zien wat er is gepresteerd en hoe het team ervoor staat.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | teammanager · staf · sponsor bij een externe versie |
| Opsteller | teammanager |
| Template en lengte | TPL-03 of TPL-06 · 4–10 pagina's |
| Verplicht | periode · samenstelling · programma en resultaten · conclusie |
| Optioneel | materiaal · reisoverzicht |
| Classificatie | intern; externe versie apart samengesteld |
| Grafiek en tabel | resultatentabel |
| Actiepunten | verplicht |
| Weergave | co-branded voor de externe versie |
| Bewaring | volgens bewaarbeleid |
| Mirror | **geen gezondheidsdata** · externe versie bevat geen interne beoordelingen |

### RT-19 — Incidentrapport
*Belofte: achteraf is navolgbaar wat er gebeurde, wanneer, wie erbij betrokken was en wat eraan is gedaan.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | admin · organisatiebeheer · betrokken verantwoordelijke |
| Opsteller | admin, of de meldende rol |
| Template en lengte | TPL-04 · 1–4 pagina's |
| Verplicht | tijdstip · wat er gebeurde · betrokkenen naar rol · genomen maatregelen · huidige status · oorzaak of "oorzaak nog onbekend" |
| Optioneel | tijdlijn · vervolgacties |
| Classificatie | vertrouwelijk |
| Grafiek en tabel | tijdlijn als tabel |
| Actiepunten | verplicht |
| Weergave | watermerk · ontvanger benoemd |
| Bewaring | volgens bewaarbeleid auditlogs, nog onbepaald |
| Mirror | sluit met een oorzaak of met de expliciete vaststelling dat die onbekend is — nooit met "opgelost" |

### RT-20 — Rode-vlagrapport
*Belofte: de verantwoordelijke weet dat er een signaal is, wat het betekent voor de inzetbaarheid, en wat de eerstvolgende stap is.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | ploegleider · teammanager · medische begeleiding |
| Opsteller | medische begeleiding, of de signalerende rol |
| Template en lengte | TPL-04 · 1–2 pagina's |
| Verplicht | signaal · **geschiktheidsuitkomst** · geldigheid · wie te benaderen |
| Optioneel | vervolgafspraak |
| Classificatie | vertrouwelijk; medisch-vertrouwelijk zodra de onderliggende reden erin staat |
| Grafiek en tabel | geen |
| Actiepunten | verplicht |
| Weergave | watermerk · korte, ondubbelzinnige tekst |
| Bewaring | volgens bewaarbeleid |
| Mirror | **de niet-medische ontvanger ziet uitsluitend de geschiktheidsuitkomst**, niet de onderliggende gezondheidsgegevens (RCR-24) |

### RT-21 — Abonnement- en factuurdocument
*Belofte: de betaler weet wat hij afneemt, wat het kost, over welke periode, en wat er gebeurt bij wijziging.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | de betalende partij |
| Opsteller | Sparki |
| Template en lengte | TPL-01 · 1–2 pagina's |
| Verplicht | afnemer · product en periode · bedrag en btw · betaalmoment · wijzigings- en opzegregels · Sparki als afzender |
| Optioneel | verbruiksoverzicht |
| Classificatie | vertrouwelijk |
| Grafiek en tabel | factuurtabel |
| Actiepunten | alleen waar actie vereist is |
| Weergave | printbaar · onveranderlijk · geen co-branding |
| Bewaring | volgens bewaarbeleid facturatie, nog onbepaald |
| Mirror | geen co-branding · bedragen identiek aan de administratie · document is onveranderlijk (RPT-51) |

### RT-22 — AVG-export
*Belofte: de betrokkene ontvangt een volledige, onbewerkte weergave van zijn gegevens.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | uitsluitend de betrokkene, of zijn wettelijk vertegenwoordiger |
| Opsteller | Sparki |
| Template en lengte | TPL-04 · lengte volgt de gegevens |
| Verplicht | volledige gegevensweergave · categorie-indeling · peildatum · toelichting op de structuur |
| Optioneel | machineleesbare bijlage |
| Classificatie | vertrouwelijk; medisch-vertrouwelijk voor het gezondheidsdeel |
| Grafiek en tabel | geen interpretatie, alleen weergave |
| Actiepunten | **niet van toepassing — dit is de enige uitzondering op RPT-54** |
| Weergave | beveiligde link · verstrekking gelogd |
| Bewaring | volgens bewaarbeleid |
| Mirror | volledigheid · geen interpretatie · geen verborgen velden weggelaten of stilzwijgend toegevoegd |

### RT-23 — Support- en auditrapport
*Belofte: achteraf is navolgbaar wat er is gebeurd, door wie, en op welke grond.*

| Veld | Invulling |
|---|---|
| Doelgroep en ontvanger | admin · beheer · op verzoek een externe controleur |
| Opsteller | Sparki of admin |
| Template en lengte | TPL-03 · lengte volgt de periode |
| Verplicht | periode · gebeurtenissen met tijdstip · handelende rol · grond van inzage · uitkomst |
| Optioneel | statistieken over doorlooptijd |
| Classificatie | vertrouwelijk |
| Grafiek en tabel | gebeurtenissentabel; grafieken alleen bij aantallen |
| Actiepunten | waar opvolging nodig is |
| Weergave | watermerk · onveranderlijk |
| Bewaring | volgens bewaarbeleid auditlogs, nog onbepaald |
| Mirror | iedere inzage in persoonsgegevens draagt een grond · geen inhoudelijke gezondheidsdata |

---

## 3. Overzicht

| Code | Rapporttype | Template | Classificatie | Actiepunten |
|---|---|---|---|---|
| RT-01 | Trainingsrapport | TPL-02 | intern | ✔ |
| RT-02 | Voortgangsrapport | TPL-02 | intern | ✔ |
| RT-03 | Wedstrijdanalyse | TPL-02 | intern | ✔ |
| RT-04 | Seizoensanalyse | TPL-03 | intern | ✔ |
| RT-05 | FTP- en testverslag | TPL-01/02 | intern | ✔ |
| RT-06 | Hersteloverzicht | TPL-04 | vertrouwelijk+ | ✔ |
| RT-07 | Gezondheids-/begeleidingsrapport | TPL-04 | medisch-vertrouwelijk | ✔ |
| RT-08 | Voedingsrapport | TPL-02 | intern/vertrouwelijk | ✔ |
| RT-09 | Materiaalrapport | TPL-02 | intern | ✔ |
| RT-10 | Routegids | TPL-02 | openbaar deelbaar | — |
| RT-11 | Wedstrijdgids | TPL-02 | intern | ✔ |
| RT-12 | Dagschema | TPL-05 | intern | tijdlijn |
| RT-13 | Wedstrijdbezetting | TPL-05 | intern | bevestigingen |
| RT-14 | Materiaal- en voertuigenlijst | TPL-05 | intern | ontbrekend |
| RT-15 | Aanwezigheidsrapport | TPL-01 | intern | zo nodig |
| RT-16 | Trainerplan | TPL-06 | intern | ✔ |
| RT-17 | Clubrapport | TPL-03/06 | intern | ✔ |
| RT-18 | Teamrapport | TPL-03/06 | intern | ✔ |
| RT-19 | Incidentrapport | TPL-04 | vertrouwelijk | ✔ |
| RT-20 | Rode-vlagrapport | TPL-04 | vertrouwelijk+ | ✔ |
| RT-21 | Abonnement en factuur | TPL-01 | vertrouwelijk | zo nodig |
| RT-22 | AVG-export | TPL-04 | vertrouwelijk+ | **n.v.t.** |
| RT-23 | Support- en auditrapport | TPL-03 | vertrouwelijk | zo nodig |

**Vier typen dragen geen AI-tekst** omdat ze operationele dagstukken zijn: RT-12, RT-13, RT-14 — en RT-22, omdat een export geen interpretatie bevat.

---

*Einde `SPARKI_REPORT_CONTENT_RULES.md`.*
