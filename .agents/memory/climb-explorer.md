---
name: Klimmenverkenner (climb explorer)
description: Overpass mirror caveats + honest-source design for the searchable climb explorer feature.
---

# Klimmenverkenner

Searchable OSM climb explorer (flag `climb_explorer`): geocode (Nominatim) → Overpass climb search (mountain_pass + natural=peak+ele) → detail = derived profile (routing provider) + description enrichment (OSM tag → Wikipedia REST → Wikidata). Honest empty/error/limited states throughout; never fabricated.

## Overpass mirror selection (critical)
- `overpass-api.de/api/interpreter` returns **406 for every request in this sandbox env** (egress mangling); works elsewhere so kept as a fallback, not primary.
- `overpass.kumi.systems` path 404s.
- **`overpass.osm.ch` is a Switzerland-only regional mirror** — it returns HTTP 200 with `elements: []` for non-Swiss bboxes. That is a *false-empty success*: an endpoint-fallback loop that stops on the first 200 would silently report "no climbs" for the whole world. Do NOT use regional mirrors in a fallback chain.
- **`maps.mail.ru/osm/tools/overpass/api/interpreter` is a working full-planet mirror** → used as primary.

**Why:** honest-empty contract means a false-empty is worse than an error. Any Overpass mirror added to the fallback list must be a full-planet instance, verified against a non-local bbox.

## Nominatim
- Works with a real User-Agent; requires one. Host `nominatim.openstreetmap.org` on the SSRF allowlist.

## React Query retry gotcha
- A "retry" button that mutates the search input to force a refetch fails when the hook **trims** the input before building the query key — the key is unchanged so no refetch fires. Expose and call `refetch()` instead of whitespace-poking the input.
