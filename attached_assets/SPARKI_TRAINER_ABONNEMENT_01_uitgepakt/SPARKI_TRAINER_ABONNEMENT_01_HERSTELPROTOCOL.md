# HERSTELPROTOCOL — SPARKI TRAINER ABONNEMENT

## Bij Mirror-afkeuring

1. Herstel uitsluitend de concrete blokkade.
2. Start vanaf de afgekeurde eindcommit.
3. Geen brede refactor.
4. Geen productregels of tests verzwakken.
5. Geen club-, marktplaats- of uitbetalingsscope toevoegen.
6. Oorzaak onbekend: melden, niet gokken.
7. Architectuur- of productwijziging nodig: stoppen en aan René voorleggen.

## Opnieuw testen

Altijd:

- afgekeurd scenario;
- alle scenario’s die dezelfde code raken;
- trainer-entitlements;
- Stripe-status;
- trainer-sporterrechten;
- auditlog;
- data-trust.

Volledige pakket-hertoets wanneer de fix raakt aan:

- centrale entitlements;
- Stripe webhookdispatcher;
- accountstatusmachine;
- trainer-sporter-koppeling;
- privacy/toestemming;
- migratie.

## Na twee mislukte herstelronden

Stop en leg voor aan René. Dan is vermoedelijk sprake van:

- onduidelijke opdracht;
- ontbrekend besluit;
- fout in gedeelde architectuur.

Een derde gokpoging is verboden.

## Wat een afkeuring niet betekent

- geen volledige herbouw;
- geen terugdraaien van goedgekeurde pakketten;
- geen stilzetten van technisch onafhankelijke opdrachten;
- geen aanpassen van acceptatiecriteria om groen te krijgen.
