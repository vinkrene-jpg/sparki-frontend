#!/usr/bin/env node
/**
 * RIJDEN_02 §5 — Herkleur de MapLibre/Shortbread-kaartstijl naar een warm,
 * rustig "rijden"-palet.
 *
 * Idempotent: het script leest public/kaart/sparki-stijl.json, past per
 * laag-id/klasse de kleuren/breedtes/zooms toe volgens de RIJDEN_02 §5-spec,
 * en schrijft compact (geminificeerd) terug. Meerdere keren draaien geeft
 * exact hetzelfde resultaat.
 *
 * Gebruik: node scripts/kaartstijl-rijden02.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STYLE_PATH = resolve(__dirname, "../public/kaart/sparki-stijl.json");

// ---------------------------------------------------------------------------
// Palet (§5.1 – §5.3)
// ---------------------------------------------------------------------------
const C = {
  land: "#f4f1ea", // background
  waterFill: "#a9cee2",
  waterEdge: "#93bdd4",
  forest: "#cadfc0",
  grass: "#dbe8cd", // gras/weide/park/garden/vegetation/leisure
  heath: "#dfe3c9", // heide/struikgewas (zie BEVINDING: valt in klasse "vegetation")
  sand: "#efe4c8",
  built: "#eae3d8", // residential/commercial/industrial
  buildingFill: "#ded5c8",
  buildingEdge: "#cfc4b4",
  rock: "#e6e0d6",

  // Wegen (vul / rand)
  motorwayFill: "#f5b95a",
  motorwayEdge: "#d99b3a",
  mainFill: "#f8d68f", // trunk/primary (+links)
  mainEdge: "#dcae5c",
  secondaryFill: "#ffffff", // secondary/tertiary (+links)
  secondaryEdge: "#d5cec1",
  residentialFill: "#ffffff", // residential/livingstreet/unclassified/service/pedestrian
  residentialEdge: "#e1dbd1",
  trackFill: "#e8dcc6", // onverhard/track
  trackEdge: "#c4b394",
  pathLine: "#b9a688", // pad/wandelpad
  cyclewayLine: "#7fa8b8", // fietspad
  railFill: "#b3aca2",
  railEdge: "#8f887e",

  // Teksten (§5.3)
  placeText: "#3f3a33",
  streetText: "#6b6459",
  waterText: "#4a7d96",
  halo: "#ffffff",
};

// Breedte op z14 (§5.2). Rand = fill + 2px voor "diepte".
const W = {
  motorway: 6,
  main: 5,
  secondary: 4,
  residential: 3,
  track: 2.5,
  path: 2,
  cycleway: 2,
  rail: 2,
};
const EDGE_EXTRA = 2; // rand iets breder dan de vulling

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Meng een hex-kleur richting wit met factor t (0..1). t=0.15 => 15% lichter. */
function lighten(hex, t) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c) => Math.round(c + (255 - c) * t);
  const to2 = (c) => c.toString(16).padStart(2, "0");
  return `#${to2(mix(r))}${to2(mix(g))}${to2(mix(b))}`;
}

/**
 * Bouw een line-width zoom-curve die op z14 exact `base` px levert en op hogere
 * zooms proportioneel meeschaalt (zoals de originele Shortbread-stijl).
 */
function widthStops(base) {
  return {
    stops: [
      [10, +(base * 0.4).toFixed(3)],
      [14, base],
      [16, +(base * 2.2).toFixed(3)],
      [18, +(base * 6).toFixed(3)],
      [20, +(base * 18).toFixed(3)],
    ],
  };
}

let changed = 0;
const changedIds = [];
function mark(layer, mutate) {
  const before = JSON.stringify(layer);
  mutate(layer);
  const after = JSON.stringify(layer);
  if (before !== after) {
    changed++;
    changedIds.push(layer.id);
  }
}

function setPaint(layer, key, value) {
  layer.paint = layer.paint || {};
  layer.paint[key] = value;
}

