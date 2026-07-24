# Sparki Connect — centrale bestandsimport (FIT / GPX / TCX)

Status: opdracht 3B. Handmatige bestanduploads zijn een volwaardige,
broneutrale Data Hub-bron: een geüpload bestand doorloopt **dezelfde**
`ingestBatch`-pijplijn als een connector (provider `file`), wordt een echte
trainingssessie en voedt alle onderliggende engines.

## Route en stroom

`POST /api/activity-imports` (`artifacts/api-server/src/routes/activity-imports.ts`):

1. **Validatie vóór verwerking**
   - Onbekend bestandstype (bv. `.jpg`) → `400` "Dit bestandstype wordt niet
     ondersteund. Sparki leest FIT-, GPX- en TCX-bestanden."
   - Leeg bestand (tekst of base64) → `400` "Het bestand is leeg".
   - Groottegrens: 11 MB tekst (GPX/TCX/CSV), 8 MB FIT (binair, base64 ≈ +33%).
2. **Duplicaatwaarschuwing** — checksum (SHA-1 over de bytes, bestandsnaam telt
   niet mee) wordt per gebruiker opgezocht. Byte-identiek bestand → `200` met
   `{ duplicate: true, import: <bestaande rij>, message }`; er wordt géén
   tweede rij en géén tweede sessie aangemaakt. Dedupe is strikt per gebruiker.
3. **Parsen + ingest** — GPX/FIT/TCX worden echt geparsed; een gedateerd
   bestand wordt (of merget in) een trainingssessie via de Data Hub; een GPX
   zonder tijden blijft eerlijk een route (geen training).
4. **Eerlijke fouten** — een onleesbaar bestand levert een `failed`-rij met
   Nederlandse uitleg; er wordt nooit een sessie of samenvatting verzonnen.

## Herkomst (provenance) per import-rij

Additieve kolommen op `activity_imports` (`lib/db/src/schema/activity-imports.ts`):

| Kolom | Inhoud |
| --- | --- |
| `checksum` | SHA-1 van de bestandbytes — basis voor de duplicaatcheck. |
| `parser_version` | `sparki-file/1` (`FILE_PARSER_VERSION`) — ook op foutrijen. |
| `dedupe_status` | `new` (nieuwe sessie), `merged_existing` (samengevoegd met bestaande activiteit, bv. dezelfde rit via Strava), `route_only` (geen starttijd → geen training). |

Oudere imports houden `null` (eerlijk afwezig, nooit met terugwerkende kracht
verzonnen). CSV blijft een eerlijk bewaarde placeholder (geen parser), maar
draagt wél een checksum zodat dubbele uploads herkend worden.

## Wat de gebruiker ziet (web)

`activity-import-panel.tsx`:

- Duplicaat → amberkleurige melding "Dit bestand is al geïmporteerd — het is
  niet opnieuw opgeslagen."
- Samengevoegd (`merged_existing`) → melding dat de rit al bestond en is
  samengevoegd, niet dubbel opgeslagen.
- Serverfouten tonen de Nederlandse uitleg uit de respons (nooit een code).
- Copy is bijgewerkt: FIT, GPX én TCX worden direct geanalyseerd.

## Tests

- `pnpm --filter @workspace/api-server run test:connect-import` — 10
  scenario's: validatie (3), provenance + dedupeStatus (3), duplicaat/rename +
  per-gebruiker-isolatie (2), capability-eerlijkheid + tokenveiligheid (2).
- `pnpm --filter @workspace/api-server run test:activity-file-ingest` — 22
  checks: broneutrale ingest, idempotentie, merge met connector-rit.
- `test:fit-parse` (7) en `test:ingest-elevation-fit-tcx` (4) blijven groen.
