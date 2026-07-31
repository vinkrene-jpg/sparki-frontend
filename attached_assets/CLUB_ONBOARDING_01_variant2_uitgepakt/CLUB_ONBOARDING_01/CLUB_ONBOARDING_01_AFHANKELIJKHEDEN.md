# CLUB_ONBOARDING_01 — AFHANKELIJKHEDEN

## Wat exact nodig is

| Nodig | Waarom | Zonder dit |
|---|---|---|
| Werkende auth/Clerk-koppeling | eigenaar en actor vastleggen | geen veilige onboarding |
| Bestaande club/team-entiteiten | hergebruik architectuur | risico parallel systeem |
| Server-side rollen/permissions | wijzigrechten | datalek of privilege escalation |
| Uploadservice | logo en CSV | onvolledige flow |
| E-mail/notificatieservice | uitnodigingen | uitnodigingsflow werkt niet |
| Auditlog | eigenaarschap en mutaties | geen verantwoordingsspoor |

## Moet bewezen of stabiel zijn

1. login en accountidentiteit;
2. server-side admin/rolmiddleware;
3. bestaande club- en teamdata leesbaar;
4. uploadservice kan bestanden veilig verwerken;
5. e-mailservice kan transactioneel worden aangeroepen.

## Restpunten die niet blokkeren

- clubabonnement nog niet gebouwd;
- volledige communicatie nog niet gebouwd;
- ploegleiderdagflow nog niet gebouwd;
- UCI/UEC/KNWU-mapping nog open;
- mechaniekerflow nog niet volledig;
- AI-coach niet afgerond.

Een restpunt blokkeert pas wanneer het een verplichte afhankelijkheid hierboven raakt.
