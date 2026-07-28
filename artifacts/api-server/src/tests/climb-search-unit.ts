// Klimmenverkenner — pure unit-regressietest op de zoeklaag (geen netwerk).
//
// De klimmen-zoeklaag bevat inmiddels echte logica die stil kan breken:
//   - kind-detectie (mountain_pass → "pass", highway → "road", anders "peak";
//     roads werden tijdens de bouw al eens per ongeluk als "peak" gelabeld);
//   - spatiële naam-dedupe (zelfde naam ≤ ~3 km = één klim, ver weg = twee),
//     met voorkeur voor het element mét echte hoogte;
//   - sortering (hoogste ele eerst, dan naam);
//   - straal-klemming (2–60 km) en straal→bbox-berekening in searchClimbs.
//
// Alles is testbaar zonder netwerk: we stubben globalThis.fetch (alle externe
// calls lopen daar doorheen) met gemockte Nominatim/Overpass-antwoorden en
// vangen de daadwerkelijk verstuurde Overpass-query op om de bbox te checken.
//
// Run: `pnpm --filter @workspace/api-server run test:climb-search-unit`
// (via shell — de workflow-limiet is bereikt; bewust geen nieuwe workflow.)

// Hermetisch: de DB-cache staat uit zodat elke run de gestubde bron raakt.
process.env.CLIMB_CACHE_DISABLED = "1";

import {
  fetchClimbHitsRaw,
  presentClimbHits,
  type ClimbHit,
} from "../lib/climbs/overpass";
import { searchClimbs, DEFAULT_RADIUS_KM } from "../lib/climbs";

// Zelfde gedrag als de oude searchClimbsInBbox: rauwe fetch + presentatie.
async function searchClimbsInBbox(opts: {
  south: number;
  west: number;
  north: number;
  east: number;
  nameFilter?: string | null;
  limit?: number;
}): Promise<ClimbHit[]> {
  return presentClimbHits(await fetchClimbHitsRaw(opts), opts);
}

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// fetch-stub: Nominatim → vast centrum; Overpass → per-test elementen.
// searchClimbsInBbox cachet per bbox, dus elke scenario gebruikt een eigen
// bbox om cache-vervuiling tussen scenario's uit te sluiten.
// ---------------------------------------------------------------------------

type OverpassEl = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

let overpassElements: OverpassEl[] = [];
let capturedQueries: string[] = [];
let geocodeCenter = { lat: 50.86, lon: 5.83, label: "Valkenburg, Nederland" };

const realFetch = globalThis.fetch;

