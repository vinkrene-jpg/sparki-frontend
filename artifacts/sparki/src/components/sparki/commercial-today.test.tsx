// Regressietests voor het commerciële Vandaag-scherm op de centrale
// designsysteem-fundering (donker; flag: commercial_shell). Legt vast:
//   1. de inhoudshiërarchie: sfeerkop/dagcontext → dominante coachboodschap →
//      weeknavigatie (DsWeek) → training van vandaag → herstel & gereedheid →
//      seizoen; precies één data-atmosphere-element en precies één primaire
//      actie; de foto is decoratief (alt="" + aria-hidden);
//   2. de lege trainingstoestand: eerlijke melding + actie, geen verzinsels;
//   3. ontbrekende hersteldata: één eerlijke foutmelding mét herstelactie in
//      de kop, géén herstelsectie, géén data-atmosphere;
//   4. een dashboardfout zonder fallbackdata: eerlijke melding + opnieuw
//      proberen, geen week- of trainingscijfers;
//   5. een dashboardfout mét oude cache (isError + stale data): geen stale
//      planweek/weekdagen/fase — fout wint altijd van cache;
//   6. de mobiele navigatie (DsMobileNav): alle items, actieve tab, navigatie.
// Mentale training komt op dit scherm niet voor — geen sterren-invuller (n.v.t.).
//
// Run with: pnpm --filter @workspace/sparki run test:commercial-today

import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// ---------------------------------------------------------------------------
// Bestuurbare mocks. mock.module moet vóór de (lazy) import van
// commercial-shell.tsx staan; statische imports zouden gehesen worden en de
// echte modules (incl. @/lib/api) laden.
// ---------------------------------------------------------------------------

type HookResult = {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

let stateResult: HookResult;
let dashResult: HookResult;
let racesResult: { data: unknown };
const navCalls: string[] = [];

mock.module("@/hooks/use-sparki-state", {
  namedExports: {
    useSparkiState: () => stateResult,
  },
});

mock.module("@/hooks/use-athlete-dashboard", {
  namedExports: {
    useAthleteDashboard: () => dashResult,
  },
});

mock.module("@/hooks/use-races", {
  namedExports: {
    useRaces: () => racesResult,
  },
});

mock.module("wouter", {
  namedExports: {
    useLocation: () => [
      "/vandaag",
      (href: string) => {
        navCalls.push(href);
      },
    ],
    Link: (props: { href?: string; children?: unknown; className?: string }) =>
      (globalThis as { React?: { createElement: CallableFunction } }).React!
        .createElement("a", { href: props.href, className: props.className },
          props.children as never),
  },
});

// WP-R1 maakte de shell rol-bewust: useUserProfile + TodayDebugPanel kwamen
// bij het import-oppervlak. Mocks moeten dat volledige oppervlak dekken
// (@/lib/dev leest import.meta.env op moduleniveau — bestaat niet in node).
mock.module("@/contexts/UserContext", {
  namedExports: {
    useUserProfile: () => ({ profile: { activeRole: "athlete" } }),
    UserProvider: ({ children }: { children: unknown }) => children,
  },
});

mock.module("@/components/sparki/role-today", {
  namedExports: { TodayDebugPanel: () => null },
});

mock.module("@/lib/dev", {
  namedExports: { DEV_PREVIEW: false, useDevPreview: () => false, getDevAthleteId: () => 1 },
});

// @/lib/version en @/lib/api lezen óók import.meta.env op moduleniveau.
mock.module("@/lib/version", {
  namedExports: { APP_VERSION: "test", BUILD_SHA: "test", IS_PRODUCTION_BUILD: false },
});

mock.module("@tanstack/react-query", {
  namedExports: {
    useQuery: () => ({}),
    useMutation: () => ({}),
    useQueryClient: () => ({ invalidateQueries: () => {} }),
    QueryClient: class {},
    QueryClientProvider: ({ children }: { children: unknown }) => children,
  },
});

mock.module("@clerk/react", {
  namedExports: {
    useUser: () => ({ isSignedIn: true, isLoaded: true, user: { id: "user_1" } }),
  },
});

mock.module("@/lib/api", {
  namedExports: {
    API_BASE: "",
    VERSION_BLOCKED_EVENT: "sparki:version-blocked",
    getVersionBlockMessage: () => null,
    apiFetch: async () => ({}),
  },
});

// Lazy imports — pas ná de mocks hierboven.
const reactPromise = import("react");
const rtlPromise = import("@testing-library/react");
const libPromise = import("@/lib/commercial-shell");
const componentPromise = import("./commercial-shell");

// ---------------------------------------------------------------------------
// Vaste, echte-vorm fixtures (geen verzonnen scores — de echte State-shape).
// ---------------------------------------------------------------------------

const STATUS_ZIN = "Je lichaam is goed hersteld — vandaag kan er wat.";

function stateData() {
  return {
    band: "belastbaar",
    status: STATUS_ZIN,
    movement: { label: "Je vorm stijgt" },
    why: [
      { kind: "slaap", label: "Slaap", reading: "Gemiddeld 7,8 uur deze week" },
    ],
    missing: ["HRV-metingen"],
    confidenceLabel: "redelijk",
  };
}

function weekDates(localISODate: (d?: Date) => string): string[] {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    out.push(
      localISODate(
        new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - mondayOffset + i,
        ),
      ),
    );
  }
  return out;
}