/** Normaliseer een laag-id naar (kind, isOutline, isTunnel, isBridge). */
function classify(id) {
  let s = id;
  const isTunnel = s.startsWith("tunnel-");
  const isBridge = s.startsWith("bridge-");
  s = s.replace(/^tunnel-/, "").replace(/^bridge-/, "");
  const isOutline = s.endsWith(":outline");
  const isBridgeCasing = s.endsWith(":bridge"); // bridge casing onder de weg
  s = s.replace(/:outline$/, "").replace(/:bridge$/, "");
  return { core: s, isOutline, isBridgeCasing, isTunnel, isBridge };
}

// ---------------------------------------------------------------------------
// Kleur-toewijzing per weg-klasse
// ---------------------------------------------------------------------------
// Retourneert { fill, edge, width } voor de "core" weg-id, of null.
function roadStyle(core) {
  // snelweg
  if (core === "street-motorway" || core === "street-motorway-link") {
    return { fill: C.motorwayFill, edge: C.motorwayEdge, width: W.motorway };
  }
  // hoofdweg trunk/primary (+links)
  if (
    core === "street-trunk" ||
    core === "street-trunk-link" ||
    core === "street-primary" ||
    core === "street-primary-link"
  ) {
    return { fill: C.mainFill, edge: C.mainEdge, width: W.main };
  }
  // secundair secondary/tertiary (+links)
  if (
    core === "street-secondary" ||
    core === "street-secondary-link" ||
    core === "street-tertiary" ||
    core === "street-tertiary-link"
  ) {
    return { fill: C.secondaryFill, edge: C.secondaryEdge, width: W.secondary };
  }
  // woonstraat / kleine weg (incl. busway/busguideway + bicycle-varianten die
  // op dezelfde onderliggende straatklasse rijden)
  if (
    core === "street-residential" ||
    core === "street-residential-bicycle" ||
    core === "street-livingstreet" ||
    core === "street-livingstreet-bicycle" ||
    core === "street-unclassified" ||
    core === "street-unclassified-bicycle" ||
    core === "street-service" ||
    core === "street-service-bicycle" ||
    core === "street-pedestrian" ||
    core === "street-pedestrian-bicycle" ||
    core === "street-pedestrian-zone" ||
    core === "street-busway" ||
    core === "street-busguideway"
  ) {
    return {
      fill: C.residentialFill,
      edge: C.residentialEdge,
      width: W.residential,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hoofdlogica
// ---------------------------------------------------------------------------
const style = JSON.parse(readFileSync(STYLE_PATH, "utf8"));

for (const layer of style.layers) {
  const id = layer.id;
  const { core, isOutline, isBridgeCasing, isTunnel } = classify(id);

  // 1px lichter voor tunnels (§5.2)
  const tone = (hex) => (isTunnel ? lighten(hex, 0.15) : hex);

  // ---- §5.1 Achtergrond / landgebruik -----------------------------------
  if (id === "background") {
    mark(layer, (l) => setPaint(l, "background-color", C.land));
    continue;
  }

  // Water (ocean, water_polygons, water_lines, dam, pier)
  if (
    id === "water-ocean" ||
    id === "water-area" ||
    id === "water-area-river" ||
    id === "water-area-small" ||
    id === "water-glacier" ||
    id === "land-glacier"
  ) {
    mark(layer, (l) => setPaint(l, "fill-color", C.waterFill));
    continue;
  }
  if (
    id === "water-river" ||
    id === "water-canal" ||
    id === "water-stream" ||
    id === "water-ditch"
  ) {
    // water_lines: vulkleur voor de lijn, randkleur is niet apart -> vulkleur
    mark(layer, (l) => setPaint(l, "line-color", C.waterFill));
    continue;
  }
  if (id === "water-dam-area" || id === "water-pier-area") {
    mark(layer, (l) => setPaint(l, "fill-color", C.waterEdge));
    continue;
  }
  if (id === "water-dam" || id === "water-pier") {
    mark(layer, (l) => setPaint(l, "line-color", C.waterEdge));
    continue;
  }

  // Landgebruik-vlakken
  if (id === "land-forest") {
    mark(layer, (l) => {
      setPaint(l, "fill-color", C.forest);
      l.minzoom = 8; // §5.4: bos/groen op z8
    });
    continue;
  }
  if (
    id === "land-grass" ||
    id === "land-park" ||
    id === "land-garden" ||
    id === "land-leisure"
  ) {
    mark(layer, (l) => {
      setPaint(l, "fill-color", C.grass);
      l.minzoom = 8; // groen zichtbaar vanaf z8
    });
    continue;
  }
  if (id === "land-vegetation") {
    // heide/scrub -> §5.1 heide/struikgewas kleur
    mark(layer, (l) => {
      setPaint(l, "fill-color", C.heath);
      l.minzoom = 11; // landgebruik z11
    });
    continue;
  }
  if (id === "land-sand") {
    mark(layer, (l) => {
      setPaint(l, "fill-color", C.sand);
      l.minzoom = 11;
    });
    continue;
  }
  if (id === "land-rock") {
    mark(layer, (l) => {
      setPaint(l, "fill-color", C.rock);
      l.minzoom = 11;
    });
    continue;
  }
  if (
    id === "land-residential" ||
    id === "land-commercial" ||
    id === "land-industrial" ||
    id === "land-garages"
  ) {
    mark(layer, (l) => {
      setPaint(l, "fill-color", C.built);
      l.minzoom = 11;
    });
    continue;
  }
  if (id === "land-agriculture") {
    // BEVINDING: geen aparte agrarische kleur in de spec; dichtstbijzijnde is
    // de warme groene gras/weide-groep (#dbe8cd).
    mark(layer, (l) => {
      setPaint(l, "fill-color", C.grass);
      l.minzoom = 11;
    });
    continue;
  }
  if (id === "land-wetland" || id === "land-burial" || id === "land-waste") {
    // overige landgebruikklassen: dichtstbijzijnde warme klasse.
    // wetland -> water-achtig groen (grass), burial/waste -> bebouwd-warm.
    mark(layer, (l) => {
      setPaint(l, "fill-color", id === "land-wetland" ? C.grass : C.built);
      l.minzoom = 11;
    });
    continue;
  }

  // Gebouwen (§5.1 + §5.4 z16)
  if (id === "building") {
    mark(layer, (l) => {
      setPaint(l, "fill-color", C.buildingFill);
      l.minzoom = 16;
    });
    continue;
  }
  if (id === "building:outline") {
    mark(layer, (l) => {
      setPaint(l, "fill-color", C.buildingEdge);
      l.minzoom = 16;
    });
    continue;
  }

  // ---- §5.2 Wegen -------------------------------------------------------
  // Spoor (rail/lightrail/monorail/funicular). tram valt hier ook onder.
  if (
    /^transport-(rail|light_rail|lightrail|monorail|funicular|tram|narrowgauge|subway)(-service)?$/.test(
      core,
    )
  ) {
    const isOut = isOutline;
    mark(layer, (l) => {
      setPaint(l, "line-color", tone(isOut ? C.railEdge : C.railFill));
      setPaint(l, "line-width", widthStops(isOut ? W.rail + EDGE_EXTRA : W.rail));
    });
    continue;
  }

  // Onverhard / track
  if (core === "street-track") {
    mark(layer, (l) => {
      if (isOutline) {
        setPaint(l, "line-color", tone(C.trackEdge));
        setPaint(l, "line-width", widthStops(W.track + EDGE_EXTRA));
      } else {
        setPaint(l, "line-color", tone(C.trackFill));
        setPaint(l, "line-width", widthStops(W.track));
        setPaint(l, "line-dasharray", [3, 2]); // streepjes
      }
      l.minzoom = 14; // §5.4
    });
    continue;
  }

  // Pad / wandelpad (path/footway/steps) — geen vulling, streepjeslijn
  if (
    core === "way-path" ||
    core === "way-footway" ||
    core === "way-steps"
  ) {
    if (isOutline) {
      // geen aparte rand voor paden: rand-laag onzichtbaar maken
      mark(layer, (l) => setPaint(l, "line-opacity", 0));
      continue;
    }
    mark(layer, (l) => {
      setPaint(l, "line-color", tone(C.pathLine));
      setPaint(l, "line-width", widthStops(W.path));
      setPaint(l, "line-dasharray", [2, 2]);
      l.minzoom = 14; // §5.4
    });
    continue;
  }

  // Fietspad (cycleway + *-bicycle-varianten) — geen vulling, streepjeslijn
  if (core === "way-cycleway" || /-bicycle$/.test(core)) {
    if (isOutline) {
      mark(layer, (l) => setPaint(l, "line-opacity", 0));
      continue;
    }
    mark(layer, (l) => {
      setPaint(l, "line-color", tone(C.cyclewayLine));
      setPaint(l, "line-width", widthStops(W.cycleway));
      setPaint(l, "line-dasharray", [2, 2]);
      l.minzoom = 14; // §5.4
    });
    continue;
  }

  // Overige wegen (motorway/trunk/primary/secondary/tertiary/residential/...)
  const rs = roadStyle(core);
  if (rs) {
    mark(layer, (l) => {
      if (isOutline || isBridgeCasing) {
        setPaint(l, "line-color", tone(rs.edge));
        setPaint(l, "line-width", widthStops(rs.width + EDGE_EXTRA));
      } else {
        setPaint(l, "line-color", tone(rs.fill));
        setPaint(l, "line-width", widthStops(rs.width));
      }
      // §5.4 minzoom per klasse
      if (core === "street-motorway" || core === "street-motorway-link") {
        l.minzoom = 5;
      } else if (/^street-(trunk|primary)/.test(core)) {
        l.minzoom = 8;
      } else if (/^street-(secondary|tertiary)/.test(core)) {
        l.minzoom = 11;
      } else {
        l.minzoom = 14; // woonstraten / kleine wegen
      }
    });
    continue;
  }

  // ---- §5.3 Teksten -----------------------------------------------------
  if (layer.type === "symbol" && layer["source-layer"] === "place_labels") {
    mark(layer, (l) => {
      setPaint(l, "text-color", C.placeText);
      setPaint(l, "text-halo-color", C.halo);
      setPaint(l, "text-halo-width", 1.5);
      if (l.paint && "icon-color" in l.paint) l.paint["icon-color"] = C.placeText;
      // §5.4 minzoom voor plaatsklassen
      const kind = id.replace("label-place-", "");
      if (kind === "city" || kind === "capital" || kind === "statecapital") {
        l.minzoom = 7;
      } else if (kind === "town") {
        l.minzoom = 8;
      } else if (
        kind === "village" ||
        kind === "suburb" ||
        kind === "quarter" ||
        kind === "neighbourhood" ||
        kind === "hamlet"
      ) {
        l.minzoom = 11;
      }
    });
    continue;
  }
  if (layer.type === "symbol" && layer["source-layer"] === "street_labels") {
    mark(layer, (l) => {
      setPaint(l, "text-color", C.streetText);
      setPaint(l, "text-halo-color", C.halo);
      setPaint(l, "text-halo-width", 1.25);
      if (l.paint && "icon-color" in l.paint) l.paint["icon-color"] = C.streetText;
      l.minzoom = 16; // §5.4 straatnamen op z16
    });
    continue;
  }

  // ---- §5.4 POI-pictogrammen op z16 -------------------------------------
  if (layer.type === "symbol" && layer["source-layer"] === "pois") {
    mark(layer, (l) => {
      l.minzoom = 16;
    });
    continue;
  }
}

// Compact (geminificeerd) terugschrijven, met afsluitende newline voor nette diff.
writeFileSync(STYLE_PATH, JSON.stringify(style) + "\n");

console.log(`RIJDEN_02 §5 toegepast. Aangepaste lagen: ${changed} / ${style.layers.length}`);
