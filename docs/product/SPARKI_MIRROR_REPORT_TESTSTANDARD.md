# SPARKI — MIRROR RAPPORT-TESTSTANDAARD v1.0

> **Vaste werkinstructie:** `docs/product/MIRROR_WERKWIJZE_01.md` (MW-01 t/m MW-20) geldt
> automatisch mee bij elke Mirror-opdracht: rapporteer herstelpunten aan Replit,
> samenhangvragen aan Claude, René krijgt per pakket één regel in gewone taal;
> nooit stilstaan, niets zelf oplossen.
>
> **Vast contextblok (02-08-2026 — geldt voor elke Mirror-toets)**
> Lees vóór het toetsen eerst `docs/besluiten/BESLUITEN_VOOR_REPLIT_2026-08-02.md` en
> `docs/besluiten/BOUWSTRAAT_2026-08-02.md`. Daarin staat wat als productbesluit vastligt
> en waar het te toetsen onderdeel in de bouwvolgorde zit.
>
> **Deze stukken zijn context, geen bewijs.** Ze vertellen wat de bedoeling en de prioriteit
> is — ze zeggen niets over wat er werkelijk gebouwd is. Wat Mirror toetst, stelt Mirror
> zelf vast op een vaste SHA. Wijkt de werkelijkheid af van een besluit, dan is dat een
> **bevinding**, geen aanleiding om het besluit aan te passen.
>
> Komt Mirror iets tegen dat buiten de opdracht valt maar wél een besluit raakt, dan meldt
> Mirror dat apart onder **"Signalen buiten scope"** — Mirror lost het niet zelf op.


> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Technische code:** `REPORT_DESIGN_STANDARD_01` — oplevering 5 van 5
**Hoort bij:** de vier voorgaande documenten van deze reeks (alle bindend)
**Status:** BINDEND, afgeleid. Geen nieuwe `RPT`-, `TPL`-, `BLK`-, `RT`-, `RCR`- of `RPV`-codes.
**Datum:** 1 augustus 2026

---

## 0. Waarvoor dit document dient

Mirror toetst niet of de PDF opent. Mirror toetst of het rapport doet wat het belooft, aan de juiste ontvanger, met de juiste gegevens, en of het achteraf navolgbaar is.

**Codes:** `MRT-nn`. Iedere bevinding verwijst naar een MRT-code én naar de onderliggende `RPT`, `TPL`, `BLK`, `RT`, `RCR` of `RPV`. Een bevinding zonder code gaat terug naar de indiener.

---

## 1. Toetsprincipes

**MRT-01 — Vaste gepushte SHA.** Toetsen gebeurt op één vaste commit. Wijzigt de code tijdens de toets, dan vervalt de toets.

**MRT-02 — Echt gegenereerd document.** Getoetst wordt een werkelijk gegenereerde PDF, niet een ontwerp, een schets of een preview alleen.

**MRT-03 — Realistisch gevulde gegevens.** Een leeg testaccount bewijst niets. Ook getoetst: het zwaarste realistische geval — lange periode, volle groep, lange tabel.

**MRT-04 — Per rapporttype.** De eenheid van toetsing is het rapporttype (`RT`), niet "de PDF-functie".

**MRT-05 — Alle drie de uitvoervormen.** PDF, printweergave en digitale preview komen uit dezelfde samenstelling en worden alle drie bekeken (RPT-07).

**MRT-06 — Beide kanten van de rol.** Getoetst met een account dat het rapport mág ontvangen én met een account dat dat niet mag.

---

## 2. Toetsomgeving

| Onderdeel | Eis |
|---|---|
| Formaten | A4 portret; landschap waar het rapporttype dat vastlegt |
| Weergave | desktoppreview · mobiel openen · e-mailbijlage · browserpreview · download |
| Print | kleur en zwart-wit |
| Accounts | bevoegde ontvanger · onbevoegd account · minderjarige waar van toepassing · medische rol waar van toepassing |
| Data | realistisch gevuld · één geval met ontbrekende gegevens · één geval met nul rijen |
| Verboden | mockdata, demo-accounts met verzonnen namen, screenshots als bewijs zonder bijbehorende stappen |

---

## 3. Toetsdimensies

