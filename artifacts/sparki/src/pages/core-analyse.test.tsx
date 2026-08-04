// Paginatests Core-Analyse (/lab, commercial_shell aan) — de tien gevraagde
// scenario's uit Core-afbouwwave 2A. Zelfde harnas als de andere Core-
// paginatests: happy-dom + module-mocks over het volledige importoppervlak;
// de lib (core-analyse, performance-radar-presentatie) blijft echt.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

type HookResult = {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  dataUpdatedAt?: number;
};

let loadResult: HookResult;
let ftpResult: HookResult;
let sessionsResult: HookResult;
let metricsResult: HookResult;
let profileResult: { data: unknown };
let radarAxes: Array<{
  key: string;
  label: string;
  level: number | null;
  basis: string;
  missingReason?: string;
}>;
const metricsCalls: number[] = [];
const navCalls: string[] = [];

const h = (...args: unknown[]) =>
  (
    globalThis as { React?: { createElement: CallableFunction } }
  ).React!.createElement(...(args as [never, never]));

mock.module("@/components/sparki/screen-shell", {
  namedExports: {
    ScreenShell: (props: { children?: unknown }) =>
      h("div", { "data-testid": "screen-shell" }, props.children),
  },
});

mock.module("@/components/sparki/commercial-shell", {
  namedExports: {
    CommercialShell: (props: { children?: unknown }) =>
      h("div", { "data-testid": "schil" }, props.children),
  },
});

mock.module("@/components/sparki/club-chip", {
  namedExports: { ClubChip: () => null },
});

mock.module("@/components/sparki/bio-radar", {
  namedExports: {
    BioRadar: (props: { axes: Array<{ label: string }> }) =>
      h(
        "div",
        { "data-testid": "bio-radar" },
        "radar:" + props.axes.map((a) => a.label).join(","),
      ),
  },
});

mock.module("@/components/sparki/primitives", {
  namedExports: {
    Sparkline: (props: { data: number[]; className?: string }) =>
      h(
        "div",
        { "data-testid": "sparkline", className: props.className },
        "sparkline:" + props.data.length,
      ),
  },
});

mock.module("@/components/sparki/insights-section", {
  namedExports: {
    SparkiObservations: () => h("div", null, "observaties-blok"),
  },
});

mock.module("@/components/sparki/missing-input-notice", {
  namedExports: {
    MissingInputNotice: (props: {
      title: string;
      description?: string;
      actions?: Array<{ label: string; onClick: () => void }>;
    }) =>
      h(
        "div",
        { "data-testid": "missing" },
        props.title,
        props.description ?? "",
        ...(props.actions ?? []).map((a) =>
          h("button", { type: "button", onClick: a.onClick, key: a.label }, a.label),
        ),
      ),
  },
});

mock.module("@/components/sparki/session-detail-drawer", {
  namedExports: {
    SessionDetailDrawer: (props: {
      session: { title?: string | null } | null;
      open: boolean;
    }) =>
      props.open && props.session
        ? h("div", null, "drawer:" + (props.session.title ?? ""))
        : null,
  },
});

mock.module("@/components/sparki/mental-resilience-card", {
  namedExports: { MentalResilienceCard: () => null },
});

mock.module("@/components/sparki/ai-memory-panel", {
  namedExports: { AiMemoryPanel: () => null },
});

mock.module("@/components/sparki/context-memory-panel", {
  namedExports: { ContextMemoryPanel: () => null },
});

mock.module("@/components/viz/uitleg", {
  namedExports: { UitlegDot: () => null },
});

mock.module("@/hooks/use-load", {
  namedExports: { useLoad: () => loadResult },
});

mock.module("@/hooks/use-ftp-history", {
  namedExports: {
    useFtpHistory: () => ftpResult,
    useLogFtp: () => ({ isPending: false, mutate: () => {}, mutateAsync: async () => ({}) }),
  },
});

mock.module("@/hooks/use-sessions", {
  namedExports: {
    useSessions: () => sessionsResult,
    useLogSession: () => ({ isPending: false, mutate: () => {}, mutateAsync: async () => ({}) }),
    useUpdateSessionFeel: () => ({ isPending: false, mutate: () => {} }),
    useSessionDetail: () => ({ data: null }),
    useSessionSegments: () => ({ data: null }),
  },
});

