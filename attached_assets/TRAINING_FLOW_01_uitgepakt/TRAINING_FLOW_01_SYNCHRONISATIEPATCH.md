# TRAINING_FLOW_01 — SYNCHRONISATIEPATCH

Uit te voeren **zodra Mirror dit pakket heeft goedgekeurd**. Niet eerder.

## Afbouwmatrix
- domein **6 Training en coaching**: `Training plannen` · `Trainingbouwer` · `Trainingskalender` · `Gepland versus uitgevoerd` · `Gemiste of extra training` → `voortgang = MIRROR_PROVEN`, `mirror_status = MIRROR_PROVEN (TRAINING_FLOW_01, commit <eind-SHA>)`;
- nieuwe regel `Koppeling gepland ↔ uitgevoerd` in hetzelfde domein;
- `Trainingsplan en adaptief plan` blijft `OPEN` met afhankelijkheid `COACH_ADAPTIEF_01`.

## Dagkaart
**Afgerond** aanvullen met:
> - `TRAINING_FLOW_01` door Mirror goedgekeurd op commit `<eind-SHA>`. Een training werkt van ontwerp tot evaluatie; gepland en uitgevoerd blijven gescheiden en worden alleen gekoppeld bij voldoende zekerheid.

**Open beslissingen:** de koppeldrempel, indien die tijdens de bouw als besluitpunt is gemeld.

## Releasestatus
Onder **Bewezen**:
> ### TRAINING_FLOW_01 — trainingsplanning en uitvoering
> - Commit `<eind-SHA>`, door Mirror onafhankelijk goedgekeurd.
> - Gepland en uitgevoerd zijn gescheiden; koppelen gebeurt alleen bij voldoende zekerheid en is altijd terug te draaien.
> - Ontbrekende metingen blijven leeg; afwijkingen worden getoond, niet beoordeeld.
> - Acute signalen volgen `SPARKI-BESLUIT-2026-014`: een zware sessie wordt niet ingepland, met zichtbare reden, en er wordt niets verboden.

## Roadmap
- blok **Trainingsuitvoering** op prioriteit D, afgerond en Mirror-bewezen;
- `COACH_ADAPTIEF_01` als volgende stap; `ANALYSE_01` en `WEDSTRIJD_01` daarna.

## Besluitregister
`SPARKI-BESLUIT-2026-014` (acuut versus niet-acuut) is met dit pakket voor het eerst uitgevoerd. Werk de implementatiestatus van dat besluit bij naar **gebouwd en Mirror-bewezen**, met vermelding van de signalen die daadwerkelijk beschikbaar waren.

## Functiematrix
Nieuwe rijen: trainingbouwer · koppeling gepland ↔ uitgevoerd · gemiste training · extra rit — domein training, bewijsstatus uit het Mirror-rapport.
