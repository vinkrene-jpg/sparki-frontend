import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const navCalls: string[] = [];
mock.module("wouter", {
  namedExports: {
    useLocation: () => ["/train", (href: string) => navCalls.push(href)],
    useSearch: () => "",
    useRoute: () => [false, null],
    useParams: () => ({}),
    Link: (props: any) => {
      const React = (globalThis as any).React;
      return React.createElement("a", { href: props.href, className: props.className }, props.children);
    }
  }
});

let planWindowResult: any = {};
let planResult: any = {};
let profileResult: any = {};
let generateResult: any = {};
let adaptResult: any = {};
let updateWorkoutResult: any = {};
let observationsResult: any = {};
let loadResult: any = {};
let sessionsResult: any = {};
let ftpHistoryResult: any = {};
let dailyMetricsResult: any = {};
let runConnectionsResult: any = {};
let readinessResult: any = {};

// Generieke no-ops voor hooks die wel in het module-oppervlak zitten maar in
// deze tests niet inhoudelijk worden aangestuurd. Een mock.module MOET het
// volledige import-oppervlak dekken, anders faalt de hele module-link.
const noopMutation = () => ({ isPending: false, mutate: () => {}, mutateAsync: async () => ({}), reset: () => {} });
const noopQuery = () => ({ data: undefined, isLoading: false, isError: false, refetch: () => {} });

// Volledig export-oppervlak: de statisch geïmporteerde WorkoutDetailDrawer
// importeert o.a. useApplyProposal, useWorkoutDetail, useCancelWorkout.
mock.module("@/hooks/use-training-plan", {
  namedExports: {
    usePlanWindow: () => planWindowResult,
    // De dagkaart/kalender op /train leest usePlanRange (niet usePlanWindow);
    // beide krijgen dezelfde fixture zodat header + kalender consistent zijn.
    usePlanRange: () => planWindowResult,
    useTrainingPlan: () => planResult,
    useGenerateTrainingPlan: () => generateResult,
    useAdaptTrainingPlan: () => adaptResult,
    useWorkoutDetail: () => ({ data: null }),
    useGeneratePlan: noopMutation,
    useSubmitFeedback: noopMutation,
    useWorkoutExplain: noopMutation,
    useWorkoutExplainExtended: noopMutation,
    useWorkoutAdjust: noopMutation,
    useWorkoutHistory: noopQuery,
    useLinkWorkoutSession: noopMutation,
    useCancelWorkout: noopMutation,
    useApplyProposal: noopMutation,
    usePauseTrainingPlan: noopMutation,
    useResumeTrainingPlan: noopMutation,
    useDeleteTrainingPlan: noopMutation,
    useSavePlanSetup: noopMutation,
  }
});

// useUpdateWorkout komt uit use-today-workout (niet uit use-training-plan).
mock.module("@/hooks/use-today-workout", {
  namedExports: {
    useTodayWorkout: noopQuery,
    WORKOUTS_LIST_KEY: ["/api/athlete/workouts"],
    useUpcomingWorkouts: noopQuery,
    useWorkoutSearch: noopQuery,
    useCreateWorkout: noopMutation,
    useUpdateWorkout: () => updateWorkoutResult,
  }
});

mock.module("@/hooks/use-athlete-extended-profile", {
  namedExports: {
    useAthleteExtendedProfile: () => profileResult,
    useUpdateAthleteProfile: noopMutation,
  }
});

mock.module("@/hooks/use-ai-memory", {
  namedExports: {
    useObservations: () => observationsResult,
    useRunConnections: () => runConnectionsResult,
    useConnectionReadiness: () => readinessResult,
    useUpdateObservation: noopMutation,
    useAiPreferences: noopQuery,
    useUpdateAiPreferences: noopMutation,
  }
});

