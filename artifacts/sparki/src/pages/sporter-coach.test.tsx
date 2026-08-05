// Taak #612 — bewaak dat de sporter-coach-pagina niet stil kan breken.
//
// Twee vangnetten:
//   1. groepeerWeken — de pure weekgroepering van plan-dagen: volgorde,
//      fase (via de echte plan-overview-logica), sessietelling (rust telt
//      niet mee) en minutentelling.
//   2. de rol-switch op /coach — coachrol krijgt CoachHome (roster),
//      sporterrol de eigen coach-omgeving (SporterCoachPage).
//
// Run: pnpm --filter @workspace/sparki run test:sporter-coach

import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// ── Bestuurbare toestand ────────────────────────────────────────────────────
type Role = "coach" | "athlete" | "parent";
let role: Role = "athlete";
let planData: unknown = undefined;

function el(tag: string, props: Record<string, unknown> | null, ...children: unknown[]) {
  const React = (globalThis as Record<string, unknown>).React as typeof import("react");
  return React.createElement(tag, props, ...(children as never[]));
}

// ── Mocks — volledig import-oppervlak van sporter-coach.tsx ─────────────────

mock.module("wouter", {
  namedExports: {
    Link: (props: Record<string, unknown>) =>
      el("a", { href: props.href as string }, props.children),
  },
});

mock.module("lucide-react", {
  namedExports: {
    CalendarDays: () => null,
    ChevronRight: () => null,
    Flag: () => null,
    MessageCircle: () => null,
    TrendingUp: () => null,
  },
});

mock.module("@/components/sparki/commercial-shell", {
  namedExports: {
    CommercialShell: (props: Record<string, unknown>) =>
      el("div", { "data-testid": "sporter-coach-omgeving" }, props.children),
  },
});

mock.module("@/components/sparki/coach-home", {
  namedExports: {
    CoachHome: () => el("div", { "data-testid": "coach-home" }, "Rooster"),
  },
});

mock.module("@/contexts/UserContext", {
  namedExports: {
    useUserProfile: () => ({ profile: { clerkId: "u_1", activeRole: role } }),
  },
});

mock.module("@/hooks/use-training-plan", {
  namedExports: {
    useTrainingPlan: () => ({ data: planData, isLoading: false, isError: false }),
  },
});

mock.module("@/hooks/use-load", {
  namedExports: {
    useLoad: () => ({ data: undefined, isLoading: false }),
  },
});

mock.module("@/hooks/use-athlete-dashboard", {
  namedExports: {
    useAthleteDashboard: () => ({ data: undefined }),
  },
});

mock.module("@/hooks/use-races", {
  namedExports: {
    useRaceContext: () => ({ context: null }),
  },
});

mock.module("@/hooks/use-ai-memory", {
  namedExports: {
    useObservations: () => ({ data: undefined, isLoading: false }),
  },
});

// coach-engine en lib/plan-overview zijn puur (geen imports met bijwerkingen)
// en blijven ECHT — zo toetst de fase-uitkomst de werkelijke faseVoorDatum.

// mock.module eerst, dan pas lazy laden (tsx CJS-transform, zie memory).
const pagePromise = import("./sporter-coach");
const rtlPromise = import("@testing-library/react");
const reactPromise = import("react");

async function renderSwitch() {
  const page = await pagePromise;
  const rtl = await rtlPromise;
  const React = (await reactPromise).default;
  (globalThis as Record<string, unknown>).React = React;
  return rtl.render(React.createElement(page.CoachSwitchPage));
}

type PlanDay = import("@/hooks/use-training-plan").PlanDay;

function dag(over: Partial<PlanDay> & { dayDate: string; weekIndex: number }): PlanDay {
  return {
    id: Math.round(Math.random() * 1e9),
    focus: "Duurrit",
    trainingType: "endurance",
    intensityLabel: null,
    estDurationMin: 60,
    isRest: false,
    routeNeeded: false,
    rationale: null,
    adaptationReason: null,
    committed: false,
    workout: null,
    route: null,
    weather: null,
    trainingAdvisory: null,
    nutritionAdvisory: null,
    ...over,
  } as PlanDay;
}

// ── 1. groepeerWeken ────────────────────────────────────────────────────────

