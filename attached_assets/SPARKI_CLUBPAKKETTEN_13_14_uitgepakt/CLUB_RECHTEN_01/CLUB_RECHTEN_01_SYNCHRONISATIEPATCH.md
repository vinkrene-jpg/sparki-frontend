# CLUB_RECHTEN_01 — SYNCHRONISATIEPATCH

Uit te voeren **zodra Mirror dit pakket heeft goedgekeurd**. Niet eerder.

## Afbouwmatrix
- nieuwe regels in domein **3 Rollen** en **8 Club, team en jeugd**: `Clubrolmodel (elf rollen)` · `Meerdere rollen per persoon` · `Club- en teamniveau gescheiden` · `Tijdelijke rollen` · `Eigendomsoverdracht` — elk `voortgang = MIRROR_PROVEN`, `mirror_status = MIRROR_PROVEN (CLUB_RECHTEN_01, commit <eind-SHA>)`;
- bestaande regel `Ploegleider` → `NIET_AANGETROFFEN` vervalt; wordt `CODE_EN_TEST` met verwijzing naar dit pakket;
- bestaande regel `Rollen en datatoegang` → afhankelijkheid bijwerken naar `CLUB_RECHTEN_01`.

## Dagkaart
**Afgerond** aanvullen met:
> - `CLUB_RECHTEN_01` door Mirror goedgekeurd op commit `<eind-SHA>`. Elf rollen, server-side, gescheiden op club- en teamniveau, meerdere rollen per persoon, tijdelijke rollen met automatisch verval, en audit bij elke wijziging.

**Open beslissingen:** het punt "ploegleider of teammanager" vervalt.

## Releasestatus
Onder **Bewezen**:
> ### CLUB_RECHTEN_01 — clubrollen en rechten
> - Commit `<eind-SHA>`, door Mirror onafhankelijk goedgekeurd.
> - Elf vastgestelde rollen; `teammanager` hernoemd naar ploegleider met behoud van rijen.
> - Meerdere rollen per persoon leveren de vereniging van rechten.
> - Club- en teamniveau strikt gescheiden; geen datalek tussen teams.
> - Tijdelijke rollen vervallen automatisch en auditeerbaar; altijd precies één eigenaar.
> - Migratie zonder enige rechtenwijziging, aangetoond met een vergelijking per rol.

Onder **Releaseblokkades die blijven gelden**: geen pilot met echte clubs vóór dit pakket Mirror-bewezen is.

## Roadmap
- blok **Clubrollen** op prioriteit F, afgerond en Mirror-bewezen;
- `CLUB_LEDEN_01` als volgende stap; `JEUGD_OUDER_01` en `TRAINER_KOPPELING_01` daarna.

## Besluitregister
> ## SPARKI-BESLUIT-2026-013 — Definitieve clubrollen
> **Status:** besloten
> - Elf rollen: clubeigenaar, clubbeheerder, hoofdtrainer, trainer, assistent-trainer, ploegleider, mechanieker, ouder/verzorger, vrijwilliger, alleen-lezen, sporter.
> - Ploegleider is een zelfstandige rol; de bestaande `teammanager` gaat daarin op.
> - Eén persoon mag meerdere rollen hebben; rechten zijn de vereniging daarvan.
> - Club- en teamniveau zijn gescheiden; een rol bij het ene team geeft niets bij het andere.
> - Rollen kunnen tijdelijk zijn met een einddatum en vervallen dan automatisch.
> - Een club heeft altijd precies één eigenaar; overdracht maakt de oude eigenaar clubbeheerder.
> - Vervangt het eerdere besluitpunt D5.

## Functiematrix
Nieuwe rijen: clubrolmodel · meerdere rollen per persoon · club-/teamniveau · tijdelijke rollen · eigendomsoverdracht — domein rollen, bewijsstatus uit het Mirror-rapport.
