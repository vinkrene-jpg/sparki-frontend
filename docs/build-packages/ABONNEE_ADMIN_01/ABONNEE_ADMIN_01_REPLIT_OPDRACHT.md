# ABONNEE_ADMIN_01 — ABONNEEREGISTRATIE, LEVENSCYCLUS, AVG EN UITZONDERINGEN

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Uitvoerder:** Replit
**Type:** breed domeinpakket
**Startcommit:** actuele `main`; bevestig de SHA in je eindrapport
**Status:** voorbereid werk. **Start pas na expliciete vrijgave door René.**
**Verhouding tot `ABONNEMENT_01`:** dat pakket maakt de betaalflow en de rechten kloppend. Dit pakket voegt de **administratieve laag** toe: identificatie, register, levenscyclus, bewaartermijnen, privacyverzoeken en uitzonderingen. **Geen tweede abonnementsarchitectuur.**

## Doel

Elke gebruiker heeft één permanent lidnummer, elke situatie heeft één vaste server-side status, en elke administratieve handeling heeft een bevoegdheid, een procedure, een communicatie en een audittrail.

## Buiten scope

De betaalflow zelf, de statusvertaling van Stripe en de entitlementpoorten — die horen in `ABONNEMENT_01`. Verder: nieuwe abonnementsvormen, prijzen, btw en facturatie, en het definitief vaststellen van juridische bewaartermijnen.

---

## 0. Bestaande onderdelen — hergebruiken, niet opnieuw bouwen

| Bestaand | Vindplaats | Draagt al |
|---|---|---|
| Beheerdersauditlog | `lib/db/src/schema/admin-ops-log.ts` — `admin_ops_log` | onveranderlijk logboek van álle beheerdersacties; rijen worden nooit verwijderd |
| Veiligheidsauditlog | `lib/security` — `security_audit_log` | rate-limit- en authenticatiegebeurtenissen |
| Accountoverzicht, export en verwijdering | `routes/account.ts` — overview L87, export L155, verwijderverzoek L186, **annuleren L233** | er bestaat al een verwijderverzoek met annuleervenster |
| Supportzaken | `schema/support.ts` — `support_tickets`, `support_ticket_messages`, `helpdesk_turns` | ticketstructuur en helpdeskverloop |
| Privacy | `schema/privacy.ts`, `routes/privacy.ts` | bestaande privacystructuur |
| Billing | `schema/billing.ts` — `billing_subscriptions`, `stripe_webhook_events`, `billing_test_accounts` | abonnement, status, webhooks, idempotentie |
| Rechten | `lib/entitlements.ts` — `resolveEntitlements` L107, `requireCommercialFeature` L347 | de enige rechtenbron |
| E-mail en notificaties | `lib/email.ts`, `schema/notifications.ts` | verzendkanaal |
| Continuïteit | `docs/SPARKI_FOUNDER_SUCCESSION_CONTINUITY_v1.0.md` | het bestaande kader voor §9 |

**Wat er níét is:** een lidnummer. `SPK-`, `memberNumber` en `lidnummer` komen nergens voor. Dat is het enige werkelijk nieuwe onderdeel van dit pakket.

---

## 1. Sparki-lidnummer

Formaat `SPK-JJJJ-NNNNNN`, bijvoorbeeld `SPK-2026-000123`.

**Eisen:**

1. server-side aangemaakt bij registratie, in dezelfde transactie als het aanmaken van het account;
2. **onveranderlijk** bij pakketwijziging, e-mailwijziging, nieuwe Stripe-subscription, koppeling aan trainer of club, pauzering en opzegging — leg dit vast met een databasebeperking, niet met een afspraak;
3. gekoppeld aan interne user-ID, Clerk-ID, Stripe customer-ID, actuele en historische subscriptions, supporttickets, privacyverzoeken en administratieve incidenten;
4. **nooit een authenticatiemiddel.** Kennis van een lidnummer geeft geen enkele toegang. Geen endpoint accepteert een lidnummer als identificatie zonder volwaardige authenticatie;
5. geen hergebruik na verwijdering — de reeks loopt door, ook wanneer een account verdwijnt;
6. uniciteit afgedwongen met een **unieke sleutel in de database**, niet met een controle in applicatiecode.

