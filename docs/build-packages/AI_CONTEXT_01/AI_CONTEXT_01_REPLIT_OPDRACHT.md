# AI_CONTEXT_01 — GEHEUGEN, TOESTEMMING, TOOLGEBRUIK EN LOGGING

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Uitvoerder:** Replit · **Type:** breed domeinpakket · **Startcommit:** actuele `main`, bevestig de SHA
**Status:** voorbereid werk. Start pas na expliciete vrijgave door René.
**Herkomst:** deel 2 van de opsplitsing van `AI_GOVERNANCE_01`. Dekt geheugen en personalisatie, toestemming, toolgebruik en acties, logging en bewaartermijnen.

## Doel

De AI onthoudt alleen wat mag, gebruikt alleen tools waarvoor bevoegdheid bestaat, en legt alleen vast wat noodzakelijk is — met een bewaartermijn en een uitzetknop die werkt.

## Buiten scope

Veiligheidsgrenzen en weigeringen (`AI_GRENZEN_01`). Toon, taal en antwoordvormen (`AI_KWALITEIT_01`). Bewaartermijnen die nog juridisch open zijn — configureerbaar maken en markeren, niet vaststellen. Geen nieuwe AI-provider.

## 0. Bestaande onderdelen — hergebruiken, niet opnieuw bouwen

| Bestaand | Vindplaats | Draagt al |
|---|---|---|
| Toestemmingssoorten per AI-doel | `lib/ai/gateway.ts` — `ConsentKind` L39, `AI_PURPOSES` L102 | welke toestemming bij welk doel hoort |
| Privacyfilter | idem — `redactSensitive` L399 | gevoelige tekst verwijderen vóór verzending |
| Uploadregel | idem — `UPLOAD_DATA_RULE` L445 | wat met geüploade inhoud mag |
| Aanroeplog | `schema/ai-gateway.ts` — `ai_call_logs` L31 | vastlegging van AI-verkeer |
| Geheugengebeurtenissen | `schema/ai-memory.ts` — `ai_memory_events` L150 | wat onthouden is en wanneer |
| AI-voorkeuren | idem — `ai_preferences` L185 | gebruikersinstellingen |
| Persoonlijk contextgeheugen | `schema/context-memory.ts` — `personal_context_memories` L80 | de geheugeninhoud zelf |
| Toestemmingsauditlog | `schema/privacy.ts` — `consent_audit_log` L91 | wie gaf wanneer welke toestemming |
| Geheugengraaf | `engines/memory-graph/`, `engines/context-memory/` | bestaande geheugenlogica |
| Beheerdersauditlog | `schema/admin-ops-log.ts` | acties met gevolgen |
| Tests | `test:ai-consent`, `test:consent-gate`, `test:memory-graph`, `test:context-memory`, `test:ai-gateway`, `test:privacy-security` | vertrekpunt |

**Er bestaat al een geheugen-, toestemmings- en logginglaag.** Dit pakket maakt die sluitend; het bouwt er geen tweede naast.

## 1. Herstelpunten

**1.1 Toestemming is een poort, geen notitie.** Elk AI-doel uit `AI_PURPOSES` heeft een vereiste `ConsentKind`. Ontbreekt die: **geen aanroep**, met uitleg. Toestemming intrekken werkt onmiddellijk en stopt ook lopend geheugengebruik.

**1.2 Geheugen is zichtbaar en verwijderbaar.** De gebruiker ziet wat er over hem is onthouden, per item met datum en herkomst, en kan het per item én in zijn geheel verwijderen. Verwijderen is echt verwijderen, niet verbergen.

**1.3 Geheugen lekt niet tussen rollen.** Wat een trainer deelt komt niet in het persoonlijke geheugen van de sporter terecht en omgekeerd. Contextgeheugen van de ene gebruiker verschijnt nooit in een antwoord aan een ander.

**1.4 Toolgebruik en acties.** De AI mag lezen wat de gebruiker mag lezen en niets meer. Voor elke handeling met gevolgen — wijzigen, versturen, delen, verwijderen, betalen — geldt: **AI bereidt voor, de gebruiker of een bevoegde beheerder bevestigt.** Geen enkele gevoelige actie wordt definitief door AI uitgevoerd. Elke uitgevoerde actie komt in het auditlog met correlatie-ID.

**1.5 Logging zonder overmaat.** `ai_call_logs` legt vast wat nodig is voor kwaliteit en storingsonderzoek. Geen volledige gespreksinhoud bewaren waar een doel-, uitkomst- en foutcode volstaat. `redactSensitive` draait vóór opslag, niet erna.

**1.6 Bewaartermijnen.** Per soort — aanroeplog, geheugengebeurtenis, contextgeheugen, toestemmingsaudit — een configureerbare termijn. Waar een termijn is vastgesteld, voer die uit. Waar niet: configureerbaar maken en **markeren als besluitpunt**. Replit stelt geen termijn vast.

