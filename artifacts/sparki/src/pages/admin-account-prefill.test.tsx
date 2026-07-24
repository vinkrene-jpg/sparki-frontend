// Regressietest voor het vooraf ingevulde eigen account op de adminpagina.
// Legt vast — voor zowel de Gegevensbroncontrole (ProvenanceSection) als de
// Gegevens-opschoning (DataTrustCleanupSection):
//   1. het clerkId-veld wordt éénmalig vooraf ingevuld met het eigen account;
//   2. het veld blijft daarna gewoon bewerkbaar en wordt nooit overschreven
//      terwijl de admin typt (ook niet bij een profielverversing);
//   3. er wordt nooit automatisch een controle/opschoning gestart;
//   4. bij een afwijkend account verschijnt de waarschuwing plus een werkende
//      "Terug naar eigen account"-knop; bij het eigen account de bevestiging.
//
// Run with: pnpm --filter @workspace/sparki run test:admin-account-prefill

import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// ---------------------------------------------------------------------------
// Bestuurbare mocks. mock.module moet vóór de (lazy) import van admin.tsx
// staan; statische imports zouden gehesen worden en de echte modules laden.
// ---------------------------------------------------------------------------

type Profile = {
  clerkId: string;
  email: string;
  displayName: string | null;
} | null;

let currentProfile: Profile = null;

const provenanceCalls: string[] = [];
const cleanupMutateCalls: unknown[] = [];

mock.module("@/contexts/UserContext", {
  namedExports: {
    useUserProfile: () => ({ profile: currentProfile }),
  },
});

mock.module("@/hooks/use-admin-health", {
  namedExports: {
    useAdminProvenance: (clerkId: string) => {
      provenanceCalls.push(clerkId);
      return { data: undefined, isError: false, isFetching: false };
    },
    useAdminDataTrustCleanup: () => ({
      data: undefined,
      isPending: false,
      isError: false,
      mutate: (args: unknown) => {
        cleanupMutateCalls.push(args);
      },
    }),
    useAdminHealth: () => ({ data: undefined }),
    useRunHealthChecks: () => ({ mutate: () => {}, isPending: false }),
    useAdminHealthBatches: () => ({ data: undefined }),
    useAdminScheduledTasks: () => ({ data: undefined }),
    useAdminFeedback: () => ({ data: undefined }),
    useAdminFailedImports: () => ({ data: undefined }),
    useAdminSyncDiagnostics: () => ({ data: undefined }),
    useAdminAiInsights: () => ({ data: undefined }),
    useAdminQuality: () => ({ data: undefined }),
  },
});

mock.module("@/hooks/use-bug-reports", {
  namedExports: {
    useAdminWhoami: () => ({ data: undefined, isLoading: false }),
    useAdminStatus: () => ({ data: undefined }),
    useAdminBugReports: () => ({ data: undefined }),
  },
});

mock.module("@clerk/react", {
  namedExports: {
    useUser: () => ({ isLoaded: true, isSignedIn: true, user: null }),
  },
});

mock.module("wouter", {
  namedExports: {
    Link: (props: { children?: unknown }) => props.children ?? null,
    Redirect: () => null,
  },
});

mock.module("@/lib/dev", {
  namedExports: { DEV_PREVIEW: false },
});

mock.module("@/components/sparki/ui", {
  namedExports: { ACCENT: "oklch(0.82 0.16 200)" },
});

mock.module("@/components/sparki/feedback-inbox", {
  namedExports: { FeedbackInbox: () => null },
});
mock.module("@/components/sparki/release-admin", {
  namedExports: { ReleaseAdminSection: () => null },
});
mock.module("@/components/sparki/knowledge-admin", {
  namedExports: { KennisbankAdminSection: () => null },
});
mock.module("@/components/sparki/support-admin", {
  namedExports: { SupportAdminSection: () => null },
});

mock.module("@/lib/health-status", {
  namedExports: {
    STATUS_META: {
      green: { color: "#0f0", label: "Werkt" },
      orange: { color: "#fa0", label: "Aandacht" },
      red: { color: "#f00", label: "Kapot" },
      grey: { color: "#888", label: "Onbekend" },
    },
    CATEGORY_LABEL: {},
    formatWhen: () => "zojuist",
  },
});

// Lazy imports ná de mocks (geen top-level await: tsx transformeert naar CJS).
const adminPromise = import("./admin");
const rtlPromise = import("@testing-library/react");
const reactPromise = import("react");

const OWN = "clerk_own_123";

function setOwnProfile() {
  currentProfile = {
    clerkId: OWN,
    email: "eigen@sparki.test",
    displayName: "Eigen Tester",
  };
}

type SectionName = "ProvenanceSection" | "DataTrustCleanupSection";

