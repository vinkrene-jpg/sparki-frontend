// Borging (taak: eerlijke bron- en ontbreekt-regels): de meta-voet van
// ChartFrame (Periode / Bron / Ontbreekt / Vergelijking) is de
// eerlijkheidslaag onder elke drawer-grafiek. Deze test legt vast dat:
// 1. elke regel ALLEEN verschijnt als hij is meegegeven, met exact label;
// 2. zonder meta-props géén voet rendert (niets wordt verzonnen);
// 3. SessionGraphs bij een rit zonder vermogenskanaal eerlijk
//    "Ontbreekt: vermogen" in de voet toont.
//
// Harnas: zelfde patroon als session-graphs-uitleg.test.tsx — happy-dom +
// module-mocks over het volledige importoppervlak.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const h = (...args: unknown[]) =>
  (
    globalThis as { React?: { createElement: CallableFunction } }
  ).React!.createElement(...(args as [never, never]));

// UitlegDot trekt react-query + apiFetch mee — niet nodig voor deze test.
mock.module("@/components/viz/uitleg", {
  namedExports: { UitlegDot: () => h("span", { "data-testid": "uitleg-dot" }) },
});

mock.module("@/components/viz/stream-chart", {
  namedExports: {
    StreamChart: () => h("div", { "data-testid": "stream-chart" }),
  },
});

mock.module("@/components/viz/zone-chart", {
  namedExports: {
    ZoneDistribution: () => h("div", { "data-testid": "zone-chart" }),
  },
});

mock.module("@/components/sparki/ui", {
  namedExports: { ACCENT: "var(--accent-cyan)" },
});

// Rit ZONDER vermogenskanaal: power ontbreekt, hartslag + temperatuur zijn er
// wél, zodat de ontbreekt-regel exact "vermogen" wordt (geen ruis van andere
// kanalen). De analyse-uitkomsten zelf zijn hier niet onder test.
mock.module("@/lib/stream-analysis", {
  namedExports: {
    powerZoneDistribution: () => null,
    hrZoneDistribution: () => null,
    hrDrift: () => ({ verdict: "laag", driftPct: 2.1 }),
    powerFade: () => null,
    pacing: () => null,
    detectIntervals: () => [],
    compareIntervalsWithPlan: () => null,
    assessComparability: () => ({ comparable: false, reasons: [] }),
    hasChannel: (_s: unknown, ch: string) =>
      ch === "heartRate" || ch === "temperatureC",
  },
});

const reactPromise = import("react");
const rtlPromise = import("@testing-library/react");
const chartFramePromise = import("@/components/viz/chart-frame");
const sessionGraphsPromise = import("./session-graphs");

async function setup() {
  const React = (await reactPromise).default;
  (globalThis as Record<string, unknown>).React = React;
  const rtl = await rtlPromise;
  return { React, rtl };
}

function metaRowTexts(container: HTMLElement): string[] {
  // De voet is het blok met border-t onderaan het kader; we lezen de
  // afzonderlijke regels (spans met "Label: waarde").
  const foot = container.querySelector(".border-t");
  if (!foot) return [];
  return Array.from(foot.querySelectorAll(":scope > span")).map(
    (s) => s.textContent ?? "",
  );
}

// 1. Alle vier de regels meegegeven → elk met exact label en waarde.
test("ChartFrame toont Periode/Bron/Ontbreekt/Vergelijking exact zoals meegegeven", async () => {
  const { React, rtl } = await setup();
  const { ChartFrame } = await chartFramePromise;
  const view = rtl.render(
    React.createElement(ChartFrame, {
      title: "Verloop van de rit",
      periode: "za 14 juni · 2 u 15 min",
      bronnen: ["vermogensmeter", "hartslagmeting"],
      ontbrekend: "geen temperatuur in dit bestand",
      vergelijkingsbasis: "vergelijkbare rit van 12 juni",
      children: React.createElement("div", null, "grafiek"),
    }),
  );
  try {
    const rows = metaRowTexts(view.container as HTMLElement);
    assert.deepEqual(rows, [
      "Periode: za 14 juni · 2 u 15 min",
      "Bron: vermogensmeter · hartslagmeting",
      "Ontbreekt: geen temperatuur in dit bestand",
      "Vergelijking: vergelijkbare rit van 12 juni",
    ]);
  } finally {
    rtl.cleanup();
  }
});

// 1b. Elke regel verschijnt alléén als hij is meegegeven.
test("ChartFrame laat niet-meegegeven meta-regels weg", async () => {
  const { React, rtl } = await setup();
  const { ChartFrame } = await chartFramePromise;
  const view = rtl.render(
    React.createElement(ChartFrame, {
      title: "Deels gevuld",
      bronnen: ["hartslagmeting"],
      ontbrekend: "vermogen",
      children: React.createElement("div", null, "grafiek"),
    }),
  );
  try {
    const rows = metaRowTexts(view.container as HTMLElement);
    assert.deepEqual(rows, ["Bron: hartslagmeting", "Ontbreekt: vermogen"]);
    const text = view.container.textContent ?? "";
    assert.ok(!text.includes("Periode:"), "geen Periode-regel zonder waarde");
    assert.ok(
      !text.includes("Vergelijking:"),
      "geen Vergelijking-regel zonder waarde",
    );
  } finally {
    rtl.cleanup();
  }
});

// 2. Zonder meta-props géén voet: er wordt niets verzonnen.
test("ChartFrame zonder meta-props rendert géén voet (ook niet bij lege lijst)", async () => {
  const { React, rtl } = await setup();
  const { ChartFrame } = await chartFramePromise;
  const view = rtl.render(
    React.createElement(ChartFrame, {
      title: "Kaal kader",
      bronnen: [],
      ontbrekend: null,
      periode: null,
      vergelijkingsbasis: null,
      children: React.createElement("div", null, "grafiek"),
    }),
  );
  try {
    assert.equal(
      (view.container as HTMLElement).querySelector(".border-t"),
      null,
      "geen meta-voet zonder inhoud",
    );
  } finally {
    rtl.cleanup();
  }
});

// 3. SessionGraphs: rit zonder vermogenskanaal → eerlijke voet met
// "Ontbreekt: vermogen" en alleen echte bronnen.
test("SessionGraphs toont 'Ontbreekt: vermogen' bij rit zonder vermogenskanaal", async () => {
  const { React, rtl } = await setup();
  const { SessionGraphs } = await sessionGraphsPromise;

  const session = {
    id: 1,
    athleteId: 1,
    source: "file",
    type: "endurance",
    sessionDate: "2026-07-20",
    title: "Duurrit",
    durationMin: 120,
    tss: null,
    feelScore: null,
  };
  const detail = {
    streams: { samples: [], speedDerived: false },
    plannedWorkout: null,
  };

  const view = rtl.render(
    React.createElement(SessionGraphs, {
      detail: detail as never,
      session: session as never,
      ftp: 250,
      maxHr: 190,
    }),
  );
  try {
    const rows = metaRowTexts(view.container as HTMLElement);
    assert.ok(
      rows.includes("Ontbreekt: vermogen"),
      "voet benoemt eerlijk het ontbrekende vermogenskanaal: " +
        JSON.stringify(rows),
    );
    assert.ok(
      rows.includes("Bron: hartslagmeting"),
      "alleen echt aanwezige bronnen in de voet: " + JSON.stringify(rows),
    );
    assert.ok(rows.includes("Periode: 120 min"), "periode uit de sessie");
  } finally {
    rtl.cleanup();
  }
});