**Uitgifte en gelijktijdigheid.** Twee registraties op hetzelfde moment mogen nooit hetzelfde nummer krijgen. Gebruik een databasesequence of een `INSERT` met unieke sleutel en retry — geen `SELECT MAX() + 1`. Lever een testhaak waarmee Mirror twee gelijktijdige registraties kan afvuren.

**Migratie.** Bestaande accounts krijgen een lidnummer via een idempotente migratie: opnieuw draaien levert geen tweede nummer op. Rapporteer het aantal toegekende nummers en eventuele conflicten.

**Zichtbaar in:** profiel/account, abonnementsoverzicht, support- en privacycontact, en de relevante bevestigingsmails.

## 2. Centraal abonneeregister

Eén adminweergave, per gebruiker: lidnummer · naam en geverifieerd e-mailadres · Clerk-ID · Stripe customer-ID · Stripe subscription-ID's · huidig pakket · actuele status · proefperiode · start-, verleng-, opzeg- en effectieve einddatum · pauzering · betalingsprobleem · grace · refund- of chargebackstatus · laatste ontvangen webhook · laatste succesvolle rechtenberekening · gekoppelde support- en privacyzaken.

**Nooit** volledige betaalkaartgegevens opslaan of tonen.

**Eén leidende actuele pakketstatus per account.** Historische subscriptions blijven apart traceerbaar. Dwing af dat er niet twee actuele statussen naast elkaar kunnen bestaan.

**Bronverantwoordelijkheid en conflict.** Clerk is leidend voor identiteit, Stripe voor betaalstatus, de Sparki-database voor koppeling, lidnummer, levenscyclus en rechten. Wijken deze tijdelijk af, dan geldt:

- Stripe zegt betaald, Sparki niet → Sparki volgt Stripe zodra de webhook is verwerkt; tot die tijd **geen rechten toekennen op vermoeden**;
- Sparki zegt actief, Stripe kent het abonnement niet → markeer als conflict, blokkeer geen data, meld aan de beheerder;
- Clerk kent de gebruiker niet meer terwijl Sparki dat wel doet → conflict, geen automatische verwijdering.

Elk conflict is zichtbaar in het register en gaat naar het auditlog. **Nooit stilzwijgend één bron laten winnen.**

## 3. Levenscyclusstatussen

Bouw één statusmachine met: `FREE` · `TRIALING` · `ACTIVE` · `PAYMENT_FAILED` · `GRACE_PERIOD` · `PAUSED` · `CANCEL_AT_PERIOD_END` · `CANCELLED` · `REFUNDED` · `CHARGEBACK` · `DECEASED` · `PRIVACY_HOLD` · `DELETION_PENDING` · `DELETED` · `ANONYMISED`.

**Verplichte mapping.** De bestaande Stripe- en entitlementstatussen — `active`, `grace`, `canceled`, `expired`, `blocked` — blijven de rechtenbron. Deze levenscyclusstatussen zijn een **administratieve laag erboven**. Lever de vertaaltabel op: welke levenscyclusstatus volgt uit welke onderliggende status, en welke rechten daaruit voortkomen. **Er komt geen tweede rechtensysteem.**

Leg per status objectief vast: toegang tot Gratis-, Go- en Compleetfuncties · gaat facturatie door · welke communicatie vertrekt · welke adminacties zijn toegestaan · welke data mag worden gewijzigd · welke automatische vervolgstap geldt · welke acties auditplichtig zijn.

**Onbekende of conflicterende status: fail-closed op rechten, maar nooit op data.** Geen rechten, en geen enkel persoonsgegeven gewist.

## 4. Opzeggen, pauzeren, downgraden en verwijderen zijn vijf dingen

Bouw vijf **afzonderlijke** flows: abonnement opzeggen · pauzeren (waar commercieel toegestaan) · hervatten · account deactiveren · account en persoonsgegevens verwijderen.

Deze mogen niet achter één knop of één procedure zitten. Dat is de belangrijkste eis van dit hoofdstuk: iemand die zijn abonnement opzegt, verwijdert zijn account niet.

