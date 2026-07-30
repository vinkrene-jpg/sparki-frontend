import { test } from "node:test";
import assert from "node:assert/strict";
import {
  faseVoorDagen,
  faseVoorDatum,
  faseWeekPositie,
  weekTypering,
  bepaalVandaagStaat,
  blokkenZin,
  ontwikkelingTrend,
} from "./plan-overview";
import type { PlannedWorkout } from "./athlete-types";

function w(over: Partial<PlannedWorkout>): PlannedWorkout {
  return {
    id: 1, scheduledDate: "2026-07-27", title: "Rit", type: "ride",
    targetDurationMin: 60, targetTSS: 50, description: null, status: "planned",
    source: "sparki", sessionId: null, routeId: null, planDetails: null, structure: null,
    ...over,
  } as PlannedWorkout;
}

test("faseVoorDagen spiegelt de server-drempels", () => {
  assert.equal(faseVoorDagen(0), "taper");
  assert.equal(faseVoorDagen(10), "taper");
  assert.equal(faseVoorDagen(11), "peak");
  assert.equal(faseVoorDagen(28), "peak");
  assert.equal(faseVoorDagen(29), "build");
  assert.equal(faseVoorDagen(70), "build");
  assert.equal(faseVoorDagen(71), "base");
});

test("faseVoorDatum: eerlijk null zonder wedstrijd of na de wedstrijd", () => {
  assert.equal(faseVoorDatum("2026-07-27", null), null);
  assert.equal(faseVoorDatum("2026-08-10", "2026-08-01"), null);
  assert.equal(faseVoorDatum("2026-07-27", "2026-08-01"), "taper");
});

test("faseWeekPositie: weeknummer binnen de fase, base geeft null", () => {
  // 20 dagen tot de race → piekfase (11..28, 18 dagen ≈ 3 weken)
  const p = faseWeekPositie(20)!;
  assert.equal(p.fase, "peak");
  assert.equal(p.totaalWeken, 3);
  assert.equal(p.weekNr, 2);
  assert.equal(p.resterendeWeken, 2);
  // laatste piekdag
  const laatste = faseWeekPositie(11)!;
  assert.equal(laatste.weekNr, laatste.totaalWeken);
  assert.equal(faseWeekPositie(100), null);
  assert.equal(faseWeekPositie(null), null);
});

test("weekTypering telt alleen echte trainingen binnen de week", () => {
  const workouts = [
    w({ id: 1, scheduledDate: "2026-07-27", targetDurationMin: 90 }),
    w({ id: 2, scheduledDate: "2026-07-29", targetDurationMin: 60, structure: { primaryZone: 4 } as any }),
    w({ id: 3, scheduledDate: "2026-07-30", type: "rest", targetDurationMin: null }),
    w({ id: 4, scheduledDate: "2026-07-28", targetDurationMin: 45, status: "cancelled" }),
    w({ id: 5, scheduledDate: "2026-08-04", targetDurationMin: 120 }), // volgende week
  ];
  const t = weekTypering(workouts, "2026-07-27");
  assert.equal(t.minuten, 150);
  assert.equal(t.trainingen, 2);
  assert.equal(t.aandeelIntensief, 0.5);
  assert.equal(weekTypering([], "2026-07-27").aandeelIntensief, null);
});

test("bepaalVandaagStaat: precies één verklaarde staat", () => {
  assert.equal(bepaalVandaagStaat(undefined).soort, "gat");
  assert.equal(bepaalVandaagStaat(w({ status: "cancelled" })).soort, "gat");
  assert.equal(bepaalVandaagStaat(w({ type: "rest" })).soort, "rust");
  assert.equal(bepaalVandaagStaat(w({ type: "Rustdag" })).soort, "rust");
  assert.equal(bepaalVandaagStaat(w({})).soort, "training");
});

test("blokkenZin: zones en duur per onderdeel, null zonder blokken", () => {
  assert.equal(blokkenZin(null), null);
  const zin = blokkenZin({
    blocks: [
      { kind: "warmup", label: "opwarming", durationMin: 20, zone: 2, targetPctFtp: 60 },
      { kind: "interval", label: "interval", durationMin: 8, zone: 4, targetPctFtp: 105, reps: 4 },
    ],
  } as any);
  assert.equal(zin, "20 min opwarming (Z2) · 4×8 min interval (Z4)");
});

test("ontwikkelingTrend: eerlijk null onder 14 dagen, signaleert stagnatie in opbouw", () => {
  assert.equal(
    ontwikkelingTrend({ chartData: [], fase: "build", doelNaam: "NK", doelDatum: "2026-09-01" }),
    null,
  );
  const vlak = Array.from({ length: 20 }, (_, i) => ({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, ctl: 35 }));
  const t = ontwikkelingTrend({ chartData: vlak, fase: "build", doelNaam: "NK", doelDatum: "2026-09-01" })!;
  assert.ok(t.afwijking, "stagnatie in opbouwfase is een afwijking");
  assert.ok(t.zin.includes("NK"), "doel expliciet genoemd");

  const stijgend = Array.from({ length: 20 }, (_, i) => ({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, ctl: 30 + i }));
  const ok = ontwikkelingTrend({ chartData: stijgend, fase: "build", doelNaam: "NK", doelDatum: "2026-09-01" })!;
  assert.equal(ok.afwijking, false);
  // taper: stijgende belasting is juist de afwijking
  const taper = ontwikkelingTrend({ chartData: stijgend, fase: "taper", doelNaam: "NK", doelDatum: "2026-09-01" })!;
  assert.ok(taper.afwijking);
});
