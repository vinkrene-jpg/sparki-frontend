// Wegtypen & ondergrond: analyse van de volledige route uit ECHTE
// OpenStreetMap-tags (surface/highway/tracktype), plus een deterministische
// geschiktheidsinschatting per fietstype.
//
// Bron: OpenStreetMap via de Overpass API (zelfde mirror-keten en
// bbox-aanpak als route-remarks). Elke categorie komt rechtstreeks uit
// aantoonbare tags; als de ondergrond niet betrouwbaar vastgesteld kan
// worden is de categorie "onbekend" — er wordt NOOIT een wegtype verzonnen.
//
// Honesty contract: bij een upstream-fout is het antwoord null (eerlijk gat),
// nooit een verdeling die "alles bekend" suggereert.

import type { RoutePathPoint } from "@workspace/db";
import { samplePath } from "./route-insight";
import type { OverpassElement } from "./route-remarks";

export type SurfaceKind =
  | "asfalt"
  | "verhard_fietspad"
  | "klinkers"
  | "kasseien"
  | "compact_gravel"
  | "los_gravel"
  | "onverhard"
  | "bospad"
  | "singletrack"
  | "onbekend";

export const SURFACE_LABELS: Record<SurfaceKind, string> = {
  asfalt: "Asfalt",
  verhard_fietspad: "Verhard fietspad",
  klinkers: "Klinkers",
  kasseien: "Kasseien",
  compact_gravel: "Compact gravel",
  los_gravel: "Los gravel",
  onverhard: "Onverhard",
  bospad: "Bospad",
  singletrack: "Singletrack",
  onbekend: "Onbekende ondergrond",
};

export type SurfaceSegment = {
  kind: SurfaceKind;
  fromKm: number;
  toKm: number;
  // Indexen in de ROUTE-geometrie (client knipt daar zelf de lijn uit).
  fromIdx: number;
  toIdx: number;
};

export type SurfaceBreakdownEntry = {
  kind: SurfaceKind;
  km: number;
  pct: number; // 0–100, afgerond op 1 decimaal
  // Voorbeeld van de letterlijke tags waarop deze categorie is gebaseerd.
  evidence: string | null;
};

export type RouteSurfacesAnalysis = {
  totalKm: number;
  breakdown: SurfaceBreakdownEntry[]; // alleen categorieën die voorkomen, aflopend op km
  segments: SurfaceSegment[];
  // Kilometers met een bekende toegangsbeperking (bicycle=no/private).
  restrictedKm: number;
};

// ── Tag → categorie (deterministisch, alleen aantoonbare tags) ──────────────

const ASPHALT = new Set(["asphalt", "paved", "concrete", "concrete:plates", "concrete:lanes", "chipseal"]);
const KLINKERS = new Set(["paving_stones", "bricks", "paving_stones:30"]);
const KASSEIEN = new Set(["cobblestone", "unhewn_cobblestone", "sett"]);
const COMPACT = new Set(["compacted", "fine_gravel"]);
const LOS = new Set(["gravel", "pebblestone", "rock", "shells"]);
const ONVERHARD = new Set(["unpaved", "dirt", "ground", "earth", "grass", "mud", "sand", "woodchips", "grass_paver"]);
const PATHISH = new Set(["path", "footway", "bridleway"]);
const ROADISH = new Set([
  "motorway", "trunk", "primary", "secondary", "tertiary", "unclassified",
  "residential", "living_street", "service", "road",
  "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link",
]);

/**
 * Classificatie van één OSM-weg naar een ondergrond-categorie, uitsluitend op
 * aantoonbare tags. `null` = geen (bruikbare) weg. "onbekend" = wel een weg,
 * maar de ondergrond is niet betrouwbaar getagd.
 */
