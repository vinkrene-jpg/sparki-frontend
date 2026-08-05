// Taak 599 — Maandkalender rond maandgrenzen.
//
// De maandkalender op /kalender bouwt een 42-cels rooster met LOKALE datums
// (maandag-start) en spreidt meerdaagse leefagenda-items over hun hele
// periode. Deze node-page-test legt de grenzen vast die stilletjes kunnen
// verschuiven: maandag-uitlijning (maand die op ma/zo begint), jaarovergang
// dec→jan, DST-maanden (mrt/okt, TZ=Europe/Amsterdam via het test-script) en
// een meerdaags leefagenda-item over een maandgrens heen.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

mock.module("wouter", {
  namedExports: {
    useLocation: () => ["/kalender", () => {}],
    useSearch: () => "",
    useRoute: () => [false, null],
    useParams: () => ({}),
    Link: (props: any) => {
      const React = (globalThis as any).React;
      return React.createElement("a", { href: props.href, className: props.className }, props.children);
    },
  },
});

// Shell en secundaire UI buiten scope: alleen het rooster telt hier.
mock.module("@/components/sparki/screen-shell", {
  namedExports: {
    ScreenShell: (props: any) => {
      const React = (globalThis as any).React;
      return React.createElement("div", null, props.children);
    },
  },
});

mock.module("@/components/sparki/ui", {
  namedExports: {
    SectionLabel: (props: any) => {
      const React = (globalThis as any).React;
      return React.createElement("p", null, props.title);
    },
    ACCENT: "#78d2e6",
  },
});

mock.module("@/components/sparki/data-state-notice", {
  namedExports: { DataStateNotice: () => null },
});

const noopMutation = () => ({ isPending: false, mutate: () => {}, mutateAsync: async () => ({}), reset: () => {} });
const noopQuery = () => ({ data: undefined, isLoading: false, isError: false, error: null, refetch: () => {} });

// Roostervenster dat de kalender opvraagt (van/tot) — de test bewaakt dat het
// venster het 42-cels rooster exact dekt.
let planRangeVensters: Array<{ van: string; tot: string }> = [];
mock.module("@/hooks/use-training-plan", {
  namedExports: {
    usePlanWindow: () => ({ data: [], isLoading: false }),
    usePlanRange: (van: string, tot: string) => {
      planRangeVensters.push({ van, tot });
      return { data: [], isLoading: false };
    },
    useGeneratePlan: noopMutation,
    useApplyProposal: noopMutation,
    useCancelWorkout: noopMutation,
  },
});

mock.module("@/hooks/use-races", {
  namedExports: { useRaces: () => ({ data: [], isLoading: false }) },
});

let lifeEventsData: any[] = [];
mock.module("@/hooks/use-life-events", {
  namedExports: {
    useLifeEvents: () => ({ data: lifeEventsData, isLoading: false }),
    useAddLifeEvent: noopMutation,
    useDeleteLifeEvent: noopMutation,
  },
});

mock.module("@/hooks/use-data-state", {
  namedExports: { useDataState: noopQuery },
});

mock.module("@/lib/dev", {
  namedExports: { DEV_PREVIEW: false, useDevPreview: () => false, getDevAthleteId: () => 1 },
});

mock.module("@/lib/api", {
  namedExports: { apiFetch: async () => ({}), API_BASE: "" },
});

mock.module("@tanstack/react-query", {
  namedExports: {
    useQuery: () => ({}),
    useMutation: () => ({}),
    useQueryClient: () => ({ invalidateQueries: () => {} }),
    QueryClient: class {},
    QueryClientProvider: ({ children }: any) => children,
  },
});

const reactPromise = import("react");
const rtlPromise = import("@testing-library/react");
const componentPromise = import("./kalender");
const shellLibPromise = import("@/lib/commercial-shell");

const MAAND_INDEX: Record<string, number> = {
  januari: 0, februari: 1, maart: 2, april: 3, mei: 4, juni: 5,
  juli: 6, augustus: 7, september: 8, oktober: 9, november: 10, december: 11,
};

async function renderPage() {
  const React = (await reactPromise).default;
  (globalThis as any).React = React;
  const rtl = await rtlPromise;
  const { default: KalenderPage } = await componentPromise;
  const utils = rtl.render(React.createElement(KalenderPage));
  return { ...utils, rtl, React };
}