**MRT-07 — Templateversie.** Het document draagt de juiste, actuele templateversie in de metadata (RPT-45, TPL-07).
**MRT-08 — Juiste rapportsoort.** Het gegenereerde type komt overeen met wat de gebruiker koos, inclusief de bijbehorende template (RT-xx, TPL-xx).
**MRT-09 — Merkplaatsing.** Logo op de vaste positie, compacte variant op vervolgpagina's, vrije ruimte gerespecteerd — conform `BRAND_IDENTITY_01`. Waar het definitieve merk nog ontbreekt, is de locatie gereserveerd en gemarkeerd (RPT-11).
**MRT-10 — Afzender en opsteller.** De vier rollen — platform, opsteller, organisatie, onderwerp — staan afzonderlijk en zijn niet door elkaar gehaald (RPT-29, RPT-30).
**MRT-11 — Geen verklaring namens Sparki.** Bij een door een derde opgesteld rapport wekt het document niet de indruk dat Sparki een medische, juridische of trainersverklaring afgeeft (RPT-32).
**MRT-12 — Contactgegevens.** Sparki-support altijd; organisatie- en trainergegevens waar van toepassing; ontbrekende lagen vervallen zonder opvulling (RPT-34, RPT-49); geen privégegevens (RPT-50).
**MRT-13 — Co-branding.** Extern logo naast of onder Sparki, nooit in plaats van; niet aanwezig op documenten waarvan de organisatie niet de opsteller is (RPT-23, RPT-33, TPL-06).
**MRT-14 — Privacyclassificatie.** Eén klasse, zichtbaar in kop, voettekst en metadata; verzwaring door inhoud correct toegepast (RPV-01 t/m RPV-04).
**MRT-15 — Alleen toegestane data.** Opsteller én ontvanger bevoegd; geen verborgen velden; geen cross-organisatiegegevens (RPV-05, RPV-06, RPV-09).
**MRT-16 — Gezondheidsgegevens.** Niet in algemene rapporten; naar niet-medische rollen uitsluitend de geschiktheidsuitkomst (RPV-07, RPV-08).
**MRT-17 — Minderjarigen.** Geen gewichts- of calorieweergave; verstrekking naar de rechthebbende (RPV-10, RCR-25).
**MRT-18 — Geen mockdata.** In geen enkele sectie, grafiek of tabel (RCR-02).
**MRT-19 — Grafieken leesbaar.** Titel, eenheid, periode, bron, legenda; geen afgesneden labels; zwart-wit begrijpelijk; as niet misleidend (RCR-07 t/m RCR-15).
**MRT-20 — Tabellen correct.** Kolomkoppen herhaald, logische afbreking, totalen en afwijkingen gemarkeerd in woord én vorm (RCR-16 t/m RCR-20).
**MRT-21 — Paginering.** "Pagina x van y" op elke pagina; geen sectiekop als laatste regel; geen lege pagina na een vervallen sectie (RPT-17, RPT-38).
**MRT-22 — Mobiel leesbaar.** Opent en leest op een telefoon zonder horizontaal scrollen door de tekstkolom (RPT-37).
**MRT-23 — Printbaar en zwart-wit begrijpelijk.** Geen betekenisverlies zonder kleur (RPT-36).
**MRT-24 — Links en QR.** Links klikbaar in digitale weergave, uitgeschreven in print; QR leidt naar de actuele digitale versie (RPT-40, RPT-21).
**MRT-25 — Bestandsnaam.** Volgens het vaste patroon, leesbaar, geen technische ID als enige naam (RPT-44).
**MRT-26 — Metadata.** Alle elf velden aanwezig, inclusief **templateversie** en **document-ID** (RPT-45, RPT-46).
**MRT-27 — Eén waarheid.** Inhoud identiek aan scherm, API en databron (RPT-09, RCR-01).
**MRT-28 — Ontbrekende data eerlijk verwerkt.** Optionele sectie vervalt zonder lege ruimte; betekenisvol ontbreken wordt benoemd; kernbelofte niet waar te maken betekent blokkeren met reden en verantwoordelijke (RPT-58, RPT-59).
**MRT-29 — Preview komt overeen met de PDF.** Inclusief in- en uitgesloten onderdelen, ontvanger, classificatie en bestandsnaam (RPT-42, RPV-23).
**MRT-30 — Waarschuwing bij gevoelige inhoud.** Vóór genereren, niet erna (RPV-24).
**MRT-31 — Annuleren laat niets achter.** Geen half bestand, geen document, wel de vaststelling dat er is geannuleerd (RPV-27).
**MRT-32 — Gedeeld document opent correct** voor de bevoegde ontvanger, in alle drie de weergaven (RPV-17, RPV-18).
**MRT-33 — Ingetrokken toegang werkt.** Link en QR openen niet meer na intrekking (RPV-19).
**MRT-34 — Logging.** Genereren, downloaden, delen, openen en intrekken zijn vastgelegd met wie, wanneer, welk document-ID, en bij inzage in andermans gegevens ook de grond (RPV-20).
**MRT-35 — Later terug te vinden.** Op document-ID, binnen de rechten van dat moment (RPT-47, RPV-32).
**MRT-36 — Onveranderlijkheid.** Wijzig een contactgegeven of een template en genereer opnieuw: het oude document is ongewijzigd (RPT-51, TPL-08, RPV-30).
**MRT-37 — AI-markering.** AI-tekst is bij de tekst zelf gemarkeerd, met gegevens, periode en onzekerheid; niets verzonnen (RPT-62 t/m RPT-65, BLK-11).
**MRT-38 — Geen AI-tekst in operationele dagstukken.** RT-12, RT-13 en RT-14 bevatten geen AI-gegenereerde tekst (RCR-26).
**MRT-39 — Rapportbelofte waargemaakt.** De belofte uit de inhoudsregels wordt door het document werkelijk ingelost; geen data zonder conclusie of vervolgstap, met uitsluitend RT-22 als uitzondering (RPT-53 t/m RPT-56, RCR-22).
**MRT-40 — Toegankelijkheid.** Selecteerbare tekst, leesbare kopstructuur voor een schermlezer, documenttitel in de metadata, tekstalternatief bij betekenisdragende afbeeldingen (RPT-39).
**MRT-41 — Bestandsgrootte.** Verstuurbaar als bijlage waar dat is toegestaan; te groot betekent beveiligde link, nooit stil ingekorte inhoud (RPT-41).

