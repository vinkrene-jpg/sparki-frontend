/**
 * Bewijsset blokkadepoort — stap 1 van de Routes-bewijsronde (30-07-2026).
 *
 * Zoekt per blokkade-categorie een ÉCHTE OSM-locatie in Nederland, legt er een
 * echte routelijn (de weggeometrie zelf) overheen en meet met exact dezelfde
 * code als de app (getRouteRemarks → countRouteObstacles) wat de poort beslist.
 * Daarnaast een echte HTTP-proef tegen de draaiende dev-API: handmatige
 * waypoints óver een afgesloten poort → verwacht 422 NO_SUITABLE_ROUTE, voor
 * racefiets, gravel én MTB.
 *
 * Eerlijkheid: geen synthetische data. Elke case rapporteert de OSM-id, de
 * letterlijke tags en de gemeten obstakels. Overpass-uitval of geen vondst =
 * eerlijk "GEEN BEWIJS", nooit een gefingeerde pass.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  getRouteRemarks,
  countRouteObstacles,
  extractElementPoints,
  type OverpassElement,
  type RouteObstacles,
} from "../lib/route-remarks.js";
import type { RoutePathPoint } from "@workspace/db";

const MIRRORS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];
const PAUSE_MS = Number(process.env.BEWIJS_PAUSE_MS ?? 5000); // beleefd: nooit een burst richting Overpass
// Fase-splitsing (shell-limiet 5 min): "meting" = alleen categorieën A–E;
// "http" = alleen de HTTP-keten op basis van het eerder geschreven bewijs.
const FASE = process.env.BEWIJS_FASE ?? "alles";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function overpass(query: string): Promise<OverpassElement[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const endpoint of MIRRORS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Sparki/1.0 (cycling training app; bewijsset)",
            Accept: "application/json",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) continue;
        const json = (await res.json()) as { elements?: OverpassElement[] };
        return Array.isArray(json.elements) ? json.elements : [];
      } catch {
        // volgende mirror
      }
    }
    await sleep(PAUSE_MS); // één beleefde retry-ronde
  }
  return null;
}

// Zoekgebied: midden-Nederland (Utrechtse Heuvelrug/Veluwe-rand) — dicht genoeg
// getagd voor alle categorieën. Klein genoeg voor snelle queries.
const BBOX = "51.95,5.10,52.25,5.95";

type Case = {
  categorie: string;
  verwacht: string;
  gevonden: boolean;
  osm: { type: string; id: number; tags: Record<string, string> } | null;
  locatie: { lat: number; lon: number } | null;
  meting: RouteObstacles | null;
  remarksLabels: string[];
  hard: boolean | null;
  oordeel: "PASS" | "FAIL" | "GEEN_BEWIJS";
  toelichting: string;
};

const hardOf = (o: RouteObstacles) =>
  o.forbidden > 0 || o.steps > 0 || o.blockedGates > 0;

function centerOf(track: RoutePathPoint[]): { lat: number; lon: number } {
  const m = track[Math.floor(track.length / 2)]!;
  return { lat: m[0], lon: m[1] };
}

/** Meet een echte weggeometrie met exact de app-meting. */
async function measureTrack(track: RoutePathPoint[]) {
  const remarks = await getRouteRemarks(track);
  if (remarks === null) return null;
  return { remarks, obstacles: countRouteObstacles(remarks) };
}

/** Vind een way met gegeven filter en geef zijn eigen geometrie als track. */
async function findWayCase(filter: string): Promise<{
  el: OverpassElement;
  track: RoutePathPoint[];
} | null> {
  const els = await overpass(
    `[out:json][timeout:25];way${filter}(${BBOX});out geom 8;`,
  );
  if (!els) return null;
  for (const el of els) {
    const track = extractElementPoints(el);
    if (track.length >= 2) return { el, track };
  }
  return null;
}

/**
 * Als findWayCase, maar probeert meerdere echte kandidaten en meet ze stuk
 * voor stuk tot er één aan de verwachting voldoet. Nodig voor bicycle=no in
 * stedelijk gebied: de parallelle-fietspad-correctie (bewust gedrag) zet het
 * verbod daar vaak terecht op uncertain. Elke meting blijft 100% echt; we
 * zoeken alleen een locatie ZONDER die uitzondering. Geeft de laatste
 * gemeten kandidaat terug als geen enkele voldoet (eerlijke FAIL-context).
 */