// @/lib/dev en @/lib/api lezen import.meta.env op moduleniveau (bestaat niet in node).
mock.module("@/lib/dev", {
  namedExports: { DEV_PREVIEW: false, useDevPreview: () => false, getDevAthleteId: () => 1 },
});

mock.module("@/lib/api", {
  namedExports: {
    apiFetch: async () => ({}),
    apiFetchBlob: async () => new Blob(),
    API_BASE: "",
  },
});

// Echte react-query/clerk-hooks eisen providers — mock ze weg (zelfde aanpak
// als core-plan.test.tsx).
mock.module("@tanstack/react-query", {
  namedExports: {
    useQuery: () => ({}),
    useMutation: () => ({ isPending: false, mutate: () => {}, mutateAsync: async () => ({}) }),
    useQueryClient: () => ({ invalidateQueries: () => {} }),
    QueryClient: class {},
    QueryClientProvider: ({ children }: any) => children,
  },
});

mock.module("@clerk/react", {
  namedExports: {
    useUser: () => ({ isSignedIn: true, user: { id: "user_1" } }),
    useClerk: () => ({ signOut: async () => {} }),
    useAuth: () => ({ isSignedIn: true, getToken: async () => null }),
    Show: (props: { children?: unknown }) => props.children ?? null,
    SignedIn: (props: { children?: unknown }) => props.children ?? null,
    SignedOut: () => null,
  },
});

mock.module("@/hooks/use-daily-metrics", {
  namedExports: {
    useDailyMetrics: (days: number) => {
      metricsCalls.push(days);
      return metricsResult;
    },
    useLogDailyMetrics: () => ({ isPending: false, mutate: () => {}, mutateAsync: async () => ({}) }),
  },
});

mock.module("@/hooks/use-athlete-extended-profile", {
  namedExports: {
    useAthleteExtendedProfile: () => profileResult,
    useUpdateAthleteProfile: () => ({ isPending: false, mutate: () => {}, mutateAsync: async () => ({}) }),
  },
});

mock.module("wouter", {
  namedExports: {
    useLocation: () => [
      "/lab",
      (href: string) => {
        navCalls.push(href);
      },
    ],
    useSearch: () => "",
    Link: (props: { href?: string; children?: unknown }) =>
      h("a", { href: props.href }, props.children),
  },
});

mock.module("@/lib/performance-radar", {
  namedExports: {
    computePerformanceRadar: () => radarAxes,
  },
});

const reactPromise = import("react");
const rtlPromise = import("@testing-library/react");
const componentPromise = import("./core-analyse");

function ok(data: unknown): HookResult {
  return {
    data,
    isLoading: false,
    isError: false,
    refetch: () => {},
    dataUpdatedAt: 1_753_500_000_000,
  };
}

function laden(): HookResult {
  return { data: undefined, isLoading: true, isError: false, refetch: () => {} };
}

function fout(onRetry: () => void): HookResult {
  return { data: undefined, isLoading: false, isError: true, refetch: onRetry };
}

function makeSession(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    athleteId: 1,
    source: "sparki",
    type: "endurance",
    sessionDate: "2026-07-20",
    title: "Rit " + id,
    durationMin: null,
    tss: null,
    feelScore: null,
    ...overrides,
  };
}

const zesAssen = [
  { key: "fitness", label: "Fitheid", level: 0.62, basis: "b" },
  { key: "form", label: "Vorm", level: 0.5, basis: "b" },
  { key: "recovery", label: "Herstel", level: 0.7, basis: "b" },
  { key: "power", label: "Vermogen", level: 0.55, basis: "b" },
  { key: "feel", label: "Gevoel", level: 0.8, basis: "b" },
  { key: "consistency", label: "Regelmaat", level: 0.4, basis: "b" },
];

function vulAlles() {
  radarAxes = zesAssen;
  loadResult = ok({ ctl: 50, atl: 40, tsb: 5, chartData: [] });
  sessionsResult = ok([
    makeSession(1, { title: "Zondagsrit", durationMin: 120, tss: "55" }),
    makeSession(2, { title: "Intervalblok", durationMin: 60, tss: 42 }),
  ]);
  metricsResult = ok([
    { feelScore: 4, hrv: 62 },
    { feelScore: 3, hrv: 57 },
    { feelScore: 4, hrv: 59 },
  ]);
  ftpResult = ok([
    { ftpWatts: 210, measuredAt: "2026-03-10" },
    { ftpWatts: 240, measuredAt: "2026-06-15" },
  ]);
  profileResult = {
    data: { displayName: "René", ftp: 250, weightKg: 72 },
  };
  metricsCalls.length = 0;
  navCalls.length = 0;
}

