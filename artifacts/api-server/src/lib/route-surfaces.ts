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
import {
  bgtSource,
  bgtVerdictsForPoints,
  type BgtPointVerdict,
} from "./bgt-verharding";
import {
  grbSource,
  grbVerdictsForPoints,
  type GrbPointVerdict,
} from "./grb-verharding";

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
  // Kilometers met een aantoonbaar fietsverbod (bicycle=no/private) — harde
  // afkeur: zo'n route hoort niet aangeboden te worden (grens René 30-07-2026).
  forbiddenKm: number;
  // Kilometers met een mildere toegangsbeperking (access=no/private zonder
  // fiets-uitzondering) — mogelijk niet openbaar, mogelijk een uitzondering.
  restrictedKm: number;
  // Officiële-kaart-controlelaag (BGT in Nederland, GRB in Vlaanderen):
  // hoeveel OSM-onbekende meetpunten de officiële overheidswegenkaart alsnog
  // een verharding kon geven. null = niet geraadpleegd (buiten NL/Vlaanderen,
  // geen onbekend, of bron faalde). De source draagt de VERPLICHTE
  // bronvermelding (GRB: naamvermelding Digitaal Vlaanderen).
  bgt?: {
    checkedSamples: number; // OSM-onbekende meetpunten die zijn voorgelegd
    resolvedSamples: number; // waarvan de kaart een aantoonbaar oordeel gaf
    source: { name: string; license: string; url: string; note: string };
  } | null;
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

// Per-sample toewijzing: tussenstap zodat een tweede bron (BGT) de
// OSM-onbekende meetpunten alsnog een aantoonbaar oordeel kan geven vóór de
// verdeling wordt opgebouwd.
export type SurfaceSampleAssignment = {
  sampleIdx: number[]; // index in de route-geometrie per meetpunt
  cumKm: number[]; // cumulatieve km per geometriepunt
  kinds: SurfaceKind[];
  evidences: (string | null)[];
  restrictedFlags: boolean[];
  forbiddenFlags: boolean[];
};

/**
 * Wijs elk (bemonsterd) routepunt toe aan de dichtstbijzijnde geclassificeerde
 * OSM-weg (≤ 25 m) en bouw daaruit de verdeling + aaneengesloten segmenten.
 * Punten zonder match zijn eerlijk "onbekend".
 */
export function aggregateSurfaces(
  geometry: RoutePathPoint[],
  elements: OverpassElement[],
): RouteSurfacesAnalysis {
  return buildSurfacesAnalysis(assignSurfaceSamples(geometry, elements));
}

export function assignSurfaceSamples(
  geometry: RoutePathPoint[],
  elements: OverpassElement[],
): SurfaceSampleAssignment {
  // Cumulatieve km per routepunt.
  const cumKm: number[] = [0];
  for (let i = 1; i < geometry.length; i++) {
    cumKm.push(cumKm[i - 1]! + haversineM(geometry[i - 1]!, geometry[i]!) / 1000);
  }

  // Geclassificeerde wegen met hun volledige (geknipte) geometrie + bbox
  // (snelle voorselectie per routepunt).
  type Way = {
    kind: SurfaceKind;
    evidence: string;
    pts: RoutePathPoint[];
    restricted: boolean;
    forbidden: boolean;
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
    // Splitsing (grens René 30-07-2026): een aantoonbaar fietsverbod
    // (bicycle=no/private) is een harde afkeur; een algemene access-beperking
    // zonder fiets-uitzondering is een mildere waarschuwing.
    const forbidden = tags.bicycle === "no" || tags.bicycle === "private";
    const restricted = !forbidden &&
      (tags.access === "no" || tags.access === "private") &&
      tags.bicycle !== "yes" && tags.bicycle !== "designated" && tags.bicycle !== "permissive";
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
      forbidden,
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
  const forbiddenFlags: boolean[] = [];
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
    forbiddenFlags.push(best ? best.forbidden : false);
  }

  return { sampleIdx, cumKm, kinds, evidences, restrictedFlags, forbiddenFlags };
}

