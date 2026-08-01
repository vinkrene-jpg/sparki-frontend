# MEDIA_UITLEG_01 — README

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Technische code:** `MEDIA_UITLEG_01`
**Uitvoerder na goedkeuring:** Replit · **Toetser:** Mirror · **Eindvrijgever:** René
**Datum:** 1 augustus 2026 · **Status:** `OPEN` — niets gebouwd, niets gecommit, geen Replit-taak gestart.

> **Vervangt** het eerdere 5-delige concept van dezelfde dag. Dat concept is `INGETROKKEN`; dit pakket is de enige geldige versie.

---

## 1. Productbelofte

> Sparki maakt ingewikkelde functies en trainingsinhoud begrijpelijker en aantrekkelijker met rustige diepte, korte visuele uitleg en toegankelijke media, zonder de kernfunctie te vertragen, af te leiden of afhankelijk te maken van animatie of video.

Mirror toetst **deze hele belofte**, niet of een speler of animatie opent. Een fase die technisch werkt maar de belofte niet inlost, is niet geslaagd.

De belofte valt uiteen in vier toetsbare beweringen:

| # | Bewering | Waar het bewijs zit |
|---|---|---|
| B1 | Het wordt begrijpelijker | uitlegflow eindigt in een uitvoerbare hoofdactie; oefenkaart is zonder media volledig |
| B2 | Het wordt aantrekkelijker zonder druk | diepte alleen op vastgelegde momenten, nooit continu |
| B3 | De kernfunctie vertraagt niet | kernbediening werkt vóór media; één trage bron blokkeert nooit het scherm |
| B4 | Niemand is afhankelijk van animatie of video | alles identiek bruikbaar met beweging uit én media uit |

---

## 2. Documenten in dit pakket

| # | Document | Inhoud |
|---|---|---|
| 1 | `README.md` | dit document: belofte, grens, navigatie, leeswijzer |
| 2 | `MEDIA_UITLEG_01_ARCHITECTUUR.md` | doelarchitectuur A–E, motion- en dieptestandaard |
| 3 | `MEDIA_UITLEG_01_DATAMODEL.md` | contentcontract, gebruikersstatus, harde regels |
| 4 | `MEDIA_UITLEG_01_COMPONENTCONTRACTEN.md` | CMP-40 t/m CMP-44 volledig uitgewerkt |
| 5 | `MEDIA_UITLEG_01_RECHTEN_EN_ENTITLEMENTS.md` | pakketgrens, rollen, geen tweede engine |
| 6 | `MEDIA_UITLEG_01_TOEGANKELIJKHEID.md` | toegankelijkheidscontract en verminder beweging |
| 7 | `MEDIA_UITLEG_01_MEDIARECHTEN.md` | publicatiepoort, statussen, intrekken |
| 8 | `MEDIA_UITLEG_01_JEUGD_EN_VEILIGHEID.md` | harde poort minderjarigen en acute situaties |
| 9 | `MEDIA_UITLEG_01_REPLIT_OPDRACHTEN.md` | F0 t/m F11, elk met twintig verplichte velden |
| 10 | `MEDIA_UITLEG_01_MIRROR_TOETSEN.md` | Mirror-opdracht per fase, afkeurgronden |
| 11 | `MEDIA_UITLEG_01_TESTMATRIX.md` | apparaten, instellingen, netwerk, media, gebruikers, situaties |
| 12 | `MEDIA_UITLEG_01_AFHANKELIJKHEDEN.md` | wat wanneer klaar moet zijn |
| 13 | `MEDIA_UITLEG_01_HERSTELPROTOCOL.md` | rollback, herstel, schijnoplossingen |
| 14 | `MEDIA_UITLEG_01_SYNCHRONISATIEPATCH.md` | welke documenten bijwerken, geen Master Plan |
| 15 | `MEDIA_UITLEG_01_PILOTADVIES.md` | kandidaten met voordeel, risico, aanbeveling |
| 16 | `MEDIA_UITLEG_01_BEHEEROMGEVING.md` | hoe media later beheerd wordt |
| 17 | `MEDIA_UITLEG_01_RAPPORTAGE.md` | veilige metingen, wat niet gemeten wordt |
| 18 | `MEDIA_UITLEG_01_OPEN_AFHANKELIJKHEDEN.md` | wat echt open is, met eigenaar |
| 19 | `MEDIA_UITLEG_01_VERTAALTABEL.md` | CMP-40..44 · PAT-28..39 · MTS-50..69 naar fasen |
| 20 | `MEDIA_UITLEG_01_VERWIJZENDE_PAKKETTEN.md` | pakketten die later hiernaar verwijzen |

---

## 3. Harde pakketgrens

