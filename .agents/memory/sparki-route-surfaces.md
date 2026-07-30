---
name: Sparki wegtypen & fietsgeschiktheid
description: Surface analysis from OSM tags + deterministic bike suitability; honesty and matching lessons.
---

- Rule: a way without a surface tag is ALWAYS "onbekend" — including cycleway, path, footway. Classifying pathish highways as "bospad" without a surface tag is fabrication (urban footpaths exist); architect flagged this.
  **Why:** honesty contract — never invent a surface. **How to apply:** any tag→category classifier fallback must be "onbekend", never a guessed category.
- Suitability must fail honest: unknown share > threshold ⇒ "onvoldoende_gegevens" for every bike, with the percentage in the reason.
- Geometry↔way matching: use FULL way geometry (no downsampling), point-to-polyline distance with bbox prefilter; assign km ownership at half-distance. Segments carry route point indexes (fromIdx/toIdx) so the frontend can slice the real geometry for map highlights — never re-derive positions client-side.
- Preview query keys for geometry-shaped payloads need a robust fingerprint (lat+lon of ~16 spread samples + length + distance), not first/last/mid-lat only — coarse keys collide and serve stale analyses for new candidates.
- Map highlight overlay = own layerGroup + own effect in RouteMap (casing dark + color line), so select/deselect never rebuilds the base map.
- Overpass `out geom N` answers can be TRUNCATED with HTTP 200 (count at limit, or a `remark` on time/memory) — missing ways then render as fake "onbekend" (Hengelo 60,7%, Proof #436). Detect truncation, quadrant-split retry, else honest null. Never treat a partial elements-array as complete.
- Engine vs screen contradiction (GH graaf ≠ live OSM): the generator's pavedFraction/knownFraction is persisted (candidate → routes.engine_surface) and `compareSurfaceSources()` returns a `vergelijking` (consistent/tegenspraak + uitleg per bron) on both surfaces endpoints; preview gets the engine data via server-trusted candidateId, never from the request body. Contradiction is always explained, never silently resolved (see docs/product/wegdek-bronnen-verklaring.md).
