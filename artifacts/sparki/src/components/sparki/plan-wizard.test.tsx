// Pagetest voor de adaptieve plan-wizard (/train): loopt de volledige flow
// door (niveau → dagen/uren → agenda-periode → bouwen) tegen een fake server
// en verifieert twee harde garanties:
//   1. het gegenereerde plan plant om de opgegeven drukke periode heen;
//   2. agenda-writes zijn persist vóórdat het genereren start — wisselt die
//      volgorde (of verdwijnt de agendaBezig-poort), dan faalt deze test.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// ── Fake server ──────────────────────────────────────────────────────────────
// Bootst de echte keten na: POST /api/athlete/life-events persisteert een
// event; POST /api/training-plan/generate leest de op dát moment persisted
// events (precies zoals de echte generator de leefagenda uit de DB leest) en
// plant om periodes met impact "geen_training" heen.

type FakeEvent = {
  id: number;
  kind: string;
  title: string;
  startDate: string;
  endDate: string | null;
  impact: string;
};

type GenerateCall = {
  profileSaved: boolean;
  eventsAtCall: FakeEvent[];
};

const server = {
  events: [] as FakeEvent[],
  profile: null as Record<string, unknown> | null,
  addEventDelayMs: 0,
  generateCalls: [] as GenerateCall[],
  reset() {
    this.events = [];
    this.profile = null;
    this.addEventDelayMs = 0;
    this.generateCalls = [];
  },
  async addEvent(body: Omit<FakeEvent, "id">): Promise<{ event: FakeEvent }> {
    if (this.addEventDelayMs > 0)
      await new Promise((r) => setTimeout(r, this.addEventDelayMs));
    const event: FakeEvent = { id: this.events.length + 1, ...body };
    this.events.push(event);
    return { event };
  },
  async saveProfile(input: Record<string, unknown>) {
    this.profile = input;
    return {};
  },
  async generate() {
    // Snapshot van wat er op het moment van genereren persisted is — dit is
    // de kern van de volgorde-garantie.
    this.generateCalls.push({
      profileSaved: this.profile != null,
      eventsAtCall: [...this.events],
    });
    // Deterministische mini-generator: 21 dagen vanaf vandaag; dagen die in
    // een persisted "geen_training"-periode vallen worden rustdag.
    const days: { dayDate: string; isRest: boolean }[] = [];
    const start = new Date();
    for (let i = 0; i < 21; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const busy = this.events.some(
        (e) =>
          e.impact === "geen_training" &&
          iso >= e.startDate &&
          iso <= (e.endDate ?? e.startDate),
      );
      days.push({ dayDate: iso, isRest: busy });
    }
    return { mode: "autonomous", plan: { id: 1 }, days };
  },
};

// ── Hook-mocks (volledig export-oppervlak, echte isPending via useState) ────

function statefulMutation(fn: (body?: unknown) => Promise<unknown>) {
  const React = (globalThis as any).React;
  const [isPending, setPending] = React.useState(false);
  const mutateAsync = async (body?: unknown) => {
    setPending(true);
    try {
      return await fn(body);
    } finally {
      setPending(false);
    }
  };
  return { isPending, mutateAsync, mutate: (b?: unknown) => void mutateAsync(b) };
}

const noopMutation = () => ({ isPending: false, mutate: () => {}, mutateAsync: async () => ({}) });
const noopQuery = () => ({ data: undefined, isLoading: false, isError: false, refetch: () => {} });

type FakeGenerateResult = {
  mode: string;
  plan: { id: number };
  days: { dayDate: string; isRest: boolean }[];
};

let lastGenerateResult: FakeGenerateResult | null = null;

mock.module("@/hooks/use-training-plan", {
  namedExports: {
    useSavePlanSetup: () => statefulMutation((b) => server.saveProfile(b as Record<string, unknown>)),
    useGenerateTrainingPlan: () =>
      statefulMutation(async () => {
        lastGenerateResult = await server.generate();
        return lastGenerateResult;
      }),
    // Rest van het import-oppervlak (niet gebruikt door de wizard zelf, maar
    // mock.module moet het VOLLEDIGE oppervlak dekken):
    usePlanRange: noopQuery,
    usePlanWindow: noopQuery,
    useWorkoutDetail: noopQuery,
    useGeneratePlan: noopMutation,
    useSubmitFeedback: noopMutation,
    useWorkoutExplain: noopMutation,
    useWorkoutExplainExtended: noopMutation,
    useWorkoutAdjust: noopMutation,
    useWorkoutHistory: noopQuery,
    useLinkWorkoutSession: noopMutation,
    useCancelWorkout: noopMutation,
    useApplyProposal: noopMutation,
    useTrainingPlan: noopQuery,
    usePauseTrainingPlan: noopMutation,
    useResumeTrainingPlan: noopMutation,
    useDeleteTrainingPlan: noopMutation,
    useAdaptTrainingPlan: noopMutation,
  },
});

