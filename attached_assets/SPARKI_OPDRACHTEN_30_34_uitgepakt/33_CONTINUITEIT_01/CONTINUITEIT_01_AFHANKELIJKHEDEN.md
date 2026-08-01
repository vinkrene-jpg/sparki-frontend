# AFHANKELIJKHEDEN — CONTINUÏTEIT EN NOODBEDIENING

## Exact nodig

- centrale account- en rechtenarchitectuur;
- datatrust en eigenaarschap;
- auditlog;
- notificatie/communicatieservice waar relevant;
- privacy- en bewaartermijnen;
- bestaande domeinservices en tabellen.

## Verplicht betrouwbaar vóór uitvoering

- accountidentiteit is server-side beschikbaar;
- rol- en eigenaarschapscontrole is herbruikbaar;
- migraties kunnen veilig worden uitgevoerd;
- geen bekende datalekken in de gedeelde laag.

## Restpunten die niet blokkeren

- toekomstige add-ons;
- niet-gerelateerde sportuitbreidingen;
- marktplaatsfuncties;
- losse cosmetische wensen buiten deze flow.

Een restpunt blokkeert pas wanneer het een directe afhankelijkheid raakt.

## Gedeelde lagen met verhoogd regressierisico

- users/accounts;
- roles/permissions;
- consent/privacy;
- notifications;
- audit logging;
- shared UI shell;
- mobile navigation.

Wijziging in deze lagen vereist de volledige relevante regressieset.