**Bij opzeggen:** toekomstige verlenging stopt · rechten blijven tot de effectieve einddatum, tenzij het refundbeleid anders bepaalt · bevestiging met datum · daarna terug naar Gratis · **niets stilzwijgend verwijderen** · data-export en accountverwijdering worden apart aangeboden, niet als vervolgstap gesuggereerd.

**Route-downgrade (vastgesteld besluit):** alle routes blijven zichtbaar · routes boven de gratis limiet blijven alleen-lezen · de gebruiker kiest zelf welke drie actief blijven · tot die keuze verdwijnt niets · upgrade blijft mogelijk · meldingen zijn duidelijk en niet misleidend.

Voor andere pakketgebonden gegevens: pas hetzelfde veilige gedrag toe — zichtbaar houden, alleen-lezen maken, niets verwijderen. **Waar geen downgradebesluit bestaat: melden als besluitpunt, niet zelf invullen.**

## 5. Wanbetaling en betaalincidenten

Werk uit voor: mislukte betaling · vertraagde webhook · ontbrekende webhook · dubbele webhook · dubbele betaling · incomplete betaling · grace · herstel na betaling · refund · gedeeltelijke refund (**alleen wanneer al ondersteund** — is dat niet zo, dan melden en niet bouwen) · chargeback · foutieve pakketstatus · Stripe-storing.

Per situatie vastleggen: trigger · server-side status · rechten · gebruikersmelding · e-mail · adminmelding · herstelactie · auditlog · idempotentie.

**Harde regel:** een betaalincident verwijdert nooit sport-, route-, training- of gezondheidsdata. Rechten kunnen vervallen; gegevens niet.

## 6. Support- en probleemregistratie

Elke support-, abonnements-, privacy- of probleemmelding koppelt automatisch aan: lidnummer · account-ID · huidige pakketstatus · rol · platform · appversie · datum en tijd · categorie · eventueel betrokken route, activiteit, training, wedstrijd, factuur of betaling.

Categorieën: abonnement · betaling · technisch probleem · gebruiksvraag · privacy · accountbeveiliging · trainer/club · jeugd/ouder · datakoppeling · refund/chargeback · overige.

Hergebruik `support_tickets`, `support_ticket_messages` en `helpdesk_turns`. **Geen tweede ticketsysteem.**

**Het lidnummer is uitsluitend referentie.** Voor accountwijziging, refund, inzage of verwijdering blijft een beveiligde identiteitscontrole vereist — een beller die een lidnummer noemt is daarmee niet geïdentificeerd.

## 7. Bewaarmatrix

Eén **configureerbare** matrix per gegevenscategorie: profiel- en accountdata · routes · activiteiten · trainingen · gezondheids- en hersteldata · locatiegegevens · communicatie · supporttickets · privacyverzoeken · toestemmingshistorie · gebruiks- en fair-usedata · betalings- en factuuradministratie · fraudedossiers en chargebacks · auditlogs · back-ups · geanonimiseerde statistiek.

**Vastgesteld:** routegebruiks- en fair-usedata blijven 24 maanden herleidbaar, worden daarna onomkeerbaar geanonimiseerd, en niet-herleidbare statistiek mag daarna blijven bestaan voor trend-, kosten- en capaciteitsanalyse.

**Voor alle andere categorieën:** gebruik een reeds vastgelegde termijn wanneer die bestaat. Bestaat die niet, maak de termijn configureerbaar en **markeer hem als besluitpunt**. Replit stelt geen juridische termijn vast.

**Anonimisering moet werkelijk onomkeerbaar zijn:** directe identifiers weg · koppelsleutels weg of veilig vervangen · vrije tekst gecontroleerd · geen eenvoudige herleiding via een combinatie van velden. Bewijs dat laatste met een poging tot herleiding, niet met een bewering.

## 8. Accountverwijdering en privacyverzoeken

Flows voor: inzage · correctie · dataportabiliteit · beperking · bezwaar · toestemming intrekken · accountverwijdering · anonimisering · wettelijke bewaarplicht · privacy hold bij lopend geschil.