function installFetchStub() {
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(typeof input === "string" ? input : input?.url ?? input);
    const host = new URL(url).hostname;
    if (host === "nominatim.openstreetmap.org") {
      return new Response(
        JSON.stringify([
          {
            lat: String(geocodeCenter.lat),
            lon: String(geocodeCenter.lon),
            display_name: geocodeCenter.label,
            boundingbox: [
              String(geocodeCenter.lat - 0.01),
              String(geocodeCenter.lat + 0.01),
              String(geocodeCenter.lon - 0.01),
              String(geocodeCenter.lon + 0.01),
            ],
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    // Overpass mirrors — vang de query op en geef de gemockte elementen terug.
    const body = String(init?.body ?? "");
    capturedQueries.push(decodeURIComponent(body.replace(/^data=/, "")));
    return new Response(JSON.stringify({ elements: overpassElements }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

// Elke scenario een eigen bbox (cache-key) — teller schuift de bbox op.
let bboxSeq = 0;
function freshBbox() {
  bboxSeq += 1;
  const south = 40 + bboxSeq; // ruim uit elkaar
  return { south, west: 5, north: south + 0.5, east: 5.5 };
}

function el(
  id: number,
  name: string,
  lat: number,
  lon: number,
  tags: Record<string, string> = {},
  type = "node",
): OverpassEl {
  return { type, id, lat, lon, tags: { name, ...tags } };
}

// ---------------------------------------------------------------------------

async function main() {
  installFetchStub();

  await scenario("kind-detectie: pass / peak / road correct gelabeld", async () => {
    overpassElements = [
      el(1, "Col du Test", 41.1, 5.1, { mountain_pass: "yes" }),
      el(2, "Testberg-top", 41.15, 5.2, { natural: "peak", ele: "322" }),
      {
        type: "way",
        id: 3,
        center: { lat: 41.2, lon: 5.3 },
        tags: { name: "Cauberg", highway: "tertiary" },
      },
    ];
    const hits = await searchClimbsInBbox(freshBbox());
    assert(hits.length === 3, `verwacht 3 hits, kreeg ${hits.length}`);
    const byName = new Map(hits.map((h) => [h.name, h]));
    assert(byName.get("Col du Test")?.kind === "pass", "mountain_pass moet 'pass' zijn");
    assert(byName.get("Testberg-top")?.kind === "peak", "natural=peak moet 'peak' zijn");
    assert(
      byName.get("Cauberg")?.kind === "road",
      `highway-weg moet 'road' zijn, kreeg '${byName.get("Cauberg")?.kind}' (regressie: roads als peak gelabeld)`,
    );
    assert(byName.get("Cauberg")?.osmId === "way/3", "osmId moet type/id zijn");
  });

  await scenario("spatiële dedupe: zelfde naam dichtbij = 1, ver weg = 2", async () => {
    overpassElements = [
      // Drie 'Kruisberg'-segmenten binnen ~1 km van elkaar → één klim.
      el(10, "Kruisberg", 42.10, 5.10, { highway: "tertiary" }),
      el(11, "Kruisberg", 42.105, 5.105, { highway: "tertiary" }),
      el(12, "Kruisberg", 42.11, 5.11, { highway: "tertiary" }),
      // Een tweede echte 'Kruisberg' ~30 km verderop → aparte klim.
      el(13, "Kruisberg", 42.40, 5.10, { highway: "tertiary" }),
    ];
    const hits = await searchClimbsInBbox(freshBbox());
    const kruis = hits.filter((h) => h.name === "Kruisberg");
    assert(
      kruis.length === 2,
      `verwacht 2 Kruisbergen (dichtbij-cluster + verre naamgenoot), kreeg ${kruis.length}`,
    );
  });

  await scenario("dedupe: element mét echte hoogte wint binnen een cluster", async () => {
    overpassElements = [
      // Wegsegment zonder ele eerst, daarna de top mét ele — top moet winnen.
      el(20, "Testberg", 43.10, 5.10, { highway: "tertiary" }),
      el(21, "Testberg", 43.105, 5.105, { natural: "peak", ele: "212 m" }),
      // Omgekeerde volgorde: ele eerst, daarna zonder — ele blijft staan.
      el(22, "Anderberg", 43.20, 5.20, { natural: "peak", ele: "150" }),
      el(23, "Anderberg", 43.205, 5.205, { highway: "tertiary" }),
    ];
    const hits = await searchClimbsInBbox(freshBbox());
    const test = hits.find((h) => h.name === "Testberg");
    const ander = hits.find((h) => h.name === "Anderberg");
    assert(hits.length === 2, `verwacht 2 hits, kreeg ${hits.length}`);
    assert(
      test?.elevationM === 212 && test.osmId === "node/21",
      "ele-element moet winnen (ook als het later komt); '212 m' moet als 212 parsen",
    );
    assert(
      ander?.elevationM === 150 && ander.osmId === "node/22",
      "eerder ele-element mag niet door een ele-loos segment vervangen worden",
    );
  });

  await scenario("sortering: hoogste ele eerst, ele vóór null, dan naam (nl)", async () => {
    overpassElements = [
      el(30, "Zonder-ele-B", 44.1, 5.1, { highway: "tertiary" }),
      el(31, "Laag", 44.15, 5.15, { natural: "peak", ele: "100" }),
      el(32, "Hoog", 44.2, 5.2, { natural: "peak", ele: "900" }),
      el(33, "Aa-zonder-ele", 44.25, 5.25, { highway: "tertiary" }),
    ];
    const hits = await searchClimbsInBbox(freshBbox());
    const names = hits.map((h) => h.name);
    assert(
      JSON.stringify(names) ===
        JSON.stringify(["Hoog", "Laag", "Aa-zonder-ele", "Zonder-ele-B"]),
      `sorteervolgorde fout: ${names.join(", ")}`,
    );
  });

  await scenario("nameFilter filtert case-insensitief op deelnaam", async () => {
    overpassElements = [
      el(40, "Cauberg", 45.1, 5.1, { highway: "tertiary" }),
      el(41, "Keutenberg", 45.2, 5.2, { highway: "tertiary" }),
    ];
    const bbox = freshBbox();
    const all = await searchClimbsInBbox(bbox);
    assert(all.length === 2, "zonder filter beide hits");
    const filtered = await searchClimbsInBbox({ ...bbox, nameFilter: "CAU" });
    assert(
      filtered.length === 1 && filtered[0]!.name === "Cauberg",
      "filter 'CAU' moet alleen Cauberg geven",
    );
  });

  await scenario("searchClimbs: straal-klemming 2–60 km + default", async () => {
    overpassElements = [];
    const low = await searchClimbs({ q: "Valkenburg", radiusKm: 0.5 });
    assert(low.radiusKm === 2, `straal 0.5 moet naar 2 klemmen, kreeg ${low.radiusKm}`);
    const high = await searchClimbs({ q: "Valkenburg", radiusKm: 500 });
    assert(high.radiusKm === 60, `straal 500 moet naar 60 klemmen, kreeg ${high.radiusKm}`);
    const def = await searchClimbs({ q: "Valkenburg" });
    assert(
      def.radiusKm === DEFAULT_RADIUS_KM,
      `zonder straal moet default ${DEFAULT_RADIUS_KM} gelden, kreeg ${def.radiusKm}`,
    );
    assert(low.area?.label === geocodeCenter.label, "gebiedslabel moet uit geocode komen");
  });

  await scenario("searchClimbs: straal→bbox-berekening klopt in de Overpass-query", async () => {
    overpassElements = [];
    capturedQueries = [];
    geocodeCenter = { lat: 50.0, lon: 6.0, label: "Testplaats" };
    const radiusKm = 20;
    await searchClimbs({ q: "Testplaats-bbox", radiusKm });
    const ql = capturedQueries[capturedQueries.length - 1] ?? "";
    const m = ql.match(/\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\)/);
    assert(m, `geen bbox gevonden in query: ${ql.slice(0, 120)}`);
    const [south, west, north, east] = m!.slice(1).map(Number) as [
      number, number, number, number,
    ];
    const halfLat = radiusKm / 111;
    const halfLon =
      radiusKm / (111 * Math.max(Math.cos((50.0 * Math.PI) / 180), 0.2));
    const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    assert(close(south, 50.0 - halfLat), `south fout: ${south}`);
    assert(close(north, 50.0 + halfLat), `north fout: ${north}`);
    assert(close(west, 6.0 - halfLon), `west fout: ${west}`);
    assert(close(east, 6.0 + halfLon), `east fout: ${east}`);
    assert(north - south < east - west, "lon-halfspan moet op deze breedte groter zijn dan lat");
  });

  await scenario("searchClimbs: cos-vloer 0.2 begrenst de lon-span nabij de pool", async () => {
    overpassElements = [];
    capturedQueries = [];
    geocodeCenter = { lat: 89.0, lon: 10.0, label: "Poolplaats" };
    const radiusKm = 10;
    await searchClimbs({ q: "Poolplaats-bbox", radiusKm });
    const ql = capturedQueries[capturedQueries.length - 1] ?? "";
    const m = ql.match(/\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\)/);
    assert(m, "geen bbox gevonden in poolquery");
    const west = Number(m![2]);
    const east = Number(m![4]);
    const expectedHalfLon = radiusKm / (111 * 0.2); // cos(89°) < 0.2 → vloer
    assert(
      Math.abs(east - west - 2 * expectedHalfLon) < 1e-6,
      `lon-span moet door de 0.2-vloer begrensd zijn, kreeg ${east - west}`,
    );
  });

  globalThis.fetch = realFetch;

  // Rapport
  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✅" : "❌";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed += 1;
  }
  console.log(
    `\nclimb-search-unit: ${results.length - failed}/${results.length} scenario's geslaagd`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("climb-search-unit: onverwachte fout:", err);
  process.exit(1);
});