**`MEDIA_UITLEG_01` is eigenaar van:** de mobiele en gedeelde weergavelaag · motion- en dieptegedrag · CMP-40 t/m CMP-44 · mediaweergave · ondertiteling · tekstalternatief · posterbeelden · lage-resolutievarianten · bekeken-, voltooid- en overgeslagenstatus · opnieuw openen via Help · lazy loading · mediafoutafhandeling · de instelling Verminder beweging · Academy-navigatie en presentatiestructuur · rolgerichte presentatie · de technische contentkoppeling.

**`KENNIS_01` blijft exclusief eigenaar van:** lesinhoud · oefeninhoud · sportinhoudelijke beoordeling · bron · maker · licentie · leeftijdsclassificatie · doelgroep · veiligheidsinhoud · publicatiestatus · inhoudsversie · datum inhoudelijke controle.

**`BRAND_IDENTITY_01` blijft exclusief eigenaar van:** logo · kleur · typografie · iconografie · merkgebonden motion-uitstraling.

**De centrale entitlementlaag blijft exclusief eigenaar van** Gratis/Go/Compleet-toegang.

**Niet bouwen, in geen enkele fase:** een parallelle contentdatabase · een tweede rechtenlaag · een videobibliotheek per module · een motion-engine per scherm · een helpomgeving per functie.

---

## 4. Navigatie en vindplaats

```
Hulp & ondersteuning
└── Uitleg en Academy
    ├── Sparki gebruiken            — altijd gratis
    │   onboarding · routeplanner · GPX · navigatie · trainingen ·
    │   analyses · instellingen · abonnementen · veiligheid · toegankelijkheid
    └── Beter fietsen en trainen    — Sparki Compleet
        FTP · zones · herstel · intervaltraining · klimmen · dalen ·
        voeding · wedstrijdvoorbereiding · kracht · mobiliteit
```

**Geen zesde hoofditem. Geen stil toegevoegd menu.** De vijf vaste mobiele hoofditems blijven intact in aantal, naam, icoon en volgorde, voor alle rollen (MUX-14).

Verder vastgelegd, uitgewerkt in het architectuurdocument:

- **Deeplink** naar een specifieke les of uitleg, met een werkende terugweg naar het oorspronkelijke scherm (MUX-63, MUX-88).
- **Opnieuw openen via Help**, ook na overslaan.
- **Rol- en pakketfiltering**: wat de gebruiker niet heeft, verschijnt niet als lokkertje.
- **Zoekfunctie** binnen Academy, volgens het bestaande zoekpatroon (CMP-17).
- **Voortgang** en **laatst bekeken**, server-side bewaard.
- **Favorieten** alleen als er al een favorietenpatroon bestaat — F0 stelt dat vast. Zo niet: niet bouwen.

---

## 5. Bindende bronnen

`SPARKI_MOBILE_UX_STANDARD_v1.4.md` · `SPARKI_MOBILE_COMPONENT_LIBRARY.md` · `SPARKI_ROLE_BASED_MOBILE_FLOWS.md` · `SPARKI_MOBILE_PATTERNS.md` · `SPARKI_MIRROR_MOBILE_TESTSTANDARD.md` · `SPARKI_MEDIA_UITLEG_PRODUCTBESLUIT.md` · `BRAND_IDENTITY_01` · `KENNIS_01` · de centrale rechten- en entitlementlaag · bestaande data-trustregels · bestaande privacy-, jeugd- en veiligheidsregels · `REPORT_DESIGN_STANDARD_01` waar media- of gebruiksrapporten worden geëxporteerd.

**Uitsluitend bestaande codes:** CMP-40..44 · PAT-28..39 · MTS-50..69. Dit pakket voegt geen MUX-, CMP-, PAT- of MTS-code toe.

---

## 6. Twee regels die overal gelden

**R-A. Animatie uit betekent exact dezelfde functionaliteit.** Geen extra tik, geen omweg, geen verdwenen knop, en geen aparte inferieure variant.

**R-B. Geen mock-, demo- of verzonnen gegevens.** Niet in een scherm, niet in een voorbeeld, niet "even voor de demo".

Beide zijn directe herstelgronden en worden niet per fase herhaald.

---

## 7. Leeswijzer voor Replit

1. Lees dit README en de harde pakketgrens.
2. Lees `..._REPLIT_OPDRACHTEN.md` voor de fase die is vrijgegeven — en **alleen** die fase.
3. Lees de vier ondersteunende contracten die de fase noemt (architectuur, datamodel, componentcontract, rechten).
4. Bouw. Wijk niet af; is iets onduidelijk, dan is dat een open besluit en gaat het terug naar René, niet naar een eigen keuze.
5. Lever op met bewijs en een vaste SHA.

**Waar F0-uitkomsten nodig zijn**, staat dat in de fase als **input**, niet als beslissing. Replit vult geen aanname in waar F0 iets niet heeft gevonden.

---

*Deel 1 van 20.*