function huidigeMaand(view: Awaited<ReturnType<typeof renderPage>>): { jaar: number; maand: number } {
  const span = view.container.querySelector("span.capitalize");
  const titel = (span?.textContent ?? "").trim().toLowerCase();
  const [naam, jaarStr] = titel.split(/\s+/);
  const maand = MAAND_INDEX[naam ?? ""];
  const jaar = Number(jaarStr);
  assert.ok(maand !== undefined && Number.isFinite(jaar), `Maandtitel leesbaar: "${titel}"`);
  return { jaar, maand };
}

// Bladert deterministisch naar een doelmaand — de test is daarmee onafhankelijk
// van de echte datum waarop hij draait.
function gaNaar(view: Awaited<ReturnType<typeof renderPage>>, jaar: number, maand: number) {
  const { fireEvent } = view.rtl;
  for (let i = 0; i < 60; i++) {
    const nu = huidigeMaand(view);
    const diff = (jaar - nu.jaar) * 12 + (maand - nu.maand);
    if (diff === 0) return;
    const label = diff > 0 ? "Volgende maand" : "Vorige maand";
    const knop = view.container.querySelector(`button[aria-label="${label}"]`);
    assert.ok(knop, `Knop "${label}" aanwezig`);
    fireEvent.click(knop!);
  }
  assert.fail(`Doelmaand ${jaar}-${maand + 1} niet bereikt binnen 60 stappen`);
}

function dagIsos(view: Awaited<ReturnType<typeof renderPage>>): string[] {
  return Array.from(view.container.querySelectorAll('button[aria-label^="Dag "]')).map(
    (b) => b.getAttribute("aria-label")!.slice(4),
  );
}

// Roosterinvarianten die op ÉLKE maand moeten gelden: 42 unieke cellen, start
// op maandag op of vóór de 1e, en cel i is exact de lokale dag start+i (dus
// geen milliseconde-rekenwerk dat rond DST een dag dupliceert of overslaat).
async function assertRooster(view: Awaited<ReturnType<typeof renderPage>>, jaar: number, maand: number) {
  const lib = await shellLibPromise;
  const isos = dagIsos(view);
  assert.equal(isos.length, 42, "Rooster heeft exact 42 cellen");
  assert.equal(new Set(isos).size, 42, "Geen dubbele dagen in het rooster");

  const [sy, sm, sd] = isos[0]!.split("-").map(Number);
  const start = new Date(sy!, sm! - 1, sd!);
  assert.equal(start.getDay(), 1, `Eerste cel ${isos[0]} is een maandag`);

  const eerste = lib.localISODate(new Date(jaar, maand, 1));
  assert.ok(isos[0]! <= eerste, "Rooster start op of vóór de 1e van de maand");
  assert.ok(isos.includes(eerste), "De 1e van de maand staat in het rooster");
  assert.ok(isos.includes(lib.localISODate(new Date(jaar, maand + 1, 0))), "De laatste dag van de maand staat in het rooster");

  for (let i = 0; i < 42; i++) {
    const verwacht = lib.localISODate(new Date(sy!, sm! - 1, sd! + i));
    assert.equal(isos[i], verwacht, `Cel ${i} is de opeenvolgende lokale dag ${verwacht}`);
  }

  // Het opgevraagde planvenster dekt exact dit rooster.
  const laatste = planRangeVensters[planRangeVensters.length - 1];
  assert.ok(laatste, "usePlanRange is aangeroepen");
  assert.equal(laatste!.van, isos[0], "Planvenster begint bij de eerste roostercel");
  assert.equal(laatste!.tot, isos[41], "Planvenster eindigt bij de laatste roostercel");
}

// 1) Maandag-uitlijning: juni 2026 begint op maandag → rooster start op de 1e.
test("maandkalender: maand die op maandag begint start het rooster op de 1e", async () => {
  lifeEventsData = [];
  planRangeVensters = [];
  const view = await renderPage();
  try {
    gaNaar(view, 2026, 5);
    await assertRooster(view, 2026, 5);
    assert.equal(dagIsos(view)[0], "2026-06-01", "Juni 2026 (start op ma) begint zonder aanloopdagen");
  } finally {
    view.rtl.cleanup();
  }
});

// 2) Maandag-uitlijning: februari 2026 begint op zondag → rooster start zes
// dagen eerder, op maandag 26 januari (niet één dag te vroeg of te laat).
test("maandkalender: maand die op zondag begint krijgt zes aanloopdagen", async () => {
  lifeEventsData = [];
  planRangeVensters = [];
  const view = await renderPage();
  try {
    gaNaar(view, 2026, 1);
    await assertRooster(view, 2026, 1);
    assert.equal(dagIsos(view)[0], "2026-01-26", "Februari 2026 (start op zo) begint op maandag 26 januari");
  } finally {
    view.rtl.cleanup();
  }
});

