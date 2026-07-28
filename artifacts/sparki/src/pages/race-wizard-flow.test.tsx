// Race-wizard flow test — the 5-step wizard end-to-end through the UI.
//
// Opens the races page with ?step=1 (the dev deep-link that opens the wizard
// directly at step 1), overwrites naam/datum/locatie in stap 1, clicks through
// stap 2 (afgeleid), stap 3 (aanvullen), accepts Sparki's voorstel in stap 4
// (priority + doel), and saves in stap 5. Asserts the create-race mutation
// receives exactly the confirmed priority + goal. The DB half of the contract
// (POST /api/races persists that row) is covered by the api-server test
// `test:race-wizard`.
//
// Run: `pnpm --filter @workspace/sparki run test:race-wizard-flow`

import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({ url: "http://localhost/races?step=1" });
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// ── Mocks — full import surface of races.tsx + race-wizard.tsx ──────────────

mock.module("wouter", {
  namedExports: {
    useLocation: () => ["/races", (_href: string) => {}],
    useSearch: () => "",
    useRoute: () => [false, null],
    useParams: () => ({}),
    Link: (props: any) => {
      const React = (globalThis as any).React;
      return React.createElement("a", { href: props.href }, props.children);
    },
  },
});

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
    ACCENT: "rgba(120,210,230,0.9)",
    SectionLabel: (props: any) => {
      const React = (globalThis as any).React;
      return React.createElement("span", null, props.children);
    },
  },
});

mock.module("@/components/sparki/home-sections", {
  namedExports: {
    Skeleton: (props: any) => {
      const React = (globalThis as any).React;
      return React.createElement("div", { className: props.className });
    },
  },
});

const nullComponent = () => null;
mock.module("@/components/sparki/missing-input-notice", {
  namedExports: { MissingInputNotice: nullComponent },
});
mock.module("@/components/sparki/import-from-calendar", {
  namedExports: { ImportFromCalendar: nullComponent },
});
mock.module("@/components/sparki/equipment-choice", {
  namedExports: { EquipmentChoicePanel: nullComponent },
});
mock.module("@/components/sparki/race-points-panel", {
  namedExports: { RacePointsPanel: nullComponent },
});
mock.module("@/components/sparki/race-export-center", {
  namedExports: { RaceExportCenter: nullComponent },
});

mock.module("@/hooks/use-missing-input", {
  namedExports: {
    useFixParams: () => ({ focus: null }),
    useStartFix: () => () => {},
    useCompleteFix: () => () => {},
    useRetryAction: () => {},
  },
});

mock.module("@/hooks/use-social", {
  namedExports: { useFriends: () => ({ data: [], isLoading: false }) },
});

// ── use-races: the wizard's data surface, fully controlled here ─────────────

// Sparki's deterministic proposal for step 4. Priority C on purpose: the demo
// form starts at "A", so the assertion below proves ACCEPTING the proposal is
// what lands in the save payload — not a leftover default.
const PROPOSAL = {
  priority: {
    value: "C" as const,
    rationale: "Je hebt al 2 A-wedstrijden dit seizoen gepland.",
    confidence: 0.62,
  },
  goal: {
    text: "Zo lang mogelijk vooraan meerijden en de koersstijl observeren.",
    rationale: "Technische leerschool boven pure plaatsing.",
  },
  preparation: {
    text: "Race-week: verlaag het volume fors en slaap goed.",
    rationale: "7 dagen — herstel is de enige variabele.",
  },
  basis: "Gebaseerd op: ervaring: intermediate, 2 A-doelen dit seizoen.",
};

const INSIGHT = {
  weather: {
    available: false,
    reason: "too_far" as const,
    locationLabel: null,
    weather: null,
    advisory: null,
  },
  travel: {
    available: false,
    reason: "no_home" as const,
    fromLabel: null,
    toLabel: null,
    straightLineKm: null,
  },
  departureSuggestion: null,
  logistics: {
    arrivalBufferMin: 60,
    registrationMin: 20,
    warmupMin: 20,
    callUpMin: 10,
    breakfastBeforeDepartureMin: 90,
    rationale: "Standaard wegkoers-logistiek.",
  },
};

const savedInputs: any[] = [];
const noopMutation = () => ({
  isPending: false,
  mutate: () => {},
  mutateAsync: async () => ({}),
});
const noopQuery = () => ({ data: undefined, isLoading: false, isError: false });

