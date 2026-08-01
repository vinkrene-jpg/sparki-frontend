# CLUB_ONBOARDING_01 — SYNCHRONISATIEPATCH

Uit te voeren **zodra Mirror dit pakket heeft goedgekeurd**. Niet eerder.

## Afbouwmatrix
- nieuwe regels in domein **8 Club, team en jeugd**: `Club registreren en activeren` · `Clubprofiel en logo` · `Teams en seizoenen` · `Ledenimport` — elk `voortgang = MIRROR_PROVEN`, `mirror_status = MIRROR_PROVEN (CLUB_ONBOARDING_01, commit <eind-SHA>)`;
- bestaande regel `Clubomgeving en leden` → afhankelijkheid bijwerken naar `CLUB_ONBOARDING_01 + TRAINER_CLUB_01`;
- configureerbare waarden zonder besluit (seizoensperiode, bewaartermijn importbestand) komen **niet** op MIRROR_PROVEN.

## Dagkaart
**Afgerond** aanvullen met:
> - `CLUB_ONBOARDING_01` door Mirror goedgekeurd op commit `<eind-SHA>`. Een club komt zelfstandig van registratie tot actief, met teams, seizoenen, eerste beheerders en een transactionele ledenimport.

**Open beslissingen** aanvullen met: standaard seizoensperiode · bewaartermijn geïmporteerd ledenbestand.

## Releasestatus
Onder **Bewezen**:
> ### CLUB_ONBOARDING_01 — clubinstroom
> - Commit `<eind-SHA>`, door Mirror onafhankelijk goedgekeurd.
> - Club met precies één eigenaar; activatie server-side afgedwongen.
> - Onboarding hervatbaar zonder verlies; geen uitnodiging of zichtbaarheid vóór activatie.
> - Ledenimport transactioneel en pas na bevestiging; duplicaten op geverifieerd e-mailadres.

## Roadmap
- nieuw blok **Clubinstroom** op prioriteit F, status afgerond en Mirror-bewezen;
- `CLUB_RECHTEN_01` als volgende stap in dezelfde reeks.

## Besluitregister
> ## SPARKI-BESLUIT-2026-012 — Clubinstroom
> **Status:** besloten
> - Een club heeft altijd precies één eigenaar; bij registratie is dat de aanmaker.
> - Een club is `concept` tot activatie; in concept vertrekt geen uitnodiging en zijn leden niet zichtbaar voor anderen.
> - Activatie vereist minimaal naam, contactgegevens, één eigenaar en één team.
> - Ledenimport voegt nooit stilzwijgend toe en herkent duplicaten op geverifieerd e-mailadres.

## Functiematrix
Nieuwe rijen: club registreren · clubprofiel en logo · teams en seizoenen · ledenimport — domein club, bewijsstatus uit het Mirror-rapport.