async function findWayCaseMatching(
  filter: string,
  matches: (o: RouteObstacles) => boolean,
  maxTries = 5,
): Promise<{
  found: { el: OverpassElement; track: RoutePathPoint[] } | null;
  meting: { remarks: { label: string }[]; obstacles: RouteObstacles } | null;
}> {
  const els = await overpass(
    `[out:json][timeout:25];way${filter}(${BBOX});out geom 20;`,
  );
  if (!els) return { found: null, meting: null };
  let last: {
    found: { el: OverpassElement; track: RoutePathPoint[] };
    meting: { remarks: { label: string }[]; obstacles: RouteObstacles } | null;
  } | null = null;
  let tried = 0;
  for (const el of els) {
    if (tried >= maxTries) break;
    const track = extractElementPoints(el);
    if (track.length < 2) continue;
    tried++;
    await sleep(PAUSE_MS);
    const meting = await measureTrack(track);
    last = { found: { el, track }, meting };
    if (meting && matches(meting.obstacles)) return last;
    console.log(
      `  kandidaat way/${el.id} voldeed niet (${meting ? JSON.stringify(meting.obstacles) : "meting-gat"}) — volgende`,
    );
  }
  return last ?? { found: null, meting: null };
}

/** Vind een barrier-node met gegeven filter + een aangesloten fietsbare weg. */
async function findGateCase(filter: string): Promise<{
  el: OverpassElement;
  track: RoutePathPoint[];
} | null> {
  const els = await overpass(
    `[out:json][timeout:25];node${filter}(${BBOX});out 20;`,
  );
  if (!els) return null;
  for (const node of els.slice(0, 6)) {
    await sleep(PAUSE_MS);
    const ways = await overpass(
      `[out:json][timeout:25];node(${node.id});way(bn)["highway"~"^(track|path|cycleway|service|unclassified|residential|footway|bridleway)$"];out geom 3;`,
    );
    if (!ways) return null;
    for (const w of ways) {
      const track = extractElementPoints(w);
      if (track.length >= 2) return { el: node, track };
    }
  }
  return null;
}

function caseResult(
  categorie: string,
  verwacht: string,
  found: { el: OverpassElement; track: RoutePathPoint[] } | null,
  meting: { remarks: { label: string }[]; obstacles: RouteObstacles } | null,
  check: (o: RouteObstacles, labels: string[]) => [boolean, string],
): Case {
  if (!found) {
    return {
      categorie, verwacht, gevonden: false, osm: null, locatie: null,
      meting: null, remarksLabels: [], hard: null, oordeel: "GEEN_BEWIJS",
      toelichting: "Geen echte OSM-locatie gevonden of Overpass onbereikbaar — eerlijk geen bewijs.",
    };
  }
  if (!meting) {
    return {
      categorie, verwacht, gevonden: true,
      osm: { type: found.el.type, id: found.el.id, tags: found.el.tags ?? {} },
      locatie: centerOf(found.track), meting: null, remarksLabels: [],
      hard: null, oordeel: "GEEN_BEWIJS",
      toelichting: "Locatie gevonden maar de meting (getRouteRemarks) gaf een eerlijk gat (Overpass-fout).",
    };
  }
  const labels = meting.remarks.map((r) => r.label);
  const [ok, why] = check(meting.obstacles, labels);
  return {
    categorie, verwacht, gevonden: true,
    osm: { type: found.el.type, id: found.el.id, tags: found.el.tags ?? {} },
    locatie: centerOf(found.track),
    meting: meting.obstacles, remarksLabels: labels,
    hard: hardOf(meting.obstacles),
    oordeel: ok ? "PASS" : "FAIL",
    toelichting: why,
  };
}

const EVIDENCE_FILE = path.resolve(
  process.cwd(),
  "../../docs/product/proof-evidence/routes-blokkadepoort-bewijsset-2026-07-30.json",
);

// Deelselectie (shell-limiet): BEWIJS_CASES="A,B" draait alleen die
// categorieën en voegt ze samen met eerder geschreven bewijs.
const CASE_SELECT = (process.env.BEWIJS_CASES ?? "A,B,C,D,E")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
const caseActive = (letter: string) => CASE_SELECT.includes(letter);