function dashData(opts: {
  withWorkout: boolean;
  localISODate: (d?: Date) => string;
}) {
  const dates = weekDates(opts.localISODate);
  const todayISO = opts.localISODate();
  return {
    todayWorkout: opts.withWorkout
      ? {
          title: "Duurblok met tempo",
          description: "Rustig aanrijden, daarna twee tempoblokken.",
          targetDurationMin: 75,
          structure: {
            week: 3,
            phase: "build",
            rationale: { supportsGoal: "Duurvermogen richting je hoofddoel" },
            blocks: [
              { kind: "warmup", durationMin: 15, zone: 1 },
              { kind: "interval", durationMin: 5, zone: 4, reps: 4 },
              { kind: "cooldown", durationMin: 10, zone: 1 },
            ],
          },
          planDetails: { goal: "Duurvermogen" },
        }
      : null,
    weekTSS: dates.map((date) => ({
      date,
      tss: date === todayISO ? 0 : date === dates[0] ? 75.4 : 0,
    })),
  };
}

function okResult(data: unknown): HookResult {
  return { data, isLoading: false, isError: false, refetch: () => {} };
}

function errorResult(onRetry: () => void): HookResult {
  return { data: undefined, isLoading: false, isError: true, refetch: onRetry };
}

async function renderToday() {
  const React = (await reactPromise).default;
  (globalThis as Record<string, unknown>).React = React;
  const rtl = await rtlPromise;
  const { CommercialToday } = await componentPromise;
  const utils = rtl.render(React.createElement(CommercialToday));
  return { ...utils, rtl, React };
}

