// Routeopmerkingen — pure-compute test op de deterministische kern.
//
// Getest zonder netwerk: de tag-classifier (alleen aantoonbare OSM-tags, nooit
// een aanname), de eerlijkheid van "onzeker/indicatie", de data-opmerkingen
// over de routegegevens zélf, en de vaste bronvermelding (ODbL).
//
// Run: `pnpm --filter @workspace/api-server run test:route-remarks`

import {
  classifyRemarkTags,
  computeDataRemarks,
  countRouteObstacles,
  extractElementPoints,
  gatePassageSides,
  remarksSource,
  type OverpassElement,
  type RouteRemark,
} from "../lib/route-remarks";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function scenario(name: string, fn: () => void) {
  try {
    fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

scenario("veerpont uit route=ferry, met naam in het label", () => {
  const c = classifyRemarkTags({ route: "ferry", name: "Pont Nieuwer Ter Aa" });
  assert(c, "verwacht een opmerking");
  assert(c!.kind === "veerpont", `kind: ${c!.kind}`);
  assert(c!.label.includes("Pont Nieuwer Ter Aa"), "naam ontbreekt in label");
  assert(!c!.uncertain, "veerpont is geen indicatie");
  assert(c!.evidence === "route=ferry", `evidence: ${c!.evidence}`);
});

scenario("trap uit highway=steps", () => {
  const c = classifyRemarkTags({ highway: "steps" });
  assert(c && c.kind === "trap", "verwacht trap");
});

scenario("voorde uit ford=yes", () => {
  const c = classifyRemarkTags({ ford: "yes" });
  assert(c && c.kind === "doorwaadbare_plaats", "verwacht doorwaadbare plaats");
  assert(c!.evidence === "ford=yes", `evidence: ${c!.evidence}`);
});

scenario("poort op slot = afgesloten (harde melding) + locked in evidence", () => {
  const c = classifyRemarkTags({ barrier: "gate", locked: "yes" });
  assert(c && c.kind === "poort", "verwacht poort");
  assert(c!.label.startsWith("Afgesloten poort"), `label: ${c!.label}`);
  assert(c!.evidence.includes("locked=yes"), "evidence mist locked=yes");
});

scenario("fietssluis is doorfietsbaar en wordt niet gemeld (grens René)", () => {
  const c = classifyRemarkTags({ barrier: "cycle_barrier" });
  assert(c === null, `verwacht geen melding, kreeg: ${c?.label}`);
});

scenario("poort met expliciete fiets-doorgang wordt niet gemeld", () => {
  const c = classifyRemarkTags({ barrier: "gate", bicycle: "yes" });
  assert(c === null, `verwacht geen melding, kreeg: ${c?.label}`);
});

scenario("poort naar privéterrein = afgesloten, fiets-uitzondering wint", () => {
  const priv = classifyRemarkTags({ barrier: "gate", access: "private" });
  assert(priv && priv.label.startsWith("Afgesloten poort"), `label: ${priv?.label}`);
  assert(priv!.evidence.includes("access=private"), "evidence mist access=private");
  // Fiets-uitzondering wint voor fietsers, maar te voet blijft privé dicht:
  // dat komt terug als footOnly-meting (telt nooit in de fietspoort en wordt
  // in fiets-weergaven weggefilterd), nooit als fietsmelding.
  const exc = classifyRemarkTags({ barrier: "gate", access: "private", bicycle: "yes" });
  assert(exc != null && exc.footOnly === true, `fiets-uitzondering hoort footOnly te zijn, kreeg: ${exc?.label}`);
  const excFoot = classifyRemarkTags({ barrier: "gate", access: "private", bicycle: "yes", foot: "yes" });
  assert(excFoot === null, `voet- én fietsuitzondering hoort niet gemeld, kreeg: ${excFoot?.label}`);
});

scenario("poort zonder doorgang-tags wordt NIET gemeld (besluit René 30-07)", () => {
  // Een poort op een gewoon berijdbare weg (geen privé, geen inrijverbod)
  // is geen obstakel; alleen aantoonbaar afgesloten/privé/verboden blijft.
  const c = classifyRemarkTags({ barrier: "gate" });
  assert(c === null, `onbekende poort hoort niet gemeld, kreeg: ${c?.label}`);
  const lift = classifyRemarkTags({ barrier: "lift_gate" });
  assert(lift === null, `open slagboom hoort niet gemeld, kreeg: ${lift?.label}`);
});

scenario("bicycle=no is harde beperking (niet onzeker)", () => {
  const c = classifyRemarkTags({ highway: "path", bicycle: "no" });
  assert(c && c.kind === "beperkte_toegang", "verwacht beperkte toegang");
  assert(!c!.uncertain, "bicycle=no is expliciet, geen indicatie");
});

scenario("access=private zónder fietsuitzondering is HARD (geen indicatie)", () => {
  // Afkeurregel 30-07-2026: privéterrein zonder aantoonbare fietsuitzondering
  // telde als "indicatie" en woog daardoor nooit mee in de blokkadepoort —
  // een MTB-route over privéterrein werd toch "KLAAR". Nu hard.
  const c = classifyRemarkTags({ highway: "service", access: "private" });
  assert(c && c.kind === "beperkte_toegang", "verwacht beperkte toegang");
  assert(!c!.uncertain, "access=private zonder fietsuitzondering moet hard zijn");
  assert(c!.label === "Privéterrein", `label: ${c!.label}`);
});

scenario("access=private mét bicycle=designated/permissive geeft GEEN fietsopmerking (wel footOnly)", () => {
  for (const bicycle of ["designated", "permissive"] as const) {
    const c = classifyRemarkTags({ highway: "service", access: "private", bicycle });
    // Voor fietsers geen melding; te voet blijft privé zonder voetuitzondering
    // dicht ⇒ footOnly-meting (nooit zichtbaar in fiets-weergaven).
    assert(c != null && c.footOnly === true, `bicycle=${bicycle}: verwacht footOnly, kreeg ${c?.label ?? "null"}`);
    const withFoot = classifyRemarkTags({ highway: "service", access: "private", bicycle, foot: "yes" });
    assert(withFoot === null, `bicycle=${bicycle}+foot=yes hoort géén melding te zijn`);
  }
});

scenario("access=private mét bicycle=yes geeft GEEN fietsopmerking (wel footOnly)", () => {
  const c = classifyRemarkTags({
    highway: "service",
    access: "private",
    bicycle: "yes",
  });
  assert(c != null && c.footOnly === true, "fietsers expliciet toegestaan ⇒ hooguit footOnly-meting");
});

scenario("natuurgebied is altijd een indicatie (geknipte grens)", () => {
  const a = classifyRemarkTags({ leisure: "nature_reserve", name: "Duinen" });
  assert(a && a.kind === "natuurgebied" && a.uncertain, "leisure-variant");
  const b = classifyRemarkTags({ boundary: "national_park" });
  assert(b && b.kind === "natuurgebied" && b.uncertain, "boundary-variant");
  assert(b!.evidence === "boundary=national_park", `evidence: ${b!.evidence}`);
});

scenario("slechte smoothness wint van surface", () => {
  const c = classifyRemarkTags({
    highway: "track",
    smoothness: "very_bad",
    surface: "gravel",
  });
  assert(c && c.kind === "slecht_wegdek", "verwacht slecht wegdek");
  assert(c!.evidence === "smoothness=very_bad", `evidence: ${c!.evidence}`);
});

scenario("onverhard uit surface=gravel, kasseien apart", () => {
  const g = classifyRemarkTags({ highway: "track", surface: "gravel" });
  assert(g && g.kind === "onverhard", "gravel = onverhard");
  const k = classifyRemarkTags({ highway: "residential", surface: "sett" });
  assert(k && k.kind === "slecht_wegdek", "sett = kasseien/ruw");
  assert(k!.label.includes("Kasseien"), `label: ${k!.label}`);
});

scenario("surface zonder highway-tag geeft GEEN wegdek-opmerking", () => {
  const c = classifyRemarkTags({ surface: "gravel" });
  assert(c === null, "geen highway ⇒ geen wegdek-oordeel");
});

scenario("gewone verharde weg geeft niets (geen verzonnen waarschuwing)", () => {
  const c = classifyRemarkTags({ highway: "cycleway", surface: "asphalt" });
  assert(c === null, "asfaltfietspad hoort géén opmerking te geven");
});

scenario("HTML in OSM-naam wordt gestript vóór het label", () => {
  const c = classifyRemarkTags({
    route: "ferry",
    name: '<img src=x onerror=alert(1)>Pont',
  });
  assert(c, "verwacht opmerking");
  assert(!c!.label.includes("<"), `label bevat markup: ${c!.label}`);
  assert(c!.label.includes("Pont"), "echte naam moet blijven");
});

scenario("computeDataRemarks benoemt ontbrekende gegevens eerlijk", () => {
  const none = computeDataRemarks({
    hasProfile: true,
    hasDistance: true,
    pointCount: 500,
  });
  assert(none.length === 0, "volledige route ⇒ geen data-opmerkingen");
  const all = computeDataRemarks({
    hasProfile: false,
    hasDistance: false,
    pointCount: 5,
  });
  assert(all.length === 3, `verwacht 3 gaten, kreeg ${all.length}`);
  assert(
    all.some((d) => d.label === "Geen hoogtegegevens") &&
      all.some((d) => d.label === "Afstand onbekend") &&
      all.some((d) => d.label === "Weinig routepunten"),
    "alle drie de gaten moeten benoemd zijn",
  );
});

scenario("null-gaten in Overpass-geometrie crashen niet (regressie)", () => {
  // Overpass kan bij `out geom(bbox)` null-entries teruggeven voor nodes
  // buiten de bbox — die moeten eerlijk worden overgeslagen (eerder een 500).
  const way: OverpassElement = {
    type: "way",
    id: 1,
    geometry: [null, { lat: 52.09, lon: 5.12 }, null, { lat: 52.091, lon: 5.121 }],
  };
  const pts = extractElementPoints(way);
  assert(pts.length === 2, `verwacht 2 geldige punten, kreeg ${pts.length}`);

  const onlyNulls: OverpassElement = { type: "way", id: 2, geometry: [null, null] };
  assert(extractElementPoints(onlyNulls).length === 0, "alleen nulls ⇒ geen punten");

  const nullCenter: OverpassElement = { type: "relation", id: 3, center: null };
  assert(extractElementPoints(nullCenter).length === 0, "null-center ⇒ geen punten");

  const node: OverpassElement = { type: "node", id: 4, lat: 52.1, lon: 5.1 };
  assert(extractElementPoints(node).length === 1, "node ⇒ 1 punt");
});

scenario("countRouteObstacles telt harde blokkades exact (gedeelde regel)", () => {
  const mk = (over: Partial<RouteRemark>): RouteRemark => ({
    id: "t",
    kind: "poort",
    label: "Poort of hek",
    detail: "",
    lat: 52,
    lon: 6,
    routeKm: 1,
    endKm: null,
    offRouteM: 0,
    uncertain: false,
    evidence: "",
    ...over,
  });
  const obs = countRouteObstacles([
    mk({ kind: "trap", label: "Trap" }),
    mk({ kind: "beperkte_toegang", label: "Fietsen hier niet toegestaan" }),
    // Parallelle-fietspad-correctie ⇒ uncertain telt NIET als verbod
    mk({ kind: "beperkte_toegang", label: "Privéterrein", uncertain: true }),
    mk({ kind: "poort", label: "Afgesloten poort / privéterrein" }),
    mk({ kind: "poort", label: "Poort of hek" }),
    mk({ kind: "onverhard", label: "Onverhard" }),
  ]);
  assert(obs.steps === 1, `steps: ${obs.steps}`);
  assert(obs.forbidden === 1, `forbidden: ${obs.forbidden}`);
  assert(obs.blockedGates === 1, `blockedGates: ${obs.blockedGates}`);
  assert(obs.gates === 1, `gates: ${obs.gates}`);
  assert(obs.unpavedSegments === 1, `unpaved: ${obs.unpavedSegments}`);
});

scenario("bronvermelding is OpenStreetMap/ODbL met kanttekening", () => {
  const s = remarksSource();
  assert(s.name.includes("OpenStreetMap"), "bron mist OSM");
  assert(s.license.includes("ODbL"), "licentie mist ODbL");
  assert(s.url.includes("openstreetmap.org/copyright"), "copyright-url mist");
  assert(s.note.length > 10, "eerlijke kanttekening ontbreekt");
});

// ── Zijpad-controle voor poorten (segment-gebaseerd, geen vertex-telling) ───
// Route ~noord-zuid langs lon 6.0000 op lat 52.00..52.01 (~1,1 km).
const ROUTE_NS: [number, number][] = Array.from({ length: 23 }, (_, i) => [
  52.0 + i * 0.0005,
  6.0,
]);
// ~0.00001° lat ≈ 1,11 m; 0.00001° lon ≈ 0,68 m op lat 52.

scenario("poort waar je doorheen rijdt (way aan beide kanten gevolgd) = both", () => {
  // 60 m-wegvak dat exact op de routelijn ligt, poort halverwege.
  const way = {
    geometry: [
      { lat: 52.0040, lon: 6.0 },
      { lat: 52.00454, lon: 6.0 }, // ~60 m verder langs de route
    ],
  };
  const gate: [number, number] = [52.00427, 6.0]; // midden op de way
  assert(
    gatePassageSides(ROUTE_NS, gate, way) === "both",
    "doorreden poort op 2-punts way werd niet als 'both' herkend",
  );
});

scenario("poort op oprit-stub (alleen aansluitpunt bij de weg) = none", () => {
  // Oprit haaks op de route: 40 m naar het oosten, poort op ~12 m van de weg.
  const way = {
    geometry: [
      { lat: 52.0040, lon: 6.0 }, // aansluitpunt op de route
      { lat: 52.0040, lon: 6.00059 }, // ~40 m het erf op
    ],
  };
  const gate: [number, number] = [52.0040, 6.00018]; // ~12 m van de routelijn
  assert(
    gatePassageSides(ROUTE_NS, gate, way) === "none",
    "oprit-poort naast de route werd ten onrechte gevolgd geacht",
  );
});

scenario("poort aan het EIND van een gevolgde weg (afslag ervoor) = one, nooit both", () => {
  // De route volgt de weg tot vlak vóór de poort en slaat af: de poort staat
  // op het uiteinde. Zonder tweede gevolgde parent-way rijd je er NIET doorheen
  // (besluit René 30-07-2026: 0 meter — alleen echte doorgang telt).
  const way = {
    geometry: [
      { lat: 52.0030, lon: 6.0 }, // 60 m op de routelijn…
      { lat: 52.00354, lon: 6.0 },
      { lat: 52.00354, lon: 6.00030 }, // …dan buigt de WAY af, route gaat rechtdoor
      { lat: 52.00354, lon: 6.00060 },
    ],
  };
  const gate: [number, number] = [52.00354, 6.00060]; // poort op het afgebogen uiteinde
  assert(
    gatePassageSides(ROUTE_NS, gate, way) === "one",
    "eindpoort op afgebogen way moet 'one' zijn (alleen samen met 2e way een doorgang)",
  );
});

const failed = results.filter((r) => r.status === "fail");
for (const r of results) {
  console.log(
    `${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`,
  );
}
console.log(
  `\nroute-remarks: ${results.length - failed.length}/${results.length} scenario's geslaagd`,
);
process.exit(failed.length > 0 ? 1 : 0);