**Accountverwijdering, in deze volgorde:** identiteit controleren → gevolgen tonen → export aanbieden → controleren op actieve betaling, refund, chargeback, geschil en wettelijke bewaarplicht → server-side verwijder- of anonimiseerplan maken → **dry-run/preview** → pas na bevestiging uitvoeren → auditbewijs bewaren zonder onnodige inhoudelijke persoonsgegevens → back-ups via de gedocumenteerde rotatie laten uitfaseren.

Bouw voort op het bestaande verwijderverzoek in `routes/account.ts`, inclusief het annuleervenster op L233.

**Verwijdering is nooit client-side uitvoerbaar en nooit via één onbeschermde endpointaanroep.**

## 9. Uitzonderingsprotocollen

Werk uit: overlijden · langdurige ziekte of onbekwaamheid · vertegenwoordiger of nabestaande meldt zich · minderjarige wordt meerderjarig · ouder trekt toestemming in · trainer stopt · club stopt · club verwijdert een jeugdlid · bedrijf pauzeert tijdelijk · Sparki stopt geheel · datalek · accountovername · fraude · langdurige storing van Stripe of Clerk · langdurige storing van Strava of Garmin · solo-founder niet beschikbaar.

Per protocol: wie mag starten · vereiste verificatie · bevoegde beheerder · tijdelijke status · toegangsgevolgen · betalingsgevolgen · datagevolgen · communicatie · auditlog · herstel- of afsluitstap.

Hergebruik `SPARKI_FOUNDER_SUCCESSION_CONTINUITY_v1.0.md` voor de laatste drie; ontwerp daar niets nieuws naast.

**Twee harde regels.** `DECEASED` zetten vereist verificatie en een bevoegde beheerder, stopt facturatie, en verwijdert **niets** — een verkeerd gezette overlijdensstatus mag omkeerbaar zijn. En: **geen gevoelige actie wordt definitief uitgevoerd door de AI-helpdesk.** AI mag triëren en voorbereiden; een bevoegde workflow of beheerder beslist.

## 10. Admin, rechten en audit

Fijnmazige bevoegdheden. Niet elke beheerder mag automatisch: refunds uitvoeren · privacydata bekijken · een account verwijderen · `DECEASED` zetten · een privacy hold opheffen · abonnementen wijzigen.

Gebruik de bestaande admin- en rechtenarchitectuur; voeg alleen ontbrekende bevoegdheden toe.

**Auditlog** via het bestaande `admin_ops_log`, uitgebreid waar velden ontbreken: wie · wanneer · actie · reden · oude waarde · nieuwe waarde · betrokken lidnummer · bron (gebruiker, admin, webhook, systeemjob) · correlatie-ID. Rijen worden nooit verwijderd — dat is al de bestaande belofte van die tabel.

**Geen enkele knop verwijdert alle abonnees, logs of levenscyclusdata zonder dubbele bevestiging.**

## 11. Automatische jobs

Idempotente jobs voor: grace afhandelen · definitieve downgrade · verlopen trials · geplande opzegging · dataretentie · anonimisering na 24 maanden · deletion pending · back-upuitfasering voor verwijderde accounts · controle op verweesde Stripe- of Clerk-koppelingen.

**Elke nieuwe destructieve job start verplicht in dry-run/rapportagestand** en wijzigt pas gegevens na controle. Een job die per ongeluk in uitvoerstand start is een afkeuringsgrond.

## 12. E-mails

Templates voor: registratie met lidnummer · start proefperiode · upgrade · downgrade · pauzeren · hervatten · opzegbevestiging · einde abonnement · mislukte betaling · grace · geslaagde betaalreparatie · refund · chargeback waar passend · privacyverzoek ontvangen · export gereed · verwijdering gepland · verwijdering afgerond · toestemming ingetrokken · overlijden- en nabestaandenprocedure.

Geen onnodige gevoelige gegevens in e-mails. Veilige links met beperkte geldigheid waar nodig. Formele afzender- en juridische communicatie mag de merknaam gebruiken waar functioneel noodzakelijk.

## 13. Migratie en veiligheid