// ---------------------------------------------------------------------------
// 1. Inhoudshiërarchie met volledige echte data
// ---------------------------------------------------------------------------
test("hiërarchie: kop → boodschap → week → training → herstel → seizoen", async () => {
  const lib = await libPromise;
  stateResult = okResult(stateData());
  dashResult = okResult(dashData({ withWorkout: true, localISODate: lib.localISODate }));
  racesResult = { data: [{ name: "NK Weg", raceDate: "2099-09-16" }] };

  const view = await renderToday();
  try {
    const html = view.container.innerHTML;
    const text = view.container.textContent ?? "";

    // Kop: h1 + dagcontext + woordmerk.
    const h1 = view.container.querySelector("h1");
    assert.ok(h1 && h1.textContent === "Vandaag", "paginakop Vandaag");
    assert.ok(text.includes("trainingsweek 3"), "dagcontext met planweek");
    assert.ok(text.includes("SPARKI"), "woordmerk aanwezig");

    // Decoratieve foto: alt="" + aria-hidden, nooit betekenisdragend.
    // Bron komt uit de Atmosphere Library (VANDAAG_HERO) — webp + png-fallback.
    const foto = view.container.querySelector("picture img[src^='/atmosphere/']");
    assert.ok(foto, "wielerfoto aanwezig als sfeerlaag");
    const webpBron = view.container.querySelector(
      "picture source[type='image/webp'][srcset^='/atmosphere/']",
    );
    assert.ok(webpBron, "webp-variant aanwezig als primaire bron");
    assert.equal(foto!.getAttribute("alt"), "", "foto is decoratief (alt leeg)");
    assert.equal(foto!.getAttribute("aria-hidden"), "true", "foto aria-hidden");

    // Vaste volgorde van de inhoud.
    const orde = [
      STATUS_ZIN,
      lib.COMMERCIAL_COPY.weekTitle,
      lib.COMMERCIAL_COPY.trainingTitle,
      lib.COMMERCIAL_COPY.herstelTitle,
      lib.COMMERCIAL_COPY.seasonTitle,
    ].map((s) => html.indexOf(s));
    for (const idx of orde) assert.ok(idx >= 0, "alle secties aanwezig");
    for (let i = 1; i < orde.length; i++) {
      assert.ok(orde[i]! > orde[i - 1]!, `sectievolgorde vast (${i})`);
    }

    // Precies één sfeerlaag-element, met de trainingstint (band + training).
    const atmos = view.container.querySelectorAll("[data-atmosphere]");
    assert.equal(atmos.length, 1, "precies één data-atmosphere-element");
    assert.equal(atmos[0]!.getAttribute("data-atmosphere"), "training");

    // Weeknavigatie: 7 dagen als échte knoppen (gericht herstel 01-08-2026:
    // een dag-tik opent die dag in de trainingskalender — nooit stil).
    const dagen = view.container.querySelectorAll(
      "[role='group'][aria-label*='trainingskalender'] button[aria-pressed]",
    );
    assert.equal(dagen.length, 7, "DsWeek toont 7 dagen");
    navCalls.length = 0;
    view.rtl.fireEvent.click(dagen[0]!);
    assert.equal(navCalls.length, 1, "dag-tik navigeert");
    assert.ok(
      /^\/train\?dag=\d{4}-\d{2}-\d{2}$/.test(navCalls[0]!),
      `dag-tik opent de kalender op die dag (${navCalls[0]})`,
    );
    navCalls.length = 0;
    assert.ok(text.includes("75"), "echte weekbelasting (75) zichtbaar");
    const vandaag = view.container.querySelector("[aria-current='date']");
    assert.ok(vandaag, "vandaag gemarkeerd in DsWeek");
    assert.ok(
      vandaag!.getAttribute("aria-label")!.includes("training"),
      "vandaag met gepland werk telt als trainingsdag",
    );

    // Precies één primaire actie (44px-knop in de trainingskaart).
    // Dag-tabs (aria-pressed) tellen niet mee: hun actieve tint is een
    // selectiestatus, geen primaire actie.
    const primaries = Array.from(
      view.container.querySelectorAll("button:not([aria-pressed])"),
    ).filter((b) => b.className.includes("bg-accent-cyan"));
    assert.equal(primaries.length, 1, "precies één primaire knop");
    assert.ok(
      primaries[0]!.textContent!.includes(
        lib.COMMERCIAL_COPY.trainingPrimaryMobile,
      ),
      "primaire actie hoort bij de training",
    );

    // Herstel & gereedheid: echte band, onderbouwing, ontbrekend, zekerheid.
    assert.ok(text.includes("Belastbaar"), "echte band zichtbaar");
    assert.ok(text.includes(lib.COMMERCIAL_COPY.onderbouwing), "uitklap aanwezig");
    assert.ok(text.includes("Gemiddeld 7,8 uur deze week"), "echt signaal");
    assert.ok(text.includes("Ontbreekt nog: HRV-metingen"), "eerlijk ontbrekend");
    assert.ok(text.includes("Zekerheid: redelijk"), "zekerheid zichtbaar");

    // Trend + seizoen.
    assert.ok(text.includes("Je vorm stijgt"), "trendregel zichtbaar");
    assert.ok(text.includes("Hoofddoel: NK Weg"), "seizoenregel met echt doel");
  } finally {
    view.rtl.cleanup();
  }
});