mock.module("@/hooks/use-sessions", {
  namedExports: {
    useSessions: () => sessionsResult,
    useUpdateSessionFeel: () => ({ isPending: false, mutate: () => {} }),
    useSessionDetail: () => ({ data: null }),
    useSessionSegments: () => ({ data: null }),
    useLogSession: noopMutation,
  }
});

mock.module("@/hooks/use-load", {
  namedExports: { useLoad: () => loadResult }
});

mock.module("@/hooks/use-ftp-history", {
  namedExports: { useFtpHistory: () => ftpHistoryResult, useLogFtp: noopMutation }
});

mock.module("@/hooks/use-daily-metrics", {
  namedExports: { useDailyMetrics: () => dailyMetricsResult, useLogDailyMetrics: noopMutation }
});

mock.module("@/hooks/use-feature-flag", {
  namedExports: { useFeatureFlag: () => true }
});

mock.module("@/hooks/use-missing-input", {
  namedExports: {
    useFixParams: () => ({ focus: null }),
    useStartFix: () => () => {},
    useCompleteFix: () => () => {},
    useRetryAction: () => {},
  }
});

// Evaluatie-vangnet (zelfde aanpak als de groene core-activiteiten.test.tsx):
// @/lib/dev en @/lib/api lezen import.meta.env op moduleniveau (bestaat niet
// in node), en echte react-query/clerk-hooks eisen providers.
mock.module("@/lib/dev", {
  namedExports: { DEV_PREVIEW: false, useDevPreview: () => false, getDevAthleteId: () => 1 }
});

mock.module("@/lib/api", {
  namedExports: { apiFetch: async () => ({}), API_BASE: "" }
});

mock.module("@tanstack/react-query", {
  namedExports: {
    useQuery: () => ({}),
    useMutation: () => ({}),
    useQueryClient: () => ({ invalidateQueries: () => {} }),
    QueryClient: class {},
    QueryClientProvider: ({ children }: any) => children,
  }
});

mock.module("@clerk/react", {
  namedExports: {
    useUser: () => ({ isSignedIn: true, user: { id: "user_1" } }),
  }
});

// WP-R1: de shell is rol-bewust (useUserProfile) en toont een testerpaneel
// (TodayDebugPanel) — beide horen bij het volledige import-oppervlak.
mock.module("@/contexts/UserContext", {
  namedExports: {
    useUserProfile: () => ({ profile: { activeRole: "athlete" } }),
    UserProvider: ({ children }: any) => children,
  }
});

mock.module("@/components/sparki/role-today", {
  namedExports: { TodayDebugPanel: () => null }
});

const reactPromise = import("react");
const rtlPromise = import("@testing-library/react");
const componentPromise = import("./core-plan");
const shellLibPromise = import("@/lib/commercial-shell");

async function renderPage() {
  const React = (await reactPromise).default;
  (globalThis as any).React = React;
  const rtl = await rtlPromise;
  const { default: CorePlanPage } = await componentPromise;
  const utils = rtl.render(React.createElement(CorePlanPage));
  return { ...utils, rtl, React };
}

// 1) dag met training -> titel + "Training bekijken"
test("core-plan: dag met training toont titel en Training bekijken", async () => {
  const lib = await shellLibPromise;
  const today = lib.localISODate();

  planWindowResult = {
    isLoading: false,
    isError: false,
    refetch: () => {},
    data: [{ id: 1, scheduledDate: today, title: "Zware Rit", type: "ride", targetDurationMin: 90, targetTSS: null, description: null, status: "planned", source: "sparki", sessionId: null, routeId: null, planDetails: null, structure: null }]
  };
  planResult = { data: { plan: { mode: "autonomous" }, hasCoach: false } };
  profileResult = { data: { ftp: 250, weeklyHours: 8 } };
  sessionsResult = { data: [], isLoading: false };
  loadResult = { data: null, isLoading: false };
  updateWorkoutResult = { isPending: false, mutate: () => {} };
  generateResult = { isPending: false, mutate: () => {} };
  adaptResult = { isPending: false, mutate: () => {} };

  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Zware Rit"), "Titel van de rit zichtbaar");
    assert.ok(text.includes("90 min"), "Duur zichtbaar");
    assert.ok(text.includes("Training bekijken"), "Primaire actie zichtbaar");
  } finally {
    view.rtl.cleanup();
  }
});