export function buildSurfacesAnalysis(
  a: SurfaceSampleAssignment,
): RouteSurfacesAnalysis {
  const { sampleIdx, cumKm, kinds, evidences, restrictedFlags, forbiddenFlags } = a;
  const totalKm = cumKm[cumKm.length - 1]!;

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
  let forbiddenKm = 0;
  const segments: SurfaceSegment[] = [];
  let segStart = 0;
  for (let s = 0; s < kinds.length; s++) {
    const k = kinds[s]!;
    kmByKind.set(k, (kmByKind.get(k) ?? 0) + ownedKm(s));
    if (restrictedFlags[s]) restrictedKm += ownedKm(s);
    if (forbiddenFlags[s]) forbiddenKm += ownedKm(s);
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
    forbiddenKm: Math.round(forbiddenKm * 10) / 10,
    restrictedKm: Math.round(restrictedKm * 10) / 10,
  };
}

// ── BGT-controlelaag (alleen Nederland) ─────────────────────────────────────

/**
 * BGT-oordeel → ondergrond-categorie. Deterministisch en aantoonbaar:
 * gesloten verharding = asfalt/beton; open verharding = klinkers/tegels;
 * half verhard ≈ compact gravel; onverhard = onverhard.
 */
export function bgtVerdictToSurface(
  v: BgtPointVerdict,
): { kind: SurfaceKind; evidence: string } {
  const evidence = `BGT: ${v.fysiekVoorkomen} (PDOK, alleen Nederland)`;
  const raw = v.fysiekVoorkomen.trim().toLowerCase();
  if (v.verdict === "onverhard") return { kind: "onverhard", evidence };
  if (v.verdict === "half_verhard") return { kind: "compact_gravel", evidence };
  // verhard: open verharding (klinkers/tegels) apart van gesloten (asfalt).
  if (raw.startsWith("open verharding")) return { kind: "klinkers", evidence };
  return { kind: "asfalt", evidence };
}

/**
 * GRB-oordeel (Vlaanderen) → ondergrond-categorie. Het GRB kent alleen
 * vaste/losse verharding (geen materiaalsoort): vaste verharding = asfalt/
 * klinkers — we tonen asfalt als beste benadering met het letterlijke label
 * als bewijs; losse verharding ≈ compact gravel; aardeweg = onverhard.
 */
export function grbVerdictToSurface(
  v: GrbPointVerdict,
): { kind: SurfaceKind; evidence: string } {
  const evidence =
    `GRB: ${v.lblVerh}` +
    (v.lblMorf ? ` (${v.lblMorf})` : "") +
    ` — Digitaal Vlaanderen, alleen Vlaanderen`;
  if (v.verdict === "onverhard") return { kind: "onverhard", evidence };
  if (v.verdict === "half_verhard") return { kind: "compact_gravel", evidence };
  return { kind: "asfalt", evidence };
}
/**
 * Puur + testbaar: leg de OSM-onbekende meetpunten naast BGT-oordelen en
 * overschrijf alleen die punten. Retourneert hoeveel punten een oordeel kregen.
 */
export function applyBgtToAssignment(
  a: SurfaceSampleAssignment,
  unknownOrdinals: number[],
  verdicts: (BgtPointVerdict | null)[],
): number {
  return applyControlToAssignment(a, unknownOrdinals, verdicts, bgtVerdictToSurface);
}

