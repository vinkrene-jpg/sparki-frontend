# Routing-cachinginventaris (FASE 4, 31-07-2026)

Inventaris van de bestaande caching rond de routeketen — **geen tweede
cachesysteem gebouwd**; dit document legt vast wat er is en wat er gericht
beter kan. Bron: code-inspectie 31-07-2026 (main).

## 1. Bestaande caches

| Cache | Wat | Waar | Sleutel | Levensduur | Invalidatie | Gebruikersspecifiek | Negatief gecachet? |
|---|---|---|---|---|---|---|---|
| BGT-tegelcache (NL) | BGT-wegdelen (verharding) | in-memory `TILE_CACHE`, `lib/bgt-verharding.ts` | Web-Mercator-tegelsleutel | max 600 entries, LRU — **geen tijds-TTL** | LRU-verdringing | nee (gedeeld) | nee |
| GRB-tegelcache (Vlaanderen) | GRB-wegsegmenten | in-memory `TILE_CACHE`, `lib/grb-verharding.ts` | tegelsleutel | max 600, LRU — geen tijds-TTL | LRU | nee | nee |
| Overpass omgevingssync | OSM-wegobjecten (verkeerslichten e.d.) | in-memory `SYNCED` + DB `road_objects` | bbox (3 decimalen) | 6 u (memory); DB-vertrouwen vervalt over 120 dagen | TTL; DB via `lastValidatedAt` | nee | **nee** — mislukte sync wordt niet gecachet, elke aanvraag probeert opnieuw |
| Klimcache | passen/pieken (Overpass) | DB `climb_cache` + in-memory, `lib/climbs/` | querystring (DB), bbox (memory) | 30 dagen (DB), 30 min (memory) | `cleanupClimbCacheDb` | nee | nee |
| Weer | Open-Meteo daily/hourly | in-memory, `lib/weather/open-meteo.ts` | lat/lon ~1 km + dagen | 30 min | TTL | nee | nee |
| Routegeometrie | ruwe GraphHopper/ORS-geometrie + wegdekstats | in-memory `ROUTE_GEOMETRY_CACHE`, `routes/routes.ts` | deterministische parameterhash (start/eind/profiel/…) | 5 min | eviction bij elke toegang | nee | nee |
| Routekandidaten | voorstellen in de kiezer | in-memory `store`, `lib/route-candidates.ts` | UUID | 30 min | TTL | **ja** (owner-check op clerkId) | n.v.t. |
| Route-omgevingsinzicht | verkeerslichten-telling, bos/bebouwing | in-memory `ENV_CACHE`/`AREA_CACHE`, `lib/route-insight.ts` | geometriehash / gebiedscentrum | 6 u | TTL | nee | nee |
| Obstakelmeting langs route | wegobjecten op een geometrie | in-memory `RESULT_CACHE`, `lib/road-objects/along-route.ts` | geometrie-sample-hash + soortfilter | 30 min | TTL | nee | nee |
| Warm-up | AREA_CACHE voorverwarmd rond thuislocaties | `lib/route-env-warmup.ts` | — | volgt AREA_CACHE | periodiek | per-thuislocatie (gedeelde data) | n.v.t. |

Niet in de api-server: kaarttegels (Mapbox e.d.) — die lopen rechtstreeks
frontend ↔ provider. GraphHopper/ORS-antwoorden worden alleen via de
5-minuten-geometriecache hergebruikt.

## 2. Aangetroffen gaten

1. **Alles in-memory** (behalve `climb_cache`/`road_objects`): een herstart of
   deploy gooit alle warme kennis weg → koude-cache-pieken, precies waar de
   blokkadepoort-koud-gat-les (fail-open bij verse gebieden, inmiddels 422)
   vandaan kwam.
2. **Geen tijds-TTL op BGT/GRB-tegels**: verouderde overheidskaartdata kan tot
   procesherstart blijven hangen (in de praktijk beperkt door LRU-600, maar
   niet gegarandeerd).
3. **Geen negatieve caching**: een kapotte Overpass-mirror wordt per aanvraag
   opnieuw geprobeerd — bij drukte ontstaat een burst richting kapotte bron
   (zelfde patroon als de BQ-probe-les elders in dit project).
4. **Geen gedeelde verificatie tussen gelijktijdige aanvragen**: twee
   gelijktijdige generaties over hetzelfde gebied meten dubbel (geen
   in-flight-dedupe/promise-sharing), alleen resultaat-hergebruik achteraf.
5. **Geen kaartdataversie in de sleutels**: er is geen begrip "OSM-stand van
   datum X" — invalidatie is puur tijdgestuurd.

## 3. Gericht verbetervoorstel (nog niet gebouwd — eerst akkoord)

- **Cachemodel:** houd het huidige twee-laagsmodel (in-memory + DB) maar
  promoveer de duurste, best deelbare resultaten (Overpass-omgevingssync per
  bbox, obstakelmeting per geometriehash) naar een DB-tabel naast
  `climb_cache`, zodat warmte een deploy overleeft. Geen nieuw framework.
- **Invalidatie:** tijds-TTL toevoegen aan BGT/GRB-tegels (voorstel: 7 dagen);
  bestaande TTL's behouden.
- **Kaartdataversie:** één veld `source_snapshot` (datum van ophalen) per
  DB-cache-rij; leeftijd tonen in de bestaande uitleg-/herkomstlaag.
- **Maximale ouderdom:** Overpass-omgeving 7 dagen DB-warm, obstakelmeting op
  routeniveau blijft kort (30 min) — veiligheid blijft vers gemeten.
- **Negatieve caching:** mislukte Overpass-sync per bbox 2–5 min als "kapot"
  markeren (korte TTL), zodat bursts richting kapotte mirrors stoppen; de
  uitkomst blijft fail-closed (onverifieerbaar = weigeren), er wordt nooit een
  negatief resultaat als "veilig" hergebruikt.
- **Gedeelde verificatie:** in-flight promise-dedupe per cachesleutel (zelfde
  bbox/geometrie ⇒ één meting, meerdere wachters).
- **Privacy:** alle genoemde caches bevatten kaart-/omgevingsdata, geen
  persoonsgegevens; routekandidaten blijven owner-gescoped en in-memory.
- **Opslagkosten:** verwaarloosbaar (orde MB's; `climb_cache` bewijst het
  patroon al).
- **Foutgedrag:** cache-lagen mogen nooit een verificatie-uitkomst verzinnen;
  bij cachefouten geldt dezelfde fail-closed keten als zonder cache.
- **Meetbare winst:** koude-start p95 van routegeneratie in vers gebied
  (nu 14–98 s Overpass-afhankelijk) richting warme-pad-tijden (≤3 s) voor
  gebieden die eerder door wie dan ook geverifieerd zijn; meetbaar via de
  bestaande `[PERF]`-logregels.
