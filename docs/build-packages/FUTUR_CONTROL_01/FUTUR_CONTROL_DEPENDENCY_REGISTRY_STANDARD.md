# FUTUR_CONTROL_DEPENDENCY_REGISTRY_STANDARD

**Regelcodes:** `DEP-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026
Generiek register van externe diensten waarvan de producten afhankelijk zijn.

---

## 1. Waarom dit register bestaat

De meeste storingen in een klein softwarelandschap komen niet uit de eigen code maar uit een dienst van iemand anders: een verlopen sleutel, een gewijzigde API-versie, een quota, een webhook die stil stopt. Zonder register merkt de beheerder dat pas als een gebruiker klaagt.

| Code | Regel |
|---|---|
| DEP-01 | Elke externe afhankelijkheid van elk aangesloten product staat in dit register. Ook de saaie. |
| DEP-02 | Het register is **generiek**: dezelfde velden voor elke dienst, ongeacht leverancier. |
| DEP-03 | Onbekende velden blijven `Onbekend`. Er worden geen leveranciersgegevens overgenomen die niet zijn geverifieerd. |
| DEP-04 | Een dienst is pas `Gezond` na een **functionele** controle (zie `FUTUR_CONTROL_HEALTHCHECK_STANDARD.md`), niet na een geslaagde ping. |
| DEP-05 | De statuspagina van een leverancier is een signaal, geen bewijs. Een groene statuspagina overschrijft nooit een eigen mislukte functionele controle. |

## 2. Velden per externe dienst

**Identiteit** — dienst-ID · leverancier · gekoppelde producten · doel · gebruikte functies · omgeving (test/acceptatie/productie) · verantwoordelijke eigenaar.

**Toegang** — authenticatiemethode · sleutel- of certificaatstatus (bestaat, leeftijd, verloopdatum, laatste rotatie) · webhookstatus.

**Werking** — statuspagina · actuele bereikbaarheid · responstijd · foutpercentage · laatste succesvolle **functionele** controle · laatste fout.

**Belasting en geld** — quota · rate limits · gebruik · kosten · contract- of verlengdatum.

**Houdbaarheid** — gebruikte API-versie · aangekondigde uitfasering · migratiepad indien bekend.

**Risico** — datastromen (welke gegevens gaan erheen) · privacyrisico · beveiligingsrisico.

**Weerbaarheid** — fallback · retrybeleid · incidentprocedure · exitstrategie · getroffen productfuncties.

**DEP-06:** *getroffen productfuncties* is een **relatie**, geen tekstveld. Zij vormt de tweede schakel van de impactketen en moet aanklikbaar zijn.
**DEP-07:** *kosten* en *contractdatum* worden vastgelegd als beheerfeit, niet als financiële administratie. Control is geen boekhouding.
**DEP-08:** *exitstrategie* mag `Onbekend` zijn, maar het veld verdwijnt niet. Een dienst zonder exitstrategie is een bekend risico, geen onbestaand risico.

## 3. Risicoclassificatie

| Klasse | Betekenis | Gevolg |
|---|---|---|
| **Kritiek** | Uitval maakt een kernfunctie onbruikbaar en er is geen fallback | Verschijnt bij storing direct op *Vandaag als beheerder*, kaart 1 |
| **Belangrijk** | Uitval degradeert een functie of raakt een deel van de gebruikers | Zichtbaar in Product Health, incident bij aanhouden |
| **Ondersteunend** | Uitval is merkbaar maar niet blokkerend | Waarschuwing, geen incident |
| **Administratief** | Geen gebruikersimpact (bijv. facturatieportaal) | Alleen registratie |

**DEP-09:** de klasse wordt bepaald door de **impactketen**, niet door de bekendheid van de leverancier. Een kleine kaarttegelprovider kan kritiek zijn terwijl een grote clouddienst dat niet is.

## 4. Startlijst Sparki

Deze diensten worden voor Sparki minimaal opgenomen. **Alle regels starten leeg**: aanwezigheid in deze lijst is een opdracht tot verificatie in F0, geen bewering dat Sparki de dienst gebruikt.

| Dienst | Vermoedelijk doel | Status nu |
|---|---|---|
| Stripe | Betalingen, abonnementen, webhooks | Aanwezig volgens eerdere vastlegging; details `Onbekend` |
| OpenStreetMap | Kaartdata, zoeken | Te verifiëren in F0 |
| GraphHopper | Routeberekening | Te verifiëren in F0 |
| Kaarttegelprovider(s) | Kaartweergave | Te verifiëren in F0 — mogelijk meerdere |
| Garmin | Activiteitensynchronisatie | Te verifiëren in F0 |
| Strava | Activiteitensynchronisatie | Te verifiëren in F0 |
| Whoop | Herstel-/gezondheidsdata | Te verifiëren in F0 — koppeling niet bevestigd |
| Authenticatievoorziening | Aanmelden en identiteit | Leverancier te verifiëren in F0 |
| E-mailprovider | Transactionele e-mail | Te verifiëren in F0 |
| Pushnotificaties | Meldingen | Te verifiëren in F0 |
| Database | Gegevensopslag | Aanwezig; leverancier/hosting te verifiëren |
| Hosting | Uitvoering van het product | Te verifiëren in F0 |
| Objectopslag | Media, exports, rapporten | Te verifiëren in F0 |
| GitHub | Repository, CI, releases | Aanwezig volgens eerdere vastlegging |
| Replit | Bouw en deployment | Aanwezig volgens eerdere vastlegging |
| Logging | Applicatielogs | Bestaan en leverancier `Onbekend` |
| Monitoring | Uptime, alerting | Bestaan en leverancier `Onbekend` |
| Analytics | Gebruiksmeting | Vermoedelijk beperkt aanwezig; `Onbekend` |
| Domeinen | Domeinregistratie | Te verifiëren in F0 |
| DNS | Naamresolutie | Te verifiëren in F0 |
| TLS-certificaten | Versleuteling | Te verifiëren in F0 |

**DEP-10:** deze tabel wordt in F0 ingevuld met vindplaats per regel. Een regel die na F0 nog `Onbekend` is, blijft `Onbekend` — er wordt niets aangenomen op grond van wat gebruikelijk is.

## 5. Bewaking per dienst

**DEP-11:** per dienst wordt bewaakt: bereikbaarheid · functionele controle · responstijd · foutpercentage · quotaverbruik · sleutel- en certificaatverloop · webhookactiviteit · aangekondigde uitfasering.
**DEP-11a:** bewaking is **lezend**. Control roteert geen sleutels, verlengt geen certificaten, past geen quota aan, herstelt geen webhook en wijzigt geen instelling bij een leverancier. Bij een naderend verloop meldt het, met de handeling die nodig is en wie die kan doen.
**DEP-12:** een **naderend verloop** (sleutel, certificaat, contract, API-versie) is een waarschuwing met eigen aanlooptijd per type, niet een melding op de dag zelf.
**DEP-13:** een webhook die stopt zonder fout is een eigen signaal: *stilte* wordt bewaakt, niet alleen fouten. Verwachte frequentie per webhook wordt vastgelegd; uitblijven daarvan is `Aandacht nodig`.
**DEP-14:** quota worden bewaakt op verbruikssnelheid, niet alleen op de eindstand. Een quotum dat vier keer sneller loopt dan normaal is een signaal.

## 6. Koppeling met andere onderdelen

- **Product Health** — dienststatussen voeden de indicatoren API-gezondheid, synchronisaties, betalingsgezondheid en beveiligingsstatus.
- **Incidenten** — een verstoorde kritieke dienst kan een incident vormen, met de impactketen al ingevuld.
- **Capability Matrix** — een domein met een kritieke dienst zonder fallback toont dat als open blokkade.
- **Continuïteit** — exitstrategie en incidentprocedure per dienst zijn onderdeel van de continuïteitsdocumentatie.
- **Vandaag als beheerder** — kritieke dienststoringen verschijnen op kaart 1; overige diensten onder *Nieuwe waarschuwingen*.

## 7. Directe afkeurgronden

- Een dienst staat op `Gezond` op grond van bereikbaarheid alleen.
- Een leveranciersstatuspagina overschrijft een eigen mislukte functionele controle.
- Een dienst is opgenomen met verzonnen of overgenomen gegevens zonder verificatie.
- Sleutel- of certificaatverloop wordt niet bewaakt.
- *Getroffen productfuncties* is vrije tekst in plaats van een relatie.
- Een dienst zonder gekoppeld product staat in het register zonder reden.
