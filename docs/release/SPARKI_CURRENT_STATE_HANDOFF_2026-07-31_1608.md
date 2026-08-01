# Sparki — actuele stand en overdracht

**Datum/tijd:** 31 juli 2026, 16:08 CEST  
**Doel:** bron voor de eerstvolgende chat en vaste voortzetting richting besloten pilot en openbare release.

## 1. Huidige voortgang

- Totale weg naar een openbare betaalde release: **circa 60%**.
- Richting besloten pilot: **circa 70%**.
- Technisch fundament: **circa 80%**.
- Commercieel en operationeel releaseklaar: **circa 45–50%**.

De percentages zijn richtinggevend. Vandaag is vooral release-hardening uitgevoerd: rechten, herkomst van kernwaarden, billinginventarisatie, regressiepoorten en PR-governance. Dit levert minder zichtbare functies op, maar maakt de stand betrouwbaarder.

## 2. Afgerond

### Structuur en rollen

- WP-R0 afgerond: vaste testidentiteiten, rolbewuste DEV Preview, TESTCONTEXT en server-side rechtenbewijs.
- WP-R1 ouderomgeving afgerond: eigen navigatie, kindselectie, ouderrechten en fail-closed schrijfblokkades.
- Het eerder gevonden coach-cockpit-rechtenlek is opgelost en is **geen open taak meer**.

### Kernwaarden en analyse

- WP-K1 afgerond: kernwaarden en herkomst worden atomair opgeslagen.
- WP-K2 afgerond: herkomststatus zichtbaar bij FTP en gewicht.
- WP-K3 afgerond: geen valse “nog niet bekend”-meldingen tijdens laden.
- WP-K5 afgerond: Doelscenario en Wattage-lab tonen “Verkenning · simulatie”.
- Commit hoofdwerk: `e57be79b`.
- Reviewherstel: `00539231`.

### Billing en entitlements

- Delta-inventarisatie afgerond in `docs/product/BILLING_ENTITLEMENTS_DELTA_INVENTARISATIE_2026-07-31.md`.
- Inventarisatiecommit: `9510fc6f`.
- Factcheckcorrectie INV-4: `a0f46717`.
- Billingherstel 1 afgerond: `9ace581d`.
- `test:entitlements` draait zelfstandig en platformveilig groen: 19/19.
- Billingtests: 14/14.
- Interne namen `sparki_basic`, `sparki_performance`, `sparki_pro` en `sparki_go` lekken niet meer via het klantgerichte `/api/entitlements`-antwoord.
- Klantlabels zijn: Gratis · Sparki Go · Sparki Compleet.
- De rechtenmotor en bestaande gates zijn bij Billingherstel 1 niet inhoudelijk gewijzigd.

### Stripe Sandbox

Aangemaakt en gecontroleerd:

- Sparki Go: €2,99 per maand.
- Sparki Go: €29,90 per jaar.
- Sparki Compleet: €9,99 per maand.
- Sparki Compleet: €99,90 per jaar.

Proefperioden worden niet in het productcatalogusscherm ingericht. Zij horen in de Checkout-/abonnementsflow:

- Go: 7 dagen.
- Compleet: 14 dagen.

Er zijn nog geen live sleutels, live webhooks of echte betalingen geactiveerd.

### Productbesluit Go versus Compleet

Vast besluit:

- Go moet een volwaardig, prettig en zelfstandig bruikbaar pakket zijn.
- Go mag niet aanvoelen als een uitgeklede app vol slotjes en grijze kaarten.
- Compleet voegt vooral extra diepte, langere historie, geavanceerdere analyses, scenario’s en rijkere begeleiding toe.
- Volledige Compleet-onderdelen blijven buiten de normale Go-navigatie wanneer zij daar hinderlijk zouden zijn.
- Upgradeverwijzingen verschijnen alleen rustig en contextueel.
- Op één abonnementenvergelijking mag de volledige meerwaarde zichtbaar zijn.
- Server-side rechten blijven altijd leidend.
- De plannerweergave “Wedstrijd” is geen abonnement.
- Voorlopig productbesluit: trainingen koppelen binnen de Wedstrijd-weergave hoort bij Go; de weergave zelf blijft gratis.

