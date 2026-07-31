# AFHANKELIJKHEDEN — SPARKI TRAINER ABONNEMENT

## 1. Exact nodig

| Onderdeel | Nodig voor | Zonder |
|---|---|---|
| Centrale entitlements | trainerrechten | UI-only toegang |
| Stripe billing | maand/jaar, status, factuur | geen betrouwbare betaling |
| Trainer-sporter-koppeling | datatoegang | parallel model nodig |
| Uitnodigingen | koppelflow | handmatig databasewerk |
| Auditlog | refunds, rechten, koppelingen | onvoldoende controle |
| Communicatie | uitnodiging en statusmeldingen | incomplete flow |
| Data-trust | echte sporterdata | risico op mock/fallback |
| Privacy/toestemming | toegang per sporter | datalekrisico |
| Adminrechten | support en correcties | te brede beheerrechten |

## 2. Verplicht vooraf bruikbaar

- bestaande accountregistratie;
- server-side pakketstatus;
- Stripe webhook-idempotentie;
- bestaande trainer-sporterrelatie of aantoonbaar herbruikbaar koppelmodel;
- basiscommunicatie/e-mail;
- auditlog;
- databron/eigenaarschap.

Niet alles hoeft al Mirror-bewezen te zijn, maar afwijkingen moeten vóór bouw worden gemeld en mogen niet worden opgelost met een parallel systeem.

## 3. Restpunten die niet blokkeren

- clubabonnementen;
- trainer-marktplaats;
- uitbetaling aan trainers;
- planverkoop;
- ploegleider;
- teammechanieker;
- e-bike;
- wandelen;
- UCI/UEC/KNWU-mapping.

Een restpunt blokkeert pas wanneer het direct een afhankelijkheid uit §2 raakt.

## 4. Gedeelde lagen met verhoogd regressierisico

- entitlements;
- Stripe webhookverwerking;
- accountstatus;
- trainer-sporter-koppeling;
- communicatie;
- auditlog;
- privacy/toestemming.

Wijziging in deze lagen vereist herhaling van de volledige relevante regressieset.
