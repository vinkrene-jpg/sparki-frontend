// Road Objects engine — de Sparki Traffic Database.
//
// Eén modulaire engine voor wegobjecten langs routes en ritten. Verkeerslichten
// en spoorwegovergangen zijn de eerste objectsoorten; het datamodel (`kind`)
// en alle functies zijn generiek zodat rotondes, drempels, stopborden,
// tunnels, bruggen, veeroosters en klimsegmenten later zonder schemawijziging
// aanhaken.
//
// Lagen:
// - detect: pure, deterministische stop-detectie/-classificatie (testbaar).
// - store: opslag, zelflerende bevestigingen, confidence-verval (lazy op het
//   leespad — geen cronafhankelijkheid).
// - overpass: OpenStreetMap-import per route-corridor (mirror-fallback).
// - along-route: objecten langs een route + telling/dichtheid/tijdverlies,
//   met 30-min cache zodat navigatie er niets van merkt.
//
// Kaartprovider-notitie: Mapbox (tegels) en openrouteservice (routering)
// leveren géén verkeerslicht-objectdata via de gebruikte API's; de objectlaag
// komt daarom uit OpenStreetMap — zie lib/road-objects/overpass.ts.

export * from "../../lib/road-objects/detect";
export * from "../../lib/road-objects/store";
export * from "../../lib/road-objects/overpass";
export * from "../../lib/road-objects/along-route";
