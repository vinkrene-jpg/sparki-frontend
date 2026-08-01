# AI_KWALITEIT_01 — TAAL, TOON, ONZEKERHEID EN BRONVERMELDING

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


**Uitvoerder:** Replit · **Type:** breed domeinpakket · **Startcommit:** actuele `main`, bevestig de SHA
**Status:** voorbereid werk. Start pas na expliciete vrijgave door René.
**Herkomst:** deel 3 van de opsplitsing van `AI_GOVERNANCE_01`. Dekt data-trust in antwoorden, taal en toon, onzekerheid en antwoordvormen, en de kwaliteitsweergave voor beheer.

## Doel

Elk AI-antwoord is in begrijpelijk Nederlands, toont waarop het is gebaseerd, en is eerlijk over wat het niet weet. Wat de AI niet kan onderbouwen, zegt hij niet.

## Buiten scope

Veiligheidsgrenzen en weigeringen (`AI_GRENZEN_01`). Geheugen, toestemming, tools en logging (`AI_CONTEXT_01`). Pakketrechten. Geen nieuwe AI-provider, geen nieuw model, geen herontwerp van schermen.

## 0. Bestaande onderdelen — hergebruiken, niet opnieuw bouwen

| Bestaand | Vindplaats | Draagt al |
|---|---|---|
| Uitvoercontrole en weigering | `lib/ai/gateway.ts` — `AiOutputRejectedError` L374, `recordRejectedOutput` L586, `expectJsonObject` L467 | afgekeurde uitvoer bestaat al als mechanisme |
| Terugvalregistratie | idem — `recordFallbackUsed` L856 | wanneer de AI niet leverde |
| Lengtebegrenzing | idem — `limitText` L456 | antwoordlengte |
| Aanroeplog | `schema/ai-gateway.ts` — `ai_call_logs` L31 | basis voor de kwaliteitsweergave |
| Ontbrekende invoer | `schema/ai-memory.ts` — `ai_observations.missingData` | waarom een advies uitbleef |
| Tegenstrijdigheid en dubbeling | `engines/observation/contradiction.ts`, `content-dedupe.ts` | bestaande kwaliteitscontroles |
| Herkomst tonen | `routes/data-origin.ts` — `/explain/session/:id`, `/explain/observation/:id`, `/explain/computation/:type` | bronvermelding bestaat al |
| Taalregels | `docs/COPY_DOCTRINE.md`, `docs/SPARKI_AI_REVIEW_GOVERNANCE.md` | vastgelegde toon- en taalafspraken |
| Tests | `test:analysis-quality`, `test:observation`, `test:ai-gateway`, `test:source-quality` | vertrekpunt |

**Bronvermelding en uitvoerafkeuring bestaan al.** Dit pakket maakt ze zichtbaar en consistent; het bouwt ze niet opnieuw.

## 1. Herstelpunten

**1.1 Bronvermelding in het antwoord.** Elk persoonlijk advies of getal in een AI-antwoord is herleidbaar via de bestaande uitlegendpoints. Kan de AI de bron niet noemen, dan noemt hij het getal niet. Geen "op basis van je gegevens" zonder dat die gegevens aanwijsbaar zijn.

**1.2 Onzekerheid is zichtbaar, niet weggeschreven.** Onderscheid tussen: zeker op basis van eigen data · waarschijnlijk, met beperkte data · onbekend. Een onbekend antwoord is een geldig antwoord. **Geen zelfverzekerde formulering over een onzekere uitkomst.**

**1.3 Ontbrekende data wordt benoemd.** Wanneer een advies uitblijft, zegt de AI **welke gegevens ontbreken en wat de gebruiker kan doen** — via `missingData`, niet via een vage zin.

**1.4 Taal en toon.** Nederlands, begrijpelijk, zonder Engelse restanten in gebruikersteksten. Rustig van toon: geen aansporing, geen schuldgevoel, geen urgentie die er niet is. Nederlandse namen in de interface, technische sleutel klein erachter waar die nodig is.

**1.5 Antwoordvorm.** Lengte past bij de vraag. Geen opsomming waar een zin volstaat, geen essay waar een getal wordt gevraagd. Hergebruik `limitText` in plaats van een eigen begrenzing.

**1.6 Tegenstrijdigheid en herhaling.** Een advies dat een eerder advies tegenspreekt wordt herkend en uitgelegd, niet stil vervangen. Hergebruik `contradiction.ts` en `content-dedupe.ts`.