// ---------------------------------------------------------------------------
// 2. Lege trainingstoestand — eerlijk, met actie, zonder verzinsels
// ---------------------------------------------------------------------------
test("lege training: eerlijke melding + actie, geen primaire knop", async () => {
  const lib = await libPromise;
  stateResult = okResult(stateData());
  dashResult = okResult(dashData({ withWorkout: false, localISODate: lib.localISODate }));
  racesResult = { data: [] };
  navCalls.length = 0;

  const view = await renderToday();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes(lib.COMMERCIAL_COPY.noTraining), "lege melding exact");
    assert.ok(!text.includes("Duurblok"), "geen verzonnen training");

    // Geen training ⇒ nergens een primaire knop (maximaal één blijft waar).
    // Dag-tabs (aria-pressed) zijn selectiestatus, geen primaire actie.
    const primaries = Array.from(
      view.container.querySelectorAll("button:not([aria-pressed])"),
    ).filter((b) => b.className.includes("bg-accent-cyan"));
    assert.equal(primaries.length, 0, "geen primaire knop zonder training");

    // De actie uit de lege toestand navigeert naar de bestaande planflow.
    const actie = Array.from(view.container.querySelectorAll("button")).find(
      (b) => b.textContent === lib.COMMERCIAL_COPY.noTrainingAction,
    );
    assert.ok(actie, "actie in lege toestand aanwezig");
    view.rtl.fireEvent.click(actie!);
    assert.deepEqual(navCalls, [lib.COMMERCIAL_COPY.noTrainingActionHref]);

    // Vandaag zonder plan en zonder belasting is een eerlijk lege dag.
    const vandaag = view.container.querySelector("[aria-current='date']");
    assert.ok(vandaag, "vandaag blijft gemarkeerd");
    assert.ok(
      vandaag!.getAttribute("aria-label")!.includes("geen training"),
      "vandaag zonder plan is 'geen training' (nooit verzonnen)",
    );
  } finally {
    view.rtl.cleanup();
  }
});

// ---------------------------------------------------------------------------
// 3. Ontbrekende hersteldata — één eerlijke fout, geen sfeer, geen sectie
// ---------------------------------------------------------------------------
test("toestandsfout: één eerlijke melding + retry, geen herstelsectie", async () => {
  const lib = await libPromise;
  let retries = 0;
  stateResult = errorResult(() => {
    retries += 1;
  });
  dashResult = okResult(dashData({ withWorkout: true, localISODate: lib.localISODate }));
  racesResult = { data: [] };

  const view = await renderToday();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes(lib.COMMERCIAL_COPY.stateError), "eerlijke foutmelding");
    assert.ok(
      !text.includes(lib.COMMERCIAL_COPY.herstelTitle),
      "geen herstelsectie zonder echte waarden",
    );
    assert.ok(!text.includes("Belastbaar"), "geen bandlabel zonder data");
    assert.ok(!text.includes("Zekerheid:"), "geen zekerheid zonder data");
    assert.equal(
      view.container.querySelectorAll("[data-atmosphere]").length,
      0,
      "fouttoestand draagt geen sfeerlaag",
    );

    const retry = Array.from(view.container.querySelectorAll("button")).find(
      (b) => b.textContent === lib.COMMERCIAL_COPY.retry,
    );
    assert.ok(retry, "herstelactie aanwezig");
    view.rtl.fireEvent.click(retry!);
    assert.equal(retries, 1, "retry roept refetch aan");
  } finally {
    view.rtl.cleanup();
  }
});

