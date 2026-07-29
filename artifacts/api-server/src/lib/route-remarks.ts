// Routeopmerkingen: echte waarschuwingen en bijzonderheden langs een route.
//
// Bron: OpenStreetMap via de Overpass API (mirror-keten zoals de
// Klimmenverkenner; bbox-query + lokale afstandsfilter zoals route-pois —
// around-linestring geeft 504's op lange routes). Elke opmerking komt
// rechtstreeks uit een aantoonbare OSM-tag; er wordt NOOIT een waarschuwing,
// afsluiting of gevaar verzonnen. OSM kan verouderd zijn — dat staat er
// expliciet bij (uncertain + bronvermelding op elke response).
//
// Honesty contract: bij een upstream-fout is het antwoord null (eerlijk gat),
// nooit een lege lijst die "geen bijzonderheden" suggereert.

import type { RoutePathPoint } from "@workspace/db";
import { samplePath } from "./route-insight";

export type RouteRemarkKind =
  | "veerpont"
  | "trap"
  | "poort"
  | "onverhard"
  | "slecht_wegdek"
  | "beperkte_toegang"
  | "natuurgebied"
  | "doorwaadbare_plaats";

export type RouteRemark = {
  id: string; // stable OSM identity "way/123" (merged: first element)
  kind: RouteRemarkKind;
  label: string; // korte Nederlandse titel
  detail: string; // uitleg op basis van de echte tags
  lat: number;
  lon: number;
  routeKm: number; // begin (of punt) langs de route
  endKm: number | null; // einde bij een gemergd wegvak, anders null
  offRouteM: number; // afstand element ↔ routelijn
  // true = de informatie is per definitie een indicatie (bv. gebiedsgrens uit
  // een geknipte geometrie) — in de UI expliciet als "indicatie" gelabeld.
  uncertain: boolean;
  // De letterlijke OSM-tagwaarde(n) waarop deze opmerking is gebaseerd, zodat
  // de renner (en wij) kunnen zien wáárom dit wordt gemeld.
  evidence: string;
};

export type RouteRemarksResult = {
  remarks: RouteRemark[];
  source: {
    name: string;
    license: string;
    url: string;
    note: string;
  };
};

// Zelfde mirror-keten als lib/climbs/overpass.ts: overpass-api.de geeft in deze
// omgeving vaak 406, maps.mail.ru werkt betrouwbaar.
const ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const OVERPASS_TIMEOUT_MS = 20_000;

const CACHE = new Map<string, { at: number; data: RouteRemark[] }>();
const CACHE_TTL_MS = 15 * 60_000;

// Element moet praktisch óp de route liggen; 30 m vangt GPS/kaart-offset
// zonder parallelle paden mee te nemen. Natuurgebied is een vlak: ruimer.
const NEAR_ROUTE_M = 30;
const NEAR_AREA_M = 60;
// Toegangsbeperkingen ("hier mag je niet fietsen") zijn een oordeel over de
// route zélf en eisen daarom dat de weg vrijwel samenvalt met de routelijn.
// 30 m ving óók de parallelle N-weg naast een fietspad en de snelweg onder een
// viaduct — precies de tientallen valse meldingen uit René's praktijktest.
// 6 m omdat routegeometrie de OSM-weggeometrie exact volgt: een wegvak dat je
// écht rijdt ligt op ~0 m; 7–10 m is de rijbaan NAAST het fietspad (gemeten
// in de praktijktest van 2026-07-29, way-voor-way gecontroleerd).
const NEAR_ACCESS_M = 6;
// Wegdek-meldingen (onverhard/slecht wegdek) zijn óók een oordeel over de
// route zélf: een grindpad 20 m naast het fietspad rijd je niet. Zelfde
// strakke eis als toegang, met verfijning tegen de volledige geometrie.
const NEAR_SURFACE_M = 10;

const SOURCE = {
  name: "OpenStreetMap (via Overpass API)",
  license: "ODbL 1.0 — © OpenStreetMap-bijdragers",
  url: "https://www.openstreetmap.org/copyright",
  note: "Kaartgegevens kunnen verouderd of onvolledig zijn; controleer ter plekke.",
} as const;

