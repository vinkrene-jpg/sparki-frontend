# TEAM_ONBOARDING_01 — SYNCHRONISATIEPATCH

Uit te voeren **zodra Mirror dit pakket heeft goedgekeurd**. Niet eerder.

## Afbouwmatrix
- nieuwe regels in domein **22 Teams**: `Teamorganisatie aanmaken en activeren` · `Organisatietype CLUB/TEAM` · `Selecties en seizoen` · `Seizoensbezetting` · `Teamorganogram` · `Rolgestuurde startschermen` — elk `voortgang = MIRROR_PROVEN`, `mirror_status = MIRROR_PROVEN (TEAM_ONBOARDING_01, commit <eind-SHA>)`;
- domein 22 gaat van ROOD naar GEEL zolang `PLOEGLEIDER_01` en de medische teamflow nog openstaan; pas GROEN na de volledige reeks;
- `Wedstrijdbezetting` blijft `OPEN` met afhankelijkheid `PLOEGLEIDER_01` — expliciet **niet** door dit pakket gedekt.

## Dagkaart
**Afgerond** aanvullen met:
> - `TEAM_ONBOARDING_01` door Mirror goedgekeurd op commit `<eind-SHA>`. Een teamorganisatie komt zelfstandig van registratie tot actief, met seizoen, selecties, seizoensbezetting, roltoekenningen en organogram. De operationele wedstrijdlaag hoort bij `PLOEGLEIDER_01` en is aantoonbaar niet meegebouwd.

**Open beslissingen** aanvullen met: standaard seizoensperiode.

## Releasestatus
Onder **Bewezen**:
> ### TEAM_ONBOARDING_01 — teamorganisatie
> - Commit `<eind-SHA>`, door Mirror onafhankelijk goedgekeurd.
> - Eén organisatiecontainer met type `CLUB` of `TEAM`; geen tweede organisatiesysteem.
> - Eigenaarschap is een relatie (`owner`), geen rolwaarde; eigenaar krijgt bij aanmaak `teammanager` respectievelijk `clubbeheerder`.
> - Organogram-kaarten tonen alleen bestaande rollen, maken uitsluitend een conceptstructuur en overschrijven na activering niets.
> - Iedere rol landt op een eigen startscherm; vier lege toestanden onderscheiden met wie-en-vervolgstap.
> - Bestaande clubs na migratie type `CLUB` met ongewijzigde rollen.

## Roadmap
- blok **Teamorganisatie** op prioriteit F, afgerond en Mirror-bewezen;
- `PLOEGLEIDER_01` als volgende stap, gevolgd door `TEAM_MECHANIEKER_01` en de medische teamflow.

## Besluitregister
> ## SPARKI-BESLUIT-2026-0XX — Teamorganisatie en eigenaarschap
> **Status:** besloten (1 augustus 2026)
> - Eén organisatiecontainer met organisatietype `CLUB` of `TEAM`; geen tweede organisatiesysteem.
> - Een `TEAM`-organisatie staat productmatig los van een club en gebruikt dezelfde rechtenarchitectuur.
> - Trainingsgroepen en wedstrijdteams zijn verschillende dingen; een sporter kan in beide zitten.
> - Eigenaarschap is een relatie met de organisatie (`owner`), geen operationele rolwaarde. Gebruikersnaam Teameigenaar respectievelijk Clubeigenaar. Bij aanmaak krijgt de eigenaar `teammanager` respectievelijk `clubbeheerder`.
> - `TEAM_ONBOARDING_01` bouwt de organisatiebasis; `PLOEGLEIDER_01` bouwt de operationele wedstrijdlaag.

## Functiematrix
Nieuwe rijen: teamorganisatie aanmaken · organisatietype · selecties en seizoen · seizoensbezetting · teamorganogram · rolgestuurde start — domein teams, bewijsstatus uit het Mirror-rapport.