### Voorlopige pakketlijn

**Gratis**

- Vandaag.
- Activiteiten.
- Routes en navigatie.
- Klimmen.
- Materiaal.
- Kennisbank.
- Profiel en Sportpaspoort.
- Basis kalender.
- Sociale basisfuncties.

**Sparki Go**

- Persoonlijk adaptief trainingsplan.
- Performance Lab met normale historie en analyse.
- Race-intelligentie.
- Praktische AI-begeleiding.
- Herstel- en trainingsadvies.
- Trainingen koppelen in de Wedstrijd-weergave.

**Sparki Compleet — voorgestelde extra verdieping**

- Analyse over meerdere seizoenen.
- Diepere vermogens- en belastingstrends.
- Uitgebreide periodevergelijking.
- Meerdere trainingsscenario’s en periodiseringen.
- Uitgebreider Wattage-lab met opgeslagen scenario’s.
- Diepere wedstrijdanalyse en historische vergelijking.
- Uitgebreidere AI-onderbouwing.
- Uitgebreidere rapportage en export.

Deze Compleet-verdieping is nog niet gebouwd. Technisch is Compleet vandaag nog gelijk aan Go.

## 3. Lopend of uitgezet bij Claude

### Claude Mirror — aanvulling pakketmatrix

Claude Mirror onderzoekt uitsluitend:

1. Doelscenario en Wattage-lab.
2. Kalender.
3. Lichaam.
4. Foto Lab.
5. Wedstrijd-room.
6. Club en clubbeheer.

Vereisten: actuele HEAD, echte kliktests, Gratis/Go/Compleet, mobiel/desktop, bewijs met SHA/identiteit/rol/viewport. Geen codewijzigingen.

### Claude — releasevoorbereidingsdossier

Claude bereidt één dossier voor met:

- Stripe-liveconfiguratie.
- BTW/OSS-vragen voor de accountant.
- Opzeggen, terugbetaling en betalingsproblemen.
- Support/helpdesk.
- Monitoring en incidentprocedure.
- Back-up en herstel.
- Overdraagbare beheerhandleiding.
- Pilotfeedback en regressieherstel.
- Definitieve App/PWA-releasecontrole.

Alleen inventarisatie, procedures en checklists. Geen live acties.

### Claude — productgebruik, feedback en prijsontwikkeling

Claude bereidt voor hoe Sparki bij de eerste 100–300 gebruikers privacyvriendelijk kan meten:

- welke functies worden gebruikt;
- frequentie en retentie;
- afhakers en fouten;
- tevredenheid en opzeggingsredenen;
- gecontroleerde feature-uitrol;
- criteria voor prijsontwikkeling van Go: €2,99 → €4,99 → mogelijk €5,99.

Geen automatische prijsverhoging. Een verhoging volgt alleen na aantoonbare extra waarde, stabiel gebruik, voldoende tevredenheid en beheersbare supportdruk.

## 4. PR-governance — actuele blokkade

PR #1: `task-507-pr-governance`.

De GitHub Actions-poort werkt echt. De eerste run had:

- typecheck groen;
- validators rood;
- admin-smoke rood.

Bewezen oorzaken:

1. Validators draaide zonder dependency-installatie en vond het `yaml`-pakket niet.
2. Admin-smoke startte tegen een verse database zonder `user_profiles`-rij; dev-auth viel terug op een niet-bestaande eerste gebruiker en gaf 401/0 van 13.

De fix staat klaar in commit `20ad9b26` op de lokale/werkbranch:

- installatiestap toegevoegd aan validators;
- seedstap en `DEV_AUTH_CLERK_ID` toegevoegd aan admin-smoke;
- geen controle verlaagd of omzeild.

Blokkade: de gekoppelde GitHub-token mist de `workflow`-scope en weigert een push die `.github/workflows/pr-checks.yml` wijzigt.

Volgende handeling voor René:

