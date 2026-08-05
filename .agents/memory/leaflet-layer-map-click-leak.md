---
name: Leaflet laag→kaart click-doorlek
description: Waarom stopPropagation op het Leaflet-event niet voorkomt dat een layer-click ook de map-click-handler raakt, en de betrouwbare poort.
---

Een click op een polyline/marker levert Leaflet daarna óók af bij de map-`click`-handler (zelfde `originalEvent`). `L.DomEvent.stopPropagation(leafletEvent)` is daarvoor NIET betrouwbaar: Leaflet checkt zijn eigen `_stopped`-vlag op het Leaflet-event, niet op het DOM-event dat je markeert.

**Why:** op het routescherm veroorzaakte de doorlek een tweede waypoint + tweede routeaanvraag per tik (R16-schending, review-afkeur).

**How to apply:** gebruik een DOM-event-identiteitspoort: laag-handler zet `verwerkteTikRef.current = e.originalEvent`; de map-handler negeert een click met datzelfde `originalEvent`. Test dit door de keten na te spelen (laag-handler → map-handler met hetzelfde event-object) en exact één mutatie te asserten — zie route-scherm-aanpassen.test.tsx.
