// Bewaakt dat deep-links naar de Routes-tabbladen goed blijven landen.
// /routes is een Strava-stijl tabbalk (Maken/GPX/Bewaard/Ontdek/Instellingen):
// - ?view=… activeert het juiste tabblad
// - oude deep-links (?route=, ?nav=, ?ritopties=) zonder view landen op Bewaard
// - elke tab wijst via aria-controls naar een bestaand tabpanel
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// Instelbare zoekstring — de pagina leest 'm via wouter's useSearch.
let currentSearch = "";
const navCalls: string[] = [];

mock.module("wouter", {
  namedExports: {
    useSearch: () => currentSearch,
    useLocation: () => [
      "/routes",
      (href: string) => {
        navCalls.push(href);
      },
    ],
    Link: (props: { href?: string; children?: unknown; className?: string }) =>
      (globalThis as { React?: { createElement: CallableFunction } }).React!
        .createElement(
          "a",
          { href: props.href, className: props.className },
          props.children as never,
        ),
  },
});

// Zware panelen: alleen een herkenbare marker renderen — de tabellogica van
// de pagina zelf is wat we testen.
mock.module("@/components/sparki/commercial-shell", {
  namedExports: {
    CommercialShell: (props: { children?: unknown }) =>
      (globalThis as { React?: { createElement: CallableFunction } }).React!
        .createElement("div", null, props.children as never),
  },
});
mock.module("@/components/sparki/route-panel", {
  namedExports: {
    RoutePanel: (props: { view: string }) =>
      (globalThis as { React?: { createElement: CallableFunction } }).React!
        .createElement("div", null, `route-panel:${props.view}`),
  },
});
mock.module("@/components/sparki/route-library", {
  namedExports: {
    RouteLibrary: () =>
      (globalThis as { React?: { createElement: CallableFunction } }).React!
        .createElement("div", null, "route-library"),
  },
});
mock.module("@/components/sparki/nav-settings-panel", {
  namedExports: {
    NavSettingsPanel: () =>
      (globalThis as { React?: { createElement: CallableFunction } }).React!
        .createElement("div", null, "nav-settings-panel"),
  },
});
mock.module("@/components/sparki/route-discover", {
  namedExports: {
    RouteDiscover: () =>
      (globalThis as { React?: { createElement: CallableFunction } }).React!
        .createElement("div", null, "route-discover"),
  },
});
mock.module("@/hooks/use-feature-flag", {
  namedExports: {
    useFeatureFlag: () => true,
  },
});
mock.module("@/lib/sfeer", {
  namedExports: {
    dagSfeer: () => ({}),
  },
});

const reactPromise = import("react");
const rtlPromise = import("@testing-library/react");
const componentPromise = import("./routes");

async function renderPage(search: string) {
  const React = (await reactPromise).default;
  (globalThis as Record<string, unknown>).React = React;
  currentSearch = search;
  navCalls.length = 0;
  const rtl = await rtlPromise;
  const { default: RoutesPage } = await componentPromise;
  const utils = rtl.render(React.createElement(RoutesPage));
  return { ...utils, rtl };
}

function actieveTab(container: HTMLElement): string | null {
  const knop = container.querySelector('[role="tab"][aria-selected="true"]');
  return knop?.id.replace(/^tabknop-/, "") ?? null;
}

const ALLE_TABS = ["maken", "gpx", "bewaard", "ontdek", "instellingen"];

// ?view=… activeert het juiste tabblad, met het bijbehorende paneel zichtbaar.
for (const tab of ALLE_TABS) {
  test(`?view=${tab} activeert tabblad ${tab}`, async () => {
    const view = await renderPage(`view=${tab}`);
    try {
      assert.equal(actieveTab(view.container), tab);
      // Actief paneel is niet hidden en bevat de bijbehorende inhoudsmarker.
      const paneel = view.container.querySelector(`#tab-${tab}`);
      assert.ok(paneel, `tabpanel #tab-${tab} bestaat`);
      assert.ok(!paneel!.hasAttribute("hidden"), "actief paneel is zichtbaar");
      const marker =
        tab === "instellingen"
          ? "nav-settings-panel"
          : tab === "ontdek"
            ? "route-discover"
            : tab === "bewaard"
              ? "route-library"
              : `route-panel:${tab}`;
      assert.ok(
        (paneel!.textContent ?? "").includes(marker),
        `paneel toont ${marker}`,
      );
    } finally {
      view.rtl.cleanup();
    }
  });
}

// Oude deep-links zonder view landen op Bewaard — daar leven de routekaarten.
for (const oud of ["route=42", "nav=1", "ritopties=1", ""]) {
  test(`?${oud || "(geen parameters)"} zonder view landt op Bewaard`, async () => {
    const view = await renderPage(oud);
    try {
      assert.equal(actieveTab(view.container), "bewaard");
      const paneel = view.container.querySelector("#tab-bewaard");
      assert.ok(paneel && !paneel.hasAttribute("hidden"));
      assert.ok((paneel!.textContent ?? "").includes("route-library"));
    } finally {
      view.rtl.cleanup();
    }
  });
}

// Onbekende view valt óók terug op Bewaard (nooit een leeg scherm).
test("?view=onzin valt terug op Bewaard", async () => {
  const view = await renderPage("view=onzin");
  try {
    assert.equal(actieveTab(view.container), "bewaard");
  } finally {
    view.rtl.cleanup();
  }
});

// ARIA-koppeling: elke tab wijst via aria-controls naar een bestaand
// tabpanel, en elk paneel wijst via aria-labelledby terug naar zijn tabknop.
test("elke tab heeft een bestaand tabpanel (aria-koppeling rond)", async () => {
  const view = await renderPage("view=gpx");
  try {
    const tabs = Array.from(
      view.container.querySelectorAll<HTMLElement>('[role="tab"]'),
    );
    assert.equal(tabs.length, ALLE_TABS.length, "vijf tabs aanwezig");
    for (const tabKnop of tabs) {
      const doelId = tabKnop.getAttribute("aria-controls");
      assert.ok(doelId, `tab ${tabKnop.id} heeft aria-controls`);
      const paneel = view.container.querySelector<HTMLElement>(`#${doelId}`);
      assert.ok(paneel, `tabpanel #${doelId} bestaat voor ${tabKnop.id}`);
      assert.equal(paneel!.getAttribute("role"), "tabpanel");
      assert.equal(
        paneel!.getAttribute("aria-labelledby"),
        tabKnop.id,
        "paneel wijst terug naar zijn tabknop",
      );
    }
  } finally {
    view.rtl.cleanup();
  }
});

// Tab-wissel schrijft alleen ?view= — oude deep-linkparameters gaan niet mee.
test("tabklik navigeert naar schone ?view=-URL", async () => {
  const view = await renderPage("route=42");
  try {
    const gpxKnop = view.container.querySelector<HTMLElement>("#tabknop-gpx");
    assert.ok(gpxKnop);
    view.rtl.fireEvent.click(gpxKnop!);
    assert.deepEqual(navCalls, ["/routes?view=gpx"]);
  } finally {
    view.rtl.cleanup();
  }
});