// 3) Jaarovergang dec→jan: het decemberrooster loopt door in januari 2027
// zonder verschoven of verdwenen dagen.
test("maandkalender: jaarovergang december 2026 → januari 2027 blijft aaneengesloten", async () => {
  lifeEventsData = [];
  planRangeVensters = [];
  const view = await renderPage();
  try {
    gaNaar(view, 2026, 11);
    await assertRooster(view, 2026, 11);
    const isos = dagIsos(view);
    assert.equal(isos[0], "2026-11-30", "December 2026 start op maandag 30 november");
    assert.ok(isos.includes("2026-12-31"), "Oudjaarsdag aanwezig");
    assert.ok(isos.includes("2027-01-01"), "Nieuwjaarsdag aanwezig");
    assert.equal(isos[41], "2027-01-10", "Rooster eindigt op zondag 10 januari 2027");
  } finally {
    view.rtl.cleanup();
  }
});

// 4) DST-maanden (Europe/Amsterdam): oktober 2026 (wintertijd-overgang 25 okt)
// en maart 2027 (zomertijd-overgang 28 mrt) mogen geen dag dupliceren of
// overslaan. assertRooster bewijst dat elke cel de exacte lokale dag is.
test("maandkalender: DST-maanden oktober en maart verschuiven geen dagen", async () => {
  lifeEventsData = [];
  planRangeVensters = [];
  const view = await renderPage();
  try {
    gaNaar(view, 2026, 9);
    await assertRooster(view, 2026, 9);
    let isos = dagIsos(view);
    assert.equal(isos[0], "2026-09-28", "Oktober 2026 start op maandag 28 september");
    assert.ok(isos.includes("2026-10-25"), "Wintertijd-zondag 25 oktober aanwezig (precies één keer via uniciteit)");

    gaNaar(view, 2027, 2);
    await assertRooster(view, 2027, 2);
    isos = dagIsos(view);
    assert.equal(isos[0], "2027-03-01", "Maart 2027 (start op ma) begint op de 1e");
    assert.ok(isos.includes("2027-03-28"), "Zomertijd-zondag 28 maart aanwezig");
    assert.equal(isos[41], "2027-04-11", "Rooster eindigt op zondag 11 april 2027");
  } finally {
    view.rtl.cleanup();
  }
});

// 5) Meerdaags leefagenda-item over de maand- én jaargrens (28 dec t/m 3 jan):
// hoort op élke dag in zijn periode een stip te tonen — in beide maandroosters
// — en nergens daarbuiten.
test("maandkalender: meerdaags leefagenda-item over een maandgrens dekt elke dag in beide maanden", async () => {
  lifeEventsData = [
    {
      id: 1,
      kind: "familie",
      title: "Wintervakantie",
      startDate: "2026-12-28",
      endDate: "2027-01-03",
      impact: "minder_tijd",
    },
  ];
  planRangeVensters = [];
  const view = await renderPage();
  try {
    const heeftLevenStip = (iso: string) => {
      const knop = view.container.querySelector(`button[aria-label="Dag ${iso}"]`);
      assert.ok(knop, `Dagcel ${iso} aanwezig`);
      return knop!.querySelector(".bg-slate-400") !== null;
    };

    // December-rooster: 28 dec t/m 3 jan gemarkeerd, randen eromheen niet.
    gaNaar(view, 2026, 11);
    for (const iso of ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]) {
      assert.ok(heeftLevenStip(iso), `Leefagenda-stip op ${iso}`);
    }
    assert.ok(!heeftLevenStip("2026-12-27"), "Geen stip op de dag vóór de periode");
    assert.ok(!heeftLevenStip("2027-01-04"), "Geen stip op de dag ná de periode");

    // Januari-rooster: dezelfde dagen blijven gemarkeerd na doorbladeren.
    gaNaar(view, 2027, 0);
    for (const iso of ["2026-12-28", "2026-12-31", "2027-01-01", "2027-01-03"]) {
      assert.ok(heeftLevenStip(iso), `Leefagenda-stip op ${iso} in het januarirooster`);
    }
    assert.ok(!heeftLevenStip("2027-01-04"), "Geen stip op 4 januari in het januarirooster");
  } finally {
    view.rtl.cleanup();
  }
});
