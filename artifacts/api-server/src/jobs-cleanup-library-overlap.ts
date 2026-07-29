// Eenmalige opruiming: verwijder bibliotheekroutes waarvan het spoor te veel
// heen-en-terug over hetzelfde wegvak rijdt (doodlopend uitsteeksel) of een
// mini-lusje bevat. Zelfde drie poorten als generateStarterSet.
import { db, routeLibraryTable } from "@workspace/db";
import {
  pathOverlapFraction,
  longestRepeatedStretchM,
  smallestSubLoopM,
} from "./lib/routing";
import {
  MAX_LIBRARY_OVERLAP,
  MAX_LIBRARY_SPUR_M,
  MIN_LIBRARY_SUBLOOP_M,
} from "./lib/route-library";
import { eq } from "drizzle-orm";

const rows = await db
  .select({ id: routeLibraryTable.id, name: routeLibraryTable.name, cellKey: routeLibraryTable.cellKey, geometry: routeLibraryTable.geometry })
  .from(routeLibraryTable);

let removed = 0;
for (const r of rows) {
  const path = r.geometry as [number, number][] | null;
  if (!Array.isArray(path) || path.length < 3) continue;
  const overlap = pathOverlapFraction(path);
  const spurM = longestRepeatedStretchM(path);
  const subLoopM = smallestSubLoopM(path);
  const subLoopTxt = Number.isFinite(subLoopM) ? `${Math.round(subLoopM)}m` : "geen";
  console.log(
    `overlap=${overlap.toFixed(3)} spur=${spurM}m sublus=${subLoopTxt} ${r.name} (${r.cellKey})`,
  );
  if (
    overlap > MAX_LIBRARY_OVERLAP ||
    spurM > MAX_LIBRARY_SPUR_M ||
    subLoopM < MIN_LIBRARY_SUBLOOP_M
  ) {
    await db.delete(routeLibraryTable).where(eq(routeLibraryTable.id, r.id));
    removed += 1;
    console.log(`verwijderd: ${r.name} (${r.cellKey})`);
  }
}
console.log(`klaar: ${rows.length} beoordeeld, ${removed} verwijderd`);
process.exit(0);
