# RELEASE_01 — HERSTELPROTOCOL

## De hoofdregel van dit pakket

**Een defect dat hier wordt gevonden, wordt hier niet gerepareerd.**

Elke bevinding gaat terug naar het domeinpakket waar hij thuishoort, wordt daar hersteld volgens dát herstelprotocol, en wordt daar opnieuw door Mirror getoetst. Pas daarna wordt de betreffende rubriek van `RELEASE_01` hernomen.

De reden is eenvoudig: een reparatie in de releasestraat verandert niets aan de oorzaak, en de volgende release loopt tegen hetzelfde aan.

## Wat Replit doet bij een bevinding

1. **De bevinding routeren, niet oplossen.** Noteer domeinpakket, rubriek, en de reproductiestappen.
2. Is het domeinpakket eigenaar onduidelijk: voorleggen aan René, niet zelf toewijzen.
3. Is de bevinding een fout in de releasestraat zelf — een schakelaar die niet werkt, een persona die niet wordt aangemaakt, een rapportregel die ontbreekt — dan is dat wél werk voor dit pakket, en alleen dat.
4. Nooit een functionele wijziging aan de applicatie binnen dit pakket. Dat is per definitie buiten scope.

## Wat opnieuw getoetst wordt na een domeinreparatie

| Wel | Niet |
|---|---|
| de rubriek waarin de bevinding zat | de hele releasetoets |
| de rubrieken die hetzelfde domein raken | domeinen zonder verband |
| rubriek J (data-trust) — altijd | — |
| de productiechecklist — altijd | — |

Rubriek J en de checklist staan altijd in de linkerkolom: een reparatie in het ene domein kan elders voorbeelddata of een gewijzigde productiestand opleveren, en dat merk je niet aan de rubriek die je aan het hertoetsen was.

## Uitzonderingslijst — hier wordt de hele toets hernomen

- een reparatie in de rechtenresolver of in een entitlementsleutel;
- een reparatie in de herkomst- of provenancelaag;
- een reparatie in de rol- en toestemmingscontrole;
- een reparatie in de webhook- of statusvertaling;
- een migratie die productiedata raakt.

Deze vijf raken elk domein tegelijk. Een gerichte hertoets zegt daar niets.

## Grens

Loopt hetzelfde domein voor de **derde** keer stuk in `RELEASE_01`, dan stopt het routeren. Dan is er geen defect maar een structureel probleem in dat domein, en dat gaat als zodanig naar René — niet als bevinding maar als besluitpunt over dat onderdeel.

## Wat een gefaald domein nooit betekent

Geen uitstel van de hele release wanneer het domein niet releasekritiek is — dat oordeel is aan René. Geen terugdraaien van bewezen domeinen. En geen verbergen van het onderdeel om de doorloop te laten slagen: dat is een afkeuringsgrond, geen oplossing.
