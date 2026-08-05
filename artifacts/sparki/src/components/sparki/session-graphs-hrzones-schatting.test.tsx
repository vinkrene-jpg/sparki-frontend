// Borging (taak: eerlijke schattings-melding bij hartslagzones): als er geen
// gemeten maximale hartslag is, toont "Tijd in hartslagzones" een eerlijke
// ontbreekt-regel ("gemeten maximale hartslag — zones op basis van een
// leeftijdsschatting"). Deze test legt vast dat:
// 1. bij alléén hartslagzones (geen vermogenszones) én maxHrEstimated=true de
//    exacte ontbreekt-regel onder het zonekader staat;
// 2. tegenproef: met een gemeten maxHR (maxHrEstimated=false) verschijnt de
//    regel niet.
//
// Harnas: zelfde patroon als session-graphs-meta-voet.test.tsx — happy-dom +
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

// Rit met alléén hartslag: pZones afwezig (geen vermogen), hZones wél
// aanwezig, zodat het hartslagzones-kader rendert. De analyse-uitkomsten zelf
// zijn hier niet onder test.
mock.module("@/lib/stream-analysis", {
  namedExports: {
    powerZoneDistribution: () => null,
    hrZoneDistribution: () => [
      { zone: "Z1", label: "Herstel", seconds: 600, from: 0, to: 130 },
      { zone: "Z2", label: "Duur", seconds: 1800, from: 130, to: 150 },
    ],
    hrDrift: () => null,
    powerFade: () => null,
    pacing: () => null,
    detectIntervals: () => [],
    compareIntervalsWithPlan: () => null,
    assessComparability: () => ({ comparable: false, reasons: [] }),
    hasChannel: (_s: unknown, ch: string) => ch === "heartRate",
  },
});

const reactPromise = import("react");
const rtlPromise = import("@testing-library/react");
const sessionGraphsPromise = import("./session-graphs");

const SCHATTING_REGEL =
  "gemeten maximale hartslag — zones op basis van een leeftijdsschatting";

async function setup() {
  const React = (await reactPromise).default;
  (globalThis as Record<string, unknown>).React = React;
  const rtl = await rtlPromise;
  return { React, rtl };
}

const session = {
  id: 1,
  athleteId: 1,
  source: "file",
  type: "endurance",
  sessionDate: "2026-07-20",
  title: "Duurrit",
  durationMin: 90,
  tss: null,
  feelScore: null,
};
const detail = {
  streams: { samples: [], speedDerived: false },
  plannedWorkout: null,
};

/** Zoekt het kader met de titel "Tijd in hartslagzones" op. */
function hrZoneFrame(container: HTMLElement): HTMLElement | null {
  const titles = Array.from(container.querySelectorAll("*")).filter(
    (el) => el.textContent === "Tijd in hartslagzones" && el.children.length === 0,
  );
  if (titles.length === 0) return null;
  let node: HTMLElement | null = titles[0] as HTMLElement;
  while (node && !node.querySelector('[data-testid="zone-chart"]')) {
    node = node.parentElement;
  }
  return node;
}

function metaRowTexts(frame: HTMLElement): string[] {
  const foot = frame.querySelector(".border-t");
  if (!foot) return [];
  return Array.from(foot.querySelectorAll(":scope > span")).map(
    (s) => s.textContent ?? "",
  );
}

// 1. Geschatte maxHR → exacte ontbreekt-regel onder het zonekader.
test("hartslagzones met geschatte maxHR tonen de eerlijke schattings-regel", async () => {
  const { React, rtl } = await setup();
  const { SessionGraphs } = await sessionGraphsPromise;
  const view = rtl.render(
    React.createElement(SessionGraphs, {
      detail: detail as never,
      session: session as never,
      ftp: null,
      maxHr: 187,
      maxHrEstimated: true,
    }),
  );
  try {
    const frame = hrZoneFrame(view.container as HTMLElement);
    assert.ok(frame, "kader 'Tijd in hartslagzones' rendert");
    const rows = metaRowTexts(frame);
    assert.ok(
      rows.includes(`Ontbreekt: ${SCHATTING_REGEL}`),
      "exacte ontbreekt-regel onder het zonekader: " + JSON.stringify(rows),
    );
  } finally {
    rtl.cleanup();
  }
});

// 2. Tegenproef: gemeten maxHR → géén schattings-regel.
test("hartslagzones met gemeten maxHR tonen de schattings-regel niet", async () => {
  const { React, rtl } = await setup();
  const { SessionGraphs } = await sessionGraphsPromise;
  const view = rtl.render(
    React.createElement(SessionGraphs, {
      detail: detail as never,
      session: session as never,
      ftp: null,
      maxHr: 192,
      maxHrEstimated: false,
    }),
  );
  try {
    const frame = hrZoneFrame(view.container as HTMLElement);
    assert.ok(frame, "kader 'Tijd in hartslagzones' rendert");
    const rows = metaRowTexts(frame);
    assert.ok(
      !rows.some((r) => r.includes("leeftijdsschatting")),
      "geen schattings-regel bij gemeten maxHR: " + JSON.stringify(rows),
    );
    const text = view.container.textContent ?? "";
    assert.ok(
      !text.includes(SCHATTING_REGEL),
      "schattings-regel komt nergens voor bij gemeten maxHR",
    );
  } finally {
    rtl.cleanup();
  }
});
