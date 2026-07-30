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
  extractElementPoints,
  remarksSource,
  type OverpassElement,
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
  const exc = classifyRemarkTags({ barrier: "gate", access: "private", bicycle: "yes" });
  assert(exc === null, `fiets-uitzondering hoort niet gemeld, kreeg: ${exc?.label}`);
});

scenario("poort zonder doorgang-tags blijft een milde, onzekere melding", () => {
  const c = classifyRemarkTags({ barrier: "gate" });
  assert(c && c.kind === "poort", "verwacht poort");
  assert(c!.uncertain, "onbekende doorgang hoort onzeker te zijn");
  assert(c!.label.startsWith("Poort of hek"), `label: ${c!.label}`);
});

scenario("bicycle=no is harde beperking (niet onzeker)", () => {
  const c = classifyRemarkTags({ highway: "path", bicycle: "no" });
  assert(c && c.kind === "beperkte_toegang", "verwacht beperkte toegang");
  assert(!c!.uncertain, "bicycle=no is expliciet, geen indicatie");
});

scenario("access=private zónder bicycle=yes is een indicatie", () => {
  const c = classifyRemarkTags({ highway: "service", access: "private" });
  assert(c && c.kind === "beperkte_toegang", "verwacht beperkte toegang");
  assert(c!.uncertain, "access=private moet als indicatie gelden");
  assert(c!.label === "Privéterrein", `label: ${c!.label}`);
});

scenario("access=private mét bicycle=yes geeft GEEN opmerking", () => {
  const c = classifyRemarkTags({
    highway: "service",
    access: "private",
    bicycle: "yes",
  });
  assert(c === null, "fietsers expliciet toegestaan ⇒ geen waarschuwing");
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

scenario("bronvermelding is OpenStreetMap/ODbL met kanttekening", () => {
  const s = remarksSource();
  assert(s.name.includes("OpenStreetMap"), "bron mist OSM");
  assert(s.license.includes("ODbL"), "licentie mist ODbL");
  assert(s.url.includes("openstreetmap.org/copyright"), "copyright-url mist");
  assert(s.note.length > 10, "eerlijke kanttekening ontbreekt");
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
