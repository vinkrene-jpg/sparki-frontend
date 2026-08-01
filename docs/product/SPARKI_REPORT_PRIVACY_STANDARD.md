# SPARKI — RAPPORT-PRIVACYSTANDAARD v1.0

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Technische code:** `REPORT_DESIGN_STANDARD_01` — oplevering 4 van 5
**Hoort bij:** `SPARKI_REPORT_DESIGN_STANDARD_v1.0.md` · `SPARKI_REPORT_TEMPLATE_LIBRARY.md` · `SPARKI_REPORT_CONTENT_RULES.md`
**Status:** BINDEND, afgeleid. Neemt geen nieuwe productbesluiten; open punten zijn als open gemarkeerd.
**Datum:** 1 augustus 2026

---

## 0. Hoe dit document werkt

Een rapport is het moment waarop gegevens Sparki verlaten. Vanaf dat moment gelden de rechten uit het systeem niet meer vanzelf: een PDF in een mailbox weet niet dat een toestemming is ingetrokken. Deze standaard regelt daarom wat er in een rapport terechtkomt, voor wie, hoe lang, en wat er gebeurt als de grond eronder wegvalt.

**Codes:** `RPV-nn`. Rechten en rollen worden hier **toegepast**, niet vastgesteld — die horen bij `CLUB_RECHTEN_01`.

---

## 1. Classificatie

**RPV-01 — Vier klassen.** Ieder document draagt precies één classificatie, zichtbaar in de kop, de voettekst en de metadata (RPT-20, RPT-45).

| Klasse | Betekenis | Gevolgen |
|---|---|---|
| **Openbaar deelbaar** | mag buiten de organisatie worden gedeeld | geen watermerk · vrije link toegestaan · geen persoonsgegevens van derden |
| **Intern** | binnen de organisatie, voor wie er rol-matig bij hoort | geen watermerk · delen binnen de organisatie · niet extern zonder besluit |
| **Vertrouwelijk** | voor een **benoemde** ontvanger | watermerk · ontvanger en doel verplicht (BLK-12) · geldigheidsdatum · verstrekking gelogd · alleen via beveiligde link |
| **Medisch-vertrouwelijk** | gezondheidsgegevens | alles van vertrouwelijk, plus: uitsluitend met vastgelegde toestemmingsgrond, uitsluitend naar bevoegde ontvangers, nooit als bijlage, en nooit doorgegeven aan een algemeen rapport |

> **Open punt.** De klassenreeks en hun exacte namen zijn hier als werkbare indeling vastgelegd en vragen bevestiging (open afhankelijkheid 5 uit het kerndocument). De **werking** per klasse is niet vrijblijvend; alleen de benaming en het aantal kunnen nog wijzigen.

**RPV-02 — Classificatie is een eigenschap van het rapporttype**, niet een keuze per keer. De inhoudsregels leggen per type de standaardklasse vast. Een gebruiker mag verzwaren, nooit verlichten.

**RPV-03 — Verzwaring door inhoud.** Komt er een gezondheidsgegeven in een document dat als intern begon, dan wordt het document automatisch medisch-vertrouwelijk. Zwaarste inhoud bepaalt de klasse.

**RPV-04 — Geen inflatie.** Een label dat overal staat, wordt genegeerd. "Vertrouwelijk" wordt niet gebruikt als algemeen voorzorgsstempel op interne stukken.

---

## 2. Wat in een rapport mag

**RPV-05 — Bevoegdheid van beide kanten.** Een gegeven mag alleen in een rapport wanneer **zowel de opsteller als de ontvanger** ervoor bevoegd is. Bevoegdheid van de opsteller alleen is niet genoeg.

**RPV-06 — Geen verborgen velden.** Wat niet zichtbaar in het document staat, gaat er ook niet in mee — niet in de metadata, niet in een bijlage, niet in een ingesloten databestand. Een export bevat precies wat de preview toonde.

**RPV-07 — Geen gezondheidsgegevens in algemene rapporten.** Club-, team-, aanwezigheids-, trainings- en materiaalrapporten bevatten geen medische gegevens, geen diagnoses, geen behandelinformatie en geen afmeldredenen die een gezondheidsgegeven prijsgeven (RCR-24).