export function classifySurfaceTags(
  tags: Record<string, string>,
): { kind: SurfaceKind; evidence: string } | null {
  const hw = tags.highway;
  if (!hw) return null;
  const surface = (tags.surface ?? "").split(";")[0]!.trim();
  const tracktype = tags.tracktype ?? "";

  // Singletrack: een pad met expliciete mtb-tagging.
  if (PATHISH.has(hw) && (tags["mtb:scale"] != null || tags.singletrack === "yes")) {
    return {
      kind: "singletrack",
      evidence: `highway=${hw}` + (tags["mtb:scale"] != null ? ` + mtb:scale=${tags["mtb:scale"]}` : " + singletrack=yes"),
    };
  }

  // Expliciete ondergrond wint altijd.
  if (surface) {
    if (KASSEIEN.has(surface)) return { kind: "kasseien", evidence: `surface=${surface}` };
    if (KLINKERS.has(surface)) return { kind: "klinkers", evidence: `surface=${surface}` };
    if (COMPACT.has(surface)) return { kind: "compact_gravel", evidence: `surface=${surface}` };
    if (LOS.has(surface)) return { kind: "los_gravel", evidence: `surface=${surface}` };
    if (ONVERHARD.has(surface)) {
      // Onverhard pad in bosrijke context = bospad; anders onverhard.
      if (PATHISH.has(hw)) return { kind: "bospad", evidence: `highway=${hw} + surface=${surface}` };
      return { kind: "onverhard", evidence: `surface=${surface}` };
    }
    if (ASPHALT.has(surface)) {
      if (hw === "cycleway") return { kind: "verhard_fietspad", evidence: `highway=cycleway + surface=${surface}` };
      return { kind: "asfalt", evidence: `surface=${surface}` };
    }
    // Onherkenbare surface-waarde: eerlijk onbekend.
    return { kind: "onbekend", evidence: `surface=${surface} (niet herkend)` };
  }

  // Geen surface-tag: alleen afleiden wat aantoonbaar is.
  if (tracktype) {
    if (tracktype === "grade1") return { kind: "asfalt", evidence: "tracktype=grade1" };
    if (tracktype === "grade2") return { kind: "compact_gravel", evidence: "tracktype=grade2" };
    if (tracktype === "grade3") return { kind: "los_gravel", evidence: "tracktype=grade3" };
    if (tracktype === "grade4" || tracktype === "grade5")
      return { kind: "onverhard", evidence: `tracktype=${tracktype}` };
  }
  if (hw === "track") return { kind: "onbekend", evidence: "highway=track zonder surface/tracktype" };
  // Een pad zonder surface-tag kan net zo goed een stedelijk voetpad als een
  // bospad zijn — dat raden we niet: eerlijk onbekend.
  if (PATHISH.has(hw)) return { kind: "onbekend", evidence: `highway=${hw} zonder surface-tag` };
  if (hw === "cycleway")
    // Padtype is zeker (fietspad), de ondergrond zelf is niet getagd — dat
    // benoemen we in de evidence, maar we verzinnen geen asfalt.
    return { kind: "onbekend", evidence: "highway=cycleway zonder surface-tag" };
  if (ROADISH.has(hw)) return { kind: "onbekend", evidence: `highway=${hw} zonder surface-tag` };
  return null;
}

// ── Pure aggregatie (testbaar zonder netwerk) ───────────────────────────────

const NEAR_WAY_M = 25;
const MAX_SAMPLES = 600;

// Volledige weggeometrie (géén downsampling zoals bij remarks — voor matching
// op 25 m moeten alle tussenpunten meedoen); null-punten eerlijk overgeslagen.
function wayPoints(el: OverpassElement): RoutePathPoint[] {
  if (!el.geometry || el.geometry.length === 0) return [];
  return el.geometry
    .filter(
      (p): p is { lat: number; lon: number } =>
        p != null && typeof p.lat === "number" && typeof p.lon === "number",
    )
    .map((p) => [p.lat, p.lon] as RoutePathPoint);
}

// Afstand punt → wegvak (punt-naar-segment, vlakke benadering — ruim
// nauwkeurig genoeg op 25 m-schaal).
function pointToPolylineM(p: RoutePathPoint, pts: RoutePathPoint[]): number {
  if (pts.length === 1) return haversineM(p, pts[0]!);
  const cos = Math.cos((p[0] * Math.PI) / 180);
  const px = p[1] * cos;
  const py = p[0];
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1]![1] * cos;
    const ay = pts[i - 1]![0];
    const bx = pts[i]![1] * cos;
    const by = pts[i]![0];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d = haversineM(p, [cy, cx / cos]);
    if (d < best) best = d;
  }
  return best;
}

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

/**
 * Wijs elk (bemonsterd) routepunt toe aan de dichtstbijzijnde geclassificeerde
 * OSM-weg (≤ 25 m) en bouw daaruit de verdeling + aaneengesloten segmenten.
 * Punten zonder match zijn eerlijk "onbekend".
 */
