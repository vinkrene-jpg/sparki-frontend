import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyseToestand,
  combineerToestanden,
  laatstBijgewerktLabel,
  ANALYSE_PERIODES,
  periodeLabel,
  contextRegel,
  dekkingRegel,
  ftpWeergave,
  maandLabel,
  readinessReeks,
  hrvReeks,
  hrvVandaag,
  hrvDelta,
  reeksSamenvatting,
  radarSamenvatting,
  ftpSamenvatting,
  sessieDatumLabel,
  sessieTitel,
  sessieDuurLabel,
  sessieBelasting,
} from "./core-analyse";

// ── Toestandsafleiding ───────────────────────────────────────────────────────

test("analyseToestand: eerste keer laden zonder data → laden", () => {
  assert.equal(
    analyseToestand({ isLoading: true, isError: false, hasData: false }),
    "laden",
  );
});

test("analyseToestand: fout zonder cache → fout (geen cijfers tonen)", () => {
  assert.equal(
    analyseToestand({ isLoading: false, isError: true, hasData: false }),
    "fout",
  );
});

test("analyseToestand: fout mét cache → verouderd (tonen mag, met melding)", () => {
  assert.equal(
    analyseToestand({ isLoading: false, isError: true, hasData: true }),
    "verouderd",
  );
});

test("analyseToestand: bron werkt maar is leeg → leeg", () => {
  assert.equal(
    analyseToestand({ isLoading: false, isError: false, hasData: false }),
    "leeg",
  );
});

test("analyseToestand: verse data → ok; achtergrond-verversing blijft ok", () => {
  assert.equal(
    analyseToestand({ isLoading: false, isError: false, hasData: true }),
    "ok",
  );
  assert.equal(
    analyseToestand({ isLoading: true, isError: false, hasData: true }),
    "ok",
  );
});

test("combineerToestanden: strengste toestand wint", () => {
  assert.equal(combineerToestanden("ok", "fout", "laden"), "fout");
  assert.equal(combineerToestanden("ok", "laden"), "laden");
  assert.equal(combineerToestanden("ok", "verouderd"), "verouderd");
  assert.equal(combineerToestanden("ok", "leeg"), "leeg");
  assert.equal(combineerToestanden("ok", "ok"), "ok");
  assert.equal(combineerToestanden(), "ok");
});

// ── Laatst bijgewerkt ────────────────────────────────────────────────────────

test("laatstBijgewerktLabel: alleen uit een echt tijdstip", () => {
  const nu = 1_000_000_000_000;
  assert.equal(laatstBijgewerktLabel(null, nu), null);
  assert.equal(laatstBijgewerktLabel(0, nu), null);
  assert.equal(laatstBijgewerktLabel(nu + 1000, nu), null);
  assert.equal(
    laatstBijgewerktLabel(nu - 30_000, nu),
    "minder dan een minuut geleden",
  );
  assert.equal(laatstBijgewerktLabel(nu - 60_000, nu), "1 minuut geleden");
  assert.equal(laatstBijgewerktLabel(nu - 5 * 60_000, nu), "5 minuten geleden");
  assert.equal(laatstBijgewerktLabel(nu - 60 * 60_000, nu), "1 uur geleden");
  assert.equal(laatstBijgewerktLabel(nu - 3 * 60 * 60_000, nu), "3 uur geleden");
  assert.equal(
    laatstBijgewerktLabel(nu - 26 * 60 * 60_000, nu),
    "1 dag geleden",
  );
  assert.equal(
    laatstBijgewerktLabel(nu - 3 * 24 * 60 * 60_000, nu),
    "3 dagen geleden",
  );
});

// ── Periode ──────────────────────────────────────────────────────────────────

test("periodes: bestaande keuze 14/30/90 met leesbaar label", () => {
  assert.deepEqual([...ANALYSE_PERIODES], [14, 30, 90]);
  assert.equal(periodeLabel(14), "14 dagen");
});

// ── Kopregels ────────────────────────────────────────────────────────────────

test("contextRegel: alleen echte onderdelen, geen verzonnen cijfers", () => {
  assert.equal(contextRegel(null), null);
  assert.equal(contextRegel(undefined), null);
  assert.equal(contextRegel({}), "Atleet");
  assert.equal(
    contextRegel({ displayName: "René", ftp: 250, wkg: "3,4" }),
    "René · FTP 250W · 3,4 W/kg",
  );
  // FTP 0 of null wordt nooit als waarde getoond.
  assert.equal(contextRegel({ displayName: "René", ftp: 0 }), "René");
  assert.equal(contextRegel({ displayName: "René", ftp: null }), "René");
});

test("dekkingRegel: bestaande eerlijke copy", () => {
  assert.equal(
    dekkingRegel(6, 6),
    "Alle zes signalen berekend uit je eigen data.",
  );
  assert.equal(
    dekkingRegel(4, 6),
    "4 van 6 signalen meetbaar — alleen die worden getekend.",
  );
});

// ── FTP ──────────────────────────────────────────────────────────────────────

