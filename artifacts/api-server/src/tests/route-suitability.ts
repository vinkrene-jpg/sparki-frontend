// Acceptatietest routebelofte tegen RENÉ's bindende acceptatiegrenzen
// (PO-01 §Acceptatiegrenzen 30-07-2026, doctrine art. 10; taak #436):
//
//  1. Racefiets: 0% aantoonbaar onverhard. Elke gemeten onverharde meter
//     (routebron ÉN onafhankelijke OSM-opmerkingenlaag) = afkeur.
//  2. Fietsverbod = afkeur. Eén zéker (niet-indicatie) verboden wegvak op
//     welke route dan ook = afkeur — racefiets én gravel.
//  3. Onbekend wegdek is een risico: het onbekende aandeel wordt per route
//     eerlijk gemeten en vastgelegd (generatie mijdt het actief via het
//     custom model; structureel verkleinen loopt via BGT, taak #428).
//
// Dekking: ≥5 startpunten over stad / platteland / Twente / heuvels,
// racefiets (cycling-road) én gravel (cycling-regular). Dit harnas draait
// tegen de ECHTE GraphHopper-motor + het echte selectiepad
// (generateVariedLoop) en meet daarna onafhankelijk na met de
// OpenStreetMap-opmerkingenlaag (dezelfde laag die de renner op het
// routescherm ziet).
//
// Live test (kost GraphHopper-quota + Overpass-calls): bewust géén onderdeel
// van elke merge-validatie; draai hem bij route-wijzigingen en voor proofs:
//   pnpm --filter @workspace/api-server run test:route-suitability
import { GraphHopperProvider } from "../lib/routing/providers/graphhopper";
import {
  generateVariedLoop,
  pathOverlapFraction,
} from "../lib/routing/loop-quality";
import { getRouteRemarks } from "../lib/route-remarks";
import type { RouteRemark } from "../lib/route-remarks";
import * as fs from "node:fs";
import * as path from "node:path";

// Overpass is best-effort en kan tijdelijk uitvallen; de proof mag daar niet
// willekeurig op stranden. Per route maximaal 3 pogingen met pauze — pas als
// het dan nog niet lukt telt de route eerlijk als "niet meetbaar".
async function remarksWithRetry(
  geometry: [number, number][],
): Promise<RouteRemark[] | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const remarks = await getRouteRemarks(geometry);
    if (remarks !== null) return remarks;
    if (attempt < 3) {
      console.log(`   (opmerkingenlaag poging ${attempt} mislukt — 20 s wachten)`);
      await new Promise((r) => setTimeout(r, 20_000));
    }
  }
  return null;
}

// ≥5 startpunten over de gevraagde terreintypen (taak #436): stad,
// platteland, Twente en heuvels. Hengelo = René's eigen regio (hertest
// 30-07-2026) — de praktijktest hoort in het harnas.
const STARTS = [
  { name: "Hengelo (Ov) — Twente", terrain: "twente", lat: 52.266, lon: 6.793 },
  { name: "Utrecht — stad", terrain: "stad", lat: 52.09, lon: 5.12 },
  { name: "Eindhoven — stad", terrain: "stad", lat: 51.44, lon: 5.47 },
  { name: "Baambrugge — platteland (polder)", terrain: "platteland", lat: 52.246, lon: 4.989 },
  { name: "Dalfsen — platteland (Salland)", terrain: "platteland", lat: 52.512, lon: 6.259 },
  { name: "Maastricht — heuvels", terrain: "heuvels", lat: 50.85, lon: 5.69 },
];