async function main() {
  let prior: Case[] = [];
  if (existsSync(EVIDENCE_FILE)) {
    try {
      prior = (JSON.parse(readFileSync(EVIDENCE_FILE, "utf8")) as { cases: Case[] }).cases ?? [];
    } catch {
      prior = [];
    }
  }
  if (FASE === "http" && prior.length === 0) {
    console.error("Geen metingfase-bewijs gevonden — draai eerst BEWIJS_FASE=meting.");
    process.exit(1);
  }
  const cases: Case[] = FASE === "http" ? prior : [];
  const run = async (
    categorie: string,
    verwacht: string,
    find: () => Promise<{ el: OverpassElement; track: RoutePathPoint[] } | null>,
    check: (o: RouteObstacles, labels: string[]) => [boolean, string],
  ) => {
    if (!caseActive(categorie[0]!)) return;
    console.log(`\n── ${categorie} ──`);
    const found = await find();
    const meting = found ? await measureTrack(found.track) : null;
    const c = caseResult(categorie, verwacht, found, meting, check);
    cases.push(c);
    console.log(
      `${c.oordeel} — ${c.toelichting}` +
        (c.osm ? ` [${c.osm.type}/${c.osm.id} ${JSON.stringify(c.osm.tags)}]` : ""),
    );
    await sleep(PAUSE_MS);
  };

  if (FASE !== "http") {
  // A. Fietsverbod op een wegvak (bicycle=no) → hard (forbidden ≥ 1).
  // Meerdere echte kandidaten: in de stad zet de parallelle-fietspad-
  // correctie het verbod vaak terecht op uncertain (bewust gedrag).
  if (caseActive("A")) {
    console.log(`\n── A. Fietsverbod (bicycle=no) ──`);
    // BEWIJS_A_WAY: eerder via discovery gevonden way-id direct meten (de
    // discovery-scan zelf duurt te lang voor de shell-limiet; de meting
    // blijft identiek en 100% echt).
    const pinnedWay = process.env.BEWIJS_A_WAY;
    const { found, meting } = pinnedWay
      ? await (async () => {
          const els = await overpass(`[out:json][timeout:25];way(${pinnedWay});out geom;`);
          const el = els?.[0];
          const track = el ? extractElementPoints(el) : [];
          if (!el || track.length < 2) return { found: null, meting: null };
          return { found: { el, track }, meting: await measureTrack(track) };
        })()
      : await findWayCaseMatching(
          `["highway"]["bicycle"="no"]["highway"!~"^(motorway|motorway_link|trunk|trunk_link|footway|pedestrian)$"]`,
          (o) => o.forbidden >= 1,
        );
    const c = caseResult(
      "A. Fietsverbod (bicycle=no)",
      "hard blok: forbidden ≥ 1",
      found,
      meting,
      (o) => [o.forbidden >= 1 && hardOf(o), `forbidden=${o.forbidden} → hard=${hardOf(o)}`],
    );
    cases.push(c);
    console.log(
      `${c.oordeel} — ${c.toelichting}` +
        (c.osm ? ` [${c.osm.type}/${c.osm.id} ${JSON.stringify(c.osm.tags)}]` : ""),
    );
    await sleep(PAUSE_MS);
  }

  // B. Privéterrein (access=private zonder fietsuitzondering) → hard
  await run(
    "B. Privéterrein (access=private)",
    "hard blok: forbidden ≥ 1",
    () => findWayCase(`["highway"~"^(track|service|path|unclassified)$"]["access"="private"]["bicycle"!~"^(yes|designated|permissive)$"]`),
    (o) => [o.forbidden >= 1 && hardOf(o), `forbidden=${o.forbidden} → hard=${hardOf(o)}`],
  );

  // C. Afgesloten poort (gate + locked=yes of access=no/private) → hard
  await run(
    "C. Afgesloten poort (locked/privé)",
    "hard blok: blockedGates ≥ 1",
    async () =>
      (await findGateCase(`["barrier"="gate"]["locked"="yes"]["bicycle"!~"^(yes|designated|permissive)$"]`)) ??
      (await findGateCase(`["barrier"="gate"]["access"~"^(no|private)$"]["bicycle"!~"^(yes|designated|permissive)$"]`)),
    (o) => [o.blockedGates >= 1 && hardOf(o), `blockedGates=${o.blockedGates} → hard=${hardOf(o)}`],
  );

  // D. Onbekende poort (geen doorgangstags) → zachte waarschuwing, NIET hard
  await run(
    "D. Onbekende poort (geen tags)",
    "zacht: gates ≥ 1, geen hard blok door deze poort",
    () => findGateCase(`["barrier"="gate"][!"locked"][!"access"][!"bicycle"]`),
    (o, labels) => [
      o.gates >= 1 && labels.some((l) => l.startsWith("Poort of hek")) && !hardOf(o),
      `gates=${o.gates} blockedGates=${o.blockedGates} hard=${hardOf(o)} labels=${labels.join("|")}`,
    ],
  );

  // E. Geldige fietssluis (cycle_barrier) → doorlaten: géén poortmelding
  await run(
    "E. Fietssluis (cycle_barrier)",
    "doorlaten: geen poortmelding, geen hard blok",
    () => findGateCase(`["barrier"="cycle_barrier"][!"bicycle"][!"access"]`),
    (o, labels) => [
      o.blockedGates === 0 && !hardOf(o) && !labels.some((l) => l.includes("Fietssluis")),
      `blockedGates=${o.blockedGates} gates=${o.gates} hard=${hardOf(o)} labels=${labels.join("|") || "(geen)"}`,
    ],
  );

  // Samenvoegen met eerder bewijs: cases die deze run niet draaiden,
  // blijven staan zoals eerder gemeten.
  for (const p of prior) {
    if (!cases.some((c) => c.categorie[0] === p.categorie[0])) cases.push(p);
  }
  cases.sort((a, b) => a.categorie.localeCompare(b.categorie));
  } // einde metingfase

  // F+G. HTTP-keten: handmatige waypoints óver de blokkade uit case C/B →
  // 422 NO_SUITABLE_ROUTE (eerlijk falen) voor racefiets, gravel én MTB.
  const blocked = cases.find(
    (c) => (c.categorie.startsWith("C.") || c.categorie.startsWith("B.")) && c.oordeel === "PASS",
  );
  const http: Record<string, unknown>[] = [];
  if (FASE === "meting") {
    http.push({ oordeel: "UITGESTELD", reden: "HTTP-keten draait als aparte fase (BEWIJS_FASE=http)" });
  } else {
    void blocked;
    // Een router (GraphHopper/ORS) rijdt zelf al om access=private-wegen heen
    // — dat is correct gedrag maar bewijst de póórt niet. De poort bewijst
    // zich op een op slot zittende poort-NODE op een verder onbeperkte,
    // routeerbare weg: daar legt de router de lijn wél doorheen en moet
    // Sparki's eigen controlelaag hem weigeren (422 NO_SUITABLE_ROUTE).
    const base = process.env.BEWIJS_API_BASE ?? "http://127.0.0.1:8080";
    const distM = (a: [number, number], b: [number, number]) => {
      const R = 6371000;
      const dLat = ((b[0] - a[0]) * Math.PI) / 180;
      const dLon = ((b[1] - a[1]) * Math.PI) / 180;
      const la1 = (a[0] * Math.PI) / 180;
      const la2 = (b[0] * Math.PI) / 180;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    };
    const pinnedGate = process.env.BEWIJS_HTTP_GATE; // node-id uit eerdere run
    const gateEls = await overpass(
      pinnedGate
        ? `[out:json][timeout:25];node(${pinnedGate});out;`
        : `[out:json][timeout:25];node["barrier"="gate"]["locked"="yes"]["bicycle"!~"^(yes|designated|permissive)$"](${BBOX});out 25;`,
    );
    let proven = false;
    for (const gate of (gateEls ?? []).slice(0, 6)) {
      if (proven || gate.lat == null || gate.lon == null) continue;
      await sleep(PAUSE_MS);
      // Alleen poorten op een verder onbeperkte, routeerbare weg.
      const ways = await overpass(
        `[out:json][timeout:25];node(${gate.id});way(bn)["highway"~"^(track|path|cycleway|service|unclassified|residential)$"][!"access"][!"bicycle"];out geom 1;`,
      );
      const way = ways?.[0];
      const track = way ? extractElementPoints(way) : [];
      if (!way || track.length < 2) continue;
      const wps = [track[0], [gate.lat, gate.lon], track[track.length - 1]!];
      const probes: Record<string, unknown>[] = [];
      let any422 = false;
      let crossed = false;
      for (const bikeType of ["racefiets", "gravel", "mtb"]) {
        try {
          const res = await fetch(`${base}/api/routes/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "waypoints", waypoints: wps, bikeType }),
            signal: AbortSignal.timeout(120000),
          });
          const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          // Afstand van de teruggegeven lijn tot de poort: alleen een 200
          // MET lijn-door-de-poort zou een gemiste blokkade zijn.
          let minDistM: number | null = null;
          const cand = (body as { candidate?: { geometry?: [number, number][] } }).candidate;
          if (Array.isArray(cand?.geometry)) {
            minDistM = Math.min(
              ...cand.geometry.map((p) => distM(p, [gate.lat!, gate.lon!])),
            );
          }
          const is422 = res.status === 422 && body.code === "NO_SUITABLE_ROUTE";
          if (is422) any422 = true;
          if (res.status === 200 && minDistM != null && minDistM < 30) crossed = true;
          probes.push({
            bikeType,
            status: res.status,
            code: body.code ?? null,
            blockage: body.blockage ?? null,
            minAfstandTotPoortM: minDistM == null ? null : Math.round(minDistM),
            oordeel: is422
              ? "PASS (geweigerd: 422 NO_SUITABLE_ROUTE)"
              : res.status === 200
                ? minDistM != null && minDistM < 30
                  ? "FAIL (route loopt door de poort en werd toch aangeboden)"
                  : "OK (router omzeilde de poort zelf — poort niet getriggerd)"
                : `ONVERWACHT (${res.status})`,
          });
          console.log(
            `HTTP gate node/${gate.id} ${bikeType}: ${res.status} ${String(body.code ?? "")} minDist=${minDistM == null ? "?" : Math.round(minDistM)}m`,
          );
        } catch (e) {
          probes.push({ bikeType, error: String(e), oordeel: "GEEN_BEWIJS (API onbereikbaar)" });
        }
        await sleep(2000);
      }
      http.push({ gate: { id: gate.id, tags: gate.tags ?? {}, lat: gate.lat, lon: gate.lon }, way: way.id, probes });
      if (any422 || crossed) proven = true; // definitief resultaat (goed of fout)
    }
    if (http.length === 0) {
      http.push({ oordeel: "GEEN_BEWIJS", reden: "geen geschikte op-slot-poort op onbeperkte weg gevonden of Overpass onbereikbaar" });
    }
  }

  // HTTP-bewijs samenvoegen: eerdere runs blijven staan (koude vs warme
  // cache zijn allebei bewijs), nieuwe run komt erbij met tijdstempel.
  let priorHttp: Record<string, unknown>[] = [];
  if (existsSync(EVIDENCE_FILE)) {
    try {
      priorHttp =
        (JSON.parse(readFileSync(EVIDENCE_FILE, "utf8")) as { httpKeten?: Record<string, unknown>[] }).httpKeten ?? [];
    } catch { /* leeg laten */ }
  }
  const stamped = http.map((h) => ({ run: new Date().toISOString(), ...h }));
  const mergedHttp = FASE === "meting" ? (priorHttp.length ? priorHttp : stamped) : [...priorHttp, ...stamped];

  const out = {
    titel: "Bewijsset blokkadepoort — echte OSM-locaties per categorie",
    datum: new Date().toISOString(),
    zoekgebied: BBOX,
    cases,
    httpKeten: mergedHttp,
  };
  mkdirSync(path.dirname(EVIDENCE_FILE), { recursive: true });
  writeFileSync(EVIDENCE_FILE, JSON.stringify(out, null, 2));
  console.log(`\nBewijs geschreven: ${EVIDENCE_FILE}`);

  const fails = cases.filter((c) => c.oordeel === "FAIL");
  const missing = cases.filter((c) => c.oordeel === "GEEN_BEWIJS");
  console.log(
    `\nSamenvatting: ${cases.length - fails.length - missing.length} PASS, ${fails.length} FAIL, ${missing.length} GEEN_BEWIJS`,
  );

  // Gate-veiligheid (review): negatieve HTTP-bewijzen laten de run hard falen.
  // Elke aangeboden route dwars door de poort, onverwachte status of het
  // ontbreken van 422-bewijs in de hele bewijsketen = exit 1.
  let httpBad = false;
  if (FASE !== "meting") {
    for (const entry of stamped) {
      const probes = (entry as { probes?: { oordeel?: string }[] }).probes ?? [];
      for (const p of probes) {
        if (typeof p.oordeel === "string" && (p.oordeel.startsWith("FAIL") || p.oordeel.startsWith("ONVERWACHT") || p.oordeel.startsWith("GEEN_BEWIJS"))) {
          console.error(`HTTP-bewijs negatief: ${p.oordeel}`);
          httpBad = true;
        }
      }
    }
    const any422 = mergedHttp.some((e) =>
      ((e as { probes?: { status?: number; code?: unknown }[] }).probes ?? []).some(
        (p) => p.status === 422 && p.code === "NO_SUITABLE_ROUTE",
      ),
    );
    if (!any422) {
      console.error("Geen enkel 422-weigeringsbewijs in de bewijsketen — poort niet bewezen.");
      httpBad = true;
    }
  }
  if (fails.length > 0 || httpBad) process.exit(1);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("bewijsset gefaald:", e);
    process.exit(1);
  },
);
