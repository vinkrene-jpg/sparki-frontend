# AFHANKELIJKHEDEN — `NOTIFICATIES_01`

## Exact nodig

- bestaande communicatie- en e-mailservices
- account- en rolrechten
- auditlog
- PWA service worker en native pushconfiguratie
- abonnements- en supportevents
- data-trust

## Verplicht vooraf bruikbaar

De genoemde bouwstenen moeten aantoonbaar bestaan of veilig herbruikbaar zijn. Ontbreekt een bouwsteen volledig, meld dit vóór bouw en voeg alleen de minimale ontbrekende laag toe binnen deze opdracht.

## Restpunten die niet blokkeren

Restpunten buiten de directe gebruikersflow, toekomstige providers, toekomstige sporten of toekomstige commerciële uitbreidingen blokkeren niet.

Een restpunt is pas een blokkade wanneer het een vereiste bouwsteen hierboven rechtstreeks raakt.

## Gedeelde lagen met verhoogd regressierisico

- eventbus/event-dispatcher
- gebruikers- en rolrechten
- e-mailprovider
- service worker
- native push-tokenregistratie
- auditlog

Wijziging in een gedeelde laag vereist hertoets van alle scenario’s die die laag gebruiken.