async function renderPage() {
  const React = (await reactPromise).default;
  (globalThis as Record<string, unknown>).React = React;
  const rtl = await rtlPromise;
  const { default: CoreAnalysePage } = await componentPromise;
  const utils = rtl.render(React.createElement(CoreAnalysePage));
  return { ...utils, rtl, React };
}

// 1. Volledige echte gegevens: alle secties tonen echte waarden.
test("volledige gegevens: radar, readiness, HRV, FTP en sessies tonen echte waarden", async () => {
  vulAlles();
  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("radar:Fitheid,Vorm,Herstel,Vermogen,Gevoel,Regelmaat"));
    assert.ok(text.includes("6 van 6 assen meetbaar"));
    assert.ok(text.includes("80 gereedheid"), "readiness laatste waarde: " + text);
    assert.ok(text.includes("62"), "HRV vandaag");
    assert.ok(text.includes("+5"), "HRV-delta vs gisteren");
    assert.ok(text.includes("250"), "profiel-FTP als bron van waarheid");
    assert.ok(text.includes("uit je Sportpaspoort"));
    assert.ok(text.includes("+30W all-time"));
    assert.ok(text.includes("Zondagsrit"));
    assert.ok(text.includes("120 min"));
    assert.ok(text.includes("FITHEID (CTL)"), "TrainingProgression rendert");
    assert.ok(text.includes("René · FTP 250W · 3,5 W/kg"));
    assert.ok(!text.includes("Verouderde gegevens"));
    assert.ok(!text.includes("kon niet geladen"));
  } finally {
    view.rtl.cleanup();
  }
});

// 2. Gedeeltelijk ontbrekend: eerlijke redenen, nooit nulwaarden.
test("gedeeltelijke gegevens: nog-niet-meetbaar-redenen en eerlijke HRV-leegte", async () => {
  vulAlles();
  radarAxes = [
    ...zesAssen.slice(0, 3),
    {
      key: "power",
      label: "Vermogen",
      level: null,
      basis: "b",
      missingReason: "FTP of gewicht ontbreekt in je Sportpaspoort.",
    },
    {
      key: "feel",
      label: "Gevoel",
      level: null,
      basis: "b",
      missingReason: "Nog geen sessies met gevoel-score.",
    },
    {
      key: "consistency",
      label: "Regelmaat",
      level: null,
      basis: "b",
      missingReason: "Nog geen sessies geregistreerd.",
    },
  ];
  metricsResult = ok([
    { feelScore: 4, hrv: null },
    { feelScore: 3, hrv: null },
  ]);
  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("3 van 6 assen meetbaar"));
    assert.ok(text.includes("Nog geen HRV"));
    assert.ok(!/\b0\s*ms\b/.test(text), "geen verzonnen 0 ms: " + text);
    assert.ok(!text.includes("NaN"));
  } finally {
    view.rtl.cleanup();
  }
});

// 3. Volledig leeg: eerlijke lege toestanden, geen cijfers.
test("lege toestanden: elke sectie eerlijk leeg zonder verzonnen cijfers", async () => {
  vulAlles();
  radarAxes = zesAssen.map((a) => ({
    ...a,
    level: null,
    missingReason: "Nog geen gegevens.",
  }));
  loadResult = ok(null);
  sessionsResult = ok([]);
  metricsResult = ok([]);
  ftpResult = ok([]);
  profileResult = { data: null };
  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Nog te weinig gegevens voor een radar"));
    assert.ok(text.includes("Nog geen readiness-trend"));
    assert.ok(text.includes("Nog geen HRV"));
    assert.ok(text.includes("Nog geen FTP-tests"));
    assert.ok(text.includes("Nog geen sessies gelogd"));
    assert.ok(!text.includes("gereedheid"));
    assert.ok(!text.includes("all-time"));
  } finally {
    view.rtl.cleanup();
  }
});