/** Idem voor GRB-oordelen (Vlaanderen). */
export function applyGrbToAssignment(
  a: SurfaceSampleAssignment,
  unknownOrdinals: number[],
  verdicts: (GrbPointVerdict | null)[],
): number {
  return applyControlToAssignment(a, unknownOrdinals, verdicts, grbVerdictToSurface);
}
export type BikeType = "racefiets" | "gravelbike" | "mountainbike";
export type SuitabilityVerdict =
  | "goed"
  | "gedeeltelijk"
  | "technisch"
  | "afgeraden"
  | "onvoldoende_gegevens"
  // Racefiets-specifiek (afkeurregel René 30-07-2026, taak #487): onbekend
  // wegdek is niet-verifieerbaar en dus géén zachte tolerantie. Zolang een
  // onbekend segment niet geverifieerd is, wordt de route NIET als geschikte
  // racefietsroute aanbevolen — alleen na expliciete keuze van de renner.
  | "niet_geverifieerd";

export const VERDICT_LABELS: Record<SuitabilityVerdict, string> = {
  goed: "Goed geschikt",
  gedeeltelijk: "Gedeeltelijk geschikt",
  technisch: "Technisch of risicovol",
  afgeraden: "Niet aanbevolen",
  onvoldoende_gegevens: "Onvoldoende gegevens",
  niet_geverifieerd: "Niet volledig geverifieerd",
};

// ── Racefiets-verificatie op de motor-wegdekmeting (taak #487) ──────────────
// Puur + testbaar: status van een racefietskandidaat op basis van
// engineSurface.knownPct (0–100). 0% onbekend is de norm; <100% bekend =
// "niet volledig geverifieerd" (nooit als geschikt aanbevelen zonder
// expliciete keuze). Zonder meting kan verificatie niet geclaimd worden.
export type RacefietsVerificationStatus =
  | "geverifieerd"
  | "niet_volledig_geverifieerd"
  | "niet_gemeten";

export function racefietsEngineVerification(
  knownPct: number | null | undefined,
): { status: RacefietsVerificationStatus; onbekendPct: number | null } {
  if (knownPct == null) return { status: "niet_gemeten", onbekendPct: null };
  const onbekend = Math.round((100 - knownPct) * 10) / 10;
  if (onbekend <= 0.05) return { status: "geverifieerd", onbekendPct: 0 };
  return { status: "niet_volledig_geverifieerd", onbekendPct: onbekend };
}

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

    // Splitsing (grens René 30-07-2026): een aantoonbaar fietsverbod is een
    // harde afkeur — zo'n route hoort niet aangeboden te worden. Een algemene
    // access-beperking (privéterrein e.d.) is een mildere waarschuwing.
    if (analysis.forbiddenKm > 0)
      reasons.push(`Op ~${analysis.forbiddenKm} km is fietsen volgens de kaartgegevens niet toegestaan (fietsverbod).`);
    if (analysis.restrictedKm > 0)
      reasons.push(`Op ~${analysis.restrictedKm} km is de weg volgens de kaartgegevens mogelijk niet openbaar toegankelijk (bijv. privéterrein); mogelijk geldt een uitzondering — controleer ter plekke.`);

    if (bike === "racefiets") {
      // Afkeurregel (aanscherping René 30-07-2026, taak #487): onbekend
      // wegdek op de racefiets is niet-verifieerbaar — GEEN zachte
      // tolerantie. Elk niet-geverifieerd aandeel (>0%, na BGT/GRB-
      // aanvulling) betekent: nooit als geschikte racefietsroute aanbevelen;
      // tonen mag alleen na expliciete keuze van de renner. Aantoonbaar
      // slechter (afgeraden/technisch) blijft de zwaardere afkeur.
      if (unknown > 0 && offroad <= 3) {
        out.push({
          bike,
          verdict: "niet_geverifieerd",
          reasons: [
            `${unknown}% van het wegdek is onbekend en dus niet geverifieerd voor de racefiets — deze route wordt niet als geschikt aanbevolen. Je kunt hem alleen met een expliciete eigen keuze gebruiken; de onbekende stukken staan op de kaart.`,
            ...reasons.filter((r) => !r.startsWith("Let op:")),
          ],
        });
        continue;
      }
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
    if (analysis.forbiddenKm > 0) verdict = "afgeraden";
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
// Maximaal aantal ways per Overpass-antwoord. Wordt dit plafond geraakt, dan
// is het antwoord AFGEKAPT: ontbrekende wegen zouden onterecht als "onbekend"
// renderen (oorzaak van de 60,7%-onbekend-meting in Hengelo, Proof #436).
// Afgekapte antwoorden worden daarom nooit als compleet behandeld: eerst een
// kwadrant-splitsing, en lukt dat ook niet, dan een eerlijk gat (null).
export const OVERPASS_OUT_LIMIT = 10_000;
const CACHE = new Map<string, { at: number; data: RouteSurfacesAnalysis }>();
const CACHE_TTL_MS = 15 * 60_000;
// In-flight-samenvoeging: bij trage mirrors (Proof #439: 4–14 s per query)
// haalt een herhaalde preview-poging dezelfde route op terwijl de eerste
// meting nog loopt. Eén lopende meting per cache-key voorkomt dat elke retry
// een verse (even trage) Overpass-ronde start; de retry wacht mee op het
// echte resultaat.
const INFLIGHT = new Map<string, Promise<RouteSurfacesAnalysis | null>>();

type OverpassRun = { elements: OverpassElement[]; truncated: boolean };

/** Detecteer een gedeeltelijk/afgekapt Overpass-antwoord (puur + testbaar). */
export function overpassLooksTruncated(
  elementCount: number,
  remark: string | null | undefined,
): boolean {
  if (elementCount >= OVERPASS_OUT_LIMIT) return true;
  if (typeof remark === "string" && remark.trim()) {
    // Overpass zet bij afbreken (tijd/geheugen) een "remark" in het antwoord
    // en geeft alsnog HTTP 200 met een gedeeltelijke elements-array.
    return /runtime error|timed out|out of memory|load too high/i.test(remark);
  }
  return false;
}

async function runOverpass(query: string): Promise<OverpassRun | null> {
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
      const json = (await resp.json()) as {
        elements?: OverpassElement[];
        remark?: string;
      };
      if (Array.isArray(json.elements)) {
        return {
          elements: json.elements,
          truncated: overpassLooksTruncated(json.elements.length, json.remark),
        };
      }
    } catch {
      // volgende mirror
    }
  }
  return null;
}