---

## 4. Directe afkeurgronden

**MRT-42.** Onafhankelijk van de rest van de uitkomst:

1. Verkeerde ontvanger.
2. Verboden data in het document.
3. Gezondheidsgegevens in een algemeen rapport.
4. Fout logo of foute afzender.
5. Mockdata.
6. Lege of misleidende grafiek.
7. Preview wijkt af van de PDF.
8. Bestand later niet terug te vinden.
9. Gedeelde link blijft werken na intrekking.
10. Rapport belooft analyse maar toont alleen ruwe data.
11. Cross-organisatie- of cross-accountgegevens in één document.
12. Verborgen velden meegeëxporteerd.
13. Medisch-vertrouwelijk document verstrekt zonder vastgelegde toestemmingsgrond.
14. Gewichts- of calorieweergave bij een minderjarige.
15. AI-tekst in een operationeel dagstuk.

---

## 5. Uitkomst en rapportage

**MRT-43 — Statuswoorden.** Voor een bouwpakket: `PROVEN_READY` · `BUILT_UNPROVEN` · `PARTIAL` · `OPEN` · `DEFERRED`. Voor een documentpakket: `MIRROR_PROVEN`, implementatie blijft `OPEN`, daarna `RENE_APPROVED`.

**MRT-44 — Bewijs per dimensie.** Wat is gedaan, op welke SHA, met welk account, in welke weergave, en met welke uitkomst.

**MRT-45 — Bevindingssjabloon.**

| Veld | Inhoud |
|---|---|
| MRT-code | welke toets |
| Onderliggende code | `RPT` / `TPL` / `BLK` / `RT` / `RCR` / `RPV` |
| Rapporttype | RT-xx |
| Rol en account | met welk account, bevoegd of niet |
| SHA | de vaste commit |
| Weergave | PDF, print, preview, mobiel |
| Waargenomen | wat er gebeurde |
| Verwacht | wat de regel voorschrijft |
| Zwaarte | directe afkeur (MRT-42) of afkeur na weging |

**MRT-46 — Niet van toepassing is een uitkomst.** Met reden vastgelegd. Stilzwijgend overslaan maakt de toets ongeldig.

**MRT-47 — De poort.** Alle dimensies uitgevoerd of gemotiveerd niet van toepassing · geen directe herstelgrond · bewijs per dimensie op één vaste SHA · minimaal één rapporttype per template getoetst.

**MRT-48 — Bestaande uitdraaien.** Niet met terugwerkende kracht herbouwen; toetsen bij de eerstvolgende wijziging aan die uitdraai.