Bestaande gebruikers en Stripe-koppelingen behouden · geen dubbele lidnummers · geen pakketwijziging zonder aanleiding · geen terugwerkende verwijdering · eerst inventariseren welke tabellen en statussen al bestaan · bestaande services hergebruiken · migratie testen op een verse database **én** op een kopie met bestaande data · rij-aantallen, conflicten en uitzonderingen rapporteren · onzekere gegevens in quarantaine, niet willekeurig corrigeren.

**Geen productiegegevens verwijderen in de bouw- of testfase.**

---

## Tests

De 33 tests uit de opdracht gelden onverkort. Aanvullend verplicht:

34. het lidnummer wordt in dezelfde transactie als het account aangemaakt; faalt de registratie, dan bestaat er geen los nummer;
35. de migratie is idempotent: tweemaal draaien levert geen tweede nummer;
36. een verwijderd lidnummer wordt niet opnieuw uitgegeven;
37. een conflict tussen Clerk, Stripe en Sparki leidt tot een zichtbare conflictstatus en niet tot stilzwijgend één winnaar;
38. `DECEASED` stopt facturatie en verwijdert niets;
39. anonimisering doorstaat een gerichte herleidingspoging via combinaties van velden;
40. de AI-helpdesk kan geen enkele gevoelige actie definitief uitvoeren.

## Acceptatiecriteria

1. Elk account heeft precies één permanent, uniek lidnummer, afgedwongen in de database.
2. Het lidnummer geeft nergens toegang.
3. Eén leidende actuele pakketstatus per account; historie apart traceerbaar.
4. Elke levenscyclusstatus vertaalt naar bestaande rechten; geen tweede rechtensysteem.
5. Opzeggen, pauzeren, downgraden, deactiveren en verwijderen zijn vijf gescheiden flows.
6. Geen betaalincident verwijdert gebruikersdata.
7. Bewaartermijnen zijn configureerbaar; niet-besloten termijnen zijn gemarkeerd, niet ingevuld.
8. Anonimisering is aantoonbaar onomkeerbaar.
9. Verwijdering verloopt uitsluitend via dry-run en bevestiging, server-side.
10. Fijnmazige adminbevoegdheden; geen gevoelige actie zonder bevoegdheid en audit.
11. Elke destructieve job start in dry-run.
12. `admin_ops_log` bevat alle vereiste velden en verliest geen rijen.
13. Alle tests groen, typecheck exit 0.
14. Geen wijziging aan de betaalflow of de entitlementpoorten uit `ABONNEMENT_01`.

## Bewijsformat

Per regel: commando, resultaat, exitcode. Verder: de vertaaltabel levenscyclusstatus → onderliggende status → rechten · de bewaarmatrix met per categorie de bron van de termijn of de markering "besluitpunt" · de migratieuitvoer op verse database én kopie, met rij-aantallen en conflicten · het resultaat van de gelijktijdige-registratietest · de herleidingspoging na anonimisering · de dry-runuitvoer van elke destructieve job · een auditlogregel van elke gevoelige actie · start- en eindcommit · gewijzigde bestanden.

## Stopcondities

- een bestaande gebruiker kan geen uniek lidnummer krijgen zonder gegevensconflict;
- de bronverantwoordelijkheid tussen Clerk, Stripe en Sparki is niet eenduidig te maken zonder productbesluit;
- een bewaartermijn is nodig voor de bouw maar juridisch niet vastgesteld;
- anonimisering blijkt herleidbaar en dat is niet op te lossen zonder gegevensverlies;
- een uitzonderingsprotocol vereist een bevoegdheid die het huidige adminmodel niet kent;
- gedeeltelijke refund blijkt niet ondersteund — melden, niet bouwen.

## Werkregels

Geen tweede abonnementsarchitectuur naast `ABONNEMENT_01`. Geen juridische regels verzinnen. Geen persoonsgegevens langer bewaren "voor de zekerheid". Geen zichtbare flow verbergen om een defect te ontwijken. Geen productiegegevens verwijderen in bouw of test. Alle beslissingen server-side, fail-closed op rechten en nooit op data. Bij twijfel: melden en stoppen.

## Documentatie

`docs/SPARKI_ABONNEE_ADMINISTRATIE.md` — lidnummer, statusmachine met vertaaltabel, bewaarmatrix, uitzonderingsprotocollen en adminbevoegdheden.