test("groepeerWeken: weken gesorteerd, sessies zonder rust, minuten opgeteld", async () => {
  const { groepeerWeken } = await pagePromise;

  const days: PlanDay[] = [
    // Week 1 (bewust vóór week 0 in de input — sortering moet dit rechtzetten)
    dag({ dayDate: "2026-08-12", weekIndex: 1, estDurationMin: 90 }),
    dag({ dayDate: "2026-08-10", weekIndex: 1, isRest: true, estDurationMin: null }),
    // Week 0 — ook binnen de week ongesorteerd aangeleverd
    dag({ dayDate: "2026-08-05", weekIndex: 0, estDurationMin: 45 }),
    dag({ dayDate: "2026-08-03", weekIndex: 0, estDurationMin: 60 }),
    dag({ dayDate: "2026-08-04", weekIndex: 0, isRest: true, estDurationMin: null }),
  ];

  const weken = groepeerWeken(days, null);

  assert.equal(weken.length, 2, "twee weekgroepen");
  assert.deepEqual(
    weken.map((w) => w.weekIndex),
    [0, 1],
    "weken oplopend gesorteerd",
  );

  const w0 = weken[0]!;
  assert.deepEqual(
    w0.dagen.map((d) => d.dayDate),
    ["2026-08-03", "2026-08-04", "2026-08-05"],
    "dagen binnen de week op datum gesorteerd",
  );
  assert.equal(w0.maandagISO, "2026-08-03", "maandag van week 0 (3 aug is een maandag)");
  assert.equal(w0.sessies, 2, "rustdag telt niet als sessie");
  assert.equal(w0.minuten, 105, "minuten = som van trainingsdagen (60+45)");
  assert.equal(w0.fase, null, "zonder wedstrijddatum geen fase");

  const w1 = weken[1]!;
  assert.equal(w1.maandagISO, "2026-08-10", "maandag van week 1");
  assert.equal(w1.sessies, 1);
  assert.equal(w1.minuten, 90);
});

test("groepeerWeken: fase per week volgt de wedstrijddatum", async () => {
  const { groepeerWeken } = await pagePromise;
  // Wedstrijd op 2026-08-16: week die op 2026-08-10 begint zit vlak voor de
  // wedstrijd (taper); een week ver ervoor (2026-06-01) is basisperiode.
  const days: PlanDay[] = [
    dag({ dayDate: "2026-06-01", weekIndex: 0 }),
    dag({ dayDate: "2026-08-10", weekIndex: 10 }),
  ];
  const weken = groepeerWeken(days, "2026-08-16");
  assert.equal(weken[0]!.fase, "base", "ver van de wedstrijd = base");
  assert.equal(weken[1]!.fase, "taper", "week vlak voor de wedstrijd = taper");

  // Wedstrijd in het verleden ⇒ geen fase (eerlijk null, niet verzonnen).
  const naDeWedstrijd = groepeerWeken(
    [dag({ dayDate: "2026-08-20", weekIndex: 0 })],
    "2026-08-16",
  );
  assert.equal(naDeWedstrijd[0]!.fase, null, "na de wedstrijddatum geen fase");
});

test("groepeerWeken: null-duur telt als 0 minuten, lege input = lege lijst", async () => {
  const { groepeerWeken } = await pagePromise;
  assert.deepEqual(groepeerWeken([], null), []);
  const weken = groepeerWeken(
    [dag({ dayDate: "2026-08-03", weekIndex: 0, estDurationMin: null })],
    null,
  );
  assert.equal(weken[0]!.sessies, 1);
  assert.equal(weken[0]!.minuten, 0);
});

// ── 2. rol-switch ───────────────────────────────────────────────────────────

test("coachrol op /coach krijgt CoachHome (roster), niet de sporterpagina", async () => {
  role = "coach";
  const view = await renderSwitch();
  try {
    assert.ok(view.container.querySelector('[data-testid="coach-home"]'), "CoachHome");
    assert.equal(
      view.container.querySelector('[data-testid="sporter-coach-omgeving"]'),
      null,
      "geen sporter-coach-omgeving voor de trainer",
    );
  } finally {
    view.unmount();
  }
});

test("sporterrol op /coach krijgt de eigen coach-omgeving", async () => {
  role = "athlete";
  planData = undefined;
  const view = await renderSwitch();
  try {
    assert.ok(
      view.container.querySelector('[data-testid="sporter-coach-omgeving"]'),
      "sporter-coach-omgeving",
    );
    assert.equal(view.container.querySelector('[data-testid="coach-home"]'), null);
    const text = view.container.textContent!;
    assert.ok(text.includes("Doellijn"), "doellijn-kaart aanwezig");
    assert.ok(text.includes("Het complete plan"), "weekplan-kaart aanwezig");
  } finally {
    view.unmount();
  }
});

test("sporter met plan ziet de weekgroepen ook echt gerenderd", async () => {
  role = "athlete";
  planData = {
    plan: { id: 1, name: "Plan", maker: "Sparki", source: "auto", createdAt: "", goal: "Fit worden", mode: "autonomous", status: "active" },
    inputs: { nextRace: null, phase: null },
    days: [
      dag({ dayDate: "2026-08-03", weekIndex: 0, estDurationMin: 60 }),
      dag({ dayDate: "2026-08-04", weekIndex: 0, isRest: true, estDurationMin: null }),
    ],
  };
  const view = await renderSwitch();
  try {
    const text = view.container.textContent!;
    assert.ok(text.includes("Week 1"), "weekkop (weekIndex 0 → 'Week 1')");
    assert.ok(text.includes("1 sessie"), "sessietelling gerenderd zonder rustdag");
    assert.ok(text.includes("1 u"), "minutentelling gerenderd (60 min → 1 u)");
  } finally {
    view.unmount();
    planData = undefined;
  }
});