export function aggregateSurfaces(
  geometry: RoutePathPoint[],
  elements: OverpassElement[],
): RouteSurfacesAnalysis {
  // Cumulatieve km per routepunt.
  const cumKm: number[] = [0];
  for (let i = 1; i < geometry.length; i++) {
    cumKm.push(cumKm[i - 1]! + haversineM(geometry[i - 1]!, geometry[i]!) / 1000);
  }
  const totalKm = cumKm[cumKm.length - 1]!;

  // Geclassificeerde wegen met hun volledige (geknipte) geometrie + bbox
  // (snelle voorselectie per routepunt).
  type Way = {
    kind: SurfaceKind;
    evidence: string;
    pts: RoutePathPoint[];
    restricted: boolean;
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  const PAD_DEG = 0.0006; // ≈ 40–65 m marge rond de way-bbox
  const ways: Way[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const cls = classifySurfaceTags(tags);
    if (!cls) continue;
    const pts = wayPoints(el);
    if (pts.length === 0) continue;
    const restricted = tags.bicycle === "no" || tags.bicycle === "private" ||
      ((tags.access === "no" || tags.access === "private") && tags.bicycle !== "yes" && tags.bicycle !== "designated");
    let mnLa = Infinity, mxLa = -Infinity, mnLo = Infinity, mxLo = -Infinity;
    for (const [la, lo] of pts) {
      if (la < mnLa) mnLa = la;
      if (la > mxLa) mxLa = la;
      if (lo < mnLo) mnLo = lo;
      if (lo > mxLo) mxLo = lo;
    }
    ways.push({
      kind: cls.kind,
      evidence: cls.evidence,
      pts,
      restricted,
      minLat: mnLa - PAD_DEG,
      maxLat: mxLa + PAD_DEG,
      minLon: mnLo - PAD_DEG,
      maxLon: mxLo + PAD_DEG,
    });
  }

  // Bemonsterde route-indexen (rekentijd), toewijzing per sample.
  const sampleIdx: number[] = [];
  {
    const step = Math.max(1, Math.floor(geometry.length / MAX_SAMPLES));
    for (let i = 0; i < geometry.length; i += step) sampleIdx.push(i);
    if (sampleIdx[sampleIdx.length - 1] !== geometry.length - 1) sampleIdx.push(geometry.length - 1);
  }

  const kinds: SurfaceKind[] = [];
  const evidences: (string | null)[] = [];
  const restrictedFlags: boolean[] = [];
  for (const gi of sampleIdx) {
    const p = geometry[gi]!;
    let best: Way | null = null;
    let bestM = NEAR_WAY_M;
    for (const w of ways) {
      if (p[0] < w.minLat || p[0] > w.maxLat || p[1] < w.minLon || p[1] > w.maxLon) continue;
      const d = pointToPolylineM(p, w.pts);
      if (d < bestM) {
        bestM = d;
        best = w;
      }
    }
    kinds.push(best ? best.kind : "onbekend");
    evidences.push(best ? best.evidence : null);
    restrictedFlags.push(best ? best.restricted : false);
  }

  // Aaneengesloten segmenten + km-sommen. Elk sample "bezit" de halve afstand
  // naar zijn buren, zodat de km-sommen precies optellen tot totalKm.
  const kmAt = (s: number) => cumKm[sampleIdx[s]!]!;
  const ownedKm = (s: number) => {
    const prev = s === 0 ? kmAt(0) : (kmAt(s - 1) + kmAt(s)) / 2;
    const next = s === kinds.length - 1 ? kmAt(s) : (kmAt(s) + kmAt(s + 1)) / 2;
    return next - prev;
  };

  const kmByKind = new Map<SurfaceKind, number>();
  const evidenceByKind = new Map<SurfaceKind, string>();
  let restrictedKm = 0;
  const segments: SurfaceSegment[] = [];
  let segStart = 0;
  for (let s = 0; s < kinds.length; s++) {
    const k = kinds[s]!;
    kmByKind.set(k, (kmByKind.get(k) ?? 0) + ownedKm(s));
    if (restrictedFlags[s]) restrictedKm += ownedKm(s);
    const ev = evidences[s];
    if (ev && !evidenceByKind.has(k)) evidenceByKind.set(k, ev);
    const isLast = s === kinds.length - 1;
    if (isLast || kinds[s + 1] !== k) {
      segments.push({
        kind: k,
        fromKm: Math.round(kmAt(segStart) * 10) / 10,
        toKm: Math.round(kmAt(s) * 10) / 10,
        fromIdx: sampleIdx[segStart]!,
        toIdx: sampleIdx[s]!,
      });
      segStart = s + 1;
    }
  }

  const breakdown: SurfaceBreakdownEntry[] = [...kmByKind.entries()]
    .map(([kind, km]) => ({
      kind,
      km: Math.round(km * 10) / 10,
      pct: totalKm > 0 ? Math.round((km / totalKm) * 1000) / 10 : 0,
      evidence: evidenceByKind.get(kind) ?? null,
    }))
    .sort((a, b) => b.km - a.km);

  return {
    totalKm: Math.round(totalKm * 10) / 10,
    breakdown,
    segments,
    restrictedKm: Math.round(restrictedKm * 10) / 10,
  };
}

// ── Geschiktheid per fietstype (deterministisch en uitlegbaar) ──────────────

export type BikeType = "racefiets" | "gravelbike" | "mountainbike";
export type SuitabilityVerdict =
  | "goed"
  | "gedeeltelijk"
  | "technisch"
  | "afgeraden"
  | "onvoldoende_gegevens";

export const VERDICT_LABELS: Record<SuitabilityVerdict, string> = {
  goed: "Goed geschikt",
  gedeeltelijk: "Gedeeltelijk geschikt",
  technisch: "Technisch of risicovol",
  afgeraden: "Niet aanbevolen",
  onvoldoende_gegevens: "Onvoldoende gegevens",
};

export type BikeSuitability = {
  bike: BikeType;
  verdict: SuitabilityVerdict;
  // Elke regel die heeft meegewogen, mét de echte getallen — de renner ziet
  // wáárom de route deze beoordeling krijgt.
  reasons: string[];
};

/** Maximale helling (%) over ~gemiddelde segmentlengte, uit het echte profiel. */
export function maxSlopePct(profile: number[], distanceKm: number | null): number | null {
  if (!profile || profile.length < 2 || distanceKm == null || !(distanceKm > 0)) return null;
  const segM = (distanceKm * 1000) / (profile.length - 1);
  if (!(segM > 0)) return null;
  let max = 0;
  for (let i = 1; i < profile.length; i++) {
    const s = Math.abs((profile[i]! - profile[i - 1]!) / segM) * 100;
    if (s > max) max = s;
  }
  return Math.round(max * 10) / 10;
}

export function computeBikeSuitability(
  analysis: RouteSurfacesAnalysis,
  opts: { maxSlopePct: number | null },
): BikeSuitability[] {
  const pct = (k: SurfaceKind) => analysis.breakdown.find((b) => b.kind === k)?.pct ?? 0;
  const unknown = pct("onbekend");
  const kasseien = pct("kasseien");
  const compact = pct("compact_gravel");
  const los = pct("los_gravel");
  const ruw = pct("onverhard") + pct("bospad");
  const single = pct("singletrack");
  const offroad = los + ruw + single;
  const slope = opts.maxSlopePct;

  const out: BikeSuitability[] = [];
  for (const bike of ["racefiets", "gravelbike", "mountainbike"] as BikeType[]) {
    const reasons: string[] = [];
    let verdict: SuitabilityVerdict = "goed";

    if (unknown > 40) {
      out.push({
        bike,
        verdict: "onvoldoende_gegevens",
        reasons: [
          `${unknown}% van de route heeft geen betrouwbaar vastgestelde ondergrond — te weinig gegevens voor een inschatting.`,
        ],
      });
      continue;
    }
    if (unknown > 10)
      reasons.push(`Let op: ${unknown}% van de ondergrond is onbekend; de inschatting geldt voor het bekende deel.`);

    if (analysis.restrictedKm > 0)
      reasons.push(`Op ~${analysis.restrictedKm} km geldt volgens de kaartgegevens een toegangsbeperking voor fietsers.`);

    if (bike === "racefiets") {
      if (offroad > 15) {
        verdict = "afgeraden";
        reasons.push(`${Math.round(offroad * 10) / 10}% los gravel/onverhard/bospad/singletrack — te veel voor een racefiets.`);
      } else if (offroad > 3) {
        verdict = "technisch";
        reasons.push(`${Math.round(offroad * 10) / 10}% los gravel/onverhard/bospad/singletrack — technisch of risicovol met smalle banden.`);
      } else if (kasseien + compact > 10) {
        verdict = "gedeeltelijk";
        reasons.push(`${Math.round((kasseien + compact) * 10) / 10}% kasseien/compact gravel — rijdbaar, maar oncomfortabel op een racefiets.`);
      } else {
        reasons.push("De route is (vrijwel) volledig verhard volgens de kaartgegevens.");
      }
      if (slope != null && slope > 12 && offroad > 0)
        reasons.push(`Steilste stuk ~${slope}% in combinatie met onverharde delen — extra risico met racebanden.`);
    } else if (bike === "gravelbike") {
      if (single > 10) {
        verdict = "technisch";
        reasons.push(`${single}% singletrack — technisch terrein voor een gravelbike.`);
      } else if (single > 0) {
        verdict = "gedeeltelijk";
        reasons.push(`${single}% singletrack — kort technisch stuk.`);
      } else {
        reasons.push("Gravel, onverhard en verhard zijn allemaal goed rijdbaar met een gravelbike.");
      }
    } else {
      // Mountainbike: rijdt technisch alles wat hier voorkomt.
      reasons.push("Alle aangetroffen wegtypen zijn rijdbaar met een mountainbike.");
      const verhard = pct("asfalt") + pct("verhard_fietspad") + pct("klinkers");
      if (verhard > 85) {
        verdict = "gedeeltelijk";
        reasons.push(`${Math.round(verhard * 10) / 10}% verhard — technisch prima, maar een mountainbike biedt hier weinig voordeel.`);
      }
    }

    if (analysis.restrictedKm > 0 && verdict === "goed") verdict = "gedeeltelijk";
    out.push({ bike, verdict, reasons });
  }
  return out;
}

// ── Overpass-ophaal + cache ─────────────────────────────────────────────────

const ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const OVERPASS_TIMEOUT_MS = 25_000;
const CACHE = new Map<string, { at: number; data: RouteSurfacesAnalysis }>();
const CACHE_TTL_MS = 15 * 60_000;

async function runOverpass(query: string): Promise<OverpassElement[] | null> {
  for (const endpoint of ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), OVERPASS_TIMEOUT_MS);
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!resp.ok) continue;
      const json = (await resp.json()) as { elements?: OverpassElement[] };
      if (Array.isArray(json.elements)) return json.elements;
    } catch {
      // volgende mirror
    }
  }
  return null;
}

