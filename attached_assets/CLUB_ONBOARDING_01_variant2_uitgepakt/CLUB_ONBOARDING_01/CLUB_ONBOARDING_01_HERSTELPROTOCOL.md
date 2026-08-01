# CLUB_ONBOARDING_01 — HERSTELPROTOCOL

## Bij Mirror-afkeuring

1. Herstel uitsluitend de concrete blokkade.
2. Start vanaf de afgekeurde eindcommit.
3. Geen brede refactor, opschoning of scope-uitbreiding.
4. Wijzig geen acceptatiecriteria of tests om de fout te laten verdwijnen.
5. Onbekende oorzaak: melden, niet gokken.
6. Raakt herstel een productbesluit of grote architectuurwijziging: stoppen en voorleggen.

## Opnieuw testen

- afgekeurd scenario;
- alle scenario's die dezelfde code, tabel of endpoint raken;
- migratie wanneer schema geraakt is;
- auth/permissions wanneer middleware geraakt is;
- volledige onboarding wanneer activatietransactie geraakt is.

## Gedeelde lagen waarbij volledige hertoets nodig is

- club ownership;
- centrale role/permission middleware;
- invitation tokenservice;
- club/team hoofdtabellen;
- activatietransactie;
- upload- of importpipeline.

Na twee herstelronden op dezelfde blokkade: terug naar René.
