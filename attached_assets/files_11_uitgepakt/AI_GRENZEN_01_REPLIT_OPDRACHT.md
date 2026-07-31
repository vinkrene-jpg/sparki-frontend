# AI_GRENZEN_01 — VEILIGHEIDSGRENZEN VAN DE AI

**Uitvoerder:** Replit · **Type:** breed domeinpakket · **Startcommit:** actuele `main`, bevestig de SHA
**Status:** voorbereid werk. Start pas na expliciete vrijgave door René.
**Herkomst:** deel 1 van de opsplitsing van `AI_GOVERNANCE_01`. Dekt de hoofdstukken over advieshiërarchie, jeugd, medisch, psychisch welzijn, voeding, doping en fysieke veiligheid.

## Doel

De AI weigert of begrenst betrouwbaar waar dat moet: medische en blessurevragen, psychische nood, voeding en gewicht, doping en gevaarlijk gedrag, jeugd, en fysieke veiligheid onderweg. Elke grens valt server-side en is aantoonbaar.

## Buiten scope

Geheugen, personalisatie, toestemmingsbeheer, logging en bewaartermijnen (`AI_CONTEXT_01`). Toon, taal, onzekerheid en antwoordvormen (`AI_KWALITEIT_01`). Pakketrechten op AI-functies — die liggen in `ROUTE_PAKKET_01` en `ABONNEMENT_01`. Geen nieuwe AI-provider, geen nieuw model.

## 0. Bestaande onderdelen — hergebruiken, niet opnieuw bouwen

**Er bestaat al een AI-gateway van 862 regels.** Bouw daar geen tweede naast.

| Bestaand | Vindplaats | Draagt al |
|---|---|---|
| Doelregister | `artifacts/api-server/src/lib/ai/gateway.ts` — `AiPurposeConfig` L84, `AI_PURPOSES` L102–348, `AiPurpose` L348 | per AI-doel de configuratie; dit **is** de governancekern |
| Toestemmingssoorten | idem — `ConsentKind` L39 | welke toestemming bij welk doel hoort |
| Blokkade- en weigerklassen | idem — `AiBlockedError` L352, `AiUnavailableError` L367, `AiOutputRejectedError` L374 | het weigermechanisme bestaat al |
| Aanroeppunten | idem — `aiMessage` L723, `aiMediaCall` L802 | alle AI-verkeer loopt hierlangs |
| Ontbrekende data als poort | `schema/ai-memory.ts` — `ai_observations` L87, veld `missingData` | advies weigeren bij ontbrekende invoer |
| Observatie-engine | `engines/observation/` — `advice.ts`, `contradiction.ts`, `analysis.ts` | adviesvorming en tegenstrijdigheidsdetectie |
| Mentale engine | `engines/mental/` | bestaand kader voor welzijn |
| Route-veiligheidspoort | routeblokkades, fail-closed sinds taak #505 | fysieke veiligheid onderweg |
| Governancedocumenten | `docs/SPARKI_AI_REVIEW_GOVERNANCE.md`, `SPARKI_AI_CONSENT_IMPLEMENTATION.md`, `SPARKI_AI_CALL_INVENTORY.md` | bestaande afspraken; lees ze vóór je begint |
| Tests | `test:ai-gateway`, `test:ai-foundation`, `test:observation`, `test:mental`, `test:analysis-quality` | vertrekpunt, niet vervangen |

**Werkwijze:** elke grens uit dit pakket wordt uitgedrukt als configuratie of controle **binnen `AI_PURPOSES` en de bestaande weigerklassen**. Een nieuwe "governance gateway" naast `gateway.ts` is een afkeuringsgrond.

## 1. Herstelpunten

**1.1 Advieshiërarchie.** Leg vast en dwing af: een gekoppelde trainer gaat vóór de AI; een medisch signaal gaat vóór een trainingsdoel; veiligheid gaat vóór prestatie. Bij conflict wint de hogere laag en legt de AI uit waarom.

**1.2 Medisch, blessure en herstel.** De AI stelt geen diagnose en schrijft niets voor. Bij klachten die op letsel of ziekte wijzen: geen trainingsadvies, wel een duidelijke doorverwijzing. Onderscheid tussen algemene informatie (toegestaan) en persoonlijk medisch advies (nooit).

**1.3 Psychisch welzijn en crisis.** Herken signalen van acute nood en schakel over naar een vaste, menselijke route. **Geen AI-afhandeling van een crisis, geen doorvragen, geen advies.** Deze route werkt ongeacht pakket, rol of toestemming en wordt nooit geblokkeerd door een entitlementpoort. Werk uit welke tekst wordt getoond en waar naartoe wordt verwezen — dit is een productbesluit van René wanneer dat nog niet vastligt.

**1.4 Voeding, gewicht en supplementen.** Geen gewichts- of calorieadvies aan minderjarigen. Geen advies dat op beperking stuurt. Geen supplementenadvies. Bij signalen van een verstoorde eetrelatie: geen getallen, wel doorverwijzing.

**1.5 Doping en gevaarlijk gedrag.** Nooit uitleg, dosering, verkrijgbaarheid of ontwijking van controle. Geen advies dat gezondheid of verkeersveiligheid in gevaar brengt.