// 2) rustdag -> tekst rustdag zichtbaar en GEEN "Training bekijken"
test("core-plan: rustdag toont tekst rustdag en GEEN Training bekijken", async () => {
  const lib = await shellLibPromise;
  const today = lib.localISODate();

  planWindowResult = {
    isLoading: false,
    isError: false,
    refetch: () => {},
    data: [{ id: 2, scheduledDate: today, title: "Rustdag", type: "rest", targetDurationMin: null, targetTSS: null, description: null, status: "planned", source: "sparki", sessionId: null, routeId: null, planDetails: null, structure: null }]
  };
  sessionsResult = { data: [], isLoading: false };

  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Rustdag"), "Rustdag tekst zichtbaar");
    assert.ok(!text.includes("Training bekijken"), "Geen Training bekijken op rustdag");
  } finally {
    view.rtl.cleanup();
  }
});

// 3) lege dag -> eerlijke lege toestand + "Training toevoegen"
test("core-plan: lege dag toont lege toestand en Training toevoegen", async () => {
  planWindowResult = { isLoading: false, isError: false, refetch: () => {}, data: [] }; // Niets gepland
  sessionsResult = { data: [], isLoading: false };

  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Geen training gepland"), "Lege toestand tekst zichtbaar");
    assert.ok(text.includes("Training toevoegen"), "Actie Training toevoegen zichtbaar");
  } finally {
    view.rtl.cleanup();
  }
});

// 4) laadtoestand
test("core-plan: laadtoestand toont skelet", async () => {
  planWindowResult = { isLoading: true, isError: false, refetch: () => {}, data: undefined };
  sessionsResult = { data: [], isLoading: false };

  const view = await renderPage();
  try {
    const skeletons = view.container.querySelectorAll(".animate-pulse");
    assert.ok(skeletons.length > 0 || view.container.textContent!.includes("Laden"), "Toont laadindicator of skelet");
  } finally {
    view.rtl.cleanup();
  }
});

// 5) fouttoestand met stale data -> foutmelding zichtbaar en geen plandagen
test("core-plan: fouttoestand wint van stale cache", async () => {
  const lib = await shellLibPromise;
  const today = lib.localISODate();

  planWindowResult = {
    isLoading: false,
    isError: true,
    data: [{ id: 3, scheduledDate: today, title: "Stale Rit", type: "ride", targetDurationMin: null, targetTSS: null, description: null, status: "planned", source: "sparki", sessionId: null, routeId: null, planDetails: null, structure: null }],
    refetch: () => {}
  };
  sessionsResult = { data: [], isLoading: false };

  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Schema kon niet geladen worden"), "Foutmelding zichtbaar");
    assert.ok(!text.includes("Stale Rit"), "Geen stale cache data zichtbaar");
    assert.ok(!text.includes("Kies een dag"), "Geen weeknavigatie (DsWeek) bij fout");
  } finally {
    view.rtl.cleanup();
  }
});

// ── Taak 450: "Vandaag eerst" — verklaarde dagstaten + automatische verbanden ──