- GitHub opnieuw aan Replit koppelen met workflow-scope, waarna Replit commit `20ad9b26` kan pushen; **of**
- de inhoud van het aangepaste workflowbestand via GitHub-web zelf committen op branch `task-507-pr-governance`.

Daarna wachten tot validators, typecheck en admin-smoke alle drie groen zijn. PR nog niet mergen voordat alles groen is.

## 5. Releasewerkpakketten die nog nodig zijn

### Voor besloten pilot

1. **PR-governance afronden**  
   Drie verplichte checks groen en PR correct mergen.

2. **Definitieve pakketmatrix**  
   Claude-aanvulling beoordelen, keuzes vastleggen en daarna één gerichte Replit-bouwopdracht.

3. **Stripe Sandbox end-to-end**  
   Checkout, proefperiode, betaling, webhook, portal, opzeggen, verlopen/mislukte betaling, refund en terugval naar Gratis aantonen.

4. **Productie- en data-trust-eindcontrole**  
   Geen mock/fallback persoonlijke data, eerlijke lege toestanden, correcte kernwaardenherkomst, geen DEV/testfuncties in productie.

5. **Kernflows pilotrelease**  
   Aanmelden, onboarding, sportdata koppelen, Vandaag, Plan, uitvoeren/importeren, analyse, routes/navigatie en abonnement beheren.

6. **Juridische en operationele pilotvoorwaarden**  
   Privacy, voorwaarden, medische grenzen, minderjarigen, account verwijderen/export, support en storingsmelding.

7. **Releasecandidate en praktijktest**  
   Eén vaste SHA, automatische straat groen, Claude Mirror-test, René-test en Dylan-test.

### Voor openbare betaalde release

- Echte Stripe-liveconfiguratie.
- BTW/OSS-besluiten met accountant.
- Live webhooks en productiecontrole.
- Terugbetalings- en opzeggingsproces.
- Support/helpdesk.
- Monitoring en incidentprocedure.
- Back-up en herstel.
- Overdraagbare beheerhandleiding.
- Pilotfeedback en regressieherstel.
- Definitieve App/PWA-releasecontrole.

## 6. Bewust later

Niet nodig vóór de eerste besloten pilot, tenzij de pilotdoelgroep dit direct vereist:

- volledige clubcommercialisering;
- volledige ploegleider-/mechaniekeromgeving;
- betaler voor meerdere kinderen;
- WP-K4 centrale belastingsdrempels;
- WP-K6 uitgebreide bronconflicten;
- Samen op eerste navigatieniveau (#10);
- wielercategorieënmapping (#12);
- ramp-rate-uitbreiding (#13);
- multisport.

## 7. Eerstvolgende volgorde in de nieuwe chat

1. Controleer resultaat van Claude Mirror pakketmatrix-aanvulling.
2. Controleer Claude-releasevoorbereidingsdossier.
3. Controleer Claude-productgebruik/feedback/prijsdossier.
4. Los GitHub workflow-scope op en maak PR 507 volledig groen.
5. Leg definitieve Gratis · Go · Compleet-matrix vast.
6. Geef Replit één kleine bouwopdracht voor de goedgekeurde matrix.
7. Test daarna de volledige Stripe Sandbox-flow.
8. Start vervolgens de release-eindcontrole en besloten pilotvoorbereiding.

## 8. Vaste werkwijze

- Bron van waarheid: actuele repository en vaste commit-SHA.
- Bestaande werkende architectuur behouden en gericht uitbreiden.
- Geen parallelle systemen of brede herschrijvingen.
- Claude onderzoekt en bereidt voor.
- René neemt product- en bedrijfsbesluiten.
- Replit bouwt alleen goedgekeurde kleine werkpakketten.
- Claude Mirror klikt de echte werking door en levert bewijs.
- Agents-first testen; René en Dylan blijven primaire menselijke praktijktesters.

---

**Status bij afsluiten:** geen nieuwe Replit-bouwopdracht actief; Claude-opdrachten kunnen nog lopen. De eerstvolgende chat begint met het beoordelen van de drie Claude-resultaten en het oplossen van de PR-workflowpush.