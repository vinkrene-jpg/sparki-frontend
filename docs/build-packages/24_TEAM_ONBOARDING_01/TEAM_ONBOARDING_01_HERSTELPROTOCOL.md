# TEAM_ONBOARDING_01 — HERSTELPROTOCOL

## Bij Mirror-afkeuring
1. Alleen de benoemde blokkade herstellen, op een nieuwe commit vanaf de afgekeurde commit. Geen refactor, geen scope-uitbreiding.
2. Geen productregel, acceptatiecriterium of test aanpassen om de afkeuring te laten verdwijnen.
3. **Nooit herstellen door een rol op de kaart te zetten die server-side niet bestaat.** Ontbreekt een rol, dan is dat een bevinding voor `CLUB_RECHTEN_01`, niet iets om hier op te lossen.
4. **Nooit herstellen door alvast iets uit `PLOEGLEIDER_01` te bouwen.** Ontbreekt er iets in de operationele laag, dan is dat een bevinding voor dat pakket.
5. Geen onboardingstap verbergen om een defect te ontwijken.
6. Nooit herstellen op productiedata: geen bestaande organisatie wordt gecorrigeerd vóór Mirror-goedkeuring.
7. Oorzaak onbekend: melden, niet gokken. Vereist de fix een productbesluit — bijvoorbeeld de seizoensperiode — dan stoppen en voorleggen.

## Wat opnieuw getest wordt
| Wel | Niet |
|---|---|
| het afgekeurde scenario | de volledige toetsen van eerdere pakketten |
| alles wat dezelfde organisatie-, rol- of onboardingcode raakt | ongewijzigde code |
| **rubriek E19 (geen operatie meegebouwd) — altijd** | — |
| `test:club`, `test:club-organisation`, `test:cross-account-isolation`, typecheck | volledige regressie over alle suites |
| de eigen tests van dit pakket, volledig | handmatig hertesten wat een test afdekt |

Rubriek E19 staat altijd links: elke uitbreiding van de seizoensbezetting kan ongemerkt in wedstrijdbezetting overlopen, en dat merk je niet aan het scenario dat je aan het repareren was.

## Uitzonderingslijst — hier blijft een fout niet lokaal
- het organisatietype op de bestaande container;
- de eigenaarschapsrelatie `owner` en de standaardbeheerrol;
- de vertaling van organogram-kaart naar conceptstructuur;
- de migratie van bestaande organisaties naar type `CLUB`.

Raakt de fix een van deze vier, dan wordt het hele pakket hertoetst, inclusief de migratievergelijking.

> Deze lijst geldt uitsluitend voor dit pakket. Overnemen naar een ander domein is een fout.

## Extra regel voor de migratie
Raakt een blokkade de migratie naar organisatietype, dan gaat die terug naar dry-run en wordt er geen enkele echte migratie uitgevoerd tussen afkeuring en hergoedkeuring. Lever de rij-aantallen en rolvergelijking vóór en ná de fix naast elkaar.

## Grens
Na twee herstelronden op dezelfde blokkade: stoppen en voorleggen aan René.

## Wat een afkeuring nooit betekent
Geen herbouw van het pakket, geen terugdraaien van `CLUB_RECHTEN_01` of `CLUB_ONBOARDING_01`, en geen stilzetten van pakketten zonder technische afhankelijkheid.