/**
 * Volledige wegtypen-analyse van een route. `null` bij een upstream-fout
 * (eerlijk gat) of onbruikbare geometrie.
 */
export async function getRouteSurfaces(
  geometry: RoutePathPoint[] | null | undefined,
): Promise<RouteSurfacesAnalysis | null> {
  if (!geometry || geometry.length < 2) return null;

  const cacheKey = samplePath(geometry, 30)
    .map(([la, lo]) => `${la.toFixed(3)},${lo.toFixed(3)}`)
    .join(";");
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const [la, lo] of geometry) {
    if (la < minLat) minLat = la;
    if (la > maxLat) maxLat = la;
    if (lo < minLon) minLon = lo;
    if (lo > maxLon) maxLon = lo;
  }
  if (maxLat - minLat > 1 || maxLon - minLon > 1.5) return null;
  const pad = 0.001;
  const bbox = `${(minLat - pad).toFixed(4)},${(minLon - pad).toFixed(4)},${(maxLat + pad).toFixed(4)},${(maxLon + pad).toFixed(4)}`;

  const query = `[out:json][timeout:25];(
way["highway"](${bbox});
);out geom(${bbox}) 4000;`;

  const elements = await runOverpass(query);
  if (elements === null) return null;

  const analysis = aggregateSurfaces(geometry, elements);
  CACHE.set(cacheKey, { at: Date.now(), data: analysis });
  if (CACHE.size > 200) {
    const oldest = [...CACHE.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) CACHE.delete(oldest[0]);
  }
  return analysis;
}

export function surfacesSource() {
  return {
    name: "OpenStreetMap (via Overpass API)",
    license: "ODbL 1.0 — © OpenStreetMap-bijdragers",
    url: "https://www.openstreetmap.org/copyright",
    note: "Kaartgegevens kunnen verouderd of onvolledig zijn; controleer ter plekke.",
  } as const;
}
