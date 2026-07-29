// Tests voor de pure planoverzicht-logica (wizardstappen, gedempte
// doelverschuiving, plan-naleving). Draait met node:test via tsx.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  wizardStappenVoorNiveau,
  berekenDoelverschuiving,
  berekenPlanNaleving,
  berekenSnelleAanpassing,
  maandagVanISO,
  faseLabel,
} from "../plan-overview";
import type { PlannedWorkout } from "../athlete-types";

function w(over: Partial<PlannedWorkout>): PlannedWorkout {
  return {
    id: 1,
    scheduledDate: "2026-07-20",
    type: "endurance",
    title: "Duurrit",
    description: null,
    targetDurationMin: 60,
    targetTSS: 50,
    status: "planned",
    sessionId: null,
    ...over,
  } as PlannedWorkout;
}

const VANDAAG = "2026-07-29";

test("wizard is adaptief: recreatief weinig vragen, continentaal veel", () => {
  assert.deepEqual(wizardStappenVoorNiveau("recreatief"), [
    "niveau", "beschikbaarheid", "agenda", "samenvatting",
  ]);
  assert.deepEqual(wizardStappenVoorNiveau("sportief"), [
    "niveau", "beschikbaarheid", "agenda", "belastbaarheid", "samenvatting",
  ]);
  assert.deepEqual(wizardStappenVoorNiveau("continentaal"), [
    "niveau", "beschikbaarheid", "agenda", "belastbaarheid", "voorkeuren", "samenvatting",
  ]);
});

test("één gemiste training verschuift het doel NIET (demping)", () => {
  const res = berekenDoelverschuiving(
    [
      w({ id: 1, scheduledDate: "2026-07-25" }), // gemist
      w({ id: 2, scheduledDate: "2026-07-23", status: "completed", sessionId: 9 }),
      w({ id: 3, scheduledDate: "2026-07-21", status: "completed", sessionId: 8 }),
      w({ id: 4, scheduledDate: "2026-07-19", status: "completed", sessionId: 7 }),
    ],
    VANDAAG,
  );
  assert.equal(res.tonen, false);
  assert.equal(res.gemisteTrainingen, 1);
  assert.equal(res.boodschap, null);
});

test("een week niet trainen verschuift het doel WEL", () => {
  const res = berekenDoelverschuiving(
    [
      w({ id: 1, scheduledDate: "2026-07-27" }),
      w({ id: 2, scheduledDate: "2026-07-25" }),
      w({ id: 3, scheduledDate: "2026-07-23" }),
      w({ id: 4, scheduledDate: "2026-07-21" }),
    ],
    VANDAAG,
  );
  assert.equal(res.tonen, true);
  assert.equal(res.gemisteTrainingen, 4);
  assert.ok(res.boodschap && res.boodschap.includes("niet aantoonbaar uitgevoerd"));
});

test("helft van de minuten gemist bij ≥2 trainingen toont verschuiving", () => {
  const res = berekenDoelverschuiving(
    [
      w({ id: 1, scheduledDate: "2026-07-26", targetDurationMin: 120 }), // gemist
      w({ id: 2, scheduledDate: "2026-07-24", targetDurationMin: 60, status: "completed", sessionId: 5 }),
    ],
    VANDAAG,
  );
  assert.equal(res.tonen, true);
});

test("rustdagen, geannuleerd en overgeslagen tellen nergens mee", () => {
  const res = berekenDoelverschuiving(
    [
      w({ id: 1, scheduledDate: "2026-07-26", type: "rest" }),
      w({ id: 2, scheduledDate: "2026-07-25", status: "cancelled" }),
      w({ id: 3, scheduledDate: "2026-07-24", status: "skipped" }),
    ],
    VANDAAG,
  );
  assert.equal(res.tonen, false);
  assert.equal(res.geplandeMinuten, 0);
});

test("toekomstige en te oude trainingen vallen buiten het venster", () => {
  const res = berekenDoelverschuiving(
    [
      w({ id: 1, scheduledDate: "2026-07-30" }), // morgen
      w({ id: 2, scheduledDate: "2026-07-01" }), // > 14 dagen terug
    ],
    VANDAAG,
  );
  assert.equal(res.gemisteTrainingen, 0);
});

test("naleving: pct alleen bij ≥3 geplande trainingen, gekoppelde sessie telt", () => {
  const weinig = berekenPlanNaleving(
    [w({ id: 1, scheduledDate: "2026-07-25", sessionId: 4 })],
    VANDAAG,
  );
  assert.equal(weinig.pct, null);

  const genoeg = berekenPlanNaleving(
    [
      w({ id: 1, scheduledDate: "2026-07-25", sessionId: 4 }),
      w({ id: 2, scheduledDate: "2026-07-23", status: "completed" }),
      w({ id: 3, scheduledDate: "2026-07-21" }), // gemist
      w({ id: 4, scheduledDate: "2026-07-19" }), // gemist
    ],
    VANDAAG,
  );
  assert.equal(genoeg.gepland, 4);
  assert.equal(genoeg.uitgevoerd, 2);
  assert.equal(genoeg.pct, 50);
});

// ── Snelle aanpassingen (dagkaart) ──────────────────────────────────────────

test("maandagVanISO geeft de maandag van de lokale week", () => {
  assert.equal(maandagVanISO("2026-07-29"), "2026-07-27"); // woensdag
  assert.equal(maandagVanISO("2026-07-27"), "2026-07-27"); // maandag zelf
  assert.equal(maandagVanISO("2026-08-02"), "2026-07-27"); // zondag
});