// 6) Vandaag-blok trainingsdag: eyebrow, doel-zin, opbouw en verwachte TSS
test("core-plan: Vandaag-blok toont verklaarde trainingsdag met doel en TSS", async () => {
  const lib = await shellLibPromise;
  const today = lib.localISODate();

  planWindowResult = {
    isLoading: false,
    isError: false,
    refetch: () => {},
    data: [{
      id: 10, scheduledDate: today, title: "Intervallen Z4", type: "interval",
      targetDurationMin: 75, targetTSS: 88, description: null,
      status: "planned", source: "sparki", sessionId: null, routeId: null, planDetails: null,
      structure: {
        phase: "peak", week: 2, intensity: "hard", primaryZone: 4, routeNeed: "indoor_ok",
        equipment: [], recoveryAdvice: "",
        blocks: [
          { kind: "warmup", label: "opwarming", durationMin: 20, zone: 2, targetPctFtp: 60 },
          { kind: "interval", label: "interval", durationMin: 8, zone: 4, targetPctFtp: 105, reps: 4 },
          { kind: "cooldown", label: "afkoelen", durationMin: 15, zone: 2, targetPctFtp: 55 },
        ],
        rationale: {
          whyToday: "x", supportsGoal: "Bouwt FTP-tolerantie op richting je 285W-test.",
          whatToFeel: "", tooHardSigns: "", tooLightSigns: "", safeAdjust: "",
        },
      },
    }],
  };
  planResult = { data: { plan: { mode: "autonomous" }, hasCoach: false, inputs: { phase: "peak", nextRace: null } } };
  sessionsResult = { data: [], isLoading: false };
  readinessResult = {};

  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Trainingsdag"), "Staat 'Trainingsdag' zichtbaar");
    assert.ok(text.includes("Bouwt FTP-tolerantie op richting je 285W-test."), "Doel-zin zichtbaar");
    assert.ok(text.includes("4×8 min interval (Z4)"), "Opbouw met zones/duur per onderdeel zichtbaar");
    assert.ok(text.includes("88 TSS verwacht"), "Verwachte TSS zichtbaar");
  } finally {
    view.rtl.cleanup();
  }
});

// 7) Ongepland gat in piekfase: expliciet gelabeld + waarschuwing
test("core-plan: ongepland gat in piekfase toont 'Nog niet ingepland' + waarschuwing", async () => {
  planWindowResult = { isLoading: false, isError: false, refetch: () => {}, data: [] };
  planResult = { data: { plan: { mode: "autonomous" }, hasCoach: false, inputs: { phase: "peak", nextRace: { name: "NK", raceDate: "2099-01-01", priority: "A", daysAway: 20 } } } };
  sessionsResult = { data: [], isLoading: false };

  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Nog niet ingepland"), "Gat expliciet gelabeld");
    assert.ok(text.includes("piekfase-week"), "Piekfase-waarschuwing zichtbaar");
    assert.ok(text.includes("Week "), "Doelkaart koppelt aan de huidige week");
  } finally {
    view.rtl.cleanup();
  }
});

// 8) Rustdag vandaag: 'onderdeel van [fase]' + reden, geen leeg blok
test("core-plan: rustdag vandaag toont fase en reden", async () => {
  const lib = await shellLibPromise;
  const today = lib.localISODate();
  planWindowResult = {
    isLoading: false, isError: false, refetch: () => {},
    data: [{ id: 11, scheduledDate: today, title: "Rust", type: "rest", targetDurationMin: null, targetTSS: null, description: "Herstel na de lange duurrit van gisteren.", status: "planned", source: "sparki", sessionId: null, routeId: null, planDetails: null, structure: null }],
  };
  planResult = { data: { plan: { mode: "autonomous" }, hasCoach: false, inputs: { phase: "taper", nextRace: { name: "NK", raceDate: "2099-01-01", priority: "A", daysAway: 5 } } } };
  sessionsResult = { data: [], isLoading: false };

  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Bewuste rustdag"), "Staat 'Bewuste rustdag' zichtbaar");
    assert.ok(text.includes("onderdeel van de taperweek"), "Fase-koppeling zichtbaar");
    assert.ok(text.includes("Herstel na de lange duurrit van gisteren."), "Reden zichtbaar");
  } finally {
    view.rtl.cleanup();
  }
});