// ---------------------------------------------------------------------------
// 4. Dashboardfout — eerlijke melding, geen fallback- of restdata
// ---------------------------------------------------------------------------
test("dashboardfout: eerlijke melding + retry, geen week- of trainingsdata", async () => {
  const lib = await libPromise;
  let retries = 0;
  stateResult = okResult(stateData());
  dashResult = errorResult(() => {
    retries += 1;
  });
  racesResult = { data: [] };

  const view = await renderToday();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes(lib.COMMERCIAL_COPY.trainingError), "eerlijke fout");
    assert.ok(
      !text.includes(lib.COMMERCIAL_COPY.weekTitle),
      "geen weeksectie bij dashboardfout (geen dubbele foutkaarten)",
    );
    assert.equal(
      view.container.querySelectorAll("[role='listitem']").length,
      0,
      "geen weekdagen zonder data",
    );
    assert.ok(!text.includes("Duurblok"), "geen fallback-training");
    // De coachboodschap (andere bron) blijft gewoon eerlijk zichtbaar.
    assert.ok(text.includes(STATUS_ZIN), "coachboodschap blijft staan");

    const retry = Array.from(view.container.querySelectorAll("button")).find(
      (b) => b.textContent === lib.COMMERCIAL_COPY.retry,
    );
    assert.ok(retry, "herstelactie aanwezig");
    view.rtl.fireEvent.click(retry!);
    assert.equal(retries, 1, "retry roept dashboard-refetch aan");
  } finally {
    view.rtl.cleanup();
  }
});

// ---------------------------------------------------------------------------
// 4b. Dashboardfout mét oude cache — fout wint altijd van stale data
// ---------------------------------------------------------------------------
test("dashboardfout met oude cache: geen stale planweek/weekdagen/fase", async () => {
  const lib = await libPromise;
  stateResult = okResult(stateData());
  // react-query kan isError=true combineren met eerder gecachete data —
  // precies dat scenario: de fout moet winnen, de cache mag nergens lekken.
  dashResult = {
    data: dashData({ withWorkout: true, localISODate: lib.localISODate }),
    isLoading: false,
    isError: true,
    refetch: () => {},
  };
  racesResult = { data: [] };

  const view = await renderToday();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(
      text.includes(lib.COMMERCIAL_COPY.trainingError),
      "eerlijke foutmelding zichtbaar",
    );
    assert.ok(
      !text.includes("trainingsweek"),
      "geen stale planweek in de dagcontext",
    );
    assert.ok(!text.includes("Duurblok"), "geen stale training uit de cache");
    assert.equal(
      view.container.querySelectorAll("[role='listitem']").length,
      0,
      "geen stale weekdagen",
    );
    assert.ok(!text.includes("Opbouw"), "geen stale seizoensfase");
    assert.ok(
      text.includes(lib.COMMERCIAL_COPY.seasonEmpty),
      "seizoen valt eerlijk terug op de lege toestand",
    );
    const atmos = view.container.querySelectorAll("[data-atmosphere]");
    assert.equal(atmos.length, 1, "coachboodschap (andere bron) blijft staan");
    assert.equal(
      atmos[0]!.getAttribute("data-atmosphere"),
      "ready",
      "sfeer rekent zonder stale trainingscontext (ready, niet training)",
    );
  } finally {
    view.rtl.cleanup();
  }
});

// ---------------------------------------------------------------------------
// 5. Mobiele navigatie — DsMobileNav met de commerciële items
// ---------------------------------------------------------------------------
test("mobiele nav: alle items, actieve tab en werkende navigatie", async () => {
  const lib = await libPromise;
  stateResult = okResult(stateData());
  dashResult = okResult(dashData({ withWorkout: true, localISODate: lib.localISODate }));
  racesResult = { data: [] };
  navCalls.length = 0;

  const view = await renderToday();
  try {
    const nav = view.container.querySelector("nav[aria-label='Hoofdnavigatie']");
    assert.ok(nav, "DsMobileNav aanwezig");
    const knoppen = Array.from(nav!.querySelectorAll("button"));
    assert.deepEqual(
      knoppen.map((b) => b.textContent),
      lib.COMMERCIAL_MOBILE_NAV.map((i) => i.label),
      "alle vijf navigatie-items in vaste volgorde",
    );
    const actief = knoppen.filter(
      (b) => b.getAttribute("aria-current") === "page",
    );
    assert.equal(actief.length, 1, "precies één actieve tab");
    assert.equal(actief[0]!.textContent, "Vandaag", "Vandaag is actief");

    const plan = knoppen.find((b) => b.textContent === "Trainen");
    view.rtl.fireEvent.click(plan!);
    assert.deepEqual(navCalls, ["/train"], "navigatie loopt via onNavigeer");
  } finally {
    view.rtl.cleanup();
  }
});