test("verkorten −25%: schaalt duur én TSS en meldt de weekimpact eerlijk", () => {
  const workout = w({ id: 1, scheduledDate: "2026-07-30", targetDurationMin: 90, targetTSS: 80 });
  const rest = w({ id: 2, scheduledDate: "2026-07-31", targetDurationMin: 210, targetTSS: 100 });
  const res = berekenSnelleAanpassing({
    workout, actie: "verkorten", alleWorkouts: [workout, rest], vandaagISO: VANDAAG,
  });
  assert.equal(res.kan, true);
  assert.equal(res.nieuweDuurMin, 68); // round(90*0.75)
  assert.equal(res.nieuweTSS, 60);
  assert.match(res.consequentie!, /Van 90 naar 68 min \(-22 min, -20 TSS\)/);
  assert.match(res.consequentie!, /van 300 naar 278 geplande minuten/);
  // −22 min op 300 weekminuten is gedempt: geen doelverschuiving melden
  assert.match(res.consequentie!, /niet merkbaar/);
});

test("verlengen +25% op een klein weekvolume raakt het doel wél merkbaar", () => {
  const workout = w({ id: 1, scheduledDate: "2026-07-30", targetDurationMin: 240, targetTSS: null });
  const res = berekenSnelleAanpassing({
    workout, actie: "verlengen", alleWorkouts: [workout], vandaagISO: VANDAAG,
  });
  assert.equal(res.kan, true);
  assert.equal(res.nieuweDuurMin, 300);
  assert.equal(res.nieuweTSS, null); // geen TSS gepland → nooit verzonnen
  assert.match(res.consequentie!, /\+60 min/);
  assert.doesNotMatch(res.consequentie!, /TSS\)/);
  assert.match(res.consequentie!, /merkbaar te beïnvloeden/);
});

test("verkorten zonder geplande duur of tot onder 15 min is eerlijk onmogelijk", () => {
  const zonderDuur = berekenSnelleAanpassing({
    workout: w({ targetDurationMin: null }), actie: "verkorten", alleWorkouts: [], vandaagISO: VANDAAG,
  });
  assert.equal(zonderDuur.kan, false);
  assert.match(zonderDuur.reden!, /geen geplande duur/);

  const teKort = berekenSnelleAanpassing({
    workout: w({ targetDurationMin: 18 }), actie: "verkorten", alleWorkouts: [], vandaagISO: VANDAAG,
  });
  assert.equal(teKort.kan, false);
  assert.match(teKort.reden!, /korter dan 15 minuten/);
});

test("verplaatsen binnen dezelfde week: minuten/TSS blijven gelijk", () => {
  const workout = w({ id: 1, scheduledDate: "2026-07-30", targetDurationMin: 90 });
  const res = berekenSnelleAanpassing({
    workout, actie: "verplaatsen", alleWorkouts: [workout], vandaagISO: VANDAAG, nieuweDatum: "2026-08-01",
  });
  assert.equal(res.kan, true);
  assert.equal(res.nieuweDatum, "2026-08-01");
  assert.match(res.consequentie!, /blijven gelijk/);
});

test("verplaatsen naar een andere week verschuift weekminuten expliciet", () => {
  const workout = w({ id: 1, scheduledDate: "2026-07-30", targetDurationMin: 90 });
  const ander = w({ id: 2, scheduledDate: "2026-08-04", targetDurationMin: 60 });
  const res = berekenSnelleAanpassing({
    workout, actie: "verplaatsen", alleWorkouts: [workout, ander], vandaagISO: VANDAAG, nieuweDatum: "2026-08-05",
  });
  assert.equal(res.kan, true);
  assert.match(res.consequentie!, /van 90 naar 0 geplande minuten/);
  assert.match(res.consequentie!, /van 60 naar 150/);
  assert.match(res.consequentie!, /totale belasting blijft gelijk/);
});

test("verplaatsen waarschuwt bij bezette dag en weigert verleden/zelfde dag", () => {
  const workout = w({ id: 1, scheduledDate: "2026-07-30", targetDurationMin: 90 });
  const bezet = w({ id: 2, scheduledDate: "2026-07-31", targetDurationMin: 60 });
  const naarBezet = berekenSnelleAanpassing({
    workout, actie: "verplaatsen", alleWorkouts: [workout, bezet], vandaagISO: VANDAAG, nieuweDatum: "2026-07-31",
  });
  assert.equal(naarBezet.kan, true);
  assert.match(naarBezet.consequentie!, /staat al een training/);

  const verleden = berekenSnelleAanpassing({
    workout, actie: "verplaatsen", alleWorkouts: [workout], vandaagISO: VANDAAG, nieuweDatum: "2026-07-28",
  });
  assert.equal(verleden.kan, false);
  assert.match(verleden.reden!, /verleden/);

  const zelfde = berekenSnelleAanpassing({
    workout, actie: "verplaatsen", alleWorkouts: [workout], vandaagISO: VANDAAG, nieuweDatum: "2026-07-30",
  });
  assert.equal(zelfde.kan, false);
  assert.match(zelfde.reden!, /andere dag/);

  const geenDatum = berekenSnelleAanpassing({
    workout, actie: "verplaatsen", alleWorkouts: [workout], vandaagISO: VANDAAG,
  });
  assert.equal(geenDatum.kan, false);
  assert.match(geenDatum.reden!, /Kies eerst een dag/);
});

test("faseLabel vertaalt bekende fasen en is eerlijk bij onbekend", () => {
  assert.equal(faseLabel("base"), "Basis");
  assert.equal(faseLabel("taper"), "Taper");
  assert.equal(faseLabel("iets_raars"), null);
  assert.equal(faseLabel(null), null);
});
