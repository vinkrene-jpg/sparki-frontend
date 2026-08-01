# Sparki bouwpakketten — bron van waarheid

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


Deze map bevat álle bouwpakketten (Claude + ChatGPT) permanent als onderdeel
van de repository-documentatie. Besluit René 31-07-2026: **GitHub is vanaf nu
de bron van waarheid voor alle bouwopdrachten** — geen pakket bestaat nog
uitsluitend in een Replit-, Claude- of ChatGPT-chat.

## Conventies
- Eén map per pakket. Waar het volgnummer bekend is, staat het als prefix
  (`13_`, `19_`, …); oudere pakketten zonder vastgelegd nummer staan op naam.
- Elk volledig domeinpakket bevat: Replit-opdracht, Mirror-toets,
  afhankelijkheden, herstelprotocol en synchronisatiepatch.
- Nieuwe of gewijzigde pakketten: hier plaatsen, committen en pushen vóór
  er iets mee gebeurt. `attached_assets/` is alleen staging (originele zips).

## Status (per 31-07-2026)
Uitvoering gebeurt uitsluitend na expliciete vrijgave door René, in de door
hem bepaalde volgorde, en met inachtneming van de MIRROR_PROVEN-voorwaarden
per pakket. Opgeleverd (BUILD_DELIVERED, wachten op Mirror): ROUTE_PAKKET-reeks,
DATA_TRUST_01, ABONNEMENT_01. RELEASE_01 is het slotpakket.

## Nog niet ontvangen pakketten (wel genoemd als afhankelijkheid)
CLUB_LEDEN_01 · JEUGD_OUDER_01 · TRAINER_KOPPELING_01 · COACH_ADAPTIEF_01 ·
WEDSTRIJD_01 · VOEDING_01 · EBIKE_01 · ANALYSE_01 · WANDELEN_01 ·
AI_GOVERNANCE_01.
