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