function haversineM(a: RoutePathPoint, b: RoutePathPoint): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ── Tag → opmerking (deterministisch, alleen aantoonbare tags) ──────────────

const UNPAVED_SURFACES = new Set([
  "unpaved",
  "gravel",
  "fine_gravel",
  "dirt",
  "ground",
  "grass",
  "sand",
  "mud",
  "compacted",
  "pebblestone",
  "earth",
  "woodchips",
]);
const ROUGH_SURFACES = new Set(["cobblestone", "sett", "unhewn_cobblestone"]);
const BAD_SMOOTHNESS = new Set([
  "bad",
  "very_bad",
  "horrible",
  "very_horrible",
  "impassable",
]);
const GATE_BARRIERS = new Set([
  "gate",
  "lift_gate",
  "swing_gate",
  "cycle_barrier",
  "stile",
  "kissing_gate",
  "turnstile",
  "block",
]);

type Classified = {
  kind: RouteRemarkKind;
  label: string;
  detail: string;
  uncertain: boolean;
  evidence: string;
};

export function classifyRemarkTags(
  tags: Record<string, string>,
): Classified | null {
  const name = (tags.name ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 60);
  const named = name ? ` (${name})` : "";

  if (tags.route === "ferry") {
    return {
      kind: "veerpont",
      label: `Veerpont${named}`,
      detail:
        "De route steekt hier over met een veerpont. Houd rekening met vaartijden en eventuele kosten.",
      uncertain: false,
      evidence: "route=ferry",
    };
  }
  if (tags.highway === "steps") {
    return {
      kind: "trap",
      label: "Trap op de route",
      detail:
        "Volgens de kaartgegevens ligt hier een trap — je moet hier waarschijnlijk afstappen en dragen.",
      uncertain: false,
      evidence: "highway=steps",
    };
  }
  if (tags.ford === "yes" || tags.ford === "stream") {
    return {
      kind: "doorwaadbare_plaats",
      label: "Doorwaadbare plaats",
      detail:
        "De route kruist hier water zonder brug (voorde). Bij hoog water kan dit onbegaanbaar zijn.",
      uncertain: false,
      evidence: `ford=${tags.ford}`,
    };
  }
  if (tags.barrier && GATE_BARRIERS.has(tags.barrier)) {
    const locked = tags.locked === "yes";
    return {
      kind: "poort",
      label:
        tags.barrier === "cycle_barrier"
          ? "Fietssluis / hekje"
          : `Poort of afsluiting${named}`,
      detail: locked
        ? "Volgens de kaartgegevens staat hier een afgesloten poort (op slot). Mogelijk kun je hier niet door."
        : "Hier staat een poort, hek of fietssluis op de route — even afstappen of slalommen.",
      uncertain: false,
      evidence: `barrier=${tags.barrier}${locked ? ", locked=yes" : ""}`,
    };
  }
  // Toegangsbeperkingen — alleen expliciete tags, nooit een aanname.
  const access = tags.access ?? "";
  const bicycle = tags.bicycle ?? "";
  if (bicycle === "no" || bicycle === "private") {
    return {
      kind: "beperkte_toegang",
      label: "Fietsen hier niet toegestaan",
      detail:
        "Volgens de kaartgegevens is dit wegvak niet toegankelijk voor fietsers. Controleer ter plekke of kies een alternatief.",
      uncertain: false,
      evidence: `bicycle=${bicycle}`,
    };
  }
  if ((access === "no" || access === "private") && bicycle !== "yes") {
    return {
      kind: "beperkte_toegang",
      label: access === "private" ? "Privéterrein" : "Beperkte toegang",
      detail:
        "Dit wegvak is volgens de kaartgegevens niet openbaar toegankelijk. Mogelijk geldt een uitzondering; controleer ter plekke.",
      uncertain: true,
      evidence: `access=${access}`,
    };
  }
  if (
    tags.leisure === "nature_reserve" ||
    tags.boundary === "protected_area" ||
    tags.boundary === "national_park"
  ) {
    return {
      kind: "natuurgebied",
      label: `Beschermd natuurgebied${named}`,
      detail:
        "De route loopt hier langs of door een beschermd natuurgebied. Er kunnen toegangstijden of gedragsregels gelden.",
      uncertain: true, // gebiedsgrens uit geknipte geometrie = indicatie
      evidence:
        tags.leisure === "nature_reserve"
          ? "leisure=nature_reserve"
          : `boundary=${tags.boundary}`,
    };
  }
  // Wegdek — alleen voor wegvakken mét een highway-tag (echte wegen/paden).
  if (tags.highway) {
    const smoothness = tags.smoothness ?? "";
    if (BAD_SMOOTHNESS.has(smoothness)) {
      return {
        kind: "slecht_wegdek",
        label: "Slecht wegdek",
        detail: `Dit wegvak staat op de kaart gemarkeerd met slechte staat ("${smoothness}"). Rustig aan met smalle banden.`,
        uncertain: false,
        evidence: `smoothness=${smoothness}`,
      };
    }
    const surface = tags.surface ?? "";
    if (UNPAVED_SURFACES.has(surface)) {
      return {
        kind: "onverhard",
        label: "Onverhard wegvak",
        detail: `Volgens de kaartgegevens is dit wegvak onverhard (${surface}). Met een racefiets kan dit lastig zijn.`,
        uncertain: false,
        evidence: `surface=${surface}`,
      };
    }
    if (ROUGH_SURFACES.has(surface)) {
      return {
        kind: "slecht_wegdek",
        label: "Kasseien / ruw wegdek",
        detail: `Dit wegvak heeft een ruw wegdek (${surface}). Houd rekening met trillingen en verminderde grip.`,
        uncertain: false,
        evidence: `surface=${surface}`,
      };
    }
  }
  return null;
}