// 4. Laadstatus: skeletons, geen datasuggestie.
test("laadstatus: skeletons zichtbaar, geen waarden of foutmeldingen", async () => {
  vulAlles();
  loadResult = laden();
  sessionsResult = laden();
  metricsResult = laden();
  ftpResult = laden();
  const view = await renderPage();
  try {
    const skeletons = view.container.querySelectorAll(".animate-pulse");
    assert.ok(skeletons.length >= 3, "skeletons per sectie");
    const text = view.container.textContent ?? "";
    assert.ok(!text.includes("gereedheid"));
    assert.ok(!text.includes("kon niet geladen"));
    assert.ok(!text.includes("Verouderde gegevens"));
  } finally {
    view.rtl.cleanup();
  }
});

// 5. API-fout zonder cache: eerlijke fout + herstelactie, geen cijfers.
test("API-fout zonder cache: foutmelding met herstelactie, nooit vervangdata", async () => {
  vulAlles();
  let retries = 0;
  const onRetry = () => {
    retries++;
  };
  loadResult = fout(onRetry);
  sessionsResult = fout(onRetry);
  metricsResult = fout(onRetry);
  ftpResult = fout(onRetry);
  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Belastingsgrafiek kon niet worden geladen."));
    assert.ok(text.includes("Sessies konden niet worden geladen."));
    assert.ok(!text.includes("80 gereedheid"));
    assert.ok(!text.includes("all-time"));
    const retry = Array.from(view.container.querySelectorAll("button")).find(
      (b) => b.textContent === "Opnieuw proberen",
    );
    assert.ok(retry, "herstelactie aanwezig");
    view.rtl.fireEvent.click(retry!);
    assert.ok(retries >= 1, "refetch aangeroepen");
  } finally {
    view.rtl.cleanup();
  }
});

// 6. Stale cache: gegevens blijven zichtbaar, maar alleen mét melding.
test("verouderde cache: data zichtbaar met duidelijke verouderd-melding", async () => {
  vulAlles();
  sessionsResult = {
    data: [makeSession(1, { title: "Zondagsrit", durationMin: 120 })],
    isLoading: false,
    isError: true,
    refetch: () => {},
    dataUpdatedAt: Date.now() - 3 * 60 * 60_000,
  };
  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Verouderde gegevens — verversen is niet gelukt."));
    assert.ok(text.includes("Opnieuw proberen"), "herstelactie bij de melding");
    assert.ok(text.includes("Zondagsrit"), "cache blijft zichtbaar");
  } finally {
    view.rtl.cleanup();
  }
});

