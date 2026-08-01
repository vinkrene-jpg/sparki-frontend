# HERSTELPROTOCOL — `NOTIFICATIES_01`

## Bij afkeuring

1. Herstel uitsluitend de concrete blokkade.
2. Start vanaf de afgekeurde eindcommit.
3. Geen brede refactor of opruiming.
4. Geen productregels, tests of acceptatiecriteria verzwakken.
5. Oorzaak onbekend: melden, niet gokken.
6. Architectuur- of productwijziging nodig: stoppen en René voorleggen.

## Opnieuw testen

- afgekeurd scenario;
- alle scenario’s die dezelfde code raken;
- vaste bewijsset;
- eigen tests van het pakket.

Volledige pakket-hertoets wanneer de fix raakt aan:

- eventbus/event-dispatcher
- gebruikers- en rolrechten
- e-mailprovider
- service worker
- native push-tokenregistratie
- auditlog

## Grens

Na twee mislukte herstelronden op dezelfde blokkade gaat het terug naar René.

## Afkeuring betekent niet

- geen volledige herbouw;
- geen terugdraaien van eerder goedgekeurde pakketten;
- geen stilzetten van technisch onafhankelijke opdrachten;
- geen aanpassing van criteria om groen te krijgen.