// ── Overpass ────────────────────────────────────────────────────────────────

export type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number } | null;
  geometry?: ({ lat: number; lon: number } | null)[];
  tags?: Record<string, string>;
};

async function runOverpass(query: string): Promise<OverpassElement[] | null> {
  for (const endpoint of ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), OVERPASS_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Sparki/1.0 (cycling training app)",
            Accept: "application/json",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: OverpassElement[] };
      return Array.isArray(json.elements) ? json.elements : [];
    } catch {
      // volgende mirror
    }
  }
  return null;
}

/**
 * Kandidaatpunten van een Overpass-element (node: 1 punt; way: geknipte
 * geometrie; fallback: center). Overpass kan null-gaten in de geometrie van
 * ways/relations teruggeven (ontbrekende nodes buiten de bbox) — die worden
 * eerlijk overgeslagen in plaats van te crashen.
 */
export function extractElementPoints(el: OverpassElement): RoutePathPoint[] {
  if (el.lat != null && el.lon != null) return [[el.lat, el.lon]];
  if (el.geometry && el.geometry.length > 0) {
    const g = el.geometry
      .filter(
        (p): p is { lat: number; lon: number } =>
          p != null && typeof p.lat === "number" && typeof p.lon === "number",
      )
      .map((p) => [p.lat, p.lon] as RoutePathPoint);
    return g.length > 40 ? samplePath(g, 40) : g;
  }
  if (el.center && typeof el.center.lat === "number" && typeof el.center.lon === "number")
    return [[el.center.lat, el.center.lon]];
  return [];
}

// ── Kern: opmerkingen langs een geometrie ───────────────────────────────────

/**
 * Echte routeopmerkingen binnen ~30 m van de routelijn (natuurgebied ~60 m),
 * met km-positie. `null` bij een upstream-fout (eerlijk gat, geen "alles ok").
 */