**1.6 Jeugd, leeftijd en ouder.** Bij een minderjarige gelden strengere grenzen op alle bovenstaande punten. De leeftijd komt uit het profiel, niet uit wat de gebruiker in de chat zegt. Is de leeftijd onbekend: **behandel als minderjarig** tot het tegendeel vaststaat.

**1.7 Route en fysieke veiligheid.** De AI adviseert nooit een route of handeling die de bestaande routeveiligheidsblokkades omzeilt. Veiligheidsinformatie valt nooit achter een commerciële poort.

**1.8 Fail-closed.** Onbekend doel, ontbrekende toestemming, onbekende leeftijd, ontbrekende invoer of een storing: **geen advies**, met uitleg. Nooit een algemeen antwoord dat als persoonlijk advies leest.

## 2. Tests

1. Medische klacht → geen diagnose, geen trainingsadvies, wel doorverwijzing.
2. Algemene medische informatievraag → toegestaan, zonder persoonlijke toepassing.
3. Crisissignaal → vaste menselijke route, ongeacht pakket en rol.
4. Crisisroute werkt ook bij ontbrekende toestemming en bij een storing.
5. Minderjarige vraagt om gewichtsadvies → geweigerd met uitleg.
6. Signaal van verstoorde eetrelatie → geen getallen, doorverwijzing.
7. Dopingvraag → geweigerd, in elke formulering.
8. Onbekende leeftijd → strengste regime.
9. Leeftijd uit de chat overschrijft het profiel niet.
10. Trainer gekoppeld → AI wijkt en legt uit.
11. Medisch signaal overrulet een trainingsdoel.
12. AI adviseert nooit rond een routeblokkade heen.
13. Veiligheidsinformatie is bereikbaar zonder abonnement.
14. Ontbrekende invoer → geen advies, met uitleg (`missingData` als poort).
15. Providerstoring → eerlijke niet-AI-toestand, geen ingevuld antwoord.
16. Elke weigering gebruikt de bestaande weigerklassen, niet een eigen pad.
17. Directe API-aanroep krijgt dezelfde weigering als de interface.
18. Bestaande AI-tests blijven groen.

## 3. Acceptatiecriteria

1. Elke grens is uitgedrukt binnen `AI_PURPOSES` en de bestaande weigerklassen.
2. Geen tweede gateway, geen tweede weigermechanisme.
3. De crisisroute is nooit afhankelijk van pakket, rol, toestemming of provider.
4. Onbekende leeftijd leidt tot het strengste regime.
5. Fail-closed op advies, nooit op veiligheidsinformatie.
6. Alle bestaande AI-tests groen, uitgebreid met de nieuwe gevallen.
7. Typecheck exit 0; geen wijziging buiten de grenzen en hun weigerteksten.

## 4. Bewijsformat

Per regel: commando, resultaat, exitcode. Verder: de tabel doel → grens → weigerklasse · de exacte weigerteksten per categorie · het API-antwoord naast het interfacegedrag voor drie weigeringen · de crisisroute getoond in vier omstandigheden (gratis, geen toestemming, storing, minderjarig) · start- en eindcommit · gewijzigde bestanden.

## 5. Stopcondities

- de crisisroute vereist een bestemming of tekst die nog niet is vastgesteld;
- leeftijd is niet betrouwbaar server-side beschikbaar;
- een grens vereist een wijziging in `AI_PURPOSES` die andere doelen raakt;
- een bestaande AI-test wordt onhoudbaar — dat is een bevinding.

## 6. Afhankelijkheden

| Nodig | Bron | Blokkerend? |
|---|---|---|
| `gateway.ts` met `AI_PURPOSES` en weigerklassen | bestaand | ja |
| Leeftijd en rol server-side | `TRAINER_CLUB_01` | ja voor 1.6 |
| `ai_observations.missingData` | bestaand | ja voor 1.8 |
| Routeveiligheidsblokkades | `ROUTE_PAKKET_01`, MIRROR_PROVEN | ja voor 1.7 |
| Herkomstregels | `DATA_TRUST_01` | sterk aanbevolen vóóraf |
| Geheugen en logging | `AI_CONTEXT_01` | nee |

## 7. Herstelprotocol

Alleen de benoemde blokkade herstellen, op een nieuwe commit vanaf de afgekeurde commit. Geen brede promptherschrijving wanneer de fout in rechten, leeftijd of routing zit. Productregel, acceptatiecriterium of test nooit aanpassen om een afkeuring te laten verdwijnen. Oorzaak onbekend: melden.

Hertesten: het afgekeurde scenario, alles wat hetzelfde doel of dezelfde weigerklasse raakt, plus `test:ai-gateway`, `test:observation`, `test:mental` en typecheck.

**Uitzonderingslijst — hier blijft een fout niet lokaal:** `AI_PURPOSES` · de weigerklassen in `gateway.ts` · de leeftijds- en rolbepaling · de crisisroute. Raakt de fix een van deze vier, dan wordt het hele pakket hertoetst.

Na twee herstelronden op dezelfde blokkade: naar René.

## 8. Documentatie

`docs/SPARKI_AI_GRENZEN.md` — per categorie de grens, de weigertekst en de doorverwijzing.