**1.7 Uitzetten werkt.** Een gebruiker kan personalisatie en geheugen uitzetten. Dan wordt er niets onthouden en niets meegestuurd — ook niet "voor de kwaliteit". De AI blijft werken op algemene informatie.

## 2. Tests

1. Ontbrekende toestemming → geen AI-aanroep, met uitleg.
2. Toestemming intrekken stopt geheugengebruik onmiddellijk.
3. Gebruiker ziet zijn geheugenitems met datum en herkomst.
4. Item verwijderen verwijdert het echt; het komt niet terug in een volgend antwoord.
5. Alles verwijderen laat geen restanten in geheugen of contextgeheugen.
6. Geheugen van gebruiker A verschijnt nooit in een antwoord aan B.
7. Wat een trainer deelt belandt niet in het persoonlijke geheugen van de sporter.
8. AI leest niets wat de gebruiker zelf niet mag lezen.
9. Geen gevoelige actie definitief door AI uitgevoerd; altijd bevestiging.
10. Elke uitgevoerde actie staat in het auditlog met correlatie-ID.
11. `redactSensitive` draait vóór opslag; het log bevat geen gevoelige tekst.
12. Aanroeplog bevat geen volledige gespreksinhoud waar codes volstaan.
13. Elke bewaartermijn is configureerbaar; niet-besloten termijnen zijn gemarkeerd.
14. Personalisatie uit → niets onthouden, niets meegestuurd, AI blijft werken.
15. Directe API-aanroep dwingt dezelfde toestemmings- en toolgrenzen af.
16. Bestaande consent- en geheugentests blijven groen.

## 3. Acceptatiecriteria

1. Toestemming is een harde poort per doel; intrekken werkt direct.
2. Geheugen is inzichtelijk, verwijderbaar en lekt niet tussen gebruikers of rollen.
3. Geen gevoelige actie zonder menselijke bevestiging; alles auditeerbaar.
4. Logging is minimaal, geredigeerd vóór opslag, met configureerbare termijnen.
5. Uitzetten van personalisatie werkt volledig.
6. Geen tweede geheugen-, toestemmings- of logginglaag.
7. Alle bestaande tests groen; typecheck exit 0.

## 4. Bewijsformat

Per regel: commando, resultaat, exitcode. Verder: de tabel doel → vereiste `ConsentKind` → gedrag bij ontbreken · een geheugenitem vóór en ná verwijdering · een `ai_call_logs`-regel die aantoont dat redactie vóór opslag plaatsvond · de bewaarmatrix met bron of markering per soort · een auditlogregel van een door AI voorbereide en door een mens bevestigde actie · start- en eindcommit · gewijzigde bestanden.

## 5. Stopcondities

- toestemming is niet betrouwbaar per doel vast te stellen;
- geheugen is niet volledig verwijderbaar zonder gegevensverlies elders;
- een bewaartermijn is nodig voor de bouw maar juridisch niet vastgesteld;
- een bestaande consent- of geheugentest wordt onhoudbaar.

## 6. Afhankelijkheden

| Nodig | Bron | Blokkerend? |
|---|---|---|
| `ConsentKind` en `AI_PURPOSES` | bestaand | ja |
| Geheugen- en contexttabellen | bestaand | ja |
| `admin_ops_log` en correlatie-ID | bestaand / `ABONNEE_ADMIN_01` | ja voor 1.4 |
| Rol- en eigenaarschapsmodel | `TRAINER_CLUB_01` | ja voor 1.3 |
| Bewaartermijnen | `ABONNEE_ADMIN_01` | nee — configureerbaar en markeren |
| Veiligheidsgrenzen | `AI_GRENZEN_01` | nee |

## 7. Herstelprotocol

Alleen de benoemde blokkade herstellen, op een nieuwe commit vanaf de afgekeurde commit. Geen brede promptherschrijving wanneer de fout in toestemming, rechten of routing zit. Productregel of test nooit aanpassen om een afkeuring te laten verdwijnen.

Hertesten: het afgekeurde scenario, alles wat dezelfde toestemming, tabel of tool raakt, plus `test:ai-consent`, `test:consent-gate`, `test:memory-graph`, `test:context-memory`, `test:privacy-security` en typecheck.

**Uitzonderingslijst — hier blijft een fout niet lokaal:** de toestemmingspoort in `gateway.ts` · `redactSensitive` · de geheugen- en contexttabellen · de toolbevoegdheidscontrole. Raakt de fix een van deze vier, dan wordt het hele pakket hertoetst.

Na twee herstelronden op dezelfde blokkade: naar René.

## 8. Documentatie

`docs/SPARKI_AI_GEHEUGEN_EN_TOESTEMMING.md` — doel, vereiste toestemming, wat wordt onthouden, wat wordt gelogd en hoe lang.
