// Tests voor de pure planoverzicht-logica (wizardstappen, gedempte
// doelverschuiving, plan-naleving). Draait met node:test via tsx.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  wizardStappenVoorNiveau,
  berekenDoelverschuiving,
  berekenPlanNaleving,
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

test("faseLabel vertaalt bekende fasen en is eerlijk bij onbekend", () => {
  assert.equal(faseLabel("base"), "Basis");
  assert.equal(faseLabel("taper"), "Taper");
  assert.equal(faseLabel("iets_raars"), null);
  assert.equal(faseLabel(null), null);
});