**RPV-08 — Uitkomst in plaats van reden.** Waar een niet-medische rol iets moet weten, ontvangt hij de **geschiktheidsuitkomst** — inzetbaar, beperkt inzetbaar, niet inzetbaar, met een geldigheidsdatum. Niet de onderliggende gegevens. Dit is de documentversie van dezelfde regel die op het scherm geldt.

**RPV-09 — Geen cross-organisatiegegevens.** Nooit gegevens van een andere club, een ander team, een ander kind of een ander account in hetzelfde document. Ook niet als de opsteller bij beide organisaties hoort.

**RPV-10 — Minderjarigen.** Geen gewichts- of calorieadvies (RCR-25). Rapporten over een minderjarige gaan naar de rechthebbende ouder of verzorger; de minderjarige zelf ziet wat bij zijn leeftijd past. Toestemming van de club vervalt bij 18 jaar, en daarmee ook de grondslag voor verstrekking op basis van die toestemming.

**RPV-11 — Derden in beeld.** Namen van andere sporters verschijnen alleen waar de gedeelde context dat rechtvaardigt (een selectie, een groepsuitslag). Geaggregeerde cijfers worden niet getoond wanneer de groep zo klein is dat ze naar één persoon herleidbaar zijn.

**RPV-12 — AI-tekst valt onder dezelfde grenzen.** Een AI-samenvatting mag geen gegeven bevatten dat de ontvanger niet mag zien, en verzint niets om een gat te vullen (RPT-65).

---

## 3. Ontvanger, doel en geldigheid

**RPV-13 — Ontvanger en doel vastleggen.** Bij vertrouwelijk en medisch-vertrouwelijk staan ontvanger en doel in het document én in de vastlegging. "Voor intern gebruik" is geen doel.

**RPV-14 — Geldigheidsdatum.** Vertrouwelijke documenten dragen een geldigheids- of vervaldatum. Na die datum is het document niet ongeldig als papier, maar wel als grond voor een beslissing — en dat staat er zo in.

**RPV-15 — Toestemming is een grond, geen vinkje.** Bij medisch-vertrouwelijke documenten staat waarop de verstrekking berust en wanneer die grond is gegeven.

**RPV-16 — Intrekking werkt vooruit.** Wordt een toestemming ingetrokken, dan vervalt de grond voor nieuwe verstrekkingen en voor bestaande gedeelde links (RPV-21). Een reeds gedownload document kan Sparki niet terughalen — dat wordt in het document zelf ook niet gesuggereerd.

---

## 4. Delen, links en logging

**RPV-17 — Drie manieren van verspreiden.** Download · e-mailbijlage · beveiligde link. Per klasse:

| Klasse | Download | Bijlage | Beveiligde link |
|---|---|---|---|
| Openbaar deelbaar | ✔ | ✔ | ✔ |
| Intern | ✔ | ✔ binnen de organisatie | ✔ |
| Vertrouwelijk | ✔ voor de ontvanger | ✖ | ✔ verplicht |
| Medisch-vertrouwelijk | ✔ voor de bevoegde ontvanger | ✖ | ✔ verplicht |

**RPV-18 — Beveiligde link.** Niet raadbaar, gebonden aan de ontvanger, met een verloopmoment, intrekbaar, en niet doorstuurbaar zonder dat dat zichtbaar is.

> **Open punt.** De concrete verloopduur is een productbesluit dat nog niet is genomen. Het mechanisme wordt configureerbaar gebouwd met een expliciet gemarkeerd voorstel, niet met een stilzwijgende standaardwaarde (open afhankelijkheid 3 uit het kerndocument).

**RPV-19 — Ingetrokken toegang werkt onmiddellijk.** Zodra toegang wordt ingetrokken, opent de link niet meer — en de QR-code die ernaar verwijst evenmin (RPT-21). Een link die blijft werken na intrekking is een directe herstelgrond.

**RPV-20 — Wat gelogd wordt.** Genereren · downloaden · delen · openen van een gedeelde link · intrekken. Per gebeurtenis: wie, wanneer, welk document-ID, en bij inzage in andermans gegevens ook de grond.

**RPV-21 — Logging is geen inhoud.** Het logboek bevat het document-ID en de handeling, niet de inhoud van het rapport.

**RPV-22 — Watermerk.** Verplicht bij vertrouwelijk en medisch-vertrouwelijk, op elke pagina, met de ontvanger herkenbaar. Vorm en plaatsing volgen `BRAND_IDENTITY_01`; de voorwaarde staat hier.