function surfacesQuery(bbox: string): string {
  return `[out:json][timeout:25];(
way["highway"](${bbox});
);out geom(${bbox}) ${OVERPASS_OUT_LIMIT};`;
}

/**
 * Haal alle highway-ways in de bbox op, bestand tegen afgekapte antwoorden:
 * bij truncatie wordt de bbox recursief in vier kwadranten opnieuw bevraagd
 * en samengevoegd (dedupliceren op way-id). Een nog-afgekapt kwadrant wordt
 * verder gesplitst tot MAX_SPLIT_DEPTH niveaus (Proof #433: de dichte kern
 * van Hengelo/Borne raakt het plafond ook op kwadrant-niveau). Blijft een
 * deelvraag daarna nóg afgekapt, of faalt er één, dan is het antwoord een
 * eerlijk gat (null) — nooit een gedeeltelijke kaart die als "onbekend
 * wegdek" rendert.
 */
export const MAX_SPLIT_DEPTH = 3;

export async function fetchSurfaceElements(
  minLat: number,
  minLon: number,
  maxLat: number,
  maxLon: number,
): Promise<OverpassElement[] | null> {
  const merged: OverpassElement[] = [];
  const seen = new Set<number>();
  const ok = await collectSurfaceElements(
    minLat, minLon, maxLat, maxLon, 0, merged, seen,
  );
  return ok ? merged : null;
}

