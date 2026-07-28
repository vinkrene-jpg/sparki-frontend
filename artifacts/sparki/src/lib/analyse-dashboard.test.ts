import { test } from "node:test";
import assert from "node:assert/strict";
import {
  weekStartVan,
  weekVolumeReeks,
  intensiteitsVerdeling,
  gewichtWkgReeks,
  doelOverlays,
  vergelijkReeks,
  dataBetrouwbaarheid,
  laatsteSync,
  analyseSamenvatting,
} from "./analyse-dashboard";

// ── weekStartVan ─────────────────────────────────────────────────────────────

test("weekStartVan: maandag blijft maandag, zondag valt in dezelfde week", () => {
  assert.equal(weekStartVan("2026-07-27"), "2026-07-27"); // ma
  assert.equal(weekStartVan("2026-08-02"), "2026-07-27"); // zo
  assert.equal(weekStartVan("2026-07-28"), "2026-07-27"); // di
});

// ── weekVolumeReeks ──────────────────────────────────────────────────────────

test("weekVolumeReeks: lege weken tellen als 0, uren en tss gesommeerd", () => {
  const reeks = weekVolumeReeks(
    [
      { id: 1, sessionDate: "2026-07-27", durationMin: 60, tss: 50 },
      { id: 2, sessionDate: "2026-07-28", durationMin: 90, tss: 70 },
      { id: 3, sessionDate: "2026-07-14", durationMin: 120, tss: 100 },
    ],
    "2026-07-28",
    4,
  );
  assert.equal(reeks.length, 4);
  const laatste = reeks[reeks.length - 1];
  assert.equal(laatste.weekStart, "2026-07-27");
  assert.equal(laatste.uren, 2.5);
  assert.equal(laatste.tss, 120);
  assert.equal(laatste.sessies, 2);
  // Week van 20 juli: leeg
  assert.equal(reeks[2].uren, 0);
  assert.equal(reeks[2].sessies, 0);
});

test("weekVolumeReeks: sessies zonder duur maken uren eerlijk null, nooit 0", () => {
  const reeks = weekVolumeReeks(
    [{ id: 1, sessionDate: "2026-07-27", durationMin: null, tss: null }],
    "2026-07-28",
    1,
  );
  assert.equal(reeks[0].uren, null);
  assert.equal(reeks[0].sessies, 1);
  assert.equal(reeks[0].tss, null);
});

// ── intensiteitsVerdeling ────────────────────────────────────────────────────

test("intensiteitsVerdeling: verdeelt op afgeleide IF, onbekend zonder TSS", () => {
  const { buckets, totaalMin, bekendMin } = intensiteitsVerdeling([
    // 60 min, TSS 30 → IF ~0.55 → rustig
    { id: 1, sessionDate: "2026-07-01", durationMin: 60, tss: 30 },
    // 60 min, TSS 64 → IF 0.8 → stevig
    { id: 2, sessionDate: "2026-07-02", durationMin: 60, tss: 64 },
    // 60 min, TSS 90 → IF ~0.95 → hard
    { id: 3, sessionDate: "2026-07-03", durationMin: 60, tss: 90 },
    // duur zonder TSS → onbekend
    { id: 4, sessionDate: "2026-07-04", durationMin: 30, tss: null },
    // geen duur → telt helemaal niet mee
    { id: 5, sessionDate: "2026-07-05", durationMin: null, tss: 50 },
  ]);
  const per = Object.fromEntries(buckets.map((b) => [b.key, b.minuten]));
  assert.equal(per.rustig, 60);
  assert.equal(per.stevig, 60);
  assert.equal(per.hard, 60);
  assert.equal(per.onbekend, 30);
  assert.equal(totaalMin, 210);
  assert.equal(bekendMin, 180);
});

// ── gewichtWkgReeks ──────────────────────────────────────────────────────────

test("gewichtWkgReeks: W/kg met FTP-test op of vóór de datum, anders profiel-FTP", () => {
  const reeks = gewichtWkgReeks(
    [
      { metricDate: "2026-06-01", weightKg: 80 },
      { metricDate: "2026-07-01", weightKg: 78 },
    ],
    [{ ftpWatts: 273, measuredAt: "2026-06-15" }],
    240,
  );
  assert.equal(reeks[0].wkg, 3); // 240/80 (profiel-FTP, test is later)
  assert.equal(reeks[1].wkg, 3.5); // 273/78
});

test("gewichtWkgReeks: zonder enige FTP is wkg null, gewicht blijft", () => {
  const reeks = gewichtWkgReeks([{ metricDate: "2026-07-01", weightKg: 70 }], [], null);
  assert.equal(reeks[0].kg, 70);
  assert.equal(reeks[0].wkg, null);
});

// ── doelOverlays ─────────────────────────────────────────────────────────────

