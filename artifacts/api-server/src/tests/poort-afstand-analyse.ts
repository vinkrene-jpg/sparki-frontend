// Eenmalige analyse: liggen de gemelde poorten van een route ECHT op de
// routelijn, of op zijpaadjes ernaast? Meet per gemeld poort-element de echte
// minimale afstand tot de route-LIJN (segmentprojectie, niet punt-match).
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getRouteRemarks } from "../lib/route-remarks";

type Pt = [number, number];

function segDistM(p: Pt, a: Pt, b: Pt): number {
  // equirectangular lokaal vlak (prima op <1 km schaal)
  const R = 6371000;
  const rad = Math.PI / 180;
  const lat0 = p[0] * rad;
  const toXY = (q: Pt): [number, number] => [
    (q[1] - p[1]) * rad * Math.cos(lat0) * R,
    (q[0] - p[0]) * rad * R,
  ];
  const [ax, ay] = toXY(a);
  const [bx, by] = toXY(b);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (-ax * dx - ay * dy) / len2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.sqrt(cx * cx + cy * cy);
}

function minLineDistM(p: Pt, line: Pt[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const d = segDistM(p, line[i - 1]!, line[i]!);
    if (d < best) best = d;
  }
  return best;
}

async function main() {
  const routeId = Number(process.env.ROUTE_ID ?? "265");
  const res = await db.execute(
    sql`select id, name, geometry from routes where id = ${routeId}`,
  );
  const row = res.rows[0] as { id: number; name: string; geometry: Pt[] } | undefined;
  if (!row) throw new Error("route niet gevonden");
  const geom = row.geometry;
  console.log(`Route ${row.id} "${row.name}" — ${geom.length} punten`);
  const remarks = await getRouteRemarks(geom);
  if (!remarks) throw new Error("remarks null (upstream)");
  const poorten = remarks.filter((r) => r.kind === "poort");
  console.log(`Totaal ${remarks.length} remarks, waarvan ${poorten.length} poort`);
  for (const r of poorten) {
    const d = minLineDistM([r.lat, r.lon], geom);
    console.log(
      `${r.id} km ${r.routeKm} "${r.label}" offRouteM(gemeld)=${r.offRouteM} lijnafstand=${d.toFixed(1)} m evidence=${r.evidence}`,
    );
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