---

## 5. Preview en goedkeuring

**RPV-23 — Preview toont de werkelijkheid.** De preview toont het rapporttype, de ontvanger, de opsteller, de afzender, de inbegrepen en de **uitgesloten** onderdelen, de privacyclassificatie, de logo's en co-branding, de contactgegevens, de bestandsnaam en de documentdatum. Een afwijking tussen preview en PDF is een fout (RPT-42).

**RPV-24 — Waarschuwing bij gevoelige inhoud.** Bevat het document gezondheidsgegevens of gegevens van een minderjarige, dan staat dat in de preview als expliciete waarschuwing — vóór genereren, niet erna.

**RPV-25 — Wat de gebruiker kan.** Previewen · onderdelen aan- of uitzetten waar toegestaan · ontvanger controleren · bestandsnaam controleren · annuleren zonder export · definitief genereren · daarna pas downloaden of delen.

**RPV-26 — Uitzetten kan alleen naar beneden.** Een gebruiker kan onderdelen weglaten, nooit onderdelen toevoegen waarvoor hij niet bevoegd is.

**RPV-27 — Annuleren laat niets achter.** Geen document, geen logregel behalve de vaststelling dat er is geannuleerd, geen half bestand.

**RPV-28 — Geen generatie zonder kerngegevens.** Ontbreken de gegevens die de belofte dragen, dan wordt niet gegenereerd — met de reden en de verantwoordelijke erbij (RPT-58, RPT-59).

---

## 6. Bewaren en verwijderen

**RPV-29 — Rapporten verwijzen naar het bewaarbeleid.** Geen enkel rapporttype noemt een eigen termijn. De termijnen worden centraal vastgesteld en zijn nog niet bepaald.

> **Open punt, blokkerend voor betaalde publieke release.** Zes bewaartermijnen liggen bij jurist of accountant: profiel- en accountdata na verwijdering · betalings- en factuuradministratie · auditlogs en fraudedossiers · communicatie en supporttickets · gezondheids- en hersteldata · back-uprotatie voor verwijderde accounts. Bouwen kan (de matrix is configureerbaar); een betaalde publieke release niet zolang deze onbepaald zijn.

**RPV-30 — Onveranderlijkheid.** Een gegenereerd rapport is een momentopname en verandert niet mee met latere wijzigingen in gegevens, contactgegevens of templates (RPT-51, TPL-08).

**RPV-31 — Verwijderen van de betrokkene.** Wordt een account verwijderd, dan volgen de bijbehorende rapporten het bewaarbeleid van hun categorie — niet automatisch dat van het account. Een factuur en een trainingsrapport hebben niet dezelfde termijn.

**RPV-32 — Terugvindbaarheid blijft binnen de rechten.** Een document is terug te vinden op document-ID (RPT-47), maar alleen door wie er op dat moment bevoegd voor is. Terugvindbaarheid is geen omweg om ingetrokken toegang te herstellen.

---

## 7. Directe afkeurgronden

Onafhankelijk van de rest van de uitkomst:

1. Verkeerde ontvanger.
2. Verboden data in het document.
3. Gezondheidsgegevens in een algemeen club-, team- of trainingsrapport.
4. Cross-organisatie- of cross-accountgegevens in één document.
5. Verborgen velden meegeëxporteerd.
6. Gedeelde link blijft werken na intrekking.
7. Preview wijkt af van de gegenereerde PDF.
8. Verstrekking van een medisch-vertrouwelijk document zonder vastgelegde toestemmingsgrond.
9. Gewichts- of calorieweergave bij een minderjarige.

---

## 8. Open punten

1. **Klassenreeks** — indeling werkbaar vastgelegd, benaming en aantal vragen bevestiging.
2. **Verloopduur van gedeelde links** — productbesluit, nog open.
3. **Zes bewaartermijnen** — juridisch, blokkerend voor betaalde publieke release.
4. **Wie mag welk rapporttype delen** — hoort bij `CLUB_RECHTEN_01`; hier toegepast, niet vastgesteld.
5. **Medische classificatie per rapporttype** — de indeling in de inhoudsregels volgt de bestaande rolgrenzen en vraagt bevestiging.

---

*Einde `SPARKI_REPORT_PRIVACY_STANDARD.md`.*
