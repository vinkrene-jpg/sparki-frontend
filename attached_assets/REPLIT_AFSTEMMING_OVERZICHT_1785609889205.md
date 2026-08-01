# REPLIT — AFSTEMMING: WAT LIGT ER, EN WAT IS ERMEE GEBEURD

Doel: René wil weten of jij herkent wat hieronder staat, of het bij jou is aangekomen, en wat je ermee hebt gedaan. **Niets bouwen op basis van dit document.** Alleen antwoorden.

Gemeten op main `6c8648d` (1 augustus 2026, 18:32).

---

## Hoe je antwoordt

Per regel één statuswoord plus één regel toelichting:

- **OP MAIN** — gebouwd en staat in de hoofdversie
- **KLAAR, NIET TOEGEPAST** — af, maar staat nog in de kolom Ready of op een branch
- **IN UITVOERING** — mee bezig
- **IN WACHTRIJ** — opdracht ontvangen, nog niet begonnen
- **ALLEEN DOCUMENT** — het pakket bestaat, er is geen code
- **NIET ONTVANGEN** — ken ik niet

Bij alles wat niet OP MAIN is: waar staat het (taaknummer, branch, PR) en wat houdt het tegen.

---

## 1. De vier hoofdbouwpakketten

Wij denken: vier complete pakketten, geschreven 31 juli / 1 augustus, inclusief de documentcatalogus met AI-voorinvulling, en op 1 augustus voorzien van hoofdstuk 0 met de nieuwe uitvoeringsregel.

| Pakket | Onderwerp | Status? |
|---|---|---|
| `SPARKI_BUILD_01` | fundament, veiligheid en toegang | |
| `SPARKI_BUILD_02` | werkobjecten en organisatiegeheugen | |
| `SPARKI_BUILD_03` | wedstrijd- en teamoperatie | |
| `SPARKI_BUILD_04` | professionele begeleiding en facturatie | |

**Wat wij op main zien:** de mappen bestaan in `docs/build-packages/`. In de code zien we geen sporen van uitvoering — het clubschema telt nog 21 tabellen, `club_race_selections.role` kent nog alleen `renner | reserve | begeleider`, er is geen VOG-registratie, en `engines/today/roles.ts` kent nog vijf rolweergaven tegenover vijftien rolwaarden.

**Vraag:** klopt dat, of missen we iets dat elders staat?

---

## 2. De documentenbibliotheek

Wij denken: 41 kant-en-klare sjablonen plus een implementatiebrief, documentstandaard en metadataschema — `SPARKI_DOCUMENT_LIBRARY_01`. Verdeeld over club (5), wedstrijd (13), trainer (11), gedeeld (4), facturatie (3), ouder en jeugd (3), team (2).

**Wat wij op main zien:** `docs/document-library/` bestaat niet. De sjablonen staan niet in de repo.

**Vraag:** heb je dit pakket ontvangen? Zo ja, waar staat het en wat is het plan ermee?

---

## 3. De vier volledigheidsonderzoeken (1 augustus, ochtend)

Analyse, geen bouwopdrachten. Wij willen weten of ze bij je bekend zijn en of je er iets mee hebt gedaan.

| Onderzoek | Kern |
|---|---|
| `CLUB_TEAM_OPERATIONAL_COMPLETENESS_01` | 29 onderdelen, 0 bewezen; 8 productbesluiten CT-B01..B08 |
| `RACE_DAY_OPERATIONS_COMPLETENESS_01` | ploegleider kan alleen aankondigen en selecteren; 10 bevindingen R-01..R-10 |
| `PARENT_MINOR_COMPLETENESS_01` | 10 bevindingen B-01..B-10, waarvan B-01 en B-02 blokkerend |
| `INDEPENDENT_TRAINER_COMPLETENESS_01` | capability-matrix, facturatiescope, 5 blokkerende besluiten F-B1..F-B5 |
| `OPERATIONAL_WORK_OBJECTS_COMPLETENESS_01` | geen werkobjectarchitectuur, ook niet als ontwerp |
| `UX_AUDIT_MODULES_01` | normkader en doelstructuur per rolmodule; inventarisatie stond nog open |

**Vraag per onderzoek:** ontvangen ja/nee, en is er iets uit opgepakt?

---

## 4. Wat wij denken dat vandaag wél is gebouwd

Bevestig of corrigeer:

- `KETEN_FIETS_01` — productiebewijsscript met echte login, harde deadline op routegeneratietaken, afgeschermd bewijsticket-endpoint, Overpass-netwerkprobe
- `SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01` — doorgevoerd in de bouwpakketten, beslisblok K1 t/m K6
- Coach-navigatielabels positie 2–4 uit configuratie
- F-P0-01 één leeftijdsdefinitie · F-P0-03 rolbezit-poort op `/rol-start/` · F-P0-04/05 data-trust 24/24, entitlements 29/29, team-abonnement 10/10
- F-P1-04 routegeneratie-fouttests · F-P1-05 mobiele overflow 375/412px
- PR #1 gemerged — `.github/workflows/pr-checks.yml` staat nu op main

**Vraag:** klopt deze lijst, en wat mist eraan?

---

## 5. Openstaande taken die volgens ons stilstaan

| Taak | Onderwerp | Status? |
|---|---|---|
| #536 | wandelen | |
| #537 | abonnee-administratie, vast lidnummer | |
| `ROUTE_PAKKET_02c` / `02d` | routelijn | |
| `MIRROR_FINDINGS_RECOVERY_01` | vier P1-herstelopdrachten, geen ervan uitgevoerd | |
| `MEDIA_UITLEG_01` | 22 documenten, F0 nog niet gestart | |
| `AI_INTELLIGENCE_ENGINE_01` | 22 documenten, F0 nog niet gestart | |
| `FUTUR_CONTROL_01` | 20 documenten — **niet aanraken**, staat bewust apart | |

---

## 6. Drie vragen die we het belangrijkst vinden

1. **Staat er werk klaar dat nog niet is toegepast op de hoofdversie?** Als er taken op Ready staan die René niet heeft toegepast, verklaart dat waarom hij op zijn telefoon niets ziet veranderen.
2. **Wat is er met de 45 pakketmappen in `docs/build-packages/` gebeurd?** Welke daarvan zijn ooit uitgevoerd, welke zijn alleen documentatie?
3. **Wat zou jij als eerste bouwen** nu de fietsketen bijna rond is — en waarom die?

---

## Niet doen

Geen code schrijven, geen taken starten, geen pakketten openen op basis van dit document. Alleen het overzicht invullen en terugsturen.