export async function getRouteRemarks(
  geometry: RoutePathPoint[] | null | undefined,
): Promise<RouteRemark[] | null> {
  if (!geometry || geometry.length < 2) return null;

  const cacheKey = samplePath(geometry, 30)
    .map(([la, lo]) => `${la.toFixed(3)},${lo.toFixed(3)}`)
    .join(";");
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [la, lo] of geometry) {
    if (la < minLat) minLat = la;
    if (la > maxLat) maxLat = la;
    if (lo < minLon) minLon = lo;
    if (lo > maxLon) maxLon = lo;
  }
  // Zeer grote gebieden: eerlijk overslaan i.p.v. een halve provincie ophalen.
  if (maxLat - minLat > 1 || maxLon - minLon > 1.5) return null;
  const pad = 0.001; // ~100 m
  const s = (minLat - pad).toFixed(4);
  const w = (minLon - pad).toFixed(4);
  const n = (maxLat + pad).toFixed(4);
  const e = (maxLon + pad).toFixed(4);
  const bbox = `${s},${w},${n},${e}`;

  // Compacte unies (uitgeschreven vorm geeft 504 op stadsgrote bboxes).
  // `out geom(...)` knipt weg-geometrie op de bbox zodat enorme polygonen
  // (natuurgebieden) behapbaar blijven.
  const query = `[out:json][timeout:25];(
way["route"="ferry"](${bbox});
way["highway"="steps"](${bbox});
node["barrier"~"^(gate|lift_gate|swing_gate|cycle_barrier|stile|kissing_gate|turnstile|block)$"](${bbox});
node["ford"~"^(yes|stream)$"](${bbox});
way["highway"]["ford"~"^(yes|stream)$"](${bbox});
way["highway"]["bicycle"~"^(no|private)$"](${bbox});
way["highway"]["access"~"^(no|private)$"](${bbox});
way["highway"]["surface"~"^(unpaved|gravel|fine_gravel|dirt|ground|grass|sand|mud|compacted|pebblestone|earth|woodchips|cobblestone|sett|unhewn_cobblestone)$"](${bbox});
way["highway"]["smoothness"~"^(bad|very_bad|horrible|very_horrible|impassable)$"](${bbox});
way["leisure"="nature_reserve"](${bbox});
way["boundary"~"^(protected_area|national_park)$"](${bbox});
);out geom(${bbox}) 1200;`;

  const elements = await runOverpass(query);
  if (elements === null) return null;

  // Cumulatieve km langs de volledige geometrie voor km-posities.
  const cumKm: number[] = [0];
  for (let i = 1; i < geometry.length; i++) {
    cumKm.push(cumKm[i - 1]! + haversineM(geometry[i - 1]!, geometry[i]!) / 1000);
  }
  // Afstandsvergelijking op een bemonsterde route (rekentijd), km-positie
  // daarna op het echte dichtstbijzijnde routepunt.
  const routeSampleIdx: number[] = [];
  {
    const maxSamples = 300;
    const step = Math.max(1, Math.floor(geometry.length / maxSamples));
    for (let i = 0; i < geometry.length; i += step) routeSampleIdx.push(i);
    if (routeSampleIdx[routeSampleIdx.length - 1] !== geometry.length - 1)
      routeSampleIdx.push(geometry.length - 1);
  }

  type Raw = RouteRemark & { _kmEnd: number; _count: number };
  const raws: Raw[] = [];
  for (const el of elements) {
    const cls = classifyRemarkTags(el.tags ?? {});
    if (!cls) continue;

    // Kandidaatpunten van het element (node: 1 punt; way: geknipte geometrie).
    const pts = extractElementPoints(el);
    if (pts.length === 0) continue;

    const isAccess = cls.kind === "beperkte_toegang";
    const isSurface = cls.kind === "onverhard" || cls.kind === "slecht_wegdek";
    const needsRefine = isAccess || isSurface;
    const nearLimit =
      cls.kind === "natuurgebied"
        ? NEAR_AREA_M
        : isAccess
          ? NEAR_ACCESS_M
          : isSurface
            ? NEAR_SURFACE_M
            : NEAR_ROUTE_M;
    // Grofmazige poort op de bemonsterde route; voor toegangsbeperkingen
    // daarna verfijnen op de VOLLEDIGE geometrie rond het dichtstbijzijnde
    // sample (samples liggen op lange routes honderden meters uit elkaar —
    // zonder verfijning zou een strakke 12 m-grens echte treffers missen).
    const coarseLimit = needsRefine ? Math.max(nearLimit, 250) : nearLimit;
    const sampleStep = routeSampleIdx.length > 1
      ? routeSampleIdx[1]! - routeSampleIdx[0]!
      : 1;
    let minKmIdx = -1;
    let maxKmIdx = -1;
    let bestM = Number.POSITIVE_INFINITY;
    let bestPt: RoutePathPoint | null = null;
    let nearPts = 0;
    for (const p of pts) {
      let nearestIdx = 0;
      let nearestM = Number.POSITIVE_INFINITY;
      for (const ri of routeSampleIdx) {
        const d = haversineM(p, geometry[ri]!);
        if (d < nearestM) {
          nearestM = d;
          nearestIdx = ri;
        }
      }
      if (nearestM > coarseLimit) continue;
      if (needsRefine) {
        // Verfijn: echte minimale afstand tot de routelijnpunten rond het
        // gevonden sample.
        const lo = Math.max(0, nearestIdx - sampleStep);
        const hi = Math.min(geometry.length - 1, nearestIdx + sampleStep);
        for (let gi = lo; gi <= hi; gi++) {
          const d = haversineM(p, geometry[gi]!);
          if (d < nearestM) {
            nearestM = d;
            nearestIdx = gi;
          }
        }
        if (nearestM > nearLimit) continue;
      }
      nearPts++;
      if (minKmIdx < 0 || nearestIdx < minKmIdx) minKmIdx = nearestIdx;
      if (nearestIdx > maxKmIdx) maxKmIdx = nearestIdx;
      if (nearestM < bestM) {
        bestM = nearestM;
        bestPt = p;
      }
    }
    if (minKmIdx < 0 || !bestPt) continue;
    // Een weg met toegangsbeperking die de route alleen KRUIST (viaduct,
    // zijweg, oprit) raakt de lijn in hooguit één punt — dat is geen wegvak
    // dat je rijdt. Eis minimaal twee nabije punten voor wegen met meerdere
    // geometriepunten, zodat alleen echt meegereden wegvakken overblijven.
    if (needsRefine && pts.length > 1 && nearPts < 2) continue;

    const fromKm = Math.round(cumKm[minKmIdx]! * 10) / 10;
    const toKm = Math.round(cumKm[maxKmIdx]! * 10) / 10;
    raws.push({
      id: `${el.type}/${el.id}`,
      kind: cls.kind,
      label: cls.label,
      detail: cls.detail,
      lat: bestPt[0],
      lon: bestPt[1],
      routeKm: fromKm,
      endKm: toKm - fromKm >= 0.2 ? toKm : null,
      offRouteM: Math.round(bestM),
      uncertain: cls.uncertain,
      evidence: cls.evidence,
      _kmEnd: toKm,
      _count: 1,
    });
  }

  // Parallel-fietspad-controle: in Nederland betekent bicycle=no op de
  // rijbaan vrijwel altijd "er ligt een apart fietspad naast" — de route rijdt
  // dan legaal op dat fietspad, niet op de gemelde weg. Controleer per
  // toegangs-kandidaat (dat zijn er hooguit een paar) of er binnen 25 m een
  // voor fietsers toegankelijk fietspad/pad ligt; zo ja, dan vervalt de
  // melding. Mislukt deze extra controle, dan blijven de meldingen staan —
  // liever een mogelijk overbodige waarschuwing dan een verzwegen verbod.
  const accessRaws = raws.filter((r) => r.kind === "beperkte_toegang");
  if (accessRaws.length > 0) {
    const around = accessRaws
      .map(
        (r) =>
          `way["highway"~"^(cycleway|path)$"](around:35,${r.lat.toFixed(6)},${r.lon.toFixed(6)});` +
          `way["highway"]["cycleway"~"^(track|lane)$"](around:35,${r.lat.toFixed(6)},${r.lon.toFixed(6)});` +
          `way["highway"]["cycleway:both"~"^(track|lane)$"](around:35,${r.lat.toFixed(6)},${r.lon.toFixed(6)});` +
          `way["highway"="footway"]["bicycle"~"^(yes|designated)$"](around:35,${r.lat.toFixed(6)},${r.lon.toFixed(6)});`,
      )
      .join("\n");
    const cycleEls = await runOverpass(
      `[out:json][timeout:25];(\n${around}\n);out geom 200;`,
    );
    if (cycleEls) {
      const cyclePts: RoutePathPoint[] = [];
      for (const el of cycleEls) {
        const b = el.tags?.bicycle ?? "";
        if (b === "no" || b === "private") continue;
        cyclePts.push(...extractElementPoints(el));
      }
      const hasParallelPath = (r: Raw) =>
        cyclePts.some((p) => haversineM(p, [r.lat, r.lon]) <= 35);
      for (let i = raws.length - 1; i >= 0; i--) {
        const r = raws[i]!;
        if (r.kind === "beperkte_toegang" && hasParallelPath(r)) {
          raws.splice(i, 1);
        }
      }
    } else {
      // Controle niet uitvoerbaar (Overpass-storing): dan weten we niet of er
      // een parallel fietspad ligt. Meld de beperking als indicatie in plaats
      // van als feit — nooit met zekerheid "hier mag je niet fietsen" roepen
      // terwijl de renner waarschijnlijk gewoon op het fietspad ernaast rijdt.
      for (const r of raws) {
        if (r.kind === "beperkte_toegang" && !r.uncertain) {
          r.uncertain = true;
          r.detail = r.detail
            ? `${r.detail} Mogelijk ligt hier een apart fietspad naast de weg.`
            : "Mogelijk ligt hier een apart fietspad naast de weg.";
        }
      }
    }
  }

  // Merge: opeenvolgende wegvakken van dezelfde soort binnen 0,3 km worden één
  // opmerking met een km-bereik (anders 30 losse "onverhard"-regels).
  raws.sort((a, b) =>
    a.kind === b.kind ? a.routeKm - b.routeKm : a.kind < b.kind ? -1 : 1,
  );
  const merged: Raw[] = [];
  for (const r of raws) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.kind === r.kind &&
      r.kind !== "veerpont" &&
      r.kind !== "poort" &&
      r.routeKm - prev._kmEnd <= 0.3
    ) {
      prev._kmEnd = Math.max(prev._kmEnd, r._kmEnd);
      prev.endKm = prev._kmEnd - prev.routeKm >= 0.2 ? prev._kmEnd : prev.endKm;
      prev.offRouteM = Math.min(prev.offRouteM, r.offRouteM);
      prev.uncertain = prev.uncertain || r.uncertain;
      continue;
    }
    // Poorten/paaltjes staan vaak in rijtjes (5 blokken naast elkaar) of aan
    // weerszijden van een kruising. Dat zijn echte losse OSM-nodes, maar voor
    // de renner is het ÉÉN doorgang: bundel dezelfde soort binnen 150 m tot
    // één opmerking met een aantal — geen vijf identieke regels op één km.
    if (
      prev &&
      r.kind === "poort" &&
      prev.kind === "poort" &&
      prev.label.replace(/ \(×\d+\)$/, "") === r.label &&
      r.routeKm - prev.routeKm <= 0.15
    ) {
      prev._count += 1;
      prev.label = `${r.label} (×${prev._count})`;
      prev.offRouteM = Math.min(prev.offRouteM, r.offRouteM);
      continue;
    }
    merged.push({ ...r });
  }

  const out: RouteRemark[] = merged
    .map(({ _kmEnd: _ignored, _count: _ignored2, ...rest }) => rest)
    .sort((a, b) => a.routeKm - b.routeKm)
    .slice(0, 60);

  CACHE.set(cacheKey, { at: Date.now(), data: out });
  return out;
}

/**
 * Deterministische opmerkingen over de routegegevens zélf (geen Overpass):
 * ontbrekende hoogte- of afstandsgegevens worden eerlijk benoemd.
 */
export function computeDataRemarks(opts: {
  hasProfile: boolean;
  hasDistance: boolean;
  pointCount: number;
}): { label: string; detail: string }[] {
  const out: { label: string; detail: string }[] = [];
  if (!opts.hasProfile) {
    out.push({
      label: "Geen hoogtegegevens",
      detail:
        "Voor deze route zijn geen hoogtepunten opgeslagen; hoogteprofiel en hellingen kunnen niet worden getoond.",
    });
  }
  if (!opts.hasDistance) {
    out.push({
      label: "Afstand onbekend",
      detail:
        "De routeafstand ontbreekt; km-posities van opmerkingen kunnen niet worden berekend.",
    });
  }
  if (opts.pointCount > 0 && opts.pointCount < 20) {
    out.push({
      label: "Weinig routepunten",
      detail:
        "Deze route heeft erg weinig kaartpunten; posities langs de route zijn daardoor minder nauwkeurig.",
    });
  }
  return out;
}

export function remarksSource(): RouteRemarksResult["source"] {
  return { ...SOURCE };
}
