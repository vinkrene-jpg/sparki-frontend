# AFHANKELIJKHEDEN — `INTEGRATIES_01`

## Exact nodig

- Central Data Hub
- activiteitenmodel
- provider-tokenopslag
- OAuth infrastructuur
- webhookevents
- data-trust en provenance
- auditlog

## Verplicht vooraf bruikbaar

De genoemde bouwstenen moeten aantoonbaar bestaan of veilig herbruikbaar zijn. Ontbreekt een bouwsteen volledig, meld dit vóór bouw en voeg alleen de minimale ontbrekende laag toe binnen deze opdracht.

## Restpunten die niet blokkeren

Restpunten buiten de directe gebruikersflow, toekomstige providers, toekomstige sporten of toekomstige commerciële uitbreidingen blokkeren niet.

Een restpunt is pas een blokkade wanneer het een vereiste bouwsteen hierboven rechtstreeks raakt.

## Gedeelde lagen met verhoogd regressierisico

- activiteiten-ingest
- deduplicatie
- provider-tokenbeheer
- webhookdispatcher
- tijdzone-normalisatie
- bron/provenance

Wijziging in een gedeelde laag vereist hertoets van alle scenario’s die die laag gebruiken.