// Profielen onder de belofte: racefiets is de strengste grens (0% onverhard);
// gravel deelt de verbods- en eerlijkheidsgrens maar mag onverhard.
const ALL_PROFILES = [
  { label: "racefiets", profile: "cycling-road" as const },
  { label: "gravel", profile: "cycling-regular" as const },
];
// Deelruns (sandbox-shellcalls hebben een tijdslimiet): SUIT_PROFILE=racefiets|gravel
// en SUIT_STARTS=0,1,2 beperken de run; het bewijsbestand vermeldt de selectie.
const PROFILES = process.env.SUIT_PROFILE
  ? ALL_PROFILES.filter((p) => p.label === process.env.SUIT_PROFILE)
  : ALL_PROFILES;
const START_FILTER = process.env.SUIT_STARTS
  ? new Set(process.env.SUIT_STARTS.split(",").map((s) => Number(s.trim())))
  : null;

// Minimaal meetbare routes per profiel — zonder onafhankelijke meting is er
// geen uitspraak en dus geen bewijs.
const MIN_MEASURED_PER_PROFILE = 4;

async function main() {
  const gh = new GraphHopperProvider();
  if (!gh.isConfigured()) {
    console.error("FAIL: GRAPHHOPPER_API_KEY ontbreekt — belofte niet toetsbaar.");
    process.exit(1);
  }
  const failures: string[] = [];
  const evidence: Record<string, unknown>[] = [];
  const measuredPerProfile: Record<string, number> = {};

  for (const p of PROFILES) {
    for (const [i, s] of STARTS.entries()) {
      if (START_FILTER && !START_FILTER.has(i)) continue;
      const label = `${s.name} × ${p.label}`;
      let loop;
      try {
        loop = await generateVariedLoop(gh, {
          start: { lat: s.lat, lon: s.lon },
          distanceKm: 50,
          profile: p.profile,
          seed: 100 + i,
        });
      } catch (err) {
        // Eerlijk vastleggen: geen route is géén stil succes, maar het is ook
        // geen grensoverschrijding — de renner krijgt dan "geen geschikte
        // route gevonden" in plaats van een ongeschikte route.
        console.log(`${label}: geen route (${err instanceof Error ? err.message : err})`);
        evidence.push({ start: s.name, terrain: s.terrain, bike: p.label, generated: false });
        failures.push(`${label}: generatie faalde — belofte hier niet leverbaar`);
        continue;
      }

      // Grens 1 (bron zelf): racefiets 0% aantoonbaar onverhard volgens de
      // routebron. pavedFraction is aandeel-van-gemeten; < 1.0 betekent dat de
      // bron zelf onverharde meters rapporteert.
      if (p.profile === "cycling-road" && loop.pavedFraction != null && loop.pavedFraction < 0.9995) {
        failures.push(
          `${label}: routebron meet ${(100 * (1 - loop.pavedFraction)).toFixed(1)}% onverhard van het gemeten wegdek (grens: 0%)`,
        );
      }

      const remarks = await remarksWithRetry(loop.path);
      const unknownShare =
        loop.surfaceKnownFraction != null ? 1 - loop.surfaceKnownFraction : null;
      if (remarks === null) {
        console.log(`${label}: opmerkingenlaag niet beschikbaar — telt niet mee als gemeten`);
        evidence.push({
          start: s.name, terrain: s.terrain, bike: p.label, generated: true,
          measurable: false,
          pavedFraction: loop.pavedFraction ?? null,
          surfaceUnknownShare: unknownShare,
        });
        continue;
      }
      measuredPerProfile[p.label] = (measuredPerProfile[p.label] ?? 0) + 1;

      const forbidden = remarks.filter(
        (r) => r.kind === "beperkte_toegang" && !r.uncertain,
      );
      const unpaved = remarks.filter(
        (r) => r.kind === "onverhard" || r.kind === "slecht_wegdek",
      );

      // Grens 2: fietsverbod = afkeur, op ELKE route (racefiets én gravel).
      if (forbidden.length > 0) {
        failures.push(
          `${label}: ${forbidden.length} zéker verboden wegvak(ken) — verbod = afkeur`,
        );
      }
      // Grens 1 (onafhankelijk): racefiets 0 aantoonbaar onverharde vakken.
      if (p.profile === "cycling-road" && unpaved.length > 0) {
        failures.push(
          `${label}: ${unpaved.length} onafhankelijk gemeten onverhard/ruw wegvak(ken) — grens is nul`,
        );
      }

      evidence.push({
        start: s.name,
        terrain: s.terrain,
        bike: p.label,
        generated: true,
        measurable: true,
        distanceKm: loop.distanceKm,
        ascentM: loop.ascentM,
        pavedFraction: loop.pavedFraction ?? null,
        // Grens 3: onbekend wegdek eerlijk vastgelegd per route.
        surfaceUnknownShare: unknownShare,
        certainForbidden: forbidden.map((r) => ({ id: r.id, km: r.routeKm, evidence: r.evidence, offRouteM: r.offRouteM })),
        unpaved: unpaved.map((r) => ({ id: r.id, km: r.routeKm, evidence: r.evidence, offRouteM: r.offRouteM })),
      });
      console.log(
        `${label}: ${loop.distanceKm} km, ${loop.ascentM} hm, overlap ${pathOverlapFraction(loop.path).toFixed(3)}, verhard ${loop.pavedFraction == null ? "onbekend" : (100 * loop.pavedFraction).toFixed(1) + "% van gemeten"}, onbekend wegdek ${unknownShare == null ? "?" : Math.round(unknownShare * 100) + "%"} — zeker-verboden: ${forbidden.length}, onverhard/ruw: ${unpaved.length}`,
      );
      for (const r of [...forbidden, ...unpaved]) {
        console.log(
          `   ! ${r.kind} km ${r.routeKm} [${r.evidence}] ${r.id} off=${r.offRouteM}m`,
        );
      }
    }
  }

  const startsInRun = START_FILTER
    ? STARTS.filter((_, i) => START_FILTER.has(i)).length
    : STARTS.length;
  for (const p of PROFILES) {
    const m = measuredPerProfile[p.label] ?? 0;
    // Bij een deelrun schaalt de dekkingseis eerlijk mee (volledige dekking
    // wordt over de gecombineerde bewijsbestanden beoordeeld).
    if (m < Math.min(MIN_MEASURED_PER_PROFILE, startsInRun)) {
      failures.push(
        `${p.label}: slechts ${m}/${STARTS.length} routes onafhankelijk meetbaar (minimaal ${MIN_MEASURED_PER_PROFILE}) — onvoldoende dekking voor een uitspraak`,
      );
    }
  }

  console.log(
    `TOTAAL: gemeten per profiel ${JSON.stringify(measuredPerProfile)}, afkeurpunten=${failures.length}`,
  );
  // Tijdgestempeld bewijs: elke run wordt vastgelegd zodat "objectief waar"
  // nooit op één gunstige run leunt (Product Proof-doctrine).
  try {
    // Draait altijd vanuit artifacts/api-server (pnpm run) → workspace-root/docs.
    const dir = path.resolve(process.cwd(), "../../docs/product/proof-evidence");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(
      path.join(dir, `route-suitability-${stamp}.json`),
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          acceptatiegrenzen: "PO-01 30-07-2026 (0% onverhard racefiets, verbod = afkeur, onbekend eerlijk)",
          verdict: failures.length > 0 ? "FAIL" : "PASS",
          measuredPerProfile,
          failures,
          routes: evidence,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    console.log(`(bewijslog niet weggeschreven: ${err instanceof Error ? err.message : err})`);
  }
  if (failures.length > 0) {
    console.error("route-suitability: FAIL tegen acceptatiegrenzen René");
    for (const f of failures) console.error(` - ${f}`);
    process.exit(1);
  }
  console.log(
    "route-suitability: PASS — 0 aantoonbaar onverhard (racefiets), 0 verboden wegvakken, onbekend aandeel per route vastgelegd",
  );
}

main().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