async function collectSurfaceElements(
  minLat: number,
  minLon: number,
  maxLat: number,
  maxLon: number,
  depth: number,
  merged: OverpassElement[],
  seen: Set<number>,
): Promise<boolean> {
  const fmt = (a: number, b: number, c: number, d: number) =>
    `${a.toFixed(4)},${b.toFixed(4)},${c.toFixed(4)},${d.toFixed(4)}`;
  const query = surfacesQuery(fmt(minLat, minLon, maxLat, maxLon));
  let run = await runOverpass(query);
  if (run === null) {
    // Recursieve splitsing vuurt meerdere queries kort na elkaar af; mirrors
    // rate-limiten dat soms (429/timeout). Eén beleefde retry na een korte
    // pauze — faalt die óók, dan blijft het een eerlijk gat.
    await new Promise((r) => setTimeout(r, 2_000));
    run = await runOverpass(query);
  }
  if (run === null) return false; // eerlijk gat
  if (!run.truncated) {
    for (const el of run.elements) {
      if (typeof el.id === "number") {
        if (seen.has(el.id)) continue;
        seen.add(el.id);
      }
      merged.push(el);
    }
    return true;
  }
  if (depth >= MAX_SPLIT_DEPTH) return false; // eerlijk gat: nog steeds afgekapt

  const midLat = (minLat + maxLat) / 2;
  const midLon = (minLon + maxLon) / 2;
  const quads: [number, number, number, number][] = [
    [minLat, minLon, midLat, midLon],
    [minLat, midLon, midLat, maxLon],
    [midLat, minLon, maxLat, midLon],
    [midLat, midLon, maxLat, maxLon],
  ];
  for (let i = 0; i < quads.length; i++) {
    if (i > 0) {
      // Korte pauze tussen kwadrant-queries: niet alle mirrors verdragen een
      // burst van opeenvolgende zware queries (429-rate-limits, Proof #433).
      await new Promise((r) => setTimeout(r, 750));
    }
    const [a, b, c, d] = quads[i];
    const ok = await collectSurfaceElements(a, b, c, d, depth + 1, merged, seen);
    if (!ok) return false; // eerlijk gat
  }
  return true;
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

  const running = INFLIGHT.get(cacheKey);
  if (running) return running;
  const measurement = measureRouteSurfaces(geometry, cacheKey).finally(() => {
    INFLIGHT.delete(cacheKey);
  });
  INFLIGHT.set(cacheKey, measurement);
  return measurement;
}

async function measureRouteSurfaces(
  geometry: RoutePathPoint[],
  cacheKey: string,
): Promise<RouteSurfacesAnalysis | null> {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const [la, lo] of geometry) {
    if (la < minLat) minLat = la;
    if (la > maxLat) maxLat = la;
    if (lo < minLon) minLon = lo;
    if (lo > maxLon) maxLon = lo;
  }
  if (maxLat - minLat > 1 || maxLon - minLon > 1.5) return null;
  const pad = 0.001;

  const elements = await fetchSurfaceElements(
    minLat - pad,
    minLon - pad,
    maxLat + pad,
    maxLon + pad,
  );
  if (elements === null) return null;

  const assignment = assignSurfaceSamples(geometry, elements);

  // Officiële-kaart-controlelaag (BGT in Nederland, GRB in Vlaanderen): leg de
  // OSM-onbekende meetpunten naast de officiële overheidswegenkaart. Alleen
  // het eerlijke gat wordt gevuld — OSM-oordelen blijven staan. Faalt de bron
  // of ligt de route buiten beide regio's, dan blijft het gat eerlijk. NB: de
  // regiochecks bepalen zelf of de route in NL resp. Vlaanderen ligt, dus
  // hooguit één laag levert oordelen.
  let bgtMeta: RouteSurfacesAnalysis["bgt"] = null;
  const unknownOrdinals: number[] = [];
  for (let i = 0; i < assignment.kinds.length; i++) {
    if (assignment.kinds[i] === "onbekend") unknownOrdinals.push(i);
  }
  if (unknownOrdinals.length > 0) {
    const unknownPoints = unknownOrdinals.map(
      (ord) => geometry[assignment.sampleIdx[ord]!]!,
    );
    const verdicts = await bgtVerdictsForPoints(unknownPoints, {
      maxTiles: 40,
    }).catch(() => null);
    if (verdicts) {
      const resolved = applyBgtToAssignment(assignment, unknownOrdinals, verdicts);
      bgtMeta = {
        checkedSamples: unknownOrdinals.length,
        resolvedSamples: resolved,
        source: bgtSource(),
      };
    } else {
      // Vlaanderen (GRB Wegsegment, lijngeometrie) — verplichte bronvermelding
      // Digitaal Vlaanderen zit in grbSource().
      const grbVerdicts = await grbVerdictsForPoints(unknownPoints, {
        maxTiles: 40,
      }).catch(() => null);
      if (grbVerdicts) {
        const resolved = applyGrbToAssignment(assignment, unknownOrdinals, grbVerdicts);
        bgtMeta = {
          checkedSamples: unknownOrdinals.length,
          resolvedSamples: resolved,
          source: grbSource(),
        };
      }
    }
  }

  const analysis: RouteSurfacesAnalysis = {
    ...buildSurfacesAnalysis(assignment),
    bgt: bgtMeta,
  };
  CACHE.set(cacheKey, { at: Date.now(), data: analysis });
  if (CACHE.size > 200) {
    const oldest = [...CACHE.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) CACHE.delete(oldest[0]);
  }
  return analysis;
}