**1.7 Kwaliteitsweergave voor beheer.** Eén weergave op basis van `ai_call_logs`: hoeveel antwoorden zijn afgekeurd, hoe vaak is teruggevallen, welke doelen falen het vaakst. **Geen gespreksinhoud** in die weergave — alleen doelen, codes en aantallen.

## 2. Tests

1. Persoonlijk getal zonder herleidbare bron wordt niet getoond.
2. Getoond getal is opvraagbaar via het uitlegendpoint en klopt.
3. Beperkte data levert een expliciet onzeker antwoord, geen zelfverzekerde zin.
4. Onbekend is een geldig antwoord en wordt als zodanig gebracht.
5. Uitblijvend advies benoemt welke gegevens ontbreken en wat te doen.
6. Geen Engelse restanten in gebruikersteksten.
7. Toon bevat geen aansporing, schuld of valse urgentie.
8. Antwoordlengte volgt `limitText`, geen eigen begrenzing.
9. Tegenstrijdig advies wordt herkend en uitgelegd.
10. Dubbel advies wordt niet twee keer getoond.
11. Afgekeurde uitvoer wordt geregistreerd via het bestaande mechanisme.
12. Terugval wordt geregistreerd en is zichtbaar in de kwaliteitsweergave.
13. De kwaliteitsweergave bevat geen gespreksinhoud.
14. Directe API-aanroep levert dezelfde bronvermelding als de interface.
15. Bestaande kwaliteitstests blijven groen.

## 3. Acceptatiecriteria

1. Geen persoonlijk getal zonder aanwijsbare bron.
2. Drie zekerheidsniveaus zijn onderscheiden en zichtbaar.
3. Ontbrekende data wordt benoemd, niet verzwegen.
4. Nederlands, rustig, zonder valse urgentie.
5. Afkeuring en terugval lopen via de bestaande mechanismen.
6. Kwaliteitsweergave zonder gespreksinhoud.
7. Alle bestaande tests groen; typecheck exit 0.

## 4. Bewijsformat

Per regel: commando, resultaat, exitcode. Verder: drie antwoorden met daarnaast hun uitlegendpoint-uitvoer · één voorbeeld per zekerheidsniveau · de kwaliteitsweergave met aantallen en zonder inhoud · een lijst gecorrigeerde Engelse of urgente teksten · start- en eindcommit · gewijzigde bestanden.

## 5. Stopcondities

- een bestaand advies steunt op een waarde waarvan de herkomst niet vast te stellen is;
- zekerheidsniveaus zijn niet af te leiden uit de bestaande engines;
- de kwaliteitsweergave vereist gespreksinhoud om bruikbaar te zijn;
- een bestaande kwaliteitstest wordt onhoudbaar.

## 6. Afhankelijkheden

| Nodig | Bron | Blokkerend? |
|---|---|---|
| Uitlegendpoints en `computation_traces` | bestaand / `DATA_TRUST_01` | **ja** — zonder herkomst geen bronvermelding |
| `AiOutputRejectedError`, `recordFallbackUsed`, `limitText` | bestaand | ja |
| `ai_observations.missingData` | bestaand | ja voor 1.3 |
| Veiligheidsgrenzen | `AI_GRENZEN_01` | nee |
| Geheugen en logging | `AI_CONTEXT_01` | nee — maar de kwaliteitsweergave leest `ai_call_logs`, stem af |

## 7. Herstelprotocol

Alleen de benoemde blokkade herstellen, op een nieuwe commit vanaf de afgekeurde commit. **Een tekstuele fout wordt tekstueel hersteld** — geen herstructurering van engines om een zin te repareren. Productregel of test nooit aanpassen om een afkeuring te laten verdwijnen.

Hertesten: het afgekeurde scenario, alles wat dezelfde engine of hetzelfde antwoordtype raakt, plus `test:analysis-quality`, `test:observation`, `test:ai-gateway` en typecheck. Betreft de fix aantoonbaar alleen een geïsoleerde teksttemplate, dan volstaat het betrokken scenario plus de vaste bewijsset.

**Uitzonderingslijst — hier blijft een fout niet lokaal:** de bronvermeldingslaag en de uitlegendpoints · de zekerheidsbepaling · `AiOutputRejectedError` en de terugvalregistratie. Raakt de fix een van deze drie, dan wordt het hele pakket hertoetst.

Na twee herstelronden op dezelfde blokkade: naar René.

## 8. Documentatie

`docs/SPARKI_AI_ANTWOORDKWALITEIT.md` — zekerheidsniveaus, bronvermelding, toonregels en de kwaliteitsweergave.
