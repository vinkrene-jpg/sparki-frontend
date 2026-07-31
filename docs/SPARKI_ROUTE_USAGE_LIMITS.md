# Sparki routegebruik — telling en limieten

Vastgelegd als **SPARKI-BESLUIT-2026-003** (Besluit René 31-07-2026).
Dit document groeit per opdracht: 02a (telling, dit hoofdstuk), 02b (limiet en
reserveringen), 02c (opslag, verval en downgrade), 02d (admin en fair use).

## Hoofdstuk 1 — Telling van routegebruik (ROUTE_PAKKET_02A)

**Status: gebouwd. Alleen meten — er wordt voor niemand iets geblokkeerd,
beperkt of gemeld.**

### Productregels

Een route telt als **één gebruikte route** per gebruiker per kalendermaand
(Europe/Amsterdam) zodra één van deze gebeurtenissen plaatsvindt:

| usageType | Gebeurtenis | Stand |
|---|---|---|
| `SAVED` | Route definitief opgeslagen | actief |
| `GPX_EXPORTED` | Route succesvol als GPX geëxporteerd | actief |
| `RIDDEN_20_PERCENT` | ≥20% van de route in Sparki gereden | **vlag uit** (zie restpunt) |

- Plannen, routepunten verschuiven/herberekenen en bekijken tellen nooit
  (die paden roepen de registratie simpelweg niet aan).
- Dezelfde route telt binnen dezelfde kalendermaand één keer; opslaan én
  daarna exporteren is samen één.
- Mislukte opslag of mislukte export telt niet.
- Een kopie of wezenlijk gewijzigde route krijgt een eigen route-ID en telt
  afzonderlijk. "Wezenlijk gewijzigd" volgt de bestaande architectuur: een
  kopie (`POST /api/routes/:id/duplicate`, voorstel-accept/-aanpassing) is
  een **nieuwe routerij** met eigen ID; inhoudelijke bewerkingen op een
  bestaande route (`PUT /api/routes/:id`) verhogen alleen het versienummer
  van dezelfde route en tellen dus niet opnieuw.
- Er wordt gemeten voor **alle** pakketten (Gratis, Go, Compleet); het pakket
  wordt per registratie als momentopname vastgelegd (`subscriptionTier`) en
  nooit herrekend.

### Techniek

- **Tabel** `route_usage_registrations` (migratie
  `lib/db/migrations/0008_route_usage_registrations.sql`): `clerk_id`,
  `route_id` (zachte verwijzing — historie blijft bij verwijderen),
  `usage_type`, `occurred_at`, `calendar_month` ("YYYY-MM",
  Europe/Amsterdam), `subscription_tier`, `source`, `idempotency_key`.
  **Unieke index** op (clerk_id, route_id, calendar_month): idempotentie en
  gelijktijdigheid worden op databaseniveau afgedwongen
  (`onConflictDoNothing`), niet in applicatiecode.
- **Eén centrale registratiefunctie**: `recordRouteUsage()` in
  `artifacts/api-server/src/lib/route-usage-metering.ts`. Alle telling loopt
  server-side hierdoorheen; frontendwaarden zijn nooit leidend. In
  request-paden wordt `recordRouteUsageSafe()` gebruikt: de gebruikersactie
  faalt nooit door een telling-fout, maar zo'n fout wordt luid gelogd.
- **Tellende haakpunten** (allemaal `SAVED`, tenzij anders):
  `POST /api/routes` (generated + GPX-upload), bibliotheekroute overnemen,
  `POST /api/routes/from-activity`, `POST /api/routes/:id/duplicate`,
  `POST /api/route-candidates/:id/save`, routevoorstel accepteren of
  aangepast overnemen; en `GET /api/routes/:id/gpx` (`GPX_EXPORTED`, alleen
  bij succesvolle export, geregistreerd vóór het versturen van het bestand).
- **Tellerendpoint**: `GET /api/route-usage` →
  `{ calendarMonth, used, riddenTriggerEnabled, registrations: [{ routeId,
  usageType, occurredAt, source, subscriptionTier }] }` — huidige Amsterdamse
  kalendermaand van de ingelogde gebruiker.
- **Bestaande gegevens**: geen terugwerkende kracht. De tabel start leeg;
  bestaande routes, exports en ritten leiden niet tot registraties. Direct in
  de database gezette rijen (seed/mock/demo) tellen nooit mee — alleen de
  genoemde request-paden registreren.

### Privacybesluit bewaartermijn (besluit René 31-07-2026)

Gebruiks- en fair-usedata (routegebruik-registraties, en straks reserveringen,
routeberekeningen en fair-usemetingen uit 02b–02d) blijven **24 maanden
herleidbaar** tot de gebruiker; daarna worden ze **onomkeerbaar
geanonimiseerd** (koppeling met `clerk_id` verbroken, geaggregeerde telling
mag blijven). Dit besluit geldt uitsluitend voor deze categorieën, niet voor
andere gegevens. De geautomatiseerde anonimiseringsuitvoering wordt gebouwd
in hoofdstuk 3 (02c, opslag en verval); tot die tijd is er geen rij ouder dan
de termijn (de tabel is nieuw en start leeg), dus er kan nog niets buiten het
besluit vallen.

### Restpunt: de 20%-trigger staat uit

`RIDDEN_20_PERCENT` staat achter een aparte operationele vlag
(omgevingsvariabele `ROUTE_USAGE_RIDDEN_TRIGGER`, standaard uit). De vlag
staat **uit** omdat de server vandaag geen betrouwbare vastlegging heeft van
de **werkelijk afgelegde afstand op een geplande route**: er bestaan geen
server-side navigatiesessies of route-dekkingsgegevens (route-matching leeft
alleen op het mobiele apparaat, en geüploade ritten kennen geen koppeling
"zoveel km van route X gereden"). Conform de opdracht is er niet gegokt en
geen benadering gebouwd; de registratiefunctie ondersteunt het type al, zodat
alleen de gegevenslaag + aanroep nog nodig is zodra die laag bestaat (02b
bouwt navigatiesessie-reserveringen — het logische moment).

### Bewuste interpretatiekeuzes (gemeld, niet zelf beslist als product)

1. **TCX-export telt niet.** De opdracht noemt uitsluitend GPX. TCX-export
   (`GET /api/routes/:id/tcx`) is functioneel gelijkwaardig gebruik; als dit
   ook moet tellen is dat één regel werk.
2. **Export van een niet-opgeslagen routevoorstel telt niet.**
   `GET /api/routes/candidate/:candidateId/gpx` exporteert een voorstel dat
   nog geen stabiel route-ID heeft; de telling is per route-ID. Een gebruiker
   kan dus een voorstel exporteren zonder telling. Bevinding voor 02b.
3. **Door de planner gegenereerde trainingsroutes tellen niet.** Routes die
   het trainingsplan zelf aanmaakt (`lib/plan-routes.ts`) zijn geen
   gebruikershandeling "opslaan"; alleen expliciete gebruikersacties tellen.

## Hoofdstuk 2 — Limiet en reserveringen (02b)

_Nog niet gebouwd._

## Hoofdstuk 3 — Opslag, verval en downgrade (02c)

_Nog niet gebouwd._

## Hoofdstuk 4 — Admin en fair use (02d)

_Nog niet gebouwd._