---

## 6. Consistentiecontrole over de vijf rapportdocumenten

Uitgevoerd over `SPARKI_REPORT_DESIGN_STANDARD_v1.0.md`, `SPARKI_REPORT_TEMPLATE_LIBRARY.md`, `SPARKI_REPORT_CONTENT_RULES.md`, `SPARKI_REPORT_PRIVACY_STANDARD.md` en dit document.

### 6.1 Codefamilies — geen overlap, geen gaten

| Familie | Bereik | Eigenaar |
|---|---|---|
| `RPT-01..67` | architectuur, merktoepassing, afzender, print, metadata, belofte | document 1 |
| `TPL-00..10` · `BLK-01..17` | templates en bouwstenen | document 2 |
| `RCR-01..26` · `RT-01..23` | inhoudsregels en rapporttypen | document 3 |
| `RPV-01..32` | privacy, toegang, delen, bewaren | document 4 |
| `MRT-01..48` | toetsing | document 5 |

Geen code komt in twee families voor; geen nummer is hergebruikt.

### 6.2 Behouden zoals gevraagd

- `RPT-01..67` ongewijzigd; documenten 3 t/m 5 verwijzen ernaar en breiden ze niet uit.
- De vierledige scheiding **platform / opsteller / organisatie / onderwerp** (RPT-29) is toegepast in TPL-06, BLK-03, elk rapporttype en MRT-10.
- **Templateversie en document-ID** blijven verplichte metadata (RPT-45, RPT-46), afgedwongen via TPL-00 punt 9 en getoetst in MRT-07 en MRT-26.
- **Rapporten zijn een onveranderlijke momentopname** (RPT-51), herhaald in TPL-08 en RPV-30, getoetst in MRT-36.
- **Geen AI-tekst in operationele dagstukken**: vastgelegd in de bouwsteenmatrix (BLK-11 in TPL-05), in RCR-26, per type bij RT-12, RT-13 en RT-14, en getoetst in MRT-38 met directe afkeur.
- **`BRAND_IDENTITY_01` als enige merkbron**: geen van de vijf documenten legt kleur, typografie, iconografie of logo vast. Document 1 hoofdstuk 11 is de verwijzingsindex.
- Geen nieuwe productbesluiten; geen code; Master Plan niet aangeraakt.

### 6.3 Kruisverwijzingen gecontroleerd

- Alle 23 rapporttypen wijzen naar een bestaande template (TPL-01 t/m TPL-06).
- Alle bouwstenen in de matrix van document 2 bestaan (BLK-01 t/m BLK-17).
- Alle classificaties in document 3 bestaan in de klassenreeks van RPV-01.
- De uitzondering op "geen data zonder conclusie" komt op precies één plek voor: RT-22, verankerd in RPT-55, RCR-22 en MRT-39.
- De afkeurgronden van document 4 (negen) zijn volledig opgenomen in MRT-42 (vijftien), samen met de zes uit de opdracht die daar nog niet in stonden.
- De zes open afhankelijkheden uit document 1 komen terug in document 4 hoofdstuk 8; er zijn geen open punten die in slechts één document staan.

### 6.4 Bevindingen

Drie punten die geen fout zijn maar wel expliciet vastliggen, zodat ze later niet als tegenstrijdigheid opduiken:

1. **De klassenreeks is een werkbare indeling, geen vastgesteld besluit.** De werking per klasse is bindend; benaming en aantal vragen bevestiging. Waar de inhoudsregels een classificatie per rapporttype noemen, is dat dus een toepassing van een nog te bevestigen reeks.
2. **Bewaartermijnen staan nergens als getal.** Ieder rapporttype verwijst naar het bewaarbeleid. Dat is bewust: de zes termijnen liggen bij jurist of accountant en zijn blokkerend voor een betaalde publieke release, niet voor de bouw.
3. **Twee rapporttypen dragen een classificatie die kan verschuiven met de inhoud** — RT-06 en RT-20 worden medisch-vertrouwelijk zodra de onderliggende gezondheidsgegevens erin komen (RPV-03). Dat is geen dubbele classificatie maar de verzwaringsregel in werking.

**Geen tegenstrijdigheden gevonden tussen de vijf documenten.**

---

*Einde `SPARKI_MIRROR_REPORT_TESTSTANDARD.md`. Hiermee is de reeks van vijf opleveringen bij `REPORT_DESIGN_STANDARD_01` compleet.*
