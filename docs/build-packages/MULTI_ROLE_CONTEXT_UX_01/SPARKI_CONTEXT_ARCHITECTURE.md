# SPARKI_CONTEXT_ARCHITECTURE

**Regelcodes:** `CTX-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026
Bindende bron voor rechten en rollen blijft `CLUB_RECHTEN_01`. Dit document beschrijft **welke context actief is**, niet **wat die context mag**.

---

## 1. Het contextobject

**CTX-01:** een context is één samenhangend geheel van vijf onderdelen:

| Onderdeel | Betekenis | Verplicht |
|---|---|---|
| **Rol** | De rolwaarde zoals die **server-side bestaat** — zie `CTX-01a` | Ja |
| **Organisatie** | Club, team of `Privé` | Ja |
| **Organisatietype** | `CLUB` · `TEAM` · `PRIVE` | Ja |
| **Bereik** | Team, groep, selectie of leeg | Nee |
| **Onderwerp** | De sporter of het kind waarvoor gewerkt wordt | Alleen bij ouder-/verzorger- en enkelsporter-contexten |

**CTX-01a — welke rollen een context krijgen (`MR-B02 = C`):** **alle rolwaarden die server-side bestaan**, en verder niets. Er is geen vaste lijst in dit document, omdat een lijst veroudert zodra er een rolwaarde bijkomt of vervalt. Gevolgen die hieruit volgen en niet apart besloten hoeven te worden:
- `teammanager` krijgt een context, ook al ontbrak die in de opdracht — hij bestaat server-side en wordt bij een `TEAM` standaard aan de eigenaar toegekend;
- `ploegleider` krijgt een context: de rolwaarde bestaat server-side sinds `30ad85f`;
- de medische rol heet `medical_staff`; `medic` is `INGETROKKEN` en levert dus geen context;
- `gast` krijgt **geen** context zolang er geen server-side rolwaarde met die naam bestaat. Een gast is dan een toestand vóór er contexten zijn, geen context;
- verschijnt er later een nieuwe rolwaarde, dan verschijnt de context vanzelf — zonder dat dit document wijzigt.

**CTX-01b:** de bestaande regel *geen rolomgeving vóór de rolwaarde server-side bestaat* blijft daarmee automatisch gehandhaafd: er kan geen context bestaan voor een rol die er niet is.

**CTX-02:** daarnaast draagt een context de **relatie** met de organisatie: `owner` of geen. Die relatie is geen rol (`MRU-06`) en verleent zelf geen rechten; zij bepaalt de gebruikersnaam in beeld (Clubeigenaar, Teameigenaar) en of de beveiligde handeling *eigendomsoverdracht* zichtbaar is.

**CTX-03:** `Privé` is een volwaardige organisatie met type `PRIVE`. De sportercontext van een gebruiker zonder club is dus geen uitzondering maar een gewone context — dat voorkomt dat er twee soorten "geen organisatie" ontstaan.

**CTX-04:** een context is **uniek** op de combinatie rol + organisatie + bereik + onderwerp. Twee contexten die alleen in bereik verschillen (Trainer · Club A · U19 en Trainer · Club A · U17) zijn twee contexten, geen filter binnen één context.

## 2. Voorbeeld

```
Gebruiker
├── Sporter          → Privé
├── Trainer          → Club A → U19
├── Trainer          → Club A → U17
├── Clubbeheerder    → Club B          (relatie: owner → "Clubeigenaar")
└── Ouder            → Privé → kind
```
Vijf contexten, één account, één login.

## 3. Contextstatus per gebruiker

| Veld | Betekenis |
|---|---|
| **Beschikbare contexten** | Alle contexten die uit de server-side rollen en relaties volgen |
| **Actieve context** | Precies één, altijd |
| **Actieve rol / organisatie / bereik / onderwerp** | De onderdelen van de actieve context, afzonderlijk opvraagbaar voor weergave |
| **Contexthistorie** | De laatst gebruikte contexten in volgorde van gebruik |
| **Laatst gebruikte context** | Wat bij een volgende sessie wordt hersteld |
| **Favorieten** | Door de gebruiker gemarkeerde contexten |

**CTX-05:** er is **altijd precies één** actieve context. Er bestaat geen toestand "geen rol gekozen" behalve in het keuzemoment beschreven in `CTX-09`.
**CTX-06:** de beschikbare contexten worden **server-side afgeleid** uit rollen en relaties. De client krijgt een lijst; hij stelt hem niet samen en vult hem niet aan.
**CTX-07:** contexthistorie en favorieten zijn gebruikersgegevens, geen rechten. Een context die uit de rechten verdwijnt, verdwijnt uit de lijst — ook als hij favoriet was.

## 4. Welke context is actief bij binnenkomst

**CTX-08 — volgorde van bepaling:**
1. Een **deep link** die een context meedraagt en waarvoor de gebruiker rechten heeft.
2. De **laatst gebruikte context**, mits die nog bestaat en nog is toegestaan.
3. De **enige** context, als er maar één is.
4. Anders: een expliciete keuze.

**CTX-09:** in geval 4 toont Sparki een **keuzescherm**, geen willekeurige keuze en geen alfabetische standaard. Dit is het enige moment waarop er geen actieve context is.
**CTX-10:** bestaat de laatst gebruikte context niet meer (rol ingetrokken, club verlaten, team opgeheven), dan wordt dat **gemeld** met reden en volgt het keuzescherm. Geen stille terugval naar een andere context.

## 5. Wisselen

**CTX-11:** een contextwissel is een **server-side handeling**. De server stelt vast of de context bestaat en toegestaan is, en levert de nieuwe rechtenset terug. De client kiest niet.
**CTX-12:** de wissel is **atomair**: of de nieuwe context is volledig actief, of de oude blijft staan. Er bestaat geen tussentoestand waarin de rol al is gewisseld en de rechten nog niet.
**CTX-13:** bij een geweigerde wissel blijft de oude context actief en volgt een begrijpelijke melding met de reden. Fail-closed: twijfel leidt tot de **beperktere** toestand, nooit tot de ruimere.
**CTX-14:** elke wissel wordt vastgelegd: tijdstip · van-context · naar-context · aanleiding (handmatig, deep link, notificatie) · resultaat.

## 6. Wat aan de context hangt en wat aan het account

| Contextgebonden | Accountgebonden |
|---|---|
| Rechten en scopes | Login en sessie |
| Navigatie-inhoud en dashboard | Taal |
| Notificatiefilter | Thema, tekstgrootte, verminderde beweging |
| Zoekbereik en zoekresultaten | Toegankelijkheidsinstellingen |
| Filters, sorteringen, kolomkeuzes | Meldingsvoorkeuren op accountniveau |
| Breadcrumbs en open detailvensters | Profielgegevens |
| AI-context | Beveiligingsinstellingen |

**CTX-15:** een gegeven staat in precies één kolom. Een instelling die "eigenlijk allebei" is, is een ontwerpfout en wordt opgelost door hem contextgebonden te maken — dat is de veilige kant.

## 7. Rechten

**CTX-16:** de contextlaag **kent geen rechten toe**. Zij vraagt ze op bij `CLUB_RECHTEN_01` en toont ze. Er komt geen tweede rollen-, rechten- of scopemodel.
**CTX-17:** de client cachet rechten uitsluitend voor de **actieve** context en niet langer dan de sessie. Een rechtenwijziging server-side leidt bij de eerstvolgende handeling tot de nieuwe uitkomst, niet tot de gecachte.
**CTX-18:** wordt een rol ingetrokken terwijl de gebruiker erin werkt, dan wordt de context bij de eerstvolgende handeling geweigerd, wordt de gebruiker geïnformeerd met reden, en volgt het keuzescherm. Wat er met onafgemaakt werk gebeurt is `MR-B05`.

## 8. Meerdere organisaties, teams en sporters

**CTX-19:** meerdere clubs, meerdere teams en meerdere sporters zijn **geen bijzonder geval**. De architectuur kent geen "hoofdclub" en geen impliciete voorkeur.
**CTX-20:** een trainer met meerdere groepen binnen dezelfde club heeft per groep een context (`CTX-04`); een trainer die groepsoverstijgend werkt heeft daarnaast een context met leeg bereik, mits zijn rechten dat toestaan. Welke van die twee de standaard is, is `MR-B06`.
**CTX-21:** een ouder met meerdere kinderen heeft per kind een context. Er komt **geen** gecombineerd ouderoverzicht over kinderen heen zonder dat de rechten per kind afzonderlijk zijn gecontroleerd; of dat overzicht er komt is `MR-B07`.

## 9. AI-context

**CTX-22:** de AI werkt **uitsluitend** binnen de actieve context. "Laat de planning zien" betekent: de planning van de sporters in de trainercontext, de clubplanning in de clubbeheercontext, de eigen planning in de sportercontext.
**CTX-23:** de AI wisselt **nooit** zelf van context en stelt dat ook niet ongevraagd voor tijdens navigatie, training, wedstrijd, onboarding of een formulier (`MUX-90`).
**CTX-24:** kan een vraag alleen in een andere context worden beantwoord, dan zegt de AI dat, noemt de context, en biedt de wissel aan als **handeling van de gebruiker** — met de gevolgen erbij (`MRU-23`).
**CTX-25:** de AI benoemt bij elk antwoord waarop het berust: welke context, welke gegevens, welke onzekerheid (`MUX-91`). Een antwoord zonder contextvermelding is onvolledig zodra de gebruiker meerdere contexten heeft.
**CTX-26:** de AI mag nooit gegevens uit een andere context gebruiken om een antwoord in de huidige context te verrijken, ook niet wanneer de gebruiker in beide contexten rechten heeft.

## 10. Notificaties

**CTX-27:** elke notificatie draagt de context waarin zij thuishoort. "Nieuwe trainingsfeedback" hoort in de trainercontext, niet in de sportercontext.
**CTX-28:** een notificatie wordt getoond ongeacht de actieve context — anders mist de gebruiker meldingen uit rollen waar hij nu niet in werkt. Zij toont daarbij **zichtbaar** bij welke rol en organisatie zij hoort.
**CTX-29:** bij aantikken opent Sparki **in de juiste context**, met een zichtbare bevestiging dat de context is gewisseld. Dit is de enige situatie waarin een wissel niet begint met een handeling in de rolwisselaar — en zij wordt daarom altijd expliciet getoond.
**CTX-30:** heeft de gebruiker onafgemaakt werk, dan geldt `MRU-23` ook hier: eerst bevestigen, dan wisselen.
**CTX-31:** een notificatie bevat nooit inhoud die de gebruiker in zijn huidige context niet mag zien. De **titel** is contextvrij; de inhoud verschijnt pas na de wissel.

## 11. Deep links

**CTX-32:** een deep link draagt de context mee. Bij openen wordt server-side gecontroleerd of de gebruiker die context heeft; zo niet, dan volgt een weigering met reden — geen stille opening in een andere context, en geen aanwijzing over de inhoud die achter de link zat.
**CTX-33:** een deep link mag nooit als **rechtenbewijs** werken. Het bezit van de link zegt niets; de rechten zeggen alles.

## 12. Verboden in de architectuur

- Een tweede rollen-, rechten- of scopemodel naast `CLUB_RECHTEN_01`.
- Client-side samenstellen of aanvullen van de lijst met beschikbare contexten.
- Een tussentoestand waarin rol en rechten niet overeenkomen.
- Stille terugval naar een andere context wanneer de gewenste niet meer bestaat.
- Rechten die langer gecacht worden dan de sessie of over een contextwissel heen.
- Een context zonder organisatie (gebruik type `PRIVE`).
- Automatische contextwissel zonder handeling en zonder zichtbare bevestiging.
