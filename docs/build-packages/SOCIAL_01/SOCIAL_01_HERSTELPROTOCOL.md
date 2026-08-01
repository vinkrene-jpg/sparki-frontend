# SOCIAL_01 — HERSTELPROTOCOL

## Bij Mirror-afkeuring
1. Alleen de benoemde blokkade herstellen, op een nieuwe commit vanaf de afgekeurde commit. Geen refactor, geen scope-uitbreiding.
2. Geen productregel, acceptatiecriterium of test aanpassen om de afkeuring te laten verdwijnen.
3. **Nooit herstellen met een weergavefilter.** Wordt er gesimuleerde inhoud in een echte feed gevonden, dan is de oplossing uitsluiting bij de bron. Een filter dat je kunt vergeten is geen scheiding, en dit is de plek waar dat het vaakst wordt geprobeerd.
4. **Nooit herstellen door zichtbaarheid te verruimen.** Als iets niet zichtbaar is dat wel zou moeten, is de fout in de zichtbaarheidsfunctie — niet in de standaard.
5. Geen sociaal onderdeel verbergen om een defect te ontwijken.
6. Nooit herstellen op productiedata: geen enkel bestaand gedeeld item wordt van zichtbaarheid veranderd vóór Mirror-goedkeuring.
7. Oorzaak onbekend: melden, niet gokken.

## Wat opnieuw getest wordt
| Wel | Niet |
|---|---|
| het afgekeurde scenario | de volledige toetsen van eerdere pakketten |
| alles wat dezelfde zichtbaarheids- of feedbron raakt | ongewijzigde code |
| `test:social-privacy`, `test:share-honesty`, `test:world-social`, `test:world-feed`, typecheck | volledige regressie over alle suites |
| rubriek A (echt tegenover gesimuleerd) — **altijd** | — |
| de eigen tests van dit pakket, volledig | handmatig hertesten wat een test afdekt |

Rubriek A staat altijd links: elke wijziging in de feedopbouw kan gesimuleerde inhoud opnieuw binnenlaten, en dat merk je niet aan het scenario dat je aan het repareren was.

## Uitzonderingslijst — hier blijft een fout niet lokaal
- de bronuitsluiting van gesimuleerde en geseede inhoud;
- de centrale zichtbaarheidsfunctie;
- de doorwerking van privacyzones in gedeelde inhoud;
- de migratie van bestaande zichtbaarheid.

Raakt de fix een van deze vier, dan wordt het hele pakket hertoetst.

> Deze lijst geldt uitsluitend voor dit pakket. Overnemen naar een ander domein is een fout.

## Extra regel voor zichtbaarheid
Raakt een blokkade de zichtbaarheid, dan gaat het betrokken onderdeel terug naar **privé** tot Mirror opnieuw heeft goedgekeurd. Te weinig zichtbaar is een ongemak; te veel zichtbaar is niet terug te draaien bij de mensen die het al gezien hebben.

## Grens
Na twee herstelronden op dezelfde blokkade: stoppen en voorleggen aan René.

## Wat een afkeuring nooit betekent
Geen herbouw van het pakket, geen terugdraaien van eerder bewezen domeinen, en geen stilzetten van pakketten zonder technische afhankelijkheid.
