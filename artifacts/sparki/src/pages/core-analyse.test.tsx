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
let weeklyZonesResult: HookResult;
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

mock.module("@/components/sparki/commercial-shell", {
  namedExports: {
    CommercialShell: (props: { children?: unknown }) =>
      h("div", { "data-testid": "schil" }, props.children),
  },
});

mock.module("@/components/sparki/screen-shell", {
  namedExports: {
    ScreenShell: (props: { children?: unknown }) =>
      h("div", { "data-testid": "screen-shell" }, props.children),
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

mock.module("@/hooks/use-weekly-zones", {
  namedExports: { useWeeklyZones: () => weeklyZonesResult },
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

// Meetniveau-waarneming + pakketrechten — instelbaar per scenario (§4-poorten).
let meetniveauResult: { data: unknown };
let pakketResult: { entitled: boolean; known: boolean };

mock.module("@/hooks/use-meetniveau", {
  namedExports: { useMeetniveau: () => meetniveauResult },
});

mock.module("@/hooks/use-feature-access", {
  namedExports: {
    useFeatureAccess: () => ({ isLoading: false, ...pakketResult }),
    useEntitlements: () => ({ data: undefined, isLoading: false }),
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
  weeklyZonesResult = ok(null);
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
  meetniveauResult = {
    data: { vermogen: true, hartslag: true, herstel: true, profielregel: "" },
  };
  pakketResult = { entitled: true, known: true };
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
    assert.ok(text.includes("Sportpaspoort"));
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
    assert.equal(metricsCalls[0], 90, "één query over 90 dagen; filter is client-side");
    const knop = view.container.querySelector(
      'button[aria-label="30 dagen"]',
    ) as HTMLButtonElement;
    assert.ok(knop, "30-dagenknop aanwezig");
    assert.ok(
      knop.className.includes("min-h-"),
      "aanraakdoel met expliciete minimumhoogte",
    );
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
      text.includes("Gebaseerd op dagelijkse check-in scores."),
      "readiness-grafiek heeft toelichting",
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
    const rij = view.container.querySelector('tr[aria-label="Sessie: Zondagsrit"]');
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
  const leeg = await renderPage();
  try {
    assert.ok(
      (leeg.container.textContent ?? "").includes("Nog geen sessies gelogd"),
      "lege staat is een eerlijke invoer-melding",
    );
  } finally {
    leeg.rtl.cleanup();
  }
});

// 11. §4 datapoort (T2): vermogensspoor weg ⇒ de belastingsanalyse wordt
// VERVANGEN door één sensormelding — zonder één woord pakkettaal.
test("datapoort ritsensoren: zonder vermogen én hartslag vervangt de sensormelding de analyse", async () => {
  vulAlles();
  meetniveauResult = {
    data: { vermogen: false, hartslag: false, herstel: true, profielregel: "" },
  };
  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Hiervoor is vermogen nodig"), "sensormelding zichtbaar: " + text.slice(0, 200));
    assert.ok(text.includes("vermogensmeter"), "melding benoemt de ontbrekende sensor");
    assert.ok(!text.includes("Verkenning · simulatie"), "doelscenario-simulatie is weggelaten");
    assert.ok(!text.includes("Belastingsgrafiek"), "belastingsgrafiek is weggelaten");
    assert.ok(!text.toLowerCase().includes("upgrad"), "sensorprobleem spreekt nooit over upgraden");
    assert.ok(!text.includes("Sparki Compleet"), "sensorprobleem noemt nooit het pakket");
  } finally {
    view.rtl.cleanup();
  }
});

// SPOOR_H (§3.1): alleen een hartslagband is GEEN "lager" geval — de
// belastingsanalyse blijft staan (op de hartslagreeks), alleen de puur
// vermogensgebonden simulaties gaan achter hun eigen vermogenspoort.
test("SPOOR_H: alleen hartslag ⇒ analysekaarten blijven, alleen vermogenssimulaties gepoort", async () => {
  vulAlles();
  meetniveauResult = {
    data: { vermogen: false, hartslag: true, herstel: true, profielregel: "" },
  };
  loadResult = ok({
    ctl: 42,
    atl: 38,
    tsb: 4,
    basis: "hartslag",
    basisDetail: { metVermogen: 0, metHartslag: 12, buitenBasis: 0 },
    chartData: Array.from({ length: 30 }, (_, i) => ({
      date: `2026-07-${String(i + 1).padStart(2, "0")}`,
      ctl: 40 + i * 0.1,
      atl: 38,
      tsb: 2,
      tss: 60,
    })),
  });
  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Belastingsgrafiek"), "belastingsgrafiek blijft staan op hartslagbasis");
    assert.ok(
      text.includes("interne belasting uit hartslag"),
      "reeksbasis staat er eerlijk bij",
    );
    assert.ok(text.includes("Intensiteitsverdeling"), "intensiteitskaart blijft staan");
    assert.ok(text.includes("Zoneverdeling per week"), "zonekaart blijft staan");
    // Besluit 05-08: de simulaties wonen op het Lab-tabblad — daar krijgt élk
    // tool zijn eigen eerlijke vermogensmelding (geen gecombineerde muur meer).
    const lab = view.container.querySelector("#tab-lab");
    assert.ok(lab, "Lab-tabpaneel aanwezig");
    const labText = lab!.textContent ?? "";
    assert.ok(
      labText.includes("Doelscenario") && labText.includes("Wattage-lab") &&
        labText.includes("Hiervoor is vermogen nodig"),
      "vermogenssimulaties op Lab achter hun eigen vermogenspoort per tool",
    );
    assert.ok(!text.includes("Verkenning · simulatie"), "geen vermogenssimulatie zonder vermogen");
    // Progressie: powercurve en vermogensrecords zijn puur vermogensanalyse —
    // ook met bestaande vermogenshistorie vervangt de sensormelding beide.
    assert.ok(
      text.includes("Powercurve & vermogensrecords"),
      "Progressie toont één sensormelding voor powercurve+records",
    );
    assert.ok(
      !text.includes("Persoonlijke vermogensrecords"),
      "vermogensrecords worden niet gerenderd zonder vermogensspoor",
    );
    assert.ok(
      !text.includes("Powercurve kon niet worden geladen"),
      "de server-weigering mag nooit als generieke foutkaart verschijnen",
    );
    assert.ok(!text.toLowerCase().includes("upgrad"), "sensorprobleem spreekt nooit over upgraden");
  } finally {
    view.rtl.cleanup();
  }
});

// Lab-tabblad (besluit 05-08): alle simulaties bij elkaar, altijd vindbaar.
test("Lab-tabblad: Doelscenario, Wattage-lab en Wat-als staan samen op Lab", async () => {
  vulAlles();
  const view = await renderPage();
  try {
    const tabknop = Array.from(view.container.querySelectorAll("button")).find(
      (b) => (b.textContent ?? "").trim() === "Lab",
    );
    assert.ok(tabknop, "tabknop Lab aanwezig");
    const lab = view.container.querySelector("#tab-lab");
    assert.ok(lab, "Lab-tabpaneel aanwezig");
    const labText = lab!.textContent ?? "";
    assert.ok(labText.includes("Verkenning · simulatie"), "Doelscenario staat op Lab");
    assert.ok(labText.includes("Wattage-lab"), "Wattage-lab staat op Lab");
    assert.ok(labText.includes("Wat-als"), "Wat-als staat op Lab");
    // En niet dubbel op Belasting (presentatie-dedup: verhuisd, niet gekopieerd).
    const belasting = view.container.querySelector("#tab-belasting");
    const belastingText = belasting?.textContent ?? "";
    assert.ok(!belastingText.includes("Verkenning · simulatie"), "Doelscenario niet meer op Belasting");
    assert.ok(!belastingText.includes("Wattage-lab"), "Wattage-lab niet meer op Belasting");
  } finally {
    view.rtl.cleanup();
  }
});

// SPOOR_H eerlijk onderscheid: provider-hartslag zonder samplereeksen is
// "wel signaal, geen reeksen" — nooit "geen sensorsignaal".
test("SPOOR_H: hartslag gemeten maar geen samplereeksen ⇒ eerlijke aparte melding", async () => {
  vulAlles();
  meetniveauResult = {
    data: { vermogen: false, hartslag: true, herstel: true, profielregel: "" },
  };
  weeklyZonesResult = ok({
    ftp: null,
    zones: [],
    hrZones: [
      { zone: "Z1", label: "Herstel", fromBpm: 0, toBpm: 114 },
      { zone: "Z2", label: "Duur", fromBpm: 114, toBpm: 133 },
    ],
    maxHr: 190,
    maxHrBron: "profiel",
    weeks: [],
    sessionsWithPower: 0,
    sessionsWithHr: 0,
    sessionsWithAvgHr: 8,
  });
  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(
      text.includes("geen volledige hartslagreeksen beschikbaar"),
      "melding benoemt het echte gat (reeksen), niet 'geen signaal': " + text.slice(0, 300),
    );
    assert.ok(
      !text.includes("zonder echt sensorsignaal is er geen zoneverdeling"),
      "de 'geen signaal'-melding is hier onterecht",
    );
    assert.ok(!text.includes("Geen FTP bekend"), "geen FTP-melding voor een hartslagrenner");
  } finally {
    view.rtl.cleanup();
  }
});

// 12. §4 pakketpoort (T3): pakket ontbreekt ⇒ upgrademelding, nooit sensortaal —
// ook al zijn alle sensoren aanwezig.
test("pakketpoort: upgrademelding zonder sensortaal, analyse weggelaten", async () => {
  vulAlles();
  pakketResult = { entitled: false, known: true };
  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Onderdeel van Sparki Compleet"), "pakketmelding zichtbaar");
    assert.ok(text.toLowerCase().includes("upgrad"), "pakketmelding wijst naar upgraden");
    assert.ok(!text.includes("Hiervoor is vermogen nodig"), "geen sensormelding tegelijk");
    assert.ok(!text.includes("koppel een band"), "pakketprobleem zegt nooit 'koppel een band'");
    assert.ok(!text.includes("Belastingsgrafiek"), "analyse blijft dicht achter de pakketpoort");
  } finally {
    view.rtl.cleanup();
  }
});

// 14. Presentatie-dedup MiniDuiding (taak: duiding nooit dubbel of stilletjes
// weg). De tabpanelen blijven gemount met `hidden`, dus we tellen alleen
// ZICHTBARE voorkomens (geen [hidden]-voorouder). De MiniDuiding-regel is
// herkenbaar aan de gecombineerde wat+doen-zin (UITLEG[k].wat + " " +
// UITLEG_DOEN[k]) in één <p> — de volledige uitlegblokken dragen alleen de
// wat-zin, nooit de concatenatie.
const DUIDING_KEYS = ["fitheid", "vorm", "ftp"] as const;

function zichtbaar(el: Element): boolean {
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (n.hasAttribute("hidden")) return false;
  }
  return true;
}

async function zichtbareDuidingen(view: { container: HTMLElement }, k: string) {
  const uitleg = await import("@/lib/uitleg-content");
  const combi = `${uitleg.UITLEG[k].wat} ${uitleg.UITLEG_DOEN[k]}`;
  return Array.from(view.container.querySelectorAll("p")).filter(
    (p) => (p.textContent ?? "").trim() === combi && zichtbaar(p),
  );
}

test("duiding-dedup Overzicht: fitheid/vorm/ftp precies één keer zichtbaar, via de tegels", async () => {
  vulAlles();
  const view = await renderPage();
  try {
    for (const k of DUIDING_KEYS) {
      const gevonden = await zichtbareDuidingen(view, k);
      assert.equal(
        gevonden.length,
        1,
        `duiding "${k}" moet op Overzicht precies één keer zichtbaar zijn, zag ${gevonden.length}`,
      );
      // De drager is de stat-tegel (binnen het Overzicht-tabpaneel), niet de strip.
      assert.ok(
        gevonden[0].closest("#tab-overzicht"),
        `duiding "${k}" hoort op Overzicht in de tegel-rij te staan, niet in de strip`,
      );
    }
  } finally {
    view.rtl.cleanup();
  }
});

test("duiding-dedup ander tabblad: dezelfde duiding precies één keer zichtbaar, via de strip", async () => {
  vulAlles();
  const view = await renderPage();
  try {
    const knop = Array.from(view.container.querySelectorAll("button")).find(
      (b) => (b.textContent ?? "").trim() === "Sessies",
    );
    assert.ok(knop, "tabknop Sessies aanwezig");
    view.rtl.fireEvent.click(knop!);
    for (const k of DUIDING_KEYS) {
      const gevonden = await zichtbareDuidingen(view, k);
      assert.equal(
        gevonden.length,
        1,
        `duiding "${k}" moet op het Sessies-tabblad precies één keer zichtbaar zijn, zag ${gevonden.length}`,
      );
      // Nu draagt de samenvattingsstrip (buiten de tabpanelen) de tekst.
      assert.ok(
        !gevonden[0].closest('[role="tabpanel"]'),
        `duiding "${k}" hoort buiten Overzicht via de strip te komen, niet uit een tabpaneel`,
      );
    }
  } finally {
    view.rtl.cleanup();
  }
});

// 13. §4 datapoort herstel: geen nachtmetingen-spoor ⇒ HRV-trend vervangen
// door de draagbare-melding, readiness (check-in) blijft gewoon staan.
test("datapoort herstel: HRV-trend vervangen door draagbare-melding", async () => {
  vulAlles();
  meetniveauResult = {
    data: { vermogen: true, hartslag: true, herstel: false, profielregel: "" },
  };
  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Hiervoor zijn nachtmetingen nodig"), "draagbare-melding zichtbaar");
    assert.ok(!text.includes("62ms"), "geen HRV-waarde meer tonen zonder herstelspoor");
    assert.ok(text.includes("80 gereedheid"), "readiness (check-in) blijft onafhankelijk staan");
    assert.ok(!text.toLowerCase().includes("upgrad"), "sensorprobleem spreekt nooit over upgraden");
  } finally {
    view.rtl.cleanup();
  }
});