mock.module("@/hooks/use-races", {
  namedExports: {
    useRaces: () => ({ data: [], isLoading: false }),
    useRaceContext: () => ({ context: null, isLoading: false }),
    useCreateRace: () => ({
      isPending: false,
      mutate: (input: any, opts?: { onSuccess?: () => void }) => {
        savedInputs.push(input);
        opts?.onSuccess?.();
      },
      mutateAsync: async (input: any) => {
        savedInputs.push(input);
        return { id: 1, ...input };
      },
    }),
    useUpdateRace: noopMutation,
    useDeleteRace: noopMutation,
    useRaceInsight: () => ({ data: INSIGHT, isLoading: false }),
    useRaceWerkblad: noopQuery,
    useRaceWizardProposal: () => ({ data: PROPOSAL, isLoading: false }),
    useUpdateRaceChecklist: noopMutation,
  },
});

const reactPromise = import("react");
const rtlPromise = import("@testing-library/react");
const pagePromise = import("./races");

test("race-wizard: ?step=1 → invullen → stappen 2-4 → voorstel accepteren → opslaan met juiste priority + goal", async () => {
  // The dev deep-link (?step=1) is baked into the happy-dom URL above so the
  // page reads it exactly like the browser would.
  const React = (await reactPromise).default;
  (globalThis as any).React = React;
  const rtl = await rtlPromise;
  const { default: RacesPage } = await pagePromise;

  const view = rtl.render(React.createElement(RacesPage));
  try {
    const text = () => view.container.textContent ?? "";

    // Stap 1 — wizard open at Basis.
    assert.ok(text().includes("Race toevoegen"), "wizard header visible at step 1");
    assert.ok(text().includes("Basis"), "step indicator shows Basis");

    // Fill naam + datum + locatie (overwriting the demo prefill proves the
    // inputs are live, not static text).
    const nameInput = view.getByPlaceholderText("Omloop Het Nieuwsblad") as HTMLInputElement;
    rtl.fireEvent.change(nameInput, { target: { value: "Testkoers Gent" } });
    const dateInput = view.container.querySelector('input[type="date"]') as HTMLInputElement;
    assert.ok(dateInput, "date input present");
    rtl.fireEvent.change(dateInput, { target: { value: "2027-06-15" } });
    const locInput = view.getByPlaceholderText("Gent, Vlaanderen") as HTMLInputElement;
    rtl.fireEvent.change(locInput, { target: { value: "Oudenaarde" } });

    rtl.fireEvent.click(view.getByText("Volgende"));

    // Stap 2 — Automatisch ingevuld (honest gaps rendered, never fabricated).
    assert.ok(text().includes("Automatisch ingevuld"), "step 2 visible");
    rtl.fireEvent.click(view.getByText("Akkoord, door"));

    // Stap 3 — Aanvullen (demo data leaves nothing missing → direct door).
    assert.ok(text().includes("Aanvullen"), "step 3 visible");
    rtl.fireEvent.click(
      view.queryByText("Door naar voorstel") ?? view.getByText("Doorgaan"),
    );

    // Stap 4 — Sparki's voorstel: accept every proposal (priority, doel, prep).
    assert.ok(text().includes("Sparki's voorstel"), "step 4 visible");
    assert.ok(
      text().includes(PROPOSAL.priority.rationale),
      "priority rationale shown to the athlete",
    );
    // Click accept buttons until none remain in idle state.
    for (let i = 0; i < 5; i++) {
      const btn = view.queryAllByText("Accepteren")[0];
      if (!btn) break;
      rtl.fireEvent.click(btn);
    }
    assert.equal(view.queryAllByText("Accepteren").length, 0, "all proposals accepted");
    rtl.fireEvent.click(view.getByText("Naar samenvatting"));

    // Stap 5 — Samenvatting + opslaan.
    assert.ok(text().includes("Samenvatting"), "step 5 visible");
    assert.ok(
      text().includes("Voorstel geaccepteerd"),
      "summary groups the accepted proposal fields by source",
    );
    rtl.fireEvent.click(view.getByText("Wedstrijd opslaan"));
    // handleWizardSave awaits mutateAsync; flush microtasks.
    await new Promise((r) => setTimeout(r, 0));

    assert.equal(savedInputs.length, 1, "exactly one create-race call");
    const input = savedInputs[0];
    assert.equal(input.name, "Testkoers Gent", "saved name is what was typed in step 1");
    assert.equal(input.raceDate, "2027-06-15", "saved date is what was typed in step 1");
    assert.equal(input.location, "Oudenaarde", "saved location is what was typed in step 1");
    assert.equal(
      input.priority,
      PROPOSAL.priority.value,
      "saved priority equals the ACCEPTED proposal (demo default was A, proposal C)",
    );
    assert.equal(
      input.goal,
      PROPOSAL.goal.text,
      "saved goal equals the accepted proposal text",
    );
    assert.equal(input.status, "gepland", "new race saves as gepland");
  } finally {
    rtl.cleanup();
  }
});