// ── Bronvergelijking: routemotor vs. dit scherm (puur + testbaar) ───────────
//
// De routemotor (GraphHopper) meet het wegdek op zijn eigen, vooraf gebouwde
// wegenkaart; dit scherm meet live op actuele OSM-tags + de BGT-controlelaag.
// Twee eerlijke metingen kunnen elkaar dan zichtbaar tegenspreken (Proof #436:
// Hengelo motor 100% verhard vs. scherm 60,7% onbekend; Dalfsen motor 99,9%
// verhard vs. scherm sand/compacted op de lijn). Contract: bij tegenspraak
// wordt dat expliciet uitgelegd — er wordt NOOIT stil één bron gekozen.

export type EngineSurfaceMeasurement = {
  provider: string;
  pavedPct: number | null; // % verhard van het door de motor GEMETEN deel
  knownPct: number | null; // % van de afstand waarvoor de motor wegdek kent
  measuredAt: string;
};

export type SurfaceSourceComparison = {
  engine: EngineSurfaceMeasurement;
  // Samenvatting van wat DIT scherm meet (uit de breakdown).
  scherm: { verhardPct: number; onverhardPct: number; onbekendPct: number };
  oordeel: "consistent" | "tegenspraak";
  // Uitleg per bron + (bij tegenspraak) wat het verschil verklaart en welk
  // beeld de renner moet aanhouden. Altijd gevuld.
  uitleg: string[];
};

const fmtNl = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");

