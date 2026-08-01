# HERSTELPROTOCOL — `AI_ENGINE_01`

## Bij afkeuring

1. Herstel alleen de concrete blokkade.
2. Start vanaf de afgekeurde eindcommit.
3. Geen brede prompt- of architectuurwijziging.
4. Geen governance-, product- of testregel verzwakken.
5. Geen extra provider of tool toevoegen.
6. Oorzaak onbekend: melden, niet gokken.
7. Product- of governancebesluit nodig: stoppen en René voorleggen.

## Opnieuw testen

Altijd:

- afgekeurd scenario;
- alle scenario’s met dezelfde policy, context, tool of provider;
- outputvalidatie;
- auditlog;
- data-trust;
- pakket- en rolgrens.

Volledige pakket-hertoets wanneer geraakt:

- policy resolver;
- context builder;
- modelgateway;
- toolgateway;
- memory manager;
- veiligheidsclassifier;
- centrale entitlements;
- deterministische engines.

## Grens

Na twee mislukte herstelronden op dezelfde blokkade terug naar René.

## Afkeuring betekent nooit

- volledige herbouw;
- acceptatiecriteria aanpassen;
- test verwijderen;
- governance versoepelen;
- eerdere Mirror-goedgekeurde pakketten terugdraaien.