test("ftpWeergave: sorteert, delta all-time, profiel-FTP is bron van waarheid", () => {
  const w = ftpWeergave(
    [
      { ftpWatts: 240, measuredAt: "2026-06-15" },
      { ftpWatts: 210, measuredAt: "2026-03-10" },
    ],
    250,
  );
  assert.deepEqual(
    w.gesorteerd.map((t) => t.ftpWatts),
    [210, 240],
  );
  assert.equal(w.getoond, 250);
  assert.equal(w.bronIsProfiel, true);
  assert.equal(w.deltaAllTime, 30);
  assert.equal(w.maxWatts, 240);
});

test("ftpWeergave: zonder profiel-FTP valt weergave terug op laatste test", () => {
  const w = ftpWeergave([{ ftpWatts: 220, measuredAt: "2026-05-01" }], null);
  assert.equal(w.getoond, 220);
  assert.equal(w.bronIsProfiel, false);
  assert.equal(w.deltaAllTime, 0);
});

test("ftpWeergave: leeg blijft eerlijk leeg", () => {
  const w = ftpWeergave([], null);
  assert.equal(w.getoond, null);
  assert.equal(w.maxWatts, 0);
  assert.equal(w.gesorteerd.length, 0);
});

test("maandLabel: deterministisch nl-NL, geen UTC-off-by-one", () => {
  assert.equal(maandLabel("2026-03-10"), "mrt");
  assert.equal(maandLabel("2026-01-01"), "jan");
});

// ── Dagmetingen ──────────────────────────────────────────────────────────────

test("readinessReeks: oudste eerst, 1–5 → 0–100, gaten weggelaten", () => {
  const reeks = readinessReeks([
    { feelScore: 4 },
    { feelScore: null },
    { feelScore: 3 },
  ]);
  assert.deepEqual(reeks, [60, 80]);
});

test("hrv-reeks en -delta: alleen echte metingen, delta vergt twee dagen", () => {
  assert.deepEqual(hrvReeks([{ hrv: 60 }, { hrv: 55 }]), [55, 60]);
  assert.equal(hrvVandaag([{ hrv: 60 }, { hrv: 55 }]), 60);
  assert.equal(hrvDelta([{ hrv: 60 }, { hrv: 55 }]), 5);
  assert.equal(hrvDelta([{ hrv: 60 }, { hrv: null }]), null);
  assert.equal(hrvDelta([{ hrv: 60 }]), null);
  assert.equal(hrvVandaag([]), null);
});

// ── Tekstalternatieven ───────────────────────────────────────────────────────

test("reeksSamenvatting: echte waarden of niets", () => {
  assert.equal(reeksSamenvatting("Gereedheid", [80], "van 100"), null);
  assert.equal(
    reeksSamenvatting("Gereedheid", [60, 80, 70], "van 100"),
    "Gereedheid: 3 metingen, van 60 naar 70 van 100; laagste 60, hoogste 80 van 100.",
  );
});

test("radarSamenvatting: niveaus 0..1 → 'x van 100', onder 3 assen niets", () => {
  assert.equal(radarSamenvatting([{ label: "Fitheid", level: 0.8 }]), null);
  assert.equal(
    radarSamenvatting([
      { label: "Fitheid", level: 0.8 },
      { label: "Vorm", level: 0.5 },
      { label: "Gevoel", level: 1 },
    ]),
    "Performance-radar met 3 meetbare signalen: Fitheid 80 van 100, Vorm 50 van 100, Gevoel 100 van 100.",
  );
});

test("ftpSamenvatting: 0, 1 of meer tests", () => {
  assert.equal(ftpSamenvatting([]), null);
  assert.equal(
    ftpSamenvatting([{ ftpWatts: 220, measuredAt: "2026-05-01" }]),
    "FTP-verloop: 1 test, 220 watt (mei).",
  );
  assert.equal(
    ftpSamenvatting([
      { ftpWatts: 210, measuredAt: "2026-03-10" },
      { ftpWatts: 240, measuredAt: "2026-06-15" },
    ]),
    "FTP-verloop: 2 tests, van 210 watt (mrt) naar 240 watt (jun).",
  );
});

// ── Sessieregels ─────────────────────────────────────────────────────────────

test("sessieDatumLabel en sessieTitel: bestaande weergave behouden", () => {
  assert.equal(sessieDatumLabel("2026-07-15"), "15 jul");
  assert.equal(sessieTitel({ title: "Zondagsrit", type: "endurance" }), "Zondagsrit");
  assert.equal(sessieTitel({ title: null, type: "endurance" }), "Endurance");
});

test("sessieDuurLabel en sessieBelasting: nooit nullen verzinnen", () => {
  assert.equal(sessieDuurLabel(120), "120 min");
  assert.equal(sessieDuurLabel(null), null);
  assert.equal(sessieBelasting("55.4"), 55);
  assert.equal(sessieBelasting(null), null);
  assert.equal(sessieBelasting("geen"), null);
  assert.equal(sessieBelasting(0), 0);
});
