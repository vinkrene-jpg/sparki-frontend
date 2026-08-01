# CLUB_ONBOARDING_01 — HERSTELPROTOCOL

## Bij Mirror-afkeuring
1. Alleen de benoemde blokkade herstellen, op een nieuwe commit vanaf de afgekeurde commit. Geen refactor, geen scope-uitbreiding.
2. Geen productregel, acceptatiecriterium of test aanpassen om de afkeuring te laten verdwijnen.
3. Geen stap uit de onboarding verbergen om een defect te ontwijken.
4. Nooit herstellen op productiedata: een bestaande club wordt niet gecorrigeerd vóór Mirror-goedkeuring.
5. Oorzaak onbekend: melden, niet gokken. Vereist de fix een productbesluit — bijvoorbeeld de seizoensperiode of de bewaartermijn van een importbestand — dan stoppen en voorleggen.

## Wat opnieuw getest wordt
| Wel | Niet |
|---|---|
| het afgekeurde scenario | de volledige toetsen van eerdere pakketten |
| alles wat dezelfde code raakt | ongewijzigde bestanden |
| `test:club`, `test:club-organisation`, `test:cross-account-isolation`, typecheck | volledige regressie over alle suites |
| de eigen tests van dit pakket, volledig | handmatig hertesten wat een test afdekt |

## Uitzonderingslijst — hier blijft een fout niet lokaal
- de clubstatus (concept/actief) en de activatiecontrole;
- het eigenaarschapsmodel;
- de importtransactie en de duplicaatherkenning;
- de rechtencontrole op onboardinghandelingen.

Raakt de fix een van deze vier, dan wordt het hele pakket hertoetst.

> Deze lijst geldt uitsluitend voor dit pakket. Overnemen naar een ander domein is een fout.

## Extra regel voor de import
Raakt een blokkade de ledenimport, dan gaat die terug naar bevestigingsstand en wordt er geen enkele echte import uitgevoerd tussen afkeuring en hergoedkeuring. Lever het importrapport vóór en ná de fix naast elkaar.

## Grens
Na twee herstelronden op dezelfde blokkade: stoppen en voorleggen aan René.

## Wat een afkeuring nooit betekent
Geen herbouw van het pakket, geen terugdraaien van eerder bewezen domeinen, en geen stilzetten van pakketten zonder technische afhankelijkheid.
