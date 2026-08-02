# F11 — Veiligheidsbeleid centrale bestands- en medialaag

**Eerlijk vooraf:** er draait **geen echte virusscanner**. Wat er wél is, is één
centrale poort (`artifacts/api-server/src/lib/files.ts` → `scanFile`) waar élke
upload doorheen moet vóór hij wordt opgeslagen of geserveerd. Geen enkele module
mag zijn eigen uploadoplossing hebben; alles loopt via `registerFile` /
`replaceFile` / `serveFile` / `revokeFile`.

## De poort (afgedwongen in code, fail-closed)

1. **Groottelimiet.** Configureerbaar via `FILES_MAX_UPLOAD_BYTES`
   (default 25 MB). Groter ⇒ direct geweigerd (400).

2. **Magic-byte-controle op de ECHTE inhoud.** Niet het door de client
   geclaimde `Content-Type` of de extensie beslist, maar de eerste bytes van het
   bestand (`sniffContentType`). Een verkleed bestand (ZIP met naam `.png`) wordt
   op inhoud geweigerd (415) en komt nooit in opslag.

3. **Strikte whitelist per doel.** Toegestaan: afbeeldingen (JPEG, PNG, WEBP,
   HEIC) en PDF. **Geweigerd:** uitvoerbare bestanden (ELF/EXE), archieven
   (ZIP/RAR/gzip) en Office-documenten (macro-risico kunnen we niet uitsluiten).
   Geen uitvoerbare types, punt.

4. **Her-encoding van afbeeldingen.** Elke afbeelding wordt met `sharp`
   her-encodeerd. Meegesmokkelde inhoud (EXIF-payloads, polyglots) verdwijnt
   daarbij. Een afbeelding die niet echt te decoderen is, wordt geweigerd (415).
   Doelformaat:
   - WEBP blijft WEBP;
   - **PNG mét transparantie blijft PNG** (her-encode PNG→PNG). Zo verwijderen we
     alsnog payloads maar behouden we het alfakanaal. Dit is nodig voor afgeleiden
     zoals de **fietsscan-cutout** (vrijstaand beeld): zou de poort naar JPEG
     her-encoderen, dan zou de transparantie platgeslagen worden;
   - al het overige (JPEG, alpha-loze PNG, HEIC, …) wordt JPEG.

5. **PDF alleen als `application/pdf` met `%PDF`-header.** PDF wordt op de
   magic bytes (`%PDF-`) toegelaten en ongewijzigd opgeslagen. Diepgaande
   JS-actie-analyse valt buiten dit minimum; dit is bewust en eerlijk vermeld.

6. **Veilige bestandsnaam.** De originele naam is uitsluitend weergave-metadata.
   Het opslagpad is altijd een uuid. De naam wordt gesaneerd: control chars weg,
   pad-scheidingstekens weg, pad-traversal (`..`) geneutraliseerd, lengtegrens
   120 tekens, en de extensie wordt geforceerd afgeleid van het **echte**
   (gesnifte) type — nooit van de geclaimde naam.

## Serveren

`serveFile` streamt altijd met `Content-Disposition: attachment` en
`X-Content-Type-Options: nosniff` — nooit inline in de app-context. Modules met
eigen zichtbaarheidslogica (F7 berichten, F8 clubdocumenten) doen hun
rechtencheck vóór het streamen; de centrale `/api/files/:id`-router doet een
eigenaar/admin-check.

## Intrekken (hard, fail-closed)

`revoked_at` gezet ⇒ `serveFile` weigert met **410** op **elke** route, ook via
een oude link.

De generieke object-storage-route (`/api/storage/objects/*`) serveert een
centraal-beheerd object (dat in de files-tabel staat) **niet meer rauw**, maar
altijd via `serveFile` (nosniff/no-store). Rechten daar: uitsluitend de
**eigenaar** (of admin); een onbevoegde krijgt 404 (nooit lekken dat het bestaat).
Modules met een eigen zichtbaarheidsmodel (F7-berichten, F8-clubdocumenten)
houden hun eigen serve-pad voor niet-eigenaren (ontvangers/clubleden). Zo blijven
eigen media-previews (Photo Lab, Journey, Input Center, sfeerbeeld) transparant
werken via `/api/storage`, mét intrekbaarheid.

**Dedupe-revoke-semantiek (belangrijk).** Eén opgeslagen object kan door meerdere
files-rijen gedeeld worden (dedupe). De generieke route serveert zolang er **≥1
LEVENDE rij van de rechthebbende** is; intrekken van rij A doodt de nog levende
rij B dus **niet**. Pas als **alle** rijen van die eigenaar voor dat object
ingetrokken zijn, valt de link dicht met **410**. Een directe download van een
specifiek ingetrokken bestand (`/api/files/:id/download`) geeft altijd 410.
Module-serve-routes met een eigen files-koppeling (bv. de materiaalfoto-route)
dwingen dezelfde regel af: met een `fileId` verplicht via `serveFile`; zonder
`fileId` (legacy) wordt vóór het rauw streamen gecontroleerd of het object
inmiddels centraal beheerd **én** ingetrokken is (dan 410).

