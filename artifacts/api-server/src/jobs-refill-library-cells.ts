// Eenmalig: hervul de bibliotheekcellen na de opruiming. ensureLibraryRoutes
// start de generatie op de achtergrond; we pollen tot elke cel vol genoeg is
// of het te lang duurt (ORS-calls duren minuten).
import { db, routeLibraryTable } from "@workspace/db";
import { ensureLibraryRoutes } from "./lib/route-library";
import { eq, count } from "drizzle-orm";

const CELLS: Array<{ key: string; lat: number; lon: number }> = [
  { key: "208:23", lat: 52.125, lon: 5.875 },
  { key: "208:24", lat: 52.125, lon: 6.125 },
  { key: "209:26", lat: 52.375, lon: 6.625 },
];

async function cellCount(key: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(routeLibraryTable)
    .where(eq(routeLibraryTable.cellKey, key));
  return row?.n ?? 0;
}

for (const c of CELLS) {
  const res = await ensureLibraryRoutes(c.lat, c.lon);
  console.log(`cel ${c.key}: start=${res.status} (nu ${await cellCount(c.key)} routes)`);
}

const deadline = Date.now() + 25 * 60 * 1000;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 30_000));
  const counts = await Promise.all(CELLS.map((c) => cellCount(c.key)));
  console.log(
    `stand: ${CELLS.map((c, i) => `${c.key}=${counts[i]}`).join(" ")} (${new Date().toISOString()})`,
  );
  const FULL = 12; // volledige startset (alle fiets×afstand-combinaties)
  if (counts.every((n) => n >= FULL)) break;
  // Her-trigger voor cellen die klaar lijken met een gat (generator idempotent).
  for (let i = 0; i < CELLS.length; i++) {
    if ((counts[i] ?? 0) < FULL) await ensureLibraryRoutes(CELLS[i]!.lat, CELLS[i]!.lon);
  }
}
console.log("klaar met hervullen (of tijd op)");
process.exit(0);
