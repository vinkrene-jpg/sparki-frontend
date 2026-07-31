# TRAINING_FLOW_01 — HERSTELPROTOCOL

## Bij Mirror-afkeuring
1. Alleen de benoemde blokkade herstellen, op een nieuwe commit vanaf de afgekeurde commit. Geen refactor, geen scope-uitbreiding.
2. Geen productregel, acceptatiecriterium of test aanpassen om de afkeuring te laten verdwijnen.
3. **Nooit herstellen door de koppeldrempel te verlagen.** Meer koppelen is niet beter koppelen; een onterechte koppeling levert een verkeerde evaluatie op die de sporter gelooft.
4. Geen zichtbare handeling verbergen om een defect te ontwijken.
5. Nooit herstellen op productiedata: geen enkel bestaand plan of koppeling wordt gecorrigeerd vóór Mirror-goedkeuring.
6. Oorzaak onbekend: melden, niet gokken. Vereist de fix een productbesluit — bijvoorbeeld de koppeldrempel — dan stoppen en voorleggen.

## Wat opnieuw getest wordt
| Wel | Niet |
|---|---|
| het afgekeurde scenario | de volledige toetsen van eerdere pakketten |
| alles wat dezelfde koppel- of vergelijkfunctie raakt | ongewijzigde code |
| `test:plan-lifecycle`, `test:plan-execution`, `test:koppellijst-workouts`, `test:athlete-load`, typecheck | volledige regressie over alle suites |
| de eigen tests van dit pakket, volledig | handmatig hertesten wat een test afdekt |

## Uitzonderingslijst — hier blijft een fout niet lokaal
- de koppelfunctie gepland ↔ uitgevoerd;
- de scheiding tussen `planned_workouts` en `training_sessions`;
- de acute-signaalcontrole uit besluit `2026-014`;
- de migratie van bestaande plannen en koppelingen.

Raakt de fix een van deze vier, dan wordt het hele pakket hertoetst.

> Deze lijst geldt uitsluitend voor dit pakket. Overnemen naar een ander domein is een fout.

## Extra regel voor de koppeling
Raakt een blokkade het automatisch koppelen, dan gaat dat terug naar **uit** — handmatig koppelen blijft werken — tot Mirror opnieuw heeft goedgekeurd. Er wordt in die periode geen enkele automatische koppeling gelegd op echte data.

## Grens
Na twee herstelronden op dezelfde blokkade: stoppen en voorleggen aan René.

## Wat een afkeuring nooit betekent
Geen herbouw van het pakket, geen terugdraaien van eerder bewezen domeinen, en geen stilzetten van pakketten zonder technische afhankelijkheid.
