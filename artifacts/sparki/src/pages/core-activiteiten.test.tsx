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
};

let sessionsResult: HookResult;
let loadResult: HookResult;
const navCalls: string[] = [];

mock.module("@/hooks/use-sessions", {
  namedExports: {
    useSessions: () => sessionsResult,
    useSessionDetail: () => ({ data: null }),
    useSessionSegments: () => ({ data: null }),
    useLogSession: () => ({ mutate: () => {} }),
    useUpdateSessionFeel: () => ({ mutate: () => {} }),
  },
});

mock.module("@clerk/react", {
  namedExports: {
    useUser: () => ({ isSignedIn: true, user: { id: "user_1" } }),
  },
});

mock.module("@/hooks/use-athlete-extended-profile", {
  namedExports: {
    useAthleteExtendedProfile: () => ({ data: null }),
  },
});

mock.module("@/hooks/use-humor", {
  namedExports: {
    useHumorLine: () => "Mock humor line",
  },
});

mock.module("@/components/viz/uitleg", {
  namedExports: {
    UitlegDot: () => null,
  },
});

mock.module("@/lib/api", {
  namedExports: {
    apiFetch: async () => ({}),
    API_BASE: "",
  },
});

mock.module("@/hooks/use-load", {
  namedExports: {
    useLoad: () => loadResult,
  },
});

mock.module("@/lib/dev", {
  namedExports: {
    DEV_PREVIEW: false,
    useDevPreview: () => false,
    getDevAthleteId: () => 1,
  },
});

mock.module("wouter", {
  namedExports: {
    useLocation: () => [
      "/activiteiten",
      (href: string) => {
        navCalls.push(href);
      },
    ],
    useSearch: () => "",
    Link: (props: { href?: string; children?: unknown; className?: string }) =>
      (globalThis as { React?: { createElement: CallableFunction } }).React!
        .createElement("a", { href: props.href, className: props.className },
          props.children as never),
  },
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
const componentPromise = import("./core-activiteiten");
const libPromise = import("@/lib/commercial-shell");

function makeSession(id: number, overrides: any = {}) {
  return {
    id,
    athleteId: 1,
    source: "sparki",
    type: "endurance",
    sessionDate: "2023-08-15",
    title: "Rit " + id,
    ...overrides,
  };
}

function okResult(data: unknown): HookResult {
  return { data, isLoading: false, isError: false, refetch: () => {} };
}

function errorResult(onRetry: () => void): HookResult {
  return { data: undefined, isLoading: false, isError: true, refetch: onRetry };
}

mock.module("@/hooks/use-ride-story", {
  namedExports: {
    useRideStory: () => ({ data: null }),
    useRideStoryFlag: () => false,
  },
});


async function renderPage() {
  const React = (await reactPromise).default;
  (globalThis as Record<string, unknown>).React = React;
  
  const rtl = await rtlPromise;
  const { default: CoreActiviteitenPage } = await componentPromise;
  const utils = rtl.render(React.createElement(CoreActiviteitenPage));
  return { ...utils, rtl, React };
}

test("empty state with connection action", async () => {
  sessionsResult = okResult([]);
  loadResult = okResult({ chartData: [] });
  navCalls.length = 0;

  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Nog geen ritten"));
    assert.ok(text.includes("Koppeling instellen"));

    const action = Array.from(view.container.querySelectorAll("button")).find(
      (b) => b.textContent === "Koppeling instellen"
    );
    assert.ok(action, "Koppeling instellen button present");
    view.rtl.fireEvent.click(action!);
    assert.deepEqual(navCalls, ["/you?focus=connections"]);
  } finally {
    view.rtl.cleanup();
  }
});

test("error state with stale data -> shows error, no list", async () => {
  let retries = 0;
  sessionsResult = {
    data: [makeSession(1)], // stale data
    isLoading: false,
    isError: true,
    refetch: () => { retries++ }
  };
  loadResult = okResult({ chartData: [] });

  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Je ritten konden niet geladen worden."));
    assert.ok(!text.includes("Rit 1"), "Stale data must not be shown");

    const retry = Array.from(view.container.querySelectorAll("button")).find(
      (b) => b.textContent === "Opnieuw proberen"
    );
    assert.ok(retry);
    view.rtl.fireEvent.click(retry!);
    assert.equal(retries, 1);
  } finally {
    view.rtl.cleanup();
  }
});

test("list with real rides, missing metrics -> no zeroes, honest message", async () => {
  sessionsResult = okResult([
    makeSession(1, { durationMin: 120, distanceKm: "60", type: "endurance" }),
    makeSession(2, { durationMin: null, distanceKm: null, type: "race", title: "No metrics" })
  ]);
  loadResult = okResult({ chartData: [] });

  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("120 min"), "Real metric shown");
    assert.ok(text.includes("60 km"), "Real metric shown");
    
    assert.ok(!/\b0 min\b/.test(text), "No zeroes " + text);
    assert.ok(!/\b0 km\b/.test(text), "No zeroes " + text);

    assert.ok(text.includes("Nog geen meetgegevens"), "Honest message shown for missing metrics");
    
    const summaryCount = Array.from(view.container.querySelectorAll(".num")).find(n => n.textContent === "2");
    assert.ok(summaryCount, "Summary count is 2");
  } finally {
    view.rtl.cleanup();
  }
});

test("filters present and working", async () => {
  sessionsResult = okResult([
    makeSession(1, { title: "Zondagsrit", type: "endurance", sessionDate: "2023-08-15" }),
    makeSession(2, { title: "Dinsdaginterval", type: "interval", sessionDate: "2023-08-10" })
  ]);
  loadResult = okResult({ chartData: [] });

  const view = await renderPage();
  try {
    const text = view.container.textContent ?? "";
    assert.ok(text.includes("Zondagsrit"));
    assert.ok(text.includes("Dinsdaginterval"));

    const intervalChip = Array.from(view.container.querySelectorAll("button")).find(
      (b) => b.textContent === "Intervaltraining"
    );
    assert.ok(intervalChip);
    view.rtl.fireEvent.click(intervalChip!);

    const newText = view.container.textContent ?? "";
    assert.ok(newText.includes("Dinsdaginterval"));
    assert.ok(!newText.includes("Zondagsrit"), "Zondagsrit is filtered out");

    const allesChip = Array.from(view.container.querySelectorAll("button")).find(
      (b) => b.textContent === "Alles"
    );
    view.rtl.fireEvent.click(allesChip!);
    const clearedText = view.container.textContent ?? "";
    assert.ok(clearedText.includes("Duur"));
  } finally {
    view.rtl.cleanup();
  }
});