// Leefagenda: query levert de persisted events; add/delete gaan door de fake
// server en verversen de lijst via een render-tick.
mock.module("@/hooks/use-life-events", {
  namedExports: {
    useLifeEvents: () => ({ data: [...server.events] }),
    useAddLifeEvent: () => statefulMutation((b) => server.addEvent(b as Omit<FakeEvent, "id">)),
    useDeleteLifeEvent: () => noopMutation(),
  },
});

const reactPromise = import("react");
const rtlPromise = import("@testing-library/react");
const componentPromise = import("./plan-wizard");

async function renderWizard() {
  const React = (await reactPromise).default;
  (globalThis as any).React = React;
  const rtl = await rtlPromise;
  const { PlanWizard } = await componentPromise;
  const utils = rtl.render(React.createElement(PlanWizard, { missing: [] }));
  return { ...utils, rtl, React };
}

function knop(container: HTMLElement, tekst: string): HTMLButtonElement {
  const alle = Array.from(container.querySelectorAll("button"));
  const b = alle.find((x) => (x.textContent ?? "").trim().startsWith(tekst));
  assert.ok(b, `Knop "${tekst}" niet gevonden`);
  return b as HTMLButtonElement;
}

function isoOverDagen(n: number): string {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

async function tick(rtl: typeof import("@testing-library/react")) {
  await rtl.act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

// ── 1) Volledige flow: plan plant om de drukke periode heen ────────────────
test("plan-wizard: volledige flow bouwt plan dat om de drukke periode heen plant", async () => {
  server.reset();
  lastGenerateResult = null;
  const view = await renderWizard();
  const { container, rtl } = view;
  try {
    // Stap 1: niveau
    await rtl.act(async () => { rtl.fireEvent.click(knop(container, "Recreatief")); });
    await rtl.act(async () => { rtl.fireEvent.click(knop(container, "Volgende")); });

    // Stap 2: dagen + uren
    await rtl.act(async () => {
      rtl.fireEvent.click(knop(container, "Ma"));
      rtl.fireEvent.click(knop(container, "Wo"));
      rtl.fireEvent.click(knop(container, "Za"));
    });
    const urenInput = container.querySelector('input[aria-label="Uren per week"]');
    assert.ok(urenInput, "Ureninput zichtbaar");
    await rtl.act(async () => { rtl.fireEvent.change(urenInput!, { target: { value: "6" } }); });
    await rtl.act(async () => { rtl.fireEvent.click(knop(container, "Volgende")); });

    // Stap 3: agenda — drukke periode over 3 t/m 5 dagen vanaf nu
    const van = isoOverDagen(3);
    const tot = isoOverDagen(5);
    const titelInput = container.querySelector('input[type="text"]');
    assert.ok(titelInput, "Agenda-titelinput zichtbaar");
    await rtl.act(async () => { rtl.fireEvent.change(titelInput!, { target: { value: "Examens" } }); });
    await rtl.act(async () => { rtl.fireEvent.click(knop(container, "Geen training mogelijk")); });
    const dateInputs = Array.from(container.querySelectorAll('input[type="date"]'));
    assert.equal(dateInputs.length, 2, "Van/tot-datuminputs zichtbaar");
    await rtl.act(async () => {
      rtl.fireEvent.change(dateInputs[0]!, { target: { value: van } });
      rtl.fireEvent.change(dateInputs[1]!, { target: { value: tot } });
    });
    await rtl.act(async () => { rtl.fireEvent.click(knop(container, "Periode toevoegen")); });
    await tick(rtl);
    assert.equal(server.events.length, 1, "Agenda-periode is persist na toevoegen");
    assert.ok((container.textContent ?? "").includes("Examens"), "Toegevoegde periode zichtbaar in de lijst");

    await rtl.act(async () => { rtl.fireEvent.click(knop(container, "Volgende")); });

    // Stap 4: samenvatting → bouwen
    assert.ok((container.textContent ?? "").includes("Klopt dit?"), "Samenvatting zichtbaar");
    await rtl.act(async () => { rtl.fireEvent.click(knop(container, "Bouw mijn plan")); });
    await tick(rtl);

    // Setup-keten: profiel opgeslagen met de wizard-antwoorden
    assert.ok(server.profile, "PUT /api/athlete/profile is aangeroepen");
    assert.equal(server.profile!["experienceLevel"], "beginner");
    assert.deepEqual(server.profile!["availableDays"], ["mon", "wed", "sat"]);
    assert.equal(server.profile!["weeklyHourTarget"], 6);

    // Volgorde-garantie: op het moment van genereren was de agenda persist
    // én het profiel opgeslagen.
    assert.equal(server.generateCalls.length, 1, "Genereren precies één keer aangeroepen");
    assert.equal(server.generateCalls[0]!.profileSaved, true, "Profiel was opgeslagen vóór genereren");
    assert.equal(
      server.generateCalls[0]!.eventsAtCall.length,
      1,
      "Drukke periode was persist vóór genereren — wisselt de volgorde, dan faalt dit",
    );

    // Het gebouwde plan plant om de drukke periode heen. (De cast is nodig
    // omdat de toewijzing in een mock-closure gebeurt die TS hier niet ziet.)
    const gen = lastGenerateResult as FakeGenerateResult | null;
    assert.ok(gen, "Genereren gaf een plan terug");
    const busyDays = gen.days.filter((d) => d.dayDate >= van && d.dayDate <= tot);
    assert.equal(busyDays.length, 3, "Drukke periode valt binnen de planhorizon");
    for (const d of busyDays)
      assert.equal(d.isRest, true, `Dag ${d.dayDate} in de drukke periode is geen trainingsdag`);
    assert.ok(
      gen.days.some((d) => !d.isRest),
      "Buiten de drukke periode wordt wél getraind",
    );
  } finally {
    view.rtl.cleanup();
  }
});

// ── 2) Volgorde-poort: bouwen wacht tot de agenda-write persist is ──────────
test("plan-wizard: bouwen start niet terwijl een agenda-write nog onderweg is", async () => {
  server.reset();
  lastGenerateResult = null;
  server.addEventDelayMs = 60; // trage server → write blijft even pending
  const view = await renderWizard();
  const { container, rtl } = view;
  try {
    await rtl.act(async () => { rtl.fireEvent.click(knop(container, "Recreatief")); });
    await rtl.act(async () => { rtl.fireEvent.click(knop(container, "Volgende")); });
    await rtl.act(async () => { rtl.fireEvent.click(knop(container, "Di")); });
    const urenInput = container.querySelector('input[aria-label="Uren per week"]');
    await rtl.act(async () => { rtl.fireEvent.change(urenInput!, { target: { value: "4" } }); });
    await rtl.act(async () => { rtl.fireEvent.click(knop(container, "Volgende")); });

    // Start een agenda-write, maar wacht er NIET op…
    const titelInput = container.querySelector('input[type="text"]');
    await rtl.act(async () => { rtl.fireEvent.change(titelInput!, { target: { value: "Drukke werkweek" } }); });
    await rtl.act(async () => { rtl.fireEvent.click(knop(container, "Geen training mogelijk")); });
    const dateInputs = Array.from(container.querySelectorAll('input[type="date"]'));
    await rtl.act(async () => { rtl.fireEvent.change(dateInputs[0]!, { target: { value: isoOverDagen(2) } }); });
    await rtl.act(async () => { rtl.fireEvent.click(knop(container, "Periode toevoegen")); });

    // …en probeer meteen door te klikken naar bouwen.
    await rtl.act(async () => { rtl.fireEvent.click(knop(container, "Volgende")); });
    await rtl.act(async () => { rtl.fireEvent.click(knop(container, "Bouw mijn plan")); });
    await rtl.act(async () => { await new Promise((r) => setTimeout(r, 10)); });

    // De poort moet dit tegenhouden: nog géén generate, nog géén profiel-save.
    assert.equal(
      server.generateCalls.length,
      0,
      "Genereren mag niet starten terwijl de agenda-write nog pending is",
    );
    assert.equal(server.profile, null, "Profiel-save wacht ook op de agenda-write");

    // Laat de write landen en bouw daarna alsnog.
    await rtl.act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    assert.equal(server.events.length, 1, "Agenda-write is inmiddels persist");
    await rtl.act(async () => { rtl.fireEvent.click(knop(container, "Bouw mijn plan")); });
    await tick(rtl);

    assert.equal(server.generateCalls.length, 1, "Genereren gestart ná de persist");
    assert.equal(
      server.generateCalls[0]!.eventsAtCall.length,
      1,
      "Op het moment van genereren was de drukke periode persist",
    );
    assert.equal(server.generateCalls[0]!.profileSaved, true, "Profiel opgeslagen vóór genereren");
  } finally {
    view.rtl.cleanup();
  }
});