## Versiebeheer & dedupe

- **Vervangen zonder historieverlies:** `logical_id` bindt alle versies van één
  logisch bestand; `superseded_by_id` wijst de oude versie naar de nieuwe. Oude
  versies blijven bewaard en downloadbaar voor bevoegden tot ze zijn ingetrokken.
- **Dedupe op checksum:** bij een bestaand `sha256`+grootte van **dezelfde
  eigenaar** wordt het opgeslagen object hergebruikt (geen tweede kopie). Er
  komt wél een nieuwe files-rij (eigen metadata/versie). Intrekken werkt per rij
  en zet nooit de gedeelde object-bytes weg. **Cross-eigenaar dedupe wordt nooit
  zichtbaar gemaakt** (privacy): er wordt uitsluitend binnen de eigen bestanden
  van de eigenaar ontdubbeld.

## Presign-finalisatie (Input Center, Journey-media, Photo Lab)

Sommige modules uploaden via een **presign→PUT**-flow: de bytes staan al in
object storage wanneer de module finaliseert. Die finalisatie loopt via
`registerFromObjectPath`, dat **zelf** — niet de aanroeper — drie dingen doet,
fail-closed en in deze volgorde:

1. **Verplichte eigendomsclaim, nooit takeover.** Het bronobject wordt op naam
   van de caller geclaimd. Is het al van een **ander**, dan weigeren we (**403**).
   Zo kan niemand met een geraden/bekend `objectPath` andermans bytes als "eigen"
   bestand laten finaliseren (IDOR-gat). De claim zit ín `registerFromObjectPath`
   zodat geen enkele aanroeper hem kan vergeten.
2. **Door de poort.** De bytes gaan door `scanFile` (grootte, magic-byte-sniff,
   her-encoding) en de veilige kopie komt onder een **nieuw** object.
3. **Quarantaine van de rauwe bron.** Na een geslaagde registratie wordt het
   oorspronkelijke, **ongescande** presign-object verwijderd (of, als verwijderen
   mislukt, met een quarantaine-ACL fail-closed dichtgezet). Zo blijven de rauwe
   bytes niet via `/api/storage` bereikbaar.

## Module-omlegging (welke module loopt hoe)

Alle module-uploads lopen via de centrale poort. Overzicht en bewuste
uitzonderingen:

| Module | Pad | Bijzonderheid |
| --- | --- | --- |
| Input Center (bijlagen) | `registerFromObjectPath` | beeld/PDF; verkleed type valt weg |
| Journey-media (**beeld**) | `registerFromObjectPath` | intrekbaar; delete revoket de files-rij |
| Photo Lab (origineel) | `registerFromObjectPath` | claim vervangt de oude `claimOwnership`-stap |
| Materiaalcoach | `registerFile` | serve-route is `fileId`-aware (410 op ingetrokken) |
| Trainer-briefpapier | `registerFile` | domeincontroles op originele bytes blijven |
| Club-documenten (F8) | `registerFile`/`replaceFile` | eigen versietabel + zichtbaarheid |
| Coach-berichten (F7) | `registerFile` | eigen bericht-zichtbaarheid |
| Voeding / Garage / Fietsscan | `uploadMaterialPhoto` → **poort** | her-encodeerd; PNG-cutout blijft PNG |

**Bewuste uitzonderingen (gedocumenteerd, niet vergeten):**

- **Video** (Journey-video, race-room-video) kan **niet** her-encodeerd worden
  door de beeld/PDF-poort. Video blijft daarom op de **presign→ACL-flow** met
  `file_id` NULL en de bestaande MIME-whitelist als type-poort. De rauwe bron
  wordt hier bewust **niet** gequarantaineerd (er is geen veilige kopie die hem
  vervangt). Dit is een expliciete grens van dit minimum.
- **Club-/teamlogo** accepteert ook **SVG**; SVG gaat **niet** door de poort
  (XSS-risico, geen veilige her-encoding). Blijft op de bestaande logo-flow.
- **CSV-ledenimport** is tekst, geen media — buiten de bestandslaag.
- **GPX/FIT/TCX/route-GPX** zijn tekst/telemetrie, geen media — buiten de poort.
- **Voeding/Garage/Fietsscan** hebben (nog) **geen intrek-UI**; de centrale
  files-rij bestaat wél (scan/her-encoding/retentie), maar revoke is voor die
  modules nog niet aan de knoppen gekoppeld. Serveren gebeurt owner-gated.

## Retentie

`retention_category` per bestand (default `algemeen`; bron kan `communicatie`,
`document`, `media`, `tijdelijk` of een legacy-waarde zetten). In DEEL 1 leggen
we de categorie alleen vast; de bestaande F7-retentie (`club-message-retention`)
blijft leidend voor communicatiebijlagen. Er is nog geen generieke opruimjob.
