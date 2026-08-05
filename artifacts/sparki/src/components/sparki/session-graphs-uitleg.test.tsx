// Borging besluit B6 (04-08): de twee-zinnen-uitleg (wat je ziet + wat je
// ermee doet) onder de drawer-grafieken mag bij een redesign nooit stil
// verdwijnen. Test 1 rendert ChartFrame met een uitlegKey en assert de
// wat+doen-regel én de "Hoe wordt dit berekend?"-uitklap. Test 2 rendert
// SessionGraphs (AnalyseRow: hartslagdrift, vermogensverval, pacing) en
// assert dezelfde twee-zinnen-opbouw per analyse-regel.
//
// Harnas: patroon van src/pages/core-analyse.test.tsx — happy-dom +
// module-mocks over het volledige importoppervlak; de uitleg-registry
// (lib/uitleg-content) blijft ECHT zodat de test de werkelijke copy bewaakt.
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

// De analyse-uitkomsten zelf zijn hier niet onder test (dat doet
// stream-analysis.test.ts); we sturen deterministische resultaten zodat
// alle drie de AnalyseRow-regels gegarandeerd renderen.
mock.module("@/lib/stream-analysis", {
  namedExports: {
    powerZoneDistribution: () => null,
    hrZoneDistribution: () => null,
    hrDrift: () => ({ verdict: "laag", driftPct: 2.1 }),
    powerFade: () => ({
      verdict: "stabiel",
      firstThirdW: 210,
      lastThirdW: 208,
      fadePct: -1,
    }),
    pacing: () => ({ verdict: "gelijkmatig", avgW: 205, variabilityPct: 4 }),
    detectIntervals: () => [],
    compareIntervalsWithPlan: () => null,
    assessComparability: () => ({ comparable: false, reasons: [] }),
    hasChannel: (_s: unknown, ch: string) => ch === "power" || ch === "heartRate",
  },
});

const reactPromise = import("react");
const rtlPromise = import("@testing-library/react");
const chartFramePromise = import("@/components/viz/chart-frame");
const sessionGraphsPromise = import("./session-graphs");
const uitlegContentPromise = import("@/lib/uitleg-content");

async function setup() {
  const React = (await reactPromise).default;
  (globalThis as Record<string, unknown>).React = React;
  const rtl = await rtlPromise;
  return { React, rtl };
}

// 1. ChartFrame: twee-zinnen-regel altijd zichtbaar + rekenwijze-uitklap.
test("ChartFrame met uitlegKey toont wat+doen-regel en de rekenwijze-uitklap", async () => {
  const { React, rtl } = await setup();
  const { ChartFrame } = await chartFramePromise;
  const { UITLEG, UITLEG_DOEN } = await uitlegContentPromise;
  const view = rtl.render(
    React.createElement(ChartFrame, {
      title: "Verloop van de rit",
      uitlegKey: "vermogen",
      children: React.createElement("div", null, "grafiek"),
    }),
  );
  try {
    const text = view.container.textContent ?? "";
    // Zin 1: wat je ziet — letterlijk uit de registry.
    assert.ok(
      text.includes(UITLEG.vermogen.wat),
      "wat-zin uit de registry zichtbaar: " + text,
    );
    // Zin 2: wat je ermee doet.
    assert.ok(
      text.includes(UITLEG_DOEN.vermogen),
      "doen-zin uit de registry zichtbaar",
    );
    // De rekenwijze zit achter een uitklap met exact deze aanhef.
    const summary = Array.from(view.container.querySelectorAll("summary")).find(
      (s) => s.textContent === "Hoe wordt dit berekend?",
    );
    assert.ok(summary, "'Hoe wordt dit berekend?'-uitklap aanwezig");
    const details = summary!.closest("details");
    assert.ok(details, "uitklap is een echt details-element");
    assert.ok(
      (details!.textContent ?? "").includes(UITLEG.vermogen.hoe),
      "rekenwijze-tekst uit de registry in de uitklap",
    );
  } finally {
    rtl.cleanup();
  }
});

// 1b. Zonder geldige uitlegKey geen loze uitklap of half blok.
test("ChartFrame zonder bekende uitlegKey rendert géén uitlegblok", async () => {
  const { React, rtl } = await setup();
  const { ChartFrame } = await chartFramePromise;
  const view = rtl.render(
    React.createElement(ChartFrame, {
      title: "Kaal kader",
      children: React.createElement("div", null, "grafiek"),
    }),
  );
  try {
    assert.ok(
      !(view.container.textContent ?? "").includes("Hoe wordt dit berekend?"),
      "geen uitklap zonder uitlegKey",
    );
  } finally {
    rtl.cleanup();
  }
});

// 2. AnalyseRow via SessionGraphs: hartslagdrift, vermogensverval en pacing
// dragen elk hun eigen wat+doen-regel uit de registry.
test("AnalyseRow (drift/verval/pacing) toont per regel de wat+doen-uitleg", async () => {
  const { React, rtl } = await setup();
  const { SessionGraphs } = await sessionGraphsPromise;
  const { UITLEG, UITLEG_DOEN } = await uitlegContentPromise;

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
    const text = view.container.textContent ?? "";
    for (const key of ["hartslagdrift", "vermogensverval", "pacing"] as const) {
      assert.ok(
        text.includes(UITLEG[key].wat),
        `wat-zin ${key} zichtbaar onder de analyse-regel: ` + text.slice(0, 400),
      );
      assert.ok(
        text.includes(UITLEG_DOEN[key]),
        `doen-zin ${key} zichtbaar onder de analyse-regel`,
      );
    }
    // De regels zelf staan er ook (labels + echte cijfers uit de verdicts).
    assert.ok(text.includes("Hartslagdrift"));
    assert.ok(text.includes("Vermogensverval"));
    assert.ok(text.includes("Pacing"));
  } finally {
    rtl.cleanup();
  }
});