// 7. Periodefilter: bestaande 14/30/90-keuze stuurt de metrics-query.
// T7 (MEETNIVEAU_EN_UITLEG_01 §6): vormgrafiek over een periode met 1
// activiteit → de waarschuwende zin over groen zonder training staat er.
test("T7: vormgrafiek met 1 activiteit toont de waarschuwende zin", async () => {
  vulAlles();
  const dagen = 14;
  const chartData = Array.from({ length: dagen }, (_, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, "0")}`,
    ctl: 30,
    atl: 25,
    tsb: 5,
    tss: i === 6 ? 80 : 0, // precies één dag met echte belasting
  }));
  loadResult = ok({ ctl: 30, atl: 25, tsb: 5, chartData });
  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(
      text.includes("Groen betekent uitgerust"),
      "verplichte §6-tekst onder de vormgrafiek: " + text.slice(0, 300),
    );
    assert.ok(
      text.includes("groen zonder training ervoor is geen vorm"),
      "waarschuwende zin bij weinig activiteiten",
    );
  } finally {
    view.rtl.cleanup();
  }
});

test("twee-zinnen-opbouw: kaarten tonen altijd wat je ziet én wat je ermee doet", async () => {
  vulAlles();
  // ≥7 dagen belastingsdata zodat ook het CTL-verloop (Progressie) rendert.
  loadResult = ok({
    ctl: 50, atl: 40, tsb: 5,
    chartData: Array.from({ length: 14 }, (_, i) => ({
      date: `2026-07-${String(i + 1).padStart(2, "0")}`,
      ctl: 40 + i, atl: 35 + i, tsb: 5, tss: 60,
    })),
  });
  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    // Zin 1 (wat je ziet) + zin 2 (wat je ermee doet) uit het registry,
    // zonder dat de uitleg-schakelaar aan hoeft te staan.
    assert.ok(text.includes("Je trainingsvolume: hoeveel uur je per week hebt getraind."), "wat-zin volume");
    assert.ok(text.includes("Groei per week met kleine stappen"), "doen-zin volume");
    assert.ok(text.includes("Open een rij om de volledige analyse"), "doen-zin sessielijst");
    // De CTL/ATL-grafiek draagt eigen fitheid/vermoeidheid-copy (geen TSS-copy).
    assert.ok(
      text.includes("Twee lijnen door de tijd: je fitheid"),
      "wat-zin belastingsverloop (CTL/ATL)",
    );
    // TrainingProgression (Progressie-tab) draagt de twee-zinnen-opbouw ook.
    assert.ok(
      text.includes("Je fitheid (CTL): het voortschrijdend gemiddelde"),
      "wat-zin fitheid onder het CTL-verloop",
    );
    // Rekenwijze zit achter een uitklap.
    assert.ok(text.includes("Hoe wordt dit berekend?"), "rekenwijze-uitklap aanwezig");
  } finally {
    view.rtl.cleanup();
  }
});

test("periodefilter: 30-dagenknop stuurt de query en markeert de keuze", async () => {
  vulAlles();
  const view = await renderPage();
  try {
    const knop = view.container.querySelector(
      'button[aria-label="30 dagen"]',
    ) as HTMLButtonElement;
    assert.ok(knop, "30-dagenknop aanwezig");
    view.rtl.fireEvent.click(knop);
    assert.equal(knop.getAttribute("aria-pressed"), "true");
    const veertien = view.container.querySelector(
      'button[aria-label="14 dagen"]',
    );
    assert.equal(veertien?.getAttribute("aria-pressed"), "false");
  } finally {
    view.rtl.cleanup();
  }
});

// 8. Toegankelijkheid: tekstuele alternatieven voor elke grafiek.
test("toegankelijkheid: grafieken hebben een tekstueel alternatief", async () => {
  vulAlles();
  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(
      text.includes("Performance-radar met 6 meetbare signalen"),
      "radar-samenvatting",
    );
    assert.ok(
      view.container.querySelector("[aria-pressed]"),
      "periodeknoppen melden hun status",
    );
  } finally {
    view.rtl.cleanup();
  }
});

// 9. Mobiel: geen vaste pixelbreedtes die buiten 390px lopen.
test("responsief: geen vaste pixelbreedtes, grafieken schalen mee", async () => {
  vulAlles();
  const view = await renderPage();
  try {
    for (const el of Array.from(view.container.querySelectorAll("[style]"))) {
      const stijl = el.getAttribute("style") ?? "";
      assert.ok(
        !/width:\s*\d+px/.test(stijl),
        "geen vaste px-breedte in stijl: " + stijl,
      );
    }
    const sparklines = Array.from(
      view.container.querySelectorAll('[data-testid="sparkline"]'),
    );
    assert.ok(sparklines.length >= 2, "sparklines aanwezig");
    for (const s of sparklines) {
      assert.ok(
        (s.getAttribute("class") ?? "").includes("w-full"),
        "sparkline schaalt met de kolom",
      );
    }
  } finally {
    view.rtl.cleanup();
  }
});

// 10. Navigatie en detail: rij opent drawer; lege staat linkt naar Training.
test("detail en navigatie: sessie opent drawer, lege staat linkt naar Training", async () => {
  vulAlles();
  const view = await renderPage();
  try {
    const rij = Array.from(view.container.querySelectorAll("tr")).find(
      (r) => (r.textContent ?? "").includes("Zondagsrit"),
    );
    assert.ok(rij, "sessierij aanwezig");
    view.rtl.fireEvent.click(rij!);
    assert.ok(
      (view.container.textContent ?? "").includes("drawer:Zondagsrit"),
      "drawer geopend met de gekozen sessie",
    );
  } finally {
    view.rtl.cleanup();
  }

  sessionsResult = ok([]);
  navCalls.length = 0;
  const leeg = await renderPage();
  try {
    const actie = Array.from(leeg.container.querySelectorAll("button")).find(
      (b) => b.textContent === "Ga naar Trainen",
    );
    assert.ok(actie, "lege staat biedt directe actie");
    leeg.rtl.fireEvent.click(actie!);
    assert.deepEqual(navCalls, ["/train"]);
  } finally {
    leeg.rtl.cleanup();
  }
});