test("doelOverlays: herkent streef-FTP, W/kg en gewicht alleen uit actieve doelen", () => {
  const o = doelOverlays({
    goals: [
      { status: "active", measure: "FTP", targetValue: "300 W", targetDate: null, title: "Sterker" },
      { status: "active", measure: "w/kg", targetValue: "4,2", targetDate: null, title: "Klimmen" },
      { status: "paused", measure: "gewicht", targetValue: "70", targetDate: null, title: "Lichter" },
    ],
    seasonGoalTargetKg: 72,
    races: [],
    todayIso: "2026-07-28",
  });
  assert.equal(o.streefFtp, 300);
  assert.equal(o.streefWkg, 4.2);
  // gepauzeerd doel telt niet; seizoensdoel vult streefgewicht
  assert.equal(o.streefGewichtKg, 72);
});

test("doelOverlays: zonder doelen geen overlays (kale grafiek)", () => {
  const o = doelOverlays({ goals: [], seasonGoalTargetKg: null, races: [], todayIso: "2026-07-28" });
  assert.equal(o.streefFtp, null);
  assert.equal(o.streefWkg, null);
  assert.equal(o.streefGewichtKg, null);
  assert.deepEqual(o.raceMarkers, []);
});

test("doelOverlays: onzin-streefwaarden buiten plausibele range worden genegeerd", () => {
  const o = doelOverlays({
    goals: [
      { status: "active", measure: "ftp", targetValue: "9000", targetDate: null, title: "x" },
      { status: "active", measure: "gewicht", targetValue: "5", targetDate: null, title: "x" },
    ],
    seasonGoalTargetKg: null,
    races: [],
    todayIso: "2026-07-28",
  });
  assert.equal(o.streefFtp, null);
  assert.equal(o.streefGewichtKg, null);
});

test("doelOverlays: alleen komende, niet-geannuleerde races als marker", () => {
  const o = doelOverlays({
    goals: [],
    seasonGoalTargetKg: null,
    races: [
      { name: "Verleden", raceDate: "2026-07-01" },
      { name: "Geannuleerd", raceDate: "2026-08-10", status: "geannuleerd" },
      { name: "Komend", raceDate: "2026-08-15" },
    ],
    todayIso: "2026-07-28",
  });
  assert.deepEqual(o.raceMarkers, [{ date: "2026-08-15", name: "Komend" }]);
});

// ── vergelijkReeks ───────────────────────────────────────────────────────────

test("vergelijkReeks: vorige periode uitgelijnd op index, null bij te weinig historie", () => {
  const data = Array.from({ length: 20 }, (_, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, "0")}`,
    ctl: i,
  }));
  const met = vergelijkReeks(data, 10);
  assert.equal(met.length, 10);
  assert.equal(met[0].ctl, 10);
  assert.equal(met[0].vorigCtl, 0);
  const zonder = vergelijkReeks(data.slice(0, 15), 10);
  assert.equal(zonder[0].vorigCtl, null);
});

// ── dataBetrouwbaarheid ──────────────────────────────────────────────────────

test("dataBetrouwbaarheid: geen sessies → geen; dekking bepaalt label", () => {
  assert.equal(dataBetrouwbaarheid([], "2026-07-28").label, "geen");
  const veel = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    sessionDate: `2026-07-${String(i + 10).padStart(2, "0")}`,
    tss: 50,
    durationMin: 60,
  }));
  assert.equal(dataBetrouwbaarheid(veel, "2026-07-28").label, "hoog");
  const half = veel.map((s, i) => ({ ...s, tss: i < 5 ? 50 : null }));
  assert.equal(dataBetrouwbaarheid(half, "2026-07-28").label, "beperkt");
});

// ── laatsteSync ──────────────────────────────────────────────────────────────

test("laatsteSync: nieuwste sync wint; zonder syncs null", () => {
  assert.equal(laatsteSync([]), null);
  const info = laatsteSync([
    { displayName: "Strava", status: "connected", lastSyncAt: "2026-07-27T10:00:00Z" },
    { displayName: "Garmin", status: "connected", lastSyncAt: "2026-07-28T06:00:00Z" },
    { displayName: "Wahoo", status: "not_connected", lastSyncAt: null },
  ]);
  assert.equal(info?.bron, "Garmin");
});

// ── analyseSamenvatting (summary-modus /you) ─────────────────────────────────

test("analyseSamenvatting: laatste stand met ftp-delta en w/kg", () => {
  const s = analyseSamenvatting({
    load: { ctl: 52.4, atl: 60.1, tsb: -7.7 },
    ftpTests: [
      { ftpWatts: 250, measuredAt: "2026-05-01" },
      { ftpWatts: 265, measuredAt: "2026-07-01" },
    ],
    profielFtp: 240,
    metrics: [{ metricDate: "2026-07-20", weightKg: 75 }],
  });
  assert.equal(s.ctl, 52);
  assert.equal(s.tsb, -8);
  assert.equal(s.vormLabel, "Neutraal");
  assert.equal(s.ftp, 265);
  assert.equal(s.ftpDelta, 15);
  assert.equal(s.wkg, 3.53);
});

test("analyseSamenvatting: zonder data alles null, geen schattingen", () => {
  const s = analyseSamenvatting({ load: null, ftpTests: [], profielFtp: null, metrics: [] });
  assert.equal(s.ctl, null);
  assert.equal(s.ftp, null);
  assert.equal(s.wkg, null);
  assert.equal(s.vormLabel, null);
});
