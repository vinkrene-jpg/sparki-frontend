// Analyse-periodes & weekzones — unit-contract voor de pure helpers achter
// de powercurve-periodevergelijking en de weekzoneverdeling:
//   1. powerBestPeriods: twee even lange, NIET-overlappende blokken van exact
//      42 lokale kalenderdagen (incl. gedrag op beide grensdatums).
//   2. mondayOf/shiftDateStr: lokale weekstarts, ook over maand-/jaargrenzen
//      — nooit via toISOString (UTC-dag-val).
//   3. powerZoneSecondsFromStreams: echte streams tellen per Coggan-zone;
//      geen power-kanaal of geen FTP ⇒ eerlijk null, nooit een gok.
//
// Run: `pnpm --filter @workspace/api-server run test:analysis-periods`

import {
  localDateStr,
  shiftDateStr,
  powerBestPeriods,
  mondayOf,
} from "../lib/analysis-periods";
import {
  POWER_ZONES,
  powerZoneSecondsFromStreams,
} from "../lib/activity-streams";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`OK   ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── 1. Periodegrenzen powercurve ─────────────────────────────────────────────
{
  const today = "2026-08-04";
  const { recentStart, previousStart } = powerBestPeriods(today);
  check("recentStart = vandaag − 41", recentStart === "2026-06-24", recentStart);
  check("previousStart = vandaag − 83", previousStart === "2026-05-13", previousStart);

  // Exact 42 dagen per blok, aaneensluitend en niet-overlappend.
  const daysBetween = (a: string, b: string) => {
    let n = 0;
    let cur = a;
    while (cur < b && n < 1000) {
      cur = shiftDateStr(cur, 1);
      n += 1;
    }
    return n;
  };
  check("recent blok telt 42 dagen (start t/m vandaag)", daysBetween(recentStart, today) + 1 === 42);
  check("previous blok telt 42 dagen", daysBetween(previousStart, recentStart) === 42);

  // Grensdatums: classificatie zoals het endpoint hem toepast.
  const classify = (date: string) =>
    date >= recentStart ? "recent" : date >= previousStart ? "previous" : "older";
  check("sessie op recentStart valt in recent", classify(recentStart) === "recent");
  check("sessie op dag vóór recentStart valt in previous", classify(shiftDateStr(recentStart, -1)) === "previous");
  check("sessie op previousStart valt in previous", classify(previousStart) === "previous");
  check("sessie op dag vóór previousStart telt niet mee", classify(shiftDateStr(previousStart, -1)) === "older");
  check("sessie vandaag valt in recent", classify(today) === "recent");
}

// ── 2. Weekstarts (lokale maandagen) ─────────────────────────────────────────
{
  check("ma 2026-08-03 is eigen weekstart", mondayOf("2026-08-03") === "2026-08-03");
  check("di 2026-08-04 → ma 2026-08-03", mondayOf("2026-08-04") === "2026-08-03");
  check("zo 2026-08-09 → ma 2026-08-03", mondayOf("2026-08-09") === "2026-08-03");
  check("maandgrens: za 2026-08-01 → ma 2026-07-27", mondayOf("2026-08-01") === "2026-07-27");
  check("jaargrens: vr 2027-01-01 → ma 2026-12-28", mondayOf("2027-01-01") === "2026-12-28");
  check("shiftDateStr over jaargrens", shiftDateStr("2027-01-01", -4) === "2026-12-28");
  // localDateStr gebruikt lokale getters — het resultaat is per definitie de
  // lokale kalenderdag van "nu" (regressiewacht: formaat + consistentie).
  const now = new Date();
  check(
    "localDateStr = lokale kalenderdag",
    localDateStr(now) ===
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
  );
}

// ── 3. Zone-seconden uit streams ─────────────────────────────────────────────
{
  const ftp = 200;
  // 10 buckets, 4s per bucket: 100W (Z1-grens? 100/200=0.5 ⇒ Z1) ×5,
  // 150W (0.75 ⇒ Z3-ondergrens) ×3, 260W (1.3 ⇒ Z6) ×2.
  const t = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36];
  const power = [100, 100, 100, 100, 100, 150, 150, 150, 260, 260];
  const secs = powerZoneSecondsFromStreams({ t, power }, ftp);
  check("zone-seconden berekend", secs != null);
  if (secs) {
    check("Z1 = 20s (5×4s @0.50)", secs[0] === 20, String(secs));
    check("Z3 = 12s (3×4s @0.75)", secs[2] === 12, String(secs));
    check("Z6 = 8s (2×4s @1.30)", secs[5] === 8, String(secs));
    check("totaal = som buckets", secs.reduce((a, b) => a + b, 0) === 40);
  }
  // Gaten (null) tellen niet mee.
  const gappy = powerZoneSecondsFromStreams({ t, power: [100, null, null, null, null, null, null, null, null, null] }, ftp);
  check("gaten tellen niet mee", gappy != null && gappy.reduce((a, b) => a + b, 0) === 4, String(gappy));
  // Eerlijk null zonder power of zonder FTP.
  check("geen power-kanaal ⇒ null", powerZoneSecondsFromStreams({ t, power: null }, ftp) === null);
  check("geen FTP ⇒ null", powerZoneSecondsFromStreams({ t, power }, null) === null);
  check("FTP 0 ⇒ null", powerZoneSecondsFromStreams({ t, power }, 0) === null);
  check("te korte t-as ⇒ null", powerZoneSecondsFromStreams({ t: [0], power: [100] }, ftp) === null);
  check("6 Coggan-zones", POWER_ZONES.length === 6);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) gefaald.`);
  process.exit(1);
}
console.log("\nAlle analysis-periods checks geslaagd.");
