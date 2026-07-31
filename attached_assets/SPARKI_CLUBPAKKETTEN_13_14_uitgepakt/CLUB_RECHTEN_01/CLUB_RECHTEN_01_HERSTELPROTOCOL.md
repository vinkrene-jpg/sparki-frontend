# CLUB_RECHTEN_01 — HERSTELPROTOCOL

## Bij Mirror-afkeuring
1. Alleen de benoemde blokkade herstellen, op een nieuwe commit vanaf de afgekeurde commit. Geen refactor, geen scope-uitbreiding.
2. Geen productregel, acceptatiecriterium of test aanpassen om de afkeuring te laten verdwijnen.
3. **Geen rol verbergen of uitzetten** om een rechtenprobleem te ontwijken.
4. Nooit herstellen op productiedata: geen enkele rolrij van een echte club wordt gecorrigeerd vóór Mirror-goedkeuring.
5. Oorzaak onbekend: melden, niet gokken. Vereist de fix een productbesluit — bijvoorbeeld of `teammanager` en ploegleider verschillen — dan stoppen en voorleggen.

## Wat opnieuw getest wordt
| Wel | Niet |
|---|---|
| het afgekeurde scenario | de volledige toetsen van eerdere pakketten |
| elke rol die dezelfde controle raakt | rollen in ongewijzigde code |
| **alle** isolatietests, altijd | volledige regressie over alle suites |
| de eigen tests van dit pakket, volledig | handmatig hertesten wat een test afdekt |

De isolatietests staan hier bewust altijd in de linkerkolom: dit pakket raakt de scheiding tussen mensen, en een gat daarin merk je niet aan het scenario dat je aan het repareren was.

## Uitzonderingslijst — hier blijft een fout niet lokaal
- `clubRoles` en de rolkoppeling met niveau en einddatum;
- de centrale effectieve-rechtenfunctie;
- `resolveFeatureAccess`;
- de migratie van bestaande rollen.

Raakt de fix een van deze vier, dan wordt het hele pakket hertoetst, inclusief de migratievergelijking.

> Deze lijst geldt uitsluitend voor dit pakket. Overnemen naar een ander domein is een fout.

## Extra regel voor de migratie
Raakt een blokkade de migratie, dan wordt die teruggezet naar dry-run en wordt er geen enkele echte migratie uitgevoerd tussen afkeuring en hergoedkeuring. Lever de rechtenvergelijking vóór en ná de fix naast elkaar.

## Grens
Na twee herstelronden op dezelfde blokkade: stoppen en voorleggen aan René.

## Wat een afkeuring nooit betekent
Geen herbouw van het pakket, geen terugdraaien van eerder bewezen domeinen, en geen stilzetten van pakketten zonder technische afhankelijkheid.