export function compareSurfaceSources(
  engine: EngineSurfaceMeasurement | null | undefined,
  analysis: RouteSurfacesAnalysis,
): SurfaceSourceComparison | null {
  if (!engine || (engine.pavedPct == null && engine.knownPct == null)) return null;
  const pct = (k: SurfaceKind) =>
    analysis.breakdown.find((b) => b.kind === k)?.pct ?? 0;
  const verhardPct =
    pct("asfalt") + pct("verhard_fietspad") + pct("klinkers") + pct("kasseien");
  const onverhardPct =
    pct("compact_gravel") + pct("los_gravel") + pct("onverhard") + pct("bospad") + pct("singletrack");
  const onbekendPct = pct("onbekend");

  const providerLabel =
    engine.provider === "graphhopper" ? "GraphHopper" : engine.provider;
  // Nameting van de backfill (taak #496): die meet op OSM/Overpass + de
  // officiële kaartlaag — dus NIET op een eigen motorkaart. Dat eerlijk
  // benoemen, anders zou de uitleg een motorkaart-meting suggereren.
  const isOsmNameting = engine.provider === "osm_overpass";
  const uitleg: string[] = [
    (isOsmNameting
      ? `Nameting (OpenStreetMap): achteraf gemeten op de opgeslagen routelijn via actuele kaarttags — geen motorkaart. Meting: `
      : `Routemotor (${providerLabel}): rekent op een eigen, vooraf gebouwde wegenkaart die kan achterlopen op OpenStreetMap. Meting bij het genereren: `) +
      (engine.pavedPct != null
        ? `${fmtNl(engine.pavedPct)}% verhard van het gemeten deel`
        : "geen verhard-percentage") +
      (engine.knownPct != null
        ? `; wegdek bekend voor ${fmtNl(engine.knownPct)}% van de afstand.`
        : "."),
    `Dit scherm: meet live op actuele OpenStreetMap-tags` +
      (analysis.bgt
        ? ` plus de officiële overheidswegenkaart (${analysis.bgt.source.name})`
        : "") +
      `. Nu gemeten: ${fmtNl(verhardPct)}% verhard, ${fmtNl(onverhardPct)}% (half)onverhard, ${fmtNl(onbekendPct)}% onbekend.`,
  ];

  // Tegenspraak-detectie:
  // 1) motor "vrijwel volledig verhard" terwijl dit scherm aantoonbaar
  //    (half)onverhard meet (Dalfsen-patroon);
  // 2) motor kent (vrijwel) alles terwijl dit scherm grotendeels onbekend is
  //    (Hengelo-patroon).
  const engineSaysPaved = engine.pavedPct != null && engine.pavedPct >= 95;
  const clash1 = engineSaysPaved && onverhardPct > 5;
  const clash2 =
    engine.knownPct != null && engine.knownPct >= 75 && onbekendPct > 40;

  if (clash1) {
    uitleg.push(
      "De metingen spreken elkaar tegen: de actuele kaart vindt (half)onverharde stukken die de motorkaart niet kent. Sparki kiest niet stil één bron — houd voor het wegdek dít scherm aan: de motorkaart kan verouderd zijn.",
    );
  } else if (clash2) {
    uitleg.push(
      "De metingen spreken elkaar tegen: de motor kent hier meer wegdek dan de actuele kaarttags tonen. Het verschil zit vooral in ontbrekende tags — niet in aantoonbaar onverhard. Sparki kiest niet stil één bron: onbekend blijft eerlijk onbekend, de motor-meting staat er ter context naast.",
    );
  } else {
    uitleg.push("De twee metingen zijn met elkaar in lijn.");
  }

  return {
    engine,
    scherm: {
      verhardPct: Math.round(verhardPct * 10) / 10,
      onverhardPct: Math.round(onverhardPct * 10) / 10,
      onbekendPct: Math.round(onbekendPct * 10) / 10,
    },
    oordeel: clash1 || clash2 ? "tegenspraak" : "consistent",
    uitleg,
  };
}

export function surfacesSource() {
  return {
    name: "OpenStreetMap (via Overpass API)",
    license: "ODbL 1.0 — © OpenStreetMap-bijdragers",
    url: "https://www.openstreetmap.org/copyright",
    note: "Kaartgegevens kunnen verouderd of onvolledig zijn; controleer ter plekke.",
  } as const;
}

function applyControlToAssignment<V>(
  a: SurfaceSampleAssignment,
  unknownOrdinals: number[],
  verdicts: (V | null)[],
  toSurface: (v: V) => { kind: SurfaceKind; evidence: string },
): number {
  let resolved = 0;
  for (let i = 0; i < unknownOrdinals.length; i++) {
    const v = verdicts[i];
    if (!v) continue;
    const ord = unknownOrdinals[i]!;
    if (a.kinds[ord] !== "onbekend") continue; // alleen het eerlijke gat vullen
    const mapped = toSurface(v);
    a.kinds[ord] = mapped.kind;
    a.evidences[ord] = mapped.evidence;
    resolved += 1;
  }
  return resolved;
}