// 9) Verbanden: knop weg, eerlijke specifieke lege staat uit de datastatus
test("core-plan: verbanden tonen specifieke eerlijke lege staat zonder losse knop", async () => {
  planWindowResult = { isLoading: false, isError: false, refetch: () => {}, data: [] };
  planResult = { data: { plan: null, hasCoach: false } };
  sessionsResult = { data: [{ id: 1, sessionDate: "2026-07-01", type: "ride", title: "Rit", durationMin: 60, tss: 50, source: "manual", feelScore: null }], isLoading: false };
  observationsResult = { data: { observations: [], groups: {} } };
  readinessResult = {
    isLoading: false,
    data: {
      windowDays: 45,
      analyseMogelijk: false,
      stappen: [
        { id: "trainingen", titel: "Log of importeer trainingen", uitleg: "", heb: 0, nodig: 4, klaar: false, actie: "logtraining" },
        { id: "gevoel_slaap", titel: "Gevoel en slaap", uitleg: "", heb: 1, nodig: 4, klaar: false, actie: "checkin" },
      ],
    },
  };
  runConnectionsResult = { isPending: false, mutate: () => { throw new Error("mag niet automatisch zoeken zonder genoeg data"); }, isSuccess: false };

  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(!text.includes("Verbanden analyseren"), "Losse analyse-knop is weg");
    assert.ok(text.includes("Nog 4 trainingen nodig voor een betrouwbaar verband."), "Specifieke eerlijke lege staat");
    assert.ok(text.includes("Nog 3 trainingsdagen met gevoel én slaapuren"), "Slaap/herstel-behoefte specifiek benoemd");
  } finally {
    view.rtl.cleanup();
  }
});

// 10) Verbanden: auto-analyse start zodra er genoeg data is en niets vastligt
test("core-plan: verbanden-analyse start automatisch bij genoeg data", async () => {
  planWindowResult = { isLoading: false, isError: false, refetch: () => {}, data: [] };
  planResult = { data: { plan: null, hasCoach: false } };
  sessionsResult = { data: [], isLoading: false };
  observationsResult = { data: { observations: [], groups: {} } };
  readinessResult = { isLoading: false, data: { windowDays: 45, analyseMogelijk: true, stappen: [] } };
  let calls = 0;
  runConnectionsResult = { isPending: false, mutate: () => { calls += 1; }, isSuccess: false };

  const view = await renderPage();
  try {
    assert.equal(calls, 1, "Analyse automatisch gestart (precies één keer)");
    const text = view.container.textContent ?? "";
    assert.ok(!text.includes("Verbanden analyseren"), "Geen handmatige knop");
  } finally {
    view.rtl.cleanup();
  }
});

// 11) Ontwikkeling: CTL-trendregel koppelt expliciet aan het doel en signaleert afwijking
test("core-plan: ontwikkelingsregel koppelt CTL-trend aan het doel", async () => {
  planWindowResult = { isLoading: false, isError: false, refetch: () => {}, data: [] };
  planResult = { data: { plan: { mode: "autonomous" }, hasCoach: false, inputs: { phase: "build", nextRace: { name: "FTP-test", raceDate: "2099-10-01", priority: "A", daysAway: 40 } } } };
  sessionsResult = { data: [], isLoading: false };
  observationsResult = { data: { observations: [], groups: {} } };
  readinessResult = { isLoading: false, data: { windowDays: 45, analyseMogelijk: false, stappen: [] } };
  runConnectionsResult = { isPending: false, mutate: () => {}, isSuccess: false };
  // 20 dagen vlakke CTL → stagnatie in de opbouwfase = zichtbaar signaal
  loadResult = {
    isLoading: false,
    data: { ctl: 35, atl: 30, tsb: 5, chartData: Array.from({ length: 20 }, (_, i) => ({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, ctl: 35, atl: 30, tsb: 5, tss: 0 })) },
  };

  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("richting FTP-test"), "Trend expliciet aan het doel gekoppeld");
    assert.ok(text.includes("stagneert"), "Afwijking van het opbouwtempo gesignaleerd");
  } finally {
    view.rtl.cleanup();
  }
});