async function renderSection(name: SectionName) {
  const admin = await adminPromise;
  const rtl = await rtlPromise;
  const React = (await reactPromise).default;
  // tsx compileert de JSX in admin.tsx hier met de klassieke runtime
  // (React.createElement) — maak React dus global vóór het renderen.
  (globalThis as Record<string, unknown>).React = React;
  const Section = admin[name];
  const utils = rtl.render(React.createElement(Section));
  const getInput = () =>
    utils.container.querySelector<HTMLInputElement>(
      'input[placeholder="clerkId van de gebruiker…"]',
    )!;
  return { ...utils, rtl, React, Section, getInput };
}

async function runSectionSuite(name: SectionName) {
  setOwnProfile();
  provenanceCalls.length = 0;
  cleanupMutateCalls.length = 0;

  const view = await renderSection(name);
  const { rtl, React, Section, getInput } = view;
  try {
    // 1. Eénmalige prefill met het eigen account + bevestiging.
    assert.equal(getInput().value, OWN, `${name}: veld vooraf ingevuld`);
    assert.ok(
      view.container.textContent!.includes("Dit is jouw huidige account"),
      `${name}: bevestiging eigen account zichtbaar`,
    );
    assert.ok(
      view.container.textContent!.includes("Eigen Tester"),
      `${name}: eigen naam in de bevestiging`,
    );
    assert.equal(
      view.container.textContent!.includes("Terug naar eigen account"),
      false,
      `${name}: geen terugknop bij eigen account`,
    );

    // 2. Veld blijft bewerkbaar; waarschuwing + terugknop bij afwijking.
    rtl.fireEvent.change(getInput(), { target: { value: "clerk_ander_999" } });
    assert.equal(getInput().value, "clerk_ander_999", `${name}: veld bewerkbaar`);
    assert.ok(
      view.container.textContent!.includes("ánder account"),
      `${name}: afwijkingswaarschuwing zichtbaar`,
    );
    const backBtn = Array.from(view.container.querySelectorAll("button")).find(
      (b) => b.textContent === "Terug naar eigen account",
    );
    assert.ok(backBtn, `${name}: terugknop aanwezig`);

    // 3. Prefill is éénmalig: een profielverversing (nieuwe objectidentiteit)
    //    mag NOOIT overschrijven wat de admin heeft getypt.
    currentProfile = { ...currentProfile!, displayName: "Eigen Tester v2" };
    view.rerender(React.createElement(Section));
    assert.equal(
      getInput().value,
      "clerk_ander_999",
      `${name}: getypte waarde blijft staan na profielverversing`,
    );

    // 4. Terugknop herstelt het eigen account en de bevestiging.
    rtl.fireEvent.click(backBtn!);
    assert.equal(getInput().value, OWN, `${name}: terugknop herstelt eigen account`);
    assert.ok(
      view.container.textContent!.includes("Dit is jouw huidige account"),
      `${name}: bevestiging terug na herstel`,
    );

    // 5. Nooit automatisch een controle/opschoning starten.
    if (name === "ProvenanceSection") {
      assert.ok(provenanceCalls.length > 0, "provenance-hook is aangeroepen");
      assert.ok(
        provenanceCalls.every((c) => c === ""),
        `automatische controle gestart met: ${JSON.stringify(provenanceCalls)}`,
      );
    } else {
      assert.equal(
        cleanupMutateCalls.length,
        0,
        "opschoning mag nooit automatisch starten",
      );
    }
  } finally {
    view.unmount();
  }
}

test("Gegevensbroncontrole: prefill éénmalig, bewerkbaar, geen auto-controle, waarschuwing + terugknop", async () => {
  await runSectionSuite("ProvenanceSection");
});

test("Gegevens-opschoning: prefill éénmalig, bewerkbaar, geen auto-start, waarschuwing + terugknop", async () => {
  await runSectionSuite("DataTrustCleanupSection");
});

test("zonder profiel: geen prefill en geen accountregel, tot het profiel er is (late prefill éénmalig)", async () => {
  currentProfile = null;
  const view = await renderSection("ProvenanceSection");
  const { rtl, React, Section, getInput } = view;
  try {
    assert.equal(getInput().value, "", "leeg veld zonder profiel");
    assert.equal(
      view.container.textContent!.includes("Dit is jouw huidige account"),
      false,
      "geen accountregel zonder profiel",
    );
    // Profiel komt binnen → alsnog éénmalig prefillen.
    setOwnProfile();
    view.rerender(React.createElement(Section));
    assert.equal(getInput().value, OWN, "late prefill zodra profiel bekend is");
    // …maar daarna nooit meer overschrijven.
    rtl.fireEvent.change(getInput(), { target: { value: "x" } });
    view.rerender(React.createElement(Section));
    assert.equal(getInput().value, "x", "late prefill blijft éénmalig");
  } finally {
    view.unmount();
  }
});
