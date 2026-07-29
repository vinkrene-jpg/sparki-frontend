// Nachtelijke bibliotheek-backfill — pure celkeuze-test (geen DB, geen ORS).
//
// Pint het selectiegedrag vast waar de EU-kaart-groei op leunt:
//  - eigen cel eerst (ring 0 start op de échte woonlocatie),
//  - ring voor ring naar buiten, round-robin over gebruikers (eerlijk verdeeld),
//  - al gevulde cellen worden overgeslagen,
//  - het maximum per nacht wordt gerespecteerd,
//  - celmiddelpunten kloppen ook bij negatieve coördinaten.
//
// Run: `pnpm --filter @workspace/api-server run test:library-backfill`
// Exits non-zero on any failure.

import {
  pickBackfillCells,
  cellCenter,
  BACKFILL_MAX_RING,
} from "../lib/library-backfill";
import { cellKeyFor } from "../lib/route-library";

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

const HOME = { lat: 51.93, lon: 4.47 }; // cel "207:17"

scenario("ring 0 wordt eerst gekozen en start op de echte woonlocatie", () => {
  const picks = pickBackfillCells([HOME], new Set(), { maxCells: 3 });
  assert(picks.length === 3, `expected 3 picks, got ${picks.length}`);
  assert(picks[0]!.cellKey === cellKeyFor(HOME.lat, HOME.lon), "eigen cel eerst");
  assert(picks[0]!.ring === 0, "eerste pick moet ring 0 zijn");
  assert(
    picks[0]!.lat === HOME.lat && picks[0]!.lon === HOME.lon,
    "ring 0 start op de woonlocatie zelf, niet het celmiddelpunt",
  );
  assert(picks[1]!.ring === 1 && picks[2]!.ring === 1, "daarna ring 1");
});

scenario("gevulde cellen worden overgeslagen", () => {
  const homeCell = cellKeyFor(HOME.lat, HOME.lon);
  const picks = pickBackfillCells([HOME], new Set([homeCell]), { maxCells: 2 });
  assert(picks.every((p) => p.cellKey !== homeCell), "gevulde eigen cel niet opnieuw");
  assert(picks[0]!.ring === 1, "start dan in ring 1");
});

scenario("maxCells wordt gerespecteerd", () => {
  const picks = pickBackfillCells([HOME], new Set(), { maxCells: 5 });
  assert(picks.length === 5, `expected 5, got ${picks.length}`);
});

scenario("volledige omgeving = (2*maxRing+1)^2 cellen", () => {
  const picks = pickBackfillCells([HOME], new Set(), {
    maxCells: Number.MAX_SAFE_INTEGER,
  });
  const expected = (2 * BACKFILL_MAX_RING + 1) ** 2;
  assert(picks.length === expected, `expected ${expected}, got ${picks.length}`);
  const unique = new Set(picks.map((p) => p.cellKey));
  assert(unique.size === picks.length, "geen dubbele cellen");
});

scenario("round-robin: twee huizen delen de nachtportie eerlijk", () => {
  const homeA = { lat: 51.93, lon: 4.47 };
  const homeB = { lat: 52.37, lon: 4.9 }; // andere cel, ver genoeg
  const picks = pickBackfillCells([homeA, homeB], new Set(), { maxCells: 2 });
  assert(picks.length === 2, `expected 2, got ${picks.length}`);
  assert(
    picks[0]!.cellKey === cellKeyFor(homeA.lat, homeA.lon) &&
      picks[1]!.cellKey === cellKeyFor(homeB.lat, homeB.lon),
    "eerst de eigen cel van ELK huis (ring 0 round-robin)",
  );
});

scenario("buurhuizen in dezelfde cel leveren geen dubbele picks", () => {
  const picks = pickBackfillCells(
    [HOME, { lat: HOME.lat + 0.01, lon: HOME.lon + 0.01 }],
    new Set(),
    { maxCells: Number.MAX_SAFE_INTEGER },
  );
  const unique = new Set(picks.map((p) => p.cellKey));
  assert(unique.size === picks.length, "geen dubbele cellen over huizen heen");
});

scenario("celmiddelpunt klopt, ook bij negatieve coördinaten", () => {
  const key = cellKeyFor(51.93, 4.47);
  const c = cellCenter(key);
  assert(cellKeyFor(c.lat, c.lon) === key, "middelpunt valt in dezelfde cel");
  const negKey = cellKeyFor(-33.9, -18.5); // (buiten EU, puur wiskunde-check)
  const nc = cellCenter(negKey);
  assert(cellKeyFor(nc.lat, nc.lon) === negKey, "negatief middelpunt valt in dezelfde cel");
});

scenario("geen huizen → geen picks", () => {
  const picks = pickBackfillCells([], new Set(), { maxCells: 10 });
  assert(picks.length === 0, "lege invoer levert niets");
});

const failed = results.filter((r) => r.status === "fail");
for (const r of results) {
  console.log(`${r.status === "pass" ? "✓" : "✗"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
